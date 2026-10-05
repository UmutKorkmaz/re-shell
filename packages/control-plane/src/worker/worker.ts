import path from 'node:path';

import type { PolicySnapshot } from '../policy.js';
import { SseHttpError, openSseStream } from '../sse-client.js';
import { WorkerClient } from './client.js';
import { DEFAULT_RUNNER_OPTIONS, RunnerOptions, runJob } from './runner.js';

/**
 * The remote execution worker: authenticates to the control plane with a worker
 * token (bound to ONE tenant), long-polls for authorized jobs, runs them through
 * the shared allow-list registry and the re-shell CLI, and streams the result
 * back. It also subscribes to the tenant's event stream so team policy changes
 * reach it as they happen.
 */

export interface WorkerOptions {
  /** Control plane base URL, e.g. https://cp.example.com */
  controlPlaneUrl: string;
  /** Worker bearer token (from `re-shell-control-plane issue-token --worker`). */
  token: string;
  /** The tenant this worker serves; must match the token's tenant binding. */
  tenantId: string;
  /** Directory whose subdirectories are workspaces (`<root>/<workspaceId>`). */
  workspaceRoot: string;
  /** Path to the re-shell CLI JS entry, or a command name on PATH. */
  cliBin: string;
  /** Jobs run in parallel (each slot holds its own long-poll). */
  concurrency?: number;
  /** Long-poll wait per claim (ms, max 25000). */
  claimWaitMs?: number;
  runner?: Partial<Omit<RunnerOptions, 'workspaceRoot' | 'cliBin'>>;
  fetch?: typeof fetch;
  logger?: (entry: Record<string, unknown>) => void;
  /** Called for notable lifecycle events (used by tests and the CLI). */
  onEvent?: (event: WorkerEvent) => void;
}

export type WorkerEvent =
  | { type: 'policy'; policy: PolicySnapshot }
  | { type: 'job.started'; jobId: string; commandId: string }
  | { type: 'job.finished'; jobId: string; outcome: string }
  | { type: 'fatal'; reason: string };

const DEFAULT_CLAIM_WAIT_MS = 20_000;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(done, ms);
    function done(): void {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
  });
}

export class Worker {
  private readonly client: WorkerClient;
  private readonly runnerOptions: RunnerOptions;
  private readonly stopController = new AbortController();
  private readonly loops: Promise<void>[] = [];
  private latestPolicy: PolicySnapshot | undefined;
  private syncedWaiters: Array<() => void> = [];
  private fatalReason: string | undefined;
  private running = false;

  /** Jobs this worker has finished reporting (test/diagnostic counter). */
  completed = 0;

  constructor(private readonly options: WorkerOptions) {
    this.client = new WorkerClient(options.controlPlaneUrl, options.token, options.fetch);
    this.runnerOptions = {
      ...DEFAULT_RUNNER_OPTIONS,
      ...options.runner,
      workspaceRoot: path.resolve(options.workspaceRoot),
      cliBin: options.cliBin,
    };
  }

  /** The newest team policy this worker has received. */
  get policy(): PolicySnapshot | undefined {
    return this.latestPolicy;
  }

  /** Why the worker stopped on its own (e.g. token rejected), if it did. */
  get fatal(): string | undefined {
    return this.fatalReason;
  }

  private log(entry: Record<string, unknown>): void {
    this.options.logger?.({ component: 'worker', tenantId: this.options.tenantId, ...entry });
  }

  private emit(event: WorkerEvent): void {
    try {
      this.options.onEvent?.(event);
    } catch {
      // An observer must never break the worker.
    }
  }

