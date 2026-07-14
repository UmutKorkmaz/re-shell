import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';


import { 
  PluginCommandContext
} from './plugin-command-registry';

/**
 * Strategies for where and how cached entries are stored.
 */
export enum CacheStorageStrategy {
  /** Cache entries are held only in memory. */
  MEMORY = 'memory',
  /** Cache entries are persisted to the file system. */
  FILE_SYSTEM = 'file-system',
  /** Cache entries are stored in both memory and on disk. */
  HYBRID = 'hybrid',
  /** Cache entries are stored in an external database. */
  DATABASE = 'database'
}

/**
 * Strategies that determine when cached entries are invalidated or evicted.
 */
export enum CacheInvalidationStrategy {
  /** Entries expire after a configured time-to-live. */
  TTL = 'ttl',
  /** Least recently used entries are evicted first. */
  LRU = 'lru',
  /** Least frequently used entries are evicted first. */
  LFU = 'lfu',
  /** First-in, first-out eviction order. */
  FIFO = 'fifo',
  /** Entries are invalidated only via explicit manual calls. */
  MANUAL = 'manual',
  /** Entries are invalidated in response to emitted events. */
  EVENT_BASED = 'event-based'
}

/**
 * Levels of detail for performance metrics collection.
 */
export enum PerformanceMonitoringLevel {
  /** No performance monitoring is performed. */
  NONE = 'none',
  /** Essential performance metrics are collected. */
  BASIC = 'basic',
  /** Detailed performance metrics including per-command breakdowns. */
  DETAILED = 'detailed',
  /** Maximum verbosity, recording every operation. */
  VERBOSE = 'verbose'
}

/**
 * Represents a single cached value along with its tracking metadata.
 *
 * @typeParam T - The type of the cached value.
 */
export interface CacheEntry<T = any> {
  /** Unique identifier for the cache entry. */
  key: string;
  /** The cached value itself. */
  value: T;
  /** Metadata describing the command execution that produced the value. */
  metadata: CacheEntryMetadata;
  /** Timestamp (ms since epoch) when the entry was created. */
  createdAt: number;
  /** Timestamp (ms since epoch) of the most recent access. */
  lastAccessedAt: number;
  /** Number of times the entry has been read from cache. */
  accessCount: number;
  /** Optional timestamp (ms since epoch) when the entry expires. */
  expiresAt?: number;
  /** Approximate serialized size of the cached value in bytes. */
  size: number;
  /** Tags associated with the entry for bulk invalidation. */
  tags: string[];
}

/**
 * Metadata describing the command execution that produced a cache entry.
 */
export interface CacheEntryMetadata {
  /** Identifier of the command that generated this entry. */
  commandId: string;
  /** Hash of the arguments used during execution. */
  argumentsHash: string;
  /** Hash of the options used during execution. */
  optionsHash: string;
  /** Hash of the command context at execution time. */
  contextHash: string;
  /** Time in milliseconds the command took to execute. */
  executionTime: number;
  /** Whether the command completed successfully. */
  success: boolean;
  /** Information about an error that occurred during execution, if any. */
  errorInfo?: {
    /** The error type or constructor name. */
    type: string;
    /** Human-readable error message. */
    message: string;
    /** Optional stack trace captured at the point of failure. */
    stack?: string;
  };
  /** List of file or resource dependencies detected for the entry. */
  dependencies: string[];
  /** Tags identifying events or conditions that should invalidate the entry. */
  invalidators: string[];
}

/**
 * Configuration options for the plugin command cache manager.
 */
export interface CacheConfiguration {
  /** Whether caching is enabled. */
  enabled: boolean;
  /** Where cached entries are stored. */
  strategy: CacheStorageStrategy;
  /** How cached entries are invalidated or evicted. */
  invalidationStrategy: CacheInvalidationStrategy;
  /** Maximum number of entries to retain. */
  maxSize: number;
  /** Maximum total memory usage in bytes. */
  maxMemoryUsage: number; // in bytes
  /** Default time-to-live for entries in milliseconds. */
  defaultTTL: number; // in milliseconds
  /** Interval in milliseconds between automatic cleanup passes. */
  cleanupInterval: number; // in milliseconds
  /** Whether disk-stored entries are compressed. */
  compressionEnabled: boolean;
  /** Whether disk-stored entries are encrypted. */
  encryptionEnabled: boolean;
  /** Whether the cache is persisted to disk. */
  persistToDisk: boolean;
  /** Optional path to the directory used for the on-disk cache. */
  diskCachePath?: string;
  /** Verbosity of collected performance metrics. */
  performanceMonitoring: PerformanceMonitoringLevel;
}

/**
 * Aggregated performance and usage statistics for the cache.
 */
