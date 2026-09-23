import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// The PluginRegistry constructor probes global plugin paths via `npm root -g`.
// That shell-out is try/caught in production, but in tests it is slow and
// environment-dependent. Neuter execSync so registry construction and the npm
// discovery path are deterministic and fast; exec/spawn are left untouched.
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    execSync: () => {
      throw new Error('execSync disabled in tests');
    },
  };
});

import {
  PluginRegistry,
  createPluginRegistry,
  discoverPlugins,
  validatePluginManifest,
  type PluginManifest,
  type PluginDiscoveryOptions,
  type PluginSource,
} from '../../src/utils/plugin-system';
import { ValidationError } from '../../src/utils/error-handler';

/** Minimal valid manifest fields required by validateManifest. */
function validManifestFields(name: string): Record<string, unknown> {
  return { name, version: '1.0.0', description: 'a test plugin', main: 'index.js' };
}

/** Write a package.json manifest into `<root>/<dir>/package.json`. */
function writePackage(root: string, dir: string, manifest: Record<string, unknown>): string {
  const pluginPath = path.join(root, dir);
  fs.ensureDirSync(pluginPath);
  fs.writeJSONSync(path.join(pluginPath, 'package.json'), manifest);
  return pluginPath;
}

describe('plugin-system — validatePluginManifest', () => {
  it('normalizes a minimal valid manifest', () => {
    const m = validatePluginManifest(validManifestFields('alpha'));
    expect(m.name).toBe('alpha');
    expect(m.version).toBe('1.0.0');
    expect(m.description).toBe('a test plugin');
    expect(m.main).toBe('index.js');
    // Absent optional fields are normalized to safe defaults.
    expect(m.keywords).toEqual([]);
    expect(m.reshell).toEqual({});
  });

  it('passes through every optional manifest field', () => {
    const data = {
      ...validManifestFields('beta'),
      author: 'rdvankck',
      license: 'MIT',
      homepage: 'https://example.com',
      keywords: ['reshell-plugin', 'tooling'],
      bin: { 'reshell-beta': './bin/beta.js' },
      engines: { 'reshell-cli': '^0.30.0', node: '>=18' },
      dependencies: { foo: '^1.0.0' },
      peerDependencies: { bar: '^2.0.0' },
      reshell: {
        compatibility: '^0.30.0',
        hooks: ['onInit'],
        commands: ['beta:run'],
        permissions: [{ type: 'filesystem', access: 'read', description: 'read cfg' }],
        config: { type: 'object', properties: {} },
        plugins: { core: '^1.0.0' },
      },
    };
    const m = validatePluginManifest(data);
    expect(m.author).toBe('rdvankck');
    expect(m.license).toBe('MIT');
    expect(m.homepage).toBe('https://example.com');
    expect(m.keywords).toEqual(['reshell-plugin', 'tooling']);
    expect(m.bin).toEqual({ 'reshell-beta': './bin/beta.js' });
    expect(m.engines).toEqual({ 'reshell-cli': '^0.30.0', node: '>=18' });
    expect(m.dependencies).toEqual({ foo: '^1.0.0' });
    expect(m.peerDependencies).toEqual({ bar: '^2.0.0' });
    expect(m.reshell?.hooks).toEqual(['onInit']);
    expect(m.reshell?.commands).toEqual(['beta:run']);
    expect(m.reshell?.permissions).toHaveLength(1);
    expect(m.reshell?.plugins).toEqual({ core: '^1.0.0' });
  });

  it.each([
    ['name', { version: '1.0.0', description: 'd', main: 'i.js' }],
    ['version', { name: 'a', description: 'd', main: 'i.js' }],
    ['description', { name: 'a', version: '1.0.0', main: 'i.js' }],
    ['main', { name: 'a', version: '1.0.0', description: 'd' }],
  ])('throws ValidationError when %s is missing', (_field, bad) => {
    expect(() => validatePluginManifest(bad)).toThrow(ValidationError);
  });

  it('throws ValidationError when name/version are present but non-string', () => {
    expect(() => validatePluginManifest({ name: 42, version: '1.0.0', description: 'd', main: 'i.js' })).toThrow(
      ValidationError
    );
    expect(() => validatePluginManifest({ name: 'a', version: true, description: 'd', main: 'i.js' })).toThrow(
      ValidationError
    );
  });
});

