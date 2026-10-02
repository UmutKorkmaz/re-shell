import { describe, expect, it } from 'vitest';

import { InMemoryTenantStore } from './tenant.js';

const TENANTS = [
  { id: 'tenant-a', name: 'Tenant A', allowedCommandIds: ['workspace.summary'] },
  { id: 'tenant-b', name: 'Tenant B', allowedCommandIds: ['workspace.summary'] },
];

const WORKSPACES = [
  { id: 'ws-a1', tenantId: 'tenant-a', name: 'A One', allowedCommandIds: ['workspace.summary'] },
  { id: 'ws-a2', tenantId: 'tenant-a', name: 'A Two', allowedCommandIds: [] },
  { id: 'ws-b1', tenantId: 'tenant-b', name: 'B One', allowedCommandIds: ['workspace.summary'] },
];

function store(): InMemoryTenantStore {
  return new InMemoryTenantStore({ tenants: TENANTS, workspaces: WORKSPACES });
}

describe('InMemoryTenantStore construction', () => {
  it('rejects a workspace referencing an unknown tenant', () => {
    expect(
      () =>
        new InMemoryTenantStore({
          tenants: TENANTS,
          workspaces: [{ id: 'orphan', tenantId: 'nope', name: 'Orphan', allowedCommandIds: [] }],
        })
    ).toThrow(/unknown tenant/);
  });

  it('rejects duplicate tenant ids', () => {
    expect(
      () => new InMemoryTenantStore({ tenants: [TENANTS[0], TENANTS[0]], workspaces: [] })
    ).toThrow(/Duplicate tenant/);
  });

  it('rejects duplicate workspace ids within a tenant', () => {
    expect(
      () =>
        new InMemoryTenantStore({
          tenants: TENANTS,
          workspaces: [WORKSPACES[0], WORKSPACES[0]],
        })
    ).toThrow(/Duplicate workspace/);
  });

  it('rejects malformed records via zod', () => {
    expect(
      () => new InMemoryTenantStore({ tenants: [{ id: 'bad id!', name: 'x' }], workspaces: [] })
    ).toThrow();
  });
});

describe('tenant isolation', () => {
  it('lists only the requested tenant workspaces', () => {
    const ids = store()
      .listWorkspaces('tenant-a')
      .map((w) => w.id);
    expect(ids).toEqual(['ws-a1', 'ws-a2']);
  });

  it('returns empty list for a tenant with no workspaces', () => {
    const s = new InMemoryTenantStore({ tenants: TENANTS, workspaces: [] });
    expect(s.listWorkspaces('tenant-a')).toEqual([]);
  });

  it("tenant A cannot resolve tenant B's workspace by id", () => {
    // ws-b1 is real, but unreachable when scoped to tenant-a.
    expect(store().getWorkspace('tenant-a', 'ws-b1')).toBeUndefined();
    // It IS reachable for its owning tenant.
    expect(store().getWorkspace('tenant-b', 'ws-b1')?.id).toBe('ws-b1');
  });

  it('returns undefined for a non-existent tenant lookup', () => {
    expect(store().getTenant('ghost')).toBeUndefined();
    expect(store().listWorkspaces('ghost')).toEqual([]);
  });
});
