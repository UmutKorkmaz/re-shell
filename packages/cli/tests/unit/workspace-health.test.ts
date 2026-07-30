import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// The two factory wrappers (createWorkspaceHealthChecker / performQuickHealthCheck)
// delegate to loadWorkspaceDefinition, which parses & validates a YAML file. We
// stub it so the wrapper tests stay deterministic and decoupled from the schema
// validator; everything else in the module is exercised through the constructor.
vi.mock('../../src/utils/workspace-schema', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, loadWorkspaceDefinition: vi.fn() };
});

import {
  WorkspaceHealthChecker,
  createWorkspaceHealthChecker,
  performQuickHealthCheck,
} from '../../src/utils/workspace-health';
import { loadWorkspaceDefinition } from '../../src/utils/workspace-schema';
import type {
  WorkspaceDefinition,
  WorkspaceEntry,
  WorkspaceDependency,
} from '../../src/utils/workspace-schema';
import { ValidationError } from '../../src/utils/error-handler';

/** Build a complete, valid WorkspaceDefinition with optional overrides. */
function makeDefinition(overrides: Partial<WorkspaceDefinition> = {}): WorkspaceDefinition {
  return {
    version: '1.0',
    name: 'test-monorepo',
    root: '.',
    patterns: ['apps/*', 'packages/*'],
    types: {
      app: { name: 'Application', framework: 'react' },
      package: { name: 'Package' },
    },
    workspaces: {},
    dependencies: {},
    build: { target: 'es2020' },
    dev: {},
    test: { coverage: { enabled: true, threshold: 80 } },
    scripts: { build: { command: 'npm run build' } },
    ...overrides,
  };
}

function entry(name: string, type: string, wsPath: string): WorkspaceEntry {
  return { name, type, path: wsPath };
}

function dep(name: string, type: WorkspaceDependency['type'] = 'build'): WorkspaceDependency {
  return { name, type };
}

const HEALTHY_DEF = makeDefinition({
  workspaces: {
    'web-app': entry('web-app', 'app', 'apps/web-app'),
    utils: entry('utils', 'package', 'packages/utils'),
  },
  dependencies: { 'web-app': [dep('utils')] },
});

/** Materialize a healthy workspace on disk (dirs + definition file). */
function materializeHealthy(root: string): void {
  fs.ensureDirSync(path.join(root, 'apps', 'web-app'));
  fs.ensureDirSync(path.join(root, 'packages', 'utils'));
  fs.writeFileSync(path.join(root, 're-shell.workspaces.yaml'), 'version: "1.0"');
}

describe('workspace-health — performHealthCheck (healthy workspace)', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wh-healthy-'));
    materializeHealthy(root);
  });
  afterEach(() => fs.removeSync(root));

  it('reports a healthy overall status with a perfect score', async () => {
    const report = await new WorkspaceHealthChecker(HEALTHY_DEF, root).performHealthCheck();
    expect(report.overall.status).toBe('healthy');
    expect(report.overall.score).toBeGreaterThanOrEqual(90);
    expect(report.overall.summary).toContain('healthy');
  });

  it('runs all seven categories', async () => {
    const report = await new WorkspaceHealthChecker(HEALTHY_DEF, root).performHealthCheck();
    expect(report.categories.map((c) => c.id)).toEqual([
      'structure',
      'dependencies',
      'build',
      'filesystem',
      'package-json',
      'typescript',
      'security',
    ]);
  });

  it('aggregates graph-derived metrics and a full coverage score', async () => {
    const report = await new WorkspaceHealthChecker(HEALTHY_DEF, root).performHealthCheck();
    expect(report.metrics.workspaceCount).toBe(2);
    expect(report.metrics.dependencyCount).toBe(1);
    expect(report.metrics.cycleCount).toBe(0);
    expect(report.metrics.orphanedCount).toBe(0);
    // workspaces + dependencies + build + scripts + types all present → 100.
    expect(report.metrics.coverageScore).toBe(100);
  });

  it('produces a timestamp and workspace file label', async () => {
    const report = await new WorkspaceHealthChecker(HEALTHY_DEF, root).performHealthCheck();
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(report.workspaceFile).toBe('re-shell.workspaces.yaml');
    expect(report.duration).toBeGreaterThanOrEqual(0);
  });
});

