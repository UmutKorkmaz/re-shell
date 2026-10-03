import { ChildProcess, execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EventTap } from '../test-support/event-tap.js';

/**
 * The deployed shape: the BUILT `re-shell-control-plane` bin run as real
 * processes — `gen-key`, `issue-token` (bootstrap), `serve`, `worker` — driving
 * the built re-shell CLI against a fixture workspace, with data persisted in a
 * real SQLite file across a server restart.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, '../..');
const BIN = path.join(PKG, 'dist/bin.js');
const CLI_BIN = path.resolve(PKG, '../cli/dist/index.js');
const FIXTURE_ROOT = path.join(PKG, 'fixtures/workspace-root');

function newestSourceMtime(dir: string): number {
  let newest = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'test-support' && entry.name !== 'e2e') {
        newest = Math.max(newest, newestSourceMtime(full));
      }
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      newest = Math.max(newest, fs.statSync(full).mtimeMs);
    }
  }
  return newest;
}

/** Build dist if it is missing or older than the sources (CI builds first; this covers local runs). */
function ensureBuilt(): void {
  const stale = !fs.existsSync(BIN) || fs.statSync(BIN).mtimeMs < newestSourceMtime(path.join(PKG, 'src'));
  if (stale) {
    const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
    execFileSync(process.execPath, [tsc, '-p', 'tsconfig.build.json'], { cwd: PKG, stdio: 'pipe' });
  }
}

interface Proc {
  child: ChildProcess;
  stdout: string;
  stderr: string;
  exited: Promise<number | null>;
}

function run(args: string[], env: Record<string, string>): Proc {
  const child = spawn(process.execPath, [BIN, ...args], {
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? tmp, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const proc: Proc = {
    child,
    stdout: '',
    stderr: '',
    exited: new Promise((resolve) => child.on('close', (code) => resolve(code))),
  };
  child.stdout?.on('data', (b: Buffer) => (proc.stdout += b.toString()));
  child.stderr?.on('data', (b: Buffer) => (proc.stderr += b.toString()));
  return proc;
}

async function runToEnd(args: string[], env: Record<string, string>): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const p = run(args, env);
  const code = await p.exited;
  return { code, stdout: p.stdout, stderr: p.stderr };
}

async function waitFor<T>(what: string, probe: () => T | undefined, timeoutMs = 30_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

let tmp: string;
let env: Record<string, string>;
let workspaceRoot: string;
const procs: Proc[] = [];

async function startServer(): Promise<{ proc: Proc; url: string }> {
  const proc = run(['serve'], { ...env, CONTROL_PLANE_PORT: '0' });
  procs.push(proc);
  const url = await waitFor('the server to listen', () => {
    const m = /"message":"listening","url":"([^"]+)"/.exec(proc.stderr);
    return m ? m[1] : undefined;
  });
  return { proc, url };
}

async function api(url: string, method: string, pathName: string, token: string, body?: unknown) {
  const res = await fetch(`${url}${pathName}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: (await res.json()) as any }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

beforeAll(() => {
  if (!fs.existsSync(CLI_BIN)) {
    throw new Error(`The re-shell CLI is not built (${CLI_BIN} is missing). Run \`pnpm -r build\` first.`);
  }
  ensureBuilt();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-bin-'));
  workspaceRoot = path.join(tmp, 'workspaces');
  fs.cpSync(FIXTURE_ROOT, workspaceRoot, { recursive: true });
  env = {
    CONTROL_PLANE_HOST: '127.0.0.1',
    CONTROL_PLANE_DB: path.join(tmp, 'control-plane.db'),
    CONTROL_PLANE_JWT_KEYS_FILE: path.join(tmp, 'keys.json'),
    CONTROL_PLANE_PLATFORM_ADMINS: 'alice',
  };
}, 120_000);

