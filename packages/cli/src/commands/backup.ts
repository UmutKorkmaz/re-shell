import chalk from 'chalk';
import prompts from 'prompts';
import * as path from 'path';
import * as fs from 'fs-extra';
import { configBackupManager, BackupMetadata, RestoreOptions } from '../utils/config-backup';
import { ProgressSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';

export interface BackupCommandOptions {
  create?: boolean;
  restore?: string;
  list?: boolean;
  delete?: string;
  export?: string;
  import?: string;
  cleanup?: boolean;
  stats?: boolean;
  full?: boolean;
  selective?: boolean;
  name?: string;
  description?: string;
  tags?: string;
  output?: string;
  force?: boolean;
  dryRun?: boolean;
  keepCount?: number;
  keepDays?: number;
  preBackup?: boolean;
  mergeStrategy?: 'replace' | 'merge' | 'skip-existing';
  interactive?: boolean;
  json?: boolean;
  verbose?: boolean;
  spinner?: ProgressSpinner;
}

export async function manageBackups(options: BackupCommandOptions = {}): Promise<void> {
  const { spinner, verbose, json } = options;

  try {
    if (options.create) {
      await createBackup(options, spinner);
      return;
    }

    if (options.restore) {
      await restoreBackup(options.restore, options, spinner);
      return;
    }

    if (options.list) {
      await listBackups(options, spinner);
      return;
    }

    if (options.delete) {
      await deleteBackup(options.delete, options, spinner);
      return;
    }

    if (options.export) {
      await exportBackup(options.export, options, spinner);
      return;
    }

    if (options.import) {
      await importBackup(options.import, options, spinner);
      return;
    }

    if (options.cleanup) {
      await cleanupBackups(options, spinner);
      return;
    }

    if (options.stats) {
      await showBackupStats(options, spinner);
      return;
    }

    if (options.interactive) {
      await interactiveBackupManagement(options, spinner);
      return;
    }

    // Default: show backup status
    await showBackupStatus(options, spinner);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Backup operation failed'));
    throw error;
  }
}

async function createBackup(options: BackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (options.full) {
    await createFullBackup(options, spinner);
  } else if (options.selective) {
    await createSelectiveBackup(options, spinner);
  } else if (options.interactive) {
    await interactiveCreateBackup(spinner);
  } else {
    // Default to full backup
    await createFullBackup(options, spinner);
  }
}

async function createFullBackup(options: BackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Creating full configuration backup...');

  const name = options.name || `full-backup-${new Date().toISOString().split('T')[0]}`;
  const description = options.description;
  const tags = options.tags ? options.tags.split(',').map(t => t.trim()) : [];

  const backupId = await configBackupManager.createFullBackup(name, description, tags);

  if (spinner) {
    spinner.succeed(chalk.green('Full backup created successfully!'));
  }

  console.log(chalk.cyan(`\\n📦 Backup Created`));
  console.log(`ID: ${chalk.yellow(backupId)}`);
  console.log(`Name: ${name}`);
  if (description) console.log(`Description: ${description}`);
  if (tags.length > 0) console.log(`Tags: ${tags.join(', ')}`);
}

async function createSelectiveBackup(options: BackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Creating selective configuration backup...');

  // For CLI usage, we need to determine what to back up
  const backupOptions = {
    global: true, // Always include global by default
    project: true, // Include project if exists
    workspaces: [], // TODO: Add workspace detection
    templates: true,
    environments: false
  };

  const name = options.name || `selective-backup-${new Date().toISOString().split('T')[0]}`;
  const description = options.description;
  const tags = options.tags ? options.tags.split(',').map(t => t.trim()) : ['selective'];

  const backupId = await configBackupManager.createSelectiveBackup(
    name,
    backupOptions,
    description,
    tags
  );

  if (spinner) {
    spinner.succeed(chalk.green('Selective backup created successfully!'));
  }

  console.log(chalk.cyan(`\\n📦 Selective Backup Created`));
  console.log(`ID: ${chalk.yellow(backupId)}`);
  console.log(`Name: ${name}`);
  console.log(`Contents: ${Object.entries(backupOptions)
    .filter(([_, value]) => value === true || (Array.isArray(value) && value.length > 0))
    .map(([key]) => key)
    .join(', ')}`);
}

async function interactiveCreateBackup(spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const response = await prompts([
    {
      type: 'select',
      name: 'type',
      message: 'What type of backup would you like to create?',
      choices: [
        { title: '📦 Full backup (all configurations)', value: 'full' },
        { title: '🎯 Selective backup (choose what to include)', value: 'selective' }
      ]
    },
    {
      type: 'text',
      name: 'name',
      message: 'Backup name:',
      initial: `backup-${new Date().toISOString().split('T')[0]}`,
      validate: (value: string) => value.trim() ? true : 'Backup name is required'
    },
    {
      type: 'text',
      name: 'description',
      message: 'Description (optional):',
    },
    {
      type: 'list',
      name: 'tags',
      message: 'Tags (comma-separated, optional):',
      separator: ','
    }
  ]);

  if (!response.name) return;

  if (response.type === 'selective') {
    const selectiveResponse = await prompts([
      {
        type: 'multiselect',
        name: 'contents',
        message: 'What would you like to include in the backup?',
        choices: [
          { title: '🌍 Global configuration', value: 'global', selected: true },
          { title: '📁 Project configuration', value: 'project', selected: true },
          { title: '🏗️  Workspace configurations', value: 'workspaces', selected: true },
          { title: '📋 Configuration templates', value: 'templates', selected: true },
          { title: '🌐 Environment configurations', value: 'environments', selected: false }
        ]
      }
    ]);

    const backupOptions = {
      global: selectiveResponse.contents.includes('global'),
      project: selectiveResponse.contents.includes('project'),
      workspaces: selectiveResponse.contents.includes('workspaces') ? [] : undefined,
      templates: selectiveResponse.contents.includes('templates'),
      environments: selectiveResponse.contents.includes('environments')
    };

    const backupId = await configBackupManager.createSelectiveBackup(
      response.name,
      backupOptions,
      response.description,
      response.tags || []
    );

    console.log(chalk.green(`\\n✅ Selective backup created: ${backupId}`));
  } else {
    const backupId = await configBackupManager.createFullBackup(
      response.name,
      response.description,
      response.tags || []
    );

    console.log(chalk.green(`\\n✅ Full backup created: ${backupId}`));
  }
}

async function restoreBackup(backupId: string, options: BackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Restoring from backup: ${backupId}`);

  const backup = await configBackupManager.getBackup(backupId);
  if (!backup) {
    if (spinner) spinner.fail(chalk.red(`Backup '${backupId}' not found`));
    return;
  }

  if (spinner) spinner.stop();

  // Show backup info
  console.log(chalk.cyan(`\\n🔄 Restoring from Backup`));
  console.log(`Name: ${backup.metadata.name}`);
  console.log(`Created: ${new Date(backup.metadata.createdAt).toLocaleDateString()}`);
  console.log(`Type: ${backup.metadata.type}`);

  // Confirm restoration unless force is used
  if (!options.force && !options.dryRun) {
    const confirmation = await prompts([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Are you sure you want to restore from this backup? This will overwrite current configurations.',
        initial: false
      }
    ]);

    if (!confirmation.confirmed) {
      console.log(chalk.yellow('Restoration cancelled.'));
      return;
    }
  }

  const restoreOptions: RestoreOptions = {
    force: options.force,
    createBackupBeforeRestore: options.preBackup !== false,
    dryRun: options.dryRun,
    mergeStrategy: options.mergeStrategy || 'replace'
  };

  await configBackupManager.restoreFromBackup(backupId, restoreOptions);

  if (!options.dryRun) {
    console.log(chalk.green('\\n✅ Configuration restored successfully!'));
  }
}

async function listBackups(options: BackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Loading backups...');

  const backups = await configBackupManager.listBackups();

  if (spinner) spinner.stop();

  if (backups.length === 0) {
    console.log(chalk.yellow('No backups found.'));
    console.log(chalk.gray('Create your first backup with: re-shell backup create'));
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(backups, null, 2));
    return;
  }

  console.log(chalk.cyan(`\\n📦 Configuration Backups (${backups.length})`));
  console.log(chalk.gray('═'.repeat(60)));

  for (const backup of backups) {
    const age = formatAge(backup.createdAt);
    const size = formatBytes(backup.size);
    
    console.log(chalk.cyan(`\\n📄 ${backup.name}`));
    console.log(`   ID: ${chalk.yellow(backup.id)}`);
    console.log(`   Type: ${getTypeIcon(backup.type)} ${backup.type}`);
    console.log(`   Created: ${age} (${size})`);
    
    if (backup.description) {
      console.log(`   Description: ${chalk.gray(backup.description)}`);
    }
    
    if (backup.tags.length > 0) {
      console.log(`   Tags: ${backup.tags.map(tag => chalk.blue(tag)).join(', ')}`);
    }

    // Show contents
    const contents = [];
    if (backup.contents.global) contents.push('global');
    if (backup.contents.project) contents.push('project');
    if (backup.contents.workspaces && backup.contents.workspaces.length > 0) {
      contents.push(`workspaces(${backup.contents.workspaces.length})`);
    }
    if (backup.contents.templates) contents.push('templates');
    if (backup.contents.environments) contents.push('environments');
    
    console.log(`   Contents: ${contents.join(', ')}`);

    if (options.verbose) {
      console.log(`   Checksum: ${backup.checksum}`);
      console.log(`   Version: ${backup.version}`);
    }
  }
}

async function deleteBackup(backupId: string, options: BackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Deleting backup: ${backupId}`);

  const backup = await configBackupManager.getBackup(backupId);
  if (!backup) {
    if (spinner) spinner.fail(chalk.red(`Backup '${backupId}' not found`));
    return;
  }

  if (spinner) spinner.stop();

  // Confirm deletion unless force is used
  if (!options.force) {
    const confirmation = await prompts([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Are you sure you want to delete backup '${backup.metadata.name}'?`,
        initial: false
      }
    ]);

    if (!confirmation.confirmed) {
      console.log(chalk.yellow('Deletion cancelled.'));
      return;
    }
  }

  await configBackupManager.deleteBackup(backupId);
  console.log(chalk.green(`✅ Backup '${backup.metadata.name}' deleted successfully!`));
}

async function exportBackup(backupId: string, options: BackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!options.output) {
    throw new ValidationError('Output file path is required for export (--output)');
  }

  if (spinner) spinner.setText(`Exporting backup: ${backupId}`);

  await configBackupManager.exportBackup(backupId, options.output);

  if (spinner) {
    spinner.succeed(chalk.green('Backup exported successfully!'));
  }

  console.log(chalk.cyan(`\\n📤 Backup Exported`));
  console.log(`File: ${options.output}`);
}

async function importBackup(filePath: string, options: BackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Importing backup from: ${filePath}`);

  const backupId = await configBackupManager.importBackup(filePath);

  if (spinner) {
    spinner.succeed(chalk.green('Backup imported successfully!'));
  }

  console.log(chalk.cyan(`\\n📥 Backup Imported`));
  console.log(`ID: ${chalk.yellow(backupId)}`);
}

async function cleanupBackups(options: BackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Analyzing backups for cleanup...');

  const cleanupOptions = {
    keepCount: options.keepCount,
    keepDays: options.keepDays,
    dryRun: options.dryRun || false
  };

  const deleted = await configBackupManager.cleanup(cleanupOptions);

  if (spinner) spinner.stop();

  if (deleted.length === 0) {
    console.log(chalk.green('✅ No backups need cleanup'));
    return;
  }

  if (options.dryRun) {
    console.log(chalk.yellow(`\\n🧹 Cleanup Preview (${deleted.length} backups would be deleted):`));
  } else {
    console.log(chalk.green(`\\n🧹 Cleanup Complete (${deleted.length} backups deleted):`));
  }

  for (const backupId of deleted) {
    console.log(`  • ${backupId}`);
  }
}

async function showBackupStats(options: BackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Calculating backup statistics...');

  const stats = await configBackupManager.getBackupStats();

  if (spinner) spinner.stop();

  if (options.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log(chalk.cyan('\\n📊 Backup Statistics'));
  console.log(chalk.gray('═'.repeat(40)));

  console.log(`\\nTotal backups: ${chalk.yellow(stats.totalBackups)}`);
  console.log(`Total size: ${chalk.yellow(formatBytes(stats.totalSize))}`);
  console.log(`Average size: ${chalk.yellow(formatBytes(stats.averageSize))}`);

  if (stats.oldestBackup && stats.newestBackup) {
    console.log(`\\nOldest: ${stats.oldestBackup.name} (${formatAge(stats.oldestBackup.createdAt)})`);
    console.log(`Newest: ${stats.newestBackup.name} (${formatAge(stats.newestBackup.createdAt)})`);
  }

  console.log(`\\nBackups by type:`);
  for (const [type, count] of Object.entries(stats.backupsByType)) {
    console.log(`  ${getTypeIcon(type)} ${type}: ${count}`);
  }
}

async function showBackupStatus(options: BackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Checking backup system status...');

  const stats = await configBackupManager.getBackupStats();

  if (spinner) spinner.stop();

  console.log(chalk.cyan('\\n💾 Backup System Status'));
  console.log(chalk.gray('═'.repeat(40)));

  if (stats.totalBackups === 0) {
    console.log(chalk.yellow('\\n⚠️  No backups found'));
    console.log(chalk.gray('Consider creating your first backup to protect your configurations.'));
  } else {
    console.log(`\\n✅ ${stats.totalBackups} backup(s) available`);
    console.log(`📦 Total size: ${formatBytes(stats.totalSize)}`);
    
    if (stats.newestBackup) {
      const age = formatAge(stats.newestBackup.createdAt);
      console.log(`🕐 Latest backup: ${age}`);
    }
  }

  console.log(chalk.cyan('\\n🛠️  Available Operations:'));
  console.log('  • re-shell backup create --full');
  console.log('  • re-shell backup create --selective');
  console.log('  • re-shell backup list');
  console.log('  • re-shell backup restore <id>');
  console.log('  • re-shell backup interactive');
}

async function interactiveBackupManagement(options: BackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { title: '📦 Create new backup', value: 'create' },
        { title: '📋 List all backups', value: 'list' },
        { title: '🔄 Restore from backup', value: 'restore' },
        { title: '📊 Show backup statistics', value: 'stats' },
        { title: '🧹 Cleanup old backups', value: 'cleanup' },
        { title: '📤 Export backup', value: 'export' },
        { title: '📥 Import backup', value: 'import' },
        { title: '🗑️  Delete backup', value: 'delete' }
      ]
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'create':
      await interactiveCreateBackup();
      break;
    case 'list':
      await listBackups(options);
      break;
    case 'restore':
      await interactiveRestore();
      break;
    case 'stats':
      await showBackupStats(options);
      break;
    case 'cleanup':
      await interactiveCleanup();
      break;
    case 'export':
      await interactiveExport();
      break;
    case 'import':
      await interactiveImport();
      break;
    case 'delete':
      await interactiveDelete();
      break;
  }
}

async function interactiveRestore(): Promise<void> {
  const backups = await configBackupManager.listBackups();
  
  if (backups.length === 0) {
    console.log(chalk.yellow('No backups available for restoration.'));
    return;
  }

  const response = await prompts([
    {
      type: 'select',
      name: 'backupId',
      message: 'Select backup to restore:',
      choices: backups.map(backup => ({
        title: `${backup.name} - ${backup.type} (${formatAge(backup.createdAt)})`,
        value: backup.id
      }))
    },
    {
      type: 'select',
      name: 'strategy',
      message: 'Merge strategy:',
      choices: [
        { title: 'Replace existing configurations', value: 'replace' },
        { title: 'Merge with existing (keep both)', value: 'merge' },
        { title: 'Skip if already exists', value: 'skip-existing' }
      ]
    },
    {
      type: 'toggle',
      name: 'preBackup',
      message: 'Create backup before restoration?',
      initial: true,
      active: 'yes',
      inactive: 'no'
    },
    {
      type: 'toggle',
      name: 'dryRun',
      message: 'Dry run (preview only)?',
      initial: false,
      active: 'yes',
      inactive: 'no'
    }
  ]);

  if (!response.backupId) return;

  await restoreBackup(response.backupId, {
    mergeStrategy: response.strategy,
    preBackup: response.preBackup,
    dryRun: response.dryRun,
    force: false
  });
}

async function interactiveCleanup(): Promise<void> {
  const response = await prompts([
    {
      type: 'number',
      name: 'keepCount',
      message: 'Keep how many recent backups? (0 = no limit)',
      initial: 10,
      min: 0
    },
    {
      type: 'number',
      name: 'keepDays',
      message: 'Keep backups newer than how many days? (0 = no limit)',
      initial: 30,
      min: 0
    },
    {
      type: 'toggle',
      name: 'dryRun',
      message: 'Dry run (preview only)?',
      initial: true,
      active: 'yes',
      inactive: 'no'
    }
  ]);

  await cleanupBackups({
    keepCount: response.keepCount != null ? response.keepCount : undefined,
    keepDays: response.keepDays != null ? response.keepDays : undefined,
    dryRun: response.dryRun
  });
}

async function interactiveExport(): Promise<void> {
  const backups = await configBackupManager.listBackups();
  
  if (backups.length === 0) {
    console.log(chalk.yellow('No backups available for export.'));
    return;
  }

  const response = await prompts([
    {
      type: 'select',
      name: 'backupId',
      message: 'Select backup to export:',
      choices: backups.map(backup => ({
        title: `${backup.name} - ${backup.type} (${formatAge(backup.createdAt)})`,
        value: backup.id
      }))
    },
    {
      type: 'text',
      name: 'output',
      message: 'Export file path:',
      initial: 'backup-export.json',
      validate: (value: string) => value.trim() ? true : 'Output path is required'
    }
  ]);

  if (!response.backupId || !response.output) return;

  await exportBackup(response.backupId, { output: response.output });
}

async function interactiveImport(): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'filePath',
      message: 'Backup file path to import:',
      validate: (value: string) => value.trim() ? true : 'File path is required'
    }
  ]);

  if (!response.filePath) return;

  await importBackup(response.filePath, {});
}

async function interactiveDelete(): Promise<void> {
  const backups = await configBackupManager.listBackups();
  
  if (backups.length === 0) {
    console.log(chalk.yellow('No backups available for deletion.'));
    return;
  }

  const response = await prompts([
    {
      type: 'select',
      name: 'backupId',
      message: 'Select backup to delete:',
      choices: backups.map(backup => ({
        title: `${backup.name} - ${backup.type} (${formatAge(backup.createdAt)})`,
        value: backup.id
      }))
    }
  ]);

  if (!response.backupId) return;

  await deleteBackup(response.backupId, { force: false });
}

// Utility functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatAge(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  return 'just now';
}

function getTypeIcon(type: string): string {
  const icons = {
    full: '📦',
    selective: '🎯',
    global: '🌍',
    project: '📁',
    workspace: '🏗️'
  };
  return icons[type as keyof typeof icons] || '📄';
}