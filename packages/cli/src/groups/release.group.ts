import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { enableJsonMode, fail } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import { runRelease } from '../commands/release';
import type { BumpLevel } from '../utils/release-engine';

/** Valid `--bump` levels (validated before any side effects). */
const BUMP_LEVELS: readonly BumpLevel[] = ['major', 'minor', 'patch'];

/**
 * `re-shell release` — graph-aware semver bump propagation across internal
 * dependencies, with changelog + annotated git-tag generation and per-registry
 * publish adapters.
 *
 * Safe by default: `--dry-run` is TRUE unless `--no-dry-run` is passed (commander
 * sets `options.dryRun` to false for `--no-dry-run`). Applying writes bumped
 * manifests + CHANGELOG fragments and creates tags; registry publish runs only
 * when BOTH `--no-dry-run` AND `--publish` are given.
 */
export function registerReleaseGroup(program: Command): void {
  program
    .command('release')
    .description(
      'Graph-aware semver bump propagation + changelog + tags (+ optional publish)'
    )
    .option('--json', 'Output the release plan as a JSON envelope')
    .option('--no-dry-run', 'Apply the plan: write versions, changelog, and tags')
    .option('--publish', 'Publish to registries (only with --no-dry-run)')
    .option('--bump <level>', 'Global bump for changed units (major|minor|patch)')
    .option('--since <ref>', 'Base git ref for change detection (default: last tag)')
    .option('--filter <names...>', 'Limit the release to these packages + dependents')
    .option('--registry <name>', 'Override the detected registry for every unit')
    .action(
      createAsyncCommand(async options => {
        const json = Boolean(options.json);
        const restoreJson = json ? enableJsonMode() : () => {};

        // Validate --bump up front so an invalid level never reaches side effects.
        if (
          options.bump !== undefined &&
          !BUMP_LEVELS.includes(options.bump as BumpLevel)
        ) {
          const reason = `Invalid --bump "${options.bump}": expected one of ${BUMP_LEVELS.join(', ')}`;
          if (json) {
            fail('RELEASE_ERROR', reason);
          } else {
            process.stderr.write(`${reason}\n`);
            process.exitCode = 1;
          }
          restoreJson();
          return;
        }

        const spinner = json
          ? null
          : createSpinner('Planning release…', undefined, { json });
        spinner?.start();

        try {
          await runRelease({
            json,
            // commander: --no-dry-run sets options.dryRun=false; default true.
            dryRun: options.dryRun,
            publish: Boolean(options.publish),
            bump: options.bump as BumpLevel | undefined,
            since: options.since,
            filter: options.filter,
            registry: options.registry,
          });
        } finally {
          spinner?.stop();
          restoreJson();
        }
      })
    );
}
