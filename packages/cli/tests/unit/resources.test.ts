import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import { TokenBucket } from '../../src/resources/token-bucket';
import { PriorityQueue } from '../../src/resources/priority-queue';
import { MemoryMonitor, type MemorySample } from '../../src/resources/memory-monitor';
import {
  ResourceGovernor,
  ResourceOptionError,
  parseResourceFlags,
} from '../../src/resources/governor';
import { AsyncPool } from '../../src/utils/async-pool';
import { runTask, type SpawnTask } from '../../src/utils/task-runner';
import { IncrementalBuilder, type BuildPlan, type BuildTarget } from '../../src/utils/incremental-builder';

const MB = 1024 * 1024;
// Captured before any fake timers are installed: lets tests wait for REAL file I/O.
const realSetTimeout = setTimeout;
/** Let runTask's real workspace discovery (fs I/O) finish while time stays frozen. */
async function settleIO(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    await new Promise<void>(r => realSetTimeout(r, 3));
    await vi.advanceTimersByTimeAsync(0);
  }
}

/** Advance fake time in small steps, letting promise continuations run between steps. */
async function advance(ms: number, step = 10): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    await vi.advanceTimersByTimeAsync(Math.min(step, ms - elapsed));
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('TokenBucket', () => {
  it('allows a burst up to capacity, then refuses', () => {
    const bucket = new TokenBucket({ capacity: 3, refillPerSecond: 1 });
    expect([bucket.tryRemove(), bucket.tryRemove(), bucket.tryRemove(), bucket.tryRemove()]).toEqual([true, true, true, false]);
  });

  it('refills continuously at the configured rate and caps at capacity', async () => {
    const bucket = new TokenBucket({ capacity: 2, refillPerSecond: 2, initialTokens: 0 });
    expect(bucket.tryRemove()).toBe(false);
    await vi.advanceTimersByTimeAsync(499);
    expect(bucket.tryRemove()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(bucket.tryRemove()).toBe(true); // 0.5s * 2/s = 1 token
    await vi.advanceTimersByTimeAsync(60_000);
    expect(bucket.available()).toBe(2); // capped
  });

  it('reports how long until tokens are available', () => {
    const bucket = new TokenBucket({ capacity: 5, refillPerSecond: 4, initialTokens: 0 });
    expect(bucket.msUntilAvailable(1)).toBe(250);
    expect(bucket.msUntilAvailable(4)).toBe(1000);
  });

  it('acquire() paces callers at the refill rate', async () => {
    const bucket = new TokenBucket({ capacity: 1, refillPerSecond: 1 });
    const times: number[] = [];
    const t0 = Date.now();
    const jobs = [0, 1, 2, 3].map(() => bucket.acquire().then(() => times.push(Date.now() - t0)));
    await advance(3500);
    await Promise.all(jobs);
    expect(times).toEqual([0, 1000, 2000, 3000]);
  });

  it('sustained throughput equals the refill rate', async () => {
    const bucket = new TokenBucket({ capacity: 1, refillPerSecond: 5 });
    let done = 0;
    for (let i = 0; i < 1000; i++) void bucket.acquire().then(() => done++);
    await advance(10_000);
    // 1 burst token + 5/s for 10s
    expect(done).toBeGreaterThanOrEqual(50);
    expect(done).toBeLessThanOrEqual(52);
  });

  it('serves waiters strictly FIFO and does not let tryRemove overtake them', async () => {
    const bucket = new TokenBucket({ capacity: 2, refillPerSecond: 1, initialTokens: 0 });
    const order: string[] = [];
    void bucket.acquire(2).then(() => order.push('big'));
    void bucket.acquire(1).then(() => order.push('small'));
    await advance(1000);
    expect(bucket.tryRemove()).toBe(false); // a waiter is queued; no overtaking
    await advance(3000);
    expect(order).toEqual(['big', 'small']);
  });

  it('rejects impossible requests and bad configuration', async () => {
    const bucket = new TokenBucket({ capacity: 2, refillPerSecond: 1 });
    expect(() => bucket.tryRemove(3)).toThrow(RangeError);
    await expect(bucket.acquire(3)).rejects.toThrow(RangeError);
    expect(() => new TokenBucket({ capacity: 0, refillPerSecond: 1 })).toThrow(RangeError);
    expect(() => new TokenBucket({ capacity: 1, refillPerSecond: 0 })).toThrow(RangeError);
  });
});

describe('PriorityQueue', () => {
  it('serves higher priority first', () => {
    const q = new PriorityQueue<string>();
    q.push('low', 1);
    q.push('high', 10);
    q.push('mid', 5);
    expect(q.drain()).toEqual(['high', 'mid', 'low']);
  });

  it('is stable: equal priorities leave in insertion order', () => {
    const q = new PriorityQueue<number>();
    for (let i = 0; i < 200; i++) q.push(i, i % 3);
    const out = q.drain();
    const byPriority = (p: number) => out.filter(n => n % 3 === p);
    expect(byPriority(2)).toEqual([...byPriority(2)].sort((a, b) => a - b));
    expect(byPriority(0)).toEqual([...byPriority(0)].sort((a, b) => a - b));
    // all priority-2 items precede priority-1 items, which precede priority-0 items
    expect(out.slice(0, 66).every(n => n % 3 === 2)).toBe(true);
    expect(out.slice(66, 133).every(n => n % 3 === 1)).toBe(true);
  });

  it('handles an interleaved push/pop workload', () => {
    const q = new PriorityQueue<number>();
    q.push(1, 1);
    q.push(2, 2);
    expect(q.pop()).toBe(2);
    q.push(3, 3);
    q.push(4, 1);
    expect([q.pop(), q.pop(), q.pop(), q.pop()]).toEqual([3, 1, 4, undefined]);
    expect(q.size).toBe(0);
  });

  it('aging lets a long-waiting low-priority item overtake newer high-priority ones', async () => {
    const q = new PriorityQueue<string>({ agingPerSecond: 1 });
    q.push('old-low', 0);
    await advance(10_000, 1000); // waited 10s => effective 10
    q.push('fresh-high', 5);
    expect(q.peekEffectivePriority()).toBeCloseTo(10, 5);
    expect(q.pop()).toBe('old-low');
    expect(q.pop()).toBe('fresh-high');
  });

  it('without aging the same low-priority item is served last', async () => {
    const q = new PriorityQueue<string>();
    q.push('old-low', 0);
    await advance(10_000, 1000);
    q.push('fresh-high', 5);
    expect(q.pop()).toBe('fresh-high');
  });

  it('prevents starvation under a steady stream of high-priority arrivals', async () => {
    const q = new PriorityQueue<string>({ agingPerSecond: 2 });
    q.push('victim', 0);
    let servedBeforeVictim = 0;
    let victimServed = false;
    // Every simulated second, one new priority-10 job arrives and one job is served.
    for (let second = 1; second <= 60 && !victimServed; second++) {
      await advance(1000, 1000);
      q.push(`high-${second}`, 10);
      const next = q.pop();
      if (next === 'victim') victimServed = true;
      else servedBeforeVictim++;
    }
    expect(victimServed).toBe(true);
    // victim gains 2/s; it must be served once 2*t >= 10, i.e. within ~5-6 jobs
    expect(servedBeforeVictim).toBeLessThanOrEqual(6);
  });

  it('without aging a steady high-priority stream starves the low item (control)', async () => {
    const q = new PriorityQueue<string>();
    q.push('victim', 0);
    let victimServed = false;
    for (let second = 1; second <= 60; second++) {
      await advance(1000, 1000);
      q.push(`high-${second}`, 10);
      if (q.pop() === 'victim') victimServed = true;
    }
    expect(victimServed).toBe(false);
  });
});

describe('MemoryMonitor', () => {
  const sampleOf = (over: Partial<MemorySample> = {}): MemorySample => ({
    rssBytes: 100 * MB,
    heapUsedBytes: 50 * MB,
    freeBytes: 4000 * MB,
    totalBytes: 8000 * MB,
    ...over,
  });

  it('is quiet below every threshold', () => {
    const m = new MemoryMonitor({ maxRssBytes: 500 * MB, maxHeapBytes: 300 * MB, minFreeBytes: 256 * MB, sample: () => sampleOf() });
    expect(m.check().paused).toBe(false);
  });

  it('pauses on RSS, heap, or low free memory, naming the reason', () => {
    const rss = new MemoryMonitor({ maxRssBytes: 100 * MB, sample: () => sampleOf({ rssBytes: 200 * MB }) });
    expect(rss.check()).toMatchObject({ paused: true, reason: expect.stringContaining('RSS') });
    const heap = new MemoryMonitor({ maxHeapBytes: 10 * MB, sample: () => sampleOf() });
    expect(heap.check().reason).toMatch(/heap/);
    const free = new MemoryMonitor({ minFreeBytes: 1000 * MB, sample: () => sampleOf({ freeBytes: 100 * MB }) });
    expect(free.check().reason).toMatch(/free memory/);
  });

  it('uses hysteresis: stays paused until usage falls to resumeRatio of the limit', () => {
    let rss = 200 * MB;
    const m = new MemoryMonitor({ maxRssBytes: 100 * MB, resumeRatio: 0.8, sample: () => sampleOf({ rssBytes: rss }) });
    expect(m.check().paused).toBe(true);
    rss = 95 * MB; // below the limit but above 80%
    expect(m.check().paused).toBe(true);
    rss = 79 * MB;
    expect(m.check().paused).toBe(false);
    rss = 95 * MB; // back under the limit but not over it: stays running
    expect(m.check().paused).toBe(false);
    expect(m.pauseCount).toBe(1);
  });

  it('applies hysteresis to the free-memory floor in the other direction', () => {
    let free = 100 * MB;
    const m = new MemoryMonitor({ minFreeBytes: 200 * MB, resumeRatio: 0.5, sample: () => sampleOf({ freeBytes: free }) });
    expect(m.check().paused).toBe(true);
    free = 250 * MB; // above the floor, but below floor/0.5 = 400MB
    expect(m.check().paused).toBe(true);
    free = 401 * MB;
    expect(m.check().paused).toBe(false);
  });

  it('waitForCapacity resolves once pressure clears (fake timers)', async () => {
    let rss = 900 * MB;
    const m = new MemoryMonitor({ maxRssBytes: 500 * MB, pollMs: 100, sample: () => sampleOf({ rssBytes: rss }) });
    let resumed = false;
    void m.waitForCapacity().then(() => (resumed = true));
    await advance(1000, 100);
    expect(resumed).toBe(false);
    rss = 100 * MB;
    await advance(200, 100);
    expect(resumed).toBe(true);
  });

  it('is disabled (never pauses) with no thresholds, and reads the real process by default', () => {
    const none = new MemoryMonitor();
    expect(none.enabled).toBe(false);
    expect(none.check().paused).toBe(false);
    const real = new MemoryMonitor({ maxRssBytes: 1 }); // the process certainly exceeds 1 byte
    const status = real.check();
    expect(status.paused).toBe(true);
    expect(status.sample.rssBytes).toBeGreaterThan(1);
  });
});

describe('ResourceGovernor', () => {
  const high: MemorySample = { rssBytes: 900 * MB, heapUsedBytes: 0, freeBytes: 1e12, totalBytes: 1e12 };
  const low: MemorySample = { rssBytes: 10 * MB, heapUsedBytes: 0, freeBytes: 1e12, totalBytes: 1e12 };

  it('applies memory backpressure only while work is in flight (liveness)', () => {
    const g = new ResourceGovernor({ memory: { maxRssBytes: 500 * MB, sample: () => high } });
    expect(g.admit(0).ok).toBe(true); // nothing running: never deadlock
    const blocked = g.admit(2);
    expect(blocked).toMatchObject({ ok: false, reason: 'memory' });
    expect(g.stats.pausedByMemory).toBe(1);
  });

  it('does not consume a rate token when memory refuses', () => {
    const g = new ResourceGovernor({ rate: { perSecond: 1, burst: 1 }, memory: { maxRssBytes: 500 * MB, sample: () => high } });
    expect(g.admit(1).ok).toBe(false);
    expect(g.admit(0).ok).toBe(true); // the single token is still there
  });

  it('rate-limits admissions and tells the caller when to retry', async () => {
    const g = new ResourceGovernor({ rate: { perSecond: 2, burst: 1 } });
    expect(g.admit(0).ok).toBe(true);
    const d = g.admit(0);
    expect(d).toMatchObject({ ok: false, reason: 'rate' });
    expect(d.retryAfterMs).toBe(500);
    await vi.advanceTimersByTimeAsync(500);
    expect(g.admit(0).ok).toBe(true);
    expect(g.stats).toMatchObject({ admitted: 2, throttledByRate: 1 });
  });

  it('is inert with no limits', () => {
    const g = new ResourceGovernor();
    expect(g.active).toBe(false);
    expect(g.admit(5).ok).toBe(true);
  });
});

describe('parseResourceFlags', () => {
  it('parses valid values and builds a governor only when needed', () => {
    expect(parseResourceFlags({ concurrency: '4' })).toEqual({ concurrency: 4 });
    const r = parseResourceFlags({ maxMemory: '512', rateLimit: '3' });
    expect(r.governor).toBeInstanceOf(ResourceGovernor);
    expect(r.governor!.bucket!.refillPerSecond).toBe(3);
    expect(r.governor!.memory).toBeDefined();
  });

  it('fails explicitly on invalid values instead of silently defaulting', () => {
    expect(() => parseResourceFlags({ concurrency: 'abc' })).toThrow(ResourceOptionError);
    expect(() => parseResourceFlags({ concurrency: '0' })).toThrow(/--concurrency/);
    expect(() => parseResourceFlags({ concurrency: '1.5' })).toThrow(/integer/);
    expect(() => parseResourceFlags({ maxMemory: '-5' })).toThrow(/--max-memory/);
    expect(() => parseResourceFlags({ rateLimit: 'fast' })).toThrow(/--rate-limit/);
  });
});

describe('AsyncPool with resources', () => {
  it('starts queued tasks in priority order', async () => {
    const pool = new AsyncPool(1);
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const first = pool.add(async () => {
      order.push('first');
      await gate;
    });
    const jobs = [
      pool.add(async () => void order.push('low'), 1),
      pool.add(async () => void order.push('high'), 9),
      pool.add(async () => void order.push('mid-a'), 5),
      pool.add(async () => void order.push('mid-b'), 5),
    ];
    release();
    await Promise.all([first, ...jobs]);
    expect(order).toEqual(['first', 'high', 'mid-a', 'mid-b', 'low']);
  });

  it('default priority keeps strict FIFO', async () => {
    const pool = new AsyncPool(1);
    const order: number[] = [];
    await Promise.all(Array.from({ length: 20 }, (_, i) => pool.add(async () => void order.push(i))));
    expect(order).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it('aging prevents starvation inside the pool', async () => {
    const pool = new AsyncPool(1, { agingPerSecond: 10 });
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const blocker = pool.add(() => gate);
    const low = pool.add(async () => void order.push('low'), 0);
    await advance(5000, 1000);
    const high = pool.add(async () => void order.push('high'), 20); // low has 50 aged points by now
    release();
    await Promise.all([blocker, low, high]);
    expect(order).toEqual(['low', 'high']);
  });

  it('rate-limits task starts with the governor', async () => {
    const governor = new ResourceGovernor({ rate: { perSecond: 2, burst: 2 } });
    const pool = new AsyncPool(10, { governor });
    const starts: number[] = [];
    const t0 = Date.now();
    const jobs = Array.from({ length: 6 }, () => pool.add(async () => void starts.push(Date.now() - t0)));
    await advance(3000, 50);
    await Promise.all(jobs);
    // burst of 2 immediately, then one every 500ms
    expect(starts).toEqual([0, 0, 500, 1000, 1500, 2000]);
  });

  it('pauses intake under memory pressure and resumes when it clears', async () => {
    let rss = 900 * MB;
    const governor = new ResourceGovernor({
      memory: { maxRssBytes: 500 * MB, pollMs: 100, sample: () => ({ rssBytes: rss, heapUsedBytes: 0, freeBytes: 1e12, totalBytes: 1e12 }) },
    });
    const pool = new AsyncPool(4, { governor });
    const started: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const jobs = [0, 1, 2, 3].map(i =>
      pool.add(async () => {
        started.push(i);
        await gate;
      })
    );
    await advance(500, 50);
    // The first task is always admitted (nothing in flight); the rest are held back.
    expect(started).toEqual([0]);
    expect(pool.active).toBe(1);
    expect(pool.pending).toBe(3);
    expect(governor.stats.pausedByMemory).toBeGreaterThan(0);

    rss = 100 * MB;
    await advance(300, 50);
    expect(started).toEqual([0, 1, 2, 3]);
    release();
    await Promise.all(jobs);
  });

  it('rejects a non-positive or NaN concurrency instead of hanging', () => {
    expect(() => new AsyncPool(0)).toThrow(RangeError);
    expect(() => new AsyncPool(NaN)).toThrow(RangeError);
  });

  it('waitForAll resolves immediately when idle and after drain otherwise', async () => {
    const pool = new AsyncPool(2);
    await pool.waitForAll();
    let n = 0;
    void pool.add(async () => {
      await new Promise(r => setTimeout(r, 100));
      n++;
    });
    const all = pool.waitForAll();
    await advance(200, 50);
    await all;
    expect(n).toBe(1);
  });
});

describe('task runner (re-shell run) resource wiring', () => {
  let root: string;

  async function workspace(packages: Record<string, string[]>): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'run-res-'));
    await fs.writeJson(path.join(dir, 'package.json'), { name: 'root', private: true });
    for (const [name, deps] of Object.entries(packages)) {
      const p = path.join(dir, 'packages', name);
      await fs.ensureDir(p);
      await fs.writeJson(path.join(p, 'package.json'), {
        name,
        scripts: { build: 'echo build' },
        dependencies: Object.fromEntries(deps.map(d => [d, 'workspace:*'])),
      });
    }
    return dir;
  }

  afterEach(async () => {
    if (root) await fs.remove(root);
  });

  /**
   * Drive a runTask promise to completion under fake timers. Fake time advances
   * in small steps; between steps we yield real time so runTask's real file I/O
   * can complete (fake timers alone never let real I/O make progress).
   */
  async function drive<T>(promise: Promise<T>): Promise<T> {
    let settled = false;
    const wrapped = promise.finally(() => (settled = true));
    for (let i = 0; i < 20_000 && !settled; i++) {
      await new Promise<void>(r => realSetTimeout(r, 1));
      await vi.advanceTimersByTimeAsync(25);
    }
    return wrapped;
  }

  it('starts the task that unblocks the most downstream work first', async () => {
    vi.useRealTimers();
    root = await workspace({ 'a-leaf': [], 'z-core': [], d1: ['z-core'], d2: ['z-core'], d3: ['z-core'] });
    vi.useFakeTimers();
    const order: string[] = [];
    const spawnTask: SpawnTask = async ({ pkg }) => {
      order.push(pkg.name);
      return { exitCode: 0 };
    };
    const result = await drive(runTask({ rootPath: root, task: 'build', concurrency: 1, spawnTask }));
    expect(result.hadFailure).toBe(false);
    expect(order[0]).toBe('z-core'); // 3 dependents beat the (alphabetically earlier) leaf
    expect(result.startOrder![0]).toBe('z-core#build');
    expect(order).toHaveLength(5);
    // the leaf was ready from the start, so after the dependents unlock it keeps FIFO position
    expect(order.indexOf('a-leaf')).toBeLessThan(order.indexOf('d1') + 1);
  });

  it('never starves a low-priority task behind a long chain of high-fan-out work', async () => {
    vi.useRealTimers();
    root = await workspace({ 'a-leaf': [], 'z-core': [], d1: ['z-core'], d2: ['z-core'] });
    vi.useFakeTimers();
    const order: string[] = [];
    const spawnTask: SpawnTask = async ({ pkg }) => {
      order.push(pkg.name);
      await new Promise(r => setTimeout(r, 1000));
      return { exitCode: 0 };
    };
    // Strong aging: after one 1s task the waiting leaf outranks fresh dependents.
    const result = await drive(runTask({ rootPath: root, task: 'build', concurrency: 1, spawnTask, agingPerSecond: 100 }));
    expect(order.slice(0, 2)).toEqual(['z-core', 'a-leaf']);
    expect(order.slice(2).sort()).toEqual(['d1', 'd2']);
    expect(result.hadFailure).toBe(false);
  });

  it('honours --rate-limit: task starts are paced by the token bucket', async () => {
    vi.useRealTimers();
    root = await workspace({ p1: [], p2: [], p3: [], p4: [], p5: [] });
    vi.useFakeTimers();
    const governor = new ResourceGovernor({ rate: { perSecond: 2, burst: 1 } });
    const starts: number[] = [];
    const t0 = Date.now();
    const spawnTask: SpawnTask = async () => {
      starts.push(Date.now() - t0);
      return { exitCode: 0 };
    };
    const result = await drive(runTask({ rootPath: root, task: 'build', concurrency: 8, spawnTask, governor }));
    expect(result.hadFailure).toBe(false);
    expect(starts).toHaveLength(5);
    // runTask's own file discovery takes no fake time, so the gaps are exactly the refill interval.
    const gaps = starts.slice(1).map((s, i) => s - starts[i]);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(500);
    expect(result.resourceStats!.throttledByRate).toBeGreaterThan(0);
    expect(result.resourceStats!.admitted).toBe(5);
  });

  it('honours --max-memory: pauses new task starts while memory is high, then resumes', async () => {
    vi.useRealTimers();
    root = await workspace({ p1: [], p2: [], p3: [] });
    vi.useFakeTimers();
    let rss = 900 * MB;
    const governor = new ResourceGovernor({
      memory: { maxRssBytes: 500 * MB, pollMs: 100, sample: () => ({ rssBytes: rss, heapUsedBytes: 0, freeBytes: 1e12, totalBytes: 1e12 }) },
    });
    const started: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const spawnTask: SpawnTask = async ({ pkg }) => {
      started.push(pkg.name);
      await gate;
      return { exitCode: 0 };
    };
    const running = runTask({ rootPath: root, task: 'build', concurrency: 3, spawnTask, governor });
    await settleIO();
    await advance(1000, 50);
    expect(started).toHaveLength(1); // backpressure: only the first task was admitted
    rss = 50 * MB;
    await advance(500, 50);
    expect(started).toHaveLength(3);
    release();
    const result = await drive(running);
    expect(result.hadFailure).toBe(false);
    expect(result.resourceStats!.pausedByMemory).toBeGreaterThan(0);
  });

  it('a stalled governor never ends the run early: everything still executes', async () => {
    vi.useRealTimers();
    root = await workspace({ p1: [], p2: [] });
    vi.useFakeTimers();
    const governor = new ResourceGovernor({ rate: { perSecond: 1, burst: 1 } });
    const ran: string[] = [];
    const spawnTask: SpawnTask = async ({ pkg }) => {
      ran.push(pkg.name);
      return { exitCode: 0 };
    };
    const result = await drive(runTask({ rootPath: root, task: 'build', concurrency: 4, spawnTask, governor }));
    expect(ran.sort()).toEqual(['p1', 'p2']);
    expect(result.results.map(r => r.status)).toEqual(['success', 'success']);
  });
});

