// `re-shell ui test` — PURE Storybook-test result aggregator (issue #22).
//
// Aggregates raw per-story results (interaction + a11y + visual, the three
// pillars Storybook 9 collapsed into one runner) into a UI-maturity score
// (0-100) + a per-dimension breakdown that feeds the production-readiness
// scorecard as a UI-maturity dimension. The actual headless runner is
// INJECTABLE — the command layer shells out to `storybook test` (or accepts
// pre-collected results), this file only aggregates. Pure: no I/O, no mutation.

/**
 * The three Storybook-9 test pillars.
 *
 * - `interaction`: play-function interaction tests
 * - `a11y`: accessibility (axe) audits
 * - `visual`: visual regression / snapshot / chromatic tests
 */
export type UiTestKind = 'interaction' | 'a11y' | 'visual';

/**
 * One story's terminal result across the three pillars.
 *
 * Each boolean pillar is `true` when that story's test passed. Optional
 * `failures` captures the failure detail for any pillar that failed.
 */
export interface StoryResult {
  /** Story id (e.g. "components-button--primary"). */
  readonly id: string;
  /** Component / story title for display. */
  readonly title?: string;
  /** True when the interaction (play) test passed. */
  readonly interaction: boolean;
  /** True when the accessibility (a11y) audit passed. */
  readonly a11y: boolean;
  /** True when the visual (snapshot/chromatic) test passed. */
  readonly visual: boolean;
  /** Optional failure detail per pillar that failed. */
  readonly failures?: Partial<Record<UiTestKind, string>>;
}

/**
 * Per-dimension rollup summarizing one pillar across all stories.
 *
 * A dimension is one of the three {@link UiTestKind} pillars; this rollup
 * gives the total stories, the count that passed, and the pass rate.
 */
export interface UiDimensionRollup {
  /** The pillar this rollup describes. */
  readonly kind: UiTestKind;
  /** Total number of stories evaluated for this pillar. */
  readonly total: number;
  /** Number of stories that passed this pillar. */
  readonly passed: number;
  /** Pass rate in [0, 100]. */
  readonly passRate: number;
}

/**
 * The aggregate UI-test result feeding the scorecard.
 *
 * Produced by {@link aggregateUiTests}; combines a weighted UI-maturity
 * score with per-dimension rollups and the list of failing stories.
 */
export interface UiTestAggregate {
  /** Number of stories run. */
  readonly storyCount: number;
  /** Per-dimension rollup (interaction / a11y / visual). */
  readonly dimensions: readonly UiDimensionRollup[];
  /** Weighted UI-maturity score, 0-100 (a11y-weighted so an a11y failure hurts). */
  readonly uiMaturityScore: number;
  /** True only when every pillar of every story passed. */
  readonly allPassed: boolean;
  /** Stories with at least one failing pillar. */
  readonly failingStories: readonly StoryResult[];
}

/**
 * Weights for the three pillars in the UI-maturity rollup (sum to 1.0).
 *
 * Used by {@link aggregateUiTests} to compute {@link UiTestAggregate.uiMaturityScore}.
 * A11y is weighted highest because a failing a11y audit is a hard accessibility
 * regression, while a visual flake is often cosmetic. Interaction sits between.
 */
export const UI_MATURITY_WEIGHTS: Readonly<Record<UiTestKind, number>> = {
  // A11y is weighted highest: a failing a11y audit is a hard accessibility
  // regression, while a visual flake is often cosmetic. Interaction sits between.
  a11y: 0.45,
  interaction: 0.35,
  visual: 0.2,
};

/**
 * Default gate: a11y or visual failures fail the CI check (configurable).
 *
 * Alias of {@link UiTestKind} used to express which pillars gate CI by default.
 */
export type UiGateKind = 'a11y' | 'visual' | 'interaction';

/**
 * Default pillars that gate CI: a failing a11y or visual test fails the run.
 *
 * Consumed as the default `gateKinds` argument of {@link passesGate}.
 */
