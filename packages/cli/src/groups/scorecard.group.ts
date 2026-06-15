import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { enableJsonMode, fail } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import { runScorecard } from '../commands/scorecard';

/** Default rollup gate threshold (0-100). */
const DEFAULT_THRESHOLD = '70';

/**
 * `re-shell scorecard` — a weighted production-readiness score over existing
 * health/policy/drift signals plus per-service build/test/health-endpoint
 * presence. Emits per-service grades and a monorepo rollup.
 *
 * The rollup is gated against `--threshold` (default 70): a below-threshold
 * score still emits the full grades but exits non-zero so CI can enforce a
 * readiness bar. Producing the score is pure/offline — no cluster, no network.
 */
export function registerScorecardGroup(program: Command): void {
  program
    .command('scorecard')
    .description(
      'Weighted production-readiness score (per-service grades + monorepo rollup)'
    )
    .option('--json', 'Output the scorecard as a JSON envelope')
    .option(
      '--threshold <n>',
      'Rollup score below which the command exits non-zero (0-100)',
      DEFAULT_THRESHOLD
    )
    .option('--service <name>', 'Limit the report to a single service')
    .option('--pack <ref>', 'Policy pack to evaluate against', 'recommended')
    .action(
      createAsyncCommand(async options => {
        const json = Boolean(options.json);
        const restoreJson = json ? enableJsonMode() : () => {};

        const threshold = Number(options.threshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          const reason = `Invalid --threshold "${options.threshold}": expected a number between 0 and 100`;
          if (json) {
            fail('SCORECARD_ERROR', reason);
          } else {
            process.stderr.write(`${reason}\n`);
            process.exitCode = 1;
          }
          restoreJson();
          return;
        }

        const spinner = json
          ? null
          : createSpinner('Scoring workspace…', undefined, { json });
        spinner?.start();

        try {
          await runScorecard({
            json,
            threshold,
            service: options.service,
            pack: options.pack,
          });
        } finally {
          spinner?.stop();
          restoreJson();
        }
      })
    );
}
