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

Import components from the package root (or a deep path), the fonts once, and the
stylesheet:

```tsx
import { WorkspaceSummaryPanel, Button, HealthStatus } from '@re-shell/ui';
import '@re-shell/ui/fonts.css'; // Latin-only self-hosted fonts (real woff2 files, not inlined)
import '@re-shell/ui/styles.css'; // tokens + utilities (~8 kB gzip)
```

Deep imports resolve to real per-module files, so they are tree-shakeable and cheap:

```tsx
import { Button } from '@re-shell/ui/components/ui/button';
import { Box, Stack, Text } from '@re-shell/ui/components/primitives';
import { px, rem } from '@re-shell/ui/lib';
```

## Exports

### shadcn primitives - `./components/ui`

`Alert`, `Badge`, `Button`, `Card`, `Input`, `Label`, `ScrollArea`, `Separator`,
`Sheet`, `Tabs`, `Toast` (`ToastProvider`, `useToast`), `Tooltip`. Built on Radix
primitives, `class-variance-authority`, and `cn()`.

### Layout / a11y primitives - `./components/primitives`

`Box`, `Text`, `Stack` (polymorphic, see below), `SkipLink`, `LiveRegion`,
`VisuallyHidden`.

### Re-Shell domain components - `./components/re-shell`

`CommandPreview`, `HealthStatus`, `JobLogPanel`, `TemplateCatalogCard`,
`TopologyNodeCard`, `WorkspaceSummaryPanel`. These compose the shadcn primitives -
they do not introduce a parallel UI pattern.

### Hooks - `./hooks`

Hub connection + data hooks: `resolveHubToken`, `resolveHubBaseUrl`,
`buildEventsUrl`, `buildJobsUrl`, `redactSecrets`, `fetchHubJson`, `useHubStream`,
`useHubQuery`, `useJob`, plus `useChangeFlash` (the `log-flash` highlight).

### Utilities - `./lib`

`cn()`, the command helpers, the branded CSS unit helpers and the polymorphic
component types.

### Contracts re-export - `./contracts`

Type-only re-export of [`@re-shell/contracts`](../contracts) so consumers can
import the shared wire types from one place.

### Styles - `./styles.css`, `./fonts.css`

Compiled Tailwind + design tokens (OKLCH, light + dark, hex fallback) and the
Latin-only font faces.

## Type system

- **Polymorphic `as`** - `Box`, `Text`, `Stack` and `CardTitle` take `as`; the other
  props are exactly those of the target element and `ref` is typed for it
  (`<Box as="a" href="/x" />` compiles, `<Box as="div" href="/x" />` does not).
  `forwardPolymorphic` builds new ones.
- **Branded CSS units** - `Px`, `Rem`, `Percent` (`px(4)`, `rem(1.5)`, `percent(50)`,
  `pxToRem`, `addLength`, `parseLength`, ...). A bare `"12px"` or a number is a
  compile error, units never mix, and spacing props reject percentages.
- **Discriminated variant props** - `Stack` (`wrap` only on `direction="row"`),
  `Text` (`lines` only with `truncate`), `Alert` (`dismissible` requires `onDismiss`).

The typings are covered by `src/types/*.test-d.tsx` (`expectTypeOf` +
`@ts-expect-error`), which run under `vitest run` and `tsc`.

## Accessibility

Every component has a `vitest-axe` test plus keyboard/focus assertions
(`src/components/a11y.test.tsx`). Contrast of the status colours, the signal
accent, the focus ring and control borders is verified in BOTH themes from the
real tokens (`src/styles/tokens.test.ts`), and Storybook re-checks every story in a
real browser (axe incl. contrast) in both themes. Scrollable regions are
keyboard-focusable only when they overflow; toasts and log output are live regions;
`prefers-reduced-motion` disables all animation.

## Storybook

Storybook 9 (`@storybook/react-vite`) documents every component, each with `play`
interaction tests and the a11y addon.

```bash
pnpm --filter @re-shell/ui storybook         # dev server on :6006 (theme switch in the toolbar)
pnpm --filter @re-shell/ui build-storybook   # static site in storybook-static/
pnpm --filter @re-shell/ui test-storybook    # test runner: interaction + a11y + visual, both themes
pnpm --filter @re-shell/ui test-storybook -u # refresh the visual baselines
```

`test-storybook` serves the static build on an ephemeral port and runs
`@storybook/test-runner` (Chromium; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use
an existing browser). Per story and per theme it runs axe and compares a screenshot
with the committed baseline in `__image_snapshots__/`. `re-shell ui test` drives the
same runner and reports the three pillars.

The static Storybook is published with the docs site at `/re-shell/storybook/`
(see `site/` and `.github/workflows/storybook.yml`).

## Build outputs

`vite build` (library mode, `preserveModules`) emits real per-module files:

```text
dist/index.js, dist/<dir>/<module>.js   # ESM, one file per module (tree-shakeable)
dist/cjs/**/*.cjs                       # CommonJS, same layout
dist/**/*.d.ts                          # types
dist/index.css                          # compiled stylesheet  (./styles.css)
dist/fonts.css                          # Latin font faces     (./fonts.css)
```

`sideEffects` is `["**/*.css"]`: no JS module has load-time effects, and the
stylesheet is never imported from JS. `pnpm --filter @re-shell/ui budget` enforces
gzip budgets (stylesheet, whole ES graph, each module) and tree-shaking probes
(esbuild bundles of a single import must stay tiny and must not pull in unrelated
components). It runs in CI.

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
pnpm --filter @re-shell/ui test       # unit + a11y + type-level tests
pnpm --filter @re-shell/ui budget     # size budgets + tree-shake probes (after build)
pnpm --filter @re-shell/ui tokens:fallback  # regenerate the OKLCH-less hex fallback
pnpm --filter @re-shell/ui shadcn     # shadcn CLI
```
