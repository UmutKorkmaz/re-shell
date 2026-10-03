import type { Edge, MarkerType, Node } from '@xyflow/react';
import {
  buildGraphIndex,
  diffToRenderableGraph,
  edgeKey,
  findCycles,
  type CycleReport,
  type DependencyPath,
  type DiffStatus,
  type GraphDiffCore,
  type GraphIndex,
  type GraphModel,
  type WorkspaceLiveStatus,
} from '@re-shell/contracts';
import type { GraphNodeKind } from '../shared/feedSchemas';
import type { GraphData } from './graphData';
import type { ActivateEvent, GraphNodeData, GraphNodeHighlight } from './GraphNodeCard';
import type { LayoutResult } from './layout';

/** Graph being drawn: the live workspace, or the change-set of a diff. */
export interface DisplayGraph {
  model: GraphModel;
  index: GraphIndex;
  cycles: CycleReport;
  meta: ReadonlyMap<string, { kind: GraphNodeKind; framework: string | null; language?: string }>;
  diffNode?: ReadonlyMap<string, DiffStatus>;
  diffEdge?: ReadonlyMap<string, DiffStatus>;
}

export function displayFromData(data: GraphData): DisplayGraph {
  const meta = new Map<string, { kind: GraphNodeKind; framework: string | null; language?: string }>();
  for (const n of data.nodes) {
    meta.set(n.name, { kind: n.kind, framework: n.framework, ...(n.language ? { language: n.language } : {}) });
  }
  return { model: data.model, index: data.index, cycles: data.cycles, meta };
}

/** The change-set of a diff as a drawable graph (touched nodes + context, changed edges). */
export function displayFromDiff(diff: GraphDiffCore): DisplayGraph {
  const { graph, nodeStatus, edgeStatus } = diffToRenderableGraph(diff);
  const index = buildGraphIndex(graph);
  const meta = new Map<string, { kind: GraphNodeKind; framework: string | null; language?: string }>();
  for (const n of graph.nodes) {
    meta.set(n.id, {
      kind: n.type === 'app' ? 'app' : 'service',
      framework: n.framework ?? null,
      ...(n.language ? { language: n.language } : {}),
    });
  }
  return { model: graph, index, cycles: findCycles(index), meta, diffNode: nodeStatus, diffEdge: edgeStatus };
}

export interface ViewState {
  /** Ids matching search + facet filters; `null` = no filter active. */
  matches: ReadonlySet<string> | null;
  /** Hide non-matching nodes instead of dimming them. */
  hide: boolean;
  selected: string | null;
  upstream: ReadonlySet<string>;
  downstream: ReadonlySet<string>;
  path: DependencyPath | null;
  showCycles: boolean;
  statusOf: (id: string) => WorkspaceLiveStatus;
  reasonOf: (id: string) => string | undefined;
  portOf: (id: string) => number | undefined;
}

export interface FlowBuild {
  nodes: Node<GraphNodeData>[];
  edges: Edge[];
}

/**
 * Identity cache. A node whose visual state did not change keeps the SAME `data`
 * and the SAME React Flow node object (likewise edges), so React Flow's store
 * and the memoized cards skip it entirely: a filter or selection change costs
 * work proportional to what changed, not to the size of the graph.
 */
export interface FlowCache {
  data: Map<string, { key: string; data: GraphNodeData }>;
  nodes: Map<string, { key: string; pos: { x: number; y: number }; node: Node<GraphNodeData> }>;
  edges: Map<string, { key: string; edge: Edge }>;
}

export function createFlowCache(): FlowCache {
  return { data: new Map(), nodes: new Map(), edges: new Map() };
}

export function edgeTypeFor(nodeCount: number): 'smoothstep' | 'default' | 'straight' {
  if (nodeCount > 800) return 'straight';
  if (nodeCount > 250) return 'default';
  return 'smoothstep';
}

export const COMPACT_THRESHOLD = 150;

/**
 * Whether the canvas should dim every edge that is not explicitly emphasized:
 * while a node/path is in focus or a search/facet filter is active. Applied as a
 * class on the React Flow container so unemphasized edges never change.
 */
export function dimsEdges(view: Pick<ViewState, 'selected' | 'path' | 'matches'>): boolean {
  return view.selected !== null || view.path !== null || view.matches !== null;
}

/** Whether a node or path is in focus (container class `gx-focus` dims every non-highlighted node). */
export function hasFocus(view: Pick<ViewState, 'selected' | 'path'>): boolean {
  return view.selected !== null || view.path !== null;
}

const EMPTY: ReadonlySet<string> = new Set<string>();

/**
 * Turn a display graph + view state into React Flow nodes/edges. Linear in
 * V + E: sets/maps are consulted, never searched. Node `data` objects are
 * reused from `cache` while their visual state is unchanged.
 */
