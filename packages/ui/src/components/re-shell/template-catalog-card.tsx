import * as React from 'react';
import { Boxes, Database, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    <Card className={className}>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{template.name}</CardTitle>
            {template.description ? <CardDescription className="mt-1">{template.description}</CardDescription> : null}
          </div>
          {template.tier === 1 ? <Badge variant="success">Tier 1</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1">
            <Layers className="size-3" />
            {template.domain}
          </Badge>
          {template.framework ? (
            <Badge variant="secondary" className="gap-1">
              <Boxes className="size-3" />
              {template.framework}
            </Badge>
          ) : null}
          {template.database ? (
            <Badge variant="secondary" className="gap-1">
              <Database className="size-3" />
              {template.database}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {template.tags.slice(0, 5).map((tag) => (
            <Badge key={tag} variant="outline" className="font-normal">
              {tag}
            </Badge>
          ))}
        </div>
        {template.command ? (
          <ScrollArea className="max-h-24 rounded-md border bg-muted/50">
            <pre className="re-shell-mono min-w-max p-3 text-xs text-foreground">{formatCommand(template.command)}</pre>
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
