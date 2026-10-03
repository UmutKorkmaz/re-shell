/**
 * Hash-chain primitives for the audit log: entry shape, canonical JSON,
 * hashing, and pure chain verification (no filesystem access).
 */
import * as crypto from 'crypto';

/** prevHash of the very first entry. */
export const GENESIS_HASH = '0'.repeat(64);

export interface AuditEntry {
  /** Schema version of the entry. */
  v: 1;
  /** 1-based, gap-free sequence number. */
  seq: number;
  /** ISO-8601 UTC timestamp of the command start. */
  timestamp: string;
  /** git user.email when available, otherwise the OS username. */
  actor: string;
  actorSource: 'git' | 'os';
  /** Command path, e.g. `plugin install`. */
  command: string;
  /** Arguments after the command path, with secrets redacted. */
  args: string[];
  /** Working directory relative to the workspace root (`.` for the root). */
  cwd: string;
  exitCode: number;
  durationMs: number;
  /** Hash of the previous entry (GENESIS_HASH for the first). */
  prevHash: string;
  /** sha256 over the canonical JSON of this entry without `hash`. */
  hash: string;
}

/** Deterministic JSON: object keys sorted recursively, no whitespace. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = sortKeys(v);
    }
    return out;
  }
  return value;
}

/** sha256 hex over the canonical JSON of `entry` minus its `hash` field. */
export function computeEntryHash(entry: Omit<AuditEntry, 'hash'> | AuditEntry): string {
  const { hash: _ignored, ...rest } = entry as AuditEntry;
  return crypto.createHash('sha256').update(canonicalJson(rest)).digest('hex');
}

/** Finish an entry by computing its hash. */
export function sealEntry(entry: Omit<AuditEntry, 'hash'>): AuditEntry {
  return { ...entry, hash: computeEntryHash(entry) };
}

export type VerifyFailureCode =
  | 'invalid-json' // a line is not parseable JSON / not an object
  | 'invalid-entry' // parseable but missing/invalid fields
  | 'hash-mismatch' // entry content was modified
  | 'chain-broken' // prevHash does not match the previous entry (removed/reordered/inserted)
  | 'sequence-gap' // entries were removed (seq jumps forward)
  | 'sequence-reordered' // seq goes backwards or repeats (reordered/duplicated)
  | 'head-mismatch' // log tail disagrees with the recorded head (truncation / rewrite)
  | 'log-missing' // head exists but the log file does not
  | 'anchor-mismatch'; // --expect-head did not match

export interface VerifyFailure {
  /** Sequence number claimed by the offending entry, when readable. */
  seq: number | null;
  /** 1-based line number in the log file (0 for file-level failures). */
  line: number;
  code: VerifyFailureCode;
  message: string;
}

export interface ChainVerification {
  valid: boolean;
  entries: number;
  failures: VerifyFailure[];
  lastSeq: number | null;
  lastHash: string | null;
}

const HEX64 = /^[0-9a-f]{64}$/;

function validShape(e: unknown): e is AuditEntry {
  if (!e || typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  return (
    o.v === 1 &&
    Number.isInteger(o.seq) &&
    (o.seq as number) >= 1 &&
    typeof o.timestamp === 'string' &&
    typeof o.actor === 'string' &&
    (o.actorSource === 'git' || o.actorSource === 'os') &&
    typeof o.command === 'string' &&
    Array.isArray(o.args) &&
    (o.args as unknown[]).every(a => typeof a === 'string') &&
    typeof o.cwd === 'string' &&
    Number.isInteger(o.exitCode) &&
    typeof o.durationMs === 'number' &&
    typeof o.prevHash === 'string' &&
    HEX64.test(o.prevHash as string) &&
    typeof o.hash === 'string' &&
    HEX64.test(o.hash as string)
  );
}

/**
 * Verify the chain over raw JSONL lines. Pure: callers supply the lines and
 * (optionally) the recorded head. Every failure is collected, not just the
 * first, so an operator sees the full extent of tampering.
 */
export function verifyChain(
  lines: readonly string[],
  head?: { seq: number; hash: string } | null,
  expectHead?: string
): ChainVerification {
  const failures: VerifyFailure[] = [];
  let prev: AuditEntry | null = null;
  let entries = 0;
  const seen = new Set<number>();

  lines.forEach((raw, index) => {
    const line = index + 1;
    if (raw.trim() === '') {
      failures.push({ seq: null, line, code: 'invalid-json', message: 'blank line inside the log' });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      failures.push({ seq: null, line, code: 'invalid-json', message: 'line is not valid JSON' });
      return;
    }
    if (!validShape(parsed)) {
      const seq = parsed && typeof parsed === 'object' && Number.isInteger((parsed as { seq?: number }).seq)
        ? (parsed as { seq: number }).seq
        : null;
      failures.push({ seq, line, code: 'invalid-entry', message: 'entry is missing required fields or has invalid values' });
      return;
    }
    const entry = parsed;
    entries += 1;

    if (computeEntryHash(entry) !== entry.hash) {
      failures.push({ seq: entry.seq, line, code: 'hash-mismatch', message: `entry ${entry.seq} was modified (stored hash does not match its content)` });
    }

    const expectedSeq = prev ? prev.seq + 1 : 1;
    const expectedPrev = prev ? prev.hash : GENESIS_HASH;

    if (entry.seq !== expectedSeq) {
      if (seen.has(entry.seq) || (prev && entry.seq <= prev.seq)) {
        failures.push({ seq: entry.seq, line, code: 'sequence-reordered', message: `entry ${entry.seq} appears out of order (expected ${expectedSeq}); entries were reordered or duplicated` });
      } else {
        failures.push({ seq: entry.seq, line, code: 'sequence-gap', message: `expected seq ${expectedSeq} but found ${entry.seq}; ${entry.seq - expectedSeq} entr${entry.seq - expectedSeq === 1 ? 'y was' : 'ies were'} removed` });
      }
    }
    if (entry.prevHash !== expectedPrev) {
      failures.push({ seq: entry.seq, line, code: 'chain-broken', message: `entry ${entry.seq} does not chain from the previous entry (prevHash mismatch)` });
    }

    seen.add(entry.seq);
    prev = entry;
  });

  const lastSeq = prev ? prev.seq : null;
  const lastHash = prev ? prev.hash : null;

  if (head) {
    if (lastSeq === null) {
      failures.push({ seq: null, line: 0, code: 'head-mismatch', message: `log is empty but the recorded head says seq ${head.seq}; the log was truncated` });
    } else if (lastSeq !== head.seq || lastHash !== head.hash) {
      failures.push({
        seq: lastSeq,
        line: 0,
        code: 'head-mismatch',
        message:
          lastSeq < head.seq
            ? `log ends at seq ${lastSeq} but the recorded head is seq ${head.seq}; trailing entries were removed`
            : `log tail (seq ${lastSeq}) does not match the recorded head (seq ${head.seq})`,
      });
    }
  }
  if (expectHead && lastHash !== expectHead) {
    failures.push({ seq: lastSeq, line: 0, code: 'anchor-mismatch', message: 'log head hash does not match the externally supplied --expect-head value' });
  }

  return { valid: failures.length === 0, entries, failures, lastSeq, lastHash };
}
