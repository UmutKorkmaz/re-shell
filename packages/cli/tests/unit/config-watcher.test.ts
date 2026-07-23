import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

/**
 * `config-watcher` reaches into the real config manager and `chokidar` for file
 * watching. We stub `./config` (deterministic `CONFIG_PATHS` + controllable
 * `configManager`) and `./config-backup` so the watcher logic — debounce,
 * validation, dedup, backup/restore, event emission — can be exercised
 * deterministically without touching the user's real `~/.re-shell` files.
 */
const mocks = vi.hoisted(() => {
  const paths = {
    GLOBAL_DIR: '/tmp/re-shell-cw-test-dir',
    GLOBAL_CONFIG: '/tmp/re-shell-cw-test-dir/config.yaml',
    PROJECT_CONFIG: '.re-shell/config.yaml',
    WORKSPACE_CONFIG: 're-shell.workspaces.yaml',
    WORKSPACE_DIR_CONFIG: '.re-shell/workspace.yaml',
  };
  const configManager = {
    loadGlobalConfig: vi.fn(),
    loadProjectConfig: vi.fn(),
    loadWorkspaceConfig: vi.fn(),
  };
  return {
    paths,
    configManager,
    setPaths: (p: Record<string, string>) => Object.assign(paths, p),
  };
});

vi.mock('../../src/utils/config', () => ({
  CONFIG_PATHS: mocks.paths,
  configManager: mocks.configManager,
}));

// Imported AFTER the vi.mock calls so the module under test receives the stubs.
// eslint-disable-next-line import/first
import { ConfigWatcher, configWatcher, setupConfigHotReload } from '../../src/utils/config-watcher';
// eslint-disable-next-line import/first
import type { ConfigChangeEvent } from '../../src/utils/config-watcher';

/* eslint-disable @typescript-eslint/no-explicit-any */

function collect(watcher: ConfigWatcher, ...events: string[]) {
  const seen: Record<string, any[]> = {};
  for (const e of events) {
    seen[e] = [];
    watcher.on(e, (payload: any) => seen[e].push(payload));
  }
  return seen;
}

const validGlobal = { version: '1.0.0', packageManager: 'pnpm' };
const validProject = { name: 'app', version: '1.0.0' };
const validWorkspace = { name: 'web', type: 'app' };

describe('ConfigWatcher — constructor + options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configManager.loadGlobalConfig.mockResolvedValue(validGlobal);
    mocks.configManager.loadProjectConfig.mockResolvedValue(validProject);
    mocks.configManager.loadWorkspaceConfig.mockResolvedValue(validWorkspace);
  });

  it('applies documented defaults', () => {
    const w = new ConfigWatcher();
    const opts = (w as any).options;
    expect(opts).toMatchObject({
      enabled: true,
      debounceMs: 500,
      validateOnChange: true,
      autoBackup: false,
      restoreOnError: false,
      verbose: false,
      includeWorkspaces: true,
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    });
  });

  it('merges supplied options over the defaults', () => {
    const w = new ConfigWatcher({
      debounceMs: 100,
      verbose: true,
      includeWorkspaces: false,
      services: ['web'],
      profile: { id: 'p' },
    });
    const opts = (w as any).options;
    expect(opts.debounceMs).toBe(100);
    expect(opts.verbose).toBe(true);
    expect(opts.includeWorkspaces).toBe(false);
    expect(opts.services).toEqual(['web']);
    expect(opts.profile).toEqual({ id: 'p' });
    // Untouched defaults persist.
    expect(opts.validateOnChange).toBe(true);
  });

  it('exposes a shared singleton', () => {
    expect(configWatcher).toBeInstanceOf(ConfigWatcher);
  });
});

describe('ConfigWatcher — status + options mutation', () => {
  it('reports inactive with no watched paths initially', () => {
    const w = new ConfigWatcher();
    expect(w.isActive()).toBe(false);
    const status = w.getStatus();
    expect(status.isWatching).toBe(false);
    expect(status.watchedPaths).toEqual([]);
    expect(status.lastChanges).toEqual([]);
  });

  it('updateOptions merges new options without restarting when inactive', () => {
    const w = new ConfigWatcher();
    w.updateOptions({ debounceMs: 42, verbose: true });
    const opts = (w as any).options;
    expect(opts.debounceMs).toBe(42);
    expect(opts.verbose).toBe(true);
    expect(w.isActive()).toBe(false);
  });
});

