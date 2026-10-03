---
title: "completion"
description: "Shell completion for bash and zsh, generated from the live command tree."
---

`completion` installs tab-completion so command groups, subcommands and flags
auto-complete in your shell. The script is **generated from the live command tree** of
the CLI you have installed (the same tree `re-shell commands list` reports), so it never
lists a command that does not exist or misses one that does. It is also shipped
pre-generated in the package (`dist/completions/bash` and `dist/completions/zsh`).

```
Usage: re-shell completion [options]

Options:
  --shell <shell>  Target shell (choices: "bash", "zsh", default: "bash")
  --print          Print the completion script to stdout instead of installing it
```

## Install

```bash
# zsh
re-shell completion --shell zsh

# bash
re-shell completion --shell bash
```

After installation, restart your shell (or `source` your profile) and press `Tab` while
typing a `re-shell` command:

```bash
re-shell work<Tab>        # → workspace
re-shell workspace <Tab>  # → the workspace subcommands, taken from the live tree
re-shell ui <Tab>         # → test  component  generate  theme
```

Re-run `re-shell completion` after upgrading the CLI to pick up new commands.

## Print instead of install

`--print` writes the script to stdout and touches nothing on disk, which is what you
want for dotfile managers or a custom location:

```bash
re-shell completion --print --shell zsh  > ~/.zsh/completions/_re-shell
re-shell completion --print --shell bash > /etc/bash_completion.d/re-shell
```

Only `bash` and `zsh` are supported; any other `--shell` value is rejected.

## See also

- [CLI Overview](/re-shell/cli/overview/): the full command surface that completion exposes.
