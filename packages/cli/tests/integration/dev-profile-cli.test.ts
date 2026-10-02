import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorCodeSchema } from '@re-shell/contracts';

/**
 * End-to-end `re-shell dev --profile` conformance against the BUILT CLI
 * (dist/index.js) in a throwaway workspace with a real re-shell.profiles.yaml:
 * inheritance + overrides are applied, switching profiles changes the resolved
 * environment deterministically, and an unknown profile is an explicit error
 * (non-zero exit) pointing at the REAL `config profile list` command.
 */

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');

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
      services: [web]
  staging:
    name: staging
    environment: staging
    extends: [base]
    config:
      env:
        API_URL: https://staging.example.test
`;

let workspace: string;

function cli(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: workspace,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    timeout: 90000,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function envelope(stdout: string): Record<string, any> {
  const lines = stdout.split('\n').filter(l => l.trim().length > 0);
  expect(lines, `expected one stdout line, got: ${stdout}`).toHaveLength(1);
  return JSON.parse(lines[0]);
}

beforeAll(() => {
  workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-devprofile-cli-'));
  fs.writeFileSync(path.join(workspace, 're-shell.profiles.yaml'), PROFILES_YAML);
});

afterAll(() => {
  fs.rmSync(workspace, { recursive: true, force: true });
});

describe('re-shell dev --profile (built CLI)', () => {
  it('lists --profile on the top-level dev command', () => {
    const help = cli(['dev', '--help']);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('--profile <name>');
  });

  it('resolves inheritance + overrides and differs deterministically per profile', () => {
    const dev = cli(['dev', '--profile', 'dev', '--dry-run', '--json']);
    const staging = cli(['dev', '--profile', 'staging', '--dry-run', '--json']);
    const devAgain = cli(['dev', '--profile', 'dev', '--dry-run', '--json']);

    expect(dev.status, dev.stderr).toBe(0);
    const devEnv = envelope(dev.stdout);
    const stagingEnv = envelope(staging.stdout);

    expect(devEnv.ok).toBe(true);
    expect(devEnv.data.env).toEqual({
      API_URL: 'http://localhost:4000', // inherited from base
      LOG_LEVEL: 'debug', // overridden by dev
      RE_SHELL_PROFILE: 'dev',
      RE_SHELL_PROFILE_ENV: 'development',
    });
    expect(devEnv.data.services).toEqual(['web']);
    expect(stagingEnv.data.env).toEqual({
      API_URL: 'https://staging.example.test', // overridden by staging
      LOG_LEVEL: 'info', // inherited, dev's override does NOT leak
      RE_SHELL_PROFILE: 'staging',
      RE_SHELL_PROFILE_ENV: 'staging',
    });
    expect(stagingEnv.data.env).not.toEqual(devEnv.data.env);
    // Determinism: byte-identical output for the same profile.
    expect(devAgain.stdout).toBe(dev.stdout);
  });

  it('exits non-zero with a DEV_PROFILE_ERROR envelope for an unknown profile', () => {
    const result = cli(['dev', '--profile', 'ghost', '--json']);

    expect(result.status).toBe(1);
    const body = envelope(result.stdout);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('DEV_PROFILE_ERROR');
    expect(errorCodeSchema.safeParse(body.error.code).success).toBe(true);
    expect(body.error.message).toContain('Profile "ghost" not found');
    expect(body.error.details.available).toEqual(['base', 'dev', 'staging']);
  });

  it('exits non-zero with a human message that names the real profile command', () => {
    const result = cli(['dev', '--profile', 'ghost', '--cluster']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Profile "ghost" not found');
    expect(result.stderr).toContain('re-shell config profile list');
    expect(result.stderr).not.toContain('"re-shell profile list"');
  });

  it('the hinted command exists and lists the profiles', () => {
    const result = cli(['config', 'profile', 'list']);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('dev');
    expect(result.stdout).toContain('staging');
  });

  it('`tools dev start --profile <unknown>` is an error too (it used to exit 0), with the right hint', () => {
    const result = cli(['tools', 'dev', 'start', '--profile', 'ghost']);

    expect(result.status).toBe(1);
    expect(result.stderr + result.stdout).toContain('Profile "ghost" not found');
    expect(result.stderr + result.stdout).toContain('re-shell config profile list');
  });

  it('still steers plain `dev` (no profile, no mode flag) to the available runtimes', () => {
    const result = cli(['dev']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--cluster');
  });
});
