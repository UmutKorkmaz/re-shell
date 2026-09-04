import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  trackProfileActivation,
  trackProfileDeactivation,
  trackProfileCustomization,
  trackProfileError,
  generateProfileInsights,
  showAnalyticsDashboard,
  showUsageStatistics,
  cleanAnalyticsData,
  ProfileAnalytics,
} from '../../src/commands/profile-analytics';

// Covers src/commands/profile-analytics.ts — the profile usage tracking
// engine (807 lines): activation/deactivation/customization/error trackers,
// the insight generator, the dashboard/statistics renderers and the retention
// cleaner. Everything runs against a REAL .re-shell/profile-analytics.json in
// a temp cwd; only console output is spied.

let tempRoot: string;
let analyticsPath: string;
let logSpy: ReturnType<typeof vi.spyOn>;

function output(): string {
  return logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
}

async function readStore(): Promise<ProfileAnalytics> {
  return fs.readJson(analyticsPath);
}

async function writeStore(analytics: Partial<ProfileAnalytics>): Promise<void> {
  await fs.writeJson(analyticsPath, {
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
    ...analytics,
  });
}

beforeEach(async () => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-profile-analytics-'));
  analyticsPath = path.join(tempRoot, '.re-shell', 'profile-analytics.json');
  // QUIRK: loadAnalytics writeFile's the store directly without creating
  // .re-shell/ — the directory must already exist.
  await fs.ensureDir(path.dirname(analyticsPath));
  const cwdSpy = vi.spyOn(process, 'cwd');
  cwdSpy.mockReturnValue(tempRoot);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.remove(tempRoot);
});

