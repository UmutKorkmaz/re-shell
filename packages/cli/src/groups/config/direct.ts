import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../../utils/error-handler';
import { createSpinner, flushOutput } from '../../utils/spinner';
import chalk from 'chalk';
import { manageConfig } from '../../commands/config';

/**
 * Registers the `config <direct subcommands>` section.
 * Extracted verbatim from the former monolithic config.group.ts.
 */
export function registerDirectCommands(config: Command): void {
  // --- Direct config subcommands (show, get, set, preset, backup, restore, interactive) ---

  config
    .command('show')
    .description('Show current configuration')
    .option('--global', 'Show only global configuration')
    .option('--project', 'Show only project configuration')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageConfig({ ...options, list: true, spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green('Configuration loaded successfully!'));
        } else {
          spinner.stop();
        }
      })
    );

  config
    .command('get <key>')
    .description('Get configuration value')
    .option('--global', 'Get from global configuration')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (key, options) => {
        const spinner = createSpinner(`Getting ${key}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageConfig({ ...options, get: key, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Configuration value retrieved!'));
        } else {
          spinner.stop();
        }
      })
    );

  config
    .command('set <key> <value>')
    .description('Set configuration value')
    .option('--global', 'Set in global configuration')
    .option('--project', 'Set in project configuration')
    .action(
      createAsyncCommand(async (key, value, options) => {
        const spinner = createSpinner(`Setting ${key}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageConfig({ ...options, set: key, value, spinner });
        }, 15000);

        spinner.succeed(chalk.green(`Configuration updated: ${key}`));
      })
    );

  config
    .command('preset <action> [name]')
    .description('Manage configuration presets (save|load|list|delete)')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (action, name, options) => {
        const spinner = createSpinner(`Managing preset...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        let presetOptions: Parameters<typeof manageConfig>[0] = { ...options, spinner };

        switch (action) {
          case 'save':
            if (!name) throw new Error('Preset name required for save action');
            presetOptions = { ...presetOptions, save: name };
            break;
          case 'load':
            if (!name) throw new Error('Preset name required for load action');
            presetOptions = { ...presetOptions, load: name };
            break;
          case 'list':
            presetOptions = { ...presetOptions, list: true };
            break;
          case 'delete':
            if (!name) throw new Error('Preset name required for delete action');
            presetOptions = { ...presetOptions, delete: name };
            break;
          default:
            throw new Error(`Unknown action: ${action}`);
        }

        await withTimeout(async () => {
          await manageConfig(presetOptions);
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green(`Preset ${action} completed successfully!`));
        } else {
          spinner.stop();
        }
      })
    );

  config
    .command('backup')
    .description('Create configuration backup')
    .action(
      createAsyncCommand(async () => {
        const spinner = createSpinner('Creating backup...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageConfig({ backup: true, spinner });
        }, 30000);

        spinner.succeed(chalk.green('Configuration backup created!'));
      })
    );

  config
    .command('restore <backup>')
    .description('Restore configuration from backup')
    .action(
      createAsyncCommand(async (backup) => {
        const spinner = createSpinner('Restoring configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageConfig({ restore: backup, spinner });
        }, 30000);

        spinner.succeed(chalk.green('Configuration restored!'));
      })
    );

  config
    .command('interactive')
    .description('Interactive configuration management')
    .action(
      createAsyncCommand(async () => {
        await manageConfig({ interactive: true });
      })
    );
}
