import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ServiceRuntimeError,
  parseDockerCompose,
  servicesDown,
  servicesExec,
  servicesHealth,
  servicesInspect,
  servicesLogs,
  servicesRestart,
  servicesScale,
  servicesUp,
} from '../../src/commands/services';
import {
  pidFilePath,
  readProcInfo,
  readServiceRecords,
  type ServiceProcessRecord,
} from '../../src/utils/service-process';
import {
  IS_WINDOWS,
  SERVER_SCRIPT,
  cleanupTempDirs,
  getFreePort,
  isPidAlive,
  makeShimDir,
  makeTempDir,
  portIsClosed,
  readShimLog,
  spawnBystander,
  waitFor,
  writeComposeShim,
} from '../utils/service-fixtures';

// Real tests of `service run up|down|health|...` at the command-function level.
// Nothing in src/commands/services is mocked: PATH shim scripts stand in for
// docker / docker-compose (present, absent, failing) and process-mode services
// are real node processes whose liveness, ports and process groups are asserted
// against the live kernel.

const describePosix = describe.skipIf(IS_WINDOWS);

let originalPath: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
const projects: string[] = [];
const bystanders: Array<{ kill: () => void }> = [];

function printed(): string {
  return logSpy.mock.calls.map(call => call.join(' ')).join('\n');
}
function warned(): string {
  return warnSpy.mock.calls.map(call => call.join(' ')).join('\n');
}

