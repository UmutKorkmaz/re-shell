import chalk from 'chalk';
import prompts from 'prompts';
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  WorkspaceConflictManager,
  WorkspaceConflict,
  ConflictResolution,
  ConflictDetectionOptions,
  ConflictResolutionResult,
  ConflictSeverity,
  ConflictType,
  createWorkspaceConflictManager,
  detectWorkspaceConflicts,
  autoResolveConflicts
} from '../utils/workspace-conflict';
import { createSpinner, ProgressSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';

export interface WorkspaceConflictCommandOptions {
  detect?: boolean;
  resolve?: boolean;
  preview?: boolean;
  autoResolve?: boolean;
  interactive?: boolean;
  
  // Detection options
  includeWarnings?: boolean;
  checkDependencies?: boolean;
  checkPorts?: boolean;
  checkPaths?: boolean;
  checkTypes?: boolean;
  
  // Resolution options
  conflictId?: string;
  resolutionId?: string;
  force?: boolean;
  
  // File options
  file?: string;
  workspaceFile?: string;
  
  // Output options
  json?: boolean;
  verbose?: boolean;
  groupBy?: 'type' | 'severity' | 'workspace';
  
  spinner?: ProgressSpinner;
}

const DEFAULT_WORKSPACE_FILE = 're-shell.workspaces.yaml';

export async function manageWorkspaceConflict(options: WorkspaceConflictCommandOptions = {}): Promise<void> {
  const { spinner, verbose, json } = options;

  try {
    if (options.detect) {
      await detectConflicts(options, spinner);
      return;
    }

    if (options.resolve) {
      await resolveConflicts(options, spinner);
      return;
    }

    if (options.preview) {
      await previewResolution(options, spinner);
      return;
    }

    if (options.autoResolve) {
      await autoResolveAllConflicts(options, spinner);
      return;
    }

    if (options.interactive) {
      await interactiveConflictManagement(options, spinner);
      return;
    }

    // Default: detect conflicts
    await detectConflicts(options, spinner);

  } catch (error) {
    if (error instanceof ValidationError) {
      if (spinner) spinner.stop();
      console.log(chalk.yellow(`\n⚠️  ${error.message}`));
      console.log(
        chalk.cyan(
          '\nWorkspace conflict commands require a workspace definition created with \'re-shell workspace def init\'.'
        )
      );
      process.exit(1);
    }
    if (spinner) spinner.fail(chalk.red('Conflict management failed'));
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      console.error('Make sure you have a valid re-shell workspace. Run "re-shell init" to initialize.');
    } else {
      console.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}

async function detectConflicts(options: WorkspaceConflictCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const workspaceFile = options.workspaceFile || DEFAULT_WORKSPACE_FILE;

  if (!(await fs.pathExists(workspaceFile))) {
    if (spinner) spinner.stop();
    console.log(chalk.yellow('\n⚠️  No workspace definition found.'));
    console.log(chalk.gray(`Expected: ${workspaceFile}`));
    console.log(chalk.cyan('\nRun \'re-shell workspace-def init\' to initialize your workspace.'));
    return;
  }

  if (spinner) spinner.setText('Detecting workspace conflicts...');

  try {
    const detectionOptions: ConflictDetectionOptions = {
      includeWarnings: options.includeWarnings ?? true,
      checkDependencies: options.checkDependencies ?? true,
      checkPorts: options.checkPorts ?? true,
      checkPaths: options.checkPaths ?? true,
      checkTypes: options.checkTypes ?? true,
      enableResolution: true
    };

    const conflicts = await detectWorkspaceConflicts(workspaceFile, detectionOptions);

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(conflicts, null, 2));
      return;
    }

    if (conflicts.length === 0) {
      console.log(chalk.green('\\n✅ No conflicts detected!'));
      console.log(chalk.gray('Your workspace definition is conflict-free.'));
      return;
    }

    console.log(chalk.cyan('\\n🔍 Workspace Conflict Analysis'));
    console.log(chalk.gray('═'.repeat(50)));

    const errorCount = conflicts.filter(c => c.severity === 'error').length;
    const warningCount = conflicts.filter(c => c.severity === 'warning').length;
    const infoCount = conflicts.filter(c => c.severity === 'info').length;

    console.log(`Found ${chalk.red(errorCount)} errors, ${chalk.yellow(warningCount)} warnings, ${chalk.blue(infoCount)} info`);

    if (options.groupBy === 'type') {
      displayConflictsByType(conflicts, options);
    } else if (options.groupBy === 'severity') {
      displayConflictsBySeverity(conflicts, options);
    } else if (options.groupBy === 'workspace') {
      displayConflictsByWorkspace(conflicts, options);
    } else {
      displayConflictsList(conflicts, options);
    }

    if (errorCount > 0) {
      console.log(chalk.cyan('\\n🛠️  Resolution Commands:'));
      console.log('  • Auto-resolve: re-shell workspace-conflict auto-resolve');
      console.log('  • Interactive: re-shell workspace-conflict interactive');
      console.log('  • Manual resolve: re-shell workspace-conflict resolve --conflict-id <id>');
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to detect conflicts'));
    throw error;
  }
}

async function resolveConflicts(options: WorkspaceConflictCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const workspaceFile = options.workspaceFile || DEFAULT_WORKSPACE_FILE;
  
  if (!options.conflictId) {
    throw new ValidationError('Conflict ID is required for manual resolution');
  }

  if (spinner) spinner.setText('Resolving workspace conflicts...');

  try {
    const manager = await createWorkspaceConflictManager();
    const definition = await manager['loadWorkspaceDefinition'](workspaceFile);
    const conflicts = await manager.detectConflicts(definition);
    
    const conflict = conflicts.find(c => c.id === options.conflictId);
    if (!conflict) {
      throw new ValidationError(`Conflict not found: ${options.conflictId}`);
    }

    let resolutionId = options.resolutionId;
    
    // If no resolution specified, prompt user
    if (!resolutionId && !options.force) {
      if (spinner) spinner.stop();
      
      const response = await prompts([
        {
          type: 'select',
          name: 'resolution',
          message: `Choose resolution for: ${conflict.description}`,
          choices: conflict.suggestions.map(r => ({
            title: `${r.description} (${r.riskLevel} risk)`,
            value: r.id,
            description: r.preview
          }))
        }
      ]);
      
      if (!response.resolution) return;
      resolutionId = response.resolution;
    } else if (!resolutionId) {
      // Auto-select first automatic resolution
      const autoResolution = conflict.suggestions.find(r => r.automatic);
      if (autoResolution) {
        resolutionId = autoResolution.id;
      } else {
        throw new ValidationError('No automatic resolution available. Please specify --resolution-id');
      }
    }

    if (spinner) spinner.setText('Applying resolution...');

    const result = await manager.resolveConflicts(definition, [conflict], true);
    
    await manager['saveWorkspaceDefinition'](workspaceFile, definition);

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (result.resolved.length > 0) {
      console.log(chalk.green('\\n✅ Conflict resolved successfully!'));
      
      console.log(chalk.cyan('\\n📝 Changes made:'));
      for (const change of result.changes) {
        console.log(`  • ${change.target}.${change.property}: ${chalk.red(String(change.oldValue))} → ${chalk.green(String(change.newValue))}`);
        console.log(`    ${chalk.gray(change.reason)}`);
      }
    } else {
      console.log(chalk.red('\\n❌ Failed to resolve conflict'));
      
      if (result.warnings.length > 0) {
        console.log(chalk.yellow('\\nWarnings:'));
        for (const warning of result.warnings) {
          console.log(`  ⚠️  ${warning}`);
        }
      }
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to resolve conflict'));
    throw error;
  }
}

async function previewResolution(options: WorkspaceConflictCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const workspaceFile = options.workspaceFile || DEFAULT_WORKSPACE_FILE;
  
  if (!options.conflictId || !options.resolutionId) {
    throw new ValidationError('Both conflict ID and resolution ID are required for preview');
  }

  if (spinner) spinner.setText('Previewing resolution...');

  try {
    const manager = await createWorkspaceConflictManager();
    const definition = await manager['loadWorkspaceDefinition'](workspaceFile);
    const conflicts = await manager.detectConflicts(definition);
    
    const conflict = conflicts.find(c => c.id === options.conflictId);
    if (!conflict) {
      throw new ValidationError(`Conflict not found: ${options.conflictId}`);
    }

    const preview = await manager.previewResolution(definition, conflict, options.resolutionId);

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(preview, null, 2));
      return;
    }

    console.log(chalk.cyan('\\n🔍 Resolution Preview'));
    console.log(chalk.gray('═'.repeat(50)));

    console.log(`Conflict: ${chalk.yellow(conflict.description)}`);
    console.log(`Resolution: ${chalk.blue(conflict.suggestions.find(r => r.id === options.resolutionId)?.description)}`);

    if (preview.success) {
      console.log(chalk.green('\\n✅ Preview successful'));
      
      console.log(chalk.cyan('\\n📝 Proposed changes:'));
      for (const change of preview.changes) {
        console.log(`  • ${change.target}.${change.property}: ${chalk.red(String(change.oldValue))} → ${chalk.green(String(change.newValue))}`);
        console.log(`    ${chalk.gray(change.reason)}`);
      }
    } else {
      console.log(chalk.red('\\n❌ Preview failed'));
      
      if (preview.warnings.length > 0) {
        console.log(chalk.yellow('\\nWarnings:'));
        for (const warning of preview.warnings) {
          console.log(`  ⚠️  ${warning}`);
        }
      }
    }

    console.log(chalk.cyan('\\n🚀 Apply resolution:'));
    console.log(`  re-shell workspace-conflict resolve --conflict-id ${options.conflictId} --resolution-id ${options.resolutionId}`);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to preview resolution'));
    throw error;
  }
}

