import * as React from 'react';
import { CircleStop, Clock, Terminal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCommand } from '@/lib/command';
import type { JobRecord } from '@/contracts';

const statusVariant: Record<JobRecord['status'], 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  queued: 'secondary',
  running: 'warning',
  success: 'success',
  failed: 'destructive',
  cancelled: 'outline'
};

export interface JobLogPanelProps {
  job: JobRecord;
  logs: string[];
  onCancel?: (job: JobRecord) => void;
  className?: string;
}

export function JobLogPanel({ job, logs, onCancel, className }: JobLogPanelProps): React.ReactElement {
  return (
    <Card className={className}>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="size-4" />
            Job logs
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusVariant[job.status]}>{job.status}</Badge>
            {job.startedAt ? (
              <Badge variant="outline" className="gap-1">
                <Clock className="size-3" />
                {job.startedAt}
              </Badge>
            ) : null}
            {typeof job.exitCode === 'number' ? <Badge variant="outline">exit {job.exitCode}</Badge> : null}
          </div>
        </div>
        <div className="re-shell-mono truncate rounded-md bg-muted px-3 py-2 text-muted-foreground">
          {formatCommand(job.command)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-72 rounded-md border bg-slate-950 text-slate-50">
          <pre className="re-shell-mono whitespace-pre-wrap p-4">{logs.length ? logs.join('\n') : 'No logs yet.'}</pre>
        </ScrollArea>
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
