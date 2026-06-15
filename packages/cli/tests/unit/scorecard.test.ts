import { describe, it, expect } from 'vitest';
import {
  toGrade,
  computeServiceScorecard,
  computeRollup,
  WEIGHTS,
  type ScorecardServiceInput,
  type ScorecardSignals,
  type ServiceScorecard,
} from '../../src/utils/scorecard-engine';
import { scorecardResponseSchema } from '@re-shell/contracts';

/**
 * Unit coverage for the pure scorecard engine (issue #12): grade boundaries,
 * per-service weighting (including health not-applicable neutralisation), the
 * weight invariant (sum to 1.0), the rollup average + threshold gate, and the
 * empty-workspace case. Finally, a built wire response is validated against the
 * contract schema so the projection cannot drift.
 */

/** A signals fixture with every monorepo signal at 100. */
const PERFECT_SIGNALS: ScorecardSignals = {
  healthScore: 100,
  healthApplicable: true,
  policyScore: 100,
  driftScore: 100,
};

/** Build a service-input fixture with sensible defaults. */
function svc(overrides: Partial<ScorecardServiceInput> = {}): ScorecardServiceInput {
  return {
    name: 'api',
    path: 'services/api',
    scripts: { build: 'tsc', test: 'vitest run' },
    healthCheck: { path: '/healthz' },
    port: 3000,
    ...overrides,
  };
}

describe('toGrade boundaries', () => {
  it('maps each score band to its letter grade', () => {
    expect(toGrade(100)).toBe('A');
    expect(toGrade(90)).toBe('A');
    expect(toGrade(89.9)).toBe('B');
    expect(toGrade(80)).toBe('B');
    expect(toGrade(79.9)).toBe('C');
    expect(toGrade(70)).toBe('C');
    expect(toGrade(69.9)).toBe('D');
    expect(toGrade(60)).toBe('D');
    expect(toGrade(59.9)).toBe('F');
    expect(toGrade(0)).toBe('F');
  });
});

