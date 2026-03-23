// Import from existing monorepo configurations
// Supports Nx, Turbo, Lerna, and yarn/pnpm workspaces

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import glob from 'glob';
import prompts from 'prompts';

export interface MonorepoImportOptions {
  source?: 'nx' | 'turbo' | 'lerna' | 'yarn' | 'pnpm' | 'auto';
  configPath?: string;
  output?: string;
  includeDev?: boolean;
  detectFrameworks?: boolean;
}

export interface ProjectInfo {
  name: string;
  path: string;
  type?: 'frontend' | 'backend' | 'library' | 'tool';
  framework?: string;
  language?: string;
  port?: number;
  route?: string;
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface MonorepoConfig {
  type: string;
  projects: ProjectInfo[];
  rootPackage?: any;
}

/**
 * Import from monorepo configuration
 */
export async function importFromMonorepo(options: MonorepoImportOptions = {}): Promise<void> {
  const { source = 'auto', configPath, output, includeDev = true, detectFrameworks = true } = options;

  console.log(chalk.cyan.bold('\n🔄 Monorepo to Re-Shell Migration\n'));

  const cwd = process.cwd();

  // Detect monorepo type if auto
  const detectedType = source === 'auto' ? await detectMonorepoType(cwd) : source;

  if (!detectedType) {
    console.log(chalk.red('✗ No supported monorepo configuration found'));
    console.log(chalk.gray('Supported: Nx, Turbo, Lerna, Yarn Workspaces, PNPM Workspaces\n'));
    return;
  }

  console.log(chalk.gray('Detected: ' + detectedType.toUpperCase()));

  // Import based on type
  let config: MonorepoConfig;

  switch (detectedType) {
    case 'nx':
      config = await importNx(cwd, configPath);
      break;
    case 'turbo':
      config = await importTurbo(cwd, configPath);
      break;
    case 'lerna':
      config = await importLerna(cwd, configPath);
      break;
    case 'yarn':
      config = await importYarnWorkspaces(cwd);
      break;
    case 'pnpm':
      config = await importPnpmWorkspaces(cwd);
      break;
    default:
      console.log(chalk.red('✗ Unsupported monorepo type: ' + detectedType));
      return;
  }

  if (!config.projects || config.projects.length === 0) {
    console.log(chalk.yellow('⚠ No projects found in configuration\n'));
    return;
  }

  console.log(chalk.gray('Found ' + config.projects.length + ' project(s)\n'));

  // Detect frameworks if requested
  if (detectFrameworks) {
    await detectProjectFrameworks(config);
  }

  // Show preview
  displayImportPreview(config);

  // Confirm import
  const confirm = await prompts({
    type: 'confirm',
    name: 'value',
    message: 'Import these projects into Re-Shell workspace?',
    initial: false,
  });

  if (!confirm.value) {
    console.log(chalk.gray('\nImport cancelled\n'));
    return;
  }

  // Generate Re-Shell workspace config
  const workspaceConfig = generateWorkspaceConfig(config);

  // Write to file
  const outputPath = output || path.join(cwd, 're-shell.workspaces.yaml');
  await fs.writeFile(outputPath, workspaceConfig);

  console.log(chalk.green('\n✓ Workspace configuration created!'));
  console.log(chalk.gray('Output: ' + outputPath));
  console.log();
}

/**
 * Detect monorepo type
 */
async function detectMonorepoType(cwd: string): Promise<string | null> {
  // Check for Nx
  if (fs.existsSync(path.join(cwd, 'nx.json'))) {
    return 'nx';
  }

  // Check for Turbo
  if (fs.existsSync(path.join(cwd, 'turbo.json'))) {
    return 'turbo';
  }

  // Check for Lerna
  if (fs.existsSync(path.join(cwd, 'lerna.json'))) {
    return 'lerna';
  }

  // Check for Yarn workspaces
  const pkgJson = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgJson)) {
    const pkg = await fs.readJson(pkgJson);
    if (pkg.workspaces) {
      return 'yarn';
    }
  }

  // Check for PNPM workspaces
  if (fs.existsSync(path.join(cwd, 'pnpm-workspace.yaml'))) {
    return 'pnpm';
  }

  return null;
}

/**
 * Import from Nx configuration
 */
