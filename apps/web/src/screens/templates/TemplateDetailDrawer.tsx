import * as React from 'react';
import {
  Badge,
  CommandPreview,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  formatCommand,
} from '@re-shell/ui';
import { Loader2 } from 'lucide-react';
import { useEnvelopeQuery } from '../shared/useEnvelopeQuery';
import { templateFeedSchema, type TemplateFeed } from '../shared/feedSchemas';
import { scaffoldCommand } from './templateAdapters';

interface TemplateDetailDrawerProps {
  template: TemplateFeed | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Detail drawer for one template. Re-fetches the canonical record via
 * `templates.show` (so tags/features reflect the live registry, not the list
 * row) and falls back to the list row while loading or if show fails.
 */
export function TemplateDetailDrawer({
  template,
  onOpenChange,
}: TemplateDetailDrawerProps): React.ReactElement {
  return (
    <Sheet open={template !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
        {template ? <DetailBody template={template} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function DetailBody({ template }: { template: TemplateFeed }): React.ReactElement {
  const { data, isLoading, envelopeError } = useEnvelopeQuery('templates.show', templateFeedSchema, {
    id: template.id,
  });

  // Prefer the freshly-fetched record; fall back to the list row so the drawer
  // is always populated even while loading or if `templates.show` errors.
  const detail: TemplateFeed = data ?? template;
  const command = scaffoldCommand(detail, false);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <span className="min-w-0 truncate">{detail.displayName ?? detail.name}</span>
          {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
        </SheetTitle>
        <SheetDescription>{detail.description || 'No description provided.'}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">{detail.language}</Badge>
        <Badge variant="outline">{detail.framework}</Badge>
        {detail.version ? <Badge variant="outline">v{detail.version}</Badge> : null}
        {typeof detail.port === 'number' ? <Badge variant="outline">:{detail.port}</Badge> : null}
      </div>

      {envelopeError ? (
        <p className="text-sm text-muted-foreground">
          Showing the catalog row; live detail unavailable ({envelopeError.code}).
        </p>
      ) : null}

      <Separator />

      <Facet title="Tags" values={detail.tags} empty="No tags." />
      <Facet title="Features" values={detail.features} empty="No features listed." />

      <Separator />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold tracking-tight">Scaffold</h3>
        <CommandPreview
          spec={{
            title: 'Create from template',
            description: 'Scaffold a new project from this template.',
            command,
            commandText: formatCommand(command),
            destructive: false,
            dryRunSupported: false,
          }}
        />
      </div>
    </>
  );
}

function Facet({
  title,
  values,
  empty,
}: {
  title: string;
  values: readonly string[];
  empty: string;
}): React.ReactElement {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {values.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <Badge key={value} variant="outline" className="font-normal">
              {value}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
