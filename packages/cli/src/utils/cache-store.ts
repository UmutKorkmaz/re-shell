// Content-addressed cache store: the CacheBackend interface plus a local
// filesystem backend and an HTTP remote backend, both behind the same shape.
//
// A cached RESULT is the deterministic output of one (package, task): the exit
// code, the list of captured output files, the captured stdout/stderr logs, and
// the bytes of every output artifact. Each artifact (and the record itself) is
// HMAC-signed with node:crypto using a configurable secret; restoring an entry
// VERIFIES every signature and REJECTS the whole entry if any byte was tampered
// with. This makes a shared/remote cache safe to trust.
//
// Layout under <cacheRoot> for a key K (K is a 64-char hex sha256):
//   <cacheRoot>/<K[0:2]>/<K>/record.json   the CachedRecord (signed)
//   <cacheRoot>/<K[0:2]>/<K>/files/<rel>   each captured output artifact
//   <cacheRoot>/<K[0:2]>/<K>/record.sig    HMAC over record.json bytes
//   <cacheRoot>/<K[0:2]>/<K>/files.sig     HMAC over the canonical file digest
//
// Zero new deps: hashing/HMAC via node:crypto, fs via fs-extra, globbing via
// fast-glob (all already in the CLI).

import * as path from 'path';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import * as fs from 'fs-extra';
import fg from 'fast-glob';
import { stableStringify } from './cache-key';

/** A single captured output artifact: its package-relative path + content. */
export interface CapturedFile {
  /** POSIX path relative to the package directory. */
  path: string;
  /** Raw file bytes. */
  content: Buffer;
}

/**
 * The full cached result for one (package, task). `outputs` mirrors the relative
 * paths of `files` for quick inspection without materialising the bytes.
 */
export interface CachedResult {
  /** The exit code the task produced on the original (cache-miss) run. */
  exitCode: number;
  /** Relative POSIX paths of all captured output artifacts. */
  outputs: string[];
  /** The captured combined stdout/stderr log lines, replayed on a hit. */
  logs: string;
  /** The artifact bytes (present on put + on a verified get). */
  files: CapturedFile[];
}

/**
 * The minimal, swappable cache backend contract. Implementations are content-
 * addressed: a key fully determines an entry. `get` returns undefined on a miss
 * OR when verification fails (a tampered/corrupt entry is treated as absent so
 * the runner falls back to a real run rather than trusting bad bytes).
 */
export interface CacheBackend {
  /** Cheap existence probe (does not materialise artifacts). */
  has(key: string): Promise<boolean>;
  /** Fetch + verify an entry, or undefined on miss/verification failure. */
  get(key: string): Promise<CachedResult | undefined>;
  /** Store an entry under `key` (overwrites any existing entry). */
  put(key: string, result: CachedResult): Promise<void>;
}

/** The on-disk JSON record (artifact bytes are stored as sibling files). */
interface CachedRecord {
  v: 1;
  exitCode: number;
  outputs: string[];
  logs: string;
  /** sha256 of each artifact keyed by relative path, for integrity binding. */
  fileHashes: Record<string, string>;
}

/**
 * Compute the canonical HMAC of arbitrary bytes with the configured secret.
 * Returns a lowercase hex digest. The secret never appears in any record.
 */
function sign(secret: string, data: Buffer | string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

/** Constant-time hex digest comparison (rejects unequal-length too). */
function verifyHex(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
  } catch {
    return false;
  }
}

