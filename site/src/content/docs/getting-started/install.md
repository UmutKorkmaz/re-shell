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
| Node.js | **18 or newer** | The CLI, the dashboard hub and the MCP server run on Node 18+. The control plane needs **22.13+** (it uses `node:sqlite`). |
| Package manager | npm, yarn, pnpm, or bun | `pnpm` is the default for generated monorepos. |
| Git | optional | Recommended; `re-shell init` initializes a repo unless you pass `--no-git`. |

The CLI is offline-first: nothing it does reaches the network unless you ask it
to (installing a plugin, searching the marketplace, a configured AI provider,
`cloud deploy`, ...), and the bundled dashboard runs entirely on your machine.

## Install globally

```bash
# npm
npm install -g @re-shell/cli

# yarn
yarn global add @re-shell/cli

# pnpm
pnpm add -g @re-shell/cli

# bun
bun add -g @re-shell/cli
```

> **Which version you get.** The last version published to npm is **0.30.1**. The
> source tree is at **0.31.0**, which has not been published yet. Everything on
> this site describes the 0.31.0 tree; commands and flags marked as new in the
> [changelog](https://github.com/UmutKorkmaz/re-shell/blob/main/packages/cli/CHANGELOG.md)
> "Unreleased" section are not in 0.30.1. To use them today, build from the
> repository (see [Monorepo](/re-shell/architecture/monorepo/)).

## Verify the installation

```bash
re-shell --version
# prints only the version, for example: 0.31.0
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
npx @re-shell/cli --help
npx @re-shell/cli templates list
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

| Package | In this tree | Last published | Role |
| --- | --- | --- | --- |
| `@re-shell/cli` | `0.31.0` | `0.30.1` | The CLI and the bundled dashboard launcher. |
| `@re-shell/contracts` | `0.3.0` | `0.2.0` | The typed `{ ok, data, warnings }` JSON contract: wire schemas, adapters, hub transport. |
| `@re-shell/ui` | `0.6.0` | `0.5.0` | The React component system the dashboard is built from. |
| `@re-shell/mcp` | `0.2.0` | `0.1.0` | The MCP server for AI agents ([MCP](/re-shell/integrations/mcp/)). |

Not published: the hosted [control plane](/re-shell/architecture/control-plane/)
(`@re-shell/control-plane`, private), the dashboard app, the
[VS Code extension](/re-shell/integrations/vscode/) (a `.vsix` build artifact)
and the [desktop app](/re-shell/integrations/desktop/).

## Next steps

- Follow the [Quickstart](/re-shell/getting-started/quickstart/) to create a
  workspace, scaffold a service, and open the dashboard.
- Learn the [Core Concepts](/re-shell/getting-started/concepts/): workspaces,
  microfrontends + microservices, and the JSON contract.
