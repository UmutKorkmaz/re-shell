import { beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as React from 'react';
import { render } from 'ink-testing-library';
import type { GraphModel } from '@re-shell/contracts';
import { GraphExplorer, loadExplorerData, loadExplorerRuntime, loadStatusMap } from '../../src/commands/graph-explore';
import { watchWorkspaceChanges, type WorkspaceChangeKind } from '../../src/utils/graph-explorer-watch';
import type { ExplorerData, ExplorerStatus } from '../../src/utils/graph-explorer-state';
import { syntheticGraph, syntheticStatuses } from '../utils/synthetic-graph';

/**
 * Drives the real ink component with keystrokes through ink-testing-library's
 * stdin (ink-testing-library is already a CLI devDependency).
 */

const KEY = {
  down: '\u001B[B',
  up: '\u001B[A',
  enter: '\r',
  esc: '\u001B',
  pageDown: '\u001B[6~',
};

const N = (id: string, type = 'package', extra: Record<string, unknown> = {}) => ({ id, type, ...extra });
const E = (from: string, to: string) => ({ from, to, type: 'dependency' as const });

const SMALL: GraphModel = {
  nodes: [
    N('web', 'app', { framework: 'react-ts', language: 'typescript', path: 'apps/web' }),
    N('api', 'app', { language: 'go', path: 'apps/api' }),
    N('ui', 'lib', { framework: 'react-ts', language: 'typescript', path: 'packages/ui' }),
    N('core', 'package', { language: 'typescript', path: 'packages/core' }),
    N('loop-a', 'package', { path: 'packages/loop-a' }),
    N('loop-b', 'package', { path: 'packages/loop-b' }),
  ],
  edges: [E('web', 'ui'), E('ui', 'core'), E('api', 'core'), E('loop-a', 'loop-b'), E('loop-b', 'loop-a')],
};

const STATUSES = new Map<string, ExplorerStatus>([
  ['web', { status: 'running', reason: 'process 1 is alive' }],
  ['api', { status: 'unhealthy', reason: 'health URL did not answer' }],
]);

function data(graph: GraphModel, statuses: ReadonlyMap<string, ExplorerStatus> = STATUSES): ExplorerData {
  return { graph, statuses, loadedAt: Date.now() };
}

async function until(get: () => string | undefined, pred: (f: string) => boolean, timeoutMs = 4000): Promise<string> {
  const start = Date.now();
  let frame = get() ?? '';
  while (!pred(frame)) {
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for frame; last frame:\n${frame}`);
    await new Promise((r) => setTimeout(r, 15));
    frame = get() ?? '';
  }
  return frame;
}

/** True when `name` is the selected (▶) row; rows read `▶ <status glyph> <name>`. */
const isSel = (frame: string, name: string): boolean => new RegExp(`▶ \\S ${name}(\\s|$)`, 'm').test(frame);

const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));

describe('GraphExplorer (ink)', () => {
  beforeAll(async () => {
    await loadExplorerRuntime();
  });

  const mount = (props: Partial<React.ComponentProps<typeof GraphExplorer>> = {}) =>
    render(React.createElement(GraphExplorer, { initial: data(SMALL), rows: 20, columns: 110, ...props }));

  it('renders the node list, counts, status glyphs, cycle marker and the selected node details', () => {
    const { lastFrame, unmount } = mount();
    const frame = lastFrame() ?? '';
    expect(frame).toContain('re-shell graph explorer');
    expect(frame).toContain('6/6 nodes');
    expect(frame).toContain('5 edges');
    expect(frame).toContain('1 cycle(s)');
    expect(isSel(frame, 'api')).toBe(true);
    for (const id of ['core', 'loop-a', 'loop-b', 'ui', 'web']) expect(frame).toContain(id);
    expect(frame).toContain('⟳'); // cycle marker
    expect(frame).toContain('unhealthy');
    expect(frame).toContain('health URL did not answer');
    expect(frame).toContain('apps/api');
    unmount();
  });

  it('moves the selection with arrows and j/k and shows deps and dependents of the selection', async () => {
    const { lastFrame, stdin, unmount } = mount();
    stdin.write(KEY.down);
    stdin.write('j');
    const frame = await until(lastFrame, (f) => isSel(f, 'loop-a'));
    expect(frame).toContain('packages/loop-a');
    stdin.write('G');
    await until(lastFrame, (f) => isSel(f, 'web'));
    const web = lastFrame() ?? '';
    expect(web).toContain('Depends on (1)');
    expect(web).toContain('ui');
    stdin.write('k');
    await until(lastFrame, (f) => isSel(f, 'ui'));
    const ui = lastFrame() ?? '';
    expect(ui).toContain('Depended on by (1)');
    unmount();
  });

  it('searches, filters live, and Esc clears', async () => {
    const { lastFrame, stdin, unmount } = mount();
    stdin.write('/');
    for (const ch of 'loop') stdin.write(ch);
    const frame = await until(lastFrame, (f) => f.includes('search: loop'));
    expect(frame).toContain('2/6 nodes');
    expect(frame).toContain('loop-a');
    expect(frame).not.toContain('apps/web');
    stdin.write(KEY.esc);
    await until(lastFrame, (f) => f.includes('6/6 nodes'));
    unmount();
  });

  it('cycles status/language filters and clears them', async () => {
    const { lastFrame, stdin, unmount } = mount();
    stdin.write('s');
    const frame = await until(lastFrame, (f) => f.includes('[status='));
    expect(frame).toMatch(/\[status=(running|stopped|unhealthy|unknown)\]/);
    stdin.write('l');
    await until(lastFrame, (f) => f.includes('language='));
    stdin.write('c');
    await until(lastFrame, (f) => !f.includes('[status=') && f.includes('6/6 nodes'));
    unmount();
  });

  it('focus lists dependencies and dependents; Enter follows a relation; Esc goes back', async () => {
    const { lastFrame, stdin, unmount } = mount();
    stdin.write('j'); // core
    await until(lastFrame, (f) => isSel(f, 'core'));
    stdin.write(KEY.enter);
    const focus = await until(lastFrame, (f) => f.includes('Focus: core'));
    expect(focus).toContain('↓ used by');
    expect(focus).toContain('api');
    expect(focus).toContain('ui');
    stdin.write(KEY.down);
    await tick();
    stdin.write(KEY.enter); // follow -> ui
    const ui = await until(lastFrame, (f) => f.includes('Focus: ui'));
    expect(ui).toContain('↑ depends on');
    stdin.write('b');
    await until(lastFrame, (f) => f.includes('Focus: core'));
    stdin.write('b');
    await until(lastFrame, (f) => !f.includes('Focus:') && isSel(f, 'core'));
    unmount();
  });

  it('marks two nodes and shows the shortest dependency path, then clears it', async () => {
    const { lastFrame, stdin, unmount } = mount();
    stdin.write('G'); // web
    await until(lastFrame, (f) => isSel(f, 'web'));
    stdin.write('p');
    await until(lastFrame, (f) => f.includes('path from web'));
    stdin.write('g');
    stdin.write('j'); // core
    await until(lastFrame, (f) => isSel(f, 'core'));
    stdin.write('p');
    const frame = await until(lastFrame, (f) => f.includes('shortest path (2 hops'));
    expect(frame).toContain('web depends on core');
    expect(frame).toMatch(/web\s+→ ui\s+→ core/s);
    stdin.write('p');
    await until(lastFrame, (f) => !f.includes('shortest path'));
    unmount();
  });

  it('reports "no path" for unrelated nodes', async () => {
    const { lastFrame, stdin, unmount } = mount();
    stdin.write('p'); // api
    await until(lastFrame, (f) => f.includes('path from api'));
    stdin.write('G'); // web
    await until(lastFrame, (f) => isSel(f, 'web'));
    stdin.write('p');
    await until(lastFrame, (f) => f.includes('no dependency path api'));
    unmount();
  });

  it('shows help and returns on any key', async () => {
    const { lastFrame, stdin, unmount } = mount();
    stdin.write('?');
    await until(lastFrame, (f) => f.includes('keys'));
    stdin.write('x');
    await until(lastFrame, (f) => f.includes('6/6 nodes'));
    unmount();
  });

  it('refreshes in real time: a file-change notification reloads the graph and a status poll updates counts', async () => {
    let notify: ((kinds: ReadonlySet<'graph' | 'status'>) => void) | undefined;
    let loadGraphCalls = 0;
    const next: GraphModel = { nodes: [...SMALL.nodes, N('fresh', 'package', { path: 'packages/fresh' })], edges: SMALL.edges };
    const { lastFrame, unmount } = mount({
      loadGraph: async () => {
        loadGraphCalls++;
        return data(next);
      },
      loadStatuses: async () => new Map<string, ExplorerStatus>([['core', { status: 'running', reason: 'polled' }]]),
      subscribe: (cb) => {
        notify = cb;
        return () => {
          notify = undefined;
        };
      },
      statusIntervalMs: 60,
    });
    // status poll: web+api statuses are replaced by the poll result => exactly 1 running
    await until(lastFrame, (f) => /● 1\b/.test(f) && f.includes('refresh(es)'));
    expect(notify).toBeDefined();
    notify!(new Set(['graph']));
    const frame = await until(lastFrame, (f) => f.includes('7 nodes') || f.includes('/7 nodes'));
    expect(frame).toContain('fresh');
    expect(loadGraphCalls).toBe(1);
    unmount();
    expect(notify).toBeUndefined(); // unsubscribed on unmount
  });

  it('end to end: editing a package.json on disk refreshes the explorer through the real watcher and loaders', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-explore-live-'));
    const write = (rel: string, pkg: Record<string, unknown>) => {
      fs.mkdirSync(path.join(root, rel), { recursive: true });
      fs.writeFileSync(path.join(root, rel, 'package.json'), JSON.stringify(pkg));
    };
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'root', workspaces: ['apps/*', 'packages/*'] }));
    write('apps/web', { name: 'web', dependencies: { core: '*' } });
    write('packages/core', { name: 'core' });

    const subscribers = new Set<(kinds: ReadonlySet<WorkspaceChangeKind>) => void>();
    const close = await watchWorkspaceChanges(root, (kinds) => subscribers.forEach((cb) => cb(kinds)), { debounceMs: 80, usePolling: true });
    const initial = await loadExplorerData(root, true);
    const { lastFrame, unmount } = mount({
      initial,
      loadGraph: () => loadExplorerData(root, true),
      loadStatuses: () => loadStatusMap(root),
      subscribe: (cb) => {
        subscribers.add(cb);
        return () => subscribers.delete(cb);
      },
    });
    try {
      expect(lastFrame()).toContain('2/2 nodes');
      expect(lastFrame()).not.toContain('late-addition');

      // A new workspace appears on disk...
      write('packages/late-addition', { name: 'late-addition', dependencies: { core: '*' } });
      const grown = await until(lastFrame, (f) => f.includes('3/3 nodes') && f.includes('late-addition'), 15000);
      expect(grown).toContain('2 edges'); // web->core, late-addition->core

      // ...and an edited manifest changes the edges.
      write('apps/web', { name: 'web' });
      await until(lastFrame, (f) => f.includes('1 edges'), 15000);
    } finally {
      unmount();
      await close();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('surfaces a failed refresh instead of hiding it', async () => {
    let notify: ((kinds: ReadonlySet<'graph' | 'status'>) => void) | undefined;
    const { lastFrame, unmount } = mount({
      loadGraph: async () => {
        throw new Error('package.json is invalid JSON');
      },
      subscribe: (cb) => {
        notify = cb;
        return () => undefined;
      },
    });
    notify!(new Set(['graph']));
    await until(lastFrame, (f) => f.includes('refresh failed: package.json is invalid JSON'));
    unmount();
  });

  it('handles an empty graph and a search with no matches', async () => {
    const empty = mount({ initial: data({ nodes: [], edges: [] }) });
    expect(empty.lastFrame()).toContain('0/0 nodes');
    empty.stdin.write(KEY.enter); // focus on nothing must not throw
    await tick();
    expect(empty.lastFrame()).toContain('No node matches');
    empty.unmount();

    const { lastFrame, stdin, unmount } = mount();
    stdin.write('/');
    for (const ch of 'zzzz') stdin.write(ch);
    const frame = await until(lastFrame, (f) => f.includes('0/6 nodes'));
    expect(frame).toContain('(no matches)');
    unmount();
  });

  it('5000 nodes: first render, keystroke navigation and search stay within budget and only a viewport is drawn', async () => {
    const graph = syntheticGraph(5000);
    const initial = data(graph, syntheticStatuses(graph));
    const rows = 30;

    const t0 = performance.now();
    const { lastFrame, stdin, unmount } = render(
      React.createElement(GraphExplorer, { initial, rows, columns: 120 })
    );
    const firstFrame = lastFrame() ?? '';
    const firstRenderMs = performance.now() - t0;
    expect(firstFrame).toContain('5000/5000 nodes');
    expect(firstFrame).toContain('pkg-00000');
    expect(firstFrame).not.toContain('pkg-04999');
    // Virtualized: the frame never has more lines than the terminal rows.
    expect(firstFrame.split('\n').length).toBeLessThanOrEqual(rows);
    // ... and draws at most `rows - chrome` list rows.
    const listed = (firstFrame.match(/pkg-\d{5}/g) ?? []).length;
    expect(listed).toBeLessThan(rows * 2); // list rows + the detail pane's dependency names

    // 100 keystrokes
    const t1 = performance.now();
    for (let i = 0; i < 100; i++) stdin.write(KEY.down);
    await until(lastFrame, (f) => isSel(f, 'pkg-00100'), 15000);
    const navMs = performance.now() - t1;

    // End of list jumps without rendering 5000 rows.
    stdin.write('G');
    const last = await until(lastFrame, (f) => isSel(f, 'pkg-04999'), 15000);
    expect(last.split('\n').length).toBeLessThanOrEqual(rows);

    // Search narrows 5000 -> a handful.
    const t2 = performance.now();
    stdin.write('g');
    stdin.write('/');
    for (const ch of 'group-7 pkg-0001') stdin.write(ch);
    const filtered = await until(lastFrame, (f) => /\d+\/5000 nodes/.test(f) && !f.includes('5000/5000'), 15000);
    const searchMs = performance.now() - t2;
    expect(filtered).toContain('search: group-7 pkg-0001');
    unmount();

    // Generous budgets for shared CI machines: first render must not be O(n^2)
    // and a viewport frame must not scale with the node count.
    expect(firstRenderMs).toBeLessThan(5000);
    expect(navMs).toBeLessThan(12000);
    expect(searchMs).toBeLessThan(8000);
  }, 60000);
});
