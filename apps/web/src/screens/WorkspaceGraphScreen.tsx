import * as React from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CommandPreview,
  formatCommand,
} from '@umutkorkmaz/ui';
import { Boxes, Server } from 'lucide-react';
import { useEnvelopeQuery } from './shared/useEnvelopeQuery';
import { EmptyPanel, EnvelopeErrorPanel, ErrorPanel, LoadingPanel } from './shared/StatePanels';
import {
  workspaceGraphSchema,
  type KindedGraphNode,
  type WorkspaceGraph,
} from './shared/feedSchemas';
import { GraphNodeCard, type GraphNodeData } from './graph/GraphNodeCard';
import { GRAPH_COMMAND, NodeDetailDrawer } from './graph/NodeDetailDrawer';

const NODE_TYPES = { topology: GraphNodeCard } as const;

// Layered layout: apps on the top row, services beneath, columns evenly spaced.
const COLUMN_GAP = 260;
const APPS_ROW_Y = 40;
const SERVICES_ROW_Y = 260;

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

  return <GraphContent graph={data} />;
}

function GraphContent({ graph }: { graph: WorkspaceGraph }): React.ReactElement {
  const [selected, setSelected] = React.useState<KindedGraphNode | null>(null);

  // Normalize defensively: even though the schema fills defaults, collapse any
  // partial node into a well-formed shape so the layout/edge logic never throws
  // on unknown data.
  const kindedNodes = React.useMemo<KindedGraphNode[]>(() => {
    const normalize = (n: Partial<KindedGraphNode>, kind: 'app' | 'service'): KindedGraphNode => ({
      name: n.name ?? 'unknown',
      path: n.path ?? '',
      framework: n.framework ?? null,
      dependencies: Array.isArray(n.dependencies) ? n.dependencies : [],
      kind,
    });
    return [
      ...(graph.apps ?? []).map((n) => normalize(n, 'app')),
      ...(graph.services ?? []).map((n) => normalize(n, 'service')),
    ];
  }, [graph]);

  // Only names that are actual nodes are valid edge endpoints; ignore deps that
  // point at external (non-workspace) packages so unknown data never crashes.
  const knownNames = React.useMemo(() => new Set(kindedNodes.map((n) => n.name)), [kindedNodes]);

  const dependentsByName = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const node of kindedNodes) {
      for (const dep of node.dependencies) {
        if (!knownNames.has(dep)) continue;
        const list = map.get(dep) ?? [];
        list.push(node.name);
        map.set(dep, list);
      }
    }
    return map;
  }, [kindedNodes, knownNames]);

  const rfNodes = React.useMemo<Node<GraphNodeData>[]>(() => {
    const place = (nodes: KindedGraphNode[], y: number): Node<GraphNodeData>[] =>
      nodes.map((node, index) => ({
        id: node.name,
        type: 'topology',
        position: { x: index * COLUMN_GAP, y },
        data: {
          label: node.name,
          kind: node.kind,
          framework: node.framework,
          // The contract graph feed carries no live status; default to unknown
          // and color accordingly (kept in sync with TopologyNodeCard).
          status: 'unknown',
          onOpen: () => setSelected(node),
        },
      }));
    return [
      ...place(
        kindedNodes.filter((n) => n.kind === 'app'),
        APPS_ROW_Y
      ),
      ...place(
        kindedNodes.filter((n) => n.kind === 'service'),
        SERVICES_ROW_Y
      ),
    ];
  }, [kindedNodes]);

  const rfEdges = React.useMemo<Edge[]>(() => {
    const edges: Edge[] = [];
    for (const node of kindedNodes) {
      for (const dep of node.dependencies) {
        if (!knownNames.has(dep)) continue;
        edges.push({
          id: `${node.name}->${dep}`,
          source: node.name,
          target: dep,
          animated: false,
        });
      }
    }
    return edges;
  }, [kindedNodes, knownNames]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline" className="gap-1">
          <Boxes className="size-3" />
          {graph.apps.length} apps
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Server className="size-3" />
          {graph.services.length} services
        </Badge>
        <Badge variant="secondary">{rfEdges.length} dependencies</Badge>
        <span className="text-sm text-muted-foreground">Click a node for details.</span>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dependency graph</CardTitle>
          <CardDescription>Internal workspace-to-workspace edges from the --json feed.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[28rem] w-full rounded-md border" data-testid="graph-canvas">
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              nodeTypes={NODE_TYPES}
              fitView
              proOptions={{ hideAttribution: true }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
            >
              <Background />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        </CardContent>
      </Card>

      <NodeDetailDrawer
        node={selected}
        dependentsByName={dependentsByName}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
