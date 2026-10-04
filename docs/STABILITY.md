# Stability Work

This is the stability status as of 2026-10-04, at CLI `0.31.0` (not published; `0.30.1`
is the last published version, and a published version is never reused). It
supersedes the historical implementation checklists for the stability batch, not the
product's long-term roadmap ([`ROADMAP.md`](./ROADMAP.md)). Changes on a branch are
not published-release proof.

**The release is not declared ready.** Everything in the Next Batch below is
implemented. Every workflow has **run and passed on GitHub** on pull request
[#395](https://github.com/UmutKorkmaz/re-shell/pull/395), on commit `3207b9f`:
`ci.yml` ([run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37205769225): build and
test with coverage, CLI end-to-end, smoke and guards, the Playwright `e2e` job including the
graph-scale spec, the `storybook` stories, accessibility and visual checks, and
`pack-smoke`), `vscode-extension` (including the real VS Code host tests;
[run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37205769232)), `k8s-live`
([run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37205769251)), `iac-validate`
([run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37205769213)), `desktop` (Linux,
macOS and Windows builds and the Rust tests;
[run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37205769227)), `accessibility`
([run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37205769229)) and
`template-health` ([run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37205769234):
the 172 templates that were listed at that commit, plus the boot check). Their first hosted runs
failed and the causes were fixed (see [Hosted CI](#hosted-ci)).

The template work after that commit is **not yet proven on GitHub**: 32 more templates are
wired into `template-health` (204 of the 208 backend templates are now wired; 4 are
infeasible, see [Template verification counts](#current-verification)), and those
32 have not had their first hosted run. What was and was not verified locally is stated
precisely in [Current Verification](#current-verification).

## Hosted CI

The first hosted runs found problems the development environment hid; each was
reproduced where possible, fixed, and every workflow passes on PR #395 (commit `3207b9f`).
What the first hosted runs of the workflows that only run on pull requests caught:

- `node-pty` moved to 1.1.0 (N-API, with a prebuilt binary on Windows) so the interactive
  tests and the desktop build install everywhere.
- Playwright is now declared for Storybook, and the Storybook visual baselines are rendered in
  CI's own Chromium (the Playwright 1.61.1 image) instead of the development machine's.
- The generated Python bus imported `redis` when redis-py was not installed; the generated
  imports no longer require it.
- Several end-to-end expectations were stale and were updated to the current behavior.
- Two port races: the desktop free-port test and the service restart test.

The first hosted runs of `template-health` and `accessibility` found these:

- `koa` did not exit within 10 s of SIGTERM: on hosted runners connections to the
  unreachable test database hang instead of being refused, and shutdown waited on a pending
  knex connection. Reproduced by dropping that traffic locally; every shutdown step is now
  time-bounded.
- Dark-theme graph contrast (axe): React Flow's default `light` class on the canvas matched
  the design tokens' `.light` selector; the canvas now follows the app theme.
- `foalts` and `strapi`: pnpm 9 (CI) builds native dependencies that do not compile on
  Node 22; pnpm 10 here skips those builds. Fixed (`hiredis` dropped, `better-sqlite3` 11).
- `laravel`, `slim`, `codeigniter`: newer Composer blocks dependencies with security
  advisories. Moved to Laravel 12 (Laravel 13 since; see Current Verification), php-jwt 7, graphql-php 15, dompdf 3; `composer audit` is clean.
- `vapor` (Swift) and `phoenix` (Elixir) had never been built: the Vapor manifest named
  packages that do not exist and several sources did not compile; CI did not install Elixir.
  Both build in CI now.
- `drogon`: Ubuntu's Drogon CMake config needs the MariaDB, Hiredis, yaml-cpp, Brotli and
  c-ares development packages and `drogon_ctl`; the jvm group's cleanup raced sbt's server.

Local template checks use whatever pnpm and Composer are installed, which can be more
lenient than CI's (pnpm 10 skips dependency build scripts; Composer 2.8 does not block
advisories), so the hosted run is the authoritative result.

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

**Template verification counts.** `scripts/scaffold-test-templates.sh` now lists **204 of
the 208** backend templates, in eighteen toolchain groups that `template-health` runs as
parallel jobs. They fall into three tiers; the first is the only one proven on GitHub:

1. **172 passed on hosted CI** (PR #395, commit `3207b9f`). 170 of them were also scaffolded
   with the built CLI and built with their own toolchain on the development machine; `vapor`
   (Swift) and `phoenix` (Elixir) needed a Swift toolchain and the hex registry and only
   CI built them.
2. **14 of the 32 newly wired templates were scaffolded and built with their real toolchain
   locally**, and are wired into CI, but have **not yet had a hosted run**:
   `kemal`, `lucky-cr`, `amber-cr` (Crystal and shards); `vweb`, `vex-v` (V), `odin-http`
   (Odin), `jennet-pony` (Pony); `mojo`, `mojo-fastapi` (Mojo); `aleph-deno` (Deno);
   `crow` (C++ with CMake, `libasio-dev` added to the native group); `jester`,
   `prologue-nim`, `happyx-nim` (Nim 2.0.16). That makes 184 of the 204 built locally
   (170 plus these 14).
3. **18 of the 32 are wired but ci-only**: their toolchain could not be downloaded here, so
   the first real build is the CI run on this branch. Swift `hummingbird`, `kitura`; Julia
   `genie-jl`, `oxygen-jl`; OCaml `dream-ocaml`, `opium-ocaml`; Clojure `compojure`,
   `luminus-clj`, `reitit-clj`, `pedestal-clj`; BEAM `plug-ex`, `nerves-ex`, `wisp`;
   `zap-zig`; `red-http`; `grain`, `ballerina`, `unison`. **None of these is claimed to
   pass.**

172 passing plus 32 newly wired is 204; 4 are infeasible (below). `laravel` was already in the
172; it moved to Laravel 13 and its health check now boots the app (`php artisan route:list`)
and runs its PHPUnit suite (`php artisan test`).

| Group (`--group`) | Templates | Check |
|---|---|---|
| `core` | 26 | `tsc`, `go build`, `cargo check`, `mvn package`, `zig build` (Zig 0.13.0; `zap-zig` fetches its URL dependency, which the script hashes first), Python compile and import, `php -l` + composer (Laravel also `artisan route:list` and `php artisan test`), `ruby -c` + bundle; `mix compile` and `swift build` (Vapor) in CI only |
| `jvm` | 9 | Maven, Gradle (Kotlin), sbt (Scala) |
| `dotnet` | 15 | `dotnet build` of every C# and F# project |
| `native` | 28 | Go, Rust, Python, Ruby, PHP, Perl (`perl -c`), Lua (`luac -p`, syntax only), C++ with CMake against distribution packages (`drogon`, `cpp-httplib`, `beast`, `pistache`) and `crow` (Crow v1.2.0 fetched from GitHub, `ctest`), Dart (`dart pub get` + `dart analyze`, no test run) |
| `node` | 72 | `pnpm install` + `tsc`, or `node --check` plus an import-resolution check for plain JavaScript, or `rescript build` |
| `haskell` | 4 | `cabal build all --enable-tests` + `cabal test` (GHC 9.4.7); the shipped `stack.yaml` files are not exercised |
| `deno` | 3 | `deno check` + `deno test` (Deno 2; dependencies from JSR and npm), `deno task build` for the Hono + React app `aleph-deno` |
| `swift` | 2 | `swift build --build-tests` + `swift test` (Hummingbird 2, Kitura 3). Hummingbird built and passed its tests on the first hosted run. Kitura needs patched copies of Kitura and KituraContracts under `Vendor/` (Foundation in Swift 6 made `.formatted(DateFormatter)` a static function, so upstream's `case .formatted(let x)` patterns do not compile); built and tested locally with Swift 6.4, hosted re-run pending |
| `julia` | 2 | `Pkg.instantiate`, `Pkg.precompile`, `Pkg.test`; first hosted run pending |
| `nim` | 3 | `nimble install --depsOnly`, `nimble build`, `nimble test` on **Nim 2.0.x** (pinned because `happyx` does not resolve with Nim 2.2.12 and nimble 0.24.1) |
| `crystal` | 3 | `shards install`, `shards build`, `crystal spec` (type-checked only when the Lucky and Amber specs need PostgreSQL and none is running); first hosted run pending |
| `ocaml` | 2 | `opam install --deps-only`, `dune build`, `dune runtest`; first hosted run pending |
| `clojure` | 4 | `lein deps`, `lein check`, `lein test`; first hosted run pending |
| `beam` | 3 | `mix deps.get`, `mix compile`, `mix test` for Plug and Nerves (built for the host); `gleam build` and `gleam test` for Wisp; first hosted run pending |
| `systems` | 4 | V (`v fmt -verify`, `v build`, `v test` for `vweb`, now on `veb`, and `vex-v`), Odin (`odin build`, `odin test`), Pony (`corral fetch`, `ponyc`, run the tests), each with a pinned compiler; first hosted run pending |
| `exotic` | 3 | Grain (`grain compile` + run, then the compiled test program), Ballerina (`bal build`, then `bal test` for the package tests), Unison (a `ucm` transcript: typecheck, add, run the self-test); first hosted run pending |
| `exoticb` | 3 | Mojo (`mojo build`, the Mojo test programs, boot the server), Mojo + FastAPI (build the extension module, pytest, boot the server), Red (`red -r`, run the tests, boot the server); first hosted run pending |
| `config` | 18 | YAML syntax only (configuration templates; their TypeScript snippets are not compiled) |

Eight Node and Bun backends are also booted (`scripts/boot-test-templates.mjs`, below),
and the agents that repaired templates ran many of them as servers or against their own
tests; that is not repeated by the script.

**Known first-run risks** for the templates that have not run on GitHub yet: `kitura`
(vendored, patched Kitura sources; see the `swift` row), `oxygen-jl` (a package
UUID written from memory), the Clojure group (Clojars versions and the
`DeLaGuardo/setup-clojure@13.4` tag are unverified), the BEAM group (`setup-beam` with
`gleam-version: '1'`; Nerves C ports), `red-http` (Red/System syntax; the download URL was
scraped), `grain`, `ballerina` and `unison` (release URLs written from memory), the systems
group (the `ponyup` install from Cloudsmith is untried), and `zap-zig` (CI prints the hash of
the fetched dependency; it must be pinned in the template afterwards). A red job there is an
expected outcome, not a regression of the 172.

**Four templates are infeasible** and are deliberately kept out of the script, with their
source unchanged. They are registered, scaffoldable and covered by the registry and
placeholder tests, and are not counted as built:

- `perfect` (Swift): PerfectNet calls `SSL_get_peer_certificate`, which is only a
  function-like macro in OpenSSL 3 and cannot be imported by Swift's Clang importer;
  Perfect-Net has been unmaintained since 2020.
- `roc`: there is no stable release, and the platform must be pinned by a content-hash URL
  that could not be verified.
- `carbon`: no released version (experimental nightlies only) and no networking.
- `vale`: the project is archived, the last compiler is a 2022 alpha, and there is no
  networking.

None was deleted, and none is counted as verified.

## Next Batch (status)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Repeatable install/build/boot evidence for representative generated projects, fixing the failures the stricter checks surface | **DONE for 172 templates on hosted CI ([run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37205769234)); 32 more are wired and pending their first hosted run (204 of 208 wired); 4 are infeasible (listed above)** | `scripts/scaffold-test-templates.sh` scaffolds 204 templates and builds each with its own toolchain, in eighteen groups that CI runs as parallel jobs (counts and checks above); `scripts/boot-test-templates.mjs` installs, builds, boots on a free port with no DB or Redis, probes `/health` and a route, and requires a clean SIGTERM for express, fastify, koa, hono, nestjs, elysia-bun, bun-serve and trpc-bun. Failures found were fixed while the list grew from 25 to 172 and then to 204 (hyphenated project names used as identifiers, nonexistent dependency versions and APIs, files referenced but never shipped, ESM/CommonJS mismatches, YAML errors; some, such as `angel3`, `beast`, `fresh-deno` (ported to Fresh 2), `aleph-deno` (now a Hono + React app), the ReScript, the Haskell and several of the newly wired templates, were largely rewritten). Of the 32 newly wired, 14 were built locally with their real toolchain and 18 are ci-only (see Current Verification). The `template-health` workflow runs both scripts on every push and PR. |
| 2 | Frontend-only/backend/fullstack creation and non-TTY microfrontend `--yes` behavior; skeletons distinct from runnable apps | **DONE** | `create` never prompts under `--yes`/`--json`/`--dry-run`/non-TTY for every mode; `--gateway --services --remotes --force --template blank`; `TEMPLATE_NOT_FOUND`; `--type` limited to `app\|package\|lib\|tool`; `create --dry-run --json` returns the exact files and diffs. Tests: `tests/integration/create-headless-*.test.ts`, `tests/unit/create-noninteractive.test.ts`. Skeletons are labelled: `generate backend` writes a small starter, `create` the full template, and neither claims the project runs. |
| 3 | Harden service spawn failures, immediate exits, PID/log cleanup and stopping | **DONE** | `service run`: `SERVICES_*` error codes, `--alive-ms`, JSON pid files, `re-shell.services.<script>` metadata, graceful SIGTERM then SIGKILL, `health` exits non-zero when nothing runs. `tests/unit/service-process.test.ts`, `services-runtime.test.ts`, `tests/integration/service-run-cli.test.ts`. |
| 4 | Real browser flows against the hub, as an executable release gate | **DONE; `accessibility` ([run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37205769229)) and the `ci.yml` `e2e` job (including the graph-scale spec; [run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37205769225)) pass on hosted CI (PR #395, commit `3207b9f`)** | `ci.yml` job `e2e` (Playwright `chromium` flow and the graph-scale spec) and `accessibility.yml` (axe) run on every push and PR. Both passed locally when merged (see above). |
| 5 | Verify packed CLI/dashboard/MCP artifacts from a clean install outside the monorepo | **DONE; the `pack-smoke` job passes on hosted CI ([run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37205769225), PR #395)** | `scripts/pack-smoke.mjs` (CI job `pack-smoke`): packs contracts, cli and mcp (the cli `prepack` bundles the dashboard), installs the tarballs in a temp dir outside the repo, checks `--version` equals the package version, `--help`, `templates list --json`, `ui --dry-run --json` and an MCP handshake. Ran in this pass: passes 10/10 checks (packed contracts 0.3.0, cli 0.31.0, mcp 0.2.0; `--version` printed `0.31.0`; `templates list --json` returned 208; the MCP handshake exposed 9 tools). The first run failed 9/10 because the script still read the `ui --dry-run --json` plan as a bare object while the CLI now wraps it in the standard envelope; the script was fixed to accept the envelope and the rerun passed. |
| 6 | Reconcile public claims, versions, paths and examples with actual behavior | **DONE** | Every `re-shell ...` command in the site, READMEs and `docs/` is checked against the built CLI by `scripts/check-doc-commands.mjs`; every internal site link by `scripts/check-site-links.mjs`. Versions, command and template counts are taken from the CLI and `package.json`. The unmaintained `packages/cli/EXAMPLES.md`, which described commands that do not exist, was removed and is no longer published to npm. |

## Release Gates

| Gate | Status | What remains |
|------|--------|--------------|
| Build, typecheck and focused plus relevant broad/interactive suites pass on the exact candidate | **PARTIAL** | Build and the suites listed in Current Verification passed here (see the table). The interactive suite did not run on this machine; it runs in CI. Every workflow passes on hosted CI at commit `3207b9f` (PR #395), but no hosted run has yet covered the later template-health changes (`4e2c154`, `935e675`). |
| Unsupported commands cannot return verified-success claims | **Met for the commands that were unsupported** | `fix --ci`, `ui test`, `plugin update`, `plugin validate` are now real; the stricter `UI_TEST_ERROR`/`FIX_CI_ERROR` failure paths remain. Gates (`doctor`, `analyze --fail-on`, `security audit verify`, `service validate`) exit non-zero on failure. `cloud deploy` never fakes a deployment. This is not an exhaustive audit of the 585 command paths: many generator commands write starter files and say nothing about running. |
| Required generated-project install/build/boot checks pass; skips and external prerequisites stay explicit | **Met on hosted CI for 172 templates** ([run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37205769234)); **32 more wired, first hosted run pending** | 172 of 208 templates build with their own toolchain in CI (170 of them also here) and eight Node/Bun backends boot (Next Batch item 1). 32 more are wired into `template-health` (204 of 208): 14 were built locally with their real toolchain, 18 are ci-only and are not claimed to pass until they run. The 4 infeasible templates (`perfect`, `roc`, `carbon`, `vale`) are listed with their reasons, never reported as passing. |
| Dashboard browser checks and clean-package smoke pass before a release is declared ready; a passing build or CI run alone is insufficient | **Met on hosted CI at `3207b9f`** | Browser checks passed locally, clean-package smoke passed in this pass, and on PR #395 the `accessibility` job ([run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37205769229)) and the `ci.yml` jobs `e2e`, `storybook` and `pack-smoke` ([run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37205769225)) pass. A release is still not declared ready: nothing is published. |
| Reviewed commits, version changes and release notes describe the work only; publication, deployment and optional scaffold promotion are separate actions | **Met, nothing published** | Versions bumped (cli 0.31.0, contracts 0.3.0, mcp 0.2.0, ui 0.6.0); the CHANGELOG has an `Unreleased` section; nothing was published or deployed. |

## What remains, and why it is external

Everything left needs something outside the repository or its development environment.

| Item | Needs |
|------|-------|
| VS Code extension host test, locally | Network access to `update.code.visualstudio.com` (it passes in the `vscode-extension` workflow on PR #395) |
| Signed and notarized desktop builds | Apple and Windows signing secrets in the repository (the `desktop` workflow builds unsigned without them) |
| Live Flux and Argo CD sync | Registry egress; Flux runs in the `k8s-live` workflow, Argo CD is schema-validated only |
| `cloud deploy` against a real account | Cloud credentials |
| Live LLM calls (`ai`, `ui generate`, `fix --ci`) | An API key or a local OpenAI-compatible server (`tests/live` skips without one) |
| Public hosting of the control plane | A deployment target, TLS termination and an external security review; see [`control-plane.md`](./control-plane.md) |
| WebRTC across symmetric NATs | A TURN server (none is shipped or deployed) |
| Hosted runs of `ci.yml`, `vscode-extension`, `k8s-live`, `iac-validate` and `desktop` on `main` after the merge | Done on PR #395 at `3207b9f`; these workflows are not triggered by pushes to other branches, so they re-run on the pull request and on the merge |
| First hosted run of the 32 newly wired templates (the swift, julia, nim, crystal, ocaml, clojure, beam, systems, exotic and exoticb groups, `zap-zig`, `crow`, `aleph-deno`) | A push to this branch (`template-health` runs on every push); 18 of them have never been built outside CI's toolchains |
| Building `vapor`, `phoenix` and the 18 ci-only newly wired templates locally | Their toolchains or registries (Swift, Julia, opam, Clojars, hex, Gleam, Zig dependencies from GitHub, Red, Grain, Ballerina, Unison) |
| The 4 infeasible templates (`perfect`, `roc`, `carbon`, `vale`) | A usable toolchain: OpenSSL 3 support in PerfectNet, a stable Roc release with a verifiable platform, a released Carbon, a maintained Vale; see the reasons above |

## Scope notes

The VS Code extension, desktop app, hosted control plane, provider-backed AI,
multi-cloud generation and collaboration, parked in the first stability batch, are now
implemented and are tracked in [`ROADMAP.md`](./ROADMAP.md) with what was and was not
verified. Graph-Loop and Sol Advisor remain disabled. Historical agent handoffs and
speculative plans do not authorize their restart.
