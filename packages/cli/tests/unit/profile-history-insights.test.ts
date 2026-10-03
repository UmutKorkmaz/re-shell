import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'yaml';
import { switchProfile, deactivateProfile } from '../../src/commands/profile';
import type { EnvironmentProfile, ProfileConfig } from '../../src/commands/profile';
import {
  buildProfileInsightsReport,
  cleanAnalyticsData,
  generateProfileInsights,
  getProfileDataSource,
  trackProfileActivation,
  trackProfileActivationFailure,
  MAX_PROFILE_EVENTS,
  type ProfileAnalytics,
} from '../../src/commands/profile-analytics';
import { buildOptimizationResponse, generateOptimizations } from '../../src/commands/profile-optimize';
import { profileInsightsResponseSchema, profileOptimizationResponseSchema } from '@re-shell/contracts';

/**
 * Profile insights/optimization must come from REAL recorded activation
 * history. Before R-1b the trackers existed but nothing ever called them, so
 * every insight was computed from an always-empty store.
 */
let root: string;
const analyticsFile = () => path.join(root, '.re-shell', 'profile-analytics.json');
const readStore = (): Promise<ProfileAnalytics> => fs.readJson(analyticsFile());

const profile = (name: string, extra: Partial<EnvironmentProfile> = {}): EnvironmentProfile => ({
  name,
  description: `${name} profile`,
  environment: 'development',
  framework: 'react',
  config: { dev: { port: 3000, hmr: true }, env: { NODE_ENV: 'development' } },
  ...extra,
});

async function stage(config: ProfileConfig): Promise<void> {
  await fs.writeFile(path.join(root, 're-shell.profiles.yaml'), yaml.stringify(config), 'utf8');
}

/** A complete analytics file for tests that hand-seed history. */
async function seed(partial: Partial<ProfileAnalytics>): Promise<void> {
  await fs.ensureDir(path.dirname(analyticsFile()));
  await fs.writeJson(analyticsFile(), {
    version: '1.0.0',
    profiles: {},
    global: {
      totalActivations: 0,
      totalSessionTime: 0,
      mostUsedProfile: '',
      longestSession: { profile: '', duration: 0 },
      averageSessionDuration: 0,
      profilesCreated: 0,
      profilesDeleted: 0,
      frameworkUsage: {},
      environmentUsage: {},
    },
    lastUpdated: new Date().toISOString(),
    ...partial,
  });
}

const usage = (name: string, over: Record<string, unknown> = {}) => ({
  profileName: name,
  createdAt: new Date().toISOString(),
  lastUsed: new Date().toISOString(),
  usageCount: 10,
  totalDuration: 10 * 600_000,
  averageSessionDuration: 600_000,
  activationCount: 10,
  deactivationCount: 10,
  customizationCount: 0,
  environments: {},
  frameworks: {},
  errors: [],
  performanceMetrics: { averageActivationTime: 0, averageDeactivationTime: 0, slowestActivation: { time: 0, date: '' }, failedActivations: 0 },
  tags: [],
  ...over,
});

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-history-'));
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  fs.removeSync(root);
});

