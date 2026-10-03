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
#   Kotlin / Java (Gradle)    gradle build -x test
#   Scala (sbt)               sbt Test/compile
#   C# / F# (.NET)            dotnet build, every project file (tests included)
#   Perl                      perl -c on every module, script and test
#   Lua                       luac -p on every file (syntax only: LuaRocks is not
#                             reachable from every CI network, so dependencies are
#                             not resolved)
#   C++ (CMake)               cmake configure + build
#   Zig                       zig build
#   Plain JavaScript          pnpm install, node --check, and every import/require
#                             must resolve (scripts/check-js-imports.mjs)
#   Configuration-only        every YAML file must parse (scripts/check-yaml.mjs)
#
# A template is only SKIPped when its language toolchain is genuinely missing
# from the machine; the reason is printed next to the SKIP and repeated in the
# summary. Nothing is ever reported as passed without being checked with its
# own toolchain; a pass that checked less than a full build (Lua and
# configuration templates: syntax only) prints a NOTE saying so.
#
# Usage: bash scripts/scaffold-test-templates.sh [template ...]
#        bash scripts/scaffold-test-templates.sh --group core|jvm|dotnet|native|node|config ...
# Runs from the repo root after `pnpm -r build`.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI_BIN="$REPO_ROOT/packages/cli/dist/index.js"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

# Every backend template that builds with a toolchain available in CI. The
# list is split into groups so CI can run them as parallel jobs (each group
# needs a different set of toolchains); with no arguments every group runs.
# Templates that cannot be built here (broken as shipped, or their toolchain or
# dependency registry is unavailable) are deliberately not listed rather than
# listed and skipped (the sweep commit message records each exclusion and why).
GROUP_CORE=(
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
# JVM: Maven, Gradle (Kotlin) and sbt (Scala)
GROUP_JVM=(
  vertx micronaut
  ktor spring-boot-kotlin micronaut-kotlin http4k
  akka-http http4s-scala play-scala
)
# C# / F#: dotnet build of every project file
GROUP_DOTNET=(
  aspnet-core-webapi aspnet-core-minimal blazor-server grpc-service
  aspnet-dapper aspnet-automapper aspnet-xunit aspnet-efcore aspnet-hotreload
  giraffe
)
# Go, Rust, Python, Ruby, PHP, Perl, Lua, C++ (CMake; Drogon from the distribution packages)
GROUP_NATIVE=(
  chi go-sqlx grpc-go
  warp
  starlette sanic-py tornado-py django-enhanced
  sinatra grape
  slim symfony codeigniter
  mojolicious dancer2 catalyst
  openresty lapis lua-http kong-plugin
  drogon
)
# Node / TypeScript / plain JavaScript (pnpm install + tsc, or node --check)
GROUP_NODE=(
  hapi-ts apollo-server meteorjs graphql-codegen enterprise-sso
  compression-optimization universal-state-management unified-dev-environment
  actionherojs feathersjs sailsjs thinkjs totaljs
  api-caching api-contract-testing api-deprecation api-security-scan
  bottleneck-detection compliance-audit-logging couchdb-config
  cross-framework-component-sharing database-migration database-optimization-orm
  database-pooling disaster-recovery distributed-error-handling
  elasticsearch-config enterprise-monitoring global-cdn-integration
  graphql-federation influxdb-config load-testing-automation message-queue
  microfrontend-orchestration mongodb-config multi-tenant-architecture
  mysql-config neo4j-config performance-monitoring postgres-config pwa-features
  rate-limit-config redis-integration resource-loading-optimization
  security-scanning service-communication-optimization shared-config-server
  websocket-api-docs websocket-realtime
  loopback adonisjs restify polka middy hyper-express foalts tinyhttp marblejs eggjs
  graphql-yoga opentelemetry-tracing distributed-caching frontend-service-mesh-client
)

# Configuration-only templates: no toolchain, YAML syntax is checked (see
# verify_config); the TypeScript snippets some of them ship are not compiled.
GROUP_CONFIG=(
  docker-compose-microservices service-discovery
  istio-service-mesh linkerd-service-mesh envoy-proxy nginx-ingress
  traefik-proxy haproxy-lb volume-management secrets-management
  deployment-strategies
  service-auth service-observability api-gateway cors-config
  circuit-breaker service-dependencies service-communication
)

TEMPLATES=()
if [ "$#" -gt 0 ] && [ "$1" = "--group" ]; then
  # --group core|jvm|dotnet|native|node|config [...]: run whole groups
  shift
  while [ "$#" -gt 0 ]; do
    case "$1" in
      core) TEMPLATES+=("${GROUP_CORE[@]}") ;;
      jvm) TEMPLATES+=("${GROUP_JVM[@]}") ;;
      dotnet) TEMPLATES+=("${GROUP_DOTNET[@]}") ;;
      native) TEMPLATES+=("${GROUP_NATIVE[@]}") ;;
      node) TEMPLATES+=("${GROUP_NODE[@]}") ;;
      config) TEMPLATES+=("${GROUP_CONFIG[@]}") ;;
      *) echo "unknown group: $1 (core|jvm|dotnet|native|node|config)" >&2; exit 2 ;;
    esac
    shift
  done
