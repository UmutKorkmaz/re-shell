import * as React from 'react';
import {
  Button,
  CommandPreview,
  LiveRegion,
  cn,
  createReShellCommand,
  formatCommand,
} from '@re-shell/ui';
import { Eraser, Play, Radio, Terminal } from 'lucide-react';
import { useEnvelopeQuery } from './shared/useEnvelopeQuery';
import { EmptyPanel, EnvelopeErrorPanel, ErrorPanel, LoadingPanel } from './shared/StatePanels';
import {
  commandCatalogSchema,
  isHubRunnable,
  type CommandCatalogEntry,
} from './shared/commandCatalog';
import { LiveJob, type JobSnapshot, type LiveJobSpec } from './jobs/LiveJob';
import { JobsTable, type JobRow } from './jobs/JobsTable';

const COMMANDS_LIST_COMMAND = createReShellCommand(['commands', 'list'], { json: true });

const COMMANDS_LIST_SPEC = {
  title: 'Command catalog',
  description: 'List all available commands with metadata.',
  command: COMMANDS_LIST_COMMAND,
  commandText: formatCommand(COMMANDS_LIST_COMMAND),
  destructive: false,
  dryRunSupported: false,
} as const;

/**
 * Map a hub-runnable catalog entry to the `run` allow-list request. The hub
 * resolves `{ subcommand }` to a fixed argv (+ `--json`), so the displayed
 * command mirrors that exactly.
 */
function toJobSpec(entry: CommandCatalogEntry, seq: number): LiveJobSpec {
  return {
    key: `${entry.path}-${seq}-${Date.now().toString(36)}`,
    commandId: 'run',
    params: { subcommand: entry.path },
    command: ['re-shell', ...entry.path.split(' ').filter(Boolean), '--json'],
  };
}

export function JobsLogsScreen(): React.ReactElement {
  const { data, isLoading, error, envelopeError, refetch } = useEnvelopeQuery(
    'commands.list',
    commandCatalogSchema
  );

  if (isLoading) {
    return (
      <LoadingPanel title="Loading runnable commands…" description="Fetching commands.list from the hub." />
    );
  }
  if (error) {
    return <ErrorPanel title="Could not reach the hub" description={error.message} onRetry={() => refetch()} />;
  }
  if (envelopeError) {
    return <EnvelopeErrorPanel code={envelopeError.code} message={envelopeError.message} />;
  }
  if (!data || data.length === 0) {
    return <EmptyPanel title="No commands" description="The hub returned an empty command catalog." />;
  }

  return (
    <div className="screen-enter">
      <JobsContent catalog={data} />
    </div>
  );
}

const TERMINAL: ReadonlySet<JobSnapshot['status']> = new Set(['success', 'failed', 'cancelled']);