describe('ConfigWatcher — validateConfig (private, via bracket)', () => {
  const w = new ConfigWatcher();
  const validate = (cfg: any, type: string) => (w as any).validateConfig(cfg, type);

  it('rejects a non-object config', async () => {
    await expect(validate(null, 'global')).rejects.toThrow(/must be an object/);
    await expect(validate('nope', 'global')).rejects.toThrow(/must be an object/);
  });

  it('requires version for global, name for project, name+type for workspace', async () => {
    await expect(validate({}, 'global')).rejects.toThrow(/version/);
    await expect(validate({ version: '1.0.0' }, 'global')).resolves.toBeUndefined();
    await expect(validate({}, 'project')).rejects.toThrow(/name/);
    await expect(validate({ name: 'app' }, 'project')).resolves.toBeUndefined();
    await expect(validate({}, 'workspace')).rejects.toThrow(/name, type/);
    await expect(validate({ name: 'w', type: 'app' }, 'workspace')).resolves.toBeUndefined();
  });
});

describe('ConfigWatcher — processConfigChange (private, via bracket)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configManager.loadGlobalConfig.mockResolvedValue(validGlobal);
    mocks.configManager.loadProjectConfig.mockResolvedValue(validProject);
    mocks.configManager.loadWorkspaceConfig.mockResolvedValue(validWorkspace);
  });

  const call = (w: ConfigWatcher, file: string, type: any, change: any) =>
    (w as any).processConfigChange(file, type, change);

  it('loads, validates and emits config-changed for a new global config', async () => {
    const w = new ConfigWatcher();
    const seen = collect(w, 'config-changed', 'config-error');
    await call(w, '/x/config.yaml', 'global', 'changed');
    expect(seen['config-changed']).toHaveLength(1);
    expect(seen['config-changed'][0]).toMatchObject({
      type: 'changed',
      configType: 'global',
      config: validGlobal,
    });
    expect(seen['config-error']).toHaveLength(0);
  });

  it('skips emission when the config is unchanged (dedup)', async () => {
    const w = new ConfigWatcher();
    const seen = collect(w, 'config-changed');
    await call(w, '/x/config.yaml', 'global', 'changed');
    await call(w, '/x/config.yaml', 'global', 'changed');
    // Second identical change produces no event.
    expect(seen['config-changed']).toHaveLength(1);
  });

  it('emits again when the config actually changes', async () => {
    const w = new ConfigWatcher();
    const seen = collect(w, 'config-changed');
    mocks.configManager.loadGlobalConfig.mockResolvedValueOnce(validGlobal);
    mocks.configManager.loadGlobalConfig.mockResolvedValueOnce({ ...validGlobal, packageManager: 'yarn' });
    await call(w, '/x/config.yaml', 'global', 'changed');
    await call(w, '/x/config.yaml', 'global', 'changed');
    expect(seen['config-changed']).toHaveLength(2);
  });

  it('handles unlinked by clearing state and emitting without loading', async () => {
    const w = new ConfigWatcher();
    (w as any).lastConfigs.set('/x/config.yaml', validGlobal);
    const seen = collect(w, 'config-changed');
    await call(w, '/x/config.yaml', 'global', 'unlinked');
    expect(seen['config-changed']).toHaveLength(1);
    expect(seen['config-changed'][0].type).toBe('unlinked');
    expect(mocks.configManager.loadGlobalConfig).not.toHaveBeenCalled();
    expect((w as any).lastConfigs.has('/x/config.yaml')).toBe(false);
  });

  it('emits config-error when validation fails', async () => {
    const w = new ConfigWatcher();
    const seen = collect(w, 'config-changed', 'config-error');
    mocks.configManager.loadGlobalConfig.mockResolvedValue({ /* no version */ });
    await call(w, '/x/config.yaml', 'global', 'changed');
    expect(seen['config-error']).toHaveLength(1);
    expect(seen['config-changed']).toHaveLength(0);
    expect(seen['config-error'][0].error).toBeInstanceOf(Error);
  });

  it('swallows backup failures and still reloads when autoBackup is enabled', async () => {
    // autoBackup triggers createChangeBackup, which dynamically requires
    // './config-backup'. That require cannot resolve a .ts module in the test
    // runtime, so createChangeBackup fails internally and the failure is
    // swallowed by its own try/catch — the reload must still complete.
    const w = new ConfigWatcher({ autoBackup: true });
    const seen = collect(w, 'config-changed', 'config-error');
    await call(w, '/x/config.yaml', 'global', 'changed');
    expect(seen['config-changed']).toHaveLength(1);
    expect(seen['config-error']).toHaveLength(0);
  });

  it('does not run the backup path for added/unlinked events even with autoBackup', async () => {
    const w = new ConfigWatcher({ autoBackup: true });
    const seen = collect(w, 'config-changed');
    await call(w, '/x/config.yaml', 'global', 'added');
    // 'added' bypasses the autoBackup branch entirely and still emits.
    expect(seen['config-changed']).toHaveLength(1);
  });

  it('emits config-error on validation failure even with restoreOnError enabled', async () => {
    // restoreOnError attempts restoreFromBackup, but no backup id exists (the
    // backup require failed), so restore is skipped — the error event still fires.
    const w = new ConfigWatcher({ restoreOnError: true, autoBackup: true });
    const seen = collect(w, 'config-changed', 'config-error');
    mocks.configManager.loadGlobalConfig.mockResolvedValue({ /* invalid */ });
    await call(w, '/x/config.yaml', 'global', 'changed');
    expect(seen['config-error']).toHaveLength(1);
    expect(seen['config-error'][0].error).toBeInstanceOf(Error);
  });

  it('skips validation when validateOnChange is disabled', async () => {
    const w = new ConfigWatcher({ validateOnChange: false });
    const seen = collect(w, 'config-changed', 'config-error');
    mocks.configManager.loadGlobalConfig.mockResolvedValue({ /* would be invalid */ });
    await call(w, '/x/config.yaml', 'global', 'changed');
    expect(seen['config-changed']).toHaveLength(1);
    expect(seen['config-error']).toHaveLength(0);
  });

  it('loads workspace config from the grandparent directory of the file', async () => {
    const w = new ConfigWatcher();
    const seen = collect(w, 'config-changed');
    const file = path.join('/ws', 'apps', 'web', '.re-shell', 'config.yaml');
    await call(w, file, 'workspace', 'changed');
    expect(mocks.configManager.loadWorkspaceConfig).toHaveBeenCalledWith(
      path.join('/ws', 'apps', 'web'),
    );
    expect(seen['config-changed'][0].configType).toBe('workspace');
  });
});

