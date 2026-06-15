import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { enableJsonMode } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import { runBoundaries } from '../commands/boundaries';

/**
 * `re-shell boundaries` — module-boundary / dependency-constraint enforcement
 * (issue #20). Tags packages, evaluates declarative import rules, flags
 * disallowed cross-package imports + undeclared deps, and exits non-zero on any
 * violation.
 */
export function registerBoundariesGroup(program: Command): void {
  program
    .command('boundaries')
    .description(
      'Module-boundary enforcement: tag-based import rules + undeclared-dep detection (CI-gatable)'
    )
    .option('--json', 'Output the report as a JSON envelope')
    .option('--rules <path>', 'Path to a JSON ruleset (overrides the default rules)')
    .action(
      createAsyncCommand(async options => {
        const json = Boolean(options.json);
        const restoreJson = json ? enableJsonMode() : () => {};

        const spinner = json
          ? null
          : createSpinner('Evaluating module boundaries…', undefined, { json });
        spinner?.start();

        try {
          await runBoundaries({ json, rules: options.rules });
        } finally {
          spinner?.stop();
          restoreJson();
        }
      })
    );
}
