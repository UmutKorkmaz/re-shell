# Re-Shell Docs

This is the documentation index for the **single pnpm monorepo** at
[`UmutKorkmaz/re-shell`](https://github.com/UmutKorkmaz/re-shell). The workspace
(`pnpm-workspace.yaml`: `packages/*`, `apps/*`, `site`) holds these packages:

| Directory | Package | Role |
|-----------|---------|------|
| `packages/cli` | `@re-shell/cli` | The published CLI and engine: 585 command paths, 208 backend templates, `re-shell ui` launcher, bundled dashboard. |
| `packages/contracts` | `@re-shell/contracts` | zod schemas shared by everything: exact `--json` wire schemas and adapters, domain models, hub transport, command registry, OT, graph, theme and white-label. |
| `packages/mcp` | `@re-shell/mcp` | Stdio MCP server exposing Re-Shell's read-only JSON commands as agent tools, resources and prompts. |
| `packages/ui` | `@re-shell/ui` | shadcn-React component library (the single UI system), Storybook 9. |
| `packages/control-plane` | `@re-shell/control-plane` (private) | Hosted multi-tenant control plane: HTTP/SSE, SQLite, workers, collaboration. Not deployed. |
| `apps/web` | `@re-shell/dashboard` (private) | Dashboard (11 screens), token-authed hub-server, Tauri desktop shell (`src-tauri`). |
| `apps/vscode-extension` | `re-shell` (private) | VS Code extension, packaged as a `.vsix`. |
| `site` | `@re-shell/site` (private) | The documentation site (Astro Starlight) and the hosted workspace v2 JSON Schema. |

`experimental/` contains only a README (the control plane graduated out of it);
nothing in it is built or published.

> The Web Components layer has been **retired**; shadcn-React in `packages/ui` is the one UI system.

Versions, command counts and template counts are recorded in [`ROADMAP.md`](./ROADMAP.md)
(snapshot table) with the command that produces each number.

## Documentation information architecture

### Canonical docs (start here)

| Doc | What it is |
|-----|------------|
| [`STABILITY.md`](./STABILITY.md) | **Release gates and the stability backlog**, with what is done, what is only partly done, and what is blocked on something external. |
| [`ROADMAP.md`](./ROADMAP.md) | **Delivery status of every feature**, checked against the code, including Phase 9 (P9-A to P9-N). Uses `DONE+tested`, `DONE (env-limited: ...)`, `PARTIAL (...)`. |
| [`CLI-CONTRACTS.md`](./CLI-CONTRACTS.md) | **Generated** reference for the CLI `--json` envelopes, the error-code table and per-command payload shapes. Regenerate with `node packages/cli/scripts/gen-cli-contracts.mjs`; CI runs it with `--check`. It covers the **CLI envelopes**, not the dashboard hub transport (SSE `/events`, WS `/jobs`), which is described in the [site's Secure Hub page](../site/src/content/docs/architecture/secure-hub.md) and `packages/contracts/src/re-shell.ts`. Do not hand-edit. |
| [`control-plane.md`](./control-plane.md) | The hosted control plane (P9-J) and real-time collaboration (P9-N): architecture, tenancy, identity, HTTP API, workers, deployment, what is tested, limits. |
| [`desktop.md`](./desktop.md) | The Tauri desktop app (P9-K): how it owns the hub, runtime requirements, build, CI and signing, what was verified, what was not. |
| [`design/dashboard-design.md`](./design/dashboard-design.md) | The dashboard design-system spec and its checklist (ticked where the code proves it). |
| hub-server / security | `apps/web/src/hub-server.ts`: token-authed transport, SSE `/events`, WS `/jobs`, 127.0.0.1 bind, session token, no arbitrary shell. |

### Historical records (do not treat as current)

| Doc | What it is |
|-----|------------|
| [`RE_SHELL_ULTIMATE_PLAN.md`](./RE_SHELL_ULTIMATE_PLAN.md) | The 2026-06 implementation plan and audit. **Historical**: its phases were executed; its "current state" sections describe the repositories as they were. The resolved open questions are recorded at the top of the file. |
| [`RE_SHELL_MASTER_PLAN.md`](./RE_SHELL_MASTER_PLAN.md) | The earlier draft plan. **Historical**, superseded by the Ultimate Plan. |
| [`superpowers/specs/2026-05-29-re-shell-ui-web-components-design.md`](./superpowers/specs/2026-05-29-re-shell-ui-web-components-design.md) | The Web Components spec. **Superseded**: the UI is React/shadcn. |
| [`legacy/`](./legacy/) | Material salvaged from the archived umbrella repo: the pre-Wave-2 contract (`CLI-CONTRACTS.old.md`), `migration-map.md` (old command names to the group layout), `salvage-refs/` (source references the bridge work drew on), architecture and requirements notes. |

### User-facing documentation site

The site under [`site/src/content/docs`](../site/src/content/docs) is the user
documentation: install, quickstart, every command group, the JSON contract, the
dashboard, MCP, AI, bridge, Kubernetes, control plane, collaboration, desktop,
VS Code and white-labelling. It is deployed to
<https://umutkorkmaz.github.io/re-shell/> by `.github/workflows/pages.yml`
(not reachable from the environment this index was written in, so the live site
was not checked). Build it locally with `pnpm --filter @re-shell/site build`.

Every `re-shell ...` command written in the site, the READMEs and these docs is
checked against the built CLI's catalog by
`node scripts/check-doc-commands.mjs` (run after `pnpm -r build`).

### Per-package docs

| File | Scope |
|------|-------|
| `packages/cli/README.md` | CLI install, quick start, command groups, JSON envelope, configuration. |
| `packages/contracts/README.md` | Wire schemas, adapters, domain models, hub transport, subpath exports. |
| `packages/mcp/README.md` | Tools, resources, prompts, how the CLI is resolved, safety. |
| `packages/ui/README.md` | Exports, type system, accessibility, Storybook, budgets, white-label. |
| `packages/control-plane/README.md` | Running the control plane and workers; points to `control-plane.md`. |
| `apps/web/README.md` | Dashboard screens, hub-server, desktop shell, e2e. |
| `apps/vscode-extension/README.md` | Install from `.vsix`, settings, hub use, tests. |

### CLI usage examples

- [`packages/cli/examples/*.md`](../packages/cli/examples/) are workflow guides. Their `re-shell` invocations pass `scripts/check-doc-commands.mjs`.
- The old `packages/cli/EXAMPLES.md` catalog (unchecked, full of commands that did not exist) was removed in 0.31.0; use the site and `packages/cli/examples/`, which are checked.
- `packages/cli/tests/README.md` is the test-suite reference.
- `packages/cli/CHANGELOG.md` is the release history, with an `Unreleased` section for what has not been published.

## Conventions

- Current stability work is tracked in `STABILITY.md`; `ROADMAP.md` records delivery status. Historical plans do not override the source or verified results.
- `@re-shell/contracts` is the **single source of truth** for CLI-to-UI shapes; `CLI-CONTRACTS.md` is generated from it and from real CLI output, and is conformance-tested.
- A claim in a doc should name how it was checked (a command, a test file, a workflow). Where something could not be verified in the development environment, say exactly what was and was not verified.
- `AGENTS.md` and `.agents/` are agent-context dumps and are **gitignored**; never tracked.
