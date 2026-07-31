import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Module from 'module';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import {
  ConfigManager,
  configManager,
  DEFAULT_GLOBAL_CONFIG,
  DEFAULT_PROJECT_CONFIG,
  CONFIG_PATHS,
  getGlobalConfig,
  getProjectConfig,
  getMergedConfig,
  initializeGlobalConfig,
} from '../../src/utils/config';

// Redirect os.homedir to a unique temp dir so tests never touch the real
// ~/.re-shell. CONFIG_PATHS is computed at module-load time from os.homedir(),
// so the mock must be active before config.ts is first imported — vi.mock is
// hoisted above the imports, which satisfies that ordering.
const home = vi.hoisted(() => ({ dir: '' }));
vi.mock('os', async (importOriginal) => {
  const realOs = await importOriginal<typeof import('os')>();
  const nodeFs = require('fs');
  const nodePath = require('path');
  home.dir = nodeFs.mkdtempSync(nodePath.join(realOs.tmpdir(), 're-shell-cfg-'));
  return { ...realOs, homedir: () => home.dir };
});

// Decouple from the validation module (it has its own dedicated test suite) and
// make the verdicts controllable so we can drive the ValidationError paths.
const valMocks = vi.hoisted(() => ({
  global: { valid: true, errors: [] as any[] },
  project: { valid: true, errors: [] as any[] },
}));

// config.ts calls `require('./validation')` at runtime inside its validate
// methods. vitest does not route that CJS require through vi.mock, and Node
// cannot resolve a bare './validation' to the .ts source. Redirect those
// requires to a sentinel module backed by controllable stubs.
const VALIDATION_SENTINEL = path.resolve('__re_shell_validation_mock__');
const realResolveFilename = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, parent: any, ...rest: any[]) {
  if (
    request === './validation' &&
    parent &&
    typeof parent.filename === 'string' &&
    parent.filename.replace(/\\/g, '/').includes('src/utils/config.ts')
  ) {
    return VALIDATION_SENTINEL;
  }
  return realResolveFilename.call(this, request, parent, ...rest);
};
(Module as any)._cache[VALIDATION_SENTINEL] = {
  id: VALIDATION_SENTINEL,
  filename: VALIDATION_SENTINEL,
  loaded: true,
  exports: {
    validateGlobalConfig: () => valMocks.global,
    validateProjectConfig: () => valMocks.project,
  },
};

function fresh() {
  return new ConfigManager();
}

async function writeGlobalFile(raw: string) {
  await fs.ensureDir(CONFIG_PATHS.GLOBAL_DIR);
  await fs.writeFile(CONFIG_PATHS.GLOBAL_CONFIG, raw, 'utf8');
}

beforeEach(() => {
  // Isolation: wipe the global config area and reset the shared singleton's
  // cache so convenience helpers reload from a clean filesystem state.
  fs.removeSync(path.join(home.dir, '.re-shell'));
  (configManager as any).globalConfig = null;
  (configManager as any).projectConfig = null;
  // The no-file path caches the module-level DEFAULT_GLOBAL_CONFIG by reference,
  // so savePreset/deletePreset mutate the shared object. Reset presets between
  // tests to keep them isolated.
  DEFAULT_GLOBAL_CONFIG.presets = {};
  valMocks.global = { valid: true, errors: [] };
  valMocks.project = { valid: true, errors: [] };
});

afterAll(() => {
  fs.removeSync(home.dir);
});

