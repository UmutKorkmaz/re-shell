import { describe, expect, it } from 'vitest';
import {
  diffGraphs,
  reachableFrom,
  shortestDependencyPath,
  type GraphModel,
  type WorkspaceLiveStatus,
} from '@re-shell/contracts';
import type { WorkspaceGraph } from '../shared/feedSchemas';
import { buildGraphData } from './graphData';
import { DEFAULT_LAYOUT, computeLayout } from './layout';
import { buildFlow, createFlowCache, dimsEdges, hasFocus, displayFromData, displayFromDiff, edgeTypeFor, type ViewState } from './view';

const GRAPH: WorkspaceGraph = {
  apps: [{ name: 'web', path: 'apps/web', framework: 'react-ts', dependencies: ['ui', 'api'] }],
  services: [
    { name: 'ui', path: 'packages/ui', framework: null, dependencies: ['core'] },
    { name: 'api', path: 'services/api', framework: null, dependencies: ['core'] },
    { name: 'core', path: 'packages/core', framework: null, dependencies: [] },
    { name: 'lonely', path: 'packages/lonely', framework: null, dependencies: [] },
    { name: 'loop-a', path: 'packages/a', framework: null, dependencies: ['loop-b'] },
    { name: 'loop-b', path: 'packages/b', framework: null, dependencies: ['loop-a'] },
  ],
};

function setup(overrides: Partial<ViewState> = {}) {
  const data = buildGraphData(GRAPH);
  const display = displayFromData(data);
  const layout = computeLayout(display.index, DEFAULT_LAYOUT);
  const cache = createFlowCache();
  const view: ViewState = {
    matches: null,
    hide: false,
    selected: null,
    upstream: new Set(),
    downstream: new Set(),
    path: null,
    showCycles: false,
    statusOf: () => 'unknown',
    reasonOf: () => undefined,
    portOf: () => undefined,
    ...overrides,
  };
  const build = (v: ViewState = view) => buildFlow(display, layout, v, cache, () => () => undefined);
  return { data, display, layout, cache, view, build };
}

const node = (flow: ReturnType<typeof buildFlow>, id: string) => flow.nodes.find((n) => n.id === id)!;
const edge = (flow: ReturnType<typeof buildFlow>, from: string, to: string) => flow.edges.find((e) => e.id === `${from}->${to}`)!;

