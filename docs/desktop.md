# Re-Shell Desktop (Tauri)

A native desktop window around the Re-Shell dashboard (`apps/web`). Unlike the
browser flow (`re-shell ui`), the desktop app **owns its hub**: it starts the
local hub-server itself, hands the dashboard its address and session token at
runtime, and stops the hub when it exits.

> **Status.** Desktop hardening adds a native workspace picker, manual hub
> recovery, a checksum-verified bundled Node runtime, and a signed in-app updater.
> These changes still require the checks in [Current verification](#6-current-verification-and-release-gaps).
> The older Linux evidence below predates these changes and is retained as history.
> Signing keys, public updater key/feed, certificates, notarization and installed
> cross-platform acceptance are separate release requirements.

## 1. How it works

```
apps/web/src-tauri/
├── tauri.conf.json        # window (created in code), CSP, bundle + hub resource
├── Cargo.toml / Cargo.lock
├── build.rs
├── capabilities/default.json   # core:default only; native actions have no webview IPC permission
├── icon-source/           # 1024px source icon + generator (Pillow)
├── icons/                 # generated png / ico / icns
├── scripts/smoke-linux.sh # launches the built binary under xvfb and checks it
├── scripts/prepare-node.mjs # stages pinned, SHA-256-verified Node sidecars
├── binaries/             # generated Node sidecars (ignored, never committed)
├── runtime/              # generated Node license and version metadata
├── src/
│   ├── main.rs
│   ├── lib.rs             # startup, window creation, shutdown
│   ├── hub.rs             # spawn/wait/stop the hub, Node discovery, token, port
│   └── webview.rs         # init script, per-launch CSP, navigation guard, error page/banner
└── tests/hub_lifecycle.rs # integration tests against the real hub bundle
```

### Startup sequence

1. **Find Node.js.** `RE_SHELL_NODE` (exclusive when set), then the packaged
   `re-shell-node` sidecar beside the desktop executable. Debug builds may use
   the staged sidecar in `src-tauri/binaries`. Without a sidecar, fall back to
   `PATH`, then the
   usual install directories that GUI launchers leave off `PATH` (Homebrew,
   `/usr/local/bin`, Volta, the newest nvm, `Program Files\nodejs`). `node
   --version` must be **18 or newer**.
2. **Find the hub bundle.** `RE_SHELL_HUB_BUNDLE` (exclusive when set), then
   `hub/hub-server.js` in the app's resource directory (the dashboard build's
   `dist/hub-server.js` is bundled there by `tauri.conf.json`), then, in debug
   builds only, `apps/web/dist/hub-server.js`.