describe('activation history is recorded by the profile system', () => {
  it('switchProfile records an activation with environment, framework and measured duration', async () => {
    await stage({ profiles: { dev: profile('dev') } });
    const result = await switchProfile('dev');
    expect(result.success).toBe(true);
    expect(result.warnings.filter(w => w.includes('analytics'))).toEqual([]);

    const store = await readStore();
    expect(store.profiles.dev).toMatchObject({ usageCount: 1, activationCount: 1, environments: { development: 1 }, frameworks: { react: 1 } });
    expect(store.profiles.dev.performanceMetrics.timedActivations).toBe(1);
    expect(store.events).toHaveLength(1);
    expect(store.events![0]).toMatchObject({ type: 'activate', profile: 'dev', environment: 'development', framework: 'react' });
    expect(store.events![0].activationMs).toBeGreaterThanOrEqual(0);
    expect(Date.parse(store.events![0].at)).not.toBeNaN();
  });

  it('deactivation records the real session length measured from the persisted activation time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-01T10:00:00Z'));
    await stage({ profiles: { dev: profile('dev') } });
    await switchProfile('dev');
    vi.setSystemTime(new Date('2026-03-01T10:01:30Z'));
    await deactivateProfile('dev');

    const store = await readStore();
    const deactivate = store.events!.find(e => e.type === 'deactivate')!;
    expect(deactivate).toMatchObject({ profile: 'dev', sessionMs: 90_000 });
    expect(store.profiles.dev).toMatchObject({ deactivationCount: 1, totalDuration: 90_000, averageSessionDuration: 90_000 });
    expect(store.global.totalSessionTime).toBe(90_000);
  });

  it('switching profiles ends the previous session and starts the next', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-01T10:00:00Z'));
    await stage({ profiles: { a: profile('a'), b: profile('b', { environment: 'staging', framework: 'vue' }) } });
    await switchProfile('a');
    vi.setSystemTime(new Date('2026-03-01T10:05:00Z'));
    await switchProfile('b');

    const types = (await readStore()).events!.map(e => `${e.type}:${e.profile}`);
    expect(types).toEqual(['activate:a', 'deactivate:a', 'activate:b']);
    const store = await readStore();
    expect(store.profiles.a.totalDuration).toBe(300_000);
    expect(store.profiles.b.environments).toEqual({ staging: 1 });
    expect(store.global.frameworkUsage).toEqual({ react: 1, vue: 1 });
  });

  it('records a failed activation (validation errors) and does not record unknown profiles', async () => {
    await stage({
      profiles: {
        broken: profile('broken', { extends: ['ghost'] }), // inherits from a profile that does not exist
      },
    });
    const failed = await switchProfile('broken');
    expect(failed.success).toBe(false);
    const store = await readStore();
    expect(store.profiles.broken.performanceMetrics.failedActivations).toBe(1);
    expect(store.events![0]).toMatchObject({ type: 'activation-failed', profile: 'broken' });
    expect(store.events![0].error).toBeTruthy();
    expect(store.profiles.broken.errors[0]).toMatchObject({ resolved: false, context: 'activate' });

    const unknown = await switchProfile('nope');
    expect(unknown.success).toBe(false);
    expect((await readStore()).profiles.nope).toBeUndefined();
  });

  it('keeps the event history bounded and prunes it with the retention cleaner', async () => {
    const old = new Date(Date.now() - 200 * 86_400_000).toISOString();
    const events = Array.from({ length: MAX_PROFILE_EVENTS }, (_, i) => ({ type: 'activate' as const, profile: 'p', at: old, activationMs: i }));
    await seed({ events, profiles: { p: usage('p') } });
    await trackProfileActivation('p', { activationTime: 5 });
    const store = await readStore();
    expect(store.events).toHaveLength(MAX_PROFILE_EVENTS);
    expect(store.events![store.events!.length - 1].activationMs).toBe(5);

    await cleanAnalyticsData(90);
    const after = await readStore();
    expect(after.events).toHaveLength(1); // everything older than 90 days is pruned
  });

  it('reading insights never creates the analytics file', async () => {
    await stage({ profiles: { dev: profile('dev') } });
    await generateProfileInsights();
    await getProfileDataSource();
    expect(await fs.pathExists(analyticsFile())).toBe(false);
  });
});

