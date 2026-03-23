import * as fs from 'fs-extra';
import * as path from 'path';
import prompts from 'prompts';
import chalk from 'chalk';
import * as yaml from 'js-yaml';
import { getFrameworkChoices, getFrameworkConfig, validateFramework } from '../utils/framework';
import { findMonorepoRoot } from '../utils/monorepo';
import { getBackendTemplate, listBackendTemplates, type BackendTemplate } from '../templates/backend/index';
import {
  getDatabaseConfig,
  getDatabaseChoices,
  getBackendLanguageChoices,
  getFrameworkChoicesForLanguage,
  getPopularBackendFrameworks,
  getRecommendedFrontends,
  getRecommendedBackends,
  validateFrameworkCompatibility,
  validateBackendFramework,
  validateFrontendFramework,
  validateDatabaseType,
  getCompatibilitySummary,
  checkDependencyConflicts,
  formatDependencyReport,
  getBestPracticesForLanguage,
  applyBestPractices,
  validateProjectConfig,
  formatValidationResult,
  performProjectHealthCheck,
  formatHealthCheckReport,
  type DatabaseType,
  type ProjectConfig
} from '../utils/database';
import {
  getArchitectureTemplate,
  getAllArchitectureTemplates,
  getArchitectureTemplateChoices,
  getPopularArchitectureTemplates,
  type ArchitectureTemplate
} from '../templates/architecture/index';
import { ReactTemplate } from '../templates/frontend/react';
import { VueTemplate } from '../templates/frontend/vue';
import { SvelteTemplate } from '../templates/frontend/svelte';
import { NextJsTemplate } from '../templates/frontend/next';
import { RemixTemplate } from '../templates/frontend/remix';
import { GatsbyTemplate } from '../templates/frontend/gatsby';
import { NuxtTemplate } from '../templates/frontend/nuxt';
import { QuasarTemplate } from '../templates/frontend/quasar';
import { AngularTemplate } from '../templates/frontend/angular';
import { ViteReactTemplate } from '../templates/frontend/vite-react';
import { SvelteKitTemplate } from '../templates/frontend/sveltekit';
import { SolidJsTemplate } from '../templates/frontend/solid-js';
import { QwikTemplate } from '../templates/frontend/qwik';
import { LitTemplate } from '../templates/frontend/lit';
import { StencilTemplate } from '../templates/frontend/stencil';
import { AlpineTemplate } from '../templates/frontend/alpine';
import { PreactTemplate } from '../templates/frontend/preact';
import { MithrilTemplate } from '../templates/frontend/mithril';
import { HyperappTemplate } from '../templates/frontend/hyperapp';
import { AstroTemplate } from '../templates/frontend/astro';
import { EleventyTemplate } from '../templates/frontend/eleventy';
import { VuePressTemplate } from '../templates/frontend/vuepress';
import { DocusaurusTemplate } from '../templates/frontend/docusaurus';
import { GridsomeTemplate } from '../templates/frontend/gridsome';
import { ScullyTemplate } from '../templates/frontend/scully';
import { JekyllTemplate } from '../templates/frontend/jekyll';
import { HugoTemplate } from '../templates/frontend/hugo';
import { HexoTemplate } from '../templates/frontend/hexo';
import { ZolaTemplate } from '../templates/frontend/zola';
import { CreateReactAppTemplate } from '../templates/frontend/create-react-app';
import { VueCliTemplate } from '../templates/frontend/vue-cli';
import { AngularCliTemplate } from '../templates/frontend/angular-cli';
import { ViteSvelteTemplate } from '../templates/frontend/vite-svelte';
import { ReactModuleFederationTemplate } from '../templates/frontend/react-module-federation';
import { VueModuleFederationTemplate } from '../templates/frontend/vue-module-federation';
import { AngularModuleFederationTemplate } from '../templates/frontend/angular-module-federation';
import { SvelteModuleFederationTemplate } from '../templates/frontend/svelte-module-federation';
import { NxAngularTemplate } from '../templates/frontend/nx-angular';
import { AnalogTemplate } from '../templates/frontend/analog';
import { BaseTemplate, TemplateContext } from '../templates/index';
import { ProgressSpinner, flushOutput } from '../utils/spinner';

interface CreateProjectOptions {
  team?: string;
  org?: string;
  description?: string;
  template?: string;
  framework?: string;      // Frontend framework
  backend?: string;         // Backend framework
  frontend?: string;        // Frontend framework (alias for framework)
  db?: string;              // Database type
  fullstack?: boolean;      // Create full-stack project
  polyglot?: boolean;       // Create polyglot microservices
  microfrontend?: boolean;  // Create microfrontend with module federation
  packageManager?: string;
  type?: 'app' | 'package' | 'lib' | 'tool';
  port?: string;
  route?: string;
  isProject?: boolean;
  dryRun?: boolean;
  spinner?: ProgressSpinner;
  verbose?: boolean;
}

/**
 * Microfrontend remote configuration
 */
interface MicrofrontendRemote {
  name: string;
  framework: string;
  port: string;
  route: string;
  path: string;
  exposes: Record<string, string>;
}

/**
 * Microfrontend project configuration
 */
interface MicrofrontendConfig {
  name: string;
  normalizedName: string;
  shellFramework: string;
  remotes: MicrofrontendRemote[];
  org: string;
  team?: string;
  description?: string;
  packageManager: string;
  sharedDeps: string[];
}

/**
 * Polyglot service configuration
 */
interface PolyglotService {
  name: string;
  framework: string;
  port: string;
  language: string;
  path: string;
}

/**
 * Polyglot project configuration
 */
interface PolyglotConfig {
  name: string;
  normalizedName: string;
  services: PolyglotService[];
  gatewayFramework: string;
  frontendFramework?: string;
  database: DatabaseType;
  org: string;
  team?: string;
  description?: string;
  packageManager: string;
}

/**
 * Creates a new Re-Shell project or workspace
 *
 * @param name - Name of the project/workspace
 * @param options - Additional options for project creation
 * @version 0.2.5
 */
export async function createProject(name: string, options: CreateProjectOptions): Promise<void> {
  // Check if we're in a monorepo
  const monorepoRoot = await findMonorepoRoot();
  const inMonorepo = !!monorepoRoot;

  if (options.dryRun) {
    previewProjectCreation(name, options, monorepoRoot);
    return;
  }

  // Handle polyglot microservices creation
  if (options.polyglot) {
    await createPolyglotProject(name, options, monorepoRoot);
    return;
  }

  // Handle microfrontend with module federation creation
  if (options.microfrontend) {
    await createMicrofrontendProject(name, options, monorepoRoot);
    return;
  }

  // Determine if this is a monorepo project creation or workspace creation
  const isWorkspaceCreation = inMonorepo || options.type;

  if (isWorkspaceCreation) {
    await createWorkspace(name, options, monorepoRoot);
  } else {
    await createMonorepoProject(name, options);
  }
}

function previewProjectCreation(
  name: string,
  options: CreateProjectOptions,
  monorepoRoot?: string | null
): void {
  const normalizedName = name.toLowerCase().replace(/\s+/g, '-');
  const rootPath = monorepoRoot || process.cwd();
  const workspaceType = options.type || 'app';
  const workspaceDir =
    workspaceType === 'package'
      ? 'packages'
      : workspaceType === 'lib'
      ? 'libs'
      : workspaceType === 'tool'
      ? 'tools'
      : 'apps';
  const inMonorepo = !!monorepoRoot;
  const targetPaths: string[] = [];
  const previewFiles: string[] = [];

  if (options.polyglot) {
    targetPaths.push(path.join(rootPath, normalizedName));
    previewFiles.push(
      `${normalizedName}/package.json`,
      `${normalizedName}/gateway/package.json`,
      `${normalizedName}/services/<service-name>/Dockerfile`
    );
  } else if (options.microfrontend) {
    targetPaths.push(path.join(rootPath, normalizedName));
    previewFiles.push(
      `${normalizedName}/shell/package.json`,
      `${normalizedName}/shell/vite.config.ts`,
      `${normalizedName}/package.json`
    );
  } else if (inMonorepo || options.type) {
    const workspacePath = path.join(rootPath, workspaceDir, normalizedName);
    targetPaths.push(workspacePath);
    previewFiles.push(
      `${workspaceDir}/${normalizedName}/package.json`,
      `${workspaceDir}/${normalizedName}/src/App.tsx`,
      `${workspaceDir}/${normalizedName}/vite.config.ts`
    );

    if (options.fullstack || options.backend) {
      const serviceName = `${normalizedName}-api`;
      targetPaths.push(path.join(rootPath, 'services', serviceName));
      previewFiles.push(
        `services/${serviceName}/package.json`,
        `services/${serviceName}/src/index.ts`
      );
    }
  } else {
    targetPaths.push(path.join(rootPath, normalizedName));
    previewFiles.push(
      `${normalizedName}/package.json`,
      `${normalizedName}/README.md`,
      `${normalizedName}/apps/`,
      `${normalizedName}/packages/`
    );
  }

  console.log(chalk.cyan('\n🔎 Dry Run Preview\n'));
  console.log(chalk.gray('No files will be created.\n'));
  console.log(`Mode: ${options.polyglot ? 'polyglot' : options.microfrontend ? 'microfrontend' : (options.fullstack || options.backend) ? 'fullstack' : 'frontend'}`);
  console.log(`Name: ${normalizedName}`);
  console.log(`Root: ${rootPath}`);
  if (options.framework) {
    console.log(`Frontend: ${options.framework}`);
  }
  if (options.backend) {
    console.log(`Backend: ${options.backend}`);
  }
  if (options.route) {
    console.log(`Route: ${options.route}`);
  }
  if (options.port) {
    console.log(`Port: ${options.port}`);
  }

  console.log('\nTargets:');
  for (const targetPath of targetPaths) {
    console.log(`  • ${targetPath}`);
  }

  if (options.verbose) {
    console.log('\nPreview files:');
    for (const file of previewFiles) {
      console.log(`  • ${file}`);
    }
  }
}

/**
 * Creates a polyglot microservices project with services in multiple languages
 *
 * @param name - Name of the polyglot project
 * @param options - Additional options for project creation
 * @param monorepoRoot - Optional monorepo root path
 */
