import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { manageWorkspaceState } from '../../src/commands/workspace-state';
import { ValidationError } from '../../src/utils/error-handler';

// UNIT coverage for src/commands/workspace-state.ts — the `workspace-state`
// command (NOT utils/workspace-state, covered by the open workspace-state.test.ts
// from PR #133). Named workspace-state-command.test.ts to avoid that collision.
// manageWorkspaceState dispatches (status/clear/backup/restore/cache/optimize/
// interactive) and delegates to factory functions from utils/workspace-state;
// we mock those factories + prompts and spy console.log.

const mocks = vi.hoisted(() => ({
  initializeWorkspaceStorage: vi.fn(),
  createWorkspaceStateManager: vi.fn(),
  createWorkspaceCacheManager: vi.fn(),
  prompts: vi.fn(),
  // state manager methods
  clearState: vi.fn(),
  backupState: vi.fn(),
  restoreState: vi.fn(),
  getStateStatistics: vi.fn(),
  // cache manager methods
  cacheClear: vi.fn(),
  invalidatePattern: vi.fn(),
  getCacheStatistics: vi.fn(),
  optimize: vi.fn(),
}));

const stateManager = {
  clearState: mocks.clearState,
  backupState: mocks.backupState,
  restoreState: mocks.restoreState,
  getStateStatistics: mocks.getStateStatistics,
};
const cacheManager = {
  clear: mocks.cacheClear,
  invalidatePattern: mocks.invalidatePattern,
  getCacheStatistics: mocks.getCacheStatistics,
  optimize: mocks.optimize,
};

vi.mock('../../src/utils/workspace-state', () => ({
  initializeWorkspaceStorage: mocks.initializeWorkspaceStorage,
  createWorkspaceStateManager: mocks.createWorkspaceStateManager,
  createWorkspaceCacheManager: mocks.createWorkspaceCacheManager,
}));
vi.mock('prompts', () => ({ default: mocks.prompts }));

function spinner() {
  return { setText: vi.fn(), stop: vi.fn(), succeed: vi.fn(), fail: vi.fn() } as any;
}

const STATE_STATS = {
  workspaceCount: 3,
  lastModified: '2024-01-01T00:00:00.000Z',
  stateFileSize: 2048,
  oldestWorkspace: 'oldest',
  newestWorkspace: 'newest',
};
const CACHE_STATS = {
  totalEntries: 50,
  memoryEntries: 10,
  totalSize: 4096,
  hitRate: 0.85,
  missRate: 0.15,
  lastOptimized: '2024-01-02T00:00:00.000Z',
};

let logSpy: ReturnType<typeof vi.spyOn>;
function logged(): string {
  return logSpy.mock.calls.map(a => a.join(' ')).join('\n');
}
function loggedJson(find: (s: string) => boolean): any {
  return JSON.parse(logSpy.mock.calls.map(a => a.join('')).find(find)!);
}

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset());
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  mocks.initializeWorkspaceStorage.mockResolvedValue({ stateManager, cacheManager });
  mocks.createWorkspaceStateManager.mockResolvedValue(stateManager);
  mocks.createWorkspaceCacheManager.mockResolvedValue(cacheManager);
  mocks.getStateStatistics.mockReturnValue(STATE_STATS);
  mocks.getCacheStatistics.mockReturnValue(CACHE_STATS);
});

afterEach(() => {
  logSpy.mockRestore();
});

