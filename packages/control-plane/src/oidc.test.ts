import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it } from 'vitest';

import { loadOidcConfig, loadServeConfig, reloadOidcJwks } from './config.js';
import { SqliteTokenRevocations } from './db/sqlite-revocations.js';
import { JwtKeyRing, generateSecret } from './jwt.js';
import {
  OidcJwks, OidcSessionResolver, oidcUserId, verifyOidcToken,
} from './oidc.js';
import { startRuntime } from './runtime.js';
import { InMemoryTenantStore } from './tenant.js';
import { startHarness, STANDARD_SEED } from './test-support/harness.js';

const NOW = 1_800_000_000_000;
const issuer = 'http://localhost:9090/issuer';
const audience = 're-shell-staging-api';
const first = generateKeyPairSync('rsa', { modulusLength: 2048 });
const second = generateKeyPairSync('rsa', { modulusLength: 2048 });
function publicJwk(key = first, kid = 'k1') {
  return { ...key.publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' };
}
function options() { return { issuer, audience, jwks: new OidcJwks({ keys: [publicJwk()] }) }; }
function token(overrides: Record<string, unknown> = {}, key = first, kid = 'k1', header = {}) {
  // String payload permits deliberately missing/invalid claims in rejection fixtures.
  return jwt.sign(JSON.stringify({ iss: issuer, aud: audience, sub: 'alice', iat: NOW / 1000, exp: NOW / 1000 + 600, ...overrides }),
    key.privateKey, { algorithm: 'RS256', keyid: kid, header: { alg: 'RS256', ...header } });
}

const folders: string[] = [];
afterEach(() => { for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true }); });
function trustFile() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-oidc-'));
  folders.push(folder);
  const file = path.join(folder, 'jwks.json');
  fs.writeFileSync(file, JSON.stringify({ keys: [publicJwk()] }));
  return { file, env: { CONTROL_PLANE_OIDC_ISSUER: issuer, CONTROL_PLANE_OIDC_AUDIENCE: audience, CONTROL_PLANE_OIDC_JWKS_FILE: file } };
}

