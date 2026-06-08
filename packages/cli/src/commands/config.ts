import chalk from 'chalk';
import prompts from 'prompts';
import { configManager, GlobalConfig, ProjectConfig, ProjectPreset } from '../utils/config';
import { ProgressSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';

export interface ConfigCommandOptions {
  global?: boolean;
  project?: boolean;
  list?: boolean;
  get?: string;
  set?: string;
  value?: string;
  preset?: string;
  save?: string;
  load?: string;
  delete?: string;
  backup?: boolean;
  restore?: string;
  interactive?: boolean;
  json?: boolean;
  verbose?: boolean;
  spinner?: ProgressSpinner;
}

export async function manageConfig(options: ConfigCommandOptions = {}): Promise<void> {
  const { spinner, verbose, json } = options;

  try {
    if (options.backup) {
      await backupConfiguration(spinner);
      return;
    }

    if (options.restore) {
      await restoreConfiguration(options.restore, spinner);
      return;
    }

    if (options.list) {
      await listConfiguration(options, spinner);
      return;
    }

    if (options.get) {
      await getConfigValue(options.get, options, spinner);
      return;
    }

    if (options.set && options.value) {
      await setConfigValue(options.set, options.value, options, spinner);
      return;
    }

    if (options.save) {
      await savePreset(options.save, options, spinner);
      return;
    }

    if (options.load) {
      await loadPreset(options.load, options, spinner);
      return;
    }

    if (options.delete) {
      await deletePreset(options.delete, options, spinner);
      return;
    }

    if (options.interactive) {
      await interactiveConfig(options, spinner);
      return;
    }

    // Default: show current configuration
    await showConfiguration(options, spinner);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Configuration operation failed'));
    throw error;
  }
}

async function backupConfiguration(spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Creating configuration backup...');
  
  const backupPath = await configManager.backupConfig();
  
  if (spinner) {
    spinner.succeed(chalk.green('Configuration backed up successfully!'));
  }
  
  console.log(chalk.cyan(`Backup saved to: ${backupPath}`));
}

async function restoreConfiguration(backupPath: string, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Restoring configuration from ${backupPath}...`);
  
  await configManager.restoreConfig(backupPath);
  
  if (spinner) {
    spinner.succeed(chalk.green('Configuration restored successfully!'));
  }
  
  console.log(chalk.cyan('Configuration has been restored from backup'));
}

async function listConfiguration(options: ConfigCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Loading configuration...');
  
  const { global: showGlobal, project: showProject, json } = options;
  const config = await configManager.getMergedConfig();
  
  if (spinner) spinner.stop();

  const output: any = {};

  if (showGlobal || (!showProject && !showGlobal)) {
    output.global = config.global;
  }

  if (showProject || (!showProject && !showGlobal)) {
    output.project = config.project;
    output.merged = config.merged;
  }

  if (json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    if (output.global) {
      console.log(chalk.cyan('\n📋 Global Configuration:'));
      displayConfig(output.global);
    }

    if (output.project) {
      console.log(chalk.cyan('\n🏗️  Project Configuration:'));
      displayConfig(output.project);
    } else {
      console.log(chalk.yellow('\n⚠️  No project configuration found'));
    }

    if (output.merged && output.project) {
      console.log(chalk.cyan('\n🔗 Merged Configuration:'));
      displayConfig(output.merged);
    }
  }
}

async function getConfigValue(key: string, options: ConfigCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Getting configuration value: ${key}`);
  
  const config = await configManager.getMergedConfig();
  const value = getNestedValue(config.merged, key) ?? getNestedValue(config.global, key);
  
  if (spinner) spinner.stop();

  if (options.json) {
    console.log(JSON.stringify({ [key]: value }, null, 2));
  } else {
    if (value !== undefined) {
      console.log(chalk.cyan(`${key}:`), value);
    } else {
      console.log(chalk.yellow(`Configuration key '${key}' not found`));
    }
  }
}

