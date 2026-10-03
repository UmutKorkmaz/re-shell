import { applyCollabEvent, foldCollabEvents, collabEventSchema, type CollabEvent, type CollabSnapshot } from '@re-shell/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EventTap } from './test-support/event-tap.js';
import { startHarness, type Harness } from './test-support/harness.js';

/**
 * Collaboration over the real HTTP edge, real SQLite and real JWTs. No worker is
 * attached here, so commands stay queued; the worker + real CLI path is covered
 * by e2e/collab.e2e.test.ts.
 */

const COMMANDS = ['workspace.summary', 'doctor', 'commands.list'];

const SEED = {
  tenants: [
    { id: 'acme', name: 'Acme', allowedCommandIds: COMMANDS },
    { id: 'globex', name: 'Globex', allowedCommandIds: COMMANDS },
  ],
  workspaces: [
    { id: 'main', tenantId: 'acme', name: 'Main', allowedCommandIds: ['workspace.summary', 'doctor'] },
    { id: 'other', tenantId: 'acme', name: 'Other', allowedCommandIds: COMMANDS },
    { id: 'secret', tenantId: 'globex', name: 'Secret', allowedCommandIds: COMMANDS },
  ],
  members: [
    { tenantId: 'acme', userId: 'alice', role: 'admin' },
    { tenantId: 'acme', userId: 'bob', role: 'operator' },
    { tenantId: 'acme', userId: 'carol', role: 'operator' },
    { tenantId: 'acme', userId: 'vera', role: 'viewer' },
    { tenantId: 'globex', userId: 'gina', role: 'admin' },
    { tenantId: 'globex', userId: 'greg', role: 'operator' },
  ],
};

let h: Harness;

beforeEach(async () => {
  h = await startHarness({ seed: SEED });
});

afterEach(async () => {
  await h.close();
});

const as = (user: string) => h.userToken(user);
const post = (user: string, path: string, body: unknown = {}) =>
  h.request('POST', path, { token: as(user), body });
const get = (user: string, path: string) => h.request('GET', path, { token: as(user) });

async function startSession(user = 'alice', workspaceId = 'main'): Promise<CollabSnapshot> {
  const res = await post(user, '/tenants/acme/sessions', { workspaceId, title: 'Pairing' });
  expect(res.status).toBe(201);
  return res.json.data.session as CollabSnapshot;
}

