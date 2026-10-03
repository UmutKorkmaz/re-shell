// Interactive terminal workspace-graph explorer (ink).
//
// `re-shell workspace explore` / `re-shell workspace graph --interactive`.
// All state lives in utils/graph-explorer-state.ts; this file only maps keys to
// actions and renders the visible window (virtualized: O(viewport) per frame).
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import chalk from 'chalk';
import type { WorkspaceLiveStatus } from '@re-shell/contracts';
import {
  FACETS,
  createExplorerState,
  explorerReducer,
  relationCounts,
  selectedId,
  statusOf,
  windowOf,
  type ExplorerData,
  type ExplorerModel,
  type ExplorerState,
  type ExplorerStatus,
} from '../utils/graph-explorer-state';
import { loadGraphModel, requireMonorepoRoot, GraphSourceError } from '../utils/graph-source';
import { collectWorkspaceStatus } from '../utils/workspace-status';
import { watchWorkspaceChanges } from '../utils/graph-explorer-watch';

interface InkRuntime {
  render: (node: React.ReactElement, options?: Record<string, unknown>) => {
    unmount: () => void;
    waitUntilExit: () => Promise<void>;
  };
  Box: React.ComponentType<Record<string, unknown>>;
  Text: React.ComponentType<Record<string, unknown>>;
  useInput: (cb: (input: string, key: Record<string, boolean>) => void, options?: { isActive?: boolean }) => void;
  useApp: () => { exit: (error?: Error) => void };
  useStdout: () => { stdout: NodeJS.WriteStream };
}

let ink: InkRuntime | undefined;

// ink is ESM-only; the CLI is CommonJS. Mirror ink-tui.tsx's loader.
function nativeImport<T = unknown>(specifier: string): Promise<T> {
  if (process.env.VITEST) {
    return import(specifier) as Promise<T>;
  }
  return new Function('specifier', 'return import(specifier)')(specifier) as Promise<T>;
}

/** Load ink once. Must be awaited before rendering {@link GraphExplorer}. */
export async function loadExplorerRuntime(): Promise<void> {
  if (ink) return;
  ink = await nativeImport<InkRuntime>('ink');
}

const STATUS_COLOR: Record<WorkspaceLiveStatus, string> = {
  running: 'green',
  stopped: 'gray',
  unhealthy: 'red',
  unknown: 'yellow',
};
const STATUS_GLYPH: Record<WorkspaceLiveStatus, string> = {
  running: '●',
  stopped: '○',
  unhealthy: '▲',
  unknown: '?',
};

export interface GraphExplorerProps {
  initial: ExplorerData;
  /** Full reload (graph + statuses). Called on manual refresh and on `graph` file changes. */
  loadGraph?: () => Promise<ExplorerData>;
  /** Status-only reload. Called on the poll interval and on `.re-shell/pids` changes. */
  loadStatuses?: () => Promise<ReadonlyMap<string, ExplorerStatus>>;
  /** Subscribe to workspace file changes; returns an unsubscribe function. */
  subscribe?: (onChange: (kinds: ReadonlySet<'graph' | 'status'>) => void) => () => void;
  statusIntervalMs?: number;
  /** Terminal size; defaults to the real stdout. */
  rows?: number;
  columns?: number;
  title?: string;
}

const CHROME_ROWS = 6; // header(2) + footer(3) + path/message line

const Row = React.memo(function Row(props: {
  model: ExplorerModel;
  id: string;
  selected: boolean;
  /** Name column width, shared by all rows so columns line up. */
  nameWidth: number;
}): React.ReactElement {
  const { Text } = ink!;
  const { model, id, selected, nameWidth } = props;
  const node = model.index.nodes.get(id)!;
  const status = statusOf(model, id);
  const cyclic = model.cycles.nodeIds.has(id);
  const type = node.type.slice(0, 7).padEnd(7);
  const lang = (node.language ?? '-').slice(0, 10).padEnd(10);
  const framework = node.framework ?? '-';
  const name = id.length > nameWidth ? `${id.slice(0, nameWidth - 1)}…` : id.padEnd(nameWidth);
  return (
    <Text wrap="truncate">
      <Text color={selected ? 'cyan' : undefined}>{selected ? '▶ ' : '  '}</Text>
      <Text color={STATUS_COLOR[status]}>{STATUS_GLYPH[status]} </Text>
      <Text color={selected ? 'cyan' : undefined} inverse={selected}>
        {name}
      </Text>
      <Text color="gray">
        {' '}
        {type} {lang} {framework}
      </Text>
      {cyclic ? <Text color="red"> ⟳</Text> : null}
    </Text>
  );
});

