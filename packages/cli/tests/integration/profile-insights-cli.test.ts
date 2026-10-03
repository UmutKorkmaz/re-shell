import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  jsonResponseSchema,
  profileInsightsResponseSchema,
  profileOptimizationResponseSchema,
} from '@re-shell/contracts';

/**
 * Real pipeline through the built CLI: `config profile activate` records
 * activation history, and `config profile insights|optimize --json` are
 * computed from it.
 */
const CLI = path.resolve(process.cwd(), 'dist/index.js');
let ws: string;

function run(args: string[]) {
  const res = spawnSync(process.execPath, [CLI, ...args], {
    cwd: ws,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', RE_SHELL_AUDIT: '0' },
  });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

beforeEach(() => {
  ws = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-cli-'));
  fs.writeFileSync(path.join(ws, 'package.json'), JSON.stringify({ name: 'w', private: true }));
  fs.writeFileSync(
    path.join(ws, 're-shell.profiles.yaml'),
    [
      'profiles:',
      '  dev:',
      '    name: dev',
      '    environment: development',
      '    framework: react',
      '    config:',
      '      env:',
      '        NODE_ENV: development',
      '  idle:',
      '    name: idle',
      '    environment: staging',
      '    config: {}',
      '',
    ].join('\n')
  );
});
afterEach(() => {
  fs.rmSync(ws, { recursive: true, force: true });
});

describe('profile insights / optimize from real activation history', () => {
  it('before any activation: says so explicitly, and still reports configuration-derived insights', () => {
    const r = run(['config', 'profile', 'insights', '--json']);
    expect(r.status).toBe(0);
    const parsed = jsonResponseSchema(profileInsightsResponseSchema).parse(JSON.parse(r.stdout));
    if (!parsed.ok) throw new Error('expected ok');
    expect(parsed.data.dataSource).toMatchObject({ events: 0, empty: true });
    expect(parsed.data.insights.map(i => i.title)).toContain('Profiles Never Activated');
    // reading must not create the analytics file
    expect(fs.existsSync(path.join(ws, '.re-shell', 'profile-analytics.json'))).toBe(false);

    const human = run(['config', 'profile', 'insights']);
    expect(human.stdout).toMatch(/No profile activation history has been recorded yet/);
  });

  it('activating a profile records history that the insights are then computed from', () => {
    const activate = run(['config', 'profile', 'activate', 'dev']);
    expect(activate.status).toBe(0);

    const file = path.join(ws, '.re-shell', 'profile-analytics.json');
    const store = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({ type: 'activate', profile: 'dev', environment: 'development', framework: 'react' });
    expect(store.profiles.dev.activationCount).toBe(1);

    const r = run(['config', 'profile', 'insights', '--json']);
    const parsed = jsonResponseSchema(profileInsightsResponseSchema).parse(JSON.parse(r.stdout));
    if (!parsed.ok) throw new Error('expected ok');
    expect(parsed.data.dataSource).toMatchObject({ events: 1, profilesTracked: 1, empty: false });
    const never = parsed.data.insights.find(i => i.title === 'Profiles Never Activated')!;
    expect(never.description).toContain('idle'); // dev was activated, idle was not
    expect(never.description).not.toContain('dev,');

    const scoped = jsonResponseSchema(profileInsightsResponseSchema).parse(JSON.parse(run(['config', 'profile', 'insights', 'dev', '--json']).stdout));
    if (!scoped.ok) throw new Error('expected ok');
    expect(scoped.data.profile).toBe('dev');
    expect(scoped.data.insights.some(i => i.title === 'Low Usage Profile')).toBe(true);
  });

  it('deactivating records the session end', () => {
    run(['config', 'profile', 'activate', 'dev']);
    expect(run(['config', 'profile', 'deactivate']).status).toBe(0);
    const store = JSON.parse(fs.readFileSync(path.join(ws, '.re-shell', 'profile-analytics.json'), 'utf8'));
    expect(store.events.map((e: { type: string }) => e.type)).toEqual(['activate', 'deactivate']);
    expect(store.events[1].sessionMs).toBeGreaterThanOrEqual(0);
    expect(store.profiles.dev.deactivationCount).toBe(1);
  });

  it('optimize --json validates against the contract and reports the data source', () => {
    const r = run(['config', 'profile', 'optimize', 'dev', '--json']);
    expect(r.status).toBe(0);
    const parsed = jsonResponseSchema(profileOptimizationResponseSchema).parse(JSON.parse(r.stdout));
    if (!parsed.ok) throw new Error('expected ok');
    expect(parsed.data.profileName).toBe('dev');
    expect(parsed.data.dataSource.empty).toBe(true);
    expect(parsed.data.recommendations.map(x => x.id)).toContain('maint-description');
  });

  it('optimize --json rejects --apply/--auto and unknown profiles with PROFILE_ERROR', () => {
    const combined = run(['config', 'profile', 'optimize', 'dev', '--json', '--auto']);
    expect(combined.status).not.toBe(0);
    expect(JSON.parse(combined.stdout)).toMatchObject({ ok: false, error: { code: 'PROFILE_ERROR' } });

    const unknown = run(['config', 'profile', 'optimize', 'ghost', '--json']);
    expect(unknown.status).not.toBe(0);
    expect(JSON.parse(unknown.stdout)).toMatchObject({ ok: false, error: { code: 'PROFILE_ERROR', message: expect.stringContaining('ghost') } });
  });
});
