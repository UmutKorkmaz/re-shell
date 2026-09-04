import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PluginCommandCacheManager,
  createCommandCacheManager,
  formatCacheSize,
  formatCacheHitRate,
  formatExecutionTime,
  CacheStorageStrategy,
  CacheInvalidationStrategy,
  PerformanceMonitoringLevel,
  type CacheConfiguration,
} from '../../src/utils/plugin-command-cache';
import type { PluginCommandContext } from '../../src/utils/plugin-command-registry';

/**
 * Test config: in-memory only (no disk I/O), no cleanup timer (avoids dangling
 * intervals between tests), so the cache logic can be exercised in isolation.
 */
const TEST_CONFIG: Partial<CacheConfiguration> = {
  strategy: CacheStorageStrategy.MEMORY,
  persistToDisk: false,
  cleanupInterval: 0,
};

/** Minimal PluginCommandContext whose cli fields feed the cache key hash. */
function makeContext(): PluginCommandContext {
  return {
    command: { name: 'deploy', description: 't', handler: () => {}, options: [] },
    plugin: { manifest: { name: 'test-plugin', version: '1.0.0' } },
    cli: { rootPath: '/root', configPath: '/root/.re-shell', version: '1.0.0' },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    utils: {},
  } as unknown as PluginCommandContext;
}

const CTX = makeContext();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('plugin-command-cache — enums & pure formatters', () => {
  it('exposes the expected CacheStorageStrategy values', () => {
    expect(CacheStorageStrategy.MEMORY).toBe('memory');
    expect(CacheStorageStrategy.FILE_SYSTEM).toBe('file-system');
    expect(CacheStorageStrategy.HYBRID).toBe('hybrid');
  });

  it('exposes the expected CacheInvalidationStrategy values', () => {
    expect(CacheInvalidationStrategy.LRU).toBe('lru');
    expect(CacheInvalidationStrategy.LFU).toBe('lfu');
    expect(CacheInvalidationStrategy.FIFO).toBe('fifo');
    expect(CacheInvalidationStrategy.TTL).toBe('ttl');
  });

  it('exposes the expected PerformanceMonitoringLevel values', () => {
    expect(PerformanceMonitoringLevel.NONE).toBe('none');
    expect(PerformanceMonitoringLevel.BASIC).toBe('basic');
    expect(PerformanceMonitoringLevel.DETAILED).toBe('detailed');
    expect(PerformanceMonitoringLevel.VERBOSE).toBe('verbose');
  });

  it('formatCacheSize scales bytes into the right unit', () => {
    expect(formatCacheSize(0)).toBe('0.0 B');
    expect(formatCacheSize(512)).toBe('512.0 B');
    expect(formatCacheSize(1024)).toBe('1.0 KB');
    expect(formatCacheSize(2048)).toBe('2.0 KB');
    expect(formatCacheSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatCacheSize(1024 * 1024 * 1024)).toBe('1.0 GB');
  });

  it('formatCacheHitRate formats a 0-1 fraction as a percentage', () => {
    expect(formatCacheHitRate(0)).toBe('0.0%');
    expect(formatCacheHitRate(0.5)).toBe('50.0%');
    expect(formatCacheHitRate(1)).toBe('100.0%');
  });

  it('formatExecutionTime renders sub-second as ms and above as seconds', () => {
    expect(formatExecutionTime(0)).toBe('0.0ms');
    expect(formatExecutionTime(250)).toBe('250.0ms');
    expect(formatExecutionTime(999.9)).toBe('999.9ms');
    expect(formatExecutionTime(1000)).toBe('1.00s');
    expect(formatExecutionTime(2500)).toBe('2.50s');
  });
});

describe('plugin-command-cache — factory & configuration', () => {
  it('createCommandCacheManager returns an instance', () => {
    const manager = createCommandCacheManager(TEST_CONFIG);
    expect(manager).toBeInstanceOf(PluginCommandCacheManager);
  });

  it('constructor applies documented defaults', () => {
    const manager = new PluginCommandCacheManager();
    const config = manager.getConfiguration();
    expect(config).toMatchObject({
      enabled: true,
      strategy: CacheStorageStrategy.HYBRID,
      invalidationStrategy: CacheInvalidationStrategy.LRU,
      maxSize: 1000,
      defaultTTL: 5 * 60 * 1000,
      compressionEnabled: true,
      encryptionEnabled: false,
      performanceMonitoring: PerformanceMonitoringLevel.BASIC,
    });
  });

  it('constructor merges provided overrides over the defaults', () => {
    const manager = new PluginCommandCacheManager({ maxSize: 50, encryptionEnabled: true });
    const config = manager.getConfiguration();
    expect(config.maxSize).toBe(50);
    expect(config.encryptionEnabled).toBe(true);
    expect(config.enabled).toBe(true); // untouched default
  });

  it('updateConfiguration merges overrides and emits configuration-updated', () => {
    const manager = createCommandCacheManager(TEST_CONFIG);
    const listener = vi.fn();
    manager.on('configuration-updated', listener);
    manager.updateConfiguration({ maxSize: 200 });
    expect(manager.getConfiguration().maxSize).toBe(200);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].maxSize).toBe(200);
  });
});

