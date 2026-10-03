import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { pluginQualitySchema } from '@re-shell/contracts';
import { fetchPluginQuality, qualityCachePath } from '../../src/utils/plugin-ratings';
import type { FetchLike, FetchResponse } from '../../src/utils/registry-client';
import { PluginMarketplace } from '../../src/utils/plugin-marketplace';
import { addReview } from '../../src/utils/plugin-reviews';

let tmp: string;
let cacheFile: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-ratings-'));
  cacheFile = qualityCachePath(tmp);
});

afterEach(async () => {
  await fs.remove(tmp);
});

const NOW = Date.parse('2026-10-01T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

type Route = { status: number; body: unknown } | Error;

/** A fetch whose responses are keyed by URL substring; unmatched URLs are 404. Records calls. */
function routed(routes: Record<string, Route>): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (url: string): Promise<FetchResponse> => {
    calls.push(url);
    for (const [needle, route] of Object.entries(routes)) {
      if (!url.includes(needle)) continue;
      if (route instanceof Error) throw route;
      return { ok: route.status < 400, status: route.status, statusText: String(route.status), json: async () => route.body };
    }
    return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) };
  }) as FetchLike & { calls: string[] };
  fn.calls = calls;
  return fn;
}

const NPMS_OK: Route = {
  status: 200,
  body: {
    score: { final: 0.82, detail: { quality: 0.9, popularity: 0.55, maintenance: 0.97 } },
    collected: {
      npm: {
        downloads: [
          { from: '2026-09-30T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z', count: 40 },
          { from: '2026-09-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z', count: 12345 },
          { from: '2025-10-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z', count: 999999 },
        ],
      },
    },
  },
};

const PACKUMENT = {
  name: 'reshell-plugin-q',
  'dist-tags': { latest: '2.0.0' },
  description: 'd',
  license: 'MIT',
  readme: '# readme',
  repository: { url: 'https://github.com/x/y' },
  time: { modified: '2026-09-20T00:00:00.000Z', '2.0.0': '2026-09-01T00:00:00.000Z' },
  versions: {
    '1.0.0': { name: 'reshell-plugin-q', version: '1.0.0', dist: { tarball: 't' } },
    '2.0.0': { name: 'reshell-plugin-q', version: '2.0.0', description: 'd', license: 'MIT', dist: { tarball: 't' } },
  },
};

describe('fetchPluginQuality: npms.io', () => {
  it('uses the npms score, converts it to a 0-5 rating, and extracts monthly downloads', async () => {
    const fetchImpl = routed({ 'api.npms.io': NPMS_OK });
    const q = await fetchPluginQuality('reshell-plugin-q', { fetchImpl, cacheFile, now: () => NOW });
    expect(q).toMatchObject({
      source: 'npms',
      rating: 4.1,
      score: 0.82,
      quality: 0.9,
      popularity: 0.55,
      maintenance: 0.97,
      downloadsLastMonth: 12345,
      derived: false,
      cached: false,
      stale: false,
    });
    expect(q.fetchedAt).toBe(new Date(NOW).toISOString());
    expect(pluginQualitySchema.safeParse(q).success).toBe(true);
    expect(fetchImpl.calls).toEqual(['https://api.npms.io/v2/package/reshell-plugin-q']);
  });

  it('URL-encodes scoped names for npms', async () => {
    const fetchImpl = routed({ 'api.npms.io': NPMS_OK });
    await fetchPluginQuality('@acme/reshell-plugin-q', { fetchImpl, now: () => NOW });
    expect(fetchImpl.calls[0]).toBe('https://api.npms.io/v2/package/%40acme%2Freshell-plugin-q');
  });

  it('honours custom base URLs', async () => {
    const fetchImpl = routed({ 'npms.internal': NPMS_OK });
    const q = await fetchPluginQuality('reshell-plugin-q', { fetchImpl, npmsUrl: 'https://npms.internal/', now: () => NOW });
    expect(q.source).toBe('npms');
    expect(fetchImpl.calls[0]).toBe('https://npms.internal/v2/package/reshell-plugin-q');
  });

  it('reports null downloads when npms has no ~30 day window (no invented number)', async () => {
    const fetchImpl = routed({
      'api.npms.io': { status: 200, body: { score: { final: 0.5, detail: {} }, collected: { npm: { downloads: [] } } } },
    });
    const q = await fetchPluginQuality('reshell-plugin-q', { fetchImpl, now: () => NOW });
    expect(q.downloadsLastMonth).toBeNull();
    expect(q.quality).toBeNull();
    expect(q.rating).toBe(2.5);
  });
});

