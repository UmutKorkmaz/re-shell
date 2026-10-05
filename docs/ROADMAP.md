# Re-Shell Roadmap

> The single forward-looking roadmap for the **`re-shell` monorepo**. It was
> consolidated from the legacy umbrella repo's planning artifacts
> (`CLI_IMPLEMENTATION_TODO.md`, `UI_IMPLEMENTATION_TODO.md`, `CLI_FUTURE_PLANS.txt`;
> see [`legacy/`](./legacy/)) and then rewritten against the code. Every status
> below was checked against the source tree or the built CLI
> (`node packages/cli/dist/index.js ...`), and says how.
>
> Companion documents: [`STABILITY.md`](./STABILITY.md) (release gates and the
> stability backlog), [`CLI-CONTRACTS.md`](./CLI-CONTRACTS.md) (generated CLI
> envelopes), [`control-plane.md`](./control-plane.md), [`desktop.md`](./desktop.md).

## Snapshot (this commit)

| Fact | Value | Checked with |
|------|-------|--------------|
| `@re-shell/cli` | `0.31.0` (`0.30.1` is the last published version) | `packages/cli/package.json`, `node packages/cli/dist/index.js --version` |
| `@re-shell/contracts` / `@re-shell/mcp` / `@re-shell/ui` | `0.3.0` / `0.2.0` / `0.6.0` (published: `0.2.0` / `0.1.0` / `0.5.0`) | each `package.json`, `npm view <pkg> versions` |
| Not published | `@re-shell/control-plane` `0.1.0` (private), `@re-shell/dashboard` `0.1.0` (private), VS Code extension `re-shell` `0.3.0` (private, `.vsix` only) | `package.json` `private: true` |
| Registered CLI commands | **585** command paths in **46** top-level commands | `commands list --json` (`.data.length`) |
| Backend templates | **204** across **35** languages | `templates list --json` (`.data.length`, distinct `language`) |
| Dashboard screens | **11** | `apps/web/src/shell/screens.ts` |
| Startup (lazy command loading) | `--version` about 44 ms, `--help` about 102 ms median over 10 runs on the development VM; before lazy loading `--help` took about 2.6 s | `node scripts/bench-startup.mjs`; R-1b measurements below |

Nothing in this repository has been published or deployed by the work below.
"Pending first CI run" means the workflow or template exists and was linted or run in part
locally, but no hosted CI run has executed it yet. Every workflow has run and passed on
GitHub on pull request [#395](https://github.com/UmutKorkmaz/re-shell/pull/395) (commit
`3a06508`), including all 19 jobs of `template-health` ([run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37245729171)).

## Status legend

- **DONE+tested**: implemented in source and covered by automated tests that run
  in CI (or by a script that was run for real). The "Verified" column names them.
- **DONE (env-limited: ...)**: implemented and tested, except for the part named
  in the parentheses, which needs something this development environment did not
  have (a live cluster, a signing certificate, an API key, public hosting, ...).
  The unverified part is never claimed as verified.
- **PARTIAL (...)**: part of the feature exists; the parentheses say what is
  missing.
- **PLANNED**: a real, scoped intention with no implementation yet.
- **DROPPED**: removed from scope on purpose (section 5).

Test counts are deliberately not quoted here; run the suites for current numbers
(`STABILITY.md` lists the commands and what was run for this document).

---

## 1. CLI platform

### Foundation and core infrastructure

