import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { errorCodeSchema } from '@re-shell/contracts';
import {
  IS_WINDOWS,
  SERVER_SCRIPT,
  cleanupTempDirs,
  getFreePort,
  makeShimDir,
  makeTempDir,
  portIsClosed,
  readShimLog,
  waitFor,
  writeComposeShim,
} from '../utils/service-fixtures';

/**
 * End-to-end conformance for `re-shell service run up|down|health`, driving the
 * BUILT CLI (dist/index.js) as a child process: real exit codes, real stdout /
 * stderr, real processes and ports. PATH shim scripts model docker /
 * docker-compose being absent or failing; when a real Docker + compose plugin is
 * available a genuine smoke test runs against it.
 */

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');

interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runCli(
  args: string[],
  options: { cwd: string; pathEnv?: string; timeoutMs?: number }
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' };
    if (options.pathEnv !== undefined) env.PATH = options.pathEnv;
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      cwd: options.cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => (stdout += d));
    child.stderr.on('data', d => (stderr += d));
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`re-shell ${args.join(' ')} timed out\nstdout: ${stdout}\nstderr: ${stderr}`));
    }, options.timeoutMs ?? 90000);
    child.once('error', reject);
    child.once('close', code => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function writeProject(files: Record<string, string>): string {
  const dir = makeTempDir('rs-cli-svc');
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

function parseSingleEnvelope(stdout: string): Record<string, any> {
  const lines = stdout.split('\n').filter(line => line.trim().length > 0);
  expect(lines, `expected exactly one stdout line, got: ${stdout}`).toHaveLength(1);
  return JSON.parse(lines[0]);
}

const COMPOSE_FILE = 'services:\n  web:\n    image: example/web\n';
const describePosix = describe.skipIf(IS_WINDOWS);
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) {
    await cleanup().catch(() => undefined);
  }
});

afterAll(() => cleanupTempDirs());

describePosix('re-shell service run - process fallback and failure propagation', () => {
  it('takes the npm-script path (not Docker) when no docker binary is on PATH, and supervises it', async () => {
    const shim = makeShimDir();
    const port = await getFreePort();
    const project = writeProject({
      'server.js': SERVER_SCRIPT,
      'package.json': JSON.stringify({ scripts: { dev: `node server.js --port=${port}` } }),
    });
    cleanups.push(async () => {
      await runCli(['service', 'run', 'down', '--timeout', '3000'], { cwd: project, pathEnv: shim });
    });

    const up = await runCli(['service', 'run', 'up', '--alive-ms', '300'], { cwd: project, pathEnv: shim });
    expect(up.code, up.stdout + up.stderr).toBe(0);
    expect(up.stdout).toContain('Services started');
    expect(up.stdout).toContain(`port ${port}`);
    expect(up.stderr).not.toContain('not found');
    expect(await portIsClosed(port)).toBe(false);

    const health = await runCli(['service', 'run', 'health', '--json'], { cwd: project, pathEnv: shim });
    expect(health.code).toBe(0);
    const envelope = parseSingleEnvelope(health.stdout);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toMatchObject({ runtime: 'process', healthy: true });
    expect(envelope.data.services[0]).toMatchObject({ name: 'dev', status: 'running', port });

    const down = await runCli(['service', 'run', 'down', '--timeout', '5000'], {
      cwd: project,
      pathEnv: shim,
    });
    expect(down.code, down.stdout + down.stderr).toBe(0);
    expect(down.stdout).toContain('Services stopped');
    expect(await waitFor(() => portIsClosed(port), 5000)).toBe(true);

    // After down there is nothing to be healthy: the health probe must say so.
    const after = await runCli(['service', 'run', 'health', '--json'], { cwd: project, pathEnv: shim });
    expect(after.code).toBe(1);
    const failure = parseSingleEnvelope(after.stdout);
    expect(failure.ok).toBe(false);
    expect(failure.error.code).toBe('SERVICES_UNHEALTHY');
  });

  it('exits non-zero with a clear message when a compose file exists but docker does not (no false success)', async () => {
    const shim = makeShimDir();
    const project = writeProject({ 'docker-compose.yml': COMPOSE_FILE });

    const up = await runCli(['service', 'run', 'up'], { cwd: project, pathEnv: shim });
    expect(up.code).toBe(1);
    expect(up.stderr).toContain('neither `docker compose` nor `docker-compose`');
    expect(up.stdout).not.toContain('Services started');
    expect(up.stdout).not.toContain('No running services');
    expect(up.stderr).not.toContain('/bin/sh');

    const down = await runCli(['service', 'run', 'down'], { cwd: project, pathEnv: shim });
    expect(down.code).toBe(1);
    expect(down.stdout).not.toContain('Services stopped');

    const health = await runCli(['service', 'run', 'health', '--json'], { cwd: project, pathEnv: shim });
    expect(health.code).toBe(1);
    const envelope = parseSingleEnvelope(health.stdout);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('SERVICES_COMPOSE_UNAVAILABLE');
    // The code is part of the published contract vocabulary.
    expect(errorCodeSchema.safeParse(envelope.error.code).success).toBe(true);
  });

  it('exits non-zero when docker-compose itself fails (exit codes are no longer ignored)', async () => {
    const shim = makeShimDir();
    const log = path.join(shim, 'calls.log');
    writeComposeShim(shim, {
      name: 'docker-compose',
      logFile: log,
      behaviours: {
        version: { stdout: 'docker-compose version 1.29.2\n' },
        up: { exit: 1, stderr: 'ERROR: pull access denied for example/web' },
        down: { exit: 3, stderr: 'cannot connect to the Docker daemon' },
      },
    });
    const project = writeProject({ 'docker-compose.yml': COMPOSE_FILE });

    const up = await runCli(['service', 'run', 'up'], { cwd: project, pathEnv: shim });
    expect(up.code).toBe(1);
    expect(up.stderr).toContain('pull access denied');
    expect(up.stdout).not.toContain('Services started');

    const down = await runCli(['service', 'run', 'down'], { cwd: project, pathEnv: shim });
    expect(down.code).toBe(1);
    expect(down.stderr).toContain('cannot connect to the Docker daemon');
    expect(down.stdout).not.toContain('Services stopped');

    expect(readShimLog(log)).toEqual(
      expect.arrayContaining(['docker-compose up -d', 'docker-compose down'])
    );
  });

  it('exits non-zero when a service exits immediately, naming the exit code and showing the log', async () => {
    const shim = makeShimDir();
    const project = writeProject({
      'crash.js': 'console.error("fatal: EADDRINUSE"); process.exit(4);',
      'package.json': JSON.stringify({ scripts: { dev: 'node crash.js' } }),
    });

    const up = await runCli(['service', 'run', 'up', '--alive-ms', '300'], { cwd: project, pathEnv: shim });

    expect(up.code).toBe(1);
    expect(up.stderr).toContain("Service 'dev' exited with code 4");
    expect(up.stderr).toContain('fatal: EADDRINUSE');
    expect(up.stdout).not.toContain('Services started');
    // No half-registered service is left behind.
    const pids = path.join(project, '.re-shell', 'pids');
    expect(fs.existsSync(pids) ? fs.readdirSync(pids) : []).toEqual([]);
  });

  it('rejects a malformed --timeout instead of arming an instant timer', async () => {
    const shim = makeShimDir();
    const project = writeProject({ 'package.json': '{}' });
    const result = await runCli(['service', 'run', 'up', '--timeout', 'abc'], {
      cwd: project,
      pathEnv: shim,
    });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Invalid --timeout');
  });
});

