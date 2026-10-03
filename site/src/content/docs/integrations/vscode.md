---
title: "VS Code extension"
description: "Browse a workspace, build vetted commands and run them from VS Code, in a terminal or through the local hub."
---

The Re-Shell extension is a thin renderer over the `re-shell` CLI. Everything it
shows comes from the CLI's `--json` commands, validated against the shared
`@re-shell/contracts` envelope; a malformed or `ok:false` payload surfaces an error
instead of being trusted. Source and full README:
[`apps/vscode-extension`](https://github.com/UmutKorkmaz/re-shell/tree/main/apps/vscode-extension).

> **Not on the Marketplace.** The package is `re-shell` version `0.3.0`, private, and is
> installed from a `.vsix`. **The VS Code host test was not run in the environment this
> was developed in** (it downloads VS Code from `update.code.visualstudio.com`, which
> was blocked); it runs in the `VS Code Extension` workflow, pending its first hosted run.
> The unit and real-hub integration suites (built CLI and hub, no editor) do run
> without VS Code.

## What it does

- **Views** in a Re-Shell activity-bar container: **Projects** (apps and packages from
  `workspace graph --json` with health markers), **Commands** (the catalog from
  `commands list --json`, grouped by category) and **Templates**
  (`templates list --json`, grouped by language and framework).
- **Re-Shell: Build Command**: pick a catalog command, fill in its arguments, and get a
  vetted `CommandSpec` (id, argv, working directory, destructive and dry-run flags)
  written to the output channel. Nothing runs; you can then run it in a terminal, copy
  it, or, for allow-listed commands, run it via the hub.
- **Re-Shell: Run via Hub**: build a spec for an allow-listed catalog command and run it
  through your local hub. The job result (exit code and the CLI's JSON envelope) is
  reported back. Success requires exit `0` **and** a valid `ok:true` envelope.
- Run Command, Run Doctor, Create Project, Refresh, Open Terminal, Show Output, per-project
  Build / Serve / Test, and a status-bar health item.

Values you type are never spliced into a shell string: every argument goes through a pure
command builder that accepts only safe identifiers and catalog-declared flags, so
`foo; rm -rf ~` fails the build instead of reaching a terminal or the hub. Destructive
commands ask for confirmation first.

## Install

```bash
# from a checkout
pnpm install
pnpm --filter re-shell run package     # builds, packages and verifies the .vsix
code --install-extension apps/vscode-extension/re-shell-0.3.0.vsix
```

Or download the `re-shell-vscode-extension` artifact of a `VS Code Extension` workflow
run. Requires VS Code 1.85 or newer and the CLI on `PATH` (or `reShell.cliBin`). The
extension runs only in trusted workspaces.

## Run via the hub

Start the dashboard (`re-shell ui` prints the hub URL and token), then set
`reShell.hub.url` (default `http://127.0.0.1:3334`, must be loopback) and
`reShell.hub.token` in your **user** settings (or `RE_SHELL_UI_HUB_URL` and
`RE_SHELL_UI_HUB_TOKEN`). All four settings are machine-scoped, so a workspace's
`.vscode/settings.json` cannot choose which program is launched or which server
receives the token. Only the hub's allow-list runs through it: `workspace summary`,
`graph`, `health`, `list`, `validate`, `templates list`, `commands list`, `doctor` and
`analyze`; it cannot forward extra flags (use a terminal for those).

## See also

- [Dashboard](/re-shell/dashboard/overview/) and [Secure Hub](/re-shell/architecture/secure-hub/)
- [CLI overview](/re-shell/cli/overview/): `commands list --json` is the catalog it renders.
