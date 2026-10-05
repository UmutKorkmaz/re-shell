import { randomUUID } from 'node:crypto';

import { DatabaseSync, Row, StatementSync, transaction } from './sqlite.js';

/**
 * Durable job queue + output log.
 *
 * Every accessor is tenant-first (`WHERE tenant_id = ? AND id = ?`): a job id
 * from another tenant is indistinguishable from one that does not exist, and a
 * worker bound to tenant A can never read, claim, append to or finish a job of
 * tenant B even by guessing its id.
 */

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
export type JobStream = 'stdout' | 'stderr';

export const TERMINAL_STATUSES: ReadonlySet<JobStatus> = new Set(['succeeded', 'failed', 'canceled']);

export interface Job {
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
  workerId: string | null;
  cancelRequested: boolean;
  outputBytes: number;
  outputTruncated: boolean;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface JobOutputChunk {
  seq: number;
  stream: JobStream;
  data: string;
  ts: number;
}

/** Cap on stored output per job; excess is dropped and the job flagged truncated. */
export const MAX_JOB_OUTPUT_BYTES = 4 * 1024 * 1024;

export interface EnqueueInput {
  tenantId: string;
  workspaceId: string;
  commandId: string;
  params: Record<string, unknown>;
  requestedBy: string;
  now: number;
  /** Refuse (returns undefined) when the tenant already has this many queued jobs. */
  maxQueued: number;
}

export interface CompleteInput {
  exitCode: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  /** The worker reports the job ended because a cancel was requested. */
  canceled?: boolean;
}

function jobFromRow(row: Row): Job {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    workspaceId: String(row.workspace_id),
    commandId: String(row.command_id),
    params: JSON.parse(String(row.params)) as Record<string, unknown>,
    requestedBy: String(row.requested_by),
    status: row.status as JobStatus,
    exitCode: row.exit_code === null ? null : Number(row.exit_code),
    errorCode: (row.error_code as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    workerId: (row.worker_id as string | null) ?? null,
    cancelRequested: Number(row.cancel_requested) === 1,
    outputBytes: Number(row.output_bytes),
    outputTruncated: Number(row.output_truncated) === 1,
    createdAt: Number(row.created_at),
    startedAt: row.started_at === null ? null : Number(row.started_at),
    finishedAt: row.finished_at === null ? null : Number(row.finished_at),
  };
}

const COLUMNS = `id, tenant_id, workspace_id, command_id, params, requested_by, status, exit_code,
  error_code, error_message, worker_id, cancel_requested, output_bytes, output_truncated,
  created_at, started_at, finished_at`;

export class SqliteJobStore {
  private readonly s: Record<string, StatementSync>;

  constructor(private readonly db: DatabaseSync) {
    this.s = {
      insert: db.prepare(
        `INSERT INTO jobs (id, tenant_id, workspace_id, command_id, params, requested_by, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)`
      ),
      countQueued: db.prepare(
        "SELECT COUNT(*) AS n FROM jobs WHERE tenant_id = ? AND status = 'queued'"
      ),
      get: db.prepare(`SELECT ${COLUMNS} FROM jobs WHERE tenant_id = ? AND id = ?`),
      list: db.prepare(
        `SELECT ${COLUMNS} FROM jobs WHERE tenant_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`
      ),
      listByStatus: db.prepare(
        `SELECT ${COLUMNS} FROM jobs WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`
      ),
      peekQueued: db.prepare(
        `SELECT ${COLUMNS} FROM jobs WHERE tenant_id = ? AND status = 'queued'
          ORDER BY created_at, rowid LIMIT ?`
      ),
      claim: db.prepare(
        `UPDATE jobs SET status = 'running', worker_id = ?, lease_expires_at = ?, started_at = ?
          WHERE tenant_id = ? AND id = ? AND status = 'queued'`
      ),
      maxSeq: db.prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM job_output WHERE job_id = ?'),
      insertOutput: db.prepare(
        'INSERT INTO job_output (job_id, seq, stream, data, ts) VALUES (?, ?, ?, ?, ?)'
      ),
      updateOutputMeta: db.prepare(
        `UPDATE jobs SET output_bytes = ?, output_truncated = ?, lease_expires_at = ?
          WHERE tenant_id = ? AND id = ?`
      ),
      extendLease: db.prepare(
        'UPDATE jobs SET lease_expires_at = ? WHERE tenant_id = ? AND id = ?'
      ),
      readOutput: db.prepare(
        `SELECT o.seq, o.stream, o.data, o.ts FROM job_output o
           JOIN jobs j ON j.id = o.job_id
          WHERE j.tenant_id = ? AND o.job_id = ? AND o.seq > ? ORDER BY o.seq LIMIT ?`
      ),
      finish: db.prepare(
        `UPDATE jobs SET status = ?, exit_code = ?, error_code = ?, error_message = ?,
                finished_at = ?, lease_expires_at = NULL
          WHERE tenant_id = ? AND id = ?`
      ),
      setCancel: db.prepare(
        "UPDATE jobs SET cancel_requested = 1 WHERE tenant_id = ? AND id = ? AND status = 'running'"
      ),
      expired: db.prepare(
        `SELECT ${COLUMNS} FROM jobs WHERE status = 'running' AND lease_expires_at IS NOT NULL
            AND lease_expires_at < ?`
      ),
    };
  }

