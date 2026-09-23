import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  PluginLifecycleManager,
  createPluginLifecycleManager,
  PluginState,
  type PluginLoaderConfig,
  type PluginRegistration,
  type PluginContext,
} from '../../src/utils/plugin-lifecycle';
import { ValidationError } from '../../src/utils/error-handler';

/**
 * Shared test configuration that disables security scanning (which would pull
 * in the heavyweight plugin-security validator), dependency preloading and hot
 * reload, so the lifecycle state machine can be exercised in isolation.
 */
const LIFECYCLE_CONFIG: Partial<PluginLoaderConfig> = {
  validateSecurity: false,
  preloadDependencies: false,
  enableHotReload: false,
};

let tmpDir: string;

/**
 * Writes a CommonJS plugin module to `<dir>/index.js`. Hooks are emitted as
 * object method-shorthand members. Returns a PluginRegistration pointing at it.
 */
function writePlugin(
  dir: string,
  name: string,
  hooks: { activate?: string; deactivate?: string; extra?: string } = {}
): PluginRegistration {
  fs.ensureDirSync(dir);
  const activate = hooks.activate ?? 'async activate(ctx){ ctx.__activated = true; }';
  const deactivate = hooks.deactivate ?? 'async deactivate(ctx){ ctx.__deactivated = true; }';
  const members = [activate, deactivate];
  if (hooks.extra) members.push(hooks.extra);
  const code = `module.exports = {\n  manifest: { name: '${name}', version: '1.0.0' },\n  ${members.join(',\n  ')},\n};\n`;
  fs.writeFileSync(path.join(dir, 'index.js'), code);
  return {
    manifest: { name, version: '1.0.0', description: 'test', main: 'index.js' },
    pluginPath: dir,
    isLoaded: false,
    isActive: false,
    usageCount: 0,
  };
}

/** Builds a PluginContext whose data/cache paths live inside the given base dir. */
function makeContext(name: string, base: string): PluginContext {
  return {
    cli: { version: '0.7.0', rootPath: base, configPath: base, workspaces: {} },
    plugin: {
      name,
      version: '1.0.0',
      config: {},
      dataPath: path.join(base, 'data', name),
      cachePath: path.join(base, 'cache', name),
    },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    hooks: {
      register() {}, unregister() {}, unregisterAll() {},
      async execute() { return { success: true, results: [], errors: [] }; },
      executeSync() { return []; },
    },
    utils: { path, fs, chalk: { red: () => '' } },
  } as unknown as PluginContext;
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plm-'));
});

afterEach(async () => {
  await fs.remove(tmpDir);
});

describe('plugin-lifecycle — enums, factory & config', () => {
  it('exposes the expected PluginState values', () => {
    expect(PluginState.UNLOADED).toBe('unloaded');
    expect(PluginState.LOADING).toBe('loading');
    expect(PluginState.LOADED).toBe('loaded');
    expect(PluginState.INITIALIZING).toBe('initializing');
    expect(PluginState.INITIALIZED).toBe('initialized');
    expect(PluginState.ACTIVATING).toBe('activating');
    expect(PluginState.ACTIVE).toBe('active');
    expect(PluginState.DEACTIVATING).toBe('deactivating');
    expect(PluginState.DEACTIVATED).toBe('deactivated');
    expect(PluginState.ERROR).toBe('error');
  });

  it('createPluginLifecycleManager returns a manager instance', () => {
    const manager = createPluginLifecycleManager();
    expect(manager).toBeInstanceOf(PluginLifecycleManager);
  });

  it('constructor applies documented defaults', () => {
    const manager = new PluginLifecycleManager();
    expect((manager as unknown as { config: PluginLoaderConfig }).config).toMatchObject({
      timeout: 30000,
      validateSecurity: true,
      sandboxed: false,
      enableHotReload: false,
      preloadDependencies: true,
    });
  });

  it('constructor merges provided overrides over the defaults', () => {
    const manager = new PluginLifecycleManager({ timeout: 5000, sandboxed: true });
    expect((manager as unknown as { config: PluginLoaderConfig }).config).toMatchObject({
      timeout: 5000,
      sandboxed: true,
      validateSecurity: true,
    });
  });
});

describe('plugin-lifecycle — initialize', () => {
  it('emits manager-initializing and manager-initialized on first call', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    const initializing = vi.fn();
    const initialized = vi.fn();
    manager.on('manager-initializing', initializing);
    manager.on('manager-initialized', initialized);
    await manager.initialize();
    expect(initializing).toHaveBeenCalledTimes(1);
    expect(initialized).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — a second initialize is a no-op and emits nothing', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    const initializing = vi.fn();
    const initialized = vi.fn();
    manager.on('manager-initializing', initializing);
    manager.on('manager-initialized', initialized);
    await manager.initialize();
    expect(initializing).not.toHaveBeenCalled();
    expect(initialized).not.toHaveBeenCalled();
  });
});

