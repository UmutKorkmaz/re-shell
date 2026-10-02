import { describe, expect, it } from 'vitest';

import { ControlPlaneDeps, listWorkspaces, proxyCommand } from './api.js';
import {
  AUDIT_MAX_LIMIT,
  AuditEntryInput,
  AuditReader,
  AuditSink,
  InMemoryAuditLog,
  clampAuditLimit,
} from './audit.js';
import { InMemorySessionResolver } from './auth.js';
import { migrate } from './db/migrations.js';
import { SqliteAuditLog } from './db/sqlite-audit.js';
import { openDatabase } from './db/sqlite.js';
import { InMemoryTenantStore } from './tenant.js';

const NOW = 5_000;

const sinks: Array<{ name: string; create: () => AuditSink & AuditReader }> = [
  { name: 'InMemoryAuditLog', create: () => new InMemoryAuditLog(() => NOW) },
  {
    name: 'SqliteAuditLog',
    create: () => {
      const db = openDatabase(':memory:');
      migrate(db);
      return new SqliteAuditLog(db, () => NOW);
    },
  },
];

function depsFor(audit: AuditSink | undefined): ControlPlaneDeps {
  return {
    store: new InMemoryTenantStore({
      tenants: [
        { id: 'a', name: 'A', allowedCommandIds: ['doctor'] },
        { id: 'b', name: 'B', allowedCommandIds: ['doctor'] },
      ],
      workspaces: [
        { id: 'w', tenantId: 'a', name: 'W', allowedCommandIds: ['doctor'] },
        { id: 'wb', tenantId: 'b', name: 'WB', allowedCommandIds: ['doctor'] },
      ],
    }),
    sessions: new InMemorySessionResolver([
      { token: 'op', principal: { userId: 'op', tenantRoles: { a: 'operator' } }, expiresAt: NOW + 1000 },
      { token: 'viewer', principal: { userId: 'viewer', tenantRoles: { a: 'viewer' } }, expiresAt: NOW + 1000 },
    ]),
    now: () => NOW,
    audit,
  };
}