describe('session lifecycle', () => {
  it('creates a session owned and driven by its creator with a notes document', async () => {
    const session = await startSession('alice');
    expect(session.session).toMatchObject({
      tenantId: 'acme',
      workspaceId: 'main',
      title: 'Pairing',
      ownerId: 'alice',
      driverId: 'alice',
      status: 'active',
    });
    expect(session.participants).toEqual([{ userId: 'alice', role: 'driver', joinedAt: expect.any(Number) }]);
    expect(session.docs).toEqual([{ id: 'notes', title: 'Runbook / notes', kind: 'notes', rev: 0, content: '' }]);
    expect(session.runs).toEqual([]);
    expect(session.currentJobId).toBeNull();
    expect(session.seq).toBe(3);
    expect(session.rtc).toEqual({ iceServers: [] });
  });

  it('lists sessions with participant counts and filters', async () => {
    const a = await startSession('alice', 'main');
    await startSession('bob', 'other');
    await post('carol', `/tenants/acme/sessions/${a.session.id}/join`);
    const all = await get('bob', '/tenants/acme/sessions');
    expect(all.status).toBe(200);
    expect(all.json.data.sessions).toHaveLength(2);
    const main = await get('bob', '/tenants/acme/sessions?workspaceId=main');
    expect(main.json.data.sessions).toHaveLength(1);
    expect(main.json.data.sessions[0]).toMatchObject({ id: a.session.id, participantCount: 2, onlineCount: 0, runCount: 0 });
    const ended = await get('bob', '/tenants/acme/sessions?status=ended');
    expect(ended.json.data.sessions).toHaveLength(0);
    expect((await get('bob', '/tenants/acme/sessions?bogus=1')).status).toBe(400);
  });

  it('join is idempotent, makes the joiner a viewer, and leave hands control back to the owner', async () => {
    const s = await startSession('alice');
    const id = s.session.id;
    const joined = await post('bob', `/tenants/acme/sessions/${id}/join`);
    expect(joined.status).toBe(200);
    expect(joined.json.data.session.participants.map((p: { userId: string; role: string }) => [p.userId, p.role])).toEqual([
      ['alice', 'driver'],
      ['bob', 'viewer'],
    ]);
    const again = await post('bob', `/tenants/acme/sessions/${id}/join`);
    expect(again.json.data.session.seq).toBe(joined.json.data.session.seq);

    // alice hands control to bob; when bob leaves, control returns to alice (the owner).
    expect((await post('alice', `/tenants/acme/sessions/${id}/handover`, { toUserId: 'bob' })).status).toBe(200);
    const left = await post('bob', `/tenants/acme/sessions/${id}/leave`);
    expect(left.json.data.session.session.driverId).toBe('alice');
    expect(left.json.data.session.participants.map((p: { userId: string }) => p.userId)).toEqual(['alice']);

    // A participant can rejoin.
    const rejoined = await post('bob', `/tenants/acme/sessions/${id}/join`);
    expect(rejoined.json.data.session.participants).toHaveLength(2);
  });

  it('the log is the state: snapshot equals the fold of every event', async () => {
    const s = await startSession('alice');
    const id = s.session.id;
    await post('bob', `/tenants/acme/sessions/${id}/join`);
    await post('alice', `/tenants/acme/sessions/${id}/handover`, { toUserId: 'bob' });
    await post('bob', `/tenants/acme/sessions/${id}/docs/notes/ops`, {
      clientId: 'c1',
      clientSeq: 1,
      baseRev: 0,
      ops: ['hello'],
    });
    await post('bob', `/tenants/acme/sessions/${id}/docs`, { docId: 'draft', title: 'Draft', kind: 'yaml-draft', content: 'a: 1\n' });
    await post('bob', `/tenants/acme/sessions/${id}/leave`);
    const events = (await get('alice', `/tenants/acme/sessions/${id}/events?afterSeq=0&limit=500`)).json.data.events;
    const parsed = events.map((e: unknown) => collabEventSchema.parse(e)) as CollabEvent[];
    expect(parsed.map((e) => e.seq)).toEqual(parsed.map((_, i) => i + 1));
    const folded = foldCollabEvents(parsed);
    const snapshot = (await get('alice', `/tenants/acme/sessions/${id}`)).json.data.session as CollabSnapshot;
    expect({ ...snapshot, online: [], rtc: { iceServers: [] } }).toEqual(folded);
    expect(snapshot.docs.find((d) => d.id === 'notes')).toMatchObject({ content: 'hello', rev: 1 });
  });

  it('only the owner or a tenant admin can end a session', async () => {
    const s = await startSession('bob');
    const id = s.session.id;
    await post('carol', `/tenants/acme/sessions/${id}/join`);
    const denied = await post('carol', `/tenants/acme/sessions/${id}/end`);
    expect(denied.status).toBe(403);
    expect(denied.json.error.code).toBe('FORBIDDEN');
    const byAdmin = await post('alice', `/tenants/acme/sessions/${id}/end`, { reason: 'done' });
    expect(byAdmin.status).toBe(200);
    expect(byAdmin.json.data.session.session).toMatchObject({ status: 'ended' });
    expect((await post('carol', `/tenants/acme/sessions/${id}/join`)).json.error.code).toBe('SESSION_ENDED');
    expect((await post('bob', `/tenants/acme/sessions/${id}/end`)).json.error.code).toBe('SESSION_ENDED');
    // Ended sessions stay readable.
    expect((await get('carol', `/tenants/acme/sessions/${id}`)).status).toBe(200);
  });

  it('viewers (tenant role) cannot create, join or read sessions', async () => {
    const s = await startSession('alice');
    for (const res of [
      await post('vera', '/tenants/acme/sessions', { workspaceId: 'main' }),
      await post('vera', `/tenants/acme/sessions/${s.session.id}/join`),
      await get('vera', `/tenants/acme/sessions/${s.session.id}`),
      await get('vera', '/tenants/acme/sessions'),
      await get('vera', '/tenants/acme/analytics'),
    ]) {
      expect(res.status).toBe(403);
      expect(res.json.error.code).toBe('FORBIDDEN');
    }
  });

  it('refuses unknown workspaces and bodies that repeat server fields', async () => {
    expect((await post('alice', '/tenants/acme/sessions', { workspaceId: 'nope' })).json.error.code).toBe('WORKSPACE_NOT_FOUND');
    expect((await post('alice', '/tenants/acme/sessions', { workspaceId: 'secret' })).json.error.code).toBe('WORKSPACE_NOT_FOUND');
    expect((await post('alice', '/tenants/acme/sessions', { workspaceId: 'main', tenantId: 'x' })).status).toBe(400);
    expect((await post('alice', '/tenants/acme/sessions', { workspaceId: 'main', extra: 1 })).status).toBe(400);
  });

  it('limits active sessions per tenant', async () => {
    await h.close();
    h = await startHarness({ seed: SEED, limits: { maxActiveSessionsPerTenant: 2 } });
    await startSession('alice');
    await startSession('alice');
    const third = await post('alice', '/tenants/acme/sessions', { workspaceId: 'main' });
    expect(third.status).toBe(429);
    expect(third.json.error.code).toBe('RATE_LIMITED');
  });
});

