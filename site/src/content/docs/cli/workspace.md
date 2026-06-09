---
title: "workspace"
description: "Workspace health, dependency graph, topology, and sync management."
---

The `workspace` group manages the monorepo as a whole: its health, dependency
graph, version drift, policy compliance, and migrations from other monorepo
tools. Most data subcommands accept `--json` and emit the typed
[contract envelope](/re-shell/contract/json-contract/).

```bash
re-shell workspace --help
```

## Key subcommands

| Subcommand | Purpose |
| --- | --- |
| `summary` | Aggregate snapshot: root, package manager, workspaces, graph, health. |
| `health` | Comprehensive health diagnostics with a scored status. |
| `graph` | Generate the dependency graph (text, json, mermaid, svg, d3). |
| `list` / `validate` / `update` | List, validate, and update workspaces. |
| `drift` | Report dependencies pinned to different versions across the monorepo. |
| `policy check` | Evaluate declarative policy packs and compute a 0–100 readiness score. |
| `migrate-monorepo` | Import an Nx or Turborepo workspace into `re-shell.workspaces.yaml` (v2). |
| `import` | Import from Nx, Turbo, Lerna, Yarn, or PNPM workspaces. |
| `diff` | Compare workspace configurations for PR reviews and impact analysis. |
| `impact` / `changes` / `ibuild` | Change-impact analysis and incremental building. |

There are more subcommands (`optimize`, `docs`, `state`, `backup`, `watch`,
`conflict`, …) — run `re-shell workspace --help` for the full list.

## `workspace summary`

```
Usage: re-shell workspace summary [options]

Options:
  --json   Emit machine-readable JSON envelope to stdout
```

```bash
re-shell workspace summary --json
```

```json
{
  "ok": true,
  "data": {
    "root": "/abs/path/to/monorepo",
    "packageManager": "npm",
    "workspaces": [],
    "graph": { "apps": [], "services": [] },
    "health": {
      "score": 50,
      "status": "critical",
      "checks": [
        { "name": "Workspaces", "status": "warning", "message": "No workspaces found in monorepo" }
      ]
    }
  },
  "warnings": []
}
```

## `workspace health`

```
Usage: re-shell workspace health [options]

Options:
  --json      Output health results as JSON
  --verbose   Show detailed health information
```

```bash
re-shell workspace health --json
```

```json
{
  "ok": true,
  "data": {
    "score": 50,
    "status": "critical",
    "checks": [
      { "name": "Workspaces", "status": "warning", "message": "No workspaces found in monorepo" },
      { "name": "File Structure", "status": "warning", "message": "Workspace structure could be improved" },
      { "name": "Package Manager", "status": "warning", "message": "No package manager lock file detected" }
    ]
  },
  "warnings": ["No workspaces found in monorepo", "Workspace structure could be improved"]
}
```

## `workspace graph`

```
Usage: re-shell workspace graph [options]

Options:
  --output <file>    Output file path
  --format <format>  Output format (text, json, mermaid, svg, d3) (default: "text")
  --json             Alias of --format json
```

```bash
re-shell workspace graph --format mermaid --output graph.mmd
re-shell workspace graph --json
```

The JSON shape partitions the workspace into `{ apps, services }` — the same
topology the dashboard's [Workspace Graph](/re-shell/dashboard/overview/) screen
renders with React Flow.

## `workspace drift`

Reports dependencies that are pinned to different versions across packages — a
common source of subtle bugs in a monorepo.

```bash
re-shell workspace drift --json
```

```json
{ "ok": true, "data": { "drift": [] }, "warnings": [] }
```

## `workspace policy check`

Evaluates a declarative policy pack (built-in `recommended` / `baseline`, or a
path to a YAML/JSON pack) and computes a deterministic readiness score.

```
Usage: re-shell workspace policy check [options]

Options:
  --pack <file>  Built-in pack name (recommended, baseline) or path to a YAML/JSON pack
  --json         Emit machine-readable JSON envelope to stdout
```

```bash
re-shell workspace policy check --pack baseline --json
```

```json
{
  "ok": true,
  "data": {
    "score": 0,
    "passed": ["required-files-readme", "required-scripts-build-test", "naming-lowercase"],
    "failed": [
      {
        "ruleId": "min-node-18",
        "severity": "warning",
        "message": "Root engines.node \">=16.0.0\" is below required 18.0.0",
        "target": "<root>"
      }
    ]
  },
  "warnings": ["[<root>] Root engines.node \">=16.0.0\" is below required 18.0.0"]
}
```

## `workspace migrate-monorepo`

Imports an Nx or Turborepo workspace into a `re-shell.workspaces.yaml` (v2) file.

```
Usage: re-shell workspace migrate-monorepo [options]

Options:
  --from <tool>    Source monorepo tool (nx, turbo)
  --output <path>  Output path for the generated workspace YAML
  --dry-run        Print the would-be YAML without writing any file
  --json           Emit a single JSON envelope { detected, yaml } to stdout
```

```bash
re-shell workspace migrate-monorepo --from turbo --dry-run
re-shell workspace migrate-monorepo --from nx --output re-shell.workspaces.yaml
```

## See also

- [JSON Contract](/re-shell/contract/json-contract/) — envelope and error codes.
- [Architecture: Monorepo](/re-shell/architecture/monorepo/).
- [Dashboard](/re-shell/dashboard/overview/) — the Graph and Health screens.
