import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../../utils/error-handler';
import { createSpinner, flushOutput } from '../../utils/spinner';
import chalk from 'chalk';
import { manageBackups } from '../../commands/backup';

/**
 * Registers the `config backup` section.
 * Extracted verbatim from the former monolithic config.group.ts.
 */
export function registerBackupGroup(config: Command): void {
  // --- config backup ---
  const backupGroup = config.command('backup-mgr')
    .description('Backup and restore configurations with versioning and rollback capabilities');

  backupGroup
    .command('create')
    .description('Create a configuration backup')
    .option('--full', 'Create full backup (all configurations)')
    .option('--selective', 'Create selective backup (choose components)')
    .option('--name <name>', 'Backup name')
    .option('--description <desc>', 'Backup description')
    .option('--tags <tags>', 'Comma-separated tags')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Creating backup...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageBackups({ ...options, create: true, spinner });
        }, 60000);

        spinner.succeed(chalk.green('Backup created successfully!'));
      })
    );

  backupGroup
    .command('list')
    .description('List all available backups')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading backups...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageBackups({ ...options, list: true, spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green('Backups loaded!'));
        } else {
          spinner.stop();
        }
      })
    );

  backupGroup
    .command('restore <id>')
    .description('Restore configuration from backup')
    .option('--force', 'Skip confirmation prompt')
    .option('--dry-run', 'Preview restoration without making changes')
    .option('--no-pre-backup', 'Skip creating backup before restoration')
    .option('--merge-strategy <strategy>', 'Merge strategy (replace, merge, skip-existing)', 'replace')
    .action(
      createAsyncCommand(async (id, options) => {
        const spinner = createSpinner(`Restoring from backup: ${id}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageBackups({ ...options, restore: id, spinner });
        }, 120000);

        if (!options.dryRun) {
          spinner.succeed(chalk.green('Configuration restored successfully!'));
        } else {
          spinner.stop();
        }
      })
    );

  backupGroup
    .command('delete <id>')
    .description('Delete a backup')
    .option('--force', 'Skip confirmation prompt')
    .action(
      createAsyncCommand(async (id, options) => {
        const spinner = createSpinner(`Deleting backup: ${id}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageBackups({ ...options, delete: id, spinner });
        }, 15000);

        spinner.succeed(chalk.green('Backup deleted successfully!'));
      })
    );

  backupGroup
    .command('export <id>')
    .description('Export backup to file')
    .option('--output <file>', 'Output file path')
    .action(
      createAsyncCommand(async (id, options) => {
        if (!options.output) {
          console.log(chalk.red('Error: --output file path is required'));
          process.exit(1);
        }

        const spinner = createSpinner(`Exporting backup: ${id}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageBackups({ ...options, export: id, spinner });
        }, 30000);

        spinner.succeed(chalk.green('Backup exported successfully!'));
      })
    );

  backupGroup
    .command('import <file>')
    .description('Import backup from file')
    .action(
      createAsyncCommand(async (file, options) => {
        const spinner = createSpinner(`Importing backup from: ${file}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageBackups({ ...options, import: file, spinner });
        }, 30000);

        spinner.succeed(chalk.green('Backup imported successfully!'));
      })
    );

  backupGroup
    .command('cleanup')
    .description('Clean up old backups')
    .option('--keep-count <count>', 'Number of recent backups to keep', '10')
    .option('--keep-days <days>', 'Keep backups newer than N days', '30')
    .option('--dry-run', 'Preview cleanup without deleting')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Analyzing backups for cleanup...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageBackups({
            ...options,
            cleanup: true,
            keepCount: parseInt(options.keepCount),
            keepDays: parseInt(options.keepDays),
            spinner
          });
        }, 30000);

        if (!options.dryRun) {
          spinner.succeed(chalk.green('Backup cleanup completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  backupGroup
    .command('stats')
    .description('Show backup statistics')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Calculating backup statistics...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageBackups({ ...options, stats: true, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Statistics calculated!'));
        } else {
          spinner.stop();
        }
      })
    );

  backupGroup
    .command('interactive')
    .description('Interactive backup management')
    .action(
      createAsyncCommand(async (options) => {
        await manageBackups({ ...options, interactive: true });
      })
    );
}