describe('config — exported constants', () => {
  it('DEFAULT_GLOBAL_CONFIG has the documented defaults', () => {
    expect(DEFAULT_GLOBAL_CONFIG.version).toBe('1.0.0');
    expect(DEFAULT_GLOBAL_CONFIG.packageManager).toBe('pnpm');
    expect(DEFAULT_GLOBAL_CONFIG.defaultFramework).toBe('react-ts');
    expect(DEFAULT_GLOBAL_CONFIG.defaultTemplate).toBe('blank');
    expect(DEFAULT_GLOBAL_CONFIG.presets).toEqual({});
    expect(DEFAULT_GLOBAL_CONFIG.cli.theme).toBe('auto');
    expect(DEFAULT_GLOBAL_CONFIG.cli.autoUpdate).toBe(true);
    expect(DEFAULT_GLOBAL_CONFIG.plugins.marketplace.registry).toBe(
      'https://registry.npmjs.org',
    );
    // paths are anchored to the (mocked) home directory.
    expect(DEFAULT_GLOBAL_CONFIG.paths.templates).toContain('.re-shell');
  });

  it('DEFAULT_PROJECT_CONFIG has the documented project defaults', () => {
    expect(DEFAULT_PROJECT_CONFIG.type).toBe('monorepo');
    expect(DEFAULT_PROJECT_CONFIG.framework).toBe('react-ts');
    expect(Object.keys(DEFAULT_PROJECT_CONFIG.environments || {})).toEqual([
      'development',
      'staging',
      'production',
    ]);
    expect(DEFAULT_PROJECT_CONFIG.workspaces?.patterns).toEqual([
      'apps/*',
      'packages/*',
      'libs/*',
      'tools/*',
    ]);
    expect(DEFAULT_PROJECT_CONFIG.build?.target).toBe('es2020');
    expect(DEFAULT_PROJECT_CONFIG.dev?.port).toBe(3000);
    expect(DEFAULT_PROJECT_CONFIG.quality?.coverage?.threshold).toBe(80);
  });

  it('CONFIG_PATHS points at the global .re-shell layout and relative project files', () => {
    expect(CONFIG_PATHS.GLOBAL_DIR).toBe(path.join(home.dir, '.re-shell'));
    expect(CONFIG_PATHS.GLOBAL_CONFIG).toBe(
      path.join(home.dir, '.re-shell', 'config.yaml'),
    );
    expect(CONFIG_PATHS.PROJECT_CONFIG).toBe('.re-shell/config.yaml');
    expect(CONFIG_PATHS.WORKSPACE_CONFIG).toBe('re-shell.workspaces.yaml');
    expect(CONFIG_PATHS.WORKSPACE_DIR_CONFIG).toBe('.re-shell/workspace.yaml');
  });
});

describe('ConfigManager — global config load/save', () => {
  it('creates and persists the default global config when none exists', async () => {
    expect(fs.pathExistsSync(CONFIG_PATHS.GLOBAL_CONFIG)).toBe(false);
    const config = await fresh().loadGlobalConfig();
    expect(config.version).toBe('1.0.0');
    expect(config.packageManager).toBe('pnpm');
    // The default was saved to disk.
    expect(fs.pathExistsSync(CONFIG_PATHS.GLOBAL_CONFIG)).toBe(true);
  });

  it('loads an existing global config from disk', async () => {
    const stored = { ...DEFAULT_GLOBAL_CONFIG, packageManager: 'yarn' as const };
    await writeGlobalFile(yaml.stringify(stored));
    const config = await fresh().loadGlobalConfig();
    expect(config.packageManager).toBe('yarn');
  });

  it('caches the loaded global config (subsequent calls return the same ref)', async () => {
    const m = fresh();
    const first = await m.loadGlobalConfig();
    const second = await m.loadGlobalConfig();
    expect(second).toBe(first);
  });

  it('throws ValidationError when global config validation fails', async () => {
    await writeGlobalFile(yaml.stringify(DEFAULT_GLOBAL_CONFIG));
    valMocks.global = { valid: false, errors: [{ severity: 'error', field: 'version', message: 'bad' }] };
    await expect(fresh().loadGlobalConfig()).rejects.toThrow(
      /Global configuration validation failed/,
    );
  });

  it('throws ValidationError when the global config file cannot be read', async () => {
    // Make the config path a directory so readFile fails (EISDIR), exercising
    // the outer catch in loadGlobalConfig.
    await fs.ensureDir(CONFIG_PATHS.GLOBAL_CONFIG);
    await expect(fresh().loadGlobalConfig()).rejects.toThrow(/Failed to load global config/);
  });

  it('saveGlobalConfig writes a readable, validated config to disk', async () => {
    await fresh().saveGlobalConfig(DEFAULT_GLOBAL_CONFIG);
    const raw = await fs.readFile(CONFIG_PATHS.GLOBAL_CONFIG, 'utf8');
    const parsed = yaml.parse(raw);
    expect(parsed.version).toBe(DEFAULT_GLOBAL_CONFIG.version);
  });

  it('saveGlobalConfig throws ValidationError when validation fails', async () => {
    valMocks.global = { valid: false, errors: [{ severity: 'error', field: 'x', message: 'bad' }] };
    await expect(fresh().saveGlobalConfig(DEFAULT_GLOBAL_CONFIG)).rejects.toThrow(
      /Global configuration validation failed/,
    );
  });
});

