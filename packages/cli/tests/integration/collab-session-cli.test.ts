import { ChildProcess, execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  sanitizeForTerminal,
  sessionJoin,
  type SessionCliContext,
} from '../../src/commands/collab-session';

/**
 * `re-shell collab session ...` against a REAL control plane: the built
 * control-plane bin (server + worker as separate processes, SQLite on disk, JWT
 * auth) and the built CLI as a separate process per command. Two users, alice
 * and bob, share a session: alice drives and runs a command that a worker
 * executes with the real CLI; bob watches, is refused when he tries to run, and
 * takes over via handover. No mocks: every assertion is on process output and
 * exit codes.
 *
 * Requires `pnpm -r build`; a missing build fails loudly.
 */

const CLI = path.resolve(process.cwd(), 'dist/index.js');
const CP_BIN = path.resolve(process.cwd(), '../control-plane/dist/bin.js');
const FIXTURE_ROOT = path.resolve(process.cwd(), '../control-plane/fixtures/workspace-root');

interface Proc {
  child: ChildProcess;
  stdout: string;
  stderr: string;
  exited: Promise<number | null>;
}

function spawnProc(args: string[], env: Record<string, string>): Proc {
  const child = spawn(process.execPath, args, {
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? os.tmpdir(), ...env },
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

async function waitFor<T>(what: string, probe: () => T | undefined, timeoutMs = 60_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

let tmp: string;
let cpEnv: Record<string, string>;
let url: string;
let aliceToken: string;
let bobToken: string;
let veraToken: string;
const procs: Proc[] = [];

async function cpCommand(args: string[]): Promise<string> {
  const p = spawnProc([CP_BIN, ...args], cpEnv);
  const code = await p.exited;
  if (code !== 0) throw new Error(`control-plane ${args.join(' ')} failed: ${p.stdout}${p.stderr}`);
  return p.stdout;
}

async function api(method: string, route: string, token: string, body?: unknown) {
  const res = await fetch(`${url}${route}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: (await res.json()) as any };
}

interface CliRun {
  code: number;
  stdout: string;
  stderr: string;
  json: any;
}

/** Run the built CLI as a child process with a clean environment. */
function cli(args: string[], extraEnv: Record<string, string> = {}, cwd = tmp): Promise<CliRun> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [CLI, ...args],
      {
        cwd,
        env: { PATH: process.env.PATH ?? '', HOME: tmp, ...extraEnv },
        maxBuffer: 16 * 1024 * 1024,
        timeout: 120_000,
      },
      (error, stdout, stderr) => {
        const code = error ? ((error as NodeJS.ErrnoException & { code?: number }).code as unknown as number) || 1 : 0;
        let json: unknown;
        try {
          json = JSON.parse(stdout.trim().split('\n').filter(Boolean).pop() ?? '');
        } catch {
          json = undefined;
        }
        resolve({ code: typeof code === 'number' ? code : 1, stdout, stderr, json });
      }
    );
  });
}

const asUser = (token: string, extra: string[] = []) => ['--url', url, '--tenant', 'acme', '--token', token, ...extra];

beforeAll(async () => {
  for (const f of [CLI, CP_BIN]) {
    if (!fs.existsSync(f)) throw new Error(`${f} is missing. Run \`pnpm -r build\` first.`);
  }
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-collab-'));
  const workspaceRoot = path.join(tmp, 'workspaces');
  fs.cpSync(FIXTURE_ROOT, workspaceRoot, { recursive: true });
  cpEnv = {
    CONTROL_PLANE_HOST: '127.0.0.1',
    CONTROL_PLANE_PORT: '0',
    CONTROL_PLANE_DB: path.join(tmp, 'cp.db'),
    CONTROL_PLANE_JWT_KEYS_FILE: path.join(tmp, 'keys.json'),
    CONTROL_PLANE_PLATFORM_ADMINS: 'alice',
  };
  fs.writeFileSync(cpEnv.CONTROL_PLANE_JWT_KEYS_FILE, await cpCommand(['gen-key', '--raw']), { mode: 0o600 });
  const token = async (...args: string[]) => JSON.parse(await cpCommand(['issue-token', ...args])).data.token as string;
  aliceToken = await token('--user', 'alice', '--tenant', 'acme', '--role', 'admin', '--ttl', '3600');
  bobToken = await token('--user', 'bob', '--ttl', '3600');
  veraToken = await token('--user', 'vera', '--ttl', '3600');

  const server = spawnProc([CP_BIN, 'serve'], cpEnv);
  procs.push(server);
  url = await waitFor('the server to listen', () => /"message":"listening","url":"([^"]+)"/.exec(server.stderr)?.[1]);

  const commands = ['workspace.summary', 'commands.list'];
  expect((await api('PUT', '/tenants/acme/policy', aliceToken, { allowedCommandIds: commands })).status).toBe(200);
  expect((await api('POST', '/tenants/acme/workspaces', aliceToken, { id: 'demo', name: 'Demo', allowedCommandIds: commands })).status).toBe(201);
  expect((await api('PUT', '/tenants/acme/members/bob', aliceToken, { role: 'operator' })).status).toBe(200);
  expect((await api('PUT', '/tenants/acme/members/vera', aliceToken, { role: 'viewer' })).status).toBe(200);

  const workerToken = (await token('--worker', '--worker-id', 'cli-worker', '--tenant', 'acme')) as string;
  const worker = spawnProc(
    [CP_BIN, 'worker', '--tenant', 'acme', '--workspace-root', workspaceRoot, '--url', url, '--cli-bin', CLI],
    { CONTROL_PLANE_WORKER_TOKEN: workerToken }
  );
  procs.push(worker);
  await waitFor('the worker to start', () => (worker.stderr.includes('"message":"worker started"') ? true : undefined));
}, 180_000);

