// Hub behaviours the desktop shell (apps/web/src-tauri) depends on:
//
//  - an exact-origin allowlist extension (RE_SHELL_UI_HUB_ALLOWED_ORIGINS) so
//    the Tauri webview origin (tauri://localhost) can reach the hub, WITHOUT
//    weakening the default browser-flow allowlist;
//  - a parent-lifetime tie (RE_SHELL_UI_HUB_EXIT_ON_STDIN_CLOSE) so a hub the
//    desktop app owns can never outlive it, even if the app is SIGKILLed;
//  - a graceful stop that does not stall on a connected dashboard's SSE stream.
//
// The process-level tests bundle the REAL hub entry (hub-server-main.ts) with
// esbuild into a temp dir and run it under plain `node`, exactly as the desktop
// shell does with the shipped dist/hub-server.js.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { spawn, type ChildProcess } from 'node:child_process';

import { build } from 'esbuild';
import { WebSocket } from 'ws';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, '..');
const STUB_CLI = path.join(HERE, 'fixtures', 'stub-cli.mjs');

const TOKEN = 'desktop-test-token-0123456789abcdef';
const DESKTOP_ORIGIN = 'tauri://localhost';
const WINDOWS_DESKTOP_ORIGIN = 'http://tauri.localhost';
const BROWSER_DASHBOARD_PORT = 46001;
const BROWSER_ORIGIN = `http://127.0.0.1:${BROWSER_DASHBOARD_PORT}`;

// ---------------------------------------------------------------------------
// parseAllowedOriginsEnv
// ---------------------------------------------------------------------------

describe('parseAllowedOriginsEnv', () => {
  it('returns no extras when unset or empty (browser flow unchanged)', async () => {
    const { parseAllowedOriginsEnv } = await import('../src/hub-server.ts');
    expect(parseAllowedOriginsEnv(undefined)).toEqual([]);
    expect(parseAllowedOriginsEnv('')).toEqual([]);
    expect(parseAllowedOriginsEnv(' , ,')).toEqual([]);
  });

  it('accepts the desktop webview origins as exact origins', async () => {
    const { parseAllowedOriginsEnv } = await import('../src/hub-server.ts');
    expect(
      parseAllowedOriginsEnv('tauri://localhost, http://tauri.localhost ,https://tauri.localhost')
    ).toEqual(['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost']);
    expect(parseAllowedOriginsEnv('http://localhost:3333')).toEqual(['http://localhost:3333']);
  });

  it('drops wildcards, paths, userinfo and unknown schemes instead of widening', async () => {
    const { parseAllowedOriginsEnv } = await import('../src/hub-server.ts');
    expect(parseAllowedOriginsEnv('*')).toEqual([]);
    expect(parseAllowedOriginsEnv('http://*.example.com')).toEqual([]);
    expect(parseAllowedOriginsEnv('tauri://localhost/')).toEqual([]);
    expect(parseAllowedOriginsEnv('http://tauri.localhost/path')).toEqual([]);
    expect(parseAllowedOriginsEnv('http://user:pw@tauri.localhost')).toEqual([]);
    expect(parseAllowedOriginsEnv('file://localhost')).toEqual([]);
    expect(parseAllowedOriginsEnv('javascript:alert(1)')).toEqual([]);
    expect(parseAllowedOriginsEnv('null')).toEqual([]);
    // One good entry survives next to bad ones.
    expect(parseAllowedOriginsEnv('*,tauri://localhost,ftp://x')).toEqual(['tauri://localhost']);
  });
});

// ---------------------------------------------------------------------------
// In-process hub: origin allowlist + graceful stop
// ---------------------------------------------------------------------------

interface InProcessHub {
  port: number;
  url: string;
  stop: () => Promise<void>;
}

async function startInProcessHub(env: { allowedOrigins?: string; workspace: string }): Promise<InProcessHub> {
  vi.resetModules();
  process.env.RE_SHELL_UI_HUB_TOKEN = TOKEN;
  process.env.RE_SHELL_CLI_BIN = STUB_CLI;
  process.env.RE_SHELL_WORKSPACE = env.workspace;
  process.env.VITE_RE_SHELL_UI_PORT = String(BROWSER_DASHBOARD_PORT);
  process.env.VITE_RE_SHELL_UI_HOST = '127.0.0.1';
  delete process.env.RE_SHELL_UI_HUB_PORT;
  if (env.allowedOrigins === undefined) {
    delete process.env.RE_SHELL_UI_HUB_ALLOWED_ORIGINS;
  } else {
    process.env.RE_SHELL_UI_HUB_ALLOWED_ORIGINS = env.allowedOrigins;
  }
  const mod = await import('../src/hub-server.ts');
  const info = await mod.startHubServer({ port: 0 });
  return { port: info.port, url: info.url, stop: () => mod.stopHubServer(info.server) };
}

