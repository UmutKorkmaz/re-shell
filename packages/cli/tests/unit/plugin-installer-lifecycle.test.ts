import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import {
  FIRST_PARTY_PACKAGES,
  PluginInstallError,
  classifySource,
  installPluginFromIdentifier,
  isCommitSha,
  isFirstPartyPackage,
  isRecognizedPlugin,
  isValidPackageName,
  parseGitSpec,
  parseNpmSpec,
  readPluginRegistry,
  resolvePackageSource,
  validatePluginManifest,
} from '../../src/utils/plugin-installer';
import { readPluginsFile } from '../../src/utils/plugin-store';
import { isolateNpm, startFakeRegistry, type FakeRegistry } from '../utils/fake-registry';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-inst-life-'));
});

afterEach(async () => {
  await fs.remove(tmp);
});

async function makePlugin(
  dir: string,
  manifest: Record<string, unknown>,
  files: Record<string, string> = { 'index.js': 'module.exports = { activate() {} };' }
): Promise<string> {
  const root = path.join(tmp, dir);
  await fs.ensureDir(root);
  await fs.writeJSON(path.join(root, 'package.json'), manifest);
  for (const [rel, body] of Object.entries(files)) {
    await fs.outputFile(path.join(root, rel), body);
  }
  return root;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@example.com',
    },
  }).trim();
}

describe('isRecognizedPlugin / first-party exclusion', () => {
  it('lists the first-party packages that must never be treated as plugins', () => {
    expect(FIRST_PARTY_PACKAGES).toEqual(
      expect.arrayContaining([
        '@re-shell/cli',
        '@re-shell/ui',
        '@re-shell/contracts',
        '@re-shell/mcp',
        '@re-shell/dashboard',
        '@re-shell/control-plane',
      ])
    );
  });

  it.each(['@re-shell/cli', '@re-shell/ui', '@re-shell/contracts', '@re-shell/mcp', '@re-shell/dashboard', '@re-shell/control-plane'])(
    'rejects first-party %s even though it carries the recognized scope',
    (name) => {
      expect(isFirstPartyPackage(name)).toBe(true);
      expect(isRecognizedPlugin({ name, version: '1.0.0' })).toBe(false);
      // ...and even when other plugin signals are present.
      expect(isRecognizedPlugin({ name, version: '1.0.0', keywords: ['reshell-plugin'], reshell: {} })).toBe(false);
      expect(() => validatePluginManifest({ name, version: '1.0.0', reshell: {} })).toThrow(/first-party/);
    }
  );

  it('still recognizes third-party packages under the scope and all manifest signals', () => {
    expect(isRecognizedPlugin({ name: '@re-shell/community-thing', version: '1.0.0' })).toBe(true);
    expect(isRecognizedPlugin({ name: 'x', version: '1.0.0', 'reshell-plugin': {} })).toBe(true);
    expect(isRecognizedPlugin({ name: 'x', version: '1.0.0', 'reshell-cli': {} })).toBe(true);
    expect(isRecognizedPlugin({ name: 'x', version: '1.0.0', reshell: {} })).toBe(true);
    expect(isRecognizedPlugin({ name: 'x', version: '1.0.0', keywords: ['reshell-plugin'] })).toBe(true);
    expect(isRecognizedPlugin({ name: 'reshell-plugin-y', version: '1.0.0' })).toBe(true);
    expect(isRecognizedPlugin({ name: 'lodash', version: '1.0.0' })).toBe(false);
  });
});

describe('package name safety', () => {
  it.each(['..', 'a/..', '../x', '@scope/..', '.hidden', 'a b', '', '/abs'])(
    'rejects %j as a plugin name',
    (name) => {
      expect(isValidPackageName(name)).toBe(false);
    }
  );

  it('accepts ordinary and scoped names', () => {
    expect(isValidPackageName('reshell-plugin-x')).toBe(true);
    expect(isValidPackageName('@acme/reshell-plugin.x_y')).toBe(true);
  });

  it('refuses to install a manifest whose name would escape the plugins dir', async () => {
    const ws = path.join(tmp, 'ws');
    const src = await makePlugin('evil', { name: 'x/..', version: '1.0.0', reshell: {} });
    await expect(installPluginFromIdentifier(src, { workspaceRoot: ws, force: true })).rejects.toThrow(
      PluginInstallError
    );
    // The plugins dir (and .re-shell itself) are untouched.
    expect(await fs.pathExists(path.join(ws, '.re-shell'))).toBe(false);
  });
});

