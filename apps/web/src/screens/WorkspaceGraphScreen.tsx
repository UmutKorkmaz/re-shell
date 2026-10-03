import * as React from 'react';
import { Background, Controls, MiniMap, ReactFlow, type Node, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './graph/graph-theme.css';
import { CommandPreview, cn, formatCommand } from '@re-shell/ui';
import { reachableFrom, shortestDependencyPath, type WorkspaceLiveStatus } from '@re-shell/contracts';
import { Boxes, GitFork, Server } from 'lucide-react';
import { useEnvelopeQuery } from './shared/useEnvelopeQuery';
import { EmptyPanel, EnvelopeErrorPanel, ErrorPanel, LoadingPanel } from './shared/StatePanels';
import { workspaceGraphSchema, type WorkspaceGraph } from './shared/feedSchemas';
import { GraphNodeCard, STATUS_HEX, type ActivateEvent, type GraphNodeData } from './graph/GraphNodeCard';
import { GRAPH_COMMAND, NodeDetailPanel } from './graph/NodeDetailPanel';
import { GraphToolbar } from './graph/GraphToolbar';
import { GraphInspector } from './graph/GraphInspector';
import { DiffPanel } from './graph/DiffPanel';
import { buildGraphData, factsFromModel } from './graph/graphData';
import { facetOptions, hasActiveFilters, matchNodes, type GraphFilters } from './graph/graphFilters';
import { COMPACT_LAYOUT, DEFAULT_LAYOUT, computeLayout } from './graph/layout';
import {
  COMPACT_THRESHOLD,
  buildFlow,
  displayFromData,
  displayFromDiff,
  type DisplayGraph,
  createFlowCache,
  dimsEdges,
  hasFocus,
  type ViewState,
} from './graph/view';
import {
  downloadBlob,
  exportImage,
  exportPdf,
  textExport,
  type ExportArtifact,
  type ExportFormat,
} from './graph/exporters';
import type { SceneInput } from './graph/exportScene';
import { parsePollSeconds, useGraphUrlState } from './graph/useGraphUrlState';
import { useLiveStatus } from './graph/useLiveStatus';
import { useGraphDiff } from './graph/useGraphDiff';

const NODE_TYPES = { topology: GraphNodeCard } as const;
// Stable props: a fresh object/function per render would make React Flow (and the
// minimap's 2000 rects) re-process everything on every state change.
const PRO_OPTIONS = { hideAttribution: true } as const;
const FIT_VIEW_OPTIONS = { padding: 0.12 } as const;
const EMPTY_SET: ReadonlySet<string> = new Set<string>();

export function WorkspaceGraphScreen(): React.ReactElement {
  const { data, isLoading, error, envelopeError, refetch } = useEnvelopeQuery(
    'workspace.graph',
    workspaceGraphSchema
  );

  if (isLoading) {
    return <LoadingPanel title="Loading topology…" description="Fetching workspace.graph from the hub." />;
  }

  if (error) {
    return <ErrorPanel title="Could not reach the hub" description={error.message} onRetry={() => refetch()} />;
  }

  if (envelopeError) {
    return (
      <EnvelopeErrorPanel
        code={envelopeError.code}
        message={envelopeError.message}
        action={
          <p className="text-sm text-muted-foreground">
            No workspace topology available. Initialize a workspace to populate the graph.
          </p>
        }
      />
    );
  }

  if (!data || (data.apps.length === 0 && data.services.length === 0)) {
    return (
      <EmptyPanel
        title="Empty topology"
        description="The hub returned no apps or services. Add a workspace to see the dependency graph."
        action={
          <CommandPreview
            spec={{
              title: 'Workspace graph',
              description: 'Print the dependency graph as JSON.',
              command: GRAPH_COMMAND,
              commandText: formatCommand(GRAPH_COMMAND),
              destructive: false,
              dryRunSupported: false,
            }}
          />
        }
      />
    );
  }

  return (
    <div className="screen-enter">
      <GraphContent graph={data} />
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function GraphContent({ graph }: { graph: WorkspaceGraph }): React.ReactElement {
  const data = React.useMemo(() => buildGraphData(graph), [graph]);
  const [url, setUrl] = useGraphUrlState();
  const [pickTarget, setPickTarget] = React.useState(false);
  const [showCycles, setShowCycles] = React.useState(true);
  const [diffOpen, setDiffOpen] = React.useState(url.diffBase !== '');
  const [exporting, setExporting] = React.useState<ExportFormat | null>(null);
  const [exportNote, setExportNote] = React.useState<{ ok: boolean; text: string } | null>(null);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const rfRef = React.useRef<ReactFlowInstance<Node<GraphNodeData>> | null>(null);

  // --- live status (polled) -------------------------------------------------
  const defaultPoll = data.nodes.length > 500 ? 30 : 5; // a status probe per node gets costly on huge workspaces
  const pollSeconds = url.poll === '' ? defaultPoll : parsePollSeconds(url.poll);
  const live = useLiveStatus(pollSeconds);

  // --- diff ------------------------------------------------------------------
  const diffState = useGraphDiff(diffOpen ? url.diffBase : '', url.diffHead);
  const diffMode = diffOpen && diffState.diff !== null;

  const display = React.useMemo<DisplayGraph>(
    () => (diffMode && diffState.diff ? displayFromDiff(diffState.diff) : displayFromData(data)),
    [data, diffMode, diffState.diff]
  );

  // --- filters (URL state, deferred search text so typing stays instant) -----
  const deferredQ = React.useDeferredValue(url.q);
  const filters = React.useMemo<GraphFilters>(
    () => ({ q: deferredQ, language: url.language, framework: url.framework, type: url.type, status: url.status }),
    [deferredQ, url.language, url.framework, url.type, url.status]
  );
  const urlFilters: GraphFilters = { q: url.q, language: url.language, framework: url.framework, type: url.type, status: url.status };
  const facts = React.useMemo(() => factsFromModel(display.model), [display.model]);
  const options = React.useMemo(() => facetOptions(facts, live.statusOf), [facts, live.statusOf]);
  const filtering = hasActiveFilters(filters);
  const matches = React.useMemo(
    () => (filtering ? matchNodes(facts, filters, live.statusOf) : null),
    [facts, filters, filtering, live.statusOf]
  );
  const matchCount = matches === null ? facts.length : matches.size;

  // --- selection, dependency sets, shortest path ----------------------------
  const selected = url.sel !== '' && display.index.nodes.has(url.sel) ? url.sel : null;
  const target = selected !== null && display.index.nodes.has(url.to) ? url.to : '';
  const upstream = React.useMemo(
    () => (selected ? reachableFrom(display.index, selected, 'dependencies') : EMPTY_SET),
    [display.index, selected]
  );
  const downstream = React.useMemo(
    () => (selected ? reachableFrom(display.index, selected, 'dependents') : EMPTY_SET),
    [display.index, selected]
  );
  const path = React.useMemo(
    () => (selected && target ? shortestDependencyPath(display.index, selected, target) : null),
    [display.index, selected, target]
  );

  // --- layout (pure, O(V+E); a few ms for 2000 nodes, so no worker) ----------
  const layout = React.useMemo(
    () => computeLayout(display.index, display.model.nodes.length > COMPACT_THRESHOLD ? COMPACT_LAYOUT : DEFAULT_LAYOUT),
    [display]
  );

  // --- React Flow nodes/edges ------------------------------------------------
  // Activating a node (click) selects it and shows its details; shift/ctrl/meta-
  // click, or the "Pick on canvas" mode, sets it as the second end of a path.
  const activateRef = React.useRef<(id: string, event?: ActivateEvent) => void>(() => undefined);
  activateRef.current = (id, event) => {
    const second = pickTarget || event?.shiftKey === true || event?.metaKey === true || event?.ctrlKey === true;
    if (second && selected !== null && id !== selected) {
      setUrl({ to: id });
      setPickTarget(false);
      return;
    }
    if (id === selected) setUrl({ sel: '', to: '' });
    else setUrl({ sel: id, to: '' });
  };
  const openFns = React.useRef(new Map<string, (event?: ActivateEvent) => void>());
  const openFor = React.useCallback((id: string) => {
    let fn = openFns.current.get(id);
    if (!fn) {
      fn = (event) => activateRef.current(id, event);
      openFns.current.set(id, fn);
    }
    return fn;
  }, []);
  // One identity cache per displayed graph (dropped when the graph itself changes).
  const flowCache = React.useMemo(() => createFlowCache(), [display]);

  const view = React.useMemo<ViewState>(
    () => ({
      matches,
      hide: url.hide === '1',
      selected,
      upstream,
      downstream,
      path,
      showCycles,
      statusOf: live.statusOf,
      reasonOf: (id) => live.byName.get(id)?.reason,
      portOf: (id) => live.byName.get(id)?.checks.find((c) => c.port !== undefined)?.port,
    }),
    [matches, url.hide, selected, upstream, downstream, path, showCycles, live.statusOf, live.byName]
  );
  const flow = React.useMemo(
    () => buildFlow(display, layout, view, flowCache, openFor),
    [display, layout, view, flowCache, openFor]
  );

  // --- interactions ----------------------------------------------------------
  const onPaneClick = React.useCallback(() => {
    setPickTarget(false);
    if (url.sel !== '') setUrl({ sel: '', to: '' });
  }, [setUrl, url.sel]);

  const clearSelection = (): void => {
    setPickTarget(false);
    setUrl({ sel: '', to: '' });
  };

  const onExport = async (format: ExportFormat): Promise<void> => {
    setExporting(format);
    setExportNote(null);
    try {
      let artifact: ExportArtifact;
      if (format === 'png' || format === 'svg' || format === 'pdf') {
        const el = canvasRef.current?.querySelector<HTMLElement>('.react-flow');
        if (!el) throw new Error('The graph canvas is not mounted.');
        // What is in view right now, so a huge graph can be drawn straight to SVG (see exportScene.ts).
        const instance = rfRef.current;
        const scene: SceneInput | undefined = instance
          ? {
              nodes: flow.nodes,
              edges: flow.edges,
              viewport: instance.getViewport(),
              width: el.clientWidth,
              height: el.clientHeight,
              focus: hasFocus(view),
              filtering: matches !== null,
              dimEdges: dimsEdges(view),
              background: getComputedStyle(el).backgroundColor || '#0b0d10',
              foreground: getComputedStyle(document.body).color || '#e2e8f0',
            }
          : undefined;
        artifact = format === 'pdf' ? await exportPdf(el, scene) : await exportImage(el, format, scene);
      } else {
        artifact = textExport(format, display.model, diffMode ? diffState.diff : null);
      }
      downloadBlob(artifact.blob, artifact.filename);
      setExportNote({ ok: true, text: `Downloaded ${artifact.filename} (${formatBytes(artifact.blob.size)})` });
    } catch (error) {
      setExportNote({ ok: false, text: `Export failed: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setExporting(null);
    }
  };

  const selectedNode = selected !== null ? (display.index.nodes.get(selected) ?? null) : null;
  const noPath = selected !== null && target !== '' && path === null;
  const big = display.model.nodes.length > 500;
  const nodeIds = React.useMemo(() => display.index.nodeIds, [display.index]);

  const appCount = graph.apps.length;
  const serviceCount = graph.services.length;
  const summaryText = (['running', 'unhealthy', 'stopped', 'unknown'] as WorkspaceLiveStatus[])
    .map((s) => `${live.summary[s]} ${s}`)
    .join(' · ');

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <GraphStat icon={<Boxes className="size-3.5" />} label="apps" value={appCount} tone="text-signal" />
        <GraphStat icon={<Server className="size-3.5" />} label="services" value={serviceCount} tone="text-info" />
        <GraphStat icon={<GitFork className="size-3.5" />} label="dependencies" value={data.model.edges.length} tone="text-muted-foreground" />
        <span
          className="cli-chip py-1 text-xs"
          data-testid="graph-status-summary"
          data-checked-at={live.checkedAt ?? ''}
          data-running={live.summary.running}
          data-stopped={live.summary.stopped}
          data-unhealthy={live.summary.unhealthy}
          data-unknown={live.summary.unknown}
        >
          {summaryText}
        </span>
        {live.error ? (
          <span role="status" className="cli-chip py-1 text-xs text-warn" data-testid="graph-status-error" title={live.error}>
            Live status unavailable: {live.error}
          </span>
        ) : null}
        <span className="text-sm text-muted-foreground">Click a node to trace its dependencies and open its details.</span>
      </div>

      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">Dependency graph</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {diffMode
                ? 'Change-set between the two refs: added, removed and changed workspaces and edges.'
                : 'Internal workspace-to-workspace edges from the --json feed, coloured by live status.'}
            </p>
          </div>
        </div>

        <GraphToolbar
          filters={urlFilters}
          options={options}
          onFilter={(next) => setUrl(next)}
          hide={url.hide === '1'}
          onHide={(hide) => setUrl({ hide: hide ? '1' : '' })}
          matchCount={matchCount}
          totalCount={facts.length}
          pollSeconds={pollSeconds}
          onPoll={(seconds) => setUrl({ poll: String(seconds) })}
          onRefreshStatus={live.refetch}
          statusFetching={live.isFetching}
          onExport={(format) => void onExport(format)}
          exporting={exporting}
          diffActive={diffOpen}
          onToggleDiff={() => {
            if (diffOpen) setUrl({ diffBase: '', diffHead: '' });
            setDiffOpen(!diffOpen);
          }}
        />

        {exportNote ? (
          <div
            role="status"
            data-testid="graph-export-status"
            data-ok={exportNote.ok}
            className={cn('border-b border-border px-5 py-1.5 text-xs', exportNote.ok ? 'text-healthy' : 'text-critical')}
          >
            {exportNote.text}
          </div>
        ) : null}

        {diffOpen ? (
          <DiffPanel
            base={url.diffBase}
            head={url.diffHead}
            onCompare={(base, head) => setUrl({ diffBase: base, diffHead: head })}
            onClose={() => {
              setUrl({ diffBase: '', diffHead: '' });
              setDiffOpen(false);
            }}
            diff={diffState.diff}
            error={diffState.error}
            isLoading={diffState.isLoading}
          />
        ) : null}

        <GraphInspector
          selected={selected}
          target={target}
          nodeIds={nodeIds}
          upstreamCount={upstream.size}
          downstreamCount={downstream.size}
          path={path}
          noPath={noPath}
          cycles={display.cycles}
          showCycles={showCycles}
          onShowCycles={setShowCycles}
          pickTarget={pickTarget}
          onPickTarget={setPickTarget}
          onTarget={(id) => setUrl({ to: id })}
          onClear={clearSelection}
          onSelect={(id) => setUrl({ sel: id, to: '' })}
        />

        {/* The details panel overlays the canvas (instead of resizing it), so opening it never shifts or re-culls the graph. */}
        <div className="relative">
        <div
          ref={canvasRef}
          className="h-[36rem] w-full bg-bg-0"
          data-testid="graph-canvas"
          data-node-count={display.model.nodes.length}
          data-edge-count={display.model.edges.length}
          data-mode={diffMode ? 'diff' : 'live'}
        >
          <ReactFlow
            key={diffMode ? `diff:${diffState.diff?.base.ref}:${diffState.diff?.head.ref}` : 'live'}
            className={cn('rf-mission-control', big && 'rf-big', dimsEdges(view) && 'gx-dim-edges', matches !== null && 'gx-filtering', hasFocus(view) && 'gx-focus')}
            nodes={flow.nodes}
            edges={flow.edges}
            nodeTypes={NODE_TYPES}
            fitView
            fitViewOptions={FIT_VIEW_OPTIONS}
            minZoom={0.02}
            maxZoom={2}
            onlyRenderVisibleElements
            proOptions={PRO_OPTIONS}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            onPaneClick={onPaneClick}
            onInit={(instance) => {
              rfRef.current = instance;
            }}
          >
            <Background variant={'dots' as never} gap={20} size={1.2} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeStrokeWidth={0}
              nodeColor={miniMapColor}
              maskColor="rgba(0,0,0,0.35)"
            />
          </ReactFlow>
        </div>
        {selectedNode ? (
          <NodeDetailPanel
            node={selectedNode}
            kind={display.meta.get(selectedNode.id)?.kind ?? 'service'}
            dependencies={display.index.dependencies.get(selectedNode.id) ?? []}
            dependents={display.index.dependents.get(selectedNode.id) ?? []}
            status={live.byName.get(selectedNode.id)}
            onSelect={(id) => setUrl({ sel: id, to: '' })}
            onClose={clearSelection}
          />
        ) : null}
        </div>

        <GraphLegend diffMode={diffMode} checkedAt={live.checkedAt} />
      </div>

    </div>
  );
}

const DIFF_HEX = { added: '#2da44e', removed: '#cf222e', changed: '#bf8700', unchanged: '#64748b' } as const;

/** Module-level (stable identity) so the minimap does not re-render every rect on each state change. */
function miniMapColor(node: Node): string {
  const data = node.data as GraphNodeData | undefined;
  if (!data) return STATUS_HEX.unknown;
  if (data.diff) return DIFF_HEX[data.diff];
  return STATUS_HEX[data.status];
}

function GraphLegend({ diffMode, checkedAt }: { diffMode: boolean; checkedAt: string | null }): React.ReactElement {
  const dot = (color: string, label: string): React.ReactElement => (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block size-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
  const ring = (color: string, label: string, dashed = false): React.ReactElement => (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block size-3 rounded-sm"
        style={{ border: `2px ${dashed ? 'dashed' : 'solid'} ${color}` }}
      />
      {label}
    </span>
  );
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border px-5 py-2.5 text-xs text-muted-foreground"
      data-testid="graph-legend"
    >
      <span className="label-eyebrow normal-case">Status</span>
      {dot(STATUS_HEX.running, 'running')}
      {dot(STATUS_HEX.unhealthy, 'unhealthy')}
      {dot(STATUS_HEX.stopped, 'stopped')}
      {dot(STATUS_HEX.unknown, 'unknown')}
      <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
      {diffMode ? (
        <>
          {ring(DIFF_HEX.added, 'added')}
          {ring(DIFF_HEX.removed, 'removed', true)}
          {ring(DIFF_HEX.changed, 'changed')}
          {ring(DIFF_HEX.unchanged, 'unchanged context')}
        </>
      ) : (
        <>
          {ring('var(--signal)', 'selected')}
          {ring('var(--status-info)', 'upstream')}
          {ring('var(--status-warn)', 'downstream')}
          {ring('#c084fc', 'path')}
          {ring('var(--status-critical)', 'cycle', true)}
        </>
      )}
      {checkedAt ? <span className="ml-auto">status checked {new Date(checkedAt).toLocaleTimeString()}</span> : null}
    </div>
  );
}

function GraphStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
}): React.ReactElement {
  return (
    <span
      data-testid={`graph-stat-${label}`}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-1 px-2.5 py-1.5 shadow-elev-1"
    >
      <span className={cn('inline-flex items-center', tone)}>{icon}</span>
      <span className="font-mono text-sm font-semibold tabular-nums">{value}</span>
      {/* A real space between the two flex items (ignored by layout) so the badge reads "2 apps" to text queries and screen readers. */}{' '}
      <span className="label-eyebrow normal-case text-muted-foreground">{label}</span>
    </span>
  );
}
