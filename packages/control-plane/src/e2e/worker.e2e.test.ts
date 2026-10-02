import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EventTap } from '../test-support/event-tap.js';
import { startHarness, type Harness } from '../test-support/harness.js';
import { Worker } from '../worker/worker.js';

/**
 * End to end with the REAL, BUILT re-shell CLI: start the control plane, start a
 * worker pointed at `packages/cli/dist/index.js` and a fixture workspace, POST a
 * command, and observe the streamed result and exit code.
 *
 * Requires `pnpm -r build` (the CLI must be built). A missing build is a hard
 * failure with an actionable message, never a silent skip.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = path.resolve(HERE, '../../../cli/dist/index.js');
const FIXTURE_ROOT = path.resolve(HERE, '../../fixtures/workspace-root');

const COMMANDS = ['workspace.summary', 'workspace.health', 'commands.list', 'templates.list'];

let tmp: string;
let workspaceRoot: string;
let h: Harness;
let worker: Worker;

beforeAll(async () => {
  if (!fs.existsSync(CLI_BIN)) {
    throw new Error(`The re-shell CLI is not built (${CLI_BIN} is missing). Run \`pnpm -r build\` first.`);
  }
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-e2e-'));
  workspaceRoot = path.join(tmp, 'workspaces');
  fs.cpSync(FIXTURE_ROOT, workspaceRoot, { recursive: true });
  // A directory that is NOT a monorepo: the CLI exits non-zero there.
  fs.mkdirSync(path.join(workspaceRoot, 'plain'));

  h = await startHarness({
    seed: {
      tenants: [{ id: 'acme', name: 'Acme', allowedCommandIds: COMMANDS }],
      workspaces: [
        { id: 'demo', tenantId: 'acme', name: 'Demo monorepo', allowedCommandIds: COMMANDS },
        { id: 'plain', tenantId: 'acme', name: 'Not a monorepo', allowedCommandIds: COMMANDS },
      ],
      members: [
        { tenantId: 'acme', userId: 'alice', role: 'admin' },
        { tenantId: 'acme', userId: 'bob', role: 'operator' },
        { tenantId: 'acme', userId: 'vera', role: 'viewer' },
      ],
    },
  });

  worker = new Worker({
    controlPlaneUrl: h.url,
    token: h.workerToken('e2e-worker', 'acme'),
    tenantId: 'acme',
    workspaceRoot,
    cliBin: CLI_BIN,
    claimWaitMs: 2000,
  });
  worker.start();
  await worker.whenSynced();
});

afterAll(async () => {
  await worker?.stop();
  await h?.close();
  if (tmp) {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

const submit = (workspace: string, commandId: string, user = 'bob') =>
  h.request('POST', `/tenants/acme/workspaces/${workspace}/commands`, {
    token: h.userToken(user),
    body: { commandId },
  });

async function stream(jobId: string): Promise<EventTap> {
  const tap = await EventTap.open(`${h.url}/tenants/acme/jobs/${jobId}/stream`, h.userToken('bob'));
  await tap.waitForEvent('exit', 1, 45_000);
  await tap.waitForEnd();
  return tap;
}

describe('control plane + worker + real CLI', () => {
  it('POSTs a command and streams the real CLI result and exit code', async () => {
    const submitted = await submit('demo', 'workspace.summary');
    expect(submitted.status).toBe(202);
    const jobId = submitted.json.data.job.id;

    const tap = await stream(jobId);
    const stdout = tap
      .of('stdout')
      .map((m) => JSON.parse(m.data).data)
      .join('');
    const envelope = JSON.parse(stdout);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.root).toBe(fs.realpathSync(path.join(workspaceRoot, 'demo')));
    expect(envelope.data.workspaces.map((w: { name: string }) => w.name).sort()).toEqual([
      '@fixture/shared-utils',
      '@fixture/web-app',
    ]);

    const exit = tap.json('exit')[0].job;
    expect(exit).toMatchObject({ status: 'succeeded', exitCode: 0, commandId: 'workspace.summary' });

    // The same outcome is available by polling.
    const polled = await h.request('GET', `/tenants/acme/jobs/${jobId}`, { token: h.userToken('alice') });
    expect(polled.json.data.job).toMatchObject({ status: 'succeeded', exitCode: 0 });
    expect(polled.json.data.output.chunks.map((c: { data: string }) => c.data).join('')).toBe(stdout);
  }, 60_000);

  it("reports the CLI's non-zero exit code and error envelope", async () => {
    const jobId = (await submit('plain', 'workspace.summary')).json.data.job.id;
    const tap = await stream(jobId);
    const stdout = tap
      .of('stdout')
      .map((m) => JSON.parse(m.data).data)
      .join('');
    expect(JSON.parse(stdout)).toMatchObject({ ok: false, error: { code: 'NOT_IN_MONOREPO' } });
    expect(tap.json('exit')[0].job).toMatchObject({ status: 'failed', exitCode: 1 });
  }, 60_000);

  it('runs several read-only commands from two users in the same shared workspace', async () => {
    const [a, b] = await Promise.all([
      submit('demo', 'commands.list', 'bob'),
      submit('demo', 'templates.list', 'alice'),
    ]);
    // alice is an admin and therefore also an operator.
    expect(a.status).toBe(202);
    expect(b.status).toBe(202);
    for (const res of [a, b]) {
      const tap = await stream(res.json.data.job.id);
      expect(tap.json('exit')[0].job).toMatchObject({ status: 'succeeded', exitCode: 0 });
      const out = tap.of('stdout').map((m) => JSON.parse(m.data).data).join('');
      expect(JSON.parse(out).ok).toBe(true);
    }
    // Both users see the same workspaces.
    const [va, vb] = await Promise.all([
      h.request('GET', '/tenants/acme/workspaces', { token: h.userToken('bob') }),
      h.request('GET', '/tenants/acme/workspaces', { token: h.userToken('vera') }),
    ]);
    expect(va.json.data.workspaces).toEqual(vb.json.data.workspaces);
  }, 90_000);

  it('a team policy change reaches the worker and users, and is enforced immediately', async () => {
    const bobEvents = await EventTap.open(`${h.url}/tenants/acme/events`, h.userToken('bob'));
    await bobEvents.waitForEvent('snapshot');

    const before = worker.policy?.policyVersion ?? 0;
    const update = await h.request('PUT', '/tenants/acme/policy', {
      token: h.userToken('alice'),
      body: { allowedCommandIds: ['commands.list'], policyPack: 'baseline' },
    });
    expect(update.status).toBe(200);

    await bobEvents.waitForEvent('policy.updated');
    expect(bobEvents.json('policy.updated')[0].policy).toMatchObject({ policyVersion: before + 1, policyPack: 'baseline' });
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && worker.policy?.policyVersion !== before + 1) {
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(worker.policy).toMatchObject({ policyVersion: before + 1, policyPack: 'baseline' });

    const denied = await submit('demo', 'workspace.summary');
    expect(denied.status).toBe(403);
    expect(denied.json.error.code).toBe('COMMAND_NOT_ALLOWED');
    expect((await submit('demo', 'commands.list')).status).toBe(202);
    bobEvents.close();
  }, 60_000);
});
