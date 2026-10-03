import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ControlPlaneClient,
  ControlPlaneError,
  currentRun,
  foldCollabEvents,
  runOutputText,
  type CollabConnection,
  type CollabEvent,
  type CollabSnapshot,
} from '@re-shell/contracts';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { startHarness, type Harness } from '../test-support/harness.js';
import { Worker } from '../worker/worker.js';

/**
 * The acceptance test for shared terminal sessions: two authenticated users join
 * ONE session; the driver runs a command that a REAL worker executes with the REAL
 * built re-shell CLI; both clients receive the identical ordered output and final
 * state; the viewer cannot run commands; control hands over; a late joiner gets
 * the full history; and a run in flight across a server restart still completes.
 *
 * Requires `pnpm -r build` (the CLI must be built). A missing build is a hard
 * failure with an actionable message, never a silent skip.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = path.resolve(HERE, '../../../cli/dist/index.js');
const FIXTURE_ROOT = path.resolve(HERE, '../../fixtures/workspace-root');
const COMMANDS = ['workspace.summary', 'workspace.health', 'commands.list', 'templates.list'];

const SEED = {
  tenants: [{ id: 'acme', name: 'Acme', allowedCommandIds: COMMANDS }],
  workspaces: [
    { id: 'demo', tenantId: 'acme', name: 'Demo monorepo', allowedCommandIds: COMMANDS },
    { id: 'plain', tenantId: 'acme', name: 'Not a monorepo', allowedCommandIds: COMMANDS },
  ],
  members: [
    { tenantId: 'acme', userId: 'alice', role: 'operator' },
    { tenantId: 'acme', userId: 'bob', role: 'operator' },
    { tenantId: 'acme', userId: 'carol', role: 'operator' },
    { tenantId: 'acme', userId: 'vera', role: 'viewer' },
  ],
};

let tmp: string;
let workspaceRoot: string;
let h: Harness;
let worker: Worker | undefined;
const conns: CollabConnection[] = [];

beforeAll(() => {
  if (!fs.existsSync(CLI_BIN)) {
    throw new Error(`The re-shell CLI is not built (${CLI_BIN} is missing). Run \`pnpm -r build\` first.`);
  }
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-collab-e2e-'));
  workspaceRoot = path.join(tmp, 'workspaces');
  fs.cpSync(FIXTURE_ROOT, workspaceRoot, { recursive: true });
  fs.mkdirSync(path.join(workspaceRoot, 'plain'));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

afterEach(async () => {
  for (const c of conns.splice(0)) c.close();
  await worker?.stop();
  worker = undefined;
  await h?.close();
});

function startWorker(harness: Harness): Promise<void> {
  worker = new Worker({
    controlPlaneUrl: harness.url,
    token: harness.workerToken('collab-worker', 'acme'),
    tenantId: 'acme',
    workspaceRoot,
    cliBin: CLI_BIN,
    claimWaitMs: 1000,
  });
  worker.start();
  return worker.whenSynced();
}

const api = (user: string): ControlPlaneClient => new ControlPlaneClient({ baseUrl: h.url, token: h.userToken(user) });

/** Join and connect, recording every logged event the connection folds. */
async function participant(user: string, sessionId: string, join = true) {
  const client = api(user);
  if (join) await client.joinSession('acme', sessionId);
  const conn = client.connect('acme', sessionId);
  conns.push(conn);
  const events: CollabEvent[] = [];
  const snapshotSeqs: number[] = [];
  conn.on('event', (e) => events.push(e));
  conn.on('reset', (s) => snapshotSeqs.push(s.seq));
  await conn.start();
  return { client, conn, events, snapshotSeqs, user };
}

const finished = (jobId: string) => (s: CollabSnapshot) =>
  s.runs.some((r) => r.jobId === jobId && r.status !== 'queued' && r.status !== 'running');

