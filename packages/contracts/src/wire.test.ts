import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import {
  jsonResponseSchema,
  workspaceSummarySchema,
  healthSummarySchema,
  templateSummarySchema,
  workspaceInfoWireSchema,
  workspaceListWireSchema,
  graphNodeWireSchema,
  workspaceGraphWireSchema,
  healthCheckWireSchema,
  workspaceHealthWireSchema,
  workspaceSummaryWireSchema,
  templateWireSchema,
  templatesListWireSchema,
  templateMatrixRowWireSchema,
  templatesMatrixWireSchema,
  commandCatalogEntryWireSchema,
  commandCatalogWireSchema,
  doctorCheckWireSchema,
  doctorWireSchema,
  doctorFixWireSchema,
  analyzeWireSchema,
  microfrontendWireSchema,
  microfrontendListWireSchema,
} from './index.js';

/**
 * Per-schema valid + malformed fixtures for every WIRE schema.
 *
 * The valid fixtures are trimmed copies of real `--json` output (the CLI
 * conformance suite validates the live output against the same schemas); the
 * malformed fixtures each break exactly one contractual property so a failing
 * case points at the rule that stopped being enforced.
 */

// ---------------------------------------------------------------------------
// Valid fixtures (real output shapes)
// ---------------------------------------------------------------------------

const workspaceInfo = {
  name: '@acme/web',
  path: 'apps/web',
  type: 'app',
  framework: 'react-ts',
  version: '1.2.3',
  dependencies: ['@acme/ui', 'react'],
};

const graphNode = {
  name: '@acme/web',
  path: 'apps/web',
  framework: 'react-ts',
  dependencies: ['@acme/ui'],
};

const graph = {
  apps: [graphNode],
  services: [{ name: '@acme/ui', path: 'packages/ui', framework: null, dependencies: [] }],
};

const health = {
  score: 83,
  status: 'degraded',
  checks: [
    {
      name: 'Workspaces',
      status: 'healthy',
      message: '2 workspace(s) detected',
      details: ['@acme/web (app)', '@acme/ui (package)'],
    },
    { name: 'File Structure', status: 'warning', message: 'Missing README.md' },
    { name: 'Package Manager', status: 'critical' },
  ],
};

const summary = {
  root: '/work/acme',
  packageManager: 'pnpm',
  workspaces: [workspaceInfo],
  graph,
  health,
};

const template = {
  id: 'express',
  name: 'express',
  displayName: 'Express.js',
  description: 'Fast, unopinionated, minimalist web framework for Node.js',
  language: 'typescript',
  framework: 'express',
  version: '4.19.2',
  tags: ['nodejs', 'api'],
  features: ['middleware', 'routing'],
  port: 3000,
  fileCount: 34,
};

const matrixRow = {
  id: 'actix-web',
  name: 'Actix-Web + Rust',
  displayName: 'Actix-Web + Rust',
  language: 'rust',
  framework: 'actix-web',
  databases: ['generic-sql', 'postgresql'],
  caches: ['in-memory'],
  deploymentTargets: ['docker'],
  features: ['authentication'],
};

const matrix = {
  matrix: [matrixRow],
  facets: {
    languages: ['rust'],
    frameworks: ['actix-web'],
    databases: ['generic-sql', 'postgresql'],
    caches: ['in-memory'],
    deploymentTargets: ['docker'],
    features: ['authentication'],
  },
};

const catalogEntry = {
  path: 'analyze',
  aliases: [],
  description: 'Analyze project bundles, dependencies, performance, and security',
  args: [{ name: 'name', required: true }],
  flags: [
    { name: '--type', description: 'Analysis type', takesValue: true, default: 'all' },
    { name: '--json', description: 'Output as JSON', takesValue: false },
  ],
  supportsJson: true,
  supportsDryRun: false,
  destructive: false,
};

const doctorCheck = {
  name: 'package-json',
  status: 'warning',
  message: 'Package.json issues: Missing engines specification',
  suggestion: 'Update package.json with missing fields',
};

const suggestion = {
  checkId: 'package-json',
  cause: 'The root package.json is missing fields.',
  suggestion: 'Add an engines field.',
  fixable: false,
};