beforeEach(() => {
  originalPath = process.env.PATH;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(async () => {
  // Make sure no test leaves a service behind.
  for (const project of projects.splice(0)) {
    try {
      await servicesDown(project, { timeout: 2000 });
    } catch {
      // best effort
    }
  }
  for (const b of bystanders.splice(0)) b.kill();
  logSpy.mockRestore();
  warnSpy.mockRestore();
  process.env.PATH = originalPath;
  cleanupTempDirs();
});

function makeProject(files: Record<string, string>): string {
  const dir = makeTempDir('rs-proj');
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(dir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  projects.push(dir);
  return dir;
}

/** PATH containing only `node`: Docker and docker-compose are absent. */
function noDockerPath(): string {
  const dir = makeShimDir();
  process.env.PATH = dir;
  return dir;
}

const COMPOSE_FILE = 'services:\n  web:\n    image: example/web\n  db:\n    image: example/db\n';
const FAST = { aliveMs: 250, timeout: 8000 };

async function rejection(promise: Promise<unknown>): Promise<ServiceRuntimeError> {
  const error = await promise.then(
    () => {
      throw new Error('expected the promise to reject');
    },
    (e: unknown) => e
  );
  expect(error).toBeInstanceOf(ServiceRuntimeError);
  return error as ServiceRuntimeError;
}

describePosix('servicesUp - runtime selection and exit codes', () => {
  it('takes the package.json script path when no docker binary exists (and really starts it)', async () => {
    noDockerPath();
    const port = await getFreePort();
    const project = makeProject({
      'server.js': SERVER_SCRIPT,
      'package.json': JSON.stringify({ scripts: { dev: `node server.js --port=${port}` } }),
    });

    const result = await servicesUp(project, FAST);

    expect(result.runtime).toBe('process');
    expect(result.services).toHaveLength(1);
    expect(result.services[0]).toMatchObject({ name: 'dev', port, readiness: 'port' });
    expect(await portIsClosed(port)).toBe(false);
    expect(isPidAlive(result.services[0].pid as number)).toBe(true);
    expect(printed()).toContain('Services started');

    await servicesDown(project, { timeout: 3000 });
    expect(await portIsClosed(port)).toBe(true);
  });

  it('fails explicitly (no success claim) for a compose-only project when no docker exists', async () => {
    noDockerPath();
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });

    const error = await rejection(servicesUp(project, FAST));

    expect(error.code).toBe('SERVICES_COMPOSE_UNAVAILABLE');
    expect(error.message).toContain('neither `docker compose` nor `docker-compose`');
    expect(printed()).not.toContain('Services started');
    expect(printed()).not.toContain('No running services');
  });

  it('falls back to package.json scripts (with a warning) when a compose file exists but docker does not', async () => {
    noDockerPath();
    const port = await getFreePort();
    const project = makeProject({
      'docker-compose.yml': COMPOSE_FILE,
      'server.js': SERVER_SCRIPT,
      'package.json': JSON.stringify({ scripts: { dev: `node server.js --port=${port}` } }),
    });

    const result = await servicesUp(project, FAST);

    expect(result.runtime).toBe('process');
    expect(warned()).toContain('Docker Compose is not available');
  });

  it('fails with SERVICES_NOT_FOUND when there is nothing to start', async () => {
    noDockerPath();
    const project = makeProject({ 'package.json': JSON.stringify({ scripts: { build: 'tsc' } }) });
    const error = await rejection(servicesUp(project, FAST));
    expect(error.code).toBe('SERVICES_NOT_FOUND');
  });

  it('uses the `docker compose` plugin for EVERY call when both implementations exist', async () => {
    const dir = noDockerPath();
    const log = path.join(dir, 'calls.log');
    writeComposeShim(dir, {
      name: 'docker',
      logFile: log,
      behaviours: {
        version: { stdout: 'Docker Compose version v2.99.0\n' },
        up: {},
        ps: { stdout: '{"Service":"web","State":"running"}\n{"Service":"db","State":"running"}\n' },
      },
    });
    writeComposeShim(dir, {
      name: 'docker-compose',
      logFile: log,
      behaviours: { version: { stdout: 'docker-compose version 1.29.2\n' } },
    });
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });

    const result = await servicesUp(project, { ...FAST, build: true, scale: { web: 2 } });

    expect(result.runtime).toBe('compose');
    expect(result.composeCommand).toBe('docker compose');
    const calls = readShimLog(log);
    expect(calls).toContain('docker compose version');
    expect(calls).toContain('docker compose up -d --build --scale web=2');
    expect(calls).toContain('docker compose ps -a --format json');
    // The standalone binary must never be used when the plugin was detected.
    expect(calls.some(c => c.startsWith('docker-compose'))).toBe(false);
    expect(printed()).toContain('Services started');
  });

  it('uses the standalone docker-compose for EVERY call when the plugin is missing', async () => {
    const dir = noDockerPath();
    const log = path.join(dir, 'calls.log');
    writeComposeShim(dir, {
      name: 'docker',
      logFile: log,
      behaviours: { version: { exit: 1, stderr: "docker: 'compose' is not a docker command" } },
    });
    writeComposeShim(dir, {
      name: 'docker-compose',
      logFile: log,
      behaviours: {
        version: { stdout: 'docker-compose version 1.29.2\n' },
        up: {},
        ps: { stdout: '[{"Service":"web","State":"running"}]' },
        down: {},
      },
    });
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });

    const up = await servicesUp(project, FAST);
    await servicesDown(project, { timeout: 5000 });

    expect(up.composeCommand).toBe('docker-compose');
    const calls = readShimLog(log);
    expect(calls).toContain('docker-compose up -d');
    expect(calls).toContain('docker-compose down');
    // Only the version probe ever went to the (non-working) plugin.
    const dockerCalls = calls.filter(c => c.startsWith('docker '));
    expect(dockerCalls).toEqual(['docker compose version', 'docker compose version']);
  });

  it('propagates a failing compose up as SERVICES_COMPOSE_FAILED instead of reporting success', async () => {
    const dir = noDockerPath();
    writeComposeShim(dir, {
      name: 'docker-compose',
      logFile: path.join(dir, 'calls.log'),
      behaviours: {
        version: { stdout: 'docker-compose version 1.29.2\n' },
        up: { exit: 1, stderr: 'ERROR: pull access denied for example/web' },
      },
    });
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });

    const error = await rejection(servicesUp(project, FAST));

    expect(error.code).toBe('SERVICES_COMPOSE_FAILED');
    expect(error.message).toContain('exited with code 1');
    expect(error.message).toContain('pull access denied');
    expect(error.details?.exitCode).toBe(1);
    expect(printed()).not.toContain('Services started');
    expect(printed()).not.toContain('No running services');
  });

  it('does not claim success when up exits 0 but a container has crashed', async () => {
    const dir = noDockerPath();
    writeComposeShim(dir, {
      name: 'docker',
      logFile: path.join(dir, 'calls.log'),
      behaviours: {
        version: { stdout: 'Docker Compose version v2.99.0\n' },
        up: {},
        ps: {
          stdout:
            '{"Service":"web","State":"running"}\n{"Service":"db","State":"exited","ExitCode":1}\n',
        },
      },
    });
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });

    const error = await rejection(servicesUp(project, FAST));

    expect(error.code).toBe('SERVICES_START_FAILED');
    expect(error.message).toContain('db (exited code 1)');
    expect(printed()).not.toContain('Services started');
  });

  it('accepts a one-shot container that completed with exit code 0', async () => {
    const dir = noDockerPath();
    writeComposeShim(dir, {
      name: 'docker',
      logFile: path.join(dir, 'calls.log'),
      behaviours: {
        version: { stdout: 'Docker Compose version v2.99.0\n' },
        up: {},
        ps: {
          stdout:
            '{"Service":"web","State":"running","Ports":"0.0.0.0:8080->80/tcp"}\n{"Service":"migrate","State":"exited","ExitCode":0}\n',
        },
      },
    });
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });

    const result = await servicesUp(project, FAST);

    expect(result.services.map(s => s.name)).toEqual(['web', 'migrate']);
    expect(printed()).toContain('Port: 8080');
  });

  it('warns (does not claim verification) when container state cannot be listed', async () => {
    const dir = noDockerPath();
    writeComposeShim(dir, {
      name: 'docker',
      logFile: path.join(dir, 'calls.log'),
      behaviours: {
        version: { stdout: 'Docker Compose version v2.99.0\n' },
        up: {},
        ps: { exit: 1, stderr: 'unknown flag: --format' },
      },
    });
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });

    const result = await servicesUp(project, FAST);

    expect(result.services).toEqual([]);
    expect(warned()).toContain('could not be verified');
    expect(printed()).not.toContain('Services started');
  });

  it('passes -f for compose files that docker compose does not discover on its own', async () => {
    const dir = noDockerPath();
    const log = path.join(dir, 'calls.log');
    writeComposeShim(dir, {
      name: 'docker',
      logFile: log,
      behaviours: {
        version: { stdout: 'Docker Compose version v2.99.0\n' },
        up: {},
        ps: { stdout: '[]' },
      },
    });
    const project = makeProject({ 'docker-compose.dev.yml': COMPOSE_FILE });

    await servicesUp(project, FAST);

    const upCall = readShimLog(log).find(c => c.includes(' up '));
    expect(upCall).toBe(`docker compose -f ${path.join(project, 'docker-compose.dev.yml')} up -d`);
  });

  it('kills a hung compose command at the timeout and reports it', async () => {
    const dir = noDockerPath();
    // A docker-compose that answers the version probe, then hangs on `up`.
    const target = path.join(dir, 'docker-compose');
    fs.writeFileSync(
      target,
      `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "docker-compose version 1.29.2"; exit 0; fi\nexec node -e "setTimeout(() => {}, 60000)"\n`,
      { mode: 0o755 }
    );
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });

    const error = await rejection(servicesUp(project, { aliveMs: 100, timeout: 600 }));

    expect(error.code).toBe('SERVICES_COMPOSE_FAILED');
    expect(error.message).toContain('timed out after 600ms');
  });
});

