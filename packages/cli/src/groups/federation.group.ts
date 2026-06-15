import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { enableJsonMode } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import { runFederationCheck } from '../commands/federation';

/**
 * `re-shell federation check` — continuous Module-Federation contract & type
 * enforcement (issue #15). Parses MF manifests, diffs against a baseline for
 * breaking export/type changes, detects shared-dep version skew across remotes,
 * and exits non-zero on incompatibility so CI can gate on it.
 */
export function registerFederationGroup(program: Command): void {
  const federation = program
    .command('federation')
    .description(
      'Module-Federation contract & type enforcement (breaking-change + shared-dep skew)'
    );

  federation
    .command('check')
    .description(
      'Parse MF manifests, diff against a baseline, detect shared-dep skew; exit non-zero on incompatibility'
    )
    .option('--json', 'Output the check result as a JSON envelope')
    .option(
      '--baseline <dir>',
      'Directory of baseline (previous) manifests to diff against for breaking changes'
    )
    .option(
      '--manifest <paths>',
      'Comma-separated explicit manifest paths (overrides auto-discovery)'
    )
    .action(
      createAsyncCommand(async options => {
        const json = Boolean(options.json);
        const restoreJson = json ? enableJsonMode() : () => {};

        const manifests = options.manifest
          ? String(options.manifest).split(',').map(m => m.trim()).filter(Boolean)
          : undefined;

        const spinner = json
          ? null
          : createSpinner('Checking federation contracts…', undefined, { json });
        spinner?.start();

        try {
          await runFederationCheck({
            json,
            baseline: options.baseline,
            manifests,
          });
        } finally {
          spinner?.stop();
          restoreJson();
        }
      })
    );
}
