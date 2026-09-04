import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { manageDevMode } from '../../src/commands/dev-mode';

// Covers src/commands/dev-mode.ts — the `dev` command (start/stop/restart/status/
// interactive/default). The command is orchestration over configWatcher +
// setupConfigHotReload + processManager + resolveProfile; we mock all of those
// (plus prompts and flushOutput) so every dispatch branch is exercised without
// actually keeping the process alive or touching the filesystem.

const mocks = vi.hoisted(() => ({
  isActive: vi.fn(),
  getStatus: vi.fn(),
  stopWatching: vi.fn(),
  updateOptions: vi.fn(),
  forceReload: vi.fn(),
  on: vi.fn(),
  setupConfigHotReload: vi.fn(),
  keepRunning: vi.fn(),
  resolveProfile: vi.fn(),
  prompts: vi.fn(),
  flushOutput: vi.fn(),
}));

vi.mock('../../src/utils/config-watcher', () => ({
  configWatcher: {
    isActive: mocks.isActive,
    getStatus: mocks.getStatus,
    stopWatching: mocks.stopWatching,
    updateOptions: mocks.updateOptions,
    forceReload: mocks.forceReload,
    on: mocks.on,
  },
  setupConfigHotReload: mocks.setupConfigHotReload,
}));
vi.mock('../../src/commands/profile', () => ({ resolveProfile: mocks.resolveProfile }));
vi.mock('../../src/utils/error-handler', () => ({ processManager: { keepRunning: mocks.keepRunning } }));
vi.mock('../../src/utils/spinner', async () => {
  const actual = await vi.importActual<typeof import('../../src/utils/spinner')>(
    '../../src/utils/spinner'
  );
  return { ...actual, flushOutput: mocks.flushOutput };
});
vi.mock('prompts', () => ({ default: mocks.prompts }));

function spinner() {
  return { setText: vi.fn(), stop: vi.fn(), start: vi.fn(), succeed: vi.fn(), fail: vi.fn(), warn: vi.fn() } as any;
}

const ACTIVE_STATUS = {
  isWatching: true,
  watchedPaths: ['/a.yaml', '/b.yaml'],
  options: {
    debounceMs: 500,
    validateOnChange: true,
    autoBackup: true,
    restoreOnError: true,
    includeWorkspaces: true,
    verbose: false,
  },
};
const INACTIVE_STATUS = { ...ACTIVE_STATUS, isWatching: false, watchedPaths: [] };

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
  mocks.getStatus.mockReturnValue(INACTIVE_STATUS);
  mocks.isActive.mockReturnValue(false);
  mocks.setupConfigHotReload.mockResolvedValue(undefined);
});

afterEach(() => {
  logSpy.mockRestore();
});

describe('dev-mode — start', () => {
  it('warns and returns when development mode is already active', async () => {
    mocks.isActive.mockReturnValue(true);
    await manageDevMode({ start: true });
    expect(mocks.setupConfigHotReload).not.toHaveBeenCalled();
    expect(logged()).toContain('already active');
  });

  it('starts hot-reload with options derived from flags and keeps the process running', async () => {
    mocks.isActive.mockReturnValue(false);
    await manageDevMode({ start: true, verbose: true, debounce: 250, noBackup: true });
    expect(mocks.setupConfigHotReload).toHaveBeenCalledTimes(1);
    const opts = mocks.setupConfigHotReload.mock.calls[0][0];
    expect(opts.enabled).toBe(true);
    expect(opts.verbose).toBe(true);
    expect(opts.debounceMs).toBe(250);
    expect(opts.autoBackup).toBe(false); // --no-backup
    expect(mocks.keepRunning).toHaveBeenCalled();
    expect(logged()).toContain('Development mode active');
  });

  it('reports and returns when the requested profile is not found', async () => {
    mocks.resolveProfile.mockResolvedValue(null);
    await manageDevMode({ start: true, profile: 'ghost' });
    expect(logged()).toContain('Profile "ghost" not found');
    expect(mocks.setupConfigHotReload).not.toHaveBeenCalled();
  });

  it('applies a found profile and starts with its services', async () => {
    mocks.resolveProfile.mockResolvedValue({
      environment: 'development',
      framework: 'react',
      description: 'dev profile',
      config: { env: { NODE_ENV: 'development' } },
    });
    await manageDevMode({ start: true, profile: 'dev', services: ['web'] });
    // env vars applied
    expect(process.env.NODE_ENV).toBe('development');
    expect(mocks.setupConfigHotReload).toHaveBeenCalled();
    const opts = mocks.setupConfigHotReload.mock.calls[0][0];
    expect(opts.profile).toBeTruthy();
    expect(opts.services).toEqual(['web']);
  });
});