describePosix('servicesUp - process supervision', () => {
  it('rolls back already-started services when a later one exits immediately', async () => {
    noDockerPath();
    const port = await getFreePort();
    const project = makeProject({
      'server.js': SERVER_SCRIPT,
      'crash.js': 'console.error("boom: missing config"); process.exit(2);',
      'package.json': JSON.stringify({
        scripts: { dev: `node server.js --port=${port}`, start: 'node crash.js' },
      }),
    });

    const error = await rejection(servicesUp(project, FAST));

    expect(error.code).toBe('SERVICES_START_FAILED');
    expect(error.message).toContain("Service 'start' exited with code 2");
    expect(error.message).toContain('boom: missing config');
    // `dev` was started first, then rolled back: nothing may be left running or recorded.
    expect(await waitFor(() => portIsClosed(port), 4000)).toBe(true);
    expect((await readServiceRecords(project)).records).toEqual([]);
    expect(printed()).not.toContain('Services started');
  });

  it('fails when a script cannot be spawned at all', async () => {
    noDockerPath();
    const project = makeProject({
      'package.json': JSON.stringify({ scripts: { dev: 'definitely-not-a-real-binary-xyz --serve' } }),
    });
    const error = await rejection(servicesUp(project, FAST));
    expect(error.code).toBe('SERVICES_START_FAILED');
    expect(error.message).toContain('command not found');
  });

  it('waits for a configured health URL (package.json re-shell.services metadata)', async () => {
    noDockerPath();
    const port = await getFreePort();
    const project = makeProject({
      'api.js': `require('http').createServer((q, r) => { r.statusCode = q.url === '/healthz' ? 200 : 404; r.end('x'); }).listen(${port}, '127.0.0.1');`,
      'package.json': JSON.stringify({
        scripts: { 'dev:api': 'node api.js' },
        're-shell': { services: { 'dev:api': { healthUrl: `http://127.0.0.1:${port}/healthz` } } },
      }),
    });

    const result = await servicesUp(project, FAST);

    expect(result.services[0]).toMatchObject({ name: 'dev-api', readiness: 'url' });
  });

  it('ignores lifecycle/one-shot scripts such as predev and build:dev', async () => {
    noDockerPath();
    const project = makeProject({
      'package.json': JSON.stringify({
        scripts: { predev: 'echo hi', 'build:dev': 'webpack', test: 'vitest', dev: 'node -e "setInterval(()=>{},1000)"' },
      }),
    });
    // `dev` contains shell quoting, so it runs via /bin/sh -c and must stay alive.
    const result = await servicesUp(project, FAST);
    expect(result.services.map(s => s.name)).toEqual(['dev']);
  });
});