async function createPolyglotProject(
  name: string,
  options: CreateProjectOptions,
  monorepoRoot?: string | null
): Promise<void> {
  const {
    team,
    org = 're-shell',
    description,
    db = 'prisma',
    packageManager = 'pnpm',
    spinner,
  } = options;

  const normalizedName = name.toLowerCase().replace(/\s+/g, '-');
  const rootPath = monorepoRoot || process.cwd();

  console.log(chalk.cyan.bold('\n🌐 Creating Polyglot Microservices Project\n'));

  // Stop spinner for interactive prompts
  if (spinner) spinner.stop();

  // Step 1: Ask about API Gateway framework
  const { gatewayFramework } = await prompts({
    type: 'select',
    name: 'gatewayFramework',
    message: 'Select API Gateway framework:',
    choices: [
      { title: 'Express (Node.js)', value: 'express', description: 'Lightweight and flexible' },
      { title: 'Fastify (Node.js)', value: 'fastify', description: 'High performance' },
      { title: 'NestJS (Node.js)', value: 'nestjs', description: 'Enterprise-grade with modules' },
      { title: 'Traefik (Go-based proxy)', value: 'traefik', description: 'Cloud-native edge router' },
      { title: 'Kong (Lua-based proxy)', value: 'kong', description: 'Feature-rich API gateway' },
    ],
    initial: 0,
  });

  // Step 2: Ask if frontend is needed
  const { includeFrontend } = await prompts({
    type: 'confirm',
    name: 'includeFrontend',
    message: 'Include a frontend application?',
    initial: true,
  });

  let frontendFramework: string | undefined;
  if (includeFrontend) {
    const { frontend } = await prompts({
      type: 'select',
      name: 'frontend',
      message: 'Select frontend framework:',
      choices: [
        { title: 'React', value: 'react' },
        { title: 'Next.js', value: 'next' },
        { title: 'Vue', value: 'vue' },
        { title: 'Angular', value: 'angular' },
        { title: 'Svelte', value: 'svelte' },
      ],
      initial: 0,
    });
    frontendFramework = frontend;
  }

  // Step 3: Select database
  const { database } = await prompts({
    type: 'select',
    name: 'database',
    message: 'Select database for shared data access:',
    choices: getDatabaseChoices(),
    initial: 1, // Default to Prisma
  });

  // Step 4: Add services
  const services: PolyglotService[] = [];
  let addingServices = true;
  const servicePortBase = 3001;

  console.log(chalk.blue('\n📦 Add microservices to your polyglot project:\n'));

  while (addingServices) {
    // Select programming language
    const { language } = await prompts({
      type: 'select',
      name: 'language',
      message: `Select language for service ${services.length + 1}:`,
      choices: getBackendLanguageChoices(),
      initial: 0,
    });

    // Select framework within that language
    const frameworkChoices = getFrameworkChoicesForLanguage(language);
    const { framework } = await prompts({
      type: 'select',
      name: 'framework',
      message: `Select ${language} framework:`,
      choices: frameworkChoices,
      initial: 0,
    });

    // Service name
    const { serviceName } = await prompts({
      type: 'text',
      name: 'serviceName',
      message: 'Service name (kebab-case):',
      initial: `${language.toLowerCase()}-service-${services.length + 1}`,
      validate: (val: string) => {
        if (!val || !val.match(/^[a-z][a-z0-9-]*$/)) {
          return 'Use lowercase letters, numbers, and hyphens only';
        }
        return true;
      },
    });

    // Get backend template for port info
    const backendTemplate = getBackendTemplate(framework);
    const servicePort = backendTemplate?.port?.toString() || (servicePortBase + services.length).toString();

    services.push({
      name: serviceName,
      framework,
      port: servicePort,
      language,
      path: `services/${serviceName}`,
    });

    console.log(chalk.green(`✓ Added "${serviceName}" (${language})\n`));

    // Ask if user wants to add more services
    if (services.length >= 2) {
      const { addMore } = await prompts({
        type: 'confirm',
        name: 'addMore',
        message: 'Add another service?',
        initial: false,
      });
      addingServices = addMore;
    }
  }

  if (services.length === 0) {
    console.log(chalk.yellow('\nNo services added. Project creation cancelled.\n'));
    return;
  }

  // Show summary
  console.log(chalk.bold('\n📋 Polyglot Project Summary:\n'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`${chalk.bold('Project:')} ${name}`);
  console.log(`${chalk.bold('API Gateway:')} ${gatewayFramework}`);
  if (frontendFramework) {
    console.log(`${chalk.bold('Frontend:')} ${frontendFramework}`);
  }
  console.log(`${chalk.bold('Database:')} ${database}`);
  console.log(chalk.bold('\nServices:'));
  services.forEach((s, i) => {
    const icon = getServiceIcon(s.language);
    console.log(`  ${i + 1}. ${icon} ${s.name} (${s.language}) - Port ${s.port}`);
  });
  console.log(chalk.gray('─'.repeat(50)));

  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: '\nCreate this polyglot project?',
    initial: true,
  });

  if (!confirm) {
    console.log(chalk.yellow('\nProject creation cancelled.\n'));
    return;
  }

  // Restart spinner for file operations
  if (spinner) {
    spinner.start();
    spinner.setText('Creating polyglot project structure...');
    flushOutput();
  }

  // Create project structure
  const projectPath = path.join(rootPath, normalizedName);
  await fs.ensureDir(projectPath);

  // Create polyglot configuration
  const polyglotConfig: PolyglotConfig = {
    name,
    normalizedName,
    services,
    gatewayFramework,
    frontendFramework,
    database: database as DatabaseType,
    org,
    team,
    description: description || `Polyglot microservices project with ${services.length} services`,
    packageManager,
  };

  // Generate project files
  await generatePolyglotProjectFiles(projectPath, polyglotConfig);

  console.log(chalk.green.bold(`\n✓ Polyglot project "${normalizedName}" created successfully!\n`));
  console.log(chalk.gray(`Path: ${path.relative(process.cwd(), projectPath)}`));
  console.log('\nNext steps:');
  console.log(`  1. cd ${normalizedName}`);
  console.log(`  2. ${packageManager} install`);
  console.log(`  3. ${packageManager} run dev`);
  console.log('\n📚 Services will be available at:');
  services.forEach((s) => {
    console.log(`  • http://localhost:${s.port} - ${s.name}`);
  });
  if (frontendFramework) {
    console.log(`  • http://localhost:3000 - Frontend`);
  }
  console.log(`  • http://localhost:8080 - API Gateway`);
}

/**
 * Get an icon for a programming language
 */
function getServiceIcon(language: string): string {
  const icons: Record<string, string> = {
    'JavaScript': '🟨',
    'TypeScript': '🔷',
    'Python': '🐍',
    'Go': '🐹',
    'Rust': '🦀',
    'Java': '☕',
    'C#': '🔷',
    'Ruby': '💎',
    'PHP': '🐘',
    'Elixir': '💜',
    'C++': '⚡',
    'Swift': '🍎',
    'Kotlin': '🎯',
    'Dart': '🎯',
  };
  return icons[language] || '📦';
}

/**
 * Creates a microfrontend project with Module Federation
 *
 * @param name - Name of the microfrontend project
 * @param options - Additional options for project creation
 * @param monorepoRoot - Optional monorepo root path
 */
async function createMicrofrontendProject(
  name: string,
  options: CreateProjectOptions,
  monorepoRoot?: string | null
): Promise<void> {
  const {
    team,
    org = 're-shell',
    description,
    packageManager = 'pnpm',
    spinner,
  } = options;

  const normalizedName = name.toLowerCase().replace(/\s+/g, '-');
  const rootPath = monorepoRoot || process.cwd();

  console.log(chalk.cyan.bold('\n🧩 Creating Microfrontend Project with Module Federation\n'));

  // Stop spinner for interactive prompts
  if (spinner) spinner.stop();

  // Step 1: Select shell framework
  const { shellFramework } = await prompts({
    type: 'select',
    name: 'shellFramework',
    message: 'Select shell application framework:',
    choices: [
      { title: 'React', value: 'react', description: 'Most popular, extensive ecosystem' },
      { title: 'React + TypeScript', value: 'react-ts', description: 'Type-safe React development' },
      { title: 'Vue', value: 'vue', description: 'Progressive framework' },
      { title: 'Vue + TypeScript', value: 'vue-ts', description: 'Type-safe Vue development' },
      { title: 'Angular', value: 'angular', description: 'Full-featured framework' },
      { title: 'Svelte', value: 'svelte', description: 'Lightweight and fast' },
    ],
    initial: 1, // Default to react-ts
  });

  // Step 2: Select shared dependencies
  const { useSharedDeps } = await prompts({
    type: 'multiselect',
    name: 'useSharedDeps',
    message: 'Select shared dependencies (will be single instance):',
    choices: [
      { title: 'React', value: 'react', selected: true },
      { title: 'ReactDOM', value: 'react-dom', selected: true },
      { title: 'Vue', value: 'vue' },
      { title: 'Angular', value: '@angular/core' },
      { title: 'rxjs', value: 'rxjs' },
      { title: 'React Router', value: 'react-router-dom' },
      { title: 'Vue Router', value: 'vue-router' },
      { title: 'Zustand', value: 'zustand' },
      { title: 'Redux', value: 'redux' },
      { title: 'axios', value: 'axios' },
      { title: 'lodash', value: 'lodash' },
      { title: 'date-fns', value: 'date-fns' },
    ],
    min: 1,
  });

  // Step 3: Add remote microfrontends
  const remotes: MicrofrontendRemote[] = [];
  let addingRemotes = true;
  const portBase = 3001;

  console.log(chalk.blue('\n📦 Add remote microfrontends:\n'));

  while (addingRemotes) {
    // Select framework for remote
    const { framework } = await prompts({
      type: 'select',
      name: 'framework',
      message: `Select framework for remote ${remotes.length + 1}:`,
      choices: [
        { title: 'React', value: 'react' },
        { title: 'React + TypeScript', value: 'react-ts' },
        { title: 'Vue', value: 'vue' },
        { title: 'Vue + TypeScript', value: 'vue-ts' },
        { title: 'Angular', value: 'angular' },
        { title: 'Svelte', value: 'svelte' },
      ],
      initial: 0,
    });

    // Remote name
    const { remoteName } = await prompts({
      type: 'text',
      name: 'remoteName',
      message: 'Remote name (kebab-case):',
      initial: `remote-${remotes.length + 1}`,
      validate: (val: string) => {
        if (!val || !val.match(/^[a-z][a-z0-9-]*$/)) {
          return 'Use lowercase letters, numbers, and hyphens only';
        }
        return true;
      },
    });

    // Route for remote
    const { route } = await prompts({
      type: 'text',
      name: 'route',
      message: 'Route path (for shell routing):',
      initial: `/${remoteName}`,
      validate: (val: string) => (val.startsWith('/') ? true : 'Route must start with /'),
    });

    // Exposed modules
    const { hasExposed } = await prompts({
      type: 'confirm',
      name: 'hasExposed',
      message: 'Expose specific components from this remote?',
      initial: true,
    });

    const exposes: Record<string, string> = {};
    if (hasExposed) {
      const { exposePath } = await prompts({
        type: 'text',
        name: 'exposePath',
        message: 'Default exposed component path:',
        initial: './src/App',
      });
      exposes['./App'] = exposePath;
    }

    const remotePort = (portBase + remotes.length).toString();

    remotes.push({
      name: remoteName,
      framework,
      port: remotePort,
      route,
      path: `remotes/${remoteName}`,
      exposes,
    });

    console.log(chalk.green(`✓ Added "${remoteName}" (${framework}) at port ${remotePort}\n`));

    // Ask if user wants to add more remotes
    if (remotes.length >= 1) {
      const { addMore } = await prompts({
        type: 'confirm',
        name: 'addMore',
        message: 'Add another remote microfrontend?',
        initial: false,
      });
      addingRemotes = addMore;
    }
  }

  if (remotes.length === 0) {
    console.log(chalk.yellow('\nNo remotes added. Creating shell only...\n'));
  }

  // Show summary
  console.log(chalk.bold('\n📋 Microfrontend Project Summary:\n'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`${chalk.bold('Project:')} ${name}`);
  console.log(`${chalk.bold('Shell:')} ${shellFramework} (Port 3000)`);
  console.log(`${chalk.bold('Shared Dependencies:')} ${useSharedDeps.join(', ')}`);
  if (remotes.length > 0) {
    console.log(chalk.bold('\nRemote Microfrontends:'));
    remotes.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name} (${r.framework}) - Port ${r.port} - Route: ${r.route}`);
    });
  }
  console.log(chalk.gray('─'.repeat(50)));

  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: '\nCreate this microfrontend project?',
    initial: true,
  });

  if (!confirm) {
    console.log(chalk.yellow('\nProject creation cancelled.\n'));
    return;
  }

  // Restart spinner for file operations
  if (spinner) {
    spinner.start();
    spinner.setText('Creating microfrontend project structure...');
    flushOutput();
  }

  // Create project structure
  const projectPath = path.join(rootPath, normalizedName);
  await fs.ensureDir(projectPath);

  // Create microfrontend configuration
  const mfConfig: MicrofrontendConfig = {
    name,
    normalizedName,
    shellFramework,
    remotes,
    org,
    team,
    description: description || `Microfrontend project with ${remotes.length} remote${remotes.length !== 1 ? 's' : ''}`,
    packageManager,
    sharedDeps: useSharedDeps,
  };

  // Generate project files
  await generateMicrofrontendProjectFiles(projectPath, mfConfig);

  console.log(chalk.green.bold(`\n✓ Microfrontend project "${normalizedName}" created successfully!\n`));
  console.log(chalk.gray(`Path: ${path.relative(process.cwd(), projectPath)}`));
  console.log('\nNext steps:');
  console.log(`  1. cd ${normalizedName}`);
  console.log(`  2. ${packageManager} install`);
  console.log(`  3. ${packageManager} run dev`);
  console.log('\n📚 Applications will be available at:');
  console.log(`  • http://localhost:3000 - Shell Application`);
  remotes.forEach((r) => {
    console.log(`  • http://localhost:${r.port} - ${r.name} (for standalone development)`);
  });
}

/**
 * Generate microfrontend project files with Module Federation
 */
async function generateMicrofrontendProjectFiles(
  projectPath: string,
  config: MicrofrontendConfig
): Promise<void> {
  const { shellFramework, remotes, org, description, packageManager, sharedDeps } = config;

  // Create root package.json
  const rootPackageJson = {
    name: config.name,
    version: '0.1.0',
    description,
    private: true,
    workspaces: [
      'shell',
      ...remotes.map((r) => r.path),
      'shared',
    ],
    scripts: {
      dev: packageManager === 'npm'
        ? 'npm-run-all --parallel dev:*'
        : `${packageManager} run --parallel dev:*`,
      'dev:shell': `cd shell && ${packageManager} run dev`,
      ...Object.fromEntries(remotes.map((r) => [`dev:${r.name}`, `cd ${r.path} && ${packageManager} run dev`])),
      build: packageManager === 'npm'
        ? 'npm-run-all --parallel build:*'
        : `${packageManager} run --parallel build:*`,
      'build:shell': `cd shell && ${packageManager} run build`,
      ...Object.fromEntries(remotes.map((r) => [`build:${r.name}`, `cd ${r.path} && ${packageManager} run build`])),
      lint: 'eslint . --ext .js,.ts,.jsx,.tsx,.vue',
      clean: 'rm -rf node_modules **/node_modules **/dist',
    },
    author: config.team || org,
    license: 'MIT',
    devDependencies: {
      'npm-run-all': '^4.1.5',
      '@typescript-eslint/eslint-plugin': '^6.0.0',
      '@typescript-eslint/parser': '^6.0.0',
      'eslint': '^8.0.0',
    },
  };

  await fs.writeJson(path.join(projectPath, 'package.json'), rootPackageJson, { spaces: 2 });

  // Create pnpm workspace file if using pnpm
  if (packageManager === 'pnpm') {
    await fs.writeFile(
      path.join(projectPath, 'pnpm-workspace.yaml'),
      `packages:\n  - 'shell'\n${remotes.map((r) => `  - '${r.path}'`).join('\n')}\n  - 'shared'\n`
    );
  }

  // Create shared package for common utilities
  const sharedPath = path.join(projectPath, 'shared');
  await fs.ensureDir(sharedPath);
  await generateSharedPackage(sharedPath, config);

  // Generate shell application
  const shellPath = path.join(projectPath, 'shell');
  await fs.ensureDir(shellPath);
  await generateShellApp(shellPath, config);

  // Generate each remote
  for (const remote of remotes) {
    const remotePath = path.join(projectPath, remote.path);
    await fs.ensureDir(remotePath);
    await generateRemoteApp(remotePath, remote, config);
  }

  // Create README
  await generateMicrofrontendReadme(projectPath, config);
}

/**
 * Generate shared package for utilities and types
 */
async function generateSharedPackage(sharedPath: string, config: MicrofrontendConfig): Promise<void> {
  const { normalizedName } = config;

  const packageJson = {
    name: `${normalizedName}-shared`,
    version: '0.1.0',
    description: 'Shared utilities and types for microfrontend project',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc',
      watch: 'tsc --watch',
    },
    dependencies: {},
    devDependencies: {
      typescript: '^5.0.0',
    },
  };

  await fs.writeJson(path.join(sharedPath, 'package.json'), packageJson, { spaces: 2 });

  // Generate shared utilities
  const utilsContent = `// Shared utilities for ${config.name}
// This package is shared between shell and all remotes

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface NavigationItem {
  path: string;
  label: string;
  icon?: string;
}

// Event bus for cross-microfrontend communication
class EventBus {
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, data?: unknown): void {
    this.listeners.get(event)?.forEach((callback) => callback(data));
  }
}

export const eventBus = new EventBus();

// Common navigation items
export const navigationItems: NavigationItem[] = [
${config.remotes.map((r) => `  { path: '${r.route}', label: '${toPascalCase(r.name)}' },`).join('\n')}
];
`;

  await fs.writeFile(path.join(sharedPath, 'src/index.ts'), utilsContent);

  // Generate tsconfig
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      declaration: true,
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ['src/**/*'],
  };

  await fs.writeJson(path.join(sharedPath, 'tsconfig.json'), tsconfig, { spaces: 2 });
}

