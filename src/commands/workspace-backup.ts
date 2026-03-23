import chalk from 'chalk';
import prompts from 'prompts';
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  WorkspaceBackupManager,
  BackupMetadata,
  BackupOptions,
  RestoreOptions,
  createWorkspaceBackupManager,
  createQuickBackup,
  compareBackups
} from '../utils/workspace-backup';
import { ProgressSpinner, createSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';

export interface WorkspaceBackupCommandOptions {
  create?: boolean;
  list?: boolean;
  restore?: boolean;
  delete?: boolean;
  export?: boolean;
  import?: boolean;
  cleanup?: boolean;
  show?: boolean;
  compare?: boolean;
  interactive?: boolean;
  
  // Backup options
  name?: string;
  description?: string;
  includeState?: boolean;
  includeCache?: boolean;
  includeTemplates?: boolean;
  includeFiles?: boolean;
  filePatterns?: string;
  tags?: string;
  
  // Restore options
  force?: boolean;
  selective?: boolean;
  restoreState?: boolean;
  restoreCache?: boolean;
  restoreTemplates?: boolean;
  restoreFiles?: boolean;
  targetPath?: string;
  
  // File options
  file?: string;
  workspaceFile?: string;
  output?: string;
  
  // Cleanup options
  keepCount?: number;
  keepDays?: number;
  dryRun?: boolean;
  
  // Comparison options
  backup1?: string;
  backup2?: string;
  
  // Output options
  json?: boolean;
  verbose?: boolean;
  
  spinner?: ProgressSpinner;
}

const DEFAULT_WORKSPACE_FILE = 're-shell.workspaces.yaml';

export async function manageWorkspaceBackup(options: WorkspaceBackupCommandOptions = {}): Promise<void> {
  const { spinner, verbose, json } = options;

  try {
    if (options.create) {
      await createBackup(options, spinner);
      return;
    }

    if (options.list) {
      await listBackups(options, spinner);
      return;
    }

    if (options.restore) {
      await restoreBackup(options, spinner);
      return;
    }

    if (options.delete) {
      await deleteBackup(options, spinner);
      return;
    }

    if (options.export) {
      await exportBackup(options, spinner);
      return;
    }

    if (options.import) {
      await importBackup(options, spinner);
      return;
    }

    if (options.cleanup) {
      await cleanupBackups(options, spinner);
      return;
    }

    if (options.show) {
      await showBackup(options, spinner);
      return;
    }

    if (options.compare) {
      await compareBackupsCommand(options, spinner);
      return;
    }

    if (options.interactive) {
      await interactiveBackupManagement(options, spinner);
      return;
    }

    // Default: list backups
    await listBackups(options, spinner);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Backup operation failed'));
    throw error;
  }
}

async function createBackup(options: WorkspaceBackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const workspaceFile = options.workspaceFile || DEFAULT_WORKSPACE_FILE;
  
  if (!(await fs.pathExists(workspaceFile))) {
    throw new ValidationError(`Workspace file not found: ${workspaceFile}`);
  }

  if (spinner) spinner.setText('Creating workspace backup...');

  try {
    const manager = await createWorkspaceBackupManager();
    
    const backupOptions: BackupOptions = {
      name: options.name,
      description: options.description,
      includeState: options.includeState ?? true,
      includeCache: options.includeCache ?? false,
      includeTemplates: options.includeTemplates ?? true,
      includeFiles: options.includeFiles ?? false,
      filePatterns: options.filePatterns ? options.filePatterns.split(',') : undefined,
      tags: options.tags ? options.tags.split(',') : undefined
    };

    const backupId = await manager.createBackup(workspaceFile, backupOptions);

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify({ backupId }, null, 2));
    } else {
      console.log(chalk.green('✅ Backup created successfully!'));
      console.log(chalk.gray(`Backup ID: ${backupId}`));
      console.log(chalk.gray(`Workspace: ${workspaceFile}`));
      
      if (backupOptions.includeState) {
        console.log(chalk.gray('✓ Included workspace state'));
      }
      if (backupOptions.includeTemplates) {
        console.log(chalk.gray('✓ Included templates'));
      }
      if (backupOptions.includeCache) {
        console.log(chalk.gray('✓ Included cache'));
      }
      if (backupOptions.includeFiles) {
        console.log(chalk.gray('✓ Included files'));
      }
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to create backup'));
    throw error;
  }
}

