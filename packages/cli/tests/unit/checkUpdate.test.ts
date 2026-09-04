import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { checkForUpdates } from '../../src/utils/checkUpdate';

/**
 * Controllable `https` mock. `checkUpdate.fetchLatestVersion` issues a GET to
 * registry.npmjs.org; in tests we drive it by setting the response payload or
 * flipping it into an error/timeout mode. State is shared between the mock
 * factory and the tests via `vi.hoisted`.
 */
const { setHttpsState, getHttpsRequest } = vi.hoisted(() => {
  let payload = JSON.stringify({ 'dist-tags': { latest: '0.0.0' }, versions: {} });
  let mode: 'ok' | 'error' = 'ok';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const request = vi.fn((_opts: unknown, cb: (res: unknown) => void): any => {
    let errorHandler: (() => void) | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req: any = {
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'error') errorHandler = handler;
        return req;
      }),
      end: vi.fn(() => {
        process.nextTick(() => {
          if (mode === 'error') {
            errorHandler?.();
            return;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const res: any = {
            on: vi.fn((event: string, handler: (arg?: unknown) => void) => {
              if (event === 'data') handler(payload);
              else if (event === 'end') handler();
              return res;
            }),
          };
          cb(res);
        });
      }),
      destroy: vi.fn(),
    };
    return req;
  });
  return {
    setHttpsState: (p: string, m: 'ok' | 'error') => {
      payload = p;
      mode = m;
      (request as unknown as { mockClear: () => void }).mockClear();
    },
    getHttpsRequest: () => request,
  };
});

vi.mock('https', () => ({ request: getHttpsRequest() }));

function payload(latest: string): string {
  return JSON.stringify({ 'dist-tags': { latest }, versions: {} });
}

function tmpHome(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-update-'));
}

async function readCache(home: string): Promise<Record<string, unknown> | null> {
  const cacheFile = path.join(home, '.re-shell-update-check');
  if (!(await fs.pathExists(cacheFile))) return null;
  return fs.readJson(cacheFile).catch(() => null);
}

describe('checkForUpdates', () => {
  let home: string;
  let origHome: string | undefined;
  let origUserProfile: string | undefined;
  let origCI: string | undefined;
  let origSkip: string | undefined;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    home = tmpHome();
    origHome = process.env.HOME;
    origUserProfile = process.env.USERPROFILE;
    origCI = process.env.CI;
    origSkip = process.env.RE_SHELL_SKIP_UPDATE_CHECK;
    process.env.HOME = home;
    delete process.env.USERPROFILE;
    delete process.env.CI;
    delete process.env.RE_SHELL_SKIP_UPDATE_CHECK;
    setHttpsState(payload('0.0.0'), 'ok');
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (origHome === undefined) delete process.env.HOME;
    else process.env.HOME = origHome;
    if (origUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = origUserProfile;
    if (origCI === undefined) delete process.env.CI;
    else process.env.CI = origCI;
    if (origSkip === undefined) delete process.env.RE_SHELL_SKIP_UPDATE_CHECK;
    else process.env.RE_SHELL_SKIP_UPDATE_CHECK = origSkip;
    logSpy.mockRestore();
    fs.removeSync(home);
  });

  describe('skip conditions', () => {
    it('returns immediately without writing cache when CI is set', async () => {
      process.env.CI = 'true';
      await checkForUpdates('1.0.0');
      expect(await readCache(home)).toBeNull();
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('returns immediately without writing cache when RE_SHELL_SKIP_UPDATE_CHECK is set', async () => {
      process.env.RE_SHELL_SKIP_UPDATE_CHECK = '1';
      await checkForUpdates('1.0.0');
      expect(await readCache(home)).toBeNull();
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe('cache replay (fresh cache, < 24h)', () => {
    async function seedCache(entry: Record<string, unknown>): Promise<void> {
      await fs.writeJson(path.join(home, '.re-shell-update-check'), entry);
    }

    it('replays the notification when cached hasUpdate is true and the cached version is still newer', async () => {
      await seedCache({
        timestamp: Date.now(),
        hasUpdate: true,
        latestVersion: '2.0.0',
      });
      await checkForUpdates('1.0.0');
      const out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).toContain('Update available');
      expect(out).toContain('2.0.0');
      // The replay path returns early and must NOT hit the registry.
      expect(getHttpsRequest().mock.calls).toHaveLength(0);
    });

    it('rewrites the cache to hasUpdate=false and skips the notification when the cached version is no longer newer', async () => {
      await seedCache({
        timestamp: Date.now(),
        hasUpdate: true,
        latestVersion: '1.5.0',
      });
      // current version is now NEWER than the cached latest
      await checkForUpdates('2.0.0');
      const out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).not.toContain('Update available');
      const cache = await readCache(home);
      expect(cache).not.toBeNull();
      expect(cache?.hasUpdate).toBe(false);
      expect(cache?.latestVersion).toBe('1.5.0');
    });

    it('returns silently and leaves the cache untouched when cached hasUpdate is false', async () => {
      const before = {
        timestamp: Date.now(),
        hasUpdate: false,
        latestVersion: '1.0.0',
      };
      await seedCache(before);
      await checkForUpdates('0.9.0');
      const out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).not.toContain('Update available');
      // No rewrite on the hasUpdate=false path.
      expect(await readCache(home)).toEqual(before);
    });

    it('treats an invalid currentVersion as not-newer and rewrites hasUpdate=false', async () => {
      await seedCache({
        timestamp: Date.now(),
        hasUpdate: true,
        latestVersion: '2.0.0',
      });
      await checkForUpdates('not-a-version');
      const out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).not.toContain('Update available');
      const cache = await readCache(home);
      expect(cache?.hasUpdate).toBe(false);
    });
  });

  describe('fresh check (missing or stale cache → registry)', () => {
    it('writes hasUpdate=true and notifies when the registry reports a newer version', async () => {
      setHttpsState(payload('3.0.0'), 'ok');
      await checkForUpdates('1.0.0');
      const out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).toContain('Update available');
      expect(out).toContain('3.0.0');
      const cache = await readCache(home);
      expect(cache?.hasUpdate).toBe(true);
      expect(cache?.latestVersion).toBe('3.0.0');
      expect(typeof cache?.timestamp).toBe('number');
    });

    it('writes hasUpdate=false and does not notify when the registry reports an older version', async () => {
      setHttpsState(payload('0.5.0'), 'ok');
      await checkForUpdates('1.0.0');
      const out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).not.toContain('Update available');
      const cache = await readCache(home);
      expect(cache?.hasUpdate).toBe(false);
      expect(cache?.latestVersion).toBe('0.5.0');
    });

    it('writes hasUpdate=false when the registry returns no version (error/timeout)', async () => {
      setHttpsState(payload('0.0.0'), 'error');
      await checkForUpdates('1.0.0');
      const out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).not.toContain('Update available');
      const cache = await readCache(home);
      // fetchLatestVersion resolves null → isNewerVersion(null) is false → hasUpdate false
      expect(cache?.hasUpdate).toBe(false);
    });

    it('re-checks the registry when the cache is older than 24 hours', async () => {
      const stale = {
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25h ago
        hasUpdate: false,
        latestVersion: '1.0.0',
      };
      await fs.writeJson(path.join(home, '.re-shell-update-check'), stale);
      setHttpsState(payload('4.0.0'), 'ok');
      await checkForUpdates('1.0.0');
      const out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).toContain('Update available');
      expect(out).toContain('4.0.0');
      const cache = await readCache(home);
      expect(cache?.hasUpdate).toBe(true);
      expect(cache?.latestVersion).toBe('4.0.0');
    });
  });
});
