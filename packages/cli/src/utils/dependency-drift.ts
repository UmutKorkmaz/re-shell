import * as fs from 'fs-extra';
import * as path from 'path';
import { getWorkspaces } from './monorepo';

/**
 * Dependency drift detection (P9-G2).
 *
 * Scans every workspace package.json in the monorepo and reports any single
 * dependency that is pinned to DIFFERENT version ranges across packages. A
 * clean monorepo (every shared dependency aligned) yields an empty `drift`
 * array. CLI-free: returns plain data for the command layer to envelope.
 */

/**
 * Represents a single version of a dependency along with the workspace packages
 * that declare it.
 */
export interface DriftVersion {
  version: string;
  /** Workspace names declaring this version of the dependency. */
  packages: string[];
}

/**
 * Represents a single dependency that has drifted across workspace packages,
 * listing every distinct version range detected and the packages using each.
 */
export interface DriftEntry {
  dependency: string;
  versions: DriftVersion[];
}

/**
 * The complete result of a dependency drift scan, containing one entry per
 * dependency that is pinned to multiple version ranges.
 */
export interface DriftResult {
  drift: DriftEntry[];
}

interface WorkspacePackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    return (await fs.readJson(filePath)) as T;
  } catch {
    return null;
  }
}

function collectDeps(pkg: WorkspacePackageJson): Record<string, string> {
  return {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
    ...pkg.optionalDependencies,
  };
}

/**
 * Detect dependency drift across the monorepo rooted at `rootPath`.
 *
 * Internal map: dependency -> (version -> sorted set of workspace names). Only
 * dependencies seen with more than one distinct version are reported. Output is
 * deterministically ordered (dependency asc, then version asc) so callers and
 * tests get stable results.
 */
export async function detectDependencyDrift(
  rootPath: string = process.cwd()
): Promise<DriftResult> {
  const workspaces = await getWorkspaces(rootPath);

  // dependency -> version -> Set<workspaceName>
  const index = new Map<string, Map<string, Set<string>>>();

  for (const workspace of workspaces) {
    const pkg = await readJsonSafe<WorkspacePackageJson>(
      path.join(rootPath, workspace.path, 'package.json')
    );
    if (!pkg) continue;
    const wsName = pkg.name ?? workspace.name;
    const deps = collectDeps(pkg);

    for (const [dependency, version] of Object.entries(deps)) {
      let byVersion = index.get(dependency);
      if (!byVersion) {
        byVersion = new Map<string, Set<string>>();
        index.set(dependency, byVersion);
      }
      let pkgSet = byVersion.get(version);
      if (!pkgSet) {
        pkgSet = new Set<string>();
        byVersion.set(version, pkgSet);
      }
      pkgSet.add(wsName);
    }
  }

  const drift: DriftEntry[] = [];

  for (const [dependency, byVersion] of index) {
    if (byVersion.size < 2) continue; // aligned across all packages
    const versions: DriftVersion[] = [...byVersion.entries()]
      .map(([version, pkgSet]) => ({
        version,
        packages: [...pkgSet].sort(),
      }))
      .sort((a, b) => a.version.localeCompare(b.version));
    drift.push({ dependency, versions });
  }

  drift.sort((a, b) => a.dependency.localeCompare(b.dependency));

  return { drift };
}

// --- Severity, scoring, suggestions, reporting -------------------------------

export type DriftSeverity = 'major' | 'minor' | 'patch';

const SEMVER_RE = /^[\^~v]?(\d+)\.(\d+)\.(\d+)/;

