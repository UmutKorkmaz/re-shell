import type {
  CollabAnalytics,
  CollabEventEnvelope,
  CollabSessionSummary,
  CollabSnapshot,
  TextOp,
} from '@re-shell/contracts';
import { opBaseLength, validateOp } from '@re-shell/contracts';
import { z } from 'zod';

import type { AuditAction } from './audit.js';
import { Principal, Role, roleSatisfies } from './auth.js';
import { authorizeTenant, authorizeWorkspace } from './authz.js';
import type { CollabHub } from './collab-hub.js';
import {
  MAX_DOC_CHARS,
  type CollabSessionRow,
  type SqliteCollabStore,
  type StoreFailure,
} from './db/sqlite-collab.js';
import { ControlPlaneErrorCode, ControlPlaneResult, fail, ok } from './errors.js';
import { JobDeps, JobView, cancelJob, submitCommand } from './jobs.js';
import { authedRequest, nowOf, recordDecision } from './pipeline.js';
import { idSchema, userIdSchema } from './tenant.js';

/**
 * Collaboration handlers (docs/control-plane.md, "Collaboration").
 *
 * Same pipeline as every other handler: validate -> authenticate -> authorize ->
 * RECORD the decision -> act. Each handler's authorization is ONE chain (tenant
 * role, session lookup, driver/participant check) recorded as one audit entry,
 * allow or deny, before anything changes.
 *
 * Commands do not run here. `runCommand` hands the command to the existing job
 * path (`submitCommand`), so membership, the allow-list intersection, the audit
 * entry and the worker's own re-check all apply unchanged; the session only
 * links the resulting job to its ordered console.
 */

export interface CollabDeps extends JobDeps {
  collab: SqliteCollabStore;
  hub: CollabHub;
  maxActiveSessionsPerTenant?: number;
}

export const DEFAULT_MAX_ACTIVE_SESSIONS = 50;
/** Largest SDP / ICE / peer payload accepted (serialized JSON bytes). */
export const MAX_SIGNAL_BYTES = 16 * 1024;
export const MAX_RELAY_BYTES = 4 * 1024;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const sessionIdSchema = z.uuid();
const base = { token: z.string(), tenantId: idSchema };
const inSession = { ...base, sessionId: sessionIdSchema };