elif [ "$#" -gt 0 ]; then
  TEMPLATES=("$@")
else
  TEMPLATES=("${GROUP_CORE[@]}" "${GROUP_JVM[@]}" "${GROUP_DOTNET[@]}" "${GROUP_NATIVE[@]}" "${GROUP_NODE[@]}" "${GROUP_CONFIG[@]}")
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
  elif [ -f fastapi_app.py ]; then
    step import "$py" -c 'import fastapi_app; assert hasattr(fastapi_app, "app"), "fastapi_app.app missing"' || return 1
  elif [ -f src/main.py ]; then
    step import env PYTHONPATH=src "$py" -c 'import main; assert hasattr(main, "app"), "main.app missing"' || return 1
  else
    NATIVE_REASON="no manage.py, main.py, run.py, fastapi_app.py or src/main.py entry point to import"
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

verify_gradle() {
  have gradle || { NATIVE_REASON="gradle is not installed"; return 2; }
  have java || { NATIVE_REASON="java is not installed"; return 2; }
  step build gradle --no-daemon -q build -x test || return 1
}

verify_sbt() {
  have sbt || { NATIVE_REASON="sbt is not installed"; return 2; }
  have java || { NATIVE_REASON="java is not installed"; return 2; }
  # Compiles main and test sources (and resolves the Play/sbt plugins).
  step compile sbt -batch Test/compile || return 1
}

verify_dotnet() {
  have dotnet || { NATIVE_REASON="dotnet (.NET SDK) is not installed"; return 2; }
  export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
  # Build every project file: a template can ship a separate test project.
  local proj count=0
  while IFS= read -r proj; do
    count=$((count + 1))
    step "build-${proj##*/}" dotnet build "$proj" --nologo -v q || return 1
  done < <(find . \( -path ./obj -o -path ./bin \) -prune -o \( -name '*.csproj' -o -name '*.fsproj' \) -print | awk '{ print length($0) " " $0 }' | sort -n | cut -d' ' -f2-)
  if [ "$count" -eq 0 ]; then
    NATIVE_REASON="no .csproj/.fsproj found"
    return 1
  fi
}

verify_perl() {
  have perl || { NATIVE_REASON="perl is not installed"; return 2; }
  # Every module, script and test must compile against the framework installed
  # from the distribution packages (Mojolicious, Dancer2, Catalyst, ...).
  local file count=0 log="$TMP_DIR/$TPL-perl.txt"
  : >"$log"
  while IFS= read -r file; do
    count=$((count + 1))
    if ! perl -Ilib -c "$file" >>"$log" 2>&1; then
      echo "  ✗ perl -c failed on $file"
      tail -n 10 "$log" | sed 's/^/    | /'
      NATIVE_REASON="perl -c failed on $file"
      return 1
    fi
  done < <(find . \( -name '*.pm' -o -name '*.pl' -o -path './script/*' -o -name '*.t' \) -type f)
  if [ "$count" -eq 0 ]; then
    NATIVE_REASON="no Perl files found"
    return 1
  fi
  echo "  ✓ perl -c ($count files)"
}

verify_lua() {
  local luac=""
  if have luac5.4; then luac=luac5.4; elif have luac; then luac=luac; elif have luac5.3; then luac=luac5.3; fi
  [ -n "$luac" ] || { NATIVE_REASON="luac (Lua compiler) is not installed"; return 2; }
  check_each syntax '*.lua' "$luac" -p || return 1
  NATIVE_NOTE="syntax only (luac -p): LuaRocks dependencies were not resolved"
}

