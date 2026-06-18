import { describe, it, expect } from 'vitest';
import * as yaml from 'js-yaml';
import {
  serializeEntity,
  serializeEntities,
  validateBackstageEntity,
  catalogFilePath,
} from '../../src/utils/catalog-backstage';
import {
  CATALOG_API_VERSION,
  type CatalogEntityLite,
} from '../../src/utils/catalog-engine';

/**
 * Pure serializer + validator coverage for `re-shell catalog sync`. Everything
 * here is offline, deterministic, and side-effect free.
 */

function component(name = 'api'): CatalogEntityLite {
  return {
    apiVersion: CATALOG_API_VERSION,
    kind: 'Component',
    metadata: { name, description: 'demo', tags: ['typescript'], annotations: { 're-shell.io/service': name } },
    spec: { type: 'service', lifecycle: 'production', owner: 'team-platform', system: 'demo' },
  };
}

function apiEntity(name = 'api-api'): CatalogEntityLite {
  return {
    apiVersion: CATALOG_API_VERSION,
    kind: 'API',
    metadata: { name },
    spec: { type: 'openapi', lifecycle: 'production', owner: 'team-platform', definition: 'placeholder' },
  };
}

function group(name = 'team-platform'): CatalogEntityLite {
  return {
    apiVersion: CATALOG_API_VERSION,
    kind: 'Group',
    metadata: { name, title: name },
    spec: { type: 'team', children: [], members: [] },
  };
}

describe('serializeEntity', () => {
  it('emits a valid Backstage descriptor with deterministic key order', () => {
    const out = serializeEntity(component());
    const parsed = yaml.load(out) as Record<string, unknown>;
    const keys = Object.keys(parsed);
    // apiVersion, kind, metadata, spec in that order.
    expect(keys).toEqual(['apiVersion', 'kind', 'metadata', 'spec']);
    expect(parsed['apiVersion']).toBe(CATALOG_API_VERSION);
    expect(parsed['kind']).toBe('Component');
  });

  it('round-trips through js-yaml preserving all fields', () => {
    const entity = component('payments');
    const parsed = yaml.load(serializeEntity(entity)) as CatalogEntityLite;
    expect(parsed.metadata.name).toBe('payments');
    expect(parsed.metadata.annotations['re-shell.io/service']).toBe('payments');
    expect(parsed.spec.type).toBe('service');
    expect(parsed.spec.owner).toBe('team-platform');
  });

  it('omits empty optional metadata fields', () => {
    const minimal: CatalogEntityLite = {
      apiVersion: CATALOG_API_VERSION,
      kind: 'System',
      metadata: { name: 'demo' },
      spec: { owner: 'team-platform' },
    };
    const parsed = yaml.load(serializeEntity(minimal)) as CatalogEntityLite;
    // No description/tags/annotations keys when absent.
    expect(parsed.metadata).toEqual({ name: 'demo' });
  });

  it('serializes a multi-line API definition', () => {
    const out = serializeEntity(apiEntity());
    expect(out).toContain('definition:');
    const parsed = yaml.load(out) as CatalogEntityLite;
    expect(parsed.spec.definition).toBe('placeholder');
  });
});

describe('serializeEntities (multi-document stream)', () => {
  it('joins entities with --- document separators', () => {
    const stream = serializeEntities([component(), group()]);
    const docs = stream.split('\n---\n');
    expect(docs).toHaveLength(2);
  });

  it('each document parses to a valid entity', () => {
    const stream = serializeEntities([component(), group(), apiEntity()]);
    for (const doc of stream.split('\n---\n')) {
      const parsed = yaml.load(doc) as CatalogEntityLite;
      expect(parsed.apiVersion).toBe(CATALOG_API_VERSION);
      expect(parsed.kind).toBeDefined();
    }
  });
});

describe('validateBackstageEntity', () => {
  it('returns no violations for a well-formed Component', () => {
    expect(validateBackstageEntity(component())).toEqual([]);
  });

  it('flags a missing apiVersion', () => {
    const e = { ...component(), apiVersion: '' };
    expect(validateBackstageEntity(e)).toContain('missing apiVersion');
  });

  it('flags an invalid entity name', () => {
    const e = { ...component(), metadata: { ...component().metadata, name: 'Bad Name!' } };
    expect(validateBackstageEntity(e).join(' ')).toMatch(/not a valid entity name/);
  });

  it('flags a Component missing spec.type', () => {
    const e: CatalogEntityLite = {
      apiVersion: CATALOG_API_VERSION,
      kind: 'Component',
      metadata: { name: 'x' },
      spec: { lifecycle: 'production', owner: 'team-platform' },
    };
    expect(validateBackstageEntity(e)).toContain('Component missing spec.type');
  });

  it('flags an API missing spec.definition', () => {
    const e: CatalogEntityLite = {
      apiVersion: CATALOG_API_VERSION,
      kind: 'API',
      metadata: { name: 'x-api' },
      spec: { type: 'openapi', lifecycle: 'production', owner: 'team-platform' },
    };
    expect(validateBackstageEntity(e)).toContain('API missing spec.definition');
  });

  it('does not require spec.type for a System', () => {
    const e: CatalogEntityLite = {
      apiVersion: CATALOG_API_VERSION,
      kind: 'System',
      metadata: { name: 'demo' },
      spec: { owner: 'team-platform' },
    };
    expect(validateBackstageEntity(e)).toEqual([]);
  });
});

describe('catalogFilePath', () => {
  it('routes Components under components/', () => {
    expect(catalogFilePath(component('web'))).toBe('./components/web.yaml');
  });

  it('routes APIs under apis/', () => {
    expect(catalogFilePath(apiEntity('web-api'))).toBe('./apis/web-api.yaml');
  });

  it('routes Groups under owners/', () => {
    expect(catalogFilePath(group('team-x'))).toBe('./owners/team-x.yaml');
  });
});
