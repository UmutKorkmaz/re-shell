import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  PluginInstallError,
  classifySource,
  isRecognizedPlugin,
  pluginDirName,
  validatePluginManifest,
  installPluginFromIdentifier,
  readPluginRegistry,
} from '../../src/utils/plugin-installer';

/**
 * plugin-installer is fs-driven (resolve/validate/copy/register into the
 * workspace's `.re-shell/plugins`). We exercise the deterministic surface:
 * the pure manifest helpers + the end-to-end *local* source path using real
 * temp directories. The git/npm paths shell out to git/npm/tar, so they are
 * intentionally not exercised here (no network/binaries in unit tests).
 */

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-installer-'));
});

afterEach(async () => {
  await fs.remove(tmp);
});

/** Materialize a fake plugin package on disk under `tmp/<dir>` and return its path. */
async function buildPlugin(
  dir: string,
  manifest: Record<string, unknown>,
  extra: { files?: Record<string, string>; nodeModules?: boolean } = {},
): Promise<string> {
  const pluginDir = path.join(tmp, dir);
  await fs.ensureDir(pluginDir);
  await fs.writeJson(path.join(pluginDir, 'package.json'), manifest);
  if (extra.files) {
    for (const [rel, contents] of Object.entries(extra.files)) {
      const target = path.join(pluginDir, rel);
      await fs.ensureDir(path.dirname(target));
      await fs.writeFile(target, contents, 'utf8');
    }
  }
  if (extra.nodeModules) {
    const depDir = path.join(pluginDir, 'node_modules', 'some-dep');
    await fs.ensureDir(depDir);
    await fs.writeFile(path.join(depDir, 'index.js'), '// should be skipped', 'utf8');
  }
  return pluginDir;
}

/** A minimal valid plugin manifest carrying the `reshell` signal. */
const validManifest = (name = 'my-plugin', version = '1.2.3') => ({
  name,
  version,
  reshell: {},
});

describe('pluginDirName', () => {
  it('returns the name unchanged when unscoped', () => {
    expect(pluginDirName('my-plugin')).toBe('my-plugin');
  });

  it('strips a single scope segment (@re-shell/foo -> foo)', () => {
    expect(pluginDirName('@re-shell/foo')).toBe('foo');
  });

  it('strips to the last segment for nested slash paths', () => {
    expect(pluginDirName('@scope/sub/name')).toBe('name');
    expect(pluginDirName('foo/bar')).toBe('bar');
  });

  it('handles a trailing-slash-style name', () => {
    expect(pluginDirName('a/b/c')).toBe('c');
  });
});

describe('isRecognizedPlugin', () => {
  it('recognizes the reshell manifest key', () => {
    expect(isRecognizedPlugin({ name: 'p', version: '1.0.0', reshell: {} })).toBe(true);
  });

  it('recognizes the legacy reshell-plugin manifest key', () => {
    expect(isRecognizedPlugin({ name: 'p', version: '1.0.0', 'reshell-plugin': {} })).toBe(true);
  });

  it('recognizes the reshell-cli manifest key', () => {
    expect(isRecognizedPlugin({ name: 'p', version: '1.0.0', 'reshell-cli': {} })).toBe(true);
  });

  it('recognizes the reshell-plugin keyword', () => {
    expect(isRecognizedPlugin({ name: 'p', version: '1.0.0', keywords: ['reshell-plugin'] })).toBe(true);
  });

  it('recognizes the reshell-plugin- name prefix', () => {
    expect(isRecognizedPlugin({ name: 'reshell-plugin-foo', version: '1.0.0' })).toBe(true);
  });

  it('recognizes the @re-shell/ scope', () => {
    expect(isRecognizedPlugin({ name: '@re-shell/bar', version: '1.0.0' })).toBe(true);
  });

  it('rejects a package with no recognized signal', () => {
    expect(isRecognizedPlugin({ name: 'random-pkg', version: '1.0.0', keywords: ['other'] })).toBe(false);
  });

  it('ignores a non-array keywords field', () => {
    expect(isRecognizedPlugin({ name: 'p', version: '1.0.0', keywords: 'reshell-plugin' })).toBe(false);
  });

  it('ignores an unrelated keyword even if it contains the substring', () => {
    expect(isRecognizedPlugin({ name: 'p', version: '1.0.0', keywords: ['not-reshell-plugin-x'] })).toBe(false);
  });
});

