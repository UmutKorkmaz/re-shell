---
title: "Core Concepts"
description: "Monorepo workspaces, microfrontends vs microservices, and the hardened local hub."
---

Re-Shell is **one product with two surfaces**: a CLI you script in your terminal
and CI, and a web dashboard you open locally. Both surfaces read from the same
typed contract, so what you see in the browser is exactly what the CLI emits.

## Workspaces

A Re-Shell project is a **monorepo workspace** — a single repository containing
many packages, apps, and services. `re-shell init` lays one down with:

- A package-manager workspace file (`pnpm-workspace.yaml`, npm/yarn workspaces,
  or bun).
- An optional declarative `re-shell.workspaces.yaml` (the **v2** schema) that
  describes apps and services, their frameworks, and their relationships.
- A dependency graph engine with cycle detection and topology health checks.

The [`workspace`](/re-shell/cli/workspace/) command group is your control panel:
`summary`, `health`, `graph`, `drift`, `policy`, and the Nx/Turbo importer
(`migrate-monorepo`).

```bash
re-shell workspace summary --json   # root, packageManager, workspaces, graph, health
re-shell workspace graph --format mermaid
```

## Microfrontends + microservices, unified

Re-Shell deliberately spans both halves of the stack from one tool:

- **Microfrontends** — Module-Federation frontends in React, Vue, Svelte, and
  Angular. Add them with `re-shell add`, list them with `re-shell list`, and
  serve them with `re-shell serve`.
- **Microservices** — polyglot backends across 36 languages (Node, Python, Go,
  Rust, .NET, Java, PHP, Ruby, and many more). Scaffold them from the
  [template catalog](/re-shell/templates/catalog/) or with
  [`generate backend`](/re-shell/cli/generate/).

Because both live in one workspace, the dependency graph, health checks, and
policy packs cover the whole application — not just the frontend or just the
backend.

```bash
re-shell create storefront --microfrontend --framework react-ts
re-shell generate backend orders --framework fastapi --language python
re-shell service bridge generate   # typed cross-language client between them
```

## The JSON contract

Every command that accepts `--json` emits a single-line envelope:

```json
{ "ok": true, "data": { "...": "..." }, "warnings": [] }
```

…or, on failure:

```json
{ "ok": false, "error": { "code": "WORKSPACE_NOT_FOUND", "message": "..." }, "warnings": [] }
```

The envelope and the closed set of `ErrorCode`s are defined once, as zod schemas,
in [`@re-shell/contracts`](/re-shell/architecture/contracts-package/). The CLI
imports them; the dashboard imports them. That single source of truth is why you
can script Re-Shell without scraping human-readable output. Read the full spec in
the [JSON Contract](/re-shell/contract/json-contract/) page.

## The hardened local hub

When you run [`re-shell ui`](/re-shell/dashboard/overview/), the CLI starts a
small bridge — the **hub** — that the browser dashboard talks to. The hub is
built to be safe by construction:

- **Loopback only.** Hard-pinned to `127.0.0.1`; any caller-supplied host is
  ignored, so it is never reachable off-host.
- **Token authenticated.** A per-run session token is enforced on every HTTP
  route and WebSocket upgrade, with constant-time comparison.
- **Allow-listed.** The hub never builds arbitrary argv. A static
  command-registry decides which `commandId`s are permitted, and arguments are
  passed as literal argv tokens — no shell, so no command injection.
- **Origin/Host checked.** WebSocket upgrades are validated against loopback Host
  names to defend against DNS rebinding.

The full design is in the [Secure Hub](/re-shell/architecture/secure-hub/) page.

## How it fits together

```
┌──────────────┐        typed { ok, data, warnings }        ┌──────────────┐
│  re-shell    │ ─────────────────────────────────────────▶ │  your CI /   │
│  CLI         │                                             │  scripts     │
└──────┬───────┘                                             └──────────────┘
       │ spawns (no shell), allow-listed
       ▼
┌──────────────┐   token + 127.0.0.1   ┌────────────────────────────────────┐
│  local hub   │ ◀───────────────────▶ │  mission-control dashboard (browser)│
└──────────────┘   SSE /events, WS     └────────────────────────────────────┘
```

## Next steps

- [Quickstart](/re-shell/getting-started/quickstart/) — do it hands-on.
- [Architecture: Monorepo](/re-shell/architecture/monorepo/) — the packages.
- [CLI Reference](/re-shell/cli/overview/) — the full command surface.
