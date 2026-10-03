import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Storybook 9 for @re-shell/ui.
 *
 * - Stories live next to the components (`src/**\/*.stories.tsx`).
 * - `@storybook/addon-a11y` runs axe on every story (panel + `a11y.test: 'error'`).
 * - Interaction tests are `play` functions (the Storybook test runner executes them).
 * - A dedicated minimal Vite config (`./vite.config.ts`) is used so the library's
 *   own `vite build` settings (lib mode, preserveModules, dts) never leak in.
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: { builder: { viteConfigPath: '.storybook/vite.config.ts' } }
  },
  core: { disableTelemetry: true },
  typescript: { check: false }
};

export default config;
