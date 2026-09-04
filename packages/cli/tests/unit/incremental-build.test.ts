import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fsReal from 'fs';
import * as path from 'path';
import * as os from 'os';
import { manageIncrementalBuild } from '../../src/commands/incremental-build';
import { ValidationError } from '../../src/utils/error-handler';

// Covers src/commands/incremental-build.ts — the `incremental-build` command
// (build / plan / stats / clear-cache dispatch). The IncrementalBuilder engine
// is mocked (its own coverage lives with the util); fs.pathExists reads a REAL
// temp project dir so the package.json precheck is exercised honestly, and
// --output writes land in the same temp dir.

const mocks = vi.hoisted(() => ({
  createIncrementalBuilder: vi.fn(),
  createBuildPlan: vi.fn(),
  executeBuildPlan: vi.fn(),
  getBuildStats: vi.fn(),
  clearCache: vi.fn(),
}));

vi.mock('../../src/utils/incremental-builder', () => ({
  createIncrementalBuilder: mocks.createIncrementalBuilder,
}));

function makeBuilder(): void {
  mocks.createIncrementalBuilder.mockResolvedValue({
    createBuildPlan: mocks.createBuildPlan,
    executeBuildPlan: mocks.executeBuildPlan,
    getBuildStats: mocks.getBuildStats,
    clearCache: mocks.clearCache,
  });
}

function planFixture(): Record<string, unknown> {
  return {
    targets: [
      {
        name: 'checkout',
        type: 'app',
        path: 'apps/checkout',
        buildScript: 'vite build',
        dependencies: ['ui-kit'],
        estimatedTime: 4000,
      },
      {
        name: 'ui-kit',
        type: 'package',
        path: 'packages/ui-kit',
        buildScript: 'tsc',
        dependencies: [],
        estimatedTime: 2000,
      },
    ],
    buildOrder: ['ui-kit', 'checkout'],
    parallelGroups: [['ui-kit'], ['checkout']],
    totalEstimatedTime: 6000,
    optimizations: ['cache: 1 reusable artifact'],
  };
}

function resultsFixture(): Record<string, unknown>[] {
  return [
    { target: 'ui-kit', success: true, duration: 1800, cacheHit: false, outputSize: 2048 },
    { target: 'checkout', success: true, duration: 500, cacheHit: true },
    { target: 'shell', success: false, duration: 100, cacheHit: false, error: 'vite crashed' },
  ];
}

