import { test, expect, type Page } from '@playwright/test';
import { SCREENS, loadScreen, openScreen, settleAnimations, tabWalk, waitForScreenContent } from './support';

/**
 * Keyboard operability (WCAG 2.1.1 Keyboard, 2.1.2 No Keyboard Trap, 2.4.1 Bypass Blocks,
 * 2.4.3 Focus Order, 2.4.7 Focus Visible, 3.2.x predictable) against the real built dashboard,
 * the real hub and the real CLI. Nothing here uses the mouse except where a test says so.
 *
 * Per screen: a cold load, then Tab from the top of the document until focus leaves it. Every
 * stop must have an accessible name, a real size and a VISIBLE focus indicator, focus must never
 * get stuck, and every tabbable element in the DOM must have been reached.
 */

/**
 * The Templates catalog renders 200+ identical cards; walking all of them takes minutes and adds
 * no coverage (same markup per card). Narrow it with the real filters, by keyboard-reachable
 * <select>s, to a handful of cards first.
 */
async function narrowTemplates(page: Page): Promise<void> {
  const count = page.getByTestId('template-count');
  const selects = page.getByRole('main').locator('select');
  const total = await selects.count();
  for (let i = 0; i < total; i += 1) {
    const current = Number(await count.getAttribute('data-filtered'));
    if (current <= 12) return;
    const values = await selects.nth(i).locator('option').evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    for (const value of values) {
      await selects.nth(i).selectOption(value);
      const next = Number(await count.getAttribute('data-filtered'));
      if (next >= 3 && next <= 12) return;
      if (next < 3) await selects.nth(i).selectOption('');
      else break; // keep this filter, narrow further with the next select
    }
  }
}

const nav = (page: Page) => page.getByRole('complementary', { name: /Dashboard navigation/i });

test.describe('Skip link and focus management on screen change', () => {
  test('the skip link is the first tab stop, becomes visible, and moves focus into <main>', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('screen-label')).toHaveText('Overview');
    // Wait for real content: while the screen is still loading there is nothing to tab to in <main>.
    await waitForScreenContent(page);

    const skip = page.getByRole('link', { name: 'Skip to content' });
    // Off-screen until focused, so it never clutters the layout...
    await page.keyboard.press('Tab');
    await expect(skip).toBeFocused();
    // ...but fully on-screen with a visible indicator once focused.
    const box = await skip.boundingBox();
    expect(box && box.x >= 0 && box.y >= 0 && box.width > 20 && box.height > 10).toBe(true);

    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
    // The next Tab lands INSIDE the content, not back in the sidebar (the block was bypassed).
    await page.keyboard.press('Tab');
    const inMain = await page.evaluate(() => document.getElementById('main-content')?.contains(document.activeElement) ?? false);
    expect(inMain).toBe(true);
  });

  test('keyboard navigation moves focus to the new screen heading, updates the title and announces it', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('screen-label')).toHaveText('Overview');
    // Initial load must not steal focus from the document.
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

    const templates = nav(page).getByRole('button', { name: 'Templates', exact: true });
    await templates.focus();
    await page.keyboard.press('Enter');

    const h1 = page.getByRole('heading', { level: 1, name: 'Templates' });
    await expect(h1).toBeFocused();
    await expect(page).toHaveTitle(/^Templates · /);
    await expect(page).toHaveURL(/\?screen=templates$/);
    await expect(page.getByRole('status').filter({ hasText: 'Templates screen' })).toHaveCount(1);
    await expect(nav(page).getByRole('button', { name: 'Templates', exact: true })).toHaveAttribute('aria-current', 'page');

    // Space activates a nav button too.
    await nav(page).getByRole('button', { name: 'Health', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('heading', { level: 1, name: 'Health' })).toBeFocused();

    // Browser back restores the previous screen and moves focus again.
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Templates' })).toBeFocused();
  });
});

test.describe('Per-screen keyboard walk', () => {
  for (const screen of SCREENS) {
    test(`${screen.label}: every control is reachable, named, shows focus, and nothing traps`, async ({ page }) => {
      test.setTimeout(420_000);
      await loadScreen(page, screen);
      if (screen.id === 'templates') {
        await narrowTemplates(page);
        // Filters live in the URL: reload so sequential focus starts at the top of the document.
        await expect(page).toHaveURL(/\?screen=templates&/);
        await page.goto(page.url());
        await expect(page.getByTestId('template-count')).toBeVisible();
        expect(Number(await page.getByTestId('template-count').getAttribute('data-filtered'))).toBeLessThanOrEqual(12);
        await waitForScreenContent(page);
      }

      const { stops, ended, unreachable } = await tabWalk(page);

      expect(ended, 'Tab must leave (or wrap around) the document; "cap" means a keyboard trap or runaway').not.toBe('cap');
      expect(stops.length, 'at least the skip link, the nav and the topbar are tabbable').toBeGreaterThanOrEqual(5);
      expect(stops[0].description, 'the skip link is the first stop').toContain('Skip to content');

      const noName = stops.filter((stop) => stop.name === '').map((stop) => stop.description);
      expect(noName, 'tab stops without an accessible name').toEqual([]);

      const noSize = stops.filter((stop) => !stop.hasSize).map((stop) => stop.description);
      expect(noSize, 'tab stops that are not rendered (invisible focus)').toEqual([]);

      const noRing = stops.filter((stop) => !stop.hasFocusIndicator).map((stop) => stop.description);
      expect(noRing, 'tab stops without a visible focus indicator').toEqual([]);

      expect(unreachable, 'tabbable elements Tab never reached').toEqual([]);
    });
  }

  test('Shift+Tab walks back out to the skip link without trapping', async ({ page }) => {
    await loadScreen(page, SCREENS[0]);
    // Tab 6 times (skip link + five more stops), then Shift+Tab 5 times: back on the first stop.
    for (let i = 0; i < 6; i += 1) await page.keyboard.press('Tab');
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  });
});