| Feature | Status | Verified |
|---------|--------|----------|
| Global config (`~/.re-shell/config.yaml`), presets, env overrides, migration (`config ...`) | DONE+tested | `tests/unit/config.test.ts`, `unified-config.test.ts`, `groups-config-tools-k8s-data.test.ts` |
| Project config with inheritance, templates, diff/merge, backup/restore (`config project\|template\|diff\|backup\|restore\|unified ...`) | DONE+tested | `tests/unit/project-config.test.ts`, `workspace-config.test.ts`, `config-diff.test.ts`, `config-backup.test.ts` |
| Declarative `re-shell.workspaces.yaml` (schema v2), dependency graph engine, cycle detection, topology health | DONE+tested | `dependency-graph-engine.test.ts`, `workspace-schema.test.ts`, `workspace-graph.test.ts` |
| Workspace state, backup, conflict detection, change detection, impact analysis, incremental builds (`workspace state\|backup\|conflict\|changes\|impact\|ibuild ...`) | DONE+tested | `change-impact-analyzer.test.ts`, `incremental-build*.test.ts` |
| Plugin architecture: discovery, lifecycle, hooks, dependency resolution, command extension | DONE+tested | `plugin-*.test.ts` (see P9-F) |
| **Startup**: lazy command-group loading (`src/command-manifest.ts`, `src/lazy-commands.ts`) | DONE+tested | Deterministic guard `tests/integration/startup-time.test.ts` (asserts which group modules load) and `tests/unit/command-manifest.test.ts`. **Measured, not a promise**: R-1b, under load, `--help` median 228 ms after vs 2620 ms before (eager loading, same harness: 1809 ms). Re-measured at this commit on an idle VM, 10 runs: `--version` 44 ms, `--help` 102 ms, `templates list --json` 306 ms, `workspace --help` 428 ms. The earlier "under 100 ms, about 43 ms" claim was true only for `--version`; `--help` and group commands are slower and depend on the machine. |
| **Resource governor**: `run --max-memory <mb> --rate-limit <n>`, `workspace ibuild build --max-memory --rate-limit`; token bucket, priority queue with aging, memory monitor, async pool | DONE+tested | `tests/unit/resources.test.ts`, `resource-lifecycle.test.ts`, `async-pool.test.ts`; `tests/integration/run-resources-cli.test.ts` |
| Group command architecture (`config`, `tools`, `workspace`, `templates`, `service`, `k8s`, ...) | DONE+tested | `commands list --json` shows 46 top-level commands |
| `doctor` (a gate: `ok:true` with `healthy`/`summary`, exit 1 when unhealthy), `analyze`, `completion` (generated from the live tree: `completion --print`) | DONE+tested | `tests/contract-conformance.test.ts`, `integration/json-hygiene-cli.test.ts`, `unit/completion*.test.ts` |
| Single-envelope `--json` contract: `COMMAND_ERROR` / `USAGE_ERROR`, incidental output on stderr, `--version` prints only the version, EPIPE handled | DONE+tested | `tests/integration/json-hygiene-cli.test.ts`, `tests/unit/json-mode-isolation.test.ts` |
| Compliance audit trail: every state-changing command is appended to `.re-shell/audit/audit.jsonl` (hash-chained; secrets redacted; opt out with `RE_SHELL_AUDIT=0` or `audit.enabled: false`); `security audit verify` checks the chain and exits 1 on tampering | DONE+tested | `audit-log-chain.test.ts`, `audit-classify.test.ts` (walks the real command catalog), `integration/audit-cli.test.ts` |
| `security compliance report --framework soc2\|iso27001`: maps audit evidence, policy-check results and config to controls and states which controls have no evidence (`--strict` exits non-zero) | DONE+tested | `audit-compliance.test.ts`. The mapping is a self-assessment aid, not an audit or a certification. |

### Universal microservices and backend templates

| Feature | Status | Verified |
|---------|--------|----------|
| Backend template registry: **204 templates, 35 languages** (Node, Python, Rust, Java, .NET, PHP, Go, Ruby, C++, Swift, Kotlin, Scala, Elixir, Zig, Nim, ...) | DONE+tested (registry shape, placeholder substitution, scaffold) | `templates list --json`; `unit/backend-template-registry.test.ts`, `template-engine.test.ts` |
| Every placeholder is substituted, including in file paths | DONE+tested | `54af757 fix(cli): substitute every template placeholder, in file paths too` and its tests |
| Emerging-runtime parity: at least 3 templates each for Deno, Bun, Kotlin, Scala, Crystal, Zig, Elixir, Nim | DONE+tested | `backend-template-registry.test.ts` `PARITY_GROUPS` (3 to 4 each); `bun-serve`, `trpc-bun`, `std-http-zig` were added for parity |
| Generated projects install, build and boot | DONE: **all 204 templates pass on hosted CI** ([run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37245729171), commit `3a06508`); 4 infeasible templates were removed (see STABILITY.md) | `scripts/scaffold-test-templates.sh` lists 204 templates in eighteen toolchain groups and builds each with its own toolchain; the `template-health` workflow runs every group plus `scripts/boot-test-templates.mjs` (8 Node/Bun templates booted, `/health` and clean SIGTERM) on every push. 172 passed at commit `3207b9f` and all 204 pass at `3a06508`. Of the 32 newly wired, 14 were built locally with their real toolchain (`kemal`, `lucky-cr`, `amber-cr`, `vweb`, `vex-v`, `odin-http`, `jennet-pony`, `mojo`, `mojo-fastapi`, `aleph-deno`, `crow`, `jester`, `prologue-nim`, `happyx-nim`) and 18 could not be built locally (`hummingbird`, `kitura`, `genie-jl`, `oxygen-jl`, `dream-ocaml`, `opium-ocaml`, `compojure`, `luminus-clj`, `reitit-clj`, `pedestal-clj`, `plug-ex`, `nerves-ex`, `wisp`, `zap-zig`, `red-http`, `grain`, `ballerina`, `unison`); the hosted runs of the 32 found and fixed `ballerina`, `unison`, `red-http`, `kitura` and `nerves-ex` defects and pinned `zap-zig`'s dependency hash, and all 32 now pass. The 4 infeasible templates were removed: `perfect` (PerfectNet does not compile against OpenSSL 3), `roc` (no stable release; its platform needs an unverifiable content-hash pin), `carbon` (no released version, no networking) and `vale` (archived, last compiler a 2022 alpha, no networking). The nim group runs Nim 2.0.x because `happyx` does not resolve with Nim 2.2.12 and nimble 0.24.1. Laravel is now Laravel 13 and its health check runs `artisan route:list` and its PHPUnit suite. |
| Docker / compose generation, API contract management (OpenAPI/GraphQL), database templates | DONE+tested | `generate`, `api ...` group tests |
| `create` is non-interactive for every mode (`--gateway --services --remotes --force --template blank`), a bare `create` is a react-ts frontend, unknown templates fail with `TEMPLATE_NOT_FOUND`, `--type` accepts only `app\|package\|lib\|tool`, `services/*` globs and a `service` workspace type | DONE+tested | `tests/integration/create-headless-*.test.ts`, `unit/create-noninteractive.test.ts` |

