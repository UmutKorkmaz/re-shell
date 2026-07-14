/**
 * @file Async concurrency utilities including a bounded pool, mutex-like lock,
 * debouncing, and retry-with-backoff helpers used across the CLI.
 */

/**
 * Async pool utility for controlled concurrency.
 * Queues asynchronous tasks and runs at most `concurrency` of them simultaneously.
 */
export class AsyncPool {
  private running = 0;
  private queue: Array<() => Promise<unknown>> = [];

  /**
   * Creates a new AsyncPool instance.
   *
   * @description Initializes the pool with a maximum number of concurrently running tasks.
   * @param concurrency - Maximum number of tasks allowed to run at the same time. Defaults to 3.
   */
  constructor(private concurrency: number = 3) {}

  /**
   * Adds a task to the pool.
   *
   * @description Enqueues an async function for execution. If fewer than `concurrency`
   * tasks are currently running, execution starts immediately; otherwise the task waits
   * in the queue until a slot frees up.
   * @param fn - The asynchronous function to execute.
   * @returns A promise that resolves (or rejects) with the result of `fn` once it runs.
   */
  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const task = this.queue.shift()!;
    
    try {
      await task();
    } finally {
      this.running--;
      this.process();
    }
  }

  /**
   * Waits for all queued and running tasks to complete.
   *
   * @description Blocks until the pool has no running tasks and an empty queue.
   * @returns A promise that resolves once every enqueued task has finished.
   */
  async waitForAll(): Promise<void> {
    while (this.running > 0 || this.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}

/**
 * Mutex-like lock for serializing access to shared resources (e.g. file operations).
 * Locks are keyed by a string and only one caller per key holds the lock at a time.
 */
export class OperationLock {
  private static queues = new Map<string, Array<() => void>>();
  private static locked = new Set<string>();

  /**
   * Acquires the lock for the given key, waiting if necessary.
   *
   * @description If the lock for `key` is free it is granted immediately; otherwise the
   * caller waits until previous holders release it. The returned release function must be
   * called when the protected work is done so the next waiter (or the lock cleanup) proceeds.
   * @param key - Identifier of the lock to acquire.
   * @returns A promise resolving to a release function that frees the lock for `key`.
   */
  static async acquire(key: string): Promise<() => void> {
    if (!this.locked.has(key)) {
      this.locked.add(key);
      return () => {
        const queue = this.queues.get(key);
        if (queue && queue.length > 0) {
          const next = queue.shift()!;
          next();
        } else {
          this.locked.delete(key);
        }
      };
    }

    return new Promise<() => void>(resolve => {
      if (!this.queues.has(key)) {
        this.queues.set(key, []);
      }
      this.queues.get(key)!.push(() => {
        resolve(() => {
          const queue = this.queues.get(key);
          if (queue && queue.length > 0) {
            const next = queue.shift()!;
            next();
          } else {
            this.locked.delete(key);
          }
        });
      });
    });
  }
}

/**
 * Debounced async function wrapper.
 *
 * @description Returns a debounced version of an async function. Successive calls within
 * the delay window cancel previous pending executions; only the most recent call runs.
 * Superseded pending calls are rejected with an `Error('Debounced')`.
 * @param fn - The asynchronous function to debounce.
 * @param delay - Minimum time in milliseconds between invocations.
 * @returns A debounced function with the same signature as `fn`.
 */
export function debounceAsync<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  delay: number
): (...args: T) => Promise<R> {
  let timeoutId: NodeJS.Timeout;
  let latestResolve: (value: R) => void;
  let latestReject: (error: any) => void;

  return (...args: T): Promise<R> => {
    return new Promise((resolve, reject) => {
      if (latestReject) latestReject(new Error('Debounced'));

      latestResolve = resolve;
      latestReject = reject;

      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          latestResolve(result);
        } catch (error) {
          latestReject(error);
        }
      }, delay);
    });
  };
}

/**
 * Retries an async function with exponential backoff.
 *
 * @description Invokes `fn` up to `maxRetries + 1` times. On each failure the wait
 * doubles (starting from `initialDelay`) up to `maxDelay`. If all attempts fail, the
 * last error is thrown.
 * @param fn - The asynchronous function to execute.
 * @param maxRetries - Maximum number of retry attempts after the initial call. Defaults to 3.
 * @param initialDelay - Delay in milliseconds before the first retry. Defaults to 1000.
 * @param maxDelay - Upper bound in milliseconds for any single backoff delay. Defaults to 10000.
 * @returns A promise resolving to the result of a successful `fn` invocation.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000,
  maxDelay = 10000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}