import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import {
  jsonResponseSchema,
  pluginInfoResponseSchema,
  pluginListResponseSchema,
  pluginPinResponseSchema,
  pluginReviewAddResponseSchema,
  pluginReviewListResponseSchema,
  pluginUninstallResponseSchema,
  pluginUpdateResponseSchema,
  pluginValidateResponseSchema,
} from '@re-shell/contracts';

// Registry construction probes `npm root -g`; keep discovery to the fixture workspace.
vi.mock('child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execSync: () => {
      throw new Error('execSync disabled in tests');
    },
  };
});

const spinnerLog: string[] = [];
vi.mock('../../src/utils/spinner', () => ({
  createSpinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    setText: vi.fn(),
    succeed: (msg?: string) => {
      spinnerLog.push(String(msg ?? ''));
    },
    fail: vi.fn(),
  }),
}));

import {
  addPluginReview,
  listPluginReviews,
  managePlugins,
  pinPlugin,
  showPluginInfo,
  uninstallPlugin,
  unpinPlugin,
  updatePlugins,
  validatePlugin,
} from '../../src/commands/plugin';
import { ValidationError } from '../../src/utils/error-handler';
import { installPluginFromIdentifier } from '../../src/utils/plugin-installer';
import { readPluginsFile, writePluginsFile } from '../../src/utils/plugin-store';
import { qualityCachePath } from '../../src/utils/plugin-ratings';
import type { FetchLike } from '../../src/utils/registry-client';
import { isolateNpm, startFakeRegistry, type FakeRegistry } from '../utils/fake-registry';

let ws: string;
let src: string;
let stdout: string;
let consoleOut: string[];
const originalExitCode = process.exitCode;

beforeEach(async () => {
  ws = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-cmd-ws-')));
  src = path.join(ws, '_src');
  await fs.ensureDir(src);
  process.exitCode = undefined;
  stdout = '';
  consoleOut = [];
  spinnerLog.length = 0;
  vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
    stdout += String(chunk);
    return true;
  }) as typeof process.stdout.write);
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    consoleOut.push(args.map(String).join(' '));
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = originalExitCode;
  await fs.remove(ws);
});

/** The single JSON envelope the command wrote, parsed. Asserts the one-line contract. */
function envelope(): { ok: boolean; data?: any; error?: { code: string; message: string; details?: any }; warnings: string[] } {
  const lines = stdout.split('\n').filter(l => l.length > 0);
  expect(lines, `stdout was: ${stdout}`).toHaveLength(1);
  return JSON.parse(lines[0]);
}

function validated<T extends z.ZodTypeAny>(schema: T) {
  const parsed = jsonResponseSchema(schema).safeParse(envelope());
  expect(parsed.success, JSON.stringify(parsed, null, 1)).toBe(true);
  return envelope();
}

const human = () => consoleOut.join('\n');

async function makePlugin(name: string, extra: Record<string, unknown> = {}, files: Record<string, string> = {}): Promise<string> {
  const dir = path.join(src, name.replace(/[@/]/g, '_'));
  await fs.ensureDir(dir);
  await fs.writeJSON(path.join(dir, 'package.json'), {
    name,
    version: '1.0.0',
    description: `${name} plugin`,
    main: 'index.js',
    keywords: ['reshell-plugin'],
    engines: { 'reshell-cli': '>=0.30.0' },
    ...extra,
  });
  await fs.writeFile(path.join(dir, 'index.js'), files['index.js'] ?? 'exports.activate = () => {};');
  for (const [rel, body] of Object.entries(files)) {
    if (rel !== 'index.js') await fs.outputFile(path.join(dir, rel), body);
  }
  return dir;
}

async function install(name: string, extra: Record<string, unknown> = {}, pin?: boolean): Promise<void> {
  await installPluginFromIdentifier(await makePlugin(name, extra), { workspaceRoot: ws, pin });
}