async function autoResolveAllConflicts(options: WorkspaceConflictCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const workspaceFile = options.workspaceFile || DEFAULT_WORKSPACE_FILE;

  if (spinner) spinner.setText('Auto-resolving all conflicts...');

  try {
    const result = await autoResolveConflicts(workspaceFile);

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(chalk.cyan('\\n🤖 Auto-Resolution Results'));
    console.log(chalk.gray('═'.repeat(50)));

    console.log(`Resolved: ${chalk.green(result.resolved.length)} conflicts`);
    console.log(`Unresolved: ${chalk.red(result.unresolved.length)} conflicts`);

    if (result.resolved.length > 0) {
      console.log(chalk.cyan('\\n✅ Resolved conflicts:'));
      for (const conflict of result.resolved) {
        console.log(`  • ${conflict.description}`);
      }

      console.log(chalk.cyan('\\n📝 Changes made:'));
      for (const change of result.changes) {
        console.log(`  • ${change.target}.${change.property}: ${chalk.red(String(change.oldValue))} → ${chalk.green(String(change.newValue))}`);
      }
    }

    if (result.unresolved.length > 0) {
      console.log(chalk.yellow('\\n⚠️  Unresolved conflicts (require manual intervention):'));
      for (const conflict of result.unresolved) {
        console.log(`  • ${conflict.description}`);
      }

      console.log(chalk.cyan('\\n🛠️  Manual resolution:'));
      console.log('  re-shell workspace-conflict interactive');
    }

    if (result.warnings.length > 0) {
      console.log(chalk.yellow('\\n⚠️  Warnings:'));
      for (const warning of result.warnings) {
        console.log(`  ${warning}`);
      }
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Auto-resolution failed'));
    throw error;
  }
}

async function interactiveConflictManagement(options: WorkspaceConflictCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { title: '🔍 Detect conflicts', value: 'detect' },
        { title: '🤖 Auto-resolve all conflicts', value: 'auto-resolve' },
        { title: '🛠️  Manual conflict resolution', value: 'manual' },
        { title: '👀 Preview resolution', value: 'preview' },
        { title: '📊 Conflict analysis', value: 'analysis' }
      ]
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'detect':
      await detectConflictsInteractive(options);
      break;
    case 'auto-resolve':
      await autoResolveAllConflicts({ ...options, interactive: false });
      break;
    case 'manual':
      await manualResolutionInteractive(options);
      break;
    case 'preview':
      await previewResolutionInteractive(options);
      break;
    case 'analysis':
      await conflictAnalysisInteractive(options);
      break;
  }
}

