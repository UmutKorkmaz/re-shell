import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `re-shell dev --profile <name>` wiring, with a REAL profile file and the real
// profile resolver. Only the runtimes that would start long-lived processes
// (cluster, restart plan, hot-reload dev mode) are replaced.

vi.mock('../../src/commands/dev-cluster', () => ({ runDevCluster: vi.fn() }));
vi.mock('../../src/commands/dev-restart-plan', () => ({ runRestartPlan: vi.fn() }));
vi.mock('../../src/commands/dev-mode', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/commands/dev-mode')>();
  return { ...actual, manageDevMode: vi.fn() };
});

const { registerDevGroup } = await import('../../src/groups/dev.group');
const { runDevCluster } = await import('../../src/commands/dev-cluster');
const { runRestartPlan } = await import('../../src/commands/dev-restart-plan');
const { manageDevMode } = await import('../../src/commands/dev-mode');

const PROFILES_YAML = `
profiles:
  base:
    name: base
    environment: development
    config:
      env:
        LOG_LEVEL: info
        API_URL: http://localhost:4000
  dev:
    name: dev
    environment: development
    extends: [base]
    config:
      env:
        LOG_LEVEL: debug
      services: [web, api]
  staging:
    name: staging
    environment: staging
    extends: [base]
    config:
      env:
        API_URL: https://staging.example.test
      services: [web]
`;

let root: string;
let stdoutWrites: string[];
let exitCodeBackup: string | number | undefined;
let envBackup: NodeJS.ProcessEnv;

function program(): Command {
  const p = new Command();
  p.exitOverride();
  registerDevGroup(p);
  return p;
}

function run(...args: string[]): Promise<Command> {
  return program().parseAsync(['node', 're-shell', 'dev', ...args]);
}

function envelopes(): Array<Record<string, any>> {
  return stdoutWrites.filter(line => line.startsWith('{')).map(line => JSON.parse(line));
}

beforeEach(() => {
  vi.clearAllMocks();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-devgroup-'));
  fs.writeFileSync(path.join(root, 're-shell.profiles.yaml'), PROFILES_YAML);
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  stdoutWrites = [];
  vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
    stdoutWrites.push(String(chunk));
    return true;
  }) as never);
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  exitCodeBackup = process.exitCode;
  process.exitCode = undefined;
  envBackup = { ...process.env };
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = exitCodeBackup;
  for (const key of Object.keys(process.env)) {
    if (!(key in envBackup)) delete process.env[key];
  }
  Object.assign(process.env, envBackup);
  fs.rmSync(root, { recursive: true, force: true });
});

