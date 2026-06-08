import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import chalk from 'chalk';
import prompts from 'prompts';
import { ProgressSpinner } from '../utils/spinner';

// Profile interfaces
export interface EnvironmentProfile {
  name: string;
  description?: string;
  framework?: string;
  environment: 'development' | 'staging' | 'production' | 'custom';
  config: {
    build?: {
      target?: string;
      optimize?: boolean;
      sourcemap?: boolean;
      minify?: boolean;
    };
    dev?: {
      port?: number;
      host?: string;
      proxy?: Record<string, string>;
      cors?: boolean;
      hmr?: boolean;
    };
    test?: {
      coverage?: number;
      parallel?: boolean;
      timeout?: number;
    };
    env?: Record<string, string>;
    scripts?: Record<string, string>;
    services?: string[]; // Services to include/exclude
    dependencies?: Record<string, string>; // Override dependencies
  };
  priority?: number; // For inheritance order
  extends?: string[]; // Profile inheritance
}

export interface ProfileConfig {
  activeProfile?: string;
  profiles: Record<string, EnvironmentProfile>;
  frameworkDefaults?: {
    [framework: string]: Partial<EnvironmentProfile['config']>;
  };
}

export interface ProfileCommandOptions {
  list?: boolean;
  create?: boolean;
  delete?: string;
  activate?: string;
  show?: string;
  framework?: string;
  interactive?: boolean;
  json?: boolean;
  spinner?: ProgressSpinner;
}

// Profile storage path
const PROFILE_CONFIG_PATH = 're-shell.profiles.yaml';
const WORKSPACE_PROFILES_DIR = '.re-shell/profiles';

/**
 * Main profile management function
 */
export async function manageProfiles(options: ProfileCommandOptions = {}): Promise<void> {
  const { spinner, json } = options;

  try {
    if (options.create) {
      await createProfile(options, spinner);
      return;
    }

    if (options.delete) {
      await deleteProfile(options.delete, spinner);
      return;
    }

    if (options.activate) {
      await activateProfile(options.activate, spinner);
      return;
    }

    if (options.show) {
      await showProfile(options.show, options, spinner);
      return;
    }

    // Default: list all profiles
    await listProfiles(options, spinner);

  } catch (error: any) {
    if (spinner) spinner.fail(chalk.red('Profile operation failed'));
    throw error;
  }
}

/**
 * Load profile configuration
 */
export async function loadProfileConfig(): Promise<ProfileConfig> {
  const configPath = path.join(process.cwd(), PROFILE_CONFIG_PATH);

  if (!(await fs.pathExists(configPath))) {
    return { profiles: {} };
  }

  const content = await fs.readFile(configPath, 'utf8');
  return yaml.parse(content) || { profiles: {} };
}

/**
 * Save profile configuration
 */
export async function saveProfileConfig(config: ProfileConfig): Promise<void> {
  const configPath = path.join(process.cwd(), PROFILE_CONFIG_PATH);
  const content = yaml.stringify(config);
  await fs.writeFile(configPath, content, 'utf8');
}

/**
 * List all profiles
 */
async function listProfiles(options: ProfileCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Loading profiles...');

  const config = await loadProfileConfig();
  const profileNames = Object.keys(config.profiles);

  if (profileNames.length === 0) {
    if (spinner) spinner.stop();
    console.log(chalk.yellow('\n⚠️  No profiles found. Create one with: re-shell profile create\n'));
    return;
  }

  if (spinner) spinner.stop();

  console.log(chalk.cyan.bold('\n📋 Available Profiles\n'));

  for (const name of profileNames) {
    const profile = config.profiles[name];
    const isActive = config.activeProfile === name;

    console.log(chalk[isActive ? 'green' : 'white'](
      `${isActive ? '→ ' : '  '} ${name}${isActive ? ' (active)' : ''}`
    ));

    if (profile.description) {
      console.log(chalk.gray(`    ${profile.description}`));
    }

    console.log(chalk.gray(`    Environment: ${profile.environment}`));

    if (profile.framework) {
      console.log(chalk.gray(`    Framework: ${profile.framework}`));
    }

    if (profile.extends && profile.extends.length > 0) {
      console.log(chalk.gray(`    Extends: ${profile.extends.join(', ')}`));
    }

    console.log('');
  }

  console.log(chalk.gray(`Active profile: ${config.activeProfile || 'None'}`));
  console.log(chalk.gray(`\nCommands:`));
  console.log(chalk.gray(`  re-shell profile create    - Create a new profile`));
  console.log(chalk.gray(`  re-shell profile activate <name>  - Activate a profile`));
  console.log(chalk.gray(`  re-shell profile show <name>    - Show profile details`));
  console.log(chalk.gray(`  re-shell profile delete <name>  - Delete a profile`));
}

/**
 * Create a new profile
 */
