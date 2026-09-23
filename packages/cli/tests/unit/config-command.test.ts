import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { manageConfig } from '../../src/commands/config';
import { ValidationError } from '../../src/utils/error-handler';

// UNIT coverage for src/commands/config.ts — the `config` command (NOT
// utils/config ConfigManager, covered by the open config.test.ts from PR #303).
// Named config-command.test.ts to avoid that collision. manageConfig dispatches
// (backup/restore/list/get/set/preset save-load-delete/interactive/default-show)
// and delegates to configManager + prompts; we mock both and spy console.log.

const mocks = vi.hoisted(() => ({
  backupConfig: vi.fn(),
  restoreConfig: vi.fn(),
  getMergedConfig: vi.fn(),
  loadGlobalConfig: vi.fn(),
  saveGlobalConfig: vi.fn(),
  loadProjectConfig: vi.fn(),
  saveProjectConfig: vi.fn(),
  savePreset: vi.fn(),
  loadPreset: vi.fn(),
  deletePreset: vi.fn(),
  updateGlobalConfig: vi.fn(),
  listPresets: vi.fn(),
  prompts: vi.fn(),
}));

vi.mock('../../src/utils/config', () => ({
  configManager: {
    backupConfig: mocks.backupConfig,
    restoreConfig: mocks.restoreConfig,
    getMergedConfig: mocks.getMergedConfig,
    loadGlobalConfig: mocks.loadGlobalConfig,
    saveGlobalConfig: mocks.saveGlobalConfig,
    loadProjectConfig: mocks.loadProjectConfig,
    saveProjectConfig: mocks.saveProjectConfig,
    savePreset: mocks.savePreset,
    loadPreset: mocks.loadPreset,
    deletePreset: mocks.deletePreset,
    updateGlobalConfig: mocks.updateGlobalConfig,
    listPresets: mocks.listPresets,
  },
  // Re-export the type-only symbol the command imports alongside configManager.
  GlobalConfig: class {},
}));
vi.mock('prompts', () => ({ default: mocks.prompts }));

function spinner() {
  return { setText: vi.fn(), stop: vi.fn(), succeed: vi.fn(), fail: vi.fn() } as any;
}

const GLOBAL = {
  version: '2.0.0',
  packageManager: 'pnpm',
  defaultFramework: 'react-ts',
  cli: { autoUpdate: true, telemetry: false, theme: 'dark' },
};
const PROJECT = { name: 'demo', packageManager: 'pnpm' };
const MERGED = { ...GLOBAL, ...PROJECT };

const PRESET = {
  name: 'starter',
  description: 'A starter preset',
  config: { name: 'demo' },
  tags: ['base', 'web'],
  createdAt: '2024-01-01',
  updatedAt: '2024-02-01',
};

let logSpy: ReturnType<typeof vi.spyOn>;
function logged(): string {
  return logSpy.mock.calls.map(a => a.join(' ')).join('\n');
}
function loggedJson(find: (s: string) => boolean): any {
  return JSON.parse(logSpy.mock.calls.map(a => a.join('')).find(find)!);
}

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset());
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

describe('config — backup / restore', () => {
  it('backs up and reports the returned path', async () => {
    mocks.backupConfig.mockResolvedValue('/tmp/backup.zip');
    const s = spinner();
    await manageConfig({ backup: true, spinner: s });
    expect(mocks.backupConfig).toHaveBeenCalled();
    expect(s.succeed).toHaveBeenCalled();
    expect(logged()).toContain('/tmp/backup.zip');
  });

  it('restores from the given backup path', async () => {
    mocks.restoreConfig.mockResolvedValue(undefined);
    const s = spinner();
    await manageConfig({ restore: '/tmp/backup.zip', spinner: s });
    expect(mocks.restoreConfig).toHaveBeenCalledWith('/tmp/backup.zip');
    expect(logged()).toContain('restored from backup');
  });
});

