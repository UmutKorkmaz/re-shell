import * as fs from 'fs-extra';
import * as path from 'path';
import type { PluginQuality } from '@re-shell/contracts';
import {
  DEFAULT_REGISTRY_URL,
  RegistryClient,
  type FetchLike,
  type FetchResponse,
} from './registry-client';
import { isValidPackageName } from './plugin-installer';

/**
 * Real, registry-derived quality data for published plugins.
 *
 * Source order:
 *  1. npms.io (`GET https://api.npms.io/v2/package/<name>`): `score.final` and
 *     `score.detail.{quality,popularity,maintenance}`, all 0-1. The 0-5 rating
 *     is `final * 5`.
 *  2. If npms.io is unreachable or has no analysis, a derived score computed
 *     from npm download counts
 *     (`GET https://api.npmjs.org/downloads/point/last-month/<name>`) and the
 *     package's registry metadata. The result is flagged `derived: true` and
 *     carries the raw `signals`, so nothing about it is opaque:
 *       popularity  = log10(downloadsLastMonth + 1) / 6, capped at 1 (1M/month = 1)
 *       maintenance = 1 - ageOfLastPublishInDays / 730, floored at 0
 *       quality     = share of five hygiene signals present: description, license,
 *                     repository, README, latest version not deprecated
 *       score       = 0.35*quality + 0.30*popularity + 0.35*maintenance, renormalized
 *                     over the components that could be computed
 *  3. If nothing can be fetched, `source: "unavailable"` with null numbers and
 *     the error - never a made-up value.
 *
 * Results are cached on disk (default 24h) so repeated `plugin info` calls do
 * not hit the network; a failed refresh falls back to the stale entry (flagged
 * `stale`). All HTTP goes through an injectable fetch so tests never touch the
 * network.
 */

/** npms.io API origin. */
export const DEFAULT_NPMS_URL = 'https://api.npms.io';
/** npm downloads API origin. */
export const DEFAULT_DOWNLOADS_URL = 'https://api.npmjs.org';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Options for {@link fetchPluginQuality}. */
export interface PluginQualityOptions {
  /** Injected fetch (tests); defaults to the global fetch. */
  fetchImpl?: FetchLike;
  /** Absolute path of the JSON cache file; omit to disable the on-disk cache. */
  cacheFile?: string;
  /** Cache time-to-live in ms (default 24h). */
  ttlMs?: number;
  /** Ignore a fresh cache entry and refetch. */
  refresh?: boolean;
  /** Never hit the network: serve cache (flagged stale if expired) or report unavailable. */
  offline?: boolean;
  /** Per-request timeout in ms (default 8000). */
  timeoutMs?: number;
  npmsUrl?: string;
  downloadsUrl?: string;
  /** npm registry origin for the metadata used by the derived score. */
  registryUrl?: string;
  /** Clock override for tests. */
  now?: () => number;
}

/** Cache file shape. */
interface QualityCacheFile {
  version: 1;
  entries: Record<string, { fetchedAt: string; quality: PluginQuality }>;
}

/** Default cache location inside a workspace. */
export function qualityCachePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.re-shell', 'cache', 'plugin-quality.json');
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round(value: number, places: number): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

function unavailable(error: string, nowIso: string): PluginQuality {
  return {
    source: 'unavailable',
    rating: null,
    score: null,
    quality: null,
    popularity: null,
    maintenance: null,
    downloadsLastMonth: null,
    fetchedAt: nowIso,
    cached: false,
    stale: false,
    derived: false,
    error,
  };
}

async function readCache(file: string | undefined): Promise<QualityCacheFile> {
  const empty: QualityCacheFile = { version: 1, entries: {} };
  if (!file) return empty;
  try {
    const raw: unknown = await fs.readJSON(file);
    if (raw && typeof raw === 'object' && (raw as QualityCacheFile).entries) {
      return { version: 1, entries: (raw as QualityCacheFile).entries };
    }
  } catch {
    // Missing/corrupt cache is only a cache: start fresh.
  }
  return empty;
}

