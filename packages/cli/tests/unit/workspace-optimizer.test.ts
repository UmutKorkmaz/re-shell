import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceOptimizer, workspaceOptimizer } from '../../src/optimization/workspace-optimizer';
// Same singleton the optimizer's checkCircularDependencies reads from.
import { dependencyGraphEngine } from '../../src/graph/dependency-graph-engine';

// workspace-optimizer.ts is pure analysis logic over config shapes (no fs/exec).
// The private checks are exercised through the public analyze() surface.
// Note: checkCircularDependencies reads the shared dependencyGraphEngine singleton
// rather than the passed config, so the cycle branch is driven by mutating that
// singleton (cleared in beforeEach to keep tests isolated).

beforeEach(() => {
  // Reset the shared graph singleton to an empty state between tests.
  dependencyGraphEngine.buildFromConfig({});
});

describe('WorkspaceOptimizer — singleton & clean configs', () => {
  it('exposes a shared singleton instance', () => {
    expect(workspaceOptimizer).toBeInstanceOf(WorkspaceOptimizer);
  });

  it('produces no recommendations for an empty config', () => {
    const report = new WorkspaceOptimizer().analyze({});
    expect(report.recommendations).toEqual([]);
    expect(report.summary.total).toBe(0);
  });

  it('produces no recommendations for a fully-compliant single service', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: {
        'api': {
          name: 'api',
          healthCheck: '/health',
          features: ['authentication'],
          scaling: { min: 1, max: 3 },
        },
      },
    });
    expect(report.recommendations.map(r => r.id)).toEqual([]);
  });
});

describe('WorkspaceOptimizer — circular dependencies (via the graph singleton)', () => {
  it('emits no circular-deps recommendation when the graph is acyclic', () => {
    const report = new WorkspaceOptimizer().analyze({ services: {} });
    expect(report.recommendations.find(r => r.id === 'circular-deps')).toBeUndefined();
  });

  it('emits a critical circular-deps recommendation when the singleton graph has a cycle', () => {
    dependencyGraphEngine.addNode('a', 'service', 'a');
    dependencyGraphEngine.addNode('b', 'service', 'b');
    dependencyGraphEngine.addEdge('a', 'b');
    dependencyGraphEngine.addEdge('b', 'a');
    const report = new WorkspaceOptimizer().analyze({ services: {} });
    const rec = report.recommendations.find(r => r.id === 'circular-deps');
    expect(rec).toBeDefined();
    expect(rec!.type).toBe('structure');
    expect(rec!.severity).toBe('critical');
    expect(rec!.description).toContain('1 circular dependency chain(s)');
    expect(rec!.description).toContain('a -> b -> a');
    expect(rec!.effort).toBe('high');
    expect(rec!.manualFix?.steps.length).toBeGreaterThan(0);
  });
});

describe('WorkspaceOptimizer — service isolation (shared databases)', () => {
  it('flags a shared database when more than 3 services route to one', () => {
    const services: Record<string, unknown> = {};
    for (let i = 0; i < 4; i++) {
      services[`svc-${i}`] = { name: `svc-${i}`, routes: [{ target: 'database:pg' }] };
    }
    const report = new WorkspaceOptimizer().analyze({ services });
    const rec = report.recommendations.find(r => r.id === 'shared-db');
    expect(rec).toBeDefined();
    expect(rec!.type).toBe('scalability');
    expect(rec!.severity).toBe('high');
    expect(rec!.description).toContain('pg');
  });

  it('does not flag a shared database when there are 3 or fewer services', () => {
    const services: Record<string, unknown> = {
      a: { name: 'a', routes: [{ target: 'database:pg' }] },
      b: { name: 'b', routes: [{ target: 'database:pg' }] },
    };
    const report = new WorkspaceOptimizer().analyze({ services });
    expect(report.recommendations.find(r => r.id === 'shared-db')).toBeUndefined();
  });
});

