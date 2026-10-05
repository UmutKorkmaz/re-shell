import { describe, expect, it } from 'vitest';

import { loadServeConfig, parseIceServers } from './config.js';
import { generateSecret } from './jwt.js';

const KEYS = JSON.stringify({ activeKid: 'k1', keys: { k1: generateSecret() } });

describe('CONTROL_PLANE_ICE_SERVERS', () => {
  it('defaults to no ICE servers (host candidates only)', () => {
    expect(parseIceServers(undefined)).toMatchObject({ ok: true, data: [] });
    expect(parseIceServers('  ')).toMatchObject({ ok: true, data: [] });
    expect(loadServeConfig({ CONTROL_PLANE_JWT_KEYS: KEYS })).toMatchObject({ ok: true, data: { iceServers: [] } });
  });

  it('accepts STUN servers and authenticated TURN servers', () => {
    const raw = JSON.stringify([
      { urls: 'stun:stun.example.org:3478' },
      { urls: ['turn:turn.example.org:3478?transport=udp', 'turns:turn.example.org:5349'], username: 'u', credential: 'c' },
    ]);
    const parsed = parseIceServers(raw);
    expect(parsed).toMatchObject({ ok: true });
    expect(loadServeConfig({ CONTROL_PLANE_JWT_KEYS: KEYS, CONTROL_PLANE_ICE_SERVERS: raw })).toMatchObject({
      ok: true,
      data: { iceServers: [{ urls: 'stun:stun.example.org:3478' }, { username: 'u' }] },
    });
  });

  it('rejects anything that could be abused or is malformed, with CONFIG_ERROR', () => {
    const bad = [
      '{',
      '{"urls":"stun:x"}', // not an array
      '[{"urls":"http://evil.example"}]', // not a stun/turn URL
      '[{"urls":[]}]', // no URL
      '[{"urls":"turn:t.example.org"}]', // an open TURN relay: credentials required
      '[{"urls":"turn:t.example.org","username":"u"}]',
      JSON.stringify(Array.from({ length: 9 }, () => ({ urls: 'stun:x.example.org' }))),
      '[{"nope":1}]',
    ];
    for (const raw of bad) {
      const r = parseIceServers(raw);
      expect(r, raw).toMatchObject({ ok: false, error: { code: 'CONFIG_ERROR' } });
      expect(loadServeConfig({ CONTROL_PLANE_JWT_KEYS: KEYS, CONTROL_PLANE_ICE_SERVERS: raw }).ok, raw).toBe(false);
    }
  });
});

describe('CONTROL_PLANE_MAX_ACTIVE_SESSIONS', () => {
  it('tunes the per-tenant session limit within bounds', () => {
    expect(loadServeConfig({ CONTROL_PLANE_JWT_KEYS: KEYS, CONTROL_PLANE_MAX_ACTIVE_SESSIONS: '5' })).toMatchObject({
      ok: true,
      data: { limits: { maxActiveSessionsPerTenant: 5 } },
    });
    for (const value of ['0', '-1', 'x', '100000']) {
      expect(loadServeConfig({ CONTROL_PLANE_JWT_KEYS: KEYS, CONTROL_PLANE_MAX_ACTIVE_SESSIONS: value }).ok, value).toBe(false);
    }
  });
});
