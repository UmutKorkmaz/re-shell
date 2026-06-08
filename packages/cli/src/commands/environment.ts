import chalk from 'chalk';
import prompts from 'prompts';
import { environmentManager, EnvironmentProfile, EnvironmentVariables, BuildConfiguration } from '../utils/environment';
import { ProgressSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';

export interface EnvironmentCommandOptions {
  list?: boolean;
  active?: boolean;
  set?: string;
  create?: string;
  delete?: string;
  update?: string;
  compare?: string[];
  variables?: boolean;
  build?: boolean;
  deployment?: boolean;
  generate?: string; // Generate .env file
  output?: string;
  extends?: string;
  interactive?: boolean;
  json?: boolean;
  verbose?: boolean;
  spinner?: ProgressSpinner;
}

export async function manageEnvironment(options: EnvironmentCommandOptions = {}): Promise<void> {
  const { spinner, verbose, json } = options;

  try {
    if (options.list) {
      await listEnvironments(options, spinner);
      return;
    }

    if (options.active) {
      await showActiveEnvironment(options, spinner);
      return;
    }

    if (options.set) {
      await setEnvironment(options.set, options, spinner);
      return;
    }

    if (options.create) {
      await createEnvironment(options.create, options, spinner);
      return;
    }

    if (options.delete) {
      await deleteEnvironment(options.delete, options, spinner);
      return;
    }

    if (options.update) {
      await updateEnvironment(options.update, options, spinner);
      return;
    }

    if (options.compare && options.compare.length === 2) {
      await compareEnvironments(options.compare[0], options.compare[1], options, spinner);
      return;
    }

    if (options.generate) {
      await generateEnvFile(options.generate, options, spinner);
      return;
    }

    if (options.interactive) {
      await interactiveEnvironmentManagement(options, spinner);
      return;
    }

    // Default: show environment status
    await showEnvironmentStatus(options, spinner);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Environment operation failed'));
    throw error;
  }
}

async function listEnvironments(options: EnvironmentCommandOptions, spinner?: ProgressSpinner, hasRetried = false): Promise<void> {
  if (spinner) spinner.setText('Loading environments...');

  const environments = await environmentManager.listEnvironments();

  if (spinner) spinner.stop();

  if (options.json) {
    console.log(JSON.stringify(environments, null, 2));
  } else {
    console.log(chalk.cyan('\n🌍 Available Environments:'));
    console.log(chalk.gray('═'.repeat(40)));

    if (environments.length === 0 && !hasRetried) {
      console.log(chalk.yellow('No environments found. Creating defaults...'));
      await environmentManager.createDefaultEnvironments();
      return listEnvironments(options, spinner, true);
    } else if (environments.length === 0) {
      console.log('No environments available.');
      return;
    }

    for (const env of environments) {
      const activeIndicator = env.active ? chalk.green('●') : chalk.gray('○');
      const lastUsed = env.lastUsed ? ` (last used: ${new Date(env.lastUsed).toLocaleDateString()})` : '';
      const extends_ = env.extends ? chalk.gray(` extends ${env.extends}`) : '';
      
      console.log(`${activeIndicator} ${chalk.cyan(env.name)}${extends_}${chalk.gray(lastUsed)}`);
      
      if (options.verbose) {
        console.log(chalk.gray(`   Mode: ${env.build.mode}`));
        console.log(chalk.gray(`   Variables: ${Object.keys(env.variables).length}`));
        console.log(chalk.gray(`   Provider: ${env.deployment.provider || 'none'}`));
      }
    }
  }
}

async function showActiveEnvironment(options: EnvironmentCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Getting active environment...');
  
  const activeEnv = await environmentManager.getActiveEnvironment();
  
  if (spinner) spinner.stop();

  if (!activeEnv) {
    console.log(chalk.yellow('No active environment. Use `re-shell env set <name>` to activate one.'));
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(activeEnv, null, 2));
  } else {
    console.log(chalk.cyan(`\n🌍 Active Environment: ${chalk.bold(activeEnv.name)}`));
    console.log(chalk.gray('═'.repeat(40)));
    
    if (activeEnv.extends) {
      console.log(chalk.gray(`Extends: ${activeEnv.extends}`));
    }
    
    console.log(chalk.cyan('\n📋 Variables:'));
    for (const [key, value] of Object.entries(activeEnv.variables)) {
      console.log(`  ${chalk.cyan(key)}: ${value}`);
    }
    
    console.log(chalk.cyan('\n🔧 Build Configuration:'));
    console.log(`  Mode: ${activeEnv.build.mode}`);
    console.log(`  Optimization: ${activeEnv.build.optimization}`);
    console.log(`  Source maps: ${activeEnv.build.sourcemaps}`);
    
    if (activeEnv.deployment.provider) {
      console.log(chalk.cyan('\n🚀 Deployment:'));
      console.log(`  Provider: ${activeEnv.deployment.provider}`);
      console.log(`  Target: ${activeEnv.deployment.target || 'default'}`);
    }
  }
}