describe('validatePluginManifest', () => {
  it('throws when the manifest is null/undefined', () => {
    expect(() => validatePluginManifest(null)).toThrow(PluginInstallError);
    expect(() => validatePluginManifest(undefined)).toThrow(PluginInstallError);
  });

  it('throws when the manifest is not an object', () => {
    expect(() => validatePluginManifest('not-an-object')).toThrow(PluginInstallError);
    expect(() => validatePluginManifest(42)).toThrow(PluginInstallError);
  });

  it('throws when name is missing or empty', () => {
    expect(() => validatePluginManifest({ version: '1.0.0', reshell: {} })).toThrow(/name/);
    expect(() => validatePluginManifest({ name: '', version: '1.0.0', reshell: {} })).toThrow(/name/);
  });

  it('throws when version is missing or empty', () => {
    expect(() => validatePluginManifest({ name: 'p', reshell: {} })).toThrow(/version/);
    expect(() => validatePluginManifest({ name: 'p', version: '', reshell: {} })).toThrow(/version/);
  });

  it('throws (with name in details) when the package is not a recognized plugin', () => {
    let caught: PluginInstallError | undefined;
    try {
      validatePluginManifest({ name: 'random', version: '1.0.0' });
    } catch (err) {
      caught = err as PluginInstallError;
    }
    expect(caught).toBeInstanceOf(PluginInstallError);
    expect(caught?.details).toEqual({ name: 'random' });
  });

  it('returns normalized { name, version } for a valid recognized manifest', () => {
    expect(validatePluginManifest(validManifest())).toEqual({ name: 'my-plugin', version: '1.2.3' });
  });

  it('does not leak extra manifest fields into the result', () => {
    const result = validatePluginManifest({
      name: 'p',
      version: '1.0.0',
      reshell: {},
      description: 'extra',
      main: 'dist/index.js',
    });
    expect(result).toEqual({ name: 'p', version: '1.0.0' });
    expect(Object.keys(result).sort()).toEqual(['name', 'version']);
  });
});

describe('classifySource', () => {
  it('classifies an existing path as local', () => {
    expect(classifySource(tmp)).toBe('local');
  });

  it('classifies a non-existent path that is not a git URL as npm', () => {
    expect(classifySource('some-npm-package')).toBe('npm');
    expect(classifySource('@org/scoped-pkg')).toBe('npm');
  });

  it.each([
    'git+https://github.com/owner/repo.git',
    'git@github.com:owner/repo.git',
    'ssh://git@github.com/owner/repo.git',
    'https://github.com/owner/repo.git',
    'https://github.com/owner/repo',
    'github.com/owner/repo',
    'http://github.com/owner/repo.git',
  ])('classifies %s as git', (id) => {
    expect(classifySource(id)).toBe('git');
  });

  it('prefers "local" over git/npm when the identifier is an existing path', () => {
    // A directory literally named like a git URL still resolves as local.
    const fakeGitDir = path.join(tmp, 'github.com-owner-repo');
    fs.mkdirpSync(fakeGitDir);
    expect(classifySource(fakeGitDir)).toBe('local');
  });
});

