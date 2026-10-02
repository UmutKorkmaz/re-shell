import { z } from 'zod';

import { Role, roleSchema } from '../auth.js';
import {
  Member,
  StoreWriteResult,
  Tenant,
  TenantAdminStore,
  TenantPolicyPatch,
  Workspace,
  idSchema,
  memberSchema,
  normalizeCommandIds,
  policyPackRefSchema,
  tenantSchema,
  workspaceSchema,
} from '../tenant.js';
import { DatabaseSync, Row, StatementSync, transaction } from './sqlite.js';

/**
 * SQLite-backed {@link TenantAdminStore}.
 *
 * Isolation (docs/control-plane.md §3) is upheld in three layers:
 *
 *  1. TENANT-FIRST QUERIES. Every statement that touches tenant-owned data binds
 *     `tenant_id` as its first predicate (`WHERE tenant_id = ? AND id = ?`). There
 *     is no query that looks a workspace up by its id alone, so a workspace under
 *     tenant B is unreachable when asking as tenant A — it is indistinguishable
 *     from a workspace that does not exist.
 *  2. SCHEMA. Workspaces and memberships are keyed `(tenant_id, id)` and carry a
 *     foreign key to `tenants`, so an orphaned or cross-wired row cannot be
 *     stored.
 *  3. AUTHZ ORDERING (authz.ts) — non-members of real AND absent tenants both get
 *     FORBIDDEN before the store is consulted for tenant data.
 *
 * SQLite has no row-level security; the equivalent guarantee here is (1)+(2).
 */

const commandIdListSchema = z.array(idSchema);

function parseCommandIds(raw: unknown, what: string): string[] {
  if (typeof raw !== 'string') {
    throw new Error(`Corrupt ${what}: expected JSON text`);
  }
  return commandIdListSchema.parse(JSON.parse(raw));
}

function tenantFromRow(row: Row): Tenant {
  const tenant: Record<string, unknown> = {
    id: row.id,
    name: row.name,
    allowedCommandIds: parseCommandIds(row.allowed_command_ids, 'tenant allow-list'),
    policyVersion: row.policy_version,
  };
  if (row.policy_pack !== null && row.policy_pack !== undefined) {
    tenant.policyPack = row.policy_pack;
  }
  return tenantSchema.parse(tenant);
}

function workspaceFromRow(row: Row): Workspace {
  return workspaceSchema.parse({
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    allowedCommandIds: parseCommandIds(row.allowed_command_ids, 'workspace allow-list'),
  });
}

export class SqliteTenantStore implements TenantAdminStore {
  private readonly stmts: {
    getTenant: StatementSync;
    insertTenant: StatementSync;
    updateTenantPolicy: StatementSync;
    bumpPolicyVersion: StatementSync;
    listWorkspaces: StatementSync;
    getWorkspace: StatementSync;
    insertWorkspace: StatementSync;
    updateWorkspaceGrant: StatementSync;
    membershipsForUser: StatementSync;
    listMembers: StatementSync;
    getMemberRole: StatementSync;
    upsertMember: StatementSync;
    deleteMember: StatementSync;
    countAdmins: StatementSync;
  };

  constructor(
    private readonly db: DatabaseSync,
    private readonly clock: () => number = Date.now
  ) {
    this.stmts = {
      getTenant: db.prepare(
        'SELECT id, name, allowed_command_ids, policy_pack, policy_version FROM tenants WHERE id = ?'
      ),
      insertTenant: db.prepare(
        `INSERT INTO tenants (id, name, allowed_command_ids, policy_pack, policy_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`
      ),
      updateTenantPolicy: db.prepare(
        `UPDATE tenants
            SET allowed_command_ids = ?, policy_pack = ?, policy_version = policy_version + 1, updated_at = ?
          WHERE id = ?`
      ),
      bumpPolicyVersion: db.prepare(
        'UPDATE tenants SET policy_version = policy_version + 1, updated_at = ? WHERE id = ?'
      ),
      listWorkspaces: db.prepare(
        `SELECT tenant_id, id, name, allowed_command_ids FROM workspaces
          WHERE tenant_id = ? ORDER BY rowid`
      ),
      getWorkspace: db.prepare(
        'SELECT tenant_id, id, name, allowed_command_ids FROM workspaces WHERE tenant_id = ? AND id = ?'
      ),
      insertWorkspace: db.prepare(
        `INSERT INTO workspaces (tenant_id, id, name, allowed_command_ids, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (tenant_id, id) DO NOTHING`
      ),
      updateWorkspaceGrant: db.prepare(
        'UPDATE workspaces SET allowed_command_ids = ?, updated_at = ? WHERE tenant_id = ? AND id = ?'
      ),
      membershipsForUser: db.prepare('SELECT tenant_id, role FROM memberships WHERE user_id = ?'),
      listMembers: db.prepare(
        'SELECT tenant_id, user_id, role FROM memberships WHERE tenant_id = ? ORDER BY user_id'
      ),
      getMemberRole: db.prepare('SELECT role FROM memberships WHERE tenant_id = ? AND user_id = ?'),
      upsertMember: db.prepare(
        `INSERT INTO memberships (tenant_id, user_id, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = excluded.role, updated_at = excluded.updated_at`
      ),
      deleteMember: db.prepare('DELETE FROM memberships WHERE tenant_id = ? AND user_id = ?'),
      countAdmins: db.prepare(
        "SELECT COUNT(*) AS n FROM memberships WHERE tenant_id = ? AND role = 'admin'"
      ),
    };
  }