async function createProfile(options: ProfileCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const config = await loadProfileConfig();

  console.log(chalk.cyan.bold('\n📝 Interactive Profile Creation Wizard\n'));
  console.log(chalk.gray('This wizard will guide you through creating a custom profile.\n'));

  // Step 1: Basic information
  console.log(chalk.bold('Step 1: Basic Information\n'));
  const basicInfo = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'Profile name:',
      initial: options.framework ? `${options.framework}-custom` : 'custom-profile',
      validate: (value: string) => {
        if (!value || value.trim().length === 0) {
          return 'Profile name is required';
        }
        if (config.profiles[value]) {
          return `Profile "${value}" already exists`;
        }
        return true;
      },
    },
    {
      type: 'text',
      name: 'description',
      message: 'Description:',
      initial: 'Custom profile for specific development needs',
    },
  ]);

  if (!basicInfo.name) {
    console.log(chalk.yellow('\n✖ Profile creation cancelled\n'));
    return;
  }

  // Step 2: Environment and framework
  console.log(chalk.bold('\nStep 2: Environment & Framework\n'));
  const envFramework = await prompts([
    {
      type: 'select',
      name: 'environment',
      message: 'Environment type:',
      choices: [
        { title: '🔧 Development - For local development with debugging', value: 'development' },
        { title: '🚀 Staging - Pre-production testing environment', value: 'staging' },
        { title: '🏭 Production - Optimized for production deployment', value: 'production' },
        { title: '⚙️  Custom - Custom configuration', value: 'custom' },
      ],
      initial: 0,
    },
    {
      type: 'select',
      name: 'framework',
      message: 'Framework (optional):',
      choices: [
        { title: 'None / Generic', value: null },
        { title: '⚛️  React', value: 'react' },
        { title: '💚 Vue', value: 'vue' },
        { title: '🧡 Svelte', value: 'svelte' },
        { title: '🔷 Next.js', value: 'nextjs' },
        { title: '🟢 Express', value: 'express' },
        { title: '⚡ Fastify', value: 'fastify' },
        { title: '🐈 NestJS', value: 'nestjs' },
        { title: '🚀 Angular', value: 'angular' },
        { title: '💎 Solid', value: 'solid' },
      ],
      initial: 0,
    },
  ]);

  // Step 3: Build configuration
  console.log(chalk.bold('\nStep 3: Build Configuration\n'));
  const buildConfig = await prompts([
    {
      type: 'confirm',
      name: 'configureBuild',
      message: 'Configure build settings?',
      initial: envFramework.environment !== 'development',
    },
  ]);

  let buildSettings: any = {};
  if (buildConfig.configureBuild) {
    buildSettings = await prompts([
      {
        type: 'select',
        name: 'target',
        message: 'Build target:',
        choices: [
          { title: 'ESNext (latest features)', value: 'esnext' },
          { title: 'ES2020', value: 'es2020' },
          { title: 'ES2019', value: 'es2019' },
          { title: 'ES2015', value: 'es2015' },
        ],
        initial: envFramework.environment === 'production' ? 1 : 0,
      },
      {
        type: 'confirm',
        name: 'optimize',
        message: 'Enable optimizations?',
        initial: envFramework.environment === 'production',
      },
      {
        type: 'confirm',
        name: 'sourcemap',
        message: 'Generate sourcemaps?',
        initial: envFramework.environment !== 'production',
      },
      {
        type: 'confirm',
        name: 'minify',
        message: 'Minify output?',
        initial: envFramework.environment === 'production',
      },
    ]);
  }

  // Step 4: Development server configuration
  console.log(chalk.bold('\nStep 4: Development Server\n'));
  const devConfig = await prompts([
    {
      type: 'confirm',
      name: 'configureDev',
      message: 'Configure development server?',
      initial: envFramework.environment === 'development',
    },
  ]);

  let devSettings: any = {};
  if (devConfig.configureDev) {
    const defaultPorts: Record<string, number> = {
      development: 3000,
      staging: 3001,
      production: 3002,
      custom: 3000,
    };

    devSettings = await prompts([
      {
        type: 'number',
        name: 'port',
        message: 'Development server port:',
        initial: defaultPorts[envFramework.environment],
      },
      {
        type: 'text',
        name: 'host',
        message: 'Development server host:',
        initial: 'localhost',
      },
      {
        type: 'confirm',
        name: 'hmr',
        message: 'Enable Hot Module Replacement (HMR)?',
        initial: envFramework.environment === 'development',
      },
      {
        type: 'confirm',
        name: 'cors',
        message: 'Enable CORS?',
        initial: true,
      },
    ]);
  }

  // Step 5: Test configuration
  console.log(chalk.bold('\nStep 5: Test Configuration\n'));
  const testConfig = await prompts([
    {
      type: 'confirm',
      name: 'configureTest',
      message: 'Configure test settings?',
      initial: false,
    },
  ]);

  let testSettings: any = {};
  if (testConfig.configureTest) {
    testSettings = await prompts([
      {
        type: 'number',
        name: 'coverage',
        message: 'Target code coverage percentage:',
        initial: 80,
      },
      {
        type: 'confirm',
        name: 'parallel',
        message: 'Run tests in parallel?',
        initial: true,
      },
      {
        type: 'number',
        name: 'timeout',
        message: 'Test timeout (ms):',
        initial: 5000,
      },
    ]);
  }

  // Step 6: Environment variables
  console.log(chalk.bold('\nStep 6: Environment Variables\n'));
  const envConfig = await prompts([
    {
      type: 'confirm',
      name: 'configureEnv',
      message: 'Add environment variables?',
      initial: true,
    },
  ]);

  const envVars: Record<string, string> = {};
  if (envConfig.configureEnv) {
    let addingEnv = true;
    while (addingEnv) {
      const envAnswer = await prompts({
        type: 'text',
        name: 'key',
        message: 'Environment variable name (or empty to stop):',
      });

      if (!envAnswer.key) {
        addingEnv = false;
      } else {
        const valueAnswer = await prompts({
          type: 'text',
          name: 'value',
          message: `Value for ${envAnswer.key}:`,
        });
        envVars[envAnswer.key] = valueAnswer.value;
      }
    }
  }

  // Step 7: Scripts
  console.log(chalk.bold('\nStep 7: Custom Scripts\n'));
  const scriptConfig = await prompts([
    {
      type: 'confirm',
      name: 'configureScripts',
      message: 'Add custom scripts?',
      initial: false,
    },
  ]);

  const scripts: Record<string, string> = {};
  if (scriptConfig.configureScripts) {
    let addingScript = true;
    while (addingScript) {
      const scriptAnswer = await prompts([
        {
          type: 'text',
          name: 'name',
          message: 'Script name (or empty to stop):',
        },
      ]);

      if (!scriptAnswer.name) {
        addingScript = false;
      } else {
        const commandAnswer = await prompts({
          type: 'text',
          name: 'command',
          message: `Command for ${scriptAnswer.name}:`,
        });
        scripts[scriptAnswer.name] = commandAnswer.command;
      }
    }
  }

  // Step 8: Dependencies
  console.log(chalk.bold('\nStep 8: Additional Dependencies\n'));
  const depConfig = await prompts([
    {
      type: 'confirm',
      name: 'configureDeps',
      message: 'Add additional dependencies?',
      initial: false,
    },
  ]);

  const dependencies: Record<string, string> = {};
  if (depConfig.configureDeps) {
    let addingDep = true;
    while (addingDep) {
      const depAnswer = await prompts([
        {
          type: 'text',
          name: 'name',
          message: 'Dependency name (or empty to stop):',
        },
      ]);

      if (!depAnswer.name) {
        addingDep = false;
      } else {
        const versionAnswer = await prompts({
          type: 'text',
          name: 'version',
          message: `Version for ${depAnswer.name}:`,
          initial: 'latest',
        });
        dependencies[depAnswer.name] = versionAnswer.version;
      }
    }
  }

  // Step 9: Services
  console.log(chalk.bold('\nStep 9: Service Selection\n'));
  const serviceConfig = await prompts([
    {
      type: 'confirm',
      name: 'configureServices',
      message: 'Select services to include?',
      initial: false,
    },
  ]);

  let services: string[] = [];
  if (serviceConfig.configureServices) {
    const servicesAnswer = await prompts({
      type: 'multiselect',
      name: 'services',
      message: 'Select services:',
      choices: [
        { title: '🌐 Web Server', value: 'web' },
        { title: '🔌 API Server', value: 'api' },
        { title: '🗄️  Database', value: 'database' },
        { title: '📊 Cache/Redis', value: 'cache' },
        { title: '🔍 Search/Elasticsearch', value: 'search' },
        { title: '📨 Message Queue', value: 'queue' },
        { title: '📈 Monitoring', value: 'monitoring' },
        { title: '📝 Logging', value: 'logging' },
      ],
      instructions: false,
    });
    services = servicesAnswer.services || [];
  }

  // Step 10: Profile inheritance
  console.log(chalk.bold('\nStep 10: Profile Inheritance (Optional)\n'));
  const existingProfiles = Object.keys(config.profiles);
  let extendsProfiles: string[] = [];

  if (existingProfiles.length > 0) {
    const extendAnswer = await prompts([
      {
        type: 'confirm',
        name: 'configureExtends',
        message: 'Extend existing profiles?',
        initial: false,
      },
    ]);

    if (extendAnswer.configureExtends) {
      const extendsAnswer = await prompts({
        type: 'multiselect',
        name: 'extends',
        message: 'Select profiles to extend:',
        choices: existingProfiles.map(name => ({ title: name, value: name })),
        instructions: false,
      });
      extendsProfiles = extendsAnswer.extends || [];
    }
  }

  // Step 11: Priority
  console.log(chalk.bold('\nStep 11: Priority\n'));
  const priorityAnswer = await prompts({
    type: 'number',
    name: 'priority',
    message: 'Profile priority (for inheritance order, higher = more important):',
    initial: 0,
  });

  // Build profile configuration
  const profile: EnvironmentProfile = {
    name: basicInfo.name,
    description: basicInfo.description,
    framework: envFramework.framework || undefined,
    environment: envFramework.environment,
    config: {},
    priority: priorityAnswer.priority,
  };

  // Add build configuration
  if (buildSettings.target) {
    profile.config.build = {
      target: buildSettings.target,
      optimize: buildSettings.optimize,
      sourcemap: buildSettings.sourcemap,
      minify: buildSettings.minify,
    };
  }

  // Add development server configuration
  if (devSettings.port) {
    profile.config.dev = {
      port: devSettings.port,
      host: devSettings.host,
      hmr: devSettings.hmr,
      cors: devSettings.cors,
    };
  }

  // Add test configuration
  if (testSettings.coverage !== undefined) {
    profile.config.test = {
      coverage: testSettings.coverage,
      parallel: testSettings.parallel,
      timeout: testSettings.timeout,
    };
  }

  // Add environment variables
  if (Object.keys(envVars).length > 0) {
    profile.config.env = envVars;
  }

  // Add scripts
  if (Object.keys(scripts).length > 0) {
    profile.config.scripts = scripts;
  }

  // Add dependencies
  if (Object.keys(dependencies).length > 0) {
    profile.config.dependencies = dependencies;
  }

  // Add services
  if (services.length > 0) {
    profile.config.services = services;
  }

  // Add inheritance
  if (extendsProfiles.length > 0) {
    profile.extends = extendsProfiles;
  }

  // Save profile
  config.profiles[basicInfo.name] = profile;
  await saveProfileConfig(config);

  // Display summary
  console.log(chalk.cyan.bold('\n✨ Profile Created Successfully!\n'));
  console.log(chalk.white(`Name: ${basicInfo.name}`));
  console.log(chalk.gray(`Description: ${basicInfo.description}`));
  console.log(chalk.gray(`Environment: ${envFramework.environment}`));
  if (envFramework.framework) {
    console.log(chalk.gray(`Framework: ${envFramework.framework}`));
  }

  const features: string[] = [];
  if (profile.config.build) features.push('Build Config');
  if (profile.config.dev) features.push('Dev Server');
  if (profile.config.test) features.push('Test Config');
  if (profile.config.env) features.push(`${Object.keys(profile.config.env).length} Env Vars`);
  if (profile.config.scripts) features.push(`${Object.keys(profile.config.scripts).length} Scripts`);
  if (profile.config.dependencies) features.push(`${Object.keys(profile.config.dependencies).length} Dependencies`);
  if (profile.config.services) features.push(`${profile.config.services.length} Services`);
  if (profile.extends) features.push(`Extends ${profile.extends.length} Profiles`);

  if (features.length > 0) {
    console.log(chalk.cyan('\nFeatures:'));
    features.forEach(f => console.log(chalk.gray(`  • ${f}`)));
  }

  console.log(chalk.gray(`\nActivate with: re-shell profile activate ${basicInfo.name}`));
  console.log(chalk.gray(`View profile: re-shell profile show ${basicInfo.name}\n`));
}

