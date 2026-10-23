import { createHash, createPublicKey, type KeyObject } from 'node:crypto';

import jwt from 'jsonwebtoken';
import { z } from 'zod';

import type { Session, SessionResolver } from './auth.js';
import type { IdentityOptions } from './identity.js';
import type { TenantAdminStore } from './tenant.js';

const rsaJwkSchema = z.object({
  kty: z.literal('RSA'),
  kid: z.string().min(1).max(256),
  n: z.string().regex(/^[A-Za-z0-9_-]+$/),
  e: z.string().regex(/^[A-Za-z0-9_-]+$/),
  alg: z.literal('RS256').optional(),
  use: z.literal('sig').optional(),
  key_ops: z.array(z.literal('verify')).min(1).max(1).optional(),
}).passthrough();

/** Operator-pinned PUBLIC keys only. Reload builds a complete replacement first. */
export class OidcJwks {
  private keys = new Map<string, KeyObject>();

  constructor(value: unknown) { this.reload(value); }

  get kids(): string[] { return [...this.keys.keys()]; }

  keyFor(kid: string): KeyObject | undefined { return this.keys.get(kid); }

  reload(value: unknown): void {
    const parsed = z.object({ keys: z.array(rsaJwkSchema).min(1).max(32) }).parse(value);
    const next = new Map<string, KeyObject>();
    for (const jwk of parsed.keys) {
      if (next.has(jwk.kid)) throw new Error('Duplicate OIDC key id.');
      // Do not accidentally load private material or a symmetric key as trusted public keys.
      if (['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k'].some((field) => field in jwk)) {
        throw new Error('OIDC JWKS must contain public keys only.');
      }
      const key = createPublicKey({ key: { kty: 'RSA', n: jwk.n, e: jwk.e }, format: 'jwk' });
      if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
        throw new Error('OIDC RSA keys must have at least 2048 bits.');
      }
      next.set(jwk.kid, key);
    }
    this.keys = next;
  }
}

export interface OidcOptions {
  issuer: string;
  /** API audience, distinct from the browser client's ID-token audience. */
  audience: string;
  jwks: OidcJwks;
}

/** Stable namespace prevents an IdP subject from impersonating an internal user. */
export function oidcUserId(issuer: string, subject: string): string {
  return `oidc:${createHash('sha256').update(JSON.stringify([issuer, subject])).digest('hex')}`;
}

export interface VerifiedOidcToken {
  issuer: string;
  subject: string;
  userId: string;
  expiresAt: number;
  /** Token fingerprint, also available for issuers that omit jti. Never store raw tokens. */
  revocationId: string;
}

/** Verify JWT access tokens against configured trust only; never fetch token-provided URLs. */
export function verifyOidcToken(
  token: string,
  options: OidcOptions,
  now: number = Date.now()
): VerifiedOidcToken | undefined {
  try {
    if (token.length > 16_384 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return undefined;
    if (token.split('.').some((part) => Buffer.from(part, 'base64url').toString('base64url') !== part)) return undefined;
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || decoded.header.alg !== 'RS256' || typeof decoded.header.kid !== 'string') return undefined;
    // Unknown critical semantics and token-controlled key sources cannot enter verification.
    if (Object.keys(decoded.header).some((key) => !['alg', 'kid', 'typ'].includes(key))) return undefined;
    if (decoded.header.typ !== undefined && !['JWT', 'at+jwt'].includes(decoded.header.typ)) return undefined;
    const key = options.jwks.keyFor(decoded.header.kid);
    if (!key) return undefined;
    const payload = jwt.verify(token, key, {
      algorithms: ['RS256'], issuer: options.issuer, audience: options.audience,
      clockTimestamp: Math.floor(now / 1000), clockTolerance: 0,
    });
    if (typeof payload === 'string') return undefined;
    const { iss, sub, iat, exp } = payload;
    // Reject control characters in externally supplied subject identifiers.
    // eslint-disable-next-line no-control-regex
    if (iss !== options.issuer || typeof sub !== 'string' || !sub || sub.length > 1024 || /[\u0000-\u001f\u007f]/.test(sub)) return undefined;
    if (!Number.isSafeInteger(iat) || !Number.isSafeInteger(exp) || iat === undefined || exp === undefined ||
        iat > Math.floor(now / 1000) || exp <= iat || !Number.isSafeInteger(exp * 1000)) return undefined;
    return {
      issuer: iss, subject: sub, userId: oidcUserId(iss, sub), expiresAt: exp * 1000,
      revocationId: `sha256:${createHash('sha256').update(token).digest('hex')}`,
    };
  } catch { return undefined; }
}

export class OidcSessionResolver implements SessionResolver {
  constructor(
    private readonly options: OidcOptions,
    private readonly memberships: Pick<TenantAdminStore, 'getMemberships'>,
    private readonly identity: Pick<IdentityOptions, 'now' | 'revocations'> = {}
  ) {}

  resolve(token: string): Session | undefined {
    try {
      const now = (this.identity.now ?? Date.now)();
      const verified = verifyOidcToken(token, this.options, now);
      if (!verified || this.identity.revocations?.isRevoked(verified.issuer, verified.revocationId, now)) return undefined;
      return {
        token, expiresAt: verified.expiresAt,
        principal: { userId: verified.userId, tenantRoles: { ...this.memberships.getMemberships(verified.userId) } },
      };
    } catch { return undefined; }
  }
}

/** Internal user credentials and optional external bearer SSO share the same authz path. */
export class CompositeSessionResolver implements SessionResolver {
  constructor(private readonly resolvers: readonly SessionResolver[]) {}

  resolve(token: string): Session | undefined {
    for (const resolver of this.resolvers) {
      const session = resolver.resolve(token);
      if (session) return session;
    }
    return undefined;
  }
}
