import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFreePortPair, portIsClosed, waitFor } from '../utils/service-fixtures';

// `launchUi` lifecycle with `child_process.spawn` mocked (no real hub or vite is
// started) but REAL HTTP: a stand-in hub answers GET /health on the real hub
// port, so the readiness poll, its token header, the early-exit detection and
// the teardown ordering are all exercised for real.

vi.mock('child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, spawn: vi.fn(), spawnSync: vi.fn() };
});

const { spawn } = await import('child_process');
const { launchUi, createUiLaunchPlan, redactLaunchPlan, REDACTED_TOKEN } = await import('../../src/commands/ui');

let pidCounter = 40000;

/** Minimal ChildProcess stand-in: events, kill bookkeeping, exit state. */
class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  pid = ++pidCounter;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  killed = false;
  killSignals: string[] = [];

  kill = vi.fn((signal: NodeJS.Signals = 'SIGTERM') => {
    this.killSignals.push(signal);
    this.killed = true;
    setImmediate(() => this.finish(null, signal));
    return true;
  });

  finish(code: number | null, signal: NodeJS.Signals | null = null): void {
    if (this.exitCode !== null || this.signalCode !== null) return;
    this.exitCode = code;
    this.signalCode = signal;
    this.emit('exit', code, signal);
  }
}

interface SpawnCall {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd?: string;
}

const tempDirs: string[] = [];
let calls: SpawnCall[];
let hubChild: FakeChild | undefined;
let dashboardChild: FakeChild | undefined;
let timeline: string[];
let servers: http.Server[];
let logSpy: ReturnType<typeof vi.spyOn>;
let exitCodeBackup: string | number | undefined;

function tmp(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/** A vite-dev layout: <root>/apps/web/package.json plus a (fake) built hub bundle. */
function makeUiRoot(): string {
  const root = tmp('rs-ui-root-');
  const web = path.join(root, 'apps', 'web');
  fs.mkdirSync(path.join(web, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: '@re-shell/ui' }));
  fs.writeFileSync(path.join(web, 'package.json'), JSON.stringify({ name: '@re-shell/dashboard' }));
  fs.writeFileSync(path.join(web, 'dist', 'hub-server.js'), '// fake hub bundle\n');
  return root;
}

/** A bundled-dashboard layout for static mode. */
function makeBundleDir(): string {
  const dir = tmp('rs-ui-bundle-');
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    '<!doctype html><html><head><script type="module" src="/a.js"></script></head><body></body></html>'
  );
  fs.writeFileSync(path.join(dir, 'hub-server.js'), '// fake hub bundle\n');
  return dir;
}

/** Stand-in hub: real HTTP, authenticates like the real one (token header + JSON accept). */
async function startFakeHub(port: number, token: string): Promise<{ requests: http.IncomingHttpHeaders[] }> {
  const requests: http.IncomingHttpHeaders[] = [];
  const server = http.createServer((req, res) => {
    requests.push(req.headers);
    timeline.push('hub:request');
    const authorized =
      req.headers['x-re-shell-ui-hub-token'] === token &&
      String(req.headers.accept ?? '').includes('application/json');
    if (!authorized || req.url !== '/health') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end('{"error":"Unauthorized"}');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve));
  return { requests };
}

function installSpawn(behaviour: {
  hub: (child: FakeChild, call: SpawnCall) => void;
  dashboard?: (child: FakeChild, call: SpawnCall) => void;
}): void {
  vi.mocked(spawn).mockImplementation(((command: string, args: string[], options: any) => {
    const call: SpawnCall = { command, args, env: options?.env ?? {}, cwd: options?.cwd };
    calls.push(call);
    const child = new FakeChild();
    if (command === 'node') {
      timeline.push('spawn:hub');
      hubChild = child;
      behaviour.hub(child, call);
    } else {
      timeline.push('spawn:dashboard');
      dashboardChild = child;
      behaviour.dashboard?.(child, call);
    }
    return child;
  }) as never);
}

