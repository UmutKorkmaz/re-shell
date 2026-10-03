---
title: "CLI Overview"
description: "Top-level Re-Shell commands, command groups, and command introspection."
---

The Re-Shell CLI is invoked as `re-shell`. It exposes **top-level commands** for
the project lifecycle plus **command groups** that bundle related functionality.
At CLI `0.31.0` the catalog (`re-shell commands list --json`) has **585 command
paths in 46 top-level commands**. Command groups load lazily, so `re-shell
--version` starts in about 45 ms and `--help` in about 100 ms on a development
VM (median of 10 runs; yours will differ, and group commands take several hundred
milliseconds because they load their group on demand).

```bash
re-shell --help
re-shell --version   # prints only the version
```

## Top-level commands

| Command | Purpose |
| --- | --- |
| `init <name>` | Initialize a new monorepo workspace (Frontend, Full-Stack, Microservices, Polyglot). |
| `create <name>` | Create a project. Non-interactive for every mode; a bare `create` is a react-ts frontend. See [generate](/re-shell/cli/generate/#create-and-related-commands). |
| `add <name>` / `remove <name>` / `list` | Add, remove and list microfrontends. |
| `tui` | Launch the interactive terminal UI (Ink). |
| [`ui`](/re-shell/cli/ui/) | Launch the local web dashboard; `ui test`, `ui component new`, `ui generate`, `ui theme ...`. |
| `build [name]` / `serve [name]` | Build or serve microfrontends. |
| [`doctor`](/re-shell/cli/doctor-analyze/) / [`analyze`](/re-shell/cli/doctor-analyze/) | Health gate; bundle, dependency, performance, security, scalability and architecture analysis. |
| [`completion`](/re-shell/cli/completion/) | Shell completion generated from the live command tree. |
| [`ai <prompt...>`](/re-shell/cli/ai/) | Resolve a natural-language prompt to a command (cloud, local or offline provider). |
| [`find <query>`](/re-shell/cli/find/) | Offline, ranked search over commands and templates. |
| [`run <task>`](/re-shell/cli/run/) / [`cache`](/re-shell/cli/cache/) | Dependency-ordered task runner with a resource governor; build cache. |
| `dev` | Local dev runtime: `--profile`, `--cluster`, `--restart-plan`. |
| [`pkg`](/re-shell/cli/pkg-debug-refactor/) / [`debug`](/re-shell/cli/pkg-debug-refactor/) / [`refactor`](/re-shell/cli/pkg-debug-refactor/) | Unified package manager; cross-language debug configs; workspace refactors. |
| [`fix --ci`](/re-shell/cli/doctor-analyze/#fix---ci) | Gated CI fixer with validated patches. |
| `scorecard` / `release` / `migrate` / `catalog` / `federation` / `boundaries` / `env` | Readiness score, graph-aware releases, codemod migrations, software catalog, Module Federation checks, import boundaries, dev environments. |
| [`agents`](/re-shell/cli/agents/) | Generate and verify agent-readiness docs. |
| `commands` | Introspect available commands as a machine-readable catalog. |

## Command groups

| Group | Purpose |
| --- | --- |
| [`workspace`](/re-shell/cli/workspace/) | Graph (+ diff, explorer), live status, health, policy packs, drift, migration, import. |
| [`templates`](/re-shell/cli/templates/) | Discover and inspect framework templates. |
| [`generate`](/re-shell/cli/generate/) | Generate code, tests, docs, backends, and features. |
| [`api`](/re-shell/cli/api/) | OpenAPI/Swagger, versioning, validation, testing, docs, gateway, clients, `api verify`. |
| [`service`](/re-shell/cli/service-bridge/) | `link` / `unlink` / `validate`, the `bridge` family, `run` (service supervision), `polyglot`. |
| [`k8s`](/re-shell/cli/k8s-helm-gitops/) | Manifests, Helm, GitOps, rollback, CRD, operator, mesh. |
| [`cloud`](/re-shell/cli/cloud/) | Terraform generation and deploy (`cloud iac`, `cloud deploy`) plus legacy provider generators. |
| [`observe`](/re-shell/cli/observe/) | Metrics, tracing, logging, APM, alerting. |
| [`security`](/re-shell/cli/security/) | Security generators, [audit trail and compliance reports](/re-shell/cli/security-audit/). |
| [`data`](/re-shell/cli/data/) | Database migration, pooling, cache, ORM utilities. |
| [`collab`](/re-shell/cli/collab-learn/) / [`learn`](/re-shell/cli/collab-learn/) | [Shared sessions](/re-shell/integrations/collaboration/) plus generators; learning generators. |
| [`plugin`](/re-shell/cli/plugin/) | Install, uninstall, update, validate, pin, review and search plugins. |
| [`tools` / `config` / `quality`](/re-shell/cli/tools-config-quality/) | Dev tools, configuration and profiles, code quality. |

Every group prints its own help:

```bash
re-shell workspace --help
re-shell templates --help
re-shell k8s --help
```

## Command introspection

The `commands` group exposes the entire surface as a machine-readable catalog,
the same data the dashboard's Command Builder, the VS Code extension and the
`ai` resolver read:

```bash
re-shell commands list --json > catalog.json
```

The output is one complete envelope even when piped (`re-shell commands list
--json | jq '.data | length'` works); the `--json` contract guarantees a single
envelope on stdout and sends everything incidental to stderr.

## The JSON contract

Commands marked with `--json` emit the typed `{ ok, data, warnings }` envelope
defined in `@re-shell/contracts`. Error envelopes set a non-zero exit code
(`COMMAND_ERROR` for unexpected failures, `USAGE_ERROR` for bad arguments). See
the [JSON Contract](/re-shell/contract/json-contract/) page for the full
specification and the error-code vocabulary.
