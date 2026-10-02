import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  IS_WINDOWS,
  cleanupTempDirs,
  getFreePortPair,
  makeTempDir,
  portIsClosed,
  waitFor,
} from '../utils/service-fixtures';

/**
 * Real-process lifecycle conformance for `re-shell ui`, driving the BUILT CLI
 * (dist/index.js) with the REAL hub bundle (apps/web/dist/hub-server.js, built by
 * `pnpm -r build`) in static mode:
 *
 *  - SIGINT / SIGTERM to the CLI shuts the hub down and releases both ports;
 *  - a hub that cannot start (its port is taken) fails the command, non-zero,
 *    without ever serving the dashboard;
 *  - a hub killed underneath a running dashboard takes the dashboard down and
 *    fails the command;
 *  - `--host 0.0.0.0` still gives the dashboard a loopback hub URL that works.
 */

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');
const HUB_BUNDLE = path.resolve(process.cwd(), '../../apps/web/dist/hub-server.js');
const HAS_HUB = fs.existsSync(HUB_BUNDLE);
const HAS_PROC = fs.existsSync('/proc/self/stat');

const describeLive = describe.skipIf(IS_WINDOWS || !HAS_HUB);

interface RunningUi {
  child: ChildProcess;
  output: () => string;
  /** Resolves with the exit code/signal once the CLI process ends. */
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  dashboardPort: number;
  hubPort: number;
  token: () => string | undefined;
}

const running: RunningUi[] = [];

/** A bundled-dashboard directory using the real hub bundle. */
function makeBundle(): string {
  const dir = makeTempDir('rs-ui-live');
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    '<!doctype html><html><head><script type="module" src="/a.js"></script></head><body>dash</body></html>'
  );
  fs.copyFileSync(HUB_BUNDLE, path.join(dir, 'hub-server.js'));
  return dir;
}

function startUi(extraArgs: string[], ports: { dashboard: number }, bundle: string): RunningUi {
  const workspace = makeTempDir('rs-ui-ws');
  const child = spawn(
    process.execPath,
    [CLI_PATH, 'ui', '--no-open', '--port', String(ports.dashboard), '--workspace', workspace, ...extraArgs],
    {
      env: {
        ...process.env,
        RE_SHELL_BUNDLED_DASHBOARD_DIR: bundle,
        NO_COLOR: '1',
        FORCE_COLOR: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  let out = '';
  child.stdout?.on('data', d => (out += d));
  child.stderr?.on('data', d => (out += d));
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  const ui: RunningUi = {
    child,
    output: () => out,
    exited,
    dashboardPort: ports.dashboard,
    hubPort: ports.dashboard + 1,
    token: () => out.match(/Hub token: ([0-9a-f]{64})/)?.[1],
  };
  running.push(ui);
  return ui;
}

function get(port: number, pathName: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathName, headers, agent: false }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => (body += d));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
  });
}

/** Await `promise`, failing with `message()` if it does not settle within `ms` (timer always cleared). */
async function within<T>(promise: Promise<T>, ms: number, message: () => string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message())), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Wait until the CLI reports the hub ready and the dashboard is serving. */
async function waitUntilServing(ui: RunningUi): Promise<void> {
  const ok = await waitFor(
    async () => ui.output().includes('Hub ready at') && !(await portIsClosed(ui.dashboardPort)),
    60000,
    100
  );
  expect(ok, `ui never came up. Output:\n${ui.output()}`).toBe(true);
}

afterEach(async () => {
  for (const ui of running.splice(0)) {
    if (ui.child.exitCode === null && ui.child.signalCode === null) {
      ui.child.kill('SIGKILL');
    }
  }
  cleanupTempDirs();
});