describe('plugin-system — PluginRegistry construction & defaults', () => {
  let root: string;
  let registry: PluginRegistry;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-registry-'));
    registry = createPluginRegistry(root);
  });
  afterEach(() => fs.removeSync(root));

  it('createPluginRegistry returns a PluginRegistry bound to the root', () => {
    expect(registry).toBeInstanceOf(PluginRegistry);
    // Private rootPath is observable via the activation context later; here we
    // only assert the registry starts empty.
    expect(registry.getPluginCount()).toBe(0);
  });

  it('defaults to process.cwd() when no root is supplied', () => {
    const r = new PluginRegistry();
    expect(r).toBeInstanceOf(PluginRegistry);
    expect(r.getPluginCount()).toBe(0);
  });

  it('exposes an empty initial state', () => {
    expect(registry.getPlugins()).toEqual([]);
    expect(registry.getActivePlugins()).toEqual([]);
    expect(registry.getPlugin('missing')).toBeUndefined();
    expect(registry.hasPlugin('missing')).toBe(false);
    expect(registry.getPluginCount()).toBe(0);
  });
});

describe('plugin-system — registerPlugin', () => {
  let root: string;
  let registry: PluginRegistry;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-register-'));
    registry = createPluginRegistry(root);
  });
  afterEach(() => fs.removeSync(root));

  it('reads and validates package.json from a path', async () => {
    const pluginPath = writePackage(root, 'alpha', validManifestFields('alpha'));
    await registry.registerPlugin(pluginPath);

    expect(registry.hasPlugin('alpha')).toBe(true);
    expect(registry.getPluginCount()).toBe(1);
    const stored = registry.getPlugin('alpha');
    expect(stored).toBeDefined();
    expect(stored!.pluginPath).toBe(pluginPath);
    expect(stored!.isLoaded).toBe(false);
    expect(stored!.isActive).toBe(false);
    expect(stored!.usageCount).toBe(0);
    expect(stored!.manifest.name).toBe('alpha');
  });

  it('emits plugin-registered with the stored registration', async () => {
    const pluginPath = writePackage(root, 'alpha', validManifestFields('alpha'));
    const listener = vi.fn();
    registry.on('plugin-registered', listener);

    await registry.registerPlugin(pluginPath);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].manifest.name).toBe('alpha');
    expect(listener.mock.calls[0][0].pluginPath).toBe(pluginPath);
  });

  it('accepts a pre-parsed manifest without touching the filesystem', async () => {
    const manifest: PluginManifest = {
      name: 'preloaded',
      version: '2.0.0',
      description: 'supplied directly',
      main: 'lib/index.js',
    };
    await registry.registerPlugin('/does/not/exist', manifest);
    expect(registry.getPlugin('preloaded')!.manifest.version).toBe('2.0.0');
  });

  it('rejects when no package.json exists and no manifest is supplied', async () => {
    registry.on('error', () => {}); // suppress Node's throw-on-unhandled-error-event
    await expect(registry.registerPlugin(path.join(root, 'nope'))).rejects.toThrow(ValidationError);
    expect(registry.getPluginCount()).toBe(0);
  });

  it('emits an error event and rethrows on an invalid manifest on disk', async () => {
    const errors: Error[] = [];
    registry.on('error', (e: Error) => errors.push(e));
    // Valid path but the package.json fails validation (missing main).
    const pluginPath = writePackage(root, 'bad', { name: 'bad', version: '1.0.0', description: 'd' });

    await expect(registry.registerPlugin(pluginPath)).rejects.toThrow(ValidationError);
    expect(errors).toHaveLength(1);
    expect(registry.hasPlugin('bad')).toBe(false);
  });

  it('overwrites a previously registered plugin of the same name', async () => {
    const p1 = writePackage(root, 'alpha', { ...validManifestFields('alpha'), version: '1.0.0' });
    const p2 = writePackage(root, 'beta', { ...validManifestFields('alpha'), version: '9.9.9' });
    await registry.registerPlugin(p1);
    await registry.registerPlugin(p2);
    expect(registry.getPluginCount()).toBe(1);
    expect(registry.getPlugin('alpha')!.manifest.version).toBe('9.9.9');
  });
});