/**
 * Generate shell application with Module Federation
 */
async function generateShellApp(shellPath: string, config: MicrofrontendConfig): Promise<void> {
  const { shellFramework, remotes, sharedDeps } = config;

  const frameworkConfig = getFrameworkConfig(shellFramework);
  if (!frameworkConfig) {
    throw new Error(`Unsupported framework: ${shellFramework}`);
  }

  // Determine module federation template based on framework
  const mfTemplate = shellFramework.includes('react')
    ? 'react-module-federation'
    : shellFramework.includes('vue')
    ? 'vue-module-federation'
    : shellFramework.includes('angular')
    ? 'angular-module-federation'
    : shellFramework.includes('svelte')
    ? 'svelte-module-federation'
    : 'react-module-federation';

  // Generate shell with Module Federation config
  const templateContext: TemplateContext = {
    name: `${config.name}-shell`,
    normalizedName: `${config.normalizedName}-shell`,
    framework: mfTemplate,
    hasTypeScript: frameworkConfig.hasTypeScript || false,
    port: '3000',
    route: '/',
    org: config.org,
    team: config.team,
    description: `${config.name} Shell Application`,
    packageManager: config.packageManager,
  };

  // Create shell template
  const template = createMfShellTemplate(mfTemplate, templateContext, remotes, sharedDeps);
  const files = await template.generateFiles();

  for (const file of files) {
    const filePath = path.join(shellPath, file.path);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, file.content);
  }

  // Generate shell-specific routing
  await generateShellRouting(shellPath, config);
}

/**
 * Create Module Federation shell template
 */
function createMfShellTemplate(
  framework: string,
  context: TemplateContext,
  remotes: MicrofrontendRemote[],
  sharedDeps: string[]
): BaseTemplate {
  // Create a fake framework config
  const frameworkConfig = { name: framework, hasTypeScript: context.hasTypeScript };
  // Return appropriate template based on framework
  switch (framework) {
    case 'react-module-federation':
      return new ReactModuleFederationShellTemplate(frameworkConfig, context, remotes, sharedDeps);
    case 'vue-module-federation':
      return new VueModuleFederationShellTemplate(frameworkConfig, context, remotes, sharedDeps);
    case 'angular-module-federation':
      return new AngularModuleFederationShellTemplate(frameworkConfig, context, remotes, sharedDeps);
    case 'svelte-module-federation':
      return new SvelteModuleFederationShellTemplate(frameworkConfig, context, remotes, sharedDeps);
    default:
      return new ReactModuleFederationShellTemplate(frameworkConfig, context, remotes, sharedDeps);
  }
}

/**
 * Generate shell routing configuration
 */
async function generateShellRouting(shellPath: string, config: MicrofrontendConfig): Promise<void> {
  const { shellFramework, remotes } = config;

  if (shellFramework.includes('react')) {
    const routingContent = generateReactRouting(config);
    await fs.writeFile(path.join(shellPath, 'src/src/Routing.tsx'), routingContent);
  } else if (shellFramework.includes('vue')) {
    const routingContent = generateVueRouting(config);
    await fs.writeFile(path.join(shellPath, 'src/src/router/index.ts'), routingContent);
  }
}

/**
 * Generate React routing for shell
 */
function generateReactRouting(config: MicrofrontendConfig): string {
  const { remotes } = config;

  return `import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const LoadingFallback = () => <div>Loading...</div>;

// Dynamic imports for remote microfrontends
${remotes.map((r) => {
  const componentPascal = toPascalCase(r.name);
  return `const ${componentPascal} = lazy(() =>
  import('${r.name}/${Object.keys(r.exposes)[0] || 'App'}')
);`;
}).join('\n')}

export default function AppRouting() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<div>Welcome to ${config.name} Shell</div>} />
${remotes.map((r) => `          <Route path="${r.route}" element={<${toPascalCase(r.name)} />} />`).join('\n')}
        </Routes>
      </BrowserRouter>
    </Suspense>
  );
}
`;
}

/**
 * Generate Vue routing for shell
 */
function generateVueRouting(config: MicrofrontendConfig): string {
  const { remotes } = config;

  return `import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/home',
    component: () => import('@/views/Home.vue'),
  },
${remotes.map((r) => `  {
    path: '${r.route}',
    component: () => import('${r.name}/${Object.keys(r.exposes)[0] || 'App'}'),
  },`).join('\n')}
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
`;
}

/**
 * Generate remote microfrontend application
 */
async function generateRemoteApp(
  remotePath: string,
  remote: MicrofrontendRemote,
  config: MicrofrontendConfig
): Promise<void> {
  const { sharedDeps } = config;

  const frameworkConfig = getFrameworkConfig(remote.framework);
  if (!frameworkConfig) {
    throw new Error(`Unsupported framework: ${remote.framework}`);
  }

  // Determine module federation template
  const mfTemplate = remote.framework.includes('react')
    ? 'react-module-federation'
    : remote.framework.includes('vue')
    ? 'vue-module-federation'
    : remote.framework.includes('angular')
    ? 'angular-module-federation'
    : remote.framework.includes('svelte')
    ? 'svelte-module-federation'
    : 'react-module-federation';

  const templateContext: TemplateContext = {
    name: remote.name,
    normalizedName: remote.name,
    framework: mfTemplate,
    hasTypeScript: frameworkConfig.hasTypeScript || false,
    port: remote.port,
    route: remote.route,
    org: config.org,
    team: config.team,
    description: `${remote.name} Remote Microfrontend`,
    packageManager: config.packageManager,
  };

  const template = createMfRemoteTemplate(mfTemplate, templateContext, remote, sharedDeps);
  const files = await template.generateFiles();

  for (const file of files) {
    const filePath = path.join(remotePath, file.path);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, file.content);
  }
}

/**
 * Create Module Federation remote template
 */
function createMfRemoteTemplate(
  framework: string,
  context: TemplateContext,
  remote: MicrofrontendRemote,
  sharedDeps: string[]
): BaseTemplate {
  // Create a fake framework config
  const frameworkConfig = { name: framework, hasTypeScript: context.hasTypeScript };
  switch (framework) {
    case 'react-module-federation':
      return new ReactModuleFederationRemoteTemplate(frameworkConfig, context, remote, sharedDeps);
    case 'vue-module-federation':
      return new VueModuleFederationRemoteTemplate(frameworkConfig, context, remote, sharedDeps);
    case 'angular-module-federation':
      return new AngularModuleFederationRemoteTemplate(frameworkConfig, context, remote, sharedDeps);
    case 'svelte-module-federation':
      return new SvelteModuleFederationRemoteTemplate(frameworkConfig, context, remote, sharedDeps);
    default:
      return new ReactModuleFederationRemoteTemplate(frameworkConfig, context, remote, sharedDeps);
  }
}

/**
 * Generate microfrontend README
 */
async function generateMicrofrontendReadme(projectPath: string, config: MicrofrontendConfig): Promise<void> {
  const { shellFramework, remotes, normalizedName } = config;

  const readmeContent = `# ${config.name}

A microfrontend project created with [Re-Shell CLI](https://github.com/umutkorkmaz/re-shell-cli) using Module Federation.

## Architecture

This project uses Webpack 5 Module Federation to share code between the shell application and remote microfrontends.

\`\`\`
┌─────────────────────────────────────────┐
│          Shell Application             │
│          (${shellFramework})            │
│          Port: 3000                     │
└────────────────┬────────────────────────┘
                 │
${remotes.map((r) => `┌────────────────▼────────────────┐
│  ${r.name.padEnd(28)} │
│  ${r.framework.padEnd(28)} │
│  Port: ${r.port.padEnd(20)} │
└────────────────────────────────┘`).join('\n                 │\n')}
                 │
┌────────────────▼────────────────┐
│         Shared Package           │
│    Utilities & Types             │
└──────────────────────────────────┘
\`\`\`

## Applications

| Application | Framework | Port | Path |
|-------------|-----------|------|------|
| Shell | ${shellFramework} | 3000 | /shell |
${remotes.map((r) => `| ${r.name} | ${r.framework} | ${r.port} | ${r.path} |`).join('\n')}

## Shared Dependencies

These dependencies are shared as singletons across all applications:

\`\`\`
${config.sharedDeps.join(', ')}
\`\`\`

## Getting Started

### Installation

\`\`\`bash
# Install all dependencies
${config.packageManager} install
\`\`\`

### Development

\`\`\`bash
# Start all applications (shell + all remotes)
${config.packageManager} run dev

# Start shell only
${config.packageManager} run dev:shell

# Start specific remote
${config.packageManager} run dev:${remotes[0]?.name || '<remote-name>'}
\`\`\`

### Building

\`\`\`bash
# Build all applications
${config.packageManager} run build

# Build shell only
${config.packageManager} run build:shell

# Build specific remote
${config.packageManager} run build:${remotes[0]?.name || '<remote-name>'}
\`\`\`

## Development Workflow

### Adding a New Remote

1. Create the remote app:

\`\`\`bash
re-shell create my-remote --microfrontend --framework react
\`\`\`

2. Update the shell's Module Federation config to include the new remote:

\`\`\`javascript
// shell/webpack.config.js
remotes: {
  myRemote: 'myRemote@http://localhost:3002/remoteEntry.js',
},
\`\`\`

3. Add routing for the new remote in the shell.

### Shared Package

The \`shared/\` directory contains utilities and types shared across all microfrontends:

\`\`\`typescript
import { eventBus, User } from '${normalizedName}-shared';

// Use shared event bus for cross-MF communication
eventBus.emit('user:login', { id: '123', name: 'John' });

eventBus.on('user:logout', () => {
  // Handle logout across all MFs
});
\`\`\`

## Module Federation Configuration

### Shell

The shell exposes no modules but consumes all remotes:

\`\`\`javascript
// shell/webpack.config.js
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
${remotes.map((r) => `        ${r.name}: '${r.name}@http://localhost:${r.port}/remoteEntry.js',`).join('\n')}
      },
      shared: {
${config.sharedDeps.map((d) => `        '${d}': { singleton: true },`).join('\n')}
      },
    }),
  ],
};
\`\`\`

### Remote (${remotes[0]?.name || 'example'})

Each remote exposes its components:

\`\`\`javascript
// remotes/${remotes[0]?.name || 'example'}/webpack.config.js
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: '${remotes[0]?.name || 'remote'}',
      filename: 'remoteEntry.js',
      exposes: {
${Object.entries(remotes[0]?.exposes || { './App': './src/App' }).map(([key, val]) => `        '${key}': '${val}',`).join('\n')}
      },
      shared: {
${config.sharedDeps.map((d) => `        '${d}': { singleton: true },`).join('\n')}
      },
    }),
  ],
};
\`\`\`

## License

MIT

---

Generated with ❤️ by [Re-Shell CLI](https://github.com/umutkorkmaz/re-shell-cli)
`;

  await fs.writeFile(path.join(projectPath, 'README.md'), readmeContent);
}

