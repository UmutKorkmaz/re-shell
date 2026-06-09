import * as React from 'react';
import { Boxes, Server } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { WorkspaceApp, WorkspaceService } from '@/contracts';

type TopologyItem = WorkspaceApp | WorkspaceService;

const statusVariant: Record<TopologyItem['status'], 'secondary' | 'healthy' | 'warn' | 'critical' | 'outline'> = {
  unknown: 'outline',
  stopped: 'secondary',
  running: 'healthy',
  error: 'critical'
};

const statusGlow: Record<TopologyItem['status'], string> = {
  unknown: '',
  stopped: '',
  running: 'shadow-glow-healthy',
  error: 'shadow-glow-critical'
};

export interface TopologyNodeCardProps {
  item: TopologyItem;
  kind: 'app' | 'service';
  className?: string;
}

export function TopologyNodeCard({ item, kind, className }: TopologyNodeCardProps): React.ReactElement {
  const Icon = kind === 'app' ? Boxes : Server;

  return (
    <Card
      className={cn(
        'surface-raised transition-all duration-normal ease-out-expo hover:border-border-strong',
        statusGlow[item.status],
        className
      )}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="rounded-md border border-border bg-bg-0 p-2 text-signal">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-mono text-[0.8125rem] font-medium tracking-tight">{item.name}</div>
              <div className="truncate font-mono text-[0.6875rem] text-muted-foreground">{item.path}</div>
            </div>
          </div>
          <Badge variant={statusVariant[item.status]}>{item.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.framework ? (
            <Badge variant="secondary" className="normal-case tracking-normal">
              {item.framework}
            </Badge>
          ) : null}
          {item.port ? (
            <Badge variant="outline" className="font-mono tracking-normal">
              :{item.port}
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
