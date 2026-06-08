import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  installPluginFromIdentifier,
  validatePluginManifest,
  isRecognizedPlugin,
  classifySource,
  pluginDirName,
  readPluginRegistry,
  PluginInstallError,
} from '../../src/utils/plugin-installer';
import { installPlugin } from '../../src/commands/plugin';

// Absolute paths to the committed fixtures (no network involved anywhere).
const SAMPLE_FIXTURE = join(__dirname, '..', 'fixtures', 'sample-plugin');
const LEGACY_FIXTURE = join(__dirname, '..', 'fixtures', 'legacy-scope-plugin');

const tempDirs: string[] = [];

function createWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'reshell-plugin-ws-'));
  tempDirs.push(dir);
  return dir;
}

// Build an on-disk plugin dir with an arbitrary package.json (for invalid cases).
function makePluginDir(manifest: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'reshell-plugin-src-'));
  tempDirs.push(dir);
  writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(join(dir, 'index.js'), 'module.exports = {};\n');
  return dir;
}

// Capture stdout while running an action (for the --json command path).
async function captureStdout(run: () => Promise<void>): Promise<string> {
  const chunks: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Buffer) => {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return true;
  }) as typeof process.stdout.write;
  try {
    await run();
  } finally {
    process.stdout.write = original;
  }
  return chunks.join('');
}

