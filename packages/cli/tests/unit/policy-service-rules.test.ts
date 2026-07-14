import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  evaluateServiceRules,
  loadServicesFromWorkspace,
  type ServiceRule,
  type ServiceRuleContext,
  type ServiceRuleResult,
} from '../../src/utils/policy-rules-service';
import type { ServiceConfig } from '../../src/parsers/workspace-parser';

/**
 * Unit tests for the service-level policy rule engine.
 *
 * Covers all 8 rule evaluators (pass, fail, edge), serviceTypes filtering,
 * and loadServicesFromWorkspace file discovery.
 */

/** Base service config helper — accepts overrides for any field. */
function makeService(overrides: Partial<ServiceConfig> = {}): ServiceConfig {
  return {
    name: 'test-svc',
    language: 'typescript',
    framework: 'express',
    ...overrides,
  };
}

/** Build a minimal context for a single service. */
function makeCtx(service: ServiceConfig, workspacePath = '/fake/path'): ServiceRuleContext {
  return { service, workspacePath };
}

/** Build a rule with a given type and config fields. */
function makeRule(type: string, fields: Record<string, unknown> = {}): ServiceRule {
  return {
    id: `rule-${type}`,
    type: type as ServiceRule['type'],
    severity: 'error',
    ...fields,
  } as ServiceRule;
}

/** Evaluate a single rule against a single service (convenience). */
function evalOne(rule: ServiceRule, service: ServiceConfig): ServiceRuleResult {
  const results = evaluateServiceRules(
    { name: 'test-pack', rules: [rule] },
    '/fake/path',
    { [service.name]: service }
  );
  // Filter to results for this service+rule
  return results.find(r => r.serviceName === service.name && r.ruleId === rule.id)!;
}

// ---------------------------------------------------------------------------
// 1. healthcheck-required
// ---------------------------------------------------------------------------

