import { describe, expect, it } from 'vitest';
import {
  WorkspaceDependencyGraph,
  createWorkspaceDependencyGraph,
  validateWorkspaceDependencies,
  type GraphAnalysis,
} from '../../src/utils/workspace-graph';
import type { WorkspaceDefinition, WorkspaceEntry, WorkspaceDependency } from '../../src/utils/workspace-schema';

const wsEntry = (name: string, type = 'app'): WorkspaceEntry => ({ name, type, path: `./${name}` });

const dep = (name: string, type: WorkspaceDependency['type'] = 'build'): WorkspaceDependency => ({
  name,
  type,
});

function makeDefinition(
  workspaces: Record<string, WorkspaceEntry>,
  dependencies: Record<string, WorkspaceDependency[]> = {}
): WorkspaceDefinition {
  return {
    version: '1.0',
    name: 'test',
    root: '.',
    patterns: [],
    workspaces,
    dependencies,
    types: {
      app: { name: 'App' },
      package: { name: 'Package' },
    },
  };
}

// --- Basic graph construction ---

describe('WorkspaceDependencyGraph construction', () => {
  it('should build graph with no workspaces', () => {
    const graph = new WorkspaceDependencyGraph(makeDefinition({}));
    expect(graph.getAllNodes().size).toBe(0);
  });

  it('should create nodes for each workspace', () => {
    const def = makeDefinition({
      'app-a': wsEntry('app-a'),
      'app-b': wsEntry('app-b'),
    });
    const graph = new WorkspaceDependencyGraph(def);

    expect(graph.getNode('app-a')).toBeDefined();
    expect(graph.getNode('app-b')).toBeDefined();
  });

  it('should register edges from dependencies', () => {
    const def = makeDefinition(
      { 'app-a': wsEntry('app-a'), 'lib-b': wsEntry('lib-b', 'package') },
      { 'app-a': [dep('lib-b')] }
    );
    const graph = new WorkspaceDependencyGraph(def);

    expect(graph.getEdges('app-a')).toHaveLength(1);
    expect(graph.getEdges('app-a')[0].to).toBe('lib-b');
  });
});

// --- Cycle detection ---

describe('detectCycles', () => {
  it('should report no cycles in acyclic graph', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b') },
      { a: [dep('b')] }
    );
    const graph = new WorkspaceDependencyGraph(def);
    const result = graph.detectCycles();

    expect(result.hasCycles).toBe(false);
    expect(result.cycles).toHaveLength(0);
  });

  it('should detect a simple cycle', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b') },
      { a: [dep('b')], b: [dep('a')] }
    );
    const graph = new WorkspaceDependencyGraph(def);
    const result = graph.detectCycles();

    expect(result.hasCycles).toBe(true);
    expect(result.cycles.length).toBeGreaterThanOrEqual(1);
  });

  it('should detect self-referencing cycle', () => {
    const def = makeDefinition(
      { a: wsEntry('a') },
      { a: [dep('a')] }
    );
    const graph = new WorkspaceDependencyGraph(def);
    const result = graph.detectCycles();

    expect(result.hasCycles).toBe(true);
  });

  it('should detect a 3-node cycle', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b'), c: wsEntry('c') },
      { a: [dep('b')], b: [dep('c')], c: [dep('a')] }
    );
    const graph = new WorkspaceDependencyGraph(def);
    const result = graph.detectCycles();

    expect(result.hasCycles).toBe(true);
    expect(result.cycles.length).toBeGreaterThanOrEqual(1);
  });

  it('should classify build cycles as error severity', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b') },
      { a: [dep('b', 'build')], b: [dep('a', 'build')] }
    );
    const graph = new WorkspaceDependencyGraph(def);
    const result = graph.detectCycles();

    expect(result.cycles.some(c => c.severity === 'error')).toBe(true);
  });

  it('should find strongly connected components in cycles', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b'), c: wsEntry('c') },
      { a: [dep('b')], b: [dep('c')], c: [dep('a')] }
    );
    const graph = new WorkspaceDependencyGraph(def);
    const result = graph.detectCycles();

    expect(result.stronglyConnectedComponents.length).toBeGreaterThanOrEqual(1);
    expect(result.stronglyConnectedComponents[0].length).toBe(3);
  });
});

