import { describe, expect, it } from 'vitest';

import {
  CollabConnection,
  ControlPlaneClient,
  ControlPlaneError,
  SharedDocSync,
} from './collab-client.js';
import {
  CollabSyncError,
  KNOWN_COLLAB_EVENT_TYPES,
  SseFrameParser,
  applyCollabEvent,
  collabEventSchema,
  collabSnapshotSchema,
  currentRun,
  foldCollabEvents,
  readSseFrames,
  runOutputText,
  type CollabEvent,
  type CollabSnapshot,
} from './collab.js';
import { errorCodeSchema } from './envelope.js';

const SID = '11111111-1111-4111-8111-111111111111';

function ev<T extends CollabEvent['type']>(
  seq: number,
  type: T,
  data: Extract<CollabEvent, { type: T }>['data'],
  actor: string | null = 'alice',
  ts = 1000 + seq
): CollabEvent {
  return { seq, type, ts, actor, data } as CollabEvent;
}

const started = ev(1, 'session.started', { sessionId: SID, tenantId: 'acme', workspaceId: 'demo', title: 'T', ownerId: 'alice' });

function baseLog(): CollabEvent[] {
  return [
    started,
    ev(2, 'doc.created', { docId: 'notes', title: 'Notes', kind: 'notes', content: '' }),
    ev(3, 'participant.joined', { userId: 'alice' }),
    ev(4, 'participant.joined', { userId: 'bob' }),
  ];
}

