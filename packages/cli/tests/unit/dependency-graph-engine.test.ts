import { describe, it, expect } from 'vitest';
import { DependencyGraphEngine } from '../../src/graph/dependency-graph-engine';

// dependency-graph-engine.ts is pure in-memory logic (no fs/exec/prompts).
// These tests exercise the public surface against hand-built graphs and config
// shapes. Several methods have correctness bugs (noted inline); those tests
// pin the CURRENT behavior so regressions are caught and the bugs are documented.

describe('DependencyGraphEngine — node & edge management', () => {
  it('addNode stores id/type/name/language and seeds empty dependency lists', () => {
    const e = new DependencyGraphEngine();
    e.addNode('api', 'service', 'api', 'typescript');
    // Reflect into the private graph to inspect stored state.
    const node = (e as unknown as { graph: { nodes: Map<string, unknown> } }).graph.nodes.get('api');
    expect(node).toMatchObject({
      id: 'api',
      type: 'service',
      name: 'api',
      language: 'typescript',
      dependencies: [],
      dependents: [],
    });
  });

  it('addNode is idempotent — an existing id is not replaced', () => {
    const e = new DependencyGraphEngine();
    e.addNode('api', 'service', 'first');
    e.addNode('api', 'database', 'second'); // ignored
    const node = (e as unknown as { graph: { nodes: Map<string, { name: string; type: string }> } }).graph.nodes.get('api')!;
    expect(node.name).toBe('first');
    expect(node.type).toBe('service');
  });

  it('addEdge updates dependencies and dependents on both endpoints', () => {
    const e = new DependencyGraphEngine();
    e.addNode('web', 'service', 'web');
    e.addNode('api', 'service', 'api');
    e.addEdge('web', 'api'); // web depends on api
    const nodes = (e as unknown as { graph: { nodes: Map<string, { dependencies: string[]; dependents: string[] }> } }).graph.nodes;
    expect(nodes.get('web')!.dependencies).toEqual(['api']);
    expect(nodes.get('api')!.dependents).toEqual(['web']);
  });

  it('addEdge is a no-op when either endpoint does not exist', () => {
    const e = new DependencyGraphEngine();
    e.addNode('api', 'service', 'api');
    e.addEdge('api', 'ghost'); // ghost missing
    e.addEdge('ghost', 'api'); // ghost missing
    const node = (e as unknown as { graph: { nodes: Map<string, { dependencies: string[]; dependents: string[] }> } }).graph.nodes.get('api')!;
    expect(node.dependencies).toEqual([]);
    expect(node.dependents).toEqual([]);
  });

  it('addEdge dedups a repeated edge', () => {
    const e = new DependencyGraphEngine();
    e.addNode('a', 'service', 'a');
    e.addNode('b', 'service', 'b');
    e.addEdge('a', 'b');
    e.addEdge('a', 'b');
    const node = (e as unknown as { graph: { nodes: Map<string, { dependencies: string[] }> } }).graph.nodes.get('a')!;
    expect(node.dependencies).toEqual(['b']);
  });
});