describe('plugin list --json', () => {
  it('emits an ok envelope with an empty list for a fresh workspace (never nothing, exit 0)', async () => {
    await managePlugins({ json: true, cwd: ws });
    const env = validated(pluginListResponseSchema);
    expect(env.ok).toBe(true);
    expect(env.data).toEqual({ plugins: [], total: 0 });
    expect(env.warnings).toEqual([]);
    expect(process.exitCode).toBeUndefined();
  });

  it('lists installed plugins with origin, pin, install time and team reviews', async () => {
    await install('reshell-plugin-a', {}, true);
    await install('reshell-plugin-b');
    await addPluginReview('reshell-plugin-a', { cwd: ws, rating: 4, comment: 'ok', author: 'a@x.io', json: true });
    stdout = '';

    await managePlugins({ json: true, cwd: ws });
    const env = validated(pluginListResponseSchema);
    expect(env.data.total).toBe(2);
    const [a, b] = env.data.plugins;
    expect(a).toMatchObject({
      name: 'reshell-plugin-a',
      version: '1.0.0',
      origin: 'local',
      managed: true,
      pin: '1.0.0',
      state: 'unloaded',
      reviews: { count: 1, average: 4 },
    });
    expect(typeof a.installedAt).toBe('string');
    expect(b).toMatchObject({ name: 'reshell-plugin-b', pin: null, reviews: { count: 0, average: null } });
    expect(a.path).toBe(path.join(ws, '.re-shell', 'plugins', 'reshell-plugin-a'));
  });

  it('reports node_modules plugins (incl. symlinked pnpm layout) but not first-party packages', async () => {
    const real = path.join(ws, 'node_modules', '.pnpm', 'reshell-plugin-pnpm@1.0.0', 'node_modules', 'reshell-plugin-pnpm');
    await fs.ensureDir(real);
    await fs.writeJSON(path.join(real, 'package.json'), {
      name: 'reshell-plugin-pnpm',
      version: '1.0.0',
      description: 'd',
      main: 'index.js',
    });
    await fs.symlink(real, path.join(ws, 'node_modules', 'reshell-plugin-pnpm'), 'dir');
    for (const name of ['cli', 'ui', 'contracts']) {
      const dir = path.join(ws, 'node_modules', '@re-shell', name);
      await fs.ensureDir(dir);
      await fs.writeJSON(path.join(dir, 'package.json'), { name: `@re-shell/${name}`, version: '1.0.0', description: 'd', main: 'index.js' });
    }

    await managePlugins({ json: true, cwd: ws });
    const env = validated(pluginListResponseSchema);
    expect(env.data.plugins.map((p: { name: string }) => p.name)).toEqual(['reshell-plugin-pnpm']);
    expect(env.data.plugins[0]).toMatchObject({ origin: 'node_modules', managed: false });
  });

  it('warns about a plugins.json entry whose files are gone', async () => {
    await install('reshell-plugin-gone');
    await fs.remove(path.join(ws, '.re-shell', 'plugins', 'reshell-plugin-gone'));

    await managePlugins({ json: true, cwd: ws });
    const env = validated(pluginListResponseSchema);
    expect(env.data.total).toBe(0);
    expect(env.warnings[0]).toMatch(/plugins\.json lists 'reshell-plugin-gone'/);
  });

  it('fails with PLUGIN_LIST_ERROR and exit 1 on a corrupt plugins.json (and does not overwrite it)', async () => {
    await fs.outputFile(path.join(ws, '.re-shell', 'plugins.json'), '{ nope');
    await managePlugins({ json: true, cwd: ws });
    const env = envelope();
    expect(env).toMatchObject({ ok: false, error: { code: 'PLUGIN_LIST_ERROR' } });
    expect(process.exitCode).toBe(1);
    expect(await fs.readFile(path.join(ws, '.re-shell', 'plugins.json'), 'utf8')).toBe('{ nope');
  });

  it('human output shows pin and origin', async () => {
    await install('reshell-plugin-a', {}, true);
    await managePlugins({ cwd: ws, verbose: true });
    expect(human()).toContain('reshell-plugin-a');
    expect(human()).toContain('[pinned 1.0.0]');
    expect(human()).toContain('Origin: local');
  });
});