describe('workspace-health — individual structure checks', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wh-checks-'));
    materializeHealthy(root);
  });
  afterEach(() => fs.removeSync(root));

  async function checkById(def: WorkspaceDefinition, id: string, useRoot = root) {
    const report = await new WorkspaceHealthChecker(def, useRoot).performHealthCheck();
    return report.categories.flatMap((c) => c.checks).find((c) => c.id === id)!;
  }

  it('fails the definition-exists check when re-shell.workspaces.yaml is absent', async () => {
    fs.removeSync(path.join(root, 're-shell.workspaces.yaml'));
    const check = await checkById(HEALTHY_DEF, 'workspace-definition-exists');
    expect(check.status).toBe('fail');
    expect(check.severity).toBe('critical');
    expect(check.suggestions).toBeDefined();
  });

  it('fails the directories check when a workspace directory is missing', async () => {
    fs.removeSync(path.join(root, 'apps', 'web-app'));
    const check = await checkById(HEALTHY_DEF, 'workspace-directories');
    expect(check.status).toBe('fail');
    expect(check.message).toContain('missing');
  });

  it('warns on naming inconsistency between key, config name, and directory', async () => {
    const def = makeDefinition({
      workspaces: { alpha: entry('bravo', 'app', 'apps/charlie') },
    });
    fs.ensureDirSync(path.join(root, 'apps', 'charlie'));
    const check = await checkById(def, 'workspace-consistency');
    expect(check.status).toBe('warning');
    expect(check.metadata?.inconsistencies).toBeDefined();
  });

  it('warns when a workspace name is not kebab-case', async () => {
    const def = makeDefinition({
      workspaces: { WebApp: entry('WebApp', 'app', 'apps/web-app') },
    });
    const check = await checkById(def, 'naming-conventions');
    expect(check.status).toBe('warning');
    expect(check.message).toContain("don't follow kebab-case");
  });

  it('fails the types check when a workspace references an undefined type', async () => {
    const def = makeDefinition({
      workspaces: { web: entry('web', 'nonexistent', 'apps/web-app') },
    });
    const check = await checkById(def, 'workspace-types');
    expect(check.status).toBe('fail');
    expect(check.message).toContain('invalid types');
  });
});

describe('workspace-health — dependency checks', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wh-deps-'));
    materializeHealthy(root);
  });
  afterEach(() => fs.removeSync(root));

  async function checkById(def: WorkspaceDefinition, id: string) {
    const report = await new WorkspaceHealthChecker(def, root).performHealthCheck();
    return report.categories.flatMap((c) => c.checks).find((c) => c.id === id)!;
  }

  it('fails the circular-dependencies check on a build cycle', async () => {
    const def = makeDefinition({
      workspaces: { a: entry('a', 'package', 'packages/a'), b: entry('b', 'package', 'packages/b') },
      dependencies: { a: [dep('b')], b: [dep('a')] },
    });
    const check = await checkById(def, 'circular-dependencies');
    expect(check.status).toBe('fail');
    expect(check.severity).toBe('critical');
  });

  it('fails the missing-dependencies check when a dependency points nowhere', async () => {
    const def = makeDefinition({
      workspaces: { a: entry('a', 'package', 'packages/a') },
      dependencies: { a: [dep('ghost')] },
    });
    const check = await checkById(def, 'missing-dependencies');
    expect(check.status).toBe('fail');
    expect(check.metadata?.missingDeps).toContain('a → ghost');
  });

  it('emits optimization info for deep dependency chains', async () => {
    const workspaces: Record<string, WorkspaceEntry> = {};
    const dependencies: Record<string, WorkspaceDependency[]> = {};
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    names.forEach((n, i) => {
      workspaces[n] = entry(n, 'package', `packages/${n}`);
      if (names[i + 1]) dependencies[n] = [dep(names[i + 1])];
    });
    const def = makeDefinition({ workspaces, dependencies });
    const check = await checkById(def, 'dependency-optimization');
    expect(check.status).toBe('info');
    expect(check.suggestions?.some((s) => s.includes('Deep dependency chains'))).toBe(true);
  });

  it('passes the not-yet-implemented placeholder checks', async () => {
    const report = await new WorkspaceHealthChecker(HEALTHY_DEF, root).performHealthCheck();
    const placeholders = ['dependency-versions', 'build-tools', 'large-files', 'security-vulnerabilities'];
    for (const id of placeholders) {
      const check = report.categories.flatMap((c) => c.checks).find((c) => c.id === id)!;
      expect(check.status).toBe('pass');
      expect(check.message).toContain('not yet implemented');
    }
  });
});

