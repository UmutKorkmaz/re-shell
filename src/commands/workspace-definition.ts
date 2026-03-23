import chalk from 'chalk';
import prompts from 'prompts';
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  WorkspaceDefinition,
  WorkspaceSchemaValidator,
  loadWorkspaceDefinition,
  saveWorkspaceDefinition,
  createDefaultWorkspaceDefinition,
  ValidationResult,
  WorkspaceEntry
} from '../utils/workspace-schema';
import { ProgressSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';

export interface WorkspaceDefinitionCommandOptions {
  init?: boolean;
  validate?: boolean;
  autoDetect?: boolean;
  structure?: boolean;
  fix?: boolean;
  interactive?: boolean;
  
  // File options
  file?: string;
  output?: string;
  
  // Validation options
  strict?: boolean;
  ignoreWarnings?: boolean;
  
  // Auto-detection options
  merge?: boolean;
  dryRun?: boolean;
  
  // Output options
  json?: boolean;
  verbose?: boolean;
  
  spinner?: ProgressSpinner;
}

const DEFAULT_WORKSPACE_FILE = 're-shell.workspaces.yaml';

export async function manageWorkspaceDefinition(options: WorkspaceDefinitionCommandOptions = {}): Promise<void> {
  const { spinner, verbose, json } = options;

  try {
    if (options.init) {
      await initializeWorkspaceDefinition(options, spinner);
      return;
    }

    if (options.validate) {
      await validateWorkspaceDefinition(options, spinner);
      return;
    }

    if (options.autoDetect) {
      await autoDetectWorkspaces(options, spinner);
      return;
    }

    if (options.structure) {
      await validateWorkspaceStructure(options, spinner);
      return;
    }

    if (options.fix) {
      await fixWorkspaceDefinition(options, spinner);
      return;
    }

    if (options.interactive) {
      await interactiveWorkspaceManagement(options, spinner);
      return;
    }

    // Default: show workspace definition status
    await showWorkspaceDefinitionStatus(options, spinner);

  } catch (error) {
    if (error instanceof ValidationError) {
      if (spinner) spinner.stop();
      console.log(chalk.yellow('\n⚠️  No workspace definition found.'));
      console.log(chalk.cyan('\nRun \'re-shell workspace-def init\' to initialize your workspace.'));
      process.exit(1);
    }
    if (spinner) spinner.fail(chalk.red('Workspace definition operation failed'));
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      console.error('Make sure you have a valid re-shell workspace. Run "re-shell init" to initialize.');
    } else {
      console.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}

async function initializeWorkspaceDefinition(options: WorkspaceDefinitionCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const outputFile = options.output || options.file || DEFAULT_WORKSPACE_FILE;
  const outputPath = path.resolve(outputFile);

  if (spinner) spinner.setText(`Initializing workspace definition: ${outputFile}`);

  // Check if file already exists
  if (await fs.pathExists(outputPath) && !options.dryRun) {
    if (spinner) spinner.stop();
    
    const response = await prompts([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Workspace definition already exists at ${outputFile}. Overwrite?`,
        initial: false
      }
    ]);

    if (!response.overwrite) {
      console.log(chalk.yellow('Initialization cancelled.'));
      return;
    }
  }

  try {
    // Get project information
    let projectName = path.basename(process.cwd());
    let description = '';

    if (!options.dryRun) {
      if (spinner) spinner.stop();
      
      const response = await prompts([
        {
          type: 'text',
          name: 'name',
          message: 'Project name:',
          initial: projectName,
          validate: (value: string) => value.trim() ? true : 'Project name is required'
        },
        {
          type: 'text',
          name: 'description',
          message: 'Project description (optional):',
        }
      ]);

      if (!response.name) return;
      projectName = response.name;
      description = response.description || '';
    }

    // Create default workspace definition
    const definition = createDefaultWorkspaceDefinition(projectName, {
      description: description || undefined
    });

    if (options.dryRun) {
      if (spinner) spinner.stop();
      console.log(chalk.cyan('\\n📋 Workspace Definition Preview'));
      console.log(chalk.gray('═'.repeat(50)));
      console.log(JSON.stringify(definition, null, 2));
      return;
    }

    // Save the definition
    await saveWorkspaceDefinition(definition, outputPath);

    if (spinner) {
      spinner.succeed(chalk.green('Workspace definition initialized'));
    }

    console.log(chalk.green(`\\n✅ Workspace definition created: ${outputFile}`));
    console.log(chalk.cyan('\\n📝 Next steps:'));
    console.log(`  • Run: re-shell workspace-def auto-detect --merge`);
    console.log(`  • Edit: ${outputFile}`);
    console.log(`  • Validate: re-shell workspace-def validate`);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to initialize workspace definition'));
    throw error;
  }
}

async function validateWorkspaceDefinition(options: WorkspaceDefinitionCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);

  if (spinner) spinner.setText(`Validating workspace definition: ${inputFile}`);

  try {
    // Load and validate definition
    const definition = await loadWorkspaceDefinition(inputPath);
    const validator = new WorkspaceSchemaValidator(definition, path.dirname(inputPath));
    const result = await validator.validateDefinition();

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // Display results
    displayValidationResults(result, inputFile, options.strict || false, options.ignoreWarnings || false);

    if (!result.valid) {
      process.exit(1);
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Validation failed'));
    
    if (error instanceof ValidationError) {
      console.error(chalk.red(`❌ ${error.message}`));
    } else {
      console.error(chalk.red(`❌ Unexpected error: ${(error as Error).message}`));
    }
    
    process.exit(1);
  }
}

async function validateWorkspaceStructure(options: WorkspaceDefinitionCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);

  if (spinner) spinner.setText(`Validating workspace structure: ${inputFile}`);

  try {
    const definition = await loadWorkspaceDefinition(inputPath);
    const validator = new WorkspaceSchemaValidator(definition, path.dirname(inputPath));
    const result = await validator.validateWorkspaceStructure();

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(chalk.cyan('\\n🏗️  Workspace Structure Validation'));
    console.log(chalk.gray('═'.repeat(60)));

    displayValidationResults(result, inputFile, options.strict || false, options.ignoreWarnings || false);

    if (!result.valid) {
      process.exit(1);
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Structure validation failed'));
    throw error;
  }
}

async function autoDetectWorkspaces(options: WorkspaceDefinitionCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);

  if (spinner) spinner.setText('Auto-detecting workspaces...');

  try {
    let definition: WorkspaceDefinition;
    
    // Load existing definition or create default
    if (await fs.pathExists(inputPath)) {
      definition = await loadWorkspaceDefinition(inputPath);
    } else {
      definition = createDefaultWorkspaceDefinition(path.basename(process.cwd()));
    }

    const validator = new WorkspaceSchemaValidator(definition, path.dirname(inputPath));
    const detectedWorkspaces = await validator.autoDetectWorkspaces();

    if (spinner) spinner.stop();

    if (detectedWorkspaces.length === 0) {
      console.log(chalk.yellow('No workspaces detected based on current patterns and types.'));
      console.log(chalk.gray('Consider updating workspace patterns or adding workspaces manually.'));
      return;
    }

    console.log(chalk.cyan(`\\n🔍 Auto-Detected Workspaces (${detectedWorkspaces.length})`));
    console.log(chalk.gray('═'.repeat(50)));

    for (const workspace of detectedWorkspaces) {
      const typeIcon = getWorkspaceTypeIcon(workspace.type);
      console.log(`\\n${typeIcon} ${chalk.cyan(workspace.name)}`);
      console.log(`   Path: ${workspace.path}`);
      console.log(`   Type: ${workspace.type}`);
      if (workspace.description) {
        console.log(`   Description: ${chalk.gray(workspace.description)}`);
      }
      if (workspace.tags && workspace.tags.length > 0) {
        console.log(`   Tags: ${workspace.tags.map(tag => chalk.blue(tag)).join(', ')}`);
      }
    }

    if (options.dryRun) {
      console.log(chalk.gray('\\n(Dry run - no changes made)'));
      return;
    }

    // Merge with existing definition if requested
    if (options.merge) {
      const response = await prompts([
        {
          type: 'confirm',
          name: 'merge',
          message: `Merge ${detectedWorkspaces.length} detected workspaces with existing definition?`,
          initial: true
        }
      ]);

      if (response.merge) {
        // Add detected workspaces to definition
        for (const workspace of detectedWorkspaces) {
          definition.workspaces[workspace.name] = workspace;
        }

        await saveWorkspaceDefinition(definition, inputPath);
        console.log(chalk.green(`\\n✅ Merged ${detectedWorkspaces.length} workspaces into ${inputFile}`));
      }
    } else {
      // Save as new file or replace
      const outputFile = options.output || inputFile;
      const newDefinition = {
        ...definition,
        workspaces: Object.fromEntries(detectedWorkspaces.map(w => [w.name, w]))
      };

      await saveWorkspaceDefinition(newDefinition, outputFile);
      console.log(chalk.green(`\\n✅ Saved detected workspaces to ${outputFile}`));
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Auto-detection failed'));
    throw error;
  }
}

async function fixWorkspaceDefinition(options: WorkspaceDefinitionCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);

  if (spinner) spinner.setText(`Analyzing workspace definition for fixes: ${inputFile}`);

  try {
    const definition = await loadWorkspaceDefinition(inputPath);
    const validator = new WorkspaceSchemaValidator(definition, path.dirname(inputPath));
    const result = await validator.validateDefinition();

    if (spinner) spinner.stop();

    if (result.valid && result.suggestions.length === 0) {
      console.log(chalk.green('✅ No fixes needed - workspace definition is valid'));
      return;
    }

    console.log(chalk.cyan('\\n🔧 Available Fixes'));
    console.log(chalk.gray('═'.repeat(40)));

    let hasApplicableFixes = false;

    // Show suggestions that can be auto-fixed
    for (const suggestion of result.suggestions) {
      if (suggestion.fix) {
        hasApplicableFixes = true;
        console.log(`\\n💡 ${suggestion.message}`);
        console.log(`   Path: ${chalk.gray(suggestion.path)}`);
        console.log(`   Fix: ${chalk.green(suggestion.fix)}`);
      }
    }

    if (!hasApplicableFixes) {
      console.log(chalk.yellow('No auto-fixable issues found.'));
      console.log(chalk.gray('Manual fixes may be required - see validation output.'));
      return;
    }

    if (options.dryRun) {
      console.log(chalk.gray('\\n(Dry run - no changes would be made)'));
      return;
    }

    const response = await prompts([
      {
        type: 'confirm',
        name: 'apply',
        message: 'Apply suggested fixes?',
        initial: true
      }
    ]);

    if (response.apply) {
      // TODO: Implement actual fix application
      console.log(chalk.yellow('\\n⚠️  Auto-fix implementation coming in next update'));
      console.log(chalk.gray('For now, please apply fixes manually based on suggestions above.'));
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Fix analysis failed'));
    throw error;
  }
}

async function showWorkspaceDefinitionStatus(options: WorkspaceDefinitionCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);

  if (spinner) spinner.setText('Checking workspace definition status...');

  try {
    if (!(await fs.pathExists(inputPath))) {
      if (spinner) spinner.stop();
      
      console.log(chalk.yellow('\\n⚠️  No workspace definition found'));
      console.log(chalk.gray(`Expected: ${inputFile}`));
      console.log(chalk.cyan('\\n🚀 Quick start:'));
      console.log('  re-shell workspace-def init');
      console.log('  re-shell workspace-def auto-detect --merge');
      return;
    }

    const definition = await loadWorkspaceDefinition(inputPath);
    const validator = new WorkspaceSchemaValidator(definition, path.dirname(inputPath));
    const [defResult, structResult] = await Promise.all([
      validator.validateDefinition(),
      validator.validateWorkspaceStructure()
    ]);

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify({
        file: inputFile,
        definition: defResult,
        structure: structResult,
        workspaces: Object.keys(definition.workspaces).length
      }, null, 2));
      return;
    }

    console.log(chalk.cyan('\\n📋 Workspace Definition Status'));
    console.log(chalk.gray('═'.repeat(50)));

    console.log(`\\nFile: ${chalk.cyan(inputFile)}`);
    console.log(`Version: ${definition.version}`);
    console.log(`Name: ${definition.name}`);
    if (definition.description) {
      console.log(`Description: ${chalk.gray(definition.description)}`);
    }

    console.log(`\\nWorkspaces: ${Object.keys(definition.workspaces).length}`);
    console.log(`Types: ${Object.keys(definition.types).length}`);
    console.log(`Patterns: ${definition.patterns.length}`);

    // Definition validation status
    const defIcon = defResult.valid ? '✅' : '❌';
    const defStatus = defResult.valid ? chalk.green('Valid') : chalk.red('Invalid');
    console.log(`\\nDefinition: ${defIcon} ${defStatus}`);
    
    if (defResult.errors.length > 0) {
      console.log(`  Errors: ${chalk.red(defResult.errors.length)}`);
    }
    if (defResult.warnings.length > 0) {
      console.log(`  Warnings: ${chalk.yellow(defResult.warnings.length)}`);
    }

    // Structure validation status
    const structIcon = structResult.valid ? '✅' : '❌';
    const structStatus = structResult.valid ? chalk.green('Valid') : chalk.red('Invalid');
    console.log(`Structure: ${structIcon} ${structStatus}`);
    
    if (structResult.errors.length > 0) {
      console.log(`  Errors: ${chalk.red(structResult.errors.length)}`);
    }
    if (structResult.warnings.length > 0) {
      console.log(`  Warnings: ${chalk.yellow(structResult.warnings.length)}`);
    }

    console.log(chalk.cyan('\\n🛠️  Available Commands:'));
    console.log('  • re-shell workspace-def validate');
    console.log('  • re-shell workspace-def structure');
    console.log('  • re-shell workspace-def auto-detect');
    console.log('  • re-shell workspace-def interactive');

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Status check failed'));
    throw error;
  }
}

async function interactiveWorkspaceManagement(options: WorkspaceDefinitionCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);
  const exists = await fs.pathExists(inputPath);

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        ...(!exists ? [{ title: '🆕 Initialize workspace definition', value: 'init' }] : []),
        ...(exists ? [
          { title: '✅ Validate definition', value: 'validate' },
          { title: '🏗️  Validate structure', value: 'structure' },
        ] : []),
        { title: '🔍 Auto-detect workspaces', value: 'auto-detect' },
        ...(exists ? [
          { title: '🔧 Fix issues', value: 'fix' },
          { title: '📊 Show status', value: 'status' }
        ] : [])
      ]
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'init':
      await initializeWorkspaceDefinition({ ...options, interactive: false });
      break;
    case 'validate':
      await validateWorkspaceDefinition({ ...options, interactive: false });
      break;
    case 'structure':
      await validateWorkspaceStructure({ ...options, interactive: false });
      break;
    case 'auto-detect':
      await autoDetectWorkspaces({ ...options, interactive: false });
      break;
    case 'fix':
      await fixWorkspaceDefinition({ ...options, interactive: false });
      break;
    case 'status':
      await showWorkspaceDefinitionStatus({ ...options, interactive: false });
      break;
  }
}

// Utility functions
function displayValidationResults(
  result: ValidationResult,
  fileName: string,
  strict: boolean,
  ignoreWarnings: boolean
): void {
  const hasIssues = result.errors.length > 0 || (!ignoreWarnings && result.warnings.length > 0);
  
  if (result.valid && !hasIssues) {
    console.log(chalk.green(`\\n✅ ${fileName} is valid`));
    
    if (result.suggestions.length > 0) {
      console.log(chalk.cyan(`\\n💡 Suggestions (${result.suggestions.length}):`));
      for (const suggestion of result.suggestions) {
        console.log(`  • ${suggestion.message}`);
        if (suggestion.fix) {
          console.log(`    ${chalk.green(suggestion.fix)}`);
        }
      }
    }
    return;
  }

  // Show errors
  if (result.errors.length > 0) {
    console.log(chalk.red(`\\n❌ Errors (${result.errors.length}):`));
    for (const error of result.errors) {
      console.log(`  • ${error.message}`);
    }
  }

  // Show warnings
  if (result.warnings.length > 0 && !ignoreWarnings) {
    console.log(chalk.yellow(`\\n⚠️  Warnings (${result.warnings.length}):`));
    for (const warning of result.warnings) {
      const severityIcon = warning.severity === 'high' ? '🔴' : warning.severity === 'medium' ? '🟡' : '🔵';
      console.log(`  ${severityIcon} ${warning.message}`);
      if (warning.path) {
        console.log(`    Path: ${chalk.gray(warning.path)}`);
      }
    }
  }

  // Show suggestions
  if (result.suggestions.length > 0) {
    console.log(chalk.cyan(`\\n💡 Suggestions (${result.suggestions.length}):`));
    for (const suggestion of result.suggestions) {
      console.log(`  • ${suggestion.message}`);
      if (suggestion.fix) {
        console.log(`    ${chalk.green(suggestion.fix)}`);
      }
    }
  }

  if (strict && result.warnings.length > 0) {
    console.log(chalk.red('\\n❌ Validation failed (strict mode enabled)'));
  }
}

function getWorkspaceTypeIcon(type: string): string {
  const icons = {
    app: '📱',
    package: '📦',
    lib: '📚',
    tool: '🔧',
    service: '⚙️',
    website: '🌐'
  };
  
  return icons[type as keyof typeof icons] || '📄';
}