### Workspace graph intelligence

| Feature | Status | Verified |
|---------|--------|----------|
| `workspace graph --json`, `workspace health --json`, `workspace summary --json` | DONE+tested | wire schemas + `contract-conformance.test.ts` |
| `config profile ...` (create, activate, show, diff, sync, export/import, history, analytics, ...). The names are **`config profile <verb>`**; there are no top-level `profile-*` commands | DONE+tested | `profile-*.test.ts`; `commands list --json` |
| Profile insights and optimization computed from **recorded activation history** (`config profile insights\|optimize`) | DONE+tested | `profile-history-insights.test.ts`, `profile-optimize.test.ts`, `integration/profile-insights-cli.test.ts` |
| `dev --profile <name>` (inheritance and overrides resolved; unknown profiles are an explicit error) | DONE+tested | `dev-profile.test.ts`, `integration/dev-profile-cli.test.ts` |
| Graph explorer, terminal and browser (see P9-L) | DONE+tested | see P9-L |

### AI-assisted development

| Feature | Status | Verified |
|---------|--------|----------|
| Provider-abstracted command resolver `ai <prompt>` (see P9-A) | DONE (env-limited: no live LLM call was made; no API key) | see P9-A |
| `analyze --type bundle\|dependencies\|performance\|security\|scalability\|architecture\|all` and `--fail-on critical\|high\|medium\|low\|info`: real analysis of the workspace graph and manifests; `--fail-on` exits non-zero at or above the severity | DONE+tested | `unit/analyze-engine.test.ts`, `analyze-real-data.test.ts`, `integration/analyze-cli.test.ts`; `analyze --help` |
| `fix --ci`: gate evaluator, validated LLM patches, rollback, PR flow (report-only without `ANTHROPIC_API_KEY`; dry-run unless `--no-dry-run`) | DONE (env-limited: no live LLM call, no push or PR opened here) | `tests/integration/fix-ci-cli.test.ts`, `contracts/src/fix-ci.test.ts`; `fix --help` |

### Polyglot integration

| Feature | Status | Verified |
|---------|--------|----------|
| `pkg add\|remove\|install\|list\|outdated`: one command across npm/pnpm/yarn, pip/poetry, cargo, maven, dotnet, composer, bundler, go (`--service`, `--path`, `--ecosystem`, `--dry-run`, `--json`) | DONE+tested (native tools are invoked; only the ones installed locally can run) | `unit/pkg-*.test.ts`, `integration/pkg-cli.test.ts` |
| `debug config`: VS Code `launch.json` (node, python, go, rust, java, php, ruby, dotnet) with a compound configuration plus a docker-compose debug override | DONE+tested (generates configuration; attaching a debugger was not exercised) | `unit/debug-config.test.ts`, `integration/debug-refactor-cli.test.ts` |
| `refactor rename-service <old> <new>`: workspace config, compose files, k8s/helm manifests, package manifests, references in other services and the directory; `--dry-run` prints a unified diff; refuses a dirty git tree without `--force` | DONE+tested | `unit/refactor-rename.test.ts`, `refactor-rollback.test.ts` |
| Cross-language service bridge | DONE+tested (see P9-B) | see P9-B |

### Enterprise platform