/**
 * Generate polyglot project files
 */
async function generatePolyglotProjectFiles(
  projectPath: string,
  config: PolyglotConfig
): Promise<void> {
  const { services, gatewayFramework, frontendFramework, database, org, description, packageManager } = config;

  // Create root package.json
  const rootPackageJson = {
    name: config.name,
    version: '0.1.0',
    description,
    private: true,
    workspaces: [
      'services/*',
      frontendFramework ? 'frontend' : null,
      'gateway',
    ].filter(Boolean) as string[],
    scripts: {
      dev: packageManager === 'npm'
        ? 'npm-run-all --parallel dev:*'
        : `${packageManager} run --parallel dev:*`,
      'dev:gateway': `cd gateway && ${packageManager} run dev`,
      ...(frontendFramework ? { 'dev:frontend': `cd frontend && ${packageManager} run dev` } : {}),
      ...Object.fromEntries(services.map((s) => [`dev:${s.name}`, `cd services/${s.name} && ${packageManager} run dev`])),
      build: packageManager === 'npm'
        ? 'npm-run-all --parallel build:*'
        : `${packageManager} run --parallel build:*`,
      'build:gateway': `cd gateway && ${packageManager} run build`,
      ...(frontendFramework ? { 'build:frontend': `cd frontend && ${packageManager} run build` } : {}),
      test: packageManager === 'npm'
        ? 'npm-run-all --parallel test:*'
        : `${packageManager} run --parallel test:*`,
      lint: 'eslint . --ext .js,.ts,.jsx,.tsx',
      clean: 'rm -rf node_modules **/node_modules **/dist **/build',
    },
    author: config.team || org,
    license: 'MIT',
    devDependencies: {
      'npm-run-all': '^4.1.5',
    },
  };

  await fs.writeJson(path.join(projectPath, 'package.json'), rootPackageJson, { spaces: 2 });

  // Create pnpm workspace file if using pnpm
  if (packageManager === 'pnpm') {
    await fs.writeFile(
      path.join(projectPath, 'pnpm-workspace.yaml'),
      `packages:\n  - 'services/*'\n  - 'gateway'\n  ${frontendFramework ? "- 'frontend'" : ''}\n`
    );
  }

  // Create Docker Compose for all services
  const dockerCompose = generateDockerCompose(config);
  await fs.writeFile(path.join(projectPath, 'docker-compose.yml'), dockerCompose);

  // Create shared types package
  const sharedPath = path.join(projectPath, 'shared');
  await fs.ensureDir(sharedPath);
  await generateSharedTypes(sharedPath, config, database);

  // Create API Gateway
  const gatewayPath = path.join(projectPath, 'gateway');
  await fs.ensureDir(gatewayPath);
  await generateApiGateway(gatewayPath, config);

  // Create each service
  for (const service of services) {
    const servicePath = path.join(projectPath, 'services', service.name);
    await fs.ensureDir(servicePath);
    await generateService(servicePath, service, config);
  }

  // Create frontend if specified
  if (frontendFramework) {
    const frontendPath = path.join(projectPath, 'frontend');
    await fs.ensureDir(frontendPath);
    await generateFrontend(frontendPath, frontendFramework, config);
  }

  // Create README
  await generatePolyglotReadme(projectPath, config);
}

/**
 * Generate Docker Compose configuration for polyglot project
 */
function generateDockerCompose(config: PolyglotConfig): string {
  const { services, database, gatewayFramework } = config;

  let compose = `version: '3.8'

services:
`;
  // Add services
  services.forEach((service) => {
    const imageName = service.name.toLowerCase();
    compose += `  ${service.name}:
    build: ./services/${service.name}
    ports:
      - "${service.port}:${service.port}"
    environment:
      - PORT=${service.port}
      - DATABASE_URL=postgresql://user:pass@db:5432/${config.normalizedName}
    depends_on:
      - db
    networks:
      - ${config.normalizedName}-network

`;
  });

  // Add gateway
  compose += `  gateway:
    build: ./gateway
    ports:
      - "8080:8080"
    depends_on:
`;
  services.forEach((s) => {
    compose += `      - ${s.name}\n`;
  });
  compose += `    networks:
      - ${config.normalizedName}-network

`;

  // Add frontend if exists
  if (config.frontendFramework) {
    compose += `  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - gateway
    networks:
      - ${config.normalizedName}-network

`;
  }

  // Add database
  if (database !== 'none') {
    compose += `  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=${config.normalizedName}
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - ${config.normalizedName}-network

volumes:
  postgres-data:

`;
  }

  compose += `networks:
  ${config.normalizedName}-network:
    driver: bridge
`;

  return compose;
}

/**
 * Generate shared types package
 */
async function generateSharedTypes(sharedPath: string, config: PolyglotConfig, db: string): Promise<void> {
  const sharedPackageJson = {
    name: `${config.normalizedName}-shared`,
    version: '0.1.0',
    description: 'Shared types and interfaces for polyglot project',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc',
      watch: 'tsc --watch',
    },
    dependencies: {},
    devDependencies: {
      typescript: '^5.0.0',
    },
  };

  await fs.writeJson(path.join(sharedPath, 'package.json'), sharedPackageJson, { spaces: 2 });

  // Generate TypeScript types
  const typesContent = `// Shared types for ${config.name}
// Auto-generated by Re-Shell CLI

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  version: string;
  uptime: number;
}

${config.services.map((s) => `
// ${s.name} types
export interface ${toPascalCase(s.name)}Request {
  // Add request fields
}

export interface ${toPascalCase(s.name)}Response {
  // Add response fields
}
`).join('\n')}
`;

  await fs.writeFile(path.join(sharedPath, 'src/index.ts'), typesContent);

  // Generate tsconfig
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      declaration: true,
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  };

  await fs.writeJson(path.join(sharedPath, 'tsconfig.json'), tsconfig, { spaces: 2 });
}

/**
 * Generate API Gateway
 */
async function generateApiGateway(gatewayPath: string, config: PolyglotConfig): Promise<void> {
  const { gatewayFramework, services } = config;

  // Generate gateway based on framework
  if (gatewayFramework === 'express' || gatewayFramework === 'fastify' || gatewayFramework === 'nestjs') {
    await generateNodeGateway(gatewayPath, config);
  } else {
    await generateProxyGateway(gatewayPath, config);
  }
}

/**
 * Generate Node.js API Gateway (Express/Fastify/NestJS)
 */
async function generateNodeGateway(gatewayPath: string, config: PolyglotConfig): Promise<void> {
  const { gatewayFramework, services, normalizedName } = config;

  const gatewayPackageJson = {
    name: `${normalizedName}-gateway`,
    version: '0.1.0',
    description: `API Gateway for ${config.name}`,
    scripts: {
      dev: 'tsx watch src/index.ts',
      build: 'tsc',
      start: 'node dist/index.js',
    },
    dependencies: {
      ...(gatewayFramework === 'express' ? {
        express: '^4.18.0',
        '@types/express': '^4.17.0',
      } : gatewayFramework === 'fastify' ? {
        fastify: '^4.0.0',
      } : {
        '@nestjs/common': '^10.0.0',
        '@nestjs/core': '^10.0.0',
        '@nestjs/platform-express': '^10.0.0',
        'reflect-metadata': '^0.1.0',
      }),
      'http-proxy-middleware': '^2.0.0',
      cors: '^2.8.5',
      'dotenv': '^16.0.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
      tsx: '^4.0.0',
    },
  };

  await fs.writeJson(path.join(gatewayPath, 'package.json'), gatewayPackageJson, { spaces: 2 });

  // Generate gateway source
  const gatewaySource = gatewayFramework === 'express' ? generateExpressGateway(config) :
    gatewayFramework === 'fastify' ? generateFastifyGateway(config) :
    generateNestJSGateway(config);

  await fs.writeFile(path.join(gatewayPath, 'src/index.ts'), gatewaySource);

  // Generate tsconfig
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ['src/**/*'],
  };

  await fs.writeJson(path.join(gatewayPath, 'tsconfig.json'), tsconfig, { spaces: 2 });

  // Generate .env.example
  await fs.writeFile(
    path.join(gatewayPath, '.env.example'),
    `PORT=8080
NODE_ENV=development

# Service URLs
${services.map((s) => `${s.name.toUpperCase()}_SERVICE_URL=http://${s.name}:${s.port}`).join('\n')}
`
  );
}

/**
 * Generate Express gateway code
 */
function generateExpressGateway(config: PolyglotConfig): string {
  const { services } = config;
  return `import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app: Express = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    gateway: '${config.normalizedName}',
    services: [
${services.map(s => `      { name: '${s.name}', url: process.env.${s.name.toUpperCase()}_SERVICE_URL || 'http://${s.name}:${s.port}' },`).join('\n')}
    ],
    timestamp: new Date().toISOString(),
  });
});

// Service routes
${services.map((s) => `
// Proxy to ${s.name}
app.use('/api/${s.name}', createProxyMiddleware({
  target: process.env.${s.name.toUpperCase()}_SERVICE_URL || 'http://${s.name}:${s.port}',
  changeOrigin: true,
  pathRewrite: {
    \`^/api/${s.name}\`: '',
  },
}));
`).join('\n')}

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found', gateway: '${config.normalizedName}' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(\`🚀 API Gateway running on port \${PORT}\`);
  console.log(\`📊 Health check: http://localhost:\${PORT}/health\`);
});
`;
}

/**
 * Generate Fastify gateway code
 */
function generateFastifyGateway(config: PolyglotConfig): string {
  const { services } = config;
  return `import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import httpProxy from '@fastify/http-proxy';

const fastify: FastifyInstance = Fastify({
  logger: true,
});

await fastify.register(cors, {
  origin: true,
});

// Health check
fastify.get('/health', async () => {
  return {
    status: 'healthy',
    gateway: '${config.normalizedName}',
    services: [
${services.map(s => `      { name: '${s.name}', url: process.env.${s.name.toUpperCase()}_SERVICE_URL || 'http://${s.name}:${s.port}' },`).join('\n')}
    ],
    timestamp: new Date().toISOString(),
  };
});

// Service proxies
${services.map((s) => `
await fastify.register(httpProxy, {
  upstream: process.env.${s.name.toUpperCase()}_SERVICE_URL || 'http://${s.name}:${s.port}',
  prefix: '/api/${s.name}',
  http2: false,
});
`).join('\n')}

const start = async () => {
  try {
    const PORT = process.env.PORT || 8080;
    await fastify.listen({ port: Number(PORT), host: '0.0.0.0' });
    console.log(\`🚀 API Gateway running on port \${PORT}\`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
`;
}

/**
 * Generate NestJS gateway code
 */
function generateNestJSGateway(config: PolyglotConfig): string {
  const { services } = config;
  return `import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import { Controller, Get, Module } from '@nestjs/common';

@Controller()
class GatewayController {
  @Get('/health')
  health() {
    return {
      status: 'healthy',
      gateway: '${config.normalizedName}',
      services: [
${services.map(s => `        { name: '${s.name}', url: process.env.${s.name.toUpperCase()}_SERVICE_URL || 'http://${s.name}:${s.port}' },`).join('\n')}
      ],
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  controllers: [GatewayController],
})
class GatewayModule {}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    GatewayModule,
    new ExpressAdapter(),
  );
  app.enableCors();

  const PORT = process.env.PORT || 8080;
  await app.listen(PORT);
  console.log(\`🚀 API Gateway running on port \${PORT}\`);
}

bootstrap();
`;
}

/**
 * Generate proxy-based gateway (Traefik/Kong config)
 */
