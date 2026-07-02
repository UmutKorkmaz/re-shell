/**
 * @file Workspace state and cache management utilities for the re-shell CLI.
 * @description Provides interfaces and manager classes for persisting per-workspace
 * state (file hashes, build status, health scores) to disk, as well as a two-tier
 * (memory + disk) cache system with TTL support, tag-based invalidation, and
 * optimization capabilities.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { ValidationError } from './error-handler';


/**
 * Represents the persisted state of a single workspace.
 * @description Tracks metadata, build status, health, and content hashes for a workspace.
 */
export interface WorkspaceState {
  /** The unique name of the workspace. */
  name: string;
  /** ISO timestamp of the last modification to the workspace state. */
  lastModified: string;
  /** ISO timestamp of the last build, if any. */
  lastBuild?: string;
  /** The outcome of the most recent build, if known. */
  buildStatus?: 'success' | 'failed' | 'pending';
  /** Optional numeric health score for the workspace. */
  healthScore?: number;
  /** Hash of the workspace's dependency manifest, used for change detection. */
  dependencyHash?: string;
  /** Map of relative file paths to their content hashes. */
  fileHashes: Record<string, string>;
  /** Arbitrary additional metadata associated with the workspace. */
  metadata: Record<string, unknown>;
}

/**
 * Represents the on-disk storage container for all workspace states.
 * @description Root structure persisted to `state.json`, including versioning info
 * and the full collection of workspace states.
 */
export interface WorkspaceStateStorage {
  /** Schema version of the storage format, used for migrations. */
  version: string;
  /** ISO timestamp of the last time the storage was written. */
  timestamp: string;
  /** Map of workspace names to their respective states. */
  workspaces: Record<string, WorkspaceState>;
  /** Global metadata shared across all workspaces. */
  globalMetadata: Record<string, unknown>;
}

/**
 * Represents a single entry in the workspace cache.
 * @description Stores a cached value along with its key, timestamp, optional TTL,
 * tags, and size, enabling two-tier caching and selective invalidation.
 * @template T - The type of the cached value.
 */
export interface CacheEntry<T = any> {
  /** The cache key under which the value is stored. */
  key: string;
  /** The value being cached. */
  value: T;
  /** ISO timestamp marking when the entry was created or last updated. */
  timestamp: string;
  /** Time to live in milliseconds; the entry is considered expired once it elapses. */
  ttl?: number;
  /** Optional tags used for grouped invalidation. */
  tags?: string[];
  /** Optional estimated size of the cached value (e.g. serialized length). */
  size?: number;
}

/**
 * Represents summary metadata about the workspace cache.
 * @description Tracks aggregate statistics used for reporting and optimization.
 */
export interface CacheMetadata {
  /** Total number of entries currently tracked in the cache. */
  totalEntries: number;
  /** Aggregate size of all cached entries. */
  totalSize: number;
  /** ISO timestamp of the last optimization run. */
  lastOptimized: string;
  /** Hit rate (0-1) of cache lookups since the last reset. */
  hitRate: number;
  /** Miss rate (0-1) of cache lookups since the last reset. */
  missRate: number;
}

/**
 * Manages persistence and change detection for workspace state.
 * @description Reads and writes a versioned `state.json` file, tracks file hashes
 * to detect workspace changes, supports backups/restores, and provides statistics.
 */
export class WorkspaceStateManager {
  private statePath: string;
  private stateData: WorkspaceStateStorage;
  private isDirty = false;

  /**
   * Creates a new workspace state manager.
   * @description Initializes the state path and default state data for the given root.
   * @param rootPath - The root directory of the project (defaults to the current working directory).
   */
  constructor(rootPath: string = process.cwd()) {
    this.statePath = path.join(rootPath, '.re-shell', 'state.json');
    this.stateData = this.createDefaultState();
  }

  /**
   * Loads the workspace state from disk, creating an initial state file if absent.
   * @description Validates and migrates any on-disk data into the current schema.
   * @returns A promise resolving to the loaded (or newly created) workspace state storage.
   * @throws {ValidationError} If the state cannot be read or parsed.
   */
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

  /**
   * Persists the current workspace state to disk.
   * @description Ensures the target directory exists and refreshes the stored timestamp.
   * @returns A promise that resolves once the state has been written.
   * @throws {ValidationError} If the state cannot be written to disk.
   */
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

