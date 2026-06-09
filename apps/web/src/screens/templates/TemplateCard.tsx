import * as React from 'react';
import {
  Button,
  CommandPreview,
  TemplateCatalogCard,
  cn,
  formatCommand,
} from '@re-shell/ui';
import { Info } from 'lucide-react';
import type { TemplateFeed } from '../shared/feedSchemas';
import { feedToTemplateSummary, scaffoldCommand } from './templateAdapters';

interface TemplateCardProps {
  template: TemplateFeed;
  onShowDetails: (template: TemplateFeed) => void;
}

/**
 * A catalog entry: the shared `TemplateCatalogCard` (which marks Tier 1 and the
 * derived domain/framework/database facets) plus a `CommandPreview` of the
 * scaffold command with a per-card dry-run toggle that injects `--dry-run`, and
 * copy. Copy always copies the exact command currently shown. Tier-1 templates
 * get an accent glow ring so flagship templates read first in the grid.
 */
export function TemplateCard({ template, onShowDetails }: TemplateCardProps): React.ReactElement {
  const [dryRun, setDryRun] = React.useState(false);
  const summary = React.useMemo(() => feedToTemplateSummary(template), [template]);
  const command = React.useMemo(() => scaffoldCommand(template, dryRun), [template, dryRun]);
  const isTier1 = summary.tier === 1;

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2 rounded-lg p-px transition-all duration-normal ease-out-expo',
        isTier1
          ? 'bg-gradient-to-b from-signal/30 to-transparent shadow-glow-signal'
          : ''
      )}
    >
      <TemplateCatalogCard
        className={cn('h-full', isTier1 && 'border-signal/40')}
        template={summary}
        onSelect={() => onShowDetails(template)}
      />
      <div data-testid={`scaffold-${template.id}`}>
        <CommandPreview
          spec={{
            title: 'Scaffold command',
            description: dryRun
              ? 'Dry run — prints actions without writing files.'
              : 'Create from this template.',
            command,
            commandText: formatCommand(command),
            destructive: false,
            dryRunSupported: true,
          }}
          onDryRun={() => setDryRun((prev) => !prev)}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-start text-muted-foreground hover:text-foreground"
        onClick={() => onShowDetails(template)}
      >
        <Info className="size-4" />
        View details
      </Button>
    </div>
  );
}