describe('ConfigManager — updateGlobalConfig (deep merge)', () => {
  it('deep-merges nested objects, preserving sibling keys', async () => {
    const m = fresh();
    await m.loadGlobalConfig();
    const updated = await m.updateGlobalConfig({ cli: { verbose: true } });
    expect(updated.cli.verbose).toBe(true);
    expect(updated.cli.theme).toBe('auto'); // preserved
    expect(updated.cli.telemetry).toBe(true); // preserved
  });

  it('replaces arrays wholesale while preserving sibling nested objects', async () => {
    const m = fresh();
    await m.loadGlobalConfig();
    const updated = await m.updateGlobalConfig({ plugins: { enabled: ['a', 'b'] } });
    expect(updated.plugins.enabled).toEqual(['a', 'b']);
    expect(updated.plugins.marketplace.registry).toBe('https://registry.npmjs.org'); // preserved
  });
});

describe('ConfigManager — project config load/save', () => {
  it('returns null when no project config exists', async () => {
    const dir = fs.mkdtempSync(path.join(home.dir, 'proj-'));
    expect(await fresh().loadProjectConfig(dir)).toBeNull();
  });

  it('loads an existing project config', async () => {
    const dir = fs.mkdtempSync(path.join(home.dir, 'proj-'));
    const cfg = { name: 'demo', version: '1.0.0', type: 'monorepo', packageManager: 'npm' };
    await fs.ensureDir(path.join(dir, '.re-shell'));
    await fs.writeFile(path.join(dir, CONFIG_PATHS.PROJECT_CONFIG), yaml.stringify(cfg));
    const loaded = await fresh().loadProjectConfig(dir);
    expect(loaded?.name).toBe('demo');
    expect(loaded?.packageManager).toBe('npm');
  });

  it('throws ValidationError when the project config cannot be read', async () => {
    const dir = fs.mkdtempSync(path.join(home.dir, 'proj-'));
    await fs.ensureDir(path.join(dir, CONFIG_PATHS.PROJECT_CONFIG)); // path is a dir
    await expect(fresh().loadProjectConfig(dir)).rejects.toThrow(/Failed to load project config/);
  });

  it('saveProjectConfig writes to <project>/.re-shell/config.yaml', async () => {
    const dir = fs.mkdtempSync(path.join(home.dir, 'proj-'));
    const cfg = { name: 'demo', version: '1.0.0', type: 'standalone', packageManager: 'pnpm' } as any;
    await fresh().saveProjectConfig(cfg, dir);
    const parsed = yaml.parse(await fs.readFile(path.join(dir, CONFIG_PATHS.PROJECT_CONFIG), 'utf8'));
    expect(parsed.name).toBe('demo');
  });

  it('saveProjectConfig throws ValidationError when project validation fails', async () => {
    valMocks.project = { valid: false, errors: [{ severity: 'error', field: 'name', message: 'bad' }] };
    await expect(
      fresh().saveProjectConfig({ name: 'x' } as any, home.dir),
    ).rejects.toThrow(/Project configuration validation failed/);
  });
});

describe('ConfigManager — createProjectConfig (inheritance)', () => {
  it('inherits package manager / framework / template from global config', async () => {
    const m = fresh();
    await m.loadGlobalConfig();
    await m.updateGlobalConfig({ defaultFramework: 'vue-ts' });
    const dir = fs.mkdtempSync(path.join(home.dir, 'proj-'));
    const cfg = await m.createProjectConfig('myapp', {}, dir);
    expect(cfg.name).toBe('myapp');
    expect(cfg.version).toBe('1.0.0');
    expect(cfg.type).toBe('monorepo'); // from DEFAULT_PROJECT_CONFIG
    expect(cfg.framework).toBe('vue-ts'); // inherited from global
    expect(cfg.packageManager).toBe('pnpm');
    expect(cfg.template).toBe('blank');
  });

  it('lets explicit options override global inheritance', async () => {
    const m = fresh();
    await m.loadGlobalConfig();
    const dir = fs.mkdtempSync(path.join(home.dir, 'proj-'));
    const cfg = await m.createProjectConfig('myapp', { framework: 'svelte', packageManager: 'npm' }, dir);
    expect(cfg.framework).toBe('svelte');
    expect(cfg.packageManager).toBe('npm');
  });
});