describe('insights are computed from the recorded history', () => {
  it('flags a stale profile with the data it was computed from', async () => {
    const lastUsed = new Date(Date.now() - 100 * 86_400_000).toISOString();
    await seed({ profiles: { old: usage('old', { lastUsed, usageCount: 12 }) } });
    const insight = (await generateProfileInsights('old')).find(i => i.title === 'Stale Profile')!;
    expect(insight.description).toMatch(/last activated 100 days ago/);
    expect(insight.evidence).toEqual([`lastUsed=${lastUsed}`, 'usageCount=12']);
  });

  it('reports an unreliable profile from the failure rate across real attempts, quoting the errors', async () => {
    const at = new Date().toISOString();
    await seed({
      profiles: { flaky: usage('flaky', { performanceMetrics: { averageActivationTime: 0, averageDeactivationTime: 0, slowestActivation: { time: 0, date: '' }, failedActivations: 2 } }) },
      events: [
        { type: 'activate', profile: 'flaky', at },
        { type: 'activation-failed', profile: 'flaky', at, error: 'port 3000 in use' },
        { type: 'activate', profile: 'flaky', at },
        { type: 'activation-failed', profile: 'flaky', at, error: 'missing env file' },
      ],
    });
    const insight = (await generateProfileInsights('flaky')).find(i => i.title === 'Unreliable Activation')!;
    expect(insight).toMatchObject({ type: 'performance', severity: 'warning' });
    expect(insight.description).toContain('2 of 4 recorded activation attempts failed (50%)');
    expect(insight.evidence).toEqual(['error: port 3000 in use', 'error: missing env file']);
  });

  it('does not call a profile unreliable on too little data', async () => {
    const at = new Date().toISOString();
    await seed({
      profiles: { fresh: usage('fresh', { usageCount: 6 }) },
      events: [{ type: 'activation-failed', profile: 'fresh', at, error: 'x' }, { type: 'activate', profile: 'fresh', at }],
    });
    expect((await generateProfileInsights('fresh')).some(i => i.title === 'Unreliable Activation')).toBe(false);
  });

  it('diagnoses slow activation using measured timings and the profile definition', async () => {
    await stage({
      profiles: {
        base: profile('base'),
        mid: profile('mid', { extends: ['base'] }),
        slow: profile('slow', { extends: ['mid'], config: { env: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`K${i}`, 'v'])) } }),
      },
    });
    await seed({
      profiles: {
        slow: usage('slow', { usageCount: 8, performanceMetrics: { averageActivationTime: 2500, averageDeactivationTime: 0, slowestActivation: { time: 4100, date: '' }, failedActivations: 0, timedActivations: 5 } }),
      },
    });
    const insight = (await generateProfileInsights('slow')).find(i => i.title === 'Slow Activation')!;
    expect(insight.description).toContain('2500ms on average (slowest 4100ms)');
    expect(insight.recommendation).toMatch(/flatten the 2-level inheritance chain/);
    expect(insight.recommendation).toMatch(/reduce the 60 environment variables/);
    expect(insight.evidence).toEqual(expect.arrayContaining(['inheritanceDepth=2', 'envVariables=60']));
  });

  it('does not report slow activation without enough measured timings', async () => {
    await seed({ profiles: { quick: usage('quick', { usageCount: 8, performanceMetrics: { averageActivationTime: 9000, averageDeactivationTime: 0, slowestActivation: { time: 9000, date: '' }, failedActivations: 0, timedActivations: 1 } }) } });
    expect((await generateProfileInsights('quick')).some(i => i.title === 'Slow Activation')).toBe(false);
  });

  it('notices frequent switching from the last 24 hours of events', async () => {
    const events = Array.from({ length: 11 }, () => ({ type: 'activate' as const, profile: 'busy', at: new Date().toISOString() }));
    await seed({ profiles: { busy: usage('busy', { usageCount: 11 }) }, events });
    const insight = (await generateProfileInsights('busy')).find(i => i.title === 'Frequent Profile Switching')!;
    expect(insight.evidence).toEqual(['activations(last24h)=11']);
  });

  it('global: lists defined-but-never-activated profiles from the definitions', async () => {
    await stage({ profiles: { used: profile('used'), idle1: profile('idle1'), idle2: profile('idle2') } });
    await seed({
      profiles: { used: usage('used', { usageCount: 3, activationCount: 3 }) },
      global: { totalActivations: 3, totalSessionTime: 0, mostUsedProfile: 'used', longestSession: { profile: '', duration: 0 }, averageSessionDuration: 0, profilesCreated: 1, profilesDeleted: 0, frameworkUsage: {}, environmentUsage: {} },
    });
    const insight = (await generateProfileInsights()).find(i => i.title === 'Profiles Never Activated')!;
    expect(insight.description).toContain('2 of 3 defined profile(s)');
    expect(insight.description).toContain('idle1, idle2');
    expect(insight.evidence).toEqual(['defined, no recorded activation: idle1', 'defined, no recorded activation: idle2']);
  });

  it('global: usage dominated by one profile, and no recent activity', async () => {
    const longAgo = new Date(Date.now() - 45 * 86_400_000).toISOString();
    await seed({
      profiles: { main: usage('main', { activationCount: 18 }), other: usage('other', { activationCount: 2 }) },
      global: { totalActivations: 20, totalSessionTime: 0, mostUsedProfile: 'main', longestSession: { profile: '', duration: 0 }, averageSessionDuration: 0, profilesCreated: 2, profilesDeleted: 0, frameworkUsage: {}, environmentUsage: {} },
      events: [{ type: 'activate', profile: 'main', at: longAgo }],
    });
    const titles = (await generateProfileInsights()).map(i => i.title);
    expect(titles).toContain('Usage Dominated By One Profile');
    expect(titles).toContain('No Recent Profile Activity');
  });

  it('end to end: a real activation produces real history that the report exposes', async () => {
    await stage({ profiles: { dev: profile('dev') } });
    expect((await getProfileDataSource()).empty).toBe(true);
    await switchProfile('dev');
    const report = await buildProfileInsightsReport('dev');
    expect(report.dataSource).toMatchObject({ file: '.re-shell/profile-analytics.json', events: 1, profilesTracked: 1, empty: false });
    expect(profileInsightsResponseSchema.safeParse(report).success).toBe(true);
  });

  it('a failed-activation tracker call creates the profile record on first sight', async () => {
    await trackProfileActivationFailure('new', 'boom', { activationTime: 12 });
    const store = await readStore();
    expect(store.global.profilesCreated).toBe(1);
    expect(store.events![0]).toMatchObject({ type: 'activation-failed', activationMs: 12, error: 'boom' });
  });
});

