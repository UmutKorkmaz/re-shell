---
title: "Template Catalog"
description: "The full catalog of 208 backend templates across 36 languages and 173 frameworks, grouped by language with the real per-language counts."
---

Re-Shell ships **208 backend templates** spanning **36 languages** and
**173 frameworks**. Every template is a scaffoldable service with sensible
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

173 frameworks are represented. A sampling across ecosystems:

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
- **Elixir / Gleam** — Phoenix, Plug, Nerves, Wisp.
- **Ruby** — Rails, Sinatra, Grape.
- **PHP** — Laravel 13, Symfony, Slim, CodeIgniter.
- **Haskell / OCaml / F#** — Yesod, Servant, Scotty, Spock, Dream, Opium,
  Giraffe, Suave, Saturn.
- **Swift / Julia / Clojure** — Vapor, Hummingbird 2, Kitura 3, Perfect; Genie,
  Oxygen; Compojure, Luminus, Reitit, Pedestal.
- **Nim / Crystal** — Jester, Prologue, HappyX; Kemal, Lucky, Amber.
- **Systems and emerging** — Zap (Zig), Crow (C++), `veb` and Vex (V), Odin, Jennet
  (Pony), Red, Mojo (and Mojo + FastAPI), Grain, Ballerina, Unison, Roc.
- **Deno** — Oak, Fresh, and a Hono + React server-rendered app (`aleph-deno`).
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

Two descriptions changed with the template work: `aleph-deno` is now a **Hono + React**
server-rendered app on Deno 2 (framework `hono`; the Aleph.js template it replaces was
retired), and `vweb` runs on **veb**, V's renamed web module (framework `veb`).

## Verification

A template existing in the registry is not proof that its generated project
works. Two scripts check that, and the `template-health` workflow runs both on
every push and pull request:

- `bash scripts/scaffold-test-templates.sh` scaffolds templates with the built CLI
  and builds each with its own toolchain (`tsc`, `go build`, `cargo check`, Maven,
  Gradle, sbt, `dotnet build`, CMake, `zig build`, `cabal build` + `cabal test`,
  `deno check` + `deno test`, `dart analyze`, `rescript build`, `php -l` + composer,
  `ruby -c` + bundle, Python compile and import, SwiftPM, Julia `Pkg`, `nimble`,
  `shards`, `dune`, Leiningen, `mix`, `gleam`, `v`, `odin`, `ponyc`, `bal`, `grain`,
  `mojo`, `red`, ...). It runs in groups
  (`--group core|jvm|dotnet|native|node|config|haskell|deno|swift|julia|nim|crystal|ocaml|clojure|beam|systems|exotic|exoticb`),
  one CI job each. A template whose toolchain is not installed is reported as **SKIP**
  with the reason, never as a pass.
- `node scripts/boot-test-templates.mjs` scaffolds eight Node and Bun backends
  (Express, Fastify, Koa, Hono, NestJS, `elysia-bun`, `bun-serve`, `trpc-bun`),
  installs them, builds, starts each on a free port with no database or Redis
  reachable, waits for `/health`, probes a functional route and requires a clean
  exit on SIGTERM.

**Where the catalog stands (0.31.0):** the build script lists **204 of the 208**
templates, and **all 204 pass in the hosted `template-health` run** (PR #395, commit
`3a06508`; [run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37245729171), 19 jobs). They differ in what was also verified locally:

- **172 were already passing** at commit `3207b9f`; 170 of them were also built during
  development, while `vapor` and `phoenix` need a Swift toolchain and the hex registry, so
  only CI builds them.
- **32 were wired afterwards.** 14 of them were built locally with their real toolchain;
  18 could not be built locally because their toolchain could not be downloaded here, so
  their first real build was the hosted run. It found and fixed defects in `ballerina`,
  `unison`, `red-http`, `kitura` and `nerves-ex`; all 32 pass.
- **4 are infeasible** and are left out of the script (below).