describe('two users share one terminal session (real worker, real CLI)', () => {
  it('runs a command for the driver and shows both clients identical ordered output and final state', async () => {
    h = await startHarness({ seed: SEED });
    await startWorker(h);
    const alice = api('alice');
    const created = await alice.createSession('acme', { workspaceId: 'demo', title: 'Pair on demo' });
    const id = created.session.id;

    const a = await participant('alice', id);
    const b = await participant('bob', id);
    expect(b.conn.state?.participants.map((p) => [p.userId, p.role])).toEqual([
      ['alice', 'driver'],
      ['bob', 'viewer'],
    ]);

    // The viewer cannot run commands...
    const denied = await b.client.run('acme', id, 'workspace.summary').catch((e: ControlPlaneError) => e);
    expect(denied).toBeInstanceOf(ControlPlaneError);
    expect((denied as ControlPlaneError).code).toBe('NOT_SESSION_DRIVER');
    expect((denied as ControlPlaneError).status).toBe(403);

    // ...the driver can, and the worker executes it.
    const queued = await a.client.run('acme', id, 'workspace.summary');
    expect(queued.job).toMatchObject({ status: 'queued', requestedBy: 'alice' });
    const jobId = queued.job.id;

    const [stateA, stateB] = await Promise.all([
      a.conn.waitFor(finished(jobId), 60_000, 'alice sees the run finish'),
      b.conn.waitFor(finished(jobId), 60_000, 'bob sees the run finish'),
    ]);
    // Make sure both have folded the very same final sequence.
    const finalSeq = Math.max(stateA.seq, stateB.seq);
    await Promise.all([a.conn.waitForSeq(finalSeq), b.conn.waitForSeq(finalSeq)]);

    // Identical ordered events reached both clients (after bob's join, which alice also saw).
    const fromSeq = Math.max(a.events[0].seq, b.events[0].seq);
    const tailA = a.events.filter((e) => e.seq >= fromSeq);
    const tailB = b.events.filter((e) => e.seq >= fromSeq);
    expect(tailA).toEqual(tailB);
    expect(tailA.map((e) => e.seq)).toEqual(tailA.map((_, i) => fromSeq + i));
    expect(tailA.map((e) => e.type)).toEqual(
      expect.arrayContaining(['command.queued', 'command.started', 'command.output', 'command.finished'])
    );
    // queued -> started -> output... -> finished, in that order.
    const lifecycle = tailA.filter((e) => e.type.startsWith('command.')).map((e) => e.type);
    expect(lifecycle[0]).toBe('command.queued');
    expect(lifecycle[1]).toBe('command.started');
    expect(lifecycle[lifecycle.length - 1]).toBe('command.finished');

    // Identical final state, and it is the real CLI's real result.
    expect({ ...a.conn.state, online: [] }).toEqual({ ...b.conn.state, online: [] });
    const run = a.conn.state?.runs[0];
    expect(run).toMatchObject({ jobId, commandId: 'workspace.summary', status: 'succeeded', exitCode: 0, requestedBy: 'alice' });
    expect(a.conn.state?.currentJobId).toBeNull();
    const envelope = JSON.parse(runOutputText(run!));
    expect(envelope.ok).toBe(true);
    expect(envelope.data.root).toBe(fs.realpathSync(path.join(workspaceRoot, 'demo')));
    expect(envelope.data.workspaces.map((w: { name: string }) => w.name).sort()).toEqual([
      '@fixture/shared-utils',
      '@fixture/web-app',
    ]);
    expect(runOutputText(run!)).toBe(runOutputText(b.conn.state!.runs[0]));
    // The console's chunk numbering is the job's: 1..n without gaps.
    expect(run!.output.map((c) => c.seq)).toEqual(run!.output.map((_, i) => i + 1));

    // The REST snapshot agrees with what both streams built, and with the fold of the persisted log.
    const rest = await alice.getSession('acme', id);
    expect({ ...rest, online: [] }).toEqual({ ...a.conn.state, online: [] });
    const log = await alice.events('acme', id, 0, 500);
    expect({ ...foldCollabEvents(log.events), online: [], rtc: rest.rtc }).toEqual({ ...rest, online: [] });

    // It really went through the job path: a job exists, and the audit trail has the decision.
    const job = h.jobs.get('acme', jobId);
    expect(job).toMatchObject({ status: 'succeeded', requestedBy: 'alice', workspaceId: 'demo' });
    const audited = h.audit.query({ tenantId: 'acme', action: 'command.authorize', limit: 10 });
    expect(audited.some((e) => e.userId === 'alice' && e.decision === 'allow' && e.commandId === 'workspace.summary')).toBe(true);
    const sessionRuns = h.audit.query({ tenantId: 'acme', action: 'session.run', limit: 10 });
    expect(sessionRuns.map((e) => [e.userId, e.decision, e.code]).sort()).toEqual([
      ['alice', 'allow', null],
      ['bob', 'deny', 'NOT_SESSION_DRIVER'],
    ]);
  }, 90_000);

  it('hands control over: the new driver runs, the old one cannot, and both still see the same console', async () => {
    h = await startHarness({ seed: SEED });
    await startWorker(h);
    const id = (await api('alice').createSession('acme', { workspaceId: 'demo' })).session.id;
    const a = await participant('alice', id);
    const b = await participant('bob', id);

    const first = await a.client.run('acme', id, 'commands.list');
    await Promise.all([a.conn.waitFor(finished(first.job.id), 60_000), b.conn.waitFor(finished(first.job.id), 60_000)]);

    const handed = await a.client.handover('acme', id, 'bob');
    expect(handed.session.driverId).toBe('bob');
    await Promise.all([
      a.conn.waitFor((s) => s.session.driverId === 'bob'),
      b.conn.waitFor((s) => s.session.driverId === 'bob'),
    ]);
    expect(b.conn.state?.participants.find((p) => p.userId === 'bob')?.role).toBe('driver');
    expect(a.conn.state?.participants.find((p) => p.userId === 'alice')?.role).toBe('viewer');

    const err = await a.client.run('acme', id, 'templates.list').catch((e: ControlPlaneError) => e);
    expect((err as ControlPlaneError).code).toBe('NOT_SESSION_DRIVER');

    const second = await b.client.run('acme', id, 'templates.list');
    expect(second.job.requestedBy).toBe('bob');
    await Promise.all([a.conn.waitFor(finished(second.job.id), 60_000), b.conn.waitFor(finished(second.job.id), 60_000)]);
    const seq = Math.max(a.conn.state!.seq, b.conn.state!.seq);
    await Promise.all([a.conn.waitForSeq(seq), b.conn.waitForSeq(seq)]);

    expect(a.conn.state?.runs.map((r) => [r.commandId, r.requestedBy, r.status])).toEqual([
      ['commands.list', 'alice', 'succeeded'],
      ['templates.list', 'bob', 'succeeded'],
    ]);
    expect({ ...a.conn.state, online: [] }).toEqual({ ...b.conn.state, online: [] });
    // Control can be handed back, and the owner can always reclaim it.
    await b.client.handover('acme', id, 'alice');
    await a.conn.waitFor((s) => s.session.driverId === 'alice');
    await a.client.handover('acme', id, 'bob');
    await b.conn.waitFor((s) => s.session.driverId === 'bob');
  }, 120_000);

  it("records a failing command's non-zero exit and the CLI's error envelope for everyone", async () => {
    h = await startHarness({ seed: SEED });
    await startWorker(h);
    const id = (await api('alice').createSession('acme', { workspaceId: 'plain' })).session.id;
    const a = await participant('alice', id);
    const b = await participant('bob', id);
    const { job } = await a.client.run('acme', id, 'workspace.summary');
    await Promise.all([a.conn.waitFor(finished(job.id), 60_000), b.conn.waitFor(finished(job.id), 60_000)]);
    for (const conn of [a.conn, b.conn]) {
      const run = conn.state!.runs[0];
      expect(run).toMatchObject({ status: 'failed', exitCode: 1 });
      expect(JSON.parse(runOutputText(run))).toMatchObject({ ok: false, error: { code: 'NOT_IN_MONOREPO' } });
    }
    // The session is free again for the next command.
    expect(currentRun(a.conn.state!)).toBeUndefined();
    const next = await a.client.run('acme', id, 'commands.list');
    expect(next.job.status).toBe('queued');
  }, 90_000);

  it('gives a late joiner the full history as a snapshot, then live events', async () => {
    h = await startHarness({ seed: SEED });
    await startWorker(h);
    const id = (await api('alice').createSession('acme', { workspaceId: 'demo' })).session.id;
    const a = await participant('alice', id);
    const r1 = await a.client.run('acme', id, 'commands.list');
    await a.conn.waitFor(finished(r1.job.id), 60_000);
    const r2 = await a.client.run('acme', id, 'templates.list');
    await a.conn.waitFor(finished(r2.job.id), 60_000);

    const late = await participant('carol', id);
    const snapshotRuns = late.conn.state!.runs;
    expect(snapshotRuns.map((r) => [r.commandId, r.status])).toEqual([
      ['commands.list', 'succeeded'],
      ['templates.list', 'succeeded'],
    ]);
    expect(JSON.parse(runOutputText(snapshotRuns[0])).ok).toBe(true);
    expect(snapshotRuns[1].output.length).toBeGreaterThan(0);
    // ...then incremental events while connected.
    const r3 = await a.client.handover('acme', id, 'carol');
    expect(r3.session.driverId).toBe('carol');
    await late.conn.waitFor((s) => s.session.driverId === 'carol');
    const r4 = await late.client.run('acme', id, 'commands.list');
    await Promise.all([a.conn.waitFor(finished(r4.job.id), 60_000), late.conn.waitFor(finished(r4.job.id), 60_000)]);
    const seq = Math.max(a.conn.state!.seq, late.conn.state!.seq);
    await Promise.all([a.conn.waitForSeq(seq), late.conn.waitForSeq(seq)]);
    expect({ ...a.conn.state, online: [] }).toEqual({ ...late.conn.state, online: [] });
    // Exactly one snapshot, and the first live event follows it with no gap or overlap.
    expect(late.snapshotSeqs).toHaveLength(1);
    expect(late.events[0].seq).toBe(late.snapshotSeqs[0] + 1);
    expect(late.events.map((e) => e.seq)).toEqual(late.events.map((_, i) => late.snapshotSeqs[0] + 1 + i));
  }, 120_000);

  it('a run queued before a server restart completes afterwards and is logged in order', async () => {
    const dbFile = path.join(tmp, 'restart.db');
    h = await startHarness({ seed: SEED, dbFile });
    const keyRing = h.keyRing;
    const id = (await api('alice').createSession('acme', { workspaceId: 'demo' })).session.id;
    const queued = await api('alice').run('acme', id, 'commands.list'); // no worker yet: it stays queued
    expect(queued.job.status).toBe('queued');
    expect((await api('alice').getSession('acme', id)).runs[0].status).toBe('queued');
    await h.close();

    h = await startHarness({ dbFile, keyRing });
    await startWorker(h);
    const a = await participant('alice', id, false);
    await a.conn.waitFor(finished(queued.job.id), 60_000, 'the run finishes after the restart');
    const run = a.conn.state!.runs[0];
    expect(run).toMatchObject({ status: 'succeeded', exitCode: 0 });
    expect(JSON.parse(runOutputText(run)).ok).toBe(true);
    const log = await a.client.events('acme', id, 0, 500);
    expect(log.events.map((e) => e.seq)).toEqual(log.events.map((_, i) => i + 1));
    const types = log.events.map((e) => e.type);
    expect(types.indexOf('command.queued')).toBeLessThan(types.indexOf('command.started'));
    expect(types.indexOf('command.started')).toBeLessThan(types.lastIndexOf('command.output'));
    expect(types[types.length - 1]).toBe('command.finished');
  }, 90_000);
});

