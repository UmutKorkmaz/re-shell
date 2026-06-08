import chalk from 'chalk';
import prompts from 'prompts';
import * as path from 'path';
import * as fs from 'fs-extra';
import yaml from 'yaml';
import { configDiffer, ConfigDiffer, ConfigDiff, MergeResult, MergeStrategies, MergeStrategy } from '../utils/config-diff';
import { configManager } from '../utils/config';
import { ProgressSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';

export interface ConfigDiffCommandOptions {
  diff?: boolean;
  merge?: boolean;
  apply?: boolean;
  left?: string;
  right?: string;
  output?: string;
  strategy?: string;
  format?: 'text' | 'html' | 'json';
  interactive?: boolean;
  verbose?: boolean;
  ignoreOrder?: boolean;
  ignorePaths?: string;
  json?: boolean;
  spinner?: ProgressSpinner;
}

export async function manageConfigDiff(options: ConfigDiffCommandOptions = {}): Promise<void> {
  const { spinner, verbose, json } = options;

  try {
    if (options.diff) {
      await performDiff(options, spinner);
      return;
    }

    if (options.merge) {
      await performMerge(options, spinner);
      return;
    }

    if (options.apply && options.left) {
      await applyDiff(options, spinner);
      return;
    }

    if (options.interactive) {
      await interactiveDiffMerge(options, spinner);
      return;
    }

    // Default: show help or current configuration status
    await showConfigStatus(options, spinner);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Configuration diff/merge operation failed'));
    throw error;
  }
}

async function performDiff(options: ConfigDiffCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!options.left || !options.right) {
    throw new ValidationError('Both --left and --right configuration sources are required for diff');
  }

  if (spinner) spinner.setText('Comparing configurations...');

  // Load configurations
  const { leftConfig, rightConfig, leftSource, rightSource } = await loadConfigSources(
    options.left, 
    options.right
  );

  // Configure differ
  const differ = new ConfigDiffer({
    ignoreOrder: options.ignoreOrder,
    ignorePaths: options.ignorePaths ? options.ignorePaths.split(',') : [],
    includeMetadata: true,
    deepComparison: true
  });

  // Perform diff
  const diff = await differ.diff(leftConfig, rightConfig, leftSource, rightSource);

  if (spinner) spinner.stop();

  // Output results
  if (options.json) {
    console.log(JSON.stringify(diff, null, 2));
  } else {
    const report = differ.generateDiffReport(diff, options.format || 'text');
    
    if (options.format === 'html' && options.output) {
      await fs.writeFile(options.output, report);
      console.log(chalk.green(`✅ HTML diff report saved to: ${options.output}`));
    } else {
      console.log(report);
    }

    // Show summary
    console.log(chalk.cyan('\\n📊 Diff Summary:'));
    console.log(`Total changes: ${diff.summary.total}`);
    if (diff.summary.total > 0) {
      console.log(`• Added: ${chalk.green(diff.summary.added)} items`);
      console.log(`• Removed: ${chalk.red(diff.summary.removed)} items`);
      console.log(`• Changed: ${chalk.yellow(diff.summary.changed)} items`);
      console.log(`• Moved: ${chalk.blue(diff.summary.moved)} items`);
    } else {
      console.log(chalk.green('🎉 Configurations are identical!'));
    }
  }
}

