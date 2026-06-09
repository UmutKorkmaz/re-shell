---
title: "Install"
description: "Install the Re-Shell CLI globally or per project, verify the install, and set up shell completion."
---

Re-Shell ships as a single global CLI — `@re-shell/cli` — that bundles the web
dashboard (`@re-shell/ui`) and the typed JSON contract (`@re-shell/contracts`).
There is nothing else to install to get the full platform.

## Requirements

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | **18 or newer** | The workspace policy packs enforce `engines.node >= 18`. |
| Package manager | npm, yarn, pnpm, or bun | `pnpm` is the default for generated monorepos. |
| Git | optional | Recommended; `re-shell init` initializes a repo unless you pass `--no-git`. |

The CLI is offline-first: nothing it does reaches the network beyond the registry
download, and the bundled dashboard runs entirely on your machine.

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

## Verify the installation

```bash
re-shell --version
# 0.29.2
```

```bash
re-shell --help
```

You should see the full command surface — top-level commands (`init`, `create`,
`ui`, `doctor`, `analyze`, …) plus the grouped commands (`workspace`,
`templates`, `k8s`, `service`, and more). See the
[CLI Reference overview](/re-shell/cli/overview/) for the complete map.

## Run without installing

You can try the CLI without a global install using `npx`:

```bash
npx @re-shell/cli --help
npx @re-shell/cli templates list
```

## Shell completion

Install tab-completion for bash or zsh so command groups, subcommands, and flags
auto-complete:

```bash
re-shell completion --shell zsh
re-shell completion --shell bash
```

See [`completion`](/re-shell/cli/completion/) for details.

## What you get

| Package | Version | Role |
| --- | --- | --- |
| `@re-shell/cli` | `0.29.2` | The CLI and the bundled dashboard launcher. |
| `@re-shell/ui` | `0.3.0` | The React component system the dashboard is built from. |
| `@re-shell/contracts` | `0.1.0` | The typed `{ ok, data, warnings }` JSON contract. |

## Next steps

- Follow the [Quickstart](/re-shell/getting-started/quickstart/) to create a
  workspace, scaffold a service, and open the dashboard.
- Learn the [Core Concepts](/re-shell/getting-started/concepts/) — workspaces,
  microfrontends + microservices, and the JSON contract.