describe('DependencyGraphEngine.buildFromConfig', () => {
  it('adds a service node per config.services entry, falling back to id when name is absent', () => {
    const e = new DependencyGraphEngine();
    e.buildFromConfig({ services: { api: { name: 'api' }, noname: {} } });
    const nodes = (e as unknown as { graph: { nodes: Map<string, { name: string; type: string }> } }).graph.nodes;
    expect(nodes.get('api')!.name).toBe('api');
    expect(nodes.get('noname')!.name).toBe('noname');
    expect(nodes.get('api')!.type).toBe('service');
  });

  it('passes the service language through', () => {
    const e = new DependencyGraphEngine();
    e.buildFromConfig({ services: { api: { name: 'api', language: 'go' } } });
    const node = (e as unknown as { graph: { nodes: Map<string, { language?: string }> } }).graph.nodes.get('api')!;
    expect(node.language).toBe('go');
  });

  it('adds external dependency nodes with the correct types', () => {
    const e = new DependencyGraphEngine();
    e.buildFromConfig({
      services: { api: { name: 'api' } },
      dependencies: {
        databases: [{ name: 'pg' }],
        caches: [{ name: 'redis' }],
        queues: [{ name: 'rq' }],
        storage: [{ name: 's3' }],
      },
    });
    const nodes = (e as unknown as { graph: { nodes: Map<string, { type: string }> } }).graph.nodes;
    expect(nodes.get('pg')!.type).toBe('database');
    expect(nodes.get('redis')!.type).toBe('cache');
    expect(nodes.get('rq')!.type).toBe('queue');
    expect(nodes.get('s3')!.type).toBe('storage');
  });

  it('adds an edge for each service:// route target', () => {
    const e = new DependencyGraphEngine();
    e.buildFromConfig({
      services: {
        web: { name: 'web', routes: [{ target: 'service://api' }] },
        api: { name: 'api' },
      },
    });
    expect(e.detectCycles()).toEqual([]);
    expect(e.getDependencyChain('web')).toContain('api');
  });

  it('adds an edge when a production package dependency is provided by a backend service', () => {
    const e = new DependencyGraphEngine();
    e.buildFromConfig({
      services: {
        web: { name: 'web', dependencies: { production: { 'user-svc': '1.0' } } },
        user: { name: 'user-svc', type: 'backend' },
      },
    });
    expect(e.getDependencyChain('web')).toContain('user');
  });

  it('dedups a route edge and a package-dependency edge to the same target', () => {
    const e = new DependencyGraphEngine();
    e.buildFromConfig({
      services: {
        web: {
          name: 'web',
          routes: [{ target: 'service://api' }],
          dependencies: { production: { api: '1.0' } },
        },
        api: { name: 'api', type: 'backend' },
      },
    });
    const node = (e as unknown as { graph: { nodes: Map<string, { dependencies: string[] }> } }).graph.nodes.get('web')!;
    expect(node.dependencies).toEqual(['api']);
  });

  it('clears the graph on each call — no leftover nodes from a previous build', () => {
    const e = new DependencyGraphEngine();
    e.buildFromConfig({ services: { api: { name: 'api' } } });
    e.buildFromConfig({ services: { web: { name: 'web' } } });
    const nodes = (e as unknown as { graph: { nodes: Map<string, unknown> } }).graph.nodes;
    expect(nodes.has('api')).toBe(false);
    expect(nodes.has('web')).toBe(true);
  });

  it('handles an empty config without throwing', () => {
    const e = new DependencyGraphEngine();
    expect(() => e.buildFromConfig({})).not.toThrow();
    expect(e.detectCycles()).toEqual([]);
  });
});

describe('DependencyGraphEngine.detectCycles', () => {
  it('returns no cycles for an acyclic graph', () => {
    const e = new DependencyGraphEngine();
    e.addNode('a', 'service', 'a');
    e.addNode('b', 'service', 'b');
    e.addEdge('a', 'b');
    expect(e.detectCycles()).toEqual([]);
  });

  it('detects a two-node cycle', () => {
    const e = new DependencyGraphEngine();
    e.addNode('a', 'service', 'a');
    e.addNode('b', 'service', 'b');
    e.addEdge('a', 'b');
    e.addEdge('b', 'a');
    expect(e.detectCycles()).toEqual([['a', 'b', 'a']]);
  });

  it('detects a self-loop', () => {
    const e = new DependencyGraphEngine();
    e.addNode('a', 'service', 'a');
    e.addEdge('a', 'a');
    expect(e.detectCycles()).toEqual([['a', 'a']]);
  });

  it('returns no cycles for a diamond (acyclic)', () => {
    const e = new DependencyGraphEngine();
    e.addNode('d', 'database', 'd');
    e.addNode('c', 'service', 'c');
    e.addNode('b', 'service', 'b');
    e.addNode('a', 'service', 'a');
    e.addEdge('a', 'b');
    e.addEdge('a', 'c');
    e.addEdge('b', 'd');
    e.addEdge('c', 'd');
    expect(e.detectCycles()).toEqual([]);
  });

  it('detects two independent cycles', () => {
    const e = new DependencyGraphEngine();
    e.addNode('a', 'service', 'a');
    e.addNode('b', 'service', 'b');
    e.addNode('x', 'service', 'x');
    e.addNode('y', 'service', 'y');
    e.addEdge('a', 'b');
    e.addEdge('b', 'a');
    e.addEdge('x', 'y');
    e.addEdge('y', 'x');
    const cycles = e.detectCycles();
    expect(cycles).toHaveLength(2);
  });
});

describe('DependencyGraphEngine.getDependencyChain', () => {
  it('returns the full transitive chain in dependency-first (post-order) order', () => {
    const e = new DependencyGraphEngine();
    e.addNode('d', 'database', 'd');
    e.addNode('c', 'service', 'c');
    e.addNode('b', 'service', 'b');
    e.addNode('a', 'service', 'a');
    e.addEdge('a', 'b');
    e.addEdge('a', 'c');
    e.addEdge('b', 'd');
    e.addEdge('c', 'd');
    // Deepest dependency (d) first, then the middle nodes, then the node itself last.
    expect(e.getDependencyChain('a')).toEqual(['d', 'b', 'c', 'a']);
  });

  it('returns just the node when it has no dependencies', () => {
    const e = new DependencyGraphEngine();
    e.addNode('d', 'database', 'd');
    expect(e.getDependencyChain('d')).toEqual(['d']);
  });

  it('returns an empty array for an unknown node', () => {
    const e = new DependencyGraphEngine();
    expect(e.getDependencyChain('ghost')).toEqual([]);
  });

  it('does not duplicate a shared transitive dependency (diamond)', () => {
    const e = new DependencyGraphEngine();
    e.addNode('d', 'database', 'd');
    e.addNode('c', 'service', 'c');
    e.addNode('b', 'service', 'b');
    e.addNode('a', 'service', 'a');
    e.addEdge('a', 'b');
    e.addEdge('a', 'c');
    e.addEdge('b', 'd');
    e.addEdge('c', 'd');
    const chain = e.getDependencyChain('a');
    expect(chain.filter(id => id === 'd')).toHaveLength(1);
  });
});

