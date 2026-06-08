import * as React from 'react';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CommandPreview,
  HealthStatus,
  Separator,
  createReShellCommand,
  formatCommand,
} from 're-shell-ui';
import type { HealthCheck, HealthSummary } from 're-shell-contracts';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { useEnvelopeQuery } from './shared/useEnvelopeQuery';
import { EnvelopeErrorPanel, ErrorPanel, LoadingPanel } from './shared/StatePanels';
import { feedToHealthSummary, healthFeedSchema } from './shared/summaryFeed';

const HEALTH_COMMAND = createReShellCommand(['workspace', 'health'], { json: true });

const HEALTH_SPEC = {
  title: 'Workspace health',
  description: 'Run the full health check suite and emit machine-readable JSON.',
  command: HEALTH_COMMAND,
  commandText: formatCommand(HEALTH_COMMAND),
  destructive: false,
  dryRunSupported: false,
} as const;

type Level = HealthCheck['level'];

const LEVEL_META: Record<
  Level,
  { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline'; icon: React.ReactNode }
> = {
  pass: { label: 'Pass', variant: 'success', icon: <CheckCircle2 className="size-4 text-emerald-600" /> },
  warn: { label: 'Warning', variant: 'warning', icon: <TriangleAlert className="size-4 text-amber-600" /> },
  fail: { label: 'Error', variant: 'destructive', icon: <AlertCircle className="size-4 text-red-600" /> },
  info: { label: 'Info', variant: 'outline', icon: <Info className="size-4 text-muted-foreground" /> },
};

/** Order checks worst-first so the operator scans failures before noise. */
const LEVEL_ORDER: Record<Level, number> = { fail: 0, warn: 1, info: 2, pass: 3 };

export function HealthScreen(): React.ReactElement {
  const { data, isLoading, error, envelopeError, refetch } = useEnvelopeQuery(
    'workspace.health',
    healthFeedSchema
  );

  if (isLoading) {
    return <LoadingPanel title="Running health checks…" description="Fetching workspace.health from the hub." />;
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

  // No-config / not-a-workspace path surfaces the typed CLI error envelope.
  if (envelopeError) {
    return (
      <div className="grid gap-4">
        <EnvelopeErrorPanel
          code={envelopeError.code}
          message={envelopeError.message}
          action={
            <p className="text-sm text-muted-foreground">
              Initialize a workspace, then re-run the health check below.
            </p>
          }
        />
        <CommandPreview spec={HEALTH_SPEC} />
      </div>
    );
  }

  if (!data) {
    return (
      <ErrorPanel
        title="No health data"
        description="The hub returned an empty health payload."
        onRetry={() => refetch()}
      />
    );
  }

  return <HealthContent health={feedToHealthSummary(data)} onRefresh={() => refetch()} />;
}

function HealthContent({
  health,
  onRefresh,
}: {
  health: HealthSummary;
  onRefresh: () => void;
}): React.ReactElement {
  const grouped = React.useMemo(() => groupByLevel(health.checks), [health.checks]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <HealthStatus health={health} />
        <CommandPreview spec={HEALTH_SPEC} />
      </div>

      <CheckGroup
        title="Errors"
        emptyLabel="No errors."
        checks={grouped.fail}
        tone="destructive"
        onRefresh={onRefresh}
      />
      <CheckGroup title="Warnings" emptyLabel="No warnings." checks={grouped.warn} tone="warning" />
      <CheckGroup
        title="Info & passing"
        emptyLabel="No additional checks."
        checks={[...grouped.info, ...grouped.pass]}
        tone="muted"
      />
    </div>
  );
}

function CheckGroup({
  title,
  emptyLabel,
  checks,
  tone,
  onRefresh,
}: {
  title: string;
  emptyLabel: string;
  checks: readonly HealthCheck[];
  tone: 'destructive' | 'warning' | 'muted';
  onRefresh?: () => void;
}): React.ReactElement {
  const titleClass =
    tone === 'destructive' ? 'text-destructive' : tone === 'warning' ? 'text-amber-600' : 'text-foreground';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className={`text-base ${titleClass}`}>{title}</CardTitle>
          <CardDescription>{checks.length === 0 ? emptyLabel : `${checks.length} check(s)`}</CardDescription>
        </div>
        <Badge variant="outline">{checks.length}</Badge>
      </CardHeader>
      {checks.length > 0 ? (
        <CardContent className="space-y-0 p-0">
          <Separator />
          <ul className="divide-y">
            {checks.map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </ul>
        </CardContent>
      ) : null}
      {checks.length === 0 && onRefresh ? (
        <CardContent>
          <button
            type="button"
            onClick={onRefresh}
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            Re-run checks
          </button>
        </CardContent>
      ) : null}
    </Card>
  );
}

function CheckRow({ check }: { check: HealthCheck }): React.ReactElement {
  const meta = LEVEL_META[check.level];
  return (
    <li className="flex items-start gap-3 px-6 py-3">
      <span className="mt-0.5">{meta.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{check.title}</span>
          <Badge variant={meta.variant} className="shrink-0">
            {meta.label}
          </Badge>
        </div>
        {check.message ? <p className="mt-0.5 text-sm text-muted-foreground">{check.message}</p> : null}
      </div>
    </li>
  );
}

function groupByLevel(checks: readonly HealthCheck[]): Record<Level, HealthCheck[]> {
  const groups: Record<Level, HealthCheck[]> = { fail: [], warn: [], info: [], pass: [] };
  for (const check of [...checks].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level])) {
    groups[check.level].push(check);
  }
  return groups;
}
