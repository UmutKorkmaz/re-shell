import { expect } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

/**
 * End-to-end tests for `re-shell create` run as the real, built CLI with stdin
 * closed (/dev/null, not a TTY) and a hard timeout: the CLI must never wait on a
 * prompt, must exit with the right code, and must produce what it claims.
 */

export const cliPath = path.join(process.cwd(), 'dist/index.js');
const TIMEOUT_MS = 60_000;

export interface RunResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  elapsedMs: number;
}

/** Run the built CLI with stdin closed and a timeout; never inherits a TTY. */
export function runCli(args: string[], cwd: string): RunResult {
  const started = Date.now();
  const res = spawnSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: TIMEOUT_MS,
    // The background npm update check is a network call unrelated to what is under test.
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', RE_SHELL_SKIP_UPDATE_CHECK: '1' },
  });
  return {
    status: res.status,
    signal: res.signal,
    timedOut: (res.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT',
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    elapsedMs: Date.now() - started,
  };
}

/** Assert the run finished by itself with the given exit code (i.e. did not hang). */
export function expectFinished(result: RunResult, status: number): void {
  expect(result.timedOut, `timed out; stdout:\n${result.stdout}\nstderr:\n${result.stderr}`).toBe(false);
  expect(result.signal).toBeNull();
  expect(result.status, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`).toBe(status);
}

export function json(result: RunResult): any {
  return JSON.parse(result.stdout.trim());
}

