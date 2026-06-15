import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { enableJsonMode } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import { runEnv } from '../commands/env';

/**
 * `re-shell env init|verify` — reproducible dev-environment generation
 * (Devbox + devcontainer) from detected toolchains (issue #21).
 */
export function registerEnvGroup(program: Command): void {
  const env = program
    .command('env')
    .description('Reproducible dev-environment generation (Devbox + devcontainer)');

  env
    .command('init')
    .description('Generate devbox.json + .devcontainer/devcontainer.json from detected toolchains')
    .option('--json', 'Output the result as a JSON envelope')
    .option('--no-dry-run', 'Write the config files (default: dry-run)')
    .action(
      createAsyncCommand(async options => {
        const json = Boolean(options.json);
        const restoreJson = json ? enableJsonMode() : () => {};
        const spinner = json ? null : createSpinner('Generating dev environment…', undefined, { json });
        spinner?.start();
        try {
          await runEnv({ json, mode: 'init', noDryRun: !options.dryRun });
        } finally {
          spinner?.stop();
          restoreJson();
        }
      })
    );

  env
    .command('verify')
    .description('Verify a generated devbox.json against the current toolchain detection (drift)')
    .option('--json', 'Output the result as a JSON envelope')
    .action(
      createAsyncCommand(async options => {
        const json = Boolean(options.json);
        const restoreJson = json ? enableJsonMode() : () => {};
        const spinner = json ? null : createSpinner('Verifying dev environment…', undefined, { json });
        spinner?.start();
        try {
          await runEnv({ json, mode: 'verify' });
        } finally {
          spinner?.stop();
          restoreJson();
        }
      })
    );
}