/**
 * Activate a profile
 */
async function activateProfile(profileName: string, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Activating profile "${profileName}"...`);

  const config = await loadProfileConfig();

  if (!config.profiles[profileName]) {
    if (spinner) spinner.stop();
    console.log(chalk.red(`\n✖ Profile "${profileName}" not found\n`));
    return;
  }

  // Use the enhanced switchProfile function
  const result = await switchProfile(profileName, {
    validate: true,
    force: false,
    createSnapshot: true,
    spinner,
  });

  if (result.success) {
    if (result.warnings.length > 0) {
      console.log(chalk.yellow('\nWarnings:'));
      result.warnings.forEach(w => console.log(chalk.gray(`  ⚠ ${w}`)));
    }
    console.log('');
  } else {
    if (spinner) spinner.stop();
    console.log(chalk.red('\n✗ Failed to activate profile\n'));
    result.errors.forEach(e => console.log(chalk.red(`  ✗ ${e}`)));
    console.log('');
  }
}

/**
 * Apply profile settings to workspace
 */
async function applyProfile(profile: EnvironmentProfile): Promise<void> {
  const workspaceConfigPath = path.join(process.cwd(), 're-shell.workspaces.yaml');

  // Merge profile settings into workspace config
  // In production, this would update the workspace configuration file
  // For now, we'll create a .env file with the environment variables
  if (profile.config.env && Object.keys(profile.config.env).length > 0) {
    const envPath = path.join(process.cwd(), '.env.local');
    const envHeader = '# Generated by Re-Shell profile: ' + profile.name + '\n# Do not edit manually, use "re-shell profile" commands instead\n\n';
    const envContent = envHeader + Object.entries(profile.config.env)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    await fs.writeFile(envPath, envContent, 'utf8');
  }
}

/**
 * Show profile details
 */
async function showProfile(profileName: string, options: ProfileCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Loading profile "${profileName}"...`);

  const config = await loadProfileConfig();

  if (!config.profiles[profileName]) {
    if (spinner) spinner.stop();
    console.log(chalk.red(`\n✖ Profile "${profileName}" not found\n`));
    return;
  }

  if (spinner) spinner.stop();

  const profile = config.profiles[profileName];

  console.log(chalk.cyan.bold(`\n📄 Profile: ${profileName}\n`));

  if (profile.description) {
    console.log(chalk.white(`Description: ${profile.description}\n`));
  }

  console.log(chalk.gray(`Environment: ${profile.environment}`));
  if (profile.framework) {
    console.log(chalk.gray(`Framework: ${profile.framework}`));
  }
  if (profile.extends && profile.extends.length > 0) {
    console.log(chalk.gray(`Extends: ${profile.extends.join(', ')}`));
  }

  if (profile.config.build) {
    console.log(chalk.cyan('\nBuild Configuration:'));
    console.log(chalk.gray(`  Target: ${profile.config.build.target}`));
    console.log(chalk.gray(`  Optimize: ${profile.config.build.optimize}`));
    console.log(chalk.gray(`  Sourcemap: ${profile.config.build.sourcemap}`));
    console.log(chalk.gray(`  Minify: ${profile.config.build.minify}`));
  }

  if (profile.config.dev) {
    console.log(chalk.cyan('\nDevelopment Server:'));
    console.log(chalk.gray(`  Port: ${profile.config.dev.port}`));
    console.log(chalk.gray(`  Host: ${profile.config.dev.host}`));
    console.log(chalk.gray(`  HMR: ${profile.config.dev.hmr}`));
    console.log(chalk.gray(`  CORS: ${profile.config.dev.cors}`));
  }

  if (profile.config.env && Object.keys(profile.config.env).length > 0) {
    console.log(chalk.cyan('\nEnvironment Variables:'));
    Object.entries(profile.config.env).forEach(([key, value]) => {
      console.log(chalk.gray(`  ${key}=${value}`));
    });
  }

  console.log('');
}

/**
 * Delete a profile
 */
async function deleteProfile(profileName: string, spinner?: ProgressSpinner): Promise<void> {
  const config = await loadProfileConfig();

  if (!config.profiles[profileName]) {
    if (spinner) spinner.stop();
    console.log(chalk.red(`\n✖ Profile "${profileName}" not found\n`));
    return;
  }

  if (spinner) spinner.stop();

  const confirm = await prompts({
    type: 'confirm',
    name: 'value',
    message: `Delete profile "${profileName}"?`,
    initial: false,
  });

  if (!confirm.value) {
    console.log(chalk.yellow('\n✖ Profile deletion cancelled\n'));
    return;
  }

  delete config.profiles[profileName];

  // Clear active profile if it was the deleted one
  if (config.activeProfile === profileName) {
    delete config.activeProfile;
  }

  await saveProfileConfig(config);

  console.log(chalk.green(`\n✓ Profile "${profileName}" deleted\n`));
}

/**
 * Get active profile
 */
export async function getActiveProfile(): Promise<EnvironmentProfile | null> {
  const config = await loadProfileConfig();
  if (!config.activeProfile || !config.profiles[config.activeProfile]) {
    return null;
  }
  return config.profiles[config.activeProfile];
}

/**
 * Apply framework-specific defaults
 */
export async function applyFrameworkDefaults(framework: string): Promise<Partial<EnvironmentProfile['config']>> {
  const config = await loadProfileConfig();

  // Return framework defaults if configured
  if (config.frameworkDefaults && config.frameworkDefaults[framework]) {
    return config.frameworkDefaults[framework];
  }

  // Built-in defaults
  const defaults: Record<string, Partial<EnvironmentProfile['config']>> = {
    react: {
      dev: { port: 3000, hmr: true },
      build: { target: 'es2020', sourcemap: true },
    },
    vue: {
      dev: { port: 8080, hmr: true },
      build: { target: 'es2020', sourcemap: true },
    },
    svelte: {
      dev: { port: 5000, hmr: true },
      build: { target: 'es2020', sourcemap: true },
    },
    express: {
      dev: { port: 3000, hmr: false },
      build: { target: 'es2020', sourcemap: false },
    },
    fastify: {
      dev: { port: 3000, hmr: false },
      build: { target: 'es2020', sourcemap: false },
    },
    nestjs: {
      dev: { port: 3000, hmr: true },
      build: { target: 'es2020', sourcemap: true },
    },
    nextjs: {
      dev: { port: 3000, hmr: true },
      build: { target: 'es2020', sourcemap: true },
    },
  };

  return defaults[framework] || {};
}

/**
 * Resolve profile inheritance and compose final configuration
 * Handles multiple inheritance, priority ordering, and override rules
 */
export async function resolveProfile(profileName: string): Promise<EnvironmentProfile | null> {
  const config = await loadProfileConfig();
  const profile = config.profiles[profileName];

  if (!profile) {
    return null;
  }

  // If no inheritance, return profile as-is
  if (!profile.extends || profile.extends.length === 0) {
    return profile;
  }

  // Build inheritance chain and resolve with priority
  const resolved = await resolveProfileWithInheritance(profileName, config);
  return resolved;
}

