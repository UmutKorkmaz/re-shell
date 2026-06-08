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
  Separator,
  WorkspaceSummaryPanel,
  createReShellCommand,
  formatCommand,
} from 're-shell-ui';
import type { HealthCheck, WorkspaceSummary } from 're-shell-contracts';
import { Activity, AlertCircle, ArrowRight, Boxes, History, Play, Server } from 'lucide-react';
import type { ScreenId } from '../shell/screens';
import { useEnvelopeQuery } from './shared/useEnvelopeQuery';
import { EmptyPanel, EnvelopeErrorPanel, ErrorPanel, LoadingPanel } from './shared/StatePanels';
import { feedToWorkspaceSummary, summaryFeedSchema } from './shared/summaryFeed';

interface OverviewScreenProps {
  onNavigate: (screen: ScreenId) => void;
}

function buildSpec(
  args: readonly string[],
  title: string,
  description: string,
  options: Record<string, string | boolean> = { json: true }
) {
  const command = createReShellCommand([...args], options);
  return {
    title,
    description,
    command,
    commandText: formatCommand(command),
    destructive: false,
    dryRunSupported: false,
  } as const;
}

const ACTION_SPECS = {
  inspect: buildSpec(['workspace', 'summary'], 'Inspect workspace', 'Print the full workspace summary as JSON.'),
  health: buildSpec(['workspace', 'health'], 'Run health checks', 'Run the workspace health suite.'),
  create: buildSpec(['create'], 'Create from template', 'Scaffold a new app or service.', {}),
  runDev: buildSpec(['dev'], 'Run dev', 'Start the workspace dev servers.', {}),
} as const;

export function OverviewScreen({ onNavigate }: OverviewScreenProps): React.ReactElement {
  const { data, isLoading, error, envelopeError, refetch } = useEnvelopeQuery(
    'workspace.summary',
    summaryFeedSchema
  );

  if (isLoading) {
    return <LoadingPanel title="Loading workspace…" description="Fetching workspace.summary from the hub." />;
  }

  if (error) {
    return (
      <ErrorPanel
        title="Could not reach the hub"
        description={error.message}
        onRetry={() => refetch()}
      />
    );
  }

  if (envelopeError) {
    return (
      <EnvelopeErrorPanel
        code={envelopeError.code}
        message={envelopeError.message}
        action={
          <p className="text-sm text-muted-foreground">
            No workspace detected here. Create or initialize one to get started.
          </p>
        }
      />
    );
  }

  if (!data) {
    return (
      <EmptyPanel
        title="No workspace"
        description="The hub returned an empty summary. Open a workspace to populate the dashboard."
      />
    );
  }

  return <OverviewContent summary={feedToWorkspaceSummary(data)} onNavigate={onNavigate} />;
}

function OverviewContent({
  summary,
  onNavigate,
}: {
  summary: WorkspaceSummary;
  onNavigate: (screen: ScreenId) => void;
}): React.ReactElement {
  const failedChecks = summary.health.checks.filter((c) => c.level === 'fail' || c.level === 'warn');

  return (
    <div className="grid gap-4">
      <WorkspaceSummaryPanel
        workspace={summary}
        onRunHealth={() => onNavigate('health')}
        onOpenSettings={() => onNavigate('settings')}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <FailedChecksPanel checks={failedChecks} onViewHealth={() => onNavigate('health')} />
        <CountsPanel summary={summary} onViewGraph={() => onNavigate('graph')} />
      </div>

      <RecentJobsPanel onViewJobs={() => onNavigate('jobs')} />

      <section aria-labelledby="overview-actions" className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 id="overview-actions" className="text-sm font-semibold tracking-tight">
            Primary actions
          </h2>
          <span className="text-sm text-muted-foreground">Copy any command to run it in your terminal.</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <CommandPreview spec={ACTION_SPECS.inspect} />
          <CommandPreview spec={ACTION_SPECS.health} />
          <CommandPreview spec={ACTION_SPECS.create} />
          <CommandPreview spec={ACTION_SPECS.runDev} />
        </div>
      </section>
    </div>
  );
}

function FailedChecksPanel({
  checks,
  onViewHealth,
}: {
  checks: readonly HealthCheck[];
  onViewHealth: () => void;
}): React.ReactElement {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="size-4 text-red-600" />
            Failing checks
          </CardTitle>
          <CardDescription>Errors and warnings from the latest health run.</CardDescription>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onViewHealth}>
          Health
          <ArrowRight className="size-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {checks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No failing checks. Workspace looks healthy.</p>
        ) : (
          <ul className="space-y-2">
            {checks.slice(0, 4).map((check) => (
              <li key={check.id} className="flex items-start gap-2 rounded-md border p-3">
                <Badge variant={check.level === 'fail' ? 'destructive' : 'warning'} className="shrink-0">
                  {check.level === 'fail' ? 'Error' : 'Warn'}
                </Badge>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{check.title}</div>
                  {check.message ? (
                    <div className="text-sm text-muted-foreground">{check.message}</div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CountsPanel({
  summary,
  onViewGraph,
}: {
  summary: WorkspaceSummary;
  onViewGraph: () => void;
}): React.ReactElement {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Topology</CardTitle>
          <CardDescription>Apps, services, and package manager.</CardDescription>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onViewGraph}>
          Graph
          <ArrowRight className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <Metric icon={<Boxes className="size-4" />} label="Apps" value={summary.apps.length} />
        <Metric icon={<Server className="size-4" />} label="Services" value={summary.services.length} />
        <Metric icon={<Activity className="size-4" />} label="Health score" value={summary.health.score} />
        <Metric label="Package manager" value={summary.packageManager} />
        {summary.git ? (
          <div className="col-span-2">
            <Separator className="mb-3" />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{summary.git.branch}</span>
              <Badge variant={summary.git.dirty ? 'warning' : 'success'}>
                {summary.git.dirty ? 'Dirty' : 'Clean'}
              </Badge>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RecentJobsPanel({ onViewJobs }: { onViewJobs: () => void }): React.ReactElement {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" />
            Recent jobs
          </CardTitle>
          <CardDescription>Live command runs are streamed in Jobs &amp; Logs.</CardDescription>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onViewJobs}>
          <Play className="size-4" />
          Jobs &amp; Logs
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          No jobs from this session yet. Start one from the Command Builder or open Jobs &amp; Logs to
          watch live output.
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tracking-normal">{value}</div>
    </div>
  );
}