const analyze = {
  timestamp: '2026-06-07T17:56:05.062Z',
  monorepo: 'acme',
  workspaces: 1,
  analysis: {
    'apps/web': {
      bundle: { workspace: 'apps/web', size: {}, chunks: [] },
      dependencies: { workspace: 'apps/web', total: 6 },
      performance: { workspace: 'apps/web', buildTime: -1 },
      security: { workspace: 'apps/web', audit: {} },
    },
  },
};

const microfrontend = {
  name: 'web',
  path: '/work/acme/apps/web',
  version: '0.1.0',
  team: 'Umut Korkmaz',
  route: '/web',
};

// ---------------------------------------------------------------------------
// The table: schema -> valid fixtures + malformed fixtures
// ---------------------------------------------------------------------------

interface Case {
  schema: z.ZodTypeAny;
  valid: Record<string, unknown>;
  malformed: Record<string, unknown>;
}

const without = <T extends Record<string, unknown>>(value: T, key: string): Record<string, unknown> => {
  const { [key]: _omitted, ...rest } = value;
  return rest;
};

const CASES: Record<string, Case> = {
  workspaceInfoWireSchema: {
    schema: workspaceInfoWireSchema,
    valid: {
      full: workspaceInfo,
      'no framework': without(workspaceInfo, 'framework'),
      'lib type': { ...workspaceInfo, type: 'lib' },
    },
    malformed: {
      'unknown type': { ...workspaceInfo, type: 'service' },
      'missing version': without(workspaceInfo, 'version'),
      'dependencies not an array': { ...workspaceInfo, dependencies: 'react' },
      'null framework (omitted, never null)': { ...workspaceInfo, framework: null },
    },
  },
  workspaceListWireSchema: {
    schema: workspaceListWireSchema,
    valid: { empty: [], one: [workspaceInfo] },
    malformed: { 'not an array': { workspaces: [workspaceInfo] }, 'bad item': [{ name: 'x' }] },
  },
  graphNodeWireSchema: {
    schema: graphNodeWireSchema,
    valid: { framework: graphNode, 'null framework': { ...graphNode, framework: null } },
    malformed: {
      'framework omitted (must be null)': without(graphNode, 'framework'),
      'dependencies missing': without(graphNode, 'dependencies'),
      'path not a string': { ...graphNode, path: 3 },
    },
  },
  workspaceGraphWireSchema: {
    schema: workspaceGraphWireSchema,
    valid: { populated: graph, empty: { apps: [], services: [] } },
    malformed: {
      'services missing': { apps: [] },
      'apps not an array': { apps: {}, services: [] },
      'node missing name': { apps: [{ path: 'x', framework: null, dependencies: [] }], services: [] },
    },
  },
  healthCheckWireSchema: {
    schema: healthCheckWireSchema,
    valid: {
      'with message and details': health.checks[0],
      'message omitted': health.checks[2],
      'object details': { name: 'Services', status: 'warning', details: { count: 0 } },
    },
    malformed: {
      'domain level vocabulary (pass)': { name: 'x', status: 'pass' },
      'doctor vocabulary (success)': { name: 'x', status: 'success' },
      'missing name': { status: 'healthy' },
    },
  },
  workspaceHealthWireSchema: {
    schema: workspaceHealthWireSchema,
    valid: {
      degraded: health,
      'explain adds suggestions': { ...health, suggestions: [suggestion] },
      empty: { score: 0, status: 'critical', checks: [] },
    },
    malformed: {
      'domain status vocabulary (warn)': { ...health, status: 'warn' },
      'score as string': { ...health, score: '83' },
      'checks missing': { score: 1, status: 'healthy' },
      'check missing name': { score: 1, status: 'healthy', checks: [{ status: 'healthy' }] },
      'malformed suggestion': { ...health, suggestions: [{ checkId: 'x' }] },
    },
  },
  workspaceSummaryWireSchema: {
    schema: workspaceSummaryWireSchema,
    valid: { npm: { ...summary, packageManager: 'npm' }, pnpm: summary },
    malformed: {
      'domain-shaped summary': {
        path: '/', name: 'x', packageManager: 'pnpm', apps: [], services: [], templates: [],
        health: { score: 1, status: 'pass', checks: [] },
      },
      'unknown package manager': { ...summary, packageManager: 'bun' },
      'graph missing': without(summary, 'graph'),
      'health with domain status': { ...summary, health: { ...health, status: 'pass' } },
      'root missing': without(summary, 'root'),
    },
  },
  templateWireSchema: {
    schema: templateWireSchema,
    valid: {
      full: template,
      minimal: { id: 'x', name: 'x', description: '', language: 'go', framework: 'gin' },
    },
    malformed: {
      'missing language': without(template, 'language'),
      'tags not strings': { ...template, tags: [1] },
      'port as string': { ...template, port: '3000' },
      'missing description': without(template, 'description'),
    },
  },
  templatesListWireSchema: {
    schema: templatesListWireSchema,
    valid: { empty: [], one: [template] },
    malformed: { 'object instead of array': { templates: [template] }, 'bad item': [{ id: 'x' }] },
  },
  templateMatrixRowWireSchema: {
    schema: templateMatrixRowWireSchema,
    valid: { full: matrixRow, 'no displayName': without(matrixRow, 'displayName') },
    malformed: {
      'databases missing': without(matrixRow, 'databases'),
      'caches not an array': { ...matrixRow, caches: 'redis' },
    },
  },
  templatesMatrixWireSchema: {
    schema: templatesMatrixWireSchema,
    valid: { populated: matrix },
    malformed: {
      'facets missing': { matrix: [matrixRow] },
      'matrix is the facets only': { facets: matrix.facets },
      'facet not an array': { ...matrix, facets: { ...matrix.facets, languages: 'rust' } },
    },
  },
  commandCatalogEntryWireSchema: {
    schema: commandCatalogEntryWireSchema,
    valid: { full: catalogEntry, 'no flags': { ...catalogEntry, flags: [], args: [] } },
    malformed: {
      'supportsJson missing': without(catalogEntry, 'supportsJson'),
      'arg required not boolean': { ...catalogEntry, args: [{ name: 'a', required: 'yes' }] },
      'flag takesValue missing': { ...catalogEntry, flags: [{ name: '--x', description: '' }] },
    },
  },
  commandCatalogWireSchema: {
    schema: commandCatalogWireSchema,
    valid: { empty: [], one: [catalogEntry] },
    malformed: { 'not an array': { commands: [catalogEntry] } },
  },
  doctorCheckWireSchema: {
    schema: doctorCheckWireSchema,
    valid: {
      'with suggestion': doctorCheck,
      success: { name: 'workspace-config', status: 'success', message: 'ok' },
      error: { name: 'x', status: 'error', message: 'bad' },
    },
    malformed: {
      'health vocabulary (healthy)': { ...doctorCheck, status: 'healthy' },
      'level vocabulary (fail)': { ...doctorCheck, status: 'fail' },
      'message missing': without(doctorCheck, 'message'),
    },
  },
  doctorWireSchema: {
    schema: doctorWireSchema,
    valid: {
      default: { checks: [doctorCheck] },
      explain: { checks: [doctorCheck], suggestions: [suggestion] },
      empty: { checks: [] },
    },
    malformed: { 'checks missing': {}, 'checks not an array': { checks: doctorCheck } },
  },
  doctorFixWireSchema: {
    schema: doctorFixWireSchema,
    valid: {
      'dry-run plan': {
        plan: { applied: false, steps: [{ checkId: 'x', description: 'd', applied: false }] },
        suggestions: [suggestion],
      },
    },
    malformed: {
      'plan missing': { suggestions: [] },
      'step missing applied': {
        plan: { applied: false, steps: [{ checkId: 'x', description: 'd' }] },
        suggestions: [],
      },
    },
  },
  analyzeWireSchema: {
    schema: analyzeWireSchema,
    valid: {
      full: analyze,
      'single block': {
        ...analyze,
        analysis: { 'apps/web': { dependencies: { workspace: 'apps/web' } } },
      },
      empty: { ...analyze, workspaces: 0, analysis: {} },
    },
    malformed: {
      'timestamp missing': without(analyze, 'timestamp'),
      'workspaces not a number': { ...analyze, workspaces: 'one' },
      'block without workspace': { ...analyze, analysis: { 'apps/web': { bundle: { size: {} } } } },
      'analysis is an array': { ...analyze, analysis: [] },
    },
  },
  microfrontendWireSchema: {
    schema: microfrontendWireSchema,
    valid: {
      full: microfrontend,
      bare: { name: 'web', path: '/work/acme/apps/web' },
      'object author': { ...microfrontend, team: { name: 'Umut', email: 'u@example.com' } },
    },
    malformed: { 'path missing': without(microfrontend, 'path'), 'route not a string': { ...microfrontend, route: 1 } },
  },
  microfrontendListWireSchema: {
    schema: microfrontendListWireSchema,
    valid: {
      populated: { microfrontends: [microfrontend] },
      'empty object': { microfrontends: [] },
      'bare empty array (apps/ holds none)': [],
    },
    malformed: {
      'non-empty bare array': [microfrontend],
      'microfrontends not an array': { microfrontends: microfrontend },
      'bad microfrontend': { microfrontends: [{ name: 'x' }] },
    },
  },
};

