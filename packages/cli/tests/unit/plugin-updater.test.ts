import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { pluginUpdateResponseSchema } from '@re-shell/contracts';
import {
  PluginUpdateInputError,
  pinInstalledPlugin,
  resolveRemoteCommit,
  unpinInstalledPlugin,
  updateInstalledPlugins,
} from '../../src/utils/plugin-updater';
import { installPluginFromIdentifier } from '../../src/utils/plugin-installer';
import { readPluginsFile, setPluginPin, upsertPluginEntry } from '../../src/utils/plugin-store';
import { isolateNpm, startFakeRegistry, type FakePackage, type FakeRegistry } from '../utils/fake-registry';

let tmp: string;
let ws: string;
let restoreNpm: () => void;
let registry: FakeRegistry | undefined;

beforeEach(async () => {
  tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-updater-')));
  ws = path.join(tmp, 'ws');
  await fs.ensureDir(ws);
  restoreNpm = isolateNpm(tmp);
});

afterEach(async () => {
  await registry?.close();
  registry = undefined;
  restoreNpm();
  await fs.remove(tmp);
});

const NAME = 'reshell-plugin-up';
const plugin = (versions: string[], distTags?: Record<string, string>): FakePackage => ({
  name: NAME,
  distTags,
  versions: Object.fromEntries(
    versions.map((v) => [
      v,
      {
        manifest: { keywords: ['reshell-plugin'], description: `up ${v}` },
        files: { 'index.js': `exports.activate = () => {}; exports.v = '${v}';` },
      },
    ])
  ),
});

async function start(
  versions: string[],
  extra: { signing?: false; tamper?: boolean; failWith?: number; distTags?: Record<string, string> } = {}
): Promise<FakeRegistry> {
  registry = await startFakeRegistry({
    packages: [plugin(versions, extra.distTags)],
    ...(extra.signing === false ? { signing: false as const } : {}),
    tamperSignatures: extra.tamper,
    failWith: extra.failWith,
  });
  return registry;
}

async function installFromRegistry(version: string, pin?: boolean | string): Promise<void> {
  await installPluginFromIdentifier(`${NAME}@${version}`, { workspaceRoot: ws, registry: registry!.url, pin });
}

const base = () => ({ workspaceRoot: ws, verifySignatures: true, registryUrl: registry!.url });

async function installedVersion(): Promise<string> {
  return (await fs.readJSON(path.join(ws, '.re-shell', 'plugins', NAME, 'package.json'))).version;
}

