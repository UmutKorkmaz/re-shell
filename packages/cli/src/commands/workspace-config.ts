import chalk from 'chalk';
import prompts from 'prompts';
import * as path from 'path';
import { configManager, WorkspaceConfig } from '../utils/config';
import { ProgressSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';

export interface WorkspaceConfigCommandOptions {
  show?: boolean;
  init?: boolean;
  get?: string;
  set?: string;
  value?: string;
  workspace?: string;
  type?: 'app' | 'package' | 'lib' | 'tool';
  framework?: string;
  packageManager?: string;
  interactive?: boolean;
  json?: boolean;
  verbose?: boolean;
  spinner?: ProgressSpinner;
}

export async function manageWorkspaceConfig(options: WorkspaceConfigCommandOptions = {}): Promise<void> {
  const { spinner, verbose, json } = options;

  try {
    // Determine workspace path
    const workspacePath = options.workspace || process.cwd();
    
    if (options.init) {
      await initializeWorkspaceConfig(workspacePath, options, spinner);
      return;
    }

    if (options.get) {
      await getWorkspaceConfigValue(workspacePath, options.get, options, spinner);
      return;
    }

    if (options.set && options.value) {
      await setWorkspaceConfigValue(workspacePath, options.set, options.value, options, spinner);
      return;
    }

    if (options.interactive) {
      await interactiveWorkspaceConfig(workspacePath, options, spinner);
      return;
    }

    // Default: show workspace configuration
    await showWorkspaceConfiguration(workspacePath, options, spinner);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Workspace configuration operation failed'));
    throw error;
  }
}

async function initializeWorkspaceConfig(
  workspacePath: string, 
  options: WorkspaceConfigCommandOptions, 
  spinner?: ProgressSpinner
): Promise<void> {
  if (spinner) spinner.setText('Initializing workspace configuration...');
  
  const existingConfig = await configManager.loadWorkspaceConfig(workspacePath);
  if (existingConfig && !options.interactive) {
    if (spinner) spinner.stop();
    console.log(chalk.yellow('⚠️  Workspace configuration already exists. Use --interactive to modify.'));
    return;
  }

  const workspaceName = path.basename(workspacePath);
  const workspaceType = options.type || 'app';
  
  // Get project and global config for defaults
  const mergedConfig = await configManager.getMergedConfig();
  
  const config = await configManager.createWorkspaceConfig(
    workspaceName,
    workspaceType,
    {
      framework: options.framework || mergedConfig.merged.framework,
      packageManager: options.packageManager as any || mergedConfig.merged.packageManager,
      build: {
        target: 'es2020',
        optimize: true,
        analyze: false
      },
      dev: {
        port: 3000,
        host: 'localhost',
        open: false,
        hmr: true
      },
      quality: {
        linting: true,
        testing: true,
        coverage: {
          enabled: true,
          threshold: 80
        }
      }
    },
    workspacePath
  );
  
  if (spinner) {
    spinner.succeed(chalk.green('Workspace configuration initialized!'));
  }
  
  console.log(chalk.cyan(`\n📁 Workspace configuration created at: ${workspacePath}/.re-shell/workspace.yaml`));
  console.log(chalk.gray('This configuration inherits from project and global settings.'));
}

async function showWorkspaceConfiguration(
  workspacePath: string, 
  options: WorkspaceConfigCommandOptions, 
  spinner?: ProgressSpinner
): Promise<void> {
  if (spinner) spinner.setText('Loading workspace configuration...');
  
  const config = await configManager.getMergedWorkspaceConfig(workspacePath);
  
  if (spinner) spinner.stop();

  if (!config.workspace) {
    console.log(chalk.yellow('⚠️  No workspace configuration found.'));
    console.log(chalk.gray(`Run \`re-shell workspace-config init --workspace ${workspacePath}\` to create one.`));
    return;
  }

  if (options.json) {
    console.log(JSON.stringify({
      workspace: config.workspace,
      merged: config.merged,
      inheritedFrom: {
        global: {
          packageManager: config.global.packageManager,
          framework: config.global.defaultFramework,
          template: config.global.defaultTemplate
        },
        project: config.project ? {
          packageManager: config.project.packageManager,
          framework: config.project.framework,
          template: config.project.template
        } : null
      }
    }, null, 2));
  } else {
    const workspaceName = path.basename(workspacePath);
    console.log(chalk.cyan(`\n🏗️  Workspace Configuration: ${workspaceName}`));
    console.log(chalk.gray('═'.repeat(50)));
    
    console.log(chalk.cyan('\n📋 Workspace Settings:'));
    displayConfigSection(config.workspace);
    
    console.log(chalk.cyan('\n🔗 Inherited from Project:'));
    if (config.project) {
      console.log(`  Package Manager: ${config.project.packageManager}`);
      console.log(`  Framework: ${config.project.framework}`);
      console.log(`  Template: ${config.project.template}`);
    } else {
      console.log(chalk.gray('  No project configuration found'));
    }
    
    console.log(chalk.cyan('\n🌍 Inherited from Global:'));
    console.log(`  Package Manager: ${config.global.packageManager}`);
    console.log(`  Default Framework: ${config.global.defaultFramework}`);
    console.log(`  Default Template: ${config.global.defaultTemplate}`);
    
    if (options.verbose) {
      console.log(chalk.cyan('\n🔀 Final Merged Configuration:'));
      displayConfigSection(config.merged);
    }
  }
}

async function getWorkspaceConfigValue(
  workspacePath: string, 
  key: string, 
  options: WorkspaceConfigCommandOptions, 
  spinner?: ProgressSpinner
): Promise<void> {
  if (spinner) spinner.setText(`Getting workspace configuration value: ${key}`);
  
  const config = await configManager.getMergedWorkspaceConfig(workspacePath);
  
  if (!config.workspace) {
    if (spinner) spinner.fail(chalk.red('No workspace configuration found'));
    return;
  }
  
  const value = getNestedValue(config.merged, key);
  
  if (spinner) spinner.stop();

  if (options.json) {
    console.log(JSON.stringify({ [key]: value }, null, 2));
  } else {
    if (value !== undefined) {
      console.log(chalk.cyan(`${key}:`), value);
      
      // Show inheritance hierarchy
      const workspaceValue = getNestedValue(config.workspace, key);
      const projectValue = config.project ? getNestedValue(config.project, key) : undefined;
      const globalValue = getNestedValue(config.global, key);
      
      if (workspaceValue !== undefined) {
        console.log(chalk.gray('(from workspace configuration)'));
      } else if (projectValue !== undefined) {
        console.log(chalk.gray('(inherited from project configuration)'));
      } else if (globalValue !== undefined) {
        console.log(chalk.gray('(inherited from global configuration)'));
      }
    } else {
      console.log(chalk.yellow(`Configuration key '${key}' not found`));
    }
  }
}

async function setWorkspaceConfigValue(
  workspacePath: string, 
  key: string, 
  value: string, 
  options: WorkspaceConfigCommandOptions, 
  spinner?: ProgressSpinner
): Promise<void> {
  if (spinner) spinner.setText(`Setting workspace configuration value: ${key} = ${value}`);
  
  const workspaceConfig = await configManager.loadWorkspaceConfig(workspacePath);
  if (!workspaceConfig) {
    throw new ValidationError(`No workspace configuration found. Run \`re-shell workspace-config init --workspace ${workspacePath}\` first.`);
  }

  // Parse value
  let parsedValue: any;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    parsedValue = value;
  }

  setNestedValue(workspaceConfig, key, parsedValue);
  await configManager.saveWorkspaceConfig(workspaceConfig, workspacePath);
  
  if (spinner) {
    spinner.succeed(chalk.green(`Workspace configuration updated: ${key} = ${value}`));
  }
}