describeLive('re-shell ui - lifecycle with the real hub', () => {
  it.each([
    ['SIGINT', 130],
    ['SIGTERM', 143],
  ] as const)('%s closes the hub port and the dashboard port and exits %i', async (signal, expectedCode) => {
    const ports = { dashboard: await getFreePortPair() };
    const ui = startUi([], ports, makeBundle());

    await waitUntilServing(ui);
    const token = ui.token() as string;
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    // The hub is genuinely up and authenticated, on loopback.
    const health = await get(ui.hubPort, '/health', {
      'X-Re-Shell-UI-Hub-Token': token,
      Accept: 'application/json',
    });
    expect(health.status).toBe(200);
    expect(JSON.parse(health.body).status).toBe('ok');
    const unauth = await get(ui.hubPort, '/health', { Accept: 'application/json' });
    expect(unauth.status).toBe(401);
    expect(await portIsClosed(ui.hubPort)).toBe(false);

    ui.child.kill(signal);
    const exit = await within(ui.exited, 20000, () => `CLI did not exit after ${signal}\n${ui.output()}`);

    expect(exit.code, ui.output()).toBe(expectedCode);
    // Both listeners are gone: no orphaned hub is left holding its port.
    expect(await waitFor(() => portIsClosed(ui.hubPort), 5000)).toBe(true);
    expect(await waitFor(() => portIsClosed(ui.dashboardPort), 5000)).toBe(true);
  });

  it('fails non-zero without serving the dashboard when the hub port is already taken', async () => {
    const ports = { dashboard: await getFreePortPair() };
    // Accepts and immediately drops connections, so close() can never hang on them.
    const blocker = net.createServer(socket => socket.destroy());
    await new Promise<void>(resolve => blocker.listen(ports.dashboard + 1, '127.0.0.1', resolve));
    try {
      const ui = startUi([], ports, makeBundle());
      const exit = await within(ui.exited, 60000, () => `CLI did not fail in time\n${ui.output()}`);

      expect(exit.code, ui.output()).toBe(1);
      expect(ui.output()).toContain('Hub server exited with code 1 before it became ready');
      expect(ui.output()).toContain(`Port ${ports.dashboard + 1}`);
      expect(ui.output()).toContain('already in use');
      // The dashboard was never served, and the blocker's port is still the blocker's.
      expect(await portIsClosed(ports.dashboard)).toBe(true);
    } finally {
      await new Promise<void>(resolve => blocker.close(() => resolve()));
    }
  });

  it.skipIf(!HAS_PROC)('fails non-zero and stops serving when the hub is killed under a running dashboard', async () => {
    const ports = { dashboard: await getFreePortPair() };
    const ui = startUi([], ports, makeBundle());
    await waitUntilServing(ui);

    // The hub is the CLI's only child process.
    const childrenFile = `/proc/${ui.child.pid}/task/${ui.child.pid}/children`;
    const hubPid = Number(fs.readFileSync(childrenFile, 'utf8').trim().split(/\s+/)[0]);
    expect(hubPid).toBeGreaterThan(1);

    process.kill(hubPid, 'SIGKILL');
    const exit = await within(ui.exited, 30000, () => `CLI kept running without its hub\n${ui.output()}`);

    expect(exit.code, ui.output()).toBe(1);
    expect(ui.output()).toContain('Hub server was killed by SIGKILL while the dashboard was running');
    expect(await waitFor(() => portIsClosed(ports.dashboard), 5000)).toBe(true);
    expect(await portIsClosed(ports.dashboard + 1)).toBe(true);
  });

  it('with --host 0.0.0.0 the dashboard still gets a working loopback hub URL', async () => {
    const ports = { dashboard: await getFreePortPair() };
    const ui = startUi(['--host', '0.0.0.0'], ports, makeBundle());
    await waitUntilServing(ui);

    const page = await get(ports.dashboard, '/');
    expect(page.status).toBe(200);
    const config = page.body.match(/window\.__RE_SHELL_HUB__=(\{.*?\});/);
    expect(config, page.body).not.toBeNull();
    const hubConfig = JSON.parse((config as RegExpMatchArray)[1]) as { url: string; token: string };
    expect(hubConfig.url).toBe(`http://127.0.0.1:${ports.dashboard + 1}`);

    // The URL the dashboard was given really reaches the hub with the injected token.
    const health = await get(ports.dashboard + 1, '/health', {
      'X-Re-Shell-UI-Hub-Token': hubConfig.token,
      Accept: 'application/json',
    });
    expect(health.status).toBe(200);

    ui.child.kill('SIGTERM');
    await ui.exited;
    expect(await waitFor(() => portIsClosed(ports.dashboard + 1), 5000)).toBe(true);
  });
});
