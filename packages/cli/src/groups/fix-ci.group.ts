import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { enableJsonMode } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import { runFixCi } from '../commands/fix-ci';

/**
 * `re-shell fix --ci` — autonomous CI fixer with locked gates (issue #18).
 *
 * Runs a bounded, gate-locked loop that drives remediation to green and opens a
 * PR after gates pass. Dry-run is the default (nothing committed/pushed); a PR
 * is opened ONLY under --no-dry-run + a green gate outcome. The loop NEVER
 * merges or pushes to a protected branch — merge stays human-controlled.
 */
export function registerFixCiGroup(program: Command): void {
  program
    .command('fix')
    .description('Autonomous CI fixer: bounded gate-locked remediation loop (use --ci)')
    .option('--ci', 'Run the autonomous gated fix loop (required to start the loop)')
    .option('--json', 'Output the loop run log as a JSON envelope')
    .option('--no-dry-run', 'Open a PR after gates pass (default: dry-run, report only)')
    .option('--max-iterations <n>', 'Max loop iterations (backstop)', v => Number(v))
    .action(
      createAsyncCommand(async options => {
        if (!options.ci) {
          process.stderr.write(
            'fix: pass --ci to run the autonomous gated fix loop. ' +
              'For a single doctor remediation plan, use `re-shell doctor --fix`.\n'
          );
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
          });
        } finally {
          spinner?.stop();
          restoreJson();
        }
      })
    );
}