describe('incremental-build — command', () => {
  let projectDir: string;
  let emptyDir: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    projectDir = fsReal.mkdtempSync(path.join(os.tmpdir(), 'rs-ib-'));
    fsReal.writeFileSync(path.join(projectDir, 'package.json'), '{}');
    emptyDir = fsReal.mkdtempSync(path.join(os.tmpdir(), 'rs-ib-none-'));

    mocks.createIncrementalBuilder.mockReset();
    mocks.createBuildPlan.mockReset();
    mocks.executeBuildPlan.mockReset();
    mocks.getBuildStats.mockReset();
    mocks.clearCache.mockReset();
    makeBuilder();

    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(projectDir);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    cwdSpy.mockRestore();
    fsReal.rmSync(projectDir, { recursive: true, force: true });
    fsReal.rmSync(emptyDir, { recursive: true, force: true });
  });

  it('rejects with a ValidationError when package.json is missing', async () => {
    cwdSpy.mockReturnValue(emptyDir);
    await expect(manageIncrementalBuild({})).rejects.toThrow(
      'Not in a valid project directory (package.json not found)'
    );
    expect(mocks.createIncrementalBuilder).not.toHaveBeenCalled();
  });

  it('creates the builder with merged defaults', async () => {
    mocks.createBuildPlan.mockResolvedValue({ targets: [] });
    await manageIncrementalBuild({
      maxParallelBuilds: 8,
      enableCache: false,
      cacheLocation: '.cache/ib',
      cleanBuild: true,
      dryRun: true,
      skipTests: true,
      buildTimeout: 60_000,
    });
    expect(mocks.createIncrementalBuilder).toHaveBeenCalledWith(projectDir, {
      maxParallelBuilds: 8,
      enableCache: false,
      cacheLocation: '.cache/ib',
      cleanBuild: true,
      dryRun: true,
      verbose: false,
      skipTests: true,
      failFast: true,
      buildTimeout: 60_000,
    });
  });

  it('defaults enableCache and failFast to true and others to false', async () => {
    mocks.createBuildPlan.mockResolvedValue({ targets: [] });
    await manageIncrementalBuild({});
    expect(mocks.createIncrementalBuilder).toHaveBeenCalledWith(projectDir, {
      maxParallelBuilds: undefined,
      enableCache: true,
      cacheLocation: undefined,
      cleanBuild: false,
      dryRun: false,
      verbose: false,
      skipTests: false,
      failFast: true,
      buildTimeout: undefined,
    });
  });

  describe('build (default action)', () => {
    it('reports when nothing needs rebuilding', async () => {
      mocks.createBuildPlan.mockResolvedValue({ targets: [] });
      await manageIncrementalBuild({});
      expect(mocks.executeBuildPlan).not.toHaveBeenCalled();
      expect(logged()).toContain('No targets need rebuilding');
    });

    it('prints the plan summary and executes the build', async () => {
      mocks.createBuildPlan.mockResolvedValue(planFixture());
      mocks.executeBuildPlan.mockResolvedValue(resultsFixture());
      await manageIncrementalBuild({});
      expect(mocks.executeBuildPlan).toHaveBeenCalled();
      expect(logged()).toContain('Targets to build: 2');
      expect(logged()).toContain('Parallel groups: 2');
      expect(logged()).toContain('Successful: 2');
      expect(logged()).toContain('Failed: 1');
      expect(logged()).toContain('Cache hits: 1');
    });

    it('lists optimizations only in verbose mode', async () => {
      mocks.createBuildPlan.mockResolvedValue(planFixture());
      mocks.executeBuildPlan.mockResolvedValue(resultsFixture());
      await manageIncrementalBuild({ verbose: true });
      expect(logged()).toContain('Optimizations:');
      expect(logged()).toContain('cache: 1 reusable artifact');
    });

    it('hides optimizations without verbose', async () => {
      mocks.createBuildPlan.mockResolvedValue(planFixture());
      mocks.executeBuildPlan.mockResolvedValue(resultsFixture());
      await manageIncrementalBuild({});
      expect(logged()).not.toContain('Optimizations:');
    });

    it('shows failed targets and their errors in verbose mode', async () => {
      mocks.createBuildPlan.mockResolvedValue(planFixture());
      mocks.executeBuildPlan.mockResolvedValue(resultsFixture());
      await manageIncrementalBuild({ verbose: true });
      expect(logged()).toContain('Failed Builds:');
      expect(logged()).toContain('vite crashed');
    });

    it('marks cached targets in the results list', async () => {
      mocks.createBuildPlan.mockResolvedValue(planFixture());
      mocks.executeBuildPlan.mockResolvedValue(resultsFixture());
      await manageIncrementalBuild({});
      expect(logged()).toContain('cached');
      expect(logged()).toContain('Time saved by cache');
    });

    it('emits a JSON envelope with plan, results and summary', async () => {
      mocks.createBuildPlan.mockResolvedValue(planFixture());
      mocks.executeBuildPlan.mockResolvedValue(resultsFixture());
      await manageIncrementalBuild({ format: 'json' });
      const json = JSON.parse(
        logSpy.mock.calls.map(c => String(c[0])).find(msg => msg.trim().startsWith('{'))!
      );
      expect(json.summary).toEqual({
        total: 3,
        successful: 2,
        failed: 1,
        totalTime: 2400,
        cacheHits: 1,
      });
      expect(json.plan.buildOrder).toEqual(['ui-kit', 'checkout']);
    });

    it('writes the JSON envelope to --output', async () => {
      mocks.createBuildPlan.mockResolvedValue(planFixture());
      mocks.executeBuildPlan.mockResolvedValue(resultsFixture());
      const outPath = path.join(projectDir, 'results.json');
      await manageIncrementalBuild({ format: 'json', output: outPath });
      const written = JSON.parse(fsReal.readFileSync(outPath, 'utf8'));
      expect(written.summary.total).toBe(3);
      expect(logged()).toContain('Build results saved to');
    });
  });

  describe('plan', () => {
    it('prints the plan without executing', async () => {
      mocks.createBuildPlan.mockResolvedValue(planFixture());
      await manageIncrementalBuild({ plan: true });
      expect(mocks.executeBuildPlan).not.toHaveBeenCalled();
      expect(logged()).toContain('Build Plan Analysis');
      expect(logged()).toContain('Build order: ui-kit → checkout');
      expect(logged()).toContain('Group 1: ui-kit');
    });

    it('prints target paths and build scripts in verbose mode', async () => {
      mocks.createBuildPlan.mockResolvedValue(planFixture());
      await manageIncrementalBuild({ plan: true, verbose: true });
      expect(logged()).toContain('apps/checkout');
      expect(logged()).toContain('vite build');
      expect(logged()).toContain('Dependencies: ui-kit');
    });

    it('reports when the plan is empty', async () => {
      mocks.createBuildPlan.mockResolvedValue({ targets: [] });
      await manageIncrementalBuild({ plan: true });
      expect(logged()).toContain('No targets need rebuilding');
    });

    it('writes the plan as JSON to --output with --format json', async () => {
      mocks.createBuildPlan.mockResolvedValue(planFixture());
      const outPath = path.join(projectDir, 'plan.json');
      await manageIncrementalBuild({ plan: true, format: 'json', output: outPath });
      const written = JSON.parse(fsReal.readFileSync(outPath, 'utf8'));
      expect(written.buildOrder).toEqual(['ui-kit', 'checkout']);
      expect(logged()).toContain('Build plan saved to');
    });

    it('writes the plan as text to --output without --format json', async () => {
      mocks.createBuildPlan.mockResolvedValue(planFixture());
      const outPath = path.join(projectDir, 'plan.txt');
      await manageIncrementalBuild({ plan: true, output: outPath });
      const written = fsReal.readFileSync(outPath, 'utf8');
      expect(written).toContain('Build Plan');
      expect(written).toContain('"buildOrder"');
    });
  });

  describe('stats', () => {
    it('prints cache performance and recommendations', async () => {
      mocks.getBuildStats.mockReturnValue({
        totalBuilds: 10,
        cacheHitRate: 25,
        averageBuildTime: 90_000,
        totalCacheSize: 2_000_000_000,
      });
      await manageIncrementalBuild({ stats: true });
      expect(logged()).toContain('Total builds: 10');
      expect(logged()).toContain('Cache hit rate: 25%');
      expect(logged()).toContain('Consider enabling build caching');
      expect(logged()).toContain('Consider optimizing build scripts');
      expect(logged()).toContain('Consider clearing old cache entries');
    });

    it('skips recommendations for healthy stats', async () => {
      mocks.getBuildStats.mockReturnValue({
        totalBuilds: 5,
        cacheHitRate: 90,
        averageBuildTime: 1000,
        totalCacheSize: 1024,
      });
      await manageIncrementalBuild({ stats: true });
      expect(logged()).not.toContain('Consider enabling build caching');
      expect(logged()).not.toContain('Consider optimizing build scripts');
      expect(logged()).not.toContain('Consider clearing old cache entries');
    });

    it('writes stats to --output as JSON when requested', async () => {
      mocks.getBuildStats.mockReturnValue({
        totalBuilds: 3,
        cacheHitRate: 50,
        averageBuildTime: 1000,
        totalCacheSize: 0,
      });
      const outPath = path.join(projectDir, 'stats.json');
      await manageIncrementalBuild({ stats: true, format: 'json', output: outPath });
      const written = JSON.parse(fsReal.readFileSync(outPath, 'utf8'));
      expect(written.totalBuilds).toBe(3);
      expect(logged()).toContain('Statistics saved to');
    });
  });

  describe('clearCache', () => {
    it('clears the cache and reports success', async () => {
      mocks.clearCache.mockResolvedValue(undefined);
      await manageIncrementalBuild({ clearCache: true });
      expect(mocks.clearCache).toHaveBeenCalled();
      expect(logged()).toContain('Build cache cleared successfully!');
    });
  });

  describe('error handling', () => {
    it('rethrows ValidationError as-is', async () => {
      mocks.createIncrementalBuilder.mockRejectedValue(
        new ValidationError('bad workspace')
      );
      await expect(manageIncrementalBuild({})).rejects.toThrow('bad workspace');
    });

    it('wraps unexpected errors in a ValidationError', async () => {
      mocks.createIncrementalBuilder.mockRejectedValue(new Error('boom'));
      const err = await manageIncrementalBuild({}).catch(e => e);
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.message).toContain('Incremental build failed');
      expect(err.message).toContain('boom');
    });
  });

  function logged(): string {
    return logSpy.mock.calls.map(c => String(c[0])).join('\n');
  }
});
