// Operation planner: maps (ecosystem, operation) onto the native argv for each
// package manager. Commands are argv arrays executed WITHOUT a shell.

import * as fs from 'fs';
import * as path from 'path';

import { findDotnetProjects, isYarnBerry, resolvePythonForPip } from './detect';
import {
  PkgError,
  type Ecosystem,
  type ManifestEditPlan,
  type OperationPlan,
  type PkgOperation,
  type PlannedCommand,
} from './types';

export interface PlanInput {
  ecosystem: Ecosystem;
  operation: PkgOperation;
  packages: string[];
  dev: boolean;
  dir: string;
}

/** Ecosystems with no notion of a dev/test dependency scope. */
const NO_DEV_SCOPE: Ecosystem[] = ['go', 'dotnet'];

/**
 * Reject anything that could be parsed as a CLI flag. argv is never passed to
 * a shell, but a package spec like `--registry=http://evil` would still be
 * interpreted by the package manager.
 */
export function assertSafePackageSpecs(packages: string[]): void {
  for (const p of packages) {
    if (p.startsWith('-')) {
      throw new PkgError('PKG_INVALID_ARGS', `Package spec "${p}" looks like a flag; refusing to pass it to the package manager`);
    }
    if (/[\0\r\n]/.test(p)) {
      throw new PkgError('PKG_INVALID_ARGS', `Package spec contains control characters`);
    }
  }
}

function cmd(argv: string[], cwd: string, purpose: string, okExitCodes?: number[]): PlannedCommand {
  return { argv, cwd, purpose, ...(okExitCodes ? { okExitCodes } : {}) };
}

/** Split `name@version` (supporting scoped npm names and go modules). */
function splitAtVersion(spec: string): { name: string; version: string | null } {
  const idx = spec.lastIndexOf('@');
  if (idx <= 0) return { name: spec, version: null };
  return { name: spec.slice(0, idx), version: spec.slice(idx + 1) };
}

function requirePackages(op: PkgOperation, packages: string[], ecosystem: Ecosystem): void {
  if ((op === 'add' || op === 'remove') && packages.length === 0) {
    throw new PkgError('PKG_INVALID_ARGS', `pkg ${op} (${ecosystem}) requires at least one package`);
  }
  if ((op === 'install' || op === 'list' || op === 'outdated') && packages.length > 0) {
    throw new PkgError('PKG_INVALID_ARGS', `pkg ${op} does not take package arguments`);
  }
}

function dotnetProjectArgs(dir: string): string[] {
  const projects = findDotnetProjects(dir);
  if (projects.length > 1) {
    throw new PkgError(
      'PKG_INVALID_ARGS',
      `Multiple project files in ${dir} (${projects.join(', ')}); point --path at a single project directory`,
      { projects }
    );
  }
  if (projects.length === 0) {
    throw new PkgError('PKG_INVALID_ARGS', `No .csproj/.fsproj/.vbproj in ${dir}; point --path at a project directory`);
  }
  return [projects[0]];
}

/**
 * Build the native command plan (plus manifest edits where the ecosystem has no
 * native command) for one operation. `list` has no commands: it only reads
 * manifests.
 *
 * @throws {PkgError} PKG_INVALID_ARGS / PKG_UNSUPPORTED_OPERATION for impossible requests.
 */