describe('applyCollabEvent / foldCollabEvents', () => {
  it('builds the session state from its log', () => {
    const state = foldCollabEvents([
      ...baseLog(),
      ev(5, 'control.handover', { from: 'alice', to: 'bob', by: 'alice', reason: 'handover' }),
      ev(6, 'command.queued', { jobId: 'j1', commandId: 'doctor', params: {}, requestedBy: 'bob' }, 'bob'),
      ev(7, 'command.started', { jobId: 'j1' }, 'worker:w'),
      ev(8, 'command.output', { jobId: 'j1', chunkSeq: 1, stream: 'stdout', data: 'he' }, null),
      ev(9, 'command.output', { jobId: 'j1', chunkSeq: 2, stream: 'stderr', data: 'llo' }, null),
      ev(10, 'doc.op', { docId: 'notes', rev: 1, ops: ['abc'], clientId: 'c', clientSeq: 1 }),
      ev(11, 'doc.op', { docId: 'notes', rev: 2, ops: [1, -1, 'X'], clientId: 'c', clientSeq: 2 }),
    ]);
    expect(state.seq).toBe(11);
    expect(state.session).toMatchObject({ ownerId: 'alice', driverId: 'bob', status: 'active' });
    expect(state.participants.map((p) => [p.userId, p.role])).toEqual([
      ['alice', 'viewer'],
      ['bob', 'driver'],
    ]);
    expect(state.currentJobId).toBe('j1');
    expect(currentRun(state)).toMatchObject({ status: 'running', commandId: 'doctor' });
    expect(runOutputText(state.runs[0])).toBe('hello');
    expect(state.docs[0]).toMatchObject({ rev: 2, content: 'aXc' });

    const done = applyCollabEvent(state, ev(12, 'command.finished', { jobId: 'j1', status: 'succeeded', exitCode: 0, errorCode: null }, null));
    expect(done.currentJobId).toBeNull();
    expect(done.runs[0]).toMatchObject({ status: 'succeeded', exitCode: 0 });
    // Untouched branches are shared (cheap React updates).
    expect(done.docs).toBe(state.docs);
    expect(done.participants).toBe(state.participants);
  });

  it('removes a participant on leave and ends the session', () => {
    const state = foldCollabEvents([
      ...baseLog(),
      ev(5, 'participant.left', { userId: 'bob' }, 'bob'),
      ev(6, 'session.ended', { by: 'alice' }),
    ]);
    expect(state.participants.map((p) => p.userId)).toEqual(['alice']);
    expect(state.session).toMatchObject({ status: 'ended', endedAt: 1006 });
  });

  it('a queued run can finish without ever starting (canceled or denied at claim time)', () => {
    const state = foldCollabEvents([
      ...baseLog(),
      ev(5, 'command.queued', { jobId: 'j', commandId: 'doctor', params: {}, requestedBy: 'alice' }),
      ev(6, 'command.finished', { jobId: 'j', status: 'failed', exitCode: null, errorCode: 'COMMAND_NOT_ALLOWED' }, null),
    ]);
    expect(state.runs[0]).toMatchObject({ status: 'failed', startedAt: null, errorCode: 'COMMAND_NOT_ALLOWED' });
    expect(state.currentJobId).toBeNull();
  });

  it('ignores duplicates and rejects gaps, unknown targets and a bad start', () => {
    const state = foldCollabEvents(baseLog());
    expect(applyCollabEvent(state, ev(3, 'participant.joined', { userId: 'alice' }))).toBe(state);
    expect(() => applyCollabEvent(state, ev(7, 'participant.joined', { userId: 'x' }))).toThrow(CollabSyncError);
    expect(() => applyCollabEvent(state, ev(5, 'command.started', { jobId: 'nope' }))).toThrow(/unknown run/);
    expect(() => applyCollabEvent(state, ev(5, 'doc.op', { docId: 'nope', rev: 1, ops: ['x'], clientId: 'c', clientSeq: 1 }))).toThrow(/unknown document/);
    expect(() => applyCollabEvent(state, ev(5, 'doc.op', { docId: 'notes', rev: 3, ops: ['x'], clientId: 'c', clientSeq: 1 }))).toThrow(/rev 0; received rev 3/);
    expect(() => applyCollabEvent(state, ev(5, 'doc.op', { docId: 'notes', rev: 1, ops: [5], clientId: 'c', clientSeq: 1 }))).toThrow(/diverged/);
    expect(() => applyCollabEvent(state, ev(5, 'doc.created', { docId: 'notes', title: 'x', kind: 'text', content: '' }))).toThrow(/already exists/);
    expect(() => applyCollabEvent(state, ev(5, 'session.started', { sessionId: SID, tenantId: 'a', workspaceId: 'w', title: 't', ownerId: 'o' }))).toThrow(CollabSyncError);
    expect(() => applyCollabEvent(undefined, ev(2, 'participant.joined', { userId: 'x' }))).toThrow(/first event/);
    expect(() => foldCollabEvents([])).toThrow(/No events/);
  });

  it('validates every known event type at the wire boundary', () => {
    for (const event of baseLog()) {
      expect(collabEventSchema.safeParse(event).success).toBe(true);
    }
    expect(collabEventSchema.safeParse({ seq: 1, type: 'session.started', ts: 1, actor: null, data: {} }).success).toBe(false);
    expect(collabEventSchema.safeParse({ seq: 0, type: 'participant.joined', ts: 1, actor: null, data: { userId: 'x' } }).success).toBe(false);
    expect(KNOWN_COLLAB_EVENT_TYPES.has('doc.op')).toBe(true);
    expect(KNOWN_COLLAB_EVENT_TYPES.has('presence')).toBe(false);
  });

  it('shares its error vocabulary with the CLI envelope', () => {
    for (const code of ['SESSION_NOT_FOUND', 'SESSION_ENDED', 'SESSION_BUSY', 'NOT_SESSION_DRIVER', 'PARTICIPANT_NOT_FOUND', 'DOCUMENT_NOT_FOUND', 'COLLAB_ERROR']) {
      expect(errorCodeSchema.safeParse(code).success).toBe(true);
    }
  });
});