async function interactiveWorkspaceConfig(
  workspacePath: string, 
  options: WorkspaceConfigCommandOptions, 
  spinner?: ProgressSpinner
): Promise<void> {
  if (spinner) spinner.stop();

  const config = await configManager.getMergedWorkspaceConfig(workspacePath);
  const hasWorkspace = !!config.workspace;
  const workspaceName = path.basename(workspacePath);

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: `What would you like to do with workspace "${workspaceName}"?`,
      choices: [
        !hasWorkspace ? { title: '🆕 Initialize Workspace Configuration', value: 'init' } : null,
        hasWorkspace ? { title: '📋 View Configuration', value: 'view' } : null,
        hasWorkspace ? { title: '✏️  Edit Configuration', value: 'edit' } : null,
        hasWorkspace ? { title: '🚀 Configure Build Settings', value: 'build' } : null,
        hasWorkspace ? { title: '🛠️  Configure Development Settings', value: 'dev' } : null,
        hasWorkspace ? { title: '🔍 Configure Quality Settings', value: 'quality' } : null,
        hasWorkspace ? { title: '🔗 View Inheritance Chain', value: 'inheritance' } : null
      ].filter((choice): choice is { title: string; value: string } => choice !== null)
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'init':
      await interactiveInitWorkspaceConfig(workspacePath);
      break;
    case 'view':
      await showWorkspaceConfiguration(workspacePath, options);
      break;
    case 'edit':
      await interactiveEditWorkspaceConfig(workspacePath);
      break;
    case 'build':
      await interactiveBuildConfig(workspacePath);
      break;
    case 'dev':
      await interactiveDevConfig(workspacePath);
      break;
    case 'quality':
      await interactiveQualityConfig(workspacePath);
      break;
    case 'inheritance':
      await showInheritanceChain(workspacePath);
      break;
  }
}

