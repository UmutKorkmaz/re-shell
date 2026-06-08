import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverviewScreen } from './OverviewScreen';
import type { SummaryFeed } from './shared/summaryFeed';

const useHubQueryMock = vi.fn();

// Mock only the transport hook; keep the real components and lib helpers so the
// CommandPreview / WorkspaceSummaryPanel render exactly as in production.
vi.mock('re-shell-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('re-shell-ui')>();
  return { ...actual, useHubQuery: (...args: unknown[]) => useHubQueryMock(...args) };
});

function queryState(over: Partial<ReturnType<typeof useHubQueryMock>>) {
  return { data: undefined, isLoading: false, error: null, refetch: vi.fn(), ...over };
}

// The CLI wire shape (what `workspace summary --json` actually prints), which
// the Overview screen validates against and adapts to the contract shape.
const SUMMARY: SummaryFeed = {
  root: '/tmp/demo-workspace',
  packageManager: 'pnpm',
  workspaces: [
    {
      name: 'web',
      path: 'apps/web',
      type: 'app',
      framework: 'react-ts',
      version: '1.0.0',
      dependencies: [],
    },
  ],
  health: {
    score: 70,
    status: 'degraded',
    checks: [
      { name: 'Missing lockfile', status: 'critical', message: 'No lockfile found' },
      { name: 'Outdated deps', status: 'warning', message: 'Several deps are stale' },
    ],
  },
};

describe('OverviewScreen', () => {
  afterEach(() => {
    useHubQueryMock.mockReset();
    vi.restoreAllMocks();
  });

  it('renders a loading state', () => {
    useHubQueryMock.mockReturnValue(queryState({ isLoading: true }));
    render(<OverviewScreen onNavigate={vi.fn()} />);
    expect(screen.getByText(/Loading workspace/i)).toBeInTheDocument();
  });

  it('renders a transport error with a retry affordance', () => {
    useHubQueryMock.mockReturnValue(queryState({ error: new Error('hub offline') }));
    render(<OverviewScreen onNavigate={vi.fn()} />);
    expect(screen.getByText(/Could not reach the hub/i)).toBeInTheDocument();
    expect(screen.getByText(/hub offline/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders the WORKSPACE_NOT_FOUND envelope error (not blank)', () => {
    useHubQueryMock.mockReturnValue(
      queryState({
        data: {
          ok: false,
          error: { code: 'WORKSPACE_NOT_FOUND', message: 'No workspace here' },
          warnings: [],
        },
      })
    );
    render(<OverviewScreen onNavigate={vi.fn()} />);
    expect(screen.getByText(/No workspace here/i)).toBeInTheDocument();
    expect(screen.getByText(/WORKSPACE_NOT_FOUND/)).toBeInTheDocument();
  });

  it('renders workspace data with failing checks and copy affordances', () => {
    useHubQueryMock.mockReturnValue(
      queryState({ data: { ok: true, data: SUMMARY, warnings: [] } })
    );
    render(<OverviewScreen onNavigate={vi.fn()} />);

    expect(screen.getByText('demo-workspace')).toBeInTheDocument();
    expect(screen.getByText('Missing lockfile')).toBeInTheDocument();
    // Every primary action exposes a copy-command button.
    expect(screen.getAllByRole('button', { name: /copy command/i }).length).toBeGreaterThanOrEqual(4);
  });
});