describe('identifier parsing', () => {
  it.each([
    ['foo', { name: 'foo', requested: null }],
    ['foo@1.2.3', { name: 'foo', requested: '1.2.3' }],
    ['foo@^1.2.0', { name: 'foo', requested: '^1.2.0' }],
    ['foo@latest', { name: 'foo', requested: 'latest' }],
    ['@acme/foo', { name: '@acme/foo', requested: null }],
    ['@acme/foo@2.0.0', { name: '@acme/foo', requested: '2.0.0' }],
    ['https://example.com/x.tgz', { name: null, requested: null }],
    ['file:../x', { name: null, requested: null }],
  ])('parseNpmSpec(%j)', (id, expected) => {
    expect(parseNpmSpec(id)).toEqual(expected);
  });

  it('parses git identifiers with and without a ref', () => {
    expect(parseGitSpec('git+https://host/x/y.git#v1.2.0')).toEqual({ url: 'https://host/x/y.git', ref: 'v1.2.0' });
    expect(parseGitSpec('git+file:///tmp/r.git')).toEqual({ url: 'file:///tmp/r.git' });
    expect(parseGitSpec('git@host:x/y.git')).toEqual({ url: 'git@host:x/y.git' });
    expect(isCommitSha('a'.repeat(40))).toBe(true);
    expect(isCommitSha('main')).toBe(false);
  });
});

describe('install: pin', () => {
  const manifest = { name: 'reshell-plugin-p', version: '1.2.3', reshell: {} };

  it('records the resolved version for `--pin` on a local install', async () => {
    const ws = path.join(tmp, 'ws');
    const src = await makePlugin('p', manifest);
    const result = await installPluginFromIdentifier(src, { workspaceRoot: ws, pin: true });
    expect(result.pin).toBe('1.2.3');
    expect((await readPluginRegistry(ws))['reshell-plugin-p']).toMatchObject({ pin: '1.2.3' });
  });

  it('records an explicit pin string, and rejects an invalid npm range', async () => {
    const ws = path.join(tmp, 'ws');
    const src = await makePlugin('p', manifest);
    expect((await installPluginFromIdentifier(src, { workspaceRoot: ws, pin: '1.2.3' })).pin).toBe('1.2.3');
    await expect(
      installPluginFromIdentifier('definitely-not-installed-xyz', {
        workspaceRoot: ws,
        pin: 'not a range!!',
        dryRun: true,
      })
    ).rejects.toThrow(PluginInstallError);
  });

  it('dry-run reports the pin without writing', async () => {
    const ws = path.join(tmp, 'ws');
    const src = await makePlugin('p', manifest);
    const result = await installPluginFromIdentifier(src, { workspaceRoot: ws, pin: true, dryRun: true });
    expect(result.pin).toBe('1.2.3');
    expect(await fs.pathExists(path.join(ws, '.re-shell'))).toBe(false);
  });

  it('keeps an existing pin when the plugin is force-reinstalled', async () => {
    const ws = path.join(tmp, 'ws');
    const src = await makePlugin('p', manifest);
    await installPluginFromIdentifier(src, { workspaceRoot: ws, pin: '1.2.3' });
    await installPluginFromIdentifier(src, { workspaceRoot: ws, force: true });
    expect((await readPluginRegistry(ws))['reshell-plugin-p']).toMatchObject({ pin: '1.2.3' });
  });
});

