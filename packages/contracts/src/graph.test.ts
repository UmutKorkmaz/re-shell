import { describe, expect, it } from 'vitest';

import {
  buildGraphIndex,
  contractGraphToModel,
  diffGraphs,
  diffToMermaid,
  diffToRenderableGraph,
  edgeKey,
  findCycles,
  normalizeGraph,
  parseGraphDocument,
  reachableFrom,
  rollupStatus,
  shortestDependencyPath,
  toD3,
  toD3Json,
  toMermaid,
  toRawJson,
  workspaceGraphDiffSchema,
  type GraphModel,
} from './graph.js';

const N = (id: string, type = 'package', extra: Record<string, unknown> = {}) => ({ id, type, ...extra });
const E = (from: string, to: string, type: 'dependency' | 'devDependency' = 'dependency') => ({ from, to, type });

const SAMPLE: GraphModel = {
  nodes: [N('@acme/web', 'app', { framework: 'react-ts' }), N('@acme/ui', 'lib'), N('core', 'package'), N('cli-tool', 'tool')],
  edges: [E('@acme/web', '@acme/ui'), E('@acme/ui', 'core'), E('@acme/web', 'core', 'devDependency')],
};

describe('normalizeGraph', () => {
  it('drops duplicate nodes/edges and dangling edges', () => {
    const g = normalizeGraph({
      nodes: [N('a'), N('a', 'app'), N('b')],
      edges: [E('a', 'b'), E('a', 'b', 'devDependency'), E('a', 'ghost')],
    });
    expect(g.nodes.map((n) => [n.id, n.type])).toEqual([['a', 'app'], ['b', 'package']]);
    expect(g.edges).toEqual([E('a', 'b', 'devDependency')]);
  });
});

describe('parseGraphDocument', () => {
  it('reads the consumer contract { apps, services } (and its JSON envelope)', () => {
    const contract = {
      apps: [{ name: 'web', path: 'apps/web', framework: 'react-ts', dependencies: ['ui', 'external'] }],
      services: [
        { name: 'ui', path: 'packages/ui', framework: null, dependencies: ['core'], type: 'lib', language: 'typescript' },
        { name: 'core', path: 'packages/core', framework: null, dependencies: [] },
      ],
    };
    const model = parseGraphDocument({ ok: true, data: contract, warnings: [] });
    expect(model.nodes.map((n) => `${n.id}:${n.type}`)).toEqual(['web:app', 'ui:lib', 'core:package']);
    expect(model.edges.map((e) => `${e.from}>${e.to}`)).toEqual(['web>ui', 'ui>core']);
    expect(model.nodes.find((n) => n.id === 'ui')?.language).toBe('typescript');
    expect(contractGraphToModel(contract)).toEqual(model);
  });

  it('reads the rich { nodes, edges } file output and the D3 { nodes, links } export', () => {
    const rich = parseGraphDocument({
      nodes: [{ id: 'a', type: 'app', framework: 'vue', path: 'apps/a' }, { id: 'b', type: 'lib' }],
      edges: [{ from: 'a', to: 'b', type: 'devDependency' }],
    });
    expect(rich.edges).toEqual([E('a', 'b', 'devDependency')]);
    const d3 = parseGraphDocument(JSON.parse(toD3Json(rich)));
    expect(d3.nodes.map((n) => [n.id, n.type, n.framework ?? null])).toEqual([
      ['a', 'app', 'vue'],
      ['b', 'lib', null],
    ]);
    expect(d3.edges).toEqual(rich.edges);
  });

  it('throws precise errors for unusable documents', () => {
    expect(() => parseGraphDocument(null)).toThrow(/JSON object/);
    expect(() => parseGraphDocument([])).toThrow(/JSON object/);
    expect(() => parseGraphDocument({ ok: false, error: {} })).toThrow(/error envelope/);
    expect(() => parseGraphDocument({ foo: 1 })).toThrow(/unrecognised/);
    expect(() => parseGraphDocument({ nodes: [{ name: 'x' }] })).toThrow(/"id"/);
    expect(() => parseGraphDocument({ nodes: [{ id: 'x' }], edges: [{ from: 'x' }] })).toThrow(/from\/to/);
    expect(() => parseGraphDocument({ apps: [{ path: 'x' }] })).toThrow(/"name"/);
  });
});