describe('driver control', () => {
  it('only the driver can run commands; a viewer participant is refused and audited', async () => {
    const s = await startSession('alice');
    const id = s.session.id;
    await post('bob', `/tenants/acme/sessions/${id}/join`);

    const denied = await post('bob', `/tenants/acme/sessions/${id}/run`, { commandId: 'workspace.summary' });
    expect(denied.status).toBe(403);
    expect(denied.json.error.code).toBe('NOT_SESSION_DRIVER');

    const ran = await post('alice', `/tenants/acme/sessions/${id}/run`, { commandId: 'workspace.summary' });
    expect(ran.status).toBe(202);
    expect(ran.json.data.job).toMatchObject({ status: 'queued', requestedBy: 'alice', workspaceId: 'main' });

    const audit = (await get('alice', '/tenants/acme/audit?action=session.run&limit=50')).json.data.entries;
    expect(audit.map((e: { userId: string; decision: string; code: string | null }) => [e.userId, e.decision, e.code]).sort()).toEqual([
      ['alice', 'allow', null],
      ['bob', 'deny', 'NOT_SESSION_DRIVER'],
    ]);
  });

  it('applies the workspace allow-list through the ordinary job path', async () => {
    const s = await startSession('alice', 'main');
    const res = await post('alice', `/tenants/acme/sessions/${s.session.id}/run`, { commandId: 'commands.list' });
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe('COMMAND_NOT_ALLOWED');
    const unknown = await post('alice', `/tenants/acme/sessions/${s.session.id}/run`, { commandId: 'rm-rf' });
    expect(unknown.status).toBe(400);
    const bad = await post('alice', `/tenants/acme/sessions/${s.session.id}/run`, {
      commandId: 'workspace.summary',
      params: { evil: true },
    });
    expect(bad.status).toBe(400);
    // Nothing was linked to the session.
    const snap = (await get('alice', `/tenants/acme/sessions/${s.session.id}`)).json.data.session;
    expect(snap.runs).toEqual([]);
  });

  it('allows one command at a time and lets the driver cancel it', async () => {
    const s = await startSession('alice');
    const id = s.session.id;
    const first = await post('alice', `/tenants/acme/sessions/${id}/run`, { commandId: 'workspace.summary' });
    expect(first.status).toBe(202);
    const second = await post('alice', `/tenants/acme/sessions/${id}/run`, { commandId: 'doctor' });
    expect(second.status).toBe(409);
    expect(second.json.error.code).toBe('SESSION_BUSY');
    expect((await post('alice', `/tenants/acme/sessions/${id}/end`)).json.error.code).toBe('SESSION_BUSY');

    const canceled = await post('alice', `/tenants/acme/sessions/${id}/cancel`);
    expect(canceled.status).toBe(200);
    expect(canceled.json.data.job.status).toBe('canceled');
    // The bridge logged the final state.
    const snap = (await get('alice', `/tenants/acme/sessions/${id}`)).json.data.session as CollabSnapshot;
    expect(snap.runs[0]).toMatchObject({ status: 'canceled', startedAt: null });
    expect(snap.currentJobId).toBeNull();
    expect((await post('alice', `/tenants/acme/sessions/${id}/cancel`)).json.error.code).toBe('CONFLICT');
    expect((await post('alice', `/tenants/acme/sessions/${id}/run`, { commandId: 'doctor' })).status).toBe(202);
  });

  it('hands over control to a joined operator and revokes the previous driver', async () => {
    const s = await startSession('alice');
    const id = s.session.id;
    await post('bob', `/tenants/acme/sessions/${id}/join`);
    await post('vera', `/tenants/acme/sessions/${id}/join`); // refused: viewer role

    // Not joined yet / not an operator.
    expect((await post('alice', `/tenants/acme/sessions/${id}/handover`, { toUserId: 'carol' })).json.error.code).toBe('PARTICIPANT_NOT_FOUND');
    expect((await post('alice', `/tenants/acme/sessions/${id}/handover`, { toUserId: 'vera' })).json.error.code).toBe('PARTICIPANT_NOT_FOUND');
    // A non-driver, non-owner cannot hand over.
    expect((await post('bob', `/tenants/acme/sessions/${id}/handover`, { toUserId: 'bob' })).json.error.code).toBe('NOT_SESSION_DRIVER');

    const handed = await post('alice', `/tenants/acme/sessions/${id}/handover`, { toUserId: 'bob' });
    expect(handed.status).toBe(200);
    expect(handed.json.data.session.session.driverId).toBe('bob');
    expect(handed.json.data.session.participants.map((p: { userId: string; role: string }) => [p.userId, p.role])).toEqual([
      ['alice', 'viewer'],
      ['bob', 'driver'],
    ]);
    expect((await post('alice', `/tenants/acme/sessions/${id}/run`, { commandId: 'doctor' })).json.error.code).toBe('NOT_SESSION_DRIVER');
    expect((await post('bob', `/tenants/acme/sessions/${id}/run`, { commandId: 'doctor' })).status).toBe(202);
    // The owner can always take control back (escape hatch for a driver who went away).
    expect((await post('alice', `/tenants/acme/sessions/${id}/handover`, { toUserId: 'alice' })).status).toBe(200);
  });

  it('refuses a handover to a user demoted since joining', async () => {
    const s = await startSession('alice');
    const id = s.session.id;
    await post('carol', `/tenants/acme/sessions/${id}/join`);
    h.store.setMember('acme', 'carol', 'viewer');
    const res = await post('alice', `/tenants/acme/sessions/${id}/handover`, { toUserId: 'carol' });
    expect(res.status).toBe(403);
  });
});

