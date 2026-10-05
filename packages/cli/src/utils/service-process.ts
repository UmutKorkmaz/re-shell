/**
 * Process-supervision primitives for `re-shell service run`.
 *
 * Everything here is real process management with no simulated success: exit
 * codes are checked, spawn failures and immediate child exits are reported,
 * readiness is verified (port, health URL, or "still alive after N ms"), and
 * stopping a service signals its whole process group (SIGTERM, wait, SIGKILL)
 * after verifying the recorded process identity so a recycled PID can never be
 * killed by mistake.
 */

import { spawn, spawnSync, type ChildProcess } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import * as path from 'path';
import type { ErrorCode } from '@re-shell/contracts';

// ─── Errors ──────────────────────────────────────────────────────────────────

/** JSON error codes the service runtime can raise (a subset of the contract's vocabulary). */
export type ServiceErrorCode = Extract<ErrorCode, `SERVICES_${string}`>;

/**
 * Error raised for any explicit service-runtime failure. Carries the stable
 * machine-readable `code` used by `--json` envelopes.
 */
export class ServiceRuntimeError extends Error {
  readonly code: ServiceErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ServiceErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ServiceRuntimeError';
    this.code = code;
    this.details = details;
  }
}

/** Failure of an external command: spawn error, non-zero exit, or timeout. */
export class CommandFailedError extends Error {
  readonly command: string;
  readonly args: string[];
  readonly reason: 'spawn' | 'exit' | 'timeout';
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;

  constructor(init: {
    command: string;
    args: string[];
    reason: 'spawn' | 'exit' | 'timeout';
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
    message: string;
  }) {
    super(init.message);
    this.name = 'CommandFailedError';
    this.command = init.command;
    this.args = init.args;
    this.reason = init.reason;
    this.exitCode = init.exitCode;
    this.signal = init.signal;
    this.stdout = init.stdout;
    this.stderr = init.stderr;
  }
}

// ─── Small helpers ───────────────────────────────────────────────────────────

const IS_WINDOWS = process.platform === 'win32';
const MAX_CAPTURE_BYTES = 4 * 1024 * 1024;

/** Resolve after `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Last `count` non-empty lines of `text`. */
export function tailLines(text: string, count = 20): string {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  return lines.slice(-count).join('\n');
}

function appendCapped(current: string, chunk: Buffer | string): string {
  const next = current + chunk.toString();
  return next.length > MAX_CAPTURE_BYTES ? next.slice(next.length - MAX_CAPTURE_BYTES) : next;
}

// ─── External command runner ─────────────────────────────────────────────────

/** Options for {@link runCommand}. */
export interface RunCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Kill the command after this many ms. `0` disables the timeout. Default 30000. */
  timeoutMs?: number;
  /** Stream captured output to this process's stdout/stderr as it arrives. */
  verbose?: boolean;
  /**
   * `capture` (default) pipes stdout/stderr and returns them; `inherit` hands the
   * terminal to the child (interactive `exec`, followed `logs`).
   */
  stdio?: 'capture' | 'inherit';
}

/** Result of a command that exited 0. */
export interface RunCommandResult {
  stdout: string;
  stderr: string;
  code: 0;
}

/**
 * Run an external command WITHOUT a shell and resolve only when it exits 0.
 * A spawn error (e.g. ENOENT), a non-zero exit, a signal death or a timeout all
 * reject with a {@link CommandFailedError}, so callers can never mistake a
 * missing or failing binary for success.
 */
