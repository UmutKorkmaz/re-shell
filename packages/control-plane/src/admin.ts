import { z } from 'zod';

import type { AuditAction, AuditEntry, AuditReader } from './audit.js';
import { Role, roleSchema } from './auth.js';
import { ControlPlaneResult, fail, ok } from './errors.js';
import type { EventPublisher } from './events.js';
import {
  ControlPlaneDeps,
  authedRequest,
  authorizeTenantAudited,
  recordDecision,
} from './pipeline.js';
import { PolicySnapshot, buildPolicySnapshot } from './policy.js';
import {
  Member,
  Tenant,
  TenantAdminStore,
  Workspace,
  idSchema,
  policyPackRefSchema,
  userIdSchema,
} from './tenant.js';

/**
 * Admin and read-model handlers: tenants, workspaces, membership, team policy,
 * and the audit query. Same pipeline as api.ts — validate, authenticate,
 * authorize, AUDIT the decision, then act — and the same envelope.
 *
 * Team policy changes are persisted first and only then published on the event
 * bus, so by the time any SSE client or worker hears about a change the very
 * next authorization already enforces it.
 */

export interface AdminDeps extends ControlPlaneDeps {
  store: TenantAdminStore;
  /** Receives policy/workspace/membership events (SSE + stream revocation). */
  events?: EventPublisher;
  /** User ids allowed to create tenants (the service operators). */
  platformAdmins?: ReadonlySet<string>;
  /** Read side of the audit trail (admin-only query endpoint). */
  auditReader?: AuditReader;
  /**
   * Whether a command id is a real, runnable command. Policy may only name
   * commands that exist; when omitted any well-formed id is accepted.
   */
  isKnownCommand?: (commandId: string) => boolean;
}

const commandIdsSchema = z.array(idSchema).max(256);

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

const tokenSchema = z.string();

export const meRequestSchema = z.object({ token: tokenSchema }).strict();

export const createTenantRequestSchema = z
  .object({
    token: tokenSchema,
    id: idSchema,
    name: z.string().min(1).max(256),
    allowedCommandIds: commandIdsSchema.default([]),
    policyPack: policyPackRefSchema.optional(),
    /** Initial tenant admin. Defaults to the caller. */
    adminUserId: userIdSchema.optional(),
  })
  .strict();

export const createWorkspaceRequestSchema = z
  .object({
    token: tokenSchema,
    tenantId: idSchema,
    id: idSchema,
    name: z.string().min(1).max(256),
    allowedCommandIds: commandIdsSchema.default([]),
  })
  .strict();

export const setWorkspaceGrantRequestSchema = z
  .object({
    token: tokenSchema,
    tenantId: idSchema,
    workspaceId: idSchema,
    allowedCommandIds: commandIdsSchema,
  })
  .strict();

export const getPolicyRequestSchema = z
  .object({ token: tokenSchema, tenantId: idSchema })
  .strict();

export const updatePolicyRequestSchema = z
  .object({
    token: tokenSchema,
    tenantId: idSchema,
    allowedCommandIds: commandIdsSchema.optional(),
    /** A pack reference to set, or null to clear it. */
    policyPack: policyPackRefSchema.nullable().optional(),
  })
  .strict()
  .refine((v) => v.allowedCommandIds !== undefined || v.policyPack !== undefined, {
    message: 'Provide allowedCommandIds and/or policyPack.',
  });

export const listMembersRequestSchema = z
  .object({ token: tokenSchema, tenantId: idSchema })
  .strict();

export const setMemberRequestSchema = z
  .object({ token: tokenSchema, tenantId: idSchema, userId: userIdSchema, role: roleSchema })
  .strict();

export const removeMemberRequestSchema = z
  .object({ token: tokenSchema, tenantId: idSchema, userId: userIdSchema })
  .strict();

const AUDIT_ACTIONS = [
  'auth.failed',
  'me.read',
  'workspaces.list',
  'command.authorize',
  'job.list',
  'job.read',
  'job.stream',
  'job.cancel',
  'job.claim',
  'events.subscribe',
  'tenant.create',
  'workspace.create',
  'workspace.grant.set',
  'policy.read',
  'policy.update',
  'members.list',
  'member.set',
  'member.remove',
  'audit.query',
] as const satisfies readonly AuditAction[];

