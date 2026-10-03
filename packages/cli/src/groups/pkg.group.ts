import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { runPkg } from '../commands/pkg';
import { PKG_OPERATIONS, type PkgOperation } from '../pkg/types';

const DESCRIPTIONS: Record<PkgOperation, string> = {
  add: 'Add packages using the ecosystem native package manager',
  remove: 'Remove packages using the ecosystem native package manager',
  install: 'Install/restore all dependencies of the target',
  list: 'List declared dependencies parsed from the manifests (normalized)',
  outdated: 'Report outdated dependencies using the native outdated command (normalized)',
};

/**
 * Registers the `pkg` command group: a unified package-manager abstraction over
 * npm/pnpm/yarn/bun, pip/poetry/uv, cargo, maven/gradle, dotnet, composer,
 * bundler and go modules, with the ecosystem detected per target directory.
 *
 * @param program - The root Commander program to attach the `pkg` group to.
 */
export function registerPkgGroup(program: Command): void {
  const pkg = new Command('pkg').description(
    'Unified package manager: add/remove/install/list/outdated across npm, pip, cargo, maven, dotnet, composer, bundler, go'
  );

  for (const operation of PKG_OPERATIONS) {
    const takesPackages = operation === 'add' || operation === 'remove';
    const sub = pkg.command(operation).description(DESCRIPTIONS[operation]);
    if (takesPackages) sub.argument('<packages...>', 'Package specs, passed to the package manager as-is');
    sub
      .option('--service <name>', 'Target a workspace service directory')
      .option('--path <dir>', 'Target an explicit directory (default: current directory)')
      .option('--ecosystem <id>', 'Override ecosystem detection (e.g. pnpm, poetry, maven)')
      .option('--dry-run', 'Print the native command(s) without executing them')
      .option('--json', 'Emit a machine-readable JSON envelope');
    if (takesPackages) sub.option('--dev', 'Add/remove as a development dependency');
    sub.action(
      createAsyncCommand(async (...args: unknown[]) => {
        const options = (takesPackages ? args[1] : args[0]) as Record<string, unknown>;
        await runPkg({
          operation,
          packages: takesPackages ? (args[0] as string[]) : [],
          service: options.service as string | undefined,
          path: options.path as string | undefined,
          ecosystem: options.ecosystem as string | undefined,
          dev: Boolean(options.dev),
          dryRun: Boolean(options.dryRun),
          json: Boolean(options.json),
        });
      })
    );
  }

  program.addCommand(pkg);
}