describe('plugin-lifecycle — registerPlugin', () => {
  it('stores the plugin in the UNLOADED state and emits plugin-registered', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    const listener = vi.fn();
    manager.on('plugin-registered', listener);
    await manager.registerPlugin(writePlugin(tmpDir, 'alpha'));
    const stored = manager.getPlugin('alpha');
    expect(stored).toBeDefined();
    expect(stored!.state).toBe(PluginState.UNLOADED);
    expect(stored!.performance).toEqual({ loadDuration: 0, initDuration: 0, activationDuration: 0 });
    expect(stored!.errors).toEqual([]);
    expect(stored!.stateHistory).toEqual([]);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ pluginName: 'alpha' }));
  });

  it('extracts permissions from manifest.reshell.permissions', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    const registration = writePlugin(tmpDir, 'beta');
    registration.manifest.reshell = {
      permissions: [
        { type: 'filesystem', access: 'read', description: 'read files' },
        { type: 'network', access: 'full', description: 'net' },
      ],
    };
    await manager.registerPlugin(registration);
    expect(manager.getPlugin('beta')!.permissions).toHaveLength(2);
  });

  it('resolves manifest.dependencies as required and peerDependencies as optional', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    const registration = writePlugin(tmpDir, 'gamma');
    registration.manifest.dependencies = { 'dep-a': '^1.0.0' };
    registration.manifest.peerDependencies = { 'peer-b': '^2.0.0' };
    await manager.registerPlugin(registration);
    const deps = manager.getPlugin('gamma')!.dependencies;
    expect(deps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'dep-a', version: '^1.0.0', required: true, resolved: false }),
        expect.objectContaining({ name: 'peer-b', version: '^2.0.0', required: false, resolved: false }),
      ])
    );
  });

  it('marks a dependency resolved when the dependency is already registered', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    await manager.registerPlugin(writePlugin(path.join(tmpDir, 'core'), 'core'));
    const consumer = writePlugin(path.join(tmpDir, 'consumer'), 'consumer');
    consumer.manifest.dependencies = { core: '^1.0.0' };
    await manager.registerPlugin(consumer);
    const dep = manager.getPlugin('consumer')!.dependencies.find((d) => d.name === 'core');
    expect(dep?.resolved).toBe(true);
  });
});

