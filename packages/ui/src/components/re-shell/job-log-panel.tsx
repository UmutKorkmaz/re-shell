import * as React from 'react';
import { CircleStop, Clock, Terminal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCommand } from '@/lib/command';
import { cn } from '@/lib/utils';
import { LiveRegion } from '@/components/primitives/live-region';
import type { JobRecord } from '@/contracts';

const statusVariant: Record<JobRecord['status'], 'secondary' | 'healthy' | 'warn' | 'critical' | 'info' | 'outline'> = {
  queued: 'secondary',
  running: 'info',
  success: 'healthy',
  failed: 'critical',
  cancelled: 'outline'
};

export interface JobLogPanelProps {
  job: JobRecord;
  logs: string[];
  onCancel?: (job: JobRecord) => void;
  className?: string;
}

function statusAnnouncement(job: JobRecord): string {
  switch (job.status) {
    case 'running':
      return 'Job running';
    case 'success':
      return 'Job succeeded';
    case 'failed':
      return typeof job.exitCode === 'number' ? `Job failed with exit code ${job.exitCode}` : 'Job failed';
    case 'cancelled':
      return 'Job cancelled';
    default:
      return 'Job queued';
  }
}

export function JobLogPanel({ job, logs, onCancel, className }: JobLogPanelProps): React.ReactElement {
  // Lines present on first render are history; lines appended afterwards flash in.
  const initialCount = React.useRef(logs.length);
  return (
    <Card className={className}>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="size-4 text-signal" />
            Job logs
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusVariant[job.status]} className="gap-1.5">
              {job.status === 'running' ? (
                <span className="size-1.5 animate-pulse-live rounded-full bg-signal" aria-hidden="true" />
              ) : null}
              {job.status}
            </Badge>
            {job.startedAt ? (
              <Badge variant="outline" className="gap-1 font-mono tabular-nums normal-case tracking-normal">
                <Clock className="size-3" />
                {job.startedAt}
              </Badge>
            ) : null}
            {typeof job.exitCode === 'number' ? <Badge variant="outline" className="font-mono tabular-nums normal-case tracking-normal">exit {job.exitCode}</Badge> : null}
          </div>
        </div>
        <div className="re-shell-mono truncate rounded-md border border-border bg-bg-0 px-3 py-2 text-muted-foreground">
          {formatCommand(job.command)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea label="Job output" className="h-72 rounded-md border border-border bg-bg-0 text-foreground/90 shadow-elev-1">
          {/* role="log" is an implicit polite live region: appended output is announced. */}
          <div
            role="log"
            aria-label="Job output"
            aria-relevant="additions"
            className="p-4 font-mono text-[0.78rem] leading-[1.4]"
          >
            {logs.length ? (
              logs.map((line, index) => (
                <div
                  // Log lines are append-only, so the index is a stable key.
                  key={index}
                  className={cn(
                    'whitespace-pre-wrap break-words',
                    index >= initialCount.current && 'animate-log-flash'
                  )}
                >
                  {line}
                </div>
              ))
            ) : (
              <span>No logs yet.</span>
            )}
          </div>
        </ScrollArea>
        <LiveRegion>{statusAnnouncement(job)}</LiveRegion>
        {job.status === 'running' ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onCancel?.(job)} disabled={!onCancel}>
            <CircleStop className="size-4" />
            Cancel
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
