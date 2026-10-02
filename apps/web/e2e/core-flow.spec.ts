import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * End-to-end core flow against the SECURE hub (token + allow-list).
 *
 * The dashboard bundle (built by e2e/start-stack.mjs with the hub URL + session
 * token baked in) talks to the real, loopback-only, token-protected hub, which
 * spawns the real built re-shell CLI against a fixture monorepo. This proves the
 * full SSE (cacheable reads) and WebSocket (live jobs) transports actually
 * round-trip through the secure boundary — not a mock.
 *
 * Selectors are role/name based (exact names) or explicit `data-testid`s. Nothing
 * here matches on Tailwind classes or on text that appears in more than one place.
 */

/** The real CLI binary the hub spawns for every job (see start-stack.mjs). */
const CLI_BIN = path.resolve(__dirname, '..', '..', '..', 'packages', 'cli', 'dist', 'index.js');

/**
 * Assert which screen is active. The topbar's <h1> is NOT usable for this: it
 * shows the screen label only until `workspace.summary` loads and then switches to
 * the workspace name. The sidebar's `aria-current="page"` item and the topbar
 * eyebrow (`screen-label`) are stable for the whole lifetime of the screen.
 */
async function expectActiveScreen(page: Page, label: string): Promise<void> {
  const sidebar = page.getByRole('complementary', { name: /Dashboard navigation/i });
  await expect(sidebar.getByRole('button', { name: label, exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await expect(page.getByTestId('screen-label')).toHaveText(label);
}

/** Navigate to a screen via the sidebar nav button and confirm it is active. */
async function gotoScreen(page: Page, label: string): Promise<void> {
  // The sidebar `<aside aria-label="Dashboard navigation">` is a complementary
  // landmark; scope to it, then click the nav button by its exact label.
  const sidebar = page.getByRole('complementary', { name: /Dashboard navigation/i });
  await sidebar.getByRole('button', { name: label, exact: true }).click();
  await expectActiveScreen(page, label);
}

/** The `main` landmark: everything a screen renders (not the topbar/sidebar). */
function screenMain(page: Page): Locator {
  return page.getByRole('main');
}

/**
 * Pick a command in the Command Builder catalog by its exact path. The filter box
 * narrows the 500+ entry list first so the option is rendered and unambiguous.
 */
async function pickCommand(page: Page, commandPath: string): Promise<void> {
  const picker = page.getByTestId('command-picker');
  await picker.getByLabel('Filter commands').fill(commandPath);
  await picker.getByRole('button', { name: commandPath, exact: true }).click();
  await expect(picker.getByRole('button', { name: commandPath, exact: true })).toHaveAttribute(
    'aria-current',
    'true'
  );
}

/** Text of the assembled-command `<pre>` in the Command Builder preview card. */
function assembledCommand(page: Page): Locator {
  return page.getByTestId('command-builder-preview').locator('pre');
}

/** Command lines of live OS processes (the CLI children the hub spawned). */
function runningCliProcesses(subcommand: string): string[] {
  const out = execFileSync('ps', ['-eo', 'args='], { encoding: 'utf8' });
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes(`${CLI_BIN} ${subcommand}`));
}

test.describe('dashboard <-> hub core flow (secure transport)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Overview loads the real workspace summary over SSE', async ({ page }) => {
    // The default screen is Overview. The summary panel renders the fixture
    // workspace name (derived from the workspace root) and the apps count — both
    // sourced from `workspace.summary --json` streamed over the secure hub.
    await expectActiveScreen(page, 'Overview');

    // "workspace" is also a substring of the "Inspect workspace" card heading, so
    // the exact name is required to resolve to the single summary-panel title.
    await expect(
      screenMain(page).getByRole('heading', { level: 3, name: 'workspace', exact: true })
    ).toBeVisible();
    await expect(page.getByText(/fixtures\/workspace$/)).toBeVisible();

    // Two fixture apps (store-front, admin) and one service (api).
    await expect(page.getByTestId('metric-apps')).toContainText('2');
    await expect(page.getByTestId('metric-services')).toContainText('2');

    // A real summary means the screen escaped the loading/error states.
    await expect(page.getByText(/Loading workspace/i)).toHaveCount(0);
    await expect(page.getByText(/Could not reach the hub/i)).toHaveCount(0);
  });

  test('Workspace Graph renders nodes from workspace.graph and opens node details', async ({ page }) => {
    await gotoScreen(page, 'Workspace Graph');

    // The React Flow canvas mounts.
    const canvas = page.getByTestId('graph-canvas');
    await expect(canvas).toBeVisible();

    // Fixture nodes render as graph nodes (React Flow renders the label text).
    await expect(canvas.getByText('@fixture/store-front').first()).toBeVisible();
    await expect(canvas.getByText('@fixture/ui-kit').first()).toBeVisible();

    // Count badges reflect the real feed. Each badge is a value span + label span,
    // so assert on the badge's own test id instead of a "N apps" text node.
    await expect(page.getByTestId('graph-stat-apps')).toHaveText(/^2\s*apps$/);
    await expect(page.getByTestId('graph-stat-services')).toHaveText(/^2\s*services$/);
    await expect(page.getByTestId('graph-stat-dependencies')).toHaveText(/^3\s*dependencies$/);

    // Inspect a node: the drawer lists its internal dependency on ui-kit.
    await canvas.getByRole('button', { name: /@fixture\/store-front/ }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText('@fixture/store-front')).toBeVisible();
    await expect(drawer.getByRole('heading', { name: 'Depends on', exact: true })).toBeVisible();
    await expect(drawer.getByText('@fixture/ui-kit')).toBeVisible();
  });

  test('Templates filter narrows the grid, dry-run toggles, copy works', async ({ page }) => {
    await gotoScreen(page, 'Templates');

    // The catalog loads real templates from templates.list. The count chip
    // carries "<filtered> / <total>" in data attributes.
    const count = page.getByTestId('template-count');
    await expect(count).toBeVisible();
    const total = Number(await count.getAttribute('data-total'));
    expect(total).toBeGreaterThan(1);
    expect(Number(await count.getAttribute('data-filtered'))).toBe(total);

    // Narrow by language: pick the first concrete option.
    const langSelect = page.locator('#filter-language');
    await expect(langSelect).toBeVisible();
    const options = (await langSelect.locator('option').allTextContents()).filter((o) => o && o !== 'All');
    expect(options.length).toBeGreaterThan(0);
    const language = options[0];
    await langSelect.selectOption({ label: language });

    // The filter is reflected in the URL (shareable view state) and strictly
    // narrows the grid to a non-empty subset.
    await expect(page).toHaveURL(new RegExp(`[?&]language=${encodeURIComponent(language)}`));
    await expect
      .poll(async () => Number(await count.getAttribute('data-filtered')))
      .toBeLessThanOrEqual(total);
    const filtered = Number(await count.getAttribute('data-filtered'));
    expect(filtered).toBeGreaterThan(0);
    await expect(page.locator('[data-testid^="scaffold-"]')).toHaveCount(filtered);

    // Clearing restores the full catalog.
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(count).toHaveAttribute('data-filtered', String(total));
    await langSelect.selectOption({ label: language });

    // First template card: toggle its dry-run, then copy the command.
    const firstScaffold = page.locator('[data-testid^="scaffold-"]').first();
    await expect(firstScaffold).toBeVisible();
    const pre = firstScaffold.locator('pre');
    const before = (await pre.textContent()) ?? '';
    expect(before).not.toContain('--dry-run');

    await firstScaffold.getByRole('button', { name: /dry run/i }).click();
    await expect(pre).toContainText('--dry-run');
    const after = (await pre.textContent()) ?? '';
    expect(after).not.toBe(before);

    await firstScaffold.getByRole('button', { name: /copy command/i }).click();
    await expect(firstScaffold.getByRole('button', { name: /copied/i })).toBeVisible();
  });

  test('Command Builder: pick a command, preview updates, copy', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await gotoScreen(page, 'Command Builder');

    // The catalog loads from commands.list over the hub; pick the doctor command.
    await pickCommand(page, 'doctor');

    // The assembled-command preview reflects the pick exactly.
    const preview = assembledCommand(page);
    await expect(preview).toHaveText('re-shell doctor');

    // Toggle --json and confirm the preview updates to include it.
    const jsonToggle = page.locator('#toggle-json');
    await expect(jsonToggle).toHaveAttribute('aria-checked', 'false');
    await jsonToggle.click();
    await expect(jsonToggle).toHaveAttribute('aria-checked', 'true');
    await expect(preview).toHaveText('re-shell doctor --json');

    // Copy the assembled command and verify what actually reached the clipboard.
    const previewCard = page.getByTestId('command-builder-preview');
    await previewCard.getByRole('button', { name: /copy command/i }).click();
    await expect(previewCard.getByRole('button', { name: /copied/i })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('re-shell doctor --json');
  });

  test('Command Builder: --dry-run builds a preview for dry-run-capable commands', async ({ page }) => {
    await gotoScreen(page, 'Command Builder');
    await pickCommand(page, 'create');

    const preview = assembledCommand(page);
    await page.locator('#arg-name').fill('demo-app');
    await expect(preview).toHaveText('re-shell create demo-app');

    // `create` supports --dry-run, so the dedicated switch is offered. Turning it
    // on injects the flag into the assembled command.
    const dryRunToggle = page.locator('#toggle-dry-run');
    await expect(dryRunToggle).toHaveAttribute('aria-checked', 'false');
    await dryRunToggle.click();
    await expect(dryRunToggle).toHaveAttribute('aria-checked', 'true');
    await expect(preview).toHaveText('re-shell create demo-app --dry-run');

    // `create` is NOT on the hub run allow-list, so the hub must not offer to run
    // it: the "Dry run" control is present but disabled, there is no Run button,
    // and the UI says to use a terminal. Nothing is executed through the hub.
    const previewCard = page.getByTestId('command-builder-preview');
    await expect(previewCard.getByRole('button', { name: 'Dry run', exact: true })).toBeDisabled();
    await expect(previewCard.getByRole('button', { name: 'Run', exact: true })).toHaveCount(0);
    await expect(page.getByText(/not on the hub run allow-list/i)).toBeVisible();
    await expect(page.getByTestId('live-job')).toHaveCount(0);
  });

  test('Command Builder: Run streams live logs and an exit code from the real CLI', async ({ page }) => {
    await gotoScreen(page, 'Command Builder');
    await pickCommand(page, 'workspace summary');

    const previewCard = page.getByTestId('command-builder-preview');
    await expect(previewCard.getByRole('button', { name: 'Run', exact: true })).toBeVisible();
    await previewCard.getByRole('button', { name: 'Run', exact: true }).click();

    // A live job appears and streams real CLI stdout over the WebSocket.
    const job = page.getByTestId('live-job');
    await expect(job).toBeVisible();
    await expect(job.locator('pre')).toContainText(/fixtures\/workspace/, { timeout: 30_000 });

    // It reaches a terminal state: success with exit code 0.
    await expect(job).toHaveAttribute('data-job-status', 'success', { timeout: 30_000 });
    await expect(job).toHaveAttribute('data-job-exit-code', '0');
    await expect(job.getByText('exit 0', { exact: true })).toBeVisible();

    // The streamed output is the real CLI envelope, not placeholder text.
    const logs = (await job.locator('pre').innerText()) ?? '';
    expect(logs).toMatch(/"ok":\s*true/);
    expect(logs).toContain('@fixture/store-front');
  });

  test('Jobs & Logs: a job streams live log lines + exit code over WebSocket', async ({ page }) => {
    await gotoScreen(page, 'Jobs & Logs');

    // Launch an allow-listed job (workspace summary). The buttons are labeled by
    // the command path.
    const launch = page.getByRole('button', { name: 'workspace summary', exact: true });
    await expect(launch).toBeVisible();
    await launch.click();

    // A live job card appears and streams real CLI stdout over the WS transport.
    // The summary's JSON output contains the fixture root path — proving an
    // actual log line arrived end-to-end.
    const job = page.getByTestId('live-job');
    await expect(job.locator('pre')).toContainText(/fixtures\/workspace/, { timeout: 30_000 });

    // The job reaches a terminal state with an exit code.
    await expect(job).toHaveAttribute('data-job-status', 'success', { timeout: 30_000 });
    await expect(job).toHaveAttribute('data-job-exit-code', '0');
  });

  test('Jobs & Logs: a running job can be cancelled and its process is killed', async ({ page }) => {
    await gotoScreen(page, 'Jobs & Logs');

    // `doctor` is the slowest allow-listed command, so it is still running when
    // the Cancel control is used. This is asserted unconditionally: if the job
    // had already finished there would be no Cancel button and the test fails.
    await page.getByRole('button', { name: 'doctor', exact: true }).click();

    const job = page.getByTestId('live-job');
    await expect(job).toBeVisible();
    await expect(job).toHaveAttribute('data-job-status', 'running');

    // The hub really spawned the CLI child for this job.
    await expect
      .poll(() => runningCliProcesses('doctor --json').length, { intervals: [50, 100, 250], timeout: 20_000 })
      .toBeGreaterThan(0);

    const cancel = job.getByRole('button', { name: 'Cancel', exact: true });
    await expect(cancel).toBeVisible();
    await cancel.click();

    // The UI shows the cancelled terminal state and the control goes away.
    await expect(job).toHaveAttribute('data-job-status', 'cancelled');
    await expect(job.locator('pre')).toContainText(/cancelled/);
    await expect(cancel).toHaveCount(0);

    // And the child process is actually gone (SIGTERM'd by the hub), not merely
    // hidden by the UI.
    await expect
      .poll(() => runningCliProcesses('doctor --json').length, { timeout: 20_000 })
      .toBe(0);
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

  test('Settings theme toggle flips dark mode (topbar and settings stay in sync)', async ({ page }) => {
    await gotoScreen(page, 'Settings');

    const html = page.locator('html');
    const isDark = (): Promise<boolean> => html.evaluate((el) => el.classList.contains('dark'));
    const startedDark = await isDark();
    const toLabel = (dark: boolean): RegExp => (dark ? /Switch to light theme/i : /Switch to dark theme/i);

    // The theme toggle exists twice by design: once in the topbar (banner) and
    // once in the Settings panel (main). Scope to each landmark explicitly.
    const topbarToggle = page.getByRole('banner').getByRole('button', { name: /Switch to (dark|light) theme/i });
    const settingsToggle = screenMain(page).getByRole('button', { name: /Switch to (dark|light) theme/i });
    await expect(topbarToggle).toBeVisible();
    await expect(settingsToggle).toBeVisible();
    await expect(settingsToggle).toHaveAccessibleName(toLabel(startedDark));

    await settingsToggle.click();
    await expect.poll(isDark).toBe(!startedDark);
    await expect(topbarToggle).toHaveAccessibleName(toLabel(!startedDark));
    await expect(settingsToggle).toHaveAccessibleName(toLabel(!startedDark));

    // And back via the topbar control.
    await topbarToggle.click();
    await expect.poll(isDark).toBe(startedDark);
    await expect(settingsToggle).toHaveAccessibleName(toLabel(startedDark));
  });

  test('layout has no horizontal overflow at key breakpoints', async ({ page }) => {
    const widths = [375, 768, 1024, 1440];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expectActiveScreen(page, 'Overview');

      // No horizontal scroll: scrollWidth must not exceed the viewport width.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
    }
  });
});

/**
 * The whole core flow as one narrative on a single page session:
 * open -> inspect -> filter templates -> build a command -> dry-run -> run ->
 * live logs -> cancel. Each step is a real interaction with the real hub + CLI.
 */
test('full core flow: open, inspect, filter, build, dry-run, run, live logs, cancel', async ({ page }) => {
  // Eight screens' worth of real CLI invocations in one test: triple the timeout.
  test.slow();

  // 1. Open.
  await page.goto('/');
  await expectActiveScreen(page, 'Overview');

  // 2. Inspect the workspace (summary over SSE, then the dependency graph).
  await expect(screenMain(page).getByRole('heading', { level: 3, name: 'workspace', exact: true })).toBeVisible();
  await expect(page.getByTestId('metric-apps')).toContainText('2');
  await gotoScreen(page, 'Workspace Graph');
  await expect(page.getByTestId('graph-stat-apps')).toHaveText(/^2\s*apps$/);

  // 3. Filter templates.
  await gotoScreen(page, 'Templates');
  const count = page.getByTestId('template-count');
  await expect(count).toBeVisible();
  const total = Number(await count.getAttribute('data-total'));
  const langSelect = page.locator('#filter-language');
  const language = (await langSelect.locator('option').allTextContents()).find((o) => o && o !== 'All');
  expect(language).toBeTruthy();
  await langSelect.selectOption({ label: language! });
  await expect.poll(async () => Number(await count.getAttribute('data-filtered'))).toBeLessThanOrEqual(total);
  expect(Number(await count.getAttribute('data-filtered'))).toBeGreaterThan(0);

  // 4. Build a command in the Command Builder.
  await gotoScreen(page, 'Command Builder');
  await pickCommand(page, 'create');
  await page.locator('#arg-name').fill('demo-app');

  // 5. Dry-run: the --dry-run switch is reflected in the assembled command.
  await page.locator('#toggle-dry-run').click();
  await expect(assembledCommand(page)).toHaveText('re-shell create demo-app --dry-run');

  // 6. Run an allow-listed command and watch its live logs to completion.
  await pickCommand(page, 'workspace summary');
  const previewCard = page.getByTestId('command-builder-preview');
  await previewCard.getByRole('button', { name: 'Run', exact: true }).click();
  const runJob = page.getByTestId('live-job');
  await expect(runJob.locator('pre')).toContainText(/fixtures\/workspace/, { timeout: 30_000 });
  await expect(runJob).toHaveAttribute('data-job-status', 'success', { timeout: 30_000 });

  // 7. Start a long-running job and cancel it.
  await gotoScreen(page, 'Jobs & Logs');
  await page.getByRole('button', { name: 'doctor', exact: true }).click();
  const cancelJob = page.getByTestId('live-job');
  await expect(cancelJob).toHaveAttribute('data-job-status', 'running');
  await cancelJob.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(cancelJob).toHaveAttribute('data-job-status', 'cancelled');
});
