import { describe, it, expect } from 'vitest';
import {
  toGrade,
  computeServiceScorecard,
  computeRollup,
  WEIGHTS,
  type ScorecardServiceInput,
  type ScorecardSignals,
} from '../../src/utils/scorecard-engine';

const baseSignals: ScorecardSignals = {
  healthScore: 90,
  healthApplicable: true,
  policyScore: 85,
  driftScore: 95,
};

const baseService: ScorecardServiceInput = {
  name: 'web',
  path: '/repo/packages/web',
  scripts: { build: 'tsc', test: 'vitest' },
  healthCheck: { path: '/health' },
  port: 3000,
};

describe('toGrade', () => {
  it('returns A for score >= 90', () => {
    expect(toGrade(90)).toBe('A');
    expect(toGrade(100)).toBe('A');
  });

  it('returns B for 80 <= score < 90', () => {
    expect(toGrade(80)).toBe('B');
    expect(toGrade(89)).toBe('B');
  });

  it('returns C for 70 <= score < 80', () => {
    expect(toGrade(70)).toBe('C');
    expect(toGrade(79)).toBe('C');
  });

  it('returns D for 60 <= score < 70', () => {
    expect(toGrade(60)).toBe('D');
    expect(toGrade(69)).toBe('D');
  });

  it('returns F for score < 60', () => {
    expect(toGrade(59)).toBe('F');
    expect(toGrade(0)).toBe('F');
  });
});

describe('WEIGHTS', () => {
  it('sums to 1.0', () => {
    const sum = WEIGHTS.reduce((acc, w) => acc + w.weight, 0);
    expect(Math.round(sum * 100) / 100).toBe(1.0);
  });

  it('has exactly 6 dimensions', () => {
    expect(WEIGHTS).toHaveLength(6);
  });

  it('contains expected dimension ids', () => {
    const ids = WEIGHTS.map(w => w.id);
    expect(ids).toEqual([
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
  it('computes a high score for a service with build, test, and health endpoint', () => {
    const card = computeServiceScorecard(baseService, baseSignals);
    expect(card.service).toBe('web');
    expect(card.path).toBe('/repo/packages/web');
    expect(card.totalScore).toBeGreaterThan(80);
    expect(card.grade).toBe('A');
    expect(card.dimensions).toHaveLength(6);
    expect(card.warnings).toEqual([]);
  });

  it('scores health as neutral 100 when healthApplicable is false', () => {
    const signals = { ...baseSignals, healthApplicable: false };
    const card = computeServiceScorecard(baseService, signals);
    const healthDim = card.dimensions.find(d => d.id === 'health');
    expect(healthDim!.score).toBe(100);
    expect(healthDim!.detail).toContain('not-applicable');
  });

  it('scores has-build as 0 when no build script', () => {
    const service = { ...baseService, scripts: { test: 'vitest' } };
    const card = computeServiceScorecard(service, baseSignals);
    const buildDim = card.dimensions.find(d => d.id === 'has-build');
    expect(buildDim!.score).toBe(0);
    expect(buildDim!.pass).toBe(false);
  });

  it('scores has-tests as 0 when no test script', () => {
    const service = { ...baseService, scripts: { build: 'tsc' } };
    const card = computeServiceScorecard(service, baseSignals);
    const testDim = card.dimensions.find(d => d.id === 'has-tests');
    expect(testDim!.score).toBe(0);
    expect(testDim!.pass).toBe(false);
  });

  it('scores has-health-endpoint as 100 when healthCheck is present', () => {
    const service: ScorecardServiceInput = {
      name: 'svc',
      path: '/p',
      healthCheck: { path: '/health' },
    };
    const card = computeServiceScorecard(service, baseSignals);
    const healthEndpointDim = card.dimensions.find(d => d.id === 'has-health-endpoint');
    expect(healthEndpointDim!.score).toBe(100);
  });

  it('scores has-health-endpoint as 100 when port is present', () => {
    const service: ScorecardServiceInput = {
      name: 'svc',
      path: '/p',
      port: 8080,
    };
    const card = computeServiceScorecard(service, baseSignals);
    const healthEndpointDim = card.dimensions.find(d => d.id === 'has-health-endpoint');
    expect(healthEndpointDim!.score).toBe(100);
  });

  it('scores has-health-endpoint as 0 when neither healthCheck nor port', () => {
    const service: ScorecardServiceInput = {
      name: 'svc',
      path: '/p',
    };
    const card = computeServiceScorecard(service, baseSignals);
    const healthEndpointDim = card.dimensions.find(d => d.id === 'has-health-endpoint');
    expect(healthEndpointDim!.score).toBe(0);
  });

  it('computes weighted correctly', () => {
    const card = computeServiceScorecard(baseService, baseSignals);
    for (const dim of card.dimensions) {
      const expectedWeighted = Math.round(dim.score * dim.weight * 10) / 10;
      expect(dim.weighted).toBeCloseTo(expectedWeighted, 1);
    }
  });

  it('marks dimensions as pass when score >= 60', () => {
    const card = computeServiceScorecard(baseService, baseSignals);
    for (const dim of card.dimensions) {
      if (dim.score >= 60) {
        expect(dim.pass).toBe(true);
      } else {
        expect(dim.pass).toBe(false);
      }
    }
  });

  it('handles empty scripts object', () => {
    const service: ScorecardServiceInput = {
      name: 'bare',
      path: '/p',
      scripts: {},
    };
    const card = computeServiceScorecard(service, baseSignals);
    expect(card.totalScore).toBeLessThan(100);
  });
});

describe('computeRollup', () => {
  it('averages per-service total scores', () => {
    const cards = [
      computeServiceScorecard(baseService, baseSignals),
      computeServiceScorecard(
        { ...baseService, name: 'api', scripts: {} },
        baseSignals
      ),
    ];
    const rollup = computeRollup(cards, 70, {
      driftEntries: 2,
      policyScore: 85,
    });
    const avg = cards.reduce((acc, c) => acc + c.totalScore, 0) / cards.length;
    expect(rollup.score).toBeCloseTo(avg, 0);
    expect(rollup.services).toHaveLength(2);
    expect(rollup.driftEntries).toBe(2);
    expect(rollup.policyScore).toBe(85);
  });

  it('returns 100 score with warning when no services', () => {
    const rollup = computeRollup([], 70, {
      driftEntries: 0,
      policyScore: 100,
    });
    expect(rollup.score).toBe(100);
    expect(rollup.pass).toBe(true);
    expect(rollup.warnings).toContain(
      'no services found; rollup defaulted to a neutral score'
    );
  });

  it('reports pass=false with warning when below threshold', () => {
    const cards = [
      computeServiceScorecard(
        { ...baseService, scripts: {} },
        { ...baseSignals, healthScore: 10, policyScore: 10, driftScore: 10 }
      ),
    ];
    const rollup = computeRollup(cards, 90, {
      driftEntries: 5,
      policyScore: 10,
    });
    expect(rollup.pass).toBe(false);
    expect(rollup.warnings.some(w => w.includes('below the threshold'))).toBe(true);
  });

  it('reports pass=true when at or above threshold', () => {
    const cards = [computeServiceScorecard(baseService, baseSignals)];
    const rollup = computeRollup(cards, 60, {
      driftEntries: 0,
      policyScore: 85,
    });
    expect(rollup.pass).toBe(true);
  });

  it('derives grade from rollup score', () => {
    const cards = [computeServiceScorecard(baseService, baseSignals)];
    const rollup = computeRollup(cards, 60, {
      driftEntries: 0,
      policyScore: 85,
    });
    expect(rollup.grade).toBe(toGrade(rollup.score));
  });
});
