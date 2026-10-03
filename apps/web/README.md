# @re-shell/dashboard

The Re-Shell dashboard. A React (Vite) single-page app that the CLI launches with
`re-shell ui`, fronted by a token-authed **hub-server** that runs a vetted slice of the
CLI. It is built entirely from shadcn-React components in
[`@re-shell/ui`](../../packages/ui); there is **no Web Components layer**. The same
bundle is also the front end of the Tauri desktop app in `src-tauri/`.

> Part of the [Re-Shell monorepo](https://github.com/UmutKorkmaz/re-shell). See
> [`/docs`](../../docs) for the documentation index. The hub transport schemas
> (SSE `/events`, WS `/jobs`) are defined in
> [`@re-shell/contracts`](../../packages/contracts); `docs/CLI-CONTRACTS.md` covers the
> CLI envelopes the hub forwards, not the transport.

## Screens

The shell renders **11 screens** (the list is `SCREENS` in `src/shell/screens.ts`; each
is addressed by `?screen=<id>`):

| Screen (id) | What it shows |
|-------------|---------------|
| Overview (`overview`) | Workspace summary and topology at a glance (bento layout). |
| Workspace Graph (`graph`) | The dependency graph explorer: search and facet filters (kept in the URL), shortest dependency paths, cycle highlighting, graph diff against a git ref or file, live status, six exports (PNG, SVG, PDF, Mermaid, D3 JSON, JSON); virtualized, exercised with a 2001-workspace fixture. |
| Templates (`templates`) | Browse and scaffold from the template catalog. |
| Command Builder (`commands`) | Compose and preview vetted CLI commands. |
| Assistant (`assistant`) | Ask in plain language; the assistant resolves it to a single allow-listed hub command and streams the result. |
| Jobs & Logs (`jobs`) | Live job output streamed from the hub (master/detail). |
| Health (`health`) | Workspace health checks and diagnostics. |
| Scorecard (`scorecard`) | Weighted production-readiness grades per service and a monorepo rollup. |
| Catalog (`catalog`) | Auto-discovered software catalog with Backstage interop. |
| Collaboration (`collab`) | Pair live on the hosted control plane: shared console, presence with WebRTC links (relay fallback), shared editor, team analytics. Needs a running control plane; none is deployed. |
| Settings (`settings`) | Hub connection and dashboard preferences. |

Screens are code-split; `pnpm --filter @re-shell/dashboard run budget` enforces gzip
budgets per chunk (`perf-budgets.json`).

## The hub-server (security)

`src/hub-server.ts` is a small Node server that gives the browser a safe window onto
the CLI. It does **not** expose an arbitrary shell:

- **Bound to `127.0.0.1`** (and validates the `Host` header against the expected port to
  defeat DNS rebinding). `re-shell ui` pins the hub URL to loopback and fails if the hub
  does not become healthy.
- **Per-launch session token**: `re-shell ui` mints 32 random bytes and passes them to
  both the hub and the dashboard. Every request is checked with a constant-time
  comparison.
  - HTTP: token via the `x-re-shell-ui-hub-token` header or a `?token=` query param.
  - WebSocket: token smuggled through the `Sec-WebSocket-Protocol` header
    (`re-shell-token.<token>`).
- **Exact-origin allow-list** (`RE_SHELL_UI_HUB_ALLOWED_ORIGINS`; wildcards are dropped).
- **Transport**: SSE `/events` for streamed state, WS `/jobs` for live job output. Both
  validate payloads against the zod schemas in `@re-shell/contracts`.
- **Allow-list**: only commands in the shared registry
  (`@re-shell/contracts/command-registry`) can run: `workspace.summary`,
  `workspace.graph`, `workspace.health`, `workspace.status`, `workspace.graph.diff`
  (git refs are validated before anything runs), `templates.list`, `templates.show`,
  `scorecard`, `commands.list`, `doctor`, `analyze` and `run`.

## Branding

The dashboard honours white-label config at build time and at `re-shell ui` serve
time: `re-shell.whitelabel.json` (or `.re-shell/whitelabel.json`, or the file named by
`RE_SHELL_WHITE_LABEL_FILE`) and `RE_SHELL_BRAND_NAME`, `_TAGLINE`, `_LOGO`, `_FAVICON`,
`_ACCENT`. Theme packs are managed with `re-shell ui theme ...`.

## Desktop (Tauri)

`src-tauri/` wraps the dashboard in a native window that **owns its hub** (free
`127.0.0.1` port, per-launch token, stops the hub on exit). Linux `.deb`, `.rpm` and
`.AppImage` bundles were built and smoke-tested under Xvfb; macOS and Windows bundles
are produced only by the `desktop` workflow, and signed builds only with CI secrets.
Full details, requirements and the list of what was not verified: [`docs/desktop.md`](../../docs/desktop.md).

## Local development

```bash
# Dashboard dev server (Vite)
pnpm --filter @re-shell/dashboard dev

# Production build (app + bundled hub-server, dist/hub-server.js)
pnpm --filter @re-shell/dashboard build

# Unit tests (hub + UI suites), typecheck, bundle budgets
pnpm --filter @re-shell/dashboard test
pnpm --filter @re-shell/dashboard typecheck
pnpm --filter @re-shell/dashboard run budget

# Browser tests (Playwright; needs `pnpm -r build` and a Chromium)
cd apps/web
npx playwright test --project=chromium     # core flow, keyboard, theming, jobs, collaboration
npx playwright test --project=a11y         # axe audit of every screen, both themes
npx playwright test -c playwright.graph.config.ts   # 2001-node graph explorer scale spec

# Desktop
pnpm --filter @re-shell/dashboard tauri:dev
```

In normal use you do not run these directly: `re-shell ui` launches the app and the hub
together. Use `re-shell ui --dry-run` (or `--json`) to print the launch plan.

## Component boundary

The dashboard consumes the component library through its public entry points:

```ts
import { WorkspaceSummaryPanel } from '@re-shell/ui';
import '@re-shell/ui/styles.css';
```

Keep that boundary intact so the dashboard stays decoupled from the library internals.