  /** Resolve once the first policy snapshot has arrived over the event stream. */
  whenSynced(timeoutMs = 10_000): Promise<void> {
    if (this.latestPolicy) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out waiting for the first policy snapshot.')),
        timeoutMs
      );
      this.syncedWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /** Start the policy subscription and the claim loops. Returns immediately. */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.loops.push(this.policyLoop());
    const slots = Math.max(1, this.options.concurrency ?? 1);
    for (let slot = 0; slot < slots; slot += 1) {
      this.loops.push(this.claimLoop(slot));
    }
  }

  /** Resolves when the worker has stopped (after `stop()` or a fatal error). */
  async done(): Promise<void> {
    await Promise.all(this.loops);
  }

  /** Stop claiming, terminate running jobs (reported as WORKER_SHUTDOWN) and wait. */
  async stop(): Promise<void> {
    this.stopController.abort();
    await this.done();
  }

  private fail(reason: string): void {
    if (this.fatalReason) {
      return;
    }
    this.fatalReason = reason;
    this.log({ level: 'error', message: 'fatal', reason });
    this.emit({ type: 'fatal', reason });
    this.stopController.abort();
  }

  // ---- policy sync -----------------------------------------------------------

  private setPolicy(policy: PolicySnapshot): void {
    if (policy.tenantId !== this.options.tenantId) {
      return; // never adopt another tenant's policy
    }
    if (!this.latestPolicy || policy.policyVersion >= this.latestPolicy.policyVersion) {
      this.latestPolicy = policy;
      this.emit({ type: 'policy', policy });
      for (const waiter of this.syncedWaiters.splice(0)) {
        waiter();
      }
    }
  }

  private async policyLoop(): Promise<void> {
    const signal = this.stopController.signal;
    const base = this.options.controlPlaneUrl.replace(/\/+$/, '');
    let delay = 500;
    while (!signal.aborted) {
      try {
        const stream = await openSseStream(
          `${base}/tenants/${encodeURIComponent(this.options.tenantId)}/events`,
          { token: this.options.token, signal }
        );
        delay = 500;
        for await (const message of stream) {
          if (message.event === 'snapshot' || message.event === 'policy.updated') {
            try {
              const payload = JSON.parse(message.data) as { policy?: PolicySnapshot };
              if (payload.policy) {
                this.setPolicy(payload.policy);
              }
            } catch {
              this.log({ level: 'warn', message: 'unparseable policy event' });
            }
          } else if (message.event === 'expired' || message.event === 'revoked') {
            this.fail(`event stream ended: ${message.event}`);
            return;
          }
        }
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        if (error instanceof SseHttpError && (error.status === 401 || error.status === 403)) {
          this.fail(`control plane refused the policy stream (HTTP ${error.status}); check the worker token and tenant`);
          return;
        }
        this.log({ level: 'warn', message: 'policy stream error', error: error instanceof Error ? error.message : String(error) });
      }
      await sleep(delay, signal);
      delay = Math.min(delay * 2, 15_000);
    }
  }

  // ---- job loop ----------------------------------------------------------------

  private async claimLoop(slot: number): Promise<void> {
    const signal = this.stopController.signal;
    const wait = Math.min(this.options.claimWaitMs ?? DEFAULT_CLAIM_WAIT_MS, 25_000);
    let delay = 500;
    while (!signal.aborted) {
      const result = await this.client.claim(wait, signal);
      if (signal.aborted) {
        return;
      }
      if (result.kind === 'unauthenticated') {
        this.fail('control plane rejected the worker token (invalid or expired)');
        return;
      }
      if (result.kind !== 'ok') {
        this.log({
          level: 'warn',
          message: 'claim failed',
          slot,
          detail: result.kind === 'retry' ? result.reason : result.kind === 'rejected' ? result.code : result.kind,
        });
        await sleep(delay, signal);
        delay = Math.min(delay * 2, 15_000);
        continue;
      }
      delay = 500;
      const claim = result.data.claim;
      if (!claim) {
        continue;
      }
      this.emit({ type: 'job.started', jobId: claim.job.id, commandId: claim.job.commandId });
      // Seed the policy view from the claim so enforcement works even before the stream connects.
      const outcome = await runJob(
        claim,
        this.client,
        this.runnerOptions,
        { latestPolicy: () => this.latestPolicy, log: (entry) => this.log({ ...entry, slot }) },
        signal
      );
      this.completed += 1;
      this.emit({ type: 'job.finished', jobId: claim.job.id, outcome: outcome.kind });
      if (outcome.kind === 'unauthenticated') {
        this.fail('control plane rejected the worker token while reporting a job');
        return;
      }
    }
  }
}
