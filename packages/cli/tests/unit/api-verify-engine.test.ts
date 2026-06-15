import { describe, it, expect } from 'vitest';
import {
  normalizeOpenApi,
  diffApiSpec,
  computeBlastRadius,
  diffToApiFindings,
  validateResponse,
} from '../../src/utils/api-verify-engine';
import { apiVerifyResponseSchema } from '@re-shell/contracts';

/**
 * Pure-engine conformance for `re-shell api verify` (issue #16). Everything
 * here is offline, deterministic, and side-effect free.
 */

/** A minimal OpenAPI-ish spec builder. */
function spec(name: string, paths: Record<string, any>): unknown {
  return { openapi: '3.0.0', info: { title: name, version: '1.0.0' }, paths };
}

describe('normalizeOpenApi', () => {
  it('extracts operations with required params and response fields', () => {
    const s = spec('users', {
      '/users/{id}': {
        get: {
          parameters: [{ name: 'id', in: 'path', required: true }],
          responses: {
            200: {
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { id: {}, email: {} } },
                },
              },
            },
          },
        },
      },
    });
    const normalized = normalizeOpenApi(s, 'users');
    const op = normalized.operations.get('GET /users/{id}')!;
    expect(op.requiredParams).toEqual(['id']);
    expect(op.responseFields.sort()).toEqual(['email', 'id']);
    expect(op.responseType).toBe('object');
  });

  it('handles a spec with no paths', () => {
    const normalized = normalizeOpenApi({ info: {} }, 'empty');
    expect(normalized.operations.size).toBe(0);
  });

  it('includes operations without required params or response schema', () => {
    const s = spec('x', { '/ping': { get: { responses: { 200: { description: 'ok' } } } } });
    const op = normalizeOpenApi(s, 'x').operations.get('GET /ping')!;
    expect(op.requiredParams).toEqual([]);
    expect(op.responseFields).toEqual([]);
  });
});

describe('diffApiSpec (breaking-change detection)', () => {
  const baseline = normalizeOpenApi(
    spec('users', {
      '/users/{id}': {
        get: {
          parameters: [{ name: 'id', in: 'path', required: true }],
          responses: {
            200: {
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { id: {}, email: {} } },
                },
              },
            },
          },
        },
      },
      '/users': {
        post: {
          responses: {
            200: { content: { 'application/json': { schema: { type: 'object', properties: { id: {} } } } } },
          },
        },
      },
    }),
    'users'
  );

  it('flags a removed operation as breaking', () => {
    const current = normalizeOpenApi(
      spec('users', { '/users/{id}': { get: { responses: { 200: { description: 'ok' } } } } }),
      'users'
    );
    const diff = diffApiSpec(baseline, current);
    expect(diff.removedOperations).toEqual(['POST /users']);
  });

  it('flags a removed response field as breaking', () => {
    const current = normalizeOpenApi(
      spec('users', {
        '/users/{id}': {
          get: {
            parameters: [{ name: 'id', in: 'path', required: true }],
            responses: {
              200: { content: { 'application/json': { schema: { type: 'object', properties: { id: {} } } } } },
            },
          },
        },
        '/users': { post: { responses: { 200: { description: 'ok' } } } },
      }),
      'users'
    );
    const diff = diffApiSpec(baseline, current);
    expect(diff.removedResponseFields).toContainEqual({ operation: 'GET /users/{id}', field: 'email' });
  });

  it('flags a param that became required as breaking', () => {
    const current = normalizeOpenApi(
      spec('users', {
        '/users/{id}': {
          get: {
            parameters: [
              { name: 'id', in: 'path', required: true },
              { name: 'verbose', in: 'query', required: true },
            ],
            responses: {
              200: { content: { 'application/json': { schema: { type: 'object', properties: { id: {}, email: {} } } } } },
            },
          },
        },
        '/users': { post: { responses: { 200: { description: 'ok' } } } },
      }),
      'users'
    );
    const diff = diffApiSpec(baseline, current);
    expect(diff.newlyRequiredParams).toContainEqual({ operation: 'GET /users/{id}', param: 'verbose' });
  });

  it('a pure addition (new operation) is NOT breaking', () => {
    const current = normalizeOpenApi(
      spec('users', {
        '/users/{id}': {
          get: {
            parameters: [{ name: 'id', in: 'path', required: true }],
            responses: { 200: { content: { 'application/json': { schema: { type: 'object', properties: { id: {}, email: {} } } } } } },
          },
        },
        '/users': { post: { responses: { 200: { content: { 'application/json': { schema: { type: 'object', properties: { id: {} } } } } } } } },
        '/users/search': { get: { responses: { 200: { description: 'ok' } } } },
      }),
      'users'
    );
    const diff = diffApiSpec(baseline, current);
    expect(diff.removedOperations).toEqual([]);
    expect(diff.removedResponseFields).toEqual([]);
    expect(diff.newlyRequiredParams).toEqual([]);
  });
});

describe('computeBlastRadius', () => {
  // graph: consumers → upstream deps. api ← web, api ← mobile, web ← desktop.
  const graph = new Map<string, readonly string[]>([
    ['api', []],
    ['web', ['api']],
    ['mobile', ['api']],
    ['desktop', ['web']],
  ]);

  it('returns the transitive consumers of a producer', () => {
    expect(computeBlastRadius(graph, 'api').sort()).toEqual(['desktop', 'mobile', 'web']);
  });

  it('returns no consumers when nothing depends on the producer', () => {
    expect(computeBlastRadius(graph, 'desktop')).toEqual([]);
  });
});

describe('diffToApiFindings', () => {
  it('tags each breaking finding with the blast-radius consumers', () => {
    const graph = new Map<string, readonly string[]>([['api', []], ['web', ['api']]]);
    const consumers = computeBlastRadius(graph, 'api');
    const findings = diffToApiFindings('api', consumers, {
      removedOperations: ['POST /users'],
      removedResponseFields: [],
      newlyRequiredParams: [],
      narrowedResponseTypes: [],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('breaking');
    expect(findings[0].kind).toBe('operation-removed');
    expect(findings[0].consumers).toContain('web');
  });
});

describe('validateResponse', () => {
  it('reports each declared field missing from the response', () => {
    const op = { id: 'GET /users/{id}', responseFields: ['id', 'email'], requiredParams: [] };
    const violations = validateResponse(op, { id: 1 });
    expect(violations.map(v => v.field)).toEqual(['email']);
    expect(violations[0].message).toMatch(/missing declared field "email"/);
  });

  it('reports no violations when all declared fields are present', () => {
    const op = { id: 'GET /x', responseFields: ['a'], requiredParams: [] };
    expect(validateResponse(op, { a: 1, extra: 2 })).toEqual([]);
  });
});

describe('contracts conformance', () => {
  it('a constructed api-verify response validates against apiVerifyResponseSchema', () => {
    const payload = {
      api: 'users',
      pass: false,
      hasBaseline: true,
      breakingCount: 1,
      findings: [
        {
          severity: 'breaking',
          kind: 'operation-removed',
          message: 'Operation "POST /users" was removed',
          consumers: ['web'],
        },
      ],
      impactedConsumers: 1,
      warnings: [],
    };
    expect(apiVerifyResponseSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects an unknown breaking kind against the schema', () => {
    const payload = {
      api: 'x',
      pass: false,
      hasBaseline: true,
      breakingCount: 1,
      findings: [{ severity: 'breaking', kind: 'mystery', message: 'x', consumers: [] }],
      impactedConsumers: 0,
      warnings: [],
    };
    expect(apiVerifyResponseSchema.safeParse(payload).success).toBe(false);
  });
});