/**
 * Resolve profile with full inheritance chain
 * Implements composition with override rules based on priority
 */
async function resolveProfileWithInheritance(
  profileName: string,
  config: ProfileConfig,
  visited: Set<string> = new Set()
): Promise<EnvironmentProfile> {
  // Detect circular dependencies
  if (visited.has(profileName)) {
    throw new Error(`Circular profile dependency detected: ${Array.from(visited).join(' -> ')} -> ${profileName}`);
  }

  visited.add(profileName);

  const profile = config.profiles[profileName];
  if (!profile) {
    throw new Error(`Profile "${profileName}" not found`);
  }

  // Base configuration starting with framework defaults
  let baseConfig: EnvironmentProfile['config'] = {};

  if (profile.framework) {
    const frameworkDefaults = await applyFrameworkDefaults(profile.framework);
    baseConfig = deepMerge({}, frameworkDefaults);
  }

  // Resolve parent profiles in order (lower priority first)
  if (profile.extends && profile.extends.length > 0) {
    for (const parentName of profile.extends) {
      const parentConfig = await resolveProfileWithInheritance(parentName, config, new Set(visited));

      // Merge parent config into base (parent has lower priority)
      baseConfig = deepMerge(baseConfig, parentConfig.config);
    }
  }

  // Merge current profile config (highest priority)
  const finalConfig = deepMerge(baseConfig, profile.config);

  // Return composed profile
  return {
    ...profile,
    config: finalConfig,
  };
}

/**
 * Deep merge objects with proper override rules
 * Arrays are replaced (not merged) except for specific cases
 * Objects are recursively merged
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const output: any = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }

  return output;
}

/**
 * Check if value is a plain object
 */
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Validate profile inheritance for conflicts and circular dependencies
 */
export async function validateProfileInheritance(profileName: string): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const config = await loadProfileConfig();
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const visited = new Set<string>();
    await checkInheritanceChain(profileName, config, visited);

    // Check for override conflicts
    const profile = config.profiles[profileName];
    if (profile && profile.extends && profile.extends.length > 0) {
      const conflicts = await detectOverrideConflicts(profileName, config);
      warnings.push(...conflicts);
    }

    return { valid: true, errors, warnings };
  } catch (error: any) {
    return { valid: false, errors: [error.message], warnings };
  }
}

/**
 * Check inheritance chain for circular dependencies
 */
async function checkInheritanceChain(
  profileName: string,
  config: ProfileConfig,
  visited: Set<string>
): Promise<void> {
  if (visited.has(profileName)) {
    throw new Error(`Circular dependency: ${Array.from(visited).join(' -> ')} -> ${profileName}`);
  }

  visited.add(profileName);

  const profile = config.profiles[profileName];
  if (!profile) {
    throw new Error(`Profile "${profileName}" not found`);
  }

  if (profile.extends) {
    for (const parentName of profile.extends) {
      await checkInheritanceChain(parentName, config, new Set(visited));
    }
  }
}

/**
 * Detect potential override conflicts in profile inheritance
 */
async function detectOverrideConflicts(
  profileName: string,
  config: ProfileConfig
): Promise<string[]> {
  const conflicts: string[] = [];
  const profile = config.profiles[profileName];

  if (!profile || !profile.extends || profile.extends.length === 0) {
    return conflicts;
  }

  // Get all parent configurations
  const parentConfigs: Array<{ name: string; config: any }> = [];
  for (const parentName of profile.extends) {
    const parent = await resolveProfileWithInheritance(parentName, config, new Set());
    parentConfigs.push({ name: parentName, config: parent.config });
  }

  // Check for conflicting settings
  const currentSettings = flattenObject(profile.config);

  for (const parent of parentConfigs) {
    const parentSettings = flattenObject(parent.config);

    for (const key of Object.keys(currentSettings)) {
      if (key in parentSettings) {
        const currentValue = currentSettings[key];
        const parentValue = parentSettings[key];

        // Only warn if values are different and both are explicitly set
        if (JSON.stringify(currentValue) !== JSON.stringify(parentValue)) {
          conflicts.push(
            `Override conflict: "${key}" is different in current profile (${JSON.stringify(currentValue)}) than in parent "${parent.name}" (${JSON.stringify(parentValue)})`
          );
        }
      }
    }
  }

  return conflicts;
}

/**
 * Flatten nested object for comparison
 */
function flattenObject(obj: any, prefix = ''): Record<string, any> {
  const flattened: Record<string, any> = {};

  for (const key in obj) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (isObject(obj[key])) {
      Object.assign(flattened, flattenObject(obj[key], newKey));
    } else {
      flattened[newKey] = obj[key];
    }
  }

  return flattened;
}

/**
 * Compose multiple profiles with priority ordering
 * Lower priority profiles are applied first, higher priority override
 */
export async function composeProfiles(profileNames: string[]): Promise<EnvironmentProfile['config']> {
  if (profileNames.length === 0) {
    return {};
  }

  const config = await loadProfileConfig();
  let composed: EnvironmentProfile['config'] = {};

  // Apply profiles in order (first = lowest priority)
  for (const name of profileNames) {
    const resolved = await resolveProfile(name);
    if (resolved) {
      composed = deepMerge(composed, resolved.config);
    }
  }

  return composed;
}

/**
 * Get profile inheritance tree for visualization
 */
export async function getProfileTree(profileName: string, config?: ProfileConfig): Promise<{
  name: string;
  children: any[];
  depth: number;
}> {
  if (!config) {
    config = await loadProfileConfig();
  }

  const profile = config.profiles[profileName];
  if (!profile) {
    throw new Error(`Profile "${profileName}" not found`);
  }

  const children = [];
  if (profile.extends) {
    for (const parentName of profile.extends) {
      children.push(await getProfileTree(parentName, config));
    }
  }

  return {
    name: profileName,
    children,
    depth: profile.extends ? Math.max(...children.map(c => c.depth)) + 1 : 0,
  };
}

/**
 * Export profile with all inherited properties resolved
 */
export async function exportProfile(profileName: string): Promise<{
  profile: EnvironmentProfile;
  inheritedFrom: string[];
  finalConfig: EnvironmentProfile['config'];
}> {
  const config = await loadProfileConfig();
  const baseProfile = config.profiles[profileName];

  if (!baseProfile) {
    throw new Error(`Profile "${profileName}" not found`);
  }

  const resolved = await resolveProfile(profileName);
  const inheritedFrom = baseProfile.extends || [];

  // Get inheritance chain
  const chain = await getInheritanceChain(profileName, config);

  return {
    profile: baseProfile,
    inheritedFrom: chain,
    finalConfig: resolved?.config || {},
  };
}

/**
 * Get full inheritance chain for a profile
 */
async function getInheritanceChain(
  profileName: string,
  config: ProfileConfig,
  visited: Set<string> = new Set()
): Promise<string[]> {
  if (visited.has(profileName)) {
    return []; // Circular dependency, stop here
  }

  visited.add(profileName);

  const profile = config.profiles[profileName];
  if (!profile || !profile.extends) {
    return [];
  }

  const chain: string[] = [];
  for (const parentName of profile.extends) {
    chain.push(parentName);
    const parentChain = await getInheritanceChain(parentName, config, new Set(visited));
    chain.push(...parentChain);
  }

  return [...new Set(chain)]; // Remove duplicates
}

/**
 * Profile context state management
 */
interface ProfileContext {
  profileName: string;
  activatedAt: number;
  validated: boolean;
  validationHash?: string;
  workspacePath: string;
  snapshot?: Record<string, any>; // Snapshot of workspace state when activated
}

/**
 * Persist active profile to workspace state
 */
async function persistActiveProfile(
  profileName: string,
  workspacePath: string = process.cwd()
): Promise<void> {
  const context: ProfileContext = {
    profileName,
    activatedAt: Date.now(),
    validated: false,
    workspacePath,
  };

  // Create snapshot of current workspace state
  try {
    context.snapshot = await captureWorkspaceSnapshot(workspacePath);
    context.validated = true;
    context.validationHash = generateValidationHash(context.snapshot);
  } catch (error) {
    // Non-fatal: continue without validation
    context.validated = false;
  }

  // Save to .re-shell/profile-context.json
  const contextDir = path.join(workspacePath, '.re-shell');
  await fs.ensureDir(contextDir);

  const contextPath = path.join(contextDir, 'profile-context.json');
  await fs.writeFile(contextPath, JSON.stringify(context, null, 2), 'utf8');

  // Also update .re-shell-profile file for easy detection
  const profileIndicatorPath = path.join(workspacePath, '.re-shell-profile');
  await fs.writeFile(profileIndicatorPath, profileName, 'utf8');
}

