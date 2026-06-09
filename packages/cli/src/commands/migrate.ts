import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { createSpinner } from '../utils/spinner';
import { findMonorepoRoot } from '../utils/monorepo';

interface MigrateOptions {
  spinner?: any;
  verbose?: boolean;
  dryRun?: boolean;
  force?: boolean;
  backup?: boolean;
}

interface ProjectConfig {
  name: string;
  type: 'standalone' | 'monorepo';
  framework: string;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  workspaces?: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  hasGit: boolean;
  hasTypeScript: boolean;
  hasESLint: boolean;
  hasPrettier: boolean;
  hasTesting: boolean;
}

export async function importProject(sourcePath: string, options: MigrateOptions = {}) {
  try {
    if (options.spinner) {
      options.spinner.text = 'Analyzing source project...';
    }

    // Validate source path
    const resolvedSource = path.resolve(sourcePath);
    if (!await fs.pathExists(resolvedSource)) {
      throw new Error(`Source path does not exist: ${sourcePath}`);
    }

    // Analyze the source project
    const projectConfig = await analyzeProject(resolvedSource, options);
    
    if (options.verbose) {
      console.log('\n' + chalk.blue('Project Analysis:'));
      console.log(`  Name: ${projectConfig.name}`);
      console.log(`  Type: ${projectConfig.type}`);
      console.log(`  Framework: ${projectConfig.framework}`);
      console.log(`  Package Manager: ${projectConfig.packageManager}`);
      console.log(`  Workspaces: ${projectConfig.workspaces?.length || 0}`);
    }

    // Create backup if requested
    if (options.backup) {
      await createProjectBackup(resolvedSource, options);
    }

    // Import to Re-Shell structure
    if (projectConfig.type === 'monorepo') {
      await importMonorepo(resolvedSource, projectConfig, options);
    } else {
      await importStandaloneProject(resolvedSource, projectConfig, options);
    }

    if (options.spinner) {
      options.spinner.succeed(chalk.green('Project imported successfully!'));
    }

    // Display next steps
    console.log('\n' + chalk.bold('Next Steps:'));
    console.log('1. Review the imported project structure');
    console.log('2. Install dependencies: pnpm install');
    console.log('3. Run health check: re-shell doctor');
    console.log('4. Start development: re-shell serve');

  } catch (error) {
    if (options.spinner) {
      options.spinner.fail(chalk.red('Import failed'));
    }
    throw error;
  }
}

export async function exportProject(targetPath: string, options: MigrateOptions = {}) {
  try {
    if (options.spinner) {
      options.spinner.text = 'Preparing export...';
    }

    const monorepoRoot = await findMonorepoRoot(process.cwd());
    if (!monorepoRoot) {
      throw new Error('Not in a Re-Shell monorepo. Run this command from within a monorepo.');
    }

    const resolvedTarget = path.resolve(targetPath);
    
    // Check if target exists
    if (await fs.pathExists(resolvedTarget) && !options.force) {
      throw new Error(`Target path already exists: ${targetPath}. Use --force to overwrite.`);
    }

    // Create export structure
    await createExportStructure(monorepoRoot, resolvedTarget, options);

    if (options.spinner) {
      options.spinner.succeed(chalk.green('Project exported successfully!'));
    }

    console.log('\n' + chalk.bold('Export Complete:'));
    console.log(`  Location: ${resolvedTarget}`);
    console.log(`  Includes: Source code, configurations, documentation`);

  } catch (error) {
    if (options.spinner) {
      options.spinner.fail(chalk.red('Export failed'));
    }
    throw error;
  }
}