describe('WorkspaceOptimizer — resource optimization', () => {
  it('flags over-provisioned CPU when the limit is more than 4x the request', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: {
        api: {
          name: 'api',
          resources: { cpu: { request: '100', limit: '500' } },
        },
      },
    });
    const rec = report.recommendations.find(r => r.id === 'overprovisioned');
    expect(rec).toBeDefined();
    expect(rec!.type).toBe('performance');
    expect(rec!.severity).toBe('medium');
    expect(rec!.description).toContain('1 service(s)');
  });

  it('does not flag CPU when the ratio is within 4x', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: { api: { name: 'api', resources: { cpu: { request: '100', limit: '200' } } } },
    });
    expect(report.recommendations.find(r => r.id === 'overprovisioned')).toBeUndefined();
  });

  it('flags under-provisioned memory when the limit is too close to the request', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: {
        api: { name: 'api', resources: { memory: { request: '256', limit: '300' } } },
      },
    });
    const rec = report.recommendations.find(r => r.id === 'underprovisioned');
    expect(rec).toBeDefined();
    expect(rec!.severity).toBe('medium');
  });

  it('can flag both over-provisioned CPU and under-provisioned memory', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: {
        api: { name: 'api', resources: { cpu: { request: '100', limit: '500' }, memory: { request: '256', limit: '300' } } },
      },
    });
    const ids = report.recommendations.map(r => r.id);
    expect(ids).toContain('overprovisioned');
    expect(ids).toContain('underprovisioned');
  });
});

describe('WorkspaceOptimizer — naming conventions', () => {
  it('flags non-kebab-case service names with an automated fix', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: { api: { name: 'MyAPI_Service' } },
    });
    const rec = report.recommendations.find(r => r.id === 'naming');
    expect(rec).toBeDefined();
    expect(rec!.type).toBe('maintainability');
    expect(rec!.severity).toBe('low');
    expect(rec!.description).toContain('MyAPI_Service');
    expect(rec!.automatedFix?.command).toBe('re-shell fix-naming --convention kebab-case');
  });

  it('accepts kebab-case names without flagging', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: { api: { name: 'my-api' } },
    });
    expect(report.recommendations.find(r => r.id === 'naming')).toBeUndefined();
  });

  it('lists every invalid name in a single recommendation', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: { a: { name: 'BadOne' }, b: { name: 'also_bad' } },
    });
    const rec = report.recommendations.find(r => r.id === 'naming');
    expect(rec!.description).toContain('BadOne');
    expect(rec!.description).toContain('also_bad');
  });
});

describe('WorkspaceOptimizer — unused dependencies', () => {
  it('flags production dependencies not referenced by any route', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: {
        api: {
          name: 'api',
          dependencies: { production: { 'unused-lib': '1.0' } },
          routes: [{ target: 'service://other' }],
        },
      },
    });
    const rec = report.recommendations.find(r => r.id === 'unused-deps-api');
    expect(rec).toBeDefined();
    expect(rec!.severity).toBe('low');
    expect(rec!.description).toContain('unused-lib');
    expect(rec!.automatedFix?.command).toBe('re-shell clean-deps --service api');
  });

  it('does not flag dependencies that appear in a route target', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: {
        api: {
          name: 'api',
          dependencies: { production: { billing: '1.0' } },
          routes: [{ target: 'service://billing' }],
        },
      },
    });
    expect(report.recommendations.find(r => r.id === 'unused-deps-api')).toBeUndefined();
  });
});

describe('WorkspaceOptimizer — security practices', () => {
  it('flags missing health checks as high severity', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: { api: { name: 'api' } }, // no healthCheck
    });
    const rec = report.recommendations.find(r => r.id === 'missing-health-checks');
    expect(rec).toBeDefined();
    expect(rec!.type).toBe('security');
    expect(rec!.severity).toBe('high');
    expect(rec!.description).toContain('1 service(s)');
  });

  it('does not flag health checks when configured', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: { api: { name: 'api', healthCheck: '/health' } },
    });
    expect(report.recommendations.find(r => r.id === 'missing-health-checks')).toBeUndefined();
  });

  it('flags missing authentication as medium severity', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: { api: { name: 'api', healthCheck: '/health' } }, // no auth feature
    });
    const rec = report.recommendations.find(r => r.id === 'missing-auth');
    expect(rec).toBeDefined();
    expect(rec!.severity).toBe('medium');
  });

  it('accepts the security feature as an alternative to authentication', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: { api: { name: 'api', healthCheck: '/health', features: ['security'] } },
    });
    expect(report.recommendations.find(r => r.id === 'missing-auth')).toBeUndefined();
  });
});

