import * as React from 'react';
import { CommandPreview, Separator, cn, createReShellCommand, formatCommand } from '@re-shell/ui';
import { Boxes, Server, X } from 'lucide-react';
import type { GraphModelNode, WorkspaceStatusEntry } from '@re-shell/contracts';
import type { GraphNodeKind } from '../shared/feedSchemas';

export const GRAPH_COMMAND = createReShellCommand(['workspace', 'graph'], { json: true });

interface NodeDetailPanelProps {
  node: GraphModelNode;
  kind: GraphNodeKind;
  /** Internal dependencies (what this node depends on). */
  dependencies: readonly string[];
  /** Internal dependents (what depends on this node). */
  dependents: readonly string[];
  /** Live status of the node (from `workspace.status`), when available. */
  status?: WorkspaceStatusEntry;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/**
 * Non-modal details panel for the selected node. It overlays the right edge of
 * the canvas (not a modal sheet, and it does not resize the canvas) so the
 * dependency highlighting stays visible while you read it and you can keep
 * clicking through the graph.
 */
export function NodeDetailPanel({
  node,
  kind,
  dependencies,
  dependents,
  status,
  onSelect,
  onClose,
}: NodeDetailPanelProps): React.ReactElement {
  const Icon = kind === 'app' ? Boxes : Server;

  return (
    <aside
      className="absolute inset-y-0 right-0 z-10 flex w-[min(21rem,100%)] flex-col gap-4 overflow-y-auto border-l border-border bg-bg-1/95 p-4 shadow-elev-3 backdrop-blur-sm"
      data-testid="graph-node-panel"
      aria-label={`Details for ${node.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-bg-0 text-signal">
            <Icon className="size-4" />
          </span>
          <h3 className="min-w-0 truncate font-mono text-sm font-semibold tracking-tight">{node.id}</h3>
        </div>
        <button
          type="button"
          aria-label="Close details"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-bg-2 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="re-shell-mono break-all text-xs text-muted-foreground">{node.path || '—'}</p>

      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('status-badge', kind === 'app' ? 'status-info' : 'status-healthy')}>
          {kind === 'app' ? 'App' : 'Service'}
        </span>
        {[node.type, node.framework, node.language].filter(Boolean).map((value) => (
          <span key={value} className="rounded-md border border-border bg-bg-2/60 px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {value}
          </span>
        ))}
      </div>

      <div className="space-y-1" data-testid="node-live-status">
        <h4 className="font-display text-sm font-semibold tracking-tight">Live status</h4>
        {status ? (
          <>
            <p className="text-sm">
              <span className="font-semibold">{status.status}</span>
              <span className="text-muted-foreground"> · {status.reason}</span>
            </p>
            {status.checks.length > 1 ? (
              <ul className="space-y-0.5">
                {status.checks.map((check) => (
                  <li key={check.name} className="re-shell-mono truncate text-xs text-muted-foreground">
                    {check.name}: {check.status} · {check.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No live status reported for this node.</p>
        )}
      </div>

      <Separator />

      <DepList title="Depends on" empty="No internal dependencies." names={dependencies} onSelect={onSelect} />
      <DepList title="Depended on by" empty="No internal dependents." names={dependents} onSelect={onSelect} />

      <Separator />

      <div className="space-y-2">
        <h4 className="font-display text-sm font-semibold tracking-tight">Inspect topology</h4>
        <CommandPreview
          spec={{
            title: 'Workspace graph',
            description: 'Print the full dependency graph as JSON.',
            command: GRAPH_COMMAND,
            commandText: formatCommand(GRAPH_COMMAND),
            destructive: false,
            dryRunSupported: false,
          }}
        />
      </div>
    </aside>
  );
}

function DepList({
  title,
  empty,
  names,
  onSelect,
}: {
  title: string;
  empty: string;
  names: readonly string[];
  onSelect: (id: string) => void;
}): React.ReactElement {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-sm font-semibold tracking-tight">{title}</h4>
        <span className="text-xs text-muted-foreground">{names.length}</span>
      </div>
      {names.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {names.map((name) => (
            <li key={name}>
              <button
                type="button"
                onClick={() => onSelect(name)}
                className="re-shell-mono w-full truncate rounded-md border bg-muted/30 px-2 py-1 text-left text-xs hover:border-border-strong"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
