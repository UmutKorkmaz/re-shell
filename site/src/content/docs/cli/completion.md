---
title: "completion"
description: "Install shell completion scripts."
---

`completion` installs tab-completion scripts so command groups, subcommands, and
flags auto-complete in your shell.

```
Usage: re-shell completion [options]

Options:
  --shell <shell>  Target shell (bash | zsh) (default: "bash")
```

## Install

```bash
# zsh
re-shell completion --shell zsh

# bash
re-shell completion --shell bash
```

```
Installing Shell Completion

Installing zsh completion...
```

After installation, restart your shell (or `source` your profile) and press
`Tab` while typing a `re-shell` command:

```bash
re-shell work<Tab>        # → workspace
re-shell workspace <Tab>  # → summary  health  graph  drift  policy  ...
re-shell templates list --<Tab>  # → --json  --language  --framework
```

## See also

- [CLI Overview](/re-shell/cli/overview/) — the full command surface that
  completion exposes.
