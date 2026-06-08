import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../../utils/error-handler';
import { createSpinner, flushOutput } from '../../utils/spinner';
import chalk from 'chalk';
import { manageMigration } from '../../commands/migration';

/**
 * Registers the `config migrate` section.
 * Extracted verbatim from the former monolithic config.group.ts.
 */
export function registerMigrateGroup(config: Command): void {
  // --- config migrate ---
  const migrateGroup = config.command('migrate')
    .description('Manage configuration migrations');

  migrateGroup
    .command('auto')
    .description('Auto-migrate all configurations')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Running auto-migration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageMigration({ ...options, auto: true, spinner });
        }, 60000);

        if (!options.json) {
          spinner.succeed(chalk.green('Auto-migration completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  migrateGroup
    .command('check')
    .description('Check migration status')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Checking migration status...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageMigration({ ...options, check: true, spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green('Migration status checked!'));
        } else {
          spinner.stop();
        }
      })
    );

  migrateGroup
    .command('global')
    .description('Migrate global configuration')
    .option('--json', 'Output as JSON')
    .option('--force', 'Force migration without confirmation')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Migrating global configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageMigration({ ...options, global: true, spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green('Global configuration migrated!'));
        } else {
          spinner.stop();
        }
      })
    );

  migrateGroup
    .command('project')
    .description('Migrate project configuration')
    .option('--json', 'Output as JSON')
    .option('--force', 'Force migration without confirmation')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Migrating project configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageMigration({ ...options, project: true, spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green('Project configuration migrated!'));
        } else {
          spinner.stop();
        }
      })
    );

  migrateGroup
    .command('rollback <version>')
    .description('Rollback to previous version')
    .option('--global', 'Rollback global configuration')
    .option('--project', 'Rollback project configuration')
    .option('--json', 'Output as JSON')
    .option('--force', 'Force rollback without confirmation')
    .action(
      createAsyncCommand(async (version, options) => {
        const configType = options.global ? 'global' : 'project';
        const spinner = createSpinner(`Rolling back ${configType} to ${version}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageMigration({ ...options, rollback: version, spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green(`Rollback to ${version} completed!`));
        } else {
          spinner.stop();
        }
      })
    );

  migrateGroup
    .command('history')
    .description('Show migration history')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading migration history...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageMigration({ ...options, history: true, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Migration history loaded!'));
        } else {
          spinner.stop();
        }
      })
    );

  migrateGroup
    .command('interactive')
    .description('Interactive migration management')
    .action(
      createAsyncCommand(async () => {
        await manageMigration({ interactive: true });
      })
    );
}
