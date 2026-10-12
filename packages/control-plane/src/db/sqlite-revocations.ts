import type { DatabaseSync } from './sqlite.js';

/** Stores identifiers only: bearer tokens and key material never enter SQLite. */
export class SqliteTokenRevocations {
  constructor(private readonly db: DatabaseSync) {}

  revoke(issuer: string, jti: string, expiresAt: number, now: number): void {
    if (!issuer || !jti || !Number.isSafeInteger(expiresAt) || !Number.isSafeInteger(now) || expiresAt <= now) {
      throw new Error('Revocation requires an unexpired verified token.');
    }
    this.db.prepare(`INSERT INTO revoked_tokens (issuer, jti, expires_at, revoked_at)
      VALUES (?, ?, ?, ?) ON CONFLICT (issuer, jti)
      DO UPDATE SET expires_at = MAX(expires_at, excluded.expires_at)`)
      .run(issuer, jti, expiresAt, now);
    this.db.prepare('DELETE FROM revoked_tokens WHERE expires_at <= ?').run(now);
  }

  isRevoked(issuer: string, jti: string, now: number): boolean {
    return this.db.prepare('SELECT 1 FROM revoked_tokens WHERE issuer = ? AND jti = ? AND expires_at > ?')
      .get(issuer, jti, now) !== undefined;
  }
}
