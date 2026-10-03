import { z } from 'zod';

import { authorizeProxyCommand } from './api.js';
import type { AuditSink } from './audit.js';
import { Principal, roleSatisfies } from './auth.js';
import { authorizeCommand } from './authz.js';
import { ControlPlaneResult, fail, ok } from './errors.js';
import type { EventBus, EventPublisher } from './events.js';
import type { WorkerIdentity } from './identity.js';
import {
  ControlPlaneDeps,
  authedRequest,
  authorizeTenantAudited,
  nowOf,
  validate,
} from './pipeline.js';
import { SqliteJobStore } from './db/sqlite-jobs.js';
import type { Job, JobOutputChunk, JobStatus } from './db/sqlite-jobs.js';
import { buildPolicySnapshot } from './policy.js';
import { TenantAdminStore, idSchema } from './tenant.js';

/**
 * Job service: turns an AUTHORIZED command decision into a durable queued job,
 * lets execution workers claim and report on jobs, and lets clients read them.
 *
 * The control plane never builds argv and never spawns a process. A queued job
 * carries only `{ tenantId, workspaceId, commandId, params }`; the worker maps
 * that onto an argv through the shared allow-list registry
 * (@re-shell/contracts/command-registry) and spawns the CLI without a shell.
 *
 * Enforcement is re-applied when a worker CLAIMS a job: the tenant ceiling, the
 * workspace grant and the requester's role are read again, so a policy change
 * (or a demoted requester) takes effect for jobs that were queued before it.
 */

export const DEFAULT_MAX_QUEUED_PER_TENANT = 100;
export const DEFAULT_LEASE_MS = 60_000;
export const MAX_CLAIM_WAIT_MS = 25_000;

export interface JobDeps extends ControlPlaneDeps {
  store: TenantAdminStore;
  jobs: SqliteJobStore;
  events?: EventPublisher;
  maxQueuedPerTenant?: number;
}

