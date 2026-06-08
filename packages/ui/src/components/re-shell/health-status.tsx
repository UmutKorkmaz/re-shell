import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { HealthSummary } from '@/contracts';
type HealthLevel = HealthSummary['checks'][number]['level'];

const statusMap: Record<
  HealthSummary['status'],
  { label: string; className: string; variant: 'success' | 'warning' | 'destructive' | 'outline' }
> = {
  pass: { label: 'Healthy', className: 'text-emerald-600', variant: 'success' },
  warn: { label: 'Warning', className: 'text-amber-600', variant: 'warning' },
  fail: { label: 'Critical', className: 'text-red-600', variant: 'destructive' }
};

function LevelIcon({ level }: { level: HealthLevel }): React.ReactElement {
  if (level === 'pass') return <CheckCircle2 className="size-4 text-emerald-600" />;
  if (level === 'warn') return <TriangleAlert className="size-4 text-amber-600" />;
  if (level === 'fail') return <AlertCircle className="size-4 text-red-600" />;
  return <Info className="size-4 text-muted-foreground" />;
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
        <CardTitle className="text-base">Workspace health</CardTitle>
        <Badge variant={status.variant}>{status.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className={cn('text-3xl font-semibold tracking-normal', status.className)}>{health.score}</div>
          <div className="text-sm text-muted-foreground">Readiness score</div>
        </div>
        <div className="space-y-2">
          {health.checks.slice(0, 5).map((check) => (
            <div key={check.id} className="flex items-start gap-2 rounded-md border p-3">
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
