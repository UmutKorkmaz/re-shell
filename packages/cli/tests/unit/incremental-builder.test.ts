import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

// Engine under test. The command layer (manageIncrementalBuild) is covered by
// tests/unit/incremental-build.test.ts where this engine is MOCKED; this suite
// drives the engine directly:
//   - ChangeDetector / ChangeImpactAnalyzer are mocked with scripted classes
//     (deterministic file hashes, scripted workspace graphs).
//   - child_process.spawn is mocked with a fake child (EventEmitter stdout/
//     stderr + attach-then-emit events).
//   - fs-extra stays REAL against temp workspace trees.

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  detectorInitialize: vi.fn(),
  detectChanges: vi.fn(),
  getFileHash: vi.fn(),
  analyzerInitialize: vi.fn(),
  analyzeChangeImpact: vi.fn(),
  getAllWorkspaces: vi.fn(),
}));

vi.mock('../../src/utils/change-detector', () => ({
  ChangeDetector: class {
    initialize = mocks.detectorInitialize;
    detectChanges = mocks.detectChanges;
    getFileHash = mocks.getFileHash;
  },
}));

vi.mock('../../src/utils/change-impact-analyzer', () => ({
  ChangeImpactAnalyzer: class {
    initialize = mocks.analyzerInitialize;
    analyzeChangeImpact = mocks.analyzeChangeImpact;
    getAllWorkspaces = mocks.getAllWorkspaces;
  },
}));

vi.mock('child_process', () => ({
  spawn: mocks.spawn,
}));

const { IncrementalBuilder, createIncrementalBuilder, runIncrementalBuild } = await import(
  '../../src/utils/incremental-builder'
);

/** A fake child process whose events fire after listeners attach. */
function fakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

/** Default happy-path spawn: emits no output and exits 0 on the next tick. */
function spawnSucceeds() {
  mocks.spawn.mockImplementation(() => {
    const child = fakeChild();
    queueMicrotask(() => child.emit('close', 0));
    return child;
  });
}

/** md5 over N constant hashes — mirrors calculateBuildHash with the
 *  constant getFileHash mock (order-independent). */
function stableHash(inputCount: number): string {
  return crypto
    .createHash('md5')
    .update(Array.from({ length: inputCount }, () => 'stable-hash').join(''))
    .digest('hex');
}

interface WorkspaceSpec {
  name: string;
  type: 'app' | 'package' | 'lib' | 'tool';
  dependencies?: string[];
  buildScript?: string | null;
  testScript?: string;
  srcFiles?: string[];
  outputs?: string[];
}

/**
 * Writes a real workspace directory (package.json + optional src files and
 * output dirs) and returns the matching getAllWorkspaces fixture.
 */
function makeWorkspace(root: string, spec: WorkspaceSpec) {
  const dir = path.join(root, 'apps', spec.name);
  fs.ensureDirSync(dir);
  const pkg: Record<string, unknown> = {
    name: spec.name,
    version: '1.0.0',
    scripts: {} as Record<string, string>,
  };
  if (spec.buildScript !== null) {
    (pkg.scripts as Record<string, string>).build = spec.buildScript ?? 'vite build';
  }
  if (spec.testScript !== undefined) {
    (pkg.scripts as Record<string, string>).test = spec.testScript;
  }
  fs.writeJsonSync(path.join(dir, 'package.json'), pkg);

  for (const file of spec.srcFiles ?? []) {
    const filePath = path.join(dir, 'src', file);
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeFileSync(filePath, `// ${file}\n`);
  }
  for (const output of spec.outputs ?? []) {
    const outputDir = path.join(dir, output);
    fs.ensureDirSync(outputDir);
    fs.writeFileSync(path.join(outputDir, 'out.js'), 'x'.repeat(10));
  }

  return {
    name: spec.name,
    path: dir,
    type: spec.type,
    dependencies: spec.dependencies ?? [],
  };
}