describe('workspace-health — overall status transitions', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wh-status-'));
    materializeHealthy(root);
  });
  afterEach(() => fs.removeSync(root));

  it('reports degraded when a few checks fail (70–89%)', async () => {
    // Remove the definition file + a directory + use an invalid type → 3 non-pass.
    fs.removeSync(path.join(root, 're-shell.workspaces.yaml'));
    fs.removeSync(path.join(root, 'apps', 'web-app'));
    const def = makeDefinition({
      workspaces: { 'web-app': entry('web-app', 'bad', 'apps/web-app'), utils: entry('utils', 'package', 'packages/utils') },
      dependencies: { 'web-app': [dep('utils')] },
    });
    const report = await new WorkspaceHealthChecker(def, root).performHealthCheck();
    expect(report.overall.status).toBe('degraded');
    expect(report.overall.score).toBeGreaterThanOrEqual(70);
    expect(report.overall.score).toBeLessThan(90);
    expect(report.overall.summary).toContain('some issues');
  });

  it('reports unhealthy when many checks fail (<70%)', async () => {
    // No definition file, two uppercase-named workspaces with mismatched names,
    // invalid types, missing directories, a build cycle, and a missing dependency.
    fs.removeSync(path.join(root, 're-shell.workspaces.yaml'));
    const def = makeDefinition({
      workspaces: {
        A: entry('X', 'bad', 'apps/missing-a'),
        B: entry('Y', 'bad', 'apps/missing-b'),
      },
      dependencies: { A: [dep('B')], B: [dep('A'), dep('C')] },
    });
    const report = await new WorkspaceHealthChecker(def, root).performHealthCheck();
    expect(report.overall.status).toBe('unhealthy');
    expect(report.overall.score).toBeLessThan(70);
    expect(report.overall.summary).toContain('significant issues');
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeLessThanOrEqual(10);
  });
});