async function importNx(cwd: string, configPath?: string): Promise<MonorepoConfig> {
  const nxJsonPath = configPath || path.join(cwd, 'nx.json');
  const nxJson = await fs.readJson(nxJsonPath);
  const packageJson = await fs.readJson(path.join(cwd, 'package.json'));

  const projects: ProjectInfo[] = [];

  // Get projects from nx.json
  if (nxJson.projects) {
    for (const [name, projectConfig] of Object.entries(nxJson.projects as Record<string, any>)) {
      const projectPath = typeof projectConfig === 'string' ? projectConfig : projectConfig.root;
      const projectPkgJson = path.join(cwd, projectPath, 'package.json');

      let projectPkg: any = {};
      if (fs.existsSync(projectPkgJson)) {
        projectPkg = await fs.readJson(projectPkgJson);
      }

      projects.push({
        name,
        path: projectPath,
        type: inferProjectType(projectPkg, name),
        framework: inferFramework(projectPkg),
        language: inferLanguage(projectPkg),
        dependencies: projectPkg.dependencies || {},
        scripts: projectPkg.scripts || {},
      });
    }
  }

  return {
    type: 'nx',
    projects,
    rootPackage: packageJson,
  };
}

/**
 * Import from Turbo configuration
 */
async function importTurbo(cwd: string, configPath?: string): Promise<MonorepoConfig> {
  const turboJsonPath = configPath || path.join(cwd, 'turbo.json');
  const turboJson = await fs.readJson(turboJsonPath);
  const packageJson = await fs.readJson(path.join(cwd, 'package.json'));

  const projects: ProjectInfo[] = [];

  // Turbo uses workspace packages from package.json
  if (packageJson.workspaces) {
    const workspaceGlobs = Array.isArray(packageJson.workspaces) 
      ? packageJson.workspaces 
      : packageJson.workspaces.packages || [];

    const workspaceDirs = await findWorkspaceDirs(cwd, workspaceGlobs);

    for (const workspaceDir of workspaceDirs) {
      const projectPkgJson = path.join(cwd, workspaceDir, 'package.json');
      if (!fs.existsSync(projectPkgJson)) continue;

      const projectPkg = await fs.readJson(projectPkgJson);
      const name = projectPkg.name || workspaceDir.split('/').pop() || 'unknown';

      projects.push({
        name,
        path: workspaceDir,
        type: inferProjectType(projectPkg, name),
        framework: inferFramework(projectPkg),
        language: inferLanguage(projectPkg),
        dependencies: projectPkg.dependencies || {},
        scripts: projectPkg.scripts || {},
      });
    }
  }

  return {
    type: 'turbo',
    projects,
    rootPackage: packageJson,
  };
}

/**
 * Import from Lerna configuration
 */
async function importLerna(cwd: string, configPath?: string): Promise<MonorepoConfig> {
  const lernaJsonPath = configPath || path.join(cwd, 'lerna.json');
  const lernaJson = await fs.readJson(lernaJsonPath);
  const packageJson = await fs.readJson(path.join(cwd, 'package.json'));

  const projects: ProjectInfo[] = [];

  // Lerna packages
  if (lernaJson.packages) {
    const workspaceGlobs = Array.isArray(lernaJson.packages)
      ? lernaJson.packages
      : [lernaJson.packages];

    const workspaceDirs = await findWorkspaceDirs(cwd, workspaceGlobs);

    for (const workspaceDir of workspaceDirs) {
      const projectPkgJson = path.join(cwd, workspaceDir, 'package.json');
      if (!fs.existsSync(projectPkgJson)) continue;

      const projectPkg = await fs.readJson(projectPkgJson);
      const name = projectPkg.name || workspaceDir.split('/').pop() || 'unknown';

      projects.push({
        name,
        path: workspaceDir,
        type: inferProjectType(projectPkg, name),
        framework: inferFramework(projectPkg),
        language: inferLanguage(projectPkg),
        dependencies: projectPkg.dependencies || {},
        scripts: projectPkg.scripts || {},
      });
    }
  }

  return {
    type: 'lerna',
    projects,
    rootPackage: packageJson,
  };
}

/**
 * Import from Yarn workspaces
 */
