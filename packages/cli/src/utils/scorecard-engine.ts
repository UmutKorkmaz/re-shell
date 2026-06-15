/**
 * Pure production-readiness scoring engine for `re-shell scorecard` (issue #12).
 *
 * This module is intentionally I/O-free and has ZERO dependency on
 * `@re-shell/contracts`: it operates on plain inputs (already-gathered signals)
 * and returns plain data structures. The orchestrating command is responsible
 * for gathering signals and projecting the result onto the wire contract. Keeping
 * the engine pure makes the weighting logic trivially unit-testable and free of
 * any startup/runtime coupling to the ESM-only contracts dist.
 */

/** Letter grade derived from a 0-100 score (A best, F worst). */
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * A weighted scorecard dimension after evaluation: its normalised 0-100 score,
 * weight, weighted contribution, pass flag, and optional human detail.
 */
export interface DimensionResult {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
  readonly score: number;
  readonly weighted: number;
  readonly pass: boolean;
  readonly detail?: string;
}

/** A single service's computed scorecard. */
export interface ServiceScorecard {
  readonly service: string;
  readonly path: string;
  readonly totalScore: number;
  readonly grade: Grade;
  readonly dimensions: readonly DimensionResult[];
  readonly warnings: readonly string[];
}

/** The monorepo rollup over all per-service scorecards. */
export interface ScorecardRollup {
  readonly score: number;
  readonly grade: Grade;
  readonly threshold: number;
  readonly pass: boolean;
  readonly services: readonly ServiceScorecard[];
  readonly driftEntries: number;
  readonly policyScore: number;
  readonly warnings: readonly string[];
}

/** Minimal service shape the engine needs (a projection of ServiceConfig). */
export interface ScorecardServiceInput {
  readonly name: string;
  readonly path: string;
  readonly scripts?: Readonly<Record<string, string>>;
  readonly healthCheck?: unknown;
  readonly port?: number;
}

/** The monorepo-level signals shared across every service. */
export interface ScorecardSignals {
  /** Normalised monorepo health score, 0-100. */
  readonly healthScore: number;
  /** False when no v1 workspace definition applies (health is neutralised). */
  readonly healthApplicable: boolean;
  /** Policy-pack score, 0-100. */
  readonly policyScore: number;
  /** Drift-derived score, 0-100. */
  readonly driftScore: number;
}

/** Rollup metadata that is reported but not scored per-service. */
export interface RollupMeta {
  readonly driftEntries: number;
  readonly policyScore: number;
}

/** One dimension definition: its id, label, weight, and source value resolver. */
interface DimensionSpec {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
}

/** Neutral score used when a signal is not applicable to the workspace. */
const NEUTRAL_SCORE = 100;
/** A dimension passes when its normalised score meets this threshold. */
const DIMENSION_PASS_THRESHOLD = 60;
/** Rollup score used when the workspace defines no services. */
const EMPTY_WORKSPACE_SCORE = 100;

/**
 * The six weighted dimensions. Weights MUST sum to 1.0 (asserted in tests). The
 * order is the canonical rendering order.
 */
export const WEIGHTS: readonly DimensionSpec[] = [
  { id: 'health', label: 'Workspace health', weight: 0.3 },
  { id: 'policy', label: 'Policy compliance', weight: 0.25 },
  { id: 'drift', label: 'Dependency drift', weight: 0.15 },
  { id: 'has-build', label: 'Build script', weight: 0.15 },
  { id: 'has-tests', label: 'Test script', weight: 0.1 },
  { id: 'has-health-endpoint', label: 'Health endpoint', weight: 0.05 },
];

/** Map a 0-100 score to its letter grade. */
export function toGrade(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/** Clamp a number into the [0, 100] range and round to one decimal place. */
function normalize(value: number): number {
  const clamped = Math.max(0, Math.min(100, value));
  return Math.round(clamped * 10) / 10;
}

/** True when a value is a present (non-empty) script entry. */
function hasScript(
  scripts: Readonly<Record<string, string>> | undefined,
  key: string
): boolean {
  const value = scripts?.[key];
  return typeof value === 'string' && value.trim().length > 0;
}

/** Resolve the raw 0-100 score for a single dimension id. */
function rawScoreFor(
  id: string,
  service: ScorecardServiceInput,
  signals: ScorecardSignals
): number {
  switch (id) {
    case 'health':
      return signals.healthApplicable ? signals.healthScore : NEUTRAL_SCORE;
    case 'policy':
      return signals.policyScore;
    case 'drift':
      return signals.driftScore;
    case 'has-build':
      return hasScript(service.scripts, 'build') ? 100 : 0;
    case 'has-tests':
      return hasScript(service.scripts, 'test') ? 100 : 0;
    case 'has-health-endpoint':
      return service.healthCheck != null || service.port != null ? 100 : 0;
    default:
      return 0;
  }
}

/** Optional human detail for a dimension (e.g. not-applicable health). */
function detailFor(id: string, signals: ScorecardSignals): string | undefined {
  if (id === 'health' && !signals.healthApplicable) {
    return 'not-applicable (no v1 workspace definition); scored neutral';
  }
  return undefined;
}

/**
 * Compute a single service's scorecard from the shared monorepo signals and the
 * service's own build/test/health-endpoint presence.
 */
export function computeServiceScorecard(
  service: ScorecardServiceInput,
  signals: ScorecardSignals
): ServiceScorecard {
  const dimensions: DimensionResult[] = WEIGHTS.map(spec => {
    const score = normalize(rawScoreFor(spec.id, service, signals));
    const weighted = Math.round(score * spec.weight * 10) / 10;
    const detail = detailFor(spec.id, signals);
    return {
      id: spec.id,
      label: spec.label,
      weight: spec.weight,
      score,
      weighted,
      pass: score >= DIMENSION_PASS_THRESHOLD,
      ...(detail ? { detail } : {}),
    };
  });

  const total = dimensions.reduce(
    (sum, dimension) => sum + dimension.score * dimension.weight,
    0
  );
  const totalScore = normalize(total);

  return {
    service: service.name,
    path: service.path,
    totalScore,
    grade: toGrade(totalScore),
    dimensions,
    warnings: [],
  };
}

/**
 * Roll the per-service scorecards up into a monorepo score (the average of the
 * per-service totals), grading and gating it against `threshold`. An empty
 * workspace scores {@link EMPTY_WORKSPACE_SCORE} with an explanatory warning.
 */
export function computeRollup(
  scorecards: readonly ServiceScorecard[],
  threshold: number,
  meta: RollupMeta
): ScorecardRollup {
  const warnings: string[] = [];

  let score: number;
  if (scorecards.length === 0) {
    score = EMPTY_WORKSPACE_SCORE;
    warnings.push('no services found; rollup defaulted to a neutral score');
  } else {
    const sum = scorecards.reduce((acc, card) => acc + card.totalScore, 0);
    score = normalize(sum / scorecards.length);
  }

  const pass = score >= threshold;
  if (!pass) {
    warnings.push(
      `rollup score ${score} is below the threshold of ${threshold}`
    );
  }

  return {
    score,
    grade: toGrade(score),
    threshold,
    pass,
    services: scorecards,
    driftEntries: meta.driftEntries,
    policyScore: meta.policyScore,
    warnings,
  };
}
