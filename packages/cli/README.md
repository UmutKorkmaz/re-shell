# Re-Shell CLI

**Full-stack development platform: microfrontends and polyglot microservices under one CLI.**

[![Version](https://img.shields.io/npm/v/@re-shell/cli.svg)](https://www.npmjs.com/package/@re-shell/cli)
[![License](https://img.shields.io/npm/l/@re-shell/cli.svg)](https://github.com/UmutKorkmaz/re-shell/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/UmutKorkmaz/re-shell/ci.yml?branch=main)](https://github.com/UmutKorkmaz/re-shell/actions/workflows/ci.yml)

> This package lives in the [Re-Shell monorepo](https://github.com/UmutKorkmaz/re-shell).
> Full documentation: <https://umutkorkmaz.github.io/re-shell/> and
> [`/docs`](../../docs). The `--json` envelopes are documented in the generated
> [`CLI-CONTRACTS.md`](../../docs/CLI-CONTRACTS.md).
>
> **Versions.** This tree is `0.31.0`; the last version published to npm is `0.30.1`.
> Features described here as new (everything under "Unreleased" in the
> [CHANGELOG](./CHANGELOG.md)) are not in the published package until the next release.

## What is in the box

- **585 command paths** in 46 top-level commands (`re-shell commands list --json`).
- **204 backend templates across 35 languages** plus frontend, microfrontend and
  architecture templates (`re-shell templates list --json`).
- A **local dashboard** (`re-shell ui`): 11 screens over a token-authed hub bound to `127.0.0.1`.
- A **typed JSON contract**: every machine-readable command prints one
  `{ ok, data, warnings }` or `{ ok:false, error }` envelope (schemas in
  [`@re-shell/contracts`](../contracts)).
- Tooling around it: an MCP server ([`@re-shell/mcp`](../mcp)), a VS Code extension, a
  desktop app, a hosted control plane with collaboration (not deployed). See the
  [root README](../../README.md).

## Install

```bash
npm install -g @re-shell/cli      # or: pnpm add -g @re-shell/cli
re-shell --version
```

Requires Node.js 18 or newer. Without installing: `npx @re-shell/cli --help`.

## Quick start

```bash
re-shell init acme-platform --package-manager pnpm --skip-install -y   # monorepo skeleton
cd acme-platform
re-shell templates list --json                  # the template registry
re-shell templates apply express --name billing # dry run: which files a template would create
re-shell create api --backend express           # scaffold a backend (apps/api)
re-shell create web                             # a bare create is a react-ts frontend (apps/web)
re-shell workspace health --json                # scored workspace health
re-shell doctor                                 # environment and workspace checks (exit 1 when unhealthy)
re-shell ui                                     # open the dashboard
```

`create` never prompts when stdin is not a terminal, or with `--yes`, `--json` or
`--dry-run`. Modes: `--backend <fw>`, `--frontend <fw>`, `--fullstack`,
`--microfrontend` (`--remotes name[:framework],...`), `--polyglot` (`--gateway`,
`--services name:framework,...`), `--template blank` for an empty workspace.
`create ... --dry-run --json` returns the exact file set with per-file previews and
diffs and writes nothing. An unknown template is `TEMPLATE_NOT_FOUND`; `--type` accepts
only `app|package|lib|tool`; `--force` overwrites an existing target.

## The `--json` contract

```json
{ "ok": true, "data": { "...": "..." }, "warnings": [] }
{ "ok": false, "error": { "code": "TEMPLATE_NOT_FOUND", "message": "..." }, "warnings": [] }
```

- Exactly **one** envelope on stdout; everything incidental (banners, progress,
  library logging) goes to stderr. `re-shell --version` prints only the version.
- `ok:false` exits non-zero. Unexpected failures are `COMMAND_ERROR`, bad flags or
  arguments are `USAGE_ERROR`; the full code table is in `CLI-CONTRACTS.md`.
- `doctor` is a gate: `ok:true` with `healthy` and `summary`, exit 1 when unhealthy.
- A closed pipe (`| head`) is handled (EPIPE) instead of crashing.

## Command groups

Run `re-shell <group> --help` for the exact options; `re-shell commands list --json`
is the machine-readable catalog.

| Command | What it does |
|---------|--------------|
| `init`, `create`, `add`, `remove`, `list`, `build`, `serve`, `tui` | Project and microfrontend lifecycle; `tui` is the interactive terminal UI |
| `ui` | Launch the dashboard. Fails if the hub is not healthy; `ui test`, `ui component new`, `ui generate`, `ui theme ...` |
| `doctor`, `analyze`, `completion` | Health gate; analysis (`--type bundle\|dependencies\|performance\|security\|scalability\|architecture\|all`, `--fail-on <severity>`); completion generated from the live command tree (`completion --print`) |
| `workspace` | Graph (`graph`, `graph diff`, `explore`), `status`, `health`, `summary`, `list`, `policy`, `drift`, `migrate` (config version), `migrate-monorepo` (Nx/Turbo import), `ibuild`, `state`, `backup`, ... |
| `config` | Global/project config, `config profile ...`, `config schema generate\|publish\|validate`, templates, backups |
| `templates`, `find` | Template catalog (`list\|show\|matrix\|apply\|recommend`); offline ranked search over commands and templates |
| `generate`, `api` | Components, hooks, services, backends, features; OpenAPI, Swagger, validation, gateway, tests, `api verify` |
| `service` | `link`, `unlink`, `validate`, `bridge ...` (generate, gateway, async, transform, diff, mock), `run ...` (supervise services), `polyglot ...` |
| `k8s`, `cloud` | Kubernetes, Helm, GitOps, CRD, operator, mesh, rollback; Terraform generation and deploy (`cloud iac ...`, `cloud deploy`) |
| `pkg`, `debug`, `refactor` | Unified package manager; VS Code debug configs (`debug config`); `refactor rename-service` |
| `run`, `cache`, `dev` | Dependency-ordered task runner (`--max-memory`, `--rate-limit`), build cache, dev runtime (`--profile`, `--cluster`) |
| `ai`, `fix` | Natural-language to command (providers, sessions, cache); `fix --ci` CI fixer |
| `plugin` | Install, uninstall, update, validate, pin, review, search plugins |
| `security`, `observe`, `data`, `quality`, `tools`, `learn` | Security tooling and `security audit verify` / `security compliance report`; observability; data utilities; quality; tools; learning |
| `collab` | `collab session ...` (shared sessions on a control plane) plus code generators |
| `scorecard`, `release`, `migrate`, `catalog`, `federation`, `boundaries`, `env`, `agents`, `commands` | Readiness score, graph-aware releases, codemod migrations, software catalog, Module Federation checks, import boundaries, dev environments, agent docs, command catalog |

## Highlights (all verified against the built CLI)

- **AI** (`re-shell ai "<prompt>"`): providers Anthropic (default model `claude-opus-5-5`),
  OpenAI-compatible (any `/v1` server, e.g. a local model) or `offline`; falls back to the
  offline parser unless `--no-fallback`. Sessions (`--session`, `--continue`), a semantic
  cache (`--no-cache`), `ai suggest`, `ai config set provider|model|baseUrl|apiKey|...`.
  Nothing is ever auto-run; resolved argv is checked against the command catalog and
  spawned without a shell. No live LLM call is made unless you configure a key or server.
  Programmatic API: `import { resolveIntent, createProvider } from '@re-shell/cli/ai'`.
- **Service bridge**: `service link <consumer> <provider>` derives the provider's contract
  from its own OpenAPI / `.proto` / GraphQL SDL and generates typed TS, Python and Go clients;
  `service validate` checks the links; `service bridge gateway|async|transform|diff|mock`.
- **Kubernetes**: hardened manifests by default, Helm chart, ArgoCD or Flux (HelmRelease by
  default), `k8s rollback`, workspace-driven `k8s crd|operator|mesh` (old script generators
  behind `--legacy`).
- **Audit trail**: state-changing commands append to `.re-shell/audit/audit.jsonl`
  (hash-chained, secrets redacted; opt out with `RE_SHELL_AUDIT=0`). `security audit verify`
  checks the chain; `security compliance report --framework soc2|iso27001` maps evidence to
  controls and says which have none.
- **Resource governor**: `run --max-memory <mb> --rate-limit <n>`, same flags on
  `workspace ibuild build`.
- **Startup**: command groups load lazily. Measured on the development VM (10 runs,
  median): `--version` about 45 ms, `--help` about 100 ms, `templates list --json`
  about 300 ms. Numbers depend on the machine; `node scripts/bench-startup.mjs` (repo
  root) reproduces them.

## Configuration and environment

| Where | What |
|-------|------|
| `~/.re-shell/config.yaml` | Global config (`re-shell config ...`), including the `ai:` section |
| `.re-shell/config.yaml` | Project config |
| `re-shell.workspaces.yaml` | Workspace definition (schema v2, served at <https://umutkorkmaz.github.io/re-shell/schemas/workspace-v2.json>) |
| `.re-shell/plugins.json` | Installed plugins |
| `.re-shell/audit/` | Audit trail |
| `.re-shell/ai/` | AI sessions and cache (git-ignored) |
| `re-shell.whitelabel.json` | Dashboard white-label (also `RE_SHELL_BRAND_NAME`, `_TAGLINE`, `_LOGO`, `_FAVICON`, `_ACCENT`) |
| `RE_SHELL_AI_PROVIDER`, `RE_SHELL_AI_MODEL`, `RE_SHELL_AI_BASE_URL`, `RE_SHELL_AI_API_KEY`, `ANTHROPIC_API_KEY` | AI provider selection and keys |
| `RE_SHELL_CONTROL_PLANE_URL`, `_TOKEN`, `_TOKEN_FILE`, `_TENANT` | `collab session ...` connection |
| `NO_COLOR` | Disable colour |

## Examples

[`examples/`](./examples) holds workflow guides by command area; their `re-shell`
commands are checked against the CLI catalog by `node scripts/check-doc-commands.mjs`
(repo root). Task-oriented walkthroughs live on the
[documentation site](https://umutkorkmaz.github.io/re-shell/).

## Development

```bash
pnpm --filter @re-shell/cli build      # tsc + schema, completion scripts, async runtime assets
pnpm --filter @re-shell/cli typecheck
pnpm --filter @re-shell/cli test       # vitest: unit, integration, conformance
node packages/cli/scripts/gen-cli-contracts.mjs          # regenerate docs/CLI-CONTRACTS.md
node packages/cli/scripts/gen-cli-contracts.mjs --check  # CI drift check
```

`prepack` rebuilds `dist/` and bundles the dashboard (`apps/web`) into
`dist/dashboard`, so the published tarball serves `re-shell ui` without the monorepo;
`node scripts/pack-smoke.mjs` (repo root) installs the packed tarballs in a clean
directory and checks `--version`, `--help`, `templates list --json` and `ui --dry-run --json`.

## License

Apache-2.0. See [LICENSE](./LICENSE).