  // ---- reads (tenant-first) ------------------------------------------------

  getTenant(tenantId: string): Tenant | undefined {
    const row = this.stmts.getTenant.get(tenantId) as Row | undefined;
    return row ? tenantFromRow(row) : undefined;
  }

  listWorkspaces(tenantId: string): readonly Workspace[] {
    return (this.stmts.listWorkspaces.all(tenantId) as Row[]).map(workspaceFromRow);
  }

  getWorkspace(tenantId: string, workspaceId: string): Workspace | undefined {
    const row = this.stmts.getWorkspace.get(tenantId, workspaceId) as Row | undefined;
    return row ? workspaceFromRow(row) : undefined;
  }

  getMemberships(userId: string): Readonly<Record<string, Role>> {
    const out: Record<string, Role> = {};
    for (const row of this.stmts.membershipsForUser.all(userId) as Row[]) {
      out[String(row.tenant_id)] = roleSchema.parse(row.role);
    }
    return out;
  }

  listMembers(tenantId: string): readonly Member[] {
    return (this.stmts.listMembers.all(tenantId) as Row[]).map((row) =>
      memberSchema.parse({ tenantId: row.tenant_id, userId: row.user_id, role: row.role })
    );
  }

  // ---- writes --------------------------------------------------------------

  createTenant(input: unknown): StoreWriteResult<Tenant> {
    const tenant = tenantSchema.parse(input);
    const stored: Tenant = {
      ...tenant,
      allowedCommandIds: normalizeCommandIds(tenant.allowedCommandIds),
    };
    const now = this.clock();
    const result = this.stmts.insertTenant.run(
      stored.id,
      stored.name,
      JSON.stringify(stored.allowedCommandIds),
      stored.policyPack ?? null,
      stored.policyVersion,
      now,
      now
    );
    if (result.changes === 0) {
      return { ok: false, reason: 'ALREADY_EXISTS' };
    }
    return { ok: true, value: stored };
  }

  createWorkspace(input: unknown): StoreWriteResult<Workspace> {
    const ws = workspaceSchema.parse(input);
    const stored: Workspace = {
      ...ws,
      allowedCommandIds: normalizeCommandIds(ws.allowedCommandIds),
    };
    return transaction(this.db, () => {
      if (!this.getTenant(stored.tenantId)) {
        return { ok: false, reason: 'NOT_FOUND' } as const;
      }
      const now = this.clock();
      const result = this.stmts.insertWorkspace.run(
        stored.tenantId,
        stored.id,
        stored.name,
        JSON.stringify(stored.allowedCommandIds),
        now,
        now
      );
      if (result.changes === 0) {
        return { ok: false, reason: 'ALREADY_EXISTS' } as const;
      }
      return { ok: true, value: stored } as const;
    });
  }

  updateTenantPolicy(tenantId: string, patch: TenantPolicyPatch): StoreWriteResult<Tenant> {
    const allowed =
      patch.allowedCommandIds === undefined
        ? undefined
        : normalizeCommandIds(commandIdListSchema.parse(patch.allowedCommandIds));
    const pack =
      patch.policyPack === undefined || patch.policyPack === null
        ? patch.policyPack
        : policyPackRefSchema.parse(patch.policyPack);

    return transaction(this.db, () => {
      const current = this.getTenant(tenantId);
      if (!current) {
        return { ok: false, reason: 'NOT_FOUND' } as const;
      }
      const nextAllowed = allowed ?? current.allowedCommandIds;
      const nextPack = pack === undefined ? (current.policyPack ?? null) : pack;
      this.stmts.updateTenantPolicy.run(
        JSON.stringify(nextAllowed),
        nextPack,
        this.clock(),
        tenantId
      );
      const updated = this.getTenant(tenantId);
      if (!updated) {
        throw new Error('Tenant vanished during policy update');
      }
      return { ok: true, value: updated } as const;
    });
  }