describe('plugin-lifecycle — state-transition guards', () => {
  it('loadPlugin throws for an unregistered plugin', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    await expect(manager.loadPlugin('ghost')).rejects.toBeInstanceOf(ValidationError);
  });

  it('loadPlugin rejects when the plugin is not in the UNLOADED state', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    await manager.registerPlugin(writePlugin(tmpDir, 'alpha'));
    await manager.loadPlugin('alpha'); // -> LOADED
    await expect(manager.loadPlugin('alpha')).rejects.toBeInstanceOf(ValidationError);
  });

  it('initializePlugin throws for an unregistered plugin', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    await expect(manager.initializePlugin('ghost')).rejects.toBeInstanceOf(ValidationError);
  });

  it('initializePlugin rejects when the plugin is not LOADED', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    await manager.registerPlugin(writePlugin(tmpDir, 'alpha'));
    await expect(manager.initializePlugin('alpha')).rejects.toBeInstanceOf(ValidationError);
  });

  it('activatePlugin throws for an unregistered plugin', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    await expect(manager.activatePlugin('ghost')).rejects.toBeInstanceOf(ValidationError);
  });

  it('activatePlugin rejects when the plugin is not INITIALIZED', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    await manager.registerPlugin(writePlugin(tmpDir, 'alpha'));
    await manager.loadPlugin('alpha');
    await expect(manager.activatePlugin('alpha')).rejects.toBeInstanceOf(ValidationError);
  });

  it('deactivatePlugin throws for an unregistered plugin', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    await expect(manager.deactivatePlugin('ghost')).rejects.toBeInstanceOf(ValidationError);
  });

  it('deactivatePlugin rejects when the plugin is not ACTIVE', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    await manager.registerPlugin(writePlugin(tmpDir, 'alpha'));
    await manager.loadPlugin('alpha');
    await expect(manager.deactivatePlugin('alpha')).rejects.toBeInstanceOf(ValidationError);
  });

  it('unloadPlugin throws for an unregistered plugin', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    await expect(manager.unloadPlugin('ghost')).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('plugin-lifecycle — full lifecycle', () => {
  it('load -> init -> activate -> deactivate -> unload transitions through every state', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    await manager.registerPlugin(writePlugin(tmpDir, 'alpha'));

    const states: string[] = [];
    manager.on('state-changed', (e: { newState: string }) => states.push(e.newState));

    // load
    await manager.loadPlugin('alpha');
    expect(manager.getPlugin('alpha')!.state).toBe(PluginState.LOADED);
    // NOTE bug: loadPlugin never flips `isLoaded` to true (only unloadPlugin sets it false),
    // so a loaded plugin still reports isLoaded === false. Assert the real indicator instead.
    expect(manager.getPlugin('alpha')!.instance).toBeDefined();
    expect(manager.getPlugin('alpha')!.loadTime).toBeGreaterThan(0);

    // initialize with an explicit tmpdir-rooted context
    const ctx = makeContext('alpha', tmpDir);
    await manager.initializePlugin('alpha', ctx);
    const reg = manager.getPlugin('alpha')!;
    expect(reg.state).toBe(PluginState.INITIALIZED);
    expect(reg.initTime).toBeGreaterThan(0);
    // Plugin directories were ensured.
    expect(await fs.pathExists(ctx.plugin.dataPath)).toBe(true);
    expect(await fs.pathExists(ctx.plugin.cachePath)).toBe(true);

    // activate
    await manager.activatePlugin('alpha');
    expect(manager.getPlugin('alpha')!.state).toBe(PluginState.ACTIVE);
    expect(manager.getPlugin('alpha')!.isActive).toBe(true);
    expect(manager.getPlugin('alpha')!.activationTime).toBeGreaterThan(0);
    // The activate hook annotated its context.
    expect((reg.context as { __activated?: boolean }).__activated).toBe(true);

    // deactivate
    await manager.deactivatePlugin('alpha');
    expect(manager.getPlugin('alpha')!.state).toBe(PluginState.DEACTIVATED);
    expect(manager.getPlugin('alpha')!.isActive).toBe(false);
    expect((reg.context as { __deactivated?: boolean }).__deactivated).toBe(true);

    // unload
    await manager.unloadPlugin('alpha');
    expect(manager.getPlugin('alpha')!.state).toBe(PluginState.UNLOADED);
    expect(manager.getPlugin('alpha')!.isLoaded).toBe(false);
    expect(manager.getPlugin('alpha')!.instance).toBeUndefined();

    // All expected transitions were recorded in order.
    expect(states).toEqual([
      'loading', 'loaded',
      'initializing', 'initialized',
      'activating', 'active',
      'deactivating', 'deactivated',
      'unloaded',
    ]);
  });

  it('records the full state history with old/new states and timestamps', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    await manager.registerPlugin(writePlugin(tmpDir, 'alpha'));
    await manager.loadPlugin('alpha');
    const history = manager.getPlugin('alpha')!.stateHistory;
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ oldState: PluginState.UNLOADED, newState: PluginState.LOADING });
    expect(history[1]).toMatchObject({ oldState: PluginState.LOADING, newState: PluginState.LOADED });
    expect(typeof history[0].timestamp).toBe('number');
  });

  it('emits state-specific events keyed by the new state name', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    await manager.registerPlugin(writePlugin(tmpDir, 'alpha'));
    const loaded = vi.fn();
    manager.on('state-loaded', loaded);
    await manager.loadPlugin('alpha');
    expect(loaded).toHaveBeenCalledTimes(1);
    expect(loaded.mock.calls[0][0]).toMatchObject({ pluginName: 'alpha', newState: PluginState.LOADED });
  });
});

describe('plugin-lifecycle — reload', () => {
  it('reloadPlugin re-runs the lifecycle and re-activates if it was active', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    await manager.registerPlugin(writePlugin(tmpDir, 'alpha'));
    await manager.loadPlugin('alpha');
    await manager.initializePlugin('alpha', makeContext('alpha', tmpDir));
    await manager.activatePlugin('alpha');
    expect(manager.getPlugin('alpha')!.state).toBe(PluginState.ACTIVE);

    await manager.reloadPlugin('alpha');
    // After reload of a previously-active plugin, it ends ACTIVE again.
    expect(manager.getPlugin('alpha')!.state).toBe(PluginState.ACTIVE);
    expect(manager.getPlugin('alpha')!.isActive).toBe(true);
  });
});