describe('converters', () => {
  it('toMermaid sanitises scoped names, keeps labels, shapes by type, dotted dev edges', () => {
    const out = toMermaid(SAMPLE);
    expect(out.startsWith('graph TD\n')).toBe(true);
    expect(out).toContain('_acme_web["@acme/web"]');
    expect(out).toContain('_acme_ui{"@acme/ui"}');
    expect(out).toContain('core("core")');
    expect(out).toContain('cli_tool[["cli-tool"]]');
    expect(out).toContain('_acme_web --> _acme_ui');
    expect(out).toContain('_acme_web -.-> core');
  });

  it('toMermaid never emits colliding or reserved ids', () => {
    const out = toMermaid({ nodes: [N('end'), N('a-b'), N('a_b'), N('1x'), N('@')], edges: [E('end', 'a-b')] });
    const ids = [...out.matchAll(/^ {2}(\w+)[\[({]/gm)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('end');
    expect(ids.every((id) => !/^[0-9]/.test(id))).toBe(true);
    expect(ids).toHaveLength(5);
  });

  it('escapes double quotes in labels', () => {
    expect(toMermaid({ nodes: [N('we"ird')], edges: [] })).toContain('("we#quot;ird")');
  });

  it('toD3 / toD3Json match the CLI d3 format', () => {
    const d3 = toD3(SAMPLE);
    expect(d3.nodes[0]).toEqual({ id: '@acme/web', group: 'app', type: 'app', framework: 'react-ts' });
    expect(d3.links[2]).toEqual({ source: '@acme/web', target: 'core', type: 'devDependency' });
    expect(JSON.parse(toD3Json(SAMPLE))).toEqual(JSON.parse(JSON.stringify(d3)));
  });

  it('toRawJson round-trips through parseGraphDocument', () => {
    const parsed = parseGraphDocument(JSON.parse(toRawJson(SAMPLE)));
    expect(parsed.nodes.map((n) => n.id)).toEqual(SAMPLE.nodes.map((n) => n.id));
    expect(diffGraphs(parsed, SAMPLE).summary.hasChanges).toBe(false);
  });
});

describe('analysis', () => {
  const index = buildGraphIndex(SAMPLE);

  it('walks upstream and downstream transitively', () => {
    expect([...reachableFrom(index, '@acme/web', 'dependencies')].sort()).toEqual(['@acme/ui', 'core']);
    expect([...reachableFrom(index, 'core', 'dependents')].sort()).toEqual(['@acme/ui', '@acme/web']);
    expect(reachableFrom(index, 'cli-tool', 'dependencies').size).toBe(0);
    expect(reachableFrom(index, 'missing', 'dependents').size).toBe(0);
  });

  it('finds the shortest path in either direction', () => {
    expect(shortestDependencyPath(index, '@acme/web', 'core')).toEqual({ path: ['@acme/web', 'core'], dependent: 'a' });
    expect(shortestDependencyPath(index, 'core', '@acme/ui')).toEqual({ path: ['@acme/ui', 'core'], dependent: 'b' });
    expect(shortestDependencyPath(index, 'cli-tool', 'core')).toBeNull();
    expect(shortestDependencyPath(index, 'core', 'nope')).toBeNull();
    expect(shortestDependencyPath(index, 'core', 'core')).toEqual({ path: ['core'], dependent: 'a' });
  });

  it('shortest path picks the fewest hops', () => {
    const g = buildGraphIndex({
      nodes: ['a', 'b', 'c', 'd'].map((id) => N(id)),
      edges: [E('a', 'b'), E('b', 'c'), E('c', 'd'), E('a', 'd')],
    });
    expect(shortestDependencyPath(g, 'a', 'd')?.path).toEqual(['a', 'd']);
  });

  it('reports no cycles on a DAG', () => {
    const report = findCycles(index);
    expect(report.cycles).toEqual([]);
    expect(report.nodeIds.size).toBe(0);
  });

  it('detects multi-node and self-loop cycles with their edges', () => {
    const g = buildGraphIndex({
      nodes: ['a', 'b', 'c', 'd', 'e'].map((id) => N(id)),
      edges: [E('a', 'b'), E('b', 'c'), E('c', 'a'), E('c', 'd'), E('e', 'e')],
    });
    const report = findCycles(g);
    expect(report.cycles).toEqual([['a', 'b', 'c'], ['e']]);
    expect([...report.nodeIds].sort()).toEqual(['a', 'b', 'c', 'e']);
    expect(report.edgeKeys.has(edgeKey('a', 'b'))).toBe(true);
    expect(report.edgeKeys.has(edgeKey('c', 'd'))).toBe(false);
    expect(report.edgeKeys.has(edgeKey('e', 'e'))).toBe(true);
  });

  it('handles a 20k-node chain without recursion or quadratic work', () => {
    const nodes = Array.from({ length: 20000 }, (_, i) => N(`n${i}`));
    const edges = nodes.slice(1).map((n, i) => E(`n${i}`, n.id));
    edges.push(E('n19999', 'n0'));
    const started = Date.now();
    const g = buildGraphIndex({ nodes, edges });
    const report = findCycles(g);
    expect(report.cycles).toHaveLength(1);
    expect(report.cycles[0]).toHaveLength(20000);
    expect(reachableFrom(g, 'n0', 'dependencies').size).toBe(20000);
    expect(shortestDependencyPath(g, 'n0', 'n19999')?.path).toHaveLength(20000);
    expect(Date.now() - started).toBeLessThan(5000);
  });
});

describe('diffGraphs', () => {
  const base: GraphModel = {
    nodes: [N('web', 'app', { framework: 'react', path: 'apps/web' }), N('ui', 'lib'), N('core'), N('old')],
    edges: [E('web', 'ui'), E('ui', 'core'), E('old', 'core'), E('web', 'core', 'devDependency')],
  };
  const head: GraphModel = {
    nodes: [
      N('web', 'app', { framework: 'react-ts', path: 'apps/web' }),
      N('ui', 'lib'),
      N('core'),
      N('newpkg', 'package', { language: 'go' }),
    ],
    edges: [E('web', 'ui'), E('ui', 'core'), E('newpkg', 'core'), E('web', 'core', 'dependency'), E('web', 'newpkg')],
  };

  it('computes added / removed / changed nodes and edges', () => {
    const diff = diffGraphs(base, head);
    expect(diff.nodes.added.map((n) => n.id)).toEqual(['newpkg']);
    expect(diff.nodes.removed.map((n) => n.id)).toEqual(['old']);
    expect(diff.nodes.changed).toHaveLength(1);
    expect(diff.nodes.changed[0]).toMatchObject({ id: 'web', fields: ['framework'] });
    expect(diff.nodes.changed[0].before.framework).toBe('react');
    expect(diff.nodes.changed[0].after.framework).toBe('react-ts');
    expect(diff.edges.added.map((e) => `${e.from}>${e.to}`).sort()).toEqual(['newpkg>core', 'web>newpkg']);
    expect(diff.edges.removed.map((e) => `${e.from}>${e.to}`)).toEqual(['old>core']);
    expect(diff.edges.changed).toEqual([{ from: 'web', to: 'core', before: 'devDependency', after: 'dependency' }]);
    expect(diff.summary).toEqual({
      nodesAdded: 1,
      nodesRemoved: 1,
      nodesChanged: 1,
      edgesAdded: 2,
      edgesRemoved: 1,
      edgesChanged: 1,
      hasChanges: true,
    });
    // `core` is an unchanged endpoint of touched edges -> context. `ui` has no touched edges.
    expect(diff.context.map((n) => n.id)).toEqual(['core']);
  });

  it('is empty for identical graphs and treats null/undefined/"" attributes as equal', () => {
    const same = diffGraphs(base, JSON.parse(JSON.stringify(base)));
    expect(same.summary.hasChanges).toBe(false);
    expect(same.context).toEqual([]);
    const a: GraphModel = { nodes: [N('x', 'package', { framework: null })], edges: [] };
    const b: GraphModel = { nodes: [N('x', 'package', { framework: undefined, language: '' })], edges: [] };
    expect(diffGraphs(a, b).summary.hasChanges).toBe(false);
  });

  it('detects type and path changes, and ignores node/edge ordering', () => {
    const a: GraphModel = { nodes: [N('x', 'lib', { path: 'p1' }), N('y')], edges: [E('x', 'y')] };
    const b: GraphModel = { nodes: [N('y'), N('x', 'app', { path: 'p2' })], edges: [E('x', 'y')] };
    expect(diffGraphs(a, b).nodes.changed[0].fields).toEqual(['type', 'path']);
    expect(diffGraphs(a, b).edges.added).toEqual([]);
  });

  it('reports cycles introduced by the head only', () => {
    const acyclic: GraphModel = { nodes: [N('a'), N('b')], edges: [E('a', 'b')] };
    const cyclic: GraphModel = { nodes: [N('a'), N('b')], edges: [E('a', 'b'), E('b', 'a')] };
    expect(diffGraphs(acyclic, cyclic).cyclesIntroduced).toEqual([['a', 'b']]);
    expect(diffGraphs(cyclic, cyclic).cyclesIntroduced).toEqual([]);
    expect(diffGraphs(cyclic, acyclic).cyclesIntroduced).toEqual([]);
  });

  it('handles an empty base or head', () => {
    const empty: GraphModel = { nodes: [], edges: [] };
    expect(diffGraphs(empty, base).summary.nodesAdded).toBe(4);
    expect(diffGraphs(base, empty).summary).toMatchObject({ nodesRemoved: 4, edgesRemoved: 4 });
  });

  it('diffs two 3000-node graphs in linear time', () => {
    const mk = (n: number, offset: number): GraphModel => ({
      nodes: Array.from({ length: n }, (_, i) => N(`p${i + offset}`)),
      edges: Array.from({ length: n - 1 }, (_, i) => E(`p${i + offset + 1}`, `p${i + offset}`)),
    });
    const started = Date.now();
    const diff = diffGraphs(mk(3000, 0), mk(3000, 10));
    expect(diff.summary.nodesAdded).toBe(10);
    expect(diff.summary.nodesRemoved).toBe(10);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('produces a payload that satisfies workspaceGraphDiffSchema', () => {
    const payload = {
      ...diffGraphs(base, head),
      base: { ref: 'main', kind: 'git', commit: 'abc', nodeCount: 4, edgeCount: 4 },
      head: { ref: 'working-tree', kind: 'working-tree', nodeCount: 4, edgeCount: 5 },
    };
    expect(workspaceGraphDiffSchema.safeParse(payload).success).toBe(true);
  });

  it('renders the change-set with status maps and as Mermaid with colour classes', () => {
    const diff = diffGraphs(base, head);
    const view = diffToRenderableGraph(diff);
    expect(view.nodeStatus.get('newpkg')).toBe('added');
    expect(view.nodeStatus.get('old')).toBe('removed');
    expect(view.nodeStatus.get('web')).toBe('changed');
    expect(view.nodeStatus.get('core')).toBe('unchanged');
    expect(view.nodeStatus.has('ui')).toBe(false);
    expect(view.edgeStatus.get(edgeKey('old', 'core'))).toBe('removed');
    expect(view.graph.edges.every((e) => view.nodeStatus.has(e.from) && view.nodeStatus.has(e.to))).toBe(true);
    const mermaid = diffToMermaid(diff);
    expect(mermaid).toContain(':::added');
    expect(mermaid).toContain(':::removed');
    expect(mermaid).toContain(':::changed');
    expect(mermaid).toContain('classDef added');
    expect(mermaid).toMatch(/linkStyle \d+ stroke:#2da44e/);
    expect(mermaid).toMatch(/linkStyle \d+ stroke:#cf222e/);
  });
});

describe('rollupStatus', () => {
  it('ranks unhealthy > running > stopped > unknown', () => {
    expect(rollupStatus(['running', 'unhealthy'])).toBe('unhealthy');
    expect(rollupStatus(['stopped', 'running'])).toBe('running');
    expect(rollupStatus(['stopped', 'unknown'])).toBe('stopped');
    expect(rollupStatus([])).toBe('unknown');
  });
});