describe('workspace-state — status (default)', () => {
  it('emits state + cache stats as JSON in json mode', async () => {
    await manageWorkspaceState({ status: true, json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.state.workspaceCount).toBe(3);
    expect(json.cache.hitRate).toBe(0.85);
  });

  it('renders the human status overview with formatted bytes and available commands', async () => {
    await manageWorkspaceState({ status: true });
    const out = logged();
    expect(out).toContain('Workspace State & Cache Status');
    expect(out).toContain('Workspaces tracked: 3');
    expect(out).toContain('Oldest workspace: oldest');
    expect(out).toContain('Available Commands');
  });

  it('omits oldest/newest lines when those stats are absent', async () => {
    mocks.getStateStatistics.mockReturnValue({ ...STATE_STATS, oldestWorkspace: null, newestWorkspace: null });
    await manageWorkspaceState({});
    expect(logged()).not.toContain('Oldest workspace');
  });
});

describe('workspace-state — clear', () => {
  it('clears the workspace state via the state manager', async () => {
    const s = spinner();
    await manageWorkspaceState({ clear: true, spinner: s });
    expect(mocks.clearState).toHaveBeenCalled();
    expect(logged()).toContain('state cleared');
  });
});

describe('workspace-state — backup', () => {
  it('creates a backup and reports the returned path', async () => {
    mocks.backupState.mockResolvedValue('/tmp/state.bak');
    await manageWorkspaceState({ backup: true });
    expect(mocks.backupState).toHaveBeenCalledWith(undefined);
    expect(logged()).toContain('/tmp/state.bak');
  });
});

describe('workspace-state — restore', () => {
  it('throws a ValidationError when no --file is given', async () => {
    await expect(manageWorkspaceState({ restore: true })).rejects.toBeInstanceOf(ValidationError);
    expect(mocks.restoreState).not.toHaveBeenCalled();
  });

  it('restores from the given file', async () => {
    mocks.restoreState.mockResolvedValue(undefined);
    await manageWorkspaceState({ restore: true, file: '/tmp/state.bak' });
    expect(mocks.restoreState).toHaveBeenCalledWith('/tmp/state.bak');
    expect(logged()).toContain('Restored from: /tmp/state.bak');
  });
});

describe('workspace-state — cache', () => {
  it('clears STATE (not cache) when both --cache and --clear are set (clear wins)', async () => {
    // Dispatch precedence: the top-level `clear` branch is checked before
    // `cache`, so { cache, clear } routes to clearWorkspaceState. The
    // cache-clear sub-branch is only reachable via the interactive clear-cache
    // action (covered below), which calls manageCacheOperations directly.
    await manageWorkspaceState({ cache: true, clear: true });
    expect(mocks.clearState).toHaveBeenCalled();
    expect(mocks.cacheClear).not.toHaveBeenCalled();
    expect(logged()).toContain('state cleared');
  });

  it('invalidates entries matching --pattern and reports the count', async () => {
    mocks.invalidatePattern.mockResolvedValue(7);
    await manageWorkspaceState({ cache: true, pattern: 'config.*' });
    expect(mocks.invalidatePattern).toHaveBeenCalledWith('config.*');
    expect(logged()).toContain('Invalidated 7 cache entries');
  });

  it('renders cache statistics by default (human)', async () => {
    await manageWorkspaceState({ cache: true });
    const out = logged();
    expect(out).toContain('Cache Statistics');
    expect(out).toContain('Total entries: 50');
    expect(out).toContain('Miss rate');
  });

  it('emits cache statistics as JSON in json mode', async () => {
    await manageWorkspaceState({ cache: true, json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.totalEntries).toBe(50);
  });
});

describe('workspace-state — optimize', () => {
  it('reports removed entries and freed space (human)', async () => {
    mocks.optimize.mockResolvedValue({ removedEntries: 4, freedSpace: 8192 });
    await manageWorkspaceState({ optimize: true });
    const out = logged();
    expect(out).toContain('Removed entries: 4');
    expect(out).toContain('storage optimized');
  });

  it('notes when no expired entries were found', async () => {
    mocks.optimize.mockResolvedValue({ removedEntries: 0, freedSpace: 0 });
    await manageWorkspaceState({ optimize: true });
    expect(logged()).toContain('No expired entries found');
  });

  it('emits the optimize result as JSON in json mode', async () => {
    mocks.optimize.mockResolvedValue({ removedEntries: 2, freedSpace: 512 });
    await manageWorkspaceState({ optimize: true, json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.removedEntries).toBe(2);
  });
});

describe('workspace-state — interactive', () => {
  it('dispatches to status when the user picks "status"', async () => {
    mocks.prompts.mockResolvedValue({ action: 'status' });
    await manageWorkspaceState({ interactive: true });
    expect(logged()).toContain('Workspace State & Cache Status');
  });

  it('dispatches to clear-cache when the user picks "clear-cache"', async () => {
    mocks.prompts.mockResolvedValue({ action: 'clear-cache' });
    await manageWorkspaceState({ interactive: true });
    expect(mocks.cacheClear).toHaveBeenCalled();
  });

  it('prompts for a file and restores when the user picks "restore"', async () => {
    mocks.prompts
      .mockResolvedValueOnce({ action: 'restore' })
      .mockResolvedValueOnce({ file: '/tmp/state.bak' });
    mocks.restoreState.mockResolvedValue(undefined);
    await manageWorkspaceState({ interactive: true });
    expect(mocks.restoreState).toHaveBeenCalledWith('/tmp/state.bak');
  });

  it('prompts for a pattern and invalidates when the user picks "pattern-cleanup"', async () => {
    mocks.prompts
      .mockResolvedValueOnce({ action: 'pattern-cleanup' })
      .mockResolvedValueOnce({ pattern: 'config.*' });
    mocks.invalidatePattern.mockResolvedValue(3);
    await manageWorkspaceState({ interactive: true });
    expect(mocks.invalidatePattern).toHaveBeenCalledWith('config.*');
  });

  it('renders detailed statistics with a low-hit-rate recommendation', async () => {
    mocks.prompts.mockResolvedValue({ action: 'detailed-stats' });
    mocks.getCacheStatistics.mockReturnValue({ ...CACHE_STATS, hitRate: 0.5 });
    await manageWorkspaceState({ interactive: true });
    const out = logged();
    expect(out).toContain('Detailed Workspace Storage Statistics');
    expect(out).toContain('increasing cache TTL');
  });

  it('returns early when the interactive prompt is cancelled', async () => {
    mocks.prompts.mockResolvedValue({ action: undefined });
    await manageWorkspaceState({ interactive: true });
    expect(mocks.getStateStatistics).not.toHaveBeenCalled();
  });
});

describe('workspace-state — error handling', () => {
  it('fails the spinner and rethrows when an operation rejects', async () => {
    mocks.clearState.mockRejectedValue(new Error('locked'));
    const s = spinner();
    await expect(manageWorkspaceState({ clear: true, spinner: s })).rejects.toThrow('locked');
    expect(s.fail).toHaveBeenCalled();
  });
});
