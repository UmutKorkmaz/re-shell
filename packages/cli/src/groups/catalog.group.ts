import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { enableJsonMode } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import { runCatalog } from '../commands/catalog';

/**
 * `re-shell catalog` / `re-shell catalog sync` — software-catalog
 * auto-discovery (issue #11).
 *
 * `catalog` discovers every service / microfrontend / API / package from the
 * real workspace graph and emits the typed catalog model (native + Backstage
 * descriptor). `catalog sync` writes Backstage `catalog-info.yaml` files to
 * disk (under `catalog/`) and is idempotent — re-running after a graph change
 * updates entities with no manual edits.
 */
export function registerCatalogGroup(program: Command): void {
  const catalog = program
    .command('catalog')
    .description(
      'Auto-discover the software catalog from the workspace graph (native + Backstage interop)'
    )
    .option('--json', 'Output the catalog as a JSON envelope')
    .action(
      createAsyncCommand(async options => {
        const json = Boolean(options.json);
        const restoreJson = json ? enableJsonMode() : () => {};

        const spinner = json
          ? null
          : createSpinner('Building catalog…', undefined, { json });
        spinner?.start();

        try {
          await runCatalog({ json });
        } finally {
          spinner?.stop();
          restoreJson();
        }
      })
    );

  catalog
    .command('sync')
    .description('Write Backstage catalog-info.yaml files from the discovered graph')
    .option('--json', 'Output the sync result as a JSON envelope')
    .option('--no-dry-run', 'Write the catalog-info.yaml files (default: dry-run)')
    .action(
      createAsyncCommand(async options => {
        const json = Boolean(options.json);
        const restoreJson = json ? enableJsonMode() : () => {};

        const spinner = json
          ? null
          : createSpinner('Syncing catalog…', undefined, { json });
        spinner?.start();

        try {
          await runCatalog({
            json,
            sync: true,
            noDryRun: !options.dryRun,
          });
        } finally {
          spinner?.stop();
          restoreJson();
        }
      })
    );
}