/**
 * Load active profile context for current workspace
 */
export async function loadProfileContext(
  workspacePath: string = process.cwd()
): Promise<ProfileContext | null> {
  const contextPath = path.join(workspacePath, '.re-shell', 'profile-context.json');

  if (!(await fs.pathExists(contextPath))) {
    return null;
  }

  try {
    const content = await fs.readFile(contextPath, 'utf8');
    const context: ProfileContext = JSON.parse(content);
    return context;
  } catch (error) {
    return null;
  }
}

/**
 * Switch profile context with validation
 */
export async function switchProfile(
  targetProfile: string,
  options: {
    validate?: boolean;
    force?: boolean;
    createSnapshot?: boolean;
    spinner?: ProgressSpinner;
  } = {}
): Promise<{ success: boolean; warnings: string[]; errors: string[] }> {
  const {
    validate = true,
    force = false,
    createSnapshot = true,
    spinner,
  } = options;

  const warnings: string[] = [];
  const errors: string[] = [];

  if (spinner) spinner.setText(`Switching to profile "${targetProfile}"...`);

  // Load current context
  const currentContext = await loadProfileContext();

  // Validate target profile
  if (validate) {
    const validation = await validateProfileInheritance(targetProfile);
    if (!validation.valid) {
      errors.push(...validation.errors);
      if (!force) {
        if (spinner) spinner.stop();
        return { success: false, warnings, errors };
      }
      warnings.push('Forced switch despite validation errors');
    }
    warnings.push(...validation.warnings);
  }

  // Check if target profile exists
  const config = await loadProfileConfig();
  if (!config.profiles[targetProfile]) {
    errors.push(`Profile "${targetProfile}" not found`);
    if (spinner) spinner.stop();
    return { success: false, warnings, errors };
  }

  // Deactivate current profile if any
  if (currentContext) {
    await deactivateProfile(currentContext.profileName);
    warnings.push(`Deactivated previous profile: ${currentContext.profileName}`);
  }

  // Activate new profile
  const profile = config.profiles[targetProfile];
  await applyProfile(profile);

  // Persist context
  if (createSnapshot) {
    await persistActiveProfile(targetProfile);
  }

  // Update active profile in config
  config.activeProfile = targetProfile;
  await saveProfileConfig(config);

  if (spinner) spinner.succeed(chalk.green(`Switched to profile "${targetProfile}"`));

  return { success: true, warnings, errors };
}

/**
 * Deactivate current profile and restore workspace state
 */
export async function deactivateProfile(
  profileName: string,
  workspacePath: string = process.cwd()
): Promise<void> {
  // Remove profile context
  const contextPath = path.join(workspacePath, '.re-shell', 'profile-context.json');
  const profileIndicatorPath = path.join(workspacePath, '.re-shell-profile');

  if (await fs.pathExists(contextPath)) {
    await fs.remove(contextPath);
  }

  if (await fs.pathExists(profileIndicatorPath)) {
    await fs.remove(profileIndicatorPath);
  }

  // Clear active profile in config
  const config = await loadProfileConfig();
  if (config.activeProfile === profileName) {
    delete config.activeProfile;
    await saveProfileConfig(config);
  }

  // Restore workspace state if snapshot exists
  const context = await loadProfileContext(workspacePath);
  if (context && context.snapshot) {
    await restoreWorkspaceSnapshot(workspacePath, context.snapshot);
  }

  // Clean up .env.local if it was created by the profile
  const envPath = path.join(workspacePath, '.env.local');
  if (await fs.pathExists(envPath)) {
    // Check if it was created by profile (has comment marker)
    const envContent = await fs.readFile(envPath, 'utf8');
    if (envContent.includes('# Generated by Re-Shell profile')) {
      await fs.remove(envPath);
    }
  }
}

/**
 * Get current active profile with context
 */
export async function getActiveProfileWithContext(): Promise<{
  profile: EnvironmentProfile | null;
  context: ProfileContext | null;
}> {
  const context = await loadProfileContext();
  let profile: EnvironmentProfile | null = null;

  if (context) {
    const config = await loadProfileConfig();
    profile = config.profiles[context.profileName] || null;
  } else {
    profile = await getActiveProfile();
  }

  return { profile, context };
}

/**
 * Validate current profile context
 */
export async function validateCurrentContext(): Promise<{
  valid: boolean;
  profileMatches: boolean;
  snapshotMatches: boolean;
  warnings: string[];
}> {
  const { profile, context } = await getActiveProfileWithContext();
  const warnings: string[] = [];

  if (!context) {
    return { valid: true, profileMatches: true, snapshotMatches: true, warnings };
  }

  // Check if profile still exists and matches
  const profileMatches = profile !== null && profile.name === context.profileName;
  if (!profileMatches) {
    warnings.push(`Active profile "${context.profileName}" no longer exists`);
  }

  // Check if workspace state matches snapshot
  let snapshotMatches = true;
  if (context.snapshot && context.validationHash) {
    try {
      const currentSnapshot = await captureWorkspaceSnapshot(process.cwd());
      const currentHash = generateValidationHash(currentSnapshot);
      snapshotMatches = currentHash === context.validationHash;

      if (!snapshotMatches) {
        warnings.push('Workspace state has changed since profile activation');
      }
    } catch (error) {
      // Cannot validate, assume matches
      snapshotMatches = true;
    }
  }

  const valid = profileMatches && snapshotMatches;

  return { valid, profileMatches, snapshotMatches, warnings };
}

/**
 * List all workspaces with active profiles
 */
export async function listProfileContexts(): Promise<Array<{
  workspacePath: string;
  profileName: string;
  activatedAt: number;
  validated: boolean;
}>> {
  const contexts: Array<{
    workspacePath: string;
    profileName: string;
    activatedAt: number;
    validated: boolean;
  }> = [];

  // Scan for .re-shell-profile indicator files
  const workspaceRoot = process.cwd();
  const profileIndicatorPath = path.join(workspaceRoot, '.re-shell-profile');

  if (await fs.pathExists(profileIndicatorPath)) {
    const profileName = await fs.readFile(profileIndicatorPath, 'utf8');
    const context = await loadProfileContext(workspaceRoot);

    contexts.push({
      workspacePath: workspaceRoot,
      profileName: profileName.trim(),
      activatedAt: context?.activatedAt || Date.now(),
      validated: context?.validated || false,
    });
  }

  return contexts;
}

/**
 * Capture workspace state snapshot
 */
async function captureWorkspaceSnapshot(
  workspacePath: string
): Promise<Record<string, any>> {
  const snapshot: Record<string, any> = {
    timestamp: Date.now(),
    files: {},
    env: {},
  };

  // Capture important files
  const filesToSnapshot = [
    'package.json',
    'tsconfig.json',
    '.env',
    're-shell.workspaces.yaml',
  ];

  for (const file of filesToSnapshot) {
    const filePath = path.join(workspacePath, file);
    if (await fs.pathExists(filePath)) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const stats = await fs.stat(filePath);
        snapshot.files[file] = {
          content,
          mtime: stats.mtimeMs,
          size: stats.size,
        };
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }

  // Capture environment variables (safe ones only)
  const safeEnvVars = [
    'NODE_ENV',
    'PORT',
    'BROWSER',
    'CI',
    'SKIP_PREFLIGHT_CHECK',
  ];

  safeEnvVars.forEach(varName => {
    if (process.env[varName]) {
      snapshot.env[varName] = process.env[varName];
    }
  });

  return snapshot;
}

/**
 * Restore workspace state from snapshot
 */
