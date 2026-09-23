import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  getVersioningTemplate,
  generateVersionedRoute,
  detectBreakingChanges,
  calculateDeprecationTimeline,
  generateMigrationGuide,
  APIVersioningGenerator,
  createVersioningGenerator,
  generateVersioningConfig,
  formatVersioningConfig,
  formatBreakingChanges,
  BREAKING_CHANGE_PATTERNS,
  type VersioningConfig,
  type APIVersion,
  type BreakingChange,
} from '../../src/utils/api-versioning';

describe('getVersioningTemplate', () => {
  it('returns template for express framework', () => {
    const t = getVersioningTemplate('express');
    expect(t).toBeDefined();
    expect(t!.framework).toBe('express');
    expect(t!.language).toBe('typescript');
    expect(t!.urlPattern).toContain('${version}');
    expect(t!.exampleCode).toContain('app.get');
  });

  it('returns template for fastapi with python language', () => {
    const t = getVersioningTemplate('fastapi');
    expect(t).toBeDefined();
    expect(t!.language).toBe('python');
    expect(t!.exampleCode).toContain('@app.get');
  });

  it('returns template for spring-boot', () => {
    const t = getVersioningTemplate('spring-boot');
    expect(t).toBeDefined();
    expect(t!.language).toBe('java');
    expect(t!.exampleCode).toContain('@RestController');
  });

  it('returns undefined for unknown framework', () => {
    expect(getVersioningTemplate('unknown-fw')).toBeUndefined();
  });

  it('returns templates for all supported frameworks', () => {
    const frameworks = ['express', 'nestjs', 'fastapi', 'django', 'aspnet-core', 'spring-boot', 'gin', 'rust-actix'];
    for (const fw of frameworks) {
      expect(getVersioningTemplate(fw)).toBeDefined();
    }
  });
});

describe('generateVersionedRoute', () => {
  it('generates URL-based versioned route code', () => {
    const code = generateVersionedRoute('express', {
      routePath: '/api/users',
      method: 'get',
      versions: ['1', '2'],
      strategy: 'url',
    });
    expect(code).toContain('URL-based versioning');
    expect(code).toContain('GET');
    expect(code).toContain('/api/v1/');
  });

  it('generates header-based versioned route code', () => {
    const code = generateVersionedRoute('express', {
      routePath: '/users',
      method: 'post',
      versions: ['2'],
      strategy: 'header',
    });
    expect(code).toContain('Header-based versioning');
    expect(code).toContain('POST');
    expect(code).toContain('Version 2 handler');
  });

  it('returns fallback message for unsupported framework', () => {
    const code = generateVersionedRoute('nope', {
      routePath: '/x',
      method: 'get',
      versions: ['1'],
    });
    expect(code).toContain('not available for nope');
  });

  it('prepends leading slash to routePath if missing', () => {
    const code = generateVersionedRoute('express', {
      routePath: 'users',
      method: 'get',
      versions: [],
      strategy: 'url',
    });
    expect(code).toBeDefined();
    expect(code.length).toBeGreaterThan(0);
  });
});

