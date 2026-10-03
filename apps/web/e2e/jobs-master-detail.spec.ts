import { test, expect } from '@playwright/test';
import { SCREENS, loadScreen } from './support';

/**
 * Jobs & Logs master/detail: a dense table (h-9 rows, mono + tabular numbers) selects which job's
 * console is shown; every job stays mounted so unselected jobs keep streaming. Real hub, real CLI.
 */
test('jobs table is dense, keyboard-selectable, and shows one console at a time', async ({ page }) => {
  test.setTimeout(180_000);
  await loadScreen(page, SCREENS[5]);

  const main = page.getByRole('main');
  const launchers = main
    .getByRole('heading', { name: 'Launch a job' })
    .locator('xpath=ancestor::div[contains(@class, "surface")][1]')
    .getByRole('button');
  await expect(launchers.first()).toBeVisible();
  const names = (await launchers.allInnerTexts()).map((text) => text.trim()).filter(Boolean);
  expect(names.length).toBeGreaterThanOrEqual(2);

  // Two concurrent jobs.
  await main.getByRole('button', { name: names[0], exact: true }).click();
  await main.getByRole('button', { name: names[1], exact: true }).click();

  const table = page.getByTestId('jobs-table');
  await expect(table).toBeVisible();
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(2);

  // Dense: h-9 rows (2.25rem = 36px at the default 16px root).
  for (let i = 0; i < 2; i += 1) {
    const box = await rows.nth(i).boundingBox();
    expect(box?.height, `row ${i + 1} height`).toBeGreaterThanOrEqual(35);
    expect(box?.height, `row ${i + 1} height`).toBeLessThanOrEqual(37.5);
  }

  // Numbers are mono + tabular-nums.
  const numeric = await table.locator('tbody tr').first().locator('td').last().evaluate((el) => {
    const cs = getComputedStyle(el);
    return { family: cs.fontFamily, variant: cs.fontVariantNumeric };
  });
  expect(numeric.family.toLowerCase()).toMatch(/mono|menlo|consolas/);
  expect(numeric.variant).toContain('tabular-nums');

  // Exactly one console is visible, and it belongs to the selected row.
  const selects = table.getByRole('button', { name: /^Show output of job/ });
  await expect(selects).toHaveCount(2);
  const visibleJobs = page.getByTestId('live-job').filter({ visible: true });
  await expect(visibleJobs).toHaveCount(1);

  // Newest job first. Pick each row by the command it shows, not by position.
  const esc = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rowFor = (name: string) => table.getByRole('button', { name: new RegExp(`^Show output of job \\d+: re-shell ${esc(name)}\\b`) });
  const older = rowFor(names[0]);
  const newer = rowFor(names[1]);
  await expect(older).toHaveCount(1);
  await expect(newer).toHaveCount(1);
  await expect(selects.first()).toHaveAttribute('aria-label', new RegExp(esc(names[1])));

  // Keyboard: arrow keys move between rows, Enter / Space select, aria-pressed follows the selection.
  await newer.focus();
  await page.keyboard.press('ArrowDown');
  await expect(older).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(older).toHaveAttribute('aria-pressed', 'true');
  await expect(newer).toHaveAttribute('aria-pressed', 'false');
  await expect(visibleJobs).toHaveCount(1);
  await expect(visibleJobs.first()).toHaveAttribute('data-job-command', new RegExp(`re-shell ${esc(names[0])}\\b`));

  await page.keyboard.press('ArrowUp');
  await expect(newer).toBeFocused();
  await page.keyboard.press('Space');
  await expect(newer).toHaveAttribute('aria-pressed', 'true');
  await expect(visibleJobs.first()).toHaveAttribute('data-job-command', new RegExp(`re-shell ${esc(names[1])}\\b`));

  // The unselected job kept running/streaming even though it is hidden.
  await expect(page.getByTestId('live-job')).toHaveCount(2);
});
