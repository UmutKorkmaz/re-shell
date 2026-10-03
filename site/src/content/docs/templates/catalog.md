---
title: "Template Catalog"
description: "The full catalog of 208 backend templates across 36 languages and 174 frameworks, grouped by language with the real per-language counts."
---

Re-Shell ships **208 backend templates** spanning **36 languages** and
**174 frameworks**. Every template is a scaffoldable service with sensible
defaults (routing, validation, Docker, testing, and more). How much of the
catalog has been built and booted is stated in
[Verification](#verification) below. Browse and preview
them entirely offline with the [`templates`](/re-shell/cli/templates/) command
group, or visually in the [dashboard](/re-shell/dashboard/overview/).

```bash
re-shell templates list                  # all 208
re-shell templates list --language rust  # filter by language
re-shell templates show express          # details for one
re-shell templates apply express --name billing   # dry-run preview
```

> These counts come from the live registry
> (`re-shell templates list --json` / `re-shell templates matrix --json`) at CLI
> `0.31.0`. The catalog grows over time; the CLI is always the source of truth.
> Frontend, microfrontend and architecture templates used by `create` are listed
> separately by `re-shell templates list`.

## By language

| Language | Templates |
| --- | ---: |
| TypeScript | 76 |
| JavaScript | 21 |
| C# | 12 |
| C++ | 7 |
| Python | 7 |
| Go | 6 |
| Clojure | 4 |
| Haskell | 4 |
| Java | 4 |
| Kotlin | 4 |
| Lua | 4 |
| PHP | 4 |
| ReScript | 4 |
| Rust | 4 |
| Swift | 4 |
| Crystal | 3 |
| Dart | 3 |
| Elixir | 3 |
| F# | 3 |
| Nim | 3 |
| Perl | 3 |
| Ruby | 3 |
| Scala | 3 |
| Zig | 3 |
| Julia | 2 |
| Mojo | 2 |
| OCaml | 2 |
| V | 2 |
| Ballerina | 1 |
| Gleam | 1 |
| Grain | 1 |
| Odin | 1 |
| Pony | 1 |
| Red | 1 |
| Roc | 1 |
| Unison | 1 |
| **Total** | **208** |

## Frameworks (selected)

174 frameworks are represented. A sampling across ecosystems:

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
    "fileCount": 34
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

Would create 34 files (52080 bytes). Nothing written.

  + .dockerignore (356b)
  + .env.example (592b)
  + docker-compose.yml (1418b)
  + Dockerfile (1228b)
  + jest.config.js (1000b)
  + package.json (2538b)
  + prisma/schema.prisma (1273b)
  ...
```

To write the full template, use `re-shell create <name> --backend <id>` (for
example `re-shell create api --backend express`; add `--dry-run --json` to get the
file set with diffs first). `re-shell generate backend` writes a smaller starter
(for Express: `package.json`, `tsconfig.json` and `src/index.ts`).

## Runtime parity

Each of Deno, Bun, Kotlin, Scala, Crystal, Zig, Elixir and Nim has at least three
templates (a unit test pins this):

| Runtime | Templates |
| --- | --- |
| Deno | `oak-deno`, `fresh-deno`, `aleph-deno` |
| Bun | `elysia-bun`, `bun-serve`, `trpc-bun` (and `hono`, which also runs on Bun) |
| Kotlin | `ktor`, `http4k`, `spring-boot-kotlin`, `micronaut-kotlin` |
| Scala | `akka-http`, `play-scala`, `http4s-scala` |
| Crystal | `kemal`, `lucky-cr`, `amber-cr` |
| Zig | `zig-http`, `zap-zig`, `std-http-zig` |
| Elixir | `phoenix`, `plug-ex`, `nerves-ex` |
| Nim | `jester`, `prologue-nim`, `happyx-nim` |

## Verification

A template existing in the registry is not proof that its generated project
works. Two scripts check that, and the `template-health` workflow runs both on
every push and pull request (pending its first hosted run):

- `bash scripts/scaffold-test-templates.sh` scaffolds templates with the built CLI
  and builds each with its own toolchain (`tsc`, `go build`, `cargo check`, Maven,
  Gradle, sbt, `dotnet build`, CMake, `zig build`, `cabal build` + `cabal test`,
  `deno check` + `deno test`, `dart analyze`, `rescript build`, `php -l` + composer,
  `ruby -c` + bundle, Python compile and import, ...). It runs in groups
  (`--group core|jvm|dotnet|native|node|haskell|deno|config`), one CI job each. A
  template whose toolchain is not installed is reported as **SKIP** with the reason,
  never as a pass.
- `node scripts/boot-test-templates.mjs` scaffolds eight Node and Bun backends
  (Express, Fastify, Koa, Hono, NestJS, `elysia-bun`, `bun-serve`, `trpc-bun`),
  installs them, builds, starts each on a free port with no database or Redis
  reachable, waits for `/health`, probes a functional route and requires a clean
  exit on SIGTERM.

**Where the catalog stands (0.31.0):** the build script lists **172 of the 208**
templates, and **170** of them were built successfully during development; `vapor`
(Swift) and `phoenix` (needs the hex registry) are built only in CI. Lua templates are
checked for syntax only, Dart templates are analyzed but their tests are not run, and
the 18 configuration templates (service mesh, proxies, compose and similar) get a YAML
syntax check, not a deployment.

The other **36** templates are registered, scaffoldable and covered by the registry and
placeholder tests, but have **not** been built, because their package registry or
toolchain was not available:

| Needs | Templates |
| --- | --- |
| hex | `plug-ex`, `nerves-ex` |
| Clojars | `compojure`, `luminus-clj`, `reitit-clj`, `pedestal-clj` |
| nimble | `jester`, `prologue-nim`, `happyx-nim` |
| shards (GitHub) | `kemal`, `lucky-cr`, `amber-cr` |
| opam | `dream-ocaml`, `opium-ocaml` |
| sources on GitHub | `zap-zig`, `crow` |
| deno.land/x | `aleph-deno` |
| Swift | `perfect`, `kitura`, `hummingbird` |
| Julia | `genie-jl`, `oxygen-jl` |
| V | `vweb`, `vex-v` |
| Gleam | `wisp` |
| Odin, Pony, Red, Grain, Mojo, Roc, Ballerina, Unison, Carbon, Vale | `odin-http`, `jennet-pony`, `red-http`, `grain`, `mojo`, `mojo-fastapi`, `roc`, `ballerina`, `unison`, `carbon`, `vale` |

Treat these as starting points to review, not as projects known to build.

## See also

- [`templates` command reference](/re-shell/cli/templates/).
- [Compatibility Matrix](/re-shell/templates/matrix/) — databases, caches, deploy targets.
- [JSON Contract](/re-shell/contract/json-contract/) — the `templates list` / `show` payloads.
