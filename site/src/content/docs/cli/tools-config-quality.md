---
title: "tools / config / quality"
description: "Developer utility, configuration, and quality command groups."
---

Three groups handle the developer's local environment: `tools` for utilities and
dev workflows, `config` for layered configuration, and `quality` for testing and
IDE integration.

## `tools`

```bash
re-shell tools --help
```

| Subcommand | Purpose |
| --- | --- |
| `detect` | Detect frameworks and analyze project structure for recommendations. |
| `dry-run` | Preview changes without applying them. |
| `di-analyze` / `di-generate` | Dependency-injection analysis and configuration. |
| `snapshots` / `rollback <id>` / `recover <id>` | Manage and restore rollback snapshots. |
| `submodule` | Manage Git submodules. |
| `migrate` | Import/export projects and manage migrations. |
| `cicd` | Generate CI/CD configurations and deployment scripts. |
| `dev` / `hotreload` (alias `hr`) | Dev mode with config hot-reloading; intelligent hot-reload. |
| `devenv` (alias `ide`) | Set up an integrated dev environment with container port forwarding. |
| `debug` | Generate debugging configurations. |

```bash
re-shell tools detect
re-shell tools cicd
re-shell tools snapshots
re-shell tools rollback <snapshot-id>
```

## `config`

Re-Shell uses layered configuration: a global `~/.re-shell/config.yaml` and a
project `.re-shell/config.yaml` with inheritance, cascading, templating, and
diff/merge.

```bash
re-shell config --help
```

| Subcommand | Purpose |
| --- | --- |
| `show` / `get <key>` / `set <key> <value>` | Inspect and edit configuration. |
| `preset <action> [name]` | Manage presets (save/load/list/delete). |
| `backup` / `restore <backup>` | Back up and restore configuration. |
| `schema` | Manage JSON schemas for IDE autocompletion. |
| `env` | Manage environment configurations. |
| `validate` | Validate configurations with detailed error messages. |
| `profile` | Manage environment-specific configuration profiles. |
| `diff` | Compare and merge configurations. |

```bash
re-shell config show
re-shell config set packageManager pnpm
re-shell config preset save my-defaults
re-shell config validate
```

## `quality`

```bash
re-shell quality --help
```

| Subcommand | Alias | Purpose |
| --- | --- | --- |
| `test` | `ut` | Universal testing across all frameworks and languages. |
| `intellisense` | `lsp` | Set up code completion and LSP integration. |

```bash
re-shell quality test
re-shell quality intellisense
```

## See also

- [doctor & analyze](/re-shell/cli/doctor-analyze/) — monorepo diagnostics.
- [workspace](/re-shell/cli/workspace/) — workspace-level config and policy.
