import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Node } from '@xyflow/react';
import { WorkspaceGraphScreen } from './WorkspaceGraphScreen';
import type { GraphNodeData } from './graph/GraphNodeCard';
import type { WorkspaceGraph } from './shared/feedSchemas';

const useHubQueryMock = vi.fn();

vi.mock('@re-shell/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@re-shell/ui')>();
  return { ...actual, useHubQuery: (...args: unknown[]) => useHubQueryMock(...args) };
});

// React Flow needs real layout (ResizeObserver, element sizing) that jsdom lacks.
// Mock it to a deterministic surface that renders node labels, exposes the edge
// count, and lets a click invoke each node's `onOpen` so the drawer can open.
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, edges }: { nodes: Node<GraphNodeData>[]; edges: unknown[] }) => (
    <div data-testid="rf">
      <span data-testid="edge-count">{edges.length}</span>
      {nodes.map((node) => (
        <button key={node.id} type="button" onClick={() => node.data.onOpen()}>
          node:{node.data.label}
        </button>
      ))}
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom' },
}));

function queryState(over: Partial<ReturnType<typeof useHubQueryMock>>) {
  return { data: undefined, isLoading: false, error: null, refetch: vi.fn(), ...over };
}

const GRAPH: WorkspaceGraph = {
  apps: [
    { name: 'web', path: 'apps/web', framework: 'react-ts', dependencies: ['ui', 'external-pkg'] },
  ],
  services: [
    { name: 'ui', path: 'packages/ui', framework: 'react-ts', dependencies: ['contracts'] },
    { name: 'contracts', path: 'packages/contracts', framework: null, dependencies: [] },
  ],
};

describe('WorkspaceGraphScreen', () => {
  afterEach(() => {
    useHubQueryMock.mockReset();
    vi.restoreAllMocks();
  });

  it('renders a loading state', () => {
    useHubQueryMock.mockReturnValue(queryState({ isLoading: true }));
    render(<WorkspaceGraphScreen />);
    expect(screen.getByText(/Loading topology/i)).toBeInTheDocument();
  });

  it('renders a transport error', () => {
    useHubQueryMock.mockReturnValue(queryState({ error: new Error('socket reset') }));
    render(<WorkspaceGraphScreen />);
    expect(screen.getByText(/Could not reach the hub/i)).toBeInTheDocument();
    expect(screen.getByText(/socket reset/i)).toBeInTheDocument();
  });

  it('renders an empty topology state with a copy-CLI', () => {
    useHubQueryMock.mockReturnValue(
      queryState({ data: { ok: true, data: { apps: [], services: [] }, warnings: [] } })
    );
    render(<WorkspaceGraphScreen />);
    expect(screen.getByText(/Empty topology/i)).toBeInTheDocument();
    expect(screen.getByText(/workspace graph --json/)).toBeInTheDocument();
  });

  it('renders nodes and only internal edges (drops unknown dependency targets)', () => {
    useHubQueryMock.mockReturnValue(queryState({ data: { ok: true, data: GRAPH, warnings: [] } }));
    render(<WorkspaceGraphScreen />);
    expect(screen.getByText('node:web')).toBeInTheDocument();
    expect(screen.getByText('node:ui')).toBeInTheDocument();
    expect(screen.getByText('node:contracts')).toBeInTheDocument();
    // web→ui, web→external-pkg(dropped), ui→contracts => 2 internal edges.
    expect(screen.getByTestId('edge-count')).toHaveTextContent('2');
  });

  it('opens the node detail drawer on node click with metadata + copy-CLI', () => {
    useHubQueryMock.mockReturnValue(queryState({ data: { ok: true, data: GRAPH, warnings: [] } }));
    render(<WorkspaceGraphScreen />);
    fireEvent.click(screen.getByText('node:web'));
    expect(screen.getByText(/Depends on/i)).toBeInTheDocument();
    // The drawer lists the internal dependency `ui` but not the external one.
    expect(screen.getByText('apps/web')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy command/i })).toBeInTheDocument();
  });

  it('does not crash on partial/unknown node data', () => {
    const partial = {
      apps: [{ name: 'solo' }],
      services: [{ name: 'svc', dependencies: ['ghost'] }],
    };
    useHubQueryMock.mockReturnValue(queryState({ data: { ok: true, data: partial, warnings: [] } }));
    render(<WorkspaceGraphScreen />);
    expect(screen.getByText('node:solo')).toBeInTheDocument();
    expect(screen.getByText('node:svc')).toBeInTheDocument();
    expect(screen.getByTestId('edge-count')).toHaveTextContent('0');
  });
});
