// Pure release engine.
//
// This module is PURE: no filesystem, no git, no network, and ZERO
// `@re-shell/contracts` import (the CLI is CommonJS and contracts is ESM-only,
// so a value import would crash the binary; the wire shape is re-derived here
// and validated by the command layer). The only runtime dependency is `semver`.
//
// It owns the graph-aware bump propagation, the version arithmetic, the
// registry mapping, the changelog rendering, and the composition of a full
// release plan from those pieces. Everything is deterministic and side-effect
// free so it can be exhaustively unit-tested without touching a repo.

import semver from 'semver';

/**
 * Semantic-version bump level applied to a releasable unit.
 *
 * - `major`: breaking changes (X.0.0)
 * - `minor`: backwards-compatible features (0.X.0)
 * - `patch`: backwards-compatible fixes (0.0.X)
 */
export type BumpLevel = 'major' | 'minor' | 'patch';

/**
 * Reason a unit appears in the release plan.
 *
 * - `changed`: the unit had direct commits in this release.
 * - `dependent`: the unit was bumped only because it depends on a changed unit.
 */
export type ReleaseReason = 'changed' | 'dependent';

/** A workspace package that can be released. */
export interface ReleasableUnit {
  /** Package name (the graph key). */
  readonly name: string;
  /** Package directory path (relative to the workspace root), or "". */
  readonly path: string;
  /** Detected language (e.g. "typescript", "rust"). */
  readonly language: string;
  /** Detected manifest type (e.g. "package.json", "Cargo.toml"). */
  readonly manifestType: string;
  /** Current version read from the manifest. */
  readonly currentVersion: string;
}

/** One unit's computed entry in the release plan. */
export interface ReleasePlanEntry extends ReleasableUnit {
  /** Computed next version after the bump. */
  readonly nextVersion: string;
  /** Bump level applied to reach `nextVersion`. */
  readonly bumpLevel: BumpLevel;
  /** Why this unit is in the plan. */
  readonly reason: ReleaseReason;
  /** Rendered markdown changelog fragment for this unit. */
  readonly changelogEntry: string;
  /** Target registry the unit publishes to. */
  readonly registry: string;
}

/** A fully composed, deterministic release plan. */
export interface ReleasePlan {
  /** Ordered release plan entries, one per releasable unit that could be safely bumped. */
  readonly entries: readonly ReleasePlanEntry[];
  /** Human-readable warnings for units that were skipped (unknown registry, invalid version, etc.). */
  readonly warnings: readonly string[];
}

/** Rank of a bump level so a higher requested bump can win over `patch`. */
const BUMP_RANK: Readonly<Record<BumpLevel, number>> = {
  patch: 0,
  minor: 1,
  major: 2,
};

/** Return the higher-severity of two bump levels. */
function maxBump(a: BumpLevel, b: BumpLevel): BumpLevel {
  return BUMP_RANK[a] >= BUMP_RANK[b] ? a : b;
}

/**
 * Propagate bumps across the internal dependency graph.
 *
 * - Each CHANGED unit is bumped at its requested level (defaulting to `patch`
 *   when not in `requestedBumps`), reason `changed`.
 * - Every transitive internal DEPENDENT of a changed unit (reverse-graph BFS)
 *   is bumped `patch`, reason `dependent` — UNLESS that dependent is itself
 *   changed with a higher requested bump, in which case the higher
 *   changed-bump wins (and the reason stays `changed`).
 *
 * `graph` maps each unit to its UPSTREAM dependencies; dependents are the
 * reverse edges.
 *
 * @param changedNames - Set of package names that had direct changes this release.
 * @param requestedBumps - Map from package name to the bump level requested for it.
 *   Packages absent from this map default to `patch`.
 * @param graph - Dependency graph mapping each package name to its upstream
 *   (internal) dependencies. Reverse edges are treated as dependents.
 * @returns Map from every affected package name to the resolved bump level and reason.
 */
export function propagateBumps(
  changedNames: Set<string>,
  requestedBumps: Map<string, BumpLevel>,
  graph: Map<string, readonly string[]>
): Map<string, { level: BumpLevel; reason: ReleaseReason }> {
  // Reverse graph: dep -> packages that depend on it.
  const dependents = new Map<string, string[]>();
  for (const name of graph.keys()) dependents.set(name, []);
  for (const [pkg, deps] of graph) {
    for (const dep of deps) {
      if (!dependents.has(dep)) dependents.set(dep, []);
      dependents.get(dep)!.push(pkg);
    }
  }

  const result = new Map<string, { level: BumpLevel; reason: ReleaseReason }>();

  // Seed: changed units at their requested level (or patch default).
  for (const name of changedNames) {
    const level = requestedBumps.get(name) ?? 'patch';
    result.set(name, { level, reason: 'changed' });
  }

  // BFS over reverse edges from the changed set, propagating `patch` dependents.
  const stack = [...changedNames];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const downstream of dependents.get(cur) ?? []) {
      const existing = result.get(downstream);
      if (existing === undefined) {
        result.set(downstream, { level: 'patch', reason: 'dependent' });
        stack.push(downstream);
        continue;
      }
      // A changed unit keeps its (possibly higher) requested bump + reason.
      if (existing.reason === 'changed') continue;
      // Already a dependent at patch; nothing higher to apply.
    }
  }

  // A changed-with-higher-bump unit must out-rank any dependent patch it also
  // received: re-assert changed seeds (idempotent, keeps the higher level).
  for (const name of changedNames) {
    const requested = requestedBumps.get(name) ?? 'patch';
    const existing = result.get(name);
    const level = existing ? maxBump(existing.level, requested) : requested;
    result.set(name, { level, reason: 'changed' });
  }

  return result;
}

