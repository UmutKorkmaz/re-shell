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

## See also

- [Template Catalog](/re-shell/templates/catalog/) — categorized list.
- [Compatibility Matrix](/re-shell/templates/matrix/).
- [JSON Contract](/re-shell/contract/json-contract/).