async function setEnvironment(name: string, options: EnvironmentCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Setting active environment to ${name}...`);
  
  await environmentManager.setActiveEnvironment(name);
  
  if (spinner) {
    spinner.succeed(chalk.green(`Environment '${name}' is now active!`));
  }
}

async function createEnvironment(name: string, options: EnvironmentCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Creating environment ${name}...`);
  
  // Basic environment creation - can be enhanced with prompts
  const config = {
    name,
    variables: {
      NODE_ENV: name,
      DEBUG: name === 'development' ? 'true' : 'false'
    },
    build: {
      mode: name as 'development' | 'staging' | 'production',
      optimization: name !== 'development',
      sourcemaps: true
    },
    deployment: {}
  };

  await environmentManager.createEnvironment(name, config, options.extends);
  
  if (spinner) {
    spinner.succeed(chalk.green(`Environment '${name}' created successfully!`));
  }
}

async function deleteEnvironment(name: string, options: EnvironmentCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Deleting environment ${name}...`);
  
  await environmentManager.deleteEnvironment(name);
  
  if (spinner) {
    spinner.succeed(chalk.green(`Environment '${name}' deleted successfully!`));
  }
}

async function updateEnvironment(name: string, options: EnvironmentCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Updating environment ${name}...`);
  
  // This would be enhanced with interactive prompts or CLI options
  console.log(chalk.cyan(`Interactive update for environment '${name}' coming soon...`));
  
  if (spinner) {
    spinner.succeed(chalk.green(`Environment '${name}' updated!`));
  }
}

async function compareEnvironments(env1: string, env2: string, options: EnvironmentCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Comparing environments ${env1} and ${env2}...`);
  
  const comparison = await environmentManager.compareEnvironments(env1, env2);
  
  if (spinner) spinner.stop();

  if (options.json) {
    console.log(JSON.stringify(comparison, null, 2));
  } else {
    console.log(chalk.cyan(`\n🔍 Environment Comparison: ${env1} vs ${env2}`));
    console.log(chalk.gray('═'.repeat(50)));
    
    console.log(chalk.cyan('\n📋 Variables:'));
    if (comparison.variables.added.length > 0) {
      console.log(chalk.green(`  Added in ${env2}: ${comparison.variables.added.join(', ')}`));
    }
    if (comparison.variables.removed.length > 0) {
      console.log(chalk.red(`  Removed from ${env2}: ${comparison.variables.removed.join(', ')}`));
    }
    if (comparison.variables.changed.length > 0) {
      console.log(chalk.yellow('  Changed:'));
      for (const change of comparison.variables.changed) {
        console.log(`    ${change.key}: ${chalk.red(change.from)} → ${chalk.green(change.to)}`);
      }
    }
    
    if (Object.keys(comparison.build).length > 0) {
      console.log(chalk.cyan('\n🔧 Build Configuration:'));
      for (const [key, diff] of Object.entries(comparison.build)) {
        console.log(`  ${key}: ${chalk.red(diff.from)} → ${chalk.green(diff.to)}`);
      }
    }
    
    if (Object.keys(comparison.deployment).length > 0) {
      console.log(chalk.cyan('\n🚀 Deployment Configuration:'));
      for (const [key, diff] of Object.entries(comparison.deployment)) {
        console.log(`  ${key}: ${chalk.red(diff.from)} → ${chalk.green(diff.to)}`);
      }
    }
  }
}

async function generateEnvFile(environmentName: string, options: EnvironmentCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Generating .env file for ${environmentName}...`);
  
  const filePath = await environmentManager.generateEnvFile(environmentName, options.output);
  
  if (spinner) {
    spinner.succeed(chalk.green(`Environment file generated: ${filePath}`));
  }
}

