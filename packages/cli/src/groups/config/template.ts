import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../../utils/error-handler';
import { createSpinner, flushOutput } from '../../utils/spinner';
import { enableJsonMode } from '../../utils/json-output';
import chalk from 'chalk';
import { manageWorkspaceTemplates } from '../../commands/workspace';

/**
 * Registers the `config template` section.
 * Extracted verbatim from the former monolithic config.group.ts.
 */
export function registerTemplateGroup(config: Command): void {
  // --- config template ---
  const templateGroup = config.command('template')
    .description('Manage configuration templates with variable substitution');

  templateGroup
    .command('list')
    .description('List available configuration templates')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const restoreJson = options.json ? enableJsonMode() : () => {};
        
        const spinner = options.json ? undefined : createSpinner('Loading templates...').start();
        if (spinner) {
          processManager.addCleanup(() => spinner.stop());
          flushOutput();
        }

        await withTimeout(async () => {
          await manageWorkspaceTemplates({ action: 'list', spinner, ...options });
        }, 15000);

        if (spinner) {
          spinner.succeed(chalk.green('Templates loaded!'));
        }
        restoreJson();
      })
    );

  templateGroup
    .command('create')
    .description('Create a new configuration template')
    .option('--interactive', 'Interactive template creation')
    .action(
      createAsyncCommand(async (options) => {
        await manageWorkspaceTemplates({ action: 'create', ...options });
      })
    );

  templateGroup
    .command('show <name>')
    .description('Show template details and variables')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show template structure')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Loading template: ${name}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplates({ action: 'show', templateId: name, spinner, ...options });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green(`Template '${name}' loaded!`));
        } else {
          spinner.stop();
        }
      })
    );

  templateGroup
    .command('apply <name>')
    .description('Apply template to generate configuration')
    .option('--variables <json>', 'Variables as JSON string')
    .option('--output <file>', 'Output file path')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Applying template: ${name}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplates({ action: 'export', templateId: name, output: options.output, spinner, ...options });
        }, 30000);

        spinner.succeed(chalk.green(`Template '${name}' applied successfully!`));
      })
    );

  templateGroup
    .command('delete <name>')
    .description('Delete a configuration template')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Deleting template: ${name}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplates({ action: 'delete', templateId: name, spinner, ...options });
        }, 15000);

        spinner.succeed(chalk.green(`Template '${name}' deleted!`));
      })
    );

  templateGroup
    .command('interactive')
    .description('Interactive template management')
    .action(
      createAsyncCommand(async (options) => {
        await manageWorkspaceTemplates({ action: 'create', ...options });
      })
    );
}