export interface PerformanceMetrics {
  /** Total number of command executions attempted. */
  totalExecutions: number;
  /** Number of executions served from the cache. */
  cacheHits: number;
  /** Number of executions that bypassed the cache. */
  cacheMisses: number;
  /** Ratio of hits to total lookups (0-1). */
  hitRate: number;
  /** Average wall-clock execution time in milliseconds. */
  averageExecutionTime: number;
  /** Average execution time in milliseconds for cache hits. */
  averageCachedExecutionTime: number;
  /** Approximate total memory used by entries in bytes. */
  totalMemoryUsage: number;
  /** Approximate total disk space used by entries in bytes. */
  totalDiskUsage: number;
  /** List of the slowest commands by average execution time. */
  slowestCommands: Array<{
    /** Identifier of the command. */
    commandId: string;
    /** Average execution time in milliseconds. */
    averageTime: number;
    /** Number of times the command was executed. */
    executionCount: number;
  }>;
  /** List of commands with the highest cache utilization. */
  mostCachedCommands: Array<{
    /** Identifier of the command. */
    commandId: string;
    /** Number of cache hits for the command. */
    cacheHits: number;
    /** Hit rate for the command (0-1). */
    hitRate: number;
  }>;
  /** Ratio of failed executions to total executions (0-1). */
  errorRate: number;
  /** Timestamp (ms since epoch) of the last cleanup pass. */
  lastCleanupAt: number;
}

/**
 * Result of executing a command through the cache layer.
 *
 * @typeParam T - The type of the value produced by the command.
 */
export interface CacheOperationResult<T = any> {
  /** Whether the result was served from the cache. */
  hit: boolean;
  /** The returned value, if the command succeeded. */
  value?: T;
  /** Metadata for the cache entry backing the result, when available. */
  metadata?: CacheEntryMetadata;
  /** Total execution time in milliseconds. */
  executionTime: number;
  /** Whether the value originated from the cache or a live execution. */
  source: 'cache' | 'execution';
  /** Error encountered during execution, if any. */
  error?: Error;
}

/**
 * Manages caching of plugin command results, supporting multiple storage and
 * invalidation strategies, optional compression/encryption, and performance
 * metrics collection.
 */
export class PluginCommandCacheManager extends EventEmitter {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = []; // For LRU tracking
  private accessFrequency: Map<string, number> = new Map(); // For LFU tracking
  private config: CacheConfiguration;
  private metrics: PerformanceMetrics;
  private cleanupTimer?: NodeJS.Timeout;
  private encryptionKey?: Buffer;

  /**
   * Create a new cache manager.
   *
   * @param config - Optional partial configuration overrides merged with defaults.
   */
  constructor(config?: Partial<CacheConfiguration>) {
    super();
    
    this.config = {
      enabled: true,
      strategy: CacheStorageStrategy.HYBRID,
      invalidationStrategy: CacheInvalidationStrategy.LRU,
      maxSize: 1000,
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 60 * 1000, // 1 minute
      compressionEnabled: true,
      encryptionEnabled: false,
      persistToDisk: true,
      performanceMonitoring: PerformanceMonitoringLevel.BASIC,
      ...config
    };

    this.metrics = {
      totalExecutions: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      averageExecutionTime: 0,
      averageCachedExecutionTime: 0,
      totalMemoryUsage: 0,
      totalDiskUsage: 0,
      slowestCommands: [],
      mostCachedCommands: [],
      errorRate: 0,
      lastCleanupAt: Date.now()
    };

    this.initialize();
  }

  /**
   * Initialize the cache manager by setting up encryption keys, disk storage,
   * loading existing entries, and starting the cleanup timer.
   *
   * @returns Resolves once initialization completes.
   */
  private async initialize(): Promise<void> {
    try {
      // Setup encryption if enabled
      if (this.config.encryptionEnabled) {
        this.encryptionKey = crypto.randomBytes(32);
      }

      // Setup disk cache directory
      if (this.config.persistToDisk && this.config.diskCachePath) {
        await fs.ensureDir(this.config.diskCachePath);
      }

      // Load existing cache from disk
      if (this.config.strategy === CacheStorageStrategy.FILE_SYSTEM || 
          this.config.strategy === CacheStorageStrategy.HYBRID) {
        await this.loadCacheFromDisk();
      }

      // Setup cleanup interval
      if (this.config.cleanupInterval > 0) {
        this.cleanupTimer = setInterval(() => {
          this.performCleanup();
        }, this.config.cleanupInterval);
      }

      this.emit('cache-initialized', { config: this.config });

    } catch (error) {
      this.emit('cache-initialization-error', error);
      throw error;
    }
  }

