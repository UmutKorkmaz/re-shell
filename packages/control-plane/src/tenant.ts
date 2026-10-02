import { z } from 'zod';

import { Role, roleSchema } from './auth.js';

/**
 * Multi-tenant data model for the hosted control plane.
 *
 * Two layers live here:
 *
 *  - The MODEL (zod schemas) and the {@link TenantStore} READ contract that the
 *    pure authorization logic consumes. The contract carries the isolation
 *    invariants every store MUST uphold (docs/control-plane.md §3).
 *  - The {@link TenantAdminStore} WRITE contract used by the admin API, with an
 *    {@link InMemoryTenantStore} (tests / single-process) and a
 *    `SqliteTenantStore` (db/sqlite-store.ts, the persistent implementation).
 *    Both are exercised by one parameterised isolation suite.
 */

/**
 * A safe identifier charset shared by tenant/workspace/command ids. Dot-only ids
 * (`.`, `..`, `...`) are rejected so an id can never act as a path segment that
 * escapes a directory when a worker maps a workspace id onto the filesystem.
 */
export const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._-]+$/, 'id must be alphanumeric with . _ -')
  .refine((id) => !/^\.+$/.test(id), 'id must not consist only of dots');

/**
 * User ids come from the identity provider (token `sub`); they are opaque but
 * must be printable, bounded, and free of control characters.
 */
export const userIdSchema = z
  .string()
  .min(1)
  .max(256)
  // eslint-disable-next-line no-control-regex
  .regex(/^[^\u0000-\u001f\u007f]+$/, 'user id must not contain control characters');

/**
 * Opaque reference to a policy pack (a built-in pack name such as
 * `recommended`, or a registry/path style reference). The control plane stores
 * and propagates it; it does not resolve or evaluate it.
 */
export const policyPackRefSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9@][A-Za-z0-9._@/:+-]*$/, 'policy pack reference has an unsupported format');

/**
 * A workspace belonging to exactly one tenant. `tenantId` is the isolation key:
 * every lookup is scoped by it, so a workspace can never be addressed without
 * naming its owning tenant.
 */
export const workspaceSchema = z
  .object({
    id: idSchema,
    tenantId: idSchema,
    name: z.string().min(1).max(256),
    /**
     * Command ids this workspace permits through the proxy. A subset of the
     * tenant allow-list; the effective allow-list is the intersection (see
     * authz.ts). Defaults to empty (deny-all) — explicit grants only.
     */
    allowedCommandIds: z.array(idSchema).default([]),
  })
  .strict();

export type Workspace = z.infer<typeof workspaceSchema>;

/**
 * A tenant: an isolation boundary owning a set of workspaces and members.
 */
export const tenantSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).max(256),
    /**
     * Command ids permitted anywhere in this tenant. The per-workspace
     * allow-list is further intersected with this set, so a tenant can never be
     * escalated past its own ceiling by a permissive workspace entry.
     */
    allowedCommandIds: z.array(idSchema).default([]),
    /** Optional reference to the team's policy pack (propagated, not evaluated). */
    policyPack: policyPackRefSchema.optional(),
    /**
     * Monotonic counter bumped by every policy change in this tenant (ceiling,
     * pack reference, or any workspace grant). Clients and workers compare it to
     * detect a stale view.
     */
    policyVersion: z.number().int().nonnegative().default(0),
  })
  .strict();

export type Tenant = z.infer<typeof tenantSchema>;

/** A user's membership in a tenant. */
export interface Member {
  tenantId: string;
  userId: string;
  role: Role;
}

export const memberSchema = z
  .object({ tenantId: idSchema, userId: userIdSchema, role: roleSchema })
  .strict();

/**
 * Read-only view of tenant data consumed by the authorization logic. A real
 * implementation backs these methods with scoped DB queries.
 */
export interface TenantStore {
  getTenant(tenantId: string): Tenant | undefined;
  /** All workspaces owned by `tenantId`. MUST NOT leak other tenants' rows. */
  listWorkspaces(tenantId: string): readonly Workspace[];
  /**
   * A single workspace, scoped by tenant. Returns undefined when the workspace
   * does not exist OR exists under a DIFFERENT tenant — the two cases are
   * indistinguishable to the caller, which is the core isolation guarantee.
   */
  getWorkspace(tenantId: string, workspaceId: string): Workspace | undefined;
}

/** Why a store write was refused. */
export type StoreWriteFailure = 'ALREADY_EXISTS' | 'NOT_FOUND' | 'LAST_ADMIN';

export type StoreWriteResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: StoreWriteFailure };

/** Policy fields an admin may change on a tenant. */
export interface TenantPolicyPatch {
  allowedCommandIds?: readonly string[];
  /** A reference to set, or `null` to clear it. */
  policyPack?: string | null;
}

