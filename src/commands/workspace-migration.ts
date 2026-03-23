import chalk from 'chalk';
import prompts from 'prompts';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as semver from 'semver';
import {
  WorkspaceMigrationManager,
  MigrationPlan,
  MigrationResult,
  UpgradeOptions,
  ValidationResult,
  createWorkspaceMigrationManager,
  checkForUpgrades,
  validateWorkspace
} from '../utils/workspace-migration';
import { ProgressSpinner, createSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';

export interface WorkspaceMigrationCommandOptions {
  check?: boolean;
  plan?: boolean;
  upgrade?: boolean;
  validate?: boolean;
  history?: boolean;
  rollback?: boolean;
  interactive?: boolean;
  
  // Migration options
  targetVersion?: string;
  force?: boolean;
  dryRun?: boolean;
  backup?: boolean;
  skipValidation?: boolean;
  
  // File options
  file?: string;
  workspaceFile?: string;
  
  // Output options
  json?: boolean;
  verbose?: boolean;
  
  spinner?: ProgressSpinner;
}

const DEFAULT_WORKSPACE_FILE = 're-shell.workspaces.yaml';

export async function manageWorkspaceMigration(options: WorkspaceMigrationCommandOptions = {}): Promise<void> {
  const { spinner, verbose, json } = options;

  try {
    if (options.check) {
      await checkUpgrades(options, spinner);
      return;
    }

    if (options.plan) {
      await createMigrationPlan(options, spinner);
      return;
    }

    if (options.upgrade) {
      await upgradeWorkspace(options, spinner);
      return;
    }

    if (options.validate) {
      await validateWorkspaceDefinition(options, spinner);
      return;
    }

    if (options.history) {
      await showMigrationHistory(options, spinner);
      return;
    }

    if (options.rollback) {
      await rollbackMigration(options, spinner);
      return;
    }

    if (options.interactive) {
      await interactiveMigrationManagement(options, spinner);
      return;
    }

    // Default: check for upgrades
    await checkUpgrades(options, spinner);

  } catch (error) {
    if (error instanceof ValidationError) {
      if (spinner) spinner.stop();
      console.log(chalk.yellow('\n⚠️  No workspace definition found.'));
      console.log(chalk.cyan('\nRun \'re-shell workspace-def init\' to initialize your workspace.'));
      process.exit(1);
    }
    if (spinner) spinner.fail(chalk.red('Migration operation failed'));
    throw error;
  }
}

async function checkUpgrades(options: WorkspaceMigrationCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const workspaceFile = options.workspaceFile || DEFAULT_WORKSPACE_FILE;

  if (!(await fs.pathExists(workspaceFile))) {
    if (spinner) spinner.stop();
    console.log(chalk.yellow('\n⚠️  No workspace definition found.'));
    console.log(chalk.gray(`Expected: ${workspaceFile}`));
    console.log(chalk.cyan('\nRun \'re-shell workspace-def init\' to initialize your workspace.'));
    return;
  }

  if (spinner) spinner.setText('Checking for available upgrades...');

  try {
    const upgrades = await checkForUpgrades(workspaceFile);

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(upgrades, null, 2));
      return;
    }

    console.log(chalk.cyan('\n🔄 Workspace Upgrade Check'));
    console.log(chalk.gray('═'.repeat(50)));

    console.log(`Current version: ${chalk.yellow(upgrades.currentVersion)}`);

    if (upgrades.available.length === 0) {
      console.log(chalk.green('\n✅ Workspace is up to date!'));
      console.log(chalk.gray('No upgrades available for your current version.'));
      return;
    }

    console.log(`\n${chalk.blue('Available upgrades:')}`);
    for (const version of upgrades.available) {
      const type = semver.diff(upgrades.currentVersion, version);
      const icon = type === 'major' ? '🚨' : type === 'minor' ? '🔧' : '🔨';
      console.log(`  ${icon} ${version} (${type})`);
    }

    if (upgrades.recommended) {
      console.log(`\n${chalk.green('Recommended:')} ${upgrades.recommended}`);
    }

    if (upgrades.breaking && upgrades.breaking.length > 0) {
      console.log(`\n${chalk.red('Breaking changes in:')} ${upgrades.breaking.join(', ')}`);
    }

    console.log(chalk.cyan('\n🛠️  Commands:'));
    console.log(`  • Plan upgrade: re-shell workspace-migration plan --target-version ${upgrades.recommended}`);
    console.log(`  • Upgrade: re-shell workspace-migration upgrade --target-version ${upgrades.recommended}`);
    console.log('  • Interactive: re-shell workspace-migration interactive');

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to check upgrades'));
    throw error;
  }
}

