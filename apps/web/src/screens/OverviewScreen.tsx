import * as React from 'react';
import {
  Button,
  CommandPreview,
  WorkspaceSummaryPanel,
  cn,
  createReShellCommand,
  formatCommand,
} from '@re-shell/ui';
import type { HealthCheck, WorkspaceSummary } from '@re-shell/contracts';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Boxes,
  History,
  Play,
  Server,
  TriangleAlert,
} from 'lucide-react';
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

  return (
    <div className="screen-enter">
      <OverviewContent summary={feedToWorkspaceSummary(data)} onNavigate={onNavigate} />
    </div>
  );
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
    <div className="stagger-children grid auto-rows-min grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Hero: workspace identity + summary metrics — the widest tile. */}
      <div className="lg:col-span-8 lg:row-span-2">
        <WorkspaceSummaryPanel
          className="h-full"
          workspace={summary}
          onRunHealth={() => onNavigate('health')}
          onOpenSettings={() => onNavigate('settings')}
        />
      </div>

      {/* Health-score tile — tall, status-driven. */}
      <div className="lg:col-span-4 lg:row-span-2">
        <HealthScoreTile summary={summary} onViewHealth={() => onNavigate('health')} />
      </div>

      {/* Count tiles — compact, mono numerals. */}
      <MetricTile
        className="lg:col-span-3"
        icon={<Boxes className="size-4" />}
        label="Apps"
        value={summary.apps.length}
        onClick={() => onNavigate('graph')}
      />
      <MetricTile
        className="lg:col-span-3"
        icon={<Server className="size-4" />}
        label="Services"
        value={summary.services.length}
        onClick={() => onNavigate('graph')}
      />
      <GitTile className="lg:col-span-6" summary={summary} />

      {/* Failing checks — spans half, status color. */}
      <div className="lg:col-span-6">
        <FailingChecksTile checks={failedChecks} onViewHealth={() => onNavigate('health')} />
      </div>

      {/* Recent jobs — spans half. */}
      <div className="lg:col-span-6">
        <RecentJobsTile onViewJobs={() => onNavigate('jobs')} />
      </div>

      {/* Primary actions — full width, copy-CLI affordances. */}
      <section aria-labelledby="overview-actions" className="lg:col-span-12">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="overview-actions" className="font-display text-base font-semibold tracking-tight">
            Primary actions
          </h2>
          <span className="text-sm text-muted-foreground">Copy any command to run it in your terminal.</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CommandPreview spec={ACTION_SPECS.inspect} />
          <CommandPreview spec={ACTION_SPECS.health} />
          <CommandPreview spec={ACTION_SPECS.create} />
          <CommandPreview spec={ACTION_SPECS.runDev} />
        </div>
      </section>
    </div>
  );
}

const SCORE_TONE = (score: number): { ring: string; text: string; label: string; badge: string } => {
  if (score >= 80) return { ring: 'shadow-glow-healthy', text: 'text-healthy', label: 'Healthy', badge: 'status-healthy' };
  if (score >= 50) return { ring: 'shadow-glow-warn', text: 'text-warn', label: 'Degraded', badge: 'status-warn' };
  return { ring: 'shadow-glow-critical', text: 'text-critical', label: 'Critical', badge: 'status-critical' };
};

function HealthScoreTile({
  summary,
  onViewHealth,
}: {
  summary: WorkspaceSummary;
  onViewHealth: () => void;
}): React.ReactElement {
  const tone = SCORE_TONE(summary.health.score);
  return (
    <div className="surface flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="label-eyebrow inline-flex items-center gap-2">
          <Activity className="size-3.5" />
          Health score
        </span>
        <span className={cn('status-badge', tone.badge)}>{tone.label}</span>
      </div>

      <div className="my-auto flex flex-col items-center py-4 text-center">
        <span
          className={cn(
            'inline-grid size-28 place-items-center rounded-full border border-border-strong bg-bg-0',
            tone.ring
          )}
        >
          <span className={cn('font-mono text-4xl font-bold tabular-nums tracking-tight', tone.text)}>
            {summary.health.score}
          </span>
        </span>
        <span className="label-eyebrow mt-3">Readiness · out of 100</span>
      </div>

      <Button type="button" variant="outline" size="sm" className="w-full justify-between" onClick={onViewHealth}>
        View health report
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

function MetricTile({
  icon,
  label,
  value,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  onClick?: () => void;
  className?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'surface group flex flex-col items-start p-4 text-left outline-none transition-all duration-fast',
        'hover:-translate-y-0.5 hover:border-border-strong hover:shadow-elev-2 focus-visible:shadow-focus-ring',
        className
      )}
    >
      <span className="label-eyebrow inline-flex items-center gap-2 text-muted-foreground transition-colors group-hover:text-foreground">
        <span className="text-signal">{icon}</span>
        {label}
      </span>
      <span className="mt-2 font-mono text-3xl font-bold tabular-nums tracking-tight">{value}</span>
    </button>
  );
}

function GitTile({ summary, className }: { summary: WorkspaceSummary; className?: string }): React.ReactElement {
  return (
    <div className={cn('surface flex flex-col justify-between gap-3 p-4', className)}>
      <span className="label-eyebrow inline-flex items-center gap-2">
        <span className="text-signal">@</span>
        Package manager
      </span>
      <div className="flex items-center justify-between">
        <span className="font-mono text-2xl font-bold tracking-tight">{summary.packageManager}</span>
        {summary.git ? (
          <span className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{summary.git.branch}</span>
            <span className={cn('status-badge', summary.git.dirty ? 'status-warn' : 'status-healthy')}>
              {summary.git.dirty ? 'Dirty' : 'Clean'}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function FailingChecksTile({
  checks,
  onViewHealth,
}: {
  checks: readonly HealthCheck[];
  onViewHealth: () => void;
}): React.ReactElement {
  return (
    <div className="surface flex h-full flex-col p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-semibold tracking-tight">
            <AlertCircle className="size-4 text-critical" />
            Failing checks
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">Errors and warnings from the latest health run.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onViewHealth}>
          Health
          <ArrowRight className="size-4" />
        </Button>
      </div>

      {checks.length === 0 ? (
        <p className="my-auto text-sm text-muted-foreground">No failing checks. Workspace looks healthy.</p>
      ) : (
        <ul className="space-y-2">
          {checks.slice(0, 4).map((check) => {
            const isFail = check.level === 'fail';
            return (
              <li
                key={check.id}
                className="flex items-start gap-2.5 rounded-md border border-border bg-bg-2/40 p-3"
              >
                <span className={cn('status-badge shrink-0', isFail ? 'status-critical' : 'status-warn')}>
                  {isFail ? <AlertCircle className="size-3" /> : <TriangleAlert className="size-3" />}
                  {isFail ? 'Error' : 'Warn'}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{check.title}</div>
                  {check.message ? (
                    <div className="text-sm text-muted-foreground">{check.message}</div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RecentJobsTile({ onViewJobs }: { onViewJobs: () => void }): React.ReactElement {
  return (
    <div className="surface flex h-full flex-col p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-semibold tracking-tight">
            <History className="size-4 text-info" />
            Recent jobs
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">Live command runs are streamed in Jobs &amp; Logs.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onViewJobs}>
          <Play className="size-4" />
          Jobs &amp; Logs
        </Button>
      </div>
      <div className="my-auto rounded-md border border-dashed border-border bg-bg-0/60 p-4">
        <p className="text-sm text-muted-foreground">
          No jobs from this session yet. Start one from the Command Builder or open Jobs &amp; Logs to watch live
          output.
        </p>
      </div>
    </div>
  );
}