describe('SSE framing', () => {
  it('parses frames split across chunks, skips comments and handles CRLF', () => {
    const parser = new SseFrameParser();
    expect(parser.feed('retry: 3000\n\n: ping\n\nid: 4\nevent: ready\nda')).toEqual([]);
    expect(parser.feed('ta: {"seq":4}\n\nevent: x\r\ndata: a\r\ndata: b\r\n\r\n')).toEqual([
      { event: 'ready', data: '{"seq":4}', id: '4' },
      { event: 'x', data: 'a\nb' },
    ]);
  });

  it('reads frames from a byte stream, multi-byte safe', async () => {
    const text = 'event: m\ndata: {"s":"héllo 🙂"}\n\n';
    const bytes = new TextEncoder().encode(text);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        // Split in the middle of a multi-byte character.
        controller.enqueue(bytes.slice(0, 24));
        controller.enqueue(bytes.slice(24));
        controller.close();
      },
    });
    const frames: unknown[] = [];
    for await (const frame of readSseFrames(body)) frames.push(JSON.parse(frame.data));
    expect(frames).toEqual([{ s: 'héllo 🙂' }]);
  });
});

// ---------------------------------------------------------------------------
// The client against a scripted server
// ---------------------------------------------------------------------------

function snapshotOf(events: CollabEvent[]): CollabSnapshot {
  return { ...foldCollabEvents(events), online: ['alice'], rtc: { iceServers: [] } };
}

function sse(frames: Array<{ event: string; data: unknown; id?: number }>, options: { keepOpen?: AbortSignal } = {}): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const f of frames) {
          controller.enqueue(encoder.encode(`${f.id !== undefined ? `id: ${f.id}\n` : ''}event: ${f.event}\ndata: ${JSON.stringify(f.data)}\n\n`));
        }
        if (options.keepOpen) {
          options.keepOpen.addEventListener('abort', () => {
            try {
              controller.close();
            } catch {
              // closed
            }
          });
        } else {
          controller.close();
        }
      },
    }),
    { status: 200 }
  );
}

