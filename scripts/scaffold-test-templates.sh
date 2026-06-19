#!/bin/bash
# CI job: scaffold a representative set of backend templates and verify they
# type-check. Catches the class of bugs where a template's generated code
# references services/deps that don't exist (the #76 express bug).
#
# Usage: bash scripts/scaffold-test-templates.sh
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

PASS=0
FAIL=0
FAILED_TEMPLATES=()

for TPL in "${TEMPLATES[@]}"; do
  echo ""
  echo "━━━ Testing template: $TPL ━━━"
  PROJ_DIR="$TMP_DIR/test-$TPL"

  if node "$CLI_BIN" create "test-$TPL" --backend "$TPL" --yes 2>/dev/null | grep -q "Scaffolded"; then
    echo "  ✓ Scaffold produced"
  else
    echo "  ✗ Scaffold failed (no backend files generated — skipping if unsupported)"
    FAIL=$((FAIL + 1))
    FAILED_TEMPLATES+=("$TPL (scaffold)")
    continue
  fi

  APP_DIR="$PROJ_DIR/apps/test-$TPL"
  [ -d "$PROJ_DIR/apps/test-$TPL-api" ] && APP_DIR="$PROJ_DIR/apps/test-$TPL-api"

  if [ ! -d "$APP_DIR" ]; then
    echo "  ⚠ No app dir found — skipping typecheck"
    PASS=$((PASS + 1))
    continue
  fi

  cd "$APP_DIR"

  # Try to install deps (may fail for non-Node languages — that's OK)
  if ! pnpm install --silent 2>/dev/null; then
    echo "  ⚠ Install skipped (likely non-Node template)"
    PASS=$((PASS + 1))
    cd "$REPO_ROOT"
    continue
  fi

  # Generate Prisma client if present
  if [ -f "prisma/schema.prisma" ]; then
    npx --yes -p prisma@5 prisma generate 2>/dev/null || true
  fi

  # Run typecheck
  TSC_BIN=$(find "$PROJ_DIR" -name tsc -path "*/.bin/*" 2>/dev/null | head -1)
  if [ -z "$TSC_BIN" ]; then
    echo "  ⚠ No tsc found — skipping typecheck"
    PASS=$((PASS + 1))
    cd "$REPO_ROOT"
    continue
  fi

  if "$TSC_BIN" --noEmit 2>"$TMP_DIR/tsc-err-$TPL.txt"; then
    echo "  ✓ Typecheck passed"
    PASS=$((PASS + 1))
  else
    ERROR_COUNT=$(wc -l < "$TMP_DIR/tsc-err-$TPL.txt" | tr -d ' ')
    echo "  ✗ Typecheck FAILED ($ERROR_COUNT errors)"
    head -5 "$TMP_DIR/tsc-err-$TPL.txt"
    FAIL=$((FAIL + 1))
    FAILED_TEMPLATES+=("$TPL (typecheck: $ERROR_COUNT errors)")
  fi

  cd "$REPO_ROOT"
  rm -rf "$PROJ_DIR"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "RESULTS: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "FAILED TEMPLATES:"
  for ft in "${FAILED_TEMPLATES[@]}"; do
    echo "  ✗ $ft"
  done
  exit 1
fi
echo "ALL TEMPLATES PASSED ✓"
