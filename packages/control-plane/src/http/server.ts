import http from 'node:http';
import type { AddressInfo } from 'node:net';

import type { IceServerConfig } from '@re-shell/contracts';
import { isRegisteredCommandId, resolveCommand } from '@re-shell/contracts/command-registry';
import { z } from 'zod';

import {
  AdminDeps,
  createTenant,
  createWorkspace,
  getPolicy,
  listMembers,
  queryAudit,
  removeMember,
  setMember,
  setWorkspaceGrant,
  updatePolicy,
  whoAmI,
} from '../admin.js';
import { listWorkspaces } from '../api.js';
import type { AuditReader, AuditSink } from '../audit.js';
import { Principal, SessionResolver, roleSatisfies } from '../auth.js';
import {
  CollabDeps,
  authorizeSessionStream,
  cancelRun,
  createDoc,
  createSession,
  endSession,
  getAnalytics,
  getDoc,
  getSession,
  handoverControl,
  joinSession,
  leaveSession,
  listDocOps,
  listDocs,
  listSessionEvents,
  listSessions,
  runCommand,
  sendRelay,
  sendSignal,
  submitDocOp,
} from '../collab.js';
import { CollabHub, StreamListener } from '../collab-hub.js';
import type { SqliteCollabStore } from '../db/sqlite-collab.js';
import type { SqliteJobStore } from '../db/sqlite-jobs.js';
import { TERMINAL_STATUSES } from '../db/sqlite-jobs.js';
import {
  ControlPlaneErrorCode,
  ControlPlaneResult,
  HTTP_STATUS_BY_CODE,
  fail,
  ok,
} from '../errors.js';
import { EventBus, ForwardedTenantEvent, TenantEvent, isForwardedEvent } from '../events.js';
import {
  IdentityOptions,
  JwtSessionResolver,
  WorkerIdentity,
  WorkerTokenVerifier,
} from '../identity.js';
import {
  JobDeps,
  WorkerJobDeps,
  authorizeJobAccess,
  cancelJob,
  claimJob,
  getJob,
  listJobs,
  reapExpiredJobs,
  submitCommand,
  toJobView,
  workerAppendOutput,
  workerFinishJob,
} from '../jobs.js';
import { ControlPlaneDeps, authorizeTenantAudited, validate } from '../pipeline.js';
import { buildPolicySnapshot } from '../policy.js';
import { TenantAdminStore, idSchema } from '../tenant.js';
import { TokenBucketLimiter, bearerToken, clientAddress, readJsonBody } from './limits.js';
import { Router } from './router.js';
import { SseStream, openSse } from './sse.js';

/**
 * The HTTP edge of the control plane (`node:http`, no framework).
 *
 * Every request passes the same gates, in order:
 *   1. security headers + (exact-match) CORS
 *   2. route lookup (404 / 405 envelopes)
 *   3. per-address rate limit
 *   4. bearer-token authentication (one uniform 401 for every failure mode)
 *   5. per-principal rate limit
 *   6. bounded, strictly validated JSON body / query
 *   7. the pure handler (validate → authorize → audit → act)
 * Handler result envelopes are mapped to HTTP status through
 * HTTP_STATUS_BY_CODE; there is no other source of status codes.
 */

export interface ServerLimits {
  /** Max JSON body for client routes. */
  bodyBytes: number;
  /** Max JSON body for worker output posts. */
  workerBodyBytes: number;
  userBurst: number;
  userPerMinute: number;
  workerBurst: number;
  workerPerMinute: number;
  ipBurst: number;
  ipPerMinute: number;
  /** Failed authentications per address before further attempts are throttled. */
  authFailBurst: number;
  authFailPerMinute: number;
  /** Collaboration writes (document ops, signaling, relays) have their own, higher, per-principal budget. */
  collabBurst: number;
  collabPerMinute: number;
  /** Concurrent SSE streams per principal. */
  maxStreamsPerPrincipal: number;
  /** Active shared sessions per tenant. */
  maxActiveSessionsPerTenant: number;
  maxQueuedPerTenant: number;
  /** Worker lease: a running job with no heartbeat for this long is failed. */
  leaseMs: number;
  reapIntervalMs: number;
  sseKeepAliveMs: number;
}

export const DEFAULT_LIMITS: ServerLimits = {
  bodyBytes: 64 * 1024,
  workerBodyBytes: 1024 * 1024,
  userBurst: 60,
  userPerMinute: 120,
  workerBurst: 600,
  workerPerMinute: 1200,
  ipBurst: 120,
  ipPerMinute: 600,
  authFailBurst: 10,
  authFailPerMinute: 20,
  collabBurst: 200,
  collabPerMinute: 1200,
  maxStreamsPerPrincipal: 10,
  maxActiveSessionsPerTenant: 50,
  maxQueuedPerTenant: 100,
  leaseMs: 60_000,
  reapIntervalMs: 10_000,
  sseKeepAliveMs: 15_000,
};

export interface ControlPlaneServerOptions {
  store: TenantAdminStore;
  audit: AuditSink & AuditReader;
  jobs: SqliteJobStore;
  /** Enables the collaboration routes (shared sessions, documents, signaling, analytics). */
  collab?: SqliteCollabStore;
  /** STUN/TURN servers handed to session participants. Empty (default) = host candidates only. */
  iceServers?: readonly IceServerConfig[];
  identity: IdentityOptions;
  events?: EventBus;
  /** User ids allowed to create tenants. */
  platformAdmins?: readonly string[];
  /** Exact origins allowed to call the API from a browser. Never `*`. */
  corsOrigins?: readonly string[];
  /** Trust the last X-Forwarded-For entry (set ONLY behind a reverse proxy you control). */
  trustProxy?: boolean;
  /** Send Strict-Transport-Security (set when TLS terminates in front of the server). */
  hsts?: boolean;
  limits?: Partial<ServerLimits>;
  now?: () => number;
  /** Throws when a dependency (the database) is unhealthy. */
  health?: () => void;
  logger?: (entry: Record<string, unknown>) => void;
  version?: string;
}

