import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import {
  CacheStorageStrategy,
  PerformanceMonitoringLevel,
} from '../../src/utils/plugin-command-cache';
import {
  showCacheStats,
  configureCacheSettings,
  clearCache,
  testCachePerformance,
  optimizeCache,
  listCachedCommands,
} from '../../src/commands/plugin-cache';
import { ValidationError } from '../../src/utils/error-handler';

// Covers src/commands/plugin-cache.ts (667 lines, 6 exports): stats rendering,
// setting validation/parsing, clear flows (all/command/tags + --force gate),
// the performance harness, optimization recommendations and the cached-command
// listing. createCommandCacheManager is mocked with a scripted in-memory
// manager; the spinner util is stubbed.

vi.mock('../../src/utils/plugin-command-cache', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/utils/plugin-command-cache')>();
  return { ...real, createCommandCacheManager: vi.fn() };
});

vi.mock('../../src/utils/spinner', () => ({
  createSpinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    setText: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  }),
}));

const { createCommandCacheManager } = await import('../../src/utils/plugin-command-cache');
const factoryMock = vi.mocked(createCommandCacheManager);

let logSpy: ReturnType<typeof vi.spyOn>;
let managers: FakeManager[];

class FakeManager extends EventEmitter {
  stats = {
    size: 10,
    memoryUsage: 10 * 1024 * 1024,
    hitRate: 0.75,
    totalExecutions: 100,
    oldestEntry: undefined,
    newestEntry: undefined,
    mostAccessedEntry: undefined,
    largestEntry: undefined,
  };
  metrics = {
    totalExecutions: 100,
    cacheHits: 75,
    cacheMisses: 25,
    hitRate: 0.75,
    averageExecutionTime: 120,
    averageCachedExecutionTime: 4,
    totalMemoryUsage: 0,
    totalDiskUsage: 0,
    slowestCommands: [],
    mostCachedCommands: [],
    errorRate: 0.05,
    lastCleanupAt: 1_700_000_000_000,
  };
  config = {
    enabled: true,
    strategy: CacheStorageStrategy.HYBRID,
    invalidationStrategy: 'lru',
    maxSize: 1000,
    maxMemoryUsage: 100 * 1024 * 1024,
    defaultTTL: 5 * 60 * 1000,
    cleanupInterval: 60 * 1000,
    compressionEnabled: true,
    encryptionEnabled: false,
    persistToDisk: true,
    performanceMonitoring: PerformanceMonitoringLevel.BASIC,
  };
  destroyed = false;

  getCacheStats() { return this.stats; }
  getMetrics() { return this.metrics; }
  getConfiguration() { return this.config; }
  updateConfiguration = vi.fn();
  clearAll = vi.fn(async () => {});
  invalidateByCommand = vi.fn(async () => 2);
  invalidateByTags = vi.fn(async () => 3);
  destroy = vi.fn(async () => { this.destroyed = true; });
  executeWithCache = vi.fn(async () => ({ hit: true, value: 'x', executionTime: 1, source: 'cache' }));
}

/** Install a fresh manager as the factory return value. */
function manager(): FakeManager {
  const m = new FakeManager();
  managers.push(m);
  factoryMock.mockReturnValue(m as never);
  return m;
}