describe('ConfigWatcher — handleConfigChange debounce (private, via bracket)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configManager.loadGlobalConfig.mockResolvedValue(validGlobal);
  });

  it('records a debounce timer keyed by file path', () => {
    vi.useFakeTimers();
    try {
      const w = new ConfigWatcher({ debounceMs: 1000 });
      (w as any).handleConfigChange('/x/config.yaml', 'global', 'changed');
      expect((w as any).debounceTimers.has('/x/config.yaml')).toBe(true);
    } finally {
      vi.useRealTimers();
      // Clean up any pending timer to avoid cross-test leakage.
      (new ConfigWatcher() as any).debounceTimers.clear();
    }
  });

  it('resets the timer when the same path changes again before firing', () => {
    vi.useFakeTimers();
    try {
      const w = new ConfigWatcher({ debounceMs: 1000 });
      (w as any).handleConfigChange('/x/config.yaml', 'global', 'changed');
      const first = (w as any).debounceTimers.get('/x/config.yaml');
      (w as any).handleConfigChange('/x/config.yaml', 'global', 'changed');
      const second = (w as any).debounceTimers.get('/x/config.yaml');
      expect(second).not.toBe(first);
      expect((w as any).debounceTimers.size).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ConfigWatcher — forceReload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configManager.loadGlobalConfig.mockResolvedValue(validGlobal);
    mocks.configManager.loadProjectConfig.mockResolvedValue(validProject);
  });

  it('emits config-changed for global and project configs', async () => {
    const w = new ConfigWatcher();
    const seen = collect(w, 'config-changed');
    await w.forceReload();
    const types = seen['config-changed'].map((e) => e.configType);
    expect(types).toEqual(expect.arrayContaining(['global', 'project']));
    expect(seen['config-changed'][0]).toMatchObject({ type: 'changed', config: validGlobal });
  });

  it('tolerates a missing project config (swallowed, global still emitted)', async () => {
    const w = new ConfigWatcher();
    const seen = collect(w, 'config-changed');
    mocks.configManager.loadProjectConfig.mockRejectedValue(new Error('no project'));
    await expect(w.forceReload()).resolves.toBeUndefined();
    expect(seen['config-changed'].some((e) => e.configType === 'global')).toBe(true);
  });

  it('rethrows when the global config cannot be loaded', async () => {
    const w = new ConfigWatcher();
    mocks.configManager.loadGlobalConfig.mockRejectedValue(new Error('boom'));
    await expect(w.forceReload()).rejects.toThrow('boom');
  });
});

