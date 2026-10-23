---
title: "Install"
description: "Install the Re-Shell CLI globally or per project, verify the install, and set up shell completion."
---

Re-Shell ships as a single global CLI, `@re-shell/cli`, which bundles the web
dashboard (built from `@re-shell/ui`) and depends on the typed JSON contract
(`@re-shell/contracts`). There is nothing else to install to get the CLI and the
dashboard. The MCP server, the VS Code extension, the desktop app and the control
plane are separate and optional.

## Requirements

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | **22.13.0 or newer** | Required by this CLI 0.33.0/MCP 0.3.1 release line, the previous CLI 0.32.0/MCP 0.3.0 line and the control plane (`node:sqlite`). Use this floor for the dashboard hub too. |
| Package manager | npm, yarn, pnpm, or bun | `pnpm` is the default for generated monorepos. |
| Git | optional | Recommended; `re-shell init` initializes a repo unless you pass `--no-git`. |

The CLI is offline-first: nothing it does reaches the network unless you ask it
to (installing a plugin, searching the marketplace, a configured AI provider,
`cloud deploy`, ...), and the bundled dashboard runs entirely on your machine.

## Install globally

```bash
# npm
npm install -g @re-shell/cli@latest

# yarn
yarn global add @re-shell/cli@latest

# pnpm
pnpm add -g @re-shell/cli@latest

# bun
bun add -g @re-shell/cli@latest
```

> **Which version you get.** Global installation selects the latest published
> [npm CLI version](https://www.npmjs.com/package/@re-shell/cli).
> This source tree describes the **0.33.0 release line**. The authoritative
> publication evidence is the npm entry and
> [GitHub releases](https://github.com/UmutKorkmaz/re-shell/releases). To pin a
> particular release, use `@re-shell/cli@<version>` after confirming it exists on
> npm, or [build this checkout](/re-shell/architecture/monorepo/). Building source
> does not publish a package or change npm's `latest` tag.

## Verify the installation

```bash
re-shell --version
# prints only the version installed by your package manager
```

```bash
re-shell --help
```

You should see the full command surface: top-level commands (`init`, `create`,
`ui`, `doctor`, `analyze`, ...) plus the grouped commands (`workspace`,
`templates`, `k8s`, `service`, and more). See the
[CLI Reference overview](/re-shell/cli/overview/) for the complete map.

## Run without installing

You can try the CLI without a global install using `npx`:

```bash
npx @re-shell/cli@latest --help
npx @re-shell/cli@latest templates list
```

## Shell completion

Completion is generated from the live command tree, so it always matches the
version you have installed. Install it for bash or zsh:

```bash
re-shell completion --shell zsh
re-shell completion --shell bash
```

See [`completion`](/re-shell/cli/completion/) for details (including
`completion --print`).

## The packages

| Package | This release line's source | Previous release line | Role |
| --- | --- | --- | --- |
| `@re-shell/cli` | `0.33.0` | `0.32.0` | The CLI and the bundled dashboard launcher. |
| `@re-shell/contracts` | `0.3.2` | `0.3.1` | The typed `{ ok, data, warnings }` JSON contract: wire schemas, adapters, hub transport. |
| `@re-shell/ui` | `0.7.0` | `0.6.1` | The React component system the dashboard is built from. |
| `@re-shell/mcp` | `0.3.1` | `0.3.0` | The MCP server for AI agents ([MCP](/re-shell/integrations/mcp/)). |

The hosted [control plane](/re-shell/architecture/control-plane/)
(`@re-shell/control-plane`) and dashboard are private source packages. The
[VS Code extension](/re-shell/integrations/vscode/) has a `.vsix` build artifact;
Marketplace and signed [desktop](/re-shell/integrations/desktop/) distribution
are deferred.

## Next steps

- Follow the [Quickstart](/re-shell/getting-started/quickstart/) to create a
  workspace, scaffold a service, and open the dashboard.
- Learn the [Core Concepts](/re-shell/getting-started/concepts/): workspaces,
  microfrontends + microservices, and the JSON contract.