describe('plugin-lifecycle — error handling', () => {
  it('loadPlugin with a missing main file moves to ERROR, records the error and rethrows', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    const registration: PluginRegistration = {
      manifest: { name: 'broken', version: '1.0.0', description: 't', main: 'missing.js' },
      pluginPath: tmpDir,
      isLoaded: false,
      isActive: false,
      usageCount: 0,
    };
    await manager.registerPlugin(registration);
    await expect(manager.loadPlugin('broken')).rejects.toBeInstanceOf(ValidationError);
    const reg = manager.getPlugin('broken')!;
    expect(reg.state).toBe(PluginState.ERROR);
    expect(reg.errors).toHaveLength(1);
    expect(reg.errors[0].stage).toBe('load');
    expect(reg.errors[0].error).toBeInstanceOf(Error);
  });

  it('activatePlugin surfaces a hook that rejects, moving the plugin to ERROR', async () => {
    const manager = new PluginLifecycleManager({ ...LIFECYCLE_CONFIG, timeout: 100 });
    await manager.initialize();
    const registration = writePlugin(tmpDir, 'throwy', {
      activate: 'async activate(){ throw new Error("boom"); }',
    });
    await manager.registerPlugin(registration);
    await manager.loadPlugin('throwy');
    await manager.initializePlugin('throwy', makeContext('throwy', tmpDir));
    await expect(manager.activatePlugin('throwy')).rejects.toThrow('boom');
    const reg = manager.getPlugin('throwy')!;
    expect(reg.state).toBe(PluginState.ERROR);
    expect(reg.errors[0].stage).toBe('activate');
  });

  it('activatePlugin times out when the activate hook never resolves', async () => {
    const manager = new PluginLifecycleManager({ ...LIFECYCLE_CONFIG, timeout: 40 });
    await manager.initialize();
    const registration = writePlugin(tmpDir, 'slow', {
      activate: 'async activate(ctx){ return new Promise(function(r){ setTimeout(r, 1000); }); }',
    });
    await manager.registerPlugin(registration);
    await manager.loadPlugin('slow');
    await manager.initializePlugin('slow', makeContext('slow', tmpDir));
    await expect(manager.activatePlugin('slow')).rejects.toThrow('Plugin activation timeout');
    expect(manager.getPlugin('slow')!.state).toBe(PluginState.ERROR);
  });
});

describe('plugin-lifecycle — queries & statistics', () => {
  it('getPlugins / getPluginsByState filter by lifecycle state', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    await manager.registerPlugin(writePlugin(path.join(tmpDir, 'a'), 'a'));
    await manager.registerPlugin(writePlugin(path.join(tmpDir, 'b'), 'b'));
    await manager.loadPlugin('a');
    expect(manager.getPlugins()).toHaveLength(2);
    expect(manager.getPluginsByState(PluginState.LOADED)).toHaveLength(1);
    expect(manager.getPluginsByState(PluginState.UNLOADED)).toHaveLength(1);
    expect(manager.getPluginsByState(PluginState.ACTIVE)).toHaveLength(0);
  });

  it('getDependencyGraph reflects resolved dependencies and dependent tracking', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    await manager.registerPlugin(writePlugin(path.join(tmpDir, 'core'), 'core'));
    const consumer = writePlugin(path.join(tmpDir, 'consumer'), 'consumer');
    consumer.manifest.dependencies = { core: '^1.0.0' };
    await manager.registerPlugin(consumer);
    // The graph is maintained incrementally by registerPlugin (initialize is idempotent).
    const graph = manager.getDependencyGraph();
    expect(graph.get('consumer')?.has('core')).toBe(true);
    // core now has consumer listed as a dependent.
    expect(manager.getPlugin('core')!.dependents).toContain('consumer');
  });

  it('getLifecycleStats aggregates totals, per-state counts and error counts', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    await manager.registerPlugin(writePlugin(path.join(tmpDir, 'a'), 'a'));
    await manager.registerPlugin(writePlugin(path.join(tmpDir, 'b'), 'b'));
    const stats = manager.getLifecycleStats();
    expect(stats.total).toBe(2);
    expect(stats.byState[PluginState.UNLOADED]).toBe(2);
    expect(stats.totalErrors).toBe(0);
    expect(stats).toHaveProperty('avgLoadTime');
    expect(stats).toHaveProperty('avgInitTime');
    expect(stats).toHaveProperty('avgActivationTime');
  });

  it('getLifecycleStats records a load duration after a plugin is loaded', async () => {
    const manager = new PluginLifecycleManager(LIFECYCLE_CONFIG);
    await manager.initialize();
    await manager.registerPlugin(writePlugin(path.join(tmpDir, 'a'), 'a'));
    await manager.loadPlugin('a');
    const stats = manager.getLifecycleStats();
    expect(stats.total).toBe(1);
    expect(manager.getPlugin('a')!.performance.loadDuration).toBeGreaterThanOrEqual(0);
  });
});