describePosix('servicesDown', () => {
  it('stops each process group (grandchildren included) and cleans up PID and log files', async () => {
    noDockerPath();
    const gcFile = path.join(makeTempDir('rs-gc'), 'grandchild.pid');
    const project = makeProject({
      'tree.js': `const { spawn } = require('child_process');
const gc = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
require('fs').writeFileSync(${JSON.stringify(gcFile)}, String(gc.pid));
setInterval(() => {}, 1000);`,
      'package.json': JSON.stringify({ scripts: { dev: 'node tree.js' } }),
    });

    const up = await servicesUp(project, { aliveMs: 500, timeout: 8000 });
    const leader = up.services[0].pid as number;
    const logFile = up.services[0].logFile as string;
    await waitFor(() => fs.existsSync(gcFile));
    const grandchild = Number(fs.readFileSync(gcFile, 'utf8'));
    expect(isPidAlive(grandchild)).toBe(true);

    const down = await servicesDown(project, { timeout: 4000 });

    expect(down.stopped).toEqual([{ name: 'dev', pid: leader, outcome: 'terminated' }]);
    expect(isPidAlive(leader)).toBe(false);
    expect(isPidAlive(grandchild)).toBe(false);
    expect(fs.existsSync(pidFilePath(project, 'dev'))).toBe(false);
    expect(fs.existsSync(logFile)).toBe(false);
    expect(printed()).toContain('Services stopped');
  });

  it('is honest when there is nothing to stop (no success claim)', async () => {
    noDockerPath();
    const project = makeProject({ 'package.json': JSON.stringify({ scripts: { dev: 'x' } }) });
    const result = await servicesDown(project, { timeout: 1000 });
    expect(result.stopped).toEqual([]);
    expect(printed()).toContain('No running services found');
    expect(printed()).not.toContain('Services stopped');
  });

  it('fails when a compose file exists, docker does not, and nothing else is recorded', async () => {
    noDockerPath();
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });
    const error = await rejection(servicesDown(project, { timeout: 1000 }));
    expect(error.code).toBe('SERVICES_COMPOSE_UNAVAILABLE');
    expect(printed()).not.toContain('Services stopped');
  });

  it('propagates a failing compose down instead of printing "Services stopped"', async () => {
    const dir = noDockerPath();
    writeComposeShim(dir, {
      name: 'docker',
      logFile: path.join(dir, 'calls.log'),
      behaviours: {
        version: { stdout: 'Docker Compose version v2.99.0\n' },
        down: { exit: 3, stderr: 'cannot connect to the Docker daemon' },
      },
    });
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });

    const error = await rejection(servicesDown(project, { timeout: 5000 }));

    expect(error.code).toBe('SERVICES_COMPOSE_FAILED');
    expect(error.message).toContain('exited with code 3');
    expect(error.message).toContain('cannot connect to the Docker daemon');
    expect(printed()).not.toContain('Services stopped');
  });

  it('passes -v and --remove-orphans through to compose down', async () => {
    const dir = noDockerPath();
    const log = path.join(dir, 'calls.log');
    writeComposeShim(dir, {
      name: 'docker',
      logFile: log,
      behaviours: { version: { stdout: 'Docker Compose version v2.99.0\n' }, down: {} },
    });
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });

    await servicesDown(project, { volumes: true, removeOrphans: true, timeout: 5000 });

    expect(readShimLog(log)).toContain('docker compose down -v --remove-orphans');
    expect(printed()).toContain('Services stopped');
  });

  it('does not kill an unrelated process referenced by a legacy plain-number PID file', async () => {
    noDockerPath();
    const bystander = spawnBystander();
    bystanders.push(bystander);
    const project = makeProject({ 'package.json': '{}' });
    const pidDir = path.join(project, '.re-shell', 'pids');
    fs.mkdirSync(pidDir, { recursive: true });
    fs.writeFileSync(path.join(pidDir, 'old.pid'), String(bystander.pid));

    const result = await servicesDown(project, { timeout: 1000 });

    expect(result.stopped).toEqual([]);
    expect(isPidAlive(bystander.pid)).toBe(true);
    expect(warned()).toContain('legacy PID file');
    expect(fs.existsSync(path.join(pidDir, 'old.pid'))).toBe(false);
  });

  it('does not kill a process that now owns a recorded (recycled) PID', async () => {
    noDockerPath();
    const bystander = spawnBystander();
    bystanders.push(bystander);
    const project = makeProject({ 'package.json': '{}' });
    const record: ServiceProcessRecord = {
      version: 1,
      name: 'stale',
      pid: bystander.pid,
      pgid: bystander.pid,
      startTime: 'proc:00000000:12345', // recorded for a different, dead process
      command: 'node old.js',
      argv: [],
      shell: false,
      cwd: project,
      startedAt: new Date().toISOString(),
      logFile: path.join(project, '.re-shell', 'logs', 'stale.log'),
      readiness: 'alive',
    };
    fs.mkdirSync(path.join(project, '.re-shell', 'pids'), { recursive: true });
    fs.writeFileSync(pidFilePath(project, 'stale'), JSON.stringify(record));

    const result = await servicesDown(project, { timeout: 1000 });

    expect(result.stopped).toEqual([{ name: 'stale', pid: bystander.pid, outcome: 'identity-mismatch' }]);
    expect(isPidAlive(bystander.pid)).toBe(true);
    expect(warned()).toContain('now belongs to a different process');
    expect(fs.existsSync(pidFilePath(project, 'stale'))).toBe(false);
  });
});