async function createMigrationPlan(options: WorkspaceMigrationCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const workspaceFile = options.workspaceFile || DEFAULT_WORKSPACE_FILE;
  
  if (!options.targetVersion) {
    throw new ValidationError('Target version is required for migration planning');
  }

  if (spinner) spinner.setText('Creating migration plan...');

  try {
    const manager = await createWorkspaceMigrationManager();
    const definition = await manager['loadWorkspaceDefinition'](workspaceFile);
    const plan = await manager.createMigrationPlan(definition.version, options.targetVersion);

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(plan, null, 2));
      return;
    }

    console.log(chalk.cyan('\n📋 Migration Plan'));
    console.log(chalk.gray('═'.repeat(50)));

    console.log(`From: ${chalk.yellow(plan.currentVersion)}`);
    console.log(`To: ${chalk.green(plan.targetVersion)}`);
    console.log(`Steps: ${plan.steps.length}`);
    console.log(`Estimated duration: ${formatDuration(plan.estimatedDuration)}`);

    if (plan.hasBreakingChanges) {
      console.log(chalk.red('\n⚠️  This migration contains breaking changes!'));
    }

    if (plan.backupRequired) {
      console.log(chalk.yellow('\n💾 Backup will be created automatically'));
    }

    console.log(chalk.cyan('\n📝 Migration Steps:'));
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const icon = step.breaking ? '🚨' : '🔧';
      console.log(`  ${i + 1}. ${icon} ${step.name}`);
      if (options.verbose) {
        console.log(`     ${chalk.gray(step.description)}`);
        console.log(`     ${chalk.gray(`${step.fromVersion} → ${step.toVersion}`)}`);
      }
    }

    console.log(chalk.cyan('\n🚀 Next steps:'));
    console.log(`  • Execute: re-shell workspace-migration upgrade --target-version ${options.targetVersion}`);
    console.log(`  • Dry run: re-shell workspace-migration upgrade --target-version ${options.targetVersion} --dry-run`);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to create migration plan'));
    throw error;
  }
}

