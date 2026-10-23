import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogFeed } from './shared/feedSchemas';
import { CatalogScreen } from './CatalogScreen';

const useHubQueryMock = vi.fn();
const writeTextMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@re-shell/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@re-shell/ui')>();
  return { ...actual, useHubQuery: (...args: unknown[]) => useHubQueryMock(...args) };
});

function queryState(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, error: null, refetch: vi.fn(), ...overrides };
}

const CATALOG: CatalogFeed = {
  system: 'shop', dryRun: true,
  counts: { components: 2, apis: 1, resources: 0, groups: 0, systems: 1 },
  entities: [
    { kind: 'Component', metadata: { name: 'shop-api', description: 'Checkout service', tags: ['typescript', 'payments'] }, spec: { type: 'service', owner: 'payments-team' } },
    { kind: 'API', metadata: { name: 'shop-http', tags: ['rest'] }, spec: { type: 'openapi' } },
    { kind: 'Component', metadata: { name: 'shop-worker', tags: [] }, spec: {} },
    { kind: 'Deployment', metadata: { name: 'shop-cluster', tags: [] }, spec: {} },
  ],
  warnings: ['shop-worker has no owner', 'shop-cluster uses a custom entity kind'],
};

describe('CatalogScreen', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
  });

  afterEach(() => {
    useHubQueryMock.mockReset();
    writeTextMock.mockClear();
    vi.restoreAllMocks();
  });

  it('shows discovery progress before catalog data arrives', () => {
    useHubQueryMock.mockReturnValue(queryState({ isLoading: true }));
    render(<CatalogScreen />);
    expect(screen.getByText('Discovering catalog…')).toBeInTheDocument();
    expect(screen.queryByText('No catalog data')).not.toBeInTheDocument();
  });

  it('offers a real retry after a hub transport failure', () => {
    const refetch = vi.fn();
    useHubQueryMock.mockReturnValue(queryState({ error: new Error('socket reset'), refetch }));
    render(<CatalogScreen />);
    expect(screen.getByText('Could not reach the hub')).toBeInTheDocument();
    expect(screen.getByText('socket reset')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows workspace initialization guidance and a runnable command for a CLI refusal', () => {
    useHubQueryMock.mockReturnValue(queryState({ data: {
      ok: false, error: { code: 'WORKSPACE_NOT_FOUND', message: 'No workspace configured' }, warnings: [],
    } }));
    render(<CatalogScreen />);
    expect(screen.getByText(/WORKSPACE_NOT_FOUND/)).toBeInTheDocument();
    expect(screen.getByText('No workspace configured')).toBeInTheDocument();
    expect(screen.getByText(/Initialize a workspace with services/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /copy command/i }));
    expect(writeTextMock).toHaveBeenCalledWith('re-shell catalog --json');
  });

  it('keeps an absent response distinct from a discovered empty catalog and allows retry', () => {
    const refetch = vi.fn();
    useHubQueryMock.mockReturnValue(queryState({ refetch }));
    render(<CatalogScreen />);
    expect(screen.getByText('No catalog data')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('groups discovered entities by kind, preserves optional metadata, and reports catalog warnings', () => {
    useHubQueryMock.mockReturnValue(queryState({ data: { ok: true, data: CATALOG, warnings: [] } }));
    render(<CatalogScreen />);
    expect(screen.getByText('shop')).toBeInTheDocument();
    expect(screen.getByText('4 entities discovered')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent?.replace(/\s/g, '')))
      .toEqual(['API1', 'Component2', 'Deployment1', 'Warnings']);

    const service = within(screen.getByText('shop-api').closest('li')!);
    expect(service.getByText('Checkout service')).toBeInTheDocument();
    expect(service.getByText('owner: payments-team')).toBeInTheDocument();
    expect(service.getByText('service')).toBeInTheDocument();
    expect(service.getByText('typescript')).toBeInTheDocument();
    expect(service.getByText('payments')).toBeInTheDocument();
    expect(within(screen.getByText('shop-worker').closest('li')!).queryByText(/owner:/)).not.toBeInTheDocument();
    expect(screen.getByText('shop-cluster')).toBeInTheDocument();
    for (const warning of CATALOG.warnings) expect(screen.getByText(warning)).toBeInTheDocument();
  });

  it('renders a valid empty catalog without inventing entities or warnings', () => {
    useHubQueryMock.mockReturnValue(queryState({ data: { ok: true, data: { ...CATALOG, entities: [], warnings: [], counts: { components: 0, apis: 0, resources: 0, groups: 0, systems: 0 } }, warnings: [] } }));
    render(<CatalogScreen />);
    expect(screen.getByText('0 entities discovered')).toBeInTheDocument();
    expect(screen.getByText('Components').nextElementSibling).toHaveTextContent('0');
    expect(screen.getByText('APIs').nextElementSibling).toHaveTextContent('0');
    expect(screen.queryByRole('heading', { name: 'Warnings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy command/i })).toBeInTheDocument();
  });
});