describe('optimize uses recorded data and makes no unmeasured claims', () => {
  it('config-derived recommendations carry no fabricated savings figures', async () => {
    await stage({
      profiles: {
        prod: profile('prod', { environment: 'production', config: { build: { optimize: false }, dev: { cors: true, port: 9999 } } }),
        dev: profile('dev', { config: { build: { minify: true, sourcemap: false }, dev: { hmr: false } } }),
      },
    });
    for (const name of ['prod', 'dev']) {
      const report = await generateOptimizations(name);
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.filter(r => r.estimatedSavings !== undefined)).toEqual([]);
    }
  });

  it('turns recorded performance history into recommendations alongside usage ones', async () => {
    await stage({ profiles: { slow: profile('slow') } });
    await seed({
      profiles: { slow: usage('slow', { usageCount: 8, performanceMetrics: { averageActivationTime: 3000, averageDeactivationTime: 0, slowestActivation: { time: 5000, date: '' }, failedActivations: 0, timedActivations: 4 } }) },
    });
    const report = await generateOptimizations('slow');
    const rec = report.recommendations.find(r => r.id === 'usage-slow-slow-activation')!;
    expect(rec).toMatchObject({ category: 'performance', severity: 'medium' });
    expect(rec.description).toContain('averageActivationTime=3000ms over 4 timed activations');
  });

  it('the JSON response validates against the contract and states whether any history exists', async () => {
    await stage({ profiles: { dev: profile('dev', { description: undefined }) } });
    const empty = await buildOptimizationResponse('dev');
    expect(profileOptimizationResponseSchema.safeParse(empty).success).toBe(true);
    expect(empty.dataSource.empty).toBe(true);
    expect(empty.recommendations.map(r => r.id)).toContain('maint-description');

    await switchProfile('dev');
    expect((await buildOptimizationResponse('dev')).dataSource.empty).toBe(false);
  });
});