describe('plugin-system — unregisterPlugin', () => {
  let root: string;
  let registry: PluginRegistry;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-unreg-'));
    registry = createPluginRegistry(root);
  });
  afterEach(() => fs.removeSync(root));

  it('returns false for an unknown plugin', async () => {
    expect(await registry.unregisterPlugin('ghost')).toBe(false);
  });

  it('removes a registered plugin and emits plugin-unregistered', async () => {
    const pluginPath = writePackage(root, 'alpha', validManifestFields('alpha'));
    await registry.registerPlugin(pluginPath);
    const listener = vi.fn();
    registry.on('plugin-unregistered', listener);

    const removed = await registry.unregisterPlugin('alpha');
    expect(removed).toBe(true);
    expect(registry.hasPlugin('alpha')).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].name).toBe('alpha');
  });

  it('deactivates an active plugin and builds its activation context', async () => {
    const pluginPath = writePackage(root, 'alpha', validManifestFields('alpha'));
    await registry.registerPlugin(pluginPath);

    // Force the registration into an active state with a capturing deactivate.
    let captured: unknown;
    const stored = registry.getPlugin('alpha')!;
    stored.isActive = true;
    stored.instance = {
      manifest: stored.manifest,
      activate: async () => {},
      deactivate: async (ctx: unknown) => {
        captured = ctx;
      },
    };

    await registry.unregisterPlugin('alpha');
    expect(captured).toBeDefined();
    const ctx = captured as {
      plugin: { name: string };
      cli: { rootPath: string };
      logger: unknown;
      utils: { path: unknown; fs: unknown; chalk: unknown; exec: unknown; spawn: unknown };
    };
    expect(ctx.plugin.name).toBe('alpha');
    expect(ctx.cli.rootPath).toBe(root);
    expect(ctx.logger).toBeDefined();
    expect(ctx.utils.path).toBeDefined();
    expect(ctx.utils.fs).toBeDefined();
    expect(ctx.utils.chalk).toBeDefined();
    expect(typeof ctx.utils.exec).toBe('function');
    expect(typeof ctx.utils.spawn).toBe('function');
  });
});