describe('CollabConnection', () => {
  const log = baseLog();

  it('folds a snapshot and then ordered events into state, and reports status', async () => {
    const statuses: string[] = [];
    const client = new ControlPlaneClient({
      baseUrl: 'https://cp.example',
      token: 't',
      fetch: async (_url, init) =>
        sse(
          [
            { event: 'snapshot', data: snapshotOf(log), id: 4 },
            { event: 'ready', data: { seq: 4 } },
            { event: 'presence', data: { online: ['alice', 'bob'] } },
            { event: 'participant.left', id: 5, data: ev(5, 'participant.left', { userId: 'bob' }, 'bob') },
          ],
          { keepOpen: init?.signal as AbortSignal }
        ),
    });
    const conn = client.connect('acme', SID);
    conn.on('status', (s) => statuses.push(s));
    await conn.start();
    const state = await conn.waitFor((s) => s.seq === 5);
    expect(state.participants.map((p) => p.userId)).toEqual(['alice']);
    expect(state.online).toEqual(['alice', 'bob']);
    conn.close();
    expect(statuses).toEqual(['connecting', 'open', 'closed']);
  });

  it('sends the bearer token and resumes from the last sequence after the stream drops', async () => {
    const urls: string[] = [];
    const auth: string[] = [];
    let call = 0;
    const client = new ControlPlaneClient({
      baseUrl: 'https://cp.example/',
      token: () => `tok-${call}`,
      fetch: async (url, init) => {
        urls.push(String(url));
        auth.push(String((init?.headers as Record<string, string>).Authorization));
        call += 1;
        if (call === 1) {
          return sse([
            { event: 'snapshot', data: snapshotOf(log), id: 4 },
            { event: 'ready', data: { seq: 4 } },
          ]); // ends immediately: a dropped connection
        }
        return sse(
          [
            { event: 'participant.left', id: 5, data: ev(5, 'participant.left', { userId: 'bob' }, 'bob') },
            { event: 'ready', data: { seq: 5 } },
          ],
          { keepOpen: init?.signal as AbortSignal }
        );
      },
    });
    const conn = client.connect('acme', SID, { backoffMs: [5] });
    const resets: boolean[] = [];
    conn.on('reset', (_s, info) => resets.push(info.resync));
    await conn.start();
    await conn.waitFor((s) => s.seq === 5);
    expect(urls).toEqual([
      `https://cp.example/tenants/acme/sessions/${SID}/stream`,
      `https://cp.example/tenants/acme/sessions/${SID}/stream?afterSeq=4`,
    ]);
    expect(auth).toEqual(['Bearer tok-0', 'Bearer tok-1']);
    expect(resets).toEqual([false]); // resumed: no second snapshot
    conn.close();
  });

  it('takes a fresh snapshot when the log it receives does not fit its state', async () => {
    let call = 0;
    const urls: string[] = [];
    const client = new ControlPlaneClient({
      baseUrl: 'https://cp.example',
      token: 't',
      fetch: async (url, init) => {
        urls.push(String(url));
        call += 1;
        if (call === 1) {
          return sse([
            { event: 'snapshot', data: snapshotOf(log), id: 4 },
            { event: 'ready', data: { seq: 4 } },
            // seq 9 after 4: a gap
            { event: 'participant.left', id: 9, data: ev(9, 'participant.left', { userId: 'bob' }, 'bob') },
          ]);
        }
        return sse(
          [
            { event: 'snapshot', data: snapshotOf([...log, ev(5, 'participant.left', { userId: 'bob' }, 'bob')]), id: 5 },
            { event: 'ready', data: { seq: 5 } },
          ],
          { keepOpen: init?.signal as AbortSignal }
        );
      },
    });
    const conn = client.connect('acme', SID, { backoffMs: [5] });
    const resets: boolean[] = [];
    conn.on('reset', (_s, info) => resets.push(info.resync));
    await conn.start();
    await conn.waitFor((s) => s.seq === 5 && s.participants.length === 1);
    expect(resets).toEqual([false, true]);
    expect(urls[1]).toBe(`https://cp.example/tenants/acme/sessions/${SID}/stream`); // no cursor: full resync
    conn.close();
  });

  it('advances past event types from a newer server without changing state', async () => {
    const client = new ControlPlaneClient({
      baseUrl: 'https://cp.example',
      token: 't',
      fetch: async (_u, init) =>
        sse(
          [
            { event: 'snapshot', data: snapshotOf(log), id: 4 },
            { event: 'ready', data: { seq: 4 } },
            { event: 'hologram.projected', id: 5, data: { seq: 5, type: 'hologram.projected', ts: 1, actor: null, data: { x: 1 } } },
            { event: 'participant.left', id: 6, data: ev(6, 'participant.left', { userId: 'bob' }, 'bob') },
          ],
          { keepOpen: init?.signal as AbortSignal }
        ),
    });
    const conn = client.connect('acme', SID);
    await conn.start();
    await conn.waitFor((s) => s.seq === 6);
    expect(conn.state?.participants.map((p) => p.userId)).toEqual(['alice']);
    conn.close();
  });

  it('fails start() on a refusal that retrying cannot fix, with the server error code', async () => {
    const client = new ControlPlaneClient({
      baseUrl: 'https://cp.example',
      token: 't',
      fetch: async () =>
        new Response(JSON.stringify({ ok: false, error: { code: 'FORBIDDEN', message: 'nope' }, warnings: [] }), { status: 403 }),
    });
    const conn = client.connect('acme', SID);
    const errors: Error[] = [];
    conn.on('error', (e) => errors.push(e));
    await expect(conn.start()).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(conn.status).toBe('closed');
    expect(errors).toHaveLength(1);
  });

  it('stops (and does not reconnect) when access is revoked or the session ends', async () => {
    let calls = 0;
    const client = new ControlPlaneClient({
      baseUrl: 'https://cp.example',
      token: 't',
      fetch: async () => {
        calls += 1;
        return sse([
          { event: 'snapshot', data: snapshotOf(log), id: 4 },
          { event: 'ready', data: { seq: 4 } },
          { event: 'revoked', data: { reason: 'access-removed' } },
        ]);
      },
    });
    const conn = client.connect('acme', SID, { backoffMs: [5] });
    await conn.start();
    await new Promise((r) => setTimeout(r, 60));
    expect(conn.status).toBe('closed');
    expect(calls).toBe(1);

    let endedCalls = 0;
    const ended = new ControlPlaneClient({
      baseUrl: 'https://cp.example',
      token: 't',
      fetch: async () => {
        endedCalls += 1;
        return sse([
          { event: 'snapshot', data: snapshotOf(log), id: 4 },
          { event: 'ready', data: { seq: 4 } },
          { event: 'session.ended', id: 5, data: ev(5, 'session.ended', { by: 'alice' }) },
        ]);
      },
    });
    const conn2 = ended.connect('acme', SID, { backoffMs: [5] });
    await conn2.start();
    await new Promise((r) => setTimeout(r, 60));
    expect(conn2.status).toBe('closed');
    expect(endedCalls).toBe(1);
    expect(conn2.state?.session.status).toBe('ended');
  });

  it('delivers signaling and relayed messages and ignores malformed ones', async () => {
    const client = new ControlPlaneClient({
      baseUrl: 'https://cp.example',
      token: 't',
      fetch: async (_u, init) =>
        sse(
          [
            { event: 'snapshot', data: snapshotOf(log), id: 4 },
            { event: 'ready', data: { seq: 4 } },
            { event: 'signal', data: { from: 'bob', to: 'alice', kind: 'offer', connectionId: 'c', payload: { sdp: 'x' }, ts: 1 } },
            { event: 'signal', data: { from: 'bob', kind: 'teleport' } },
            { event: 'relay', data: { from: 'bob', to: null, channel: 'ping', payload: { n: 1 }, ts: 1 } },
            { event: 'relay', data: { nonsense: true } },
          ],
          { keepOpen: init?.signal as AbortSignal }
        ),
    });
    const conn = client.connect('acme', SID);
    const signals: unknown[] = [];
    const relays: unknown[] = [];
    conn.on('signal', (s) => signals.push(s));
    conn.on('relay', (m) => relays.push(m));
    await conn.start();
    await new Promise((r) => setTimeout(r, 30));
    expect(signals).toHaveLength(1);
    expect(relays).toHaveLength(1);
    conn.close();
  });
});

