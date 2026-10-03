import { z } from 'zod';

/**
 * Workspace graph model, converters, analysis, diff and live-status contracts
 * (P9-L: interactive workspace graph explorer).
 *
 * This module is pure (zod only, no Node or DOM APIs) so the SAME code runs in
 * the CLI (`workspace graph --format mermaid|d3`, `workspace graph diff`), the
 * terminal explorer and the browser dashboard (export, path highlighting,
 * diff rendering). One converter, one diff algorithm, one cycle detector.
 *
 * Edge direction: an edge `{ from, to }` means "`from` depends on `to`".
 *  - upstream of X   = everything X (transitively) depends on
 *  - downstream of X = everything that (transitively) depends on X
 */

// ---------------------------------------------------------------------------
// Graph model
// ---------------------------------------------------------------------------

/** Workspace node categories used by the CLI (`getWorkspaces`). */
export const graphNodeTypeSchema = z.enum(['app', 'package', 'lib', 'tool']);
export type GraphNodeType = z.infer<typeof graphNodeTypeSchema>;

export const graphEdgeTypeSchema = z.enum(['dependency', 'devDependency']);
export type GraphEdgeType = z.infer<typeof graphEdgeTypeSchema>;

/** One workspace in the graph. `id` is the unique workspace package name. */
export const graphModelNodeSchema = z.object({
  id: z.string(),
  /** Usually one of {@link GraphNodeType}; kept open so foreign graphs still load. */
  type: z.string().default('package'),
  framework: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  path: z.string().optional(),
});
export type GraphModelNode = z.infer<typeof graphModelNodeSchema>;

/** `from` depends on `to`. */
export const graphModelEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: graphEdgeTypeSchema.default('dependency'),
});
export type GraphModelEdge = z.infer<typeof graphModelEdgeSchema>;

export const graphModelSchema = z.object({
  nodes: z.array(graphModelNodeSchema),
  edges: z.array(graphModelEdgeSchema),
});
export type GraphModel = z.infer<typeof graphModelSchema>;

/** Stable key for an edge. */
export function edgeKey(from: string, to: string): string {
  return `${from}\u0000${to}`;
}

function normStr(value: string | null | undefined): string | null {
  return value === undefined || value === null || value === '' ? null : value;
}