function parseSemver(version: string): [number, number, number] | null {
  const m = version.match(SEMVER_RE);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

/**
 * Classify the severity of the version difference between two range strings.
 * Falls back to `'minor'` when either version cannot be parsed.
 */
export function classifyDriftSeverity(v1: string, v2: string): DriftSeverity {
  const a = parseSemver(v1);
  const b = parseSemver(v2);
  if (!a || !b) return 'minor';
  if (a[0] !== b[0]) return 'major';
  if (a[1] !== b[1]) return 'minor';
  return 'patch';
}

export interface AlignmentSuggestion {
  version: string;
  confidence: number;
  affectedPackages: string[];
}

/**
 * Suggest the version to align on: the one used by the most packages.
 * Ties are broken by choosing the higher version. `confidence` is the
 * proportion of packages already on the suggested version.
 */
export function suggestAlignment(entry: DriftEntry): AlignmentSuggestion {
  const totalPackages = entry.versions.reduce((sum, v) => sum + v.packages.length, 0);

  const sorted = [...entry.versions].sort((a, b) => {
    if (b.packages.length !== a.packages.length) {
      return b.packages.length - a.packages.length; // more users first
    }
    // tie → higher version wins
    const av = parseSemver(a.version);
    const bv = parseSemver(b.version);
    if (av && bv) {
      for (let i = 0; i < 3; i++) {
        if (bv[i] !== av[i]) return bv[i] - av[i];
      }
    }
    return b.version.localeCompare(a.version);
  });

  const best = sorted[0];
  const confidence = totalPackages > 0 ? best.packages.length / totalPackages : 0;

  const affectedPackages = entry.versions
    .filter((v) => v.version !== best.version)
    .flatMap((v) => v.packages);

  return {
    version: best.version,
    confidence,
    affectedPackages,
  };
}

const SEVERITY_RANK: Record<DriftSeverity, number> = { patch: 0, minor: 1, major: 2 };

/**
 * Return the worst (highest-impact) severity across all version pairs in an entry.
 */
function worstSeverity(entry: DriftEntry): DriftSeverity {
  let worst: DriftSeverity = 'patch';
  for (let i = 0; i < entry.versions.length; i++) {
    for (let j = i + 1; j < entry.versions.length; j++) {
      const s = classifyDriftSeverity(entry.versions[i].version, entry.versions[j].version);
      if (SEVERITY_RANK[s] > SEVERITY_RANK[worst]) worst = s;
    }
  }
  return worst;
}

/**
 * Compute a 0–100 alignment score. 100 means zero drift. Each drift entry
 * reduces the score, weighted by severity (major > minor > patch).
 */
export function computeDriftScore(result: DriftResult): number {
  if (result.drift.length === 0) return 100;

  const weights: Record<DriftSeverity, number> = {
    major: 15,
    minor: 8,
    patch: 3,
  };

  let penalty = 0;
  for (const entry of result.drift) {
    penalty += weights[worstSeverity(entry)];
  }

  return Math.max(0, 100 - penalty);
}

/**
 * Generate a human-readable markdown drift report.
 */
export function generateDriftReport(result: DriftResult, workspaceName: string): string {
  const score = computeDriftScore(result);
  const lines: string[] = [
    `# Dependency Drift Report — ${workspaceName}`,
    '',
    `**Alignment Score:** ${score}/100`,
    '',
  ];

  if (result.drift.length === 0) {
    lines.push('✅ No drift detected — all shared dependencies are aligned.');
    return lines.join('\n');
  }

  lines.push(`Found **${result.drift.length}** drifted dependenc${result.drift.length === 1 ? 'y' : 'ies'}:`);
  lines.push('');

  for (const entry of result.drift) {
    const severity = worstSeverity(entry);

    lines.push(`## ${entry.dependency}  \`${severity}\``);
    lines.push('');

    for (const v of entry.versions) {
      lines.push(`- \`${v.version}\` — ${v.packages.join(', ')}`);
    }

    const suggestion = suggestAlignment(entry);
    lines.push('');
    lines.push(`**Suggestion:** Align to \`${suggestion.version}\` (confidence: ${(suggestion.confidence * 100).toFixed(0)}%)`);
    if (suggestion.affectedPackages.length > 0) {
      lines.push(`Affected packages: ${suggestion.affectedPackages.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}
