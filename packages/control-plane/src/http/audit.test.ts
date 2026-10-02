import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuditEntry } from '../audit.js';
import { STANDARD_SEED, startHarness, type Harness } from '../test-support/harness.js';

let h: Harness;

beforeEach(async () => {
  h = await startHarness({ seed: STANDARD_SEED });
});
afterEach(async () => {
  await h.close();
});

const audit = async (user = 'alice', query = '', tenant = 'acme') =>
  h.request('GET', `/tenants/${tenant}/audit${query}`, { token: h.userToken(user) });

describe('audit trail: every authorization decision is recorded', () => {
  it('records who, tenant, workspace, command, decision and time', async () => {
    const before = Date.now();
    await h.request('GET', '/tenants/acme/workspaces', { token: h.userToken('vera') }); // allow
    await h.request('POST', '/tenants/acme/workspaces/main/commands', { token: h.userToken('vera'), body: { commandId: 'doctor' } }); // deny: role
    await h.request('POST', '/tenants/acme/workspaces/main/commands', { token: h.userToken('bob'), body: { commandId: 'doctor' } }); // allow
    await h.request('POST', '/tenants/acme/workspaces/main/commands', { token: h.userToken('bob'), body: { commandId: 'scorecard' } }); // deny: not granted
    await h.request('POST', '/tenants/acme/workspaces/secret/commands', { token: h.userToken('bob'), body: { commandId: 'doctor' } }); // deny: other tenant's workspace
    await h.request('GET', '/tenants/acme/workspaces', { token: h.userToken('gina') }); // deny: outsider
    await h.request('GET', '/tenants/acme/workspaces', { token: 'forged' }); // authn failure

    const res = await audit('alice', '?limit=100');
    expect(res.status).toBe(200);
    const entries: AuditEntry[] = res.json.data.entries;
    const mine = entries.filter((e) => e.action !== 'audit.query');

    const find = (userId: string | null, action: string, decision: string, commandId: string | null = null) =>
      mine.find((e) => e.userId === userId && e.action === action && e.decision === decision && e.commandId === commandId);

    expect(find('vera', 'workspaces.list', 'allow')).toMatchObject({ tenantId: 'acme', code: null });
    expect(find('vera', 'command.authorize', 'deny', 'doctor')).toMatchObject({
      tenantId: 'acme',
      workspaceId: 'main',
      code: 'FORBIDDEN',
    });
    expect(find('bob', 'command.authorize', 'allow', 'doctor')).toMatchObject({
      tenantId: 'acme',
      workspaceId: 'main',
      code: null,
    });
    expect(find('bob', 'command.authorize', 'deny', 'scorecard')).toMatchObject({ code: 'COMMAND_NOT_ALLOWED' });
    expect(mine.find((e) => e.userId === 'bob' && e.workspaceId === 'secret')).toMatchObject({
      decision: 'deny',
      code: 'WORKSPACE_NOT_FOUND',
    });
    expect(find('gina', 'workspaces.list', 'deny')).toMatchObject({ tenantId: 'acme', code: 'FORBIDDEN' });
    expect(find(null, 'auth.failed', 'deny')).toMatchObject({ tenantId: 'acme', code: 'UNAUTHENTICATED' });

    for (const e of entries) {
      expect(Number.isInteger(e.id)).toBe(true);
      expect(e.ts).toBeGreaterThanOrEqual(before);
      expect(e.ts).toBeLessThanOrEqual(Date.now());
    }
    // Newest first, strictly decreasing ids.
    const ids = entries.map((e) => e.id);
    expect([...ids].sort((a, b) => b - a)).toEqual(ids);
  });

  it('records exactly one decision per command request, however many gates it passed', async () => {
    const countBefore = h.audit.query({ tenantId: 'acme' }).length;
    await h.request('POST', '/tenants/acme/workspaces/main/commands', { token: h.userToken('bob'), body: { commandId: 'doctor' } });
    const rows = h.audit.query({ tenantId: 'acme' });
    expect(rows.length - countBefore).toBe(1);
  });

  it('audits admin mutations, memberships, policy changes and audit reads themselves', async () => {
    const alice = h.userToken('alice');
    await h.request('PUT', '/tenants/acme/policy', { token: alice, body: { allowedCommandIds: ['doctor'], policyPack: 'baseline' } });
    await h.request('PUT', '/tenants/acme/members/zed', { token: alice, body: { role: 'viewer' } });
    await h.request('PUT', '/tenants/acme/policy', { token: h.userToken('bob'), body: { allowedCommandIds: [] } }); // denied
    await audit('alice');

    const actions = h.audit.query({ tenantId: 'acme', limit: 50 }).map((e) => `${e.userId}:${e.action}:${e.decision}`);
    expect(actions).toContain('alice:policy.update:allow');
    expect(actions).toContain('alice:member.set:allow');
    expect(actions).toContain('bob:policy.update:deny');
    expect(actions).toContain('alice:audit.query:allow');
    const policyRow = h.audit.query({ tenantId: 'acme', action: 'policy.update', decision: 'allow' })[0];
    expect(policyRow.detail).toMatchObject({ allowedCommandIds: ['doctor'], policyPack: 'baseline' });
  });

  it('filters and pages', async () => {
    for (let i = 0; i < 5; i += 1) {
      await h.request('GET', '/tenants/acme/workspaces', { token: h.userToken('vera') });
    }
    await h.request('GET', '/tenants/acme/workspaces', { token: h.userToken('gina') });

    const onlyDeny = await audit('alice', '?decision=deny');
    expect(onlyDeny.json.data.entries.every((e: AuditEntry) => e.decision === 'deny')).toBe(true);
    const onlyVera = await audit('alice', '?userId=vera&action=workspaces.list');
    expect(onlyVera.json.data.entries).toHaveLength(5);

    const page1 = await audit('alice', '?userId=vera&limit=2');
    expect(page1.json.data.entries).toHaveLength(2);
    expect(page1.json.data.nextBeforeId).toBe(page1.json.data.entries[1].id);
    const page2 = await audit('alice', `?userId=vera&limit=2&beforeId=${page1.json.data.nextBeforeId}`);
    expect(page2.json.data.entries[0].id).toBeLessThan(page1.json.data.entries[1].id);
    expect((await audit('alice', '?action=bogus')).status).toBe(400);
    expect((await audit('alice', '?limit=501')).status).toBe(400);
  });
});