describe('plugin info --json', () => {
  it('reports provenance, lifecycle, reviews and (not applicable) quality for a local plugin', async () => {
    await install('reshell-plugin-a', { dependencies: {} });
    await addPluginReview('reshell-plugin-a', { cwd: ws, rating: 5, comment: 'great', author: 'a@x.io', json: true });
    await addPluginReview('reshell-plugin-a', { cwd: ws, rating: 3, comment: 'fine', author: 'b@x.io', json: true });
    stdout = '';

    await showPluginInfo('reshell-plugin-a', { json: true, cwd: ws });
    const env = validated(pluginInfoResponseSchema);
    expect(env.data).toMatchObject({
      name: 'reshell-plugin-a',
      origin: 'local',
      managed: true,
      quality: null,
      reviews: { count: 2, average: 4 },
      install: { source: 'local', integrity: null, signature: null, git: null },
      manifest: { engines: { 'reshell-cli': '>=0.30.0' }, keywords: ['reshell-plugin'] },
    });
    expect(env.data.recentReviews.map((r: { author: string }) => r.author).sort()).toEqual(['a@x.io', 'b@x.io']);
    expect(env.warnings).toEqual([]);
  });

  it('reports PLUGIN_NOT_FOUND (exit 1) for an unknown plugin', async () => {
    await showPluginInfo('reshell-plugin-ghost', { json: true, cwd: ws });
    expect(envelope()).toMatchObject({ ok: false, error: { code: 'PLUGIN_NOT_FOUND', details: { name: 'reshell-plugin-ghost' } } });
    expect(process.exitCode).toBe(1);
  });

  it('human mode shows installation, team reviews and the not-applicable quality note', async () => {
    await install('reshell-plugin-a');
    await addPluginReview('reshell-plugin-a', { cwd: ws, rating: 5, comment: 'great', author: 'a@x.io' });
    await showPluginInfo('reshell-plugin-a', { cwd: ws });
    const out = human();
    expect(out).toContain('reshell-plugin-a v1.0.0');
    expect(out).toContain('Origin: local');
    expect(out).toContain('Team reviews:');
    expect(out).toContain('5/5 from 1 review(s)');
    expect(out).toContain('not applicable');
  });

  describe('registry quality for npm-installed plugins (real npm install via a local registry)', () => {
    let registry: FakeRegistry;
    let restoreNpm: () => void;

    beforeAll(async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-cmd-npm-'));
      restoreNpm = isolateNpm(dir);
      registry = await startFakeRegistry({
        packages: [{ name: 'reshell-plugin-npm', versions: { '1.0.0': { manifest: { keywords: ['reshell-plugin'], description: 'npm plugin' } } } }],
      });
    });

    afterAll(async () => {
      await registry.close();
      restoreNpm();
    });

    const npmsOk: FetchLike = async (url: string) => {
      const ok = url.includes('api.npms.io');
      return {
        ok,
        status: ok ? 200 : 404,
        statusText: ok ? 'OK' : 'Not Found',
        json: async () => ({
          score: { final: 0.7, detail: { quality: 0.8, popularity: 0.4, maintenance: 0.9 } },
          collected: { npm: { downloads: [{ from: '2026-09-01T00:00:00Z', to: '2026-10-01T00:00:00Z', count: 777 }] } },
        }),
      };
    };

    it('adds real quality data, caches it, and survives the network going away', async () => {
      await installPluginFromIdentifier('reshell-plugin-npm', { workspaceRoot: ws, registry: registry.url });

      await showPluginInfo('reshell-plugin-npm', { json: true, cwd: ws, fetchImpl: npmsOk });
      const online = validated(pluginInfoResponseSchema);
      expect(online.data.install).toMatchObject({ source: 'npm', spec: 'reshell-plugin-npm' });
      expect(online.data.install.integrity).toMatch(/^sha512-/);
      expect(online.data.quality).toMatchObject({ source: 'npms', rating: 3.5, downloadsLastMonth: 777, cached: false });
      expect(await fs.pathExists(qualityCachePath(ws))).toBe(true);

      stdout = '';
      const down: FetchLike = async () => {
        throw new Error('network unreachable');
      };
      await showPluginInfo('reshell-plugin-npm', { json: true, cwd: ws, fetchImpl: down });
      const cached = validated(pluginInfoResponseSchema);
      expect(cached.data.quality).toMatchObject({ source: 'npms', rating: 3.5, cached: true });
    });

    it('reports unavailable quality as a warning, never as a made-up rating', async () => {
      await installPluginFromIdentifier('reshell-plugin-npm', { workspaceRoot: ws, registry: registry.url });
      const down: FetchLike = async () => {
        throw new Error('network unreachable');
      };
      await showPluginInfo('reshell-plugin-npm', { json: true, cwd: ws, fetchImpl: down });
      const env = validated(pluginInfoResponseSchema);
      expect(env.ok).toBe(true);
      expect(env.data.quality).toMatchObject({ source: 'unavailable', rating: null, score: null });
      expect(env.warnings.join(' ')).toMatch(/Quality data unavailable/);
    });

    it('--offline never touches the network', async () => {
      await installPluginFromIdentifier('reshell-plugin-npm', { workspaceRoot: ws, registry: registry.url });
      const spy = vi.fn(npmsOk);
      await showPluginInfo('reshell-plugin-npm', { json: true, cwd: ws, fetchImpl: spy, offline: true });
      expect(spy).not.toHaveBeenCalled();
      expect(validated(pluginInfoResponseSchema).data.quality.source).toBe('unavailable');
    });
  });
});

