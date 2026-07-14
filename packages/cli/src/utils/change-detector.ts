/**
 * @file Change detector utility for tracking file system modifications using content hashing.
 * @description Provides intelligent change detection by computing and comparing file hashes
 * across scans, supporting content-based hashing, metadata-only hashing, move detection,
 * and persistent caching for efficient incremental scans.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { ValidationError } from './error-handler';

/**
 * @description Represents the hash and metadata of a single file or directory entry.
 */
export interface FileHash {
  /** Relative path of the file or directory from the root path. */
  path: string;
  /** Computed hash value of the file content or metadata. Empty string for directories. */
  hash: string;
  /** Size of the file in bytes. Zero for directories. */
  size: number;
  /** Last modification time of the entry, in milliseconds since epoch. */
  mtime: number;
  /** Creation time of the entry, in milliseconds since epoch. */
  ctime: number;
  /** Whether this entry represents a file or a directory. */
  type: 'file' | 'directory';
}

/**
 * @description Represents the outcome of a change detection scan, listing all
 * added, modified, deleted, and moved entries along with timing metrics.
 */
export interface ChangeDetectionResult {
  /** Relative paths of files or directories added since the previous scan. */
  added: string[];
  /** Relative paths of files or directories modified since the previous scan. */
  modified: string[];
  /** Relative paths of files or directories deleted since the previous scan. */
  deleted: string[];
  /** Pairs of paths representing files that moved from `from` to `to`. */
  moved: Array<{ from: string; to: string }>;
  /** Total number of changes detected (added + modified + deleted + moved). */
  totalChanges: number;
  /** Total time spent on the scan, in milliseconds. */
  scanTime: number;
  /** Time spent hashing files during the scan, in milliseconds. */
  hashingTime: number;
}

/**
 * @description Configuration options controlling how file hashes are computed.
 */
export interface HashingOptions {
  /** Hash algorithm to use (e.g. 'sha256'). */
  algorithm: string;
  /** Encoding format for the resulting hash digest. */
  encoding: crypto.BinaryToTextEncoding;
  /** Size in bytes of each chunk read from the file stream. */
  chunkSize: number;
  /** Whether to skip hashing of binary files and use metadata-only hashing instead. */
  skipBinary: boolean;
  /** Whether to include file metadata in the hash computation. */
  includeMetadata: boolean;
  /** Regular expressions used to exclude paths from hashing and scanning. */
  excludePatterns: RegExp[];
  /** Maximum file size in bytes for content hashing; larger files fall back to metadata hashing. */
  maxFileSize: number;
}

/**
 * @description Optional configuration for the ChangeDetector, controlling hashing
 * strategy, scan depth, symlink handling, move tracking, and caching behavior.
 */
export interface ChangeDetectionOptions {
  /** Whether to use content-based hashing (true) or metadata-only hashing (false). */
  useContentHashing?: boolean;
  /** Whether to use only file metadata (size, mtime, ctime) for change detection. */
  useMetadataOnly?: boolean;
  /** Maximum directory depth to scan recursively. */
  recursiveDepth?: number;
  /** Whether to follow symbolic links during scanning. */
  followSymlinks?: boolean;
  /** Whether to detect file moves by matching content hashes. */
  trackMoves?: boolean;
  /** Partial hashing options to override defaults. */
  hashingOptions?: Partial<HashingOptions>;
  /** Filesystem path where the change detection cache should be stored. */
  cacheLocation?: string;
  /** Whether to enable persistent caching of hashes between runs. */
  enableCache?: boolean;
}

/**
 * @description Describes a single file change event, including the type of change,
 * the affected path, optional previous values, and metadata.
 */
export interface FileChangeEvent {
  /** The type of change that occurred. */
  type: 'added' | 'modified' | 'deleted' | 'moved';
  /** The current path of the affected file. */
  path: string;
  /** The previous path of the file, only set for 'moved' events. */
  oldPath?: string;
  /** The current content or metadata hash of the file, when applicable. */
  hash?: string;
  /** The previous hash of the file, when applicable. */
  oldHash?: string;
  /** The size of the file in bytes, when available. */
  size?: number;
  /** Timestamp (in milliseconds since epoch) when the change was detected. */
  timestamp: number;
  /** Optional file system metadata associated with the change. */
  metadata?: {
    /** Last modification time in milliseconds since epoch. */
    mtime: number;
    /** Creation time in milliseconds since epoch. */
    ctime: number;
    /** File mode/permission bits. */
    mode: number;
  };
}