async function performMerge(options: ConfigDiffCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!options.left || !options.right) {
    throw new ValidationError('Both --left and --right configuration sources are required for merge');
  }

  if (spinner) spinner.setText('Merging configurations...');

  // Load configurations
  const { leftConfig, rightConfig, leftSource, rightSource } = await loadConfigSources(
    options.left, 
    options.right
  );

  // Get merge strategy
  let strategy: MergeStrategy;
  if (options.strategy) {
    strategy = getMergeStrategy(options.strategy);
  } else if (options.interactive) {
    strategy = await getInteractiveMergeStrategy();
  } else {
    strategy = MergeStrategies.smartMerge();
  }

  // Perform merge
  const result = await configDiffer.merge(leftConfig, rightConfig, strategy, leftSource, rightSource);

  if (spinner) spinner.stop();

  // Handle conflicts if any
  if (result.conflicts.length > 0 && strategy.conflictResolution === 'interactive') {
    await resolveConflictsInteractively(result);
  }

  // Output results
  if (options.output) {
    const outputPath = path.resolve(options.output);
    
    if (outputPath.endsWith('.json')) {
      await fs.writeFile(outputPath, JSON.stringify(result.merged, null, 2));
    } else {

      await fs.writeFile(outputPath, yaml.stringify(result.merged));
    }
    
    console.log(chalk.green(`✅ Merged configuration saved to: ${outputPath}`));
  } else if (options.json) {
    console.log(JSON.stringify(result.merged, null, 2));
  } else {

    console.log(chalk.cyan('\\n🔀 Merged Configuration:'));
    console.log(chalk.gray('═'.repeat(40)));
    console.log(yaml.stringify(result.merged));
  }

  // Show merge summary
  console.log(chalk.cyan('\\n📊 Merge Summary:'));
  if (result.conflicts.length > 0) {
    console.log(`Conflicts: ${chalk.red(result.conflicts.length)}`);
    result.conflicts.forEach((conflict, index) => {
      console.log(`  ${index + 1}. ${conflict.path}: ${conflict.reason} (${conflict.resolution})`);
    });
  } else {
    console.log(chalk.green('✅ No conflicts detected'));
  }

  if (result.warnings.length > 0) {
    console.log(`Warnings: ${chalk.yellow(result.warnings.length)}`);
    result.warnings.forEach((warning, index) => {
      console.log(`  ${index + 1}. ${warning}`);
    });
  }
}

async function applyDiff(options: ConfigDiffCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!options.left || !options.right) {
    throw new ValidationError('Both --left (base config) and --right (diff file) are required for apply');
  }

  if (spinner) spinner.setText('Applying diff...');

  // Load base configuration
  const baseConfig = await loadConfigFromSource(options.left);
  
  // Load diff from file
  const diffContent = await fs.readFile(options.right, 'utf8');
  const diff: ConfigDiff = JSON.parse(diffContent);

  // Apply diff
  const result = await configDiffer.applyDiff(baseConfig, diff);

  if (spinner) spinner.stop();

  // Output results
  if (options.output) {
    const outputPath = path.resolve(options.output);
    
    if (outputPath.endsWith('.json')) {
      await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
    } else {

      await fs.writeFile(outputPath, yaml.stringify(result));
    }
    
    console.log(chalk.green(`✅ Configuration with applied diff saved to: ${outputPath}`));
  } else if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {

    console.log(chalk.cyan('\\n📄 Configuration with Applied Diff:'));
    console.log(chalk.gray('═'.repeat(40)));
    console.log(yaml.stringify(result));
  }

  console.log(chalk.green(`\\n✅ Applied ${diff.summary.total} changes from diff`));
}

async function interactiveDiffMerge(options: ConfigDiffCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const response = await prompts([
    {
      type: 'select',
      name: 'operation',
      message: 'What would you like to do?',
      choices: [
        { title: '🔍 Compare two configurations (diff)', value: 'diff' },
        { title: '🔀 Merge two configurations', value: 'merge' },
        { title: '📊 Apply diff to configuration', value: 'apply' },
        { title: '📈 Compare configuration levels', value: 'levels' },
        { title: '🔄 Create configuration patch', value: 'patch' }
      ]
    }
  ]);

  if (!response.operation) return;

  switch (response.operation) {
    case 'diff':
      await interactiveDiff();
      break;
    case 'merge':
      await interactiveMerge();
      break;
    case 'apply':
      await interactiveApply();
      break;
    case 'levels':
      await compareLevels();
      break;
    case 'patch':
      await createPatch();
      break;
  }
}

async function interactiveDiff(): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'left',
      message: 'Left configuration (file path or source):',
      validate: (value: string) => value.trim() ? true : 'Left configuration is required'
    },
    {
      type: 'text',
      name: 'right',
      message: 'Right configuration (file path or source):',
      validate: (value: string) => value.trim() ? true : 'Right configuration is required'
    },
    {
      type: 'select',
      name: 'format',
      message: 'Output format:',
      choices: [
        { title: 'Text (console)', value: 'text' },
        { title: 'HTML report', value: 'html' },
        { title: 'JSON data', value: 'json' }
      ]
    },
    {
      type: 'toggle',
      name: 'ignoreOrder',
      message: 'Ignore array order?',
      initial: false,
      active: 'yes',
      inactive: 'no'
    },
    {
      type: 'text',
      name: 'output',
      message: 'Output file (optional):',
      validate: (value: string, answers: any) => {
        if (!value) return true;
        if (answers.format === 'html' && !value.endsWith('.html')) {
          return 'HTML format requires .html extension';
        }
        if (answers.format === 'json' && !value.endsWith('.json')) {
          return 'JSON format requires .json extension';
        }
        return true;
      }
    }
  ]);

  if (!response.left || !response.right) return;

  await performDiff({
    diff: true,
    left: response.left,
    right: response.right,
    format: response.format,
    ignoreOrder: response.ignoreOrder,
    output: response.output
  });
}