describe('plugin uninstall', () => {
  it('really removes the plugin (list no longer shows it) and reports what was removed', async () => {
    await install('reshell-plugin-a');
    const dir = path.join(ws, '.re-shell', 'plugins', 'reshell-plugin-a');
    expect(await fs.pathExists(dir)).toBe(true);

    await uninstallPlugin('reshell-plugin-a', { json: true, cwd: ws, force: true });
    const env = validated(pluginUninstallResponseSchema);
    expect(env.data).toMatchObject({
      name: 'reshell-plugin-a',
      version: '1.0.0',
      dryRun: false,
      removed: { paths: [dir], registryEntry: true },
      kept: [],
    });
    expect(await fs.pathExists(dir)).toBe(false);
    expect((await readPluginsFile(ws)).plugins).toEqual({});

    stdout = '';
    await managePlugins({ json: true, cwd: ws });
    expect(envelope().data.total).toBe(0);
  });

  it('takes no simulated time: no timer is ever scheduled', async () => {
    await install('reshell-plugin-a');
    vi.useFakeTimers();
    try {
      await uninstallPlugin('reshell-plugin-a', { json: true, cwd: ws, force: true });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
    expect(envelope().ok).toBe(true);
  });

  it('an unknown plugin is a PLUGIN_NOT_FOUND failure with exit 1, and a ValidationError in human mode', async () => {
    await uninstallPlugin('reshell-plugin-ghost', { json: true, cwd: ws });
    expect(envelope()).toMatchObject({ ok: false, error: { code: 'PLUGIN_NOT_FOUND' } });
    expect(process.exitCode).toBe(1);

    process.exitCode = undefined;
    await expect(uninstallPlugin('reshell-plugin-ghost', { cwd: ws })).rejects.toThrow(ValidationError);
    await expect(uninstallPlugin('reshell-plugin-ghost', { cwd: ws })).rejects.toThrow("Plugin 'reshell-plugin-ghost' is not installed");
  });

  it('--dry-run reports the plan and removes nothing', async () => {
    await install('reshell-plugin-a');
    await uninstallPlugin('reshell-plugin-a', { json: true, cwd: ws, dryRun: true });
    const env = validated(pluginUninstallResponseSchema);
    expect(env.data.dryRun).toBe(true);
    expect(env.data.removed.paths).toHaveLength(1);
    expect(await fs.pathExists(path.join(ws, '.re-shell', 'plugins', 'reshell-plugin-a'))).toBe(true);
  });

  it('keeps plugin data without --purge and says so; --purge removes it', async () => {
    await install('reshell-plugin-a');
    const data = path.join(ws, '.re-shell', 'data', 'reshell-plugin-a');
    await fs.outputFile(path.join(data, 'state.json'), '{}');

    await uninstallPlugin('reshell-plugin-a', { json: true, cwd: ws, force: true });
    expect(validated(pluginUninstallResponseSchema).data.kept).toEqual([data]);
    expect(await fs.pathExists(data)).toBe(true);

    stdout = '';
    await install('reshell-plugin-a');
    await uninstallPlugin('reshell-plugin-a', { json: true, cwd: ws, force: true, purge: true });
    expect(envelope().data.removed.paths).toContain(data);
    expect(await fs.pathExists(data)).toBe(false);
  });

  it('refuses a node_modules plugin with PLUGIN_UNINSTALL_ERROR and deletes nothing', async () => {
    const nm = path.join(ws, 'node_modules', 'reshell-plugin-pm');
    await fs.ensureDir(nm);
    await fs.writeJSON(path.join(nm, 'package.json'), { name: 'reshell-plugin-pm', version: '1.0.0', description: 'd', main: 'index.js' });
    await uninstallPlugin('reshell-plugin-pm', { json: true, cwd: ws, force: true });
    expect(envelope()).toMatchObject({ ok: false, error: { code: 'PLUGIN_UNINSTALL_ERROR', details: { reason: 'not-managed' } } });
    expect(process.exitCode).toBe(1);
    expect(await fs.pathExists(path.join(nm, 'package.json'))).toBe(true);
  });

  it('refuses to remove a plugin another plugin depends on unless --force', async () => {
    await install('reshell-plugin-base');
    await install('reshell-plugin-top', { dependencies: { 'reshell-plugin-base': '^1.0.0' } });

    await uninstallPlugin('reshell-plugin-base', { json: true, cwd: ws });
    expect(envelope()).toMatchObject({
      ok: false,
      error: { code: 'PLUGIN_UNINSTALL_ERROR', details: { reason: 'has-dependents', dependents: ['reshell-plugin-top'] } },
    });
    expect(await fs.pathExists(path.join(ws, '.re-shell', 'plugins', 'reshell-plugin-base'))).toBe(true);

    stdout = '';
    process.exitCode = undefined;
    await uninstallPlugin('reshell-plugin-base', { json: true, cwd: ws, force: true });
    expect(envelope().ok).toBe(true);
  });

  it('human mode prints each removed path', async () => {
    await install('reshell-plugin-a');
    await uninstallPlugin('reshell-plugin-a', { cwd: ws, force: true });
    expect(spinnerLog.join('\n')).toContain('Plugin reshell-plugin-a uninstalled successfully!');
    expect(human()).toContain(`Removed: ${path.join(ws, '.re-shell', 'plugins', 'reshell-plugin-a')}`);
    expect(human()).toContain('Removed: plugins.json entry for reshell-plugin-a');
  });
});

describe('plugin update', () => {
  let registry: FakeRegistry;
  let restoreNpm: () => void;

  beforeAll(async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-cmd-up-'));
    restoreNpm = isolateNpm(dir);
    registry = await startFakeRegistry({
      packages: [
        {
          name: 'reshell-plugin-up',
          versions: {
            '1.0.0': { manifest: { keywords: ['reshell-plugin'], description: 'up' } },
            '1.1.0': { manifest: { keywords: ['reshell-plugin'], description: 'up' } },
          },
        },
      ],
    });
  });

  afterAll(async () => {
    await registry.close();
    restoreNpm();
  });

  it('--check --json reports updates without changing anything; a later run applies them', async () => {
    await installPluginFromIdentifier('reshell-plugin-up@1.0.0', { workspaceRoot: ws, registry: registry.url });

    await updatePlugins(undefined, { json: true, check: true, cwd: ws, registry: registry.url });
    const check = validated(pluginUpdateResponseSchema);
    expect(check.data.checkOnly).toBe(true);
    expect(check.data.plugins[0]).toMatchObject({ name: 'reshell-plugin-up', status: 'update-available', installed: '1.0.0', target: '1.1.0' });
    expect((await readPluginsFile(ws)).plugins['reshell-plugin-up'].version).toBe('1.0.0');
    expect(process.exitCode).toBeUndefined();

    stdout = '';
    await updatePlugins('reshell-plugin-up', { json: true, cwd: ws, registry: registry.url });
    const applied = validated(pluginUpdateResponseSchema);
    expect(applied.data.plugins[0]).toMatchObject({ status: 'updated', target: '1.1.0' });
    expect(applied.data.plugins[0].signature).toMatchObject({ verified: true, gated: true });
    expect((await readPluginsFile(ws)).plugins['reshell-plugin-up'].version).toBe('1.1.0');
  });

  it('honours the workspace security setting: allowUnverified skips signature verification', async () => {
    await installPluginFromIdentifier('reshell-plugin-up@1.0.0', { workspaceRoot: ws, registry: registry.url });
    const file = await readPluginsFile(ws);
    await writePluginsFile(ws, { ...file, settings: { ...file.settings, security: { allowUnverified: true } } });

    await updatePlugins(undefined, { json: true, check: true, cwd: ws, registry: registry.url });
    expect(envelope().data.plugins[0].signature).toBeNull();
  });

  it('a failing update is ok:false PLUGIN_UPDATE_ERROR with the full report in details and exit 1', async () => {
    const dead = await startFakeRegistry({ packages: [], failWith: 503 });
    try {
      await installPluginFromIdentifier('reshell-plugin-up@1.0.0', { workspaceRoot: ws, registry: registry.url });
      await updatePlugins(undefined, { json: true, check: true, cwd: ws, registry: dead.url });
      const env = envelope();
      expect(env).toMatchObject({ ok: false, error: { code: 'PLUGIN_UPDATE_ERROR' } });
      expect(pluginUpdateResponseSchema.safeParse(env.error!.details).success).toBe(true);
      expect(env.error!.details.plugins[0].status).toBe('failed');
      expect(env.error!.message).toMatch(/1 plugin update\(s\) failed/);
      expect(process.exitCode).toBe(1);

      process.exitCode = undefined;
      await expect(updatePlugins(undefined, { check: true, cwd: ws, registry: dead.url })).rejects.toThrow(/plugin update\(s\) failed/);
    } finally {
      await dead.close();
    }
  });

  it('local plugins are listed as not updatable in human mode too', async () => {
    await install('reshell-plugin-local');
    await updatePlugins(undefined, { cwd: ws, check: true });
    expect(human()).toContain('not updatable');
    expect(human()).toContain('1 plugin(s):');
    expect(process.exitCode).toBeUndefined();
  });
});