/** sha256 of bytes as lowercase hex (used to bind artifacts into the record). */
function sha256Hex(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * The canonical, order-independent digest of an entry's artifacts: the sorted
 * `relPath\0sha256` pairs. Signed separately so reordering/adding/removing a
 * file invalidates the entry even if record.json's signature still matched.
 */
function canonicalFilesDigest(fileHashes: Record<string, string>): string {
  const lines = Object.keys(fileHashes)
    .sort()
    .map(rel => `${rel}\0${fileHashes[rel]}`);
  return stableStringify(lines);
}

/** Options shared by both backends. */
export interface CacheBackendOptions {
  /** HMAC secret. Required for signed put/verify. */
  secret: string;
}

// ---------------------------------------------------------------------------
// LocalFsCache
// ---------------------------------------------------------------------------

/** Options for {@link LocalFsCache}. */
export interface LocalFsCacheOptions extends CacheBackendOptions {
  /** Absolute cache root directory. */
  root: string;
}

/**
 * The default, content-addressed local filesystem backend. Artifacts and the
 * record are HMAC-signed on `put`; `get` verifies both the record signature and
 * the canonical files digest signature, plus re-hashes every artifact against
 * the record's bound hash. Any mismatch -> the entry is rejected (treated as a
 * miss) so a tampered cache can never poison a build.
 */
export class LocalFsCache implements CacheBackend {
  private readonly root: string;
  private readonly secret: string;

  constructor(options: LocalFsCacheOptions) {
    this.root = path.resolve(options.root);
    this.secret = options.secret;
  }

  /** The directory that holds entry `key` (sharded by the first two hex chars). */
  entryDir(key: string): string {
    return path.join(this.root, key.slice(0, 2), key);
  }

  async has(key: string): Promise<boolean> {
    return fs.pathExists(path.join(this.entryDir(key), 'record.json'));
  }

  async get(key: string): Promise<CachedResult | undefined> {
    const dir = this.entryDir(key);
    const recordPath = path.join(dir, 'record.json');
    const recordSigPath = path.join(dir, 'record.sig');
    const filesSigPath = path.join(dir, 'files.sig');

    if (!(await fs.pathExists(recordPath))) return undefined;

    let recordBytes: Buffer;
    let recordSig: string;
    let filesSig: string;
    try {
      recordBytes = await fs.readFile(recordPath);
      recordSig = (await fs.readFile(recordSigPath, 'utf8')).trim();
      filesSig = (await fs.readFile(filesSigPath, 'utf8')).trim();
    } catch {
      return undefined; // missing signature sidecar -> not trustable
    }

    // 1) Parse the record first so we can re-serialize with stableStringify for
    //    verification — this is consistent with how put() signs the record.
    let record: CachedRecord;
    try {
      record = JSON.parse(recordBytes.toString('utf8')) as CachedRecord;
    } catch {
      return undefined;
    }

    // Verify using stableStringify so key order never affects the HMAC.
    if (!verifyHex(recordSig, sign(this.secret, Buffer.from(stableStringify(record), 'utf8')))) {
      return undefined;
    }
    if (!record || record.v !== 1 || typeof record.exitCode !== 'number') {
      return undefined;
    }

    // 2) Verify the canonical files-digest signature (binds the artifact SET).
    const expectedFilesSig = sign(
      this.secret,
      canonicalFilesDigest(record.fileHashes ?? {})
    );
    if (!verifyHex(filesSig, expectedFilesSig)) {
      return undefined;
    }

    // 3) Re-hash every artifact and compare against the bound hash. Any byte
    //    flipped on disk fails here.
    const files: CapturedFile[] = [];
    for (const rel of Object.keys(record.fileHashes ?? {})) {
      const abs = path.join(dir, 'files', rel);
      let content: Buffer;
      try {
        content = await fs.readFile(abs);
      } catch {
        return undefined; // a declared artifact is missing -> reject
      }
      if (sha256Hex(content) !== record.fileHashes[rel]) {
        return undefined; // tampered artifact -> reject the whole entry
      }
      files.push({ path: rel, content });
    }

    return {
      exitCode: record.exitCode,
      outputs: record.outputs ?? [],
      logs: record.logs ?? '',
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
    };
  }

  async put(key: string, result: CachedResult): Promise<void> {
    const dir = this.entryDir(key);
    // Write atomically-ish: build into a temp dir, then move into place.
    const tmpDir = `${dir}.tmp-${process.pid}-${Date.now()}`;
    const tmpFilesDir = path.join(tmpDir, 'files');
    await fs.ensureDir(tmpFilesDir);

    const fileHashes: Record<string, string> = {};
    for (const file of result.files) {
      const dest = path.resolve(tmpFilesDir, file.path);
      // Path containment guard: reject any artifact that would escape tmpFilesDir.
      if (dest !== tmpFilesDir && !dest.startsWith(tmpFilesDir + path.sep)) {
        throw new Error(
          `Security: refusing to write artifact "${file.path}" outside the cache directory`
        );
      }
      await fs.ensureDir(path.dirname(dest));
      await fs.writeFile(dest, file.content);
      fileHashes[file.path] = sha256Hex(file.content);
    }

    const record: CachedRecord = {
      v: 1,
      exitCode: result.exitCode,
      outputs: result.outputs,
      logs: result.logs,
      fileHashes,
    };
    const recordBytes = Buffer.from(stableStringify(record), 'utf8');
    await fs.writeFile(path.join(tmpDir, 'record.json'), recordBytes);
    await fs.writeFile(path.join(tmpDir, 'record.sig'), sign(this.secret, recordBytes));
    await fs.writeFile(
      path.join(tmpDir, 'files.sig'),
      sign(this.secret, canonicalFilesDigest(fileHashes))
    );

    await fs.remove(dir);
    await fs.ensureDir(path.dirname(dir));
    await fs.move(tmpDir, dir, { overwrite: true });
  }
}

// ---------------------------------------------------------------------------
// RemoteCache
// ---------------------------------------------------------------------------

/** The minimal HTTP transport the remote cache needs; injectable for tests. */
export interface CacheHttpTransport {
  /** HEAD-like probe: resolve true if the key exists remotely. */
  head(key: string): Promise<boolean>;
  /** GET the signed entry envelope bytes, or undefined on 404. */
  getRaw(key: string): Promise<RemoteEnvelope | undefined>;
  /** PUT the signed entry envelope. */
  putRaw(key: string, envelope: RemoteEnvelope): Promise<void>;
}

/**
 * The wire envelope exchanged with the remote hub. Artifact bytes are base64 so
 * the payload is plain JSON; integrity is carried by the same HMAC scheme as the
 * local backend (record signature + files-digest signature + per-file hashes).
 */
export interface RemoteEnvelope {
  record: CachedRecord;
  recordSig: string;
  filesSig: string;
  /** base64 artifact contents keyed by relative path. */
  files: Record<string, string>;
}

/** Options for {@link RemoteCache}. */
export interface RemoteCacheOptions extends CacheBackendOptions {
  transport: CacheHttpTransport;
}

/**
 * HTTP remote backend (to the hardened local hub) behind the SAME interface as
 * the local cache, and OFF by default — the runner only instantiates it when a
 * remote is explicitly configured. Verification is identical to the local
 * backend: a tampered envelope is rejected and surfaced as a miss.
 */
export class RemoteCache implements CacheBackend {
  private readonly transport: CacheHttpTransport;
  private readonly secret: string;

  constructor(options: RemoteCacheOptions) {
    this.transport = options.transport;
    this.secret = options.secret;
  }

  async has(key: string): Promise<boolean> {
    return this.transport.head(key);
  }

  async get(key: string): Promise<CachedResult | undefined> {
    const envelope = await this.transport.getRaw(key);
    if (!envelope) return undefined;
    return verifyEnvelope(envelope, this.secret);
  }

  async put(key: string, result: CachedResult): Promise<void> {
    const fileHashes: Record<string, string> = {};
    const files: Record<string, string> = {};
    for (const file of result.files) {
      fileHashes[file.path] = sha256Hex(file.content);
      files[file.path] = file.content.toString('base64');
    }
    const record: CachedRecord = {
      v: 1,
      exitCode: result.exitCode,
      outputs: result.outputs,
      logs: result.logs,
      fileHashes,
    };
    const recordBytes = Buffer.from(stableStringify(record), 'utf8');
    const envelope: RemoteEnvelope = {
      record,
      recordSig: sign(this.secret, recordBytes),
      filesSig: sign(this.secret, canonicalFilesDigest(fileHashes)),
      files,
    };
    await this.transport.putRaw(key, envelope);
  }
}

/**
 * Verify a remote envelope end-to-end with the same rules as the local backend.
 * Returns the materialised CachedResult or undefined when any check fails.
 */
function verifyEnvelope(
  envelope: RemoteEnvelope,
  secret: string
): CachedResult | undefined {
  const { record, recordSig, filesSig, files } = envelope;
  if (!record || record.v !== 1 || typeof record.exitCode !== 'number') {
    return undefined;
  }

  const recordBytes = Buffer.from(stableStringify(record), 'utf8');
  if (!verifyHex(recordSig, sign(secret, recordBytes))) return undefined;
  if (!verifyHex(filesSig, sign(secret, canonicalFilesDigest(record.fileHashes ?? {})))) {
    return undefined;
  }

  const out: CapturedFile[] = [];
  for (const rel of Object.keys(record.fileHashes ?? {})) {
    const b64 = files[rel];
    if (typeof b64 !== 'string') return undefined;
    const content = Buffer.from(b64, 'base64');
    if (sha256Hex(content) !== record.fileHashes[rel]) return undefined;
    out.push({ path: rel, content });
  }

  return {
    exitCode: record.exitCode,
    outputs: record.outputs ?? [],
    logs: record.logs ?? '',
    files: out.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

/**
 * Build an HTTP {@link CacheHttpTransport} for the hardened local hub. The hub
 * exposes a content-addressed cache at `<baseUrl>/cache/<key>`:
 *   - HEAD   -> 200 if present, 404 if not
 *   - GET    -> the RemoteEnvelope JSON (200) or 404
 *   - PUT    -> stores the RemoteEnvelope JSON
 * An optional bearer token is sent as `Authorization: Bearer <token>`. Uses the
 * global `fetch` (Node 18+); no new dependency. Network failures bubble to the
 * RemoteCache, which treats get/put errors as a miss / best-effort push.
 */
export function createHttpCacheTransport(opts: {
  baseUrl: string;
  token?: string;
}): CacheHttpTransport {
  const url = (key: string): string => `${opts.baseUrl}/cache/${encodeURIComponent(key)}`;
  const headers = (): Record<string, string> => {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    if (opts.token) h.authorization = `Bearer ${opts.token}`;
    return h;
  };
  return {
    async head(key: string): Promise<boolean> {
      const res = await fetch(url(key), { method: 'HEAD', headers: headers() });
      return res.ok;
    },
    async getRaw(key: string): Promise<RemoteEnvelope | undefined> {
      const res = await fetch(url(key), { method: 'GET', headers: headers() });
      if (res.status === 404) return undefined;
      if (!res.ok) throw new Error(`remote cache GET ${res.status}`);
      return (await res.json()) as RemoteEnvelope;
    },
    async putRaw(key: string, envelope: RemoteEnvelope): Promise<void> {
      const res = await fetch(url(key), {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(envelope),
      });
      if (!res.ok) throw new Error(`remote cache PUT ${res.status}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Artifact capture + restore helpers (used by the task runner)
// ---------------------------------------------------------------------------

/**
 * Capture the declared `outputs` of a package as {@link CapturedFile}s, reading
 * each matched file's bytes. Globs are resolved relative to the package dir; the
 * captured `path` is the package-relative POSIX path so restore is symmetric.
 */
export async function captureOutputs(
  packageDir: string,
  outputs: readonly string[]
): Promise<CapturedFile[]> {
  if (outputs.length === 0) return [];
  const root = path.resolve(packageDir);
  const matches = await fg(
    outputs.map(o => o.split(path.sep).join('/')),
    { cwd: root, dot: true, onlyFiles: true, followSymbolicLinks: false }
  );
  const files: CapturedFile[] = [];
  for (const rel of matches.sort((a, b) => a.localeCompare(b))) {
    const content = await fs.readFile(path.join(root, rel));
    files.push({ path: rel, content });
  }
  return files;
}

/**
 * Restore captured artifacts back to disk under the package dir. Each file's
 * relative path is re-joined under the package dir; parent dirs are created as
 * needed. Refuses to escape the package dir (path-traversal guard).
 */
export async function restoreOutputs(
  packageDir: string,
  files: readonly CapturedFile[]
): Promise<void> {
  const root = path.resolve(packageDir);
  for (const file of files) {
    const dest = path.resolve(root, file.path);
    if (dest !== root && !dest.startsWith(root + path.sep)) {
      throw new Error(
        `Security: refusing to restore "${file.path}" outside the package directory`
      );
    }
    await fs.ensureDir(path.dirname(dest));
    await fs.writeFile(dest, file.content);
  }
}

// ---------------------------------------------------------------------------
// Stats / clean (the `cache` command)
// ---------------------------------------------------------------------------

/** A point-in-time measurement of a local cache root. */
export interface CacheStats {
  location: string;
  entries: number;
  sizeBytes: number;
}

/** Walk a directory tree summing file sizes (0 when the path is absent). */
async function dirSize(dir: string): Promise<number> {
  let total = 0;
  let entries: fs.Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await dirSize(full);
    } else {
      try {
        total += (await fs.stat(full)).size;
      } catch {
        // file vanished mid-walk; ignore
      }
    }
  }
  return total;
}

/**
 * Count entries (directories containing a record.json) and total size under a
 * local cache root. Returns zeros for a non-existent root.
 */
export async function computeCacheStats(root: string): Promise<CacheStats> {
  const absRoot = path.resolve(root);
  if (!(await fs.pathExists(absRoot))) {
    return { location: absRoot, entries: 0, sizeBytes: 0 };
  }
  const records = await fg('*/*/record.json', {
    cwd: absRoot,
    onlyFiles: true,
    dot: true,
  });
  const sizeBytes = await dirSize(absRoot);
  return { location: absRoot, entries: records.length, sizeBytes };
}

/** The result of {@link cleanCache}. */
export interface CleanResult {
  location: string;
  removedEntries: number;
  reclaimedBytes: number;
}

/**
 * Prune the entire local cache root: removes every entry and reports how many
 * entries and bytes were reclaimed. A non-existent root is a no-op (zeros).
 */
export async function cleanCache(root: string): Promise<CleanResult> {
  const before = await computeCacheStats(root);
  if (before.entries === 0 && before.sizeBytes === 0) {
    return { location: before.location, removedEntries: 0, reclaimedBytes: 0 };
  }
  await fs.remove(before.location);
  return {
    location: before.location,
    removedEntries: before.entries,
    reclaimedBytes: before.sizeBytes,
  };
}