describe('streaming: snapshot, incremental events, resume, presence', () => {
  it('gives a late joiner a full snapshot, then live ordered events; both see the same log', async () => {
    const s = await startSession('alice');
    const id = s.session.id;
    const aliceTap = await EventTap.open(`${h.url}/tenants/acme/sessions/${id}/stream`, as('alice'));
    await aliceTap.waitForEvent('ready');
    const first = aliceTap.json('snapshot')[0] as CollabSnapshot;
    expect(first.seq).toBe(s.seq);
    expect(first.online).toEqual(['alice']);

    await post('bob', `/tenants/acme/sessions/${id}/join`);
    await post('alice', `/tenants/acme/sessions/${id}/docs/notes/ops`, { clientId: 'a', clientSeq: 1, baseRev: 0, ops: ['x'] });

    // bob arrives late: snapshot already includes everything above.
    const bobTap = await EventTap.open(`${h.url}/tenants/acme/sessions/${id}/stream`, as('bob'));
    await bobTap.waitForEvent('ready');
    const late = bobTap.json('snapshot')[0] as CollabSnapshot;
    expect(late.docs[0]).toMatchObject({ content: 'x', rev: 1 });
    expect(late.participants.map((p) => p.userId)).toEqual(['alice', 'bob']);
    expect(late.online.sort()).toEqual(['alice', 'bob']);

    await post('alice', `/tenants/acme/sessions/${id}/handover`, { toUserId: 'bob' });
    await aliceTap.waitForEvent('control.handover');
    await bobTap.waitForEvent('control.handover');

    const seqs = (tap: EventTap) => tap.messages.filter((m) => m.id !== undefined).map((m) => Number(m.id));
    const aliceSeqs = seqs(aliceTap);
    const bobSeqs = seqs(bobTap);
    expect(aliceSeqs).toEqual([...aliceSeqs].sort((a, b) => a - b));
    expect(aliceSeqs[aliceSeqs.length - 1]).toBe(bobSeqs[bobSeqs.length - 1]);
    // Folding what each saw lands on the same state as the server.
    const final = (await get('alice', `/tenants/acme/sessions/${id}`)).json.data.session as CollabSnapshot;
    for (const tap of [aliceTap, bobTap]) {
      let state = tap.json('snapshot')[0] as CollabSnapshot;
      for (const m of tap.messages) {
        if (m.id !== undefined && m.event !== 'snapshot') {
          state = applyCollabEvent(state, JSON.parse(m.data));
        }
      }
      expect({ ...state, online: [] }).toEqual({ ...final, online: [] });
    }
    aliceTap.close();
    bobTap.close();
  });

  it('resumes from a cursor with exactly the missed events (and a snapshot for an impossible cursor)', async () => {
    const s = await startSession('alice');
    const id = s.session.id;
    const tap = await EventTap.open(`${h.url}/tenants/acme/sessions/${id}/stream`, as('alice'));
    await tap.waitForEvent('ready');
    tap.close();
    await post('bob', `/tenants/acme/sessions/${id}/join`);
    await post('alice', `/tenants/acme/sessions/${id}/handover`, { toUserId: 'bob' });

    const resumed = await EventTap.open(`${h.url}/tenants/acme/sessions/${id}/stream?afterSeq=${s.seq}`, as('alice'));
    await resumed.waitForEvent('ready');
    expect(resumed.of('snapshot')).toHaveLength(0);
    expect(resumed.messages.filter((m) => m.id !== undefined).map((m) => [m.event, Number(m.id)])).toEqual([
      ['participant.joined', s.seq + 1],
      ['control.handover', s.seq + 2],
    ]);
    resumed.close();

    // Last-Event-ID is honoured as well.
    const viaHeader = await EventTap.open(`${h.url}/tenants/acme/sessions/${id}/stream`, as('alice'), String(s.seq + 1));
    await viaHeader.waitForEvent('ready');
    expect(viaHeader.of('control.handover')).toHaveLength(1);
    expect(viaHeader.of('participant.joined')).toHaveLength(0);
    viaHeader.close();

    const future = await EventTap.open(`${h.url}/tenants/acme/sessions/${id}/stream?afterSeq=9999`, as('alice'));
    await future.waitForEvent('ready');
    expect(future.of('snapshot')).toHaveLength(1);
    future.close();
  });

  it('tracks presence by live connections and ends the stream when the session ends', async () => {
    const s = await startSession('alice');
    const id = s.session.id;
    await post('bob', `/tenants/acme/sessions/${id}/join`);
    const aliceTap = await EventTap.open(`${h.url}/tenants/acme/sessions/${id}/stream`, as('alice'));
    await aliceTap.waitForEvent('ready');
    const bobTap = await EventTap.open(`${h.url}/tenants/acme/sessions/${id}/stream`, as('bob'));
    await bobTap.waitForEvent('ready');
    await aliceTap.waitFor((m) => m.some((x) => x.event === 'presence' && JSON.parse(x.data).online.length === 2), 5000, 'both online');
    expect((await get('alice', '/tenants/acme/sessions')).json.data.sessions[0].onlineCount).toBe(2);

    bobTap.close();
    await aliceTap.waitFor(
      (m) => {
        const presence = m.filter((x) => x.event === 'presence');
        return JSON.parse(presence[presence.length - 1].data).online.length === 1;
      },
      5000,
      'bob offline'
    );

    await post('alice', `/tenants/acme/sessions/${id}/end`);
    await aliceTap.waitForEvent('session.ended');
    await aliceTap.waitForEnd();
  });

  it('refuses streams to non-members, viewers and other tenants, and unknown sessions', async () => {
    const s = await startSession('alice');
    const url = `${h.url}/tenants/acme/sessions/${s.session.id}/stream`;
    expect((await EventTap.refused(url, as('vera'))).status).toBe(403);
    expect((await EventTap.refused(url, as('gina'))).status).toBe(403);
    expect((await EventTap.refused(`${h.url}/tenants/acme/sessions/00000000-0000-4000-8000-000000000000/stream`, as('bob'))).status).toBe(404);
    expect((await EventTap.refused(`${h.url}/tenants/acme/sessions/not-a-uuid/stream`, as('bob'))).status).toBe(400);
    expect((await EventTap.refused(url, 'garbage')).status).toBe(401);
  });
});