describePosix('servicesHealth', () => {
  it('reports running processes as healthy, with the port actually probed', async () => {
    noDockerPath();
    const port = await getFreePort();
    const project = makeProject({
      'server.js': SERVER_SCRIPT,
      'package.json': JSON.stringify({ scripts: { dev: `node server.js --port=${port}` } }),
    });
    await servicesUp(project, FAST);

    const report = await servicesHealth(project, { json: true });

    expect(report.healthy).toBe(true);
    expect(report.runtime).toBe('process');
    expect(report.services[0]).toMatchObject({ name: 'dev', status: 'running', ok: true, port });
    // json:true renders nothing itself.
    expect(printed()).not.toContain('Service Health Status');
  });

  it('removes stale PID files of dead processes and fails with SERVICES_UNHEALTHY', async () => {
    noDockerPath();
    const project = makeProject({
      'package.json': JSON.stringify({ scripts: { dev: 'node -e "setInterval(()=>{},1000)"' } }),
    });
    const up = await servicesUp(project, FAST);
    const pid = up.services[0].pid as number;
    expect(fs.existsSync(pidFilePath(project, 'dev'))).toBe(true);

    // Kill the service behind our back.
    process.kill(-pid, 'SIGKILL');
    expect(await waitFor(() => !isPidAlive(pid))).toBe(true);

    const error = await rejection(servicesHealth(project, { json: true }));

    expect(error.code).toBe('SERVICES_UNHEALTHY');
    const report = error.details?.report as { services: Array<{ status: string; note?: string }> };
    expect(report.services[0].status).toBe('stopped');
    expect(report.services[0].note).toContain('stale PID file removed');
    expect(fs.existsSync(pidFilePath(project, 'dev'))).toBe(false);
    // The log is kept for diagnosis.
    expect(fs.existsSync(up.services[0].logFile as string)).toBe(true);
  });

  it('flags a live process whose configured port stopped listening as unhealthy', async () => {
    noDockerPath();
    const port = await getFreePort();
    const project = makeProject({
      'flaky.js': `const s = require('net').createServer(() => {}).listen(${port}, '127.0.0.1');
setTimeout(() => s.close(), 700); setInterval(() => {}, 1000);`,
      'package.json': JSON.stringify({ scripts: { dev: `node flaky.js --port=${port}` } }),
    });
    await servicesUp(project, FAST);
    expect(await waitFor(() => portIsClosed(port), 5000)).toBe(true);

    const error = await rejection(servicesHealth(project, { json: true }));

    expect(error.code).toBe('SERVICES_UNHEALTHY');
    const report = error.details?.report as { services: Array<{ status: string; note?: string }> };
    expect(report.services[0].status).toBe('unhealthy');
    expect(report.services[0].note).toContain(`port ${port}`);
  });

  it('fails (rather than reporting health) when nothing is running', async () => {
    noDockerPath();
    const project = makeProject({ 'package.json': JSON.stringify({ scripts: { dev: 'x' } }) });
    const error = await rejection(servicesHealth(project, {}));
    expect(error.code).toBe('SERVICES_UNHEALTHY');
    expect(error.message).toContain('No running services found');
  });

  it('classifies compose containers from `ps -a --format json`', async () => {
    const dir = noDockerPath();
    const log = path.join(dir, 'calls.log');
    writeComposeShim(dir, {
      name: 'docker',
      logFile: log,
      behaviours: {
        version: { stdout: 'Docker Compose version v2.99.0\n' },
        ps: {
          stdout:
            '{"Service":"web","State":"running","Health":"healthy"}\n{"Service":"db","State":"running","Health":"unhealthy"}\n{"Service":"job","State":"exited","ExitCode":0}\n',
        },
      },
    });
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });

    const error = await rejection(servicesHealth(project, { json: true }));

    expect(error.code).toBe('SERVICES_UNHEALTHY');
    expect(error.message).toContain('1 of 3 service(s) are not healthy');
    const report = error.details?.report as { runtime: string; services: Array<{ name: string; ok: boolean }> };
    expect(report.runtime).toBe('compose');
    expect(report.services.map(s => [s.name, s.ok])).toEqual([
      ['web', true],
      ['db', false],
      ['job', true],
    ]);
    expect(readShimLog(log)).toContain('docker compose ps -a --format json');
  });

  it('returns the report when every compose container is healthy', async () => {
    const dir = noDockerPath();
    writeComposeShim(dir, {
      name: 'docker',
      logFile: path.join(dir, 'calls.log'),
      behaviours: {
        version: { stdout: 'Docker Compose version v2.99.0\n' },
        ps: { stdout: '[{"Service":"web","State":"running"}]' },
      },
    });
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });
    const report = await servicesHealth(project, { json: true });
    expect(report.healthy).toBe(true);
  });

  it('propagates a failing compose ps as SERVICES_COMPOSE_FAILED', async () => {
    const dir = noDockerPath();
    writeComposeShim(dir, {
      name: 'docker',
      logFile: path.join(dir, 'calls.log'),
      behaviours: {
        version: { stdout: 'Docker Compose version v2.99.0\n' },
        ps: { exit: 1, stderr: 'daemon not running' },
      },
    });
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });
    const error = await rejection(servicesHealth(project, { json: true }));
    expect(error.code).toBe('SERVICES_COMPOSE_FAILED');
    expect(error.message).toContain('daemon not running');
  });

  it('watch mode streams reports and ends with an error when compose starts failing', async () => {
    const dir = noDockerPath();
    const counter = path.join(dir, 'count');
    fs.writeFileSync(counter, '0');
    const bump = path.join(dir, 'bump.js');
    fs.writeFileSync(
      bump,
      `const fs = require('fs');
const n = Number(fs.readFileSync(${JSON.stringify(counter)}, 'utf8')) + 1;
fs.writeFileSync(${JSON.stringify(counter)}, String(n));
console.log(n);`
    );
    // `ps` succeeds once, then fails.
    fs.writeFileSync(
      path.join(dir, 'docker'),
      `#!/bin/sh
if [ "$2" = "version" ]; then echo "Docker Compose version v2.99.0"; exit 0; fi
if [ "$2" = "ps" ]; then
  n=$(node ${bump})
  if [ "$n" = "1" ]; then echo '[{"Service":"web","State":"running"}]'; exit 0; fi
  echo "gone" >&2; exit 1
fi
exit 0
`,
      { mode: 0o755 }
    );
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });
    const reports: unknown[] = [];

    const error = await rejection(
      servicesHealth(project, { watch: true, interval: 20, onReport: r => reports.push(r) })
    );

    expect(reports).toHaveLength(1);
    expect(error.code).toBe('SERVICES_COMPOSE_FAILED');
  });
});

