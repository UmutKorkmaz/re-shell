import { z } from 'zod';

import { Principal, SessionResolver, authenticate } from './auth.js';
import { authorizeCommand, authorizeTenant, authorizeWorkspace } from './authz.js';
import { ControlPlaneResult, fail, ok } from './errors.js';
import { TenantStore, Workspace } from './tenant.js';

/**
 * Control-plane API skeleton.
 *
 * ENV-LIMITED: these are PURE request handlers — `(request) => result`. There is
 * NO HTTP server, NO router, NO middleware and NO process execution here. A real
 * deployment would mount each handler behind an HTTP route, map
 * {@link ControlPlaneResult} error codes to status codes (see
 * errors.HTTP_STATUS_BY_CODE), and forward the resolved command to a real
 * CLI-spawning worker. This module exists to make the auth → authz → validation
 * pipeline end-to-end testable in a single process.
 *
 * Every handler enforces the same pipeline, in order:
 *   1. authenticate(token)            → Principal      (else UNAUTHENTICATED)
 *   2. validate(request body/params)  → typed input    (else INVALID_REQUEST)
 *   3. authorizeTenant(tenantId)      → membership/role (else FORBIDDEN/404)
 *   4. authorizeWorkspace/Command     → isolation gate  (else 404/FORBIDDEN)
 */

/** Dependencies a handler needs; injected so nothing is global or live. */
export interface ControlPlaneDeps {
  store: TenantStore;
  sessions: SessionResolver;
  /** Injected clock for deterministic expiry tests. */
  now?: () => number;
}

// ---------------------------------------------------------------------------
// Request schemas (validated at the boundary; never trust the caller)
// ---------------------------------------------------------------------------

const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._-]+$/, 'id must be alphanumeric with . _ -');

export const listWorkspacesRequestSchema = z
  .object({
    token: z.string(),
    tenantId: idSchema,
  })
  .strict();
export type ListWorkspacesRequest = z.infer<typeof listWorkspacesRequestSchema>;

export const proxyCommandRequestSchema = z
  .object({
    token: z.string(),
    tenantId: idSchema,
    workspaceId: idSchema,
    commandId: idSchema,
    /**
     * Opaque, validated params forwarded to the (out-of-scope) CLI worker. The
     * control plane does NOT build argv — that remains the job of the local
     * hub's command-registry (apps/web/src/hub/command-registry.ts). Here we
     * only gate WHETHER the command is allowed and echo the request.
     */
    params: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export type ProxyCommandRequest = z.infer<typeof proxyCommandRequestSchema>;

// ---------------------------------------------------------------------------
// Response payloads
// ---------------------------------------------------------------------------

export interface ListWorkspacesResponse {
  tenantId: string;
  workspaces: readonly Workspace[];
}

/**
 * The vetted, authorized command proxy decision. NOTE: this is the AUTHORIZATION
 * result, not an execution result — no process is ever spawned by the control
 * plane. A deployment forwards `{ tenantId, workspaceId, commandId, params }` to
 * a worker that owns the local hub/CLI.
 */
export interface ProxyCommandDecision {
  tenantId: string;
  workspaceId: string;
  commandId: string;
  params: Record<string, unknown>;
  /** True — reaching this payload means every gate passed. */
  authorized: true;
}

// ---------------------------------------------------------------------------
// Shared validation helper
// ---------------------------------------------------------------------------

function validate<T>(schema: z.ZodType<T>, body: unknown): ControlPlaneResult<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail('INVALID_REQUEST', 'Request failed validation.', {
      issues: parsed.error.issues,
    });
  }
  return ok(parsed.data);
}

/** Authenticate then validate; returns the principal + typed body or an error. */
function authedRequest<T>(
  deps: ControlPlaneDeps,
  schema: z.ZodType<T & { token: string }>,
  body: unknown
): ControlPlaneResult<{ principal: Principal; input: T & { token: string } }> {
  const validated = validate(schema, body);
  if (!validated.ok) {
    return validated;
  }
  const now = deps.now ? deps.now() : Date.now();
  const auth = authenticate(deps.sessions, validated.data.token, now);
  if (!auth.ok) {
    return auth;
  }
  return ok({ principal: auth.data, input: validated.data });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * GET /tenants/:tenantId/workspaces — list workspaces a principal may see in a
 * tenant. Requires `viewer`. Tenant isolation: only the named tenant's bucket is
 * ever read, and non-members get FORBIDDEN without learning whether the tenant
 * exists.
 */
export function listWorkspaces(
  deps: ControlPlaneDeps,
  body: unknown
): ControlPlaneResult<ListWorkspacesResponse> {
  const req = authedRequest(deps, listWorkspacesRequestSchema, body);
  if (!req.ok) {
    return req;
  }
  const authorized = authorizeTenant(deps.store, req.data.principal, req.data.input.tenantId, 'viewer');
  if (!authorized.ok) {
    return authorized;
  }
  const workspaces = deps.store.listWorkspaces(authorized.data.tenant.id);
  return ok({ tenantId: authorized.data.tenant.id, workspaces });
}

/**
 * POST /tenants/:tenantId/workspaces/:workspaceId/commands — authorize proxying
 * an allow-listed command for a tenant's workspace. Requires `operator`
 * (running commands is a side-effecting action, above read-only viewing).
 *
 * Pipeline: authenticate → validate → authorizeTenant(operator) →
 * authorizeWorkspace (isolation) → authorizeCommand (allow-list). Only when ALL
 * pass is an authorized decision returned. No execution happens here.
 */
export function proxyCommand(
  deps: ControlPlaneDeps,
  body: unknown
): ControlPlaneResult<ProxyCommandDecision> {
  const req = authedRequest(deps, proxyCommandRequestSchema, body);
  if (!req.ok) {
    return req;
  }
  const { principal, input } = req.data;

  const authorizedTenant = authorizeTenant(deps.store, principal, input.tenantId, 'operator');
  if (!authorizedTenant.ok) {
    return authorizedTenant;
  }

  const authorizedWorkspace = authorizeWorkspace(deps.store, authorizedTenant.data, input.workspaceId);
  if (!authorizedWorkspace.ok) {
    return authorizedWorkspace;
  }

  const allowedCommand = authorizeCommand(
    authorizedWorkspace.data.tenant,
    authorizedWorkspace.data.workspace,
    input.commandId
  );
  if (!allowedCommand.ok) {
    return allowedCommand;
  }

  return ok({
    tenantId: authorizedWorkspace.data.tenant.id,
    workspaceId: authorizedWorkspace.data.workspace.id,
    commandId: allowedCommand.data,
    params: input.params,
    authorized: true,
  });
}
