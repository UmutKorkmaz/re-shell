// Content-addressed cache key computation (pure + offline + deterministic).
//
// A cache key uniquely identifies the *result* of running one (package, task).
// Two runs that would produce the same artifacts MUST produce the same key, and
// any change that could alter the result MUST produce a different key. The key
// folds in, in a fixed canonical order:
//
//   1. the task command (the package.json script body for `<task>`),
//   2. the sha256 content hash of every INPUT file (respecting optional
//      `inputs` globs; default = the package dir minus declared
//      outputs/node_modules/dist),
//   3. the cache KEYS of the task's dependency closure (so an upstream change
//      invalidates everything downstream),
//   4. a TOOLCHAIN-VERSIONS fingerprint (node + package manager + any per-
//      language version files discoverable offline),
//   5. a small allow-listed subset of environment variables.
//
// All hashing uses node:crypto sha256 (zero new deps). Nothing here spawns a
// process, touches the network, or reads a clock: the same tree on disk always
// yields the same key, which is what makes the cache safe.

import * as path from 'path';
import { createHash } from 'crypto';
import * as fs from 'fs-extra';
import fg from 'fast-glob';

/** Reads the sha256 of a single file as a lowercase hex string. */
async function hashFile(absPath: string): Promise<string> {
  const hash = createHash('sha256');
  const data = await fs.readFile(absPath);
  hash.update(data);
  return hash.digest('hex');
}

/** Directories never hashed as inputs regardless of globs. */
const ALWAYS_IGNORED_DIRS = ['node_modules', '.git', '.re-shell'] as const;

/**
 * The environment variables that are allowed to influence a cache key. Kept
 * deliberately tiny: build tools commonly branch on NODE_ENV / CI, and a couple
 * of well-known per-language flags. An unlisted variable can never change a key,
 * so a noisy local shell does not blow the cache.
 *
 * @remark Extend this list cautiously: every added variable becomes a source of
 *  cross-machine cache misses when its value differs.
 */
export const CACHE_ENV_ALLOWLIST = [
  'NODE_ENV',
  'CI',
  'BABEL_ENV',
  'GO_ENV',
  'PYTHON_ENV',
] as const;

/** The discoverable, offline toolchain fingerprint inputs. */
export interface ToolchainFingerprint {
  /** `process.version`, e.g. "v20.11.0". */
  node: string;
  /** The detected package manager name (pnpm/yarn/npm). */
  packageManager: string;
  /**
   * Per-language toolchain versions discovered from version/lock files in the
   * package or workspace root, e.g. { ".nvmrc": "20.11.0", "go.mod:go": "1.22" }.
   * Sorted by key for determinism.
   */
  languages: Record<string, string>;
}

/** Inputs for {@link computeCacheKey}. */
export interface CacheKeyInput {
  /** Absolute path to the package directory. */
  packageDir: string;
  /** The task name (e.g. "build"). */
  task: string;
  /** The task command body (package.json script for `task`). */
  command: string;
  /** Optional `inputs` globs from the tasks config (relative to packageDir). */
  inputs?: readonly string[];
  /** Optional `outputs` globs (excluded from the default input set). */
  outputs?: readonly string[];
  /** The already-computed cache keys of this node's dependency closure. */
  dependencyKeys: readonly string[];
  /** The toolchain fingerprint (shared across the run). */
  toolchain: ToolchainFingerprint;
  /** A snapshot of the allow-listed env subset. */
  env: Readonly<Record<string, string | undefined>>;
}

/**
 * Resolve the absolute list of INPUT files for a (package, task), sorted by
 * their package-relative POSIX path so the order is stable across platforms.
 *
 * When `inputs` globs are provided they define the set verbatim. Otherwise the
 * default is "everything under the package dir" minus the declared `outputs`,
 * minus node_modules/.git/.re-shell, and minus the conventional build dirs
 * (dist) — so a task's own output never feeds back into its own key.
 *
 * @param packageDir - Absolute path to the package directory the task belongs to.
 * @param inputs - Optional `inputs` globs from the tasks config, relative to `packageDir`.
 *  When omitted/empty, all files are used subject to the default exclusions.
 * @param outputs - Optional `outputs` globs to exclude from the default input set.
 *  Has no effect when `inputs` is explicitly provided.
 * @returns A promise resolving to an array of absolute file paths, sorted by their
 *  package-relative POSIX path for cross-platform determinism.
 * @throws {Error} If the underlying `fast-glob` read or filesystem access fails
 *  (e.g. `packageDir` does not exist or is unreadable).
 */