/** The client-visible shape of a job. */
export interface JobView {
  id: string;
  tenantId: string;
  workspaceId: string;
  commandId: string;
  params: Record<string, unknown>;
  requestedBy: string;
  status: JobStatus;
  exitCode: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  cancelRequested: boolean;
  outputBytes: number;
  outputTruncated: boolean;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export function toJobView(job: Job): JobView {
  return {
    id: job.id,
    tenantId: job.tenantId,
    workspaceId: job.workspaceId,
    commandId: job.commandId,
    params: job.params,
    requestedBy: job.requestedBy,
    status: job.status,
    exitCode: job.exitCode,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    cancelRequested: job.cancelRequested,
    outputBytes: job.outputBytes,
    outputTruncated: job.outputTruncated,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

function publishJobUpdated(deps: { events?: EventPublisher }, job: Job): void {
  deps.events?.publish({
    type: 'job.updated',
    tenantId: job.tenantId,
    job: {
      id: job.id,
      workspaceId: job.workspaceId,
      commandId: job.commandId,
      status: job.status,
      exitCode: job.exitCode,
    },
  });
}

// ---------------------------------------------------------------------------
// Client-facing handlers
// ---------------------------------------------------------------------------

const jobIdSchema = z.uuid();

const submitFields = {
  token: z.string(),
  tenantId: idSchema,
};

export const listJobsRequestSchema = z
  .object({
    ...submitFields,
    limit: z.number().int().min(1).max(200).optional(),
    status: z.enum(['queued', 'running', 'succeeded', 'failed', 'canceled']).optional(),
  })
  .strict();

export const getJobRequestSchema = z
  .object({
    ...submitFields,
    jobId: jobIdSchema,
    /** Return output chunks with seq greater than this (polling cursor). */
    afterSeq: z.number().int().min(0).optional(),
    outputLimit: z.number().int().min(1).max(1000).optional(),
  })
  .strict();

export const cancelJobRequestSchema = z
  .object({ ...submitFields, jobId: jobIdSchema })
  .strict();

/**
 * POST /tenants/:tenantId/workspaces/:workspaceId/commands — authorize (audited)
 * and queue a job for a worker. 202 semantics: the command has NOT run yet.
 */
export function submitCommand(deps: JobDeps, body: unknown): ControlPlaneResult<{ job: JobView }> {
  const authorized = authorizeProxyCommand(deps, body);
  if (!authorized.ok) {
    return authorized;
  }
  const { principal, decision } = authorized.data;
  const limit = deps.maxQueuedPerTenant ?? DEFAULT_MAX_QUEUED_PER_TENANT;
  const job = deps.jobs.enqueue({
    tenantId: decision.tenantId,
    workspaceId: decision.workspaceId,
    commandId: decision.commandId,
    params: decision.params,
    requestedBy: principal.userId,
    now: nowOf(deps),
    maxQueued: limit,
  });
  if (!job) {
    return fail('RATE_LIMITED', 'Too many queued jobs for this tenant; try again shortly.', {
      limit,
    });
  }
  deps.events?.publish({ type: 'job.queued', tenantId: job.tenantId, jobId: job.id });
  publishJobUpdated(deps, job);
  return ok({ job: toJobView(job) });
}

/** GET /tenants/:tenantId/jobs — recent jobs of the tenant (operator). */
export function listJobs(deps: JobDeps, body: unknown): ControlPlaneResult<{ jobs: JobView[] }> {
  const req = authedRequest(deps, listJobsRequestSchema, body, 'job.list');
  if (!req.ok) {
    return req;
  }
  const { principal, input } = req.data;
  const authorized = authorizeTenantAudited(deps, principal, input.tenantId, 'operator', {
    action: 'job.list',
  });
  if (!authorized.ok) {
    return authorized;
  }
  const jobs = deps.jobs.list(input.tenantId, { limit: input.limit ?? 50, status: input.status });
  return ok({ jobs: jobs.map(toJobView) });
}

export interface JobDetail {
  job: JobView;
  output: { chunks: JobOutputChunk[]; nextSeq: number };
}

/** Authorize access to ONE job's detail/stream (operator, tenant-scoped lookup). */
export function authorizeJobAccess(
  deps: JobDeps,
  principal: Principal,
  tenantId: string,
  jobId: string,
  action: 'job.read' | 'job.stream'
): ControlPlaneResult<Job> {
  const authorized = authorizeTenantAudited(deps, principal, tenantId, 'operator', {
    action,
    detail: { jobId },
  });
  if (!authorized.ok) {
    return authorized;
  }
  // Tenant-first lookup: another tenant's job id is simply "not found".
  const job = deps.jobs.get(authorized.data.tenant.id, jobId);
  if (!job) {
    return fail('JOB_NOT_FOUND', 'Job not found in this tenant.', { jobId });
  }
  return ok(job);
}

/** GET /tenants/:tenantId/jobs/:jobId — status plus output since a cursor (operator). */
export function getJob(deps: JobDeps, body: unknown): ControlPlaneResult<JobDetail> {
  const req = authedRequest(deps, getJobRequestSchema, body, 'job.read');
  if (!req.ok) {
    return req;
  }
  const { principal, input } = req.data;
  const access = authorizeJobAccess(deps, principal, input.tenantId, input.jobId, 'job.read');
  if (!access.ok) {
    return access;
  }
  const chunks = deps.jobs.readOutput(
    input.tenantId,
    input.jobId,
    input.afterSeq ?? 0,
    input.outputLimit ?? 200
  );
  return ok({
    job: toJobView(access.data),
    output: {
      chunks,
      nextSeq: chunks.length > 0 ? chunks[chunks.length - 1].seq : (input.afterSeq ?? 0),
    },
  });
}

/** POST /tenants/:tenantId/jobs/:jobId/cancel — cancel a queued or running job (operator). */
export function cancelJob(deps: JobDeps, body: unknown): ControlPlaneResult<{ job: JobView }> {
  const req = authedRequest(deps, cancelJobRequestSchema, body, 'job.cancel');
  if (!req.ok) {
    return req;
  }
  const { principal, input } = req.data;
  const authorized = authorizeTenantAudited(deps, principal, input.tenantId, 'operator', {
    action: 'job.cancel',
    detail: { jobId: input.jobId },
  });
  if (!authorized.ok) {
    return authorized;
  }
  const existing = deps.jobs.get(input.tenantId, input.jobId);
  if (!existing) {
    return fail('JOB_NOT_FOUND', 'Job not found in this tenant.', { jobId: input.jobId });
  }
  const updated = deps.jobs.requestCancel(input.tenantId, input.jobId, nowOf(deps));
  if (!updated) {
    return fail('CONFLICT', 'The job has already finished.', { jobId: input.jobId });
  }
  publishJobUpdated(deps, updated);
  return ok({ job: toJobView(updated) });
}

// ---------------------------------------------------------------------------
// Worker-facing handlers
// ---------------------------------------------------------------------------

export interface WorkerJobDeps {
  store: TenantAdminStore;
  jobs: SqliteJobStore;
  events: EventBus;
  audit?: AuditSink;
  now?: () => number;
  /** How long a claimed job may go without a heartbeat before it is reaped. */
  leaseMs?: number;
}

/** What a worker receives when it claims a job. */
export interface ClaimedJob {
  job: {
    id: string;
    tenantId: string;
    workspaceId: string;
    commandId: string;
    params: Record<string, unknown>;
  };
  /** The policy in force at claim time; the worker enforces it too (defense in depth). */
  policy: {
    policyVersion: number;
    policyPack: string | null;
    /** ceiling ∩ grant for this job's workspace. */
    effectiveCommandIds: string[];
  };
  leaseExpiresAt: number;
}

export const claimRequestSchema = z
  .object({ waitMs: z.number().int().min(0).max(MAX_CLAIM_WAIT_MS).default(0) })
  .strict();

export const outputRequestSchema = z
  .object({
    chunks: z
      .array(
        z
          .object({
            stream: z.enum(['stdout', 'stderr']),
            data: z.string().max(64 * 1024),
          })
          .strict()
      )
      .max(256),
  })
  .strict();

export const finishRequestSchema = z
  .object({
    exitCode: z.number().int().min(0).max(255).nullable(),
    signal: z.string().max(32).nullable().optional(),
    errorCode: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]{0,63}$/)
      .optional(),
    errorMessage: z.string().max(2000).optional(),
    canceled: z.boolean().optional(),
  })
  .strict();

function nowFor(deps: { now?: () => number }): number {
  return deps.now ? deps.now() : Date.now();
}

/**
 * Re-evaluate a QUEUED job against the policy and membership in force right
 * now. Returns the denial, or null when it may run.
 */
function reauthorize(
  deps: WorkerJobDeps,
  job: Job
): { code: string; message: string } | null {
  const tenant = deps.store.getTenant(job.tenantId);
  if (!tenant) {
    return { code: 'TENANT_NOT_FOUND', message: 'The tenant no longer exists.' };
  }
  const workspace = deps.store.getWorkspace(job.tenantId, job.workspaceId);
  if (!workspace) {
    return { code: 'WORKSPACE_NOT_FOUND', message: 'The workspace no longer exists.' };
  }
  const allowed = authorizeCommand(tenant, workspace, job.commandId);
  if (!allowed.ok) {
    return {
      code: 'COMMAND_NOT_ALLOWED',
      message: 'Team policy no longer allows this command for the workspace.',
    };
  }
  const role = deps.store.getMemberships(job.requestedBy)[job.tenantId];
  if (!role || !roleSatisfies(role, 'operator')) {
    return {
      code: 'REQUESTER_NOT_AUTHORIZED',
      message: 'The requesting user no longer holds the operator role.',
    };
  }
  return null;
}

function auditClaim(
  deps: WorkerJobDeps,
  worker: WorkerIdentity,
  job: Job,
  decision: 'allow' | 'deny',
  code: string | null
): void {
  // A claim is only authorized if it is recorded: let a failure propagate.
  deps.audit?.record({
    ts: nowFor(deps),
    userId: `worker:${worker.workerId}`,
    tenantId: job.tenantId,
    workspaceId: job.workspaceId,
    commandId: job.commandId,
    action: 'job.claim',
    decision,
    code,
    detail: { jobId: job.id, requestedBy: job.requestedBy },
  });
}

/** Fail running jobs whose worker went silent. Returns how many were reaped. */
export function reapExpiredJobs(deps: WorkerJobDeps): number {
  const reaped = deps.jobs.reapExpired(nowFor(deps));
  for (const job of reaped) {
    publishJobUpdated(deps, job);
  }
  return reaped.length;
}

function tryClaimOne(deps: WorkerJobDeps, worker: WorkerIdentity): ClaimedJob | null {
  const now = nowFor(deps);
  const leaseMs = deps.leaseMs ?? DEFAULT_LEASE_MS;
  reapExpiredJobs(deps);

  for (const candidate of deps.jobs.peekQueued(worker.tenantId, 10)) {
    const denial = reauthorize(deps, candidate);
    if (denial) {
      auditClaim(deps, worker, candidate, 'deny', denial.code);
      const failed = deps.jobs.failQueued(
        candidate.tenantId,
        candidate.id,
        denial.code,
        denial.message,
        now
      );
      if (failed) {
        publishJobUpdated(deps, failed);
      }
      continue;
    }
    // Record the allow BEFORE flipping the job to running: unaudited work never starts.
    auditClaim(deps, worker, candidate, 'allow', null);
    const claimed = deps.jobs.tryClaim(
      candidate.tenantId,
      candidate.id,
      worker.workerId,
      now,
      leaseMs
    );
    if (!claimed) {
      continue; // another worker (or a cancel) got there first
    }
    publishJobUpdated(deps, claimed);
    const snapshot = buildPolicySnapshot(deps.store, claimed.tenantId);
    const effective =
      snapshot?.workspaces.find((w) => w.id === claimed.workspaceId)?.effectiveCommandIds ?? [];
    return {
      job: {
        id: claimed.id,
        tenantId: claimed.tenantId,
        workspaceId: claimed.workspaceId,
        commandId: claimed.commandId,
        params: claimed.params,
      },
      policy: {
        policyVersion: snapshot?.policyVersion ?? 0,
        policyPack: snapshot?.policyPack ?? null,
        effectiveCommandIds: [...effective],
      },
      leaseExpiresAt: now + leaseMs,
    };
  }
  return null;
}

function waitForQueued(
  events: EventBus,
  tenantId: string,
  ms: number,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve) => {
    let timer: NodeJS.Timeout | undefined;
    const finish = (): void => {
      if (timer) clearTimeout(timer);
      unsubscribe();
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const unsubscribe = events.subscribe(tenantId, (event) => {
      if (event.type === 'job.queued') {
        finish();
      }
    });
    timer = setTimeout(finish, ms);
    signal?.addEventListener('abort', finish, { once: true });
  });
}