describe('fetchPluginQuality: fallback to npm downloads + registry metadata', () => {
  const routes = (over: Record<string, Route> = {}): Record<string, Route> => ({
    'api.npms.io': { status: 503, body: {} },
    'api.npmjs.org/downloads/point/last-month/reshell-plugin-q': { status: 200, body: { downloads: 100000, package: 'reshell-plugin-q' } },
    'registry.npmjs.org/reshell-plugin-q': { status: 200, body: PACKUMENT },
    ...over,
  });

  it('derives a transparent score from real downloads and metadata, flagged as derived', async () => {
    const fetchImpl = routed(routes());
    const q = await fetchPluginQuality('reshell-plugin-q', { fetchImpl, cacheFile, now: () => NOW });

    expect(q.source).toBe('npm-registry');
    expect(q.derived).toBe(true);
    expect(q.downloadsLastMonth).toBe(100000);
    // popularity = log10(100001)/6 = 0.8333...
    expect(q.popularity).toBeCloseTo(0.8333, 3);
    // last publish 2026-09-01 is 30 days before NOW => maintenance = 1 - 30/730
    expect(q.maintenance).toBeCloseTo(1 - 30 / 730, 3);
    // all five hygiene signals present => quality = 1
    expect(q.quality).toBe(1);
    const expected = (0.35 * 1 + 0.3 * 0.8333 + 0.35 * (1 - 30 / 730)) / 1;
    expect(q.score).toBeCloseTo(expected, 2);
    expect(q.rating).toBeCloseTo(expected * 5, 1);
    expect(q.signals).toMatchObject({
      downloadsLastMonth: 100000,
      lastPublish: '2026-09-01T00:00:00.000Z',
      ageDays: 30,
      versionCount: 2,
      description: true,
      license: true,
      repository: true,
      readme: true,
      notDeprecated: true,
    });
    expect(pluginQualitySchema.safeParse(q).success).toBe(true);
    expect(fetchImpl.calls.some((u) => u === 'https://api.npmjs.org/downloads/point/last-month/reshell-plugin-q')).toBe(true);
  });

  it('penalizes stale, deprecated, undocumented packages and renormalizes over what is known', async () => {
    const stale = {
      ...PACKUMENT,
      readme: 'ERROR: No README data found!',
      description: undefined,
      license: undefined,
      repository: undefined,
      time: { modified: '2020-01-01T00:00:00.000Z', '2.0.0': '2020-01-01T00:00:00.000Z' },
      versions: {
        '2.0.0': { name: 'reshell-plugin-q', version: '2.0.0', deprecated: 'use something else', dist: { tarball: 't' } },
      },
    };
    const fetchImpl = routed(routes({ 'registry.npmjs.org/reshell-plugin-q': { status: 200, body: stale } }));
    const q = await fetchPluginQuality('reshell-plugin-q', { fetchImpl, now: () => NOW });
    expect(q.maintenance).toBe(0); // older than two years
    expect(q.quality).toBe(0); // no description, license, repository, readme; deprecated
    expect(q.rating!).toBeLessThan(2);
  });

  it('works with only registry metadata (downloads API down) and with only downloads (registry down)', async () => {
    const noDownloads = await fetchPluginQuality('reshell-plugin-q', {
      fetchImpl: routed(routes({ 'api.npmjs.org/downloads/point/last-month/reshell-plugin-q': { status: 500, body: {} } })),
      now: () => NOW,
    });
    expect(noDownloads.source).toBe('npm-registry');
    expect(noDownloads.downloadsLastMonth).toBeNull();
    expect(noDownloads.popularity).toBeNull();
    expect(noDownloads.quality).toBe(1);
    expect(noDownloads.score).toBeCloseTo((0.35 * 1 + 0.35 * (1 - 30 / 730)) / 0.7, 2);

    const noRegistry = await fetchPluginQuality('reshell-plugin-q', {
      fetchImpl: routed(routes({ 'registry.npmjs.org/reshell-plugin-q': { status: 500, body: {} } })),
      now: () => NOW,
    });
    expect(noRegistry.source).toBe('npm-registry');
    expect(noRegistry.downloadsLastMonth).toBe(100000);
    expect(noRegistry.quality).toBeNull();
    expect(noRegistry.maintenance).toBeNull();
    expect(noRegistry.score).toBeCloseTo(0.8333, 3);
  });

  it('falls back when npms answers without a score', async () => {
    const fetchImpl = routed(routes({ 'api.npms.io': { status: 200, body: { collected: {} } } }));
    const q = await fetchPluginQuality('reshell-plugin-q', { fetchImpl, now: () => NOW });
    expect(q.source).toBe('npm-registry');
  });
});

