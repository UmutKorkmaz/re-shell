import { describe, expect, it } from 'vitest';
import {
  FileWatcher,
  getPlatformCapabilities,
} from '../../src/utils/file-watcher';

describe('FileWatcher', () => {
  it('constructs with a root path', () => {
    const watcher = new FileWatcher('/tmp');
    expect(watcher).toBeDefined();
  });

  it('returns stats with expected fields', () => {
    const watcher = new FileWatcher('/tmp');
    const stats = watcher.getStats();
    expect(stats).toBeDefined();
    expect(typeof stats.activeWatchers).toBe('number');
    expect(Array.isArray(stats.watchedPaths)).toBe(true);
  });

  it('can stop watching without starting', async () => {
    const watcher = new FileWatcher('/tmp');
    await expect(watcher.stopWatching()).resolves.toBeUndefined();
  });
});

describe('getPlatformCapabilities', () => {
  it('returns platform capabilities object', () => {
    const caps = getPlatformCapabilities();
    expect(caps).toBeDefined();
    expect(typeof caps.platform).toBe('string');
  });
});
