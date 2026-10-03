import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { workspaceStatusReportSchema } from '@re-shell/contracts';
import { collectWorkspaceStatus, evaluateService, readServiceDescriptors } from '../../src/utils/workspace-status';
import { readProcInfo, writeServiceRecord, type ServiceProcessRecord } from '../../src/utils/service-process';

/**
 * Real probes only: actual HTTP servers, actual closed ports, an actual child
 * process recorded exactly like `service run` records it.
 */

let root: string;
const servers: http.Server[] = [];
const children: ChildProcess[] = [];

function listen(handler: http.RequestListener): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    servers.push(server);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: (server.address() as net.AddressInfo).port }));
  });
}

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    });
  });
}

function pkg(rel: string, body: Record<string, unknown>): void {
  const dir = path.join(root, rel);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(body));
}

function spawnSleeper(): ChildProcess {
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { detached: true, stdio: 'ignore' });
  children.push(child);
  return child;
}

function recordFor(name: string, cwd: string, child: ChildProcess, extra: Partial<ServiceProcessRecord> = {}): ServiceProcessRecord {
  const info = readProcInfo(child.pid!);
  return {
    version: 1,
    name,
    pid: child.pid!,
    pgid: child.pid!,
    startTime: info?.startTime ?? null,
    command: 'node -e sleeper',
    argv: [process.execPath],
    shell: false,
    cwd,
    startedAt: new Date().toISOString(),
    logFile: path.join(root, '.re-shell/logs/x.log'),
    readiness: 'alive',
    ...extra,
  };
}

async function waitDead(pid: number): Promise<void> {
  for (let i = 0; i < 100; i++) {
    const info = readProcInfo(pid);
    if (!info || info.state === 'Z' || info.state === 'X') return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`pid ${pid} did not die`);
}

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-status-'));
});

afterAll(async () => {
  for (const c of children) {
    try {
      process.kill(-c.pid!, 'SIGKILL');
    } catch {
      /* already gone */
    }
  }
  await Promise.all(servers.map((s) => new Promise((r) => s.close(() => r(null)))));
  fs.rmSync(root, { recursive: true, force: true });
});

