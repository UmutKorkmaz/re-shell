import * as React from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Label,
} from '@umutkorkmaz/ui';
import { FilterX } from 'lucide-react';
import { useEnvelopeQuery } from './shared/useEnvelopeQuery';
import { EmptyPanel, EnvelopeErrorPanel, ErrorPanel, LoadingPanel } from './shared/StatePanels';
import { templateListSchema, type TemplateFeed } from './shared/feedSchemas';
import { useUrlState } from './shared/useUrlState';
import { feedToTemplateSummary, facetValues } from './templates/templateAdapters';
import { TemplateCard } from './templates/TemplateCard';
import { TemplateDetailDrawer } from './templates/TemplateDetailDrawer';

const FILTER_KEYS = ['domain', 'language', 'framework', 'database'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

export function TemplatesScreen(): React.ReactElement {
  const { data, isLoading, error, envelopeError, refetch } = useEnvelopeQuery(
    'templates.list',
    templateListSchema
  );

  if (isLoading) {
    return <LoadingPanel title="Loading templates…" description="Fetching templates.list from the hub." />;
  }

  if (error) {
    return <ErrorPanel title="Could not reach the hub" description={error.message} onRetry={() => refetch()} />;
  }

  if (envelopeError) {
    return <EnvelopeErrorPanel code={envelopeError.code} message={envelopeError.message} />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyPanel
        title="No templates"
        description="The hub returned an empty template catalog."
      />
    );
  }

  return <TemplatesContent templates={data} />;
}

function TemplatesContent({ templates }: { templates: TemplateFeed[] }): React.ReactElement {
  const [filters, setFilters] = useUrlState<FilterKey>(FILTER_KEYS);
  const [selected, setSelected] = React.useState<TemplateFeed | null>(null);

  const options = React.useMemo(
    () => ({
      domain: facetValues(templates, (s) => s.domain),
      language: facetValues(templates, (s) => s.language),
      framework: facetValues(templates, (s) => s.framework),
      database: facetValues(templates, (s) => s.database),
    }),
    [templates]
  );

  const filtered = React.useMemo(
    () =>
      templates.filter((template) => {
        const summary = feedToTemplateSummary(template);
        if (filters.domain && summary.domain !== filters.domain) return false;
        if (filters.language && summary.language !== filters.language) return false;
        if (filters.framework && summary.framework !== filters.framework) return false;
        if (filters.database && summary.database !== filters.database) return false;
        return true;
      }),
    [templates, filters]
  );

  const hasActiveFilters = FILTER_KEYS.some((key) => filters[key] !== '');

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          {FILTER_KEYS.map((key) => (
            <FilterSelect
              key={key}
              id={`filter-${key}`}
              label={key}
              value={filters[key]}
              options={options[key]}
              onChange={(value) => setFilters({ [key]: value })}
            />
          ))}
          <div className="ml-auto flex items-center gap-3">
            <Badge variant="secondary">
              {filtered.length} / {templates.length}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasActiveFilters}
              onClick={() => setFilters(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])))}
            >
              <FilterX className="size-4" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyPanel
          title="No templates match these filters"
          description="Adjust or clear the filters to see more templates."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFilters(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])))}
            >
              <FilterX className="size-4" />
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((template) => (
            <TemplateCard key={template.id} template={template} onShowDetails={setSelected} />
          ))}
        </div>
      )}

      <TemplateDetailDrawer
        template={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}): React.ReactElement {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs capitalize text-muted-foreground">
        {label}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-40 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
