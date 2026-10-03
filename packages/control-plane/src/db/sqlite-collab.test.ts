import { describe, expect, it } from 'vitest';

import { EventBus } from '../events.js';
import { CollabHub, type StreamListener } from '../collab-hub.js';
import { migrate } from './migrations.js';
import {
  MAX_DOCS_PER_SESSION,
  MAX_PARTICIPANTS_PER_SESSION,
  MAX_SESSION_EVENTS,
  SqliteCollabStore,
} from './sqlite-collab.js';
import { SqliteJobStore } from './sqlite-jobs.js';
import { SqliteTenantStore } from './sqlite-store.js';
import { openDatabase } from './sqlite.js';

/**
 * The collaboration store against a real in-memory SQLite database: invariants
 * that the HTTP suites reach only indirectly (limits, the console bridge's edge
 * cases, schema-level isolation) and the live hub that sits on top of it.
 */

function setup() {
  const db = openDatabase(':memory:');
  migrate(db);
  SqliteTenantStore.fromSnapshot(db, {
    tenants: [
      { id: 'acme', name: 'Acme', allowedCommandIds: ['doctor'] },
      { id: 'globex', name: 'Globex', allowedCommandIds: ['doctor'] },
    ],
    workspaces: [
      { id: 'main', tenantId: 'acme', name: 'Main', allowedCommandIds: ['doctor'] },
      { id: 'main', tenantId: 'globex', name: 'Main', allowedCommandIds: ['doctor'] },
    ],
    members: [],
  });
  const collab = new SqliteCollabStore(db);
  const jobs = new SqliteJobStore(db);
  const newSession = (tenantId = 'acme', owner = 'alice') => {
    const created = collab.createSession({ tenantId, workspaceId: 'main', title: 'T', ownerId: owner, now: 1000, maxActive: 100 });
    if (!created.ok) throw new Error(created.message);
    return created.value;
  };
  const newRun = (tenantId: string, sessionId: string, now = 2000) => {
    const job = jobs.enqueue({ tenantId, workspaceId: 'main', commandId: 'doctor', params: {}, requestedBy: 'alice', now, maxQueued: 10 });
    if (!job) throw new Error('queue full');
    const started = collab.startRun(tenantId, sessionId, job, now);
    if (!started.ok) throw new Error(started.message);
    return job;
  };
  return { db, collab, jobs, newSession, newRun };
}

describe('schema and isolation', () => {
  it('creates the collaboration tables and refuses cross-wired rows', () => {
    const { db, newSession } = setup();
    const s = newSession('acme');
    // A participant row must reference a session of the SAME tenant.
    expect(() =>
      db
        .prepare('INSERT INTO collab_participants (tenant_id, session_id, user_id, joined_at) VALUES (?, ?, ?, ?)')
        .run('globex', s.id, 'mallory', 1)
    ).toThrow(/FOREIGN KEY/i);
    // A session may only point at a workspace of its own tenant.
    expect(() =>
      db
        .prepare("INSERT INTO collab_sessions (tenant_id, id, workspace_id, title, owner_id, status, created_at) VALUES ('acme', 'x', 'nope', 't', 'o', 'active', 1)")
        .run()
    ).toThrow(/FOREIGN KEY/i);
  });

  it('never resolves a session, its events, documents or runs under another tenant', () => {
    const { collab, newSession, newRun } = setup();
    const s = newSession('acme');
    newRun('acme', s.id);
    expect(collab.getSession('globex', s.id)).toBeUndefined();
    expect(collab.snapshot('globex', s.id)).toBeUndefined();
    expect(collab.eventsAfter('globex', s.id, 0, 100)).toEqual([]);
    expect(collab.listDocs('globex', s.id)).toEqual([]);
    expect(collab.getDoc('globex', s.id, 'notes')).toBeUndefined();
    expect(collab.activeRun('globex', s.id)).toBeUndefined();
    expect(collab.listSessions('globex', { limit: 10 })).toEqual([]);
    expect(collab.join('globex', s.id, 'mallory', 5)).toMatchObject({ ok: false, failure: 'SESSION_NOT_FOUND' });
    expect(collab.handover('globex', s.id, 'mallory', 'mallory', 5)).toMatchObject({ ok: false, failure: 'SESSION_NOT_FOUND' });
    expect(collab.applyDocOp('globex', s.id, 'notes', { clientId: 'c', clientSeq: 1, baseRev: 0, ops: ['x'], by: 'mallory', now: 5 })).toMatchObject({
      ok: false,
      failure: 'SESSION_NOT_FOUND',
    });
    expect(collab.analytics({ tenantId: 'globex', from: 0, to: 10_000, now: 5000 }).commands.total).toBe(0);
  });
});

