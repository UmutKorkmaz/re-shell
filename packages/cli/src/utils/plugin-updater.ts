import * as semver from 'semver';
import type {
  PluginPinResponse,
  PluginSignature,
  PluginUpdateItem,
  PluginUpdateResponse,
} from '@re-shell/contracts';
import {
  readPluginsFile,
  setPluginPin,
  type PluginRegistryEntry,
} from './plugin-store';
import {
  installPluginFromIdentifier,
  isCommitSha,
  runGit,
} from './plugin-installer';
import { RegistryClient, type FetchLike } from './registry-client';
import { PluginMarketplace } from './plugin-marketplace';
import { checkVersionSignature } from './plugin-signature';

/**
 * Real plugin update logic for `re-shell plugin update` and `plugin pin|unpin`.
 *
 * Per installed plugin (from `.re-shell/plugins.json`):
 *  - npm: query the registry packument (dist-tags + versions), resolve the
 *    target honouring a stored pin (an exact version holds the plugin at that
 *    version; a semver range bounds the update), and, unless check-only,
 *    reinstall through the marketplace/installer with signature verification
 *    when configured. The old install stays in place if anything fails.
 *  - git: `git ls-remote` the recorded ref and compare against the commit
 *    recorded at install time; reinstall from the same URL/ref when it moved.
 *  - local: reported as not updatable (there is no upstream to compare to).
 *
 * Every failure is reported per plugin as `status: "failed"` with the reason; the
 * caller turns any failure into a non-zero exit.
 */

/** Raised when the request itself is invalid (unknown plugin name). */
export class PluginUpdateInputError extends Error {
  readonly details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PluginUpdateInputError';
    this.details = details;
  }
}