export async function resolveInputFiles(
  packageDir: string,
  inputs?: readonly string[],
  outputs?: readonly string[]
): Promise<string[]> {
  const root = path.resolve(packageDir);
  const ignore = [
    ...ALWAYS_IGNORED_DIRS.map(d => `${d}/**`),
    'dist/**',
    ...(outputs ?? []).map(o => normalizeGlob(o)),
  ];

  const patterns = inputs && inputs.length > 0 ? [...inputs] : ['**/*'];
  const matches = await fg(patterns.map(normalizeGlob), {
    cwd: root,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore,
  });
  // fast-glob already returns POSIX-relative paths; sort for determinism.
  return matches.sort((a, b) => a.localeCompare(b)).map(rel => path.join(root, rel));
}

/** Normalise a glob to forward slashes (fast-glob requires POSIX globs). */
function normalizeGlob(glob: string): string {
  return glob.split(path.sep).join('/');
}

/**
 * Hash the resolved input file set into a single digest. Each file contributes
 * `"<relPosixPath>\0<sha256>\n"` so a rename changes the key even if content is
 * identical, and a content change changes it even if the path is identical.
 *
 * @param packageDir - Absolute path to the package directory; used to compute the
 *  package-relative POSIX path that is mixed into the digest.
 * @param files - Absolute paths of the resolved input files. Order is irrelevant
 *  because each entry is keyed by its path before being folded into the hash.
 * @returns A promise resolving to a 64-char lowercase hex sha256 digest that
 *  uniquely represents the combined contents and paths of `files`.
 * @throws {Error} If any file in `files` cannot be read.
 */
export async function hashInputs(
  packageDir: string,
  files: readonly string[]
): Promise<string> {
  const root = path.resolve(packageDir);
  const hash = createHash('sha256');
  for (const abs of files) {
    const rel = path.relative(root, abs).split(path.sep).join('/');
    const fileHash = await hashFile(abs);
    hash.update(rel);
    hash.update('\0');
    hash.update(fileHash);
    hash.update('\n');
  }
  return hash.digest('hex');
}

/**
 * Build the toolchain fingerprint from offline sources only. Reads, when
 * present, common per-language version files at the package dir and the
 * workspace root: `.nvmrc`, `.node-version`, `.tool-versions`, the `go`
 * directive of `go.mod`, `.python-version`, and `rust-toolchain`/`.toml`. Each
 * found value is keyed by its source so the fingerprint is self-describing.
 *
 * @param packageDir - Absolute path to the package directory scanned for
 *  per-language version files.
 * @param workspaceRoot - Absolute path to the workspace root, also scanned for
 *  per-language version files (in addition to `packageDir`).
 * @param packageManager - The detected package manager name
 *  (e.g. `"pnpm"`, `"yarn"`, `"npm"`).
 * @returns A promise resolving to a {@link ToolchainFingerprint} whose
 *  `languages` record is sorted by key for deterministic serialisation.
 *  Missing files are silently ignored and contribute no entry.
 */
export async function buildToolchainFingerprint(
  packageDir: string,
  workspaceRoot: string,
  packageManager: string
): Promise<ToolchainFingerprint> {
  const languages: Record<string, string> = {};
  const dirs = [path.resolve(workspaceRoot), path.resolve(packageDir)];

  const readTrimmed = async (file: string): Promise<string | undefined> => {
    try {
      const raw = await fs.readFile(file, 'utf8');
      const firstLine = raw.split('\n').map(s => s.trim()).find(Boolean);
      return firstLine;
    } catch {
      return undefined;
    }
  };

  for (const dir of dirs) {
    for (const name of ['.nvmrc', '.node-version', '.python-version', '.tool-versions']) {
      const value = await readTrimmed(path.join(dir, name));
      if (value !== undefined) languages[name] = value;
    }
    // go.mod: extract the `go <version>` directive only (not the whole file).
    const goVersion = await readGoDirective(path.join(dir, 'go.mod'));
    if (goVersion !== undefined) languages['go.mod:go'] = goVersion;
    // rust-toolchain(.toml): the channel/version line.
    for (const name of ['rust-toolchain', 'rust-toolchain.toml']) {
      const value = await readTrimmed(path.join(dir, name));
      if (value !== undefined) languages[name] = value;
    }
  }

  return {
    node: process.version,
    packageManager,
    languages: sortRecord(languages),
  };
}

