// Retry with exponential backoff and jitter.

/** Backoff policy. */
export interface RetryPolicy {
  /** Total attempts including the first (default 3). */
  maxAttempts?: number;
  /** Delay before the 2nd attempt (default 100 ms). */
  baseDelayMs?: number;
  /** Upper bound of any single delay (default 5_000 ms). */
  maxDelayMs?: number;
  /** Growth factor per attempt (default 2). */
  factor?: number;
  /** `full` = uniform in [0, delay] (default), `none` = exact delay. */
  jitter?: 'full' | 'none';
  /** Return false to stop retrying for this error (default: retry everything). */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Called before each retry sleep. */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  /** Injectable sleep / random for tests. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

/** Thrown (wrapping the last error as `cause`) when every attempt failed. */
export class RetryExhaustedError extends Error {
  constructor(readonly attempts: number, readonly cause: unknown) {
    super(`gave up after ${attempts} attempt(s): ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'RetryExhaustedError';
  }
}

/** The delay (ms) before retry number `attempt` (1 = before the 2nd try). */
export function backoffDelay(attempt: number, policy: RetryPolicy = {}): number {
  const base = policy.baseDelayMs ?? 100;
  const factor = policy.factor ?? 2;
  const max = policy.maxDelayMs ?? 5_000;
  const raw = Math.min(max, base * Math.pow(factor, attempt - 1));
  return (policy.jitter ?? 'full') === 'none' ? raw : Math.floor((policy.random ?? Math.random)() * raw);
}

const defaultSleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Run `fn`, retrying failures per `policy`.
 * @throws RetryExhaustedError after the last attempt (or the original error when `shouldRetry` says stop).
 */
export async function retry<T>(fn: (attempt: number) => Promise<T>, policy: RetryPolicy = {}): Promise<T> {
  const maxAttempts = policy.maxAttempts ?? 3;
  const sleep = policy.sleep ?? defaultSleep;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (policy.shouldRetry && !policy.shouldRetry(error, attempt)) throw error;
      if (attempt === maxAttempts) break;
      const delay = backoffDelay(attempt, policy);
      policy.onRetry?.(error, attempt, delay);
      await sleep(delay);
    }
  }
  throw new RetryExhaustedError(maxAttempts, lastError);
}
