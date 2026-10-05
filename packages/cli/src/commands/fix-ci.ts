// `re-shell fix --ci` — autonomous CI fixer command (issue #18, R-3).
//
// Real mode (default): detects/loads the workspace gates, runs them as real
// child processes, and — when an AI provider is configured — asks it for
// validated unified-diff patches, applying and re-evaluating them on a new
// `re-shell/fix-ci-<timestamp>` branch (see ../fix-ci/). Without a provider the
// command is REPORT-ONLY: it reports the failing gates honestly and exits
// non-zero. It exits non-zero unless the gates end green.
//
// Injected mode (tests): when `evaluate` is supplied, the pure fix-loop engine
// is driven by the injected evaluator/applier/PR opener.
//
// Safety contract (both modes): locked gates (tests) must pass, the iteration
// budget is bounded, a rollback boundary undoes failed work, a PR is opened
// only after gates pass AND --no-dry-run, and the loop NEVER merges or pushes
// to a protected/base branch — that stays human-controlled.

import chalk from 'chalk';
import { ok, fail } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import {
  runFixLoop,
  fixResult,
  DEFAULT_MAX_ITERATIONS,
  type GateEvaluator,
  type FixApplier,
  type FixLoopRun,
} from '../utils/fix-loop-engine';
import type { ErrorCode, FixCiResponse } from '@re-shell/contracts';
import { runRealFixCi } from '../fix-ci/loop';
import { resolveProvider, type FixProvider } from '../fix-ci/provider';
import type { PrOpener } from '../fix-ci/pr';
import { FixCiError } from '../fix-ci/types';

/**
 * Options accepted by the `fix --ci` command.
 *
 * Controls dry-run vs. live behavior, the iteration budget, and exposes
 * injection points (gate evaluator, fix applier, PR opener) primarily used
 * by tests to substitute the real command-layer adapters.
 */
export interface FixCiOptions {
  /** Emit machine-readable JSON output instead of the human-friendly rendering. */
  json?: boolean;
  /**
   * When false (the safe default), only report; when true, open a PR after gates pass.
   *
   * @remarks Setting this to `true` is the only way the loop will actually
   * open a pull request — and only when the loop reaches the `pr-ready` outcome.
   */
  noDryRun?: boolean;
  /** Max loop iterations (backstop). */
  maxIterations?: number;
  /** Working directory override (tests). */
  cwd?: string;
  /** Allow starting with uncommitted changes (they are never touched or committed). */
  allowDirty?: boolean;
  /** Gate names to skip (unlocked gates only). */
  skipGates?: string[];
  /** Model override for the AI provider. */
  model?: string;
  /**
   * Injectable fix provider. `undefined` resolves one from the environment
   * (ANTHROPIC_API_KEY); `null` forces report-only mode.
   */
  provider?: FixProvider | null;
  /** Injectable PR opener for the real loop (defaults to git push + gh). */
  openPr?: PrOpener;
  /**
   * Injectable gate evaluator (tests). When absent the REAL evaluator runs the
   * workspace's gates as child processes.
   */
  evaluate?: GateEvaluator;
  /** Injectable fix applier (tests). When absent, a no-op stub is used. */
  applyFix?: FixApplier;
  /** Injectable PR opener (tests). Returns the PR URL. */
  openPullRequest?: () => Promise<string>;
}

/** The default fix applier: a documented no-op that triggers the rollback boundary. */
function defaultApplier(): FixApplier {
  return failing =>
    fixResult('noop', `No automated fix wired for failing gates: ${failing.failingGates.join(', ')}`, false);
}

/**
 * `re-shell fix --ci` — autonomous CI fixer.
 *
 * Wires the pure fix-loop engine to injected evaluators and a fix
 * applier, drives remediation toward green gates under a bounded budget, and —
 * only when gates pass AND `noDryRun` is set — opens a pull request.
 *
 * Safety contract:
 *   - Dry-run is the default: nothing is committed or pushed.
 *   - A PR is opened ONLY under BOTH --no-dry-run AND outcome `pr-ready`.
 *   - The loop NEVER merges and NEVER pushes to a protected branch.
 *   - The iteration budget + the no-progress rollback boundary cap the work.
 *
 * @param options - Command options controlling output mode, dry-run behavior,
 *   iteration budget, and injectable adapters.
 * @returns Resolves once the loop has finished and any output (JSON or
 *   human-readable) has been emitted. Rejection only happens on unrecoverable
 *   errors inside the loop itself.
 */
