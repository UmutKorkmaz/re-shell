import * as fs from 'fs-extra';
import * as path from 'path';
import YAML from 'yaml';
import { globSync } from 'glob';
import * as semver from 'semver';

/**
 * Configuration describing how a monorepo should be initialized and laid out.
 */
export interface MonorepoConfig {
  /** Name of the monorepo project (used as the root package name). */
  name: string;
  /** Package manager that orchestrates the workspace. */
  packageManager: 'npm' | 'yarn' | 'pnpm';
  /** Glob patterns describing the workspace package locations. */
  workspaces: string[];
  /** Directory layout used to organize apps, packages, libraries, tools, and docs. */
  structure: {
    /** Directory containing application workspaces. */
    apps: string;
    /** Directory containing shared package workspaces. */
    packages: string;
    /** Directory containing library workspaces. */
    libs: string;
    /** Directory containing tooling workspaces. */
    tools: string;
    /** Directory containing documentation. */
    docs: string;
  };
}

/**
 * Metadata describing a single discovered workspace within a monorepo.
 */
export interface WorkspaceInfo {
  /** Package name of the workspace, falling back to its directory name. */
  name: string;
  /** Relative path of the workspace from the monorepo root. */
  path: string;
  /** Logical category of the workspace inferred from its location. */
  type: 'app' | 'package' | 'lib' | 'tool';
  /** Detected framework (e.g. `react-ts`, `angular`), if any. */
  framework?: string;
  /** Semver version declared by the workspace package. */
  version: string;
  /** List of dependency names merged from dependencies and devDependencies. */
  dependencies: string[];
}

/**
 * Default directory names used for each section of the monorepo structure
 * when no custom structure is supplied.
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
 * Initializes a new monorepo on disk by creating its directory structure,
 * root `package.json`, workspace configuration, and `.gitignore`.
 *
 * @param name - Name of the project; used for the directory and root package name.
 * @param packageManager - Package manager to target (`npm`, `yarn`, or `pnpm`). Defaults to `pnpm`.
 * @param customStructure - Optional overrides for any directory in the monorepo layout.
 * @returns Resolves with the {@link MonorepoConfig} describing the created monorepo.
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
 * Discovers and returns all workspaces declared by the monorepo located at the
 * given path. Workspace patterns are read from `package.json` (npm/yarn) or
 * `pnpm-workspace.yaml` (pnpm).
 *
 * @param rootPath - Path to the monorepo root. Defaults to the current working directory.
 * @returns Resolves with an array of {@link WorkspaceInfo} objects, one per matched workspace.
 * @throws When `package.json` cannot be found at the root path.
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
 * Determines whether the provided directory is the root of a monorepo by
 * checking for workspace configuration in `package.json` or the presence of
 * a `pnpm-workspace.yaml` file.
 *
 * @param dirPath - Directory path to inspect. Defaults to the current working directory.
 * @returns Resolves with `true` if the directory looks like a monorepo root, otherwise `false`.
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
 * Walks up the directory tree from the given start path looking for a
 * monorepo root. The search stops after 10 levels to prevent traversing
 * too far up the filesystem.
 *
 * @param startPath - Path to begin searching from. Defaults to the current working directory.
 * @returns Resolves with the absolute path of the monorepo root, or `null` if none is found.
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
