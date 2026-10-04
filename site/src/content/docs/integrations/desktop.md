---
title: "Desktop app"
description: "A native Tauri window around the dashboard that owns its local hub. Linux builds verified; macOS, Windows and signing are CI-only."
---

The desktop app is the dashboard in a native window (Tauri). Unlike `re-shell ui`, the
app **owns its hub**: it starts the local hub server itself, hands the dashboard the
hub's address and token at runtime, and stops the hub when it exits. The dashboard
needs no desktop-specific code. Full design and the evidence behind each statement
below: [`docs/desktop.md`](https://github.com/UmutKorkmaz/re-shell/blob/main/docs/desktop.md).

> **Verification status.** Linux `.deb`, `.rpm` and `.AppImage` bundles were built and
> the `.deb` and release binary were smoke-tested under Xvfb in the development
> environment. **macOS and Windows bundles are produced only by the `desktop` GitHub
> workflow and were not built or run here**. The workflow has run on GitHub and
> passes on PR #395 (commit `3207b9f`): it builds the Linux, macOS and Windows bundles and
> runs the Rust tests, but nobody has launched the macOS or Windows app, and **signed builds were never verified with real certificates**: signing
> happens only when you add the signing secrets to the repository, and without them
> the workflow builds **unsigned** bundles and says so in its log. The app is not
> distributed anywhere.

## How it starts

1. Finds Node.js 18+ (`RE_SHELL_NODE`, then `PATH`, then common install directories).
2. Finds the bundled hub (`hub/hub-server.js` in the app resources).
3. Picks the workspace: `--workspace <dir>`, then `RE_SHELL_WORKSPACE`, then the
   launch directory.
4. Spawns the hub on a **free `127.0.0.1` port** with a fresh 256-bit token from the OS
   random source, passed through the environment, never argv.
5. Waits for an authenticated `GET /health` to return 200 (20 s limit).
6. Pins the content security policy to that port, then opens the dashboard window with
   the hub URL and token injected before any page script runs.
7. On exit, stops the hub (closes its stdin, then kills it after 5 s). If the app dies
   for any reason, including `SIGKILL`, the closed pipe makes the hub shut itself down
   rather than linger on its port.

If Node is missing, the bundle is missing or the hub never answers, the window shows
the reason on a static page and the process exits with status 1. There is no code path
that opens a dashboard without a hub. If the hub dies later, a banner says so; it is
not restarted silently.

## Requirements

| Need | Why | Override |
| --- | --- | --- |
| Node.js 18+ on the machine | The hub is a Node program; the app does not bundle a Node runtime. | `RE_SHELL_NODE` |
| The `re-shell` CLI (`npm i -g @re-shell/cli`) | The hub runs vetted CLI commands. Without it the app and hub still start; only jobs that need the CLI fail. | `RE_SHELL_CLI_BIN` |
| A workspace directory | The root the hub's jobs are contained to. | `--workspace` / `RE_SHELL_WORKSPACE` |

## Build

```bash
pnpm install --frozen-lockfile
pnpm -r build
pnpm --filter @re-shell/dashboard tauri:dev      # dev window
pnpm --filter @re-shell/dashboard tauri build    # .deb / .rpm / .AppImage on Linux
```

Needs Rust 1.77.2 or newer and, on Linux, the Tauri system packages (WebKitGTK 4.1 and
friends; the list is in `docs/desktop.md`).

## Security model

The hub binds `127.0.0.1` and requires the per-launch token on every route. The token
lives only in the app process, the hub's environment and the webview's memory, and is
never logged or written to disk. The webview origin is added to the hub's exact-origin
allow-list; the window can only navigate within the app origin; the capability set is
`core:default` with no custom Tauri commands or plugins.

## What was verified, and what was not

Verified here: `cargo test --locked` (unit and integration tests against the real hub
bundle under real Node), a real release binary and a `.deb` install smoke-tested under
Xvfb (hub on loopback only, token enforced, the webview reaches the hub, the hub and its
port are gone after `SIGTERM`, `SIGKILL` and closing the window, and the failure page on
a missing Node), and the AppImage starting its hub.

Not verified locally: any macOS or Windows build (the hosted `desktop` workflow builds them), any signed or notarized build, the in-app
auto-update (there is none; updater signatures are produced only when a key exists),
and the `.rpm` was built but not installed.

## See also

- [Dashboard](/re-shell/dashboard/overview/)
- [Secure Hub](/re-shell/architecture/secure-hub/)
