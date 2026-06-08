import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../../utils/error-handler';
import { createSpinner, flushOutput } from '../../utils/spinner';
import chalk from 'chalk';
import { manageWorkspaceConfig } from '../../commands/workspace-config';

/**
 * Registers the `config workspace` section.
 * Extracted verbatim from the former monolithic config.group.ts.
 */
export function registerWorkspaceGroup(config: Command): void {
  // --- config workspace ---
  const workspaceGroup = config.command('workspace')
    .description('Manage workspace-specific configuration with cascading inheritance');

  workspaceGroup
    .command('init')
    .description('Initialize workspace configuration')
    .option('--workspace <path>', 'Workspace path', process.cwd())
    .option('--type <type>', 'Workspace type (app, package, lib, tool)', 'app')
    .option('--framework <framework>', 'Framework override')
    .option('--package-manager <pm>', 'Package manager override')
    .option('--interactive', 'Interactive initialization')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Initializing workspace configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceConfig({ ...options, init: true, spinner });
        }, 30000);

        spinner.succeed(chalk.green('Workspace configuration initialized!'));
      })
    );

  workspaceGroup
    .command('show')
    .description('Show workspace configuration with inheritance chain')
    .option('--workspace <path>', 'Workspace path', process.cwd())
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show final merged configuration')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading workspace configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceConfig({ ...options, show: true, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Workspace configuration loaded!'));
        } else {
          spinner.stop();
        }
      })
    );

  workspaceGroup
    .command('get <key>')
    .description('Get workspace configuration value with inheritance info')
    .option('--workspace <path>', 'Workspace path', process.cwd())
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (key, options) => {
        const spinner = createSpinner(`Getting configuration value: ${key}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceConfig({ ...options, get: key, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green(`Configuration value retrieved: ${key}`));
        } else {
          spinner.stop();
        }
      })
    );

  workspaceGroup
    .command('set <key> <value>')
    .description('Set workspace configuration value')
    .option('--workspace <path>', 'Workspace path', process.cwd())
    .action(
      createAsyncCommand(async (key, value, options) => {
        const spinner = createSpinner(`Setting configuration: ${key} = ${value}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceConfig({ ...options, set: key, value, spinner });
        }, 15000);

        spinner.succeed(chalk.green(`Configuration updated: ${key}`));
      })
    );

  workspaceGroup
    .command('interactive')
    .description('Interactive workspace configuration management')
    .option('--workspace <path>', 'Workspace path', process.cwd())
    .action(
      createAsyncCommand(async (options) => {
        await manageWorkspaceConfig({ ...options, interactive: true });
      })
    );
}