  /**
   * Execute a command, returning a cached result when available and caching
   * the result on miss.
   *
   * @typeParam T - The type of the value returned by the executor.
   * @param commandId - Identifier of the command being executed.
   * @param args - The arguments passed to the command.
   * @param options - The options passed to the command.
   * @param context - The plugin command context for the execution.
   * @param executor - Function that performs the actual command execution.
   * @returns The result of the cache lookup or fresh execution.
   */
  async executeWithCache<T = any>(
    commandId: string,
    args: Record<string, unknown>,
    options: Record<string, unknown>,
    context: PluginCommandContext,
    executor: () => Promise<T>
  ): Promise<CacheOperationResult<T>> {
    const startTime = performance.now();
    this.metrics.totalExecutions++;

    try {
      if (!this.config.enabled) {
        const result = await executor();
        const executionTime = performance.now() - startTime;
        this.updateMetrics(executionTime, false, true);
        
        return {
          hit: false,
          value: result,
          executionTime,
          source: 'execution'
        };
      }

      // Generate cache key
      const cacheKey = this.generateCacheKey(commandId, args, options, context);

      // Check cache first
      const cachedEntry = await this.getCacheEntry(cacheKey);
      if (cachedEntry && !this.isExpired(cachedEntry)) {
        // Cache hit
        this.updateAccessTracking(cacheKey);
        const executionTime = performance.now() - startTime;
        this.updateMetrics(executionTime, true, true);

        this.emit('cache-hit', { commandId, cacheKey, executionTime });

        return {
          hit: true,
          value: cachedEntry.value,
          metadata: cachedEntry.metadata,
          executionTime,
          source: 'cache'
        };
      }

      // Cache miss - execute command
      this.metrics.cacheMisses++;
      const result = await executor();
      const executionTime = performance.now() - startTime;

      // Cache the result
      const metadata: CacheEntryMetadata = {
        commandId,
        argumentsHash: this.hashObject(args),
        optionsHash: this.hashObject(options),
        contextHash: this.hashContext(context),
        executionTime,
        success: true,
        dependencies: this.extractDependencies(args, options),
        invalidators: this.extractInvalidators(commandId, args, options)
      };

      await this.setCacheEntry(cacheKey, result, metadata);
      this.updateMetrics(executionTime, false, true);

      this.emit('cache-miss', { commandId, cacheKey, executionTime });

      return {
        hit: false,
        value: result,
        metadata,
        executionTime,
        source: 'execution'
      };

    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.updateMetrics(executionTime, false, false);

      // Cache error information for debugging
      if (this.config.enabled) {
        const cacheKey = this.generateCacheKey(commandId, args, options, context);
        const metadata: CacheEntryMetadata = {
          commandId,
          argumentsHash: this.hashObject(args),
          optionsHash: this.hashObject(options),
          contextHash: this.hashContext(context),
          executionTime,
          success: false,
          errorInfo: {
            type: error instanceof Error ? error.constructor.name : 'Error',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          },
          dependencies: [],
          invalidators: []
        };

        // Don't cache the error result, but log it for analysis
        this.emit('execution-error', { commandId, cacheKey, error, metadata });
      }

      return {
        hit: false,
        executionTime,
        source: 'execution',
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Generate a deterministic cache key from the command id, arguments,
   * options, and stable parts of the execution context.
   *
   * @param commandId - Identifier of the command.
   * @param args - Command arguments.
   * @param options - Command options.
   * @param context - Plugin command context.
   * @returns A SHA-256 hex hash uniquely identifying the invocation.
   */
  private generateCacheKey(
    commandId: string,
    args: Record<string, unknown>,
    options: Record<string, unknown>,
    context: PluginCommandContext
  ): string {
    const keyData = {
      commandId,
      args: this.normalizeForHashing(args),
      options: this.normalizeForHashing(options),
      context: {
        // Only include stable context parts that affect command behavior
        rootPath: context.cli.rootPath,
        configPath: context.cli.configPath,
        version: context.cli.version
      }
    };

    return crypto.createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  /**
   * Retrieve a cache entry by key, checking memory first and then disk.
   *
   * @param key - The cache key to look up.
   * @returns The matching entry, or `undefined` when not found.
   */
  private async getCacheEntry(key: string): Promise<CacheEntry | undefined> {
    // Check memory first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      return memoryEntry;
    }

    // Check disk if hybrid strategy
    if (this.config.strategy === CacheStorageStrategy.HYBRID || 
        this.config.strategy === CacheStorageStrategy.FILE_SYSTEM) {
      return await this.loadCacheEntryFromDisk(key);
    }

    return undefined;
  }

  /**
   * Store a cache entry using the configured storage strategy, evicting older
   * entries as needed to respect capacity limits.
   *
   * @param key - The cache key under which to store the entry.
   * @param value - The value to cache.
   * @param metadata - Execution metadata describing the value.
   * @returns Resolves once the entry has been persisted.
   */
  private async setCacheEntry(
    key: string,
    value: any,
    metadata: CacheEntryMetadata
  ): Promise<void> {
    const now = Date.now();
    const entry: CacheEntry = {
      key,
      value,
      metadata,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 1,
      expiresAt: now + this.config.defaultTTL,
      size: this.calculateSize(value),
      tags: this.generateTags(metadata)
    };

    // Store in memory
    if (this.config.strategy === CacheStorageStrategy.MEMORY || 
        this.config.strategy === CacheStorageStrategy.HYBRID) {
      
      // Check if we need to evict entries
      await this.ensureCapacity();
      
      this.memoryCache.set(key, entry);
      this.updateAccessOrder(key);
    }

    // Store on disk
    if (this.config.strategy === CacheStorageStrategy.FILE_SYSTEM || 
        this.config.strategy === CacheStorageStrategy.HYBRID) {
      await this.saveCacheEntryToDisk(key, entry);
    }

    this.updateMetrics();
    this.emit('cache-entry-set', { key, size: entry.size });
  }

  /**
   * Determine whether a cache entry has passed its expiry time.
   *
   * @param entry - The cache entry to check.
   * @returns `true` if the entry has expired; otherwise `false`.
   */
  private isExpired(entry: CacheEntry): boolean {
    if (!entry.expiresAt) return false;
    return Date.now() > entry.expiresAt;
  }

  /**
   * Update access timestamps and frequency counters for a key, supporting
   * LRU and LFU eviction strategies.
   *
   * @param key - The cache key that was accessed.
   */
  private updateAccessTracking(key: string): void {
    const entry = this.memoryCache.get(key);
    if (entry) {
      entry.lastAccessedAt = Date.now();
      entry.accessCount++;
      
      this.updateAccessOrder(key);
      this.accessFrequency.set(key, (this.accessFrequency.get(key) || 0) + 1);
    }
  }

  /**
   * Move the given key to the end of the access-order list used by LRU.
   *
   * @param key - The cache key to mark as most recently used.
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Enforce configured size and memory limits by evicting entries when the
   * cache exceeds capacity.
   *
   * @returns Resolves once capacity constraints are satisfied.
   */
  private async ensureCapacity(): Promise<void> {
    // Check size limit
    if (this.memoryCache.size >= this.config.maxSize) {
      await this.evictEntries(Math.floor(this.config.maxSize * 0.1)); // Evict 10%
    }

    // Check memory usage
    const currentMemoryUsage = this.calculateTotalMemoryUsage();
    if (currentMemoryUsage > this.config.maxMemoryUsage) {
      const targetReduction = currentMemoryUsage - (this.config.maxMemoryUsage * 0.8);
      await this.evictEntriesBySize(targetReduction);
    }
  }

  /**
   * Evict a given number of entries using the configured invalidation strategy.
   *
   * @param count - The number of entries to evict.
   * @returns Resolves once the requested entries have been removed.
   */
  private async evictEntries(count: number): Promise<void> {
    const keysToEvict: string[] = [];

    switch (this.config.invalidationStrategy) {
      case CacheInvalidationStrategy.LRU:
        keysToEvict.push(...this.accessOrder.slice(0, count));
        break;

      case CacheInvalidationStrategy.LFU:
        {
        const entriesByFrequency = Array.from(this.memoryCache.keys())
          .sort((a, b) => (this.accessFrequency.get(a) || 0) - (this.accessFrequency.get(b) || 0));
        keysToEvict.push(...entriesByFrequency.slice(0, count));
        break;

        }
      case CacheInvalidationStrategy.FIFO:
        {
        const entriesByCreation = Array.from(this.memoryCache.entries())
          .sort((a, b) => a[1].createdAt - b[1].createdAt);
        keysToEvict.push(...entriesByCreation.slice(0, count).map(([key]) => key));
        break;

        }
      case CacheInvalidationStrategy.TTL:
        {
        const expiredEntries = Array.from(this.memoryCache.entries())
          .filter(([, entry]) => this.isExpired(entry))
          .slice(0, count);
        keysToEvict.push(...expiredEntries.map(([key]) => key));
        break;
        }
    }

    for (const key of keysToEvict) {
      await this.invalidateEntry(key);
    }

    this.emit('cache-entries-evicted', { count: keysToEvict.length, keys: keysToEvict });
  }

  /**
   * Evict the largest entries until the total cache size is reduced by at
   * least the requested amount.
   *
   * @param targetReduction - Number of bytes to reclaim.
   * @returns Resolves once enough entries have been evicted.
   */
  private async evictEntriesBySize(targetReduction: number): Promise<void> {
    const entriesBySize = Array.from(this.memoryCache.entries())
      .sort((a, b) => b[1].size - a[1].size); // Largest first

    let currentReduction = 0;
    const keysToEvict: string[] = [];

    for (const [key, entry] of entriesBySize) {
      if (currentReduction >= targetReduction) break;
      
      keysToEvict.push(key);
      currentReduction += entry.size;
    }

    for (const key of keysToEvict) {
      await this.invalidateEntry(key);
    }

    this.emit('cache-entries-evicted-by-size', { 
      targetReduction, 
      actualReduction: currentReduction, 
      count: keysToEvict.length 
    });
  }

  /**
   * Invalidate a single cache entry by key, removing it from memory and disk.
   *
   * @param key - The cache key to invalidate.
   * @returns `true` if an entry was removed from memory; otherwise `false`.
   */
  async invalidateEntry(key: string): Promise<boolean> {
    const memoryDeleted = this.memoryCache.delete(key);
    
    // Remove from tracking
    const accessOrderIndex = this.accessOrder.indexOf(key);
    if (accessOrderIndex !== -1) {
      this.accessOrder.splice(accessOrderIndex, 1);
    }
    this.accessFrequency.delete(key);

    // Remove from disk
    if (this.config.strategy === CacheStorageStrategy.FILE_SYSTEM || 
        this.config.strategy === CacheStorageStrategy.HYBRID) {
      await this.deleteCacheEntryFromDisk(key);
    }

    if (memoryDeleted) {
      this.emit('cache-entry-invalidated', { key });
    }

    return memoryDeleted;
  }

  /**
   * Invalidate all cache entries whose tags include any of the provided values.
   *
   * @param tags - Tags whose entries should be invalidated.
   * @returns The number of entries invalidated.
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    const keysToInvalidate: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        keysToInvalidate.push(key);
      }
    }

    for (const key of keysToInvalidate) {
      await this.invalidateEntry(key);
    }

    this.emit('cache-invalidated-by-tags', { tags, count: keysToInvalidate.length });
    return keysToInvalidate.length;
  }

  /**
   * Invalidate all cache entries that belong to the specified command.
   *
   * @param commandId - Identifier of the command whose entries are invalidated.
   * @returns The number of entries invalidated.
   */
  async invalidateByCommand(commandId: string): Promise<number> {
    const keysToInvalidate: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.metadata.commandId === commandId) {
        keysToInvalidate.push(key);
      }
    }

    for (const key of keysToInvalidate) {
      await this.invalidateEntry(key);
    }

    this.emit('cache-invalidated-by-command', { commandId, count: keysToInvalidate.length });
    return keysToInvalidate.length;
  }

  /**
   * Remove every cache entry from memory and disk and reset collected metrics.
   *
   * @returns Resolves once the cache is fully cleared.
   */
  async clearAll(): Promise<void> {
    this.memoryCache.clear();
    this.accessOrder.length = 0;
    this.accessFrequency.clear();

    if (this.config.strategy === CacheStorageStrategy.FILE_SYSTEM || 
        this.config.strategy === CacheStorageStrategy.HYBRID) {
      await this.clearDiskCache();
    }

    this.resetMetrics();
    this.emit('cache-cleared');
  }

  /**
   * Periodic cleanup pass that removes expired entries and enforces capacity.
   *
   * @returns Resolves once the cleanup pass completes.
   */
  private async performCleanup(): Promise<void> {
    const startTime = Date.now();
    let cleanedCount = 0;

    // Remove expired entries
    const expiredKeys: string[] = [];
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      await this.invalidateEntry(key);
      cleanedCount++;
    }

    // Ensure capacity
    await this.ensureCapacity();

    this.metrics.lastCleanupAt = Date.now();
    this.emit('cache-cleanup-completed', { 
      duration: Date.now() - startTime, 
      cleanedCount 
    });
  }