describe('profile-analytics — command', () => {
  describe('loadAnalytics bootstrap', () => {
    it('creates an empty analytics store on first use', async () => {
      await trackProfileActivation('dev');

      const store = await readStore();
      expect(store.version).toBe('1.0.0');
      expect(store.global.profilesCreated).toBe(1);
      expect(store.profiles.dev).toBeDefined();
      expect(store.lastUpdated).toBeTruthy();
    });
  });

  describe('trackProfileActivation', () => {
    it('increments usage and activation counters', async () => {
      await trackProfileActivation('dev');
      await trackProfileActivation('dev');

      const profile = (await readStore()).profiles.dev;
      expect(profile.usageCount).toBe(2);
      expect(profile.activationCount).toBe(2);
      expect(profile.lastUsed).toBeTruthy();
    });

    it('does not double-count profilesCreated for an existing profile', async () => {
      await trackProfileActivation('dev');
      await trackProfileActivation('dev');

      expect((await readStore()).global.profilesCreated).toBe(1);
    });

    it('records environment and framework metadata on both levels', async () => {
      await trackProfileActivation('dev', {
        environment: 'development',
        framework: 'react',
      });
      await trackProfileActivation('dev', { framework: 'react' });

      const store = await readStore();
      expect(store.profiles.dev.environments).toEqual({ development: 1 });
      expect(store.profiles.dev.frameworks).toEqual({ react: 2 });
      expect(store.global.environmentUsage).toEqual({ development: 1 });
      expect(store.global.frameworkUsage).toEqual({ react: 2 });
      expect(store.global.totalActivations).toBe(2);
    });

    it('updates mostUsedProfile as usage shifts', async () => {
      await trackProfileActivation('a');
      await trackProfileActivation('a');
      await trackProfileActivation('b');

      expect((await readStore()).global.mostUsedProfile).toBe('a');
    });
  });

  describe('trackProfileDeactivation', () => {
    it('accumulates session time and recomputes averages', async () => {
      await trackProfileActivation('dev');
      await trackProfileDeactivation('dev', 60_000);

      const store = await readStore();
      expect(store.profiles.dev.deactivationCount).toBe(1);
      expect(store.profiles.dev.totalDuration).toBe(60_000);
      // averageSessionDuration = totalDuration / usageCount (1 activation).
      expect(store.profiles.dev.averageSessionDuration).toBe(60_000);
      expect(store.global.totalSessionTime).toBe(60_000);
    });

    it('tracks the longest session across profiles', async () => {
      await trackProfileActivation('a');
      await trackProfileActivation('b');
      await trackProfileDeactivation('a', 30_000);
      await trackProfileDeactivation('b', 90_000);

      const store = await readStore();
      expect(store.global.longestSession).toEqual({
        profile: 'b',
        duration: 90_000,
      });
    });

    it('keeps the earlier longest session when a shorter one follows', async () => {
      await trackProfileActivation('a');
      await trackProfileActivation('b');
      await trackProfileDeactivation('b', 90_000);
      await trackProfileDeactivation('a', 30_000);

      expect((await readStore()).global.longestSession.duration).toBe(90_000);
    });

    it('is a no-op for an untracked profile', async () => {
      await writeStore({});
      await trackProfileDeactivation('ghost', 10_000);

      const store = await readStore();
      expect(store.profiles.ghost).toBeUndefined();
      expect(store.global.totalSessionTime).toBe(0);
    });
  });

  describe('trackProfileCustomization', () => {
    it('counts changes and applies the customized tag once', async () => {
      await trackProfileActivation('dev');
      await trackProfileCustomization('dev', ['port', 'env']);
      await trackProfileCustomization('dev', ['build']);

      const profile = (await readStore()).profiles.dev;
      expect(profile.customizationCount).toBe(3);
      expect(profile.tags).toEqual(['customized']);
    });

    it('is a no-op for an untracked profile', async () => {
      await writeStore({});
      await trackProfileCustomization('ghost', ['port']);

      expect((await readStore()).profiles.ghost).toBeUndefined();
    });
  });

  describe('trackProfileError', () => {
    it('appends an unresolved error event', async () => {
      await trackProfileActivation('dev');
      await trackProfileError('dev', 'validation failed', 'switchProfile');

      const profile = (await readStore()).profiles.dev;
      expect(profile.errors).toHaveLength(1);
      expect(profile.errors[0]).toMatchObject({
        error: 'validation failed',
        context: 'switchProfile',
        resolved: false,
      });
      expect(profile.errors[0].timestamp).toBeTruthy();
    });

    it('is a no-op for an untracked profile', async () => {
      await writeStore({});
      await trackProfileError('ghost', 'boom', 'ctx');

      expect((await readStore()).profiles.ghost).toBeUndefined();
    });
  });

  describe('generateProfileInsights — profile-scoped', () => {
    it('returns a Profile Not Found warning for unknown profiles', async () => {
      await writeStore({});

      const insights = await generateProfileInsights('ghost');
      expect(insights).toHaveLength(1);
      expect(insights[0]).toMatchObject({
        type: 'warning',
        severity: 'warning',
        title: 'Profile Not Found',
      });
    });

    it('flags unused profiles', async () => {
      await trackProfileActivation('dormant');
      // Manually zero the usage — activation itself counts as one use.
      const store = await readStore();
      store.profiles.dormant.usageCount = 0;
      await fs.writeJson(analyticsPath, store);

      const insights = await generateProfileInsights('dormant');
      expect(insights.some((i) => i.title === 'Unused Profile')).toBe(true);
    });

    it('flags low usage below five activations', async () => {
      await trackProfileActivation('light');

      const insights = await generateProfileInsights('light');
      const lowUsage = insights.find((i) => i.title === 'Low Usage Profile');
      expect(lowUsage?.description).toContain('used only 1 times');
    });

    it('raises a critical insight for failed activations', async () => {
      await trackProfileActivation('flaky');
      const store = await readStore();
      store.profiles.flaky.performanceMetrics.failedActivations = 3;
      await fs.writeJson(analyticsPath, store);

      const insights = await generateProfileInsights('flaky');
      const failures = insights.find(
        (i) => i.title === 'Activation Failures Detected'
      );
      expect(failures).toMatchObject({ type: 'performance', severity: 'critical' });
      expect(failures?.description).toContain('3 failed activation(s)');
    });

    it('flags short sessions under one minute', async () => {
      await trackProfileActivation('quick');
      await trackProfileDeactivation('quick', 5_000);

      const insights = await generateProfileInsights('quick');
      expect(insights.some((i) => i.title === 'Short Sessions')).toBe(true);
    });

    it('suggests a template for heavily customized profiles', async () => {
      await trackProfileActivation('tweaked');
      const store = await readStore();
      store.profiles.tweaked.customizationCount = 12;
      await fs.writeJson(analyticsPath, store);

      const insights = await generateProfileInsights('tweaked');
      expect(
        insights.some((i) => i.title === 'Heavily Customized Profile')
      ).toBe(true);
    });

    it('warns about unresolved errors from the last 7 days', async () => {
      await trackProfileActivation('broken');
      const store = await readStore();
      store.profiles.broken.errors = [
        {
          timestamp: new Date().toISOString(),
          error: 'config parse failed',
          context: 'activate',
          resolved: false,
        },
        {
          // Old + resolved entries must not trigger the warning.
          timestamp: new Date(Date.now() - 30 * 86400_000).toISOString(),
          error: 'legacy error',
          context: 'activate',
          resolved: true,
        },
      ];
      await fs.writeJson(analyticsPath, store);

      const insights = await generateProfileInsights('broken');
      const recent = insights.find(
        (i) => i.title === 'Recent Unresolved Errors'
      );
      expect(recent?.description).toContain('1 unresolved error(s)');
    });

    it('returns no insights for a healthy, well-used profile', async () => {
      for (let i = 0; i < 6; i++) {
        await trackProfileActivation('steady');
      }
      await trackProfileDeactivation('steady', 10 * 60_000);

      const insights = await generateProfileInsights('steady');
      expect(insights).toHaveLength(0);
    });
  });

  describe('generateProfileInsights — global', () => {
    it('suggests activating profiles when nothing is tracked', async () => {
      await writeStore({});

      const insights = await generateProfileInsights();
      expect(insights).toHaveLength(1);
      expect(insights[0].title).toBe('No Profiles Tracked');
    });

    it('flags profile sprawl above ten tracked profiles', async () => {
      for (let i = 1; i <= 11; i++) {
        await trackProfileActivation(`p${i}`);
      }

      const insights = await generateProfileInsights();
      const many = insights.find((i) => i.title === 'Many Profiles Detected');
      expect(many?.description).toContain('11 profiles');
    });

    it('notes the most used profile', async () => {
      await trackProfileActivation('favorite');
      await trackProfileActivation('favorite');
      await trackProfileActivation('other');

      const insights = await generateProfileInsights();
      const mostUsed = insights.find((i) => i.title === 'Most Used Profile');
      expect(mostUsed?.description).toContain('"favorite"');
      expect(mostUsed?.description).toContain('2 times');
    });

    it('flags multi-framework usage above five frameworks', async () => {
      const frameworks = ['react', 'vue', 'svelte', 'angular', 'solid', 'vanilla'];
      for (let i = 0; i < frameworks.length; i++) {
        await trackProfileActivation(`p${i}`, { framework: frameworks[i] });
      }

      const insights = await generateProfileInsights();
      const multi = insights.find((i) => i.title === 'Multi-Framework Usage');
      expect(multi?.description).toContain('6 different frameworks');
    });

    it('flags long average sessions above four hours', async () => {
      await trackProfileActivation('marathon');
      await trackProfileDeactivation('marathon', 5 * 60 * 60 * 1000);

      const insights = await generateProfileInsights();
      expect(
        insights.some((i) => i.title === 'Long Development Sessions')
      ).toBe(true);
    });
  });

  describe('showAnalyticsDashboard', () => {
    it('renders global statistics with framework and environment usage', async () => {
      await trackProfileActivation('dev', {
        environment: 'development',
        framework: 'react',
      });

      await showAnalyticsDashboard();

      const text = output();
      expect(text).toContain('Profile Analytics Dashboard');
      expect(text).toContain('Global Statistics:');
      expect(text).toContain('Tracked profiles: 1');
      expect(text).toContain('Framework Usage:');
      expect(text).toContain('react: 1');
      expect(text).toContain('Environment Usage:');
      expect(text).toContain('development: 1');
    });

    it('renders per-profile statistics', async () => {
      await trackProfileActivation('dev', { framework: 'react' });
      await trackProfileDeactivation('dev', 90_000);

      await showAnalyticsDashboard('dev');

      const text = output();
      expect(text).toContain('Profile: dev');
      expect(text).toContain('Total activations: 1');
      expect(text).toContain('Total deactivations: 1');
      expect(text).toContain('Total session time: 1m 30s');
      expect(text).toContain('Timeline:');
    });

    it('renders the most used profile section in the global view', async () => {
      await trackProfileActivation('dev', { framework: 'react' });

      await showAnalyticsDashboard();

      const text = output();
      expect(text).toContain('Most Used Profile:');
      expect(text).toContain('dev (1 uses)');
    });

    it('warns when the requested profile has no data', async () => {
      await writeStore({});

      await showAnalyticsDashboard('ghost');

      expect(output()).toContain('No analytics data for profile "ghost"');
    });

    it('renders generated insights with recommendations', async () => {
      await writeStore({});

      await showAnalyticsDashboard();

      const text = output();
      expect(text).toContain('Insights & Recommendations');
      expect(text).toContain('No Profiles Tracked');
      expect(text).toContain('Activate profiles to start tracking usage');
    });

    it('renders profile errors and tags in the profile view', async () => {
      await trackProfileActivation('dev');
      await trackProfileError('dev', 'config parse failed', 'activate');
      await trackProfileCustomization('dev', ['port']);

      await showAnalyticsDashboard('dev');

      const text = output();
      expect(text).toContain('Errors (1):');
      expect(text).toContain('config parse failed');
      expect(text).toContain('Tags:');
      expect(text).toContain('customized');
    });
  });

  describe('showUsageStatistics', () => {
    it('warns when there is no usage data', async () => {
      await writeStore({});

      await showUsageStatistics();

      expect(output()).toContain('No usage data available');
    });

    it('renders a table sorted by name by default', async () => {
      await trackProfileActivation('zeta');
      await trackProfileActivation('alpha');

      await showUsageStatistics();

      const text = output();
      expect(text).toContain('Profile Usage Statistics');
      expect(text.indexOf('alpha')).toBeLessThan(text.indexOf('zeta'));
    });

    it('sorts by usage count descending', async () => {
      await trackProfileActivation('quiet');
      await trackProfileActivation('busy');
      await trackProfileActivation('busy');

      await showUsageStatistics({ sortBy: 'usage' });

      const text = output();
      expect(text.indexOf('busy')).toBeLessThan(text.indexOf('quiet'));
    });

    it('sorts by total duration descending', async () => {
      await trackProfileActivation('short');
      await trackProfileActivation('long');
      await trackProfileDeactivation('short', 10_000);
      await trackProfileDeactivation('long', 500_000);

      await showUsageStatistics({ sortBy: 'duration' });

      const text = output();
      expect(text.indexOf('long')).toBeLessThan(text.indexOf('short'));
    });

    it('applies the limit to the rendered set', async () => {
      await trackProfileActivation('a');
      await trackProfileActivation('b');
      await trackProfileActivation('c');

      await showUsageStatistics({ limit: 2, format: 'json' });

      // QUIRK: the header banner is logged BEFORE the JSON payload — parse
      // the last console.log call, not the whole output.
      const payload = JSON.parse(logSpy.mock.calls.at(-1)![0]);
      expect(payload).toHaveLength(2);
    });

    it('emits a JSON array with profile names merged in', async () => {
      await trackProfileActivation('dev');

      await showUsageStatistics({ format: 'json' });

      const payload = JSON.parse(logSpy.mock.calls.at(-1)![0]);
      expect(payload[0].name).toBe('dev');
      expect(payload[0].usageCount).toBe(1);
    });
  });

  describe('cleanAnalyticsData', () => {
    it('removes unused profiles older than the retention window', async () => {
      await writeStore({
        profiles: {
          stale: {
            profileName: 'stale',
            createdAt: new Date(Date.now() - 120 * 86400_000).toISOString(),
            lastUsed: new Date(Date.now() - 120 * 86400_000).toISOString(),
            usageCount: 0,
            totalDuration: 0,
            averageSessionDuration: 0,
            activationCount: 0,
            deactivationCount: 0,
            customizationCount: 0,
            environments: {},
            frameworks: {},
            errors: [],
            performanceMetrics: {
              averageActivationTime: 0,
              averageDeactivationTime: 0,
              slowestActivation: { time: 0, date: '' },
              failedActivations: 0,
            },
            tags: [],
          } as never,
        },
      });

      await cleanAnalyticsData(90);

      expect((await readStore()).profiles.stale).toBeUndefined();
      expect(output()).toContain('Cleaned 1 old records');
    });

    it('prunes old error entries but keeps used profiles', async () => {
      await trackProfileActivation('dev');
      const store = await readStore();
      store.profiles.dev.errors = [
        {
          timestamp: new Date(Date.now() - 120 * 86400_000).toISOString(),
          error: 'ancient',
          context: 'activate',
          resolved: false,
        },
        {
          timestamp: new Date().toISOString(),
          error: 'fresh',
          context: 'activate',
          resolved: false,
        },
      ];
      await fs.writeJson(analyticsPath, store);

      await cleanAnalyticsData(90);

      const profile = (await readStore()).profiles.dev;
      expect(profile).toBeDefined();
      expect(profile.errors.map((e) => e.error)).toEqual(['fresh']);
      expect(output()).toContain('Cleaned 1 old records');
    });

    it('keeps old profiles that were used at least once', async () => {
      await writeStore({
        profiles: {
          veteran: {
            profileName: 'veteran',
            createdAt: new Date(Date.now() - 120 * 86400_000).toISOString(),
            lastUsed: new Date(Date.now() - 120 * 86400_000).toISOString(),
            usageCount: 7,
            totalDuration: 0,
            averageSessionDuration: 0,
            activationCount: 7,
            deactivationCount: 0,
            customizationCount: 0,
            environments: {},
            frameworks: {},
            errors: [],
            performanceMetrics: {
              averageActivationTime: 0,
              averageDeactivationTime: 0,
              slowestActivation: { time: 0, date: '' },
              failedActivations: 0,
            },
            tags: [],
          } as never,
        },
      });

      await cleanAnalyticsData(90);

      expect((await readStore()).profiles.veteran).toBeDefined();
      expect(output()).toContain('No old records to clean');
    });

    it('reports nothing to clean for a fresh store', async () => {
      await trackProfileActivation('dev');

      await cleanAnalyticsData();

      expect(output()).toContain('No old records to clean');
    });
  });
});
