import { describe, expect, it } from 'vitest';

import {
  OpBuilder,
  OtClient,
  OtError,
  applyOp,
  composeOps,
  diffToOp,
  fitOp,
  isNoop,
  isWellFormedText,
  normalizeOp,
  opBaseLength,
  opTargetLength,
  transformOps,
  transformPosition,
  validateOp,
  type TextOp,
} from './ot.js';

/** Deterministic PRNG (mulberry32) so every randomized test is reproducible. */
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

const ALPHABET = 'abcdefgh \n';

function randomText(rand: () => number, max: number): string {
  const n = Math.floor(rand() * (max + 1));
  let s = '';
  for (let i = 0; i < n; i += 1) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return s;
}

/** A random op over a document of `len` characters (spanning it fully before normalizing). */
function randomOp(rand: () => number, len: number): TextOp {
  const b = new OpBuilder();
  let remaining = len;
  while (remaining > 0) {
    const roll = rand();
    const n = Math.max(1, Math.floor(rand() * Math.min(remaining, 5)));
    if (roll < 0.4) {
      b.retain(n);
      remaining -= n;
    } else if (roll < 0.65) {
      b.delete(n);
      remaining -= n;
    } else {
      b.insert(randomText(rand, 4) || 'x');
    }
  }
  if (rand() < 0.3) b.insert(randomText(rand, 3));
  return b.build();
}

