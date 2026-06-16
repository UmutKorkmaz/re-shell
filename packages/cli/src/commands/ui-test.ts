// `re-shell ui test` — Storybook-9 UI test aggregation command (issue #22).
//
// Runs all stories headless (interaction + a11y + visual) via an injectable
// runner, aggregates the results into a UI-maturity score that feeds the
// scorecard as a UI-maturity dimension, and gates CI on a11y/visual failures.
// The runner is injectable so the aggregation is fully testable offline.

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
import type { UiFailure, UiTestResponse } from '@re-shell/contracts';

/** Options accepted by the `ui test` command. */
export interface UiTestOptions {
  json?: boolean;
  /** Comma-separated pillars that gate CI (default: a11y,visual). */
  gate?: string;
  /** Injectable story runner (tests). When absent, a stub reports no stories. */
  runStories?: () => Promise<StoryResult[]>;
}

/** The default runner stub: reports that no Storybook runner is wired. */
async function defaultRunner(warnings: string[]): Promise<StoryResult[]> {
  warnings.push(
    'no Storybook runner wired (offline stub); pass results via an injected runner or run `npx storybook test`'
  );
  return [];
}

/**
 * `re-shell ui test` — Storybook-9 UI test aggregation + a11y/visual gate.
 *
 * Gate semantics: by default a failing a11y OR visual pillar on any story fails
 * the CI check (non-zero exit), while still emitting the full payload. The gate
 * pillars are configurable via --gate.
 */
export async function runUiTest(options: UiTestOptions): Promise<void> {
  const json = Boolean(options.json);

  const spinner = json ? null : createSpinner('Running UI tests…', undefined, { json });
  spinner?.start();

  const warnings: string[] = [];
  try {
    const runStories = options.runStories ?? (() => defaultRunner(warnings));
    const results = await runStories();

    const aggregate = aggregateUiTests(results);
    const gateKinds: readonly UiGateKind[] = options.gate
      ? (options.gate.split(',').map(s => s.trim()).filter(Boolean) as UiGateKind[])
      : DEFAULT_UI_GATE;
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

    // Gate: a failing gated pillar (default a11y/visual) fails the CI check.
    if (!pass) {
      process.exitCode = 1;
    }
  } finally {
    spinner?.stop();
  }
}

/** Emit a UI_TEST_ERROR envelope (json) or red message + non-zero exit. */
export function emitUiTestError(json: boolean, message: string): void {
  if (json) {
    fail('UI_TEST_ERROR', message);
  } else {
    process.stderr.write(chalk.red(`\n✗ ${message}\n`));
    process.exitCode = 1;
  }
}

/** Human-readable render of the UI-test report. */
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