describe('OIDC access token verification', () => {
  it('verifies signed JWT access tokens and namespaces the identity by issuer and subject', () => {
    const signed = token();
    const verified = verifyOidcToken(signed, options(), NOW);
    expect(verified).toMatchObject({ issuer, subject: 'alice', userId: oidcUserId(issuer, 'alice'), expiresAt: NOW + 600_000 });
    expect(verified?.revocationId).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(oidcUserId(issuer, 'alice')).not.toBe('alice');
    expect(oidcUserId(issuer, 'alice')).not.toBe(oidcUserId('https://other.example', 'alice'));
    expect(verifyOidcToken(token({ aud: ['unrelated', audience] }, first, 'k1', { typ: 'at+jwt' }), options(), NOW)).toBeDefined();
  });

  it.each([
    { iss: 'https://foreign.example' }, { aud: 'browser-id-token-client' }, { sub: '' }, { sub: 'bad\nsubject' },
    { exp: NOW / 1000 }, { exp: NOW / 1000 - 1 }, { nbf: NOW / 1000 + 1 },
    { iat: NOW / 1000 + 1 }, { iat: undefined }, { exp: undefined }, { exp: 1.2 },
  ])('rejects invalid security claims %j', (claims) => {
    expect(verifyOidcToken(token(claims), options(), NOW)).toBeUndefined();
  });

  it('rejects tampering, unknown keys, wrong algorithms and token-supplied key locations', () => {
    const [h, , sig] = token().split('.');
    const tampered = `${h}.${Buffer.from(JSON.stringify({ iss: issuer, aud: audience, sub: 'root', exp: NOW / 1000 + 600 })).toString('base64url')}.${sig}`;
    const hmac = jwt.sign({ iss: issuer, aud: audience, sub: 'alice' }, first.publicKey.export({ format: 'pem', type: 'spki' }), { algorithm: 'HS256', keyid: 'k1' });
    const unsigned = jwt.sign({ iss: issuer, aud: audience, sub: 'alice' }, null, { algorithm: 'none', keyid: 'k1' });
    for (const signed of [tampered, token({}, second), token({}, first, 'unknown'), hmac, unsigned,
      token({}, first, 'k1', { jku: 'http://evil.example/keys' }), token({}, first, 'k1', { jwk: publicJwk(second) }),
      token({}, first, 'k1', { crit: ['exp'] }), token({}, first, 'k1', { typ: 'JWE' }), 'a.b.c', 'x'.repeat(16_385)]) {
      expect(verifyOidcToken(signed, options(), NOW)).toBeUndefined();
    }
  });

  it('rejects noncanonical base64url signatures that could bypass fingerprint revocation', () => {
    const signed = token();
    const parts = signed.split('.');
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const last = alphabet.indexOf(parts[2].slice(-1));
    const alternate = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -1)}${alphabet[last ^ 1]}`;
    expect(Buffer.from(parts[2], 'base64url')).toEqual(Buffer.from(alternate.split('.')[2], 'base64url'));
    expect(verifyOidcToken(signed, options(), NOW)).toBeDefined();
    expect(verifyOidcToken(alternate, options(), NOW)).toBeUndefined();
  });

  it('keeps local memberships authoritative and applies removal immediately', () => {
    const userId = oidcUserId(issuer, 'alice');
    const store = new InMemoryTenantStore({ tenants: [{ id: 'acme', name: 'Acme' }], members: [{ tenantId: 'acme', userId, role: 'viewer' }] });
    const resolver = new OidcSessionResolver(options(), store, { now: () => NOW });
    const signed = token({ tenantRoles: { globex: 'admin' }, role: 'admin', kind: 'worker', ten: 'globex' });
    expect(resolver.resolve(signed)?.principal).toEqual({ userId, tenantRoles: { acme: 'viewer' } });
    store.removeMember('acme', userId);
    expect(resolver.resolve(signed)?.principal.tenantRoles).toEqual({});
  });

  it('checks token fingerprint revocations even without jti and denies when the store fails', () => {
    const signed = token();
    const verified = verifyOidcToken(signed, options(), NOW)!;
    const memberships = { getMemberships: () => ({}) };
    const resolver = new OidcSessionResolver(options(), memberships, { now: () => NOW,
      revocations: { isRevoked: (iss, id) => iss === issuer && id === verified.revocationId } });
    expect(resolver.resolve(signed)).toBeUndefined();
    const broken = new OidcSessionResolver(options(), memberships, { now: () => NOW,
      revocations: { isRevoked: () => { throw new Error('database unavailable'); } } });
    expect(broken.resolve(signed)).toBeUndefined();
  });
});

describe('OIDC pinned trust configuration and rotation', () => {
  it('is disabled by default; rejects partial trust, bad issuer URLs and malformed files', () => {
    expect(loadOidcConfig({})).toMatchObject({ ok: true, data: undefined });
    const { file, env } = trustFile();
    for (const bad of [{ CONTROL_PLANE_OIDC_ISSUER: issuer }, { ...env, CONTROL_PLANE_OIDC_AUDIENCE: '' },
      { ...env, CONTROL_PLANE_OIDC_ISSUER: 'http://public.example' }, { ...env, CONTROL_PLANE_OIDC_ISSUER: 'https://user:password@example.com' },
      { ...env, CONTROL_PLANE_OIDC_ISSUER: 'https://idp.example?query=1' }, { ...env, CONTROL_PLANE_OIDC_JWKS_FILE: 'missing.json' }]) {
      expect(loadOidcConfig(bad).ok).toBe(false);
    }
    fs.writeFileSync(file, '{not-json');
    expect(loadOidcConfig(env).ok).toBe(false);
    const secretEnv = { CONTROL_PLANE_JWT_KEYS: JSON.stringify({ keys: { local: generateSecret() } }) };
    expect(loadServeConfig({ ...secretEnv, ...env }).ok).toBe(false);
  });

  it('rejects private, short, duplicate and unsupported keys', () => {
    const small = generateKeyPairSync('rsa', { modulusLength: 1024 });
    for (const value of [{ keys: [] }, { keys: [publicJwk(), publicJwk()] },
      { keys: [{ ...first.privateKey.export({ format: 'jwk' }), kid: 'private' }] },
      { keys: [publicJwk(small)] }, { keys: [{ ...publicJwk(), alg: 'HS256' }] },
      { keys: [{ ...publicJwk(), key_ops: ['sign'] }] }, { keys: [{ ...publicJwk(), key_ops: [] }] }]) {
      expect(() => new OidcJwks(value)).toThrow();
    }
  });

  it('reloads keys atomically, supports overlap, and retires removed keys', () => {
    const { file, env } = trustFile();
    const configured = loadOidcConfig(env);
    if (!configured.ok || !configured.data) throw new Error('fixture configuration failed');
    const trust = configured.data;
    const old = token();
    const fresh = token({}, second, 'k2');
    fs.writeFileSync(file, JSON.stringify({ keys: [publicJwk(), publicJwk(second, 'k2')] }));
    expect(reloadOidcJwks(trust, env)).toMatchObject({ ok: true, data: ['k1', 'k2'] });
    expect(verifyOidcToken(old, trust, NOW)).toBeDefined();
    expect(verifyOidcToken(fresh, trust, NOW)).toBeDefined();
    fs.writeFileSync(file, JSON.stringify({ keys: [publicJwk(second, 'k2'), { kty: 'RSA' }] }));
    expect(reloadOidcJwks(trust, env).ok).toBe(false);
    expect(verifyOidcToken(old, trust, NOW)).toBeDefined();
    fs.writeFileSync(file, JSON.stringify({ keys: [publicJwk(second, 'k2')] }));
    expect(reloadOidcJwks(trust, env).ok).toBe(true);
    expect(verifyOidcToken(old, trust, NOW)).toBeUndefined();
    expect(verifyOidcToken(fresh, trust, NOW)).toBeDefined();
  });
});

describe('HTTP bearer SSO wiring', () => {
  it('uses the configured issuer, preserves internal users/workers and denies foreign tenant access', async () => {
    const userId = oidcUserId(issuer, 'alice');
    const h = await startHarness({ now: () => NOW, seed: STANDARD_SEED, serverOptions: { oidc: options() } });
    try {
      h.store.setMember('acme', userId, 'viewer');
      const me = await h.request('GET', '/me', { token: token({ roles: ['admin'] }) });
      expect(me.status).toBe(200);
      expect(me.json.data.userId).toBe(userId);
      expect((await h.request('GET', '/tenants/acme/workspaces', { token: token() })).status).toBe(200);
      expect((await h.request('GET', '/tenants/globex/workspaces', { token: token({ ten: 'globex' }) })).status).toBe(403);
      expect((await h.request('GET', '/me', { token: h.userToken('alice') })).status).toBe(200);
      expect((await h.request('GET', '/me', { token: h.workerToken('w1', 'acme') })).status).toBe(401);
      expect((await h.request('POST', '/worker/claim', { token: token({ kind: 'worker', ten: 'acme' }), body: {} })).status).toBe(401);
      expect((await h.request('GET', '/me', { token: token({ iss: 'https://untrusted.example' }) })).status).toBe(401);
    } finally { await h.close(); }
  });

  it('connects runtime configuration and persistent external revocations', async () => {
    const { env } = trustFile();
    const keyRing = new JwtKeyRing({ internal: generateSecret() });
    const loaded = loadServeConfig({ ...env, CONTROL_PLANE_JWT_KEYS: JSON.stringify({ keys: { internal: keyRing.keyFor('internal')!.toString('base64url') } }),
      CONTROL_PLANE_PORT: '0', CONTROL_PLANE_DB: ':memory:' });
    if (!loaded.ok) throw new Error('config failed');
    // config resolves DB file paths; explicitly request an in-memory test database.
    const runtime = await startRuntime({ ...loaded.data, dbPath: ':memory:' });
    const signed = token({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600 });
    try {
      const response = () => fetch(`${runtime.listening.url}/me`, { headers: { Authorization: `Bearer ${signed}` } });
      expect((await response()).status).toBe(200);
      const verified = verifyOidcToken(signed, loaded.data.oidc!)!;
      new SqliteTokenRevocations(runtime.db).revoke(verified.issuer, verified.revocationId, verified.expiresAt, Date.now());
      expect((await response()).status).toBe(401);
    } finally { await runtime.close(); }
  });
});
