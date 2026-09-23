import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  managePlugins,
  discoverPlugins,
  installPlugin,
  uninstallPlugin,
  showPluginInfo,
  enablePlugin,
  disablePlugin,
  updatePlugins,
  validatePlugin,
  clearPluginCache,
  showPluginStats,
  reloadPlugin,
  showPluginHooks,
  executeHook,
  listHookTypes,
} from '../../src/commands/plugin';
import { ValidationError } from '../../src/utils/error-handler';
import {
  createPluginRegistry,
  type PluginRegistry,
} from '../../src/utils/plugin-system';
import { PluginState } from '../../src/utils/plugin-lifecycle';
import {
  installPluginFromIdentifier,
  PluginInstallError,
} from '../../src/utils/plugin-installer';
import { HookType } from '../../src/utils/plugin-hooks';

// Covers src/commands/plugin.ts — the `re-shell plugin` command group (1029
// lines, 13 exported handlers). The plugin-system registry and the installer
// are mocked with a scripted fake registry so every lifecycle transition is
// observable; the PluginState enum and HookType enum are the REAL ones so
// state-machine branching is exercised against production values. console.log
// and stdout writes are spied for render assertions.

vi.mock('../../src/utils/plugin-system', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../src/utils/plugin-system')>();
  return {
    ...actual,
    createPluginRegistry: vi.fn(),
  };
});
vi.mock('../../src/utils/plugin-installer', () => ({
  installPluginFromIdentifier: vi.fn(),
  PluginInstallError: class PluginInstallError extends Error {
    details?: unknown;
    constructor(message: string, details?: unknown) {
      super(message);
      this.name = 'PluginInstallError';
      this.details = details;
    }
  },
}));
const spinnerMessages: string[] = [];
vi.mock('../../src/utils/spinner', () => ({
  createSpinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    setText: vi.fn(),
    succeed: (msg?: string) => {
      spinnerMessages.push(String(msg ?? ''));
    },
    fail: vi.fn(),
  }),
}));

// enableJsonMode() replaces process.stdout.write with a gate that swallows
// every direct write (plugin.ts's json branches write via process.stdout.write
// instead of the gated emitJson) — neutralize it so stdout stays observable.
vi.mock('../../src/utils/json-output', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../src/utils/json-output')>();
  return {
    ...actual,
    enableJsonMode: () => () => {},
  };
});

const registryMock = {
  initialize: vi.fn(),
  getManagedPlugins: vi.fn(),
  getManagedPlugin: vi.fn(),
  getPlugins: vi.fn(),
  discoverPlugins: vi.fn(),
  unloadPlugin: vi.fn(),
  unregisterPlugin: vi.fn(),
  loadPlugin: vi.fn(),
  initializePlugin: vi.fn(),
  activatePlugin: vi.fn(),
  deactivatePlugin: vi.fn(),
  reloadPlugin: vi.fn(),
  clearCache: vi.fn(),
  getLifecycleStats: vi.fn(),
  getHookStats: vi.fn(),
  getHookSystem: vi.fn(),
  executeHooks: vi.fn(),
};

/** A minimal-but-shape-complete managed plugin registration. */
function fakePlugin(overrides: Record<string, unknown> = {}) {
  return {
    manifest: {
      name: 'my-plugin',
      version: '1.2.3',
      description: 'A test plugin',
      main: 'dist/index.js',
      ...(overrides.manifest as object),
    },
    pluginPath: '/plugins/my-plugin',
    isLoaded: false,
    isActive: false,
    usageCount: 0,
    state: PluginState.UNLOADED,
    dependencies: [],
    dependents: [],
    lastUsed: undefined,
    stateHistory: [],
    errors: [],
    performance: { loadDuration: 5, initDuration: 3, activationDuration: 7 },
    ...overrides,
  };
}

let logs: string[];
let logSpy: ReturnType<typeof vi.spyOn>;
let writeSpy: ReturnType<typeof vi.spyOn>;

