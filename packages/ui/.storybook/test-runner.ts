/**
 * Storybook test-runner hooks for @re-shell/ui.
 *
 * Every story is visited by the runner, which executes its `play` function
 * (interaction pillar). After the story renders, this file runs, in BOTH themes:
 *
 *   a11y   - axe-core in the real browser (WCAG 2.0/2.1 A + AA, incl. colour
 *            contrast, which jsdom cannot compute)
 *   visual - a full-page screenshot compared against a committed baseline
 *            (jest-image-snapshot) in __image_snapshots__/
 *
 * Contract shared with `re-shell ui test` (packages/cli/src/utils/ui-test-runner.ts
 * embeds the same logic for workspaces that do not ship their own hooks):
 *
 *   RE_SHELL_UI_TEST_OUT          when set, per-story results are WRITTEN to
 *                                 <dir>/<story-id>.json instead of thrown, so the
 *                                 CLI can report each pillar separately
 *   RE_SHELL_UI_TEST_SNAPSHOTS    baseline directory (default ./__image_snapshots__)
 *
 * Without RE_SHELL_UI_TEST_OUT (plain `pnpm test-storybook`) an a11y violation or a
 * visual diff throws, failing that story. Baselines are written on first run and
 * refreshed with `pnpm test-storybook -u`; under CI (`--ci`) a missing baseline fails.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { TestRunnerConfig } from '@storybook/test-runner';
import { getViolations, injectAxe } from 'axe-playwright';
import { toMatchImageSnapshot } from 'jest-image-snapshot';

const THEMES = ['dark', 'light'] as const;
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const OUT_DIR = process.env.RE_SHELL_UI_TEST_OUT;
const SNAPSHOT_DIR = resolve(process.env.RE_SHELL_UI_TEST_SNAPSHOTS ?? join(process.cwd(), '__image_snapshots__'));

/** Freeze motion and carets so screenshots are deterministic. */
const FREEZE_CSS = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}`;

/**
 * Run axe, waiting out the Storybook a11y addon's own automatic run (axe-core
 * refuses to start a second run while one is in flight).
 */
async function runAxe(page: Parameters<typeof getViolations>[0]): ReturnType<typeof getViolations> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await getViolations(page, 'body', {
        runOnly: { type: 'tag', values: WCAG_TAGS },
        // Stories render components in isolation, not whole pages.
        rules: { region: { enabled: false } }
      });
    } catch (error) {
      const busy = error instanceof Error && /already running/i.test(error.message);
      if (!busy || attempt >= 20) throw error;
      await new Promise((done) => setTimeout(done, 250));
    }
  }
}

const config: TestRunnerConfig = {
  // Runs inside the jest environment (this file is also loaded outside it, where
  // `expect` does not exist yet).
  setup() {
    expect.extend({ toMatchImageSnapshot });
  },

  async preVisit(page) {
    await page.addStyleTag({ content: FREEZE_CSS });
    await injectAxe(page);
  },

  async postVisit(page, context) {
    const a11y: string[] = [];
    const visual: string[] = [];
    let createdBaselines = 0;

    for (const theme of THEMES) {
      await page.evaluate((value) => {
        const root = document.documentElement;
        root.classList.toggle('dark', value === 'dark');
        root.classList.toggle('light', value === 'light');
        root.style.colorScheme = value;
      }, theme);
      await page.evaluate(() => document.fonts.ready);

      const violations = await runAxe(page);
      for (const violation of violations) {
        const targets = violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(' '))
          .join('; ');
        a11y.push(`[${theme}] ${violation.id} (${violation.impact ?? 'n/a'}): ${violation.help} -> ${targets}`);
      }

      const identifier = `${context.id}-${theme}`;
      const baseline = join(SNAPSHOT_DIR, `${identifier}-snap.png`);
      const existed = existsSync(baseline);
      try {
        const image = await page.screenshot({ fullPage: true });
        expect(image).toMatchImageSnapshot({
          customSnapshotsDir: SNAPSHOT_DIR,
          customSnapshotIdentifier: identifier,
          failureThreshold: 0.005,
          failureThresholdType: 'percent',
          customDiffConfig: { threshold: 0.1 }
        });
        if (!existed && existsSync(baseline)) createdBaselines += 1;
      } catch (error) {
        visual.push(`[${theme}] ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
      }
    }

    if (OUT_DIR) {
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(
        join(OUT_DIR, `${context.id}.json`),
        JSON.stringify({ id: context.id, title: context.title, name: context.name, a11y, visual, createdBaselines })
      );
      return;
    }
    if (a11y.length > 0) throw new Error(`a11y violations in ${context.id}:\n${a11y.join('\n')}`);
    if (visual.length > 0) throw new Error(`visual regression in ${context.id}:\n${visual.join('\n')}`);
  }
};

export default config;