describe('plugin validate', () => {
  it('a valid plugin: ok envelope, warnings carried in the envelope, exit 0', async () => {
    const dir = await makePlugin('reshell-plugin-v', {}, { 'index.js': 'exports.activate = () => fetch("https://example.com");' });
    await validatePlugin(dir, { json: true });
    const env = validated(pluginValidateResponseSchema);
    expect(env.ok).toBe(true);
    expect(env.data.valid).toBe(true);
    expect(env.data.counts).toMatchObject({ errors: 0, warnings: 1 });
    expect(env.warnings).toHaveLength(1);
    expect(env.warnings[0]).toMatch(/^security-network: makes network calls.*\(index\.js:1\)$/);
    expect(process.exitCode).toBeUndefined();
  });

  it('an invalid plugin: ok:false PLUGIN_VALIDATE_ERROR, full report in details, warnings kept, exit 1', async () => {
    const dir = await makePlugin('reshell-plugin-bad', {}, { 'index.js': 'exports.activate = () => {};\nconst x = eval(input);\nfetch("http://x");' });
    await validatePlugin(dir, { json: true });
    const env = envelope();
    expect(env).toMatchObject({ ok: false, error: { code: 'PLUGIN_VALIDATE_ERROR' } });
    expect(env.error!.message).toBe('Plugin validation failed: 1 error(s), 1 warning(s)');
    expect(pluginValidateResponseSchema.safeParse(env.error!.details).success).toBe(true);
    expect(env.error!.details).toMatchObject({ valid: false, counts: { errors: 1, warnings: 1 } });
    expect(env.warnings).toHaveLength(1);
    expect(process.exitCode).toBe(1);
  });

  it('--strict fails a plugin that only has warnings', async () => {
    const dir = await makePlugin('reshell-plugin-w', {}, { 'index.js': 'exports.activate = () => fetch("https://example.com");' });
    await validatePlugin(dir, { json: true, strict: true });
    const env = envelope();
    expect(env).toMatchObject({ ok: false, error: { code: 'PLUGIN_VALIDATE_ERROR' } });
    expect(env.error!.message).toMatch(/strict mode: 1 warning\(s\)/);
    expect(process.exitCode).toBe(1);
  });

  it('an incompatible engines.reshell-cli fails validation', async () => {
    const dir = await makePlugin('reshell-plugin-old', { engines: { 'reshell-cli': '^99.0.0' } });
    await validatePlugin(dir, { json: true });
    expect(envelope().error!.details.findings.some((f: { id: string }) => f.id === 'engines-reshell-cli-unsatisfied')).toBe(true);
  });

  it('a missing path is PLUGIN_VALIDATE_ERROR with the reason', async () => {
    await validatePlugin(path.join(ws, 'nope'), { json: true });
    expect(envelope()).toMatchObject({ ok: false, error: { code: 'PLUGIN_VALIDATE_ERROR', details: { reason: 'not-found' } } });
    expect(process.exitCode).toBe(1);
  });

  it('resolves a relative path against the workspace', async () => {
    await makePlugin('reshell-plugin-rel');
    await validatePlugin(path.join('_src', 'reshell-plugin-rel'), { json: true, cwd: ws });
    expect(envelope().ok).toBe(true);
  });

  it('human mode prints findings and fails an invalid plugin with a ValidationError', async () => {
    const dir = await makePlugin('reshell-plugin-bad', {}, { 'index.js': 'exports.activate = () => {};\neval(x);' });
    await expect(validatePlugin(dir)).rejects.toThrow('Plugin validation failed: 1 error(s), 0 warning(s)');
    expect(human()).toContain('ERROR   security-eval');
    expect(human()).not.toContain('Plugin is valid');

    consoleOut = [];
    const good = await makePlugin('reshell-plugin-good');
    await validatePlugin(good);
    expect(human()).toContain('Plugin is valid');
  });
});

