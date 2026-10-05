import { z } from 'zod';

import type { AuditAction, AuditSink } from './audit.js';
import { Principal, SessionResolver, authenticate } from './auth.js';
import { AuthorizedTenant, authorizeTenant } from './authz.js';
import { ControlPlaneResult, fail, ok } from './errors.js';
import type { Role } from './auth.js';
import type { TenantStore } from './tenant.js';

/**
 * Shared request pipeline used by every handler:
 *
 *   1. validate(request)              → typed input    (else INVALID_REQUEST)
 *   2. authenticate(token)            → Principal      (else UNAUTHENTICATED)
 *   3. authorize (membership / role / isolation / allow-list)
 *   4. RECORD the decision in the audit trail
 *   5. only then act
 *
 * Step 4 happens BEFORE any side effect and FAILS CLOSED for an `allow`: if the
 * audit trail cannot record the decision, the request is refused rather than
 * performed unaudited.
 */

/** Dependencies a handler needs; injected so nothing is global or live. */
export interface ControlPlaneDeps {
  store: TenantStore;
  sessions: SessionResolver;
  /** Injected clock for deterministic expiry tests. */
  now?: () => number;
  /** Append-only audit sink. When present every authorization decision is recorded. */
  audit?: AuditSink;
  /**
   * Optional per-command parameter check (the HTTP server wires it to the shared
   * command registry in @re-shell/contracts). Returns an error message when the
   * `{ commandId, params }` pair is not a runnable, well-formed invocation, or
   * null when it is. It validates only — argv is built by the worker.
   */
  validateCommand?: (commandId: string, params: Record<string, unknown>) => string | null;
}

export function nowOf(deps: { now?: () => number }): number {
  return deps.now ? deps.now() : Date.now();
}

/** What an audit entry should say about the request being decided. */
export interface AuditContext {
  action: AuditAction;
  tenantId?: string | null;
  workspaceId?: string | null;
  commandId?: string | null;
  detail?: Record<string, unknown> | null;
}

export function validate<T>(schema: z.ZodType<T>, body: unknown): ControlPlaneResult<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail('INVALID_REQUEST', 'Request failed validation.', {
      issues: parsed.error.issues,
    });
  }
  return ok(parsed.data);
}

/**
 * Record an authorization decision. A failed (`deny`) result is always returned
 * as-is, even if the audit write fails (denying is the safe direction). An `ok`
 * result is converted to INTERNAL_ERROR when the audit write fails.
 */
export function recordDecision<T>(
  deps: ControlPlaneDeps,
  principal: Principal | null,
  ctx: AuditContext,
  result: ControlPlaneResult<T>
): ControlPlaneResult<T> {
  if (!deps.audit) {
    return result;
  }
  try {
    deps.audit.record({
      ts: nowOf(deps),
      userId: principal?.userId ?? null,
      tenantId: ctx.tenantId ?? null,
      workspaceId: ctx.workspaceId ?? null,
      commandId: ctx.commandId ?? null,
      action: ctx.action,
      decision: result.ok ? 'allow' : 'deny',
      code: result.ok ? null : result.error.code,
      detail: ctx.detail ?? null,
    });
  } catch {
    if (result.ok) {
      return fail('INTERNAL_ERROR', 'Audit trail unavailable; refusing to authorize.');
    }
  }
  return result;
}

/**
 * Validate the body, then authenticate its `token`. An authentication failure is
 * audited (with no user) so credential probing leaves a trail.
 */
export function authedRequest<T extends { token: string; tenantId?: string }>(
  deps: ControlPlaneDeps,
  schema: z.ZodType<T>,
  body: unknown,
  action: AuditAction
): ControlPlaneResult<{ principal: Principal; input: T }> {
  const validated = validate(schema, body);
  if (!validated.ok) {
    return validated;
  }
  const auth = authenticate(deps.sessions, validated.data.token, nowOf(deps));
  if (!auth.ok) {
    return recordDecision(
      deps,
      null,
      { action: 'auth.failed', tenantId: validated.data.tenantId ?? null, detail: { attempted: action } },
      auth
    );
  }
  return ok({ principal: auth.data, input: validated.data });
}

/**
 * Tenant-level authorization with auditing: membership + minimum role, recorded
 * as one decision. Non-members of real AND absent tenants both get FORBIDDEN.
 */
export function authorizeTenantAudited(
  deps: ControlPlaneDeps,
  principal: Principal,
  tenantId: string,
  minRole: Role,
  ctx: AuditContext
): ControlPlaneResult<AuthorizedTenant> {
  const authorized = authorizeTenant(deps.store, principal, tenantId, minRole);
  return recordDecision(deps, principal, { ...ctx, tenantId }, authorized);
}