function output(): string {
  return logSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

beforeEach(() => {
  vi.clearAllMocks();
  managers = [];
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('showCacheStats', () => {
  it('renders overview and performance sections', async () => {
    manager();
    await showCacheStats();
    const text = output();
    expect(text).toContain('Command Cache Statistics');
    expect(text).toContain('Cache Overview:');
    expect(text).toContain('Status: Enabled');
    expect(text).toContain('Strategy: hybrid');
    expect(text).toContain('Size: 10 entries');
    expect(text).toContain('Hit rate: 75.0%');
    expect(text).toContain('Performance Metrics:');
    expect(text).toContain('Total executions: 100');
    expect(text).toContain('Cache hits: 75');
    expect(text).toContain('Cache misses: 25');
    expect(text).toContain('Error rate: 5.0%');
  });

  it('adds configuration, entry and maintenance sections in verbose mode', async () => {
    const m = manager();
    m.stats.oldestEntry = { createdAt: 1_700_000_000_000 };
    m.stats.newestEntry = { createdAt: 1_700_000_100_000 };
    m.stats.mostAccessedEntry = { accessCount: 9 };
    m.stats.largestEntry = { size: 2048 };

    await showCacheStats({ verbose: true });

    const text = output();
    expect(text).toContain('Configuration:');
    expect(text).toContain('Max size: 1000 entries');
    expect(text).toContain('Default TTL:');
    expect(text).toContain('Compression: Yes');
    expect(text).toContain('Encryption: No');
    expect(text).toContain('Cache Entries:');
    expect(text).toContain('Most accessed: 9 times');
    expect(text).toContain('Maintenance:');
    expect(text).toContain('Last cleanup:');
  });

  it('warns about a low hit rate below 50%', async () => {
    const m = manager();
    m.stats.hitRate = 0.4;
    await showCacheStats();
    expect(output()).toContain('Low cache hit rate detected');
    expect(output()).toContain('Consider increasing TTL');
  });

  it('warns about high memory usage above 80% of the cap', async () => {
    const m = manager();
    m.stats.memoryUsage = m.config.maxMemoryUsage * 0.9;
    await showCacheStats();
    expect(output()).toContain('High memory usage detected');
    expect(output()).toContain('Consider increasing max memory');
  });

  it('stays silent on warnings for a healthy cache', async () => {
    manager();
    await showCacheStats();
    expect(output()).not.toContain('Low cache hit rate');
    expect(output()).not.toContain('High memory usage');
  });

  it('emits a JSON envelope with stats, metrics and config', async () => {
    const m = manager();
    await showCacheStats({ json: true });
    const payload = JSON.parse(output());
    expect(payload.stats.size).toBe(10);
    expect(payload.metrics.cacheHits).toBe(75);
    expect(payload.config.strategy).toBe(CacheStorageStrategy.HYBRID);
  });

  it('destroys the manager afterwards', async () => {
    const m = manager();
    await showCacheStats();
    expect(m.destroy).toHaveBeenCalledTimes(1);
  });

  it('wraps manager failures in a ValidationError', async () => {
    const m = manager();
    m.getCacheStats = () => { throw new Error('boom'); };
    await expect(showCacheStats()).rejects.toThrow(ValidationError);
    await expect(showCacheStats()).rejects.toThrow('Failed to show cache statistics: boom');
  });
});

describe('configureCacheSettings', () => {
  it('rejects an unknown setting name', async () => {
    manager();
    await expect(configureCacheSettings('nope', '1')).rejects.toThrow(
      "Invalid setting 'nope'"
    );
  });

  it('parses boolean settings case-insensitively', async () => {
    const m = manager();
    await configureCacheSettings('enabled', 'FALSE');
    expect(m.updateConfiguration).toHaveBeenCalledWith({ enabled: false });
    expect(output()).toContain('Updated cache configuration: enabled = false');
  });

  it('accepts non-negative numbers for maxSize and cleanupInterval', async () => {
    const m = manager();
    await configureCacheSettings('maxSize', '500');
    expect(m.updateConfiguration).toHaveBeenCalledWith({ maxSize: 500 });

    await configureCacheSettings('cleanupInterval', '0');
    expect(m.updateConfiguration).toHaveBeenCalledWith({ cleanupInterval: 0 });
  });

  it('rejects NaN or negative values for count settings', async () => {
    manager();
    await expect(configureCacheSettings('maxSize', 'abc')).rejects.toThrow(
      'maxSize must be a positive number'
    );
    await expect(configureCacheSettings('maxSize', '-5')).rejects.toThrow(
      'maxSize must be a positive number'
    );
  });

  it('rejects zero for byte/duration settings that must be positive', async () => {
    manager();
    await expect(configureCacheSettings('defaultTTL', '0')).rejects.toThrow(
      'defaultTTL must be a positive number'
    );
    await expect(configureCacheSettings('maxMemoryUsage', '-1')).rejects.toThrow(
      'maxMemoryUsage must be a positive number'
    );
  });

  it('validates the strategy against the enum', async () => {
    const m = manager();
    await configureCacheSettings('strategy', CacheStorageStrategy.MEMORY);
    expect(m.updateConfiguration).toHaveBeenCalledWith({
      strategy: CacheStorageStrategy.MEMORY,
    });

    manager();
    await expect(configureCacheSettings('strategy', 'quantum')).rejects.toThrow(
      'Invalid strategy'
    );
  });

  it('validates the performance monitoring level against the enum', async () => {
    const m = manager();
    await configureCacheSettings('performanceMonitoring', PerformanceMonitoringLevel.DETAILED);
    expect(m.updateConfiguration).toHaveBeenCalledWith({
      performanceMonitoring: PerformanceMonitoringLevel.DETAILED,
    });

    manager();
    await expect(configureCacheSettings('performanceMonitoring', 'ultra')).rejects.toThrow(
      'Invalid monitoring level'
    );
  });

  it('renders the full configuration in verbose mode', async () => {
    manager();
    await configureCacheSettings('defaultTTL', '60000', { verbose: true });
    const text = output();
    expect(text).toContain('Current Configuration:');
    expect(text).toContain('defaultTTL');
    expect(text).toContain('maxSize');
  });
});

describe('clearCache', () => {
  it('refuses to clear without --force', async () => {
    manager();
    await clearCache();
    const text = output();
    expect(text).toContain('This will clear cached command results');
    expect(text).toContain('Use --force to confirm');
    expect(factoryMock).not.toHaveBeenCalled();
  });

  it('clears every entry when no filter is given', async () => {
    const m = manager();
    await clearCache({ force: true });
    expect(m.clearAll).toHaveBeenCalledTimes(1);
    expect(output()).toContain('Cleared all cache (10 entries)');
  });

  it('invalidates a single command with --command', async () => {
    const m = manager();
    await clearCache({ force: true, command: 'build' });
    expect(m.invalidateByCommand).toHaveBeenCalledWith('build');
    expect(output()).toContain("Cleared cache for command 'build' (2 entries)");
  });

  it('invalidates by a comma-separated tag list', async () => {
    const m = manager();
    await clearCache({ force: true, tags: 'a, b ,c' });
    expect(m.invalidateByTags).toHaveBeenCalledWith(['a', 'b', 'c']);
    expect(output()).toContain('Cleared cache for tags: a, b, c (3 entries)');
  });

  it('reports freed entries in verbose mode', async () => {
    manager();
    await clearCache({ force: true, verbose: true, command: 'build' });
    const text = output();
    expect(text).toContain('Cache cleared successfully');
    expect(text).toContain('Entries removed: 2');
  });

  it('wraps failures in a ValidationError', async () => {
    const m = manager();
    m.clearAll = async () => { throw new Error('disk on fire'); };
    await expect(clearCache({ force: true })).rejects.toThrow('Failed to clear cache: disk on fire');
  });
});

describe('testCachePerformance', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects non-positive iteration counts', async () => {
    await expect(testCachePerformance('0')).rejects.toThrow('Iterations must be a positive number');
    await expect(testCachePerformance('abc')).rejects.toThrow('Iterations must be a positive number');
  });

  it('runs the harness, reports hits/misses and prints the gain', async () => {
    vi.useFakeTimers();
    const m = manager();
    // Miss on the first iteration, hit afterwards (repeat args every 10 calls).
    let call = 0;
    m.executeWithCache = vi.fn(async () => {
      call++;
      return { hit: call > 1, value: `r${call}`, executionTime: 1, source: call > 1 ? 'cache' : 'execution' };
    });

    const pending = testCachePerformance('4');
    // The mock executor sleeps 50-150ms per miss — advance until resolved.
    await vi.runAllTimersAsync();
    const json = await pending;

    expect(m.executeWithCache).toHaveBeenCalledTimes(4);
    expect(m.executeWithCache).toHaveBeenCalledWith(
      'test-command',
      { iteration: 0 },
      { flag: true },
      expect.objectContaining({ command: { name: 'test-command' } }),
      expect.any(Function)
    );

    const text = output();
    expect(text).toContain('Testing Cache Performance (4 iterations)');
    expect(text).toContain('Performance test completed');
    expect(text).toContain('Total iterations: 4');
    expect(text).toContain('Cache hits: 3');
    expect(text).toContain('Cache misses: 1');
    expect(text).toContain('Hit rate: 75.0%');
    expect(text).toContain('Performance gain:');
    expect(json).toBeUndefined();
  });

  it('emits a JSON envelope in json mode', async () => {
    vi.useFakeTimers();
    const m = manager();
    m.executeWithCache = vi.fn(async () => ({ hit: true, value: 'x', executionTime: 1, source: 'cache' }));

    const pending = testCachePerformance('2', { json: true });
    await vi.runAllTimersAsync();
    await pending;

    // The header banner logs before the payload — parse the final logged line.
    const payload = JSON.parse(logSpy.mock.calls.at(-1)![0] as string);
    expect(payload.totalIterations).toBe(2);
    expect(payload.hitCount).toBe(2);
    expect(payload.hitRate).toBe(1);
    expect(typeof payload.averageExecutionTime).toBe('number');
    expect(payload.performanceGain).toBe(0); // no misses → gain guard
  });

  it('adds statistics and recommendations in verbose mode', async () => {
    vi.useFakeTimers();
    const m = manager();
    m.executeWithCache = vi.fn(async () => ({ hit: true, value: 'x', executionTime: 1, source: 'cache' }));

    const pending = testCachePerformance('2', { verbose: true });
    await vi.runAllTimersAsync();
    await pending;

    const text = output();
    expect(text).toContain('Cache Statistics:');
    expect(text).toContain('Cache size: 10 entries');
    expect(text).toContain('Recommendations:');
    // hitRate 1 → not the low-hit-rate branch; gain 0 → moderate-gain note
    expect(text).toContain('Moderate performance gain');
  });
});