describe('stream lifecycle', () => {
  it('serves an ended session as history: snapshot, then the stream closes', async () => {
    const s = await startSession('alice');
    await post('alice', `/tenants/acme/sessions/${s.session.id}/end`);
    const tap = await EventTap.open(`${h.url}/tenants/acme/sessions/${s.session.id}/stream`, as('bob'));
    await tap.waitForEvent('ready');
    expect(tap.json('snapshot')[0].session.status).toBe('ended');
    await tap.waitForEnd();
    // Resuming past the end replays session.ended and then also closes.
    const resumed = await EventTap.open(`${h.url}/tenants/acme/sessions/${s.session.id}/stream?afterSeq=${s.seq}`, as('bob'));
    await resumed.waitForEvent('session.ended');
    await resumed.waitForEnd();
  });

  it('ends a user stream the moment their membership is removed or they are demoted below operator', async () => {
    const s = await startSession('alice');
    const id = s.session.id;
    const bob = await EventTap.open(`${h.url}/tenants/acme/sessions/${id}/stream`, as('bob'));
    const carol = await EventTap.open(`${h.url}/tenants/acme/sessions/${id}/stream`, as('carol'));
    await bob.waitForEvent('ready');
    await carol.waitForEvent('ready');
    expect((await h.request('DELETE', '/tenants/acme/members/bob', { token: as('alice') })).status).toBe(200);
    await bob.waitForEvent('revoked');
    await bob.waitForEnd();
    expect((await h.request('PUT', '/tenants/acme/members/carol', { token: as('alice'), body: { role: 'viewer' } })).status).toBe(200);
    await carol.waitForEvent('revoked');
    await carol.waitForEnd();
    // ...and they cannot come back.
    expect((await EventTap.refused(`${h.url}/tenants/acme/sessions/${id}/stream`, as('bob'))).status).toBe(403);
  });
});

describe('input hygiene', () => {
  it('rejects control characters in titles, reasons and document names', async () => {
    const bad = await post('alice', '/tenants/acme/sessions', { workspaceId: 'main', title: 'evil\u001b]0;pwned\u0007' });
    expect(bad.status).toBe(400);
    const s = await startSession('alice');
    expect((await post('alice', `/tenants/acme/sessions/${s.session.id}/docs`, { docId: 'd', title: 'x\u001b[2J' })).status).toBe(400);
    expect((await post('alice', `/tenants/acme/sessions/${s.session.id}/end`, { reason: 'bell\u0007' })).status).toBe(400);
    // Pages are bounded.
    expect((await get('alice', `/tenants/acme/sessions/${s.session.id}/events?limit=501`)).status).toBe(400);
    expect((await get('alice', `/tenants/acme/sessions/${s.session.id}/docs/notes/ops?limit=501`)).status).toBe(400);
  });
});

