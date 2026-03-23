import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import chalk from 'chalk';
import { ValidationError } from './error-handler';
import { configManager } from './config';

// Backup metadata interface
export interface BackupMetadata {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  size: number;
  type: 'full' | 'global' | 'project' | 'workspace' | 'selective';
  version: string;
  contents: {
    global?: boolean;
    project?: boolean;
    workspaces?: string[];
    templates?: boolean;
    environments?: boolean;
  };
  checksum: string;
  tags: string[];
}

// Backup data structure
export interface BackupData {
  metadata: BackupMetadata;
  configurations: {
    global?: any;
    project?: any;
    workspaces?: Record<string, any>;
    templates?: any[];
    environments?: any[];
  };
}

// Restore options
export interface RestoreOptions {
  force?: boolean;
  selective?: {
    global?: boolean;
    project?: boolean;
    workspaces?: string[];
    templates?: boolean;
    environments?: boolean;
  };
  createBackupBeforeRestore?: boolean;
  dryRun?: boolean;
  mergeStrategy?: 'replace' | 'merge' | 'skip-existing';
}

// Backup statistics
export interface BackupStats {
  totalBackups: number;
  totalSize: number;
  oldestBackup?: BackupMetadata;
  newestBackup?: BackupMetadata;
  backupsByType: Record<string, number>;
  averageSize: number;
}

// Configuration backup manager
export class ConfigBackupManager {
  private backupDir: string;
  private metadataFile: string;
  private backups: Map<string, BackupMetadata> = new Map();

  constructor(backupDir?: string) {
    this.backupDir = backupDir || path.join(os.homedir(), '.re-shell', 'backups');
    this.metadataFile = path.join(this.backupDir, 'metadata.json');
  }

  // Initialize backup system
  async initialize(): Promise<void> {
    await fs.ensureDir(this.backupDir);
    await this.loadMetadata();
  }

  // Create a full backup of all configurations
  async createFullBackup(name: string, description?: string, tags: string[] = []): Promise<string> {
    await this.initialize();

    const backupId = this.generateBackupId();
    const timestamp = new Date().toISOString();

    // Collect all configurations
    const global = await configManager.loadGlobalConfig();
    const project = await configManager.loadProjectConfig().catch(() => null);
    
    // Find workspace configurations
    const workspaces: Record<string, any> = {};
    try {
      // Search for workspace configs in common locations
      const searchPaths = [
        path.join(process.cwd(), 'apps'),
        path.join(process.cwd(), 'packages'),
        path.join(process.cwd(), 'libs'),
        path.join(process.cwd(), 'tools')
      ];

      for (const searchPath of searchPaths) {
        if (await fs.pathExists(searchPath)) {
          const dirs = await fs.readdir(searchPath);
          for (const dir of dirs) {
            const workspacePath = path.join(searchPath, dir);
            const workspace = await configManager.loadWorkspaceConfig(workspacePath).catch(() => null);
            if (workspace) {
              workspaces[path.relative(process.cwd(), workspacePath)] = workspace;
            }
          }
        }
      }
    } catch (error) {
      // Ignore workspace collection errors
    }

    // Collect templates
    const templates: any[] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { templateEngine } = require('./template-engine');
      templates.push(...await templateEngine.listTemplates());
    } catch (error) {
      // Ignore template collection errors
    }

    // Create backup data
    const backupData: BackupData = {
      metadata: {
        id: backupId,
        name,
        description: description || `Full backup created on ${new Date().toLocaleDateString()}`,
        createdAt: timestamp,
        size: 0, // Will be calculated after serialization
        type: 'full',
        version: global.version || '1.0.0',
        contents: {
          global: true,
          project: !!project,
          workspaces: Object.keys(workspaces),
          templates: templates.length > 0,
          environments: false // TODO: Implement environment backup
        },
        checksum: '',
        tags
      },
      configurations: {
        global,
        project: project || undefined,
        workspaces: Object.keys(workspaces).length > 0 ? workspaces : undefined,
        templates: templates.length > 0 ? templates : undefined
      }
    };

