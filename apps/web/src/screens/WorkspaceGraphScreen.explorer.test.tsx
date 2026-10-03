import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentType } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { diffGraphs, type WorkspaceGraphDiff, type WorkspaceStatusReport } from '@re-shell/contracts';
import { WorkspaceGraphScreen } from './WorkspaceGraphScreen';
import type { GraphNodeData } from './graph/GraphNodeCard';
import type { WorkspaceGraph } from './shared/feedSchemas';

/**
 * Screen-level behaviour of the graph explorer with the hub and React Flow
 * mocked: filters + URL state, live status colouring and polling, dependency
 * paths, cycles, graph diff and exports. React Flow itself is replaced by a
 * surface that renders the REAL node cards and exposes edges, because jsdom has
 * no layout engine; the 2000-node render is covered by the Playwright spec.
 */

const hub = vi.fn();
vi.mock('@re-shell/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@re-shell/ui')>();
  return { ...actual, useHubQuery: (...args: unknown[]) => hub(...args) };
});

const toPng = vi.fn();
vi.mock('html-to-image', () => ({ toPng: (...a: unknown[]) => toPng(...a), toSvg: vi.fn() }));
vi.mock('jspdf', () => ({
  jsPDF: class {
    addImage() {}
    output() {
      return new Blob(['%PDF-fake'], { type: 'application/pdf' });
    }
  },
}));

vi.mock('@xyflow/react', async () => {
  return {
    ReactFlow: ({
      nodes,
      edges,
      nodeTypes,
      onPaneClick,
      className,
    }: {
      nodes: Node<GraphNodeData>[];
      edges: Edge[];
      nodeTypes: Record<string, ComponentType<Record<string, unknown>>>;
      onPaneClick?: () => void;
      className?: string;
    }) => {
      const Card = nodeTypes.topology;
      return (
        <div
          className={`react-flow ${className ?? ''}`}
          data-testid="rf"
          ref={(el) => {
            if (el) {
              Object.defineProperty(el, 'clientWidth', { value: 900, configurable: true });
              Object.defineProperty(el, 'clientHeight', { value: 500, configurable: true });
            }
          }}
        >
          <button type="button" data-testid="rf-pane" onClick={onPaneClick}>
            pane
          </button>
          {nodes
            .filter((n) => !n.hidden)
            .map((n) => (
              <Card key={n.id} id={n.id} data={n.data} selected={n.selected ?? false} />
            ))}
          {edges.map((e) => (
            <span key={e.id} data-testid={`edge:${e.id}`} data-class={e.className ?? ''} data-hidden={e.hidden ? 'true' : undefined} />
          ))}
        </div>
      );
    },
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
    Handle: () => null,
    useStore: (selector: (state: { transform: [number, number, number] }) => unknown) => selector({ transform: [0, 0, 1] }),
    Position: { Top: 'top', Bottom: 'bottom' },
  };
});

const GRAPH: WorkspaceGraph = {
  apps: [
    { name: '@acme/web', path: 'apps/web', framework: 'react-ts', dependencies: ['@acme/ui', '@acme/api'], type: 'app', language: 'typescript' },
    { name: '@acme/docs', path: 'apps/docs', framework: 'svelte', dependencies: ['@acme/ui'], type: 'app', language: 'javascript' },
  ],
  services: [
    { name: '@acme/ui', path: 'packages/ui', framework: 'react-ts', dependencies: ['@acme/core'], type: 'package', language: 'typescript' },
    { name: '@acme/api', path: 'services/api', framework: null, dependencies: ['@acme/core'], type: 'package', language: 'go' },
    { name: '@acme/core', path: 'packages/core', framework: null, dependencies: [], type: 'lib', language: 'typescript' },
    { name: '@acme/island', path: 'packages/island', framework: null, dependencies: [], type: 'lib', language: 'javascript' },
  ],
};

const CYCLIC: WorkspaceGraph = {
  apps: [],
  services: [
    { name: 'a', path: 'p/a', framework: null, dependencies: ['b'] },
    { name: 'b', path: 'p/b', framework: null, dependencies: ['c'] },
    { name: 'c', path: 'p/c', framework: null, dependencies: ['a'] },
    { name: 'd', path: 'p/d', framework: null, dependencies: ['a'] },
  ],
};

