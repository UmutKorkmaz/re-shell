import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../../utils/error-handler';
import { createSpinner, flushOutput } from '../../utils/spinner';
import chalk from 'chalk';
import { manageEnvironment } from '../../commands/environment';

/**
 * Registers the `config env` section.
 * Extracted verbatim from the former monolithic config.group.ts.
 */
export function registerEnvGroup(config: Command): void {
  // --- config env ---
  const envGroup = config.command('env')
    .description('Manage environment configurations');

  envGroup
    .command('list')
    .description('List all environments')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading environments...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageEnvironment({ ...options, list: true, spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green('Environments loaded successfully!'));
        } else {
          spinner.stop();
        }
      })
    );

  envGroup
    .command('active')
    .description('Show active environment')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Getting active environment...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageEnvironment({ ...options, active: true, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Active environment retrieved!'));
        } else {
          spinner.stop();
        }
      })
    );

  envGroup
    .command('set <name>')
    .description('Set active environment')
    .action(
      createAsyncCommand(async (name) => {
        const spinner = createSpinner(`Setting active environment to ${name}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageEnvironment({ set: name, spinner });
        }, 15000);

        spinner.succeed(chalk.green(`Environment '${name}' activated!`));
      })
    );

  envGroup
    .command('create <name>')
    .description('Create new environment')
    .option('--extends <env>', 'Inherit from existing environment')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Creating environment ${name}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageEnvironment({ ...options, create: name, spinner });
        }, 30000);

        spinner.succeed(chalk.green(`Environment '${name}' created!`));
      })
    );

  envGroup
    .command('delete <name>')
    .description('Delete environment')
    .action(
      createAsyncCommand(async (name) => {
        const spinner = createSpinner(`Deleting environment ${name}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageEnvironment({ delete: name, spinner });
        }, 15000);

        spinner.succeed(chalk.green(`Environment '${name}' deleted!`));
      })
    );

  envGroup
    .command('compare <env1> <env2>')
    .description('Compare two environments')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (env1, env2, options) => {
        const spinner = createSpinner(`Comparing ${env1} and ${env2}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageEnvironment({ ...options, compare: [env1, env2], spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green('Environment comparison completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  envGroup
    .command('generate <name>')
    .description('Generate .env file for environment')
    .option('--output <file>', 'Output file path')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Generating .env file for ${name}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageEnvironment({ ...options, generate: name, spinner });
        }, 15000);

        spinner.succeed(chalk.green(`Environment file generated for '${name}'!`));
      })
    );

  envGroup
    .command('interactive')
    .description('Interactive environment management')
    .action(
      createAsyncCommand(async () => {
        await manageEnvironment({ interactive: true });
      })
    );
}