  /**
   * Load all non-expired entries from the on-disk cache index into memory.
   *
   * @returns Resolves once loading completes (or fails gracefully).
   */
  private async loadCacheFromDisk(): Promise<void> {
    if (!this.config.diskCachePath) return;

    try {
      const cacheIndexPath = path.join(this.config.diskCachePath, 'index.json');
      if (await fs.pathExists(cacheIndexPath)) {
        const index = await fs.readJson(cacheIndexPath);
        
        for (const key of index.keys) {
          const entry = await this.loadCacheEntryFromDisk(key);
          if (entry && !this.isExpired(entry)) {
            this.memoryCache.set(key, entry);
            this.updateAccessOrder(key);
          }
        }
      }
    } catch (error) {
      this.emit('cache-load-error', error);
    }
  }

  /**
   * Read and decompress/decrypt a single cache entry from disk.
   *
   * @param key - The cache key whose entry should be loaded.
   * @returns The deserialized entry, or `undefined` if not found or invalid.
   */
  private async loadCacheEntryFromDisk(key: string): Promise<CacheEntry | undefined> {
    if (!this.config.diskCachePath) return undefined;

    try {
      const entryPath = path.join(this.config.diskCachePath, `${key}.cache`);
      if (await fs.pathExists(entryPath)) {
        let data = await fs.readFile(entryPath) as Buffer;

        // Decrypt if enabled
        if (this.config.encryptionEnabled && this.encryptionKey) {
          data = this.decrypt(data);
        }

        // Decompress if enabled
        if (this.config.compressionEnabled) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const zlib = require('zlib');
          data = zlib.gunzipSync(data);
        }

        return JSON.parse(data.toString());
      }
    } catch (error) {
      this.emit('cache-entry-load-error', { key, error });
    }

