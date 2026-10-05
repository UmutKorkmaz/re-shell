import * as React from 'react';
import { Button } from '@re-shell/ui';
import type { CollabAnalytics } from '@re-shell/contracts';
import { BarChart3 } from 'lucide-react';

import { InlineError, Panel, formatDuration } from './shared';

export type AnalyticsRange = '24h' | '7d' | '30d';

export const RANGE_MS: Record<AnalyticsRange, number> = {
  '24h': 24 * 3_600_000,
  '7d': 7 * 24 * 3_600_000,
  '30d': 30 * 24 * 3_600_000,
};

export interface AnalyticsPanelProps {
  analytics: CollabAnalytics | null;
  error: string | null;
  loading: boolean;
  range: AnalyticsRange;
  onRange: (range: AnalyticsRange) => void;
  onRefresh: () => void;
}

function percent(rate: number | null): string {
  return rate === null ? 'n/a' : `${Math.round(rate * 100)}%`;
}

function Tile({ label, value, hint, testId }: { label: string; value: string; hint?: string; testId: string }): React.ReactElement {
  return (
    <div className="rounded-md border border-border bg-bg-1 px-4 py-3" data-testid={testId}>
      <div className="label-eyebrow">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

/** Bars of commands per time bucket; failures are drawn in the critical colour. */
function Timeline({ analytics }: { analytics: CollabAnalytics }): React.ReactElement {
  const { buckets } = analytics.timeline;
  const max = Math.max(1, ...buckets.map((b) => b.commands));
  const total = buckets.reduce((n, b) => n + b.commands, 0);
  const width = 600;
  const height = 80;
  const barWidth = width / Math.max(1, buckets.length);
  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Commands over time: ${total} in ${buckets.length} intervals`}
        className="h-20 w-full"
        preserveAspectRatio="none"
        data-testid="collab-timeline"
      >
        {buckets.map((b, i) => {
          const h = (b.commands / max) * (height - 4);
          const failedH = (b.failed / max) * (height - 4);
          return (
            <g key={b.start}>
              <rect x={i * barWidth + 0.5} y={height - h} width={Math.max(1, barWidth - 1)} height={h} className="fill-signal">
                <title>{`${new Date(b.start).toLocaleString()}: ${b.commands} command(s), ${b.failed} failed`}</title>
              </rect>
              {b.failed > 0 ? (
                <rect x={i * barWidth + 0.5} y={height - failedH} width={Math.max(1, barWidth - 1)} height={failedH} className="fill-critical" />
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs text-muted-foreground">
        Commands per {formatDuration(analytics.timeline.bucketMs)} interval (red = failed)
      </figcaption>
    </figure>
  );
}

function Table({
  caption,
  rows,
  head,
  testId,
}: {
  caption: string;
  head: string[];
  rows: string[][];
  testId: string;
}): React.ReactElement {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" data-testid={testId}>
        <caption className="mb-1 text-left label-eyebrow">{caption}</caption>
        <thead>
          <tr className="text-xs text-muted-foreground">
            {head.map((h) => (
              <th key={h} className="py-1 pr-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="py-1 text-muted-foreground" colSpan={head.length}>
                No data in this window.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row[0]} className="border-t border-border">
                {row.map((cell, i) => (
                  <td key={i} className={i === 0 ? 'py-1 pr-4 font-mono' : 'py-1 pr-4 tabular-nums'}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Per-tenant team analytics (operator-gated on the server). */
export function AnalyticsPanel(props: AnalyticsPanelProps): React.ReactElement {
  const { analytics, error, loading, range } = props;
  return (
    <Panel
      testId="collab-analytics"
      icon={<BarChart3 className="size-3.5 text-signal" />}
      title="Team analytics"
      description="Commands, sessions and decisions in this tenant, from the jobs, sessions and audit tables."
      actions={
        <>
          {(['24h', '7d', '30d'] as const).map((r) => (
            <Button
              key={r}
              type="button"
              size="sm"
              variant={r === range ? 'secondary' : 'outline'}
              aria-pressed={r === range}
              data-testid={`collab-range-${r}`}
              onClick={() => props.onRange(r)}
            >
              {r}
            </Button>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={props.onRefresh} aria-label="Refresh analytics">
            Refresh
          </Button>
        </>
      }
    >
      {error ? <InlineError message={error} /> : null}
      {loading && !analytics ? <p className="text-sm text-muted-foreground">Loading analytics...</p> : null}
      {analytics ? (
        <div className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Tile
              testId="collab-tile-commands"
              label="Commands"
              value={String(analytics.commands.total)}
              hint={`${analytics.commands.succeeded} ok · ${analytics.commands.failed} failed · ${analytics.commands.canceled} canceled`}
            />
            <Tile testId="collab-tile-success" label="Success rate" value={percent(analytics.commands.successRate)} hint="finished runs only" />
            <Tile
              testId="collab-tile-sessions"
              label="Sessions"
              value={String(analytics.sessions.started)}
              hint={`${analytics.sessions.active} active · ${analytics.sessions.commandsRun} commands run in sessions`}
            />
            <Tile
              testId="collab-tile-duration"
              label="Avg session length"
              value={analytics.sessions.avgDurationMs === null ? 'n/a' : formatDuration(analytics.sessions.avgDurationMs)}
              hint={`longest ${formatDuration(analytics.sessions.maxDurationMs)}`}
            />
            <Tile
              testId="collab-tile-participants"
              label="Participants"
              value={String(analytics.sessions.distinctParticipants)}
              hint={
                analytics.sessions.avgParticipants === null
                  ? 'distinct people'
                  : `distinct people · ${analytics.sessions.avgParticipants.toFixed(1)} per session`
              }
            />
            <Tile
              testId="collab-tile-denied"
              label="Denied decisions"
              value={String(analytics.audit.denied)}
              hint={`${analytics.audit.allowed} allowed · ${analytics.audit.authFailures} auth failures`}
            />
          </div>
          <Timeline analytics={analytics} />
          <div className="grid gap-5 lg:grid-cols-2">
            <Table
              testId="collab-table-users"
              caption="Commands per user"
              head={['User', 'Total', 'OK', 'Failed']}
              rows={analytics.commands.byUser.map((u) => [u.userId, String(u.total), String(u.succeeded), String(u.failed)])}
            />
            <Table
              testId="collab-table-workspaces"
              caption="Commands per workspace"
              head={['Workspace', 'Total', 'OK', 'Failed']}
              rows={analytics.commands.byWorkspace.map((w) => [w.workspaceId, String(w.total), String(w.succeeded), String(w.failed)])}
            />
            <Table
              testId="collab-table-commands"
              caption="Commands per command id"
              head={['Command', 'Total', 'OK', 'Failed']}
              rows={analytics.commands.byCommand.map((c) => [c.commandId, String(c.total), String(c.succeeded), String(c.failed)])}
            />
            <Table
              testId="collab-table-session-workspaces"
              caption="Sessions per workspace"
              head={['Workspace', 'Sessions', 'Time']}
              rows={analytics.sessions.byWorkspace.map((w) => [w.workspaceId, String(w.sessions), formatDuration(w.totalDurationMs)])}
            />
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
