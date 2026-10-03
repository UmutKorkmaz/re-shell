// Helpers for tests that need a real broker in a Docker container.

import { execFileSync, spawnSync } from 'child_process';
import * as net from 'net';

let cached: boolean | undefined;

/** True when a Docker daemon answers `docker info` (cached). */
export function dockerAvailable(): boolean {
  if (cached === undefined) {
    const r = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { encoding: 'utf8', timeout: 20000 });
    cached = !r.error && r.status === 0;
  }
  return cached;
}

/** True when `image` is already present locally (so a test never waits on a pull). */
export function imageAvailable(image: string): boolean {
  const r = spawnSync('docker', ['image', 'inspect', image], { encoding: 'utf8', timeout: 20000 });
  return !r.error && r.status === 0;
}

/** Ask the OS for a free TCP port on localhost. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

/** A running container. */
export interface Container {
  id: string;
  /** Host port mapped to the container port. */
  port: number;
  stop(): void;
}

/**
 * `docker run -d --rm -p 127.0.0.1:<hostPort>:<containerPort> ...`
 * Pulls the image when it is missing. The container is removed on stop.
 */
export async function startContainer(options: { image: string; containerPort: number; hostPort?: number; env?: Record<string, string> }): Promise<Container> {
  if (!imageAvailable(options.image)) {
    execFileSync('docker', ['pull', options.image], { stdio: 'ignore', timeout: 600000 });
  }
  const hostPort = options.hostPort ?? (await freePort());
  const args = ['run', '-d', '--rm', '-p', `127.0.0.1:${hostPort}:${options.containerPort}`];
  for (const [k, v] of Object.entries(options.env ?? {})) args.push('-e', `${k}=${v}`);
  args.push(options.image);
  const id = execFileSync('docker', args, { encoding: 'utf8', timeout: 120000 }).trim();
  return {
    id,
    port: hostPort,
    stop: () => {
      spawnSync('docker', ['stop', '-t', '1', id], { stdio: 'ignore', timeout: 60000 });
    },
  };
}

/** Poll `probe` until it resolves, or throw after `timeoutMs`. */
export async function waitFor(probe: () => Promise<unknown>, timeoutMs: number, what: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      await probe();
      return;
    } catch (error) {
      last = error;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error(`${what} not ready after ${timeoutMs}ms: ${last instanceof Error ? last.message : String(last)}`);
}
