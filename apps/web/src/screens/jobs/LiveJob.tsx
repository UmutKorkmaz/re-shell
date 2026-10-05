import * as React from 'react';
import { JobLogPanel, cn, useJob, type JobLine } from '@re-shell/ui';
import type { JobRecord } from '@re-shell/contracts';

/**
 * One live, self-contained streaming job. Owns a single `useJob` instance keyed
 * to a stable `{ commandId, params }`, auto-starts on mount, and renders into the
 * shared `JobLogPanel`. The hook redacts secrets in the lines it yields; this
 * component reads only `msg.content`-derived `lines` (via the hook) and never
 * re-exposes a raw stream, so display stays redacted.
 */
export interface LiveJobSpec {
  /** Stable id for this job instance (drives the React key + correlation). */
  readonly key: string;
  readonly commandId: string;
  readonly params?: unknown;
  /** The vetted argv to echo in the panel header (display only). */
  readonly command: readonly string[];
  /** Working directory echoed in the record (display only). */
  readonly cwd?: string;
}

/** What the jobs table needs to know about a running job (reported up by {@link LiveJob}). */
export interface JobSnapshot {
  readonly status: JobRecord['status'];
  readonly exitCode: number | null;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly lineCount: number;
}

interface LiveJobProps {
  spec: LiveJobSpec;
  onRemove?: (key: string) => void;
  /** Called whenever the job's observable state changes (drives the master table). */
  onState?: (key: string, snapshot: JobSnapshot) => void;
  /**
   * Keep the job mounted (so it keeps streaming) but hide it: the master/detail view shows one
   * job's output at a time while every launched job continues to run.
   */
  hidden?: boolean;
}

/** Render the redacted lines into the flat string[] JobLogPanel expects. */
function toDisplayLines(lines: readonly JobLine[]): string[] {
  return lines.map((line) => (line.stream === 'stderr' ? `[stderr] ${line.text}` : line.text));
}

export function LiveJob({ spec, onRemove, onState, hidden = false }: LiveJobProps): React.ReactElement {
  const { lines, status, exitCode, error, start, cancel } = useJob(spec.commandId, spec.params);

  // Capture start/end timestamps for the duration readout. `startedAt` is set
  // once on the first run; `finishedAt` once the job reaches a terminal state.
  const [startedAt] = React.useState<string>(() => new Date().toISOString());
  const [finishedAt, setFinishedAt] = React.useState<string | undefined>();
  const startedRef = React.useRef(false);

  // Auto-start exactly once when the job is mounted.
  React.useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    start();
  }, [start]);

  const isTerminal =
    status === 'success' || status === 'failed' || status === 'cancelled';

  React.useEffect(() => {
    if (isTerminal && !finishedAt) {
      setFinishedAt(new Date().toISOString());
    }
  }, [isTerminal, finishedAt]);

  const lineCount = lines.length;
  React.useEffect(() => {
    onState?.(spec.key, {
      status,
      exitCode: typeof exitCode === 'number' ? exitCode : null,
      startedAt,
      finishedAt,
      lineCount,
    });
  }, [onState, spec.key, status, exitCode, startedAt, finishedAt, lineCount]);

  const job: JobRecord = {
    id: spec.key,
    commandId: spec.commandId,
    command: [...spec.command],
    cwd: spec.cwd ?? '',
    status,
    startedAt,
    finishedAt,
    // exitCode is intentionally omitted when null so the panel does not render a
    // stray "exit null"; numeric codes (including non-zero) are passed through.
    ...(typeof exitCode === 'number' ? { exitCode } : {}),
  };

  const displayLines = React.useMemo(() => {
    const out = toDisplayLines(lines);
    if (error) {
      out.push(`[error] ${error.message}`);
    }
    if (isTerminal) {
      out.push(formatSummary(status, exitCode, startedAt, finishedAt));
    }
    return out;
  }, [lines, error, isTerminal, status, exitCode, startedAt, finishedAt]);

  return (
    <div
      // `hidden` alone loses to `display: grid`; the utility class wins the cascade.
      className={cn('grid gap-2', hidden && 'hidden')}
      hidden={hidden}
      data-testid="live-job"
      data-job-command={spec.command.join(' ')}
      data-job-status={status}
      data-job-exit-code={typeof exitCode === 'number' ? exitCode : undefined}
    >
      <JobLogPanel job={job} logs={displayLines} onCancel={() => cancel()} headingAs="h3" />
      {isTerminal && onRemove ? (
        <button
          type="button"
          className="justify-self-end rounded-sm text-xs text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:shadow-focus-ring"
          onClick={() => onRemove(spec.key)}
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

/** Human-readable terminal summary line: status, exit code, and duration. */
function formatSummary(
  status: JobRecord['status'],
  exitCode: number | null,
  startedAt: string,
  finishedAt: string | undefined
): string {
  const code = typeof exitCode === 'number' ? `exit ${exitCode}` : 'no exit code';
  const duration = formatDuration(startedAt, finishedAt);
  return `— ${status} (${code})${duration ? ` in ${duration}` : ''} —`;
}

/** `842ms` / `3.4s` / `2m 05s`; empty until both ends are known. */
export function formatDuration(startedAt: string, finishedAt: string | undefined): string {
  if (!finishedAt) {
    return '';
  }
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) {
    return '';
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}
