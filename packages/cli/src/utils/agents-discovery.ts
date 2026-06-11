import * as path from 'path';
import * as fs from 'fs-extra';
import fg from 'fast-glob';
import type { Command } from 'commander';
import { buildCommandCatalog } from './command-catalog';
import type { AgentsPackageInput, AgentsWorkspaceInput } from './agents-doc';

/**
 * Filesystem-facing discovery for `re-shell agents`.
 *
 * This is the ONLY layer that reads the disk. It walks a pnpm-style workspace,
 * reads each package's package.json, resolves internal (workspace) dependency
 * edges, derives the do-not-touch zones, and assembles the plain-data
 * {@link AgentsWorkspaceInput} the PURE generator (agents-doc.ts) consumes.
 *
 * Everything here is offline + deterministic: no network, fixed glob ordering,
 * and sorted package output so generated docs are byte-stable across runs.
 */

/** package.json subset we need (untrusted; validated by shape, not zod). */
interface RawPackageJson {
  name?: unknown;
  description?: unknown;
  scripts?: unknown;
  dependencies?: unknown;
  devDependencies?: unknown;
  peerDependencies?: unknown;
}

/** Default workspace globs when no pnpm-workspace.yaml is present. */
const DEFAULT_WORKSPACE_GLOBS = ['packages/*', 'apps/*'];

/** Directory names that are always build output / generated → do-not-touch. */
const ALWAYS_DO_NOT_TOUCH = ['dist', 'build', 'coverage', 'node_modules', '.turbo'];

/** Read a JSON file, returning null on any error (missing/malformed). */
async function readJsonSafe(file: string): Promise<RawPackageJson | null> {
  try {
    return (await fs.readJson(file)) as RawPackageJson;
  } catch {
    return null;
  }
}

/** Coerce an unknown value into a string→string record, dropping non-strings. */
function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/** Collect every dependency name across the three dependency maps. */
function allDependencyNames(pkg: RawPackageJson): string[] {
  const names = new Set<string>();
  for (const key of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
    const map = pkg[key];
    if (map && typeof map === 'object') {
      for (const dep of Object.keys(map as Record<string, unknown>)) names.add(dep);
    }
  }
  return Array.from(names);
}

/**
 * Parse the `packages:` globs out of pnpm-workspace.yaml WITHOUT a YAML
 * dependency: we only need the simple list-of-strings form pnpm uses. Falls
 * back to {@link DEFAULT_WORKSPACE_GLOBS} when the file is absent/unparseable.
 */
async function readWorkspaceGlobs(root: string): Promise<string[]> {
  const file = path.join(root, 'pnpm-workspace.yaml');
  if (!(await fs.pathExists(file))) return [...DEFAULT_WORKSPACE_GLOBS];
  const text = await fs.readFile(file, 'utf8');
  const globs: string[] = [];
  let inPackages = false;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (/^packages\s*:/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      const m = line.match(/^\s*-\s*['"]?([^'"#]+?)['"]?\s*(?:#.*)?$/);
      if (m) {
        globs.push(m[1].trim());
      } else if (/^\S/.test(line)) {
        // A new top-level key ends the packages list.
        break;
      }
    }
  }
  return globs.length > 0 ? globs : [...DEFAULT_WORKSPACE_GLOBS];
}

/** Normalise a path to POSIX separators relative to the workspace root. */
function relPosix(root: string, abs: string): string {
  return path.relative(root, abs).split(path.sep).join('/');
}

/** Detect the package manager from the lockfile present at the root. */
async function detectPackageManager(root: string): Promise<string> {
  if (await fs.pathExists(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await fs.pathExists(path.join(root, 'yarn.lock'))) return 'yarn';
  if (await fs.pathExists(path.join(root, 'bun.lockb'))) return 'bun';
  return 'npm';
}

/**
 * Discover the workspace surface rooted at `root` and assemble the pure-
 * generator input. `program` supplies the command catalogue so the root doc can
 * list the real CLI command groups (omit it to skip that section).
 */
export async function discoverWorkspace(
  root: string,
  program?: Command
): Promise<AgentsWorkspaceInput> {
  const rootPkg = (await readJsonSafe(path.join(root, 'package.json'))) ?? {};
  const projectName =
    typeof rootPkg.name === 'string' && rootPkg.name.length > 0
      ? rootPkg.name
      : path.basename(root);
  const projectDescription =
    typeof rootPkg.description === 'string' ? rootPkg.description : undefined;
  const rootScripts = toStringRecord(rootPkg.scripts);

  const globs = await readWorkspaceGlobs(root);
  const pkgJsonGlobs = globs.map(g => `${g.replace(/\/+$/, '')}/package.json`);
  const matches = await fg(pkgJsonGlobs, {
    cwd: root,
    absolute: true,
    ignore: ['**/node_modules/**'],
    onlyFiles: true,
  });
  // Deterministic order regardless of glob/FS ordering.
  matches.sort((a, b) => a.localeCompare(b));

  // First pass: read raw packages and index by name for internal-edge resolution.
  const raw: Array<{ dir: string; pkg: RawPackageJson }> = [];
  const namesInWorkspace = new Set<string>();
  for (const file of matches) {
    const pkg = await readJsonSafe(file);
    if (!pkg || typeof pkg.name !== 'string') continue;
    raw.push({ dir: relPosix(root, path.dirname(file)), pkg });
    namesInWorkspace.add(pkg.name);
  }

  const packages: AgentsPackageInput[] = raw.map(({ dir, pkg }) => {
    const internalDeps = allDependencyNames(pkg)
      .filter(name => namesInWorkspace.has(name) && name !== pkg.name)
      .sort((a, b) => a.localeCompare(b));
    return {
      name: pkg.name as string,
      dir,
      description: typeof pkg.description === 'string' ? pkg.description : undefined,
      scripts: toStringRecord(pkg.scripts),
      internalDeps,
    };
  });

  // Locate the contracts package entry, if one exists, for the JSON-contract note.
  const contractsPkg = packages.find(p => /contracts/.test(p.name));
  const contractsPath = contractsPkg ? `${contractsPkg.dir}/src/index.ts` : undefined;

  // Do-not-touch zones: well-known build dirs at the root + inside each package.
  const doNotTouch = new Set<string>();
  for (const dir of ALWAYS_DO_NOT_TOUCH) doNotTouch.add(`${dir}/`);
  for (const pkg of packages) {
    doNotTouch.add(`${pkg.dir}/dist/`);
  }

  const commandGroups = program
    ? Array.from(
        new Set(
          buildCommandCatalog(program)
            .map(entry => entry.path.split(' ')[0])
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b))
    : [];

  return {
    projectName,
    projectDescription,
    packageManager: await detectPackageManager(root),
    rootScripts,
    packages,
    contractsPath,
    commandGroups,
    doNotTouch: Array.from(doNotTouch),
  };
}
