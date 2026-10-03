import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobsLogsScreen } from './JobsLogsScreen';
import type { CommandCatalog } from './shared/commandCatalog';

const useHubQueryMock = vi.fn();
const useJobMock = vi.fn();
const startMock = vi.fn();
const cancelMock = vi.fn();
const writeTextMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@re-shell/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@re-shell/ui')>();
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
    flags: [{ name: '--json', description: '', takesValue: false }],
    supportsJson: true,
    supportsDryRun: false,
    destructive: false,
  },
  {
    // Not on the hub run allow-list — must be filtered out of the launchers.
    path: 'plugin install',
    aliases: [],
    description: 'Install a plugin.',
    args: [{ name: 'name', required: true }],
    flags: [],
    supportsJson: false,
    supportsDryRun: false,
    destructive: false,
  },
];

function setCatalog(): void {
  useHubQueryMock.mockReturnValue(queryState({ data: { ok: true, data: CATALOG, warnings: [] } }));
}

describe('JobsLogsScreen', () => {
  beforeEach(() => {
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
    render(<JobsLogsScreen />);
    expect(screen.getByText(/Loading runnable commands/i)).toBeInTheDocument();
  });

  it('renders a transport error', () => {
    useHubQueryMock.mockReturnValue(queryState({ error: new Error('boom') }));
    render(<JobsLogsScreen />);
    expect(screen.getByText(/Could not reach the hub/i)).toBeInTheDocument();
  });

  it('only offers hub-runnable commands as launchers', () => {
    setCatalog();
    render(<JobsLogsScreen />);
    expect(screen.getByRole('button', { name: /doctor/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /plugin install/i })).not.toBeInTheDocument();
    expect(screen.getByText(/No jobs running/i)).toBeInTheDocument();
  });

  it('launches a job and streams stdout content (not output)', () => {
    setCatalog();
    useJobMock.mockReturnValue(
      jobState({ lines: [{ stream: 'stdout', text: 'checking…' }], status: 'running' })
    );
    render(<JobsLogsScreen />);

    fireEvent.click(screen.getByRole('button', { name: /doctor/i }));

    expect(useJobMock).toHaveBeenCalledWith('run', { subcommand: 'doctor' });
    expect(screen.getByText(/checking…/)).toBeInTheDocument();
    expect(screen.getByText('1 active')).toBeInTheDocument();
  });

  it('exposes a cancel control for a running job', () => {
    setCatalog();
    useJobMock.mockReturnValue(jobState({ status: 'running' }));
    render(<JobsLogsScreen />);

    fireEvent.click(screen.getByRole('button', { name: /doctor/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(cancelMock).toHaveBeenCalledTimes(1);
  });

  it('shows the exit code and duration summary on a terminal job', () => {
    setCatalog();
    useJobMock.mockReturnValue(
      jobState({ lines: [{ stream: 'stdout', text: 'done' }], status: 'success', exitCode: 0 })
    );
    render(<JobsLogsScreen />);

    fireEvent.click(screen.getByRole('button', { name: /doctor/i }));
    expect(screen.getByText('exit 0')).toBeInTheDocument();
    expect(screen.getByText(/success \(exit 0\)/)).toBeInTheDocument();
  });

  it('handles a null exit code without crashing', () => {
    setCatalog();
    useJobMock.mockReturnValue(jobState({ status: 'failed', exitCode: null }));
    render(<JobsLogsScreen />);

    fireEvent.click(screen.getByRole('button', { name: /doctor/i }));
    // No "exit null" badge; the summary reports "no exit code".
    expect(screen.queryByText(/exit null/)).not.toBeInTheDocument();
    expect(screen.getByText(/failed \(no exit code\)/)).toBeInTheDocument();
  });

  it('tags stderr lines so secrets-redacted stream is distinguishable', () => {
    setCatalog();
    useJobMock.mockReturnValue(
      jobState({ lines: [{ stream: 'stderr', text: 'warn: low disk' }], status: 'running' })
    );
    render(<JobsLogsScreen />);
    fireEvent.click(screen.getByRole('button', { name: /doctor/i }));
    expect(screen.getByText(/\[stderr\] warn: low disk/)).toBeInTheDocument();
  });

  it('renders a copy-CLI affordance for the command catalog reference', () => {
    setCatalog();
    render(<JobsLogsScreen />);
    expect(screen.getByText(/re-shell commands list --json/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy command/i })).toBeInTheDocument();
  });

  it('copies the commands list command to the clipboard', () => {
    setCatalog();
    render(<JobsLogsScreen />);
    fireEvent.click(screen.getByRole('button', { name: /copy command/i }));
    expect(writeTextMock).toHaveBeenCalledWith('re-shell commands list --json');
  });
});

describe('JobsLogsScreen master / detail jobs table', () => {
  beforeEach(() => {
    useJobMock.mockReturnValue(jobState());
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
  });
  afterEach(() => {
    useHubQueryMock.mockReset();
    useJobMock.mockReset();
    vi.restoreAllMocks();
  });

  function launchTwo(): void {
    setCatalog();
    render(<JobsLogsScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'doctor' }));
    fireEvent.click(screen.getByRole('button', { name: 'doctor' }));
  }

  it('renders a dense table: h-9 rows, mono tabular figures and a status badge with text per job', () => {
    useJobMock.mockReturnValue(jobState({ lines: [{ stream: 'stdout', text: 'a' }, { stream: 'stdout', text: 'b' }], status: 'success', exitCode: 0 }));
    launchTwo();
    const table = screen.getByRole('table', { name: /Launched jobs/ });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3); // header + two jobs
    for (const row of rows.slice(1)) {
      expect(row.className).toContain('h-9');
    }
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['ID', 'Command', 'Status', 'Started', 'Duration', 'Lines', 'Exit']);
    // newest first: #2 above #1; ids/counts/exit are mono + tabular-nums, status is text (not colour only)
    expect(within(rows[1]).getByText('#2').className).toContain('tabular-nums');
    expect(within(rows[1]).getByText('#2').className).toContain('font-mono');
    expect(within(rows[1]).getByTestId('job-status-2')).toHaveTextContent('success');
    const cells = within(rows[1]).getAllByRole('cell');
    expect(cells[5]).toHaveTextContent('2'); // lines
    expect(cells[6]).toHaveTextContent('0'); // exit code
  });

  it('selecting a row shows that job output; every job stays mounted (and streaming)', () => {
    launchTwo();
    const jobs = screen.getAllByTestId('live-job');
    expect(jobs).toHaveLength(2);
    // The newest job is selected on launch; the other is hidden but still mounted.
    expect(jobs.filter((job) => !job.hasAttribute('hidden'))).toHaveLength(1);
    const table = screen.getByRole('table', { name: /Launched jobs/ });
    const first = within(table).getByRole('button', { name: /Show output of job 1/ });
    const second = within(table).getByRole('button', { name: /Show output of job 2/ });
    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(first).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(second).toHaveAttribute('aria-pressed', 'false');
    // jobs are rendered newest first, so job 1 is the second element
    expect(screen.getAllByTestId('live-job')[1]).not.toHaveAttribute('hidden');
    expect(screen.getAllByTestId('live-job')[0]).toHaveAttribute('hidden');
    // both still own a running useJob instance
    expect(startMock).toHaveBeenCalledTimes(2);
  });

  it('moves between rows with ArrowDown / ArrowUp', () => {
    launchTwo();
    const table = screen.getByRole('table', { name: /Launched jobs/ });
    const newest = within(table).getByRole('button', { name: /Show output of job 2/ });
    const older = within(table).getByRole('button', { name: /Show output of job 1/ });
    newest.focus();
    fireEvent.keyDown(newest, { key: 'ArrowDown' });
    expect(older).toHaveFocus();
    fireEvent.keyDown(older, { key: 'ArrowUp' });
    expect(newest).toHaveFocus();
    // ends of the list do not wrap or throw
    fireEvent.keyDown(newest, { key: 'ArrowUp' });
    expect(newest).toHaveFocus();
  });

  it('announces a finished job in a polite live region and can clear finished jobs', async () => {
    useJobMock.mockReturnValue(jobState({ status: 'failed', exitCode: 2 }));
    setCatalog();
    render(<JobsLogsScreen />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'doctor' }));
    });
    const live = screen.getAllByRole('status').find((el) => /Job 1/.test(el.textContent ?? ''));
    expect(live).toHaveTextContent('Job 1 failed with exit code 2');

    fireEvent.click(screen.getByRole('button', { name: /Clear finished/ }));
    expect(screen.getByText(/No jobs running/i)).toBeInTheDocument();
    expect(screen.getByText('0 active')).toBeInTheDocument();
  });
});
