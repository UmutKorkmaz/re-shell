import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

// Registry construction probes `npm root -g`; neuter it so discovery is
// deterministic and only looks at the fixture workspace.
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

let root: string;

beforeEach(async () => {
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-discovery-')));
});

afterEach(async () => {
  await fs.remove(root);
});

function pkg(name: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { name, version: '1.0.0', description: `${name} description`, main: 'index.js', ...extra };
}

async function writePkg(dir: string, manifest: Record<string, unknown>): Promise<void> {
  await fs.ensureDir(dir);
  await fs.writeJSON(path.join(dir, 'package.json'), manifest);
  await fs.writeFile(path.join(dir, 'index.js'), 'module.exports = { activate() {} };');
}

async function discoverNpm(): Promise<{ names: string[]; skipped: string[]; errors: string[] }> {
  const registry = createPluginRegistry(root);
  const result = await registry.discoverPlugins({ sources: ['npm'], useCache: false });
  return {
    names: result.found.map((p) => p.manifest.name).sort(),
    skipped: result.skipped.map((s) => `${path.basename(s.path)}: ${s.reason}`),
    errors: result.errors.map((e) => `${e.path}: ${e.error.message}`),
  };
}

describe('node_modules discovery follows the installer\'s recognition rules', () => {
  it('finds plugins signalled by any manifest key the installer accepts', async () => {
    const nm = path.join(root, 'node_modules');
    await writePkg(path.join(nm, 'by-keyword'), pkg('by-keyword', { keywords: ['reshell-plugin'] }));
    await writePkg(path.join(nm, 'reshell-plugin-prefixed'), pkg('reshell-plugin-prefixed'));
    await writePkg(path.join(nm, 'by-reshell-key'), pkg('by-reshell-key', { reshell: {} }));
    await writePkg(path.join(nm, 'by-plugin-key'), pkg('by-plugin-key', { 'reshell-plugin': { hooks: [] } }));
    await writePkg(path.join(nm, 'by-cli-key'), pkg('by-cli-key', { 'reshell-cli': { compatibility: '*' } }));
    await writePkg(path.join(nm, 'lodash'), pkg('lodash'));

    const { names, errors } = await discoverNpm();
    expect(errors).toEqual([]);
    expect(names).toEqual(['by-cli-key', 'by-keyword', 'by-plugin-key', 'by-reshell-key', 'reshell-plugin-prefixed']);
  });

  it('does not flag first-party @re-shell packages as plugins, but keeps third-party ones', async () => {
    const scope = path.join(root, 'node_modules', '@re-shell');
    for (const name of ['cli', 'ui', 'contracts', 'mcp', 'dashboard', 'control-plane']) {
      await writePkg(path.join(scope, name), pkg(`@re-shell/${name}`));
    }
    await writePkg(path.join(scope, 'community-plugin'), pkg('@re-shell/community-plugin'));

    const { names, skipped } = await discoverNpm();
    expect(names).toEqual(['@re-shell/community-plugin']);
    expect(skipped.filter((s) => s.includes('first-party'))).toHaveLength(6);
  });

  it('follows symlinks: pnpm-style node_modules (top-level links into .pnpm) are discovered', async () => {
    const nm = path.join(root, 'node_modules');
    const store = path.join(nm, '.pnpm');

    // Unscoped plugin: real files live in the virtual store, node_modules/<name> is a symlink.
    const realPlain = path.join(store, 'reshell-plugin-pnpm@1.0.0', 'node_modules', 'reshell-plugin-pnpm');
    await writePkg(realPlain, pkg('reshell-plugin-pnpm'));
    await fs.symlink(realPlain, path.join(nm, 'reshell-plugin-pnpm'), 'dir');

    // Scoped plugin: node_modules/@acme is a real dir containing a symlink.
    const realScoped = path.join(store, '@acme+tool@2.0.0', 'node_modules', '@acme', 'tool');
    await writePkg(realScoped, pkg('@acme/tool', { keywords: ['reshell-plugin'], version: '2.0.0' }));
    await fs.ensureDir(path.join(nm, '@acme'));
    await fs.symlink(realScoped, path.join(nm, '@acme', 'tool'), 'dir');

    // A symlinked scope directory is followed too.
    const realScopeDir = path.join(root, 'elsewhere', '@linked');
    await writePkg(path.join(realScopeDir, 'plug'), pkg('@linked/plug', { reshell: {} }));
    await fs.symlink(realScopeDir, path.join(nm, '@linked'), 'dir');

    // Dependencies of the plugins in the virtual store must not be reported as separate hits.
    await writePkg(
      path.join(store, 'reshell-plugin-pnpm@1.0.0', 'node_modules', 'reshell-plugin-dep'),
      pkg('reshell-plugin-dep')
    );

    const { names, errors } = await discoverNpm();
    expect(errors).toEqual([]);
    expect(names).toEqual(['@acme/tool', '@linked/plug', 'reshell-plugin-pnpm']);
  });

  it('ignores broken symlinks and the .bin directory without reporting errors', async () => {
    const nm = path.join(root, 'node_modules');
    await fs.ensureDir(path.join(nm, '.bin'));
    await fs.symlink(path.join(root, 'does-not-exist'), path.join(nm, 'dangling'), 'dir');
    await writePkg(path.join(nm, 'reshell-plugin-ok'), pkg('reshell-plugin-ok'));

    const { names, errors } = await discoverNpm();
    expect(errors).toEqual([]);
    expect(names).toEqual(['reshell-plugin-ok']);
  });
});

describe('local plugin directories', () => {
  it('discovers a symlinked (linked) plugin and skips hidden staging directories', async () => {
    const plugins = path.join(root, '.re-shell', 'plugins');
    const real = path.join(root, 'dev', 'my-linked-plugin');
    await writePkg(real, pkg('my-linked-plugin', { reshell: {} }));
    await fs.ensureDir(plugins);
    await fs.symlink(real, path.join(plugins, 'my-linked-plugin'), 'dir');

    // Installer staging/backup leftovers are hidden and must never show up as plugins.
    await writePkg(path.join(plugins, '.my-linked-plugin.staging-1-2'), pkg('my-linked-plugin', { reshell: {} }));
    // A broken link is reported as skipped, not as an error.
    await fs.symlink(path.join(root, 'gone'), path.join(plugins, 'broken'), 'dir');

    const registry = createPluginRegistry(root);
    const result = await registry.discoverPlugins({ sources: ['local'], useCache: false });
    expect(result.errors).toEqual([]);
    expect(result.found.map((p) => p.manifest.name)).toEqual(['my-linked-plugin']);
    expect(result.found[0].pluginPath).toBe(path.join(plugins, 'my-linked-plugin'));
    expect(result.skipped.map((s) => s.reason)).toContain('Broken symlink');
  });
});