async function generateProxyGateway(gatewayPath: string, config: PolyglotConfig): Promise<void> {
  const { gatewayFramework, services, normalizedName } = config;

  if (gatewayFramework === 'traefik') {
    // Generate Traefik configuration
    const traefikConfig = `
# Traefik Configuration for ${config.name}

entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"

providers:
  docker:
    exposedByDefault: false

api:
  dashboard: true
  insecure: true
`;

    await fs.writeFile(path.join(gatewayPath, 'traefik.yml'), traefikConfig);

    // Generate docker-compose snippet for Traefik
    const traefikDocker = `
# Add this to docker-compose.yml
  traefik:
    image: traefik:v2.10
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
    ports:
      - "8080:8080"
      - "80:80"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./gateway/traefik.yml:/etc/traefik/traefik.yml
`;

    await fs.writeFile(path.join(gatewayPath, 'docker-compose.yml'), traefikDocker);
  } else if (gatewayFramework === 'kong') {
    // Generate Kong configuration
    const kongConfig = `
# Kong Configuration for ${config.name}

_format_version: "3.0"

services:
${services.map((s) => `
  - name: ${s.name}-service
    url: http://${s.name}:${s.port}
    routes:
      - name: ${s.name}-route
        paths:
          - /api/${s.name}
        strip_path: true
`).join('\n')}
`;

    await fs.writeFile(path.join(gatewayPath, 'kong.yml'), kongConfig);

    const kongDocker = `
# Add this to docker-compose.yml
  kong:
    image: kong/kong-gateway:3.4.0.0
    environment:
      KONG_DATABASE: "off"
      KONG_PROXY_ACCESS_LOG: /dev/stdout
      KONG_ADMIN_ACCESS_LOG: /dev/stdout
      KONG_PROXY_ERROR_LOG: /dev/stderr
      KONG_ADMIN_ERROR_LOG: /dev/stderr
      KONG_DECLARATIVE_CONFIG: /kong/declarative/kong.yml
    ports:
      - "8080:8000"
      - "8443:8443"
      - "8001:8001"
    volumes:
      - ./gateway/kong.yml:/kong/declarative/kong.yml
`;

    await fs.writeFile(path.join(gatewayPath, 'docker-compose.yml'), kongDocker);
  }
}

/**
 * Generate a single service
 */
async function generateService(
  servicePath: string,
  service: PolyglotService,
  config: PolyglotConfig
): Promise<void> {
  const template = getBackendTemplate(service.framework);
  if (!template) {
    console.warn(`Template not found for ${service.framework}, skipping...`);
    return;
  }

  const serviceContext: BackendTemplateContext = {
    name: service.name,
    normalizedName: service.name,
    port: service.port,
    db: config.database,
    org: config.org,
    team: config.team,
    description: `${service.name} - ${service.language} microservice`,
  };

  const files = await createBackendTemplate(template, serviceContext);

  // Write service files
  for (const file of files) {
    const filePath = path.join(servicePath, file.path);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, file.content);

    if (file.executable) {
      await fs.chmod(filePath, '755');
    }
  }

  // Add service-specific Dockerfile if not present
  if (!files.some((f) => f.path === 'Dockerfile')) {
    const dockerfile = generateServiceDockerfile(service, config);
    await fs.writeFile(path.join(servicePath, 'Dockerfile'), dockerfile);
  }
}

/**
 * Generate Dockerfile for a service
 */
function generateServiceDockerfile(service: PolyglotService, config: PolyglotConfig): string {
  const { language } = service;

  // Return language-appropriate Dockerfile
  switch (language.toLowerCase()) {
    case 'javascript':
    case 'typescript':
      return `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE ${service.port}

CMD ["npm", "start"]
`;

    case 'python':
      return `FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE ${service.port}

CMD ["python", "-m", "${service.name}"]
`;

    case 'go':
      return `FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/main .

EXPOSE ${service.port}

CMD ["./main"]
`;

    case 'rust':
      return `FROM rust:1.75-alpine AS builder

WORKDIR /app
COPY Cargo.* ./
RUN cargo fetch
COPY . .
RUN cargo build --release

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /app

COPY --from=builder /app/target/release/${service.name} .

EXPOSE ${service.port}

CMD ["./${service.name}"]
`;

    default:
      return `# Dockerfile for ${service.name}
# Add your ${language} Docker configuration here
`;
  }
}

/**
 * Generate frontend application
 */
async function generateFrontend(
  frontendPath: string,
  frontendFramework: string,
  config: PolyglotConfig
): Promise<void> {
  const frameworkConfig = getFrameworkConfig(frontendFramework);
  if (!frameworkConfig) {
    console.warn(`Framework config not found for ${frontendFramework}`);
    return;
  }

  const templateContext: TemplateContext = {
    name: `${config.name}-frontend`,
    normalizedName: `${config.normalizedName}-frontend`,
    framework: frontendFramework,
    hasTypeScript: frameworkConfig.hasTypeScript || false,
    port: '3000',
    route: '/',
    org: config.org,
    team: config.team,
    description: `${config.name} Frontend`,
    packageManager: config.packageManager,
  };

  const template = createTemplate(frameworkConfig, templateContext);
  const files = await template.generateFiles();

  for (const file of files) {
    const filePath = path.join(frontendPath, file.path);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, file.content);
  }

  // Generate API client for services
  await generateApiClient(frontendPath, config, frontendFramework);
}

/**
 * Generate API client for services
 */
async function generateApiClient(
  frontendPath: string,
  config: PolyglotConfig,
  frontendFramework: string
): Promise<void> {
  const servicesDir = path.join(frontendPath, 'src', 'services');
  await fs.ensureDir(servicesDir);

  const apiClientContent = `// API Client for ${config.name}
// Auto-generated by Re-Shell CLI

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8080';

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = GATEWAY_URL) {
    this.baseUrl = baseUrl;
  }

  async get<T>(path: string): Promise<ServiceResponse<T>> {
    try {
      const response = await fetch(\`\${this.baseUrl}\${path}\`);
      const data = await response.json();
      return { success: response.ok, data, timestamp: new Date().toISOString() };
    } catch (error) {
      return { success: false, error: String(error), timestamp: new Date().toISOString() };
    }
  }

  async post<T>(path: string, body: unknown): Promise<ServiceResponse<T>> {
    try {
      const response = await fetch(\`\${this.baseUrl}\${path}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return { success: response.ok, data, timestamp: new Date().toISOString() };
    } catch (error) {
      return { success: false, error: String(error), timestamp: new Date().toISOString() };
    }
  }
}

export const apiClient = new ApiClient();

${config.services.map((s) => `
// ${s.name} API
export const ${camelCase(s.name)}Api = {
  getAll: () => apiClient.get<any>(\`/api/${s.name}\`),
  getById: (id: string) => apiClient.get<any>(\`/api/${s.name}/\${id}\`),
  create: (data: unknown) => apiClient.post<any>(\`/api/${s.name}\`, data),
  update: (id: string, data: unknown) => apiClient.post<any>(\`/api/${s.name}/\${id}\`, data),
  delete: (id: string) => apiClient.post<any>(\`/api/${s.name}/\${id}/delete\`, {}),
};
`).join('\n')}
`;

  await fs.writeFile(path.join(servicesDir, 'api.ts'), apiClientContent);
}

/**
 * Generate polyglot project README
 */
async function generatePolyglotReadme(projectPath: string, config: PolyglotConfig): Promise<void> {
  const { services, gatewayFramework, frontendFramework, database, normalizedName } = config;

  const readmeContent = `# ${config.name}

A polyglot microservices project created with [Re-Shell CLI](https://github.com/umutkorkmaz/re-shell-cli).

## Overview

This project consists of ${services.length} microservices built with different programming languages:

| Service | Language | Framework | Port |
|---------|----------|-----------|------|
${services.map((s) => `| ${s.name} | ${s.language} | ${s.framework} | ${s.port} |`).join('\n')}

**Infrastructure:**
- **API Gateway:** ${gatewayFramework} (Port 8080)
${frontendFramework ? `- **Frontend:** ${frontendFramework} (Port 3000)` : ''}
- **Database:** ${database}

## Architecture

\`\`\`
┌─────────────┐
│  Frontend   │ (Port 3000)
└──────┬──────┘
       │
┌──────▼──────────┐
│  API Gateway    │ (Port 8080)
│  (${gatewayFramework})  │
└──────┬──────────┘
       │
${services.map((s) => `┌──────▼──────┐
│ ${s.name.padEnd(10)} │ (Port ${s.port})
│ (${s.language.padEnd(10)})│
└─────────────┘`).join('\n       │\n')}
       │
┌──────▼──────┐
│  Database   │
│ (${database})   │
└─────────────┘
\`\`\`

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for gateway/frontend)
- ${[...new Set(services.map((s) => s.language))].join(', ')} for respective services

### Installation

\`\`\`bash
# Install dependencies
${config.packageManager} install

# Start all services
${config.packageManager} run dev
\`\`\`

### Docker Deployment

\`\`\`bash
# Start all services with Docker
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
\`\`\`

## Service Endpoints

### API Gateway (Port 8080)

- **Health Check:** \`GET /health\`
- **API Routes:** \`/api/{service-name}/*\`

### Services

${services.map((s) => `
**${s.name}** (Port ${s.port})
- Base URL: \`http://localhost:${s.port}\`
- Gateway URL: \`http://localhost:8080/api/${s.name}\`
`).join('\n')}

## Development

### Adding a New Service

\`\`\`bash
# Use Re-Shell CLI to add a new service
re-shell create my-service --backend <framework> --type app
\`\`\`

### Database Migrations

\`\`\`bash
# Run migrations
${config.packageManager} run db:migrate

# Seed database
${config.packageManager} run db:seed
\`\`\`

## Testing

\`\`\`bash
# Run all tests
${config.packageManager} test

# Run tests for specific service
cd services/${services[0].name}
${config.packageManager} test
\`\`\`

## License

MIT

---

Generated with ❤️ by [Re-Shell CLI](https://github.com/umutkorkmaz/re-shell-cli)
`;

  await fs.writeFile(path.join(projectPath, 'README.md'), readmeContent);
}

/**
 * Utility functions
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

function camelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Get the primary programming language from frontend/backend selection
 */
function getPrimaryLanguage(backend?: string, frontend?: string): string | null {
  if (backend) {
    const template = getBackendTemplate(backend);
    if (template) {
      return template.language;
    }
  }

  if (frontend) {
    if (frontend.includes('react') || frontend.includes('next') || frontend.includes('vue') || frontend.includes('svelte')) {
      return 'TypeScript';
    }
    if (frontend.includes('angular')) {
      return 'TypeScript';
    }
  }

  return null;
}

/**
 * Auto-register service in workspace YAML
 */
async function autoRegisterInWorkspace(
  monorepoRoot: string,
  serviceName: string,
  config: {
    type: string;
    projectType: string;
    finalFrontend?: string;
    finalBackend?: string;
    finalDb?: string;
    finalPort: string;
    workspacePath: string;
    packageManager: string;
  }
): Promise<void> {
  const workspaceYamlPath = path.join(monorepoRoot, 're-shell.workspaces.yaml');

  // Check if workspace YAML exists
  if (!await fs.pathExists(workspaceYamlPath)) {
    console.log(chalk.gray('\nNo workspace configuration found - skipping auto-registration'));
    console.log(chalk.gray('Tip: Run "re-shell workspace init" to create a workspace configuration\n'));
    return;
  }

  try {
    const workspaceContent = await fs.readFile(workspaceYamlPath, 'utf8');
    const workspaceConfig = yaml.load(workspaceContent) as Record<string, any>;

    // Initialize services if not present
    if (!workspaceConfig.services) {
      workspaceConfig.services = {};
    }

    // Determine service type and framework
    const serviceType: 'frontend' | 'backend' | 'worker' =
      config.projectType === 'backend' ? 'backend' :
      config.projectType === 'full-stack' ? 'backend' :
      'frontend';

    // For backend services, prefer backend framework; for frontend, prefer frontend
    const framework = serviceType === 'backend' ? (config.finalBackend || config.finalFrontend) : (config.finalFrontend || config.finalBackend);

    // Build service entry
    const serviceEntry = {
      name: serviceName,
      displayName: toDisplayName(serviceName),
      type: serviceType,
      language: detectLanguage(framework),
      framework: framework,
      port: parseInt(config.finalPort) || undefined,
      path: path.relative(monorepoRoot, config.workspacePath),
    };

    // Add to services
    workspaceConfig.services[serviceName] = serviceEntry;

    // Write back to YAML
    const newYaml = yaml.dump(workspaceConfig, {
      indent: 2,
      lineWidth: -1,
      sortKeys: false,
      noRefs: true,
    });

    await fs.writeFile(workspaceYamlPath, newYaml, 'utf8');

    console.log(chalk.gray(`\n✓ Auto-registered in workspace configuration`));
    console.log(chalk.gray(`  Service: ${serviceName}`));
    console.log(chalk.gray(`  Config: re-shell.workspaces.yaml\n`));
  } catch (error: any) {
    console.log(chalk.yellow('\n⚠ Failed to auto-register in workspace: ' + error.message));
    console.log(chalk.gray('You can manually add the service to re-shell.workspaces.yaml\n'));
  }
}

/**
 * Convert kebab-case to display name
 */
