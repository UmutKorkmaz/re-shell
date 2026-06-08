import chalk from 'chalk';
import prompts from 'prompts';
import { configManager } from '../utils/config';
import { ProgressSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';

export interface ProjectConfigCommandOptions {
  show?: boolean;
  init?: boolean;
  get?: string;
  set?: string;
  value?: string;
  workspace?: string;
  framework?: string;
  packageManager?: string;
  interactive?: boolean;
  json?: boolean;
  verbose?: boolean;
  spinner?: ProgressSpinner;
}

export async function manageProjectConfig(options: ProjectConfigCommandOptions = {}): Promise<void> {
  const { spinner, verbose, json } = options;

  try {
    if (options.init) {
      await initializeProjectConfig(options, spinner);
      return;
    }

    if (options.get) {
      await getProjectConfigValue(options.get, options, spinner);
      return;
    }

    if (options.set && options.value) {
      await setProjectConfigValue(options.set, options.value, options, spinner);
      return;
    }

    if (options.interactive) {
      await interactiveProjectConfig(options, spinner);
      return;
    }

    // Default: show project configuration
    await showProjectConfiguration(options, spinner);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Project configuration operation failed'));
    throw error;
  }
}

async function initializeProjectConfig(options: ProjectConfigCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Initializing project configuration...');
  
  const existingConfig = await configManager.loadProjectConfig();
  if (existingConfig && !options.interactive) {
    if (spinner) spinner.stop();
    console.log(chalk.yellow('⚠️  Project configuration already exists. Use --interactive to modify.'));
    return;
  }

  const projectName = process.cwd().split('/').pop() || 'my-project';
  
  // Get global config for defaults
  const globalConfig = await configManager.loadGlobalConfig();
  
  const config = await configManager.createProjectConfig(
    projectName,
    {
      type: 'monorepo',
      packageManager: options.packageManager as any || globalConfig.packageManager,
      framework: options.framework || globalConfig.defaultFramework,
      template: globalConfig.defaultTemplate,
      workspaces: {
        root: '.',
        patterns: ['apps/*', 'packages/*', 'libs/*'],
        types: ['app', 'package', 'lib']
      }
    }
  );
  
  if (spinner) {
    spinner.succeed(chalk.green('Project configuration initialized!'));
  }
  
  console.log(chalk.cyan('\n📁 Project configuration created at: .re-shell/config.yaml'));
  console.log(chalk.gray('This configuration inherits from global settings and can be customized per project.'));
}

async function showProjectConfiguration(options: ProjectConfigCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Loading project configuration...');
  
  const config = await configManager.getMergedConfig();
  
  if (spinner) spinner.stop();

  if (!config.project) {
    console.log(chalk.yellow('⚠️  No project configuration found.'));
    console.log(chalk.gray('Run `re-shell project-config init` to create one.'));
    return;
  }

  if (options.json) {
    console.log(JSON.stringify({
      project: config.project,
      merged: config.merged,
      inheritedFrom: {
        packageManager: config.global.packageManager,
        framework: config.global.defaultFramework,
        template: config.global.defaultTemplate
      }
    }, null, 2));
  } else {
    console.log(chalk.cyan('\n🏗️  Project Configuration'));
    console.log(chalk.gray('═'.repeat(50)));
    
    console.log(chalk.cyan('\n📋 Project Settings:'));
    displayConfigSection(config.project);
    
    console.log(chalk.cyan('\n🔗 Inherited from Global:'));
    console.log(`  Package Manager: ${config.global.packageManager}`);
    console.log(`  Default Framework: ${config.global.defaultFramework}`);
    console.log(`  Default Template: ${config.global.defaultTemplate}`);
    
    if (options.verbose) {
      console.log(chalk.cyan('\n🔀 Merged Configuration:'));
      displayConfigSection(config.merged);
    }
  }
}

async function getProjectConfigValue(key: string, options: ProjectConfigCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Getting project configuration value: ${key}`);
  
  const config = await configManager.getMergedConfig();
  
  if (!config.project) {
    if (spinner) spinner.fail(chalk.red('No project configuration found'));
    return;
  }
  
  const value = getNestedValue(config.merged, key);
  
  if (spinner) spinner.stop();

  if (options.json) {
    console.log(JSON.stringify({ [key]: value }, null, 2));
  } else {
    if (value !== undefined) {
      console.log(chalk.cyan(`${key}:`), value);
      
      // Show if value is inherited
      const projectValue = getNestedValue(config.project, key);
      if (projectValue === undefined && value !== undefined) {
        console.log(chalk.gray('(inherited from global configuration)'));
      }
    } else {
      console.log(chalk.yellow(`Configuration key '${key}' not found`));
    }
  }
}

async function setProjectConfigValue(key: string, value: string, options: ProjectConfigCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Setting project configuration value: ${key} = ${value}`);
  
  const projectConfig = await configManager.loadProjectConfig();
  if (!projectConfig) {
    throw new ValidationError('No project configuration found. Run `re-shell project-config init` first.');
  }

  // Parse value
  let parsedValue: any;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    parsedValue = value;
  }

  setNestedValue(projectConfig, key, parsedValue);
  await configManager.saveProjectConfig(projectConfig);
  
  if (spinner) {
    spinner.succeed(chalk.green(`Project configuration updated: ${key} = ${value}`));
  }
}

