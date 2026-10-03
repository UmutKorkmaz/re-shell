import { describe, it, expect } from 'vitest';
import {
  errorCodeSchema,
  sseEventSchema,
  wsAuthMessageSchema,
  wsClientMessageSchema,
  wsJobMessageSchema,
  wsServerMessageSchema,
  hubServerConfigSchema,
} from './index.js';

/**
 * Hub wire messages: the SSE stream and the `/jobs` WebSocket. The hub (emit
 * side), the browser clients (consume side) and the hub tests all validate
 * against these schemas, so each frame the hub can send or accept has a fixture.
 */

describe('wsClientMessageSchema', () => {
  it('accepts a start message', () => {
    expect(
      wsClientMessageSchema.safeParse({
        type: 'start',
        id: 'job-1',
        commandId: 'workspace.summary',
        params: { cwd: '.' },
      }).success
    ).toBe(true);
  });

  it('accepts a cancel message', () => {
    expect(wsClientMessageSchema.safeParse({ type: 'cancel', id: 'job-1' }).success).toBe(true);
  });

  it('accepts the first-message auth handshake', () => {
    const parsed = wsClientMessageSchema.safeParse({ type: 'auth', token: 's3cret' });
    expect(parsed.success).toBe(true);
    expect(wsAuthMessageSchema.safeParse({ type: 'auth', token: 's3cret' }).success).toBe(true);
  });

  it('rejects an auth message without a token', () => {
    expect(wsClientMessageSchema.safeParse({ type: 'auth' }).success).toBe(false);
  });

  it('rejects a job message without an id', () => {
    expect(wsJobMessageSchema.safeParse({ type: 'start', commandId: 'doctor' }).success).toBe(false);
    expect(wsClientMessageSchema.safeParse({ type: 'cancel' }).success).toBe(false);
  });

  it('rejects unknown message types and a raw argv', () => {
    expect(wsClientMessageSchema.safeParse({ type: 'exec', id: '1' }).success).toBe(false);
    expect(wsClientMessageSchema.safeParse({ type: 'start', id: '1', commandId: ['rm', '-rf'] }).success).toBe(false);
  });
});

describe('wsServerMessageSchema', () => {
  it.each([
    ['stdout chunk', { type: 'stdout', id: 'job-1', content: '{"ok":true' }],
    ['stderr line', { type: 'stderr', id: 'job-1', content: 'warning' }],
    ['exit', { type: 'exit', id: 'job-1', code: 0 }],
    ['heartbeat', { type: 'heartbeat', ts: '2026-01-01T00:00:00.000Z' }],
    ['error', { type: 'error', message: 'boom' }],
  ])('accepts %s', (_label, frame) => {
    expect(wsServerMessageSchema.safeParse(frame).success).toBe(true);
  });

  it.each([
    ['unknown type', { type: 'progress' }],
    ['non-numeric exit code', { type: 'exit', code: '0' }],
    ['non-string content', { type: 'stdout', content: 1 }],
    ['no type', { content: 'x' }],
  ])('rejects %s', (_label, frame) => {
    expect(wsServerMessageSchema.safeParse(frame).success).toBe(false);
  });
});

describe('sseEventSchema', () => {
  it.each([
    ['stdout', { type: 'stdout', content: 'line' }],
    ['stderr', { type: 'stderr', content: 'line' }],
    ['exit', { type: 'exit', code: 130 }],
    ['error', { type: 'error', message: 'nope' }],
    ['heartbeat', { type: 'heartbeat', ts: '2026-01-01T00:00:00.000Z' }],
  ])('accepts %s', (_label, event) => {
    expect(sseEventSchema.safeParse(event).success).toBe(true);
  });

  it('rejects an unknown event type and a non-numeric exit code', () => {
    expect(sseEventSchema.safeParse({ type: 'progress' }).success).toBe(false);
    expect(sseEventSchema.safeParse({ type: 'exit', code: 'zero' }).success).toBe(false);
  });
});

describe('hubServerConfigSchema', () => {
  it('accepts a launch config and rejects a partial one', () => {
    expect(hubServerConfigSchema.safeParse({ port: 3334, workspace: '/w', cliBin: '/cli.js' }).success).toBe(true);
    expect(hubServerConfigSchema.safeParse({ port: 3334 }).success).toBe(false);
  });
});

describe('errorCodeSchema vocabulary', () => {
  it('has no duplicate codes', () => {
    const codes = errorCodeSchema.options;
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('only contains SCREAMING_SNAKE_CASE identifiers', () => {
    for (const code of errorCodeSchema.options) {
      expect(code).toMatch(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/);
    }
  });
});
