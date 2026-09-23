import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

import chalk from 'chalk';
import { ValidationError } from './error-handler';
import { configManager } from './config';

/**
 * Metadata describing a stored configuration backup.
 *
 * Captures identifying information (id, name, description), lifecycle data
 * (creation timestamp, size), classification (backup type, version), the
 * selected contents that were captured, an integrity checksum, and
 * user-defined tags for filtering and organization.
 */
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

/**
 * The full serialized payload of a configuration backup.
 *
 * Combines the {@link BackupMetadata} describing the backup with the actual
 * configuration snapshots that were captured (global, project, workspaces,
 * templates, and environments).
 */
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

/**
 * Options that control how a configuration backup is restored.
 *
 * Allows forcing an overwrite of existing values, selecting only specific
 * configuration sections (selective restore), requesting an automatic backup
 * before restore, performing a non-mutating dry run, and choosing how
 * existing values are handled during the restore via a merge strategy.
 */
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

/**
 * Aggregated statistics about the stored backups.
 *
 * Summarizes the backup set with totals (count, size), the oldest and
 * newest entries, a per-type breakdown, and the average backup size.
 */
export interface BackupStats {
  totalBackups: number;
  totalSize: number;
  oldestBackup?: BackupMetadata;
  newestBackup?: BackupMetadata;
  backupsByType: Record<string, number>;
  averageSize: number;
}

/**
 * Manager for creating, restoring, and maintaining configuration backups.
 *
 * The {@link ConfigBackupManager} is responsible for serializing global,
 * project, workspace, and template configurations into versioned backup
 * files, persisting backup metadata to an index file, and supporting
 * operations such as restore, cleanup, import, and export.
 */
export class ConfigBackupManager {
  private backupDir: string;
  private metadataFile: string;
  private backups: Map<string, BackupMetadata> = new Map();

  /**
   * Creates a new {@link ConfigBackupManager}.
   *
   * @param backupDir - Optional explicit path to the directory where backups
   *   are stored. When omitted, the default `~/.re-shell/backups` directory
   *   is used.
   */
  constructor(backupDir?: string) {
    this.backupDir = backupDir || path.join(os.homedir(), '.re-shell', 'backups');
    this.metadataFile = path.join(this.backupDir, 'metadata.json');
  }

  /**
   * Initializes the backup system.
   *
   * Ensures the backup directory exists and loads the in-memory metadata
   * index from disk. Must be called (directly or indirectly) before any
   * backup operation that relies on the metadata index.
   *
   * @returns A promise that resolves once the directory and metadata are ready.
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(this.backupDir);
    await this.loadMetadata();
  }

  /**
   * Creates a full backup of all available configurations.
   *
   * Collects global, project, workspace (searched under common project
   * subdirectories), and template configurations and writes them to a single
   * versioned backup file.
   *
   * @param name - Human-friendly name for the backup.
   * @param description - Optional longer description. A default description
   *   containing the creation date is used when omitted.
   * @param tags - Optional tags used for categorization and filtering.
   * @returns A promise resolving to the generated backup identifier.
   */
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

  /**
   * Creates a selective backup containing only the requested configuration
   * sections.
   *
   * Unlike {@link ConfigBackupManager.createFullBackup}, this method only
   * captures the global, project, workspace, template, and environment
   * configurations explicitly requested through the `options` argument.
   *
   * @param name - Human-friendly name for the backup.
   * @param options - Selection flags indicating which configuration sections
   *   to include. `workspaces` accepts an array of workspace paths.
   * @param description - Optional longer description. A default description
   *   containing the creation date is used when omitted.
   * @param tags - Optional tags used for categorization and filtering.
   * @returns A promise resolving to the generated backup identifier.
   */
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

