import { z } from 'zod';

/**
 * Multi-tenant data model for the hosted control plane.
 *
 * ENV-LIMITED: this is an in-memory, single-process model. There is NO database.
 * A real deployment would back {@link TenantStore} with a persistent store
 * (Postgres/row-level-security or per-tenant schemas) — see docs/control-plane.md.
 * The TYPES and isolation invariants defined here are the contract a real store
 * must uphold.
 */

/** A safe identifier charset shared by tenant/workspace/command ids. */
const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._-]+$/, 'id must be alphanumeric with . _ -');

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
  })
  .strict();

export type Tenant = z.infer<typeof tenantSchema>;

/**
 * Read-only view of tenant data. The control-plane logic only ever READS; it
 * never mutates the store (immutability discipline). A real implementation
 * would back these methods with scoped DB queries.
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

/**
 * Pure, in-memory {@link TenantStore} built from a frozen snapshot of tenants
 * and workspaces. Suitable for unit tests and for documenting the invariants a
 * real store must enforce. Construction validates every record via zod and
 * rejects workspaces whose `tenantId` does not match a known tenant, so the
 * snapshot cannot encode an orphaned or cross-wired row.
 */
export class InMemoryTenantStore implements TenantStore {
  private readonly tenants: ReadonlyMap<string, Tenant>;
  // workspaces indexed by tenantId -> (workspaceId -> Workspace). Indexing by
  // tenant first makes cross-tenant access structurally impossible: a lookup for
  // tenant A never even considers tenant B's bucket.
  private readonly workspacesByTenant: ReadonlyMap<string, ReadonlyMap<string, Workspace>>;

  constructor(input: { tenants: readonly unknown[]; workspaces: readonly unknown[] }) {
    const tenants = new Map<string, Tenant>();
    for (const raw of input.tenants) {
      const tenant = tenantSchema.parse(raw);
      if (tenants.has(tenant.id)) {
        throw new Error(`Duplicate tenant id: ${tenant.id}`);
      }
      tenants.set(tenant.id, tenant);
    }

    const byTenant = new Map<string, Map<string, Workspace>>();
    for (const raw of input.workspaces) {
      const ws = workspaceSchema.parse(raw);
      if (!tenants.has(ws.tenantId)) {
        throw new Error(`Workspace ${ws.id} references unknown tenant ${ws.tenantId}`);
      }
      let bucket = byTenant.get(ws.tenantId);
      if (!bucket) {
        bucket = new Map<string, Workspace>();
        byTenant.set(ws.tenantId, bucket);
      }
      if (bucket.has(ws.id)) {
        throw new Error(`Duplicate workspace id ${ws.id} in tenant ${ws.tenantId}`);
      }
      bucket.set(ws.id, ws);
    }

    this.tenants = tenants;
    this.workspacesByTenant = byTenant;
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
}