/**
 * POST /worker/claim — long-poll for the next job of the worker's tenant. The
 * worker is bound to ONE tenant by its token; it can only ever see that
 * tenant's queue.
 */
export async function claimJob(
  deps: WorkerJobDeps,
  worker: WorkerIdentity,
  body: unknown,
  signal?: AbortSignal
): Promise<ControlPlaneResult<{ claim: ClaimedJob | null }>> {
  const validated = validate(claimRequestSchema, body ?? {});
  if (!validated.ok) {
    return validated;
  }
  const deadline = nowFor(deps) + validated.data.waitMs;
  for (;;) {
    if (signal?.aborted) {
      // The worker hung up: never hand work to a connection that is gone.
      return ok({ claim: null });
    }
    let claimed: ClaimedJob | null;
    try {
      claimed = tryClaimOne(deps, worker);
    } catch {
      return fail('INTERNAL_ERROR', 'Audit trail unavailable; refusing to hand out work.');
    }
    if (claimed) {
      return ok({ claim: claimed });
    }
    const remaining = deadline - nowFor(deps);
    if (remaining <= 0 || signal?.aborted) {
      return ok({ claim: null });
    }
    // Wake on a queued-job event, or re-check every second as a safety net.
    await waitForQueued(deps.events, worker.tenantId, Math.min(remaining, 1000), signal);
  }
}

