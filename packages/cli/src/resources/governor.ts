/**
 * Resource governor: one admission decision combining the memory monitor
 * (backpressure) and the token-bucket rate limiter. Concurrency paths ask
 * `admit(inFlight)` before starting each unit of work.
 *
 * Liveness guarantee: memory pressure never blocks intake while NOTHING is in
 * flight, otherwise a process that is already over its limit before the first
 * task starts (or whose own heap is the problem) would wait forever.
 */
import * as os from 'os';
import { MemoryMonitor, type MemoryMonitorOptions } from './memory-monitor';
import { TokenBucket, type TokenBucketOptions } from './token-bucket';

/**
 * Outcome of {@link ResourceGovernor.admit}. When `ok` is false the other fields
 * are set. (A flat shape rather than a discriminated union keeps narrowing
 * working under this package's non-strict tsconfig.)
 */
export interface AdmitDecision {
  ok: boolean;
  reason?: 'rate' | 'memory';
  /** Milliseconds after which the caller should ask again. */
  retryAfterMs?: number;
  detail?: string;
}

export interface GovernorOptions {
  /** Start-rate limit. `burst` defaults to max(1, ceil(perSecond)). */
  rate?: { perSecond: number; burst?: number; now?: () => number } | TokenBucket;
  /** Memory thresholds, or a ready-made monitor. */
  memory?: MemoryMonitorOptions | MemoryMonitor;
}

export interface GovernorStats {
  admitted: number;
  throttledByRate: number;
  pausedByMemory: number;
}

export class ResourceGovernor {
  readonly bucket: TokenBucket | undefined;
  readonly memory: MemoryMonitor | undefined;
  readonly stats: GovernorStats = { admitted: 0, throttledByRate: 0, pausedByMemory: 0 };

  constructor(options: GovernorOptions = {}) {
    const rate = options.rate;
    if (rate instanceof TokenBucket) {
      this.bucket = rate;
    } else if (rate) {
      const opts: TokenBucketOptions = {
        capacity: rate.burst ?? Math.max(1, Math.ceil(rate.perSecond)),
        refillPerSecond: rate.perSecond,
        now: rate.now,
      };
      this.bucket = new TokenBucket(opts);
    }
    const mem = options.memory;
    if (mem instanceof MemoryMonitor) this.memory = mem;
    else if (mem) {
      const monitor = new MemoryMonitor(mem);
      this.memory = monitor.enabled ? monitor : undefined;
    }
  }

  /** True when the governor can ever delay work. */
  get active(): boolean {
    return Boolean(this.bucket || this.memory);
  }

  /**
   * Decide whether one more unit of work may start now. On `ok: true` a rate
   * token has been consumed; on `ok: false` nothing was consumed and the caller
   * should retry after `retryAfterMs`.
   */
  admit(inFlight: number): AdmitDecision {
    if (this.memory && inFlight > 0) {
      const status = this.memory.check();
      if (status.paused) {
        this.stats.pausedByMemory += 1;
        return { ok: false, reason: 'memory', retryAfterMs: this.memory.pollMs, detail: status.reason ?? 'memory pressure' };
      }
    } else if (this.memory) {
      // Nothing in flight: keep the monitor's state fresh but never block.
      this.memory.check();
    }
    if (this.bucket) {
      if (!this.bucket.tryRemove(1)) {
        this.stats.throttledByRate += 1;
        return { ok: false, reason: 'rate', retryAfterMs: Math.max(1, this.bucket.msUntilAvailable(1)), detail: 'rate limit' };
      }
    }
    this.stats.admitted += 1;
    return { ok: true };
  }
}

const MB = 1024 * 1024;

export interface ResourceFlags {
  concurrency?: unknown;
  maxMemory?: unknown;
  rateLimit?: unknown;
}

export class ResourceOptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResourceOptionError';
  }
}

function positiveNumber(name: string, raw: unknown, integer: boolean): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0 || (integer && !Number.isInteger(n))) {
    throw new ResourceOptionError(`${name} must be a positive ${integer ? 'integer' : 'number'} (got "${String(raw)}")`);
  }
  return n;
}

/**
 * Parse the shared CLI resource flags. Invalid values are an explicit error,
 * never silently replaced by a default.
 *
 *   --concurrency <n>       max parallel units of work
 *   --max-memory <mb>       pause new work while process RSS exceeds <mb> MB, or
 *                           system free memory drops below a 5% / 256MB floor
 *   --rate-limit <n>        start at most <n> units of work per second
 */
export function parseResourceFlags(flags: ResourceFlags): {
  concurrency?: number;
  governor?: ResourceGovernor;
} {
  const concurrency = positiveNumber('--concurrency', flags.concurrency, true);
  const maxMemoryMb = positiveNumber('--max-memory', flags.maxMemory, false);
  const rate = positiveNumber('--rate-limit', flags.rateLimit, false);
  if (maxMemoryMb === undefined && rate === undefined) return { concurrency };

  const governor = new ResourceGovernor({
    rate: rate !== undefined ? { perSecond: rate } : undefined,
    memory:
      maxMemoryMb !== undefined
        ? {
            maxRssBytes: maxMemoryMb * MB,
            minFreeBytes: Math.min(256 * MB, Math.floor(os.totalmem() * 0.05)),
          }
        : undefined,
  });
  return { concurrency, governor };
}
