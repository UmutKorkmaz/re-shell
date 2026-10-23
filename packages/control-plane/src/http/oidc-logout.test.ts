import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { OidcJwks } from '../oidc.js';
import { SqliteTokenRevocations } from '../db/sqlite-revocations.js';
import { JwtKeyRing, generateSecret } from '../jwt.js';
import { openDatabase } from '../db/sqlite.js';
import { startHarness } from '../test-support/harness.js';

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const issuer = 'https://identity.example';
const oidc = { issuer, audience: 're-shell-api', jwks: new OidcJwks({ keys: [{
  ...keys.publicKey.export({ format: 'jwk' }), kid: 'test', alg: 'RS256', use: 'sig',
}] }) };
const token = (sub: string) => jwt.sign({ sub }, keys.privateKey, {
  algorithm: 'RS256', keyid: 'test', issuer, audience: oidc.audience, expiresIn: 600,
});

describe('OIDC API sign-out', () => {
  it('durably revokes only the verified external credential across server restart', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 're-shell-logout-'));
    const file = path.join(dir, 'db.sqlite');
    const revocationDb = openDatabase(file);
    const keyRing = new JwtKeyRing({ k1: generateSecret() });
    const revocations = new SqliteTokenRevocations(revocationDb);
    let h = await startHarness({ dbFile: file, serverOptions: { oidc, identity: { keyRing, revocations } } });
    try {
      const signed = token('alice');
      const other = token('bob');
      expect((await h.request('GET', '/me', { token: signed })).status).toBe(200);
      expect((await h.request('POST', '/auth/oidc/logout')).status).toBe(401);
      expect((await h.request('POST', '/auth/oidc/logout', { token: h.userToken('alice') })).status).toBe(401);
      const response = await h.request('POST', '/auth/oidc/logout', { token: signed });
      expect(response.status).toBe(204);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect((await h.request('GET', '/me', { token: signed })).status).toBe(401);
      expect((await h.request('GET', '/me', { token: other })).status).toBe(200);
      await h.close();
      h = await startHarness({ dbFile: file, serverOptions: { oidc, identity: { keyRing, revocations } } });
      expect((await h.request('GET', '/me', { token: signed })).status).toBe(401);
      expect(JSON.stringify(revocationDb.prepare('SELECT * FROM revoked_tokens').all())).not.toContain(signed);
    } finally { await h.close(); revocationDb.close(); rmSync(dir, { recursive: true, force: true }); }
  });

  it('does not report successful API logout without a working persistent store', async () => {
    for (const revocations of [undefined, { isRevoked: () => false, revoke: () => { throw new Error('offline'); } }]) {
      const h = await startHarness({ serverOptions: { oidc, identity: { keyRing: new JwtKeyRing({ k1: generateSecret() }), revocations } } });
      try {
        expect((await h.request('POST', '/auth/oidc/logout', { token: token('alice') })).status).toBe(503);
      } finally { await h.close(); }
    }
  });
});
