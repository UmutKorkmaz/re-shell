import { randomUUID } from 'node:crypto';

import { Principal, Session, SessionResolver } from './auth.js';
import { JwtClaims, JwtKeyRing, signJwt, verifyJwt } from './jwt.js';
import type { TenantAdminStore } from './tenant.js';
import { idSchema, userIdSchema } from './tenant.js';

/**
 * Identity for the hosted control plane: signed bearer tokens.
 *
 * A token proves WHO is calling (and, for workers, which tenant they serve). It
 * deliberately does NOT carry tenant roles: membership lives in the database
 * (`memberships`) and is read at request time, so an admin adding, demoting or
 * removing a member takes effect on the very next request and a leaked user
 * token cannot outlive the user's membership.
 *
 * Failure behaviour is uniform: unknown, malformed, tampered, wrong-audience and
 * expired tokens ALL resolve to "no session", which `authenticate()` turns into
 * the same UNAUTHENTICATED response (no token-probing oracle).
 */

export const DEFAULT_ISSUER = 're-shell-control-plane';
export const DEFAULT_AUDIENCE = 're-shell-control-plane';

/** Lifetime bounds (seconds) enforced when ISSUING tokens. */
export const USER_TOKEN_DEFAULT_TTL = 60 * 60; // 1 hour
export const USER_TOKEN_MAX_TTL = 30 * 24 * 60 * 60; // 30 days
export const WORKER_TOKEN_DEFAULT_TTL = 24 * 60 * 60; // 1 day
export const WORKER_TOKEN_MAX_TTL = 90 * 24 * 60 * 60; // 90 days

export interface IdentityOptions {
  keyRing: JwtKeyRing;
  issuer?: string;
  audience?: string;
  /** Unix-ms clock (injected in tests). */
  now?: () => number;
}

export interface IssuedToken {
  token: string;
  /** Unix ms. */
  expiresAt: number;
  kid: string;
  jti: string;
}

function resolveOptions(options: IdentityOptions): Required<Omit<IdentityOptions, 'keyRing'>> & {
  keyRing: JwtKeyRing;
} {
  return {
    keyRing: options.keyRing,
    issuer: options.issuer ?? DEFAULT_ISSUER,
    audience: options.audience ?? DEFAULT_AUDIENCE,
    now: options.now ?? Date.now,
  };
}

function ttlOrThrow(ttlSeconds: number, max: number): number {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > max) {
    throw new Error(`Token lifetime must be an integer between 1 and ${max} seconds.`);
  }
  return ttlSeconds;
}

function issue(options: IdentityOptions, claims: Omit<JwtClaims, 'iss' | 'aud' | 'iat' | 'exp' | 'jti'>, ttl: number): IssuedToken {
  const o = resolveOptions(options);
  const iat = Math.floor(o.now() / 1000);
  const exp = iat + ttl;
  const jti = randomUUID();
  const token = signJwt(o.keyRing, {
    ...claims,
    iss: o.issuer,
    aud: o.audience,
    iat,
    exp,
    jti,
  });
  return { token, expiresAt: exp * 1000, kid: o.keyRing.activeKid, jti };
}

/** Issue a user token. The user need not exist yet; membership is checked per request. */
export function issueUserToken(
  options: IdentityOptions,
  input: { userId: string; ttlSeconds?: number }
): IssuedToken {
  const userId = userIdSchema.parse(input.userId);
  const ttl = ttlOrThrow(input.ttlSeconds ?? USER_TOKEN_DEFAULT_TTL, USER_TOKEN_MAX_TTL);
  return issue(options, { sub: userId, kind: 'user' }, ttl);
}

/** Issue a worker token bound to ONE tenant. */
export function issueWorkerToken(
  options: IdentityOptions,
  input: { workerId: string; tenantId: string; ttlSeconds?: number }
): IssuedToken {
  const workerId = idSchema.parse(input.workerId);
  const tenantId = idSchema.parse(input.tenantId);
  const ttl = ttlOrThrow(input.ttlSeconds ?? WORKER_TOKEN_DEFAULT_TTL, WORKER_TOKEN_MAX_TTL);
  return issue(options, { sub: `worker:${workerId}`, kind: 'worker', ten: tenantId }, ttl);
}

/**
 * {@link SessionResolver} that verifies signed USER tokens and attaches the
 * user's CURRENT memberships (from the database) as the principal's roles.
 */
export class JwtSessionResolver implements SessionResolver {
  private readonly options: ReturnType<typeof resolveOptions>;

  constructor(
    options: IdentityOptions,
    private readonly memberships: Pick<TenantAdminStore, 'getMemberships'>
  ) {
    this.options = resolveOptions(options);
  }

  resolve(token: string): Session | undefined {
    const verified = verifyJwt(token, this.options.keyRing, {
      issuer: this.options.issuer,
      audience: this.options.audience,
      now: this.options.now(),
    });
    // A worker token must never authenticate as a user, and vice versa.
    if (!verified.ok || verified.claims.kind !== 'user') {
      return undefined;
    }
    const userId = verified.claims.sub;
    const principal: Principal = {
      userId,
      tenantRoles: { ...this.memberships.getMemberships(userId) },
    };
    return { token, principal, expiresAt: verified.claims.exp * 1000 };
  }
}

/** A verified worker: its id and the single tenant it serves. */
export interface WorkerIdentity {
  /** The raw worker id (without the `worker:` prefix). */
  workerId: string;
  tenantId: string;
  expiresAt: number;
}

/** Verifies signed WORKER tokens. */
export class WorkerTokenVerifier {
  private readonly options: ReturnType<typeof resolveOptions>;

  constructor(options: IdentityOptions) {
    this.options = resolveOptions(options);
  }

  verify(token: unknown): WorkerIdentity | undefined {
    const verified = verifyJwt(token, this.options.keyRing, {
      issuer: this.options.issuer,
      audience: this.options.audience,
      now: this.options.now(),
    });
    if (!verified.ok || verified.claims.kind !== 'worker' || !verified.claims.ten) {
      return undefined;
    }
    if (!verified.claims.sub.startsWith('worker:')) {
      return undefined;
    }
    return {
      workerId: verified.claims.sub.slice('worker:'.length),
      tenantId: verified.claims.ten,
      expiresAt: verified.claims.exp * 1000,
    };
  }
}
