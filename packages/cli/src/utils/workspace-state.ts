import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { ValidationError } from './error-handler';
import { WorkspaceDefinition } from './workspace-schema';

// Workspace state interfaces
export interface WorkspaceState {
  name: string;
  lastModified: string;
  lastBuild?: string;
  buildStatus?: 'success' | 'failed' | 'pending';
  healthScore?: number;
  dependencyHash?: string;
  fileHashes: Record<string, string>;
  metadata: Record<string, any>;
}

export interface WorkspaceStateStorage {
  version: string;
  timestamp: string;
  workspaces: Record<string, WorkspaceState>;
  globalMetadata: Record<string, any>;
}

// Cache entry interface
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: string;
  ttl?: number; // Time to live in milliseconds
  tags?: string[];
  size?: number;
}

export interface CacheMetadata {
  totalEntries: number;
  totalSize: number;
  lastOptimized: string;
  hitRate: number;
  missRate: number;
}

// Workspace state manager
export class WorkspaceStateManager {
  private statePath: string;
  private stateData: WorkspaceStateStorage;
  private isDirty = false;

  constructor(rootPath: string = process.cwd()) {
    this.statePath = path.join(rootPath, '.re-shell', 'state.json');
    this.stateData = this.createDefaultState();
  }

  // Load state from disk
  async loadState(): Promise<WorkspaceStateStorage> {
    try {
      if (await fs.pathExists(this.statePath)) {
        const data = await fs.readJson(this.statePath);
        this.stateData = this.validateAndMigrateState(data);
      } else {
        this.stateData = this.createDefaultState();
        await this.saveState(); // Create initial state file
      }
      this.isDirty = false;
      return this.stateData;
    } catch (error) {
      throw new ValidationError(`Failed to load workspace state: ${(error as Error).message}`);
    }
  }

  // Save state to disk
  async saveState(): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.statePath));
      this.stateData.timestamp = new Date().toISOString();
      await fs.writeJson(this.statePath, this.stateData, { spaces: 2 });
      this.isDirty = false;
    } catch (error) {
      throw new ValidationError(`Failed to save workspace state: ${(error as Error).message}`);
    }
  }

  // Get state for specific workspace
  getWorkspaceState(name: string): WorkspaceState | undefined {
    return this.stateData.workspaces[name];
  }

  // Update workspace state
  async updateWorkspaceState(name: string, updates: Partial<WorkspaceState>): Promise<void> {
    const existing = this.stateData.workspaces[name] || this.createDefaultWorkspaceState(name);
    
    this.stateData.workspaces[name] = {
      ...existing,
      ...updates,
      lastModified: new Date().toISOString()
    };
    
    this.isDirty = true;
    
    // Auto-save if significant changes
    if (updates.buildStatus || updates.healthScore !== undefined) {
      await this.saveState();
    }
  }

  // Update file hashes for workspace
  async updateFileHashes(name: string, workspacePath: string): Promise<void> {
    try {
      const fileHashes = await this.calculateFileHashes(workspacePath);
      await this.updateWorkspaceState(name, { fileHashes });
    } catch (error) {
      console.warn(`Failed to update file hashes for ${name}: ${(error as Error).message}`);
    }
  }

  // Check if workspace has changed since last update
  async hasWorkspaceChanged(name: string, workspacePath: string): Promise<boolean> {
    const state = this.getWorkspaceState(name);
    if (!state || !state.fileHashes) return true;

    try {
      const currentHashes = await this.calculateFileHashes(workspacePath);
      return !this.areHashesEqual(state.fileHashes, currentHashes);
    } catch (error) {
      return true; // Assume changed if we can't determine
    }
  }

  // Clear all state
  async clearState(): Promise<void> {
    this.stateData = this.createDefaultState();
    this.isDirty = true;
    await this.saveState();
  }

  // Backup current state
  async backupState(backupName?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = backupName || `state-backup-${timestamp}.json`;
    const backupPath = path.join(path.dirname(this.statePath), 'backups', backupFileName);
    
    await fs.ensureDir(path.dirname(backupPath));
    await fs.copy(this.statePath, backupPath);
    
    return backupPath;
  }

  // Restore state from backup
  async restoreState(backupPath: string): Promise<void> {
    if (!(await fs.pathExists(backupPath))) {
      throw new ValidationError(`Backup file not found: ${backupPath}`);
    }
    
    const backupData = await fs.readJson(backupPath);
    this.stateData = this.validateAndMigrateState(backupData);
    await this.saveState();
  }

  // Get state statistics
  getStateStatistics(): {
    workspaceCount: number;
    lastModified: string;
    stateFileSize: number;
    oldestWorkspace?: string;
    newestWorkspace?: string;
  } {
    const workspaces = Object.values(this.stateData.workspaces);
    const sortedByDate = workspaces.sort((a, b) => 
      new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime()
    );

    return {
      workspaceCount: workspaces.length,
      lastModified: this.stateData.timestamp,
      stateFileSize: JSON.stringify(this.stateData).length,
      oldestWorkspace: sortedByDate[0]?.name,
      newestWorkspace: sortedByDate[sortedByDate.length - 1]?.name
    };
  }

  // Private helper methods
  private createDefaultState(): WorkspaceStateStorage {
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      workspaces: {},
      globalMetadata: {}
    };
  }

  private createDefaultWorkspaceState(name: string): WorkspaceState {
    return {
      name,
      lastModified: new Date().toISOString(),
      fileHashes: {},
      metadata: {}
    };
  }

  private validateAndMigrateState(data: any): WorkspaceStateStorage {
    // Basic validation
    if (!data.version || !data.workspaces) {
      return this.createDefaultState();
    }

    // Migration logic for future version changes
    if (data.version === '1.0.0') {
      return data as WorkspaceStateStorage;
    }

    // Default migration: recreate state
    return this.createDefaultState();
  }

  private async calculateFileHashes(dirPath: string): Promise<Record<string, string>> {
    const hashes: Record<string, string> = {};
    
    try {
      const files = await this.getRelevantFiles(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        if (await fs.pathExists(filePath)) {
          const content = await fs.readFile(filePath);
          hashes[file] = crypto.createHash('md5').update(content).digest('hex');
        }
      }
    } catch (error) {
      // Return empty hashes if directory scanning fails
    }
    
    return hashes;
  }

  private async getRelevantFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const relevantExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml'];
    const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next'];
    
    try {
      const scan = async (dir: string, basePath = '') => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.join(basePath, entry.name);
          
          if (entry.isDirectory() && !ignoreDirs.includes(entry.name)) {
            await scan(fullPath, relativePath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (relevantExtensions.includes(ext)) {
              files.push(relativePath);
            }
          }
        }
      };
      
      await scan(dirPath);
    } catch (error) {
      // Return empty array if scanning fails
    }
    
    return files.slice(0, 100); // Limit to prevent memory issues
  }

  private areHashesEqual(hash1: Record<string, string>, hash2: Record<string, string>): boolean {
    const keys1 = Object.keys(hash1).sort();
    const keys2 = Object.keys(hash2).sort();
    
    if (keys1.length !== keys2.length) return false;
    
    for (let i = 0; i < keys1.length; i++) {
      if (keys1[i] !== keys2[i] || hash1[keys1[i]] !== hash2[keys2[i]]) {
        return false;
      }
    }
    
    return true;
  }
}

