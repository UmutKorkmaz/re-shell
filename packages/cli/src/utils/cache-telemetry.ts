// Cumulative cache hit/miss telemetry for the local cache root.
//
// Stored as a tiny JSON file at <cacheRoot>/telemetry.json so `cache stats` can
// report a hit-rate across runs. Writes are best-effort: a telemetry failure
// must never affect a build. The file lives alongside the sharded entries but is
// never counted as a cache entry (entries are `*/*/record.json`).

import * as path from 'path';
import * as fs from 'fs-extra';

/**
 * The on-disk telemetry counters persisted between cache runs.
 *
 * Persisted as JSON at `<cacheRoot>/telemetry.json` so that `cache stats` can
 * report a cumulative hit-rate across invocations.
 */
export interface CacheTelemetry {
  /** Number of successful cache lookups (entry found and reused). */
  hits: number;
  /** Number of cache lookups that failed to find a usable entry. */
  misses: number;
}

const TELEMETRY_FILE = 'telemetry.json';

/** Absolute path to the telemetry file for a cache root. */
function telemetryPath(root: string): string {
  return path.join(path.resolve(root), TELEMETRY_FILE);
}

/**
 * Read the cumulative cache hit/miss counters from disk.
 *
 * Returns zeroed counters when the telemetry file is missing, malformed, or
 * unreadable for any reason, so callers can rely on always getting a valid
 * shape back.
 *
 * @param root Absolute (or resolvable) path to the cache root directory.
 * @returns Resolves with the persisted counters, or `{ hits: 0, misses: 0 }` if
 *   none could be read.
 */
export async function readCacheTelemetry(root: string): Promise<CacheTelemetry> {
  try {
    const raw = await fs.readJson(telemetryPath(root));
    const hits = Number(raw?.hits) || 0;
    const misses = Number(raw?.misses) || 0;
    return { hits: Math.max(0, hits), misses: Math.max(0, misses) };
  } catch {
    return { hits: 0, misses: 0 };
  }
}

/**
 * Reset the cumulative counters by removing the telemetry file.
 *
 * Invoked by `cache clean`. Best-effort: if the file or its parent directory
 * is already gone (the common case after `cache clean` clears the root), the
 * error is swallowed.
 *
 * @param root Absolute (or resolvable) path to the cache root directory.
 * @returns Resolves once the telemetry file has been removed (or was absent).
 */
export async function resetCacheTelemetry(root: string): Promise<void> {
  try {
    await fs.remove(telemetryPath(root));
  } catch {
    // ignore: clean already removed the root in the common case
  }
}

/**
 * Atomically add the supplied deltas to the cumulative hit/miss counters.
 *
 * Performs a read-modify-write against `<cacheRoot>/telemetry.json`. Concurrency
 * within a single run is bounded by the runner's pump, and cross-process races
 * only mis-count telemetry (never corrupt cache entries), so a simple
 * read-modify-write is acceptable here. Writes are best-effort: any I/O failure
 * is swallowed so telemetry can never break a build. A no-op when both deltas
 * are zero.
 *
 * @param root Absolute (or resolvable) path to the cache root directory.
 * @param delta Readonly partial counters (`hits`/`misses`) to add to the
 *   persisted totals. Both zero is a no-op.
 * @returns Resolves once the updated counters have been written (or the call
 *   was a no-op / swallowed an error).
 */
export async function recordCacheTelemetry(
  root: string,
  delta: Readonly<CacheTelemetry>
): Promise<void> {
  if (delta.hits === 0 && delta.misses === 0) return;
  try {
    const current = await readCacheTelemetry(root);
    const next: CacheTelemetry = {
      hits: current.hits + delta.hits,
      misses: current.misses + delta.misses,
    };
    await fs.ensureDir(path.resolve(root));
    await fs.writeJson(telemetryPath(root), next);
  } catch {
    // Telemetry is advisory; swallow write failures.
  }
}
