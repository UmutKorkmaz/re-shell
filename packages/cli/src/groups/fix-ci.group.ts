import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { enableJsonMode, fail } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import { runFixCi } from '../commands/fix-ci';

/**
 * `re-shell fix --ci` — autonomous CI fixer with locked gates (issue #18, R-3).
 *
 * Detects (or loads from `.re-shell/fix-ci.yaml`) the workspace gates, runs
 * them as real child processes, and — when an AI provider is configured
 * (ANTHROPIC_API_KEY) — applies validated patches on a new
 * `re-shell/fix-ci-<timestamp>` branch until the gates are green or the
 * iteration budget is spent. Without a provider it is report-only: it lists the
 * failing gates and exits non-zero. Dry-run remains the default (no push, no
 * PR); the loop never merges or pushes to the base/default branch.
 */
export function registerFixCiGroup(program: Command): void {
  program
    .command('fix')
    .description(
      'Autonomous CI fixer: run the workspace gates and fix failures with validated AI patches on a new branch (use --ci)'
    )
    .option('--ci', 'Run the gated CI fix loop (report-only without ANTHROPIC_API_KEY)')
    .option('--json', 'Output the loop run log as a JSON envelope')
    .option('--no-dry-run', 'Push the fix branch and open a PR when gates are green (default: dry-run)')
    .option('--max-iterations <n>', 'Max loop iterations (backstop)', v => Number(v))
    .option('--allow-dirty', 'Start even if the git work tree has uncommitted changes')
    .option(
      '--skip-gate <name>',
      'Skip an unlocked gate (repeatable; locked gates and tests can never be skipped)',
      (value: string, previous?: string[]) => [...(previous ?? []), value]
    )
    .option('--model <id>', 'Model for the AI fix applier (default: claude-opus-5-5)')
    .action(
      createAsyncCommand(async options => {
        if (!options.ci) {
          const usage =
            'fix: pass --ci to run the autonomous gated fix loop. ' +
            'For a single doctor remediation plan, use `re-shell doctor --fix`.';
          if (options.json) {
            fail('USAGE_ERROR', usage);
            return;
          }
          process.stderr.write(`${usage}\n`);
          process.exitCode = 1;
          return;
        }
        const json = Boolean(options.json);
        const restoreJson = json ? enableJsonMode() : () => {};

        const spinner = json
          ? null
          : createSpinner('Running gated fix loop…', undefined, { json });
        spinner?.start();

        try {
          await runFixCi({
            json,
            noDryRun: !options.dryRun,
            maxIterations: options.maxIterations,
            allowDirty: options.allowDirty,
            skipGates: options.skipGate,
            model: options.model,
          });
        } finally {
          spinner?.stop();
          restoreJson();
        }
      })
    );
}