export function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {}
): Promise<RunCommandResult> {
  const { cwd, env, timeoutMs = 30000, verbose = false, stdio = 'capture' } = options;
  const printable = [command, ...args].join(' ');

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer: NodeJS.Timeout | undefined;

    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      fn();
    };

    let child: ChildProcess;
    try {
      child = spawn(command, args, {
        cwd,
        env,
        stdio: stdio === 'inherit' ? 'inherit' : ['ignore', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reject(
        new CommandFailedError({
          command,
          args,
          reason: 'spawn',
          exitCode: null,
          signal: null,
          stdout,
          stderr,
          message: `Failed to run \`${printable}\`: ${message}`,
        })
      );
      return;
    }

    child.stdout?.on('data', (data: Buffer) => {
      stdout = appendCapped(stdout, data);
      if (verbose) process.stdout.write(data);
    });
    child.stderr?.on('data', (data: Buffer) => {
      stderr = appendCapped(stderr, data);
      if (verbose) process.stderr.write(data);
    });

    child.once('error', (err: NodeJS.ErrnoException) => {
      settle(() =>
        reject(
          new CommandFailedError({
            command,
            args,
            reason: 'spawn',
            exitCode: null,
            signal: null,
            stdout,
            stderr,
            message:
              err.code === 'ENOENT'
                ? `\`${command}\` was not found on PATH`
                : `Failed to run \`${printable}\`: ${err.message}`,
          })
        )
      );
    });

    child.once('close', (code, signal) => {
      settle(() => {
        if (code === 0) {
          resolve({ stdout, stderr, code: 0 });
          return;
        }
        const detail = tailLines(stderr || stdout, 10);
        reject(
          new CommandFailedError({
            command,
            args,
            reason: 'exit',
            exitCode: code,
            signal,
            stdout,
            stderr,
            message:
              `\`${printable}\` ${signal ? `was terminated by ${signal}` : `exited with code ${code}`}` +
              (detail ? `:\n${detail}` : ''),
          })
        );
      });
    });

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        settle(() => {
          child.kill('SIGTERM');
          const escalate = setTimeout(() => child.kill('SIGKILL'), 2000);
          escalate.unref();
          reject(
            new CommandFailedError({
              command,
              args,
              reason: 'timeout',
              exitCode: null,
              signal: null,
              stdout,
              stderr,
              message: `\`${printable}\` timed out after ${timeoutMs}ms`,
            })
          );
        });
      }, timeoutMs);
    }
  });
}

// ─── Docker Compose detection ────────────────────────────────────────────────

/** The compose binary that was actually detected, used for EVERY compose call. */
export interface ComposeCommand {
  /** Executable to spawn (`docker` for the plugin, `docker-compose` for the standalone binary). */
  command: string;
  /** Arguments that precede the compose subcommand (`['compose']` for the plugin). */
  baseArgs: string[];
  flavor: 'plugin' | 'standalone';
  /** Human-readable invocation, e.g. `docker compose`. */
  label: string;
  /** First line of the version output. */
  version: string;
}

/**
 * Detect a working compose implementation: the `docker compose` plugin first,
 * then the standalone `docker-compose` binary. Each probe must exit 0, so a
 * missing binary (or a shell printing "not found") is never mistaken for a hit.
 *
 * @returns The detected {@link ComposeCommand}, or `null` when neither works.
 */
export async function detectCompose(env?: NodeJS.ProcessEnv): Promise<ComposeCommand | null> {
  try {
    const result = await runCommand('docker', ['compose', 'version'], { env, timeoutMs: 20000 });
    return {
      command: 'docker',
      baseArgs: ['compose'],
      flavor: 'plugin',
      label: 'docker compose',
      version: result.stdout.trim().split('\n')[0] || 'unknown',
    };
  } catch {
    // fall through to the standalone binary
  }

  try {
    const result = await runCommand('docker-compose', ['--version'], { env, timeoutMs: 20000 });
    return {
      command: 'docker-compose',
      baseArgs: [],
      flavor: 'standalone',
      label: 'docker-compose',
      version: result.stdout.trim().split('\n')[0] || 'unknown',
    };
  } catch {
    return null;
  }
}

/**
 * Run a compose subcommand with the detected binary. Resolves only on exit 0;
 * any failure is rethrown as a {@link ServiceRuntimeError} (`SERVICES_COMPOSE_FAILED`).
 */
export async function runCompose(
  compose: ComposeCommand,
  args: string[],
  options: RunCommandOptions = {}
): Promise<RunCommandResult> {
  try {
    return await runCommand(compose.command, [...compose.baseArgs, ...args], options);
  } catch (err) {
    if (err instanceof CommandFailedError) {
      throw new ServiceRuntimeError(
        'SERVICES_COMPOSE_FAILED',
        `${compose.label} ${args[0] ?? ''} failed: ${err.message}`,
        {
          command: compose.label,
          args,
          exitCode: err.exitCode,
          reason: err.reason,
        }
      );
    }
    throw err;
  }
}

/** Names accepted as compose project files, in lookup order. */
export const COMPOSE_FILE_NAMES = [
  'docker-compose.yml',
  'docker-compose.yaml',
  'docker-compose.dev.yml',
  'compose.yaml',
  'compose.yml',
];