// Workspace cache manager
export class WorkspaceCacheManager {
  private cachePath: string;
  private cacheDir: string;
  private metadata: CacheMetadata;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private hitCount = 0;
  private missCount = 0;

  constructor(rootPath: string = process.cwd()) {
    this.cacheDir = path.join(rootPath, '.re-shell', 'cache');
    this.cachePath = path.join(this.cacheDir, 'metadata.json');
    this.metadata = this.createDefaultMetadata();
  }

  // Initialize cache system
  async init(): Promise<void> {
    await fs.ensureDir(this.cacheDir);
    
    if (await fs.pathExists(this.cachePath)) {
      try {
        this.metadata = await fs.readJson(this.cachePath);
      } catch (error) {
        this.metadata = this.createDefaultMetadata();
      }
    }
  }

  // Get cached value
  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key)!;
      if (this.isEntryValid(entry)) {
        this.hitCount++;
        return entry.value as T;
      } else {
        this.memoryCache.delete(key);
      }
    }

    // Check disk cache
    const entryPath = this.getEntryPath(key);
    
    try {
      if (await fs.pathExists(entryPath)) {
        const entry: CacheEntry<T> = await fs.readJson(entryPath);
        
        if (this.isEntryValid(entry)) {
          // Load into memory cache
          this.memoryCache.set(key, entry);
          this.hitCount++;
          return entry.value;
        } else {
          // Remove expired entry
          await fs.remove(entryPath);
        }
      }
    } catch (error) {
      // Cache read failed, treat as miss
    }

    this.missCount++;
    return null;
  }

  // Set cached value
  async set<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<void> {
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: new Date().toISOString(),
      ttl,
      tags,
      size: this.calculateSize(value)
    };

    // Store in memory cache
    this.memoryCache.set(key, entry);

    // Store on disk
    const entryPath = this.getEntryPath(key);
    await fs.ensureDir(path.dirname(entryPath));
    await fs.writeJson(entryPath, entry);

    // Update metadata
    this.metadata.totalEntries++;
    this.metadata.totalSize += entry.size || 0;
    await this.saveMetadata();
  }

  // Invalidate specific cache entry
  async invalidate(key: string): Promise<void> {
    this.memoryCache.delete(key);
    
    const entryPath = this.getEntryPath(key);
    if (await fs.pathExists(entryPath)) {
      await fs.remove(entryPath);
      this.metadata.totalEntries = Math.max(0, this.metadata.totalEntries - 1);
      await this.saveMetadata();
    }
  }

  // Invalidate entries matching pattern
  async invalidatePattern(pattern: RegExp | string): Promise<number> {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let invalidated = 0;

    // Clear from memory cache
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        invalidated++;
      }
    }

    // Clear from disk cache
    try {
      const files = await fs.readdir(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json') && file !== 'metadata.json') {
          const key = this.decodeKey(file.replace('.json', ''));
          if (regex.test(key)) {
            await fs.remove(path.join(this.cacheDir, file));
            invalidated++;
          }
        }
      }
    } catch (error) {
      // Directory scan failed
    }

    this.metadata.totalEntries = Math.max(0, this.metadata.totalEntries - invalidated);
    await this.saveMetadata();
    
    return invalidated;
  }

  // Clear all cache
  async clear(): Promise<void> {
    this.memoryCache.clear();
    
    try {
      await fs.emptyDir(this.cacheDir);
    } catch (error) {
      // Ignore cleanup errors
    }
    
    this.metadata = this.createDefaultMetadata();
    await this.saveMetadata();
  }

  // Optimize cache (remove expired entries)
  async optimize(): Promise<{ removedEntries: number; freedSpace: number }> {
    let removedEntries = 0;
    let freedSpace = 0;

    // Clean memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (!this.isEntryValid(entry)) {
        this.memoryCache.delete(key);
        removedEntries++;
        freedSpace += entry.size || 0;
      }
    }

    // Clean disk cache
    try {
      const files = await fs.readdir(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json') && file !== 'metadata.json') {
          const entryPath = path.join(this.cacheDir, file);
          try {
            const entry: CacheEntry = await fs.readJson(entryPath);
            if (!this.isEntryValid(entry)) {
              await fs.remove(entryPath);
              removedEntries++;
              freedSpace += entry.size || 0;
            }
          } catch (error) {
            // Remove corrupted cache files
            await fs.remove(entryPath);
            removedEntries++;
          }
        }
      }
    } catch (error) {
      // Directory scan failed
    }

    this.metadata.totalEntries = Math.max(0, this.metadata.totalEntries - removedEntries);
    this.metadata.totalSize = Math.max(0, this.metadata.totalSize - freedSpace);
    this.metadata.lastOptimized = new Date().toISOString();
    await this.saveMetadata();

    return { removedEntries, freedSpace };
  }

  // Get cache statistics
  getCacheStatistics(): CacheMetadata & {
    memoryEntries: number;
    hitRate: number;
    missRate: number;
  } {
    const totalRequests = this.hitCount + this.missCount;
    
    return {
      ...this.metadata,
      memoryEntries: this.memoryCache.size,
      hitRate: totalRequests > 0 ? this.hitCount / totalRequests : 0,
      missRate: totalRequests > 0 ? this.missCount / totalRequests : 0
    };
  }

  // Private helper methods
  private createDefaultMetadata(): CacheMetadata {
    return {
      totalEntries: 0,
      totalSize: 0,
      lastOptimized: new Date().toISOString(),
      hitRate: 0,
      missRate: 0
    };
  }

  private getEntryPath(key: string): string {
    const encodedKey = this.encodeKey(key);
    return path.join(this.cacheDir, `${encodedKey}.json`);
  }

  private encodeKey(key: string): string {
    return Buffer.from(key).toString('base64url');
  }

  private decodeKey(encodedKey: string): string {
    return Buffer.from(encodedKey, 'base64url').toString();
  }

  private isEntryValid(entry: CacheEntry): boolean {
    if (!entry.ttl) return true;
    
    const now = Date.now();
    const entryTime = new Date(entry.timestamp).getTime();
    
    return (now - entryTime) < entry.ttl;
  }

  private calculateSize(value: any): number {
    try {
      return JSON.stringify(value).length;
    } catch (error) {
      return 0;
    }
  }

  private async saveMetadata(): Promise<void> {
    try {
      await fs.writeJson(this.cachePath, this.metadata, { spaces: 2 });
    } catch (error) {
      // Ignore metadata save failures
    }
  }
}

// Utility functions
export async function createWorkspaceStateManager(rootPath?: string): Promise<WorkspaceStateManager> {
  const manager = new WorkspaceStateManager(rootPath);
  await manager.loadState();
  return manager;
}

export async function createWorkspaceCacheManager(rootPath?: string): Promise<WorkspaceCacheManager> {
  const manager = new WorkspaceCacheManager(rootPath);
  await manager.init();
  return manager;
}

// Combined state and cache operations
export async function initializeWorkspaceStorage(rootPath?: string): Promise<{
  stateManager: WorkspaceStateManager;
  cacheManager: WorkspaceCacheManager;
}> {
  const stateManager = await createWorkspaceStateManager(rootPath);
  const cacheManager = await createWorkspaceCacheManager(rootPath);
  
  return { stateManager, cacheManager };
}