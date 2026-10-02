# Stability Work

This is the current stability backlog as of 2026-10-02. It supersedes historical
implementation checklists for the next stability batch, not the product's
long-term roadmap. Changes on a branch are not published-release proof.

## First Batch

- Dependency overrides live in root `package.json` under `pnpm.overrides`, which
  the pinned pnpm 9.15.9 toolchain reads. The generated lockfile records all five
  overrides; frozen installation and resolved-version regression checks verify
  them. This is not a claim that all dependency advisories are resolved.
- `fix --ci` fails with `FIX_CI_ERROR` when no evaluator is wired. It does not
  claim that gates passed or attempt a fix/PR based on an unavailable evaluator.
- `ui test` fails with `UI_TEST_ERROR` when no runner is wired. Empty runs and
  invalid or empty gate configurations cannot pass. The `test` subcommand
  attaches to the dashboard's existing `ui` command rather than shadowing it.
- Plugin update and compatibility validation are explicitly unavailable. They
  return nonzero errors (`PLUGIN_UPDATE_ERROR`, `PLUGIN_VALIDATE_ERROR` in JSON)
  without simulated checks, delays or changes. Plugin installation's manifest
  validation is a separate supported path.
- The NestJS package template emits strict JSON without a trailing comma.
  Strict JSON output alone does not prove dependency installation, compilation
  or application boot.
- Template creation persists one shared initial creation/update timestamp even
  when filesystem operations advance the clock. Later saves refresh only the
  update timestamp; deterministic regressions verify both returned and saved data.
- Template health distinguishes passed, failed and skipped builds. Missing Node
  apps/manifests/configs/compiler, failed scaffold/install/Prisma/typecheck and
  malformed manifests fail. Native builds without configured toolchains are
  explicitly skipped and unverified, never counted as passed.

## Current Verification

Local checks on `fix/stability-verification`:

- Frozen dependency installation, full workspace build and typecheck pass.
- Full workspace test run passes: 6,187 tests across CLI, contracts, MCP, UI
  and dashboard; five existing CLI E2E tests are skipped, not verified.
- Configured CLI coverage checks pass: 93.81% lines and 85.22% branches. This
  is the configured coverage surface, not whole-product runtime coverage.
- Focused persistence, template-health accounting and real CLI-routing checks
  pass (54 tests). Interactive CLI checks pass (16 tests).
- Generated Express, Fastify, Koa and Hono projects install and typecheck with
  the repository's pinned package manager.
- Generated NestJS installs but fails compilation (65 diagnostic lines),
  including missing authentication guards/configuration and undefined module
  symbols. The strict-JSON repair does not address those existing omissions.
  The template-health command reports four passes and one failure and exits 1.

This is local source/generated-project evidence, not application boot,
browser, clean-package or published-release proof. NestJS remains a required
generated-project blocker; do not mark the release ready or bypass that check.

## Next Batch

1. Establish repeatable install/build/boot evidence for representative generated
   projects, fixing failures surfaced by the stricter template checks.
2. Verify frontend-only/backend/fullstack creation and non-TTY microfrontend
   `--yes` behavior. Keep skeleton creation distinct from runnable apps.
3. Harden service spawn failures, immediate exits, PID/log cleanup and stopping.
4. Run real browser flows against the hub; make browser E2E an executable release
   gate rather than a skipped optional check.
5. Verify packed CLI/dashboard/MCP artifacts from a clean installation outside
   the monorepo, including declared dependencies and command routing.
6. Reconcile public capability claims, versions, paths and examples with actual
   command behavior before selecting new adapters or optional features.

## Release Gates

- Build, typecheck and focused plus relevant broad/interactive suites pass on
  the exact candidate.
- Unsupported commands cannot return verified-success claims.
- Required generated-project install/build/boot checks pass; skips and external
  prerequisites remain explicit.
- Dashboard browser checks and clean-package smoke pass before a release is
  declared ready. A passing build or CI run alone is insufficient.
- Reviewed commits, version changes and release notes describe the work only.
  Publication, deployment and optional scaffold promotion are separate actions.

## Parked Scope

VS Code host integration, desktop/Tauri distribution, hosted control plane,
additional provider-backed AI and broad cloud/collaboration extensions are not
required for this stability batch. Graph-Loop and Sol Advisor remain disabled.
Historical agent handoffs and speculative plans do not authorize their restart.
