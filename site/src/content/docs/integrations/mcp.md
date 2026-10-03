---
title: MCP Server (AI agents)
description: Expose Re-Shell's typed JSON commands to AI agents via the Model Context Protocol, read-only by default.
---

`@re-shell/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server that turns Re-Shell's machine-readable commands into **typed, validated tools**, plus read-only resources and prompts, for AI agents. Version in this tree: `0.2.0` (last published: `0.1.0`).

Because every Re-Shell data command emits a stable `{ ok, data, warnings }` / `{ ok, error }` envelope, defined once in `@re-shell/contracts`, it maps cleanly onto MCP tools an agent can call to inspect and reason about a workspace. Each result is validated against the **exact wire schema** the contract publishes for that command before the agent sees it.

## Tools

Read-only tools (always registered):

- `workspace_summary`, `workspace_graph`, `workspace_health`
- `templates_list`, `templates_show`, `templates_matrix`
- `doctor`, `analyze`, `commands_list`

Each wraps the corresponding `re-shell ... --json` command. Write tools are **only registered when `RE_SHELL_MCP_ALLOW_WRITE=1`**:

- `workspace_create` (`workspace init <name> --json`)
- `scaffold_service` (`generate service <name> --json`; if `name` is missing it asks the host for it through MCP elicitation instead of failing)

## Resources and prompts

- Resources (read-only JSON): `reshell://workspace/summary`, `reshell://workspace/graph`, `reshell://workspace/health`, `reshell://scorecard`, `reshell://contracts/commands`.
- Prompts: `scaffold-service` (a reviewable, dry-run plan of real commands) and `diagnose-drift` (dependency drift and readiness gaps from the scorecard and health resources). Prompt arguments are treated as untrusted data.

## Run it

```bash
npx @re-shell/mcp
```

`@re-shell/cli` is a **declared dependency** of the package, so a standalone install is enough: you do **not** need to set `RE_SHELL_BIN`. The `re-shell-mcp` bin resolves symlinks, so it starts correctly through `node_modules/.bin` the way `npx` runs it. Wire it into an MCP client:

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
| `RE_SHELL_BIN` | Optional override: a specific CLI entry (`dist/index.js`) instead of the installed `@re-shell/cli` |
| `RE_SHELL_MCP_ALLOW_WRITE` | `1` to register the write tools (off by default) |

CLI resolution order: `RE_SHELL_BIN`, then `require.resolve('@re-shell/cli')`, then (in the monorepo) `packages/cli/dist/index.js`. The server runs inside the workspace directory you start it from.

## Safety model

- **Read-only by default**; writes are opt-in.
- **No shell**: commands run via `spawn` with an argv array (never `shell: true`), with an 8 MiB output cap and a 120 s backstop timeout.
- **Allow-listed**: only the tools above are exposed, mirroring the dashboard hub's command registry.
- **Contract-validated**: payloads are checked against `@re-shell/contracts` wire schemas before being returned; a CLI error envelope is passed through so the agent sees the real `code` and `message`.

## What was tested

The package's tests build `dist/` and run the built bin **through a symlink** (as `npx` does) against the real CLI: the MCP `initialize` and `tools/list` handshake over stdio, every read-only tool and resource, and a check that the published tarball contains no test files. The repository's `node scripts/pack-smoke.mjs` also packs the package together with the CLI and contracts, installs the tarballs in a clean directory outside the repo and runs the handshake against the installed `re-shell-mcp`.

See the [JSON Contract](/re-shell/contract/json-contract/) and [Secure Hub](/re-shell/architecture/secure-hub/) pages for the underlying design.