describe('fetchPluginQuality: unavailable', () => {
  it('never fabricates numbers when nothing is reachable', async () => {
    const down = routed({ '': new Error('ECONNREFUSED') });
    const q = await fetchPluginQuality('reshell-plugin-q', { fetchImpl: down, cacheFile, now: () => NOW });
    expect(q).toMatchObject({
      source: 'unavailable',
      rating: null,
      score: null,
      quality: null,
      popularity: null,
      maintenance: null,
      downloadsLastMonth: null,
    });
    expect(q.error).toMatch(/unreachable|ECONNREFUSED/);
    expect(await fs.pathExists(cacheFile)).toBe(false); // nothing cached from a failure
    expect(pluginQualitySchema.safeParse(q).success).toBe(true);
  });

  it('rejects an invalid package name without any request', async () => {
    const fetchImpl = routed({});
    const q = await fetchPluginQuality('../etc/passwd', { fetchImpl });
    expect(q.source).toBe('unavailable');
    expect(fetchImpl.calls).toEqual([]);
  });

  it('times out hung requests', async () => {
    const hung: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const q = await fetchPluginQuality('reshell-plugin-q', { fetchImpl: hung, timeoutMs: 30, now: () => NOW });
    expect(q.source).toBe('unavailable');
    expect(q.error).toMatch(/aborted|unreachable/);
  });
});

