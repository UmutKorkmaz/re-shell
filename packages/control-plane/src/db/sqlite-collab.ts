import { randomUUID } from 'node:crypto';

import type { CollabAnalytics, CollabEventEnvelope, CollabSnapshot, TextOp } from '@re-shell/contracts';
import {
  OtError,
  applyOp,
  isNoop,
  isWellFormedText,
  normalizeOp,
  opBaseLength,
  transformOps,
} from '@re-shell/contracts';

import type { Job } from './sqlite-jobs.js';
import { SqliteJobStore, TERMINAL_STATUSES } from './sqlite-jobs.js';
import { DatabaseSync, Row, StatementSync, transaction } from './sqlite.js';

/**
 * Durable store for shared sessions (docs/control-plane.md, "Collaboration").
 *
 * Every table is keyed tenant-first and every statement binds `tenant_id` as its
 * first predicate, exactly like the tenant and job stores: a session id from
 * another tenant is indistinguishable from one that does not exist.
 *
 * The heart of it is `collab_events`: an append-only log with a per-session
 * sequence number. Each mutating method updates the materialized tables
 * (participants, documents, runs) AND appends its events inside ONE transaction
 * and returns the events, so
 *
 *     snapshot(seq N)  ==  fold(events 1..N)
 *
 * holds at every commit, and a reader that takes a snapshot and then subscribes
 * (synchronously, with no await in between) cannot miss or double-see an event.
 * Callers publish the returned events to live streams only AFTER commit.
 */

export const MAX_SESSION_EVENTS = 200_000;
export const MAX_PARTICIPANTS_PER_SESSION = 50;
export const MAX_DOCS_PER_SESSION = 8;
export const MAX_DOC_CHARS = 256 * 1024;
/** A client more than this many revisions behind must resync instead of rebasing. */
export const MAX_REBASE_DISTANCE = 10_000;
export const DEFAULT_NOTES_DOC_ID = 'notes';

export interface CollabSessionRow {
  tenantId: string;
  id: string;
  workspaceId: string;
  title: string;
  ownerId: string;
  driverId: string | null;
  status: 'active' | 'ended';
  seq: number;
  createdAt: number;
  endedAt: number | null;
  endedBy: string | null;
}

export interface CollabRunRow {
  tenantId: string;
  sessionId: string;
  jobId: string;
  commandId: string;
  params: Record<string, unknown>;
  requestedBy: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  exitCode: number | null;
  errorCode: string | null;
  queuedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  forwardedSeq: number;
}

export interface CollabSessionListItem extends CollabSessionRow {
  participantCount: number;
  runCount: number;
}

export type StoreFailure =
  | 'SESSION_NOT_FOUND'
  | 'SESSION_ENDED'
  | 'SESSION_BUSY'
  | 'PARTICIPANT_NOT_FOUND'
  | 'DOCUMENT_NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'LOG_FULL'
  | 'TOO_MANY'
  | 'INVALID_OP'
  | 'STALE_BASE'
  | 'FUTURE_BASE'
  | 'TOO_LARGE';

export type StoreResult<T> =
  | { ok: true; value: T; events: CollabEventEnvelope[] }
  | { ok: false; failure: StoreFailure; message: string };

const fail = (failure: StoreFailure, message: string): { ok: false; failure: StoreFailure; message: string } => ({
  ok: false,
  failure,
  message,
});

/** Thrown inside a transaction to roll it back and surface a typed failure. */
class Abort extends Error {
  constructor(readonly result: { ok: false; failure: StoreFailure; message: string }) {
    super(result.message);
  }
}

/** Inserted minus deleted characters of an op. */
function netLengthChange(op: TextOp): number {
  let net = 0;
  for (const c of op) {
    if (typeof c === 'string') net += c.length;
    else if (c < 0) net += c;
  }
  return net;
}

function sessionFromRow(row: Row): CollabSessionRow {
  return {
    tenantId: String(row.tenant_id),
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    title: String(row.title),
    ownerId: String(row.owner_id),
    driverId: (row.driver_id as string | null) ?? null,
    status: row.status as 'active' | 'ended',
    seq: Number(row.seq),
    createdAt: Number(row.created_at),
    endedAt: row.ended_at === null ? null : Number(row.ended_at),
    endedBy: (row.ended_by as string | null) ?? null,
  };
}

function runFromRow(row: Row): CollabRunRow {
  return {
    tenantId: String(row.tenant_id),
    sessionId: String(row.session_id),
    jobId: String(row.job_id),
    commandId: String(row.command_id),
    params: JSON.parse(String(row.params)) as Record<string, unknown>,
    requestedBy: String(row.requested_by),
    status: row.status as CollabRunRow['status'],
    exitCode: row.exit_code === null ? null : Number(row.exit_code),
    errorCode: (row.error_code as string | null) ?? null,
    queuedAt: Number(row.queued_at),
    startedAt: row.started_at === null ? null : Number(row.started_at),
    finishedAt: row.finished_at === null ? null : Number(row.finished_at),
    forwardedSeq: Number(row.forwarded_seq),
  };
}

function eventFromRow(row: Row): CollabEventEnvelope {
  return {
    seq: Number(row.seq),
    type: String(row.type),
    ts: Number(row.ts),
    actor: (row.actor as string | null) ?? null,
    data: JSON.parse(String(row.data)) as Record<string, unknown>,
  };
}

const SESSION_COLUMNS =
  'tenant_id, id, workspace_id, title, owner_id, driver_id, status, seq, created_at, ended_at, ended_by';
const RUN_COLUMNS = `tenant_id, session_id, job_id, command_id, params, requested_by, status, exit_code,
  error_code, queued_at, started_at, finished_at, forwarded_seq`;

interface AppendExtra {
  ref?: string;
  refSeq?: number;
  clientId?: string;
  clientSeq?: number;
}