  setWorkspaceGrant(
    tenantId: string,
    workspaceId: string,
    allowedCommandIds: readonly string[]
  ): StoreWriteResult<{ tenant: Tenant; workspace: Workspace }> {
    const grant = normalizeCommandIds(commandIdListSchema.parse(allowedCommandIds));
    return transaction(this.db, () => {
      // Tenant-first: the workspace must exist UNDER this tenant.
      if (!this.getWorkspace(tenantId, workspaceId)) {
        return { ok: false, reason: 'NOT_FOUND' } as const;
      }
      const now = this.clock();
      this.stmts.updateWorkspaceGrant.run(JSON.stringify(grant), now, tenantId, workspaceId);
      this.stmts.bumpPolicyVersion.run(now, tenantId);
      const tenant = this.getTenant(tenantId);
      const workspace = this.getWorkspace(tenantId, workspaceId);
      if (!tenant || !workspace) {
        throw new Error('Tenant or workspace vanished during grant update');
      }
      return { ok: true, value: { tenant, workspace } } as const;
    });
  }

  setMember(tenantId: string, userId: string, role: Role): StoreWriteResult<Member> {
    const member = memberSchema.parse({ tenantId, userId, role });
    return transaction(this.db, () => {
      if (!this.getTenant(tenantId)) {
        return { ok: false, reason: 'NOT_FOUND' } as const;
      }
      const existing = this.stmts.getMemberRole.get(tenantId, userId) as Row | undefined;
      if (existing?.role === 'admin' && role !== 'admin' && this.adminCount(tenantId) <= 1) {
        return { ok: false, reason: 'LAST_ADMIN' } as const;
      }
      const now = this.clock();
      this.stmts.upsertMember.run(tenantId, userId, member.role, now, now);
      return { ok: true, value: member } as const;
    });
  }

  removeMember(tenantId: string, userId: string): StoreWriteResult<Member> {
    return transaction(this.db, () => {
      const existing = this.stmts.getMemberRole.get(tenantId, userId) as Row | undefined;
      if (!existing) {
        return { ok: false, reason: 'NOT_FOUND' } as const;
      }
      const role = roleSchema.parse(existing.role);
      if (role === 'admin' && this.adminCount(tenantId) <= 1) {
        return { ok: false, reason: 'LAST_ADMIN' } as const;
      }
      this.stmts.deleteMember.run(tenantId, userId);
      return { ok: true, value: { tenantId, userId, role } } as const;
    });
  }

  private adminCount(tenantId: string): number {
    const row = this.stmts.countAdmins.get(tenantId) as { n: number };
    return row.n;
  }

  /**
   * Build a store from a seed snapshot, applying the same validation the
   * in-memory constructor does (unknown tenant, duplicates, malformed rows all
   * throw). Used by tests and the bootstrap path.
   */
  static fromSnapshot(
    db: DatabaseSync,
    input: {
      tenants?: readonly unknown[];
      workspaces?: readonly unknown[];
      members?: readonly unknown[];
    },
    clock?: () => number
  ): SqliteTenantStore {
    const store = new SqliteTenantStore(db, clock);
    transaction(db, () => {
      for (const raw of input.tenants ?? []) {
        const tenant = tenantSchema.parse(raw);
        if (!store.createTenant(tenant).ok) {
          throw new Error(`Duplicate tenant id: ${tenant.id}`);
        }
      }
      for (const raw of input.workspaces ?? []) {
        const ws = workspaceSchema.parse(raw);
        const created = store.createWorkspace(ws);
        if (!created.ok) {
          throw new Error(
            created.reason === 'NOT_FOUND'
              ? `Workspace ${ws.id} references unknown tenant ${ws.tenantId}`
              : `Duplicate workspace id ${ws.id} in tenant ${ws.tenantId}`
          );
        }
      }
      for (const raw of input.members ?? []) {
        const m = memberSchema.parse(raw);
        const created = store.setMember(m.tenantId, m.userId, m.role);
        if (!created.ok) {
          throw new Error(`Member ${m.userId} references unknown tenant ${m.tenantId}`);
        }
      }
    });
    return store;
  }
}
