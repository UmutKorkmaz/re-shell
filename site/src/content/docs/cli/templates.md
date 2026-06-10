---
title: "templates"
description: "Discover, inspect, and apply framework templates."
---

The `templates` group is your window into the **205-template, 36-language**
catalog. It lists templates, shows details for one, renders a compatibility
matrix, and previews exactly what a scaffold would produce — all without writing
files.

```bash
re-shell templates --help
```

| Subcommand | Purpose |
| --- | --- |
| `list` | List available framework templates. |
| `show <id>` | Show details for a single template. |
| `matrix` | Compatibility grid across language/framework/database/cache/deployment. |
| `apply <id>` | Preview the files a scaffold would produce (dry-run). |
| `recommend <query>` | Rank templates for a free-text query, each with a rationale. |

For the categorized catalog and language breakdown, see the
[Template Catalog](/re-shell/templates/catalog/) and
[Compatibility Matrix](/re-shell/templates/matrix/) pages.

## `templates list`

```
Usage: re-shell templates list [options]

Options:
  --json           Output as JSON
  --language <l>   Filter by language
  --framework <f>  Filter by framework
```

```bash
re-shell templates list
re-shell templates list --language rust
re-shell templates list --json
```

```
📋 Templates (205)

  ● express [typescript] express
    Fast, unopinionated, minimalist web framework for Node.js ...
  ● fastify [typescript] fastify
    Fast and low overhead web framework for Node.js with schema-based validation
  ● nestjs [typescript] nestjs
    Progressive Node.js framework for building efficient, scalable server-side applications
  ...
```

The `--json` form emits the contract envelope with a `data[]` array of template
descriptors (`id`, `displayName`, `language`, `framework`, `version`, `tags`,
`features`, `port`, `fileCount`).

## `templates show`

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

An unknown id returns an error envelope with `code: "TEMPLATE_NOT_FOUND"` and a
non-zero exit code.

## `templates matrix`

Builds the full compatibility grid: which languages, frameworks, databases,
caches, and deployment targets each template supports.

```bash
re-shell templates matrix
re-shell templates matrix --json
```

```
📊 Template compatibility matrix (205)

Languages: ballerina, clojure, cpp, crystal, csharp, dart, ... typescript, unison, v, zig
Frameworks: 171
Databases: couchbase, couchdb, elasticsearch, generic-sql, ... postgresql
Caches: in-memory, memcached, redis
Deployment: ci-cd, docker, kubernetes, serverless

  actix-web [rust] db:generic-sql/postgresql cache:in-memory deploy:docker
  aspnet-core-webapi [csharp] db:generic-sql cache:in-memory deploy:docker
  ...
```

## `templates apply`

A **dry-run** that computes the exact file set a scaffold would produce — names,
sizes, and per-file preview — without touching your workspace.

```
Usage: re-shell templates apply [options] <id>

Options:
  --json         Output as JSON
  --dry-run      Compute the file set without writing anything (default)
  --name <name>  Project name to substitute into placeholders (default: "my-service")
```

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

To actually write a backend service, use
[`generate backend`](/re-shell/cli/generate/) or
[`create`](/re-shell/cli/generate/#create-and-related-commands).

## `templates recommend`

Describe what you want to build in plain language and get back a ranked shortlist
of real templates from the catalog — each with a one-line **rationale** that
explains *why* it surfaced (the matched query terms plus the template's
language/framework/category).

```
Usage: re-shell templates recommend [options] <query>

Options:
  --json       Output the ranked recommendations as a JSON envelope
  --limit <n>  Maximum number of recommendations (default: 5)
```

```bash
re-shell templates recommend "grpc service"
re-shell templates recommend "high-throughput async API with websockets" --limit 8
re-shell templates recommend "graphql server" --json
```

```
✨ Recommendations for "grpc service" (5)

  ● gRPC Service (78%)
    Matches "grpc, service"; csharp/grpc · grpc
    re-shell create <name> --template grpc-service
  ● gRPC (Go) (74%)
    Matches "grpc, service"; go/grpc-go · go
    re-shell create <name> --template grpc-go
  ...
```

### Offline-first, with an optional LLM phrasing hook

Recommendations are computed **entirely offline and deterministically**. Ranking
reuses the same scorer as [`find`](/re-shell/cli/find/) over a template-only
corpus, and the rationale is derived from the matched terms and registry metadata
— no network calls, no API keys, no embeddings on the default path. The same
query always returns the same shortlist.

An optional LLM phrasing hook can rewrite *only* the rationale wording when a
provider is explicitly supplied. It is off by default and never constructed on
the default path, and it is constrained so it can never reorder, drop, or
re-score results — ids and scores are always preserved.

A query made up only of stop-words (for example `the a of`) returns an empty
result set with `ok: true` and exit code `0` — an empty match is not an error.

### JSON envelope

`--json` emits the standard contract envelope. The `data` payload echoes the
`query` and `limit`, then a `results[]` array of recommendations:

```json
{
  "ok": true,
  "data": {
    "query": "high-throughput async API with websockets",
    "limit": 5,
    "results": [
      {
        "id": "websocket-api-docs",
        "title": "WebSocket API",
        "score": 0.82,
        "rationale": "Matches \"async, api, websockets\"; typescript/ws · websocket",
        "matched": ["async", "api", "websockets"],
        "language": "typescript",
        "framework": "ws",
        "category": "websocket"
      }
    ]
  },
  "warnings": []
}
```

Each result carries `id`, `title`, `score` (relevance in `[0, 1]`, same scale as
`find`), `rationale`, the `matched` query terms, and the optional
`language`/`framework`/`category` metadata the rationale is built from. See the
[JSON Contract](/re-shell/contract/json-contract/) for the full schema.

## See also

- [Template Catalog](/re-shell/templates/catalog/) — categorized list.
- [Compatibility Matrix](/re-shell/templates/matrix/).
- [JSON Contract](/re-shell/contract/json-contract/).
