---
title: "ui"
description: "Launch the dashboard, run the Storybook test gate, scaffold and generate components, and manage theme packs."
---

`re-shell ui` launches the [dashboard](/re-shell/dashboard/overview/). It also has
four subcommands for working on the UI itself: `test`, `component`, `generate` and
`theme`.

```bash
re-shell ui --help
```

| Command | Purpose |
| --- | --- |
| `ui` | Launch the dashboard (see [Dashboard](/re-shell/dashboard/overview/)). Fails if the hub is not healthy. |
| `ui test` | Run Storybook interaction, accessibility and visual tests and **gate CI on the result**. |
| `ui component new <name>` | Scaffold a component, its Storybook story and its test. |
| `ui generate` | Generate a component from a description (AI provider if configured, offline otherwise). |
| `ui theme install\|list\|search\|remove` | Manage dashboard theme packs. |

## `ui test`

The real test runner for a component library's Storybook. It builds the Storybook (or
serves a prebuilt one), runs every story's `play` function, an **axe** accessibility
check and a **visual snapshot** comparison with the Storybook test runner in Chromium,
and reports each pillar.

```bash
re-shell ui test                                       # find a Storybook in the workspace
re-shell ui test --storybook packages/ui --ci --json
re-shell ui test --static-dir packages/ui/storybook-static --gate a11y,visual
re-shell ui test --url https://storybook.example.com   # test a hosted Storybook
re-shell ui test --update-snapshots                    # refresh the visual baselines
```

Options: `--gate <pillars>` (comma-separated pillars that gate CI; default `a11y,visual`),
`--ci` (a missing visual baseline is a failure instead of being written), `--browser
<path>` (Chromium executable, or `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`), `--timeout
<ms>`, `--workspace`, `--storybook`, `--url`, `--static-dir`, `--json`.

It cannot pass by doing nothing: **no Storybook found, an empty run, or an invalid gate
configuration is `UI_TEST_ERROR`**, never a pass. The repository's own CI runs it as
`re-shell ui test --storybook packages/ui --static-dir packages/ui/storybook-static --ci --json`
(the `storybook` job, which passes on GitHub, PR #395; its visual baselines are rendered in CI's own Chromium, the Playwright 1.61.1 image).

## `ui component new`

```bash
re-shell ui component new StatusPill --group re-shell --description "A pill that shows a status"
re-shell ui component new Widget --dry-run --json
```

Creates the component, a Storybook story with a `play` test, and a vitest + axe test in
the UI package, following the conventions of `@re-shell/ui`. `--group` is `ui` (shadcn
primitives, default), `re-shell` (domain components) or `primitives`. The UI package is
detected (a package with `src/components/ui`) or given with `--ui <dir>`; if none is
found the command fails with `UI_COMPONENT_ERROR`. `--force` overwrites.

## `ui generate`

```bash
re-shell ui generate --prompt "a table of services with name, port and status" --name ServiceTable
re-shell ui generate --prompt "a toggle for dark mode" --offline --dry-run
```

Generates a component (TSX, story and test) from a description. With an AI provider
configured (see [ai](/re-shell/cli/ai/)) the provider writes it; with none, or with
`--offline`, an offline template generator produces a conventional component. Either
way the output is **typechecked** before it is written, and `--dry-run` prints the code
without writing anything. A provider call was not exercised live while writing this
documentation; the offline generator and the typecheck gate are covered by tests.

## `ui theme`

```bash
re-shell ui theme search ocean
re-shell ui theme install reshell-theme-ocean            # npm package tagged reshell-theme
re-shell ui theme install ./my-theme.json --dry-run
re-shell ui theme install https://example.com/theme.json
re-shell ui theme list
re-shell ui theme remove ocean
```

Theme packs are JSON token sets (OKLCH colours for light and dark, a corner radius,
font stacks). They are validated against a strict grammar and **rejected if their
text and background colours fall below WCAG 2.x AA contrast**, so an installed theme
cannot make the dashboard unreadable. The CLI stores installed packs in
`.re-shell/themes` in the workspace; the dashboard also installs packs itself from
its Settings screen (kept in the browser). See [Themes & white-label](/re-shell/dashboard/themes-white-label/). Searching the live npm
registry was not exercised while writing this documentation.

## See also

- [Dashboard](/re-shell/dashboard/overview/)
- [Themes & white-label](/re-shell/dashboard/themes-white-label/)
- [`@re-shell/ui`](https://github.com/UmutKorkmaz/re-shell/tree/main/packages/ui): the component library.