export const queryAuditRequestSchema = z
  .object({
    token: tokenSchema,
    tenantId: idSchema,
    limit: z.number().int().min(1).max(500).optional(),
    beforeId: z.number().int().positive().optional(),
    userId: z.string().min(1).max(256).optional(),
    workspaceId: idSchema.optional(),
    commandId: idSchema.optional(),
    action: z.enum(AUDIT_ACTIONS).optional(),
    decision: z.enum(['allow', 'deny']).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export interface MeResponse {
  userId: string;
  tenants: Array<{ tenantId: string; role: Role }>;
}

function unknownCommandIds(deps: AdminDeps, ids: readonly string[] | undefined): string[] {
  if (!ids || !deps.isKnownCommand) {
    return [];
  }
  return ids.filter((id) => !deps.isKnownCommand?.(id));
}

function unknownCommandsFailure(unknown: string[]): ControlPlaneResult<never> {
  return fail('INVALID_REQUEST', 'Policy names commands that do not exist.', {
    unknownCommandIds: unknown,
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/** GET /me — who am I, and which tenants do I belong to. */
export function whoAmI(deps: AdminDeps, body: unknown): ControlPlaneResult<MeResponse> {
  const req = authedRequest(deps, meRequestSchema, body, 'me.read');
  if (!req.ok) {
    return req;
  }
  const { principal } = req.data;
  const decided = recordDecision(deps, principal, { action: 'me.read' }, ok(true));
  if (!decided.ok) {
    return decided;
  }
  return ok({
    userId: principal.userId,
    tenants: Object.entries(principal.tenantRoles)
      .map(([tenantId, role]) => ({ tenantId, role }))
      .sort((a, b) => a.tenantId.localeCompare(b.tenantId)),
  });
}

/**
 * POST /tenants — create a tenant. Requires a platform administrator (a user id
 * the deployment lists in CONTROL_PLANE_PLATFORM_ADMINS). The creator — or the
 * named `adminUserId` — becomes the tenant's first admin.
 */
export function createTenant(
  deps: AdminDeps,
  body: unknown
): ControlPlaneResult<{ tenant: Tenant; admin: Member }> {
  const req = authedRequest(deps, createTenantRequestSchema, body, 'tenant.create');
  if (!req.ok) {
    return req;
  }
  const { principal, input } = req.data;
  const allowed: ControlPlaneResult<true> = deps.platformAdmins?.has(principal.userId)
    ? ok(true)
    : fail('FORBIDDEN', 'Creating tenants requires platform administrator privileges.');
  const decided = recordDecision(
    deps,
    principal,
    { action: 'tenant.create', tenantId: input.id },
    allowed
  );
  if (!decided.ok) {
    return decided;
  }
  const unknown = unknownCommandIds(deps, input.allowedCommandIds);
  if (unknown.length > 0) {
    return unknownCommandsFailure(unknown);
  }

  const created = deps.store.createTenant({
    id: input.id,
    name: input.name,
    allowedCommandIds: input.allowedCommandIds,
    ...(input.policyPack ? { policyPack: input.policyPack } : {}),
  });
  if (!created.ok) {
    return fail('ALREADY_EXISTS', 'A tenant with this id already exists.', { tenantId: input.id });
  }
  const adminUserId = input.adminUserId ?? principal.userId;
  const member = deps.store.setMember(input.id, adminUserId, 'admin');
  if (!member.ok) {
    return fail('INTERNAL_ERROR', 'Tenant was created but its first admin could not be added.');
  }
  deps.events?.publish({ type: 'member.changed', tenantId: input.id, userId: adminUserId, role: 'admin' });
  return ok({ tenant: created.value, admin: member.value });
}

/** POST /tenants/:tenantId/workspaces — create a workspace (tenant admin). */
export function createWorkspace(
  deps: AdminDeps,
  body: unknown
): ControlPlaneResult<{ workspace: Workspace }> {
  const req = authedRequest(deps, createWorkspaceRequestSchema, body, 'workspace.create');
  if (!req.ok) {
    return req;
  }
  const { principal, input } = req.data;
  const authorized = authorizeTenantAudited(deps, principal, input.tenantId, 'admin', {
    action: 'workspace.create',
    workspaceId: input.id,
  });
  if (!authorized.ok) {
    return authorized;
  }
  const unknown = unknownCommandIds(deps, input.allowedCommandIds);
  if (unknown.length > 0) {
    return unknownCommandsFailure(unknown);
  }
  const created = deps.store.createWorkspace({
    id: input.id,
    tenantId: authorized.data.tenant.id,
    name: input.name,
    allowedCommandIds: input.allowedCommandIds,
  });
  if (!created.ok) {
    return created.reason === 'ALREADY_EXISTS'
      ? fail('ALREADY_EXISTS', 'A workspace with this id already exists in the tenant.', {
          workspaceId: input.id,
        })
      : fail('TENANT_NOT_FOUND', 'Tenant does not exist.', { tenantId: input.tenantId });
  }
  deps.events?.publish({
    type: 'workspace.created',
    tenantId: input.tenantId,
    workspace: {
      id: created.value.id,
      name: created.value.name,
      allowedCommandIds: [...created.value.allowedCommandIds],
    },
    createdBy: principal.userId,
  });
  return ok({ workspace: created.value });
}

/** PUT /tenants/:tenantId/workspaces/:workspaceId/grant — set a workspace grant (tenant admin). */
export function setWorkspaceGrant(
  deps: AdminDeps,
  body: unknown
): ControlPlaneResult<{ policy: PolicySnapshot }> {
  const req = authedRequest(deps, setWorkspaceGrantRequestSchema, body, 'workspace.grant.set');
  if (!req.ok) {
    return req;
  }
  const { principal, input } = req.data;
  const authorized = authorizeTenantAudited(deps, principal, input.tenantId, 'admin', {
    action: 'workspace.grant.set',
    workspaceId: input.workspaceId,
    detail: { allowedCommandIds: input.allowedCommandIds },
  });
  if (!authorized.ok) {
    return authorized;
  }
  const unknown = unknownCommandIds(deps, input.allowedCommandIds);
  if (unknown.length > 0) {
    return unknownCommandsFailure(unknown);
  }
  const updated = deps.store.setWorkspaceGrant(input.tenantId, input.workspaceId, input.allowedCommandIds);
  if (!updated.ok) {
    return fail('WORKSPACE_NOT_FOUND', 'Workspace not found in this tenant.', {
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
    });
  }
  const policy = buildPolicySnapshot(deps.store, input.tenantId);
  if (!policy) {
    return fail('TENANT_NOT_FOUND', 'Tenant does not exist.', { tenantId: input.tenantId });
  }
  deps.events?.publish({
    type: 'policy.updated',
    tenantId: input.tenantId,
    change: { scope: 'workspace', workspaceId: input.workspaceId },
    policy,
    updatedBy: principal.userId,
  });
  return ok({ policy });
}

/** GET /tenants/:tenantId/policy — the current team policy (any member). */
export function getPolicy(deps: AdminDeps, body: unknown): ControlPlaneResult<{ policy: PolicySnapshot }> {
  const req = authedRequest(deps, getPolicyRequestSchema, body, 'policy.read');
  if (!req.ok) {
    return req;
  }
  const authorized = authorizeTenantAudited(deps, req.data.principal, req.data.input.tenantId, 'viewer', {
    action: 'policy.read',
  });
  if (!authorized.ok) {
    return authorized;
  }
  const policy = buildPolicySnapshot(deps.store, authorized.data.tenant.id);
  if (!policy) {
    return fail('TENANT_NOT_FOUND', 'Tenant does not exist.', { tenantId: req.data.input.tenantId });
  }
  return ok({ policy });
}

/**
 * PUT /tenants/:tenantId/policy — update team policy (tenant admin): the tenant
 * command ceiling and/or the policy-pack reference. Persisted, version-bumped,
 * then published as a `policy.updated` event to every connected client and
 * worker. Enforcement is immediate: the next authorization reads the new ceiling.
 */
export function updatePolicy(
  deps: AdminDeps,
  body: unknown
): ControlPlaneResult<{ policy: PolicySnapshot }> {
  const req = authedRequest(deps, updatePolicyRequestSchema, body, 'policy.update');
  if (!req.ok) {
    return req;
  }
  const { principal, input } = req.data;
  const authorized = authorizeTenantAudited(deps, principal, input.tenantId, 'admin', {
    action: 'policy.update',
    detail: {
      ...(input.allowedCommandIds ? { allowedCommandIds: input.allowedCommandIds } : {}),
      ...(input.policyPack !== undefined ? { policyPack: input.policyPack } : {}),
    },
  });
  if (!authorized.ok) {
    return authorized;
  }
  const unknown = unknownCommandIds(deps, input.allowedCommandIds);
  if (unknown.length > 0) {
    return unknownCommandsFailure(unknown);
  }
  const updated = deps.store.updateTenantPolicy(input.tenantId, {
    allowedCommandIds: input.allowedCommandIds,
    policyPack: input.policyPack,
  });
  if (!updated.ok) {
    return fail('TENANT_NOT_FOUND', 'Tenant does not exist.', { tenantId: input.tenantId });
  }
  const policy = buildPolicySnapshot(deps.store, input.tenantId);
  if (!policy) {
    return fail('TENANT_NOT_FOUND', 'Tenant does not exist.', { tenantId: input.tenantId });
  }
  deps.events?.publish({
    type: 'policy.updated',
    tenantId: input.tenantId,
    change: { scope: 'tenant' },
    policy,
    updatedBy: principal.userId,
  });
  return ok({ policy });
}

/** GET /tenants/:tenantId/members — list members (tenant admin). */
export function listMembers(
  deps: AdminDeps,
  body: unknown
): ControlPlaneResult<{ tenantId: string; members: readonly Member[] }> {
  const req = authedRequest(deps, listMembersRequestSchema, body, 'members.list');
  if (!req.ok) {
    return req;
  }
  const authorized = authorizeTenantAudited(deps, req.data.principal, req.data.input.tenantId, 'admin', {
    action: 'members.list',
  });
  if (!authorized.ok) {
    return authorized;
  }
  return ok({
    tenantId: authorized.data.tenant.id,
    members: deps.store.listMembers(authorized.data.tenant.id),
  });
}

/** PUT /tenants/:tenantId/members/:userId — add a member or change their role (tenant admin). */
export function setMember(deps: AdminDeps, body: unknown): ControlPlaneResult<{ member: Member }> {
  const req = authedRequest(deps, setMemberRequestSchema, body, 'member.set');
  if (!req.ok) {
    return req;
  }
  const { principal, input } = req.data;
  const authorized = authorizeTenantAudited(deps, principal, input.tenantId, 'admin', {
    action: 'member.set',
    detail: { member: input.userId, role: input.role },
  });
  if (!authorized.ok) {
    return authorized;
  }
  const result = deps.store.setMember(input.tenantId, input.userId, input.role);
  if (!result.ok) {
    return result.reason === 'LAST_ADMIN'
      ? fail('CONFLICT', 'A tenant must keep at least one admin.', { tenantId: input.tenantId })
      : fail('TENANT_NOT_FOUND', 'Tenant does not exist.', { tenantId: input.tenantId });
  }
  deps.events?.publish({
    type: 'member.changed',
    tenantId: input.tenantId,
    userId: input.userId,
    role: input.role,
  });
  return ok({ member: result.value });
}

/** DELETE /tenants/:tenantId/members/:userId — remove a member (tenant admin). */
export function removeMember(deps: AdminDeps, body: unknown): ControlPlaneResult<{ removed: Member }> {
  const req = authedRequest(deps, removeMemberRequestSchema, body, 'member.remove');
  if (!req.ok) {
    return req;
  }
  const { principal, input } = req.data;
  const authorized = authorizeTenantAudited(deps, principal, input.tenantId, 'admin', {
    action: 'member.remove',
    detail: { member: input.userId },
  });
  if (!authorized.ok) {
    return authorized;
  }
  const result = deps.store.removeMember(input.tenantId, input.userId);
  if (!result.ok) {
    return result.reason === 'LAST_ADMIN'
      ? fail('CONFLICT', 'A tenant must keep at least one admin.', { tenantId: input.tenantId })
      : fail('NOT_FOUND', 'Member not found in this tenant.', { userId: input.userId });
  }
  deps.events?.publish({
    type: 'member.changed',
    tenantId: input.tenantId,
    userId: input.userId,
    role: null,
  });
  return ok({ removed: result.value });
}

/**
 * GET /tenants/:tenantId/audit — query the audit trail (tenant admin only). Read
 * only: no handler anywhere updates or deletes audit rows.
 */
export function queryAudit(
  deps: AdminDeps,
  body: unknown
): ControlPlaneResult<{ entries: AuditEntry[]; nextBeforeId: number | null }> {
  const req = authedRequest(deps, queryAuditRequestSchema, body, 'audit.query');
  if (!req.ok) {
    return req;
  }
  const { principal, input } = req.data;
  const { token: _token, ...filters } = input;
  void _token;
  const authorized = authorizeTenantAudited(deps, principal, input.tenantId, 'admin', {
    action: 'audit.query',
    detail: { filters: { ...filters, tenantId: undefined } },
  });
  if (!authorized.ok) {
    return authorized;
  }
  if (!deps.auditReader) {
    return fail('SERVICE_UNAVAILABLE', 'Audit trail is not configured.');
  }
  const entries = deps.auditReader.query({ ...filters, tenantId: authorized.data.tenant.id });
  const limit = input.limit ?? 100;
  return ok({
    entries,
    nextBeforeId: entries.length >= limit ? entries[entries.length - 1].id : null,
  });
}
