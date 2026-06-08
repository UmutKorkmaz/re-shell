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

export interface DriftVersion {
  version: string;
  /** Workspace names declaring this version of the dependency. */
  packages: string[];
}

export interface DriftEntry {
  dependency: string;
  versions: DriftVersion[];
}

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
