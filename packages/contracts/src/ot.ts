/**
 * Operational transformation for plain text (P9-N).
 *
 * WHY OT AND NOT A CRDT (Yjs): the control plane is a single-node, server-ordered
 * service whose every other resource is an append-only, sequence-numbered log.
 * Server-ordered OT fits that model exactly: the server is the single source of
 * truth for revision order, can validate and bound every operation before it is
 * persisted (size, base length, well-formed UTF-16), needs no binary update
 * format and no new runtime dependency in the server, the CLI or the browser,
 * and a document is fully described by (content, revision) plus a readable JSON
 * op log. A CRDT earns its keep when peers must converge WITHOUT a central
 * orderer; here there always is one. The cost of OT (transform functions) is
 * paid once, below, and is covered by randomized convergence tests.
 *
 * Model (the classic Jupiter / ot.js text model):
 *
 *  - An operation is a list of components describing a full pass over the base
 *    document: a positive integer RETAINS that many UTF-16 code units, a
 *    negative integer DELETES that many, a non-empty string INSERTS it.
 *  - `baseLength` is the document length the op applies to; `targetLength` is
 *    the result length. `applyOp` refuses an op whose baseLength differs.
 *  - `transformOps(a, b)` returns `[a', b']` with
 *        apply(apply(d, a), b') === apply(apply(d, b), a')
 *    When both insert at the same position, `a`'s insert comes first. The
 *    server always passes the already-committed op as `a`, so the committed
 *    op wins ties deterministically.
 *  - Revisions are assigned by the server only. A client sends
 *    `(baseRev, op)`; the server transforms it against every committed op after
 *    `baseRev`, applies it, and appends it as revision `rev + 1`.
 *
 * Lengths are UTF-16 code units (JS string length) throughout, so client and
 * server agree without any normalization step. {@link isWellFormedText} guards
 * against ops that would split a surrogate pair.
 */

/** A positive int retains, a negative int deletes, a string inserts. */
export type OtComponent = number | string;
export type TextOp = readonly OtComponent[];

/** Incremental, canonicalizing builder: merges neighbours, puts inserts before deletes. */
export class OpBuilder {
  private readonly parts: OtComponent[] = [];

  retain(n: number): this {
    if (n <= 0) return this;
    const last = this.parts[this.parts.length - 1];
    if (typeof last === 'number' && last > 0) {
      this.parts[this.parts.length - 1] = last + n;
    } else {
      this.parts.push(n);
    }
    return this;
  }

  insert(text: string): this {
    if (text.length === 0) return this;
    const last = this.parts[this.parts.length - 1];
    if (typeof last === 'string') {
      this.parts[this.parts.length - 1] = last + text;
    } else if (typeof last === 'number' && last < 0) {
      // Canonical order is insert-then-delete at one position.
      const before = this.parts[this.parts.length - 2];
      if (typeof before === 'string') {
        this.parts[this.parts.length - 2] = before + text;
      } else {
        this.parts.splice(this.parts.length - 1, 0, text);
      }
    } else {
      this.parts.push(text);
    }
    return this;
  }

  delete(n: number): this {
    if (n <= 0) return this;
    const last = this.parts[this.parts.length - 1];
    if (typeof last === 'number' && last < 0) {
      this.parts[this.parts.length - 1] = last - n;
    } else {
      this.parts.push(-n);
    }
    return this;
  }

  /**
   * The finished op. A trailing retain is redundant (it only says "and keep the
   * rest") and is dropped unless `keepTrailingRetain` asks for the fully spanning form.
   */
  build(keepTrailingRetain = false): TextOp {
    const out = [...this.parts];
    const last = out[out.length - 1];
    if (!keepTrailingRetain && typeof last === 'number' && last > 0) {
      out.pop();
    }
    return out;
  }
}

/** Length of the document an op applies to. A trailing retain is implicit, see {@link normalizeOp}. */
export function opBaseLength(op: TextOp): number {
  let n = 0;
  for (const c of op) {
    if (typeof c === 'string') continue;
    n += Math.abs(c);
  }
  return n;
}

export function opTargetLength(op: TextOp): number {
  let n = 0;
  for (const c of op) {
    if (typeof c === 'string') n += c.length;
    else if (c > 0) n += c;
  }
  return n;
}

