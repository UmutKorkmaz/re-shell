// Ecosystem detection for a target directory. Each language family contributes
// at most one candidate; the Node and Python families pick the concrete tool
// (npm/pnpm/yarn/bun, pip/poetry/uv) from lockfiles and manifest hints.

import * as fs from 'fs';
import * as path from 'path';
import { parse as parseToml } from 'smol-toml';

import type { Ecosystem } from './types';

export type EcosystemFamily =
  | 'node'
  | 'python'
  | 'rust'
  | 'maven'
  | 'gradle'
  | 'dotnet'
  | 'php'
  | 'ruby'
  | 'go';

export interface DetectionCandidate {
  family: EcosystemFamily;
  ecosystem: Ecosystem;
  /** Human-readable evidence for the choice. */
  reason: string;
}

const NODE_LOCKFILES: Array<[string, Ecosystem]> = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
];

function exists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function readJson(p: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Decide which Node package manager owns `dir`. Priority: a lockfile in `dir`,
 * the `packageManager` field of package.json, a lockfile in an ancestor
 * workspace root (stopping at the first `.git`), then npm.
 */
export function detectNodeManager(dir: string): { ecosystem: Ecosystem; reason: string } {
  for (const [file, eco] of NODE_LOCKFILES) {
    if (exists(path.join(dir, file))) return { ecosystem: eco, reason: `lockfile ${file}` };
  }
  const pkg = readJson(path.join(dir, 'package.json'));
  const pm = typeof pkg?.packageManager === 'string' ? pkg.packageManager : '';
  const pmName = pm.split('@')[0] as Ecosystem;
  if (pmName === 'pnpm' || pmName === 'yarn' || pmName === 'npm' || pmName === 'bun') {
    return { ecosystem: pmName, reason: `package.json packageManager "${pm}"` };
  }
  // Walk up to an enclosing workspace root, but never past a repository root.
  let child = path.resolve(dir);
  while (!exists(path.join(child, '.git'))) {
    const parent = path.dirname(child);
    if (parent === child) break;
    for (const [file, eco] of NODE_LOCKFILES) {
      if (exists(path.join(parent, file))) {
        return { ecosystem: eco, reason: `workspace-root lockfile ${path.join(parent, file)}` };
      }
    }
    child = parent;
  }
  return { ecosystem: 'npm', reason: 'package.json without a lockfile (defaulting to npm)' };
}

/** True when a yarn project uses Berry (>= 2), which has no `yarn outdated`. */
export function isYarnBerry(dir: string): boolean {
  if (exists(path.join(dir, '.yarnrc.yml'))) return true;
  const pkg = readJson(path.join(dir, 'package.json'));
  const pm = typeof pkg?.packageManager === 'string' ? pkg.packageManager : '';
  const m = /^yarn@(\d+)/.exec(pm);
  return m ? Number(m[1]) >= 2 : false;
}

function detectPython(dir: string): { ecosystem: Ecosystem; reason: string } | null {
  const hasPyproject = exists(path.join(dir, 'pyproject.toml'));
  const hasReq = fs.existsSync(dir) && fs.readdirSync(dir).some(f => /^requirements.*\.txt$/.test(f));
  const hasSetup = exists(path.join(dir, 'setup.py')) || exists(path.join(dir, 'setup.cfg'));
  const hasPoetryLock = exists(path.join(dir, 'poetry.lock'));
  const hasUvLock = exists(path.join(dir, 'uv.lock'));
  if (!hasPyproject && !hasReq && !hasSetup && !hasPoetryLock && !hasUvLock) return null;

  if (hasUvLock) return { ecosystem: 'uv', reason: 'lockfile uv.lock' };
  if (hasPoetryLock) return { ecosystem: 'poetry', reason: 'lockfile poetry.lock' };
  if (hasPyproject) {
    try {
      const doc = parseToml(fs.readFileSync(path.join(dir, 'pyproject.toml'), 'utf8')) as {
        tool?: Record<string, unknown>;
      };
      if (doc.tool && 'poetry' in doc.tool) {
        return { ecosystem: 'poetry', reason: 'pyproject.toml [tool.poetry]' };
      }
      if (doc.tool && 'uv' in doc.tool) {
        return { ecosystem: 'uv', reason: 'pyproject.toml [tool.uv]' };
      }
    } catch {
      /* unparseable pyproject falls through to pip */
    }
  }
  return {
    ecosystem: 'pip',
    reason: hasReq ? 'requirements.txt' : hasPyproject ? 'pyproject.toml (no poetry/uv markers)' : 'setup.py',
  };
}

function listDir(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

/** Project files (csproj/fsproj/vbproj) directly inside `dir`. */
export function findDotnetProjects(dir: string): string[] {
  return listDir(dir)
    .filter(f => /\.(cs|fs|vb)proj$/i.test(f))
    .sort();
}

/**
 * Detect every ecosystem family present in `dir` (one candidate per family).
 *
 * @param dir - Target directory.
 * @returns Candidates in a stable family order; empty when nothing is detected.
 */
export function detectEcosystems(dir: string): DetectionCandidate[] {
  const out: DetectionCandidate[] = [];
  if (exists(path.join(dir, 'package.json'))) {
    const node = detectNodeManager(dir);
    out.push({ family: 'node', ...node });
  }
  const py = detectPython(dir);
  if (py) out.push({ family: 'python', ...py });
  if (exists(path.join(dir, 'Cargo.toml'))) {
    out.push({ family: 'rust', ecosystem: 'cargo', reason: 'Cargo.toml' });
  }
  if (exists(path.join(dir, 'pom.xml'))) {
    out.push({ family: 'maven', ecosystem: 'maven', reason: 'pom.xml' });
  }
  const gradleFile = ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'].find(f =>
    exists(path.join(dir, f))
  );
  if (gradleFile) out.push({ family: 'gradle', ecosystem: 'gradle', reason: gradleFile });
  const dotnet = findDotnetProjects(dir);
  if (dotnet.length > 0) {
    out.push({ family: 'dotnet', ecosystem: 'dotnet', reason: dotnet.join(', ') });
  } else if (listDir(dir).some(f => /\.slnx?$/i.test(f))) {
    out.push({ family: 'dotnet', ecosystem: 'dotnet', reason: 'solution file' });
  }
  if (exists(path.join(dir, 'composer.json'))) {
    out.push({ family: 'php', ecosystem: 'composer', reason: 'composer.json' });
  }
  if (exists(path.join(dir, 'Gemfile'))) {
    out.push({ family: 'ruby', ecosystem: 'bundler', reason: 'Gemfile' });
  }
  if (exists(path.join(dir, 'go.mod'))) {
    out.push({ family: 'go', ecosystem: 'go', reason: 'go.mod' });
  }
  return out;
}

/** Path of the Python interpreter to use for pip operations in `dir`. */
export function resolvePythonForPip(dir: string): string {
  const venvs = ['.venv', 'venv'];
  for (const v of venvs) {
    const unix = path.join(dir, v, 'bin', 'python');
    if (exists(unix)) return unix;
    const win = path.join(dir, v, 'Scripts', 'python.exe');
    if (exists(win)) return win;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}
