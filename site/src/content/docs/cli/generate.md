---
title: "generate"
description: "Scaffold components, hooks, services, backends, and full features."
---

The `generate` group scaffolds code into an existing workspace: frontend
components and hooks, service classes, test suites, documentation, backend
services, and complete full-stack features.

```bash
re-shell generate --help
```

| Subcommand | Purpose |
| --- | --- |
| `component <name>` | Generate a new component. |
| `hook <name>` | Generate a React hook. |
| `service <name>` | Generate a service class. |
| `test <workspace>` | Generate a test suite for a workspace. |
| `docs` | Generate project documentation. |
| `backend <name>` | Generate a backend service or API. |
| `feature <name>` (alias `create-feature`) | Create a full-stack feature (CRUD, auth, file-upload, websocket, graphql). |

## `generate backend`

```
Usage: re-shell generate backend [options] <name>

Options:
  --framework <framework>   express, fastapi, django, flask, sanic, tornado,
                            laravel, symfony, slim, codeigniter (default: "express")
  --language <language>     typescript, python, php (default: "typescript")
  --features <features...>  code-quality, celery, redis, type-hints, hot-reload, pytest
  --workspace <workspace>   Target workspace
  --port <port>             Default port for the service (default: "8000")
  --verbose                 Show detailed information
```

```bash
re-shell generate backend billing --framework express --language typescript
re-shell generate backend orders --framework fastapi --language python --features redis pytest
```

Preview the file set first with
[`templates apply <id>`](/re-shell/cli/templates/#templates-apply).

## `generate feature`

Creates a full-stack feature wired across the backend and frontend in one step.

```
Usage: re-shell generate feature [options] <name>

Options:
  --type <type>            crud, auth, file-upload, websocket, graphql, fullstack (default: "crud")
  --backend <framework>    express, fastify, nestjs, etc.
  --frontend <framework>   react, vue, svelte, angular, vanilla (default: "react")
  --language <language>    typescript, javascript, python, go, rust (default: "typescript")
  --database <database>    prisma, typeorm, mongoose, sequelize, none (default: "none")
  --openapi                Include an OpenAPI specification
  --graphql                Use GraphQL instead of REST
  --websockets             Include WebSocket support
  --skip-install           Skip package installation
```

```bash
re-shell generate feature invoices --type crud --backend express --frontend react --database prisma
re-shell generate feature chat --type websocket --frontend vue --language typescript
```

## `generate component` / `hook` / `service`

```bash
re-shell generate component UserCard
re-shell generate hook useDebounce
re-shell generate service PaymentGateway
```

## `generate test` / `docs`

```bash
re-shell generate test storefront
re-shell generate docs
```

## `create` and related commands

The top-level `create`, `add`, and `init` commands scaffold at the project and
microfrontend level. `create` is **non-interactive for every mode**: every prompt has
a default that is used with `--yes`, `--json` or `--dry-run`, or when stdin is not a
terminal, so it never waits for input. A condition that needs a human decision (an
incompatible stack, an existing target) fails with a non-zero exit; pass `--force` to
proceed.

```bash
# A bare create is a react-ts frontend app at apps/web
re-shell create web

# Backend only, frontend only, full stack
re-shell create api --backend express
re-shell create web --frontend react-ts
re-shell create shop --fullstack --db prisma

# Microfrontend (Module Federation): a shell plus remotes
re-shell create hub --microfrontend --remotes cart,search:vue

# Polyglot microservices with a gateway
re-shell create platform --polyglot --gateway traefik --services users:fastapi,orders:express

# An empty workspace skeleton
re-shell create ws --template blank

# Add a microfrontend to an existing project
re-shell add checkout --route /checkout --port 5174
```

| Flag | Purpose |
| --- | --- |
| `--template <id>` | A backend template id, a frontend framework, an architecture template, or `blank`. An unknown id is `TEMPLATE_NOT_FOUND`. |
| `--frontend` / `--framework` / `--backend` / `--db` | Pick the stacks (`templates list` shows the ids). |
| `--fullstack` / `--microfrontend` / `--polyglot` | Project modes. |
| `--gateway <fw>` / `--services <list>` | Polyglot gateway (`express`, `fastify`, `nestjs`, `traefik`, `kong`) and `name:framework,...` services. |
| `--remotes <list>` | Microfrontend remotes as `name[:framework],...`. |
| `--type <type>` | Workspace type for a monorepo package: only `app`, `package`, `lib` or `tool`. |
| `--force` | Overwrite files in an existing target and continue past compatibility warnings. |
| `-y, --yes` | Use defaults and skip prompts (automatic when stdin is not a terminal). |
| `--dry-run` / `--verbose` / `--json` | Preview; `--dry-run --json` emits the exact file set. |

Workspaces created by `create` use the globs `apps/*`, `packages/*`, `libs/*`, `tools/*` and `services/*`, and
`service` is a workspace type alongside `app`, `package`, `lib` and `tool`.

`create --dry-run --json` returns the **exact file set** as a contract envelope, with
per-file sizes, `added/modified/unchanged` status, previews and diffs, and writes
nothing; the human preview goes to stderr. It is the same dry-run discipline as
[`templates apply`](/re-shell/cli/templates/).

```bash
re-shell create api --backend express --dry-run --json | jq '.data.summary'
```

**Skeletons versus runnable apps.** `create` scaffolds real templates (38 files for
`--backend express`), while `generate backend` writes a smaller starter (for Express
only `package.json`, `tsconfig.json` and `src/index.ts`). Whether a given template's
generated project installs, builds and boots is a separate question, answered by
[template verification](/re-shell/templates/catalog/#verification).

## See also

- [templates](/re-shell/cli/templates/) — discover what to scaffold.
- [Template Catalog](/re-shell/templates/catalog/) — all 204 templates.
- [service & bridge](/re-shell/cli/service-bridge/) — connect polyglot services.