async function detectConflictsInteractive(options: WorkspaceConflictCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'workspaceFile',
      message: 'Workspace file:',
      initial: 're-shell.workspaces.yaml'
    },
    {
      type: 'multiselect',
      name: 'checks',
      message: 'Select checks to perform:',
      choices: [
        { title: 'Dependencies', value: 'dependencies', selected: true },
        { title: 'Ports', value: 'ports', selected: true },
        { title: 'Paths', value: 'paths', selected: true },
        { title: 'Types', value: 'types', selected: true }
      ]
    },
    {
      type: 'confirm',
      name: 'includeWarnings',
      message: 'Include warnings?',
      initial: true
    },
    {
      type: 'select',
      name: 'groupBy',
      message: 'Group results by:',
      choices: [
        { title: 'Conflict type', value: 'type' },
        { title: 'Severity', value: 'severity' },
        { title: 'Workspace', value: 'workspace' },
        { title: 'None (list)', value: 'none' }
      ]
    }
  ]);

  if (!response.workspaceFile) return;

  await detectConflicts({
    ...options,
    ...response,
    checkDependencies: response.checks.includes('dependencies'),
    checkPorts: response.checks.includes('ports'),
    checkPaths: response.checks.includes('paths'),
    checkTypes: response.checks.includes('types'),
    groupBy: response.groupBy === 'none' ? undefined : response.groupBy,
    interactive: false
  });
}