async function interactiveMerge(): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'left',
      message: 'Base configuration (file path or source):',
      validate: (value: string) => value.trim() ? true : 'Base configuration is required'
    },
    {
      type: 'text',
      name: 'right',
      message: 'Incoming configuration (file path or source):',
      validate: (value: string) => value.trim() ? true : 'Incoming configuration is required'
    },
    {
      type: 'select',
      name: 'strategy',
      message: 'Merge strategy:',
      choices: [
        { title: '🧠 Smart merge (recommended)', value: 'smart' },
        { title: '⬅️  Prefer base (left wins)', value: 'left' },
        { title: '➡️  Prefer incoming (right wins)', value: 'right' },
        { title: '🛡️  Conservative merge', value: 'conservative' },
        { title: '🤝 Interactive resolution', value: 'interactive' }
      ]
    },
    {
      type: 'text',
      name: 'output',
      message: 'Output file path:',
      validate: (value: string) => value.trim() ? true : 'Output file is required for merge'
    }
  ]);

  if (!response.left || !response.right || !response.output) return;

  await performMerge({
    merge: true,
    left: response.left,
    right: response.right,
    strategy: response.strategy,
    output: response.output,
    interactive: response.strategy === 'interactive'
  });
}

async function interactiveApply(): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'config',
      message: 'Base configuration file:',
      validate: (value: string) => value.trim() ? true : 'Configuration file is required'
    },
    {
      type: 'text',
      name: 'diff',
      message: 'Diff file (JSON format):',
      validate: (value: string) => {
        if (!value.trim()) return 'Diff file is required';
        if (!value.endsWith('.json')) return 'Diff file must be JSON format';
        return true;
      }
    },
    {
      type: 'text',
      name: 'output',
      message: 'Output file path:',
      validate: (value: string) => value.trim() ? true : 'Output file is required'
    }
  ]);

  if (!response.config || !response.diff || !response.output) return;

  await applyDiff({
    apply: true,
    left: response.config,
    right: response.diff,
    output: response.output
  });
}

async function compareLevels(): Promise<void> {
  console.log(chalk.cyan('\\n🏗️  Configuration Levels Comparison'));
  console.log(chalk.gray('Compare global, project, and workspace configurations'));

  const response = await prompts([
    {
      type: 'text',
      name: 'workspace',
      message: 'Workspace path (optional):',
      initial: process.cwd()
    }
  ]);

  // Load all configuration levels
  const globalConfig = await configManager.loadGlobalConfig();
  const projectConfig = await configManager.loadProjectConfig();
  const workspaceConfig = response.workspace 
    ? await configManager.loadWorkspaceConfig(response.workspace)
    : null;

  // Compare each level
  console.log(chalk.cyan('\\n📊 Configuration Levels Analysis:'));

  if (projectConfig) {
    const globalVsProject = await configDiffer.diff(
      globalConfig, 
      projectConfig, 
      'global', 
      'project'
    );
    
    console.log(chalk.blue('\\n🌍 Global vs Project:'));
    console.log(`  Changes: ${globalVsProject.summary.total}`);
    if (globalVsProject.summary.total > 0) {
      console.log(`  • Added: ${globalVsProject.summary.added}`);
      console.log(`  • Changed: ${globalVsProject.summary.changed}`);
      console.log(`  • Removed: ${globalVsProject.summary.removed}`);
    }
  }

  if (workspaceConfig) {
    const projectVsWorkspace = await configDiffer.diff(
      projectConfig || globalConfig,
      workspaceConfig,
      projectConfig ? 'project' : 'global',
      'workspace'
    );

    console.log(chalk.green('\\n🏢 Project vs Workspace:'));
    console.log(`  Changes: ${projectVsWorkspace.summary.total}`);
    if (projectVsWorkspace.summary.total > 0) {
      console.log(`  • Added: ${projectVsWorkspace.summary.added}`);
      console.log(`  • Changed: ${projectVsWorkspace.summary.changed}`);
      console.log(`  • Removed: ${projectVsWorkspace.summary.removed}`);
    }
  }

  // Show inheritance chain
  const merged = await configManager.getMergedConfig();
  console.log(chalk.magenta('\\n🔗 Final Configuration Source:'));
  console.log(`  Package Manager: ${merged.merged.packageManager} (from ${getConfigSource('packageManager', globalConfig, projectConfig, workspaceConfig)})`);
  console.log(`  Framework: ${merged.merged.framework} (from ${getConfigSource('framework', globalConfig, projectConfig, workspaceConfig)})`);
  console.log(`  Template: ${merged.merged.template} (from ${getConfigSource('template', globalConfig, projectConfig, workspaceConfig)})`);
}