async function restoreWorkspaceSnapshot(
  workspacePath: string,
  snapshot: Record<string, any>
): Promise<void> {
  if (!snapshot.files) {
    return;
  }

  // Restore files if they don't exist or have changed
  for (const [fileName, fileData] of Object.entries(snapshot.files)) {
    const filePath = path.join(workspacePath, fileName);
    const data = fileData as any;

    try {
      if (!(await fs.pathExists(filePath))) {
        await fs.writeFile(filePath, data.content, 'utf8');
      } else {
        const stats = await fs.stat(filePath);
        if (stats.mtimeMs !== data.mtime || stats.size !== data.size) {
          // File has changed, create backup before restoring
          const backupPath = filePath + '.profile-backup';
          await fs.copy(filePath, backupPath);
          await fs.writeFile(filePath, data.content, 'utf8');
        }
      }
    } catch (error) {
      // Skip files that can't be restored
    }
  }
}

/**
 * Generate validation hash for snapshot
 */
function generateValidationHash(snapshot: Record<string, any>): string {
  // Simple hash based on file sizes and mtimes
  const hashData = Object.entries(snapshot.files || {})
    .map(([name, data]: [string, any]) => `${name}:${data.size}:${data.mtime}`)
    .join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < hashData.length; i++) {
    const char = hashData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return hash.toString(16);
}

/**
 * Cross-language profile validation
 * Validates profiles for different programming languages and frameworks
 */
export interface LanguageValidationRule {
  language: string;
  frameworks: string[];
  requiredFiles: string[];
  requiredDependencies?: string[];
  requiredConfigs?: string[];
  envPatterns?: Record<string, RegExp>;
}

const LANGUAGE_VALIDATION_RULES: LanguageValidationRule[] = [
  {
    language: 'javascript',
    frameworks: ['react', 'vue', 'svelte', 'express', 'nextjs', 'nuxt'],
    requiredFiles: ['package.json'],
    requiredConfigs: [],
    envPatterns: {
      'NODE_ENV': /^(development|staging|production|test)$/i,
    },
  },
  {
    language: 'typescript',
    frameworks: ['react', 'vue', 'svelte', 'express', 'nestjs', 'nextjs', 'nuxt'],
    requiredFiles: ['package.json', 'tsconfig.json'],
    requiredDependencies: ['typescript'],
    requiredConfigs: ['tsconfig.json'],
    envPatterns: {
      'NODE_ENV': /^(development|staging|production|test)$/i,
    },
  },
  {
    language: 'python',
    frameworks: ['fastapi', 'flask', 'django'],
    requiredFiles: ['requirements.txt', 'setup.py', 'pyproject.toml'],
    requiredConfigs: [],
    envPatterns: {
      'PYTHON_ENV': /^(development|staging|production|test)$/i,
      'FLASK_ENV': /^(development|staging|production|test)$/i,
    },
  },
  {
    language: 'java',
    frameworks: ['spring-boot', 'quarkus', 'micronaut'],
    requiredFiles: ['pom.xml', 'build.gradle'],
    requiredConfigs: [],
    envPatterns: {
      'SPRING_PROFILES_ACTIVE': /^(dev|staging|prod|test)$/i,
    },
  },
  {
    language: 'go',
    frameworks: ['gin', 'echo', 'fiber'],
    requiredFiles: ['go.mod'],
    requiredConfigs: [],
    envPatterns: {
      'GO_ENV': /^(development|staging|production|test)$/i,
    },
  },
  {
    language: 'rust',
    frameworks: ['actix', 'rocket', 'warp', 'axum'],
    requiredFiles: ['Cargo.toml'],
    requiredConfigs: [],
    envPatterns: {},
  },
  {
    language: 'csharp',
    frameworks: ['aspnet', 'dotnet'],
    requiredFiles: ['*.csproj', 'project.json'],
    requiredConfigs: [],
    envPatterns: {
      'ASPNETCORE_ENVIRONMENT': /^(Development|Staging|Production|Test)$/i,
    },
  },
];

/**
 * Validate profile for cross-language compatibility
 */