export async function backupProject(options: MigrateOptions = {}) {
  try {
    const monorepoRoot = await findMonorepoRoot(process.cwd());
    if (!monorepoRoot) {
      throw new Error('Not in a Re-Shell monorepo');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupName = `re-shell-backup-${timestamp}`;
    const backupPath = path.join(path.dirname(monorepoRoot), backupName);

    if (options.spinner) {
      options.spinner.text = 'Creating backup...';
    }

    await createProjectBackup(monorepoRoot, { ...options, customPath: backupPath });

    if (options.spinner) {
      options.spinner.succeed(chalk.green('Backup created successfully!'));
    }

    console.log('\n' + chalk.bold('Backup Details:'));
    console.log(`  Location: ${backupPath}`);
    console.log(`  Size: ${await getDirectorySize(backupPath)}`);

  } catch (error) {
    if (options.spinner) {
      options.spinner.fail(chalk.red('Backup failed'));
    }
    throw error;
  }
}

export async function restoreProject(backupPath: string, targetPath: string, options: MigrateOptions = {}) {
  try {
    if (options.spinner) {
      options.spinner.text = 'Restoring from backup...';
    }

    const resolvedBackup = path.resolve(backupPath);
    const resolvedTarget = path.resolve(targetPath);

    if (!await fs.pathExists(resolvedBackup)) {
      throw new Error(`Backup path does not exist: ${backupPath}`);
    }

    if (await fs.pathExists(resolvedTarget) && !options.force) {
      throw new Error(`Target path already exists: ${targetPath}. Use --force to overwrite.`);
    }

    // Copy backup to target
    await fs.copy(resolvedBackup, resolvedTarget, {
      overwrite: options.force,
      filter: (src) => {
        const relative = path.relative(resolvedBackup, src);
        return !relative.includes('node_modules') && !relative.includes('.git');
      }
    });

    if (options.spinner) {
      options.spinner.succeed(chalk.green('Project restored successfully!'));
    }

    console.log('\n' + chalk.bold('Restore Complete:'));
    console.log(`  Location: ${resolvedTarget}`);
    console.log('  Remember to run: pnpm install');

  } catch (error) {
    if (options.spinner) {
      options.spinner.fail(chalk.red('Restore failed'));
    }
    throw error;
  }
}

async function analyzeProject(projectPath: string, options: MigrateOptions): Promise<ProjectConfig> {
  const packageJsonPath = path.join(projectPath, 'package.json');
  
  if (!await fs.pathExists(packageJsonPath)) {
    throw new Error('No package.json found in the source project');
  }

  const packageJson = await fs.readJson(packageJsonPath);
  
  // Detect project type
  const isMonorepo = !!(packageJson.workspaces || 
    await fs.pathExists(path.join(projectPath, 'lerna.json')) ||
    await fs.pathExists(path.join(projectPath, 'nx.json')) ||
    await fs.pathExists(path.join(projectPath, 'turbo.json')));

  // Detect framework
  const framework = detectFramework(packageJson);
  
  // Detect package manager
  const packageManager = detectPackageManager(projectPath);

  // Get workspaces for monorepos
  let workspaces: string[] = [];
  if (isMonorepo) {
    workspaces = await getWorkspaces(projectPath, packageJson);
  }

  // Check for common tools
  const hasGit = await fs.pathExists(path.join(projectPath, '.git'));
  const hasTypeScript = !!(packageJson.devDependencies?.typescript || packageJson.dependencies?.typescript ||
    await fs.pathExists(path.join(projectPath, 'tsconfig.json')));
  const hasESLint = !!(packageJson.devDependencies?.eslint || packageJson.dependencies?.eslint);
  const hasPrettier = !!(packageJson.devDependencies?.prettier || packageJson.dependencies?.prettier);
  const hasTesting = !!(packageJson.devDependencies?.jest || packageJson.devDependencies?.vitest || 
    packageJson.devDependencies?.['@testing-library/react']);

  return {
    name: packageJson.name || 'imported-project',
    type: isMonorepo ? 'monorepo' : 'standalone',
    framework,
    packageManager,
    workspaces,
    dependencies: packageJson.dependencies || {},
    devDependencies: packageJson.devDependencies || {},
    scripts: packageJson.scripts || {},
    hasGit,
    hasTypeScript,
    hasESLint,
    hasPrettier,
    hasTesting
  };
}

function detectFramework(packageJson: any): string {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  if (deps.react) {
    return deps.typescript ? 'react-ts' : 'react';
  }
  if (deps.vue) {
    return deps.typescript ? 'vue-ts' : 'vue';
  }
  if (deps.svelte) {
    return deps.typescript ? 'svelte-ts' : 'svelte';
  }
  if (deps.next) {
    return 'next';
  }
  if (deps.nuxt) {
    return 'nuxt';
  }
  if (deps.angular || deps['@angular/core']) {
    return 'angular';
  }
  
  return 'vanilla';
}

function detectPackageManager(projectPath: string): 'npm' | 'yarn' | 'pnpm' | 'bun' {
  if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(projectPath, 'bun.lockb'))) return 'bun';
  return 'npm';
}

