import {
  AuditAction,
  AuditDecision,
  AuditEntry,
  AuditEntryInput,
  AuditQuery,
  AuditReader,
  AuditSink,
  clampAuditLimit,
  serializeAuditDetail,
} from '../audit.js';
import { DatabaseSync, Row, StatementSync } from './sqlite.js';

/**
 * SQLite append-only audit log. The migration installs BEFORE UPDATE / BEFORE
 * DELETE triggers on `audit_log` that abort, and this class exposes only
 * `record` and `query` — there is no code path that rewrites or removes history.
 * (A holder of raw database access could still drop the triggers; shipping the
 * log to external immutable storage is the remedy for that threat model — see
 * docs/control-plane.md.)
 */
export class SqliteAuditLog implements AuditSink, AuditReader {
  private readonly insert: StatementSync;

  constructor(
    private readonly db: DatabaseSync,
    private readonly clock: () => number = Date.now
  ) {
    this.insert = db.prepare(
      `INSERT INTO audit_log (ts, user_id, tenant_id, workspace_id, command_id, action, decision, code, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
  }

  record(entry: AuditEntryInput): AuditEntry {
    const ts = entry.ts ?? this.clock();
    const detail = serializeAuditDetail(entry.detail);
    const result = this.insert.run(
      ts,
      entry.userId,
      entry.tenantId,
      entry.workspaceId ?? null,
      entry.commandId ?? null,
      entry.action,
      entry.decision,
      entry.code ?? null,
      detail
    );
    return {
      id: Number(result.lastInsertRowid),
      ts,
      userId: entry.userId,
      tenantId: entry.tenantId,
      workspaceId: entry.workspaceId ?? null,
      commandId: entry.commandId ?? null,
      action: entry.action,
      decision: entry.decision,
      code: entry.code ?? null,
      detail: detail ? (JSON.parse(detail) as Record<string, unknown>) : null,
    };
  }

  query(query: AuditQuery): AuditEntry[] {
    // Tenant-first and parameter-bound: column names come from this fixed list,
    // values are always bound parameters.
    const clauses: string[] = ['tenant_id = ?'];
    const params: Array<string | number> = [query.tenantId];
    const add = (column: string, value: string | number | undefined): void => {
      if (value !== undefined) {
        clauses.push(`${column} = ?`);
        params.push(value);
      }
    };
    if (query.beforeId !== undefined) {
      clauses.push('id < ?');
      params.push(query.beforeId);
    }
    add('user_id', query.userId);
    add('workspace_id', query.workspaceId);
    add('command_id', query.commandId);
    add('action', query.action);
    add('decision', query.decision);
    params.push(clampAuditLimit(query.limit));

    const rows = this.db
      .prepare(
        `SELECT id, ts, user_id, tenant_id, workspace_id, command_id, action, decision, code, detail
           FROM audit_log WHERE ${clauses.join(' AND ')} ORDER BY id DESC LIMIT ?`
      )
      .all(...params) as Row[];
    return rows.map(rowToEntry);
  }
}

function rowToEntry(row: Row): AuditEntry {
  return {
    id: Number(row.id),
    ts: Number(row.ts),
    userId: (row.user_id as string | null) ?? null,
    tenantId: (row.tenant_id as string | null) ?? null,
    workspaceId: (row.workspace_id as string | null) ?? null,
    commandId: (row.command_id as string | null) ?? null,
    action: row.action as AuditAction,
    decision: row.decision as AuditDecision,
    code: (row.code as string | null) ?? null,
    detail: row.detail ? (JSON.parse(String(row.detail)) as Record<string, unknown>) : null,
  };
}
