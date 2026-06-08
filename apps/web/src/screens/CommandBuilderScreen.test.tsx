import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandBuilderScreen } from './CommandBuilderScreen';
import { SettingsProvider } from '../settings/useSettings';
import type { CommandCatalog } from './shared/commandCatalog';

const useHubQueryMock = vi.fn();
const useJobMock = vi.fn();
const startMock = vi.fn();
const cancelMock = vi.fn();
const writeTextMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@umutkorkmaz/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@umutkorkmaz/ui')>();
  return {
    ...actual,
    useHubQuery: (...args: unknown[]) => useHubQueryMock(...args),
    useJob: (...args: unknown[]) => useJobMock(...args),
  };
});

function queryState(over: Partial<ReturnType<typeof useHubQueryMock>>) {
  return { data: undefined, isLoading: false, error: null, refetch: vi.fn(), ...over };
}

function jobState(over: Partial<ReturnType<typeof useJobMock>> = {}) {
  return {
    lines: [],
    status: 'running',
    exitCode: null,
    error: null,
    start: startMock,
    cancel: cancelMock,
    ...over,
  };
}

const CATALOG: CommandCatalog = [
  {
    path: 'doctor',
    aliases: [],
    description: 'Run health checks.',
    args: [],
    flags: [{ name: '--json', description: 'JSON output', takesValue: false }],
    supportsJson: true,
    supportsDryRun: false,
    destructive: false,
  },
  {
    path: 'workspace remove',
    aliases: [],
    description: 'Remove a workspace.',
    args: [{ name: 'name', required: true }],
    flags: [
      { name: '--scope', description: 'Scope', takesValue: true, default: 'all' },
      { name: '--force', description: 'Force it', takesValue: false },
      { name: '--dry-run', description: 'Dry run', takesValue: false },
    ],
    supportsJson: false,
    supportsDryRun: true,
    destructive: true,
  },
];

function setCatalog(): void {
  useHubQueryMock.mockReturnValue(queryState({ data: { ok: true, data: CATALOG, warnings: [] } }));
}

function renderScreen(): void {
  render(
    <SettingsProvider>
      <CommandBuilderScreen />
    </SettingsProvider>
  );
}

describe('CommandBuilderScreen', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    window.localStorage.clear();
    useJobMock.mockReturnValue(jobState());
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
  });

  afterEach(() => {
    useHubQueryMock.mockReset();
    useJobMock.mockReset();
    startMock.mockClear();
    cancelMock.mockClear();
    writeTextMock.mockClear();
    vi.restoreAllMocks();
  });

  it('renders a loading state', () => {
    useHubQueryMock.mockReturnValue(queryState({ isLoading: true }));
    renderScreen();
    expect(screen.getByText(/Loading command catalog/i)).toBeInTheDocument();
  });

  it('renders a transport error', () => {
    useHubQueryMock.mockReturnValue(queryState({ error: new Error('socket reset') }));
    renderScreen();
    expect(screen.getByText(/Could not reach the hub/i)).toBeInTheDocument();
  });

  it('generates the picker from the catalog (no hardcoded list)', () => {
    setCatalog();
    renderScreen();
    // Both catalog paths appear in the picker.
    expect(screen.getAllByText('doctor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('workspace remove').length).toBeGreaterThan(0);
  });

  it('builds the preview from typed args and flags, preserving order', () => {
    setCatalog();
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'workspace remove' }));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'legacy' } });
    fireEvent.change(screen.getByLabelText(/--scope/), { target: { value: 'apps' } });
    fireEvent.click(screen.getByLabelText(/--force/));

    // Preview should be: re-shell workspace remove <arg> <flags in declared order>
    expect(
      screen.getByText('re-shell workspace remove legacy --scope apps --force')
    ).toBeInTheDocument();
  });

  it('blocks a destructive run behind a confirmation modal under safety mode', () => {
    setCatalog();
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'workspace remove' }));
    // workspace remove is not hub-runnable, but destructive gating + preview still
    // apply; the Run button only appears for hub-runnable commands, so use doctor
    // to assert the non-destructive path and the modal via a runnable destructive.
    // Here we assert the destructive badge + confirmation-required marker render.
    expect(screen.getAllByText(/Destructive/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Confirmation required/i)).toBeInTheDocument();
  });

  it('runs a non-destructive hub-runnable command immediately (no modal) and streams', () => {
    setCatalog();
    useJobMock.mockReturnValue(
      jobState({ lines: [{ stream: 'stdout', text: 'all good' }], status: 'running' })
    );
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'doctor' }));
    fireEvent.click(screen.getByRole('button', { name: /^Run$/i }));

    // No confirmation modal for a non-destructive command.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Live output renders the streamed content.
    expect(screen.getByText(/all good/)).toBeInTheDocument();
    expect(useJobMock).toHaveBeenCalledWith('run', { subcommand: 'doctor' });
  });

  it('copies the exact assembled command', () => {
    setCatalog();
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'doctor' }));
    fireEvent.click(screen.getByRole('button', { name: /copy command/i }));
    expect(writeTextMock).toHaveBeenCalledWith('re-shell doctor');
  });

  it('persists the selected command in the URL', () => {
    setCatalog();
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'doctor' }));
    expect(window.location.search).toContain('cmd=doctor');
  });
});

describe('CommandBuilderScreen destructive gate (runnable)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    window.localStorage.clear();
    useJobMock.mockReturnValue(jobState());
  });
  afterEach(() => {
    useHubQueryMock.mockReset();
    useJobMock.mockReset();
    vi.restoreAllMocks();
  });

  it('shows the modal for a destructive runnable command and runs only after confirm', () => {
    // `analyze` is hub-runnable; mark it destructive to exercise the gate.
    const catalog: CommandCatalog = [
      {
        path: 'analyze',
        aliases: [],
        description: 'Analyze.',
        args: [],
        flags: [{ name: '--json', description: '', takesValue: false }],
        supportsJson: true,
        supportsDryRun: false,
        destructive: true,
      },
    ];
    useHubQueryMock.mockReturnValue(queryState({ data: { ok: true, data: catalog, warnings: [] } }));
    render(
      <SettingsProvider>
        <CommandBuilderScreen />
      </SettingsProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'analyze' }));
    fireEvent.click(screen.getByRole('button', { name: /^Run$/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // Job has not started yet (no live output before confirm).
    expect(screen.queryByText(/Live output/i)).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /confirm and run/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useJobMock).toHaveBeenCalledWith('run', { subcommand: 'analyze' });
  });
});