describe('config — list', () => {
  beforeEach(() => {
    mocks.getMergedConfig.mockResolvedValue({ global: GLOBAL, project: PROJECT, merged: MERGED });
  });

  it('renders global, project and merged sections by default (human)', async () => {
    await manageConfig({ list: true });
    const out = logged();
    expect(out).toContain('Global Configuration');
    expect(out).toContain('Project Configuration');
    expect(out).toContain('Merged Configuration');
  });

  it('renders only the global section when --global is set', async () => {
    await manageConfig({ list: true, global: true });
    const out = logged();
    expect(out).toContain('Global Configuration');
    expect(out).not.toContain('Merged Configuration');
  });

  it('warns when no project config exists in the project listing', async () => {
    mocks.getMergedConfig.mockResolvedValue({ global: GLOBAL, project: null, merged: GLOBAL });
    await manageConfig({ list: true, project: true });
    expect(logged()).toContain('No project configuration found');
  });

  it('emits the selected sections as JSON in json mode', async () => {
    await manageConfig({ list: true, global: true, json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.global.packageManager).toBe('pnpm');
    expect(json.project).toBeUndefined();
  });
});

describe('config — get', () => {
  beforeEach(() => {
    mocks.getMergedConfig.mockResolvedValue({ global: GLOBAL, project: PROJECT, merged: MERGED });
  });

  it('prints a found merged value in human mode', async () => {
    await manageConfig({ get: 'packageManager' });
    expect(logged()).toContain('packageManager:');
    expect(logged()).toContain('pnpm');
  });

  it('falls back to the global config when the key is absent from merged', async () => {
    await manageConfig({ get: 'defaultFramework' });
    expect(logged()).toContain('react-ts');
  });

  it('warns when the key is not found anywhere', async () => {
    await manageConfig({ get: 'nope' });
    expect(logged()).toContain("not found");
  });

  it('emits the value as JSON in json mode', async () => {
    await manageConfig({ get: 'packageManager', json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.packageManager).toBe('pnpm');
  });
});

describe('config — set', () => {
  it('throws a ValidationError when setting in a project without project config', async () => {
    mocks.loadProjectConfig.mockResolvedValue(null);
    await expect(
      manageConfig({ set: 'name', value: 'x' })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('writes a JSON-parsed value into the project config (dotted path)', async () => {
    const project: Record<string, unknown> = { name: 'demo' };
    mocks.loadProjectConfig.mockResolvedValue(project);
    await manageConfig({ set: 'build.mode', value: '"production"' });
    expect((project as any).build.mode).toBe('production');
    expect(mocks.saveProjectConfig).toHaveBeenCalledWith(project);
  });

  it('falls back to a plain string when the value is not valid JSON', async () => {
    const project: Record<string, unknown> = {};
    mocks.loadProjectConfig.mockResolvedValue(project);
    await manageConfig({ set: 'name', value: 'not json' });
    expect(project.name).toBe('not json');
  });

  it('writes into the global config when --global is set', async () => {
    const global: Record<string, unknown> = { version: '2.0.0' };
    mocks.loadGlobalConfig.mockResolvedValue(global);
    await manageConfig({ set: 'version', value: '42', global: true });
    expect(global.version).toBe(42); // JSON.parse('42') -> number
    expect(mocks.saveGlobalConfig).toHaveBeenCalledWith(global);
  });
});

describe('config — presets', () => {
  it('save throws a ValidationError when there is no project config', async () => {
    mocks.loadProjectConfig.mockResolvedValue(null);
    await expect(manageConfig({ save: 'p' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('save persists the project config as a preset', async () => {
    mocks.loadProjectConfig.mockResolvedValue(PROJECT);
    const s = spinner();
    await manageConfig({ save: 'starter', spinner: s });
    expect(mocks.savePreset).toHaveBeenCalledWith('starter', PROJECT);
    expect(s.succeed).toHaveBeenCalled();
  });

  it('load throws a ValidationError when the preset is missing', async () => {
    mocks.loadPreset.mockResolvedValue(null);
    await expect(manageConfig({ load: 'ghost' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('load renders the preset metadata + config (human)', async () => {
    mocks.loadPreset.mockResolvedValue(PRESET);
    await manageConfig({ load: 'starter' });
    const out = logged();
    expect(out).toContain('Preset: starter');
    expect(out).toContain('Tags: base, web');
    expect(out).toContain('Configuration:');
  });

  it('load emits the preset as JSON in json mode', async () => {
    mocks.loadPreset.mockResolvedValue(PRESET);
    await manageConfig({ load: 'starter', json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.name).toBe('starter');
  });

  it('delete throws a ValidationError when the preset is missing', async () => {
    mocks.loadPreset.mockResolvedValue(null);
    await expect(manageConfig({ delete: 'ghost' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('delete removes an existing preset', async () => {
    mocks.loadPreset.mockResolvedValue(PRESET);
    const s = spinner();
    await manageConfig({ delete: 'starter', spinner: s });
    expect(mocks.deletePreset).toHaveBeenCalledWith('starter');
    expect(s.succeed).toHaveBeenCalled();
  });
});

describe('config — default show', () => {
  it('renders the current configuration (human, with project)', async () => {
    mocks.getMergedConfig.mockResolvedValue({ global: GLOBAL, project: PROJECT, merged: MERGED });
    await manageConfig({});
    const out = logged();
    expect(out).toContain('Current Configuration');
    expect(out).toContain('Global Settings');
    expect(out).toContain('Project Settings');
  });

  it('warns when there is no project config (human)', async () => {
    mocks.getMergedConfig.mockResolvedValue({ global: GLOBAL, project: null, merged: GLOBAL });
    await manageConfig({});
    expect(logged()).toContain('No project configuration found');
  });

  it('emits global/project/merged as JSON in json mode', async () => {
    mocks.getMergedConfig.mockResolvedValue({ global: GLOBAL, project: PROJECT, merged: MERGED });
    await manageConfig({ json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.global.packageManager).toBe('pnpm');
    expect(json.project.name).toBe('demo');
  });
});

describe('config — interactive', () => {
  it('dispatches to showConfiguration when the user picks "view"', async () => {
    mocks.prompts.mockResolvedValue({ action: 'view' });
    mocks.getMergedConfig.mockResolvedValue({ global: GLOBAL, project: PROJECT, merged: MERGED });
    await manageConfig({ interactive: true });
    expect(logged()).toContain('Current Configuration');
  });

  it('warns when editing project config but none exists', async () => {
    mocks.prompts.mockResolvedValue({ action: 'editProject' });
    mocks.loadProjectConfig.mockResolvedValue(null);
    await manageConfig({ interactive: true });
    expect(logged()).toContain('No project configuration found');
  });

  it('lists presets (empty) when the user manages presets', async () => {
    // First prompts call = main menu ("presets"), second = preset action ("list").
    mocks.prompts
      .mockResolvedValueOnce({ action: 'presets' })
      .mockResolvedValueOnce({ action: 'list' });
    mocks.listPresets.mockResolvedValue([]);
    await manageConfig({ interactive: true });
    expect(logged()).toContain('No presets found');
  });

  it('returns early when the interactive prompt is cancelled', async () => {
    mocks.prompts.mockResolvedValue({ action: undefined });
    await manageConfig({ interactive: true });
    expect(mocks.getMergedConfig).not.toHaveBeenCalled();
  });
});

describe('config — error handling', () => {
  it('fails the spinner and rethrows when an operation rejects', async () => {
    mocks.backupConfig.mockRejectedValue(new Error('disk full'));
    const s = spinner();
    await expect(manageConfig({ backup: true, spinner: s })).rejects.toThrow('disk full');
    expect(s.fail).toHaveBeenCalled();
  });
});