async function upgradeWorkspace(options: WorkspaceMigrationCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const workspaceFile = options.workspaceFile || DEFAULT_WORKSPACE_FILE;
  
  if (!options.targetVersion) {
    throw new ValidationError('Target version is required for upgrade');
  }

  if (spinner) spinner.setText('Preparing workspace upgrade...');

  try {
    const manager = await createWorkspaceMigrationManager();
    const definition = await manager['loadWorkspaceDefinition'](workspaceFile);
    const plan = await manager.createMigrationPlan(definition.version, options.targetVersion);

    if (spinner) spinner.setText('Executing migration...');

    const upgradeOptions: UpgradeOptions = {
      targetVersion: options.targetVersion,
      force: options.force,
      dryRun: options.dryRun,
      backup: options.backup ?? true,
      skipValidation: options.skipValidation,
      interactive: false
    };

    const result = await manager.executeMigration(workspaceFile, plan, upgradeOptions);

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (result.success) {
      if (options.dryRun) {
        console.log(chalk.cyan('🔍 Migration Dry Run Completed'));
      } else {
        console.log(chalk.green('✅ Migration completed successfully!'));
      }
    } else {
      console.log(chalk.red('❌ Migration failed!'));
    }

    console.log(chalk.gray('═'.repeat(50)));
    console.log(`From: ${chalk.yellow(result.fromVersion)}`);
    console.log(`To: ${chalk.green(result.toVersion)}`);
    console.log(`Duration: ${formatDuration(result.duration / 1000)}`);

    if (result.backupId) {
      console.log(`Backup: ${chalk.blue(result.backupId)}`);
    }

    if (result.stepsExecuted.length > 0) {
      console.log(`\n${chalk.cyan('Executed steps:')}`);
      for (const step of result.stepsExecuted) {
        console.log(`  ✓ ${step}`);
      }
    }

    if (result.warnings.length > 0) {
      console.log(`\n${chalk.yellow('Warnings:')}`);
      for (const warning of result.warnings) {
        console.log(`  ⚠️  ${warning}`);
      }
    }

    if (result.errors.length > 0) {
      console.log(`\n${chalk.red('Errors:')}`);
      for (const error of result.errors) {
        console.log(`  ❌ ${error}`);
      }
    }

    if (!options.dryRun && result.success) {
      // Record migration in history
      await manager.recordMigration(result.fromVersion, result.toVersion, result.backupId);
      
      console.log(chalk.cyan('\n🎉 Upgrade complete!'));
      console.log(chalk.gray('Run workspace validation to ensure everything is working:'));
      console.log('  re-shell workspace-migration validate');
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Migration failed'));
    throw error;
  }
}

async function validateWorkspaceDefinition(options: WorkspaceMigrationCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const workspaceFile = options.workspaceFile || DEFAULT_WORKSPACE_FILE;

  if (spinner) spinner.setText('Validating workspace definition...');

  try {
    const validation = await validateWorkspace(workspaceFile);

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(validation, null, 2));
      return;
    }

    console.log(chalk.cyan('\n🔍 Workspace Validation'));
    console.log(chalk.gray('═'.repeat(50)));

    if (validation.valid) {
      console.log(chalk.green('✅ Workspace definition is valid!'));
    } else {
      console.log(chalk.red('❌ Workspace definition has errors!'));
    }

    if (validation.errors.length > 0) {
      console.log(`\n${chalk.red('Errors:')} (${validation.errors.length})`);
      for (const error of validation.errors) {
        console.log(`  ❌ ${error}`);
      }
    }

    if (validation.warnings.length > 0) {
      console.log(`\n${chalk.yellow('Warnings:')} (${validation.warnings.length})`);
      for (const warning of validation.warnings) {
        console.log(`  ⚠️  ${warning}`);
      }
    }

    if (validation.suggestions.length > 0) {
      console.log(`\n${chalk.blue('Suggestions:')} (${validation.suggestions.length})`);
      for (const suggestion of validation.suggestions) {
        console.log(`  💡 ${suggestion}`);
      }
    }

    if (!validation.valid) {
      process.exit(1);
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Validation failed'));
    throw error;
  }
}

async function showMigrationHistory(options: WorkspaceMigrationCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const workspaceFile = options.workspaceFile || DEFAULT_WORKSPACE_FILE;

  if (spinner) spinner.setText('Loading migration history...');

  try {
    const manager = await createWorkspaceMigrationManager();
    const history = await manager.getMigrationHistory(workspaceFile);

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(history, null, 2));
      return;
    }

    if (history.migrations.length === 0) {
      console.log(chalk.yellow('\n📝 No migration history found'));
      console.log(chalk.gray('This workspace has not been migrated yet.'));
      return;
    }

    console.log(chalk.cyan('\n📚 Migration History'));
    console.log(chalk.gray('═'.repeat(50)));

    for (let i = history.migrations.length - 1; i >= 0; i--) {
      const migration = history.migrations[i];
      const date = new Date(migration.date).toLocaleString();
      
      console.log(`\n${i + 1}. ${chalk.yellow(migration.fromVersion)} → ${chalk.green(migration.toVersion)}`);
      console.log(`   Date: ${chalk.gray(date)}`);
      
      if (migration.backupId) {
        console.log(`   Backup: ${chalk.blue(migration.backupId)}`);
      }
    }

    console.log(chalk.cyan('\n🛠️  Commands:'));
    console.log('  • Show backup: re-shell workspace-backup show <backup-id>');
    console.log('  • Restore backup: re-shell workspace-backup restore <backup-id>');

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to load migration history'));
    throw error;
  }
}