async function manualResolutionInteractive(options: WorkspaceConflictCommandOptions): Promise<void> {
  const workspaceFile = options.workspaceFile || DEFAULT_WORKSPACE_FILE;
  
  // First detect conflicts
  const conflicts = await detectWorkspaceConflicts(workspaceFile);
  
  if (conflicts.length === 0) {
    console.log(chalk.green('\\n✅ No conflicts to resolve!'));
    return;
  }

  const response = await prompts([
    {
      type: 'select',
      name: 'conflictId',
      message: 'Select conflict to resolve:',
      choices: conflicts.map(c => ({
        title: `${getSeverityIcon(c.severity)} ${c.description}`,
        value: c.id,
        description: c.details
      }))
    }
  ]);

  if (!response.conflictId) return;

  const conflict = conflicts.find(c => c.id === response.conflictId);
  if (!conflict) return;

  const resolutionResponse = await prompts([
    {
      type: 'select',
      name: 'resolutionId',
      message: 'Choose resolution:',
      choices: conflict.suggestions.map(r => ({
        title: `${r.description} (${r.riskLevel} risk)`,
        value: r.id,
        description: r.preview
      }))
    },
    {
      type: 'confirm',
      name: 'preview',
      message: 'Preview changes before applying?',
      initial: true
    }
  ]);

  if (!resolutionResponse.resolutionId) return;

  if (resolutionResponse.preview) {
    await previewResolution({
      ...options,
      conflictId: response.conflictId,
      resolutionId: resolutionResponse.resolutionId,
      interactive: false
    });

    const confirmResponse = await prompts([
      {
        type: 'confirm',
        name: 'apply',
        message: 'Apply this resolution?',
        initial: false
      }
    ]);

    if (!confirmResponse.apply) return;
  }

  await resolveConflicts({
    ...options,
    conflictId: response.conflictId,
    resolutionId: resolutionResponse.resolutionId,
    interactive: false
  });
}

