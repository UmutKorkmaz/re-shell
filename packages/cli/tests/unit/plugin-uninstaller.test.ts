import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { Command } from 'commander';

// Registry construction probes `npm root -g`; keep discovery to the fixture workspace.
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execSync: () => {
      throw new Error('execSync disabled in tests');
    },
  };
});

import { createPluginRegistry } from '../../src/utils/plugin-system';
import { createPluginCommandRegistry } from '../../src/utils/plugin-command-registry';
import { installPluginFromIdentifier, readPluginRegistry } from '../../src/utils/plugin-installer';
import { readPluginsFile, upsertPluginEntry, writePluginsFile } from '../../src/utils/plugin-store';
import {
  PluginUninstallError,
  findPluginDependents,
  isStrictlyInside,
  uninstallPluginFromWorkspace,
} from '../../src/utils/plugin-uninstaller';

let root: string;
let srcDir: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-uninstall-')));
  srcDir = path.join(root, '_src');
  await fs.ensureDir(srcDir);
  // The lifecycle manager derives data/cache dirs from process.cwd().
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(root);
});

afterEach(async () => {
  cwdSpy.mockRestore();
  await fs.remove(root);
});

const LIVE_PLUGIN = `
const fs = require('fs');
const path = require('path');
const marker = (name) => path.join(process.env.RESHELL_TEST_MARKERS, name);
module.exports = {
  manifest: { name: 'reshell-plugin-live', version: '1.0.0' },
  activate() { fs.writeFileSync(marker('activated'), '1'); },
  deactivate() {
    fs.writeFileSync(marker('deactivated'), '1');
    if (process.env.RESHELL_TEST_DEACTIVATE_THROWS) throw new Error('deactivate exploded');
  },
};
`;

async function sourcePlugin(
  name: string,
  extra: Record<string, unknown> = {},
  index = 'module.exports = { activate() {} };'
): Promise<string> {
  const dir = path.join(srcDir, name.replace(/[@/]/g, '_'));
  await fs.ensureDir(dir);
  await fs.writeJSON(path.join(dir, 'package.json'), {
    name,
    version: '1.0.0',
    description: `${name} plugin`,
    main: 'index.js',
    reshell: {},
    ...extra,
  });
  await fs.writeFile(path.join(dir, 'index.js'), index);
  return dir;
}

