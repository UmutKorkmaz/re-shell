import { z } from 'zod';

import { authorizeCommand, authorizeTenant, authorizeWorkspace } from './authz.js';
import { ControlPlaneResult, fail, ok } from './errors.js';
import {
  ControlPlaneDeps,
  authedRequest,
  authorizeTenantAudited,
  recordDecision,
} from './pipeline.js';
import { Workspace, idSchema } from './tenant.js';

export type { ControlPlaneDeps } from './pipeline.js';

/**
 * Control-plane API handlers.
 *
 * These are PURE request handlers — `(deps, request) => result`. They own no
 * socket and spawn nothing; the HTTP edge (http/server.ts) mounts each behind a
 * route and maps {@link ControlPlaneResult} error codes to status codes via
 * errors.HTTP_STATUS_BY_CODE, and the job service (jobs.ts) turns an authorized
 * {@link ProxyCommandDecision} into a queued job for an execution worker.
 *
 * Every handler enforces the same pipeline, in order:
 *   1. validate(request body/params)  → typed input    (else INVALID_REQUEST)
 *   2. authenticate(token)            → Principal      (else UNAUTHENTICATED)
 *   3. authorizeTenant(tenantId)      → membership/role (else FORBIDDEN/404)
 *   4. authorizeWorkspace/Command     → isolation gate  (else 404/FORBIDDEN)
 * and records the authorization decision in the audit trail (when configured)
 * before returning it.
 */

// ---------------------------------------------------------------------------
// Request schemas (validated at the boundary; never trust the caller)
// ---------------------------------------------------------------------------

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
     * Params forwarded to the execution worker. The control plane does NOT build
     * argv: the worker does, from the shared allow-list registry
     * (@re-shell/contracts/command-registry). Here we only gate WHETHER the
     * command is allowed (and, via `deps.validateCommand`, that the params are
     * well-formed for it).
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
 * result, not an execution result — the handler never spawns a process. The job
 * service forwards `{ tenantId, workspaceId, commandId, params }` to a worker
 * that owns the CLI.
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
  const req = authedRequest(deps, listWorkspacesRequestSchema, body, 'workspaces.list');
  if (!req.ok) {
    return req;
  }
  const authorized = authorizeTenantAudited(
    deps,
    req.data.principal,
    req.data.input.tenantId,
    'viewer',
    { action: 'workspaces.list' }
  );
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
 * Pipeline: validate → authenticate → authorizeTenant(operator) →
 * authorizeWorkspace (isolation) → authorizeCommand (allow-list). Only when ALL
 * pass is an authorized decision returned, and every outcome — allow or deny —
 * is recorded in the audit trail. No execution happens here.
 */
export function proxyCommand(
  deps: ControlPlaneDeps,
  body: unknown
): ControlPlaneResult<ProxyCommandDecision> {
  const req = authedRequest(deps, proxyCommandRequestSchema, body, 'command.authorize');
  if (!req.ok) {
    return req;
  }
  const { principal, input } = req.data;
  const ctx = {
    action: 'command.authorize' as const,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    commandId: input.commandId,
  };

  // Param validation is part of request validation: it depends only on the
  // public command registry, so it reveals nothing about any tenant.
  const paramError = deps.validateCommand?.(input.commandId, input.params) ?? null;
  if (paramError !== null) {
    return fail('INVALID_REQUEST', 'Command parameters failed validation.', {
      commandId: input.commandId,
      reason: paramError,
    });
  }

  // The whole gate chain is ONE decision: it is audited exactly once, as allow
  // (every gate passed) or as deny carrying the code of the gate that refused.
  const chain = ((): ControlPlaneResult<ProxyCommandDecision> => {
    const authorizedTenant = authorizeTenant(deps.store, principal, input.tenantId, 'operator');
    if (!authorizedTenant.ok) {
      return authorizedTenant;
    }
    const authorizedWorkspace = authorizeWorkspace(
      deps.store,
      authorizedTenant.data,
      input.workspaceId
    );
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
  })();

  return recordDecision(deps, principal, ctx, chain);
}
