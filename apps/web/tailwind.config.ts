import type { Config } from 'tailwindcss';
import uiConfig from '../../packages/ui/tailwind.config';

// The dashboard shares the design tokens, keyframes and animations of
// `@re-shell/ui` verbatim (one UI system, no drift); only the content globs
// differ. `../../packages/ui/src` is scanned so classes used by library
// components that the dashboard renders are generated into the app stylesheet.
const config: Config = {
  ...uiConfig,
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}']
};

export default config;