describe('limits', () => {
  it('caps participants and documents per session', () => {
    const { collab, newSession } = setup();
    const s = newSession();
    for (let i = 1; i < MAX_PARTICIPANTS_PER_SESSION; i += 1) {
      expect(collab.join('acme', s.id, `user${i}`, 1100 + i).ok).toBe(true);
    }
    expect(collab.join('acme', s.id, 'one-too-many', 2000)).toMatchObject({ ok: false, failure: 'TOO_MANY' });
    for (let i = 1; i < MAX_DOCS_PER_SESSION; i += 1) {
      expect(collab.createDoc('acme', s.id, { id: `d${i}`, title: 'd', kind: 'text', content: '' }, 'alice', 1100).ok).toBe(true);
    }
    expect(collab.createDoc('acme', s.id, { id: 'extra', title: 'd', kind: 'text', content: '' }, 'alice', 1100)).toMatchObject({ ok: false, failure: 'TOO_MANY' });
    expect(collab.createDoc('acme', s.id, { id: 'd1', title: 'd', kind: 'text', content: '' }, 'alice', 1100)).toMatchObject({ ok: false, failure: 'ALREADY_EXISTS' });
    expect(collab.createDoc('acme', s.id, { id: 'bad', title: 'd', kind: 'text', content: '\ud800' }, 'alice', 1100)).toMatchObject({ ok: false });
  });

  it('refuses new events when a session log is full, but still records a run finishing', () => {
    const { db, collab, jobs, newSession, newRun } = setup();
    const s = newSession();
    const job = newRun('acme', s.id);
    db.prepare('UPDATE collab_sessions SET seq = ? WHERE tenant_id = ? AND id = ?').run(MAX_SESSION_EVENTS, 'acme', s.id);
    expect(collab.join('acme', s.id, 'bob', 3000)).toMatchObject({ ok: false, failure: 'LOG_FULL' });
    expect(collab.applyDocOp('acme', s.id, 'notes', { clientId: 'c', clientSeq: 1, baseRev: 0, ops: ['x'], by: 'alice', now: 3000 })).toMatchObject({ ok: false, failure: 'LOG_FULL' });
    // The failed attempts left the document and sequence untouched (rolled back).
    expect(collab.getDoc('acme', s.id, 'notes')?.rev).toBe(0);
    expect(collab.getSession('acme', s.id)?.seq).toBe(MAX_SESSION_EVENTS);
    // A job that finishes must still be recorded, or the console would be stuck "running" forever.
    jobs.tryClaim('acme', job.id, 'w', 3000, 1000);
    jobs.complete('acme', job.id, 'w', { exitCode: 0 }, 3100);
    const events = collab.pumpRun('acme', s.id, job.id, jobs, 3200);
    expect(events.map((e) => e.type)).toEqual(['command.started', 'command.finished']);
    expect(collab.getRun('acme', s.id, job.id)?.status).toBe('succeeded');
  });

  it('a full log drops a run\'s OUTPUT but never its lifecycle events', () => {
    const { db, collab, jobs, newSession, newRun } = setup();
    const s = newSession();
    const job = newRun('acme', s.id);
    jobs.tryClaim('acme', job.id, 'w', 3000, 1000);
    jobs.appendOutput('acme', job.id, 'w', [{ stream: 'stdout', data: 'lost' }], 3050, 1000);
    jobs.complete('acme', job.id, 'w', { exitCode: 0 }, 3100);
    db.prepare('UPDATE collab_sessions SET seq = ? WHERE tenant_id = ? AND id = ?').run(MAX_SESSION_EVENTS, 'acme', s.id);
    const events = collab.pumpRun('acme', s.id, job.id, jobs, 3200);
    expect(events.map((e) => e.type)).toEqual(['command.started', 'command.finished']);
    expect(collab.getRun('acme', s.id, job.id)).toMatchObject({ status: 'succeeded', forwardedSeq: 1 });
  });

  it('refuses a stale or future base revision and an op over the document', () => {
    const { db, collab, newSession } = setup();
    const s = newSession();
    const send = (baseRev: number, ops: Array<string | number>) =>
      collab.applyDocOp('acme', s.id, 'notes', { clientId: 'c', clientSeq: Math.random() * 1e9, baseRev, ops, by: 'alice', now: 1 });
    expect(send(5, ['x'])).toMatchObject({ ok: false, failure: 'FUTURE_BASE' });
    expect(send(0, [3])).toMatchObject({ ok: false, failure: 'INVALID_OP' });
    db.prepare("UPDATE collab_docs SET rev = 20000 WHERE tenant_id = 'acme' AND id = 'notes'").run();
    expect(send(0, ['x'])).toMatchObject({ ok: false, failure: 'STALE_BASE' });
  });
});

