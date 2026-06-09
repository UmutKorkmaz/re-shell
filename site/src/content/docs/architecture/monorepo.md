---
title: "Monorepo"
description: "How the cli, ui, contracts, and dashboard packages fit together — one product, two surfaces, one contract."
---

Re-Shell is **one product with two surfaces** — a CLI and a web dashboard — built
from a small set of packages in a single monorepo. The packages are deliberately
layered so that the wire shapes crossing every process boundary are defined once
and shared everywhere.

## The packages

| Package | npm | Role |
| --- | --- | --- |
| **`@re-shell/cli`** | [`@re-shell/cli@0.29.2`](https://www.npmjs.com/package/@re-shell/cli) | The CLI you install globally. Bundles the dashboard SPA, the hub server, and the templates registry. This is the only package end users install. |
| **`@re-shell/ui`** | `@re-shell/ui@0.3.0` | The shadcn-based React component system (design tokens, primitives, and the dashboard's domain components). |
| **`@re-shell/contracts`** | `@re-shell/contracts@0.1.0` | The single source of truth: zod schemas + TS types for every shape that crosses a CLI ↔ UI boundary. |
| **Dashboard app** | (bundled) | The React dashboard (`apps/web`) that `re-shell ui` serves. Shipped prebuilt inside the CLI. |

```
@re-shell/contracts   ← schemas + types (zod)
        ▲   ▲
        │   │
@re-shell/cli   @re-shell/ui ──► dashboard app
        │                              ▲
        └──────── re-shell ui ─────────┘
                 (serves bundled SPA +
                  token-authed hub on 127.0.0.1)
```

## One contract, two consumers

The defining design choice: the **CLI emits** the
[typed JSON envelope](/re-shell/contract/json-contract/) and the **dashboard
consumes** it — both validate against the *same* zod schemas from
[`@re-shell/contracts`](/re-shell/architecture/contracts-package/). Because the TS
types are derived from those schemas via `z.infer`, the producer and the consumer
cannot drift. What you see in the browser is exactly what the CLI prints in
`--json` mode.

## Everything ships in one install

```bash
npm install -g @re-shell/cli
```

That single package contains:

- The full CLI (500+ commands across the command groups).
- The 205-template scaffolding registry.
- The prebuilt dashboard SPA + the static server (`re-shell ui`).
- The token-authenticated hub server.

There is no separate dashboard install, no service to run, and no network
dependency beyond the registry download — the platform is offline-first.

## How a request flows

1. You run `re-shell ui`. The CLI serves the bundled dashboard on `127.0.0.1`
   and starts the [hub](/re-shell/architecture/secure-hub/) with a per-launch
   token.
2. In the browser, the Command Builder builds an **allow-listed** command
   (`commandId` + opaque `params`) — never raw argv.
3. The hub resolves it against its registry and spawns the CLI **without a
   shell**.
4. The CLI emits the [JSON envelope](/re-shell/contract/json-contract/); output
   streams back over SSE/WS, validated against the contract on both ends.

## See also

- [Contracts Package](/re-shell/architecture/contracts-package/) — the shared schemas.
- [Secure Hub](/re-shell/architecture/secure-hub/) — the CLI ↔ UI bridge.
- [Dashboard](/re-shell/dashboard/overview/) — the second surface.
- [Core Concepts](/re-shell/getting-started/concepts/).