describe('plugin-system — discovery (local source)', () => {
  let root: string;
  let registry: PluginRegistry;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-local-'));
    // Local discovery scans <root>/.re-shell/plugins and <root>/plugins.
    registry = createPluginRegistry(root);
  });
  afterEach(() => fs.removeSync(root));

  it('finds plugins under .re-shell/plugins', async () => {
    writePackage(path.join(root, '.re-shell', 'plugins'), 'alpha', validManifestFields('alpha'));
    const result = await registry.discoverPlugins({ sources: ['local'] });
    expect(result.found).toHaveLength(1);
    expect(result.found[0].manifest.name).toBe('alpha');
    expect(result.found[0].isLoaded).toBe(false);
  });

  it('also scans a top-level plugins/ directory', async () => {
    writePackage(path.join(root, 'plugins'), 'beta', validManifestFields('beta'));
    const result = await registry.discoverPlugins({ sources: ['local'] });
    expect(result.found.map((p) => p.manifest.name)).toEqual(['beta']);
  });

  it('skips subdirectories without a package.json', async () => {
    fs.ensureDirSync(path.join(root, '.re-shell', 'plugins', 'empty'));
    const result = await registry.discoverPlugins({ sources: ['local'] });
    expect(result.found).toHaveLength(0);
    expect(result.skipped.some((s) => s.reason === 'No package.json found')).toBe(true);
  });

  it('records an error for a malformed package.json', async () => {
    const dir = path.join(root, '.re-shell', 'plugins', 'broken');
    fs.ensureDirSync(dir);
    fs.writeFileSync(path.join(dir, 'package.json'), '{ this is not json');
    const result = await registry.discoverPlugins({ sources: ['local'] });
    expect(result.found).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].path).toBe(dir);
  });

  it('deduplicates a plugin discovered from both local and npm, preferring local', async () => {
    writePackage(path.join(root, '.re-shell', 'plugins'), 'shared', validManifestFields('shared'));
    writePackage(path.join(root, 'node_modules'), 'shared', {
      ...validManifestFields('shared'),
      keywords: ['reshell-plugin'],
    });
    const result = await registry.discoverPlugins({ sources: ['local', 'npm'] });
    expect(result.found).toHaveLength(1);
    // Local path contains '.re-shell' and should win over the node_modules copy.
    expect(result.found[0].pluginPath).toContain('.re-shell');
  });

  it('emits discovery-completed with the aggregated result', async () => {
    writePackage(path.join(root, '.re-shell', 'plugins'), 'alpha', validManifestFields('alpha'));
    const listener = vi.fn();
    registry.on('discovery-completed', listener);
    await registry.discoverPlugins({ sources: ['local'] });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].found).toHaveLength(1);
  });
});

describe('plugin-system — discovery (npm + builtin + cache)', () => {
  let root: string;
  let registry: PluginRegistry;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-npm-'));
    registry = createPluginRegistry(root);
  });
  afterEach(() => fs.removeSync(root));

  it('discovers a plugin in node_modules via the reshell-plugin keyword', async () => {
    writePackage(path.join(root, 'node_modules'), 'reshell-plugin-foo', {
      ...validManifestFields('reshell-plugin-foo'),
      keywords: ['reshell-plugin'],
    });
    const result = await registry.discoverPlugins({ sources: ['npm'] });
    expect(result.found).toHaveLength(1);
    expect(result.found[0].manifest.name).toBe('reshell-plugin-foo');
  });

  it('discovers a scoped @re-shell/ plugin in node_modules', async () => {
    writePackage(path.join(root, 'node_modules', '@re-shell'), 'core', validManifestFields('@re-shell/core'));
    const result = await registry.discoverPlugins({ sources: ['npm'] });
    expect(result.found).toHaveLength(1);
    expect(result.found[0].manifest.name).toBe('@re-shell/core');
  });

  it('ignores a plain npm package that is not a re-shell plugin', async () => {
    writePackage(path.join(root, 'node_modules'), 'lodash', {
      name: 'lodash',
      version: '4.0.0',
      description: 'utils',
      main: 'index.js',
    });
    const result = await registry.discoverPlugins({ sources: ['npm'] });
    expect(result.found).toHaveLength(0);
  });

  it('builtin discovery returns an empty result when the directory is absent', async () => {
    const result = await registry.discoverPlugins({ sources: ['builtin'] });
    expect(result.found).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('records an error for the unimplemented "git" source', async () => {
    const result = await registry.discoverPlugins({ sources: ['git' as PluginSource] });
    expect(result.found).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].path).toBe('git');
  });

  it('caches discovery results and returns stale data until clearCache is called', async () => {
    const alphaPath = writePackage(path.join(root, '.re-shell', 'plugins'), 'alpha', validManifestFields('alpha'));
    const opts: PluginDiscoveryOptions = { sources: ['local'] };

    const first = await registry.discoverPlugins(opts);
    expect(first.found).toHaveLength(1);

    // Mutate the filesystem after the first (cached) discovery.
    await fs.remove(alphaPath);
    writePackage(path.join(root, '.re-shell', 'plugins'), 'beta', validManifestFields('beta'));

    // Cached call still reflects the snapshot taken before the mutation.
    const cached = await registry.discoverPlugins(opts);
    expect(cached.found.map((p) => p.manifest.name)).toEqual(['alpha']);

    // After clearing the cache, discovery re-reads the live filesystem.
    const clearListener = vi.fn();
    registry.on('cache-cleared', clearListener);
    registry.clearCache();
    expect(clearListener).toHaveBeenCalledTimes(1);

    const fresh = await registry.discoverPlugins(opts);
    expect(fresh.found.map((p) => p.manifest.name)).toEqual(['beta']);
  });
});