describe('optimizeCache', () => {
  it('prints a dry-run notice without --force when recommendations exist', async () => {
    const m = manager();
    m.stats.hitRate = 0.2; // low hit rate → actionable recommendation
    await optimizeCache();
    expect(output()).toContain('Use --force to apply these optimizations automatically');
  });

  it('reports an optimally configured cache when no triggers fire', async () => {
    manager(); // hitRate 0.75, low memory, small size, low error rate
    await optimizeCache({ force: true });
    expect(output()).toContain('Cache is already optimally configured');
  });

  it('recommends doubling the TTL when the hit rate is low', async () => {
    const m = manager();
    m.stats.hitRate = 0.2;
    await optimizeCache();
    const text = output();
    expect(text).toContain('Low cache hit rate');
    expect(text).toContain('Increase default TTL');
    expect(text).toContain('Suggested: defaultTTL = 600000');
    expect(text).toContain('Use --force to apply these optimizations automatically');
  });

  it('recommends compression when memory pressure is high', async () => {
    const m = manager();
    m.stats.memoryUsage = m.config.maxMemoryUsage * 0.9;
    await optimizeCache();
    expect(output()).toContain('High memory usage');
    expect(output()).toContain('Suggested: compressionEnabled = true');
  });

  it('recommends a larger cache near capacity', async () => {
    const m = manager();
    m.stats.size = m.config.maxSize * 0.95;
    await optimizeCache();
    expect(output()).toContain('Cache near capacity');
    expect(output()).toContain('Suggested: maxSize = 1500');
  });

  it('recommends investigating when the error rate is high', async () => {
    const m = manager();
    m.metrics.errorRate = 0.2;
    await optimizeCache();
    expect(output()).toContain('High error rate');
    expect(output()).not.toContain('Suggested:'); // no setting change for this one
  });

  it('notes the benefit of caching for slow commands', async () => {
    const m = manager();
    m.metrics.averageExecutionTime = 6000;
    await optimizeCache();
    expect(output()).toContain('Slow command execution');
    expect(output()).toContain('caching provides significant benefit');
  });

  it('applies setting-backed recommendations with --force', async () => {
    const m = manager();
    m.stats.hitRate = 0.2; // one actionable rec: defaultTTL
    await optimizeCache({ force: true });
    expect(m.updateConfiguration).toHaveBeenCalledWith({ defaultTTL: m.config.defaultTTL * 2 });
    expect(output()).toContain('Applied 1 optimization(s)');
  });

  it('reports nothing to apply when recommendations carry no settings', async () => {
    const m = manager();
    m.metrics.errorRate = 0.2; // rec without a setting
    await optimizeCache({ force: true });
    expect(m.updateConfiguration).not.toHaveBeenCalled();
    expect(output()).toContain('No configuration changes to apply');
  });

  it('renders the updated configuration in verbose apply mode', async () => {
    const m = manager();
    m.stats.hitRate = 0.2;
    await optimizeCache({ force: true, verbose: true });
    expect(output()).toContain('Updated Configuration:');
    expect(output()).toContain('defaultTTL: 600000');
  });
});

describe('listCachedCommands', () => {
  it('renders the built-in entry catalogue with metadata', async () => {
    manager();
    await listCachedCommands();
    const text = output();
    expect(text).toContain('Cached Commands');
    expect(text).toContain('Cache Overview:');
    expect(text).toContain('Total entries: 10');
    expect(text).toContain('build');
    expect(text).toContain('{"target":"production"}');
    expect(text).toContain('Access count: 5');
    expect(text).toContain('Last accessed: 1m ago');
  });

  it('shows keys and creation dates in verbose mode', async () => {
    manager();
    await listCachedCommands({ verbose: true });
    const text = output();
    expect(text).toContain('Key: abc123');
    expect(text).toContain('Created:');
  });

  it('emits the raw entry array in json mode', async () => {
    manager();
    await listCachedCommands({ json: true });
    const payload = JSON.parse(output());
    expect(payload).toHaveLength(2);
    expect(payload[0].command).toBe('build');
    expect(payload[1].command).toBe('test');
  });

  it('wraps failures in a ValidationError', async () => {
    const m = manager();
    m.getCacheStats = () => { throw new Error('nope'); };
    await expect(listCachedCommands()).rejects.toThrow('Failed to list cached commands: nope');
  });
});
