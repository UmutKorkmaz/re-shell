/**
 * Memory monitor with hysteresis.
 *
 * Watches the CLI process (`process.memoryUsage()`) and the machine
 * (`os.freemem()`), and reports backpressure when a threshold is crossed. It
 * only DECIDES; callers (the resource governor, the pool, the task runner)
 * respond by pausing intake of new work. Once paused it stays paused until usage
 * falls to `resumeRatio` of the limit, which avoids flapping at the boundary.
 */
import * as os from 'os';

export interface MemorySample {
  rssBytes: number;
  heapUsedBytes: number;
  freeBytes: number;
  totalBytes: number;
}

export interface MemoryMonitorOptions {
  /** Pause intake while this process RSS exceeds this many bytes. */
  maxRssBytes?: number;
  /** Pause intake while the V8 heap in use exceeds this many bytes. */
  maxHeapBytes?: number;
  /** Pause intake while system free memory is below this many bytes. */
  minFreeBytes?: number;
  /**
   * Hysteresis: resume once usage is at or below `limit * resumeRatio` (for
   * maximums) or at or above `limit / resumeRatio` (for the free-memory
   * minimum). Default 0.9.
   */
  resumeRatio?: number;
  /** How often `waitForCapacity` re-samples while paused. Default 250ms. */
  pollMs?: number;
  /** Sampler, injectable for tests. Defaults to process.memoryUsage + os.freemem. */
  sample?: () => MemorySample;
}

export interface MemoryStatus {
  paused: boolean;
  /** Human-readable reason while paused. */
  reason?: string;
  sample: MemorySample;
}

export function sampleSystemMemory(): MemorySample {
  const usage = process.memoryUsage();
  return {
    rssBytes: usage.rss,
    heapUsedBytes: usage.heapUsed,
    freeBytes: os.freemem(),
    totalBytes: os.totalmem(),
  };
}

const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)}MB`;

export class MemoryMonitor {
  readonly pollMs: number;
  private paused = false;
  private lastReason: string | undefined;
  private readonly opts: Required<Pick<MemoryMonitorOptions, 'resumeRatio'>> & MemoryMonitorOptions;
  private readonly sampler: () => MemorySample;
  /** Number of times the monitor transitioned from running to paused. */
  pauseCount = 0;

  constructor(options: MemoryMonitorOptions = {}) {
    const ratio = options.resumeRatio ?? 0.9;
    if (!(ratio > 0 && ratio <= 1)) throw new RangeError('resumeRatio must be in (0, 1]');
    this.opts = { ...options, resumeRatio: ratio };
    this.pollMs = options.pollMs ?? 250;
    this.sampler = options.sample ?? sampleSystemMemory;
  }

  /** True when at least one threshold is configured. */
  get enabled(): boolean {
    return (
      this.opts.maxRssBytes !== undefined ||
      this.opts.maxHeapBytes !== undefined ||
      this.opts.minFreeBytes !== undefined
    );
  }

  /** Sample now and update the paused state. */
  check(): MemoryStatus {
    const sample = this.sampler();
    const { maxRssBytes, maxHeapBytes, minFreeBytes, resumeRatio } = this.opts;

    const over = (): string | undefined => {
      if (maxRssBytes !== undefined && sample.rssBytes > maxRssBytes) return `RSS ${mb(sample.rssBytes)} exceeds ${mb(maxRssBytes)}`;
      if (maxHeapBytes !== undefined && sample.heapUsedBytes > maxHeapBytes) return `heap ${mb(sample.heapUsedBytes)} exceeds ${mb(maxHeapBytes)}`;
      if (minFreeBytes !== undefined && sample.freeBytes < minFreeBytes) return `free memory ${mb(sample.freeBytes)} is below ${mb(minFreeBytes)}`;
      return undefined;
    };
    const recovered = (): boolean =>
      (maxRssBytes === undefined || sample.rssBytes <= maxRssBytes * resumeRatio) &&
      (maxHeapBytes === undefined || sample.heapUsedBytes <= maxHeapBytes * resumeRatio) &&
      (minFreeBytes === undefined || sample.freeBytes >= minFreeBytes / resumeRatio);

    if (!this.paused) {
      const reason = over();
      if (reason) {
        this.paused = true;
        this.lastReason = reason;
        this.pauseCount += 1;
      }
    } else if (recovered()) {
      this.paused = false;
      this.lastReason = undefined;
    } else {
      this.lastReason = over() ?? this.lastReason;
    }
    return { paused: this.paused, reason: this.paused ? this.lastReason : undefined, sample };
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Resolve once memory pressure has cleared (polls with setTimeout). */
  async waitForCapacity(): Promise<void> {
    while (this.check().paused) {
      await new Promise<void>(resolve => setTimeout(resolve, this.pollMs));
    }
  }
}
