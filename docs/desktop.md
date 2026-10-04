# Re-Shell Desktop (Tauri)

A native desktop window around the Re-Shell dashboard (`apps/web`). Unlike the
browser flow (`re-shell ui`), the desktop app **owns its hub**: it starts the
local hub-server itself, hands the dashboard its address and session token at
runtime, and stops the hub when it exits.

> **Status.** Built, run and verified on Linux (see
> [What has been verified](#what-has-been-verified)). macOS and Windows bundles
> are produced by the CI workflow `.github/workflows/desktop.yml`; they have
> **not** been built or run in this repository's development environment.
> Signed builds additionally need the repository secrets listed in
> [Code signing](#code-signing).

## 1. How it works

```
apps/web/src-tauri/
├── tauri.conf.json        # window (created in code), CSP, bundle + hub resource
├── Cargo.toml / Cargo.lock
├── build.rs
├── capabilities/default.json   # core:default only; no plugins, no custom commands
├── icon-source/           # 1024px source icon + generator (Pillow)
├── icons/                 # generated png / ico / icns
├── scripts/smoke-linux.sh # launches the built binary under xvfb and checks it
├── src/
│   ├── main.rs
│   ├── lib.rs             # startup, window creation, shutdown
│   ├── hub.rs             # spawn/wait/stop the hub, Node discovery, token, port
│   └── webview.rs         # init script, per-launch CSP, navigation guard, error page/banner
└── tests/hub_lifecycle.rs # integration tests against the real hub bundle
```

### Startup sequence

1. **Find Node.js.** `RE_SHELL_NODE` (exclusive when set), then `PATH`, then the
   usual install directories that GUI launchers leave off `PATH` (Homebrew,
   `/usr/local/bin`, Volta, the newest nvm, `Program Files\nodejs`). `node
   --version` must be **18 or newer**.
2. **Find the hub bundle.** `RE_SHELL_HUB_BUNDLE` (exclusive when set), then
   `hub/hub-server.js` in the app's resource directory (the dashboard build's
   `dist/hub-server.js` is bundled there by `tauri.conf.json`), then, in debug
   builds only, `apps/web/dist/hub-server.js`.
3. **Pick the workspace** the hub is rooted in: `--workspace <dir>`, then
   `RE_SHELL_WORKSPACE`, then the launch directory (the home directory when the
   launcher starts the app in `/`).
4. **Spawn the hub**: `node hub-server.js` on a free `127.0.0.1` port
   (retrying on another port if one is taken in the gap) with a fresh 256-bit
   token from the OS CSPRNG. Port and token reach the hub through its
   environment, not argv.
5. **Wait for readiness**: an authenticated `GET /health` must return 200
   (20 s limit). If the hub exits first, or never answers, startup fails
   explicitly (below).
6. **Pin the CSP** to that port (`connect-src` allows only
   `http://127.0.0.1:<port>` and `ws://127.0.0.1:<port>`).
7. **Open the dashboard window** with an initialization script that defines
   `window.__RE_SHELL_HUB__ = { url, token }` (frozen, non-writable) before any
   page script runs.
8. **On exit** the hub is stopped: its stdin is closed (a graceful stop, the
   same on every platform), then it is killed if it has not exited within 5 s.

### Runtime hub config, and the browser flow

The dashboard already resolves its hub as: explicit option, then
`window.__RE_SHELL_HUB__`, then the Vite build-time env, then localhost
defaults (`packages/ui/src/hooks/config.ts`). The desktop app supplies the
runtime global, exactly as the CLI's static server does for a prebuilt bundle,
so **the dashboard needs no desktop-specific code and the `re-shell ui` browser
flow is unchanged**. Nothing is baked into the frontend at build time.

### Security model

- The hub binds `127.0.0.1` only and requires the per-launch token on every
  route (unchanged hub behavior). The token exists only in the app process, the
  hub's environment and the webview's memory; it is never logged (the app's
  `Debug` output redacts it, the hub's access log records paths only) and never
  written to disk or argv.
- The webview origin (`tauri://localhost`, or `http(s)://tauri.localhost` on
  Windows) is added to the hub's **exact-origin** allowlist through
  `RE_SHELL_UI_HUB_ALLOWED_ORIGINS`. Wildcards, paths and other schemes in that
  variable are dropped, so it can never widen the allowlist to a pattern.
- CSP (`tauri.conf.json`): `default-src 'self'; script-src 'self'; style-src
  'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;
  connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*; object-src 'none';
  base-uri 'none'; form-action 'none'`. At launch the loopback wildcard ports
  are rewritten to the hub's actual port. `font-src data:` is required because
  the dashboard build inlines its fonts as data URIs.
- The window may only navigate within the app origin (plus the dev server in
  debug builds); anything else is refused, so the token cannot be carried to a
  foreign page.
- No custom Tauri commands or plugins; the capability set is `core:default`.
- **Orphan protection.** The hub is started with
  `RE_SHELL_UI_HUB_EXIT_ON_STDIN_CLOSE=1` and a stdin pipe held by the app. If
  the app exits for any reason, including `SIGKILL` or a crash, the OS closes the
  pipe and the hub shuts itself down instead of lingering on its port.

### When the hub cannot start

There is no code path that opens a dashboard without a hub. If Node.js is
missing or too old, the bundle is missing, the hub crashes at startup or never
answers `/health`, the window shows the reason on a static, scriptless error
page (a `data:` URL that holds no token; with the hub's own output when there is
any), the same text goes to stderr, and the process **exits with status 1** when
that window is closed. If the hub dies later, a red banner is
shown over the dashboard and the event is logged to stderr; it is not restarted
silently (a new hub means a new token, i.e. a restart of the app).

## 2. Requirements at runtime

| Need | Why | Override |
| ---- | --- | -------- |
| **Node.js 18+** on the machine | the hub is a Node program; the app does **not** bundle a Node runtime | `RE_SHELL_NODE=/path/to/node` |
| **The `re-shell` CLI** (`npm i -g @re-shell/cli`) | the hub runs vetted CLI commands; the app puts Node's directory first on the hub's `PATH` so a global install next to `node` is found | `RE_SHELL_CLI_BIN=/path/to/re-shell` |
| A workspace directory | the root the hub (and the CLI jobs it spawns) are contained to | `--workspace <dir>` / `RE_SHELL_WORKSPACE` |

Without the CLI the app and hub still start (health and transport work); only
jobs that need the CLI fail, with the spawn error shown in the dashboard.

`.deb` packages declare `Recommends: nodejs (>= 18)`; it is a recommendation,
not a hard dependency, so Node from nvm/Volta/NodeSource is fine.

Not bundled, by choice: shipping a Node sidecar binary per platform would
roughly double the installer size, and the hub also shells out to the CLI, which
is itself a Node program. Revisit if a Node-free install becomes a goal.

## 3. Develop and build

Prerequisites: Rust (stable, 1.77.2+), Node 22, pnpm 9.15.9 and, on Linux, the
Tauri system packages:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev \
  librsvg2-dev patchelf libssl-dev build-essential libgtk-3-dev \
  libsoup-3.0-dev libjavascriptcoregtk-4.1-dev
```

```bash
pnpm install --frozen-lockfile
pnpm -r build                                     # contracts and ui are needed by the dashboard

pnpm --filter @re-shell/dashboard tauri:dev       # dev window; Vite on :3333, hub owned by the app
pnpm --filter @re-shell/dashboard tauri build     # .deb / .rpm / .AppImage (Linux), .dmg (macOS), .msi / .exe (Windows)
```

`tauri build` runs `pnpm --filter @re-shell/dashboard... run build` first, which
builds contracts, ui, the dashboard and `dist/hub-server.js`.

Tests:

```bash
cd apps/web/src-tauri && cargo test --locked      # unit + integration (needs dist/hub-server.js and Node)
pnpm --filter @re-shell/dashboard test            # includes tests/hub-desktop.test.ts
bash apps/web/src-tauri/scripts/smoke-linux.sh <binary> <evidence-dir>   # real binary under xvfb (needs xvfb, openbox, wmctrl, imagemagick, ss)
```

Icons are regenerated as described in `src-tauri/icons/README.md`.

## 4. CI and code signing

`.github/workflows/desktop.yml` runs on `desktop-v*` tags, on pull requests that
touch the desktop inputs, and on demand. It has:

- **rust-tests** (Ubuntu): builds the dashboard and hub bundle, then `cargo test --locked`.
- **build** matrix (`ubuntu-latest`, `macos-latest` as a universal binary,
  `windows-latest`) using `tauri-apps/tauri-action`, uploading the bundles as
  workflow artifacts (and, for a `desktop-v*` tag, attaching them to a draft
  release). The Linux leg also runs `smoke-linux.sh` against the built binary and
  uploads its logs and screenshots.

Signing is **optional and secret-driven**. A "Detect code-signing credentials"
step checks which secrets exist, exports only the non-empty ones, and logs
for each platform whether signing is ENABLED or DISABLED (unsigned) as a
workflow annotation. Without secrets the workflow still builds, unsigned.

| Secret | Purpose |
| ------ | ------- |
| `APPLE_CERTIFICATE` | base64 of the Developer ID Application `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | password of that `.p12` |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Name (TEAMID)` |
| `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` | notarization (app-specific password); without all three the macOS bundle is signed but not notarized |
| `WINDOWS_CERTIFICATE` | base64 of the Authenticode `.pfx` |
| `WINDOWS_CERTIFICATE_PASSWORD` | password of that `.pfx` |
| `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | signs updater artifacts (`.sig` files) |

How they are used: the Tauri bundler reads the `APPLE_*` variables to sign and
notarize on macOS; the Windows certificate is imported into the runner's user
certificate store and its thumbprint is passed to the bundler through a
generated, untracked `tauri.signing.conf.json` (which holds no secret);
`TAURI_SIGNING_PRIVATE_KEY` switches on `createUpdaterArtifacts`. Linux bundles
are not signed by this workflow. **Nothing secret is committed**, and the
generated override file is git-ignored.

The updater key produces signed update artifacts for release distribution; the
app does not yet embed an in-app updater plugin.

## 5. What has been verified

Environment: Ubuntu 24.04, Rust 1.97, Node 22, WebKitGTK 4.1, under Xvfb. All of
this was run for real; nothing is simulated.

- **`pnpm --filter @re-shell/dashboard tauri build`** produced
  `Re-Shell_1.0.0_amd64.deb` (4.0 MiB), `Re-Shell-1.0.0-1.x86_64.rpm` (4.0 MiB)
  and `Re-Shell_1.0.0_amd64.AppImage` (79 MiB). All bundles contain
  `hub/hub-server.js` as a resource. They are **unsigned** (no certificates exist
  here; Linux bundles are not signed by the workflow).
- **`smoke-linux.sh`** against the release binary, against the binary installed
  from the `.deb` (`dpkg -i`, run as `/usr/bin/re-shell-desktop`, so the hub
  bundle was resolved from `/usr/lib/Re-Shell/hub/`), passed all of:
  - the app started its own hub on a free `127.0.0.1` port and logged the port
    and pid;
  - an unauthenticated `GET /health` returned 401 (token enforced);
  - `ss` showed the hub listening on `127.0.0.1` only;
  - the hub's access log recorded `OPTIONS /events -> 204` and
    `GET /events -> 200` with `origin=tauri://localhost`, i.e. the webview
    reached the hub with the token and was never answered 401;
  - the screenshot showed the dashboard rendered with its fonts, "Hub online" and
    real `demo-monorepo` data (apps, services, health score) fetched through the
    hub from the built CLI;
  - after `SIGTERM`, after `SIGKILL`, and after closing the window, the hub
    process and its port were gone; closing the window exited with status 0;
  - with `RE_SHELL_NODE=/nonexistent/node` the app logged the failure, showed the
    error page, and exited with status 1 when that window was closed.
- **The AppImage** launched, started its hub and the webview made authenticated
  requests (`APPIMAGE_EXTRACT_AND_RUN=1`, no FUSE here). The smoke script's own
  shutdown checks are not meaningful for it: `$!` is the AppImage runtime
  wrapper, so signalling it does not signal the app inside.
- A hub killed under a running window produced the red "The local Re-Shell hub
  stopped" banner over the dashboard (screenshot) and a stderr line.
- **Tests:** `cargo test --locked` in `apps/web/src-tauri`: 28 unit tests and 10
  integration tests (`tests/hub_lifecycle.rs`, against the real
  `dist/hub-server.js` under real Node: loopback bind, token required, distinct
  port/token per launch, origin allowlist wiring, stop-on-drop, a SIGKILLed
  owner leaving no orphan, crash/timeout/port-conflict-retry/missing-input
  failures). `pnpm --filter @re-shell/dashboard test`: 27 hub tests (including
  `tests/hub-desktop.test.ts`) and 137 UI tests pass; `typecheck` passes.
  `shellcheck` and `actionlint` are clean for the smoke script and the workflow.

Rendering under Xvfb needs `WEBKIT_DISABLE_COMPOSITING_MODE=1
WEBKIT_DISABLE_DMABUF_RENDERER=1` (no GPU); the smoke script sets them. Real
desktops do not need them.

## 6. Not done, and known limitations

- **macOS and Windows** bundles are built only by CI; they were not built or run
  here. The `desktop` workflow builds the Linux, macOS and Windows bundles and runs the
  Rust tests, and passes on PR #395 (commit `3207b9f`); nobody has launched the macOS
  or Windows app. The loopback ATS exception in `src-tauri/Info.plist` and the Windows
  thumbprint flow follow Tauri's documented mechanisms but are unexercised. The
  signing and notarization path has not been run with real certificates, so no
  claim of a signed build is made until a workflow run with the secrets succeeds.
- **The GitHub workflow** was linted with `actionlint` and has now run on GitHub:
  it passes on PR #395 (commit `3207b9f`), unsigned. Its first hosted runs caught a
  free-port race in the desktop test and `node-pty` moving to 1.1.0 (N-API, prebuilt on
  Windows); both are fixed.
- No bundled Node runtime and no in-app workspace picker (use `--workspace` /
  `RE_SHELL_WORKSPACE`).
- No in-app auto-update (updater signatures are produced when the key exists).
- The hub is not restarted if it dies; the app reports it and must be reopened.
- `.rpm` was built but not installed.