describe('ConfigManager — workspace config', () => {
  it('returns null when no workspace config exists', async () => {
    const dir = fs.mkdtempSync(path.join(home.dir, 'ws-'));
    expect(await fresh().loadWorkspaceConfig(dir)).toBeNull();
  });

  it('saves and loads a workspace config round-trip', async () => {
    const dir = fs.mkdtempSync(path.join(home.dir, 'ws-'));
    const m = fresh();
    await m.saveWorkspaceConfig({ name: 'web', type: 'app', framework: 'react-ts' }, dir);
    const loaded = await m.loadWorkspaceConfig(dir);
    expect(loaded?.name).toBe('web');
    expect(loaded?.type).toBe('app');
    expect(loaded?.framework).toBe('react-ts');
  });

  it('createWorkspaceConfig builds and persists a minimal workspace config', async () => {
    const dir = fs.mkdtempSync(path.join(home.dir, 'ws-'));
    const cfg = await fresh().createWorkspaceConfig('api', 'package', {}, dir);
    expect(cfg.name).toBe('api');
    expect(cfg.type).toBe('package');
    expect(await fs.pathExists(path.join(dir, CONFIG_PATHS.WORKSPACE_DIR_CONFIG))).toBe(true);
  });

  it('saveWorkspaceConfig rejects a config missing a valid name', async () => {
    const dir = fs.mkdtempSync(path.join(home.dir, 'ws-'));
    await expect(fresh().saveWorkspaceConfig({ name: '', type: 'app' }, dir)).rejects.toThrow(
      /Failed to save workspace config/,
    );
  });

  it('saveWorkspaceConfig rejects an invalid workspace type', async () => {
    const dir = fs.mkdtempSync(path.join(home.dir, 'ws-'));
    await expect(
      fresh().saveWorkspaceConfig({ name: 'x', type: 'service' as any }, dir),
    ).rejects.toThrow(/Failed to save workspace config/);
  });

  it('saveWorkspaceConfig rejects an invalid package manager', async () => {
    const dir = fs.mkdtempSync(path.join(home.dir, 'ws-'));
    await expect(
      fresh().saveWorkspaceConfig({ name: 'x', type: 'app', packageManager: 'choco' as any }, dir),
    ).rejects.toThrow(/Failed to save workspace config/);
  });
});

describe('ConfigManager — merged config (inheritance)', () => {
  it('getMergedConfig applies global inheritance over defaults when no project config exists', async () => {
    const m = fresh();
    await m.updateGlobalConfig({ defaultFramework: 'vue-ts', packageManager: 'yarn' });
    const dir = fs.mkdtempSync(path.join(home.dir, 'proj-'));
    const { merged, project } = await m.getMergedConfig(dir);
    expect(project).toBeNull();
    expect(merged.packageManager).toBe('yarn'); // from global
    expect(merged.framework).toBe('vue-ts'); // from global
    expect(merged.type).toBe('monorepo'); // from defaults
  });

  it('getMergedConfig lets a project config override global + defaults', async () => {
    const m = fresh();
    const dir = fs.mkdtempSync(path.join(home.dir, 'proj-'));
    await fs.ensureDir(path.join(dir, '.re-shell'));
    await fs.writeFile(
      path.join(dir, CONFIG_PATHS.PROJECT_CONFIG),
      yaml.stringify({
        name: 'demo',
        framework: 'angular',
        dev: { port: 4000 },
      }),
    );
    const { merged, project } = await m.getMergedConfig(dir);
    expect(project?.name).toBe('demo');
    expect(merged.framework).toBe('angular'); // project override
    expect((merged.dev as any).port).toBe(4000); // project override
  });

  it('getMergedWorkspaceConfig layers workspace settings on top of project + global', async () => {
    const m = fresh();
    const projectDir = fs.mkdtempSync(path.join(home.dir, 'proj-'));
    const wsDir = fs.mkdtempSync(path.join(home.dir, 'ws-'));
    await m.saveWorkspaceConfig(
      { name: 'web', type: 'app', framework: 'svelte', dev: { port: 8080 } },
      wsDir,
    );
    const { workspace, merged } = await m.getMergedWorkspaceConfig(wsDir, projectDir);
    expect(workspace?.name).toBe('web');
    expect(merged.framework).toBe('svelte'); // workspace override
    expect(merged.dev.port).toBe(8080); // workspace override
  });
});

