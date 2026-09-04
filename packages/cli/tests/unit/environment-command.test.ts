import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { manageEnvironment } from '../../src/commands/environment';

// UNIT coverage for src/commands/environment.ts — the `environment` command
// (NOT the utils/environment EnvironmentManager, which is covered by the open
// environment.test.ts). Named environment-command.test.ts to avoid colliding
// with that util test. manageEnvironment dispatches (list/active/set/create/
// delete/update/compare/generate/interactive/default-status) and delegates to
// environmentManager + prompts; we mock both and spy console.log so every
// branch is exercised deterministically without touching disk or the tty.

const mocks = vi.hoisted(() => ({
  listEnvironments: vi.fn(),
  getActiveEnvironment: vi.fn(),
  setActiveEnvironment: vi.fn(),
  createEnvironment: vi.fn(),
  deleteEnvironment: vi.fn(),
  compareEnvironments: vi.fn(),
  generateEnvFile: vi.fn(),
  createDefaultEnvironments: vi.fn(),
  prompts: vi.fn(),
}));

vi.mock('../../src/utils/environment', () => ({
  environmentManager: {
    listEnvironments: mocks.listEnvironments,
    getActiveEnvironment: mocks.getActiveEnvironment,
    setActiveEnvironment: mocks.setActiveEnvironment,
    createEnvironment: mocks.createEnvironment,
    deleteEnvironment: mocks.deleteEnvironment,
    compareEnvironments: mocks.compareEnvironments,
    generateEnvFile: mocks.generateEnvFile,
    createDefaultEnvironments: mocks.createDefaultEnvironments,
  },
}));
vi.mock('prompts', () => ({ default: mocks.prompts }));

function spinner() {
  return { setText: vi.fn(), stop: vi.fn(), succeed: vi.fn(), fail: vi.fn() } as any;
}

function env(over: Record<string, unknown> = {}) {
  return {
    name: 'production',
    active: false,
    variables: { API_KEY: 'x', PORT: '3000' },
    build: { mode: 'production', optimization: true, sourcemaps: true },
    deployment: { provider: 'aws', target: 'lambda' },
    ...over,
  };
}

let logSpy: ReturnType<typeof vi.spyOn>;

function logged(): string {
  return logSpy.mock.calls.map(a => a.join(' ')).join('\n');
}

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset());
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

describe('environment — list', () => {
  it('emits environments as JSON in json mode', async () => {
    mocks.listEnvironments.mockResolvedValue([env({ name: 'dev', active: true })]);
    await manageEnvironment({ list: true, json: true });
    const json = JSON.parse(logSpy.mock.calls.map(a => a.join('')).find(s => s.trim().startsWith('['))!);
    expect(json).toHaveLength(1);
    expect(json[0].name).toBe('dev');
  });

  it('creates defaults and retries when the list is empty (first attempt)', async () => {
    mocks.listEnvironments
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([env({ name: 'development', active: true })]);
    await manageEnvironment({ list: true });
    expect(mocks.createDefaultEnvironments).toHaveBeenCalledTimes(1);
    expect(logged()).toContain('Creating defaults');
    // The retried list renders the newly-created environment.
    expect(logged()).toContain('development');
  });

  it('reports no environments when still empty after a retry', async () => {
    mocks.listEnvironments.mockResolvedValue([]);
    await manageEnvironment({ list: true });
    expect(logged()).toContain('No environments available.');
  });

  it('renders the populated list with active indicators, extends, and verbose detail', async () => {
    mocks.listEnvironments.mockResolvedValue([
      env({ name: 'prod', active: true, extends: 'base', lastUsed: '2024-01-01' }),
      env({ name: 'staging', active: false }),
    ]);
    await manageEnvironment({ list: true, verbose: true });
    const out = logged();
    expect(out).toContain('Available Environments');
    expect(out).toContain('prod');
    expect(out).toContain('extends base');
    expect(out).toContain('staging');
    expect(out).toContain('Mode: production'); // verbose
  });
});

describe('environment — active', () => {
  it('warns when there is no active environment', async () => {
    mocks.getActiveEnvironment.mockResolvedValue(null);
    await manageEnvironment({ active: true });
    expect(logged()).toContain('No active environment');
  });

  it('renders the active environment (variables, build, deployment) in human mode', async () => {
    mocks.getActiveEnvironment.mockResolvedValue(env({ name: 'prod', active: true, extends: 'base' }));
    await manageEnvironment({ active: true });
    const out = logged();
    expect(out).toContain('Active Environment: prod');
    expect(out).toContain('Extends: base');
    expect(out).toContain('API_KEY: x');
    expect(out).toContain('Mode: production');
    expect(out).toContain('Provider: aws');
  });

  it('emits the active environment as JSON in json mode', async () => {
    mocks.getActiveEnvironment.mockResolvedValue(env({ name: 'prod' }));
    await manageEnvironment({ active: true, json: true });
    const json = JSON.parse(logSpy.mock.calls.map(a => a.join('')).find(s => s.trim().startsWith('{'))!);
    expect(json.name).toBe('prod');
  });
});