async function importYarnWorkspaces(cwd: string): Promise<MonorepoConfig> {
  const packageJson = await fs.readJson(path.join(cwd, 'package.json'));
  const projects: ProjectInfo[] = [];

  if (packageJson.workspaces) {
    const workspaceGlobs = Array.isArray(packageJson.workspaces)
      ? packageJson.workspaces
      : packageJson.workspaces.packages || [];

    const workspaceDirs = await findWorkspaceDirs(cwd, workspaceGlobs);

    for (const workspaceDir of workspaceDirs) {
      const projectPkgJson = path.join(cwd, workspaceDir, 'package.json');
      if (!fs.existsSync(projectPkgJson)) continue;

      const projectPkg = await fs.readJson(projectPkgJson);
      const name = projectPkg.name || workspaceDir.split('/').pop() || 'unknown';

      projects.push({
        name,
        path: workspaceDir,
        type: inferProjectType(projectPkg, name),
        framework: inferFramework(projectPkg),
        language: inferLanguage(projectPkg),
        dependencies: projectPkg.dependencies || {},
        scripts: projectPkg.scripts || {},
      });
    }
  }

  return {
    type: 'yarn',
    projects,
    rootPackage: packageJson,
  };
}

/**
 * Import from PNPM workspaces
 */
async function importPnpmWorkspaces(cwd: string): Promise<MonorepoConfig> {
  const workspaceYamlPath = path.join(cwd, 'pnpm-workspace.yaml');
  const workspaceYaml = await fs.readFile(workspaceYamlPath, 'utf-8');
  
  // Simple YAML parser for packages array
  const packagesMatch = workspaceYaml.match(/packages:\s*\n((?:\s*-\s*.+\n?)+)/);
  const workspaceGlobs: string[] = [];

  if (packagesMatch) {
    const lines = packagesMatch[1].split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*-\s*(.+)$/);
      if (match) {
        workspaceGlobs.push(match[1]);
      }
    }
  }

  const packageJson = await fs.readJson(path.join(cwd, 'package.json'));
  const projects: ProjectInfo[] = [];

  const workspaceDirs = await findWorkspaceDirs(cwd, workspaceGlobs);

  for (const workspaceDir of workspaceDirs) {
    const projectPkgJson = path.join(cwd, workspaceDir, 'package.json');
    if (!fs.existsSync(projectPkgJson)) continue;

    const projectPkg = await fs.readJson(projectPkgJson);
    const name = projectPkg.name || workspaceDir.split('/').pop() || 'unknown';

    projects.push({
      name,
      path: workspaceDir,
      type: inferProjectType(projectPkg, name),
      framework: inferFramework(projectPkg),
      language: inferLanguage(projectPkg),
      dependencies: projectPkg.dependencies || {},
      scripts: projectPkg.scripts || {},
    });
  }

  return {
    type: 'pnpm',
    projects,
    rootPackage: packageJson,
  };
}

/**
 * Find workspace directories matching glob patterns
 */
async function findWorkspaceDirs(cwd: string, globs: string[]): Promise<string[]> {
  const dirs: string[] = [];

  for (const pattern of globs) {
    const matches = glob.sync(pattern, { cwd });
    for (const match of matches) {
      const fullPath = path.join(cwd, match);
      if (fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'package.json'))) {
        dirs.push(match);
      }
    }
  }

  return dirs;
}

/**
 * Infer project type from package.json
 */
function inferProjectType(pkg: any, name: string): 'frontend' | 'backend' | 'library' | 'tool' {
  // Check for common frontend patterns
  if (pkg.dependencies?.react || pkg.dependencies?.vue || pkg.dependencies?.angular) {
    return 'frontend';
  }

  if (pkg.dependencies?.express || pkg.dependencies?.fastify || pkg.dependencies?.nest) {
    return 'backend';
  }

  // Check name patterns
  if (name.includes('web') || name.includes('ui') || name.includes('app')) {
    return 'frontend';
  }

  if (name.includes('api') || name.includes('server') || name.includes('backend')) {
    return 'backend';
  }

  if (name.includes('lib') || name.includes('shared') || name.includes('common')) {
    return 'library';
  }

  return 'library';
}

/**
 * Infer framework from package.json
 */