/**
 * Bump `current` by `level` using semver arithmetic.
 *
 * Throws a clear error when `current` is not a valid semantic version.
 *
 * @param current - The current semantic version string to bump (e.g. "1.2.3").
 * @param level - The bump level to apply (`major`, `minor`, or `patch`).
 * @returns The next semantic version after applying the bump.
 * @throws {Error} When `current` is not a valid semantic version.
 */
export function bumpVersion(current: string, level: BumpLevel): string {
  const next = semver.inc(current, level);
  if (next === null) {
    throw new Error(
      `Cannot bump invalid version "${current}" (expected a valid semver string)`
    );
  }
  return next;
}

/**
 * Map a detected language to its default package registry name.
 *
 * Known mappings include `typescript`/`javascript` -> `npm`, `python` -> `pypi`,
 * `rust` -> `crates.io`, `java` -> `maven`, `csharp` -> `nuget`,
 * `php` -> `packagist`, and `ruby` -> `rubygems`. Any other language yields
 * `"unknown"`, which causes the unit to be skipped during plan computation.
 *
 * @param language - The detected language identifier (e.g. "typescript", "rust").
 * @returns The default registry name for the language, or `"unknown"` if unsupported.
 */
export function registryForLanguage(language: string): string {
  switch (language) {
    case 'typescript':
    case 'javascript':
      return 'npm';
    case 'python':
      return 'pypi';
    case 'rust':
      return 'crates.io';
    case 'java':
      return 'maven';
    case 'csharp':
      return 'nuget';
    case 'php':
      return 'packagist';
    case 'ruby':
      return 'rubygems';
    default:
      return 'unknown';
  }
}

/**
 * Render a markdown changelog fragment for one unit.
 *
 * For a `changed` unit it lists the commit subjects as bullets (falling back to
 * a generic note when the subject list is empty); for a `dependent` bump with no
 * commits it emits a "dependency bump" note so the entry is never blank.
 *
 * @param name - The package name this fragment belongs to.
 * @param version - The next version the package will be released as.
 * @param reason - Why the package is in the release plan (`changed` or `dependent`).
 * @param commitLines - Raw commit subject lines to render as bullets. Whitespace-only
 *   and empty entries are filtered out.
 * @returns A markdown changelog fragment ending with a trailing newline.
 */
export function buildChangelogEntry(
  name: string,
  version: string,
  reason: ReleaseReason,
  commitLines: string[]
): string {
  const header = `## ${name}@${version}`;
  const subjects = commitLines.map(l => l.trim()).filter(l => l.length > 0);

  if (subjects.length === 0) {
    const note =
      reason === 'dependent'
        ? '- Dependency bump (no direct changes)'
        : '- Maintenance release (no recorded commit subjects)';
    return `${header}\n\n${note}\n`;
  }

  const bullets = subjects.map(s => `- ${s}`).join('\n');
  return `${header}\n\n${bullets}\n`;
}

/**
 * Compose a full release plan: propagate bumps across the graph, compute each
 * unit's next version, and render its changelog fragment.
 *
 * Units with an `unknown` registry or an unbumpable (invalid) current version
 * are recorded as warnings and excluded from the entries (they cannot be safely
 * released).
 *
 * @param units - All releasable units discovered in the workspace.
 * @param changedNames - Set of package names that had direct changes this release.
 * @param requestedBumps - Map from package name to the bump level requested for it.
 *   Packages absent from this map default to `patch`.
 * @param graph - Dependency graph mapping each package name to its upstream
 *   (internal) dependencies.
 * @param commitsByPkg - Map from package name to its raw commit subject lines,
 *   used to render changelog entries.
 * @returns A fully composed, deterministic release plan with entries sorted
 *   alphabetically by package name and any warnings for skipped units.
 */
export function computeReleasePlan(
  units: ReleasableUnit[],
  changedNames: Set<string>,
  requestedBumps: Map<string, BumpLevel>,
  graph: Map<string, readonly string[]>,
  commitsByPkg: Map<string, string[]>
): ReleasePlan {
  const bumps = propagateBumps(changedNames, requestedBumps, graph);
  const byName = new Map(units.map(u => [u.name, u]));
  const entries: ReleasePlanEntry[] = [];
  const warnings: string[] = [];

  // Deterministic order: alphabetical by name.
  const names = [...bumps.keys()].sort((a, b) => a.localeCompare(b));

  for (const name of names) {
    const unit = byName.get(name);
    if (unit === undefined) {
      // A bump targeting a unit with no readable manifest is surfaced, not silent.
      warnings.push(`skipping "${name}": no releasable unit metadata available`);
      continue;
    }

    const registry = registryForLanguage(unit.language);
    if (registry === 'unknown') {
      warnings.push(
        `skipping "${name}": no known registry for language "${unit.language}"`
      );
      continue;
    }

    const { level, reason } = bumps.get(name)!;
    let nextVersion: string;
    try {
      nextVersion = bumpVersion(unit.currentVersion, level);
    } catch (error) {
      warnings.push(
        `skipping "${name}": ${error instanceof Error ? error.message : 'invalid version'}`
      );
      continue;
    }

    const changelogEntry = buildChangelogEntry(
      name,
      nextVersion,
      reason,
      commitsByPkg.get(name) ?? []
    );

    entries.push({
      ...unit,
      nextVersion,
      bumpLevel: level,
      reason,
      changelogEntry,
      registry,
    });
  }

  return { entries, warnings };
}
