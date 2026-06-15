import * as React from 'react';
import {
  CommandPreview,
  cn,
  createReShellCommand,
  formatCommand,
} from '@re-shell/ui';
import { useEnvelopeQuery } from './shared/useEnvelopeQuery';
import { EnvelopeErrorPanel, ErrorPanel, LoadingPanel } from './shared/StatePanels';
import { catalogFeedSchema, type CatalogFeed, type CatalogEntityFeed } from './shared/feedSchemas';

const CATALOG_COMMAND = createReShellCommand(['catalog'], { json: true });

const CATALOG_SPEC = {
  title: 'Software catalog',
  description:
    'Every service, microfrontend, and API auto-discovered from the workspace graph — serialized for Backstage interop.',
  command: CATALOG_COMMAND,
  commandText: formatCommand(CATALOG_COMMAND),
  destructive: false,
  dryRunSupported: false,
} as const;

/** Tailwind tone per entity kind, reusing the shared status palette. */
const KIND_TONE: Record<string, { badge: string; text: string }> = {
  Component: { badge: 'status-healthy', text: 'text-healthy' },
  API: { badge: 'status-warn', text: 'text-warn' },
  Group: { badge: 'border-border bg-bg-1', text: 'text-foreground' },
  System: { badge: 'status-healthy', text: 'text-healthy' },
  Resource: { badge: 'status-critical', text: 'text-critical' },
  Domain: { badge: 'border-border bg-bg-1', text: 'text-foreground' },
};

function toneFor(kind: string) {
  return KIND_TONE[kind] ?? { badge: 'border-border bg-bg-1', text: 'text-muted-foreground' };
}

export function CatalogScreen(): React.ReactElement {
  const { data, isLoading, error, envelopeError, refetch } = useEnvelopeQuery(
    'catalog',
    catalogFeedSchema
  );

  if (isLoading) {
    return (
      <LoadingPanel
        title="Discovering catalog…"
        description="Building the software catalog from the workspace graph."
      />
    );
  }

  if (error) {
    return (
      <ErrorPanel
        title="Could not reach the hub"
        description={error.message}
        onRetry={() => refetch()}
      />
    );
  }

  if (envelopeError) {
    return (
      <div className="grid gap-4">
        <EnvelopeErrorPanel
          code={envelopeError.code}
          message={envelopeError.message}
          action={
            <p className="text-sm text-muted-foreground">
              Initialize a workspace with services, then re-run the catalog below.
            </p>
          }
        />
        <CommandPreview spec={CATALOG_SPEC} />
      </div>
    );
  }

  if (!data) {
    return (
      <ErrorPanel
        title="No catalog data"
        description="The hub returned an empty catalog payload."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="screen-enter">
      <CatalogContent data={data} />
    </div>
  );
}

function CatalogContent({ data }: { data: CatalogFeed }): React.ReactElement {
  const grouped = React.useMemo(() => {
    const byKind = new Map<string, CatalogEntityFeed[]>();
    for (const entity of data.entities) {
      const list = byKind.get(entity.kind) ?? [];
      list.push(entity);
      byKind.set(entity.kind, list);
    }
    return [...byKind.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data.entities]);

  return (
    <div className="stagger-children grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <CountsCard data={data} />
        <CommandPreview spec={CATALOG_SPEC} />
      </div>

      {grouped.map(([kind, entities]) => (
        <EntityGroup key={kind} kind={kind} entities={entities} />
      ))}

      {data.warnings.length > 0 ? <WarningsPanel warnings={data.warnings} /> : null}
    </div>
  );
}

function CountsCard({ data }: { data: CatalogFeed }): React.ReactElement {
  return (
    <div className="surface relative overflow-hidden p-5">
      <div className="label-eyebrow">Catalog</div>
      <div className="mt-2 font-display text-3xl font-bold tracking-tight">
        {data.system}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {data.entities.length} entit{data.entities.length === 1 ? 'y' : 'ies'} discovered
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Components" value={data.counts.components} />
        <Stat label="APIs" value={data.counts.apis} />
        <Stat label="Groups" value={data.counts.groups} />
        <Stat label="Systems" value={data.counts.systems} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <div className="rounded-md border border-border bg-bg-1 px-3 py-2">
      <dt className="label-eyebrow">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function EntityGroup({
  kind,
  entities,
}: {
  kind: string;
  entities: CatalogEntityFeed[];
}): React.ReactElement {
  const tone = toneFor(kind);
  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold tracking-tight">
            {kind}
            <span className="ml-2 align-middle font-mono text-xs tabular-nums text-muted-foreground">
              {entities.length}
            </span>
          </h3>
        </div>
      </div>
      <ul className="border-t border-border">
        {entities.map((entity, index) => (
          <EntityRow key={`${entity.kind}-${entity.metadata.name}`} entity={entity} first={index === 0} />
        ))}
      </ul>
    </div>
  );
}

function EntityRow({
  entity,
  first,
}: {
  entity: CatalogEntityFeed;
  first: boolean;
}): React.ReactElement {
  const tone = toneFor(entity.kind);
  const etype = typeof entity.spec.type === 'string' ? entity.spec.type : '';
  const owner = typeof entity.spec.owner === 'string' ? entity.spec.owner : '';

  return (
    <li
      className={cn(
        'flex items-start gap-4 px-5 py-3.5 transition-colors hover:bg-bg-2/40',
        !first && 'border-t border-border'
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">{entity.metadata.name}</span>
          {etype ? (
            <span className={cn('status-badge shrink-0 font-mono text-[0.7rem]', tone.badge)}>
              {etype}
            </span>
          ) : null}
          {owner ? (
            <span className="font-mono text-xs text-muted-foreground">owner: {owner}</span>
          ) : null}
        </div>
        {entity.metadata.description ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {entity.metadata.description}
          </p>
        ) : null}
        {entity.metadata.tags.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {entity.metadata.tags.map((tag) => (
              <span
                key={tag}
                className="status-badge shrink-0 border-border bg-bg-1 font-mono text-[0.7rem] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function WarningsPanel({ warnings }: { warnings: readonly string[] }): React.ReactElement {
  return (
    <div className="surface overflow-hidden">
      <div className="px-5 py-3.5">
        <h3 className="font-display text-base font-semibold tracking-tight text-warn">
          Warnings
        </h3>
      </div>
      <ul className="border-t border-border">
        {warnings.map((warning, index) => (
          <li
            key={`${index}-${warning}`}
            className={cn(
              'px-5 py-2.5 font-mono text-[0.8125rem] text-muted-foreground',
              index > 0 && 'border-t border-border'
            )}
          >
            {warning}
          </li>
        ))}
      </ul>
    </div>
  );
}