describe('detectBreakingChanges', () => {
  it('detects removed endpoints', () => {
    const oldSpec = { paths: { '/users': { get: {} }, '/admin': { get: {} } } };
    const newSpec = { paths: { '/users': { get: {} } } };
    const changes = detectBreakingChanges(oldSpec, newSpec);
    expect(changes.length).toBe(1);
    expect(changes[0].type).toBe('endpoint-removed');
    expect(changes[0].field).toBe('/admin');
  });

  it('detects removed HTTP methods on existing paths', () => {
    const oldSpec = { paths: { '/users': { get: {}, post: {} } } };
    const newSpec = { paths: { '/users': { get: {} } } };
    const changes = detectBreakingChanges(oldSpec, newSpec);
    expect(changes.some(c => c.type === 'endpoint-removed' && c.field.toLowerCase().includes('post'))).toBe(true);
  });

  it('detects newly required parameters', () => {
    const oldSpec = {
      paths: {
        '/items': {
          get: { parameters: [{ name: 'filter', required: false }] },
        },
      },
    };
    const newSpec = {
      paths: {
        '/items': {
          get: { parameters: [{ name: 'filter', required: true }] },
        },
      },
    };
    const changes = detectBreakingChanges(oldSpec, newSpec);
    expect(changes.some(c => c.type === 'required-added' && c.field === 'filter')).toBe(true);
  });

  it('detects removed schema properties', () => {
    const oldSpec = {
      components: {
        schemas: {
          User: { properties: { name: {}, email: {} }, required: ['name'] },
        },
      },
    };
    const newSpec = {
      components: {
        schemas: {
          User: { properties: { name: {} } },
        },
      },
    };
    const changes = detectBreakingChanges(oldSpec, newSpec);
    const emailChange = changes.find(c => c.field === 'User.email');
    expect(emailChange).toBeDefined();
    expect(emailChange!.type).toBe('field-removed');
  });

  it('returns empty array when specs have no breaking changes', () => {
    const spec = { paths: { '/users': { get: {} } } };
    expect(detectBreakingChanges(spec, spec)).toHaveLength(0);
  });

  it('handles missing paths gracefully', () => {
    expect(detectBreakingChanges({}, {})).toEqual([]);
  });
});

describe('calculateDeprecationTimeline', () => {
  it('returns active status for non-deprecated version', () => {
    const v: APIVersion = {
      version: '1',
      status: 'active',
      introducedAt: '2024-01-01',
      breakingChanges: [],
    };
    const result = calculateDeprecationTimeline(v);
    expect(result.status).toBe('active');
    expect(result.deprecationDate).toBeUndefined();
  });

  it('returns expired status when sunset is in the past', () => {
    const v: APIVersion = {
      version: '1',
      status: 'deprecated',
      introducedAt: '2020-01-01',
      deprecatedAt: '2023-01-01',
      sunsetAt: '2023-06-01',
      breakingChanges: [],
    };
    const result = calculateDeprecationTimeline(v);
    expect(result.status).toBe('expired');
    expect(result.daysUntilSunset).toBeLessThan(0);
  });

  it('returns critical status when sunset is within 30 days', () => {
    const soon = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
    const v: APIVersion = {
      version: '1',
      status: 'deprecated',
      introducedAt: '2024-01-01',
      deprecatedAt: '2025-01-01',
      sunsetAt: soon,
      breakingChanges: [],
    };
    const result = calculateDeprecationTimeline(v);
    expect(result.status).toBe('critical');
    expect(result.daysUntilSunset).toBeLessThan(30);
  });

  it('includes retirementDate when supportedUntil is set', () => {
    const v: APIVersion = {
      version: '1',
      status: 'active',
      introducedAt: '2024-01-01',
      supportedUntil: '2026-12-31',
      breakingChanges: [],
    };
    const result = calculateDeprecationTimeline(v);
    expect(result.retirementDate).toBeDefined();
    expect(result.retirementDate!.getFullYear()).toBe(2026);
  });
});

describe('generateMigrationGuide', () => {
  it('generates guide with breaking changes', () => {
    const changes: BreakingChange[] = [
      {
        field: 'email',
        type: 'field-removed',
        description: 'email was removed from User',
        migrationPath: 'Use contactEmail instead',
      },
    ];
    const md = generateMigrationGuide('v1', 'v2', changes);
    expect(md).toContain('v1');
    expect(md).toContain('v2');
    expect(md).toContain('email');
    expect(md).toContain('field-removed');
    expect(md).toContain('Migration Steps');
  });

  it('handles no breaking changes case', () => {
    const md = generateMigrationGuide('v1', 'v2', []);
    expect(md).toContain('No breaking changes');
    expect(md).toContain('safely upgrade');
  });

  it('omits migration section when migrationPath is absent', () => {
    const changes: BreakingChange[] = [
      { field: 'f', type: 'type-changed', description: 'changed' },
    ];
    const md = generateMigrationGuide('v1', 'v2', changes);
    expect(md).not.toContain('**Migration:**');
  });
});