describe('dev --profile', () => {
  it('is registered as --profile <name>', () => {
    const dev = program().commands.find(c => c.name() === 'dev') as Command;
    expect(dev.options.map(o => o.flags)).toContain('--profile <name>');
  });

  it('--dry-run --json emits the resolved profile environment, different per profile', async () => {
    await run('--profile', 'dev', '--dry-run', '--json');
    await run('--profile', 'staging', '--dry-run', '--json');
    await run('--profile', 'dev', '--dry-run', '--json');

    const [dev1, staging, dev2] = envelopes();
    expect(dev1.ok).toBe(true);
    expect(dev1.data).toMatchObject({
      profile: 'dev',
      environment: 'development',
      extends: ['base'],
      services: ['web', 'api'],
    });
    expect(dev1.data.env).toMatchObject({
      LOG_LEVEL: 'debug',
      API_URL: 'http://localhost:4000',
      RE_SHELL_PROFILE: 'dev',
    });
    expect(staging.data.env).toMatchObject({
      LOG_LEVEL: 'info',
      API_URL: 'https://staging.example.test',
      RE_SHELL_PROFILE: 'staging',
    });
    expect(staging.data.env).not.toEqual(dev1.data.env);
    // Deterministic: resolving the same profile twice gives identical output.
    expect(dev2).toEqual(dev1);

    // A dry run starts nothing and leaves the real environment alone.
    expect(manageDevMode).not.toHaveBeenCalled();
    expect(runDevCluster).not.toHaveBeenCalled();
    expect(process.env.RE_SHELL_PROFILE).toBeUndefined();
  });

  it('--dry-run prints the environment that would be applied', async () => {
    const logSpy = vi.mocked(console.log);
    await run('--profile', 'staging', '--dry-run');
    const out = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(out).toContain('Profile: staging');
    expect(out).toContain('API_URL=https://staging.example.test');
    expect(out).toContain('RE_SHELL_PROFILE=staging');
  });

  it('fails with a non-zero exit and the correct hint for an unknown profile (nothing is started)', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await run('--profile', 'ghost', '--cluster');

    expect(exitSpy).toHaveBeenCalledWith(1);
    const message = vi.mocked(console.error).mock.calls.map(c => c.join(' ')).join('\n');
    expect(message).toContain('Profile "ghost" not found');
    expect(message).toContain('re-shell config profile list');
    expect(runDevCluster).not.toHaveBeenCalled();
    expect(manageDevMode).not.toHaveBeenCalled();
    expect(process.env.RE_SHELL_PROFILE).toBeUndefined();
  });

  it('--json reports an unknown profile as a DEV_PROFILE_ERROR envelope and exits non-zero', async () => {
    await run('--profile', 'ghost', '--json');

    const [envelope] = envelopes();
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('DEV_PROFILE_ERROR');
    expect(envelope.error.message).toContain('Profile "ghost" not found');
    expect(envelope.error.details.available).toEqual(['base', 'dev', 'staging']);
    expect(process.exitCode).toBe(1);
    expect(runDevCluster).not.toHaveBeenCalled();
  });

  it('validates the profile before the restart plan runs', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    await run('--profile', 'ghost', '--restart-plan', '--changed', 'ui');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(runRestartPlan).not.toHaveBeenCalled();
  });

  it('applies the resolved environment to the restart-plan runtime', async () => {
    vi.mocked(runRestartPlan).mockResolvedValue(undefined);
    await run('--profile', 'staging', '--restart-plan', '--changed', 'ui');
    expect(runRestartPlan).toHaveBeenCalled();
    expect(process.env.RE_SHELL_PROFILE).toBe('staging');
    expect(process.env.API_URL).toBe('https://staging.example.test');
  });

  it('--cluster runs with the profile environment and scopes services to the profile', async () => {
    vi.mocked(runDevCluster).mockResolvedValue(undefined);

    await run('--cluster', '--profile', 'staging');

    expect(process.env.LOG_LEVEL).toBe('info');
    expect(process.env.API_URL).toBe('https://staging.example.test');
    expect(process.env.RE_SHELL_PROFILE).toBe('staging');
    expect(runDevCluster).toHaveBeenCalledWith(
      expect.objectContaining({ cluster: true, filter: ['web'] })
    );
  });

  it('an explicit --filter wins over the profile services', async () => {
    vi.mocked(runDevCluster).mockResolvedValue(undefined);
    await run('--cluster', '--profile', 'dev', '--filter', 'api');
    expect(runDevCluster).toHaveBeenCalledWith(expect.objectContaining({ filter: ['api'] }));
  });

  it('switching profiles between runs changes the environment the runtime sees', async () => {
    vi.mocked(runDevCluster).mockResolvedValue(undefined);
    const seen: Array<Record<string, string | undefined>> = [];
    vi.mocked(runDevCluster).mockImplementation(async () => {
      seen.push({
        LOG_LEVEL: process.env.LOG_LEVEL,
        API_URL: process.env.API_URL,
        RE_SHELL_PROFILE: process.env.RE_SHELL_PROFILE,
      });
    });

    await run('--cluster', '--profile', 'dev');
    await run('--cluster', '--profile', 'staging');

    expect(seen).toEqual([
      { LOG_LEVEL: 'debug', API_URL: 'http://localhost:4000', RE_SHELL_PROFILE: 'dev' },
      { LOG_LEVEL: 'info', API_URL: 'https://staging.example.test', RE_SHELL_PROFILE: 'staging' },
    ]);
  });

  it('without a runtime flag, starts the hot-reload dev mode under the profile with its services', async () => {
    vi.mocked(manageDevMode).mockResolvedValue(undefined);

    await run('--profile', 'dev');

    expect(manageDevMode).toHaveBeenCalledWith({
      start: true,
      profile: 'dev',
      services: ['web', 'api'],
    });
    expect(runDevCluster).not.toHaveBeenCalled();
  });

  it('plain `dev` (no profile) still steers users instead of silently succeeding', async () => {
    await run();
    expect(manageDevMode).not.toHaveBeenCalled();
    expect(runDevCluster).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