function toDisplayName(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Detect language from framework string
 */
function detectLanguage(framework?: string): string {
  if (!framework) return 'javascript';

  const lowerFramework = framework.toLowerCase();
  const typeScriptFrameworks = [
    'react-ts', 'react', 'next', 'nuxt', 'vue-ts', 'vue',
    'nestjs', 'angular', 'svelte', 'solid',
    'express', 'fastify', 'koa',
  ];

  const pythonFrameworks = ['fastapi', 'django', 'flask', 'tornado', 'sanic'];
  const goFrameworks = ['gin', 'fiber', 'echo', 'buffalo'];
  const rustFrameworks = ['actix', 'rocket', 'axum'];

  if (typeScriptFrameworks.some(f => lowerFramework.includes(f))) {
    return 'typescript';
  }
  if (pythonFrameworks.some(f => lowerFramework.includes(f))) {
    return 'python';
  }
  if (goFrameworks.some(f => lowerFramework.includes(f))) {
    return 'go';
  }
  if (rustFrameworks.some(f => lowerFramework.includes(f))) {
    return 'rust';
  }

  return 'javascript';
}

/**
 * Creates a new workspace (app/package/lib/tool) in an existing monorepo
 */
async function createWorkspace(
  name: string,
  options: CreateProjectOptions,
  monorepoRoot?: string | null
): Promise<void> {
  const {
    team,
    org = 're-shell',
    description,
    template,
    framework,
    frontend,
    backend,
    db = 'none',
    fullstack,
    packageManager = 'pnpm',
    type = 'app',
    port = '5173',
    route,
    spinner,
  } = options;

  // Handle architecture template - extract predefined stack
  let architectureTemplate: ArchitectureTemplate | undefined;
  if (template) {
    architectureTemplate = getArchitectureTemplate(template);
    if (architectureTemplate) {
      console.log(chalk.blue(`Using architecture template: ${architectureTemplate.displayName}`));
      console.log(chalk.gray(architectureTemplate.description));
    }
  }

  // Determine if we're creating backend, frontend, or fullstack
  // If template is specified, use its configuration
  const templateBackend = architectureTemplate?.backend;
  const templateFrontend = architectureTemplate?.frontend;
  const templateDb = architectureTemplate?.db;

  const isBackendOnly = (backend || templateBackend) && !frontend && !framework && !templateFrontend;
  const isFullStack = fullstack || ((backend || templateBackend) && (frontend || framework || templateFrontend)) || architectureTemplate;
  const isFrontendOnly = !backend && !templateBackend;

  const normalizedName = name.toLowerCase().replace(/\s+/g, '-');
  const rootPath = monorepoRoot || process.cwd();

  console.log(chalk.cyan(`Creating ${type} "${normalizedName}"...`));

  // Stop spinner for interactive prompts
  if (spinner) {
    spinner.stop();
  }

  // Build prompts for missing options
  const promptsConfig: prompts.PromptObject<string>[] = [];

  // Architecture template prompt (if no specific stack is specified)
  if (!template && !backend && !frontend && !framework) {
    promptsConfig.push({
      type: 'select' as const,
      name: 'useTemplate',
      message: 'Would you like to use a predefined architecture template?',
      choices: [
        { title: 'Yes, show me popular stacks', value: 'yes' },
        { title: 'No, I will choose manually', value: 'no' },
        { title: 'Show me all templates', value: 'all' },
      ],
      initial: 0,
    });
  }

  // If user wants to use a template, show template selection
  // This is handled after the first round of prompts

  // Backend prompt (if needed)
  if (isBackendOnly || isFullStack) {
    if (!backend) {
      promptsConfig.push({
        type: 'select' as const,
        name: 'backendMode',
        message: 'How would you like to select your backend framework?',
        choices: [
          { title: '🔥 Popular Frameworks (Express, FastAPI, Django, etc.)', value: 'popular' },
          { title: '📚 Browse by Programming Language', value: 'language' },
          { title: '🔍 Search All 300+ Frameworks', value: 'all' },
        ],
        initial: 0,
      });
    }

    // Database prompt (if backend is selected)
    if (!db) {
      promptsConfig.push({
        type: 'select' as const,
        name: 'db',
        message: 'Select a database:',
        choices: getDatabaseChoices(),
        initial: 0,
      });
    }
  }

  // Frontend prompt (if needed)
  if (isFrontendOnly || isFullStack) {
    if (!framework && !frontend) {
      promptsConfig.push({
        type: 'select' as const,
        name: 'framework',
        message: 'Select a frontend framework:',
        choices: getFrameworkChoices(),
        initial: 1, // Default to react-ts
      });
    }
  }

  // Port prompt (for apps)
  if (type === 'app' && !port) {
    promptsConfig.push({
      type: 'text' as const,
      name: 'port',
      message: 'Development server port:',
      initial: isBackendOnly ? '3000' : '5173',
      validate: (value: string) => {
        const num = parseInt(value);
        return num > 0 && num < 65536 ? true : 'Port must be between 1 and 65535';
      },
    });
  }

  // Route prompt (for frontend apps)
  if ((isFrontendOnly || isFullStack) && type === 'app' && !route) {
    promptsConfig.push({
      type: 'text' as const,
      name: 'route',
      message: 'Route path:',
      initial: `/${normalizedName}`,
      validate: (value: string) => (value.startsWith('/') ? true : 'Route must start with /'),
    });
  }

  // Interactive prompts for missing options
  const responses = await prompts(promptsConfig);

  // Handle architecture template selection
  if (responses.useTemplate && responses.useTemplate !== 'no') {
    const templateChoices = responses.useTemplate === 'yes'
      ? getPopularArchitectureTemplates()
      : getAllArchitectureTemplates();

    const { selectedTemplate } = await prompts({
      type: 'select',
      name: 'selectedTemplate',
      message: 'Select an architecture template:',
      choices: templateChoices.map((t) => ({
        title: `${t.displayName}`,
        value: t.id,
        description: t.description,
      })),
      initial: 0,
    });

    architectureTemplate = getArchitectureTemplate(selectedTemplate);
    if (architectureTemplate) {
      console.log(chalk.blue(`\n✓ Selected: ${architectureTemplate.displayName}`));
      console.log(chalk.gray(`  Backend: ${architectureTemplate.backend || 'none'}`));
      console.log(chalk.gray(`  Frontend: ${architectureTemplate.frontend || 'none'}`));
      console.log(chalk.gray(`  Database: ${architectureTemplate.db || 'none'}`));
      console.log('');
    }
  }

  // Handle multi-step backend selection
  let selectedBackend = backend;
  if (!selectedBackend && responses.backendMode) {
    if (responses.backendMode === 'popular') {
      // Show popular frameworks
      const popularChoices = getPopularBackendFrameworks();
      const { backend } = await prompts({
        type: 'select',
        name: 'backend',
        message: 'Select a popular backend framework:',
        choices: popularChoices,
        initial: 0,
      });
      selectedBackend = backend;
    } else if (responses.backendMode === 'language') {
      // First, select language
      const { language } = await prompts({
        type: 'select',
        name: 'language',
        message: 'Select a programming language:',
        choices: getBackendLanguageChoices(),
        initial: 0,
      });
      // Then, select framework within that language
      const frameworkChoices = getFrameworkChoicesForLanguage(language);
      const { backend } = await prompts({
        type: 'select',
        name: 'backend',
        message: `Select ${language} framework:`,
        choices: frameworkChoices,
        initial: 0,
      });
      selectedBackend = backend;
    } else {
      // Show all frameworks
      const allChoices = listBackendTemplates().map((t) => ({
        title: `${t.displayName} (${t.language})`,
        value: t.id,
      }));
      const { backend } = await prompts({
        type: 'autocomplete',
        name: 'backend',
        message: 'Search and select a backend framework (type to filter):',
        choices: allChoices,
        initial: 0,
        suggest: async (input: string, choices: any[]) => {
          return Promise.resolve(
            choices.filter((c: any) =>
              c.title.toLowerCase().includes(input.toLowerCase())
            )
          );
        },
      });
      selectedBackend = backend;
    }
  }

  // Merge responses with options
  // Use architecture template values if available
  const resolvedTemplateBackend = architectureTemplate?.backend;
  const resolvedTemplateFrontend = architectureTemplate?.frontend;
  const resolvedTemplateDb = architectureTemplate?.db as DatabaseType;

  const finalBackend = backend || selectedBackend || resolvedTemplateBackend;
  const finalFrontend = frontend || framework || responses.framework || resolvedTemplateFrontend;
  const finalDb: DatabaseType = resolvedTemplateDb || (db || responses.db || 'none') as DatabaseType;
  const finalPort = port || responses.port || (isBackendOnly ? '3000' : '5173');
  const finalRoute = route || responses.route || `/${normalizedName}`;

  // Validate framework selections
  if (finalBackend) {
    const backendValidation = validateBackendFramework(finalBackend);
    if (!backendValidation.valid) {
      console.log(chalk.red(`\n⚠️  Warning: ${backendValidation.error}`));
    }
  }

  if (finalFrontend) {
    const frontendValidation = validateFrontendFramework(finalFrontend);
    if (!frontendValidation.valid) {
      console.log(chalk.red(`\n⚠️  Warning: ${frontendValidation.error}`));
    }
  }

  const dbValidation = validateDatabaseType(finalDb);
  if (!dbValidation.valid) {
    console.log(chalk.red(`\n⚠️  Warning: ${dbValidation.error}`));
  }

  // Validate compatibility for fullstack projects
  if (finalFrontend && finalBackend && (isFullStack || (!isBackendOnly && !isFrontendOnly))) {
    const compatibility = validateFrameworkCompatibility(finalFrontend, finalBackend);
    const summary = getCompatibilitySummary(finalFrontend, finalBackend);

    console.log(chalk[summary.color](`\n${'━'.repeat(50)}`));
    console.log(`${chalk.bold('Framework Compatibility:')}: ${summary.icon} ${summary.text}`);
    console.log(chalk[summary.color](`${'━'.repeat(50)}\n`));

    if (compatibility.warnings.length > 0) {
      console.log(chalk.yellow('Warnings:'));
      compatibility.warnings.forEach((w) => console.log(chalk.yellow(`  • ${w}`)));
      console.log('');
    }

    if (compatibility.suggestions.length > 0) {
      console.log(chalk.cyan('Suggestions:'));
      compatibility.suggestions.forEach((s) => console.log(chalk.cyan(`  • ${s}`)));
      console.log('');
    }

    // If incompatible, ask user to confirm
    if (!compatibility.valid) {
      const { confirm } = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: 'This framework combination is not recommended. Continue anyway?',
        initial: false,
      });

      if (!confirm) {
        console.log(chalk.yellow('\nOperation cancelled. Please select compatible frameworks.\n'));
        return;
      }
    }
  }

  // Check for dependency conflicts
  const depCheckResult = checkDependencyConflicts({
    frontend: finalFrontend,
    backend: finalBackend,
    db: finalDb,
  });

  if (depCheckResult.hasConflicts || depCheckResult.warnings.length > 0) {
    console.log(formatDependencyReport(depCheckResult));

    // If there are critical conflicts, ask for confirmation
    if (depCheckResult.hasConflicts) {
      const { proceedAnyway } = await prompts({
        type: 'confirm',
        name: 'proceedAnyway',
        message: 'Dependency conflicts detected. Continue anyway?',
        initial: false,
      });

      if (!proceedAnyway) {
        console.log(chalk.yellow('\nOperation cancelled. Please resolve conflicts and try again.\n'));
        return;
      }
    }
  }

  // Validate project configuration
  const projectConfig: ProjectConfig = {
    name: normalizedName,
    type,
    frontend: finalFrontend,
    backend: finalBackend,
    database: finalDb,
    packageManager,
    port: finalPort,
    hasDocker: false, // Will be determined later
    hasCI: false, // Will be determined later
  };

  const validationResult = validateProjectConfig(projectConfig);

  if (validationResult.errors.length > 0) {
    console.log(formatValidationResult(validationResult));

    // If there are critical errors, ask for confirmation
    if (!validationResult.isValid) {
      const { proceedAnyway } = await prompts({
        type: 'confirm',
        name: 'proceedAnyway',
        message: 'Configuration validation failed. Continue anyway?',
        initial: false,
      });

      if (!proceedAnyway) {
        console.log(chalk.yellow('\nOperation cancelled. Please fix the configuration errors and try again.\n'));
        return;
      }
    }
  } else if (validationResult.suggestions.length > 0) {
    // Show suggestions even if validation passes
    console.log(formatValidationResult(validationResult));
  }

  // Show pairing recommendations for fullstack projects
  if (isFullStack && finalBackend && !finalFrontend && !resolvedTemplateFrontend) {
    const recommendations = getRecommendedFrontends(finalBackend);
    if (recommendations.length > 0) {
      console.log(chalk.blue('\n💡 Recommended frontends for your backend:'));
      recommendations.slice(0, 5).forEach((rec, i) => {
        const icon = rec.compatibility === 'excellent' ? '⭐' : rec.compatibility === 'good' ? '✓' : '○';
        console.log(`  ${icon} ${rec.framework.padEnd(15)} - ${rec.reason}`);
      });
      console.log('');
    }
  }

  // Restart spinner for file operations
  if (spinner) {
    spinner.start();
    spinner.setText(`Creating ${type} files...`);
    flushOutput();
  }

  // Determine workspace path based on type
  const typeDir =
    type === 'app' ? 'apps' : type === 'package' ? 'packages' : type === 'lib' ? 'libs' : 'tools';

  const workspacePath = path.join(rootPath, typeDir, normalizedName);

  // Check if directory already exists and handle it gracefully
  if (fs.existsSync(workspacePath)) {
    if (spinner) spinner.stop();

    const { action } = await prompts({
      type: 'select',
      name: 'action',
      message: `Directory "${normalizedName}" already exists in ${typeDir}/. What would you like to do?`,
      choices: [
        { title: 'Overwrite existing directory', value: 'overwrite' },
        { title: 'Cancel', value: 'cancel' },
      ],
      initial: 0,
    });

    if (action === 'cancel') {
      console.log(chalk.yellow('Operation cancelled.'));
      return;
    }

    if (action === 'overwrite') {
      if (spinner) {
        spinner.start();
        spinner.setText('Removing existing directory...');
        flushOutput();
      }
      await fs.remove(workspacePath);
    }

    if (spinner) {
      spinner.start();
      spinner.setText(`Creating ${type} files...`);
      flushOutput();
    }
  }

  const allFiles: { path: string; content: string; executable?: boolean }[] = [];

  // Generate frontend files (if applicable)
  if (finalFrontend && !isBackendOnly) {
    // Validate framework
    if (!validateFramework(finalFrontend)) {
      throw new Error(`Unsupported framework: ${finalFrontend}`);
    }

    const frameworkConfig = getFrameworkConfig(finalFrontend);

    // Create template context
    const templateContext: TemplateContext = {
      name,
      normalizedName,
      framework: finalFrontend,
      hasTypeScript: frameworkConfig.hasTypeScript || false,
      port: finalPort,
      route: type === 'app' ? finalRoute : undefined,
      org,
      team,
      description: description || `${name} - A ${frameworkConfig.displayName} ${type}`,
      packageManager,
    };

    // Generate files using appropriate template
    const template = createTemplate(frameworkConfig, templateContext);
    const files = await template.generateFiles();
    allFiles.push(...files);
  }

  // Generate backend files (if applicable)
  if (finalBackend && (isBackendOnly || isFullStack)) {
    const backendTemplate = getBackendTemplate(finalBackend);
    if (!backendTemplate) {
      throw new Error(`Unsupported backend framework: ${finalBackend}`);
    }

    const backendContext: BackendTemplateContext = {
      name,
      normalizedName,
      port: backendTemplate.port?.toString() || '3000',
      db: finalDb,
      org,
      team,
      description: description || `${name} - A ${backendTemplate.displayName} backend`,
    };

    const backendFiles = await createBackendTemplate(backendTemplate, backendContext);
    allFiles.push(...backendFiles);
  }

  // Create workspace directory
  await fs.ensureDir(workspacePath);

  // Write all generated files
  for (const file of allFiles) {
    const filePath = path.join(workspacePath, file.path);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, file.content);

    if (file.executable) {
      await fs.chmod(filePath, '755');
    }
  }

  // Apply best practices based on the primary language
  const primaryLanguage = getPrimaryLanguage(finalBackend, finalFrontend);
  if (primaryLanguage) {
    const bestPractices = getBestPracticesForLanguage(primaryLanguage);
    if (bestPractices.files.length > 0 || bestPractices.folders.length > 0) {
      await applyBestPractices(workspacePath, primaryLanguage);
      console.log(chalk.gray(`✓ Applied ${bestPractices.description}`));
    }
  }

  // Stop spinner temporarily for health check
  if (spinner) {
    spinner.stop();
  }

  // Perform project health check
  const healthCheckResult = await performProjectHealthCheck(workspacePath, projectConfig);

  const projectType = isBackendOnly ? 'backend' : isFullStack ? 'full-stack' : 'frontend';

  // Auto-register in workspace YAML if in a monorepo
  if (monorepoRoot) {
    await autoRegisterInWorkspace(monorepoRoot, normalizedName, {
      type,
      projectType,
      finalFrontend,
      finalBackend,
      finalDb,
      finalPort,
      workspacePath,
      packageManager,
    });
  }

  console.log(
    chalk.green(`\n✓ ${type.charAt(0).toUpperCase() + type.slice(1)} "${normalizedName}" (${projectType}) created successfully!`)
  );
  console.log(chalk.gray(`Path: ${path.relative(process.cwd(), workspacePath)}`));
  console.log('\nNext steps:');
  console.log(`  1. cd ${path.relative(process.cwd(), workspacePath)}`);
  console.log(`  2. ${packageManager} install`);
  console.log(`  3. ${packageManager} run dev`);

  // Show database setup instructions if database was selected
  if (finalDb && finalDb !== 'none') {
    console.log('\nDatabase setup:');
    console.log(`  4. Configure your ${finalDb} database connection in .env`);
    console.log(`  5. Run ${packageManager} run db:migrate (or db:push for Prisma)`);
  }

  // Show health check summary
  if (healthCheckResult.overallStatus === 'unhealthy') {
    console.log(chalk.yellow('\n⚠️  Project Health Check: Some issues detected'));
    console.log(formatHealthCheckReport(healthCheckResult));
  } else if (healthCheckResult.overallStatus === 'warning') {
    console.log(chalk.yellow('\n⚠️  Project Health Check: Minor issues detected'));
    console.log(formatHealthCheckReport(healthCheckResult));
  } else {
    console.log(chalk.green('\n✅ Project Health Check: All checks passed'));
  }
}

