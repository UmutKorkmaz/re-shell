---
title: "CLI Overview"
description: "Top-level Re-Shell commands and command introspection."
---

The Re-Shell CLI is invoked as `re-shell`. It exposes a set of **top-level
commands** for project lifecycle plus **command groups** that bundle related
functionality. At CLI `0.29.2` there are over 500 registered commands across the
groups.

```bash
re-shell --help
re-shell --version   # 0.29.2
```

## Top-level commands

| Command | Purpose |
| --- | --- |
| `init <name>` | Initialize a new monorepo workspace (Frontend, Full-Stack, Microservices, Polyglot). |
| `create <name>` | Create a new Re-Shell project with a shell application. |
| `add <name>` | Add a microfrontend to an existing project. |
| `remove <name>` | Remove a microfrontend. |
| `list` | List all microfrontends in the current project. |
| `tui` | Launch the interactive terminal UI (Ink). |
| [`ui`](/re-shell/dashboard/overview/) | Launch the local web dashboard. |
| `build [name]` | Build all or specific microfrontends. |
| `serve [name]` | Start the development server. |
| [`doctor`](/re-shell/cli/doctor-analyze/) | Run health checks on the monorepo. |
| [`analyze`](/re-shell/cli/doctor-analyze/) | Analyze bundles, dependencies, performance, security. |
| [`completion`](/re-shell/cli/completion/) | Install shell completion scripts. |
| [`ai <prompt...>`](/re-shell/cli/ai/) | Resolve a natural-language prompt to a command (offline). |
| `commands` | Introspect available commands as a machine-readable catalog. |

## Command groups

| Group | Purpose |
| --- | --- |
| [`workspace`](/re-shell/cli/workspace/) | Workspace health, dependency graph, topology, sync, policy, drift, migration. |
| [`templates`](/re-shell/cli/templates/) | Discover and inspect framework templates. |
| [`generate`](/re-shell/cli/generate/) | Generate code, tests, docs, backends, and features. |
| [`api`](/re-shell/cli/api/) | OpenAPI/Swagger, versioning, validation, testing, docs, gateway, clients. |
| [`service`](/re-shell/cli/service-bridge/) | Polyglot services + cross-language service bridges. |
| [`k8s`](/re-shell/cli/k8s-helm-gitops/) | Kubernetes manifests, Helm charts, GitOps. |
| [`cloud`](/re-shell/cli/cloud/) | AWS/Azure/GCP deployment and CDN management. |
| [`observe`](/re-shell/cli/observe/) | Metrics, tracing, logging, APM, alerting. |
| [`security`](/re-shell/cli/security/) | Security, compliance, and governance generators. |
| [`data`](/re-shell/cli/data/) | Database migration, pooling, cache, ORM utilities. |
| [`collab` / `learn`](/re-shell/cli/collab-learn/) | Collaboration and learning generators. |
| [`plugin`](/re-shell/cli/plugin/) | Manage CLI plugins and extensions. |
| [`tools` / `config` / `quality`](/re-shell/cli/tools-config-quality/) | Dev tools, configuration, code quality. |

Every group prints its own help:

```bash
re-shell workspace --help
re-shell templates --help
re-shell k8s --help
```

## Command introspection

The `commands` group exposes the entire surface as a machine-readable catalog —
the same data the dashboard's Command Builder and the offline `ai` resolver read:

```bash
re-shell commands list --json > catalog.json
```

> **Pipe caveat.** The CLI exits as soon as a command resolves, which can
> truncate very large JSON payloads (such as `commands list`) when stdout is an
> OS pipe. Redirect to a file (`... --json > out.json`) for the full payload.

## The JSON contract

Commands marked with `--json` emit the typed `{ ok, data, warnings }` envelope
defined in `@re-shell/contracts`. Error envelopes set a non-zero exit code. See
the [JSON Contract](/re-shell/contract/json-contract/) page for the full
specification and error-code vocabulary.