    return this.saveBackup(backupData);
  }

  // Create selective backup
  async createSelectiveBackup(
    name: string,
    options: {
      global?: boolean;
      project?: boolean;
      workspaces?: string[];
      templates?: boolean;
      environments?: boolean;
    },
    description?: string,
    tags: string[] = []
  ): Promise<string> {
    await this.initialize();

    const backupId = this.generateBackupId();
    const timestamp = new Date().toISOString();

    const configurations: any = {};

    // Collect specified configurations
    if (options.global) {
      configurations.global = await configManager.loadGlobalConfig();
    }

    if (options.project) {
      const project = await configManager.loadProjectConfig().catch(() => null);
      if (project) configurations.project = project;
    }

    if (options.workspaces && options.workspaces.length > 0) {
      configurations.workspaces = {};
      for (const workspacePath of options.workspaces) {
        const workspace = await configManager.loadWorkspaceConfig(workspacePath).catch(() => null);
        if (workspace) {
          configurations.workspaces[workspacePath] = workspace;
        }
      }
    }

    if (options.templates) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { templateEngine } = require('./template-engine');
        configurations.templates = await templateEngine.listTemplates();
      } catch (error) {
        // Ignore template collection errors
      }
    }

    const backupData: BackupData = {
      metadata: {
        id: backupId,
        name,
        description: description || `Selective backup created on ${new Date().toLocaleDateString()}`,
        createdAt: timestamp,
        size: 0,
        type: 'selective',
        version: configurations.global?.version || '1.0.0',
        contents: {
          global: options.global,
          project: options.project && !!configurations.project,
          workspaces: options.workspaces || [],
          templates: options.templates,
          environments: options.environments
        },
        checksum: '',
        tags
      },
      configurations
    };

    return this.saveBackup(backupData);
  }

  // List all backups
  async listBackups(): Promise<BackupMetadata[]> {
    await this.initialize();
    return Array.from(this.backups.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // Get backup by ID
  async getBackup(backupId: string): Promise<BackupData | null> {
    await this.initialize();
    
    const metadata = this.backups.get(backupId);
    if (!metadata) return null;

    const backupFile = path.join(this.backupDir, `${backupId}.backup.json`);
    if (!(await fs.pathExists(backupFile))) return null;

    const content = await fs.readFile(backupFile, 'utf8');
    return JSON.parse(content);
  }

  // Delete backup
  async deleteBackup(backupId: string): Promise<void> {
    await this.initialize();

    const metadata = this.backups.get(backupId);
    if (!metadata) {
      throw new ValidationError(`Backup '${backupId}' not found`);
    }

    const backupFile = path.join(this.backupDir, `${backupId}.backup.json`);
    if (await fs.pathExists(backupFile)) {
      await fs.unlink(backupFile);
    }

    this.backups.delete(backupId);
    await this.saveMetadata();
  }

  // Restore from backup
  async restoreFromBackup(backupId: string, options: RestoreOptions = {}): Promise<void> {
    await this.initialize();

    const backup = await this.getBackup(backupId);
    if (!backup) {
      throw new ValidationError(`Backup '${backupId}' not found`);
    }

    // Create backup before restore if requested
    if (options.createBackupBeforeRestore) {
      const preRestoreBackupId = await this.createFullBackup(
        `pre-restore-${backup.metadata.name}`,
        `Automatic backup before restoring '${backup.metadata.name}'`,
        ['auto', 'pre-restore']
      );
      console.log(chalk.cyan(`Created pre-restore backup: ${preRestoreBackupId}`));
    }

    if (options.dryRun) {
      console.log(chalk.yellow('DRY RUN - No changes will be made'));
      this.showRestorePreview(backup, options);
      return;
    }

    // Perform restoration
    await this.performRestore(backup, options);
  }

  // Get backup statistics
  async getBackupStats(): Promise<BackupStats> {
    await this.initialize();

    const backups = Array.from(this.backups.values());
    const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
    const backupsByType: Record<string, number> = {};

    for (const backup of backups) {
      backupsByType[backup.type] = (backupsByType[backup.type] || 0) + 1;
    }

    const sortedByDate = backups.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return {
      totalBackups: backups.length,
      totalSize,
      oldestBackup: sortedByDate[0],
      newestBackup: sortedByDate[sortedByDate.length - 1],
      backupsByType,
      averageSize: backups.length > 0 ? totalSize / backups.length : 0
    };
  }

  // Cleanup old backups
  async cleanup(options: {
    keepCount?: number;
    keepDays?: number;
    keepTypes?: string[];
    dryRun?: boolean;
  } = {}): Promise<string[]> {
    await this.initialize();

    const backups = await this.listBackups();
    const toDelete: string[] = [];

    // Filter by count
    if (options.keepCount && backups.length > options.keepCount) {
      const excess = backups.slice(options.keepCount);
      toDelete.push(...excess.map(b => b.id));
    }

    // Filter by age
    if (options.keepDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - options.keepDays);
      
      const oldBackups = backups.filter(backup => 
        new Date(backup.createdAt) < cutoffDate &&
        !toDelete.includes(backup.id)
      );
      
      toDelete.push(...oldBackups.map(b => b.id));
    }

    // Filter by type (keep specified types)
    if (options.keepTypes) {
      const typeFilteredBackups = backups.filter(backup =>
        !options.keepTypes!.includes(backup.type) &&
        !toDelete.includes(backup.id)
      );
      
      toDelete.push(...typeFilteredBackups.map(b => b.id));
    }

    if (options.dryRun) {
      return toDelete;
    }

    // Perform deletion
    for (const backupId of toDelete) {
      await this.deleteBackup(backupId);
    }

    return toDelete;
  }

  // Export backup to file
  async exportBackup(backupId: string, outputPath: string): Promise<void> {
    const backup = await this.getBackup(backupId);
    if (!backup) {
      throw new ValidationError(`Backup '${backupId}' not found`);
    }

    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, JSON.stringify(backup, null, 2));
  }

  // Import backup from file
  async importBackup(filePath: string): Promise<string> {
    if (!(await fs.pathExists(filePath))) {
      throw new ValidationError(`Backup file not found: ${filePath}`);
    }

    const content = await fs.readFile(filePath, 'utf8');
    const backup: BackupData = JSON.parse(content);

    // Validate backup structure
    if (!backup.metadata || !backup.configurations) {
      throw new ValidationError('Invalid backup file format');
    }

    // Generate new ID to avoid conflicts
    const newId = this.generateBackupId();
    backup.metadata.id = newId;
    backup.metadata.tags = [...(backup.metadata.tags || []), 'imported'];

    return this.saveBackup(backup);
  }

  // Private methods
  private async saveBackup(backupData: BackupData): Promise<string> {
    const content = JSON.stringify(backupData, null, 2);
    const size = Buffer.byteLength(content, 'utf8');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const checksum = require('crypto').createHash('md5').update(content).digest('hex');

    // Update metadata with calculated values
    backupData.metadata.size = size;
    backupData.metadata.checksum = checksum;

    // Save backup file
    const backupFile = path.join(this.backupDir, `${backupData.metadata.id}.backup.json`);
    await fs.writeFile(backupFile, content);

    // Update metadata index
    this.backups.set(backupData.metadata.id, backupData.metadata);
    await this.saveMetadata();

    return backupData.metadata.id;
  }

  private async loadMetadata(): Promise<void> {
    if (await fs.pathExists(this.metadataFile)) {
      try {
        const content = await fs.readFile(this.metadataFile, 'utf8');
        const metadata = JSON.parse(content);
        
        for (const [id, data] of Object.entries(metadata)) {
          this.backups.set(id, data as BackupMetadata);
        }
      } catch (error) {
        // If metadata is corrupted, rebuild from backup files
        await this.rebuildMetadata();
      }
    }
  }

  private async saveMetadata(): Promise<void> {
    const metadata = Object.fromEntries(this.backups);
    await fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2));
  }

  private async rebuildMetadata(): Promise<void> {
    this.backups.clear();
    
    if (!(await fs.pathExists(this.backupDir))) return;

    const files = await fs.readdir(this.backupDir);
    const backupFiles = files.filter(file => file.endsWith('.backup.json'));

    for (const file of backupFiles) {
      try {
        const filePath = path.join(this.backupDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const backup: BackupData = JSON.parse(content);
        
        if (backup.metadata) {
          this.backups.set(backup.metadata.id, backup.metadata);
        }
      } catch (error) {
        // Skip corrupted backup files
        console.warn(`Skipping corrupted backup file: ${file}`);
      }
    }

    await this.saveMetadata();
  }

  private generateBackupId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `backup-${timestamp}-${random}`;
  }

  private async performRestore(backup: BackupData, options: RestoreOptions): Promise<void> {
    const { configurations } = backup;
    const selective = options.selective;

    // Restore global configuration
    if (configurations.global && (!selective || selective.global)) {
      if (options.mergeStrategy === 'skip-existing') {
        const existing = await configManager.loadGlobalConfig().catch(() => null);
        if (existing) {
          console.log(chalk.yellow('Skipping global config (already exists)'));
        } else {
          await configManager.saveGlobalConfig(configurations.global);
          console.log(chalk.green('✅ Restored global configuration'));
        }
      } else if (options.mergeStrategy === 'merge') {
        const existing = await configManager.loadGlobalConfig().catch(() => null);
        if (existing) {
          const merged = { ...configurations.global, ...existing };
          await configManager.saveGlobalConfig(merged);
          console.log(chalk.green('✅ Merged global configuration'));
        } else {
          await configManager.saveGlobalConfig(configurations.global);
          console.log(chalk.green('✅ Restored global configuration'));
        }
      } else {
        await configManager.saveGlobalConfig(configurations.global);
        console.log(chalk.green('✅ Restored global configuration'));
      }
    }

    // Restore project configuration
    if (configurations.project && (!selective || selective.project)) {
      if (options.mergeStrategy === 'skip-existing') {
        const existing = await configManager.loadProjectConfig().catch(() => null);
        if (existing) {
          console.log(chalk.yellow('Skipping project config (already exists)'));
        } else {
          await configManager.saveProjectConfig(configurations.project);
          console.log(chalk.green('✅ Restored project configuration'));
        }
      } else {
        await configManager.saveProjectConfig(configurations.project);
        console.log(chalk.green('✅ Restored project configuration'));
      }
    }

    // Restore workspace configurations
    if (configurations.workspaces) {
      for (const [workspacePath, workspaceConfig] of Object.entries(configurations.workspaces)) {
        if (selective && selective.workspaces && !selective.workspaces.includes(workspacePath)) {
          continue;
        }

        const fullPath = path.resolve(workspacePath);
        await fs.ensureDir(fullPath);
        await configManager.saveWorkspaceConfig(workspaceConfig, fullPath);
        console.log(chalk.green(`✅ Restored workspace configuration: ${workspacePath}`));
      }
    }

    // Restore templates
    if (configurations.templates && (!selective || selective.templates)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { templateEngine } = require('./template-engine');
        for (const template of configurations.templates) {
          await templateEngine.saveTemplate(template);
        }
        console.log(chalk.green(`✅ Restored ${configurations.templates.length} templates`));
      } catch (error) {
        console.warn(chalk.yellow('Warning: Failed to restore templates'));
      }
    }
  }

  private showRestorePreview(backup: BackupData, options: RestoreOptions): void {
    console.log(chalk.cyan(`\\n📋 Restore Preview for: ${backup.metadata.name}`));
    console.log(chalk.gray('═'.repeat(50)));

    const { configurations } = backup;
    const selective = options.selective;

    if (configurations.global && (!selective || selective.global)) {
      console.log(chalk.green('  ✓ Global configuration'));
    }

    if (configurations.project && (!selective || selective.project)) {
      console.log(chalk.green('  ✓ Project configuration'));
    }

    if (configurations.workspaces) {
      const workspacesToRestore = selective?.workspaces 
        ? Object.keys(configurations.workspaces).filter(w => selective.workspaces!.includes(w))
        : Object.keys(configurations.workspaces);
      
      for (const workspace of workspacesToRestore) {
        console.log(chalk.green(`  ✓ Workspace: ${workspace}`));
      }
    }

    if (configurations.templates && (!selective || selective.templates)) {
      console.log(chalk.green(`  ✓ Templates (${configurations.templates.length})`));
    }

    console.log(chalk.gray(`\\nMerge strategy: ${options.mergeStrategy || 'replace'}`));
  }
}

// Export singleton instance
export const configBackupManager = new ConfigBackupManager();