export function buildFlow(
  graph: DisplayGraph,
  layout: LayoutResult,
  view: ViewState,
  cache: FlowCache,
  openFor: (id: string) => (event?: ActivateEvent) => void
): FlowBuild {
  const compact = graph.model.nodes.length > COMPACT_THRESHOLD;
  const pathNodes = view.path ? new Set(view.path.path) : null;
  const pathEdges = new Set<string>();
  if (view.path) {
    for (let i = 0; i + 1 < view.path.path.length; i++) {
      pathEdges.add(edgeKey(view.path.path[i], view.path.path[i + 1]));
    }
  }
  const focusActive = view.selected !== null;
  // While a path is shown it is the only emphasis: up/downstream sets step aside.
  const upSet = view.path ? EMPTY : view.upstream;
  const downSet = view.path ? EMPTY : view.downstream;
  const cyc = view.showCycles ? graph.cycles : null;

  const nodes: Node<GraphNodeData>[] = [];
  for (const node of graph.model.nodes) {
    const id = node.id;
    const pos = layout.positions.get(id) ?? { x: 0, y: 0 };
    const matched = view.matches === null || view.matches.has(id);
    const hidden = view.hide && !matched;

    let highlight: GraphNodeHighlight = 'none';
    if (view.path && pathNodes!.has(id)) {
      highlight = id === view.path.path[0] || id === view.path.path[view.path.path.length - 1] ? 'path-end' : 'path';
    } else if (id === view.selected) highlight = 'selected';
    else if (upSet.has(id)) highlight = 'upstream';
    else if (downSet.has(id)) highlight = 'downstream';

    // Dimming is a container rule, never per-node data: `gx-focus` (a node/path is
    // selected) and `gx-filtering` (a search/facet is active) dim every node whose
    // `data-highlight` is `none` and that is not a `gn-match`. Selecting or typing
    // therefore restyles only the handful of emphasized nodes, not all of them.
    const isMatch = view.matches !== null && matched;
    const diff = graph.diffNode?.get(id);
    const status = view.statusOf(id);
    const cycle = cyc ? cyc.nodeIds.has(id) : false;
    const key = `${status}|${isMatch ? 1 : 0}|${highlight}|${cycle ? 1 : 0}|${diff ?? ''}|${compact ? 1 : 0}`;

    let entry = cache.data.get(id);
    if (!entry || entry.key !== key) {
      const meta = graph.meta.get(id);
      const reason = view.reasonOf(id);
      const port = view.portOf(id);
      const data: GraphNodeData = {
        label: id,
        kind: meta?.kind ?? 'service',
        framework: meta?.framework ?? null,
        ...(meta?.language ? { language: meta.language } : {}),
        ...(port !== undefined ? { port } : {}),
        status,
        ...(reason ? { statusReason: reason } : {}),
        ...(isMatch ? { match: true } : {}),
        highlight,
        cycle,
        ...(diff ? { diff } : {}),
        compact,
        onOpen: openFor(id),
      };
      entry = { key, data };
      cache.data.set(id, entry);
    }
    const selected = id === view.selected;
    const nodeKey = `${selected ? 1 : 0}|${hidden ? 1 : 0}`;
    let cachedNode = cache.nodes.get(id);
    if (!cachedNode || cachedNode.key !== nodeKey || cachedNode.pos !== pos || cachedNode.node.data !== entry.data) {
      cachedNode = {
        key: nodeKey,
        pos,
        node: {
          id,
          type: 'topology',
          position: pos,
          data: entry.data,
          selected,
          ...(hidden ? { hidden: true } : {}),
        },
      };
      cache.nodes.set(id, cachedNode);
    }
    nodes.push(cachedNode.node);
  }

  const type = edgeTypeFor(graph.model.nodes.length);
  const arrows = graph.model.nodes.length <= 400;
  const edges: Edge[] = [];
  for (const e of graph.model.edges) {
    const key = edgeKey(e.from, e.to);
    const fromMatched = view.matches === null || view.matches.has(e.from);
    const toMatched = view.matches === null || view.matches.has(e.to);
    const hidden = view.hide && !(fromMatched && toMatched);

    // Only EMPHASIZED edges carry a class. "Everything else is dimmed" is a
    // container-level rule (see `dimsEdges` and graph-theme.css), so selecting a
    // node or typing a search restyles a handful of edges instead of thousands.
    let cls = '';
    const diffStatus = graph.diffEdge?.get(key);
    if (diffStatus && diffStatus !== 'unchanged') cls = `ge-${diffStatus}`;
    else if (view.path && pathEdges.has(key)) cls = 'ge-path';
    else if (focusActive || view.path) {
      const sel = view.selected;
      const isUp = sel !== null && (e.from === sel || upSet.has(e.from)) && upSet.has(e.to);
      const isDown = sel !== null && (e.to === sel || downSet.has(e.to)) && downSet.has(e.from);
      cls = isUp ? 'ge-up' : isDown ? 'ge-down' : '';
    } else if (cyc && cyc.edgeKeys.has(key)) cls = 'ge-cycle';
    else if (view.matches !== null && fromMatched && toMatched) cls = 'ge-match';

    const id = `${e.from}->${e.to}`;
    const edgeKeyStr = `${type}|${cls}|${hidden ? 1 : 0}|${arrows ? 1 : 0}`;
    let cachedEdge = cache.edges.get(id);
    if (!cachedEdge || cachedEdge.key !== edgeKeyStr) {
      cachedEdge = {
        key: edgeKeyStr,
        edge: {
          id,
          source: e.from,
          target: e.to,
          type,
          ...(cls ? { className: cls } : {}),
          ...(hidden ? { hidden: true } : {}),
          ...(arrows ? { markerEnd: { type: 'arrowclosed' as MarkerType, width: 14, height: 14 } } : {}),
        },
      };
      cache.edges.set(id, cachedEdge);
    }
    edges.push(cachedEdge.edge);
  }
  return { nodes, edges };
}