/** Normalise a model: unique node ids (last wins), unique edges, no dangling edges. */
export function normalizeGraph(graph: { nodes: GraphModelNode[]; edges: GraphModelEdge[] }): GraphModel {
  const nodes = new Map<string, GraphModelNode>();
  for (const node of graph.nodes) nodes.set(node.id, node);
  const edges = new Map<string, GraphModelEdge>();
  for (const edge of graph.edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) continue;
    edges.set(edgeKey(edge.from, edge.to), edge);
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

// ---------------------------------------------------------------------------
// Parsing foreign graph documents (diff `--base file.json`, dashboard feed)
// ---------------------------------------------------------------------------

interface ContractishNode {
  name: string;
  path?: string;
  framework?: string | null;
  type?: string;
  language?: string | null;
  dependencies?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Build a model from the consumer contract shape `{ apps, services }`. */
export function contractGraphToModel(contract: {
  apps: ContractishNode[];
  services: ContractishNode[];
}): GraphModel {
  const nodes: GraphModelNode[] = [];
  const known = new Set<string>();
  const push = (n: ContractishNode, fallbackType: string): void => {
    known.add(n.name);
    nodes.push({
      id: n.name,
      type: n.type ?? fallbackType,
      framework: normStr(n.framework ?? null),
      language: normStr(n.language ?? null),
      ...(n.path !== undefined ? { path: n.path } : {}),
    });
  };
  for (const n of contract.apps) push(n, 'app');
  for (const n of contract.services) push(n, 'package');
  const edges: GraphModelEdge[] = [];
  for (const group of [contract.apps, contract.services]) {
    for (const n of group) {
      for (const dep of n.dependencies ?? []) {
        if (known.has(dep)) edges.push({ from: n.name, to: dep, type: 'dependency' });
      }
    }
  }
  return normalizeGraph({ nodes, edges });
}

/**
 * Parse any graph document the tooling produces into a {@link GraphModel}:
 *  - the JSON envelope `{ ok: true, data }` around any of the shapes below
 *  - the rich file output of `workspace graph --format json --output f`: `{ nodes, edges }`
 *  - the D3 export `{ nodes, links }`
 *  - the consumer contract `{ apps, services }` from `workspace graph --json`
 * Throws an Error with a precise message on anything else.
 */
export function parseGraphDocument(input: unknown): GraphModel {
  let doc = input;
  if (isRecord(doc) && typeof doc.ok === 'boolean') {
    if (doc.ok !== true) throw new Error('graph document is an error envelope (ok:false)');
    doc = doc.data;
  }
  if (!isRecord(doc)) throw new Error('graph document must be a JSON object');

  if (Array.isArray(doc.apps) || Array.isArray(doc.services)) {
    const norm = (list: unknown): ContractishNode[] =>
      (Array.isArray(list) ? list : []).map((entry, i) => {
        if (!isRecord(entry) || typeof entry.name !== 'string') {
          throw new Error(`graph node #${i} is missing a string "name"`);
        }
        return entry as unknown as ContractishNode;
      });
    return contractGraphToModel({ apps: norm(doc.apps), services: norm(doc.services) });
  }

  if (Array.isArray(doc.nodes)) {
    const nodes = doc.nodes.map((entry, i): GraphModelNode => {
      if (!isRecord(entry) || typeof entry.id !== 'string') {
        throw new Error(`graph node #${i} is missing a string "id"`);
      }
      return graphModelNodeSchema.parse({
        id: entry.id,
        type: typeof entry.type === 'string' ? entry.type : typeof entry.group === 'string' ? entry.group : 'package',
        framework: typeof entry.framework === 'string' ? entry.framework : null,
        language: typeof entry.language === 'string' ? entry.language : null,
        path: typeof entry.path === 'string' ? entry.path : undefined,
      });
    });
    const rawEdges: unknown[] = Array.isArray(doc.edges)
      ? doc.edges
      : Array.isArray(doc.links)
        ? doc.links
        : [];
    const edges = rawEdges.map((entry, i): GraphModelEdge => {
      if (!isRecord(entry)) throw new Error(`graph edge #${i} must be an object`);
      const from = entry.from ?? entry.source;
      const to = entry.to ?? entry.target;
      if (typeof from !== 'string' || typeof to !== 'string') {
        throw new Error(`graph edge #${i} needs string from/to (or source/target)`);
      }
      return { from, to, type: entry.type === 'devDependency' ? 'devDependency' : 'dependency' };
    });
    return normalizeGraph({ nodes, edges });
  }

  throw new Error('unrecognised graph document: expected { nodes, edges | links } or { apps, services }');
}

// ---------------------------------------------------------------------------
// Converters (shared by CLI and dashboard)
// ---------------------------------------------------------------------------

const MERMAID_RESERVED = new Set([
  'end',
  'graph',
  'subgraph',
  'style',
  'class',
  'classdef',
  'click',
  'linkstyle',
  'direction',
  'default',
  'flowchart',
]);

function mermaidIds(ids: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<string>();
  for (const id of ids) {
    let base = id.replace(/[^A-Za-z0-9_]/g, '_');
    if (base === '' || /^[0-9]/.test(base) || MERMAID_RESERVED.has(base.toLowerCase())) {
      base = `n_${base}`;
    }
    let candidate = base;
    let i = 2;
    while (used.has(candidate)) candidate = `${base}_${i++}`;
    used.add(candidate);
    out.set(id, candidate);
  }
  return out;
}

function mermaidLabel(text: string): string {
  return text.replace(/"/g, '#quot;');
}

function mermaidShape(type: string, label: string): string {
  const l = mermaidLabel(label);
  switch (type) {
    case 'app':
      return `["${l}"]`;
    case 'package':
      return `("${l}")`;
    case 'lib':
      return `{"${l}"}`;
    case 'tool':
      return `[["${l}"]]`;
    default:
      return `["${l}"]`;
  }
}

/**
 * Mermaid flowchart. Node ids are sanitised (scoped names like `@acme/ui` are
 * not valid Mermaid ids) with the real name kept as the label; `devDependency`
 * edges are dotted. The `graph TD` header and per-type shapes match the CLI's
 * historical `workspace graph --format mermaid` output.
 */
export function toMermaid(graph: GraphModel): string {
  const ids = mermaidIds(graph.nodes.map((n) => n.id));
  const lines = ['graph TD'];
  for (const node of graph.nodes) {
    lines.push(`  ${ids.get(node.id)}${mermaidShape(node.type, node.id)}`);
  }
  for (const edge of graph.edges) {
    const a = ids.get(edge.from);
    const b = ids.get(edge.to);
    if (!a || !b) continue;
    lines.push(`  ${a} ${edge.type === 'devDependency' ? '-.->' : '-->'} ${b}`);
  }
  return `${lines.join('\n')}\n`;
}

/** D3 force-graph object: `{ nodes: [{id, group, type, framework}], links: [{source, target, type}] }`. */
export function toD3(graph: GraphModel): {
  nodes: Array<{ id: string; group: string; type: string; framework?: string }>;
  links: Array<{ source: string; target: string; type: string }>;
} {
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      group: n.type,
      type: n.type,
      framework: n.framework ?? undefined,
    })),
    links: graph.edges.map((e) => ({ source: e.from, target: e.to, type: e.type })),
  };
}

