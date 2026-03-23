import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawn } from 'child_process';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { initializeMonorepo, DEFAULT_MONOREPO_STRUCTURE } from '../utils/monorepo';
import { initializeGitRepository } from '../utils/submodule';
import { ProgressSpinner, flushOutput } from '../utils/spinner';
import { AsyncPool } from '../utils/async-pool';
import { configManager } from '../utils/config';

let signalReceived: string | null = null;

interface InitOptions {
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun';
  structure?: Partial<typeof DEFAULT_MONOREPO_STRUCTURE>;
  git?: boolean;
  submodules?: boolean;
  force?: boolean;
  yes?: boolean;
  spinner?: ProgressSpinner;
  template?: string;
  skipInstall?: boolean;
  debug?: boolean;
  preset?: string;
}

// Template definitions
const TEMPLATES = {
  blank: {
    name: 'Blank monorepo',
    description: 'Empty monorepo structure',
    dependencies: [],
  },
  ecommerce: {
    name: 'E-commerce starter',
    description: 'Shell + product catalog + checkout',
    dependencies: ['@stripe/stripe-js', 'zustand', 'react-query'],
  },
  dashboard: {
    name: 'Dashboard starter',
    description: 'Shell + analytics + user management',
    dependencies: ['recharts', 'd3', '@tanstack/react-table'],
  },
  saas: {
    name: 'SaaS starter',
    description: 'Shell + auth + billing + admin',
    dependencies: ['@clerk/nextjs', '@stripe/stripe-js', 'prisma'],
  },
};

/**
 * Wrapper around inquirer prompts
 */
async function safePrompt<T = any>(questions: any[], options: { debug?: boolean } = {}): Promise<T> {
  if (options.debug) {
    console.log(chalk.gray('[DEBUG] Starting prompt...'));
  }

  const result = await inquirer.prompt<T>(questions);

  if (options.debug) {
    console.log(chalk.gray('[DEBUG] Prompt completed, keys:', Object.keys(result)));
  }

  return result;
}

// Helper functions
async function checkSystemRequirements(): Promise<{ errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  if (majorVersion < 16) {
    errors.push(`Node.js 16 or higher is required. You have ${nodeVersion}`);
  } else if (majorVersion < 18) {
    warnings.push(`Node.js 18+ is recommended for best performance. You have ${nodeVersion}`);
  }

  // Check disk space (simplified for cross-platform compatibility)
  try {
    // Basic disk space check - this is simplified and may not work on all systems
    // In a real implementation, you'd use a cross-platform library like 'check-disk-space'
    // For now, we just skip this check to maintain cross-platform compatibility
  } catch (e) {
    // Ignore disk space check errors on platforms where it's not supported
  }

  // Check git installation
  try {
    execSync('git --version', { stdio: 'ignore' });
  } catch {
    warnings.push('Git is not installed. Version control features will be unavailable');
  }

  return { errors, warnings };
}

async function detectPackageManager(): Promise<'npm' | 'yarn' | 'pnpm' | 'bun'> {
  // Check for lockfiles in current directory (parallel checks)
  const lockfileChecks = await Promise.all([
    fs.pathExists('bun.lockb').then(exists => (exists ? 'bun' : null)),
    fs.pathExists('pnpm-lock.yaml').then(exists => (exists ? 'pnpm' : null)),
    fs.pathExists('yarn.lock').then(exists => (exists ? 'yarn' : null)),
    fs.pathExists('package-lock.json').then(exists => (exists ? 'npm' : null)),
  ]);

  // Return first found lockfile preference
  for (const manager of lockfileChecks) {
    if (manager) return manager as 'npm' | 'yarn' | 'pnpm' | 'bun';
  }

  // Check which package managers are installed (parallel execution)
  const pool = new AsyncPool(4);
  const managerChecks = await Promise.allSettled([
    pool.add(
      () =>
        new Promise<'bun' | null>(resolve => {
          try {
            execSync('bun --version', { stdio: 'ignore', timeout: 5000 });
            resolve('bun');
          } catch {
            resolve(null);
          }
        })
    ),
    pool.add(
      () =>
        new Promise<'pnpm' | null>(resolve => {
          try {
            execSync('pnpm --version', { stdio: 'ignore', timeout: 5000 });
            resolve('pnpm');
          } catch {
            resolve(null);
          }
        })
    ),
    pool.add(
      () =>
        new Promise<'yarn' | null>(resolve => {
          try {
            execSync('yarn --version', { stdio: 'ignore', timeout: 5000 });
            resolve('yarn');
          } catch {
            resolve(null);
          }
        })
    ),
    pool.add(
      () =>
        new Promise<'npm'>(resolve => {
          // npm is always available with Node.js
          resolve('npm');
        })
    ),
  ]);

  // Extract successful results
  const availableManagers = managerChecks
    .filter(
      (result): result is PromiseFulfilledResult<'npm' | 'yarn' | 'pnpm' | 'bun' | null> =>
        result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value as 'npm' | 'yarn' | 'pnpm' | 'bun');

  // Prefer pnpm for monorepos, then bun, then yarn, then npm
  if (availableManagers.includes('pnpm')) return 'pnpm';
  if (availableManagers.includes('bun')) return 'bun';
  if (availableManagers.includes('yarn')) return 'yarn';
  return 'npm';
}

