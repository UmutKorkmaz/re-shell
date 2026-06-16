import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { enableJsonMode } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import { runUiTest } from '../commands/ui-test';

/**
 * `re-shell ui test` — Storybook-9 UI test aggregation + a11y/visual gating
 * (issue #22). Runs all stories headless (interaction + a11y + visual), rolls
 * the results into a UI-maturity score (a scorecard-feedable dimension), and
 * gates CI on a11y/visual failures.
 */
export function registerUiTestGroup(program: Command): void {
  const ui = program
    .command('ui')
    .description('UI test aggregation + a11y/visual gating (Storybook 9)');

  ui
    .command('test')
    .description(
      'Run all stories headless; report interaction + a11y + visual results and a UI-maturity score'
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