describe('audit trail: access control and tenant scoping', () => {
  it('is admin-only: operators, viewers, outsiders and anonymous callers are refused', async () => {
    expect((await audit('bob')).status).toBe(403);
    expect((await audit('vera')).status).toBe(403);
    expect((await audit('gina')).status).toBe(403);
    expect((await audit('nobody')).status).toBe(403);
    expect((await h.request('GET', '/tenants/acme/audit')).status).toBe(401);
    // Absent tenants answer exactly like real foreign ones.
    expect((await audit('gina', '', 'ghost')).status).toBe(403);
  });

  it("an admin sees only their own tenant's rows", async () => {
    await h.request('GET', '/tenants/globex/workspaces', { token: h.userToken('gina') });
    await h.request('GET', '/tenants/acme/workspaces', { token: h.userToken('vera') });
    const acme: AuditEntry[] = (await audit('alice')).json.data.entries;
    const globex: AuditEntry[] = (await audit('gina', '', 'globex')).json.data.entries;
    expect(acme.every((e) => e.tenantId === 'acme')).toBe(true);
    expect(globex.every((e) => e.tenantId === 'globex')).toBe(true);
    expect(globex.some((e) => e.userId === 'vera')).toBe(false);
    expect(acme.some((e) => e.userId === 'gina')).toBe(false);
  });

  it("an outsider's probe of a tenant shows up in THAT tenant's trail", async () => {
    await h.request('GET', '/tenants/acme/workspaces', { token: h.userToken('gina') });
    const rows: AuditEntry[] = (await audit('alice')).json.data.entries;
    expect(rows.find((e) => e.userId === 'gina')).toMatchObject({ decision: 'deny', code: 'FORBIDDEN' });
  });
});

