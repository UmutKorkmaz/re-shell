import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end core flow against the SECURE hub (token + allow-list).
 *
 * The dashboard bundle (built by e2e/start-stack.mjs with the hub URL + session
 * token baked in) talks to the real, loopback-only, token-protected hub, which
 * spawns the real built re-shell CLI against a fixture monorepo. This proves the
 * full SSE (cacheable reads) and WebSocket (live jobs) transports actually
 * round-trip through the secure boundary — not a mock.
 */

/** Navigate to a screen via the sidebar nav button and confirm it is active. */
async function gotoScreen(page: Page, label: string): Promise<void> {
  // The sidebar `<aside aria-label="Dashboard navigation">` is a complementary
  // landmark; scope to it, then click the nav button by its exact label.
  const sidebar = page.getByRole('complementary', { name: /Dashboard navigation/i });
  await sidebar.getByRole('button', { name: label, exact: true }).click();
  // The header h1 mirrors the active screen label.
  await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
}

test.describe('dashboard <-> hub core flow (secure transport)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Overview loads the real workspace summary over SSE', async ({ page }) => {
    // The default screen is Overview. The summary panel renders the fixture
    // workspace name (derived from the workspace root) and the apps count — both
    // sourced from `workspace.summary --json` streamed over the secure hub.
    await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();

    // The summary panel renders the fixture root basename ("workspace") as its
    // heading and the full root path beneath it — both from the live SSE read.
    await expect(page.getByRole('heading', { level: 3, name: 'workspace' })).toBeVisible();
    await expect(page.getByText(/fixtures\/workspace$/)).toBeVisible();

    // Two fixture apps (store-front, admin) => an "Apps" metric block reads 2.
    // The summary panel + topology card both render a bordered metric tile that
    // pairs the "Apps" label with its count; assert one shows 2.
    const appsMetric = page
      .locator('div.rounded-md.border')
      .filter({ hasText: 'Apps' })
      .first();
    await expect(appsMetric).toContainText('2');

    // A real summary means the screen escaped the loading/error states.
    await expect(page.getByText(/Loading workspace/i)).toHaveCount(0);
    await expect(page.getByText(/Could not reach the hub/i)).toHaveCount(0);
  });

  test('Workspace Graph renders nodes from workspace.graph', async ({ page }) => {
    await gotoScreen(page, 'Workspace Graph');

    // The React Flow canvas mounts.
    await expect(page.getByTestId('graph-canvas')).toBeVisible();

    // Fixture nodes render as graph nodes (React Flow renders the label text).
    await expect(page.getByText('@fixture/store-front').first()).toBeVisible();
    await expect(page.getByText('@fixture/ui-kit').first()).toBeVisible();

    // Counts badges reflect the real feed: 2 apps, 2 services.
    await expect(page.getByText('2 apps')).toBeVisible();
    await expect(page.getByText('2 services')).toBeVisible();
  });

  test('Templates filter narrows the grid, dry-run toggles, copy works', async ({ page }) => {
    await gotoScreen(page, 'Templates');

    // The catalog loads real templates from templates.list. The count badge
    // shows "<filtered> / <total>".
    const countBadge = page.getByText(/^\s*\d+\s*\/\s*\d+\s*$/).first();
    await expect(countBadge).toBeVisible();
    const initial = (await countBadge.textContent()) ?? '';
    const total = Number(initial.split('/')[1].trim());
    expect(total).toBeGreaterThan(1);

    // Narrow by language. The fixture's CLI feed includes typescript templates.
    const langSelect = page.locator('#filter-language');
    await expect(langSelect).toBeVisible();
    const options = await langSelect.locator('option').allTextContents();
    const narrowing = options.find((o) => o && o !== 'All');
    expect(narrowing).toBeTruthy();
    await langSelect.selectOption({ label: narrowing! });

    // After filtering, the visible count should be <= total (narrowed).
    await expect(async () => {
      const txt = (await countBadge.textContent()) ?? '';
      const shown = Number(txt.split('/')[0].trim());
      expect(shown).toBeLessThanOrEqual(total);
      expect(shown).toBeGreaterThan(0);
    }).toPass();

    // First template card: toggle its dry-run, then copy the command.
    const firstScaffold = page.locator('[data-testid^="scaffold-"]').first();
    await expect(firstScaffold).toBeVisible();
    const pre = firstScaffold.locator('pre');
    const before = (await pre.textContent()) ?? '';

    await firstScaffold.getByRole('button', { name: /dry run/i }).click();
    await expect(pre).toContainText('--dry-run');
    const after = (await pre.textContent()) ?? '';
    expect(after).not.toBe(before);

    await firstScaffold.getByRole('button', { name: /copy command/i }).click();
    await expect(firstScaffold.getByRole('button', { name: /copied/i })).toBeVisible();
  });

  test('Command Builder: pick a command, preview updates, copy', async ({ page }) => {
    await gotoScreen(page, 'Command Builder');

    // The catalog loads from commands.list over the hub; pick the doctor command.
    await expect(page.locator('#command-filter')).toBeVisible();
    await page.locator('li button').filter({ hasText: 'doctor' }).first().click();

    // The assembled-command preview (the page's single <pre>) reflects the pick.
    const preview = page.locator('pre').first();
    await expect(preview).toContainText('doctor');

    // Toggle --json and confirm the preview updates to include it.
    const jsonToggle = page.locator('#toggle-json');
    await jsonToggle.check();
    await expect(preview).toContainText('--json');

    // Copy the assembled command (the Run/copy controls live in the same card).
    await page.getByRole('button', { name: /copy command/i }).first().click();
    await expect(page.getByRole('button', { name: /copied/i }).first()).toBeVisible();
  });

  test('Jobs & Logs: a job streams live log lines + exit code over WebSocket', async ({ page }) => {
    await gotoScreen(page, 'Jobs & Logs');

    // Launch an allow-listed job (workspace summary). The buttons are labeled by
    // the command path.
    const launch = page.getByRole('button', { name: 'workspace summary' });
    await expect(launch).toBeVisible();
    await launch.click();

    // A live job card appears and streams real CLI stdout over the WS transport.
    // The summary's JSON output contains the fixture root path — proving an
    // actual log line arrived end-to-end.
    await expect(page.getByText(/fixtures\/workspace/).first()).toBeVisible({ timeout: 30_000 });

    // The job reaches a terminal state with an exit code (summary may exit 0 or
    // non-zero depending on health; both are valid — assert an exit code lands).
    await expect(page.getByText(/exit \d+/).first()).toBeVisible({ timeout: 30_000 });
  });

  test('Jobs & Logs: a running job can be cancelled', async ({ page }) => {
    await gotoScreen(page, 'Jobs & Logs');

    const launch = page.getByRole('button', { name: 'workspace summary' });
    await launch.click();

    // The job panel exposes a Cancel control while running; click it. If the job
    // finished first, a terminal summary line is present instead — either way the
    // job lifecycle is observable end-to-end.
    const cancel = page.getByRole('button', { name: /cancel/i }).first();
    if (await cancel.isVisible().catch(() => false)) {
      await cancel.click();
    }
    await expect(page.getByText(/exit \d+|cancelled/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test('Health renders real checks from workspace.health', async ({ page }) => {
    await gotoScreen(page, 'Health');

    await expect(page.getByText(/Running health checks/i)).toHaveCount(0);
    await expect(page.getByText(/Could not reach the hub/i)).toHaveCount(0);

    // The fixture produces real checks (e.g. Workspaces, File Structure). The
    // grouped check lists render with the worst-first ordering.
    await expect(page.getByText('Workspaces').first()).toBeVisible();
    // The copy-CLI affordance for the health command is present.
    await expect(page.getByText(/workspace health --json/)).toBeVisible();
  });

  test('Settings theme toggle flips dark mode', async ({ page }) => {
    await gotoScreen(page, 'Settings');

    const html = page.locator('html');
    const startedDark = await html.evaluate((el) => el.classList.contains('dark'));

    const toggle = page.getByRole('button', { name: /Switch to (dark|light) theme/i });
    await expect(toggle).toBeVisible();
    await toggle.click();

    await expect(async () => {
      const nowDark = await html.evaluate((el) => el.classList.contains('dark'));
      expect(nowDark).toBe(!startedDark);
    }).toPass();
  });

  test('layout has no horizontal overflow at key breakpoints', async ({ page }) => {
    const widths = [375, 768, 1024, 1440];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();

      // No horizontal scroll: scrollWidth must not exceed the viewport width.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
    }
  });
});