afterAll(async () => {
  for (const p of procs) {
    if (p.child.exitCode === null) p.child.kill('SIGKILL');
  }
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

describe('re-shell-control-plane (built bin, real processes)', () => {
  it('bootstraps keys and the first admin, then serves, runs a job on a worker, and survives a restart', async () => {
    // --- keys + bootstrap admin --------------------------------------------
    const key = await runToEnd(['gen-key', '--raw'], env);
    expect(key.code).toBe(0);
    fs.writeFileSync(env.CONTROL_PLANE_JWT_KEYS_FILE, key.stdout, { mode: 0o600 });

    const boot = await runToEnd(['issue-token', '--user', 'alice', '--tenant', 'acme', '--role', 'admin', '--ttl', '3600'], env);
    expect(boot.code).toBe(0);
    const bootstrap = JSON.parse(boot.stdout);
    expect(bootstrap.ok).toBe(true);
    expect(bootstrap.data.bootstrap).toMatchObject({ tenantId: 'acme', tenantCreated: true, role: 'admin' });
    const alice: string = bootstrap.data.token;
    const bob: string = JSON.parse((await runToEnd(['issue-token', '--user', 'bob'], env)).stdout).data.token;

    // --- serve ---------------------------------------------------------------
    const { proc: server, url } = await startServer();
    const health = await fetch(`${url}/healthz`);
    expect(health.status).toBe(200);

    // alice (tenant admin) configures the tenant through the API.
    expect((await api(url, 'PUT', '/tenants/acme/policy', alice, { allowedCommandIds: ['workspace.summary'] })).status).toBe(200);
    expect((await api(url, 'POST', '/tenants/acme/workspaces', alice, { id: 'demo', name: 'Demo', allowedCommandIds: ['workspace.summary'] })).status).toBe(201);
    expect((await api(url, 'PUT', '/tenants/acme/members/bob', alice, { role: 'operator' })).status).toBe(200);
    // Tenant creation is reserved for platform admins (alice is one).
    expect((await api(url, 'POST', '/tenants', alice, { id: 'globex', name: 'Globex', adminUserId: 'gina' })).status).toBe(201);
    expect((await api(url, 'POST', '/tenants', bob, { id: 'nope', name: 'Nope' })).status).toBe(403);

    // --- worker ----------------------------------------------------------------
    const workerToken = JSON.parse(
      (await runToEnd(['issue-token', '--worker', '--worker-id', 'bin-worker', '--tenant', 'acme'], env)).stdout
    ).data.token as string;
    const worker = run(
      ['worker', '--tenant', 'acme', '--workspace-root', workspaceRoot, '--url', url, '--cli-bin', CLI_BIN],
      { CONTROL_PLANE_WORKER_TOKEN: workerToken }
    );
    procs.push(worker);
    await waitFor('the worker to start', () => (worker.stderr.includes('"message":"worker started"') ? true : undefined));

    // --- run a command through the whole stack ---------------------------------
    const submitted = await api(url, 'POST', '/tenants/acme/workspaces/demo/commands', bob, { commandId: 'workspace.summary' });
    expect(submitted.status).toBe(202);
    const jobId = submitted.json.data.job.id as string;
    const tap = await EventTap.open(`${url}/tenants/acme/jobs/${jobId}/stream`, bob);
    await tap.waitForEvent('exit', 1, 60_000);
    const out = tap.of('stdout').map((m) => JSON.parse(m.data).data).join('');
    expect(JSON.parse(out)).toMatchObject({ ok: true });
    expect(tap.json('exit')[0].job).toMatchObject({ status: 'succeeded', exitCode: 0 });

    // The worker's own environment (its token) never reached the child CLI: the
    // job output is the CLI's JSON and nothing else.
    expect(out).not.toContain(workerToken);

    // --- the audit trail recorded it, readable by the admin ---------------------
    const audit = await api(url, 'GET', '/tenants/acme/audit?action=command.authorize', alice);
    expect(audit.json.data.entries[0]).toMatchObject({ userId: 'bob', tenantId: 'acme', workspaceId: 'demo', commandId: 'workspace.summary', decision: 'allow' });

    // --- graceful shutdown ------------------------------------------------------
    worker.child.kill('SIGTERM');
    expect(await worker.exited).toBe(0);
    server.child.kill('SIGTERM');
    expect(await server.exited).toBe(0);

    // --- restart: everything persisted in the SQLite file ------------------------
    const { proc: again, url: url2 } = await startServer();
    const list = await api(url2, 'GET', '/tenants/acme/workspaces', bob);
    expect(list.json.data.workspaces.map((w: { id: string }) => w.id)).toEqual(['demo']);
    const policy = await api(url2, 'GET', '/tenants/acme/policy', bob);
    expect(policy.json.data.policy).toMatchObject({ policyVersion: 1, allowedCommandIds: ['workspace.summary'] });
    const history = await api(url2, 'GET', `/tenants/acme/jobs/${jobId}`, bob);
    expect(history.json.data.job).toMatchObject({ status: 'succeeded', exitCode: 0 });
    // Old tokens still verify (keys are persisted in the key file, not in memory).
    expect((await api(url2, 'GET', '/me', alice)).status).toBe(200);
    again.child.kill('SIGTERM');
    expect(await again.exited).toBe(0);
  }, 180_000);

  it('refuses to start without keys and reports a JSON CONFIG_ERROR', async () => {
    const r = await runToEnd(['serve'], { CONTROL_PLANE_DB: path.join(tmp, 'x.db') });
    expect(r.code).toBe(1);
    expect(JSON.parse(r.stdout)).toMatchObject({ ok: false, error: { code: 'CONFIG_ERROR' } });
  }, 30_000);

  it('a worker with a bad token exits non-zero with ok:false', async () => {
    const { proc: server, url } = await startServer();
    const worker = run(['worker', '--tenant', 'acme', '--workspace-root', workspaceRoot, '--url', url], {
      CONTROL_PLANE_WORKER_TOKEN: 'not.a.token',
    });
    procs.push(worker);
    const code = await worker.exited;
    expect(code).toBe(1);
    expect(JSON.parse(worker.stdout.trim().split('\n').pop() ?? '{}')).toMatchObject({ ok: false });
    server.child.kill('SIGTERM');
    await server.exited;
  }, 60_000);
});