// ─── Real Docker smoke test ──────────────────────────────────────────────────

function dockerComposeAvailable(): boolean {
  if (IS_WINDOWS) return false;
  const version = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' });
  if (version.status !== 0) return false;
  const info = spawnSync('docker', ['info'], { encoding: 'utf8', timeout: 20000 });
  return info.status === 0;
}

const HAS_DOCKER = dockerComposeAvailable();

describe.skipIf(!HAS_DOCKER)('re-shell service run - real Docker Compose smoke test', () => {
  /** Ensure the tiny `hello-world` image is present, pulling it if necessary. */
  function ensureHelloWorld(): boolean {
    if (spawnSync('docker', ['image', 'inspect', 'hello-world'], { stdio: 'ignore' }).status === 0) {
      return true;
    }
    return spawnSync('docker', ['pull', 'hello-world'], { stdio: 'ignore', timeout: 90000 }).status === 0;
  }

  it('brings a real compose project up, reports health from real container state, and tears it down', async ctx => {
    if (!ensureHelloWorld()) ctx.skip();
    const project = writeProject({
      'docker-compose.yml': 'services:\n  hello:\n    image: hello-world\n',
    });
    cleanups.push(async () => {
      await runCli(['service', 'run', 'down'], { cwd: project, timeoutMs: 120000 });
    });

    const up = await runCli(['service', 'run', 'up', '--timeout', '120000'], {
      cwd: project,
      timeoutMs: 180000,
    });
    expect(up.code, up.stdout + up.stderr).toBe(0);
    expect(up.stdout).toContain('Services started');
    expect(up.stdout).toContain('hello');

    // hello-world is a one-shot container: it ran and exited 0, which is healthy.
    const health = await runCli(['service', 'run', 'health', '--json'], { cwd: project });
    expect(health.code, health.stdout + health.stderr).toBe(0);
    const envelope = parseSingleEnvelope(health.stdout);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.runtime).toBe('compose');
    expect(envelope.data.services).toEqual([
      expect.objectContaining({ name: 'hello', state: 'exited', exitCode: 0, ok: true }),
    ]);

    const down = await runCli(['service', 'run', 'down'], { cwd: project, timeoutMs: 120000 });
    expect(down.code, down.stdout + down.stderr).toBe(0);
    expect(down.stdout).toContain('Services stopped');

    const after = await runCli(['service', 'run', 'health', '--json'], { cwd: project });
    expect(after.code).toBe(1);
    expect(parseSingleEnvelope(after.stdout).error.code).toBe('SERVICES_UNHEALTHY');
  });

  it('exits non-zero when compose cannot start the project (image does not exist)', async () => {
    const project = writeProject({
      'docker-compose.yml':
        'services:\n  ghost:\n    image: re-shell-nonexistent-image-xyz:0.0.1\n',
    });
    cleanups.push(async () => {
      await runCli(['service', 'run', 'down'], { cwd: project, timeoutMs: 120000 });
    });

    const up = await runCli(['service', 'run', 'up', '--timeout', '120000'], {
      cwd: project,
      timeoutMs: 180000,
    });

    expect(up.code).toBe(1);
    expect(up.stderr).toContain('docker compose up failed');
    expect(up.stdout).not.toContain('Services started');
  });
});
