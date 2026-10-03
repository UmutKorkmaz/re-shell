import { describe, expect, it } from 'vitest';
import {
  bridgeDiffResponseSchema,
  bridgeLinkResponseSchema,
  bridgeValidateResponseSchema,
  errorCodeSchema,
  jsonResponseSchema,
} from './index.js';

describe('bridge contract schemas', () => {
  it('registers every bridge error code', () => {
    for (const code of [
      'BRIDGE_GENERATE_ERROR', 'BRIDGE_LINK_ERROR', 'BRIDGE_VALIDATE_ERROR', 'BRIDGE_SPEC_ERROR',
      'BRIDGE_DIFF_ERROR', 'BRIDGE_ASYNC_ERROR', 'BRIDGE_TRANSFORM_ERROR', 'BRIDGE_MOCK_ERROR', 'BRIDGE_GATEWAY_ERROR',
    ]) {
      expect(errorCodeSchema.safeParse(code).success, code).toBe(true);
    }
    expect(errorCodeSchema.safeParse('BRIDGE_NOPE').success).toBe(false);
  });

  it('validates a link payload and rejects a malformed one', () => {
    const schema = jsonResponseSchema(bridgeLinkResponseSchema);
    const data = {
      consumer: 'web', provider: 'catalog', protocol: 'rest', languages: ['ts'], spec: 'services/catalog/openapi.yaml',
      client: 'services/web/clients/catalog-rest', contractSha256: 'a'.repeat(64), operations: 5, files: [], written: true,
      config: 're-shell.workspaces.yaml', dependsOnAdded: true, stubs: [],
    };
    expect(schema.safeParse({ ok: true, data, warnings: [] }).success).toBe(true);
    expect(schema.safeParse({ ok: true, data: { ...data, protocol: 'soap' }, warnings: [] }).success).toBe(false);
  });

  it('validates validate/diff payloads', () => {
    expect(
      jsonResponseSchema(bridgeValidateResponseSchema).safeParse({
        ok: true,
        data: { valid: false, config: 'c.yaml', services: 2, links: [], cycles: [['a', 'b', 'a']], issues: [{ severity: 'error', code: 'CYCLE', message: 'x' }] },
        warnings: [],
      }).success
    ).toBe(true);
    const ref = { path: '/x', sha256: 'f', title: 't' };
    expect(
      bridgeDiffResponseSchema.safeParse({
        protocol: 'grpc', base: ref, head: ref, strict: false, compatible: false, pass: false,
        summary: { breaking: 1, dangerous: 0, nonBreaking: 0 },
        changes: [{ severity: 'breaking', code: 'OPERATION_REMOVED', path: 'a/B', message: 'm' }],
      }).success
    ).toBe(true);
    expect(bridgeDiffResponseSchema.safeParse({ protocol: 'grpc' }).success).toBe(false);
  });
});