describe('environment — set / create / delete / update / generate', () => {
  it('activates the named environment and succeeds the spinner', async () => {
    mocks.setActiveEnvironment.mockResolvedValue(undefined);
    const s = spinner();
    await manageEnvironment({ set: 'staging', spinner: s });
    expect(mocks.setActiveEnvironment).toHaveBeenCalledWith('staging');
    expect(s.succeed).toHaveBeenCalled();
  });

  it('creates a development environment with DEBUG=true', async () => {
    mocks.createEnvironment.mockResolvedValue(undefined);
    await manageEnvironment({ create: 'development', spinner: spinner() });
    const [name, config] = mocks.createEnvironment.mock.calls[0];
    expect(name).toBe('development');
    expect(config.variables.DEBUG).toBe('true');
    expect(config.build.optimization).toBe(false);
  });

  it('creates a non-development environment with optimization on', async () => {
    mocks.createEnvironment.mockResolvedValue(undefined);
    await manageEnvironment({ create: 'production', extends: 'base', spinner: spinner() });
    const [, config, extendsEnv] = mocks.createEnvironment.mock.calls[0];
    expect(config.build.optimization).toBe(true);
    expect(extendsEnv).toBe('base');
  });

  it('deletes the named environment', async () => {
    mocks.deleteEnvironment.mockResolvedValue(undefined);
    await manageEnvironment({ delete: 'old', spinner: spinner() });
    expect(mocks.deleteEnvironment).toHaveBeenCalledWith('old');
  });

  it('prints the "coming soon" notice for update', async () => {
    await manageEnvironment({ update: 'prod', spinner: spinner() });
    expect(logged()).toContain('coming soon');
  });

  it('generates an env file and reports the returned path', async () => {
    mocks.generateEnvFile.mockResolvedValue('/tmp/.env');
    const s = spinner();
    await manageEnvironment({ generate: 'prod', spinner: s });
    expect(mocks.generateEnvFile).toHaveBeenCalledWith('prod', undefined);
    // The success message is routed through the spinner, not console.log.
    const msg = s.succeed.mock.calls[0][0] as string;
    expect(msg).toContain('/tmp/.env');
  });
});

describe('environment — compare', () => {
  it('renders variable/build/deployment diffs in human mode', async () => {
    mocks.compareEnvironments.mockResolvedValue({
      variables: {
        added: ['NEW'],
        removed: ['OLD'],
        changed: [{ key: 'PORT', from: '3000', to: '4000' }],
      },
      build: { optimization: { from: false, to: true } },
      deployment: {},
    });
    await manageEnvironment({ compare: ['dev', 'prod'] });
    const out = logged();
    expect(out).toContain('dev vs prod');
    expect(out).toContain('Added in prod: NEW');
    expect(out).toContain('Removed from prod: OLD');
    expect(out).toContain('PORT: 3000');
    expect(out).toContain('optimization: false');
  });

  it('emits the comparison as JSON in json mode', async () => {
    mocks.compareEnvironments.mockResolvedValue({
      variables: { added: ['X'], removed: [], changed: [] },
      build: {},
      deployment: {},
    });
    await manageEnvironment({ compare: ['a', 'b'], json: true });
    const json = JSON.parse(logSpy.mock.calls.map(a => a.join('')).find(s => s.trim().startsWith('{'))!);
    expect(json.variables.added).toEqual(['X']);
  });
});

describe('environment — default status', () => {
  it('renders the status overview with quick actions when environments exist', async () => {
    mocks.getActiveEnvironment.mockResolvedValue(env({ name: 'prod', active: true }));
    mocks.listEnvironments.mockResolvedValue([env()]);
    await manageEnvironment({});
    const out = logged();
    expect(out).toContain('Active: prod');
    expect(out).toContain('Total environments: 1');
    expect(out).toContain('Quick actions:');
  });

  it('warns about no active environment and reports the count', async () => {
    mocks.getActiveEnvironment.mockResolvedValue(null);
    mocks.listEnvironments.mockResolvedValue([]);
    await manageEnvironment({});
    expect(logged()).toContain('No active environment');
    expect(logged()).toContain('Total environments: 0');
  });

  it('emits status as JSON in json mode', async () => {
    mocks.getActiveEnvironment.mockResolvedValue(env({ name: 'prod' }));
    mocks.listEnvironments.mockResolvedValue([env()]);
    await manageEnvironment({ json: true });
    const json = JSON.parse(logSpy.mock.calls.map(a => a.join('')).find(s => s.trim().startsWith('{'))!);
    expect(json.active.name).toBe('prod');
    expect(json.environments).toHaveLength(1);
  });
});

describe('environment — interactive', () => {
  it('dispatches to list when the user picks "list"', async () => {
    mocks.prompts.mockResolvedValue({ action: 'list' });
    mocks.listEnvironments.mockResolvedValue([env({ name: 'dev', active: true })]);
    await manageEnvironment({ interactive: true });
    expect(mocks.listEnvironments).toHaveBeenCalled();
    expect(logged()).toContain('Available Environments');
  });

  it('dispatches to active when the user picks "active"', async () => {
    mocks.prompts.mockResolvedValue({ action: 'active' });
    mocks.getActiveEnvironment.mockResolvedValue(env({ name: 'prod', active: true }));
    await manageEnvironment({ interactive: true });
    expect(logged()).toContain('Active Environment: prod');
  });

  it('returns early when the interactive prompt is cancelled', async () => {
    mocks.prompts.mockResolvedValue({ action: undefined });
    await manageEnvironment({ interactive: true });
    expect(mocks.listEnvironments).not.toHaveBeenCalled();
  });

  it('shows the "coming soon" notice for unhandled interactive actions', async () => {
    mocks.prompts.mockResolvedValue({ action: 'compare' });
    await manageEnvironment({ interactive: true });
    expect(logged()).toContain('coming soon');
  });
});

describe('environment — error handling', () => {
  it('fails the spinner and rethrows when an operation rejects', async () => {
    mocks.setActiveEnvironment.mockRejectedValue(new Error('boom'));
    const s = spinner();
    await expect(manageEnvironment({ set: 'x', spinner: s })).rejects.toThrow('boom');
    expect(s.fail).toHaveBeenCalled();
  });
});
