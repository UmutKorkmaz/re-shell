import { spawn } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CommandFailedError,
  ServiceRuntimeError,
  checkRecordIdentity,
  composeContainerOk,
  detectCompose,
  parseComposePs,
  parseProcStat,
  pidFilePath,
  planSpawn,
  readProcInfo,
  readServiceRecords,
  runCommand,
  safeStem,
  startServiceProcess,
  stopServiceProcess,
  writeServiceRecord,
  type ServiceProcessRecord,
} from '../../src/utils/service-process';
import {
  IS_WINDOWS,
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

// Real, un-mocked tests of the process-supervision primitives: short-lived node
// processes, PATH shim scripts standing in for docker / docker-compose, and
// process-group assertions against the live kernel.

const describePosix = describe.skipIf(IS_WINDOWS);

const NODE = process.execPath;
let originalPath: string | undefined;
const bystanders: Array<{ kill: () => void }> = [];

beforeEach(() => {
  originalPath = process.env.PATH;
});

afterEach(() => {
  process.env.PATH = originalPath;
  for (const b of bystanders.splice(0)) b.kill();
  cleanupTempDirs();
});

/** Spawn `node -e script` args as a service command line (shell syntax avoided). */
function nodeCommand(file: string, ...args: string[]): string {
  return [NODE, file, ...args].join(' ');
}

function writeScript(dir: string, name: string, body: string): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, body);
  return file;
}

