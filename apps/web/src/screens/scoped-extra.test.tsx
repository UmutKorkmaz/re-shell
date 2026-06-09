import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReactFlowProvider, type NodeProps } from '@xyflow/react';

import { GraphNodeCard, type GraphNodeData } from './graph/GraphNodeCard';
import { ConfirmModal } from './shared/ConfirmModal';
import { PlaceholderScreen } from './PlaceholderScreen';
import { TemplateDetailDrawer } from './templates/TemplateDetailDrawer';
import { useEnvelopeQuery } from './shared/useEnvelopeQuery';
import { useUrlState } from './shared/useUrlState';
import { templateFeedSchema, type TemplateFeed } from './shared/feedSchemas';
import { TemplateCard } from './templates/TemplateCard';
import { act, renderHook } from '@testing-library/react';

// useHubQuery is the seam the screens mock; do the same for the shared helper.
const useHubQueryMock = vi.fn();
vi.mock('@re-shell/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@re-shell/ui')>();
  return { ...actual, useHubQuery: (...args: unknown[]) => useHubQueryMock(...args) };
});

function queryState(over: Record<string, unknown>) {
  return { data: undefined, isLoading: false, error: null, refetch: vi.fn(), ...over };
}

const template: TemplateFeed = {
  id: 'express',
  name: 'express',
  displayName: 'Express.js',
  description: 'Minimalist web framework',
  language: 'typescript',
  framework: 'express',
  version: '4.19.2',
  tags: ['nodejs', 'rest'],
  features: ['routing'],
  port: 3000,
  fileCount: 27,
};

afterEach(() => {
  useHubQueryMock.mockReset();
  vi.restoreAllMocks();
});

describe('GraphNodeCard', () => {
  function makeData(over: Partial<GraphNodeData> = {}): GraphNodeData {
    return {
      label: 'web',
      kind: 'app',
      framework: 'react',
      port: 3000,
      status: 'running',
      onOpen: vi.fn(),
      ...over,
    };
  }

  const renderNode = (data: GraphNodeData) =>
    render(
      <ReactFlowProvider>
        <GraphNodeCard {...({ data } as unknown as NodeProps)} />
      </ReactFlowProvider>
    );

  it('renders an app node and fires onOpen on click', () => {
    const onOpen = vi.fn();
    renderNode(makeData({ onOpen }));
    expect(screen.getByText('web')).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText(':3000')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalled();
  });

  it('renders a service node with error status and no framework/port', () => {
    renderNode(
      makeData({ kind: 'service', framework: null, port: undefined, status: 'error', label: 'api' })
    );
    expect(screen.getByText('api')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.queryByText(':3000')).not.toBeInTheDocument();
  });
});