function statusReport(over: Partial<WorkspaceStatusReport> = {}): WorkspaceStatusReport {
  const nodes: WorkspaceStatusReport['nodes'] = [
    { name: '@acme/web', path: 'apps/web', status: 'running', reason: 'process 41 is alive, port 3000 open', checks: [{ name: 'dev', status: 'running', reason: 'process 41 is alive, port 3000 open', source: 'process', pid: 41, port: 3000 }] },
    { name: '@acme/api', path: 'services/api', status: 'unhealthy', reason: 'port 4000 is open but health URL did not answer', checks: [] },
    { name: '@acme/docs', path: 'apps/docs', status: 'stopped', reason: 'nothing accepts connections on port 4321', checks: [] },
  ];
  return { root: '/ws', checkedAt: '2026-01-02T03:04:05.000Z', nodes, summary: { running: 1, stopped: 1, unhealthy: 1, unknown: 3 }, ...over };
}

interface HubWorld {
  graph: WorkspaceGraph;
  status: unknown;
  diff: unknown;
}
let world: HubWorld;

function install(over: Partial<HubWorld> = {}): void {
  world = { graph: GRAPH, status: { ok: true, data: statusReport(), warnings: [] }, diff: undefined, ...over };
  hub.mockImplementation((commandId: string, _params: unknown, options?: { query?: { enabled?: boolean } }) => {
    const base = { isLoading: false, isFetching: false, error: null, refetch: vi.fn() };
    if (commandId === 'workspace.graph') return { ...base, data: { ok: true, data: world.graph, warnings: [] } };
    if (commandId === 'workspace.status') return { ...base, data: world.status };
    if (commandId === 'workspace.graph.diff') {
      const enabled = options?.query?.enabled !== false;
      return { ...base, data: enabled ? world.diff : undefined };
    }
    return { ...base, data: undefined };
  });
}

const cards = () => screen.getAllByTestId('graph-node');
const card = (name: string) => cards().find((c) => c.getAttribute('data-node-id') === name)!;
const edgeClass = (id: string) => screen.getByTestId(`edge:${id}`).getAttribute('data-class');
const hubCalls = (commandId: string) => hub.mock.calls.filter((c) => c[0] === commandId);

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  install();
});