async function rollbackMigration(options: WorkspaceMigrationCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Preparing rollback...');

  try {
    const manager = await createWorkspaceMigrationManager();
    const workspaceFile = options.workspaceFile || DEFAULT_WORKSPACE_FILE;
    const history = await manager.getMigrationHistory(workspaceFile);

    if (history.migrations.length === 0) {
      throw new ValidationError('No migration history found for rollback');
    }

    const lastMigration = history.migrations[history.migrations.length - 1];
    
    if (!lastMigration.backupId) {
      throw new ValidationError('No backup available for rollback');
    }

    if (spinner) spinner.setText(`Rolling back to backup: ${lastMigration.backupId}`);

    // Use backup restore functionality
    const { manageWorkspaceBackup } = await import('./workspace-backup');
    await manageWorkspaceBackup({
      restore: true,
      name: lastMigration.backupId,
      force: options.force
    });

    if (spinner) spinner.stop();

    console.log(chalk.green('✅ Rollback completed successfully!'));
    console.log(chalk.gray(`Restored to version: ${lastMigration.fromVersion}`));
    console.log(chalk.gray(`From backup: ${lastMigration.backupId}`));

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Rollback failed'));
    throw error;
  }
}

async function interactiveMigrationManagement(options: WorkspaceMigrationCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { title: '🔄 Check for upgrades', value: 'check' },
        { title: '📋 Create migration plan', value: 'plan' },
        { title: '🚀 Upgrade workspace', value: 'upgrade' },
        { title: '🔍 Validate workspace', value: 'validate' },
        { title: '📚 View migration history', value: 'history' },
        { title: '↩️  Rollback last migration', value: 'rollback' }
      ]
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'check':
      await checkUpgrades({ ...options, interactive: false });
      break;
    case 'plan':
      await createPlanInteractive(options);
      break;
    case 'upgrade':
      await upgradeInteractive(options);
      break;
    case 'validate':
      await validateWorkspaceDefinition({ ...options, interactive: false });
      break;
    case 'history':
      await showMigrationHistory({ ...options, interactive: false });
      break;
    case 'rollback':
      await rollbackInteractive(options);
      break;
  }
}

async function createPlanInteractive(options: WorkspaceMigrationCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'workspaceFile',
      message: 'Workspace file:',
      initial: 're-shell.workspaces.yaml'
    },
    {
      type: 'text',
      name: 'targetVersion',
      message: 'Target version:'
    }
  ]);

  if (!response.workspaceFile || !response.targetVersion) return;

  await createMigrationPlan({
    ...options,
    ...response,
    interactive: false
  });
}

async function upgradeInteractive(options: WorkspaceMigrationCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'workspaceFile',
      message: 'Workspace file:',
      initial: 're-shell.workspaces.yaml'
    },
    {
      type: 'text',
      name: 'targetVersion',
      message: 'Target version:'
    },
    {
      type: 'confirm',
      name: 'dryRun',
      message: 'Perform dry run first?',
      initial: true
    },
    {
      type: prev => prev ? null : 'confirm',
      name: 'backup',
      message: 'Create backup before upgrade?',
      initial: true
    },
    {
      type: prev => prev === false ? null : 'confirm',
      name: 'force',
      message: 'Force upgrade (skip confirmations)?',
      initial: false
    }
  ]);

  if (!response.workspaceFile || !response.targetVersion) return;

  await upgradeWorkspace({
    ...options,
    ...response,
    interactive: false
  });
}

async function rollbackInteractive(options: WorkspaceMigrationCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'workspaceFile',
      message: 'Workspace file:',
      initial: 're-shell.workspaces.yaml'
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to rollback the last migration?',
      initial: false
    },
    {
      type: prev => prev ? 'confirm' : null,
      name: 'force',
      message: 'Force rollback (overwrite existing files)?',
      initial: false
    }
  ]);

  if (!response.confirm) {
    console.log(chalk.yellow('Rollback cancelled'));
    return;
  }

  await rollbackMigration({
    ...options,
    ...response,
    interactive: false
  });
}

// Utility functions
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(0)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}