describe('install: replacing an existing plugin is staged and safe', () => {
  it('swaps the directory contents on --force and leaves no staging directories', async () => {
    const ws = path.join(tmp, 'ws');
    const v1 = await makePlugin('v1', { name: 'reshell-plugin-s', version: '1.0.0', reshell: {} }, { 'index.js': '// v1', 'old.txt': 'old' });
    const v2 = await makePlugin('v2', { name: 'reshell-plugin-s', version: '2.0.0', reshell: {} }, { 'index.js': '// v2' });

    await installPluginFromIdentifier(v1, { workspaceRoot: ws });
    const result = await installPluginFromIdentifier(v2, { workspaceRoot: ws, force: true });

    expect(result.version).toBe('2.0.0');
    expect(await fs.readFile(path.join(result.path, 'index.js'), 'utf8')).toBe('// v2');
    // Files from the previous version do not survive the swap.
    expect(await fs.pathExists(path.join(result.path, 'old.txt'))).toBe(false);
    const siblings = await fs.readdir(path.dirname(result.path));
    expect(siblings).toEqual(['reshell-plugin-s']);
    expect((await readPluginsFile(ws)).plugins['reshell-plugin-s'].version).toBe('2.0.0');
  });

  it('keeps the old install when the new package is invalid', async () => {
    const ws = path.join(tmp, 'ws');
    const v1 = await makePlugin('v1', { name: 'reshell-plugin-s', version: '1.0.0', reshell: {} });
    const bad = await makePlugin('bad', { name: 'reshell-plugin-s', version: '2.0.0' }, {});
    // `bad` has the plugin-name prefix so it is recognized; break it differently: no version.
    await fs.writeJSON(path.join(bad, 'package.json'), { name: 'reshell-plugin-s' });

    await installPluginFromIdentifier(v1, { workspaceRoot: ws });
    await expect(installPluginFromIdentifier(bad, { workspaceRoot: ws, force: true })).rejects.toThrow(PluginInstallError);

    const installed = await fs.readJSON(path.join(ws, '.re-shell', 'plugins', 'reshell-plugin-s', 'package.json'));
    expect(installed.version).toBe('1.0.0');
    expect((await readPluginsFile(ws)).plugins['reshell-plugin-s'].version).toBe('1.0.0');
  });

  it('refuses to overwrite a different plugin that shares the directory name', async () => {
    const ws = path.join(tmp, 'ws');
    const a = await makePlugin('a', { name: '@a/shared', version: '1.0.0', reshell: {} });
    const b = await makePlugin('b', { name: '@b/shared', version: '1.0.0', reshell: {} });
    await installPluginFromIdentifier(a, { workspaceRoot: ws });
    await expect(installPluginFromIdentifier(b, { workspaceRoot: ws, force: true })).rejects.toThrow(/already used by plugin '@a\/shared'/);
    expect(Object.keys(await readPluginRegistry(ws))).toEqual(['@a/shared']);
  });

  it('copies a source that itself lives under a node_modules directory', async () => {
    const ws = path.join(tmp, 'ws');
    const nm = path.join(tmp, 'proj', 'node_modules', 'reshell-plugin-nm');
    await fs.ensureDir(nm);
    await fs.writeJSON(path.join(nm, 'package.json'), { name: 'reshell-plugin-nm', version: '1.0.0', reshell: {} });
    await fs.writeFile(path.join(nm, 'index.js'), '// nm');
    await fs.ensureDir(path.join(nm, 'node_modules', 'dep'));
    await fs.writeFile(path.join(nm, 'node_modules', 'dep', 'index.js'), '// nested dep');

    const result = await installPluginFromIdentifier(nm, { workspaceRoot: ws });
    expect(await fs.pathExists(path.join(result.path, 'index.js'))).toBe(true);
    // The package's own dependency tree is still not carried over.
    expect(await fs.pathExists(path.join(result.path, 'node_modules'))).toBe(false);
  });
});

describe('install: git source (real git, local repository)', () => {
  let repo: string;
  let firstCommit: string;

  beforeEach(async () => {
    repo = path.join(tmp, 'repo');
    await fs.ensureDir(repo);
    git(repo, 'init', '--quiet', '-b', 'main');
    await fs.writeJSON(path.join(repo, 'package.json'), { name: 'reshell-plugin-g', version: '1.0.0', reshell: {} });
    await fs.writeFile(path.join(repo, 'index.js'), '// one');
    git(repo, 'add', '-A');
    git(repo, 'commit', '--quiet', '-m', 'one');
    firstCommit = git(repo, 'rev-parse', 'HEAD');
    git(repo, 'tag', 'v1');
    await fs.writeFile(path.join(repo, 'index.js'), '// two');
    git(repo, 'commit', '--quiet', '-am', 'two');
  });

  it('classifies git+file URLs as git', () => {
    expect(classifySource(`git+file://${repo}`)).toBe('git');
  });

  it('clones HEAD, records the commit, and drops the .git directory', async () => {
    const ws = path.join(tmp, 'ws');
    const head = git(repo, 'rev-parse', 'HEAD');
    const result = await installPluginFromIdentifier(`git+file://${repo}`, { workspaceRoot: ws });
    expect(result.source).toBe('git');
    expect(result.commit).toBe(head);
    expect(await fs.pathExists(path.join(result.path, '.git'))).toBe(false);
    expect(await fs.readFile(path.join(result.path, 'index.js'), 'utf8')).toBe('// two');
    expect((await readPluginsFile(ws)).plugins['reshell-plugin-g'].git).toEqual({ url: `file://${repo}`, commit: head });
  });

  it('honours a #tag fragment', async () => {
    const ws = path.join(tmp, 'ws');
    const result = await installPluginFromIdentifier(`git+file://${repo}#v1`, { workspaceRoot: ws });
    expect(result.commit).toBe(firstCommit);
    expect(await fs.readFile(path.join(result.path, 'index.js'), 'utf8')).toBe('// one');
    expect((await readPluginsFile(ws)).plugins['reshell-plugin-g'].git).toMatchObject({ ref: 'v1' });
  });

  it('honours a full commit SHA fragment', async () => {
    const ws = path.join(tmp, 'ws');
    const result = await installPluginFromIdentifier(`git+file://${repo}#${firstCommit}`, { workspaceRoot: ws });
    expect(result.commit).toBe(firstCommit);
    expect(await fs.readFile(path.join(result.path, 'index.js'), 'utf8')).toBe('// one');
  });

  it('pins a git install to the resolved commit', async () => {
    const ws = path.join(tmp, 'ws');
    const result = await installPluginFromIdentifier(`git+file://${repo}`, { workspaceRoot: ws, pin: true });
    expect(result.pin).toBe(result.commit);
  });

  it('fails cleanly for an unknown ref, leaving no tmp checkout or registry entry', async () => {
    const ws = path.join(tmp, 'ws');
    await expect(
      installPluginFromIdentifier(`git+file://${repo}#no-such-ref`, { workspaceRoot: ws })
    ).rejects.toThrow(/git clone failed/);
    expect(await readPluginRegistry(ws)).toEqual({});
  });

  it('resolvePackageSource returns the git record and a working cleanup', async () => {
    const resolved = await resolvePackageSource(`git+file://${repo}`);
    expect(resolved.source).toBe('git');
    expect(await fs.pathExists(path.join(resolved.sourceDir, 'package.json'))).toBe(true);
    resolved.cleanup();
    expect(await fs.pathExists(resolved.sourceDir)).toBe(false);
  });
});

