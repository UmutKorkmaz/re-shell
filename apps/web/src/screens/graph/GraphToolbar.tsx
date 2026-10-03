import * as React from 'react';
import { Button, cn } from '@re-shell/ui';
import { Download, FilterX, GitCompareArrows, Loader2, RefreshCw, Search } from 'lucide-react';
import { EXPORT_FORMATS, type ExportFormat } from './exporters';
import { FILTER_KEYS, hasActiveFilters, type FacetOptions, type FilterKey, type GraphFilters } from './graphFilters';
import { POLL_OPTIONS_SECONDS } from './useGraphUrlState';

const FACET_LABEL: Record<Exclude<FilterKey, 'q'>, string> = {
  language: 'Language',
  framework: 'Framework',
  type: 'Type',
  status: 'Status',
};

interface GraphToolbarProps {
  filters: GraphFilters;
  options: FacetOptions;
  onFilter: (next: Partial<GraphFilters>) => void;
  hide: boolean;
  onHide: (hide: boolean) => void;
  matchCount: number;
  totalCount: number;
  pollSeconds: number;
  onPoll: (seconds: number) => void;
  onRefreshStatus: () => void;
  statusFetching: boolean;
  onExport: (format: ExportFormat) => void;
  exporting: ExportFormat | null;
  diffActive: boolean;
  onToggleDiff: () => void;
}

const controlClass = cn(
  'h-8 rounded-md border border-border bg-bg-0 px-2 font-mono text-xs text-foreground/90 outline-none',
  'hover:border-border-strong focus-visible:border-signal focus-visible:shadow-focus-ring'
);

/** Search, facet filters, status polling, export and diff controls above the canvas. */
export function GraphToolbar(props: GraphToolbarProps): React.ReactElement {
  const { filters, options, onFilter } = props;
  const active = hasActiveFilters(filters);
  // Local text state keeps typing instant; the URL/filters follow on each change.
  const [text, setText] = React.useState(filters.q);
  React.useEffect(() => setText(filters.q), [filters.q]);

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-3" data-testid="graph-toolbar">
      <div className="grid gap-1">
        <label htmlFor="graph-search" className="label-eyebrow normal-case">
          Search
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2 size-4 text-muted-foreground" />
          <input
            id="graph-search"
            data-testid="graph-search"
            type="search"
            value={text}
            placeholder="name or path"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setText(event.target.value);
              onFilter({ q: event.target.value });
            }}
            className={cn(controlClass, 'w-56 pl-8')}
          />
        </div>
      </div>

      {(Object.keys(FACET_LABEL) as Array<Exclude<FilterKey, 'q'>>).map((key) => (
        <div key={key} className="grid gap-1">
          <label htmlFor={`graph-filter-${key}`} className="label-eyebrow normal-case">
            {FACET_LABEL[key]}
          </label>
          <select
            id={`graph-filter-${key}`}
            data-testid={`graph-filter-${key}`}
            value={filters[key]}
            onChange={(event) => onFilter({ [key]: event.target.value })}
            className={cn(controlClass, 'min-w-28', filters[key] ? 'text-foreground' : 'text-muted-foreground')}
          >
            <option value="">All</option>
            {options[key].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      ))}

      <label className="flex h-8 items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          data-testid="graph-hide-nonmatching"
          checked={props.hide}
          onChange={(event) => props.onHide(event.target.checked)}
        />
        Hide non-matching
      </label>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs"
        disabled={!active}
        data-testid="graph-clear-filters"
        onClick={() => onFilter(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])) as Partial<GraphFilters>)}
      >
        <FilterX className="size-3.5" />
        Clear
      </Button>

      <span className="cli-chip py-1 text-xs" data-testid="graph-match-count" data-matches={props.matchCount} data-total={props.totalCount}>
        <span className="font-semibold tabular-nums text-foreground">{props.matchCount}</span>
        <span className="text-muted-foreground">/ {props.totalCount} nodes</span>
      </span>

      <div className="ml-auto flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <label htmlFor="graph-poll" className="label-eyebrow normal-case">
            Live status
          </label>
          <div className="flex items-center gap-1">
            <select
              id="graph-poll"
              data-testid="graph-poll"
              value={props.pollSeconds}
              onChange={(event) => props.onPoll(Number(event.target.value))}
              className={cn(controlClass, 'min-w-24')}
            >
              {POLL_OPTIONS_SECONDS.map((s) => (
                <option key={s} value={s}>
                  {s === 0 ? 'Manual' : `Every ${s}s`}
                </option>
              ))}
              {POLL_OPTIONS_SECONDS.includes(props.pollSeconds as never) ? null : (
                <option value={props.pollSeconds}>{`Every ${props.pollSeconds}s`}</option>
              )}
            </select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              aria-label="Refresh status now"
              data-testid="graph-refresh-status"
              onClick={props.onRefreshStatus}
            >
              {props.statusFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            </Button>
          </div>
        </div>

        <Button
          type="button"
          variant={props.diffActive ? 'default' : 'outline'}
          size="sm"
          className="h-8"
          data-testid="graph-diff-toggle"
          aria-pressed={props.diffActive}
          onClick={props.onToggleDiff}
        >
          <GitCompareArrows className="size-3.5" />
          Diff
        </Button>

        <ExportMenu onExport={props.onExport} exporting={props.exporting} />
      </div>
    </div>
  );
}

function ExportMenu({
  onExport,
  exporting,
}: {
  onExport: (format: ExportFormat) => void;
  exporting: ExportFormat | null;
}): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8"
        data-testid="graph-export-menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
        Export
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-md border border-border bg-bg-1 shadow-elev-2"
        >
          {EXPORT_FORMATS.map((format) => (
            <button
              key={format.id}
              type="button"
              role="menuitem"
              data-testid={`graph-export-${format.id}`}
              disabled={exporting !== null}
              onClick={() => {
                setOpen(false);
                onExport(format.id);
              }}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-bg-2 disabled:opacity-50"
            >
              <span className="font-medium">{format.label}</span>
              <span className="text-xs text-muted-foreground">{format.hint}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