  /**
   * Lists all stored backups ordered from newest to oldest.
   *
   * @returns A promise resolving to an array of {@link BackupMetadata}
   *   entries sorted by creation timestamp in descending order.
   */
  async listBackups(): Promise<BackupMetadata[]> {
    await this.initialize();
    return Array.from(this.backups.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Retrieves the full backup payload for the given identifier.
   *
   * @param backupId - The identifier of the backup to retrieve.
   * @returns A promise resolving to the {@link BackupData} for the requested
   *   backup, or `null` when no matching metadata or backup file is found.
   */
  async getBackup(backupId: string): Promise<BackupData | null> {
    await this.initialize();
    
    const metadata = this.backups.get(backupId);
    if (!metadata) return null;

    const backupFile = path.join(this.backupDir, `${backupId}.backup.json`);
    if (!(await fs.pathExists(backupFile))) return null;

    const content = await fs.readFile(backupFile, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Deletes the backup identified by `backupId`.
   *
   * Removes the backup file from disk (when present) and removes its entry
   * from the metadata index, persisting the updated index afterwards.
   *
   * @param backupId - The identifier of the backup to delete.
   * @throws {ValidationError} When no backup with the given identifier exists.
   * @returns A promise that resolves once the backup has been removed.
   */
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

  /**
   * Restores configurations from the backup identified by `backupId`.
   *
   * Optionally creates an automatic safety backup before performing the
   * restore. When `dryRun` is set in {@link RestoreOptions}, a preview of the
   * planned restore is printed and no changes are made.
   *
   * @param backupId - The identifier of the backup to restore from.
   * @param options - Optional {@link RestoreOptions} controlling force,
   *   selective scope, pre-restore backup, dry run, and merge behavior.
   * @throws {ValidationError} When no backup with the given identifier exists.
   * @returns A promise that resolves once the restore (or preview) completes.
   */
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

  /**
   * Computes aggregate statistics across all stored backups.
   *
   * @returns A promise resolving to a {@link BackupStats} object summarizing
   *   the total count, total and average size, oldest and newest entries, and
   *   a per-type breakdown.
   */
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

  /**
   * Removes old backups according to the supplied cleanup criteria.
   *
   * Backups can be pruned by keeping only the most recent N entries
   * (`keepCount`), by removing entries older than a number of days
   * (`keepDays`), and by deleting backups whose type is not in the
   * `keepTypes` allow-list. Criteria are cumulative. When `dryRun` is set,
   * the list of backups that would be deleted is returned without making any
   * changes.
   *
   * @param options - Cleanup configuration. All fields are optional.
   * @returns A promise resolving to the list of backup identifiers that were
   *   deleted (or that would be deleted in a dry run).
   */
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

  /**
   * Exports an existing backup to an arbitrary file path.
   *
   * The backup contents are written as pretty-printed JSON, creating any
   * missing parent directories of `outputPath` as needed.
   *
   * @param backupId - The identifier of the backup to export.
   * @param outputPath - Absolute or relative path of the destination file.
   * @throws {ValidationError} When no backup with the given identifier exists.
   * @returns A promise that resolves once the export file has been written.
   */
  async exportBackup(backupId: string, outputPath: string): Promise<void> {
    const backup = await this.getBackup(backupId);
    if (!backup) {
      throw new ValidationError(`Backup '${backupId}' not found`);
    }

    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, JSON.stringify(backup, null, 2));
  }

  /**
   * Imports a backup from an external file.
   *
   * Reads and validates the file at `filePath`, assigns it a new identifier
   * to avoid collisions with existing backups, tags it as imported, and then
   * persists it through the standard save flow.
   *
   * @param filePath - Path to the backup file to import.
   * @throws {ValidationError} When the file does not exist or does not
   *   contain a valid backup structure.
   * @returns A promise resolving to the newly generated backup identifier.
   */
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

  /**
   * Persists a backup to disk and updates the metadata index.
   *
   * Computes the byte size and MD5 checksum of the serialized backup,
   * writes the backup file into the backup directory, records the metadata
   * in the in-memory index, and persists the updated index.
   *
   * @param backupData - The backup payload to persist.
   * @returns A promise resolving to the backup identifier.
   */
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

  /**
   * Loads the metadata index from disk into memory.
   *
   * When the metadata file is missing, the in-memory index is left empty.
   * If the file exists but cannot be parsed, the index is rebuilt from the
   * individual backup files via {@link ConfigBackupManager.rebuildMetadata}.
   *
   * @returns A promise that resolves once the metadata has been loaded.
   */
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

  /**
   * Persists the current in-memory metadata index to disk as JSON.
   *
   * @returns A promise that resolves once the metadata file has been written.
   */
  private async saveMetadata(): Promise<void> {
    const metadata = Object.fromEntries(this.backups);
    await fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2));
  }

  /**
   * Rebuilds the in-memory metadata index by scanning backup files on disk.
   *
   * Clears the current index, reads every `.backup.json` file in the backup
   * directory, extracts each backup's metadata, and persists the rebuilt
   * index. Corrupted backup files are skipped with a warning.
   *
   * @returns A promise that resolves once the index has been rebuilt.
   */
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

  /**
   * Generates a unique backup identifier.
   *
   * The identifier combines the current timestamp with a short random
   * suffix to ensure uniqueness across rapid successive backups.
   *
   * @returns A string of the form `backup-<timestamp>-<random>`.
   */
  private generateBackupId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `backup-${timestamp}-${random}`;
  }

  /**
   * Performs the actual restoration of configurations from a backup.
   *
   * Restores global, project, workspace, and template configurations
   * according to the supplied {@link RestoreOptions}, honoring the selected
   * scope and the chosen merge strategy (`replace`, `merge`, or
   * `skip-existing`). Progress is logged to the console as each section is
   * processed.
   *
   * @param backup - The backup payload to restore from.
   * @param options - Restore options controlling scope and merge behavior.
   * @returns A promise that resolves once all applicable sections have been
   *   restored.
   */
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

  /**
   * Prints a non-mutating preview of what would be restored.
   *
   * Lists the configuration sections that would be affected by the restore
   * (global, project, workspaces, and templates), honoring any selective
   * scope, and prints the merge strategy that would be applied.
   *
   * @param backup - The backup payload that would be restored.
   * @param options - Restore options controlling the preview scope.
   */
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

/**
 * Shared singleton instance of {@link ConfigBackupManager}.
 *
 * Uses the default backup directory (`~/.re-shell/backups`) and is intended
 * as the primary entry point for consumers of this module.
 */
export const configBackupManager = new ConfigBackupManager();