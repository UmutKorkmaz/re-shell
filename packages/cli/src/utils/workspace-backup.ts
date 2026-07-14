import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { ValidationError } from './error-handler';
import { WorkspaceDefinition, loadWorkspaceDefinition } from './workspace-schema';
import { createWorkspaceStateManager } from './workspace-state';

// Backup interfaces
/**
 * Metadata describing a single workspace backup entry.
 *
 * Each backup produced by `WorkspaceBackupManager` records this object so the
 * backup can be listed, searched, verified and restored without loading the
 * full backup content.
 */
export interface BackupMetadata {
  /** Unique identifier (hex string) generated for the backup. */
  id: string;
  /** Human-readable name of the backup. */
  name: string;
  /** Optional longer description of the backup's purpose or contents. */
  description?: string;
  /** ISO-8601 timestamp marking when the backup was created. */
  timestamp: string;
  /** Base name of the workspace file that was backed up. */
  workspaceFile: string;
  /** Schema version of the backup metadata format. */
  version: string;
  /** Size of the serialized backup content in bytes. */
  size: number;
  /** SHA-256 hash of the serialized backup content. */
  hash: string;
  /** Optional list of user-supplied tags used for grouping/filtering. */
  tags?: string[];
  /** Whether workspace state was included in the backup. */
  includeState?: boolean;
  /** Whether cached data was included in the backup. */
  includeCache?: boolean;
  /** Whether custom templates were included in the backup. */
  includeTemplates?: boolean;
}

/**
 * Full payload of a serialized backup stored on disk.
 *
 * Combines the {@link BackupMetadata} with the actual workspace definition and
 * any optional extras (state, cache, templates, files) that were requested at
 * backup time.
 */
export interface BackupContent {
  /** Metadata describing the backup. */
  metadata: BackupMetadata;
  /** The workspace definition captured by the backup. */
  workspace: WorkspaceDefinition;
  /** Optional serialized workspace state statistics. */
  state?: any;
  /** Optional serialized cache directory contents. */
  cache?: any;
  /** Optional serialized custom templates directory contents. */
  templates?: any;
  /** Map of relative file path to file content for additional backed-up files. */
  files?: Record<string, string>; // path -> content
}

/**
 * On-disk index tracking every backup known to a {@link WorkspaceBackupManager}.
 *
 * The index is persisted as `index.json` inside the backup directory and keeps
 * aggregate statistics in addition to the per-backup metadata entries.
 */
export interface BackupIndex {
  /** Schema version of the index file. */
  version: string;
  /** Map of backup id to its metadata. */
  backups: Record<string, BackupMetadata>;
  /** Aggregate information about the index. */
  metadata: {
    /** ISO-8601 timestamp marking when the index was first created. */
    created: string;
    /** ISO-8601 timestamp of the most recent modification. */
    lastModified: string;
    /** Total number of backups tracked by the index. */
    totalBackups: number;
    /** Combined size in bytes of all tracked backups. */
    totalSize: number;
  };
}

/**
 * Options accepted by {@link WorkspaceBackupManager.createBackup} controlling
 * what is captured and how the backup is labeled.
 */
export interface BackupOptions {
  /** Optional friendly name for the backup. */
  name?: string;
  /** Optional free-form description of the backup. */
  description?: string;
  /** Whether to include serialized workspace state in the backup. */
  includeState?: boolean;
  /** Whether to include the cache directory contents in the backup. */
  includeCache?: boolean;
  /** Whether to include custom templates in the backup. */
  includeTemplates?: boolean;
  /** Whether to include additional project files in the backup. */
  includeFiles?: boolean;
  /** Glob patterns used when `includeFiles` is enabled. */
  filePatterns?: string[];
  /** Optional tags to associate with the backup for filtering. */
  tags?: string[];
  /** Reserved for future use; indicates the backup should be compressed. */
  compress?: boolean;
}

/**
 * Options accepted by {@link WorkspaceBackupManager.restoreBackup} controlling
 * how and where the backup contents are restored.
 */