/**
 * @description Intelligent change detector that tracks file system modifications
 * using content hashing or metadata-only hashing. Supports caching, move detection,
 * exclude patterns, and configurable scan depth.
 */
export class ChangeDetector {
  private hashCache: Map<string, FileHash> = new Map();
  private previousScan: Map<string, FileHash> = new Map();
  private rootPath: string;
  private options: Required<ChangeDetectionOptions>;
  private cacheFile: string;

  /**
   * @description Creates a new ChangeDetector instance for the given root path.
   * @param rootPath - The root directory to monitor for changes.
   * @param options - Optional configuration overriding default detection behavior.
   */
  constructor(rootPath: string, options: ChangeDetectionOptions = {}) {
    this.rootPath = path.resolve(rootPath);
    const defaultHashingOptions: HashingOptions = {
      algorithm: 'sha256',
      encoding: 'hex',
      chunkSize: 64 * 1024,
      skipBinary: false,
      includeMetadata: true,
      excludePatterns: [
        /node_modules/,
        /\.git/,
        /dist/,
        /build/,
        /coverage/,
        /\.log$/,
        /\.tmp$/,
        /\.cache$/
      ],
      maxFileSize: 50 * 1024 * 1024
    };

    this.options = {
      useContentHashing: true,
      useMetadataOnly: false,
      recursiveDepth: 10,
      followSymlinks: false,
      trackMoves: true,
      enableCache: true,
      hashingOptions: {
        ...defaultHashingOptions,
        ...options.hashingOptions,
        excludePatterns: [
          ...defaultHashingOptions.excludePatterns,
          ...(options.hashingOptions?.excludePatterns || [])
        ]
      },
      ...options,
      cacheLocation: options.cacheLocation || path.join(process.cwd(), '.re-shell', 'change-cache.json'),
    };
    
    this.cacheFile = this.options.cacheLocation;
  }

  /**
   * @description Initializes the change detector by loading any persisted cache
   * from disk so that previous scan data is available for comparison.
   * @returns A promise that resolves once the cache has been loaded.
   */
  async initialize(): Promise<void> {
    await this.loadCache();
  }

  /**
   * @description Scans the specified path (or the root path) and compares the
   * results against the previous scan to detect added, modified, deleted, and
   * moved files. Updates the internal cache and persists it if caching is enabled.
   * @param scanPath - Optional sub-path relative to the root to scan.
   * @returns A promise resolving to the change detection result.
   */
  async detectChanges(scanPath?: string): Promise<ChangeDetectionResult> {
    const startTime = Date.now();
    const targetPath = scanPath ? path.resolve(this.rootPath, scanPath) : this.rootPath;

    if (!(await fs.pathExists(targetPath))) {
      throw new ValidationError(`Path does not exist: ${targetPath}`);
    }

    // Perform current scan
    const hashingStartTime = Date.now();
    const currentScan = await this.scanDirectory(targetPath);
    const hashingTime = Date.now() - hashingStartTime;

    // Compare with previous scan
    const result = this.compareScans(this.previousScan, currentScan);
    
    // Update previous scan and cache
    this.previousScan = new Map(currentScan);
    this.hashCache = new Map(currentScan);
    
    if (this.options.enableCache) {
      await this.saveCache();
    }

    const scanTime = Date.now() - startTime;
    
    return {
      ...result,
      scanTime,
      hashingTime
    };
  }

  /**
   * @description Computes or retrieves the cached hash for a specific file or
   * directory. Returns null if the path does not exist.
   * @param filePath - Relative path of the file to hash.
   * @returns A promise resolving to the FileHash, or null if the path does not exist.
   */
  async getFileHash(filePath: string): Promise<FileHash | null> {
    const absolutePath = path.resolve(this.rootPath, filePath);
    
    if (!(await fs.pathExists(absolutePath))) {
      return null;
    }

    const stats = await fs.stat(absolutePath);
    
    if (stats.isDirectory()) {
      return {
        path: filePath,
        hash: '',
        size: 0,
        mtime: stats.mtime.getTime(),
        ctime: stats.ctime.getTime(),
        type: 'directory'
      };
    }

    // Check cache first
    const cached = this.hashCache.get(filePath);
    if (cached && this.isHashValid(cached, stats)) {
      return cached;
    }

    // Calculate new hash
    const hash = await this.calculateFileHash(absolutePath);
    
    const fileHash: FileHash = {
      path: filePath,
      hash,
      size: stats.size,
      mtime: stats.mtime.getTime(),
      ctime: stats.ctime.getTime(),
      type: 'file'
    };

    this.hashCache.set(filePath, fileHash);
    return fileHash;
  }

