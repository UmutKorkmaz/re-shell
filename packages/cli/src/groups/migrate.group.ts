import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { enableJsonMode} from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import { runMigrate } from '../commands/migrate';
import { LATEST_TARGET_VERSION } from '../utils/migrate-engine';

/**
 * `re-shell migrate [<to-version>]` — version-scoped migration/codemod.
 *
 * Selects recipes whose `fromVersionRange` matches the current workspace version
 * and whose `toVersion` is at or below the requested target, resolves their
 * concrete target files in dependency-graph (topological) order, and either lists
 * them for review (dry-run, the safe default) or applies them — rewriting each
 * outdated config/YAML scaffold to the new schema after writing a `.bak` backup.
 *
 * Source transforms (ast-grep) degrade to `skipped` when ast-grep is not installed.
 */
export function registerMigrateGroup(program: Command): void {
  program
    .command('migrate [to-version]')
    .description(
      'Version-scoped migrations/codemods (review-then-apply, dependency-graph-ordered)'
    )
    .option('--json', 'Output the migration plan as a JSON envelope')
    .option(
      '--no-dry-run',
      'Apply the migrations (default: dry-run, list only)'
    )
    .option(
      '--filter <names>',
      'Comma-separated package names to scope migrations to'
    )
    .action(
      createAsyncCommand(async (toVersion, options) => {
        const json = Boolean(options.json);
        const restoreJson = json ? enableJsonMode() : () => {};

        const spinner = json
          ? null
          : createSpinner('Planning migrations…', undefined, { json });
        spinner?.start();

        try {
          await runMigrate({
            json,
            toVersion: toVersion ?? LATEST_TARGET_VERSION,
            noDryRun: !options.dryRun,
            filter: options.filter,
          });
        } finally {
          spinner?.stop();
          restoreJson();
        }
      })
    );
}
