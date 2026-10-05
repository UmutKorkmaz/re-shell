/**
 * Token-bucket rate limiter.
 *
 * Holds up to `capacity` tokens and refills continuously at `refillPerSecond`.
 * Time is read through an injectable clock and waiting uses `setTimeout`, so
 * behaviour is fully deterministic under fake timers.
 */
export interface TokenBucketOptions {
  /** Maximum burst size (tokens the bucket can hold). */
  capacity: number;
  /** Tokens added per second. */
  refillPerSecond: number;
  /** Tokens present at construction. Defaults to `capacity`. */
  initialTokens?: number;
  /** Clock in milliseconds. Defaults to Date.now. */
  now?: () => number;
}

interface Waiter {
  tokens: number;
  resolve: () => void;
}

export class TokenBucket {
  readonly capacity: number;
  readonly refillPerSecond: number;
  private tokens: number;
  private lastRefill: number;
  private readonly now: () => number;
  private readonly waiters: Waiter[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: TokenBucketOptions) {
    if (!(options.capacity >= 1)) throw new RangeError('TokenBucket capacity must be >= 1');
    if (!(options.refillPerSecond > 0)) throw new RangeError('TokenBucket refillPerSecond must be > 0');
    this.capacity = options.capacity;
    this.refillPerSecond = options.refillPerSecond;
    this.now = options.now ?? Date.now;
    this.tokens = Math.min(options.initialTokens ?? options.capacity, options.capacity);
    this.lastRefill = this.now();
  }

  private refill(): void {
    const t = this.now();
    const elapsed = t - this.lastRefill;
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + (elapsed / 1000) * this.refillPerSecond);
      this.lastRefill = t;
    }
  }

  /** Tokens currently available (after refill). */
  available(): number {
    this.refill();
    return this.tokens;
  }

  /** Take `n` tokens if available right now. Never waits and never overtakes queued waiters. */
  tryRemove(n = 1): boolean {
    if (n > this.capacity) throw new RangeError(`cannot take ${n} tokens from a bucket of capacity ${this.capacity}`);
    if (this.waiters.length > 0) return false; // FIFO fairness: waiters go first
    this.refill();
    if (this.tokens + 1e-9 >= n) {
      this.tokens = Math.max(0, this.tokens - n);
      return true;
    }
    return false;
  }

  /** Milliseconds until `n` tokens will be available (0 when available now). */
  msUntilAvailable(n = 1): number {
    this.refill();
    const missing = n - this.tokens;
    return missing <= 1e-9 ? 0 : Math.ceil((missing / this.refillPerSecond) * 1000);
  }

  /** Wait (FIFO) until `n` tokens can be taken, then take them. */
  acquire(n = 1): Promise<void> {
    if (n > this.capacity) return Promise.reject(new RangeError(`cannot acquire ${n} tokens from a bucket of capacity ${this.capacity}`));
    return new Promise<void>(resolve => {
      this.waiters.push({ tokens: n, resolve });
      this.drain();
    });
  }

  /** Number of callers currently waiting in `acquire`. */
  get waiting(): number {
    return this.waiters.length;
  }

  private drain(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.refill();
    while (this.waiters.length > 0 && this.tokens + 1e-9 >= this.waiters[0].tokens) {
      const w = this.waiters.shift()!;
      this.tokens = Math.max(0, this.tokens - w.tokens);
      w.resolve();
    }
    if (this.waiters.length > 0) {
      const wait = Math.max(1, this.msUntilAvailableFor(this.waiters[0].tokens));
      this.timer = setTimeout(() => {
        this.timer = null;
        this.drain();
      }, wait);
    }
  }

  private msUntilAvailableFor(n: number): number {
    const missing = n - this.tokens;
    return missing <= 1e-9 ? 0 : Math.ceil((missing / this.refillPerSecond) * 1000);
  }
}