export interface DocOpInput {
  clientId: string;
  clientSeq: number;
  baseRev: number;
  ops: TextOp;
  by: string;
  now: number;
}

export interface DocOpApplied {
  docId: string;
  rev: number;
  /** The op as committed (transformed over concurrent ops, canonical form). */
  ops: TextOp;
  /** True when this exact (clientId, clientSeq) had already been committed. */
  duplicate: boolean;
  seq: number;
}

export class SqliteCollabStore {
  private readonly s: Record<string, StatementSync>;

  constructor(private readonly db: DatabaseSync) {
    this.s = {
      insertSession: db.prepare(
        `INSERT INTO collab_sessions (tenant_id, id, workspace_id, title, owner_id, driver_id, status, seq, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', 0, ?)`
      ),
      countActive: db.prepare(
        "SELECT COUNT(*) AS n FROM collab_sessions WHERE tenant_id = ? AND status = 'active'"
      ),
      getSession: db.prepare(`SELECT ${SESSION_COLUMNS} FROM collab_sessions WHERE tenant_id = ? AND id = ?`),
      listSessions: db.prepare(
        `SELECT ${SESSION_COLUMNS},
                (SELECT COUNT(*) FROM collab_participants p
                  WHERE p.tenant_id = s.tenant_id AND p.session_id = s.id AND p.left_at IS NULL) AS participant_count,
                (SELECT COUNT(*) FROM collab_runs r
                  WHERE r.tenant_id = s.tenant_id AND r.session_id = s.id) AS run_count
           FROM collab_sessions s
          WHERE s.tenant_id = ?1 AND (?2 IS NULL OR s.status = ?2) AND (?3 IS NULL OR s.workspace_id = ?3)
          ORDER BY s.created_at DESC, s.rowid DESC LIMIT ?4`
      ),
      setSeq: db.prepare('UPDATE collab_sessions SET seq = ? WHERE tenant_id = ? AND id = ?'),
      setDriver: db.prepare('UPDATE collab_sessions SET driver_id = ? WHERE tenant_id = ? AND id = ?'),
      endSession: db.prepare(
        "UPDATE collab_sessions SET status = 'ended', ended_at = ?, ended_by = ? WHERE tenant_id = ? AND id = ?"
      ),
      insertEvent: db.prepare(
        `INSERT INTO collab_events (tenant_id, session_id, seq, type, ts, actor, data, ref, ref_seq, client_id, client_seq)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
      eventsAfter: db.prepare(
        `SELECT seq, type, ts, actor, data FROM collab_events
          WHERE tenant_id = ? AND session_id = ? AND seq > ? ORDER BY seq LIMIT ?`
      ),
      getParticipant: db.prepare(
        'SELECT user_id, joined_at, left_at FROM collab_participants WHERE tenant_id = ? AND session_id = ? AND user_id = ?'
      ),
      insertParticipant: db.prepare(
        'INSERT INTO collab_participants (tenant_id, session_id, user_id, joined_at) VALUES (?, ?, ?, ?)'
      ),
      rejoinParticipant: db.prepare(
        'UPDATE collab_participants SET joined_at = ?, left_at = NULL WHERE tenant_id = ? AND session_id = ? AND user_id = ?'
      ),
      leaveParticipant: db.prepare(
        'UPDATE collab_participants SET left_at = ? WHERE tenant_id = ? AND session_id = ? AND user_id = ?'
      ),
      presentParticipants: db.prepare(
        `SELECT user_id, joined_at FROM collab_participants
          WHERE tenant_id = ? AND session_id = ? AND left_at IS NULL ORDER BY joined_at, rowid`
      ),
      countPresent: db.prepare(
        'SELECT COUNT(*) AS n FROM collab_participants WHERE tenant_id = ? AND session_id = ? AND left_at IS NULL'
      ),
      insertDoc: db.prepare(
        `INSERT INTO collab_docs (tenant_id, session_id, id, title, kind, content, rev, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
      ),
      getDoc: db.prepare(
        `SELECT id, title, kind, content, rev FROM collab_docs WHERE tenant_id = ? AND session_id = ? AND id = ?`
      ),
      listDocs: db.prepare(
        `SELECT id, title, kind, content, rev FROM collab_docs
          WHERE tenant_id = ? AND session_id = ? ORDER BY created_at, rowid`
      ),
      countDocs: db.prepare('SELECT COUNT(*) AS n FROM collab_docs WHERE tenant_id = ? AND session_id = ?'),
      updateDoc: db.prepare(
        'UPDATE collab_docs SET content = ?, rev = ?, updated_at = ? WHERE tenant_id = ? AND session_id = ? AND id = ?'
      ),
      docOpsAfter: db.prepare(
        `SELECT seq, type, ts, actor, data, ref_seq FROM collab_events
          WHERE tenant_id = ? AND session_id = ? AND type = 'doc.op' AND ref = ? AND ref_seq > ?
          ORDER BY ref_seq LIMIT ?`
      ),
      findClientOp: db.prepare(
        `SELECT seq, data, ref_seq FROM collab_events
          WHERE tenant_id = ? AND session_id = ? AND ref = ? AND client_id = ? AND client_seq = ?`
      ),
      insertRun: db.prepare(
        `INSERT INTO collab_runs (tenant_id, session_id, job_id, command_id, params, requested_by, status, queued_at)
         VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)`
      ),
      getRun: db.prepare(`SELECT ${RUN_COLUMNS} FROM collab_runs WHERE tenant_id = ? AND session_id = ? AND job_id = ?`),
      listRuns: db.prepare(
        `SELECT ${RUN_COLUMNS} FROM collab_runs WHERE tenant_id = ? AND session_id = ? ORDER BY queued_at, rowid`
      ),
      activeRun: db.prepare(
        `SELECT ${RUN_COLUMNS} FROM collab_runs
          WHERE tenant_id = ? AND session_id = ? AND status IN ('queued', 'running') LIMIT 1`
      ),
      openRuns: db.prepare(`SELECT ${RUN_COLUMNS} FROM collab_runs WHERE status IN ('queued', 'running')`),
      runByJob: db.prepare(
        `SELECT ${RUN_COLUMNS} FROM collab_runs WHERE tenant_id = ? AND job_id = ? LIMIT 1`
      ),
      markRunStarted: db.prepare(
        "UPDATE collab_runs SET status = 'running', started_at = ? WHERE tenant_id = ? AND session_id = ? AND job_id = ?"
      ),
      setForwarded: db.prepare(
        'UPDATE collab_runs SET forwarded_seq = ? WHERE tenant_id = ? AND session_id = ? AND job_id = ?'
      ),
      finishRun: db.prepare(
        `UPDATE collab_runs SET status = ?, exit_code = ?, error_code = ?, finished_at = ?
          WHERE tenant_id = ? AND session_id = ? AND job_id = ?`
      ),
      outputTail: db.prepare(
        `SELECT seq, ref_seq, data FROM collab_events
          WHERE tenant_id = ? AND session_id = ? AND type = 'command.output' AND ref = ? AND seq < ?
          ORDER BY seq DESC LIMIT ?`
      ),
    };
  }

  // ---- sessions ---------------------------------------------------------------

  private append(
    tenantId: string,
    sessionId: string,
    type: string,
    ts: number,
    actor: string | null,
    data: Record<string, unknown>,
    extra: AppendExtra = {},
    /** Bookkeeping that must always be recordable (a run's final state) may exceed the cap slightly. */
    overflow = false
  ): CollabEventEnvelope {
    const session = this.s.getSession.get(tenantId, sessionId) as Row | undefined;
    if (!session) {
      throw new Abort(fail('SESSION_NOT_FOUND', 'Session not found.'));
    }
    const seq = Number(session.seq) + 1;
    if (seq > MAX_SESSION_EVENTS + (overflow ? 1000 : 0)) {
      throw new Abort(fail('LOG_FULL', `The session log is full (${MAX_SESSION_EVENTS} events); start a new session.`));
    }
    this.s.setSeq.run(seq, tenantId, sessionId);
    this.s.insertEvent.run(
      tenantId,
      sessionId,
      seq,
      type,
      ts,
      actor,
      JSON.stringify(data),
      extra.ref ?? null,
      extra.refSeq ?? null,
      extra.clientId ?? null,
      extra.clientSeq ?? null
    );
    return { seq, type, ts, actor, data };
  }

  /** Run `fn` in a transaction; a thrown {@link Abort} rolls back and becomes a typed failure. */
  private tx<T>(fn: (events: CollabEventEnvelope[]) => T): StoreResult<T> {
    const events: CollabEventEnvelope[] = [];
    try {
      const value = transaction(this.db, () => fn(events));
      return { ok: true, value, events };
    } catch (error) {
      if (error instanceof Abort) {
        return error.result;
      }
      throw error;
    }
  }

  /** Start a session: the owner joins and drives, and a shared notes document exists. */
  createSession(input: {
    tenantId: string;
    workspaceId: string;
    title: string;
    ownerId: string;
    now: number;
    maxActive: number;
  }): StoreResult<CollabSessionRow> {
    return this.tx((events) => {
      const active = (this.s.countActive.get(input.tenantId) as { n: number }).n;
      if (active >= input.maxActive) {
        throw new Abort(fail('TOO_MANY', `This tenant already has ${input.maxActive} active sessions.`));
      }
      const id = randomUUID();
      this.s.insertSession.run(
        input.tenantId,
        id,
        input.workspaceId,
        input.title,
        input.ownerId,
        input.ownerId,
        input.now
      );
      events.push(
        this.append(input.tenantId, id, 'session.started', input.now, input.ownerId, {
          sessionId: id,
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
          title: input.title,
          ownerId: input.ownerId,
        })
      );
      this.s.insertDoc.run(input.tenantId, id, DEFAULT_NOTES_DOC_ID, 'Runbook / notes', 'notes', '', input.now, input.now);
      events.push(
        this.append(
          input.tenantId,
          id,
          'doc.created',
          input.now,
          input.ownerId,
          { docId: DEFAULT_NOTES_DOC_ID, title: 'Runbook / notes', kind: 'notes', content: '' },
          { ref: DEFAULT_NOTES_DOC_ID }
        )
      );
      this.s.insertParticipant.run(input.tenantId, id, input.ownerId, input.now);
      events.push(
        this.append(input.tenantId, id, 'participant.joined', input.now, input.ownerId, { userId: input.ownerId })
      );
      return this.mustSession(input.tenantId, id);
    });
  }

  getSession(tenantId: string, sessionId: string): CollabSessionRow | undefined {
    const row = this.s.getSession.get(tenantId, sessionId) as Row | undefined;
    return row ? sessionFromRow(row) : undefined;
  }

  private mustSession(tenantId: string, sessionId: string): CollabSessionRow {
    const session = this.getSession(tenantId, sessionId);
    if (!session) {
      throw new Error('Session vanished');
    }
    return session;
  }

  listSessions(
    tenantId: string,
    options: { status?: 'active' | 'ended'; workspaceId?: string; limit: number }
  ): CollabSessionListItem[] {
    const rows = this.s.listSessions.all(
      tenantId,
      options.status ?? null,
      options.workspaceId ?? null,
      options.limit
    ) as Row[];
    return rows.map((row) => ({
      ...sessionFromRow(row),
      participantCount: Number(row.participant_count),
      runCount: Number(row.run_count),
    }));
  }

  /** Current participants (present = not left), oldest joiner first. */
  participants(tenantId: string, sessionId: string): Array<{ userId: string; joinedAt: number }> {
    return (this.s.presentParticipants.all(tenantId, sessionId) as Row[]).map((row) => ({
      userId: String(row.user_id),
      joinedAt: Number(row.joined_at),
    }));
  }

  isParticipant(tenantId: string, sessionId: string, userId: string): boolean {
    const row = this.s.getParticipant.get(tenantId, sessionId, userId) as Row | undefined;
    return row !== undefined && row.left_at === null;
  }

  join(tenantId: string, sessionId: string, userId: string, now: number): StoreResult<CollabSessionRow> {
    return this.tx((events) => {
      const session = this.requireActive(tenantId, sessionId);
      const existing = this.s.getParticipant.get(tenantId, sessionId, userId) as Row | undefined;
      if (existing && existing.left_at === null) {
        return session;
      }
      const present = (this.s.countPresent.get(tenantId, sessionId) as { n: number }).n;
      if (present >= MAX_PARTICIPANTS_PER_SESSION) {
        throw new Abort(fail('TOO_MANY', `A session holds at most ${MAX_PARTICIPANTS_PER_SESSION} participants.`));
      }
      if (existing) {
        this.s.rejoinParticipant.run(now, tenantId, sessionId, userId);
      } else {
        this.s.insertParticipant.run(tenantId, sessionId, userId, now);
      }
      events.push(this.append(tenantId, sessionId, 'participant.joined', now, userId, { userId }));
      return this.mustSession(tenantId, sessionId);
    });
  }

  private requireActive(tenantId: string, sessionId: string): CollabSessionRow {
    const session = this.getSession(tenantId, sessionId);
    if (!session) {
      throw new Abort(fail('SESSION_NOT_FOUND', 'Session not found.'));
    }
    if (session.status !== 'active') {
      throw new Abort(fail('SESSION_ENDED', 'The session has ended.'));
    }
    return session;
  }

  /** Leave the session. A driver who leaves hands control back to the owner when the owner is present. */
  leave(tenantId: string, sessionId: string, userId: string, now: number): StoreResult<CollabSessionRow> {
    return this.tx((events) => {
      const session = this.requireActive(tenantId, sessionId);
      if (!this.isParticipant(tenantId, sessionId, userId)) {
        return session;
      }
      this.s.leaveParticipant.run(now, tenantId, sessionId, userId);
      events.push(this.append(tenantId, sessionId, 'participant.left', now, userId, { userId }));
      if (session.driverId === userId) {
        const ownerPresent = session.ownerId !== userId && this.isParticipant(tenantId, sessionId, session.ownerId);
        const next = ownerPresent ? session.ownerId : null;
        this.s.setDriver.run(next, tenantId, sessionId);
        events.push(
          this.append(tenantId, sessionId, 'control.handover', now, userId, {
            from: userId,
            to: next,
            by: userId,
            reason: 'driver-left',
          })
        );
      }
      return this.mustSession(tenantId, sessionId);
    });
  }

  /** Make `toUserId` (a present participant) the driver. The caller has already authorized `by`. */
  handover(
    tenantId: string,
    sessionId: string,
    toUserId: string,
    by: string,
    now: number
  ): StoreResult<CollabSessionRow> {
    return this.tx((events) => {
      const session = this.requireActive(tenantId, sessionId);
      if (!this.isParticipant(tenantId, sessionId, toUserId)) {
        throw new Abort(fail('PARTICIPANT_NOT_FOUND', 'The new driver has not joined the session.'));
      }
      this.s.setDriver.run(toUserId, tenantId, sessionId);
      events.push(
        this.append(tenantId, sessionId, 'control.handover', now, by, {
          from: session.driverId,
          to: toUserId,
          by,
          reason: 'handover',
        })
      );
      return this.mustSession(tenantId, sessionId);
    });
  }

  /** End the session. Refused while a command is queued or running. */
  end(tenantId: string, sessionId: string, by: string, now: number, reason?: string): StoreResult<CollabSessionRow> {
    return this.tx((events) => {
      this.requireActive(tenantId, sessionId);
      if (this.s.activeRun.get(tenantId, sessionId)) {
        throw new Abort(fail('SESSION_BUSY', 'A command is still queued or running; cancel it before ending the session.'));
      }
      this.s.endSession.run(now, by, tenantId, sessionId);
      events.push(
        this.append(tenantId, sessionId, 'session.ended', now, by, reason ? { by, reason } : { by })
      );
      return this.mustSession(tenantId, sessionId);
    });
  }

  // ---- events and snapshots -----------------------------------------------------

  eventsAfter(tenantId: string, sessionId: string, afterSeq: number, limit: number): CollabEventEnvelope[] {
    return (this.s.eventsAfter.all(tenantId, sessionId, afterSeq, limit) as Row[]).map(eventFromRow);
  }

  /**
   * The materialized state at the session's current sequence. `online` and `rtc`
   * are ephemeral and are filled in by the caller. Output older than
   * `outputBudgetBytes` (newest runs win) is left out and flagged `outputDropped`.
   */
  snapshot(
    tenantId: string,
    sessionId: string,
    outputBudgetBytes = 2 * 1024 * 1024
  ): Omit<CollabSnapshot, 'online' | 'rtc'> | undefined {
    const session = this.getSession(tenantId, sessionId);
    if (!session) return undefined;
    const participants = this.participants(tenantId, sessionId).map((p) => ({
      userId: p.userId,
      role: (p.userId === session.driverId ? 'driver' : 'viewer') as 'driver' | 'viewer',
      joinedAt: p.joinedAt,
    }));
    const runRows = (this.s.listRuns.all(tenantId, sessionId) as Row[]).map(runFromRow);
    let budget = outputBudgetBytes;
    const runs: CollabSnapshot['runs'] = new Array(runRows.length);
    for (let i = runRows.length - 1; i >= 0; i -= 1) {
      const run = runRows[i];
      const { chunks, dropped, bytes } = this.readOutputTail(tenantId, sessionId, run.jobId, session.seq, budget);
      budget = Math.max(0, budget - bytes);
      runs[i] = {
        jobId: run.jobId,
        commandId: run.commandId,
        params: run.params,
        requestedBy: run.requestedBy,
        status: run.status,
        exitCode: run.exitCode,
        errorCode: run.errorCode,
        queuedAt: run.queuedAt,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        output: chunks,
        ...(dropped ? { outputDropped: true } : {}),
      };
    }
    const docs = (this.s.listDocs.all(tenantId, sessionId) as Row[]).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      kind: row.kind as 'notes' | 'yaml-draft' | 'text',
      rev: Number(row.rev),
      content: String(row.content),
    }));
    let currentJobId: string | null = null;
    for (let i = runs.length - 1; i >= 0; i -= 1) {
      if (runs[i].status === 'queued' || runs[i].status === 'running') {
        currentJobId = runs[i].jobId;
        break;
      }
    }
    return {
      seq: session.seq,
      session: {
        id: session.id,
        tenantId: session.tenantId,
        workspaceId: session.workspaceId,
        title: session.title,
        ownerId: session.ownerId,
        driverId: session.driverId,
        status: session.status,
        createdAt: session.createdAt,
        endedAt: session.endedAt,
      },
      participants,
      runs,
      currentJobId,
      docs,
    };
  }

  /** The newest output chunks of one run that fit `budget` bytes, oldest first. */
  private readOutputTail(
    tenantId: string,
    sessionId: string,
    jobId: string,
    beforeSeq: number,
    budget: number
  ): { chunks: CollabSnapshot['runs'][number]['output']; dropped: boolean; bytes: number } {
    const collected: Array<{ seq: number; stream: 'stdout' | 'stderr'; data: string }> = [];
    let bytes = 0;
    let cursor = beforeSeq + 1;
    let dropped = false;
    for (;;) {
      const page = this.s.outputTail.all(tenantId, sessionId, jobId, cursor, 500) as Row[];
      if (page.length === 0) break;
      for (const row of page) {
        const payload = JSON.parse(String(row.data)) as { stream: 'stdout' | 'stderr'; data: string };
        const size = Buffer.byteLength(payload.data, 'utf8');
        if (bytes + size > budget) {
          dropped = true;
          break;
        }
        bytes += size;
        collected.push({ seq: Number(row.ref_seq), stream: payload.stream, data: payload.data });
      }
      if (dropped) break;
      cursor = Number(page[page.length - 1].seq);
      if (page.length < 500) break;
    }
    collected.reverse();
    return { chunks: collected, dropped, bytes };
  }

  // ---- command runs ---------------------------------------------------------------

  activeRun(tenantId: string, sessionId: string): CollabRunRow | undefined {
    const row = this.s.activeRun.get(tenantId, sessionId) as Row | undefined;
    return row ? runFromRow(row) : undefined;
  }

  getRun(tenantId: string, sessionId: string, jobId: string): CollabRunRow | undefined {
    const row = this.s.getRun.get(tenantId, sessionId, jobId) as Row | undefined;
    return row ? runFromRow(row) : undefined;
  }

  /** Every run that has not finished, across tenants (restart recovery). */
  openRuns(): CollabRunRow[] {
    return (this.s.openRuns.all() as Row[]).map(runFromRow);
  }

  /** The session run that owns `jobId`, if any (tenant-scoped). */
  runForJob(tenantId: string, jobId: string): CollabRunRow | undefined {
    const row = this.s.runByJob.get(tenantId, jobId) as Row | undefined;
    return row ? runFromRow(row) : undefined;
  }

  /** Record a queued job as the session's current run. */
  startRun(
    tenantId: string,
    sessionId: string,
    job: Pick<Job, 'id' | 'commandId' | 'params' | 'requestedBy'>,
    now: number
  ): StoreResult<CollabRunRow> {
    return this.tx((events) => {
      this.requireActive(tenantId, sessionId);
      this.s.insertRun.run(
        tenantId,
        sessionId,
        job.id,
        job.commandId,
        JSON.stringify(job.params),
        job.requestedBy,
        now
      );
      events.push(
        this.append(
          tenantId,
          sessionId,
          'command.queued',
          now,
          job.requestedBy,
          { jobId: job.id, commandId: job.commandId, params: job.params, requestedBy: job.requestedBy },
          { ref: job.id }
        )
      );
      const row = this.s.getRun.get(tenantId, sessionId, job.id) as Row;
      return runFromRow(row);
    });
  }

  /**
   * Bring a run's console state up to date with its job: log `command.started`,
   * every output chunk not yet forwarded, and `command.finished`. Idempotent and
   * safe to call at any time or from several triggers; each call is one
   * transaction, so the events it returns are contiguous and ordered.
   */
  pumpRun(tenantId: string, sessionId: string, jobId: string, jobs: SqliteJobStore, now: number): CollabEventEnvelope[] {
    const result = this.tx((events) => {
      const run = this.getRun(tenantId, sessionId, jobId);
      if (!run || run.status === 'succeeded' || run.status === 'failed' || run.status === 'canceled') {
        return;
      }
      const job = jobs.get(tenantId, jobId);
      if (!job || job.status === 'queued') {
        return;
      }
      const startedBy = job.workerId ? `worker:${job.workerId}` : null;
      // A job that failed or was canceled while still queued never started.
      if (run.status === 'queued' && (job.status === 'running' || job.startedAt !== null)) {
        const startedAt = job.startedAt ?? now;
        this.s.markRunStarted.run(startedAt, tenantId, sessionId, jobId);
        events.push(this.append(tenantId, sessionId, 'command.started', startedAt, startedBy, { jobId }, { ref: jobId }, true));
      }
      let forwarded = run.forwardedSeq;
      let logFull = false;
      for (;;) {
        const chunks = jobs.readOutput(tenantId, jobId, forwarded, 200);
        for (const chunk of chunks) {
          if (!logFull) {
            try {
              events.push(
                this.append(
                  tenantId,
                  sessionId,
                  'command.output',
                  chunk.ts,
                  null,
                  { jobId, chunkSeq: chunk.seq, stream: chunk.stream, data: chunk.data },
                  { ref: jobId, refSeq: chunk.seq }
                )
              );
            } catch (error) {
              // A full log stops recording OUTPUT (it is still in the job's own log), but the run's
              // lifecycle events must still land or the console would show it running forever.
              if (error instanceof Abort && error.result.failure === 'LOG_FULL') {
                logFull = true;
              } else {
                throw error;
              }
            }
          }
          forwarded = chunk.seq;
        }
        if (chunks.length < 200) break;
      }
      if (forwarded !== run.forwardedSeq) {
        this.s.setForwarded.run(forwarded, tenantId, sessionId, jobId);
      }
      if (TERMINAL_STATUSES.has(job.status)) {
        const status = job.status as 'succeeded' | 'failed' | 'canceled';
        const finishedAt = job.finishedAt ?? now;
        this.s.finishRun.run(status, job.exitCode, job.errorCode, finishedAt, tenantId, sessionId, jobId);
        events.push(
          this.append(
            tenantId,
            sessionId,
            'command.finished',
            finishedAt,
            null,
            { jobId, status, exitCode: job.exitCode, errorCode: job.errorCode },
            { ref: jobId },
            true
          )
        );
      }
    });
    return result.ok ? result.events : [];
  }

  // ---- documents --------------------------------------------------------------------

  getDoc(tenantId: string, sessionId: string, docId: string): CollabSnapshot['docs'][number] | undefined {
    const row = this.s.getDoc.get(tenantId, sessionId, docId) as Row | undefined;
    return row
      ? {
          id: String(row.id),
          title: String(row.title),
          kind: row.kind as 'notes' | 'yaml-draft' | 'text',
          rev: Number(row.rev),
          content: String(row.content),
        }
      : undefined;
  }

  listDocs(tenantId: string, sessionId: string): CollabSnapshot['docs'] {
    return (this.s.listDocs.all(tenantId, sessionId) as Row[]).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      kind: row.kind as 'notes' | 'yaml-draft' | 'text',
      rev: Number(row.rev),
      content: String(row.content),
    }));
  }

  createDoc(
    tenantId: string,
    sessionId: string,
    doc: { id: string; title: string; kind: 'notes' | 'yaml-draft' | 'text'; content: string },
    by: string,
    now: number
  ): StoreResult<CollabSnapshot['docs'][number]> {
    return this.tx((events) => {
      this.requireActive(tenantId, sessionId);
      if (this.s.getDoc.get(tenantId, sessionId, doc.id)) {
        throw new Abort(fail('ALREADY_EXISTS', `A document named "${doc.id}" already exists.`));
      }
      if ((this.s.countDocs.get(tenantId, sessionId) as { n: number }).n >= MAX_DOCS_PER_SESSION) {
        throw new Abort(fail('TOO_MANY', `A session holds at most ${MAX_DOCS_PER_SESSION} documents.`));
      }
      if (doc.content.length > MAX_DOC_CHARS || !isWellFormedText(doc.content)) {
        throw new Abort(fail('TOO_LARGE', 'The initial content is too large or not well-formed text.'));
      }
      this.s.insertDoc.run(tenantId, sessionId, doc.id, doc.title, doc.kind, doc.content, now, now);
      events.push(
        this.append(
          tenantId,
          sessionId,
          'doc.created',
          now,
          by,
          { docId: doc.id, title: doc.title, kind: doc.kind, content: doc.content },
          { ref: doc.id }
        )
      );
      return this.getDoc(tenantId, sessionId, doc.id) as CollabSnapshot['docs'][number];
    });
  }

  /** Committed ops of one document with revision greater than `afterRev`. */
  docOpsAfter(
    tenantId: string,
    sessionId: string,
    docId: string,
    afterRev: number,
    limit: number
  ): Array<{ rev: number; seq: number; ts: number; actor: string | null; ops: TextOp; clientId: string; clientSeq: number }> {
    return (this.s.docOpsAfter.all(tenantId, sessionId, docId, afterRev, limit) as Row[]).map((row) => {
      const data = JSON.parse(String(row.data)) as { ops: TextOp; clientId: string; clientSeq: number };
      return {
        rev: Number(row.ref_seq),
        seq: Number(row.seq),
        ts: Number(row.ts),
        actor: (row.actor as string | null) ?? null,
        ops: data.ops,
        clientId: data.clientId,
        clientSeq: data.clientSeq,
      };
    });
  }

  /**
   * Commit a client op against a document: transform it over every op committed
   * since `baseRev` (committed ops win ties), apply it, assign the next revision
   * and log it. A retry of the same (clientId, clientSeq) returns the original
   * result instead of applying twice. The caller has already authorized `by`.
   */
  applyDocOp(tenantId: string, sessionId: string, docId: string, input: DocOpInput): StoreResult<DocOpApplied> {
    return this.tx((events) => {
      this.requireActive(tenantId, sessionId);
      const duplicate = this.s.findClientOp.get(tenantId, sessionId, docId, input.clientId, input.clientSeq) as
        | Row
        | undefined;
      if (duplicate) {
        const data = JSON.parse(String(duplicate.data)) as { ops: TextOp };
        return {
          docId,
          rev: Number(duplicate.ref_seq),
          ops: data.ops,
          duplicate: true,
          seq: Number(duplicate.seq),
        };
      }
      const doc = this.getDoc(tenantId, sessionId, docId);
      if (!doc) {
        throw new Abort(fail('DOCUMENT_NOT_FOUND', 'Document not found in this session.'));
      }
      if (input.baseRev > doc.rev) {
        throw new Abort(fail('FUTURE_BASE', `baseRev ${input.baseRev} is ahead of the document (rev ${doc.rev}).`));
      }
      if (doc.rev - input.baseRev > MAX_REBASE_DISTANCE) {
        throw new Abort(fail('STALE_BASE', 'The client is too far behind to rebase; reload the document.'));
      }
      let op: TextOp = input.ops;
      try {
        // Length of the document the client edited (as of baseRev): today's length minus the net
        // effect of every op committed since. An op that spans more than that is malformed.
        let lengthAtBase = doc.content.length;
        const concurrent: TextOp[] = [];
        for (let cursor = input.baseRev; ; ) {
          const batch = this.docOpsAfter(tenantId, sessionId, docId, cursor, 500);
          for (const committed of batch) {
            concurrent.push(committed.ops);
            lengthAtBase -= netLengthChange(committed.ops);
            cursor = committed.rev;
          }
          if (batch.length < 500) break;
        }
        if (opBaseLength(input.ops) > lengthAtBase) {
          throw new Abort(
            fail('INVALID_OP', `The operation spans ${opBaseLength(input.ops)} characters but the document at rev ${input.baseRev} has ${lengthAtBase}.`)
          );
        }
        for (const committed of concurrent) {
          op = transformOps(committed, op)[1];
        }
        const normalized = normalizeOp(op);
        const content = applyOp(doc.content, normalized);
        if (content.length > MAX_DOC_CHARS) {
          throw new Abort(fail('TOO_LARGE', `A document may hold at most ${MAX_DOC_CHARS} characters.`));
        }
        if (!isWellFormedText(content)) {
          throw new Abort(fail('INVALID_OP', 'The edit would leave a split surrogate pair.'));
        }
        const rev = doc.rev + 1;
        this.s.updateDoc.run(content, rev, input.now, tenantId, sessionId, docId);
        const event = this.append(
          tenantId,
          sessionId,
          'doc.op',
          input.now,
          input.by,
          { docId, rev, ops: normalized, clientId: input.clientId, clientSeq: input.clientSeq },
          { ref: docId, refSeq: rev, clientId: input.clientId, clientSeq: input.clientSeq }
        );
        events.push(event);
        return { docId, rev, ops: normalized, duplicate: false, seq: event.seq };
      } catch (error) {
        if (error instanceof OtError) {
          throw new Abort(fail('INVALID_OP', error.message));
        }
        throw error;
      }
    });
  }

  /** True when the op is structurally a no-op (used to reject pointless client sends). */
  static isNoop(op: TextOp): boolean {
    return isNoop(op);
  }

  // ---- analytics ----------------------------------------------------------------------

  analytics(input: {
    tenantId: string;
    from: number;
    to: number;
    now: number;
    workspaceId?: string;
  }): CollabAnalytics {
    const { tenantId, from, to, now } = input;
    const workspace = input.workspaceId ?? null;

    type Counts = { total: number; succeeded: number; failed: number; canceled: number };
    const blank = (): Counts => ({ total: 0, succeeded: 0, failed: 0, canceled: 0 });
    const bump = (counts: Counts, status: string, n: number): void => {
      counts.total += n;
      if (status === 'succeeded') counts.succeeded += n;
      else if (status === 'failed') counts.failed += n;
      else if (status === 'canceled') counts.canceled += n;
    };

    const jobRows = this.db
      .prepare(
        `SELECT requested_by, workspace_id, command_id, status, COUNT(*) AS n FROM jobs
          WHERE tenant_id = ? AND created_at >= ? AND created_at < ? AND (? IS NULL OR workspace_id = ?)
          GROUP BY requested_by, workspace_id, command_id, status`
      )
      .all(tenantId, from, to, workspace, workspace) as Row[];
    const total = blank();
    let active = 0;
    const byUser = new Map<string, Counts>();
    const byWorkspace = new Map<string, Counts>();
    const byCommand = new Map<string, Counts>();
    const group = (map: Map<string, Counts>, key: string): Counts => {
      let counts = map.get(key);
      if (!counts) {
        counts = blank();
        map.set(key, counts);
      }
      return counts;
    };
    for (const row of jobRows) {
      const n = Number(row.n);
      const status = String(row.status);
      bump(total, status, n);
      if (status === 'queued' || status === 'running') active += n;
      bump(group(byUser, String(row.requested_by)), status, n);
      bump(group(byWorkspace, String(row.workspace_id)), status, n);
      bump(group(byCommand, String(row.command_id)), status, n);
    }
    const finished = total.succeeded + total.failed;
    const ranked = <K extends string>(map: Map<string, Counts>, key: K): Array<Counts & Record<K, string>> =>
      Array.from(map.entries())
        .map(([id, counts]) => ({ [key]: id, ...counts }) as Counts & Record<K, string>)
        .sort((a, b) => b.total - a.total || String(a[key]).localeCompare(String(b[key])));

    const sessionRows = this.db
      .prepare(
        `SELECT s.id, s.workspace_id, s.created_at, s.ended_at, s.status,
                (SELECT COUNT(*) FROM collab_participants p WHERE p.tenant_id = s.tenant_id AND p.session_id = s.id) AS participants
           FROM collab_sessions s
          WHERE s.tenant_id = ? AND s.created_at >= ? AND s.created_at < ? AND (? IS NULL OR s.workspace_id = ?)`
      )
      .all(tenantId, from, to, workspace, workspace) as Row[];
    let totalDuration = 0;
    let maxDuration = 0;
    let participantTotal = 0;
    let activeSessions = 0;
    const sessionsByWorkspace = new Map<string, { sessions: number; totalDurationMs: number }>();
    for (const row of sessionRows) {
      const end = row.ended_at === null ? now : Number(row.ended_at);
      const duration = Math.max(0, end - Number(row.created_at));
      totalDuration += duration;
      maxDuration = Math.max(maxDuration, duration);
      participantTotal += Number(row.participants);
      if (row.status === 'active') activeSessions += 1;
      const key = String(row.workspace_id);
      const entry = sessionsByWorkspace.get(key) ?? { sessions: 0, totalDurationMs: 0 };
      entry.sessions += 1;
      entry.totalDurationMs += duration;
      sessionsByWorkspace.set(key, entry);
    }
    const distinct = (
      this.db
        .prepare(
          `SELECT COUNT(DISTINCT p.user_id) AS n FROM collab_participants p
             JOIN collab_sessions s ON s.tenant_id = p.tenant_id AND s.id = p.session_id
            WHERE s.tenant_id = ? AND s.created_at >= ? AND s.created_at < ? AND (? IS NULL OR s.workspace_id = ?)`
        )
        .get(tenantId, from, to, workspace, workspace) as { n: number }
    ).n;
    const sessionCommands = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS n FROM collab_runs r JOIN collab_sessions s
              ON s.tenant_id = r.tenant_id AND s.id = r.session_id
            WHERE r.tenant_id = ? AND r.queued_at >= ? AND r.queued_at < ? AND (? IS NULL OR s.workspace_id = ?)`
        )
        .get(tenantId, from, to, workspace, workspace) as { n: number }
    ).n;

    const auditRows = this.db
      .prepare(
        `SELECT action, decision, code, COUNT(*) AS n FROM audit_log
          WHERE tenant_id = ? AND ts >= ? AND ts < ? AND (? IS NULL OR workspace_id = ?)
          GROUP BY action, decision, code`
      )
      .all(tenantId, from, to, workspace, workspace) as Row[];
    let allowed = 0;
    let denied = 0;
    let authFailures = 0;
    const deniedByCode = new Map<string, number>();
    for (const row of auditRows) {
      const n = Number(row.n);
      if (row.action === 'auth.failed') authFailures += n;
      if (row.decision === 'allow') allowed += n;
      else {
        denied += n;
        const code = String(row.code ?? 'UNKNOWN');
        deniedByCode.set(code, (deniedByCode.get(code) ?? 0) + n);
      }
    }

    const span = Math.max(1, to - from);
    const STEPS = [60_000, 300_000, 900_000, 3_600_000, 6 * 3_600_000, 86_400_000];
    const bucketMs = STEPS.find((step) => span / step <= 120) ?? 86_400_000;
    const bucketCount = Math.min(400, Math.max(1, Math.ceil(span / bucketMs)));
    const buckets = Array.from({ length: bucketCount }, (_, i) => ({
      start: from + i * bucketMs,
      commands: 0,
      failed: 0,
      sessions: 0,
    }));
    const jobBuckets = this.db
      .prepare(
        `SELECT CAST((created_at - ?) / ? AS INTEGER) AS b, COUNT(*) AS n, SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
           FROM jobs WHERE tenant_id = ? AND created_at >= ? AND created_at < ? AND (? IS NULL OR workspace_id = ?)
          GROUP BY b`
      )
      .all(from, bucketMs, tenantId, from, to, workspace, workspace) as Row[];
    for (const row of jobBuckets) {
      const bucket = buckets[Math.min(bucketCount - 1, Number(row.b))];
      if (bucket) {
        bucket.commands += Number(row.n);
        bucket.failed += Number(row.failed);
      }
    }
    const sessionBuckets = this.db
      .prepare(
        `SELECT CAST((created_at - ?) / ? AS INTEGER) AS b, COUNT(*) AS n FROM collab_sessions
          WHERE tenant_id = ? AND created_at >= ? AND created_at < ? AND (? IS NULL OR workspace_id = ?)
          GROUP BY b`
      )
      .all(from, bucketMs, tenantId, from, to, workspace, workspace) as Row[];
    for (const row of sessionBuckets) {
      const bucket = buckets[Math.min(bucketCount - 1, Number(row.b))];
      if (bucket) bucket.sessions += Number(row.n);
    }

    return {
      tenantId,
      window: { from, to },
      generatedAt: now,
      commands: {
        total: total.total,
        succeeded: total.succeeded,
        failed: total.failed,
        canceled: total.canceled,
        active,
        successRate: finished === 0 ? null : total.succeeded / finished,
        byUser: ranked(byUser, 'userId'),
        byWorkspace: ranked(byWorkspace, 'workspaceId'),
        byCommand: ranked(byCommand, 'commandId'),
      },
      sessions: {
        started: sessionRows.length,
        active: activeSessions,
        ended: sessionRows.length - activeSessions,
        totalDurationMs: totalDuration,
        avgDurationMs: sessionRows.length === 0 ? null : totalDuration / sessionRows.length,
        maxDurationMs: maxDuration,
        distinctParticipants: distinct,
        avgParticipants: sessionRows.length === 0 ? null : participantTotal / sessionRows.length,
        commandsRun: sessionCommands,
        byWorkspace: Array.from(sessionsByWorkspace.entries())
          .map(([workspaceId, v]) => ({ workspaceId, ...v }))
          .sort((a, b) => b.sessions - a.sessions || a.workspaceId.localeCompare(b.workspaceId)),
      },
      audit: {
        allowed,
        denied,
        authFailures,
        deniedByCode: Array.from(deniedByCode.entries())
          .map(([code, count]) => ({ code, count }))
          .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
          .slice(0, 10),
      },
      timeline: { bucketMs, buckets },
    };
  }
}