describe('audit trail: cannot be modified through the API', () => {
  it('exposes no write/update/delete routes on the audit resource', async () => {
    await h.request('GET', '/tenants/acme/workspaces', { token: h.userToken('vera') });
    const snapshot = () => JSON.stringify(h.db.prepare('SELECT * FROM audit_log ORDER BY id').all());
    const alice = h.userToken('alice');
    const before = snapshot();

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = await h.request(method, '/tenants/acme/audit', { token: alice, body: method === 'DELETE' ? undefined : { decision: 'allow' } });
      expect(res.status, `${method} /audit`).toBe(405);
      expect(res.headers.get('allow')).toBe('GET');
    }
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = await h.request(method, '/tenants/acme/audit/1', { token: alice, body: ['POST', 'PUT', 'PATCH'].includes(method) ? { decision: 'allow' } : undefined });
      expect(res.status, `${method} /audit/1`).toBe(404);
    }
    for (const path of ['/audit', '/tenants/acme/audit/clear', '/tenants/acme/audit?id=1&decision=allow']) {
      const del = await h.request('DELETE', path, { token: alice });
      expect([404, 405]).toContain(del.status);
    }

    // The only rows added since are the (read-only) audit decisions themselves.
    const rows = h.db.prepare('SELECT id, action FROM audit_log ORDER BY id').all() as Array<{ id: number; action: string }>;
    const original = JSON.parse(before) as Array<{ id: number }>;
    expect(rows.slice(0, original.length)).toEqual(original.map((r) => expect.objectContaining({ id: r.id })));
    expect(JSON.stringify(h.db.prepare('SELECT * FROM audit_log ORDER BY id LIMIT ?').all(original.length))).toBe(before);
  });

  it('the database refuses UPDATE and DELETE on audit rows even from the application connection', async () => {
    await h.request('GET', '/tenants/acme/workspaces', { token: h.userToken('vera') });
    expect(() => h.db.exec("UPDATE audit_log SET decision = 'allow'")).toThrow(/append-only/);
    expect(() => h.db.exec('DELETE FROM audit_log')).toThrow(/append-only/);
    expect(() => h.db.exec("DELETE FROM audit_log WHERE tenant_id = 'acme'")).toThrow(/append-only/);
    expect(h.audit.query({ tenantId: 'acme' }).length).toBeGreaterThan(0);
  });

  it('a body cannot smuggle audit fields into any other route', async () => {
    const res = await h.request('PUT', '/tenants/acme/policy', {
      token: h.userToken('alice'),
      body: { allowedCommandIds: ['doctor'], audit: [], decision: 'allow' },
    });
    expect(res.status).toBe(400);
  });
});

describe('audit trail: fails closed', () => {
  it('refuses to authorize (and queues nothing) when the decision cannot be recorded, but still denies', async () => {
    await h.close();
    h = await startHarness({
      seed: STANDARD_SEED,
      serverOptions: {
        audit: {
          record: () => {
            throw new Error('disk full');
          },
          query: () => [],
        },
      },
    });
    const allowed = await h.request('POST', '/tenants/acme/workspaces/main/commands', { token: h.userToken('bob'), body: { commandId: 'doctor' } });
    expect(allowed.status).toBe(500);
    expect(allowed.json.error.code).toBe('INTERNAL_ERROR');
    expect(h.jobs.list('acme', { limit: 10 })).toEqual([]);

    // A denial is still a denial.
    const denied = await h.request('POST', '/tenants/acme/workspaces/main/commands', { token: h.userToken('vera'), body: { commandId: 'doctor' } });
    expect(denied.status).toBe(403);
    // Admin mutations are refused too, and nothing changed.
    const mutate = await h.request('PUT', '/tenants/acme/policy', { token: h.userToken('alice'), body: { allowedCommandIds: [] } });
    expect(mutate.status).toBe(500);
    expect(h.store.getTenant('acme')?.policyVersion).toBe(0);
    // And a failing audit sink never turns an authentication failure into a 500.
    expect((await h.request('GET', '/me', { token: 'bad' })).status).toBe(401);
  });
});