afterAll(async () => {
  for (const p of procs) {
    if (p.child.exitCode === null) p.child.kill('SIGKILL');
  }
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

describe('re-shell collab session (built CLI, real control plane)', () => {
  let sessionId = '';

  it('start creates a session owned and driven by the caller', async () => {
    const res = await cli(['collab', 'session', 'start', '--workspace', 'demo', '--title', 'Pair on demo', '--json', ...asUser(aliceToken)]);
    expect(res.code).toBe(0);
    expect(res.json.ok).toBe(true);
    expect(res.json.warnings.join(' ')).toMatch(/process list/); // --token is flagged
    const s = res.json.data.session;
    sessionId = s.session.id;
    expect(s.session).toMatchObject({ tenantId: 'acme', workspaceId: 'demo', ownerId: 'alice', driverId: 'alice', status: 'active', title: 'Pair on demo' });
    expect(s.docs[0].id).toBe('notes');
  });

  it('list shows it to the other user; a viewer-role user is refused', async () => {
    const res = await cli(['collab', 'session', 'list', '--json', ...asUser(bobToken)]);
    expect(res.code).toBe(0);
    expect(res.json.data.sessions.map((s: { id: string }) => s.id)).toContain(sessionId);
    const refused = await cli(['collab', 'session', 'list', '--json', ...asUser(veraToken)]);
    expect(refused.code).toBe(1);
    expect(refused.json).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    const filtered = await cli(['collab', 'session', 'list', '--status', 'ended', '--json', ...asUser(bobToken)]);
    expect(filtered.json.data.sessions).toEqual([]);
    expect((await cli(['collab', 'session', 'list', '--status', 'nope', '--json', ...asUser(bobToken)])).json.error.code).toBe('INVALID_REQUEST');
  });

  it('join (--json, and non-TTY text) emits a snapshot and makes bob a viewer', async () => {
    const res = await cli(['collab', 'session', 'join', sessionId, '--json', ...asUser(bobToken)]);
    expect(res.code).toBe(0);
    const s = res.json.data.session;
    expect(s.participants.map((p: { userId: string; role: string }) => [p.userId, p.role])).toEqual([
      ['alice', 'driver'],
      ['bob', 'viewer'],
    ]);
    expect(s.runs).toEqual([]);
    // Without --json and without a TTY: a text snapshot, not a stream (this call returns).
    const text = await cli(['collab', 'session', 'join', sessionId, ...asUser(bobToken)]);
    expect(text.code).toBe(0);
    expect(text.stdout).toContain(`Session ${sessionId}`);
    expect(text.stdout).toMatch(/alice\s+driver/);
    expect(text.stdout).toMatch(/bob\s+viewer/);
  });

  it('the viewer cannot run commands (non-zero exit, NOT_SESSION_DRIVER)', async () => {
    const res = await cli(['collab', 'session', 'run', sessionId, 'workspace.summary', '--json', ...asUser(bobToken)]);
    expect(res.code).toBe(1);
    expect(res.json).toMatchObject({ ok: false, error: { code: 'NOT_SESSION_DRIVER' } });
    const text = await cli(['collab', 'session', 'run', sessionId, 'workspace.summary', ...asUser(bobToken)]);
    expect(text.code).toBe(1);
    expect(text.stderr).toContain('NOT_SESSION_DRIVER');
  });

  it('the driver runs a command: a real worker executes the real CLI and the output comes back', async () => {
    const res = await cli(['collab', 'session', 'run', sessionId, 'workspace.summary', '--json', ...asUser(aliceToken)]);
    expect(res.code).toBe(0);
    expect(res.json.ok).toBe(true);
    const run = res.json.data.run;
    expect(run).toMatchObject({ commandId: 'workspace.summary', status: 'succeeded', exitCode: 0 });
    const envelope = JSON.parse(run.output);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.workspaces.map((w: { name: string }) => w.name).sort()).toEqual(['@fixture/shared-utils', '@fixture/web-app']);
  }, 120_000);

  it('text mode streams the command output to stdout and exits 0', async () => {
    const res = await cli(['collab', 'session', 'run', sessionId, 'commands.list', ...asUser(aliceToken)]);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('"ok":true');
  }, 120_000);

  it('rejects params outside the registry and unknown commands without running anything', async () => {
    const badParam = await cli(['collab', 'session', 'run', sessionId, 'workspace.summary', '--param', 'evil=1', '--json', ...asUser(aliceToken)]);
    expect(badParam.code).toBe(1);
    expect(badParam.json.error.code).toBe('INVALID_REQUEST');
    const unknown = await cli(['collab', 'session', 'run', sessionId, 'rm.everything', '--json', ...asUser(aliceToken)]);
    expect(unknown.json).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    const notListed = await cli(['collab', 'session', 'run', sessionId, 'doctor', '--json', ...asUser(aliceToken)]);
    expect(notListed.json).toMatchObject({ ok: false, error: { code: 'COMMAND_NOT_ALLOWED' } });
    expect((await cli(['collab', 'session', 'run', sessionId, 'workspace.summary', '--param', 'noequals', '--json', ...asUser(aliceToken)])).json.error.code).toBe('INVALID_REQUEST');
  });

  it('--no-wait queues and returns immediately', async () => {
    const res = await cli(['collab', 'session', 'run', sessionId, 'workspace.summary', '--no-wait', '--json', ...asUser(aliceToken)]);
    expect(res.code).toBe(0);
    expect(res.json.data.job.id).toMatch(/[0-9a-f-]{36}/);
    expect(res.json.data.run).toBeNull();
    // Let it settle so the next test finds the session idle; the worker finishes it on its own.
    const idle = async () => {
      const s = (await cli(['collab', 'session', 'join', sessionId, '--json', ...asUser(aliceToken)])).json.data.session;
      return s.currentJobId === null ? s : undefined;
    };
    let settled: any;
    for (let i = 0; i < 150 && !settled; i += 1) {
      settled = await idle();
      if (!settled) await new Promise((r) => setTimeout(r, 200));
    }
    expect(settled.runs[settled.runs.length - 1]).toMatchObject({ jobId: res.json.data.job.id, status: 'succeeded' });
  }, 120_000);

  it('handover passes control: the old driver is refused, the new one runs', async () => {
    const handed = await cli(['collab', 'session', 'handover', sessionId, 'bob', '--json', ...asUser(aliceToken)]);
    expect(handed.code).toBe(0);
    expect(handed.json.data.session.session.driverId).toBe('bob');
    const refused = await cli(['collab', 'session', 'run', sessionId, 'commands.list', '--json', ...asUser(aliceToken)]);
    expect(refused.json.error.code).toBe('NOT_SESSION_DRIVER');
    const ran = await cli(['collab', 'session', 'run', sessionId, 'commands.list', '--json', ...asUser(bobToken)]);
    expect(ran.code).toBe(0);
    expect(ran.json.data.run).toMatchObject({ status: 'succeeded', exitCode: 0 });
    // Both users see the same console.
    const [a, b] = await Promise.all([
      cli(['collab', 'session', 'join', sessionId, '--json', ...asUser(aliceToken)]),
      cli(['collab', 'session', 'join', sessionId, '--json', ...asUser(bobToken)]),
    ]);
    const strip = (r: CliRun) => ({ ...r.json.data.session, online: [] });
    expect(strip(a)).toEqual(strip(b));
    expect(strip(a).runs.map((r: { commandId: string; requestedBy: string }) => [r.commandId, r.requestedBy])).toEqual([
      ['workspace.summary', 'alice'],
      ['commands.list', 'alice'],
      ['workspace.summary', 'alice'],
      ['commands.list', 'bob'],
    ]);
    // Handing over to somebody who never joined fails clearly.
    const nobody = await cli(['collab', 'session', 'handover', sessionId, 'ghost', '--json', ...asUser(bobToken)]);
    expect(nobody.json.error.code).toBe('PARTICIPANT_NOT_FOUND');
  }, 120_000);

  it('end: only the owner (or an admin) may; afterwards the session is read-only history', async () => {
    const denied = await cli(['collab', 'session', 'end', sessionId, '--json', ...asUser(bobToken)]);
    expect(denied.json.error.code).toBe('FORBIDDEN');
    const ended = await cli(['collab', 'session', 'end', sessionId, '--reason', 'done', '--json', ...asUser(aliceToken)]);
    expect(ended.code).toBe(0);
    expect(ended.json.data.session.session.status).toBe('ended');
    const join = await cli(['collab', 'session', 'join', sessionId, '--json', ...asUser(bobToken)]);
    expect(join.json.error.code).toBe('SESSION_ENDED');
    const active = await cli(['collab', 'session', 'list', '--status', 'active', '--json', ...asUser(bobToken)]);
    expect(active.json.data.sessions.find((s: { id: string }) => s.id === sessionId)).toBeUndefined();
  });

  it('reads URL, token and tenant from the environment, then from the config file', async () => {
    const env = { RE_SHELL_CONTROL_PLANE_URL: url, RE_SHELL_CONTROL_PLANE_TOKEN: bobToken, RE_SHELL_CONTROL_PLANE_TENANT: 'acme' };
    const viaEnv = await cli(['collab', 'session', 'list', '--json'], env);
    expect(viaEnv.code).toBe(0);
    expect(viaEnv.json.warnings).toEqual([]);

    // The tenant is discovered from the token when it has exactly one.
    const noTenant = await cli(['collab', 'session', 'list', '--json'], { ...env, RE_SHELL_CONTROL_PLANE_TENANT: '' });
    expect(noTenant.code).toBe(0);

    const tokenFile = path.join(tmp, 'bob.token');
    fs.writeFileSync(tokenFile, `${bobToken}\n`, { mode: 0o600 });
    const configFile = path.join(tmp, 'control-plane.json');
    fs.writeFileSync(configFile, JSON.stringify({ url, tenant: 'acme', tokenFile }), { mode: 0o600 });
    const viaFile = await cli(['collab', 'session', 'list', '--json'], { RE_SHELL_CONTROL_PLANE_CONFIG: configFile });
    expect(viaFile.code).toBe(0);
    expect(viaFile.json.ok).toBe(true);

    // A flag beats the environment.
    const flagWins = await cli(['collab', 'session', 'list', '--json', '--url', 'http://127.0.0.1:1'], env);
    expect(flagWins.code).toBe(1);
    expect(flagWins.json.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('fails with CONFIG_ERROR and a non-zero exit when nothing is configured', async () => {
    const res = await cli(['collab', 'session', 'list', '--json']);
    expect(res.code).toBe(1);
    expect(res.json).toMatchObject({ ok: false, error: { code: 'CONFIG_ERROR' } });
    expect(res.json.error.message).toMatch(/RE_SHELL_CONTROL_PLANE_URL/);
    const bad = await cli(['collab', 'session', 'list', '--json', '--url', 'ftp://x', '--token', 'x']);
    expect(bad.json.error.code).toBe('CONFIG_ERROR');
    const wrongToken = await cli(['collab', 'session', 'list', '--json', ...asUser('not.a.token')]);
    expect(wrongToken.code).toBe(1);
    expect(wrongToken.json.error.code).toBe('UNAUTHENTICATED');
  });

  it('keeps the code-generator subcommands working and documents the real ones first', async () => {
    const help = await cli(['collab', '--help']);
    expect(help.code).toBe(0);
    expect(help.stdout.indexOf('session')).toBeLessThan(help.stdout.indexOf('webrtc-sharing'));
    expect(help.stdout).toContain('[code generator]');
    const out = path.join(tmp, 'gen');
    const gen = await cli(['collab', 'operational-transform', 'demo-ot', '--output', out]);
    expect(gen.code).toBe(0);
    expect(fs.existsSync(out)).toBe(true);
  });
});

describe('join streaming in a terminal (function level, real HTTP)', () => {
  it('prints the snapshot, then live events from another user, and stops on abort', async () => {
    const created = await api('POST', '/tenants/acme/sessions', aliceToken, { workspaceId: 'demo', title: 'live' });
    const id = created.json.data.session.session.id as string;
    let out = '';
    const controller = new AbortController();
    const ctx: SessionCliContext = {
      flags: { url, token: bobToken, tenant: 'acme' },
      json: false,
      env: {},
      isTTY: true,
      out: (t) => {
        out += t;
      },
      err: () => undefined,
      signal: controller.signal,
    };
    const joined = sessionJoin(ctx, { sessionId: id });
    await waitFor('the snapshot to print', () => (out.includes('--- live') ? true : undefined));
    expect(out).toContain(`Session ${id}`);

    // alice (driver) runs a command; bob's terminal receives the shared output live.
    const ran = await api('POST', `/tenants/acme/sessions/${id}/run`, aliceToken, { commandId: 'commands.list' });
    expect(ran.status).toBe(202);
    await waitFor('the live output', () => (out.includes('-- succeeded') ? true : undefined), 60_000);
    expect(out).toContain('$ commands.list  (by alice)');
    expect(out).toContain('"ok":true');
    expect(out).toMatch(/bob\s+viewer/);

    controller.abort();
    const result = await joined;
    expect(result.ok).toBe(true);
    await api('POST', `/tenants/acme/sessions/${id}/end`, aliceToken, {});
  }, 120_000);
});

describe('terminal output sanitizing', () => {
  it('strips escape sequences and control characters that a remote command could emit', () => {
    const hostile = 'ok\u001b]0;pwned\u0007 \u001b[31mred\u001b[0m \u001b[2J\u001b[Hx\rY\u0008\u0000end\n\tkept';
    expect(sanitizeForTerminal(hostile)).toBe('ok red xYend\n\tkept');
    expect(sanitizeForTerminal('\u001b]52;c;ZXZpbA==\u001b\\after')).toBe('after');
    expect(sanitizeForTerminal('plain text')).toBe('plain text');
  });
});
