import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { SpanStatusCode, type Span } from '@opentelemetry/api';

import { resolveCommand } from '@re-shell/contracts/command-registry';

import type { ClaimedJob } from '../jobs.js';
import type { PolicySnapshot } from '../policy.js';
import type { Tracing } from '../tracing.js';
import type { FinishBody, OutputChunk, WorkerClient } from './client.js';
import {
  childEnvironment,
  containCwd,
  resolveCliInvocation,
  resolveWorkspaceDir,
} from './containment.js';
import { IsolationSetupError, startIsolatedJob, validateIsolation, type Isolation, type IsolatedProcess } from './isolation.js';

/**
 * Runs ONE claimed job: re-checks policy, builds argv from the SHARED allow-list
 * registry (@re-shell/contracts/command-registry — the same code the local hub
 * uses), contains the working directory, spawns the re-shell CLI WITHOUT a
 * shell, streams stdout/stderr back, and reports the exit.
 *
 * The worker never executes anything the registry did not produce: an unknown
 * command id or invalid params becomes a failed job, not a spawn.
 */

export interface RunnerOptions {
  tracing?: Tracing;
  /** Directory whose subdirectories are the tenant's workspaces (`<root>/<workspaceId>`). */
  workspaceRoot: string;
  /** Process mode is for trusted local development; Docker never falls back. */
  isolation?: Isolation;
  /** Total decoded output retained across pending/in-flight batches. */
  maxOutputChars: number;
  /** Path to the re-shell CLI JS entry, or a command name on PATH. */
  cliBin: string;
  /** How often buffered output is pushed to the control plane. */
  outputFlushMs: number;
  /** Heartbeat interval while a job runs (must be well below the server lease). */
  heartbeatMs: number;
  /** A job running longer than this is killed and failed with TIMEOUT. */
  jobTimeoutMs: number;
  /** After SIGTERM, how long to wait before SIGKILL. */
  killGraceMs: number;
  /** Max characters sent per output POST (keeps requests under the body limit). */
  maxPostChars: number;
  /** Max chunk objects per output POST (the server accepts at most 256). */
  maxPostChunks: number;
}

export const DEFAULT_RUNNER_OPTIONS: Omit<RunnerOptions, 'workspaceRoot' | 'cliBin'> = {
  maxOutputChars: 4 * 1024 * 1024,
  outputFlushMs: 100,
  heartbeatMs: 15_000,
  jobTimeoutMs: 10 * 60_000,
  killGraceMs: 5_000,
  maxPostChars: 48 * 1024,
  maxPostChunks: 128,
};

export interface RunnerHooks {
  /** The newest policy the worker has heard of via the event stream, if any. */
  latestPolicy(): PolicySnapshot | undefined;
  log(entry: Record<string, unknown>): void;
}

export type RunOutcome =
  | { kind: 'reported'; status: 'finished' | 'failed-before-spawn' | 'terminated' }
  /** The control plane says the job is no longer ours; nothing was (or will be) reported. */
  | { kind: 'abandoned' }
  /** The worker token was rejected; the worker must stop. */
  | { kind: 'unauthenticated' }
  | { kind: 'isolation-failed' };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Effective allow-list for the job's workspace, preferring the newest policy known. */
function effectiveFor(claim: ClaimedJob, hooks: RunnerHooks): readonly string[] {
  const latest = hooks.latestPolicy();
  if (latest && latest.tenantId === claim.job.tenantId && latest.policyVersion > claim.policy.policyVersion) {
    return latest.workspaces.find((w) => w.id === claim.job.workspaceId)?.effectiveCommandIds ?? [];
  }
  return claim.policy.effectiveCommandIds;
}

export async function runJob(
  claim: ClaimedJob,
  client: WorkerClient,
  options: RunnerOptions,
  hooks: RunnerHooks,
  shutdown: AbortSignal
): Promise<RunOutcome> {
  const run = async (span?: Span): Promise<RunOutcome> => {
    const outcome = await executeJob(claim, client, options, hooks, shutdown, span);
    if (outcome.kind !== 'reported' || outcome.status !== 'finished') span?.setStatus({ code: SpanStatusCode.ERROR });
    return outcome;
  };
  return options.tracing ? options.tracing.run('re-shell.job.execute', { 're_shell.command': claim.job.commandId }, run, claim.job.traceParent) : run();
}

