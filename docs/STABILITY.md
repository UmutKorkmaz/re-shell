# Stability Work

This is the stability status as of 2026-10-03, at CLI `0.31.0` (not published; `0.30.1`
is the last published version, and a published version is never reused). It
supersedes the historical implementation checklists for the stability batch, not the
product's long-term roadmap ([`ROADMAP.md`](./ROADMAP.md)). Changes on a branch are
not published-release proof.

**The release is not declared ready.** Everything in the Next Batch below is
implemented, but several of its gates are CI jobs and **none of the new workflows has
run on GitHub yet** ("pending first CI run"). What was and was not verified locally is
stated precisely in [Current Verification](#current-verification).

## First Batch (carried forward, updated)

- Dependency overrides live in root `package.json` under `pnpm.overrides`, which the
  pinned pnpm 9.15.9 toolchain reads; the lockfile records them and frozen installation
  verifies them. This is not a claim that all dependency advisories are resolved.
- `fix --ci` is now **real**: a gate evaluator (real processes, test gates locked), AI
  patches validated before they touch the tree (no test, config or CI edits, no
  suppression directives), rollback, and a PR flow. Without `ANTHROPIC_API_KEY` it is
  report-only and claims no fix; without `--ci` it still fails with `FIX_CI_ERROR`.
  *(env-limited: no live LLM call has been made.)*
- `ui test` is now **real**: it runs Storybook interaction, a11y and visual tests and
  gates on them. No Storybook, an empty run or an invalid gate configuration is
  `UI_TEST_ERROR`, never a pass.
- Plugin `update` and `validate` are now **real** (npm and git updates that respect pins;
  manifest, entry, engines, dependency and security validation). They no longer return
  the unavailable-feature errors. Uninstall, pin and review are also real.
- The NestJS package template was rewritten; it installs, typechecks, builds and boots
  (the earlier compilation failure is resolved), and is part of the boot check.
- Template creation persists one shared initial creation/update timestamp.
- Template health distinguishes passed, failed and skipped builds. Native builds without
  a configured toolchain are explicitly skipped and unverified, never counted as passed.

## Current Verification

Run in this worktree for this documentation pass (Linux VM, Node 22, pnpm 9.15.9).

| Check | Result |
|-------|--------|
| `pnpm install --frozen-lockfile` | passes; the version bump needed no lockfile change (internal dependencies use `workspace:` ranges) |
| `pnpm -r build` | passes (exit 0), and `pnpm -r typecheck` passes (exit 0) |
| `pnpm --filter @re-shell/site build` | passes (44 pages) |
| `node packages/cli/scripts/gen-cli-contracts.mjs --check` | `docs/CLI-CONTRACTS.md is up to date.` |
| `vitest run tests/contract-conformance.test.ts tests/integration/json-hygiene-cli.test.ts tests/unit/brand-urls.test.ts` (packages/cli) | passes: 3 files, 97 tests |
| `node scripts/pack-smoke.mjs` | passes 10/10 checks (packed contracts 0.3.0, cli 0.31.0, mcp 0.2.0; `--version` printed `0.31.0`; `templates list --json` returned 208; the MCP handshake exposed 9 tools). The first run failed 9/10 because the script still read the `ui --dry-run --json` plan as a bare object while the CLI now wraps it in the standard envelope; the script was fixed to accept the envelope and the rerun passed |
| `node scripts/check-doc-commands.mjs --flags` | passes: 777 invocations in 66 files, 0 unknown commands, 0 undeclared flags |
| `node scripts/check-site-links.mjs` | passes: 254 internal links, 0 broken (anchors included) |
| Package test suites | contracts 329 tests (18 files) pass; mcp 73 (8 files) pass; ui 318 (22 files) pass when run as CI does (`npx vitest run`; invoking the binary directly picks up a global TypeScript 6 on this machine and fails the typecheck step); dashboard 50 hub tests (5 files) and 344 UI tests (36 files) pass; control plane 349 tests (25 files) pass at 93.1% line coverage; CLI (everything except `tests/interactive`) 8291 pass, 24 skipped, **4 fail**, all four in `tests/integration/plugin-create-cli.test.ts` with `process.chdir() is not supported in workers`, a quirk of running from a checkout whose path contains `.claude/` (the config relies on a path glob to run that file outside a worker); those four are not claimed as passing here |

Evidence from the feature workstreams that landed these changes (run locally when they
were merged; **not re-run in this documentation pass**):

- Playwright against the real hub and CLI: the axe audit of every screen in both themes
  (83 specs passed) and the 2001-node graph explorer scale spec (8 specs passed).
- `scripts/k8s-live-check.sh` steps 1-8 against a local k3s cluster; Docker builds of the
  control-plane images with a `/healthz` check; the desktop `.deb`, release binary and
  AppImage under Xvfb.
- Redis and Kafka round trips of the generated async bridge in Docker containers.

**What this machine could not run:** the interactive CLI suite (`tests/interactive`
uses `node-pty`, which aborts the worker pool when the checkout path contains `.claude/`;
it runs in CI), the VS Code host test (download blocked), Flux/Argo CD sync, any live
LLM or cloud call, and any hosted GitHub Actions run.

**Template verification counts: 170 of the 208 registry templates were scaffolded with
the built CLI and built with their own toolchain on this machine** by
`scripts/scaffold-test-templates.sh`. The script lists 172; the other two, `vapor`
(Swift) and `phoenix` (Elixir, needs the hex registry), could not be built here and run
only in the `template-health` CI job:

| Group (`--group`) | Templates | Check |
|---|---|---|
| `core` | 25 (23 built here) | `tsc`, `go build`, `cargo check`, `mvn package`, `zig build` (Zig 0.13.0), Python compile and import, `php -l` + composer, `ruby -c` + bundle; `mix compile` and `swift build` in CI only |
| `jvm` | 9 | Maven, Gradle (Kotlin), sbt (Scala) |
| `dotnet` | 15 | `dotnet build` of every C# and F# project |
| `native` | 27 | Go, Rust, Python, Ruby, PHP, Perl (`perl -c`), Lua (`luac -p`, syntax only), C++ with CMake against distribution packages (`drogon`, `cpp-httplib`, `beast`, `pistache`), Dart (`dart pub get` + `dart analyze`, no test run) |
| `node` | 72 | `pnpm install` + `tsc`, or `node --check` plus an import-resolution check for plain JavaScript, or `rescript build` |
| `haskell` | 4 | `cabal build all --enable-tests` + `cabal test` (GHC 9.4.7); the shipped `stack.yaml` files are not exercised |
| `deno` | 2 | `deno check` + `deno test` (Deno 2; dependencies from JSR and npm) |
| `config` | 18 | YAML syntax only (configuration templates; their TypeScript snippets are not compiled) |

Eight Node and Bun backends are also booted (`scripts/boot-test-templates.mjs`, below),
and the agents that repaired templates ran many of them as servers or against their own
tests; that is not repeated by the script.

**The other 36 are registered, scaffoldable and covered by the registry and placeholder
tests, but not built**, because this environment cannot reach what they need:

- Dependency registry or source host blocked (17): Elixir `plug-ex`, `nerves-ex` (hex);
  Clojure `compojure`, `luminus-clj`, `reitit-clj`, `pedestal-clj` (Clojars); Nim
  `jester`, `prologue-nim`, `happyx-nim` (nimble); Crystal `kemal`, `lucky-cr`, `amber-cr`
  (shards on GitHub); OCaml `dream-ocaml`, `opium-ocaml` (opam); `zap-zig` and C++ `crow`
  (sources on GitHub); `aleph-deno` (Aleph.js is only on deno.land/x).
- Toolchain not installable here (19): Swift `perfect`, `kitura`, `hummingbird`; Julia
  `genie-jl`, `oxygen-jl`; V `vweb`, `vex-v`; Gleam `wisp`; `odin-http`, `jennet-pony`,
  `red-http`, `grain`, `mojo`, `mojo-fastapi`, `roc`, `ballerina`, `unison`, `carbon`,
  `vale`.

None was deleted, and none is counted as verified.

## Next Batch (status)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Repeatable install/build/boot evidence for representative generated projects, fixing the failures the stricter checks surface | **DONE for 170 of 208 templates built here (172 in CI); 36 environment-limited (listed above); pending first CI run** | `scripts/scaffold-test-templates.sh` scaffolds 172 templates and builds each with its own toolchain, in eight groups that CI runs as parallel jobs (counts and checks above); `scripts/boot-test-templates.mjs` installs, builds, boots on a free port with no DB or Redis, probes `/health` and a route, and requires a clean SIGTERM for express, fastify, koa, hono, nestjs, elysia-bun, bun-serve and trpc-bun. Failures found were fixed while the list grew from 25 to 172 (hyphenated project names used as identifiers, nonexistent dependency versions and APIs, files referenced but never shipped, ESM/CommonJS mismatches, YAML errors; some, such as `angel3`, `beast`, `fresh-deno` (ported to Fresh 2), the ReScript and the Haskell templates, were largely rewritten), plus placeholders in file paths and slow start and shutdown. The `template-health` workflow runs both on every push and PR (pending first CI run). |
| 2 | Frontend-only/backend/fullstack creation and non-TTY microfrontend `--yes` behavior; skeletons distinct from runnable apps | **DONE** | `create` never prompts under `--yes`/`--json`/`--dry-run`/non-TTY for every mode; `--gateway --services --remotes --force --template blank`; `TEMPLATE_NOT_FOUND`; `--type` limited to `app\|package\|lib\|tool`; `create --dry-run --json` returns the exact files and diffs. Tests: `tests/integration/create-headless-*.test.ts`, `tests/unit/create-noninteractive.test.ts`. Skeletons are labelled: `generate backend` writes a small starter, `create` the full template, and neither claims the project runs. |
| 3 | Harden service spawn failures, immediate exits, PID/log cleanup and stopping | **DONE** | `service run`: `SERVICES_*` error codes, `--alive-ms`, JSON pid files, `re-shell.services.<script>` metadata, graceful SIGTERM then SIGKILL, `health` exits non-zero when nothing runs. `tests/unit/service-process.test.ts`, `services-runtime.test.ts`, `tests/integration/service-run-cli.test.ts`. |
| 4 | Real browser flows against the hub, as an executable release gate | **DONE as CI jobs; pending first CI run** | `ci.yml` job `e2e` (Playwright `chromium` flow and the graph-scale spec) and `accessibility.yml` (axe) run on every push and PR. Both passed locally when merged (see above). |
| 5 | Verify packed CLI/dashboard/MCP artifacts from a clean install outside the monorepo | **DONE locally; pending first CI run** | `scripts/pack-smoke.mjs` (CI job `pack-smoke`): packs contracts, cli and mcp (the cli `prepack` bundles the dashboard), installs the tarballs in a temp dir outside the repo, checks `--version` equals the package version, `--help`, `templates list --json`, `ui --dry-run --json` and an MCP handshake. Ran in this pass: passes 10/10 checks (packed contracts 0.3.0, cli 0.31.0, mcp 0.2.0; `--version` printed `0.31.0`; `templates list --json` returned 208; the MCP handshake exposed 9 tools). The first run failed 9/10 because the script still read the `ui --dry-run --json` plan as a bare object while the CLI now wraps it in the standard envelope; the script was fixed to accept the envelope and the rerun passed. |
| 6 | Reconcile public claims, versions, paths and examples with actual behavior | **DONE** | Every `re-shell ...` command in the site, READMEs and `docs/` is checked against the built CLI by `scripts/check-doc-commands.mjs`; every internal site link by `scripts/check-site-links.mjs`. Versions, command and template counts are taken from the CLI and `package.json`. The unmaintained `packages/cli/EXAMPLES.md`, which described commands that do not exist, was removed and is no longer published to npm. |

## Release Gates

| Gate | Status | What remains |
|------|--------|--------------|
| Build, typecheck and focused plus relevant broad/interactive suites pass on the exact candidate | **PARTIAL** | Build and the suites listed in Current Verification passed here (see the table). The interactive suite did not run on this machine; no hosted CI run has executed on the candidate. |
| Unsupported commands cannot return verified-success claims | **Met for the commands that were unsupported** | `fix --ci`, `ui test`, `plugin update`, `plugin validate` are now real; the stricter `UI_TEST_ERROR`/`FIX_CI_ERROR` failure paths remain. Gates (`doctor`, `analyze --fail-on`, `security audit verify`, `service validate`) exit non-zero on failure. `cloud deploy` never fakes a deployment. This is not an exhaustive audit of the 585 command paths: many generator commands write starter files and say nothing about running. |
| Required generated-project install/build/boot checks pass; skips and external prerequisites stay explicit | **Met locally; pending first CI run** | 170 of 208 templates build with their own toolchain here (172 in CI) and eight Node/Bun backends boot (Next Batch item 1); the 36 others are listed with the registry or toolchain each lacks, never reported as passing. The hosted `template-health` run is pending. |
| Dashboard browser checks and clean-package smoke pass before a release is declared ready; a passing build or CI run alone is insufficient | **PARTIAL** | Browser checks passed locally and clean-package smoke passed in this pass; the CI jobs (`e2e`, `accessibility`, `storybook`, `pack-smoke`) are **pending first CI run**. |
| Reviewed commits, version changes and release notes describe the work only; publication, deployment and optional scaffold promotion are separate actions | **Met, nothing published** | Versions bumped (cli 0.31.0, contracts 0.3.0, mcp 0.2.0, ui 0.6.0); the CHANGELOG has an `Unreleased` section; nothing was published or deployed. |

## What remains, and why it is external

Everything left needs something outside the repository or its development environment.

| Item | Needs |
|------|-------|
| VS Code extension host test | Network access to `update.code.visualstudio.com` (runs in the `vscode-extension` workflow) |
| Signed and notarized desktop builds | Apple and Windows signing secrets in the repository (the `desktop` workflow builds unsigned without them) |
| Live Flux and Argo CD sync | Registry egress; Flux runs in the `k8s-live` workflow, Argo CD is schema-validated only |
| `cloud deploy` against a real account | Cloud credentials |
| Live LLM calls (`ai`, `ui generate`, `fix --ci`) | An API key or a local OpenAI-compatible server (`tests/live` skips without one) |
| Public hosting of the control plane | A deployment target, TLS termination and an external security review; see [`control-plane.md`](./control-plane.md) |
| WebRTC across symmetric NATs | A TURN server (none is shipped or deployed) |
| First hosted CI run of the new workflows | A push to GitHub |
| Building `vapor` and `phoenix` locally, and the 36 environment-limited templates | Their package registries (hex, Clojars, nimble, shards, opam, deno.land, GitHub sources) or toolchains (Swift, Julia, V, Gleam, Odin, Pony, Red, Grain, Mojo, Roc, Ballerina, Unison, Carbon, Vale) |

## Scope notes

The VS Code extension, desktop app, hosted control plane, provider-backed AI,
multi-cloud generation and collaboration, parked in the first stability batch, are now
implemented and are tracked in [`ROADMAP.md`](./ROADMAP.md) with what was and was not
verified. Graph-Loop and Sol Advisor remain disabled. Historical agent handoffs and
speculative plans do not authorize their restart.
