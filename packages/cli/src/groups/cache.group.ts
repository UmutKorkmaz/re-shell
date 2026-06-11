import { Command } from 'commander';
import chalk from 'chalk';
import { createAsyncCommand } from '../utils/error-handler';
import { enableJsonMode, ok, fail } from '../utils/json-output';
import type {
  CacheCleanResponse,
  CacheStatsResponse,
} from '@re-shell/contracts';
import { computeCacheStats, cleanCache } from '../utils/cache-store';
import { resolveCacheRoot } from '../utils/cache-config';
import {
  readCacheTelemetry,
  resetCacheTelemetry,
} from '../utils/cache-telemetry';

/**
 * `cache` group: inspect and prune the content-addressed build cache.
 *
 *   - `cache stats` — size, entry count, and (when recorded) the cumulative
 *      hit-rate across runs. Read-only; offline.
 *   - `cache clean` — prune the entire local cache and report what was reclaimed.
 *
 * Both honour `--cache-dir` (mirroring `re-shell run`) and `--json`.
 */
export function registerCacheGroup(program: Command): void {
  const cache = program
    .command('cache')
    .description('Inspect and prune the content-addressed build cache');

  cache
    .command('stats')
    .description('Show cache size, entry count, and hit-rate')
    .option('--json', 'Output the stats as a JSON envelope')
    .option('--cache-dir <dir>', 'Override the cache directory')
    .action(
      createAsyncCommand(async options => {
        const restoreJson = options.json ? enableJsonMode() : () => {};
        try {
          const root = resolveCacheRoot(process.cwd(), options.cacheDir);
          const stats = await computeCacheStats(root);
          const telemetry = await readCacheTelemetry(root);
          const total = telemetry.hits + telemetry.misses;
          const hitRate = total > 0 ? telemetry.hits / total : null;

          const payload: CacheStatsResponse = {
            location: stats.location,
            entries: stats.entries,
            sizeBytes: stats.sizeBytes,
            hits: telemetry.hits,
            misses: telemetry.misses,
            hitRate,
          };

          if (options.json) {
            ok(payload);
          } else {
            renderStats(payload);
          }
        } catch (error) {
          emitError(options.json, error);
        } finally {
          restoreJson();
        }
      })
    );

  cache
    .command('clean')
    .description('Prune the entire local build cache')
    .option('--json', 'Output the clean summary as a JSON envelope')
    .option('--cache-dir <dir>', 'Override the cache directory')
    .action(
      createAsyncCommand(async options => {
        const restoreJson = options.json ? enableJsonMode() : () => {};
        try {
          const root = resolveCacheRoot(process.cwd(), options.cacheDir);
          const result = await cleanCache(root);
          await resetCacheTelemetry(root);

          const payload: CacheCleanResponse = {
            location: result.location,
            removedEntries: result.removedEntries,
            reclaimedBytes: result.reclaimedBytes,
          };

          if (options.json) {
            ok(payload);
          } else {
            renderClean(payload);
          }
        } catch (error) {
          emitError(options.json, error);
        } finally {
          restoreJson();
        }
      })
    );
}

/** Human-readable byte size (binary units). */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

/** Render the stats payload for the terminal. */
function renderStats(stats: CacheStatsResponse): void {
  console.log(chalk.cyan.bold('\n▶ build cache stats\n'));
  console.log(`  ${chalk.bold('location')}  ${stats.location}`);
  console.log(`  ${chalk.bold('entries')}   ${stats.entries}`);
  console.log(`  ${chalk.bold('size')}      ${formatBytes(stats.sizeBytes)}`);
  const rate =
    stats.hitRate === null
      ? chalk.gray('n/a (no runs recorded)')
      : chalk.green(`${(stats.hitRate * 100).toFixed(1)}%`);
  console.log(
    `  ${chalk.bold('hit-rate')}  ${rate} ${chalk.gray(
      `(${stats.hits} hits / ${stats.misses} misses)`
    )}\n`
  );
}

/** Render the clean summary for the terminal. */
function renderClean(result: CacheCleanResponse): void {
  console.log(chalk.cyan.bold('\n▶ build cache clean\n'));
  console.log(
    `  removed ${chalk.bold(String(result.removedEntries))} entr${
      result.removedEntries === 1 ? 'y' : 'ies'
    }, reclaimed ${chalk.bold(formatBytes(result.reclaimedBytes))}\n`
  );
}

/** Emit an error consistently in JSON or human mode. */
function emitError(json: boolean, error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unknown error';
  if (json) {
    fail('CACHE_ERROR', message);
  } else {
    process.stderr.write(chalk.red(`\n✗ Cache error: ${message}\n`));
    process.exitCode = 1;
  }
}