describePosix('servicesRestart', () => {
  it('restarts only the named service and leaves the others alone', async () => {
    noDockerPath();
    const portA = await getFreePort();
    const portB = await getFreePort();
    const project = makeProject({
      'server.js': SERVER_SCRIPT,
      'package.json': JSON.stringify({
        scripts: {
          dev: `node server.js --port=${portA}`,
          'dev:b': `node server.js --port=${portB}`,
        },
      }),
    });
    const up = await servicesUp(project, FAST);
    const before = Object.fromEntries(up.services.map(s => [s.name, s.pid as number]));
    expect(Object.keys(before).sort()).toEqual(['dev', 'dev-b']);

    await servicesRestart(project, 'dev-b', { aliveMs: 250, timeout: 8000 });

    const records = (await readServiceRecords(project)).records;
    const after = Object.fromEntries(records.map(r => [r.name, r.pid]));
    expect(after.dev).toBe(before.dev); // untouched
    expect(after['dev-b']).not.toBe(before['dev-b']); // really restarted
    expect(isPidAlive(before['dev-b'])).toBe(false);
    expect(isPidAlive(after['dev-b'])).toBe(true);
    expect(await portIsClosed(portB)).toBe(false);
    expect(await portIsClosed(portA)).toBe(false);
  });

  it('fails for an unknown service', async () => {
    noDockerPath();
    const project = makeProject({ 'package.json': JSON.stringify({ scripts: { dev: 'x' } }) });
    const error = await rejection(servicesRestart(project, 'nope', { aliveMs: 100 }));
    expect(error.code).toBe('SERVICES_NOT_FOUND');
  });

  it('propagates a failing compose restart', async () => {
    const dir = noDockerPath();
    writeComposeShim(dir, {
      name: 'docker',
      logFile: path.join(dir, 'calls.log'),
      behaviours: {
        version: { stdout: 'Docker Compose version v2.99.0\n' },
        restart: { exit: 1, stderr: 'no such service: web' },
      },
    });
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });
    const error = await rejection(servicesRestart(project, 'web', { timeout: 5000 }));
    expect(error.code).toBe('SERVICES_COMPOSE_FAILED');
    expect(printed()).not.toContain('restarted');
  });
});