describe('fetchPluginQuality: cache', () => {
  it('serves a fresh entry from the cache without touching the network', async () => {
    const first = routed({ 'api.npms.io': NPMS_OK });
    await fetchPluginQuality('reshell-plugin-q', { fetchImpl: first, cacheFile, now: () => NOW });
    expect(first.calls).toHaveLength(1);

    const second = routed({});
    const cached = await fetchPluginQuality('reshell-plugin-q', { fetchImpl: second, cacheFile, now: () => NOW + 60 * 60 * 1000 });
    expect(second.calls).toEqual([]);
    expect(cached).toMatchObject({ source: 'npms', rating: 4.1, cached: true, stale: false });
    expect(cached.fetchedAt).toBe(new Date(NOW).toISOString());
  });

  it('persists to disk so a later process benefits', async () => {
    await fetchPluginQuality('reshell-plugin-q', { fetchImpl: routed({ 'api.npms.io': NPMS_OK }), cacheFile, now: () => NOW });
    const onDisk = await fs.readJSON(cacheFile);
    expect(onDisk.entries['reshell-plugin-q'].quality.rating).toBe(4.1);
  });

  it('refetches after the TTL, and on refresh', async () => {
    await fetchPluginQuality('reshell-plugin-q', { fetchImpl: routed({ 'api.npms.io': NPMS_OK }), cacheFile, now: () => NOW });

    const later = routed({ 'api.npms.io': { status: 200, body: { score: { final: 0.4, detail: {} } } } });
    const expired = await fetchPluginQuality('reshell-plugin-q', { fetchImpl: later, cacheFile, ttlMs: DAY, now: () => NOW + 2 * DAY });
    expect(later.calls).toHaveLength(1);
    expect(expired).toMatchObject({ rating: 2, cached: false });

    const refresh = routed({ 'api.npms.io': NPMS_OK });
    const forced = await fetchPluginQuality('reshell-plugin-q', { fetchImpl: refresh, cacheFile, now: () => NOW + 2 * DAY + 1000, refresh: true });
    expect(refresh.calls).toHaveLength(1);
    expect(forced.rating).toBe(4.1);
  });

  it('serves an expired entry (flagged stale) when the refresh fails', async () => {
    await fetchPluginQuality('reshell-plugin-q', { fetchImpl: routed({ 'api.npms.io': NPMS_OK }), cacheFile, now: () => NOW });
    const down = routed({ '': new Error('offline') });
    const q = await fetchPluginQuality('reshell-plugin-q', { fetchImpl: down, cacheFile, ttlMs: DAY, now: () => NOW + 5 * DAY });
    expect(q).toMatchObject({ source: 'npms', rating: 4.1, cached: true, stale: true });
  });

  it('offline mode never fetches: cache (stale if expired) or unavailable', async () => {
    const none = routed({});
    const miss = await fetchPluginQuality('reshell-plugin-q', { fetchImpl: none, cacheFile, offline: true, now: () => NOW });
    expect(miss.source).toBe('unavailable');
    expect(miss.error).toMatch(/offline/);

    await fetchPluginQuality('reshell-plugin-q', { fetchImpl: routed({ 'api.npms.io': NPMS_OK }), cacheFile, now: () => NOW });
    const hit = await fetchPluginQuality('reshell-plugin-q', { fetchImpl: none, cacheFile, offline: true, ttlMs: DAY, now: () => NOW + 9 * DAY });
    expect(hit).toMatchObject({ source: 'npms', cached: true, stale: true });
    expect(none.calls).toEqual([]);
  });

  it('tolerates a corrupt cache file and an unwritable cache location', async () => {
    await fs.outputFile(cacheFile, 'not json');
    const q = await fetchPluginQuality('reshell-plugin-q', { fetchImpl: routed({ 'api.npms.io': NPMS_OK }), cacheFile, now: () => NOW });
    expect(q.source).toBe('npms');

    const blocked = path.join(tmp, 'blocked');
    await fs.writeFile(blocked, 'a file where a directory is needed');
    const q2 = await fetchPluginQuality('reshell-plugin-q', {
      fetchImpl: routed({ 'api.npms.io': NPMS_OK }),
      cacheFile: path.join(blocked, 'sub', 'cache.json'),
      now: () => NOW,
    });
    expect(q2.source).toBe('npms');
  });

  it('keeps entries for other packages', async () => {
    await fetchPluginQuality('pkg-a', { fetchImpl: routed({ 'api.npms.io': NPMS_OK }), cacheFile, now: () => NOW });
    await fetchPluginQuality('pkg-b', { fetchImpl: routed({ 'api.npms.io': NPMS_OK }), cacheFile, now: () => NOW });
    expect(Object.keys((await fs.readJSON(cacheFile)).entries).sort()).toEqual(['pkg-a', 'pkg-b']);
  });
});

