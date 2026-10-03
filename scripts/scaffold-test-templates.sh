#!/bin/bash
# CI job: scaffold a representative set of backend templates and verify each one
# really builds with its own language toolchain. Catches the class of bugs where
# a template's generated code references services/deps/files that don't exist
# (the #76 express bug).
#
#   Node / TypeScript / Bun   pnpm install, then tsc --noEmit
#   Python                    venv, pip install, compileall, import the app
#   Go                        go mod tidy, go build ./...
#   Rust                      cargo check
#   PHP                       php -l on every file, composer install
#   Ruby                      ruby -c on every file, bundle install
#   Java (Maven)              mvn -DskipTests package
#   Zig                       zig build
#
# A template is only SKIPped when its language toolchain is genuinely missing
# from the machine; the reason is printed next to the SKIP and repeated in the
# summary. Nothing is ever reported as passed without having been built.
#
# Usage: bash scripts/scaffold-test-templates.sh [template ...]
# Runs from the repo root after `pnpm -r build`.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI_BIN="$REPO_ROOT/packages/cli/dist/index.js"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

# Representative templates across languages: not every template in the registry
# (`re-shell templates list --json`), but one per language ecosystem plus the most
# popular frameworks.
TEMPLATES=(
  express fastify nestjs koa hono
  fastapi flask django
  gin echo fiber
  actix-web rocket axum
  spring-boot quarkus
  laravel rails-api
  phoenix vapor
  elysia-bun bun-serve trpc-bun
  zig-http std-http-zig
)
if [ "$#" -gt 0 ]; then
  TEMPLATES=("$@")
fi

PASS=0
FAIL=0
SKIP=0
FAILED_TEMPLATES=()
SKIPPED_TEMPLATES=()

fail_template() {
  echo "  FAIL: $1"
  FAIL=$((FAIL + 1))
  FAILED_TEMPLATES+=("$TPL ($1)")
}

skip_template() {
  echo "  SKIP: $1"
  SKIP=$((SKIP + 1))
  SKIPPED_TEMPLATES+=("$TPL ($1)")
}

have() {
  command -v "$1" >/dev/null 2>&1
}

# ---------------------------------------------------------------------------
# Native (non-Node) verification.
#
# verify_native <template> <app dir>
#   returns 0  verified: built with its own toolchain
#           1  build/verification failed; NATIVE_REASON says which step
#           2  toolchain missing; NATIVE_REASON says which one
#   NATIVE_NOTE is set when a pass verified less than usual (printed, not hidden).
# Step output goes to $TMP_DIR/<template>-<step>.txt.
# ---------------------------------------------------------------------------
NATIVE_REASON=""
NATIVE_NOTE=""

# step <name> <command...>: run in the current directory, log, remember failure.
step() {
  local name="$1"
  shift
  local log="$TMP_DIR/$TPL-$name.txt"
  if "$@" >"$log" 2>&1; then
    echo "  ✓ $name"
    return 0
  fi
  echo "  ✗ $name failed"
  tail -n 15 "$log" | sed 's/^/    | /'
  NATIVE_REASON="$name failed"
  return 1
}

# Every file under the app (minus vendored/build output) with the given suffix.
list_files() {
  find . \( -path ./node_modules -o -path ./vendor -o -path ./.venv -o -path ./target -o -path ./.bundle \) -prune -o -type f -name "$1" -print
}

# Run a syntax checker over every matching file; stop at the first bad one.
check_each() {
  local label="$1" pattern="$2"
  shift 2
  local log="$TMP_DIR/$TPL-$label.txt"
  local count=0 file
  : >"$log"
  while IFS= read -r file; do
    count=$((count + 1))
    if ! "$@" "$file" >>"$log" 2>&1; then
      echo "  ✗ $label failed on $file"
      tail -n 10 "$log" | sed 's/^/    | /'
      NATIVE_REASON="$label failed on $file"
      return 1
    fi
  done < <(list_files "$pattern")
  if [ "$count" -eq 0 ]; then
    echo "  ✗ $label found no $pattern files"
    NATIVE_REASON="$label found no $pattern files"
    return 1
  fi
  echo "  ✓ $label ($count files)"
}

