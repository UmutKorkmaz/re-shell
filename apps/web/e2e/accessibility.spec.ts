import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { SCREENS, openScreen, setTheme } from './support';

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

/**
 * Structure beyond the WCAG-tagged rules: landmarks, bypass blocks and a heading outline that
 * names the active screen and never skips a level (WCAG 1.3.1, 2.4.1, 2.4.6, 2.4.10). These are
 * axe "best-practice" rules, so `withTags(WCAG_TAGS)` above does not run them.
 */
const STRUCTURE_RULES = [
  'bypass',
  'skip-link',
  'page-has-heading-one',
  'heading-order',
  'empty-heading',
  'landmark-one-main',
  'landmark-unique',
  'landmark-no-duplicate-banner',
  'landmark-no-duplicate-main',
  'landmark-no-duplicate-contentinfo',
  'landmark-banner-is-top-level',
  'landmark-main-is-top-level',
  'landmark-complementary-is-top-level',
  'region',
  'scrollable-region-focusable',
  'tabindex',
];

test.describe('Dashboard structure: landmarks and headings', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const screen of SCREENS) {
      test(`${screen.label} (${theme}) has valid landmarks and a gap-free heading outline`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page.goto('/');
        await setTheme(page, theme);
        await openScreen(page, screen.label);

        const results = await new AxeBuilder({ page }).withRules(STRUCTURE_RULES).analyze();
        expect(describeViolations(results.violations), 'axe structure violations').toEqual([]);

        // One h1, it names the active screen, and it is the first heading in the document.
        const headings = await page.evaluate(() =>
          Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6, [role="heading"]'))
            .filter((el) => !el.closest('[aria-hidden="true"], [hidden]') && el.getClientRects().length > 0)
            .map((el) => ({
              level: el.getAttribute('aria-level') ? Number(el.getAttribute('aria-level')) : Number(el.tagName.slice(1)),
              text: (el.textContent ?? '').trim().slice(0, 60),
            }))
        );
        const h1 = headings.filter((heading) => heading.level === 1);
        expect(h1.map((heading) => heading.text), 'exactly one h1, naming the screen').toEqual([screen.label]);
        expect(headings[0].level, 'the first heading is the h1').toBe(1);

        // No skipped levels going down (h1 -> h3 is a jump; h3 -> h2 is fine).
        const jumps = headings
          .map((heading, index) => ({ heading, previous: headings[index - 1] }))
          .filter(({ heading, previous }) => previous && heading.level > previous.level + 1)
          .map(({ heading, previous }) => `h${previous.level} "${previous.text}" -> h${heading.level} "${heading.text}"`);
        expect(jumps, 'heading levels skipped').toEqual([]);
      });
    }
  }
});