describePosix('servicesScale / servicesExec / servicesLogs', () => {
  it('refuses to scale in process mode (explicit failure, not a yellow no-op)', async () => {
    noDockerPath();
    const project = makeProject({ 'package.json': JSON.stringify({ scripts: { dev: 'x' } }) });
    const error = await rejection(servicesScale(project, 'dev', 3));
    expect(error.code).toBe('SERVICES_COMPOSE_UNAVAILABLE');
    expect(printed()).not.toContain('scaled');
  });

  it('rejects an invalid replica count', async () => {
    noDockerPath();
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });
    const error = await rejection(servicesScale(project, 'web', Number.NaN));
    expect(error.code).toBe('SERVICES_ERROR');
  });

  it('scales through the detected compose binary and checks its exit code', async () => {
    const dir = noDockerPath();
    const log = path.join(dir, 'calls.log');
    writeComposeShim(dir, {
      name: 'docker',
      logFile: log,
      behaviours: { version: { stdout: 'Docker Compose version v2.99.0\n' }, up: {} },
    });
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });

    await servicesScale(project, 'web', 3);

    expect(readShimLog(log)).toContain('docker compose up -d --scale web=3');
    expect(printed()).toContain("scaled to 3 instances");
  });

  it('refuses to exec in process mode and propagates a failing compose exec', async () => {
    noDockerPath();
    const noCompose = makeProject({ 'package.json': JSON.stringify({ scripts: { dev: 'x' } }) });
    const first = await rejection(servicesExec(noCompose, 'dev', ['ls']));
    expect(first.code).toBe('SERVICES_COMPOSE_UNAVAILABLE');

    const dir = noDockerPath();
    writeComposeShim(dir, {
      name: 'docker',
      logFile: path.join(dir, 'calls.log'),
      behaviours: {
        version: { stdout: 'Docker Compose version v2.99.0\n' },
        exec: { exit: 5 },
      },
    });
    const project = makeProject({ 'docker-compose.yml': COMPOSE_FILE });
    const second = await rejection(servicesExec(project, 'web', ['false'], { interactive: false }));
    expect(second.code).toBe('SERVICES_COMPOSE_FAILED');
    expect(second.details?.exitCode).toBe(5);
  });

  it('shows process-mode logs and fails clearly when there are none', async () => {
    noDockerPath();
    const project = makeProject({
      'hello.js': 'console.log("service says hello"); setInterval(() => {}, 1000);',
      'package.json': JSON.stringify({ scripts: { dev: 'node hello.js' } }),
    });
    const none = await rejection(servicesLogs(project));
    expect(none.code).toBe('SERVICES_NOT_FOUND');

    await servicesUp(project, FAST);
    expect(await waitFor(() => fs.readFileSync(path.join(project, '.re-shell/logs/dev.log'), 'utf8').includes('hello'))).toBe(true);

    await servicesLogs(project, 'dev', { tail: 10 });
    expect(printed()).toContain('service says hello');

    const missing = await rejection(servicesLogs(project, 'nope'));
    expect(missing.code).toBe('SERVICES_NOT_FOUND');
  });
});

