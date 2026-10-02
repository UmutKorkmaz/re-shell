/**
 * Shared fixtures for the real (non-mocked) service-runtime tests: temp
 * projects, PATH shim directories that stand in for `docker` / `docker-compose`
 * (present, absent, or failing), free-port helpers and process liveness checks.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { probePort, readProcInfo } from '../../src/utils/service-process';

export const IS_WINDOWS = process.platform === 'win32';

/** Create a temp dir tracked for cleanup via {@link cleanupTempDirs}. */
const tempDirs: string[] = [];
export function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  tempDirs.push(dir);
  return dir;
}

export function cleanupTempDirs(): void {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * A directory to use as the ENTIRE `PATH`. It only contains a `node` symlink, so
 * `docker` and `docker-compose` are genuinely absent (not merely failing).
 */
export function makeShimDir(): string {
  const dir = makeTempDir('rs-shim');
  fs.symlinkSync(process.execPath, path.join(dir, 'node'));
  return dir;
}

/** Subcommand behaviour for a generated compose shim. */
export interface ShimBehaviour {
  exit?: number;
  stdout?: string;
  stderr?: string;
}

export interface ComposeShimOptions {
  /** `docker` (plugin: invoked as `docker compose ...`) or `docker-compose` (standalone). */
  name: 'docker' | 'docker-compose';
  /** Per-subcommand behaviour. `version` covers both `compose version` and `--version`. */
  behaviours?: Record<string, ShimBehaviour>;
  /** File that every invocation's argv is appended to. */
  logFile: string;
}

/**
 * Write an executable shell shim named `docker` or `docker-compose` into `dir`.
 * Every call is logged (`<name> <argv...>`) to `logFile`; behaviour per
 * subcommand is configurable (exit code, stdout, stderr).
 */
export function writeComposeShim(dir: string, options: ComposeShimOptions): void {
  const { name, behaviours = {}, logFile } = options;
  // PATH is just the shim dir in these tests, so the shim may only use shell
  // builtins: `printf` with the payload inlined, never `cat`.
  const quote = (text: string): string => `'${text.replace(/'/g, `'\\''`)}'`;
  const branches: string[] = [];
  for (const [sub, behaviour] of Object.entries(behaviours)) {
    const labels = sub === 'version' ? 'version|--version' : sub;
    branches.push(
      `  ${labels})\n    printf '%s' ${quote(behaviour.stdout ?? '')}\n    printf '%s' ${quote(
        behaviour.stderr ?? ''
      )} >&2\n    exit ${behaviour.exit ?? 0};;`
    );
  }

  const isPlugin = name === 'docker';
  const script = [
    '#!/bin/sh',
    `echo "${name} $*" >> '${logFile}'`,
    isPlugin
      ? `if [ "$1" != "compose" ]; then exit ${behaviours.nonCompose?.exit ?? 0}; fi\nshift`
      : '',
    // drop a leading `-f <file>` global option
    'if [ "$1" = "-f" ]; then shift; shift; fi',
    'case "$1" in',
    ...branches,
    '  *) exit 0;;',
    'esac',
    '',
  ]
    .filter(line => line !== '')
    .join('\n');

  const target = path.join(dir, name);
  fs.writeFileSync(target, script, { mode: 0o755 });
  fs.chmodSync(target, 0o755);
}

/** Lines logged by the shims, in call order. */
export function readShimLog(logFile: string): string[] {
  try {
    return fs
      .readFileSync(logFile, 'utf8')
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** True while `pid` exists and is not a zombie. */
export function isPidAlive(pid: number): boolean {
  const info = readProcInfo(pid);
  return info !== null && info.state !== 'Z' && info.state !== 'X';
}

/** Poll `condition` until true or `timeoutMs` elapses. */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 25
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return true;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return condition();
}

/** Grab a free TCP port (loopback). */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

/** Two consecutive free ports (`port`, `port + 1`), for the dashboard + hub. */
export async function getFreePortPair(): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const port = await getFreePort();
    const neighbour = await new Promise<boolean>(resolve => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.listen(port + 1, '127.0.0.1', () => server.close(() => resolve(true)));
    });
    if (neighbour) return port;
  }
  throw new Error('could not find two consecutive free ports');
}

/** True when nothing accepts connections on `port`. */
export async function portIsClosed(port: number): Promise<boolean> {
  return !(await probePort(port));
}

/** Source of a tiny HTTP server listening on `--port=N` (or PORT). */
export const SERVER_SCRIPT = `
const http = require('http');
const arg = process.argv.slice(2).find(a => a.startsWith('--port='));
const port = Number(arg ? arg.split('=')[1] : process.env.PORT);
http.createServer((req, res) => { res.end('ok'); }).listen(port, '127.0.0.1', () => console.log('listening ' + port));
`;

/**
 * Spawn an unrelated long-lived process in its own session/group - the stand-in
 * for "some other process that now owns a recycled PID".
 */
export function spawnBystander(): { pid: number; kill: () => void } {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return {
    pid: child.pid as number,
    kill: () => {
      try {
        process.kill(-(child.pid as number), 'SIGKILL');
      } catch {
        // already gone
      }
    },
  };
}