async function writeCache(file: string | undefined, cache: QualityCacheFile): Promise<void> {
  if (!file) return;
  try {
    await fs.ensureDir(path.dirname(file));
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeJSON(tmp, cache, { spaces: 2 });
    await fs.move(tmp, file, { overwrite: true });
  } catch {
    // A cache that cannot be written must never fail the command.
  }
}

/** GET JSON through the injected fetch with a timeout; throws a descriptive Error. */
async function getJson(fetchImpl: FetchLike, url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: FetchResponse;
  try {
    res = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: controller.signal });
  } catch (error) {
    throw new Error(`${hostOf(url)} unreachable: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`${hostOf(url)} responded ${res.status} ${res.statusText}`);
  try {
    return await res.json();
  } catch (error) {
    throw new Error(`${hostOf(url)} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

interface NpmsPayload {
  score?: { final?: number; detail?: { quality?: number; popularity?: number; maintenance?: number } };
  collected?: { npm?: { downloads?: Array<{ from?: string; to?: string; count?: number }> } };
}

function isScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Monthly downloads from npms' collected download windows (the ~30 day window). */
function monthlyFromNpms(payload: NpmsPayload): number | null {
  const windows = payload.collected?.npm?.downloads;
  if (!Array.isArray(windows)) return null;
  let best: { days: number; count: number } | null = null;
  for (const w of windows) {
    if (typeof w.count !== 'number' || !w.from || !w.to) continue;
    const days = (Date.parse(w.to) - Date.parse(w.from)) / DAY_MS;
    if (!Number.isFinite(days) || days < 20 || days > 40) continue;
    if (!best || Math.abs(days - 30) < Math.abs(best.days - 30)) best = { days, count: w.count };
  }
  return best ? best.count : null;
}

async function fromNpms(
  name: string,
  fetchImpl: FetchLike,
  baseUrl: string,
  timeoutMs: number,
  nowIso: string
): Promise<PluginQuality> {
  const body = (await getJson(
    fetchImpl,
    `${baseUrl.replace(/\/+$/, '')}/v2/package/${encodeURIComponent(name)}`,
    timeoutMs
  )) as NpmsPayload;
  const final = body.score?.final;
  if (!isScore(final)) throw new Error('api.npms.io returned no score for this package');
  const detail = body.score?.detail ?? {};
  return {
    source: 'npms',
    rating: round(final * 5, 1),
    score: round(final, 4),
    quality: isScore(detail.quality) ? round(detail.quality, 4) : null,
    popularity: isScore(detail.popularity) ? round(detail.popularity, 4) : null,
    maintenance: isScore(detail.maintenance) ? round(detail.maintenance, 4) : null,
    downloadsLastMonth: monthlyFromNpms(body),
    fetchedAt: nowIso,
    cached: false,
    stale: false,
    derived: false,
  };
}

async function fromRegistryFacts(
  name: string,
  fetchImpl: FetchLike,
  options: PluginQualityOptions,
  timeoutMs: number,
  nowMs: number,
  nowIso: string
): Promise<PluginQuality> {
  const errors: string[] = [];

  let downloads: number | null = null;
  try {
    const body = (await getJson(
      fetchImpl,
      `${(options.downloadsUrl ?? DEFAULT_DOWNLOADS_URL).replace(/\/+$/, '')}/downloads/point/last-month/${name}`,
      timeoutMs
    )) as { downloads?: unknown };
    if (typeof body.downloads === 'number' && body.downloads >= 0) downloads = body.downloads;
    else errors.push('npm downloads API returned no count');
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  let lastPublish: string | null = null;
  let versionCount: number | null = null;
  let hygiene: Record<string, boolean> | null = null;
  try {
    const client = new RegistryClient({
      registryUrl: options.registryUrl ?? DEFAULT_REGISTRY_URL,
      fetchImpl,
      timeoutMs,
    });
    const packument = await client.getPackument(name);
    const latestTag = packument['dist-tags']?.latest;
    const latest = latestTag ? packument.versions[latestTag] : undefined;
    versionCount = Object.keys(packument.versions).length;
    lastPublish = (latestTag && packument.time?.[latestTag]) || packument.time?.modified || null;
    const repo = latest?.repository ?? packument.repository;
    const readme = (packument as { readme?: unknown }).readme;
    hygiene = {
      description: Boolean(latest?.description ?? packument.description),
      license: Boolean(latest?.license ?? packument.license),
      repository: Boolean(typeof repo === 'string' ? repo : repo?.url),
      readme: typeof readme === 'string' && readme.trim().length > 0 && readme !== 'ERROR: No README data found!',
      notDeprecated: !latest?.deprecated,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  if (downloads === null && hygiene === null) {
    return unavailable(errors.join('; ') || 'no registry data available', nowIso);
  }

  const ageDays = lastPublish && Number.isFinite(Date.parse(lastPublish)) ? (nowMs - Date.parse(lastPublish)) / DAY_MS : null;
  const popularity = downloads === null ? null : clamp01(Math.log10(downloads + 1) / 6);
  const maintenance = ageDays === null ? null : clamp01(1 - ageDays / 730);
  const quality = hygiene === null ? null : Object.values(hygiene).filter(Boolean).length / Object.values(hygiene).length;

  const parts: Array<[number | null, number]> = [
    [quality, 0.35],
    [popularity, 0.3],
    [maintenance, 0.35],
  ];
  const present = parts.filter((p): p is [number, number] => p[0] !== null);
  const weight = present.reduce((sum, [, w]) => sum + w, 0);
  const score = present.reduce((sum, [v, w]) => sum + v * w, 0) / weight;

  return {
    source: 'npm-registry',
    rating: round(score * 5, 1),
    score: round(score, 4),
    quality: quality === null ? null : round(quality, 4),
    popularity: popularity === null ? null : round(popularity, 4),
    maintenance: maintenance === null ? null : round(maintenance, 4),
    downloadsLastMonth: downloads,
    fetchedAt: nowIso,
    cached: false,
    stale: false,
    derived: true,
    signals: {
      downloadsLastMonth: downloads,
      lastPublish,
      ageDays: ageDays === null ? null : Math.round(ageDays),
      versionCount,
      ...(hygiene ?? {}),
    },
  };
}

/**
 * Fetch (or serve from cache) real quality data for a published package.
 * Never throws: failures surface as `source: "unavailable"` with the reason in
 * `error`, so callers can show a warning instead of a fabricated rating.
 *
 * @param name - Package name.
 * @param options - See {@link PluginQualityOptions}.
 */
export async function fetchPluginQuality(
  name: string,
  options: PluginQualityOptions = {}
): Promise<PluginQuality> {
  const nowMs = options.now?.() ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();

  if (!isValidPackageName(name)) {
    return unavailable(`"${name}" is not a valid npm package name`, nowIso);
  }

  const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
  const cache = await readCache(options.cacheFile);
  const hit = cache.entries[name];
  const hitAge = hit ? nowMs - Date.parse(hit.fetchedAt) : Infinity;

  if (hit && !options.refresh && hitAge < ttl && hitAge >= 0) {
    return { ...hit.quality, cached: true, stale: false };
  }
  if (options.offline) {
    return hit
      ? { ...hit.quality, cached: true, stale: true }
      : unavailable('offline: no cached quality data for this package', nowIso);
  }

  const fetchImpl = options.fetchImpl ?? (globalThis as { fetch?: FetchLike }).fetch;
  if (!fetchImpl) {
    return hit
      ? { ...hit.quality, cached: true, stale: true }
      : unavailable('no fetch implementation available in this runtime', nowIso);
  }
  const timeoutMs = options.timeoutMs ?? 8000;

  let quality: PluginQuality;
  let npmsError: string | null = null;
  try {
    quality = await fromNpms(name, fetchImpl, options.npmsUrl ?? DEFAULT_NPMS_URL, timeoutMs, nowIso);
  } catch (error) {
    npmsError = error instanceof Error ? error.message : String(error);
    quality = await fromRegistryFacts(name, fetchImpl, options, timeoutMs, nowMs, nowIso);
  }

  if (quality.source === 'unavailable') {
    const error = [npmsError, quality.error].filter(Boolean).join('; ');
    if (hit) return { ...hit.quality, cached: true, stale: true };
    return { ...quality, error };
  }

  cache.entries[name] = { fetchedAt: nowIso, quality };
  await writeCache(options.cacheFile, cache);
  return quality;
}
