import * as React from 'react';
import { Activity, Boxes, GitBranch, Server, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { WorkspaceSummary } from '@/contracts';

export interface WorkspaceSummaryPanelProps {
  workspace: WorkspaceSummary;
  onRunHealth?: () => void;
  onOpenSettings?: () => void;
  className?: string;
}

export function WorkspaceSummaryPanel({
  workspace,
  onRunHealth,
  onOpenSettings,
  className
}: WorkspaceSummaryPanelProps): React.ReactElement {
  return (
    <Card className={className}>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <CardTitle className="truncate font-display text-xl font-semibold tracking-tight">
              {workspace.name}
            </CardTitle>
            <div className="truncate font-mono text-[0.8125rem] text-muted-foreground">{workspace.path}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onRunHealth} disabled={!onRunHealth}>
              <Activity className="size-4" />
              Health
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onOpenSettings}
              disabled={!onOpenSettings}
              aria-label="Open settings"
            >
              <Settings className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric icon={<Boxes className="size-4" />} label="Apps" value={workspace.apps.length} />
          <SummaryMetric icon={<Server className="size-4" />} label="Services" value={workspace.services.length} />
          <SummaryMetric label="Package manager" value={workspace.packageManager} />
          <SummaryMetric label="Node" value={workspace.nodeVersion ?? 'unknown'} />
        </div>
        {workspace.git ? (
          <>
            <Separator className="my-4" />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <GitBranch className="size-4 text-muted-foreground" />
              <span className="font-mono text-[0.8125rem]">{workspace.git.branch ?? 'unknown'}</span>
              <Badge variant={workspace.git.dirty ? 'warn' : 'healthy'}>
                {workspace.git.dirty ? 'Dirty workspace' : 'Clean workspace'}
              </Badge>
              {workspace.git.ahead ? (
                <Badge variant="outline" className="font-mono tracking-normal">
                  ahead {workspace.git.ahead}
                </Badge>
              ) : null}
              {workspace.git.behind ? (
                <Badge variant="outline" className="font-mono tracking-normal">
                  behind {workspace.git.behind}
                </Badge>
              ) : null}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryMetric({
  icon,
  label,
  value
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="surface-raised p-4">
      <div className="label-eyebrow flex items-center gap-2">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-mono text-xl font-bold tabular-nums tracking-tight">{value}</div>
    </div>
  );
}
