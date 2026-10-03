import * as React from 'react';
import { ScrollArea, cn } from '@re-shell/ui';
import type { JobRecord } from '@re-shell/contracts';
import { formatDuration, type JobSnapshot, type LiveJobSpec } from './LiveJob';

/**
 * The master list of the Jobs & Logs screen: a DENSE table (h-9 rows, mono ids / durations /
 * counts with tabular numerals, a status badge per row) next to the streaming console of the
 * selected job. Every row is operable by keyboard: Tab reaches each job's select button, Enter or
 * Space selects it, and ArrowUp / ArrowDown move between rows.
 */
export interface JobRow {
  readonly spec: LiveJobSpec;
  /** 1-based launch order, shown as `#n`. */
  readonly seq: number;
  readonly snapshot?: JobSnapshot;
}

interface JobsTableProps {
  rows: readonly JobRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** Current time (ms) used for the live duration of running jobs. */
  now: number;
}

const STATUS: Record<JobRecord['status'], { label: string; className: string }> = {
  queued: { label: 'queued', className: 'border-border bg-bg-1 text-muted-foreground' },
  running: { label: 'running', className: 'status-info' },
  success: { label: 'success', className: 'status-healthy' },
  failed: { label: 'failed', className: 'status-critical' },
  cancelled: { label: 'cancelled', className: 'border-border bg-bg-1 text-muted-foreground' },
};

/** Clock time (`14:03:09`) of an ISO timestamp, in the viewer's locale. */
function clock(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour12: false });
}

export function JobsTable({ rows, selectedKey, onSelect, now }: JobsTableProps): React.ReactElement {
  const tableRef = React.useRef<HTMLTableElement>(null);

  const moveFocus = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = Array.from(tableRef.current?.querySelectorAll<HTMLButtonElement>('button[data-job-select]') ?? []);
    const index = buttons.indexOf(event.currentTarget);
    const next = buttons[index + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  return (
    <div className="surface min-w-0 overflow-hidden" data-testid="jobs-table">
      <ScrollArea label="Jobs table">
        <table ref={tableRef} className="w-full border-collapse text-sm">
          <caption className="sr-only">Launched jobs, newest first. Select a job to show its output.</caption>
          <thead>
            <tr className="h-8 border-b border-border text-left">
              <th scope="col" className="label-eyebrow px-3 font-semibold">ID</th>
              <th scope="col" className="label-eyebrow px-3 font-semibold">Command</th>
              <th scope="col" className="label-eyebrow px-3 font-semibold">Status</th>
              <th scope="col" className="label-eyebrow px-3 text-right font-semibold">Started</th>
              <th scope="col" className="label-eyebrow px-3 text-right font-semibold">Duration</th>
              <th scope="col" className="label-eyebrow px-3 text-right font-semibold">Lines</th>
              <th scope="col" className="label-eyebrow px-3 text-right font-semibold">Exit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ spec, seq, snapshot }) => {
              const selected = spec.key === selectedKey;
              const status = snapshot?.status ?? 'queued';
              const meta = STATUS[status];
              const terminal = status === 'success' || status === 'failed' || status === 'cancelled';
              const duration = snapshot
                ? formatDuration(snapshot.startedAt, snapshot.finishedAt ?? (terminal ? undefined : new Date(now).toISOString()))
                : '';
              return (
                <tr
                  key={spec.key}
                  data-selected={selected || undefined}
                  className={cn(
                    'h-9 border-b border-border last:border-b-0',
                    selected ? 'bg-bg-2 shadow-[inset_2px_0_0_0_var(--signal)]' : 'hover:bg-bg-2/60'
                  )}
                >
                  <td className="px-3 font-mono tabular-nums text-muted-foreground">#{seq}</td>
                  <td className="max-w-[16rem] px-3">
                    <button
                      type="button"
                      data-job-select
                      aria-pressed={selected}
                      aria-label={`Show output of job ${seq}: ${spec.command.join(' ')}`}
                      onClick={() => onSelect(spec.key)}
                      onKeyDown={moveFocus}
                      className="block w-full truncate rounded-sm text-left font-mono text-[0.8125rem] outline-none focus-visible:shadow-focus-ring"
                    >
                      {spec.command.slice(1).join(' ')}
                    </button>
                  </td>
                  <td className="px-3">
                    <span className={cn('status-badge', meta.className)} data-testid={`job-status-${seq}`}>
                      {status === 'running' ? (
                        <span aria-hidden className="size-1.5 animate-pulse-live rounded-full bg-signal" />
                      ) : null}
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-3 text-right font-mono tabular-nums text-muted-foreground">
                    {snapshot ? clock(snapshot.startedAt) : ''}
                  </td>
                  <td className="px-3 text-right font-mono tabular-nums">{duration}</td>
                  <td className="px-3 text-right font-mono tabular-nums text-muted-foreground">{snapshot?.lineCount ?? 0}</td>
                  <td className="px-3 text-right font-mono tabular-nums">{snapshot?.exitCode ?? ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}
