import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../../utils/error-handler';
import { createSpinner, flushOutput } from '../../utils/spinner';
import chalk from 'chalk';
import { validateConfiguration } from '../../commands/validate';

/**
 * Registers the `config validate` section.
 * Extracted verbatim from the former monolithic config.group.ts.
 */
export function registerValidateGroup(config: Command): void {
  // --- config validate ---
  const validateGroup = config.command('validate')
    .description('Validate configurations with detailed error messages');

  validateGroup
    .command('all')
    .description('Validate all configurations')
    .option('--warnings', 'Show warnings')
    .option('--suggestions', 'Show suggestions')
    .option('--fix', 'Auto-fix issues where possible')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Validating configurations...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await validateConfiguration({ ...options, spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green('Configuration validation completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  validateGroup
    .command('global')
    .description('Validate global configuration')
    .option('--warnings', 'Show warnings')
    .option('--suggestions', 'Show suggestions')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Validating global configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await validateConfiguration({ ...options, global: true, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Global configuration validated!'));
        } else {
          spinner.stop();
        }
      })
    );

  validateGroup
    .command('project')
    .description('Validate project configuration')
    .option('--warnings', 'Show warnings')
    .option('--suggestions', 'Show suggestions')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Validating project configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await validateConfiguration({ ...options, project: true, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Project configuration validated!'));
        } else {
          spinner.stop();
        }
      })
    );

  validateGroup
    .command('file <path>')
    .description('Validate specific configuration file')
    .option('--warnings', 'Show warnings')
    .option('--suggestions', 'Show suggestions')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (filePath, options) => {
        const spinner = createSpinner(`Validating ${filePath}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await validateConfiguration({ ...options, file: filePath, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green(`File validation completed: ${filePath}`));
        } else {
          spinner.stop();
        }
      })
    );

  validateGroup
    .command('interactive')
    .description('Interactive configuration validation')
    .action(
      createAsyncCommand(async () => {
        await validateConfiguration({ interactive: true });
      })
    );
}