describe('installPluginFromIdentifier — local source', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-ws-'));
  });

  afterEach(async () => {
    await fs.remove(workspace);
  });

  it('dry-run resolves + validates and writes nothing to disk', async () => {
    const pluginDir = await buildPlugin('src', validManifest('my-plugin'));
    const result = await installPluginFromIdentifier(pluginDir, {
      workspaceRoot: workspace,
      dryRun: true,
    });

    expect(result).toMatchObject({
      name: 'my-plugin',
      version: '1.2.3',
      source: 'local',
      dryRun: true,
    });
    // Would-be path points at the plugins dir but nothing was written.
    expect(result.path).toBe(path.join(workspace, '.re-shell', 'plugins', 'my-plugin'));
    expect(await fs.pathExists(result.path)).toBe(false);
    expect(await readPluginRegistry(workspace)).toEqual({});
  });

  it('copies the plugin into the plugins dir and registers it', async () => {
    const pluginDir = await buildPlugin(
      'src',
      validManifest('@re-shell/scoped'),
      { files: { 'dist/index.js': 'module.exports = {};' } },
    );

    const result = await installPluginFromIdentifier(pluginDir, { workspaceRoot: workspace });

    expect(result.dryRun).toBe(false);
    expect(result.source).toBe('local');
    // Scoped name is unscoped for the on-disk directory.
    const expectedPath = path.join(workspace, '.re-shell', 'plugins', 'scoped');
    expect(result.path).toBe(expectedPath);
    expect(await fs.pathExists(expectedPath)).toBe(true);
    expect(await fs.pathExists(path.join(expectedPath, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(expectedPath, 'dist/index.js'))).toBe(true);

    const registry = await readPluginRegistry(workspace);
    expect(registry['@re-shell/scoped']).toMatchObject({
      version: '1.2.3',
      source: 'local',
      path: expectedPath,
    });
    expect(typeof registry['@re-shell/scoped'].installedAt).toBe('string');
  });

  it('creates the registry with sane defaults on first install', async () => {
    const pluginDir = await buildPlugin('src', validManifest());
    await installPluginFromIdentifier(pluginDir, { workspaceRoot: workspace });

    const registryFile = path.join(workspace, '.re-shell', 'plugins.json');
    const raw = (await fs.readJson(registryFile)) as {
      version: string;
      disabled: string[];
      settings: Record<string, unknown>;
    };
    expect(raw.version).toBe('1.0.0');
    expect(raw.disabled).toEqual([]);
    expect(raw.settings).toMatchObject({
      autoUpdate: false,
      security: { allowUnverified: false, trustedSources: ['npm', 'builtin'] },
    });
  });

  it('throws when the plugin is already installed without --force', async () => {
    const pluginDir = await buildPlugin('src', validManifest('dupe'));
    await installPluginFromIdentifier(pluginDir, { workspaceRoot: workspace });

    let caught: PluginInstallError | undefined;
    try {
      await installPluginFromIdentifier(pluginDir, { workspaceRoot: workspace });
    } catch (err) {
      caught = err as PluginInstallError;
    }
    expect(caught).toBeInstanceOf(PluginInstallError);
    expect(caught?.details).toEqual({
      name: 'dupe',
      path: path.join(workspace, '.re-shell', 'plugins', 'dupe'),
    });
  });

  it('overwrites an existing install with --force', async () => {
    const pluginDir = await buildPlugin('src', validManifest('overwrite'));
    await installPluginFromIdentifier(pluginDir, { workspaceRoot: workspace });

    // Install again with force; should succeed and keep the registry entry.
    const result = await installPluginFromIdentifier(pluginDir, {
      workspaceRoot: workspace,
      force: true,
    });
    expect(result.dryRun).toBe(false);
    expect(await fs.pathExists(result.path)).toBe(true);
    expect(Object.keys(await readPluginRegistry(workspace))).toEqual(['overwrite']);
  });

  it('skips node_modules when copying', async () => {
    const pluginDir = await buildPlugin('src', validManifest('nocopy-deps'), { nodeModules: true });
    const result = await installPluginFromIdentifier(pluginDir, { workspaceRoot: workspace });

    expect(await fs.pathExists(path.join(result.path, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(result.path, 'node_modules'))).toBe(false);
  });

  it('defaults workspaceRoot to process.cwd() when omitted', async () => {
    const pluginDir = await buildPlugin('src', validManifest('cwd-default'));
    // process.chdir() is unavailable in vitest workers, so stub process.cwd.
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(workspace);
    try {
      const result = await installPluginFromIdentifier(pluginDir);
      expect(result.path.startsWith(workspace)).toBe(true);
    } finally {
      cwdSpy.mockRestore();
    }
  });

  it('fails when the local path does not exist', async () => {
    const ghost = path.join(tmp, 'does-not-exist');
    await expect(
      installPluginFromIdentifier(ghost, { workspaceRoot: workspace }),
    ).rejects.toBeInstanceOf(PluginInstallError);
  });

  it('fails when the resolved package has no package.json', async () => {
    const emptyDir = path.join(tmp, 'no-manifest');
    await fs.ensureDir(emptyDir);
    await expect(
      installPluginFromIdentifier(emptyDir, { workspaceRoot: workspace, dryRun: true }),
    ).rejects.toThrow(/package\.json/);
  });

  it('fails when the resolved package.json is not a recognized plugin', async () => {
    const bogus = await buildPlugin('bogus', { name: 'not-a-plugin', version: '0.0.1' });
    await expect(
      installPluginFromIdentifier(bogus, { workspaceRoot: workspace, dryRun: true }),
    ).rejects.toBeInstanceOf(PluginInstallError);
  });
});

describe('readPluginRegistry', () => {
  it('returns an empty object when the registry file is absent', async () => {
    const emptyWs = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-empty-ws-'));
    try {
      expect(await readPluginRegistry(emptyWs)).toEqual({});
    } finally {
      await fs.remove(emptyWs);
    }
  });

  it('returns the stored plugins map when present', async () => {
    const ws = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-pop-ws-'));
    try {
      const pluginDir = await buildPlugin('p', validManifest('stored'));
      await installPluginFromIdentifier(pluginDir, { workspaceRoot: ws });
      const registry = await readPluginRegistry(ws);
      expect(registry.stored).toMatchObject({ version: '1.2.3', source: 'local' });
      expect(registry.stored.path).toBe(path.join(ws, '.re-shell', 'plugins', 'stored'));
    } finally {
      await fs.remove(ws);
    }
  });
});

describe('PluginInstallError', () => {
  it('carries the message and sets the error name', () => {
    const err = new PluginInstallError('boom');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('PluginInstallError');
    expect(err.message).toBe('boom');
    expect(err.details).toBeUndefined();
  });

  it('forwards structured details when provided', () => {
    const err = new PluginInstallError('boom', { name: 'p', path: '/x' });
    expect(err.details).toEqual({ name: 'p', path: '/x' });
  });
});
