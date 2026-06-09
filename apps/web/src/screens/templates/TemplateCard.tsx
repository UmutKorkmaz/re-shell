import * as React from 'react';
import {
  Button,
  CommandPreview,
  TemplateCatalogCard,
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
 * copy. Copy always copies the exact command currently shown.
 */
export function TemplateCard({ template, onShowDetails }: TemplateCardProps): React.ReactElement {
  const [dryRun, setDryRun] = React.useState(false);
  const summary = React.useMemo(() => feedToTemplateSummary(template), [template]);
  const command = React.useMemo(() => scaffoldCommand(template, dryRun), [template, dryRun]);

  return (
    <div className="grid gap-2">
      <TemplateCatalogCard template={summary} onSelect={() => onShowDetails(template)} />
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
        className="justify-start"
        onClick={() => onShowDetails(template)}
      >
        <Info className="size-4" />
        View details
      </Button>
    </div>
  );
}
