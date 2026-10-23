# Re-Shell

A single **pnpm monorepo** that pairs a full-stack scaffolding CLI with a local,
token-authed dashboard. The CLI is the engine; the dashboard, component library,
shared contracts, MCP server, control plane, VS Code extension and desktop app are
built on top of it. The npm packages are published under the `@re-shell/*` scope.

[![CI](https://img.shields.io/github/actions/workflow/status/UmutKorkmaz/re-shell/ci.yml?branch=main)](https://github.com/UmutKorkmaz/re-shell/actions/workflows/ci.yml)
[![CLI version](https://img.shields.io/npm/v/@re-shell/cli.svg?label=cli)](https://www.npmjs.com/package/@re-shell/cli)
[![License](https://img.shields.io/npm/l/@re-shell/cli.svg)](https://github.com/UmutKorkmaz/re-shell/blob/main/LICENSE)

Documentation site: <https://umutkorkmaz.github.io/re-shell/>. Repository docs:
[`docs/README.md`](./docs/README.md).

> **v0.33.0 release line.** This tree contains source versions CLI **0.33.0**,
> contracts **0.3.2**, MCP **0.3.1** and UI **0.7.0**. The previous release line
> used CLI **0.32.0**, contracts **0.3.1**, MCP **0.3.0** and UI **0.6.1**. Check
> [GitHub releases](https://github.com/UmutKorkmaz/re-shell/releases) and the
> [npm CLI registry](https://www.npmjs.com/package/@re-shell/cli) for publication status.
> Building or testing this checkout does not publish a package.
> See [`docs/DEVELOPMENT_STATUS.md`](./docs/DEVELOPMENT_STATUS.md) for current evidence.
> VS Code Marketplace publication and signed desktop distribution are deferred;
> the selected control-plane deployment scope is local Docker staging.

## Packages

| Path | Name | Source version | Role |
|------|------|---------|------|
| [`packages/cli`](./packages/cli) | `@re-shell/cli` | 0.33.0 | The CLI: 585 command paths in 46 top-level commands, 204 backend templates across 35 languages, the `re-shell ui` launcher and the bundled dashboard. |
| [`packages/contracts`](./packages/contracts) | `@re-shell/contracts` | 0.3.2 | zod schemas shared by everything: exact `--json` **wire** schemas and the adapters to the UI models, the envelope and `ErrorCode` vocabulary, hub transport, command registry, OT, graph, theme and white-label. |
| [`packages/mcp`](./packages/mcp) | `@re-shell/mcp` | 0.3.1 | Stdio MCP server: read-only tools, resources and prompts over the CLI's JSON commands. |
| [`packages/ui`](./packages/ui) | `@re-shell/ui` | 0.7.0 | shadcn-React component library (the single UI system), Storybook 10.6. |
| [`packages/control-plane`](./packages/control-plane) | `@re-shell/control-plane` | 0.2.0 (private) | Hosted multi-tenant control plane: HTTP/SSE, SQLite, workers, team policy sync, audit, collaboration. Implemented and tested in local Docker staging; **not publicly hosted**. |
| [`apps/web`](./apps/web) | `@re-shell/dashboard` | 0.1.0 (private) | The React dashboard (12 screens), the token-authed hub-server, and the Tauri desktop shell (`src-tauri`). |
| [`apps/vscode-extension`](./apps/vscode-extension) | `re-shell` | 0.3.0 (private) | VS Code extension, shipped as a `.vsix` (not on the Marketplace). |
| [`site`](./site) | `@re-shell/site` | private | Documentation site (Astro Starlight) and the hosted `workspace-v2.json` schema. |

`experimental/` contains only a README; nothing in it is built.

> There is **no Web Components surface**. shadcn-React in `packages/ui` is the one UI system.

## Quickstart

The CLI, dashboard hub, MCP server and control plane require **Node.js 22.13.0 or newer**
in this release line and the previous CLI 0.32.0 release line.

```bash
# Install workspace dependencies (pinned pnpm)
npx pnpm@9.15.9 install --frozen-lockfile

# Build every package
npx pnpm@9.15.9 -r build

# Run the CLI from the built workspace package
node packages/cli/dist/index.js --help

# ...or install the CLI selected by npm's published latest tag
npm install -g @re-shell/cli@latest
re-shell --help

# Launch the local dashboard (React app + token-authed hub on 127.0.0.1)
re-shell ui
```

`re-shell ui` builds a per-launch session token, starts the hub-server bound to
`127.0.0.1`, waits for it to be healthy (it fails if it is not), and opens the
dashboard at `http://127.0.0.1:3333` by default. Use `--dry-run` (or `--json`) to print
the launch plan without starting anything.

## Workspace scripts

Run from the repo root:

```bash
npx pnpm@9.15.9 -r build       # build all packages
npx pnpm@9.15.9 -r test        # run every package's vitest suite
npx pnpm@9.15.9 -r typecheck   # typecheck all packages
npx pnpm@9.15.9 lint           # lint workspace source
npx pnpm@9.15.9 --filter @re-shell/site build   # build the docs site
```

Helper scripts in [`scripts/`](./scripts) (run from the root after `pnpm -r build`):

| Script | What it does |
|--------|--------------|
| `node packages/cli/scripts/gen-cli-contracts.mjs [--check]` | Regenerates `docs/CLI-CONTRACTS.md` from the built CLI and the wire schemas (`--check` fails on drift; CI runs it). |
| `node scripts/pack-smoke.mjs` | Packs contracts, ui, cli and mcp, installs the tarballs in a clean directory outside the repo, and checks `--version`, `--help`, `templates list --json`, `ui --dry-run --json` and an MCP handshake. |
| `node scripts/check-doc-commands.mjs` | Checks every `re-shell ...` command written in the docs against the built CLI's catalog. |
| `node scripts/perf-budget.mjs` | Enforces gzip budgets on built assets (used by the `budget` scripts of `@re-shell/ui` and `@re-shell/dashboard`). |
| `node scripts/boot-test-templates.mjs` | Scaffolds, installs, builds, boots and probes generated Node/Bun backends. |
| `bash scripts/scaffold-test-templates.sh` | Scaffolds all 204 templates (in `--group`s) and builds each with its own language toolchain. |
| `bash scripts/k8s-live-check.sh` | Validates the Kubernetes generators against a real cluster (`KUBECONFIG`). |
| `node scripts/bench-startup.mjs` | Measures CLI startup (median and p90 per command). |

## CI

The workflows live in `.github/workflows/`. The historical workflows (`ci.yml`, `vscode-extension`,
`k8s-live`, `iac-validate`, `desktop`, `template-health`, `accessibility`) passed on GitHub
on pull request #395 (commit `3a06508`), including all 19 jobs of
`template-health` ([run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37245729171)). All 204 templates pass there; 18 of them could not
be built locally (see [`docs/STABILITY.md`](./docs/STABILITY.md)). Those runs do not
verify every later source revision; local evidence is tracked in
[`docs/DEVELOPMENT_STATUS.md`](./docs/DEVELOPMENT_STATUS.md).

| Workflow | Runs on | Gates |
|----------|---------|-------|
| `ci.yml` | push and PR to `main`/`master`/`develop` | build, performance budgets, typecheck, unit/integration/conformance suites for every package (control plane with an 80% coverage gate), generated `docs/CLI-CONTRACTS.md` drift check, coverage, interactive and end-to-end CLI tests, guard greps; **Playwright e2e** (chromium flow and the 2001-node graph scale spec); **Storybook** (stories, a11y, visual, `re-shell ui test`); **pack-smoke** (clean install of the packed tarballs) |
| `accessibility.yml` | every push and PR | axe-core WCAG 2.1 AA audit of the dashboard (Playwright `a11y` project) |
| `template-health.yml` | every push and PR | scaffold-and-build all 204 templates, one job per toolchain group (all pass on GitHub); boot-check generated Node/Bun backends |
| `vscode-extension.yml` | push/PR touching the extension, CLI, contracts or hub | build, unit and real-hub tests, the VS Code **host** test under Xvfb, `.vsix` package |
| `desktop.yml` | `desktop-v*` tags, PRs touching the desktop inputs, manual | Rust tests, Tauri bundles for Linux, macOS and Windows (signed only when signing secrets exist) |
| `k8s-live.yml` | push and PR touching the Kubernetes generators, the workspace schema or the live-check script, or manual | kubeconform, Helm lint, apply to a kind cluster, rollback, CRD, operator, Flux sync |
| `iac-validate.yml` | push and PR touching the IaC generator or its fixture workspace, or manual | `terraform fmt -check`, `init -backend=false`, `validate` for AWS, Azure and GCP output |
| `pages.yml` | push to `main` | builds and deploys the docs site, then verifies the deployed workspace schema |
| `publish.yml` | `v*` tags | publishes contracts, ui, cli and mcp to npm |

## Documentation

- [`docs/README.md`](./docs/README.md): the documentation index.
- [`docs/STABILITY.md`](./docs/STABILITY.md): release gates and the stability backlog (what is done, partial or externally blocked).
- [`docs/ROADMAP.md`](./docs/ROADMAP.md): the status of every feature, checked against the code.
- [`docs/CLI-CONTRACTS.md`](./docs/CLI-CONTRACTS.md): the **CLI** `--json` envelopes, error codes and per-command payloads (generated; it does not cover the dashboard hub transport, SSE `/events` and WS `/jobs`).
- [`docs/control-plane.md`](./docs/control-plane.md) and [`docs/desktop.md`](./docs/desktop.md): the hosted control plane (with collaboration) and the desktop app.
- Historical plans: [`docs/RE_SHELL_ULTIMATE_PLAN.md`](./docs/RE_SHELL_ULTIMATE_PLAN.md) and [`docs/RE_SHELL_MASTER_PLAN.md`](./docs/RE_SHELL_MASTER_PLAN.md) are records of how the monorepo came to be, not the current plan.

## License

The CLI is released under the Apache-2.0 License; the other packages (contracts, MCP,
UI, control plane, dashboard, VS Code extension) are MIT. See each package's metadata
and the [LICENSE](./LICENSE) file.

### v0.33.0 release-line changes

This release line adds browser SSO renewal/rotation and logout, OTLP HTTP tracing,
SQLite snapshot/restore tooling, per-job Docker mode, forced-TURN verification,
and dependency/build-tool updates. Node-safe UI root imports, Administration,
pinned-JWKS identity, browser PKCE, persistent token revocation and desktop recovery
were introduced in the earlier hardening work.

Local TURN, per-job Docker, separate API/worker tracing/restore, control-plane and
dashboard suites pass. Eight actual OpenAI-compatible network AI tests pass through
Ollama; Anthropic remains skipped. Full/production workspace audits and a clean
four-package npm consumer production audit report zero findings. The final clean
package smoke passes 13/13, and the full CLI run passes 8,518 tests with 53 skipped.
Scoped CLI coverage passes 8,104 tests with 34 skipped and meets every unchanged
80% threshold, including 84.23% branch coverage. The genuine Keycloak 26.4.0 login, proactive rotation,
latest-token revocation and logout lifecycle passes against the frozen production
dashboard. See the [CI workflow](https://github.com/UmutKorkmaz/re-shell/actions/workflows/ci.yml)
for hosted checks and the release/registry links above for publication evidence.
See [development status](./docs/DEVELOPMENT_STATUS.md) for exact evidence and limits.
Local verification and package publication are separate actions.
