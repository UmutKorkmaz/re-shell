import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AsyncPool, OperationLock, debounceAsync, retryWithBackoff } from '../../src/utils/async-pool';

describe('AsyncPool', () => {
  it('should run tasks and return results', async () => {
    const pool = new AsyncPool(2);
    const results: number[] = [];

    await Promise.all([
      pool.add(async () => { results.push(1); return 1; }),
      pool.add(async () => { results.push(2); return 2; }),
    ]);

    expect(results).toHaveLength(2);
    expect(results).toContain(1);
    expect(results).toContain(2);
  });

  it('should respect concurrency limit', async () => {
    const pool = new AsyncPool(2);
    let concurrent = 0;
    let maxConcurrent = 0;

    const tasks = Array.from({ length: 6 }, () =>
      pool.add(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise(r => setTimeout(r, 20));
        concurrent--;
      })
    );

    await Promise.all(tasks);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('should handle task errors', async () => {
    const pool = new AsyncPool(1);

    await expect(
      pool.add(async () => { throw new Error('task failed'); })
    ).rejects.toThrow('task failed');
  });

  it('should process tasks sequentially with concurrency 1', async () => {
    const pool = new AsyncPool(1);
    const order: number[] = [];

    const tasks = [1, 2, 3].map(i =>
      pool.add(async () => {
        order.push(i);
        await new Promise(r => setTimeout(r, 10));
      })
    );

    await Promise.all(tasks);
    expect(order).toEqual([1, 2, 3]);
  });

  it('should wait for all tasks to complete via waitForAll', async () => {
    const pool = new AsyncPool(2);
    let completed = 0;

    pool.add(async () => { await new Promise(r => setTimeout(r, 30)); completed++; });
    pool.add(async () => { await new Promise(r => setTimeout(r, 30)); completed++; });

    await pool.waitForAll();
    expect(completed).toBe(2);
  });
});

describe('OperationLock', () => {
  beforeEach(() => {
    // Reset static state between tests
    (OperationLock as any).queues = new Map();
    (OperationLock as any).locked = new Set();
  });

  afterEach(() => {
    (OperationLock as any).queues = new Map();
    (OperationLock as any).locked = new Set();
  });

  it('should acquire and release a lock', async () => {
    const release = await OperationLock.acquire('test-key');
    expect(typeof release).toBe('function');
    release();
    // Should be able to acquire again
    const release2 = await OperationLock.acquire('test-key');
    release2();
  });

  it('should serialize access for same key', async () => {
    const order: string[] = [];

    async function task(name: string, delay: number) {
      const release = await OperationLock.acquire('shared');
      order.push(`${name}-start`);
      await new Promise(r => setTimeout(r, delay));
      order.push(`${name}-end`);
      release();
    }

    await Promise.all([task('A', 20), task('B', 10)]);

    // A should complete before B starts
    expect(order).toEqual(['A-start', 'A-end', 'B-start', 'B-end']);
  });

  it('should allow concurrent access for different keys', async () => {
    const order: string[] = [];

    async function task(key: string, name: string) {
      const release = await OperationLock.acquire(key);
      order.push(`${name}-start`);
      await new Promise(r => setTimeout(r, 20));
      order.push(`${name}-end`);
      release();
    }

    await Promise.all([task('key1', 'A'), task('key2', 'B')]);

    // Both should start concurrently
    expect(order).toContain('A-start');
    expect(order).toContain('B-start');
    // A-start should come before A-end
    expect(order.indexOf('A-start')).toBeLessThan(order.indexOf('A-end'));
    expect(order.indexOf('B-start')).toBeLessThan(order.indexOf('B-end'));
  });
});

describe('debounceAsync', () => {
  it('should debounce rapid calls and only execute the last', async () => {
    const mockFn = vi.fn().mockImplementation(async (val: number) => val * 2);
    const debounced = debounceAsync(mockFn, 30);

    // Fire 3 calls rapidly; first two should be superseded
    const p1 = debounced(1);
    const p2 = debounced(2);

    // p1 should be rejected because p2 supersedes it
    await expect(p1).rejects.toThrow('Debounced');

    // Wait a tiny bit before the last call
    await new Promise(r => setTimeout(r, 5));
    const p3 = debounced(3);

    // p2 should be rejected because p3 supersedes it
    await expect(p2).rejects.toThrow('Debounced');

    // p3 should succeed
    const result = await p3;
    expect(result).toBe(6);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith(3);
  });

  it('should execute function after delay', async () => {
    const mockFn = vi.fn().mockResolvedValue('done');
    const debounced = debounceAsync(mockFn, 20);

    const result = await debounced();
    expect(result).toBe('done');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});

describe('retryWithBackoff', () => {
  it('should succeed on first attempt', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(mockFn, 3, 10, 50);

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    let attempts = 0;
    const mockFn = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts < 3) throw new Error('transient');
      return 'success';
    });

    const result = await retryWithBackoff(mockFn, 3, 10, 50);

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should throw after exhausting retries', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('permanent failure'));

    await expect(retryWithBackoff(mockFn, 2, 10, 50)).rejects.toThrow('permanent failure');
    expect(mockFn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('should use exponential backoff delays', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValueOnce('ok');

    const startTimes: number[] = [];
    let callCount = 0;
    const wrappedFn = async () => {
      startTimes.push(Date.now());
      callCount++;
      return mockFn();
    };

    await retryWithBackoff(wrappedFn, 3, 50, 200);

    // Should have made 3 calls
    expect(callCount).toBe(3);

    // Delays between calls should be roughly: 50ms, 100ms (exponential)
    const delay1 = startTimes[1] - startTimes[0];
    const delay2 = startTimes[2] - startTimes[1];

    expect(delay1).toBeGreaterThanOrEqual(40); // ~50ms
    expect(delay2).toBeGreaterThanOrEqual(80); // ~100ms
  });

  it('should cap delay at maxDelay', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');

    const start = Date.now();
    await retryWithBackoff(mockFn, 3, 1000, 50);
    const elapsed = Date.now() - start;

    // Even though initialDelay is 1000, maxDelay is 50, so first retry waits ~50ms
    expect(elapsed).toBeLessThan(200);
  });
});