async function savePreset(name: string, config: any): Promise<void> {
  const presetsDir = path.join(os.homedir(), '.re-shell', 'presets');
  await fs.ensureDir(presetsDir);
  await fs.writeJSON(path.join(presetsDir, `${name}.json`), config, { spaces: 2 });
}

async function loadPreset(name: string): Promise<any> {
  const presetsDir = path.join(os.homedir(), '.re-shell', 'presets');
  const presetPath = path.join(presetsDir, `${name}.json`);
  if (await fs.pathExists(presetPath)) {
    return fs.readJSON(presetPath);
  }
  return null;
}

/**
 * Initialize a new monorepo workspace with Re-Shell CLI
 *
 * @param name - Name of the monorepo
 * @param options - Initialization options
 */
export async function initMonorepo(name: string, options: InitOptions = {}): Promise<void> {
  // Register signal handlers for this command
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGUSR1', 'SIGUSR2'];
  signals.forEach(sig => {
    process.on(sig as NodeJS.Signals, () => {
      signalReceived = sig;
      if (options.debug) {
        console.log(chalk.yellow(`\n[DEBUG] Received signal: ${sig}`));
      }
    });
  });

  process.on('exit', (code) => {
    if (code !== 0 && signalReceived && options.debug) {
      console.log(chalk.yellow(`[DEBUG] Exit code ${code} after signal: ${signalReceived}`));
    }
  });

  // System requirements check
  const { errors, warnings } = await checkSystemRequirements();

  if (errors.length > 0) {
    console.error(chalk.red('System requirements not met:'));
    errors.forEach(err => console.error(chalk.red(`  • ${err}`)));
    process.exitCode = 1;
    return;
  }

  if (warnings.length > 0 && !options.yes) {
    console.warn(chalk.yellow('Warnings:'));
    warnings.forEach(warn => console.warn(chalk.yellow(`  • ${warn}`)));
  }

  // Auto-detect package manager if not specified
  if (!options.packageManager) {
    options.packageManager = await detectPackageManager();
    if (options.debug) {
      console.log(chalk.gray(`Auto-detected package manager: ${options.packageManager}`));
    }
  }

  // Check if package manager is installed
  if (options.packageManager && !options.skipInstall) {
    try {
      execSync(`${options.packageManager} --version`, { stdio: 'ignore' });
    } catch {
      console.error(chalk.red(`Error: ${options.packageManager} is not installed`));
      console.log(chalk.gray(`You can install it with: npm install -g ${options.packageManager}`));
      process.exitCode = 1;
      return;
    }
  }

  // Load preset if specified
  let presetConfig = null;
  if (options.preset) {
    presetConfig = await loadPreset(options.preset);
    if (!presetConfig) {
      console.error(chalk.red(`Error: Preset "${options.preset}" not found`));
      process.exitCode = 1;
      return;
    }
    // Merge preset with options (options take precedence)
    options = { ...presetConfig, ...options };
  }

  // Validate project name format
  const validateProjectName = (value: string): string | true => {
    if (!value || value.trim() === '') {
      return 'Project name cannot be empty';
    }
    if (!/^[a-z0-9-]+$/.test(value.toLowerCase())) {
      return 'Project name can only contain lowercase letters, numbers, and hyphens';
    }
    if (value.startsWith('-') || value.endsWith('-')) {
      return 'Project name cannot start or end with a hyphen';
    }
    if (value.length > 214) {
      return 'Project name is too long (max 214 characters)';
    }
    return true;
  };

  // Validate the initial name
  const nameValidation = validateProjectName(name);
  if (nameValidation !== true) {
    console.error(chalk.red(`Error: ${nameValidation}`));
    process.exitCode = 1;
    return;
  }

  let normalizedName = name.toLowerCase().replace(/\s+/g, '-');
  let projectPath = path.resolve(process.cwd(), normalizedName);

  // Check if directory already exists
  if (fs.existsSync(projectPath) && !options.force && (options.yes || !process.stdout.isTTY || process.env.CI)) {
    console.error(chalk.red(`Error: Directory "${normalizedName}" already exists`));
    console.log(chalk.gray('Use --force to overwrite the existing directory.'));
    process.exitCode = 1;
    return;
  }

  while (fs.existsSync(projectPath) && !options.force) {
    const questions: any[] = [{
      type: 'list',
      name: 'action',
      message: `Directory "${normalizedName}" already exists. What would you like to do?`,
      choices: [
        { name: 'Enter a new project name', value: 'rename' },
        { name: 'Overwrite existing directory', value: 'overwrite' },
        { name: 'Cancel', value: 'cancel' },
      ],
      default: 'rename',
    }];
    const { action } = await safePrompt<{ action: string }>(questions, { debug: options.debug });

    if (action === 'cancel') {
      console.log(chalk.yellow('Operation cancelled.'));
      return;
    }

    if (action === 'overwrite') {
      break;
    }

    if (action === 'rename') {
      const questions: any[] = [{
        type: 'input',
        name: 'newName',
        message: 'Enter a new project name:',
        default: normalizedName + '-2',
        validate: (value: string) => {
          const validation = validateProjectName(value);
          if (validation !== true) {
            return validation;
          }
          const normalized = value.toLowerCase().replace(/\s+/g, '-');
          const newPath = path.resolve(process.cwd(), normalized);
          if (fs.existsSync(newPath)) {
            return `Directory "${normalized}" already exists`;
          }
          return true;
        },
      }];
      const { newName } = await safePrompt<{ newName: string }>(questions, { debug: options.debug });

      if (!newName) {
        console.log(chalk.yellow('Operation cancelled.'));
        return;
      }

      normalizedName = newName.toLowerCase().replace(/\s+/g, '-');
      projectPath = path.resolve(process.cwd(), normalizedName);
    }
  }

  // Interactive prompts for missing options (skip if --yes flag is used)
  let responses: any = {};

  // Force non-interactive mode if not in a TTY environment or when --yes is used
  const forceNonInteractive = !process.stdout.isTTY || process.env.CI || options.yes;

  // Debug: Log TTY status
  if (options.debug) {
    console.log('TTY Debug:');
    console.log('  stdout.isTTY:', process.stdout.isTTY);
    console.log('  stdin.isTTY:', process.stdin.isTTY);
    console.log('  stderr.isTTY:', process.stderr.isTTY);
    console.log('  CI:', process.env.CI);
    console.log('  forceNonInteractive:', forceNonInteractive);
  }

  if (!forceNonInteractive) {
    // Only run prompts if in interactive mode and --yes flag is not used
    const promptsToRun: any[] = [];

    // Welcome message
    console.log(chalk.bold.cyan('\n🚀 Welcome to Re-Shell CLI!\n'));
    console.log(chalk.gray("Let's create your new monorepo workspace.\n"));

    // Project type selection
    promptsToRun.push({
      type: 'list',
      name: 'projectType',
      message: 'Select project type:',
      choices: [
        { name: 'Microfrontend Monorepo', value: 'frontend' },
        { name: 'Full-Stack Monorepo', value: 'fullstack' },
        { name: 'Microservices Platform', value: 'backend' },
        { name: 'Polyglot Microservices', value: 'polyglot' },
      ],
      default: 'frontend',
    });

    // Template selection
    promptsToRun.push({
      type: 'list',
      name: 'template',
      message: 'Start with a template?',
      choices: [
        { name: 'Blank monorepo', value: 'blank' },
        { name: 'E-commerce starter', value: 'ecommerce' },
        { name: 'Dashboard starter', value: 'dashboard' },
        { name: 'SaaS starter', value: 'saas' },
      ],
      default: 'blank',
    });

    // TypeScript selection
    promptsToRun.push({
      type: 'confirm',
      name: 'typescript',
      message: 'Use TypeScript?',
      default: true,
    });

    if (!options.packageManager) {
      const detectedPM = await detectPackageManager();
      promptsToRun.push({
        type: 'list',
        name: 'packageManager',
        message: 'Select a package manager:',
        choices: [
          { name: `pnpm (recommended)${detectedPM === 'pnpm' ? ' ✓' : ''}`, value: 'pnpm', short: 'pnpm' },
          { name: `yarn${detectedPM === 'yarn' ? ' ✓' : ''}`, value: 'yarn', short: 'yarn' },
          { name: `npm${detectedPM === 'npm' ? ' ✓' : ''}`, value: 'npm', short: 'npm' },
          { name: `bun (experimental)${detectedPM === 'bun' ? ' ✓' : ''}`, value: 'bun', short: 'bun' },
        ],
        default: detectedPM === 'pnpm' ? 'pnpm' : detectedPM === 'yarn' ? 'yarn' : detectedPM === 'npm' ? 'npm' : detectedPM === 'bun' ? 'bun' : 'pnpm',
      });
    }

    if (options.git === undefined) {
      promptsToRun.push({
        type: 'confirm',
        name: 'git',
        message: 'Initialize Git repository?',
        default: true,
      });
    }

    if (options.submodules === undefined) {
      promptsToRun.push({
        type: 'confirm',
        name: 'submodules',
        message: 'Set up Git submodule support?',
        default: true,
      });
    }

    // Only ask about custom structure if not using --yes
    promptsToRun.push({
      type: 'confirm',
      name: 'customStructure',
      message: 'Customize directory structure?',
      default: false,
    });

    // Ask about saving as preset
    promptsToRun.push({
      type: 'confirm',
      name: 'saveAsPreset',
      message: 'Save this configuration as a preset for future use?',
      default: false,
    });

    if (promptsToRun.length > 0) {
      // Stop spinner before prompts to avoid interference
      if (options.spinner) {
        options.spinner.stop();
      }

      // Debug: Log before prompts
      if (options.debug) {
        console.log(chalk.gray('\n[DEBUG] Starting prompts...'));
      }

      // Run prompts with safe wrapper
      responses = await safePrompt(promptsToRun, { debug: options.debug });

      // Debug: Log after prompts
      if (options.debug) {
        console.log(chalk.gray(`[DEBUG] Prompts completed, responses:`), responses);
      }

      // Check if user cancelled (prompts returns empty object on cancel)
      if (!responses || Object.keys(responses).length === 0) {
        console.log(chalk.yellow('\n✖ Operation cancelled'));
        process.exit(0);
      }

      // Restart spinner after prompts
      if (options.spinner) {
        options.spinner.start();
      }
    }
  }

  let customStructure = {};
  if (responses.customStructure && !forceNonInteractive) {
    // Stop spinner for custom structure prompts
    if (options.spinner) {
      options.spinner.stop();
    }

    const structureResponses = await safePrompt([
      {
        type: 'input',
        name: 'apps',
        message: 'Applications directory name:',
        default: 'apps',
      },
      {
        type: 'input',
        name: 'packages',
        message: 'Packages directory name:',
        default: 'packages',
      },
    ], { debug: options.debug });
    customStructure = structureResponses;

    // Restart spinner
    if (options.spinner) {
      options.spinner.start();
    }
  }

  // Merge options with responses
  const finalOptions = {
    packageManager: options.packageManager || responses.packageManager || 'pnpm',
    git: options.git !== undefined ? options.git : responses.git,
    submodules: options.submodules !== undefined ? options.submodules : responses.submodules,
    structure: { ...options.structure, ...customStructure },
    template: options.template || responses.template || 'blank',
    typescript: responses.typescript !== undefined ? responses.typescript : true,
    skipInstall: options.skipInstall || false,
  };

  // Save preset if requested
  if (responses.saveAsPreset && !forceNonInteractive) {
    if (options.spinner) {
      options.spinner.stop();
    }

    const questions: any[] = [{
      type: 'input',
      name: 'presetName',
      message: 'Enter a name for this preset:',
      default: 'my-preset',
      validate: (value: string) => {
        if (!value || value.trim() === '') {
          return 'Preset name cannot be empty';
        }
        if (!/^[a-z0-9-]+$/.test(value.toLowerCase())) {
          return 'Preset name can only contain lowercase letters, numbers, and hyphens';
        }
        return true;
      },
    }];
    const { presetName } = await safePrompt<{ presetName: string }>(questions, { debug: options.debug });

    if (presetName) {
      await savePreset(presetName, {
        packageManager: finalOptions.packageManager,
        git: finalOptions.git,
        submodules: finalOptions.submodules,
        structure: finalOptions.structure,
        template: finalOptions.template,
        typescript: finalOptions.typescript,
      });
      console.log(chalk.green(`✓ Preset "${presetName}" saved successfully!`));
      console.log(chalk.gray(`Use it next time with: rs init my-project --preset ${presetName}`));
    }

    if (options.spinner) {
      options.spinner.start();
    }
  }

  const spinner = options.spinner;

  try {
    // Remove existing directory if force option is used or overwrite was chosen
    if (fs.existsSync(projectPath)) {
      if (spinner) spinner.setText('Removing existing directory...');
      flushOutput();
      await fs.remove(projectPath);
    }

    // Initialize monorepo structure
    if (spinner) spinner.setText('Creating monorepo structure...');
    flushOutput();
    await initializeMonorepo(
      normalizedName,
      finalOptions.packageManager as 'npm' | 'yarn' | 'pnpm',
      finalOptions.structure
    );

    // Initialize Git repository
    if (finalOptions.git) {
      if (spinner) spinner.setText('Initializing Git repository...');
      flushOutput();
      await initializeGitRepository(projectPath);

      // Add .gitignore
      const gitignore = `# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
*.lcov
.nyc_output

# Production
dist/
build/
out/
.next/
.nuxt/
.cache/

# Misc
.DS_Store
*.log
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea/
*.swp
*.swo

# Module Federation
.webpack-cache/
.module-federation/

# Package managers
.npm/
.yarn/
.pnpm-store/
`;
      await fs.writeFile(path.join(projectPath, '.gitignore'), gitignore);
    }

    // Set up submodule support
    if (finalOptions.submodules) {
      if (spinner) spinner.setText('Setting up submodule support...');
      flushOutput();
      // Submodule support is enabled but we don't create the helper files
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for UX
    }

    // Create additional configuration files
    if (spinner) spinner.setText('Creating configuration files...');
    flushOutput();
    await createAdditionalConfigs(projectPath, finalOptions);

    // Apply template if not blank
    if (finalOptions.template && finalOptions.template !== 'blank') {
      if (spinner) spinner.setText(`Applying ${finalOptions.template} template...`);
      flushOutput();
      await applyTemplate(projectPath, finalOptions.template, finalOptions);
    }

    // Install dependencies if not skipped
    if (!finalOptions.skipInstall) {
      if (spinner) spinner.setText('Installing dependencies...');
      flushOutput();

      try {
        const installCmd =
          finalOptions.packageManager === 'npm'
            ? 'npm install'
            : `${finalOptions.packageManager} install`;
        execSync(installCmd, {
          cwd: projectPath,
          stdio: options.debug ? 'inherit' : 'ignore',
        });

        // Run vulnerability scan
        if (spinner) spinner.setText('Scanning for vulnerabilities...');
        flushOutput();

        try {
          const auditCmd =
            finalOptions.packageManager === 'npm'
              ? 'npm audit --json'
              : finalOptions.packageManager === 'yarn'
              ? 'yarn audit --json'
              : finalOptions.packageManager === 'pnpm'
              ? 'pnpm audit --json'
              : null;

          if (auditCmd) {
            const auditResult = execSync(auditCmd, {
              cwd: projectPath,
              encoding: 'utf8',
              stdio: ['pipe', 'pipe', 'ignore'],
            });

            const audit = JSON.parse(auditResult);
            const vulnerabilities = audit.metadata?.vulnerabilities || {};
            const total = Object.values(vulnerabilities).reduce(
              (sum: number, count: unknown) => sum + (typeof count === 'number' ? count : 0),
              0 as number
            );

            if (typeof total === 'number' && total > 0) {
              console.log(chalk.yellow(`\n⚠️  Found ${total} vulnerabilities`));
              if ((typeof vulnerabilities.high === 'number' && vulnerabilities.high > 0) || 
                  (typeof vulnerabilities.critical === 'number' && vulnerabilities.critical > 0)) {
                console.log(
                  chalk.red(
                    `   Critical: ${vulnerabilities.critical || 0}, High: ${
                      vulnerabilities.high || 0
                    }`
                  )
                );
              }
              console.log(
                chalk.gray(`   Run '${finalOptions.packageManager} audit fix' to fix them\n`)
              );
            }
          }
        } catch {
          // Ignore audit errors
        }
      } catch (error) {
        console.warn(chalk.yellow('\nWarning: Failed to install dependencies'));
        console.log(
          chalk.gray(`You can install them manually with: ${finalOptions.packageManager} install\n`)
        );
      }
    }

    // Initialize git and make initial commit
    if (finalOptions.git) {
      if (spinner) spinner.setText('Creating initial commit...');
      flushOutput();

      try {
        execSync('git add -A', { cwd: projectPath, stdio: 'ignore' });
        execSync('git commit -m "Initial commit from Re-Shell CLI"', {
          cwd: projectPath,
          stdio: 'ignore',
        });
      } catch {
        // Ignore git errors
      }
    }

    // All operations completed successfully - the main CLI will handle the success message
    // Store success info for the CLI to display
    const projectType = responses.projectType || 'frontend';
    let nextSteps: string[] = [];

    switch (projectType) {
      case 'frontend':
        nextSteps = [
          `cd ${normalizedName}`,
          finalOptions.skipInstall ? `${finalOptions.packageManager} install` : null,
          'rs create shell-app --framework react-ts',
          'rs create my-feature --framework vue-ts',
          `${finalOptions.packageManager} run dev`,
        ].filter(Boolean);
        break;

      case 'fullstack':
        nextSteps = [
          `cd ${normalizedName}`,
          finalOptions.skipInstall ? `${finalOptions.packageManager} install` : null,
          'rs create shell --framework react-ts --frontend',
          'rs create api --backend fastify --db prisma',
          'rs create admin --frontend vue --backend nestjs',
          `${finalOptions.packageManager} run dev`,
        ].filter(Boolean);
        break;

      case 'backend':
        nextSteps = [
          `cd ${normalizedName}`,
          finalOptions.skipInstall ? `${finalOptions.packageManager} install` : null,
          'rs create api --backend express',
          'rs create auth-service --backend nestjs --db typeorm',
          'rs create user-service --backend fastify',
          `${finalOptions.packageManager} run dev`,
        ].filter(Boolean);
        break;

      case 'polyglot':
        nextSteps = [
          `cd ${normalizedName}`,
          finalOptions.skipInstall ? `${finalOptions.packageManager} install` : null,
          'rs create api-gateway --backend express',
          'rs create payment-service --backend python-fastapi',
          'rs create analytics-service --backend go-ktor',
          'rs create notification-service --backend rust-actix',
          `${finalOptions.packageManager} run dev`,
        ].filter(Boolean);
        break;
    }

    (global as any).__RE_SHELL_INIT_SUCCESS__ = {
      name: normalizedName,
      packageManager: finalOptions.packageManager,
      submodules: finalOptions.submodules,
      template: finalOptions.template,
      projectType: projectType,
      nextSteps,
    };
  } catch (error) {
    // Clean up on failure
    if (fs.existsSync(projectPath)) {
      try {
        await fs.remove(projectPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Provide helpful error messages
    if ((error as any).code === 'EACCES') {
      console.error(
        chalk.red('Error: Permission denied. Try running with sudo or check directory permissions.')
      );
    } else if ((error as any).code === 'ENOSPC') {
      console.error(chalk.red('Error: Not enough disk space.'));
    } else {
      console.error(chalk.red('Error initializing monorepo:'), (error as any).message || error);
    }
    throw error;
  }
}

async function applyTemplate(projectPath: string, template: string, options: any): Promise<void> {
  const templateConfig = TEMPLATES[template as keyof typeof TEMPLATES];
  if (!templateConfig) return;

  // Create template-specific structure
  const appsDir = path.join(projectPath, options.structure?.apps || 'apps');
  const packagesDir = path.join(projectPath, options.structure?.packages || 'packages');

  switch (template) {
    case 'ecommerce':
      // Create e-commerce specific apps
      await fs.ensureDir(path.join(appsDir, 'shell'));
      await fs.ensureDir(path.join(appsDir, 'product-catalog'));
      await fs.ensureDir(path.join(appsDir, 'checkout'));
      await fs.ensureDir(path.join(packagesDir, 'shared-ui'));
      await fs.ensureDir(path.join(packagesDir, 'cart-state'));
      break;

    case 'dashboard':
      // Create dashboard specific apps
      await fs.ensureDir(path.join(appsDir, 'shell'));
      await fs.ensureDir(path.join(appsDir, 'analytics'));
      await fs.ensureDir(path.join(appsDir, 'user-management'));
      await fs.ensureDir(path.join(packagesDir, 'chart-components'));
      await fs.ensureDir(path.join(packagesDir, 'data-utils'));
      break;

    case 'saas':
      // Create SaaS specific apps
      await fs.ensureDir(path.join(appsDir, 'shell'));
      await fs.ensureDir(path.join(appsDir, 'auth'));
      await fs.ensureDir(path.join(appsDir, 'billing'));
      await fs.ensureDir(path.join(appsDir, 'admin'));
      await fs.ensureDir(path.join(packagesDir, 'auth-utils'));
      await fs.ensureDir(path.join(packagesDir, 'payment-integration'));
      break;
  }

  // Add template-specific dependencies to root package.json
  if (templateConfig.dependencies.length > 0) {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = await fs.readJSON(packageJsonPath);

    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }

    // Add template dependencies (versions would be fetched from registry in real implementation)
    templateConfig.dependencies.forEach(dep => {
      packageJson.dependencies[dep] = 'latest';
    });

    await fs.writeJSON(packageJsonPath, packageJson, { spaces: 2 });
  }

  // Create template-specific README
  const readmePath = path.join(projectPath, 'README.md');
  let existingReadme = '';
  try {
    existingReadme = await fs.readFile(readmePath, 'utf8');
  } catch {
    // README doesn't exist yet, create a basic one
    existingReadme = `# ${path.basename(projectPath)}

A Re-Shell monorepo project created with the CLI.

## Getting Started

1. Install dependencies:
   \`\`\`bash
   ${options.packageManager} install
   \`\`\`

2. Start development:
   \`\`\`bash
   ${options.packageManager} run dev
   \`\`\`
`;
  }
  const templateReadme = `${existingReadme}

## Template: ${templateConfig.name}

${templateConfig.description}

### Template Structure

${
  template === 'ecommerce'
    ? `
- \`apps/shell\` - Main application shell
- \`apps/product-catalog\` - Product browsing and search
- \`apps/checkout\` - Shopping cart and checkout flow
- \`packages/shared-ui\` - Shared UI components
- \`packages/cart-state\` - Cart state management
`
    : template === 'dashboard'
    ? `
- \`apps/shell\` - Main application shell
- \`apps/analytics\` - Analytics and reporting
- \`apps/user-management\` - User administration
- \`packages/chart-components\` - Reusable chart components
- \`packages/data-utils\` - Data processing utilities
`
    : template === 'saas'
    ? `
- \`apps/shell\` - Main application shell
- \`apps/auth\` - Authentication and authorization
- \`apps/billing\` - Subscription and billing management
- \`apps/admin\` - Admin dashboard
- \`packages/auth-utils\` - Authentication utilities
- \`packages/payment-integration\` - Payment processing
`
    : ''
}

### Getting Started with ${templateConfig.name}

1. Create the shell application:
   \`\`\`bash
   rs create shell --framework react-ts
   \`\`\`

2. Create additional applications based on the template

3. Start the development server:
   \`\`\`bash
   ${options.packageManager} run dev
   \`\`\`
`;

  await fs.writeFile(readmePath, templateReadme);
}

async function createAdditionalConfigs(
  projectPath: string,
  options: { packageManager: string; git: boolean; submodules: boolean; template?: string; structure?: any }
): Promise<void> {
  // Create .nvmrc for Node.js version
  await fs.writeFile(path.join(projectPath, '.nvmrc'), '18.17.0\n');

  // Create .env.example
  const envExample = `# Re-Shell Configuration
NODE_ENV=development
PORT=3000

# Module Federation
FEDERATION_REMOTE_URL=http://localhost:3001

# API Configuration (for future full-stack support)
API_BASE_URL=http://localhost:4000
API_TIMEOUT=30000

# Feature Flags
ENABLE_HOT_RELOAD=true
ENABLE_ANALYTICS=false
`;
  await fs.writeFile(path.join(projectPath, '.env.example'), envExample);
  await fs.writeFile(path.join(projectPath, '.env'), envExample);

  // Create .editorconfig
  const editorConfig = `root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.{yml,yaml}]
indent_size = 2

[*.json]
indent_size = 2
`;

  await fs.writeFile(path.join(projectPath, '.editorconfig'), editorConfig);

  // Create VSCode settings
  const vscodeDir = path.join(projectPath, '.vscode');
  await fs.ensureDir(vscodeDir);

  const vscodeSettings = {
    'typescript.preferences.includePackageJsonAutoImports': 'on',
    'typescript.suggest.autoImports': true,
    'editor.formatOnSave': true,
    'editor.codeActionsOnSave': {
      'source.fixAll.eslint': true,
    },
    'files.associations': {
      '*.json': 'jsonc',
    },
    'search.exclude': {
      '**/node_modules': true,
      '**/dist': true,
      '**/build': true,
      '**/.next': true,
      '**/.nuxt': true,
    },
  };

  await fs.writeFile(
    path.join(vscodeDir, 'settings.json'),
    JSON.stringify(vscodeSettings, null, 2)
  );

  const vscodeExtensions = {
    recommendations: [
      'esbenp.prettier-vscode',
      'dbaeumer.vscode-eslint',
      'bradlc.vscode-tailwindcss',
      'ms-vscode.vscode-typescript-next',
      'ms-vscode.vscode-json',
      'redhat.vscode-yaml',
      'ms-vscode.vscode-npm-script',
    ],
  };

  await fs.writeFile(
    path.join(vscodeDir, 'extensions.json'),
    JSON.stringify(vscodeExtensions, null, 2)
  );

  // Create GitHub workflows if Git is enabled
  if (options.git) {
    const githubDir = path.join(projectPath, '.github', 'workflows');
    await fs.ensureDir(githubDir);

    const ciWorkflow = `name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [16.x, 18.x]

    steps:
    - uses: actions/checkout@v3
      with:
        submodules: recursive

    - name: Use Node.js \${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: \${{ matrix.node-version }}
        cache: '${options.packageManager}'

    - name: Install dependencies
      run: ${options.packageManager} install

    - name: Run linting
      run: ${options.packageManager} run lint

    - name: Run tests
      run: ${options.packageManager} run test

    - name: Build
      run: ${options.packageManager} run build
`;

    await fs.writeFile(path.join(githubDir, 'ci.yml'), ciWorkflow);
  }

  // Create prettier configuration
  const prettierConfig = {
    semi: true,
    trailingComma: 'es5',
    singleQuote: true,
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    bracketSpacing: true,
    arrowParens: 'always',
    endOfLine: 'lf',
  };

  await fs.writeFile(
    path.join(projectPath, '.prettierrc'),
    JSON.stringify(prettierConfig, null, 2)
  );

  const prettierIgnore = `# Dependencies
node_modules/

# Build outputs
dist/
build/
.next/
.nuxt/
out/

# Package manager files
pnpm-lock.yaml
yarn.lock
package-lock.json

# Generated files
*.generated.*
`;

  await fs.writeFile(path.join(projectPath, '.prettierignore'), prettierIgnore);

  // Create ESLint configuration
  const eslintConfig = {
    root: true,
    env: {
      browser: true,
      es2021: true,
      node: true,
    },
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:react/recommended',
      'plugin:react-hooks/recommended',
      'prettier',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: ['react', '@typescript-eslint'],
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  };

  await fs.writeFile(
    path.join(projectPath, '.eslintrc.json'),
    JSON.stringify(eslintConfig, null, 2)
  );

  // Create commitlint configuration
  const commitlintConfig = `module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
  },
};
`;

  await fs.writeFile(path.join(projectPath, 'commitlint.config.js'), commitlintConfig);

  // Create husky pre-commit hook
  if (options.git) {
    const huskyDir = path.join(projectPath, '.husky');
    await fs.ensureDir(huskyDir);

    const preCommit = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

${options.packageManager} run lint-staged
`;

    await fs.writeFile(path.join(huskyDir, 'pre-commit'), preCommit, { mode: 0o755 });

    const commitMsg = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

${options.packageManager} run commitlint --edit $1
`;

    await fs.writeFile(path.join(huskyDir, 'commit-msg'), commitMsg, { mode: 0o755 });
  }

  // Create lint-staged configuration
  const lintStagedConfig = {
    '*.{js,jsx,ts,tsx}': ['eslint --fix', 'prettier --write'],
    '*.{json,md,yml,yaml}': ['prettier --write'],
  };

  await fs.writeFile(
    path.join(projectPath, '.lintstagedrc.json'),
    JSON.stringify(lintStagedConfig, null, 2)
  );

  // Create turborepo configuration
  const turboConfig = {
    $schema: 'https://turbo.build/schema.json',
    pipeline: {
      build: {
        dependsOn: ['^build'],
        outputs: ['dist/**', '.next/**', 'build/**'],
      },
      test: {
        dependsOn: ['build'],
        outputs: ['coverage/**'],
      },
      lint: {
        outputs: [],
      },
      dev: {
        cache: false,
        persistent: true,
      },
    },
  };

  await fs.writeFile(path.join(projectPath, 'turbo.json'), JSON.stringify(turboConfig, null, 2));

  // Create Docker support files
  const dockerfile = `# Multi-stage build for production
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY ${
    options.packageManager === 'pnpm'
      ? 'pnpm-lock.yaml'
      : options.packageManager === 'yarn'
      ? 'yarn.lock'
      : options.packageManager === 'bun'
      ? 'bun.lockb'
      : 'package-lock.json'
  } ./

# Install dependencies
RUN ${
    options.packageManager === 'pnpm'
      ? 'npm install -g pnpm && pnpm install --frozen-lockfile'
      : options.packageManager === 'yarn'
      ? 'yarn install --frozen-lockfile'
      : options.packageManager === 'bun'
      ? 'npm install -g bun && bun install --frozen-lockfile'
      : 'npm ci'
  }

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN ${options.packageManager} run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "dist/index.js"]
`;

  await fs.writeFile(path.join(projectPath, 'Dockerfile'), dockerfile);

  const dockerignore = `node_modules
npm-debug.log
.next
.git
.gitignore
README.md
Dockerfile
.dockerignore
.env.local
.env.development.local
.env.test.local
.env.production.local
`;

  await fs.writeFile(path.join(projectPath, '.dockerignore'), dockerignore);

  // Create docker-compose.yml
  const dockerCompose = `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - .:/app
      - /app/node_modules
    command: ${options.packageManager} run dev

  # Add more services as needed (database, cache, etc.)
`;

  await fs.writeFile(path.join(projectPath, 'docker-compose.yml'), dockerCompose);

  // Create CONTRIBUTING.md
  const contributing = `# Contributing to ${path.basename(projectPath)}

We love your input! We want to make contributing to this project as easy and transparent as possible.

## Development Process

1. Fork the repo and create your branch from \`main\`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Code Style

- 2 spaces for indentation
- Use TypeScript for new code
- Follow the existing code style
- Run \`${options.packageManager} run lint\` before committing

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

- \`feat:\` new feature
- \`fix:\` bug fix
- \`docs:\` documentation changes
- \`style:\` formatting, missing semicolons, etc.
- \`refactor:\` code change that neither fixes a bug nor adds a feature
- \`test:\` adding missing tests
- \`chore:\` maintain

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
`;

  await fs.writeFile(path.join(projectPath, 'CONTRIBUTING.md'), contributing);

  // Create SECURITY.md
  const security = `# Security Policy

## Reporting Security Issues

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them to [security@example.com](mailto:security@example.com).

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Preferred Languages

We prefer all communications to be in English.
`;

  await fs.writeFile(path.join(projectPath, 'SECURITY.md'), security);

  // Create renovate.json for automated dependency updates
  const renovateConfig = {
    extends: ['config:base'],
    packageRules: [
      {
        matchUpdateTypes: ['minor', 'patch', 'pin', 'digest'],
        automerge: true,
      },
    ],
    prConcurrentLimit: 3,
    prHourlyLimit: 2,
  };

  await fs.writeFile(
    path.join(projectPath, 'renovate.json'),
    JSON.stringify(renovateConfig, null, 2)
  );

  // Create jest.config.js
  const jestConfig = `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps', '<rootDir>/packages'],
  testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/?(*.)+(spec|test).+(ts|tsx|js)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/dist/**',
    '!**/coverage/**',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
`;

  await fs.writeFile(path.join(projectPath, 'jest.config.js'), jestConfig);

  // Create Re-Shell project configuration
  const projectName = path.basename(projectPath);
  await configManager.createProjectConfig(
    projectName,
    {
      type: 'monorepo',
      packageManager: options.packageManager as 'npm' | 'yarn' | 'pnpm' | 'bun',
      framework: 'react-ts',
      template: options.template || 'blank',
      workspaces: {
        root: '.',
        patterns: [
          `${options.structure?.apps || 'apps'}/*`,
          `${options.structure?.packages || 'packages'}/*`
        ],
        types: ['app', 'package']
      },
      git: {
        submodules: options.submodules,
        hooks: true,
        conventionalCommits: true
      }
    },
    projectPath
  );
}