export async function validateProfileCrossLanguage(
  profileName: string
): Promise<{
  valid: boolean;
  language: string | null;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}> {
  const config = await loadProfileConfig();
  const profile = config.profiles[profileName];

  if (!profile) {
    return {
      valid: false,
      language: null,
      errors: [`Profile "${profileName}" not found`],
      warnings: [],
      suggestions: [],
    };
  }

  // Detect language from framework
  const language = detectLanguageFromFramework(profile.framework);
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Run basic inheritance validation first
  const inheritanceValidation = await validateProfileInheritance(profileName);
  if (!inheritanceValidation.valid) {
    errors.push(...inheritanceValidation.errors);
  }
  warnings.push(...inheritanceValidation.warnings);

  // Language-specific validation
  if (language) {
    const languageValidation = await validateProfileForLanguage(profile, language);
    errors.push(...languageValidation.errors);
    warnings.push(...languageValidation.warnings);
    suggestions.push(...languageValidation.suggestions);
  }

  // Cross-language conflict detection
  if (profile.extends && profile.extends.length > 0) {
    const conflicts = await detectCrossLanguageConflicts(profileName, config);
    warnings.push(...conflicts);
  }

  // Environment variable validation
  if (profile.config.env) {
    const envValidation = validateEnvironmentVariables(profile, language);
    errors.push(...envValidation.errors);
    warnings.push(...envValidation.warnings);
    suggestions.push(...envValidation.suggestions);
  }

  // Dependency validation
  if (profile.config.dependencies) {
    const depValidation = validateDependencies(profile, language);
    warnings.push(...depValidation.warnings);
    suggestions.push(...depValidation.suggestions);
  }

  return {
    valid: errors.length === 0,
    language,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Detect programming language from framework
 */
function detectLanguageFromFramework(framework?: string): string | null {
  if (!framework) {
    return null;
  }

  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    react: 'typescript',
    vue: 'typescript',
    svelte: 'typescript',
    nextjs: 'typescript',
    nuxt: 'typescript',
    express: 'javascript',
    nestjs: 'typescript',
    fastify: 'javascript',

    // Python
    fastapi: 'python',
    flask: 'python',
    django: 'python',

    // Java
    'spring-boot': 'java',
    quarkus: 'java',
    micronaut: 'java',
    vertx: 'java',

    // Go
    gin: 'go',
    echo: 'go',
    fiber: 'go',
    warp: 'go',

    // Rust
    actix: 'rust',
    rocket: 'rust',
    axum: 'rust',

    // C#
    aspnet: 'csharp',
    dotnet: 'csharp',
  };

  return languageMap[framework] || null;
}

/**
 * Validate profile for specific language
 */
async function validateProfileForLanguage(
  profile: EnvironmentProfile,
  language: string
): Promise<{
  errors: string[];
  warnings: string[];
  suggestions: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  const rule = LANGUAGE_VALIDATION_RULES.find(r => r.language === language);
  if (!rule) {
    warnings.push(`No validation rules available for language: ${language}`);
    return { errors, warnings, suggestions };
  }

  // Check required files exist in workspace
  const workspacePath = process.cwd();
  for (const file of rule.requiredFiles) {
    const filePath = path.join(workspacePath, file);
    if (!(await fs.pathExists(filePath))) {
      // Check for wildcard patterns
      if (file.includes('*')) {
        const glob = await import('glob');
        const matches = await glob.sync(file, { cwd: workspacePath });
        if (matches.length === 0) {
          errors.push(`Required file pattern not found: ${file}`);
        }
      } else {
        warnings.push(`Recommended file not found: ${file}`);
      }
    }
  }

  // Check required dependencies if package.json exists
  if (rule.requiredDependencies && rule.requiredDependencies.length > 0) {
    const packageJsonPath = path.join(workspacePath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      for (const dep of rule.requiredDependencies) {
        if (!dependencies[dep]) {
          warnings.push(`Recommended dependency not installed: ${dep}`);
          suggestions.push(`Install with: npm install ${dep}`);
        }
      }
    }
  }

  // Check framework-specific settings
  if (profile.framework) {
    const frameworkValidation = await validateFrameworkSettings(profile, language);
    errors.push(...frameworkValidation.errors);
    warnings.push(...frameworkValidation.warnings);
    suggestions.push(...frameworkValidation.suggestions);
  }

  return { errors, warnings, suggestions };
}

/**
 * Validate framework-specific settings
 */
async function validateFrameworkSettings(
  profile: EnvironmentProfile,
  language: string
): Promise<{
  errors: string[];
  warnings: string[];
  suggestions: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // TypeScript-specific validation
  if (language === 'typescript') {
    if (profile.config.build?.target) {
      const validTargets = ['es5', 'es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'esnext'];
      if (!validTargets.includes(profile.config.build.target)) {
        errors.push(`Invalid TypeScript build target: ${profile.config.build.target}`);
        suggestions.push(`Valid targets: ${validTargets.join(', ')}`);
      }
    }

    if (profile.config.build?.sourcemap === false && profile.environment === 'development') {
      warnings.push('Sourcemaps disabled in development - debugging may be difficult');
      suggestions.push('Enable sourcemaps for better debugging experience');
    }
  }

  // React-specific validation
  if (profile.framework === 'react' || profile.framework === 'nextjs') {
    if (profile.config.dev?.hmr === false && profile.environment === 'development') {
      warnings.push('Hot Module Replacement disabled - development experience will be slower');
      suggestions.push('Enable HMR for faster development');
    }

    if (profile.config.build?.minify === true && profile.environment === 'development') {
      warnings.push('Minification enabled in development - builds will be slower');
      suggestions.push('Disable minification in development for faster builds');
    }
  }

  // Backend framework validation
  if (['express', 'fastify', 'nestjs', 'gin', 'actix'].includes(profile.framework || '')) {
    if (!profile.config.dev?.port) {
      warnings.push('No development port specified');
      suggestions.push('Set a port to avoid port conflicts');
    }

    if (profile.config.dev?.cors === undefined && profile.environment === 'development') {
      suggestions.push('Consider configuring CORS for API development');
    }
  }

  return { errors, warnings, suggestions };
}

/**
 * Detect conflicts between profiles of different languages
 */
async function detectCrossLanguageConflicts(
  profileName: string,
  config: ProfileConfig
): Promise<string[]> {
  const conflicts: string[] = [];
  const profile = config.profiles[profileName];

  if (!profile || !profile.extends) {
    return conflicts;
  }

  const currentLanguage = detectLanguageFromFramework(profile.framework);

  for (const parentName of profile.extends) {
    const parent = config.profiles[parentName];
    if (!parent) {
      continue;
    }

    const parentLanguage = detectLanguageFromFramework(parent.framework);

    // Check for language mismatch
    if (currentLanguage && parentLanguage && currentLanguage !== parentLanguage) {
      conflicts.push(
        `Language mismatch: current profile is ${currentLanguage} but parent "${parentName}" is ${parentLanguage}`
      );
    }

    // Check for conflicting environment variables
    if (profile.config.env && parent.config.env) {
      for (const envVar of Object.keys(profile.config.env)) {
        if (parent.config.env[envVar] && profile.config.env[envVar] !== parent.config.env[envVar]) {
          conflicts.push(
            `Environment variable conflict: ${envVar} has different values in current profile and parent "${parentName}"`
          );
        }
      }
    }

    // Check for conflicting dependencies
    if (profile.config.dependencies && parent.config.dependencies) {
      for (const dep of Object.keys(profile.config.dependencies)) {
        if (parent.config.dependencies[dep] && parent.config.dependencies[dep] !== profile.config.dependencies[dep]) {
          conflicts.push(
            `Dependency version conflict: ${dep} has different versions in current profile and parent "${parentName}"`
          );
        }
      }
    }
  }

  return conflicts;
}

/**
 * Validate environment variables
 */
function validateEnvironmentVariables(
  profile: EnvironmentProfile,
  language: string | null
): {
  errors: string[];
  warnings: string[];
  suggestions: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (!profile.config.env) {
    return { errors, warnings, suggestions };
  }

  const rule = language
    ? LANGUAGE_VALIDATION_RULES.find(r => r.language === language)
    : null;

  // Validate environment variable patterns
  for (const [key, value] of Object.entries(profile.config.env)) {
    // Check for sensitive data in plain text
    if (key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('key') ||
        key.toLowerCase().includes('token')) {
      warnings.push(`Sensitive variable "${key}" stored in plain text`);
      suggestions.push(`Consider using encrypted secrets management for "${key}"`);
    }

    // Validate against language patterns
    if (rule && rule.envPatterns) {
      const pattern = Object.keys(rule.envPatterns).find(k => k.toUpperCase() === key.toUpperCase());
      if (pattern) {
        const regex = rule.envPatterns[pattern];
        if (regex && !regex.test(value)) {
          errors.push(`Invalid value for ${key}: "${value}" does not match pattern ${regex}`);
        }
      }
    }

    // Check for environment-specific values
    if (profile.environment === 'production') {
      if (key === 'NODE_ENV' && value !== 'production') {
        warnings.push(`NODE_ENV is "${value}" but profile environment is "production"`);
      }
    }
  }

  return { errors, warnings, suggestions };
}

/**
 * Validate dependencies
 */
function validateDependencies(
  profile: EnvironmentProfile,
  language: string | null
): {
  warnings: string[];
  suggestions: string[];
} {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (!profile.config.dependencies) {
    return { warnings, suggestions };
  }

  // Check for deprecated dependencies
  const deprecatedDeps: Record<string, string[]> = {
    javascript: ['bower', 'gulp', 'grunt'],
    typescript: ['babel-core', 'babel-preset-es2015'],
    python: ['imp', 'distutils'],
  };

  if (language && deprecatedDeps[language]) {
    for (const dep of Object.keys(profile.config.dependencies)) {
      if (deprecatedDeps[language].includes(dep.toLowerCase())) {
        warnings.push(`Deprecated dependency: ${dep}`);
        suggestions.push(`Consider removing or replacing ${dep}`);
      }
    }
  }

  return { warnings, suggestions };
}

/**
 * Validate all profiles for cross-language compatibility
 */
export async function validateAllProfiles(): Promise<{
  profiles: Record<string, {
    valid: boolean;
    language: string | null;
    errors: string[];
    warnings: string[];
    suggestions: string[];
  }>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    byLanguage: Record<string, number>;
  };
}> {
  const config = await loadProfileConfig();
  const profiles: Record<string, any> = {};
  const summary = {
    total: Object.keys(config.profiles).length,
    valid: 0,
    invalid: 0,
    byLanguage: {} as Record<string, number>,
  };

  for (const profileName of Object.keys(config.profiles)) {
    const validation = await validateProfileCrossLanguage(profileName);
    profiles[profileName] = validation;

    if (validation.valid) {
      summary.valid++;
    } else {
      summary.invalid++;
    }

    if (validation.language) {
      summary.byLanguage[validation.language] = (summary.byLanguage[validation.language] || 0) + 1;
    }
  }

  return { profiles, summary };
}

/**
 * Clone an existing profile with a new name
 */
export async function cloneProfile(
  sourceProfileName: string,
  newProfileName: string,
  options: {
    description?: string;
    modifyConfig?: Partial<EnvironmentProfile['config']>;
    extends?: string[];
    priority?: number;
  } = {}
): Promise<void> {
  const config = await loadProfileConfig();

  // Check if source profile exists
  if (!config.profiles[sourceProfileName]) {
    console.log(chalk.red(`\n✗ Source profile "${sourceProfileName}" not found\n`));
    console.log(chalk.gray('Run "re-shell profile list" to see available profiles\n'));
    return;
  }

  // Check if new profile already exists
  if (config.profiles[newProfileName]) {
    console.log(chalk.yellow(`\n⚠ Profile "${newProfileName}" already exists\n`));
    console.log(chalk.gray('Use --overwrite to replace it\n'));
    return;
  }

  // Clone the profile
  const sourceProfile = config.profiles[sourceProfileName];
  const clonedProfile: EnvironmentProfile = {
    ...JSON.parse(JSON.stringify(sourceProfile)), // Deep clone
    name: newProfileName,
    description: options.description || `Cloned from ${sourceProfileName}`,
  };

  // Apply modifications
  if (options.modifyConfig) {
    clonedProfile.config = deepMerge(clonedProfile.config, options.modifyConfig);
  }

  if (options.extends) {
    clonedProfile.extends = options.extends;
  }

  if (options.priority !== undefined) {
    clonedProfile.priority = options.priority;
  }

  // Save the cloned profile
  config.profiles[newProfileName] = clonedProfile;
  await saveProfileConfig(config);

  console.log(chalk.green(`\n✓ Profile "${newProfileName}" cloned from "${sourceProfileName}"\n`));
  console.log(chalk.gray(`Environment: ${clonedProfile.environment}`));
  if (clonedProfile.framework) {
    console.log(chalk.gray(`Framework: ${clonedProfile.framework}`));
  }
  if (clonedProfile.extends && clonedProfile.extends.length > 0) {
    console.log(chalk.gray(`Extends: ${clonedProfile.extends.join(', ')}`));
  }
  console.log(chalk.gray(`\nActivate with: re-shell profile activate ${newProfileName}\n`));
}

/**
 * Customize an existing profile
 */
export async function customizeProfile(
  profileName: string,
  options: {
    description?: string;
    framework?: string;
    environment?: 'development' | 'staging' | 'production' | 'custom';
    buildTarget?: string;
    buildOptimize?: boolean;
    buildSourcemap?: boolean;
    buildMinify?: boolean;
    devPort?: number;
    devHost?: string;
    devHmr?: boolean;
    devCors?: boolean;
    addEnv?: Record<string, string>;
    removeEnv?: string[];
    addScript?: Record<string, string>;
    addDependency?: Record<string, string>;
    extendAdd?: string[];
    extendRemove?: string[];
    priority?: number;
  } = {}
): Promise<void> {
  const config = await loadProfileConfig();

  // Check if profile exists
  if (!config.profiles[profileName]) {
    console.log(chalk.red(`\n✗ Profile "${profileName}" not found\n`));
    console.log(chalk.gray('Run "re-shell profile list" to see available profiles\n'));
    return;
  }

  const profile = config.profiles[profileName];
  const changes: string[] = [];

  // Update basic properties
  if (options.description !== undefined) {
    profile.description = options.description;
    changes.push('description');
  }

  if (options.framework !== undefined) {
    profile.framework = options.framework;
    changes.push('framework');
  }

  if (options.environment !== undefined) {
    profile.environment = options.environment;
    changes.push('environment');
  }

  // Update build config
  if (options.buildTarget !== undefined || options.buildOptimize !== undefined ||
      options.buildSourcemap !== undefined || options.buildMinify !== undefined) {
    if (!profile.config.build) {
      profile.config.build = {};
    }

    if (options.buildTarget !== undefined) {
      profile.config.build.target = options.buildTarget;
      changes.push(`build.target = ${options.buildTarget}`);
    }
    if (options.buildOptimize !== undefined) {
      profile.config.build.optimize = options.buildOptimize;
      changes.push(`build.optimize = ${options.buildOptimize}`);
    }
    if (options.buildSourcemap !== undefined) {
      profile.config.build.sourcemap = options.buildSourcemap;
      changes.push(`build.sourcemap = ${options.buildSourcemap}`);
    }
    if (options.buildMinify !== undefined) {
      profile.config.build.minify = options.buildMinify;
      changes.push(`build.minify = ${options.buildMinify}`);
    }
  }

  // Update dev config
  if (options.devPort !== undefined || options.devHost !== undefined ||
      options.devHmr !== undefined || options.devCors !== undefined) {
    if (!profile.config.dev) {
      profile.config.dev = {};
    }

    if (options.devPort !== undefined) {
      profile.config.dev.port = options.devPort;
      changes.push(`dev.port = ${options.devPort}`);
    }
    if (options.devHost !== undefined) {
      profile.config.dev.host = options.devHost;
      changes.push(`dev.host = ${options.devHost}`);
    }
    if (options.devHmr !== undefined) {
      profile.config.dev.hmr = options.devHmr;
      changes.push(`dev.hmr = ${options.devHmr}`);
    }
    if (options.devCors !== undefined) {
      profile.config.dev.cors = options.devCors;
      changes.push(`dev.cors = ${options.devCors}`);
    }
  }

  // Update environment variables
  if (options.addEnv) {
    if (!profile.config.env) {
      profile.config.env = {};
    }
    Object.assign(profile.config.env, options.addEnv);
    changes.push(`added env vars: ${Object.keys(options.addEnv).join(', ')}`);
  }

  if (options.removeEnv) {
    if (profile.config.env) {
      for (const key of options.removeEnv) {
        delete profile.config.env[key];
      }
      changes.push(`removed env vars: ${options.removeEnv.join(', ')}`);
    }
  }

  // Update scripts
  if (options.addScript) {
    if (!profile.config.scripts) {
      profile.config.scripts = {};
    }
    Object.assign(profile.config.scripts, options.addScript);
    changes.push(`added scripts: ${Object.keys(options.addScript).join(', ')}`);
  }

  // Update dependencies
  if (options.addDependency) {
    if (!profile.config.dependencies) {
      profile.config.dependencies = {};
    }
    Object.assign(profile.config.dependencies, options.addDependency);
    changes.push(`added dependencies: ${Object.keys(options.addDependency).join(', ')}`);
  }

  // Update extends
  if (options.extendAdd) {
    if (!profile.extends) {
      profile.extends = [];
    }
    for (const ext of options.extendAdd) {
      if (!profile.extends.includes(ext)) {
        profile.extends.push(ext);
      }
    }
    changes.push(`added extends: ${options.extendAdd.join(', ')}`);
  }

  if (options.extendRemove) {
    if (profile.extends) {
      profile.extends = profile.extends.filter(ext => !options.extendRemove!.includes(ext));
      changes.push(`removed extends: ${options.extendRemove.join(', ')}`);
    }
  }

  // Update priority
  if (options.priority !== undefined) {
    profile.priority = options.priority;
    changes.push(`priority = ${options.priority}`);
  }

  // Save the updated profile
  config.profiles[profileName] = profile;
  await saveProfileConfig(config);

  console.log(chalk.green(`\n✓ Profile "${profileName}" customized successfully\n`));
  console.log(chalk.cyan('Changes:'));
  for (const change of changes) {
    console.log(chalk.gray(`  • ${change}`));
  }
  console.log(chalk.gray(`\nView profile: re-shell profile show ${profileName}\n`));
}

/**
 * Interactive profile customization wizard
 */
export async function customizeProfileInteractive(profileName: string): Promise<void> {
  const config = await loadProfileConfig();

  if (!config.profiles[profileName]) {
    console.log(chalk.red(`\n✗ Profile "${profileName}" not found\n`));
    return;
  }

  const profile = config.profiles[profileName];

  console.log(chalk.cyan.bold(`\n🔧 Customizing Profile: ${profileName}\n`));
  console.log(chalk.gray(`Current environment: ${profile.environment}`));
  if (profile.framework) {
    console.log(chalk.gray(`Current framework: ${profile.framework}`));
  }
  console.log('');

  const responses = await prompts([
    {
      type: 'text',
      name: 'description',
      message: 'Description:',
      initial: profile.description,
    },
    {
      type: 'select',
      name: 'environment',
      message: 'Environment:',
      choices: [
        { title: 'Development', value: 'development' },
        { title: 'Staging', value: 'staging' },
        { title: 'Production', value: 'production' },
        { title: 'Custom', value: 'custom' },
      ],
      initial: ['development', 'staging', 'production', 'custom'].indexOf(profile.environment),
    },
    {
      type: 'number',
      name: 'port',
      message: 'Development server port:',
      initial: profile.config.dev?.port || 3000,
    },
    {
      type: 'confirm',
      name: 'hmr',
      message: 'Enable Hot Module Replacement:',
      initial: profile.config.dev?.hmr ?? true,
    },
    {
      type: 'confirm',
      name: 'optimize',
      message: 'Enable build optimization:',
      initial: profile.config.build?.optimize ?? false,
    },
    {
      type: 'confirm',
      name: 'sourcemap',
      message: 'Enable sourcemaps:',
      initial: profile.config.build?.sourcemap ?? true,
    },
    {
      type: 'confirm',
      name: 'minify',
      message: 'Minify output:',
      initial: profile.config.build?.minify ?? false,
    },
  ]);

  if (!responses.description && !responses.environment && responses.port === undefined) {
    console.log(chalk.yellow('\n⚠ No changes made\n'));
    return;
  }

  // Apply changes
  await customizeProfile(profileName, {
    description: responses.description,
    environment: responses.environment,
    devPort: responses.port,
    devHmr: responses.hmr,
    buildOptimize: responses.optimize,
    buildSourcemap: responses.sourcemap,
    buildMinify: responses.minify,
  });
}