describe.each(Object.entries(CASES))('%s', (_name, { schema, valid, malformed }) => {
  it.each(Object.entries(valid))('accepts %s', (_label, value) => {
    const parsed = schema.safeParse(value);
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true);
  });

  it.each(Object.entries(malformed))('rejects %s', (_label, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting properties
// ---------------------------------------------------------------------------

describe('wire objects are loose', () => {
  it('preserves undeclared keys instead of stripping them (forward compatible)', () => {
    const parsed = templateWireSchema.parse({ ...template, futureField: { a: 1 } });
    expect((parsed as Record<string, unknown>).futureField).toEqual({ a: 1 });

    const nested = workspaceSummaryWireSchema.parse({
      ...summary,
      health: { ...health, extra: true, checks: [{ ...health.checks[0], extra: 1 }] },
    });
    expect((nested.health as Record<string, unknown>).extra).toBe(true);
    expect((nested.health.checks[0] as Record<string, unknown>).extra).toBe(1);
  });

  it('still enforces every declared key on a loose object', () => {
    expect(templateWireSchema.safeParse({ extra: 1 }).success).toBe(false);
  });
});

describe('wire payloads inside the envelope', () => {
  it('validates the success branch with the wire schema as the data schema', () => {
    const envelope = jsonResponseSchema(workspaceSummaryWireSchema);
    expect(envelope.safeParse({ ok: true, data: summary, warnings: [] }).success).toBe(true);
    expect(envelope.safeParse({ ok: true, data: { ...summary, root: 1 }, warnings: [] }).success).toBe(false);
  });

  it('keeps the error branch identical for every wire schema', () => {
    const error = {
      ok: false,
      error: { code: 'NOT_IN_MONOREPO', message: 'Not in a monorepo.' },
      warnings: [],
    };
    for (const { schema } of Object.values(CASES)) {
      expect(jsonResponseSchema(schema).safeParse(error).success).toBe(true);
    }
  });
});

describe('wire vs domain: the two layers are not interchangeable', () => {
  // Regression guard for the original defect: the MCP server and the VS Code
  // extension validated raw CLI output against the DOMAIN schemas, which can
  // never match. If a domain schema ever starts accepting the wire payload (or
  // the reverse), the layering has been blurred and one of them is wrong.
  it('the domain workspace summary rejects the real wire summary', () => {
    expect(workspaceSummarySchema.safeParse(summary).success).toBe(false);
  });

  it('the domain health summary rejects the real wire health report', () => {
    expect(healthSummarySchema.safeParse(health).success).toBe(false);
  });

  it('the domain template summary rejects the real wire template', () => {
    // Wire templates carry no `domain` or `command`.
    expect(templateSummarySchema.safeParse(template).success).toBe(false);
  });

  it('the wire schemas reject domain-shaped payloads', () => {
    expect(workspaceHealthWireSchema.safeParse({ score: 1, status: 'pass', checks: [] }).success).toBe(false);
    expect(
      templateWireSchema.safeParse({
        id: 'x', name: 'x', description: '', domain: 'backend', language: 'go', framework: 'gin',
        tags: [], command: ['re-shell', 'create'],
      }).success
    ).toBe(true); // extra domain keys are tolerated (loose) ...
    expect(templateWireSchema.safeParse({ id: 'x' }).success).toBe(false); // ... missing wire keys are not
  });
});
