// `re-shell federation check` — PURE module-federation contract engine.
//
// Parses Module-Federation manifests (bundler-independent: webpack / Rspack /
// Vite emit a compatible shape) into a normalized remote model, diffs the
// current manifest against a baseline for breaking export/type changes, and
// detects shared-dependency version skew across remotes. This module is
// intentionally I/O-free and contracts-free: it only transforms in-memory
// manifest documents into findings. The command layer reads the manifests off
// disk; this file never touches the filesystem.
//
// No mutation of any input is ever performed — every function returns fresh data.

import semver from 'semver';

/**
 * One exposed module, normalized from any of the manifest shapes MF plugins
 * emit (array of {id}, map of id→path, or map of id→{import, types}).
 */
export interface FederationExposeLite {
  readonly id: string;
  readonly path?: string;
  readonly types?: string;
}

/** One shared dependency, normalized from any shared-dep manifest shape. */
export interface FederationSharedLite {
  readonly name: string;
  readonly version?: string;
  readonly requiredVersion?: string;
  readonly singleton?: boolean;
}

/** One remote (federation container) parsed from a manifest. */
export interface FederationRemoteLite {
  readonly name: string;
  readonly exposes: readonly FederationExposeLite[];
  readonly shared: readonly FederationSharedLite[];
}

/** A finding the engine emits, mirroring the contracts FederationFinding. */
export interface FederationFindingLite {
  readonly severity: 'breaking' | 'skew' | 'info';
  readonly kind: string;
  readonly message: string;
  readonly remote?: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

/** Is the value a plain object (record) and not an array/null? */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Coerce a possibly-undefined string field. */
function optString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Coerce a possibly-undefined boolean field. */
function optBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * Normalize the `exposes` field of a manifest. Accepts:
 *   - array of { id | name | moduleName, path?, types? }
 *   - map of id → "./path"  (string)
 *   - map of id → { import, types }
 * Returns a stable, id-sorted list of exposes.
 */
export function normalizeExposes(raw: unknown): FederationExposeLite[] {
  const out: FederationExposeLite[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!isRecord(entry)) continue;
      const id = optString(entry['id']) ?? optString(entry['name']) ?? optString(entry['moduleName']);
      if (!id) continue;
      out.push({
        id,
        ...(optString(entry['path']) ? { path: optString(entry['path']) } : {}),
        ...(optString(entry['types']) ? { types: optString(entry['types']) } : {}),
      });
    }
  } else if (isRecord(raw)) {
    for (const [id, val] of Object.entries(raw)) {
      if (typeof val === 'string') {
        out.push({ id, path: val });
      } else if (isRecord(val)) {
        out.push({
          id,
          ...(optString(val['import']) ? { path: optString(val['import']) } : {}),
          ...(optString(val['path']) ? { path: optString(val['path']) } : {}),
          ...(optString(val['types']) ? { types: optString(val['types']) } : {}),
        });
      }
    }
  }
  return [...out].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Normalize the `shared` field of a manifest. Accepts:
 *   - array of { name | id, version?, requiredVersion?, singleton? }
 *   - map of name → string (a bare requiredVersion)
 *   - map of name → { version, requiredVersion, singleton, eager }
 * Returns a stable, name-sorted list of shared deps.
 */
export function normalizeShared(raw: unknown): FederationSharedLite[] {
  const out: FederationSharedLite[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!isRecord(entry)) continue;
      const name = optString(entry['name']) ?? optString(entry['id']);
      if (!name) continue;
      out.push({
        name,
        ...(optString(entry['version']) ? { version: optString(entry['version']) } : {}),
        ...(optString(entry['requiredVersion']) ? { requiredVersion: optString(entry['requiredVersion']) } : {}),
        ...(optBool(entry['singleton']) !== undefined ? { singleton: optBool(entry['singleton']) } : {}),
      });
    }
  } else if (isRecord(raw)) {
    for (const [name, val] of Object.entries(raw)) {
      if (typeof val === 'string') {
        out.push({ name, requiredVersion: val });
      } else if (isRecord(val)) {
        out.push({
          name,
          ...(optString(val['version']) ? { version: optString(val['version']) } : {}),
          ...(optString(val['requiredVersion']) ? { requiredVersion: optString(val['requiredVersion']) } : {}),
          ...(optBool(val['singleton']) !== undefined ? { singleton: optBool(val['singleton']) } : {}),
        });
      }
    }
  }
  return [...out].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Parse a raw manifest document into a normalized remote. Reads the container
 * `name` from `name`/`id`/`uniqueName` (falling back to `fallbackName`), then
 * normalizes its `exposes` and `shared`. Returns null when no name is derivable.
 */
