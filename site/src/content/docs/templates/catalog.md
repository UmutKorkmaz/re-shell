---
title: "Template Catalog"
description: "The full catalog of 205 templates across 36 languages and 171 frameworks — grouped by language with the real per-language counts."
---

Re-Shell ships **205 production-grade templates** spanning **36 languages** and
**171 frameworks**. Every template is a real, scaffoldable service with sensible
defaults (routing, validation, Docker, testing, and more). Browse and preview
them entirely offline with the [`templates`](/re-shell/cli/templates/) command
group, or visually in the [dashboard](/re-shell/dashboard/overview/).

```bash
re-shell templates list                  # all 205
re-shell templates list --language rust  # filter by language
re-shell templates show express          # details for one
re-shell templates apply express --name billing   # dry-run preview
```

> These counts are generated from the live registry
> (`re-shell templates list --json` / `re-shell templates matrix --json`) at CLI
> `0.29.2`. The catalog grows over time; the CLI is always the source of truth.

## By language

| Language | Templates |
| --- | ---: |
| TypeScript | 74 |
| JavaScript | 21 |
| C# | 12 |
| Python | 7 |
| C++ | 7 |
| Go | 6 |
| Rust | 4 |
| Java | 4 |
| PHP | 4 |
| Lua | 4 |
| Swift | 4 |
| Kotlin | 4 |
| Haskell | 4 |
| Clojure | 4 |
| ReScript | 4 |
| Ruby | 3 |
| Dart | 3 |
| Scala | 3 |
| Elixir | 3 |
| Crystal | 3 |
| Nim | 3 |
| F# | 3 |
| Perl | 3 |
| Zig | 2 |
| V | 2 |
| Julia | 2 |
| OCaml | 2 |
| Mojo | 2 |
| Gleam | 1 |
| Odin | 1 |
| Pony | 1 |
| Red | 1 |
| Grain | 1 |
| Roc | 1 |
| Ballerina | 1 |
| Unison | 1 |
| **Total** | **205** |

## Frameworks (selected)

171 frameworks are represented. A sampling across ecosystems:

- **TypeScript / JavaScript** — Express, Fastify, NestJS, Koa, Hono, Elysia,
  AdonisJS, FeathersJS, LoopBack, Restify, Sails.js, Ts.ED, Middy, Moleculer,
  Apollo, GraphQL Yoga, Meteor.js, Strapi.
- **Python** — FastAPI, Django, Flask, Sanic, Starlette, Tornado.
- **Rust** — Actix-Web, Axum, Rocket, Warp.
- **Go** — Gin, Echo, Fiber, Chi, gRPC.
- **Java / Kotlin / Scala** — Spring Boot, Micronaut, Quarkus, Vert.x, Ktor,
  http4k, Play, Akka HTTP, http4s.
- **C# / .NET** — ASP.NET Core (Minimal, Web API, EF Core, Dapper, JWT, Swagger,
  Serilog, xUnit), Blazor Server.
- **Elixir** — Phoenix, Plug.
- **Ruby** — Rails, Sinatra, Grape.
- **PHP** — Laravel, Symfony, Slim, CodeIgniter.
- **Haskell / OCaml / F#** — Yesod, Servant, Scotty, Spock, Dream, Opium,
  Giraffe, Suave, Saturn.
- **Infrastructure** — Docker, Docker Compose, Kubernetes, Nginx, Traefik,
  HAProxy, Envoy, Istio, Linkerd, Consul, Vault, Kong, Redis, PostgreSQL,
  MongoDB, MySQL, Elasticsearch, Neo4j, InfluxDB.

Run `re-shell templates matrix` for the complete, current list — see the
[Compatibility Matrix](/re-shell/templates/matrix/).

## What a template descriptor looks like

```bash
re-shell templates show express --json
```

```json
{
  "ok": true,
  "data": {
    "id": "express",
    "displayName": "Express.js",
    "language": "typescript",
    "framework": "express",
    "version": "4.19.2",
    "tags": ["nodejs", "express", "api", "rest", "middleware", "typescript"],
    "features": ["middleware", "routing", "cors", "authentication", "validation"],
    "port": 3000,
    "fileCount": 27
  },
  "warnings": []
}
```

## Preview before you scaffold

`templates apply` is a **dry-run** that computes the exact file set a scaffold
would produce — names, sizes, per-file preview — without writing anything:

```bash
re-shell templates apply express --name billing
```

```
🔍 Dry run: express → "billing"

Would create 27 files (39040 bytes). Nothing written.

  + package.json (2360b)
  + src/index.ts (2915b)
  + src/controllers/auth.controller.ts (3328b)
  + src/routes/index.ts (608b)
  + tsconfig.json (966b)
  ...
```

To actually write a service, use [`generate backend`](/re-shell/cli/generate/) or
[`create`](/re-shell/cli/generate/#create-and-related-commands).

## See also

- [`templates` command reference](/re-shell/cli/templates/).
- [Compatibility Matrix](/re-shell/templates/matrix/) — databases, caches, deploy targets.
- [JSON Contract](/re-shell/contract/json-contract/) — the `templates list` / `show` payloads.
