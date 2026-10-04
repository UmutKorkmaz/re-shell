---
title: "Dashboard"
description: "re-shell ui: the bundled web dashboard, its launch modes, the hardened local hub, the 11 screens and the workspace graph explorer."
---

`re-shell ui` launches a **local web dashboard**: a control surface for the same
monorepo your CLI operates on. It ships *inside* `@re-shell/cli`: there is nothing
extra to install. The dashboard and the CLI read from the same
[typed JSON contract](/re-shell/contract/json-contract/), so what you see in the
browser is what the CLI emits. The same bundle is also the front end of the
[desktop app](/re-shell/integrations/desktop/).

```bash
re-shell ui
```

The browser opens at `http://127.0.0.1:3333` and a token-authenticated **hub
server** starts on its own port. Both bind to `127.0.0.1` only. `re-shell ui` waits
for the hub to answer a health check and **fails (non-zero exit) if it does not**,
rather than opening a dashboard with no hub behind it.

## Launching

```
Usage: re-shell ui [options] [command]

Options:
  --ui-path <path>        Path to the standalone re-shell-ui repo or dashboard app
  --ui-root <path>        Alias for --ui-path
  --workspace <path>      Workspace path to inspect (default: cwd)
  --port <port>           Dashboard port (default: "3333")
  --host <host>           Dashboard host (default: "127.0.0.1")
  --package-manager <pm>  Package manager to run (pnpm, npm, yarn, bun)
  --dry-run               Print the launch plan without starting the dashboard
  --json                  Print the launch plan as JSON without starting
  --no-open               Do not open the browser after launching

Commands:
  test        Run Storybook interaction + a11y + visual tests
  component   Scaffold UI components
  generate    Generate a component from a description
  theme       Dashboard theme packs
```

The subcommands are covered in [ui](/re-shell/cli/ui/). Inspect what a launch would do
without starting anything:

```bash
re-shell ui --dry-run
re-shell ui --json
```

```json
{
  "ok": true,
  "data": {
    "mode": "static",
    "workspace": "/abs/path/to/monorepo",
    "url": "http://127.0.0.1:3333",
    "hubUrl": "http://127.0.0.1:3334",
    "hubPort": "3334",
    "hubToken": "<redacted>",
    "open": true
  },
  "warnings": []
}
```

(Abbreviated: the real plan also lists the command, its arguments and the environment
it would use.) The hub token is shown as `<redacted>`, here and in the environment:
a printed plan is never launched, and a real launch mints its own fresh token, so
`--json` and `--dry-run` output is safe to paste into CI logs and issues.

## Two launch modes

| Mode | When | What runs |
| --- | --- | --- |
| **`static`** | Default for an npm-installed CLI. | The prebuilt SPA bundled into the CLI (`dist/dashboard`, put there by `prepack`) is served by a dependency-light static server, alongside the bundled hub. No Vite, no source checkout. |
| **`vite-dev`** | You pass `--ui-path <path>`, or run from the monorepo source. | The dashboard's Vite dev server runs (hot reload), with the CLI owning and managing the hub. |

```bash
# Default: bundled static dashboard
re-shell ui

# Develop against a dashboard checkout (Vite)
re-shell ui --ui-path ./apps/web

# Pin the port; do not auto-open the browser
re-shell ui --port 4000 --no-open
```

## The hardened local hub

The dashboard never runs commands itself. A small **hub server** is the only
bridge between the browser and the CLI, and it is locked down by design:

- **Loopback only**: the hub binds to `127.0.0.1` and the hub URL is pinned to it;
  it is never exposed on a public interface.
- **Per-launch token**: every `re-shell ui` mints a fresh random hub token. The browser
  must present it; requests without it are rejected.
- **Exact-origin allow-list**: the hub only accepts the dashboard origin it launched.
- **Shell-free, allow-listed commands**: the browser may only send a stable
  `commandId` plus opaque `params`. The hub resolves those against an allow-listed
  registry and spawns the CLI **without a shell**. The browser can never send raw argv
  or an arbitrary command string.