describe('parseDockerCompose / package.json detection', () => {
  it('parses depends_on in array form', async () => {
    const project = makeProject({
      'docker-compose.yml': 'services:\n  web:\n    image: a\n    depends_on:\n      - db\n      - cache\n  db:\n    image: b\n  cache:\n    image: c\n',
    });
    const services = await parseDockerCompose(project);
    expect(services.find(s => s.name === 'web')?.depends_on).toEqual(['db', 'cache']);
    expect(services.find(s => s.name === 'db')?.depends_on).toEqual([]);
  });

  it('parses depends_on in map form', async () => {
    const project = makeProject({
      'docker-compose.yml':
        'services:\n  web:\n    image: a\n    depends_on:\n      db:\n        condition: service_healthy\n      cache:\n        condition: service_started\n  db:\n    image: b\n  cache:\n    image: c\n',
    });
    const services = await parseDockerCompose(project);
    expect(services.find(s => s.name === 'web')?.depends_on).toEqual(['db', 'cache']);
  });

  it('never yields index keys ("0", "1") for array-form depends_on', async () => {
    const project = makeProject({
      'docker-compose.yml': 'services:\n  web:\n    image: a\n    depends_on: [db]\n  db:\n    image: b\n',
    });
    const web = (await parseDockerCompose(project)).find(s => s.name === 'web');
    expect(web?.depends_on).not.toContain('0');
    expect(web?.depends_on).toEqual(['db']);
  });

  it('normalizes environment lists, numeric ports and long-form ports', async () => {
    const project = makeProject({
      'docker-compose.yml': `services:
  web:
    image: a
    environment:
      - A=1
      - B=two=2
      - C
    ports:
      - 8080
      - "9090:90"
      - target: 80
        published: 8081
        protocol: tcp
    command: ["node", "server.js"]
`,
    });
    const web = (await parseDockerCompose(project))[0];
    expect(web.environment).toEqual({ A: '1', B: 'two=2', C: '' });
    expect(web.ports).toEqual(['8080', '9090:90', '8081:80/tcp']);
    expect(web.command).toBe('node server.js');
  });

  it('surfaces an invalid compose file as an error instead of silently using package.json', async () => {
    const project = makeProject({
      'docker-compose.yml': 'services:\n  web: [unclosed\n',
      'package.json': JSON.stringify({ scripts: { dev: 'vite' } }),
    });
    const error = await rejection(parseDockerCompose(project));
    expect(error.code).toBe('SERVICES_ERROR');
    expect(error.message).toContain('docker-compose.yml');
  });

  it('detects dev/start/serve services, parses ports, and skips lifecycle scripts', async () => {
    const project = makeProject({
      'package.json': JSON.stringify({
        scripts: {
          dev: 'vite --port=5173',
          'dev:api': 'PORT=4000 node api.js',
          start: 'next start -p 3001',
          serve: 'http-server',
          predev: 'echo',
          'build:dev': 'webpack',
          postinstall: 'x',
          test: 'vitest',
        },
        'um-re-shell-ignored': true,
      }),
    });
    const services = await parseDockerCompose(project);
    expect(services.map(s => [s.name, s.port])).toEqual([
      ['dev', 5173],
      ['dev-api', 4000],
      ['start', 3001],
      ['serve', undefined],
    ]);
  });
});

describePosix('servicesInspect', () => {
  it('reports process-mode status from the supervised record', async () => {
    noDockerPath();
    const project = makeProject({
      'package.json': JSON.stringify({ scripts: { dev: 'node -e "setInterval(()=>{},1000)"' } }),
    });
    const before = await servicesInspect(project, 'dev', { json: true });
    expect(before.status).toBe('stopped');

    const up = await servicesUp(project, FAST);
    const during = await servicesInspect(project, 'dev', { json: true });
    expect(during.status).toBe('running');
    expect(during.metadata.pid).toBe(up.services[0].pid);
    expect(readProcInfo(during.metadata.pid as number)).not.toBeNull();
  });

  it('throws SERVICES_NOT_FOUND for an unknown service', async () => {
    noDockerPath();
    const project = makeProject({ 'package.json': JSON.stringify({ scripts: { dev: 'x' } }) });
    const error = await rejection(servicesInspect(project, 'ghost', { json: true }));
    expect(error.code).toBe('SERVICES_NOT_FOUND');
  });

  it('parses host-ip prefixed port mappings correctly', async () => {
    const dir = noDockerPath();
    writeComposeShim(dir, {
      name: 'docker',
      logFile: path.join(dir, 'calls.log'),
      behaviours: { version: { stdout: 'Docker Compose version v2.99.0\n' }, ps: { stdout: '' } },
    });
    const project = makeProject({
      'docker-compose.yml': 'services:\n  web:\n    image: a\n    ports:\n      - "127.0.0.1:8080:80"\n',
    });
    const inspection = await servicesInspect(project, 'web', { json: true });
    expect(inspection.ports).toEqual([{ host: 8080, container: 80, protocol: 'tcp' }]);
    // `ps -q` returned nothing: the service is genuinely not running.
    expect(inspection.status).toBe('stopped');
  });
});