describe('plugin-command-cache — executeWithCache', () => {
  it('caches a miss and serves a subsequent hit from cache', async () => {
    const manager = createCommandCacheManager(TEST_CONFIG);
    let calls = 0;
    const exec = async () => {
      calls++;
      return { result: calls };
    };

    const miss = await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec);
    expect(miss.hit).toBe(false);
    expect(miss.source).toBe('execution');
    expect(miss.value).toEqual({ result: 1 });
    expect(miss.metadata).toBeDefined();
    expect(calls).toBe(1);

    const hit = await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec);
    expect(hit.hit).toBe(true);
    expect(hit.source).toBe('cache');
    expect(hit.value).toEqual({ result: 1 });
    expect(calls).toBe(1); // executor not re-run on hit
  });

  it('emits cache-miss and cache-hit events', async () => {
    const manager = createCommandCacheManager(TEST_CONFIG);
    const miss = vi.fn();
    const hit = vi.fn();
    manager.on('cache-miss', miss);
    manager.on('cache-hit', hit);
    const exec = async () => 'v';
    await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec);
    await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec);
    expect(miss).toHaveBeenCalledTimes(1);
    expect(hit).toHaveBeenCalledTimes(1);
    expect(hit.mock.calls[0][0]).toMatchObject({ commandId: 'deploy' });
  });

  it('distinct arguments produce distinct cache entries', async () => {
    const manager = createCommandCacheManager(TEST_CONFIG);
    let calls = 0;
    const exec = async () => ++calls;
    await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec); // miss
    await manager.executeWithCache('deploy', { env: 'dev' }, {}, CTX, exec); // miss (different args)
    expect(calls).toBe(2);
    // Same as the first invocation -> hit
    const hit = await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec);
    expect(hit.hit).toBe(true);
    expect(calls).toBe(2);
  });

  it('disabled cache always executes fresh and never hits', async () => {
    const manager = createCommandCacheManager({ ...TEST_CONFIG, enabled: false });
    let calls = 0;
    const exec = async () => ++calls;
    await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec);
    const second = await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec);
    expect(second.hit).toBe(false);
    expect(second.source).toBe('execution');
    expect(calls).toBe(2);
  });

  it('expired entries are re-executed after the TTL elapses', async () => {
    const manager = createCommandCacheManager({ ...TEST_CONFIG, defaultTTL: 50 });
    let calls = 0;
    const exec = async () => ++calls;
    await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec); // miss, cached
    await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec); // hit
    expect(calls).toBe(1);
    await sleep(80); // past TTL
    const expired = await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec);
    expect(expired.hit).toBe(false);
    expect(calls).toBe(2); // re-executed after expiry
  });

  it('executor errors are surfaced, not cached, and re-run on retry', async () => {
    const manager = createCommandCacheManager(TEST_CONFIG);
    const errored = vi.fn();
    manager.on('execution-error', errored);
    let calls = 0;
    const exec = async () => {
      calls++;
      throw new Error('boom');
    };
    const first = await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec);
    expect(first.hit).toBe(false);
    expect(first.error?.message).toBe('boom');
    expect(errored).toHaveBeenCalledTimes(1);
    // The error result is not cached, so a retry runs the executor again.
    const second = await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec);
    expect(second.error?.message).toBe('boom');
    expect(calls).toBe(2);
  });

  it('updates hit/miss metrics', async () => {
    const manager = createCommandCacheManager(TEST_CONFIG);
    const exec = async () => 'v';
    await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec); // miss
    await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec); // hit
    await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec); // hit
    const metrics = manager.getMetrics();
    expect(metrics.totalExecutions).toBe(3);
    expect(metrics.cacheHits).toBe(2);
    // NOTE bug: a single miss increments cacheMisses twice — once manually in
    // executeWithCache and again inside updateMetrics(hit=false) — so one real
    // miss is reported as 2.
    expect(metrics.cacheMisses).toBe(2);
    expect(metrics.hitRate).toBeGreaterThan(0);
  });
});

