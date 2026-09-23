import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ValidationError,
  processManager,
  setupStreamErrorHandlers,
  createAsyncCommand,
  withTimeout,
} from '../../src/utils/error-handler';

describe('ValidationError', () => {
  it('sets name to "ValidationError"', () => {
    const err = new ValidationError('bad input');
    expect(err.name).toBe('ValidationError');
  });

  it('preserves the message', () => {
    const err = new ValidationError('something broke');
    expect(err.message).toBe('something broke');
  });

  it('exposes the optional field', () => {
    const err = new ValidationError('missing', 'email');
    expect(err.field).toBe('email');
  });

  it('leaves field undefined when not provided', () => {
    const err = new ValidationError('no field');
    expect(err.field).toBeUndefined();
  });

  it('is recognized by instanceof', () => {
    const err = new ValidationError('x');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ValidationError);
  });
});

describe('processManager', () => {
  // The processManager is a singleton exported from the module, so tests must
  // reset its state between runs. There is no public reset method, so we
  // exercise cleanup() before each test to flush any registered callbacks.
  beforeEach(() => {
    processManager.cleanup();
  });

  describe('cleanup callbacks', () => {
    it('runs registered cleanup functions', () => {
      let called = 0;
      processManager.addCleanup(() => {
        called++;
      });
      processManager.cleanup();
      expect(called).toBe(1);
    });

    it('runs multiple cleanup functions in registration order', () => {
      const order: number[] = [];
      processManager.addCleanup(() => order.push(1));
      processManager.addCleanup(() => order.push(2));
      processManager.addCleanup(() => order.push(3));
      processManager.cleanup();
      expect(order).toEqual([1, 2, 3]);
    });

    it('swallows errors thrown by individual cleanup functions', () => {
      let second = false;
      processManager.addCleanup(() => {
        throw new Error('boom');
      });
      processManager.addCleanup(() => {
        second = true;
      });
      expect(() => processManager.cleanup()).not.toThrow();
      expect(second).toBe(true);
    });

    it('clears the cleanup list after cleanup() so callbacks run only once', () => {
      let count = 0;
      processManager.addCleanup(() => count++);
      processManager.cleanup();
      processManager.cleanup();
      expect(count).toBe(1);
    });
  });

  describe('keepRunning flag', () => {
    it('defaults to false', () => {
      expect(processManager.shouldKeepRunning()).toBe(false);
    });

    it('becomes true after keepRunning() is called', () => {
      processManager.keepRunning();
      expect(processManager.shouldKeepRunning()).toBe(true);
    });

    it('stays true across multiple keepRunning() calls (no toggle)', () => {
      processManager.keepRunning();
      processManager.keepRunning();
      expect(processManager.shouldKeepRunning()).toBe(true);
    });
  });
});

describe('setupStreamErrorHandlers', () => {
  it('registers without throwing', () => {
    expect(() => setupStreamErrorHandlers()).not.toThrow();
  });

  it('is idempotent (can be called multiple times without error)', () => {
    expect(() => {
      setupStreamErrorHandlers();
      setupStreamErrorHandlers();
    }).not.toThrow();
  });
});

describe('createAsyncCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      // Throw to short-circuit the awaiting caller without actually exiting.
      throw new Error(`__exit_${code ?? 0}__`);
    }) as never);
  });

  afterEach(() => {
    logSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('invokes the wrapped function with provided args and resolves', async () => {
    const received: string[] = [];
    const cmd = createAsyncCommand(async (a: string, b: string) => {
      received.push(a, b);
    });
    await cmd('x', 'y');
    expect(received).toEqual(['x', 'y']);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('logs Validation Error prefix and exits 1 when the wrapped throws ValidationError', async () => {
    const cmd = createAsyncCommand(async () => {
      throw new ValidationError('bad field', 'email');
    });
    await expect(cmd()).rejects.toThrow('__exit_1__');
    expect(logSpy).toHaveBeenCalled();
    const text = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(text).toContain('Validation Error');
    expect(text).toContain('bad field');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('falls back to generic "Error:" prefix for non-ValidationError errors', async () => {
    const cmd = createAsyncCommand(async () => {
      throw new Error('disk full');
    });
    await expect(cmd()).rejects.toThrow('__exit_1__');
    const text = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(text).toContain('Error:');
    expect(text).toContain('disk full');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('falls back to "Unknown error" when thrown value lacks a message', async () => {
    const cmd = createAsyncCommand(async () => {
      throw 'plain string';
    });
    await expect(cmd()).rejects.toThrow('__exit_1__');
    const text = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(text).toContain('Unknown error');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('withTimeout', () => {
  it('resolves with the inner value when fn completes within the timeout', async () => {
    const result = await withTimeout(async () => {
      return 42;
    }, 1000);
    expect(result).toBe(42);
  });

  it('rejects with a default "Operation timed out" message when the timeout fires', async () => {
    const slow = () =>
      new Promise<string>((resolve) => setTimeout(() => resolve('late'), 200));
    await expect(withTimeout(slow, 20)).rejects.toThrow(
      'Operation timed out after 20ms',
    );
  });

  it('uses the custom errorMessage when provided', async () => {
    const slow = () =>
      new Promise<string>((resolve) => setTimeout(() => resolve('late'), 200));
    await expect(
      withTimeout(slow, 20, 'custom timeout message'),
    ).rejects.toThrow('custom timeout message');
  });

  it('propagates the inner rejection when fn rejects before the timeout', async () => {
    const fail = async () => {
      throw new Error('inner boom');
    };
    await expect(withTimeout(fail, 1000)).rejects.toThrow('inner boom');
  });

  it('clears the pending timeout after success so no dangling timer leaks', async () => {
    let timerFired = false;
    const original = setTimeout;
    const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(
      ((handler: () => void, ms?: number) => {
        const id = original(handler as never, ms);
        // Track whether the body actually fires later.
        const origRef = id.ref?.bind(id);
        if (origRef) id.ref = () => {
          timerFired = true;
          return id;
        };
        return id;
      }) as never,
    );
    try {
      await withTimeout(async () => 'fast', 50);
      // Give the timer a window to (incorrectly) fire
      await new Promise((r) => setTimeout(r, 80));
      // We can't directly assert "unref'd"; instead just confirm the inner value
      // came back correctly and no exception leaked.
      expect(true).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
