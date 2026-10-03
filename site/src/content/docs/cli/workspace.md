---
title: "workspace"
description: "Workspace health, dependency graph (diff, explorer), live status, policy packs, drift, and migrations."
---

The `workspace` group manages the monorepo as a whole: its health, dependency
graph, live status, version drift, policy compliance, and migrations. Most data
subcommands accept `--json` and emit the typed
[contract envelope](/re-shell/contract/json-contract/).

```bash
re-shell workspace --help
```

## Key subcommands

| Subcommand | Purpose |
| --- | --- |
| `summary` | Aggregate snapshot: root, package manager, workspaces, graph, health. |
| `health` | Comprehensive health diagnostics with a scored status. |
| `status` | **Live** status per workspace: running, stopped, unhealthy or unknown, with the reason. |
| `graph` | The dependency graph (text, json, mermaid, svg, d3); `graph diff` compares two graphs; `--interactive` opens the terminal explorer. |
| `explore` | Interactive **terminal** graph explorer (TTY only). |
| `list` / `validate` / `update` | List, validate, and update workspaces. |
| `drift` | Report dependencies pinned to different versions across the monorepo. |
| `policy check` / `search` / `install` / `list` / `remove` | Evaluate and distribute policy packs. |
| `migrate` | Migrate the **re-shell workspace config** between schema versions (default target `2.0.0`). |
| `migrate-monorepo` | Import an **Nx or Turborepo** workspace into `re-shell.workspaces.yaml` (v2). |
| `import` | Import from Nx, Turbo, Lerna, Yarn, or PNPM workspaces. |
| `diff` | Compare workspace configurations for PR reviews and impact analysis. |
| `impact` / `changes` / `ibuild` | Change-impact analysis and incremental building (`ibuild build --max-memory --rate-limit`). |

There are more subcommands (`optimize`, `docs`, `state`, `backup`, `watch`,
`conflict`, ...); run `re-shell workspace --help` for the full list.

## `workspace summary`

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
    "health": { "score": 50, "status": "critical", "checks": [] }
  },
  "warnings": []
}
```

## `workspace health`

```bash
re-shell workspace health --json
```

```json
{
  "ok": true,
  "data": {
    "score": 67,
    "status": "critical",
    "checks": [
      { "name": "Workspaces", "status": "healthy", "message": "1 workspace(s) detected", "details": ["billing (service)"] },
      { "name": "File Structure", "status": "warning", "message": "Workspace structure could be improved" },
      { "name": "Package Manager", "status": "warning", "message": "No package manager lock file detected" }
    ]
  },
  "warnings": ["Workspace structure could be improved", "No package manager lock file detected"]
}
```

Outside a monorepo the command exits non-zero with `NOT_IN_MONOREPO`.

## `workspace status`

Static commands (`summary`, `graph`) say what the workspace *is*; `status` says whether
it is **running right now**. For each workspace it combines the evidence that can
actually be gathered: a probe of the configured port, an HTTP probe of the health URL,
and the supervised-process record left by [`service run`](/re-shell/cli/service-bridge/#running-services).
The result is `running`, `stopped`, `unhealthy` or `unknown`, and `unknown` always comes
with the reason (for example "no port or health URL configured, and no supervised
process record"): a node is never reported running without evidence.

```bash
re-shell workspace status
re-shell workspace status --json
re-shell workspace status --allow-remote-probes    # also probe health URLs that are not loopback
```

```json
{
  "ok": true,
  "data": {
    "nodes": [
      {
        "name": "billing", "path": "services/billing", "status": "unknown",
        "reason": "dev: no port or health URL configured, and no supervised process record (2 services checked)",
        "checks": [{ "name": "dev", "status": "unknown", "source": "none", "reason": "no port or health URL configured, and no supervised process record" }]
      }
    ],
    "summary": { "running": 0, "stopped": 0, "unhealthy": 0, "unknown": 1 }
  },
  "warnings": []
}
```

(Abbreviated.) By default only loopback addresses are probed; probing a remote host
needs `--allow-remote-probes`. The dashboard's Workspace Graph colours nodes with this
same data.

## `workspace graph`

```
Usage: re-shell workspace graph [options] [command]

Options:
  --output <file>    Output file path
  --format <format>  Output format (text, json, mermaid, svg, d3) (default: "text")
  --json             Alias of --format json
  --interactive      Open the interactive terminal graph explorer (TTY only)

Commands:
  diff               Diff the workspace dependency graph between a base and a head
