import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { SqliteAuditLog } from './sqlite-audit.js';
import { LATEST_SCHEMA_VERSION, MIGRATIONS, migrate } from './migrations.js';
import { SqliteTenantStore } from './sqlite-store.js';
import { openDatabase, transaction } from './sqlite.js';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempDbFile(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'cp-sqlite-'));
  dirs.push(dir);
  return path.join(dir, 'cp.db');
}

describe('migrations', () => {
  it('applies every migration to an empty database and is idempotent', () => {
    const db = openDatabase(':memory:');
    const first = migrate(db);
    expect(first.applied).toEqual(MIGRATIONS.map((m) => m.version));
    expect(first.version).toBe(LATEST_SCHEMA_VERSION);

    const second = migrate(db);
    expect(second.applied).toEqual([]);
    expect(second.version).toBe(LATEST_SCHEMA_VERSION);
  });

  it('applies only the pending migrations to a partially migrated database', () => {
    const db = openDatabase(':memory:');
    const partial = migrate(db, { migrations: MIGRATIONS.slice(0, 1) });
    expect(partial.applied).toEqual([1]);
    const rest = migrate(db);
    expect(rest.applied).toEqual(MIGRATIONS.slice(1).map((m) => m.version));
    // The jobs tables from migration 2 now exist.
    expect(() => db.prepare('SELECT COUNT(*) FROM jobs').get()).not.toThrow();
  });

  it('refuses a database whose schema is newer than this build', () => {
    const db = openDatabase(':memory:');
    migrate(db);
    db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
      LATEST_SCHEMA_VERSION + 1,
      'from-the-future',
      0
    );
    expect(() => migrate(db)).toThrow(/newer than this build/);
  });

  it('rolls a failing migration back completely', () => {
    const db = openDatabase(':memory:');
    expect(() =>
      migrate(db, {
        migrations: [
          {
            version: 1,
            name: 'broken',
            sql: 'CREATE TABLE ok_table (x INTEGER); SELECT * FROM table_that_does_not_exist;',
          },
        ],
      })
    ).toThrow();
    expect(() => db.prepare('SELECT * FROM ok_table').get()).toThrow();
    expect(db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get()).toEqual({ n: 0 });
  });
});

describe('transaction helper', () => {
  it('commits on success and rolls back on throw, including nested savepoints', () => {
    const db = openDatabase(':memory:');
    db.exec('CREATE TABLE t (x INTEGER)');
    transaction(db, () => {
      db.exec('INSERT INTO t VALUES (1)');
      expect(() =>
        transaction(db, () => {
          db.exec('INSERT INTO t VALUES (2)');
          throw new Error('inner');
        })
      ).toThrow('inner');
      db.exec('INSERT INTO t VALUES (3)');
    });
    expect(db.prepare('SELECT x FROM t ORDER BY x').all()).toEqual([{ x: 1 }, { x: 3 }]);

    expect(() =>
      transaction(db, () => {
        db.exec('INSERT INTO t VALUES (4)');
        throw new Error('outer');
      })
    ).toThrow('outer');
    expect(db.prepare('SELECT COUNT(*) AS n FROM t').get()).toEqual({ n: 2 });
  });
});