export function isNoop(op: TextOp): boolean {
  return op.every((c) => typeof c === 'number' && c > 0);
}

/**
 * Structural validation of an untrusted op. Returns an error message or null.
 * Bounds the number of components and the inserted text so a hostile client
 * cannot hand the server unbounded work.
 */
export function validateOp(
  op: unknown,
  limits: { maxComponents?: number; maxInsertedChars?: number } = {}
): string | null {
  const maxComponents = limits.maxComponents ?? 4096;
  const maxInserted = limits.maxInsertedChars ?? 64 * 1024;
  if (!Array.isArray(op)) return 'An operation must be an array.';
  if (op.length > maxComponents) return `An operation may have at most ${maxComponents} components.`;
  let inserted = 0;
  for (const c of op) {
    if (typeof c === 'string') {
      if (c.length === 0) return 'Inserted strings must not be empty.';
      inserted += c.length;
    } else if (typeof c === 'number') {
      if (!Number.isSafeInteger(c) || c === 0) return 'Retain/delete counts must be non-zero integers.';
    } else {
      return 'Operation components must be numbers or strings.';
    }
  }
  if (inserted > maxInserted) return `An operation may insert at most ${maxInserted} characters.`;
  return null;
}

/**
 * Canonical form of a (valid) op: merged neighbours, inserts before deletes, and
 * a trailing retain (which only means "keep the rest") dropped.
 */
export function normalizeOp(op: TextOp): TextOp {
  const b = new OpBuilder();
  for (const c of op) {
    if (typeof c === 'string') b.insert(c);
    else if (c > 0) b.retain(c);
    else b.delete(-c);
  }
  return b.build();
}

/**
 * Expand the implicit trailing retain so the op spans exactly `docLength`.
 * Throws when it spans more than the document.
 */
export function fitOp(op: TextOp, docLength: number): TextOp {
  const base = opBaseLength(op);
  if (base > docLength) {
    throw new OtError(`Operation spans ${base} characters but the document has ${docLength}.`);
  }
  const b = new OpBuilder();
  for (const c of op) {
    if (typeof c === 'string') b.insert(c);
    else if (c > 0) b.retain(c);
    else b.delete(-c);
  }
  b.retain(docLength - base);
  return b.build(true);
}

export class OtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OtError';
  }
}

/** Apply an op. The implicit trailing retain means a short op keeps the rest of the document. */
export function applyOp(doc: string, op: TextOp): string {
  const base = opBaseLength(op);
  if (base > doc.length) {
    throw new OtError(`Operation spans ${base} characters but the document has ${doc.length}.`);
  }
  let out = '';
  let index = 0;
  for (const c of op) {
    if (typeof c === 'string') {
      out += c;
    } else if (c > 0) {
      out += doc.slice(index, index + c);
      index += c;
    } else {
      index += -c;
    }
  }
  return out + doc.slice(index);
}

function* explode(op: TextOp): Generator<OtComponent> {
  for (const c of op) yield c;
}

/**
 * Compose: one op equivalent to applying `a` then `b`. Requires
 * targetLength(a) === baseLength(b) once both are fitted to the same document,
 * so callers pass fitted ops (see {@link fitOp}) or ops over the same length.
 */