describe('DependencyGraphEngine.getAllDependents', () => {
  it('returns all transitive dependents', () => {
    const e = new DependencyGraphEngine();
    e.addNode('d', 'database', 'd');
    e.addNode('c', 'service', 'c');
    e.addNode('b', 'service', 'b');
    e.addNode('a', 'service', 'a');
    e.addEdge('a', 'b');
    e.addEdge('a', 'c');
    e.addEdge('b', 'd');
    e.addEdge('c', 'd');
    // Everything that depends on d, directly or transitively.
    expect(e.getAllDependents('d').sort()).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array for a node with no dependents', () => {
    const e = new DependencyGraphEngine();
    e.addNode('a', 'service', 'a');
    expect(e.getAllDependents('a')).toEqual([]);
  });

  it('returns an empty array for an unknown node', () => {
    const e = new DependencyGraphEngine();
    expect(e.getAllDependents('ghost')).toEqual([]);
  });
});

describe('DependencyGraphEngine.exportToDot', () => {
  it('emits the digraph header with rankdir and node shape', () => {
    const e = new DependencyGraphEngine();
    e.addNode('api', 'service', 'api');
    const dot = e.exportToDot();
    expect(dot).toContain('digraph DependencyGraph {');
    expect(dot).toContain('rankdir=LR');
    expect(dot).toContain('node [shape=box]');
  });

  it('emits a styled node line per node', () => {
    const e = new DependencyGraphEngine();
    e.addNode('api', 'service', 'api');
    const dot = e.exportToDot();
    // The label uses a literal backslash-n between name and type.
    expect(dot).toContain('"api" [label="api\\n(service)" fillcolor=lightblue style=filled]');
  });

  it('maps each node type to its fill color', () => {
    const e = new DependencyGraphEngine();
    e.addNode('svc', 'service', 'svc');
    e.addNode('db', 'database', 'db');
    e.addNode('cache', 'cache', 'cache');
    e.addNode('queue', 'queue', 'queue');
    e.addNode('store', 'storage', 'store');
    const dot = e.exportToDot();
    expect(dot).toContain('fillcolor=lightblue');
    expect(dot).toContain('fillcolor=lightgreen');
    expect(dot).toContain('fillcolor=lightyellow');
    expect(dot).toContain('fillcolor=lightcoral');
    expect(dot).toContain('fillcolor=lightgray');
  });

  it('emits a directed edge line per edge', () => {
    const e = new DependencyGraphEngine();
    e.addNode('api', 'service', 'api');
    e.addNode('db', 'database', 'db');
    e.addEdge('api', 'db');
    expect(e.exportToDot()).toContain('"api" -> "db"');
  });
});

describe('DependencyGraphEngine.exportToJson', () => {
  it('produces valid JSON with nodes and edges arrays', () => {
    const e = new DependencyGraphEngine();
    e.addNode('api', 'service', 'api');
    e.addNode('db', 'database', 'db');
    e.addEdge('api', 'db');
    const parsed = JSON.parse(e.exportToJson());
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.nodes[0]).toMatchObject({ id: 'api', type: 'service', name: 'api' });
    expect(parsed.edges).toEqual([{ from: 'api', to: 'db' }]);
  });
});

// ---------------------------------------------------------------------------
// BUGGY METHODS — the following tests pin the CURRENT (incorrect) behavior so
// regressions are caught and the defects are documented. Each test names the
// expected correct behavior in its comment.
// ---------------------------------------------------------------------------