describe('runCommand', () => {
  it('resolves with captured stdout on exit 0', async () => {
    const result = await runCommand(NODE, ['-e', 'console.log("hi")']);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('hi');
  });

  it('rejects on a non-zero exit and carries the exit code and stderr', async () => {
    const error = await runCommand(NODE, ['-e', 'console.error("bad thing"); process.exit(7)']).catch(
      e => e
    );
    expect(error).toBeInstanceOf(CommandFailedError);
    expect(error.reason).toBe('exit');
    expect(error.exitCode).toBe(7);
    expect(error.message).toContain('exited with code 7');
    expect(error.message).toContain('bad thing');
  });

  it('rejects with reason "spawn" when the binary does not exist', async () => {
    const error = await runCommand('definitely-not-a-real-binary-xyz', []).catch(e => e);
    expect(error).toBeInstanceOf(CommandFailedError);
    expect(error.reason).toBe('spawn');
    expect(error.message).toContain('not found');
  });

  it('times out, kills the child and rejects', async () => {
    const started = Date.now();
    const error = await runCommand(NODE, ['-e', 'setTimeout(() => {}, 60000)'], {
      timeoutMs: 300,
    }).catch(e => e);
    expect(error).toBeInstanceOf(CommandFailedError);
    expect(error.reason).toBe('timeout');
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('passes arguments literally (no shell interpretation)', async () => {
    const result = await runCommand(NODE, ['-e', 'console.log(process.argv[1])', 'a;b && c']);
    expect(result.stdout.trim()).toBe('a;b && c');
  });
});

describePosix('detectCompose', () => {
  it('prefers the `docker compose` plugin over a standalone docker-compose', async () => {
    const dir = makeShimDir();
    const log = path.join(dir, 'calls.log');
    writeComposeShim(dir, {
      name: 'docker',
      logFile: log,
      behaviours: { version: { stdout: 'Docker Compose version v2.99.0\n' } },
    });
    writeComposeShim(dir, {
      name: 'docker-compose',
      logFile: log,
      behaviours: { version: { stdout: 'docker-compose version 1.29.2\n' } },
    });
    process.env.PATH = dir;

    const compose = await detectCompose();
    expect(compose).toMatchObject({
      command: 'docker',
      baseArgs: ['compose'],
      flavor: 'plugin',
      label: 'docker compose',
    });
    expect(compose?.version).toContain('v2.99.0');
    // The standalone binary was never even probed.
    expect(readShimLog(log).some(line => line.startsWith('docker-compose'))).toBe(false);
  });

  it('falls back to standalone docker-compose when the plugin is missing', async () => {
    const dir = makeShimDir();
    const log = path.join(dir, 'calls.log');
    writeComposeShim(dir, {
      name: 'docker',
      logFile: log,
      behaviours: { version: { exit: 1, stderr: "docker: 'compose' is not a docker command." } },
    });
    writeComposeShim(dir, {
      name: 'docker-compose',
      logFile: log,
      behaviours: { version: { stdout: 'docker-compose version 1.29.2\n' } },
    });
    process.env.PATH = dir;

    const compose = await detectCompose();
    expect(compose).toMatchObject({
      command: 'docker-compose',
      baseArgs: [],
      flavor: 'standalone',
      label: 'docker-compose',
    });
  });

  it('returns null when neither binary exists on PATH', async () => {
    process.env.PATH = makeShimDir();
    expect(await detectCompose()).toBeNull();
  });

  it('does not accept a docker-compose that exists but fails its version probe', async () => {
    const dir = makeShimDir();
    writeComposeShim(dir, {
      name: 'docker-compose',
      logFile: path.join(dir, 'calls.log'),
      behaviours: { version: { exit: 127, stderr: 'broken install' } },
    });
    process.env.PATH = dir;
    expect(await detectCompose()).toBeNull();
  });
});

describe('compose ps parsing', () => {
  it('parses the newline-delimited form', () => {
    const out = [
      '{"Service":"web","State":"running","Health":"healthy","Ports":"0.0.0.0:8080->80/tcp"}',
      '{"Service":"job","State":"exited","ExitCode":0}',
    ].join('\n');
    const rows = parseComposePs(out);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ service: 'web', state: 'running', health: 'healthy' });
    expect(rows[1]).toMatchObject({ service: 'job', state: 'exited', exitCode: 0 });
  });

  it('parses the single-array form', () => {
    const rows = parseComposePs('[{"Service":"db","State":"running"}]');
    expect(rows).toEqual([
      expect.objectContaining({ service: 'db', state: 'running', health: undefined }),
    ]);
  });

  it('returns [] for empty output and throws on garbage', () => {
    expect(parseComposePs('  \n')).toEqual([]);
    expect(() => parseComposePs('not json at all')).toThrow();
  });

  it('classifies container health', () => {
    const base = { service: 's' };
    expect(composeContainerOk({ ...base, state: 'running' })).toBe(true);
    expect(composeContainerOk({ ...base, state: 'running', health: 'healthy' })).toBe(true);
    expect(composeContainerOk({ ...base, state: 'running', health: 'unhealthy' })).toBe(false);
    expect(composeContainerOk({ ...base, state: 'running', health: 'starting' })).toBe(false);
    expect(composeContainerOk({ ...base, state: 'exited', exitCode: 0 })).toBe(true);
    expect(composeContainerOk({ ...base, state: 'exited', exitCode: 2 })).toBe(false);
    expect(composeContainerOk({ ...base, state: 'restarting' })).toBe(false);
    expect(composeContainerOk({ ...base, state: 'dead' })).toBe(false);
  });
});

