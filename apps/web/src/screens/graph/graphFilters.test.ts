import { describe, expect, it } from 'vitest';
import type { WorkspaceLiveStatus } from '@re-shell/contracts';
import type { WorkspaceGraph } from '../shared/feedSchemas';
import { buildGraphData, factsFromModel, languageOf, normalizeNodes } from './graphData';
import { facetOptions, hasActiveFilters, matchNodes, type GraphFilters } from './graphFilters';

const GRAPH: WorkspaceGraph = {
  apps: [
    { name: '@acme/web', path: 'apps/web', framework: 'react-ts', dependencies: ['@acme/ui', 'left-pad'], type: 'app', language: 'typescript' },
    { name: '@acme/docs', path: 'apps/docs', framework: 'svelte', dependencies: ['@acme/ui'], type: 'app' },
  ],
  services: [
    { name: '@acme/ui', path: 'packages/ui', framework: 'react-ts', dependencies: ['@acme/core'], language: 'typescript' },
    { name: '@acme/core', path: 'packages/core', framework: null, dependencies: ['@acme/web'] },
    { name: 'billing', path: 'services/billing', framework: null, dependencies: [], language: 'go', type: 'package' },
  ],
};

const NONE: GraphFilters = { q: '', language: '', framework: '', type: '', status: '' };
const statuses: Record<string, WorkspaceLiveStatus> = { '@acme/web': 'running', billing: 'unhealthy', '@acme/ui': 'stopped' };
const statusOf = (id: string): WorkspaceLiveStatus => statuses[id] ?? 'unknown';

describe('graph data', () => {
  it('normalises feed nodes, drops duplicate names and unknown edge targets, infers language', () => {
    const data = buildGraphData(GRAPH);
    expect(data.model.nodes).toHaveLength(5);
    expect(data.model.edges.map((e) => `${e.from}>${e.to}`).sort()).toEqual([
      '@acme/core>@acme/web',
      '@acme/docs>@acme/ui',
      '@acme/ui>@acme/core',
      '@acme/web>@acme/ui',
    ]);
    const byId = new Map(data.model.nodes.map((n) => [n.id, n]));
    expect(byId.get('@acme/docs')?.language).toBe('javascript'); // inferred from framework `svelte`
    expect(byId.get('@acme/ui')?.language).toBe('typescript');
    expect(byId.get('billing')?.language).toBe('go');
    expect(byId.get('@acme/core')?.language).toBe('unknown');
    // cycle web -> ui -> core -> web
    expect(data.cycles.cycles).toEqual([['@acme/core', '@acme/ui', '@acme/web']]);
    expect(normalizeNodes({ apps: [{ name: 'a' } as never, { name: 'a' } as never], services: [] })).toHaveLength(1);
  });

  it('infers language from framework when the CLI sent none', () => {
    expect(languageOf({ framework: 'react-ts' })).toBe('typescript');
    expect(languageOf({ framework: 'angular' })).toBe('typescript');
    expect(languageOf({ framework: 'vue' })).toBe('javascript');
    expect(languageOf({ framework: null })).toBe('unknown');
    expect(languageOf({ language: 'rust', framework: 'react-ts' })).toBe('rust');
  });
});

describe('matchNodes', () => {
  const facts = factsFromModel(buildGraphData(GRAPH).model);

  it('returns everything for empty filters', () => {
    expect(matchNodes(facts, NONE, statusOf).size).toBe(5);
    expect(hasActiveFilters(NONE)).toBe(false);
  });

  it('searches name and path, case-insensitively, requiring all terms', () => {
    expect([...matchNodes(facts, { ...NONE, q: 'UI' }, statusOf)].sort()).toEqual(['@acme/ui']);
    expect([...matchNodes(facts, { ...NONE, q: 'apps/' }, statusOf)].sort()).toEqual(['@acme/docs', '@acme/web']);
    expect([...matchNodes(facts, { ...NONE, q: 'acme core' }, statusOf)]).toEqual(['@acme/core']);
    expect(matchNodes(facts, { ...NONE, q: 'nope' }, statusOf).size).toBe(0);
  });

  it('filters by language, framework, type and status facets and combines them', () => {
    expect([...matchNodes(facts, { ...NONE, language: 'typescript' }, statusOf)].sort()).toEqual(['@acme/ui', '@acme/web']);
    expect([...matchNodes(facts, { ...NONE, framework: 'none' }, statusOf)].sort()).toEqual(['@acme/core', 'billing']);
    expect([...matchNodes(facts, { ...NONE, type: 'app' }, statusOf)].sort()).toEqual(['@acme/docs', '@acme/web']);
    expect([...matchNodes(facts, { ...NONE, status: 'unhealthy' }, statusOf)]).toEqual(['billing']);
    expect([...matchNodes(facts, { ...NONE, status: 'unknown' }, statusOf)].sort()).toEqual(['@acme/core', '@acme/docs']);
    expect([...matchNodes(facts, { q: 'acme', language: 'typescript', framework: 'react-ts', type: 'app', status: 'running' }, statusOf)]).toEqual(['@acme/web']);
  });

  it('lists facet options with statuses in severity order and only values present', () => {
    const o = facetOptions(facts, statusOf);
    expect(o.language).toEqual(['go', 'javascript', 'typescript', 'unknown']);
    expect(o.framework).toEqual(['none', 'react-ts', 'svelte']);
    expect(o.type).toEqual(['app', 'package', 'service']);
    expect(o.status).toEqual(['running', 'unhealthy', 'stopped', 'unknown']);
  });
});