beforeEach(() => {
  vi.mocked(spawn).mockReset();
  calls = [];
  timeline = [];
  servers = [];
  hubChild = undefined;
  dashboardChild = undefined;
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  exitCodeBackup = process.exitCode;
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = exitCodeBackup;
  delete process.env.RE_SHELL_BUNDLED_DASHBOARD_DIR;
  for (const server of servers.splice(0)) {
    server.closeAllConnections?.();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

async function waitForCall(predicate: (c: SpawnCall) => boolean): Promise<SpawnCall> {
  expect(await waitFor(() => calls.some(predicate), 8000)).toBe(true);
  return calls.find(predicate) as SpawnCall;
}

describe('launch plan hub URL', () => {
  it('pins the hub URL to 127.0.0.1 even when the dashboard binds 0.0.0.0', () => {
    const plan = createUiLaunchPlan({ uiPath: makeUiRoot(), host: '0.0.0.0', port: '4000', open: false });

    expect(plan.url).toBe('http://0.0.0.0:4000');
    expect(plan.hubUrl).toBe('http://127.0.0.1:4001');
    expect(plan.env.VITE_RE_SHELL_UI_HUB_URL).toBe('http://127.0.0.1:4001');
    expect(plan.env.VITE_RE_SHELL_UI_HOST).toBe('0.0.0.0');
    expect(plan.hubToken).toMatch(/^[0-9a-f]{64}$/);
    expect(plan.env.VITE_RE_SHELL_UI_HUB_TOKEN).toBe(plan.hubToken);
  });

  it('keeps the loopback hub URL for a named host too', () => {
    const plan = createUiLaunchPlan({ uiPath: makeUiRoot(), host: 'localhost', port: '4100', open: false });
    expect(plan.hubUrl).toBe('http://127.0.0.1:4101');
  });
});

describe('printed launch plans never carry the hub token', () => {
  it('redactLaunchPlan replaces the token and every env var holding it', () => {
    const plan = createUiLaunchPlan({ uiPath: makeUiRoot(), port: '4200', open: false });
    const redacted = redactLaunchPlan(plan);

    expect(JSON.stringify(redacted)).not.toContain(plan.hubToken);
    expect(redacted.hubToken).toBe(REDACTED_TOKEN);
    expect(redacted.env.RE_SHELL_UI_HUB_TOKEN).toBe(REDACTED_TOKEN);
    expect(redacted.env.VITE_RE_SHELL_UI_HUB_TOKEN).toBe(REDACTED_TOKEN);
    expect(redacted.env.VITE_RE_SHELL_UI_HUB_URL).toBe(plan.env.VITE_RE_SHELL_UI_HUB_URL);
    // The original plan (used for a real launch) keeps the live token.
    expect(plan.hubToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it('--dry-run prints a redacted token and spawns nothing', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await launchUi({ uiPath: makeUiRoot(), port: '4300', open: false, dryRun: true });
      const out = log.mock.calls.map(c => c.join(' ')).join('\n');
      expect(out).toContain(`Hub token: ${REDACTED_TOKEN}`);
      expect(out).not.toMatch(/[0-9a-f]{64}/);
      expect(calls).toHaveLength(0);
    } finally {
      log.mockRestore();
    }
  });
});

describe('launchUi (vite-dev mode, spawn mocked)', () => {
  it('waits for an authenticated /health, then hands the pinned hub URL and token to the dashboard', async () => {
    const dashboardPort = await getFreePortPair();
    const hubPort = dashboardPort + 1;
    const root = makeUiRoot();
    let token = '';
    let fakeHub: { requests: http.IncomingHttpHeaders[] } | undefined;

    installSpawn({
      hub: (child, call) => {
        token = call.env.RE_SHELL_UI_HUB_TOKEN;
        // The hub "starts" a moment after being spawned.
        void startFakeHub(hubPort, token).then(h => {
          fakeHub = h;
        });
      },
    });

    const launched = launchUi({
      uiPath: root,
      host: '0.0.0.0',
      port: String(dashboardPort),
      workspace: root,
      open: false,
    });

    const dashboardCall = await waitForCall(c => c.command !== 'node');

    // Hub env: loopback port + per-launch token.
    const hubCall = calls.find(c => c.command === 'node') as SpawnCall;
    expect(hubCall.args).toEqual([path.join(root, 'apps/web/dist/hub-server.js')]);
    expect(hubCall.env.RE_SHELL_UI_HUB_PORT).toBe(String(hubPort));
    expect(hubCall.env.RE_SHELL_UI_HUB_TOKEN).toMatch(/^[0-9a-f]{64}$/);

    // Dashboard env: launchUi sets the hub URL (pinned to loopback) and the token.
    expect(dashboardCall.env.VITE_RE_SHELL_UI_HUB_URL).toBe(`http://127.0.0.1:${hubPort}`);
    expect(dashboardCall.env.VITE_RE_SHELL_UI_HUB_TOKEN).toBe(token);
    expect(dashboardCall.env.RE_SHELL_UI_HUB_TOKEN).toBe(token);
    expect(dashboardCall.env.RE_SHELL_UI_HUB_MANAGED).toBe('1');
    expect(dashboardCall.env.VITE_RE_SHELL_UI_HOST).toBe('0.0.0.0');
    expect(dashboardCall.args).toContain('0.0.0.0');

    // The dashboard was spawned only AFTER the hub answered /health with the token.
    expect(timeline.indexOf('hub:request')).toBeGreaterThan(-1);
    expect(timeline.indexOf('hub:request')).toBeLessThan(timeline.indexOf('spawn:dashboard'));
    const authed = (fakeHub as { requests: http.IncomingHttpHeaders[] }).requests.filter(
      h => h['x-re-shell-ui-hub-token'] === token
    );
    expect(authed.length).toBeGreaterThanOrEqual(2); // readiness is confirmed twice
    expect(authed[0].host).toBe(`127.0.0.1:${hubPort}`);

    // A clean dashboard exit ends the launch and tears the hub down.
    (dashboardChild as FakeChild).finish(0);
    await launched;
    expect((hubChild as FakeChild).kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('fails when the hub exits immediately (port in use) and never starts the dashboard', async () => {
    const root = makeUiRoot();
    installSpawn({
      hub: child => {
        setImmediate(() => {
          child.stderr.emit('data', Buffer.from('[hub-server] Failed to start: listen EADDRINUSE: address already in use 127.0.0.1:3334'));
          child.finish(1);
        });
      },
    });

    const error = await launchUi({ uiPath: root, port: '3333', workspace: root, open: false }).catch(e => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('Hub server exited with code 1 before it became ready on http://127.0.0.1:3334');
    expect(error.message).toContain('Port 3334');
    expect(error.message).toContain('already in use');
    expect(error.message).toContain('EADDRINUSE');
    // The dashboard was never started: nothing is left running without its hub.
    expect(calls.map(c => c.command)).toEqual(['node']);
  });

  it('fails when the hub cannot be spawned at all', async () => {
    const root = makeUiRoot();
    installSpawn({
      hub: child => {
        setImmediate(() => child.emit('error', Object.assign(new Error('spawn node ENOENT'), { code: 'ENOENT' })));
      },
    });

    const error = await launchUi({ uiPath: root, workspace: root, open: false }).catch(e => e);

    expect(error.message).toContain('Hub server failed to start: spawn node ENOENT');
    expect(calls.map(c => c.command)).toEqual(['node']);
  });

  it('fails and stops the hub when it never answers /health', async () => {
    const root = makeUiRoot();
    installSpawn({ hub: () => undefined }); // alive, but nothing listens

    const error = await launchUi({
      uiPath: root,
      port: '3333',
      workspace: root,
      open: false,
      hubReadyTimeoutMs: 600,
    }).catch(e => e);

    expect(error.message).toContain('did not become ready on http://127.0.0.1:3334 within 600ms');
    expect(calls.map(c => c.command)).toEqual(['node']);
    // Not left running.
    expect((hubChild as FakeChild).kill).toHaveBeenCalledWith('SIGTERM');
    expect((hubChild as FakeChild).exitCode === null && (hubChild as FakeChild).signalCode === null).toBe(false);
  });

  it('does not accept a server that is up but rejects the session token', async () => {
    const dashboardPort = await getFreePortPair();
    const root = makeUiRoot();
    installSpawn({
      hub: () => {
        // Something else owns the port and has a different token.
        void startFakeHub(dashboardPort + 1, 'someone-elses-token');
      },
    });

    const error = await launchUi({
      uiPath: root,
      port: String(dashboardPort),
      workspace: root,
      open: false,
      hubReadyTimeoutMs: 700,
    }).catch(e => e);

    expect(error.message).toContain('did not become ready');
    expect(calls.map(c => c.command)).toEqual(['node']);
  });

  it('tears the dashboard down and fails when the hub dies while it is running', async () => {
    const dashboardPort = await getFreePortPair();
    const root = makeUiRoot();
    installSpawn({
      hub: (child, call) => {
        void startFakeHub(dashboardPort + 1, call.env.RE_SHELL_UI_HUB_TOKEN);
      },
    });

    const launched = launchUi({
      uiPath: root,
      port: String(dashboardPort),
      workspace: root,
      open: false,
    });
    const result = launched.catch(e => e);

    await waitForCall(c => c.command !== 'node');
    const hub = hubChild as FakeChild;
    const dashboard = dashboardChild as FakeChild;
    expect(dashboard.exitCode).toBeNull();

    // The hub crashes underneath the running dashboard.
    hub.stderr.emit('data', Buffer.from('fatal: out of memory'));
    hub.finish(1);

    const error = await result;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('Hub server exited with code 1 while the dashboard was running');
    expect(error.message).toContain('fatal: out of memory');
    // The dashboard was shut down, not left serving without a hub.
    expect(dashboard.kill).toHaveBeenCalledWith('SIGTERM');
    expect(dashboard.signalCode).toBe('SIGTERM');
  });

  it('fails and stops the hub when the dashboard itself exits non-zero', async () => {
    const dashboardPort = await getFreePortPair();
    const root = makeUiRoot();
    installSpawn({
      hub: (child, call) => {
        void startFakeHub(dashboardPort + 1, call.env.RE_SHELL_UI_HUB_TOKEN);
      },
      dashboard: child => {
        setTimeout(() => child.finish(2), 50);
      },
    });

    const error = await launchUi({
      uiPath: root,
      port: String(dashboardPort),
      workspace: root,
      open: false,
    }).catch(e => e);

    expect(error.message).toBe('Re-Shell UI exited with code 2');
    expect((hubChild as FakeChild).kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('launches without a hub (and says so) when no hub bundle exists', async () => {
    const root = makeUiRoot();
    fs.rmSync(path.join(root, 'apps', 'web', 'dist'), { recursive: true });
    // ensureHubBundle would try to build it: that spawnSync is mocked and "fails".
    const { spawnSync } = await import('child_process');
    vi.mocked(spawnSync).mockReturnValue({ status: 1 } as never);
    installSpawn({
      hub: () => undefined,
      dashboard: child => {
        setTimeout(() => child.finish(0), 20);
      },
    });

    await launchUi({ uiPath: root, workspace: root, open: false });

    expect(calls.map(c => c.command)).not.toContain('node');
    expect(logSpy.mock.calls.map(c => c.join(' ')).join('\n')).toContain('launching without the hub');
  });
});

describe('launchUi (static mode, spawn mocked)', () => {
  it('serves the dashboard with the pinned hub URL + token only after the hub is ready, and shuts down when the hub dies', async () => {
    const dashboardPort = await getFreePortPair();
    const hubPort = dashboardPort + 1;
    process.env.RE_SHELL_BUNDLED_DASHBOARD_DIR = makeBundleDir();
    const workspace = tmp('rs-ui-ws-');
    let token = '';

    installSpawn({
      hub: (child, call) => {
        token = call.env.RE_SHELL_UI_HUB_TOKEN;
        void startFakeHub(hubPort, token);
      },
    });

    const result = launchUi({
      host: '0.0.0.0',
      port: String(dashboardPort),
      workspace,
      open: false,
    }).catch(e => e);

    // Dashboard is served (bound to the requested host) with the loopback hub URL injected.
    expect(await waitFor(async () => !(await portIsClosed(dashboardPort)), 8000)).toBe(true);
    const html = await new Promise<string>((resolve, reject) => {
      http
        .get({ host: '127.0.0.1', port: dashboardPort, path: '/' }, res => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', d => (body += d));
          res.on('end', () => resolve(body));
        })
        .on('error', reject);
    });
    expect(html).toContain(`"url":"http://127.0.0.1:${hubPort}"`);
    expect(html).toContain(`"token":"${token}"`);
    expect(timeline.indexOf('hub:request')).toBeLessThan(timeline.length);
    expect(calls.map(c => c.command)).toEqual(['node']);
    expect(calls[0].env.VITE_RE_SHELL_UI_HOST).toBe('0.0.0.0');

    // The hub crashes: the launcher must stop serving the dashboard and fail.
    (hubChild as FakeChild).finish(137, null);
    const error = await result;

    expect(error.message).toContain('Hub server exited with code 137 while the dashboard was running');
    expect(await waitFor(() => portIsClosed(dashboardPort), 5000)).toBe(true);
  });

  it('does not even bind the dashboard port when the hub exits immediately', async () => {
    const dashboardPort = await getFreePortPair();
    process.env.RE_SHELL_BUNDLED_DASHBOARD_DIR = makeBundleDir();
    installSpawn({
      hub: child => {
        setImmediate(() => {
          child.stderr.emit('data', Buffer.from('listen EADDRINUSE: address already in use'));
          child.finish(1);
        });
      },
    });

    const error = await launchUi({
      port: String(dashboardPort),
      workspace: tmp('rs-ui-ws-'),
      open: false,
    }).catch(e => e);

    expect(error.message).toContain('Hub server exited with code 1 before it became ready');
    expect(await portIsClosed(dashboardPort)).toBe(true);
  });
});
