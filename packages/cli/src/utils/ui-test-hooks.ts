// Test-runner hooks used by `re-shell ui test` (issue #22 / R-2).
//
// `re-shell ui test` drives the Storybook test runner (@storybook/test-runner,
// jest + Playwright). The runner itself executes each story's `play` function
// (the INTERACTION pillar). These hooks add the other two pillars after every
// story renders, in BOTH themes:
//
//   a11y   - axe-core in the real browser (WCAG 2.0/2.1 A + AA, incl. contrast)
//   visual - a full-page screenshot vs a committed baseline (jest-image-snapshot)
//
// Results are WRITTEN (one JSON file per story, under RE_SHELL_UI_TEST_OUT) rather
// than thrown, so each pillar is reported separately instead of the first failure
// masking the rest. The file is plain CommonJS because the runner loads it from a
// temporary config directory inside the project (so `axe-playwright` and
// `jest-image-snapshot` resolve from the project's own node_modules).
//
// packages/ui/.storybook/test-runner.ts implements the same contract for plain
// `pnpm test-storybook` runs (it throws instead of recording when
// RE_SHELL_UI_TEST_OUT is unset).

/** Name of the hooks file inside the temporary config directory. */
export const UI_TEST_HOOKS_FILENAME = 'test-runner.js';

/** Environment variables of the hooks contract. */
export const UI_TEST_ENV = {
  out: 'RE_SHELL_UI_TEST_OUT',
  snapshots: 'RE_SHELL_UI_TEST_SNAPSHOTS',
} as const;

/** Per-story record the hooks write (see the template below). */
export interface UiStoryRecord {
  id: string;
  title?: string;
  name?: string;
  /** One line per axe violation, `[theme] rule (impact): help -> selectors`. */
  a11y: string[];
  /** One line per visual mismatch, `[theme] message`. */
  visual: string[];
  /** Baselines written during this run. */
  createdBaselines: number;
}

/** The CommonJS source written to the temporary config directory. */
export const UI_TEST_HOOKS_SOURCE = `'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { getViolations, injectAxe } = require('axe-playwright');
const { toMatchImageSnapshot } = require('jest-image-snapshot');

const THEMES = ['dark', 'light'];
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const OUT_DIR = process.env.${UI_TEST_ENV.out};
const SNAPSHOT_DIR = path.resolve(process.env.${UI_TEST_ENV.snapshots} || path.join(process.cwd(), '__image_snapshots__'));
const FREEZE_CSS = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}';

async function runAxe(page) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await getViolations(page, 'body', {
        runOnly: { type: 'tag', values: WCAG_TAGS },
        rules: { region: { enabled: false } },
      });
    } catch (error) {
      const busy = error instanceof Error && /already running/i.test(error.message);
      if (!busy || attempt >= 20) throw error;
      await new Promise((done) => setTimeout(done, 250));
    }
  }
}

module.exports = {
  setup() {
    expect.extend({ toMatchImageSnapshot });
  },
  async preVisit(page) {
    await page.addStyleTag({ content: FREEZE_CSS });
    await injectAxe(page);
  },
  async postVisit(page, context) {
    const a11y = [];
    const visual = [];
    let createdBaselines = 0;
    for (const theme of THEMES) {
      await page.evaluate((value) => {
        const root = document.documentElement;
        root.classList.toggle('dark', value === 'dark');
        root.classList.toggle('light', value === 'light');
        root.style.colorScheme = value;
      }, theme);
      await page.evaluate(() => document.fonts.ready);

      for (const violation of await runAxe(page)) {
        const targets = violation.nodes.slice(0, 3).map((node) => node.target.join(' ')).join('; ');
        a11y.push('[' + theme + '] ' + violation.id + ' (' + (violation.impact || 'n/a') + '): ' + violation.help + ' -> ' + targets);
      }

      const identifier = context.id + '-' + theme;
      const baseline = path.join(SNAPSHOT_DIR, identifier + '-snap.png');
      const existed = fs.existsSync(baseline);
      try {
        const image = await page.screenshot({ fullPage: true });
        expect(image).toMatchImageSnapshot({
          customSnapshotsDir: SNAPSHOT_DIR,
          customSnapshotIdentifier: identifier,
          failureThreshold: 0.005,
          failureThresholdType: 'percent',
          customDiffConfig: { threshold: 0.1 },
        });
        if (!existed && fs.existsSync(baseline)) createdBaselines += 1;
      } catch (error) {
        visual.push('[' + theme + '] ' + (error instanceof Error ? error.message.split('\\n')[0] : String(error)));
      }
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(OUT_DIR, context.id + '.json'),
      JSON.stringify({ id: context.id, title: context.title, name: context.name, a11y, visual, createdBaselines })
    );
  },
};
`;