Live output streams to the browser over **SSE** (`/events`) and a **WebSocket**
(`/jobs`), validated on both ends against the same
[contract schemas](/re-shell/architecture/contracts-package/) (`SseEvent`,
`WsClientMessage`, `WsServerMessage`). Full design:
[Secure Hub](/re-shell/architecture/secure-hub/).

## The 11 screens

| Screen | What it does |
| --- | --- |
| **Overview** | Bento dashboard: a hero workspace metric, status tiles, recent-jobs strip, and a health mini-summary. |
| **Workspace Graph** | The graph explorer ([below](#the-workspace-graph-explorer)). |
| **Templates** | Browse the [208-template catalog](/re-shell/templates/catalog/), filter by language/framework, and preview a scaffold. |
| **Command Builder** | A two-pane form that builds an allow-listed command and shows a live, copyable preview. |
| **Assistant** | Plain-language requests mapped to a single allow-listed hub command. See [Assistant Panel](/re-shell/dashboard/assistant/). |
| **Jobs & Logs** | A jobs table plus a streaming log console; output arrives live over SSE/WS. |
| **Health** | The scored health roll-up and per-check rows, grouped by severity. |
| **Scorecard** | Weighted production-readiness grades per service and a monorepo rollup. |
| **Catalog** | The software catalog auto-discovered from the workspace graph, with Backstage interop. |
| **Collaboration** | Shared console, presence with WebRTC links, shared editor and team analytics on a [control plane](/re-shell/integrations/collaboration/). Needs a running control plane; none is deployed. |
| **Settings** | Hub connection, theme and dashboard preferences. |

The list lives in `apps/web/src/shell/screens.ts`. Screens are code-split and each
bundle has an enforced gzip budget in CI. The shell has a skip link, focus
management on navigation, live regions for job output and toasts, and respects
`prefers-reduced-motion`; contrast is verified in both themes, and an automated axe
audit of every screen runs in CI. (Automated checks find a subset of accessibility
problems; this is not a substitute for a manual audit.)

## The workspace graph explorer

The **Workspace Graph** screen scales to **2000+ nodes** (it is virtualized; a
Playwright spec generates a 2001-workspace repository and checks render, search,
filter, path, diff and export budgets, and passed locally when it was merged; it
runs in CI and passes there, PR #395).

- **Search and facet filters**: text search over name and path, and language, framework, type and status facets. They live in the URL,
  so a filtered view is shareable.
- **Dependency paths**: select a node to highlight what it depends on and what depends
  on it; select two to highlight the shortest path between them.
- **Cycles** are flagged.
- **Diff** against a git ref or a saved graph file: added, removed and changed nodes
  and edges, with colouring and a legend (the same engine as
  [`workspace graph diff`](/re-shell/cli/workspace/#workspace-graph-diff)). The hub
  refuses an unsafe ref before running anything.
- **Live status** per node (running, stopped, unhealthy, unknown) from
  [`workspace status`](/re-shell/cli/workspace/#workspace-status).
- **Export** the current view as PNG, SVG, PDF, Mermaid, D3 JSON or JSON.

## Theming and branding

Dark is the default; a light theme is built in. Theme packs and white-label branding
are covered in [Themes & white-label](/re-shell/dashboard/themes-white-label/).

## See also

- [JSON Contract](/re-shell/contract/json-contract/): the envelope the hub streams.
- [Secure Hub](/re-shell/architecture/secure-hub/): token auth, binding, allow-list.
- [Assistant Panel](/re-shell/dashboard/assistant/): natural language to one allow-listed command.
- [`templates`](/re-shell/cli/templates/): the catalog the dashboard browses.
- [Desktop app](/re-shell/integrations/desktop/) and [VS Code extension](/re-shell/integrations/vscode/).
