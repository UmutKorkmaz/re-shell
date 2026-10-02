import { describe, expect, it } from 'vitest';

import { ControlPlaneDeps, listWorkspaces, proxyCommand } from './api.js';
import { InMemorySessionResolver, Session } from './auth.js';
import { InMemoryTenantStore } from './tenant.js';

const TENANTS = [
  { id: 'tenant-a', name: 'Tenant A', allowedCommandIds: ['doctor'] },
  { id: 'tenant-b', name: 'Tenant B', allowedCommandIds: ['doctor'] },
];
const WORKSPACES = [
  { id: 'ws-a1', tenantId: 'tenant-a', name: 'A One', allowedCommandIds: ['doctor'] },
  { id: 'ws-b1', tenantId: 'tenant-b', name: 'B One', allowedCommandIds: ['doctor'] },
];

const FIXED_NOW = 10_000;

function deps(): ControlPlaneDeps {
  const sessions: Session[] = [
    {
      token: 'tok-operator-a',
      principal: { userId: 'u-a', tenantRoles: { 'tenant-a': 'operator' } },
      expiresAt: FIXED_NOW + 1_000,
    },
    {
      token: 'tok-viewer-a',
      principal: { userId: 'u-v', tenantRoles: { 'tenant-a': 'viewer' } },
      expiresAt: FIXED_NOW + 1_000,
    },
  ];
  return {
    store: new InMemoryTenantStore({ tenants: TENANTS, workspaces: WORKSPACES }),
    sessions: new InMemorySessionResolver(sessions),
    now: () => FIXED_NOW,
  };
}

describe('listWorkspaces handler', () => {
  it('rejects an unauthenticated request', () => {
    const r = listWorkspaces(deps(), { token: 'nope', tenantId: 'tenant-a' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a malformed request body', () => {
    const r = listWorkspaces(deps(), { token: 'tok-viewer-a' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_REQUEST');
  });

  it('returns only the tenant own workspaces for a member', () => {
    const r = listWorkspaces(deps(), { token: 'tok-viewer-a', tenantId: 'tenant-a' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.workspaces.map((w) => w.id)).toEqual(['ws-a1']);
    }
  });

  it("denies a member listing another tenant's workspaces (FORBIDDEN)", () => {
    const r = listWorkspaces(deps(), { token: 'tok-viewer-a', tenantId: 'tenant-b' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('FORBIDDEN');
  });
});

describe('proxyCommand handler', () => {
  it('authorizes a permitted command for a tenant workspace', () => {
    const r = proxyCommand(deps(), {
      token: 'tok-operator-a',
      tenantId: 'tenant-a',
      workspaceId: 'ws-a1',
      commandId: 'doctor',
      params: { type: 'all' },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toMatchObject({
        tenantId: 'tenant-a',
        workspaceId: 'ws-a1',
        commandId: 'doctor',
        authorized: true,
      });
      expect(r.data.params).toEqual({ type: 'all' });
    }
  });

  it('rejects an unauthenticated proxy request', () => {
    const r = proxyCommand(deps(), {
      token: 'bad',
      tenantId: 'tenant-a',
      workspaceId: 'ws-a1',
      commandId: 'doctor',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UNAUTHENTICATED');
  });

  it('requires operator role (viewer is denied)', () => {
    const r = proxyCommand(deps(), {
      token: 'tok-viewer-a',
      tenantId: 'tenant-a',
      workspaceId: 'ws-a1',
      commandId: 'doctor',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('FORBIDDEN');
  });

  it("cannot proxy into another tenant's workspace (isolation)", () => {
    const r = proxyCommand(deps(), {
      token: 'tok-operator-a',
      tenantId: 'tenant-a',
      workspaceId: 'ws-b1', // real, but belongs to tenant-b
      commandId: 'doctor',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('WORKSPACE_NOT_FOUND');
  });

  it('rejects a command not on the allow-list', () => {
    const r = proxyCommand(deps(), {
      token: 'tok-operator-a',
      tenantId: 'tenant-a',
      workspaceId: 'ws-a1',
      commandId: 'analyze', // not granted
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('COMMAND_NOT_ALLOWED');
  });

  it('rejects an expired session even with valid shape', () => {
    const d = deps();
    const expired: ControlPlaneDeps = { ...d, now: () => FIXED_NOW + 10_000 };
    const r = proxyCommand(expired, {
      token: 'tok-operator-a',
      tenantId: 'tenant-a',
      workspaceId: 'ws-a1',
      commandId: 'doctor',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UNAUTHENTICATED');
  });
});