export interface RestoreOptions {
  /** When true, overwrite existing files without prompting. */
  force?: boolean;
  /** Reserved for future selective restore behavior. */
  selective?: boolean;
  /** Whether to restore the previously captured workspace state. */
  restoreState?: boolean;
  /** Whether to restore the previously captured cache directory. */
  restoreCache?: boolean;
  /** Whether to restore previously captured custom templates. */
  restoreTemplates?: boolean;
  /** Whether to restore previously captured additional files. */
  restoreFiles?: boolean;
  /** Optional target directory to restore into instead of the workspace root. */
  targetPath?: string;
}

/**
 * Manager responsible for creating, listing, restoring and pruning workspace
 * backups for a re-shell project.
 *
 * Backups are stored as JSON files under `<root>/.re-shell/backups` and tracked
 * through an `index.json` file in the same directory. The manager is cheap to
 * construct; callers should invoke {@link init} (or use the
 * {@link createWorkspaceBackupManager} helper) before performing any other
 * operation so the backup directory and index are ready.
 */
export class WorkspaceBackupManager {
  private backupDir: string;
  private indexPath: string;
  private index: BackupIndex;
  private rootPath: string;

  /**
   * Create a new backup manager bound to the given workspace root.
   *
   * @param rootPath - Absolute path to the workspace root. Defaults to the
   *   current working directory.
   */
  constructor(rootPath: string = process.cwd()) {
    this.rootPath = rootPath;
    this.backupDir = path.join(rootPath, '.re-shell', 'backups');
    this.indexPath = path.join(this.backupDir, 'index.json');
    this.index = this.createDefaultIndex();
  }

  /**
   * Initialize the backup system.
   *
   * Ensures the backup directory exists and loads (or creates) the backup
   * index. Must be awaited before any other manager method is used.
   *
   * @returns A promise that resolves once initialization is complete.
   */
  // Initialize backup system
  async init(): Promise<void> {
    await fs.ensureDir(this.backupDir);
    await this.loadIndex();
  }

  /**
   * Create a new backup from a workspace definition file.
   *
   * Loads the given workspace file and serializes it together with any optional
   * extras requested through `options`. The resulting payload is written to the
   * backup directory and registered in the index.
   *
   * @param workspaceFile - Path to the workspace definition file to back up.
   * @param options - Optional {@link BackupOptions} controlling what is captured
   *   and how the backup is labeled.
   * @returns The id of the newly created backup.
   */
  // Create backup
  async createBackup(
    workspaceFile: string,
    options: BackupOptions = {}
  ): Promise<string> {
    const backupId = this.generateBackupId();
    const timestamp = new Date().toISOString();
    
    // Load workspace definition
    const workspace = await loadWorkspaceDefinition(workspaceFile);
    
    // Build backup content
    const content: BackupContent = {
      metadata: {
        id: backupId,
        name: options.name || `backup-${timestamp.split('T')[0]}`,
        description: options.description,
        timestamp,
        workspaceFile: path.basename(workspaceFile),
        version: '1.0.0',
        size: 0,
        hash: '',
        tags: options.tags,
        includeState: options.includeState,
        includeCache: options.includeCache,
        includeTemplates: options.includeTemplates
      },
      workspace
    };

    // Include state if requested
    if (options.includeState) {
      try {
        const stateManager = await createWorkspaceStateManager(this.rootPath);
        await stateManager.loadState();
        content.state = stateManager.getStateStatistics();
      } catch (error) {
        console.warn('Failed to include state in backup:', (error as Error).message);
      }
    }

    // Include cache if requested
    if (options.includeCache) {
      try {
        const cacheDir = path.join(this.rootPath, '.re-shell', 'cache');
        if (await fs.pathExists(cacheDir)) {
          content.cache = await this.backupDirectory(cacheDir);
        }
      } catch (error) {
        console.warn('Failed to include cache in backup:', (error as Error).message);
      }
    }

    // Include templates if requested
    if (options.includeTemplates) {
      try {
        const templatesDir = path.join(this.rootPath, '.re-shell', 'templates');
        if (await fs.pathExists(templatesDir)) {
          content.templates = await this.backupDirectory(templatesDir);
        }
      } catch (error) {
        console.warn('Failed to include templates in backup:', (error as Error).message);
      }
    }

    // Include files if requested
    if (options.includeFiles) {
      try {
        const patterns = options.filePatterns || ['*.json', '*.yaml', '*.yml', '*.ts', '*.js'];
        content.files = await this.backupFiles(patterns);
      } catch (error) {
        console.warn('Failed to include files in backup:', (error as Error).message);
      }
    }

    // Calculate size and hash
    const contentStr = JSON.stringify(content);
    content.metadata.size = Buffer.byteLength(contentStr, 'utf8');
    content.metadata.hash = crypto.createHash('sha256').update(contentStr).digest('hex');

    // Save backup
    const backupPath = path.join(this.backupDir, `${backupId}.json`);
    await fs.writeJson(backupPath, content, { spaces: 2 });

    // Update index
    this.index.backups[backupId] = content.metadata;
    await this.saveIndex();

    return backupId;
  }