function inferFramework(pkg: any): string | undefined {
  if (pkg.dependencies?.react) return 'react';
  if (pkg.dependencies?.vue) return 'vue';
  if (pkg.dependencies?.angular) return 'angular';
  if (pkg.dependencies?.['@angular/core']) return 'angular';
  if (pkg.dependencies?.svelte) return 'svelte';
  if (pkg.dependencies?.express) return 'express';
  if (pkg.dependencies?.fastify) return 'fastify';
  if (pkg.dependencies?.['@nestjs/core']) return 'nestjs';
  if (pkg.dependencies?.next) return 'next';
  if (pkg.dependencies?.nuxt) return 'nuxt';
  if (pkg.dependencies?.remix) return 'remix';
  return undefined;
}

/**
 * Infer language from package.json
 */
function inferLanguage(pkg: any): string {
  if (pkg.devDependencies?.typescript || pkg.dependencies?.typescript) {
    return 'typescript';
  }
  return 'javascript';
}

/**
 * Detect project frameworks
 */
async function detectProjectFrameworks(config: MonorepoConfig): Promise<void> {
  for (const project of config.projects) {
    // Already detected during import
    if (!project.language) {
      project.language = 'javascript';
    }
  }
}

/**
 * Display import preview
 */
function displayImportPreview(config: MonorepoConfig): void {
  console.log(chalk.bold('\nImport Preview:\n'));
  console.log(chalk.gray('Source: ' + config.type.toUpperCase()));
  console.log(chalk.gray('Projects: ' + config.projects.length + '\n'));

  for (const project of config.projects) {
    console.log(chalk.cyan('  • ' + project.name));
    console.log(chalk.gray('      Path: ' + project.path));
    console.log(chalk.gray('      Type: ' + (project.type || 'unknown')));
    if (project.framework) {
      console.log(chalk.gray('      Framework: ' + project.framework));
    }
    if (project.language) {
      console.log(chalk.gray('      Language: ' + project.language));
    }
    console.log();
  }
}

/**
 * Generate Re-Shell workspace config
 */
function generateWorkspaceConfig(config: MonorepoConfig): string {
  let yaml = 'name: imported-workspace\n';
  yaml += 'version: 2.0.0\n';
  yaml += 'description: Workspace imported from ' + config.type + '\n';
  yaml += 'packageManager: ' + (config.rootPackage?.packageManager || 'pnpm') + '\n\n';
  yaml += 'services:\n';

  for (const project of config.projects) {
    yaml += '  ' + project.name + ':\n';
    yaml += '    name: ' + project.name + '\n';

    // Map library type to worker for valid schema
    const serviceType = project.type === 'library' ? 'worker' : (project.type || 'worker');
    yaml += '    type: ' + serviceType + '\n';
    yaml += '    language: ' + (project.language || 'javascript') + '\n';

    // Add framework for libraries if not present
    if (project.framework) {
      yaml += '    framework: ' + project.framework + '\n';
    } else if (project.type === 'library') {
      yaml += '    framework: vanilla\n';
    }

    yaml += '    path: ' + project.path + '\n';

    if (project.type === 'frontend' && !project.port) {
      // Default ports for frontend
      const portHash = hashString(project.name) % 1000 + 3000;
      yaml += '    port: ' + portHash + '\n';
      yaml += '    route: /' + project.name + '\n';
    }

    if (project.type === 'backend' && !project.port) {
      // Default ports for backend
      const portHash = hashString(project.name + 'backend') % 1000 + 4000;
      yaml += '    port: ' + portHash + '\n';
    }

    if (project.scripts && Object.keys(project.scripts).length > 0) {
      yaml += '    scripts:\n';
      for (const [scriptName, scriptCommand] of Object.entries(project.scripts)) {
        yaml += '      ' + scriptName + ': ' + JSON.stringify(scriptCommand) + '\n';
      }
    }

    if (project.dependencies && Object.keys(project.dependencies).length > 0) {
      yaml += '    dependencies:\n';
      yaml += '      production:\n';
      for (const [dep, version] of Object.entries(project.dependencies)) {
        yaml += '        ' + dep + ': ' + JSON.stringify(version) + '\n';
      }
    }

    yaml += '\n';
  }

  return yaml;
}

/**
 * Simple string hash for port allocation
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
