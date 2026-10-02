import { describe, expect, it } from 'vitest';

import { Principal } from './auth.js';
import {
  authorizeCommand,
  authorizeTenant,
  authorizeWorkspace,
  effectiveAllowedCommands,
} from './authz.js';
import { InMemoryTenantStore } from './tenant.js';

const TENANTS = [
  { id: 'tenant-a', name: 'Tenant A', allowedCommandIds: ['workspace.summary', 'doctor'] },
  { id: 'tenant-b', name: 'Tenant B', allowedCommandIds: ['workspace.summary'] },
];
const WORKSPACES = [
  {
    id: 'ws-a1',
    tenantId: 'tenant-a',
    name: 'A One',
    // workspace requests doctor + analyze; analyze is NOT in tenant ceiling.
    allowedCommandIds: ['doctor', 'analyze'],
  },
  { id: 'ws-b1', tenantId: 'tenant-b', name: 'B One', allowedCommandIds: ['workspace.summary'] },
];

function store(): InMemoryTenantStore {
  return new InMemoryTenantStore({ tenants: TENANTS, workspaces: WORKSPACES });
}

const memberA: Principal = { userId: 'u-a', tenantRoles: { 'tenant-a': 'operator' } };
const viewerA: Principal = { userId: 'u-v', tenantRoles: { 'tenant-a': 'viewer' } };

describe('authorizeTenant', () => {
  it('denies a non-member with FORBIDDEN (no existence leak)', () => {
    const r = authorizeTenant(store(), memberA, 'tenant-b');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // tenant-b exists, but a non-member must see FORBIDDEN, not 404.
      expect(r.error.code).toBe('FORBIDDEN');
    }
  });

  it('denies an absent tenant with FORBIDDEN too (indistinguishable)', () => {
    const r = authorizeTenant(store(), memberA, 'ghost');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('FORBIDDEN');
    }
  });

  it('enforces minimum role', () => {
    const r = authorizeTenant(store(), viewerA, 'tenant-a', 'operator');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('FORBIDDEN');
      expect(r.error.details).toMatchObject({ held: 'viewer', required: 'operator' });
    }
  });

  it('authorizes a member meeting the role bar', () => {
    const r = authorizeTenant(store(), memberA, 'tenant-a', 'operator');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.tenant.id).toBe('tenant-a');
      expect(r.data.role).toBe('operator');
    }
  });

  it('returns TENANT_NOT_FOUND when membership references a missing tenant', () => {
    // Principal claims membership in a tenant the store does not have.
    const stale: Principal = { userId: 'u', tenantRoles: { 'tenant-x': 'admin' } };
    const r = authorizeTenant(store(), stale, 'tenant-x');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('TENANT_NOT_FOUND');
    }
  });
});

describe('authorizeWorkspace isolation', () => {
  it("tenant A member cannot reach tenant B's workspace", () => {
    const s = store();
    const auth = authorizeTenant(s, memberA, 'tenant-a', 'viewer');
    expect(auth.ok).toBe(true);
    if (!auth.ok) return;
    // ws-b1 is real but lives under tenant-b → unreachable, WORKSPACE_NOT_FOUND.
    const r = authorizeWorkspace(s, auth.data, 'ws-b1');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('WORKSPACE_NOT_FOUND');
    }
  });

  it('resolves a workspace owned by the authorized tenant', () => {
    const s = store();
    const auth = authorizeTenant(s, memberA, 'tenant-a', 'viewer');
    if (!auth.ok) throw new Error('precondition');
    const r = authorizeWorkspace(s, auth.data, 'ws-a1');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.workspace.id).toBe('ws-a1');
    }
  });
});

describe('command allow-list (intersection)', () => {
  it('effective set is the intersection of tenant ceiling and workspace grant', () => {
    const s = store();
    const tenant = s.getTenant('tenant-a')!;
    const ws = s.getWorkspace('tenant-a', 'ws-a1')!;
    // ws grants [doctor, analyze]; tenant ceiling [workspace.summary, doctor].
    expect(effectiveAllowedCommands(tenant, ws)).toEqual(['doctor']);
  });

  it('authorizes a command inside the intersection', () => {
    const s = store();
    const r = authorizeCommand(s.getTenant('tenant-a')!, s.getWorkspace('tenant-a', 'ws-a1')!, 'doctor');
    expect(r.ok).toBe(true);
  });

  it('rejects a command the workspace requested but the tenant ceiling forbids', () => {
    const s = store();
    const r = authorizeCommand(
      s.getTenant('tenant-a')!,
      s.getWorkspace('tenant-a', 'ws-a1')!,
      'analyze'
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('COMMAND_NOT_ALLOWED');
    }
  });

  it('rejects a command not granted by the workspace at all', () => {
    const s = store();
    const r = authorizeCommand(
      s.getTenant('tenant-a')!,
      s.getWorkspace('tenant-a', 'ws-a1')!,
      'workspace.summary'
    );
    expect(r.ok).toBe(false);
  });
});
