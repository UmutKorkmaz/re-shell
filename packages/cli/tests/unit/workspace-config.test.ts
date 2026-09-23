import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { manageWorkspaceConfig } from '../../src/commands/workspace-config';
import { ValidationError } from '../../src/utils/error-handler';

// Covers src/commands/workspace-config.ts — the `workspace-config` command. It
// dispatches on options (init/get/set/interactive/show) and delegates to
// configManager (utils/config) + prompts. We mock configManager + prompts and
// spy console.log so every branch — including the 7 interactive actions and
// the inheritance-aware get — is exercised deterministically without disk/tty.

const mocks = vi.hoisted(() => ({
  loadWorkspaceConfig: vi.fn(),
  createWorkspaceConfig: vi.fn(),
  saveWorkspaceConfig: vi.fn(),
  getMergedConfig: vi.fn(),
  getMergedWorkspaceConfig: vi.fn(),
  prompts: vi.fn(),
}));

vi.mock('../../src/utils/config', () => ({
  configManager: {
    loadWorkspaceConfig: mocks.loadWorkspaceConfig,
    createWorkspaceConfig: mocks.createWorkspaceConfig,
    saveWorkspaceConfig: mocks.saveWorkspaceConfig,
    getMergedConfig: mocks.getMergedConfig,
    getMergedWorkspaceConfig: mocks.getMergedWorkspaceConfig,
  },
}));
vi.mock('prompts', () => ({ default: mocks.prompts }));

const WS = '/mock-ws/my-app'; // options.workspace → path.basename = 'my-app'

const GLOBAL = { packageManager: 'pnpm', defaultFramework: 'react', defaultTemplate: 'react-ts' };
const PROJECT = { packageManager: 'pnpm', framework: 'react', template: 'react-ts' };
const WORKSPACE = {
  name: 'my-app',
  type: 'app',
  packageManager: 'pnpm',
  framework: 'react',
  build: { target: 'es2020', optimize: true, analyze: false },
  dev: { port: 3000, host: 'localhost', open: false, hmr: true },
  quality: { linting: true, testing: true, coverage: { enabled: true, threshold: 80 } },
};
const MERGED = { ...PROJECT, name: 'my-app', type: 'app' };

function mergedWorkspace(overrides: Record<string, unknown> = {}) {
  return {
    workspace: WORKSPACE,
    merged: MERGED,
    global: GLOBAL,
    project: PROJECT,
    ...overrides,
  };
}

function spinner() {
  return {
    setText: vi.fn(),
    stop: vi.fn(),
    start: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
    warn: vi.fn(),
  } as any;
}

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
  mocks.getMergedConfig.mockResolvedValue({ merged: { framework: 'react', packageManager: 'pnpm' } });
  mocks.getMergedWorkspaceConfig.mockResolvedValue(mergedWorkspace());
  mocks.createWorkspaceConfig.mockResolvedValue(WORKSPACE);
});

afterEach(() => {
  logSpy.mockRestore();
});

