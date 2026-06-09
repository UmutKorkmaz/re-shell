---
title: "Dashboard"
description: "re-shell ui — the bundled mission-control web dashboard, its launch modes, the hardened local hub, and the seven screens."
---

`re-shell ui` launches a **local web dashboard** — a mission-control surface for
the same monorepo your CLI operates on. It ships *inside* `@re-shell/cli`: there
is nothing extra to install. The dashboard and the CLI read from the same
[typed JSON contract](/re-shell/contract/json-contract/), so what you see in the
browser is exactly what the CLI emits.

```bash
re-shell ui
```

The browser opens at `http://127.0.0.1:3333` and a token-authenticated **hub
server** starts on its own port. Both bind to `127.0.0.1` only.

## Launching

```
Usage: re-shell ui [options]

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
```

Inspect what a launch would do without starting anything:

```bash
re-shell ui --dry-run
re-shell ui --json
```

```json
{
  "mode": "static",
  "url": "http://127.0.0.1:3333",
  "hubUrl": "http://127.0.0.1:3334",
  "workspace": "/abs/path/to/monorepo",
  "open": true
}
```

## Two launch modes

| Mode | When | What runs |
| --- | --- | --- |
| **`static`** | Default — an npm-installed CLI. | The prebuilt SPA bundled into the CLI (`dist/dashboard`) is served by a dependency-light static server, alongside the bundled hub. No Vite, no source checkout. |
| **`vite-dev`** | You pass `--ui-path <path>` to a standalone dashboard repo, or run from the monorepo source. | The dashboard's Vite dev server runs (hot reload), with the CLI owning and managing the hub. |

```bash
# Default: bundled static dashboard
re-shell ui

# Develop against a standalone dashboard checkout (Vite)
re-shell ui --ui-path ../re-shell-ui

# Pin host/port; do not auto-open the browser
re-shell ui --host 127.0.0.1 --port 4000 --no-open
```

## The hardened local hub

The dashboard never runs commands itself. A small **hub server** is the only
bridge between the browser and the CLI, and it is locked down by design:

- **Loopback only** — the hub binds to `127.0.0.1`; it is never exposed on a
  public interface.
- **Per-launch token** — every `re-shell ui` mints a fresh random `hubToken`. The
  browser must present it; requests without it are rejected.
- **Exact-origin allow-list** — the hub only accepts the dashboard origin it
  launched.
- **Shell-free, allow-listed commands** — the browser may only send a stable
  `commandId` plus opaque `params`. The hub resolves those against an
  allow-listed registry and spawns the CLI **without a shell**. The browser can
  never send raw argv or an arbitrary command string.

Live output streams to the browser over **SSE** (`/events`) and a **WebSocket**
(`/jobs`), validated on both ends against the same
[contract schemas](/re-shell/architecture/contracts-package/) (`SseEvent`,
`WsClientMessage`, `WsServerMessage`). Full design:
[Secure Hub](/re-shell/architecture/secure-hub/).

## The seven screens

| Screen | What it does |
| --- | --- |
| **Overview** | Bento dashboard: a hero workspace metric, status tiles, recent-jobs strip, and a health mini-summary. |
| **Workspace Graph** | Interactive topology of apps and services with internal dependency edges; live path highlighting. |
| **Templates** | Browse the [205-template catalog](/re-shell/templates/catalog/), filter by language/framework, and preview a scaffold. |
| **Command Builder** | A two-pane form that builds an allow-listed command and shows a live, copyable preview. |
| **Jobs & Logs** | A jobs table plus a streaming log console — output arrives live over SSE/WS. |
| **Health** | The scored health roll-up and per-check rows, grouped by severity. |
| **Settings** | Theme toggle (dark default / refined light) and dashboard preferences. |

Every numeric, path, command, and log line is rendered in mono; titles and labels
in Space Grotesk — the same design system as this site.

## See also

- [JSON Contract](/re-shell/contract/json-contract/) — the envelope the hub streams.
- [Secure Hub](/re-shell/architecture/secure-hub/) — token auth, binding, allow-list.
- [`templates`](/re-shell/cli/templates/) — the catalog the dashboard browses.