async function listBackups(options: WorkspaceBackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Loading backups...');

  try {
    const manager = await createWorkspaceBackupManager();
    const backups = await manager.listBackups();

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(backups, null, 2));
      return;
    }

    if (backups.length === 0) {
      console.log(chalk.yellow('\n⚠️  No backups found'));
      console.log(chalk.gray('Create one with: re-shell workspace-backup create'));
      return;
    }

    console.log(chalk.cyan('\n💾 Workspace Backups'));
    console.log(chalk.gray('═'.repeat(60)));

    for (const backup of backups) {
      const date = new Date(backup.timestamp).toLocaleString();
      const size = formatBytes(backup.size);
      
      console.log(`\n${chalk.bold(backup.name)} (${backup.id.substring(0, 8)})`);
      console.log(`  ${chalk.gray(`Created: ${date}`)}`);
      console.log(`  ${chalk.gray(`Size: ${size}`)}`);
      console.log(`  ${chalk.gray(`Workspace: ${backup.workspaceFile}`)}`);
      
      if (backup.description) {
        console.log(`  ${chalk.gray(`Description: ${backup.description}`)}`);
      }
      
      if (backup.tags && backup.tags.length > 0) {
        console.log(`  ${chalk.blue(`Tags: ${backup.tags.join(', ')}`)}`);
      }

      const includes: string[] = [];
      if (backup.includeState) includes.push('state');
      if (backup.includeCache) includes.push('cache');
      if (backup.includeTemplates) includes.push('templates');
      
      if (includes.length > 0) {
        console.log(`  ${chalk.green(`Includes: ${includes.join(', ')}`)}`);
      }

      if (options.verbose) {
        console.log(`  ${chalk.gray(`Hash: ${backup.hash.substring(0, 16)}...`)}`);
      }
    }

    const stats = manager.getBackupStatistics();
    console.log(chalk.cyan('\n📊 Statistics:'));
    console.log(`  Total backups: ${stats.totalBackups}`);
    console.log(`  Total size: ${formatBytes(stats.totalSize)}`);
    console.log(`  Average size: ${formatBytes(stats.averageSize)}`);

    console.log(chalk.cyan('\n🛠️  Commands:'));
    console.log('  • re-shell workspace-backup show <id>');
    console.log('  • re-shell workspace-backup restore <id>');
    console.log('  • re-shell workspace-backup export <id>');

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to load backups'));
    throw error;
  }
}

async function restoreBackup(options: WorkspaceBackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!options.name) {
    throw new ValidationError('Backup ID is required for restore');
  }

  if (spinner) spinner.setText(`Restoring backup: ${options.name}`);

  try {
    const manager = await createWorkspaceBackupManager();
    
    const restoreOptions: RestoreOptions = {
      force: options.force,
      selective: options.selective,
      restoreState: options.restoreState ?? true,
      restoreCache: options.restoreCache ?? false,
      restoreTemplates: options.restoreTemplates ?? true,
      restoreFiles: options.restoreFiles ?? false,
      targetPath: options.targetPath
    };

    await manager.restoreBackup(options.name, restoreOptions);

    if (spinner) spinner.stop();

    console.log(chalk.green('✅ Backup restored successfully!'));
    console.log(chalk.gray(`Backup ID: ${options.name}`));
    
    if (options.targetPath) {
      console.log(chalk.gray(`Target: ${options.targetPath}`));
    }

    if (restoreOptions.restoreState) {
      console.log(chalk.gray('✓ Restored workspace state'));
    }
    if (restoreOptions.restoreTemplates) {
      console.log(chalk.gray('✓ Restored templates'));
    }
    if (restoreOptions.restoreCache) {
      console.log(chalk.gray('✓ Restored cache'));
    }
    if (restoreOptions.restoreFiles) {
      console.log(chalk.gray('✓ Restored files'));
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to restore backup'));
    throw error;
  }
}

