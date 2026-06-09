import * as React from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CommandPreview,
  createReShellCommand,
  formatCommand,
} from '@re-shell/ui';
import { Play, Terminal } from 'lucide-react';
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

  return <JobsContent catalog={data} />;
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
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="size-4" />
              Launch a job
            </CardTitle>
            <CardDescription>
              Run a vetted command through the hub allow-list and stream its output live. Multiple jobs
              run concurrently.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {runnable.map((entry) => (
              <Button
                key={entry.path}
                type="button"
                variant="secondary"
                size="sm"
                className="justify-start gap-2"
                onClick={() => launch(entry)}
              >
                <Play className="size-3.5" />
                {entry.path}
              </Button>
            ))}
          </CardContent>
        </Card>

        <CommandPreview spec={COMMANDS_LIST_SPEC} />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Jobs</h2>
        <Badge variant="secondary">{jobs.length} active</Badge>
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
