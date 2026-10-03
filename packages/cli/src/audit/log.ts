/**
 * Append-only audit log storage.
 *
 * Synchronous on purpose: entries are written from a `process.on('exit')`
 * handler (the only place the final exit code is reliably known, including for
 * `process.exit()` calls deep inside commands), and exit handlers cannot await.
 * A lock file serializes concurrent CLI processes so the chain never forks.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  GENESIS_HASH,
  sealEntry,
  verifyChain,
  type AuditEntry,
  type ChainVerification,
} from './chain';

export const AUDIT_DIR = path.join('.re-shell', 'audit');
export const AUDIT_FILE = 'audit.jsonl';
export const AUDIT_HEAD_FILE = 'audit.head.json';
const AUDIT_LOCK_FILE = 'audit.lock';

export interface AuditPaths {
  dir: string;
  log: string;
  head: string;
  lock: string;
}

export function auditPaths(root: string): AuditPaths {
  const dir = path.join(root, AUDIT_DIR);
  return {
    dir,
    log: path.join(dir, AUDIT_FILE),
    head: path.join(dir, AUDIT_HEAD_FILE),
    lock: path.join(dir, AUDIT_LOCK_FILE),
  };
}

export interface AuditHead {
  seq: number;
  hash: string;
  updatedAt: string;
}

/** Block the thread for `ms` without spinning the CPU (exit handlers cannot await). */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const LOCK_TIMEOUT_MS = 5000;
const LOCK_STALE_MS = 15000;

function acquireLock(lockPath: string): number {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeSync(fd, `${process.pid} ${Date.now()}\n`);
      return fd;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try {
        const age = Date.now() - fs.statSync(lockPath).mtimeMs;
        if (age > LOCK_STALE_MS) {
          fs.unlinkSync(lockPath); // holder died without releasing
          continue;
        }
      } catch {
        continue; // lock vanished between open and stat; retry immediately
      }
      if (Date.now() > deadline) throw new Error('timed out waiting for the audit log lock');
      sleepSync(10 + Math.floor(Math.random() * 20));
    }
  }
}

/** Read the last complete JSONL line without loading the whole file. */
function readLastLine(file: string): string | null {
  let fd: number;
  try {
    fd = fs.openSync(file, 'r');
  } catch {
    return null;
  }
  try {
    const size = fs.fstatSync(fd).size;
    if (size === 0) return null;
    const chunk = Math.min(size, 256 * 1024);
    const buf = Buffer.alloc(chunk);
    fs.readSync(fd, buf, 0, chunk, size - chunk);
    const text = buf.toString('utf8').replace(/\n+$/, '');
    const nl = text.lastIndexOf('\n');
    return nl === -1 && chunk < size ? null : text.slice(nl + 1);
  } finally {
    fs.closeSync(fd);
  }
}

export function readHead(root: string): AuditHead | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(auditPaths(root).head, 'utf8'));
    if (Number.isInteger(parsed.seq) && typeof parsed.hash === 'string') return parsed as AuditHead;
  } catch {
    /* no head yet or unreadable */
  }
  return null;
}

export type NewAuditEntry = Omit<AuditEntry, 'v' | 'seq' | 'prevHash' | 'hash'>;

/**
 * Append one entry, chaining it to the current tail. Safe against concurrent
 * writers (lock file). Throws on I/O failure so callers can surface it.
 */
export function appendAuditEntry(root: string, input: NewAuditEntry): AuditEntry {
  const p = auditPaths(root);
  fs.mkdirSync(p.dir, { recursive: true });
  const lockFd = acquireLock(p.lock);
  try {
    let seq = 1;
    let prevHash = GENESIS_HASH;
    const lastLine = readLastLine(p.log);
    let tail: AuditEntry | null = null;
    if (lastLine) {
      try {
        tail = JSON.parse(lastLine) as AuditEntry;
      } catch {
        tail = null;
      }
    }
    if (tail && Number.isInteger(tail.seq) && typeof tail.hash === 'string') {
      seq = tail.seq + 1;
      prevHash = tail.hash;
    } else {
      // Unreadable or missing tail: keep the chain moving from the recorded head
      // so `audit verify` reports the corrupt/deleted entries instead of the log
      // silently restarting at seq 1 and overwriting the evidence of tampering.
      const head = readHead(root);
      if (head) {
        seq = head.seq + 1;
        prevHash = head.hash;
      }
    }

    const entry = sealEntry({ v: 1, seq, prevHash, ...input });
    const fd = fs.openSync(p.log, 'a');
    try {
      fs.writeSync(fd, JSON.stringify(entry) + '\n');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    const head: AuditHead = { seq: entry.seq, hash: entry.hash, updatedAt: new Date().toISOString() };
    const tmp = `${p.head}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(head) + '\n');
    fs.renameSync(tmp, p.head);
    return entry;
  } finally {
    fs.closeSync(lockFd);
    try {
      fs.unlinkSync(p.lock);
    } catch {
      /* already gone */
    }
  }
}

/** Raw log lines (no trailing empty line from the final newline). */
export function readAuditLines(root: string): string[] | null {
  const p = auditPaths(root);
  let content: string;
  try {
    content = fs.readFileSync(p.log, 'utf8');
  } catch {
    return null;
  }
  if (content === '') return [];
  const lines = content.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Parse the entries that are structurally valid JSON objects (for reporting). */
export function readAuditEntries(root: string): AuditEntry[] {
  const out: AuditEntry[] = [];
  for (const line of readAuditLines(root) ?? []) {
    try {
      const e = JSON.parse(line);
      if (e && typeof e === 'object' && Number.isInteger(e.seq)) out.push(e as AuditEntry);
    } catch {
      /* skipped; verification reports it */
    }
  }
  return out;
}

export interface AuditVerifyResult extends ChainVerification {
  logPath: string;
  logExists: boolean;
  head: { seq: number; hash: string } | null;
}

/** Verify the on-disk log (and its head anchor) for `root`. */
export function verifyAuditLog(root: string, options: { expectHead?: string } = {}): AuditVerifyResult {
  const p = auditPaths(root);
  const lines = readAuditLines(root);
  const head = readHead(root);
  const rel = path.relative(root, p.log).split(path.sep).join('/');

  if (lines === null) {
    if (head) {
      return {
        valid: false,
        entries: 0,
        lastSeq: null,
        lastHash: null,
        logPath: rel,
        logExists: false,
        head: { seq: head.seq, hash: head.hash },
        failures: [{ seq: null, line: 0, code: 'log-missing', message: `${rel} is missing but a head record (seq ${head.seq}) exists; the log was deleted` }],
      };
    }
    return { valid: true, entries: 0, lastSeq: null, lastHash: null, logPath: rel, logExists: false, head: null, failures: [] };
  }

  const result = verifyChain(lines, head ? { seq: head.seq, hash: head.hash } : null, options.expectHead);
  return { ...result, logPath: rel, logExists: true, head: head ? { seq: head.seq, hash: head.hash } : null };
}
