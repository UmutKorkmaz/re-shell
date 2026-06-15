import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { enableJsonMode } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import { runApiVerify } from '../commands/api-verify';

/**
 * `re-shell api verify` — API contract testing + cross-service spec-drift
 * detection (issue #16). Diffs an OpenAPI-ish spec against a baseline for
 * backward-incompatible changes, computes the cross-service blast radius from
 * the workspace graph, and exits non-zero on backward-incompatible changes.
 */
export function registerApiVerifyGroup(program: Command): void {
  const api = program
    .command('api')
    .description('API contract testing + cross-service spec-drift detection');

  api
    .command('verify')
    .description(
      'Verify an API spec against a baseline; report backward-incompatible changes + impacted consumers'
    )
    .option('--json', 'Output the verify result as a JSON envelope')
    .option('--api <name>', 'The producer API/service name to verify')
    .option('--baseline <dir>', 'Directory of baseline (previous) specs to diff against')
    .option('--spec <path>', 'Explicit current spec path (overrides discovery)')
    .option('--baseline-spec <path>', 'Explicit baseline spec path')
    .action(
      createAsyncCommand(async options => {
        const json = Boolean(options.json);
        const restoreJson = json ? enableJsonMode() : () => {};

        const spinner = json
          ? null
          : createSpinner('Verifying API contract…', undefined, { json });
        spinner?.start();

        try {
          await runApiVerify({
            json,
            api: options.api,
            baseline: options.baseline,
            spec: options.spec,
            baselineSpec: options.baselineSpec,
          });
        } finally {
          spinner?.stop();
          restoreJson();
        }
      })
    );
}
