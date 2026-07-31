import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  PlatformWatcher,
  createPlatformWatcher,
  getPlatformCapabilities,
  testPlatformWatching,
} from '../../src/utils/platform-watcher';
import * as chokidar from 'chokidar';

// `os.platform`/`os.arch` live on a non-configurable ESM namespace, so
// vi.spyOn cannot redefine them across tests. Hoist controllable stubs and
// mock the `os` module with them (default to the real test host: darwin/x64).
const { platformMock, archMock } = vi.hoisted(() => ({
  platformMock: vi.fn(() => 'darwin' as NodeJS.Platform),
  archMock: vi.fn(() => 'x64'),
}));

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, platform: platformMock, arch: archMock };
});

// Same non-configurable-namespace issue for fs-extra's readFileSync/readdirSync.
// Mock them with pass-through stubs (default = real impl) so we can override
// per-test for the /proc read and the large-directory readdir paths while every
// other fs operation stays real.
const fsMocks = vi.hoisted(() => ({
  readFileSync: null as any,
  readdirSync: null as any,
}));

vi.mock('fs-extra', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs-extra')>();
  fsMocks.readFileSync = vi.fn((...a: any[]) => actual.readFileSync(...a));
  fsMocks.readdirSync = vi.fn((...a: any[]) => actual.readdirSync(...a));
  // Namespace props are non-enumerable, so a spread would drop most of them —
  // return each method the source and tests touch explicitly.
  return {
    readFileSync: fsMocks.readFileSync,
    readdirSync: fsMocks.readdirSync,
    statSync: actual.statSync,
    ensureDir: actual.ensureDir,
    remove: actual.remove,
    mkdtempSync: actual.mkdtempSync,
    writeFileSync: actual.writeFileSync,
    removeSync: actual.removeSync,
  };
});

// Mock chokidar so no real file watching happens. The fake watcher is an
// EventEmitter with a spy-friendly `close()` and captures the options handed
// to `watch()`. Throw modes let us drive the fallback paths deterministically.
vi.mock('chokidar', () => {
  const { EventEmitter } = require('events');
  const instances: any[] = [];
  let nextThrows = false;
  let alwaysThrows = false;

  class FakeWatcher extends EventEmitter {
    watchPath: string;
    options: any;
    closed = false;
    constructor(watchPath: string, options: any = {}) {
      super();
      this.watchPath = watchPath;
      this.options = options;
      instances.push(this);
    }
    async close() {
      this.closed = true;
    }
  }

  return {
    FSWatcher: FakeWatcher,
    watch(watchPath: string, options?: any) {
      if (alwaysThrows) throw new Error('mock chokidar: watch disabled');
      if (nextThrows) {
        nextThrows = false;
        throw new Error('mock chokidar: one-off failure');
      }
      return new (FakeWatcher as any)(watchPath, options);
    },
    __instances: instances,
    __setNextThrow() {
      nextThrows = true;
    },
    __setAlwaysThrow(v: boolean) {
      alwaysThrows = v;
    },
    __reset() {
      instances.length = 0;
      nextThrows = false;
      alwaysThrows = false;
    },
  };
});

const C = chokidar as any;

// Build a watcher with the periodic health-check timer disabled so tests stay
// deterministic and timer-leak free. Per-test platform spies override os.
function makeWatcher(opts: any = {}) {
  return new PlatformWatcher({ healthCheckInterval: 0, ...opts });
}

// Create a watcher and capture the generated watcherId from the event payload.
async function createAndGetId(w: PlatformWatcher, watchPath: string, options?: any) {
  let id = '';
  w.on('watcher-created', (p: any) => {
    id = p.watcherId;
  });
  await w.createWatcher(watchPath, options);
  return id;
}