export function parseManifest(
  raw: unknown,
  fallbackName?: string
): FederationRemoteLite | null {
  if (!isRecord(raw)) return null;
  const name =
    optString(raw['name']) ??
    optString(raw['id']) ??
    optString(raw['uniqueName']) ??
    fallbackName;
  if (!name) return null;
  return {
    name,
    exposes: normalizeExposes(raw['exposes']),
    shared: normalizeShared(raw['shared']),
  };
}

/** The breaking-change diff of a single remote against its baseline. */
export interface FederationDiff {
  /** Removed expose ids. */
  readonly removedExposes: readonly string[];
  /** Expose ids whose declared types changed (narrowed/renamed). */
  readonly narrowedExposes: readonly { id: string; from?: string; to?: string }[];
  /** Shared deps whose requiredVersion range narrowed or changed. */
  readonly changedShared: readonly { name: string; from?: string; to?: string }[];
}

/**
 * Diff a current remote against its baseline. A diff is breaking when:
 *   - an exposed module was REMOVED (consumers importing it break),
 *   - an exposed module's declared TYPES changed (type loss / signature drift),
 *   - a shared dep's requiredVersion NARROWED (excludes versions consumers relied on).
 * New exposes and WIDENED shared ranges are non-breaking (additions).
 */
export function diffRemote(
  baseline: FederationRemoteLite,
  current: FederationRemoteLite
): FederationDiff {
  const baseExposes = new Map(baseline.exposes.map(e => [e.id, e]));
  const curExposes = new Map(current.exposes.map(e => [e.id, e]));

  const removedExposes: string[] = [];
  const narrowedExposes: { id: string; from?: string; to?: string }[] = [];
  for (const [id, baseExpose] of baseExposes) {
    const curExpose = curExposes.get(id);
    if (!curExpose) {
      removedExposes.push(id);
      continue;
    }
    // A types change (including removal of a types declaration) is a breaking
    // type-narrowing: consumers' type checking against the old types breaks.
    if (baseExpose.types !== curExpose.types) {
      narrowedExposes.push({ id, from: baseExpose.types, to: curExpose.types });
    }
  }

  const baseShared = new Map(baseline.shared.map(s => [s.name, s]));
  const curShared = new Map(current.shared.map(s => [s.name, s]));
  const changedShared: { name: string; from?: string; to?: string }[] = [];
  for (const [name, baseDep] of baseShared) {
    const curDep = curShared.get(name);
    if (!curDep) continue; // dropping a shared dep is not breaking for consumers
    // Only a NARROWING (the new range EXCLUDES versions consumers relied on) is
    // breaking. A widening (^18.0.0 → ^18) or an additive union is consumer-safe
    // and must NOT trip the gate. semver.subset(from, to) is true when every
    // version `from` accepts is also accepted by `to`, i.e. `to` widened.
    if (narrowsVersionRange(baseDep.requiredVersion, curDep.requiredVersion)) {
      changedShared.push({
        name,
        from: baseDep.requiredVersion,
        to: curDep.requiredVersion,
      });
    }
  }

  return { removedExposes, narrowedExposes, changedShared };
}

/**
 * True when the new requiredVersion range NARROWS the old one (excludes versions
 * consumers relied on) — a consumer-breaking change. Pure widenings and unions
 * (where the old range is a subset of the new) are non-breaking. Gaining or
 * losing a requiredVersion constraint entirely is treated as a change. Falls
 * back to strict inequality for ranges semver cannot parse.
 */
export function narrowsVersionRange(
  from: string | undefined,
  to: string | undefined
): boolean {
  if (from === to) return false;
  if (!from || !to) return from !== to;
  try {
    const a = new semver.Range(from);
    const b = new semver.Range(to);
    // `to` is consumer-safe (a widening or equal) iff everything `from` accepts
    // is still accepted by `to`. So it is breaking iff `from` is NOT a subset.
    return !semver.subset(a, b);
  } catch {
    return from !== to;
  }
}