describe('ControlPlaneClient', () => {
  it('unwraps envelopes and types failures', async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    const client = new ControlPlaneClient({
      baseUrl: 'https://cp.example',
      token: 'secret',
      fetch: async (url, init) => {
        calls.push({ url: String(url), method: String(init?.method), body: init?.body ? JSON.parse(String(init.body)) : undefined });
        if (String(url).endsWith('/me')) {
          return new Response(JSON.stringify({ ok: true, data: { userId: 'alice', tenants: [] }, warnings: [] }), { status: 200 });
        }
        if (String(url).includes('/handover')) {
          return new Response(JSON.stringify({ ok: false, error: { code: 'NOT_SESSION_DRIVER', message: 'no', details: { driverId: 'x' } }, warnings: [] }), { status: 403 });
        }
        if (String(url).includes('/boom')) return new Response('<html>bad gateway</html>', { status: 502 });
        throw new TypeError('connect ECONNREFUSED');
      },
    });
    expect(await client.me()).toEqual({ userId: 'alice', tenants: [] });
    const refused = await client.handover('acme', SID, 'bob').catch((e: ControlPlaneError) => e);
    expect(refused).toBeInstanceOf(ControlPlaneError);
    expect(refused).toMatchObject({ status: 403, code: 'NOT_SESSION_DRIVER', details: { driverId: 'x' }, transient: false });
    expect(calls[1]).toMatchObject({ method: 'POST', body: { toUserId: 'bob' } });
    const gateway = await client.call('GET', '/boom').catch((e: ControlPlaneError) => e);
    expect(gateway).toMatchObject({ status: 502, code: 'SERVICE_UNAVAILABLE', transient: true });
    const down = await client.call('GET', '/anything').catch((e: ControlPlaneError) => e);
    expect(down).toMatchObject({ status: 0, code: 'SERVICE_UNAVAILABLE', transient: true });
  });

  it('builds query strings and encodes path segments', async () => {
    const urls: string[] = [];
    const empty = JSON.stringify({ ok: true, data: { sessions: [], events: [], seq: 0 }, warnings: [] });
    const client = new ControlPlaneClient({
      baseUrl: 'https://cp.example',
      token: 't',
      fetch: async (url) => {
        urls.push(String(url));
        return new Response(empty, { status: 200 });
      },
    });
    await client.listSessions('a/b', { status: 'active', workspaceId: 'w', limit: 5 });
    await client.events('acme', SID, 7, 20);
    expect(urls).toEqual([
      'https://cp.example/tenants/a%2Fb/sessions?status=active&workspaceId=w&limit=5',
      `https://cp.example/tenants/acme/sessions/${SID}/events?afterSeq=7&limit=20`,
    ]);
  });
});