beforeEach(() => {
  C.__reset();
  platformMock.mockReturnValue('darwin');
  archMock.mockReturnValue('x64');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PlatformWatcher — platform capability detection', () => {
  it('detects darwin with FSEvents and a high watch limit', () => {
    platformMock.mockReturnValue('darwin');
    archMock.mockReturnValue('arm64');
    const caps = makeWatcher().getPlatformCapabilities();
    expect(caps.platform).toBe('darwin');
    expect(caps.architecture).toBe('arm64');
    expect(caps.supportsNativeWatching).toBe(true);
    expect(caps.supportsPolling).toBe(true);
    expect(caps.supportsFSEvents).toBe(true);
    expect(caps.supportsInotify).toBe(false);
    expect(caps.maxWatchedFiles).toBe(524288);
    expect(caps.recommendedWatchMethod).toBe('fsevents');
    expect(caps.fallbackMethods).toEqual(['native', 'polling']);
    expect(caps.limitations).toHaveLength(2);
  });

  it('detects linux with inotify and reads /proc/sys/fs/inotify/max_user_watches', () => {
    platformMock.mockReturnValue('linux');
    const read = fsMocks.readFileSync.mockReturnValue('   99999  \n');
    const caps = makeWatcher().getPlatformCapabilities();
    expect(caps.platform).toBe('linux');
    expect(caps.supportsInotify).toBe(true);
    expect(caps.supportsFSEvents).toBe(false);
    expect(caps.recommendedWatchMethod).toBe('inotify');
    expect(caps.fallbackMethods).toEqual(['native', 'polling']);
    expect(caps.maxWatchedFiles).toBe(99999);
    expect(read).toHaveBeenCalledWith('/proc/sys/fs/inotify/max_user_watches', 'utf8');
  });

  it('falls back to 8192 when /proc max_user_watches is unreadable on linux', () => {
    platformMock.mockReturnValue('linux');
    fsMocks.readFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(makeWatcher().getPlatformCapabilities().maxWatchedFiles).toBe(8192);
  });

  it('falls back to 8192 when /proc max_user_watches is non-numeric on linux', () => {
    platformMock.mockReturnValue('linux');
    fsMocks.readFileSync.mockReturnValue('not-a-number');
    expect(makeWatcher().getPlatformCapabilities().maxWatchedFiles).toBe(8192);
  });

  it('detects win32 with native watching and a polling fallback', () => {
    platformMock.mockReturnValue('win32');
    const caps = makeWatcher().getPlatformCapabilities();
    expect(caps.platform).toBe('win32');
    expect(caps.maxWatchedFiles).toBe(65536);
    expect(caps.recommendedWatchMethod).toBe('native');
    expect(caps.fallbackMethods).toEqual(['polling']);
    expect(caps.limitations).toHaveLength(3);
  });

  it('recommends polling on the BSDs with limited native support', () => {
    platformMock.mockReturnValue('freebsd');
    const caps = makeWatcher().getPlatformCapabilities();
    expect(caps.platform).toBe('freebsd');
    expect(caps.maxWatchedFiles).toBe(4096);
    expect(caps.recommendedWatchMethod).toBe('polling');
    expect(caps.fallbackMethods).toEqual(['native']);
    expect(caps.limitations).toHaveLength(2);
  });

  it('uses conservative polling defaults on an unknown platform', () => {
    platformMock.mockReturnValue('sunos');
    const caps = makeWatcher().getPlatformCapabilities();
    expect(caps.platform).toBe('sunos');
    expect(caps.maxWatchedFiles).toBe(1024);
    expect(caps.recommendedWatchMethod).toBe('polling');
    expect(caps.fallbackMethods).toEqual(['native']);
    expect(caps.limitations).toHaveLength(2);
  });
});

describe('PlatformWatcher — fallback options', () => {
  it('fills defaults from the detected platform', () => {
    platformMock.mockReturnValue('darwin');
    const fo = (makeWatcher() as any).fallbackOptions;
    expect(fo.primaryMethod).toBe('fsevents');
    expect(fo.fallbackMethods).toEqual(['native', 'polling']);
    expect(fo.fallbackDelay).toBe(5000);
    expect(fo.maxRetries).toBe(3);
    expect(fo.healthCheckInterval).toBe(0); // overridden via makeWatcher
    expect(fo.enableFallbackLogging).toBe(true);
    expect(fo.platformOptimizations).toBe(true);
    expect(fo.adaptivePolling).toBe(true);
  });

  it('merges partial overrides over the defaults', () => {
    platformMock.mockReturnValue('darwin');
    const fo = (makeWatcher({ primaryMethod: 'polling', maxRetries: 7, adaptivePolling: false }) as any)
      .fallbackOptions;
    expect(fo.primaryMethod).toBe('polling');
    expect(fo.maxRetries).toBe(7);
    expect(fo.adaptivePolling).toBe(false);
    expect(fo.fallbackDelay).toBe(5000); // untouched default
  });
});

