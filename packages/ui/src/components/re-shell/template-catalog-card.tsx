import * as React from 'react';
import { Boxes, Database, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatCommand } from '@/lib/command';
import type { TemplateSummary } from '@/contracts';

export interface TemplateCatalogCardProps {
  template: TemplateSummary;
  onDryRun?: (template: TemplateSummary) => void;
  onSelect?: (template: TemplateSummary) => void;
  className?: string;
}

export function TemplateCatalogCard({
  template,
  onDryRun,
  onSelect,
  className
}: TemplateCatalogCardProps): React.ReactElement {
  return (
    <Card
      className={cn(
        'group transition-all duration-normal ease-out-expo hover:-translate-y-0.5 hover:border-border-strong hover:shadow-elev-2',
        className
      )}
    >
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate">{template.name}</CardTitle>
            {template.description ? <CardDescription className="mt-1">{template.description}</CardDescription> : null}
          </div>
          {template.tier === 1 ? <Badge variant="healthy">Tier 1</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1 normal-case tracking-normal">
            <Layers className="size-3" />
            {template.domain}
          </Badge>
          {template.framework ? (
            <Badge variant="secondary" className="gap-1 normal-case tracking-normal">
              <Boxes className="size-3" />
              {template.framework}
            </Badge>
          ) : null}
          {template.database ? (
            <Badge variant="secondary" className="gap-1 normal-case tracking-normal">
              <Database className="size-3" />
              {template.database}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {template.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="rounded-sm border border-border bg-bg-0 px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
        {template.command ? (
          <ScrollArea className="max-h-24 rounded-md border border-border bg-bg-0">
            <pre className="font-mono min-w-max p-3 text-xs tabular-nums text-foreground">
              {formatCommand(template.command)}
            </pre>
          </ScrollArea>
        ) : null}
      </CardContent>
      <CardFooter className="gap-2">
        <Button type="button" size="sm" onClick={() => onSelect?.(template)} disabled={!onSelect}>
          Select
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onDryRun?.(template)} disabled={!onDryRun}>
          Dry run
        </Button>
      </CardFooter>
    </Card>
  );
}