async function setConfigValue(key: string, value: string, options: ConfigCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Setting configuration value: ${key} = ${value}`);
  
  const { global: isGlobal } = options;
  
  // Parse value (try JSON, fallback to string)
  let parsedValue: any;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    parsedValue = value;
  }

  if (isGlobal) {
    const globalConfig = await configManager.loadGlobalConfig();
    setNestedValue(globalConfig, key, parsedValue);
    await configManager.saveGlobalConfig(globalConfig);
  } else {
    // Set in project config
    const projectConfig = await configManager.loadProjectConfig();
    if (!projectConfig) {
      throw new ValidationError('No project configuration found. Initialize a project first.');
    }
    setNestedValue(projectConfig, key, parsedValue);
    await configManager.saveProjectConfig(projectConfig);
  }
  
  if (spinner) {
    spinner.succeed(chalk.green(`Configuration updated: ${key} = ${value}`));
  }
}

async function savePreset(name: string, options: ConfigCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Saving preset: ${name}`);
  
  const projectConfig = await configManager.loadProjectConfig();
  if (!projectConfig) {
    throw new ValidationError('No project configuration found. Initialize a project first.');
  }

  await configManager.savePreset(name, projectConfig);
  
  if (spinner) {
    spinner.succeed(chalk.green(`Preset '${name}' saved successfully!`));
  }
}

async function loadPreset(name: string, options: ConfigCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Loading preset: ${name}`);
  
  const preset = await configManager.loadPreset(name);
  if (!preset) {
    throw new ValidationError(`Preset '${name}' not found`);
  }

  if (options.json) {
    if (spinner) spinner.stop();
    console.log(JSON.stringify(preset, null, 2));
  } else {
    if (spinner) spinner.stop();
    console.log(chalk.cyan(`\n📦 Preset: ${preset.name}`));
    console.log(chalk.gray(`Description: ${preset.description}`));
    console.log(chalk.gray(`Created: ${new Date(preset.createdAt).toLocaleDateString()}`));
    console.log(chalk.gray(`Updated: ${new Date(preset.updatedAt).toLocaleDateString()}`));
    
    if (preset.tags.length > 0) {
      console.log(chalk.gray(`Tags: ${preset.tags.join(', ')}`));
    }

    console.log('\nConfiguration:');
    displayConfig(preset.config);
  }
}

async function deletePreset(name: string, options: ConfigCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Deleting preset: ${name}`);
  
  const preset = await configManager.loadPreset(name);
  if (!preset) {
    throw new ValidationError(`Preset '${name}' not found`);
  }

  await configManager.deletePreset(name);
  
  if (spinner) {
    spinner.succeed(chalk.green(`Preset '${name}' deleted successfully!`));
  }
}

async function interactiveConfig(options: ConfigCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { title: '📋 View Configuration', value: 'view' },
        { title: '⚙️  Edit Global Settings', value: 'editGlobal' },
        { title: '🏗️  Edit Project Settings', value: 'editProject' },
        { title: '📦 Manage Presets', value: 'presets' },
        { title: '💾 Backup/Restore', value: 'backup' },
        { title: '🔧 Advanced Options', value: 'advanced' }
      ]
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'view':
      await showConfiguration(options);
      break;
    case 'editGlobal':
      await interactiveGlobalConfig();
      break;
    case 'editProject':
      await interactiveProjectConfig();
      break;
    case 'presets':
      await interactivePresetManagement();
      break;
    case 'backup':
      await interactiveBackupRestore();
      break;
    case 'advanced':
      await interactiveAdvancedOptions();
      break;
  }
}

async function interactiveGlobalConfig(): Promise<void> {
  const globalConfig = await configManager.loadGlobalConfig();

  const response = await prompts([
    {
      type: 'select',
      name: 'packageManager',
      message: 'Default package manager:',
      choices: [
        { title: 'pnpm', value: 'pnpm' },
        { title: 'npm', value: 'npm' },
        { title: 'yarn', value: 'yarn' },
        { title: 'bun', value: 'bun' }
      ],
      initial: ['pnpm', 'npm', 'yarn', 'bun'].indexOf(globalConfig.packageManager)
    },
    {
      type: 'select',
      name: 'defaultFramework',
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
      type: 'toggle',
      name: 'autoUpdate',
      message: 'Enable automatic updates?',
      initial: globalConfig.cli.autoUpdate,
      active: 'yes',
      inactive: 'no'
    },
    {
      type: 'toggle',
      name: 'telemetry',
      message: 'Enable telemetry?',
      initial: globalConfig.cli.telemetry,
      active: 'yes',
      inactive: 'no'
    },
    {
      type: 'select',
      name: 'theme',
      message: 'CLI theme:',
      choices: [
        { title: 'Auto', value: 'auto' },
        { title: 'Light', value: 'light' },
        { title: 'Dark', value: 'dark' }
      ],
      initial: ['auto', 'light', 'dark'].indexOf(globalConfig.cli.theme)
    }
  ]);

  if (Object.keys(response).length === 0) return;

  // Update global config
  const updates: Partial<GlobalConfig> = {
    packageManager: response.packageManager || globalConfig.packageManager,
    defaultFramework: response.defaultFramework || globalConfig.defaultFramework,
    cli: {
      ...globalConfig.cli,
      autoUpdate: response.autoUpdate ?? globalConfig.cli.autoUpdate,
      telemetry: response.telemetry ?? globalConfig.cli.telemetry,
      theme: response.theme || globalConfig.cli.theme
    }
  };

  await configManager.updateGlobalConfig(updates);
  console.log(chalk.green('✅ Global configuration updated successfully!'));
}

