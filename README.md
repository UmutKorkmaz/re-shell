# Re-Shell

A single **pnpm monorepo** that pairs a full-stack scaffolding CLI with a local,
token-authed dashboard. The CLI is the engine; the dashboard, component library,
and shared contracts are built on top of it — published as unscoped `re-shell-*` packages.

[![CI](https://img.shields.io/github/actions/workflow/status/umutkorkmaz/re-shell-cli/ci.yml?branch=main)](https://github.com/umutkorkmaz/re-shell-cli/actions/workflows/ci.yml)
[![CLI version](https://img.shields.io/npm/v/re-shell-cli.svg?label=cli)](https://www.npmjs.com/package/re-shell-cli)
[![License](https://img.shields.io/npm/l/re-shell-cli.svg)](https://github.com/umutkorkmaz/re-shell-cli/blob/main/LICENSE)

## Packages

| Path | Name | Role |
|------|------|------|
| [`packages/cli`](./packages/cli) | `re-shell-cli` | The published CLI / scaffolding engine, plus the `re-shell ui` launcher. |
| [`packages/ui`](./packages/ui) | `re-shell-ui` | shadcn-first React component library (the single UI system). |
| [`packages/contracts`](./packages/contracts) | `re-shell-contracts` | Shared zod schemas + the CLI↔UI JSON envelope and `ErrorCode` vocabulary. |
| [`apps/web`](./apps/web) | `re-shell-dashboard` | Local React dashboard + the token-authed hub-server the CLI launches. |

> There is **no Web Components surface**. shadcn-React in `packages/ui` is the one UI system.

## Quickstart

```bash
# Install workspace dependencies (pinned pnpm)
npx pnpm@9.15.9 install

# Build every package
npx pnpm@9.15.9 -r build

# Run the CLI from the built workspace package
node packages/cli/dist/index.js --help

# …or use the published CLI globally
npm install -g re-shell-cli
re-shell --help

# Launch the local dashboard (React app + token-authed hub on 127.0.0.1)
re-shell ui
```

`re-shell ui` builds a per-launch session token, starts the hub-server bound to
`127.0.0.1`, and opens the dashboard at `http://127.0.0.1:3333` by default. Use
`--dry-run` (or `--json`) to print the launch plan without starting anything.

## Workspace scripts

Run from the repo root:

```bash
npx pnpm@9.15.9 -r build       # build all packages
npx pnpm@9.15.9 -r test        # run every package's vitest suite
npx pnpm@9.15.9 -r typecheck   # typecheck all packages
npx pnpm@9.15.9 -r lint        # lint all packages
```

## Documentation

Everything lives under [`/docs`](./docs):

- [`docs/README.md`](./docs/README.md) — the documentation index / information architecture.
- [`docs/RE_SHELL_ULTIMATE_PLAN.md`](./docs/RE_SHELL_ULTIMATE_PLAN.md) — the canonical implementation plan.
- [`docs/CLI-CONTRACTS.md`](./docs/CLI-CONTRACTS.md) — the CLI↔UI JSON contract, error vocabulary, and hub transport.
- Per-package `README.md` files are thin pointers back to `/docs` plus install/usage notes.

## License

The CLI is released under the Apache-2.0 License; the UI, contracts, and dashboard
packages are MIT. See each package's metadata and the [LICENSE](./LICENSE) file.