// --- Topological order ---

describe('generateTopologicalOrder', () => {
  it('should produce valid topological order (dependents before dependencies)', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b'), c: wsEntry('c') },
      { c: [dep('b')], b: [dep('a')] }
    );
    const graph = new WorkspaceDependencyGraph(def);
    const order = graph.generateTopologicalOrder();

    // Edges go dependent→dependency (c→b, b→a), so topological order is c, b, a.
    expect(order).toHaveLength(3);
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('a'));
  });

  it('should throw on cyclic graphs', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b') },
      { a: [dep('b')], b: [dep('a')] }
    );
    const graph = new WorkspaceDependencyGraph(def);

    expect(() => graph.generateTopologicalOrder()).toThrow();
  });

  it('should handle single node', () => {
    const def = makeDefinition({ solo: wsEntry('solo') });
    const graph = new WorkspaceDependencyGraph(def);

    expect(graph.generateTopologicalOrder()).toEqual(['solo']);
  });
});

// --- Levels ---

describe('calculateLevels', () => {
  it('should group independent nodes at level 0', () => {
    const def = makeDefinition({
      a: wsEntry('a'),
      b: wsEntry('b'),
    });
    const graph = new WorkspaceDependencyGraph(def);
    const levels = graph.calculateLevels();

    expect(levels).toHaveLength(1);
    expect(levels[0]).toContain('a');
    expect(levels[0]).toContain('b');
  });

  it('should place dependents at higher levels', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b'), c: wsEntry('c') },
      { b: [dep('a')], c: [dep('b')] }
    );
    const graph = new WorkspaceDependencyGraph(def);
    const levels = graph.calculateLevels();

    expect(levels).toHaveLength(3);
    expect(levels[0]).toContain('a');
    expect(levels[1]).toContain('b');
    expect(levels[2]).toContain('c');
  });
});

// --- Critical path ---

describe('findCriticalPath', () => {
  it('should find critical path starting from root nodes', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b'), c: wsEntry('c') },
      { b: [dep('a')], c: [dep('b')] }
    );
    const graph = new WorkspaceDependencyGraph(def);
    const path = graph.findCriticalPath();

    // The root node (no dependencies) is the starting point.
    expect(path).toContain('a');
    expect(path.length).toBeGreaterThanOrEqual(1);
  });

  it('should return empty array for cyclic graphs', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b') },
      { a: [dep('b')], b: [dep('a')] }
    );
    const graph = new WorkspaceDependencyGraph(def);
    const path = graph.findCriticalPath();

    expect(path).toEqual([]);
  });

  it('should handle single node', () => {
    const def = makeDefinition({ solo: wsEntry('solo') });
    const graph = new WorkspaceDependencyGraph(def);
    const path = graph.findCriticalPath();

    expect(path).toEqual(['solo']);
  });
});

// --- Build order ---

describe('generateBuildOrder', () => {
  it('should generate build order with parallelism info', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b'), c: wsEntry('c') },
      { c: [dep('a'), dep('b')] }
    );
    const graph = new WorkspaceDependencyGraph(def);
    const order = graph.generateBuildOrder();

    expect(order.order.length).toBeGreaterThanOrEqual(1);
    expect(order.parallelizable).toBe(true); // a and b are parallel
    expect(order.maxParallelism).toBeGreaterThanOrEqual(2);
  });

  it('should include dependency map', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b') },
      { b: [dep('a')] }
    );
    const graph = new WorkspaceDependencyGraph(def);
    const order = graph.generateBuildOrder();

    expect(order.dependencies.get('b')).toEqual(['a']);
    expect(order.dependencies.get('a')).toEqual([]);
  });

  it('should estimate build time based on levels', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b') },
      { b: [dep('a')] }
    );
    const graph = new WorkspaceDependencyGraph(def);
    const order = graph.generateBuildOrder();

    // 2 levels * 60 seconds per level
    expect(order.estimatedTime).toBe(120);
  });
});

// --- Path finding ---