/** A shared-dependency skew across remotes. */
export interface FederationSkew {
  readonly dep: string;
  readonly remotes: readonly { remote: string; version?: string }[];
}

/**
 * Detect shared-dependency version skew across remotes: when two remotes declare
 * a DIFFERENT resolved `version` for the same shared SINGLETON dep, consumers
 * may load two copies → the #1 MF runtime failure. Returns one skew entry per
 * dep that diverges (the remotes list carries each remote + its version).
 *
 * Only SINGLETON shared deps are considered: Module Federation only collapses a
 * dep to a single runtime copy when `singleton` is true, so divergent versions
 * of a non-singleton dep are expected (each remote gets its own copy by design),
 * not a "two copies" failure. A degenerate single remote declaring a dep twice
 * is never reported as skew against itself.
 */
export function detectSharedSkew(
  remotes: readonly FederationRemoteLite[]
): FederationSkew[] {
  // dep name → map of version → remotes claiming it.
  const byDep = new Map<string, Map<string, string[]>>();
  for (const remote of remotes) {
    for (const dep of remote.shared) {
      // MF only collapses a shared dep to a single copy when it is a singleton;
      // divergence on a non-singleton dep is expected, not skew.
      if (dep.singleton !== true) continue;
      const version = dep.version ?? '(unspecified)';
      let versions = byDep.get(dep.name);
      if (!versions) {
        versions = new Map();
        byDep.set(dep.name, versions);
      }
      let holders = versions.get(version);
      if (!holders) {
        holders = [];
        versions.set(version, holders);
      }
      holders.push(remote.name);
    }
  }

  const skews: FederationSkew[] = [];
  for (const [dep, versions] of byDep) {
    // Only a divergence (>= 2 distinct resolved versions) is a skew. A single
    // version across remotes is healthy singleton sharing.
    if (versions.size < 2) continue;
    const remoteList: { remote: string; version?: string }[] = [];
    for (const [version, holders] of versions) {
      for (const remote of holders) {
        remoteList.push({
          remote,
          ...(version === '(unspecified)' ? {} : { version }),
        });
      }
    }
    // Require at least two DISTINCT remotes: a single remote declaring a dep
    // twice with different versions is a malformed manifest, not cross-remote
    // skew, and reporting it as "across remotes" would be nonsensical.
    if (new Set(remoteList.map(r => r.remote)).size < 2) continue;
    remoteList.sort((a, b) => a.remote.localeCompare(b.remote));
    skews.push({ dep, remotes: remoteList });
  }
  return [...skews].sort((a, b) => a.dep.localeCompare(b.dep));
}

/**
 * Turn a diff into findings (breaking severity). Expose removals and type
 * narrowings are breaking; shared-range changes are breaking for consumers.
 */
export function diffToFindings(
  remoteName: string,
  diff: FederationDiff
): FederationFindingLite[] {
  const findings: FederationFindingLite[] = [];
  for (const id of diff.removedExposes) {
    findings.push({
      severity: 'breaking',
      kind: 'expose-removed',
      message: `Exposed module "${id}" was removed from remote "${remoteName}"`,
      remote: remoteName,
      detail: { expose: id },
    });
  }
  for (const entry of diff.narrowedExposes) {
    findings.push({
      severity: 'breaking',
      kind: 'type-narrowed',
      message: `Types for exposed module "${entry.id}" changed on remote "${remoteName}"`,
      remote: remoteName,
      detail: { expose: entry.id, from: entry.from, to: entry.to },
    });
  }
  for (const entry of diff.changedShared) {
    findings.push({
      severity: 'breaking',
      kind: 'shared-narrowed',
      message: `Shared "${entry.name}" requiredVersion changed on remote "${remoteName}"`,
      remote: remoteName,
      detail: { shared: entry.name, from: entry.from, to: entry.to },
    });
  }
  return findings;
}

/** Turn a skew entry into a finding (skew severity). */
export function skewToFindings(skew: FederationSkew): FederationFindingLite {
  const versions = [...new Set(skew.remotes.map(r => r.version ?? '(unspecified)'))];
  return {
    severity: 'skew',
    kind: 'shared-skew',
    message: `Shared "${skew.dep}" resolves to ${versions.length} different versions across remotes: ${versions.join(', ')}`,
    detail: {
      shared: skew.dep,
      versions,
      remotes: skew.remotes.map(r => ({ remote: r.remote, version: r.version })),
    },
  };
}