describe('workspace-config — default show', () => {
  it('warns when no workspace configuration is found', async () => {
    mocks.getMergedWorkspaceConfig.mockResolvedValue(mergedWorkspace({ workspace: null }));
    await manageWorkspaceConfig({ workspace: WS });
    expect(logged()).toContain('No workspace configuration found');
    expect(logged()).toContain('workspace-config init');
  });

  it('renders the human report with workspace/project/global inheritance', async () => {
    await manageWorkspaceConfig({ workspace: WS });
    const out = logged();
    expect(out).toContain('Workspace Configuration: my-app');
    expect(out).toContain('Inherited from Project');
    expect(out).toContain('Inherited from Global');
    expect(out).toContain('Default Framework: react');
  });

  it('notes when no project configuration is present', async () => {
    mocks.getMergedWorkspaceConfig.mockResolvedValue(mergedWorkspace({ project: null }));
    await manageWorkspaceConfig({ workspace: WS });
    expect(logged()).toContain('No project configuration found');
  });

  it('renders the verbose merged section when --verbose', async () => {
    await manageWorkspaceConfig({ workspace: WS, verbose: true });
    expect(logged()).toContain('Final Merged Configuration');
  });

  it('emits the inheritance envelope as JSON in json mode', async () => {
    await manageWorkspaceConfig({ workspace: WS, json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.workspace.name).toBe('my-app');
    expect(json.inheritedFrom.global.framework).toBe('react'); // maps from global.defaultFramework
    expect(json.inheritedFrom.project.framework).toBe('react');
  });

  it('emits a null project in the json envelope when absent', async () => {
    mocks.getMergedWorkspaceConfig.mockResolvedValue(mergedWorkspace({ project: null }));
    await manageWorkspaceConfig({ workspace: WS, json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.inheritedFrom.project).toBeNull();
  });
});

describe('workspace-config — init', () => {
  it('warns and returns when a workspace config already exists (non-interactive)', async () => {
    mocks.loadWorkspaceConfig.mockResolvedValue(WORKSPACE);
    const s = spinner();
    await manageWorkspaceConfig({ workspace: WS, init: true, spinner: s });
    expect(mocks.createWorkspaceConfig).not.toHaveBeenCalled();
    expect(s.stop).toHaveBeenCalled();
    expect(logged()).toContain('already exists');
  });

  it('creates a new config using cwd-basename name and merged-derived defaults', async () => {
    mocks.loadWorkspaceConfig.mockResolvedValue(null);
    const s = spinner();
    await manageWorkspaceConfig({ workspace: WS, init: true, spinner: s });
    expect(mocks.createWorkspaceConfig).toHaveBeenCalledTimes(1);
    const [name, type, opts] = mocks.createWorkspaceConfig.mock.calls[0];
    expect(name).toBe('my-app'); // path.basename(WS)
    expect(type).toBe('app'); // default type
    expect(opts.framework).toBe('react'); // inherited from merged
    expect(opts.packageManager).toBe('pnpm');
    expect(opts.dev.port).toBe(3000);
    expect(s.succeed).toHaveBeenCalled();
  });

  it('honors explicit --type/--framework/--packageManager overrides', async () => {
    mocks.loadWorkspaceConfig.mockResolvedValue(null);
    await manageWorkspaceConfig({
      workspace: WS,
      init: true,
      type: 'lib',
      framework: 'vue',
      packageManager: 'yarn',
    });
    const [, type, opts] = mocks.createWorkspaceConfig.mock.calls[0];
    expect(type).toBe('lib');
    expect(opts.framework).toBe('vue');
    expect(opts.packageManager).toBe('yarn');
  });
});

describe('workspace-config — get', () => {
  it('fails the spinner and returns when no workspace config is found', async () => {
    mocks.getMergedWorkspaceConfig.mockResolvedValue(mergedWorkspace({ workspace: null }));
    const s = spinner();
    await manageWorkspaceConfig({ workspace: WS, get: 'framework', spinner: s });
    expect(s.fail).toHaveBeenCalled();
  });

  it('reports a found value with a workspace-origin annotation', async () => {
    await manageWorkspaceConfig({ workspace: WS, get: 'framework' });
    const out = logged();
    expect(out).toContain('framework: react');
    expect(out).toContain('from workspace configuration');
  });

  it('annotates inheritance when the value comes from the global layer', async () => {
    // framework present in workspace → to exercise the global branch, query a
    // key that only the global layer defines (defaultTemplate).
    mocks.getMergedWorkspaceConfig.mockResolvedValue(
      mergedWorkspace({
        workspace: { name: 'my-app', type: 'app' },
        merged: { ...MERGED, defaultTemplate: 'react-ts' } as any,
      })
    );
    await manageWorkspaceConfig({ workspace: WS, get: 'defaultTemplate' });
    expect(logged()).toContain('inherited from global configuration');
  });

  it('warns when the requested key is not found', async () => {
    await manageWorkspaceConfig({ workspace: WS, get: 'nope.missing' });
    expect(logged()).toContain("not found");
  });

  it('emits the value as a JSON object in json mode', async () => {
    await manageWorkspaceConfig({ workspace: WS, get: 'framework', json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.framework).toBe('react');
  });
});

describe('workspace-config — set', () => {
  it('throws a ValidationError when no workspace config exists', async () => {
    mocks.loadWorkspaceConfig.mockResolvedValue(null);
    await expect(
      manageWorkspaceConfig({ workspace: WS, set: 'name', value: 'x' })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mocks.saveWorkspaceConfig).not.toHaveBeenCalled();
  });

  it('writes a plain-string value (JSON.parse fallback) and persists it', async () => {
    const loaded = { ...WORKSPACE };
    mocks.loadWorkspaceConfig.mockResolvedValue(loaded);
    const s = spinner();
    await manageWorkspaceConfig({ workspace: WS, set: 'framework', value: 'vue', spinner: s });
    expect(loaded.framework).toBe('vue');
    expect(mocks.saveWorkspaceConfig).toHaveBeenCalledWith(loaded, WS);
    expect(s.succeed).toHaveBeenCalled();
  });

  it('parses a JSON-literal value (number) before writing', async () => {
    const loaded = { dev: { port: 3000 } } as any;
    mocks.loadWorkspaceConfig.mockResolvedValue(loaded);
    await manageWorkspaceConfig({ workspace: WS, set: 'dev.port', value: '4000' });
    expect(loaded.dev.port).toBe(4000);
  });

  it('creates intermediate objects for a dotted path', async () => {
    const loaded: Record<string, unknown> = { name: 'my-app' };
    mocks.loadWorkspaceConfig.mockResolvedValue(loaded);
    await manageWorkspaceConfig({ workspace: WS, set: 'build.target', value: '"es2022"' });
    expect((loaded.build as any).target).toBe('es2022');
  });
});

describe('workspace-config — interactive', () => {
  it('returns early when the action prompt is cancelled', async () => {
    mocks.prompts.mockResolvedValue({ action: undefined });
    await manageWorkspaceConfig({ workspace: WS, interactive: true });
    expect(mocks.createWorkspaceConfig).not.toHaveBeenCalled();
  });

  it('initializes a new workspace when the user picks init (no existing config)', async () => {
    mocks.getMergedWorkspaceConfig.mockResolvedValue(mergedWorkspace({ workspace: null }));
    mocks.prompts
      .mockResolvedValueOnce({ action: 'init' })
      .mockResolvedValueOnce({ name: 'custom', type: 'lib', framework: '', packageManager: '' });
    await manageWorkspaceConfig({ workspace: WS, interactive: true });
    const [name, type, opts] = mocks.createWorkspaceConfig.mock.calls[0];
    expect(name).toBe('custom');
    expect(type).toBe('lib');
    // empty framework/packageManager → no override keys set
    expect(opts.framework).toBeUndefined();
    expect(logged()).toContain('created successfully');
  });

  it('dispatches to show when the user picks view', async () => {
    mocks.prompts.mockResolvedValue({ action: 'view' });
    await manageWorkspaceConfig({ workspace: WS, interactive: true });
    expect(logged()).toContain('Workspace Configuration: my-app');
  });

  it('persists an edited field (name) when the user picks edit', async () => {
    const loaded = { ...WORKSPACE };
    mocks.loadWorkspaceConfig.mockResolvedValue(loaded);
    mocks.prompts
      .mockResolvedValueOnce({ action: 'edit' })
      .mockResolvedValueOnce({ field: 'name' })
      .mockResolvedValueOnce({ value: 'renamed' });
    await manageWorkspaceConfig({ workspace: WS, interactive: true });
    expect(loaded.name).toBe('renamed');
    expect(mocks.saveWorkspaceConfig).toHaveBeenCalled();
    expect(logged()).toContain('Updated name');
  });

  it('updates build settings when the user picks build', async () => {
    const loaded = { build: { target: 'es2019' } } as any;
    mocks.loadWorkspaceConfig.mockResolvedValue(loaded);
    mocks.prompts
      .mockResolvedValueOnce({ action: 'build' })
      .mockResolvedValueOnce({ target: 'es2022', optimize: false, analyze: true, outDir: 'build' });
    await manageWorkspaceConfig({ workspace: WS, interactive: true });
    expect(loaded.build.target).toBe('es2022');
    expect(loaded.build.optimize).toBe(false);
    expect(mocks.saveWorkspaceConfig).toHaveBeenCalled();
    expect(logged()).toContain('Build settings updated');
  });

  it('updates dev settings when the user picks dev', async () => {
    const loaded = { dev: { port: 3000 } } as any;
    mocks.loadWorkspaceConfig.mockResolvedValue(loaded);
    mocks.prompts
      .mockResolvedValueOnce({ action: 'dev' })
      .mockResolvedValueOnce({ port: 4200, host: '0.0.0.0', hmr: false, open: true });
    await manageWorkspaceConfig({ workspace: WS, interactive: true });
    expect(loaded.dev.port).toBe(4200);
    expect(loaded.dev.hmr).toBe(false);
    expect(logged()).toContain('Development settings updated');
  });

  it('updates quality settings when the user picks quality', async () => {
    const loaded = { quality: { linting: true } } as any;
    mocks.loadWorkspaceConfig.mockResolvedValue(loaded);
    mocks.prompts
      .mockResolvedValueOnce({ action: 'quality' })
      .mockResolvedValueOnce({ linting: false, testing: true, coverageThreshold: 90 });
    await manageWorkspaceConfig({ workspace: WS, interactive: true });
    expect(loaded.quality.linting).toBe(false);
    expect(loaded.quality.coverage.threshold).toBe(90);
    expect(logged()).toContain('Quality settings updated');
  });

  it('renders the inheritance chain when the user picks inheritance', async () => {
    mocks.prompts.mockResolvedValue({ action: 'inheritance' });
    await manageWorkspaceConfig({ workspace: WS, interactive: true });
    const out = logged();
    expect(out).toContain('Inheritance Chain');
    expect(out).toContain('Global Configuration');
    expect(out).toContain('Final Merged Configuration');
  });
});

describe('workspace-config — error handling', () => {
  it('fails the spinner and rethrows when getMergedWorkspaceConfig rejects', async () => {
    mocks.getMergedWorkspaceConfig.mockRejectedValue(new Error('config boom'));
    const s = spinner();
    await expect(manageWorkspaceConfig({ workspace: WS, spinner: s })).rejects.toThrow('config boom');
    expect(s.fail).toHaveBeenCalled();
  });
});
