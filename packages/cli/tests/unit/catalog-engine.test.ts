import { describe, it, expect } from 'vitest';
import {
  buildCatalogModel,
  slugifyEntityName,
  CATALOG_API_VERSION,
  DEFAULT_CATALOG_OWNER,
  DEFAULT_CATALOG_LIFECYCLE,
  type CatalogServiceInput,
  type CatalogMicrofrontendInput,
} from '../../src/utils/catalog-engine';
import { catalogResponseSchema } from '@re-shell/contracts';

/**
 * Pure-engine conformance for `re-shell catalog`. Everything here is offline,
 * deterministic, and side-effect free — no git, no filesystem, no network.
 */

function svc(overrides: Partial<CatalogServiceInput> = {}): CatalogServiceInput {
  return {
    name: 'api',
    language: 'typescript',
    framework: 'express',
    path: 'services/api',
    port: 3000,
    ...overrides,
  };
}

describe('slugifyEntityName', () => {
  it('lowercases and replaces non-[a-z0-9._-] runs with dashes', () => {
    expect(slugifyEntityName('Web Dashboard')).toBe('web-dashboard');
    expect(slugifyEntityName('@scope/pkg-name')).toBe('scope-pkg-name');
    expect(slugifyEntityName('foo.bar_Baz')).toBe('foo.bar_baz');
  });

  it('trims leading/trailing dashes and caps at 63 chars', () => {
    expect(slugifyEntityName('---weird---')).toBe('weird');
    const long = 'a'.repeat(100);
    expect(slugifyEntityName(long).length).toBe(63);
  });
});