/**
 * Creates a new monorepo project (legacy function for backward compatibility)
 */
async function createMonorepoProject(name: string, options: CreateProjectOptions): Promise<void> {
  const {
    team,
    org = 're-shell',
    description = `${name} - A Re-Shell microfrontend project`,
    spinner,
  } = options;

  // Normalize name to kebab-case for consistency
  const normalizedName = name.toLowerCase().replace(/\s+/g, '-');

  console.log(chalk.cyan(`Creating Re-Shell project "${normalizedName}"...`));

  // Stop spinner for interactive prompts
  if (spinner) {
    spinner.stop();
  }

  // Ask for additional information if not provided
  const responses = await prompts([
    {
      type: options.template ? null : 'select',
      name: 'template',
      message: 'Select a template:',
      choices: [
        { title: 'React', value: 'react' },
        { title: 'React with TypeScript', value: 'react-ts' },
      ],
      initial: 1, // Default to react-ts
    },
    {
      type: options.packageManager ? null : 'select',
      name: 'packageManager',
      message: 'Select a package manager:',
      choices: [
        { title: 'npm', value: 'npm' },
        { title: 'yarn', value: 'yarn' },
        { title: 'pnpm', value: 'pnpm' },
      ],
      initial: 2, // Default to pnpm
    },
  ]);

  // Merge responses with options
  const finalOptions = {
    ...options,
    template: options.template || responses.template,
    packageManager: options.packageManager || responses.packageManager,
  };

  // Restart spinner for file operations
  if (spinner) {
    spinner.start();
    spinner.setText('Creating project structure...');
    flushOutput();
  }

  // Create project structure
  const projectPath = path.resolve(process.cwd(), normalizedName);

  // Check if directory already exists
  if (fs.existsSync(projectPath)) {
    throw new Error(`Directory already exists: ${projectPath}`);
  }

  // Create directory structure
  fs.mkdirSync(projectPath);
  fs.mkdirSync(path.join(projectPath, 'apps'));
  fs.mkdirSync(path.join(projectPath, 'packages'));
  fs.mkdirSync(path.join(projectPath, 'docs'));

  // Create package.json for the project
  const packageJson = {
    name: normalizedName,
    version: '0.1.0',
    description,
    private: true,
    workspaces: ['apps/*', 'packages/*'],
    scripts: {
      dev: `${finalOptions.packageManager} run --parallel -r dev`,
      build: `${finalOptions.packageManager} run --parallel -r build`,
      lint: `${finalOptions.packageManager} run --parallel -r lint`,
      test: `${finalOptions.packageManager} run --parallel -r test`,
      clean: `${finalOptions.packageManager} run --parallel -r clean`,
    },
    author: team || org,
    license: 'MIT',
  };

  fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2));

  // Create workspace config
  if (finalOptions.packageManager === 'pnpm') {
    fs.writeFileSync(
      path.join(projectPath, 'pnpm-workspace.yaml'),
      `packages:\n  - 'apps/*'\n  - 'packages/*'\n`
    );
  }

  // Create README.md
  const readmeContent = `# ${normalizedName}

## Overview
A microfrontend project created with Re-Shell CLI.

## Project Structure
\`\`\`
${normalizedName}/
├── apps/                 # Microfrontend applications
│   └── shell/            # Main shell application
├── packages/             # Shared libraries
└── docs/                 # Documentation
\`\`\`

## Getting Started

### Installation
\`\`\`bash
# Install dependencies
${finalOptions.packageManager} install
\`\`\`

### Development
\`\`\`bash
# Start all applications in development mode
${finalOptions.packageManager} run dev
\`\`\`

### Building
\`\`\`bash
# Build all applications
${finalOptions.packageManager} run build
\`\`\`

## Adding Microfrontends
To add a new microfrontend to this project:

\`\`\`bash
re-shell add my-feature
\`\`\`

## Documentation
For more information, see the [Re-Shell documentation](https://github.com/your-org/re-shell)
`;

  fs.writeFileSync(path.join(projectPath, 'README.md'), readmeContent);

  console.log(
    chalk.green(`\nRe-Shell project "${normalizedName}" created successfully at ${projectPath}`)
  );
  console.log('\nNext steps:');
  console.log(`  1. cd ${normalizedName}`);
  console.log(`  2. ${finalOptions.packageManager} install`);
  console.log(`  3. ${finalOptions.packageManager} run dev`);
  console.log(`  4. re-shell add my-feature (to add your first microfrontend)`);
}

/**
 * Backend template context for generating backend files
 */
interface BackendTemplateContext {
  name: string;
  normalizedName: string;
  port: string;
  db?: DatabaseType;
  org?: string;
  team?: string;
  description?: string;
}

/**
 * Get backend template choices for interactive prompts
 * Shows popular frameworks first, then all options grouped by language
 */
function getBackendTemplateChoices() {
  const popular = getPopularBackendFrameworks();
  const allFrameworks = listBackendTemplates().map((t) => ({
    title: `${t.displayName} (${t.language})`,
    value: t.id,
    description: t.description?.substring(0, 100) + (t.description?.length > 100 ? '...' : ''),
  }));

  return [
    { title: '───────── POPULAR FRAMEWORKS ─────────', value: '__separator__popular__', disabled: true },
    ...popular,
    { title: '───────── ALL FRAMEWORKS (A-Z) ─────────', value: '__separator__all__', disabled: true },
    ...allFrameworks,
  ];
}

/**
 * Create files from a backend template
 */
async function createBackendTemplate(
  template: BackendTemplate,
  context: BackendTemplateContext
): Promise<{ path: string; content: string; executable?: boolean }[]> {
  const files: { path: string; content: string; executable?: boolean }[] = [];

  // Generate each file from template
  for (const [filePath, content] of Object.entries(template.files)) {
    const contentStr = String(content);
    files.push({
      path: filePath,
      content: contentStr
        .replace(/\{\{projectName\}\}/g, context.name)
        .replace(/\{\{name\}\}/g, context.name)
        .replace(/\{\{normalizedName\}\}/g, context.normalizedName)
        .replace(/\{\{port\}\}/g, context.port)
        .replace(/\{\{org\}\}/g, context.org || 're-shell')
        .replace(/\{\{team\}\}/g, context.team || '')
        .replace(/\{\{description\}\}/g, context.description || ''),
    });
  }

  // Add database configuration if specified
  if (context.db && context.db !== 'none') {
    const dbConfig = getDatabaseConfig(context.db);
    if (dbConfig) {
      for (const [filePath, content] of Object.entries(dbConfig.files)) {
        files.push({ path: filePath, content });
      }
    }
  }

  return files;
}

/**
 * Creates appropriate template instance based on framework
 */