async function createPatch(): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'original',
      message: 'Original configuration file:',
      validate: (value: string) => value.trim() ? true : 'Original file is required'
    },
    {
      type: 'text',
      name: 'modified',
      message: 'Modified configuration file:',
      validate: (value: string) => value.trim() ? true : 'Modified file is required'
    },
    {
      type: 'text',
      name: 'output',
      message: 'Patch file output path:',
      initial: 'config.patch.json',
      validate: (value: string) => value.trim() ? true : 'Output path is required'
    }
  ]);

  if (!response.original || !response.modified || !response.output) return;

  // Create diff (which serves as our patch)
  const diff = await configDiffer.diffFiles(response.original, response.modified);
  
  // Save patch
  await fs.writeFile(response.output, JSON.stringify(diff, null, 2));
  
  console.log(chalk.green(`\\n✅ Patch created: ${response.output}`));
  console.log(`Changes: ${diff.summary.total}`);
  console.log(chalk.gray('Apply with: re-shell config-diff apply --left <original> --right <patch> --output <result>'));
}

async function showConfigStatus(options: ConfigDiffCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Analyzing configuration status...');

  // Load current configurations
  const globalConfig = await configManager.loadGlobalConfig();
  const projectConfig = await configManager.loadProjectConfig();
  const merged = await configManager.getMergedConfig();

  if (spinner) spinner.stop();

  console.log(chalk.cyan('\\n📊 Configuration Status'));
  console.log(chalk.gray('═'.repeat(40)));

  console.log(chalk.blue('\\nConfiguration Levels:'));
  console.log(`  🌍 Global: ${chalk.green('✓')} (${Object.keys(globalConfig).length} properties)`);
  console.log(`  📁 Project: ${projectConfig ? chalk.green('✓') : chalk.red('✗')} ${projectConfig ? `(${Object.keys(projectConfig).length} properties)` : ''}`);

  if (projectConfig) {
    // Calculate inheritance
    const diff = await configDiffer.diff(globalConfig, projectConfig);
    console.log(`\\n🔗 Inheritance Analysis:`);
    console.log(`  Overrides: ${diff.summary.changed} properties`);
    console.log(`  Additions: ${diff.summary.added} properties`);
    console.log(`  Total customization: ${diff.summary.total} changes`);
  }

  console.log(chalk.cyan('\\n🛠️  Available Operations:'));
  console.log('  • re-shell config-diff --diff --left <file1> --right <file2>');
  console.log('  • re-shell config-diff --merge --left <base> --right <incoming> --output <result>');
  console.log('  • re-shell config-diff --interactive');
}

// Helper functions
async function loadConfigSources(leftSource: string, rightSource: string): Promise<{
  leftConfig: any;
  rightConfig: any;
  leftSource: string;
  rightSource: string;
}> {
  const leftConfig = await loadConfigFromSource(leftSource);
  const rightConfig = await loadConfigFromSource(rightSource);

  return {
    leftConfig,
    rightConfig,
    leftSource,
    rightSource
  };
}