async function interactiveProjectConfig(options: ProjectConfigCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const config = await configManager.getMergedConfig();
  const hasProject = !!config.project;

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        !hasProject ? { title: '🆕 Initialize Project Configuration', value: 'init' } : null,
        hasProject ? { title: '📋 View Configuration', value: 'view' } : null,
        hasProject ? { title: '✏️  Edit Configuration', value: 'edit' } : null,
        hasProject ? { title: '🏢 Configure Workspaces', value: 'workspaces' } : null,
        hasProject ? { title: '🌍 Configure Environments', value: 'environments' } : null,
        hasProject ? { title: '🔧 Advanced Settings', value: 'advanced' } : null
      ].filter((choice): choice is { title: string; value: string } => choice !== null)
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'init':
      await interactiveInitProjectConfig();
      break;
    case 'view':
      await showProjectConfiguration(options);
      break;
    case 'edit':
      await interactiveEditProjectConfig();
      break;
    case 'workspaces':
      await interactiveWorkspaceConfig();
      break;
    case 'environments':
      await interactiveEnvironmentConfig();
      break;
    case 'advanced':
      await interactiveAdvancedProjectConfig();
      break;
  }
}

async function interactiveInitProjectConfig(): Promise<void> {
  const globalConfig = await configManager.loadGlobalConfig();
  const projectName = process.cwd().split('/').pop() || 'my-project';

  const response = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'Project name:',
      initial: projectName,
      validate: (value: string) => {
        if (!value.trim()) return 'Project name is required';
        if (!/^[a-z0-9-]+$/.test(value)) return 'Use lowercase letters, numbers, and hyphens only';
        return true;
      }
    },
    {
      type: 'select',
      name: 'type',
      message: 'Project type:',
      choices: [
        { title: 'Monorepo (multiple apps/packages)', value: 'monorepo' },
        { title: 'Standalone (single app)', value: 'standalone' }
      ]
    },
    {
      type: 'select',
      name: 'packageManager',
      message: 'Package manager:',
      choices: [
        { title: 'pnpm (recommended)', value: 'pnpm' },
        { title: 'npm', value: 'npm' },
        { title: 'yarn', value: 'yarn' },
        { title: 'bun', value: 'bun' }
      ],
      initial: ['pnpm', 'npm', 'yarn', 'bun'].indexOf(globalConfig.packageManager)
    },
    {
      type: 'select',
      name: 'framework',
      message: 'Default framework:',
      choices: [
        { title: 'React with TypeScript', value: 'react-ts' },
        { title: 'React', value: 'react' },
        { title: 'Vue with TypeScript', value: 'vue-ts' },
        { title: 'Vue', value: 'vue' },
        { title: 'Svelte with TypeScript', value: 'svelte-ts' },
        { title: 'Svelte', value: 'svelte' }
      ]
    },
    {
      type: 'confirm',
      name: 'git',
      message: 'Enable Git integration?',
      initial: true
    }
  ]);

  if (!response.name) return;

  await configManager.createProjectConfig(response.name, {
    type: response.type,
    packageManager: response.packageManager,
    framework: response.framework,
    template: 'blank',
    git: {
      submodules: response.git,
      hooks: response.git,
      conventionalCommits: true
    }
  });

  console.log(chalk.green('✅ Project configuration created successfully!'));
}

async function interactiveEditProjectConfig(): Promise<void> {
  const projectConfig = await configManager.loadProjectConfig();
  if (!projectConfig) return;

  const response = await prompts([
    {
      type: 'select',
      name: 'field',
      message: 'What would you like to edit?',
      choices: [
        { title: 'Project name', value: 'name' },
        { title: 'Package manager', value: 'packageManager' },
        { title: 'Default framework', value: 'framework' },
        { title: 'Development settings', value: 'dev' },
        { title: 'Build settings', value: 'build' },
        { title: 'Quality settings', value: 'quality' }
      ]
    }
  ]);

  if (!response.field) return;

  // Handle different field types
  switch (response.field) {
    case 'dev':
      await editDevSettings(projectConfig);
      break;
    case 'build':
      await editBuildSettings(projectConfig);
      break;
    case 'quality':
      await editQualitySettings(projectConfig);
      break;
    default:
      {
      // Simple field edit
      const fieldResponse = await prompts([
        {
          type: response.field === 'packageManager' ? 'select' : 'text',
          name: 'value',
          message: `New ${response.field}:`,
          initial: projectConfig[response.field as keyof typeof projectConfig] as any,
          choices: response.field === 'packageManager' ? [
            { title: 'pnpm', value: 'pnpm' },
            { title: 'npm', value: 'npm' },
            { title: 'yarn', value: 'yarn' },
            { title: 'bun', value: 'bun' }
          ] : undefined
        }
      ]);

      if (fieldResponse.value) {
        (projectConfig as any)[response.field] = fieldResponse.value;
        await configManager.saveProjectConfig(projectConfig);
        console.log(chalk.green(`✅ Updated ${response.field} to: ${fieldResponse.value}`));
      }
      }
  }
}

