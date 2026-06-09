---
title: "Compatibility Matrix"
description: "The full language / framework / database / cache / deployment-target / feature grid across all 205 templates."
---

`re-shell templates matrix` builds a **compatibility grid** across every template:
which language and framework it uses, and which databases, caches, deployment
targets, and features it supports. Use it to find a template that fits your stack
before you scaffold.

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

> The facet values below come from the live registry
> (`re-shell templates matrix --json`) at CLI `0.29.2`. The `--json` form emits
> the [contract envelope](/re-shell/contract/json-contract/) with a `data.matrix[]`
> grid plus a `data.facets` summary.

## Facets

### Languages (36)

ballerina, clojure, cpp, crystal, csharp, dart, elixir, fsharp, gleam, go, grain,
haskell, java, javascript, julia, kotlin, lua, mojo, nim, ocaml, odin, perl, php,
pony, python, red, rescript, roc, ruby, rust, scala, swift, typescript, unison,
v, zig.

### Frameworks (171)

171 frameworks across web, RPC, messaging, and infrastructure — from Express,
FastAPI, Spring Boot, Actix-Web, Gin, Phoenix, and Laravel to gRPC, GraphQL,
Kubernetes, Nginx, Istio, Kong, and Vault. Run `re-shell templates matrix` for the
complete current list, or see the [catalog](/re-shell/templates/catalog/).

### Databases (10)

couchbase, couchdb, elasticsearch, generic-sql, influxdb, mariadb, mongodb,
mysql, neo4j, postgresql.

### Caches (3)

in-memory, memcached, redis.

### Deployment targets (4)

ci-cd, docker, kubernetes, serverless.

### Features (42)

authentication, authorization, caching, channels, cli, compression,
connection-pooling, cors, database, deprecation, docker, documentation, email,
extensions, file-upload, fulltext, graphql, grpc, json, jsonb, logging,
microservices, middleware, migration, monitoring, performance, pubsub,
python-interop, queue, rate-limiting, rest-api, routing, security,
session-management, sessions, simd, streaming, swagger, testing, validation,
wasi, websockets.

## JSON shape

```bash
re-shell templates matrix --json > matrix.json
```

```json
{
  "ok": true,
  "data": {
    "matrix": [
      {
        "id": "actix-web",
        "displayName": "Actix-Web + Rust",
        "language": "rust",
        "framework": "actix-web",
        "databases": ["generic-sql", "postgresql"],
        "caches": ["in-memory"],
        "deploymentTargets": ["docker"],
        "features": ["authentication", "authorization", "caching", "cors", "database", "docker", "logging", "monitoring", "rate-limiting", "rest-api", "security", "testing", "validation"]
      }
    ],
    "facets": {
      "languages": ["...36..."],
      "frameworks": ["...171..."],
      "databases": ["...10..."],
      "caches": ["in-memory", "memcached", "redis"],
      "deploymentTargets": ["ci-cd", "docker", "kubernetes", "serverless"],
      "features": ["...42..."]
    }
  },
  "warnings": []
}
```

Filter the grid with `jq`:

```bash
# Every template that supports PostgreSQL
re-shell templates matrix --json \
  | jq -r '.data.matrix[] | select(.databases | index("postgresql")) | .id'

# Every Rust template
re-shell templates matrix --json \
  | jq -r '.data.matrix[] | select(.language == "rust") | .id'
```

## See also

- [Template Catalog](/re-shell/templates/catalog/) — per-language counts and frameworks.
- [`templates` command reference](/re-shell/cli/templates/).
- [JSON Contract](/re-shell/contract/json-contract/).