describe('updateInstalledPlugins: npm', () => {
  it('--check reports an available update and changes nothing', async () => {
    await start(['1.0.0', '1.1.0']);
    await installFromRegistry('1.0.0');

    const result = await updateInstalledPlugins({ ...base(), checkOnly: true });

    expect(result.checkOnly).toBe(true);
    expect(result.plugins).toHaveLength(1);
    expect(result.plugins[0]).toMatchObject({
      name: NAME,
      source: 'npm',
      installed: '1.0.0',
      target: '1.1.0',
      latest: '1.1.0',
      status: 'update-available',
      pin: null,
    });
    // --check also tells you whether the update would verify.
    expect(result.plugins[0].signature).toMatchObject({ verified: true, gated: true });
    expect(result.summary).toMatchObject({ total: 1, updateAvailable: 1, updated: 0, failed: 0 });
    expect(await installedVersion()).toBe('1.0.0');
    expect(pluginUpdateResponseSchema.safeParse(result).success).toBe(true);
  });

  it('applies the update: new files on disk, plugins.json updated, signature + integrity recorded', async () => {
    await start(['1.0.0', '1.1.0']);
    await installFromRegistry('1.0.0');
    const before = (await readPluginsFile(ws)).plugins[NAME];

    const result = await updateInstalledPlugins(base());

    expect(result.plugins[0]).toMatchObject({ status: 'updated', installed: '1.0.0', target: '1.1.0' });
    expect(result.summary).toMatchObject({ updated: 1, failed: 0 });
    expect(await installedVersion()).toBe('1.1.0');
    expect(await fs.readFile(path.join(ws, '.re-shell', 'plugins', NAME, 'index.js'), 'utf8')).toContain("'1.1.0'");

    const entry = (await readPluginsFile(ws)).plugins[NAME];
    expect(entry.version).toBe('1.1.0');
    expect(entry.installedAt).toBe(before.installedAt);
    expect(typeof entry.updatedAt).toBe('string');
    expect(entry.integrity).toMatch(/^sha512-/);
    expect(entry.signature).toMatchObject({ verified: true, gated: true, keyid: 'SHA256:fake-test-key' });

    // Running again is a no-op.
    const again = await updateInstalledPlugins({ ...base(), checkOnly: true });
    expect(again.plugins[0].status).toBe('up-to-date');
  });

  it('reports up-to-date when already on latest', async () => {
    await start(['1.0.0']);
    await installFromRegistry('1.0.0');
    const result = await updateInstalledPlugins({ ...base(), checkOnly: true });
    expect(result.plugins[0]).toMatchObject({ status: 'up-to-date', target: '1.0.0', latest: '1.0.0' });
  });

  it('never "updates" to something older than what is installed', async () => {
    await start(['1.0.0', '1.1.0']);
    await installFromRegistry('1.1.0');
    registry!.setPackage(plugin(['1.0.0'])); // latest moved back
    const result = await updateInstalledPlugins({ ...base() });
    expect(result.plugins[0]).toMatchObject({ status: 'up-to-date' });
    expect(result.plugins[0].message).toMatch(/newer than the registry's latest/);
    expect(await installedVersion()).toBe('1.1.0');
  });

  describe('pins', () => {
    it('an exact pin holds the plugin: reported as pinned (with the newer latest), never updated', async () => {
      await start(['1.0.0', '1.1.0', '2.0.0']);
      await installFromRegistry('1.0.0', true);
      expect((await readPluginsFile(ws)).plugins[NAME].pin).toBe('1.0.0');

      const result = await updateInstalledPlugins(base());
      expect(result.plugins[0]).toMatchObject({ status: 'pinned', installed: '1.0.0', target: '1.0.0', latest: '2.0.0', pin: '1.0.0' });
      expect(result.plugins[0].message).toContain('latest is 2.0.0');
      expect(result.summary).toMatchObject({ pinned: 1, updated: 0 });
      expect(await installedVersion()).toBe('1.0.0');
    });

    it('a range pin bounds the update to the highest satisfying version, and survives the update', async () => {
      await start(['1.0.0', '1.2.0', '1.9.0', '2.0.0']);
      await installFromRegistry('1.0.0', '^1.0.0');

      const result = await updateInstalledPlugins(base());
      expect(result.plugins[0]).toMatchObject({ status: 'updated', target: '1.9.0', latest: '2.0.0', pin: '^1.0.0' });
      expect(await installedVersion()).toBe('1.9.0');
      expect((await readPluginsFile(ws)).plugins[NAME].pin).toBe('^1.0.0');

      const next = await updateInstalledPlugins({ ...base(), checkOnly: true });
      expect(next.plugins[0]).toMatchObject({ status: 'pinned', target: '1.9.0', latest: '2.0.0' });
    });

    it('an exact pin that differs from the installed version moves the plugin to the pin', async () => {
      await start(['1.0.0', '1.1.0']);
      await installFromRegistry('1.1.0');
      await setPluginPin(ws, NAME, '1.0.0');
      const result = await updateInstalledPlugins(base());
      expect(result.plugins[0]).toMatchObject({ status: 'updated', target: '1.0.0' });
      expect(await installedVersion()).toBe('1.0.0');
    });

    it('fails when the pin names an unpublished version or an unsatisfiable range', async () => {
      await start(['1.0.0']);
      await installFromRegistry('1.0.0');
      await setPluginPin(ws, NAME, '9.9.9');
      const missing = await updateInstalledPlugins({ ...base(), checkOnly: true });
      expect(missing.plugins[0].status).toBe('failed');
      expect(missing.plugins[0].message).toMatch(/not published/);

      await setPluginPin(ws, NAME, '^5.0.0');
      const range = await updateInstalledPlugins({ ...base(), checkOnly: true });
      expect(range.plugins[0].message).toMatch(/satisfies the pin/);
      expect(range.summary.failed).toBe(1);
    });

    it('pin/unpin helpers validate input and round-trip', async () => {
      await start(['1.0.0']);
      await installFromRegistry('1.0.0');

      expect(await pinInstalledPlugin(ws, NAME)).toEqual({ name: NAME, pin: '1.0.0', previousPin: null, installed: '1.0.0' });
      expect(await pinInstalledPlugin(ws, NAME, '^1.2.0')).toMatchObject({ pin: '^1.2.0', previousPin: '1.0.0' });
      expect(await pinInstalledPlugin(ws, NAME, 'v1.5.0')).toMatchObject({ pin: '1.5.0' });
      await expect(pinInstalledPlugin(ws, NAME, 'whatever')).rejects.toMatchObject({ details: { reason: 'invalid-pin' } });
      await expect(pinInstalledPlugin(ws, 'ghost', '1.0.0')).rejects.toMatchObject({ details: { reason: 'not-found' } });

      expect(await unpinInstalledPlugin(ws, NAME)).toEqual({ name: NAME, pin: null, previousPin: '1.5.0', installed: '1.0.0' });
      expect((await readPluginsFile(ws)).plugins[NAME].pin).toBeUndefined();
      await expect(unpinInstalledPlugin(ws, 'ghost')).rejects.toBeInstanceOf(PluginUpdateInputError);
    });
  });

  describe('signature verification', () => {
    it('refuses to update to a version whose signature does not verify, and keeps the old install', async () => {
      await start(['1.0.0', '1.1.0'], { tamper: true });
      await installFromRegistry('1.0.0');

      const result = await updateInstalledPlugins(base());
      expect(result.plugins[0].status).toBe('failed');
      expect(result.plugins[0].message).toMatch(/Refusing to update to unverified 1\.1\.0/);
      expect(result.plugins[0].signature).toMatchObject({ verified: false, gated: true });
      expect(await installedVersion()).toBe('1.0.0');
      expect(result.summary.failed).toBe(1);
    });

    it('refuses unsigned versions when verification is required, but updates with it disabled', async () => {
      await start(['1.0.0', '1.1.0'], { signing: false });
      await installFromRegistry('1.0.0');

      const strict = await updateInstalledPlugins(base());
      expect(strict.plugins[0].status).toBe('failed');
      expect(strict.plugins[0].signature?.reason).toMatch(/unsigned|no registry signatures/);
      expect(await installedVersion()).toBe('1.0.0');

      const lax = await updateInstalledPlugins({ ...base(), verifySignatures: false });
      expect(lax.plugins[0]).toMatchObject({ status: 'updated', target: '1.1.0' });
      expect(await installedVersion()).toBe('1.1.0');
      expect((await readPluginsFile(ws)).plugins[NAME].signature).toMatchObject({ verified: false, gated: false });
    });
  });

  describe('failures are explicit', () => {
    it('reports an unreachable registry per plugin instead of claiming success', async () => {
      await start(['1.0.0'], { failWith: 503 });
      await upsertPluginEntry(ws, NAME, { version: '1.0.0', source: 'npm', path: path.join(ws, '.re-shell', 'plugins', NAME) });
      const result = await updateInstalledPlugins({ ...base(), checkOnly: true });
      expect(result.plugins[0].status).toBe('failed');
      expect(result.plugins[0].message).toMatch(/Could not query the registry/);
      expect(result.summary.failed).toBe(1);
    });

    it('rejects an unknown plugin name up front', async () => {
      await start(['1.0.0']);
      await expect(updateInstalledPlugins({ ...base(), names: ['ghost'] })).rejects.toMatchObject({
        name: 'PluginUpdateInputError',
        details: { reason: 'not-found' },
      });
    });

    it('returns an empty result when nothing is installed', async () => {
      await start(['1.0.0']);
      const result = await updateInstalledPlugins(base());
      expect(result.plugins).toEqual([]);
      expect(result.summary.total).toBe(0);
    });

    it('a failed update leaves the previous install intact (invalid new version)', async () => {
      await start(['1.0.0']);
      await installFromRegistry('1.0.0');
      // 2.0.0 is published as a package that is no longer a re-shell plugin.
      registry!.setPackage({
        name: NAME,
        versions: {
          '1.0.0': plugin(['1.0.0']).versions['1.0.0'],
          '2.0.0': { manifest: { keywords: [], name: 'something-else', description: 'x' } },
        },
      });
      const result = await updateInstalledPlugins(base());
      expect(result.plugins[0].status).toBe('failed');
      expect(await installedVersion()).toBe('1.0.0');
      expect((await readPluginsFile(ws)).plugins[NAME].version).toBe('1.0.0');
    });
  });

  it('only touches the named plugin', async () => {
    registry = await startFakeRegistry({
      packages: [plugin(['1.0.0', '1.1.0']), { ...plugin(['1.0.0', '2.0.0']), name: 'reshell-plugin-other' }],
    });
    await installFromRegistry('1.0.0');
    await installPluginFromIdentifier('reshell-plugin-other@1.0.0', { workspaceRoot: ws, registry: registry.url });

    const result = await updateInstalledPlugins({ ...base(), names: ['reshell-plugin-other'] });
    expect(result.plugins.map((p) => p.name)).toEqual(['reshell-plugin-other']);
    expect(await installedVersion()).toBe('1.0.0');
    const other = await fs.readJSON(path.join(ws, '.re-shell', 'plugins', 'reshell-plugin-other', 'package.json'));
    expect(other.version).toBe('2.0.0');
  });
});

describe('updateInstalledPlugins: local plugins', () => {
  it('are reported as not updatable and are never modified', async () => {
    const src = path.join(tmp, 'local-src');
    await fs.ensureDir(src);
    await fs.writeJSON(path.join(src, 'package.json'), { name: 'reshell-plugin-loc', version: '1.0.0', reshell: {} });
    await fs.writeFile(path.join(src, 'index.js'), '// 1');
    await installPluginFromIdentifier(src, { workspaceRoot: ws });
    await fs.writeJSON(path.join(src, 'package.json'), { name: 'reshell-plugin-loc', version: '9.9.9', reshell: {} });

    const result = await updateInstalledPlugins({ workspaceRoot: ws, verifySignatures: true });
    expect(result.plugins[0]).toMatchObject({ source: 'local', status: 'not-updatable', target: null, installed: '1.0.0' });
    expect(result.plugins[0].message).toContain('plugin install <path> --force');
    expect(result.summary.notUpdatable).toBe(1);
    const installed = await fs.readJSON(path.join(ws, '.re-shell', 'plugins', 'reshell-plugin-loc', 'package.json'));
    expect(installed.version).toBe('1.0.0');
  });
});

describe('updateInstalledPlugins: git plugins (real git, local repository)', () => {
  let repo: string;

  const git = (...args: string[]): string =>
    execFileSync('git', args, {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x.io', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x.io' },
    }).trim();

  async function commit(version: string, body: string): Promise<string> {
    await fs.writeJSON(path.join(repo, 'package.json'), { name: 'reshell-plugin-gu', version, reshell: {} });
    await fs.writeFile(path.join(repo, 'index.js'), body);
    git('add', '-A');
    git('commit', '--quiet', '-m', `v${version}`);
    return git('rev-parse', 'HEAD');
  }

  beforeEach(async () => {
    repo = path.join(tmp, 'repo');
    await fs.ensureDir(repo);
    git('init', '--quiet', '-b', 'main');
  });

  it('detects a moved branch, then updates and records the new commit', async () => {
    const first = await commit('1.0.0', '// one');
    await installPluginFromIdentifier(`git+file://${repo}`, { workspaceRoot: ws });

    const same = await updateInstalledPlugins({ workspaceRoot: ws, verifySignatures: true, checkOnly: true });
    expect(same.plugins[0]).toMatchObject({ source: 'git', status: 'up-to-date', target: first.slice(0, 7) });

    const second = await commit('1.1.0', '// two');
    const check = await updateInstalledPlugins({ workspaceRoot: ws, verifySignatures: true, checkOnly: true });
    expect(check.plugins[0]).toMatchObject({ status: 'update-available', target: second.slice(0, 7), installed: '1.0.0' });
    expect(check.plugins[0].message).toBe(`${first.slice(0, 7)} -> ${second.slice(0, 7)}`);
    expect(await fs.readFile(path.join(ws, '.re-shell', 'plugins', 'reshell-plugin-gu', 'index.js'), 'utf8')).toBe('// one');

    const applied = await updateInstalledPlugins({ workspaceRoot: ws, verifySignatures: true });
    expect(applied.plugins[0]).toMatchObject({ status: 'updated', target: second.slice(0, 7) });
    expect(await fs.readFile(path.join(ws, '.re-shell', 'plugins', 'reshell-plugin-gu', 'index.js'), 'utf8')).toBe('// two');
    const entry = (await readPluginsFile(ws)).plugins['reshell-plugin-gu'];
    expect(entry).toMatchObject({ version: '1.1.0', git: { commit: second } });
  });

  it('follows a named branch rather than HEAD', async () => {
    await commit('1.0.0', '// main');
    git('checkout', '--quiet', '-b', 'release');
    const rel1 = await commit('1.0.1', '// release 1');
    git('checkout', '--quiet', 'main');
    await installPluginFromIdentifier(`git+file://${repo}#release`, { workspaceRoot: ws });
    expect((await readPluginsFile(ws)).plugins['reshell-plugin-gu'].git).toMatchObject({ ref: 'release', commit: rel1 });

    git('checkout', '--quiet', 'release');
    const rel2 = await commit('1.0.2', '// release 2');
    const result = await updateInstalledPlugins({ workspaceRoot: ws, verifySignatures: true });
    expect(result.plugins[0]).toMatchObject({ status: 'updated', target: rel2.slice(0, 7) });
    expect((await readPluginsFile(ws)).plugins['reshell-plugin-gu'].git).toMatchObject({ ref: 'release', commit: rel2 });
  });

  it('a pinned git plugin is held back', async () => {
    await commit('1.0.0', '// one');
    await installPluginFromIdentifier(`git+file://${repo}`, { workspaceRoot: ws, pin: true });
    await commit('1.1.0', '// two');
    const result = await updateInstalledPlugins({ workspaceRoot: ws, verifySignatures: true });
    expect(result.plugins[0].status).toBe('pinned');
    expect(await fs.readFile(path.join(ws, '.re-shell', 'plugins', 'reshell-plugin-gu', 'index.js'), 'utf8')).toBe('// one');
  });

  it('a fixed commit cannot move', async () => {
    const first = await commit('1.0.0', '// one');
    await installPluginFromIdentifier(`git+file://${repo}#${first}`, { workspaceRoot: ws });
    await commit('1.1.0', '// two');
    const result = await updateInstalledPlugins({ workspaceRoot: ws, verifySignatures: true });
    expect(result.plugins[0]).toMatchObject({ status: 'up-to-date' });
    expect(result.plugins[0].message).toMatch(/fixed commit/);
  });

  it('fails explicitly when the remote ref disappears or the remote is gone', async () => {
    await commit('1.0.0', '// one');
    git('tag', 'v1');
    await installPluginFromIdentifier(`git+file://${repo}#v1`, { workspaceRoot: ws });
    git('tag', '-d', 'v1');
    const gone = await updateInstalledPlugins({ workspaceRoot: ws, verifySignatures: true, checkOnly: true });
    expect(gone.plugins[0].status).toBe('failed');
    expect(gone.plugins[0].message).toMatch(/was not found/);

    await fs.remove(repo);
    const dead = await updateInstalledPlugins({ workspaceRoot: ws, verifySignatures: true, checkOnly: true });
    expect(dead.plugins[0].status).toBe('failed');
    expect(dead.plugins[0].message).toMatch(/git ls-remote failed/);
  });

  it('treats an install without a recorded commit as update-available (cannot prove it is current)', async () => {
    await commit('1.0.0', '// one');
    await installPluginFromIdentifier(`git+file://${repo}`, { workspaceRoot: ws });
    const file = await readPluginsFile(ws);
    const { commit: _c, ...gitWithoutCommit } = file.plugins['reshell-plugin-gu'].git!;
    void _c;
    await upsertPluginEntry(ws, 'reshell-plugin-gu', { ...file.plugins['reshell-plugin-gu'], git: gitWithoutCommit });
    const result = await updateInstalledPlugins({ workspaceRoot: ws, verifySignatures: true, checkOnly: true });
    expect(result.plugins[0].status).toBe('update-available');
    expect(result.plugins[0].message).toMatch(/commit is unknown/);
  });

  it('fails clearly when a git entry has no recorded URL', async () => {
    await upsertPluginEntry(ws, 'reshell-plugin-nogit', { version: '1.0.0', source: 'git', path: '/x' });
    const result = await updateInstalledPlugins({ workspaceRoot: ws, verifySignatures: true });
    expect(result.plugins[0]).toMatchObject({ status: 'failed' });
    expect(result.plugins[0].message).toMatch(/No git URL was recorded/);
  });

  it('resolveRemoteCommit peels annotated tags and returns null for unknown refs', async () => {
    const first = await commit('1.0.0', '// one');
    git('tag', '-a', 'v1', '-m', 'annotated');
    expect(await resolveRemoteCommit(`file://${repo}`, 'v1')).toBe(first);
    expect(await resolveRemoteCommit(`file://${repo}`, undefined)).toBe(first);
    expect(await resolveRemoteCommit(`file://${repo}`, 'main')).toBe(first);
    expect(await resolveRemoteCommit(`file://${repo}`, 'nope')).toBeNull();
  });
});
