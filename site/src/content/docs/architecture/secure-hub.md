---
title: "Secure Hub"
description: "The token-authenticated, loopback-bound, allow-listed, shell-free bridge between the dashboard and the CLI."
---

The **hub server** is the only bridge between the [dashboard](/re-shell/dashboard/overview/)
running in your browser and the Re-Shell CLI. It is the security boundary of the
whole local platform, and it is hardened by design: a browser tab can drive the
CLI, but it can never run an arbitrary command.

`re-shell ui` starts the hub on its own loopback port and hands the dashboard a
per-launch token. Everything below is enforced by the hub, not by convention.

## The four guarantees

### 1. Loopback only

The hub binds to **`127.0.0.1`**. It is never exposed on a public interface or a
LAN address — only processes on your machine can reach it.

### 2. Per-launch token

Every `re-shell ui` mints a **fresh random `hubToken`**. The dashboard reads it at
launch (injected into `index.html` in static mode, or via env in vite-dev mode)
and presents it on every request. Requests without the matching token are
rejected. Restarting the dashboard rotates the token.

### 3. Exact-origin allow-list

The hub is told the exact dashboard origin it launched and only accepts requests
from that origin. A different page on `localhost` cannot talk to it.

### 4. Shell-free, allow-listed commands

This is the core protection. The browser may **only** send a stable `commandId`
plus an opaque `params` object — never a raw command string or argv array:

```ts
// What the browser is allowed to send (WsClientMessage):
{ type: 'start', id: 'job-1', commandId: 'workspace.health', params: { json: true } }
```

The hub resolves that `commandId` against its **allow-listed registry**, builds a
safe argv, and spawns the CLI **without a shell** (no `shell: true`, so no shell
interpolation, no command chaining). A command the registry does not know is
refused. There is no code path from the browser to an arbitrary process.

## How output streams back

Live output flows to the browser over two channels, both validated against the
[contract schemas](/re-shell/architecture/contracts-package/) on the emit side
(hub) and the consume side (browser):

| Channel | Path | Carries |
| --- | --- | --- |
| **SSE** | `/events` | `SseEvent` — `stdout`, `stderr`, `exit` (with numeric `code`), `error`, `heartbeat`. |
| **WebSocket** | `/jobs` | `WsServerMessage` — the same chunks, keyed per job via `id`, for the Jobs & Logs screen. |

Because both ends parse against the identical zod schema, a malformed or
unexpected message is rejected rather than silently mishandled.

## The launch plan

Inspect exactly what the hub will do, without starting it:

```bash
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

The dashboard origin (`url`) and the hub (`hubUrl`) are distinct ports, both on
`127.0.0.1`. The hub receives the dashboard origin so it can build its
exact-origin allow-list, and it reads its port + per-launch token from the
environment.

## Why this design

A local web UI that can run shell commands is a soft target. By making the hub
loopback-only, token-gated, origin-checked, and — most importantly —
**allow-listed and shell-free**, Re-Shell gives you a convenient browser control
surface without turning your machine into a remote-execution endpoint. The
dashboard's power is bounded by the registry of commands the hub is willing to
run.

## See also

- [Dashboard](/re-shell/dashboard/overview/) — the surface the hub serves.
- [Contracts Package](/re-shell/architecture/contracts-package/) — the SSE/WS message schemas.
- [Monorepo](/re-shell/architecture/monorepo/) — where the hub fits in the stack.