describe('ConfirmModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmModal open={false} title="Delete" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('echoes the command and fires confirm/cancel', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmModal
        open
        title="Remove workspace"
        description="This cannot be undone."
        commandText="re-shell remove web"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByText('re-shell remove web')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Confirm and run/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it('cancels on Escape and detaches the listener on close', () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <ConfirmModal open title="X" onConfirm={vi.fn()} onCancel={onCancel} />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Non-escape keys are ignored.
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Closing removes the listener so further Escapes do nothing.
    rerender(<ConfirmModal open={false} title="X" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('PlaceholderScreen', () => {
  it('renders the screen label and description', () => {
    render(
      <PlaceholderScreen
        screen={{ id: 'jobs', label: 'Jobs & Logs', description: 'Live job output.' }}
      />
    );
    expect(screen.getByText('Jobs & Logs')).toBeInTheDocument();
    expect(screen.getByText('Live job output.')).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });
});

describe('TemplateDetailDrawer', () => {
  it('renders nothing visible when no template is selected', () => {
    useHubQueryMock.mockReturnValue(queryState({}));
    render(<TemplateDetailDrawer template={null} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('Express.js')).not.toBeInTheDocument();
  });

  it('shows the freshly-fetched record when templates.show succeeds', () => {
    const fresh: TemplateFeed = { ...template, displayName: 'Express (live)', tags: ['nodejs'], features: ['routing', 'mw'] };
    useHubQueryMock.mockReturnValue(queryState({ data: { ok: true, data: fresh, warnings: [] } }));
    render(<TemplateDetailDrawer template={template} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Express (live)')).toBeInTheDocument();
    expect(screen.getByText('mw')).toBeInTheDocument();
    expect(screen.getByText(/re-shell create express/)).toBeInTheDocument();
  });

  it('falls back to the list row and surfaces an envelope error code', () => {
    useHubQueryMock.mockReturnValue(
      queryState({ data: { ok: false, error: { code: 'TEMPLATE_NOT_FOUND', message: 'gone' }, warnings: [] } })
    );
    render(<TemplateDetailDrawer template={template} onOpenChange={vi.fn()} />);
    expect(screen.getByText('Express.js')).toBeInTheDocument();
    expect(screen.getByText(/TEMPLATE_NOT_FOUND/)).toBeInTheDocument();
  });

  it('shows a loading spinner and the list row while templates.show is in flight', () => {
    useHubQueryMock.mockReturnValue(queryState({ isLoading: true }));
    render(
      <TemplateDetailDrawer
        template={{ ...template, tags: [], features: [] }}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByText('Express.js')).toBeInTheDocument();
    expect(screen.getByText('No tags.')).toBeInTheDocument();
    expect(screen.getByText('No features listed.')).toBeInTheDocument();
  });
});

describe('useEnvelopeQuery', () => {
  it('returns loading + null data before a response arrives', () => {
    useHubQueryMock.mockReturnValue(queryState({ isLoading: true }));
    const { result } = renderHook(() => useEnvelopeQuery('templates.show', templateFeedSchema, { id: 'x' }));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.envelopeError).toBeNull();
  });

  it('unwraps a success envelope into data + warnings', () => {
    const refetch = vi.fn();
    useHubQueryMock.mockReturnValue(
      queryState({ data: { ok: true, data: template, warnings: ['heads up'] }, refetch })
    );
    const { result } = renderHook(() => useEnvelopeQuery('templates.show', templateFeedSchema));
    expect(result.current.data?.id).toBe('express');
    expect(result.current.warnings).toEqual(['heads up']);
    expect(result.current.error).toBeNull();
    result.current.refetch();
    expect(refetch).toHaveBeenCalled();
  });

  it('surfaces an ok:false envelope as a typed envelopeError', () => {
    const refetch = vi.fn();
    useHubQueryMock.mockReturnValue(
      queryState({ data: { ok: false, error: { code: 'TEMPLATE_NOT_FOUND', message: 'gone' }, warnings: [] }, refetch })
    );
    const { result } = renderHook(() => useEnvelopeQuery('templates.show', templateFeedSchema));
    expect(result.current.envelopeError).toEqual({ code: 'TEMPLATE_NOT_FOUND', message: 'gone' });
    expect(result.current.data).toBeNull();
    result.current.refetch();
    expect(refetch).toHaveBeenCalled();
  });

  it('passes a transport error through and exposes refetch', () => {
    const refetch = vi.fn();
    useHubQueryMock.mockReturnValue(queryState({ error: new Error('boom'), refetch }));
    const { result } = renderHook(() => useEnvelopeQuery('templates.show', templateFeedSchema));
    expect(result.current.error?.message).toBe('boom');
    result.current.refetch();
    expect(refetch).toHaveBeenCalled();
  });
});

describe('TemplateCard', () => {
  it('fires onShowDetails from both Select and View details', () => {
    const onShowDetails = vi.fn();
    render(<TemplateCard template={template} onShowDetails={onShowDetails} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    fireEvent.click(screen.getByRole('button', { name: /View details/ }));
    expect(onShowDetails).toHaveBeenCalledTimes(2);
    expect(onShowDetails).toHaveBeenCalledWith(template);
  });

  it('toggles the dry-run flag in the scaffold command', () => {
    render(<TemplateCard template={template} onShowDetails={vi.fn()} />);
    const scaffold = within(screen.getByTestId('scaffold-express'));
    expect(scaffold.queryByText(/--dry-run/)).not.toBeInTheDocument();
    fireEvent.click(scaffold.getByRole('button', { name: 'Dry run' }));
    expect(scaffold.getByText(/--dry-run/)).toBeInTheDocument();
  });
});

describe('useUrlState', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('reads keys from the URL with empty fallbacks', () => {
    window.history.replaceState(null, '', '/?language=ts');
    const { result } = renderHook(() => useUrlState(['language', 'framework']));
    expect(result.current[0]).toEqual({ language: 'ts', framework: '' });
  });

  it('writes values to the URL and clears empties', () => {
    const { result } = renderHook(() => useUrlState(['language', 'framework']));
    act(() => result.current[1]({ language: 'python' }));
    expect(window.location.search).toContain('language=python');
    act(() => result.current[1]({ language: '' }));
    expect(window.location.search).not.toContain('language=');
  });

  it('re-reads state on a popstate event', () => {
    const { result } = renderHook(() => useUrlState(['language']));
    window.history.replaceState(null, '', '/?language=go');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current[0].language).toBe('go');
  });
});
