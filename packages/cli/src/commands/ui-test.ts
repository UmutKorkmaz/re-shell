// `re-shell ui test` — Storybook-9 UI test aggregation command (issue #22).
//
// Runs all stories headless (interaction + a11y + visual) through the workspace's
// real Storybook (@storybook/test-runner, see utils/ui-test-runner.ts), aggregates
// the results into a UI-maturity score that feeds the scorecard as a UI-maturity
// dimension, and gates CI on a11y/visual failures. The runner is injectable so the
// aggregation stays testable offline; when none is injected the Storybook runner is
// used, and if no Storybook can be detected the command fails explicitly.

import chalk from 'chalk';
import { ok, fail } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import {
  aggregateUiTests,
  passesGate,
  flattenFailures,
  DEFAULT_UI_GATE,
  type StoryResult,
  type UiGateKind,
} from '../utils/ui-test-engine';
import {
  runStorybookTests,
  StorybookRunError,
  type StorybookRunOptions,
} from '../utils/ui-test-runner';
import type { UiFailure, UiTestResponse } from '@re-shell/contracts';

/** Options accepted by the `ui test` command. */
export interface UiTestOptions {
  /** Emit machine-readable JSON output instead of a human-readable report. */
  json?: boolean;
  /** Comma-separated pillars that gate CI (default: a11y,visual). */
  gate?: string;
  /** Injectable story runner (tests). Defaults to the real Storybook runner. */
  runStories?: () => Promise<StoryResult[]>;
  /** Workspace to search for a Storybook (default: cwd). */
  workspace?: string;
  /** Storybook project directory (the one containing `.storybook`). */
  storybook?: string;
  /** Test an already running / hosted Storybook at this URL. */
  url?: string;
  /** Serve a prebuilt `storybook-static` directory instead of building. */
  staticDir?: string;
  /** Refresh visual baselines instead of comparing. */
  updateSnapshots?: boolean;
  /** Fail when a visual baseline is missing instead of writing it. */
  ci?: boolean;
  /** Chromium executable for Playwright. */
  browser?: string;
  /** Deadline for build + run in ms. */
  timeoutMs?: number;
}

/**
 * `re-shell ui test` — Storybook-9 UI test aggregation + a11y/visual gate.
 *
 * Gate semantics: by default a failing a11y OR visual pillar on any story fails
 * the CI check (non-zero exit), while still emitting the full payload. The gate
 * pillars are configurable via --gate.
 *
 * @param options - Test options (JSON mode, gate pillars, custom runner).
 */
export async function runUiTest(options: UiTestOptions): Promise<void> {
  const json = Boolean(options.json);
  const configuredKinds = options.gate === undefined
    ? DEFAULT_UI_GATE
    : options.gate.split(',').map(s => s.trim()).filter(Boolean);
  const isGateKind = (kind: string): kind is UiGateKind =>
    kind === 'a11y' || kind === 'visual' || kind === 'interaction';
  if (configuredKinds.length === 0 || !configuredKinds.every(isGateKind)) {
    emitUiTestError(json, 'Invalid UI gate: select one or more of a11y, visual, interaction.');
    return;
  }
  const gateKinds: readonly UiGateKind[] = configuredKinds;

  const spinner = json ? null : createSpinner('Running UI tests…', undefined, { json });
  spinner?.start();

  const warnings: string[] = [];
  try {
    let results: StoryResult[];
    if (options.runStories) {
      results = await options.runStories();
    } else {
      const runOptions: StorybookRunOptions = {
        workspace: options.workspace ?? process.cwd(),
        storybook: options.storybook,
        url: options.url,
        staticDir: options.staticDir,
        updateSnapshots: options.updateSnapshots,
        ci: options.ci,
        browserPath: options.browser ?? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        timeoutMs: options.timeoutMs,
      };
      try {
        const run = await runStorybookTests(runOptions);
        results = run.results;
        warnings.push(...run.warnings);
      } catch (error) {
        spinner?.stop();
        if (error instanceof StorybookRunError) {
          emitUiTestError(json, error.message, error.details);
          return;
        }
        throw error;
      }
    }

    const aggregate = aggregateUiTests(results);
    const pass = passesGate(aggregate, gateKinds);

    const failures: UiFailure[] = flattenFailures(aggregate).map(f => ({
      story: f.story,
      kind: f.kind,
      ...(f.detail ? { detail: f.detail } : {}),
    }));

    if (aggregate.storyCount === 0) {
      warnings.push('no stories were run; UI-maturity score is 0 (no signal).');
    }

    const payload: UiTestResponse = {
      storyCount: aggregate.storyCount,
      dimensions: aggregate.dimensions.map(d => ({
        kind: d.kind,
        total: d.total,
        passed: d.passed,
        passRate: d.passRate,
      })),
      uiMaturityScore: aggregate.uiMaturityScore,
      allPassed: aggregate.allPassed,
      pass,
      failures,
      warnings,
    };

    if (json) {
      ok(payload);
    } else {
      renderHuman(payload);
    }

    // A failing gated pillar or an empty run fails the CI check.
    if (!pass) {
      process.exitCode = 1;
    }
  } finally {
    spinner?.stop();
  }
}

/**
 * Emit a UI_TEST_ERROR envelope (JSON) or a red stderr message + non-zero exit.
 *
 * @param json - When true, emit a JSON error envelope; otherwise print to stderr.
 * @param message - The error message to display.
 */
export function emitUiTestError(json: boolean, message: string, details?: Record<string, unknown>): void {
  if (json) {
    fail('UI_TEST_ERROR', message, details);
  } else {
    process.stderr.write(chalk.red(`\n✗ ${message}\n`));
    const tailText = typeof details?.tail === 'string' ? details.tail : undefined;
    if (tailText) process.stderr.write(chalk.gray(`${tailText}\n`));
    process.exitCode = 1;
  }
}

/**
 * Render the UI-test report in human-readable format.
 *
 * @param payload - The aggregated UI test response.
 */
function renderHuman(payload: UiTestResponse): void {
  process.stdout.write(chalk.cyan.bold('\n▶ ui test\n\n'));
  process.stdout.write(
    `  ${chalk.bold('stories')}  ${payload.storyCount}  ` +
      chalk.gray(`(UI-maturity score: ${payload.uiMaturityScore}/100)`) +
      '\n\n'
  );

  for (const d of payload.dimensions) {
    const tone = d.passed === d.total && d.total > 0 ? chalk.green : d.passed === 0 ? chalk.gray : chalk.red;
    process.stdout.write(
      `  ${tone(d.kind.padEnd(12))} ${d.passed}/${d.total} passed` +
        chalk.gray(` (${d.passRate.toFixed(0)}%)`) +
        '\n'
    );
  }

  if (payload.failures.length > 0) {
    process.stdout.write('\n');
    for (const f of payload.failures) {
      process.stdout.write(
        `  ${chalk.red.bold('FAIL')}  ${f.kind} on ${f.story}` +
          (f.detail ? chalk.gray(` — ${f.detail}`) : '') +
          '\n'
      );
    }
  } else if (payload.storyCount > 0) {
    process.stdout.write(chalk.green('\n  ✓ all stories passed\n'));
  }

  const gate = payload.pass ? chalk.green('PASS') : chalk.red('FAIL');
  process.stdout.write(`\n  ${chalk.bold('result')}  ${gate}\n`);
  for (const w of payload.warnings) {
    process.stdout.write(chalk.yellow(`  ! ${w}\n`));
  }
  process.stdout.write('\n');
}
