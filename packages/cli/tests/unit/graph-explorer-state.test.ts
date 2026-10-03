import { describe, expect, it } from 'vitest';
import type { GraphModel } from '@re-shell/contracts';
import {
  createExplorerState,
  explorerReducer,
  filterRows,
  relationCounts,
  scrollIntoView,
  selectedId,
  windowOf,
  buildExplorerModel,
  type ExplorerAction,
  type ExplorerData,
  type ExplorerState,
} from '../../src/utils/graph-explorer-state';
import { syntheticGraph, syntheticStatuses } from '../utils/synthetic-graph';

const N = (id: string, type = 'package', extra: Record<string, unknown> = {}) => ({ id, type, ...extra });
const E = (from: string, to: string) => ({ from, to, type: 'dependency' as const });

const SMALL: GraphModel = {
  nodes: [
    N('web', 'app', { framework: 'react-ts', language: 'typescript', path: 'apps/web' }),
    N('api', 'app', { framework: null, language: 'go', path: 'apps/api' }),
    N('ui', 'lib', { framework: 'react-ts', language: 'typescript', path: 'packages/ui' }),
    N('core', 'package', { language: 'typescript', path: 'packages/core' }),
    N('loop-a', 'package', { path: 'packages/loop-a' }),
    N('loop-b', 'package', { path: 'packages/loop-b' }),
  ],
  edges: [E('web', 'ui'), E('ui', 'core'), E('api', 'core'), E('loop-a', 'loop-b'), E('loop-b', 'loop-a')],
};

function data(graph: GraphModel, statuses: ExplorerData['statuses'] = new Map()): ExplorerData {
  return { graph, statuses, loadedAt: 1 };
}

function run(state: ExplorerState, ...actions: ExplorerAction[]): ExplorerState {
  return actions.reduce(explorerReducer, state);
}