describe('DependencyGraphEngine — topologicalSort (BUG: throws on acyclic graphs with edges)', () => {
  it('returns an empty array for an empty graph', () => {
    expect(new DependencyGraphEngine().topologicalSort()).toEqual([]);
  });

  it('returns all node ids for an edgeless graph', () => {
    const e = new DependencyGraphEngine();
    e.addNode('a', 'service', 'a');
    e.addNode('b', 'service', 'b');
    expect(e.topologicalSort().sort()).toEqual(['a', 'b']);
  });

  it('BUG: throws "has cycles" for a simple acyclic A->B graph', () => {
    // Correct behavior would be to return ['b','a'] (dependency b before a).
    // Kahn's algorithm here decrements using outgoing edges (edges.get(node))
    // instead of incoming dependents, so the sort never completes.
    const e = new DependencyGraphEngine();
    e.addNode('a', 'service', 'a');
    e.addNode('b', 'service', 'b');
    e.addEdge('a', 'b'); // a depends on b — acyclic
    expect(() => e.topologicalSort()).toThrow('Graph has cycles, cannot perform topological sort');
  });
});

describe('DependencyGraphEngine — findCriticalPath (BUG: delegates to the broken topologicalSort)', () => {
  it('returns the single node for an edgeless graph', () => {
    const e = new DependencyGraphEngine();
    e.addNode('a', 'service', 'a');
    expect(e.findCriticalPath()).toEqual(['a']);
  });

  it('BUG: throws on an acyclic graph that has edges', () => {
    const e = new DependencyGraphEngine();
    e.addNode('a', 'service', 'a');
    e.addNode('b', 'service', 'b');
    e.addEdge('a', 'b');
    expect(() => e.findCriticalPath()).toThrow('Graph has cycles');
  });
});

describe('DependencyGraphEngine — calculateDeploymentLayers (BUG: collapses chains)', () => {
  it('produces correct layers for a simple A->B graph', () => {
    const e = new DependencyGraphEngine();
    e.addNode('a', 'service', 'a');
    e.addNode('b', 'service', 'b');
    e.addEdge('a', 'b'); // a depends on b
    expect(e.calculateDeploymentLayers()).toEqual([['b'], ['a']]);
  });

  it('BUG: collapses a chain A->B->C into two layers instead of three', () => {
    // Correct layers would be [['c'],['b'],['a']]. The builder marks nodes
    // visited inside the same pass, so a node becomes eligible the moment its
    // dependency is added in the same iteration — flattening the chain.
    const e = new DependencyGraphEngine();
    e.addNode('c', 'service', 'c');
    e.addNode('b', 'service', 'b');
    e.addNode('a', 'service', 'a');
    e.addEdge('a', 'b');
    e.addEdge('b', 'c'); // a -> b -> c
    expect(e.calculateDeploymentLayers()).toEqual([['c'], ['b', 'a']]);
  });

  it('returns an empty first layer for a pure cycle (no resolvable nodes)', () => {
    const e = new DependencyGraphEngine();
    e.addNode('a', 'service', 'a');
    e.addNode('b', 'service', 'b');
    e.addEdge('a', 'b');
    e.addEdge('b', 'a');
    const layers = e.calculateDeploymentLayers();
    expect(layers[0]).toEqual([]);
  });
});

describe('DependencyGraphEngine — analyze & generateResolutionPlan (BUG: throw via critical path)', () => {
  it('analyze reports counts for an edgeless graph', () => {
    const e = new DependencyGraphEngine();
    e.addNode('a', 'service', 'a');
    e.addNode('b', 'service', 'b');
    const analysis = e.analyze();
    expect(analysis.nodes).toBe(2);
    expect(analysis.edges).toBe(0);
    expect(analysis.orphanNodes.sort()).toEqual(['a', 'b']);
    expect(analysis.cycles).toEqual([]);
  });

  it('BUG: analyze throws on an acyclic graph with edges', () => {
    const e = new DependencyGraphEngine();
    e.addNode('a', 'service', 'a');
    e.addNode('b', 'service', 'b');
    e.addEdge('a', 'b');
    expect(() => e.analyze()).toThrow('Graph has cycles');
  });

  it('produces ordered deploy steps for an edgeless graph', () => {
    const e = new DependencyGraphEngine();
    e.addNode('a', 'service', 'a');
    e.addNode('b', 'service', 'b');
    const plan = e.generateResolutionPlan();
    expect(plan.canResolve).toBe(true);
    expect(plan.errors).toEqual([]);
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps.every(s => s.action === 'deploy')).toBe(true);
    expect(plan.steps.map(s => s.order)).toEqual([1, 2]);
  });

  it('BUG: generateResolutionPlan throws on a cyclic graph instead of reporting canResolve:false', () => {
    // Correct behavior: return { canResolve: false, errors: [...], steps: [] }.
    // Instead analyze() throws (via findCriticalPath -> topologicalSort) before
    // the cycle guard in generateResolutionPlan ever runs.
    const e = new DependencyGraphEngine();
    e.addNode('a', 'service', 'a');
    e.addNode('b', 'service', 'b');
    e.addEdge('a', 'b');
    e.addEdge('b', 'a');
    expect(() => e.generateResolutionPlan()).toThrow('Graph has cycles');
  });
});
