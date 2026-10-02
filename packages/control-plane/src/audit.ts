/**
 * Append-only audit trail of every authorization decision: who, which tenant,
 * which workspace, which command, allow or deny, and when.
 *
 * The contract is deliberately write-once: {@link AuditSink} can only `record`,
 * {@link AuditReader} can only `query`. There is no update or delete surface in
 * the API, and the SQLite implementation (db/sqlite-audit.ts) additionally
 * installs triggers that make UPDATE and DELETE on the table abort.
 */

export type AuditDecision = 'allow' | 'deny';

/** Every action the control plane audits. Closed so a typo cannot create a new kind. */
export type AuditAction =
  | 'auth.failed'
  | 'me.read'
  | 'workspaces.list'
  | 'command.authorize'
  | 'job.list'
  | 'job.read'
  | 'job.stream'
  | 'job.cancel'
  | 'job.claim'
  | 'events.subscribe'
  | 'tenant.create'
  | 'workspace.create'
  | 'workspace.grant.set'
  | 'policy.read'
  | 'policy.update'
  | 'members.list'
  | 'member.set'
  | 'member.remove'
  | 'audit.query';

export interface AuditEntryInput {
  /** Unix ms. Defaults to the sink's clock. */
  ts?: number;
  /** Authenticated user (or `worker:<id>`); null when authentication failed. */
  userId: string | null;
  /** The tenant the caller ASKED about (it may not exist). */
  tenantId: string | null;
  workspaceId?: string | null;
  commandId?: string | null;
  action: AuditAction;
  decision: AuditDecision;
  /** The error code on deny. */
  code?: string | null;
  /** Small structured context (bounded when stored). Never secrets. */
  detail?: Record<string, unknown> | null;
}

export interface AuditEntry {
  /** Strictly increasing sequence number. */
  id: number;
  ts: number;
  userId: string | null;
  tenantId: string | null;
  workspaceId: string | null;
  commandId: string | null;
  action: AuditAction;
  decision: AuditDecision;
  code: string | null;
  detail: Record<string, unknown> | null;
}

export interface AuditQuery {
  /** Tenant scope. Mandatory: an audit read is always tenant-first. */
  tenantId: string;
  /** Page size, 1..500 (default 100). */
  limit?: number;
  /** Return entries with id strictly below this (newest-first paging). */
  beforeId?: number;
  userId?: string;
  workspaceId?: string;
  commandId?: string;
  action?: AuditAction;
  decision?: AuditDecision;
}

export interface AuditSink {
  /** Append one entry. Throws when the entry cannot be durably recorded. */
  record(entry: AuditEntryInput): AuditEntry;
}

export interface AuditReader {
  /** Newest-first page of entries for ONE tenant. */
  query(query: AuditQuery): AuditEntry[];
}

export const AUDIT_DEFAULT_LIMIT = 100;
export const AUDIT_MAX_LIMIT = 500;
/** Serialized `detail` larger than this is replaced by a truncation marker. */
export const AUDIT_MAX_DETAIL_BYTES = 2048;

/** Clamp a requested page size into the allowed range. */
export function clampAuditLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return AUDIT_DEFAULT_LIMIT;
  }
  return Math.min(AUDIT_MAX_LIMIT, Math.max(1, Math.trunc(limit)));
}

/** Serialize `detail` for storage, bounding its size. */
export function serializeAuditDetail(detail: Record<string, unknown> | null | undefined): string | null {
  if (!detail || Object.keys(detail).length === 0) {
    return null;
  }
  const json = JSON.stringify(detail);
  if (Buffer.byteLength(json, 'utf8') > AUDIT_MAX_DETAIL_BYTES) {
    return JSON.stringify({ truncated: true });
  }
  return json;
}

/**
 * In-memory audit log for tests and single-process use. Entries are frozen when
 * recorded and handed out as copies; nothing can rewrite history.
 */
export class InMemoryAuditLog implements AuditSink, AuditReader {
  private readonly rows: AuditEntry[] = [];

  constructor(private readonly clock: () => number = Date.now) {}

  record(entry: AuditEntryInput): AuditEntry {
    const detail = serializeAuditDetail(entry.detail);
    const row: AuditEntry = Object.freeze({
      id: this.rows.length + 1,
      ts: entry.ts ?? this.clock(),
      userId: entry.userId,
      tenantId: entry.tenantId,
      workspaceId: entry.workspaceId ?? null,
      commandId: entry.commandId ?? null,
      action: entry.action,
      decision: entry.decision,
      code: entry.code ?? null,
      detail: detail ? (JSON.parse(detail) as Record<string, unknown>) : null,
    });
    this.rows.push(row);
    return row;
  }

  query(query: AuditQuery): AuditEntry[] {
    const limit = clampAuditLimit(query.limit);
    const out: AuditEntry[] = [];
    for (let i = this.rows.length - 1; i >= 0 && out.length < limit; i -= 1) {
      const row = this.rows[i];
      if (row.tenantId !== query.tenantId) continue;
      if (query.beforeId !== undefined && row.id >= query.beforeId) continue;
      if (query.userId !== undefined && row.userId !== query.userId) continue;
      if (query.workspaceId !== undefined && row.workspaceId !== query.workspaceId) continue;
      if (query.commandId !== undefined && row.commandId !== query.commandId) continue;
      if (query.action !== undefined && row.action !== query.action) continue;
      if (query.decision !== undefined && row.decision !== query.decision) continue;
      out.push({ ...row });
    }
    return out;
  }

  /** Number of recorded entries (test helper). */
  get size(): number {
    return this.rows.length;
  }
}