describe('WorkspaceOptimizer — scalability', () => {
  it('flags missing auto-scaling when more than one service has a fixed count', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: {
        a: { name: 'a' },
        b: { name: 'b' },
      },
    });
    const rec = report.recommendations.find(r => r.id === 'no-scaling');
    expect(rec).toBeDefined();
    expect(rec!.type).toBe('scalability');
    expect(rec!.severity).toBe('medium');
    expect(rec!.description).toContain('2 service(s)');
  });

  it('flags scaling.min === scaling.max as a fixed count', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: {
        a: { name: 'a', scaling: { min: 2, max: 2 } },
        b: { name: 'b', scaling: { min: 1, max: 3 } },
      },
    });
    const rec = report.recommendations.find(r => r.id === 'no-scaling');
    expect(rec).toBeDefined();
    expect(rec!.description).toContain('1 service(s)');
  });

  it('does not flag scaling when min differs from max across services', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: {
        a: { name: 'a', scaling: { min: 1, max: 3 } },
        b: { name: 'b', scaling: { min: 2, max: 5 } },
      },
    });
    expect(report.recommendations.find(r => r.id === 'no-scaling')).toBeUndefined();
  });

  it('does not flag scaling for a single service', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: { a: { name: 'a' } },
    });
    expect(report.recommendations.find(r => r.id === 'no-scaling')).toBeUndefined();
  });
});

describe('WorkspaceOptimizer.analyze — report assembly', () => {
  it('sorts recommendations by severity (critical → low)', () => {
    // One service triggers high (missing health), medium (missing auth), low (naming).
    const report = new WorkspaceOptimizer().analyze({
      services: {
        a: { name: 'Bad Name', scaling: { min: 1, max: 2 } },
      },
    });
    const severities = report.recommendations.map(r => r.severity);
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    for (let i = 1; i < severities.length; i++) {
      expect(order[severities[i]]).toBeGreaterThanOrEqual(order[severities[i - 1]]);
    }
    expect(severities).toContain('high');
    expect(severities).toContain('medium');
    expect(severities).toContain('low');
  });

  it('aggregates the summary totals, per-severity counts, and byType', () => {
    const report = new WorkspaceOptimizer().analyze({
      services: {
        a: { name: 'Bad Name', scaling: { min: 1, max: 2 } },
      },
    });
    expect(report.summary.total).toBe(report.recommendations.length);
    expect(report.summary.total).toBe(
      report.summary.critical + report.summary.high + report.summary.medium + report.summary.low,
    );
    // naming → maintainability, missing-health + missing-auth → security
    expect(report.summary.byType.maintainability).toBeGreaterThanOrEqual(1);
    expect(report.summary.byType.security).toBeGreaterThanOrEqual(1);
  });

  it('estimates performance impact as "Well optimized" with no performance recs', () => {
    const report = new WorkspaceOptimizer().analyze({ services: {} });
    expect(report.estimatedImpact.performance).toBe('Well optimized');
  });

  it('estimates maintainability as "Well optimized" with a single low-severity rec', () => {
    // naming is the only maintainability rec here; 1 rec, 0 critical/high → Well optimized.
    const report = new WorkspaceOptimizer().analyze({
      services: { a: { name: 'Bad Name', healthCheck: '/h', features: ['authentication'], scaling: { min: 1, max: 2 } } },
    });
    expect(report.estimatedImpact.maintainability).toBe('Well optimized');
  });

  it('estimates "Minor improvements available" for performance with two medium recs', () => {
    // over- + under-provisioned are both medium, type performance.
    const report = new WorkspaceOptimizer().analyze({
      services: {
        a: {
          name: 'a',
          resources: { cpu: { request: '100', limit: '500' }, memory: { request: '256', limit: '300' } },
        },
      },
    });
    expect(report.estimatedImpact.performance).toBe('Minor improvements available');
  });

  it('estimates "Moderate improvement expected" for scalability when the high-severity shared-db rec fires', () => {
    const services: Record<string, unknown> = {};
    for (let i = 0; i < 4; i++) {
      services[`svc-${i}`] = { name: `svc-${i}`, routes: [{ target: 'database:pg' }] };
    }
    const report = new WorkspaceOptimizer().analyze({ services });
    // shared-db is high severity, type scalability → "Moderate improvement expected".
    expect(report.estimatedImpact.scalability).toBe('Moderate improvement expected');
  });
});

describe('WorkspaceOptimizer.applyAutomatedFixes', () => {
  it('returns a shallow copy of the config (stub — IDs are accepted but not applied)', async () => {
    const optimizer = new WorkspaceOptimizer();
    const input = { services: { a: { name: 'a' } }, extra: true };
    const result = await optimizer.applyAutomatedFixes(input, ['naming']);
    expect(result).toEqual(input);
    expect(result).not.toBe(input); // a copy, not the same reference
  });

  it('returns a promise', () => {
    const optimizer = new WorkspaceOptimizer();
    const result = optimizer.applyAutomatedFixes({}, []);
    expect(result).toBeInstanceOf(Promise);
  });
});
