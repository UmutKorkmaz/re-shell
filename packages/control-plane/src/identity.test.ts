import { createHmac, randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { authenticate } from './auth.js';
import {
  DEFAULT_AUDIENCE,
  DEFAULT_ISSUER,
  JwtSessionResolver,
  USER_TOKEN_MAX_TTL,
  WorkerTokenVerifier,
  issueUserToken,
  issueWorkerToken,
} from './identity.js';
import { JwtKeyRing, base64urlEncode, generateSecret, signJwt, verifyJwt } from './jwt.js';
import { InMemoryTenantStore } from './tenant.js';

const NOW = 1_800_000_000_000; // fixed instant (ms)

function ring(extra: Record<string, string> = {}, active = 'k1'): JwtKeyRing {
  return new JwtKeyRing({ k1: generateSecret(), ...extra }, active);
}

const VERIFY = { issuer: DEFAULT_ISSUER, audience: DEFAULT_AUDIENCE, now: NOW };

function claims(overrides: Record<string, unknown> = {}) {
  const iat = Math.floor(NOW / 1000);
  return {
    iss: DEFAULT_ISSUER,
    aud: DEFAULT_AUDIENCE,
    sub: 'alice',
    iat,
    exp: iat + 3600,
    jti: 'j1',
    kind: 'user' as const,
    ...overrides,
  };
}

/** Hand-build a token with an arbitrary header/payload, signed with `secret` as HS256. */
function forge(header: unknown, payload: unknown, secret: Buffer | string): string {
  const h = base64urlEncode(JSON.stringify(header));
  const p = base64urlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', typeof secret === 'string' ? Buffer.from(secret, 'base64url') : secret)
    .update(`${h}.${p}`)
    .digest('base64url');
  return `${h}.${p}.${sig}`;
}

describe('JwtKeyRing', () => {
  it('rejects short, malformed and ambiguous key configuration', () => {
    expect(() => new JwtKeyRing({ k1: base64urlEncode(randomBytes(16)) })).toThrow(/too short/);
    expect(() => new JwtKeyRing({ 'bad kid!': generateSecret() })).toThrow(/Invalid key id/);
    expect(() => new JwtKeyRing({ k1: 'not base64 !!!' })).toThrow(/base64/);
    expect(() => new JwtKeyRing({})).toThrow(/At least one/);
    expect(() => new JwtKeyRing({ a: generateSecret(), b: generateSecret() })).toThrow(/active/);
    expect(() => new JwtKeyRing({ a: generateSecret() }, 'zzz')).toThrow(/not in the key ring/);
  });

  it('defaults the active key when exactly one is configured and never lists secrets', () => {
    const k = new JwtKeyRing({ only: generateSecret() });
    expect(k.activeKid).toBe('only');
    expect(k.kids).toEqual(['only']);
  });
});

describe('signJwt / verifyJwt', () => {
  it('round-trips claims and reports the signing kid', () => {
    const k = ring();
    const token = signJwt(k, claims());
    const r = verifyJwt(token, k, VERIFY);
    expect(r).toMatchObject({ ok: true, kid: 'k1', claims: { sub: 'alice', kind: 'user' } });
  });

  it('rejects a tampered payload and a tampered signature', () => {
    const k = ring();
    const [h, p, s] = signJwt(k, claims()).split('.');
    const evil = base64urlEncode(JSON.stringify(claims({ sub: 'mallory' })));
    expect(verifyJwt(`${h}.${evil}.${s}`, k, VERIFY)).toEqual({ ok: false, reason: 'bad-signature' });
    const flipped = s.slice(0, -2) + (s.endsWith('AA') ? 'BB' : 'AA');
    expect(verifyJwt(`${h}.${p}.${flipped}`, k, VERIFY)).toMatchObject({ ok: false });
  });

  it('rejects alg=none and every non-HS256 algorithm before checking signatures', () => {
    const k = ring();
    const payload = claims();
    const none = `${base64urlEncode(JSON.stringify({ alg: 'none', typ: 'JWT', kid: 'k1' }))}.${base64urlEncode(
      JSON.stringify(payload)
    )}.`;
    expect(verifyJwt(none, k, VERIFY)).toMatchObject({ ok: false });
    for (const alg of ['none', 'HS384', 'HS512', 'RS256', 'ES256', 'EdDSA', 'hs256', '']) {
      const token = forge({ alg, typ: 'JWT', kid: 'k1' }, payload, randomBytes(32));
      expect(verifyJwt(token, k, VERIFY)).toMatchObject({ ok: false, reason: 'bad-algorithm' });
    }
  });

  it('rejects headers carrying anything beyond alg/typ/kid (jwk, jku, crit, ...)', () => {
    const k = ring();
    for (const extra of [{ jwk: { kty: 'oct' } }, { jku: 'https://evil' }, { crit: ['exp'] }, { x5u: 'x' }]) {
      const token = forge({ alg: 'HS256', typ: 'JWT', kid: 'k1', ...extra }, claims(), randomBytes(32));
      expect(verifyJwt(token, k, VERIFY)).toEqual({ ok: false, reason: 'bad-header' });
    }
    // Wrong typ and missing/invalid kid are header errors too.
    expect(verifyJwt(forge({ alg: 'HS256', typ: 'JWE', kid: 'k1' }, claims(), randomBytes(32)), k, VERIFY)).toMatchObject({ ok: false, reason: 'bad-header' });
    expect(verifyJwt(forge({ alg: 'HS256', typ: 'JWT' }, claims(), randomBytes(32)), k, VERIFY)).toMatchObject({ ok: false, reason: 'bad-header' });
    expect(verifyJwt(forge({ alg: 'HS256', typ: 'JWT', kid: '../x' }, claims(), randomBytes(32)), k, VERIFY)).toMatchObject({ ok: false, reason: 'bad-header' });
  });

  it('rejects an unknown kid and a token signed by a different secret under a known kid', () => {
    const k = ring();
    const stranger = ring({}, 'k1');
    expect(verifyJwt(signJwt(stranger, claims()), k, VERIFY)).toEqual({ ok: false, reason: 'bad-signature' });
    const other = new JwtKeyRing({ kX: generateSecret() });
    expect(verifyJwt(signJwt(other, claims()), k, VERIFY)).toEqual({ ok: false, reason: 'unknown-key' });
  });

  it('enforces issuer, audience, expiry, not-before and issued-at', () => {
    const k = ring();
    const iat = Math.floor(NOW / 1000);
    expect(verifyJwt(signJwt(k, claims({ iss: 'someone-else' })), k, VERIFY)).toEqual({ ok: false, reason: 'wrong-issuer' });
    expect(verifyJwt(signJwt(k, claims({ aud: 'other-service' })), k, VERIFY)).toEqual({ ok: false, reason: 'wrong-audience' });
    // exp is exclusive: valid one second before, rejected at the instant.
    const t = signJwt(k, claims({ exp: iat + 10 }));
    expect(verifyJwt(t, k, { ...VERIFY, now: NOW + 9_000 }).ok).toBe(true);
    expect(verifyJwt(t, k, { ...VERIFY, now: NOW + 10_000 })).toEqual({ ok: false, reason: 'expired' });
    expect(verifyJwt(signJwt(k, claims({ nbf: iat + 600 })), k, VERIFY)).toEqual({ ok: false, reason: 'not-yet-valid' });
    expect(verifyJwt(signJwt(k, claims({ iat: iat + 600, exp: iat + 4000 })), k, VERIFY)).toEqual({ ok: false, reason: 'not-yet-valid' });
    // Small skew is tolerated.
    expect(verifyJwt(signJwt(k, claims({ iat: iat + 3, exp: iat + 4000 })), k, VERIFY).ok).toBe(true);
  });

  it('rejects structurally broken input without throwing', () => {
    const k = ring();
    const good = signJwt(k, claims());
    const inputs: unknown[] = [
      undefined,
      null,
      42,
      {},
      '',
      'a.b',
      `${good}.extra`,
      `${good}.`,
      '..',
      'a b.c.d',
      `${good.split('.')[0]}.@@@.sig`,
      'x'.repeat(5000),
    ];
    for (const input of inputs) {
      expect(verifyJwt(input, k, VERIFY)).toMatchObject({ ok: false });
    }
    // Valid signature over a non-object / claim-less payload is still rejected.
    const secretFor = (kid: string) => (k as unknown as { keyFor(k: string): Buffer }).keyFor(kid);
    expect(verifyJwt(forge({ alg: 'HS256', typ: 'JWT', kid: 'k1' }, [1, 2], secretFor('k1')), k, VERIFY)).toEqual({ ok: false, reason: 'bad-claims' });
    expect(verifyJwt(forge({ alg: 'HS256', typ: 'JWT', kid: 'k1' }, { sub: 'x' }, secretFor('k1')), k, VERIFY)).toEqual({ ok: false, reason: 'bad-claims' });
    expect(verifyJwt(forge({ alg: 'HS256', typ: 'JWT', kid: 'k1' }, { ...claims(), admin: true }, secretFor('k1')), k, VERIFY)).toEqual({ ok: false, reason: 'bad-claims' });
  });
});

describe('key rotation', () => {
  it('keeps verifying tokens from a retired key until it is removed from the ring', () => {
    const s1 = generateSecret();
    const s2 = generateSecret();
    const oldRing = new JwtKeyRing({ k1: s1 }, 'k1');
    const oldToken = signJwt(oldRing, claims());

    // Rotation step 1: add k2 and make it active; k1 stays verify-only.
    const rotated = new JwtKeyRing({ k1: s1, k2: s2 }, 'k2');
    expect(verifyJwt(oldToken, rotated, VERIFY)).toMatchObject({ ok: true, kid: 'k1' });
    const fresh = signJwt(rotated, claims({ jti: 'j2' }));
    expect(JSON.parse(Buffer.from(fresh.split('.')[0], 'base64url').toString()).kid).toBe('k2');
    expect(verifyJwt(fresh, rotated, VERIFY)).toMatchObject({ ok: true, kid: 'k2' });

    // Step 2: retire k1 — tokens it signed stop working.
    const retired = new JwtKeyRing({ k2: s2 }, 'k2');
    expect(verifyJwt(oldToken, retired, VERIFY)).toEqual({ ok: false, reason: 'unknown-key' });
    expect(verifyJwt(fresh, retired, VERIFY).ok).toBe(true);
  });
});

describe('token issuance', () => {
  it('issues a user token with the requested lifetime and refuses out-of-range lifetimes', () => {
    const opts = { keyRing: ring(), now: () => NOW };
    const t = issueUserToken(opts, { userId: 'alice', ttlSeconds: 120 });
    expect(t.expiresAt).toBe(NOW + 120_000);
    expect(t.kid).toBe('k1');
    expect(() => issueUserToken(opts, { userId: 'alice', ttlSeconds: 0 })).toThrow(/lifetime/);
    expect(() => issueUserToken(opts, { userId: 'alice', ttlSeconds: USER_TOKEN_MAX_TTL + 1 })).toThrow(/lifetime/);
    expect(() => issueUserToken(opts, { userId: '' })).toThrow();
    expect(() => issueWorkerToken(opts, { workerId: '..', tenantId: 't' })).toThrow();
  });

  it('gives every token a distinct jti', () => {
    const opts = { keyRing: ring(), now: () => NOW };
    expect(issueUserToken(opts, { userId: 'a' }).jti).not.toBe(issueUserToken(opts, { userId: 'a' }).jti);
  });
});

describe('JwtSessionResolver', () => {
  function setup() {
    const store = new InMemoryTenantStore({
      tenants: [{ id: 'acme', name: 'Acme' }],
      members: [{ tenantId: 'acme', userId: 'alice', role: 'admin' }],
    });
    let now = NOW;
    const opts = { keyRing: ring(), now: () => now };
    const resolver = new JwtSessionResolver(opts, store);
    return { store, opts, resolver, advance: (ms: number) => (now += ms) };
  }

  it('authenticates a valid token to a principal carrying the CURRENT memberships', () => {
    const { store, opts, resolver } = setup();
    const { token } = issueUserToken(opts, { userId: 'alice' });
    const r = authenticate(resolver, token, NOW);
    expect(r).toMatchObject({ ok: true, data: { userId: 'alice', tenantRoles: { acme: 'admin' } } });

    // A membership change is visible on the very next resolution — no re-login.
    store.setMember('acme', 'bob', 'viewer');
    store.setMember('acme', 'alice', 'admin');
    const bob = issueUserToken(opts, { userId: 'bob' });
    expect(authenticate(resolver, bob.token, NOW)).toMatchObject({ data: { tenantRoles: { acme: 'viewer' } } });
    store.removeMember('acme', 'bob');
    expect(authenticate(resolver, bob.token, NOW)).toMatchObject({ ok: true, data: { tenantRoles: {} } });
  });

  it('answers unknown, malformed, tampered, wrong-kind and expired tokens identically (no oracle)', () => {
    const { opts, resolver, advance } = setup();
    const good = issueUserToken(opts, { userId: 'alice', ttlSeconds: 60 }).token;
    const worker = issueWorkerToken(opts, { workerId: 'w1', tenantId: 'acme' }).token;
    const foreign = signJwt(ring(), claims());
    const [h, p, s] = good.split('.');
    const tampered = `${h}.${base64urlEncode(JSON.stringify(claims({ sub: 'root' })))}.${s}`;
    const bad = [undefined, '', '   ', 'garbage', `${h}.${p}`, tampered, foreign, worker];
    const results = bad.map((t) => authenticate(resolver, t, NOW));

    advance(61_000);
    const expired = authenticate(resolver, good, NOW + 61_000);
    results.push(expired);

    for (const r of results.slice(3)) {
      // Same code AND same message for every non-trivial failure — including expiry.
      expect(r).toEqual({
        ok: false,
        error: { code: 'UNAUTHENTICATED', message: 'Invalid bearer token.' },
        warnings: [],
      });
    }
    for (const r of results.slice(0, 3)) {
      expect(r).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
    }
  });

  it('does not accept a token whose claims name another issuer or audience', () => {
    const { opts, resolver } = setup();
    const t = issueUserToken({ ...opts, audience: 'other' }, { userId: 'alice' }).token;
    expect(authenticate(resolver, t, NOW)).toMatchObject({ ok: false });
  });
});

describe('WorkerTokenVerifier', () => {
  it('accepts only worker tokens and exposes the tenant binding', () => {
    const opts = { keyRing: ring(), now: () => NOW };
    const verifier = new WorkerTokenVerifier(opts);
    const w = issueWorkerToken(opts, { workerId: 'w-1', tenantId: 'acme', ttlSeconds: 300 });
    expect(verifier.verify(w.token)).toEqual({
      workerId: 'w-1',
      tenantId: 'acme',
      expiresAt: NOW + 300_000,
    });
    expect(verifier.verify(issueUserToken(opts, { userId: 'alice' }).token)).toBeUndefined();
    expect(verifier.verify('nonsense')).toBeUndefined();
    expect(verifier.verify(undefined)).toBeUndefined();
  });

  it('rejects an expired worker token', () => {
    let now = NOW;
    const opts = { keyRing: ring(), now: () => now };
    const verifier = new WorkerTokenVerifier(opts);
    const w = issueWorkerToken(opts, { workerId: 'w', tenantId: 'acme', ttlSeconds: 10 });
    now += 11_000;
    expect(verifier.verify(w.token)).toBeUndefined();
  });
});
