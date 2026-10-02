#!/bin/bash
# CI job: scaffold a representative set of backend templates and verify they
# type-check. Catches the class of bugs where a template's generated code
# references services/deps that don't exist (the #76 express bug).
#
# Usage: bash scripts/scaffold-test-templates.sh [template ...]
# Runs from the repo root after `pnpm -r build`.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI_BIN="$REPO_ROOT/packages/cli/dist/index.js"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

# Representative templates across languages — not all 213, but one per language
# ecosystem + the most popular frameworks.
TEMPLATES=(
  express fastify nestjs koa hono
  fastapi flask django
  gin echo fiber
  actix-web rocket axum
  spring-boot quarkus
  laravel rails-api
  phoenix vapor
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

  # This job verifies Node/TypeScript builds only. Do not install Node
  # dependencies or count scaffold-only native templates as validated builds.
  if [ ! -f "package.json" ]; then
    case "$TPL" in
      express|fastify|nestjs|koa|hono)
        fail_template "missing package.json"
        ;;
      *)
        echo "  SKIP: non-Node build not verified (language toolchain checks are not configured)"
        SKIP=$((SKIP + 1))
        SKIPPED_TEMPLATES+=("$TPL (non-Node build not verified)")
        ;;
    esac
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
  echo "SKIPPED TEMPLATES (not verified):"
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
  echo "All checked templates passed; skipped builds remain unverified."
fi
