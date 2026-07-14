import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import {
  ValidationError,
  processManager,
  withTimeout,
} from '../../src/utils/error-handler';

describe('ValidationError', () => {
  it('should create an error with message', () => {
    const err = new ValidationError('something went wrong');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('something went wrong');
    expect(err.name).toBe('ValidationError');
  });

  it('should store optional field', () => {
    const err = new ValidationError('bad input', 'username');
    expect(err.field).toBe('username');
  });

  it('should have undefined field when not provided', () => {
    const err = new ValidationError('no field');
    expect(err.field).toBeUndefined();
  });
});

describe('processManager', () => {
  afterEach(() => {
    processManager.cleanup();
  });

  it('should run cleanup functions on cleanup()', () => {
    let called = false;
    processManager.addCleanup(() => {
      called = true;
    });
    processManager.cleanup();
    expect(called).toBe(true);
  });

  it('should clear cleanup functions after cleanup()', () => {
    let callCount = 0;
    processManager.addCleanup(() => {
      callCount++;
    });
    processManager.cleanup();
    processManager.cleanup();
    expect(callCount).toBe(1);
  });

  it('should handle errors in cleanup functions gracefully', () => {
    processManager.addCleanup(() => {
      throw new Error('cleanup error');
    });
    expect(() => processManager.cleanup()).not.toThrow();
  });

  it('should track keepRunning state', () => {
    expect(processManager.shouldKeepRunning()).toBe(false);
    processManager.keepRunning();
    expect(processManager.shouldKeepRunning()).toBe(true);
  });
});

describe('withTimeout', () => {
  it('should resolve when fn completes within timeout', async () => {
    const result = await withTimeout(
      async () => 'success',
      1000,
    );
    expect(result).toBe('success');
  });

  it('should reject when fn takes too long', async () => {
    await expect(
      withTimeout(
        () => new Promise<string>((resolve) => setTimeout(() => resolve('late'), 200)),
        50,
      ),
    ).rejects.toThrow('timed out');
  });

  it('should use custom error message', async () => {
    await expect(
      withTimeout(
        () => new Promise<string>((resolve) => setTimeout(() => resolve('late'), 200)),
        50,
        'Custom timeout',
      ),
    ).rejects.toThrow('Custom timeout');
  });

  it('should propagate fn errors', async () => {
    await expect(
      withTimeout(
        async () => { throw new Error('fn error'); },
        1000,
      ),
    ).rejects.toThrow('fn error');
  });

  it('should resolve with complex return types', async () => {
    const result = await withTimeout(
      async () => ({ a: 1, b: [2, 3] }),
      1000,
    );
    expect(result).toEqual({ a: 1, b: [2, 3] });
  });
});