describe.each(sinks)('$name', ({ create }) => {
  it('records and queries newest-first within one tenant, with filters and paging', () => {
    const log = create();
    const input = (over: Partial<AuditEntryInput>): AuditEntryInput => ({
      userId: 'u1',
      tenantId: 'a',
      action: 'workspaces.list',
      decision: 'allow',
      ...over,
    });
    log.record(input({}));
    log.record(input({ tenantId: 'b' }));
    log.record(input({ userId: 'u2', decision: 'deny', code: 'FORBIDDEN' }));
    log.record(input({ commandId: 'doctor', workspaceId: 'w', action: 'command.authorize' }));

    const all = log.query({ tenantId: 'a' });
    expect(all.map((e) => e.id)).toEqual([4, 3, 1]);
    expect(all).toHaveLength(3);
    expect(all.every((e) => e.tenantId === 'a')).toBe(true);
    expect(all[0]).toMatchObject({ action: 'command.authorize', commandId: 'doctor', workspaceId: 'w', ts: NOW });
    expect(log.query({ tenantId: 'a', userId: 'u2' })).toHaveLength(1);
    expect(log.query({ tenantId: 'a', decision: 'deny' })[0].code).toBe('FORBIDDEN');
    expect(log.query({ tenantId: 'a', commandId: 'doctor' })).toHaveLength(1);
    expect(log.query({ tenantId: 'a', workspaceId: 'w' })).toHaveLength(1);
    expect(log.query({ tenantId: 'a', action: 'workspaces.list' })).toHaveLength(2);
    const first = log.query({ tenantId: 'a', limit: 1 });
    expect(first).toHaveLength(1);
    const next = log.query({ tenantId: 'a', limit: 1, beforeId: first[0].id });
    expect(next[0].id).toBeLessThan(first[0].id);
    expect(log.query({ tenantId: 'nobody' })).toEqual([]);
  });

  it('listWorkspaces and proxyCommand each record exactly one decision per request', () => {
    const log = create();
    const deps = depsFor(log);
    listWorkspaces(deps, { token: 'viewer', tenantId: 'a' }); // allow
    listWorkspaces(deps, { token: 'viewer', tenantId: 'b' }); // deny: not a member
    listWorkspaces(deps, { token: 'viewer', tenantId: 'ghost' }); // deny: absent (same code)
    proxyCommand(deps, { token: 'op', tenantId: 'a', workspaceId: 'w', commandId: 'doctor' }); // allow
    proxyCommand(deps, { token: 'op', tenantId: 'a', workspaceId: 'wb', commandId: 'doctor' }); // deny: other tenant's workspace
    proxyCommand(deps, { token: 'op', tenantId: 'a', workspaceId: 'w', commandId: 'analyze' }); // deny: not allowed
    proxyCommand(deps, { token: 'viewer', tenantId: 'a', workspaceId: 'w', commandId: 'doctor' }); // deny: role
    proxyCommand(deps, { token: 'nope', tenantId: 'a', workspaceId: 'w', commandId: 'doctor' }); // authn failure

    const rows = [
      ...log.query({ tenantId: 'a' }),
      ...log.query({ tenantId: 'b' }),
      ...log.query({ tenantId: 'ghost' }),
    ].sort((x, y) => x.id - y.id);
    expect(rows.map((r) => `${r.userId}|${r.tenantId}|${r.action}|${r.decision}|${r.code ?? '-'}`)).toEqual([
      'viewer|a|workspaces.list|allow|-',
      'viewer|b|workspaces.list|deny|FORBIDDEN',
      'viewer|ghost|workspaces.list|deny|FORBIDDEN',
      'op|a|command.authorize|allow|-',
      'op|a|command.authorize|deny|WORKSPACE_NOT_FOUND',
      'op|a|command.authorize|deny|COMMAND_NOT_ALLOWED',
      'viewer|a|command.authorize|deny|FORBIDDEN',
      'null|a|auth.failed|deny|UNAUTHENTICATED',
    ]);
    expect(rows[3]).toMatchObject({ workspaceId: 'w', commandId: 'doctor' });
  });

  it('validation failures (before any authorization) are not authorization decisions', () => {
    const log = create();
    const deps = depsFor(log);
    expect(listWorkspaces(deps, { tenantId: 'a' }).ok).toBe(false);
    expect(proxyCommand(deps, { token: 'op', tenantId: 'a' }).ok).toBe(false);
    expect(log.query({ tenantId: 'a' })).toEqual([]);
  });

  it('applies the registry param check before authorization when validateCommand is wired', () => {
    const log = create();
    const deps: ControlPlaneDeps = {
      ...depsFor(log),
      validateCommand: (id) => (id === 'doctor' ? null : 'unknown command'),
    };
    const bad = proxyCommand(deps, { token: 'op', tenantId: 'a', workspaceId: 'w', commandId: 'analyze' });
    expect(bad).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(proxyCommand(deps, { token: 'op', tenantId: 'a', workspaceId: 'w', commandId: 'doctor' }).ok).toBe(true);
  });

  it('refuses to authorize when the decision cannot be recorded, but a deny stays a deny', () => {
    const failing: AuditSink = {
      record: () => {
        throw new Error('audit store down');
      },
    };
    const deps = depsFor(failing);
    expect(listWorkspaces(deps, { token: 'viewer', tenantId: 'a' })).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });
    expect(
      proxyCommand(deps, { token: 'op', tenantId: 'a', workspaceId: 'w', commandId: 'doctor' })
    ).toMatchObject({ ok: false, error: { code: 'INTERNAL_ERROR' } });
    // Denials are returned unchanged even though they could not be recorded.
    expect(listWorkspaces(deps, { token: 'viewer', tenantId: 'b' })).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
  });
});

describe('InMemoryAuditLog is write-once', () => {
  it('hands out copies and frozen rows: history cannot be rewritten through the API', () => {
    const log = new InMemoryAuditLog(() => NOW);
    const written = log.record({ userId: 'u', tenantId: 'a', action: 'workspaces.list', decision: 'allow' });
    expect(Object.isFrozen(written)).toBe(true);
    expect(() => {
      (written as { decision: string }).decision = 'deny';
    }).toThrow();
    const read = log.query({ tenantId: 'a' });
    read[0].decision = 'deny';
    read.pop();
    expect(log.query({ tenantId: 'a' })[0].decision).toBe('allow');
    expect(log.size).toBe(1);
    // There is no update/delete surface at all.
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(log)).sort()).toEqual(['constructor', 'query', 'record', 'size']);
  });

  it('bounds oversized detail and clamps page sizes', () => {
    const log = new InMemoryAuditLog();
    const e = log.record({ userId: 'u', tenantId: 'a', action: 'workspaces.list', decision: 'allow', detail: { blob: 'x'.repeat(5000) } });
    expect(e.detail).toEqual({ truncated: true });
    expect(clampAuditLimit(undefined)).toBe(100);
    expect(clampAuditLimit(0)).toBe(1);
    expect(clampAuditLimit(100000)).toBe(AUDIT_MAX_LIMIT);
    expect(clampAuditLimit(Number.NaN)).toBe(100);
  });
});