async function interactiveInitWorkspaceConfig(workspacePath: string): Promise<void> {
  const workspaceName = path.basename(workspacePath);
  const mergedConfig = await configManager.getMergedConfig();

  const response = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'Workspace name:',
      initial: workspaceName,
      validate: (value: string) => {
        if (!value.trim()) return 'Workspace name is required';
        if (!/^[a-z0-9-]+$/.test(value)) return 'Use lowercase letters, numbers, and hyphens only';
        return true;
      }
    },
    {
      type: 'select',
      name: 'type',
      message: 'Workspace type:',
      choices: [
        { title: 'Application (app)', value: 'app' },
        { title: 'Package/Library (package)', value: 'package' },
        { title: 'Shared Library (lib)', value: 'lib' },
        { title: 'Build Tool (tool)', value: 'tool' }
      ]
    },
    {
      type: 'select',
      name: 'framework',
      message: 'Framework (can inherit from project):',
      choices: [
        { title: `Inherit from project (${mergedConfig.merged.framework})`, value: '' },
        { title: 'React with TypeScript', value: 'react-ts' },
        { title: 'React', value: 'react' },
        { title: 'Vue with TypeScript', value: 'vue-ts' },
        { title: 'Vue', value: 'vue' },
        { title: 'Svelte with TypeScript', value: 'svelte-ts' },
        { title: 'Svelte', value: 'svelte' },
        { title: 'None (plain JS/TS)', value: 'none' }
      ]
    },
    {
      type: 'select',
      name: 'packageManager',
      message: 'Package manager (can inherit from project):',
      choices: [
        { title: `Inherit from project (${mergedConfig.merged.packageManager})`, value: '' },
        { title: 'pnpm', value: 'pnpm' },
        { title: 'npm', value: 'npm' },
        { title: 'yarn', value: 'yarn' },
        { title: 'bun', value: 'bun' }
      ]
    }
  ]);

  if (!response.name) return;

  const configOptions: Partial<WorkspaceConfig> = {};
  if (response.framework) configOptions.framework = response.framework;
  if (response.packageManager) configOptions.packageManager = response.packageManager;

  await configManager.createWorkspaceConfig(
    response.name, 
    response.type, 
    configOptions, 
    workspacePath
  );

  console.log(chalk.green('✅ Workspace configuration created successfully!'));
}

