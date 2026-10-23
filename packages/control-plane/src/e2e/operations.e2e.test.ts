import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:http';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { migrate } from '../db/migrations.js';
import { SqliteJobStore } from '../db/sqlite-jobs.js';
import { SqliteTokenRevocations } from '../db/sqlite-revocations.js';
import { SqliteTenantStore } from '../db/sqlite-store.js';
import { openDatabase } from '../db/sqlite.js';
import { issueUserToken, issueWorkerToken } from '../identity.js';
import { generateSecret, JwtKeyRing } from '../jwt.js';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ROOT = path.resolve(PKG, '../..');
const BIN = path.join(PKG, 'dist/bin.js');
const CLI = path.resolve(PKG, '../cli/dist/index.js');
const TRACE = '11111111111111111111111111111111';
const PARENT = `00-${TRACE}-2222222222222222-01`;

interface Proc { child: ChildProcess; stderr: string; exited: Promise<number | null> }
interface WireSpan {
  traceId: string; spanId: string; parentSpanId?: string; name: string; kind: number;
  startTimeUnixNano: string; endTimeUnixNano: string; attributes: Array<{ key: string; value: unknown }>;
}
interface Export { resourceSpans: Array<{ resource: { attributes: Array<{ key: string; value: { stringValue?: string } }> }; scopeSpans: Array<{ spans: WireSpan[] }> }> }

function sourceChanged(dir: string, builtAt: number): boolean {
  return fs.readdirSync(dir, { withFileTypes: true }).some((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? entry.name !== 'test-support' && sourceChanged(file, builtAt)
      : entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && fs.statSync(file).mtimeMs > builtAt;
  });
}

async function until<T>(probe: () => T | undefined | Promise<T | undefined>, timeout = 20_000): Promise<T> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error('Operational proof timed out.');
}