async function deleteBackup(options: WorkspaceBackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!options.name) {
    throw new ValidationError('Backup ID is required for deletion');
  }

  if (spinner) spinner.setText(`Deleting backup: ${options.name}`);

  try {
    const manager = await createWorkspaceBackupManager();
    await manager.deleteBackup(options.name);

    if (spinner) spinner.stop();

    console.log(chalk.green(`✅ Backup '${options.name}' deleted successfully!`));

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to delete backup'));
    throw error;
  }
}

async function exportBackup(options: WorkspaceBackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!options.name) {
    throw new ValidationError('Backup ID is required for export');
  }

  if (!options.output) {
    throw new ValidationError('Output file path is required for export');
  }

  if (spinner) spinner.setText(`Exporting backup: ${options.name}`);

  try {
    const manager = await createWorkspaceBackupManager();
    await manager.exportBackup(options.name, options.output);

    if (spinner) spinner.stop();

    console.log(chalk.green('✅ Backup exported successfully!'));
    console.log(chalk.gray(`Exported to: ${options.output}`));

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to export backup'));
    throw error;
  }
}

async function importBackup(options: WorkspaceBackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!options.file) {
    throw new ValidationError('Backup file path is required for import');
  }

  if (spinner) spinner.setText(`Importing backup from: ${options.file}`);

  try {
    const manager = await createWorkspaceBackupManager();
    const backupId = await manager.importBackup(options.file);

    if (spinner) spinner.stop();

    console.log(chalk.green('✅ Backup imported successfully!'));
    console.log(chalk.gray(`Backup ID: ${backupId}`));
    console.log(chalk.gray(`Source: ${options.file}`));

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to import backup'));
    throw error;
  }
}

async function cleanupBackups(options: WorkspaceBackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Analyzing backups for cleanup...');

  try {
    const manager = await createWorkspaceBackupManager();
    
    const cleanupOptions = {
      keepCount: options.keepCount,
      keepDays: options.keepDays,
      dryRun: options.dryRun
    };

    const result = await manager.cleanupBackups(cleanupOptions);

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (options.dryRun) {
      console.log(chalk.cyan('🔍 Cleanup Preview (Dry Run)'));
    } else {
      console.log(chalk.green('✅ Cleanup completed!'));
    }
    
    console.log(`Backups to delete: ${result.deletedCount}`);
    console.log(`Space to free: ${formatBytes(result.freedSpace)}`);

    if (result.deletedCount === 0) {
      console.log(chalk.gray('No backups need cleanup'));
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to cleanup backups'));
    throw error;
  }
}

async function showBackup(options: WorkspaceBackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!options.name) {
    throw new ValidationError('Backup ID is required');
  }

  if (spinner) spinner.setText(`Loading backup: ${options.name}`);

  try {
    const manager = await createWorkspaceBackupManager();
    const backup = await manager.getBackup(options.name);

    if (!backup) {
      throw new ValidationError(`Backup '${options.name}' not found`);
    }

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(backup, null, 2));
      return;
    }

    const metadata = backup.metadata;
    console.log(chalk.cyan(`\n💾 Backup: ${metadata.name}`));
    console.log(chalk.gray('═'.repeat(60)));

    console.log(`ID: ${metadata.id}`);
    console.log(`Created: ${new Date(metadata.timestamp).toLocaleString()}`);
    console.log(`Size: ${formatBytes(metadata.size)}`);
    console.log(`Workspace: ${metadata.workspaceFile}`);
    console.log(`Version: ${metadata.version}`);

    if (metadata.description) {
      console.log(`Description: ${metadata.description}`);
    }

    if (metadata.tags && metadata.tags.length > 0) {
      console.log(`Tags: ${metadata.tags.join(', ')}`);
    }

    console.log(`\n${chalk.blue('Included Components:')}`);
    console.log(`  Workspace Definition: ✓`);
    console.log(`  State: ${metadata.includeState ? '✓' : '✗'}`);
    console.log(`  Cache: ${metadata.includeCache ? '✓' : '✗'}`);
    console.log(`  Templates: ${metadata.includeTemplates ? '✓' : '✗'}`);

    if (options.verbose) {
      console.log(`\n${chalk.green('Hash:')} ${metadata.hash}`);
      
      console.log(`\n${chalk.yellow('Workspace Summary:')}`);
      const ws = backup.workspace;
      console.log(`  Name: ${ws.name}`);
      console.log(`  Version: ${ws.version}`);
      console.log(`  Workspaces: ${Object.keys(ws.workspaces).length}`);
      console.log(`  Types: ${Object.keys(ws.types).length}`);
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to load backup'));
    throw error;
  }
}