describe('the console bridge (pumpRun)', () => {
  it('logs queued -> started -> output -> finished exactly once, in order, however often it is pumped', () => {
    const { collab, jobs, newSession, newRun } = setup();
    const s = newSession();
    const job = newRun('acme', s.id);
    expect(collab.pumpRun('acme', s.id, job.id, jobs, 2100)).toEqual([]); // still queued
    jobs.tryClaim('acme', job.id, 'w1', 2200, 1000);
    jobs.appendOutput('acme', job.id, 'w1', [{ stream: 'stdout', data: 'a' }, { stream: 'stderr', data: 'b' }], 2300, 1000);
    const first = collab.pumpRun('acme', s.id, job.id, jobs, 2400);
    expect(first.map((e) => e.type)).toEqual(['command.started', 'command.output', 'command.output']);
    expect(collab.pumpRun('acme', s.id, job.id, jobs, 2500)).toEqual([]); // nothing new
    jobs.appendOutput('acme', job.id, 'w1', [{ stream: 'stdout', data: 'c' }], 2600, 1000);
    jobs.complete('acme', job.id, 'w1', { exitCode: 3 }, 2700);
    const rest = collab.pumpRun('acme', s.id, job.id, jobs, 2800);
    expect(rest.map((e) => e.type)).toEqual(['command.output', 'command.finished']);
    expect(rest[1].data).toMatchObject({ status: 'failed', exitCode: 3 });
    expect(collab.pumpRun('acme', s.id, job.id, jobs, 2900)).toEqual([]); // finished runs are inert
    const seqs = collab.eventsAfter('acme', s.id, 0, 100).map((e) => e.seq);
    expect(seqs).toEqual(seqs.map((_, i) => i + 1));
    expect(collab.activeRun('acme', s.id)).toBeUndefined();
  });

  it('a job that failed or was canceled while queued never "started"', () => {
    const { collab, jobs, newSession, newRun } = setup();
    const s = newSession();
    const job = newRun('acme', s.id);
    jobs.failQueued('acme', job.id, 'COMMAND_NOT_ALLOWED', 'policy changed', 2100);
    const events = collab.pumpRun('acme', s.id, job.id, jobs, 2200);
    expect(events.map((e) => e.type)).toEqual(['command.finished']);
    expect(events[0].data).toMatchObject({ status: 'failed', errorCode: 'COMMAND_NOT_ALLOWED' });
    expect(collab.getRun('acme', s.id, job.id)).toMatchObject({ status: 'failed', startedAt: null });
  });

  it('a job that finishes between pumps still yields started, its output and finished', () => {
    const { collab, jobs, newSession, newRun } = setup();
    const s = newSession();
    const job = newRun('acme', s.id);
    jobs.tryClaim('acme', job.id, 'w', 2100, 1000);
    jobs.appendOutput('acme', job.id, 'w', [{ stream: 'stdout', data: 'x' }], 2200, 1000);
    jobs.complete('acme', job.id, 'w', { exitCode: 0 }, 2300);
    expect(collab.pumpRun('acme', s.id, job.id, jobs, 2400).map((e) => e.type)).toEqual([
      'command.started',
      'command.output',
      'command.finished',
    ]);
  });

  it('bounds snapshot output to a budget, keeping the newest chunks and flagging what was dropped', () => {
    const { collab, jobs, newSession, newRun } = setup();
    const s = newSession();
    const job = newRun('acme', s.id);
    jobs.tryClaim('acme', job.id, 'w', 2100, 1000);
    jobs.appendOutput('acme', job.id, 'w', ['aaaa', 'bbbb', 'cccc'].map((data) => ({ stream: 'stdout' as const, data })), 2200, 1000);
    jobs.complete('acme', job.id, 'w', { exitCode: 0 }, 2300);
    collab.pumpRun('acme', s.id, job.id, jobs, 2400);
    const full = collab.snapshot('acme', s.id);
    expect(full?.runs[0].output.map((c) => c.data)).toEqual(['aaaa', 'bbbb', 'cccc']);
    expect(full?.runs[0].outputDropped).toBeUndefined();
    const small = collab.snapshot('acme', s.id, 9);
    expect(small?.runs[0].output.map((c) => c.data)).toEqual(['bbbb', 'cccc']);
    expect(small?.runs[0].outputDropped).toBe(true);
  });

  it('finds open runs after a restart and maps a job back to its run', () => {
    const { collab, newSession, newRun } = setup();
    const s = newSession();
    const job = newRun('acme', s.id);
    expect(collab.openRuns().map((r) => r.jobId)).toEqual([job.id]);
    expect(collab.runForJob('acme', job.id)?.sessionId).toBe(s.id);
    expect(collab.runForJob('globex', job.id)).toBeUndefined();
  });
});

