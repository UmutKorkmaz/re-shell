import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { renderBrandIntoHtml, resolveWhiteLabel } from '@re-shell/contracts';
import { SCREENS, loadScreen, settleAnimations, setTheme } from './support';

/**
 * Theme packs (Settings -> Appearance), white-label branding and the no-flash boot, driven in a
 * real browser against the built dashboard.
 */

const LIGHT = {
  background: 'oklch(0.97 0.004 265)',
  foreground: 'oklch(0.21 0.015 265)',
  primary: 'oklch(0.74 0.18 130)',
  'primary-foreground': 'oklch(0.16 0.03 130)',
};

function themePack(overrides: Record<string, unknown> = {}): Buffer {
  return Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      id: 'midnight-lime',
      name: 'Midnight Lime',
      version: '1.0.0',
      radius: '0.25rem',
      colors: {
        light: LIGHT,
        dark: { ...LIGHT, background: 'oklch(0.16 0.01 265)', foreground: 'oklch(0.96 0.006 265)' },
      },
      ...overrides,
    })
  );
}

const rootVar = (page: Page, name: string): Promise<string> =>
  page.evaluate((variable) => getComputedStyle(document.documentElement).getPropertyValue(variable).trim(), name);

async function openAppearance(page: Page): Promise<void> {
  await loadScreen(page, SCREENS[9]);
  await expect(page.getByRole('region', { name: /Appearance/i })).toBeVisible();
}

async function install(page: Page, buffer: Buffer, name = 'theme.json'): Promise<void> {
  await page.getByLabel('Install from file').setInputFiles({ name, mimeType: 'application/json', buffer });
}

test.describe('Theme packs: install, preview, apply, remove (persisted)', () => {
  test('a pack installs from a file, previews without persisting, applies, survives a reload, and removes cleanly', async ({ page }) => {
    await openAppearance(page);
    const builtinPrimary = await rootVar(page, '--primary');
    const list = page.getByRole('list', { name: 'Installed themes' });
    await expect(page.getByText('No theme packs installed yet.')).toBeVisible();

    await install(page, themePack());
    await expect(list.getByText('Midnight Lime')).toBeVisible();
    // Installing does not apply it.
    expect(await rootVar(page, '--primary')).toBe(builtinPrimary);
    await expect(page.locator('#re-shell-theme-pack')).toHaveCount(0);

    // Preview changes the live tokens but is not persisted.
    await page.getByRole('button', { name: 'Preview Midnight Lime' }).click();
    await expect(page.getByTestId('theme-preview-banner')).toBeVisible();
    await expect(page.locator('#re-shell-theme-pack')).toHaveCount(1);
    expect(await rootVar(page, '--primary')).not.toBe(builtinPrimary);
    await page.getByRole('button', { name: 'Stop previewing Midnight Lime' }).click();
    await expect(page.locator('#re-shell-theme-pack')).toHaveCount(0);
    expect(await rootVar(page, '--primary')).toBe(builtinPrimary);

    // Apply from the keyboard, announced through the toast live region.
    const apply = page.getByRole('button', { name: 'Apply Midnight Lime' });
    await apply.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: 'Applied "Midnight Lime"' })).toBeVisible();
    const themedPrimary = await rootVar(page, '--primary');
    expect(themedPrimary).not.toBe(builtinPrimary);

    // Persisted: a full reload keeps the pack, and the boot script applies it before the app mounts.
    await page.reload();
    await expect(page.getByTestId('screen-label')).toHaveText('Settings');
    await expect(page.locator('#re-shell-theme-pack')).toHaveCount(1);
    expect(await rootVar(page, '--primary')).toBe(themedPrimary);

    // Remove restores the built-in theme exactly.
    await page.getByRole('button', { name: 'Remove Midnight Lime' }).click();
    await expect(page.getByText('No theme packs installed yet.')).toBeVisible();
    await expect(page.locator('#re-shell-theme-pack')).toHaveCount(0);
    expect(await rootVar(page, '--primary')).toBe(builtinPrimary);
    await page.reload();
    await expect(page.locator('#re-shell-theme-pack')).toHaveCount(0);
  });

  test('an invalid pack is rejected with the exact problems and nothing is installed', async ({ page }) => {
    await openAppearance(page);
    // foreground on background is far below WCAG AA, and the radius is out of range.
    await install(
      page,
      themePack({ radius: '99rem', colors: { light: { ...LIGHT, foreground: 'oklch(0.9 0.01 265)' } } }),
      'bad.json'
    );
    const error = page.getByTestId('theme-install-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/radius/);
    await expect(error).toContainText(/contrast/i);
    await expect(page.getByText('No theme packs installed yet.')).toBeVisible();
    // Errors are announced (role=alert).
    await expect(error).toHaveAttribute('role', 'alert');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`an applied pack keeps Settings free of axe WCAG 2.1 AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openAppearance(page);
      await install(page, themePack());
      await page.getByRole('button', { name: 'Apply Midnight Lime' }).click();
      await setTheme(page, scheme);
      await settleAnimations(page);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
});

test.describe('Default theme and no flash', () => {
  test('the page is dark before any script runs, and a stored light choice is applied before first paint', async ({ page }) => {
    // Block every script so only the inline boot script and the stylesheet can act.
    await page.route('**/*.js', (route) => route.abort());
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
    const darkBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await page.evaluate(() => window.localStorage.setItem('re-shell.dashboard.settings.v1', JSON.stringify({ theme: 'light' })));
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.classList.contains('light'))).toBe(true);
    const lightBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(lightBackground).not.toBe(darkBackground);
  });
});

test.describe('White-label', () => {
  const brand = (() => {
    const result = resolveWhiteLabel({
      productName: 'Acme Console',
      tagline: 'Internal platform',
      logo: '/favicon.svg',
      favicon: '/favicon.svg',
      accentColor: '#0b6bcb',
    });
    if (!result.ok) throw new Error('invalid brand');
    return result.config;
  })();

  test('the brand block written into index.html (build or serve time) rebrands the whole shell', async ({ page }) => {
    // The same renderBrandIntoHtml the Vite plugin and `re-shell ui` apply.
    await page.route(
      (url) => url.pathname === '/',
      async (route) => {
        const response = await route.fetch();
        await route.fulfill({ response, body: renderBrandIntoHtml(await response.text(), brand) });
      }
    );
    await page.goto('/?screen=overview');
    await expect(page.getByTestId('screen-label')).toHaveText('Overview');

    await expect(page).toHaveTitle('Overview · Acme Console');
    await expect(page.getByTestId('brand-name')).toHaveText('Acme Console');
    await expect(page.getByTestId('brand-mark')).toContainText('Internal platform');
    await expect(page.getByTestId('brand-logo')).toHaveAttribute('src', '/favicon.svg');
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg');
    expect(await rootVar(page, '--primary')).toBe('#0b6bcb');
    // The skip link and landmarks are still intact.
    await expect(page.getByRole('link', { name: 'Skip to content' })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overview');
  });

  test('with no brand configured the defaults are used', async ({ page }) => {
    await page.goto('/?screen=overview');
    await expect(page).toHaveTitle('Overview · Re-Shell');
    await expect(page.getByTestId('brand-name')).toHaveText('Re-Shell');
  });
});