verify_python() {
  have python3 || { NATIVE_REASON="python3 is not installed"; return 2; }
  step venv python3 -m venv .venv || return 1
  local py="$PWD/.venv/bin/python"
  if [ -f requirements.txt ]; then
    step install "$py" -m pip install --quiet --disable-pip-version-check -r requirements.txt || return 1
  elif [ -f pyproject.toml ]; then
    step install "$py" -m pip install --quiet --disable-pip-version-check . || return 1
  else
    echo "  ✗ no requirements.txt or pyproject.toml"
    NATIVE_REASON="no requirements.txt or pyproject.toml"
    return 1
  fi
  step compile "$py" -m compileall -q -x '/\.venv/' . || return 1
  # Import the application module. Only generic settings are supplied here; a
  # template must otherwise boot from its own development defaults.
  export SECRET_KEY="${SECRET_KEY:-template-health-check-secret}"
  if [ -f manage.py ]; then
    step import "$py" manage.py check || return 1
  elif [ -f main.py ]; then
    step import "$py" -c 'import main; assert hasattr(main, "app"), "main.app missing"' || return 1
  elif [ -f run.py ]; then
    step import "$py" -c 'import run; assert hasattr(run, "app"), "run.app missing"' || return 1
  else
    NATIVE_REASON="no manage.py, main.py or run.py entry point to import"
    echo "  ✗ $NATIVE_REASON"
    return 1
  fi
}

verify_go() {
  have go || { NATIVE_REASON="go is not installed"; return 2; }
  # go.sum is not shipped (it can't be); tidy resolves and records the modules.
  step tidy go mod tidy || return 1
  step build go build ./... || return 1
}

verify_rust() {
  have cargo || { NATIVE_REASON="cargo is not installed"; return 2; }
  # Share one target dir so the dependency tree compiles once per run.
  export CARGO_TARGET_DIR="$TMP_DIR/cargo-target"
  step check cargo check || return 1
}

verify_php() {
  have php || { NATIVE_REASON="php is not installed"; return 2; }
  check_each lint '*.php' php -l || return 1
  if have composer; then
    if [ "${TEMPLATE_HEALTH_COMPOSER_RESOLVE_ONLY:-0}" = "1" ]; then
      # For networks that cannot download GitHub dist archives: resolve the full
      # dependency tree (versions, conflicts) without installing it.
      step composer-resolve composer update --dry-run --no-interaction --no-progress --no-scripts || return 1
      NATIVE_NOTE="composer dependencies were resolved but not downloaded (TEMPLATE_HEALTH_COMPOSER_RESOLVE_ONLY=1)"
    else
      step composer-install composer install --no-interaction --no-progress --no-scripts || return 1
    fi
  else
    NATIVE_NOTE="syntax only: composer is not installed, dependencies were not installed"
  fi
}

verify_ruby() {
  have ruby || { NATIVE_REASON="ruby is not installed"; return 2; }
  check_each syntax '*.rb' ruby -c || return 1
  if have bundle; then
    step bundle-install env BUNDLE_PATH=vendor/bundle bundle install --quiet || return 1
    # Load the Rails application (initializers, middleware, routes) without a database.
    if [ -f bin/rails ]; then
      step load env BUNDLE_PATH=vendor/bundle bundle exec ruby bin/rails routes || return 1
    fi
  else
    NATIVE_NOTE="syntax only: bundler is not installed, gems were not installed"
  fi
}

verify_java() {
  have mvn || { NATIVE_REASON="mvn (Maven) is not installed"; return 2; }
  have java || { NATIVE_REASON="java is not installed"; return 2; }
  step package mvn -B -q -DskipTests package || return 1
}

verify_zig() {
  have zig || { NATIVE_REASON="zig is not installed"; return 2; }
  step build zig build || return 1
}

verify_native() {
  local tpl="$1" dir="$2"
  NATIVE_REASON=""
  NATIVE_NOTE=""
  cd "$dir"
  if [ -f manage.py ] || [ -f requirements.txt ] || [ -f pyproject.toml ]; then
    verify_python
  elif [ -f go.mod ]; then
    verify_go
  elif [ -f Cargo.toml ]; then
    verify_rust
  elif [ -f composer.json ]; then
    verify_php
  elif [ -f Gemfile ]; then
    verify_ruby
  elif [ -f pom.xml ]; then
    verify_java
  elif [ -f build.zig ]; then
    verify_zig
  elif [ -f mix.exs ]; then
    have mix || { NATIVE_REASON="elixir (mix) is not installed"; return 2; }
    step deps mix deps.get && step compile mix compile
  elif [ -f Package.swift ]; then
    have swift || { NATIVE_REASON="swift is not installed"; return 2; }
    step build swift build
  else
    echo "  ✗ no recognised build manifest in the generated app"
    NATIVE_REASON="no recognised build manifest (package.json, go.mod, Cargo.toml, pom.xml, composer.json, Gemfile, requirements.txt, build.zig, mix.exs, Package.swift)"
    return 1
  fi
}