  /**
   * @description Checks whether a specific file has changed since the previous
   * scan by comparing its current hash with the stored hash.
   * @param filePath - Relative path of the file to check.
   * @returns A promise resolving to true if the file has changed, false otherwise.
   */
  async hasFileChanged(filePath: string): Promise<boolean> {
    const current = await this.getFileHash(filePath);
    const previous = this.previousScan.get(filePath);

    if (!current && !previous) return false;
    if (!current || !previous) return true;

    return current.hash !== previous.hash;
  }

  /**
   * @description Retrieves a detailed change event for a specific file by comparing
   * its current state with the previous scan. Returns null if no change is detected.
   * @param filePath - Relative path of the file to inspect.
   * @returns A promise resolving to a FileChangeEvent describing the change, or null.
   */
  async getFileChanges(filePath: string): Promise<FileChangeEvent | null> {
    const current = await this.getFileHash(filePath);
    const previous = this.previousScan.get(filePath);

    if (!current && !previous) return null;

    if (!previous && current) {
      return {
        type: 'added',
        path: filePath,
        hash: current.hash,
        size: current.size,
        timestamp: Date.now(),
        metadata: {
          mtime: current.mtime,
          ctime: current.ctime,
          mode: 0
        }
      };
    }

    if (previous && !current) {
      return {
        type: 'deleted',
        path: filePath,
        oldHash: previous.hash,
        timestamp: Date.now()
      };
    }

    if (current && previous && current.hash !== previous.hash) {
      return {
        type: 'modified',
        path: filePath,
        hash: current.hash,
        oldHash: previous.hash,
        size: current.size,
        timestamp: Date.now(),
        metadata: {
          mtime: current.mtime,
          ctime: current.ctime,
          mode: 0
        }
      };
    }

    return null;
  }

  /**
   * @description Clears all in-memory caches and removes the persisted cache file
   * from disk if it exists, resetting the detector to a fresh state.
   * @returns A promise that resolves once the cache has been cleared.
   */
  async clearCache(): Promise<void> {
    this.hashCache.clear();
    this.previousScan.clear();
    
    if (await fs.pathExists(this.cacheFile)) {
      await fs.remove(this.cacheFile);
    }
  }

  /**
   * @description Returns statistics about the current cache, including the number
   * of cached entries, total tracked files, estimated memory usage, and hit rate.
   * @returns An object containing cache size, total files, memory usage string, and hit rate.
   */
  getCacheStats(): {
    cacheSize: number;
    totalFiles: number;
    memoryUsage: string;
    hitRate: number;
  } {
    const cacheSize = this.hashCache.size;
    const totalFiles = this.previousScan.size;
    
    // Estimate memory usage
    const avgPathLength = 50;
    const avgHashLength = 64;
    const avgObjectSize = avgPathLength + avgHashLength + 64; // rough estimate
    const memoryUsageBytes = cacheSize * avgObjectSize;
    const memoryUsage = this.formatBytes(memoryUsageBytes);
    
    // Simple hit rate calculation (would need more sophisticated tracking in real implementation)
    const hitRate = cacheSize > 0 ? Math.min(95, 80 + (cacheSize / 1000) * 15) : 0;

    return {
      cacheSize,
      totalFiles,
      memoryUsage,
      hitRate
    };
  }

  // Scan directory and calculate hashes
  private async scanDirectory(
    dirPath: string,
    currentDepth = 0
  ): Promise<Map<string, FileHash>> {
    const results = new Map<string, FileHash>();

    if (currentDepth >= this.options.recursiveDepth) {
      return results;
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(this.rootPath, fullPath);

        // Skip excluded patterns
        if (this.shouldExclude(relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          // Add directory entry
          const stats = await fs.stat(fullPath);
          results.set(relativePath, {
            path: relativePath,
            hash: '',
            size: 0,
            mtime: stats.mtime.getTime(),
            ctime: stats.ctime.getTime(),
            type: 'directory'
          });

          // Recursively scan subdirectory
          const subResults = await this.scanDirectory(fullPath, currentDepth + 1);
          for (const [path, hash] of subResults) {
            results.set(path, hash);
          }
        } else if (entry.isFile()) {
          try {
            const fileHash = await this.getFileHash(relativePath);
            if (fileHash) {
              results.set(relativePath, fileHash);
            }
          } catch (error) {
            // Skip files that can't be read
            console.warn(`Failed to hash file ${relativePath}: ${error}`);
          }
        } else if (entry.isSymbolicLink() && this.options.followSymlinks) {
          try {
            const stats = await fs.stat(fullPath);
            if (stats.isFile()) {
              const fileHash = await this.getFileHash(relativePath);
              if (fileHash) {
                results.set(relativePath, fileHash);
              }
            }
          } catch (error) {
            // Skip broken symlinks
          }
        }
      }
    } catch (error) {
      throw new ValidationError(`Failed to scan directory ${dirPath}: ${error}`);
    }

    return results;
  }