describe('dev-mode — stop', () => {
  it('warns when development mode is not running', async () => {
    mocks.isActive.mockReturnValue(false);
    await manageDevMode({ stop: true });
    expect(mocks.stopWatching).not.toHaveBeenCalled();
    expect(logged()).toContain('not active');
  });

  it('stops watching when development mode is active', async () => {
    mocks.isActive.mockReturnValue(true);
    const s = spinner();
    await manageDevMode({ stop: true, spinner: s });
    expect(mocks.stopWatching).toHaveBeenCalled();
    expect(s.succeed).toHaveBeenCalled();
    expect(logged()).toContain('deactivated');
  });
});

describe('dev-mode — restart', () => {
  it('stops (if active) then starts again', async () => {
    mocks.isActive.mockReturnValueOnce(true).mockReturnValue(false);
    await manageDevMode({ restart: true });
    expect(mocks.stopWatching).toHaveBeenCalled();
    expect(mocks.setupConfigHotReload).toHaveBeenCalled();
  });
});

describe('dev-mode — status', () => {
  it('renders the active status with watched paths and options (human)', async () => {
    mocks.getStatus.mockReturnValue(ACTIVE_STATUS);
    await manageDevMode({ status: true });
    const out = logged();
    expect(out).toContain('Development Mode Status');
    expect(out).toContain('Active');
    expect(out).toContain('Watched paths (2)');
    expect(out).toContain('Debounce: 500ms');
  });

  it('renders the inactive status (human)', async () => {
    mocks.getStatus.mockReturnValue(INACTIVE_STATUS);
    await manageDevMode({ status: true });
    expect(logged()).toContain('Inactive');
  });

  it('emits the status as JSON in json mode', async () => {
    mocks.getStatus.mockReturnValue(ACTIVE_STATUS);
    await manageDevMode({ status: true, json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.isWatching).toBe(true);
    expect(json.watchedPaths).toHaveLength(2);
  });
});

describe('dev-mode — default', () => {
  it('shows status when already active', async () => {
    mocks.isActive.mockReturnValue(true);
    mocks.getStatus.mockReturnValue(ACTIVE_STATUS);
    await manageDevMode({});
    expect(logged()).toContain('Development Mode Status');
  });

  it('shows help when inactive', async () => {
    mocks.isActive.mockReturnValue(false);
    await manageDevMode({});
    const out = logged();
    expect(out).toContain('Development Mode - Configuration Hot-Reloading');
    expect(out).toContain('Quick Start');
  });
});

describe('dev-mode — interactive', () => {
  it('starts via interactiveStart when the user picks start', async () => {
    mocks.getStatus.mockReturnValue(INACTIVE_STATUS);
    mocks.prompts
      .mockResolvedValueOnce({ action: 'start' }) // menu
      .mockResolvedValueOnce({ verbose: true, debounce: 300, validation: true, autoBackup: false, restoreOnError: true, includeWorkspaces: true }); // interactiveStart
    await manageDevMode({ interactive: true });
    const opts = mocks.setupConfigHotReload.mock.calls[0][0];
    expect(opts.verbose).toBe(true);
    expect(opts.autoBackup).toBe(false);
  });

  it('stops when the user picks stop', async () => {
    mocks.getStatus.mockReturnValue(ACTIVE_STATUS);
    mocks.isActive.mockReturnValue(true);
    mocks.prompts.mockResolvedValue({ action: 'stop' });
    await manageDevMode({ interactive: true });
    expect(mocks.stopWatching).toHaveBeenCalled();
  });

  it('updates options when the user picks configure', async () => {
    mocks.getStatus.mockReturnValue(ACTIVE_STATUS);
    // First prompts call = action menu ("configure"), second = config options.
    mocks.prompts
      .mockResolvedValueOnce({ action: 'configure' })
      .mockResolvedValueOnce({ verbose: true, debounceMs: 700 });
    await manageDevMode({ interactive: true });
    expect(mocks.updateOptions).toHaveBeenCalledWith({ verbose: true, debounceMs: 700 });
    expect(logged()).toContain('Configuration updated');
  });

  it('force-reloads when the user picks force-reload', async () => {
    mocks.getStatus.mockReturnValue(ACTIVE_STATUS);
    mocks.prompts.mockResolvedValue({ action: 'force-reload' });
    mocks.forceReload.mockResolvedValue(undefined);
    await manageDevMode({ interactive: true });
    expect(mocks.forceReload).toHaveBeenCalled();
    expect(logged()).toContain('force-reloaded');
  });

  it('returns early when the interactive prompt is cancelled', async () => {
    mocks.prompts.mockResolvedValue({ action: undefined });
    await manageDevMode({ interactive: true });
    expect(mocks.setupConfigHotReload).not.toHaveBeenCalled();
  });
});

describe('dev-mode — error handling', () => {
  it('fails the spinner and rethrows when setup rejects', async () => {
    mocks.setupConfigHotReload.mockRejectedValue(new Error('watcher broke'));
    const s = spinner();
    await expect(manageDevMode({ start: true, spinner: s })).rejects.toThrow('watcher broke');
    expect(s.fail).toHaveBeenCalled();
  });
});
