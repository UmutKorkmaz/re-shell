import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import {
  PluginStoreError,
  isSignatureRequired,
  patchPluginEntry,
  pluginsFilePath,
  readPluginsFile,
  removePluginEntry,
  setPluginPin,
  upsertPluginEntry,
  writePluginsFile,
} from '../../src/utils/plugin-store';

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-store-'));
});

afterEach(async () => {
  await fs.remove(root);
});

const entry = (over: Record<string, unknown> = {}) => ({
  version: '1.0.0',
  source: 'npm' as const,
  path: '/ws/.re-shell/plugins/x',
  ...over,
});

describe('plugin-store: reading', () => {
  it('returns the default registry when plugins.json is missing', async () => {
    const file = await readPluginsFile(root);
    expect(file.plugins).toEqual({});
    expect(file.disabled).toEqual([]);
    expect(file.settings.security?.allowUnverified).toBe(false);
  });

  it('refuses to read (and therefore overwrite) a corrupt file', async () => {
    await fs.ensureDir(path.dirname(pluginsFilePath(root)));
    await fs.writeFile(pluginsFilePath(root), '{ not json');
    await expect(readPluginsFile(root)).rejects.toBeInstanceOf(PluginStoreError);
    await expect(upsertPluginEntry(root, 'x', entry())).rejects.toBeInstanceOf(PluginStoreError);
    // The corrupt file is untouched.
    expect(await fs.readFile(pluginsFilePath(root), 'utf8')).toBe('{ not json');
  });

  it('rejects a non-object top level', async () => {
    await fs.ensureDir(path.dirname(pluginsFilePath(root)));
    await fs.writeJSON(pluginsFilePath(root), ['nope']);
    await expect(readPluginsFile(root)).rejects.toThrow(/JSON object/);
  });

  it('normalizes missing/invalid sections instead of crashing', async () => {
    await fs.ensureDir(path.dirname(pluginsFilePath(root)));
    await fs.writeJSON(pluginsFilePath(root), { plugins: 'bad', disabled: [1, 'a'], settings: 7 });
    const file = await readPluginsFile(root);
    expect(file.plugins).toEqual({});
    expect(file.disabled).toEqual(['a']);
    expect(file.settings.security?.allowUnverified).toBe(false);
  });
});

describe('plugin-store: writing', () => {
  it('writes atomically (no temp files left behind)', async () => {
    await upsertPluginEntry(root, 'a', entry());
    const files = await fs.readdir(path.dirname(pluginsFilePath(root)));
    expect(files).toEqual(['plugins.json']);
  });

  it('upsert keeps installedAt and pin across a reinstall, and stamps updatedAt', async () => {
    const first = await upsertPluginEntry(root, 'a', entry({ pin: '1.0.0' }));
    expect(first.updatedAt).toBeUndefined();
    await new Promise((r) => setTimeout(r, 5));
    const second = await upsertPluginEntry(root, 'a', entry({ version: '1.1.0' }));
    expect(second.installedAt).toBe(first.installedAt);
    expect(second.pin).toBe('1.0.0');
    expect(second.version).toBe('1.1.0');
    expect(typeof second.updatedAt).toBe('string');
  });

  it('an explicit pin on reinstall wins over the previous pin', async () => {
    await upsertPluginEntry(root, 'a', entry({ pin: '1.0.0' }));
    const next = await upsertPluginEntry(root, 'a', entry({ pin: '^1.0.0' }));
    expect(next.pin).toBe('^1.0.0');
  });

  it('patchPluginEntry merges fields and returns null for unknown plugins', async () => {
    await upsertPluginEntry(root, 'a', entry());
    const patched = await patchPluginEntry(root, 'a', { integrity: 'sha512-x' });
    expect(patched?.integrity).toBe('sha512-x');
    expect(patched?.version).toBe('1.0.0');
    expect(await patchPluginEntry(root, 'missing', { integrity: 'x' })).toBeNull();
  });

  it('removePluginEntry deletes the entry and its disabled marker', async () => {
    await upsertPluginEntry(root, 'a', entry());
    const file = await readPluginsFile(root);
    await writePluginsFile(root, { ...file, disabled: ['a', 'b'] });

    const removed = await removePluginEntry(root, 'a');
    expect(removed?.version).toBe('1.0.0');
    const after = await readPluginsFile(root);
    expect(after.plugins.a).toBeUndefined();
    expect(after.disabled).toEqual(['b']);
    expect(await removePluginEntry(root, 'a')).toBeNull();
  });
});

describe('plugin-store: pins', () => {
  it('sets, replaces and clears a pin', async () => {
    await upsertPluginEntry(root, 'a', entry());
    const set = await setPluginPin(root, 'a', '^1.2.0');
    expect(set?.previous).toBeNull();
    expect((await readPluginsFile(root)).plugins.a.pin).toBe('^1.2.0');

    const replaced = await setPluginPin(root, 'a', '1.2.3');
    expect(replaced?.previous).toBe('^1.2.0');

    const cleared = await setPluginPin(root, 'a', null);
    expect(cleared?.previous).toBe('1.2.3');
    expect('pin' in (await readPluginsFile(root)).plugins.a).toBe(false);
  });

  it('returns null for an unknown plugin', async () => {
    expect(await setPluginPin(root, 'nope', '1.0.0')).toBeNull();
  });
});

describe('plugin-store: signature policy', () => {
  it('requires signatures unless allowUnverified is true', async () => {
    expect(await isSignatureRequired(root)).toBe(true);
    const file = await readPluginsFile(root);
    await writePluginsFile(root, {
      ...file,
      settings: { ...file.settings, security: { ...file.settings.security, allowUnverified: true } },
    });
    expect(await isSignatureRequired(root)).toBe(false);
  });
});