3. **Pick the workspace** the hub is rooted in: `--workspace <dir>`, then
   `RE_SHELL_WORKSPACE`, then the last workspace opened successfully through the
   native picker (`~/.re-shell/desktop-workspace.json`), then the launch directory
   (the home directory when the
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
- Native menu actions use the Rust dialog/updater APIs. The webview receives
  no dialog/updater IPC permissions; its capability set remains `core:default`.
  Recovered windows receive the same navigation guard and CSP.
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
shown over the dashboard and the event is logged to stderr. Choose **Re-Shell →
Restart Local Hub** to recover. Recovery stops the old hub, starts a new one on
the same port, verifies authenticated readiness, rotates the token, and replaces
the dashboard window. Its CSP remains pinned to that port. Running jobs may
have stopped; recovery does not automatically retry them. Port conflicts and
restart failures stay visible and can be retried from the menu. Initial startup
failures still require correcting the error and reopening the app.

## 2. Requirements at runtime

| Need | Why | Override |
| ---- | --- | -------- |
| Bundled **Node.js 22.23.3** | the hub uses a pinned, verified runtime; a system Node installation is optional for desktop startup | `RE_SHELL_NODE=/path/to/node` |
| **The `re-shell` CLI** (`npm i -g @re-shell/cli`) | the hub runs vetted CLI commands; the app puts Node's directory first on the hub's `PATH` so a global install next to `node` is found | `RE_SHELL_CLI_BIN=/path/to/re-shell` |
| A workspace directory | the root the hub (and the CLI jobs it spawns) are contained to | `--workspace <dir>` / `RE_SHELL_WORKSPACE` |

Without the CLI the app and hub still start (health and transport work); only
jobs that need the CLI fail, with the spawn error shown in the dashboard.

### Native actions

The **Re-Shell** menu provides **Open Workspace…**, **Restart Local Hub** and
**Check for Updates…**. Selecting a folder replaces the authenticated hub and
window after readiness succeeds; cancellation leaves the workspace unchanged.
A successful selection is remembered for later launches. Explicit command-line
or environment workspace settings retain precedence.

**Check for Updates…** requires a public verification key and an HTTPS feed
compiled into the app. An unconfigured build explains that updates are
unavailable. A configured build checks for a newer version, asks before installing,
verifies the artifact signature through Tauri, then stops the hub and restarts.
Windows installer shutdown also stops the owned hub. Updates are never installed
without the confirmation dialog. Linux in-app updates apply to AppImage;
DEB/RPM installations use manual package upgrades.

The Node runtime is staged by `scripts/prepare-node.mjs`. Downloads are pinned to
22.23.3 and checked against committed SHA-256 digests from the official Node
release. The Node license is included. macOS builds merge arm64 and x64 Node into
a universal executable; Tauri bundles it as a sidecar so its normal Developer ID
signing path covers the runtime as well as the app. Linux and Windows have x64
runtime targets. Node security updates require an explicit version/hash update.

The bundled runtime covers the hub. The CLI remains a separate installation;
when no system `node` exists, point `RE_SHELL_CLI_BIN` at the installed CLI's
`dist/index.js` so the hub runs it with its own Node interpreter. Executables
that depend on a system `node` shebang still require a compatible system setup.

## 3. Develop and build

Prerequisites: Rust (stable, 1.90+), Node 22, pnpm 9.15.9 and, on Linux, the
Tauri system packages:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev \
  librsvg2-dev patchelf libssl-dev build-essential libgtk-3-dev \
  libsoup-3.0-dev libjavascriptcoregtk-4.1-dev
```

```bash
pnpm install --frozen-lockfile
pnpm --filter @re-shell/dashboard... run build   # contracts, ui, dashboard and hub
node apps/web/src-tauri/scripts/prepare-node.mjs # stages runtime for this host
# macOS universal release: pass darwin-universal; CI stages it automatically

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

For pull requests/manual builds, signing is **optional and secret-driven**.
For `desktop-v*` release tags, the workflow fails unless the updater signing
key, public verification key, HTTPS feed and platform signing credentials exist.
macOS release tags also require notarization credentials. Releases remain drafts
until installed-app acceptance is complete. A "Detect code-signing credentials"
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

The workflow also reads two **repository variables** (public configuration):

| Variable | Purpose |
| -------- | ------- |
| `RE_SHELL_UPDATER_PUBLIC_KEY` | Tauri public verification key matching the updater signing private key |
| `RE_SHELL_UPDATER_ENDPOINT` | HTTPS desktop-only update manifest URL compiled into the app |

`tauri-action` writes `latest.json` when signed updater artifacts are available.
Use a desktop-only feed: the repository also publishes CLI releases, so a generic
GitHub `releases/latest` URL may select the CLI release instead of the desktop
release. Publish the desktop manifest to the configured feed only after the
signed draft and installed smoke tests pass. No private signing keys are generated
or committed by this implementation. The public/private key match and feed
contents must be checked with an actual signed update before a public release.

## 5. Historical verification before desktop hardening

The following evidence predates the native menu, bundled runtime and updater
changes. It is not proof that the current desktop candidate passes.

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

## 6. Current verification and release gaps

Local macOS verification of the hardening candidate:

- Built and launched an **unsigned debug `.app`** with its bundled Node 22.23.3
  sidecar and hub resource. The universal Node executable was separately checked
  for arm64 + x64 slices; the full app was built for the local arm64 host.
- Rendered the packaged `tauri://localhost` dashboard against a controlled
  `demo-monorepo` fixture, showing two apps, one service and **Hub online**.
- Opened the native workspace picker, cancelled it (workspace unchanged), then
  selected a copied temporary fixture. A new authenticated hub reused the same
  port with a new process/token, the dashboard changed workspace, and the selected
  path was remembered. The prior saved workspace preference was restored after QA.
- Killed the owned hub with SIGKILL: the dashboard displayed the failure banner
  and recovery instruction. The native **Restart Local Hub** action created a new
  hub and dashboard, removed the banner and restored **Hub online** with the same
  fixture. An unauthenticated health request to the recovered hub returned 401;
  its listener remained bound to `127.0.0.1`.
- **Check for Updates…** displayed the native *Updates unavailable* sheet for the
  unconfigured build. Native accessibility text confirmed its explanation;
  ScreenCaptureKit could not capture that modal sheet. Dashboard/crash/recovery
  screenshots rendered successfully.
- Closing the app stopped its owned hub. Picker/recovery/notice checks used QA
  CLI/workspace overrides; this is local debug app evidence, not a signed installer
  or a real signed updater installation.

The final source passed Rust check, clippy with warnings denied, formatting and
the full locked test suite: **32 unit tests + 10 macOS integration tests (42 total)**.
Linux also runs its orphan-protection integration test.
The older Linux results above remain historical evidence.

Release requirements still outstanding:

- Real Apple Developer ID certificate/notarization credentials, Windows signing
  certificate, and updater signing key. No signed release is claimed.
- Public verification key and a desktop-only HTTPS updater feed. Exercise a real
  signed update and reject a tampered signature before declaring updates ready.
- Signed release installer acceptance on macOS and Windows, plus current Linux
  smoke evidence for switching workspaces, cancelling the picker, recovering a
  killed hub, token rotation, runtime discovery without system Node, and shutdown
  cleanup. Local unsigned macOS debug app checks above do not replace these gates.
- Run the workflow for this candidate; verify universal macOS and Windows
  sidecar packaging/signing. A historical workflow pass is insufficient.
- RPM installation remains unverified.

The control plane can be validated against a local Docker staging environment;
this does not substitute for desktop signing or hosted-provider acceptance.