describe('buildCatalogModel', () => {
  it('emits a System, a Component, an API, and a Group for a single backend service', () => {
    const model = buildCatalogModel({
      systemName: 'Demo',
      services: [svc()],
      microfrontends: [],
    });
    const kinds = model.entities.map(e => e.kind);
    expect(kinds).toContain('Component');
    expect(kinds).toContain('API');
    expect(kinds).toContain('System');
    expect(kinds).toContain('Group');
    expect(model.counts.components).toBe(1);
    expect(model.counts.apis).toBe(1);
    expect(model.counts.systems).toBe(1);
    expect(model.counts.groups).toBe(1); // the default owner
  });

  it('maps a backend service to spec.type service and a frontend to website', () => {
    const model = buildCatalogModel({
      systemName: 'demo',
      services: [
        svc({ name: 'backend', type: 'backend' }),
        svc({ name: 'web', type: 'frontend', port: undefined }),
      ],
      microfrontends: [],
    });
    const backend = model.entities.find(e => e.metadata.name === 'backend')!;
    const web = model.entities.find(e => e.metadata.name === 'web')!;
    expect(backend.spec.type).toBe('service');
    expect(web.spec.type).toBe('website');
  });

  it('maps a microfrontend to a website Component', () => {
    const mf: CatalogMicrofrontendInput = { name: 'checkout', route: '/checkout', team: 'team-payments' };
    const model = buildCatalogModel({ systemName: 'demo', services: [], microfrontends: [mf] });
    const comp = model.entities.find(e => e.metadata.name === 'checkout')!;
    expect(comp.kind).toBe('Component');
    expect(comp.spec.type).toBe('website');
    expect(comp.spec.owner).toBe('team-payments');
    expect(comp.metadata.annotations?.['re-shell.io/route']).toBe('/checkout');
  });

  it('maps service.dependsOn to Backstage component:default/<dep> refs', () => {
    const model = buildCatalogModel({
      systemName: 'demo',
      services: [
        svc({ name: 'web', dependsOn: ['api'], port: undefined }),
        svc({ name: 'api' }),
      ],
      microfrontends: [],
    });
    const web = model.entities.find(e => e.metadata.name === 'web')!;
    expect(web.spec.dependsOn).toEqual(['component:default/api']);
  });

  it('wires providesApis on a Component that exposes a port, and emits a matching API entity', () => {
    const model = buildCatalogModel({
      systemName: 'demo',
      services: [svc({ name: 'api', port: 3000 })],
      microfrontends: [],
    });
    const comp = model.entities.find(e => e.metadata.name === 'api')!;
    expect(comp.spec.providesApis).toEqual(['api:default/api-api']);
    const api = model.entities.find(e => e.kind === 'API')!;
    expect(api.metadata.name).toBe('api-api');
    expect(api.spec.type).toBe('openapi');
    expect(api.spec.definition).toBeDefined();
  });

  it('does not emit an API entity for a service without a port or health endpoint', () => {
    const model = buildCatalogModel({
      systemName: 'demo',
      services: [svc({ name: 'worker', port: undefined })],
      microfrontends: [],
    });
    expect(model.counts.apis).toBe(0);
  });

  it('derives owner + lifecycle from service.metadata with defaults', () => {
    const model = buildCatalogModel({
      systemName: 'demo',
      services: [svc({ name: 'api', metadata: { owner: 'team-x', lifecycle: 'experimental' } })],
      microfrontends: [],
    });
    const comp = model.entities.find(e => e.metadata.name === 'api')!;
    expect(comp.spec.owner).toBe('team-x');
    expect(comp.spec.lifecycle).toBe('experimental');
    // A Group for team-x is emitted.
    expect(model.entities.some(e => e.kind === 'Group' && e.metadata.name === 'team-x')).toBe(true);
  });

  it('falls back to the default owner + lifecycle when metadata is absent', () => {
    const model = buildCatalogModel({
      systemName: 'demo',
      services: [svc()],
      microfrontends: [],
    });
    const comp = model.entities.find(e => e.metadata.name === 'api')!;
    expect(comp.spec.owner).toBe(DEFAULT_CATALOG_OWNER);
    expect(comp.spec.lifecycle).toBe(DEFAULT_CATALOG_LIFECYCLE);
  });

  it('emits a Group per distinct owner (plus the always-present default-owner Group)', () => {
    const model = buildCatalogModel({
      systemName: 'demo',
      services: [
        svc({ name: 'a', metadata: { owner: 'team-a' } }),
        svc({ name: 'b', metadata: { owner: 'team-b' } }),
        svc({ name: 'c', metadata: { owner: 'team-a' } }),
      ],
      microfrontends: [],
    });
    const groups = model.entities.filter(e => e.kind === 'Group');
    // team-a + team-b + the default owner (team-platform) which the System owns.
    expect(groups.map(g => g.metadata.name).sort()).toEqual([
      'team-a',
      'team-b',
      'team-platform',
    ]);
  });

  it('collapses owners that slugify identically into a single Group (with a warning)', () => {
    const model = buildCatalogModel({
      systemName: 'demo',
      services: [
        svc({ name: 'a', metadata: { owner: 'Team Payments' } }),
        svc({ name: 'b', metadata: { owner: 'team-payments' } }),
      ],
      microfrontends: [],
    });
    const groups = model.entities.filter(e => e.kind === 'Group' && e.metadata.name === 'team-payments');
    expect(groups).toHaveLength(1);
    expect(model.warnings.join(' ')).toMatch(/collides/);
  });

  it('always emits a Group for the default owner so the System owner ref resolves', () => {
    const model = buildCatalogModel({
      systemName: 'demo',
      services: [svc({ name: 'a', metadata: { owner: 'team-other' } })],
      microfrontends: [],
    });
    const system = model.entities.find(e => e.kind === 'System')!;
    const ownerSlug = system.spec.owner;
    expect(model.entities.some(e => e.kind === 'Group' && e.metadata.name === ownerSlug)).toBe(true);
  });

  it('truncates an API entity name to the 63-char Backstage limit even for long service names', () => {
    const longName = 'a'.repeat(70);
    const model = buildCatalogModel({
      systemName: 'demo',
      services: [svc({ name: longName, port: 3000 })],
      microfrontends: [],
    });
    const api = model.entities.find(e => e.kind === 'API')!;
    expect(api.metadata.name.length).toBeLessThanOrEqual(63);
  });

  it('slugify strips leading/trailing dots and underscores, not just dashes', () => {
    expect(slugifyEntityName('.foo')).toBe('foo');
    expect(slugifyEntityName('_foo_')).toBe('foo');
    expect(slugifyEntityName('...trailing...')).toBe('trailing');
  });

  it('includes language + framework tags on the Component', () => {
    const model = buildCatalogModel({
      systemName: 'demo',
      services: [svc({ tags: ['payments'] })],
      microfrontends: [],
    });
    const comp = model.entities.find(e => e.metadata.name === 'api')!;
    expect(comp.metadata.tags).toContain('payments');
    expect(comp.metadata.tags).toContain('typescript');
    expect(comp.metadata.tags).toContain('express');
  });

  it('every entity targets backstage.io/v1alpha1', () => {
    const model = buildCatalogModel({
      systemName: 'demo',
      services: [svc()],
      microfrontends: [{ name: 'mf' }],
    });
    expect(model.entities.every(e => e.apiVersion === CATALOG_API_VERSION)).toBe(true);
  });

  it('warns when no services or microfrontends were discovered', () => {
    const model = buildCatalogModel({ systemName: 'demo', services: [], microfrontends: [] });
    expect(model.warnings.join(' ')).toMatch(/no services or microfrontends/);
  });

  it('never mutates its input service array or config', () => {
    const service = svc({ dependsOn: ['db'] });
    const snapshot = JSON.stringify(service);
    buildCatalogModel({ systemName: 'demo', services: [service], microfrontends: [] });
    expect(JSON.stringify(service)).toBe(snapshot);
  });
});

describe('contracts conformance', () => {
  it('a built model validates against catalogResponseSchema', () => {
    const model = buildCatalogModel({
      systemName: 'Demo',
      services: [svc({ metadata: { owner: 'team-x' } })],
      microfrontends: [{ name: 'mf', team: 'team-y' }],
    });
    const payload = {
      system: model.system,
      dryRun: true,
      entities: model.entities.map(e => ({
        apiVersion: e.apiVersion,
        kind: e.kind,
        metadata: e.metadata,
        spec: e.spec,
      })),
      counts: model.counts,
      files: [],
      warnings: model.warnings,
    };
    expect(catalogResponseSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects an unknown entity kind against the schema', () => {
    const payload = {
      system: 'demo',
      dryRun: true,
      entities: [
        {
          apiVersion: CATALOG_API_VERSION,
          kind: 'Widget',
          metadata: { name: 'x' },
          spec: {},
        },
      ],
      counts: { components: 0, apis: 0, resources: 0, groups: 0, systems: 0 },
      files: [],
      warnings: [],
    };
    expect(catalogResponseSchema.safeParse(payload).success).toBe(false);
  });
});
