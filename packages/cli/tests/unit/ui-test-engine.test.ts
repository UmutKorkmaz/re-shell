import { describe, it, expect } from 'vitest';
import {
  aggregateUiTests,
  passesGate,
  flattenFailures,
  UI_MATURITY_WEIGHTS,
  DEFAULT_UI_GATE,
  type StoryResult,
} from '../../src/utils/ui-test-engine';
import { uiTestResponseSchema } from '@re-shell/contracts';

/** Pure-engine conformance for `re-shell ui test` (issue #22). */

function story(id: string, over: Partial<StoryResult> = {}): StoryResult {
  return { id, interaction: true, a11y: true, visual: true, ...over };
}

describe('aggregateUiTests', () => {
  it('scores 100 when every story passes every pillar', () => {
    const agg = aggregateUiTests([story('a'), story('b')]);
    expect(agg.uiMaturityScore).toBe(100);
    expect(agg.allPassed).toBe(true);
    expect(agg.failingStories).toEqual([]);
    expect(agg.dimensions.every(d => d.passed === d.total)).toBe(true);
  });

  it('scores 0 for an empty run (no signal)', () => {
    const agg = aggregateUiTests([]);
    expect(agg.uiMaturityScore).toBe(0);
    expect(agg.allPassed).toBe(false);
    expect(agg.storyCount).toBe(0);
  });

  it('weights a11y heaviest: an a11y failure hurts the score more than a visual one', () => {
    const a11yFail = aggregateUiTests([story('a', { a11y: false })]);
    const visualFail = aggregateUiTests([story('a', { visual: false })]);
    // a11y weight (0.45) > visual weight (0.2), so the a11y failure scores lower.
    expect(a11yFail.uiMaturityScore).toBeLessThan(visualFail.uiMaturityScore);
    expect(UI_MATURITY_WEIGHTS.a11y).toBeGreaterThan(UI_MATURITY_WEIGHTS.visual);
  });

  it('records failing stories and per-dimension pass rates', () => {
    const agg = aggregateUiTests([
      story('a'),
      story('b', { a11y: false, visual: false }),
    ]);
    expect(agg.failingStories.map(s => s.id)).toEqual(['b']);
    const a11y = agg.dimensions.find(d => d.kind === 'a11y')!;
    expect(a11y.passed).toBe(1);
    expect(a11y.total).toBe(2);
    expect(a11y.passRate).toBe(50);
  });

  it('never mutates the input array', () => {
    const results = [story('a', { a11y: false })];
    const snapshot = JSON.stringify(results);
    aggregateUiTests(results);
    expect(JSON.stringify(results)).toBe(snapshot);
  });
});

describe('passesGate', () => {
  it('passes when no gated pillar fails', () => {
    const agg = aggregateUiTests([story('a'), story('b')]);
    expect(passesGate(agg, DEFAULT_UI_GATE)).toBe(true);
  });

  it('fails the default gate on an a11y failure', () => {
    const agg = aggregateUiTests([story('a', { a11y: false })]);
    expect(passesGate(agg, DEFAULT_UI_GATE)).toBe(false);
  });

  it('fails the default gate on a visual failure', () => {
    const agg = aggregateUiTests([story('a', { visual: false })]);
    expect(passesGate(agg, DEFAULT_UI_GATE)).toBe(false);
  });

  it('does NOT fail the default gate on an interaction-only failure', () => {
    const agg = aggregateUiTests([story('a', { interaction: false })]);
    expect(passesGate(agg, DEFAULT_UI_GATE)).toBe(true);
  });

  it('honours a custom gate (interaction-only gate)', () => {
    const agg = aggregateUiTests([story('a', { interaction: false })]);
    expect(passesGate(agg, ['interaction'])).toBe(false);
  });

  it('passes when there are no stories', () => {
    expect(passesGate(aggregateUiTests([]))).toBe(true);
  });
});

describe('flattenFailures', () => {
  it('emits one entry per failing pillar, sorted by kind then story', () => {
    const agg = aggregateUiTests([
      story('b', { a11y: false, visual: false }),
      story('a', { interaction: false }),
    ]);
    const flat = flattenFailures(agg);
    expect(flat.map(f => `${f.kind}:${f.story}`)).toEqual([
      'a11y:b',
      'interaction:a',
      'visual:b',
    ]);
  });
});

describe('contracts conformance', () => {
  it('a constructed ui-test response validates against uiTestResponseSchema', () => {
    const agg = aggregateUiTests([story('a', { a11y: false })]);
    const payload = {
      storyCount: agg.storyCount,
      dimensions: agg.dimensions.map(d => ({ kind: d.kind, total: d.total, passed: d.passed, passRate: d.passRate })),
      uiMaturityScore: agg.uiMaturityScore,
      allPassed: agg.allPassed,
      pass: passesGate(agg),
      failures: flattenFailures(agg).map(f => ({ story: f.story, kind: f.kind })),
      warnings: [],
    };
    expect(uiTestResponseSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects an unknown pillar kind against the schema', () => {
    const payload = {
      storyCount: 1,
      dimensions: [{ kind: 'snap', total: 1, passed: 1, passRate: 100 }],
      uiMaturityScore: 100,
      allPassed: true,
      pass: true,
      failures: [],
      warnings: [],
    };
    expect(uiTestResponseSchema.safeParse(payload).success).toBe(false);
  });
});