describe('install: npm source (real `npm pack` against a local registry)', () => {
  let registry: FakeRegistry;
  let restoreNpm: () => void;

  beforeAll(async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-npm-iso-'));
    restoreNpm = isolateNpm(dir);
    registry = await startFakeRegistry({
      packages: [
        {
          name: 'reshell-plugin-n',
          versions: {
            '1.0.0': { manifest: { keywords: ['reshell-plugin'], description: 'n' } },
            '1.1.0': { manifest: { keywords: ['reshell-plugin'], description: 'n' } },
          },
        },
        {
          name: '@acme/reshell-plugin-scoped',
          versions: { '2.0.0': { manifest: { keywords: ['reshell-plugin'], description: 's' } } },
        },
        { name: 'plain-lib', versions: { '1.0.0': { manifest: {} } } },
      ],
    });
  });

  afterAll(async () => {
    await registry.close();
    restoreNpm();
  });

  it('installs the requested version and records spec + pin', async () => {
    const ws = path.join(tmp, 'ws');
    const result = await installPluginFromIdentifier('reshell-plugin-n@1.0.0', {
      workspaceRoot: ws,
      registry: registry.url,
      pin: true,
    });
    expect(result).toMatchObject({ name: 'reshell-plugin-n', version: '1.0.0', source: 'npm', pin: '1.0.0' });
    const entry = (await readPluginsFile(ws)).plugins['reshell-plugin-n'];
    expect(entry).toMatchObject({ spec: 'reshell-plugin-n@1.0.0', pin: '1.0.0', source: 'npm' });

    // The recorded integrity is the real hash of the downloaded tarball: it equals what the registry advertises.
    const packument = (await (await fetch(`${registry.url}/reshell-plugin-n`)).json()) as {
      versions: Record<string, { dist: { integrity: string } }>;
    };
    expect(entry.integrity).toBe(packument.versions['1.0.0'].dist.integrity);
  });

  it('pins a range when the identifier carries one', async () => {
    const ws = path.join(tmp, 'ws');
    const result = await installPluginFromIdentifier('reshell-plugin-n@^1.0.0', {
      workspaceRoot: ws,
      registry: registry.url,
      pin: true,
    });
    expect(result.version).toBe('1.1.0');
    expect(result.pin).toBe('^1.0.0');
  });

  it('pins the resolved version for a bare name (latest)', async () => {
    const ws = path.join(tmp, 'ws');
    const result = await installPluginFromIdentifier('reshell-plugin-n', {
      workspaceRoot: ws,
      registry: registry.url,
      pin: true,
    });
    expect(result.version).toBe('1.1.0');
    expect(result.pin).toBe('1.1.0');
  });

  it('installs a scoped package into its unscoped directory', async () => {
    const ws = path.join(tmp, 'ws');
    const result = await installPluginFromIdentifier('@acme/reshell-plugin-scoped', {
      workspaceRoot: ws,
      registry: registry.url,
    });
    expect(result.name).toBe('@acme/reshell-plugin-scoped');
    expect(result.path).toBe(path.join(ws, '.re-shell', 'plugins', 'reshell-plugin-scoped'));
  });

  it('rejects a package that is not a re-shell plugin and writes nothing', async () => {
    const ws = path.join(tmp, 'ws');
    await expect(
      installPluginFromIdentifier('plain-lib', { workspaceRoot: ws, registry: registry.url })
    ).rejects.toThrow(/not a Re-Shell plugin/);
    expect(await readPluginRegistry(ws)).toEqual({});
  });

  it('fails (not silently succeeds) for a package the registry does not have', async () => {
    const ws = path.join(tmp, 'ws');
    await expect(
      installPluginFromIdentifier('reshell-plugin-missing', { workspaceRoot: ws, registry: registry.url })
    ).rejects.toThrow(/npm resolution failed/);
  });
});