/** Options for {@link updateInstalledPlugins}. */
export interface PluginUpdateOptions {
  workspaceRoot: string;
  /** Plugins to consider; empty/omitted means every installed plugin. */
  names?: string[];
  /** Report only; change nothing. */
  checkOnly?: boolean;
  /** Whether signature verification is required for npm updates (see `resolveVerifyPolicy`). */
  verifySignatures: boolean;
  /** npm registry URL (default: public registry). */
  registryUrl?: string;
  /** Injected fetch (tests). */
  fetchImpl?: FetchLike;
  /** Consider prerelease versions when resolving a range or the newest version. */
  allowPrerelease?: boolean;
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

function emptySummary(): PluginUpdateResponse['summary'] {
  return { total: 0, updated: 0, updateAvailable: 0, upToDate: 0, pinned: 0, notUpdatable: 0, failed: 0 };
}

function item(
  name: string,
  entry: PluginRegistryEntry,
  fields: Partial<PluginUpdateItem> & Pick<PluginUpdateItem, 'status'>
): PluginUpdateItem {
  return {
    name,
    source: entry.source,
    installed: entry.version,
    target: null,
    latest: null,
    pin: entry.pin ?? null,
    message: null,
    signature: null,
    ...fields,
  };
}

function toSignature(record: PluginRegistryEntry['signature']): PluginSignature | null {
  if (!record) return null;
  return {
    verified: record.verified,
    gated: record.gated,
    ...(record.keyid ? { keyid: record.keyid } : {}),
    ...(record.reason ? { reason: record.reason } : {}),
  };
}

// --- npm -------------------------------------------------------------------

async function checkNpm(
  name: string,
  entry: PluginRegistryEntry,
  options: PluginUpdateOptions,
  client: RegistryClient
): Promise<PluginUpdateItem> {
  let packument;
  try {
    packument = await client.getPackument(name);
  } catch (error) {
    return item(name, entry, {
      status: 'failed',
      message: `Could not query the registry: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  const published = Object.keys(packument.versions).filter((v) => semver.valid(v) !== null);
  const candidates = options.allowPrerelease ? published : published.filter((v) => !semver.prerelease(v));
  const latest = packument['dist-tags']?.latest ?? semver.maxSatisfying(candidates, '*') ?? null;
  const installed = entry.version;

  let target: string | null;
  const pin = entry.pin;
  if (pin) {
    if (semver.valid(pin)) {
      if (!published.includes(semver.valid(pin) as string)) {
        return item(name, entry, {
          status: 'failed',
          latest,
          message: `Pinned version ${pin} is not published for ${name}`,
        });
      }
      target = semver.valid(pin);
    } else if (semver.validRange(pin)) {
      // A pin range may legitimately name a prerelease line the user already runs.
      const pool = semver.prerelease(installed) ? published : candidates;
      target = semver.maxSatisfying(pool, pin);
      if (!target) {
        return item(name, entry, {
          status: 'failed',
          latest,
          message: `No published version of ${name} satisfies the pin "${pin}"`,
        });
      }
    } else {
      return item(name, entry, { status: 'failed', latest, message: `Invalid pin "${pin}" (expected a semver version or range)` });
    }
  } else {
    target = latest;
  }

  if (!target) {
    return item(name, entry, { status: 'failed', latest, message: `No installable version found for ${name}` });
  }

  if (target === installed) {
    const held = pin && latest && semver.valid(installed) && semver.gt(latest, installed);
    return item(name, entry, {
      status: held ? 'pinned' : 'up-to-date',
      target,
      latest,
      message: held ? `Held at ${installed} by pin "${pin}"; latest is ${latest}` : null,
    });
  }

  if (!pin && semver.valid(installed) && semver.lt(target, installed)) {
    return item(name, entry, {
      status: 'up-to-date',
      target,
      latest,
      message: `Installed ${installed} is newer than the registry's latest (${target})`,
    });
  }

  let signature: PluginSignature | null = null;
  if (options.verifySignatures) {
    try {
      const resolved = packument.versions[target];
      signature = await checkVersionSignature(client, resolved, true);
    } catch (error) {
      signature = {
        verified: false,
        gated: true,
        reason: `could not fetch registry signing keys: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  return item(name, entry, {
    status: 'update-available',
    target,
    latest,
    signature,
    message: pin ? `Pin "${pin}" resolves to ${target}` : null,
  });
}

async function applyNpm(
  name: string,
  entry: PluginRegistryEntry,
  planned: PluginUpdateItem,
  options: PluginUpdateOptions
): Promise<PluginUpdateItem> {
  const marketplace = new PluginMarketplace({
    ...(options.registryUrl ? { apiUrl: options.registryUrl } : {}),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    verifySignatures: options.verifySignatures,
    workspaceRoot: options.workspaceRoot,
  });
  try {
    // `force` replaces the existing directory; the installer stages the new copy
    // and keeps the old one if anything fails, and carries the pin over.
    const result = await marketplace.installPlugin(name, planned.target as string, { force: true });
    if (!result.success) {
      return { ...planned, status: 'failed', message: result.errors.join('; ') || 'Update failed', signature: result.signature };
    }
    return {
      ...planned,
      status: 'updated',
      target: result.installedVersion,
      signature: result.signature,
      message: `Updated ${entry.version} -> ${result.installedVersion}`,
    };
  } catch (error) {
    return { ...planned, status: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
}

// --- git -------------------------------------------------------------------

/**
 * Resolve the commit a remote ref currently points at (peeling annotated tags).
 *
 * @param url - Clone URL.
 * @param ref - Branch/tag, or undefined for the remote's HEAD.
 * @returns The commit SHA, or null when the ref does not exist on the remote.
 */
export async function resolveRemoteCommit(
  url: string,
  ref: string | undefined
): Promise<string | null> {
  const wanted = ref ?? 'HEAD';
  const out = await runGit(['ls-remote', '--', url, wanted, `${wanted}^{}`]);
  const rows = out
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((cols) => cols.length === 2 && /^[0-9a-f]{40}$/i.test(cols[0]));
  if (rows.length === 0) return null;

  const peeled = rows.find(([, name]) => name.endsWith('^{}'));
  if (peeled) return peeled[0];
  const exact = rows.find(
    ([, name]) =>
      name === wanted || name === `refs/heads/${wanted}` || name === `refs/tags/${wanted}`
  );
  return (exact ?? rows[0])[0];
}

async function checkGit(name: string, entry: PluginRegistryEntry): Promise<PluginUpdateItem> {
  const git = entry.git;
  if (!git?.url) {
    return item(name, entry, {
      status: 'failed',
      message: 'No git URL was recorded for this plugin; reinstall it with `plugin install <git-url> --force`',
    });
  }
  if (isCommitSha(git.ref)) {
    return item(name, entry, {
      status: 'up-to-date',
      target: shortSha(git.ref as string),
      message: `Installed from fixed commit ${shortSha(git.ref as string)}; it cannot move`,
    });
  }

  let remote: string | null;
  try {
    remote = await resolveRemoteCommit(git.url, git.ref);
  } catch (error) {
    return item(name, entry, {
      status: 'failed',
      message: `git ls-remote failed for ${git.url}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
    });
  }
  if (!remote) {
    return item(name, entry, {
      status: 'failed',
      message: `Ref "${git.ref ?? 'HEAD'}" was not found on ${git.url}`,
    });
  }

  if (git.commit && git.commit === remote) {
    return item(name, entry, { status: 'up-to-date', target: shortSha(remote) });
  }
  if (entry.pin) {
    return item(name, entry, {
      status: 'pinned',
      target: shortSha(remote),
      message: `Held at ${git.commit ? shortSha(git.commit) : entry.version} by pin "${entry.pin}"; remote is at ${shortSha(remote)}`,
    });
  }
  return item(name, entry, {
    status: 'update-available',
    target: shortSha(remote),
    message: git.commit
      ? `${shortSha(git.commit)} -> ${shortSha(remote)}`
      : `Installed commit is unknown (installed before commit tracking); remote is at ${shortSha(remote)}`,
  });
}

async function applyGit(
  name: string,
  entry: PluginRegistryEntry,
  planned: PluginUpdateItem,
  options: PluginUpdateOptions
): Promise<PluginUpdateItem> {
  const git = entry.git as NonNullable<PluginRegistryEntry['git']>;
  try {
    const result = await installPluginFromIdentifier(
      `git+${git.url}${git.ref ? `#${git.ref}` : ''}`,
      { workspaceRoot: options.workspaceRoot, force: true }
    );
    const now = (await readPluginsFile(options.workspaceRoot)).plugins[name];
    return {
      ...planned,
      status: 'updated',
      target: result.commit ? shortSha(result.commit) : planned.target,
      message: `Updated ${entry.version} -> ${result.version} (${result.commit ? shortSha(result.commit) : 'unknown commit'})`,
      signature: toSignature(now?.signature),
    };
  } catch (error) {
    return { ...planned, status: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
}

// --- orchestration -----------------------------------------------------------

/**
 * Check for, and (unless `checkOnly`) apply, updates for installed plugins.
 *
 * @param options - See {@link PluginUpdateOptions}.
 * @returns Per-plugin outcomes and a summary. Plugins are processed in name order.
 * @throws {PluginUpdateInputError} If a requested plugin is not installed.
 */
export async function updateInstalledPlugins(
  options: PluginUpdateOptions
): Promise<PluginUpdateResponse> {
  const file = await readPluginsFile(options.workspaceRoot);
  const requested = options.names?.filter((n) => n.length > 0) ?? [];

  for (const name of requested) {
    if (!file.plugins[name]) {
      throw new PluginUpdateInputError(`Plugin '${name}' is not installed`, { name, reason: 'not-found' });
    }
  }
  const names = (requested.length > 0 ? requested : Object.keys(file.plugins)).sort();

  const client = new RegistryClient({ registryUrl: options.registryUrl, fetchImpl: options.fetchImpl });
  const results: PluginUpdateItem[] = [];

  for (const name of names) {
    const entry = file.plugins[name];
    let planned: PluginUpdateItem;

    if (entry.source === 'npm') {
      planned = await checkNpm(name, entry, options, client);
    } else if (entry.source === 'git') {
      planned = await checkGit(name, entry);
    } else {
      planned = item(name, entry, {
        status: 'not-updatable',
        message:
          `Installed from a local path${entry.spec ? ` (${entry.spec})` : ''}; there is no upstream to check. ` +
          'Re-run `re-shell plugin install <path> --force` to refresh it.',
      });
    }

    if (!options.checkOnly && planned.status === 'update-available') {
      // Refuse to apply an update whose signature failed a required verification.
      if (entry.source === 'npm' && options.verifySignatures && planned.signature && !planned.signature.verified) {
        planned = {
          ...planned,
          status: 'failed',
          message: `Refusing to update to unverified ${planned.target}: ${planned.signature.reason ?? 'signature verification failed'}`,
        };
      } else {
        planned = entry.source === 'npm'
          ? await applyNpm(name, entry, planned, options)
          : await applyGit(name, entry, planned, options);
      }
    }
    results.push(planned);
  }

  const summary = emptySummary();
  summary.total = results.length;
  for (const r of results) {
    if (r.status === 'updated') summary.updated++;
    else if (r.status === 'update-available') summary.updateAvailable++;
    else if (r.status === 'up-to-date') summary.upToDate++;
    else if (r.status === 'pinned') summary.pinned++;
    else if (r.status === 'not-updatable') summary.notUpdatable++;
    else summary.failed++;
  }
  return { checkOnly: options.checkOnly === true, plugins: results, summary };
}

// --- pin / unpin ----------------------------------------------------------------

/**
 * Pin an installed plugin.
 *
 * @param workspaceRoot - Workspace root.
 * @param name - Installed plugin name.
 * @param spec - Exact version or semver range (npm), or a commit/ref (git). Omitted
 *   pins the currently installed version (npm/local) or commit (git).
 * @throws {PluginUpdateInputError} For an unknown plugin or an invalid pin.
 */
export async function pinInstalledPlugin(
  workspaceRoot: string,
  name: string,
  spec?: string
): Promise<PluginPinResponse> {
  const file = await readPluginsFile(workspaceRoot);
  const entry = file.plugins[name];
  if (!entry) {
    throw new PluginUpdateInputError(`Plugin '${name}' is not installed`, { name, reason: 'not-found' });
  }

  let pin: string;
  if (spec === undefined || spec.trim() === '') {
    pin = entry.source === 'git' ? entry.git?.commit ?? entry.version : entry.version;
  } else {
    pin = spec.trim();
    if (entry.source !== 'git' && semver.validRange(pin) === null) {
      throw new PluginUpdateInputError(
        `Invalid pin "${pin}": expected an exact version (1.2.3) or a semver range (^1.2.0)`,
        { name, pin, reason: 'invalid-pin' }
      );
    }
    if (entry.source !== 'git' && semver.valid(pin)) pin = semver.valid(pin) as string;
  }

  const updated = await setPluginPin(workspaceRoot, name, pin);
  if (!updated) throw new PluginUpdateInputError(`Plugin '${name}' is not installed`, { name, reason: 'not-found' });
  return { name, pin, previousPin: updated.previous, installed: entry.version };
}

/**
 * Remove a plugin's pin.
 *
 * @throws {PluginUpdateInputError} If the plugin is not installed.
 */
export async function unpinInstalledPlugin(
  workspaceRoot: string,
  name: string
): Promise<PluginPinResponse> {
  const updated = await setPluginPin(workspaceRoot, name, null);
  if (!updated) {
    throw new PluginUpdateInputError(`Plugin '${name}' is not installed`, { name, reason: 'not-found' });
  }
  return { name, pin: null, previousPin: updated.previous, installed: updated.entry.version };
}