/** Path of the first compose file found in `projectPath`, or `null`. */
export function findComposeFile(projectPath: string): string | null {
  for (const name of COMPOSE_FILE_NAMES) {
    const candidate = path.join(projectPath, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** One container as reported by `compose ps --format json`. */
export interface ComposeContainer {
  service: string;
  name?: string;
  state: string;
  health?: string;
  exitCode?: number;
  ports?: string;
}

/**
 * Parse `compose ps --format json` output. Compose v2 emits either a single
 * JSON array (older releases) or newline-delimited objects (newer releases);
 * both are accepted. Throws on unparseable output rather than guessing.
 */
export function parseComposePs(stdout: string): ComposeContainer[] {
  const text = stdout.trim();
  if (!text) return [];

  let rows: unknown[];
  if (text.startsWith('[')) {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) throw new Error('expected a JSON array');
    rows = parsed;
  } else {
    rows = text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => JSON.parse(line) as unknown);
  }

  return rows.map(row => {
    const r = row as Record<string, unknown>;
    return {
      service: String(r.Service ?? r.Name ?? ''),
      name: typeof r.Name === 'string' ? r.Name : undefined,
      state: String(r.State ?? '').toLowerCase(),
      health: typeof r.Health === 'string' && r.Health ? r.Health.toLowerCase() : undefined,
      exitCode: typeof r.ExitCode === 'number' ? r.ExitCode : undefined,
      ports: typeof r.Ports === 'string' ? r.Ports : undefined,
    };
  });
}

/**
 * Whether a compose container is in a healthy steady state. A container that
 * ran to completion with exit code 0 (a one-shot job) counts as OK; anything
 * restarting, dead, crashed, or failing its healthcheck does not.
 */
export function composeContainerOk(container: ComposeContainer): boolean {
  if (container.state === 'running') {
    return !container.health || container.health === 'healthy';
  }
  if (container.state === 'exited') {
    return container.exitCode === 0;
  }
  return false;
}

// ─── Process inspection ──────────────────────────────────────────────────────

/** Subset of kernel process info needed for identity checks. */
export interface ProcInfo {
  pid: number;
  ppid: number;
  pgid: number;
  /** Single-letter state (R, S, Z, ...). `Z` means defunct/zombie. */
  state: string;
  /** Opaque start-time token: stable for the life of a process, differs across PID reuse. */
  startTime: string;
}

const HAS_PROC = !IS_WINDOWS && fs.existsSync('/proc/self/stat');
let cachedBootId: string | undefined;

function bootId(): string {
  if (cachedBootId !== undefined) return cachedBootId;
  try {
    cachedBootId = fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim().slice(0, 8);
  } catch {
    cachedBootId = 'noboot';
  }
  return cachedBootId;
}

/** Parse the contents of `/proc/<pid>/stat`. Exported for tests. */
export function parseProcStat(content: string): ProcInfo | null {
  const open = content.indexOf('(');
  const close = content.lastIndexOf(')');
  if (open < 0 || close < open) return null;
  const pid = Number(content.slice(0, open).trim());
  // After the ")": state ppid pgrp session tty tpgid flags minflt cminflt majflt
  // cmajflt utime stime cutime cstime priority nice threads itrealvalue starttime ...
  const rest = content.slice(close + 2).split(' ');
  if (rest.length < 20 || !Number.isInteger(pid)) return null;
  return {
    pid,
    state: rest[0],
    ppid: Number(rest[1]),
    pgid: Number(rest[2]),
    startTime: `proc:${bootId()}:${rest[19]}`,
  };
}

function readProcInfoViaPs(pid: number): ProcInfo | null {
  const result = spawnSync('ps', ['-o', 'pid=,ppid=,pgid=,stat=,lstart=', '-p', String(pid)], {
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C' },
  });
  if (result.error || result.status !== 0) return null;
  const line = (result.stdout || '').split('\n').find(l => l.trim().length > 0);
  if (!line) return null;
  const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.+?)\s*$/);
  if (!match) return null;
  return {
    pid: Number(match[1]),
    ppid: Number(match[2]),
    pgid: Number(match[3]),
    state: match[4].charAt(0),
    startTime: `ps:${match[5]}`,
  };
}

/** Read kernel info for `pid`, or `null` when no such process exists. */
export function readProcInfo(pid: number): ProcInfo | null {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  if (HAS_PROC) {
    try {
      return parseProcStat(fs.readFileSync(`/proc/${pid}/stat`, 'utf8'));
    } catch {
      return null;
    }
  }
  return readProcInfoViaPs(pid);
}

const DEAD_STATES = new Set(['Z', 'X']);