describe('spawn planning and naming', () => {
  it('spawns plain command lines directly, without a shell', () => {
    expect(planSpawn('vite --port 3000')).toEqual({
      file: 'vite',
      args: ['--port', '3000'],
      shell: false,
    });
    expect(planSpawn('  node   server.js --port=4000 ')).toEqual({
      file: 'node',
      args: ['server.js', '--port=4000'],
      shell: false,
    });
  });

  it('uses /bin/sh only when shell syntax is required', () => {
    expect(planSpawn('tsc && node dist/index.js')).toEqual({
      file: '/bin/sh',
      args: ['-c', 'tsc && node dist/index.js'],
      shell: true,
    });
    expect(planSpawn('PORT=3000 node server.js').shell).toBe(true);
    expect(planSpawn('node -e "console.log(1)"').shell).toBe(true);
    expect(planSpawn('echo hi | cat').shell).toBe(true);
  });

  it('derives collision-free, filesystem-safe stems', () => {
    expect(safeStem('dev')).toBe('dev');
    expect(safeStem('web-dev:2')).not.toContain(':');
    const a = safeStem('packages/web-dev');
    const b = safeStem('packages_web-dev');
    expect(a).not.toContain('/');
    expect(a).not.toBe(b);
    expect(safeStem('..')).not.toBe('..');
  });

  it('parses /proc/<pid>/stat even when the command name contains spaces and parens', () => {
    const stat =
      '4242 (my (weird) cmd) S 1 4242 4242 0 -1 4194560 100 0 0 0 1 2 0 0 20 0 1 0 987654 1000 100 ' +
      '18446744073709551615 1 1 0 0 0 0 0 0 0 0 0 0 17 0 0 0 0 0 0';
    const info = parseProcStat(stat);
    expect(info).toMatchObject({ pid: 4242, state: 'S', ppid: 1, pgid: 4242 });
    expect(info?.startTime).toMatch(/987654$/);
  });
});

describePosix('PID records on disk', () => {
  it('reads JSON records, flags legacy plain-number files and unreadable files', async () => {
    const project = makeTempDir('rs-records');
    const pids = path.join(project, '.re-shell', 'pids');
    fs.mkdirSync(pids, { recursive: true });

    const record: ServiceProcessRecord = {
      version: 1,
      name: 'api',
      pid: 4321,
      pgid: 4321,
      startTime: 'proc:x:1',
      command: 'node api.js',
      argv: ['node', 'api.js'],
      shell: false,
      cwd: project,
      startedAt: new Date().toISOString(),
      logFile: path.join(project, '.re-shell', 'logs', 'api.log'),
      readiness: 'alive',
    };
    await writeServiceRecord(project, record);
    fs.writeFileSync(path.join(pids, 'old.pid'), '9999');
    fs.writeFileSync(path.join(pids, 'junk.pid'), '{not json');

    const scanned = await readServiceRecords(project);
    expect(scanned.records.map(r => r.name)).toEqual(['api']);
    expect(scanned.legacy).toEqual([expect.objectContaining({ name: 'old', pid: 9999 })]);
    expect(scanned.invalid).toHaveLength(1);
    // Written atomically with owner-only permissions.
    expect(fs.statSync(pidFilePath(project, 'api')).mode & 0o777).toBe(0o600);
    expect(fs.readdirSync(pids).some(f => f.endsWith('.tmp'))).toBe(false);
  });
});

