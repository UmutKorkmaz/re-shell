import * as React from 'react';
import {
  CommandPreview,
  HealthStatus,
  cn,
  createReShellCommand,
  formatCommand,
} from '@re-shell/ui';
import type { HealthCheck, HealthSummary } from '@re-shell/contracts';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  RotateCw,
  TriangleAlert,
} from 'lucide-react';
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
  { label: string; badge: string; icon: React.ReactNode }
> = {
  pass: { label: 'Pass', badge: 'status-healthy', icon: <CheckCircle2 className="size-4 text-healthy" /> },
  warn: { label: 'Warning', badge: 'status-warn', icon: <TriangleAlert className="size-4 text-warn" /> },
  fail: { label: 'Error', badge: 'status-critical', icon: <AlertCircle className="size-4 text-critical" /> },
  info: { label: 'Info', badge: 'status-info', icon: <Info className="size-4 text-info" /> },
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

  return (
    <div className="screen-enter">
      <HealthContent health={feedToHealthSummary(data)} onRefresh={() => refetch()} />
    </div>
  );
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
    <div className="stagger-children grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <HealthStatus health={health} />
        <CommandPreview spec={HEALTH_SPEC} />
      </div>

      <CheckGroup
        title="Errors"
        emptyLabel="No errors."
        checks={grouped.fail}
        tone="critical"
        onRefresh={onRefresh}
      />
      <CheckGroup title="Warnings" emptyLabel="No warnings." checks={grouped.warn} tone="warn" />
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
  tone: 'critical' | 'warn' | 'muted';
  onRefresh?: () => void;
}): React.ReactElement {
  const titleClass =
    tone === 'critical' ? 'text-critical' : tone === 'warn' ? 'text-warn' : 'text-foreground';
  const countClass =
    tone === 'critical'
      ? 'status-badge status-critical'
      : tone === 'warn'
        ? 'status-badge status-warn'
        : 'status-badge border-border bg-bg-1 text-muted-foreground';

  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <div className="min-w-0">
          <h3 className={cn('font-display text-base font-semibold tracking-tight', titleClass)}>{title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {checks.length === 0 ? emptyLabel : `${checks.length} check(s)`}
          </p>
        </div>
        <span className={cn(countClass, 'font-mono tabular-nums')}>{checks.length}</span>
      </div>
      {checks.length > 0 ? (
        <ul className="border-t border-border">
          {checks.map((check, index) => (
            <CheckRow key={check.id} check={check} first={index === 0} />
          ))}
        </ul>
      ) : null}
      {checks.length === 0 && onRefresh ? (
        <div className="border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            <RotateCw className="size-3.5" />
            Re-run checks
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CheckRow({ check, first }: { check: HealthCheck; first: boolean }): React.ReactElement {
  const meta = LEVEL_META[check.level];
  return (
    <li
      className={cn(
        'flex items-start gap-3 px-5 py-3 transition-colors hover:bg-bg-2/40',
        !first && 'border-t border-border'
      )}
    >
      <span className="mt-0.5">{meta.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{check.title}</span>
          <span className={cn('status-badge shrink-0', meta.badge)}>{meta.label}</span>
        </div>
        {check.message ? (
          <p className="mt-0.5 font-mono text-[0.8125rem] text-muted-foreground">{check.message}</p>
        ) : null}
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
