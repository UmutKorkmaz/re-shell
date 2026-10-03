import * as React from 'react';
import type { Decorator, Preview } from '@storybook/react-vite';

import '../src/styles/fonts.css';
import '../src/styles/globals.css';

export type StorybookTheme = 'dark' | 'light';

/** Apply the theme classes exactly like the dashboard's `applyTheme` does. */
export function applyStorybookTheme(theme: StorybookTheme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  root.style.colorScheme = theme;
}

/**
 * Every story renders on the real page background in the selected theme. The
 * Storybook test runner flips the same classes to run its a11y + visual checks in
 * BOTH themes for every story (see ./test-runner.ts), so "both themes" is covered
 * by the tests, not just by the toolbar.
 */
const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme as StorybookTheme | undefined) ?? 'dark';
  applyStorybookTheme(theme);
  return (
    <div className="min-h-[1px] bg-background p-6 text-foreground">
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  initialGlobals: { theme: 'dark' },
  globalTypes: {
    theme: {
      description: 'Colour theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        dynamicTitle: true,
        items: [
          { value: 'dark', title: 'Dark (default)' },
          { value: 'light', title: 'Light' }
        ]
      }
    }
  },
  parameters: {
    layout: 'fullscreen',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    // Fail the story (and the test runner) on any axe violation.
    a11y: { test: 'error' }
  }
};

export default preview;
