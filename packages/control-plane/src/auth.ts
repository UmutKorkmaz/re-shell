import { z } from 'zod';

import { ControlPlaneResult, fail, ok } from './errors.js';

/**
 * Token/session auth layer for the hosted control plane.
 *
 * ENV-LIMITED: tokens are opaque strings resolved against an in-memory session
 * map. There is NO crypto/JWT/OAuth and NO session store here. A real deployment
 * would verify a signed bearer token (JWT/OIDC) or a server-side session — see
 * docs/control-plane.md. What this module pins down is the SHAPE of an
 * authenticated principal and the authz primitives that consume it, so the
 * security logic is testable without a live identity provider.
 */

/** Roles a member may hold within a tenant. `admin` ⊃ `operator` ⊃ `viewer`. */
export const roleSchema = z.enum(['viewer', 'operator', 'admin']);
export type Role = z.infer<typeof roleSchema>;

/** Numeric rank so role comparisons are total and explicit. */
const ROLE_RANK: Readonly<Record<Role, number>> = {
  viewer: 0,
  operator: 1,
  admin: 2,
};

/**
 * An authenticated principal: WHO is calling and WHICH tenants they belong to,
 * with a role per tenant. A principal is never implicitly a member of a tenant
 * it is not listed in — the absence of an entry is a hard deny.
 */
export const principalSchema = z
  .object({
    userId: z.string().min(1).max(256),
    /** tenantId -> role. The ONLY source of truth for tenant membership. */
    tenantRoles: z.record(z.string().min(1), roleSchema),
  })
  .strict();

export type Principal = z.infer<typeof principalSchema>;

/**
 * A session record the auth layer resolves a token to. In a real system this is
 * the verified token claims / server session row.
 */
export interface Session {
  token: string;
  principal: Principal;
  /** Unix ms expiry. A session at/after this instant is rejected. */
  expiresAt: number;
}

/**
 * Resolves an opaque token to a {@link Session}. A real implementation verifies
 * a signed token or looks up a session store; the in-memory one below is for
 * tests and to document the contract.
 */
export interface SessionResolver {
  resolve(token: string): Session | undefined;
}

/**
 * Pure in-memory {@link SessionResolver}. Construction validates each principal
 * via zod so a malformed session can never enter the map.
 */
export class InMemorySessionResolver implements SessionResolver {
  private readonly sessions: ReadonlyMap<string, Session>;

  constructor(sessions: readonly Session[]) {
    const map = new Map<string, Session>();
    for (const s of sessions) {
      principalSchema.parse(s.principal);
      map.set(s.token, s);
    }
    this.sessions = map;
  }

  resolve(token: string): Session | undefined {
    return this.sessions.get(token);
  }
}

/**
 * Authenticate a raw bearer token to a {@link Principal}.
 *
 * Rejects (UNAUTHENTICATED) when: token is missing/blank, unknown to the
 * resolver, or expired. Never throws and never leaks WHY beyond "unauthenticated"
 * to avoid token-probing oracles. `now` is injected for deterministic tests.
 */
export function authenticate(
  resolver: SessionResolver,
  token: unknown,
  now: number = Date.now()
): ControlPlaneResult<Principal> {
  if (typeof token !== 'string' || token.trim().length === 0) {
    return fail('UNAUTHENTICATED', 'Missing or empty bearer token.');
  }
  const session = resolver.resolve(token);
  if (!session) {
    return fail('UNAUTHENTICATED', 'Invalid bearer token.');
  }
  if (now >= session.expiresAt) {
    return fail('UNAUTHENTICATED', 'Session expired.');
  }
  return ok(session.principal);
}

/** The role a principal holds in a tenant, or undefined if not a member. */
export function roleInTenant(principal: Principal, tenantId: string): Role | undefined {
  return principal.tenantRoles[tenantId];
}

/** True when `role` meets or exceeds `required` in the role hierarchy. */
export function roleSatisfies(role: Role, required: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}