/** Live (non-zombie) members of a process group. */
export function listGroupMembers(pgid: number): number[] {
  const members: number[] = [];
  if (HAS_PROC) {
    let entries: string[] = [];
    try {
      entries = fs.readdirSync('/proc');
    } catch {
      return members;
    }
    for (const entry of entries) {
      if (!/^\d+$/.test(entry)) continue;
      const info = readProcInfo(Number(entry));
      if (info && info.pgid === pgid && !DEAD_STATES.has(info.state)) members.push(info.pid);
    }
    return members;
  }

  const result = spawnSync('ps', ['-A', '-o', 'pid=,pgid=,stat='], {
    encoding: 'utf8',
    env: { ...process.env, LC_ALL: 'C' },
  });
  if (result.error || result.status !== 0) return members;
  for (const line of (result.stdout || '').split('\n')) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)/);
    if (match && Number(match[2]) === pgid && !DEAD_STATES.has(match[3].charAt(0))) {
      members.push(Number(match[1]));
    }
  }
  return members;
}

// ─── Port / URL probes ───────────────────────────────────────────────────────

/** True when something accepts TCP connections on `port` (loopback IPv4 or IPv6). */
export async function probePort(
  port: number,
  hosts: string[] = ['127.0.0.1', '::1'],
  timeoutMs = 400
): Promise<boolean> {
  for (const host of hosts) {
    const open = await new Promise<boolean>(resolve => {
      const socket = net.connect({ port, host });
      const done = (result: boolean): void => {
        socket.destroy();
        resolve(result);
      };
      socket.setTimeout(timeoutMs, () => done(false));
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
    });
    if (open) return true;
  }
  return false;
}

/**
 * Wait until nothing accepts connections on `port`, polling every `pollMs` for at
 * most `timeoutMs`. Resolves `true` once the port is released, `false` on timeout.
 */
export async function waitForPortRelease(port: number, timeoutMs: number, pollMs = 50): Promise<boolean> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  while (await probePort(port)) {
    if (Date.now() >= deadline) return false;
    await sleep(Math.min(pollMs, Math.max(1, deadline - Date.now())));
  }
  return true;
}

/** True when a GET on `url` answers with a 2xx/3xx status. */
export function probeUrl(url: string, timeoutMs = 2000): Promise<boolean> {
  return new Promise(resolve => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      resolve(false);
      return;
    }
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(parsed, { timeout: timeoutMs }, res => {
      res.resume();
      resolve(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

// ─── PID / log state on disk ─────────────────────────────────────────────────

/** Persistent record of one supervised service process. */
export interface ServiceProcessRecord {
  version: 1;
  name: string;
  pid: number;
  /** Process-group id. Services are spawned detached, so this equals `pid`. */
  pgid: number;
  /** Kernel start-time token captured at spawn; used to detect PID reuse. */
  startTime: string | null;
  command: string;
  /** Spawn argv (or the shell invocation) actually used. */
  argv: string[];
  /** True when the command needed a shell (`/bin/sh -c`). */
  shell: boolean;
  cwd: string;
  startedAt: string;
  logFile: string;
  port?: number;
  healthUrl?: string;
  readiness: 'port' | 'url' | 'alive';
}

/** Directory holding PID records. */
export function pidDir(projectPath: string): string {
  return path.join(projectPath, '.re-shell', 'pids');
}

/** Directory holding service log files. */
export function logDir(projectPath: string): string {
  return path.join(projectPath, '.re-shell', 'logs');
}

/** Filesystem-safe stem for a service name (workspace names contain `/`). */
export function safeStem(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._@-]/g, '_');
  if (cleaned === name && name !== '.' && name !== '..') return cleaned;
  const hash = createHash('sha1').update(name).digest('hex').slice(0, 6);
  return `${cleaned.replace(/^\.+/, '_')}-${hash}`;
}

export function pidFilePath(projectPath: string, name: string): string {
  return path.join(pidDir(projectPath), `${safeStem(name)}.pid`);
}

export function logFilePath(projectPath: string, name: string): string {
  return path.join(logDir(projectPath), `${safeStem(name)}.log`);
}

async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, content, { mode: 0o600 });
  await fsp.rename(tmp, filePath);
}

/** Persist a record atomically. */
export async function writeServiceRecord(
  projectPath: string,
  record: ServiceProcessRecord
): Promise<void> {
  await writeFileAtomic(pidFilePath(projectPath, record.name), JSON.stringify(record, null, 2));
}

/** Result of scanning the PID directory. */
export interface ScannedRecords {
  records: ServiceProcessRecord[];
  /** PID files in the old plain-number format: no identity, never signalled. */
  legacy: Array<{ name: string; pid: number; file: string }>;
  /** PID files that could not be parsed. */
  invalid: Array<{ file: string; reason: string }>;
}

