// Cumulative cache hit/miss telemetry for the local cache root.
//
// Stored as a tiny JSON file at <cacheRoot>/telemetry.json so `cache stats` can
// report a hit-rate across runs. Writes are best-effort: a telemetry failure
// must never affect a build. The file lives alongside the sharded entries but is
// never counted as a cache entry (entries are `*/*/record.json`).

import * as path from 'path';
import * as fs from 'fs-extra';

/** The on-disk telemetry counters. */
export interface CacheTelemetry {
  hits: number;
  misses: number;
}

const TELEMETRY_FILE = 'telemetry.json';

/** Absolute path to the telemetry file for a cache root. */
function telemetryPath(root: string): string {
  return path.join(path.resolve(root), TELEMETRY_FILE);
}

/** Read the cumulative counters; returns zeros when absent or unreadable. */
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

/** Reset the counters (used by `cache clean`). Best-effort. */
export async function resetCacheTelemetry(root: string): Promise<void> {
  try {
    await fs.remove(telemetryPath(root));
  } catch {
    // ignore: clean already removed the root in the common case
  }
}

/**
 * Atomically add to the cumulative counters. Reads the current value, adds the
 * deltas, and writes the result. Concurrency within a single run is bounded by
 * the runner's pump, and cross-process races only mis-count telemetry (never
 * corrupt cache entries), so a simple read-modify-write is acceptable here.
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
