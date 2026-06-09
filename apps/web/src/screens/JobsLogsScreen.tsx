import * as React from 'react';
import {
  CommandPreview,
  cn,
  createReShellCommand,
  formatCommand,
} from '@re-shell/ui';
import { Play, Radio, Terminal } from 'lucide-react';
import { useEnvelopeQuery } from './shared/useEnvelopeQuery';
import { EmptyPanel, EnvelopeErrorPanel, ErrorPanel, LoadingPanel } from './shared/StatePanels';
import {
  commandCatalogSchema,
  isHubRunnable,
  type CommandCatalogEntry,
} from './shared/commandCatalog';
import { LiveJob, type LiveJobSpec } from './jobs/LiveJob';

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

function JobsContent({ catalog }: { catalog: CommandCatalogEntry[] }): React.ReactElement {
  const runnable = React.useMemo(() => catalog.filter(isHubRunnable), [catalog]);
  const [jobs, setJobs] = React.useState<LiveJobSpec[]>([]);
  const seqRef = React.useRef(0);

  const launch = React.useCallback((entry: CommandCatalogEntry): void => {
    seqRef.current += 1;
    const spec = toJobSpec(entry, seqRef.current);
    // Newest job first so live output is at the top of the list.
    setJobs((prev) => [spec, ...prev]);
  }, []);

  const remove = React.useCallback((key: string): void => {
    setJobs((prev) => prev.filter((job) => job.key !== key));
  }, []);

  return (
    <div className="stagger-children grid gap-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        {/* Launcher — terminal-styled command tray. */}
        <div className="surface flex flex-col">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
            <Terminal className="size-4 text-signal" />
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
                <Play className="size-3.5 text-signal transition-transform group-hover:scale-110" />
                {entry.path}
              </button>
            ))}
          </div>
        </div>

        <CommandPreview spec={COMMANDS_LIST_SPEC} />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 font-display text-base font-semibold tracking-tight">
          <Radio className={cn('size-4', jobs.length > 0 ? 'animate-pulse-live text-signal' : 'text-muted-foreground')} />
          Jobs
        </h2>
        <span
          className={cn(
            'status-badge',
            jobs.length > 0 ? 'status-info' : 'border-border bg-bg-1 text-muted-foreground'
          )}
        >
          {jobs.length} active
        </span>
      </div>

      {jobs.length === 0 ? (
        <EmptyPanel
          title="No jobs running"
          description="Launch a command above to stream its live output here."
        />
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <LiveJob key={job.key} spec={job} onRemove={remove} />
          ))}
        </div>
      )}
    </div>
  );
}
