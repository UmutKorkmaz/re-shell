import { describe, it, expect } from 'vitest';
import type { HealthSummary } from '@re-shell/contracts';

import {
  parseWorkspaceSummary,
  parseWorkspaceGraph,
  parseWorkspaceHealth,
  parseDoctor,
  toProjectNodes,
  healthToOverallStatus,
} from '../../src/core/workspace.js';

// ---------------------------------------------------------------------------
// Fixtures matching what the CLI really prints (the WIRE shapes in
// packages/contracts/src/wire.ts). The summary and health payloads are NOT the
// domain WorkspaceSummary / HealthSummary: the parsers adapt them.
// ---------------------------------------------------------------------------

function okEnvelope<T>(data: T, warnings: string[] = []): string {
  return JSON.stringify({ ok: true, data, warnings });
}

function errorEnvelope(code: string, message: string): string {
  return JSON.stringify({ ok: false, error: { code, message }, warnings: [] });
}

function wireWorkspace(over: Record<string, unknown> = {}) {
  return {
    name: 'web',
    path: 'apps/web',
    type: 'app',
    framework: 'react',
    version: '1.0.0',
    dependencies: ['react'],
    ...over,
  };
}

function wireHealth(over: Partial<{ score: number; status: string; checks: unknown[] }> = {}) {
  return {
    score: 100,
    status: 'healthy',
    checks: [{ name: 'Workspaces', status: 'healthy', message: '2 workspace(s) detected' }],
    ...over,
  };
}

function wireSummary(over: Partial<{ root: string; workspaces: unknown[]; health: unknown }> = {}) {
  return {
    root: '/work/root',
    packageManager: 'pnpm',
    workspaces: [
      wireWorkspace(),
      // No framework detected: the CLI omits the key.
      { name: 'api', path: 'packages/api', type: 'package', version: '1.0.0', dependencies: [] },
    ],
    graph: {
      apps: [{ name: 'web', path: 'apps/web', framework: 'react', dependencies: [] }],
      services: [{ name: 'api', path: 'packages/api', framework: null, dependencies: [] }],
    },
    health: wireHealth(),
    ...over,
  };
}

// ---------------------------------------------------------------------------
// parseWorkspaceSummary
// ---------------------------------------------------------------------------

