import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import { createAsyncCommand, processManager } from '../utils/error-handler';
import { createSpinner, flushOutput } from '../utils/spinner';
import { enableJsonMode, ok, fail } from '../utils/json-output';
import type { RunResponse, TaskRunResult } from '@re-shell/contracts';
import {
  runTask,
  discoverWorkspace,
  resolveAffectedPackages,
} from '../utils/task-runner';

/**
 * Parse the `--concurrency` option. Returns undefined for missing/invalid input
 * so the runner falls back to the CPU-count default; never returns < 1.
 */
function parseConcurrency(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.floor(n);
}

/** Normalise a repeatable/CSV `--filter` option into a flat string list. */
function parseFilter(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  const list = Array.isArray(raw) ? raw : [raw];
  const out = list
    .flatMap(v => String(v).split(','))
    .map(s => s.trim())
    .filter(Boolean);
  return out.length > 0 ? out : undefined;
}

/**
 * `run <task>` — a generic, dependency-aware task runner.
 *
 * Builds an execution DAG of (package, task) nodes honouring intra-package task
 * deps (e.g. test -> build) and upstream-package deps (e.g. build -> ^build),
 * detects cycles BEFORE running anything, then executes with bounded
 * parallelism. Packages that do not define the task script are skipped (their
 * dependents still run). Exits non-zero if any task fails.
 */
export function registerRunGroup(program: Command): void {
  program
    .command('run')
    .description('Run a task across the workspace in dependency order')
    .argument('<task>', 'Task/script name to run, e.g. build or test')
    .option('--affected', 'Only run for packages affected by current changes')
    .option('--concurrency <n>', 'Max parallel tasks (default: CPU count)')
    .option('--filter <pkg...>', 'Restrict to specific package name(s)')
    .option('--json', 'Output the run summary as a JSON envelope')
    .option(
      '--continue',
      'Continue scheduling unaffected branches after a failure'
    )
    .action(
      createAsyncCommand(async (task: string, options) => {
        const restoreJson = options.json ? enableJsonMode() : () => {};
        const spinner = options.json
          ? undefined
          : createSpinner('Planning tasks...').start();
        if (spinner) {
          processManager.addCleanup(() => spinner.stop());
          flushOutput();
        }

        try {
          const rootPath = process.cwd();
          if (!(await fs.pathExists(path.join(rootPath, 'package.json')))) {
            if (spinner) spinner.stop();
            const message =
              'Not in a valid project directory (package.json not found)';
            emitError(options.json, message, { task });
            return;
          }

          const concurrency = parseConcurrency(options.concurrency);
          const filter = parseFilter(options.filter);

          let affectedPackages: string[] | undefined;
          if (options.affected) {
            const discovery = await discoverWorkspace(rootPath);
            affectedPackages = await resolveAffectedPackages(rootPath, discovery);
          }

          const result = await runTask({
            rootPath,
            task,
            concurrency,
            filter,
            affectedPackages,
            continueOnError: Boolean(options.continue),
            onOutput: options.json
              ? undefined
              : line => process.stdout.write(line + '\n'),
          });

          // A dependency cycle is a hard error: nothing ran.
          if (result.cycleError) {
            if (spinner) spinner.stop();
            if (options.json) {
              fail('RUN_ERROR', result.cycleError.message, {
                task,
                cycle: result.cycleError.cycle,
              });
            } else {
              console.log(
                chalk.red(`\n✗ ${result.cycleError.message}\n`)
              );
              process.exitCode = 1;
            }
            return;
          }

          if (options.json) {
            const payload: RunResponse = {
              task: result.task,
              concurrency: result.concurrency,
              results: result.results,
              ...(result.affected ? { affected: result.affected } : {}),
            };
            ok(payload);
          } else {
            if (spinner) spinner.stop();
            renderHuman(result.task, result.results, result.concurrency);
          }

          if (result.hadFailure) process.exitCode = 1;
        } catch (error) {
          if (spinner) spinner.stop();
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          emitError(options.json, `Error running task: ${message}`, { task });
        } finally {
          restoreJson();
        }
      })
    );
}

/** Emit an error consistently in JSON or human mode. */
function emitError(
  json: boolean,
  message: string,
  details: Record<string, unknown>
): void {
  if (json) {
    fail('RUN_ERROR', message, details);
  } else {
    console.log(chalk.red(`\n✗ ${message}\n`));
    process.exitCode = 1;
  }
}

/** Render a clean per-task summary for the terminal. */
function renderHuman(
  task: string,
  results: readonly TaskRunResult[],
  concurrency: number
): void {
  console.log(
    chalk.cyan.bold(
      `\n▶ run "${task}" (concurrency ${concurrency})\n`
    )
  );

  if (results.length === 0) {
    console.log(chalk.yellow('No matching packages to run.\n'));
    return;
  }

  for (const r of results) {
    const icon =
      r.status === 'success'
        ? chalk.green('✓')
        : r.status === 'failed'
          ? chalk.red('✗')
          : chalk.gray('○');
    const dur = r.status === 'skipped' ? '' : chalk.gray(` (${r.durationMs}ms)`);
    const label = `${r.package}:${r.task}`;
    const statusText =
      r.status === 'skipped'
        ? chalk.gray('skipped (no script)')
        : r.status === 'failed'
          ? chalk.red(`failed (exit ${r.exitCode})`)
          : chalk.green('success');
    console.log(`  ${icon} ${chalk.bold(label)} — ${statusText}${dur}`);
  }

  const failed = results.filter(r => r.status === 'failed').length;
  const succeeded = results.filter(r => r.status === 'success').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  console.log(
    `\n  ${chalk.green(`${succeeded} ok`)}, ${
      failed > 0 ? chalk.red(`${failed} failed`) : chalk.gray('0 failed')
    }, ${chalk.gray(`${skipped} skipped`)}\n`
  );
}