export interface ListenInfo {
  port: number;
  host: string;
  url: string;
}

export interface ControlPlaneServer {
  readonly server: http.Server;
  readonly events: EventBus;
  /** Present when the server was created with a collaboration store. */
  readonly collabHub: CollabHub | undefined;
  listen(port: number, host: string): Promise<ListenInfo>;
  close(): Promise<void>;
}

type AuthKind = 'none' | 'user' | 'worker' | 'any';

interface Ctx {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  params: Record<string, string>;
  query: URLSearchParams;
  token: string | undefined;
  principal?: Principal;
  expiresAt?: number;
  worker?: WorkerIdentity;
  ip: string;
  cors: Record<string, string>;
}

interface RouteDef {
  pattern: string;
  auth: AuthKind;
  /** Body size cap; undefined means the route takes no body. */
  body?: 'client' | 'worker';
  /** Charge the per-principal budget for high-frequency collaboration writes instead of the general one. */
  rate?: 'collab';
  run: (ctx: Ctx, body: Record<string, unknown>) => void | Promise<void>;
}

const UNAUTHENTICATED_MESSAGE = 'Authentication required.';

export function createControlPlaneServer(options: ControlPlaneServerOptions): ControlPlaneServer {
  const limits: ServerLimits = { ...DEFAULT_LIMITS, ...options.limits };
  const clock = options.now ?? Date.now;
  const events = options.events ?? new EventBus();
  const log = options.logger ?? (() => undefined);
  const corsOrigins = new Set(options.corsOrigins ?? []);
  const trustProxy = options.trustProxy ?? false;

  const sessions: SessionResolver = new JwtSessionResolver(
    { ...options.identity, now: options.identity.now ?? clock },
    options.store
  );
  const workerVerifier = new WorkerTokenVerifier({
    ...options.identity,
    now: options.identity.now ?? clock,
  });

  const baseDeps: ControlPlaneDeps = {
    store: options.store,
    sessions,
    now: clock,
    audit: options.audit,
    validateCommand: (commandId, params) => {
      const resolved = resolveCommand(commandId, params);
      return resolved.ok ? null : resolved.error;
    },
  };
  const adminDeps: AdminDeps = {
    ...baseDeps,
    store: options.store,
    events,
    platformAdmins: new Set(options.platformAdmins ?? []),
    auditReader: options.audit,
    isKnownCommand: isRegisteredCommandId,
  };
  const jobDeps: JobDeps = {
    ...adminDeps,
    jobs: options.jobs,
    maxQueuedPerTenant: limits.maxQueuedPerTenant,
  };
  const workerDeps: WorkerJobDeps = {
    store: options.store,
    jobs: options.jobs,
    events,
    audit: options.audit,
    now: clock,
    leaseMs: limits.leaseMs,
  };

  const hub = options.collab
    ? new CollabHub({
        store: options.collab,
        jobs: options.jobs,
        events,
        now: clock,
        iceServers: options.iceServers,
        logger: log,
      })
    : undefined;
  const collabDeps: CollabDeps | undefined =
    options.collab && hub
      ? {
          ...jobDeps,
          collab: options.collab,
          hub,
          maxActiveSessionsPerTenant: limits.maxActiveSessionsPerTenant,
        }
      : undefined;

  const userLimiter = new TokenBucketLimiter(limits.userBurst, limits.userPerMinute);
  const collabLimiter = new TokenBucketLimiter(limits.collabBurst, limits.collabPerMinute);
  const workerLimiter = new TokenBucketLimiter(limits.workerBurst, limits.workerPerMinute);
  const ipLimiter = new TokenBucketLimiter(limits.ipBurst, limits.ipPerMinute);
  const authFailLimiter = new TokenBucketLimiter(limits.authFailBurst, limits.authFailPerMinute);

  const openStreams = new Map<string, number>();
  const liveStreams = new Set<SseStream>();

  // ---- response helpers ----------------------------------------------------

  function baseHeaders(cors: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      ...cors,
    };
    if (options.hsts) {
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    }
    return headers;
  }

  function corsHeadersFor(req: http.IncomingMessage): Record<string, string> {
    const origin = req.headers.origin;
    if (typeof origin !== 'string' || !corsOrigins.has(origin)) {
      return {};
    }
    return {
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
      'Access-Control-Expose-Headers': 'Retry-After',
    };
  }

  function sendJson(
    ctx: Pick<Ctx, 'res' | 'cors'>,
    status: number,
    payload: unknown,
    extra: Record<string, string> = {}
  ): void {
    const body = JSON.stringify(payload);
    ctx.res.writeHead(status, {
      ...baseHeaders(ctx.cors),
      ...extra,
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': String(Buffer.byteLength(body)),
    });
    ctx.res.end(body);
  }

  function sendError(
    ctx: Pick<Ctx, 'res' | 'cors'>,
    code: ControlPlaneErrorCode,
    message: string,
    details?: Record<string, unknown>,
    extra: Record<string, string> = {}
  ): void {
    sendJson(ctx, HTTP_STATUS_BY_CODE[code], fail(code, message, details), extra);
  }

  /** Map a handler envelope to a response. UNAUTHENTICATED is always the same body. */
  function sendResult<T>(ctx: Ctx, result: ControlPlaneResult<T>, successStatus = 200): void {
    if (result.ok) {
      sendJson(ctx, successStatus, result);
      return;
    }
    const { code } = result.error;
    if (code === 'UNAUTHENTICATED') {
      sendError(ctx, 'UNAUTHENTICATED', UNAUTHENTICATED_MESSAGE, undefined, {
        'WWW-Authenticate': 'Bearer',
      });
      return;
    }
    const extra: Record<string, string> = {};
    if (code === 'RATE_LIMITED') {
      extra['Retry-After'] = '5';
    }
    sendJson(ctx, HTTP_STATUS_BY_CODE[code], result, extra);
  }

  // ---- authentication ------------------------------------------------------

  function recordAuthFailure(ctx: Ctx, route: RouteDef): void {
    const tenantParam = idSchema.safeParse(ctx.params.tenantId);
    try {
      options.audit.record({
        ts: clock(),
        userId: null,
        tenantId: tenantParam.success ? tenantParam.data : null,
        action: 'auth.failed',
        decision: 'deny',
        code: 'UNAUTHENTICATED',
        detail: { route: route.pattern },
      });
    } catch {
      // The request is being refused regardless; a failing audit sink must not turn a 401 into a 500.
    }
  }

  /** Authenticate for a route. Returns false after sending the failure response. */
  function authenticateCtx(ctx: Ctx, route: RouteDef): boolean {
    if (route.auth === 'none') {
      return true;
    }
    const now = clock();
    if (route.auth === 'user' || route.auth === 'any') {
      const session = ctx.token ? sessions.resolve(ctx.token) : undefined;
      if (session && now < session.expiresAt) {
        ctx.principal = session.principal;
        ctx.expiresAt = session.expiresAt;
        return true;
      }
    }
    if (route.auth === 'worker' || route.auth === 'any') {
      const worker = workerVerifier.verify(ctx.token);
      if (worker) {
        ctx.worker = worker;
        ctx.expiresAt = worker.expiresAt;
        return true;
      }
    }
    // One uniform response for missing, malformed, tampered, unknown, wrong-kind
    // and expired credentials. Repeated failures from one address are throttled
    // BEFORE they reach the database (audit) at all.
    const gate = authFailLimiter.take(ctx.ip, now);
    if (!gate.allowed) {
      sendError(ctx, 'RATE_LIMITED', 'Too many failed authentication attempts.', undefined, {
        'Retry-After': String(Math.max(1, Math.ceil(gate.retryAfterMs / 1000))),
      });
      return false;
    }
    recordAuthFailure(ctx, route);
    sendError(ctx, 'UNAUTHENTICATED', UNAUTHENTICATED_MESSAGE, undefined, {
      'WWW-Authenticate': 'Bearer',
    });
    return false;
  }

  function principalRateLimit(ctx: Ctx, route: RouteDef): boolean {
    const now = clock();
    let verdict: ReturnType<TokenBucketLimiter['take']>;
    if (ctx.principal) {
      verdict =
        route.rate === 'collab'
          ? collabLimiter.take(`u:${ctx.principal.userId}`, now)
          : userLimiter.take(`u:${ctx.principal.userId}`, now);
    } else if (ctx.worker) {
      verdict = workerLimiter.take(`w:${ctx.worker.tenantId}:${ctx.worker.workerId}`, now);
    } else {
      return true;
    }
    if (verdict.allowed) {
      return true;
    }
    sendError(ctx, 'RATE_LIMITED', 'Rate limit exceeded.', undefined, {
      'Retry-After': String(Math.max(1, Math.ceil(verdict.retryAfterMs / 1000))),
    });
    return false;
  }

  // ---- request composition -------------------------------------------------

  /** Fields the SERVER supplies (token, path params). A body may not carry them. */
  function compose(
    body: Record<string, unknown>,
    server: Record<string, unknown>
  ): ControlPlaneResult<Record<string, unknown>> {
    const collisions = Object.keys(server).filter((key) => key in body);
    if (collisions.length > 0) {
      return fail('INVALID_REQUEST', 'The request body must not repeat path or credential fields.', {
        fields: collisions,
      });
    }
    return ok({ ...body, ...server });
  }

  function queryObject(
    ctx: Ctx,
    allowed: { ints?: readonly string[]; strings?: readonly string[] }
  ): ControlPlaneResult<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    const known = new Set([...(allowed.ints ?? []), ...(allowed.strings ?? [])]);
    for (const key of ctx.query.keys()) {
      if (!known.has(key)) {
        return fail('INVALID_REQUEST', `Unknown query parameter "${key}".`);
      }
    }
    for (const key of allowed.ints ?? []) {
      const raw = ctx.query.get(key);
      if (raw !== null) {
        // A non-numeric value stays a string so the handler's schema rejects it.
        out[key] = /^\d{1,15}$/.test(raw) ? Number(raw) : raw;
      }
    }
    for (const key of allowed.strings ?? []) {
      const raw = ctx.query.get(key);
      if (raw !== null) {
        out[key] = raw;
      }
    }
    return ok(out);
  }

  /** Common shape: server fields + validated body/query → pure handler → envelope. */
  function userHandler<D, T>(
    handler: (deps: D, body: unknown) => ControlPlaneResult<T>,
    deps: D,
    build: (ctx: Ctx, body: Record<string, unknown>) => ControlPlaneResult<Record<string, unknown>>,
    successStatus = 200
  ): (ctx: Ctx, body: Record<string, unknown>) => void {
    return (ctx, body) => {
      const built = build(ctx, body);
      if (!built.ok) {
        sendResult(ctx, built);
        return;
      }
      sendResult(ctx, handler(deps, built.data), successStatus);
    };
  }

  const tokenOf = (ctx: Ctx): string => ctx.token ?? '';

  // ---- SSE -----------------------------------------------------------------

  function streamSlot(ctx: Ctx): (() => void) | undefined {
    const key = ctx.principal ? `u:${ctx.principal.userId}` : `w:${ctx.worker?.tenantId}:${ctx.worker?.workerId}`;
    const current = openStreams.get(key) ?? 0;
    if (current >= limits.maxStreamsPerPrincipal) {
      sendError(ctx, 'RATE_LIMITED', 'Too many open streams for this principal.', {
        limit: limits.maxStreamsPerPrincipal,
      });
      return undefined;
    }
    openStreams.set(key, current + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const left = (openStreams.get(key) ?? 1) - 1;
      if (left <= 0) {
        openStreams.delete(key);
      } else {
        openStreams.set(key, left);
      }
    };
  }

  function openStream(ctx: Ctx, release: () => void, maxBufferedBytes?: number): SseStream {
    const stream = openSse(ctx.req, ctx.res, {
      keepAliveMs: limits.sseKeepAliveMs,
      headers: baseHeaders(ctx.cors),
      ...(maxBufferedBytes !== undefined ? { maxBufferedBytes } : {}),
    });
    liveStreams.add(stream);
    stream.onClose(() => {
      liveStreams.delete(stream);
      release();
    });
    // Streams never outlive the credential that opened them.
    if (ctx.expiresAt !== undefined) {
      const ms = Math.max(0, ctx.expiresAt - clock());
      const timer = setTimeout(() => {
        stream.send('expired', { reason: 'token-expired' });
        stream.close();
      }, Math.min(ms, 2 ** 31 - 1));
      timer.unref();
      stream.onClose(() => clearTimeout(timer));
    }
    return stream;
  }

  function eventPayload(event: ForwardedTenantEvent): Record<string, unknown> {
    switch (event.type) {
      case 'policy.updated':
        return { tenantId: event.tenantId, change: event.change, policy: event.policy, updatedBy: event.updatedBy };
      case 'workspace.created':
        return { tenantId: event.tenantId, workspace: event.workspace, createdBy: event.createdBy };
      case 'job.updated':
        return { tenantId: event.tenantId, job: event.job };
    }
  }

  /** GET /tenants/:tenantId/events — live tenant events for clients and workers. */
  function tenantEvents(ctx: Ctx): void {
    const tenantId = ctx.params.tenantId;
    const id = validate(idSchema, tenantId);
    if (!id.ok) {
      sendResult(ctx, id);
      return;
    }
    if (ctx.principal) {
      const authorized = authorizeTenantAudited(baseDeps, ctx.principal, id.data, 'viewer', {
        action: 'events.subscribe',
      });
      if (!authorized.ok) {
        sendResult(ctx, authorized);
        return;
      }
    } else if (ctx.worker) {
      const allowed = ctx.worker.tenantId === id.data;
      try {
        options.audit.record({
          ts: clock(),
          userId: `worker:${ctx.worker.workerId}`,
          tenantId: id.data,
          action: 'events.subscribe',
          decision: allowed ? 'allow' : 'deny',
          code: allowed ? null : 'FORBIDDEN',
        });
      } catch {
        sendError(ctx, 'INTERNAL_ERROR', 'Audit trail unavailable; refusing to authorize.');
        return;
      }
      if (!allowed) {
        sendError(ctx, 'FORBIDDEN', 'Principal is not a member of the requested tenant.', {
          tenantId: id.data,
        });
        return;
      }
    }
    const snapshot = buildPolicySnapshot(options.store, id.data);
    if (!snapshot) {
      sendError(ctx, 'TENANT_NOT_FOUND', 'Tenant does not exist.', { tenantId: id.data });
      return;
    }
    const release = streamSlot(ctx);
    if (!release) {
      return;
    }
    const stream = openStream(ctx, release);
    stream.send('snapshot', { tenantId: id.data, ts: clock(), policy: snapshot });

    const userId = ctx.principal?.userId;
    const unsubscribe = events.subscribe(id.data, (event: TenantEvent) => {
      if (isForwardedEvent(event)) {
        stream.send(event.type, { ts: clock(), ...eventPayload(event) });
      } else if (event.type === 'member.changed' && userId !== undefined && event.userId === userId && event.role === null) {
        // The user was removed from the tenant: end their stream immediately.
        stream.send('revoked', { reason: 'membership-removed' });
        stream.close();
      }
    });
    stream.onClose(unsubscribe);
  }

  /** GET /tenants/:tenantId/jobs/:jobId/stream — replay + live job output. */
  function jobStream(ctx: Ctx): void {
    const principal = ctx.principal;
    if (!principal) {
      sendError(ctx, 'UNAUTHENTICATED', UNAUTHENTICATED_MESSAGE);
      return;
    }
    const tenantId = validate(idSchema, ctx.params.tenantId);
    const jobId = validate(z.uuid(), ctx.params.jobId);
    if (!tenantId.ok) {
      sendResult(ctx, tenantId);
      return;
    }
    if (!jobId.ok) {
      sendResult(ctx, jobId);
      return;
    }
    const q = queryObject(ctx, { ints: ['afterSeq'] });
    if (!q.ok) {
      sendResult(ctx, q);
      return;
    }
    const fromHeader = ctx.req.headers['last-event-id'];
    const headerSeq = typeof fromHeader === 'string' && /^\d{1,15}$/.test(fromHeader) ? Number(fromHeader) : undefined;
    const afterSeq = typeof q.data.afterSeq === 'number' ? q.data.afterSeq : (headerSeq ?? 0);
    if (q.data.afterSeq !== undefined && typeof q.data.afterSeq !== 'number') {
      sendError(ctx, 'INVALID_REQUEST', 'afterSeq must be a non-negative integer.');
      return;
    }

    const access = authorizeJobAccess(jobDeps, principal, tenantId.data, jobId.data, 'job.stream');
    if (!access.ok) {
      sendResult(ctx, access);
      return;
    }
    const release = streamSlot(ctx);
    if (!release) {
      return;
    }
    const stream = openStream(ctx, release);

    let lastSeq = afterSeq;
    let lastStatus: string | undefined;
    const pump = (): void => {
      if (stream.closed) return;
      for (;;) {
        const job = options.jobs.get(tenantId.data, jobId.data);
        if (!job) {
          stream.send('error', { code: 'JOB_NOT_FOUND' });
          stream.close();
          return;
        }
        if (job.status !== lastStatus) {
          lastStatus = job.status;
          stream.send('status', { job: toJobView(job) });
        }
        const chunks = options.jobs.readOutput(tenantId.data, jobId.data, lastSeq, 200);
        for (const chunk of chunks) {
          stream.send(chunk.stream, { seq: chunk.seq, data: chunk.data, ts: chunk.ts }, chunk.seq);
          lastSeq = chunk.seq;
        }
        if (chunks.length === 200) {
          continue; // more buffered output to drain
        }
        if (TERMINAL_STATUSES.has(job.status)) {
          stream.send('exit', { job: toJobView(job) });
          stream.close();
        }
        return;
      }
    };

    const unsubscribe = events.subscribe(tenantId.data, (event: TenantEvent) => {
      if ((event.type === 'job.output' && event.jobId === jobId.data) || (event.type === 'job.updated' && event.job.id === jobId.data)) {
        pump();
      } else if (event.type === 'member.changed' && event.userId === principal.userId) {
        if (event.role === null || !roleSatisfies(event.role, 'operator')) {
          stream.send('revoked', { reason: 'access-removed' });
          stream.close();
        }
      }
    });
    // Safety net for a missed wake-up (events are in-process and best effort).
    const poll = setInterval(pump, 1000);
    poll.unref();
    stream.onClose(() => {
      unsubscribe();
      clearInterval(poll);
    });
    pump();
  }

  /**
   * GET /tenants/:t/sessions/:s/stream — the live session: a snapshot (or a replay
   * after `afterSeq` / Last-Event-ID), then every logged event in order, plus
   * ephemeral presence, signaling and relayed peer messages addressed to this user.
   */
  function sessionStream(ctx: Ctx): void {
    const principal = ctx.principal;
    if (!principal || !collabDeps || !hub) {
      sendError(ctx, 'UNAUTHENTICATED', UNAUTHENTICATED_MESSAGE);
      return;
    }
    const q = queryObject(ctx, { ints: ['afterSeq'] });
    if (!q.ok) {
      sendResult(ctx, q);
      return;
    }
    if (q.data.afterSeq !== undefined && typeof q.data.afterSeq !== 'number') {
      sendError(ctx, 'INVALID_REQUEST', 'afterSeq must be a non-negative integer.');
      return;
    }
    const fromHeader = ctx.req.headers['last-event-id'];
    const headerSeq =
      typeof fromHeader === 'string' && /^\d{1,15}$/.test(fromHeader) ? Number(fromHeader) : undefined;
    const afterSeq = typeof q.data.afterSeq === 'number' ? q.data.afterSeq : headerSeq;

    const authorized = authorizeSessionStream(collabDeps, {
      token: tokenOf(ctx),
      tenantId: ctx.params.tenantId,
      sessionId: ctx.params.sessionId,
    });
    if (!authorized.ok) {
      sendResult(ctx, authorized);
      return;
    }
    const { session } = authorized.data;
    const release = streamSlot(ctx);
    if (!release) {
      return;
    }
    const stream = openStream(ctx, release, 8 * 1024 * 1024);
    const listener: StreamListener = {
      userId: principal.userId,
      snapshot: (snapshot) => void stream.send('snapshot', snapshot, snapshot.seq),
      event: (event) => {
        stream.send(event.type, event, event.seq);
        if (event.type === 'session.ended') {
          stream.close();
        }
      },
      ready: (seq) => void stream.send('ready', { seq }),
      presence: (online) => void stream.send('presence', { online }),
      signal: (signal) => void stream.send('signal', signal),
      relay: (message) => void stream.send('relay', message),
    };
    const connection = hub.connect(session.tenantId, session.id, listener, afterSeq);
    if (!connection.ok) {
      stream.send('error', { code: connection.code });
      stream.close();
      return;
    }
    if (session.status === 'ended') {
      // History only: deliver the snapshot / replay and finish; there is nothing more to stream.
      stream.close();
    }
    const unsubscribe = events.subscribe(session.tenantId, (event: TenantEvent) => {
      if (event.type === 'member.changed' && event.userId === principal.userId) {
        if (event.role === null || !roleSatisfies(event.role, 'operator')) {
          stream.send('revoked', { reason: 'access-removed' });
          stream.close();
        }
      }
    });
    stream.onClose(() => {
      connection.close();
      unsubscribe();
    });
  }

  // ---- routes --------------------------------------------------------------

  const router = new Router<RouteDef>();
  const route = (method: string, def: RouteDef): void => {
    router.add(method, def.pattern, def);
  };

  route('GET', {
    pattern: '/healthz',
    auth: 'none',
    run: (ctx) => {
      try {
        options.health?.();
      } catch {
        sendError(ctx, 'SERVICE_UNAVAILABLE', 'The service is not ready.');
        return;
      }
      sendJson(ctx, 200, ok({ status: 'ok', version: options.version ?? '0.1.0' }));
    },
  });

  route('GET', {
    pattern: '/me',
    auth: 'user',
    run: userHandler(whoAmI, adminDeps, (ctx) => ok({ token: tokenOf(ctx) })),
  });

  route('POST', {
    pattern: '/tenants',
    auth: 'user',
    body: 'client',
    run: userHandler(createTenant, adminDeps, (ctx, body) => compose(body, { token: tokenOf(ctx) }), 201),
  });

  route('GET', {
    pattern: '/tenants/:tenantId/workspaces',
    auth: 'user',
    run: userHandler(listWorkspaces, adminDeps, (ctx) =>
      ok({ token: tokenOf(ctx), tenantId: ctx.params.tenantId })
    ),
  });

  route('POST', {
    pattern: '/tenants/:tenantId/workspaces',
    auth: 'user',
    body: 'client',
    run: userHandler(
      createWorkspace,
      adminDeps,
      (ctx, body) => compose(body, { token: tokenOf(ctx), tenantId: ctx.params.tenantId }),
      201
    ),
  });

  route('PUT', {
    pattern: '/tenants/:tenantId/workspaces/:workspaceId/grant',
    auth: 'user',
    body: 'client',
    run: userHandler(setWorkspaceGrant, adminDeps, (ctx, body) =>
      compose(body, {
        token: tokenOf(ctx),
        tenantId: ctx.params.tenantId,
        workspaceId: ctx.params.workspaceId,
      })
    ),
  });

  route('POST', {
    pattern: '/tenants/:tenantId/workspaces/:workspaceId/commands',
    auth: 'user',
    body: 'client',
    run: userHandler(
      submitCommand,
      jobDeps,
      (ctx, body) =>
        compose(body, {
          token: tokenOf(ctx),
          tenantId: ctx.params.tenantId,
          workspaceId: ctx.params.workspaceId,
        }),
      202
    ),
  });

  route('GET', {
    pattern: '/tenants/:tenantId/policy',
    auth: 'user',
    run: userHandler(getPolicy, adminDeps, (ctx) =>
      ok({ token: tokenOf(ctx), tenantId: ctx.params.tenantId })
    ),
  });

  route('PUT', {
    pattern: '/tenants/:tenantId/policy',
    auth: 'user',
    body: 'client',
    run: userHandler(updatePolicy, adminDeps, (ctx, body) =>
      compose(body, { token: tokenOf(ctx), tenantId: ctx.params.tenantId })
    ),
  });

  route('GET', {
    pattern: '/tenants/:tenantId/members',
    auth: 'user',
    run: userHandler(listMembers, adminDeps, (ctx) =>
      ok({ token: tokenOf(ctx), tenantId: ctx.params.tenantId })
    ),
  });

  route('PUT', {
    pattern: '/tenants/:tenantId/members/:userId',
    auth: 'user',
    body: 'client',
    run: userHandler(setMember, adminDeps, (ctx, body) =>
      compose(body, {
        token: tokenOf(ctx),
        tenantId: ctx.params.tenantId,
        userId: ctx.params.userId,
      })
    ),
  });

  route('DELETE', {
    pattern: '/tenants/:tenantId/members/:userId',
    auth: 'user',
    run: userHandler(removeMember, adminDeps, (ctx) =>
      ok({ token: tokenOf(ctx), tenantId: ctx.params.tenantId, userId: ctx.params.userId })
    ),
  });

  route('GET', { pattern: '/tenants/:tenantId/events', auth: 'any', run: (ctx) => tenantEvents(ctx) });

  route('GET', {
    pattern: '/tenants/:tenantId/jobs',
    auth: 'user',
    run: userHandler(listJobs, jobDeps, (ctx) => {
      const q = queryObject(ctx, { ints: ['limit'], strings: ['status'] });
      return q.ok ? ok({ ...q.data, token: tokenOf(ctx), tenantId: ctx.params.tenantId }) : q;
    }),
  });

  route('GET', {
    pattern: '/tenants/:tenantId/jobs/:jobId',
    auth: 'user',
    run: userHandler(getJob, jobDeps, (ctx) => {
      const q = queryObject(ctx, { ints: ['afterSeq', 'outputLimit'] });
      return q.ok
        ? ok({ ...q.data, token: tokenOf(ctx), tenantId: ctx.params.tenantId, jobId: ctx.params.jobId })
        : q;
    }),
  });

  route('GET', {
    pattern: '/tenants/:tenantId/jobs/:jobId/stream',
    auth: 'user',
    run: (ctx) => jobStream(ctx),
  });

  route('POST', {
    pattern: '/tenants/:tenantId/jobs/:jobId/cancel',
    auth: 'user',
    body: 'client',
    run: userHandler(cancelJob, jobDeps, (ctx, body) =>
      compose(body, {
        token: tokenOf(ctx),
        tenantId: ctx.params.tenantId,
        jobId: ctx.params.jobId,
      })
    ),
  });

  route('GET', {
    pattern: '/tenants/:tenantId/audit',
    auth: 'user',
    run: userHandler(queryAudit, adminDeps, (ctx) => {
      const q = queryObject(ctx, {
        ints: ['limit', 'beforeId'],
        strings: ['userId', 'workspaceId', 'commandId', 'action', 'decision'],
      });
      return q.ok ? ok({ ...q.data, token: tokenOf(ctx), tenantId: ctx.params.tenantId }) : q;
    }),
  });

  // Collaboration (shared sessions) ----------------------------------------------

  if (collabDeps) {
    const sessionServerFields = (ctx: Ctx): Record<string, unknown> => ({
      token: tokenOf(ctx),
      tenantId: ctx.params.tenantId,
      sessionId: ctx.params.sessionId,
    });

    route('POST', {
      pattern: '/tenants/:tenantId/sessions',
      auth: 'user',
      body: 'client',
      run: userHandler(
        createSession,
        collabDeps,
        (ctx, body) => compose(body, { token: tokenOf(ctx), tenantId: ctx.params.tenantId }),
        201
      ),
    });
    route('GET', {
      pattern: '/tenants/:tenantId/sessions',
      auth: 'user',
      run: userHandler(listSessions, collabDeps, (ctx) => {
        const q = queryObject(ctx, { ints: ['limit'], strings: ['status', 'workspaceId'] });
        return q.ok ? ok({ ...q.data, token: tokenOf(ctx), tenantId: ctx.params.tenantId }) : q;
      }),
    });
    route('GET', {
      pattern: '/tenants/:tenantId/sessions/:sessionId',
      auth: 'user',
      run: userHandler(getSession, collabDeps, (ctx) => ok(sessionServerFields(ctx))),
    });
    for (const [action, handler] of [
      ['join', joinSession],
      ['leave', leaveSession],
      ['end', endSession],
      ['handover', handoverControl],
    ] as const) {
      route('POST', {
        pattern: `/tenants/:tenantId/sessions/:sessionId/${action}`,
        auth: 'user',
        body: 'client',
        run: userHandler(handler, collabDeps, (ctx, body) => compose(body, sessionServerFields(ctx))),
      });
    }
    route('POST', {
      pattern: '/tenants/:tenantId/sessions/:sessionId/cancel',
      auth: 'user',
      body: 'client',
      run: userHandler(cancelRun, collabDeps, (ctx, body) => compose(body, sessionServerFields(ctx))),
    });
    route('POST', {
      pattern: '/tenants/:tenantId/sessions/:sessionId/run',
      auth: 'user',
      body: 'client',
      run: userHandler(runCommand, collabDeps, (ctx, body) => compose(body, sessionServerFields(ctx)), 202),
    });
    route('GET', {
      pattern: '/tenants/:tenantId/sessions/:sessionId/stream',
      auth: 'user',
      run: (ctx) => sessionStream(ctx),
    });
    route('GET', {
      pattern: '/tenants/:tenantId/sessions/:sessionId/events',
      auth: 'user',
      run: userHandler(listSessionEvents, collabDeps, (ctx) => {
        const q = queryObject(ctx, { ints: ['afterSeq', 'limit'] });
        return q.ok ? ok({ ...q.data, ...sessionServerFields(ctx) }) : q;
      }),
    });
    route('GET', {
      pattern: '/tenants/:tenantId/sessions/:sessionId/docs',
      auth: 'user',
      run: userHandler(listDocs, collabDeps, (ctx) => ok(sessionServerFields(ctx))),
    });
    route('POST', {
      pattern: '/tenants/:tenantId/sessions/:sessionId/docs',
      auth: 'user',
      body: 'client',
      run: userHandler(createDoc, collabDeps, (ctx, body) => compose(body, sessionServerFields(ctx)), 201),
    });
    route('GET', {
      pattern: '/tenants/:tenantId/sessions/:sessionId/docs/:docId',
      auth: 'user',
      run: userHandler(getDoc, collabDeps, (ctx) => ok({ ...sessionServerFields(ctx), docId: ctx.params.docId })),
    });
    route('POST', {
      pattern: '/tenants/:tenantId/sessions/:sessionId/docs/:docId/ops',
      auth: 'user',
      body: 'client',
      rate: 'collab',
      run: userHandler(submitDocOp, collabDeps, (ctx, body) =>
        compose(body, { ...sessionServerFields(ctx), docId: ctx.params.docId })
      ),
    });
    route('GET', {
      pattern: '/tenants/:tenantId/sessions/:sessionId/docs/:docId/ops',
      auth: 'user',
      run: userHandler(listDocOps, collabDeps, (ctx) => {
        const q = queryObject(ctx, { ints: ['afterRev', 'limit'] });
        return q.ok ? ok({ ...q.data, ...sessionServerFields(ctx), docId: ctx.params.docId }) : q;
      }),
    });
    route('POST', {
      pattern: '/tenants/:tenantId/sessions/:sessionId/signal',
      auth: 'user',
      body: 'client',
      rate: 'collab',
      run: userHandler(sendSignal, collabDeps, (ctx, body) => compose(body, sessionServerFields(ctx))),
    });
    route('POST', {
      pattern: '/tenants/:tenantId/sessions/:sessionId/relay',
      auth: 'user',
      body: 'client',
      rate: 'collab',
      run: userHandler(sendRelay, collabDeps, (ctx, body) => compose(body, sessionServerFields(ctx))),
    });
    route('GET', {
      pattern: '/tenants/:tenantId/analytics',
      auth: 'user',
      run: userHandler(getAnalytics, collabDeps, (ctx) => {
        const q = queryObject(ctx, { ints: ['from', 'to'], strings: ['workspaceId'] });
        return q.ok ? ok({ ...q.data, token: tokenOf(ctx), tenantId: ctx.params.tenantId }) : q;
      }),
    });
  }

  // Worker protocol -----------------------------------------------------------

  route('POST', {
    pattern: '/worker/claim',
    auth: 'worker',
    body: 'worker',
    run: async (ctx, body) => {
      const worker = ctx.worker;
      if (!worker) {
        sendError(ctx, 'UNAUTHENTICATED', UNAUTHENTICATED_MESSAGE);
        return;
      }
      // Stop waiting (and stop claiming) if the worker hangs up mid long-poll.
      const abort = new AbortController();
      ctx.res.on('close', () => abort.abort());
      const result = await claimJob(workerDeps, worker, body, abort.signal);
      if (!abort.signal.aborted) {
        sendResult(ctx, result);
      }
    },
  });

  route('POST', {
    pattern: '/worker/jobs/:jobId/output',
    auth: 'worker',
    body: 'worker',
    run: (ctx, body) => {
      if (!ctx.worker) {
        sendError(ctx, 'UNAUTHENTICATED', UNAUTHENTICATED_MESSAGE);
        return;
      }
      sendResult(ctx, workerAppendOutput(workerDeps, ctx.worker, ctx.params.jobId, body));
    },
  });

  route('POST', {
    pattern: '/worker/jobs/:jobId/exit',
    auth: 'worker',
    body: 'worker',
    run: (ctx, body) => {
      if (!ctx.worker) {
        sendError(ctx, 'UNAUTHENTICATED', UNAUTHENTICATED_MESSAGE);
        return;
      }
      sendResult(ctx, workerFinishJob(workerDeps, ctx.worker, ctx.params.jobId, body));
    },
  });

  // ---- request loop ----------------------------------------------------------

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const started = clock();
    const cors = corsHeadersFor(req);
    const ip = clientAddress(req, trustProxy);
    const url = new URL(req.url ?? '/', 'http://control-plane.invalid');
    const method = (req.method ?? 'GET').toUpperCase();
    const pre: Pick<Ctx, 'res' | 'cors'> = { res, cors };

    res.on('finish', () => {
      log({
        ts: started,
        ms: clock() - started,
        method,
        path: url.pathname,
        status: res.statusCode,
      });
    });

    // CORS preflight: answer for allowed origins only; never reaches auth.
    if (method === 'OPTIONS') {
      req.resume();
      if (Object.keys(cors).length === 0) {
        res.writeHead(204, baseHeaders({}));
        res.end();
        return;
      }
      res.writeHead(204, {
        ...baseHeaders(cors),
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Last-Event-ID',
        'Access-Control-Max-Age': '600',
      });
      res.end();
      return;
    }

    // The per-address limit covers ANONYMOUS traffic only (unknown routes and
    // unauthenticated routes). Authenticated callers are limited per principal
    // below, so many users — or busy workers — behind one NAT/proxy address do not
    // starve each other; failed authentications are throttled per address in
    // authenticateCtx().
    const anonymousGate = (): boolean => {
      const verdict = ipLimiter.take(ip, clock());
      if (verdict.allowed) {
        return true;
      }
      req.resume();
      sendError(pre, 'RATE_LIMITED', 'Rate limit exceeded.', undefined, {
        'Retry-After': String(Math.max(1, Math.ceil(verdict.retryAfterMs / 1000))),
      });
      return false;
    };

    const lookup = router.lookup(method, url.pathname);
    if (lookup.kind === 'not-found') {
      if (!anonymousGate()) return;
      req.resume();
      sendError(pre, 'NOT_FOUND', 'No such route.');
      return;
    }
    if (lookup.kind === 'method-not-allowed') {
      if (!anonymousGate()) return;
      req.resume();
      sendError(pre, 'METHOD_NOT_ALLOWED', 'Method not allowed for this route.', undefined, {
        Allow: lookup.allowed.join(', '),
      });
      return;
    }

    const { route: def, params } = lookup.match;
    const ctx: Ctx = {
      req,
      res,
      params,
      query: url.searchParams,
      token: bearerToken(req.headers.authorization),
      ip,
      cors,
    };

    if (def.auth === 'none' && !anonymousGate()) {
      return;
    }

    if (!authenticateCtx(ctx, def)) {
      req.resume();
      return;
    }
    if (!principalRateLimit(ctx, def)) {
      req.resume();
      return;
    }

    let body: Record<string, unknown> = {};
    if (def.body) {
      const parsed = await readJsonBody(
        req,
        def.body === 'worker' ? limits.workerBodyBytes : limits.bodyBytes
      );
      if (!parsed.ok) {
        // Do not keep reading an oversized/garbled upload on this connection.
        res.setHeader('Connection', 'close');
        sendError(ctx, parsed.code, parsed.message);
        return;
      }
      body = parsed.value;
    } else {
      req.resume();
    }

    await def.run(ctx, body);
  }

  const server = http.createServer({ maxHeaderSize: 16 * 1024 }, (req, res) => {
    handle(req, res).catch((error: unknown) => {
      log({
        level: 'error',
        message: 'unhandled request error',
        error: error instanceof Error ? error.message : String(error),
      });
      if (!res.headersSent) {
        sendError({ res, cors: {} }, 'INTERNAL_ERROR', 'Internal error.');
      } else {
        res.destroy();
      }
    });
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.maxConnections = 1024;

  let reaper: NodeJS.Timeout | undefined;

  return {
    server,
    events,
    collabHub: hub,
    listen(port, host) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          const address = server.address() as AddressInfo;
          reaper = setInterval(() => {
            try {
              reapExpiredJobs(workerDeps);
            } catch (error) {
              log({
                level: 'error',
                message: 'job reaper failed',
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }, limits.reapIntervalMs);
          reaper.unref();
          // Pick up session runs that were in flight when the process last stopped.
          hub?.recover();
          const shownHost = address.address.includes(':') ? `[${address.address}]` : address.address;
          resolve({
            port: address.port,
            host: address.address,
            url: `http://${shownHost}:${address.port}`,
          });
        });
      });
    },
    close() {
      return new Promise((resolve) => {
        if (reaper) {
          clearInterval(reaper);
        }
        for (const stream of Array.from(liveStreams)) {
          stream.close();
        }
        hub?.close();
        server.close(() => resolve());
        server.closeAllConnections();
      });
    },
  };
}
