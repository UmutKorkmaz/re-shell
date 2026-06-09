# @re-shell/ui

Shadcn-first React component library for Re-Shell interfaces. This is the **single
UI system** for the monorepo — `apps/web` consumes it instead of building a parallel
component layer. There is no Web Components surface.

> Part of the [Re-Shell monorepo](https://github.com/umutkorkmaz/re-shell-cli). See
> [`/docs`](../../docs) for the documentation index.

## Install

```bash
pnpm add @re-shell/ui
```

Peer dependencies: `react` and `react-dom` (`^18.2.0 || ^19.0.0`).
`@tanstack/react-query` (`^5`) is an **optional** peer — only required if you use the
hub data hooks (`useHubQuery`, `useJob`).

## Usage

Import components from the package root and the stylesheet from `./styles.css`:

```tsx
import { WorkspaceSummaryPanel, Button, HealthStatus } from '@re-shell/ui';
import '@re-shell/ui/styles.css';
```

## Exports

Everything is re-exported from the package root (`@re-shell/ui`). Subpath entry
points exist for type discovery, but their runtime resolves to the same bundle.

### shadcn primitives — `./components/ui`

`Badge`, `Button`, `Card`, `Input`, `Label`, `ScrollArea`, `Separator`, `Sheet`,
`Tabs`, `Tooltip`. Built on Radix primitives, `class-variance-authority`, and `cn()`.

### Re-Shell domain components — `./components/re-shell`

`CommandPreview`, `HealthStatus`, `JobLogPanel`, `TemplateCatalogCard`,
`TopologyNodeCard`, `WorkspaceSummaryPanel`. These compose the shadcn primitives —
they do not introduce a parallel UI pattern.

### Hooks — `./hooks`

Hub connection + data hooks: `resolveHubToken`, `resolveHubBaseUrl`,
`buildEventsUrl`, `buildJobsUrl`, `redactSecrets`, `fetchHubJson`, `useHubStream`,
`useHubQuery`, `useJob` (plus their option/result types).

### Utilities — `./lib`

`cn()` and the command helpers from `lib/command`.

### Contracts re-export — `./contracts`

Type-only re-export of [`@re-shell/contracts`](../contracts) so consumers can
import the shared wire types from one place.

### Styles — `./styles.css`

Compiled Tailwind + shadcn CSS variables (light + dark tokens).

## Build outputs

`vite build` (library mode) + `vite-plugin-dts` emit into `dist/`:

```text
dist/index.js        # ESM bundle (module entry)
dist/index.cjs       # CommonJS bundle (require entry)
dist/index.d.ts      # root type declarations
dist/index.css       # compiled stylesheet (exported as ./styles.css)
dist/components/     # per-entry .d.ts (ui/, re-shell/)
dist/hooks/          # hook .d.ts
dist/lib/            # util .d.ts
dist/contracts/      # contracts re-export .d.ts
dist/hub/            # hub client .d.ts (sse-client, ws-client, json-reassembler)
```

The `package.json` `exports` map points ESM at `dist/index.js`, CJS at
`dist/index.cjs`, types at the matching `dist/**/*.d.ts`, and `./styles.css` at
`dist/index.css`.

## shadcn requirement

shadcn/ui is mandatory from bottom to top:

- Tokens live in `src/styles/globals.css` using shadcn CSS-variable conventions.
- `components.json` is the source of truth for the shadcn CLI configuration.
- Primitives live in `src/components/ui`; domain components in `src/components/re-shell`.
- Styling uses Tailwind, `cn()`, `clsx`, `tailwind-merge`, and `class-variance-authority`.
- Icons use `lucide-react`.

## Scripts

```bash
pnpm --filter @re-shell/ui build
pnpm --filter @re-shell/ui typecheck
pnpm --filter @re-shell/ui dev        # vite build --watch
pnpm --filter @re-shell/ui test
pnpm --filter @re-shell/ui shadcn     # shadcn CLI
```
