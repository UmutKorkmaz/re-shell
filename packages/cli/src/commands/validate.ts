import chalk from 'chalk';
import prompts from 'prompts';
import { validateConfigFile, validateGlobalConfig, validateProjectConfig, configValidator } from '../utils/validation';
import { configManager } from '../utils/config';
import { ProgressSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';

export interface ValidateCommandOptions {
  global?: boolean;
  project?: boolean;
  file?: string;
  fix?: boolean;
  warnings?: boolean;
  suggestions?: boolean;
  interactive?: boolean;
  json?: boolean;
  verbose?: boolean;
  spinner?: ProgressSpinner;
}

export async function validateConfiguration(options: ValidateCommandOptions = {}): Promise<void> {
  const { spinner, verbose, json } = options;

  try {
    if (options.file) {
      await validateSpecificFile(options.file, options, spinner);
      return;
    }

    if (options.global) {
      await validateGlobalConfiguration(options, spinner);
      return;
    }

    if (options.project) {
      await validateProjectConfiguration(options, spinner);
      return;
    }

    if (options.interactive) {
      await interactiveValidation(options, spinner);
      return;
    }

    // Default: validate both global and project configurations
    await validateAllConfigurations(options, spinner);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Configuration validation failed'));
    throw error;
  }
}

async function validateSpecificFile(filePath: string, options: ValidateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Validating file: ${filePath}...`);
  
  const configType = filePath.includes('global') || filePath.includes('.re-shell/config') ? 'project' : 'global';
  const result = await validateConfigFile(filePath, configType);
  
  if (spinner) spinner.stop();

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    displayValidationResult(result, filePath, options);
  }
}

async function validateGlobalConfiguration(options: ValidateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Validating global configuration...');
  
  const globalConfig = await configManager.loadGlobalConfig();
  const result = validateGlobalConfig(globalConfig);
  
  if (spinner) spinner.stop();

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    displayValidationResult(result, 'Global Configuration', options);
  }
}

async function validateProjectConfiguration(options: ValidateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Validating project configuration...');
  
  const projectConfig = await configManager.loadProjectConfig();
  if (!projectConfig) {
    if (spinner) spinner.fail(chalk.red('No project configuration found'));
    console.log(chalk.yellow('⚠️  No project configuration found. Initialize a project first.'));
    return;
  }

  const result = validateProjectConfig(projectConfig);
  
  if (spinner) spinner.stop();

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    displayValidationResult(result, 'Project Configuration', options);
  }
}

async function validateAllConfigurations(options: ValidateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Validating all configurations...');
  
  const globalConfig = await configManager.loadGlobalConfig();
  const projectConfig = await configManager.loadProjectConfig();
  
  const globalResult = validateGlobalConfig(globalConfig);
  const projectResult = projectConfig ? validateProjectConfig(projectConfig) : null;
  
  if (spinner) spinner.stop();

  if (options.json) {
    console.log(JSON.stringify({
      global: globalResult,
      project: projectResult
    }, null, 2));
  } else {
    console.log(chalk.cyan('\n🔍 Configuration Validation Report'));
    console.log(chalk.gray('═'.repeat(50)));
    
    console.log(chalk.cyan('\n🌐 Global Configuration:'));
    displayValidationResult(globalResult, 'Global', options);
    
    if (projectResult) {
      console.log(chalk.cyan('\n🏗️  Project Configuration:'));
      displayValidationResult(projectResult, 'Project', options);
    } else {
      console.log(chalk.yellow('\n🏗️  Project Configuration: Not found'));
    }

    // Summary
    const totalErrors = globalResult.errors.filter(e => e.severity === 'error').length + 
                       (projectResult?.errors.filter(e => e.severity === 'error').length || 0);
    const totalWarnings = globalResult.warnings.length + (projectResult?.warnings.length || 0);
    
    console.log(chalk.cyan('\n📊 Summary:'));
    console.log(`  Errors: ${totalErrors > 0 ? chalk.red(totalErrors) : chalk.green('0')}`);
    console.log(`  Warnings: ${totalWarnings > 0 ? chalk.yellow(totalWarnings) : chalk.green('0')}`);
    
    if (totalErrors === 0 && totalWarnings === 0) {
      console.log(chalk.green('\n✅ All configurations are valid!'));
    } else if (totalErrors === 0) {
      console.log(chalk.yellow('\n⚠️  Configurations are valid but have warnings'));
    } else {
      console.log(chalk.red('\n❌ Configuration validation failed'));
    }
  }
}

async function interactiveValidation(options: ValidateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to validate?',
      choices: [
        { title: '🔍 Validate All Configurations', value: 'all' },
        { title: '🌐 Validate Global Configuration Only', value: 'global' },
        { title: '🏗️  Validate Project Configuration Only', value: 'project' },
        { title: '📁 Validate Specific File', value: 'file' },
        { title: '🔧 Advanced Validation Options', value: 'advanced' }
      ]
    }
  ]);

  if (!response.action) return;

  const newOptions = { ...options, interactive: false };

  switch (response.action) {
    case 'all':
      await validateAllConfigurations(newOptions);
      break;
    case 'global':
      await validateGlobalConfiguration(newOptions);
      break;
    case 'project':
      await validateProjectConfiguration(newOptions);
      break;
    case 'file':
      await interactiveFileValidation(newOptions);
      break;
    case 'advanced':
      await interactiveAdvancedValidation(newOptions);
      break;
  }
}

async function interactiveFileValidation(options: ValidateCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'filePath',
      message: 'Enter the path to the configuration file:',
      validate: (value: string) => {
        if (!value.trim()) return 'File path is required';
        return true;
      }
    }
  ]);

  if (response.filePath) {
    await validateSpecificFile(response.filePath, options);
  }
}

async function interactiveAdvancedValidation(options: ValidateCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'multiselect',
      name: 'features',
      message: 'Select validation features:',
      choices: [
        { title: 'Show warnings', value: 'warnings', selected: true },
        { title: 'Show suggestions', value: 'suggestions', selected: true },
        { title: 'Auto-fix issues', value: 'fix', selected: false },
        { title: 'Verbose output', value: 'verbose', selected: false }
      ]
    }
  ]);

  const enhancedOptions = {
    ...options,
    warnings: response.features.includes('warnings'),
    suggestions: response.features.includes('suggestions'),
    fix: response.features.includes('fix'),
    verbose: response.features.includes('verbose')
  };

  await validateAllConfigurations(enhancedOptions);
}

function displayValidationResult(result: any, title: string, options: ValidateCommandOptions): void {
  const status = result.valid ? chalk.green('✅ Valid') : chalk.red('❌ Invalid');
  console.log(`  Status: ${status}`);
  
  // Display errors
  if (result.errors.length > 0) {
    const errors = result.errors.filter((e: any) => e.severity === 'error');
    const warnings = result.errors.filter((e: any) => e.severity === 'warning');
    
    if (errors.length > 0) {
      console.log(chalk.red('\n  ❌ Errors:'));
      errors.forEach((error: any) => {
        console.log(chalk.red(`    • ${error.field}: ${error.message}`));
        if (error.value !== undefined) {
          console.log(chalk.gray(`      Current value: ${JSON.stringify(error.value)}`));
        }
        if (error.expectedValue !== undefined) {
          console.log(chalk.gray(`      Expected: ${JSON.stringify(error.expectedValue)}`));
        }
        if (error.suggestions && error.suggestions.length > 0) {
          console.log(chalk.cyan('      Suggestions:'));
          error.suggestions.forEach((suggestion: string) => {
            console.log(chalk.cyan(`        - ${suggestion}`));
          });
        }
      });
    }
    
    if (warnings.length > 0 && options.warnings !== false) {
      console.log(chalk.yellow('\n  ⚠️  Warnings:'));
      warnings.forEach((warning: any) => {
        console.log(chalk.yellow(`    • ${warning.field}: ${warning.message}`));
      });
    }
  }
  
  // Display warnings
  if (result.warnings && result.warnings.length > 0 && options.warnings !== false) {
    console.log(chalk.yellow('\n  ⚠️  Additional Warnings:'));
    result.warnings.forEach((warning: any) => {
      console.log(chalk.yellow(`    • ${warning.field}: ${warning.message}`));
      console.log(chalk.gray(`      Suggestion: ${warning.suggestion}`));
      console.log(chalk.gray(`      Impact: ${warning.impact}`));
    });
  }
  
  // Display suggestions
  if (result.suggestions && result.suggestions.length > 0 && options.suggestions !== false) {
    console.log(chalk.cyan('\n  💡 Suggestions:'));
    result.suggestions.forEach((suggestion: any) => {
      console.log(chalk.cyan(`    • ${suggestion.field}: ${suggestion.suggestion}`));
      console.log(chalk.gray(`      Reason: ${suggestion.reason}`));
      if (suggestion.autoFixable) {
        console.log(chalk.green('      Auto-fixable: Yes'));
      }
    });
  }
  
  // Auto-fix prompt
  if (options.fix && result.suggestions) {
    const autoFixable = result.suggestions.filter((s: any) => s.autoFixable);
    if (autoFixable.length > 0) {
      console.log(chalk.cyan('\n🔧 Auto-fix functionality coming soon...'));
      console.log(chalk.gray('The following issues can be automatically fixed:'));
      autoFixable.forEach((suggestion: any) => {
        console.log(chalk.gray(`  • ${suggestion.field}: ${suggestion.suggestion}`));
      });
    }
  }
}