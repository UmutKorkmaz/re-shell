import { describe, it, expect } from 'vitest';
import {
  workspaceSummarySchema,
  healthSummarySchema,
  workspaceSummaryWireSchema,
  workspaceHealthWireSchema,
  healthWireToSummary,
  workspaceSummaryWireToModel,
  checkStatusToLevel,
  healthStatusToDomain,
  toPackageManager,
} from './index.js';

/**
 * The adapters are the documented bridge from the CLI wire shape to the domain /
 * UI models. The strongest property is that adapting ANY valid wire payload
 * yields a payload the domain schema accepts.
 */

const wireHealth = workspaceHealthWireSchema.parse({
  score: 70,
  status: 'degraded',
  checks: [
    { name: 'Workspaces', status: 'healthy', message: '3 workspace(s) detected' },
    { name: 'File Structure', status: 'warning', message: 'Missing README.md', details: ['README.md'] },
    { name: 'Config', status: 'critical' },
  ],
});

const wireSummary = workspaceSummaryWireSchema.parse({
  root: '/work/acme-monorepo',
  packageManager: 'pnpm',
  workspaces: [
    { name: '@acme/web', path: 'apps/web', type: 'app', framework: 'react-ts', version: '1.0.0', dependencies: [] },
    { name: '@acme/ui', path: 'packages/ui', type: 'package', version: '1.0.0', dependencies: [] },
    { name: '@acme/tool', path: 'tools/tool', type: 'tool', version: '1.0.0', dependencies: [] },
  ],
  graph: { apps: [], services: [] },
  health: wireHealth,
});

describe('status vocabulary mapping', () => {
  it('maps check statuses onto domain levels', () => {
    expect(checkStatusToLevel('healthy')).toBe('pass');
    expect(checkStatusToLevel('warning')).toBe('warn');
    expect(checkStatusToLevel('critical')).toBe('fail');
  });

  it('maps overall statuses onto the domain tri-state', () => {
    expect(healthStatusToDomain('healthy')).toBe('pass');
    expect(healthStatusToDomain('degraded')).toBe('warn');
    expect(healthStatusToDomain('critical')).toBe('fail');
  });

  it('narrows a package manager string, defaulting to unknown', () => {
    expect(toPackageManager('pnpm')).toBe('pnpm');
    expect(toPackageManager('yarn')).toBe('yarn');
    expect(toPackageManager('rush')).toBe('unknown');
  });
});

describe('healthWireToSummary', () => {
  it('produces a payload the domain HealthSummary schema accepts', () => {
    const summary = healthWireToSummary(wireHealth);
    const parsed = healthSummarySchema.safeParse(summary);
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true);
  });

  it('maps score, status and every check', () => {
    const summary = healthWireToSummary(wireHealth);
    expect(summary.score).toBe(70);
    expect(summary.status).toBe('warn');
    expect(summary.checks.map((c) => c.level)).toEqual(['pass', 'warn', 'fail']);
    expect(summary.checks.map((c) => c.title)).toEqual(['Workspaces', 'File Structure', 'Config']);
  });

  it('synthesises stable unique ids and an empty message when the wire omits it', () => {
    const summary = healthWireToSummary(wireHealth);
    expect(summary.checks.map((c) => c.id)).toEqual(['Workspaces-0', 'File Structure-1', 'Config-2']);
    expect(summary.checks[2].message).toBe('');
    expect(healthWireToSummary(wireHealth)).toEqual(summary);
  });

  it('adapts an empty report', () => {
    expect(healthWireToSummary({ score: 0, status: 'critical', checks: [] })).toEqual({
      score: 0,
      status: 'fail',
      checks: [],
    });
  });
});

describe('workspaceSummaryWireToModel', () => {
  it('produces a payload the domain WorkspaceSummary schema accepts', () => {
    const model = workspaceSummaryWireToModel(wireSummary);
    const parsed = workspaceSummarySchema.safeParse(model);
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true);
  });

  it('splits apps from services and keeps framework only when detected', () => {
    const model = workspaceSummaryWireToModel(wireSummary);
    expect(model.apps.map((a) => a.name)).toEqual(['@acme/web']);
    expect(model.apps[0]).toMatchObject({ id: 'apps/web', framework: 'react-ts', type: 'unknown', status: 'unknown' });
    expect(model.services.map((s) => s.name)).toEqual(['@acme/ui', '@acme/tool']);
    expect('framework' in model.services[0]).toBe(false);
  });

  it('names the workspace after the root directory and carries the package manager', () => {
    const model = workspaceSummaryWireToModel(wireSummary);
    expect(model.name).toBe('acme-monorepo');
    expect(model.path).toBe('/work/acme-monorepo');
    expect(model.packageManager).toBe('pnpm');
    expect(model.templates).toEqual([]);
    expect(model.health.status).toBe('warn');
  });

  it('handles a Windows root, an empty root and an unrecognised package manager', () => {
    const base = { ...wireSummary, workspaces: [] };
    expect(workspaceSummaryWireToModel({ ...base, root: 'C:\\work\\acme' }).name).toBe('acme');
    const empty = workspaceSummaryWireToModel({ ...base, root: '', packageManager: 'rush' });
    expect(empty.name).toBe('workspace');
    expect(empty.packageManager).toBe('unknown');
  });
});
