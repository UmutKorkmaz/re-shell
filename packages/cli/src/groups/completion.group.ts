import { Command, Option } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { installCompletion, printCompletion } from '../commands/completion';
import { COMPLETION_SHELLS } from '../utils/completion-engine';

/**
 * `completion`: install (or print) shell completion scripts.
 *
 * The scripts are generated from the live Commander tree of `program`, the same
 * traversal behind `commands list --json`, so completion always offers exactly
 * the commands and flags this build of the CLI has: top-level commands,
 * subcommands at every depth, and flags.
 *
 * @param program - The root Commander program (the tree completion is built from).
 */
export function registerCompletionGroup(program: Command): void {
  program
    .command('completion')
    .description('Install shell completion scripts (generated from the live command tree)')
    .addOption(
      new Option('--shell <shell>', 'Target shell')
        .choices([...COMPLETION_SHELLS])
        .default('bash')
    )
    .option('--print', 'Print the completion script to stdout instead of installing it')
    .action(
      createAsyncCommand(async options => {
        const succeeded = options.print
          ? printCompletion({ shell: options.shell, program })
          : await installCompletion({ shell: options.shell, program });
        if (!succeeded) {
          process.exitCode = 1;
        }
      })
    );
}