describe('APIVersioningGenerator', () => {
  it('generateVersioningConfig applies defaults', () => {
    const gen = new APIVersioningGenerator('/tmp/proj');
    const cfg = gen.generateVersioningConfig();
    expect(cfg.strategy).toBe('url');
    expect(cfg.defaultVersion).toBe('1');
    expect(cfg.headerName).toBe('X-API-Version');
    expect(cfg.deprecationPolicy.warningPeriod).toBe(90);
    expect(cfg.versions).toHaveLength(1);
  });

  it('generateVersioningConfig applies overrides', () => {
    const gen = new APIVersioningGenerator('/tmp/proj');
    const cfg = gen.generateVersioningConfig({
      strategy: 'header',
      defaultVersion: '3',
      headerName: 'X-Ver',
    });
    expect(cfg.strategy).toBe('header');
    expect(cfg.defaultVersion).toBe('3');
    expect(cfg.headerName).toBe('X-Ver');
  });

  it('generates middleware for each strategy', () => {
    const gen = new APIVersioningGenerator('/tmp/proj');
    const urlMw = gen.generateVersioningMiddleware('url');
    expect(urlMw).toContain('URL');
    const headerMw = gen.generateVersioningMiddleware('header');
    expect(headerMw).toContain('x-api-version');
    const queryMw = gen.generateVersioningMiddleware('query');
    expect(queryMw).toContain('query.version');
    const ctMw = gen.generateVersioningMiddleware('content-type');
    expect(ctMw).toContain('accept');
    const noneMw = gen.generateVersioningMiddleware('none');
    expect(noneMw).toContain('No versioning');
  });

  it('generates deprecation headers for deprecated version', () => {
    const gen = new APIVersioningGenerator('/tmp/proj');
    const v: APIVersion = {
      version: '1',
      status: 'deprecated',
      introducedAt: '2024-01-01',
      deprecatedAt: '2025-01-01',
      sunsetAt: '2025-12-31',
      migrationGuide: '/docs/migrate',
      breakingChanges: [],
    };
    const headers = gen.generateDeprecationHeaders(v);
    expect(headers).toContain("setHeader('Deprecation'");
    expect(headers).toContain("setHeader('Sunset'");
    expect(headers).toContain("setHeader('Link'");
  });

  it('returns empty string for non-deprecated version in deprecation headers', () => {
    const gen = new APIVersioningGenerator('/tmp/proj');
    const v: APIVersion = {
      version: '2',
      status: 'active',
      introducedAt: '2024-01-01',
      breakingChanges: [],
    };
    expect(gen.generateDeprecationHeaders(v)).toBe('');
  });

  it('lists supported frameworks', () => {
    const gen = new APIVersioningGenerator('/tmp/proj');
    const list = gen.getSupportedFrameworks();
    expect(list).toContain('express');
    expect(list).toContain('fastapi');
    expect(list.length).toBeGreaterThanOrEqual(7);
  });

  describe('writeConfig', () => {
    let tmpDir: string;
    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ver-'));
    });
    afterEach(async () => {
      await fs.remove(tmpDir);
    });

    it('writes a JSON config file', async () => {
      const gen = new APIVersioningGenerator(tmpDir);
      const cfg = gen.generateVersioningConfig();
      const out = path.join(tmpDir, 'sub', 'versioning.json');
      await gen.writeConfig(out, cfg);
      expect(await fs.pathExists(out)).toBe(true);
      const parsed = await fs.readJson(out);
      expect(parsed.strategy).toBe('url');
    });
  });
});

