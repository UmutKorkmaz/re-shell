/**
 * Pure state machine for the terminal workspace-graph explorer (no ink/React
 * imports, so it is unit-testable and cheap to drive with 5000+ nodes).
 *
 * Scaling rules:
 *  - the graph index (adjacency maps) is built once per data load, never per key
 *  - filtering is one O(n) pass over precomputed lowercase haystacks
 *  - the UI renders ONLY the `[offset, offset + height)` window of the filtered
 *    rows, so a keypress costs O(viewport), independent of graph size
 *  - transitive up/downstream counts and shortest paths are computed lazily for
 *    the one node in focus, O(V + E)
 */

import {
  buildGraphIndex,
  findCycles,
  reachableFrom,
  shortestDependencyPath,
  type CycleReport,
  type DependencyPath,
  type GraphIndex,
  type GraphModel,
  type WorkspaceLiveStatus,
} from '@re-shell/contracts';

export interface ExplorerStatus {
  status: WorkspaceLiveStatus;
  reason: string;
}

export interface ExplorerData {
  graph: GraphModel;
  /** Live status per node name; absent = not fetched (shown as `unknown`). */
  statuses: ReadonlyMap<string, ExplorerStatus>;
  /** Epoch ms the data was (re)loaded. */
  loadedAt: number;
}

export type FacetKey = 'language' | 'framework' | 'type' | 'status';
export const FACETS: readonly FacetKey[] = ['language', 'framework', 'type', 'status'];

export type ExplorerMode = 'list' | 'search' | 'focus' | 'help';

export interface Relation {
  id: string;
  /** `up`: the focused node depends on it. `down`: it depends on the focused node. */
  rel: 'up' | 'down';
}

/** Everything derived from one {@link ExplorerData}; rebuilt only when data changes. */
export interface ExplorerModel {
  data: ExplorerData;
  index: GraphIndex;
  cycles: CycleReport;
  /** Sorted node ids. */
  ids: readonly string[];
  /** Precomputed lowercase search text per id (name, path, framework, language, type). */
  haystack: ReadonlyMap<string, string>;
  facetValues: Readonly<Record<FacetKey, readonly string[]>>;
}

export function statusOf(model: ExplorerModel, id: string): WorkspaceLiveStatus {
  return model.data.statuses.get(id)?.status ?? 'unknown';
}

function facetValueOf(model: ExplorerModel, id: string, facet: FacetKey): string {
  if (facet === 'status') return statusOf(model, id);
  const node = model.index.nodes.get(id)!;
  const raw = facet === 'type' ? node.type : facet === 'language' ? node.language : node.framework;
  return raw ? raw : '-';
}