afterEach(() => {
  hub.mockReset();
  toPng.mockReset();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('search and facet filters (URL state)', () => {
  it('dims non-matching nodes as you type, updates the match count and writes ?q= to the URL', () => {
    render(<WorkspaceGraphScreen />);
    expect(screen.getByTestId('graph-match-count')).toHaveAttribute('data-matches', '6');
    fireEvent.change(screen.getByTestId('graph-search'), { target: { value: 'apps/' } });
    expect(window.location.search).toContain('g_q=apps%2F');
    expect(screen.getByTestId('graph-match-count')).toHaveAttribute('data-matches', '2');
    // matches are flagged; everything else is dimmed by the `gx-filtering` container rule
    expect(screen.getByTestId('rf')).toHaveClass('gx-filtering');
    expect(card('@acme/web')).toHaveAttribute('data-match', 'true');
    expect(card('@acme/docs')).toHaveAttribute('data-match', 'true');
    expect(card('@acme/core')).not.toHaveAttribute('data-match');
    // edges are dimmed by one container rule; only edges between two matches stay emphasized
    expect(screen.getByTestId('rf')).toHaveClass('gx-dim-edges');
    expect(edgeClass('@acme/ui->@acme/core')).toBe('');
    expect(edgeClass('@acme/web->@acme/ui')).toBe('');
    fireEvent.change(screen.getByTestId('graph-search'), { target: { value: 'ui' } });
    fireEvent.change(screen.getByTestId('graph-search'), { target: { value: 'acme' } });
    expect(edgeClass('@acme/web->@acme/ui')).toBe('ge-match');
    fireEvent.change(screen.getByTestId('graph-search'), { target: { value: '' } });
    expect(screen.getByTestId('rf')).not.toHaveClass('gx-dim-edges');
  });

  it('filters by language, framework, type and status and combines facets', () => {
    render(<WorkspaceGraphScreen />);
    fireEvent.change(screen.getByTestId('graph-filter-language'), { target: { value: 'typescript' } });
    expect(screen.getByTestId('graph-match-count')).toHaveAttribute('data-matches', '3');
    fireEvent.change(screen.getByTestId('graph-filter-type'), { target: { value: 'app' } });
    expect(screen.getByTestId('graph-match-count')).toHaveAttribute('data-matches', '1');
    fireEvent.change(screen.getByTestId('graph-filter-framework'), { target: { value: 'react-ts' } });
    fireEvent.change(screen.getByTestId('graph-filter-status'), { target: { value: 'running' } });
    expect(screen.getByTestId('graph-match-count')).toHaveAttribute('data-matches', '1');
    expect(window.location.search).toContain('g_language=typescript');
    expect(window.location.search).toContain('g_status=running');
    fireEvent.click(screen.getByTestId('graph-clear-filters'));
    expect(window.location.search).toBe('');
    expect(screen.getByTestId('graph-match-count')).toHaveAttribute('data-matches', '6');
  });

  it('offers only facet values that exist, with live statuses in severity order', () => {
    render(<WorkspaceGraphScreen />);
    const values = (id: string) => within(screen.getByTestId(id)).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    expect(values('graph-filter-language')).toEqual(['', 'go', 'javascript', 'typescript']);
    expect(values('graph-filter-type')).toEqual(['', 'app', 'lib', 'package']);
    expect(values('graph-filter-status')).toEqual(['', 'running', 'unhealthy', 'stopped', 'unknown']);
  });

  it('hides non-matching nodes and their edges when "Hide non-matching" is on', () => {
    render(<WorkspaceGraphScreen />);
    fireEvent.change(screen.getByTestId('graph-filter-language'), { target: { value: 'go' } });
    fireEvent.click(screen.getByTestId('graph-hide-nonmatching'));
    expect(window.location.search).toContain('g_hide=1');
    expect(cards().map((c) => c.getAttribute('data-node-id'))).toEqual(['@acme/api']);
    expect(screen.getByTestId('edge:@acme/api->@acme/core')).toHaveAttribute('data-hidden', 'true');
  });

  it('restores filters from the URL on load (shareable views)', () => {
    window.history.replaceState(null, '', '/?g_language=typescript&g_q=ui');
    render(<WorkspaceGraphScreen />);
    expect(screen.getByTestId('graph-search')).toHaveValue('ui');
    expect(screen.getByTestId('graph-filter-language')).toHaveValue('typescript');
    expect(screen.getByTestId('graph-match-count')).toHaveAttribute('data-matches', '1');
  });
});

describe('live status', () => {
  it('colours every node from workspace.status instead of a hardcoded "unknown"', () => {
    render(<WorkspaceGraphScreen />);
    expect(card('@acme/web')).toHaveAttribute('data-status', 'running');
    expect(card('@acme/api')).toHaveAttribute('data-status', 'unhealthy');
    expect(card('@acme/docs')).toHaveAttribute('data-status', 'stopped');
    expect(card('@acme/core')).toHaveAttribute('data-status', 'unknown'); // not reported => honestly unknown
    expect(card('@acme/web').getAttribute('title')).toContain('process 41 is alive');
    const summary = screen.getByTestId('graph-status-summary');
    expect(summary).toHaveTextContent('1 running · 1 unhealthy · 1 stopped · 3 unknown');
    expect(summary).toHaveAttribute('data-checked-at', '2026-01-02T03:04:05.000Z');
  });

  it('polls on a configurable interval and Manual turns polling off', () => {
    render(<WorkspaceGraphScreen />);
    const intervalOf = (): unknown => {
      const calls = hubCalls('workspace.status');
      return (calls[calls.length - 1][2] as { query: { refetchInterval: unknown } }).query.refetchInterval;
    };
    expect(intervalOf()).toBe(5000);
    fireEvent.change(screen.getByTestId('graph-poll'), { target: { value: '15' } });
    expect(window.location.search).toContain('g_poll=15');
    expect(intervalOf()).toBe(15000);
    fireEvent.change(screen.getByTestId('graph-poll'), { target: { value: '0' } });
    expect(intervalOf()).toBe(false);
  });

  it('shows why status is unavailable and leaves nodes unknown (no stale colours)', () => {
    install({ status: { ok: false, error: { code: 'WORKSPACE_STATUS_ERROR', message: 'boom' }, warnings: [] } });
    render(<WorkspaceGraphScreen />);
    expect(screen.getByTestId('graph-status-error')).toHaveTextContent('WORKSPACE_STATUS_ERROR: boom');
    for (const c of cards()) expect(c).toHaveAttribute('data-status', 'unknown');
  });

  it('refresh button asks the hub again', () => {
    const refetch = vi.fn();
    hub.mockImplementation((commandId: string) => ({
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: commandId === 'workspace.status' ? refetch : vi.fn(),
      data: commandId === 'workspace.graph' ? { ok: true, data: GRAPH, warnings: [] } : commandId === 'workspace.status' ? world.status : undefined,
    }));
    render(<WorkspaceGraphScreen />);
    fireEvent.click(screen.getByTestId('graph-refresh-status'));
    expect(refetch).toHaveBeenCalled();
  });
});

describe('dependency paths', () => {
  it('selecting a node highlights its upstream and downstream sets and shows the counts', () => {
    render(<WorkspaceGraphScreen />);
    fireEvent.click(card('@acme/ui'));
    expect(window.location.search).toContain('g_sel=%40acme%2Fui');
    expect(screen.getByTestId('graph-upstream-count')).toHaveTextContent('1');
    expect(screen.getByTestId('graph-downstream-count')).toHaveTextContent('2');
    expect(card('@acme/ui')).toHaveAttribute('data-highlight', 'selected');
    expect(card('@acme/core')).toHaveAttribute('data-highlight', 'upstream');
    expect(card('@acme/web')).toHaveAttribute('data-highlight', 'downstream');
    expect(card('@acme/docs')).toHaveAttribute('data-highlight', 'downstream');
    // everything outside the focus has no highlight and is dimmed by the container's gx-focus rule
    expect(screen.getByTestId('rf')).toHaveClass('gx-focus');
    expect(card('@acme/api')).toHaveAttribute('data-highlight', 'none');
    expect(card('@acme/island')).toHaveAttribute('data-highlight', 'none');
    expect(edgeClass('@acme/ui->@acme/core')).toBe('ge-up');
    expect(edgeClass('@acme/web->@acme/ui')).toBe('ge-down');
    expect(edgeClass('@acme/api->@acme/core')).toBe('');
    expect(screen.getByTestId('rf')).toHaveClass('gx-dim-edges');
    // details panel opens for the selection and is clickable through the graph
    const panel = screen.getByTestId('graph-node-panel');
    expect(within(panel).getByText('packages/ui')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: '@acme/core' }));
    expect(screen.getByTestId('graph-selection')).toHaveAttribute('data-selected', '@acme/core');
    // clicking the selected node again, or the pane, clears the selection
    fireEvent.click(card('@acme/core'));
    expect(screen.queryByTestId('graph-selection')).toBeNull();
    fireEvent.click(card('@acme/web'));
    fireEvent.click(screen.getByTestId('rf-pane'));
    expect(screen.queryByTestId('graph-selection')).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('shift-click picks a second node and highlights the shortest path', () => {
    render(<WorkspaceGraphScreen />);
    fireEvent.click(card('@acme/web'));
    fireEvent.click(card('@acme/core'), { shiftKey: true });
    const path = screen.getByTestId('graph-path');
    expect(path).toHaveAttribute('data-hops', '2');
    expect(path.textContent).toMatch(/@acme\/web.*→.*@acme\/(ui|api).*→.*@acme\/core/);
    expect(card('@acme/web')).toHaveAttribute('data-highlight', 'path-end');
    expect(card('@acme/core')).toHaveAttribute('data-highlight', 'path-end');
    expect(card('@acme/island')).toHaveAttribute('data-highlight', 'none');
    expect(screen.getByTestId('rf')).toHaveClass('gx-focus');
    expect(cards().filter((c) => c.getAttribute('data-highlight') === 'path')).toHaveLength(1);
    expect(document.querySelectorAll('[data-class="ge-path"]')).toHaveLength(2);
    expect(window.location.search).toContain('g_to=%40acme%2Fcore');
  });

  it('"Pick on canvas" arms the next click as the path target; unrelated nodes report no path', () => {
    render(<WorkspaceGraphScreen />);
    fireEvent.click(card('@acme/docs'));
    fireEvent.click(screen.getByTestId('graph-pick-target'));
    expect(screen.getByTestId('graph-pick-target')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(card('@acme/api'));
    expect(screen.getByTestId('graph-no-path')).toHaveTextContent('No dependency path between @acme/docs and @acme/api');
    expect(screen.getByTestId('graph-pick-target')).toHaveAttribute('aria-pressed', 'false');
  });

  it('finds paths in the reverse direction too, and from the typed target field', () => {
    render(<WorkspaceGraphScreen />);
    fireEvent.click(card('@acme/core'));
    fireEvent.change(screen.getByTestId('graph-path-target'), { target: { value: '@acme/web' } });
    expect(screen.getByTestId('graph-path').textContent).toContain('reverse direction');
    expect(screen.getByTestId('graph-path')).toHaveAttribute('data-hops', '2');
  });
});

describe('cycles', () => {
  it('shows a cycle banner, marks cycle nodes and edges, and the highlight can be switched off', () => {
    install({ graph: CYCLIC });
    render(<WorkspaceGraphScreen />);
    const banner = screen.getByTestId('graph-cycles');
    expect(banner).toHaveAttribute('data-cycle-count', '1');
    expect(banner).toHaveTextContent('1 dependency cycle across 3 nodes');
    for (const n of ['a', 'b', 'c']) expect(card(n).className).toContain('gn-cycle');
    expect(card('d').className).not.toContain('gn-cycle');
    expect(edgeClass('a->b')).toBe('ge-cycle');
    expect(edgeClass('d->a')).toBe('');
    fireEvent.click(screen.getByTestId('graph-show-cycles'));
    expect(card('a').className).not.toContain('gn-cycle');
    expect(edgeClass('a->b')).toBe('');
  });

  it('shows no cycle banner for an acyclic graph', () => {
    render(<WorkspaceGraphScreen />);
    expect(screen.queryByTestId('graph-cycles')).toBeNull();
  });
});

describe('graph diff', () => {
  const base = { nodes: [{ id: 'web', type: 'app' }, { id: 'ui', type: 'lib' }, { id: 'old', type: 'package' }, { id: 'core', type: 'package' }], edges: [{ from: 'web', to: 'ui', type: 'dependency' as const }, { from: 'old', to: 'core', type: 'dependency' as const }] };
  const head = { nodes: [{ id: 'web', type: 'app', framework: 'react-ts' }, { id: 'ui', type: 'lib' }, { id: 'new', type: 'package' }, { id: 'core', type: 'package' }], edges: [{ from: 'web', to: 'ui', type: 'dependency' as const }, { from: 'new', to: 'core', type: 'dependency' as const }] };
  const diffPayload: WorkspaceGraphDiff = {
    ...diffGraphs(base, head),
    base: { ref: 'main', kind: 'git', commit: 'a'.repeat(40), nodeCount: 4, edgeCount: 2 },
    head: { ref: 'working-tree', kind: 'working-tree', commit: null, nodeCount: 4, edgeCount: 2 },
  };

  it('sends the base/head to workspace.graph.diff, then draws added/removed/changed with a legend and counts', async () => {
    install({ diff: { ok: true, data: diffPayload, warnings: [] } });
    render(<WorkspaceGraphScreen />);
    expect(hubCalls('workspace.graph.diff').every((c) => (c[2] as { query: { enabled: boolean } }).query.enabled === false)).toBe(true);

    fireEvent.click(screen.getByTestId('graph-diff-toggle'));
    fireEvent.change(screen.getByTestId('graph-diff-base'), { target: { value: 'main' } });
    fireEvent.click(screen.getByTestId('graph-diff-run'));
    expect(window.location.search).toContain('g_diffBase=main');
    const last = hubCalls('workspace.graph.diff').pop()!;
    expect(last[1]).toEqual({ base: 'main' });
    expect((last[2] as { query: { enabled: boolean } }).query.enabled).toBe(true);

    await waitFor(() => expect(screen.getByTestId('graph-canvas')).toHaveAttribute('data-mode', 'diff'));
    const byDiff = (d: string) => cards().filter((c) => c.getAttribute('data-diff') === d).map((c) => c.getAttribute('data-node-id'));
    expect(byDiff('added')).toEqual(['new']);
    expect(byDiff('removed')).toEqual(['old']);
    expect(byDiff('changed')).toEqual(['web']);
    expect(byDiff('unchanged')).toEqual(['core']);
    expect(edgeClass('new->core')).toBe('ge-added');
    expect(edgeClass('old->core')).toBe('ge-removed');
    expect(screen.getByTestId('graph-diff-legend')).toHaveTextContent('AddedRemovedChanged');
    expect(screen.getByTestId('graph-diff-summary').textContent?.replace(/\s+/g, ' ')).toContain('nodes +1 −1 ~1');
    expect(screen.getByTestId('graph-diff-list')).toHaveTextContent('+ node new');
    expect(screen.getByTestId('graph-legend')).toHaveTextContent('unchanged context');
  });

  it('head ref is forwarded when given; closing the diff restores the live graph', async () => {
    install({ diff: { ok: true, data: diffPayload, warnings: [] } });
    window.history.replaceState(null, '', '/?g_diffBase=main&g_diffHead=feature%2Fx');
    render(<WorkspaceGraphScreen />);
    expect(hubCalls('workspace.graph.diff').pop()![1]).toEqual({ base: 'main', head: 'feature/x' });
    fireEvent.click(screen.getByTestId('graph-diff-close'));
    expect(window.location.search).toBe('');
    await waitFor(() => expect(screen.getByTestId('graph-canvas')).toHaveAttribute('data-mode', 'live'));
    expect(cards()).toHaveLength(6);
  });

  it('surfaces a rejected ref instead of an empty diff', () => {
    install({ diff: { ok: false, error: { code: 'GRAPH_DIFF_INVALID_REF', message: '"nope" is not a known git ref' }, warnings: [] } });
    window.history.replaceState(null, '', '/?g_diffBase=nope');
    render(<WorkspaceGraphScreen />);
    expect(screen.getByTestId('graph-diff-error')).toHaveTextContent('GRAPH_DIFF_INVALID_REF');
    expect(screen.getByTestId('graph-canvas')).toHaveAttribute('data-mode', 'live');
  });

  it('explains an HTTP 400 from the hub (a ref that failed allow-list validation) instead of "SSE error: 400"', () => {
    install();
    const base = hub.getMockImplementation()!;
    hub.mockImplementation((commandId: string, params: unknown, options?: { query?: { enabled?: boolean } }) =>
      commandId === 'workspace.graph.diff' && options?.query?.enabled
        ? { isLoading: false, isFetching: false, refetch: vi.fn(), data: undefined, error: new Error('SSE error: 400') }
        : base(commandId, params, options)
    );
    window.history.replaceState(null, '', '/?g_diffBase=--upload-pack%3Devil');
    render(<WorkspaceGraphScreen />);
    expect(screen.getByTestId('graph-diff-error')).toHaveTextContent('The hub rejected these refs (HTTP 400)');
    expect(screen.getByTestId('graph-canvas')).toHaveAttribute('data-mode', 'live');
  });

  it('says so when the graphs are identical', () => {
    const same: WorkspaceGraphDiff = { ...diffGraphs(base, base), base: diffPayload.base, head: diffPayload.head };
    install({ diff: { ok: true, data: same, warnings: [] } });
    window.history.replaceState(null, '', '/?g_diffBase=main');
    render(<WorkspaceGraphScreen />);
    expect(screen.getByTestId('graph-diff-empty')).toHaveTextContent('No differences');
  });
});

describe('exports', () => {
  let clicks: Array<{ download: string; href: string }>;
  beforeEach(() => {
    clicks = [];
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:graph'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ download: this.download, href: this.href });
    });
    toPng.mockResolvedValue(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    );
  });

  async function exportAs(format: string): Promise<void> {
    fireEvent.click(screen.getByTestId('graph-export-menu'));
    await act(async () => {
      fireEvent.click(screen.getByTestId(`graph-export-${format}`));
    });
    await waitFor(() => expect(screen.getByTestId('graph-export-status')).toBeInTheDocument());
  }

  it.each([
    ['mermaid', /\.mmd$/],
    ['d3', /d3.*\.json$/],
    ['json', /\.json$/],
    ['png', /\.png$/],
    ['pdf', /\.pdf$/],
  ])('%s: triggers a browser download of a non-empty file', async (format, pattern) => {
    render(<WorkspaceGraphScreen />);
    await exportAs(format);
    expect(clicks).toHaveLength(1);
    expect(clicks[0].download).toMatch(pattern);
    expect(clicks[0].href).toBe('blob:graph');
    const status = screen.getByTestId('graph-export-status');
    expect(status).toHaveAttribute('data-ok', 'true');
    expect(status.textContent).toMatch(/Downloaded workspace-graph-.* \(\d/);
  });

  it('reports a failed image export instead of downloading nothing', async () => {
    toPng.mockRejectedValue(new Error('canvas is tainted'));
    render(<WorkspaceGraphScreen />);
    await exportAs('png');
    expect(clicks).toHaveLength(0);
    expect(screen.getByTestId('graph-export-status')).toHaveAttribute('data-ok', 'false');
    expect(screen.getByTestId('graph-export-status')).toHaveTextContent('Export failed: canvas is tainted');
  });
});
