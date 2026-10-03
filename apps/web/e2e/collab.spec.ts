import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Real-time collaboration, end to end, in two independent browser contexts (two
 * users) against the REAL control plane (the built `re-shell-control-plane` bin,
 * SQLite on disk, JWT auth) with a REAL worker that runs the REAL built re-shell
 * CLI:
 *
 *   - alice and bob connect the dashboard to the control plane with their own tokens
 *   - they share one session; a WebRTC DATA CHANNEL opens between the two browsers
 *     (signaling relayed by the control plane, host candidates only) and a ping
 *     travels over it
 *   - alice (driver) runs a command; both consoles show the identical output;
 *     bob cannot run; control hands over
 *   - concurrent typing in the shared editor converges
 *   - when WebRTC is unavailable in one browser the peers fall back to the server
 *     relay and messages still arrive
 *
 * Requires `pnpm -r build` (control-plane bin, re-shell CLI). A missing build is a
 * hard failure, never a skip.
 */

const HERE = __dirname;
const REPO = path.resolve(HERE, '../../..');
const CP_BIN = path.join(REPO, 'packages/control-plane/dist/bin.js');
const CLI_BIN = path.join(REPO, 'packages/cli/dist/index.js');
const FIXTURE_ROOT = path.join(REPO, 'packages/control-plane/fixtures/workspace-root');

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

async function until<T>(what: string, probe: () => T | undefined, timeoutMs = 60_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

let tmp: string;
let controlPlaneUrl: string;
let aliceToken: string;
let bobToken: string;
const procs: Proc[] = [];

async function cpCommand(env: Record<string, string>, args: string[]): Promise<string> {
  const p = spawnProc([CP_BIN, ...args], env);
  const code = await p.exited;
  if (code !== 0) throw new Error(`control-plane ${args.join(' ')} exited ${code}: ${p.stdout}${p.stderr}`);
  return p.stdout;
}

async function api(method: string, route: string, token: string, body?: unknown) {
  const res = await fetch(`${controlPlaneUrl}${route}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: (await res.json()) as any };
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({}, testInfo) => {
  test.setTimeout(180_000);
  for (const f of [CP_BIN, CLI_BIN]) {
    if (!fs.existsSync(f)) throw new Error(`${f} is missing. Run \`pnpm -r build\` first.`);
  }
  const dashboardOrigin = new URL(String(testInfo.project.use.baseURL)).origin;
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-collab-'));
  const workspaceRoot = path.join(tmp, 'workspaces');
  fs.cpSync(FIXTURE_ROOT, workspaceRoot, { recursive: true });
  const env = {
    CONTROL_PLANE_HOST: '127.0.0.1',
    CONTROL_PLANE_PORT: '0',
    CONTROL_PLANE_DB: path.join(tmp, 'cp.db'),
    CONTROL_PLANE_JWT_KEYS_FILE: path.join(tmp, 'keys.json'),
    // The dashboard (served from another origin) may call the API; no wildcard.
    CONTROL_PLANE_CORS_ORIGINS: dashboardOrigin,
  };
  fs.writeFileSync(env.CONTROL_PLANE_JWT_KEYS_FILE, await cpCommand(env, ['gen-key', '--raw']), { mode: 0o600 });
  const token = async (...args: string[]) => JSON.parse(await cpCommand(env, ['issue-token', ...args])).data.token as string;
  aliceToken = await token('--user', 'alice', '--tenant', 'acme', '--role', 'admin', '--ttl', '7200');
  bobToken = await token('--user', 'bob', '--ttl', '7200');

  const server = spawnProc([CP_BIN, 'serve'], env);
  procs.push(server);
  controlPlaneUrl = await until('the control plane to listen', () => /"message":"listening","url":"([^"]+)"/.exec(server.stderr)?.[1]);

  const commands = ['workspace.summary', 'commands.list'];
  expect((await api('PUT', '/tenants/acme/policy', aliceToken, { allowedCommandIds: commands })).status).toBe(200);
  expect((await api('POST', '/tenants/acme/workspaces', aliceToken, { id: 'demo', name: 'Demo monorepo', allowedCommandIds: commands })).status).toBe(201);
  expect((await api('PUT', '/tenants/acme/members/bob', aliceToken, { role: 'operator' })).status).toBe(200);

  const workerToken = await token('--worker', '--worker-id', 'pw-worker', '--tenant', 'acme');
  const worker = spawnProc(
    [CP_BIN, 'worker', '--tenant', 'acme', '--workspace-root', workspaceRoot, '--url', controlPlaneUrl, '--cli-bin', CLI_BIN],
    { CONTROL_PLANE_WORKER_TOKEN: workerToken }
  );
  procs.push(worker);
  await until('the worker to start', () => (worker.stderr.includes('"message":"worker started"') ? true : undefined));
});