async function interactiveProjectConfig(): Promise<void> {
  const projectConfig = await configManager.loadProjectConfig();
  if (!projectConfig) {
    console.log(chalk.yellow('⚠️  No project configuration found. Initialize a project first.'));
    return;
  }

  // Implementation for interactive project config editing
  console.log(chalk.cyan('🏗️  Interactive project configuration coming soon...'));
}

async function interactivePresetManagement(): Promise<void> {
  const presets = await configManager.listPresets();

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'Preset management:',
      choices: [
        { title: '📋 List Presets', value: 'list' },
        { title: '💾 Save Current as Preset', value: 'save' },
        { title: '📥 Load Preset', value: 'load' },
        { title: '🗑️  Delete Preset', value: 'delete' }
      ]
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'list':
      if (presets.length === 0) {
        console.log(chalk.yellow('No presets found.'));
      } else {
        console.log(chalk.cyan('\n📦 Available Presets:'));
        presets.forEach(preset => {
          console.log(`  • ${preset.name} - ${preset.description}`);
        });
      }
      break;
    // Add other preset actions...
  }
}

async function interactiveBackupRestore(): Promise<void> {
  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'Backup/Restore:',
      choices: [
        { title: '💾 Create Backup', value: 'backup' },
        { title: '📥 Restore from Backup', value: 'restore' }
      ]
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'backup':
      await backupConfiguration();
      break;
    case 'restore':
      // Implementation for restore selection
      console.log(chalk.cyan('🔄 Restore functionality coming soon...'));
      break;
  }
}

async function interactiveAdvancedOptions(): Promise<void> {
  console.log(chalk.cyan('🔧 Advanced configuration options coming soon...'));
}

async function showConfiguration(options: ConfigCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Loading configuration...');
  
  const config = await configManager.getMergedConfig();
  
  if (spinner) spinner.stop();

  if (options.json) {
    console.log(JSON.stringify({
      global: config.global,
      project: config.project,
      merged: config.merged
    }, null, 2));
  } else {
    console.log(chalk.cyan('\n📋 Current Configuration'));
    console.log(chalk.gray('═'.repeat(50)));
    
    console.log(chalk.cyan('\n🌐 Global Settings:'));
    displayConfig(config.global, 1);
    
    if (config.project) {
      console.log(chalk.cyan('\n🏗️  Project Settings:'));
      displayConfig(config.project, 1);
    } else {
      console.log(chalk.yellow('\n⚠️  No project configuration found'));
    }
  }
}

function displayConfig(config: any, indent = 0): void {
  const prefix = '  '.repeat(indent);
  
  for (const [key, value] of Object.entries(config)) {
    if (value === null || value === undefined) {
      console.log(`${prefix}${chalk.gray(key)}: ${chalk.dim('null')}`);
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      console.log(`${prefix}${chalk.cyan(key)}:`);
      displayConfig(value, indent + 1);
    } else if (Array.isArray(value)) {
      console.log(`${prefix}${chalk.cyan(key)}: ${chalk.dim(`[${value.length} items]`)}`);
      if (value.length > 0) {
        value.slice(0, 3).forEach((item, i) => {
          console.log(`${prefix}  ${chalk.gray(`[${i}]`)}: ${item}`);
        });
        if (value.length > 3) {
          console.log(`${prefix}  ${chalk.gray(`... ${value.length - 3} more`)}`);
        }
      }
    } else {
      const displayValue = typeof value === 'string' ? `"${value}"` : value;
      console.log(`${prefix}${chalk.cyan(key)}: ${displayValue}`);
    }
  }
}

// Utility functions for nested object access
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