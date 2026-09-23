import { describe, it, expect } from 'vitest';
import {
  normalizeHealth,
  type CanonicalHealth,
} from '../../src/utils/health-normalizer';

// ---------- Rich report factory ----------

function makeRichReport(overrides?: {
  overallStatus?: string;
  overallScore?: number;
  categories?: Array<{
    id: string;
    name: string;
    description: string;
    checks: Array<{
      id: string;
      name: string;
      description: string;
      severity: string;
      status: string;
      message: string;
      metadata?: Record<string, unknown>;
    }>;
  }>;
}) {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    workspaceFile: 'workspace.yaml',
    duration: 100,
    overall: {
      status: overrides?.overallStatus ?? 'healthy',
      score: overrides?.overallScore ?? 95,
      summary: 'All good',
    },
    categories: overrides?.categories ?? [
      {
        id: 'cat1',
        name: 'Category 1',
        description: 'desc',
        checks: [
          {
            id: 'check1',
            name: 'Check 1',
            description: 'd',
            severity: 'error',
            status: 'pass',
            message: 'ok',
          },
        ],
      },
    ],
    recommendations: [],
    metrics: {
      workspaceCount: 2,
      dependencyCount: 1,
      cycleCount: 0,
      orphanedCount: 0,
      definitionCompleteness: 100,
    },
  };
}

// ---------- Tests ----------

describe('normalizeHealth — rich report path', () => {
  it('normalizes a rich report with pass status to healthy checks', () => {
    const report = makeRichReport();
    const result = normalizeHealth(report);
    expect(result.score).toBe(95);
    expect(result.status).toBe('healthy');
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0].status).toBe('healthy');
    expect(result.checks[0].name).toBe('Check 1');
  });

  it('maps fail status to critical check status', () => {
    const report = makeRichReport({
      overallStatus: 'unhealthy',
      overallScore: 30,
      categories: [
        {
          id: 'c1',
          name: 'C',
          description: 'd',
          checks: [
            {
              id: 'chk',
              name: 'Failed Check',
              description: 'd',
              severity: 'error',
              status: 'fail',
              message: 'broken',
            },
          ],
        },
      ],
    });
    const result = normalizeHealth(report);
    expect(result.status).toBe('critical');
    expect(result.checks[0].status).toBe('critical');
  });

  it('maps warning status to warning check status', () => {
    const report = makeRichReport({
      overallStatus: 'degraded',
      overallScore: 75,
      categories: [
        {
          id: 'c1',
          name: 'C',
          description: 'd',
          checks: [
            {
              id: 'chk',
              name: 'Warning Check',
              description: 'd',
              severity: 'warn',
              status: 'warning',
              message: 'watch out',
            },
          ],
        },
      ],
    });
    const result = normalizeHealth(report);
    expect(result.status).toBe('degraded');
    expect(result.checks[0].status).toBe('warning');
  });

  it('includes message from rich check', () => {
    const report = makeRichReport({
      categories: [
        {
          id: 'c1',
          name: 'C',
          description: 'd',
          checks: [
            {
              id: 'chk',
              name: 'Check',
              description: 'd',
              severity: 'info',
              status: 'pass',
              message: 'detailed message here',
            },
          ],
        },
      ],
    });
    const result = normalizeHealth(report);
    expect(result.checks[0].message).toBe('detailed message here');
  });

  it('includes metadata as details from rich check', () => {
    const report = makeRichReport({
      categories: [
        {
          id: 'c1',
          name: 'C',
          description: 'd',
          checks: [
            {
              id: 'chk',
              name: 'Check',
              description: 'd',
              severity: 'info',
              status: 'pass',
              message: 'ok',
              metadata: { extra: 'data' },
            },
          ],
        },
      ],
    });
    const result = normalizeHealth(report);
    expect(result.checks[0].details).toEqual({ extra: 'data' });
  });

  it('clamps score above 100', () => {
    const report = makeRichReport({ overallScore: 150 });
    const result = normalizeHealth(report);
    expect(result.score).toBe(100);
  });

  it('clamps score below 0', () => {
    const report = makeRichReport({ overallScore: -20 });
    const result = normalizeHealth(report);
    expect(result.score).toBe(0);
  });

  it('processes multiple categories with multiple checks', () => {
    const report = makeRichReport({
      overallScore: 80,
      categories: [
        {
          id: 'cat-a',
          name: 'A',
          description: 'd',
          checks: [
            { id: 'a1', name: 'A1', description: 'd', severity: 's', status: 'pass', message: 'ok' },
            { id: 'a2', name: 'A2', description: 'd', severity: 's', status: 'fail', message: 'bad' },
          ],
        },
        {
          id: 'cat-b',
          name: 'B',
          description: 'd',
          checks: [
            { id: 'b1', name: 'B1', description: 'd', severity: 's', status: 'warning', message: 'meh' },
          ],
        },
      ],
    });
    const result = normalizeHealth(report);
    expect(result.checks).toHaveLength(3);
    expect(result.checks.map(c => c.status)).toEqual(['healthy', 'critical', 'warning']);
  });
});

