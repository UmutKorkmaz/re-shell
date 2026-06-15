import * as React from 'react';
import {
  CommandPreview,
  cn,
  createReShellCommand,
  formatCommand,
} from '@re-shell/ui';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useEnvelopeQuery } from './shared/useEnvelopeQuery';
import { EnvelopeErrorPanel, ErrorPanel, LoadingPanel } from './shared/StatePanels';
import {
  scorecardFeedSchema,
  type ScorecardFeed,
  type ScorecardServiceFeed,
} from './shared/feedSchemas';

const SCORECARD_COMMAND = createReShellCommand(['scorecard'], { json: true });

const SCORECARD_SPEC = {
  title: 'Production-readiness scorecard',
  description:
    'Weighted score over health, policy, drift, and per-service build/test/health-endpoint signals.',
  command: SCORECARD_COMMAND,
  commandText: formatCommand(SCORECARD_COMMAND),
  destructive: false,
  dryRunSupported: false,
} as const;

type Grade = ScorecardFeed['grade'];

/** Tailwind token classes per grade band, reusing the shared status palette. */
const GRADE_TONE: Record<Grade, { text: string; badge: string; ring: string }> = {
  A: { text: 'text-healthy', badge: 'status-healthy', ring: 'border-healthy/40' },
  B: { text: 'text-healthy', badge: 'status-healthy', ring: 'border-healthy/30' },
  C: { text: 'text-warn', badge: 'status-warn', ring: 'border-warn/40' },
  D: { text: 'text-warn', badge: 'status-warn', ring: 'border-warn/30' },
  F: { text: 'text-critical', badge: 'status-critical', ring: 'border-critical/40' },
};

export function ScorecardScreen(): React.ReactElement {
  const { data, isLoading, error, envelopeError, refetch } = useEnvelopeQuery(
    'scorecard',
    scorecardFeedSchema
  );

  if (isLoading) {
    return (
      <LoadingPanel
        title="Scoring workspace…"
        description="Fetching the production-readiness scorecard from the hub."
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
              Initialize a workspace, then re-run the scorecard below.
            </p>
          }
        />
        <CommandPreview spec={SCORECARD_SPEC} />
      </div>
    );
  }

  if (!data) {
    return (
      <ErrorPanel
        title="No scorecard data"
        description="The hub returned an empty scorecard payload."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="screen-enter">
      <ScorecardContent data={data} />
    </div>
  );
}

function ScorecardContent({ data }: { data: ScorecardFeed }): React.ReactElement {
  const ranked = React.useMemo(
    () => [...data.services].sort((a, b) => a.totalScore - b.totalScore),
    [data.services]
  );

  return (
    <div className="stagger-children grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <RollupCard data={data} />
        <CommandPreview spec={SCORECARD_SPEC} />
      </div>

      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold tracking-tight">
              Per-service grades
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Worst-first, so the weakest services surface before the rest.
            </p>
          </div>
          <span className="status-badge border-border bg-bg-1 font-mono tabular-nums text-muted-foreground">
            {data.services.length}
          </span>
        </div>

        {ranked.length > 0 ? (
          <ul className="border-t border-border">
            {ranked.map((service, index) => (
              <ServiceRow key={service.service} service={service} first={index === 0} />
            ))}
          </ul>
        ) : (
          <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
            No services to score.
          </p>
        )}
      </div>

      {data.warnings.length > 0 ? <WarningsPanel warnings={data.warnings} /> : null}
    </div>
  );
}

function RollupCard({ data }: { data: ScorecardFeed }): React.ReactElement {
  const tone = GRADE_TONE[data.grade];
  return (
    <div className={cn('surface relative overflow-hidden border-2 p-5', tone.ring)}>
      <div className="label-eyebrow">Monorepo rollup</div>
      <div className="mt-3 flex items-end gap-4">
        <span className={cn('font-display text-6xl font-black leading-none', tone.text)}>
          {data.grade}
        </span>
        <div className="pb-1">
          <div className="font-mono text-2xl font-bold tabular-nums">
            {data.score.toFixed(1)}
            <span className="text-base text-muted-foreground">/100</span>
          </div>
          <GateBadge pass={data.pass} threshold={data.threshold} />
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Policy score" value={`${data.policyScore.toFixed(0)}/100`} />
        <Stat label="Dependency drift" value={`${data.driftEntries} dep(s)`} />
      </dl>
    </div>
  );
}

function GateBadge({
  pass,
  threshold,
}: {
  pass: boolean;
  threshold: number;
}): React.ReactElement {
  return (
    <span
      className={cn(
        'mt-1 inline-flex items-center gap-1.5 text-xs font-medium',
        pass ? 'text-healthy' : 'text-critical'
      )}
    >
      {pass ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
      {pass ? 'Meets' : 'Below'} threshold {threshold}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-md border border-border bg-bg-1 px-3 py-2">
      <dt className="label-eyebrow">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function ServiceRow({
  service,
  first,
}: {
  service: ScorecardServiceFeed;
  first: boolean;
}): React.ReactElement {
  const tone = GRADE_TONE[service.grade];
  const failing = service.dimensions.filter(d => !d.pass);

  return (
    <li
      className={cn(
        'flex items-start gap-4 px-5 py-4 transition-colors hover:bg-bg-2/40',
        !first && 'border-t border-border'
      )}
    >
      <span
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-md border-2 font-display text-xl font-black tabular-nums',
          tone.ring,
          tone.text
        )}
        aria-label={`Grade ${service.grade}`}
      >
        {service.grade}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{service.service}</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {service.totalScore.toFixed(1)}/100
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {service.dimensions.map(dimension => (
            <span
              key={dimension.id}
              title={`${dimension.label}: ${dimension.score.toFixed(0)}/100${
                dimension.detail ? ` — ${dimension.detail}` : ''
              }`}
              className={cn(
                'status-badge shrink-0 font-mono text-[0.7rem]',
                dimension.pass ? 'status-healthy' : 'status-critical'
              )}
            >
              {dimension.id}
            </span>
          ))}
        </div>

        {failing.length > 0 ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Failing: {failing.map(d => d.label).join(', ')}
          </p>
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