describe('PlatformWatcher — capabilities accessor', () => {
  it('getPlatformCapabilities returns a fresh shallow copy each call', () => {
    const w = makeWatcher();
    const c1 = w.getPlatformCapabilities();
    const c2 = w.getPlatformCapabilities();
    expect(c1).not.toBe(c2);
    expect(c1).toEqual(c2);
    c1.maxWatchedFiles = 1;
    expect(w.getPlatformCapabilities().maxWatchedFiles).not.toBe(1);
  });
});

describe('PlatformWatcher — createWatcher', () => {
  it('creates a watcher, stores it, and emits watcher-created with fallback prepared', async () => {
    platformMock.mockReturnValue('darwin');
    const w = makeWatcher();
    const created = vi.fn();
    w.on('watcher-created', created);

    const watcher = await w.createWatcher('/some/path');

    expect(watcher).toBeDefined();
    expect(created).toHaveBeenCalledTimes(1);
    const payload = created.mock.calls[0][0];
    expect(payload.watchPath).toBe('/some/path');
    expect(payload.method).toBe('fsevents');
    expect(payload.watcherId).toMatch(/^watcher_[0-9a-f]{8}_\d+$/);
    expect(w.getActiveWatchersCount()).toBe(1);
    expect(w.getWatcherHealth(payload.watcherId)?.fallbackReady).toBe(true);
    await w.closeAll();
  });

  it('does not prepare a fallback when enableFallbacks is false', async () => {
    const w = makeWatcher();
    const id = await createAndGetId(w, '/p', { enableFallbacks: false });
    expect(w.getWatcherHealth(id)?.fallbackReady).toBe(false);
    await w.closeAll();
  });

  it('falls back to the next method when the primary watcher fails', async () => {
    platformMock.mockReturnValue('darwin');
    const w = makeWatcher();
    C.__setNextThrow(); // primary createPrimaryWatcher throws, then succeeds
    const errFn = vi.fn();
    const fb = vi.fn();
    w.on('watcher-error', errFn);
    w.on('fallback-activated', fb);

    const watcher = await w.createWatcher('/p');

    expect(errFn).toHaveBeenCalledTimes(1);
    expect(fb).toHaveBeenCalledTimes(1);
    expect(fb.mock.calls[0][0].method).toBe('native'); // first fallback method
    expect(watcher).toBeDefined();
    expect(w.getActiveWatchersCount()).toBe(1);
    await w.closeAll();
  });

  it('throws ValidationError when the primary fails and fallbacks are disabled', async () => {
    const w = makeWatcher();
    C.__setAlwaysThrow(true);
    await expect(w.createWatcher('/p', { enableFallbacks: false })).rejects.toThrow(
      /Failed to create watcher/,
    );
    C.__setAlwaysThrow(false);
  });

  it('throws ValidationError when every fallback method fails', async () => {
    const w = makeWatcher();
    C.__setAlwaysThrow(true);
    await expect(w.createWatcher('/p')).rejects.toThrow(/All fallback methods failed/);
    C.__setAlwaysThrow(false);
  });

  it('applies darwin-specific optimizations (awaitWriteFinish, alwaysStat false)', async () => {
    platformMock.mockReturnValue('darwin');
    const w = makeWatcher();
    await w.createWatcher('/p');
    const opts = C.__instances[0].options;
    expect(opts.alwaysStat).toBe(false);
    expect(opts.awaitWriteFinish).toEqual({ stabilityThreshold: 2000, pollInterval: 100 });
    expect(opts.usePolling).toBe(false);
    await w.closeAll();
  });

  it('applies linux-specific optimizations (alwaysStat true)', async () => {
    platformMock.mockReturnValue('linux');
    const w = makeWatcher({ primaryMethod: 'native' });
    await w.createWatcher('/p');
    const opts = C.__instances[0].options;
    expect(opts.alwaysStat).toBe(true);
    expect(opts.awaitWriteFinish).toEqual({ stabilityThreshold: 1000, pollInterval: 100 });
    await w.closeAll();
  });
});

