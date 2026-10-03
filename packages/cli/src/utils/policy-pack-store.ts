import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import type { PluginSignatureRecord } from './plugin-store';

/**
 * Persistence for installed policy packs.
 *
 * Layout under the workspace:
 *
 *   .re-shell/policy-packs/index.json            index of installed packs
 *   .re-shell/policy-packs/<dir>/pack.<json|yml> the validated pack file, verbatim
 *
 * The index records where each pack came from and the sha256 of the stored pack
 * file, so `workspace policy check` can refuse a pack that was edited on disk
 * after it was validated and installed. The whole directory is plain text and
 * meant to be committed, so a team shares one set of rules.
 *
 * This module only does storage; validation of pack content lives in
 * `policy-engine.ts` and the install flow in `policy-pack-marketplace.ts`.
 */

/** Where an installed pack came from. */
export type PolicyPackInstallSource = 'npm' | 'git' | 'local';

/** One installed pack. */
export interface InstalledPackRecord {
  /** The pack's own name (`pack.name` inside the pack file); the key in the index. */
  name: string;
  description?: string;
  /** Version of the package the pack shipped in (when installed from a package). */
  version?: string;
  source: PolicyPackInstallSource;
  /** Package the pack was installed from (`@acme/reshell-policy-pack`). */
  package?: string;
  /** The identifier the user passed to `policy install`. */
  spec: string;
  /** Pack file path relative to the policy-packs directory (`acme/pack.yml`). */
  file: string;
  /** sha256 (hex) of the stored pack file. */
  sha256: string;
  ruleCount: number;
  installedAt: string;
  updatedAt?: string;
  /** npm `dist.integrity` of the package the pack came from, when known. */
  integrity?: string;
  signature?: PluginSignatureRecord;
}

/** `.re-shell/policy-packs/index.json`. */
export interface PolicyPackIndex {
  version: 1;
  packs: Record<string, InstalledPackRecord>;
}

/** Raised when the index cannot be read or a stored pack fails its integrity check. */
export class PolicyPackStoreError extends Error {
  readonly details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PolicyPackStoreError';
    this.details = details;
  }
}

/** Absolute path of the policy-packs directory. */
export function policyPacksDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.re-shell', 'policy-packs');
}

/** Absolute path of the index file. */
export function policyPackIndexPath(workspaceRoot: string): string {
  return path.join(policyPacksDir(workspaceRoot), 'index.json');
}

/** sha256 (hex) of a buffer or string. */
export function sha256(content: Buffer | string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Directory name for a pack: `@acme/strict` -> `acme__strict`. Pack names are
 * validated before they get here (see `isValidPackName`), so this never yields
 * a traversal.
 */
export function packDirName(packName: string): string {
  return packName.replace(/^@/, '').replace(/\//g, '__');
}

/** Pack names become directory names: npm-style, lowercase-ish, no traversal. */
const PACK_NAME_RE = /^(@[a-z0-9][a-z0-9-._]*\/)?[a-z0-9][a-z0-9-._]*$/i;

/**
 * Whether a pack name is safe to use as an identifier and directory name.
 *
 * @param name - Candidate pack name.
 */
export function isValidPackName(name: unknown): name is string {
  return typeof name === 'string' && name.length <= 214 && PACK_NAME_RE.test(name) && !name.includes('..');
}

/**
 * Read the index. Missing => empty; corrupt => {@link PolicyPackStoreError}
 * (never overwritten).
 */
export async function readPackIndex(workspaceRoot: string): Promise<PolicyPackIndex> {
  const file = policyPackIndexPath(workspaceRoot);
  if (!(await fs.pathExists(file))) return { version: 1, packs: {} };
  let raw: unknown;
  try {
    raw = await fs.readJSON(file);
  } catch (error) {
    throw new PolicyPackStoreError(
      `Cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { path: file }
    );
  }
  const packs = (raw as { packs?: unknown } | null)?.packs;
  if (!raw || typeof raw !== 'object' || (packs !== undefined && (typeof packs !== 'object' || packs === null || Array.isArray(packs)))) {
    throw new PolicyPackStoreError(`${file} is not a valid policy pack index`, { path: file });
  }
  return { version: 1, packs: (packs ?? {}) as Record<string, InstalledPackRecord> };
}

/** Atomically write the index. */
export async function writePackIndex(workspaceRoot: string, index: PolicyPackIndex): Promise<void> {
  const target = policyPackIndexPath(workspaceRoot);
  await fs.ensureDir(path.dirname(target));
  const sorted: Record<string, InstalledPackRecord> = {};
  for (const name of Object.keys(index.packs).sort()) sorted[name] = index.packs[name];
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeJSON(tmp, { version: 1, packs: sorted }, { spaces: 2 });
    await fs.move(tmp, target, { overwrite: true });
  } catch (error) {
    await fs.remove(tmp).catch(() => {});
    throw error;
  }
}

/** A located installed pack. */
export interface LocatedPack {
  record: InstalledPackRecord;
  /** Absolute path of the stored pack file. */
  filePath: string;
}

/**
 * Find an installed pack by its pack name or by the package it came from.
 *
 * @returns The record and file path, or null when nothing matches.
 */
export async function findInstalledPack(
  workspaceRoot: string,
  ref: string
): Promise<LocatedPack | null> {
  const index = await readPackIndex(workspaceRoot);
  const record =
    index.packs[ref] ?? Object.values(index.packs).find((r) => r.package !== undefined && r.package === ref);
  if (!record) return null;
  return { record, filePath: path.join(policyPacksDir(workspaceRoot), record.file) };
}

/**
 * Verify an installed pack's file against the sha256 recorded at install time.
 *
 * @throws {PolicyPackStoreError} If the file is missing or was modified.
 */
export async function verifyInstalledPack(located: LocatedPack): Promise<void> {
  let content: Buffer;
  try {
    content = await fs.readFile(located.filePath);
  } catch {
    throw new PolicyPackStoreError(
      `Installed policy pack '${located.record.name}' is missing its file ${located.filePath}; reinstall it`,
      { pack: located.record.name, path: located.filePath }
    );
  }
  if (sha256(content) !== located.record.sha256) {
    throw new PolicyPackStoreError(
      `Installed policy pack '${located.record.name}' was modified after it was installed ` +
        `(sha256 mismatch for ${located.filePath}); reinstall it with 'workspace policy install --force'`,
      { pack: located.record.name, path: located.filePath }
    );
  }
}

/**
 * Remove an installed pack (its directory and index entry).
 *
 * @returns The removed record and the paths deleted, or null if it was not installed.
 */
export async function removeInstalledPack(
  workspaceRoot: string,
  name: string
): Promise<{ record: InstalledPackRecord; removed: string[] } | null> {
  const index = await readPackIndex(workspaceRoot);
  const record = index.packs[name];
  if (!record) return null;

  const removed: string[] = [];
  const dir = path.join(policyPacksDir(workspaceRoot), path.dirname(record.file));
  // Only ever delete a directory that lives strictly inside the policy-packs dir.
  const rel = path.relative(policyPacksDir(workspaceRoot), dir);
  if (rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel) && (await fs.pathExists(dir))) {
    await fs.remove(dir);
    removed.push(dir);
  }
  const { [name]: _gone, ...rest } = index.packs;
  void _gone;
  await writePackIndex(workspaceRoot, { version: 1, packs: rest });
  return { record, removed };
}