async function compareBackupsCommand(options: WorkspaceBackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!options.backup1 || !options.backup2) {
    throw new ValidationError('Two backup IDs are required for comparison');
  }

  if (spinner) spinner.setText('Comparing backups...');

  try {
    const manager = await createWorkspaceBackupManager();
    const comparison = await compareBackups(manager, options.backup1, options.backup2);

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(comparison, null, 2));
      return;
    }

    console.log(chalk.cyan('\n🔍 Backup Comparison'));
    console.log(chalk.gray('═'.repeat(50)));
    console.log(`Comparing: ${options.backup1} → ${options.backup2}`);

    if (comparison.added.length > 0) {
      console.log(`\n${chalk.green('Added workspaces:')} (${comparison.added.length})`);
      for (const item of comparison.added) {
        console.log(`  + ${item}`);
      }
    }

    if (comparison.removed.length > 0) {
      console.log(`\n${chalk.red('Removed workspaces:')} (${comparison.removed.length})`);
      for (const item of comparison.removed) {
        console.log(`  - ${item}`);
      }
    }

    if (comparison.modified.length > 0) {
      console.log(`\n${chalk.yellow('Modified workspaces:')} (${comparison.modified.length})`);
      for (const item of comparison.modified) {
        console.log(`  ~ ${item}`);
      }
    }

    if (comparison.unchanged.length > 0) {
      console.log(`\n${chalk.gray('Unchanged workspaces:')} (${comparison.unchanged.length})`);
      if (options.verbose) {
        for (const item of comparison.unchanged) {
          console.log(`  = ${item}`);
        }
      }
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to compare backups'));
    throw error;
  }
}

async function interactiveBackupManagement(options: WorkspaceBackupCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { title: '📋 List backups', value: 'list' },
        { title: '💾 Create backup', value: 'create' },
        { title: '🔄 Restore backup', value: 'restore' },
        { title: '👁️  Show backup details', value: 'show' },
        { title: '📤 Export backup', value: 'export' },
        { title: '📥 Import backup', value: 'import' },
        { title: '🔍 Compare backups', value: 'compare' },
        { title: '🧹 Cleanup old backups', value: 'cleanup' },
        { title: '🗑️  Delete backup', value: 'delete' }
      ]
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'list':
      await listBackups({ ...options, interactive: false });
      break;
    case 'create':
      await createBackupInteractive(options);
      break;
    case 'restore':
      await restoreBackupInteractive(options);
      break;
    case 'show':
      {
      const showResponse = await prompts({
        type: 'text',
        name: 'id',
        message: 'Backup ID:'
      });
      if (showResponse.id) {
        await showBackup({ ...options, name: showResponse.id, interactive: false });
      }
      break;
      }
    case 'export':
      await exportBackupInteractive(options);
      break;
    case 'import':
      {
      const importResponse = await prompts({
        type: 'text',
        name: 'file',
        message: 'Backup file path:'
      });
      if (importResponse.file) {
        await importBackup({ ...options, file: importResponse.file, interactive: false });
      }
      break;
      }
    case 'compare':
      await compareBackupsInteractive(options);
      break;
    case 'cleanup':
      await cleanupBackupsInteractive(options);
      break;
    case 'delete':
      await deleteBackupInteractive(options);
      break;
  }
}