describe('IncrementalBuilder engine', () => {
  let tempRoot: string;
  let cacheLocation: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'inc-builder-'));
    cacheLocation = path.join(tempRoot, '.re-shell', 'build-cache.json');

    mocks.detectorInitialize.mockResolvedValue(undefined);
    mocks.analyzerInitialize.mockResolvedValue(undefined);
    mocks.detectChanges.mockResolvedValue({ added: [], modified: [], removed: [] });
    mocks.getFileHash.mockImplementation(() => ({ hash: 'stable-hash' }));
    mocks.analyzeChangeImpact.mockResolvedValue({ affectedWorkspaces: [], totalImpact: 0 });
    mocks.getAllWorkspaces.mockReturnValue([]);
    spawnSucceeds();

    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  function builder(options: Record<string, unknown> = {}) {
    return new IncrementalBuilder(tempRoot, { cacheLocation, ...options });
  }

  /** Seeds a cache file with entries for the given targets. */
  function seedCache(entries: Record<string, unknown>) {
    fs.ensureDirSync(path.dirname(cacheLocation));
    fs.writeJsonSync(cacheLocation, {
      version: '1.0',
      builds: entries,
    });
  }

  // ======================================================================
  // Construction & initialization
  // ======================================================================
  describe('construction & initialization', () => {
    it('merges the documented defaults', () => {
      const instance = builder();
      const options = (instance as unknown as { options: Record<string, unknown> }).options;
      expect(options.maxParallelBuilds).toBe(Math.max(1, Math.floor(os.cpus().length / 2)));
      expect(options.enableCache).toBe(true);
      expect(options.cleanBuild).toBe(false);
      expect(options.dryRun).toBe(false);
      expect(options.verbose).toBe(false);
      expect(options.skipTests).toBe(false);
      expect(options.failFast).toBe(true);
      expect(options.buildTimeout).toBe(300000);
    });

    it('resolves the root path and applies option overrides', () => {
      const instance = new IncrementalBuilder(path.join(tempRoot, '..', 'some-root'), {
        maxParallelBuilds: 4,
        enableCache: false,
        buildTimeout: 1000,
      });
      const internal = instance as unknown as {
        rootPath: string;
        options: Record<string, unknown>;
      };
      expect(internal.rootPath).toBe(path.resolve(path.join(tempRoot, '..', 'some-root')));
      expect(internal.options.maxParallelBuilds).toBe(4);
      expect(internal.options.enableCache).toBe(false);
      expect(internal.options.buildTimeout).toBe(1000);
    });

    it('initialize() initializes collaborators and loads the persisted cache', async () => {
      seedCache({
        web: { hash: 'h', timestamp: 1, duration: 500, success: true, outputSize: 42 },
      });
      const instance = builder();
      await instance.initialize();

      expect(mocks.detectorInitialize).toHaveBeenCalledTimes(1);
      expect(mocks.analyzerInitialize).toHaveBeenCalledTimes(1);
      expect(instance.getBuildStats().totalBuilds).toBe(1);
    });

    it('initialize() resets to an empty cache when the file is corrupt', async () => {
      fs.ensureDirSync(path.dirname(cacheLocation));
      fs.writeFileSync(cacheLocation, '{not-json');
      const instance = builder();
      await instance.initialize();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load build cache'));
      expect(instance.getBuildStats().totalBuilds).toBe(0);
    });

    it('initialize() skips cache loading when the cache is disabled', async () => {
      seedCache({
        web: { hash: 'h', timestamp: 1, duration: 500, success: true, outputSize: 42 },
      });
      const instance = builder({ enableCache: false });
      await instance.initialize();

      expect(instance.getBuildStats().totalBuilds).toBe(0);
    });
  });

  // ======================================================================
  // Target discovery
  // ======================================================================
  describe('target discovery', () => {
    it('collects workspaces that declare a build script with full metadata', async () => {
      const web = makeWorkspace(tempRoot, {
        name: 'web',
        type: 'app',
        dependencies: ['ui-kit'],
        testScript: 'vitest',
        outputs: ['dist'],
      });
      mocks.getAllWorkspaces.mockReturnValue([web]);

      const plan = await builder().createBuildPlan([]);

      expect(plan.targets).toHaveLength(1);
      const target = plan.targets[0];
      expect(target.name).toBe('web');
      expect(target.path).toBe(web.path);
      expect(target.type).toBe('app');
      expect(target.buildScript).toBe('vite build');
      expect(target.testScript).toBe('vitest');
      expect(target.dependencies).toEqual(['ui-kit']);
      expect(target.outputs).toEqual(['dist']);
      expect(target.lastBuildTime).toBeGreaterThan(0);
      // Inputs: package.json only (dist is an output, not an input).
      expect(target.buildHash).toBe(stableHash(1));
    });

    it('skips workspaces without a build script or without package.json', async () => {
      const lib = makeWorkspace(tempRoot, { name: 'lib', type: 'lib', buildScript: null });
      const missing = {
        name: 'missing',
        path: path.join(tempRoot, 'apps', 'missing'),
        type: 'tool',
        dependencies: [],
      };
      mocks.getAllWorkspaces.mockReturnValue([lib, missing]);

      const plan = await builder().createBuildPlan([]);

      expect(plan.targets).toHaveLength(0);
    });

    it('warns and skips a workspace whose package.json cannot be parsed', async () => {
      const good = makeWorkspace(tempRoot, { name: 'good', type: 'lib' });
      const bad = makeWorkspace(tempRoot, { name: 'bad', type: 'tool' });
      fs.writeFileSync(path.join(bad.path, 'package.json'), 'not json at all');
      mocks.getAllWorkspaces.mockReturnValue([bad, good]);

      const plan = await builder().createBuildPlan([]);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to process bad'));
      expect(plan.targets.map(t => t.name)).toEqual(['good']);
    });

    it('detects existing output dirs and falls back to dist', async () => {
      const withBuild = makeWorkspace(tempRoot, {
        name: 'with-build',
        type: 'lib',
        outputs: ['build'],
      });
      const bare = makeWorkspace(tempRoot, { name: 'bare', type: 'lib' });
      mocks.getAllWorkspaces.mockReturnValue([withBuild, bare]);

      const plan = await builder().createBuildPlan([]);
      const byName = new Map(plan.targets.map(t => [t.name, t]));

      expect(byName.get('with-build')!.outputs).toEqual(['build']);
      expect(byName.get('bare')!.outputs).toEqual(['dist']);
    });

    it('collects src files and config files as inputs, skipping node_modules', async () => {
      const ws = makeWorkspace(tempRoot, {
        name: 'web',
        type: 'app',
        srcFiles: ['main.ts', 'components/button.ts'],
      });
      fs.ensureDirSync(path.join(ws.path, 'src', 'node_modules'));
      fs.writeFileSync(path.join(ws.path, 'src', 'node_modules', 'skipped.ts'), '// skip');
      fs.writeJsonSync(path.join(ws.path, 'tsconfig.json'), {});

      mocks.getAllWorkspaces.mockReturnValue([ws]);

      const plan = await builder().createBuildPlan([]);
      // buildHash proves the input set: src/main.ts, src/components/button.ts,
      // package.json, tsconfig.json → 4 constant hashes.
      expect(plan.targets[0].buildHash).toBe(stableHash(4));
      // vite.config.ts / webpack.config.js are absent → not included (5 would
      // fail, pinning the exact config-file list).
      expect(plan.targets[0].buildHash).not.toBe(stableHash(5));
    });
  });

  // ======================================================================
  // Build plan: change detection & rebuild filters
  // ======================================================================
  describe('createBuildPlan filters', () => {
    it('uses explicitly provided changed files without running detection', async () => {
      const ws = makeWorkspace(tempRoot, { name: 'web', type: 'app' });
      mocks.getAllWorkspaces.mockReturnValue([ws]);

      await builder().createBuildPlan(['src/main.ts']);

      expect(mocks.detectChanges).not.toHaveBeenCalled();
      expect(mocks.analyzeChangeImpact).toHaveBeenCalledWith(['src/main.ts']);
    });

    it('detects changes when no file list is provided', async () => {
      const ws = makeWorkspace(tempRoot, { name: 'web', type: 'app' });
      mocks.getAllWorkspaces.mockReturnValue([ws]);
      mocks.detectChanges.mockResolvedValue({
        added: ['a.ts'],
        modified: ['b.ts'],
        removed: ['c.ts'],
      });

      await builder().createBuildPlan();

      expect(mocks.detectChanges).toHaveBeenCalledTimes(1);
      // added + modified only — removed files do not trigger rebuilds.
      expect(mocks.analyzeChangeImpact).toHaveBeenCalledWith(['a.ts', 'b.ts']);
    });

    it('includes affected targets and drops unaffected cache-valid ones', async () => {
      const web = makeWorkspace(tempRoot, {
        name: 'web',
        type: 'app',
        dependencies: ['ui-kit'],
      });
      const uiKit = makeWorkspace(tempRoot, { name: 'ui-kit', type: 'package', outputs: ['dist'] });
      mocks.getAllWorkspaces.mockReturnValue([web, uiKit]);

      // Seed a cache entry with the exact stable hash + existing outputs so
      // ui-kit is cache-valid and unaffected.
      seedCache({
        'ui-kit': {
          hash: stableHash(1), // package.json only (no src, no dist)
          timestamp: 1,
          duration: 10,
          success: true,
          outputSize: 1,
        },
      });
      mocks.analyzeChangeImpact.mockResolvedValue({
        affectedWorkspaces: [{ name: 'web' }],
        totalImpact: 1,
      });

      const instance = builder();
      await instance.initialize();
      const plan = await instance.createBuildPlan(['src/main.ts']);

      expect(plan.targets.map(t => t.name)).toEqual(['web']);
    });

    it('forces every target on cleanBuild', async () => {
      const web = makeWorkspace(tempRoot, { name: 'web', type: 'app' });
      mocks.getAllWorkspaces.mockReturnValue([web]);
      seedCache({
        web: { hash: stableHash(1), timestamp: 1, duration: 5, success: true, outputSize: 1 },
      });

      const instance = builder({ cleanBuild: true });
      await instance.initialize();
      const plan = await instance.createBuildPlan([]);

      expect(plan.targets.map(t => t.name)).toEqual(['web']);
    });

    it('invalidates the cache when the input hash changes', async () => {
      const web = makeWorkspace(tempRoot, {
        name: 'web',
        type: 'app',
        srcFiles: ['main.ts'],
      });
      mocks.getAllWorkspaces.mockReturnValue([web]);
      // Stale hash from a previous build.
      seedCache({
        web: { hash: 'old-hash', timestamp: 1, duration: 5, success: true, outputSize: 1 },
      });

      const instance = builder();
      await instance.initialize();
      const plan = await instance.createBuildPlan([]);

      expect(plan.targets.map(t => t.name)).toEqual(['web']);
    });

    it('invalidates the cache when declared outputs no longer exist', async () => {
      const web = makeWorkspace(tempRoot, {
        name: 'web',
        type: 'app',
        srcFiles: ['main.ts'],
      });
      mocks.getAllWorkspaces.mockReturnValue([web]);
      seedCache({
        web: { hash: stableHash(2), timestamp: 1, duration: 5, success: true, outputSize: 1 },
      });

      const instance = builder();
      await instance.initialize();
      const plan = await instance.createBuildPlan([]);

      // No dist directory on disk → outputs missing → rebuild.
      expect(plan.targets.map(t => t.name)).toEqual(['web']);
    });

    it('returns an empty plan with a note when nothing needs rebuilding', async () => {
      const web = makeWorkspace(tempRoot, {
        name: 'web',
        type: 'app',
        outputs: ['dist'],
      });
      mocks.getAllWorkspaces.mockReturnValue([web]);
      seedCache({
        web: { hash: stableHash(1), timestamp: 1, duration: 5, success: true, outputSize: 1 },
      });

      const instance = builder();
      await instance.initialize();
      const plan = await instance.createBuildPlan([]);

      expect(plan.targets).toHaveLength(0);
      expect(plan.buildOrder).toEqual([]);
      expect(plan.parallelGroups).toEqual([]);
      expect(plan.optimizations).toEqual([
        'No targets need rebuilding - all caches are valid',
      ]);
    });
  });

  // ======================================================================
  // Build order & parallel groups
  // ======================================================================
  describe('build order & parallel groups', () => {
    it('orders dependencies before dependents', async () => {
      const web = makeWorkspace(tempRoot, {
        name: 'web',
        type: 'app',
        dependencies: ['ui-kit'],
      });
      const uiKit = makeWorkspace(tempRoot, { name: 'ui-kit', type: 'package' });
      mocks.getAllWorkspaces.mockReturnValue([web, uiKit]);

      const plan = await builder().createBuildPlan([]);

      expect(plan.buildOrder.indexOf('ui-kit')).toBeLessThan(plan.buildOrder.indexOf('web'));
    });

    it('throws ValidationError on circular dependencies', async () => {
      const a = makeWorkspace(tempRoot, {
        name: 'a',
        type: 'lib',
        dependencies: ['b'],
      });
      const b = makeWorkspace(tempRoot, {
        name: 'b',
        type: 'lib',
        dependencies: ['a'],
      });
      mocks.getAllWorkspaces.mockReturnValue([a, b]);

      await expect(builder().createBuildPlan([])).rejects.toThrow(
        'Circular dependency detected involving',
      );
    });

    it('separates dependent targets into different parallel groups', async () => {
      const web = makeWorkspace(tempRoot, {
        name: 'web',
        type: 'app',
        dependencies: ['ui-kit'],
      });
      const uiKit = makeWorkspace(tempRoot, { name: 'ui-kit', type: 'package' });
      mocks.getAllWorkspaces.mockReturnValue([web, uiKit]);

      const plan = await builder({ maxParallelBuilds: 4 }).createBuildPlan([]);

      expect(plan.parallelGroups).toHaveLength(2);
      expect(plan.parallelGroups[0]).toEqual(['ui-kit']);
      expect(plan.parallelGroups[1]).toEqual(['web']);
    });

    it('packs independent targets into one group up to maxParallelBuilds', async () => {
      const specs = ['one', 'two', 'three', 'four', 'five'].map(name =>
        makeWorkspace(tempRoot, { name, type: 'lib' }),
      );
      mocks.getAllWorkspaces.mockReturnValue(specs);

      const plan = await builder({ maxParallelBuilds: 2 }).createBuildPlan([]);

      expect(plan.parallelGroups).toHaveLength(3);
      expect(plan.parallelGroups[0]).toHaveLength(2);
      expect(plan.parallelGroups[1]).toHaveLength(2);
      expect(plan.parallelGroups[2]).toHaveLength(1);
    });

    // REGRESSION NOTE (pinned): createParallelGroups only inspects DIRECT
    // dependencies when deciding whether a target may share a group. In the
    // chain a→b→c, target `a` has no direct dependency on `c`, so it is packed
    // into group 1 next to `c` while its DIRECT dependency `b` lands in group
    // 2 — i.e. `a` is scheduled before one of its dependencies. This pins the
    // current behaviour so a fix shows up as a diff here.
    it('BUG (pinned): transitive chains leak dependents into earlier groups', async () => {
      const c = makeWorkspace(tempRoot, { name: 'c', type: 'lib' });
      const b = makeWorkspace(tempRoot, {
        name: 'b',
        type: 'lib',
        dependencies: ['c'],
      });
      const a = makeWorkspace(tempRoot, {
        name: 'a',
        type: 'app',
        dependencies: ['b'],
      });
      mocks.getAllWorkspaces.mockReturnValue([a, b, c]);

      const plan = await builder().createBuildPlan([]);

      expect(plan.buildOrder).toEqual(['c', 'b', 'a']);
      expect(plan.parallelGroups).toEqual([['c', 'a'], ['b']]);
    });
  });

  // ======================================================================
  // Time estimation & optimization notes
  // ======================================================================
  describe('estimation & optimizations', () => {
    it('prefers cached durations over type-based estimates', async () => {
      const web = makeWorkspace(tempRoot, { name: 'web', type: 'app' });
      mocks.getAllWorkspaces.mockReturnValue([web]);
      seedCache({
        web: { hash: 'stale', timestamp: 1, duration: 1000, success: true, outputSize: 1 },
      });

      const instance = builder({ maxParallelBuilds: 1 });
      await instance.initialize();
      const plan = await instance.createBuildPlan([]);

      // Cache entry exists but hash is stale → rebuild using its duration.
      expect(plan.totalEstimatedTime).toBe(1000);
    });

    it('falls back to per-type estimates divided by the parallelization factor', async () => {
      const app = makeWorkspace(tempRoot, { name: 'app', type: 'app' });
      const pkg = makeWorkspace(tempRoot, { name: 'pkg', type: 'package' });
      const lib = makeWorkspace(tempRoot, { name: 'lib', type: 'lib' });
      const tool = makeWorkspace(tempRoot, { name: 'tool', type: 'tool' });
      mocks.getAllWorkspaces.mockReturnValue([app, pkg, lib, tool]);

      const plan = await builder({ maxParallelBuilds: 4 }).createBuildPlan([]);

      // 60s + 30s + 20s + 10s = 120s across 4 lanes.
      expect(plan.totalEstimatedTime).toBe(30000);
    });

    it('scales type estimates up for large input sets', async () => {
      const web = makeWorkspace(tempRoot, {
        name: 'web',
        type: 'app',
        srcFiles: Array.from({ length: 60 }, (_, i) => `f${i}.ts`),
      });
      mocks.getAllWorkspaces.mockReturnValue([web]);

      const plan = await builder({ maxParallelBuilds: 1 }).createBuildPlan([]);

      // 61 inputs (>50) → 60000 * 1.2 = 72000.
      expect(plan.totalEstimatedTime).toBe(72000);
    });

    it('reports parallel and smart-rebuild optimizations', async () => {
      const web = makeWorkspace(tempRoot, { name: 'web', type: 'app' });
      const uiKit = makeWorkspace(tempRoot, { name: 'ui-kit', type: 'package' });
      mocks.getAllWorkspaces.mockReturnValue([web, uiKit]);
      mocks.analyzeChangeImpact.mockResolvedValue({
        affectedWorkspaces: [{ name: 'web' }, { name: 'ui-kit' }],
        totalImpact: 1,
      });

      const plan = await builder({ maxParallelBuilds: 2, cleanBuild: true }).createBuildPlan([]);

      expect(plan.optimizations).toContain('Parallel builds enabled (max 2)');
      expect(plan.optimizations).toContain('Smart rebuilds: only 1 of 2 workspaces affected');
      expect(plan.optimizations).toContain(
        'Building packages before apps for optimal dependency resolution',
      );
    });

    it('counts cache-valid targets among the optimizations', async () => {
      const web = makeWorkspace(tempRoot, {
        name: 'web',
        type: 'app',
        outputs: ['dist'],
      });
      mocks.getAllWorkspaces.mockReturnValue([web]);
      seedCache({
        web: { hash: stableHash(1), timestamp: 1, duration: 5, success: true, outputSize: 1 },
      });

      // cleanBuild keeps the cache-valid target in the plan, where it is
      // reported as a cache hit.
      const instance = builder({ cleanBuild: true, maxParallelBuilds: 1 });
      await instance.initialize();
      const plan = await instance.createBuildPlan([]);

      expect(plan.optimizations).toContain('1 targets using cached builds');
    });

    it('omits the parallel note for single-lane configurations', async () => {
      const web = makeWorkspace(tempRoot, { name: 'web', type: 'app' });
      mocks.getAllWorkspaces.mockReturnValue([web]);

      const plan = await builder({ maxParallelBuilds: 1 }).createBuildPlan([]);

      expect(plan.optimizations).not.toContain('Parallel builds enabled (max 1)');
    });
  });

  // ======================================================================
  // executeBuildPlan
  // ======================================================================
  describe('executeBuildPlan', () => {
    it('only logs in dry-run mode without spawning', async () => {
      const web = makeWorkspace(tempRoot, { name: 'web', type: 'app' });
      const plan = {
        targets: [web as never],
        buildOrder: ['web'],
        parallelGroups: [['web']],
        totalEstimatedTime: 1000,
        optimizations: [],
      };

      const results = await builder({ dryRun: true }).executeBuildPlan(plan);

      expect(results).toEqual([]);
      expect(mocks.spawn).not.toHaveBeenCalled();
      const logged = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(logged).toContain('Dry run - showing what would be built:');
      expect(logged).toContain('web (app)');
    });

    it('builds every group and persists successful results to the cache', async () => {
      const web = makeWorkspace(tempRoot, {
        name: 'web',
        type: 'app',
        outputs: ['dist'],
      });
      mocks.getAllWorkspaces.mockReturnValue([web]);
      const instance = builder();
      const plan = await instance.createBuildPlan([]);

      const results = await instance.executeBuildPlan(plan);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].cacheHit).toBe(false);
      expect(results[0].outputSize).toBe(10);

      const persisted = fs.readJsonSync(cacheLocation);
      expect(persisted.builds['web'].success).toBe(true);
      expect(persisted.builds['web'].hash).toBe(stableHash(1));
      expect(persisted.builds['web'].outputSize).toBe(10);

      const logged = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(logged).toContain('Build completed in');
      expect(logged).toContain('1 successful, 0 failed');
    });

    it('rebuilds nothing on the second run when the cache is valid', async () => {
      const web = makeWorkspace(tempRoot, {
        name: 'web',
        type: 'app',
        outputs: ['dist'],
      });
      mocks.getAllWorkspaces.mockReturnValue([web]);
      const instance = builder();
      await instance.executeBuildPlan(await instance.createBuildPlan([]));

      mocks.spawn.mockClear();
      const secondPlan = await instance.createBuildPlan([]);

      expect(secondPlan.targets).toHaveLength(0);
      expect(mocks.spawn).not.toHaveBeenCalled();
    });

    it('serves cached results without spawning when a target stays valid', async () => {
      const web = makeWorkspace(tempRoot, {
        name: 'web',
        type: 'app',
        outputs: ['dist'],
      });
      mocks.getAllWorkspaces.mockReturnValue([web]);
      const instance = builder();
      await instance.executeBuildPlan(await instance.createBuildPlan([]));

      // Force the target back into the plan; it must resolve from cache.
      const plan = await instance.createBuildPlan([]);
      plan.targets.push({
        name: 'web',
        path: web.path,
        type: 'app',
        buildScript: 'vite build',
        dependencies: [],
        outputs: ['dist'],
        buildHash: stableHash(1),
      });
      plan.parallelGroups = [['web']];
      mocks.spawn.mockClear();

      const results = await instance.executeBuildPlan(plan);

      expect(results[0].cacheHit).toBe(true);
      expect(results[0].duration).toBe(0);
      expect(mocks.spawn).not.toHaveBeenCalled();
    });

    it('aborts after a failing group when failFast is enabled', async () => {
      mocks.spawn.mockImplementation(() => {
        const child = fakeChild();
        queueMicrotask(() => {
          child.stderr.emit('data', Buffer.from('compile error'));
          child.emit('close', 1);
        });
        return child;
      });
      const web = makeWorkspace(tempRoot, { name: 'web', type: 'app' });
      mocks.getAllWorkspaces.mockReturnValue([web]);
      const instance = builder();
      const plan = await instance.createBuildPlan([]);

      await expect(instance.executeBuildPlan(plan)).rejects.toThrow(
        'Build failed for targets: web',
      );
    });

    it('collects failures and continues when failFast is disabled', async () => {
      mocks.spawn.mockImplementation(() => {
        const child = fakeChild();
        queueMicrotask(() => {
          child.stderr.emit('data', Buffer.from('compile error'));
          child.emit('close', 1);
        });
        return child;
      });
      const web = makeWorkspace(tempRoot, { name: 'web', type: 'app' });
      mocks.getAllWorkspaces.mockReturnValue([web]);
      const instance = builder({ failFast: false });
      const plan = await instance.createBuildPlan([]);

      const results = await instance.executeBuildPlan(plan);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('compile error');
      // Failed builds are not cached — the persisted file exists but has no
      // entries (saveBuildCache runs unconditionally at the end of the run).
      expect(fs.readJsonSync(cacheLocation).builds).toEqual({});
    });
  });

  // ======================================================================
  // buildTarget & script execution
  // ======================================================================
  describe('buildTarget & script execution', () => {
    function bareTarget(overrides: Record<string, unknown> = {}) {
      return {
        name: 'web',
        path: path.join(tempRoot, 'apps', 'web'),
        type: 'app' as const,
        buildScript: 'vite build',
        dependencies: [],
        outputs: [],
        ...overrides,
      };
    }

    it('maps the script onto npm by default with the target cwd', async () => {
      const instance = builder({ enableCache: false });
      await instance.buildTarget(bareTarget());

      expect(mocks.spawn).toHaveBeenCalledWith(
        'npm',
        ['run', 'vite'],
        expect.objectContaining({ cwd: path.join(tempRoot, 'apps', 'web'), shell: true }),
      );
    });

    it('maps the script onto pnpm when a pnpm lockfile is present', async () => {
      fs.ensureDirSync(path.join(tempRoot, 'apps', 'web'));
      fs.writeFileSync(path.join(tempRoot, 'apps', 'web', 'pnpm-lock.yaml'), '');
      const instance = builder({ enableCache: false });
      await instance.buildTarget(bareTarget());

      expect(mocks.spawn).toHaveBeenCalledWith('pnpm', ['run', 'vite'], expect.anything());
    });

    it('maps the script onto yarn when a yarn lockfile is present', async () => {
      fs.ensureDirSync(path.join(tempRoot, 'apps', 'web'));
      fs.writeFileSync(path.join(tempRoot, 'apps', 'web', 'yarn.lock'), '');
      const instance = builder({ enableCache: false });
      await instance.buildTarget(bareTarget());

      expect(mocks.spawn).toHaveBeenCalledWith('yarn', ['vite'], expect.anything());
    });

    it('captures stdout output and reports non-zero exits as failures', async () => {
      mocks.spawn.mockImplementation(() => {
        const child = fakeChild();
        queueMicrotask(() => {
          child.stdout.emit('data', Buffer.from('bundling...'));
          child.stderr.emit('data', Buffer.from('compile error'));
          child.emit('close', 1);
        });
        return child;
      });
      const instance = builder({ enableCache: false });

      const result = await instance.buildTarget(bareTarget());

      expect(result.success).toBe(false);
      expect(result.output).toBe('bundling...');
      expect(result.error).toBe('compile error');
    });

    it('kills the process and fails after the configured timeout', async () => {
      vi.useFakeTimers();
      const child = fakeChild();
      mocks.spawn.mockReturnValue(child as never);
      const instance = builder({ enableCache: false, buildTimeout: 20 });

      const pending = instance.buildTarget(bareTarget());
      await vi.advanceTimersByTimeAsync(25);
      const result = await pending;

      expect(child.kill).toHaveBeenCalledWith('SIGTERM');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Build timeout after 20ms');
    });

    it('surfaces spawn errors as failed results', async () => {
      mocks.spawn.mockImplementation(() => {
        const child = fakeChild();
        queueMicrotask(() =>
          child.emit('error', new Error('spawn npm ENOENT')),
        );
        return child;
      });
      const instance = builder({ enableCache: false });

      const result = await instance.buildTarget(bareTarget());

      expect(result.success).toBe(false);
      expect(result.error).toBe('spawn npm ENOENT');
    });

    it('logs per-target progress in verbose mode', async () => {
      const web = makeWorkspace(tempRoot, { name: 'web', type: 'app' });
      const instance = builder({ verbose: true, enableCache: false });
      await instance.buildTarget({
        name: 'web',
        path: web.path,
        type: 'app',
        buildScript: 'vite build',
        dependencies: [],
        outputs: [],
      });

      const logged = logSpy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(logged).toContain('🔨 Building web...');
      expect(logged).toContain('✅ web: Built in');
    });
  });

  // ======================================================================
  // Stats & cache lifecycle
  // ======================================================================
  describe('stats & cache lifecycle', () => {
    it('derives stats from successful builds only', async () => {
      seedCache({
        good: { hash: 'a', timestamp: 1, duration: 100, success: true, outputSize: 10 },
        also: { hash: 'b', timestamp: 2, duration: 300, success: true, outputSize: 20 },
        bad: { hash: 'c', timestamp: 3, duration: 500, success: false, outputSize: 40 },
      });
      const instance = builder();
      await instance.initialize();

      const stats = instance.getBuildStats();

      expect(stats.totalBuilds).toBe(3);
      expect(stats.cacheHitRate).toBeCloseTo((2 / 3) * 100);
      expect(stats.averageBuildTime).toBe(200); // (100 + 300) / 2
      expect(stats.totalCacheSize).toBe(70);
    });

    it('returns zeroed stats for an empty cache', () => {
      const stats = builder().getBuildStats();

      expect(stats).toEqual({
        totalBuilds: 0,
        cacheHitRate: 0,
        averageBuildTime: 0,
        totalCacheSize: 0,
      });
    });

    it('clearCache resets memory and removes the persisted file', async () => {
      seedCache({
        web: { hash: 'a', timestamp: 1, duration: 100, success: true, outputSize: 10 },
      });
      const instance = builder();
      await instance.initialize();

      await instance.clearCache();

      expect(instance.getBuildStats().totalBuilds).toBe(0);
      expect(fs.existsSync(cacheLocation)).toBe(false);
    });
  });

  // ======================================================================
  // Factory helpers
  // ======================================================================
  describe('factory helpers', () => {
    it('createIncrementalBuilder returns an initialized instance', async () => {
      const instance = await createIncrementalBuilder(tempRoot, { cacheLocation });

      expect(mocks.detectorInitialize).toHaveBeenCalledTimes(1);
      expect(mocks.analyzerInitialize).toHaveBeenCalledTimes(1);
      expect(instance).toBeInstanceOf(IncrementalBuilder);
    });

    it('runIncrementalBuild plans and executes in one call', async () => {
      const web = makeWorkspace(tempRoot, { name: 'web', type: 'app' });
      mocks.getAllWorkspaces.mockReturnValue([web]);

      const results = await runIncrementalBuild(tempRoot, [], {
        cacheLocation,
        maxParallelBuilds: 1,
      });

      expect(results).toHaveLength(1);
      expect(results[0].target).toBe('web');
      expect(results[0].success).toBe(true);
      expect(mocks.spawn).toHaveBeenCalled();
    });
  });
});
