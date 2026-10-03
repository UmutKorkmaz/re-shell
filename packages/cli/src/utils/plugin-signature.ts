import * as semver from 'semver';
import {
  RegistryClient,
  RegistryUnreachableError,
  verifyRegistrySignature,
  type RegistryVersion,
} from './registry-client';
import { isSignatureRequired } from './plugin-store';

/**
 * Shared, config-gated npm registry signature verification used by plugin
 * install/update and policy-pack install.
 *
 * Whether verification is required comes from, in order: an explicit flag
 * (`--verify` / `--no-verify`), then `.re-shell/plugins.json`
 * `settings.security.allowUnverified` (verification is required unless that is
 * `true`). The check itself is {@link verifyRegistrySignature}: a real
 * cryptographic validation against the registry's published signing keys; it
 * never reports success without one.
 */

/** Outcome of checking one published version. */
export interface SignatureOutcome {
  /** True only when a registry signature validated. */
  verified: boolean;
  /** True when verification was required (so a failure must block the install). */
  gated: boolean;
  keyid?: string;
  reason?: string;
}

/**
 * Decide whether signature verification is required.
 *
 * @param workspaceRoot - Workspace whose plugins.json holds the setting.
 * @param explicit - An explicit `--verify` (true) / `--no-verify` (false) flag, if given.
 * @returns True when unverified packages must be refused.
 */
export async function resolveVerifyPolicy(
  workspaceRoot: string,
  explicit?: boolean
): Promise<boolean> {
  if (typeof explicit === 'boolean') return explicit;
  return isSignatureRequired(workspaceRoot);
}

/**
 * Verify the registry signature of a resolved version.
 *
 * @param client - Registry client (fetches the signing keys).
 * @param version - The resolved registry version object.
 * @param gated - Whether verification is required (reflected in the outcome).
 */
export async function checkVersionSignature(
  client: RegistryClient,
  version: RegistryVersion,
  gated: boolean
): Promise<SignatureOutcome> {
  const keys = await client.getSigningKeys();
  const check = verifyRegistrySignature(version, keys);
  return {
    verified: check.verified,
    gated,
    ...(check.keyid ? { keyid: check.keyid } : {}),
    ...(check.reason ? { reason: check.reason } : {}),
  };
}

/**
 * Resolve a requested version, range or dist-tag to a concrete published
 * version (the highest stable version for a range). Used where a signature must
 * be verified for exactly the version that will be installed.
 *
 * @param client - Registry client.
 * @param name - Package name.
 * @param requested - Exact version, range, dist-tag, or null for `latest`.
 * @throws {RegistryUnreachableError} When the package or version cannot be resolved.
 */
export async function resolveRegistryVersion(
  client: RegistryClient,
  name: string,
  requested: string | null
): Promise<RegistryVersion> {
  const packument = await client.getPackument(name);
  const notFound = (): RegistryUnreachableError =>
    new RegistryUnreachableError(`Version "${requested ?? 'latest'}" not found for "${name}"`, {
      name,
      version: requested,
      status: 404,
    });

  const tagOrVersion = requested ?? 'latest';
  const direct = packument.versions[tagOrVersion] !== undefined
    ? tagOrVersion
    : packument['dist-tags']?.[tagOrVersion];
  if (direct && packument.versions[direct]) return packument.versions[direct];

  if (requested && semver.validRange(requested)) {
    const published = Object.keys(packument.versions).filter((v) => semver.valid(v) !== null);
    const stable = published.filter((v) => !semver.prerelease(v));
    const best = semver.maxSatisfying(stable.length > 0 ? stable : published, requested);
    if (best) return packument.versions[best];
  }
  throw notFound();
}