async function loadConfigFromSource(source: string): Promise<any> {
  // Handle special sources
  if (source === 'global') {
    return configManager.loadGlobalConfig();
  }
  
  if (source === 'project') {
    const config = await configManager.loadProjectConfig();
    if (!config) throw new ValidationError('No project configuration found');
    return config;
  }

  if (source.startsWith('workspace:')) {
    const workspacePath = source.substring(10);
    const config = await configManager.loadWorkspaceConfig(workspacePath);
    if (!config) throw new ValidationError(`No workspace configuration found at ${workspacePath}`);
    return config;
  }

  // Load from file
  if (await fs.pathExists(source)) {
    const content = await fs.readFile(source, 'utf8');
    
    if (source.endsWith('.json')) {
      return JSON.parse(content);
    } else if (source.endsWith('.yaml') || source.endsWith('.yml')) {

      return yaml.parse(content);
    } else {
      throw new ValidationError(`Unsupported file format: ${source}`);
    }
  }

  throw new ValidationError(`Configuration source not found: ${source}`);
}

function getMergeStrategy(strategyName: string): MergeStrategy {
  switch (strategyName) {
    case 'left':
      return MergeStrategies.leftWins();
    case 'right':
      return MergeStrategies.rightWins();
    case 'smart':
      return MergeStrategies.smartMerge();
    case 'conservative':
      return MergeStrategies.conservative();
    case 'interactive':
      return MergeStrategies.interactive();
    default:
      throw new ValidationError(`Unknown merge strategy: ${strategyName}`);
  }
}

async function getInteractiveMergeStrategy(): Promise<MergeStrategy> {
  const response = await prompts([
    {
      type: 'select',
      name: 'conflictResolution',
      message: 'How to resolve conflicts?',
      choices: [
        { title: 'Prefer base configuration', value: 'left' },
        { title: 'Prefer incoming configuration', value: 'right' },
        { title: 'Ask for each conflict', value: 'interactive' }
      ]
    },
    {
      type: 'select',
      name: 'arrayMerge',
      message: 'How to merge arrays?',
      choices: [
        { title: 'Union (combine unique items)', value: 'union' },
        { title: 'Concatenate (append all)', value: 'concat' },
        { title: 'Replace with incoming', value: 'replace' }
      ]
    },
    {
      type: 'toggle',
      name: 'preserveOrder',
      message: 'Preserve object key order?',
      initial: true,
      active: 'yes',
      inactive: 'no'
    }
  ]);

  return {
    arrayMerge: response.arrayMerge,
    conflictResolution: response.conflictResolution,
    preserveComments: true,
    preserveOrder: response.preserveOrder
  };
}

async function resolveConflictsInteractively(result: MergeResult): Promise<void> {
  console.log(chalk.yellow(`\\n⚠️  Found ${result.conflicts.length} conflicts to resolve:`));

  for (const conflict of result.conflicts) {
    if (conflict.resolution !== 'unresolved') continue;

    console.log(chalk.cyan(`\\n🔥 Conflict at: ${conflict.path}`));
    console.log(chalk.gray(conflict.reason));
    
    const response = await prompts([
      {
        type: 'select',
        name: 'resolution',
        message: 'How to resolve this conflict?',
        choices: [
          { title: `Use base value: ${formatConflictValue(conflict.leftValue)}`, value: 'left' },
          { title: `Use incoming value: ${formatConflictValue(conflict.rightValue)}`, value: 'right' },
          { title: 'Enter custom value', value: 'custom' }
        ]
      }
    ]);

    if (response.resolution === 'custom') {
      const customResponse = await prompts([
        {
          type: 'text',
          name: 'value',
          message: 'Enter custom value:',
          initial: String(conflict.rightValue)
        }
      ]);

      try {
        conflict.resolvedValue = JSON.parse(customResponse.value);
      } catch {
        conflict.resolvedValue = customResponse.value;
      }
      conflict.resolution = 'custom';
    } else if (response.resolution === 'left') {
      conflict.resolvedValue = conflict.leftValue;
      conflict.resolution = 'left';
    } else if (response.resolution === 'right') {
      conflict.resolvedValue = conflict.rightValue;
      conflict.resolution = 'right';
    }

    // Apply resolution to merged result
    setValueAtPath(result.merged, conflict.path, conflict.resolvedValue);
  }
}

function formatConflictValue(value: any): string {
  if (typeof value === 'string') return `"${value}"`;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function setValueAtPath(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  
  let current = obj;
  for (const key of keys) {
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[lastKey] = value;
}

function getConfigSource(
  property: string, 
  global: any, 
  project: any, 
  workspace: any
): string {
  if (workspace && workspace[property] !== undefined) return 'workspace';
  if (project && project[property] !== undefined) return 'project';
  return 'global';
}