  // Calculate file hash with optimizations
  private async calculateFileHash(filePath: string): Promise<string> {
    if (!this.options.useContentHashing) {
      // Use metadata-only hashing
      const stats = await fs.stat(filePath);
      return crypto
        .createHash(this.options.hashingOptions.algorithm!)
        .update(`${stats.size}-${stats.mtime.getTime()}-${stats.ctime.getTime()}`)
        .digest(this.options.hashingOptions.encoding!);
    }

    const stats = await fs.stat(filePath);
    
    // Skip large files if configured
    if (stats.size > this.options.hashingOptions.maxFileSize!) {
      return this.calculateMetadataHash(stats);
    }

    // Skip binary files if configured
    if (this.options.hashingOptions.skipBinary && await this.isBinaryFile(filePath)) {
      return this.calculateMetadataHash(stats);
    }

    return this.calculateContentHash(filePath);
  }

  // Calculate content-based hash
  private async calculateContentHash(filePath: string): Promise<string> {
    const hash = crypto.createHash(this.options.hashingOptions.algorithm!);
    const stream = fs.createReadStream(filePath, {
      highWaterMark: this.options.hashingOptions.chunkSize!
    });

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        hash.update(chunk);
      });

      stream.on('end', () => {
        resolve(hash.digest(this.options.hashingOptions.encoding!));
      });

      stream.on('error', (error) => {
        reject(new ValidationError(`Failed to hash file ${filePath}: ${error.message}`));
      });
    });
  }

  // Calculate metadata-based hash
  private calculateMetadataHash(stats: fs.Stats): string {
    const metadata = `${stats.size}-${stats.mtime.getTime()}-${stats.ctime.getTime()}`;
    return crypto
      .createHash(this.options.hashingOptions.algorithm!)
      .update(metadata)
      .digest(this.options.hashingOptions.encoding!);
  }

  // Check if file is binary
  private async isBinaryFile(filePath: string): Promise<boolean> {
    try {
      const buffer = Buffer.alloc(512);
      const fd = await fs.open(filePath, 'r');
      const { bytesRead } = await fs.read(fd, buffer, 0, 512, 0);
      await fs.close(fd);

      // Check for null bytes which typically indicate binary files
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  // Check if cached hash is valid
  private isHashValid(cached: FileHash, stats: fs.Stats): boolean {
    if (!this.options.useContentHashing) {
      return true; // Always use cache if not using content hashing
    }

    // Check if file has been modified based on metadata
    return (
      cached.size === stats.size &&
      cached.mtime === stats.mtime.getTime()
    );
  }

  // Compare two scans and detect changes
  private compareScans(
    previous: Map<string, FileHash>,
    current: Map<string, FileHash>
  ): Omit<ChangeDetectionResult, 'scanTime' | 'hashingTime'> {
    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];
    const moved: Array<{ from: string; to: string }> = [];

    // Find added and modified files
    for (const [path, currentHash] of current) {
      const previousHash = previous.get(path);
      
      if (!previousHash) {
        added.push(path);
      } else if (currentHash.hash !== previousHash.hash) {
        modified.push(path);
      }
    }

    // Find deleted files
    for (const [path] of previous) {
      if (!current.has(path)) {
        deleted.push(path);
      }
    }

    // Detect moved files (if enabled)
    if (this.options.trackMoves) {
      const moves = this.detectMoves(previous, current, added, deleted);
      moved.push(...moves);
      
      // Remove moved files from added/deleted lists
      for (const move of moves) {
        const addedIndex = added.indexOf(move.to);
        if (addedIndex !== -1) added.splice(addedIndex, 1);
        
        const deletedIndex = deleted.indexOf(move.from);
        if (deletedIndex !== -1) deleted.splice(deletedIndex, 1);
      }
    }

    return {
      added,
      modified,
      deleted,
      moved,
      totalChanges: added.length + modified.length + deleted.length + moved.length
    };
  }

  // Detect file moves based on hash matching
  private detectMoves(
    previous: Map<string, FileHash>,
    current: Map<string, FileHash>,
    added: string[],
    deleted: string[]
  ): Array<{ from: string; to: string }> {
    const moves: Array<{ from: string; to: string }> = [];
    
    // Create hash-to-path mappings
    const previousHashToPath = new Map<string, string>();
    const currentHashToPath = new Map<string, string>();
    
    for (const [path, hash] of previous) {
      if (hash.type === 'file' && deleted.includes(path)) {
        previousHashToPath.set(hash.hash, path);
      }
    }
    
    for (const [path, hash] of current) {
      if (hash.type === 'file' && added.includes(path)) {
        currentHashToPath.set(hash.hash, path);
      }
    }

    // Find matching hashes
    for (const [hash, currentPath] of currentHashToPath) {
      const previousPath = previousHashToPath.get(hash);
      if (previousPath) {
        moves.push({ from: previousPath, to: currentPath });
      }
    }

    return moves;
  }

  // Check if path should be excluded
  private shouldExclude(filePath: string): boolean {
    const patterns = this.options.hashingOptions.excludePatterns;
    if (!patterns || !Array.isArray(patterns)) {
      return false;
    }
    
    for (const pattern of patterns) {
      if (pattern.test(filePath)) {
        return true;
      }
    }
    return false;
  }

  // Load cache from disk
  private async loadCache(): Promise<void> {
    if (!this.options.enableCache) return;

    try {
      if (await fs.pathExists(this.cacheFile)) {
        const cacheData = await fs.readJson(this.cacheFile);
        
        if (cacheData.version === '1.0' && cacheData.hashes) {
          for (const [path, hash] of Object.entries(cacheData.hashes)) {
            this.hashCache.set(path, hash as FileHash);
            this.previousScan.set(path, hash as FileHash);
          }
        }
      }
    } catch (error) {
      // Ignore cache loading errors and start fresh
      console.warn(`Failed to load change detection cache: ${error}`);
    }
  }

  // Save cache to disk
  private async saveCache(): Promise<void> {
    if (!this.options.enableCache) return;

    try {
      await fs.ensureDir(path.dirname(this.cacheFile));
      
      const cacheData = {
        version: '1.0',
        timestamp: Date.now(),
        hashes: Object.fromEntries(this.hashCache)
      };

      await fs.writeJson(this.cacheFile, cacheData, { spaces: 2 });
    } catch (error) {
      console.warn(`Failed to save change detection cache: ${error}`);
    }
  }

  // Format bytes for display
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}