describe('parseWorkspaceSummary', () => {
  it('parses a real workspace summary envelope and adapts it to the domain model', () => {
    const raw = okEnvelope(wireSummary(), ['heads up']);
    const result = parseWorkspaceSummary(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.name).toBe('root'); // basename of `root`
    expect(result.summary.path).toBe('/work/root');
    expect(result.summary.packageManager).toBe('pnpm');
    expect(result.summary.apps.map((a) => a.name)).toEqual(['web']);
    expect(result.summary.services.map((s) => s.name)).toEqual(['api']);
    expect(result.summary.health.status).toBe('pass'); // healthy -> pass
    expect(result.warnings).toEqual(['heads up']);
  });

  it('accepts an already-parsed object', () => {
    const obj = { ok: true, data: wireSummary(), warnings: [] };
    const result = parseWorkspaceSummary(obj);
    expect(result.ok).toBe(true);
  });

  it('rejects malformed JSON', () => {
    const result = parseWorkspaceSummary('{not json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('not valid JSON');
  });

  it('rejects an empty string', () => {
    const result = parseWorkspaceSummary('   ');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/empty/i);
  });

  it('surfaces a CLI error envelope', () => {
    const result = parseWorkspaceSummary(errorEnvelope('WORKSPACE_SUMMARY_ERROR', 'nope'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('WORKSPACE_SUMMARY_ERROR');
    expect(result.error).toContain('nope');
  });

  it('rejects a payload that does not match the contract', () => {
    const result = parseWorkspaceSummary(okEnvelope({ root: 123 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('does not match the contract');
  });

  it('rejects the domain-shaped summary the real CLI never prints', () => {
    const domainShaped = {
      path: '/',
      name: 'root',
      packageManager: 'pnpm',
      apps: [],
      services: [],
      templates: [],
      health: { score: 100, status: 'pass', checks: [] },
    };
    const result = parseWorkspaceSummary(okEnvelope(domainShaped));
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseWorkspaceGraph
// ---------------------------------------------------------------------------

describe('parseWorkspaceGraph', () => {
  it('parses a { apps, services } graph with dependencies', () => {
    const graph = {
      apps: [{ name: 'web', path: '/apps/web', framework: 'react', dependencies: ['api'] }],
      services: [{ name: 'api', path: '/services/api', framework: null, dependencies: [] }],
    };
    const result = parseWorkspaceGraph(okEnvelope(graph));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.apps[0].dependencies).toEqual(['api']);
    expect(result.graph.services[0].framework).toBeNull();
  });

  it('rejects a CLI error envelope', () => {
    const result = parseWorkspaceGraph(errorEnvelope('GRAPH_GENERATION_ERROR', 'boom'));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('GRAPH_GENERATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// parseWorkspaceHealth
// ---------------------------------------------------------------------------

describe('parseWorkspaceHealth', () => {
  it('parses the real canonical health report and adapts it to the domain summary', () => {
    const health = wireHealth({
      score: 80,
      status: 'degraded',
      checks: [
        { name: 'Check 1', status: 'healthy', message: 'ok' },
        { name: 'Check 2', status: 'warning', message: 'watch', details: ['a'] },
        { name: 'Check 3', status: 'critical' },
      ],
    });
    const result = parseWorkspaceHealth(okEnvelope(health));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.health.checks).toHaveLength(3);
    expect(result.health.status).toBe('warn'); // degraded -> warn
    expect(result.health.checks.map((c) => c.level)).toEqual(['pass', 'warn', 'fail']);
    expect(result.health.checks[0]).toMatchObject({ id: 'Check 1-0', title: 'Check 1', message: 'ok' });
    expect(result.health.checks[2].message).toBe('');
  });

  it('rejects the domain vocabulary (pass/warn/fail) the CLI never prints', () => {
    const domainShaped = {
      score: 80,
      status: 'warn',
      checks: [{ id: 'c1', title: 'Check 1', level: 'pass', message: 'ok' }],
    };
    expect(parseWorkspaceHealth(okEnvelope(domainShaped)).ok).toBe(false);
  });

  it('surfaces a CLI error envelope', () => {
    const result = parseWorkspaceHealth(errorEnvelope('WORKSPACE_NOT_FOUND', 'No workspace configuration found'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('WORKSPACE_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// parseDoctor
// ---------------------------------------------------------------------------

describe('parseDoctor', () => {
  it('parses doctor checks with the loose status vocabulary', () => {
    const doctor = {
      checks: [
        { name: 'monorepo-detection', status: 'success', message: 'ok' },
        { name: 'security-audit', status: 'warning', message: 'outdated', suggestion: 'update' },
        { name: 'lint', status: 'error', message: 'failed' },
      ],
    };
    const result = parseDoctor(okEnvelope(doctor));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doctor.checks.map((c) => c.status)).toEqual(['success', 'warning', 'error']);
    expect(result.doctor.checks[1].suggestion).toBe('update');
  });

  it('rejects an unknown doctor check status', () => {
    const result = parseDoctor(okEnvelope({ checks: [{ name: 'x', status: 'bogus', message: 'm' }] }));
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toProjectNodes
// ---------------------------------------------------------------------------

describe('toProjectNodes', () => {
  it('groups graph nodes into apps and packages with stable sort', () => {
    const graph = {
      apps: [
        { name: 'web', path: '/apps/web', framework: 'react', dependencies: [] },
        { name: 'admin', path: '/apps/admin', framework: 'vue', dependencies: [] },
      ],
      services: [{ name: 'api', path: '/services/api', framework: 'fastify', dependencies: [] }],
    };
    const { apps, packages } = toProjectNodes(graph);
    expect(apps.map((a) => a.name)).toEqual(['admin', 'web']); // alphabetical
    expect(apps.every((a) => a.kind === 'app')).toBe(true);
    expect(packages.map((p) => p.name)).toEqual(['api']);
    expect(packages[0].kind).toBe('package');
  });

  it('attributes health to a node when the node name appears in a check', () => {
    const graph = {
      apps: [{ name: 'web', path: '/apps/web', framework: null, dependencies: [] }],
      services: [],
    };
    const health: HealthSummary = {
      score: 50,
      status: 'warn',
      checks: [
        { id: 'web-lint', title: 'Web lint', level: 'warn', message: 'web has lint errors' },
        { id: 'global', title: 'Global', level: 'fail', message: 'something global' },
      ],
    };
    const { apps } = toProjectNodes(graph, health);
    // 'web' matches the first check (warn) and not the second → warn.
    expect(apps[0].health).toBe('warn');
  });

  it('rolls up to the global worst status when no check matches the node', () => {
    const graph = {
      apps: [{ name: 'web', path: '/apps/web', framework: null, dependencies: [] }],
      services: [],
    };
    const health: HealthSummary = {
      score: 0,
      status: 'fail',
      checks: [{ id: 'x', title: 'unrelated', level: 'fail', message: 'm' }],
    };
    const { apps } = toProjectNodes(graph, health);
    // No check mentions 'web' → inherit global fail.
    expect(apps[0].health).toBe('fail');
  });

  it('yields null health when no health summary is provided', () => {
    const graph = {
      apps: [{ name: 'web', path: '/apps/web', framework: null, dependencies: [] }],
      services: [],
    };
    const { apps } = toProjectNodes(graph);
    expect(apps[0].health).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// healthToOverallStatus
// ---------------------------------------------------------------------------

describe('healthToOverallStatus', () => {
  it('returns null when no health is provided', () => {
    expect(healthToOverallStatus(undefined)).toBeNull();
  });

  it('returns pass when only pass/info checks exist', () => {
    const health: HealthSummary = {
      score: 100,
      status: 'pass',
      checks: [
        { id: 'a', title: 'a', level: 'pass', message: 'm' },
        { id: 'b', title: 'b', level: 'info', message: 'm' },
      ],
    };
    expect(healthToOverallStatus(health)).toEqual({ status: 'pass', warnCount: 0, failCount: 0 });
  });

  it('returns warn when a warn check exists', () => {
    const health: HealthSummary = {
      score: 80,
      status: 'warn',
      checks: [{ id: 'a', title: 'a', level: 'warn', message: 'm' }],
    };
    expect(healthToOverallStatus(health)).toEqual({ status: 'warn', warnCount: 1, failCount: 0 });
  });

  it('returns fail (and counts warns too) when a fail check exists', () => {
    const health: HealthSummary = {
      score: 20,
      status: 'fail',
      checks: [
        { id: 'a', title: 'a', level: 'fail', message: 'm' },
        { id: 'b', title: 'b', level: 'warn', message: 'm' },
      ],
    };
    expect(healthToOverallStatus(health)).toEqual({ status: 'fail', warnCount: 1, failCount: 1 });
  });
});