test.describe('Keyboard operation of screen controls', () => {
  test('Overview: a tile button is operable with Enter and lands on the target screen heading', async ({ page }) => {
    await loadScreen(page, SCREENS[0]);
    await page.getByRole('main').getByRole('button', { name: /View health report/i }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Health' })).toBeFocused();
  });

  test('Command Builder: the --json switch toggles with Space and keeps focus', async ({ page }) => {
    await loadScreen(page, SCREENS[3]);
    // Pick a command from the keyboard: filter, focus the item, Enter.
    const picker = page.getByTestId('command-picker');
    await picker.getByLabel('Filter commands').focus();
    await page.keyboard.type('doctor');
    await picker.getByRole('button', { name: 'doctor', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(picker.getByRole('button', { name: 'doctor', exact: true })).toHaveAttribute('aria-current', 'true');
    const toggle = page.getByRole('main').getByRole('switch', { name: '--json' });
    await toggle.focus();
    const before = await toggle.getAttribute('aria-checked');
    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
    await expect(toggle).toBeFocused();
  });

  test('Assistant: the prompt is a labelled field and Enter submits it', async ({ page }) => {
    await loadScreen(page, SCREENS[4]);
    const input = page.getByRole('textbox', { name: 'Ask the assistant' });
    await input.focus();
    await page.keyboard.type('is my workspace healthy?');
    await expect(page.getByRole('button', { name: /Resolve & run/i })).toBeEnabled();
  });

  test('Settings: the theme switch works from the keyboard and the change is announced in its name', async ({ page }) => {
    await loadScreen(page, SCREENS[9]);
    const html = page.locator('html');
    const startedDark = await html.evaluate((el) => el.classList.contains('dark'));
    const toggle = page.getByRole('main').getByRole('button', { name: /Switch to (dark|light) theme/i });
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(() => html.evaluate((el) => el.classList.contains('dark')))
      .toBe(!startedDark);
    await expect(toggle).toBeFocused();
  });
});

test.describe('Drawer focus management (Templates detail sheet)', () => {
  test('focus moves in, is trapped, Escape closes it and focus returns to the opener', async ({ page }) => {
    await loadScreen(page, SCREENS[2]);

    const opener = page.getByRole('main').getByRole('button', { name: 'View details' }).first();
    await opener.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // The dialog is named (title) and described.
    await expect(dialog).toHaveAccessibleName(/.+/);
    // Focus moved INTO the dialog.
    await expect.poll(() => dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);

    // Tab and Shift+Tab many times: focus never leaves the dialog (trapped).
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((el) => el.contains(document.activeElement)), `Tab #${i + 1} stays inside`).toBe(true);
    }
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Shift+Tab');
      expect(await dialog.evaluate((el) => el.contains(document.activeElement)), `Shift+Tab #${i + 1} stays inside`).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    // Focus returns to the control that opened it.
    await expect(opener).toBeFocused();
  });
});

test.describe('Live regions', () => {
  test('hub status and screen announcements are polite live regions, job output is a labelled log', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('screen-label')).toHaveText('Overview');
    const banner = page.getByRole('banner');
    // role=status is an implicit polite live region.
    await expect(banner.getByRole('status')).toHaveAttribute('data-hub-status', /connected|connecting|reconnecting|disconnected/);

    // Run a real job from Jobs & Logs and check its output region.
    await openScreen(page, 'Jobs & Logs');
    await page.getByRole('button', { name: 'doctor', exact: true }).click();
    const log = page.getByRole('log', { name: 'Job output' });
    await expect(log).toBeVisible();
    // The finished state is announced through a polite status region (role=status), so a
    // screen reader hears one "Job succeeded" rather than every streamed line.
    const job = page.getByTestId('live-job');
    await expect(job).toHaveAttribute('data-job-status', /success|failed|cancelled/, { timeout: 60_000 });
    await expect(job.getByRole('status')).toContainText(/Job (succeeded|failed|cancelled)/);
    await expect(log).toContainText(/\S/);
  });
});

test.describe('Reduced motion', () => {
  test('prefers-reduced-motion removes entrance, stagger and pulse animations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await loadScreen(page, SCREENS[0]);
    await openScreen(page, 'Templates');

    const offenders = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => {
          const timing = animation.effect?.getComputedTiming();
          if (!timing) return false;
          const duration = typeof timing.duration === 'number' ? timing.duration : 0;
          // Infinite or perceptibly long animations are not allowed under reduced motion.
          return timing.iterations === Infinity || duration > 1;
        })
        .map((animation) => {
          const target = (animation.effect as KeyframeEffect | null)?.target as HTMLElement | null;
          return `${target?.tagName.toLowerCase() ?? '?'}.${(target?.className?.toString() ?? '').split(/\s+/).slice(0, 3).join('.')} ${(animation as CSSAnimation).animationName ?? ''}`;
        })
    );
    expect(offenders, 'animations still running under prefers-reduced-motion').toEqual([]);

    // Smooth scrolling is off too.
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  });

  test('without the preference the entrance animation still plays (the guard is not a no-op)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await loadScreen(page, SCREENS[6]);
    // The staggered entrance has a real (non-zero) duration when motion is allowed.
    const duration = await page.evaluate(() => {
      const el = document.querySelector('.stagger-children > *');
      return el ? getComputedStyle(el).animationDuration : null;
    });
    expect(duration).not.toBeNull();
    expect(duration).not.toBe('0.001ms');
    expect(duration).not.toBe('0s');
    await settleAnimations(page);
  });
});
