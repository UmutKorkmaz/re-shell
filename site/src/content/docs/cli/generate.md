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

The top-level `create`, `add`, and `init` commands also scaffold, at the project
and microfrontend level:

```bash
# A new project (full-stack, polyglot, or microfrontend)
re-shell create acme --fullstack --frontend react-ts --backend express --db prisma
re-shell create gateway --polyglot
re-shell create storefront --microfrontend --framework vue-ts

# Add a microfrontend to an existing project
re-shell add checkout --route /checkout --port 5174

# Preview without writing
re-shell create acme --fullstack --dry-run --json
```

`create --dry-run --json` emits the exact file set as a contract envelope — the
same dry-run discipline as [`templates apply`](/re-shell/cli/templates/).

## See also

- [templates](/re-shell/cli/templates/) — discover what to scaffold.
- [Template Catalog](/re-shell/templates/catalog/) — all 205 frameworks.
- [service & bridge](/re-shell/cli/service-bridge/) — connect polyglot services.
