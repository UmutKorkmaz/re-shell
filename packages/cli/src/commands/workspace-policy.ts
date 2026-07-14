import chalk from 'chalk';
import * as path from 'path';
import {
  evaluatePolicyPack,
  resolvePolicyPack,
  type PolicyCheckResult,
} from '../utils/policy-engine';
import {
  detectDependencyDrift,
  computeDriftScore,
  generateDriftReport,
  suggestAlignment,
  type DriftResult,
} from '../utils/dependency-drift';
import { ok, fail, enableJsonMode } from '../utils/json-output';
import type { ProgressSpinner } from '../utils/spinner';

/** Options for the `workspace policy check` command. */
export interface PolicyCheckCommandOptions {
  /** Policy pack name or path to evaluate. */
  pack?: string;
  /** Emit machine-readable JSON output. */
  json?: boolean;
  /** Working directory to evaluate (defaults to `process.cwd()`). */
  cwd?: string;
  /** Optional spinner to display progress. */
  spinner?: ProgressSpinner;
}

/** Options for the `workspace drift` command. */
export interface DriftCommandOptions {
  json?: boolean;
  /** Output a full markdown report instead of the summary view. */
  report?: boolean;
  /** Print only the 0-100 alignment score. */
  score?: boolean;
  /** Workspace name used in report headers (defaults to directory name). */
  workspaceName?: string;
  cwd?: string;
  spinner?: ProgressSpinner;
}

/**
 * `workspace policy check` — evaluate a policy pack against the monorepo,
 * compute a readiness score, and (in JSON mode) emit the ok envelope. The
 * process exits non-zero when any error-severity rule fails.
 */
export async function runPolicyCheck(
  options: PolicyCheckCommandOptions = {}
): Promise<void> {
  const rootPath = options.cwd ?? process.cwd();

  if (options.json) {
    const restore = enableJsonMode();
    try {
      const pack = await resolvePolicyPack(options.pack);
      const result = await evaluatePolicyPack(pack, rootPath);
      const warnings = result.failed
        .filter(f => f.severity === 'warning')
        .map(f => `[${f.target}] ${f.message}`);
      ok(
        {
          score: result.score,
          passed: result.passed,
          failed: result.failed,
        },
        warnings
      );
      if (result.hasErrors) process.exitCode = 1;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown policy check error';
      fail('POLICY_CHECK_ERROR', message);
    } finally {
      restore();
    }
    return;
  }

  if (options.spinner) options.spinner.stop();

  try {
    const pack = await resolvePolicyPack(options.pack);
    const result = await evaluatePolicyPack(pack, rootPath);
    displayPolicyResult(result);
    if (result.hasErrors) process.exitCode = 1;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown policy check error';
    console.error(chalk.red(`Policy check failed: ${message}`));
    process.exitCode = 1;
  }
}

/**
 * `workspace drift` — report dependencies pinned to different versions across
 * the monorepo. Supports `--report` for a full markdown report, `--score` for
 * a bare 0-100 alignment score, and `--json` for machine-readable output.
 * Always exits 0 (drift is informational, not a hard failure).
 */
export async function runDriftCheck(
  options: DriftCommandOptions = {}
): Promise<void> {
  const rootPath = options.cwd ?? process.cwd();

  if (options.json) {
    const restore = enableJsonMode();
    try {
      const result = await detectDependencyDrift(rootPath);
      const score = computeDriftScore(result);
      ok({ ...result, score });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown drift check error';
      fail('DRIFT_CHECK_ERROR', message);
    } finally {
      restore();
    }
    return;
  }

  if (options.spinner) options.spinner.stop();

  try {
    const result = await detectDependencyDrift(rootPath);

    if (options.score) {
      const score = computeDriftScore(result);
      console.log(score);
      return;
    }

    if (options.report) {
      const wsName = options.workspaceName ?? path.basename(rootPath);
      const report = generateDriftReport(result, wsName);
      console.log(report);
      return;
    }

    displayDriftResult(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown drift check error';
    console.error(chalk.red(`Drift check failed: ${message}`));
    process.exitCode = 1;
  }
}

/**
 * Render the policy-check results in human-readable text format.
 *
 * @param result - The policy evaluation result.
 */
function displayPolicyResult(result: PolicyCheckResult): void {
  const scoreColor =
    result.score >= 90 ? chalk.green : result.score >= 70 ? chalk.yellow : chalk.red;

  console.log(chalk.cyan(`\n📋 Policy check: ${result.pack}`));
  console.log(chalk.gray('═'.repeat(50)));
  console.log(`Readiness score: ${scoreColor(`${result.score}%`)}`);
  console.log(`Passed rules: ${chalk.green(result.passed.length)}`);

  if (result.failed.length === 0) {
    console.log(chalk.green('\n✅ No rule failures.'));
    return;
  }

  console.log(chalk.red(`\nFailures (${result.failed.length}):`));
  for (const f of result.failed) {
    const icon = f.severity === 'error' ? chalk.red('✖') : chalk.yellow('⚠');
    console.log(`  ${icon} [${f.severity}] ${f.ruleId} (${f.target}): ${f.message}`);
  }
}

/**
 * Render the dependency-drift results in human-readable text format with
 * alignment score, severity labels, and fix suggestions.
 *
 * @param result - The drift detection result.
 */
function displayDriftResult(result: DriftResult): void {
  const score = computeDriftScore(result);
  const scoreColor = score >= 90 ? chalk.green : score >= 70 ? chalk.yellow : chalk.red;

  console.log(chalk.cyan('\n🔀 Dependency drift'));
  console.log(chalk.gray('═'.repeat(50)));
  console.log(`Alignment score: ${scoreColor(`${score}/100`)}`);

  if (result.drift.length === 0) {
    console.log(chalk.green('\n✅ No drift detected — all shared dependencies are aligned.'));
    return;
  }

  console.log(chalk.yellow(`\nFound drift in ${result.drift.length} dependenc${result.drift.length === 1 ? 'y' : 'ies'}:\n`));
  for (const entry of result.drift) {
    const suggestion = suggestAlignment(entry);
    const severityTag =
      suggestion.confidence > 0.6 ? chalk.green(' minor') :
      suggestion.confidence > 0.3 ? chalk.yellow('moderate') :
      chalk.red('  major');
    console.log(`${chalk.bold(entry.dependency)}  [${severityTag}]`);
    for (const v of entry.versions) {
      const marker = v.version === suggestion.version ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${marker} ${chalk.cyan(v.version)} → ${v.packages.join(', ')}`);
    }
    console.log(chalk.gray(`  Suggest: align to ${suggestion.version} (${(suggestion.confidence * 100).toFixed(0)}% confidence)`));
    console.log();
  }
}
