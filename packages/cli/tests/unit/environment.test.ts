import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const { mockProjectConfig } = vi.hoisted(() => ({
  mockProjectConfig: {
    name: 'test-project',
    environments: {} as Record<string, any>,
    activeEnvironment: null as string | null,
  },
}));

vi.mock('../../src/utils/config', () => ({
  configManager: {
    getProjectConfig: () => mockProjectConfig,
    saveProjectConfig: (cfg: any) => { Object.assign(mockProjectConfig, cfg); },
    loadProjectConfig: vi.fn().mockResolvedValue(mockProjectConfig),
  },
  EnvironmentConfig: {},
}));

import { EnvironmentManager } from '../../src/utils/environment';

describe('EnvironmentManager', () => {
  beforeEach(() => {
    mockProjectConfig.environments = {};
    mockProjectConfig.activeEnvironment = null;
  });

  it('creates and retrieves an environment', async () => {
    const tmpDir = path.join(os.tmpdir(), `env-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const mgr = new EnvironmentManager(tmpDir);

    await mgr.createEnvironment('staging', {
      name: 'staging',
      variables: { NODE_ENV: 'staging', API_URL: 'https://staging.example.com' },
      build: { mode: 'staging', optimization: true, sourcemaps: false },
      deployment: { provider: 'vercel' },
    });

    const env = await mgr.getEnvironment('staging');
    expect(env).not.toBeNull();
    expect(env!.name).toBe('staging');
    expect(env!.variables.NODE_ENV).toBe('staging');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('throws when creating a duplicate environment', async () => {
    const tmpDir = path.join(os.tmpdir(), `env-dup-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const mgr = new EnvironmentManager(tmpDir);

    await mgr.createEnvironment('prod', {
      name: 'prod',
      variables: {},
      build: { mode: 'production', optimization: true, sourcemaps: false },
      deployment: {},
    });

    await expect(
      mgr.createEnvironment('prod', {
        name: 'prod',
        variables: {},
        build: { mode: 'production', optimization: true, sourcemaps: false },
        deployment: {},
      })
    ).rejects.toThrow();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists created environments', async () => {
    const tmpDir = path.join(os.tmpdir(), `env-list-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const mgr = new EnvironmentManager(tmpDir);

    await mgr.createEnvironment('dev', {
      name: 'dev',
      variables: {},
      build: { mode: 'development', optimization: false, sourcemaps: true },
      deployment: {},
    });
    await mgr.createEnvironment('qa', {
      name: 'qa',
      variables: {},
      build: { mode: 'staging', optimization: false, sourcemaps: true },
      deployment: {},
    });

    const list = await mgr.listEnvironments();
    expect(list.length).toBeGreaterThanOrEqual(2);
    const names = list.map(e => e.name);
    expect(names).toContain('dev');
    expect(names).toContain('qa');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('sets active environment without throwing', async () => {
    const tmpDir = path.join(os.tmpdir(), `env-active-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const mgr = new EnvironmentManager(tmpDir);

    await mgr.createEnvironment('dev', {
      name: 'dev',
      variables: {},
      build: { mode: 'development', optimization: false, sourcemaps: true },
      deployment: {},
    });

    await expect(mgr.setActiveEnvironment('dev')).resolves.toBeUndefined();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('deletes an environment', async () => {
    const tmpDir = path.join(os.tmpdir(), `env-del-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const mgr = new EnvironmentManager(tmpDir);

    await mgr.createEnvironment('temp', {
      name: 'temp',
      variables: {},
      build: { mode: 'development', optimization: false, sourcemaps: true },
      deployment: {},
    });

    await mgr.deleteEnvironment('temp');
    const env = await mgr.getEnvironment('temp');
    expect(env).toBeNull();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates a .env file', async () => {
    const tmpDir = path.join(os.tmpdir(), `env-file-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const mgr = new EnvironmentManager(tmpDir);

    await mgr.createEnvironment('dev', {
      name: 'dev',
      variables: { NODE_ENV: 'development', PORT: '3000' },
      build: { mode: 'development', optimization: false, sourcemaps: true },
      deployment: {},
    });

    const outputPath = path.join(tmpDir, '.env');
    const result = await mgr.generateEnvFile('dev', outputPath);
    expect(result).toBe(outputPath);
    const content = fs.readFileSync(outputPath, 'utf-8');
    expect(content).toContain('NODE_ENV=development');
    expect(content).toContain('PORT=3000');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