function openWs(port: number, origin: string, token: string): Promise<{ opened: boolean; ws: WebSocket }> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/jobs`, [`re-shell-token.${token}`], {
    headers: { Host: '127.0.0.1', Origin: origin },
  });
  return new Promise((resolve) => {
    ws.once('open', () => resolve({ opened: true, ws }));
    ws.once('close', () => resolve({ opened: false, ws }));
    ws.once('error', () => {
      /* close settles the promise */
    });
  });
}

/** Raw request so the Origin header can be set (fetch forbids it in some runtimes). */
function rawRequest(
  port: number,
  opts: { method: string; path: string; headers: Record<string, string> }
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method: opts.method, path: opts.path, headers: opts.headers },
      (res) => {
        let body = '';
        res.on('data', (c: Buffer) => (body += c.toString()));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('hub origin allowlist for the desktop webview', () => {
  let workspace: string;
  let hub: InProcessHub | undefined;

  afterEach(async () => {
    if (hub) {
      await hub.stop();
      hub = undefined;
    }
    if (workspace) {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
    delete process.env.RE_SHELL_UI_HUB_ALLOWED_ORIGINS;
  });

  function newWorkspace(): string {
    workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-desktop-ws-')));
    return workspace;
  }

  it('echoes the tauri origin in CORS preflight and the token-authed response when allowlisted', async () => {
    hub = await startInProcessHub({
      allowedOrigins: `${DESKTOP_ORIGIN},${WINDOWS_DESKTOP_ORIGIN}`,
      workspace: newWorkspace(),
    });

    for (const origin of [DESKTOP_ORIGIN, WINDOWS_DESKTOP_ORIGIN]) {
      const preflight = await rawRequest(hub.port, {
        method: 'OPTIONS',
        path: '/health',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'x-re-shell-ui-hub-token',
        },
      });
      expect(preflight.status).toBe(204);
      expect(preflight.headers['access-control-allow-origin']).toBe(origin);
      expect(String(preflight.headers['access-control-allow-headers']).toLowerCase()).toContain(
        'x-re-shell-ui-hub-token'
      );

      const health = await rawRequest(hub.port, {
        method: 'GET',
        path: '/health',
        headers: { Origin: origin, Accept: 'application/json', 'X-Re-Shell-UI-Hub-Token': TOKEN },
      });
      expect(health.status).toBe(200);
      expect(health.headers['access-control-allow-origin']).toBe(origin);
      expect(JSON.parse(health.body)).toMatchObject({ status: 'ok' });
    }
  });

  it('still requires the token for an allowlisted desktop origin', async () => {
    hub = await startInProcessHub({ allowedOrigins: DESKTOP_ORIGIN, workspace: newWorkspace() });
    const res = await rawRequest(hub.port, {
      method: 'GET',
      path: '/health',
      headers: { Origin: DESKTOP_ORIGIN, Accept: 'application/json' },
    });
    expect(res.status).toBe(401);
    const wrong = await rawRequest(hub.port, {
      method: 'GET',
      path: '/health',
      headers: { Origin: DESKTOP_ORIGIN, Accept: 'application/json', 'X-Re-Shell-UI-Hub-Token': 'nope' },
    });
    expect(wrong.status).toBe(401);
  });

  it('accepts a WS upgrade from the tauri origin only when allowlisted', async () => {
    hub = await startInProcessHub({ allowedOrigins: DESKTOP_ORIGIN, workspace: newWorkspace() });

    const ok = await openWs(hub.port, DESKTOP_ORIGIN, TOKEN);
    expect(ok.opened).toBe(true);
    ok.ws.close();

    // A different tauri host and a web origin are still refused.
    const otherTauri = await openWs(hub.port, 'tauri://evil', TOKEN);
    expect(otherTauri.opened).toBe(false);
    const web = await openWs(hub.port, 'http://evil.example.com:1234', TOKEN);
    expect(web.opened).toBe(false);

    // The browser dashboard origin keeps working.
    const browser = await openWs(hub.port, BROWSER_ORIGIN, TOKEN);
    expect(browser.opened).toBe(true);
    browser.ws.close();
  });

  it('does NOT allow the tauri origin by default (browser flow unchanged)', async () => {
    hub = await startInProcessHub({ workspace: newWorkspace() });

    const desktop = await openWs(hub.port, DESKTOP_ORIGIN, TOKEN);
    expect(desktop.opened).toBe(false);

    const preflight = await rawRequest(hub.port, {
      method: 'OPTIONS',
      path: '/health',
      headers: { Origin: DESKTOP_ORIGIN, 'Access-Control-Request-Method': 'GET' },
    });
    // The hub answers with its own dashboard origin, never the desktop one.
    expect(preflight.headers['access-control-allow-origin']).toBe(BROWSER_ORIGIN);

    const browser = await openWs(hub.port, BROWSER_ORIGIN, TOKEN);
    expect(browser.opened).toBe(true);
    browser.ws.close();
  });

  it('ignores a wildcard in the allowlist env', async () => {
    hub = await startInProcessHub({ allowedOrigins: '*', workspace: newWorkspace() });
    const res = await openWs(hub.port, 'http://evil.example.com:1234', TOKEN);
    expect(res.opened).toBe(false);
  });

  it('writes an opt-in access log with the path only, never the token query', async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    });
    process.env.RE_SHELL_UI_HUB_ACCESS_LOG = '1';
    try {
      hub = await startInProcessHub({ allowedOrigins: DESKTOP_ORIGIN, workspace: newWorkspace() });
      const ok = await rawRequest(hub.port, {
        method: 'GET',
        path: `/health?token=${TOKEN}`,
        headers: { Origin: DESKTOP_ORIGIN, Accept: 'application/json' },
      });
      expect(ok.status).toBe(200);
      const denied = await rawRequest(hub.port, {
        method: 'GET',
        path: '/health',
        headers: { Origin: DESKTOP_ORIGIN, Accept: 'application/json' },
      });
      expect(denied.status).toBe(401);
      const ws = await openWs(hub.port, DESKTOP_ORIGIN, TOKEN);
      expect(ws.opened).toBe(true);
      ws.ws.close();
      const refused = await openWs(hub.port, 'http://evil.example.com:1234', TOKEN);
      expect(refused.opened).toBe(false);
      await delay(100);
    } finally {
      spy.mockRestore();
      delete process.env.RE_SHELL_UI_HUB_ACCESS_LOG;
    }

    const access = lines.filter((l) => l.includes('access '));
    expect(access).toContain(`[hub-server] access GET /health -> 200 origin=${DESKTOP_ORIGIN}`);
    expect(access).toContain(`[hub-server] access GET /health -> 401 origin=${DESKTOP_ORIGIN}`);
    expect(access.some((l) => l.includes('access WS /jobs -> 101') && l.includes('token=valid'))).toBe(true);
    expect(access.some((l) => l.includes('access WS /jobs -> 403 Forbidden'))).toBe(true);
    // The token never reaches the log, query string included.
    expect(lines.join('\n')).not.toContain(TOKEN);
  });

  it('writes no access log unless opted in', async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    });
    try {
      hub = await startInProcessHub({ workspace: newWorkspace() });
      await rawRequest(hub.port, {
        method: 'GET',
        path: '/health',
        headers: { Accept: 'application/json', 'X-Re-Shell-UI-Hub-Token': TOKEN },
      });
      await delay(50);
    } finally {
      spy.mockRestore();
    }
    expect(lines.filter((l) => l.includes('access '))).toEqual([]);
  });

  it('stops promptly even while a dashboard holds an open SSE stream', async () => {
    process.env.STUB_CLI_SLEEP_MS = '60000';
    try {
      hub = await startInProcessHub({ workspace: newWorkspace() });
      const sse = await new Promise<http.IncomingMessage>((resolve, reject) => {
        const req = http.request(
          {
            host: '127.0.0.1',
            port: hub!.port,
            path: `/events?commandId=commands.list&token=${TOKEN}`,
            headers: { Accept: 'text/event-stream' },
          },
          resolve
        );
        req.on('error', reject);
        req.end();
      });
      expect(sse.statusCode).toBe(200);
      sse.on('error', () => {
        /* the stream is torn down by the stop below */
      });
      sse.resume();
      await delay(150);

      const started = Date.now();
      await hub.stop();
      hub = undefined;
      // Without closeAllConnections() this blocks until the stream ends (60s).
      expect(Date.now() - started).toBeLessThan(5000);
    } finally {
      delete process.env.STUB_CLI_SLEEP_MS;
    }
  });
});

// ---------------------------------------------------------------------------
// Bundled hub process: stdin-close lifetime tie
// ---------------------------------------------------------------------------

let bundleDir: string;
let bundlePath: string;

beforeAll(async () => {
  bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-hub-bundle-'));
  bundlePath = path.join(bundleDir, 'hub-server.js');
  await build({
    entryPoints: [path.join(APP_ROOT, 'src/hub-server-main.ts')],
    outfile: bundlePath,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    sourcemap: false,
    logLevel: 'silent',
    alias: {
      '@re-shell/contracts/command-registry': path.resolve(
        APP_ROOT,
        '../../packages/contracts/src/command-registry.ts'
      ),
      '@re-shell/contracts': path.resolve(APP_ROOT, '../../packages/contracts/src/index.ts'),
    },
  });
});

afterAll(() => {
  if (bundleDir) {
    fs.rmSync(bundleDir, { recursive: true, force: true });
  }
});

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitUntil(predicate: () => boolean | Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) {
      return true;
    }
    await delay(50);
  }
  return predicate();
}

function hubEnv(port: number, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    RE_SHELL_UI_HUB_PORT: String(port),
    RE_SHELL_UI_HUB_TOKEN: TOKEN,
    RE_SHELL_WORKSPACE: os.tmpdir(),
    ...extra,
  };
}

async function healthStatus(port: number, token?: string): Promise<number> {
  try {
    const res = await rawRequest(port, {
      method: 'GET',
      path: '/health',
      headers: { Accept: 'application/json', ...(token ? { 'X-Re-Shell-UI-Hub-Token': token } : {}) },
    });
    return res.status;
  } catch {
    return 0;
  }
}

describe('bundled hub process tied to its parent through stdin', () => {
  const spawned: ChildProcess[] = [];

  afterEach(() => {
    for (const child of spawned.splice(0)) {
      if (child.pid && isAlive(child.pid)) {
        child.kill('SIGKILL');
      }
    }
  });

  function startHubProcess(port: number, extraEnv: Record<string, string>): ChildProcess {
    const child = spawn(process.execPath, [bundlePath], {
      env: hubEnv(port, extraEnv),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    spawned.push(child);
    child.stdout?.resume();
    child.stderr?.resume();
    return child;
  }

  it('shuts down gracefully (exit 0, port released) when the parent closes stdin', async () => {
    const port = await freePort();
    const child = startHubProcess(port, { RE_SHELL_UI_HUB_EXIT_ON_STDIN_CLOSE: '1' });
    const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));

    expect(await waitUntil(async () => (await healthStatus(port, TOKEN)) === 200, 10000)).toBe(true);
    // The token is enforced on the live process too.
    expect(await healthStatus(port)).toBe(401);
    expect(await healthStatus(port, 'wrong-token')).toBe(401);

    child.stdin?.end();
    const code = await Promise.race([exited, delay(8000).then(() => 'timeout' as const)]);
    expect(code).toBe(0);
    expect(await healthStatus(port, TOKEN)).toBe(0);
  });

  it('stays up on stdin close when the opt-in env is NOT set (CLI-managed flow)', async () => {
    const port = await freePort();
    const child = startHubProcess(port, {});
    expect(await waitUntil(async () => (await healthStatus(port, TOKEN)) === 200, 10000)).toBe(true);

    child.stdin?.end();
    await delay(1000);
    expect(isAlive(child.pid as number)).toBe(true);
    expect(await healthStatus(port, TOKEN)).toBe(200);
  });

  it('never outlives a parent that is SIGKILLed (no orphan on the port)', async () => {
    const port = await freePort();
    // A throwaway "desktop app" parent: spawns the hub with a stdin pipe, prints
    // the hub pid, then idles until it is killed without any chance to clean up.
    const parentScript = `
      const { spawn } = require('node:child_process');
      const hub = spawn(process.execPath, [process.argv[1]], {
        env: process.env,
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      process.stdout.write('HUB_PID=' + hub.pid + '\\n');
      setInterval(() => {}, 1000);
    `;
    const parent = spawn(process.execPath, ['-e', parentScript, bundlePath], {
      env: hubEnv(port, { RE_SHELL_UI_HUB_EXIT_ON_STDIN_CLOSE: '1' }),
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    spawned.push(parent);

    const hubPid = await new Promise<number>((resolve, reject) => {
      let buf = '';
      parent.stdout?.on('data', (c: Buffer) => {
        buf += c.toString();
        const m = /HUB_PID=(\d+)/.exec(buf);
        if (m) {
          resolve(Number(m[1]));
        }
      });
      parent.once('error', reject);
      parent.once('exit', () => reject(new Error('parent exited early')));
    });
    spawned.push({ pid: hubPid, kill: () => process.kill(hubPid, 'SIGKILL') } as unknown as ChildProcess);

    expect(await waitUntil(async () => (await healthStatus(port, TOKEN)) === 200, 10000)).toBe(true);
    expect(isAlive(hubPid)).toBe(true);

    parent.kill('SIGKILL');

    expect(await waitUntil(() => !isAlive(hubPid), 8000)).toBe(true);
    expect(await healthStatus(port, TOKEN)).toBe(0);
  });
});