async function previewResolutionInteractive(options: WorkspaceConflictCommandOptions): Promise<void> {
  const workspaceFile = options.workspaceFile || DEFAULT_WORKSPACE_FILE;
  const conflicts = await detectWorkspaceConflicts(workspaceFile);

  if (conflicts.length === 0) {
    console.log(chalk.green('\\n✅ No conflicts to preview!'));
    return;
  }

  const response = await prompts([
    {
      type: 'select',
      name: 'conflictId',
      message: 'Select conflict:',
      choices: conflicts.map(c => ({
        title: `${getSeverityIcon(c.severity)} ${c.description}`,
        value: c.id
      }))
    }
  ]);

  if (!response.conflictId) return;

  const conflict = conflicts.find(c => c.id === response.conflictId);
  if (!conflict) return;

  const resolutionResponse = await prompts([
    {
      type: 'select',
      name: 'resolutionId',
      message: 'Select resolution to preview:',
      choices: conflict.suggestions.map(r => ({
        title: r.description,
        value: r.id
      }))
    }
  ]);

  if (!resolutionResponse.resolutionId) return;

  await previewResolution({
    ...options,
    conflictId: response.conflictId,
    resolutionId: resolutionResponse.resolutionId,
    interactive: false
  });
}

async function conflictAnalysisInteractive(options: WorkspaceConflictCommandOptions): Promise<void> {
  const workspaceFile = options.workspaceFile || DEFAULT_WORKSPACE_FILE;
  const conflicts = await detectWorkspaceConflicts(workspaceFile);

  console.log(chalk.cyan('\\n📊 Conflict Analysis Dashboard'));
  console.log(chalk.gray('═'.repeat(50)));

  if (conflicts.length === 0) {
    console.log(chalk.green('✅ No conflicts detected - workspace is healthy!'));
    return;
  }

  // Analysis by severity
  const severityStats = {
    error: conflicts.filter(c => c.severity === 'error').length,
    warning: conflicts.filter(c => c.severity === 'warning').length,
    info: conflicts.filter(c => c.severity === 'info').length
  };

  console.log(chalk.cyan('\\nBy Severity:'));
  console.log(`  ${chalk.red('●')} Errors: ${severityStats.error}`);
  console.log(`  ${chalk.yellow('●')} Warnings: ${severityStats.warning}`);
  console.log(`  ${chalk.blue('●')} Info: ${severityStats.info}`);

  // Analysis by type
  const typeStats: Record<ConflictType, number> = {} as any;
  for (const conflict of conflicts) {
    typeStats[conflict.type] = (typeStats[conflict.type] || 0) + 1;
  }

  console.log(chalk.cyan('\\nBy Type:'));
  for (const [type, count] of Object.entries(typeStats)) {
    console.log(`  • ${type}: ${count}`);
  }

  // Most affected workspaces
  const workspaceStats: Record<string, number> = {};
  for (const conflict of conflicts) {
    for (const workspace of conflict.affectedWorkspaces) {
      workspaceStats[workspace] = (workspaceStats[workspace] || 0) + 1;
    }
  }

  const topAffected = Object.entries(workspaceStats)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  if (topAffected.length > 0) {
    console.log(chalk.cyan('\\nMost Affected Workspaces:'));
    for (const [workspace, count] of topAffected) {
      console.log(`  • ${workspace}: ${count} conflicts`);
    }
  }

  // Automatic resolution potential
  const autoResolvable = conflicts.filter(c => 
    c.suggestions.some(s => s.automatic && s.riskLevel === 'low')
  ).length;

  console.log(chalk.cyan('\\nResolution Summary:'));
  console.log(`  • Auto-resolvable (low risk): ${chalk.green(autoResolvable)}`);
  console.log(`  • Requires manual intervention: ${chalk.yellow(conflicts.length - autoResolvable)}`);

  if (autoResolvable > 0) {
    console.log(chalk.cyan('\\n🤖 Quick fix:'));
    console.log('  re-shell workspace-conflict auto-resolve');
  }
}