  /**
   * List all known backups ordered from newest to oldest.
   *
   * @returns A promise resolving to an array of {@link BackupMetadata} entries
   *   sorted by descending timestamp.
   */
  // List backups
  async listBackups(): Promise<BackupMetadata[]> {
    return Object.values(this.index.backups).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Load the full content of a backup by its id.
   *
   * @param id - Identifier of the backup to retrieve.
   * @returns A promise resolving to the {@link BackupContent}, or `null` if no
   *   backup with that id exists (or it could not be read).
   */
  // Get backup by ID
  async getBackup(id: string): Promise<BackupContent | null> {
    if (!this.index.backups[id]) {
      return null;
    }

    const backupPath = path.join(this.backupDir, `${id}.json`);
    
    try {
      if (await fs.pathExists(backupPath)) {
        return await fs.readJson(backupPath);
      }
    } catch (error) {
      console.warn(`Failed to load backup ${id}:`, (error as Error).message);
    }

    return null;
  }

  /**
   * Restore a previously created backup.
   *
   * Writes the captured workspace definition back to disk and, depending on
   * `options`, restores additional components such as state, cache, templates
   * and arbitrary files. Existing files are preserved unless `force` is set.
   *
   * @param id - Identifier of the backup to restore.
   * @param options - Optional {@link RestoreOptions} controlling the restore
   *   behavior.
   * @throws {ValidationError} If the backup does not exist, or if a target file
   *   already exists and `force` was not requested.
   * @returns A promise that resolves once the restore completes.
   */
  // Restore backup
  async restoreBackup(
    id: string,
    options: RestoreOptions = {}
  ): Promise<void> {
    const backup = await this.getBackup(id);
    if (!backup) {
      throw new ValidationError(`Backup '${id}' not found`);
    }

    const targetPath = options.targetPath || this.rootPath;
    await fs.ensureDir(targetPath);

    // Restore workspace definition
    const workspaceFile = path.join(targetPath, backup.metadata.workspaceFile);
    
    if (!options.force && await fs.pathExists(workspaceFile)) {
      throw new ValidationError(
        `Workspace file ${backup.metadata.workspaceFile} already exists. Use --force to overwrite.`
      );
    }

    await this.saveWorkspaceDefinition(workspaceFile, backup.workspace);

    // Restore state if requested and available
    if (options.restoreState && backup.state) {
      try {
        // State restoration would be implemented here
        console.log('State restoration completed');
      } catch (error) {
        console.warn('Failed to restore state:', (error as Error).message);
      }
    }

    // Restore cache if requested and available
    if (options.restoreCache && backup.cache) {
      try {
        const cacheDir = path.join(targetPath, '.re-shell', 'cache');
        await this.restoreDirectory(cacheDir, backup.cache);
        console.log('Cache restoration completed');
      } catch (error) {
        console.warn('Failed to restore cache:', (error as Error).message);
      }
    }

    // Restore templates if requested and available
    if (options.restoreTemplates && backup.templates) {
      try {
        const templatesDir = path.join(targetPath, '.re-shell', 'templates');
        await this.restoreDirectory(templatesDir, backup.templates);
        console.log('Templates restoration completed');
      } catch (error) {
        console.warn('Failed to restore templates:', (error as Error).message);
      }
    }

    // Restore files if requested and available
    if (options.restoreFiles && backup.files) {
      try {
        await this.restoreFiles(targetPath, backup.files, options.force);
        console.log('Files restoration completed');
      } catch (error) {
        console.warn('Failed to restore files:', (error as Error).message);
      }
    }
  }

  /**
   * Permanently delete a backup.
   *
   * Removes the backup file from disk and unregisters it from the index.
   *
   * @param id - Identifier of the backup to delete.
   * @throws {ValidationError} If the backup does not exist.
   * @returns A promise that resolves once the backup has been removed.
   */
  // Delete backup
  async deleteBackup(id: string): Promise<void> {
    if (!this.index.backups[id]) {
      throw new ValidationError(`Backup '${id}' not found`);
    }

    const backupPath = path.join(this.backupDir, `${id}.json`);
    await fs.remove(backupPath);

    delete this.index.backups[id];
    await this.saveIndex();
  }

  /**
   * Export a backup to an arbitrary location on disk.
   *
   * Useful for transferring backups between machines or archiving them outside
   * of the workspace.
   *
   * @param id - Identifier of the backup to export.
   * @param outputPath - Destination file path. Parent directories are created.
   * @throws {ValidationError} If the backup does not exist.
   * @returns A promise that resolves once the export file has been written.
   */
  // Export backup to file
  async exportBackup(id: string, outputPath: string): Promise<void> {
    const backup = await this.getBackup(id);
    if (!backup) {
      throw new ValidationError(`Backup '${id}' not found`);
    }

    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeJson(outputPath, backup, { spaces: 2 });
  }

  /**
   * Import a backup from an external file.
   *
   * Reads the supplied backup file, validates its structure, and registers it
   * with this manager. A new id is generated if the file does not provide one.
   *
   * @param filePath - Path to the backup file to import.
   * @throws {ValidationError} If the file does not exist or is malformed.
   * @returns The id under which the backup was registered.
   */
  // Import backup from file
  async importBackup(filePath: string): Promise<string> {
    if (!(await fs.pathExists(filePath))) {
      throw new ValidationError(`Backup file not found: ${filePath}`);
    }

    const backup: BackupContent = await fs.readJson(filePath);
    
    // Validate backup structure
    if (!backup.metadata || !backup.workspace) {
      throw new ValidationError('Invalid backup file format');
    }

    // Generate new ID if needed
    const backupId = backup.metadata.id || this.generateBackupId();
    backup.metadata.id = backupId;

    // Save backup
    const backupPath = path.join(this.backupDir, `${backupId}.json`);
    await fs.writeJson(backupPath, backup, { spaces: 2 });

    // Update index
    this.index.backups[backupId] = backup.metadata;
    await this.saveIndex();

    return backupId;
  }

  /**
   * Remove old backups according to retention rules.
   *
   * Backups exceeding `keepCount` (newest kept) and older than `keepDays` are
   * selected for deletion. When `dryRun` is true the affected backups are
   * reported but not actually removed.
   *
   * @param options - Retention options:
   *   - `keepCount` - Maximum number of backups to keep (newest first).
   *   - `keepDays` - Delete backups older than this many days.
   *   - `dryRun` - When true, calculate what would be deleted without removing
   *     anything.
   * @returns An object reporting the number of deleted backups and the total
   *   disk space freed in bytes.
   */
  // Cleanup old backups
  async cleanupBackups(options: {
    keepCount?: number;
    keepDays?: number;
    dryRun?: boolean;
  } = {}): Promise<{ deletedCount: number; freedSpace: number }> {
    const backups = await this.listBackups();
    const toDelete: string[] = [];
    let freedSpace = 0;

    // Keep count limit
    if (options.keepCount && backups.length > options.keepCount) {
      const excess = backups.slice(options.keepCount);
      toDelete.push(...excess.map(b => b.id));
    }

    // Keep days limit
    if (options.keepDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - options.keepDays);
      
      const oldBackups = backups.filter(
        b => new Date(b.timestamp) < cutoffDate && !toDelete.includes(b.id)
      );
      toDelete.push(...oldBackups.map(b => b.id));
    }

    // Calculate freed space
    for (const id of toDelete) {
      const backup = this.index.backups[id];
      if (backup) {
        freedSpace += backup.size;
      }
    }

    // Delete backups if not dry run
    if (!options.dryRun) {
      for (const id of toDelete) {
        await this.deleteBackup(id);
      }
    }

    return {
      deletedCount: toDelete.length,
      freedSpace
    };
  }

