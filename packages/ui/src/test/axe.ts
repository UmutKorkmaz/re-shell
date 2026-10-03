import type { AxeResults } from 'axe-core';
import { configureAxe } from 'vitest-axe';
import { expect } from 'vitest';

/**
 * axe configured for jsdom: WCAG 2.0/2.1 A + AA rules. `color-contrast` is off
 * because jsdom has no layout/paint engine; contrast is instead proven from the
 * design tokens (`styles/tokens.test.ts`) and from the real browser axe audit
 * in apps/web (Playwright, project `a11y`).
 */
export const axe: (html: Element | string) => Promise<AxeResults> = configureAxe({
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
  rules: {
    'color-contrast': { enabled: false },
    // Region/landmark rules assume a whole page; components render in isolation.
    region: { enabled: false }
  }
});

/** Assert an element subtree has no axe violations. */
export async function expectNoA11yViolations(root: Element | string): Promise<void> {
  const results = await axe(root);
  expect(results).toHaveNoViolations();
}