describe('tenant isolation', () => {
  it('another tenant cannot see, join, read or stream a session — and gets the same 404 as for a missing one', async () => {
    const s = await startSession('alice');
    const id = s.session.id;
    // gina is admin of globex; greg an operator. Neither belongs to acme.
    for (const user of ['gina', 'greg']) {
      for (const [method, path] of [
        ['GET', `/tenants/acme/sessions/${id}`],
        ['POST', `/tenants/acme/sessions/${id}/join`],
        ['GET', `/tenants/acme/sessions/${id}/docs`],
        ['GET', '/tenants/acme/sessions'],
        ['GET', '/tenants/acme/analytics'],
      ] as const) {
        const res = await h.request(method, path, { token: as(user), body: method === 'POST' ? {} : undefined });
        expect(res.status, `${user} ${method} ${path}`).toBe(403);
        expect(res.json.error.code).toBe('FORBIDDEN');
      }
    }
    // Asking about the acme session id UNDER the user's own tenant: indistinguishable from a missing one.
    const crossTenant = await get('greg', `/tenants/globex/sessions/${id}`);
    const missing = await get('greg', '/tenants/globex/sessions/00000000-0000-4000-8000-000000000000');
    expect(crossTenant.status).toBe(404);
    expect(crossTenant.json.error.code).toBe('SESSION_NOT_FOUND');
    expect({ ...crossTenant.json.error, details: undefined }).toEqual({ ...missing.json.error, details: undefined });
    // Their own tenant's session listing never includes acme's.
    expect((await get('greg', '/tenants/globex/sessions')).json.data.sessions).toEqual([]);
  });

  it('never relays signaling across tenants', async () => {
    const acme = await startSession('alice');
    const globex = (await post('gina', '/tenants/globex/sessions', { workspaceId: 'secret' })).json.data.session as CollabSnapshot;
    await post('greg', `/tenants/globex/sessions/${globex.session.id}/join`);
    const greg = await EventTap.open(`${h.url}/tenants/globex/sessions/${globex.session.id}/stream`, as('greg'));
    await greg.waitForEvent('ready');
    // alice tries to address greg through her own session, and through globex's.
    const viaOwn = await post('alice', `/tenants/acme/sessions/${acme.session.id}/signal`, {
      to: 'greg',
      kind: 'offer',
      connectionId: 'c1',
      payload: { sdp: 'x' },
    });
    expect(viaOwn.status).toBe(404);
    expect(viaOwn.json.error.code).toBe('PARTICIPANT_NOT_FOUND');
    const viaTheirs = await post('alice', `/tenants/globex/sessions/${globex.session.id}/signal`, {
      to: 'greg',
      kind: 'offer',
      connectionId: 'c1',
      payload: { sdp: 'x' },
    });
    expect(viaTheirs.status).toBe(403);
    await new Promise((r) => setTimeout(r, 100));
    expect(greg.of('signal')).toHaveLength(0);
    greg.close();
  });
});