describe('plugin pin / unpin', () => {
  it('pins the installed version by default, then a range, then unpins', async () => {
    await install('reshell-plugin-a');
    await pinPlugin('reshell-plugin-a', undefined, { json: true, cwd: ws });
    expect(validated(pluginPinResponseSchema).data).toEqual({ name: 'reshell-plugin-a', pin: '1.0.0', previousPin: null, installed: '1.0.0' });

    stdout = '';
    await pinPlugin('reshell-plugin-a', '^1.0.0', { json: true, cwd: ws });
    expect(envelope().data).toMatchObject({ pin: '^1.0.0', previousPin: '1.0.0' });
    expect((await readPluginsFile(ws)).plugins['reshell-plugin-a'].pin).toBe('^1.0.0');

    stdout = '';
    await unpinPlugin('reshell-plugin-a', { json: true, cwd: ws });
    expect(envelope().data).toEqual({ name: 'reshell-plugin-a', pin: null, previousPin: '^1.0.0', installed: '1.0.0' });
    expect('pin' in (await readPluginsFile(ws)).plugins['reshell-plugin-a']).toBe(false);
  });

  it('fails for unknown plugins (PLUGIN_NOT_FOUND) and invalid pins (PLUGIN_PIN_ERROR)', async () => {
    await pinPlugin('reshell-plugin-ghost', '1.0.0', { json: true, cwd: ws });
    expect(envelope()).toMatchObject({ ok: false, error: { code: 'PLUGIN_NOT_FOUND' } });
    expect(process.exitCode).toBe(1);

    stdout = '';
    process.exitCode = undefined;
    await install('reshell-plugin-a');
    await pinPlugin('reshell-plugin-a', 'not-a-version', { json: true, cwd: ws });
    expect(envelope()).toMatchObject({ ok: false, error: { code: 'PLUGIN_PIN_ERROR', details: { reason: 'invalid-pin' } } });
    expect(process.exitCode).toBe(1);

    await expect(pinPlugin('reshell-plugin-a', 'not-a-version', { cwd: ws })).rejects.toThrow(/Pin failed: Invalid pin/);
    await expect(unpinPlugin('reshell-plugin-ghost', { cwd: ws })).rejects.toThrow(/Pin failed/);
  });

  it('human mode confirms', async () => {
    await install('reshell-plugin-a');
    await pinPlugin('reshell-plugin-a', '1.0.0', { cwd: ws });
    expect(human()).toContain('Pinned reshell-plugin-a to 1.0.0');
    await unpinPlugin('reshell-plugin-a', { cwd: ws });
    expect(human()).toContain('Unpinned reshell-plugin-a (was 1.0.0)');
    await unpinPlugin('reshell-plugin-a', { cwd: ws });
    expect(human()).toContain('reshell-plugin-a had no pin');
  });
});

