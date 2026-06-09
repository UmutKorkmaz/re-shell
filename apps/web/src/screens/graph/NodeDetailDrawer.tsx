import * as React from 'react';
import {
  CommandPreview,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  cn,
  createReShellCommand,
  formatCommand,
} from '@re-shell/ui';
import { Boxes, Server } from 'lucide-react';
import type { KindedGraphNode } from '../shared/feedSchemas';

interface NodeDetailDrawerProps {
  node: KindedGraphNode | null;
  /** All node names, used to mark which dependency targets are also dependents. */
  dependentsByName: ReadonlyMap<string, readonly string[]>;
  onOpenChange: (open: boolean) => void;
}

const GRAPH_COMMAND = createReShellCommand(['workspace', 'graph'], { json: true });

/**
 * Sheet drawer with the metadata for a clicked topology node plus a copy-CLI
 * affordance. Renders gracefully when a node has no framework / no edges.
 */
export function NodeDetailDrawer({
  node,
  dependentsByName,
  onOpenChange,
}: NodeDetailDrawerProps): React.ReactElement {
  const Icon = node?.kind === 'app' ? Boxes : Server;
  const dependents = node ? (dependentsByName.get(node.name) ?? []) : [];

  return (
    <Sheet open={node !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
        {node ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-bg-0 text-signal">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 truncate font-mono tracking-tight">{node.name}</span>
              </SheetTitle>
              <SheetDescription className="re-shell-mono break-all">{node.path || '—'}</SheetDescription>
            </SheetHeader>

            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('status-badge', node.kind === 'app' ? 'status-info' : 'status-healthy')}>
                {node.kind === 'app' ? 'App' : 'Service'}
              </span>
              {node.framework ? (
                <span className="rounded-md border border-border bg-bg-2/60 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  {node.framework}
                </span>
              ) : null}
            </div>

            <Separator />

            <DepList
              title="Depends on"
              empty="No internal dependencies."
              names={node.dependencies}
            />
            <DepList title="Depended on by" empty="No internal dependents." names={dependents} />

            <Separator />

            <div className="space-y-2">
              <h3 className="font-display text-sm font-semibold tracking-tight">Inspect topology</h3>
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
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DepList({
  title,
  empty,
  names,
}: {
  title: string;
  empty: string;
  names: readonly string[];
}): React.ReactElement {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold tracking-tight">{title}</h3>
        <span className="text-xs text-muted-foreground">{names.length}</span>
      </div>
      {names.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {names.map((name) => (
            <li key={name} className="re-shell-mono truncate rounded-md border bg-muted/30 px-2 py-1 text-xs">
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Re-exported so the screen can render a non-interactive copy outside the drawer too. */
export { GRAPH_COMMAND };