describe('CollabHub', () => {
  function listener(userId: string) {
    const got = { snapshots: [] as unknown[], events: [] as Array<{ seq: number; type: string }>, ready: [] as number[], presence: [] as string[][], signals: [] as unknown[], relays: [] as unknown[] };
    const l: StreamListener = {
      userId,
      snapshot: (s) => got.snapshots.push(s),
      event: (e) => got.events.push({ seq: e.seq, type: e.type }),
      ready: (seq) => got.ready.push(seq),
      presence: (online) => got.presence.push(online),
      signal: (s) => got.signals.push(s),
      relay: (m) => got.relays.push(m),
    };
    return { l, got };
  }

  it('catches a connecting stream up (snapshot or exact replay) and broadcasts presence', () => {
    const { collab, jobs, newSession } = setup();
    const hub = new CollabHub({ store: collab, jobs, events: new EventBus() });
    const s = newSession();
    collab.join('acme', s.id, 'bob', 1500);
    const a = listener('alice');
    const connA = hub.connect('acme', s.id, a.l);
    expect(connA.ok).toBe(true);
    expect(a.got.snapshots).toHaveLength(1);
    expect(a.got.ready).toEqual([4]);
    expect(hub.online('acme', s.id)).toEqual(['alice']);

    const b = listener('bob');
    const connB = hub.connect('acme', s.id, b.l, 3); // resume: only event 4
    expect(b.got.snapshots).toHaveLength(0);
    expect(b.got.events).toEqual([{ seq: 4, type: 'participant.joined' }]);
    expect(a.got.presence[a.got.presence.length - 1]).toEqual(['alice', 'bob']);

    // A cursor from the future gets a snapshot, not a hole.
    const c = listener('alice');
    hub.connect('acme', s.id, c.l, 99);
    expect(c.got.snapshots).toHaveLength(1);

    if (connB.ok) connB.close();
    expect(a.got.presence[a.got.presence.length - 1]).toEqual(['alice']);
    expect(hub.connect('acme', '00000000-0000-4000-8000-000000000000', a.l)).toEqual({ ok: false, code: 'SESSION_NOT_FOUND' });
    expect(hub.connect('globex', s.id, a.l)).toEqual({ ok: false, code: 'SESSION_NOT_FOUND' });
    hub.close();
  });

  it('survives a throwing listener and delivers signals only to the addressee', () => {
    const { collab, jobs, newSession } = setup();
    const hub = new CollabHub({ store: collab, jobs, events: new EventBus() });
    const s = newSession();
    const broken: StreamListener = {
      userId: 'bob',
      snapshot: () => undefined,
      event: () => {
        throw new Error('socket gone');
      },
      ready: () => undefined,
      presence: () => {
        throw new Error('socket gone');
      },
      signal: () => {
        throw new Error('socket gone');
      },
      relay: () => {
        throw new Error('socket gone');
      },
    };
    const a = listener('alice');
    hub.connect('acme', s.id, a.l);
    hub.connect('acme', s.id, broken);
    hub.publish('acme', s.id, [{ seq: 99, type: 'x', ts: 1, actor: null, data: {} }]);
    expect(a.got.events.map((e) => e.seq)).toEqual([99]);
    expect(hub.signal('acme', s.id, { from: 'alice', to: 'bob', kind: 'offer', connectionId: 'c', payload: {}, ts: 1 })).toBe(false); // bob's socket threw
    expect(hub.signal('acme', s.id, { from: 'bob', to: 'alice', kind: 'offer', connectionId: 'c', payload: {}, ts: 1 })).toBe(true);
    expect(hub.relay('acme', s.id, { from: 'bob', to: null, channel: 'ping', payload: {}, ts: 1 })).toBe(1);
    hub.close();
  });

  it('follows a run from job events and recovers runs left open by a restart', () => {
    const { collab, jobs, newSession, newRun } = setup();
    const bus = new EventBus();
    const hub = new CollabHub({ store: collab, jobs, events: bus, pollMs: 20 });
    const s = newSession();
    const a = listener('alice');
    hub.connect('acme', s.id, a.l);
    const job = newRun('acme', s.id);
    hub.trackRun('acme', s.id, job.id);
    expect(hub.trackedRuns).toBe(1);

    jobs.tryClaim('acme', job.id, 'w', 3000, 1000);
    jobs.appendOutput('acme', job.id, 'w', [{ stream: 'stdout', data: 'hi' }], 3100, 1000);
    bus.publish({ type: 'job.output', tenantId: 'acme', jobId: job.id });
    expect(a.got.events.map((e) => e.type).slice(-2)).toEqual(['command.started', 'command.output']);
    // Activity for another tenant's job id is ignored.
    bus.publish({ type: 'job.output', tenantId: 'globex', jobId: job.id });
    jobs.complete('acme', job.id, 'w', { exitCode: 0 }, 3200);
    bus.publish({ type: 'job.updated', tenantId: 'acme', job: { id: job.id, workspaceId: 'main', commandId: 'doctor', status: 'succeeded', exitCode: 0 } });
    expect(a.got.events[a.got.events.length - 1].type).toBe('command.finished');
    expect(hub.trackedRuns).toBe(0);
    hub.close();

    // "Restart": a new hub finds a run that was queued when the old process stopped.
    const orphan = newRun('acme', s.id, 4000);
    const fresh = new CollabHub({ store: collab, jobs, events: new EventBus() });
    expect(fresh.recover()).toBe(1);
    expect(fresh.trackedRuns).toBe(1);
    jobs.tryClaim('acme', orphan.id, 'w2', 4100, 1000);
    jobs.complete('acme', orphan.id, 'w2', { exitCode: 0 }, 4200);
    fresh.pump('acme', s.id, orphan.id);
    expect(collab.getRun('acme', s.id, orphan.id)?.status).toBe('succeeded');
    expect(fresh.trackedRuns).toBe(0);
    fresh.close();
  });

  it('polls as a safety net when no wake-up event arrives', async () => {
    const { collab, jobs, newSession, newRun } = setup();
    const hub = new CollabHub({ store: collab, jobs, events: new EventBus(), pollMs: 20 });
    const s = newSession();
    const job = newRun('acme', s.id);
    hub.trackRun('acme', s.id, job.id);
    jobs.tryClaim('acme', job.id, 'w', 3000, 1000);
    jobs.complete('acme', job.id, 'w', { exitCode: 0 }, 3100);
    await new Promise((r) => setTimeout(r, 120));
    expect(collab.getRun('acme', s.id, job.id)?.status).toBe('succeeded');
    expect(hub.trackedRuns).toBe(0);
    hub.close();
  });
});
