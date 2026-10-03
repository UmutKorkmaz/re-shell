import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ControlPlaneClient,
  ControlPlaneError,
  SharedDocSync,
  collabEventSchema,
  foldCollabEvents,
  type CollabConnection,
  type CollabEvent,
  type CollabSnapshot,
} from '@re-shell/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { startHarness, type Harness } from './test-support/harness.js';

/**
 * Shared editing over the real HTTP edge: concurrent edits from several
 * simulated clients converge (seeded, randomized), a retried op applies once,
 * malformed ops are refused, and documents survive a server restart.
 */

const SEED = {
  tenants: [{ id: 'acme', name: 'Acme', allowedCommandIds: ['workspace.summary'] }],
  workspaces: [{ id: 'main', tenantId: 'acme', name: 'Main', allowedCommandIds: ['workspace.summary'] }],
  members: [
    { tenantId: 'acme', userId: 'alice', role: 'admin' },
    { tenantId: 'acme', userId: 'bob', role: 'operator' },
    { tenantId: 'acme', userId: 'carol', role: 'operator' },
    { tenantId: 'acme', userId: 'vera', role: 'viewer' },
  ],
};

/** Deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let h: Harness | undefined;
const open: CollabConnection[] = [];

afterEach(async () => {
  for (const c of open.splice(0)) c.close();
  await h?.close();
  h = undefined;
});

const NO_RATE_LIMIT = { collabBurst: 1_000_000, collabPerMinute: 100_000_000 };

function clientFor(user: string): ControlPlaneClient {
  if (!h) throw new Error('harness not started');
  return new ControlPlaneClient({ baseUrl: h.url, token: h.userToken(user) });
}

async function connectedEditor(user: string, sessionId: string, docId = 'notes', flushDelayMs = 0) {
  const client = clientFor(user);
  await client.joinSession('acme', sessionId);
  const conn = client.connect('acme', sessionId);
  open.push(conn);
  await conn.start();
  const doc = new SharedDocSync(client, conn, docId, { flushDelayMs });
  return { client, conn, doc };
}

describe('concurrent editing converges', () => {
  it('four clients (one user on two devices) typing at once end with identical text, equal to the server', async () => {
    h = await startHarness({ seed: SEED, limits: NO_RATE_LIMIT });
    const session = await clientFor('alice').createSession('acme', { workspaceId: 'main' });
    const id = session.session.id;
    const editors = await Promise.all([
      connectedEditor('alice', id, 'notes', 5),
      connectedEditor('bob', id, 'notes', 0),
      connectedEditor('carol', id, 'notes', 10),
      connectedEditor('alice', id, 'notes', 2),
    ]);
    const errors: string[] = [];
    for (const { doc } of editors) doc.on('error', (e) => errors.push(`${e.name}: ${e.message}`));
    const rand = rng(20240607);
    const words = ['alpha', 'beta', 'gamma', '\n', ' ', 'delta', '🙂', 'x'];

    for (let step = 0; step < 220; step += 1) {
      const { doc } = editors[Math.floor(rand() * editors.length)];
      const text = doc.text;
      const roll = rand();
      if (roll < 0.55 || text.length < 4) {
        const at = Math.floor(rand() * (text.length + 1));
        // Never cut inside a surrogate pair (the editor works in code points).
        const safeAt = at > 0 && at < text.length && /[\udc00-\udfff]/.test(text[at]) ? at - 1 : at;
        doc.setText(text.slice(0, safeAt) + words[Math.floor(rand() * words.length)] + text.slice(safeAt));
      } else if (roll < 0.8) {
        let from = Math.floor(rand() * text.length);
        let to = Math.min(text.length, from + 1 + Math.floor(rand() * 5));
        if (from > 0 && /[\udc00-\udfff]/.test(text[from])) from -= 1;
        if (to < text.length && /[\udc00-\udfff]/.test(text[to])) to += 1;
        doc.setText(text.slice(0, from) + text.slice(to));
      } else {
        let from = Math.floor(rand() * text.length);
        if (from > 0 && /[\udc00-\udfff]/.test(text[from])) from -= 1;
        doc.setText(text.slice(0, from) + '[' + text.slice(from));
      }
      if (rand() < 0.4) await sleep(Math.floor(rand() * 8));
    }

    await Promise.all(editors.map((e) => e.doc.flush(20_000))).catch((error) => {
      throw new Error(`${error.message}; client errors: ${JSON.stringify(errors)}`);
    });
    expect(errors).toEqual([]);
    const server = await clientFor('bob').getDoc('acme', id, 'notes');
    expect(server.rev).toBeGreaterThan(20);
    for (const { conn } of editors) {
      await conn.waitForSeq((await clientFor('bob').getSession('acme', id)).seq, 15_000);
    }
    for (const { doc } of editors) {
      expect(doc.text).toBe(server.content);
      expect(doc.rev).toBe(server.rev);
      expect(doc.dirty).toBe(false);
    }
    // The persisted log folds to exactly the same content.
    const events: CollabEvent[] = [];
    for (;;) {
      const page = await clientFor('bob').events('acme', id, events.length, 500);
      events.push(...page.events);
      if (page.events.length < 500) break;
    }
    const folded = foldCollabEvents(events.map((e) => collabEventSchema.parse(e)));
    expect(folded.docs.find((d) => d.id === 'notes')).toMatchObject({ content: server.content, rev: server.rev });
    for (const { doc } of editors) doc.destroy();
  }, 60_000);

  it('rebases an op sent against an old revision over everything committed since', async () => {
    h = await startHarness({ seed: SEED });
    const alice = clientFor('alice');
    const id = (await alice.createSession('acme', { workspaceId: 'main' })).session.id;
    await clientFor('bob').joinSession('acme', id);
    // rev 1: "hello"; rev 2: bob appends " world"; alice (still at rev 1) inserts at the front.
    await alice.sendDocOp('acme', id, 'notes', { clientId: 'a', clientSeq: 1, baseRev: 0, ops: ['hello'] });
    await clientFor('bob').sendDocOp('acme', id, 'notes', { clientId: 'b', clientSeq: 1, baseRev: 1, ops: [5, ' world'] });
    const late = await alice.sendDocOp('acme', id, 'notes', { clientId: 'a', clientSeq: 2, baseRev: 1, ops: ['>> '] });
    expect(late.rev).toBe(3);
    expect(late.ops).toEqual(['>> ']);
    expect((await alice.getDoc('acme', id, 'notes')).content).toBe('>> hello world');
    // A concurrent insert at the very same position: the committed op wins the tie.
    await alice.sendDocOp('acme', id, 'notes', { clientId: 'a', clientSeq: 3, baseRev: 3, ops: [14, '!'] });
    await clientFor('bob').sendDocOp('acme', id, 'notes', { clientId: 'b', clientSeq: 2, baseRev: 3, ops: [14, '?'] });
    expect((await alice.getDoc('acme', id, 'notes')).content).toBe('>> hello world!?');
  });

  it('applies a retried op exactly once', async () => {
    h = await startHarness({ seed: SEED });
    const alice = clientFor('alice');
    const id = (await alice.createSession('acme', { workspaceId: 'main' })).session.id;
    const op = { clientId: 'dup', clientSeq: 1, baseRev: 0, ops: ['once'] as Array<string | number> };
    const first = await alice.sendDocOp('acme', id, 'notes', op);
    const second = await alice.sendDocOp('acme', id, 'notes', op);
    expect(first).toMatchObject({ rev: 1, duplicate: false });
    expect(second).toMatchObject({ rev: 1, duplicate: true });
    expect((await alice.getDoc('acme', id, 'notes')).content).toBe('once');
    const { events } = await alice.events('acme', id, 0, 100);
    expect(events.filter((e) => e.type === 'doc.op')).toHaveLength(1);
    // The same clientSeq from a DIFFERENT client id is a different op.
    const other = await alice.sendDocOp('acme', id, 'notes', { ...op, clientId: 'other', baseRev: 1, ops: [4, '!'] });
    expect(other.duplicate).toBe(false);
  });

  it('a late joiner starts from the current text and a reconnecting editor catches up', async () => {
    h = await startHarness({ seed: SEED, limits: NO_RATE_LIMIT });
    const id = (await clientFor('alice').createSession('acme', { workspaceId: 'main' })).session.id;
    const a = await connectedEditor('alice', id);
    a.doc.setText('first line\n');
    await a.doc.flush();

    const b = await connectedEditor('bob', id);
    expect(b.doc.text).toBe('first line\n');
    expect(b.doc.rev).toBe(1);

    // bob's stream is cut; alice keeps typing; bob's connection resumes from its cursor.
    const seqBefore = b.conn.state?.seq ?? 0;
    (b.conn as unknown as { abort: AbortController }).abort.abort();
    a.doc.setText('first line\nsecond line\n');
    await a.doc.flush();
    await b.conn.waitFor((s) => s.seq > seqBefore && s.docs[0].rev === 2, 15_000, 'resume after a dropped stream');
    expect(b.doc.text).toBe('first line\nsecond line\n');
    a.doc.destroy();
    b.doc.destroy();
  }, 30_000);
});

describe('validation', () => {
  async function start() {
    h = await startHarness({ seed: SEED });
    const alice = clientFor('alice');
    const id = (await alice.createSession('acme', { workspaceId: 'main' })).session.id;
    return { alice, id };
  }

  const send = (alice: ControlPlaneClient, id: string, body: Record<string, unknown>) =>
    alice
      .call('POST', `/tenants/acme/sessions/${id}/docs/notes/ops`, {
        clientId: 'v',
        clientSeq: Math.floor(Math.random() * 1e9),
        baseRev: 0,
        ops: ['x'],
        ...body,
      })
      .then(
        () => 'ok',
        (e: unknown) => (e instanceof ControlPlaneError ? `${e.status} ${e.code}` : String(e))
      );

  it('rejects malformed operations with a precise status', async () => {
    const { alice, id } = await start();
    expect(await send(alice, id, { ops: [0] })).toBe('400 INVALID_REQUEST');
    expect(await send(alice, id, { ops: [''] })).toBe('400 INVALID_REQUEST');
    expect(await send(alice, id, { ops: [1.5] })).toBe('400 INVALID_REQUEST');
    expect(await send(alice, id, { ops: [{ evil: 1 }] })).toBe('400 INVALID_REQUEST');
    // Spans more than the (empty) document has.
    expect(await send(alice, id, { ops: [5] })).toBe('400 INVALID_REQUEST');
    expect(await send(alice, id, { ops: [-1] })).toBe('400 INVALID_REQUEST');
    // A lone surrogate would corrupt UTF-8 storage.
    expect(await send(alice, id, { ops: ['\ud83d'] })).toBe('400 INVALID_REQUEST');
    // baseRev from the future.
    expect(await send(alice, id, { baseRev: 3 })).toBe('400 INVALID_REQUEST');
    expect(await send(alice, id, { clientId: '' })).toBe('400 INVALID_REQUEST');
    expect(await send(alice, id, { extra: true })).toBe('400 INVALID_REQUEST');
    // Nothing above changed the document.
    expect((await alice.getDoc('acme', id, 'notes')).rev).toBe(0);
    expect(await send(alice, id, {})).toBe('ok');
  });

  it('caps document size', async () => {
    const { alice, id } = await start();
    // 256 KiB cap: 8 x 32 KiB fit, the next does not.
    for (let i = 0; i < 8; i += 1) {
      const doc = await alice.getDoc('acme', id, 'notes');
      expect(await send(alice, id, { baseRev: doc.rev, ops: i === 0 ? ['a'.repeat(32 * 1024 - 100)] : [doc.content.length, 'a'.repeat(32 * 1024 - 100)] })).toBe('ok');
    }
    const doc = await alice.getDoc('acme', id, 'notes');
    expect(doc.content.length).toBeGreaterThan(250_000);
    expect(await send(alice, id, { baseRev: doc.rev, ops: [doc.content.length, 'b'.repeat(20_000)] })).toBe('413 PAYLOAD_TOO_LARGE');
    // An op over the per-op insert limit is refused up front.
    expect(await send(alice, id, { baseRev: doc.rev, ops: ['c'.repeat(70_000)] })).toMatch(/^(400|413)/);
  });

  it('refuses edits to ended sessions and to unknown documents', async () => {
    const { alice, id } = await start();
    expect(
      await alice
        .call('POST', `/tenants/acme/sessions/${id}/docs/missing/ops`, { clientId: 'v', clientSeq: 1, baseRev: 0, ops: ['x'] })
        .catch((e: ControlPlaneError) => e.code)
    ).toBe('DOCUMENT_NOT_FOUND');
    await alice.endSession('acme', id);
    expect(await send(alice, id, {})).toBe('409 SESSION_ENDED');
  });
});

describe('persistence', () => {
  it('documents, the session log and presence-independent state survive a server restart', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'collab-restart-'));
    const dbFile = path.join(dir, 'cp.db');
    try {
      h = await startHarness({ seed: SEED, dbFile });
      const keyRing = h.keyRing;
      const alice = clientFor('alice');
      const id = (await alice.createSession('acme', { workspaceId: 'main', title: 'Durable' })).session.id;
      await clientFor('bob').joinSession('acme', id);
      await alice.createDoc('acme', id, { docId: 'workspace-yaml', title: 'Workspace YAML', kind: 'yaml-draft', content: 'name: demo\n' });
      let rev = 0;
      for (const text of ['one', 'one two', 'one two three']) {
        const doc = await alice.getDoc('acme', id, 'notes');
        const op = doc.content.length === 0 ? [text] : [doc.content.length, text.slice(doc.content.length)];
        const res = await alice.sendDocOp('acme', id, 'notes', { clientId: 'a', clientSeq: ++rev, baseRev: doc.rev, ops: op });
        expect(res.rev).toBe(rev);
      }
      const before = await alice.getSession('acme', id);
      await h.close();

      // Restart: same database file, same signing keys.
      h = await startHarness({ dbFile, keyRing });
      const after = await clientFor('alice').getSession('acme', id);
      expect({ ...after, online: [] }).toEqual({ ...before, online: [] });
      expect(after.docs.map((d) => [d.id, d.rev, d.content])).toEqual([
        ['notes', 3, 'one two three'],
        ['workspace-yaml', 0, 'name: demo\n'],
      ]);
      expect(after.session.title).toBe('Durable');
      expect(after.participants.map((p) => p.userId)).toEqual(['alice', 'bob']);

      // A client holding a pre-restart revision can still commit: the server rebases over the persisted ops.
      const stale = await clientFor('bob').sendDocOp('acme', id, 'notes', { clientId: 'b', clientSeq: 1, baseRev: 1, ops: ['> '] });
      expect(stale.rev).toBe(4);
      expect((await clientFor('bob').getDoc('acme', id, 'notes')).content).toBe('> one two three');
      // And the log still folds to the live state, with seq numbers continuing where they stopped.
      const { events, seq } = await clientFor('alice').events('acme', id, 0, 500);
      expect(seq).toBe(before.seq + 1);
      const folded: CollabSnapshot = foldCollabEvents(events);
      expect(folded.docs.find((d) => d.id === 'notes')?.content).toBe('> one two three');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