/** D3 JSON text, exactly as `workspace graph --format d3` prints it. */
export function toD3Json(graph: GraphModel): string {
  return JSON.stringify(toD3(graph), null, 2);
}

/** Raw `{ nodes, edges }` JSON, as `workspace graph --format json --output file` writes it. */
export function toRawJson(graph: GraphModel): string {
  return JSON.stringify({ nodes: graph.nodes, edges: graph.edges }, null, 2);
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/** Adjacency index for O(1) neighbour lookups. Build once per graph. */
export interface GraphIndex {
  readonly nodeIds: readonly string[];
  readonly nodes: ReadonlyMap<string, GraphModelNode>;
  /** id -> ids it depends on (outgoing edges). */
  readonly dependencies: ReadonlyMap<string, readonly string[]>;
  /** id -> ids that depend on it (incoming edges). */
  readonly dependents: ReadonlyMap<string, readonly string[]>;
  readonly edges: readonly GraphModelEdge[];
}

export function buildGraphIndex(graph: GraphModel): GraphIndex {
  const nodes = new Map<string, GraphModelNode>();
  const dependencies = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();
  for (const node of graph.nodes) {
    nodes.set(node.id, node);
    dependencies.set(node.id, []);
    dependents.set(node.id, []);
  }
  const edges: GraphModelEdge[] = [];
  const seen = new Set<string>();
  for (const edge of graph.edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) continue;
    const key = edgeKey(edge.from, edge.to);
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push(edge);
    dependencies.get(edge.from)!.push(edge.to);
    dependents.get(edge.to)!.push(edge.from);
  }
  return { nodeIds: [...nodes.keys()], nodes, dependencies, dependents, edges };
}

/**
 * Transitive closure from `start` (excluded unless it is on a cycle through
 * itself). `dependencies` walks upstream, `dependents` walks downstream.
 * Iterative BFS: O(V + E), safe on very deep graphs.
 */
