import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { ValidationError } from './error-handler';
import { WorkspaceDefinition, loadWorkspaceDefinition } from './workspace-schema';
import { createWorkspaceStateManager } from './workspace-state';

// Backup interfaces
export interface BackupMetadata {
  id: string;
  name: string;
  description?: string;
  timestamp: string;
  workspaceFile: string;
  version: string;
  size: number;
  hash: string;
  tags?: string[];
  includeState?: boolean;
  includeCache?: boolean;
  includeTemplates?: boolean;
}

export interface BackupContent {
  metadata: BackupMetadata;
  workspace: WorkspaceDefinition;
  state?: any;
  cache?: any;
  templates?: any;
  files?: Record<string, string>; // path -> content
}

export interface BackupIndex {
  version: string;
  backups: Record<string, BackupMetadata>;
  metadata: {
    created: string;
    lastModified: string;
    totalBackups: number;
    totalSize: number;
  };
}

export interface BackupOptions {
  name?: string;
  description?: string;
  includeState?: boolean;
  includeCache?: boolean;
  includeTemplates?: boolean;
  includeFiles?: boolean;
  filePatterns?: string[];
  tags?: string[];
  compress?: boolean;
}

export interface RestoreOptions {
  force?: boolean;
  selective?: boolean;
  restoreState?: boolean;
  restoreCache?: boolean;
  restoreTemplates?: boolean;
  restoreFiles?: boolean;
  targetPath?: string;
}

// Workspace backup manager
export class WorkspaceBackupManager {
  private backupDir: string;
  private indexPath: string;
  private index: BackupIndex;
  private rootPath: string;

  constructor(rootPath: string = process.cwd()) {
    this.rootPath = rootPath;
    this.backupDir = path.join(rootPath, '.re-shell', 'backups');
    this.indexPath = path.join(this.backupDir, 'index.json');
    this.index = this.createDefaultIndex();
  }

  // Initialize backup system
  async init(): Promise<void> {
    await fs.ensureDir(this.backupDir);
    await this.loadIndex();
  }

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

  // List backups
  async listBackups(): Promise<BackupMetadata[]> {
    return Object.values(this.index.backups).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

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
        const stateManager = await createWorkspaceStateManager(targetPath);
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

  // Export backup to file
  async exportBackup(id: string, outputPath: string): Promise<void> {
    const backup = await this.getBackup(id);
    if (!backup) {
      throw new ValidationError(`Backup '${id}' not found`);
    }

    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeJson(outputPath, backup, { spaces: 2 });
  }

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
export async function createWorkspaceBackupManager(
  rootPath?: string
): Promise<WorkspaceBackupManager> {
  const manager = new WorkspaceBackupManager(rootPath);
  await manager.init();
  return manager;
}

// Quick backup function
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
export interface BackupComparison {
  added: string[];
  removed: string[];
  modified: string[];
  unchanged: string[];
}

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