describe('marketplace integration: ratings are real, not hardcoded zero', () => {
  const SEARCH = {
    objects: [
      {
        package: { name: 'reshell-plugin-scored', version: '1.0.0', description: 'd', keywords: ['reshell-plugin'], date: '2026-09-01T00:00:00.000Z' },
        score: { final: 0.9, detail: { quality: 0.95, popularity: 0.6, maintenance: 0.99 } },
        downloads: { monthly: 4321, weekly: 1000 },
      },
      {
        package: { name: 'reshell-plugin-unscored', version: '1.0.0', description: 'd', keywords: ['reshell-plugin'], date: '2026-09-01T00:00:00.000Z' },
      },
    ],
  };

  it('search results carry the npms score the registry returns, and null (not 0) when there is none', async () => {
    const fetchImpl = routed({ '/-/v1/search': { status: 200, body: SEARCH } });
    const marketplace = new PluginMarketplace({ fetchImpl, workspaceRoot: tmp, verifySignatures: false });
    const result = await marketplace.searchPlugins({ limit: 10 });
    const scored = result.plugins.find((p) => p.name === 'reshell-plugin-scored')!;
    const unscored = result.plugins.find((p) => p.name === 'reshell-plugin-unscored')!;
    expect(scored.rating).toBe(4.5);
    expect(scored.downloads).toBe(4321);
    expect(scored.quality).toMatchObject({ source: 'npms', score: 0.9, maintenance: 0.99 });
    expect(unscored.rating).toBeNull();
    expect(unscored.downloads).toBeNull();
    expect(unscored.quality).toBeNull();
  });

  it('sorts by real rating and downloads', async () => {
    const fetchImpl = routed({ '/-/v1/search': { status: 200, body: SEARCH } });
    const marketplace = new PluginMarketplace({ fetchImpl, workspaceRoot: tmp, verifySignatures: false });
    const byRating = await marketplace.searchPlugins({ sortBy: 'rating', sortOrder: 'desc' });
    expect(byRating.plugins.map((p) => p.name)).toEqual(['reshell-plugin-scored', 'reshell-plugin-unscored']);
    const asc = await marketplace.searchPlugins({ sortBy: 'downloads', sortOrder: 'asc', limit: 9 });
    expect(asc.plugins.map((p) => p.name)).toEqual(['reshell-plugin-unscored', 'reshell-plugin-scored']);
  });

  it('search results include team review counts from the workspace', async () => {
    await addReview(tmp, { plugin: 'reshell-plugin-scored', rating: 5, comment: 'a', author: 'a@x.io' });
    await addReview(tmp, { plugin: 'reshell-plugin-scored', rating: 3, comment: 'b', author: 'b@x.io' });
    const fetchImpl = routed({ '/-/v1/search': { status: 200, body: SEARCH } });
    const marketplace = new PluginMarketplace({ fetchImpl, workspaceRoot: tmp, verifySignatures: false });
    const result = await marketplace.searchPlugins({ limit: 10 });
    const scored = result.plugins.find((p) => p.name === 'reshell-plugin-scored')!;
    expect(scored).toMatchObject({ reviewCount: 2, teamRating: 4 });
    expect(result.plugins.find((p) => p.name === 'reshell-plugin-unscored')).toMatchObject({ reviewCount: 0, teamRating: null });
  });

  it('getPlugin with fetchQuality pulls npms data and downloads; without it nothing extra is fetched', async () => {
    const routes = {
      'api.npms.io': NPMS_OK,
      'registry.npmjs.org/reshell-plugin-q': { status: 200, body: PACKUMENT },
    };
    const plain = routed(routes);
    const withoutQuality = await new PluginMarketplace({ fetchImpl: plain, workspaceRoot: tmp }).getPlugin('reshell-plugin-q');
    expect(withoutQuality).toMatchObject({ rating: null, quality: null, downloads: null });
    expect(plain.calls.some((u) => u.includes('npms.io'))).toBe(false);

    const enriched = routed(routes);
    const withQuality = await new PluginMarketplace({ fetchImpl: enriched, workspaceRoot: tmp, fetchQuality: true }).getPlugin('reshell-plugin-q');
    expect(withQuality).toMatchObject({ rating: 4.1, downloads: 12345 });
    expect(withQuality?.quality?.source).toBe('npms');
    // The result was cached on disk for the next invocation.
    expect(await fs.pathExists(qualityCachePath(tmp))).toBe(true);
  });

  it('getPlugin reports unavailable quality honestly when the rating services are down', async () => {
    const fetchImpl = routed({ 'registry.npmjs.org/reshell-plugin-q': { status: 200, body: PACKUMENT } });
    vi.spyOn(Date, 'now');
    const plugin = await new PluginMarketplace({ fetchImpl, workspaceRoot: tmp, fetchQuality: true }).getPlugin('reshell-plugin-q');
    // npms 404s and the downloads API 404s, but the registry packument is real => derived from metadata only.
    expect(plugin?.quality?.source).toBe('npm-registry');
    expect(plugin?.quality?.downloadsLastMonth).toBeNull();
    expect(plugin?.rating).toBe(plugin?.quality?.rating);
    vi.restoreAllMocks();
  });
});