describe('rule: healthcheck-required', () => {
  it('passes when healthCheck is defined with keys', () => {
    const svc = makeService({ healthCheck: { path: '/health', interval: 30 } });
    const result = evalOne(makeRule('healthcheck-required'), svc);
    expect(result.passed).toBe(true);
  });

  it('fails when healthCheck is undefined', () => {
    const svc = makeService({});
    expect(svc.healthCheck).toBeUndefined();
    const result = evalOne(makeRule('healthcheck-required'), svc);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('health');
  });

  it('fails when healthCheck is an empty object', () => {
    const svc = makeService({ healthCheck: {} });
    const result = evalOne(makeRule('healthcheck-required'), svc);
    expect(result.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. resource-limits
// ---------------------------------------------------------------------------

describe('rule: resource-limits', () => {
  it('passes when resources has cpu and memory', () => {
    const svc = makeService({
      resources: { cpu: { request: '100m' }, memory: { request: '256Mi' } },
    });
    const result = evalOne(
      makeRule('resource-limits', { requireCpu: true, requireMemory: true }),
      svc
    );
    expect(result.passed).toBe(true);
  });

  it('fails when resources is undefined', () => {
    const svc = makeService({});
    const result = evalOne(
      makeRule('resource-limits', { requireCpu: true, requireMemory: true }),
      svc
    );
    expect(result.passed).toBe(false);
  });

  it('fails when resources is empty object', () => {
    const svc = makeService({ resources: {} });
    const result = evalOne(
      makeRule('resource-limits', { requireCpu: true, requireMemory: true }),
      svc
    );
    expect(result.passed).toBe(false);
  });

  it('no-op pass when both requireCpu and requireMemory are false', () => {
    const svc = makeService({});
    const result = evalOne(
      makeRule('resource-limits', { requireCpu: false, requireMemory: false }),
      svc
    );
    expect(result.passed).toBe(true);
  });

  it('fails when requireCpu is true but cpu missing', () => {
    const svc = makeService({
      resources: { memory: { request: '256Mi' } },
    });
    const result = evalOne(
      makeRule('resource-limits', { requireCpu: true, requireMemory: false }),
      svc
    );
    expect(result.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. port-range
// ---------------------------------------------------------------------------

describe('rule: port-range', () => {
  it('passes when port is within range', () => {
    const svc = makeService({ port: 3000 });
    const result = evalOne(makeRule('port-range', { min: 1024, max: 65535 }), svc);
    expect(result.passed).toBe(true);
  });

  it('fails when port is below min', () => {
    const svc = makeService({ port: 80 });
    const result = evalOne(makeRule('port-range', { min: 1024, max: 65535 }), svc);
    expect(result.passed).toBe(false);
  });

  it('passes with no-port message when port is undefined', () => {
    const svc = makeService({});
    const result = evalOne(makeRule('port-range', { min: 1024, max: 65535 }), svc);
    expect(result.passed).toBe(true);
    expect(result.message).toContain('no port');
  });

  it('passes at boundary max', () => {
    const svc = makeService({ port: 65535 });
    const result = evalOne(makeRule('port-range', { min: 1024, max: 65535 }), svc);
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. service-dependency
// ---------------------------------------------------------------------------

describe('rule: service-dependency', () => {
  it('passes when dependency count is within min/max', () => {
    const svc = makeService({ dependsOn: ['db', 'cache'] });
    const result = evalOne(makeRule('service-dependency', { min: 1, max: 5 }), svc);
    expect(result.passed).toBe(true);
  });

  it('fails when too few dependencies', () => {
    const svc = makeService({ dependsOn: [] });
    const result = evalOne(makeRule('service-dependency', { min: 1, max: 5 }), svc);
    expect(result.passed).toBe(false);
  });

  it('fails when too many dependencies', () => {
    const svc = makeService({ dependsOn: ['a', 'b', 'c'] });
    const result = evalOne(makeRule('service-dependency', { min: 0, max: 2 }), svc);
    expect(result.passed).toBe(false);
  });

  it('uses default min=0 and max=Infinity when omitted', () => {
    const svc = makeService({ dependsOn: ['a'] });
    const result = evalOne(makeRule('service-dependency'), svc);
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. required-env
// ---------------------------------------------------------------------------

describe('rule: required-env', () => {
  it('passes when all required variables are present', () => {
    const svc = makeService({ env: { NODE_ENV: 'production', PORT: '3000' } });
    const result = evalOne(
      makeRule('required-env', { variables: ['NODE_ENV', 'PORT'] }),
      svc
    );
    expect(result.passed).toBe(true);
  });

  it('fails when a variable is missing', () => {
    const svc = makeService({ env: { NODE_ENV: 'production' } });
    const result = evalOne(
      makeRule('required-env', { variables: ['NODE_ENV', 'DATABASE_URL'] }),
      svc
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain('DATABASE_URL');
  });

  it('passes when env is undefined but no variables required', () => {
    const svc = makeService({});
    const result = evalOne(makeRule('required-env', { variables: [] }), svc);
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. framework-allowlist
// ---------------------------------------------------------------------------

describe('rule: framework-allowlist', () => {
  it('passes when framework string is in allowed list', () => {
    const svc = makeService({ framework: 'express' });
    const result = evalOne(
      makeRule('framework-allowlist', { allowed: ['express', 'fastify'] }),
      svc
    );
    expect(result.passed).toBe(true);
  });

  it('fails when framework is not in allowed list', () => {
    const svc = makeService({ framework: 'koa' });
    const result = evalOne(
      makeRule('framework-allowlist', { allowed: ['express', 'fastify'] }),
      svc
    );
    expect(result.passed).toBe(false);
  });

  it('resolves framework from FrameworkConfig object', () => {
    const svc = makeService({
      framework: { name: 'nest', version: '10.0.0' },
    });
    const result = evalOne(
      makeRule('framework-allowlist', { allowed: ['nest', 'express'] }),
      svc
    );
    expect(result.passed).toBe(true);
  });

  it('fails when framework resolves to empty string', () => {
    const svc = makeService({ framework: '   ' });
    const result = evalOne(
      makeRule('framework-allowlist', { allowed: ['express'] }),
      svc
    );
    expect(result.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. language-allowlist
// ---------------------------------------------------------------------------

describe('rule: language-allowlist', () => {
  it('passes when language is in allowed list', () => {
    const svc = makeService({ language: 'typescript' });
    const result = evalOne(
      makeRule('language-allowlist', { allowed: ['typescript', 'python'] }),
      svc
    );
    expect(result.passed).toBe(true);
  });

  it('fails when language is not in allowed list', () => {
    const svc = makeService({ language: 'cobol' });
    const result = evalOne(
      makeRule('language-allowlist', { allowed: ['typescript', 'python'] }),
      svc
    );
    expect(result.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. scaling-required
// ---------------------------------------------------------------------------

describe('rule: scaling-required', () => {
  it('passes when scaling is defined with keys', () => {
    const svc = makeService({ scaling: { minReplicas: 2, maxReplicas: 5 } });
    const result = evalOne(makeRule('scaling-required'), svc);
    expect(result.passed).toBe(true);
  });

  it('fails when scaling is undefined', () => {
    const svc = makeService({});
    const result = evalOne(makeRule('scaling-required'), svc);
    expect(result.passed).toBe(false);
  });

  it('fails when scaling is empty object', () => {
    const svc = makeService({ scaling: {} });
    const result = evalOne(makeRule('scaling-required'), svc);
    expect(result.passed).toBe(false);
  });

  it('checks minReplicas when requireMinReplicas is set', () => {
    const svc = makeService({ scaling: { minReplicas: 1 } });
    const result = evalOne(
      makeRule('scaling-required', { requireMinReplicas: true }),
      svc
    );
    expect(result.passed).toBe(true);
  });

  it('fails when requireMinReplicas set but minReplicas is not a number', () => {
    const svc = makeService({ scaling: { minReplicas: 'two' } });
    const result = evalOne(
      makeRule('scaling-required', { requireMinReplicas: true }),
      svc
    );
    expect(result.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// serviceTypes filter
// ---------------------------------------------------------------------------

describe('serviceTypes filter', () => {
  const services: Record<string, ServiceConfig> = {
    frontend: makeService({ name: 'frontend', type: 'frontend' }),
    backend: makeService({ name: 'backend', type: 'backend' }),
    'no-type': makeService({ name: 'no-type' }),
  };

  it('only checks services matching serviceTypes', () => {
    const rule = makeRule('healthcheck-required', { serviceTypes: ['frontend'] });
    const results = evaluateServiceRules(
      { name: 'pack', rules: [rule] },
      '/fake',
      services
    );
    const names = results.map(r => r.serviceName);
    expect(names).toContain('frontend');
    expect(names).not.toContain('backend');
  });

  it('skips non-matching types', () => {
    const rule = makeRule('healthcheck-required', { serviceTypes: ['backend'] });
    const results = evaluateServiceRules(
      { name: 'pack', rules: [rule] },
      '/fake',
      services
    );
    const names = results.map(r => r.serviceName);
    expect(names).toContain('backend');
    expect(names).not.toContain('frontend');
  });

  it('defaults services without type to backend', () => {
    const rule = makeRule('healthcheck-required', { serviceTypes: ['backend'] });
    const results = evaluateServiceRules(
      { name: 'pack', rules: [rule] },
      '/fake',
      services
    );
    const names = results.map(r => r.serviceName);
    expect(names).toContain('no-type');
  });

  it('checks all services when serviceTypes is omitted', () => {
    const rule = makeRule('healthcheck-required');
    const results = evaluateServiceRules(
      { name: 'pack', rules: [rule] },
      '/fake',
      services
    );
    const names = results.map(r => r.serviceName).sort();
    expect(names).toEqual(['backend', 'frontend', 'no-type']);
  });
});

// ---------------------------------------------------------------------------
// evaluateServiceRules: multi-rule integration
// ---------------------------------------------------------------------------

describe('evaluateServiceRules integration', () => {
  it('returns flat results across multiple rules and services', () => {
    const services: Record<string, ServiceConfig> = {
      good: makeService({ name: 'good', port: 3000, healthCheck: { path: '/h' } }),
      bad: makeService({ name: 'bad', port: 80 }),
    };
    const rules: ServiceRule[] = [
      makeRule('healthcheck-required'),
      makeRule('port-range', { min: 1024, max: 65535 }),
    ];
    const results = evaluateServiceRules(
      { name: 'pack', rules },
      '/fake',
      services
    );
    // 2 rules x 2 services = 4 results
    expect(results).toHaveLength(4);
    const goodResults = results.filter(r => r.serviceName === 'good');
    expect(goodResults.every(r => r.passed)).toBe(true);
    const badResults = results.filter(r => r.serviceName === 'bad');
    // bad fails healthcheck (no healthCheck) and port-range (port 80 < 1024)
    expect(badResults.every(r => !r.passed)).toBe(true);
  });

  it('returns empty array for no services', () => {
    const results = evaluateServiceRules(
      { name: 'pack', rules: [makeRule('healthcheck-required')] },
      '/fake',
      {}
    );
    expect(results).toEqual([]);
  });

  it('includes severity in results', () => {
    const svc = makeService({});
    const results = evaluateServiceRules(
      {
        name: 'pack',
        rules: [
          {
            id: 'warn-rule',
            type: 'healthcheck-required',
            severity: 'warning',
          } as ServiceRule,
        ],
      },
      '/fake',
      { 'test-svc': svc }
    );
    expect(results[0].severity).toBe('warning');
  });
});

// ---------------------------------------------------------------------------
// loadServicesFromWorkspace
// ---------------------------------------------------------------------------

describe('loadServicesFromWorkspace', () => {
  const TMP_DIRS: string[] = [];

  afterEach(() => {
    for (const dir of TMP_DIRS.splice(0)) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('returns null services when no workspace file found', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'no-ws-'));
    TMP_DIRS.push(dir);
    const { services, rootPath } = await loadServicesFromWorkspace(dir);
    expect(services).toBeNull();
    expect(rootPath).toBe(dir);
  });

  it('loads services from a valid re-shell.workspaces.yaml', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-load-'));
    TMP_DIRS.push(dir);
    const yamlContent = [
      'name: test-ws',
      'version: "2.0.0"',
      'services:',
      '  api:',
      '    name: api',
      '    language: typescript',
      '    framework: express',
      '    path: services/api',
      '    port: 3000',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(dir, 're-shell.workspaces.yaml'), yamlContent, 'utf8');

    const { services, rootPath } = await loadServicesFromWorkspace(dir);
    expect(services).not.toBeNull();
    expect(services!.api).toBeDefined();
    expect(services!.api.language).toBe('typescript');
    expect(services!.api.port).toBe(3000);
    expect(rootPath).toBe(dir);
  });

  it('loads services from a .yml extension', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-yml-'));
    TMP_DIRS.push(dir);
    const yamlContent = [
      'name: test-ws',
      'version: "2.0.0"',
      'services:',
      '  web:',
      '    name: web',
      '    language: typescript',
      '    framework: react',
      '    path: services/web',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(dir, 're-shell.workspaces.yml'), yamlContent, 'utf8');

    const { services } = await loadServicesFromWorkspace(dir);
    expect(services).not.toBeNull();
    expect(services!.web).toBeDefined();
    expect(services!.web.framework).toBe('react');
  });
});