describe('collectWorkspaceStatus', () => {
  it('classifies running / unhealthy / stopped / unknown from real probes, with reasons', async () => {
    const healthy = await listen((req, res) => {
      res.statusCode = req.url === '/health' ? 200 : 404;
      res.end('ok');
    });
    const sick = await listen((_req, res) => {
      res.statusCode = 500;
      res.end('boom');
    });
    const closedPort = await freePort();

    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'root', workspaces: ['apps/*', 'packages/*'] }));
    pkg('apps/ok', {
      name: 'ok',
      scripts: { dev: 'vite' },
      're-shell': { services: { dev: { port: healthy.port, healthUrl: `http://127.0.0.1:${healthy.port}/health` } } },
    });
    pkg('apps/sick', {
      name: 'sick',
      scripts: { dev: 'vite' },
      're-shell': { services: { dev: { port: sick.port, healthUrl: `http://127.0.0.1:${sick.port}/health` } } },
    });
    pkg('apps/down', { name: 'down', scripts: { start: `node server.js --port ${closedPort}` } });
    pkg('packages/lib', { name: 'lib', scripts: { build: 'tsc' } });
    pkg('packages/noprobe', { name: 'noprobe', scripts: { dev: 'node watch.js' } });

    const report = await collectWorkspaceStatus(root);
    expect(workspaceStatusReportSchema.safeParse(report).success).toBe(true);
    const by = Object.fromEntries(report.nodes.map((n) => [n.name, n]));

    expect(by.ok.status).toBe('running');
    expect(by.ok.reason).toContain('health URL');
    expect(by.ok.checks[0]).toMatchObject({ name: 'dev', source: 'health-url', port: healthy.port });

    expect(by.sick.status).toBe('unhealthy');
    expect(by.sick.reason).toMatch(/port \d+ is open but health URL .* did not answer/);

    expect(by.down.status).toBe('stopped');
    expect(by.down.reason).toContain(`port ${closedPort}`);
    expect(by.down.checks[0].source).toBe('port');

    expect(by.lib.status).toBe('unknown');
    expect(by.lib.reason).toMatch(/no dev\/start\/serve script/);
    expect(by.noprobe.status).toBe('unknown');
    expect(by.noprobe.reason).toMatch(/no port or health URL configured/);

    expect(report.summary).toEqual({ running: 1, stopped: 1, unhealthy: 1, unknown: 2 });
    expect(new Date(report.checkedAt).toString()).not.toBe('Invalid Date');
  });

  it('reads supervised service records: alive = running, killed = stopped, recycled pid = stopped', async () => {
    const wsDir = path.join(root, 'apps/svc');
    pkg('apps/svc', { name: 'svc', scripts: { dev: 'node app.js' } });

    const child = spawnSleeper();
    await new Promise((r) => setTimeout(r, 150));
    await writeServiceRecord(root, recordFor('apps/svc-dev', wsDir, child));

    const alive = (await collectWorkspaceStatus(root)).nodes.find((n) => n.name === 'svc')!;
    expect(alive.status).toBe('running');
    expect(alive.reason).toContain(`process ${child.pid} is alive`);
    expect(alive.checks[0]).toMatchObject({ source: 'process', pid: child.pid });

    process.kill(-child.pid!, 'SIGKILL');
    await waitDead(child.pid!);
    const dead = (await collectWorkspaceStatus(root)).nodes.find((n) => n.name === 'svc')!;
    expect(dead.status).toBe('stopped');
    expect(dead.reason).toMatch(/no longer running/);

    // A record whose start time does not match the live pid must never read as running.
    const other = spawnSleeper();
    await new Promise((r) => setTimeout(r, 150));
    await writeServiceRecord(root, recordFor('apps/svc-dev', wsDir, other, { startTime: 'proc:fake:1' }));
    const recycled = (await collectWorkspaceStatus(root)).nodes.find((n) => n.name === 'svc')!;
    expect(recycled.status).toBe('stopped');
    expect(recycled.reason).toContain('different process');
    process.kill(-other.pid!, 'SIGKILL');
  });

  it('reports a live process whose recorded port is closed as unhealthy', async () => {
    const wsDir = path.join(root, 'apps/halfup');
    pkg('apps/halfup', { name: 'halfup', scripts: { dev: 'node app.js' } });
    const child = spawnSleeper();
    await new Promise((r) => setTimeout(r, 150));
    const closedPort = await freePort();
    await writeServiceRecord(root, recordFor('apps/halfup-dev', wsDir, child, { port: closedPort, readiness: 'port' }));
    const node = (await collectWorkspaceStatus(root)).nodes.find((n) => n.name === 'halfup')!;
    expect(node.status).toBe('unhealthy');
    expect(node.reason).toContain(`nothing accepts connections on port ${closedPort}`);
    process.kill(-child.pid!, 'SIGKILL');
  });

  it('reads records written from inside the workspace directory', async () => {
    const wsDir = path.join(root, 'packages/inner');
    pkg('packages/inner', { name: 'inner', scripts: { dev: 'x' } });
    const child = spawnSleeper();
    await new Promise((r) => setTimeout(r, 150));
    await writeServiceRecord(wsDir, recordFor('dev', wsDir, child));
    const node = (await collectWorkspaceStatus(root)).nodes.find((n) => n.name === 'inner')!;
    expect(node.status).toBe('running');
    process.kill(-child.pid!, 'SIGKILL');
  });

  it('does not probe non-loopback health URLs unless asked (SSRF guard)', async () => {
    const check = await evaluateService(
      { name: 'dev', healthUrl: 'http://203.0.113.9/health' },
      undefined,
      {
        port: async () => {
          throw new Error('must not probe a port here');
        },
        url: async () => {
          throw new Error('must not fetch a remote URL');
        },
        allowRemote: false,
      }
    );
    expect(check.status).toBe('unknown');
    expect(check.reason).toContain('--allow-remote-probes');
  });

  it('reads declared ports from re-shell.services and from script flags', async () => {
    pkg('packages/declared', {
      name: 'declared',
      scripts: { dev: 'vite --port 5173', 'dev:api': 'PORT=3001 node api.js', build: 'tsc', predev: 'echo' },
      're-shell': { services: { 'dev:api': { healthUrl: 'http://localhost:3001/h' } } },
    });
    const descriptors = await readServiceDescriptors(path.join(root, 'packages/declared'));
    expect(descriptors).toEqual([
      { name: 'dev', port: 5173, healthUrl: undefined },
      { name: 'dev-api', port: 3001, healthUrl: 'http://localhost:3001/h' },
    ]);
  });
});
