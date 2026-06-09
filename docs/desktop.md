# Tauri Desktop Shell (P9-K) — Spec & Scaffold

> **ENV-LIMITED SCAFFOLD.** This adds a Tauri v2 desktop wrapper around the
> existing `apps/web` dashboard. The scaffold files are **structurally valid but
> NOT built or signed in this environment** — building requires the Rust **and**
> Tauri toolchain. In this environment `cargo` is present but the **`tauri` CLI
> is absent**, so no build/dev/sign step is run. Structural validation (JSON +
> TOML parse) is performed instead; see §4.

## 1. What it is

A thin native shell: a Tauri window that loads the **already-built** Re-Shell
dashboard (`apps/web/dist`). The dashboard behaves identically to the browser —
it talks to the local hub over HTTP/WS exactly as before. No new Rust commands or
privileged bridges are introduced; the desktop app is a packaging layer, not a
new trust surface.

```
apps/web/src-tauri/
├── tauri.conf.json        # app config: window, CSP, frontendDist → ../dist
├── Cargo.toml             # Rust crate manifest (tauri v2 deps)
├── build.rs               # standard tauri-build script
├── capabilities/
│   └── default.json       # minimal core:default permission set
├── src/
│   ├── main.rs            # binary entrypoint → lib::run()
│   └── lib.rs             # tauri::Builder app (wraps the dashboard)
├── icons/                 # icon assets (placeholder; generate via `tauri icon`)
└── .gitignore             # ignores /target, Cargo.lock, /gen
```

## 2. How it wraps the dashboard

- `tauri.conf.json` → `build.frontendDist: "../dist"` points the production
  window at the Vite build output (`apps/web/dist`).
- `build.beforeBuildCommand` runs `pnpm --filter @re-shell/dashboard run build`
  so the dashboard is built before bundling.
- `build.beforeDevCommand` + `devUrl: http://localhost:5173` run the Vite dev
  server for `tauri dev`.
- The CSP allows `connect-src` to `http://127.0.0.1:*` and `ws://127.0.0.1:*` so
  the embedded dashboard can reach the local hub.

### Hub lifecycle

The desktop shell does **not** own the hub. As in the browser flow, the hub is
launched and torn down by the CLI (`re-shell ui`) / Vite dev plugin. The window
just renders the dashboard and connects to whatever hub URL/port is in the
environment. A future enhancement could have the Rust side spawn the hub as a
Tauri sidecar; that is intentionally out of scope for this scaffold.

## 3. npm scripts

Added to `apps/web/package.json`:

| Script             | Command       | Purpose                                  |
| ------------------ | ------------- | ---------------------------------------- |
| `tauri`            | `tauri`       | Raw passthrough to the Tauri CLI.        |
| `tauri:dev`        | `tauri dev`   | Build dashboard + launch dev window.     |
| `tauri:build`      | `tauri build` | Build + bundle the desktop installer.    |

Run from the repo root, e.g. `pnpm --filter @re-shell/dashboard tauri:dev`.

## 4. Toolchain & build/sign (NOT run here)

Building/signing requires:

1. **Rust toolchain** (`rustup`, `cargo` ≥ 1.77.2). `cargo` IS present in this
   environment.
2. **Tauri CLI** — install once: `pnpm add -D @tauri-apps/cli` (or
   `cargo install tauri-cli`). **Absent here**, so no build/dev was attempted.
3. **Platform SDKs** — Xcode (macOS / `.dmg`, `.app`), WebView2 + MSVC
   (Windows / `.msi`, `.exe`), `libwebkit2gtk` + friends (Linux / `.deb`,
   `.AppImage`).
4. **Icons** — generate with `pnpm --filter @re-shell/dashboard tauri icon
   source.png` (placeholders only are committed).

### Code signing (deployment concern, not done here)

- **macOS:** Developer ID certificate + notarization
  (`APPLE_CERTIFICATE`, `APPLE_ID`, `APPLE_PASSWORD`/notary keys via env/secrets).
- **Windows:** Authenticode certificate.

Never hardcode signing secrets — supply them via CI secrets / a secret manager.

## 5. Structural validation performed

Because the toolchain cannot build here, the scaffold is validated structurally:

- `tauri.conf.json` parses as JSON and contains the expected keys
  (`productName`, `identifier`, `build.frontendDist`, `build.beforeBuildCommand`,
  `app.windows`, `app.security.csp`, `bundle.active`). ✅
- `capabilities/default.json` parses as JSON with `identifier` + `permissions`. ✅
- `Cargo.toml` parses as TOML and `cargo verify-project --offline` reports
  `{"success":"true"}`; `cargo read-manifest` reads name/version/edition. ✅
  (Metadata-only — **no compilation, no dependency download, no build.**)

## 6. What is validated vs scaffold-only

- **Validated here:** JSON validity + required keys of `tauri.conf.json` and the
  capability file; TOML validity of `Cargo.toml` via `cargo verify-project` /
  `read-manifest`; presence of `main.rs`, `lib.rs`, `build.rs`, and the npm
  scripts.
- **Scaffold-only / NOT done here:** `cargo`/`tauri` compilation, `tauri dev`,
  `tauri build`, icon generation, and code signing/notarization — all require
  the full Rust + Tauri toolchain (Tauri CLI absent in this environment).