// Display helper functions
function displayConflictsList(conflicts: WorkspaceConflict[], options: WorkspaceConflictCommandOptions): void {
  console.log(chalk.cyan('\\n📋 Conflicts:'));
  
  for (let i = 0; i < conflicts.length; i++) {
    const conflict = conflicts[i];
    const icon = getSeverityIcon(conflict.severity);
    
    console.log(`\\n${i + 1}. ${icon} ${chalk.bold(conflict.description)}`);
    console.log(`   ID: ${chalk.gray(conflict.id)}`);
    console.log(`   Type: ${chalk.blue(conflict.type)}`);
    console.log(`   Affected: ${conflict.affectedWorkspaces.join(', ')}`);
    
    if (options.verbose) {
      console.log(`   Details: ${chalk.gray(conflict.details)}`);
      console.log(`   Resolutions: ${conflict.suggestions.length} available`);
    }
  }
}

function displayConflictsByType(conflicts: WorkspaceConflict[], options: WorkspaceConflictCommandOptions): void {
  const byType: Record<string, WorkspaceConflict[]> = {};
  
  for (const conflict of conflicts) {
    if (!byType[conflict.type]) {
      byType[conflict.type] = [];
    }
    byType[conflict.type].push(conflict);
  }

  for (const [type, typeConflicts] of Object.entries(byType)) {
    console.log(chalk.cyan(`\\n📂 ${type.toUpperCase()} (${typeConflicts.length})`));
    
    for (const conflict of typeConflicts) {
      const icon = getSeverityIcon(conflict.severity);
      console.log(`  ${icon} ${conflict.description}`);
      
      if (options.verbose) {
        console.log(`     ${chalk.gray(conflict.details)}`);
      }
    }
  }
}

function displayConflictsBySeverity(conflicts: WorkspaceConflict[], options: WorkspaceConflictCommandOptions): void {
  const severityOrder: ConflictSeverity[] = ['error', 'warning', 'info'];
  
  for (const severity of severityOrder) {
    const severityConflicts = conflicts.filter(c => c.severity === severity);
    
    if (severityConflicts.length === 0) continue;
    
    const icon = getSeverityIcon(severity);
    console.log(chalk.cyan(`\\n${icon} ${severity.toUpperCase()} (${severityConflicts.length})`));
    
    for (const conflict of severityConflicts) {
      console.log(`  • ${conflict.description}`);
      
      if (options.verbose) {
        console.log(`    ${chalk.gray(conflict.details)}`);
      }
    }
  }
}

function displayConflictsByWorkspace(conflicts: WorkspaceConflict[], options: WorkspaceConflictCommandOptions): void {
  const byWorkspace: Record<string, WorkspaceConflict[]> = {};
  
  for (const conflict of conflicts) {
    for (const workspace of conflict.affectedWorkspaces) {
      if (!byWorkspace[workspace]) {
        byWorkspace[workspace] = [];
      }
      byWorkspace[workspace].push(conflict);
    }
  }

  for (const [workspace, workspaceConflicts] of Object.entries(byWorkspace)) {
    console.log(chalk.cyan(`\\n🏗️  ${workspace} (${workspaceConflicts.length})`));
    
    for (const conflict of workspaceConflicts) {
      const icon = getSeverityIcon(conflict.severity);
      console.log(`  ${icon} ${conflict.description}`);
    }
  }
}

function getSeverityIcon(severity: ConflictSeverity): string {
  switch (severity) {
    case 'error': return '❌';
    case 'warning': return '⚠️';
    case 'info': return 'ℹ️';
    default: return '•';
  }
}