  /**
   * Retrieves the state for a specific workspace.
   * @param name - The name of the workspace whose state should be returned.
   * @returns The workspace state, or `undefined` if no state is tracked for the name.
   */
  getWorkspaceState(name: string): WorkspaceState | undefined {
    return this.stateData.workspaces[name];
  }

  /**
   * Updates the state for a specific workspace, merging partial updates.
   * @description Auto-saves when significant fields (build status or health score) change.
   * @param name - The name of the workspace to update.
   * @param updates - A partial set of workspace state fields to merge in.
   * @returns A promise that resolves once the update (and any auto-save) is complete.
   */
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

  /**
   * Recomputes file hashes for a workspace and persists them in its state.
   * @description Scans the workspace directory for relevant source files and hashes each.
   * @param name - The name of the workspace whose file hashes should be updated.
   * @param workspacePath - The absolute path to the workspace directory to scan.
   * @returns A promise that resolves once the hashes have been updated.
   */
  async updateFileHashes(name: string, workspacePath: string): Promise<void> {
    try {
      const fileHashes = await this.calculateFileHashes(workspacePath);
      await this.updateWorkspaceState(name, { fileHashes });
    } catch (error) {
      console.warn(`Failed to update file hashes for ${name}: ${(error as Error).message}`);
    }
  }

  /**
   * Determines whether a workspace has changed since its last recorded state.
   * @description Compares the currently computed file hashes against the stored ones.
   * @param name - The name of the workspace to check.
   * @param workspacePath - The absolute path to the workspace directory to scan.
   * @returns A promise resolving to `true` if the workspace has changed (or cannot be determined), otherwise `false`.
   */
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

  /**
   * Clears all workspace state and writes the reset state to disk.
   * @returns A promise that resolves once the cleared state has been persisted.
   */
  async clearState(): Promise<void> {
    this.stateData = this.createDefaultState();
    this.isDirty = true;
    await this.saveState();
  }

  /**
   * Creates a backup copy of the current state file.
   * @description Copies the current state file into a `backups` subdirectory.
   * @param backupName - Optional custom file name for the backup (without directory).
   * @returns A promise resolving to the absolute path of the created backup file.
   */
  async backupState(backupName?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = backupName || `state-backup-${timestamp}.json`;
    const backupPath = path.join(path.dirname(this.statePath), 'backups', backupFileName);

    await fs.ensureDir(path.dirname(backupPath));
    await fs.copy(this.statePath, backupPath);

    return backupPath;
  }

  /**
   * Restores workspace state from a previously created backup file.
   * @description Reads, validates, and migrates the backup data, then saves it as the current state.
   * @param backupPath - The absolute path to the backup file to restore from.
   * @returns A promise that resolves once the restored state has been persisted.
   * @throws {ValidationError} If the backup file does not exist.
   */
  async restoreState(backupPath: string): Promise<void> {
    if (!(await fs.pathExists(backupPath))) {
      throw new ValidationError(`Backup file not found: ${backupPath}`);
    }

    const backupData = await fs.readJson(backupPath);
    this.stateData = this.validateAndMigrateState(backupData);
    await this.saveState();
  }

  /**
   * Computes summary statistics about the current workspace state.
   * @description Aggregates counts, sizes, and identifies the oldest and newest workspaces.
   * @returns An object containing the workspace count, last modified timestamp, serialized state size, and the names of the oldest and newest workspaces (if any).
   */
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

/**
 * Provides a two-tier (memory + disk) cache for arbitrary workspace data.
 * @description Supports TTL-based expiration, tag-based invalidation, pattern
 * invalidation, optimization of expired entries, and usage statistics.
 */
export class WorkspaceCacheManager {
  private cachePath: string;
  private cacheDir: string;
  private metadata: CacheMetadata;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private hitCount = 0;
  private missCount = 0;

  /**
   * Creates a new workspace cache manager.
   * @description Sets up the cache directory path, metadata file path, and default metadata.
   * @param rootPath - The root directory of the project (defaults to the current working directory).
   */
  constructor(rootPath: string = process.cwd()) {
    this.cacheDir = path.join(rootPath, '.re-shell', 'cache');
    this.cachePath = path.join(this.cacheDir, 'metadata.json');
    this.metadata = this.createDefaultMetadata();
  }

