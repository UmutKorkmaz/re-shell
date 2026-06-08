import chalk from 'chalk';
import {
  evaluatePolicyPack,
  resolvePolicyPack,
  type PolicyCheckResult,
} from '../utils/policy-engine';
import { detectDependencyDrift, type DriftResult } from '../utils/dependency-drift';
import { ok, fail, enableJsonMode } from '../utils/json-output';
import type { ProgressSpinner } from '../utils/spinner';

export interface PolicyCheckCommandOptions {
  pack?: string;
  json?: boolean;
  cwd?: string;
  spinner?: ProgressSpinner;
}

export interface DriftCommandOptions {
  json?: boolean;
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
 * the monorepo. Always exits 0 (drift is informational, not a hard failure).
 */
export async function runDriftCheck(
  options: DriftCommandOptions = {}
): Promise<void> {
  const rootPath = options.cwd ?? process.cwd();

  if (options.json) {
    const restore = enableJsonMode();
    try {
      const result = await detectDependencyDrift(rootPath);
      ok(result);
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
    displayDriftResult(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown drift check error';
    console.error(chalk.red(`Drift check failed: ${message}`));
    process.exitCode = 1;
  }
}

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

function displayDriftResult(result: DriftResult): void {
  console.log(chalk.cyan('\n🔀 Dependency drift'));
  console.log(chalk.gray('═'.repeat(50)));

  if (result.drift.length === 0) {
    console.log(chalk.green('✅ No drift detected — all shared dependencies are aligned.'));
    return;
  }

  console.log(chalk.yellow(`Found drift in ${result.drift.length} dependency(ies):\n`));
  for (const entry of result.drift) {
    console.log(chalk.bold(entry.dependency));
    for (const v of entry.versions) {
      console.log(`  ${chalk.cyan(v.version)} → ${v.packages.join(', ')}`);
    }
    console.log();
  }
}
