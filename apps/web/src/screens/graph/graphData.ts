import {
  buildGraphIndex,
  findCycles,
  type CycleReport,
  type GraphIndex,
  type GraphModel,
  type GraphModelEdge,
  type GraphModelNode,
  type WorkspaceLiveStatus,
} from '@re-shell/contracts';
import type { GraphNodeKind, KindedGraphNode, WorkspaceGraph } from '../shared/feedSchemas';

/** Everything the screen derives from one `workspace.graph` payload. Built once per payload. */
export interface GraphData {
  nodes: KindedGraphNode[];
  byId: Map<string, KindedGraphNode>;
  model: GraphModel;
  index: GraphIndex;
  cycles: CycleReport;
}

export interface NodeFacts {
  id: string;
  /** Lowercased `name\npath` for substring search. */
  haystack: string;
  language: string;
  framework: string;
  type: string;
}

/**
 * Language for a node: the CLI's detected `language` when present, otherwise a
 * best-effort inference from the framework id (`react-ts` -> typescript, ...).
 */
export function languageOf(node: { language?: string | null; framework?: string | null }): string {
  if (node.language) return node.language;
  const fw = node.framework ?? '';
  if (!fw) return 'unknown';
  if (fw.endsWith('-ts') || fw === 'angular') return 'typescript';
  return 'javascript';
}

/**
 * Normalize defensively: even though the schema fills defaults, collapse any
 * partial node into a well-formed shape so layout and edge logic never throw on
 * unknown data. Names that appear twice keep the first definition.
 */
export function normalizeNodes(graph: WorkspaceGraph): KindedGraphNode[] {
  const seen = new Set<string>();
  const out: KindedGraphNode[] = [];
  const push = (n: Partial<KindedGraphNode>, kind: GraphNodeKind): void => {
    const name = n.name ?? 'unknown';
    if (seen.has(name)) return;
    seen.add(name);
    out.push({
      name,
      path: n.path ?? '',
      framework: n.framework ?? null,
      dependencies: Array.isArray(n.dependencies) ? n.dependencies : [],
      kind,
      ...(n.type ? { type: n.type } : {}),
      ...(n.language !== undefined ? { language: n.language } : {}),
    });
  };
  for (const n of graph.apps ?? []) push(n, 'app');
  for (const n of graph.services ?? []) push(n, 'service');
  return out;
}

/** Facet value for the "type" filter: the CLI's workspace type when present, else app/service. */
export function typeOf(node: KindedGraphNode): string {
  return node.type ?? node.kind;
}

export function buildGraphData(graph: WorkspaceGraph): GraphData {
  const nodes = normalizeNodes(graph);
  const byId = new Map(nodes.map((n) => [n.name, n]));

  const modelNodes: GraphModelNode[] = nodes.map((n) => ({
    id: n.name,
    type: typeOf(n),
    framework: n.framework,
    language: languageOf(n),
    path: n.path,
  }));
  // Only names that are actual nodes are valid edge endpoints; ignore deps that
  // point at external (non-workspace) packages.
  const edges: GraphModelEdge[] = [];
  for (const n of nodes) {
    for (const dep of n.dependencies) {
      if (byId.has(dep)) edges.push({ from: n.name, to: dep, type: 'dependency' });
    }
  }
  const model: GraphModel = { nodes: modelNodes, edges };
  const index = buildGraphIndex(model);
  return { nodes, byId, model, index, cycles: findCycles(index) };
}

/**
 * Per-node facet facts for a model (live graph or diff change-set), precomputed
 * so filtering is a single O(n) pass with no per-keystroke allocation.
 */
export function factsFromModel(model: GraphModel): NodeFacts[] {
  return model.nodes.map((n) => ({
    id: n.id,
    haystack: `${n.id}\n${n.path ?? ''}`.toLowerCase(),
    language: n.language || 'unknown',
    framework: n.framework || 'none',
    type: n.type || 'package',
  }));
}

export type StatusLookup = (id: string) => WorkspaceLiveStatus;