async function createBackupInteractive(options: WorkspaceBackupCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'workspaceFile',
      message: 'Workspace file:',
      initial: 're-shell.workspaces.yaml'
    },
    {
      type: 'text',
      name: 'name',
      message: 'Backup name (optional):'
    },
    {
      type: 'text',
      name: 'description',
      message: 'Description (optional):'
    },
    {
      type: 'confirm',
      name: 'includeState',
      message: 'Include workspace state?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'includeTemplates',
      message: 'Include templates?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'includeCache',
      message: 'Include cache?',
      initial: false
    },
    {
      type: 'confirm',
      name: 'includeFiles',
      message: 'Include additional files?',
      initial: false
    }
  ]);

  if (!response.workspaceFile) return;

  await createBackup({
    ...options,
    ...response,
    interactive: false
  });
}

async function restoreBackupInteractive(options: WorkspaceBackupCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'Backup ID to restore:'
    },
    {
      type: 'text',
      name: 'targetPath',
      message: 'Target directory (optional):'
    },
    {
      type: 'confirm',
      name: 'force',
      message: 'Overwrite existing files?',
      initial: false
    },
    {
      type: 'confirm',
      name: 'restoreState',
      message: 'Restore workspace state?',
      initial: true
    },
    {
      type: 'confirm',
      name: 'restoreTemplates',
      message: 'Restore templates?',
      initial: true
    }
  ]);

  if (!response.name) return;

  await restoreBackup({
    ...options,
    ...response,
    interactive: false
  });
}

async function exportBackupInteractive(options: WorkspaceBackupCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'Backup ID to export:'
    },
    {
      type: 'text',
      name: 'output',
      message: 'Output file path:'
    }
  ]);

  if (!response.name || !response.output) return;

  await exportBackup({
    ...options,
    ...response,
    interactive: false
  });
}

async function compareBackupsInteractive(options: WorkspaceBackupCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'backup1',
      message: 'First backup ID:'
    },
    {
      type: 'text',
      name: 'backup2',
      message: 'Second backup ID:'
    }
  ]);

  if (!response.backup1 || !response.backup2) return;

  await compareBackupsCommand({
    ...options,
    ...response,
    interactive: false
  });
}

async function cleanupBackupsInteractive(options: WorkspaceBackupCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'number',
      name: 'keepCount',
      message: 'Keep how many recent backups? (0 for no limit):',
      initial: 10
    },
    {
      type: 'number',
      name: 'keepDays',
      message: 'Keep backups newer than how many days? (0 for no limit):',
      initial: 30
    },
    {
      type: 'confirm',
      name: 'dryRun',
      message: 'Preview cleanup without deleting?',
      initial: true
    }
  ]);

  await cleanupBackups({
    ...options,
    keepCount: response.keepCount || undefined,
    keepDays: response.keepDays || undefined,
    dryRun: response.dryRun,
    interactive: false
  });
}

async function deleteBackupInteractive(options: WorkspaceBackupCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'Backup ID to delete:'
    },
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to delete this backup?',
      initial: false
    }
  ]);

  if (!response.name || !response.confirm) return;

  await deleteBackup({
    ...options,
    name: response.name,
    interactive: false
  });
}

// Utility functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}