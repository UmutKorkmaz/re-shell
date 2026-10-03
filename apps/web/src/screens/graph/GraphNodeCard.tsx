import * as React from 'react';
import { Handle, Position, useStore, type NodeProps, type ReactFlowState } from '@xyflow/react';
import { cn } from '@re-shell/ui';
import { Boxes, Server } from 'lucide-react';
import type { WorkspaceLiveStatus } from '@re-shell/contracts';
import type { GraphNodeKind } from '../shared/feedSchemas';

/** How a node relates to the current selection / path. */
export type GraphNodeHighlight = 'none' | 'selected' | 'upstream' | 'downstream' | 'path' | 'path-end';

/** Diff state when the canvas is showing a graph diff. */
export type GraphNodeDiff = 'added' | 'removed' | 'changed' | 'unchanged';

/** Live statuses, plus `error` kept as a legacy alias that renders like `unhealthy`. */
export type GraphNodeStatus = WorkspaceLiveStatus | 'error';

/** Modifier keys of the click that activated a node (shift/ctrl/meta = pick as path target). */
export interface ActivateEvent {
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
}

/** Data carried on each React Flow node; status drives the accent glow. */
export interface GraphNodeData extends Record<string, unknown> {
  label: string;
  kind: GraphNodeKind;
  framework: string | null;
  language?: string;
  port?: number;
  status: GraphNodeStatus;
  /** Why the status is what it is (tooltip). */
  statusReason?: string;
  /** Matches the active search/facet filters (only set while a filter is active). */
  match?: boolean;
  highlight?: GraphNodeHighlight;
  /** On a dependency cycle (and cycle highlighting is on). */
  cycle?: boolean;
  diff?: GraphNodeDiff;
  /** Smaller card for big graphs (keeps 2000+ nodes cheap to paint). */
  compact?: boolean;
  /** Activate the node: select it and show its details (modifier-click picks a path target). Stable per node id. */
  onOpen: (event?: ActivateEvent) => void;
}

/**
 * Status -> dot/text/glow classes, kept in lockstep with the design-system
 * status palette so the canvas reads as part of the same surface stack.
 */
export const STATUS_STYLE: Record<GraphNodeStatus, { dot: string; text: string; glow: string }> = {
  running: { dot: 'bg-healthy', text: 'text-healthy', glow: 'shadow-glow-healthy' },
  unhealthy: { dot: 'bg-critical', text: 'text-critical', glow: 'shadow-glow-critical' },
  error: { dot: 'bg-critical', text: 'text-critical', glow: 'shadow-glow-critical' },
  stopped: { dot: 'bg-muted-foreground', text: 'text-muted-foreground', glow: '' },
  unknown: { dot: 'bg-muted-foreground/60', text: 'text-muted-foreground', glow: '' },
};

/** Hex colors for exports and the minimap (CSS variables do not reach canvas/SVG renderers). */
export const STATUS_HEX: Record<GraphNodeStatus, string> = {
  error: '#ef4444',
  running: '#22c55e',
  unhealthy: '#ef4444',
  stopped: '#94a3b8',
  unknown: '#64748b',
};

/** Below this zoom a compact card is drawn as a plain coloured block: text is unreadable anyway and 2000 of them stay cheap. */
const LOW_DETAIL_ZOOM = 0.4;
const selectLowDetail = (state: ReactFlowState): boolean => state.transform[2] < LOW_DETAIL_ZOOM;

function GraphNodeCardImpl({ data, selected }: NodeProps): React.ReactElement {
  const node = data as GraphNodeData;
  // The selector returns a boolean, so zooming re-renders cards only when the threshold is crossed.
  const lowDetail = useStore(selectLowDetail);
  const Icon = node.kind === 'app' ? Boxes : Server;
  const style = STATUS_STYLE[node.status];
  const compact = node.compact === true;

  if (compact && lowDetail) {
    return (
      <button
        type="button"
        onClick={(event) => node.onOpen(event)}
        data-testid="graph-node"
        data-node-id={node.label}
        data-status={node.status}
        data-highlight={node.highlight ?? 'none'}
        data-match={node.match ? 'true' : undefined}
        data-diff={node.diff}
        data-lod="low"
        aria-label={node.label}
        className={cn(
          'gn gn-lod block h-8 w-44 rounded border border-border',
          style.dot,
          node.match && 'gn-match',
          node.cycle && 'gn-cycle',
          node.highlight && node.highlight !== 'none' && `gn-${node.highlight}`,
          node.diff && `gn-diff-${node.diff}`,
          selected && 'gn-selected'
        )}
      >
        <Handle type="target" position={Position.Top} className="!size-1 !border-0 !bg-border-strong" />
        <Handle type="source" position={Position.Bottom} className="!size-1 !border-0 !bg-border-strong" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => node.onOpen(event)}
      data-testid="graph-node"
      data-node-id={node.label}
      data-status={node.status}
      data-highlight={node.highlight ?? 'none'}
      data-match={node.match ? 'true' : undefined}
      data-diff={node.diff}
      title={node.statusReason ? `${node.label}: ${node.status} (${node.statusReason})` : node.label}
      className={cn(
        'gn group rounded-lg border bg-bg-1 text-left outline-none',
        compact ? 'w-44 px-2 py-1.5' : 'w-56 p-3',
        'hover:border-border-strong focus-visible:shadow-focus-ring',
        !node.diff && style.glow,
        selected ? 'border-signal shadow-glow-signal' : 'border-border shadow-elev-1',
        node.match && 'gn-match',
        node.cycle && 'gn-cycle',
        node.highlight && node.highlight !== 'none' && `gn-${node.highlight}`,
        node.diff && `gn-diff-${node.diff}`
      )}
    >
      <Handle type="target" position={Position.Top} className="!size-1.5 !border-0 !bg-border-strong" />

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'grid shrink-0 place-items-center rounded-md border border-border bg-bg-0 text-signal',
              compact ? 'size-5' : 'size-7'
            )}
          >
            <Icon className={compact ? 'size-3' : 'size-4'} />
          </span>
          <span className={cn('min-w-0 truncate font-mono font-medium tracking-tight', compact ? 'text-xs' : 'text-sm')}>
            {node.label}
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
          <span className={cn('size-2 rounded-full', style.dot)} aria-hidden />
          {compact ? null : (
            <span className={cn('font-display text-[0.625rem] font-semibold uppercase tracking-[0.06em]', style.text)}>
              {node.status}
            </span>
          )}
        </span>
      </div>

      {compact ? null : (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="label-eyebrow rounded border border-border bg-bg-2/60 px-1.5 py-0.5 normal-case">{node.kind}</span>
          {node.framework ? (
            <span className="rounded border border-border bg-bg-2/60 px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">
              {node.framework}
            </span>
          ) : null}
          {node.language ? (
            <span className="rounded border border-border bg-bg-2/60 px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">
              {node.language}
            </span>
          ) : null}
          {node.port ? (
            <span className="rounded border border-border bg-bg-2/60 px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">
              :{node.port}
            </span>
          ) : null}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!size-1.5 !border-0 !bg-border-strong" />
    </button>
  );
}

/** A topology node rendered inside the React Flow canvas. Memoized: re-renders only when its data changes. */
export const GraphNodeCard = React.memo(GraphNodeCardImpl);
