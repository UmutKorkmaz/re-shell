// `re-shell ui test` — PURE Storybook-test result aggregator (issue #22).
//
// Aggregates raw per-story results (interaction + a11y + visual, the three
// pillars Storybook 9 collapsed into one runner) into a UI-maturity score
// (0-100) + a per-dimension breakdown that feeds the production-readiness
// scorecard as a UI-maturity dimension. The actual headless runner is
// INJECTABLE — the command layer shells out to `storybook test` (or accepts
// pre-collected results), this file only aggregates. Pure: no I/O, no mutation.

/** The three Storybook-9 test pillars. */
export type UiTestKind = 'interaction' | 'a11y' | 'visual';

/** One story's terminal result across the three pillars. */
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

/** Per-dimension rollup. */
export interface UiDimensionRollup {
  readonly kind: UiTestKind;
  readonly total: number;
  readonly passed: number;
  /** Pass rate in [0, 100]. */
  readonly passRate: number;
}

/** The aggregate UI-test result feeding the scorecard. */
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

/** Weights for the three pillars in the UI-maturity rollup (sum to 1.0). */
export const UI_MATURITY_WEIGHTS: Readonly<Record<UiTestKind, number>> = {
  // A11y is weighted highest: a failing a11y audit is a hard accessibility
  // regression, while a visual flake is often cosmetic. Interaction sits between.
  a11y: 0.45,
  interaction: 0.35,
  visual: 0.2,
};

/** Default gate: a11y or visual failures fail the CI check (configurable). */
export type UiGateKind = 'a11y' | 'visual' | 'interaction';

/** Default pillars that gate CI: a failing a11y or visual test fails the run. */
export const DEFAULT_UI_GATE: readonly UiGateKind[] = ['a11y', 'visual'];

/**
 * Aggregate raw per-story results into a UI-maturity rollup. Pure: the input
 * array is never mutated. The score is the weighted sum of per-dimension pass
 * rates (each in [0,100]) using {@link UI_MATURITY_WEIGHTS}. Empty input yields
 * a 0 score (no stories → no UI maturity signal).
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

/** One per-pillar failure for the report. */
export interface UiFailureLite {
  readonly story: string;
  readonly kind: UiTestKind;
  readonly detail?: string;
}

/** Flatten failing stories into per-pillar failures for the wire report. */
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