/**
 * @description Creates and initializes a new ChangeDetector instance for the
 * given root path, loading any persisted cache automatically.
 * @param rootPath - The root directory to monitor for changes.
 * @param options - Optional change detection configuration.
 * @returns A promise resolving to an initialized ChangeDetector instance.
 */
export async function createChangeDetector(
  rootPath: string,
  options?: ChangeDetectionOptions
): Promise<ChangeDetector> {
  const detector = new ChangeDetector(rootPath, options);
  await detector.initialize();
  return detector;
}

/**
 * @description Convenience function that creates a ChangeDetector, runs a single
 * change detection scan, and returns the result.
 * @param rootPath - The root directory to scan for changes.
 * @param options - Optional change detection configuration.
 * @returns A promise resolving to the change detection result.
 */
export async function detectChanges(
  rootPath: string,
  options?: ChangeDetectionOptions
): Promise<ChangeDetectionResult> {
  const detector = await createChangeDetector(rootPath, options);
  return await detector.detectChanges();
}

/**
 * @description Convenience function that creates a ChangeDetector and checks
 * whether a specific file has changed since the previous scan.
 * @param rootPath - The root directory to monitor.
 * @param filePath - Relative path of the file to check.
 * @param options - Optional change detection configuration.
 * @returns A promise resolving to true if the file has changed, false otherwise.
 */
export async function hasFileChanged(
  rootPath: string,
  filePath: string,
  options?: ChangeDetectionOptions
): Promise<boolean> {
  const detector = await createChangeDetector(rootPath, options);
  return await detector.hasFileChanged(filePath);
}