describe('incremental builder resource wiring', () => {
  const target = (name: string, type: BuildTarget['type']): BuildTarget => ({
    name,
    path: name,
    type,
    buildScript: 'echo',
    dependencies: [],
    outputs: [],
    inputs: [],
  });

  function planOf(targets: BuildTarget[]): BuildPlan {
    return {
      targets,
      buildOrder: targets.map(t => t.name),
      parallelGroups: [targets.map(t => t.name)],
      totalEstimatedTime: 0,
      optimizations: [],
    } as unknown as BuildPlan;
  }

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('starts the longest-estimated target first and never exceeds maxParallelBuilds', async () => {
    const builder = new IncrementalBuilder(os.tmpdir(), { maxParallelBuilds: 1, enableCache: false });
    const started: string[] = [];
    let concurrent = 0;
    let peak = 0;
    vi.spyOn(builder, 'buildTarget').mockImplementation(async t => {
      started.push(t.name);
      concurrent++;
      peak = Math.max(peak, concurrent);
      await new Promise(r => setTimeout(r, 10));
      concurrent--;
      return { target: t.name, success: true, duration: 10, output: '' } as never;
    });
    const plan = planOf([target('tool', 'tool'), target('lib', 'lib'), target('app', 'app')]);
    const run = builder.executeBuildPlan(plan);
    await advance(100, 10);
    await run;
    expect(started).toEqual(['app', 'lib', 'tool']);
    expect(peak).toBe(1);
  });

  it('applies the governor: target builds are rate limited', async () => {
    const governor = new ResourceGovernor({ rate: { perSecond: 1, burst: 1 } });
    const builder = new IncrementalBuilder(os.tmpdir(), { maxParallelBuilds: 8, enableCache: false, governor });
    const starts: number[] = [];
    const t0 = Date.now();
    vi.spyOn(builder, 'buildTarget').mockImplementation(async t => {
      starts.push(Date.now() - t0);
      return { target: t.name, success: true, duration: 0, output: '' } as never;
    });
    const run = builder.executeBuildPlan(planOf([target('a', 'lib'), target('b', 'lib'), target('c', 'lib')]));
    await advance(3000, 50);
    await run;
    expect(starts).toEqual([0, 1000, 2000]);
  });
});
