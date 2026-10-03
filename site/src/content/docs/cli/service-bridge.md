---
title: "service & bridge"
description: "Link polyglot services with typed clients generated from their own specs: service link, validate, unlink, and the bridge family (generate, gateway, async, transform, diff, mock)."
---

The `service` group manages polyglot services and connects them. A **bridge** is a
contract plus typed clients that let services written in different languages call
each other safely. Since 0.31.0 bridges are **spec-driven**: Re-Shell reads the
provider's own OpenAPI, `.proto` or GraphQL SDL file, generates typed TypeScript,
Python and Go clients from it, and records the dependency in
`re-shell.workspaces.yaml`.

```bash
re-shell service --help
```

| Subcommand | Purpose |
| --- | --- |
| `link <consumer> <provider>` | Derive the provider's contract from its spec, generate a typed client in the consumer, record the dependency. |
| `unlink <consumer> <provider>` | Remove the recorded link (and `dependsOn` edge). |
| `validate` | Check that every link resolves, linked contracts are still compatible, and the graph has no cycles (exit 1 when invalid). |
| `bridge generate` | Generate a bridge for one service and protocol. |
| `bridge gateway` | Compose several GraphQL services into one gateway (Apollo Federation 2 or schema stitching). |
| `bridge async` | Typed Kafka / Redis Streams producers and consumers from an async contract. |
| `bridge transform` | Convert data between JSON, Protobuf, Avro and MessagePack. |
| `bridge diff` | Classify the changes between two contract versions. |
| `bridge mock` | Run a mock server (REST, GraphQL, gRPC) from specs. |
| `run` (alias `svc`) | Supervise development services ([below](#running-services)). |
| `polyglot` | Build and deploy polyglot full-stack applications. |

## `service link`

```bash
re-shell service link web catalog                 # web becomes a typed client of catalog
re-shell service link web orders --lang ts,go     # several client languages
re-shell service link web catalog --dry-run --json
```

It discovers the provider's spec in its directory (or take one with `--spec`), picks
the protocol (`--protocol rest|grpc|graphql`, only needed when the provider has
several specs), generates the client under
`<consumer>/clients/<provider>-<protocol>` (change with `--out`), and adds the link
and a `dependsOn` edge to the workspace config. `--lang` takes `ts,python,go`
(default: the consumer's language); for gRPC the protobuf stubs are compiled when
`protoc` is available (`--no-compile-stubs` to skip). A dry run on the
`bridge-workspace` test fixture:

```json
{
  "ok": true,
  "data": {
    "consumer": "web", "provider": "catalog", "protocol": "rest", "languages": ["ts"],
    "spec": "services/catalog/openapi.yaml",
    "client": "services/web/clients/catalog-rest",
    "operations": 5,
    "files": [
      "services/web/clients/catalog-rest/openapi.yaml",
      "services/web/clients/catalog-rest/ts/client.ts",
      "services/web/clients/catalog-rest/ts/package.json",
      "services/web/clients/catalog-rest/ts/tsconfig.json",
      "services/web/clients/catalog-rest/README.md",
      "services/web/clients/catalog-rest/.re-shell-bridge.json"
    ],
    "written": false, "dependsOnAdded": true
  },
  "warnings": []
}
```

The `contractSha256` recorded with the link is what `service validate` compares
against later, so a provider that changed its contract is reported instead of
silently drifting. `service unlink` removes the record (`--keep-dependency` keeps
the `dependsOn` edge; `--remove-client` also deletes the generated client, but only
if it carries the bridge marker file).

```bash
re-shell service validate           # exit 1 when a link is stale or the graph has a cycle
re-shell service unlink web catalog --remove-client
```

## `service bridge generate`

Generates the artifacts for **one** service and **one** protocol: pass exactly one
of `--rest`, `--grpc` or `--graphql` (without one the command fails with
`BRIDGE_GENERATE_ERROR`).

```bash
re-shell service bridge generate --service catalog --rest --dry-run --json
re-shell service bridge generate --service orders --grpc --out ./bridge
re-shell service bridge generate --service catalog --rest --verify
```

When the service has a spec (or you pass `--spec`), clients are generated from it for
`--lang ts,python,go` (default all three). When it has none, Re-Shell falls back to a
default health/echo/config contract. `--verify` runs `tsc`, `py_compile` and `mypy`,
and `go build` over the generated clients and reports each result; a tool that is
not installed is reported as skipped, not as a pass.

## `service bridge gateway`

Composes several services' GraphQL SDLs into one gateway:

```bash
re-shell service bridge gateway --services products,reviews --mode federation --out ./gateway
re-shell service bridge gateway --subgraph products=products.graphql@http://localhost:4001/graphql \
  --subgraph reviews=reviews.graphql@http://localhost:4002/graphql --mode stitch
```

`--mode federation` (default) runs real **Apollo Federation 2 composition** and fails
if the subgraphs do not compose; `--mode stitch` generates a schema-stitching gateway
(`@graphql-tools/stitch`). `--dry-run` composes and validates without writing.

## `service bridge async`

Generates typed producers and consumers for **Kafka** or **Redis Streams** from an
async contract (`async.yaml`; `--init` writes a starter):

```bash
re-shell service bridge async --init
re-shell service bridge async --transport redis-streams --lang ts,python --verify
re-shell service bridge async --transport kafka --spec ./async.yaml --out ./messaging
```

Every message travels in an envelope with a `correlationId`, `schemaVersion` and a
W3C `traceparent`; the runtime includes version upcasters, service discovery
(environment, `services.registry.json`, DNS SRV), a circuit breaker with retry, and
dead-letter channels. `--verify` type-checks the TypeScript with `tsc` and the
Python with `py_compile` and `mypy`.

What was tested: the runtime and generated code round-trip messages through a real
`redis:7` container (TypeScript and Python) and a real `apache/kafka` container; both
tests start Docker containers and **skip when Docker is unavailable**.

## `service bridge transform`

```bash
re-shell service bridge transform --from json --to msgpack --data '{"a":1}'
re-shell service bridge transform --from json --to avro --input user.json --schema user.avsc
re-shell service bridge transform --from protobuf --to json --input msg.bin \
  --from-schema user.v1.proto --from-message User --migrate rules.yaml
```

Formats: `json`, `protobuf`, `avro`, `msgpack`. Schema evolution is supported (Avro
writer/reader resolution, tolerant Protobuf decoding), and `--migrate` applies
backward-compatible rules (`rename`, `add`, `remove`, `copy`, `convert`).

## `service bridge diff`

Classifies the changes between two versions of a contract (OpenAPI, `.proto` or
GraphQL SDL) as **breaking**, **dangerous** or **non-breaking**, and exits 1 on
breaking changes (`--strict` also fails on dangerous ones):

```bash
re-shell service bridge diff --base orders.v1.proto --head orders.v2.proto --json
```

```json
{
  "ok": true,
  "data": {
    "protocol": "grpc",
    "changes": [
      { "severity": "dangerous", "code": "OUTPUT_FIELD_REMOVED", "path": "User.legacy", "message": "field \"legacy\" was removed from \"User\"" },
      { "severity": "non-breaking", "code": "OUTPUT_FIELD_ADDED", "path": "User.email", "message": "new field \"email\" in \"User\"" }
    ],
    "summary": { "breaking": 0, "dangerous": 2, "nonBreaking": 1 },
    "compatible": true,
    "pass": true
  },
  "warnings": []
}
```

(Abbreviated.) `service validate` uses the same classifier.

## `service bridge mock`

```bash
re-shell service bridge mock --spec services/catalog/openapi.yaml services/orders/orders.proto \
  --port 4010 --grpc-port 4011
```

One server for REST (responses from OpenAPI examples and schemas), GraphQL (mocked
resolvers from the SDL) and gRPC (from the `.proto`), bound to `127.0.0.1` by default.
`--timeout <seconds>` stops it automatically; `--json` prints one envelope once it
is listening. The generated clients are tested against this mock server (the Go gRPC
client needs `go` and `protoc` and is skipped without them).

## Running services

`service run` supervises local development services with dependency ordering.

| Command | Does |
| --- | --- |
| `service run up` | Start services (`--build`, `--no-deps`, `--scale web=3`, `--timeout <ms>`, `--alive-ms <ms>`). |
| `service run down` | Stop and remove them (SIGTERM, then SIGKILL after `--timeout`). |
| `service run health` | Exit non-zero when no service is running or any is down (`--watch`, `--json`). |
| `service run logs [service]` | View logs (`-f`, `--tail`). |
| `service run restart / scale / inspect / exec / migrate / optimize` | See `--help`. |

Process-mode services (those without a container) are launched from the metadata in
their `package.json` under `re-shell.services.<script>`, tracked in **JSON pid files**,
and counted as started only if they stay alive for `--alive-ms` (default 1500 ms) or
become healthy. Failures use `SERVICES_*` error codes; an immediate exit, a spawn
failure or a stale pid file is reported, not ignored.

## See also

- [generate backend](/re-shell/cli/generate/#generate-backend): scaffold the services a bridge connects.
- [api](/re-shell/cli/api/): OpenAPI specs and clients.
- [k8s / Helm / GitOps](/re-shell/cli/k8s-helm-gitops/): deploy the services.
- [Roadmap](/re-shell/roadmap/): what was verified and what was not.