describe('graph explorer state', () => {
  const init = () =>
    createExplorerState(
      data(SMALL, new Map([['web', { status: 'running' as const, reason: 'up' }], ['api', { status: 'unhealthy' as const, reason: 'sick' }]])),
      4
    );

  it('lists sorted nodes and selects the first', () => {
    const s = init();
    expect(s.rows).toEqual(['api', 'core', 'loop-a', 'loop-b', 'ui', 'web']);
    expect(selectedId(s)).toBe('api');
  });

  it('moves with clamping and keeps the cursor inside the viewport window', () => {
    let s = init();
    s = run(s, { type: 'move', delta: -5 });
    expect(s.cursor).toBe(0);
    s = run(s, { type: 'move', delta: 4 });
    expect(s.cursor).toBe(4);
    expect(s.offset).toBe(1); // height 4: window [1,5)
    s = run(s, { type: 'end' });
    expect(s.cursor).toBe(5);
    expect(s.offset).toBe(2);
    s = run(s, { type: 'home' });
    expect([s.cursor, s.offset]).toEqual([0, 0]);
    s = run(s, { type: 'page', direction: 1 });
    expect(s.cursor).toBe(3);
  });

  it('searches name/path/framework/language/type, all terms must match', () => {
    const m = buildExplorerModel(data(SMALL));
    expect(filterRows(m, 'loop', {})).toEqual(['loop-a', 'loop-b']);
    expect(filterRows(m, 'PACKAGES/ui', {})).toEqual(['ui']);
    expect(filterRows(m, 'react typescript', {})).toEqual(['ui', 'web']);
    expect(filterRows(m, 'go', {})).toContain('api');
    expect(filterRows(m, 'zzz', {})).toEqual([]);
  });

  it('typing narrows rows live, backspace widens, Esc clears and Enter keeps', () => {
    let s = run(init(), { type: 'startSearch' });
    expect(s.mode).toBe('search');
    s = run(s, { type: 'typeSearch', text: 'l' }, { type: 'typeSearch', text: 'o' });
    expect(s.rows).toEqual(['loop-a', 'loop-b']);
    s = run(s, { type: 'backspaceSearch' });
    expect(s.query).toBe('l');
    expect(s.rows.length).toBeGreaterThan(2); // 'l' matches ui, loop-*, ...
    s = run(s, { type: 'endSearch', clear: false });
    expect([s.mode, s.query]).toEqual(['list', 'l']);
    s = run(s, { type: 'startSearch' }, { type: 'endSearch', clear: true });
    expect([s.mode, s.query, s.rows.length]).toEqual(['list', '', 6]);
  });

  it('cycles facet filters through every value and back to all, per facet', () => {
    let s = init();
    const seen: Array<string | undefined> = [];
    for (let i = 0; i < 5; i++) {
      s = run(s, { type: 'cycleFacet', facet: 'language' });
      seen.push(s.filters.language);
    }
    expect(seen).toEqual(['-', 'go', 'typescript', undefined, '-']);
    s = run(init(), { type: 'cycleFacet', facet: 'status' });
    // status facet values are sorted: running, unhealthy, unknown
    expect(s.filters.status).toBe('running');
    expect(s.rows).toEqual(['web']);
    s = run(s, { type: 'cycleFacet', facet: 'type' });
    expect(s.filters).toEqual({ status: 'running', type: 'app' });
    s = run(s, { type: 'clearFilters' });
    expect(s.filters).toEqual({});
    expect(s.rows).toHaveLength(6);
  });

  it('filters by facet and text together and keeps the selected node when it still matches', () => {
    let s = init();
    s = run(s, { type: 'moveTo', index: 4 }); // ui
    expect(selectedId(s)).toBe('ui');
    s = run(s, { type: 'startSearch' }, { type: 'typeSearch', text: 'react' }, { type: 'endSearch', clear: false });
    expect(s.rows).toEqual(['ui', 'web']);
    expect(selectedId(s)).toBe('ui'); // still matches => selection kept
    s = run(s, { type: 'cycleFacet', facet: 'type' }); // 'app' excludes ui => falls back to the top row
    expect(s.rows).toEqual(['web']);
    expect(selectedId(s)).toBe('web');
  });

  it('focus shows dependencies then dependents; Enter follows; back unwinds the history', () => {
    let s = init();
    s = run(s, { type: 'moveTo', index: 1 }, { type: 'focus' }); // core
    expect(s.mode).toBe('focus');
    expect(s.focus!.relations).toEqual([
      { id: 'api', rel: 'down' },
      { id: 'ui', rel: 'down' },
    ]);
    s = run(s, { type: 'move', delta: 1 }, { type: 'focusRelation' }); // -> ui
    expect(s.focus!.id).toBe('ui');
    expect(s.focus!.relations).toEqual([
      { id: 'core', rel: 'up' },
      { id: 'web', rel: 'down' },
    ]);
    s = run(s, { type: 'back' });
    expect(s.focus!.id).toBe('core');
    s = run(s, { type: 'back' });
    expect(s.mode).toBe('list');
    expect(selectedId(s)).toBe('core');
  });

  it('computes the shortest path between two picked nodes, in either direction, and reports no path', () => {
    let s = init();
    s = run(s, { type: 'moveTo', index: 5 }, { type: 'togglePath' }); // web
    expect(s.path).toMatchObject({ from: 'web', result: null });
    s = run(s, { type: 'moveTo', index: 1 }, { type: 'togglePath' }); // core
    expect(s.path!.result).toEqual({ path: ['web', 'ui', 'core'], dependent: 'a' });
    s = run(s, { type: 'togglePath' });
    expect(s.path).toBeNull();
    s = run(s, { type: 'moveTo', index: 1 }, { type: 'togglePath' }, { type: 'moveTo', index: 5 }, { type: 'togglePath' });
    expect(s.path!.result).toEqual({ path: ['web', 'ui', 'core'], dependent: 'b' });
    s = run(s, { type: 'togglePath' }, { type: 'moveTo', index: 0 }, { type: 'togglePath' }, { type: 'moveTo', index: 2 }, { type: 'togglePath' });
    expect(s.path!.result).toBe('none');
    expect(s.message).toContain('no dependency path');
  });

  it('detects cycles in the model and relation counts are transitive', () => {
    const m = buildExplorerModel(data(SMALL));
    expect(m.cycles.cycles).toEqual([['loop-a', 'loop-b']]);
    expect(relationCounts(m, 'web')).toEqual({ directUp: 1, directDown: 0, transitiveUp: 2, transitiveDown: 0 });
    expect(relationCounts(m, 'core')).toEqual({ directUp: 0, directDown: 2, transitiveUp: 0, transitiveDown: 3 });
  });

  it('resize recomputes the window; scrollIntoView clamps', () => {
    expect(scrollIntoView(10, 0, 5, 100)).toBe(6);
    expect(scrollIntoView(2, 6, 5, 100)).toBe(2);
    expect(scrollIntoView(99, 0, 5, 100)).toBe(95);
    expect(scrollIntoView(3, 9, 50, 10)).toBe(0);
    let s = run(init(), { type: 'moveTo', index: 5 });
    s = run(s, { type: 'resize', height: 6 });
    expect(s.offset).toBe(0);
    expect(windowOf([1, 2, 3, 4, 5], 1, 2)).toEqual([2, 3]);
  });

  it('data reload keeps selection/filters and re-runs the path; deleted nodes drop out', () => {
    let s = init();
    s = run(s, { type: 'moveTo', index: 5 }, { type: 'togglePath' }, { type: 'moveTo', index: 1 }, { type: 'togglePath' });
    expect(selectedId(s)).toBe('core');
    const next: GraphModel = {
      nodes: [...SMALL.nodes, N('extra', 'package', { path: 'packages/extra' })],
      edges: [...SMALL.edges, E('extra', 'core')],
    };
    s = run(s, { type: 'data', data: data(next) });
    expect(s.rows).toContain('extra');
    expect(selectedId(s)).toBe('core');
    expect(s.path!.result).toEqual({ path: ['web', 'ui', 'core'], dependent: 'a' });
    expect(s.message).toBe('reloaded 7 nodes');
    // Remove `ui`: the path no longer exists.
    const without: GraphModel = { nodes: next.nodes.filter((n) => n.id !== 'ui'), edges: next.edges.filter((e) => e.from !== 'ui' && e.to !== 'ui') };
    s = run(s, { type: 'data', data: data(without) });
    expect(s.path!.result).toBe('none');
    // Remove the path start: the path is dropped.
    s = run(s, { type: 'data', data: data({ nodes: without.nodes.filter((n) => n.id !== 'web'), edges: [] }) });
    expect(s.path).toBeNull();
  });

  it('status refresh keeps focus, mode and selection intact', () => {
    let s = run(init(), { type: 'moveTo', index: 1 }, { type: 'focus' }, { type: 'move', delta: 1 });
    const before = s.focus!;
    s = run(s, { type: 'statuses', statuses: new Map([['core', { status: 'running' as const, reason: 'now up' }]]), loadedAt: 99 });
    expect(s.mode).toBe('focus');
    expect(s.focus).toEqual(before);
    expect(s.model.data.statuses.get('core')?.status).toBe('running');
    expect(s.model.data.loadedAt).toBe(99);
  });

  it('5000 nodes: build, filter, move and focus stay fast and only a viewport is exposed', () => {
    const graph = syntheticGraph(5000);
    const d = data(graph, syntheticStatuses(graph));
    let t = performance.now();
    let s = createExplorerState(d, 40);
    const buildMs = performance.now() - t;
    expect(s.rows).toHaveLength(5000);
    expect(windowOf(s.rows, s.offset, s.height)).toHaveLength(40);

    t = performance.now();
    for (let i = 0; i < 500; i++) s = explorerReducer(s, { type: 'move', delta: 1 });
    const moveMs = performance.now() - t;
    expect(s.cursor).toBe(500);

    t = performance.now();
    s = run(s, { type: 'startSearch' }, { type: 'typeSearch', text: 'g' }, { type: 'typeSearch', text: 'r' }, { type: 'typeSearch', text: 'o' });
    s = run(s, { type: 'typeSearch', text: 'u' }, { type: 'typeSearch', text: 'p' }, { type: 'typeSearch', text: '-' }, { type: 'typeSearch', text: '7' });
    const searchMs = performance.now() - t;
    expect(s.rows.length).toBeGreaterThan(50);
    expect(s.rows.every((id) => s.model.haystack.get(id)!.includes('group-7'))).toBe(true);

    t = performance.now();
    s = run(s, { type: 'endSearch', clear: true }, { type: 'moveTo', index: 4001 }, { type: 'focus' });
    const focusMs = performance.now() - t;
    expect(s.focus!.relations.length).toBeGreaterThan(0);
    t = performance.now();
    const counts = relationCounts(s.model, s.focus!.id);
    const countMs = performance.now() - t;
    expect(counts.transitiveUp).toBeGreaterThan(0);

    // Generous budgets (shared CI boxes): the point is "not quadratic / not full re-render".
    expect(buildMs).toBeLessThan(3000);
    expect(moveMs).toBeLessThan(1000);
    expect(searchMs).toBeLessThan(1500);
    expect(focusMs).toBeLessThan(1500);
    expect(countMs).toBeLessThan(500);
  });
});