/** Parse the `go <version>` directive from a go.mod file, if present. */
async function readGoDirective(goMod: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(goMod, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.trim().match(/^go\s+(\S+)/);
      if (m) return m[1];
    }
  } catch {
    // missing go.mod is fine
  }
  return undefined;
}

/** Return a copy of a record with keys in sorted order (stable JSON). */
function sortRecord(rec: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(rec).sort()) out[key] = rec[key];
  return out;
}

/**
 * Snapshot the allow-listed env subset. Only the {@link CACHE_ENV_ALLOWLIST}
 * keys are read; everything else is invisible to the cache key.
 *
 * @param source - The environment record to read from. Defaults to `process.env`
 *  when omitted, which is the typical caller.
 * @returns A new object keyed by the entries of {@link CACHE_ENV_ALLOWLIST}, in
 *  that canonical order, with values copied verbatim from `source` (possibly
 *  `undefined` when a key is absent).
 */
export function snapshotEnv(
  source: Readonly<Record<string, string | undefined>> = process.env
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of CACHE_ENV_ALLOWLIST) out[key] = source[key];
  return out;
}

/**
 * Compute the deterministic cache key for one (package, task). The function is
 * pure given its input (it does its own input-file hashing). The canonical
 * payload is JSON with sorted keys, so the same logical inputs always serialise
 * identically regardless of insertion order.
 *
 * @param input - A fully-populated {@link CacheKeyInput} describing the package,
 *  task, command, input/output globs, dependency keys, toolchain fingerprint,
 *  and allow-listed environment snapshot.
 * @returns A promise resolving to a 64-char lowercase hex sha256 digest that
 *  uniquely identifies the (package, task) result for caching purposes.
 * @throws {Error} If input-file resolution or hashing fails (see
 *  {@link resolveInputFiles} and {@link hashInputs}).
 */
export async function computeCacheKey(input: CacheKeyInput): Promise<string> {
  const files = await resolveInputFiles(input.packageDir, input.inputs, input.outputs);
  const inputsHash = await hashInputs(input.packageDir, files);

  // Canonical, order-independent payload. Dependency keys are sorted so the same
  // closure in any discovery order yields the same key. Env is reduced to the
  // allow-list snapshot (already a fixed key order via CACHE_ENV_ALLOWLIST).
  const payload = {
    v: 1,
    task: input.task,
    command: input.command,
    inputsHash,
    dependencyKeys: [...input.dependencyKeys].sort(),
    toolchain: {
      node: input.toolchain.node,
      packageManager: input.toolchain.packageManager,
      languages: input.toolchain.languages,
    },
    env: pickAllowlistedEnv(input.env),
  };

  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

/** Reduce an env snapshot to the allow-list, in canonical key order. */
function pickAllowlistedEnv(
  env: Readonly<Record<string, string | undefined>>
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const key of CACHE_ENV_ALLOWLIST) {
    out[key] = env[key] ?? null;
  }
  return out;
}

/**
 * Deterministic JSON: object keys are emitted in sorted order at every level so
 * two structurally-equal payloads always serialise to identical bytes. Arrays
 * keep their order (callers sort where order is not significant).
 *
 * @param value - Any JSON-serialisable value (primitives, arrays, plain objects,
 *  or nested combinations thereof).
 * @returns A canonical JSON string whose bytes are identical for any two
 *  structurally-equal inputs, regardless of object key insertion order.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const body = keys
    .map(key => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(',');
  return `{${body}}`;
}