Lua templates are checked for syntax only, Dart templates are analyzed but their tests
are not run, and the 18 configuration templates (service mesh, proxies, compose and
similar) get a YAML syntax check, not a deployment.

The 32 newly wired templates:

| Group | Templates | Status |
| --- | --- | --- |
| Crystal (`shards`) | `kemal`, `lucky-cr`, `amber-cr` | built locally with the real toolchain; passes in hosted CI |
| V (`veb`, Vex), Odin, Pony | `vweb`, `vex-v`, `odin-http`, `jennet-pony` | built locally with the real toolchains; passes in hosted CI |
| Mojo | `mojo`, `mojo-fastapi` | built locally with the real toolchain; passes in hosted CI |
| Nim 2.0.x (`nimble`) | `jester`, `prologue-nim`, `happyx-nim` | built locally with Nim 2.0.16; passes in hosted CI |
| C++ (CMake) | `crow` | built locally (Crow v1.2.0 fetched from GitHub; `libasio-dev` added to CI); passes in hosted CI |
| Deno | `aleph-deno` | built locally (`deno check`, `deno test`); passes in hosted CI |
| Swift (SwiftPM) | `hummingbird`, `kitura` | passes in hosted CI (`kitura` ships patched copies of Kitura under `Vendor/`: Swift 6 Foundation on Linux does not compile the upstream `.formatted` pattern) |
| Julia (`Pkg`) | `genie-jl`, `oxygen-jl` | passes in hosted CI |
| OCaml (`dune`, opam) | `dream-ocaml`, `opium-ocaml` | passes in hosted CI |
| Clojure (Leiningen) | `compojure`, `luminus-clj`, `reitit-clj`, `pedestal-clj` | passes in hosted CI |
| Elixir, Gleam (`mix`, `gleam`) | `plug-ex`, `nerves-ex`, `wisp` | passes in hosted CI (`nerves-ex` needs `libmnl-dev` on the host for its `nerves_uevent` C port) |
| Zig | `zap-zig` | passes in hosted CI (Zig 0.13.0; the Zap v0.8.0 dependency hash, taken from the CI log, is pinned in `build.zig.zon`) |
| Red | `red-http` | passes in hosted CI (Red/System, 32-bit toolchain: i386 gdk-pixbuf and glib libraries installed; the test program now quits with a zero return) |
| Grain, Ballerina, Unison | `grain`, `ballerina`, `unison` | passes in hosted CI (`ballerina`: `service` renamed because it is a reserved keyword, and `bal test` runs the tests; `unison`: the self-test no longer compares tuples with `==`) |

The Nim group runs **Nim 2.0.x** because `happyx` does not resolve with Nim 2.2.12 and
nimble 0.24.1. `laravel` is now **Laravel 13**; its template-health check boots the app
(`php artisan route:list`) and runs its PHPUnit suite (`php artisan test`).

### Infeasible templates

These four are registered, scaffoldable and covered by the registry and placeholder
tests, but no build is attempted, and they are **not** counted as built:

| Template | Why it cannot be built |
| --- | --- |
| `perfect` (Swift) | PerfectNet calls `SSL_get_peer_certificate`, which is only a function-like macro in OpenSSL 3 that Swift's Clang importer cannot import; Perfect-Net has been unmaintained since 2020. |
| `roc` | Roc has no stable release, and its platform must be pinned by a content-hash URL that could not be verified. |
| `carbon` | There is no released version (only experimental nightlies) and no networking. |
| `vale` | The project is archived, the last compiler is a 2022 alpha, and there is no networking. |

Treat these four as starting points to review, not as projects known to build.

## See also

- [`templates` command reference](/re-shell/cli/templates/).
- [Compatibility Matrix](/re-shell/templates/matrix/) — databases, caches, deploy targets.
- [JSON Contract](/re-shell/contract/json-contract/) — the `templates list` / `show` payloads.
