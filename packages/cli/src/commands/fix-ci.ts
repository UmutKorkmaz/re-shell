// `re-shell fix --ci` — autonomous CI fixer command (issue #18).
//
// Wires the pure fix-loop engine to real evaluators + an injectable fix applier.
// The loop drives remediation to green behind LOCKED gates (tests must pass),
// enforces a bounded budget + a rollback boundary, and opens a PR only after
// gates pass AND --no-dry-run is set. Merge/push to a protected branch stays
// human-controlled — the loop NEVER auto-merges. Dry-run (the default) only
// reports what the loop WOULD do.

import chalk from 'chalk';
import { ok, fail } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import {
  runFixLoop,
  gateResult,
  fixResult,
  DEFAULT_MAX_ITERATIONS,
  type GateEvaluator,
  type FixApplier,
  type FixLoopRun,
} from '../utils/fix-loop-engine';
import type { FixCiResponse } from '@re-shell/contracts';

/** Options accepted by the `fix --ci` command. */
export interface FixCiOptions {
  json?: boolean;
  /** When false (the safe default), only report; when true, open a PR after gates pass. */
  noDryRun?: boolean;
  /** Max loop iterations (backstop). */
  maxIterations?: number;
  /** Working directory override (tests). */
  cwd?: string;
  /** Injectable gate evaluator (tests). When absent, a no-op stub is used. */
  evaluate?: GateEvaluator;
  /** Injectable fix applier (tests). When absent, a no-op stub is used. */
  applyFix?: FixApplier;
  /** Injectable PR opener (tests). Returns the PR URL. */
  openPullRequest?: () => Promise<string>;
}

/**
 * The default gate evaluator adapter: in this offline-first slice it reports the
 * gates as "unknown" (passing with a warning) unless real evaluators are wired.
 * The command layer's real adapter (running tests / doctor / lint) is injected by
 * the caller; the engine never assumes a specific gate source.
 */
function defaultEvaluator(warnings: string[]): GateEvaluator {
  return () => {
    warnings.push('no real gate evaluator wired; treating gates as passing (offline stub)');
    return Promise.resolve(gateResult(true, []));
  };
}

/** The default fix applier: a documented no-op that triggers the rollback boundary. */
function defaultApplier(): FixApplier {
  return failing =>
    fixResult('noop', `No automated fix wired for failing gates: ${failing.failingGates.join(', ')}`, false);
}

/**
 * `re-shell fix --ci` — autonomous CI fixer.
 *
 * Safety contract:
 *   - Dry-run is the default: nothing is committed or pushed.
 *   - A PR is opened ONLY under BOTH --no-dry-run AND outcome `pr-ready`.
 *   - The loop NEVER merges and NEVER pushes to a protected branch.
 *   - The iteration budget + the no-progress rollback boundary cap the work.
 */
export async function runFixCi(options: FixCiOptions): Promise<void> {
  const json = Boolean(options.json);
  const dryRun = !options.noDryRun;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  const spinner = json ? null : createSpinner('Running gated fix loop…', undefined, { json });
  spinner?.start();

  const warnings: string[] = [];
  try {
    const evaluate = options.evaluate ?? defaultEvaluator(warnings);
    const applyFix = options.applyFix ?? defaultApplier();

    const run: FixLoopRun = await runFixLoop(evaluate, applyFix, maxIterations);

    // Open a PR only when the loop reached pr-ready AND the caller opted out of
    // dry-run. The loop never merges or pushes to a protected branch.
    let prOpened = false;
    let prUrl = '';
    if (!dryRun && run.outcome === 'pr-ready' && options.openPullRequest) {
      try {
        prUrl = await options.openPullRequest();
        prOpened = prUrl.length > 0;
      } catch (err) {
        warnings.push(`failed to open PR: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if (!dryRun && run.outcome === 'pr-ready') {
      warnings.push('gates passed but no PR opener is wired (dry-run stayed)');
    }

    const payload: FixCiResponse = {
      outcome: run.outcome,
      gatesPassed: run.gatesPassed,
      iterations: run.iterations.map(it => ({
        iteration: it.iteration,
        gatesBefore: { passed: it.gatesBefore.passed, failingGates: [...it.gatesBefore.failingGates] },
        ...(it.fix
          ? { fix: { fixId: it.fix.fixId, description: it.fix.description, changed: it.fix.changed } }
          : {}),
        ...(it.gatesAfter
          ? { gatesAfter: { passed: it.gatesAfter.passed, failingGates: [...it.gatesAfter.failingGates] } }
          : {}),
      })),
      appliedFixes: run.appliedFixes.map(f => ({
        fixId: f.fixId,
        description: f.description,
        changed: f.changed,
      })),
      summary: run.summary,
      prOpened,
      prUrl,
      warnings,
    };

    if (json) {
      ok(payload);
    } else {
      renderHuman(payload, dryRun);
    }
  } finally {
    spinner?.stop();
  }
}

/** Emit a FIX_CI_ERROR envelope (json) or red message + non-zero exit. */
export function emitFixCiError(json: boolean, message: string): void {
  if (json) {
    fail('FIX_CI_ERROR', message);
  } else {
    process.stderr.write(chalk.red(`\n✗ ${message}\n`));
    process.exitCode = 1;
  }
}

/** Human-readable render of the fix-loop run. */
function renderHuman(payload: FixCiResponse, dryRun: boolean): void {
  process.stdout.write(chalk.cyan.bold('\n▶ fix --ci\n\n'));
  const tone =
    payload.outcome === 'pr-ready' || payload.outcome === 'already-green'
      ? chalk.green
      : payload.outcome === 'no-progress'
        ? chalk.yellow
        : chalk.red;
  process.stdout.write(`  ${tone.bold(payload.outcome)}  ${payload.summary}\n\n`);

  for (const it of payload.iterations) {
    process.stdout.write(
      `  iter ${it.iteration}  gates ${it.gatesBefore.passed ? '✓' : chalk.red('✗')}` +
        (it.gatesBefore.failingGates.length
          ? chalk.gray(` [${it.gatesBefore.failingGates.join(', ')}]`)
          : '') +
        '\n'
    );
    if (it.fix) {
      process.stdout.write(
        `    fix ${it.fix.fixId}${it.fix.changed ? '' : chalk.gray(' (no-op)')}: ${it.fix.description}\n`
      );
    }
    if (it.gatesAfter) {
      process.stdout.write(
        `    after  gates ${it.gatesAfter.passed ? '✓' : chalk.red('✗')}\n`
      );
    }
  }

  if (payload.prOpened && payload.prUrl) {
    process.stdout.write(chalk.green(`\n  PR opened: ${payload.prUrl}\n`));
  } else if (!dryRun && payload.outcome === 'pr-ready') {
    process.stdout.write(chalk.gray('\n  Gates green; no PR opener wired.\n'));
  } else if (dryRun) {
    process.stdout.write(chalk.gray('\n  Dry run: use --no-dry-run to open a PR after gates pass.\n'));
  }

  for (const warning of payload.warnings) {
    process.stdout.write(chalk.yellow(`  ! ${warning}\n`));
  }
  process.stdout.write('\n');
}
