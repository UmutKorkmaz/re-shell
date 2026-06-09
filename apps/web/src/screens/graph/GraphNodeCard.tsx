import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@re-shell/ui';
import { Boxes, Server } from 'lucide-react';
import type { WorkspaceNodeStatus } from '@re-shell/contracts';
import type { GraphNodeKind } from '../shared/feedSchemas';

/** Data carried on each React Flow node; status drives the accent glow. */
export interface GraphNodeData extends Record<string, unknown> {
  label: string;
  kind: GraphNodeKind;
  framework: string | null;
  port?: number;
  status: WorkspaceNodeStatus;
  onOpen: () => void;
}

/**
 * Status → glow ring + dot color, kept in lockstep with the design-system
 * status palette so the canvas reads as part of the same surface stack.
 */
const STATUS_STYLE: Record<WorkspaceNodeStatus, { dot: string; text: string; glow: string }> = {
  running: { dot: 'bg-healthy', text: 'text-healthy', glow: 'shadow-glow-healthy' },
  error: { dot: 'bg-critical', text: 'text-critical', glow: 'shadow-glow-critical' },
  stopped: { dot: 'bg-muted-foreground', text: 'text-muted-foreground', glow: '' },
  unknown: { dot: 'bg-muted-foreground/60', text: 'text-muted-foreground', glow: '' },
};

/** A topology node rendered inside the React Flow canvas. */
export function GraphNodeCard({ data, selected }: NodeProps): React.ReactElement {
  const node = data as GraphNodeData;
  const Icon = node.kind === 'app' ? Boxes : Server;
  const style = STATUS_STYLE[node.status];

  return (
    <button
      type="button"
      onClick={node.onOpen}
      className={cn(
        'group w-56 rounded-lg border bg-bg-1 p-3 text-left outline-none transition-all duration-fast',
        'hover:-translate-y-0.5 hover:border-border-strong hover:shadow-elev-2 focus-visible:shadow-focus-ring',
        style.glow,
        selected ? 'border-signal shadow-glow-signal' : 'border-border shadow-elev-1'
      )}
    >
      <Handle type="target" position={Position.Top} className="!size-1.5 !border-0 !bg-border-strong" />

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-bg-0 text-signal">
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 truncate font-mono text-sm font-medium tracking-tight">{node.label}</span>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
          <span className={cn('size-2 rounded-full', style.dot)} aria-hidden />
          <span className={cn('font-display text-[0.625rem] font-semibold uppercase tracking-[0.06em]', style.text)}>
            {node.status}
          </span>
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="label-eyebrow rounded border border-border bg-bg-2/60 px-1.5 py-0.5 normal-case">
          {node.kind}
        </span>
        {node.framework ? (
          <span className="rounded border border-border bg-bg-2/60 px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">
            {node.framework}
          </span>
        ) : null}
        {node.port ? (
          <span className="rounded border border-border bg-bg-2/60 px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">
            :{node.port}
          </span>
        ) : null}
      </div>

      <Handle type="source" position={Position.Bottom} className="!size-1.5 !border-0 !bg-border-strong" />
    </button>
  );
}