describe('createVersioningGenerator', () => {
  it('creates a generator instance', async () => {
    const gen = await createVersioningGenerator('/tmp/proj', 'express');
    expect(gen).toBeInstanceOf(APIVersioningGenerator);
  });
});

describe('generateVersioningConfig (function)', () => {
  let tmpDir: string;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ver-fn-'));
  });
  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('writes a config file using the factory function', async () => {
    const outPath = path.join(tmpDir, 'api-versioning.json');
    await generateVersioningConfig('/tmp/proj', outPath, { strategy: 'header', defaultVersion: '2' });
    expect(await fs.pathExists(outPath)).toBe(true);
    const parsed = await fs.readJson(outPath);
    expect(parsed.strategy).toBe('header');
    expect(parsed.defaultVersion).toBe('2');
  });
});

describe('formatVersioningConfig', () => {
  it('formats config into a human-readable string', () => {
    const config: VersioningConfig = {
      strategy: 'header',
      defaultVersion: '2',
      headerName: 'X-API-Version',
      versions: [
        { version: '1', status: 'deprecated', introducedAt: '2023-01-01', deprecatedAt: '2024-06-01', sunsetAt: '2025-01-01', breakingChanges: [] },
        { version: '2', status: 'active', introducedAt: '2024-06-01', breakingChanges: [] },
      ],
      deprecationPolicy: { warningPeriod: 90, sunsetPeriod: 180, notifyUsers: true, addDeprecationHeaders: true },
    };
    const out = formatVersioningConfig(config);
    expect(out).toContain('Strategy:');
    expect(out).toContain('header');
    expect(out).toContain('Default Version:');
    expect(out).toContain('v2');
    expect(out).toContain('Versions:');
    expect(out).toContain('Warning Period:');
  });

  it('omits header name line when not set', () => {
    const config: VersioningConfig = {
      strategy: 'url',
      defaultVersion: '1',
      versions: [{ version: '1', status: 'active', introducedAt: '2024-01-01', breakingChanges: [] }],
      deprecationPolicy: { warningPeriod: 30, sunsetPeriod: 60, notifyUsers: false, addDeprecationHeaders: false },
    };
    const out = formatVersioningConfig(config);
    expect(out).not.toContain('Header Name:');
  });
});

describe('formatBreakingChanges', () => {
  it('returns success message when no changes', () => {
    const out = formatBreakingChanges([]);
    expect(out).toContain('No breaking changes');
  });

  it('formats each change with type, field, and description', () => {
    const changes: BreakingChange[] = [
      { field: '/admin', type: 'endpoint-removed', description: 'Endpoint /admin was removed', migrationPath: 'Migrate to /v2/admin' },
      { field: 'name', type: 'required-added', description: 'name is now required' },
      { field: 'age', type: 'type-changed', description: 'age changed from string to number' },
    ];
    const out = formatBreakingChanges(changes);
    expect(out).toContain('3 breaking change(s)');
    expect(out).toContain('endpoint-removed');
    expect(out).toContain('/admin');
    expect(out).toContain('Migration:');
  });

  it('omits Migration line when migrationPath is absent', () => {
    const changes: BreakingChange[] = [
      { field: 'x', type: 'field-removed', description: 'x removed' },
    ];
    const out = formatBreakingChanges(changes);
    expect(out).not.toContain('Migration:');
  });
});

describe('BREAKING_CHANGE_PATTERNS', () => {
  it('exposes regex patterns for detecting breaking changes', () => {
    expect(BREAKING_CHANGE_PATTERNS.fieldRemoved.test('removed email field')).toBe(true);
    expect(BREAKING_CHANGE_PATTERNS.requiredAdded.test('email is now required')).toBe(true);
    expect(BREAKING_CHANGE_PATTERNS.endpointRemoved.test('removed GET /api/v1/users')).toBe(true);
    expect(BREAKING_CHANGE_PATTERNS.responseChanged.test('response structure changed')).toBe(true);
  });
});