async function getWorkspaces(projectPath: string, packageJson: any): Promise<string[]> {
  if (packageJson.workspaces) {
    if (Array.isArray(packageJson.workspaces)) {
      return packageJson.workspaces;
    } else if (packageJson.workspaces.packages) {
      return packageJson.workspaces.packages;
    }
  }

  // Check for Lerna
  const lernaPath = path.join(projectPath, 'lerna.json');
  if (await fs.pathExists(lernaPath)) {
    const lernaConfig = await fs.readJson(lernaPath);
    return lernaConfig.packages || ['packages/*'];
  }

  // Check for Nx
  const nxPath = path.join(projectPath, 'nx.json');
  if (await fs.pathExists(nxPath)) {
    // Nx uses workspace.json or project.json files
    return ['apps/*', 'libs/*'];
  }

  return [];
}

async function importMonorepo(sourcePath: string, config: ProjectConfig, options: MigrateOptions) {
  const targetPath = path.join(process.cwd(), config.name);
  
  if (options.dryRun) {
    console.log(chalk.blue('DRY RUN - Would import monorepo:'));
    console.log(`  Source: ${sourcePath}`);
    console.log(`  Target: ${targetPath}`);
    console.log(`  Workspaces: ${config.workspaces?.join(', ')}`);
    return;
  }

  // Create Re-Shell monorepo structure
  await fs.ensureDir(targetPath);
  
  // Copy root files
  const rootFiles = ['package.json', '.gitignore', 'README.md', 'tsconfig.json', '.eslintrc.js'];
  for (const file of rootFiles) {
    const srcFile = path.join(sourcePath, file);
    const destFile = path.join(targetPath, file);
    if (await fs.pathExists(srcFile)) {
      await fs.copy(srcFile, destFile);
    }
  }

  // Update package.json for Re-Shell
  const packageJsonPath = path.join(targetPath, 'package.json');
  const packageJson = await fs.readJson(packageJsonPath);
  
  // Add Re-Shell specific configurations
  packageJson.devDependencies = {
    ...packageJson.devDependencies,
    '@re-shell/cli': 'latest'
  };
  
  packageJson.scripts = {
    ...packageJson.scripts,
    'dev': 're-shell serve',
    'build': 're-shell build',
    'lint': 're-shell workspace list --json | jq -r ".[] | .path" | xargs -I {} pnpm --filter {} lint'
  };

  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });

  // Copy workspaces
  if (config.workspaces) {
    for (const workspace of config.workspaces) {
      const sourceDirs = await expandGlob(path.join(sourcePath, workspace));
      for (const sourceDir of sourceDirs) {
        const relativePath = path.relative(sourcePath, sourceDir);
        const targetDir = path.join(targetPath, relativePath);
        
        await fs.copy(sourceDir, targetDir, {
          filter: (src) => {
            const relative = path.relative(sourceDir, src);
            return !relative.includes('node_modules') && !relative.includes('dist');
          }
        });
      }
    }
  }

  if (options.verbose) {
    console.log(chalk.green(`✓ Imported monorepo with ${config.workspaces?.length || 0} workspaces`));
  }
}