describe('WebRTC signaling and relay', () => {
  async function pair() {
    const s = await startSession('alice');
    const id = s.session.id;
    await post('bob', `/tenants/acme/sessions/${id}/join`);
    await post('carol', `/tenants/acme/sessions/${id}/join`);
    const taps = {
      alice: await EventTap.open(`${h.url}/tenants/acme/sessions/${id}/stream`, as('alice')),
      bob: await EventTap.open(`${h.url}/tenants/acme/sessions/${id}/stream`, as('bob')),
      carol: await EventTap.open(`${h.url}/tenants/acme/sessions/${id}/stream`, as('carol')),
    };
    for (const tap of Object.values(taps)) await tap.waitForEvent('ready');
    return { id, taps };
  }

  it('relays offer/answer/candidate to the addressee only, stamping the sender', async () => {
    const { id, taps } = await pair();
    const send = (user: string, body: Record<string, unknown>) =>
      post(user, `/tenants/acme/sessions/${id}/signal`, body);
    const offer = await send('alice', { to: 'bob', kind: 'offer', connectionId: 'conn-1', payload: { sdp: 'v=0 offer' } });
    expect(offer.json.data).toEqual({ delivered: true });
    await taps.bob.waitForEvent('signal');
    expect(taps.bob.json('signal')[0]).toMatchObject({ from: 'alice', to: 'bob', kind: 'offer', connectionId: 'conn-1', payload: { sdp: 'v=0 offer' } });

    await send('bob', { to: 'alice', kind: 'answer', connectionId: 'conn-1', payload: { sdp: 'v=0 answer' } });
    await send('bob', { to: 'alice', kind: 'candidate', connectionId: 'conn-1', payload: { candidate: 'candidate:1 1 udp 1 127.0.0.1 9 typ host' } });
    await taps.alice.waitForEvent('signal', 2);
    expect(taps.alice.json('signal').map((s) => s.kind)).toEqual(['answer', 'candidate']);

    await new Promise((r) => setTimeout(r, 100));
    expect(taps.carol.of('signal')).toHaveLength(0); // third participant never sees it
    for (const tap of Object.values(taps)) tap.close();
  });

  it('refuses spoofing, self-addressing, non-participants, oversize payloads and bad kinds', async () => {
    const { id, taps } = await pair();
    const path = `/tenants/acme/sessions/${id}/signal`;
    const base = { kind: 'offer', connectionId: 'c', payload: {} };
    // `from` is never accepted from a body.
    expect((await post('alice', path, { ...base, to: 'bob', from: 'carol' })).status).toBe(400);
    expect((await post('alice', path, { ...base, to: 'alice' })).status).toBe(400);
    expect((await post('alice', path, { ...base, to: 'nobody' })).json.error.code).toBe('PARTICIPANT_NOT_FOUND');
    expect((await post('alice', path, { ...base, to: 'bob', kind: 'nuke' })).status).toBe(400);
    const big = await post('alice', path, { ...base, to: 'bob', payload: { sdp: 'x'.repeat(20_000) } });
    expect(big.status).toBe(413);
    for (const tap of Object.values(taps)) tap.close();
  });

  it('a tenant operator who has not joined cannot signal or relay in the session', async () => {
    const s = await startSession('alice');
    await post('bob', `/tenants/acme/sessions/${s.session.id}/join`);
    for (const [path, body] of [
      ['signal', { to: 'bob', kind: 'offer', connectionId: 'c', payload: {} }],
      ['relay', { to: 'bob', channel: 'ping', payload: {} }],
    ] as const) {
      const res = await post('carol', `/tenants/acme/sessions/${s.session.id}/${path}`, body);
      expect(res.status).toBe(403);
      expect(res.json.error.code).toBe('FORBIDDEN');
    }
  });

  it('reports delivered:false when the peer has no live stream', async () => {
    const s = await startSession('alice');
    await post('bob', `/tenants/acme/sessions/${s.session.id}/join`);
    const res = await post('alice', `/tenants/acme/sessions/${s.session.id}/signal`, {
      to: 'bob',
      kind: 'offer',
      connectionId: 'c',
      payload: { sdp: 'x' },
    });
    expect(res.json.data).toEqual({ delivered: false });
  });

  it('relays peer messages (fallback) to one participant or to everyone else', async () => {
    const { id, taps } = await pair();
    const path = `/tenants/acme/sessions/${id}/relay`;
    const one = await post('alice', path, { to: 'bob', channel: 'ping', payload: { n: 1 } });
    expect(one.json.data).toEqual({ delivered: 1 });
    const all = await post('alice', path, { channel: 'cursor', payload: { index: 4 } });
    expect(all.json.data).toEqual({ delivered: 2 });
    await taps.bob.waitForEvent('relay', 2);
    await taps.carol.waitForEvent('relay', 1);
    expect(taps.bob.json('relay').map((m) => [m.from, m.channel])).toEqual([['alice', 'ping'], ['alice', 'cursor']]);
    expect(taps.alice.of('relay')).toHaveLength(0);
    expect((await post('alice', path, { channel: 'cursor', payload: { s: 'x'.repeat(5000) } })).status).toBe(413);
    expect((await post('alice', path, { channel: 'shell', payload: {} })).status).toBe(400);
    for (const tap of Object.values(taps)) tap.close();
  });

  it('exposes the configured ICE servers (host candidates only by default)', async () => {
    await h.close();
    h = await startHarness({
      seed: SEED,
      serverOptions: { iceServers: [{ urls: 'stun:stun.example.org:3478' }] },
    });
    const s = await startSession('alice');
    expect(s.rtc).toEqual({ iceServers: [{ urls: 'stun:stun.example.org:3478' }] });
  });
});