  /** Queue a job; returns undefined when the tenant's queue is full. */
  enqueue(input: EnqueueInput): Job | undefined {
    return transaction(this.db, () => {
      const queued = (this.s.countQueued.get(input.tenantId) as { n: number }).n;
      if (queued >= input.maxQueued) {
        return undefined;
      }
      const id = randomUUID();
      this.s.insert.run(
        id,
        input.tenantId,
        input.workspaceId,
        input.commandId,
        JSON.stringify(input.params),
        input.requestedBy,
        input.now
      );
      return this.mustGet(input.tenantId, id);
    });
  }

  get(tenantId: string, jobId: string): Job | undefined {
    const row = this.s.get.get(tenantId, jobId) as Row | undefined;
    return row ? jobFromRow(row) : undefined;
  }

  private mustGet(tenantId: string, jobId: string): Job {
    const job = this.get(tenantId, jobId);
    if (!job) {
      throw new Error('Job vanished');
    }
    return job;
  }

  list(tenantId: string, options: { limit: number; status?: JobStatus }): Job[] {
    const rows = (
      options.status
        ? this.s.listByStatus.all(tenantId, options.status, options.limit)
        : this.s.list.all(tenantId, options.limit)
    ) as Row[];
    return rows.map(jobFromRow);
  }

  /** Oldest queued jobs of one tenant (not claimed). */
  peekQueued(tenantId: string, limit: number): Job[] {
    return (this.s.peekQueued.all(tenantId, limit) as Row[]).map(jobFromRow);
  }

  /**
   * Atomically move a queued job to running for `workerId`. Returns the running
   * job, or undefined when someone else claimed (or canceled) it first.
   */
  tryClaim(
    tenantId: string,
    jobId: string,
    workerId: string,
    now: number,
    leaseMs: number
  ): Job | undefined {
    const result = this.s.claim.run(workerId, now + leaseMs, now, tenantId, jobId);
    return result.changes === 1 ? this.get(tenantId, jobId) : undefined;
  }

  /**
   * Append output from the owning worker. Returns undefined when the job is not
   * running for this worker in this tenant. Output beyond
   * {@link MAX_JOB_OUTPUT_BYTES} is dropped and the job flagged truncated.
   * Always extends the lease (an empty chunk list is a heartbeat).
   */
  appendOutput(
    tenantId: string,
    jobId: string,
    workerId: string,
    chunks: ReadonlyArray<{ stream: JobStream; data: string }>,
    now: number,
    leaseMs: number
  ): { job: Job; accepted: number } | undefined {
    return transaction(this.db, () => {
      const job = this.get(tenantId, jobId);
      if (!job || job.status !== 'running' || job.workerId !== workerId) {
        return undefined;
      }
      let bytes = job.outputBytes;
      let truncated = job.outputTruncated;
      let seq = (this.s.maxSeq.get(jobId) as { seq: number }).seq;
      let accepted = 0;
      for (const chunk of chunks) {
        if (truncated) {
          break;
        }
        let data = chunk.data;
        const size = Buffer.byteLength(data, 'utf8');
        if (bytes + size > MAX_JOB_OUTPUT_BYTES) {
          const room = Math.max(0, MAX_JOB_OUTPUT_BYTES - bytes);
          data = Buffer.from(data, 'utf8').subarray(0, room).toString('utf8');
          truncated = true;
        }
        if (data.length > 0) {
          seq += 1;
          this.s.insertOutput.run(jobId, seq, chunk.stream, data, now);
          bytes += Buffer.byteLength(data, 'utf8');
          accepted += 1;
        }
      }
      this.s.updateOutputMeta.run(bytes, truncated ? 1 : 0, now + leaseMs, tenantId, jobId);
      return { job: this.mustGet(tenantId, jobId), accepted };
    });
  }

