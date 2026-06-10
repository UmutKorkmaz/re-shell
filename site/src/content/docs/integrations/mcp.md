---
title: MCP Server (AI agents)
description: Expose Re-Shell's typed JSON commands to AI agents via the Model Context Protocol.
---

`@re-shell/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server that turns Re-Shell's machine-readable commands into **typed, validated tools** for AI agents.

Because every Re-Shell data command emits a stable `{ ok, data, warnings }` / `{ ok, error }` envelope — defined once in `@re-shell/contracts` — it maps cleanly onto MCP tools an agent can call to inspect and reason about a workspace, with each result validated against the contract before the agent ever sees it.

## Tools

Read-only tools (always available):

- `workspace_summary`, `workspace_graph`, `workspace_health`
- `templates_list`, `templates_show`, `templates_matrix`
- `doctor`, `analyze`, `commands_list`

Each wraps the corresponding `re-shell … --json` command. Mutating tools (e.g. `workspace_create`) are **only registered when `RE_SHELL_MCP_ALLOW_WRITE=1`** — read-only is the default.

## Run it

```bash
npx @re-shell/mcp
```

Wire it into an MCP client:

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
| `RE_SHELL_BIN` | Path to the `re-shell` binary (otherwise resolves `@re-shell/cli`) |
| `RE_SHELL_MCP_ALLOW_WRITE` | `1` to register mutating tools (off by default) |

## Safety model

- **Read-only by default**; writes are opt-in.
- **No shell** — commands run via `spawn` with an argv array (never `shell: true`).
- **Allow-listed** — only the tools above are exposed, mirroring the dashboard hub's command registry.
- **Contract-validated** — payloads are checked against `@re-shell/contracts` before being returned.

See the [JSON Contract](/re-shell/contract/json-contract/) and [Secure Hub](/re-shell/architecture/secure-hub/) pages for the underlying design.