function output(): string {
  const consoleOut = logs.join('\n');
  const stdoutOut = writeSpy.mock.calls.map(c => String(c[0])).join('');
  return consoleOut + '\n' + stdoutOut + '\n' + spinnerMessages.join('\n');
}

beforeEach(() => {
  vi.mocked(createPluginRegistry).mockReturnValue(registryMock as unknown as PluginRegistry);
  registryMock.initialize.mockResolvedValue(undefined);
  registryMock.getManagedPlugins.mockReturnValue([]);
  registryMock.getPlugins.mockReturnValue([]);
  registryMock.unregisterPlugin.mockResolvedValue(true);
  vi.clearAllMocks();
  registryMock.initialize.mockResolvedValue(undefined);
  registryMock.getManagedPlugins.mockReturnValue([]);
  registryMock.getPlugins.mockReturnValue([]);
  registryMock.unregisterPlugin.mockResolvedValue(true);
  logs = [];
  spinnerMessages.length = 0;
  logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  });
  writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
});

afterEach(() => {
  logSpy.mockRestore();
  writeSpy.mockRestore();
});

describe('plugin — command group', () => {
  describe('managePlugins (list)', () => {
    it('prints the empty hint when no plugins are managed', async () => {
      await managePlugins();
      expect(output()).toContain('No plugins found');
      expect(output()).toContain('re-shell plugin discover');
    });

    it('lists managed plugins with state dot and usage', async () => {
      registryMock.getManagedPlugins.mockReturnValue([
        fakePlugin({ usageCount: 4 }),
        fakePlugin({
          manifest: { name: 'other', version: '0.0.1', description: 'second' },
          pluginPath: '/plugins/other',
          state: PluginState.ACTIVE,
        }),
      ]);

      await managePlugins();

      expect(output()).toContain('Installed Plugins (2)');
      expect(output()).toContain('my-plugin');
      expect(output()).toContain('v1.2.3');
    });

    it('renders verbose path and usage lines with verbose: true', async () => {
      registryMock.getManagedPlugins.mockReturnValue([fakePlugin({ usageCount: 9 })]);

      await managePlugins({ verbose: true });

      expect(output()).toContain('Path: /plugins/my-plugin');
      expect(output()).toContain('Usage: 9 times');
    });

    it('emits a JSON array envelope in json mode', async () => {
      registryMock.getManagedPlugins.mockReturnValue([fakePlugin({ isLoaded: true })]);

      await managePlugins({ json: true });

      const raw = writeSpy.mock.calls.map(c => String(c[0])).join('');
      const parsed = JSON.parse(raw);
      expect(parsed[0]).toMatchObject({
        name: 'my-plugin',
        version: '1.2.3',
        isLoaded: true,
        isActive: false,
        state: 'unloaded',
      });
    });

    it('wraps a registry failure as ValidationError', async () => {
      registryMock.initialize.mockRejectedValue(new Error('disk exploded'));

      await expect(managePlugins()).rejects.toThrow(ValidationError);
      await expect(managePlugins()).rejects.toThrow('Plugin management failed');
    });
  });

  describe('discoverPlugins', () => {
    it('prints found plugins and suppresses skipped unless verbose', async () => {
      registryMock.discoverPlugins.mockResolvedValue({
        found: [fakePlugin()],
        errors: [],
        skipped: [{ path: '/skipped', reason: 'no manifest' }],
      });

      await discoverPlugins();

      const out = output();
      expect(out).toContain('Found 1 plugins');
      expect(out).toContain('my-plugin');
      expect(out).not.toContain('Skipped');
    });

    it('prints per-path errors when discovery partially fails', async () => {
      registryMock.discoverPlugins.mockResolvedValue({
        found: [],
        errors: [{ path: '/bad/plugin', error: new Error('manifest invalid') }],
        skipped: [],
      });

      await discoverPlugins();

      const out = output();
      expect(out).toContain('Errors (1)');
      expect(out).toContain('/bad/plugin');
      expect(out).toContain('manifest invalid');
    });

    it('lists skipped entries in verbose mode', async () => {
      registryMock.discoverPlugins.mockResolvedValue({
        found: [],
        errors: [],
        skipped: [{ path: '/skipped', reason: 'no manifest' }],
      });

      await discoverPlugins({ verbose: true });

      expect(output()).toContain('Skipped (1)');
      expect(output()).toContain('no manifest');
    });

    it('forwards source/includeDisabled/includeDev/timeout to the registry', async () => {
      registryMock.discoverPlugins.mockResolvedValue({ found: [], errors: [], skipped: [] });

      await discoverPlugins({ source: 'npm', includeDisabled: true, includeDev: false, timeout: 2500 });

      expect(registryMock.discoverPlugins).toHaveBeenCalledWith(
        expect.objectContaining({
          sources: ['npm'],
          includeDisabled: true,
          includeDev: false,
          timeout: 2500,
          useCache: false,
        })
      );
    });

    it('defaults to all three sources with fresh discovery', async () => {
      registryMock.discoverPlugins.mockResolvedValue({ found: [], errors: [], skipped: [] });

      await discoverPlugins();

      expect(registryMock.discoverPlugins).toHaveBeenCalledWith(
        expect.objectContaining({ sources: ['local', 'npm', 'builtin'] })
      );
    });

    it('wraps a discovery failure as ValidationError', async () => {
      registryMock.discoverPlugins.mockRejectedValue(new Error('network down'));

      await expect(discoverPlugins()).rejects.toThrow('Plugin discovery failed');
    });
  });

  describe('installPlugin', () => {
    it('installs via the real installer with workspaceRoot cwd and reports success', async () => {
      vi.mocked(installPluginFromIdentifier).mockResolvedValue({
        name: 'cool-plugin',
        version: '2.0.0',
        source: 'npm',
        path: '/plugins/cool-plugin',
        dryRun: false,
      } as never);

      await installPlugin('cool-plugin');

      expect(installPluginFromIdentifier).toHaveBeenCalledWith('cool-plugin', {
        workspaceRoot: expect.any(String),
        dryRun: false,
        force: false,
      });
      expect(output()).toContain('installed successfully');
    });

    it('dry-run reports resolved-and-validated without installing', async () => {
      vi.mocked(installPluginFromIdentifier).mockResolvedValue({
        name: 'cool-plugin',
        version: '2.0.0',
        source: 'local',
        path: '/plugins/cool-plugin',
        dryRun: true,
      } as never);

      await installPlugin('cool-plugin', { dryRun: true });

      expect(installPluginFromIdentifier).toHaveBeenCalledWith(
        'cool-plugin',
        expect.objectContaining({ dryRun: true })
      );
      expect(output()).toContain('resolved and validated (dry run)');
    });

    it('prints verbose source and location lines', async () => {
      vi.mocked(installPluginFromIdentifier).mockResolvedValue({
        name: 'p',
        version: '1.0.0',
        source: 'git',
        path: '/plugins/p',
        dryRun: false,
      } as never);

      await installPlugin('p', { verbose: true });

      expect(output()).toContain('Source: git');
      expect(output()).toContain('Location: /plugins/p');
    });

    it('emits PLUGIN_INSTALL_ERROR (json) instead of throwing', async () => {
      const jsonOutput = await import('../../src/utils/json-output');
      const failSpy = vi.spyOn(jsonOutput, 'fail');
      vi.mocked(installPluginFromIdentifier).mockRejectedValue(
        new PluginInstallError('registry unreachable', { registry: 'npm' })
      );

      await installPlugin('broken', { json: true });

      expect(failSpy).toHaveBeenCalledWith(
        'PLUGIN_INSTALL_ERROR',
        'registry unreachable',
        { registry: 'npm' }
      );
      failSpy.mockRestore();
    });

    it('throws ValidationError (human mode) on installer failure', async () => {
      vi.mocked(installPluginFromIdentifier).mockRejectedValue(new Error('bad identifier'));

      await expect(installPlugin('broken')).rejects.toThrow(ValidationError);
      await expect(installPlugin('broken')).rejects.toThrow('Plugin installation failed');
    });
  });

  describe('uninstallPlugin', () => {
    it('rejects an unknown plugin name before touching the registry', async () => {
      registryMock.getManagedPlugin.mockReturnValue(undefined);

      await expect(uninstallPlugin('ghost')).rejects.toThrow(
        "Plugin 'ghost' is not installed"
      );
      expect(registryMock.unloadPlugin).not.toHaveBeenCalled();
    });

    it('prompts for confirmation without --force', async () => {
      registryMock.getManagedPlugin.mockReturnValue(fakePlugin());

      await uninstallPlugin('my-plugin');

      expect(output()).toContain("Are you sure you want to uninstall 'my-plugin'?");
      expect(registryMock.unloadPlugin).toHaveBeenCalledWith('my-plugin');
    });

    it('skips the confirmation prompt with --force', async () => {
      registryMock.getManagedPlugin.mockReturnValue(fakePlugin());

      await uninstallPlugin('my-plugin', { force: true });

      expect(output()).not.toContain('Are you sure');
      expect(output()).toContain('uninstalled successfully');
    });

    it('unloads then unregisters in order', async () => {
      registryMock.getManagedPlugin.mockReturnValue(fakePlugin());

      await uninstallPlugin('my-plugin', { force: true });

      const unloadOrder = registryMock.unloadPlugin.mock.invocationCallOrder[0];
      const unregisterOrder = registryMock.unregisterPlugin.mock.invocationCallOrder[0];
      expect(unloadOrder).toBeLessThan(unregisterOrder);
    });

    it('fails when unregisterPlugin returns false', async () => {
      registryMock.getManagedPlugin.mockReturnValue(fakePlugin());
      registryMock.unregisterPlugin.mockResolvedValue(false);

      await expect(uninstallPlugin('my-plugin', { force: true })).rejects.toThrow(
        'Plugin uninstallation failed'
      );
    });
  });

  describe('showPluginInfo', () => {
    it('rejects an unknown plugin', async () => {
      registryMock.getManagedPlugin.mockReturnValue(undefined);

      await expect(showPluginInfo('ghost')).rejects.toThrow("Plugin 'ghost' not found");
    });

    it('renders manifest details, lifecycle timings, and errors', async () => {
      registryMock.getManagedPlugin.mockReturnValue(
        fakePlugin({
          manifest: {
            name: 'rich',
            version: '3.1.0',
            description: 'Rich plugin',
            main: 'dist/main.js',
            author: 'team-x',
            license: 'MIT',
            homepage: 'https://example.com',
            keywords: ['a', 'b'],
          },
          state: PluginState.ACTIVE,
          usageCount: 12,
          errors: [
            { stage: 'activate', error: new Error('timeout once'), timestamp: 1700000000000 },
          ],
        })
      );

      await showPluginInfo('rich');

      const out = output();
      expect(out).toContain('rich v3.1.0');
      expect(out).toContain('Author:');
      expect(out).toContain('team-x');
      expect(out).toContain('MIT');
      expect(out).toContain('Load Time: 5ms');
      expect(out).toContain('Activation Time: 7ms');
      expect(out).toContain('Recent Errors');
      expect(out).toContain('timeout once');
    });

    it('renders the raw manifest block in verbose mode', async () => {
      registryMock.getManagedPlugin.mockReturnValue(
        fakePlugin({
          manifest: {
            name: 'm',
            version: '1.0.0',
            description: 'd',
            main: 'dist/index.js',
            engines: { node: '>=18' },
          },
        })
      );

      await showPluginInfo('m', { verbose: true });

      expect(output()).toContain('Engines:');
    });

    it('emits the full JSON dump in json mode', async () => {
      registryMock.getManagedPlugin.mockReturnValue(fakePlugin());

      await showPluginInfo('my-plugin', { json: true });

      // json branch prints via console.log(JSON.stringify(...)).
      const raw = logs.join('');
      const parsed = JSON.parse(raw);
      expect(parsed.manifest.name).toBe('my-plugin');
      expect(parsed.state).toBe('unloaded');
    });
  });

  describe('enablePlugin / disablePlugin', () => {
    it('rejects enabling an unknown plugin', async () => {
      registryMock.getManagedPlugin.mockReturnValue(undefined);
      await expect(enablePlugin('ghost')).rejects.toThrow("Plugin 'ghost' not found");
    });

    it('walks the full lifecycle unloaded → loaded → initialized → active', async () => {
      // The command snapshots the plugin once; mutate THAT object's state from
      // inside the lifecycle mocks so each guard sees the new state.
      const shared = fakePlugin();
      registryMock.getManagedPlugin.mockReturnValue(shared);
      registryMock.loadPlugin.mockImplementation(async () => {
        shared.state = PluginState.LOADED;
      });
      registryMock.initializePlugin.mockImplementation(async () => {
        shared.state = PluginState.INITIALIZED;
      });
      registryMock.activatePlugin.mockImplementation(async () => {
        shared.state = PluginState.ACTIVE;
      });

      await enablePlugin('my-plugin');

      expect(registryMock.loadPlugin).toHaveBeenCalledWith('my-plugin');
      expect(registryMock.initializePlugin).toHaveBeenCalledWith('my-plugin');
      expect(registryMock.activatePlugin).toHaveBeenCalledWith('my-plugin');
      expect(output()).toContain('enabled successfully');
    });

    it('skips lifecycle stages the plugin has already passed', async () => {
      registryMock.getManagedPlugin.mockReturnValue(fakePlugin({ state: PluginState.INITIALIZED }));

      await enablePlugin('my-plugin');

      expect(registryMock.loadPlugin).not.toHaveBeenCalled();
      expect(registryMock.initializePlugin).not.toHaveBeenCalled();
      expect(registryMock.activatePlugin).toHaveBeenCalled();
    });

    it('prints verbose timing lines on enable', async () => {
      registryMock.getManagedPlugin.mockReturnValue(fakePlugin({ state: PluginState.ACTIVE }));

      await enablePlugin('my-plugin', { verbose: true });

      expect(output()).toContain('Load time: 5ms');
      expect(output()).toContain('Activation time: 7ms');
    });

    it('disable rejects an unknown plugin', async () => {
      registryMock.getManagedPlugin.mockReturnValue(undefined);
      await expect(disablePlugin('ghost')).rejects.toThrow("Plugin 'ghost' not found");
    });

    it('disable is a no-op notice when the plugin is not active', async () => {
      registryMock.getManagedPlugin.mockReturnValue(fakePlugin({ state: PluginState.LOADED }));

      await disablePlugin('my-plugin');

      expect(output()).toContain('is not active');
      expect(registryMock.deactivatePlugin).not.toHaveBeenCalled();
    });

    it('disable deactivates an active plugin and reports verbose dependents', async () => {
      registryMock.getManagedPlugin.mockReturnValue(
        fakePlugin({ state: PluginState.ACTIVE, dependents: ['shell-integration'] })
      );

      await disablePlugin('my-plugin', { verbose: true });

      expect(registryMock.deactivatePlugin).toHaveBeenCalledWith('my-plugin');
      expect(output()).toContain('disabled successfully');
      expect(output()).toContain('shell-integration');
    });
  });

  describe('updatePlugins / validatePlugin / clearPluginCache', () => {
    it('update reports nothing-to-update for an empty registry', async () => {
      registryMock.getPlugins.mockReturnValue([]);

      await updatePlugins();

      expect(output()).toContain('No plugins to update');
    });

    it('update reports all up to date for present plugins', async () => {
      registryMock.getPlugins.mockReturnValue([fakePlugin()]);

      await updatePlugins();

      expect(output()).toContain('All plugins are up to date');
    });

    it('validate prints the pass banner and verbose note', async () => {
      await validatePlugin('/plugins/my-plugin');

      expect(output()).toContain('Plugin validation passed');

      logs = [];
      await validatePlugin('/plugins/my-plugin', { verbose: true });
      expect(output()).toContain('All checks completed successfully');
    });

    it('clearCache delegates to the registry and confirms', async () => {
      await clearPluginCache();

      expect(registryMock.clearCache).toHaveBeenCalled();
      expect(output()).toContain('cache cleared');
    });

    it('clearCache wraps failures as ValidationError', async () => {
      registryMock.clearCache.mockImplementation(() => {
        throw new Error('locked');
      });

      await expect(clearPluginCache()).rejects.toThrow('Failed to clear plugin cache');
    });
  });

  describe('showPluginStats', () => {
    it('renders overview, by-state, and performance sections', async () => {
      registryMock.getLifecycleStats.mockReturnValue({
        total: 3,
        totalErrors: 1,
        byState: { active: 2, error: 1 },
        avgLoadTime: 12.4,
        avgInitTime: 8.2,
        avgActivationTime: 20.6,
      });

      await showPluginStats();

      const out = output();
      expect(out).toContain('Total Plugins: 3');
      expect(out).toContain('Total Errors: 1');
      expect(out).toContain('Average Load Time: 12ms');
      expect(out).toContain('Average Init Time: 8ms');
    });

    it('emits raw stats JSON in json mode', async () => {
      registryMock.getLifecycleStats.mockReturnValue({ total: 0, totalErrors: 0 });

      await showPluginStats({ json: true });

      const raw = logs.join('');
      expect(JSON.parse(raw).total).toBe(0);
    });

    it('verbose lists plugins with errors', async () => {
      registryMock.getLifecycleStats.mockReturnValue({
        total: 1,
        totalErrors: 2,
        byState: {},
        avgLoadTime: 1,
        avgInitTime: 1,
        avgActivationTime: 1,
      });
      registryMock.getManagedPlugins.mockReturnValue([
        fakePlugin({
          errors: [
            { stage: 'load', error: new Error('a'), timestamp: 0 },
            { stage: 'init', error: new Error('b'), timestamp: 0 },
          ],
        }),
      ]);

      await showPluginStats({ verbose: true });

      expect(output()).toContain('Plugins with Errors');
      expect(output()).toContain('my-plugin: 2 errors');
    });
  });

  describe('reloadPlugin', () => {
    it('rejects an unknown plugin', async () => {
      registryMock.getManagedPlugin.mockReturnValue(undefined);
      await expect(reloadPlugin('ghost')).rejects.toThrow("Plugin 'ghost' not found");
    });

    it('delegates to registry.reloadPlugin and succeeds', async () => {
      registryMock.getManagedPlugin.mockReturnValue(fakePlugin());
      registryMock.reloadPlugin.mockResolvedValue(undefined);

      await reloadPlugin('my-plugin');

      expect(registryMock.reloadPlugin).toHaveBeenCalledWith('my-plugin');
      expect(output()).toContain('reloaded successfully');
    });

    it('verbose prints the post-reload state', async () => {
      registryMock.getManagedPlugin.mockReturnValue(
        fakePlugin({ state: PluginState.ACTIVE })
      );
      registryMock.reloadPlugin.mockResolvedValue(undefined);

      await reloadPlugin('my-plugin', { verbose: true });

      expect(output()).toContain('Plugin state: active');
    });
  });

  describe('showPluginHooks', () => {
    it('renders the global hook overview (counts by type and plugin)', async () => {
      registryMock.getHookStats.mockReturnValue({
        totalHooks: 5,
        middleware: [],
        hooksByType: { 'cli:start': 3, 'command:pre': 2, 'build:pre': 0 },
        hooksByPlugin: { 'my-plugin': 5 },
        executionStats: { 'my-plugin': 120 },
      });

      await showPluginHooks();

      const out = output();
      expect(out).toContain('Total Hooks: 5');
      expect(out).toContain('cli:start: 3');
      expect(out).toContain('my-plugin: 5 hooks');
      // Zero-count types are omitted from the render.
      expect(out).not.toContain('build:pre:');
    });

    it('verbose renders execution stats', async () => {
      registryMock.getHookStats.mockReturnValue({
        totalHooks: 1,
        middleware: [],
        hooksByType: {},
        hooksByPlugin: {},
        executionStats: { 'my-plugin': 42 },
      });

      await showPluginHooks(undefined, { verbose: true });

      expect(output()).toContain('my-plugin: 42ms');
    });

    it('renders a single plugin hook list when a name is given', async () => {
      registryMock.getHookStats.mockReturnValue({
        totalHooks: 0,
        middleware: [],
        hooksByType: {},
        hooksByPlugin: {},
        executionStats: {},
      });
      registryMock.getHookSystem.mockReturnValue({
        getPluginHooks: () => [
          { id: 'hook-1', priority: 10, description: 'does things', once: true },
        ],
      });

      await showPluginHooks('my-plugin');

      const out = output();
      expect(out).toContain("Hooks for plugin 'my-plugin' (1)");
      expect(out).toContain('hook-1');
      expect(out).toContain('Priority: 10');
      expect(out).toContain('(one-time)');
    });

    it('warns when the named plugin has no hooks', async () => {
      registryMock.getHookStats.mockReturnValue({
        totalHooks: 0,
        middleware: [],
        hooksByType: {},
        hooksByPlugin: {},
        executionStats: {},
      });
      registryMock.getHookSystem.mockReturnValue({ getPluginHooks: () => [] });

      await showPluginHooks('my-plugin');

      expect(output()).toContain("No hooks registered for plugin 'my-plugin'");
    });
  });

  describe('executeHook', () => {
    it('rejects non-JSON hook data before executing', async () => {
      await expect(executeHook('cli:start', '{bad json')).rejects.toThrow(
        'Hook data must be valid JSON'
      );
      expect(registryMock.executeHooks).not.toHaveBeenCalled();
    });

    it('renders a successful execution result', async () => {
      registryMock.executeHooks.mockResolvedValue({
        success: true,
        executionTime: 15,
        results: [{ pluginName: 'my-plugin', executionTime: 15, result: { ok: 1 } }],
        errors: [],
        aborted: false,
      });

      await executeHook('cli:start', '{"a":1}');

      const out = output();
      expect(out).toContain('Hook Type: cli:start');
      expect(out).toContain('Success: ✓');
      expect(out).toContain('Execution Time: 15ms');
      expect(out).toContain('Results: 1');
    });

    it('verbose lists per-plugin results and values', async () => {
      registryMock.executeHooks.mockResolvedValue({
        success: true,
        executionTime: 5,
        results: [{ pluginName: 'p1', executionTime: 4, result: { x: true } }],
        errors: [],
        aborted: false,
      });

      await executeHook('cli:start', '{}', { verbose: true });

      expect(output()).toContain('p1: 4ms');
      expect(output()).toContain('"x":true');
    });

    it('renders abort and error sections', async () => {
      registryMock.executeHooks.mockResolvedValue({
        success: false,
        executionTime: 9,
        results: [],
        errors: [{ pluginName: 'p2', error: new Error('hook blew up') }],
        aborted: true,
      });

      await executeHook('cli:start');

      const out = output();
      expect(out).toContain('Execution was aborted');
      expect(out).toContain('Errors:');
      expect(out).toContain('hook blew up');
    });
  });

  describe('listHookTypes', () => {
    it('prints hook types grouped by category prefix', async () => {
      await listHookTypes();

      const out = output();
      expect(out).toContain('Available Hook Types');
      // Real HookType values must appear in their prefix categories.
      expect(out).toContain(HookType.CLI_INIT);
      expect(out).toContain('CLI Lifecycle');
    });

    it('emits the flat hook-type array in json mode', async () => {
      await listHookTypes({ json: true });

      const raw = logs.join('');
      const parsed = JSON.parse(raw);
      expect(parsed).toEqual(expect.arrayContaining([HookType.CLI_INIT]));
    });
  });
});