describePosix('startServiceProcess', () => {
  const fastOptions = (project: string) => ({ projectPath: project, readyTimeoutMs: 20000, aliveMs: 300 });

  it('fails when the command does not exist (spawn error) and leaves no PID file', async () => {
    const project = makeTempDir('rs-start');
    const error = await startServiceProcess(
      { name: 'ghost', command: 'definitely-not-a-real-binary-xyz --flag', cwd: project },
      fastOptions(project)
    ).catch(e => e);

    expect(error).toBeInstanceOf(ServiceRuntimeError);
    expect(error.code).toBe('SERVICES_START_FAILED');
    expect(error.message).toContain('command not found');
    expect((await readServiceRecords(project)).records).toEqual([]);
  });

  it('fails with the exit code and log tail when the service exits immediately', async () => {
    const project = makeTempDir('rs-start');
    const script = writeScript(
      project,
      'crash.js',
      'console.error("fatal: cannot bind"); process.exit(3);'
    );
    const error = await startServiceProcess(
      { name: 'crash', command: nodeCommand(script), cwd: project },
      fastOptions(project)
    ).catch(e => e);

    expect(error).toBeInstanceOf(ServiceRuntimeError);
    expect(error.code).toBe('SERVICES_START_FAILED');
    expect(error.message).toContain('exited with code 3');
    expect(error.message).toContain('fatal: cannot bind');
    expect(error.details.exitCode).toBe(3);
    expect((await readServiceRecords(project)).records).toEqual([]);
    // The log is kept for diagnosis.
    expect(fs.readFileSync(error.details.logFile, 'utf8')).toContain('fatal: cannot bind');
  });

  it('treats a clean exit 0 before readiness as a failure too', async () => {
    const project = makeTempDir('rs-start');
    const script = writeScript(project, 'quick.js', 'console.log("done");');
    const error = await startServiceProcess(
      { name: 'quick', command: nodeCommand(script), cwd: project },
      fastOptions(project)
    ).catch(e => e);
    expect(error.code).toBe('SERVICES_START_FAILED');
    expect(error.message).toContain('exited with code 0');
  });

  it('reports a shell command that is not found as exit 127 with the shell message', async () => {
    const project = makeTempDir('rs-start');
    const error = await startServiceProcess(
      { name: 'sh-missing', command: 'definitely-not-a-real-binary-xyz && echo hi', cwd: project },
      fastOptions(project)
    ).catch(e => e);
    expect(error.code).toBe('SERVICES_START_FAILED');
    expect(error.message).toContain('exited with code 127');
    expect(error.message).toContain('not found');
  });

  it('rejects a missing working directory before spawning anything', async () => {
    const project = makeTempDir('rs-start');
    const error = await startServiceProcess(
      { name: 'nodir', command: 'node -v', cwd: path.join(project, 'nope') },
      fastOptions(project)
    ).catch(e => e);
    expect(error.code).toBe('SERVICES_START_FAILED');
    expect(error.message).toContain('does not exist');
  });

  it('succeeds when the service stays alive, records its identity, and logs to a file', async () => {
    const project = makeTempDir('rs-start');
    const script = writeScript(
      project,
      'live.js',
      'console.log("hello from service"); setInterval(() => {}, 1000);'
    );
    const record = await startServiceProcess(
      { name: 'live', command: nodeCommand(script), cwd: project },
      fastOptions(project)
    );
    try {
      expect(record.readiness).toBe('alive');
      expect(record.pid).toBeGreaterThan(1);
      // Spawned as its own process group, and no shell was needed.
      expect(record.pgid).toBe(record.pid);
      expect(record.shell).toBe(false);
      expect(record.startTime).toMatch(/^(proc|ps):/);
      expect(isPidAlive(record.pid)).toBe(true);

      const onDisk = JSON.parse(fs.readFileSync(pidFilePath(project, 'live'), 'utf8'));
      expect(onDisk).toMatchObject({ name: 'live', pid: record.pid, pgid: record.pid });

      expect(
        await waitFor(() => fs.readFileSync(record.logFile, 'utf8').includes('hello from service'))
      ).toBe(true);
      expect(readProcInfo(record.pid)?.pgid).toBe(record.pid);
    } finally {
      await stopServiceProcess(record, { timeoutMs: 3000 });
    }
    expect(isPidAlive(record.pid)).toBe(false);
  });

  it('does not leak file descriptors across start/stop cycles', async () => {
    if (!fs.existsSync('/proc/self/fd')) return;
    const project = makeTempDir('rs-fd');
    const script = writeScript(project, 'fd.js', 'setInterval(() => {}, 1000);');
    const countFds = (): number => fs.readdirSync('/proc/self/fd').length;

    // Warm up lazily-opened handles before measuring.
    const warm = await startServiceProcess(
      { name: 'fd', command: nodeCommand(script), cwd: project },
      fastOptions(project)
    );
    await stopServiceProcess(warm, { timeoutMs: 3000 });

    const before = countFds();
    for (let i = 0; i < 5; i++) {
      const record = await startServiceProcess(
        { name: 'fd', command: nodeCommand(script), cwd: project },
        fastOptions(project)
      );
      await stopServiceProcess(record, { timeoutMs: 3000 });
      fs.rmSync(pidFilePath(project, 'fd'), { force: true });
    }
    // A leaked log descriptor would add one per cycle (5).
    expect(countFds() - before).toBeLessThan(3);
  });

  it('waits for the configured port and reports readiness via the port', async () => {
    const project = makeTempDir('rs-port');
    const port = await getFreePort();
    const script = writeScript(
      project,
      'late.js',
      `setTimeout(() => { require('net').createServer(() => {}).listen(${port}, '127.0.0.1'); }, 500);`
    );
    const started = Date.now();
    const record = await startServiceProcess(
      { name: 'late', command: nodeCommand(script), cwd: project, port },
      fastOptions(project)
    );
    try {
      expect(record.readiness).toBe('port');
      // It must have waited for the listener, not just returned after the alive grace.
      expect(Date.now() - started).toBeGreaterThanOrEqual(450);
      expect(await portIsClosed(port)).toBe(false);
    } finally {
      await stopServiceProcess(record, { timeoutMs: 3000 });
    }
    // The whole process group has exited, so the listener is gone. Poll briefly rather
    // than probing once: under a full parallel run a single loopback probe can see the
    // freed port reused by another worker for a moment. A leaked listener still fails.
    expect(await waitFor(() => portIsClosed(port), 2000)).toBe(true);
  });

  it('fails, tears the process group down and removes the PID file on a readiness timeout', async () => {
    const project = makeTempDir('rs-port');
    const port = await getFreePort();
    const script = writeScript(project, 'never.js', 'setInterval(() => {}, 1000);');
    const error = await startServiceProcess(
      { name: 'never', command: nodeCommand(script), cwd: project, port },
      { projectPath: project, readyTimeoutMs: 700, aliveMs: 100 }
    ).catch(e => e);

    expect(error.code).toBe('SERVICES_START_FAILED');
    expect(error.message).toContain(`port ${port} did not accept connections`);
    expect((await readServiceRecords(project)).records).toEqual([]);
  });

  it('refuses to start when the configured port is already in use', async () => {
    const project = makeTempDir('rs-port');
    const blocker = net.createServer();
    await new Promise<void>(resolve => blocker.listen(0, '127.0.0.1', resolve));
    const port = (blocker.address() as net.AddressInfo).port;
    try {
      const script = writeScript(project, 'x.js', 'setInterval(() => {}, 1000);');
      const error = await startServiceProcess(
        { name: 'busy', command: nodeCommand(script), cwd: project, port },
        fastOptions(project)
      ).catch(e => e);
      expect(error.code).toBe('SERVICES_START_FAILED');
      expect(error.message).toContain(`Port ${port} is already in use`);
      expect((await readServiceRecords(project)).records).toEqual([]);
    } finally {
      await new Promise<void>(resolve => blocker.close(() => resolve()));
    }
  });

  it('waits for a health URL to answer 2xx', async () => {
    const project = makeTempDir('rs-url');
    const port = await getFreePort();
    const script = writeScript(
      project,
      'health.js',
      `const born = Date.now();
require('http').createServer((req, res) => {
  res.statusCode = Date.now() - born < 600 ? 503 : 200;
  res.end('x');
}).listen(${port}, '127.0.0.1');`
    );
    const started = Date.now();
    const record = await startServiceProcess(
      {
        name: 'health',
        command: nodeCommand(script),
        cwd: project,
        healthUrl: `http://127.0.0.1:${port}/health`,
      },
      fastOptions(project)
    );
    try {
      expect(record.readiness).toBe('url');
      expect(Date.now() - started).toBeGreaterThanOrEqual(500);
    } finally {
      await stopServiceProcess(record, { timeoutMs: 3000 });
    }
  });

  it('refuses to double-start a running service and clears a stale PID file', async () => {
    const project = makeTempDir('rs-double');
    const script = writeScript(project, 'x.js', 'setInterval(() => {}, 1000);');
    const first = await startServiceProcess(
      { name: 'dup', command: nodeCommand(script), cwd: project },
      fastOptions(project)
    );
    try {
      const error = await startServiceProcess(
        { name: 'dup', command: nodeCommand(script), cwd: project },
        fastOptions(project)
      ).catch(e => e);
      expect(error.code).toBe('SERVICES_START_FAILED');
      expect(error.message).toContain('already running');
      // The first one is untouched.
      expect(isPidAlive(first.pid)).toBe(true);
    } finally {
      await stopServiceProcess(first, { timeoutMs: 3000 });
    }

    // Now the PID file is stale (process gone): a new start replaces it.
    const second = await startServiceProcess(
      { name: 'dup', command: nodeCommand(script), cwd: project },
      fastOptions(project)
    );
    try {
      expect(second.pid).not.toBe(first.pid);
      const records = (await readServiceRecords(project)).records;
      expect(records).toHaveLength(1);
      expect(records[0].pid).toBe(second.pid);
    } finally {
      await stopServiceProcess(second, { timeoutMs: 3000 });
    }
  });

  it('puts node_modules/.bin on PATH like npm run does', async () => {
    const project = makeTempDir('rs-bin');
    const bin = path.join(project, 'node_modules', '.bin');
    fs.mkdirSync(bin, { recursive: true });
    const tool = path.join(bin, 'my-local-tool');
    fs.writeFileSync(tool, `#!/bin/sh\necho local-tool-ran\nexec ${NODE} -e "setInterval(()=>{},1000)"\n`, {
      mode: 0o755,
    });
    const record = await startServiceProcess(
      { name: 'tool', command: 'my-local-tool --flag', cwd: project },
      fastOptions(project)
    );
    try {
      expect(
        await waitFor(() => fs.readFileSync(record.logFile, 'utf8').includes('local-tool-ran'))
      ).toBe(true);
    } finally {
      await stopServiceProcess(record, { timeoutMs: 3000 });
    }
  });
});