function Header({ state }: { state: ExplorerState }): React.ReactElement {
  const { Box, Text } = ink!;
  const model = state.model;
  const active = FACETS.filter((f) => state.filters[f] !== undefined).map((f) => `${f}=${state.filters[f]}`);
  const counts = { running: 0, stopped: 0, unhealthy: 0, unknown: 0 };
  for (const id of model.ids) counts[statusOf(model, id)]++;
  return (
    <Box flexDirection="column">
      <Text bold wrap="truncate">
        re-shell graph explorer{' '}
        <Text color="gray">
          {state.rows.length}/{model.ids.length} nodes · {model.index.edges.length} edges
          {model.cycles.cycles.length > 0 ? ` · ${model.cycles.cycles.length} cycle(s)` : ''}
        </Text>
      </Text>
      <Text wrap="truncate">
        <Text color="green">● {counts.running}</Text> <Text color="gray">○ {counts.stopped}</Text>{' '}
        <Text color="red">▲ {counts.unhealthy}</Text> <Text color="yellow">? {counts.unknown}</Text>
        {'  '}
        {state.mode === 'search' ? <Text color="cyan">search: {state.query}▌</Text> : state.query ? <Text color="cyan">search: {state.query}</Text> : null}
        {active.length ? <Text color="magenta">  [{active.join(' ')}]</Text> : null}
      </Text>
    </Box>
  );
}

function Detail({ state, width }: { state: ExplorerState; width: number }): React.ReactElement {
  const { Box, Text } = ink!;
  const model = state.model;
  const id = selectedId(state);
  const lines: React.ReactElement[] = [];
  const push = (key: string, el: React.ReactElement): void => {
    lines.push(React.cloneElement(el, { key }));
  };

  if (id === undefined) {
    return (
      <Box flexDirection="column" width={width}>
        <Text color="gray">No node matches the current search/filters.</Text>
      </Box>
    );
  }
  const node = model.index.nodes.get(id)!;
  const st = model.data.statuses.get(id);
  const status = st?.status ?? 'unknown';
  const counts = relationCounts(model, id);
  push('name', <Text bold wrap="truncate">{id}</Text>);
  push('path', <Text color="gray" wrap="truncate">{node.path || '(no path)'}</Text>);
  push('attrs', <Text wrap="truncate">{node.type} · {node.language ?? '-'} · {node.framework ?? '-'}</Text>);
  push(
    'status',
    <Text color={STATUS_COLOR[status]} wrap="truncate">
      {STATUS_GLYPH[status]} {status}
      <Text color="gray"> {st?.reason ?? 'no status fetched'}</Text>
    </Text>
  );
  push(
    'counts',
    <Text wrap="truncate">
      ↑ depends on {counts.directUp} ({counts.transitiveUp} transitive) · ↓ used by {counts.directDown} ({counts.transitiveDown} transitive)
    </Text>
  );
  if (model.cycles.nodeIds.has(id)) {
    const cycle = model.cycles.cycles.find((c) => c.includes(id));
    push('cycle', <Text color="red" wrap="truncate">⟳ on a cycle with {cycle ? cycle.length - 1 : 0} other node(s)</Text>);
  }

  if (state.path) {
    const p = state.path;
    if (p.result === null) {
      push('path0', <Text color="magenta" wrap="truncate">path from {p.from}: pick another node and press p</Text>);
    } else if (p.result === 'none') {
      push('path1', <Text color="red" wrap="truncate">no dependency path {p.from} ↔ {p.to}</Text>);
    } else {
      push('pathh', <Text color="magenta" bold>shortest path ({p.result.path.length - 1} hops, {p.result.dependent === 'a' ? `${p.from} depends on ${p.to}` : `${p.to} depends on ${p.from}`})</Text>);
      const shown = p.result.path.slice(0, 8);
      shown.forEach((n, i) => push(`pathn${i}`, <Text color="magenta" wrap="truncate">{i === 0 ? '  ' : '  → '}{n}</Text>));
      if (p.result.path.length > shown.length) push('pathmore', <Text color="gray">  … +{p.result.path.length - shown.length} more</Text>);
    }
  }

  const deps = model.index.dependencies.get(id) ?? [];
  const dependents = model.index.dependents.get(id) ?? [];
  const list = (title: string, items: readonly string[], key: string): void => {
    push(`${key}h`, <Text bold>{title} ({items.length})</Text>);
    items.slice(0, 6).forEach((d, i) => push(`${key}${i}`, <Text wrap="truncate">  {d}</Text>));
    if (items.length > 6) push(`${key}m`, <Text color="gray">  … +{items.length - 6} more (Enter to focus)</Text>);
  };
  if (state.mode !== 'focus') {
    list('Depends on', deps, 'dep');
    list('Depended on by', dependents, 'dnt');
  }

  return (
    <Box flexDirection="column" width={width}>
      {lines}
    </Box>
  );
}