describe('PlatformWatcher — adaptive polling interval', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-'));
  });
  afterEach(() => {
    fs.removeSync(root);
  });

  it('uses a fast 500ms interval for a single file', async () => {
    const w = new PlatformWatcher({ healthCheckInterval: 0, primaryMethod: 'polling' });
    const file = path.join(root, 'single.txt');
    fs.writeFileSync(file, 'x');
    await w.createWatcher(file);
    expect(C.__instances[0].options.interval).toBe(500);
    await w.closeAll();
  });

  it('uses a fast 500ms interval for a small directory (<50 entries)', async () => {
    const w = new PlatformWatcher({ healthCheckInterval: 0, primaryMethod: 'polling' });
    for (let i = 0; i < 10; i++) fs.writeFileSync(path.join(root, `f${i}`), 'x');
    await w.createWatcher(root);
    expect(C.__instances[0].options.interval).toBe(500);
    await w.closeAll();
  });

  it('uses a normal 1000ms interval for a medium directory (50-199 entries)', async () => {
    const w = new PlatformWatcher({ healthCheckInterval: 0, primaryMethod: 'polling' });
    for (let i = 0; i < 60; i++) fs.writeFileSync(path.join(root, `f${i}`), 'x');
    await w.createWatcher(root);
    expect(C.__instances[0].options.interval).toBe(1000);
    await w.closeAll();
  });

  it('uses a slow 2000ms interval for a large directory (200+ entries)', async () => {
    const w = new PlatformWatcher({ healthCheckInterval: 0, primaryMethod: 'polling' });
    fsMocks.readdirSync.mockReturnValue(Array(250) as any);
    await w.createWatcher(root);
    expect(C.__instances[0].options.interval).toBe(2000);
    await w.closeAll();
  });

  it('uses the fixed 1000ms default when adaptivePolling is disabled', async () => {
    const w = new PlatformWatcher({
      healthCheckInterval: 0,
      primaryMethod: 'polling',
      adaptivePolling: false,
    });
    const file = path.join(root, 'x');
    fs.writeFileSync(file, 'x');
    await w.createWatcher(file);
    expect(C.__instances[0].options.interval).toBe(1000);
    await w.closeAll();
  });

  it('falls back to 1000ms when the watch path cannot be stat()ed', async () => {
    const w = new PlatformWatcher({ healthCheckInterval: 0, primaryMethod: 'polling' });
    await w.createWatcher(path.join(root, 'does-not-exist'));
    expect(C.__instances[0].options.interval).toBe(1000);
    await w.closeAll();
  });
});

describe('PlatformWatcher — watcher health', () => {
  it('returns the health status for a known watcher', async () => {
    const w = makeWatcher();
    const id = await createAndGetId(w, '/p');
    const h = w.getWatcherHealth(id);
    expect(h).not.toBeNull();
    expect(h?.isHealthy).toBe(true);
    expect(h?.failureCount).toBe(0);
    await w.closeAll();
  });

  it('returns null for an unknown watcher id', () => {
    expect(makeWatcher().getWatcherHealth('nope')).toBeNull();
  });

  it('returns a map of all watcher statuses when no id is given', async () => {
    const w = makeWatcher();
    await createAndGetId(w, '/a');
    await createAndGetId(w, '/b');
    const all = w.getWatcherHealth() as Map<string, any>;
    expect(all).toBeInstanceOf(Map);
    expect(all.size).toBe(2);
    await w.closeAll();
  });

  it('marks the watcher unhealthy and emits watcher-unhealthy on error', async () => {
    // enableFallbacks:false avoids setupFallbackWatcher clobbering the health
    // entry (a source quirk) so the error handler mutates the same object
    // getWatcherHealth returns.
    const w = makeWatcher();
    const id = await createAndGetId(w, '/p', { enableFallbacks: false });
    const unhealthy = vi.fn();
    w.on('watcher-unhealthy', unhealthy);

    C.__instances[0].emit('error', new Error('boom'));

    expect(unhealthy).toHaveBeenCalledTimes(1);
    expect(unhealthy.mock.calls[0][0].failureCount).toBe(1);
    const h = w.getWatcherHealth(id);
    expect(h?.isHealthy).toBe(false);
    expect(h?.failureCount).toBe(1);
    await w.closeAll();
  });

  it('resets health on the ready event', async () => {
    const w = makeWatcher();
    const id = await createAndGetId(w, '/p', { enableFallbacks: false });
    const fake = C.__instances[0];
    fake.emit('error', new Error('boom'));
    expect(w.getWatcherHealth(id)?.isHealthy).toBe(false);

    fake.emit('ready');

    const h = w.getWatcherHealth(id);
    expect(h?.isHealthy).toBe(true);
    expect(h?.failureCount).toBe(0);
    expect(h?.lastError).toBeUndefined();
    await w.closeAll();
  });

  it('activates a fallback once failures reach maxRetries', async () => {
    const w = new PlatformWatcher({ healthCheckInterval: 0, maxRetries: 1 });
    const fb = vi.fn();
    w.on('fallback-activated', fb);
    await createAndGetId(w, '/p');

    C.__instances[0].emit('error', new Error('boom'));
    // activateFallback is fire-and-forget async; flush the macrotask queue.
    await new Promise((r) => setTimeout(r, 20));

    expect(fb).toHaveBeenCalledTimes(1);
    await w.closeAll();
  });
});

