import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../../utils/error-handler';
import { createSpinner, flushOutput } from '../../utils/spinner';
import chalk from 'chalk';

import { manageConfigDiff } from '../../commands/config-diff';

/**
 * Registers the `config diff` section.
 * Extracted verbatim from the former monolithic config.group.ts.
 */
export function registerDiffGroup(config: Command): void {
  // --- config diff ---
  const diffGroup = config.command('diff')
    .description('Compare and merge configurations with advanced diffing capabilities');

  diffGroup
    .command('diff')
    .description('Compare two configurations and show differences')
    .option('--left <source>', 'Left configuration source (file, global, project, workspace:path)')
    .option('--right <source>', 'Right configuration source (file, global, project, workspace:path)')
    .option('--format <format>', 'Output format (text, html, json)', 'text')
    .option('--output <file>', 'Output file for diff report')
    .option('--ignore-order', 'Ignore array order in comparison')
    .option('--ignore-paths <paths>', 'Comma-separated paths to ignore')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        if (!options.left || !options.right) {
          console.log(chalk.red('Error: Both --left and --right sources are required'));
          process.exit(1);
        }

        const spinner = createSpinner('Comparing configurations...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageConfigDiff({ ...options, diff: true, spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green('Configuration comparison completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  diffGroup
    .command('merge')
    .description('Merge two configurations with conflict resolution')
    .option('--left <source>', 'Base configuration source')
    .option('--right <source>', 'Incoming configuration source')
    .option('--output <file>', 'Output file for merged configuration')
    .option('--strategy <strategy>', 'Merge strategy (left, right, smart, conservative, interactive)', 'smart')
    .option('--interactive', 'Interactive conflict resolution')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        if (!options.left || !options.right) {
          console.log(chalk.red('Error: Both --left and --right sources are required'));
          process.exit(1);
        }

        const spinner = createSpinner('Merging configurations...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageConfigDiff({ ...options, merge: true, spinner });
        }, 60000);

        spinner.succeed(chalk.green('Configuration merge completed!'));
      })
    );

  diffGroup
    .command('apply')
    .description('Apply a diff patch to a configuration')
    .option('--left <config>', 'Base configuration file')
    .option('--right <diff>', 'Diff file (JSON format)')
    .option('--output <file>', 'Output file for patched configuration')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        if (!options.left || !options.right) {
          console.log(chalk.red('Error: Both --left (config) and --right (diff) are required'));
          process.exit(1);
        }

        const spinner = createSpinner('Applying diff patch...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageConfigDiff({ ...options, apply: true, spinner });
        }, 30000);

        spinner.succeed(chalk.green('Diff patch applied successfully!'));
      })
    );

  diffGroup
    .command('status')
    .description('Show configuration status and inheritance analysis')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Analyzing configuration status...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageConfigDiff({ ...options, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Configuration analysis completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  diffGroup
    .command('interactive')
    .description('Interactive configuration diffing and merging')
    .action(
      createAsyncCommand(async (options) => {
        await manageConfigDiff({ ...options, interactive: true });
      })
    );
}
