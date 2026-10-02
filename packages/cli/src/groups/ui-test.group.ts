import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { enableJsonMode } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import { runUiTest } from '../commands/ui-test';

/**
 * `re-shell ui test` — UI test aggregation scaffold (issue #22).
 * The pure aggregator accepts injected results, but this CLI entry point has
 * no Storybook runner and reports a not-run error instead of passing CI.
 */
export function registerUiTestGroup(program: Command): void {
  const ui = program.commands.find(command => command.name() === 'ui') ?? program
    .command('ui')
    .description('UI test aggregation scaffold (unavailable: no Storybook runner wired)');

  ui
    .command('test')
    .description(
      'UI-test scaffold (unavailable: no Storybook runner wired)'
    )
    .option('--json', 'Output the result as a JSON envelope')
    .option(
      '--gate <pillars>',
      'Comma-separated pillars that gate CI (default: a11y,visual)',
      'a11y,visual'
    )
    .action(
      createAsyncCommand(async options => {
        const json = Boolean(options.json);
        const restoreJson = json ? enableJsonMode() : () => {};
        const spinner = json ? null : createSpinner('Running UI tests…', undefined, { json });
        spinner?.start();
        try {
          await runUiTest({ json, gate: options.gate });
        } finally {
          spinner?.stop();
          restoreJson();
        }
      })
    );
}
