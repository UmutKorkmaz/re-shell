import * as fs from 'fs-extra';
import * as path from 'path';
import type {
  PluginSignature,
  PolicyListResponse,
  PolicyPackSummary,
  PolicyRemoveResponse,
  PolicySearchHit,
} from '@re-shell/contracts';
import {
  classifySource,
  parseNpmSpec,
  readPackageJson,
  resolvePackageSource,
  PluginInstallError,
  type ResolvedPackage,
} from './plugin-installer';
import {
  RegistryClient,
  POLICY_PACK_KEYWORD,
  type FetchLike,
} from './registry-client';
import {
  checkVersionSignature,
  resolveRegistryVersion,
} from './plugin-signature';
import { BUILTIN_PACKS, parsePolicyPack, type PolicyPack } from './policy-engine';
import {
  PolicyPackStoreError,
  isValidPackName,
  packDirName,
  policyPacksDir,
  readPackIndex,
  removeInstalledPack,
  sha256,
  verifyInstalledPack,
  writePackIndex,
  type InstalledPackRecord,
  type PolicyPackInstallSource,
} from './policy-pack-store';

/**
 * Policy-pack distribution through the npm registry (P9-G1).
 *
 * A distributable pack is an ordinary npm package that
 *  - carries the `reshell-policy-pack` keyword (so `policy search` finds it), and
 *  - declares a `reshell-policy-pack` manifest key: the path of the pack file
 *    (YAML or JSON) inside the package, validated by the same zod schema as
 *    built-in packs (`policyPackSchema`).
 *
 * `installPolicyPack` accepts an npm spec, a git URL, a package directory, or a
 * bare pack file; validates the pack; and stores only the validated pack file
 * under `.re-shell/policy-packs/<name>/`, with provenance and a sha256 in the
 * index. For npm sources the registry signature is verified exactly as for
 * plugins when verification is required, and an unverified pack is refused
 * before anything is downloaded.
 */

/** Machine-readable reason a policy pack operation failed. */
export type PolicyPackErrorCode =
  | 'not-a-pack'
  | 'invalid-pack'
  | 'reserved-name'
  | 'exists'
  | 'unverified'
  | 'not-found'
  | 'source-error'
  | 'io-error';

/** Raised for every policy-pack install/remove failure. */
export class PolicyPackError extends Error {
  readonly code: PolicyPackErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(code: PolicyPackErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PolicyPackError';
    this.code = code;
    this.details = details;
  }
}

/** Largest pack file accepted (packs are small declarative documents). */
const MAX_PACK_BYTES = 1024 * 1024;
const PACK_EXTENSIONS = new Set(['.json', '.yml', '.yaml']);

// --- search ----------------------------------------------------------------

/** Options for {@link searchPolicyPacks}. */
export interface PolicySearchOptions {
  /** Maximum hits (default 20). */
  limit?: number;
  /** npm registry URL. */
  registryUrl?: string;
  /** Injected fetch (tests). */
  fetchImpl?: FetchLike;
}

/**
 * Search the npm registry for policy packs (keyword `reshell-policy-pack`).
 *
 * @param query - Free-text term; omitted lists all packs.
 * @param options - See {@link PolicySearchOptions}.
 * @throws {RegistryUnreachableError} On transport failure or a non-OK response.
 */
export async function searchPolicyPacks(
  query: string | undefined,
  options: PolicySearchOptions = {}
): Promise<PolicySearchHit[]> {
  const client = new RegistryClient({ registryUrl: options.registryUrl, fetchImpl: options.fetchImpl });
  const hits = await client.search(query, options.limit ?? 20, POLICY_PACK_KEYWORD);
  return hits
    // The keyword qualifier is already applied server-side; keep the check so a
    // registry that ignores it cannot surface unrelated packages as policy packs.
    .filter((hit) => (hit.keywords ?? []).includes(POLICY_PACK_KEYWORD))
    .map((hit) => ({
      name: hit.name,
      version: hit.version,
      description: hit.description ?? '',
      keywords: hit.keywords ?? [],
      publisher: hit.publisher?.username ?? (typeof hit.author === 'object' ? hit.author?.name ?? null : null),
      date: hit.date ?? null,
      homepage: hit.links?.homepage ?? null,
      repository: hit.links?.repository ?? null,
    }));
}