async function interactiveEditWorkspaceConfig(workspacePath: string): Promise<void> {
  const workspaceConfig = await configManager.loadWorkspaceConfig(workspacePath);
  if (!workspaceConfig) return;

  const response = await prompts([
    {
      type: 'select',
      name: 'field',
      message: 'What would you like to edit?',
      choices: [
        { title: 'Workspace name', value: 'name' },
        { title: 'Workspace type', value: 'type' },
        { title: 'Framework', value: 'framework' },
        { title: 'Package manager', value: 'packageManager' },
        { title: 'Dependencies', value: 'dependencies' },
        { title: 'Dev dependencies', value: 'devDependencies' }
      ]
    }
  ]);

  if (!response.field) return;

  // Handle field editing based on type
  const fieldResponse = await prompts([
    {
      type: response.field === 'type' ? 'select' : 
           response.field === 'packageManager' ? 'select' :
           response.field === 'framework' ? 'select' :
           ['dependencies', 'devDependencies'].includes(response.field) ? 'list' : 'text',
      name: 'value',
      message: `New ${response.field}:`,
      initial: Array.isArray(workspaceConfig[response.field as keyof WorkspaceConfig]) 
        ? (workspaceConfig[response.field as keyof WorkspaceConfig] as string[])?.join(', ')
        : workspaceConfig[response.field as keyof WorkspaceConfig] as string,
      choices: response.field === 'type' ? [
        { title: 'Application', value: 'app' },
        { title: 'Package', value: 'package' },
        { title: 'Library', value: 'lib' },
        { title: 'Tool', value: 'tool' }
      ] : response.field === 'packageManager' ? [
        { title: 'pnpm', value: 'pnpm' },
        { title: 'npm', value: 'npm' },
        { title: 'yarn', value: 'yarn' },
        { title: 'bun', value: 'bun' }
      ] : response.field === 'framework' ? [
        { title: 'React with TypeScript', value: 'react-ts' },
        { title: 'React', value: 'react' },
        { title: 'Vue with TypeScript', value: 'vue-ts' },
        { title: 'Vue', value: 'vue' },
        { title: 'Svelte with TypeScript', value: 'svelte-ts' },
        { title: 'Svelte', value: 'svelte' },
        { title: 'None', value: 'none' }
      ] : undefined
    }
  ]);

  if (fieldResponse.value !== undefined) {
    if (['dependencies', 'devDependencies'].includes(response.field)) {
      (workspaceConfig as any)[response.field] = fieldResponse.value;
    } else {
      (workspaceConfig as any)[response.field] = fieldResponse.value;
    }
    
    await configManager.saveWorkspaceConfig(workspaceConfig, workspacePath);
    console.log(chalk.green(`✅ Updated ${response.field}`));
  }
}

async function interactiveBuildConfig(workspacePath: string): Promise<void> {
  const workspaceConfig = await configManager.loadWorkspaceConfig(workspacePath);
  if (!workspaceConfig) return;

  const response = await prompts([
    {
      type: 'text',
      name: 'target',
      message: 'Build target:',
      initial: workspaceConfig.build?.target || 'es2020'
    },
    {
      type: 'toggle',
      name: 'optimize',
      message: 'Enable optimization?',
      initial: workspaceConfig.build?.optimize !== false,
      active: 'yes',
      inactive: 'no'
    },
    {
      type: 'toggle',
      name: 'analyze',
      message: 'Enable bundle analysis?',
      initial: workspaceConfig.build?.analyze || false,
      active: 'yes',
      inactive: 'no'
    },
    {
      type: 'text',
      name: 'outDir',
      message: 'Output directory:',
      initial: workspaceConfig.build?.outDir || 'dist'
    }
  ]);

  if (Object.keys(response).length > 0) {
    workspaceConfig.build = { ...workspaceConfig.build, ...response };
    await configManager.saveWorkspaceConfig(workspaceConfig, workspacePath);
    console.log(chalk.green('✅ Build settings updated!'));
  }
}

