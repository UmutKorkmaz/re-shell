import { describe, expect, it } from 'vitest';

import {
  HTTP_STATUS_BY_CODE,
  controlPlaneErrorCodeSchema,
  fail,
  ok,
} from './errors.js';

describe('control-plane envelopes', () => {
  it('ok wraps data with empty warnings by default', () => {
    expect(ok(42)).toEqual({ ok: true, data: 42, warnings: [] });
  });

  it('ok carries supplied warnings', () => {
    expect(ok('x', ['w1'])).toEqual({ ok: true, data: 'x', warnings: ['w1'] });
  });

  it('fail builds an error envelope without details', () => {
    const r = fail('FORBIDDEN', 'nope');
    expect(r).toEqual({ ok: false, error: { code: 'FORBIDDEN', message: 'nope' }, warnings: [] });
  });

  it('fail includes details when provided', () => {
    const r = fail('INVALID_REQUEST', 'bad', { field: 'x' }, ['w']);
    expect(r).toEqual({
      ok: false,
      error: { code: 'INVALID_REQUEST', message: 'bad', details: { field: 'x' } },
      warnings: ['w'],
    });
  });

  it('every error code has an HTTP status mapping', () => {
    for (const code of controlPlaneErrorCodeSchema.options) {
      expect(typeof HTTP_STATUS_BY_CODE[code]).toBe('number');
    }
  });
});
