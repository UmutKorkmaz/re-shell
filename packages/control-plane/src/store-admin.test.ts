import { describe, expect, it } from 'vitest';

import { STORE_FACTORIES } from './test-support/store-factories.js';

const TENANTS = [
  { id: 'tenant-a', name: 'Tenant A', allowedCommandIds: ['workspace.summary', 'doctor'] },
  { id: 'tenant-b', name: 'Tenant B', allowedCommandIds: ['workspace.summary'] },
];
const WORKSPACES = [
  { id: 'ws-a1', tenantId: 'tenant-a', name: 'A One', allowedCommandIds: ['doctor'] },
  { id: 'ws-b1', tenantId: 'tenant-b', name: 'B One', allowedCommandIds: ['workspace.summary'] },
];
const MEMBERS = [
  { tenantId: 'tenant-a', userId: 'alice', role: 'admin' },
  { tenantId: 'tenant-a', userId: 'bob', role: 'operator' },
  { tenantId: 'tenant-b', userId: 'alice', role: 'viewer' },
  { tenantId: 'tenant-b', userId: 'carol', role: 'admin' },
];

describe.each(STORE_FACTORIES)('$name admin writes', ({ create }) => {
  const store = () => create({ tenants: TENANTS, workspaces: WORKSPACES, members: MEMBERS });

  describe('createTenant / createWorkspace', () => {
    it('creates a tenant with defaults and refuses a duplicate id', () => {
      const s = store();
      const created = s.createTenant({ id: 'tenant-c', name: 'Tenant C' });
      expect(created.ok).toBe(true);
      expect(s.getTenant('tenant-c')).toMatchObject({
        id: 'tenant-c',
        allowedCommandIds: [],
        policyVersion: 0,
      });
      expect(s.createTenant({ id: 'tenant-c', name: 'again' })).toEqual({
        ok: false,
        reason: 'ALREADY_EXISTS',
      });
      // The first record is untouched by the refused duplicate.
      expect(s.getTenant('tenant-c')?.name).toBe('Tenant C');
    });

    it('de-duplicates allow-list ids', () => {
      const s = store();
      s.createTenant({
        id: 'tenant-c',
        name: 'C',
        allowedCommandIds: ['doctor', 'doctor', 'analyze'],
      });
      expect(s.getTenant('tenant-c')?.allowedCommandIds).toEqual(['doctor', 'analyze']);
    });

    it('creates a workspace only under an existing tenant', () => {
      const s = store();
      expect(
        s.createWorkspace({ id: 'ws-a2', tenantId: 'tenant-a', name: 'A Two' }).ok
      ).toBe(true);
      expect(s.getWorkspace('tenant-a', 'ws-a2')?.allowedCommandIds).toEqual([]);
      expect(s.createWorkspace({ id: 'ws-x', tenantId: 'ghost', name: 'X' })).toEqual({
        ok: false,
        reason: 'NOT_FOUND',
      });
    });

    it('allows the same workspace id in different tenants but not twice in one', () => {
      const s = store();
      expect(s.createWorkspace({ id: 'ws-a1', tenantId: 'tenant-b', name: 'dup id' }).ok).toBe(true);
      expect(s.getWorkspace('tenant-a', 'ws-a1')?.name).toBe('A One');
      expect(s.getWorkspace('tenant-b', 'ws-a1')?.name).toBe('dup id');
      expect(s.createWorkspace({ id: 'ws-a1', tenantId: 'tenant-a', name: 'x' })).toEqual({
        ok: false,
        reason: 'ALREADY_EXISTS',
      });
    });

    it('rejects malformed records and dot-segment ids', () => {
      const s = store();
      expect(() => s.createTenant({ id: 'bad id!', name: 'x' })).toThrow();
      expect(() => s.createTenant({ id: '..', name: 'x' })).toThrow();
      expect(() => s.createWorkspace({ id: '.', tenantId: 'tenant-a', name: 'x' })).toThrow();
    });
  });

  describe('policy', () => {
    it('updates the ceiling and pack and bumps policyVersion', () => {
      const s = store();
      const before = s.getTenant('tenant-a')!;
      expect(before.policyVersion).toBe(0);
      const r = s.updateTenantPolicy('tenant-a', {
        allowedCommandIds: ['doctor'],
        policyPack: 'recommended',
      });
      expect(r.ok).toBe(true);
      const after = s.getTenant('tenant-a')!;
      expect(after.allowedCommandIds).toEqual(['doctor']);
      expect(after.policyPack).toBe('recommended');
      expect(after.policyVersion).toBe(1);

      // A pack-only patch keeps the ceiling; null clears the pack.
      s.updateTenantPolicy('tenant-a', { policyPack: null });
      const cleared = s.getTenant('tenant-a')!;
      expect(cleared.allowedCommandIds).toEqual(['doctor']);
      expect(cleared.policyPack).toBeUndefined();
      expect(cleared.policyVersion).toBe(2);
    });

    it('rejects a malformed policy pack reference and unknown tenants', () => {
      const s = store();
      expect(() => s.updateTenantPolicy('tenant-a', { policyPack: 'has spaces' })).toThrow();
      expect(s.updateTenantPolicy('ghost', { allowedCommandIds: [] })).toEqual({
        ok: false,
        reason: 'NOT_FOUND',
      });
    });

    it('replaces a workspace grant and bumps the tenant policyVersion', () => {
      const s = store();
      const r = s.setWorkspaceGrant('tenant-a', 'ws-a1', ['workspace.summary']);
      expect(r.ok).toBe(true);
      expect(s.getWorkspace('tenant-a', 'ws-a1')?.allowedCommandIds).toEqual(['workspace.summary']);
      expect(s.getTenant('tenant-a')?.policyVersion).toBe(1);
    });

    it("cannot change another tenant's workspace grant (tenant-first isolation)", () => {
      const s = store();
      // ws-b1 is real but lives under tenant-b; addressed via tenant-a it is absent.
      expect(s.setWorkspaceGrant('tenant-a', 'ws-b1', ['doctor'])).toEqual({
        ok: false,
        reason: 'NOT_FOUND',
      });
      expect(s.getWorkspace('tenant-b', 'ws-b1')?.allowedCommandIds).toEqual(['workspace.summary']);
      // Neither tenant's policy version moved.
      expect(s.getTenant('tenant-a')?.policyVersion).toBe(0);
      expect(s.getTenant('tenant-b')?.policyVersion).toBe(0);
    });
  });

  describe('memberships', () => {
    it('reports a user memberships across tenants and nothing for strangers', () => {
      const s = store();
      expect(s.getMemberships('alice')).toEqual({ 'tenant-a': 'admin', 'tenant-b': 'viewer' });
      expect(s.getMemberships('bob')).toEqual({ 'tenant-a': 'operator' });
      expect(s.getMemberships('nobody')).toEqual({});
    });

    it('lists only the named tenant members, sorted', () => {
      const s = store();
      expect(s.listMembers('tenant-a').map((m) => m.userId)).toEqual(['alice', 'bob']);
      expect(s.listMembers('tenant-b').map((m) => m.userId)).toEqual(['alice', 'carol']);
      expect(s.listMembers('ghost')).toEqual([]);
    });

    it('adds and re-roles a member', () => {
      const s = store();
      expect(s.setMember('tenant-a', 'dave', 'viewer').ok).toBe(true);
      expect(s.getMemberships('dave')).toEqual({ 'tenant-a': 'viewer' });
      expect(s.setMember('tenant-a', 'dave', 'operator').ok).toBe(true);
      expect(s.getMemberships('dave')).toEqual({ 'tenant-a': 'operator' });
      expect(s.setMember('ghost', 'dave', 'viewer')).toEqual({ ok: false, reason: 'NOT_FOUND' });
    });

    it('refuses to demote or remove the last admin, but allows it with another admin', () => {
      const s = store();
      expect(s.setMember('tenant-a', 'alice', 'viewer')).toEqual({
        ok: false,
        reason: 'LAST_ADMIN',
      });
      expect(s.removeMember('tenant-a', 'alice')).toEqual({ ok: false, reason: 'LAST_ADMIN' });
      expect(s.getMemberships('alice')['tenant-a']).toBe('admin');

      s.setMember('tenant-a', 'bob', 'admin');
      expect(s.setMember('tenant-a', 'alice', 'viewer').ok).toBe(true);
      expect(s.removeMember('tenant-a', 'bob')).toEqual({ ok: false, reason: 'LAST_ADMIN' });
    });

    it('removes a member and reports NOT_FOUND for a stranger', () => {
      const s = store();
      expect(s.removeMember('tenant-a', 'bob')).toMatchObject({ ok: true });
      expect(s.getMemberships('bob')).toEqual({});
      expect(s.removeMember('tenant-a', 'bob')).toEqual({ ok: false, reason: 'NOT_FOUND' });
      // Removing from tenant-a never touches the same user in tenant-b.
      expect(s.getMemberships('alice')['tenant-b']).toBe('viewer');
    });

    it('rejects an invalid role or user id', () => {
      const s = store();
      expect(() => s.setMember('tenant-a', 'dave', 'root' as never)).toThrow();
      expect(() => s.setMember('tenant-a', '', 'viewer')).toThrow();
    });
  });
});
