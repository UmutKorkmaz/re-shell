import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import prompts from 'prompts';
import { loadProfileConfig, saveProfileConfig } from '../../src/commands/profile';
import type { EnvironmentProfile } from '../../src/commands/profile';
import {
  generateOptimizations,
  applyOptimizations,
  showOptimizationReport,
  autoOptimizeProfile,
} from '../../src/commands/profile-optimize';
import type { OptimizationReport } from '../../src/commands/profile-optimize';
import type { ProfileAnalytics } from '../../src/commands/profile-analytics';

// Covers src/commands/profile-optimize.ts (650 lines, 4 exports) against a
// REAL temp cwd: the five analyzers (performance build/dev flags, security
// secrets + production CORS, maintainability description/scripts/inheritance,
// usage insights from the analytics JSON, configuration ports + missing
// tests), report aggregation/scoring, targeted application of recommendations
// (each auto-applicable branch + manual fallbacks) and the auto-optimize
// confirmation flow. Only prompts is mocked.

vi.mock('prompts', () => ({ default: vi.fn() }));
const promptsMock = vi.mocked(prompts);

const ANALYTICS_FILE = '.re-shell/profile-analytics.json';

let tempRoot: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

function output(): string {
  return logSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

function profile(name: string, overrides: Partial<EnvironmentProfile> = {}): EnvironmentProfile {
  return {
    name,
    description: `${name} profile`,
    environment: 'development',
    config: {},
    ...overrides,
  };
}

async function stageProfile(p: EnvironmentProfile): Promise<void> {
  const config = await loadProfileConfig();
  config.profiles[p.name] = p;
  await saveProfileConfig(config);
}

async function readProfile(name: string): Promise<EnvironmentProfile> {
  return (await loadProfileConfig()).profiles[name];
}

/** Seed an analytics store so usage insights have data to chew on. */
async function seedAnalytics(profiles: ProfileAnalytics['profiles']): Promise<void> {
  await fs.ensureDir(path.join(tempRoot, '.re-shell'));
  await fs.writeJson(path.join(tempRoot, ANALYTICS_FILE), {
    version: '1.0.0',
    profiles,
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
  } satisfies ProfileAnalytics);
}

function analyticsProfile(overrides: Partial<ProfileAnalytics['profiles'][string]> = {}) {
  return {
    usageCount: 10,
    firstUsed: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
    averageSessionDuration: 600_000,
    performanceMetrics: {
      averageActivationTime: 100,
      failedActivations: 0,
      successRate: 1,
    },
    customizationCount: 0,
    errors: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-popt-'));
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempRoot);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  fs.writeFileSync(
    path.join(tempRoot, 're-shell.profiles.yaml'),
    yaml.stringify({ profiles: {} }),
    'utf8'
  );
});

afterEach(() => {
  cwdSpy.mockRestore();
  vi.restoreAllMocks();
  fs.removeSync(tempRoot);
});