export async function runFixCi(options: FixCiOptions): Promise<void> {
  const json = Boolean(options.json);
  if (!options.evaluate) {
    await runRealFixCiCommand(options);
    return;
  }
  const dryRun = !options.noDryRun;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  const spinner = json ? null : createSpinner('Running gated fix loop…', undefined, { json });
  spinner?.start();

  const warnings: string[] = [];
  try {
    const evaluate = options.evaluate;
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
    if (!run.gatesPassed) {
      process.exitCode = 1;
    }
  } finally {
    spinner?.stop();
  }
}

/**
 * The REAL path: real gates as child processes, an AI fix applier when a
 * provider is configured (report-only otherwise), git branch + rollback, and
 * PR opening only under --no-dry-run. Exit code is non-zero unless gates end green.
 */
async function runRealFixCiCommand(options: FixCiOptions): Promise<void> {
  const json = Boolean(options.json);
  const dryRun = !options.noDryRun;
  try {
    const provider =
      options.provider !== undefined ? options.provider : resolveProvider({ model: options.model });
    const payload = await runRealFixCi({
      cwd: options.cwd ?? process.cwd(),
      maxIterations: options.maxIterations,
      dryRun,
      allowDirty: options.allowDirty,
      skipGates: options.skipGates,
      provider,
      openPr: options.openPr,
    });
    if (payload.verdict === 'green') {
      if (json) {
        ok(payload, payload.warnings);
      } else {
        renderHuman(payload, dryRun);
      }
      return;
    }
    // Red: never ok:true. The full run log rides in error.details.
    if (json) {
      fail(
        payload.outcome === 'report-only' ? 'FIX_CI_NO_PROVIDER' : 'FIX_CI_GATES_RED',
        payload.summary,
        payload as unknown as Record<string, unknown>
      );
    } else {
      renderHuman(payload, dryRun);
      process.exitCode = 1;
    }
  } catch (err) {
    if (err instanceof FixCiError) {
      emitFixCiError(json, err.message, err.code, err.details);
    } else {
      emitFixCiError(json, err instanceof Error ? err.message : String(err));
    }
  }
}

/**
 * Emit a FIX_CI_ERROR envelope (json) or red message + non-zero exit.
 *
 * Used by the command's top-level error path to surface failures in a form
 * consistent with the chosen output mode.
 *
 * @param json - When `true`, emit a structured `FIX_CI_ERROR` envelope via
 *   `fail`. When `false`, write a red message to stderr and set a non-zero
 *   exit code.
 * @param message - Human-readable error description to surface to the caller.
 * @returns Nothing; output is a side effect (stdout/stderr / exit code).
 */
export function emitFixCiError(
  json: boolean,
  message: string,
  code: ErrorCode = 'FIX_CI_ERROR',
  details?: Record<string, unknown>
): void {
  if (json) {
    fail(code, message, details);
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

  if (payload.branch) {
    process.stdout.write(chalk.gray(`  branch: ${payload.branch}${payload.baseBranch ? ` (from ${payload.baseBranch})` : ''}\n`));
  }
  if (!payload.gatesPassed && payload.finalGates) {
    for (const gate of payload.finalGates.filter(g => !g.passed)) {
      process.stdout.write(
        chalk.red(`\n  ✗ ${gate.name}`) + chalk.gray(` (${gate.kind}${gate.locked ? ', locked' : ''}) ${gate.command.join(' ')}\n`)
      );
      for (const f of gate.failing.slice(0, 15)) {
        const loc = f.file ? `${f.file}${f.line !== undefined ? `:${f.line}` : ''}  ` : '';
        process.stdout.write(`      ${loc}${f.code ? `${f.code} ` : ''}${f.message.split('\n')[0]}\n`);
      }
      if (gate.failing.length > 15) {
        process.stdout.write(chalk.gray(`      ... and ${gate.failing.length - 15} more\n`));
      }
    }
  }
  if (payload.manualSteps && payload.manualSteps.length > 0) {
    process.stdout.write(chalk.yellow('\n  No PR was opened automatically. Manual steps:\n'));
    for (const step of payload.manualSteps) process.stdout.write(`    ${step}\n`);
  }

  if (payload.prOpened && payload.prUrl) {
    process.stdout.write(chalk.green(`\n  PR opened: ${payload.prUrl}\n`));
  } else if (!dryRun && payload.outcome === 'pr-ready' && !payload.manualSteps) {
    process.stdout.write(chalk.gray('\n  Gates green; no PR opener wired.\n'));
  } else if (dryRun && (payload.outcome === 'pr-ready' || payload.outcome === 'already-green')) {
    process.stdout.write(chalk.gray('\n  Dry run: use --no-dry-run to open a PR after gates pass.\n'));
  }

  for (const warning of payload.warnings) {
    process.stdout.write(chalk.yellow(`  ! ${warning}\n`));
  }
  process.stdout.write('\n');
}