describe('WEIGHTS invariant', () => {
  it('weights sum to 1.0', () => {
    const sum = WEIGHTS.reduce((acc, spec) => acc + spec.weight, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('exposes the six expected dimensions', () => {
    expect(WEIGHTS.map(w => w.id)).toEqual([
      'health',
      'policy',
      'drift',
      'has-build',
      'has-tests',
      'has-health-endpoint',
    ]);
  });
});

describe('computeServiceScorecard', () => {
  it('scores a fully-ready service as A / 100', () => {
    const card = computeServiceScorecard(svc(), PERFECT_SIGNALS);
    expect(card.totalScore).toBe(100);
    expect(card.grade).toBe('A');
    expect(card.dimensions.every(d => d.pass)).toBe(true);
  });

  it('lowers the score when build + test scripts are missing', () => {
    const card = computeServiceScorecard(
      svc({ scripts: {} }),
      PERFECT_SIGNALS
    );
    // has-build (0.15) + has-tests (0.10) drop to 0 → total 75.
    expect(card.totalScore).toBe(75);
    expect(card.grade).toBe('C');
    const buildDim = card.dimensions.find(d => d.id === 'has-build');
    const testDim = card.dimensions.find(d => d.id === 'has-tests');
    expect(buildDim?.score).toBe(0);
    expect(buildDim?.pass).toBe(false);
    expect(testDim?.score).toBe(0);
    expect(testDim?.pass).toBe(false);
  });

  it('neutralises health to 100 when not applicable (no penalty)', () => {
    const signals: ScorecardSignals = {
      healthScore: 0,
      healthApplicable: false,
      policyScore: 100,
      driftScore: 100,
    };
    const card = computeServiceScorecard(svc(), signals);
    const healthDim = card.dimensions.find(d => d.id === 'health');
    expect(healthDim?.score).toBe(100);
    expect(healthDim?.detail).toMatch(/not-applicable/);
    // Despite healthScore=0, the not-applicable neutral 100 keeps the total at 100.
    expect(card.totalScore).toBe(100);
  });

  it('treats port-only services as having a health endpoint', () => {
    const card = computeServiceScorecard(
      svc({ healthCheck: undefined, port: 8080 }),
      PERFECT_SIGNALS
    );
    const dim = card.dimensions.find(d => d.id === 'has-health-endpoint');
    expect(dim?.score).toBe(100);
  });

  it('scores a service with no endpoint signal at 0 for that dimension', () => {
    const card = computeServiceScorecard(
      svc({ healthCheck: undefined, port: undefined }),
      PERFECT_SIGNALS
    );
    const dim = card.dimensions.find(d => d.id === 'has-health-endpoint');
    expect(dim?.score).toBe(0);
  });
});

describe('computeRollup', () => {
  const meta = { driftEntries: 0, policyScore: 100 };

  it('averages the per-service totals', () => {
    const cards: ServiceScorecard[] = [
      computeServiceScorecard(svc(), PERFECT_SIGNALS), // 100
      computeServiceScorecard(svc({ name: 'web', scripts: {} }), PERFECT_SIGNALS), // 75
    ];
    const rollup = computeRollup(cards, 70, meta);
    expect(rollup.score).toBe(87.5);
    expect(rollup.grade).toBe('B');
    expect(rollup.services).toHaveLength(2);
  });

  it('passes when the rollup score meets the threshold', () => {
    const cards = [computeServiceScorecard(svc(), PERFECT_SIGNALS)];
    const rollup = computeRollup(cards, 90, meta);
    expect(rollup.pass).toBe(true);
    expect(rollup.warnings).toHaveLength(0);
  });

  it('fails and warns when the rollup score is below the threshold', () => {
    const cards = [
      computeServiceScorecard(svc({ scripts: {} }), PERFECT_SIGNALS), // 75
    ];
    const rollup = computeRollup(cards, 90, meta);
    expect(rollup.pass).toBe(false);
    expect(rollup.warnings.some(w => /below the threshold/.test(w))).toBe(true);
  });

  it('defaults an empty workspace to a neutral score with a warning', () => {
    const rollup = computeRollup([], 70, meta);
    expect(rollup.score).toBe(100);
    expect(rollup.pass).toBe(true);
    expect(rollup.warnings.some(w => /no services found/.test(w))).toBe(true);
  });

  it('reports the shared monorepo signal context', () => {
    const rollup = computeRollup([], 70, { driftEntries: 3, policyScore: 80 });
    expect(rollup.driftEntries).toBe(3);
    expect(rollup.policyScore).toBe(80);
  });
});

describe('wire contract conformance', () => {
  it('a built ScorecardResponse validates against scorecardResponseSchema', () => {
    const cards = [
      computeServiceScorecard(svc(), PERFECT_SIGNALS),
      computeServiceScorecard(svc({ name: 'web', scripts: {} }), PERFECT_SIGNALS),
    ];
    const rollup = computeRollup(cards, 70, { driftEntries: 0, policyScore: 100 });

    const payload = {
      score: rollup.score,
      grade: rollup.grade,
      threshold: rollup.threshold,
      pass: rollup.pass,
      services: rollup.services.map(card => ({
        service: card.service,
        path: card.path,
        totalScore: card.totalScore,
        grade: card.grade,
        dimensions: card.dimensions.map(d => ({
          id: d.id,
          label: d.label,
          weight: d.weight,
          score: d.score,
          weighted: d.weighted,
          pass: d.pass,
          ...(d.detail ? { detail: d.detail } : {}),
        })),
        warnings: [...card.warnings],
      })),
      driftEntries: rollup.driftEntries,
      policyScore: rollup.policyScore,
      warnings: [...rollup.warnings],
    };

    const parsed = scorecardResponseSchema.safeParse(payload);
    expect(
      parsed.success,
      JSON.stringify((parsed as { error?: { issues?: unknown[] } }).error?.issues?.[0])
    ).toBe(true);
  });
});