/** POST /worker/jobs/:jobId/output — append output / heartbeat (job owner only). */
export function workerAppendOutput(
  deps: WorkerJobDeps,
  worker: WorkerIdentity,
  jobId: string,
  body: unknown
): ControlPlaneResult<{ cancelRequested: boolean; truncated: boolean }> {
  const id = jobIdSchema.safeParse(jobId);
  const validated = validate(outputRequestSchema, body);
  if (!id.success || !validated.ok) {
    return validated.ok ? fail('INVALID_REQUEST', 'Malformed job id.') : validated;
  }
  const result = deps.jobs.appendOutput(
    worker.tenantId,
    id.data,
    worker.workerId,
    validated.data.chunks,
    nowFor(deps),
    deps.leaseMs ?? DEFAULT_LEASE_MS
  );
  if (!result) {
    // Not found, not running, finished, reaped, or owned by another worker: all
    // the same answer.
    return fail('JOB_NOT_FOUND', 'No running job with this id for this worker.');
  }
  if (result.accepted > 0) {
    deps.events.publish({ type: 'job.output', tenantId: worker.tenantId, jobId: id.data });
  }
  return ok({ cancelRequested: result.job.cancelRequested, truncated: result.job.outputTruncated });
}

/** POST /worker/jobs/:jobId/exit — report the final result (job owner only). */
export function workerFinishJob(
  deps: WorkerJobDeps,
  worker: WorkerIdentity,
  jobId: string,
  body: unknown
): ControlPlaneResult<{ job: JobView }> {
  const id = jobIdSchema.safeParse(jobId);
  const validated = validate(finishRequestSchema, body);
  if (!id.success || !validated.ok) {
    return validated.ok ? fail('INVALID_REQUEST', 'Malformed job id.') : validated;
  }
  const finished = deps.jobs.complete(
    worker.tenantId,
    id.data,
    worker.workerId,
    {
      exitCode: validated.data.exitCode,
      errorCode: validated.data.errorCode ?? null,
      errorMessage: validated.data.errorMessage ?? null,
      canceled: validated.data.canceled ?? false,
    },
    nowFor(deps)
  );
  if (!finished) {
    return fail('JOB_NOT_FOUND', 'No running job with this id for this worker.');
  }
  publishJobUpdated(deps, finished);
  deps.events.publish({ type: 'job.output', tenantId: worker.tenantId, jobId: finished.id });
  return ok({ job: toJobView(finished) });
}