/** Read every PID file under `projectPath/.re-shell/pids`. */
export async function readServiceRecords(projectPath: string): Promise<ScannedRecords> {
  const dir = pidDir(projectPath);
  const result: ScannedRecords = { records: [], legacy: [], invalid: [] };

  let files: string[];
  try {
    files = await fsp.readdir(dir);
  } catch {
    return result;
  }

  for (const file of files.sort()) {
    if (!file.endsWith('.pid')) continue;
    const full = path.join(dir, file);
    let content: string;
    try {
      content = (await fsp.readFile(full, 'utf8')).trim();
    } catch {
      continue;
    }

    if (/^\d+$/.test(content)) {
      result.legacy.push({ name: file.slice(0, -4), pid: Number(content), file: full });
      continue;
    }

    try {
      const parsed = JSON.parse(content) as Partial<ServiceProcessRecord>;
      if (
        parsed &&
        parsed.version === 1 &&
        typeof parsed.name === 'string' &&
        Number.isInteger(parsed.pid) &&
        Number.isInteger(parsed.pgid)
      ) {
        result.records.push(parsed as ServiceProcessRecord);
      } else {
        result.invalid.push({ file: full, reason: 'unrecognised record shape' });
      }
    } catch (err) {
      result.invalid.push({ file: full, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}

/** Remove a service's PID file and (optionally) its log file. Missing files are fine. */
export async function removeServiceState(
  projectPath: string,
  name: string,
  options: { logs?: boolean } = {}
): Promise<void> {
  await fsp.rm(pidFilePath(projectPath, name), { force: true });
  if (options.logs) {
    await fsp.rm(logFilePath(projectPath, name), { force: true });
  }
}

// ─── Identity + liveness ─────────────────────────────────────────────────────

/**
 * Where a recorded process stands:
 *  - `alive`: the recorded leader is running and matches the recorded start time
 *  - `group-orphans`: the leader is gone but members of its group are still running
 *  - `gone`: nothing of the service is running
 *  - `reused`: the PID now belongs to a different process (start time differs)
 *  - `unverifiable`: the process exists but no start time was recorded
 *  - `invalid`: the record carries ids that must never be signalled
 */
export type IdentityState =
  | 'alive'
  | 'group-orphans'
  | 'gone'
  | 'reused'
  | 'unverifiable'
  | 'invalid';

/** Result of {@link checkRecordIdentity}. */
export interface IdentityCheck {
  state: IdentityState;
  /** Live pids in the recorded process group. */
  members: number[];
}

function idsAreSignalSafe(record: ServiceProcessRecord): boolean {
  const { pid, pgid } = record;
  if (!Number.isInteger(pid) || !Number.isInteger(pgid)) return false;
  if (pid <= 1 || pgid <= 1) return false;
  if (pid === process.pid || pid === process.ppid) return false;
  const getpgrp = (process as unknown as { getpgrp?: () => number }).getpgrp;
  if (!IS_WINDOWS && typeof getpgrp === 'function' && pgid === getpgrp.call(process)) {
    return false;
  }
  return true;
}

/**
 * Decide whether a PID record still refers to the process we spawned. The
 * kernel start-time token recorded at spawn must match, so a recycled PID
 * (a different process now owning the number) is reported as `reused` and is
 * never signalled.
 */
export function checkRecordIdentity(record: ServiceProcessRecord): IdentityCheck {
  if (!idsAreSignalSafe(record)) return { state: 'invalid', members: [] };

  const info = readProcInfo(record.pid);

  if (info && !DEAD_STATES.has(info.state)) {
    if (!record.startTime) return { state: 'unverifiable', members: [] };
    if (info.startTime !== record.startTime) return { state: 'reused', members: [] };
    return { state: 'alive', members: listGroupMembers(record.pgid) };
  }

  // Leader is gone (or a zombie). A different start time on a zombie still
  // means the number was recycled.
  if (info && record.startTime && info.startTime !== record.startTime) {
    return { state: 'reused', members: [] };
  }

  // A PID cannot be recycled while it is still in use as a process-group id, so
  // any live member of the recorded group is a surviving descendant of ours.
  const members = listGroupMembers(record.pgid);
  return members.length > 0 ? { state: 'group-orphans', members } : { state: 'gone', members };
}

/** True while the recorded service still has a live process. */
export function isRecordRunning(record: ServiceProcessRecord): boolean {
  const { state } = checkRecordIdentity(record);
  return state === 'alive' || state === 'group-orphans';
}

// ─── Stopping ────────────────────────────────────────────────────────────────

/** How a stop request ended. */
export type StopOutcome =
  | 'terminated'
  | 'killed'
  | 'not-running'
  | 'identity-mismatch'
  | 'unverifiable';

/** Result of {@link stopServiceProcess}. */
export interface StopResult {
  name: string;
  pid: number;
  outcome: StopOutcome;
}

function signalGroup(pgid: number, signal: NodeJS.Signals): boolean {
  try {
    process.kill(-pgid, signal);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') return false;
    throw err;
  }
}

async function waitForGroupExit(pgid: number, timeoutMs: number, pollMs: number): Promise<boolean> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (listGroupMembers(pgid).length === 0) return true;
    if (Date.now() >= deadline) return false;
    await sleep(Math.min(pollMs, Math.max(1, deadline - Date.now())));
  }
}

/**
 * Stop a supervised service: verify the recorded identity, SIGTERM its whole
 * process group, wait up to `timeoutMs`, then SIGKILL whatever is left. Throws
 * `SERVICES_STOP_FAILED` if anything survives SIGKILL. A recycled PID is never
 * signalled.
 */
export async function stopServiceProcess(
  record: ServiceProcessRecord,
  options: { timeoutMs: number; killGraceMs?: number; pollMs?: number }
): Promise<StopResult> {
  const { timeoutMs, killGraceMs = 3000, pollMs = 50 } = options;
  const base = { name: record.name, pid: record.pid };

  if (IS_WINDOWS) {
    throw new ServiceRuntimeError(
      'SERVICES_STOP_FAILED',
      'Stopping process-mode services is not supported on Windows; use Docker Compose.'
    );
  }

  const identity = checkRecordIdentity(record);
  switch (identity.state) {
    case 'gone':
      return { ...base, outcome: 'not-running' };
    case 'reused':
    case 'invalid':
      return { ...base, outcome: 'identity-mismatch' };
    case 'unverifiable':
      return { ...base, outcome: 'unverifiable' };
    default:
      break;
  }

  if (!signalGroup(record.pgid, 'SIGTERM')) {
    return { ...base, outcome: 'not-running' };
  }
  if (await waitForGroupExit(record.pgid, timeoutMs, pollMs)) {
    return { ...base, outcome: 'terminated' };
  }

  signalGroup(record.pgid, 'SIGKILL');
  if (await waitForGroupExit(record.pgid, killGraceMs, pollMs)) {
    return { ...base, outcome: 'killed' };
  }

  const survivors = listGroupMembers(record.pgid);
  throw new ServiceRuntimeError(
    'SERVICES_STOP_FAILED',
    `Service '${record.name}' (process group ${record.pgid}) is still running after SIGTERM and SIGKILL` +
      (survivors.length ? ` (pids: ${survivors.join(', ')})` : ''),
    { name: record.name, pgid: record.pgid, survivors }
  );
}

// ─── Starting ────────────────────────────────────────────────────────────────

/** Characters that require a shell to interpret a command line. */
const SHELL_META = /[|&;<>()$`\\"'*?[\]{}~!#\n]/;

/**
 * Decide how to spawn `command`: directly (argv split on whitespace) when it is
 * a plain command line, or via `/bin/sh -c` when it uses shell syntax such as
 * `&&`, pipes, quoting or inline `VAR=value` assignments.
 */
export function planSpawn(command: string): { file: string; args: string[]; shell: boolean } {
  const trimmed = command.trim();
  const needsShell = SHELL_META.test(trimmed) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(trimmed);
  if (needsShell) {
    return { file: '/bin/sh', args: ['-c', trimmed], shell: true };
  }
  const [file, ...args] = trimmed.split(/\s+/);
  return { file, args, shell: false };
}

/** `node_modules/.bin` directories from `cwd` upward, mirroring `npm run`. */
export function nodeBinDirs(cwd: string): string[] {
  const dirs: string[] = [];
  let current = path.resolve(cwd);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = path.join(current, 'node_modules', '.bin');
    if (fs.existsSync(candidate)) dirs.push(candidate);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return dirs;
}

/** What to start and how to judge readiness. */
export interface StartServiceInput {
  name: string;
  command: string;
  cwd: string;
  /** Extra environment variables for the service. */
  env?: Record<string, string>;
  port?: number;
  healthUrl?: string;
}

/** Options for {@link startServiceProcess}. */
export interface StartServiceOptions {
  projectPath: string;
  /** Max time to wait for a port / health URL to come up. */
  readyTimeoutMs: number;
  /** Grace period a service with no port/URL must stay alive. */
  aliveMs: number;
  /** Base environment for the child (defaults to `process.env`). */
  env?: NodeJS.ProcessEnv;
}

function readLogTail(logFile: string, lines = 15): string {
  try {
    const stat = fs.statSync(logFile);
    const size = Math.min(stat.size, 8192);
    const fd = fs.openSync(logFile, 'r');
    try {
      const buf = Buffer.alloc(size);
      fs.readSync(fd, buf, 0, size, stat.size - size);
      return tailLines(buf.toString('utf8'), lines);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return '';
  }
}

function describeExit(code: number | null, signal: NodeJS.Signals | null): string {
  return signal ? `was killed by ${signal}` : `exited with code ${code}`;
}

/**
 * Start a service as a detached background process group and only return once
 * it is verifiably up:
 *
 *  - spawned WITHOUT a shell when the command is a plain command line
 *    (`/bin/sh -c` only when shell syntax is needed), as its own process group;
 *  - stdout/stderr go straight to a log file descriptor (no pipes held by this
 *    process, so the service outlives the CLI and never gets SIGPIPE);
 *  - 'error' and 'exit' are observed, so a spawn failure or an immediate exit is
 *    a hard failure (with the log tail in the message);
 *  - readiness is a listening port, a 2xx health URL, or - when neither is
 *    configured - "still alive after `aliveMs`".
 *
 * On any failure the process group is torn down and the PID file removed.
 */
export async function startServiceProcess(
  input: StartServiceInput,
  options: StartServiceOptions
): Promise<ServiceProcessRecord> {
  const { projectPath } = options;
  const fail = (message: string, details?: Record<string, unknown>): ServiceRuntimeError =>
    new ServiceRuntimeError('SERVICES_START_FAILED', message, { service: input.name, ...details });

  if (IS_WINDOWS) {
    throw fail(
      'Process-mode services are not supported on Windows (no process groups to supervise); use Docker Compose.'
    );
  }

  if (!input.command || !input.command.trim()) {
    throw fail(`Service '${input.name}' has no command to run.`);
  }
  if (!fs.existsSync(input.cwd) || !fs.statSync(input.cwd).isDirectory()) {
    throw fail(`Working directory for service '${input.name}' does not exist: ${input.cwd}`);
  }

  await fsp.mkdir(pidDir(projectPath), { recursive: true });
  await fsp.mkdir(logDir(projectPath), { recursive: true });

  // Refuse to double-start; clear a stale PID file left by a crashed run.
  const existing = (await readServiceRecords(projectPath)).records.find(r => r.name === input.name);
  if (existing) {
    if (isRecordRunning(existing)) {
      throw fail(
        `Service '${input.name}' is already running (pid ${existing.pid}). ` +
          `Run \`re-shell service run down\` first.`,
        { pid: existing.pid }
      );
    }
    await removeServiceState(projectPath, input.name);
  }

  if (input.port !== undefined && (await probePort(input.port))) {
    throw fail(
      `Port ${input.port} is already in use; cannot start service '${input.name}'. ` +
        `Free the port or change the service's port.`,
      { port: input.port }
    );
  }

  const plan = planSpawn(input.command);
  const logFile = logFilePath(projectPath, input.name);
  const baseEnv = { ...(options.env ?? process.env) };
  const binDirs = nodeBinDirs(input.cwd);
  const pathKey = Object.keys(baseEnv).find(k => k.toUpperCase() === 'PATH') ?? 'PATH';
  const childEnv: NodeJS.ProcessEnv = {
    ...baseEnv,
    ...(input.env ?? {}),
    [pathKey]: [...binDirs, baseEnv[pathKey] ?? ''].filter(Boolean).join(path.delimiter),
  };

  const logFd = fs.openSync(logFile, 'w');
  let child: ChildProcess;
  try {
    child = spawn(plan.file, plan.args, {
      cwd: input.cwd,
      env: childEnv,
      stdio: ['ignore', logFd, logFd],
      detached: true,
      shell: false,
      windowsHide: true,
    });
  } catch (err) {
    fs.closeSync(logFd);
    throw fail(`Failed to start '${input.command}': ${err instanceof Error ? err.message : String(err)}`);
  }

  const exitState: { value: { code: number | null; signal: NodeJS.Signals | null } | null } = {
    value: null,
  };
  const exited = new Promise<void>(resolve => {
    child.once('exit', (code, signal) => {
      exitState.value = { code, signal };
      resolve();
    });
  });
  // A late 'error' (e.g. a failed kill) must never become an unhandled exception.
  child.on('error', () => undefined);

  try {
    await new Promise<void>((resolve, reject) => {
      child.once('error', reject);
      child.once('spawn', () => {
        child.off('error', reject);
        resolve();
      });
    });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    throw fail(
      e.code === 'ENOENT'
        ? `Failed to start '${input.command}': command not found (${plan.file})`
        : `Failed to start '${input.command}': ${e.message}`,
      { errno: e.code }
    );
  } finally {
    // The child owns its own duplicate of the descriptor; the parent must not leak it.
    fs.closeSync(logFd);
  }

  const pid = child.pid as number;
  // A configured health URL is the stronger signal and wins over a bare port.
  const effectiveReadiness: ServiceProcessRecord['readiness'] = input.healthUrl
    ? 'url'
    : input.port !== undefined
      ? 'port'
      : 'alive';

  const record: ServiceProcessRecord = {
    version: 1,
    name: input.name,
    pid,
    pgid: pid,
    startTime: readProcInfo(pid)?.startTime ?? null,
    command: input.command,
    argv: [plan.file, ...plan.args],
    shell: plan.shell,
    cwd: input.cwd,
    startedAt: new Date().toISOString(),
    logFile,
    port: input.port,
    healthUrl: input.healthUrl,
    readiness: effectiveReadiness,
  };
  try {
    await writeServiceRecord(projectPath, record);
  } catch (err) {
    // Without a PID record the service could never be stopped later: do not leave it running.
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      // already gone
    }
    throw fail(
      `Could not record the process for service '${input.name}': ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const teardown = async (): Promise<void> => {
    try {
      await stopServiceProcess(record, { timeoutMs: 2000 });
    } catch {
      // best effort: the failure being reported matters more
    }
    await removeServiceState(projectPath, input.name);
  };

  const exitFailure = async (): Promise<ServiceRuntimeError> => {
    await teardown();
    const info = exitState.value ?? { code: null, signal: null };
    const tail = readLogTail(logFile);
    return fail(
      `Service '${input.name}' ${describeExit(info.code, info.signal)} before becoming ready ` +
        `(command: ${input.command}).` +
        (tail ? `\nLast log lines (${logFile}):\n${tail}` : ` Log: ${logFile}`),
      { exitCode: info.code, signal: info.signal, logFile }
    );
  };

  // Readiness, raced against early exit.
  let cancelled = false;
  const poll = async (probe: () => Promise<boolean>, timeoutMs: number): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;
    while (!cancelled) {
      if (await probe()) return true;
      if (Date.now() >= deadline) return false;
      await sleep(100);
    }
    return false;
  };

  let outcome: 'ready' | 'timeout' | 'exited';
  if (effectiveReadiness === 'url') {
    outcome = await Promise.race([
      exited.then(() => 'exited' as const),
      poll(() => probeUrl(input.healthUrl as string), options.readyTimeoutMs).then(ok =>
        ok ? ('ready' as const) : ('timeout' as const)
      ),
    ]);
  } else if (effectiveReadiness === 'port') {
    outcome = await Promise.race([
      exited.then(() => 'exited' as const),
      poll(() => probePort(input.port as number), options.readyTimeoutMs).then(ok =>
        ok ? ('ready' as const) : ('timeout' as const)
      ),
    ]);
  } else {
    outcome = await Promise.race([
      exited.then(() => 'exited' as const),
      sleep(options.aliveMs).then(() => 'ready' as const),
    ]);
  }
  cancelled = true;

  // A service can die in the same tick its readiness probe succeeded.
  if (outcome === 'ready' && (exitState.value !== null || !isRecordRunning(record))) {
    outcome = 'exited';
  }

  if (outcome === 'exited') {
    throw await exitFailure();
  }
  if (outcome === 'timeout') {
    await teardown();
    const tail = readLogTail(logFile);
    const what =
      effectiveReadiness === 'url'
        ? `health URL ${input.healthUrl} did not answer 2xx`
        : `port ${input.port} did not accept connections`;
    throw fail(
      `Service '${input.name}' was not ready within ${options.readyTimeoutMs}ms: ${what}.` +
        (tail ? `\nLast log lines (${logFile}):\n${tail}` : ` Log: ${logFile}`),
      { logFile, readiness: effectiveReadiness }
    );
  }

  // Detach: the service keeps running after this CLI process exits.
  child.unref();
  return record;
}