describe('plugin-system — initialize', () => {
  let root: string;
  let registry: PluginRegistry;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-init-'));
    registry = createPluginRegistry(root);
  });
  afterEach(() => fs.removeSync(root));

  it('creates the plugin directory and default plugins.json', async () => {
    await registry.initialize();
    expect(fs.existsSync(path.join(root, '.re-shell', 'plugins'))).toBe(true);
    const config = await fs.readJSON(path.join(root, '.re-shell', 'plugins.json'));
    expect(config.version).toBe('1.0.0');
    expect(config.plugins).toEqual({});
    expect(config.disabled).toEqual([]);
    expect(config.settings.autoUpdate).toBe(false);
    expect(config.settings.security.allowUnverified).toBe(false);
  });

  it('registers discovered plugins and emits initialized once', async () => {
    writePackage(path.join(root, '.re-shell', 'plugins'), 'alpha', validManifestFields('alpha'));
    const listener = vi.fn();
    registry.on('initialized', listener);

    await registry.initialize();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].totalPlugins).toBe(1);
    expect(registry.getPluginCount()).toBe(1);

    // Second call is a no-op (idempotent) and does not re-emit.
    await registry.initialize();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite an existing plugins.json', async () => {
    fs.ensureDirSync(path.join(root, '.re-shell'));
    await fs.writeJSON(path.join(root, '.re-shell', 'plugins.json'), { custom: true });
    await registry.initialize();
    const config = await fs.readJSON(path.join(root, '.re-shell', 'plugins.json'));
    expect(config).toEqual({ custom: true });
  });
});

describe('plugin-system — delegation getters', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = createPluginRegistry(fs.mkdtempSync(path.join(os.tmpdir(), 'ps-deleg-')));
  });

  it('exposes the lifecycle manager, hook system, and dependency resolver', () => {
    expect(registry.getLifecycleManager()).toBeDefined();
    expect(registry.getHookSystem()).toBeDefined();
    expect(registry.getDependencyResolver()).toBeDefined();
  });

  it('returns an empty managed-plugin list and stats before anything is loaded', () => {
    expect(registry.getManagedPlugins()).toEqual([]);
    expect(Array.isArray(registry.getPluginsByState('LOADED' as never))).toBe(true);
    expect(typeof registry.getLifecycleStats()).toBe('object');
    expect(typeof registry.getHookStats()).toBe('object');
    expect(typeof registry.getDependencyStats()).toBe('object');
  });

  it('creates a scoped hook API for a plugin name', () => {
    const api = registry.createPluginHookAPI('alpha');
    expect(api).toBeDefined();
    expect(typeof api.register).toBe('function');
  });

  it('resolveDependencies throws ValidationError for an unknown plugin', async () => {
    await expect(registry.resolveDependencies('ghost')).rejects.toThrow(ValidationError);
  });
});

describe('plugin-system — standalone helpers', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-helper-'));
  });
  afterEach(() => fs.removeSync(root));

  it('discoverPlugins(rootPath, options) discovers from the given root', async () => {
    writePackage(path.join(root, '.re-shell', 'plugins'), 'alpha', validManifestFields('alpha'));
    const result = await discoverPlugins(root, { sources: ['local'] });
    expect(result.found).toHaveLength(1);
    expect(result.found[0].manifest.name).toBe('alpha');
  });
});