function RelationList({ state, width }: { state: ExplorerState; width: number }): React.ReactElement {
  const { Box, Text } = ink!;
  const focus = state.focus!;
  const win = windowOf(focus.relations, focus.offset, state.height);
  return (
    <Box flexDirection="column" width={width}>
      <Text bold wrap="truncate">Focus: {focus.id}</Text>
      {focus.relations.length === 0 ? <Text color="gray">  no direct dependencies or dependents</Text> : null}
      {win.map((rel, i) => {
        const selected = focus.offset + i === focus.cursor;
        return (
          <Text key={`${rel.rel}:${rel.id}`} color={selected ? 'cyan' : undefined} inverse={selected} wrap="truncate">
            {selected ? '▶ ' : '  '}
            {rel.rel === 'up' ? '↑ depends on ' : '↓ used by     '}
            {rel.id}
          </Text>
        );
      })}
    </Box>
  );
}

export const GraphExplorer: React.FC<GraphExplorerProps> = (props) => {
  const { Box, Text } = ink!;
  const { useInput, useApp, useStdout } = ink!;
  const { exit } = useApp();
  const { stdout } = useStdout();

  const rows = props.rows ?? stdout?.rows ?? 30;
  const columns = props.columns ?? stdout?.columns ?? 100;
  const listHeight = Math.max(3, rows - CHROME_ROWS);

  const [state, dispatch] = useReducer(explorerReducer, undefined, () => createExplorerState(props.initial, listHeight));
  const [live, setLive] = useState<{ busy: boolean; error: string | null; updates: number }>({
    busy: false,
    error: null,
    updates: 0,
  });
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    dispatch({ type: 'resize', height: listHeight });
  }, [listHeight]);

  const reload = useCallback(async (kind: 'graph' | 'status'): Promise<void> => {
    const p = propsRef.current;
    setLive((l) => ({ ...l, busy: true }));
    try {
      if (kind === 'graph' && p.loadGraph) {
        dispatch({ type: 'data', data: await p.loadGraph() });
      } else if (p.loadStatuses) {
        dispatch({ type: 'statuses', statuses: await p.loadStatuses(), loadedAt: Date.now() });
      }
      setLive((l) => ({ busy: false, error: null, updates: l.updates + 1 }));
    } catch (error) {
      setLive((l) => ({ ...l, busy: false, error: error instanceof Error ? error.message : String(error) }));
    }
  }, []);

  // Real-time refresh: file changes and the status poll.
  useEffect(() => {
    const unsubscribe = props.subscribe?.((kinds) => void reload(kinds.has('graph') ? 'graph' : 'status'));
    const interval =
      props.statusIntervalMs && props.statusIntervalMs > 0 && props.loadStatuses
        ? setInterval(() => void reload('status'), props.statusIntervalMs)
        : undefined;
    return () => {
      unsubscribe?.();
      if (interval) clearInterval(interval);
    };
  }, [props.subscribe, props.statusIntervalMs, props.loadStatuses, reload]);

  useInput((input, key) => {
    if (state.mode === 'search') {
      if (key.return) dispatch({ type: 'endSearch', clear: false });
      else if (key.escape) dispatch({ type: 'endSearch', clear: true });
      else if (key.backspace || key.delete) dispatch({ type: 'backspaceSearch' });
      else if (key.downArrow) dispatch({ type: 'move', delta: 1 });
      else if (key.upArrow) dispatch({ type: 'move', delta: -1 });
      else if (input && !key.ctrl && !key.meta) dispatch({ type: 'typeSearch', text: input });
      return;
    }
    if (state.mode === 'help') {
      dispatch({ type: 'back' });
      return;
    }
    if ((key.ctrl && input === 'c') || input === 'q') {
      exit();
      return;
    }
    if (key.upArrow || input === 'k') dispatch({ type: 'move', delta: -1 });
    else if (key.downArrow || input === 'j') dispatch({ type: 'move', delta: 1 });
    else if (key.pageUp) dispatch({ type: 'page', direction: -1 });
    else if (key.pageDown) dispatch({ type: 'page', direction: 1 });
    else if (input === 'g') dispatch({ type: 'home' });
    else if (input === 'G') dispatch({ type: 'end' });
    else if (input === '/') dispatch({ type: 'startSearch' });
    else if (input === 'l') dispatch({ type: 'cycleFacet', facet: 'language' });
    else if (input === 'f') dispatch({ type: 'cycleFacet', facet: 'framework' });
    else if (input === 't') dispatch({ type: 'cycleFacet', facet: 'type' });
    else if (input === 's') dispatch({ type: 'cycleFacet', facet: 'status' });
    else if (input === 'c') dispatch({ type: 'clearFilters' });
    else if (key.return) dispatch({ type: state.mode === 'focus' ? 'focusRelation' : 'focus' });
    else if (key.escape || key.backspace || key.delete || key.leftArrow || input === 'b') dispatch({ type: 'back' });
    else if (input === 'p') dispatch({ type: 'togglePath' });
    else if (input === '?') dispatch({ type: 'help' });
    else if (input === 'r') void reload('graph');
  });

  const leftWidth = Math.max(30, Math.floor(columns * 0.55));
  const rightWidth = Math.max(20, columns - leftWidth - 2);
  const nameWidth = useMemo(() => {
    let longest = 8;
    for (const id of state.model.ids) if (id.length > longest) longest = id.length;
    // marker(2) glyph(2) name 1 type(7) 1 lang(10) 1 framework(>=6) cycle(2)
    return Math.max(16, Math.min(longest, 40, leftWidth - 26));
  }, [state.model, leftWidth]);
  const win = useMemo(() => windowOf(state.rows, state.offset, state.height), [state.rows, state.offset, state.height]);

  if (state.mode === 'help') {
    return (
      <Box flexDirection="column">
        <Text bold>re-shell graph explorer — keys</Text>
        <Text>↑/↓ j/k move   PgUp/PgDn page   g/G top/bottom</Text>
        <Text>/ search (Enter keep, Esc clear)   l f t s cycle language/framework/type/status   c clear filters</Text>
        <Text>Enter focus node (then Enter follows a dependency/dependent)   Esc/b/← back</Text>
        <Text>p mark path start, then p on another node = shortest dependency path, p again = clear</Text>
        <Text>r reload now   ? help   q quit.  Auto-refreshes when workspace files change.</Text>
        <Text color="gray">press any key to return</Text>
      </Box>
    );
  }

  const updated = new Date(state.model.data.loadedAt).toLocaleTimeString();
  const msg = live.error ? chalk.red(`refresh failed: ${live.error}`) : state.message;
  return (
    <Box flexDirection="column">
      <Header state={state} />
      <Box>
        {state.mode === 'focus' && state.focus ? (
          <RelationList state={state} width={leftWidth} />
        ) : (
          <Box flexDirection="column" width={leftWidth}>
            {win.length === 0 ? <Text color="gray">  (no matches)</Text> : null}
            {win.map((id, i) => (
              <Row key={id} model={state.model} id={id} selected={state.offset + i === state.cursor} nameWidth={nameWidth} />
            ))}
          </Box>
        )}
        <Box width={2} />
        <Detail state={state} width={rightWidth} />
      </Box>
      <Text color="gray" wrap="truncate">
        {state.mode === 'focus' ? `${state.focus ? state.focus.cursor + 1 : 0}/${state.focus?.relations.length ?? 0}` : `${state.rows.length === 0 ? 0 : state.cursor + 1}/${state.rows.length}`}
        {' · '}
        {msg}
      </Text>
      <Text color="gray" wrap="truncate">
        live · updated {updated}{live.busy ? ' · refreshing…' : ''} · {live.updates} refresh(es)
      </Text>
      <Text color="gray" wrap="truncate">/ search · l f t s filter · Enter focus · p path · r reload · ? help · q quit</Text>
    </Box>
  );
};