describe('plugin review add / list', () => {
  it('adds a review, records the installed version, and updates it for the same author', async () => {
    await install('reshell-plugin-a');
    await addPluginReview('reshell-plugin-a', { json: true, cwd: ws, rating: '4', comment: 'solid', author: 'a@x.io' });
    const first = validated(pluginReviewAddResponseSchema);
    expect(first.data).toMatchObject({
      updated: false,
      file: '.re-shell/plugin-reviews.json',
      review: { plugin: 'reshell-plugin-a', rating: 4, comment: 'solid', author: 'a@x.io', version: '1.0.0' },
      aggregate: { count: 1, average: 4 },
    });

    stdout = '';
    await addPluginReview('reshell-plugin-a', { json: true, cwd: ws, rating: 5, comment: 'better now', author: 'a@x.io' });
    expect(envelope().data).toMatchObject({ updated: true, aggregate: { count: 1, average: 5 } });

    stdout = '';
    await addPluginReview('reshell-plugin-a', { json: true, cwd: ws, rating: 2, comment: 'slow', author: 'b@x.io' });
    stdout = '';
    await listPluginReviews('reshell-plugin-a', { json: true, cwd: ws });
    const list = validated(pluginReviewListResponseSchema);
    expect(list.data.aggregate).toMatchObject({ count: 2, average: 3.5 });
    expect(list.data.reviews).toHaveLength(2);
  });

  it('rejects an out-of-range or non-numeric rating with PLUGIN_REVIEW_ERROR and exit 1', async () => {
    for (const rating of ['0', '6', 'abc', '3.5']) {
      stdout = '';
      process.exitCode = undefined;
      await addPluginReview('reshell-plugin-a', { json: true, cwd: ws, rating, author: 'a@x.io' });
      expect(envelope(), rating).toMatchObject({ ok: false, error: { code: 'PLUGIN_REVIEW_ERROR' } });
      expect(process.exitCode).toBe(1);
    }
    expect(await fs.pathExists(path.join(ws, '.re-shell', 'plugin-reviews.json'))).toBe(false);
  });

  it('lists nothing for an unreviewed plugin; human mode renders stars and comments', async () => {
    await listPluginReviews('reshell-plugin-a', { json: true, cwd: ws });
    expect(envelope().data).toMatchObject({ reviews: [], aggregate: { count: 0, average: null } });

    consoleOut = [];
    await listPluginReviews('reshell-plugin-a', { cwd: ws });
    expect(human()).toContain('No team reviews for reshell-plugin-a.');

    await addPluginReview('reshell-plugin-a', { cwd: ws, rating: 4, comment: 'nice work', author: 'a@x.io' });
    expect(human()).toContain('Added review for reshell-plugin-a: 4/5 by a@x.io');
    consoleOut = [];
    await listPluginReviews('reshell-plugin-a', { cwd: ws });
    expect(human()).toContain('4/5 (1 review(s))');
    expect(human()).toContain('★★★★☆');
    expect(human()).toContain('nice work');
  });

  it('fails with PLUGIN_REVIEW_ERROR when the shared review file is corrupt', async () => {
    await fs.outputFile(path.join(ws, '.re-shell', 'plugin-reviews.json'), '{ broken');
    await listPluginReviews('reshell-plugin-a', { json: true, cwd: ws });
    expect(envelope()).toMatchObject({ ok: false, error: { code: 'PLUGIN_REVIEW_ERROR' } });
    expect(process.exitCode).toBe(1);
  });
});
