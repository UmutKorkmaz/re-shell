import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../../utils/error-handler';
import { createSpinner, flushOutput } from '../../utils/spinner';
import chalk from 'chalk';
import { manageProjectConfig } from '../../commands/project-config';

/**
 * Registers the `config project` section.
 * Extracted verbatim from the former monolithic config.group.ts.
 */
export function registerProjectGroup(config: Command): void {
  // --- config project ---
  const projectGroup = config.command('project')
    .description('Manage project-level configuration with inheritance');

  projectGroup
    .command('init')
    .description('Initialize project configuration')
    .option('--framework <framework>', 'Default framework')
    .option('--package-manager <pm>', 'Package manager (npm, yarn, pnpm, bun)')
    .option('--interactive', 'Interactive initialization')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Initializing project configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageProjectConfig({ ...options, init: true, spinner });
        }, 30000);

        spinner.succeed(chalk.green('Project configuration initialized!'));
      })
    );

  projectGroup
    .command('show')
    .description('Show project configuration with inheritance')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show merged configuration')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading project configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageProjectConfig({ ...options, show: true, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Project configuration loaded!'));
        } else {
          spinner.stop();
        }
      })
    );

  projectGroup
    .command('get <key>')
    .description('Get project configuration value')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (key, options) => {
        const spinner = createSpinner(`Getting ${key}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageProjectConfig({ ...options, get: key, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Configuration value retrieved!'));
        } else {
          spinner.stop();
        }
      })
    );

  projectGroup
    .command('set <key> <value>')
    .description('Set project configuration value')
    .action(
      createAsyncCommand(async (key, value, options) => {
        const spinner = createSpinner(`Setting ${key}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageProjectConfig({ ...options, set: key, value, spinner });
        }, 15000);

        spinner.succeed(chalk.green(`Configuration updated: ${key}`));
      })
    );

  projectGroup
    .command('interactive')
    .description('Interactive project configuration management')
    .action(
      createAsyncCommand(async () => {
        await manageProjectConfig({ interactive: true });
      })
    );
}
