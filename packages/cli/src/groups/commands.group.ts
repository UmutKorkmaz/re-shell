import { Command } from 'commander';
import { createAsyncCommand, processManager } from '../utils/error-handler';
import { createSpinner, flushOutput } from '../utils/spinner';
import chalk from 'chalk';
import { enableJsonMode, ok, fail } from '../utils/json-output';
import { buildCommandCatalog, CommandCatalogEntry } from '../utils/command-catalog';

/**
 * `commands` group: introspect the CLI's own command tree. This powers the
 * Command Builder UI by exposing a machine-readable catalog of every runnable
 * command (paths, args, flags, and derived metadata) via `--json`.
 */
export function registerCommandsGroup(program: Command): void {
  const commandsCommand = new Command('commands')
    .description('Introspect available Re-Shell commands');

  commandsCommand
    .command('list')
    .description('List all available commands as a machine-readable catalog')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const restoreJson = options.json ? enableJsonMode() : () => {};
        const spinner = options.json ? undefined : createSpinner('Building command catalog...').start();
        if (spinner) {
          processManager.addCleanup(() => spinner.stop());
          flushOutput();
        }

        try {
          const catalog: CommandCatalogEntry[] = buildCommandCatalog(program);

          if (options.json) {
            ok(catalog);
            return;
          }

          if (spinner) spinner.stop();

          console.log(chalk.cyan.bold(`\n🧭 Commands (${catalog.length})\n`));
          for (const entry of catalog) {
            const badges: string[] = [];
            if (entry.supportsJson) badges.push(chalk.blue('json'));
            if (entry.supportsDryRun) badges.push(chalk.yellow('dry-run'));
            if (entry.destructive) badges.push(chalk.red('destructive'));
            const badgeStr = badges.length ? ` ${chalk.gray('[')}${badges.join(chalk.gray(', '))}${chalk.gray(']')}` : '';
            console.log(`  ${chalk.green('●')} ${chalk.bold(entry.path)}${badgeStr}`);
            if (entry.description) {
              console.log(`    ${chalk.gray(entry.description)}`);
            }
          }
          console.log();
        } catch (error) {
          if (spinner) spinner.stop();
          fail(
            'COMMANDS_LIST_ERROR',
            `Error listing commands: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        } finally {
          restoreJson();
        }
      })
    );

  program.addCommand(commandsCommand);
}