# C++ (CMake): configure and build every target, tests included.
verify_cmake() {
  have cmake || { NATIVE_REASON="cmake is not installed"; return 2; }
  have g++ || have c++ || have clang++ || { NATIVE_REASON="no C++ compiler is installed"; return 2; }
  step configure cmake -S . -B build -DCMAKE_BUILD_TYPE=Release || return 1
  step build cmake --build build -j "$(nproc 2>/dev/null || echo 2)" || return 1
}

# Configuration-only templates (service meshes, proxies, compose bundles, ...)
# have nothing to compile: every YAML file must at least parse.
verify_config() {
  have node || { NATIVE_REASON="node is not installed"; return 2; }
  step yaml node "$REPO_ROOT/scripts/check-yaml.mjs" . || return 1
  NATIVE_NOTE="configuration template: YAML syntax only (other config formats and any TypeScript snippets are not compiled)"
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
  elif [ -f build.gradle.kts ] || [ -f build.gradle ]; then
    verify_gradle
  elif [ -f build.sbt ]; then
    verify_sbt
  elif compgen -G "*.csproj" >/dev/null || compgen -G "*.fsproj" >/dev/null; then
    verify_dotnet
  elif [ -f cpanfile ] || [ -f Makefile.PL ]; then
    verify_perl
  elif [ -f build.zig ]; then
    verify_zig
  elif [ -f mix.exs ]; then
    have mix || { NATIVE_REASON="elixir (mix) is not installed"; return 2; }
    step deps mix deps.get && step compile mix compile
  elif [ -f Package.swift ]; then
    have swift || { NATIVE_REASON="swift is not installed"; return 2; }
    step build swift build
  elif [ -n "$(find . -type f -name '*.lua' -print -quit)" ]; then
    verify_lua
  elif [ -f CMakeLists.txt ]; then
    verify_cmake
  elif [ -n "$(find . -type f \( -name '*.yaml' -o -name '*.yml' \) -print -quit)" ]; then
    verify_config
  else
    echo "  ✗ no recognised build manifest in the generated app"
    NATIVE_REASON="no recognised build manifest (package.json, go.mod, Cargo.toml, pom.xml, build.gradle(.kts), build.sbt, *.csproj, *.fsproj, composer.json, Gemfile, requirements.txt, cpanfile, CMakeLists.txt, build.zig, mix.exs, Package.swift, *.lua, *.yaml)"
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
    if [ -n "$(find . -path ./node_modules -prune -o -type f \( -name '*.ts' -o -name '*.tsx' \) -print -quit)" ]; then
      fail_template "TypeScript sources but no tsconfig.json"
      continue
    fi
    # Plain JavaScript has no compiler: parse every file and make sure every
    # import / require resolves against the installed dependencies.
    JS_COUNT=0
    JS_BAD=""
    while IFS= read -r JS_FILE; do
      JS_COUNT=$((JS_COUNT + 1))
      if ! node --check "$JS_FILE" >"$TMP_DIR/js-check-$TPL.txt" 2>&1; then
        JS_BAD="$JS_FILE"
        break
      fi
    done < <(find . -path ./node_modules -prune -o -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \) -print)
    if [ -n "$JS_BAD" ]; then
      echo "  ✗ syntax error in $JS_BAD"
      head -5 "$TMP_DIR/js-check-$TPL.txt"
      fail_template "JavaScript syntax error in $JS_BAD"
      continue
    fi
    if [ "$JS_COUNT" -eq 0 ]; then
      fail_template "no JavaScript or TypeScript sources to verify"
      continue
    fi
    if ! node "$REPO_ROOT/scripts/check-js-imports.mjs" "$APP_DIR" >"$TMP_DIR/js-imports-$TPL.txt" 2>&1; then
      head -8 "$TMP_DIR/js-imports-$TPL.txt"
      fail_template "unresolved imports"
      continue
    fi
    echo "  ✓ JavaScript syntax and imports verified ($JS_COUNT files)"
    PASS=$((PASS + 1))
    cd "$REPO_ROOT"
    rm -rf "$PROJ_DIR"
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