test.afterAll(async () => {
  for (const p of procs) {
    if (p.child.exitCode === null) p.child.kill('SIGKILL');
  }
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

/** Open the Collaboration screen as one user, connect through the real settings form. */
async function openAs(browser: Browser, token: string, options: { noWebRtc?: boolean } = {}): Promise<Page> {
  const context = await browser.newContext(); // an independent browser context per user
  const page = await context.newPage();
  if (options.noWebRtc) {
    await page.addInitScript(() => {
      // A browser without WebRTC: the peer link must fall back to the server relay.
      Object.defineProperty(window, 'RTCPeerConnection', { value: undefined, configurable: true });
    });
  }
  await page.goto('/?screen=collab');
  await expect(page.getByRole('heading', { level: 1, name: 'Collaboration' })).toBeVisible();
  await page.getByTestId('collab-url').fill(controlPlaneUrl);
  await page.getByTestId('collab-token').fill(token);
  await page.getByTestId('collab-connect').click();
  await expect(page.getByTestId('collab-status')).toContainText('connected as');
  return page;
}

async function startSessionAs(page: Page, title: string): Promise<string> {
  await expect(page.getByTestId('collab-new-workspace')).toHaveValue('demo');
  await page.getByTestId('collab-new-title').fill(title);
  await page.getByTestId('collab-create').click();
  await expect(page.getByTestId('collab-session-title')).toHaveText(title);
  const id = (await page.getByTestId('collab-session-id').textContent()) ?? '';
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  return id;
}

async function joinAs(page: Page, sessionId: string): Promise<void> {
  const join = page.getByTestId(`collab-join-${sessionId}`);
  // The list refreshes every few seconds; a manual refresh makes it deterministic.
  await expect(async () => {
    await page.getByRole('button', { name: 'Refresh sessions' }).click();
    await expect(join).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await join.click();
  await expect(page.getByTestId('collab-session-id')).toHaveText(sessionId);
}

test('two users open a WebRTC data channel, share a console and a document', async ({ browser }) => {
  test.setTimeout(180_000);
  const alice = await openAs(browser, aliceToken);
  const bob = await openAs(browser, bobToken);

  const sessionId = await startSessionAs(alice, 'Pair on demo');
  await joinAs(bob, sessionId);

  // --- presence: both participants, alice drives -----------------------------------
  for (const page of [alice, bob]) {
    await expect(page.getByTestId('collab-participant-alice')).toContainText('driver');
    await expect(page.getByTestId('collab-participant-bob')).toContainText('viewer');
    await expect(page.getByTestId('collab-driver')).toContainText('driver: alice');
  }

  // --- WebRTC: a direct data channel between the two browsers ------------------------
  await expect(alice.getByTestId('collab-peer-transport-bob')).toHaveText('p2p', { timeout: 30_000 });
  await expect(bob.getByTestId('collab-peer-transport-alice')).toHaveText('p2p', { timeout: 30_000 });

  // A pairing ping travels over the data channel in both directions.
  await bob.getByTestId('collab-ping-alice').click();
  await expect(alice.getByTestId('collab-last-ping')).toContainText('Ping from bob');
  await expect(alice.getByTestId('collab-last-ping-via')).toHaveText('direct data channel');
  await alice.getByTestId('collab-ping-bob').click();
  await expect(bob.getByTestId('collab-last-ping')).toContainText('Ping from alice');
  await expect(bob.getByTestId('collab-last-ping-via')).toHaveText('direct data channel');

  // --- shared console: a worker runs the real CLI; both see identical output --------
  await expect(bob.getByTestId('collab-run-form')).toHaveCount(0);
  await expect(bob.getByTestId('collab-viewer-note')).toContainText('Only the driver (alice) can run commands');
  await expect(alice.getByTestId('collab-run-command')).toHaveValue('workspace.summary');
  await alice.getByTestId('collab-run').click();
  for (const page of [alice, bob]) {
    await expect(page.getByTestId('collab-run-status-1')).toContainText('succeeded (exit 0)', { timeout: 60_000 });
    await expect(page.getByTestId('collab-run-output-1')).toContainText('@fixture/web-app');
  }
  const outputA = await alice.getByTestId('collab-run-output-1').textContent();
  const outputB = await bob.getByTestId('collab-run-output-1').textContent();
  expect(outputA).toBe(outputB);
  expect(JSON.parse(outputA ?? '')).toMatchObject({ ok: true });

  // The server (not just the UI) refuses a viewer's attempt to run.
  const refused = await api('POST', `/tenants/acme/sessions/${sessionId}/run`, bobToken, { commandId: 'workspace.summary' });
  expect(refused.status).toBe(403);
  expect(refused.json.error.code).toBe('NOT_SESSION_DRIVER');

  // --- handover ----------------------------------------------------------------------
  await alice.getByTestId('collab-handover-select').selectOption('bob');
  await alice.getByTestId('collab-handover').click();
  for (const page of [alice, bob]) {
    await expect(page.getByTestId('collab-driver')).toContainText('driver: bob');
  }
  await expect(bob.getByTestId('collab-run-form')).toBeVisible();
  await expect(alice.getByTestId('collab-run-form')).toHaveCount(0);

  // --- shared editor: concurrent typing converges ------------------------------------
  const editorA = alice.getByTestId('collab-editor');
  const editorB = bob.getByTestId('collab-editor');
  await editorA.fill('Runbook\n');
  await expect(editorB).toHaveValue('Runbook\n');
  await Promise.all([
    (async () => {
      await editorA.click();
      await alice.keyboard.press('Control+Home');
      await alice.keyboard.type('alice-wrote-first ');
    })(),
    (async () => {
      await editorB.click();
      await bob.keyboard.press('Control+End');
      await bob.keyboard.type('bob-wrote-last');
    })(),
  ]);
  await expect(async () => {
    const [a, b] = [await editorA.inputValue(), await editorB.inputValue()];
    expect(a).toBe(b);
    expect(a).toContain('alice-wrote-first ');
    expect(a).toContain('bob-wrote-last');
  }).toPass({ timeout: 20_000 });
  await expect(alice.getByTestId('collab-editor-sync')).toContainText('synced', { timeout: 15_000 });
  await expect(bob.getByTestId('collab-editor-sync')).toContainText('synced', { timeout: 15_000 });

  // A YAML draft is shared as text and never applied.
  await bob.getByTestId('collab-new-doc-name').fill('workspace-yaml');
  await bob.getByTestId('collab-create-doc').click();
  await expect(alice.getByTestId('collab-doc-workspace-yaml')).toBeVisible();
  await alice.getByTestId('collab-doc-workspace-yaml').click();
  await expect(alice.getByTestId('collab-yaml-note')).toContainText('never written to your workspace');

  // --- analytics --------------------------------------------------------------------
  await alice.getByRole('button', { name: 'Refresh analytics' }).click();
  await expect(alice.getByTestId('collab-tile-commands')).not.toContainText(/^Commands0/);
  await expect(alice.getByTestId('collab-table-users')).toContainText('alice');
  await expect(alice.getByTestId('collab-tile-sessions')).toContainText('1');

  await alice.context().close();
  await bob.context().close();
});

test('falls back to the server relay when WebRTC is unavailable in one browser', async ({ browser }) => {
  test.setTimeout(120_000);
  const alice = await openAs(browser, aliceToken);
  const bob = await openAs(browser, bobToken, { noWebRtc: true });

  const sessionId = await startSessionAs(alice, 'Relay fallback');
  await joinAs(bob, sessionId);
  await expect(alice.getByTestId('collab-participant-bob')).toBeVisible();

  // bob's browser has no RTCPeerConnection: his link falls back immediately...
  await expect(bob.getByTestId('collab-peer-transport-alice')).toHaveText('relay', { timeout: 20_000 });
  await expect(bob.getByTestId('collab-peer-alice')).toContainText('webrtc-unavailable');
  // ...and alice's offer is never answered, so after the connect timeout she falls back too.
  await expect(alice.getByTestId('collab-peer-transport-bob')).toHaveText('relay', { timeout: 30_000 });

  // Messages still arrive in both directions, through the control plane relay.
  await bob.getByTestId('collab-ping-alice').click();
  await expect(alice.getByTestId('collab-last-ping')).toContainText('Ping from bob');
  await expect(alice.getByTestId('collab-last-ping-via')).toHaveText('server relay');
  await alice.getByTestId('collab-ping-bob').click();
  await expect(bob.getByTestId('collab-last-ping')).toContainText('Ping from alice');
  await expect(bob.getByTestId('collab-last-ping-via')).toHaveText('server relay');

  await alice.context().close();
  await bob.context().close();
});
