---
title: "Monorepo"
description: "How the cli, contracts, mcp, ui, control-plane, dashboard, VS Code and site packages fit together."
---

Re-Shell is a single pnpm monorepo (`pnpm-workspace.yaml`: `packages/*`, `apps/*`,
`site`) built from a small set of layered packages, so the wire shapes crossing every
process boundary are defined once and shared everywhere. Repository:
[`UmutKorkmaz/re-shell`](https://github.com/UmutKorkmaz/re-shell).

## The packages

| Package | Version | Role |
| --- | --- | --- |
| **`@re-shell/cli`** (`packages/cli`) | `0.31.0` in tree; [`0.30.1`](https://www.npmjs.com/package/@re-shell/cli) published | The CLI you install globally. Bundles the dashboard SPA, the hub server and the template registry. |
| **`@re-shell/contracts`** (`packages/contracts`) | `0.3.0` in tree; `0.2.0` published | The single source of truth: zod schemas and types for every shape that crosses a process boundary: CLI wire payloads and adapters, hub transport, the command allow-list, collaboration, graph, theme and white-label. |
| **`@re-shell/mcp`** (`packages/mcp`) | `0.2.0` in tree; `0.1.0` published | The [MCP server](/re-shell/integrations/mcp/) for AI agents. |
| **`@re-shell/ui`** (`packages/ui`) | `0.6.0` in tree; `0.5.0` published | The shadcn-based React component system (tokens, primitives, domain components), with Storybook 9. |
| **`@re-shell/control-plane`** (`packages/control-plane`) | `0.1.0`, private | The hosted [control plane](/re-shell/architecture/control-plane/) with collaboration. Not deployed. |
| **`@re-shell/dashboard`** (`apps/web`) | `0.1.0`, private | The React dashboard (11 screens) that `re-shell ui` serves, the hub server, and the Tauri [desktop app](/re-shell/integrations/desktop/) shell. |
| **`re-shell`** (`apps/vscode-extension`) | `0.3.0`, private | The [VS Code extension](/re-shell/integrations/vscode/), built as a `.vsix`. |
| **`@re-shell/site`** (`site`) | private | This documentation site (Astro Starlight) and the hosted `workspace-v2.json` schema. |

`experimental/` contains only a README: the control plane graduated out of it and
nothing else lives there.

```
@re-shell/contracts   ← schemas + types (zod)
   ▲    ▲    ▲    ▲
   │    │    │    └─ @re-shell/control-plane (HTTP, workers, collaboration)
   │    │    └────── @re-shell/mcp, VS Code extension
   │    └─────────── @re-shell/ui ──► dashboard app (apps/web) ──► desktop shell
   └──────────────── @re-shell/cli ──── re-shell ui (serves the bundled SPA + the hub)
```

## One contract, many consumers

The CLI **emits** the [typed JSON envelope](/re-shell/contract/json-contract/); the
dashboard, the MCP server and the VS Code extension **consume** it, and all validate
against the same zod schemas from
[`@re-shell/contracts`](/re-shell/architecture/contracts-package/). The CLI is
conformance-tested against the wire schemas on every build, and `docs/CLI-CONTRACTS.md`
is generated from them.

## What an install contains

```bash
npm install -g @re-shell/cli
```

That one package contains:

- The full CLI (585 command paths in 46 top-level commands at 0.31.0).
- The 208-template backend scaffolding registry (plus frontend and architecture templates).
- The prebuilt dashboard SPA and the static server (`re-shell ui`), placed in the tarball
  by the `prepack` hook.
- The token-authenticated hub server.

The MCP server, VS Code extension, desktop app and control plane are separate and
optional. There is no network dependency beyond the registry download; the CLI is
offline-first.

## How a request flows

1. You run `re-shell ui`. The CLI serves the bundled dashboard on `127.0.0.1` and starts
   the [hub](/re-shell/architecture/secure-hub/) with a per-launch token.
2. In the browser, the Command Builder builds an **allow-listed** command (`commandId` +
   opaque `params`), never raw argv.
3. The hub resolves it against the shared registry and spawns the CLI **without a shell**.
4. The CLI emits the [JSON envelope](/re-shell/contract/json-contract/); output streams back
   over SSE/WS, validated against the contract on both ends.

## Building from source

```bash
npx pnpm@9.15.9 install --frozen-lockfile
npx pnpm@9.15.9 -r build
node packages/cli/dist/index.js --help
npx pnpm@9.15.9 --filter @re-shell/site build   # this site
```

CI (`.github/workflows`) builds, typechecks and tests every package, enforces size
budgets, checks that `docs/CLI-CONTRACTS.md` matches the CLI, runs Playwright end-to-end
and axe accessibility audits, runs a Storybook test gate, smoke-tests the packed
tarballs in a clean install, and (separately) builds representative templates with their
own toolchains. These workflows were added in this wave and are pending their first
hosted run; see [Roadmap](/re-shell/roadmap/) for what was verified locally.

## See also

- [Contracts Package](/re-shell/architecture/contracts-package/): the shared schemas.
- [Secure Hub](/re-shell/architecture/secure-hub/): the CLI to UI bridge.
- [Control Plane](/re-shell/architecture/control-plane/)
- [Dashboard](/re-shell/dashboard/overview/)
- [Core Concepts](/re-shell/getting-started/concepts/)
