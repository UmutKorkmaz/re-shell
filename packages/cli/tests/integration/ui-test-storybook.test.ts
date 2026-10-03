import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { runStorybookTests } from '../../src/utils/ui-test-runner';
import { aggregateUiTests, passesGate } from '../../src/utils/ui-test-engine';

/**
 * REAL end-to-end run of `re-shell ui test`: builds packages/ui's actual Storybook,
 * serves it, runs @storybook/test-runner in Chromium (play functions, axe in both
 * themes, image snapshots) and checks the three pillars come back as StoryResult[].
 *
 * It needs a Chromium. Point PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH at one (or run where
 * Playwright's browsers are installed and set RE_SHELL_UI_TEST_E2E=1). The CI
 * "storybook" job sets it, and also runs the CLI command itself.
 */
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const uiDir = path.join(repoRoot, 'packages', 'ui');
const browser = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const available =
  fs.existsSync(path.join(uiDir, 'node_modules', '.bin', 'test-storybook')) &&
  ((browser !== undefined && fs.existsSync(browser)) || process.env.RE_SHELL_UI_TEST_E2E === '1');

describe.skipIf(!available)('re-shell ui test against packages/ui (real Storybook)', () => {
  it('runs every story through interaction, a11y and visual checks and passes the gate', async () => {
    const run = await runStorybookTests({ workspace: repoRoot, storybook: 'packages/ui', browserPath: browser, ci: true });

    expect(run.project.projectDir).toBe(uiDir);
    // Every component has stories; guard against the suite silently shrinking.
    expect(run.storyCount).toBeGreaterThanOrEqual(40);
    expect(run.results).toHaveLength(run.storyCount);

    const failing = run.results.filter((r) => !r.interaction || !r.a11y || !r.visual);
    expect(failing.map((r) => `${r.id}: ${JSON.stringify(r.failures)}`)).toEqual([]);

    const aggregate = aggregateUiTests(run.results);
    expect(aggregate.uiMaturityScore).toBe(100);
    expect(passesGate(aggregate)).toBe(true);
    // --ci: no baseline may be (re)written during a verification run.
    expect(run.warnings).toEqual([]);
  }, 15 * 60_000);
});
