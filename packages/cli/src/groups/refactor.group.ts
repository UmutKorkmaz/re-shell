import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { runRenameService } from '../commands/refactor';

/**
 * Registers the `refactor` command group (cross-language, workspace-wide
 * refactors). Currently: `refactor rename-service <old> <new>`.
 *
 * @param program - The root Commander program to attach the `refactor` group to.
 */
export function registerRefactorGroup(program: Command): void {
  const refactor = new Command('refactor').description('Workspace-wide refactors across languages and config files');

  refactor
    .command('rename-service')
    .description(
      'Rename a service across the workspace config, compose files, k8s/helm manifests, package manifests, references in other services and its directory'
    )
    .argument('<old>', 'Current service name')
    .argument('<new>', 'New service name')
    .option('--dry-run', 'Show a unified diff of every change without writing anything')
    .option('--force', 'Proceed even when the git working tree has uncommitted changes')
    .option('--json', 'Emit a machine-readable JSON envelope')
    .action(
      createAsyncCommand(async (oldName: string, newName: string, options: { dryRun?: boolean; force?: boolean; json?: boolean }) => {
        await runRenameService({
          oldName,
          newName,
          dryRun: Boolean(options.dryRun),
          force: Boolean(options.force),
          json: Boolean(options.json),
        });
      })
    );

  program.addCommand(refactor);
}
