import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthScreen } from './HealthScreen';
import type { HealthFeed } from './shared/summaryFeed';

const useHubQueryMock = vi.fn();

vi.mock('re-shell-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('re-shell-ui')>();
  return { ...actual, useHubQuery: (...args: unknown[]) => useHubQueryMock(...args) };
});

function queryState(over: Partial<ReturnType<typeof useHubQueryMock>>) {
  return { data: undefined, isLoading: false, error: null, refetch: vi.fn(), ...over };
}

// The CLI wire shape (`workspace health --json` → canonical health), which the
// Health screen validates against and adapts to the contract shape.
const HEALTH: HealthFeed = {
  score: 55,
  status: 'critical',
  checks: [
    { name: 'Broken symlink', status: 'critical', message: 'apps/web/node_modules missing' },
    { name: 'Stale cache', status: 'warning', message: 'Turbo cache is old' },
    { name: 'Lockfile present', status: 'healthy', message: 'pnpm-lock.yaml found' },
  ],
};

describe('HealthScreen', () => {
  afterEach(() => {
    useHubQueryMock.mockReset();
    vi.restoreAllMocks();
  });

  it('renders a loading state', () => {
    useHubQueryMock.mockReturnValue(queryState({ isLoading: true }));
    render(<HealthScreen />);
    expect(screen.getByText(/Running health checks/i)).toBeInTheDocument();
  });

  it('renders a transport error', () => {
    useHubQueryMock.mockReturnValue(queryState({ error: new Error('socket reset') }));
    render(<HealthScreen />);
    expect(screen.getByText(/Could not reach the hub/i)).toBeInTheDocument();
    expect(screen.getByText(/socket reset/i)).toBeInTheDocument();
  });

  it('surfaces WORKSPACE_NOT_FOUND on the no-config path with copy-CLI', () => {
    useHubQueryMock.mockReturnValue(
      queryState({
        data: {
          ok: false,
          error: { code: 'WORKSPACE_NOT_FOUND', message: 'No workspace configured' },
          warnings: [],
        },
      })
    );
    render(<HealthScreen />);
    expect(screen.getByText(/No workspace configured/i)).toBeInTheDocument();
    expect(screen.getByText(/WORKSPACE_NOT_FOUND/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy command/i })).toBeInTheDocument();
  });

  it('renders grouped checks (errors, warnings, info/pass) and the copy-CLI', () => {
    useHubQueryMock.mockReturnValue(
      queryState({ data: { ok: true, data: HEALTH, warnings: [] } })
    );
    render(<HealthScreen />);

    // Titles also appear in the HealthStatus summary card, so assert presence
    // (>=1) rather than uniqueness.
    expect(screen.getAllByText('Broken symlink').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Stale cache').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Lockfile present').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/workspace health --json/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy command/i })).toBeInTheDocument();
  });
});