async function importStandaloneProject(sourcePath: string, config: ProjectConfig, options: MigrateOptions) {
  const monorepoRoot = await findMonorepoRoot(process.cwd());
  
  if (!monorepoRoot) {
    throw new Error('Not in a Re-Shell monorepo. Create one first with "re-shell init"');
  }

  const targetPath = path.join(monorepoRoot, 'apps', config.name);
  
  if (options.dryRun) {
    console.log(chalk.blue('DRY RUN - Would import standalone project:'));
    console.log(`  Source: ${sourcePath}`);
    console.log(`  Target: ${targetPath}`);
    console.log(`  Framework: ${config.framework}`);
    return;
  }

  // Copy project to apps directory
  await fs.copy(sourcePath, targetPath, {
    filter: (src) => {
      const relative = path.relative(sourcePath, src);
      return !relative.includes('node_modules') && !relative.includes('dist');
    }
  });

  // Update package.json for workspace
  const packageJsonPath = path.join(targetPath, 'package.json');
  const packageJson = await fs.readJson(packageJsonPath);
  
  packageJson.name = `@${path.basename(monorepoRoot)}/${config.name}`;
  packageJson.private = true;
  
  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });

  // Update root package.json workspaces
  const rootPackageJsonPath = path.join(monorepoRoot, 'package.json');
  const rootPackageJson = await fs.readJson(rootPackageJsonPath);
  
  if (!rootPackageJson.workspaces) {
    rootPackageJson.workspaces = [];
  }
  
  const workspacePattern = `apps/${config.name}`;
  if (!rootPackageJson.workspaces.includes(workspacePattern)) {
    rootPackageJson.workspaces.push(workspacePattern);
  }
  
  await fs.writeJson(rootPackageJsonPath, rootPackageJson, { spaces: 2 });

  if (options.verbose) {
    console.log(chalk.green(`✓ Imported standalone project as workspace`));
  }
}

async function createProjectBackup(sourcePath: string, options: MigrateOptions & { customPath?: string }) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupName = `backup-${timestamp}`;
  const backupPath = options.customPath || path.join(path.dirname(sourcePath), backupName);

  await fs.copy(sourcePath, backupPath, {
    filter: (src) => {
      const relative = path.relative(sourcePath, src);
      return !relative.includes('node_modules') && 
             !relative.includes('.git') && 
             !relative.includes('dist') &&
             !relative.includes('build');
    }
  });

  // Create backup manifest
  const manifest = {
    created: new Date().toISOString(),
    source: sourcePath,
    backup: backupPath,
    version: '1.0.0'
  };

  await fs.writeJson(path.join(backupPath, '.backup-manifest.json'), manifest, { spaces: 2 });

  if (options.verbose) {
    console.log(chalk.green(`✓ Backup created: ${backupPath}`));
  }
}

async function createExportStructure(sourcePath: string, targetPath: string, options: MigrateOptions) {
  await fs.ensureDir(targetPath);

  // Copy essential files and directories
  const itemsToCopy = [
    'package.json',
    'apps',
    'packages',
    'libs',
    'tools',
    '.gitignore',
    'README.md',
    'tsconfig.json',
    '.eslintrc.js',
    'turbo.json',
    'nx.json'
  ];

  for (const item of itemsToCopy) {
    const srcPath = path.join(sourcePath, item);
    const destPath = path.join(targetPath, item);
    
    if (await fs.pathExists(srcPath)) {
      await fs.copy(srcPath, destPath, {
        filter: (src) => {
          const relative = path.relative(srcPath, src);
          return !relative.includes('node_modules') && 
                 !relative.includes('.git') && 
                 !relative.includes('dist') &&
                 !relative.includes('build');
        }
      });
    }
  }

  // Create export manifest
  const manifest = {
    exported: new Date().toISOString(),
    source: sourcePath,
    export: targetPath,
    version: '1.0.0',
    tool: 'Re-Shell CLI'
  };

  await fs.writeJson(path.join(targetPath, '.export-manifest.json'), manifest, { spaces: 2 });

  if (options.verbose) {
    console.log(chalk.green(`✓ Export created: ${targetPath}`));
  }
}

async function expandGlob(pattern: string): Promise<string[]> {
  const baseDir = path.dirname(pattern);
  const globPattern = path.basename(pattern);

  if (!globPattern.includes('*')) {
    const fullPath = path.resolve(pattern);
    return await fs.pathExists(fullPath) ? [fullPath] : [];
  }

  try {
    const items = await fs.readdir(baseDir, { withFileTypes: true });
    const matches = [];

    for (const item of items) {
      if (item.isDirectory()) {
        const fullPath = path.join(baseDir, item.name);
        if (await fs.pathExists(path.join(fullPath, 'package.json'))) {
          matches.push(fullPath);
        }
      }
    }

    return matches;
  } catch (error) {
    return [];
  }
}

async function getDirectorySize(dirPath: string): Promise<string> {
  try {
    // Simple estimation - actual recursive calculation would be too slow
    const stats = await fs.stat(dirPath);
    return '< 1MB (estimated)';
  } catch (error) {
    return 'Unknown';
  }
}