function processFor(args: string[], env: Record<string, string>, procs: Proc[]): Proc {
  const child = spawn(process.execPath, [BIN, ...args], {
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? os.tmpdir(), ...env },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const proc: Proc = { child, stderr: '', exited: new Promise((resolve, reject) => {
    child.once('error', reject); child.once('close', resolve);
  }) };
  child.stderr?.on('data', (chunk: Buffer) => { proc.stderr += chunk.toString(); });
  procs.push(proc);
  return proc;
}

async function stop(proc: Proc): Promise<void> {
  if (proc.child.exitCode !== null || proc.child.signalCode !== null) return;
  proc.child.kill('SIGTERM');
  const timer = setTimeout(() => proc.child.kill('SIGKILL'), 6000);
  try { expect(await proc.exited).toBe(0); } finally { clearTimeout(timer); }
}

async function api(url: string, method: string, route: string, token: string, body?: unknown, traceparent?: string) {
  const response = await fetch(`${url}${route}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(traceparent ? { traceparent } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000),
  });
  return { status: response.status, json: await response.json() as { data?: { job?: { id: string; status: string; errorCode?: string }; output?: { chunks: Array<{ data: string }> }; entries?: unknown[] }; error?: { code: string } } };
}

describe('operational recovery and OTLP over HTTP', () => {
  it('snapshots live WAL and restores roles, revocations, audit, queued tracing and expired leases across real API/worker processes', async () => {
    expect(fs.existsSync(CLI), 'Build the real CLI before running operational proof.').toBe(true);
    if (!fs.existsSync(BIN) || sourceChanged(path.join(PKG, 'src'), fs.statSync(BIN).mtimeMs)) {
      const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
      execFileSync(process.execPath, [tsc, '-p', 'tsconfig.build.json'], { cwd: PKG, stdio: 'pipe' });
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-operations-'));
    const procs: Proc[] = [];
    const exports: Export[] = [];
    const invalid: string[] = [];
    const collector = createServer(async (request, response) => {
      try {
        if (request.method !== 'POST' || request.url !== '/v1/traces' || request.headers['content-type'] !== 'application/json') throw new Error('OTLP route/content type');
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        exports.push(JSON.parse(Buffer.concat(chunks).toString()) as Export);
        response.writeHead(200, { 'Content-Type': 'application/json' }); response.end('{}');
      } catch { invalid.push('Invalid OTLP HTTP request.'); response.writeHead(400); response.end(); }
    });
    await new Promise<void>((resolve) => collector.listen(0, '127.0.0.1', resolve));
    const address = collector.address();
    if (!address || typeof address === 'string') throw new Error('Collector did not bind.');
    const dbPath = path.join(tmp, 'source.db');
    const db = openDatabase(dbPath);
    let dbOpen = true;
    try {
      db.exec('PRAGMA wal_autocheckpoint = 0');
      migrate(db);
      SqliteTenantStore.fromSnapshot(db, {
        tenants: [{ id: 'acme', name: 'Acme', allowedCommandIds: ['workspace.summary'] }],
        workspaces: [{ id: 'demo', tenantId: 'acme', name: 'Demo', allowedCommandIds: ['workspace.summary'] }],
        members: [{ tenantId: 'acme', userId: 'alice', role: 'admin' }, { tenantId: 'acme', userId: 'bob', role: 'operator' }, { tenantId: 'acme', userId: 'vera', role: 'viewer' }, { tenantId: 'acme', userId: 'revoked', role: 'operator' }],
      });
      const secret = generateSecret();
      const keyRing = new JwtKeyRing({ k1: secret }, 'k1');
      const user = (userId: string) => issueUserToken({ keyRing }, { userId }).token;
      const alice = user('alice'); const bob = user('bob'); const vera = user('vera');
      const revokedIssue = issueUserToken({ keyRing }, { userId: 'revoked' });
      const revoked = revokedIssue.token;
      const workerToken = issueWorkerToken({ keyRing }, { workerId: 'proof-worker', tenantId: 'acme' }).token;
      const env = {
        CONTROL_PLANE_HOST: '127.0.0.1', CONTROL_PLANE_PORT: '0', CONTROL_PLANE_DB: dbPath,
        CONTROL_PLANE_JWT_KEYS: JSON.stringify({ activeKid: 'k1', keys: { k1: secret } }),
        CONTROL_PLANE_RATE_LIMIT_PER_MINUTE: '6000',
        CONTROL_PLANE_LEASE_MS: '1000', CONTROL_PLANE_TRACE_SAMPLE_RATIO: '1',
        CONTROL_PLANE_TRACE_ENDPOINT: `http://127.0.0.1:${address.port}/v1/traces`,
      };
      const serve = async (file: string) => {
        const proc = processFor(['serve'], { ...env, CONTROL_PLANE_DB: file, CONTROL_PLANE_LEASE_MS: file === dbPath ? '1000' : '60000' }, procs);
        const url = await until(() => {
          if (proc.child.exitCode !== null) throw new Error(`API stopped before listening: ${proc.stderr}`);
          return /"message":"listening","url":"([^"]+)"/.exec(proc.stderr)?.[1];
        });
        return { proc, url };
      };
      const first = await serve(dbPath);
      // A claim at this point consumes only the first job; its worker disappears.
      const stale = await api(first.url, 'POST', '/tenants/acme/workspaces/demo/commands', bob, { commandId: 'workspace.summary' });
      expect(stale.status).toBe(202);
      expect((await api(first.url, 'POST', '/worker/claim', workerToken, { waitMs: 0 })).status).toBe(200);
      expect((await api(first.url, 'POST', `/worker/jobs/${stale.json.data!.job!.id}/output`, workerToken, { chunks: [{ stream: 'stdout', data: 'before-snapshot\n' }] })).status).toBe(200);
      const queued = await api(first.url, 'POST', '/tenants/acme/workspaces/demo/commands', bob, { commandId: 'workspace.summary' }, PARENT);
      expect(queued.status).toBe(202);
      const queuedId = queued.json.data!.job!.id;
      const traceParent = new SqliteJobStore(db).get('acme', queuedId)?.traceParent;
      expect(traceParent).toMatch(new RegExp(`^00-${TRACE}-`));
      new SqliteTokenRevocations(db).revoke('re-shell-control-plane', revokedIssue.jti, revokedIssue.expiresAt, Date.now());
      expect((await api(first.url, 'GET', '/me', revoked)).status).toBe(401);
      expect(fs.statSync(`${dbPath}-wal`).size).toBeGreaterThan(0);
      const snapshot = path.join(tmp, 'snapshot.db');
      execFileSync(process.execPath, [path.join(ROOT, 'scripts/snapshot-control-plane.mjs'), dbPath, snapshot], { stdio: 'pipe' });
      // The snapshot must not accidentally include writes committed afterwards.
      new SqliteTenantStore(db).setMember('acme', 'bob', 'viewer');
      expect(() => execFileSync(process.execPath, [path.join(ROOT, 'scripts/snapshot-control-plane.mjs'), dbPath, snapshot], { stdio: 'pipe' })).toThrow();
      await stop(first.proc);
      db.close(); dbOpen = false;
      const restoreDir = path.join(tmp, 'restored'); fs.mkdirSync(restoreDir);
      const restoredFile = path.join(restoreDir, 'control-plane.db');
      fs.copyFileSync(snapshot, restoredFile, fs.constants.COPYFILE_EXCL);
      const restored = await serve(restoredFile);
      expect((await api(restored.url, 'GET', '/me', revoked)).status).toBe(401);
      expect((await api(restored.url, 'POST', '/tenants/acme/workspaces/demo/commands', vera, { commandId: 'workspace.summary' })).status).toBe(403);
      expect((await api(restored.url, 'GET', '/tenants/acme/audit', bob)).status).toBe(403);
      const audit = await api(restored.url, 'GET', '/tenants/acme/audit?action=command.authorize', alice);
      expect(audit.status).toBe(200); expect(audit.json.data?.entries?.length).toBeGreaterThan(0);
      // Restored queue context is durable and roles reflect the snapshot point.
      const restoredDb = openDatabase(restoredFile);
      try {
        expect(new SqliteTenantStore(restoredDb).getMemberships('bob')).toEqual({ acme: 'operator' });
        expect(new SqliteJobStore(restoredDb).get('acme', queuedId)?.traceParent).toBe(traceParent);
        expect(() => restoredDb.prepare("UPDATE audit_log SET decision = 'deny'").run()).toThrow();
      } finally { restoredDb.close(); }
      await new Promise((resolve) => setTimeout(resolve, 1050));
      const workspaceRoot = path.join(tmp, 'workspaces');
      fs.cpSync(path.join(PKG, 'fixtures/workspace-root'), workspaceRoot, { recursive: true });
      const worker = processFor(['worker', '--tenant', 'acme', '--workspace-root', workspaceRoot, '--url', restored.url, '--cli-bin', CLI, '--mode', 'process'], {
        CONTROL_PLANE_WORKER_TOKEN: workerToken, CONTROL_PLANE_TRACE_SAMPLE_RATIO: '1', CONTROL_PLANE_TRACE_ENDPOINT: env.CONTROL_PLANE_TRACE_ENDPOINT,
      }, procs);
      expect(worker.child.pid).not.toBe(restored.proc.child.pid);
      const finished = await until(async () => {
        if (worker.child.exitCode !== null) throw new Error(`Worker stopped: ${worker.stderr}`);
        const response = await api(restored.url, 'GET', `/tenants/acme/jobs/${queuedId}`, bob);
        const status = response.json.data?.job?.status;
        if (status === 'failed' || status === 'canceled') throw new Error(`Restored queued job failed: ${JSON.stringify(response.json)}; worker: ${worker.stderr}`);
        return status === 'succeeded' ? response : undefined;
      }, 40_000);
      expect(finished.json.data?.output?.chunks.map((chunk) => chunk.data).join('')).toContain('"ok":true');
      const lost = await api(restored.url, 'GET', `/tenants/acme/jobs/${stale.json.data!.job!.id}`, bob);
      expect(lost.status, JSON.stringify(lost.json)).toBe(200);
      expect(lost.json.data?.job).toMatchObject({ status: 'failed', errorCode: 'WORKER_LOST' });
      expect(lost.json.data?.output?.chunks.map((chunk) => chunk.data).join('')).toBe('before-snapshot\n');
      await stop(worker); await stop(restored.proc);
      // Rollback switches to the preserved directory; processing the restored
      // copy must not mutate the original queue or its later role change.
      const rollback = await serve(dbPath);
      expect((await api(rollback.url, 'POST', '/tenants/acme/workspaces/demo/commands', bob, { commandId: 'workspace.summary' })).status).toBe(403);
      expect((await api(rollback.url, 'GET', `/tenants/acme/jobs/${queuedId}`, alice)).json.data?.job?.status).toBe('queued');
      await stop(rollback.proc);
      expect(invalid).toEqual([]);
      const spans = exports.flatMap((batch) => batch.resourceSpans.flatMap((resource) => resource.scopeSpans.flatMap((scope) => scope.spans.map((span) => ({ ...span, service: resource.resource.attributes.find((attribute) => attribute.key === 'service.name')?.value.stringValue })))));
      expect(new Set(spans.map((span) => span.service))).toEqual(new Set(['re-shell-control-plane', 're-shell-worker']));
      for (const span of spans) {
        expect(span.traceId).toMatch(/^[0-9a-f]{32}$/); expect(span.spanId).toMatch(/^[0-9a-f]{16}$/);
        expect(BigInt(span.endTimeUnixNano)).toBeGreaterThanOrEqual(BigInt(span.startTimeUnixNano));
      }
      const chain = spans.filter((span) => span.traceId === TRACE);
      const submitted = chain.find((span) => span.kind === 2 && span.name.endsWith('/workspaces/:workspaceId/commands'));
      const execute = chain.find((span) => span.name === 're-shell.job.execute' && span.service === 're-shell-worker');
      expect(submitted?.parentSpanId).toBe('2222222222222222');
      expect(execute?.parentSpanId).toBe(submitted?.spanId);
      expect(execute).toBeDefined();
      for (const suffix of ['output', 'exit']) {
        const client = chain.find((span) => span.kind === 3 && span.name === `POST /worker/jobs/:jobId/${suffix}`);
        const server = chain.find((span) => span.kind === 2 && span.name === `POST /worker/jobs/:jobId/${suffix}`);
        expect(client?.parentSpanId).toBe(execute?.spanId);
        expect(server?.parentSpanId).toBe(client?.spanId);
        expect(client).toBeDefined(); expect(server).toBeDefined();
      }
      const wire = JSON.stringify(exports);
      for (const privateValue of [secret, bob, workerToken, queuedId, 'acme', workspaceRoot]) expect(wire).not.toContain(privateValue);
    } finally {
      for (const proc of procs) {
        if (proc.child.exitCode === null && proc.child.signalCode === null) proc.child.kill('SIGKILL');
      }
      await Promise.allSettled(procs.map((proc) => proc.exited));
      if (dbOpen) db.close();
      await new Promise<void>((resolve) => collector.close(() => resolve()));
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }, 180_000);
});
