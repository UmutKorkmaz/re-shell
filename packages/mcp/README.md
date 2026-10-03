# @re-shell/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that exposes Re-Shell's machine-readable commands to AI agents as **typed, validated tools**.

Re-Shell already emits a stable `{ ok, data, warnings }` / `{ ok, error }` envelope (the single source of truth lives in [`@re-shell/contracts`](../contracts)). This server wraps the allow-listed, JSON-emitting commands so an MCP-capable agent can inspect and reason about a workspace **safely** — read-only by default, every result validated against the contract schema.

## Tools

Read-only (always available):

| Tool | Wraps | Returns |
|------|-------|---------|
| `workspace_summary` | `re-shell workspace summary --json` | workspace overview envelope |
| `workspace_graph` | `re-shell workspace graph --json` | dependency graph envelope |
| `workspace_health` | `re-shell workspace health --json` | health summary envelope |
| `templates_list` | `re-shell templates list --json` | template catalog |
| `templates_show` | `re-shell templates show <id> --json` | one template |
| `templates_matrix` | `re-shell templates matrix --json` | compatibility matrix |
| `doctor` | `re-shell doctor --json` | diagnostics |
| `analyze` | `re-shell analyze --json` | workspace analysis |
| `commands_list` | `re-shell commands list --json` | command catalog |

Write tools (e.g. `workspace_create`) are **only registered when `RE_SHELL_MCP_ALLOW_WRITE=1`** is set.

## How it works

Each tool spawns the built Re-Shell CLI (`spawn`, no shell) with `--json`, parses stdout, and validates it against the matching **wire schema** from `@re-shell/contracts` (the `*WireSchema` exports, e.g. `workspaceSummaryWireSchema`, `templatesListWireSchema`) before returning it. Wire schemas describe exactly what the CLI prints, so validation passes against a real workspace; the UI/domain models in the same package are *not* used for raw CLI output. A non-zero exit that still emits a valid **error** envelope is returned (so the agent sees the CLI's own `code`/`message`); non-JSON or schema-invalid output is surfaced as an MCP error. Fields a newer CLI adds are passed through untouched.

## Usage

```bash
# @re-shell/cli is a dependency of this package, so a standalone install is enough
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
| `RE_SHELL_BIN` | Optional path to a specific CLI entry (`dist/index.js`) to use instead of the installed `@re-shell/cli` dependency |
| `RE_SHELL_MCP_ALLOW_WRITE` | Set to `1` to register mutating tools (off by default) |

## Safety

- **Read-only by default** — mutating tools require explicit opt-in.
- **No shell** — commands run via `spawn` with an argv array, never `shell: true`.
- **Allow-listed** — only the commands above are exposed (mirrors the dashboard hub's registry).
- **Contract-validated** — every payload is checked against the `@re-shell/contracts` wire schemas before reaching the agent.

## Development

`pnpm --filter @re-shell/mcp test` builds `dist/` first and then runs the built `bin` (through a symlink, as `npx` does) against the real CLI: an MCP `initialize` + `tools/list` handshake over stdio, every read-only tool and resource, and a check that the published tarball contains no test files. Build the CLI first (`pnpm -r build`).
