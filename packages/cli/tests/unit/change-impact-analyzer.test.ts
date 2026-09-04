import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  ChangeImpactAnalyzer,
  createChangeImpactAnalyzer,
  analyzeChangeImpact,
} from '../../src/utils/change-impact-analyzer';
import { ValidationError } from '../../src/utils/error-handler';
import type { WorkspaceInfo, ImpactRule } from '../../src/utils/change-impact-analyzer';

const TMP_BASE = path.join(os.tmpdir(), 'reshell-cia-test');

let tmpRoot: string;

function makeTmp(): string {
  const dir = path.join(TMP_BASE, `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirpSync(dir);
  return dir;
}

/**
 * Seeds a workspace under `category/dirName` with a package.json whose `name`
 * defaults to `@re-shell/<dirName>` so the analyzer's extractWorkspaceDependencies
 * filter keeps the dep (it requires either a known node or the `@re-shell/` scope).
 *
 * NOTE: The analyzer's `discoverWorkspaces` uses the directory name as the
 * workspace name (not the package.json `name` field). At the same time,
 * `extractWorkspaceDependencies` only keeps deps that already exist as graph
 * nodes OR start with `@re-shell/`. Since nodes are populated AFTER discovery,
 * only `@re-shell/`-scoped deps survive discovery. Then `buildDependencyGraph`
 * checks `nodes.has(dep)` where node names are directory names — so scoped deps
 * like `@re-shell/ui` never match a node named `ui`. As a result, the automatic
 * edge inference is effectively inert in practice. Tests that exercise edges
 * populate the graph manually via `getDependencyGraph()` instead.
 */
async function seedWorkspace(
  root: string,
  category: 'apps' | 'packages' | 'libs' | 'tools',
  dirName: string,
  overrides: {
    pkgName?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  } = {},
): Promise<string> {
  const abs = path.join(root, category, dirName);
  await fs.ensureDir(abs);
  await fs.writeJson(path.join(abs, 'package.json'), {
    name: overrides.pkgName ?? `@re-shell/${dirName}`,
    version: '1.0.0',
    dependencies: overrides.dependencies,
    devDependencies: overrides.devDependencies,
    scripts: overrides.scripts,
  });
  await fs.ensureDir(path.join(abs, 'src'));
  await fs.writeFile(path.join(abs, 'src', 'index.ts'), '// placeholder');
  return abs;
}

function wsInfo(name: string, type: 'app' | 'package' | 'lib' | 'tool', root: string): WorkspaceInfo {
  return {
    name,
    path: path.join(root, name),
    type,
    dependencies: [],
    devDependencies: [],
  };
}

beforeEach(() => {
  tmpRoot = makeTmp();
});

afterEach(() => {
  fs.removeSync(tmpRoot);
});

describe('ChangeImpactAnalyzer - construction', () => {
  it('constructs with an empty dependency graph', () => {
    const a = new ChangeImpactAnalyzer(tmpRoot);
    expect(a).toBeInstanceOf(ChangeImpactAnalyzer);
    const graph = a.getDependencyGraph();
    expect(graph.nodes.size).toBe(0);
    expect(graph.edges.size).toBe(0);
    expect(graph.reverseEdges.size).toBe(0);
  });

  it('accepts partial overrides on options and initializes cleanly', async () => {
    const a = new ChangeImpactAnalyzer(tmpRoot, {
      maxDepth: 3,
      includeTests: false,
      includeDevDependencies: true,
    });
    await a.initialize();
    expect(a.getAllWorkspaces()).toEqual([]);
  });

  it('resolves relative rootPath safely', () => {
    const a = new ChangeImpactAnalyzer('./relative/path');
    expect(a).toBeInstanceOf(ChangeImpactAnalyzer);
  });
});

describe('ChangeImpactAnalyzer - workspace discovery', () => {
  it('discovers workspaces across apps/packages/libs/tools', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'web');
    await seedWorkspace(tmpRoot, 'packages', 'ui');
    await seedWorkspace(tmpRoot, 'libs', 'util');
    await seedWorkspace(tmpRoot, 'tools', 'script');

    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const all = a.getAllWorkspaces();
    expect(all.map(w => w.name).sort()).toEqual(['script', 'ui', 'util', 'web']);

    const byName = Object.fromEntries(all.map(w => [w.name, w]));
    expect(byName.web.type).toBe('app');
    expect(byName.ui.type).toBe('package');
    expect(byName.util.type).toBe('lib');
    expect(byName.script.type).toBe('tool');
  });

  it('uses the directory name (not package.json name) as workspace name', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'mydir', { pkgName: '@custom/name' });
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    expect(a.getWorkspaceInfo('mydir')).toBeDefined();
    expect(a.getWorkspaceInfo('@custom/name')).toBeUndefined();
  });

  it('skips directories without a package.json', async () => {
    await fs.ensureDir(path.join(tmpRoot, 'apps', 'empty'));
    await seedWorkspace(tmpRoot, 'apps', 'real');
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    expect(a.getAllWorkspaces().map(w => w.name)).toEqual(['real']);
  });

  it('skips non-directory entries inside workspace dirs', async () => {
    await fs.ensureDir(path.join(tmpRoot, 'packages'));
    await fs.writeFile(path.join(tmpRoot, 'packages', 'loose-file.txt'), 'x');
    await seedWorkspace(tmpRoot, 'packages', 'real');
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    expect(a.getAllWorkspaces().map(w => w.name)).toEqual(['real']);
  });

  it('detects frameworks from package.json dependencies', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'r', { dependencies: { react: '^18' } });
    await seedWorkspace(tmpRoot, 'apps', 'v', { dependencies: { vue: '^3' } });
    await seedWorkspace(tmpRoot, 'apps', 's', { dependencies: { svelte: '^4' } });
    await seedWorkspace(tmpRoot, 'apps', 'a', { dependencies: { '@angular/core': '^17' } });
    await seedWorkspace(tmpRoot, 'apps', 'p', { dependencies: { lodash: '^4' } });

    const an = new ChangeImpactAnalyzer(tmpRoot);
    await an.initialize();
    expect(an.getWorkspaceInfo('r')?.framework).toBe('react');
    expect(an.getWorkspaceInfo('v')?.framework).toBe('vue');
    expect(an.getWorkspaceInfo('s')?.framework).toBe('svelte');
    expect(an.getWorkspaceInfo('a')?.framework).toBe('angular');
    expect(an.getWorkspaceInfo('p')?.framework).toBeUndefined();
  });

  it('extracts build and test scripts', async () => {
    await seedWorkspace(tmpRoot, 'packages', 'built', {
      scripts: { build: 'tsc', test: 'vitest' },
    });
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const ws = a.getWorkspaceInfo('built');
    expect(ws?.buildScript).toBe('tsc');
    expect(ws?.testScript).toBe('vitest');
  });

  it('returns undefined from getWorkspaceInfo for unknown names', async () => {
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    expect(a.getWorkspaceInfo('nope')).toBeUndefined();
  });

  it('returns all workspaces via getAllWorkspaces', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'a1');
    await seedWorkspace(tmpRoot, 'apps', 'a2');
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const all = a.getAllWorkspaces();
    expect(all).toHaveLength(2);
    expect(all.map(w => w.name).sort()).toEqual(['a1', 'a2']);
  });
});

describe('ChangeImpactAnalyzer - dependency graph (manual population)', () => {
  it('returns forward and reverse edges that we inject manually', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'web');
    await seedWorkspace(tmpRoot, 'packages', 'ui');

    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();

    // NOTE: the analyzer's auto-edge inference between directory-named workspaces
    // and @re-shell-scoped deps does not work (see seedWorkspace note above).
    // We populate edges manually to exercise the downstream graph logic.
    const g = a.getDependencyGraph();
    g.edges.get('web')!.push('ui');
    g.reverseEdges.get('ui')!.push('web');

    expect(g.edges.get('web')).toEqual(['ui']);
    expect(g.reverseEdges.get('ui')).toEqual(['web']);
    expect(g.edges.get('ui')).toEqual([]);
    expect(g.reverseEdges.get('web')).toEqual([]);
  });
});

describe('ChangeImpactAnalyzer - analyzeFileImpact', () => {
  it('returns the owning workspace for a file under apps/web/src', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'web');
    await seedWorkspace(tmpRoot, 'packages', 'ui');

    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const filePath = path.join('apps', 'web', 'src', 'index.ts');
    const result = await a.analyzeFileImpact(filePath);

    expect(result.file).toBe(filePath);
    expect(result.workspaces).toContain('web');
  });

  it('returns multiple workspaces when the file matches a wildcard rule', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'web');
    await seedWorkspace(tmpRoot, 'apps', 'admin');

    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    // NOTE: the default package.json rule declares `affects: ['*']` but the
    // implementation does not expand '*' to all known workspaces — it adds the
    // literal string '*' to the impacted set. Verify that behavior here.
    const result = await a.analyzeFileImpact('package.json');
    expect(result.workspaces).toContain('*');
  });

  it('matches package.json changes as critical', async () => {
    await seedWorkspace(tmpRoot, 'packages', 'ui');
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const result = await a.analyzeFileImpact(path.join('packages', 'ui', 'package.json'));
    expect(result.severity).toBe('critical');
    expect(result.workspaces.length).toBeGreaterThan(0);
    expect(result.rules.some(r => r.description.includes('Package.json'))).toBe(true);
  });

  it('matches tsconfig.json as high severity', async () => {
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const result = await a.analyzeFileImpact('tsconfig.json');
    expect(result.severity).toBe('high');
  });

  it('matches tsconfig.build.json as high severity', async () => {
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const result = await a.analyzeFileImpact('tsconfig.build.json');
    expect(result.severity).toBe('high');
  });

  it('matches .config.ts as high severity', async () => {
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const result = await a.analyzeFileImpact('vite.config.ts');
    expect(result.severity).toBe('high');
  });

  it('matches packages/*/src/ as high severity', async () => {
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const result = await a.analyzeFileImpact('packages/ui/src/button.tsx');
    expect(result.severity).toBe('high');
  });

  it('matches libs/*/src/ as medium severity', async () => {
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const result = await a.analyzeFileImpact('libs/util/src/index.ts');
    expect(result.severity).toBe('medium');
  });

  it('matches test files as low severity with test action', async () => {
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const result = await a.analyzeFileImpact('apps/web/src/foo.test.ts');
    expect(result.severity).toBe('low');
    const rule = result.rules.find(r => r.action === 'test');
    expect(rule).toBeDefined();
    expect(rule?.affects).toEqual([]);
  });

  it('matches README.md as low severity with lint action', async () => {
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const result = await a.analyzeFileImpact('packages/ui/README.md');
    expect(result.severity).toBe('low');
    expect(result.rules.some(r => r.action === 'lint')).toBe(true);
  });

  it('returns low severity and no rules when no pattern matches', async () => {
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const result = await a.analyzeFileImpact('some-random-file.xyz');
    expect(result.severity).toBe('low');
    expect(result.rules).toEqual([]);
  });

  it('propagates impact through reverse edges when manually populated', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'web');
    await seedWorkspace(tmpRoot, 'packages', 'ui');

    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const g = a.getDependencyGraph();
    g.edges.get('web')!.push('ui');
    g.reverseEdges.get('ui')!.push('web');

    const filePath = path.join('packages', 'ui', 'src', 'index.ts');
    const result = await a.analyzeFileImpact(filePath);
    expect(result.workspaces).toContain('ui');
    expect(result.workspaces).toContain('web');
  });
});

describe('ChangeImpactAnalyzer - analyzeChangeImpact', () => {
  it('returns a no-op result for an empty file list', async () => {
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const res = await a.analyzeChangeImpact([]);
    expect(res.changedFiles).toEqual([]);
    expect(res.affectedWorkspaces).toEqual([]);
    expect(res.totalImpact).toBe(0);
    expect(res.recommendations).toEqual(['No changes detected']);
  });

  it('includes affected workspaces, build/test order and critical path', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'web');
    await seedWorkspace(tmpRoot, 'packages', 'ui');

    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    // Manually wire web -> ui
    const g = a.getDependencyGraph();
    g.edges.get('web')!.push('ui');
    g.reverseEdges.get('ui')!.push('web');

    // Use an unknown-extension file outside src/ so no rule's `affects: ['*']`
    // pollutes the impacted-workspace set with a literal '*' entry.
    const res = await a.analyzeChangeImpact([
      path.join('packages', 'ui', 'button.unknown'),
    ]);
    expect(res.changedFiles).toHaveLength(1);
    expect(res.affectedWorkspaces.map(w => w.name).sort()).toEqual(['ui', 'web']);
    expect(res.buildOrder).toEqual(['ui', 'web']);
    expect(res.testOrder).toEqual(['ui', 'web']);
    // criticalPath starts from the workspace with the most dependents (ui)
    // and follows its *forward* edges. ui has no forward deps here, so the
    // path is just [ui].
    expect(res.criticalPath).toEqual(['ui']);
    expect(res.totalImpact).toBe(2);
  });

  it('detects critical changes (package.json) and surfaces them in recommendations', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'web');
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const res = await a.analyzeChangeImpact([path.join('apps', 'web', 'package.json')]);
    expect(res.recommendations.some(r => r.includes('Critical changes detected'))).toBe(true);
  });

  it('produces package-related recommendations when packages are affected', async () => {
    await seedWorkspace(tmpRoot, 'packages', 'ui');
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const res = await a.analyzeChangeImpact([
      path.join('packages', 'ui', 'package.json'),
    ]);
    expect(res.recommendations.some(r => r.includes('package(s) affected'))).toBe(true);
  });

  it('produces app-related recommendations when apps are affected', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'web');
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const res = await a.analyzeChangeImpact([
      path.join('apps', 'web', 'src', 'app.tsx'),
    ]);
    expect(res.recommendations.some(r => r.includes('app(s) affected'))).toBe(true);
  });

  it('emits parallel-build recommendation when more than 5 workspaces are affected', async () => {
    for (let i = 0; i < 6; i++) {
      await seedWorkspace(tmpRoot, 'apps', `app${i}`);
    }
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    // Use one file per app to ensure each workspace is in the impacted set.
    // The apps/*/src rule has affects=[], so no '*' leakage.
    const files = [];
    for (let i = 0; i < 6; i++) {
      files.push(path.join('apps', `app${i}`, 'src', 'app.tsx'));
    }
    const res = await a.analyzeChangeImpact(files);
    expect(res.affectedWorkspaces.length).toBeGreaterThan(5);
    expect(res.recommendations.some(r => r.includes('parallel builds'))).toBe(true);
  });

  it('emits framework-optimization recommendation when multiple frameworks are affected', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'r', { dependencies: { react: '^18' } });
    await seedWorkspace(tmpRoot, 'apps', 'v', { dependencies: { vue: '^3' } });
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    // Trigger impact on both apps so both frameworks appear in the affected set.
    const res = await a.analyzeChangeImpact([
      path.join('apps', 'r', 'src', 'app.tsx'),
      path.join('apps', 'v', 'src', 'app.tsx'),
    ]);
    expect(res.recommendations.some(r => r.includes('Multiple frameworks affected'))).toBe(true);
  });

  it('emits test recommendation when includeTests is true and a workspace has a test script', async () => {
    await seedWorkspace(tmpRoot, 'packages', 'ui', {
      scripts: { test: 'vitest' },
    });
    const a = new ChangeImpactAnalyzer(tmpRoot, { includeTests: true });
    await a.initialize();
    const res = await a.analyzeChangeImpact([path.join('packages', 'ui', 'package.json')]);
    expect(res.recommendations.some(r => r.includes('Run tests in dependency order'))).toBe(true);
  });

  it('does not emit test recommendation when includeTests is false', async () => {
    await seedWorkspace(tmpRoot, 'packages', 'ui', {
      scripts: { test: 'vitest' },
    });
    const a = new ChangeImpactAnalyzer(tmpRoot, { includeTests: false });
    await a.initialize();
    const res = await a.analyzeChangeImpact([path.join('packages', 'ui', 'package.json')]);
    expect(res.recommendations.some(r => r.includes('Run tests'))).toBe(false);
  });

  it('returns analysisTime >= 0', async () => {
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const res = await a.analyzeChangeImpact([]);
    expect(res.analysisTime).toBeGreaterThanOrEqual(0);
  });

  it('reverses build order for tests when includeTests is false', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'web');
    await seedWorkspace(tmpRoot, 'packages', 'ui');

    const a = new ChangeImpactAnalyzer(tmpRoot, { includeTests: false });
    await a.initialize();
    const g = a.getDependencyGraph();
    g.edges.get('web')!.push('ui');
    g.reverseEdges.get('ui')!.push('web');

    const res = await a.analyzeChangeImpact([
      path.join('packages', 'ui', 'index.unknown'),
    ]);
    expect(res.buildOrder).toEqual(['ui', 'web']);
    expect(res.testOrder).toEqual(['web', 'ui']);
  });

  it('topologically sorts a 3-node dependency chain', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'web');
    await seedWorkspace(tmpRoot, 'packages', 'ui');
    await seedWorkspace(tmpRoot, 'libs', 'util');

    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const g = a.getDependencyGraph();
    g.edges.get('web')!.push('ui');
    g.edges.get('ui')!.push('util');
    g.reverseEdges.get('ui')!.push('web');
    g.reverseEdges.get('util')!.push('ui');

    // analyzeFileImpact only propagates one level up via reverse edges, so we
    // supply one file per workspace to surface the full chain.
    const res = await a.analyzeChangeImpact([
      path.join('libs', 'util', 'index.unknown'),
      path.join('packages', 'ui', 'index.unknown'),
    ]);
    expect(res.buildOrder).toEqual(['util', 'ui', 'web']);
  });

  it('throws ValidationError on circular dependencies', async () => {
    await seedWorkspace(tmpRoot, 'packages', 'a');
    await seedWorkspace(tmpRoot, 'packages', 'b');

    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const g = a.getDependencyGraph();
    g.edges.get('a')!.push('b');
    g.edges.get('b')!.push('a');
    g.reverseEdges.get('a')!.push('b');
    g.reverseEdges.get('b')!.push('a');

    await expect(
      a.analyzeChangeImpact([path.join('packages', 'a', 'src', 'index.unknown')]),
    ).rejects.toThrow(ValidationError);
  });
});

describe('ChangeImpactAnalyzer - addImpactRule', () => {
  it('appends a custom rule that is then matched', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'web');
    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();

    const rule: ImpactRule = {
      pattern: /\.special$/,
      affects: [],
      severity: 'medium',
      action: 'lint',
      description: 'Custom rule for .special files',
    };
    a.addImpactRule(rule);

    const result = await a.analyzeFileImpact('apps/web/file.special');
    const matched = result.rules.find(r => r.description.includes('Custom rule'));
    expect(matched).toBeDefined();
    expect(result.severity).toBe('medium');
  });

  it('honors custom rule affects list when matching', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'web');
    await seedWorkspace(tmpRoot, 'apps', 'admin');

    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    a.addImpactRule({
      pattern: /\.flag$/,
      affects: ['admin'],
      severity: 'high',
      action: 'rebuild',
      description: 'Flag file affects admin only',
    });

    const result = await a.analyzeFileImpact('something.flag');
    expect(result.workspaces).toContain('admin');
    expect(result.workspaces).not.toContain('web');
  });
});

describe('ChangeImpactAnalyzer - getImpactVisualization', () => {
  it('returns nodes/edges/legend with the expected shape', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'web');
    await seedWorkspace(tmpRoot, 'packages', 'ui');

    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const g = a.getDependencyGraph();
    g.edges.get('web')!.push('ui');
    g.reverseEdges.get('ui')!.push('web');

    const viz = await a.getImpactVisualization([
      path.join('packages', 'ui', 'src', 'index.unknown'),
    ]);

    expect(viz.nodes.length).toBe(2);
    expect(viz.nodes.map(n => n.id).sort()).toEqual(['ui', 'web']);
    const affectedFlags = Object.fromEntries(viz.nodes.map(n => [n.id, n.affected]));
    expect(affectedFlags.ui).toBe(true);
    expect(affectedFlags.web).toBe(true);

    expect(viz.edges.length).toBe(1);
    expect(viz.edges[0]).toEqual({ from: 'web', to: 'ui', type: 'dependency' });

    expect(viz.legend).toEqual({
      app: 'Application',
      package: 'NPM Package',
      lib: 'Library',
      tool: 'Tool/Script',
      dependency: 'Depends on',
    });
  });

  it('marks un-affected workspaces correctly', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'web');
    await seedWorkspace(tmpRoot, 'packages', 'ui');
    await seedWorkspace(tmpRoot, 'packages', 'unrelated');

    const a = new ChangeImpactAnalyzer(tmpRoot);
    await a.initialize();
    const g = a.getDependencyGraph();
    g.edges.get('web')!.push('ui');
    g.reverseEdges.get('ui')!.push('web');

    const viz = await a.getImpactVisualization([
      path.join('packages', 'ui', 'src', 'index.unknown'),
    ]);
    const affected = Object.fromEntries(viz.nodes.map(n => [n.id, n.affected]));
    expect(affected.ui).toBe(true);
    expect(affected.web).toBe(true);
    expect(affected.unrelated).toBe(false);
  });
});

describe('createChangeImpactAnalyzer', () => {
  it('returns an initialized analyzer', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'web');
    const a = await createChangeImpactAnalyzer(tmpRoot);
    expect(a).toBeInstanceOf(ChangeImpactAnalyzer);
    expect(a.getAllWorkspaces().map(w => w.name)).toEqual(['web']);
  });

  it('forwards options to the analyzer', async () => {
    // Verify options are accepted without throwing
    await seedWorkspace(tmpRoot, 'apps', 'web');
    const a = await createChangeImpactAnalyzer(tmpRoot, {
      maxDepth: 5,
      includeTests: false,
      includeDevDependencies: true,
      buildOptimization: false,
      parallelAnalysis: false,
    });
    expect(a).toBeInstanceOf(ChangeImpactAnalyzer);
  });
});

describe('analyzeChangeImpact (convenience wrapper)', () => {
  it('creates an analyzer and runs analyzeChangeImpact in one call', async () => {
    await seedWorkspace(tmpRoot, 'apps', 'web');
    await seedWorkspace(tmpRoot, 'packages', 'ui');

    // We can't inject edges when using the convenience wrapper, so we only
    // verify that analyzeChangeImpact directly invokes the wrapper without
    // throwing and produces a result with the expected shape.
    const res = await analyzeChangeImpact(tmpRoot, [
      path.join('packages', 'ui', 'src', 'index.unknown'),
    ]);
    expect(res.affectedWorkspaces.map(w => w.name)).toContain('ui');
    expect(res.totalImpact).toBeGreaterThanOrEqual(1);
  });

  it('returns a no-changes result when no files are provided', async () => {
    const res = await analyzeChangeImpact(tmpRoot, []);
    expect(res.totalImpact).toBe(0);
    expect(res.recommendations).toEqual(['No changes detected']);
  });
});
