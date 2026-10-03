import { describe, expect, it } from 'vitest';
import {
  commandCatalogWireSchema,
  healthSummarySchema,
  templatesListWireSchema,
  workspaceGraphWireSchema,
  workspaceHealthWireSchema,
  workspaceSummarySchema,
  workspaceSummaryWireSchema,
} from '@re-shell/contracts';

import { commandCatalogSchema } from './commandCatalog';
import { templateListSchema, workspaceGraphSchema } from './feedSchemas';
import {
  feedToHealthSummary,
  feedToWorkspaceSummary,
  healthFeedSchema,
  summaryFeedSchema,
} from './summaryFeed';

/**
 * Drift guard between the dashboard's tolerant feed schemas and the exact wire
 * schemas in @re-shell/contracts.
 *
 * Each fixture below is a payload the CLI really prints (and is asserted to be a
 * valid wire payload first). The feed schemas are derived from the wire schemas,
 * so parsing a real payload must be a no-op: if a wire field is added or renamed
 * without the feed following (or a default silently papers over a real field),
 * the round-trip stops being the identity and these tests fail.
 */

const WIRE_HEALTH = {
  score: 83,
  status: 'degraded',
  checks: [
    { name: 'Workspaces', status: 'healthy', message: '3 workspace(s) detected', details: ['web (app)'] },
    { name: 'File Structure', status: 'warning', message: 'Missing README.md' },
    { name: 'Package Manager', status: 'critical', message: 'No lockfile' },
  ],
};

const WIRE_GRAPH = {
  apps: [{ name: '@acme/web', path: 'apps/web', framework: 'react-ts', dependencies: ['@acme/ui'] }],
  services: [
    { name: '@acme/ui', path: 'packages/ui', framework: null, dependencies: [] },
    { name: '@acme/api', path: 'services/api', framework: null, dependencies: ['@acme/ui'] },
  ],
};

const WIRE_SUMMARY = {
  root: '/work/acme',
  packageManager: 'pnpm',
  workspaces: [
    { name: '@acme/web', path: 'apps/web', type: 'app', framework: 'react-ts', version: '1.0.0', dependencies: ['react'] },
    { name: '@acme/ui', path: 'packages/ui', type: 'package', version: '0.3.0', dependencies: [] },
  ],
  graph: WIRE_GRAPH,
  health: WIRE_HEALTH,
};

const WIRE_TEMPLATES = [
  {
    id: 'express',
    name: 'express',
    displayName: 'Express.js',
    description: 'Fast, unopinionated, minimalist web framework for Node.js',
    language: 'typescript',
    framework: 'express',
    version: '4.19.2',
    tags: ['nodejs', 'api'],
    features: ['middleware'],
    port: 3000,
    fileCount: 34,
  },
  { id: 'gin', name: 'gin', description: 'Go web framework', language: 'go', framework: 'gin' },
];

const WIRE_COMMANDS = [
  {
    path: 'analyze',
    aliases: [],
    description: 'Analyze project bundles, dependencies, performance, and security',
    args: [{ name: 'target', required: false }],
    flags: [
      { name: '--type', description: 'Analysis type', takesValue: true, default: 'all' },
      { name: '--json', description: 'Output as JSON', takesValue: false },
    ],
    supportsJson: true,
    supportsDryRun: false,
    destructive: false,
  },
];

describe('the fixtures are real wire payloads', () => {
  it.each([
    ['summary', workspaceSummaryWireSchema, WIRE_SUMMARY],
    ['health', workspaceHealthWireSchema, WIRE_HEALTH],
    ['graph', workspaceGraphWireSchema, WIRE_GRAPH],
    ['templates', templatesListWireSchema, WIRE_TEMPLATES],
    ['commands', commandCatalogWireSchema, WIRE_COMMANDS],
  ])('%s is accepted by its contracts wire schema', (_name, schema, fixture) => {
    expect(schema.safeParse(fixture).success).toBe(true);
  });
});

describe('feed schemas are the identity on real wire payloads', () => {
  it('summary feed keeps every wire field', () => {
    expect(summaryFeedSchema.parse(WIRE_SUMMARY)).toEqual(WIRE_SUMMARY);
  });

  it('health feed keeps every wire field', () => {
    expect(healthFeedSchema.parse(WIRE_HEALTH)).toEqual(WIRE_HEALTH);
  });

  it('graph feed keeps every wire field (including a null framework)', () => {
    expect(workspaceGraphSchema.parse(WIRE_GRAPH)).toEqual(WIRE_GRAPH);
  });

  it('template feed keeps every wire field of a full template and adds nothing to a sparse one', () => {
    const parsed = templateListSchema.parse(WIRE_TEMPLATES);
    expect(parsed[0]).toEqual(WIRE_TEMPLATES[0]);
    // The sparse template gains only the documented empty collections.
    expect(parsed[1]).toEqual({ ...WIRE_TEMPLATES[1], tags: [], features: [] });
  });

  it('command catalog feed keeps every wire field', () => {
    expect(commandCatalogSchema.parse(WIRE_COMMANDS)).toEqual(WIRE_COMMANDS);
  });
});

describe('feed schemas stay tolerant where the dashboard needs it', () => {
  it('fills a sparse workspace and an empty health report with defaults', () => {
    const feed = summaryFeedSchema.parse({ health: {} });
    expect(feed.root).toBe('');
    expect(feed.packageManager).toBe('unknown');
    expect(feed.workspaces).toEqual([]);
    expect(feed.health).toMatchObject({ score: 0, status: 'critical', checks: [] });
  });

  it('defaults a graph node that omits its collections', () => {
    expect(workspaceGraphSchema.parse({ apps: [{ name: 'api' }] }).apps[0]).toMatchObject({
      path: '',
      framework: null,
      dependencies: [],
    });
  });

  it('defaults a command entry that omits its optional members', () => {
    expect(commandCatalogSchema.parse([{ path: 'doctor' }])[0]).toMatchObject({
      aliases: [],
      args: [],
      flags: [],
      supportsJson: false,
    });
  });
});

describe('feed schemas still reject genuinely malformed feeds', () => {
  it.each([
    ['a summary health block with a domain status', () => summaryFeedSchema.safeParse({ health: { status: 'pass' } })],
    ['a health report whose checks are not an array', () => healthFeedSchema.safeParse({ checks: {} })],
    ['a graph whose apps are not an array', () => workspaceGraphSchema.safeParse({ apps: {} })],
    ['a template without an id', () => templateListSchema.safeParse([{ name: 'x' }])],
    ['a catalog entry without a path', () => commandCatalogSchema.safeParse([{ description: 'x' }])],
  ])('rejects %s', (_label, run) => {
    expect(run().success).toBe(false);
  });
});

describe('adapters produce the domain models the UI renders', () => {
  it('adapts the wire summary into a valid domain WorkspaceSummary', () => {
    const model = feedToWorkspaceSummary(summaryFeedSchema.parse(WIRE_SUMMARY));
    expect(workspaceSummarySchema.safeParse(model).success).toBe(true);
    expect(model.apps.map((a) => a.name)).toEqual(['@acme/web']);
    expect(model.services.map((s) => s.name)).toEqual(['@acme/ui']);
    expect(model.health.status).toBe('warn');
  });

  it('adapts the wire health into a valid domain HealthSummary', () => {
    const model = feedToHealthSummary(healthFeedSchema.parse(WIRE_HEALTH));
    expect(healthSummarySchema.safeParse(model).success).toBe(true);
    expect(model.checks.map((c) => c.level)).toEqual(['pass', 'warn', 'fail']);
  });
});