describe('document access', () => {
  it('needs a seat in the session, and editing is audited on denial and sampled on allow', async () => {
    const s = await startSession('alice');
    const id = s.session.id;
    const op = { clientId: 'c', clientSeq: 1, baseRev: 0, ops: ['x'] };
    const notJoined = await post('bob', `/tenants/acme/sessions/${id}/docs/notes/ops`, op);
    expect(notJoined.status).toBe(403);
    await post('bob', `/tenants/acme/sessions/${id}/join`);
    for (let i = 1; i <= 5; i += 1) {
      const res = await post('bob', `/tenants/acme/sessions/${id}/docs/notes/ops`, { clientId: 'c', clientSeq: i, baseRev: i - 1, ops: i === 1 ? ['y'] : [i - 1, 'y'] });
      expect(res.status).toBe(200);
    }
    const entries = (await get('alice', '/tenants/acme/audit?action=doc.edit&limit=50')).json.data.entries;
    expect(entries.filter((e: { decision: string }) => e.decision === 'deny')).toHaveLength(1);
    expect(entries.filter((e: { decision: string }) => e.decision === 'allow')).toHaveLength(1);
  });

  it('creates additional documents (a workspace YAML draft) without applying them anywhere', async () => {
    const s = await startSession('alice');
    const id = s.session.id;
    const created = await post('alice', `/tenants/acme/sessions/${id}/docs`, {
      docId: 'workspace-yaml',
      title: 'Workspace YAML (draft)',
      kind: 'yaml-draft',
      content: 'version: 2\n',
    });
    expect(created.status).toBe(201);
    expect(created.json.data.doc).toMatchObject({ id: 'workspace-yaml', kind: 'yaml-draft', rev: 0, content: 'version: 2\n' });
    expect((await post('alice', `/tenants/acme/sessions/${id}/docs`, { docId: 'workspace-yaml', title: 'again' })).json.error.code).toBe('ALREADY_EXISTS');
    expect((await get('bob', `/tenants/acme/sessions/${id}/docs/workspace-yaml`)).json.data.doc.content).toBe('version: 2\n');
    expect((await get('bob', `/tenants/acme/sessions/${id}/docs/missing`)).json.error.code).toBe('DOCUMENT_NOT_FOUND');
    expect((await get('bob', `/tenants/acme/sessions/${id}/docs`)).json.data.docs.map((d: { id: string }) => d.id)).toEqual(['notes', 'workspace-yaml']);
  });
});

describe('analytics', () => {
  it('aggregates commands, sessions and audit decisions per tenant over a window', async () => {
    const a = await startSession('alice', 'main');
    await post('bob', `/tenants/acme/sessions/${a.session.id}/join`);
    await post('alice', `/tenants/acme/sessions/${a.session.id}/run`, { commandId: 'workspace.summary' });
    await post('alice', `/tenants/acme/sessions/${a.session.id}/cancel`);
    await post('bob', `/tenants/acme/sessions/${a.session.id}/run`, { commandId: 'doctor' }); // denied: not the driver
    const direct = await post('bob', '/tenants/acme/workspaces/other/commands', { commandId: 'commands.list' });
    expect(direct.status).toBe(202);
    await post('alice', `/tenants/acme/sessions/${a.session.id}/end`);
    // Another tenant's activity must not leak in.
    const g = (await post('gina', '/tenants/globex/sessions', { workspaceId: 'secret' })).json.data.session as CollabSnapshot;
    await post('gina', `/tenants/globex/sessions/${g.session.id}/run`, { commandId: 'workspace.summary' });

    const res = await get('bob', '/tenants/acme/analytics');
    expect(res.status).toBe(200);
    const analytics = res.json.data.analytics;
    expect(analytics.tenantId).toBe('acme');
    expect(analytics.commands).toMatchObject({ total: 2, canceled: 1, succeeded: 0, failed: 0, active: 1, successRate: null });
    expect(analytics.commands.byUser.map((u: { userId: string; total: number }) => [u.userId, u.total]).sort()).toEqual([['alice', 1], ['bob', 1]]);
    expect(analytics.commands.byWorkspace.map((w: { workspaceId: string; total: number }) => [w.workspaceId, w.total]).sort()).toEqual([['main', 1], ['other', 1]]);
    expect(analytics.sessions).toMatchObject({ started: 1, active: 0, ended: 1, distinctParticipants: 2, commandsRun: 1 });
    expect(analytics.sessions.avgParticipants).toBe(2);
    expect(analytics.sessions.byWorkspace).toEqual([{ workspaceId: 'main', sessions: 1, totalDurationMs: expect.any(Number) }]);
    expect(analytics.audit.denied).toBeGreaterThanOrEqual(1);
    expect(analytics.audit.deniedByCode.map((d: { code: string }) => d.code)).toContain('NOT_SESSION_DRIVER');
    const bucketTotal = analytics.timeline.buckets.reduce((n: number, b: { commands: number }) => n + b.commands, 0);
    expect(bucketTotal).toBe(2);
    expect(analytics.timeline.buckets.reduce((n: number, b: { sessions: number }) => n + b.sessions, 0)).toBe(1);

    // Workspace filter + window validation.
    const filtered = (await get('bob', '/tenants/acme/analytics?workspaceId=other')).json.data.analytics;
    expect(filtered.commands.total).toBe(1);
    expect(filtered.sessions.started).toBe(0);
    expect((await get('bob', '/tenants/acme/analytics?workspaceId=nope')).json.error.code).toBe('WORKSPACE_NOT_FOUND');
    expect((await get('bob', '/tenants/acme/analytics?from=10&to=5')).status).toBe(400);
    expect((await get('bob', '/tenants/acme/analytics?from=0&to=99999999999999')).status).toBe(400);
    const empty = (await get('bob', '/tenants/acme/analytics?from=0&to=1000')).json.data.analytics;
    expect(empty.commands.total).toBe(0);
    expect(empty.sessions.avgDurationMs).toBeNull();
  });
});