export const DEFAULT_UI_GATE: readonly UiGateKind[] = ['a11y', 'visual'];

/**
 * Aggregate raw per-story results into a UI-maturity rollup. Pure: the input
 * array is never mutated. The score is the weighted sum of per-dimension pass
 * rates (each in [0,100]) using {@link UI_MATURITY_WEIGHTS}. Empty input yields
 * a 0 score (no stories → no UI maturity signal).
 *
 * @param results - Read-only list of per-story results across the three pillars.
 * @returns The aggregate UI-test rollup, including the weighted score,
 * per-dimension breakdown, and the list of failing stories.
 */
export function aggregateUiTests(results: readonly StoryResult[]): UiTestAggregate {
  const kinds: UiTestKind[] = ['interaction', 'a11y', 'visual'];
  const dimensions: UiDimensionRollup[] = kinds.map(kind => {
    const total = results.length;
    const passed = results.filter(r => r[kind]).length;
    return {
      kind,
      total,
      passed,
      passRate: total === 0 ? 0 : (passed / total) * 100,
    };
  });

  const score = dimensions.reduce(
    (sum, d) => sum + d.passRate * UI_MATURITY_WEIGHTS[d.kind],
    0
  );
  const failingStories = results.filter(r => !r.interaction || !r.a11y || !r.visual);
  const allPassed = results.length > 0 && failingStories.length === 0;

  return {
    storyCount: results.length,
    dimensions,
    uiMaturityScore: Math.round(score * 10) / 10,
    allPassed,
    failingStories,
  };
}

/**
 * Decide whether the aggregate PASSES the CI gate. By default a failing a11y OR
 * visual pillar on any story fails the gate (a11y/visual regressions gate CI;
 * interaction-only flakes do not by default). `gateKinds` is configurable.
 *
 * @param aggregate - The aggregate UI-test rollup to evaluate.
 * @param gateKinds - Pillars that gate CI (defaults to {@link DEFAULT_UI_GATE}).
 * @returns `true` when no configured gate pillar has any failing story (or when
 * there are no stories to gate); `false` otherwise.
 */
export function passesGate(
  aggregate: UiTestAggregate,
  gateKinds: readonly UiGateKind[] = DEFAULT_UI_GATE
): boolean {
  if (aggregate.storyCount === 0) return true; // no stories → nothing to gate
  return gateKinds.every(kind => {
    const dim = aggregate.dimensions.find(d => d.kind === kind);
    return dim ? dim.passed === dim.total : true;
  });
}

/**
 * One per-pillar failure for the report.
 *
 * A lightweight, serializable view of a single failing pillar on a single story.
 */
export interface UiFailureLite {
  /** Id of the story that failed this pillar. */
  readonly story: string;
  /** The pillar that failed. */
  readonly kind: UiTestKind;
  /** Optional failure detail captured from the runner. */
  readonly detail?: string;
}

/**
 * Flatten failing stories into per-pillar failures for the wire report.
 *
 * Each failing story expands into one entry per failing pillar, sorted
 * deterministically by pillar kind then story id.
 *
 * @param aggregate - The aggregate UI-test rollup whose `failingStories` to flatten.
 * @returns A deterministic, per-pillar list of failures suitable for the report.
 */
export function flattenFailures(aggregate: UiTestAggregate): UiFailureLite[] {
  const out: UiFailureLite[] = [];
  for (const story of aggregate.failingStories) {
    if (!story.interaction) out.push({ story: story.id, kind: 'interaction', detail: story.failures?.interaction });
    if (!story.a11y) out.push({ story: story.id, kind: 'a11y', detail: story.failures?.a11y });
    if (!story.visual) out.push({ story: story.id, kind: 'visual', detail: story.failures?.visual });
  }
  // Deterministic ordering: kind, then story id.
  return out.sort((a, b) =>
    a.kind !== b.kind ? a.kind.localeCompare(b.kind) : a.story.localeCompare(b.story)
  );
}