describe('workspace-health — validateTopology', () => {
  it('is valid for a simple acyclic graph', async () => {
    const topo = await new WorkspaceHealthChecker(HEALTHY_DEF, '/tmp').validateTopology();
    expect(topo.isValid).toBe(true);
    expect(topo.errors).toHaveLength(0);
    expect(topo.warnings).toHaveLength(0);
    expect(topo.structure).toEqual(
      expect.objectContaining({ depth: expect.any(Number), breadth: expect.any(Number), complexity: expect.any(Number), balance: expect.any(Number) })
    );
  });

  it('reports an error for a build cycle', async () => {
    const def = makeDefinition({
      workspaces: { a: entry('a', 'package', 'p/a'), b: entry('b', 'package', 'p/b') },
      dependencies: { a: [dep('b')], b: [dep('a')] },
    });
    const topo = await new WorkspaceHealthChecker(def, '/tmp').validateTopology();
    expect(topo.isValid).toBe(false);
    expect(topo.errors.some((e) => e.message.includes('Circular dependency'))).toBe(true);
  });

  it('warns about deep dependency depth', async () => {
    const workspaces: Record<string, WorkspaceEntry> = {};
    const dependencies: Record<string, WorkspaceDependency[]> = {};
    const names = ['n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9'];
    names.forEach((n, i) => {
      workspaces[n] = entry(n, 'package', `p/${n}`);
      if (names[i + 1]) dependencies[n] = [dep(names[i + 1])];
    });
    const topo = await new WorkspaceHealthChecker(makeDefinition({ workspaces, dependencies }), '/tmp').validateTopology();
    expect(topo.warnings.some((w) => w.includes('Dependency depth'))).toBe(true);
  });

  it('warns about orphaned workspaces', async () => {
    const def = makeDefinition({
      workspaces: {
        'web-app': entry('web-app', 'app', 'apps/web-app'),
        utils: entry('utils', 'package', 'packages/utils'),
        lonely: entry('lonely', 'package', 'packages/lonely'),
      },
      dependencies: { 'web-app': [dep('utils')] },
    });
    const topo = await new WorkspaceHealthChecker(def, '/tmp').validateTopology();
    expect(topo.warnings.some((w) => w.includes('orphaned workspace'))).toBe(true);
  });

  it('suggests splitting when there are many apps', async () => {
    const workspaces: Record<string, WorkspaceEntry> = {};
    for (let i = 0; i < 6; i++) workspaces[`app-${i}`] = entry(`app-${i}`, 'app', `apps/app-${i}`);
    const def = makeDefinition({ workspaces });
    const topo = await new WorkspaceHealthChecker(def, '/tmp').validateTopology();
    expect(topo.suggestions.some((s) => s.includes('splitting applications'))).toBe(true);
  });
});

describe('workspace-health — coverage score', () => {
  it('scores 40 when only workspaces and dependencies are defined', async () => {
    const def: WorkspaceDefinition = {
      version: '1.0',
      name: 't',
      root: '.',
      patterns: [],
      types: {},
      workspaces: { a: entry('a', 'package', 'p/a') },
      dependencies: { a: [dep('ghost')] },
      build: undefined as unknown as WorkspaceDefinition['build'],
      dev: {},
      test: { coverage: { enabled: false, threshold: 0 } },
      scripts: {},
    };
    const report = await new WorkspaceHealthChecker(def, '/tmp').performHealthCheck();
    expect(report.metrics.coverageScore).toBe(40);
  });
});

describe('workspace-health — factory functions', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'wh-factory-'));
    materializeHealthy(root);
    vi.mocked(loadWorkspaceDefinition).mockReset();
  });
  afterEach(() => fs.removeSync(root));

  it('createWorkspaceHealthChecker loads the definition and builds a checker', async () => {
    vi.mocked(loadWorkspaceDefinition).mockResolvedValue(HEALTHY_DEF);
    const checker = await createWorkspaceHealthChecker('whatever.yaml', root);
    expect(checker).toBeInstanceOf(WorkspaceHealthChecker);
    expect(vi.mocked(loadWorkspaceDefinition)).toHaveBeenCalledWith('whatever.yaml');
  });

  it('performQuickHealthCheck summarizes a healthy workspace', async () => {
    vi.mocked(loadWorkspaceDefinition).mockResolvedValue(HEALTHY_DEF);
    const result = await performQuickHealthCheck('whatever.yaml', root);
    expect(result.status).toBe('healthy');
    expect(result.criticalIssues).toBe(0);
  });

  it('performQuickHealthCheck returns unhealthy when loading fails', async () => {
    vi.mocked(loadWorkspaceDefinition).mockRejectedValue(new ValidationError('not found'));
    const result = await performQuickHealthCheck('/does/not/exist.yaml');
    expect(result).toEqual({ status: 'unhealthy', score: 0, criticalIssues: 1 });
  });
});
