import * as React from 'react';
import { Boxes, Server } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { WorkspaceApp, WorkspaceService } from '@/contracts';

type TopologyItem = WorkspaceApp | WorkspaceService;

const statusVariant: Record<TopologyItem['status'], 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  unknown: 'outline',
  stopped: 'secondary',
  running: 'success',
  error: 'destructive'
};

export interface TopologyNodeCardProps {
  item: TopologyItem;
  kind: 'app' | 'service';
  className?: string;
}

export function TopologyNodeCard({ item, kind, className }: TopologyNodeCardProps): React.ReactElement {
  const Icon = kind === 'app' ? Boxes : Server;

  return (
    <Card className={className}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="rounded-md bg-muted p-2">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{item.name}</div>
              <div className="truncate text-xs text-muted-foreground">{item.path}</div>
            </div>
          </div>
          <Badge variant={statusVariant[item.status]}>{item.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.framework ? <Badge variant="secondary">{item.framework}</Badge> : null}
          {item.port ? <Badge variant="outline">:{item.port}</Badge> : null}
        </div>
      </CardContent>
    </Card>
  );
}
