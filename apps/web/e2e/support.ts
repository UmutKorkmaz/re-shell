import { expect, type Page } from '@playwright/test';

/** Every dashboard screen: `id` is the `?screen=` value, `label` the sidebar label and the page h1. */
export interface ScreenCase {
  readonly id: string;
  readonly label: string;
}

export const SCREENS: readonly ScreenCase[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'graph', label: 'Workspace Graph' },
  { id: 'templates', label: 'Templates' },
  { id: 'commands', label: 'Command Builder' },
  { id: 'assistant', label: 'Assistant' },
  { id: 'jobs', label: 'Jobs & Logs' },
  { id: 'health', label: 'Health' },
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'settings', label: 'Settings' },
];

/**
 * Wait for finite entrance animations (`screen-enter`, `stagger-children`) to end: axe's contrast
 * check reads the computed colour, which is wrong while an element is mid fade-in. Infinite
 * animations (skeleton shimmer, live pulse) are ignored.
 */
export async function settleAnimations(page: Page): Promise<void> {
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

/** Wait until the active screen has left its loading state, so checks see real content. */
export async function waitForScreenContent(page: Page): Promise<void> {
  await expect(page.getByRole('main')).not.toContainText(/Loading [^\n]*…|Running [^\n]*…|Fetching [^\n]*…/, {
    timeout: 30_000,
  });
  await settleAnimations(page);
}

/** Navigate via the sidebar (mouse) and wait for the screen's real content. */
export async function openScreen(page: Page, label: string): Promise<void> {
  if (label !== 'Overview') {
    await page
      .getByRole('complementary', { name: /Dashboard navigation/i })
      .getByRole('button', { name: label, exact: true })
      .click();
  }
  await expect(page.getByTestId('screen-label')).toHaveText(label);
  await waitForScreenContent(page);
}

/** Load a screen from a cold start via its `?screen=` URL (focus starts at the top of the document). */
export async function loadScreen(page: Page, screen: ScreenCase): Promise<void> {
  await page.goto(`/?screen=${screen.id}`);
  await expect(page.getByTestId('screen-label')).toHaveText(screen.label);
  await waitForScreenContent(page);
}

export async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
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

export interface TabStop {
  /** Stable description of the element (tag, role, id/test id, accessible name). */
  readonly description: string;
  readonly name: string;
  /** Has a visible focus indicator: a non-transparent outline or a non-zero box-shadow ring. */
  readonly hasFocusIndicator: boolean;
  readonly hasSize: boolean;
  readonly visits: number;
}

export interface TabWalkResult {
  readonly stops: TabStop[];
  /** `left`: focus moved past the last element (out of the document). `cycled`: it wrapped around. */
  readonly ended: 'left' | 'cycled' | 'cap';
  /** Focusable elements (tabindex >= 0, rendered, enabled) that were never reached with Tab. */
  readonly unreachable: string[];
}

/**
 * Press Tab from the top of the document until focus leaves it, recording every stop. Must be
 * called right after a cold load so sequential focus starts at the document start. Afterwards
 * compares against every tabbable element in the DOM to prove nothing is unreachable.
 */
export async function tabWalk(page: Page, cap = 1500): Promise<TabWalkResult> {
  await page.evaluate(() => {
    (window as unknown as { __kbd: WeakMap<Element, number> }).__kbd = new WeakMap();
  });
  const stops: TabStop[] = [];
  let ended: TabWalkResult['ended'] = 'cap';

  for (let step = 0; step < cap; step += 1) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(async () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || el === document.documentElement) return null;
      // The ring is drawn by a short transition: measure the settled state, not its first frame.
      await Promise.allSettled(
        el
          .getAnimations()
          .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
          .map((animation) => animation.finished)
      );
      const seen = (window as unknown as { __kbd: WeakMap<Element, number> }).__kbd;
      const visits = (seen.get(el) ?? 0) + 1;
      seen.set(el, visits);

      const cs = getComputedStyle(el);
      const outlineVisible =
        cs.outlineStyle !== 'none' &&
        parseFloat(cs.outlineWidth) > 0 &&
        cs.outlineColor !== 'transparent' &&
        !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(cs.outlineColor);
      // Strip colour functions, then look for any non-zero length in the box-shadow.
      const shadowLengths = cs.boxShadow.replace(/\w+\([^)]*\)/g, '');
      const shadowVisible = cs.boxShadow !== 'none' && /(^|\s)-?(?:[1-9]\d*|0?\.\d*[1-9]\d*)(?:\.\d+)?px/.test(shadowLengths);

      const labelledBy = el.getAttribute('aria-labelledby');
      const labelledText = labelledBy
        ? labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent ?? '')
            .join(' ')
        : '';
      const labels = (el as HTMLInputElement).labels ? Array.from((el as HTMLInputElement).labels ?? []).map((l) => l.textContent ?? '').join(' ') : '';
      const name = (
        el.getAttribute('aria-label') ||
        labelledText ||
        labels ||
        el.innerText ||
        el.getAttribute('title') ||
        (el as HTMLInputElement).value ||
        el.getAttribute('placeholder') ||
        ''
      )
        .replace(/\s+/g, ' ')
        .trim();

      const rect = el.getBoundingClientRect();
      const role = el.getAttribute('role');
      const id = el.id ? `#${el.id}` : el.getAttribute('data-testid') ? `[data-testid=${el.getAttribute('data-testid')}]` : '';
      return {
        description: `${el.tagName.toLowerCase()}${role ? `[role=${role}]` : ''}${id} "${name.slice(0, 50)}"`,
        name,
        hasFocusIndicator: outlineVisible || shadowVisible,
        // A straight SVG edge has a zero width OR height, never both.
        hasSize: rect.width > 0 || rect.height > 0,
        visits,
      };
    });

    if (stop === null) {
      ended = 'left';
      break;
    }
    if (stop.visits > 1) {
      ended = 'cycled';
      break;
    }
    stops.push(stop);
  }

  const unreachable = await page.evaluate(() => {
    const seen = (window as unknown as { __kbd: WeakMap<Element, number> }).__kbd;
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex], [contenteditable="true"]'
      )
    );
    return candidates
      .filter((el) => {
        if (el.tabIndex < 0) return false;
        if ((el as HTMLButtonElement).disabled) return false;
        if (el.closest('[inert], [aria-hidden="true"], [hidden]')) return false;
        const rect = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      })
      .filter((el) => !seen.has(el))
      .map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} "${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40)}"`);
  });

  return { stops, ended, unreachable };
}