export function reachableFrom(
  index: GraphIndex,
  start: string,
  direction: 'dependencies' | 'dependents'
): Set<string> {
  const adjacency = direction === 'dependencies' ? index.dependencies : index.dependents;
  const out = new Set<string>();
  const queue: string[] = [];
  for (const next of adjacency.get(start) ?? []) {
    if (!out.has(next)) {
      out.add(next);
      queue.push(next);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    for (const next of adjacency.get(queue[head]) ?? []) {
      if (!out.has(next)) {
        out.add(next);
        queue.push(next);
      }
    }
  }
  return out;
}

/** Result of {@link shortestDependencyPath}. */
export interface DependencyPath {
  /** Node ids along the path, in edge direction (each depends on the next). */
  path: string[];
  /** Which endpoint is the dependent: `a` (a depends on b) or `b` (b depends on a). */
  dependent: 'a' | 'b';
}

function bfsPath(index: GraphIndex, from: string, to: string): string[] | null {
  if (from === to) return [from];
  const prev = new Map<string, string>();
  const seen = new Set<string>([from]);
  const queue: string[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    for (const next of index.dependencies.get(cur) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      prev.set(next, cur);
      if (next === to) {
        const path = [to];
        let walk = to;
        while (prev.has(walk)) {
          walk = prev.get(walk)!;
          path.push(walk);
        }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return null;
}

/**
 * Shortest dependency path between two nodes. Looks for "a depends on ... b"
 * first, then "b depends on ... a"; `null` when neither exists or an id is
 * unknown. Breadth-first, O(V + E).
 */
export function shortestDependencyPath(index: GraphIndex, a: string, b: string): DependencyPath | null {
  if (!index.nodes.has(a) || !index.nodes.has(b)) return null;
  const forward = bfsPath(index, a, b);
  if (forward) return { path: forward, dependent: 'a' };
  const reverse = bfsPath(index, b, a);
  if (reverse) return { path: reverse, dependent: 'b' };
  return null;
}

/** Cycles found in a graph. */
export interface CycleReport {
  /** Strongly connected components with a real cycle (size > 1, or a self-loop). */
  cycles: string[][];
  /** Every node that sits on at least one cycle. */
  nodeIds: Set<string>;
  /** Edge keys (see {@link edgeKey}) whose endpoints share a cyclic component. */
  edgeKeys: Set<string>;
}

/** Iterative Tarjan SCC (no recursion: safe for 10k+ node chains). Cycles sorted for determinism. */
export function findCycles(index: GraphIndex): CycleReport {
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];
  let counter = 0;

  for (const root of index.nodeIds) {
    if (idx.has(root)) continue;
    const work: Array<{ id: string; i: number }> = [{ id: root, i: 0 }];
    idx.set(root, counter);
    low.set(root, counter);
    counter++;
    stack.push(root);
    onStack.add(root);

    while (work.length > 0) {
      const frame = work[work.length - 1];
      const neighbours = index.dependencies.get(frame.id) ?? [];
      if (frame.i < neighbours.length) {
        const next = neighbours[frame.i++];
        if (!idx.has(next)) {
          idx.set(next, counter);
          low.set(next, counter);
          counter++;
          stack.push(next);
          onStack.add(next);
          work.push({ id: next, i: 0 });
        } else if (onStack.has(next)) {
          low.set(frame.id, Math.min(low.get(frame.id)!, idx.get(next)!));
        }
      } else {
        if (low.get(frame.id) === idx.get(frame.id)) {
          const component: string[] = [];
          let member: string;
          do {
            member = stack.pop()!;
            onStack.delete(member);
            component.push(member);
          } while (member !== frame.id);
          components.push(component);
        }
        work.pop();
        const parent = work[work.length - 1];
        if (parent) {
          low.set(parent.id, Math.min(low.get(parent.id)!, low.get(frame.id)!));
        }
      }
    }
  }

  const cycles: string[][] = [];
  const nodeIds = new Set<string>();
  const componentOf = new Map<string, number>();
  for (const component of components) {
    const selfLoop = component.length === 1 && (index.dependencies.get(component[0]) ?? []).includes(component[0]);
    if (component.length > 1 || selfLoop) {
      const sorted = [...component].sort();
      const n = cycles.length;
      cycles.push(sorted);
      for (const id of sorted) {
        nodeIds.add(id);
        componentOf.set(id, n);
      }
    }
  }
  cycles.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  const edgeKeys = new Set<string>();
  for (const edge of index.edges) {
    const c = componentOf.get(edge.from);
    if (c !== undefined && c === componentOf.get(edge.to)) edgeKeys.add(edgeKey(edge.from, edge.to));
  }
  return { cycles, nodeIds, edgeKeys };
}

// ---------------------------------------------------------------------------
// Graph diff
// ---------------------------------------------------------------------------

const DIFF_NODE_FIELDS = ['type', 'framework', 'language', 'path'] as const;
export type DiffNodeField = (typeof DIFF_NODE_FIELDS)[number];

export const graphDiffNodeChangeSchema = z.object({
  id: z.string(),
  before: graphModelNodeSchema,
  after: graphModelNodeSchema,
  fields: z.array(z.string()),
});
export type GraphDiffNodeChange = z.infer<typeof graphDiffNodeChangeSchema>;

export const graphDiffEdgeChangeSchema = z.object({
  from: z.string(),
  to: z.string(),
  before: graphEdgeTypeSchema,
  after: graphEdgeTypeSchema,
});
export type GraphDiffEdgeChange = z.infer<typeof graphDiffEdgeChangeSchema>;

export const graphSideSchema = z.object({
  /** What the caller asked for: a git ref, a file path, or `working-tree`. */
  ref: z.string(),
  kind: z.enum(['git', 'file', 'working-tree']),
  /** Resolved commit sha for git refs. */
  commit: z.string().nullable().optional(),
  nodeCount: z.number().int().nonnegative(),
  edgeCount: z.number().int().nonnegative(),
});
export type GraphSide = z.infer<typeof graphSideSchema>;

export const graphDiffSummarySchema = z.object({
  nodesAdded: z.number().int().nonnegative(),
  nodesRemoved: z.number().int().nonnegative(),
  nodesChanged: z.number().int().nonnegative(),
  edgesAdded: z.number().int().nonnegative(),
  edgesRemoved: z.number().int().nonnegative(),
  edgesChanged: z.number().int().nonnegative(),
  hasChanges: z.boolean(),
});
export type GraphDiffSummary = z.infer<typeof graphDiffSummarySchema>;

/** The pure diff between two graphs (no side metadata). */
export const graphDiffCoreSchema = z.object({
  nodes: z.object({
    added: z.array(graphModelNodeSchema),
    removed: z.array(graphModelNodeSchema),
    changed: z.array(graphDiffNodeChangeSchema),
  }),
  edges: z.object({
    added: z.array(graphModelEdgeSchema),
    removed: z.array(graphModelEdgeSchema),
    changed: z.array(graphDiffEdgeChangeSchema),
  }),
  /** Unchanged nodes that are an endpoint of an added/removed/changed edge, for rendering context. */
  context: z.array(graphModelNodeSchema),
  /** Cycles present in `head` that did not exist (as the same member set) in `base`. */
  cyclesIntroduced: z.array(z.array(z.string())),
  summary: graphDiffSummarySchema,
});
export type GraphDiffCore = z.infer<typeof graphDiffCoreSchema>;

/** Payload of `workspace graph diff --json` and hub command `workspace.graph.diff`. */
export const workspaceGraphDiffSchema = graphDiffCoreSchema.extend({
  base: graphSideSchema,
  head: graphSideSchema,
});
export type WorkspaceGraphDiff = z.infer<typeof workspaceGraphDiffSchema>;

/**
 * Compare two graphs. Node identity is the workspace name; edge identity is the
 * ordered `(from, to)` pair. A node is "changed" when its type, framework,
 * language or path differ; an edge is "changed" when it flips between
 * `dependency` and `devDependency`. O(V + E).
 */
export function diffGraphs(baseInput: GraphModel, headInput: GraphModel): GraphDiffCore {
  const base = normalizeGraph(baseInput);
  const head = normalizeGraph(headInput);
  const baseNodes = new Map(base.nodes.map((n) => [n.id, n]));
  const headNodes = new Map(head.nodes.map((n) => [n.id, n]));

  const added: GraphModelNode[] = [];
  const removed: GraphModelNode[] = [];
  const changed: GraphDiffNodeChange[] = [];

  for (const node of head.nodes) {
    const before = baseNodes.get(node.id);
    if (!before) {
      added.push(node);
      continue;
    }
    const fields = DIFF_NODE_FIELDS.filter((f) => normStr(before[f]) !== normStr(node[f]));
    if (fields.length > 0) changed.push({ id: node.id, before, after: node, fields: [...fields] });
  }
  for (const node of base.nodes) {
    if (!headNodes.has(node.id)) removed.push(node);
  }

  const baseEdges = new Map(base.edges.map((e) => [edgeKey(e.from, e.to), e]));
  const headEdges = new Map(head.edges.map((e) => [edgeKey(e.from, e.to), e]));
  const edgesAdded: GraphModelEdge[] = [];
  const edgesRemoved: GraphModelEdge[] = [];
  const edgesChanged: GraphDiffEdgeChange[] = [];
  for (const [key, edge] of headEdges) {
    const before = baseEdges.get(key);
    if (!before) edgesAdded.push(edge);
    else if (before.type !== edge.type) {
      edgesChanged.push({ from: edge.from, to: edge.to, before: before.type, after: edge.type });
    }
  }
  for (const [key, edge] of baseEdges) {
    if (!headEdges.has(key)) edgesRemoved.push(edge);
  }

  const touched = new Set<string>([
    ...added.map((n) => n.id),
    ...removed.map((n) => n.id),
    ...changed.map((c) => c.id),
  ]);
  const context = new Map<string, GraphModelNode>();
  const addContext = (id: string): void => {
    if (touched.has(id) || context.has(id)) return;
    const node = headNodes.get(id) ?? baseNodes.get(id);
    if (node) context.set(id, node);
  };
  for (const e of [...edgesAdded, ...edgesRemoved, ...edgesChanged]) {
    addContext(e.from);
    addContext(e.to);
  }

  const baseCycles = new Set(findCycles(buildGraphIndex(base)).cycles.map((c) => c.join('\u0000')));
  const cyclesIntroduced = findCycles(buildGraphIndex(head)).cycles.filter(
    (c) => !baseCycles.has(c.join('\u0000'))
  );

  const summary: GraphDiffSummary = {
    nodesAdded: added.length,
    nodesRemoved: removed.length,
    nodesChanged: changed.length,
    edgesAdded: edgesAdded.length,
    edgesRemoved: edgesRemoved.length,
    edgesChanged: edgesChanged.length,
    hasChanges:
      added.length + removed.length + changed.length + edgesAdded.length + edgesRemoved.length + edgesChanged.length >
      0,
  };

  return {
    nodes: { added, removed, changed },
    edges: { added: edgesAdded, removed: edgesRemoved, changed: edgesChanged },
    context: [...context.values()],
    cyclesIntroduced,
    summary,
  };
}

/** Per-node/edge diff status used by renderers. */
export type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

/**
 * The renderable change-set of a diff as a graph plus status maps: touched
 * nodes, context endpoints, and every added/removed/changed edge.
 */
export function diffToRenderableGraph(diff: GraphDiffCore): {
  graph: GraphModel;
  nodeStatus: Map<string, DiffStatus>;
  edgeStatus: Map<string, DiffStatus>;
} {
  const nodeStatus = new Map<string, DiffStatus>();
  const nodes: GraphModelNode[] = [];
  const addNode = (node: GraphModelNode, status: DiffStatus): void => {
    if (nodeStatus.has(node.id)) return;
    nodeStatus.set(node.id, status);
    nodes.push(node);
  };
  for (const n of diff.nodes.added) addNode(n, 'added');
  for (const n of diff.nodes.removed) addNode(n, 'removed');
  for (const c of diff.nodes.changed) addNode(c.after, 'changed');
  for (const n of diff.context) addNode(n, 'unchanged');

  const edgeStatus = new Map<string, DiffStatus>();
  const edges: GraphModelEdge[] = [];
  const addEdge = (edge: GraphModelEdge, status: DiffStatus): void => {
    const key = edgeKey(edge.from, edge.to);
    if (edgeStatus.has(key)) return;
    edgeStatus.set(key, status);
    edges.push(edge);
  };
  for (const e of diff.edges.added) addEdge(e, 'added');
  for (const e of diff.edges.removed) addEdge(e, 'removed');
  for (const c of diff.edges.changed) addEdge({ from: c.from, to: c.to, type: c.after }, 'changed');

  // Edges are only kept when both endpoints are renderable.
  return {
    graph: { nodes, edges: edges.filter((e) => nodeStatus.has(e.from) && nodeStatus.has(e.to)) },
    nodeStatus,
    edgeStatus,
  };
}

/**
 * Mermaid rendering of a diff: added = green, removed = red (dashed edges),
 * changed = amber, context nodes neutral. Only the change-set is drawn.
 */
export function diffToMermaid(diff: GraphDiffCore): string {
  const { graph, nodeStatus, edgeStatus } = diffToRenderableGraph(diff);
  const ids = mermaidIds(graph.nodes.map((n) => n.id));
  const lines = ['graph TD'];
  for (const node of graph.nodes) {
    const status = nodeStatus.get(node.id) ?? 'unchanged';
    const suffix = status === 'unchanged' ? '' : `:::${status}`;
    lines.push(`  ${ids.get(node.id)}${mermaidShape(node.type, node.id)}${suffix}`);
  }
  const styles: string[] = [];
  graph.edges.forEach((edge, i) => {
    const status = edgeStatus.get(edgeKey(edge.from, edge.to)) ?? 'unchanged';
    const arrow = status === 'removed' ? '-.->' : edge.type === 'devDependency' ? '-.->' : '-->';
    lines.push(`  ${ids.get(edge.from)} ${arrow} ${ids.get(edge.to)}`);
    if (status === 'added') styles.push(`  linkStyle ${i} stroke:#2da44e,stroke-width:2px`);
    else if (status === 'removed') styles.push(`  linkStyle ${i} stroke:#cf222e,stroke-width:2px`);
    else if (status === 'changed') styles.push(`  linkStyle ${i} stroke:#bf8700,stroke-width:2px`);
  });
  lines.push(...styles);
  lines.push('  classDef added fill:#dafbe1,stroke:#2da44e,color:#1a7f37');
  lines.push('  classDef removed fill:#ffebe9,stroke:#cf222e,color:#a40e26,stroke-dasharray:4 3');
  lines.push('  classDef changed fill:#fff8c5,stroke:#bf8700,color:#7d4e00');
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Live status (`workspace status --json`)
// ---------------------------------------------------------------------------

/** Runtime state of one workspace. Every value comes with a human-readable reason. */
export const workspaceLiveStatusSchema = z.enum(['running', 'stopped', 'unhealthy', 'unknown']);
export type WorkspaceLiveStatus = z.infer<typeof workspaceLiveStatusSchema>;

export const workspaceStatusCheckSchema = z.object({
  /** Service name (the recorded process name, or a script name). */
  name: z.string(),
  status: workspaceLiveStatusSchema,
  reason: z.string(),
  source: z.enum(['process', 'health-url', 'port', 'none']),
  pid: z.number().int().optional(),
  startedAt: z.string().optional(),
  port: z.number().int().optional(),
  healthUrl: z.string().optional(),
});
export type WorkspaceStatusCheck = z.infer<typeof workspaceStatusCheckSchema>;

export const workspaceStatusEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  status: workspaceLiveStatusSchema,
  reason: z.string(),
  checks: z.array(workspaceStatusCheckSchema),
});
export type WorkspaceStatusEntry = z.infer<typeof workspaceStatusEntrySchema>;

/** Payload of `workspace status --json` and hub command `workspace.status`. */
export const workspaceStatusReportSchema = z.object({
  root: z.string(),
  checkedAt: z.string(),
  nodes: z.array(workspaceStatusEntrySchema),
  summary: z.object({
    running: z.number().int().nonnegative(),
    stopped: z.number().int().nonnegative(),
    unhealthy: z.number().int().nonnegative(),
    unknown: z.number().int().nonnegative(),
  }),
});
export type WorkspaceStatusReport = z.infer<typeof workspaceStatusReportSchema>;

/** Combine per-service checks into one node status: unhealthy > running > stopped > unknown. */
export function rollupStatus(statuses: readonly WorkspaceLiveStatus[]): WorkspaceLiveStatus {
  if (statuses.includes('unhealthy')) return 'unhealthy';
  if (statuses.includes('running')) return 'running';
  if (statuses.includes('stopped')) return 'stopped';
  return 'unknown';
}