    return undefined;
  }

  /**
   * Serialize, optionally compress/encrypt, and persist a cache entry to disk.
   *
   * @param key - The cache key for the entry.
   * @param entry - The cache entry to persist.
   * @returns Resolves once the entry has been written and the index updated.
   */
  private async saveCacheEntryToDisk(key: string, entry: CacheEntry): Promise<void> {
    if (!this.config.diskCachePath) return;

    try {
      let data: Uint8Array = Buffer.from(JSON.stringify(entry));

      // Compress if enabled
      if (this.config.compressionEnabled) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const zlib = require('zlib');
        data = zlib.gzipSync(data);
      }

      // Encrypt if enabled
      if (this.config.encryptionEnabled && this.encryptionKey) {
        data = this.encrypt(Buffer.from(data));
      }

      const entryPath = path.join(this.config.diskCachePath, `${key}.cache`);
      await fs.writeFile(entryPath, data);

      // Update index
      await this.updateDiskCacheIndex();

    } catch (error) {
      this.emit('cache-entry-save-error', { key, error });
    }
  }

  /**
   * Remove a single cache entry file from disk and refresh the cache index.
   *
   * @param key - The cache key whose on-disk entry should be deleted.
   * @returns Resolves once deletion (if any) is complete.
   */
  private async deleteCacheEntryFromDisk(key: string): Promise<void> {
    if (!this.config.diskCachePath) return;

    try {
      const entryPath = path.join(this.config.diskCachePath, `${key}.cache`);
      if (await fs.pathExists(entryPath)) {
        await fs.remove(entryPath);
        await this.updateDiskCacheIndex();
      }
    } catch (error) {
      this.emit('cache-entry-delete-error', { key, error });
    }
  }

  /**
   * Rewrite the on-disk index file so it lists every current `.cache` file.
   *
   * @returns Resolves once the index file has been rewritten.
   */
  private async updateDiskCacheIndex(): Promise<void> {
    if (!this.config.diskCachePath) return;

    try {
      const cacheFiles = await fs.readdir(this.config.diskCachePath);
      const keys = cacheFiles
        .filter(file => file.endsWith('.cache'))
        .map(file => file.replace('.cache', ''));

      const indexPath = path.join(this.config.diskCachePath, 'index.json');
      await fs.writeJson(indexPath, { keys, updatedAt: Date.now() });

    } catch (error) {
      this.emit('cache-index-update-error', error);
    }
  }

  /**
   * Empty the on-disk cache directory, removing all persisted entries.
   *
   * @returns Resolves once the directory has been emptied.
   */
  private async clearDiskCache(): Promise<void> {
    if (!this.config.diskCachePath) return;

    try {
      if (await fs.pathExists(this.config.diskCachePath)) {
        await fs.emptyDir(this.config.diskCachePath);
      }
    } catch (error) {
      this.emit('cache-clear-error', error);
    }
  }

  /**
   * Encrypt a buffer using AES-256-GCM with the configured encryption key.
   *
   * @param data - The plaintext buffer to encrypt.
   * @returns The encrypted buffer prefixed with the initialization vector.
   */
  private encrypt(data: Buffer): Buffer {
    if (!this.encryptionKey) return data;

    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.encryptionKey);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
  }

  /**
   * Decrypt a buffer previously encrypted by {@link PluginCommandCacheManager.encrypt}.
   *
   * @param data - The encrypted buffer (including the IV prefix).
   * @returns The decrypted plaintext buffer.
   */
  private decrypt(data: Uint8Array): Buffer {
    if (!this.encryptionKey) return Buffer.from(data);

    const algorithm = 'aes-256-gcm';
    const encrypted = data.slice(16);
    const decipher = crypto.createDecipher(algorithm, this.encryptionKey);

    return Buffer.concat([decipher.update(Buffer.from(encrypted)), decipher.final()]);
  }

  /**
   * Estimate the serialized size of a value in bytes.
   *
   * @param obj - The value to measure.
   * @returns Approximate byte length of the JSON-serialized value.
   */
  private calculateSize(obj: any): number {
    return Buffer.byteLength(JSON.stringify(obj), 'utf8');
  }

  /**
   * Sum the sizes of all entries currently held in memory.
   *
   * @returns Total in-memory cache size in bytes.
   */
  private calculateTotalMemoryUsage(): number {
    let total = 0;
    for (const entry of this.memoryCache.values()) {
      total += entry.size;
    }
    return total;
  }

  /**
   * Build the list of tags to associate with a cache entry for bulk
   * invalidation.
   *
   * @param metadata - Metadata for the entry being tagged.
   * @returns Array of tags including command, success state, and performance.
   */
  private generateTags(metadata: CacheEntryMetadata): string[] {
    const tags = [
      `command:${metadata.commandId}`,
      `success:${metadata.success}`
    ];

    // Add performance-based tags
    if (metadata.executionTime > 1000) {
      tags.push('slow');
    } else if (metadata.executionTime < 100) {
      tags.push('fast');
    }

    return tags;
  }

  /**
   * Detect file or resource dependencies referenced by the given arguments
   * and options.
   *
   * @param args - Command arguments to scan.
   * @param options - Command options to scan.
   * @returns Array of dependency identifiers (e.g. `file:/path`).
   */
  private extractDependencies(args: Record<string, unknown>, options: Record<string, unknown>): string[] {
    const dependencies: string[] = [];
    
    // Add file dependencies
    const allValues = [...Object.values(args), ...Object.values(options)];
    for (const value of allValues) {
      if (typeof value === 'string' && value.includes('/')) {
        dependencies.push(`file:${value}`);
      }
    }

    return dependencies;
  }

  /**
   * Derive invalidator tags for an entry based on the command identifier.
   *
   * @param commandId - Identifier of the command.
   * @param args - Command arguments (reserved for future heuristics).
   * @param options - Command options (reserved for future heuristics).
   * @returns Array of invalidator tags such as `file-change`.
   */
  private extractInvalidators(
    commandId: string, 
    args: Record<string, unknown>, 
    options: Record<string, unknown>
  ): string[] {
    const invalidators: string[] = [];
    
    // Commands that might invalidate this cache
    if (commandId.includes('build') || commandId.includes('deploy')) {
      invalidators.push('file-change', 'config-change');
    }
    
    if (commandId.includes('install') || commandId.includes('update')) {
      invalidators.push('dependency-change');
    }

    return invalidators;
  }

  /**
   * Compute a stable MD5 hash of an object for change detection.
   *
   * @param obj - The value to hash.
   * @returns An MD5 hex digest of the normalized value.
   */
  private hashObject(obj: any): string {
    return crypto.createHash('md5').update(JSON.stringify(this.normalizeForHashing(obj))).digest('hex');
  }

  /**
   * Compute an MD5 hash of the stable portions of a plugin command context.
   *
   * @param context - The plugin command context to hash.
   * @returns An MD5 hex digest of the context.
   */
  private hashContext(context: PluginCommandContext): string {
    const contextData = {
      rootPath: context.cli.rootPath,
      configPath: context.cli.configPath,
      version: context.cli.version
    };
    return crypto.createHash('md5').update(JSON.stringify(contextData)).digest('hex');
  }

  /**
   * Recursively normalize an object so that structurally equivalent values
   * produce identical hashes regardless of key insertion order.
   *
   * @param obj - The value to normalize.
   * @returns A new value with sorted keys and arrays suitable for hashing.
   */
  private normalizeForHashing(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.normalizeForHashing(item)).sort();
    }
    
    if (typeof obj === 'object') {
      const normalized: Record<string, unknown> = {};
      const keys = Object.keys(obj).sort();
      for (const key of keys) {
        normalized[key] = this.normalizeForHashing(obj[key]);
      }
      return normalized;
    }
    
    return obj;
  }

  /**
   * Update aggregated performance metrics after a cache operation.
   *
   * @param executionTime - Wall-clock time of the operation in milliseconds.
   * @param hit - Whether the operation was a cache hit.
   * @param success - Whether the operation completed without error.
   */
  private updateMetrics(executionTime?: number, hit?: boolean, success?: boolean): void {
    if (hit !== undefined) {
      if (hit) {
        this.metrics.cacheHits++;
      } else {
        this.metrics.cacheMisses++;
      }
      this.metrics.hitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses);
    }

    if (executionTime !== undefined) {
      const totalTime = (this.metrics.averageExecutionTime * (this.metrics.totalExecutions - 1)) + executionTime;
      this.metrics.averageExecutionTime = totalTime / this.metrics.totalExecutions;

      if (hit) {
        const totalCachedTime = (this.metrics.averageCachedExecutionTime * (this.metrics.cacheHits - 1)) + executionTime;
        this.metrics.averageCachedExecutionTime = totalCachedTime / this.metrics.cacheHits;
      }
    }

    if (success === false) {
      this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.totalExecutions - 1) + 1) / this.metrics.totalExecutions;
    }

    this.metrics.totalMemoryUsage = this.calculateTotalMemoryUsage();
  }

  /**
   * Reset all collected performance metrics back to their initial values.
   */
  private resetMetrics(): void {
    this.metrics = {
      totalExecutions: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      averageExecutionTime: 0,
      averageCachedExecutionTime: 0,
      totalMemoryUsage: 0,
      totalDiskUsage: 0,
      slowestCommands: [],
      mostCachedCommands: [],
      errorRate: 0,
      lastCleanupAt: Date.now()
    };
  }

  /**
   * Return a copy of the current performance metrics snapshot.
   *
   * @returns A shallow copy of the accumulated metrics.
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Return a copy of the current cache configuration.
   *
   * @returns A shallow copy of the active configuration.
   */
  getConfiguration(): CacheConfiguration {
    return { ...this.config };
  }

  /**
   * Apply partial configuration updates, merging them into the active config.
   *
   * @param updates - Partial configuration values to override.
   */
  updateConfiguration(updates: Partial<CacheConfiguration>): void {
    this.config = { ...this.config, ...updates };
    this.emit('configuration-updated', this.config);
  }

  /**
   * Return a summary of the current cache state including size, memory usage,
   * and notable entries.
   *
   * @returns An object describing cache contents and statistics.
   */
  getCacheStats(): any {
    return {
      size: this.memoryCache.size,
      memoryUsage: this.calculateTotalMemoryUsage(),
      hitRate: this.metrics.hitRate,
      totalExecutions: this.metrics.totalExecutions,
      averageExecutionTime: this.metrics.averageExecutionTime,
      oldestEntry: this.findOldestEntry(),
      newestEntry: this.findNewestEntry(),
      mostAccessedEntry: this.findMostAccessedEntry(),
      largestEntry: this.findLargestEntry()
    };
  }

  /**
   * Find the cache entry with the earliest creation timestamp.
   *
   * @returns The oldest entry, or `undefined` when the cache is empty.
   */
  private findOldestEntry(): CacheEntry | undefined {
    let oldest: CacheEntry | undefined;
    for (const entry of this.memoryCache.values()) {
      if (!oldest || entry.createdAt < oldest.createdAt) {
        oldest = entry;
      }
    }
    return oldest;
  }

  /**
   * Find the cache entry with the most recent creation timestamp.
   *
   * @returns The newest entry, or `undefined` when the cache is empty.
   */
  private findNewestEntry(): CacheEntry | undefined {
    let newest: CacheEntry | undefined;
    for (const entry of this.memoryCache.values()) {
      if (!newest || entry.createdAt > newest.createdAt) {
        newest = entry;
      }
    }
    return newest;
  }

  /**
   * Find the cache entry that has been accessed the most times.
   *
   * @returns The most accessed entry, or `undefined` when the cache is empty.
   */
  private findMostAccessedEntry(): CacheEntry | undefined {
    let mostAccessed: CacheEntry | undefined;
    for (const entry of this.memoryCache.values()) {
      if (!mostAccessed || entry.accessCount > mostAccessed.accessCount) {
        mostAccessed = entry;
      }
    }
    return mostAccessed;
  }

  /**
   * Find the cache entry with the largest serialized size.
   *
   * @returns The largest entry, or `undefined` when the cache is empty.
   */
  private findLargestEntry(): CacheEntry | undefined {
    let largest: CacheEntry | undefined;
    for (const entry of this.memoryCache.values()) {
      if (!largest || entry.size > largest.size) {
        largest = entry;
      }
    }
    return largest;
  }

  /**
   * Tear down the cache manager by stopping the cleanup timer, persisting the
   * index when needed, and clearing all in-memory state.
   *
   * @returns Resolves once the manager has been fully shut down.
   */
  async destroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    if (this.config.persistToDisk) {
      await this.updateDiskCacheIndex();
    }

    this.memoryCache.clear();
    this.accessOrder.length = 0;
    this.accessFrequency.clear();

    this.emit('cache-destroyed');
  }
}

