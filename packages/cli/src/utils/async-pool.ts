// Async pool utility for controlled concurrency
export class AsyncPool {
  private running = 0;
  private queue: Array<() => Promise<any>> = [];

  constructor(private concurrency: number = 3) {}

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

  async waitForAll(): Promise<void> {
    while (this.running > 0 || this.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}

// Mutex-like lock for file operations
export class OperationLock {
  private static queues = new Map<string, Array<() => void>>();
  private static locked = new Set<string>();

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

// Debounced async function
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

// Retry with exponential backoff
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