function createTemplate(framework: any, context: TemplateContext): BaseTemplate {
  switch (framework.name) {
    case 'react':
    case 'react-ts':
      return new ReactTemplate(framework, context);
    case 'vue':
    case 'vue-ts':
      return new VueTemplate(framework, context);
    case 'svelte':
    case 'svelte-ts':
      return new SvelteTemplate(framework, context);
    case 'next':
    case 'nextjs':
      return new NextJsTemplate(framework, context);
    case 'remix':
      return new RemixTemplate(framework, context);
    case 'gatsby':
      return new GatsbyTemplate(framework, context);
    case 'nuxt':
      return new NuxtTemplate(framework, context);
    case 'quasar':
      return new QuasarTemplate(framework, context);
    case 'angular':
      return new AngularTemplate(framework, context);
    case 'vite-react':
      return new ViteReactTemplate(framework, context);
    case 'sveltekit':
      return new SvelteKitTemplate(framework, context);
    case 'solid-js':
      return new SolidJsTemplate(framework, context);
    case 'qwik':
      return new QwikTemplate(framework, context);
    case 'lit':
      return new LitTemplate(framework, context);
    case 'stencil':
      return new StencilTemplate(framework, context);
    case 'alpine':
      return new AlpineTemplate(framework, context);
    case 'preact':
      return new PreactTemplate(framework, context);
    case 'mithril':
      return new MithrilTemplate(framework, context);
    case 'hyperapp':
      return new HyperappTemplate(framework, context);
    case 'astro':
      return new AstroTemplate(framework, context);
    case 'eleventy':
      return new EleventyTemplate(framework, context);
    case 'vuepress':
      return new VuePressTemplate(framework, context);
    case 'docusaurus':
      return new DocusaurusTemplate(framework, context);
    case 'gridsome':
      return new GridsomeTemplate(framework, context);
    case 'scully':
      return new ScullyTemplate(framework, context);
    case 'jekyll':
      return new JekyllTemplate(framework, context);
    case 'hugo':
      return new HugoTemplate(framework, context);
    case 'hexo':
      return new HexoTemplate(framework, context);
    case 'zola':
      return new ZolaTemplate(framework, context);
    case 'create-react-app':
    case 'cra':
      return new CreateReactAppTemplate(framework, context);
    case 'vue-cli':
      return new VueCliTemplate(framework, context);
    case 'angular-cli':
      return new AngularCliTemplate(framework, context);
    case 'vite-svelte':
      return new ViteSvelteTemplate(framework, context);
    case 'react-module-federation':
      return new ReactModuleFederationTemplate(framework, context);
    case 'vue-module-federation':
      return new VueModuleFederationTemplate(framework, context);
    case 'angular-module-federation':
      return new AngularModuleFederationTemplate(framework, context);
    case 'svelte-module-federation':
      return new SvelteModuleFederationTemplate(framework, context);
    case 'nx-angular':
      return new NxAngularTemplate(framework, context);
    case 'analog':
      return new AnalogTemplate(framework, context);
    // Add more frameworks as templates are implemented
    default:
      // Fallback to React template for unsupported frameworks
      return new ReactTemplate(framework, context);
  }
}

/**
 * Custom Module Federation Shell Templates
 * These extend the existing Module Federation templates with remote configuration
 */

class ReactModuleFederationShellTemplate extends ReactModuleFederationTemplate {
  constructor(
    framework: any,
    context: TemplateContext,
    private remotes: MicrofrontendRemote[],
    private sharedDeps: string[]
  ) {
    super(framework, context);
  }

  async generateFiles(): Promise<{ path: string; content: string; executable?: boolean }[]> {
    const files = await super.generateFiles();

    // Override webpack.config.js with remotes configuration
    const webpackConfig = this.generateShellWebpackConfig();
    const webpackIndex = files.findIndex((f) => f.path === 'webpack.config.js');
    if (webpackIndex >= 0) {
      files[webpackIndex].content = webpackConfig;
    }

    return files;
  }

  private generateShellWebpackConfig(): string {
    const remotesConfig = this.remotes
      .map((r) => `      ${r.name}: '${r.name}@http://localhost:${r.port}/remoteEntry.js',`)
      .join('\n');

    const sharedConfig = this.sharedDeps
      .map((d) => `        '${d}': { singleton: true, requiredVersion: deps['${d}'] },`)
      .join('\n');

    return `const deps = require('./package.json').dependencies;
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  entry: './src/index',
  mode: 'development',
  devServer: {
    port: 3000,
    hot: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
  },
  module: {
    rules: [
      {
        test: /\\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\\.jsx?$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
${remotesConfig}
      },
      shared: {
${sharedConfig}
      },
    }),
  ],
};
`;
  }
}

class VueModuleFederationShellTemplate extends VueModuleFederationTemplate {
  constructor(
    framework: any,
    context: TemplateContext,
    private remotes: MicrofrontendRemote[],
    private sharedDeps: string[]
  ) {
    super(framework, context);
  }

  async generateFiles(): Promise<{ path: string; content: string; executable?: boolean }[]> {
    const files = await super.generateFiles();

    // Override webpack.config.js with remotes configuration
    const webpackConfig = this.generateShellWebpackConfig();
    const webpackIndex = files.findIndex((f) => f.path === 'webpack.config.js');
    if (webpackIndex >= 0) {
      files[webpackIndex].content = webpackConfig;
    }

    return files;
  }

  private generateShellWebpackConfig(): string {
    const remotesConfig = this.remotes
      .map((r) => `      ${r.name}: '${r.name}@http://localhost:${r.port}/remoteEntry.js',`)
      .join('\n');

    const sharedConfig = this.sharedDeps
      .map((d) => `        '${d}': { singleton: true, requiredVersion: deps['${d}'] },`)
      .join('\n');

    return `const deps = require('./package.json').dependencies;
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  entry: './src/index',
  mode: 'development',
  devServer: {
    port: 3000,
    hot: true,
  },
  module: {
    rules: [
      {
        test: /\\.vue$/,
        use: 'vue-loader',
      },
      {
        test: /\\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\\.jsx?$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
${remotesConfig}
      },
      shared: {
${sharedConfig}
      },
    }),
  ],
};
`;
  }
}

class AngularModuleFederationShellTemplate extends AngularModuleFederationTemplate {
  constructor(
    framework: any,
    context: TemplateContext,
    private remotes: MicrofrontendRemote[],
    private sharedDeps: string[]
  ) {
    super(framework, context);
  }

  async generateFiles(): Promise<{ path: string; content: string; executable?: boolean }[]> {
    const files = await super.generateFiles();
    // Angular uses its own federation config
    return files;
  }
}

class SvelteModuleFederationShellTemplate extends SvelteModuleFederationTemplate {
  constructor(
    framework: any,
    context: TemplateContext,
    private remotes: MicrofrontendRemote[],
    private sharedDeps: string[]
  ) {
    super(framework, context);
  }

  async generateFiles(): Promise<{ path: string; content: string; executable?: boolean }[]> {
    const files = await super.generateFiles();

    // Override webpack.config.js with remotes configuration
    const webpackConfig = this.generateShellWebpackConfig();
    const webpackIndex = files.findIndex((f) => f.path === 'webpack.config.js');
    if (webpackIndex >= 0) {
      files[webpackIndex].content = webpackConfig;
    }

    return files;
  }

  private generateShellWebpackConfig(): string {
    const remotesConfig = this.remotes
      .map((r) => `      ${r.name}: '${r.name}@http://localhost:${r.port}/remoteEntry.js',`)
      .join('\n');

    const sharedConfig = this.sharedDeps
      .map((d) => `        '${d}': { singleton: true, requiredVersion: deps['${d}'] },`)
      .join('\n');

    return `const deps = require('./package.json').dependencies;
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  entry: './src/index',
  mode: 'development',
  devServer: {
    port: 3000,
    hot: true,
  },
  module: {
    rules: [
      {
        test: /\\.svelte$/,
        use: 'svelte-loader',
      },
      {
        test: /\\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
${remotesConfig}
      },
      shared: {
${sharedConfig}
      },
    }),
  ],
};
`;
  }
}

/**
 * Custom Module Federation Remote Templates
 * These extend the existing Module Federation templates with expose configuration
 */

class ReactModuleFederationRemoteTemplate extends ReactModuleFederationTemplate {
  constructor(
    framework: any,
    context: TemplateContext,
    private remote: MicrofrontendRemote,
    private sharedDeps: string[]
  ) {
    super(framework, context);
  }

  async generateFiles(): Promise<{ path: string; content: string; executable?: boolean }[]> {
    const files = await super.generateFiles();

    // Override webpack.config.js with expose configuration
    const webpackConfig = this.generateRemoteWebpackConfig();
    const webpackIndex = files.findIndex((f) => f.path === 'webpack.config.js');
    if (webpackIndex >= 0) {
      files[webpackIndex].content = webpackConfig;
    }

    return files;
  }

  private generateRemoteWebpackConfig(): string {
    const exposesConfig = Object.entries(this.remote.exposes)
      .map(([key, val]) => `        '${key}': '${val}',`)
      .join('\n');

    const sharedConfig = this.sharedDeps
      .map((d) => `        '${d}': { singleton: true, requiredVersion: deps['${d}'] },`)
      .join('\n');

    return `const deps = require('./package.json').dependencies;
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  entry: './src/index',
  mode: 'development',
  devServer: {
    port: ${this.remote.port},
    hot: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
  },
  module: {
    rules: [
      {
        test: /\\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\\.jsx?$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: '${this.remote.name}',
      filename: 'remoteEntry.js',
      exposes: {
${exposesConfig}
      },
      shared: {
${sharedConfig}
      },
    }),
  ],
};
`;
  }
}

class VueModuleFederationRemoteTemplate extends VueModuleFederationTemplate {
  constructor(
    framework: any,
    context: TemplateContext,
    private remote: MicrofrontendRemote,
    private sharedDeps: string[]
  ) {
    super(framework, context);
  }

  async generateFiles(): Promise<{ path: string; content: string; executable?: boolean }[]> {
    const files = await super.generateFiles();

    // Override webpack.config.js with expose configuration
    const webpackConfig = this.generateRemoteWebpackConfig();
    const webpackIndex = files.findIndex((f) => f.path === 'webpack.config.js');
    if (webpackIndex >= 0) {
      files[webpackIndex].content = webpackConfig;
    }

    return files;
  }

  private generateRemoteWebpackConfig(): string {
    const exposesConfig = Object.entries(this.remote.exposes)
      .map(([key, val]) => `        '${key}': '${val}',`)
      .join('\n');

    const sharedConfig = this.sharedDeps
      .map((d) => `        '${d}': { singleton: true, requiredVersion: deps['${d}'] },`)
      .join('\n');

    return `const deps = require('./package.json').dependencies;
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  entry: './src/index',
  mode: 'development',
  devServer: {
    port: ${this.remote.port},
    hot: true,
  },
  module: {
    rules: [
      {
        test: /\\.vue$/,
        use: 'vue-loader',
      },
      {
        test: /\\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\\.jsx?$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: '${this.remote.name}',
      filename: 'remoteEntry.js',
      exposes: {
${exposesConfig}
      },
      shared: {
${sharedConfig}
      },
    }),
  ],
};
`;
  }
}

class AngularModuleFederationRemoteTemplate extends AngularModuleFederationTemplate {
  constructor(
    framework: any,
    context: TemplateContext,
    private remote: MicrofrontendRemote,
    private sharedDeps: string[]
  ) {
    super(framework, context);
  }

  async generateFiles(): Promise<{ path: string; content: string; executable?: boolean }[]> {
    const files = await super.generateFiles();
    // Angular uses its own federation config
    return files;
  }
}

class SvelteModuleFederationRemoteTemplate extends SvelteModuleFederationTemplate {
  constructor(
    framework: any,
    context: TemplateContext,
    private remote: MicrofrontendRemote,
    private sharedDeps: string[]
  ) {
    super(framework, context);
  }

  async generateFiles(): Promise<{ path: string; content: string; executable?: boolean }[]> {
    const files = await super.generateFiles();

    // Override webpack.config.js with expose configuration
    const webpackConfig = this.generateRemoteWebpackConfig();
    const webpackIndex = files.findIndex((f) => f.path === 'webpack.config.js');
    if (webpackIndex >= 0) {
      files[webpackIndex].content = webpackConfig;
    }

    return files;
  }

  private generateRemoteWebpackConfig(): string {
    const exposesConfig = Object.entries(this.remote.exposes)
      .map(([key, val]) => `        '${key}': '${val}',`)
      .join('\n');

    const sharedConfig = this.sharedDeps
      .map((d) => `        '${d}': { singleton: true, requiredVersion: deps['${d}'] },`)
      .join('\n');

    return `const deps = require('./package.json').dependencies;
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  entry: './src/index',
  mode: 'development',
  devServer: {
    port: ${this.remote.port},
    hot: true,
  },
  module: {
    rules: [
      {
        test: /\\.svelte$/,
        use: 'svelte-loader',
      },
      {
        test: /\\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: '${this.remote.name}',
      filename: 'remoteEntry.js',
      exposes: {
${exposesConfig}
      },
      shared: {
${sharedConfig}
      },
    }),
  ],
};
`;
  }
}