describePosix('stopServiceProcess', () => {
  /** A service that spawns a grandchild in the same process group and reports its pid. */
  function grandchildScript(dir: string, ignoreTerm: boolean): string {
    const pidFile = path.join(dir, 'grandchild.pid');
    return writeScript(
      dir,
      ignoreTerm ? 'stubborn.js' : 'tree.js',
      `const { spawn } = require('child_process');
const fs = require('fs');
${ignoreTerm ? "process.on('SIGTERM', () => {});" : ''}
const gc = spawn(process.execPath, ['-e', ${JSON.stringify(
        `${ignoreTerm ? "process.on('SIGTERM', () => {});" : ''} setInterval(() => {}, 1000);`
      )}], { stdio: 'ignore' });
fs.writeFileSync(${JSON.stringify(pidFile)}, String(gc.pid));
setInterval(() => {}, 1000);`
    );
  }

  it('terminates the whole process group, grandchildren included', async () => {
    const project = makeTempDir('rs-stop');
    const script = grandchildScript(project, false);
    const record = await startServiceProcess(
      { name: 'tree', command: nodeCommand(script), cwd: project },
      { projectPath: project, readyTimeoutMs: 20000, aliveMs: 500 }
    );
    const grandchildPid = Number(fs.readFileSync(path.join(project, 'grandchild.pid'), 'utf8'));
    expect(isPidAlive(record.pid)).toBe(true);
    expect(isPidAlive(grandchildPid)).toBe(true);
    // The grandchild really is in the service's process group.
    expect(readProcInfo(grandchildPid)?.pgid).toBe(record.pgid);

    const result = await stopServiceProcess(record, { timeoutMs: 3000 });

    expect(result.outcome).toBe('terminated');
    expect(isPidAlive(record.pid)).toBe(false);
    expect(isPidAlive(grandchildPid)).toBe(false);
  });

  it('escalates to SIGKILL when the group ignores SIGTERM', async () => {
    const project = makeTempDir('rs-stop');
    const script = grandchildScript(project, true);
    const record = await startServiceProcess(
      { name: 'stubborn', command: nodeCommand(script), cwd: project },
      { projectPath: project, readyTimeoutMs: 20000, aliveMs: 500 }
    );
    const grandchildPid = Number(fs.readFileSync(path.join(project, 'grandchild.pid'), 'utf8'));

    const started = Date.now();
    const result = await stopServiceProcess(record, { timeoutMs: 500 });

    expect(result.outcome).toBe('killed');
    // It waited out the timeout before killing.
    expect(Date.now() - started).toBeGreaterThanOrEqual(450);
    expect(isPidAlive(record.pid)).toBe(false);
    expect(isPidAlive(grandchildPid)).toBe(false);
  });

  it('reports not-running for a service that has already exited', async () => {
    const project = makeTempDir('rs-stop');
    const child = spawn(NODE, ['-e', 'process.exit(0)'], { detached: true, stdio: 'ignore' });
    const startTime = await (async () => {
      // Capture identity while the process may still exist; fall back to a fake token.
      return readProcInfo(child.pid as number)?.startTime ?? 'proc:fake:1';
    })();
    await new Promise<void>(resolve => child.once('exit', () => resolve()));
    const record: ServiceProcessRecord = {
      version: 1,
      name: 'gone',
      pid: child.pid as number,
      pgid: child.pid as number,
      startTime,
      command: 'node -e process.exit(0)',
      argv: [],
      shell: false,
      cwd: project,
      startedAt: new Date().toISOString(),
      logFile: path.join(project, 'x.log'),
      readiness: 'alive',
    };
    expect((await stopServiceProcess(record, { timeoutMs: 500 })).outcome).toBe('not-running');
  });

  it('never signals a process that has taken over a recorded PID (start time differs)', async () => {
    const project = makeTempDir('rs-reuse');
    const bystander = spawnBystander();
    bystanders.push(bystander);
    expect(isPidAlive(bystander.pid)).toBe(true);

    const record: ServiceProcessRecord = {
      version: 1,
      name: 'reused',
      pid: bystander.pid,
      pgid: bystander.pid,
      // Identity recorded for a DIFFERENT, long-dead process that had this PID.
      startTime: 'proc:00000000:1',
      command: 'old service',
      argv: [],
      shell: false,
      cwd: project,
      startedAt: new Date().toISOString(),
      logFile: path.join(project, 'x.log'),
      readiness: 'alive',
    };

    expect(checkRecordIdentity(record).state).toBe('reused');
    const result = await stopServiceProcess(record, { timeoutMs: 500 });
    expect(result.outcome).toBe('identity-mismatch');
    // The unrelated process (and its group) survived.
    expect(isPidAlive(bystander.pid)).toBe(true);
  });

  it('does not signal a live process when no start time was recorded', async () => {
    const project = makeTempDir('rs-unverifiable');
    const bystander = spawnBystander();
    bystanders.push(bystander);
    const record: ServiceProcessRecord = {
      version: 1,
      name: 'noident',
      pid: bystander.pid,
      pgid: bystander.pid,
      startTime: null,
      command: 'x',
      argv: [],
      shell: false,
      cwd: project,
      startedAt: new Date().toISOString(),
      logFile: path.join(project, 'x.log'),
      readiness: 'alive',
    };
    expect((await stopServiceProcess(record, { timeoutMs: 500 })).outcome).toBe('unverifiable');
    expect(isPidAlive(bystander.pid)).toBe(true);
  });

  it('refuses record ids that must never be signalled (pid 1, own pid, bad pgid)', async () => {
    const project = makeTempDir('rs-invalid');
    const base: ServiceProcessRecord = {
      version: 1,
      name: 'bad',
      pid: 1,
      pgid: 1,
      startTime: 'proc:x:1',
      command: 'x',
      argv: [],
      shell: false,
      cwd: project,
      startedAt: new Date().toISOString(),
      logFile: path.join(project, 'x.log'),
      readiness: 'alive',
    };
    for (const bad of [
      { ...base, pid: 1, pgid: 1 },
      { ...base, pid: process.pid, pgid: process.pid },
      { ...base, pid: 12345, pgid: 0 },
      { ...base, pid: -5, pgid: -5 },
      { ...base, pid: Number.NaN, pgid: Number.NaN },
    ]) {
      expect((await stopServiceProcess(bad, { timeoutMs: 100 })).outcome).toBe('identity-mismatch');
    }
  });

  it('stops surviving group members after the leader itself has died', async () => {
    const project = makeTempDir('rs-orphan');
    const pidFile = path.join(project, 'orphan.pid');
    // Leader spawns a same-group grandchild, records its pid, then exits at once.
    const leader = spawn(
      NODE,
      [
        '-e',
        `const gc = require('child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(gc.pid));
setTimeout(() => process.exit(0), 200);`,
      ],
      { detached: true, stdio: 'ignore' }
    );
    const leaderPid = leader.pid as number;
    const startTime = readProcInfo(leaderPid)?.startTime ?? null;
    await new Promise<void>(resolve => leader.once('exit', () => resolve()));
    const grandchildPid = Number(fs.readFileSync(pidFile, 'utf8'));
    expect(isPidAlive(grandchildPid)).toBe(true);

    const record: ServiceProcessRecord = {
      version: 1,
      name: 'orphaned',
      pid: leaderPid,
      pgid: leaderPid,
      startTime,
      command: 'x',
      argv: [],
      shell: false,
      cwd: project,
      startedAt: new Date().toISOString(),
      logFile: path.join(project, 'x.log'),
      readiness: 'alive',
    };
    expect(checkRecordIdentity(record).state).toBe('group-orphans');

    const result = await stopServiceProcess(record, { timeoutMs: 2000 });
    expect(result.outcome).toBe('terminated');
    expect(isPidAlive(grandchildPid)).toBe(false);
  });
});

