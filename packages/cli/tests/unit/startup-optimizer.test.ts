import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Covers src/startup-optimizer.ts — tiny startup helpers: performance marks,
// deferred execution, a size-capped FIFO cache, and a fast --version check.

const { mark, defer, getFromCache, setCache, isVersionRequest } = await import(
  '../../src/startup-optimizer'
);

describe('startup-optimizer', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('mark', () => {
    it('records marks without throwing and accepts repeats', () => {
      expect(() => {
        mark('cli:start');
        mark('cli:start');
        mark('groups:registered');
      }).not.toThrow();
    });
  });

  describe('defer', () => {
    it('runs the callback asynchronously on the next tick', async () => {
      vi.useFakeTimers();
      const fn = vi.fn().mockResolvedValue(undefined);

      defer(fn);
      expect(fn).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache', () => {
    it('stores and retrieves values with type passthrough', () => {
      setCache('string', 'value');
      setCache('number', 42);
      setCache('object', { nested: true });

      expect(getFromCache<string>('string')).toBe('value');
      expect(getFromCache<number>('number')).toBe(42);
      expect(getFromCache<{ nested: boolean }>('object')).toEqual({ nested: true });
    });

    it('returns undefined for missing keys', () => {
      expect(getFromCache('never-set')).toBeUndefined();
    });

    it('overwrites existing keys', () => {
      setCache('key', 'first');
      setCache('key', 'second');

      expect(getFromCache('key')).toBe('second');
    });

    it('evicts the oldest entry once the cache exceeds 100 items', () => {
      // Fill to exactly 100 — nothing evicted yet.
      for (let i = 0; i < 100; i++) {
        setCache(`k${i}`, i);
      }
      expect(getFromCache('k0')).toBe(0);

      // The 101st insert still fits...
      setCache('k100', 100);
      expect(getFromCache('k0')).toBe(0);
      expect(getFromCache('k100')).toBe(100);

      // ...the 102nd evicts the oldest (k0) but keeps k1.
      setCache('k101', 101);
      expect(getFromCache('k0')).toBeUndefined();
      expect(getFromCache('k1')).toBe(1);
      expect(getFromCache('k100')).toBe(100);
      expect(getFromCache('k101')).toBe(101);
    });
  });

  describe('isVersionRequest', () => {
    function withArgv(argv: string[]) {
      vi.spyOn(process, 'argv', 'get').mockReturnValue(['/node', '/re-shell', ...argv]);
    }

    it('accepts every version flag as the sole argument', () => {
      for (const flag of ['--version', '-v', '-V']) {
        withArgv([flag]);
        expect(isVersionRequest()).toBe(true);
      }
    });

    it('rejects additional arguments', () => {
      withArgv(['--version', 'extra']);
      expect(isVersionRequest()).toBe(false);
    });

    it('rejects other single commands and empty argv', () => {
      withArgv(['build']);
      expect(isVersionRequest()).toBe(false);

      withArgv([]);
      expect(isVersionRequest()).toBe(false);
    });
  });
});