describe('hasPath', () => {
  it('should find direct path', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b') },
      { a: [dep('b')] }
    );
    const graph = new WorkspaceDependencyGraph(def);

    expect(graph.hasPath('a', 'b')).toBe(true);
  });

  it('should find transitive path', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b'), c: wsEntry('c') },
      { a: [dep('b')], b: [dep('c')] }
    );
    const graph = new WorkspaceDependencyGraph(def);

    expect(graph.hasPath('a', 'c')).toBe(true);
  });

  it('should return false for no path', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b') },
      { a: [dep('b')] }
    );
    const graph = new WorkspaceDependencyGraph(def);

    expect(graph.hasPath('b', 'a')).toBe(false);
  });

  it('should return true for same node', () => {
    const def = makeDefinition({ a: wsEntry('a') });
    const graph = new WorkspaceDependencyGraph(def);

    expect(graph.hasPath('a', 'a')).toBe(true);
  });
});

// --- Graph mutation ---

describe('addWorkspace / removeWorkspace', () => {
  it('should add workspace and rebuild graph', () => {
    const def = makeDefinition({ a: wsEntry('a') });
    const graph = new WorkspaceDependencyGraph(def);

    graph.addWorkspace('b', wsEntry('b'));

    expect(graph.getNode('b')).toBeDefined();
  });

  it('should remove workspace and clean references', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b') },
      { a: [dep('b')] }
    );
    const graph = new WorkspaceDependencyGraph(def);

    graph.removeWorkspace('b');

    expect(graph.getNode('b')).toBeUndefined();
    expect(graph.getEdges('a')).toHaveLength(0);
  });
});

// --- analyzeGraph ---

describe('analyzeGraph', () => {
  it('should return comprehensive analysis', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b'), c: wsEntry('c'), isolated: wsEntry('isolated') },
      { b: [dep('a')], c: [dep('b')] }
    );
    const graph = new WorkspaceDependencyGraph(def);
    const analysis = graph.analyzeGraph();

    expect(analysis.nodeCount).toBe(4);
    expect(analysis.edgeCount).toBe(2);
    expect(analysis.cycles.hasCycles).toBe(false);
    expect(analysis.topologicalOrder).toHaveLength(4);
    expect(analysis.orphanedNodes).toContain('isolated');
    expect(analysis.statistics.maxDepth).toBeGreaterThan(0);
  });

  it('should report statistics correctly', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b'), c: wsEntry('c') },
      { b: [dep('a')], c: [dep('a'), dep('b')] }
    );
    const graph = new WorkspaceDependencyGraph(def);
    const analysis = graph.analyzeGraph();

    // 'a' has 0 dependencies, 'b' has 1, 'c' has 2 → avg = 1
    expect(analysis.statistics.avgDependencies).toBeCloseTo(1);
    // 'a' has 2 dependents, 'b' has 1, 'c' has 0 → avg = 1
    expect(analysis.statistics.avgDependents).toBeCloseTo(1);
  });
});

// --- getVisualizationData ---

describe('getVisualizationData', () => {
  it('should produce node and edge arrays', () => {
    const def = makeDefinition(
      { a: wsEntry('a', 'app'), b: wsEntry('b', 'package') },
      { a: [dep('b')] }
    );
    const graph = new WorkspaceDependencyGraph(def);
    const viz = graph.getVisualizationData();

    expect(viz.nodes).toHaveLength(2);
    expect(viz.edges).toHaveLength(1);
    expect(viz.edges[0].from).toBe('a');
    expect(viz.edges[0].to).toBe('b');
  });
});

// --- Factory and validation ---

describe('createWorkspaceDependencyGraph', () => {
  it('should create graph instance', () => {
    const def = makeDefinition({ a: wsEntry('a') });
    const graph = createWorkspaceDependencyGraph(def);
    expect(graph).toBeInstanceOf(WorkspaceDependencyGraph);
  });
});

describe('validateWorkspaceDependencies', () => {
  it('should return no errors for valid graph', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b') },
      { b: [dep('a')] }
    );
    const errors = validateWorkspaceDependencies(def);
    expect(errors).toHaveLength(0);
  });

  it('should return errors for cyclic dependencies', () => {
    const def = makeDefinition(
      { a: wsEntry('a'), b: wsEntry('b') },
      { a: [dep('b')], b: [dep('a')] }
    );
    const errors = validateWorkspaceDependencies(def);
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });
});
