import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { jsonResponseSchema, errorCodeSchema } from './index.js';

/**
 * Tests for the core envelope constructor jsonResponseSchema() and the
 * discriminated-union behavior that every --json command relies on.
 * Previously zero tests in the entire contracts package.
 */
describe('jsonResponseSchema', () => {
  const schema = jsonResponseSchema(z.object({ value: z.number() }));

  it('parses a success envelope', () => {
    const parsed = schema.safeParse({
      ok: true,
      data: { value: 42 },
      warnings: [],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.ok) {
      expect(parsed.data.data.value).toBe(42);
    }
  });

  it('parses an error envelope', () => {
    const parsed = schema.safeParse({
      ok: false,
      error: { code: 'NOT_IN_MONOREPO', message: 'not in a monorepo' },
      warnings: [],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success && !parsed.data.ok) {
      expect(parsed.data.error.code).toBe('NOT_IN_MONOREPO');
    }
  });

  it('rejects a success envelope whose data fails the data schema', () => {
    const parsed = schema.safeParse({
      ok: true,
      data: { value: 'not a number' },
      warnings: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an envelope with no ok discriminant', () => {
    expect(schema.safeParse({ data: { value: 1 } }).success).toBe(false);
  });

  it('rejects an error envelope with an unknown error code', () => {
    const parsed = schema.safeParse({
      ok: false,
      error: { code: 'TOTALLY_MADE_UP', message: 'x' },
      warnings: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts error details when present', () => {
    const parsed = schema.safeParse({
      ok: false,
      error: { code: 'WORKSPACE_NOT_FOUND', message: 'x', details: { path: '/x' } },
      warnings: ['heads up'],
    });
    expect(parsed.success).toBe(true);
  });
});

describe('errorCodeSchema', () => {
  it('accepts a known code', () => {
    expect(errorCodeSchema.safeParse('NOT_IN_MONOREPO').success).toBe(true);
    expect(errorCodeSchema.safeParse('FEDERATION_ERROR').success).toBe(true);
  });

  it('rejects an unknown code', () => {
    expect(errorCodeSchema.safeParse('FAKE_ERROR').success).toBe(false);
  });
});