describe('SQLite persistence', () => {
  it('keeps tenants, workspaces, memberships and policy across a reopen', () => {
    const file = tempDbFile();
    const db1 = openDatabase(file);
    migrate(db1);
    const s1 = new SqliteTenantStore(db1);
    s1.createTenant({ id: 'acme', name: 'Acme', allowedCommandIds: ['doctor'] });
    s1.createWorkspace({ id: 'main', tenantId: 'acme', name: 'Main', allowedCommandIds: ['doctor'] });
    s1.setMember('acme', 'alice', 'admin');
    s1.updateTenantPolicy('acme', { policyPack: 'baseline' });
    db1.close();

    const db2 = openDatabase(file);
    migrate(db2);
    const s2 = new SqliteTenantStore(db2);
    expect(s2.getTenant('acme')).toMatchObject({
      name: 'Acme',
      policyPack: 'baseline',
      policyVersion: 1,
    });
    expect(s2.getWorkspace('acme', 'main')?.allowedCommandIds).toEqual(['doctor']);
    expect(s2.getMemberships('alice')).toEqual({ acme: 'admin' });
    db2.close();
  });

  it('enforces the schema: no orphan workspaces/memberships, tenant-scoped uniqueness', () => {
    const db = openDatabase(':memory:');
    migrate(db);
    const now = Date.now();
    expect(() =>
      db
        .prepare(
          'INSERT INTO workspaces (tenant_id, id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run('no-such-tenant', 'w', 'orphan', now, now)
    ).toThrow(/FOREIGN KEY/i);
    expect(() =>
      db
        .prepare(
          'INSERT INTO memberships (tenant_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run('no-such-tenant', 'u', 'admin', now, now)
    ).toThrow(/FOREIGN KEY/i);

    const store = new SqliteTenantStore(db);
    store.createTenant({ id: 'a', name: 'A' });
    expect(() =>
      db
        .prepare(
          'INSERT INTO memberships (tenant_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run('a', 'u', 'superuser', now, now)
    ).toThrow(/CHECK/i);
  });

  it('never resolves a workspace by id alone: the same id under two tenants stays separate', () => {
    const db = openDatabase(':memory:');
    migrate(db);
    const store = new SqliteTenantStore(db);
    store.createTenant({ id: 'a', name: 'A' });
    store.createTenant({ id: 'b', name: 'B' });
    store.createWorkspace({ id: 'shared-id', tenantId: 'a', name: 'in A' });
    store.createWorkspace({ id: 'shared-id', tenantId: 'b', name: 'in B' });
    expect(store.getWorkspace('a', 'shared-id')?.name).toBe('in A');
    expect(store.getWorkspace('b', 'shared-id')?.name).toBe('in B');
    expect(store.listWorkspaces('a').map((w) => w.name)).toEqual(['in A']);
  });

  it('fromSnapshot enforces the same construction rules as the in-memory store', () => {
    const db = () => {
      const d = openDatabase(':memory:');
      migrate(d);
      return d;
    };
    const t = { id: 't', name: 'T' };
    expect(() =>
      SqliteTenantStore.fromSnapshot(db(), {
        tenants: [t],
        workspaces: [{ id: 'o', tenantId: 'nope', name: 'Orphan' }],
      })
    ).toThrow(/unknown tenant/);
    expect(() => SqliteTenantStore.fromSnapshot(db(), { tenants: [t, t] })).toThrow(
      /Duplicate tenant/
    );
    expect(() =>
      SqliteTenantStore.fromSnapshot(db(), {
        tenants: [t],
        workspaces: [
          { id: 'w', tenantId: 't', name: 'W' },
          { id: 'w', tenantId: 't', name: 'W' },
        ],
      })
    ).toThrow(/Duplicate workspace/);
    expect(() =>
      SqliteTenantStore.fromSnapshot(db(), { tenants: [{ id: 'bad id!', name: 'x' }] })
    ).toThrow();
    expect(() =>
      SqliteTenantStore.fromSnapshot(db(), {
        tenants: [t],
        members: [{ tenantId: 'nope', userId: 'u', role: 'admin' }],
      })
    ).toThrow(/unknown tenant/);
  });
});

describe('SQLite audit log', () => {
  function audit() {
    const db = openDatabase(':memory:');
    migrate(db);
    return { db, log: new SqliteAuditLog(db, () => 1_000) };
  }

  it('records and queries newest-first, scoped to one tenant', () => {
    const { log } = audit();
    log.record({ userId: 'u1', tenantId: 'a', workspaceId: 'w', commandId: 'doctor', action: 'command.authorize', decision: 'allow' });
    log.record({ userId: 'u2', tenantId: 'b', action: 'workspaces.list', decision: 'deny', code: 'FORBIDDEN' });
    log.record({ userId: 'u1', tenantId: 'a', commandId: 'analyze', action: 'command.authorize', decision: 'deny', code: 'COMMAND_NOT_ALLOWED', detail: { why: 'x' } });

    const a = log.query({ tenantId: 'a' });
    expect(a.map((e) => e.commandId)).toEqual(['analyze', 'doctor']);
    expect(a[0]).toMatchObject({ decision: 'deny', code: 'COMMAND_NOT_ALLOWED', detail: { why: 'x' }, ts: 1_000 });
    expect(a.every((e) => e.tenantId === 'a')).toBe(true);
    expect(log.query({ tenantId: 'b' })).toHaveLength(1);
    expect(log.query({ tenantId: 'ghost' })).toEqual([]);
  });

  it('filters and pages', () => {
    const { log } = audit();
    for (let i = 0; i < 5; i += 1) {
      log.record({ userId: i % 2 ? 'odd' : 'even', tenantId: 'a', action: 'workspaces.list', decision: i === 4 ? 'deny' : 'allow' });
    }
    expect(log.query({ tenantId: 'a', userId: 'odd' })).toHaveLength(2);
    expect(log.query({ tenantId: 'a', decision: 'deny' })).toHaveLength(1);
    const page1 = log.query({ tenantId: 'a', limit: 2 });
    expect(page1.map((e) => e.id)).toEqual([5, 4]);
    const page2 = log.query({ tenantId: 'a', limit: 2, beforeId: page1[1].id });
    expect(page2.map((e) => e.id)).toEqual([3, 2]);
  });

  it('is append-only at the database level: UPDATE and DELETE abort', () => {
    const { db, log } = audit();
    log.record({ userId: 'u', tenantId: 'a', action: 'workspaces.list', decision: 'allow' });
    expect(() => db.exec("UPDATE audit_log SET decision = 'deny'")).toThrow(/append-only/);
    expect(() => db.exec('DELETE FROM audit_log')).toThrow(/append-only/);
    expect(() => db.exec("UPDATE audit_log SET user_id = 'forged' WHERE id = 1")).toThrow(/append-only/);
    expect(log.query({ tenantId: 'a' })).toHaveLength(1);
    expect(log.query({ tenantId: 'a' })[0].decision).toBe('allow');
  });

  it('bounds oversized detail instead of storing it', () => {
    const { log } = audit();
    const entry = log.record({
      userId: 'u',
      tenantId: 'a',
      action: 'workspaces.list',
      decision: 'allow',
      detail: { blob: 'x'.repeat(10_000) },
    });
    expect(entry.detail).toEqual({ truncated: true });
  });
});