export function composeOps(a: TextOp, b: TextOp): TextOp {
  // Work on explicit, fully spanning forms so the implicit trailing retain never hides a length mismatch.
  const aLen = opBaseLength(a);
  const mid = opTargetLength(a);
  const bBase = opBaseLength(b);
  // Extend whichever side is "short" with an implicit retain over the shared remainder.
  const docLen = Math.max(aLen, bBase - mid + aLen);
  const aa = fitOp(a, docLen);
  const bb = fitOp(b, opTargetLength(aa));
  const out = new OpBuilder();
  const ia = explode(aa);
  const ib = explode(bb);
  let ca: OtComponent | undefined = ia.next().value;
  let cb: OtComponent | undefined = ib.next().value;
  const nextA = (): void => {
    ca = ia.next().value;
  };
  const nextB = (): void => {
    cb = ib.next().value;
  };
  while (ca !== undefined || cb !== undefined) {
    if (typeof ca === 'number' && ca < 0) {
      out.delete(-ca);
      nextA();
      continue;
    }
    if (typeof cb === 'string') {
      out.insert(cb);
      nextB();
      continue;
    }
    if (ca === undefined || cb === undefined) {
      throw new OtError('Cannot compose operations of different lengths.');
    }
    if (typeof ca === 'string') {
      if (typeof cb === 'number' && cb > 0) {
        // b retains (part of) a's insert.
        if (ca.length > cb) {
          out.insert(ca.slice(0, cb));
          ca = ca.slice(cb);
          nextB();
        } else if (ca.length === cb) {
          out.insert(ca);
          nextA();
          nextB();
        } else {
          out.insert(ca);
          cb = cb - ca.length;
          nextA();
        }
      } else if (typeof cb === 'number') {
        // b deletes (part of) a's insert: they cancel.
        const del = -cb;
        if (ca.length > del) {
          ca = ca.slice(del);
          nextB();
        } else if (ca.length === del) {
          nextA();
          nextB();
        } else {
          cb = cb + ca.length;
          nextA();
        }
      }
      continue;
    }
    // ca is a retain (> 0), cb is a retain or delete.
    const retainA = ca as number;
    const cbNum = cb as number;
    if (cbNum > 0) {
      if (retainA > cbNum) {
        out.retain(cbNum);
        ca = retainA - cbNum;
        nextB();
      } else if (retainA === cbNum) {
        out.retain(retainA);
        nextA();
        nextB();
      } else {
        out.retain(retainA);
        cb = cbNum - retainA;
        nextA();
      }
    } else {
      const del = -cbNum;
      if (retainA > del) {
        out.delete(del);
        ca = retainA - del;
        nextB();
      } else if (retainA === del) {
        out.delete(del);
        nextA();
        nextB();
      } else {
        out.delete(retainA);
        cb = cbNum + retainA;
        nextA();
      }
    }
  }
  return out.build();
}

/**
 * Transform two concurrent ops over the SAME base document. `a` has priority
 * for inserts at the same position (it lands first). Returns `[a', b']` such
 * that applying `a` then `b'` equals applying `b` then `a'`.
 */
export function transformOps(a: TextOp, b: TextOp): [TextOp, TextOp] {
  const docLen = Math.max(opBaseLength(a), opBaseLength(b));
  const aa = fitOp(a, docLen);
  const bb = fitOp(b, docLen);
  const aPrime = new OpBuilder();
  const bPrime = new OpBuilder();
  const ia = explode(aa);
  const ib = explode(bb);
  let ca: OtComponent | undefined = ia.next().value;
  let cb: OtComponent | undefined = ib.next().value;
  const nextA = (): void => {
    ca = ia.next().value;
  };
  const nextB = (): void => {
    cb = ib.next().value;
  };
  while (ca !== undefined || cb !== undefined) {
    // a's insert wins the tie: it goes first, b' must retain over it.
    if (typeof ca === 'string') {
      aPrime.insert(ca);
      bPrime.retain(ca.length);
      nextA();
      continue;
    }
    if (typeof cb === 'string') {
      aPrime.retain(cb.length);
      bPrime.insert(cb);
      nextB();
      continue;
    }
    if (ca === undefined || cb === undefined) {
      throw new OtError('Cannot transform operations of different lengths.');
    }
    const na = ca as number;
    const nb = cb as number;
    let min: number;
    if (na > 0 && nb > 0) {
      min = Math.min(na, nb);
      aPrime.retain(min);
      bPrime.retain(min);
    } else if (na < 0 && nb < 0) {
      min = Math.min(-na, -nb); // both delete the same text: nothing left to do
    } else if (na < 0 && nb > 0) {
      min = Math.min(-na, nb);
      aPrime.delete(min);
    } else {
      min = Math.min(na, -nb);
      bPrime.delete(min);
    }
    // consume `min` from each side
    if (Math.abs(na) > min) ca = na > 0 ? na - min : na + min;
    else nextA();
    if (Math.abs(nb) > min) cb = nb > 0 ? nb - min : nb + min;
    else nextB();
  }
  return [aPrime.build(), bPrime.build()];
}

/**
 * Map a caret/selection index through an op (for relaying cursors). An insert
 * exactly at the index pushes it right when `stickRight` is true.
 */
