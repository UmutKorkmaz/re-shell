import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Badge } from '@umutkorkmaz/ui';
import { Boxes, Server } from 'lucide-react';
import type { WorkspaceNodeStatus } from '@umutkorkmaz/contracts';
import type { GraphNodeKind } from '../shared/feedSchemas';

/** Data carried on each React Flow node; status drives the accent color. */
export interface GraphNodeData extends Record<string, unknown> {
  label: string;
  kind: GraphNodeKind;
  framework: string | null;
  port?: number;
  status: WorkspaceNodeStatus;
  onOpen: () => void;
}

/**
 * Status → left-accent color, kept in lockstep with `TopologyNodeCard`'s
 * Badge variants so the canvas reads as part of the same design system.
 */
const STATUS_ACCENT: Record<WorkspaceNodeStatus, string> = {
  running: 'border-l-green-500',
  error: 'border-l-destructive',
  stopped: 'border-l-muted-foreground',
  unknown: 'border-l-border',
};

const STATUS_BADGE: Record<
  WorkspaceNodeStatus,
  'success' | 'destructive' | 'secondary' | 'outline'
> = {
  running: 'success',
  error: 'destructive',
  stopped: 'secondary',
  unknown: 'outline',
};

/** A topology node rendered inside the React Flow canvas. */
export function GraphNodeCard({ data }: NodeProps): React.ReactElement {
  const node = data as GraphNodeData;
  const Icon = node.kind === 'app' ? Boxes : Server;
  return (
    <button
      type="button"
      onClick={node.onOpen}
      className={`w-56 rounded-md border border-l-4 ${STATUS_ACCENT[node.status]} bg-card p-3 text-left shadow-sm transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring`}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded bg-muted p-1.5">
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 truncate text-sm font-medium">{node.label}</span>
        </div>
        <Badge variant={STATUS_BADGE[node.status]} className="shrink-0 capitalize">
          {node.status}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge variant="outline" className="capitalize">
          {node.kind}
        </Badge>
        {node.framework ? <Badge variant="secondary">{node.framework}</Badge> : null}
        {node.port ? <Badge variant="outline">:{node.port}</Badge> : null}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </button>
  );
}