/**
 * The persistent, mutable store the HTTP API drives. Every method is scoped by
 * `tenantId` first; the membership table is the ONLY source of tenant
 * membership (a signed token proves identity, never membership).
 *
 * Malformed input throws (zod); callers validate at the boundary first, so a
 * throw here is a programming error rather than a client error.
 */
export interface TenantAdminStore extends TenantStore {
  createTenant(input: unknown): StoreWriteResult<Tenant>;
  createWorkspace(input: unknown): StoreWriteResult<Workspace>;
  /** Apply a policy patch and bump `policyVersion`. */
  updateTenantPolicy(tenantId: string, patch: TenantPolicyPatch): StoreWriteResult<Tenant>;
  /** Replace a workspace grant and bump the tenant's `policyVersion`. */
  setWorkspaceGrant(
    tenantId: string,
    workspaceId: string,
    allowedCommandIds: readonly string[]
  ): StoreWriteResult<{ tenant: Tenant; workspace: Workspace }>;

  /** tenantId -> role for every tenant `userId` belongs to. */
  getMemberships(userId: string): Readonly<Record<string, Role>>;
  listMembers(tenantId: string): readonly Member[];
  /** Create or change a membership. Refuses to demote a tenant's last admin. */
  setMember(tenantId: string, userId: string, role: Role): StoreWriteResult<Member>;
  /** Remove a membership. Refuses to remove a tenant's last admin. */
  removeMember(tenantId: string, userId: string): StoreWriteResult<Member>;
}

/** De-duplicate while preserving first-seen order. Shared by every store. */
export function normalizeCommandIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids));
}

/**
 * Pure, in-memory {@link TenantAdminStore}. Suitable for unit tests and
 * single-process use. Construction validates every record via zod and rejects
 * workspaces whose `tenantId` does not match a known tenant, so a snapshot
 * cannot encode an orphaned or cross-wired row.
 */
export class InMemoryTenantStore implements TenantAdminStore {
  private readonly tenants = new Map<string, Tenant>();
  // workspaces indexed by tenantId -> (workspaceId -> Workspace). Indexing by
  // tenant first makes cross-tenant access structurally impossible: a lookup for
  // tenant A never even considers tenant B's bucket.
  private readonly workspacesByTenant = new Map<string, Map<string, Workspace>>();
  // memberships indexed by tenantId -> (userId -> role).
  private readonly membersByTenant = new Map<string, Map<string, Role>>();

  constructor(
    input: {
      tenants?: readonly unknown[];
      workspaces?: readonly unknown[];
      members?: readonly unknown[];
    } = {}
  ) {
    for (const raw of input.tenants ?? []) {
      const tenant = tenantSchema.parse(raw);
      if (this.tenants.has(tenant.id)) {
        throw new Error(`Duplicate tenant id: ${tenant.id}`);
      }
      this.tenants.set(tenant.id, tenant);
    }

    for (const raw of input.workspaces ?? []) {
      const ws = workspaceSchema.parse(raw);
      if (!this.tenants.has(ws.tenantId)) {
        throw new Error(`Workspace ${ws.id} references unknown tenant ${ws.tenantId}`);
      }
      let bucket = this.workspacesByTenant.get(ws.tenantId);
      if (!bucket) {
        bucket = new Map<string, Workspace>();
        this.workspacesByTenant.set(ws.tenantId, bucket);
      }
      if (bucket.has(ws.id)) {
        throw new Error(`Duplicate workspace id ${ws.id} in tenant ${ws.tenantId}`);
      }
      bucket.set(ws.id, ws);
    }

    for (const raw of input.members ?? []) {
      const m = memberSchema.parse(raw);
      if (!this.tenants.has(m.tenantId)) {
        throw new Error(`Member ${m.userId} references unknown tenant ${m.tenantId}`);
      }
      this.bucketFor(m.tenantId).set(m.userId, m.role);
    }
  }

  private bucketFor(tenantId: string): Map<string, Role> {
    let bucket = this.membersByTenant.get(tenantId);
    if (!bucket) {
      bucket = new Map<string, Role>();
      this.membersByTenant.set(tenantId, bucket);
    }
    return bucket;
  }

  getTenant(tenantId: string): Tenant | undefined {
    return this.tenants.get(tenantId);
  }

  listWorkspaces(tenantId: string): readonly Workspace[] {
    const bucket = this.workspacesByTenant.get(tenantId);
    if (!bucket) {
      return [];
    }
    return Array.from(bucket.values());
  }

  getWorkspace(tenantId: string, workspaceId: string): Workspace | undefined {
    // Scoped by tenant bucket first: a workspace living under another tenant is
    // unreachable here, so this returns undefined for both "absent" and
    // "belongs to a different tenant" — the caller cannot tell them apart.
    return this.workspacesByTenant.get(tenantId)?.get(workspaceId);
  }

