import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { manageProjectConfig } from '../../src/commands/project-config';
import { ValidationError } from '../../src/utils/error-handler';

// Covers src/commands/project-config.ts — the `project-config` command. It
// dispatches on options (init/get/set/interactive/show) and delegates to the
// configManager + prompts. We mock configManager (utils/config) and prompts, and
// spy console.log / process.cwd so every branch is exercised deterministically
// without touching disk or the tty.

const mocks = vi.hoisted(() => ({
  prompts: vi.fn(),
  loadProjectConfig: vi.fn(),
  loadGlobalConfig: vi.fn(),
  createProjectConfig: vi.fn(),
  getMergedConfig: vi.fn(),
  saveProjectConfig: vi.fn(),
}));

vi.mock('../../src/utils/config', () => ({
  configManager: {
    loadProjectConfig: mocks.loadProjectConfig,
    loadGlobalConfig: mocks.loadGlobalConfig,
    createProjectConfig: mocks.createProjectConfig,
    getMergedConfig: mocks.getMergedConfig,
    saveProjectConfig: mocks.saveProjectConfig,
  },
}));
vi.mock('prompts', () => ({ default: mocks.prompts }));

let logSpy: ReturnType<typeof vi.spyOn>;
let cwdSpy: ReturnType<typeof vi.spyOn>;

function logged(): string {
  return logSpy.mock.calls.map(args => args.join(' ')).join('\n');
}

/** A ProgressSpinner stub capturing the terminal-state methods it exercises. */
function stubSpinner() {
  return {
    setText: vi.fn(),
    stop: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
    start: vi.fn(),
  };
}

const GLOBAL = {
  packageManager: 'pnpm',
  defaultFramework: 'react-ts',
  defaultTemplate: 'blank',
};

const PROJECT = {
  name: 'my-project',
  type: 'monorepo',
  packageManager: 'pnpm',
  framework: 'react-ts',
};

const MERGED = { ...PROJECT, dev: { port: 3000 }, custom: { flag: true } };

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset());
  process.exitCode = undefined;

  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/mock-project');

  mocks.loadGlobalConfig.mockResolvedValue(GLOBAL);
  mocks.loadProjectConfig.mockResolvedValue(PROJECT);
  mocks.createProjectConfig.mockResolvedValue(PROJECT);
  mocks.getMergedConfig.mockResolvedValue({
    project: PROJECT,
    merged: MERGED,
    global: GLOBAL,
  });
  mocks.saveProjectConfig.mockResolvedValue(undefined);
});

afterEach(() => {
  logSpy.mockRestore();
  cwdSpy.mockRestore();
  process.exitCode = undefined;
});

describe('project-config — init', () => {
  it('warns when a project config already exists (non-interactive)', async () => {
    mocks.loadProjectConfig.mockResolvedValue(PROJECT);
    await manageProjectConfig({ init: true });
    expect(logged()).toContain('Project configuration already exists');
    expect(mocks.createProjectConfig).not.toHaveBeenCalled();
  });

  it('creates a new project config with global-derived defaults', async () => {
    mocks.loadProjectConfig.mockResolvedValue(null);
    await manageProjectConfig({ init: true });
    expect(mocks.createProjectConfig).toHaveBeenCalledWith(
      'mock-project',
      expect.objectContaining({
        type: 'monorepo',
        packageManager: 'pnpm',
        framework: 'react-ts',
      })
    );
    expect(logged()).toContain('Project configuration created');
  });

  it('honours explicit --packageManager / --framework overrides', async () => {
    mocks.loadProjectConfig.mockResolvedValue(null);
    await manageProjectConfig({ init: true, packageManager: 'yarn', framework: 'vue' });
    expect(mocks.createProjectConfig).toHaveBeenCalledWith(
      'mock-project',
      expect.objectContaining({ packageManager: 'yarn', framework: 'vue' })
    );
  });
});

describe('project-config — get', () => {
  it('fails the spinner and returns when no project config exists', async () => {
    mocks.getMergedConfig.mockResolvedValue({ project: null, merged: {}, global: GLOBAL });
    const spinner = stubSpinner();
    await manageProjectConfig({ get: 'name', spinner });
    expect(spinner.fail).toHaveBeenCalled();
    expect(logged()).toBe('');
  });

  it('prints an existing value', async () => {
    await manageProjectConfig({ get: 'name' });
    expect(logged()).toContain('name:');
    expect(logged()).toContain('my-project');
  });

  it('notes when the value is inherited from global configuration', async () => {
    // 'team' is in merged (via global inheritance) but NOT on the project itself.
    mocks.getMergedConfig.mockResolvedValue({
      project: { name: 'my-project' },
      merged: { name: 'my-project', team: 'platform' },
      global: GLOBAL,
    });
    await manageProjectConfig({ get: 'team' });
    expect(logged()).toContain('inherited from global configuration');
  });

  it('warns when the requested key is not found', async () => {
    await manageProjectConfig({ get: 'nope' });
    expect(logged()).toContain("Configuration key 'nope' not found");
  });

  it('emits JSON when --json is set', async () => {
    await manageProjectConfig({ get: 'name', json: true });
    const parsed = JSON.parse(logged());
    expect(parsed).toEqual({ name: 'my-project' });
  });
});

