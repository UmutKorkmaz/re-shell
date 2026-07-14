import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import chalk from 'chalk';

import {
  generateChart,
  type GenerateChartResult,
} from '../utils/helm-generate';
import { ok, fail, enableJsonMode } from '../utils/json-output';
import type { ProgressSpinner } from '../utils/spinner';

/**
 * Options accepted by the `k8s helm generate` command.
 *
 * The command reads the workspace v2 config and emits a Helm chart; these
 * options control where output is written, whether to emit a machine-readable
 * envelope, and how the workspace is discovered.
 */
export interface HelmGenerateCommandOptions {
  /** Target directory the chart files are written to. Omit to skip writing. */
  out?: string;
  /** When true, emit a JSON envelope instead of human-readable output. */
  json?: boolean;
  /** When true, skip writing files and only report what would be generated. */
  dryRun?: boolean;
  /** Working directory used when discovering the workspace. Defaults to CWD. */
  cwd?: string;
  /** Explicit path to the v2 config file. When omitted, the workspace is searched. */
  configPath?: string;
  /** Optional progress spinner to stop before printing output. */
  spinner?: ProgressSpinner;
}

/**
 * Best-effort `helm lint` outcome.
 *
 * `ran` is true only when helm actually linted the chart. When helm is absent
 * `ran` is false and `detail` explains why — generation then falls back to the
 * structural checks the tests assert on.
 */
export interface HelmLintResult {
  /** True only when helm actually linted the chart; false if helm was absent or failed to execute. */
  ran: boolean;
  /** Lint outcome when `ran` is true: true for passing, false for issues. Undefined when helm did not run. */
  ok?: boolean;
  /** Why helm was skipped, or helm's stdout/stderr when it ran. */
  detail?: string;
}

/**
 * Detect helm and, if present, write the chart to a temp dir and run
 * `helm lint`. Never throws; absence is reported as not-run (best-effort) so
 * generation stays usable without helm installed.
 *
 * @param result - The generated chart (with file list) to lint.
 * @returns A `HelmLintResult` describing whether helm ran and what it reported.
 */
export function lintWithHelm(result: GenerateChartResult): HelmLintResult {
  const probe = spawnSync('helm', ['version', '--short'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    return { ran: false, detail: 'helm not found on PATH' };
  }

  let tmpRoot: string | undefined;
  try {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-lint-'));
    const chartRoot = path.join(tmpRoot, result.chart.name);
    for (const file of result.chart.files) {
      const filePath = path.join(chartRoot, file.path);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, file.content);
    }

    const lint = spawnSync('helm', ['lint', chartRoot], { encoding: 'utf8' });
    if (lint.error) {
      return { ran: false, detail: `helm failed to execute: ${lint.error.message}` };
    }
    const passed = lint.status === 0;
    const detail = (passed ? lint.stdout : lint.stderr || lint.stdout)?.trim();
    return { ran: true, ok: passed, detail };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return { ran: false, detail: `helm lint setup failed: ${message}` };
  } finally {
    if (tmpRoot) {
      try {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup; ignore.
      }
    }
  }
}

/**
 * `k8s helm generate` — read the workspace v2 config and emit a Helm chart
 * (Chart.yaml, values.yaml, templates/). In `--json`/`--dry-run` mode nothing
 * is written; the ok envelope carries `{ chart: { name, files }, written, helm }`.
 * With `--out` (and not dry-run) the chart is written to disk. Errors map to a
 * `HELM_GENERATE_ERROR` envelope (exit 1).
 *
 * @param options - Optional command configuration (output path, JSON/dry-run flags, workspace hints).
 * @returns Resolves when generation, optional lint, and output are complete.
 */
export async function runHelmGenerate(
  options: HelmGenerateCommandOptions = {}
): Promise<void> {
  const generate = (): GenerateChartResult =>
    generateChart({
      cwd: options.cwd,
      configPath: options.configPath,
      out: options.out,
      dryRun: options.dryRun,
    });

  if (options.json) {
    const restore = enableJsonMode();
    try {
      const result = generate();
      const helm = lintWithHelm(result);
      const warnings: string[] = [];
      if (!helm.ran) {
        warnings.push(`helm lint not run: ${helm.detail ?? 'unavailable'}`);
      } else if (helm.ok === false) {
        warnings.push(`helm lint reported issues: ${helm.detail ?? ''}`.trim());
      }
      ok(
        {
          chart: result.chart,
          written: result.written,
          helm,
        },
        warnings
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown helm generate error';
      fail('HELM_GENERATE_ERROR', message);
    } finally {
      restore();
    }
    return;
  }

  if (options.spinner) options.spinner.stop();

  try {
    const result = generate();
    const helm = lintWithHelm(result);
    displayResult(result, helm, Boolean(options.dryRun));
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown helm generate error';
    console.error(chalk.red(`Helm generate failed: ${message}`));
    process.exitCode = 1;
  }
}

function displayResult(
  result: GenerateChartResult,
  helm: HelmLintResult,
  dryRun: boolean
): void {
  console.log(chalk.cyan('\n⛵ Helm chart generation'));
  console.log(chalk.gray('═'.repeat(50)));
  console.log(`Chart: ${chalk.bold(result.chart.name)}`);
  console.log(`Files: ${chalk.bold(result.chart.files.length)}`);
  for (const file of result.chart.files) {
    console.log(`  ${chalk.green('•')} ${file.path}`);
  }

  if (dryRun) {
    console.log(chalk.yellow('\nDry-run: no files written.'));
  } else if (result.written.length > 0) {
    console.log(chalk.green(`\nWrote ${result.written.length} file(s).`));
  } else {
    console.log(chalk.yellow('\nNo --out directory provided; nothing written.'));
  }

  if (helm.ran) {
    const icon = helm.ok ? chalk.green('✓') : chalk.red('✖');
    console.log(`\n${icon} helm lint: ${helm.ok ? 'PASS' : 'issues'}`);
    if (!helm.ok && helm.detail) console.log(chalk.gray(helm.detail));
  } else {
    console.log(chalk.gray('\nhelm not run (not installed); chart validated structurally.'));
  }
}