describe('generateOptimizations', () => {
  it('throws for an unknown profile', async () => {
    await expect(generateOptimizations('ghost')).rejects.toThrow('Profile "ghost" not found');
  });

  it('returns an empty report for a pristine profile', async () => {
    await stageProfile(profile('dev'));

    const report = await generateOptimizations('dev');

    expect(report.profileName).toBe('dev');
    expect(report.recommendations).toEqual([]);
    expect(report.totalRecommendations).toBe(0);
    expect(report.overallScore).toBe(100);
    expect(report.optimizedAt).toBeTruthy();
  });

  it('flags missing production build optimization', async () => {
    await stageProfile(profile('prod', {
      environment: 'production',
      config: { build: { target: 'es2020' } },
    }));

    const report = await generateOptimizations('prod');
    const rec = report.recommendations.find(r => r.id === 'perf-build-optimize');

    expect(rec).toMatchObject({
      category: 'performance',
      severity: 'high',
      effort: 'easy',
    });
    expect(rec!.recommendation).toContain('build.optimize');
    expect(report.bySeverity.high).toBe(1);
    expect(report.categories.performance).toBe(1);
  });

  it('flags development minify and disabled sourcemaps', async () => {
    await stageProfile(profile('dev', {
      environment: 'development',
      config: { build: { minify: true, sourcemap: false } },
    }));

    const report = await generateOptimizations('dev');
    const ids = report.recommendations.map(r => r.id);

    expect(ids).toContain('perf-dev-minify');
    expect(ids).toContain('perf-dev-sourcemap');
  });

  it('flags disabled HMR for development dev-server configs', async () => {
    await stageProfile(profile('dev', {
      config: { dev: { port: 3000, hmr: false } },
    }));

    const report = await generateOptimizations('dev');
    expect(report.recommendations.map(r => r.id)).toContain('perf-dev-hmr');
  });

  it('flags potential secrets in env vars as critical', async () => {
    await stageProfile(profile('dev', {
      config: { env: { API_TOKEN: 'x', db_password: 'y', FINE: 'z' } },
    }));

    const report = await generateOptimizations('dev');
    const rec = report.recommendations.find(r => r.id === 'sec-secrets-in-profile');

    expect(rec!.severity).toBe('critical');
    expect(rec!.description).toContain('API_TOKEN');
    expect(rec!.description).toContain('db_password');
    expect(rec!.description).not.toContain('FINE');
  });

  it('flags wide-open CORS in production', async () => {
    await stageProfile(profile('prod', {
      environment: 'production',
      config: { dev: { cors: true } },
    }));

    const report = await generateOptimizations('prod');
    expect(report.recommendations.map(r => r.id)).toContain('sec-cors-production');
  });

  it('flags a missing description as easy maintainability work', async () => {
    await stageProfile(profile('nodesc', { description: undefined }));

    const report = await generateOptimizations('nodesc');
    const rec = report.recommendations.find(r => r.id === 'maint-description');
    expect(rec).toMatchObject({ category: 'maintainability', severity: 'low', effort: 'easy' });
  });

  it('flags oversized script tables and long inheritance chains', async () => {
    const scripts: Record<string, string> = {};
    for (let i = 0; i < 25; i++) scripts[`s${i}`] = 'echo';

    await stageProfile(profile('dev', {
      config: { scripts },
      extends: ['a', 'b', 'c', 'd'],
    }));

    const report = await generateOptimizations('dev');
    const ids = report.recommendations.map(r => r.id);
    expect(ids).toContain('maint-too-many-scripts');
    expect(ids).toContain('maint-long-inheritance');
  });

  it('maps usage insights from the analytics store into recommendations', async () => {
    await stageProfile(profile('idle'));
    await seedAnalytics({ idle: analyticsProfile({ usageCount: 0 }) });

    const report = await generateOptimizations('idle');

    const rec = report.recommendations.find(r => r.category === 'usage');
    expect(rec).toMatchObject({
      severity: 'medium', // suggestion → medium
      effort: 'medium',
    });
    expect(rec!.title).toBe('Unused Profile');
    expect(rec!.id).toBe('usage-idle-unused-profile');
  });

  it('survives a missing analytics store without usage recommendations', async () => {
    await stageProfile(profile('dev'));

    const report = await generateOptimizations('dev');

    expect(report.recommendations.filter(r => r.category === 'usage')).toEqual([]);
  });

  it('flags non-standard ports and missing production test config', async () => {
    await stageProfile(profile('prod', {
      environment: 'production',
      config: { dev: { port: 9999 } },
    }));

    const report = await generateOptimizations('prod');
    const ids = report.recommendations.map(r => r.id);

    expect(ids).toContain('config-port-recommendation');
    expect(ids).toContain('config-test-missing');
    const portRec = report.recommendations.find(r => r.id === 'config-port-recommendation')!;
    expect(portRec.recommendation).toContain('3002'); // production recommended port
  });

  it('scores by severity weight and floors at zero', async () => {
    await stageProfile(profile('dev', {
      description: undefined,
      config: { env: { MY_SECRET: 'x' } },
    }));

    const report = await generateOptimizations('dev');
    // maint-description (low, -2) + sec-secrets (critical, -20)
    expect(report.overallScore).toBe(78);
  });
});

describe('applyOptimizations', () => {
  it('does nothing when no recommendation ids match', async () => {
    await stageProfile(profile('dev'));

    await applyOptimizations('dev', ['bogus-id']);

    expect(output()).toContain('No valid recommendations to apply');
  });

  it('applies the production build optimization and persists it', async () => {
    await stageProfile(profile('prod', {
      environment: 'production',
      config: { build: { target: 'es2020' } },
    }));

    await applyOptimizations('prod', ['perf-build-optimize']);

    const text = output();
    expect(text).toContain('Applying 1 optimization(s)');
    expect(text).toContain('Enable build optimizations for production');
    expect(text).toContain('Enabled build optimization');
    expect(text).toContain('Applied 1/1 optimization(s)');
    expect((await readProfile('prod')).config.build!.optimize).toBe(true);
  });

  it('applies dev minify/sourcemap/hmr fixes in one pass', async () => {
    await stageProfile(profile('dev', {
      config: {
        build: { minify: true, sourcemap: false },
        dev: { port: 3000, hmr: false },
      },
    }));

    await applyOptimizations('dev', ['perf-dev-minify', 'perf-dev-sourcemap', 'perf-dev-hmr']);

    const stored = (await readProfile('dev')).config;
    expect(stored.build!.minify).toBe(false);
    expect(stored.build!.sourcemap).toBe(true);
    expect(stored.dev!.hmr).toBe(true);
    expect(output()).toContain('Applied 3/3 optimization(s)');
  });

  it('reports manual recommendations as skipped without saving', async () => {
    await stageProfile(profile('nodesc', { description: undefined }));

    await applyOptimizations('nodesc', ['maint-description']);

    const text = output();
    expect(text).toContain('Skipped: Requires user input');
    expect(text).toContain('Skipped: 1');
    expect(text).not.toContain('Applied');
    expect((await readProfile('nodesc')).description).toBeUndefined();
  });

  it('mixes applied and skipped recommendations', async () => {
    await stageProfile(profile('prod', {
      environment: 'production',
      description: undefined,
      config: { build: {} },
    }));

    await applyOptimizations('prod', ['perf-build-optimize', 'maint-description']);

    const text = output();
    expect(text).toContain('Applied 1/2 optimization(s)');
    expect(text).toContain('Skipped: 1');
  });
});