export function buildExplorerModel(data: ExplorerData): ExplorerModel {
  const index = buildGraphIndex(data.graph);
  const ids = [...index.nodeIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const haystack = new Map<string, string>();
  const sets: Record<FacetKey, Set<string>> = {
    language: new Set(),
    framework: new Set(),
    type: new Set(),
    status: new Set(),
  };
  const model: ExplorerModel = {
    data,
    index,
    cycles: findCycles(index),
    ids,
    haystack,
    facetValues: { language: [], framework: [], type: [], status: [] },
  };
  for (const id of ids) {
    const n = index.nodes.get(id)!;
    haystack.set(id, [id, n.path ?? '', n.framework ?? '', n.language ?? '', n.type].join('\n').toLowerCase());
    for (const facet of FACETS) sets[facet].add(facetValueOf(model, id, facet));
  }
  (model as { facetValues: ExplorerModel['facetValues'] }).facetValues = {
    language: [...sets.language].sort(),
    framework: [...sets.framework].sort(),
    type: [...sets.type].sort(),
    status: [...sets.status].sort(),
  };
  return model;
}

export type Filters = Partial<Record<FacetKey, string>>;

/** One O(n) pass: text query (all whitespace-separated terms must match) + facet equality. */
export function filterRows(model: ExplorerModel, query: string, filters: Filters): string[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const active = FACETS.filter((f) => filters[f] !== undefined);
  if (terms.length === 0 && active.length === 0) return model.ids as string[];
  const out: string[] = [];
  for (const id of model.ids) {
    if (terms.length > 0) {
      const hay = model.haystack.get(id)!;
      let ok = true;
      for (const t of terms) {
        if (!hay.includes(t)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
    }
    let pass = true;
    for (const f of active) {
      if (facetValueOf(model, id, f) !== filters[f]) {
        pass = false;
        break;
      }
    }
    if (pass) out.push(id);
  }
  return out;
}

/** Keep `cursor` inside the window `[offset, offset + height)`; returns the new offset. */
export function scrollIntoView(cursor: number, offset: number, height: number, total: number): number {
  if (total <= height) return 0;
  let next = offset;
  if (cursor < next) next = cursor;
  else if (cursor >= next + height) next = cursor - height + 1;
  return Math.max(0, Math.min(next, total - height));
}

export interface PathState {
  from: string;
  /** null while only the start is picked. */
  result: DependencyPath | 'none' | null;
  to: string | null;
}

export interface ExplorerState {
  model: ExplorerModel;
  mode: ExplorerMode;
  query: string;
  filters: Filters;
  rows: readonly string[];
  cursor: number;
  offset: number;
  /** Viewport rows available to the list. */
  height: number;
  focus: { id: string; relations: Relation[]; cursor: number; offset: number; history: string[] } | null;
  path: PathState | null;
  message: string;
}

export function createExplorerState(data: ExplorerData, height: number): ExplorerState {
  const model = buildExplorerModel(data);
  return {
    model,
    mode: 'list',
    query: '',
    filters: {},
    rows: model.ids,
    cursor: 0,
    offset: 0,
    height: Math.max(3, height),
    focus: null,
    path: null,
    message: '',
  };
}

export type ExplorerAction =
  | { type: 'move'; delta: number }
  | { type: 'moveTo'; index: number }
  | { type: 'page'; direction: 1 | -1 }
  | { type: 'home' }
  | { type: 'end' }
  | { type: 'startSearch' }
  | { type: 'typeSearch'; text: string }
  | { type: 'backspaceSearch' }
  | { type: 'endSearch'; clear: boolean }
  | { type: 'cycleFacet'; facet: FacetKey }
  | { type: 'clearFilters' }
  | { type: 'focus' }
  | { type: 'focusRelation' }
  | { type: 'back' }
  | { type: 'togglePath' }
  | { type: 'help' }
  | { type: 'resize'; height: number }
  | { type: 'data'; data: ExplorerData }
  | { type: 'statuses'; statuses: ReadonlyMap<string, ExplorerStatus>; loadedAt: number };

export function selectedId(state: ExplorerState): string | undefined {
  if (state.mode === 'focus' && state.focus) {
    return state.focus.relations[state.focus.cursor]?.id ?? state.focus.id;
  }
  return state.rows[state.cursor];
}

export function relationsOf(model: ExplorerModel, id: string): Relation[] {
  const ups = [...(model.index.dependencies.get(id) ?? [])].sort();
  const downs = [...(model.index.dependents.get(id) ?? [])].sort();
  return [...ups.map((u) => ({ id: u, rel: 'up' as const })), ...downs.map((d) => ({ id: d, rel: 'down' as const }))];
}

function withRows(state: ExplorerState, query: string, filters: Filters): ExplorerState {
  const prevId = state.rows[state.cursor];
  const rows = filterRows(state.model, query, filters);
  // Keep the same node selected when it still matches; otherwise go to the top.
  const keep = prevId === undefined ? -1 : rows.indexOf(prevId);
  const cursor = keep >= 0 ? keep : 0;
  return {
    ...state,
    query,
    filters,
    rows,
    cursor,
    offset: scrollIntoView(cursor, keep >= 0 ? state.offset : 0, state.height, rows.length),
  };
}

function enterFocus(state: ExplorerState, id: string, history: string[]): ExplorerState {
  return {
    ...state,
    mode: 'focus',
    focus: { id, relations: relationsOf(state.model, id), cursor: 0, offset: 0, history },
  };
}

function moveList(state: ExplorerState, cursor: number): ExplorerState {
  const total = state.rows.length;
  const next = total === 0 ? 0 : Math.max(0, Math.min(total - 1, cursor));
  return { ...state, cursor: next, offset: scrollIntoView(next, state.offset, state.height, total) };
}

function moveFocus(state: ExplorerState, cursor: number): ExplorerState {
  const focus = state.focus!;
  const total = focus.relations.length;
  const next = total === 0 ? 0 : Math.max(0, Math.min(total - 1, cursor));
  return {
    ...state,
    focus: { ...focus, cursor: next, offset: scrollIntoView(next, focus.offset, state.height, total) },
  };
}

export function explorerReducer(state: ExplorerState, action: ExplorerAction): ExplorerState {
  const inFocus = state.mode === 'focus' && state.focus !== null;
  const cursor = inFocus ? state.focus!.cursor : state.cursor;
  const move = (to: number): ExplorerState => (inFocus ? moveFocus(state, to) : moveList(state, to));

  switch (action.type) {
    case 'move':
      return move(cursor + action.delta);
    case 'moveTo':
      return move(action.index);
    case 'page':
      return move(cursor + action.direction * Math.max(1, state.height - 1));
    case 'home':
      return move(0);
    case 'end':
      return move(Number.MAX_SAFE_INTEGER);
    case 'startSearch':
      return { ...state, mode: 'search', message: '' };
    case 'typeSearch':
      return withRows(state, state.query + action.text, state.filters);
    case 'backspaceSearch':
      return withRows(state, state.query.slice(0, -1), state.filters);
    case 'endSearch': {
      const next = action.clear ? withRows(state, '', state.filters) : state;
      return { ...next, mode: 'list' };
    }
    case 'cycleFacet': {
      const options = [undefined, ...state.model.facetValues[action.facet]];
      const current = options.indexOf(state.filters[action.facet]);
      const value = options[(current + 1) % options.length];
      const filters = { ...state.filters };
      if (value === undefined) delete filters[action.facet];
      else filters[action.facet] = value;
      return { ...withRows({ ...state, mode: state.mode === 'focus' ? 'list' : state.mode, focus: null }, state.query, filters), message: '' };
    }
    case 'clearFilters':
      return withRows({ ...state, mode: 'list', focus: null }, '', {});
    case 'focus': {
      const id = state.rows[state.cursor];
      return id === undefined ? state : enterFocus(state, id, []);
    }
    case 'focusRelation': {
      if (!inFocus) return state;
      const target = state.focus!.relations[state.focus!.cursor];
      if (!target) return state;
      return enterFocus(state, target.id, [...state.focus!.history, state.focus!.id]);
    }
    case 'back': {
      if (state.mode === 'help') return { ...state, mode: 'list' };
      if (!inFocus) {
        if (state.path) return { ...state, path: null, message: 'path cleared' };
        return state;
      }
      const history = state.focus!.history;
      if (history.length === 0) {
        // Leave focus; point the list cursor at the node we were looking at.
        const idx = state.rows.indexOf(state.focus!.id);
        const base: ExplorerState = { ...state, mode: 'list', focus: null };
        return idx >= 0 ? moveList(base, idx) : base;
      }
      const prev = history[history.length - 1];
      return enterFocus(state, prev, history.slice(0, -1));
    }
    case 'togglePath': {
      const id = selectedId(state);
      if (id === undefined) return state;
      if (!state.path) return { ...state, path: { from: id, result: null, to: null }, message: `path start: ${id} (select another node, press p)` };
      if (state.path.result !== null) return { ...state, path: null, message: 'path cleared' };
      if (id === state.path.from) return { ...state, path: null, message: 'path cleared' };
      const found = shortestDependencyPath(state.model.index, state.path.from, id);
      return {
        ...state,
        path: { from: state.path.from, to: id, result: found ?? 'none' },
        message: found ? `path: ${found.path.length - 1} hop(s)` : `no dependency path between ${state.path.from} and ${id}`,
      };
    }
    case 'help':
      return { ...state, mode: state.mode === 'help' ? 'list' : 'help' };
    case 'resize': {
      const height = Math.max(3, action.height);
      const next = { ...state, height };
      return {
        ...next,
        offset: scrollIntoView(state.cursor, state.offset, height, state.rows.length),
        focus: state.focus
          ? { ...state.focus, offset: scrollIntoView(state.focus.cursor, state.focus.offset, height, state.focus.relations.length) }
          : null,
      };
    }
    case 'statuses': {
      // Status-only refresh: keep mode, focus, path and selection exactly as they are.
      const model = buildExplorerModel({ ...state.model.data, statuses: action.statuses, loadedAt: action.loadedAt });
      const selected = state.rows[state.cursor];
      const rows = filterRows(model, state.query, state.filters);
      const keep = selected === undefined ? -1 : rows.indexOf(selected);
      const cursor = keep >= 0 ? keep : 0;
      return {
        ...state,
        model,
        rows,
        cursor,
        offset: scrollIntoView(cursor, keep >= 0 ? state.offset : 0, state.height, rows.length),
      };
    }
    case 'data': {
      const model = buildExplorerModel(action.data);
      const selected = selectedId(state);
      const focusId = state.focus?.id;
      const base: ExplorerState = { ...state, model };
      let next = withRows({ ...base, cursor: 0 }, state.query, state.filters);
      // Restore the selection by id if the node survived the reload.
      const restored = selected === undefined ? -1 : next.rows.indexOf(selected);
      if (restored >= 0) next = moveList(next, restored);
      next = {
        ...next,
        mode: state.mode === 'focus' ? 'list' : state.mode,
        focus: null,
        path: state.path
          ? model.index.nodes.has(state.path.from) && (state.path.to === null || model.index.nodes.has(state.path.to))
            ? {
                ...state.path,
                result:
                  state.path.to === null
                    ? null
                    : (shortestDependencyPath(model.index, state.path.from, state.path.to) ?? 'none'),
              }
            : null
          : null,
        message: `reloaded ${model.ids.length} nodes`,
      };
      // Re-enter focus when the focused node still exists.
      if (state.mode === 'focus' && focusId && model.index.nodes.has(focusId)) {
        next = enterFocus(next, focusId, []);
      }
      return next;
    }
    default:
      return state;
  }
}

/** The `[offset, offset + height)` window of an array, i.e. the only rows ever rendered. */
export function windowOf<T>(items: readonly T[], offset: number, height: number): T[] {
  return items.slice(offset, offset + height) as T[];
}

/** Transitive counts for the node in focus (lazy, O(V + E)). */
export function relationCounts(model: ExplorerModel, id: string): {
  directUp: number;
  directDown: number;
  transitiveUp: number;
  transitiveDown: number;
} {
  return {
    directUp: model.index.dependencies.get(id)?.length ?? 0,
    directDown: model.index.dependents.get(id)?.length ?? 0,
    transitiveUp: reachableFrom(model.index, id, 'dependencies').size,
    transitiveDown: reachableFrom(model.index, id, 'dependents').size,
  };
}