export const createSessionRequestSchema = z
  .object({
    ...base,
    workspaceId: idSchema,
    title: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export const listSessionsRequestSchema = z
  .object({
    ...base,
    status: z.enum(['active', 'ended']).optional(),
    workspaceId: idSchema.optional(),
    limit: z.number().int().min(1).max(200).optional(),
  })
  .strict();

export const sessionRequestSchema = z.object(inSession).strict();

export const runRequestSchema = z
  .object({
    ...inSession,
    commandId: idSchema,
    params: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const handoverRequestSchema = z.object({ ...inSession, toUserId: userIdSchema }).strict();

export const endRequestSchema = z
  .object({ ...inSession, reason: z.string().trim().min(1).max(200).optional() })
  .strict();

export const eventsRequestSchema = z
  .object({
    ...inSession,
    afterSeq: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(1000).default(200),
  })
  .strict();

const docIdSchema = idSchema.refine((id) => id.length <= 64, 'document id must be at most 64 characters');

export const createDocRequestSchema = z
  .object({
    ...inSession,
    docId: docIdSchema,
    title: z.string().trim().min(1).max(200),
    kind: z.enum(['notes', 'yaml-draft', 'text']).default('text'),
    content: z.string().max(32 * 1024).default(''),
  })
  .strict();

export const docRequestSchema = z.object({ ...inSession, docId: docIdSchema }).strict();

export const docOpRequestSchema = z
  .object({
    ...inSession,
    docId: docIdSchema,
    clientId: z.string().min(1).max(64),
    clientSeq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    baseRev: z.number().int().min(0),
    ops: z.array(z.union([z.number(), z.string()])).max(4096),
  })
  .strict();

export const docOpsRequestSchema = z
  .object({
    ...inSession,
    docId: docIdSchema,
    afterRev: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(1000).default(200),
  })
  .strict();

export const signalRequestSchema = z
  .object({
    ...inSession,
    to: userIdSchema,
    kind: z.enum(['offer', 'answer', 'candidate', 'bye']),
    connectionId: z.string().min(1).max(64),
    payload: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const relayRequestSchema = z
  .object({
    ...inSession,
    to: userIdSchema.nullable().default(null),
    channel: z.enum(['presence', 'cursor', 'ping']),
    payload: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

const MAX_WINDOW_MS = 366 * 24 * 3_600_000;

export const analyticsRequestSchema = z
  .object({
    ...base,
    from: z.number().int().min(0).optional(),
    to: z.number().int().min(0).optional(),
    workspaceId: idSchema.optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const FAILURE_CODES: Record<StoreFailure, ControlPlaneErrorCode> = {
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_ENDED: 'SESSION_ENDED',
  SESSION_BUSY: 'SESSION_BUSY',
  PARTICIPANT_NOT_FOUND: 'PARTICIPANT_NOT_FOUND',
  DOCUMENT_NOT_FOUND: 'DOCUMENT_NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  LOG_FULL: 'CONFLICT',
  TOO_MANY: 'RATE_LIMITED',
  INVALID_OP: 'INVALID_REQUEST',
  STALE_BASE: 'CONFLICT',
  FUTURE_BASE: 'INVALID_REQUEST',
  TOO_LARGE: 'PAYLOAD_TOO_LARGE',
};

function storeFailure(failure: StoreFailure, message: string, extra?: Record<string, unknown>): ControlPlaneResult<never> {
  return fail(FAILURE_CODES[failure], message, { reason: failure, ...extra });
}

interface Chain {
  principal: Principal;
  role: Role;
  session: CollabSessionRow;
}

/** Tenant membership (>= minRole) then the tenant-scoped session lookup. */
function resolveSession(
  deps: CollabDeps,
  principal: Principal,
  tenantId: string,
  sessionId: string,
  minRole: Role = 'operator'
): ControlPlaneResult<Chain> {
  const authorized = authorizeTenant(deps.store, principal, tenantId, minRole);
  if (!authorized.ok) {
    return authorized;
  }
  // Tenant-first lookup: another tenant's session id is simply "not found".
  const session = deps.collab.getSession(authorized.data.tenant.id, sessionId);
  if (!session) {
    return fail('SESSION_NOT_FOUND', 'Session not found in this tenant.', { sessionId });
  }
  return ok({ principal, role: authorized.data.role, session });
}

function decide<T>(
  deps: CollabDeps,
  principal: Principal,
  action: AuditAction,
  tenantId: string,
  chain: ControlPlaneResult<T>,
  extra: { workspaceId?: string | null; commandId?: string | null; detail?: Record<string, unknown> } = {}
): ControlPlaneResult<T> {
  return recordDecision(
    deps,
    principal,
    { action, tenantId, workspaceId: extra.workspaceId ?? null, commandId: extra.commandId ?? null, detail: extra.detail },
    chain
  );
}

/**
 * Document edits, signaling and relays are high-frequency. Every DENY is
 * audited; an ALLOW is audited the first time a user does that action in a
 * session (per process) — individual document ops are in the session log
 * itself, with their author. Decisions that fail to record still fail closed.
 */
const sampledAllows = new Map<string, number>();
const SAMPLE_CACHE_LIMIT = 10_000;

function decideSampled<T>(
  deps: CollabDeps,
  principal: Principal,
  action: AuditAction,
  tenantId: string,
  sessionId: string,
  chain: ControlPlaneResult<T>,
  extra: { workspaceId?: string | null; detail?: Record<string, unknown> } = {}
): ControlPlaneResult<T> {
  if (chain.ok) {
    const key = `${action}\u0000${tenantId}\u0000${sessionId}\u0000${principal.userId}`;
    if (sampledAllows.has(key)) {
      return chain;
    }
    const recorded = decide(deps, principal, action, tenantId, chain, {
      ...extra,
      detail: { sessionId, ...(extra.detail ?? {}) },
    });
    if (recorded.ok) {
      if (sampledAllows.size >= SAMPLE_CACHE_LIMIT) {
        sampledAllows.clear();
      }
      sampledAllows.set(key, 1);
    }
    return recorded;
  }
  return decide(deps, principal, action, tenantId, chain, {
    ...extra,
    detail: { sessionId, ...(extra.detail ?? {}) },
  });
}

function snapshotOf(deps: CollabDeps, session: CollabSessionRow): ControlPlaneResult<CollabSnapshot> {
  const snapshot = deps.hub.snapshot(session.tenantId, session.id);
  return snapshot ? ok(snapshot) : fail('SESSION_NOT_FOUND', 'Session not found in this tenant.');
}

function publish(deps: CollabDeps, tenantId: string, sessionId: string, events: readonly CollabEventEnvelope[]): void {
  deps.hub.publish(tenantId, sessionId, events);
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

/** POST /tenants/:t/sessions — start a shared session in a workspace (operator). The caller owns and drives it. */
export function createSession(deps: CollabDeps, body: unknown): ControlPlaneResult<{ session: CollabSnapshot }> {
  const req = authedRequest(deps, createSessionRequestSchema, body, 'session.create');
  if (!req.ok) return req;
  const { principal, input } = req.data;
  const chain = ((): ControlPlaneResult<true> => {
    const tenant = authorizeTenant(deps.store, principal, input.tenantId, 'operator');
    if (!tenant.ok) return tenant;
    const workspace = authorizeWorkspace(deps.store, tenant.data, input.workspaceId);
    return workspace.ok ? ok(true) : workspace;
  })();
  const decided = decide(deps, principal, 'session.create', input.tenantId, chain, {
    workspaceId: input.workspaceId,
  });
  if (!decided.ok) return decided;

  const created = deps.collab.createSession({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    title: input.title ?? `Session in ${input.workspaceId}`,
    ownerId: principal.userId,
    now: nowOf(deps),
    maxActive: deps.maxActiveSessionsPerTenant ?? DEFAULT_MAX_ACTIVE_SESSIONS,
  });
  if (!created.ok) {
    return storeFailure(created.failure, created.message);
  }
  publish(deps, input.tenantId, created.value.id, created.events);
  const snapshot = snapshotOf(deps, created.value);
  return snapshot.ok ? ok({ session: snapshot.data }) : snapshot;
}

/** GET /tenants/:t/sessions — sessions of the tenant, newest first (operator). */
export function listSessions(
  deps: CollabDeps,
  body: unknown
): ControlPlaneResult<{ sessions: CollabSessionSummary[] }> {
  const req = authedRequest(deps, listSessionsRequestSchema, body, 'session.list');
  if (!req.ok) return req;
  const { principal, input } = req.data;
  const decided = decide(deps, principal, 'session.list', input.tenantId, authorizeTenant(deps.store, principal, input.tenantId, 'operator'));
  if (!decided.ok) return decided;
  const rows = deps.collab.listSessions(input.tenantId, {
    status: input.status,
    workspaceId: input.workspaceId,
    limit: input.limit ?? 50,
  });
  return ok({
    sessions: rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      workspaceId: row.workspaceId,
      title: row.title,
      ownerId: row.ownerId,
      driverId: row.driverId,
      status: row.status,
      createdAt: row.createdAt,
      endedAt: row.endedAt,
      participantCount: row.participantCount,
      onlineCount: deps.hub.onlineCount(row.tenantId, row.id),
      runCount: row.runCount,
    })),
  });
}

/** GET /tenants/:t/sessions/:s — the full current state (operator). Reading does not join. */
export function getSession(deps: CollabDeps, body: unknown): ControlPlaneResult<{ session: CollabSnapshot }> {
  const req = authedRequest(deps, sessionRequestSchema, body, 'session.read');
  if (!req.ok) return req;
  const { principal, input } = req.data;
  const chain = resolveSession(deps, principal, input.tenantId, input.sessionId);
  const decided = decide(deps, principal, 'session.read', input.tenantId, chain, {
    workspaceId: chain.ok ? chain.data.session.workspaceId : null,
    detail: { sessionId: input.sessionId },
  });
  if (!decided.ok) return decided;
  const snapshot = snapshotOf(deps, decided.data.session);
  return snapshot.ok ? ok({ session: snapshot.data }) : snapshot;
}

/** POST /tenants/:t/sessions/:s/join — become a participant (operator). New participants watch; they do not drive. */
export function joinSession(deps: CollabDeps, body: unknown): ControlPlaneResult<{ session: CollabSnapshot }> {
  const req = authedRequest(deps, sessionRequestSchema, body, 'session.join');
  if (!req.ok) return req;
  const { principal, input } = req.data;
  const chain = ((): ControlPlaneResult<Chain> => {
    const resolved = resolveSession(deps, principal, input.tenantId, input.sessionId);
    if (!resolved.ok) return resolved;
    if (resolved.data.session.status !== 'active') {
      return fail('SESSION_ENDED', 'The session has ended.', { sessionId: input.sessionId });
    }
    return resolved;
  })();
  const decided = decide(deps, principal, 'session.join', input.tenantId, chain, {
    workspaceId: chain.ok ? chain.data.session.workspaceId : null,
    detail: { sessionId: input.sessionId },
  });
  if (!decided.ok) return decided;
  const joined = deps.collab.join(input.tenantId, input.sessionId, principal.userId, nowOf(deps));
  if (!joined.ok) return storeFailure(joined.failure, joined.message);
  publish(deps, input.tenantId, input.sessionId, joined.events);
  const snapshot = snapshotOf(deps, joined.value);
  return snapshot.ok ? ok({ session: snapshot.data }) : snapshot;
}

/** POST /tenants/:t/sessions/:s/leave — stop participating (operator). A leaving driver hands control back to the owner. */
export function leaveSession(deps: CollabDeps, body: unknown): ControlPlaneResult<{ session: CollabSnapshot }> {
  const req = authedRequest(deps, sessionRequestSchema, body, 'session.leave');
  if (!req.ok) return req;
  const { principal, input } = req.data;
  const chain = resolveSession(deps, principal, input.tenantId, input.sessionId);
  const decided = decide(deps, principal, 'session.leave', input.tenantId, chain, {
    workspaceId: chain.ok ? chain.data.session.workspaceId : null,
    detail: { sessionId: input.sessionId },
  });
  if (!decided.ok) return decided;
  const left = deps.collab.leave(input.tenantId, input.sessionId, principal.userId, nowOf(deps));
  if (!left.ok) return storeFailure(left.failure, left.message);
  publish(deps, input.tenantId, input.sessionId, left.events);
  const snapshot = snapshotOf(deps, left.value);
  return snapshot.ok ? ok({ session: snapshot.data }) : snapshot;
}

/** POST /tenants/:t/sessions/:s/end — end the session. The owner or a tenant admin may; refused while a command runs. */
export function endSession(deps: CollabDeps, body: unknown): ControlPlaneResult<{ session: CollabSnapshot }> {
  const req = authedRequest(deps, endRequestSchema, body, 'session.end');
  if (!req.ok) return req;
  const { principal, input } = req.data;
  const chain = ((): ControlPlaneResult<Chain> => {
    const resolved = resolveSession(deps, principal, input.tenantId, input.sessionId);
    if (!resolved.ok) return resolved;
    const { session, role } = resolved.data;
    if (session.ownerId !== principal.userId && !roleSatisfies(role, 'admin')) {
      return fail('FORBIDDEN', 'Only the session owner or a tenant admin can end a session.', {
        sessionId: input.sessionId,
      });
    }
    return resolved;
  })();
  const decided = decide(deps, principal, 'session.end', input.tenantId, chain, {
    workspaceId: chain.ok ? chain.data.session.workspaceId : null,
    detail: { sessionId: input.sessionId },
  });
  if (!decided.ok) return decided;
  const ended = deps.collab.end(input.tenantId, input.sessionId, principal.userId, nowOf(deps), input.reason);
  if (!ended.ok) return storeFailure(ended.failure, ended.message);
  publish(deps, input.tenantId, input.sessionId, ended.events);
  const snapshot = snapshotOf(deps, ended.value);
  return snapshot.ok ? ok({ session: snapshot.data }) : snapshot;
}

// ---------------------------------------------------------------------------
// The shared console: run, cancel, hand over control
// ---------------------------------------------------------------------------

/**
 * POST /tenants/:t/sessions/:s/run — the DRIVER runs an allow-listed command.
 * One chain decides it (tenant role, session, driver, nothing already running)
 * and is audited as `session.run`; then the command goes through the ordinary
 * job path, which audits `command.authorize` and applies the allow-list.
 */
export function runCommand(
  deps: CollabDeps,
  body: unknown
): ControlPlaneResult<{ job: JobView; session: { seq: number; currentJobId: string } }> {
  const req = authedRequest(deps, runRequestSchema, body, 'session.run');
  if (!req.ok) return req;
  const { principal, input } = req.data;

  const chain = ((): ControlPlaneResult<Chain> => {
    const resolved = resolveSession(deps, principal, input.tenantId, input.sessionId);
    if (!resolved.ok) return resolved;
    const { session } = resolved.data;
    if (session.status !== 'active') {
      return fail('SESSION_ENDED', 'The session has ended.', { sessionId: session.id });
    }
    if (session.driverId !== principal.userId) {
      return fail('NOT_SESSION_DRIVER', 'Only the current driver can run commands in this session.', {
        sessionId: session.id,
        driverId: session.driverId,
      });
    }
    if (deps.collab.activeRun(session.tenantId, session.id)) {
      return fail('SESSION_BUSY', 'A command is already queued or running in this session.', {
        sessionId: session.id,
      });
    }
    return resolved;
  })();
  const decided = decide(deps, principal, 'session.run', input.tenantId, chain, {
    workspaceId: chain.ok ? chain.data.session.workspaceId : null,
    commandId: input.commandId,
    detail: { sessionId: input.sessionId },
  });
  if (!decided.ok) return decided;
  const { session } = decided.data;

  // Everything below is synchronous: nothing can interleave between the checks
  // above and linking the job to the session.
  const submitted = submitCommand(deps, {
    token: input.token,
    tenantId: input.tenantId,
    workspaceId: session.workspaceId,
    commandId: input.commandId,
    params: input.params,
  });
  if (!submitted.ok) return submitted;
  const job = submitted.data.job;

  const started = deps.collab.startRun(
    input.tenantId,
    session.id,
    { id: job.id, commandId: job.commandId, params: job.params, requestedBy: job.requestedBy },
    nowOf(deps)
  );
  if (!started.ok) {
    // The job is already queued; do not leave it running unobserved.
    deps.jobs.requestCancel(input.tenantId, job.id, nowOf(deps));
    return storeFailure(started.failure, started.message);
  }
  deps.hub.trackRun(input.tenantId, session.id, job.id);
  publish(deps, input.tenantId, session.id, started.events);
  // A very fast job may already have output; catch up immediately.
  deps.hub.pump(input.tenantId, session.id, job.id);
  const seq = deps.collab.getSession(input.tenantId, session.id)?.seq ?? started.events[started.events.length - 1].seq;
  return ok({ job, session: { seq, currentJobId: job.id } });
}

/** POST /tenants/:t/sessions/:s/cancel — cancel the current command (driver, owner or tenant admin). */
export function cancelRun(deps: CollabDeps, body: unknown): ControlPlaneResult<{ job: JobView }> {
  const req = authedRequest(deps, sessionRequestSchema, body, 'session.cancel');
  if (!req.ok) return req;
  const { principal, input } = req.data;
  const chain = ((): ControlPlaneResult<{ jobId: string; session: CollabSessionRow }> => {
    const resolved = resolveSession(deps, principal, input.tenantId, input.sessionId);
    if (!resolved.ok) return resolved;
    const { session, role } = resolved.data;
    if (
      session.driverId !== principal.userId &&
      session.ownerId !== principal.userId &&
      !roleSatisfies(role, 'admin')
    ) {
      return fail('NOT_SESSION_DRIVER', 'Only the driver, the owner or a tenant admin can cancel the running command.', {
        sessionId: session.id,
      });
    }
    const run = deps.collab.activeRun(session.tenantId, session.id);
    if (!run) {
      return fail('CONFLICT', 'No command is queued or running in this session.', { sessionId: session.id });
    }
    return ok({ jobId: run.jobId, session });
  })();
  const decided = decide(deps, principal, 'session.cancel', input.tenantId, chain, {
    workspaceId: chain.ok ? chain.data.session.workspaceId : null,
    detail: { sessionId: input.sessionId },
  });
  if (!decided.ok) return decided;
  return cancelJob(deps, { token: input.token, tenantId: input.tenantId, jobId: decided.data.jobId });
}

/**
 * POST /tenants/:t/sessions/:s/handover — pass control. The current driver may
 * hand over to any joined participant who holds the operator role; the session
 * OWNER can always take or assign control (the escape hatch for a driver who
 * went away).
 */
export function handoverControl(deps: CollabDeps, body: unknown): ControlPlaneResult<{ session: CollabSnapshot }> {
  const req = authedRequest(deps, handoverRequestSchema, body, 'session.handover');
  if (!req.ok) return req;
  const { principal, input } = req.data;
  const chain = ((): ControlPlaneResult<Chain> => {
    const resolved = resolveSession(deps, principal, input.tenantId, input.sessionId);
    if (!resolved.ok) return resolved;
    const { session } = resolved.data;
    if (session.status !== 'active') {
      return fail('SESSION_ENDED', 'The session has ended.', { sessionId: session.id });
    }
    if (session.driverId !== principal.userId && session.ownerId !== principal.userId) {
      return fail('NOT_SESSION_DRIVER', 'Only the current driver or the session owner can hand over control.', {
        sessionId: session.id,
        driverId: session.driverId,
      });
    }
    if (!deps.collab.isParticipant(session.tenantId, session.id, input.toUserId)) {
      return fail('PARTICIPANT_NOT_FOUND', 'The new driver has not joined the session.', {
        sessionId: session.id,
        userId: input.toUserId,
      });
    }
    // Live membership: a demoted user cannot be handed the keyboard.
    const targetRole = deps.store.getMemberships(input.toUserId)[session.tenantId];
    if (!targetRole || !roleSatisfies(targetRole, 'operator')) {
      return fail('FORBIDDEN', 'The new driver must hold the operator role in this tenant.', {
        sessionId: session.id,
        userId: input.toUserId,
      });
    }
    return resolved;
  })();
  const decided = decide(deps, principal, 'session.handover', input.tenantId, chain, {
    workspaceId: chain.ok ? chain.data.session.workspaceId : null,
    detail: { sessionId: input.sessionId, to: input.toUserId },
  });
  if (!decided.ok) return decided;
  const result = deps.collab.handover(input.tenantId, input.sessionId, input.toUserId, principal.userId, nowOf(deps));
  if (!result.ok) return storeFailure(result.failure, result.message);
  publish(deps, input.tenantId, input.sessionId, result.events);
  const snapshot = snapshotOf(deps, result.value);
  return snapshot.ok ? ok({ session: snapshot.data }) : snapshot;
}

/** GET /tenants/:t/sessions/:s/events — the ordered log after a cursor (operator). */
export function listSessionEvents(
  deps: CollabDeps,
  body: unknown
): ControlPlaneResult<{ events: CollabEventEnvelope[]; seq: number }> {
  const req = authedRequest(deps, eventsRequestSchema, body, 'session.read');
  if (!req.ok) return req;
  const { principal, input } = req.data;
  const chain = resolveSession(deps, principal, input.tenantId, input.sessionId);
  const decided = decide(deps, principal, 'session.read', input.tenantId, chain, {
    workspaceId: chain.ok ? chain.data.session.workspaceId : null,
    detail: { sessionId: input.sessionId, events: true },
  });
  if (!decided.ok) return decided;
  const events = deps.collab.eventsAfter(input.tenantId, input.sessionId, input.afterSeq, input.limit);
  return ok({ events, seq: deps.collab.getSession(input.tenantId, input.sessionId)?.seq ?? 0 });
}

// ---------------------------------------------------------------------------
// Shared documents
// ---------------------------------------------------------------------------

/** Editing needs the operator role and a seat in the session. */
function resolveEditor(
  deps: CollabDeps,
  principal: Principal,
  tenantId: string,
  sessionId: string
): ControlPlaneResult<Chain> {
  const resolved = resolveSession(deps, principal, tenantId, sessionId);
  if (!resolved.ok) return resolved;
  if (resolved.data.session.status !== 'active') {
    return fail('SESSION_ENDED', 'The session has ended.', { sessionId });
  }
  if (!deps.collab.isParticipant(tenantId, sessionId, principal.userId)) {
    return fail('FORBIDDEN', 'Join the session before editing its documents.', { sessionId });
  }
  return resolved;
}

/** GET /tenants/:t/sessions/:s/docs — every document with its current content (operator). */
export function listDocs(deps: CollabDeps, body: unknown): ControlPlaneResult<{ docs: CollabSnapshot['docs'] }> {
  const req = authedRequest(deps, sessionRequestSchema, body, 'doc.read');
  if (!req.ok) return req;
  const { principal, input } = req.data;
  const chain = resolveSession(deps, principal, input.tenantId, input.sessionId);
  const decided = decide(deps, principal, 'doc.read', input.tenantId, chain, {
    workspaceId: chain.ok ? chain.data.session.workspaceId : null,
    detail: { sessionId: input.sessionId },
  });
  if (!decided.ok) return decided;
  return ok({ docs: deps.collab.listDocs(input.tenantId, input.sessionId) });
}

/** GET /tenants/:t/sessions/:s/docs/:d — one document (operator). */
export function getDoc(deps: CollabDeps, body: unknown): ControlPlaneResult<{ doc: CollabSnapshot['docs'][number] }> {
  const req = authedRequest(deps, docRequestSchema, body, 'doc.read');
  if (!req.ok) return req;
  const { principal, input } = req.data;
  const chain = resolveSession(deps, principal, input.tenantId, input.sessionId);
  const decided = decide(deps, principal, 'doc.read', input.tenantId, chain, {
    workspaceId: chain.ok ? chain.data.session.workspaceId : null,
    detail: { sessionId: input.sessionId, docId: input.docId },
  });
  if (!decided.ok) return decided;
  const doc = deps.collab.getDoc(input.tenantId, input.sessionId, input.docId);
  return doc ? ok({ doc }) : fail('DOCUMENT_NOT_FOUND', 'Document not found in this session.', { docId: input.docId });
}

/**
 * POST /tenants/:t/sessions/:s/docs — add a shared document, e.g. a workspace
 * YAML draft (`kind: "yaml-draft"`). Documents are text only: nothing here ever
 * writes to a workspace or applies a draft.
 */
export function createDoc(deps: CollabDeps, body: unknown): ControlPlaneResult<{ doc: CollabSnapshot['docs'][number] }> {
  const req = authedRequest(deps, createDocRequestSchema, body, 'doc.create');
  if (!req.ok) return req;
  const { principal, input } = req.data;
  const chain = resolveEditor(deps, principal, input.tenantId, input.sessionId);
  const decided = decide(deps, principal, 'doc.create', input.tenantId, chain, {
    workspaceId: chain.ok ? chain.data.session.workspaceId : null,
    detail: { sessionId: input.sessionId, docId: input.docId, kind: input.kind },
  });
  if (!decided.ok) return decided;
  const created = deps.collab.createDoc(
    input.tenantId,
    input.sessionId,
    { id: input.docId, title: input.title, kind: input.kind, content: input.content },
    principal.userId,
    nowOf(deps)
  );
  if (!created.ok) return storeFailure(created.failure, created.message);
  publish(deps, input.tenantId, input.sessionId, created.events);
  return ok({ doc: created.value });
}

/**
 * POST /tenants/:t/sessions/:s/docs/:d/ops — submit an edit. The server
 * transforms it over every op committed since `baseRev`, applies and persists
 * it as the next revision, and broadcasts the committed op to every stream
 * (including the author's, which is how the author learns it was accepted).
 * Retrying the same (clientId, clientSeq) is safe and applies the edit once.
 */
export function submitDocOp(
  deps: CollabDeps,
  body: unknown
): ControlPlaneResult<{ docId: string; rev: number; ops: TextOp; duplicate: boolean }> {
  const req = authedRequest(deps, docOpRequestSchema, body, 'doc.edit');
  if (!req.ok) return req;
  const { principal, input } = req.data;
  const shape = validateOp(input.ops);
  const chain = ((): ControlPlaneResult<Chain> => {
    const resolved = resolveEditor(deps, principal, input.tenantId, input.sessionId);
    if (!resolved.ok) return resolved;
    if (shape !== null) {
      return fail('INVALID_REQUEST', shape, { docId: input.docId });
    }
    if (opBaseLength(input.ops) > MAX_DOC_CHARS) {
      return fail('PAYLOAD_TOO_LARGE', 'The operation spans more than a document may hold.');
    }
    return resolved;
  })();
  const decided = decideSampled(deps, principal, 'doc.edit', input.tenantId, input.sessionId, chain, {
    workspaceId: chain.ok ? chain.data.session.workspaceId : null,
    detail: { docId: input.docId },
  });
  if (!decided.ok) return decided;
  const applied = deps.collab.applyDocOp(input.tenantId, input.sessionId, input.docId, {
    clientId: input.clientId,
    clientSeq: input.clientSeq,
    baseRev: input.baseRev,
    ops: input.ops,
    by: principal.userId,
    now: nowOf(deps),
  });
  if (!applied.ok) return storeFailure(applied.failure, applied.message, { docId: input.docId });
  publish(deps, input.tenantId, input.sessionId, applied.events);
  return ok({
    docId: applied.value.docId,
    rev: applied.value.rev,
    ops: applied.value.ops,
    duplicate: applied.value.duplicate,
  });
}

/** GET /tenants/:t/sessions/:s/docs/:d/ops — committed ops after a revision (catch-up without a stream). */
export function listDocOps(
  deps: CollabDeps,
  body: unknown
): ControlPlaneResult<{
  doc: { id: string; rev: number };
  ops: Array<{ rev: number; ops: TextOp; actor: string | null; clientId: string; clientSeq: number; ts: number }>;
}> {
  const req = authedRequest(deps, docOpsRequestSchema, body, 'doc.read');
  if (!req.ok) return req;
  const { principal, input } = req.data;
  const chain = resolveSession(deps, principal, input.tenantId, input.sessionId);
  const decided = decide(deps, principal, 'doc.read', input.tenantId, chain, {
    workspaceId: chain.ok ? chain.data.session.workspaceId : null,
    detail: { sessionId: input.sessionId, docId: input.docId, ops: true },
  });
  if (!decided.ok) return decided;
  const doc = deps.collab.getDoc(input.tenantId, input.sessionId, input.docId);
  if (!doc) return fail('DOCUMENT_NOT_FOUND', 'Document not found in this session.', { docId: input.docId });
  const ops = deps.collab.docOpsAfter(input.tenantId, input.sessionId, input.docId, input.afterRev, input.limit);
  return ok({
    doc: { id: doc.id, rev: doc.rev },
    ops: ops.map((o) => ({
      rev: o.rev,
      ops: o.ops,
      actor: o.actor,
      clientId: o.clientId,
      clientSeq: o.clientSeq,
      ts: o.ts,
    })),
  });
}

// ---------------------------------------------------------------------------
// WebRTC signaling and the relay fallback
// ---------------------------------------------------------------------------

/** Both ends must be joined participants of THIS session (so, of this tenant). */
function resolvePeers(
  deps: CollabDeps,
  principal: Principal,
  tenantId: string,
  sessionId: string,
  to: string | null
): ControlPlaneResult<Chain> {
  const resolved = resolveEditor(deps, principal, tenantId, sessionId);
  if (!resolved.ok) return resolved;
  if (to !== null) {
    if (to === principal.userId) {
      return fail('INVALID_REQUEST', 'A peer message cannot be addressed to yourself.');
    }
    if (!deps.collab.isParticipant(tenantId, sessionId, to)) {
      return fail('PARTICIPANT_NOT_FOUND', 'The addressee is not a participant of this session.', {
        sessionId,
        userId: to,
      });
    }
  }
  return resolved;
}

function payloadBytes(payload: Record<string, unknown>): number {
  return Buffer.byteLength(JSON.stringify(payload), 'utf8');
}

/**
 * POST /tenants/:t/sessions/:s/signal — relay one WebRTC signaling message (offer,
 * answer, ICE candidate, bye) to ONE other participant of the session. The server
 * stamps `from` itself, the message is delivered only to the addressee's
 * authenticated streams, and it is never stored. `delivered:false` tells the
 * sender the peer has no live stream (so P2P cannot be set up yet).
 */
export function sendSignal(deps: CollabDeps, body: unknown): ControlPlaneResult<{ delivered: boolean }> {
  const req = authedRequest(deps, signalRequestSchema, body, 'signal.send');
  if (!req.ok) return req;
  const { principal, input } = req.data;
  const chain = ((): ControlPlaneResult<Chain> => {
    const resolved = resolvePeers(deps, principal, input.tenantId, input.sessionId, input.to);
    if (!resolved.ok) return resolved;
    if (payloadBytes(input.payload) > MAX_SIGNAL_BYTES) {
      return fail('PAYLOAD_TOO_LARGE', `A signaling payload may be at most ${MAX_SIGNAL_BYTES} bytes.`);
    }
    return resolved;
  })();
  const decided = decideSampled(deps, principal, 'signal.send', input.tenantId, input.sessionId, chain, {
    workspaceId: chain.ok ? chain.data.session.workspaceId : null,
  });
  if (!decided.ok) return decided;
  const delivered = deps.hub.signal(input.tenantId, input.sessionId, {
    from: principal.userId,
    to: input.to,
    kind: input.kind,
    connectionId: input.connectionId,
    payload: input.payload,
    ts: nowOf(deps),
  });
  return ok({ delivered });
}

/**
 * POST /tenants/:t/sessions/:s/relay — the fallback when a direct data channel is
 * not available: presence, cursor and ping messages relayed through the server
 * to one participant (or all others). Ephemeral: never stored or replayed.
 */
export function sendRelay(deps: CollabDeps, body: unknown): ControlPlaneResult<{ delivered: number }> {
  const req = authedRequest(deps, relayRequestSchema, body, 'relay.send');
  if (!req.ok) return req;
  const { principal, input } = req.data;
  const chain = ((): ControlPlaneResult<Chain> => {
    const resolved = resolvePeers(deps, principal, input.tenantId, input.sessionId, input.to);
    if (!resolved.ok) return resolved;
    if (payloadBytes(input.payload) > MAX_RELAY_BYTES) {
      return fail('PAYLOAD_TOO_LARGE', `A relayed message may be at most ${MAX_RELAY_BYTES} bytes.`);
    }
    return resolved;
  })();
  const decided = decideSampled(deps, principal, 'relay.send', input.tenantId, input.sessionId, chain, {
    workspaceId: chain.ok ? chain.data.session.workspaceId : null,
  });
  if (!decided.ok) return decided;
  const delivered = deps.hub.relay(input.tenantId, input.sessionId, {
    from: principal.userId,
    to: input.to,
    channel: input.channel,
    payload: input.payload,
    ts: nowOf(deps),
  });
  return ok({ delivered });
}

// ---------------------------------------------------------------------------
// Team analytics
// ---------------------------------------------------------------------------

/**
 * GET /tenants/:t/analytics — per-tenant aggregates over a time window, derived
 * from the jobs table (commands per user / workspace / command, success rates),
 * the sessions tables (counts, durations, participants) and the audit log
 * (allow / deny decisions). Operator-gated, tenant-scoped.
 */
export function getAnalytics(deps: CollabDeps, body: unknown): ControlPlaneResult<{ analytics: CollabAnalytics }> {
  const req = authedRequest(deps, analyticsRequestSchema, body, 'analytics.read');
  if (!req.ok) return req;
  const { principal, input } = req.data;
  const now = nowOf(deps);
  const to = input.to ?? now + 1;
  const from = input.from ?? Math.max(0, to - 7 * 24 * 3_600_000);
  const authorized = authorizeTenant(deps.store, principal, input.tenantId, 'operator');
  const chain = ((): ControlPlaneResult<true> => {
    if (!authorized.ok) return authorized;
    if (from >= to) return fail('INVALID_REQUEST', '"from" must be earlier than "to".');
    if (to - from > MAX_WINDOW_MS) return fail('INVALID_REQUEST', 'The analytics window may span at most 366 days.');
    if (input.workspaceId && !deps.store.getWorkspace(input.tenantId, input.workspaceId)) {
      return fail('WORKSPACE_NOT_FOUND', 'Workspace not found in this tenant.', { workspaceId: input.workspaceId });
    }
    return ok(true);
  })();
  const decided = decide(deps, principal, 'analytics.read', input.tenantId, chain, {
    workspaceId: input.workspaceId ?? null,
  });
  if (!decided.ok) return decided;
  return ok({
    analytics: deps.collab.analytics({
      tenantId: input.tenantId,
      from,
      to,
      now,
      workspaceId: input.workspaceId,
    }),
  });
}

/** Re-exported so the HTTP edge can authorize a stream with the same chain as the REST reads. */
export function authorizeSessionStream(
  deps: CollabDeps,
  body: unknown
): ControlPlaneResult<{ session: CollabSessionRow; principal: Principal }> {
  const req = authedRequest(deps, sessionRequestSchema, body, 'session.stream');
  if (!req.ok) return req;
  const { principal, input } = req.data;
  const chain = resolveSession(deps, principal, input.tenantId, input.sessionId);
  const decided = decide(deps, principal, 'session.stream', input.tenantId, chain, {
    workspaceId: chain.ok ? chain.data.session.workspaceId : null,
    detail: { sessionId: input.sessionId },
  });
  if (!decided.ok) return decided;
  return ok({ session: decided.data.session, principal });
}