// --- install ---------------------------------------------------------------

/** Options for {@link installPolicyPack}. */
export interface PolicyInstallOptions {
  workspaceRoot: string;
  /** Replace an already-installed pack of the same name. */
  force?: boolean;
  /** Resolve and validate only; write nothing. */
  dryRun?: boolean;
  /** npm registry URL. */
  registryUrl?: string;
  /** Injected fetch (tests). */
  fetchImpl?: FetchLike;
  /** Require registry signature verification for npm sources (see `resolveVerifyPolicy`). */
  verifySignatures: boolean;
}

/** Outcome of an install (or a dry-run). */
export interface PolicyInstallResult {
  name: string;
  version: string | null;
  source: PolicyPackInstallSource;
  package: string | null;
  /** Absolute path of the stored (or would-be stored) pack file. */
  path: string;
  ruleCount: number;
  replaced: boolean;
  dryRun: boolean;
  sha256: string;
  signature: PluginSignature | null;
  warnings: string[];
}

async function statOrNull(target: string): Promise<fs.Stats | null> {
  try {
    return await fs.stat(target);
  } catch {
    return null;
  }
}

/** Resolve the pack file named by a package's `reshell-policy-pack` key, safely. */
async function locatePackFile(
  sourceDir: string,
  manifest: Record<string, unknown>
): Promise<{ abs: string; rel: string }> {
  const key = manifest['reshell-policy-pack'];
  if (typeof key !== 'string' || key.trim() === '') {
    throw new PolicyPackError(
      'not-a-pack',
      `Package ${String(manifest.name ?? sourceDir)} is not a Re-Shell policy pack: ` +
        'its package.json has no "reshell-policy-pack" key pointing at the pack file',
      { package: manifest.name ?? null }
    );
  }
  if (path.isAbsolute(key)) {
    throw new PolicyPackError('invalid-pack', `"reshell-policy-pack" must be a path inside the package (got ${key})`);
  }

  const abs = path.resolve(sourceDir, key);
  const rel = path.relative(sourceDir, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new PolicyPackError('invalid-pack', `"reshell-policy-pack" points outside the package (${key})`);
  }
  if (!PACK_EXTENSIONS.has(path.extname(abs).toLowerCase())) {
    throw new PolicyPackError('invalid-pack', `Policy pack file must be .json, .yml or .yaml (got ${key})`);
  }
  const stat = await statOrNull(abs);
  if (!stat || !stat.isFile()) {
    throw new PolicyPackError('invalid-pack', `Policy pack file "${key}" does not exist in the package`);
  }
  // A symlink inside the package must not smuggle in a file from elsewhere.
  const [realRoot, realFile] = await Promise.all([fs.realpath(sourceDir), fs.realpath(abs)]);
  const realRel = path.relative(realRoot, realFile);
  if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
    throw new PolicyPackError('invalid-pack', `Policy pack file "${key}" resolves outside the package`);
  }
  return { abs, rel };
}

/**
 * Install a policy pack from an npm spec, git URL, package directory or pack file.
 *
 * @param identifier - `name`, `name@range`, `git+https://...`, a package directory,
 *   or a path to a `.json`/`.yml`/`.yaml` pack file.
 * @param options - See {@link PolicyInstallOptions}.
 * @throws {PolicyPackError} For an invalid pack, a name clash, an unverified
 *   package or an I/O failure; `RegistryUnreachableError` when the registry is down.
 */
