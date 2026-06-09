---
title: "service & bridge"
description: "Polyglot services and cross-language bridges."
---

The `service` group manages polyglot services and generates **cross-language
service bridges** — a protocol contract plus typed clients that let services
written in different languages talk to each other safely.

```bash
re-shell service --help
```

| Subcommand | Purpose |
| --- | --- |
| `bridge` | Generate cross-language service bridges (contract + typed clients) from the workspace v2 config. |
| `polyglot` | Build and deploy polyglot full-stack applications. |
| `run` (alias `svc`) | Manage development services. |

## `service bridge generate`

```
Usage: re-shell service bridge generate [options]

Generate a service bridge: a protocol contract (.proto/OpenAPI/GraphQL SDL)
plus a typed TS client and a documented Python scaffold
```

```bash
re-shell service bridge generate
```

What it produces:

- A **protocol contract** — gRPC `.proto`, OpenAPI, or GraphQL SDL.
- A **typed TypeScript client** that is type-checked against your installed
  `tsc`.
- A **documented Python client scaffold**.

The generator reads your declarative `re-shell.workspaces.yaml` (v2) to know
which services exist and how they relate, so the bridge matches your real
topology. Async transports (Kafka/Redis Streams), circuit breakers, and
distributed tracing are scaffolded as types and stubs — see the
[Roadmap](/re-shell/roadmap/) for status.

## Managing development services

```bash
# Run / manage local development services
re-shell service run --help

# Build and deploy a polyglot application
re-shell service polyglot --help
```

## See also

- [generate backend](/re-shell/cli/generate/#generate-backend) — scaffold the
  services a bridge connects.
- [api](/re-shell/cli/api/) — OpenAPI specs and clients.
- [k8s / Helm / GitOps](/re-shell/cli/k8s-helm-gitops/) — deploy the services.
