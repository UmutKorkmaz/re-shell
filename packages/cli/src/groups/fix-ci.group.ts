import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { enableJsonMode } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import { runFixCi } from '../commands/fix-ci';

/**
 * `re-shell fix --ci` — CI fixer scaffold with locked gates (issue #18).
 *
 * The pure loop supports injected evaluators, but this CLI entry point has no
 * evaluator adapter and reports a not-run error. Dry-run remains the default;
 * the loop never merges or pushes to a protected branch.
 */
export function registerFixCiGroup(program: Command): void {
  program
    .command('fix')
    .description('CI fixer scaffold (unavailable: no gate evaluator wired; use --ci)')
    .option('--ci', 'Attempt CI verification (currently unavailable: no gate evaluator wired)')
    .option('--json', 'Output the loop run log as a JSON envelope')
    .option('--no-dry-run', 'Allow PR opening when adapters are available (default: dry-run)')
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
