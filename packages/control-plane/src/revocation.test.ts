import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './db/sqlite.js';
import { migrate } from './db/migrations.js';
import { SqliteTokenRevocations } from './db/sqlite-revocations.js';
import { JwtSessionResolver, WorkerTokenVerifier, issueUserToken, issueWorkerToken } from './identity.js';
import { JwtKeyRing, generateSecret } from './jwt.js';
import { InMemoryTenantStore } from './tenant.js';

describe('persistent token revocation', () => {
  it('rejects a revoked user and worker without invalidating other tokens, including after restart', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 're-shell-revoke-'));
    const file = path.join(dir, 'db.sqlite');
    const now = 1_800_000_000_000;
    const keyRing = new JwtKeyRing({ k1: generateSecret() });
    const identity = { keyRing, now: () => now };
    const user = issueUserToken(identity, { userId: 'alice' });
    const other = issueUserToken(identity, { userId: 'alice' });
    const worker = issueWorkerToken(identity, { workerId: 'w1', tenantId: 't1' });
    let db = openDatabase(file);
    try {
      migrate(db);
      let revocations = new SqliteTokenRevocations(db);
      let options = { ...identity, revocations };
      expect(new JwtSessionResolver(options, new InMemoryTenantStore()).resolve(user.token)).toBeDefined();
      expect(new WorkerTokenVerifier(options).verify(worker.token)).toBeDefined();
      revocations.revoke('re-shell-control-plane', user.jti, user.expiresAt, now);
      revocations.revoke('re-shell-control-plane', worker.jti, worker.expiresAt, now);
      expect(new JwtSessionResolver(options, new InMemoryTenantStore()).resolve(user.token)).toBeUndefined();
      expect(new WorkerTokenVerifier(options).verify(worker.token)).toBeUndefined();
      expect(new JwtSessionResolver(options, new InMemoryTenantStore()).resolve(other.token)).toBeDefined();
      db.close();
      db = openDatabase(file);
      revocations = new SqliteTokenRevocations(db);
      options = { ...identity, revocations };
      expect(new JwtSessionResolver(options, new InMemoryTenantStore()).resolve(user.token)).toBeUndefined();
      expect(new WorkerTokenVerifier(options).verify(worker.token)).toBeUndefined();
      expect(revocations.isRevoked('another-issuer', user.jti, now)).toBe(false);
      expect(revocations.isRevoked('re-shell-control-plane', user.jti, user.expiresAt)).toBe(false);
    } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
  });

  it('fails closed when the revocation store is unavailable', () => {
    const keyRing = new JwtKeyRing({ k1: generateSecret() });
    const user = issueUserToken({ keyRing }, { userId: 'alice' });
    const worker = issueWorkerToken({ keyRing }, { workerId: 'w1', tenantId: 't1' });
    const options = { keyRing, revocations: { isRevoked() { throw new Error('store offline'); } } };
    expect(new JwtSessionResolver(options, new InMemoryTenantStore()).resolve(user.token)).toBeUndefined();
    expect(new WorkerTokenVerifier(options).verify(worker.token)).toBeUndefined();
  });
});