/** Listen on a fresh loopback port and return it with a closer. */
async function listenOnFreePort(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = net.createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as net.AddressInfo).port;
  return {
    port,
    close: () => (server.listening ? new Promise<void>(resolve => server.close(() => resolve())) : Promise.resolve()),
  };
}

// A released ephemeral port can be handed straight to a parallel test (or a probe can
// self-connect to it), so "closed" checks retry on a fresh port. A probe that wrongly
// reported every closed port as open would still fail all attempts.
const CLOSED_PORT_ATTEMPTS = 5;

describe('probes', () => {
  it('probePort / probeUrl see a live listener and a closed port', async () => {
    const { probePort, probeUrl } = await import('../../src/utils/service-process');
    const server = http.createServer((req, res) => {
      res.statusCode = req.url === '/bad' ? 500 : 200;
      res.end('x');
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as net.AddressInfo).port;
    try {
      expect(await probePort(port)).toBe(true);
      expect(await probeUrl(`http://127.0.0.1:${port}/ok`)).toBe(true);
      expect(await probeUrl(`http://127.0.0.1:${port}/bad`)).toBe(false);
      expect(await probeUrl('not a url')).toBe(false);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }

    let sawClosed = false;
    for (let attempt = 0; attempt < CLOSED_PORT_ATTEMPTS && !sawClosed; attempt += 1) {
      const fresh = await listenOnFreePort();
      await fresh.close();
      sawClosed = !(await probePort(fresh.port));
    }
    expect(sawClosed).toBe(true);
  });

  it('waitForPortRelease waits for a closing listener and times out on a held one', async () => {
    const { waitForPortRelease } = await import('../../src/utils/service-process');
    const held = await listenOnFreePort();
    try {
      expect(await waitForPortRelease(held.port, 150, 20)).toBe(false);
    } finally {
      await held.close();
    }

    let released = false;
    for (let attempt = 0; attempt < CLOSED_PORT_ATTEMPTS && !released; attempt += 1) {
      const closing = await listenOnFreePort();
      setTimeout(() => void closing.close(), 100);
      released = await waitForPortRelease(closing.port, 2000, 20);
      await closing.close();
    }
    expect(released).toBe(true);
  });
});
