import { describe, expect, it } from 'vitest';
import { errorCodeSchema, jsonResponseSchema } from '@re-shell/contracts';
import { z } from 'zod';

import { HTTP_STATUS_BY_CODE, controlPlaneErrorCodeSchema, fail, ok } from './errors.js';

describe('control-plane envelopes vs the shared contracts parser', () => {
  it('every control-plane error code is a member of @re-shell/contracts errorCodeSchema', () => {
    const shared = new Set<string>(errorCodeSchema.options);
    const missing = controlPlaneErrorCodeSchema.options.filter((code) => !shared.has(code));
    expect(missing).toEqual([]);
  });

  it('maps every code to a 4xx/5xx HTTP status', () => {
    for (const code of controlPlaneErrorCodeSchema.options) {
      const status = HTTP_STATUS_BY_CODE[code];
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
    }
  });

  it('control-plane success and failure envelopes parse with the shared jsonResponseSchema', () => {
    const schema = jsonResponseSchema(z.object({ n: z.number() }));
    expect(schema.safeParse(ok({ n: 1 })).success).toBe(true);
    for (const code of controlPlaneErrorCodeSchema.options) {
      expect(schema.safeParse(fail(code, 'x', { a: 1 })).success).toBe(true);
    }
  });
});