describe('showOptimizationReport', () => {
  it('renders score bands, category and severity summaries', async () => {
    await stageProfile(profile('prod', {
      environment: 'production',
      config: { build: {}, env: { API_KEY: 'x' } },
    }));

    await showOptimizationReport('prod');

    const text = output();
    expect(text).toContain('Optimization Report for "prod"');
    expect(text).toContain('Overall Optimization Score:');
    // perf-build-optimize (high) + sec-secrets (critical) + config-test-missing (medium)
    expect(text).toContain('Total recommendations: 3');
    expect(text).toContain('By Category:');
    expect(text).toContain('performance: 1');
    expect(text).toContain('security: 1');
    expect(text).toContain('configuration: 1');
    expect(text).toContain('By Severity:');
    expect(text).toContain('high: 1');
    expect(text).toContain('critical: 1');
    expect(text).toContain('Recommendations:');
    // critical (secrets) printed before high (build optimize)
    expect(text.indexOf('Secrets found')).toBeLessThan(text.indexOf('Enable build optimizations'));
  });

  it('celebrates a clean profile', async () => {
    await stageProfile(profile('dev'));

    await showOptimizationReport('dev');

    const text = output();
    expect(text).toContain('100/100');
    expect(text).toContain('Well optimized!');
    expect(text).toContain('No optimization recommendations!');
  });

  it('labels middling and poor scores', async () => {
    // critical(-20) + high(-10) + medium(-5) + medium(-5) = 60 → 'Room for improvement'
    await stageProfile(profile('mid', {
      environment: 'production',
      config: { build: {}, env: { API_KEY: 'x' } }, // high + critical
    }));
    // add two mediums: test-missing (medium) + usage unused-profile (medium via analytics)
    await seedAnalytics({ mid: analyticsProfile({ usageCount: 0 }) });
    await showOptimizationReport('mid');
    expect(output()).toContain('Room for improvement');

    logSpy.mockClear();
    // critical(-20) + low(-2) + high(-10) + medium(-5) + medium(-5) = 58 → 'Needs attention'
    await stageProfile(profile('bad', {
      environment: 'production',
      description: undefined,
      config: { build: {}, env: { SECRET: 'x', PASSWORD: 'y' } },
    }));
    await seedAnalytics({ bad: analyticsProfile({ usageCount: 0 }) });
    await showOptimizationReport('bad');
    expect(output()).toContain('Needs attention');
  });
});

describe('autoOptimizeProfile', () => {
  it('reports when there is nothing safe to auto-apply', async () => {
    await stageProfile(profile('dev'));

    await autoOptimizeProfile('dev');

    expect(output()).toContain('No safe automatic optimizations available');
    expect(promptsMock).not.toHaveBeenCalled();
  });

  it('applies easy non-critical optimizations after confirmation', async () => {
    await stageProfile(profile('dev', {
      config: { build: { minify: true }, dev: { port: 9999, hmr: false } },
    }));
    promptsMock.mockResolvedValueOnce({ value: true } as never);

    await autoOptimizeProfile('dev');

    const text = output();
    expect(text).toContain('Auto-optimizing "dev"');
    expect(text).toContain('safe optimization(s)');
    const stored = (await readProfile('dev')).config;
    expect(stored.build!.minify).toBe(false);
    expect(stored.dev!.hmr).toBe(true);
  });

  it('excludes critical recommendations even when easy', async () => {
    await stageProfile(profile('dev', {
      description: undefined,
      config: { env: { API_TOKEN: 'x' } },
    }));
    promptsMock.mockResolvedValueOnce({ value: true } as never);

    await autoOptimizeProfile('dev');

    // sec-secrets is critical → never auto-applied; maint-description is easy
    // but skipped by the applier. Nothing persisted.
    expect((await readProfile('dev')).config.env!.API_TOKEN).toBe('x');
  });

  it('cancels without applying when the prompt is declined', async () => {
    await stageProfile(profile('dev', {
      config: { build: { minify: true } },
    }));
    promptsMock.mockResolvedValueOnce({ value: false } as never);

    await autoOptimizeProfile('dev');

    expect(output()).toContain('Auto-optimization cancelled');
    expect((await readProfile('dev')).config.build!.minify).toBe(true);
  });
});