describe('ConfigManager — presets', () => {
  it('saves and loads a named preset', async () => {
    const m = fresh();
    await m.savePreset('foo', { framework: 'vue-ts' });
    const preset = await m.loadPreset('foo');
    expect(preset).not.toBeNull();
    expect(preset?.name).toBe('foo');
    expect(preset?.description).toBe('Preset for foo');
    expect(preset?.config).toEqual({ framework: 'vue-ts' });
    expect(preset?.tags).toEqual([]);
    expect(typeof preset?.createdAt).toBe('string');
    expect(typeof preset?.updatedAt).toBe('string');
  });

  it('lists saved presets', async () => {
    const m = fresh();
    await m.savePreset('a', { type: 'monorepo' });
    await m.savePreset('b', { type: 'standalone' });
    const list = await m.listPresets();
    expect(list.map((p) => p.name).sort()).toEqual(['a', 'b']);
  });

  it('deletes a preset', async () => {
    const m = fresh();
    await m.savePreset('foo', { framework: 'vue-ts' });
    await m.deletePreset('foo');
    expect(await m.loadPreset('foo')).toBeNull();
  });
});

describe('ConfigManager — migration & backup/restore', () => {
  it('migrateConfig resolves without throwing', async () => {
    await expect(fresh().migrateConfig('1.0.0', '2.0.0')).resolves.toBeUndefined();
  });

  it('backupConfig writes a timestamped YAML backup and returns its path', async () => {
    const m = fresh();
    await m.loadGlobalConfig();
    const backupPath = await m.backupConfig();
    expect(backupPath).toContain('backups');
    expect(backupPath).toMatch(/config-backup-.*\.yaml$/);
    expect(await fs.pathExists(backupPath)).toBe(true);
    const parsed = yaml.parse(await fs.readFile(backupPath, 'utf8'));
    expect(parsed.version).toBe('1.0.0');
  });

  it('restoreConfig throws ValidationError when the backup file is missing', async () => {
    await expect(fresh().restoreConfig(path.join(home.dir, 'nope.yaml'))).rejects.toThrow(
      /Backup file not found/,
    );
  });

  it('restoreConfig restores and persists a backup', async () => {
    const m = fresh();
    await m.loadGlobalConfig();
    const backupPath = await m.backupConfig();
    // Change the live config, then restore from backup.
    await m.updateGlobalConfig({ packageManager: 'yarn' });
    await m.restoreConfig(backupPath);
    const restored = await fresh().loadGlobalConfig();
    expect(restored.packageManager).toBe('pnpm'); // back to the backed-up default
  });
});

describe('config — convenience helpers', () => {
  it('getGlobalConfig loads via the shared singleton', async () => {
    await writeGlobalFile(yaml.stringify({ ...DEFAULT_GLOBAL_CONFIG, packageManager: 'bun' }));
    const cfg = await getGlobalConfig();
    expect(cfg.packageManager).toBe('bun');
  });

  it('getProjectConfig loads a project config via the shared singleton', async () => {
    const dir = fs.mkdtempSync(path.join(home.dir, 'proj-'));
    await fs.ensureDir(path.join(dir, '.re-shell'));
    await fs.writeFile(
      path.join(dir, CONFIG_PATHS.PROJECT_CONFIG),
      yaml.stringify({ name: 'singleton-demo', version: '1.0.0' }),
    );
    const cfg = await getProjectConfig(dir);
    expect(cfg?.name).toBe('singleton-demo');
  });

  it('getMergedConfig returns the merged shape via the shared singleton', async () => {
    const dir = fs.mkdtempSync(path.join(home.dir, 'proj-'));
    const result = await getMergedConfig(dir);
    expect(result.global.version).toBe('1.0.0');
    expect(result.project).toBeNull();
    expect(result.merged.packageManager).toBe('pnpm');
  });

  it('initializeGlobalConfig ensures all global subdirectories exist', async () => {
    await initializeGlobalConfig();
    for (const sub of ['templates', 'cache', 'plugins', 'backups']) {
      expect(fs.pathExistsSync(path.join(CONFIG_PATHS.GLOBAL_DIR, sub))).toBe(true);
    }
  });
});