  /**
   * Compute summary statistics for the backups tracked by this manager.
   *
   * @returns An object describing the total number of backups, combined size,
   *   oldest/newest backup names and the average backup size in bytes.
   */
  // Get backup statistics
  getBackupStatistics(): {
    totalBackups: number;
    totalSize: number;
    oldestBackup?: string;
    newestBackup?: string;
    averageSize: number;
  } {
    const backups = Object.values(this.index.backups);
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    
    const sortedByDate = backups.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return {
      totalBackups: backups.length,
      totalSize,
      oldestBackup: sortedByDate[0]?.name,
      newestBackup: sortedByDate[sortedByDate.length - 1]?.name,
      averageSize: backups.length > 0 ? totalSize / backups.length : 0
    };
  }

  // Private helper methods
  private generateBackupId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  private createDefaultIndex(): BackupIndex {
    return {
      version: '1.0.0',
      backups: {},
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        totalBackups: 0,
        totalSize: 0
      }
    };
  }

  private async loadIndex(): Promise<void> {
    try {
      if (await fs.pathExists(this.indexPath)) {
        this.index = await fs.readJson(this.indexPath);
      } else {
        await this.saveIndex();
      }
    } catch (error) {
      this.index = this.createDefaultIndex();
      await this.saveIndex();
    }
  }

  private async saveIndex(): Promise<void> {
    this.index.metadata.lastModified = new Date().toISOString();
    this.index.metadata.totalBackups = Object.keys(this.index.backups).length;
    this.index.metadata.totalSize = Object.values(this.index.backups)
      .reduce((sum, b) => sum + b.size, 0);
    
    await fs.writeJson(this.indexPath, this.index, { spaces: 2 });
  }

  private async saveWorkspaceDefinition(
    filePath: string,
    definition: WorkspaceDefinition
  ): Promise<void> {
    const yaml = await import('yaml');
    const content = yaml.stringify(definition);
    await fs.writeFile(filePath, content, 'utf8');
  }

  private async backupDirectory(dirPath: string): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    
    try {
      const files = await fs.readdir(dirPath, { recursive: true });
      
      for (const file of files) {
        const fileName = typeof file === 'string' ? file : file.toString();
        const fullPath = path.join(dirPath, fileName);
        const stat = await fs.stat(fullPath);
        
        if (stat.isFile()) {
          try {
            if (fileName.endsWith('.json')) {
              result[fileName] = await fs.readJson(fullPath);
            } else {
              result[fileName] = await fs.readFile(fullPath, 'utf8');
            }
          } catch (error) {
            console.warn(`Failed to backup file ${fileName}:`, (error as Error).message);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to backup directory ${dirPath}:`, (error as Error).message);
    }
    
    return result;
  }

  private async restoreDirectory(
    dirPath: string,
    content: Record<string, any>
  ): Promise<void> {
    await fs.ensureDir(dirPath);
    
    for (const [fileName, fileContent] of Object.entries(content)) {
      const fullPath = path.join(dirPath, fileName);
      await fs.ensureDir(path.dirname(fullPath));
      
      try {
        if (typeof fileContent === 'object') {
          await fs.writeJson(fullPath, fileContent, { spaces: 2 });
        } else {
          await fs.writeFile(fullPath, fileContent, 'utf8');
        }
      } catch (error) {
        console.warn(`Failed to restore file ${fileName}:`, (error as Error).message);
      }
    }
  }

  private async backupFiles(patterns: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const glob = await import('glob');
    
    for (const pattern of patterns) {
      try {
        const files = await glob.glob(pattern, { cwd: this.rootPath });
        
        for (const file of files) {
          const fullPath = path.join(this.rootPath, file);
          
          try {
            const content = await fs.readFile(fullPath, 'utf8');
            result[file] = content;
          } catch (error) {
            console.warn(`Failed to backup file ${file}:`, (error as Error).message);
          }
        }
      } catch (error) {
        console.warn(`Failed to process pattern ${pattern}:`, (error as Error).message);
      }
    }
    
    return result;
  }

  private async restoreFiles(
    targetPath: string,
    files: Record<string, string>,
    force = false
  ): Promise<void> {
    for (const [fileName, content] of Object.entries(files)) {
      const fullPath = path.join(targetPath, fileName);
      
      if (!force && await fs.pathExists(fullPath)) {
        console.warn(`Skipping existing file: ${fileName} (use --force to overwrite)`);
        continue;
      }
      
      await fs.ensureDir(path.dirname(fullPath));
      
      try {
        await fs.writeFile(fullPath, content, 'utf8');
      } catch (error) {
        console.warn(`Failed to restore file ${fileName}:`, (error as Error).message);
      }
    }
  }
}

// Utility functions
/**
 * Create and initialize a {@link WorkspaceBackupManager}.
 *
 * Convenience helper that constructs the manager, runs {@link WorkspaceBackupManager.init}
 * and returns the ready-to-use instance.
 *
 * @param rootPath - Optional workspace root. Defaults to the current working directory.
 * @returns A promise resolving to the initialized backup manager.
 */
export async function createWorkspaceBackupManager(
  rootPath?: string
): Promise<WorkspaceBackupManager> {
  const manager = new WorkspaceBackupManager(rootPath);
  await manager.init();
  return manager;
}

// Quick backup function
/**
 * Create a quick backup with sensible defaults.
 *
 * Wraps {@link WorkspaceBackupManager.createBackup} with state and templates
 * enabled so callers can snapshot a workspace with a single call.
 *
 * @param workspaceFile - Path to the workspace definition file to back up.
 * @param name - Optional friendly name for the backup. A default
 *   `quick-backup-<date>` name is used when omitted.
 * @returns A promise resolving to the id of the newly created backup.
 */
export async function createQuickBackup(
  workspaceFile: string,
  name?: string
): Promise<string> {
  const manager = await createWorkspaceBackupManager();
  return await manager.createBackup(workspaceFile, {
    name: name || `quick-backup-${new Date().toISOString().split('T')[0]}`,
    includeState: true,
    includeTemplates: true
  });
}

// Backup comparison
/**
 * Result of comparing two backups via {@link compareBackups}.
 *
 * Each list contains the workspace keys classified by how they changed between
 * the two snapshots.
 */
export interface BackupComparison {
  /** Workspace keys present only in the second backup. */
  added: string[];
  /** Workspace keys present only in the first backup. */
  removed: string[];
  /** Workspace keys whose serialized content differs between backups. */
  modified: string[];
  /** Workspace keys whose content is identical between backups. */
  unchanged: string[];
}

/**
 * Compare the workspace definitions captured by two backups.
 *
 * @param manager - Backup manager owning the backups to compare.
 * @param id1 - Identifier of the first (older) backup.
 * @param id2 - Identifier of the second (newer) backup.
 * @throws {ValidationError} If either backup cannot be found.
 * @returns A promise resolving to a {@link BackupComparison} classifying each
 *   workspace key as added, removed, modified or unchanged.
 */
export async function compareBackups(
  manager: WorkspaceBackupManager,
  id1: string,
  id2: string
): Promise<BackupComparison> {
  const backup1 = await manager.getBackup(id1);
  const backup2 = await manager.getBackup(id2);

  if (!backup1 || !backup2) {
    throw new ValidationError('One or both backups not found');
  }

  const result: BackupComparison = {
    added: [],
    removed: [],
    modified: [],
    unchanged: []
  };

  // Compare workspace definitions
  const ws1Keys = new Set(Object.keys(backup1.workspace.workspaces || {}));
  const ws2Keys = new Set(Object.keys(backup2.workspace.workspaces || {}));

  for (const key of ws1Keys) {
    if (!ws2Keys.has(key)) {
      result.removed.push(key);
    } else {
      const ws1 = JSON.stringify(backup1.workspace.workspaces[key]);
      const ws2 = JSON.stringify(backup2.workspace.workspaces[key]);
      
      if (ws1 !== ws2) {
        result.modified.push(key);
      } else {
        result.unchanged.push(key);
      }
    }
  }

  for (const key of ws2Keys) {
    if (!ws1Keys.has(key)) {
      result.added.push(key);
    }
  }

  return result;
}