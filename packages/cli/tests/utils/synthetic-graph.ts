import type { GraphModel, WorkspaceLiveStatus } from '@re-shell/contracts';

const LANGS = ['typescript', 'javascript', 'go', 'python', 'rust'];
const FRAMEWORKS = ['react-ts', 'vue', 'angular', null, 'svelte'];
const TYPES = ['app', 'package', 'lib', 'tool'];
const STATUSES: WorkspaceLiveStatus[] = ['running', 'stopped', 'unhealthy', 'unknown'];

/** Deterministic layered DAG: node i depends on up to 3 earlier nodes. */
export function syntheticGraph(count: number): GraphModel {
  const nodes = Array.from({ length: count }, (_, i) => ({
    id: `pkg-${String(i).padStart(5, '0')}`,
    type: TYPES[i % TYPES.length],
    framework: FRAMEWORKS[i % FRAMEWORKS.length],
    language: LANGS[i % LANGS.length],
    path: `packages/group-${i % 50}/pkg-${String(i).padStart(5, '0')}`,
  }));
  const edges: GraphModel['edges'] = [];
  for (let i = 1; i < count; i++) {
    for (const back of [1, 7, 31]) {
      const j = i - back;
      if (j >= 0 && (i + back) % 2 === 0) edges.push({ from: nodes[i].id, to: nodes[j].id, type: back === 31 ? 'devDependency' : 'dependency' });
    }
  }
  return { nodes, edges };
}

export function syntheticStatuses(graph: GraphModel): Map<string, { status: WorkspaceLiveStatus; reason: string }> {
  return new Map(graph.nodes.map((n, i) => [n.id, { status: STATUSES[i % STATUSES.length], reason: `synthetic ${STATUSES[i % STATUSES.length]}` }]));
}