/** Re-render once a second while any job is running, so durations tick. */
function useNow(active: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

function JobsContent({ catalog }: { catalog: CommandCatalogEntry[] }): React.ReactElement {
  const runnable = React.useMemo(() => catalog.filter(isHubRunnable), [catalog]);
  const [jobs, setJobs] = React.useState<LiveJobSpec[]>([]);
  const [snapshots, setSnapshots] = React.useState<Record<string, JobSnapshot>>({});
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [announcement, setAnnouncement] = React.useState('');
  const seqRef = React.useRef(0);
  const seqByKey = React.useRef(new Map<string, number>());

  const launch = React.useCallback((entry: CommandCatalogEntry): void => {
    seqRef.current += 1;
    const spec = toJobSpec(entry, seqRef.current);
    seqByKey.current.set(spec.key, seqRef.current);
    // Newest job first; the new job's output is shown straight away.
    setJobs((prev) => [spec, ...prev]);
    setSelectedKey(spec.key);
  }, []);

  const remove = React.useCallback((key: string): void => {
    setJobs((prev) => prev.filter((job) => job.key !== key));
    setSnapshots((prev) => {
      const { [key]: removed, ...rest } = prev;
      void removed;
      return rest;
    });
  }, []);

  const clearFinished = React.useCallback((): void => {
    setJobs((prev) => prev.filter((job) => !TERMINAL.has(snapshots[job.key]?.status ?? 'running')));
  }, [snapshots]);

  // Each LiveJob reports its state up; a job reaching a terminal state is announced politely.
  const report = React.useCallback((key: string, snapshot: JobSnapshot): void => {
    setSnapshots((prev) => {
      const before = prev[key];
      if (
        before &&
        before.status === snapshot.status &&
        before.exitCode === snapshot.exitCode &&
        before.lineCount === snapshot.lineCount &&
        before.finishedAt === snapshot.finishedAt
      ) {
        return prev;
      }
      return { ...prev, [key]: snapshot };
    });
  }, []);

  // Announce transitions to a terminal state exactly once per job.
  const announced = React.useRef(new Set<string>());
  React.useEffect(() => {
    for (const job of jobs) {
      const snapshot = snapshots[job.key];
      if (snapshot && TERMINAL.has(snapshot.status) && !announced.current.has(job.key)) {
        announced.current.add(job.key);
        const code = snapshot.exitCode === null ? '' : ` with exit code ${snapshot.exitCode}`;
        setAnnouncement(`Job ${seqByKey.current.get(job.key) ?? ''} ${snapshot.status}${code}`);
      }
    }
  }, [jobs, snapshots]);

  // The selection always points at a job that exists: a removed selection falls back to the newest.
  const effectiveKey = jobs.some((job) => job.key === selectedKey) ? selectedKey : (jobs[0]?.key ?? null);
  const anyRunning = jobs.some((job) => !TERMINAL.has(snapshots[job.key]?.status ?? 'running'));
  const now = useNow(anyRunning);
  const hasFinished = jobs.some((job) => TERMINAL.has(snapshots[job.key]?.status ?? 'running'));

  const rows: JobRow[] = jobs.map((spec) => ({
    spec,
    seq: seqByKey.current.get(spec.key) ?? 0,
    snapshot: snapshots[spec.key],
  }));

  return (
    <div className="stagger-children grid gap-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        {/* Launcher: terminal-styled command tray. */}
        <div className="surface flex flex-col">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
            <Terminal className="size-4 text-signal" aria-hidden="true" />
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">Launch a job</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Run a vetted command through the hub allow-list and stream its output live. Multiple jobs
                run concurrently.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 p-4">
            {runnable.map((entry) => (
              <button
                key={entry.path}
                type="button"
                onClick={() => launch(entry)}
                className={cn(
                  'group inline-flex items-center gap-2 rounded-md border border-border bg-bg-0 px-3 py-1.5',
                  'font-mono text-[0.8125rem] text-foreground/90 shadow-elev-1 outline-none transition-all duration-fast',
                  'hover:-translate-y-0.5 hover:border-signal/50 hover:text-foreground hover:shadow-glow-signal',
                  'focus-visible:shadow-focus-ring'
                )}
              >
                <Play className="size-3.5 text-signal transition-transform group-hover:scale-110" aria-hidden="true" />
                {entry.path}
              </button>
            ))}
          </div>
        </div>

        <CommandPreview spec={COMMANDS_LIST_SPEC} />
      </div>

      <section aria-labelledby="jobs-heading" className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="jobs-heading" className="inline-flex items-center gap-2 font-display text-base font-semibold tracking-tight">
            <Radio className={cn('size-4', jobs.length > 0 ? 'animate-pulse-live text-signal' : 'text-muted-foreground')} aria-hidden="true" />
            Jobs
          </h2>
          <div className="flex items-center gap-2">
            {hasFinished ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearFinished}>
                <Eraser className="size-4" aria-hidden="true" />
                Clear finished
              </Button>
            ) : null}
            <span
              className={cn(
                'status-badge font-mono tabular-nums',
                jobs.length > 0 ? 'status-info' : 'border-border bg-bg-1 text-muted-foreground'
              )}
            >
              {jobs.length} active
            </span>
          </div>
        </div>

        {jobs.length === 0 ? (
          <EmptyPanel
            title="No jobs running"
            description="Launch a command above to stream its live output here."
          />
        ) : (
          // Master / detail: the dense table selects which job's console is shown. Every job stays
          // mounted (hidden when not selected) so unselected jobs keep streaming.
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
            <JobsTable rows={rows} selectedKey={effectiveKey} onSelect={setSelectedKey} now={now} />
            <div className="min-w-0">
              {jobs.map((job) => (
                <LiveJob key={job.key} spec={job} onRemove={remove} onState={report} hidden={job.key !== effectiveKey} />
              ))}
            </div>
          </div>
        )}
        <LiveRegion>{announcement}</LiveRegion>
      </section>
    </div>
  );
}
