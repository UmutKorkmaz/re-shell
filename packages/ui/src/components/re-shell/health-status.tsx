import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { HealthSummary } from '@/contracts';
type HealthLevel = HealthSummary['checks'][number]['level'];

const statusMap: Record<
  HealthSummary['status'],
  { label: string; className: string; variant: 'healthy' | 'warn' | 'critical' }
> = {
  pass: { label: 'Healthy', className: 'text-healthy', variant: 'healthy' },
  warn: { label: 'Warning', className: 'text-warn', variant: 'warn' },
  fail: { label: 'Critical', className: 'text-critical', variant: 'critical' }
};

function LevelIcon({ level }: { level: HealthLevel }): React.ReactElement {
  if (level === 'pass') return <CheckCircle2 className="size-4 text-healthy" />;
  if (level === 'warn') return <TriangleAlert className="size-4 text-warn" />;
  if (level === 'fail') return <AlertCircle className="size-4 text-critical" />;
  return <Info className="size-4 text-info" />;
}

export interface HealthStatusProps {
  health: HealthSummary;
  className?: string;
}

export function HealthStatus({ health, className }: HealthStatusProps): React.ReactElement {
  const status = statusMap[health.status];

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="label-eyebrow !text-muted-foreground">Workspace health</CardTitle>
        <Badge variant={status.variant}>{status.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className={cn('font-mono text-[1.75rem] font-bold tabular-nums tracking-tight', status.className)}>
            {health.score}
          </div>
          <div className="label-eyebrow mt-0.5">Readiness score</div>
        </div>
        <div className="space-y-2">
          {health.checks.slice(0, 5).map((check) => (
            <div key={check.id} className="flex items-start gap-2 rounded-md border border-border bg-bg-2/40 p-3">
              <LevelIcon level={check.level} />
              <div className="min-w-0">
                <div className="text-sm font-medium">{check.title}</div>
                {check.message ? <div className="text-sm text-muted-foreground">{check.message}</div> : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
