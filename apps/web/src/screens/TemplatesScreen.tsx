import * as React from 'react';
import { Button, cn } from '@re-shell/ui';
import { FilterX, LayoutGrid, SlidersHorizontal } from 'lucide-react';
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

  return (
    <div className="screen-enter">
      <TemplatesContent templates={data} />
    </div>
  );
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
  const clearAll = (): void =>
    setFilters(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])));

  return (
    <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
      {/* Filter rail — sticky, dense, distinct from the card grid. */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="surface flex flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="label-eyebrow inline-flex items-center gap-2">
              <SlidersHorizontal className="size-3.5 text-signal" />
              Filters
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={!hasActiveFilters}
              onClick={clearAll}
            >
              <FilterX className="size-3.5" />
              Clear
            </Button>
          </div>
          <div className="grid gap-3.5 p-4">
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
          </div>
        </div>
      </aside>

      {/* Result grid + count header. */}
      <section className="grid auto-rows-min gap-4">
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 font-display text-base font-semibold tracking-tight">
            <LayoutGrid className="size-4 text-signal" />
            Template catalog
          </h2>
          <span className="cli-chip py-1 text-xs">
            <span className="font-semibold text-foreground tabular-nums">{filtered.length}</span>
            <span className="text-muted-foreground">/ {templates.length}</span>
          </span>
        </div>

        {filtered.length === 0 ? (
          <EmptyPanel
            title="No templates match these filters"
            description="Adjust or clear the filters to see more templates."
            action={
              <Button type="button" variant="outline" size="sm" onClick={clearAll}>
                <FilterX className="size-4" />
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="stagger-children grid auto-rows-min gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((template) => (
              <TemplateCard key={template.id} template={template} onShowDetails={setSelected} />
            ))}
          </div>
        )}
      </section>

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
      <label htmlFor={id} className="label-eyebrow normal-case tracking-[0.04em]">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'h-9 w-full rounded-md border border-border bg-bg-0 px-2.5 font-mono text-[0.8125rem] text-foreground/90',
          'shadow-elev-1 transition-colors duration-fast outline-none',
          'hover:border-border-strong focus-visible:border-signal focus-visible:shadow-focus-ring',
          value ? 'text-foreground' : 'text-muted-foreground'
        )}
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