```

```bash
re-shell workspace graph --format mermaid --output graph.mmd
re-shell workspace graph --json
```

The JSON shape partitions the workspace into `{ apps, services }`, the same topology the
dashboard's [Workspace Graph](/re-shell/dashboard/overview/#the-workspace-graph-explorer)
screen renders.

### `workspace graph diff`

Compares the dependency graph between a **base** and a **head**, each a git ref (branch,
tag, SHA, `HEAD~1`), a saved graph `.json` file, or (for the head, the default) the
working tree:

```bash
re-shell workspace graph diff --base main                       # what does my branch change?
re-shell workspace graph diff --base v1.2.0 --head HEAD --format mermaid --output diff.mmd
re-shell workspace graph diff --base base-graph.json --json
```

The report lists nodes and edges added, removed and changed, **cycles introduced**,
and a summary. Output: `text`, `json` or `mermaid`. (The dashboard hub refuses an
unsafe git ref before running anything.) Example against a fresh workspace (head is the working tree):

```json
{
  "ok": true,
  "data": {
    "nodes": { "added": [{ "id": "billing", "type": "service", "language": "typescript", "path": "services/billing" }], "removed": [], "changed": [] },
    "edges": { "added": [], "removed": [], "changed": [] },
    "cyclesIntroduced": [],
    "summary": { "nodesAdded": 1, "nodesRemoved": 0, "nodesChanged": 0, "edgesAdded": 0, "edgesRemoved": 0, "edgesChanged": 0, "hasChanges": true },
    "base": { "ref": "HEAD", "kind": "git", "nodeCount": 0, "edgeCount": 0 },
    "head": { "ref": "working-tree", "kind": "working-tree", "nodeCount": 1, "edgeCount": 0 }
  },
  "warnings": []
}
```

### `workspace explore`

A keyboard-driven **terminal** explorer: search, focus a node, follow dependency paths,
live refresh from file watching and a status poll (`--status-interval <ms>`,
`--no-watch`, `--no-status`). It needs a TTY. For a browser version with filters,
paths, cycles, diff, six export formats and 2000+ node support, use the
[dashboard](/re-shell/dashboard/overview/#the-workspace-graph-explorer).

## `workspace drift`

Reports dependencies that are pinned to different versions across packages, a common
source of subtle bugs in a monorepo.

```bash
re-shell workspace drift --json
```

```json
{ "ok": true, "data": { "drift": [] }, "warnings": [] }
```

## `workspace policy`

Policy packs are declarative YAML or JSON rule files. `policy check` evaluates one and
computes a deterministic **0 to 100** readiness score; the others distribute packs.

| Subcommand | Does |
| --- | --- |
| `policy check [--pack <name\|file>]` | Evaluate a built-in pack (`recommended`, `baseline`), an installed pack, or a pack file. |
| `policy list` | List built-in and installed packs. |
| `policy search [query]` | Search the npm registry for packs (keyword `reshell-policy-pack`; `--limit`, `--registry`). |
| `policy install <source>` | Install from an npm package, git URL, package directory or pack file into `.re-shell/policy-packs` (`--force`, `--dry-run`, `--verify` / `--no-verify`). |
| `policy remove <name>` | Remove an installed pack. |

**Rule types** a pack may use: `required-files` (every workspace has these files),
`required-scripts` (every `package.json` defines these scripts), `dependency-constraints`
(a dependency's declared range must match), `naming` (package names match a regular
expression; the pattern is validated when the pack is installed), `min-node` (root
`engines.node` is at least a version) and `license` (workspace licenses are in an
allowed list). Each rule has a severity, `error` or `warning`; failed `error` rules
make the check fail.

```bash
re-shell workspace policy list
re-shell workspace policy check --pack recommended --json
re-shell workspace policy search "security baseline"
re-shell workspace policy install my-org-policy-pack --verify
```

```json
{
  "ok": true,
  "data": {
    "pack": "recommended",
    "source": "builtin",
    "score": 50,
    "passed": ["required-scripts-build-test", "naming-lowercase"],
    "failed": [
      { "ruleId": "required-files-readme", "severity": "warning", "message": "Missing required file: README.md", "target": "billing" },
      { "ruleId": "min-node-18", "severity": "warning", "message": "Root engines.node \">=16.0.0\" is below required 18.0.0", "target": "<root>" }
    ]
  },
  "warnings": ["[billing] Missing required file: README.md", "[<root>] Root engines.node \">=16.0.0\" is below required 18.0.0"]
}
```

Installing a pack from npm is a network operation. The pack-distribution code is tested
against a fake registry; no claim is made about packs on the live npm registry. The
policy results are also the evidence behind
[`security compliance report`](/re-shell/cli/security-audit/).

## `workspace migrate` and `workspace migrate-monorepo`

These are two different commands.

- `workspace migrate` upgrades a **re-shell** workspace configuration between schema
  versions (`--from`, `--to`, default `2.0.0`; `--dry-run`; a backup is made unless
  `--no-backup`).
- `workspace migrate-monorepo` **imports** an Nx or Turborepo workspace into a
  `re-shell.workspaces.yaml` (v2) file:

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

Every command that writes `re-shell.workspaces.yaml` emits a valid v2 file that
validates against the hosted JSON Schema
(`https://umutkorkmaz.github.io/re-shell/schemas/workspace-v2.json`; see
[`config schema`](/re-shell/cli/tools-config-quality/)).

## See also

- [JSON Contract](/re-shell/contract/json-contract/): envelope and error codes.
- [Architecture: Monorepo](/re-shell/architecture/monorepo/).
- [Dashboard](/re-shell/dashboard/overview/): the Graph and Health screens.
