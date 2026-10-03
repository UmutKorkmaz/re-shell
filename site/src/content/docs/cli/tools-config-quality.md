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
| `schema generate\|publish\|validate` | JSON Schema for `re-shell.workspaces.yaml` (v2): IDE configs for VS Code, IntelliJ, Vim and Emacs, and validation. |
| `env` | Manage environment configurations. |
| `validate` | Validate configurations with detailed error messages. |
| `profile` | Environment profiles: `config profile create\|list\|activate\|show\|diff\|sync\|history\|rollback\|insights\|optimize`, ... (see below). |
| `diff` | Compare and merge configurations. |

```bash
re-shell config show
re-shell config set packageManager pnpm
re-shell config preset save my-defaults
re-shell config validate
```

### Profiles

Profiles are **`config profile <verb>`** (there are no top-level `profile-*` commands).
A profile is an environment configuration with inheritance and overrides; activating one
changes the resolved configuration deterministically, and conflicts are detected.

```bash
re-shell config profile create                   # guided creation
re-shell config profile activate staging
re-shell config profile tree staging             # inheritance tree
re-shell config profile validate staging
re-shell config profile sync                     # share profiles with a team (git or a local directory)
re-shell config profile snapshot staging         # version a profile
re-shell config profile history staging
re-shell config profile rollback staging 3
re-shell dev --profile staging                   # apply a profile to the dev runtime
```

- `dev --profile <name>` resolves the profile (inheritance and overrides) and applies it
  to the dev runtime; an unknown profile is an explicit error, not a silent fallback.
- **`profile insights`** and **`profile optimize`** are computed from **recorded
  activation history** (`.re-shell/profile-analytics.json`) and the profile's own
  configuration, not from canned text. With no history, `insights` says so
  (`"No Profiles Tracked"`) instead of inventing recommendations. `optimize --apply
  <ids...>` or `--auto` applies the safe ones.

### `config schema`

The workspace definition is validated against a published JSON Schema:
`https://umutkorkmaz.github.io/re-shell/schemas/workspace-v2.json`, served by this
documentation site (the Pages workflow checks the deployed file after every deploy; the
live URL was not reachable from the environment this was written in). Generated
`re-shell.workspaces.yaml` files carry a `$schema` modeline pointing at it, and every
command that writes the file emits valid v2.

```bash
re-shell config schema validate re-shell.workspaces.yaml --json
re-shell config schema generate --ide vscode --output-dir schemas
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
