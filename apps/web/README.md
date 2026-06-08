# re-shell-dashboard

The local Re-Shell dashboard. A React (Vite) single-page app that the CLI launches
with `re-shell ui`, fronted by a token-authed **hub-server** that proxies a vetted
slice of the CLI. It is built entirely from shadcn-React components in
[`re-shell-ui`](../../packages/ui) — there is **no Web Components layer**.

> Part of the [Re-Shell monorepo](https://github.com/umutkorkmaz/re-shell-cli). See
> [`/docs`](../../docs) for the documentation index and
> [`CLI-CONTRACTS.md`](../../docs/CLI-CONTRACTS.md) for the hub transport + contract.

## Screens

The shell renders seven screens (see `src/shell/screens.ts`):

| Screen | What it shows |
|--------|---------------|
| Overview | Workspace summary and topology at a glance. |
| Workspace Graph | Dependency graph across apps and services. |
| Templates | Browse and scaffold from the template catalog. |
| Command Builder | Compose and preview vetted CLI commands. |
| Jobs & Logs | Live job output streamed from the hub. |
| Health | Workspace health checks and diagnostics. |
| Settings | Hub connection and dashboard preferences. |

## The hub-server (security)

`src/hub-server.ts` is a small Node server that gives the browser a safe window onto
the CLI. It does **not** expose an arbitrary shell:

- **Bound to `127.0.0.1`** (and validates the `Host` header against the expected
  port to defeat DNS-rebinding).
- **Per-launch session token** — `re-shell ui` mints 32 random bytes and passes them
  to both the hub and the dashboard. Every request is checked with a constant-time
  comparison.
  - HTTP: token via the `x-re-shell-ui-hub-token` header or a `?token=` query param.
  - WebSocket: token smuggled through the `Sec-WebSocket-Protocol` header
    (`re-shell-token.<token>`).
- **Transport**: SSE `/events` for streamed state, WS `/jobs` for live job output.
  Both validate payloads against the zod schemas in
  [`re-shell-contracts`](../../packages/contracts).
- Only commands resolvable through `src/hub/command-registry.ts` can run.

## Local development

```bash
# Dashboard dev server (Vite)
pnpm --filter re-shell-dashboard dev

# Production build (app + bundled hub-server)
pnpm --filter re-shell-dashboard build

# Tests (hub + UI suites) and typecheck
pnpm --filter re-shell-dashboard test
pnpm --filter re-shell-dashboard typecheck
```

In normal use you do not run these directly — `re-shell ui` launches the app and the
hub together. Use `re-shell ui --dry-run` (or `--json`) to print the launch plan.

## Component boundary

The dashboard consumes the component library through its public entry points:

```ts
import { WorkspaceSummaryPanel } from 're-shell-ui';
import 're-shell-ui/styles.css';
```

Keep that boundary intact so the dashboard stays decoupled from the library internals.