export async function installPolicyPack(
  identifier: string,
  options: PolicyInstallOptions
): Promise<PolicyInstallResult> {
  const root = options.workspaceRoot;
  const warnings: string[] = [];
  let resolved: ResolvedPackage | null = null;

  try {
    let source: PolicyPackInstallSource;
    let packFile: string;
    let packageName: string | null = null;
    let packageVersion: string | null = null;
    let integrity: string | undefined;
    let signature: PluginSignature | null = null;
    let spec = identifier;

    const direct = await statOrNull(path.resolve(identifier));
    if (direct?.isFile()) {
      // A bare pack file on disk.
      if (!PACK_EXTENSIONS.has(path.extname(identifier).toLowerCase())) {
        throw new PolicyPackError('invalid-pack', `Policy pack file must be .json, .yml or .yaml (got ${identifier})`);
      }
      source = 'local';
      packFile = path.resolve(identifier);
      spec = packFile;
    } else {
      let target = identifier;

      if (classifySource(identifier) === 'npm') {
        const { name, requested } = parseNpmSpec(identifier);
        if (options.verifySignatures) {
          if (!name) {
            throw new PolicyPackError(
              'unverified',
              `Cannot verify the signature of "${identifier}": only registry packages (name or name@version) can be verified. ` +
                'Pass --no-verify to install it anyway.'
            );
          }
          const client = new RegistryClient({ registryUrl: options.registryUrl, fetchImpl: options.fetchImpl });
          const version = await resolveRegistryVersion(client, name, requested);
          const outcome = await checkVersionSignature(client, version, true);
          signature = outcome;
          if (!outcome.verified) {
            throw new PolicyPackError(
              'unverified',
              `Refusing to install unverified policy pack "${name}@${version.version}": ` +
                `${outcome.reason ?? 'signature verification failed'}. Pass --no-verify to override.`,
              { package: name, version: version.version }
            );
          }
          // Install exactly the version whose signature was just verified.
          target = `${name}@${version.version}`;
          integrity = version.dist.integrity;
        } else {
          signature = { verified: false, gated: false };
          warnings.push('Signature verification disabled; the package was not verified');
        }
      }

      try {
        resolved = await resolvePackageSource(target, { registry: options.registryUrl });
      } catch (error) {
        if (error instanceof PluginInstallError) {
          throw new PolicyPackError('source-error', error.message, error.details);
        }
        throw error;
      }
      source = resolved.source;

      const manifest = await readPackageJson(resolved.sourceDir).catch((error: unknown) => {
        throw new PolicyPackError('not-a-pack', error instanceof Error ? error.message : String(error));
      });
      packageName = typeof manifest.name === 'string' ? manifest.name : null;
      packageVersion = typeof manifest.version === 'string' ? manifest.version : null;
      if (!(Array.isArray(manifest.keywords) && manifest.keywords.includes(POLICY_PACK_KEYWORD))) {
        warnings.push(`Package does not carry the "${POLICY_PACK_KEYWORD}" keyword, so 'workspace policy search' will not find it`);
      }
      packFile = (await locatePackFile(resolved.sourceDir, manifest)).abs;
    }

    // Validate the pack content with the engine's own schema.
    const stat = await fs.stat(packFile);
    if (stat.size > MAX_PACK_BYTES) {
      throw new PolicyPackError('invalid-pack', `Policy pack file is too large (${stat.size} bytes, limit ${MAX_PACK_BYTES})`);
    }
    const content = await fs.readFile(packFile);
    let pack: PolicyPack;
    try {
      pack = parsePolicyPack(content.toString('utf8'), path.basename(packFile));
    } catch (error) {
      throw new PolicyPackError('invalid-pack', error instanceof Error ? error.message : String(error));
    }
    if (!isValidPackName(pack.name)) {
      throw new PolicyPackError(
        'invalid-pack',
        `Policy pack name "${pack.name}" is not valid (use letters, digits, ".", "-", "_", optionally scoped like @team/name)`
      );
    }
    if (Object.prototype.hasOwnProperty.call(BUILTIN_PACKS, pack.name)) {
      throw new PolicyPackError('reserved-name', `"${pack.name}" is a built-in policy pack name and cannot be replaced`);
    }

    const index = await readPackIndex(root);
    const previous = index.packs[pack.name];
    const dirName = packDirName(pack.name);
    const clash = Object.values(index.packs).find(
      (r) => r.name !== pack.name && path.dirname(r.file) === dirName
    );
    if (clash) {
      throw new PolicyPackError('exists', `Pack directory "${dirName}" is already used by pack '${clash.name}'`, {
        name: pack.name,
        conflictsWith: clash.name,
      });
    }
    if (previous && !options.force) {
      throw new PolicyPackError(
        'exists',
        `Policy pack '${pack.name}' is already installed (use --force to replace it)`,
        { name: pack.name }
      );
    }

    const ext = path.extname(packFile).toLowerCase();
    const relFile = path.posix.join(dirName, `pack${ext}`);
    const target = path.join(policyPacksDir(root), relFile);
    const digest = sha256(content);

    const result: PolicyInstallResult = {
      name: pack.name,
      version: packageVersion,
      source,
      package: packageName,
      path: target,
      ruleCount: pack.rules.length,
      replaced: previous !== undefined,
      dryRun: options.dryRun === true,
      sha256: digest,
      signature,
      warnings,
    };
    if (options.dryRun) return result;

    // Stage next to the target and swap, so a failure never leaves a half-written pack.
    const packsDir = policyPacksDir(root);
    await fs.ensureDir(packsDir);
    const stage = path.join(packsDir, `.${dirName}.staging-${process.pid}-${Date.now()}`);
    try {
      await fs.ensureDir(stage);
      await fs.writeFile(path.join(stage, `pack${ext}`), content);
      await fs.move(stage, path.join(packsDir, dirName), { overwrite: true });
    } catch (error) {
      await fs.remove(stage).catch(() => {});
      throw new PolicyPackError(
        'io-error',
        `Failed to store policy pack: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const now = new Date().toISOString();
    const record: InstalledPackRecord = {
      name: pack.name,
      ...(pack.description ? { description: pack.description } : {}),
      ...(packageVersion ? { version: packageVersion } : {}),
      source,
      ...(packageName ? { package: packageName } : {}),
      spec,
      file: relFile,
      sha256: digest,
      ruleCount: pack.rules.length,
      installedAt: previous?.installedAt ?? now,
      ...(previous ? { updatedAt: now } : {}),
      ...(integrity ? { integrity } : {}),
      ...(signature
        ? {
            signature: {
              verified: signature.verified,
              gated: signature.gated,
              ...(signature.keyid ? { keyid: signature.keyid } : {}),
              ...(signature.reason ? { reason: signature.reason } : {}),
              checkedAt: now,
            },
          }
        : {}),
    };
    // Drop an older pack's now-orphaned directory when a replaced pack changed extension.
    if (previous && previous.file !== relFile) {
      await fs.remove(path.join(packsDir, previous.file)).catch(() => {});
    }
    await writePackIndex(root, { version: 1, packs: { ...index.packs, [pack.name]: record } });
    return result;
  } finally {
    resolved?.cleanup();
  }
}

// --- list / remove -----------------------------------------------------------

/**
 * List built-in and installed packs. An installed pack whose file is missing or
 * was modified after install is still listed, with a warning.
 *
 * @param workspaceRoot - Workspace root.
 */
export async function listPolicyPacks(
  workspaceRoot: string
): Promise<PolicyListResponse & { warnings: string[] }> {
  const warnings: string[] = [];
  const packs: PolicyPackSummary[] = Object.values(BUILTIN_PACKS).map((pack) => ({
    name: pack.name,
    description: pack.description ?? null,
    version: null,
    source: 'builtin' as const,
    ruleCount: pack.rules.length,
    package: null,
    path: null,
    installedAt: null,
    sha256: null,
  }));

  const index = await readPackIndex(workspaceRoot);
  for (const record of Object.values(index.packs).sort((a, b) => a.name.localeCompare(b.name))) {
    const filePath = path.join(policyPacksDir(workspaceRoot), record.file);
    try {
      await verifyInstalledPack({ record, filePath });
    } catch (error) {
      if (error instanceof PolicyPackStoreError) warnings.push(error.message);
      else throw error;
    }
    packs.push({
      name: record.name,
      description: record.description ?? null,
      version: record.version ?? null,
      source: record.source,
      ruleCount: record.ruleCount,
      package: record.package ?? null,
      path: filePath,
      installedAt: record.installedAt,
      sha256: record.sha256,
    });
  }
  return { packs, total: packs.length, warnings };
}

/**
 * Remove an installed policy pack.
 *
 * @throws {PolicyPackError} `reserved-name` for a built-in, `not-found` if not installed.
 */
export async function removePolicyPack(
  workspaceRoot: string,
  name: string
): Promise<PolicyRemoveResponse> {
  if (Object.prototype.hasOwnProperty.call(BUILTIN_PACKS, name)) {
    throw new PolicyPackError('reserved-name', `"${name}" is a built-in policy pack and cannot be removed`);
  }
  const removed = await removeInstalledPack(workspaceRoot, name);
  if (!removed) {
    throw new PolicyPackError('not-found', `Policy pack '${name}' is not installed`, { name });
  }
  return { name, removed: removed.removed };
}