async function executeJob(
  claim: ClaimedJob,
  client: WorkerClient,
  options: RunnerOptions,
  hooks: RunnerHooks,
  shutdown: AbortSignal,
  span?: Span
): Promise<RunOutcome> {
  const { job } = claim;
  const beganAt = Date.now();

  const finishWithoutSpawn = async (errorCode: string, errorMessage: string): Promise<RunOutcome> => {
    hooks.log({ level: 'warn', message: 'job rejected before spawn', jobId: job.id, errorCode });
    const result = await postExitWithRetry(client, job.id, { exitCode: null, errorCode, errorMessage });
    return result === 'unauthenticated'
      ? { kind: 'unauthenticated' }
      : result === 'gone'
        ? { kind: 'abandoned' }
        : { kind: 'reported', status: 'failed-before-spawn' };
  };

  const positiveIntegers = [options.jobTimeoutMs, options.killGraceMs, options.outputFlushMs, options.heartbeatMs, options.maxPostChars, options.maxPostChunks, options.maxOutputChars];
  if (positiveIntegers.some((value) => !Number.isSafeInteger(value) || value < 1) || options.maxPostChunks > 256 || options.maxPostChars > 48 * 1024) {
    return finishWithoutSpawn('INVALID_WORKER_CONFIG', 'Runner limits must be positive integers within the output protocol bounds.');
  }
  if (shutdown.aborted) return finishWithoutSpawn('WORKER_SHUTDOWN', 'The worker stopped before this job started.');

  // 1. Defense in depth: enforce the (newest known) policy locally as well.
  if (!effectiveFor(claim, hooks).includes(job.commandId)) {
    return finishWithoutSpawn('COMMAND_NOT_ALLOWED', 'Team policy does not allow this command.');
  }

  // 2. Build argv from the SHARED allow-list registry. No registry entry → no spawn.
  const resolved = resolveCommand(job.commandId, job.params);
  if (!resolved.ok) {
    return finishWithoutSpawn('INVALID_PARAMS', resolved.error);
  }

  // 3. Contain the working directory to the workspace.
  const workspace = resolveWorkspaceDir(options.workspaceRoot, job.workspaceId);
  if (!workspace.ok) {
    return finishWithoutSpawn('WORKSPACE_UNAVAILABLE', workspace.reason);
  }
  const cwd = containCwd(resolved.cwd, workspace.dir);
  if (cwd === null) {
    return finishWithoutSpawn('INVALID_PARAMS', 'cwd escapes the workspace.');
  }

  // 4. Spawn the CLI directly (no shell), with a scrubbed environment.
  const [binary, ...prefix] = resolveCliInvocation(options.cliBin);
  const argv = [...prefix, ...resolved.args];
  const posix = process.platform !== 'win32';

  type Termination = 'cancel' | 'timeout' | 'shutdown' | 'gone' | 'output-limit';
  let termination: Termination | undefined;
  let unauthenticated = false;
  let spawnError: Error | undefined;
  let outputLost = false;

  let isolated: IsolatedProcess | undefined;
  try {
    validateIsolation(options.isolation ?? { mode: 'process' });
    if (options.isolation?.mode === 'docker') isolated = await startIsolatedJob(options.isolation, job.tenantId, options.workspaceRoot, workspace.dir, cwd, resolved.args, shutdown, beganAt + options.jobTimeoutMs);
  } catch (error) {
    if (error instanceof IsolationSetupError && error.fatal) {
      hooks.log({ level: 'error', message: 'container setup cleanup unconfirmed', jobId: job.id, error: error.message });
      return { kind: 'isolation-failed' };
    }
    hooks.log({ level: 'error', message: 'isolated job setup failed', jobId: job.id, error: error instanceof Error ? error.message : String(error) });
    return finishWithoutSpawn(error instanceof IsolationSetupError ? error.code : 'ISOLATION_FAILED', 'Isolated job setup failed. Check the worker logs.');
  }
  const child = isolated?.child ?? spawn(binary, argv, {
    cwd,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: childEnvironment(),
    windowsHide: true,
    detached: posix,
  });
  hooks.log({ level: 'info', message: 'job started', jobId: job.id, commandId: job.commandId, pid: child.pid });

  let killTimer: NodeJS.Timeout | undefined;
  const signalGroup = (signal: NodeJS.Signals): void => {
    if (child.pid === undefined) return;
    try {
      // Negative pid addresses the whole process group the CLI may have spawned.
      process.kill(posix ? -child.pid : child.pid, signal);
    } catch {
      // Already gone.
    }
  };
  const terminate = (reason: Termination): void => {
    if (termination) return;
    termination = reason;
    if (isolated) void isolated.terminate().catch((error) => hooks.log({ level: 'error', message: 'container termination failed; final cleanup will retry', jobId: job.id, error: String(error) }));
    else signalGroup('SIGTERM');
    killTimer = setTimeout(() => signalGroup('SIGKILL'), options.killGraceMs);
    killTimer.unref();
  };

  // ---- output pipeline -------------------------------------------------------
  const decoders = { stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8') };
  let pending: OutputChunk[] = [];
  let receivedChars = 0;
  let heartbeatQueued = false;
  const delivery = new AbortController();
  let posting: Promise<void> = Promise.resolve();
  let lastPost = Date.now();

  const take = (): OutputChunk[][] => {
    // Split the buffered output into POST-sized batches (bounded in characters
    // AND in chunk count), preserving order.
    const batches: OutputChunk[][] = [];
    let current: OutputChunk[] = [];
    let chars = 0;
    const close = (): void => {
      if (current.length > 0) {
        batches.push(current);
      }
      current = [];
      chars = 0;
    };
    for (const chunk of pending) {
      let data = chunk.data;
      while (data.length > 0) {
        const room = options.maxPostChars - chars;
        const piece = data.slice(0, Math.max(1, room));
        current.push({ stream: chunk.stream, data: piece });
        chars += piece.length;
        data = data.slice(piece.length);
        if (chars >= options.maxPostChars || current.length >= options.maxPostChunks) {
          close();
        }
      }
    }
    close();
    pending = [];
    return batches;
  };

  const sendOutput = async (chunks: OutputChunk[]): Promise<void> => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (delivery.signal.aborted) { outputLost = true; return; }
      const result = await client.postOutput(job.id, chunks, AbortSignal.any([delivery.signal, AbortSignal.timeout(5000)]));
      lastPost = Date.now();
      if (result.kind === 'ok') {
        if (result.data.cancelRequested) terminate('cancel');
        return;
      }
      if (result.kind === 'job-gone') {
        terminate('gone');
        return;
      }
      if (result.kind === 'unauthenticated') {
        unauthenticated = true;
        terminate('gone');
        return;
      }
      if (result.kind === 'rejected') {
        outputLost = true;
        hooks.log({ level: 'error', message: 'output rejected', jobId: job.id, code: result.code });
        return;
      }
      await sleep(Math.min(250 * 2 ** attempt, 3000));
    }
    outputLost = true;
    hooks.log({ level: 'error', message: 'output dropped after retries', jobId: job.id });
  };

  const flush = (): Promise<void> => {
    const batches = take();
    if (batches.length === 0) {
      return posting;
    }
    for (const batch of batches) {
      posting = posting.then(() => sendOutput(batch));
    }
    return posting;
  };

  const push = (stream: 'stdout' | 'stderr', text: string): void => {
    if (text.length === 0) {
      return;
    }
    const available = Math.max(0, options.maxOutputChars - receivedChars);
    const overflow = text.length > available;
    text = text.slice(0, available);
    receivedChars += text.length;
    if (overflow) { outputLost = true; terminate('output-limit'); }
    if (text.length === 0) return;
    // Coalesce adjacent output from the same stream: a chatty CLI emits many
    // tiny writes and the control plane bounds chunks per request.
    const last = pending[pending.length - 1];
    if (last && last.stream === stream) {
      last.data += text;
    } else {
      pending.push({ stream, data: text });
    }
  };
  child.stdout?.on('data', (buf: Buffer) => push('stdout', decoders.stdout.write(buf)));
  child.stderr?.on('data', (buf: Buffer) => push('stderr', decoders.stderr.write(buf)));

  const flushTimer = setInterval(() => {
    if (pending.length > 0) {
      void flush();
    }
  }, options.outputFlushMs);
  const heartbeatTimer = setInterval(() => {
    if (!heartbeatQueued && Date.now() - lastPost >= options.heartbeatMs) {
      // An empty output post extends the lease and learns about cancels.
      heartbeatQueued = true;
      posting = posting.then(() => sendOutput([])).finally(() => { heartbeatQueued = false; });
    }
  }, Math.max(250, Math.floor(options.heartbeatMs / 3)));
  const timeoutTimer = setTimeout(() => terminate('timeout'), Math.max(1, options.jobTimeoutMs - (Date.now() - beganAt)));
  const onShutdown = (): void => terminate('shutdown');
  if (shutdown.aborted) {
    onShutdown();
  } else {
    shutdown.addEventListener('abort', onShutdown, { once: true });
  }

  // ---- wait for exit ---------------------------------------------------------
  const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve) => {
      let settled = false;
      const settle = (value: { code: number | null; signal: NodeJS.Signals | null }): void => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };
      child.once('error', (error) => {
        spawnError = error;
        settle({ code: null, signal: null });
      });
      child.once('close', (code, signal) => settle({ code, signal }));
    }
  );

  clearInterval(flushTimer);
  clearInterval(heartbeatTimer);
  clearTimeout(timeoutTimer);
  if (killTimer) {
    // A direct child can exit on TERM while descendants ignore it.
    if (!isolated && termination) signalGroup('SIGKILL');
    clearTimeout(killTimer);
  }
  shutdown.removeEventListener('abort', onShutdown);

  let cleanupFailed = false;
  if (isolated) {
    try { await isolated.cleanup(); }
    catch (error) { cleanupFailed = true; hooks.log({ level: 'error', message: 'container cleanup unconfirmed; stopping worker', jobId: job.id, error: String(error) }); }
  }

  // A failed/unreachable control plane must not hold shutdown open for every
  // buffered batch. The final result has its own bounded delivery budget.
  const drainTimer = setTimeout(() => delivery.abort(), 5000);
  push('stdout', decoders.stdout.end());
  push('stderr', decoders.stderr.end());
  await flush();
  await posting;
  clearTimeout(drainTimer);

  if (cleanupFailed) return { kind: 'isolation-failed' };
  if (termination === 'gone' || unauthenticated) {
    return unauthenticated ? { kind: 'unauthenticated' } : { kind: 'abandoned' };
  }

  // ---- final report ----------------------------------------------------------
  let body: FinishBody;
  if (spawnError) {
    body = { exitCode: null, errorCode: 'SPAWN_FAILED', errorMessage: spawnError.message.slice(0, 500) };
  } else if (termination === 'output-limit') {
    body = { exitCode: null, errorCode: 'OUTPUT_LIMIT', errorMessage: `Job output exceeded ${options.maxOutputChars} characters and was stopped.` };
  } else if (termination === 'cancel') {
    body = { exitCode: null, signal: exit.signal, errorCode: 'CANCELED', canceled: true };
  } else if (termination === 'timeout') {
    body = {
      exitCode: null,
      signal: exit.signal,
      errorCode: 'TIMEOUT',
      errorMessage: `The job exceeded ${options.jobTimeoutMs} ms and was stopped.`,
    };
  } else if (termination === 'shutdown') {
    body = { exitCode: null, signal: exit.signal, errorCode: 'WORKER_SHUTDOWN', errorMessage: 'The worker stopped.' };
  } else if (exit.code === null) {
    body = {
      exitCode: null,
      signal: exit.signal,
      errorCode: 'KILLED_BY_SIGNAL',
      errorMessage: `The process was terminated by ${exit.signal ?? 'a signal'}.`,
    };
  } else {
    body = { exitCode: Math.min(255, Math.max(0, exit.code)), signal: exit.signal };
  }
  if (outputLost && !body.errorMessage) {
    // Never present a result as complete when some of its output was lost.
    body.errorMessage = 'Some job output could not be delivered to the control plane.';
  }

  if (body.exitCode !== 0 || body.errorCode || outputLost) span?.setStatus({ code: SpanStatusCode.ERROR });
  const reported = await postExitWithRetry(client, job.id, body);
  hooks.log({ level: 'info', message: 'job finished', jobId: job.id, exitCode: body.exitCode, errorCode: body.errorCode });
  if (reported === 'unauthenticated') return { kind: 'unauthenticated' };
  if (reported === 'gone') return { kind: 'abandoned' };
  return { kind: 'reported', status: termination ? 'terminated' : 'finished' };
}

async function postExitWithRetry(
  client: WorkerClient,
  jobId: string,
  body: FinishBody
): Promise<'ok' | 'gone' | 'unauthenticated'> {
  const deadline = Date.now() + 15_000;
  for (let attempt = 0; attempt < 8 && Date.now() < deadline; attempt += 1) {
    const result = await client.postExit(jobId, body, AbortSignal.timeout(Math.max(1, Math.min(5000, deadline - Date.now()))));
    if (result.kind === 'ok') return 'ok';
    if (result.kind === 'job-gone') return 'gone';
    if (result.kind === 'unauthenticated') return 'unauthenticated';
    if (result.kind === 'rejected') return 'gone';
    await sleep(Math.max(0, Math.min(250 * 2 ** attempt, 5000, deadline - Date.now())));
  }
  return 'gone';
}