async function interactiveDevConfig(workspacePath: string): Promise<void> {
  const workspaceConfig = await configManager.loadWorkspaceConfig(workspacePath);
  if (!workspaceConfig) return;

  const response = await prompts([
    {
      type: 'number',
      name: 'port',
      message: 'Development server port:',
      initial: workspaceConfig.dev?.port || 3000,
      validate: (value: number) => value > 0 && value < 65536 ? true : 'Invalid port number'
    },
    {
      type: 'text',
      name: 'host',
      message: 'Development server host:',
      initial: workspaceConfig.dev?.host || 'localhost'
    },
    {
      type: 'toggle',
      name: 'hmr',
      message: 'Enable Hot Module Replacement?',
      initial: workspaceConfig.dev?.hmr !== false,
      active: 'yes',
      inactive: 'no'
    },
    {
      type: 'toggle',
      name: 'open',
      message: 'Open browser automatically?',
      initial: workspaceConfig.dev?.open || false,
      active: 'yes',
      inactive: 'no'
    }
  ]);

  if (Object.keys(response).length > 0) {
    workspaceConfig.dev = { ...workspaceConfig.dev, ...response };
    await configManager.saveWorkspaceConfig(workspaceConfig, workspacePath);
    console.log(chalk.green('✅ Development settings updated!'));
  }
}

async function interactiveQualityConfig(workspacePath: string): Promise<void> {
  const workspaceConfig = await configManager.loadWorkspaceConfig(workspacePath);
  if (!workspaceConfig) return;

  const response = await prompts([
    {
      type: 'toggle',
      name: 'linting',
      message: 'Enable linting?',
      initial: workspaceConfig.quality?.linting !== false,
      active: 'yes',
      inactive: 'no'
    },
    {
      type: 'toggle',
      name: 'testing',
      message: 'Enable testing?',
      initial: workspaceConfig.quality?.testing !== false,
      active: 'yes',
      inactive: 'no'
    },
    {
      type: 'number',
      name: 'coverageThreshold',
      message: 'Code coverage threshold (%):',
      initial: workspaceConfig.quality?.coverage?.threshold || 80,
      validate: (value: number) => value >= 0 && value <= 100 ? true : 'Must be between 0 and 100'
    }
  ]);

  if (Object.keys(response).length > 0) {
    workspaceConfig.quality = {
      ...workspaceConfig.quality,
      linting: response.linting,
      testing: response.testing,
      coverage: {
        enabled: true,
        threshold: response.coverageThreshold
      }
    };
    await configManager.saveWorkspaceConfig(workspaceConfig, workspacePath);
    console.log(chalk.green('✅ Quality settings updated!'));
  }
}

async function showInheritanceChain(workspacePath: string): Promise<void> {
  const config = await configManager.getMergedWorkspaceConfig(workspacePath);
  const workspaceName = path.basename(workspacePath);

  console.log(chalk.cyan(`\n🔗 Configuration Inheritance Chain for "${workspaceName}"`));
  console.log(chalk.gray('═'.repeat(60)));

  console.log(chalk.blue('\n1. 🌍 Global Configuration:'));
  console.log(`   Package Manager: ${config.global.packageManager}`);
  console.log(`   Default Framework: ${config.global.defaultFramework}`);
  console.log(`   Default Template: ${config.global.defaultTemplate}`);

  if (config.project) {
    console.log(chalk.green('\n2. 📁 Project Configuration:'));
    console.log(`   Package Manager: ${config.project.packageManager} ${config.project.packageManager !== config.global.packageManager ? '(overrides global)' : '(inherits global)'}`);
    console.log(`   Framework: ${config.project.framework} ${config.project.framework !== config.global.defaultFramework ? '(overrides global)' : '(inherits global)'}`);
    console.log(`   Template: ${config.project.template} ${config.project.template !== config.global.defaultTemplate ? '(overrides global)' : '(inherits global)'}`);
  }

  if (config.workspace) {
    console.log(chalk.yellow('\n3. 🏗️  Workspace Configuration:'));
    console.log(`   Name: ${config.workspace.name}`);
    console.log(`   Type: ${config.workspace.type}`);
    if (config.workspace.packageManager) {
      console.log(`   Package Manager: ${config.workspace.packageManager} (overrides project/global)`);
    }
    if (config.workspace.framework) {
      console.log(`   Framework: ${config.workspace.framework} (overrides project/global)`);
    }
  }

  console.log(chalk.magenta('\n4. 🔀 Final Merged Configuration:'));
  console.log(`   Package Manager: ${config.merged.packageManager}`);
  console.log(`   Framework: ${config.merged.framework}`);
  console.log(`   Template: ${config.merged.template}`);
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