  createTenant(input: unknown): StoreWriteResult<Tenant> {
    const tenant = tenantSchema.parse(input);
    if (this.tenants.has(tenant.id)) {
      return { ok: false, reason: 'ALREADY_EXISTS' };
    }
    const stored: Tenant = {
      ...tenant,
      allowedCommandIds: normalizeCommandIds(tenant.allowedCommandIds),
    };
    this.tenants.set(stored.id, stored);
    return { ok: true, value: stored };
  }

  createWorkspace(input: unknown): StoreWriteResult<Workspace> {
    const ws = workspaceSchema.parse(input);
    if (!this.tenants.has(ws.tenantId)) {
      return { ok: false, reason: 'NOT_FOUND' };
    }
    let bucket = this.workspacesByTenant.get(ws.tenantId);
    if (!bucket) {
      bucket = new Map<string, Workspace>();
      this.workspacesByTenant.set(ws.tenantId, bucket);
    }
    if (bucket.has(ws.id)) {
      return { ok: false, reason: 'ALREADY_EXISTS' };
    }
    const stored: Workspace = { ...ws, allowedCommandIds: normalizeCommandIds(ws.allowedCommandIds) };
    bucket.set(stored.id, stored);
    return { ok: true, value: stored };
  }

  updateTenantPolicy(tenantId: string, patch: TenantPolicyPatch): StoreWriteResult<Tenant> {
    const current = this.tenants.get(tenantId);
    if (!current) {
      return { ok: false, reason: 'NOT_FOUND' };
    }
    const next: Tenant = {
      ...current,
      allowedCommandIds:
        patch.allowedCommandIds === undefined
          ? current.allowedCommandIds
          : normalizeCommandIds(z.array(idSchema).parse(patch.allowedCommandIds)),
      policyVersion: current.policyVersion + 1,
    };
    if (patch.policyPack !== undefined) {
      if (patch.policyPack === null) {
        delete next.policyPack;
      } else {
        next.policyPack = policyPackRefSchema.parse(patch.policyPack);
      }
    }
    this.tenants.set(tenantId, next);
    return { ok: true, value: next };
  }

  setWorkspaceGrant(
    tenantId: string,
    workspaceId: string,
    allowedCommandIds: readonly string[]
  ): StoreWriteResult<{ tenant: Tenant; workspace: Workspace }> {
    const tenant = this.tenants.get(tenantId);
    const workspace = this.workspacesByTenant.get(tenantId)?.get(workspaceId);
    if (!tenant || !workspace) {
      return { ok: false, reason: 'NOT_FOUND' };
    }
    const nextWorkspace: Workspace = {
      ...workspace,
      allowedCommandIds: normalizeCommandIds(z.array(idSchema).parse(allowedCommandIds)),
    };
    const nextTenant: Tenant = { ...tenant, policyVersion: tenant.policyVersion + 1 };
    this.workspacesByTenant.get(tenantId)?.set(workspaceId, nextWorkspace);
    this.tenants.set(tenantId, nextTenant);
    return { ok: true, value: { tenant: nextTenant, workspace: nextWorkspace } };
  }

  getMemberships(userId: string): Readonly<Record<string, Role>> {
    const out: Record<string, Role> = {};
    for (const [tenantId, bucket] of this.membersByTenant) {
      const role = bucket.get(userId);
      if (role) {
        out[tenantId] = role;
      }
    }
    return out;
  }

  listMembers(tenantId: string): readonly Member[] {
    const bucket = this.membersByTenant.get(tenantId);
    if (!bucket) {
      return [];
    }
    return Array.from(bucket, ([userId, role]) => ({ tenantId, userId, role })).sort((a, b) =>
      a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0
    );
  }

  setMember(tenantId: string, userId: string, role: Role): StoreWriteResult<Member> {
    const member = memberSchema.parse({ tenantId, userId, role });
    if (!this.tenants.has(tenantId)) {
      return { ok: false, reason: 'NOT_FOUND' };
    }
    const bucket = this.bucketFor(tenantId);
    const existing = bucket.get(userId);
    if (existing === 'admin' && role !== 'admin' && this.adminCount(tenantId) <= 1) {
      return { ok: false, reason: 'LAST_ADMIN' };
    }
    bucket.set(userId, member.role);
    return { ok: true, value: member };
  }

  removeMember(tenantId: string, userId: string): StoreWriteResult<Member> {
    const bucket = this.membersByTenant.get(tenantId);
    const role = bucket?.get(userId);
    if (!bucket || !role) {
      return { ok: false, reason: 'NOT_FOUND' };
    }
    if (role === 'admin' && this.adminCount(tenantId) <= 1) {
      return { ok: false, reason: 'LAST_ADMIN' };
    }
    bucket.delete(userId);
    return { ok: true, value: { tenantId, userId, role } };
  }

  private adminCount(tenantId: string): number {
    let n = 0;
    for (const role of this.membersByTenant.get(tenantId)?.values() ?? []) {
      if (role === 'admin') {
        n += 1;
      }
    }
    return n;
  }
}
