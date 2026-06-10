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

Each tool spawns the built Re-Shell CLI (`spawn`, no shell) with `--json`, parses stdout, and validates it against the matching `@re-shell/contracts` zod schema before returning it. A non-zero exit that still emits a valid **error** envelope is returned (so the agent sees the CLI's own `code`/`message`); non-JSON or schema-invalid output is surfaced as an MCP error.

## Usage

```bash
# requires @re-shell/cli to be resolvable (installed, or RE_SHELL_BIN set)
npx @re-shell/mcp
```

Wire it into an MCP client (config excerpt):

```json
{
  "mcpServers": {
    "re-shell": {
      "command": "npx",
      "args": ["-y", "@re-shell/mcp"],
      "env": { "RE_SHELL_BIN": "/abs/path/to/re-shell" }
    }
  }
}
```

| Env var | Purpose |
|---------|---------|
| `RE_SHELL_BIN` | Path to the `re-shell` binary (falls back to resolving `@re-shell/cli`) |
| `RE_SHELL_MCP_ALLOW_WRITE` | Set to `1` to register mutating tools (off by default) |

## Safety

- **Read-only by default** — mutating tools require explicit opt-in.
- **No shell** — commands run via `spawn` with an argv array, never `shell: true`.
- **Allow-listed** — only the commands above are exposed (mirrors the dashboard hub's registry).
- **Contract-validated** — every payload is checked against `@re-shell/contracts` before reaching the agent.