async function editDevSettings(projectConfig: any): Promise<void> {
  const response = await prompts([
    {
      type: 'number',
      name: 'port',
      message: 'Development server port:',
      initial: projectConfig.dev?.port || 3000,
      validate: (value: number) => value > 0 && value < 65536 ? true : 'Invalid port number'
    },
    {
      type: 'text',
      name: 'host',
      message: 'Development server host:',
      initial: projectConfig.dev?.host || 'localhost'
    },
    {
      type: 'toggle',
      name: 'hmr',
      message: 'Enable Hot Module Replacement?',
      initial: projectConfig.dev?.hmr !== false,
      active: 'yes',
      inactive: 'no'
    }
  ]);

  if (Object.keys(response).length > 0) {
    projectConfig.dev = { ...projectConfig.dev, ...response };
    await configManager.saveProjectConfig(projectConfig);
    console.log(chalk.green('✅ Development settings updated!'));
  }
}

async function editBuildSettings(projectConfig: any): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'target',
      message: 'Build target:',
      initial: projectConfig.build?.target || 'es2020'
    },
    {
      type: 'toggle',
      name: 'optimize',
      message: 'Enable optimization?',
      initial: projectConfig.build?.optimize !== false,
      active: 'yes',
      inactive: 'no'
    },
    {
      type: 'toggle',
      name: 'analyze',
      message: 'Enable bundle analysis?',
      initial: projectConfig.build?.analyze || false,
      active: 'yes',
      inactive: 'no'
    }
  ]);

  if (Object.keys(response).length > 0) {
    projectConfig.build = { ...projectConfig.build, ...response };
    await configManager.saveProjectConfig(projectConfig);
    console.log(chalk.green('✅ Build settings updated!'));
  }
}

async function editQualitySettings(projectConfig: any): Promise<void> {
  const response = await prompts([
    {
      type: 'toggle',
      name: 'linting',
      message: 'Enable linting?',
      initial: projectConfig.quality?.linting !== false,
      active: 'yes',
      inactive: 'no'
    },
    {
      type: 'toggle',
      name: 'testing',
      message: 'Enable testing?',
      initial: projectConfig.quality?.testing !== false,
      active: 'yes',
      inactive: 'no'
    },
    {
      type: 'number',
      name: 'coverageThreshold',
      message: 'Code coverage threshold (%):',
      initial: projectConfig.quality?.coverage?.threshold || 80,
      validate: (value: number) => value >= 0 && value <= 100 ? true : 'Must be between 0 and 100'
    }
  ]);

  if (Object.keys(response).length > 0) {
    projectConfig.quality = {
      ...projectConfig.quality,
      linting: response.linting,
      testing: response.testing,
      coverage: {
        enabled: true,
        threshold: response.coverageThreshold
      }
    };
    await configManager.saveProjectConfig(projectConfig);
    console.log(chalk.green('✅ Quality settings updated!'));
  }
}

async function interactiveWorkspaceConfig(): Promise<void> {
  console.log(chalk.cyan('🏢 Workspace configuration coming soon...'));
}

async function interactiveEnvironmentConfig(): Promise<void> {
  console.log(chalk.cyan('🌍 Environment configuration interface coming soon...'));
  console.log(chalk.gray('Use `re-shell env` commands for now.'));
}

async function interactiveAdvancedProjectConfig(): Promise<void> {
  console.log(chalk.cyan('🔧 Advanced project configuration coming soon...'));
}

// Utility functions
function displayConfigSection(config: any, indent = 0): void {
  const prefix = '  '.repeat(indent);
  
  for (const [key, value] of Object.entries(config)) {
    if (value === null || value === undefined) continue;
    
    if (typeof value === 'object' && !Array.isArray(value)) {
      console.log(`${prefix}${chalk.cyan(key)}:`);
      displayConfigSection(value, indent + 1);
    } else if (Array.isArray(value)) {
      console.log(`${prefix}${chalk.cyan(key)}: ${chalk.dim(`[${value.join(', ')}]`)}`);
    } else {
      console.log(`${prefix}${chalk.cyan(key)}: ${value}`);
    }
  }
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!(key in current)) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}