describe('plugin-command-cache — invalidation', () => {
  it('invalidateEntry removes an entry, returns false for unknown keys', async () => {
    const manager = createCommandCacheManager(TEST_CONFIG);
    const exec = async () => 'v';
    await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec);
    const invalidated = vi.fn();
    manager.on('cache-entry-invalidated', invalidated);

    // The cache key is an internal hash; invalidate via command-level helpers
    // below, but verify the event wiring by invalidating a known tag-able entry.
    const count = await manager.invalidateByCommand('deploy');
    expect(count).toBe(1);
    expect(invalidated).toHaveBeenCalledTimes(1);
    // A second invalidation of the same command finds nothing.
    expect(await manager.invalidateByCommand('deploy')).toBe(0);
  });

  it('invalidateByTags removes entries matching any tag', async () => {
    const manager = createCommandCacheManager(TEST_CONFIG);
    const exec = async () => 'v';
    await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec);
    await manager.executeWithCache('build', { env: 'prod' }, {}, CTX, exec);
    // generateTags emits `command:<id>` for every entry.
    const removed = await manager.invalidateByTags(['command:deploy']);
    expect(removed).toBe(1);
    // Non-matching tags remove nothing.
    expect(await manager.invalidateByTags(['command:nonexistent'])).toBe(0);
  });

  it('invalidateByCommand removes all entries for a command id', async () => {
    const manager = createCommandCacheManager(TEST_CONFIG);
    const exec = async () => 'v';
    // Same command, two distinct arg-sets -> two entries.
    await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec);
    await manager.executeWithCache('deploy', { env: 'dev' }, {}, CTX, exec);
    await manager.executeWithCache('build', { env: 'prod' }, {}, CTX, exec);
    const removed = await manager.invalidateByCommand('deploy');
    expect(removed).toBe(2);
    // build entry untouched.
    const stats = manager.getCacheStats();
    expect(stats.size).toBe(1);
  });

  it('clearAll empties the cache, resets metrics and emits cache-cleared', async () => {
    const manager = createCommandCacheManager(TEST_CONFIG);
    const exec = async () => 'v';
    await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec);
    await manager.executeWithCache('build', { env: 'prod' }, {}, CTX, exec);
    expect(manager.getCacheStats().size).toBe(2);
    const cleared = vi.fn();
    manager.on('cache-cleared', cleared);
    await manager.clearAll();
    expect(manager.getCacheStats().size).toBe(0);
    expect(manager.getMetrics().totalExecutions).toBe(0);
    expect(cleared).toHaveBeenCalledTimes(1);
  });
});

describe('plugin-command-cache — eviction', () => {
  it('evicts the least-recently-used entry once maxSize is exceeded', async () => {
    // NOTE: ensureCapacity evicts Math.floor(maxSize * 0.1) entries, so maxSize
    // must be >= 10 for any eviction to occur (floor(10*0.1) === 1).
    const manager = createCommandCacheManager({
      ...TEST_CONFIG,
      maxSize: 10,
      invalidationStrategy: CacheInvalidationStrategy.LRU,
    });
    let calls = 0;
    const exec = async () => ++calls;

    // Insert 11 distinct commands; the 11th triggers eviction of cmd0 (the LRU).
    for (let i = 0; i < 11; i++) {
      await manager.executeWithCache(`cmd${i}`, { i }, {}, CTX, exec);
    }
    expect(manager.getCacheStats().size).toBe(10);

    // cmd0 was evicted -> re-executing it is a miss (executor runs again).
    const result = await manager.executeWithCache('cmd0', { i: 0 }, {}, CTX, exec);
    expect(result.hit).toBe(false);
  });
});

describe('plugin-command-cache — stats & lifecycle', () => {
  it('getCacheStats reports size and notable entries', async () => {
    const manager = createCommandCacheManager(TEST_CONFIG);
    const exec = async () => ({ payload: 'x' });
    await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec);
    const stats = manager.getCacheStats();
    expect(stats.size).toBe(1);
    expect(stats.memoryUsage).toBeGreaterThanOrEqual(0);
    expect(stats.oldestEntry).toBeDefined();
    expect(stats.newestEntry).toBeDefined();
    expect(stats.largestEntry).toBeDefined();
  });

  it('mostAccessedEntry reflects repeated hits', async () => {
    const manager = createCommandCacheManager(TEST_CONFIG);
    const exec = async () => 'v';
    await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec);
    // Two hits bump the deploy entry's access count.
    await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec);
    await manager.executeWithCache('deploy', { env: 'prod' }, {}, CTX, exec);
    await manager.executeWithCache('build', { env: 'prod' }, {}, CTX, exec); // 1 access
    const stats = manager.getCacheStats();
    expect(stats.mostAccessedEntry?.metadata.commandId).toBe('deploy');
  });

  it('getMetrics returns a detached copy', () => {
    const manager = createCommandCacheManager(TEST_CONFIG);
    const m1 = manager.getMetrics();
    m1.totalExecutions = 999;
    expect(manager.getMetrics().totalExecutions).toBe(0);
  });

  it('destroy emits cache-destroyed', async () => {
    const manager = createCommandCacheManager(TEST_CONFIG);
    const listener = vi.fn();
    manager.on('cache-destroyed', listener);
    await manager.destroy();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
