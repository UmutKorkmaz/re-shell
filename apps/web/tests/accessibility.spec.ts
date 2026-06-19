import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility tests for the re-shell dashboard.
 * Runs axe-core against each screen to enforce WCAG 2.1 AA compliance.
 *
 * These tests run against the built dashboard served by the hub. They require:
 *   1. `pnpm -r build` (so the dashboard dist exists)
 *   2. The hub server running on 127.0.0.1:3333
 *
 * In CI, the playwright config's webServer starts the hub automatically.
 */
test.describe('Dashboard accessibility (WCAG 2.1 AA)', () => {
  test('Overview screen has no critical or serious violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const violations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(violations).toEqual([]);
  });

  test('Sidebar navigation is keyboard accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab into the sidebar and verify focus moves to a nav button
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A', 'INPUT']).toContain(focused);

    // Tab again and verify focus moves to another focusable element
    await page.keyboard.press('Tab');
    const focused2 = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim());
    expect(focused2).toBeTruthy();
  });

  test('Active screen indicator is visible to screen readers', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The active nav item should have aria-current="page"
    const activeItem = page.locator('[aria-current="page"]');
    await expect(activeItem).toBeVisible();
  });

  test('Color contrast meets WCAG AA on the overview screen', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