export function transformPosition(index: number, op: TextOp, stickRight = false): number {
  let pos = 0; // position in the base document
  let result = index;
  for (const c of op) {
    if (typeof c === 'string') {
      if (pos < index || (pos === index && stickRight)) result += c.length;
    } else if (c > 0) {
      pos += c;
    } else {
      const del = -c;
      if (pos + del <= index) {
        result -= del;
      } else if (pos < index) {
        result -= index - pos;
      }
      pos += del;
    }
  }
  return Math.max(0, result);
}

/** True when `text` contains no lone UTF-16 surrogate (it would not survive UTF-8 storage). */
export function isWellFormedText(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        i += 1;
      } else {
        return false;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

/** Compute a minimal single-span op turning `before` into `after` (common prefix/suffix diff). */
export function diffToOp(before: string, after: string): TextOp {
  let start = 0;
  const max = Math.min(before.length, after.length);
  while (start < max && before.charCodeAt(start) === after.charCodeAt(start)) start += 1;
  let endBefore = before.length;
  let endAfter = after.length;
  while (
    endBefore > start &&
    endAfter > start &&
    before.charCodeAt(endBefore - 1) === after.charCodeAt(endAfter - 1)
  ) {
    endBefore -= 1;
    endAfter -= 1;
  }
  // Never split a surrogate pair at the edit boundaries.
  const isHigh = (i: number): boolean => {
    const c = before.charCodeAt(i);
    return c >= 0xd800 && c <= 0xdbff;
  };
  if (start > 0 && isHigh(start - 1)) start -= 1;
  const lowAt = (s: string, i: number): boolean => {
    const c = s.charCodeAt(i);
    return c >= 0xdc00 && c <= 0xdfff;
  };
  if (endBefore < before.length && lowAt(before, endBefore)) {
    endBefore += 1;
    endAfter += 1;
  }
  const b = new OpBuilder();
  b.retain(start);
  b.delete(endBefore - start);
  b.insert(after.slice(start, endAfter));
  return b.build();
}

// ---------------------------------------------------------------------------
// Client state machine (Jupiter): at most one op in flight, the rest buffered.
// ---------------------------------------------------------------------------

/**
 * The client half of the protocol. It is transport-agnostic and pure:
 *
 *   - `applyLocal(op)`  a local edit was made; returns the op to SEND now (or
 *     null when one is already in flight and this edit was buffered).
 *   - `applyRemote(op)` a committed op from another client arrived; returns the
 *     op to apply to the local text (transformed over local, unacknowledged edits).
 *   - `ack()`           the server committed our in-flight op; returns the next
 *     buffered op to send, if any.
 *
 * `rev` is the last server revision this client has seen and is the `baseRev`
 * to send with any outgoing op.
 */
export class OtClient {
  private outstanding: TextOp | null = null;
  private buffer: TextOp | null = null;

  constructor(public rev: number) {}

  get state(): 'synchronized' | 'awaiting' | 'awaitingWithBuffer' {
    if (this.outstanding === null) return 'synchronized';
    return this.buffer === null ? 'awaiting' : 'awaitingWithBuffer';
  }

  /** The op currently awaiting acknowledgement (resend after a reconnect), if any. */
  get inFlight(): TextOp | null {
    return this.outstanding;
  }

  applyLocal(op: TextOp): TextOp | null {
    if (this.outstanding === null) {
      this.outstanding = op;
      return op;
    }
    this.buffer = this.buffer === null ? op : composeOps(this.buffer, op);
    return null;
  }

  applyRemote(op: TextOp): TextOp {
    this.rev += 1;
    let incoming = op;
    if (this.outstanding !== null) {
      // `incoming` is a committed op: it has priority over our unacknowledged ones.
      const [incomingOverOutstanding, outstandingAfterIncoming] = transformOps(incoming, this.outstanding);
      this.outstanding = outstandingAfterIncoming;
      incoming = incomingOverOutstanding;
      if (this.buffer !== null) {
        const [incomingOverBuffer, bufferAfterIncoming] = transformOps(incoming, this.buffer);
        this.buffer = bufferAfterIncoming;
        incoming = incomingOverBuffer;
      }
    }
    return incoming;
  }

  ack(): TextOp | null {
    this.rev += 1;
    if (this.outstanding === null) {
      throw new OtError('Received an acknowledgement with no operation in flight.');
    }
    if (this.buffer !== null) {
      this.outstanding = this.buffer;
      this.buffer = null;
      return this.outstanding;
    }
    this.outstanding = null;
    return null;
  }
}