describe('buildFlow', () => {
  it('emits one node per workspace and only internal edges, with layout positions', () => {
    const { build, layout } = setup();
    const flow = build();
    expect(flow.nodes.map((n) => n.id).sort()).toEqual(['api', 'core', 'lonely', 'loop-a', 'loop-b', 'ui', 'web']);
    expect(flow.edges).toHaveLength(6);
    expect(node(flow, 'web').position).toEqual(layout.positions.get('web'));
    expect(node(flow, 'web').data).toMatchObject({ label: 'web', kind: 'app', framework: 'react-ts', status: 'unknown' });
    expect(node(flow, 'ui').data.kind).toBe('service');
  });

  it('colours nodes from the live status and carries the reason and port', () => {
    const statuses: Record<string, WorkspaceLiveStatus> = { web: 'running', api: 'unhealthy', ui: 'stopped' };
    const { build } = setup({
      statusOf: (id) => statuses[id] ?? 'unknown',
      reasonOf: (id) => (id === 'api' ? 'health URL did not answer' : undefined),
      portOf: (id) => (id === 'web' ? 3000 : undefined),
    });
    const flow = build();
    expect(node(flow, 'web').data).toMatchObject({ status: 'running', port: 3000 });
    expect(node(flow, 'api').data).toMatchObject({ status: 'unhealthy', statusReason: 'health URL did not answer' });
    expect(node(flow, 'ui').data.status).toBe('stopped');
    expect(node(flow, 'core').data.status).toBe('unknown');
  });

  it('highlights upstream and downstream of the selected node and dims the rest', () => {
    const { data, build } = setup();
    const upstream = reachableFrom(data.index, 'ui', 'dependencies');
    const downstream = reachableFrom(data.index, 'ui', 'dependents');
    const flow = build({
      matches: null,
      hide: false,
      selected: 'ui',
      upstream,
      downstream,
      path: null,
      showCycles: false,
      statusOf: () => 'unknown',
      reasonOf: () => undefined,
      portOf: () => undefined,
    });
    expect(node(flow, 'ui').data.highlight).toBe('selected');
    expect(node(flow, 'core').data.highlight).toBe('upstream');
    expect(node(flow, 'web').data.highlight).toBe('downstream');
    // Dimming is a container rule (gx-focus): nodes outside the focus are simply not highlighted.
    expect(hasFocus({ selected: 'ui', path: null })).toBe(true);
    expect(node(flow, 'api').data.highlight).toBe('none');
    expect(node(flow, 'lonely').data.highlight).toBe('none');
    expect(edge(flow, 'ui', 'core').className).toBe('ge-up');
    expect(edge(flow, 'web', 'ui').className).toBe('ge-down');
    // Unemphasized edges carry no class: the container dims them (dimsEdges).
    expect(edge(flow, 'api', 'core').className).toBeUndefined();
    expect(edge(flow, 'web', 'api').className).toBeUndefined();
    expect(dimsEdges({ selected: 'ui', path: null, matches: null })).toBe(true);
  });

  it('highlights the shortest path and its edges over the up/downstream colouring', () => {
    const { data, build } = setup();
    const path = shortestDependencyPath(data.index, 'web', 'core')!;
    const flow = build({
      matches: null,
      hide: false,
      selected: 'web',
      upstream: reachableFrom(data.index, 'web', 'dependencies'),
      downstream: new Set(),
      path,
      showCycles: false,
      statusOf: () => 'unknown',
      reasonOf: () => undefined,
      portOf: () => undefined,
    });
    expect(path.path).toHaveLength(3);
    expect(node(flow, 'web').data.highlight).toBe('path-end');
    expect(node(flow, 'core').data.highlight).toBe('path-end');
    const mid = path.path[1];
    expect(node(flow, mid).data.highlight).toBe('path');
    const classes = flow.edges.filter((e) => e.className === 'ge-path').map((e) => e.id).sort();
    expect(classes).toEqual([`web->${mid}`, `${mid}->core`].sort());
    const other = mid === 'ui' ? 'api' : 'ui';
    expect(node(flow, other).data.highlight).toBe('none'); // up/downstream steps aside while a path is shown
  });

  it('marks cycle nodes and edges only when cycle highlighting is on', () => {
    const { build, view } = setup();
    expect(node(build({ ...view, showCycles: false }), 'loop-a').data.cycle).toBe(false);
    const on = build({ ...view, showCycles: true });
    expect(node(on, 'loop-a').data.cycle).toBe(true);
    expect(node(on, 'loop-b').data.cycle).toBe(true);
    expect(node(on, 'core').data.cycle).toBe(false);
    expect(edge(on, 'loop-a', 'loop-b').className).toBe('ge-cycle');
    expect(edge(on, 'loop-b', 'loop-a').className).toBe('ge-cycle');
    expect(edge(on, 'ui', 'core').className).toBeUndefined();
  });

  it('dims non-matching nodes, or hides them (and their edges) in hide mode', () => {
    const matches = new Set(['web', 'ui']);
    const { build, view } = setup();
    const dim = build({ ...view, matches });
    // matches are flagged; everything else stays untouched and is dimmed by the container rule
    expect(node(dim, 'web').data.match).toBe(true);
    expect(node(dim, 'ui').data.match).toBe(true);
    expect(node(dim, 'core').data.match).toBeUndefined();
    expect(node(dim, 'core').hidden).toBeUndefined();
    expect(edge(dim, 'web', 'ui').className).toBe('ge-match'); // both ends match: stays emphasized
    expect(edge(dim, 'ui', 'core').className).toBeUndefined(); // dimmed by the container rule
    expect(dimsEdges({ selected: null, path: null, matches })).toBe(true);
    expect(dimsEdges({ selected: null, path: null, matches: null })).toBe(false);
    const hide = build({ ...view, matches, hide: true });
    expect(node(hide, 'core').hidden).toBe(true);
    expect(node(hide, 'web').hidden).toBeUndefined();
    expect(edge(hide, 'ui', 'core').hidden).toBe(true);
    expect(edge(hide, 'web', 'ui').hidden).toBeUndefined();
  });

  it('reuses node data objects while a node is visually unchanged (memoised cards skip re-render)', () => {
    const { build, view } = setup();
    const first = build();
    const second = build({ ...view, selected: 'core', upstream: new Set(), downstream: reachableFrom(buildGraphData(GRAPH).index, 'core', 'dependents') });
    expect(node(second, 'core').data.highlight).toBe('selected'); // restyled -> new object
    expect(node(second, 'core').data).not.toBe(node(first, 'core').data);
    // a node outside the focus is not restyled at all (the container dims it)
    expect(node(second, 'lonely').data).toBe(node(first, 'lonely').data);
    const third = build({ ...view, selected: 'core', upstream: new Set(), downstream: reachableFrom(buildGraphData(GRAPH).index, 'core', 'dependents') });
    for (const n of third.nodes) expect(n.data).toBe(node(second, n.id).data);
    // unchanged between the first two builds -> identical object
    const again = build();
    expect(node(again, 'core').data.highlight).toBe('none');
  });

  it('keeps the very same node and edge OBJECTS when nothing about them changed, so React Flow skips them', () => {
    const { build, view } = setup();
    const first = build();
    const second = build({ ...view, matches: new Set(['web', 'ui']) });
    // Only the matching nodes are restyled; non-matching ones keep the identical object.
    expect(node(second, 'web')).not.toBe(node(first, 'web'));
    expect(node(second, 'ui')).not.toBe(node(first, 'ui'));
    expect(node(second, 'core')).toBe(node(first, 'core'));
    expect(node(second, 'lonely')).toBe(node(first, 'lonely'));
    // Dimming is a container rule, so an edge that merely gets dimmed is not touched at all...
    expect(edge(second, 'ui', 'core')).toBe(edge(first, 'ui', 'core'));
    // ...and only the edge that became emphasized is a new object.
    expect(edge(second, 'web', 'ui')).not.toBe(edge(first, 'web', 'ui'));
    // A third identical build changes nothing at all.
    const third = build({ ...view, matches: new Set(['web', 'ui']) });
    for (const n of third.nodes) expect(n).toBe(node(second, n.id));
    for (const e of third.edges) expect(e).toBe(edge(second, e.source, e.target));
  });

  it('picks cheaper edge types and drops arrowheads as the graph grows', () => {
    expect(edgeTypeFor(10)).toBe('smoothstep');
    expect(edgeTypeFor(300)).toBe('default');
    expect(edgeTypeFor(2000)).toBe('straight');
    const { build } = setup();
    expect(build().edges[0].markerEnd).toBeDefined();
  });
});