describe('PlatformWatcher — periodic health checking', () => {
  it('emits health-check-completed on the interval and reports totals', async () => {
    const w = new PlatformWatcher({ healthCheckInterval: 20 });
    const completed = vi.fn();
    w.on('health-check-completed', completed);
    await createAndGetId(w, '/p');

    await new Promise((r) => setTimeout(r, 70));

    expect(completed.mock.calls.length).toBeGreaterThanOrEqual(1);
    const payload = completed.mock.calls[0][0];
    expect(payload.totalWatchers).toBe(1);
    expect(payload.healthyWatchers).toBe(1);
    await w.closeAll();
  });
});

describe('PlatformWatcher — closeAll', () => {
  it('closes every watcher, clears state, and emits all-watchers-closed', async () => {
    const w = makeWatcher();
    await createAndGetId(w, '/a');
    await createAndGetId(w, '/b');
    expect(w.getActiveWatchersCount()).toBe(2);
    const closed = vi.fn();
    w.on('all-watchers-closed', closed);

    await w.closeAll();

    expect(closed).toHaveBeenCalledTimes(1);
    expect(w.getActiveWatchersCount()).toBe(0);
    expect((w.getWatcherHealth() as Map<string, any>).size).toBe(0);
    expect(C.__instances[0].closed).toBe(true);
    expect(C.__instances[1].closed).toBe(true);
  });

  it('stops the periodic health-check timer', async () => {
    const w = new PlatformWatcher({ healthCheckInterval: 20 });
    const completed = vi.fn();
    w.on('health-check-completed', completed);
    await createAndGetId(w, '/p');

    await w.closeAll();
    const before = completed.mock.calls.length;
    await new Promise((r) => setTimeout(r, 70));
    expect(completed.mock.calls.length).toBe(before); // no further ticks
  });
});

describe('PlatformWatcher — platform capability probing', () => {
  it('probes native and polling watching and cleans up the temp dir', async () => {
    platformMock.mockReturnValue('darwin');
    const w = makeWatcher();
    const result = await w.testPlatformCapabilities();
    expect(result.platform).toBe('darwin');
    expect(result.nativeWatching).toBe(true);
    expect(result.polling).toBe(true);
    expect(result.fsevents).toBe(true); // darwin: fsevents === nativeWatching
    expect(result.inotify).toBe(false);
    expect(result.maxWatchedFiles).toBe(524288);
    expect(result.recommendations).toEqual([]);
    await w.closeAll();
  });

  it('recommends increasing limits on platforms with a low watch cap', async () => {
    platformMock.mockReturnValue('sunos');
    const w = makeWatcher();
    const result = await w.testPlatformCapabilities();
    expect(result.maxWatchedFiles).toBe(1024);
    expect(result.recommendations).toContain(
      'Consider increasing system file watch limits for large projects',
    );
    await w.closeAll();
  });
});

describe('PlatformWatcher — factories & standalone helpers', () => {
  it('createPlatformWatcher returns a configured instance', () => {
    platformMock.mockReturnValue('linux');
    const w = createPlatformWatcher({ healthCheckInterval: 0, primaryMethod: 'polling' });
    expect(w).toBeInstanceOf(PlatformWatcher);
    expect((w as any).fallbackOptions.primaryMethod).toBe('polling');
  });

  it('getPlatformCapabilities standalone helper returns detected capabilities', () => {
    platformMock.mockReturnValue('win32');
    const caps = getPlatformCapabilities();
    expect(caps.platform).toBe('win32');
    expect(caps.recommendedWatchMethod).toBe('native');
  });

  it('testPlatformWatching standalone helper returns a probe result', async () => {
    const result = await testPlatformWatching();
    expect(result).toHaveProperty('nativeWatching');
    expect(result).toHaveProperty('polling');
    expect(result).toHaveProperty('recommendations');
  });
});