describe('uninstallPluginFromWorkspace: filesystem + registry', () => {
  it('removes the plugin directory and its plugins.json entry, and reports both', async () => {
    const src = await sourcePlugin('reshell-plugin-a');
    const installed = await installPluginFromIdentifier(src, { workspaceRoot: root });
    expect(await fs.pathExists(installed.path)).toBe(true);

    const result = await uninstallPluginFromWorkspace('reshell-plugin-a', { workspaceRoot: root });

    expect(result).toMatchObject({
      name: 'reshell-plugin-a',
      version: '1.0.0',
      dryRun: false,
      removed: { paths: [installed.path], registryEntry: true },
    });
    expect(await fs.pathExists(installed.path)).toBe(false);
    expect(await readPluginRegistry(root)).toEqual({});
    // Siblings and the plugins dir itself survive.
    expect(await fs.pathExists(path.join(root, '.re-shell', 'plugins'))).toBe(true);
  });

  it('leaves other installed plugins untouched', async () => {
    const a = await installPluginFromIdentifier(await sourcePlugin('reshell-plugin-a'), { workspaceRoot: root });
    const b = await installPluginFromIdentifier(await sourcePlugin('reshell-plugin-b'), { workspaceRoot: root });
    await uninstallPluginFromWorkspace('reshell-plugin-a', { workspaceRoot: root });
    expect(await fs.pathExists(a.path)).toBe(false);
    expect(await fs.pathExists(b.path)).toBe(true);
    expect(Object.keys(await readPluginRegistry(root))).toEqual(['reshell-plugin-b']);
  });

  it('fails for an unknown plugin (nothing is touched)', async () => {
    await expect(uninstallPluginFromWorkspace('reshell-plugin-ghost', { workspaceRoot: root })).rejects.toMatchObject({
      name: 'PluginUninstallError',
      code: 'not-found',
    });
    expect(await fs.pathExists(path.join(root, '.re-shell'))).toBe(false);
  });

  it('rejects a name that could traverse out of the workspace', async () => {
    await expect(uninstallPluginFromWorkspace('../../etc', { workspaceRoot: root })).rejects.toMatchObject({
      code: 'invalid-name',
    });
  });

  it('handles scoped plugins (unscoped directory, scope folders for cache cleaned up)', async () => {
    const src = await sourcePlugin('@acme/reshell-plugin-scoped');
    const installed = await installPluginFromIdentifier(src, { workspaceRoot: root });
    expect(installed.path.endsWith(path.join('plugins', 'reshell-plugin-scoped'))).toBe(true);
    const cache = path.join(root, '.re-shell', 'cache', '@acme', 'reshell-plugin-scoped');
    await fs.outputFile(path.join(cache, 'entry.json'), '{}');

    const result = await uninstallPluginFromWorkspace('@acme/reshell-plugin-scoped', { workspaceRoot: root });
    expect(result.removed.paths).toEqual(expect.arrayContaining([installed.path, cache]));
    expect(await fs.pathExists(path.join(root, '.re-shell', 'cache', '@acme'))).toBe(false);
  });

  it('removes the cache but keeps plugin data unless --purge is given', async () => {
    const installed = await installPluginFromIdentifier(await sourcePlugin('reshell-plugin-d'), { workspaceRoot: root });
    const cache = path.join(root, '.re-shell', 'cache', 'reshell-plugin-d');
    const data = path.join(root, '.re-shell', 'data', 'reshell-plugin-d');
    await fs.outputFile(path.join(cache, 'c.txt'), 'c');
    await fs.outputFile(path.join(data, 'd.txt'), 'd');

    const kept = await uninstallPluginFromWorkspace('reshell-plugin-d', { workspaceRoot: root });
    expect(kept.removed.paths).toEqual(expect.arrayContaining([installed.path, cache]));
    expect(kept.kept).toEqual([data]);
    expect(await fs.pathExists(cache)).toBe(false);
    expect(await fs.readFile(path.join(data, 'd.txt'), 'utf8')).toBe('d');

    // Reinstall then purge.
    await installPluginFromIdentifier(await sourcePlugin('reshell-plugin-d'), { workspaceRoot: root });
    const purged = await uninstallPluginFromWorkspace('reshell-plugin-d', { workspaceRoot: root, purgeData: true });
    expect(purged.removed.paths).toContain(data);
    expect(purged.kept).toEqual([]);
    expect(await fs.pathExists(data)).toBe(false);
  });

  it('removes an npm-style node_modules entry under the plugins directory', async () => {
    const installed = await installPluginFromIdentifier(await sourcePlugin('reshell-plugin-nm'), { workspaceRoot: root });
    const nm = path.join(root, '.re-shell', 'plugins', 'node_modules', 'reshell-plugin-nm');
    await fs.outputFile(path.join(nm, 'package.json'), '{}');

    const result = await uninstallPluginFromWorkspace('reshell-plugin-nm', { workspaceRoot: root });
    expect(result.removed.paths).toEqual(expect.arrayContaining([installed.path, nm]));
    expect(await fs.pathExists(nm)).toBe(false);
  });

  it('dry-run reports what would go and changes nothing', async () => {
    const installed = await installPluginFromIdentifier(await sourcePlugin('reshell-plugin-dry'), { workspaceRoot: root });
    const result = await uninstallPluginFromWorkspace('reshell-plugin-dry', { workspaceRoot: root, dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.removed).toEqual({ paths: [installed.path], registryEntry: true });
    expect(await fs.pathExists(installed.path)).toBe(true);
    expect(Object.keys(await readPluginRegistry(root))).toEqual(['reshell-plugin-dry']);
  });

  it('removes only the link when the installed directory is a symlink', async () => {
    const real = await sourcePlugin('reshell-plugin-link');
    const linkPath = path.join(root, '.re-shell', 'plugins', 'reshell-plugin-link');
    await fs.ensureDir(path.dirname(linkPath));
    await fs.symlink(real, linkPath, 'dir');
    await upsertPluginEntry(root, 'reshell-plugin-link', { version: '1.0.0', source: 'local', path: linkPath });

    await uninstallPluginFromWorkspace('reshell-plugin-link', { workspaceRoot: root });
    expect(await fs.pathExists(linkPath)).toBe(false);
    // The link target is the developer's own checkout and must survive.
    expect(await fs.pathExists(path.join(real, 'index.js'))).toBe(true);
  });

  it('removes the entry from the disabled list as well', async () => {
    await installPluginFromIdentifier(await sourcePlugin('reshell-plugin-off'), { workspaceRoot: root });
    const file = await readPluginsFile(root);
    await writePluginsFile(root, { ...file, disabled: ['reshell-plugin-off', 'other'] });
    await uninstallPluginFromWorkspace('reshell-plugin-off', { workspaceRoot: root });
    expect((await readPluginsFile(root)).disabled).toEqual(['other']);
  });
});

describe('uninstallPluginFromWorkspace: refuses to delete what it did not install', () => {
  it('refuses a plugin that lives in node_modules and deletes nothing', async () => {
    const nm = path.join(root, 'node_modules', 'reshell-plugin-pm');
    await fs.ensureDir(nm);
    await fs.writeJSON(path.join(nm, 'package.json'), {
      name: 'reshell-plugin-pm',
      version: '1.0.0',
      description: 'd',
      main: 'index.js',
    });
    await fs.writeFile(path.join(nm, 'index.js'), 'module.exports = {};');
    const registry = createPluginRegistry(root);
    await registry.initialize();

    await expect(uninstallPluginFromWorkspace('reshell-plugin-pm', { workspaceRoot: root, registry })).rejects.toMatchObject({
      code: 'not-managed',
    });
    expect(await fs.pathExists(path.join(nm, 'package.json'))).toBe(true);
    expect(registry.getManagedPlugin('reshell-plugin-pm')).toBeDefined();
  });

  it('refuses a workspace plugins/ source folder (user-authored code)', async () => {
    const src = path.join(root, 'plugins', 'reshell-plugin-mine');
    await fs.ensureDir(src);
    await fs.writeJSON(path.join(src, 'package.json'), {
      name: 'reshell-plugin-mine',
      version: '1.0.0',
      description: 'd',
      main: 'index.js',
    });
    await fs.writeFile(path.join(src, 'index.js'), 'module.exports = {};');
    const registry = createPluginRegistry(root);
    await registry.initialize();

    await expect(uninstallPluginFromWorkspace('reshell-plugin-mine', { workspaceRoot: root, registry })).rejects.toMatchObject({
      code: 'not-managed',
    });
    expect(await fs.pathExists(path.join(src, 'index.js'))).toBe(true);
  });

  it('a registry entry pointing outside .re-shell/plugins is refused, and with --force only the entry is dropped', async () => {
    const outside = path.join(root, 'precious');
    await fs.outputFile(path.join(outside, 'keep.txt'), 'keep');
    await upsertPluginEntry(root, 'reshell-plugin-evil', { version: '1.0.0', source: 'npm', path: outside });

    await expect(uninstallPluginFromWorkspace('reshell-plugin-evil', { workspaceRoot: root })).rejects.toMatchObject({
      code: 'not-managed',
    });
    expect(await fs.pathExists(path.join(outside, 'keep.txt'))).toBe(true);

    const forced = await uninstallPluginFromWorkspace('reshell-plugin-evil', { workspaceRoot: root, force: true });
    expect(forced.removed).toEqual({ paths: [], registryEntry: true });
    expect(forced.kept).toEqual([outside]);
    expect(await fs.readFile(path.join(outside, 'keep.txt'), 'utf8')).toBe('keep');
    expect(await readPluginRegistry(root)).toEqual({});
  });

  it('never deletes the plugins directory itself, even if a registry entry points at it', async () => {
    const plugins = path.join(root, '.re-shell', 'plugins');
    await fs.ensureDir(plugins);
    await upsertPluginEntry(root, 'reshell-plugin-bad', { version: '1.0.0', source: 'npm', path: plugins });
    await expect(uninstallPluginFromWorkspace('reshell-plugin-bad', { workspaceRoot: root })).rejects.toMatchObject({
      code: 'not-managed',
    });
    expect(await fs.pathExists(plugins)).toBe(true);
  });
});

describe('uninstallPluginFromWorkspace: dependents', () => {
  it('refuses to remove a plugin another plugin depends on, unless forced', async () => {
    const base = await installPluginFromIdentifier(await sourcePlugin('reshell-plugin-base'), { workspaceRoot: root });
    await installPluginFromIdentifier(
      await sourcePlugin('reshell-plugin-top', { dependencies: { 'reshell-plugin-base': '^1.0.0' } }),
      { workspaceRoot: root }
    );
    const registry = createPluginRegistry(root);
    await registry.initialize();

    expect(findPluginDependents(registry, 'reshell-plugin-base')).toEqual(['reshell-plugin-top']);
    await expect(uninstallPluginFromWorkspace('reshell-plugin-base', { workspaceRoot: root, registry })).rejects.toMatchObject({
      code: 'has-dependents',
      details: { dependents: ['reshell-plugin-top'] },
    });
    expect(await fs.pathExists(base.path)).toBe(true);

    await uninstallPluginFromWorkspace('reshell-plugin-base', { workspaceRoot: root, registry, force: true });
    expect(await fs.pathExists(base.path)).toBe(false);
  });

  it('also counts reshell.plugins and peerDependencies as dependencies', async () => {
    await installPluginFromIdentifier(await sourcePlugin('reshell-plugin-base'), { workspaceRoot: root });
    await installPluginFromIdentifier(
      await sourcePlugin('reshell-plugin-p1', { reshell: { plugins: { 'reshell-plugin-base': '*' } } }),
      { workspaceRoot: root }
    );
    await installPluginFromIdentifier(
      await sourcePlugin('reshell-plugin-p2', { peerDependencies: { 'reshell-plugin-base': '*' } }),
      { workspaceRoot: root }
    );
    const registry = createPluginRegistry(root);
    await registry.initialize();
    expect(findPluginDependents(registry, 'reshell-plugin-base')).toEqual(['reshell-plugin-p1', 'reshell-plugin-p2']);
  });
});

describe('uninstallPluginFromWorkspace: deregistration from a live registry', () => {
  let markers: string;

  beforeEach(async () => {
    markers = path.join(root, '_markers');
    await fs.ensureDir(markers);
    process.env.RESHELL_TEST_MARKERS = markers;
  });

  afterEach(() => {
    delete process.env.RESHELL_TEST_MARKERS;
    delete process.env.RESHELL_TEST_DEACTIVATE_THROWS;
  });

  async function liveRegistry() {
    const src = await sourcePlugin('reshell-plugin-live', {}, LIVE_PLUGIN);
    const installed = await installPluginFromIdentifier(src, { workspaceRoot: root });
    const registry = createPluginRegistry(root);
    await registry.initialize();
    await registry.loadPlugin('reshell-plugin-live');
    await registry.initializePlugin('reshell-plugin-live');
    await registry.activatePlugin('reshell-plugin-live');
    expect(registry.getManagedPlugin('reshell-plugin-live')?.isActive).toBe(true);
    expect(await fs.pathExists(path.join(markers, 'activated'))).toBe(true);
    return { registry, installed };
  }

  it('deactivates (calling the plugin\'s deactivate), unloads, and drops hooks and commands', async () => {
    const { registry, installed } = await liveRegistry();

    // Register real hooks and a real command on behalf of the plugin.
    const hookSystem = registry.getHookSystem();
    hookSystem.register('cli:init', () => undefined, 'reshell-plugin-live');
    hookSystem.register('build:start', () => undefined, 'reshell-plugin-live');
    hookSystem.register('cli:init', () => undefined, 'some-other-plugin');
    const commandRegistry = createPluginCommandRegistry(new Command());
    await commandRegistry.initialize();
    const registration = registry.getPlugin('reshell-plugin-live');
    expect(registration).toBeDefined();
    const registered = await commandRegistry.registerCommand(registration!, {
      name: 'live-cmd',
      description: 'a command',
      handler: async () => undefined,
    });
    expect(registered.success).toBe(true);
    expect(commandRegistry.getCommands().filter((c) => c.pluginName === 'reshell-plugin-live')).toHaveLength(1);

    const result = await uninstallPluginFromWorkspace('reshell-plugin-live', {
      workspaceRoot: root,
      registry,
      commandRegistry,
    });

    expect(result.deregistered).toEqual({ unloaded: true, hooks: 2, commands: 1 });
    // The plugin's own deactivate() really ran.
    expect(await fs.pathExists(path.join(markers, 'deactivated'))).toBe(true);
    expect(hookSystem.getPluginHooks('reshell-plugin-live')).toEqual([]);
    expect(hookSystem.getPluginHooks('some-other-plugin')).toHaveLength(1);
    expect(commandRegistry.getCommands().filter((c) => c.pluginName === 'reshell-plugin-live')).toEqual([]);
    expect(registry.getManagedPlugin('reshell-plugin-live')).toBeUndefined();
    expect(registry.getPlugin('reshell-plugin-live')).toBeUndefined();
    expect(await fs.pathExists(installed.path)).toBe(false);
    // The plugin's modules are evicted from the require cache.
    expect(Object.keys(require.cache).some((k) => k.startsWith(installed.path))).toBe(false);
  });

  it('still removes a plugin whose deactivate() throws, and surfaces the problem as a warning', async () => {
    const { registry, installed } = await liveRegistry();
    process.env.RESHELL_TEST_DEACTIVATE_THROWS = '1';

    const result = await uninstallPluginFromWorkspace('reshell-plugin-live', { workspaceRoot: root, registry });
    expect(result.warnings.join(' ')).toMatch(/failed to unload cleanly/);
    expect(await fs.pathExists(installed.path)).toBe(false);
    expect(registry.getManagedPlugin('reshell-plugin-live')).toBeUndefined();
    expect(await readPluginRegistry(root)).toEqual({});
  });
});

describe('isStrictlyInside', () => {
  it('is lexical and excludes the base itself', () => {
    expect(isStrictlyInside('/a/b', '/a/b/c')).toBe(true);
    expect(isStrictlyInside('/a/b', '/a/b')).toBe(false);
    expect(isStrictlyInside('/a/b', '/a/bc')).toBe(false);
    expect(isStrictlyInside('/a/b', '/a/b/../c')).toBe(false);
    expect(isStrictlyInside('/a/b', '/x')).toBe(false);
  });
});

describe('PluginUninstallError', () => {
  it('carries a machine-readable code and details', () => {
    const error = new PluginUninstallError('io-error', 'boom', { path: '/x' });
    expect(error).toMatchObject({ code: 'io-error', details: { path: '/x' }, name: 'PluginUninstallError' });
  });
});