for TPL in "${TEMPLATES[@]}"; do
  echo ""
  echo "━━━ Testing template: $TPL ━━━"
  PROJ_DIR="$TMP_DIR/test-$TPL"

  # Scaffold from the temp dir, NOT the repo root: run inside the repo, the
  # CLI detects the monorepo and switches to the interactive in-monorepo
  # workspace flow (prompts despite --yes), which hangs without a TTY and
  # never prints "Scaffolded". Each iteration re-cds because the typecheck
  # path below returns to $REPO_ROOT.
  cd "$TMP_DIR"

  SCAFFOLD_LOG="$TMP_DIR/scaffold-$TPL.txt"
  if node "$CLI_BIN" create "test-$TPL" --backend "$TPL" --yes >"$SCAFFOLD_LOG" 2>&1 && grep -q "Scaffolded" "$SCAFFOLD_LOG"; then
    echo "  ✓ Scaffold produced"
  else
    fail_template "scaffold failed"
    head -5 "$SCAFFOLD_LOG"
    continue
  fi

  APP_DIR="$PROJ_DIR/apps/test-$TPL"
  [ -d "$PROJ_DIR/apps/test-$TPL-api" ] && APP_DIR="$PROJ_DIR/apps/test-$TPL-api"

  if [ ! -d "$APP_DIR" ]; then
    fail_template "no generated app directory"
    continue
  fi

  cd "$APP_DIR"

  # Non-Node templates are built with their own language toolchain.
  if [ ! -f "package.json" ]; then
    case "$TPL" in
      express|fastify|nestjs|koa|hono)
        fail_template "missing package.json"
        ;;
      *)
        NATIVE_RC=0
        verify_native "$TPL" "$APP_DIR" || NATIVE_RC=$?
        case "$NATIVE_RC" in
          0)
            echo "  ✓ Native build verified"
            [ -n "$NATIVE_NOTE" ] && echo "  NOTE: $NATIVE_NOTE"
            PASS=$((PASS + 1))
            ;;
          2)
            skip_template "toolchain missing: $NATIVE_REASON"
            ;;
          *)
            fail_template "native build: $NATIVE_REASON"
            ;;
        esac
        ;;
    esac
    cd "$REPO_ROOT"
    rm -rf "$PROJ_DIR"
    continue
  fi

  if ! node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$APP_DIR/package.json" >"$TMP_DIR/package-json-$TPL.txt" 2>&1; then
    fail_template "invalid package.json"
    head -5 "$TMP_DIR/package-json-$TPL.txt"
    continue
  fi

  # Select the repository's pinned package manager before targeting the
  # generated app; running from the temporary app can select a global version.
  cd "$REPO_ROOT"
  if ! pnpm --dir "$APP_DIR" install --silent >"$TMP_DIR/install-$TPL.txt" 2>&1; then
    fail_template "dependency install failed"
    head -5 "$TMP_DIR/install-$TPL.txt"
    continue
  fi
  cd "$APP_DIR"

  # Generate Prisma client if present
  if [ -f "prisma/schema.prisma" ]; then
    if ! npx --yes -p prisma@5 prisma generate >"$TMP_DIR/prisma-$TPL.txt" 2>&1; then
      fail_template "Prisma client generation failed"
      head -5 "$TMP_DIR/prisma-$TPL.txt"
      continue
    fi
  fi

  # Run typecheck — only for TypeScript-capable templates. tsc prints
  # diagnostics to STDOUT, so capture both streams (counting only stderr
  # made tsconfig-less runs report "FAILED (0 errors)").
  if [ ! -f "tsconfig.json" ]; then
    fail_template "missing tsconfig.json"
    continue
  fi

  TSC_BIN="$APP_DIR/node_modules/.bin/tsc"
  if [ ! -x "$TSC_BIN" ]; then
    fail_template "missing TypeScript compiler"
    continue
  fi

  if "$TSC_BIN" --noEmit >"$TMP_DIR/tsc-err-$TPL.txt" 2>&1; then
    echo "  ✓ Typecheck passed"
    PASS=$((PASS + 1))
  else
    ERROR_COUNT=$(wc -l < "$TMP_DIR/tsc-err-$TPL.txt" | tr -d ' ')
    echo "  ✗ Typecheck FAILED ($ERROR_COUNT diagnostic lines)"
    head -5 "$TMP_DIR/tsc-err-$TPL.txt"
    fail_template "typecheck: $ERROR_COUNT diagnostic lines"
  fi

  cd "$REPO_ROOT"
  rm -rf "$PROJ_DIR"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "RESULTS: $PASS passed, $FAIL failed, $SKIP skipped"
if [ "$SKIP" -gt 0 ]; then
  echo "SKIPPED TEMPLATES (not verified; toolchain missing on this machine):"
  for st in "${SKIPPED_TEMPLATES[@]}"; do
    echo "  SKIP: $st"
  done
fi
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "FAILED TEMPLATES:"
  for ft in "${FAILED_TEMPLATES[@]}"; do
    echo "  ✗ $ft"
  done
  exit 1
fi
if [ "$SKIP" -eq 0 ]; then
  echo "ALL TEMPLATES PASSED ✓"
else
  echo "All checked templates passed; skipped templates remain unverified (see reasons above)."
fi
