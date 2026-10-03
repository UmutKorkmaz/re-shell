import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';

import { resolveCommand } from '@re-shell/contracts/command-registry';

import type { ClaimedJob } from '../jobs.js';
import type { PolicySnapshot } from '../policy.js';
import type { FinishBody, OutputChunk, WorkerClient } from './client.js';
import {
  childEnvironment,
  containCwd,
  resolveCliInvocation,
  resolveWorkspaceDir,
} from './containment.js';

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
  /** Directory whose subdirectories are the tenant's workspaces (`<root>/<workspaceId>`). */
  workspaceRoot: string;
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
  | { kind: 'unauthenticated' };

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
  const { job } = claim;

  const finishWithoutSpawn = async (errorCode: string, errorMessage: string): Promise<RunOutcome> => {
    hooks.log({ level: 'warn', message: 'job rejected before spawn', jobId: job.id, errorCode });
    const result = await postExitWithRetry(client, job.id, { exitCode: null, errorCode, errorMessage });
    return result === 'unauthenticated'
      ? { kind: 'unauthenticated' }
      : result === 'gone'
        ? { kind: 'abandoned' }
        : { kind: 'reported', status: 'failed-before-spawn' };
  };

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

  type Termination = 'cancel' | 'timeout' | 'shutdown' | 'gone';
  let termination: Termination | undefined;
  let unauthenticated = false;
  let spawnError: Error | undefined;
  let outputLost = false;

  const child = spawn(binary, argv, {
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
    signalGroup('SIGTERM');
    killTimer = setTimeout(() => signalGroup('SIGKILL'), options.killGraceMs);
    killTimer.unref();
  };

  // ---- output pipeline -------------------------------------------------------
  const decoders = { stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8') };
  let pending: OutputChunk[] = [];
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
      const result = await client.postOutput(job.id, chunks);
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
    if (Date.now() - lastPost >= options.heartbeatMs) {
      // An empty output post extends the lease and learns about cancels.
      posting = posting.then(() => sendOutput([]));
    }
  }, Math.max(250, Math.floor(options.heartbeatMs / 3)));
  const timeoutTimer = setTimeout(() => terminate('timeout'), options.jobTimeoutMs);
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
  if (killTimer) clearTimeout(killTimer);
  shutdown.removeEventListener('abort', onShutdown);

  push('stdout', decoders.stdout.end());
  push('stderr', decoders.stderr.end());
  await flush();
  await posting;

  if (termination === 'gone' || unauthenticated) {
    return unauthenticated ? { kind: 'unauthenticated' } : { kind: 'abandoned' };
  }

  // ---- final report ----------------------------------------------------------
  let body: FinishBody;
  if (spawnError) {
    body = { exitCode: null, errorCode: 'SPAWN_FAILED', errorMessage: spawnError.message.slice(0, 500) };
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
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await client.postExit(jobId, body);
    if (result.kind === 'ok') return 'ok';
    if (result.kind === 'job-gone') return 'gone';
    if (result.kind === 'unauthenticated') return 'unauthenticated';
    if (result.kind === 'rejected') return 'gone';
    await sleep(Math.min(250 * 2 ** attempt, 5000));
  }
  return 'gone';
}
