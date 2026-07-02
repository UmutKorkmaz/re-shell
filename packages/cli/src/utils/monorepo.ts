/**
 * @file Utilities for detecting, initializing, and inspecting monorepo workspaces.
 * Provides helpers to scaffold a new monorepo, enumerate workspace packages,
 * and traverse the filesystem to locate the monorepo root.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import YAML from 'yaml';
import { globSync } from 'glob';
import * as semver from 'semver';

/**
 * Configuration describing the structure and tooling of a monorepo.
 *
 * @description Returned by {@link initializeMonorepo} and used to describe
 * the created layout, package manager, and workspace glob patterns.
 */
export interface MonorepoConfig {
  /** The monorepo's package name (root package.json `name` field). */
  name: string;
  /** The package manager that orchestrates workspaces. */
  packageManager: 'npm' | 'yarn' | 'pnpm';
  /** Glob patterns representing the workspace package locations. */
  workspaces: string[];
  /** Directory names for each logical section of the monorepo. */
  structure: {
    /** Directory containing application packages. */
    apps: string;
    /** Directory containing shared/reusable packages. */
    packages: string;
    /** Directory containing library packages. */
    libs: string;
    /** Directory containing tooling packages. */
    tools: string;
    /** Directory containing documentation. */
    docs: string;
  };
}

/**
 * Metadata describing a single workspace package within a monorepo.
 *
 * @description Produced by {@link getWorkspaces} for each discovered workspace,
 * capturing its identity, location, category, framework, and dependencies.
 */
export interface WorkspaceInfo {
  /** The workspace package's name from its package.json. */
  name: string;
  /** Relative path to the workspace directory from the monorepo root. */
  path: string;
  /** Logical category inferred from the workspace's parent directory. */
  type: 'app' | 'package' | 'lib' | 'tool';
  /** Detected framework (e.g. `react-ts`, `vue`), if any. */
  framework?: string;
  /** Semantic version string from the workspace's package.json. */
  version: string;
  /** List of dependency names (combined dependencies and devDependencies). */
  dependencies: string[];
}

/**
 * Default directory names for each section of a freshly scaffolded monorepo.
 *
 * @description Used as the baseline structure by {@link initializeMonorepo}
 * unless the caller supplies custom overrides.
 */
export const DEFAULT_MONOREPO_STRUCTURE = {
  apps: 'apps',
  packages: 'packages',
  libs: 'libs',
  tools: 'tools',
  docs: 'docs',
};

function getRecommendedCliVersion(): string {
  try {
    const packageJsonPath = path.resolve(__dirname, '../../package.json');
    const packageJson = fs.readJsonSync(packageJsonPath);
    const currentVersion = typeof packageJson.version === 'string' ? packageJson.version : null;

    if (currentVersion && semver.valid(currentVersion)) {
      return `^${semver.major(currentVersion)}.${semver.minor(currentVersion)}.0`;
    }
  } catch {
    // Fall back to the npm dist-tag when local metadata is unavailable.
  }

  return 'latest';
}

/**
 * Scaffolds a new monorepo at the given path with standard directories,
 * root package.json, workspace configuration, and a .gitignore file.
 *
 * @description Creates the project folder, apps/packages/libs/tools directories,
 * a root package.json with workspace-aware scripts, the appropriate workspace
 * config for the chosen package manager (pnpm-workspace.yaml or package.json
 * workspaces), and a comprehensive .gitignore.
 *
 * @param name - The monorepo (and root package) name.
 * @param packageManager - Which package manager to configure for. Defaults to `pnpm`.
 * @param customStructure - Optional overrides for directory names; merged with
 *   {@link DEFAULT_MONOREPO_STRUCTURE}.
 * @returns A {@link MonorepoConfig} describing the created monorepo.
 */
export async function initializeMonorepo(
  name: string,
  packageManager: 'npm' | 'yarn' | 'pnpm' = 'pnpm',
  customStructure?: Partial<typeof DEFAULT_MONOREPO_STRUCTURE>
): Promise<MonorepoConfig> {
  const structure = { ...DEFAULT_MONOREPO_STRUCTURE, ...customStructure };
  const projectPath = path.resolve(process.cwd(), name);

  // Create root directory
  await fs.ensureDir(projectPath);

  // Create apps directory (main directory for microfrontend apps)
  await fs.ensureDir(path.join(projectPath, structure.apps));

  const workspaces = [
    `${structure.apps}/*`,
    `${structure.packages}/*`,
    `${structure.libs}/*`,
    `${structure.tools}/*`,
  ];

  // Create root package.json
  const packageJson = {
    name,
    version: '0.1.0',
    description: `${name} - A multi-framework monorepo`,
    private: true,
    workspaces: packageManager === 'npm' ? { packages: workspaces } : workspaces,
    scripts: {
      dev: `${packageManager} run --parallel -r dev`,
      build: `${packageManager} run --parallel -r build`,
      lint: `${packageManager} run --parallel -r lint`,
      test: `${packageManager} run --parallel -r test`,
      clean: `${packageManager} run --parallel -r clean`,
      'type-check': `${packageManager} run --parallel -r type-check`,
      'workspace:list': 're-shell workspace list',
      'workspace:graph': 're-shell workspace graph',
      'workspace:update': 're-shell workspace update',
    },
    devDependencies: {
      '@re-shell/cli': getRecommendedCliVersion(),
    },
    engines: {
      node: '>=16.0.0',
    },
  };

  await fs.writeFile(path.join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2));

  // Create workspace configuration
  if (packageManager === 'pnpm') {
    const pnpmWorkspace = {
      packages: workspaces,
    };
    await fs.writeFile(
      path.join(projectPath, 'pnpm-workspace.yaml'),
      YAML.stringify(pnpmWorkspace)
    );
  } else if (packageManager === 'yarn') {
    const yarnWorkspace = {
      workspaces: workspaces,
    };
    await fs.writeFile(
      path.join(projectPath, 'package.json'),
      JSON.stringify({ ...packageJson, ...yarnWorkspace }, null, 2)
    );
  }

  // Create .gitignore
  const gitignore = `# Dependencies
node_modules/
.pnp
.pnp.js

# Production builds
dist/
build/
.next/
.nuxt/
.output/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Temporary folders
tmp/
temp/

# Cache
.cache/
.parcel-cache/
.eslintcache
.stylelintcache

# TypeScript
*.tsbuildinfo
`;

  await fs.writeFile(path.join(projectPath, '.gitignore'), gitignore);

  return {
    name,
    packageManager,
    workspaces,
    structure,
  };
}