  /**
   * Initializes the cache system by ensuring the cache directory exists and loading metadata.
   * @description Falls back to default metadata if the metadata file is missing or unreadable.
   * @returns A promise that resolves once the cache is ready for use.
   */
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

  /**
   * Retrieves a cached value by key, checking the memory cache before disk.
   * @description Removes expired entries on access and tracks hit/miss counts.
   * @param key - The cache key to look up.
   * @returns A promise resolving to the cached value, or `null` if absent or expired.
   * @template T - The expected type of the cached value.
   */
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

  /**
   * Stores a value in the cache under the given key, writing to both memory and disk.
   * @description Updates aggregate metadata (entry count and total size) after insertion.
   * @param key - The cache key under which to store the value.
   * @param value - The value to cache.
   * @param ttl - Optional time-to-live in milliseconds after which the entry expires.
   * @param tags - Optional tags associated with the entry for grouped invalidation.
   * @returns A promise that resolves once the entry has been persisted.
   * @template T - The type of the value being cached.
   */
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

  /**
   * Removes a single cache entry by key from both memory and disk.
   * @description Decrements the tracked entry count and updates metadata.
   * @param key - The cache key to invalidate.
   * @returns A promise that resolves once the entry has been removed (if it existed).
   */
  async invalidate(key: string): Promise<void> {
    this.memoryCache.delete(key);

    const entryPath = this.getEntryPath(key);
    if (await fs.pathExists(entryPath)) {
      await fs.remove(entryPath);
      this.metadata.totalEntries = Math.max(0, this.metadata.totalEntries - 1);
      await this.saveMetadata();
    }
  }

  /**
   * Removes all cache entries whose keys match the given pattern.
   * @description Accepts either a `RegExp` or a string (which is converted to a RegExp).
   * @param pattern - A regular expression or string pattern to match against cache keys.
   * @returns A promise resolving to the number of entries invalidated.
   */
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

  /**
   * Clears the entire cache, removing all memory entries and emptying the cache directory.
   * @description Resets metadata to defaults after clearing.
   * @returns A promise that resolves once the cache has been fully cleared.
   */
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

  /**
   * Removes all expired (and corrupted) entries from the cache and reports the reclaimed resources.
   * @description Cleans both the memory and disk tiers, then records the optimization timestamp.
   * @returns A promise resolving to an object containing the number of removed entries and the freed space.
   */
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

  /**
   * Returns current cache statistics, including memory entry count and live hit/miss rates.
   * @description Combines persisted metadata with in-memory request counters.
   * @returns An object containing total entries, total size, last optimized timestamp, hit/miss rates, and the number of in-memory entries.
   */
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

/**
 * Creates and initializes a {@link WorkspaceStateManager} for the given project root.
 * @description Constructs the manager and loads its state from disk before returning.
 * @param rootPath - The root directory of the project (defaults to the current working directory).
 * @returns A promise resolving to a ready-to-use workspace state manager.
 */
export async function createWorkspaceStateManager(rootPath?: string): Promise<WorkspaceStateManager> {
  const manager = new WorkspaceStateManager(rootPath);
  await manager.loadState();
  return manager;
}

/**
 * Creates and initializes a {@link WorkspaceCacheManager} for the given project root.
 * @description Constructs the manager and initializes its cache directory and metadata.
 * @param rootPath - The root directory of the project (defaults to the current working directory).
 * @returns A promise resolving to a ready-to-use workspace cache manager.
 */
export async function createWorkspaceCacheManager(rootPath?: string): Promise<WorkspaceCacheManager> {
  const manager = new WorkspaceCacheManager(rootPath);
  await manager.init();
  return manager;
}

/**
 * Initializes both workspace state and cache storage for the given project root.
 * @description Convenience helper that returns ready-to-use state and cache managers.
 * @param rootPath - The root directory of the project (defaults to the current working directory).
 * @returns A promise resolving to an object containing the initialized state and cache managers.
 */
export async function initializeWorkspaceStorage(rootPath?: string): Promise<{
  stateManager: WorkspaceStateManager;
  cacheManager: WorkspaceCacheManager;
}> {
  const stateManager = await createWorkspaceStateManager(rootPath);
  const cacheManager = await createWorkspaceCacheManager(rootPath);

  return { stateManager, cacheManager };
}
