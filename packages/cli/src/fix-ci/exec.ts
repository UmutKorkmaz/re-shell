// Minimal, shell-free child-process runner for `fix --ci`.
//
// Every gate, git and gh invocation goes through here so that:
//   - argv is passed verbatim (no shell, so no metacharacter interpretation),
//   - a hard timeout kills the whole process group (npm/pnpm spawn children),
//   - output is captured with a cap so a runaway gate cannot exhaust memory.

import { spawn, type ChildProcess } from 'child_process';

export interface RunProcessOptions {
  cwd: string;
  /** Hard timeout; the process group is killed when it elapses. */
  timeoutMs?: number;
  /** Extra env vars merged over process.env. */
  env?: NodeJS.ProcessEnv;
  /** Cap per stream, in bytes (default 8 MiB). Further output is dropped. */
  maxOutputBytes?: number;
  /** Optional stdin payload. */
  input?: string;
}

export interface RunProcessResult {
  /** Exit code; null when killed by a signal or when spawning failed. */
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** Set when the process could not be spawned (e.g. ENOENT). */
  spawnError?: string;
  truncated: boolean;
  durationMs: number;
}

const DEFAULT_MAX_OUTPUT = 8 * 1024 * 1024;

/** Children currently running, so a signal handler can take their process groups down. */
const activeChildren = new Set<ChildProcess>();

/** SIGKILL every in-flight child process group (used on SIGINT/SIGTERM). */
export function killActiveChildren(): void {
  for (const child of activeChildren) {
    try {
      if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL');
      else child.kill('SIGKILL');
    } catch {
      /* already gone */
    }
  }
  activeChildren.clear();
}

/**
 * Run `argv[0]` with `argv.slice(1)` as a child process WITHOUT a shell.
 * Never rejects: spawn failures and timeouts are reported in the result.
 */
export function runProcess(
  argv: readonly string[],
  options: RunProcessOptions
): Promise<RunProcessResult> {
  const started = Date.now();
  const cap = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT;
  return new Promise(resolve => {
    if (argv.length === 0 || !argv[0]) {
      resolve({
        exitCode: null,
        stdout: '',
        stderr: '',
        timedOut: false,
        spawnError: 'empty command',
        truncated: false,
        durationMs: 0,
      });
      return;
    }
    const [bin, ...args] = argv;
    let stdout = '';
    let stderr = '';
    let outBytes = 0;
    let errBytes = 0;
    let truncated = false;
    let timedOut = false;
    let settled = false;
    let spawnError: string | undefined;

    const child = spawn(bin, args, {
      cwd: options.cwd,
      shell: false,
      // Own process group so a timeout can take down the whole tree.
      detached: process.platform !== 'win32',
      env: { ...process.env, ...options.env },
      stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });

    activeChildren.add(child);

    const killTree = (signal: NodeJS.Signals): void => {
      try {
        if (process.platform !== 'win32' && child.pid) {
          process.kill(-child.pid, signal);
        } else {
          child.kill(signal);
        }
      } catch {
        /* already gone */
      }
    };

    let killTimer: NodeJS.Timeout | undefined;
    let hardTimer: NodeJS.Timeout | undefined;
    if (options.timeoutMs && options.timeoutMs > 0) {
      killTimer = setTimeout(() => {
        timedOut = true;
        killTree('SIGTERM');
        hardTimer = setTimeout(() => killTree('SIGKILL'), 2000);
      }, options.timeoutMs);
    }

    const finish = (exitCode: number | null): void => {
      if (settled) return;
      settled = true;
      activeChildren.delete(child);
      if (killTimer) clearTimeout(killTimer);
      if (hardTimer) clearTimeout(hardTimer);
      resolve({
        exitCode,
        stdout,
        stderr,
        timedOut,
        spawnError,
        truncated,
        durationMs: Date.now() - started,
      });
    };

    child.stdout?.on('data', (chunk: Buffer) => {
      if (outBytes >= cap) {
        truncated = true;
        return;
      }
      outBytes += chunk.length;
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      if (errBytes >= cap) {
        truncated = true;
        return;
      }
      errBytes += chunk.length;
      stderr += chunk.toString('utf8');
    });
    child.on('error', err => {
      spawnError = err.message;
      finish(null);
    });
    child.on('close', code => {
      // The group may still hold orphans after a timeout; make sure they die.
      if (timedOut) killTree('SIGKILL');
      finish(code);
    });

    if (options.input !== undefined && child.stdin) {
      child.stdin.on('error', () => {
        /* child exited before reading stdin */
      });
      child.stdin.end(options.input);
    }
  });
}