/**
 * Discovers and returns metadata for every workspace package under a monorepo root.
 *
 * @description Reads the root package.json (and pnpm-workspace.yaml when present)
 * to resolve workspace glob patterns, then inspects each matched directory's
 * package.json to collect name, version, type, framework, and dependencies.
 *
 * @param rootPath - The monorepo root directory to scan. Defaults to the current working directory.
 * @returns An array of {@link WorkspaceInfo} objects, one per detected workspace.
 * @throws {Error} When no package.json is found at `rootPath`.
 */
export async function getWorkspaces(rootPath: string = process.cwd()): Promise<WorkspaceInfo[]> {
  const packageJsonPath = path.join(rootPath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('Not in a monorepo root (package.json not found)');
  }

  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  let workspacePatterns: string[] = [];

  // Extract workspace patterns
  if (packageJson.workspaces) {
    if (Array.isArray(packageJson.workspaces)) {
      workspacePatterns = packageJson.workspaces;
    } else if (packageJson.workspaces.packages) {
      workspacePatterns = packageJson.workspaces.packages;
    }
  }

  // Check for pnpm-workspace.yaml
  const pnpmWorkspacePath = path.join(rootPath, 'pnpm-workspace.yaml');
  if (fs.existsSync(pnpmWorkspacePath)) {
    const pnpmWorkspace = YAML.parse(await fs.readFile(pnpmWorkspacePath, 'utf8'));
    if (pnpmWorkspace.packages) {
      workspacePatterns = pnpmWorkspace.packages;
    }
  }

  const workspaces: WorkspaceInfo[] = [];

  // Find all workspace directories
  for (const pattern of workspacePatterns) {
    const matches = globSync(pattern, { cwd: rootPath });

    for (const match of matches) {
      const workspacePath = path.join(rootPath, match);
      const workspacePackageJson = path.join(workspacePath, 'package.json');

      if (fs.existsSync(workspacePackageJson)) {
        try {
          const workspacePackage = JSON.parse(await fs.readFile(workspacePackageJson, 'utf8'));

          // Determine workspace type based on path
          let type: 'app' | 'package' | 'lib' | 'tool' = 'package';
          if (match.startsWith('apps/')) type = 'app';
          else if (match.startsWith('libs/')) type = 'lib';
          else if (match.startsWith('tools/')) type = 'tool';

          // Detect framework
          const framework = detectFrameworkFromPackage(workspacePackage);

          workspaces.push({
            name: workspacePackage.name || path.basename(match),
            path: match,
            type,
            framework,
            version: workspacePackage.version || '0.0.0',
            dependencies: Object.keys({
              ...workspacePackage.dependencies,
              ...workspacePackage.devDependencies,
            }),
          });
        } catch (error) {
          console.warn(`Failed to parse package.json for ${match}:`, error);
        }
      }
    }
  }

  return workspaces;
}

function detectFrameworkFromPackage(packageJson: any): string | undefined {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  if (deps['@angular/core']) return 'angular';
  if (deps['vue']) return deps['typescript'] ? 'vue-ts' : 'vue';
  if (deps['svelte']) return deps['typescript'] ? 'svelte-ts' : 'svelte';
  if (deps['react']) return deps['typescript'] ? 'react-ts' : 'react';

  return undefined;
}

/**
 * Determines whether the given directory is the root of a monorepo.
 *
 * @description A directory qualifies as a monorepo root when its package.json
 * declares `workspaces` or it contains a `pnpm-workspace.yaml` file.
 *
 * @param dirPath - The directory to check. Defaults to the current working directory.
 * @returns `true` if the directory is a monorepo root, otherwise `false`.
 */
export async function isMonorepoRoot(dirPath: string = process.cwd()): Promise<boolean> {
  const packageJsonPath = path.join(dirPath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    return !!(packageJson.workspaces || fs.existsSync(path.join(dirPath, 'pnpm-workspace.yaml')));
  } catch {
    return false;
  }
}

/**
 * Walks up the directory tree from a starting path to locate the nearest monorepo root.
 *
 * @description Traverses parent directories (up to a bounded depth) and uses
 * {@link isMonorepoRoot} on each candidate, stopping at the first match or
 * when the filesystem root is reached.
 *
 * @param startPath - The path to begin searching from. Defaults to the current working directory.
 * @returns The absolute path of the nearest monorepo root, or `null` if none is found.
 */
export async function findMonorepoRoot(startPath: string = process.cwd()): Promise<string | null> {
  let currentPath = path.resolve(startPath);
  const rootPath = path.parse(currentPath).root;
  let depth = 0;
  const maxDepth = 10; // Prevent searching too far up the filesystem

  while (currentPath !== rootPath && depth < maxDepth) {
    if (await isMonorepoRoot(currentPath)) {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
    depth++;
  }

  return null;
}
