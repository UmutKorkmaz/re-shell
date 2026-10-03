import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { enableJsonMode } from '../utils/json-output';
import { runUiTest } from '../commands/ui-test';

/**
 * `re-shell ui test` — run the workspace's Storybook through the Storybook test
 * runner (interaction + a11y + visual, both themes), aggregate into a UI-maturity
 * score and gate CI on a11y/visual failures (issue #22).
 *
 * The Storybook project is detected under the workspace (a `.storybook` directory in
 * the workspace or in `packages/*`, `apps/*`, ...). When none is found the command
 * fails with UI_TEST_ERROR rather than reporting a pass.
 */
export function registerUiTestGroup(program: Command): void {
  const ui = program.commands.find(command => command.name() === 'ui') ?? program
    .command('ui')
    .description('Launch the local Re-Shell UI dashboard');

  ui
    .command('test')
    .description(
      'Run Storybook interaction + a11y + visual tests (test-runner) and gate CI on the result'
    )
    .option('--json', 'Output the result as a JSON envelope')
    .option(
      '--gate <pillars>',
      'Comma-separated pillars that gate CI (default: a11y,visual)',
      'a11y,visual'
    )
    .option('--workspace <path>', 'Workspace to search for a Storybook', process.cwd())
    .option('--storybook <dir>', 'Storybook project directory (contains .storybook)')
    .option('--url <url>', 'Test an already running or hosted Storybook instead of building one')
    .option('--static-dir <dir>', 'Serve a prebuilt storybook-static directory instead of building')
    .option('--update-snapshots', 'Refresh the visual baselines instead of comparing')
    .option('--ci', 'Fail on a missing visual baseline instead of writing it')
    .option('--browser <path>', 'Chromium executable for Playwright (or PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)')
    .option('--timeout <ms>', 'Deadline for build + run in milliseconds', value => Number.parseInt(value, 10))
    .action(
      createAsyncCommand(async options => {
        const json = Boolean(options.json);
        const restoreJson = json ? enableJsonMode() : () => {};
        try {
          await runUiTest({
            json,
            gate: options.gate,
            workspace: options.workspace,
            storybook: options.storybook,
            url: options.url,
            staticDir: options.staticDir,
            updateSnapshots: Boolean(options.updateSnapshots),
            ci: Boolean(options.ci),
            browser: options.browser,
            timeoutMs: Number.isFinite(options.timeout) ? options.timeout : undefined,
          });
        } finally {
          restoreJson();
        }
      })
    );
}