// ─── CLI launcher ────────────────────────────────────────────────────────────

export interface ExplorerLaunchOptions {
  cwd?: string;
  /** Poll interval for live status in ms. 0 disables polling. Default 5000. */
  statusIntervalMs?: number;
  /** Watch workspace files for changes. Default true. */
  watch?: boolean;
  /** Skip status collection entirely (all nodes `unknown`). */
  status?: boolean;
}

export async function loadExplorerData(root: string, withStatus: boolean): Promise<ExplorerData> {
  const [graph, statuses] = await Promise.all([
    loadGraphModel(root),
    withStatus ? loadStatusMap(root) : Promise.resolve(new Map<string, ExplorerStatus>()),
  ]);
  return { graph, statuses, loadedAt: Date.now() };
}

export async function loadStatusMap(root: string): Promise<Map<string, ExplorerStatus>> {
  const report = await collectWorkspaceStatus(root);
  return new Map(report.nodes.map((n) => [n.name, { status: n.status, reason: n.reason }]));
}

/**
 * Open the explorer. Non-TTY invocation is an explicit failure: a message on
 * stderr and exit code 1, never a silent no-op.
 */
export async function launchGraphExplorerCommand(options: ExplorerLaunchOptions): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error(
      chalk.red(
        'Error: the interactive graph explorer needs a terminal (stdin and stdout must both be a TTY). ' +
          'Use `re-shell workspace graph --json` for scripts and pipes.'
      )
    );
    process.exitCode = 1;
    return;
  }

  let root: string;
  try {
    root = await requireMonorepoRoot(options.cwd ?? process.cwd());
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof GraphSourceError || error instanceof Error ? error.message : String(error)}`));
    process.exitCode = 1;
    return;
  }

  await loadExplorerRuntime();
  const withStatus = options.status !== false;
  const initial = await loadExplorerData(root, withStatus);

  let close: (() => Promise<void>) | undefined;
  const subscribers = new Set<(kinds: ReadonlySet<'graph' | 'status'>) => void>();
  if (options.watch !== false) {
    close = await watchWorkspaceChanges(root, (kinds) => subscribers.forEach((cb) => cb(kinds)));
  }

  const app = ink!.render(
    <GraphExplorer
      initial={initial}
      loadGraph={() => loadExplorerData(root, withStatus)}
      loadStatuses={() => (withStatus ? loadStatusMap(root) : Promise.resolve(new Map()))}
      subscribe={(cb) => {
        subscribers.add(cb);
        return () => subscribers.delete(cb);
      }}
      statusIntervalMs={withStatus ? (options.statusIntervalMs ?? 5000) : 0}
    />,
    { exitOnCtrlC: false }
  );
  try {
    await app.waitUntilExit();
  } finally {
    if (close) await close();
  }
}
