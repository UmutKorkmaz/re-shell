/**
 * Template for creating a new command group.
 * Copy this file to <name>.group.ts and rename accordingly.
 *
 * Each group file exports a single registerXxxGroup(program) function
 * that registers a Commander.js nested subcommand tree.
 *
 * Pattern:
 *   - Create a top-level Command (the group)
 *   - Add subcommands via group.command(...)
 *   - Call program.addCommand(group)
 *
 * The action handlers should delegate to existing src/commands/* or
 * src/utils/* modules — do NOT duplicate handler logic here.
 */

import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../utils/error-handler';
import { createSpinner, flushOutput } from '../utils/spinner';
import { processManager } from '../utils/error-handler';
import chalk from 'chalk';

export function registerTemplateGroup(program: Command): void {
  const group = new Command('template-group')
    .description('Short one-line group description');

  group
    .command('sub-action')
    .description('What this subcommand does')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await withTimeout(async () => {
          // Replace with: const { someHandler } = await import('../commands/some-command');
          // await someHandler(options);
          void options;
        }, 30000);
      })
    );

  program.addCommand(group);
}