describe('normalizeHealth — lightweight path', () => {
  it('normalizes lightweight health with all healthy checks', () => {
    const result = normalizeHealth({
      checks: [
        { name: 'disk', status: 'healthy' },
        { name: 'cpu', status: 'healthy' },
      ],
      overall: 'healthy',
    });
    expect(result.score).toBe(100);
    expect(result.status).toBe('healthy');
    expect(result.checks).toHaveLength(2);
  });

  it('derives degraded score from mixed check statuses', () => {
    const result = normalizeHealth({
      checks: [
        { name: 'a', status: 'healthy' },
        { name: 'b', status: 'warning' },
      ],
    });
    // (1 + 0.5) / 2 * 100 = 75
    expect(result.score).toBe(75);
    expect(result.status).toBe('degraded');
  });

  it('derives critical score when all checks are critical', () => {
    const result = normalizeHealth({
      checks: [
        { name: 'a', status: 'critical' },
        { name: 'b', status: 'critical' },
      ],
    });
    expect(result.score).toBe(0);
    expect(result.status).toBe('critical');
  });

  it('returns score 0 for empty checks array', () => {
    const result = normalizeHealth({ checks: [] });
    expect(result.score).toBe(0);
    expect(result.status).toBe('critical');
  });

  it('preserves message and details from lightweight checks', () => {
    const result = normalizeHealth({
      checks: [
        {
          name: 'db',
          status: 'warning',
          message: 'slow queries',
          details: { latency: 500 },
        },
      ],
    });
    expect(result.checks[0].message).toBe('slow queries');
    expect(result.checks[0].details).toEqual({ latency: 500 });
  });

  it('normalizes unknown check status to healthy', () => {
    const result = normalizeHealth({
      checks: [
        { name: 'a', status: 'bogus' },
      ],
    });
    expect(result.checks[0].status).toBe('healthy');
  });
});

describe('normalizeHealth — unknown input', () => {
  it('returns empty critical report for null', () => {
    const result = normalizeHealth(null);
    expect(result.score).toBe(0);
    expect(result.status).toBe('critical');
    expect(result.checks).toEqual([]);
  });

  it('returns empty critical report for undefined', () => {
    const result = normalizeHealth(undefined);
    expect(result.score).toBe(0);
    expect(result.status).toBe('critical');
    expect(result.checks).toEqual([]);
  });

  it('returns empty critical report for primitive values', () => {
    const result = normalizeHealth(42) as CanonicalHealth;
    expect(result.score).toBe(0);
    expect(result.status).toBe('critical');
  });

  it('returns empty critical report for object without checks or categories', () => {
    const result = normalizeHealth({ foo: 'bar' });
    expect(result.score).toBe(0);
    expect(result.status).toBe('critical');
  });
});