describe('SharedDocSync (against a scripted connection)', () => {
  it('sends one op at a time, composes the rest, and converges on the committed ops', async () => {
    // A minimal scripted "server": commits ops in arrival order and replays them as doc.op events.
    const sent: Array<{ clientSeq: number; baseRev: number; ops: unknown }> = [];
    let handler: ((event: CollabEvent) => void) | undefined;
    let rev = 0;
    const state = snapshotOf([...baseLog()]);
    const connection = {
      state,
      tenantId: 'acme',
      sessionId: SID,
      on(event: string, h: (e: CollabEvent) => void) {
        if (event === 'event') handler = h;
        return () => undefined;
      },
    } as unknown as CollabConnection;
    const client = new ControlPlaneClient({
      baseUrl: 'https://cp.example',
      token: 't',
      fetch: async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        sent.push({ clientSeq: body.clientSeq, baseRev: body.baseRev, ops: body.ops });
        rev += 1;
        const committed = rev;
        // The commit reaches the author through the stream, a moment later.
        setTimeout(() => handler?.(ev(100 + committed, 'doc.op', { docId: 'notes', rev: committed, ops: body.ops, clientId: body.clientId, clientSeq: body.clientSeq })), 5);
        return new Response(JSON.stringify({ ok: true, data: { docId: 'notes', rev: committed, ops: body.ops, duplicate: false }, warnings: [] }), { status: 200 });
      },
    });
    const doc = new SharedDocSync(client, connection, 'notes', { clientId: 'me' });
    const changes: string[] = [];
    doc.on('change', (text, info) => info.local && changes.push(text));
    doc.setText('a');
    doc.setText('ab');
    doc.setText('abc');
    expect(doc.dirty).toBe(true);
    expect(doc.text).toBe('abc');
    await doc.flush(5000);
    expect(doc.dirty).toBe(false);
    // First op alone, the buffered rest composed into ONE follow-up op.
    expect(sent.map((s) => s.clientSeq)).toEqual([1, 2]);
    expect(sent[0]).toMatchObject({ baseRev: 0, ops: ['a'] });
    expect(sent[1]).toMatchObject({ baseRev: 1, ops: [1, 'bc'] });
    expect(changes).toEqual(['a', 'ab', 'abc']);
    expect(doc.rev).toBe(2);
    doc.destroy();
  });
});

describe('snapshot schema', () => {
  it('rejects malformed snapshots', () => {
    expect(collabSnapshotSchema.safeParse({}).success).toBe(false);
    expect(collabSnapshotSchema.safeParse(snapshotOf(baseLog())).success).toBe(true);
  });
});