// Utility functions
/**
 * Factory that instantiates a new {@link PluginCommandCacheManager} with the
 * supplied configuration overrides.
 *
 * @param config - Optional partial configuration overrides.
 * @returns A freshly constructed cache manager instance.
 */
export function createCommandCacheManager(
  config?: Partial<CacheConfiguration>
): PluginCommandCacheManager {
  return new PluginCommandCacheManager(config);
}

/**
 * Format a byte count as a human-readable string with the appropriate unit.
 *
 * @param bytes - The size in bytes to format.
 * @returns The size expressed in B, KB, MB, or GB with one decimal place.
 */
export function formatCacheSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format a fractional hit rate (0-1) as a percentage string.
 *
 * @param hitRate - The hit rate expressed as a value between 0 and 1.
 * @returns The hit rate formatted as a percentage with one decimal place.
 */
export function formatCacheHitRate(hitRate: number): string {
  return `${(hitRate * 100).toFixed(1)}%`;
}

/**
 * Format an execution time in milliseconds as either a milliseconds or seconds
 * string.
 *
 * @param time - The duration in milliseconds to format.
 * @returns The duration formatted in `ms` for sub-second values or `s` otherwise.
 */
export function formatExecutionTime(time: number): string {
  if (time < 1000) {
    return `${time.toFixed(1)}ms`;
  }
  return `${(time / 1000).toFixed(2)}s`;
}