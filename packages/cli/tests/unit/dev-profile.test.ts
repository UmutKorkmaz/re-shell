import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DevProfileError,
  PROFILE_LIST_HINT,
  applyProfileEnvironment,
  buildProfileEnvironment,
  resolveDevProfile,
} from '../../src/commands/dev-mode';

// `dev --profile` resolution against a REAL re-shell.profiles.yaml (no mocks of
// the profile system): inheritance, overrides, determinism across profile
// switches, and explicit errors for unknown / broken profiles.

let root: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;

const PROFILES_YAML = `
profiles:
  base:
    name: base
    environment: development
    config:
      env:
        LOG_LEVEL: info
        API_URL: http://localhost:4000
        FEATURE_X: "off"
      dev:
        port: 3000
        host: localhost
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
        FEATURE_X: "on"
      dev:
        port: 4100
      services: [web]
  standalone:
    name: standalone
    environment: custom
    config:
      env:
        ONLY_HERE: "1"
  loop-a:
    name: loop-a
    environment: development
    extends: [loop-b]
    config: {}
  loop-b:
    name: loop-b
    environment: development
    extends: [loop-a]
    config: {}
`;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-devprofile-'));
  fs.writeFileSync(path.join(root, 're-shell.profiles.yaml'), PROFILES_YAML);
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(root);
});

afterEach(() => {
  cwdSpy.mockRestore();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('resolveDevProfile', () => {
  it('applies inheritance and lets the child override its parent', async () => {
    const dev = await resolveDevProfile('dev');

    expect(dev.env).toEqual({
      API_URL: 'http://localhost:4000', // inherited
      FEATURE_X: 'off', // inherited
      LOG_LEVEL: 'debug', // overridden by dev
      RE_SHELL_DEV_HOST: 'localhost', // from the inherited dev settings
      RE_SHELL_DEV_PORT: '3000',
      RE_SHELL_PROFILE: 'dev',
      RE_SHELL_PROFILE_ENV: 'development',
    });
    expect(dev.services).toEqual(['web', 'api']);
  });

  it('switching profiles changes the resolved environment, deterministically', async () => {
    const dev = await resolveDevProfile('dev');
    const staging = await resolveDevProfile('staging');

    // Different profiles -> different environments.
    expect(staging.env).not.toEqual(dev.env);
    expect(staging.env).toMatchObject({
      API_URL: 'https://staging.example.test',
      FEATURE_X: 'on',
      LOG_LEVEL: 'info', // inherited from base, NOT dev's override
      RE_SHELL_DEV_PORT: '4100', // overridden dev port
      RE_SHELL_DEV_HOST: 'localhost', // inherited
      RE_SHELL_PROFILE: 'staging',
      RE_SHELL_PROFILE_ENV: 'staging',
    });
    expect(staging.services).toEqual(['web']);

    // Same profile, any number of resolutions, any order -> identical output
    // (including key order, which is sorted).
    const again = await resolveDevProfile('dev');
    const stagingAgain = await resolveDevProfile('staging');
    expect(JSON.stringify(again.env)).toBe(JSON.stringify(dev.env));
    expect(JSON.stringify(stagingAgain.env)).toBe(JSON.stringify(staging.env));
    expect(Object.keys(dev.env)).toEqual([...Object.keys(dev.env)].sort());
  });

  it('does not leak one profile into the next when applied to an environment', async () => {
    const dev = await resolveDevProfile('dev');
    const staging = await resolveDevProfile('staging');

    const envA: NodeJS.ProcessEnv = { PATH: '/bin' };
    const applied = applyProfileEnvironment(dev.env, envA);
    expect(applied).toEqual(Object.keys(dev.env));
    expect(envA).toMatchObject({ PATH: '/bin', LOG_LEVEL: 'debug', RE_SHELL_PROFILE: 'dev' });

    // Applying staging onto a fresh environment is not influenced by dev.
    const envB: NodeJS.ProcessEnv = { PATH: '/bin' };
    applyProfileEnvironment(staging.env, envB);
    expect(envB.LOG_LEVEL).toBe('info');
    expect(envB.RE_SHELL_PROFILE).toBe('staging');
    expect(envB.PATH).toBe('/bin');
    // Applying onto an environment overrides stale values from another profile.
    applyProfileEnvironment(staging.env, envA);
    expect(envA.LOG_LEVEL).toBe('info');
    expect(envA.API_URL).toBe('https://staging.example.test');
  });

  it('resolves a profile that has no parents', async () => {
    const standalone = await resolveDevProfile('standalone');
    expect(standalone.env).toEqual({
      ONLY_HERE: '1',
      RE_SHELL_PROFILE: 'standalone',
      RE_SHELL_PROFILE_ENV: 'custom',
    });
    expect(standalone.services).toEqual([]);
  });

  it('rejects an unknown profile with an actionable, correct hint', async () => {
    const error = await resolveDevProfile('ghost').catch(e => e);

    expect(error).toBeInstanceOf(DevProfileError);
    expect(error.code).toBe('DEV_PROFILE_ERROR');
    expect(error.message).toContain('Profile "ghost" not found');
    expect(error.message).toContain('Available profiles: base, dev, loop-a, loop-b, staging, standalone');
    // The hint names the command that actually exists under `config profile`.
    expect(PROFILE_LIST_HINT).toBe('re-shell config profile list');
    expect(error.message).toContain(`Run "${PROFILE_LIST_HINT}"`);
    expect(error.message).not.toMatch(/"re-shell profile list"/);
    expect(error.details).toMatchObject({ profile: 'ghost' });
  });

  it('is an explicit error when no profiles file exists at all', async () => {
    fs.rmSync(path.join(root, 're-shell.profiles.yaml'));
    const error = await resolveDevProfile('dev').catch(e => e);
    expect(error).toBeInstanceOf(DevProfileError);
    expect(error.message).toContain('No profiles are defined');
  });

  it('reports a circular inheritance chain as a profile error', async () => {
    const error = await resolveDevProfile('loop-a').catch(e => e);
    expect(error).toBeInstanceOf(DevProfileError);
    expect(error.message).toContain('could not be resolved');
    expect(error.message).toContain('Circular profile dependency');
  });
});

describe('buildProfileEnvironment', () => {
  it('stringifies values, tags the profile, and sorts keys', () => {
    const env = buildProfileEnvironment('x', {
      name: 'x',
      environment: 'production',
      config: { env: { Z: '1', A: 2 as unknown as string }, dev: { port: 8080 } },
    });
    expect(env).toEqual({
      A: '2',
      RE_SHELL_DEV_PORT: '8080',
      RE_SHELL_PROFILE: 'x',
      RE_SHELL_PROFILE_ENV: 'production',
      Z: '1',
    });
    expect(Object.keys(env)).toEqual(['A', 'RE_SHELL_DEV_PORT', 'RE_SHELL_PROFILE', 'RE_SHELL_PROFILE_ENV', 'Z']);
  });

  it('lets the generated profile marker win over a clashing config variable', () => {
    const env = buildProfileEnvironment('real', {
      name: 'real',
      environment: 'development',
      config: { env: { RE_SHELL_PROFILE: 'spoofed' } },
    });
    expect(env.RE_SHELL_PROFILE).toBe('real');
  });
});