describe('text operations', () => {
  it('applies retain, insert and delete, with an implicit trailing retain', () => {
    expect(applyOp('hello world', ['X', 5, ' there', -6])).toBe('Xhello there');
    expect(applyOp('abc', [1, 'Z'])).toBe('aZbc');
    expect(applyOp('abc', [])).toBe('abc');
  });

  it('refuses an op that spans more than the document', () => {
    expect(() => applyOp('abc', [4])).toThrow(OtError);
    expect(() => applyOp('abc', [-4])).toThrow(/spans 4/);
  });

  it('computes base and target lengths', () => {
    const op: TextOp = [2, 'xyz', -3, 1];
    expect(opBaseLength(op)).toBe(6);
    expect(opTargetLength(op)).toBe(6);
  });

  it('canonicalizes: merges neighbours, puts inserts before deletes, drops a trailing retain', () => {
    expect(normalizeOp([1, 1, -1, -2, 'a', 'b', 3])).toEqual([2, 'ab', -3]);
    expect(isNoop([5])).toBe(true);
    expect(isNoop([])).toBe(true);
    expect(isNoop(['a'])).toBe(false);
    expect(isNoop([-1])).toBe(false);
  });

  it('fits an op to a document length with an explicit trailing retain', () => {
    expect(fitOp(['a'], 3)).toEqual(['a', 3]);
    expect(() => fitOp([5], 3)).toThrow(OtError);
  });

  it('validates untrusted ops', () => {
    expect(validateOp([1, 'a', -2])).toBeNull();
    expect(validateOp('nope')).toMatch(/array/);
    expect(validateOp([0])).toMatch(/non-zero/);
    expect(validateOp([1.5])).toMatch(/non-zero/);
    expect(validateOp([''])).toMatch(/empty/);
    expect(validateOp([{}])).toMatch(/numbers or strings/);
    expect(validateOp(new Array(10).fill(1), { maxComponents: 5 })).toMatch(/at most 5/);
    expect(validateOp(['x'.repeat(20)], { maxInsertedChars: 10 })).toMatch(/at most 10/);
  });

  it('transforms concurrent inserts at one position with a deterministic winner', () => {
    const [aPrime, bPrime] = transformOps(['A'], ['B']);
    // a has priority: "A" lands before "B" on both sides.
    expect(applyOp(applyOp('', ['A']), bPrime)).toBe('AB');
    expect(applyOp(applyOp('', ['B']), aPrime)).toBe('AB');
  });

  it('handles overlapping deletes without double-deleting', () => {
    const [a2, b2] = transformOps([1, -3], [2, -3]);
    const doc = 'abcdefg';
    const left = applyOp(applyOp(doc, [1, -3]), b2);
    const right = applyOp(applyOp(doc, [2, -3]), a2);
    expect(left).toBe(right);
    expect(left).toBe('afg');
  });

  it('TP1 holds for 2000 random op pairs (seeded)', () => {
    const rand = rng(0xc0ffee);
    for (let i = 0; i < 2000; i += 1) {
      const doc = randomText(rand, 24);
      const a = randomOp(rand, doc.length);
      const b = randomOp(rand, doc.length);
      const [aPrime, bPrime] = transformOps(a, b);
      const viaA = applyOp(applyOp(doc, a), bPrime);
      const viaB = applyOp(applyOp(doc, b), aPrime);
      if (viaA !== viaB) {
        throw new Error(`TP1 violated at ${i}: doc=${JSON.stringify(doc)} a=${JSON.stringify(a)} b=${JSON.stringify(b)}`);
      }
    }
  });

  it('compose equals sequential application for 2000 random op pairs (seeded)', () => {
    const rand = rng(1234567);
    for (let i = 0; i < 2000; i += 1) {
      const doc = randomText(rand, 24);
      const a = randomOp(rand, doc.length);
      const mid = applyOp(doc, a);
      const b = randomOp(rand, mid.length);
      const composed = applyOp(doc, composeOps(a, b));
      if (composed !== applyOp(mid, b)) {
        throw new Error(`compose violated at ${i}: doc=${JSON.stringify(doc)} a=${JSON.stringify(a)} b=${JSON.stringify(b)}`);
      }
    }
  });

  it('compose handles short ops that rely on the implicit trailing retain', () => {
    expect(applyOp('abcdef', composeOps(['X'], [3, 'Y']))).toBe(applyOp(applyOp('abcdef', ['X']), [3, 'Y']));
    expect(applyOp('abcdef', composeOps([-2], ['Q', -1]))).toBe('Qdef');
  });

  it('transforms caret positions through an op', () => {
    expect(transformPosition(5, [2, 'xx'])).toBe(7);
    expect(transformPosition(2, [2, 'xx'])).toBe(2);
    expect(transformPosition(2, [2, 'xx'], true)).toBe(4);
    expect(transformPosition(5, [1, -2])).toBe(3);
    expect(transformPosition(2, [1, -4])).toBe(1);
    expect(transformPosition(0, ['abc'])).toBe(0);
  });

  it('diffToOp produces the minimal single-span edit', () => {
    const op = diffToOp('hello world', 'hello brave world');
    expect(applyOp('hello world', op)).toBe('hello brave world');
    expect(op).toEqual([6, 'brave ']);
    expect(applyOp('abc', diffToOp('abc', 'abc'))).toBe('abc');
    expect(isNoop(diffToOp('abc', 'abc'))).toBe(true);
    expect(applyOp('abcdef', diffToOp('abcdef', 'abXYef'))).toBe('abXYef');
  });

  it('diffToOp never splits a surrogate pair', () => {
    const before = 'a\u{1F600}b';
    const after = 'a\u{1F601}b'; // differs only in the low surrogate
    const op = diffToOp(before, after);
    expect(applyOp(before, op)).toBe(after);
    expect(isWellFormedText(applyOp(before, op))).toBe(true);
    for (const c of op) {
      if (typeof c === 'string') expect(isWellFormedText(c)).toBe(true);
    }
  });

  it('detects lone surrogates', () => {
    expect(isWellFormedText('ok \u{1F600}')).toBe(true);
    expect(isWellFormedText('\ud800')).toBe(false);
    expect(isWellFormedText('\udc00x')).toBe(false);
    expect(isWellFormedText('a\ud800b')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Multi-client convergence against a simulated ordering server.
// ---------------------------------------------------------------------------

interface SimClient {
  id: number;
  doc: string;
  ot: OtClient;
  /** Server events (ops/acks) not yet delivered to this client, FIFO. */
  inbox: Array<{ rev: number; op: TextOp; from: number }>;
  /** Ops sent to the server not yet processed, FIFO (client -> server latency). */
  outbox: Array<{ baseRev: number; op: TextOp }>;
}

function simulate(seed: number, clients: number, steps: number): { server: string; docs: string[] } {
  const rand = rng(seed);
  let serverDoc = randomText(rand, 6);
  const log: Array<{ op: TextOp; from: number }> = []; // revision r = index + 1
  const cs: SimClient[] = [];
  for (let i = 0; i < clients; i += 1) {
    cs.push({ id: i, doc: serverDoc, ot: new OtClient(0), inbox: [], outbox: [] });
  }

  const deliverToServer = (c: SimClient): void => {
    const msg = c.outbox.shift();
    if (!msg) return;
    let op = msg.op;
    for (let r = msg.baseRev; r < log.length; r += 1) {
      const [, opPrime] = transformOps(log[r].op, op); // committed op has priority
      op = opPrime;
    }
    serverDoc = applyOp(serverDoc, op);
    log.push({ op, from: c.id });
    for (const other of cs) other.inbox.push({ rev: log.length, op, from: c.id });
  };

  const deliverToClient = (c: SimClient): void => {
    const ev = c.inbox.shift();
    if (!ev) return;
    if (ev.from === c.id) {
      const next = c.ot.ack();
      if (next) c.outbox.push({ baseRev: c.ot.rev, op: next });
    } else {
      const op = c.ot.applyRemote(ev.op);
      c.doc = applyOp(c.doc, op);
    }
    if (c.ot.rev !== ev.rev) {
      throw new Error(`client ${c.id} at rev ${c.ot.rev} received event rev ${ev.rev}`);
    }
  };

  for (let step = 0; step < steps; step += 1) {
    const c = cs[Math.floor(rand() * cs.length)];
    const roll = rand();
    if (roll < 0.45) {
      const op = randomOp(rand, c.doc.length);
      c.doc = applyOp(c.doc, op);
      const send = c.ot.applyLocal(op);
      if (send) c.outbox.push({ baseRev: c.ot.rev, op: send });
    } else if (roll < 0.7) {
      deliverToServer(c);
    } else {
      deliverToClient(c);
    }
  }
  // Drain: keep delivering until nothing is in flight anywhere.
  for (let guard = 0; guard < 100000; guard += 1) {
    let progressed = false;
    for (const c of cs) {
      if (c.outbox.length) {
        deliverToServer(c);
        progressed = true;
      }
    }
    for (const c of cs) {
      if (c.inbox.length) {
        deliverToClient(c);
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return { server: serverDoc, docs: cs.map((c) => c.doc) };
}

describe('multi-client convergence (seeded randomized)', () => {
  it('converges for 3 clients over 150 seeds with arbitrary latency', () => {
    for (let seed = 1; seed <= 150; seed += 1) {
      const { server, docs } = simulate(seed, 3, 120);
      for (const doc of docs) {
        if (doc !== server) {
          throw new Error(`seed ${seed} diverged: ${JSON.stringify(doc)} vs server ${JSON.stringify(server)}`);
        }
      }
    }
  });

  it('converges for 5 clients with heavy contention', () => {
    for (let seed = 1000; seed < 1020; seed += 1) {
      const { server, docs } = simulate(seed, 5, 400);
      for (const doc of docs) {
        if (doc !== server) {
          throw new Error(`seed ${seed} diverged: ${JSON.stringify(doc)} vs server ${JSON.stringify(server)}`);
        }
      }
    }
  });
});

describe('OtClient state machine', () => {
  it('is synchronized -> awaiting -> awaitingWithBuffer and back', () => {
    const c = new OtClient(0);
    expect(c.state).toBe('synchronized');
    expect(c.applyLocal(['a'])).toEqual(['a']);
    expect(c.state).toBe('awaiting');
    expect(c.applyLocal([1, 'b'])).toBeNull();
    expect(c.state).toBe('awaitingWithBuffer');
    const next = c.ack();
    expect(next).not.toBeNull();
    expect(c.state).toBe('awaiting');
    expect(c.ack()).toBeNull();
    expect(c.state).toBe('synchronized');
    expect(c.rev).toBe(2);
  });

  it('refuses an acknowledgement with nothing in flight', () => {
    expect(() => new OtClient(0).ack()).toThrow(OtError);
  });
});
