import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility audit for the re-shell dashboard (axe-core, WCAG 2.1 A/AA).
 *
 * Runs against the same secure stack as core-flow.spec.ts (see playwright.config.ts
 * `webServer` / e2e/start-stack.mjs): the built dashboard served by `vite preview`,
 * talking to the real token-protected hub and the real CLI against a fixture
 * workspace. Because the screens are populated with REAL data (not loading
 * skeletons), the audit sees what a user sees.
 *
 * Every screen is audited in both themes. Any violation of a WCAG 2.0/2.1 A or AA
 * rule fails the run, whatever its impact; the failure message lists the rule,
 * impact, affected selectors and the axe help URL so a fix can be made directly
 * from CI output.
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

interface ScreenCase {
  /** Sidebar nav label (also the header h1). */
  readonly label: string;
}

const SCREENS: readonly ScreenCase[] = [
  { label: 'Overview' },
  { label: 'Workspace Graph' },
  { label: 'Templates' },
  { label: 'Command Builder' },
  { label: 'Assistant' },
  { label: 'Jobs & Logs' },
  { label: 'Health' },
  { label: 'Scorecard' },
  { label: 'Catalog' },
  { label: 'Settings' },
];

/** Navigate via the sidebar and wait until the screen has left its loading state. */
async function openScreen(page: Page, label: string): Promise<void> {
  if (label !== 'Overview') {
    await page
      .getByRole('complementary', { name: /Dashboard navigation/i })
      .getByRole('button', { name: label, exact: true })
      .click();
  }
  // Not the <h1>: it flips to the workspace name once workspace.summary loads.
  await expect(page.getByTestId('screen-label')).toHaveText(label);

  // Loading panels read "Loading …" / "Running health checks…"; wait them out so
  // the audit runs against real content, not skeletons.
  await expect(page.getByRole('main')).not.toContainText(/Loading [^\n]*…|Running [^\n]*…|Fetching [^\n]*…/, {
    timeout: 30_000,
  });
  await settleAnimations(page);
}

/**
 * Wait for finite entrance animations (`screen-enter`, `stagger-children`) to end:
 * axe's contrast check reads the computed colour, which is wrong while an element
 * is mid fade-in. Infinite animations (skeleton shimmer, live pulse) are ignored.
 */
async function settleAnimations(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      document.getAnimations().every((animation) => {
        const timing = animation.effect?.getComputedTiming();
        return !timing || timing.iterations === Infinity || animation.playState !== 'running';
      }),
    undefined,
    { timeout: 10_000 }
  );
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  // The app persists the choice and applies the `dark` class on <html>.
  const html = page.locator('html');
  const isDark = await html.evaluate((el) => el.classList.contains('dark'));
  if (isDark !== (theme === 'dark')) {
    await page
      .getByRole('banner')
      .getByRole('button', { name: /Switch to (dark|light) theme/i })
      .click();
  }
  await expect(html).toHaveClass(theme === 'dark' ? /(^|\s)dark(\s|$)/ : /^((?!\bdark\b).)*$/);
  await settleAnimations(page);
}

/** Render axe violations as readable text for the assertion message. */
function describeViolations(
  violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']
): string[] {
  return violations.map((violation) => {
    const targets = violation.nodes
      .slice(0, 5)
      .map((node) => `    - ${node.target.join(' ')}`)
      .join('\n');
    return `[${violation.impact}] ${violation.id}: ${violation.help} (${violation.nodes.length} node(s))\n${targets}\n    ${violation.helpUrl}`;
  });
}

test.describe('Dashboard accessibility (WCAG 2.1 AA)', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const screen of SCREENS) {
      test(`${screen.label} (${theme}) has no axe WCAG 2.1 A/AA violations`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page.goto('/');
        await setTheme(page, theme);
        await openScreen(page, screen.label);

        const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

        // `withTags` already restricts axe to the WCAG A/AA rule set, so ANY violation
        // (critical down to minor) is a failure. Best-practice-only rules (for example
        // heading-order) are not part of WCAG and are tracked separately.
        expect(describeViolations(results.violations), 'axe WCAG 2.1 A/AA violations').toEqual([]);
      });
    }
  }

  test('Sidebar navigation is keyboard accessible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('screen-label')).toHaveText('Overview');

    // Tab into the page and verify focus lands on an interactive control.
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A', 'INPUT']).toContain(focused);

    // Tab again and verify focus moves to another focusable element with a name.
    await page.keyboard.press('Tab');
    const focusedName = await page.evaluate(
      () => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim()
    );
    expect(focusedName).toBeTruthy();

    // Activating a nav item with the keyboard navigates.
    const settingsNav = page
      .getByRole('complementary', { name: /Dashboard navigation/i })
      .getByRole('button', { name: 'Settings', exact: true });
    await settingsNav.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('screen-label')).toHaveText('Settings');
  });

  test('Active screen indicator is exposed to assistive tech', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('screen-label')).toHaveText('Overview');

    // Exactly one nav item is current, and it is the active screen.
    const current = page.locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    // The accessible name excludes the decorative, aria-hidden active-row marker.
    await expect(current).toHaveAccessibleName('Overview');
  });
});