function parseEnvelope(out: string): {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
} {
  const line = out.split('\n').find((l) => l.trim().startsWith('{'));
  if (!line) throw new Error(`No JSON envelope in output: ${out}`);
  return JSON.parse(line.trim());
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

describe('plugin-installer: manifest validation + scope detection', () => {
  it('accepts a manifest with the reshell-plugin key', () => {
    expect(
      validatePluginManifest({ name: 'foo', version: '1.0.0', 'reshell-plugin': {} })
    ).toEqual({ name: 'foo', version: '1.0.0' });
  });

  it('accepts the new @umutkorkmaz/ scope', () => {
    expect(isRecognizedPlugin({ name: '@umutkorkmaz/x', version: '1.0.0' })).toBe(true);
  });

  it('accepts the LEGACY @re-shell/ scope (legacy-compat path)', () => {
    expect(isRecognizedPlugin({ name: '@re-shell/x', version: '1.0.0' })).toBe(true);
  });

  it('accepts the reshell-cli manifest key', () => {
    expect(isRecognizedPlugin({ name: 'x', version: '1.0.0', 'reshell-cli': {} })).toBe(true);
  });

  it('rejects a plain package with no plugin signal', () => {
    expect(() => validatePluginManifest({ name: 'lodash', version: '4.0.0' })).toThrow(
      PluginInstallError
    );
  });

  it('rejects a manifest missing name or version', () => {
    expect(() => validatePluginManifest({ version: '1.0.0' })).toThrow(PluginInstallError);
    expect(() => validatePluginManifest({ name: 'x' })).toThrow(PluginInstallError);
  });

  it('strips the scope for the on-disk dir name', () => {
    expect(pluginDirName('@umutkorkmaz/sample-plugin')).toBe('sample-plugin');
    expect(pluginDirName('plain')).toBe('plain');
  });

  it('classifies an existing path as local', () => {
    expect(classifySource(SAMPLE_FIXTURE)).toBe('local');
  });

  it('classifies a .git URL as git and a bare name as npm', () => {
    expect(classifySource('https://github.com/acme/reshell-plugin-x.git')).toBe('git');
    expect(classifySource('some-nonexistent-npm-package-xyz')).toBe('npm');
  });
});

describe('plugin-installer: install from a local fixture into a tmp workspace', () => {
  it('installs, validates, and registers the plugin (listable)', async () => {
    const ws = createWorkspace();

    const result = await installPluginFromIdentifier(SAMPLE_FIXTURE, { workspaceRoot: ws });

    expect(result).toMatchObject({
      name: '@umutkorkmaz/sample-plugin',
      version: '1.0.0',
      source: 'local',
      dryRun: false,
    });

    // Installed into .re-shell/plugins/<name> (scope stripped).
    const installedDir = join(ws, '.re-shell', 'plugins', 'sample-plugin');
    expect(existsSync(installedDir)).toBe(true);
    expect(existsSync(join(installedDir, 'package.json'))).toBe(true);
    expect(existsSync(join(installedDir, 'index.js'))).toBe(true);

    // Registered in the registry and therefore listable.
    const registry = await readPluginRegistry(ws);
    expect(registry['@umutkorkmaz/sample-plugin']).toMatchObject({
      version: '1.0.0',
      source: 'local',
    });
  });

  it('--dry-run validates without writing to disk or registry', async () => {
    const ws = createWorkspace();

    const result = await installPluginFromIdentifier(SAMPLE_FIXTURE, {
      workspaceRoot: ws,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.name).toBe('@umutkorkmaz/sample-plugin');

    // Nothing written.
    expect(existsSync(join(ws, '.re-shell', 'plugins', 'sample-plugin'))).toBe(false);
    expect(await readPluginRegistry(ws)).toEqual({});
  });

  it('rejects an already-installed plugin without --force, accepts with --force', async () => {
    const ws = createWorkspace();
    await installPluginFromIdentifier(SAMPLE_FIXTURE, { workspaceRoot: ws });

    await expect(
      installPluginFromIdentifier(SAMPLE_FIXTURE, { workspaceRoot: ws })
    ).rejects.toBeInstanceOf(PluginInstallError);

    // --force overwrites cleanly.
    const forced = await installPluginFromIdentifier(SAMPLE_FIXTURE, {
      workspaceRoot: ws,
      force: true,
    });
    expect(forced.name).toBe('@umutkorkmaz/sample-plugin');
  });

  it('detects and installs a LEGACY @re-shell/ scoped plugin', async () => {
    const ws = createWorkspace();

    const result = await installPluginFromIdentifier(LEGACY_FIXTURE, { workspaceRoot: ws });

    expect(result.name).toBe('@re-shell/legacy-plugin');
    expect(existsSync(join(ws, '.re-shell', 'plugins', 'legacy-plugin'))).toBe(true);
    const registry = await readPluginRegistry(ws);
    expect(registry['@re-shell/legacy-plugin']).toBeDefined();
  });

  it('rejects an invalid manifest with PluginInstallError', async () => {
    const ws = createWorkspace();
    const badPlugin = makePluginDir({ name: 'not-a-plugin', version: '1.0.0' });

    await expect(
      installPluginFromIdentifier(badPlugin, { workspaceRoot: ws })
    ).rejects.toBeInstanceOf(PluginInstallError);

    // Nothing registered.
    expect(await readPluginRegistry(ws)).toEqual({});
  });
});

describe('plugin install command (--json envelope + exit code)', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  function chdirWorkspace(): string {
    const ws = createWorkspace();
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(ws);
    return ws;
  }

  beforeEach(() => {
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it('emits an ok envelope and really installs on success', async () => {
    const ws = chdirWorkspace();
    const out = await captureStdout(async () => {
      await installPlugin(SAMPLE_FIXTURE, { json: true });
    });
    const env = parseEnvelope(out);
    expect(env.ok).toBe(true);
    expect(env.data).toMatchObject({
      name: '@umutkorkmaz/sample-plugin',
      source: 'local',
      dryRun: false,
    });
    expect(existsSync(join(ws, '.re-shell', 'plugins', 'sample-plugin'))).toBe(true);
    cwdSpy.mockRestore();
  });

  it('emits PLUGIN_INSTALL_ERROR + exit 1 for an invalid manifest', async () => {
    chdirWorkspace();
    const badPlugin = makePluginDir({ name: 'still-not-a-plugin', version: '1.0.0' });

    const out = await captureStdout(async () => {
      await installPlugin(badPlugin, { json: true });
    });
    const env = parseEnvelope(out);
    expect(env.ok).toBe(false);
    expect(env.error?.code).toBe('PLUGIN_INSTALL_ERROR');
    expect(process.exitCode).toBe(1);
    cwdSpy.mockRestore();
  });

  it('--dry-run via the command does not write', async () => {
    const ws = chdirWorkspace();
    const out = await captureStdout(async () => {
      await installPlugin(SAMPLE_FIXTURE, { json: true, dryRun: true });
    });
    const env = parseEnvelope(out);
    expect(env.ok).toBe(true);
    expect(env.data?.dryRun).toBe(true);
    expect(existsSync(join(ws, '.re-shell', 'plugins', 'sample-plugin'))).toBe(false);
    cwdSpy.mockRestore();
  });
});
