# @re-shell/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that exposes Re-Shell's machine-readable commands to AI agents as **typed, validated tools**, plus read-only resources and prompts.

> Part of the [Re-Shell monorepo](https://github.com/UmutKorkmaz/re-shell). Version in this tree: **0.2.0** (published: 0.1.0).

Re-Shell emits a stable `{ ok, data, warnings }` / `{ ok, error }` envelope (the single source of truth is [`@re-shell/contracts`](../contracts)). This server wraps the allow-listed, JSON-emitting commands so an MCP-capable agent can inspect and reason about a workspace **safely**: read-only by default, and every result validated against the exact wire schema before the agent sees it.

## Tools

Read-only (always registered):

| Tool | Wraps | Returns |
|------|-------|---------|
| `workspace_summary` | `re-shell workspace summary --json` | workspace overview envelope |
| `workspace_graph` | `re-shell workspace graph --json` | dependency graph envelope |
| `workspace_health` | `re-shell workspace health --json` | health summary envelope |
| `templates_list` | `re-shell templates list --json` | template catalog (optional language/framework filter) |
| `templates_show` | `re-shell templates show <id> --json` | one template |
| `templates_matrix` | `re-shell templates matrix --json` | compatibility matrix |
| `doctor` | `re-shell doctor --json` | diagnostics |
| `analyze` | `re-shell analyze --json` | workspace analysis |
| `commands_list` | `re-shell commands list --json` | command catalog |

Opt-in write tools, registered **only when `RE_SHELL_MCP_ALLOW_WRITE=1`**:

| Tool | Does |
|------|------|
| `workspace_create` | `re-shell workspace init <name> --json` |
| `scaffold_service` | Runs `re-shell generate service <name> --json`; when `name` is missing it asks the host for it through MCP elicitation instead of failing |

## Resources and prompts

Resources (read-only, JSON): `reshell://workspace/summary`, `reshell://workspace/graph`, `reshell://workspace/health`, `reshell://scorecard` (production-readiness scorecard) and `reshell://contracts/commands` (the command catalog).

Prompts: `scaffold-service` (turn a description into a reviewable dry-run plan of real commands) and `diagnose-drift` (diagnose dependency drift and readiness gaps from the scorecard and health resources). Prompt arguments are treated as untrusted data.

## How it works

Each tool spawns the built Re-Shell CLI (`spawn`, argv array, no shell) with `--json`, parses stdout, and validates it against the matching **wire schema** from `@re-shell/contracts` (the `*WireSchema` exports, e.g. `workspaceSummaryWireSchema`) before returning it. A non-zero exit that still emits a valid **error** envelope is returned as-is, so the agent sees the CLI's own `code` and `message`; non-JSON or schema-invalid output is surfaced as an MCP error. Fields a newer CLI adds are passed through untouched. Output is capped at 8 MiB and each call has a 120 s backstop timeout.

The CLI is located automatically: `@re-shell/cli` is a **declared dependency** of this package, so a standalone install is enough and **`RE_SHELL_BIN` is not required**. Resolution order: `RE_SHELL_BIN` (optional override) then `require.resolve('@re-shell/cli')` then a monorepo fallback to `packages/cli/dist/index.js`. The `re-shell-mcp` bin resolves symlinks (`realpath`), so it starts correctly through `node_modules/.bin` as `npx` runs it.

## Usage

```bash
npx @re-shell/mcp
```

Wire it into an MCP client (config excerpt):

```json
{
  "mcpServers": {
    "re-shell": {
      "command": "npx",
      "args": ["-y", "@re-shell/mcp"]
    }
  }
}
```

| Env var | Purpose |
|---------|---------|
| `RE_SHELL_BIN` | Optional path to a specific CLI entry (`dist/index.js`) instead of the installed `@re-shell/cli` dependency |
| `RE_SHELL_MCP_ALLOW_WRITE` | Set to `1` to register the write tools (off by default) |

The server reports its package version to the client in the MCP `initialize` result.

## Safety

- **Read-only by default**: write tools require explicit opt-in.
- **No shell**: commands run via `spawn` with an argv array, never `shell: true`.
- **Allow-listed**: only the commands above are exposed (they mirror the dashboard hub's command registry).
- **Contract-validated**: every payload is checked against the `@re-shell/contracts` wire schemas before it reaches the agent.

## Development

`pnpm --filter @re-shell/mcp test` builds `dist/` first and then runs the built `bin` (through a symlink, as `npx` does) against the real CLI: an MCP `initialize` + `tools/list` handshake over stdio, every read-only tool and resource, and a check that the published tarball contains no test files. Build the CLI first (`pnpm -r build`). The repository's `node scripts/pack-smoke.mjs` additionally packs this package with the CLI and contracts, installs the tarballs in a clean directory outside the repo and runs the MCP handshake against the installed `re-shell-mcp`.