describe('diff display', () => {
  const base: GraphModel = {
    nodes: [{ id: 'web', type: 'app' }, { id: 'ui', type: 'lib' }, { id: 'old', type: 'package' }, { id: 'core', type: 'package' }],
    edges: [
      { from: 'web', to: 'ui', type: 'dependency' },
      { from: 'old', to: 'core', type: 'dependency' },
    ],
  };
  const head: GraphModel = {
    nodes: [{ id: 'web', type: 'app', framework: 'react-ts' }, { id: 'ui', type: 'lib' }, { id: 'new', type: 'package' }, { id: 'core', type: 'package' }],
    edges: [
      { from: 'web', to: 'ui', type: 'dependency' },
      { from: 'new', to: 'core', type: 'dependency' },
      { from: 'web', to: 'new', type: 'devDependency' },
    ],
  };

  it('colours added / removed / changed nodes and edges, and keeps context nodes neutral', () => {
    const display = displayFromDiff(diffGraphs(base, head));
    const layout = computeLayout(display.index, DEFAULT_LAYOUT);
    const flow = buildFlow(
      display,
      layout,
      {
        matches: null,
        hide: false,
        selected: null,
        upstream: new Set(),
        downstream: new Set(),
        path: null,
        showCycles: false,
        statusOf: () => 'unknown',
        reasonOf: () => undefined,
        portOf: () => undefined,
      },
      createFlowCache(),
      () => () => undefined
    );
    const diffOf = (id: string) => flow.nodes.find((n) => n.id === id)?.data.diff;
    expect(diffOf('new')).toBe('added');
    expect(diffOf('old')).toBe('removed');
    expect(diffOf('web')).toBe('changed');
    expect(diffOf('core')).toBe('unchanged');
    expect(flow.nodes.find((n) => n.id === 'ui')).toBeUndefined(); // untouched, not in the change-set
    expect(flow.edges.find((e) => e.id === 'new->core')?.className).toBe('ge-added');
    expect(flow.edges.find((e) => e.id === 'web->new')?.className).toBe('ge-added');
    expect(flow.edges.find((e) => e.id === 'old->core')?.className).toBe('ge-removed');
  });
});