export function planOperation(input: PlanInput): OperationPlan {
  const { ecosystem, operation, packages, dev, dir } = input;
  assertSafePackageSpecs(packages);
  requirePackages(operation, packages, ecosystem);
  if (dev && NO_DEV_SCOPE.includes(ecosystem)) {
    throw new PkgError('PKG_INVALID_ARGS', `--dev is not supported for ${ecosystem} (no dev dependency scope)`);
  }
  if (dev && operation !== 'add' && operation !== 'remove') {
    throw new PkgError('PKG_INVALID_ARGS', `--dev only applies to add/remove`);
  }
  if (operation === 'list') return { commands: [], edits: [] };

  const c = (argv: string[], purpose: string, ok?: number[]): PlannedCommand => cmd(argv, dir, purpose, ok);
  const plan = (commands: PlannedCommand[], edits: ManifestEditPlan[] = []): OperationPlan => ({ commands, edits });

  switch (ecosystem) {
    case 'npm':
      switch (operation) {
        case 'add':
          return plan([c(['npm', 'install', ...(dev ? ['--save-dev'] : []), ...packages], 'add packages')]);
        case 'remove':
          return plan([c(['npm', 'uninstall', ...packages], 'remove packages')]);
        case 'install':
          return plan([c(['npm', 'install'], 'install dependencies')]);
        case 'outdated':
          return plan([c(['npm', 'outdated', '--json'], 'list outdated packages', [0, 1])]);
      }
      break;
    case 'pnpm':
      switch (operation) {
        case 'add':
          return plan([c(['pnpm', 'add', ...(dev ? ['-D'] : []), ...packages], 'add packages')]);
        case 'remove':
          return plan([c(['pnpm', 'remove', ...packages], 'remove packages')]);
        case 'install':
          return plan([c(['pnpm', 'install'], 'install dependencies')]);
        case 'outdated':
          return plan([c(['pnpm', 'outdated', '--format', 'json'], 'list outdated packages', [0, 1])]);
      }
      break;
    case 'yarn':
      switch (operation) {
        case 'add':
          return plan([c(['yarn', 'add', ...(dev ? ['--dev'] : []), ...packages], 'add packages')]);
        case 'remove':
          return plan([c(['yarn', 'remove', ...packages], 'remove packages')]);
        case 'install':
          return plan([c(['yarn', 'install'], 'install dependencies')]);
        case 'outdated':
          if (isYarnBerry(dir)) {
            throw new PkgError(
              'PKG_UNSUPPORTED_OPERATION',
              'yarn berry (>= 2) has no native `outdated` command; use yarn classic, npm, or pnpm for this report'
            );
          }
          return plan([c(['yarn', 'outdated', '--json'], 'list outdated packages', [0, 1])]);
      }
      break;
    case 'bun':
      switch (operation) {
        case 'add':
          return plan([c(['bun', 'add', ...(dev ? ['--dev'] : []), ...packages], 'add packages')]);
        case 'remove':
          return plan([c(['bun', 'remove', ...packages], 'remove packages')]);
        case 'install':
          return plan([c(['bun', 'install'], 'install dependencies')]);
        case 'outdated':
          return plan([c(['bun', 'outdated'], 'list outdated packages', [0, 1])]);
      }
      break;
    case 'pip': {
      const py = resolvePythonForPip(dir);
      const reqFile = path.join(dir, dev ? 'requirements-dev.txt' : 'requirements.txt');
      switch (operation) {
        case 'add':
          return plan(
            [c([py, '-m', 'pip', 'install', ...packages], 'install packages')],
            [{ kind: 'pip-requirements', file: reqFile, action: 'add', entries: packages, phase: 'after' }]
          );
        case 'remove': {
          const names = packages.map(p => p.split(/[<>=!~\[; ]/)[0]);
          const files = ['requirements.txt', 'requirements-dev.txt']
            .map(f => path.join(dir, f))
            .filter(f => fs.existsSync(f));
          return plan(
            [c([py, '-m', 'pip', 'uninstall', '-y', ...names], 'uninstall packages')],
            files.map(f => ({ kind: 'pip-requirements' as const, file: f, action: 'remove' as const, entries: names, phase: 'after' as const }))
          );
        }
        case 'install': {
          const reqs = fs.existsSync(dir)
            ? fs.readdirSync(dir).filter(f => /^requirements.*\.txt$/.test(f)).sort()
            : [];
          if (reqs.length > 0) {
            return plan([c([py, '-m', 'pip', 'install', ...reqs.flatMap(r => ['-r', r])], 'install requirements')]);
          }
          if (fs.existsSync(path.join(dir, 'pyproject.toml')) || fs.existsSync(path.join(dir, 'setup.py'))) {
            return plan([c([py, '-m', 'pip', 'install', '-e', '.'], 'install project (editable)')]);
          }
          throw new PkgError('PKG_UNSUPPORTED_OPERATION', 'pip install needs a requirements*.txt, pyproject.toml or setup.py');
        }
        case 'outdated':
          return plan([c([py, '-m', 'pip', 'list', '--outdated', '--format', 'json'], 'list outdated packages')]);
      }
      break;
    }
    case 'poetry':
      switch (operation) {
        case 'add':
          return plan([c(['poetry', 'add', ...(dev ? ['--group', 'dev'] : []), ...packages], 'add packages')]);
        case 'remove':
          return plan([c(['poetry', 'remove', ...(dev ? ['--group', 'dev'] : []), ...packages], 'remove packages')]);
        case 'install':
          return plan([c(['poetry', 'install'], 'install dependencies')]);
        case 'outdated':
          return plan([c(['poetry', 'show', '--outdated', '--top-level', '--no-ansi'], 'list outdated packages')]);
      }
      break;
    case 'uv':
      switch (operation) {
        case 'add':
          return plan([c(['uv', 'add', ...(dev ? ['--dev'] : []), ...packages], 'add packages')]);
        case 'remove':
          return plan([c(['uv', 'remove', ...(dev ? ['--dev'] : []), ...packages], 'remove packages')]);
        case 'install':
          return plan([c(['uv', 'sync'], 'sync dependencies')]);
        case 'outdated':
          return plan([c(['uv', 'pip', 'list', '--outdated', '--format', 'json'], 'list outdated packages')]);
      }
      break;
    case 'cargo':
      switch (operation) {
        case 'add':
          return plan([c(['cargo', 'add', ...(dev ? ['--dev'] : []), ...packages], 'add crates')]);
        case 'remove':
          return plan([c(['cargo', 'remove', ...(dev ? ['--dev'] : []), ...packages], 'remove crates')]);
        case 'install':
          return plan([c(['cargo', 'fetch'], 'fetch dependencies')]);
        case 'outdated':
          return plan([c(['cargo', 'outdated', '--format', 'json', '--root-deps-only'], 'list outdated crates')]);
      }
      break;
    case 'maven': {
      const pom = path.join(dir, 'pom.xml');
      const resolve = c(['mvn', '-B', 'dependency:resolve'], 'resolve dependencies');
      switch (operation) {
        case 'add':
          return plan([resolve], [{ kind: 'maven-pom', file: pom, action: 'add', entries: packages, phase: 'before' }]);
        case 'remove':
          return plan([], [{ kind: 'maven-pom', file: pom, action: 'remove', entries: packages, phase: 'before' }]);
        case 'install':
          return plan([resolve]);
        case 'outdated':
          return plan([
            c(['mvn', '-B', 'versions:display-dependency-updates', '-DprocessDependencyManagement=false'], 'list outdated dependencies'),
          ]);
      }
      break;
    }
    case 'gradle': {
      const file = ['build.gradle.kts', 'build.gradle']
        .map(f => path.join(dir, f))
        .find(f => fs.existsSync(f)) ?? path.join(dir, 'build.gradle');
      const resolve: PlannedCommand = {
        ...c(['gradle', '--console=plain', 'dependencies'], 'resolve dependencies'),
        // `gradle dependencies` exits 0 even when a dependency cannot be resolved.
        failPattern: '\\bFAILED\\b',
      };
      switch (operation) {
        case 'add':
          return plan([resolve], [{ kind: 'gradle-build', file, action: 'add', entries: packages, phase: 'before' }]);
        case 'remove':
          return plan([], [{ kind: 'gradle-build', file, action: 'remove', entries: packages, phase: 'before' }]);
        case 'install':
          return plan([resolve]);
        case 'outdated':
          throw new PkgError(
            'PKG_UNSUPPORTED_OPERATION',
            'gradle has no native outdated command (it needs the com.github.ben-manes.versions plugin); use maven or apply that plugin and run `gradle dependencyUpdates`'
          );
      }
      break;
    }
    case 'dotnet': {
      switch (operation) {
        case 'add': {
          const proj = dotnetProjectArgs(dir);
          return plan(
            packages.map(p => {
              const { name, version } = splitAtVersion(p);
              return c(
                ['dotnet', 'add', ...proj, 'package', name, ...(version ? ['--version', version] : [])],
                `add ${name}`
              );
            })
          );
        }
        case 'remove': {
          const proj = dotnetProjectArgs(dir);
          return plan(packages.map(p => c(['dotnet', 'remove', ...proj, 'package', p], `remove ${p}`)));
        }
        case 'install':
          return plan([c(['dotnet', 'restore'], 'restore packages')]);
        case 'outdated': {
          const proj = dotnetProjectArgs(dir);
          return plan([c(['dotnet', 'list', ...proj, 'package', '--outdated', '--format', 'json'], 'list outdated packages')]);
        }
      }
      break;
    }
    case 'composer': {
      const base = ['--no-interaction'];
      switch (operation) {
        case 'add':
          return plan([c(['composer', 'require', ...base, ...(dev ? ['--dev'] : []), ...packages], 'require packages')]);
        case 'remove':
          return plan([c(['composer', 'remove', ...base, ...(dev ? ['--dev'] : []), ...packages], 'remove packages')]);
        case 'install':
          return plan([c(['composer', 'install', ...base], 'install dependencies')]);
        case 'outdated':
          return plan([c(['composer', 'outdated', '--format=json', '--direct', '--no-interaction'], 'list outdated packages')]);
      }
      break;
    }
    case 'bundler':
      switch (operation) {
        case 'add':
          return plan(
            packages.map(p => {
              const { name, version } = splitAtVersion(p);
              return c(
                ['bundle', 'add', name, ...(version ? ['--version', version] : []), ...(dev ? ['--group', 'development'] : [])],
                `add ${name}`
              );
            })
          );
        case 'remove':
          return plan([c(['bundle', 'remove', ...packages], 'remove gems')]);
        case 'install':
          return plan([c(['bundle', 'install'], 'install gems')]);
        case 'outdated':
          return plan([c(['bundle', 'outdated', '--parseable'], 'list outdated gems', [0, 1])]);
      }
      break;
    case 'go':
      switch (operation) {
        case 'add':
          return plan([c(['go', 'get', ...packages], 'add modules')]);
        case 'remove':
          return plan([c(['go', 'get', ...packages.map(p => `${splitAtVersion(p).name}@none`)], 'remove modules')]);
        case 'install':
          return plan([c(['go', 'mod', 'download'], 'download modules')]);
        case 'outdated':
          return plan([c(['go', 'list', '-u', '-m', '-json', 'all'], 'list module updates')]);
      }
      break;
  }
  throw new PkgError('PKG_UNSUPPORTED_OPERATION', `${operation} is not supported for ${ecosystem}`);
}