describe('ConfigWatcher — startWatching / stopWatching (smoke)', () => {
  let home: string;

  beforeEach(() => {
    vi.clearAllMocks();
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-home-'));
    const globalDir = path.join(home, '.re-shell');
    const globalConfig = path.join(globalDir, 'config.yaml');
    mocks.setPaths({ GLOBAL_DIR: globalDir, GLOBAL_CONFIG: globalConfig });
    fs.ensureDirSync(globalDir);
    fs.writeFileSync(globalConfig, 'version: 1.0.0\n');
    mocks.configManager.loadGlobalConfig.mockResolvedValue(validGlobal);
    mocks.configManager.loadProjectConfig.mockResolvedValue(validProject);
    mocks.configManager.loadWorkspaceConfig.mockResolvedValue(validWorkspace);
  });

  afterEach(() => {
    fs.removeSync(home);
  });

  it('starts, reports active, watches the global path, then stops cleanly', async () => {
    const w = new ConfigWatcher();
    expect(w.isActive()).toBe(false);

    const seen = collect(w, 'watching-started', 'watching-stopped');
    await w.startWatching();

    expect(w.isActive()).toBe(true);
    expect(seen['watching-started']).toHaveLength(1);
    expect(w.getStatus().watchedPaths).toContain(mocks.paths.GLOBAL_CONFIG);

    await w.stopWatching();
    expect(w.isActive()).toBe(false);
    expect(seen['watching-stopped']).toHaveLength(1);
  });

  it('no-ops when disabled', async () => {
    const w = new ConfigWatcher({ enabled: false });
    const seen = collect(w, 'watching-started');
    await w.startWatching();
    expect(w.isActive()).toBe(false);
    expect(seen['watching-started']).toHaveLength(0);
  });

  it('no-ops on a second start while already watching', async () => {
    const w = new ConfigWatcher();
    await w.startWatching();
    const before = w.getStatus().watchedPaths.length;
    await w.startWatching(); // idempotent
    expect(w.getStatus().watchedPaths.length).toBe(before);
    await w.stopWatching();
  });

  it('stopWatching is a no-op when not watching', async () => {
    const w = new ConfigWatcher();
    await expect(w.stopWatching()).resolves.toBeUndefined();
    expect(w.isActive()).toBe(false);
  });

  it('updateOptions restarts the watcher with new options when active', async () => {
    const w = new ConfigWatcher();
    const seen = collect(w, 'watching-started', 'watching-stopped');
    await w.startWatching();
    w.updateOptions({ debounceMs: 250 });
    // Restart is async (fire-and-forget startWatching); allow it to settle.
    await new Promise((r) => setTimeout(r, 50));
    expect((w as any).options.debounceMs).toBe(250);
    expect(seen['watching-stopped'].length).toBeGreaterThanOrEqual(1);
    await w.stopWatching();
  });
});

describe('setupConfigHotReload', () => {
  let home: string;

  beforeEach(() => {
    vi.clearAllMocks();
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-setup-'));
    const globalDir = path.join(home, '.re-shell');
    mocks.setPaths({ GLOBAL_DIR: globalDir, GLOBAL_CONFIG: path.join(globalDir, 'config.yaml') });
    fs.ensureDirSync(globalDir);
    fs.writeFileSync(path.join(globalDir, 'config.yaml'), 'version: 1.0.0\n');
    mocks.configManager.loadGlobalConfig.mockResolvedValue(validGlobal);
    mocks.configManager.loadProjectConfig.mockResolvedValue(validProject);
    mocks.configManager.loadWorkspaceConfig.mockResolvedValue(validWorkspace);
  });

  afterEach(() => {
    fs.removeSync(home);
  });

  it('creates, wires default handlers and starts a watcher', async () => {
    const w = await setupConfigHotReload();
    expect(w).toBeInstanceOf(ConfigWatcher);
    expect(w.isActive()).toBe(true);
    await w.stopWatching();
  });
});