describe('project-config — set', () => {
  it('throws a ValidationError when no project config exists', async () => {
    mocks.loadProjectConfig.mockResolvedValue(null);
    await expect(manageProjectConfig({ set: 'name', value: 'x' })).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('writes a plain string value (JSON.parse falls back to raw)', async () => {
    await manageProjectConfig({ set: 'framework', value: 'vue' });
    expect(mocks.saveProjectConfig).toHaveBeenCalledTimes(1);
    const saved = mocks.saveProjectConfig.mock.calls[0][0];
    expect(saved.framework).toBe('vue');
  });

  it('parses a JSON literal value (number / array / object)', async () => {
    await manageProjectConfig({ set: 'dev.port', value: '4000' });
    const saved = mocks.saveProjectConfig.mock.calls[0][0];
    expect(saved.dev.port).toBe(4000); // parsed as a number, not a string
  });

  it('creates intermediate objects for a dotted path', async () => {
    await manageProjectConfig({ set: 'a.b.c', value: 'true' });
    const saved = mocks.saveProjectConfig.mock.calls[0][0];
    expect(saved.a.b.c).toBe(true); // 'true' parses to boolean true
  });
});

describe('project-config — show (default)', () => {
  it('warns when no project configuration is found', async () => {
    mocks.getMergedConfig.mockResolvedValue({ project: null, merged: {}, global: GLOBAL });
    await manageProjectConfig({});
    expect(logged()).toContain('No project configuration found');
  });

  it('renders the human report with project settings and inherited globals', async () => {
    await manageProjectConfig({});
    const out = logged();
    expect(out).toContain('Project Configuration');
    expect(out).toContain('Package Manager: pnpm');
    expect(out).toContain('Default Framework: react-ts');
  });

  it('emits JSON when --json is set', async () => {
    await manageProjectConfig({ json: true });
    const parsed = JSON.parse(logged());
    expect(parsed.project).toEqual(PROJECT);
    expect(parsed.merged).toEqual(MERGED);
    expect(parsed.inheritedFrom).toEqual({
      packageManager: 'pnpm',
      framework: 'react-ts',
      template: 'blank',
    });
  });

  it('renders the merged configuration section in verbose mode', async () => {
    await manageProjectConfig({ verbose: true });
    expect(logged()).toContain('Merged Configuration');
  });
});

describe('project-config — interactive dispatch', () => {
  it('returns silently when the top-level prompt is cancelled', async () => {
    mocks.prompts.mockResolvedValue({ action: undefined });
    await manageProjectConfig({ interactive: true });
    // Only the action prompt ran; no config mutation.
    expect(mocks.prompts).toHaveBeenCalledTimes(1);
    expect(mocks.createProjectConfig).not.toHaveBeenCalled();
    expect(mocks.saveProjectConfig).not.toHaveBeenCalled();
  });

  it('init action creates a project config from the prompted answers', async () => {
    mocks.getMergedConfig.mockResolvedValue({ project: null, merged: {}, global: GLOBAL });
    mocks.prompts
      .mockResolvedValueOnce({ action: 'init' })
      .mockResolvedValueOnce({
        name: 'acme',
        type: 'monorepo',
        packageManager: 'pnpm',
        framework: 'react-ts',
        git: true,
      });
    await manageProjectConfig({ interactive: true });
    expect(mocks.createProjectConfig).toHaveBeenCalledWith(
      'acme',
      expect.objectContaining({ type: 'monorepo', packageManager: 'pnpm' })
    );
  });

  it('view action delegates to the show renderer', async () => {
    mocks.prompts.mockResolvedValueOnce({ action: 'view' });
    await manageProjectConfig({ interactive: true });
    expect(logged()).toContain('Project Configuration');
  });

  it('edit → dev settings prompts and persists the dev block', async () => {
    mocks.prompts
      .mockResolvedValueOnce({ action: 'edit' })
      .mockResolvedValueOnce({ field: 'dev' })
      .mockResolvedValueOnce({ port: 4000, host: '0.0.0.0', hmr: true });
    await manageProjectConfig({ interactive: true });
    const saved = mocks.saveProjectConfig.mock.calls[0][0];
    expect(saved.dev).toMatchObject({ port: 4000, host: '0.0.0.0', hmr: true });
  });
});

describe('project-config — error wrapper', () => {
  it('fails the spinner and rethrows when an operation throws', async () => {
    mocks.loadProjectConfig.mockResolvedValue(null); // set path throws ValidationError
    const spinner = stubSpinner();
    await expect(
      manageProjectConfig({ set: 'name', value: 'x', spinner })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(spinner.fail).toHaveBeenCalled();
  });
});