| Feature | Status | Verified |
|---------|--------|----------|
| Kubernetes, Helm, GitOps generation, rollback, CRD, operator, mesh | DONE (env-limited: Flux/Argo CD sync only in CI) | see P9-D |
| `cloud iac generate --provider aws\|azure\|gcp` (Terraform: ECS Fargate, Azure Container Apps, Cloud Run) and `cloud iac validate <dir>` (`terraform fmt -check`, `init -backend=false`, `validate`; fails unless they really ran) | DONE+tested (terraform validation runs in CI; the `iac-validate` workflow passes on PR #395) | `unit/iac-generate.test.ts`, `integration/iac-cli.test.ts` |
| `cloud deploy`: checks credentials first, `init`+`plan` by default, `apply` only with `--yes` | DONE (env-limited: needs real cloud credentials; never run against a real account here, never faked) | `unit/iac-deploy.test.ts` |
| Legacy `cloud aws\|azure\|gcp\|hybrid\|multi\|...` generators and `cloud iac scaffold <name>` (standalone Terraform/Pulumi tooling) | DONE (generators; they write files and call no cloud API) | `groups-ai-cloud-learn.test.ts` |
| Compliance reporting (audit trail, `security compliance report`) | DONE+tested | see section 1, foundation |
| Real-time collaboration | DONE (env-limited: no TURN server) | see P9-N |

---

## 2. UI / dashboard

| Feature | Status | Verified |
|---------|--------|----------|
| Single shadcn-React component system in `packages/ui` (Web Components layer retired) | DONE+tested | CI guard `no custom elements in apps/web/src` |
| `@re-shell/contracts` exact wire schemas + adapters shared by CLI, hub, MCP and UI | DONE+tested | `packages/contracts` tests; `tests/contract-conformance.test.ts`; `docs/CLI-CONTRACTS.md` is generated and checked (`gen-cli-contracts.mjs --check`) |
| Dashboard (`apps/web`, 11 screens) over the token-authed hub (SSE `/events`, WS `/jobs`, 127.0.0.1) | DONE+tested | `apps/web` unit and hub tests; Playwright `chromium` project |
| `re-shell ui` launcher fails if the hub is not healthy; the hub URL is pinned to 127.0.0.1 | DONE+tested | `unit/ui-launch.test.ts`, `integration/ui-lifecycle-cli.test.ts` |
| **Accessibility, WCAG 2.1 AA**: skip link, focus management, live regions, OKLCH contrast verified from the real tokens in both themes, `prefers-reduced-motion` | DONE+tested | `packages/ui` `a11y.test.tsx` and `tokens.test.ts` (vitest-axe); `apps/web/e2e/accessibility.spec.ts` (axe, the `a11y` Playwright project and `accessibility.yml`). Passed locally when merged (83 specs); the `accessibility` workflow and the `ci.yml` `e2e` job pass on PR #395. axe finds a subset of WCAG problems; this is not a manual audit. |
| **Code splitting with enforced gzip budgets** | DONE+tested | `scripts/perf-budget.mjs` with `apps/web/perf-budgets.json` and `packages/ui/perf-budgets.json`; CI runs `pnpm --filter @re-shell/ui run budget` and `pnpm --filter @re-shell/dashboard run budget` |
| **Storybook 9** with play-function stories and a real `ui test` runner (interaction + a11y + visual, both themes, `--gate a11y,visual`; an empty run or missing Storybook is `UI_TEST_ERROR`, never a pass) | DONE+tested (the `storybook` CI job passes on PR #395, with baselines rendered in CI's Chromium) | `unit/ui-test*.test.ts`, `integration/ui-test-*.test.ts`; CI job `storybook` |
| `ui component new`, `ui generate` (AI provider if configured, offline template generator otherwise; output is typechecked), `ui theme install\|list\|search\|remove` (npm keyword `reshell-theme`) | DONE+tested | `unit/ui-component.test.ts`, `ui-generate.test.ts`, `ui-theme.test.ts`, `integration/ui-generate-typecheck.test.ts`. Theme search against the live npm registry was not exercised. |
| White-label: `re-shell.whitelabel.json` (or `.re-shell/whitelabel.json`, or `RE_SHELL_WHITE_LABEL_FILE`) and `RE_SHELL_BRAND_NAME/_TAGLINE/_LOGO/_FAVICON/_ACCENT`, applied at build time and at `re-shell ui` serve time | DONE+tested | `unit/ui-brand.test.ts`, `contracts/src/brand-html.test.ts`, `ui-theme.test.ts`; Playwright white-label spec |
| Polymorphic `Box`/`Text`/`Stack` (`as` prop, element-accurate props and refs), branded `Px`/`Rem`/`Percent` units, discriminated variant props | DONE+tested (this was previously listed as shipped while the types were not polymorphic; it is true now) | `packages/ui/src/types/*.test-d.tsx` (`expectTypeOf` + `@ts-expect-error`) |
| Design-system leftovers (tokens, elevation, motion, hex fallback) and the design checklist | DONE+tested for the mechanically checkable items | `docs/design/dashboard-design.md` section 6 shows which items are ticked and why |
| Tauri desktop app | DONE (env-limited: unsigned; macOS/Windows built only in CI) | see P9-K |

---

## 3. Phase 9 status (P9-A to P9-N)

Each row says what exists, what proved it, and what could not be verified.

| ID | Feature | Status | Verified HOW |
|----|---------|--------|--------------|
| **P9-A** | **AI command interface.** `re-shell ai <prompt...>` with providers Anthropic (default model `claude-opus-5-5`), OpenAI-compatible (any `/v1` server, e.g. a local model) and an offline parser used as the fallback (`--no-fallback` to fail instead). `ai config show\|get\|set\|unset` (persisted under `ai:` in `~/.re-shell/config.yaml`; `apiKey` is never printed), `ai session list\|show\|clear` and `--session/--continue` (`.re-shell/ai/sessions`, git-ignored), `ai cache stats\|clear` and `--no-cache` (semantic cache), `ai suggest`, `ai create` (dry-run scaffold plan). Flags `--provider --offline --no-cache --no-fallback --run --explain --json`. Programmatic API: `@re-shell/cli/ai`. Nothing is ever auto-run; resolved argv is vetted against the command catalog and spawned without a shell. | DONE (env-limited: no live LLM call; the Anthropic and OpenAI-compatible providers were tested against local fake servers, never against a real API key) | `unit/ai-*.test.ts`, `groups-ai-cloud-learn.test.ts`, `integration/ai-cli.test.ts`, `ai-create-cli.test.ts`, `tests/live` (skipped without a key) |
| **P9-B** | **Cross-language service bridge.** `service link\|unlink\|validate` (spec-driven: derive the contract from the provider's own OpenAPI/.proto/GraphQL SDL, generate typed TS, Python and Go clients, record the dependency); `service bridge generate` (`--grpc\|--rest\|--graphql`, `--verify`), `bridge gateway` (Apollo Federation 2 composition run for real, or schema stitching), `bridge async` (Kafka and Redis Streams producers/consumers for TS and Python, correlation IDs, `traceparent`, upcasters, circuit breaker, retry, dead letters), `bridge transform` (JSON, Protobuf, Avro, MessagePack with schema evolution), `bridge diff` (breaking/dangerous/non-breaking, exits 1 on breaking), `bridge mock` (REST, GraphQL, gRPC from specs) | DONE+tested (the Redis and Kafka round trips need Docker; see Verified) | `unit/bridge-*.test.ts`, `integration/bridge-cli.test.ts`, `bridge-async-redis.test.ts` (real `redis:7` container, round trip across TS and Python) and `bridge-async-kafka.test.ts` (real `apache/kafka` container); both start containers and **skip when Docker is unavailable**, and both passed locally in the P9-B workstream, `bridge-e2e-clients.test.ts` (generated clients against the mock server, including Go gRPC). The async transport and cross-language mocks are no longer scaffolds. |
| **P9-C** | **workspace.yaml v2 and JSON Schema.** The schema is built from `packages/cli/src/schemas/workspace-v2.schema.json` and served by the docs site at `https://umutkorkmaz.github.io/re-shell/schemas/workspace-v2.json` (`site/src/pages/schemas/workspace-v2.json.ts`; `$id` and every `$schema` modeline use `src/constants/brand.ts`). Every workspace writer emits a valid v2 file. `config schema generate\|publish\|validate`; IDE configs for VS Code, IntelliJ, Vim, Emacs | DONE+tested (live URL not reachable from this environment; the Pages workflow verifies the deployed file after each deploy) | `unit/schema-generator.test.ts`, `workspace-writers-schema.test.ts`, `brand-urls.test.ts` (endpoint output equals the canonical schema), `integration/workspace-writers-cli.test.ts`, `schema-validate.test.ts`, `pages.yml` post-deploy check |
| **P9-D** | **Kubernetes, Helm, GitOps.** Hardened manifests (defaults: `runAsNonRoot`, read-only root filesystem, all capabilities dropped, `RuntimeDefault` seccomp, plus a PodDisruptionBudget; probes and resources come from the workspace config), `k8s generate`, `k8s helm generate`, `k8s gitops generate --tool argocd\|flux` (Flux defaults to a **HelmRelease** with `--source helm`), `k8s rollback <service>` (kubectl or Helm), workspace-driven `k8s crd\|operator\|mesh` (the old script generators are behind `--legacy`) | DONE (env-limited: Flux/Argo CD sync only in CI) | `unit/k8s-*.test.ts`, `helm-generate.test.ts`, `gitops-generate.test.ts`, `integration/k8s-cli.test.ts`. `scripts/k8s-live-check.sh` against a local k3s cluster: steps 1-8 (generate, helm lint/template, kubeconform, apply under Pod Security `restricted`, rollback, Helm release rollback, CRD, Go operator) ran locally during development. Step 9 (Flux sync of the HelmRelease) needs registry egress this environment blocks; it runs in the `k8s-live` workflow (kind), which passes on PR #395. Argo CD is not installed there: its Application manifest is validated with kubeconform only. |
| **P9-E** | **Nx / Turbo importer.** **`workspace migrate-monorepo --from nx\|turbo`** reads `nx.json` + `project.json` or `turbo.json` + workspace globs and writes `re-shell.workspaces.yaml` v2. (`workspace migrate` is a different command: it migrates a re-shell workspace config between schema versions, default target `2.0.0`.) | DONE+tested | `unit/migrate-monorepo.test.ts`, `integration/migrate-monorepo.test.ts` (fixture Nx and Turbo workspaces) |
| **P9-F** | **Plugin marketplace.** Real `plugin install` (local path, git URL, npm; `--pin`, `--dry-run`), `uninstall` (files, registry entry, hooks, commands; `--purge`), `update` (`--check`, respects pins), `validate <path>` (manifest, entry, engines, dependencies, security scan, size), `pin\|unpin`, `review add\|list` (team reviews in `.re-shell/plugin-reviews.json`), `search` over the npm keyword `reshell-plugin`, ratings from npms.io with a downloads-based fallback. The workspace registry is **`.re-shell/plugins.json`**. Registry signature verification is opt-in (`--verify`) | DONE+tested (CI-mocked; live registry is env-limited) | `unit/plugin-installer*.test.ts`, `plugin-uninstaller.test.ts`, `plugin-updater.test.ts`, `plugin-validator.test.ts`, `plugin-ratings.test.ts`, `plugin-reviews.test.ts`, `plugin-store.test.ts`, `integration/plugin-lifecycle-cli.test.ts` (against a fake npm registry with real tarballs). No claim is made about installs from the live npm registry. |
| **P9-G** | **Policy packs and drift.** `workspace policy check\|search\|install\|list\|remove` (built-in packs `recommended` and `baseline`; installable packs under `.re-shell/policy-packs`, npm keyword `reshell-policy-pack`). **Rule types: `required-files`, `required-scripts`, `dependency-constraints`, `naming`, `min-node`, `license`.** `workspace drift` reports version mismatches across workspaces | DONE+tested | `unit/policy-engine.test.ts`, `policy-pack-commands.test.ts`, `policy-pack-marketplace.test.ts`, `workspace-policy.test.ts` |
| **P9-H** | **Template matrix and dry-run diffs.** `templates matrix` (204-row compatibility grid), `templates apply <id>` (dry-run file preview), `create --dry-run` (with `--json`: the exact file set with per-file previews and diffs; never prompts) | DONE+tested | `unit/template-matrix.test.ts`, `template-dry-run.test.ts`, `integration/template-matrix-dryrun.test.ts`, `create-headless-json-dryrun.test.ts` |
| **P9-I** | **VS Code extension** (`apps/vscode-extension`, package `re-shell` `0.3.0`): Projects, Commands and Templates views, **Build Command**, **Run via Hub**, status bar health; packaged as a `.vsix` (`pnpm --filter re-shell run package`) | DONE (env-limited: the VS Code **host** test was not run here, `update.code.visualstudio.com` is blocked; it runs in the `vscode-extension` workflow, which passes on PR #395, including the real VS Code host tests) | Unit and real-hub integration suites (built CLI + built hub, no editor); `scripts/verify-vsix.mjs` on the packaged `.vsix`. Not published to the Marketplace. |
| **P9-J** | **Hosted control plane** (`packages/control-plane`): HTTP/SSE server, signed JWTs with key rotation, SQLite store, tenant isolation, remote workers that run the allow-listed CLI, team policy sync, append-only audit, Dockerfile and Compose | DONE+tested, **not deployed** (single node; no OIDC; no public hosting; no external security review) | `packages/control-plane` suites including end-to-end runs with the built CLI; Docker images built and `/healthz` checked locally once. Details and limits: [`control-plane.md`](./control-plane.md). |
| **P9-K** | **Desktop (Tauri).** The app owns its hub (free 127.0.0.1 port, per-launch token, stdin-close orphan protection); Linux `.deb`, `.rpm` and `.AppImage` built and smoke-tested under Xvfb here | DONE (env-limited: unsigned; signed builds only via CI secrets and never verified with real certificates; macOS and Windows bundles built only in the `desktop` workflow, which passes on PR #395) | `cargo test --locked` and `scripts/smoke-linux.sh`; see [`desktop.md`](./desktop.md) for exactly what was run |
| **P9-L** | **Workspace graph explorer.** Search, filters (URL state), shortest dependency paths, cycle highlighting, six exports (PNG, SVG, PDF, Mermaid, D3 JSON, JSON), graph diff, live status, 2000+ nodes with virtualization. CLI: `workspace graph diff --base --head`, `workspace status` (running/stopped/unhealthy/unknown with the reason; remote probes need `--allow-remote-probes`), `workspace explore` (terminal explorer, TTY only), `workspace graph --interactive` | DONE+tested | `unit/workspace-status.test.ts`, `workspace-graph-command.test.ts`, `graph-explorer-*.test.*`, `integration/workspace-graph-cli.test.ts`; `contracts/src/graph*.test.ts`; Playwright `e2e/graph-scale.spec.ts` (generated 2001-workspace repo, real hub and CLI: render, search, filter, paths, diff and export budgets). The scale spec passed locally when merged and runs in CI (`playwright.graph.config.ts`) and passes on PR #395. |
| **P9-M** | **Multi-environment profiles.** `dev --profile <name>`, `config profile ...` (see section 1) | DONE+tested | `dev-profile*.test.ts`, `integration/dev-profile-cli.test.ts` |
| **P9-N** | **Real-time collaboration.** Shared sessions on the control plane: shared console (`collab session start\|join\|list\|run\|handover\|cancel\|end`), operational-transform shared editing, WebRTC data channels with a server relay fallback, team analytics, audit; dashboard **Collaboration** screen | DONE (env-limited: no TURN server is shipped or deployed; WebRTC links are host-candidate only unless `CONTROL_PLANE_ICE_SERVERS` is set; control plane not deployed) | `contracts/src/ot.test.ts`, control-plane `collab` suites and `e2e/collab.e2e.test.ts` (real worker + built CLI), `cli/tests/integration/collab-session-cli.test.ts`, Playwright `apps/web/e2e/collab.spec.ts` (two browser contexts, real data channel and relay fallback). The older `collab webrtc-sharing\|operational-transform\|...` commands are code generators that talk to no server. See [`control-plane.md`](./control-plane.md) section 14. |

### Phase 9 summary

| Status | Items |
|--------|-------|
| DONE+tested | P9-B (broker round trips need Docker), P9-C, P9-E, P9-F, P9-G, P9-H, P9-L, P9-M |
| DONE (env-limited) | P9-A (no live LLM), P9-D (Flux/Argo sync in CI), P9-I (VS Code host test in CI), P9-K (unsigned), P9-N (no TURN) |
| DONE+tested, not deployed | P9-J |

---

## 4. Other items verified in this wave

| Item | Status | Verified |
|------|--------|----------|
| `service run up\|down\|health\|logs\|...`: hardened supervision (`SERVICES_*` error codes, `--alive-ms`, JSON pid files, `re-shell.services.<script>` metadata in `package.json`; `health` exits non-zero when nothing is running or any service is down) | DONE+tested | `unit/service-process.test.ts`, `services-runtime.test.ts`, `integration/service-run-cli.test.ts` |
| `@re-shell/mcp`: bin fixed (realpath), `@re-shell/cli` dependency declared, `RE_SHELL_BIN` no longer required, server reports its package version | DONE+tested | `packages/mcp/tests/stdio.test.ts`, `package.test.ts`; `scripts/pack-smoke.mjs` runs an MCP handshake against the packed tarballs |
| Clean-install smoke: pack contracts, cli, mcp; install the tarballs outside the repo; check `--version`, `--help`, `templates list --json`, `ui --dry-run --json` and an MCP handshake | DONE+tested | `node scripts/pack-smoke.mjs`; CI job `pack-smoke` (passes on PR #395) |
| Dashboard bundled into the CLI tarball by `prepack` | DONE+tested | `pack-smoke.mjs` |
| Performance budgets | DONE+tested | section 2 |

---

## 5. Explicitly DROPPED (out of scope)

Recorded so the decision stays explicit and is not silently re-introduced:

- **Quantum computing integration.** DROPPED.
- **Blockchain / Web3** (smart-contract templates, dApp workflows, cross-chain). DROPPED.
- **VR/AR / immersive development environments.** DROPPED.
- **Neural / voice-command coding** as a core pillar. DROPPED (the optional, provider-abstracted `ai` layer remains, P9-A).

Rationale: speculative and mission-divergent. The value proposition is a polyglot
workspace plus microfrontend toolkit with a typed CLI-to-UI contract.

## 6. Remaining items (external or credential-bound only)

Everything left depends on something outside this repository's development
environment. None of it is claimed as done.

| Item | Needs |
|------|-------|
| VS Code extension host test (`@vscode/test-electron`) | Network access to `update.code.visualstudio.com` (runs in CI) |
| Signed and notarized desktop builds | Apple and Windows signing secrets in the repository (workflow is secret-driven and builds unsigned without them) |
| Flux and Argo CD sync against a live cluster | Registry egress (Flux runs in the `k8s-live` workflow); Argo CD is validated by schema only |
| `cloud deploy` against a real account | Cloud credentials |
| Live LLM calls (`ai`, `ui generate`, `fix --ci`) | An API key or a local OpenAI-compatible server |
| Redis and Kafka round-trip tests | Docker (they start containers and skip without it) |
| Public hosting of the control plane | A deployment target, TLS and a security review |
| WebRTC across symmetric NATs | A TURN server |
| Hosted runs on `main` of `ci.yml`, `vscode-extension`, `k8s-live`, `iac-validate`, `desktop` (all pass on PR #395 at `3207b9f`) | A merge |
| Catalog-wide template verification counts | Done in `STABILITY.md`: all 204 passing on hosted CI, the 4 infeasible templates removed |

## 7. Packages

| Package | Location | Name | Version | Role |
|---------|----------|------|---------|------|
| cli | `packages/cli` | `@re-shell/cli` | 0.31.0 | The published CLI, templates, hub launcher, bundled dashboard |
| contracts | `packages/contracts` | `@re-shell/contracts` | 0.3.0 | zod schemas: wire layer, adapters, domain models, hub transport, command registry, OT, graph, theme/white-label |
| mcp | `packages/mcp` | `@re-shell/mcp` | 0.2.0 | Stdio MCP server (read-only tools, resources, prompts) |
| ui | `packages/ui` | `@re-shell/ui` | 0.6.0 | shadcn-React component library, Storybook 9 |
| control-plane | `packages/control-plane` | `@re-shell/control-plane` | 0.1.0 (private) | Multi-tenant HTTP/SSE control plane, workers, collaboration |
| web | `apps/web` | `@re-shell/dashboard` | 0.1.0 (private) | Dashboard (11 screens), hub-server, Tauri shell (`src-tauri`) |
| vscode-extension | `apps/vscode-extension` | `re-shell` | 0.3.0 (private) | VS Code extension |
| site | `site` | `@re-shell/site` | 0.0.0 (private) | Documentation site (Astro Starlight) and the hosted workspace schema |

`experimental/` holds only a README. The control plane graduated out of it into
`packages/control-plane`; nothing else lives there and nothing in it is built.

## 8. Corrections to earlier statements

The previous version of this file overstated or misstated the following. They are
corrected above; this list exists so the corrections are visible.

| Earlier claim | Reality |
|---------------|---------|
| "Startup under 100 ms; about 43 ms achieved" | About 44 ms is `--version` only. `--help` is about 100 ms (idle VM) to 230 ms (under load) after lazy loading, and was about 2.6 s before. Group commands take several hundred ms. |
| "543 commands at CLI 0.29.0", "CLI is at 0.29.0" | 585 command paths at 0.31.0 (`commands list --json`). |
| "About 219 templates" | 204 backend templates (`templates list --json`). |
| Profiles are `profile`, `profile-env`, `profile-sync`, `profile-version` | They are `config profile <verb>` (`config profile env ...`, `config profile sync`, ...). |
| Policy rules `required-scripts`, `no-dependency-drift`, `no-circular-deps`, `license-conformance` | The rule types are `required-files`, `required-scripts`, `dependency-constraints`, `naming`, `min-node`, `license`. Drift is a separate command (`workspace drift`). |
| "`workspace migrate` / `workspace migrate-monorepo` reads Nx and Turbo" | Only `workspace migrate-monorepo` does. `workspace migrate` migrates a re-shell workspace config between schema versions. |
| Plugin registry at `.re-shell/plugins/registry.json` | `.re-shell/plugins.json`. |
| Schema `$id` at `schemas.umutkorkmaz.dev` | The hosted URL is `https://umutkorkmaz.github.io/re-shell/schemas/workspace-v2.json`. |
| Polymorphic `as` props and branded units "MVP-done" | They were not accurate then; they are implemented and type-tested now. |
| Async transport, mock servers, AI providers, k8s live validation, control plane server, desktop binary: "SCAFFOLD" | Implemented; see section 3 for what is and is not verified. |
| `@re-shell/vscode@0.1.0` | The package is named `re-shell`, version 0.3.0. |