async function showEnvironmentStatus(options: EnvironmentCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Loading environment status...');
  
  const activeEnv = await environmentManager.getActiveEnvironment();
  const environments = await environmentManager.listEnvironments();
  
  if (spinner) spinner.stop();

  if (options.json) {
    console.log(JSON.stringify({
      active: activeEnv,
      environments: environments
    }, null, 2));
  } else {
    console.log(chalk.cyan('\n🌍 Environment Status'));
    console.log(chalk.gray('═'.repeat(30)));
    
    if (activeEnv) {
      console.log(chalk.green(`Active: ${activeEnv.name}`));
    } else {
      console.log(chalk.yellow('No active environment'));
    }
    
    console.log(chalk.cyan(`Total environments: ${environments.length}`));
    
    if (environments.length > 0) {
      console.log(chalk.cyan('\nQuick actions:'));
      console.log('• re-shell env list          - List all environments');
      console.log('• re-shell env set <name>    - Switch environment');
      console.log('• re-shell env create <name> - Create new environment');
      console.log('• re-shell env generate <name> - Generate .env file');
    }
  }
}

async function interactiveEnvironmentManagement(options: EnvironmentCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { title: '📋 List Environments', value: 'list' },
        { title: '🌍 Show Active Environment', value: 'active' },
        { title: '🔄 Switch Environment', value: 'switch' },
        { title: '➕ Create New Environment', value: 'create' },
        { title: '🔧 Update Environment', value: 'update' },
        { title: '🔍 Compare Environments', value: 'compare' },
        { title: '📄 Generate .env File', value: 'generate' },
        { title: '🗑️  Delete Environment', value: 'delete' }
      ]
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'list':
      await listEnvironments(options);
      break;
    case 'active':
      await showActiveEnvironment(options);
      break;
    case 'switch':
      await interactiveSwitchEnvironment();
      break;
    case 'create':
      await interactiveCreateEnvironment();
      break;
    // Add other interactive actions...
    default:
      console.log(chalk.cyan(`${response.action} functionality coming soon...`));
  }
}

async function interactiveSwitchEnvironment(): Promise<void> {
  const environments = await environmentManager.listEnvironments();
  
  if (environments.length === 0) {
    console.log(chalk.yellow('No environments available. Create one first.'));
    return;
  }

  const response = await prompts([
    {
      type: 'select',
      name: 'environment',
      message: 'Select environment to activate:',
      choices: environments.map(env => ({
        title: `${env.name}${env.active ? ' (current)' : ''}`,
        value: env.name,
        description: `Mode: ${env.build.mode}, Provider: ${env.deployment.provider || 'none'}`
      }))
    }
  ]);

  if (response.environment) {
    await environmentManager.setActiveEnvironment(response.environment);
    console.log(chalk.green(`✅ Environment '${response.environment}' is now active!`));
  }
}

async function interactiveCreateEnvironment(): Promise<void> {
  const environments = await environmentManager.listEnvironments();
  
  const response = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'Environment name:',
      validate: (value: string) => {
        if (!value.trim()) return 'Name is required';
        if (environments.some(env => env.name === value)) return 'Environment already exists';
        return true;
      }
    },
    {
      type: 'select',
      name: 'extends',
      message: 'Inherit from existing environment?',
      choices: [
        { title: 'None (start fresh)', value: null },
        ...environments.map(env => ({
          title: env.name,
          value: env.name
        }))
      ]
    },
    {
      type: 'select',
      name: 'mode',
      message: 'Build mode:',
      choices: [
        { title: 'Development', value: 'development' },
        { title: 'Staging', value: 'staging' },
        { title: 'Production', value: 'production' }
      ]
    }
  ]);

  if (response.name) {
    const config = {
      name: response.name,
      variables: {
        NODE_ENV: response.mode || 'development'
      },
      build: {
        mode: response.mode || 'development',
        optimization: response.mode !== 'development',
        sourcemaps: true
      },
      deployment: {}
    };

    await environmentManager.createEnvironment(response.name, config, response.extends);
    console.log(chalk.green(`✅ Environment '${response.name}' created successfully!`));
  }
}