  /** Output chunks after `afterSeq`, oldest first. Tenant-scoped via the jobs join. */
  readOutput(tenantId: string, jobId: string, afterSeq: number, limit: number): JobOutputChunk[] {
    return (this.s.readOutput.all(tenantId, jobId, afterSeq, limit) as Row[]).map((row) => ({
      seq: Number(row.seq),
      stream: row.stream as JobStream,
      data: String(row.data),
      ts: Number(row.ts),
    }));
  }

  /**
   * Finish a RUNNING job owned by `workerId`. Returns undefined when the job is
   * not running for this worker in this tenant (already finished, reaped, or not
   * theirs) so a late or forged completion is ignored.
   */
  complete(
    tenantId: string,
    jobId: string,
    workerId: string,
    input: CompleteInput,
    now: number
  ): Job | undefined {
    return transaction(this.db, () => {
      const job = this.get(tenantId, jobId);
      if (!job || job.status !== 'running' || job.workerId !== workerId) {
        return undefined;
      }
      let status: JobStatus;
      if (input.canceled && job.cancelRequested) {
        // Only a cancel somebody actually requested can end a job as canceled.
        status = 'canceled';
      } else if (input.errorCode || input.exitCode === null || input.exitCode !== 0) {
        status = 'failed';
      } else {
        status = 'succeeded';
      }
      this.s.finish.run(
        status,
        input.exitCode,
        input.errorCode ?? null,
        input.errorMessage ?? null,
        now,
        tenantId,
        jobId
      );
      return this.mustGet(tenantId, jobId);
    });
  }

  /** Fail a QUEUED job without running it (policy re-check at claim time, etc.). */
  failQueued(
    tenantId: string,
    jobId: string,
    errorCode: string,
    errorMessage: string,
    now: number
  ): Job | undefined {
    return transaction(this.db, () => {
      const job = this.get(tenantId, jobId);
      if (!job || job.status !== 'queued') {
        return undefined;
      }
      this.s.finish.run('failed', null, errorCode, errorMessage, now, tenantId, jobId);
      return this.mustGet(tenantId, jobId);
    });
  }

  /**
   * Cancel: a queued job is canceled immediately; a running job is flagged so
   * its worker stops it. Returns the job after the change, or undefined when it
   * does not exist in this tenant or is already finished.
   */
  requestCancel(tenantId: string, jobId: string, now: number): Job | undefined {
    return transaction(this.db, () => {
      const job = this.get(tenantId, jobId);
      if (!job || TERMINAL_STATUSES.has(job.status)) {
        return undefined;
      }
      if (job.status === 'queued') {
        this.s.finish.run('canceled', null, 'CANCELED', 'Canceled before it started.', now, tenantId, jobId);
      } else {
        this.s.setCancel.run(tenantId, jobId);
      }
      return this.mustGet(tenantId, jobId);
    });
  }

  /** Extend a running job's lease (worker heartbeat). */
  extendLease(tenantId: string, jobId: string, now: number, leaseMs: number): void {
    this.s.extendLease.run(now + leaseMs, tenantId, jobId);
  }

  /** Fail every running job whose lease lapsed (its worker died). */
  reapExpired(now: number): Job[] {
    return transaction(this.db, () => {
      const rows = this.s.expired.all(now) as Row[];
      const reaped: Job[] = [];
      for (const row of rows) {
        const job = jobFromRow(row);
        this.s.finish.run(
          'failed',
          null,
          'WORKER_LOST',
          'The worker stopped reporting before the job finished.',
          now,
          job.tenantId,
          job.id
        );
        reaped.push(this.mustGet(job.tenantId, job.id));
      }
      return reaped;
    });
  }
}
