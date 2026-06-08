import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import { ValidationError } from './error-handler';
import { 
  PluginCommandDefinition, 
  RegisteredCommand,
  PluginCommandContext
} from './plugin-command-registry';

// Cache storage strategies
export enum CacheStorageStrategy {
  MEMORY = 'memory',
  FILE_SYSTEM = 'file-system',
  HYBRID = 'hybrid',
  DATABASE = 'database'
}

// Cache invalidation strategies
export enum CacheInvalidationStrategy {
  TTL = 'ttl',
  LRU = 'lru',
  LFU = 'lfu',
  FIFO = 'fifo',
  MANUAL = 'manual',
  EVENT_BASED = 'event-based'
}

// Performance monitoring levels
export enum PerformanceMonitoringLevel {
  NONE = 'none',
  BASIC = 'basic',
  DETAILED = 'detailed',
  VERBOSE = 'verbose'
}

// Cache entry
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  metadata: CacheEntryMetadata;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  expiresAt?: number;
  size: number;
  tags: string[];
}

// Cache entry metadata
export interface CacheEntryMetadata {
  commandId: string;
  argumentsHash: string;
  optionsHash: string;
  contextHash: string;
  executionTime: number;
  success: boolean;
  errorInfo?: {
    type: string;
    message: string;
    stack?: string;
  };
  dependencies: string[];
  invalidators: string[];
}

// Cache configuration
export interface CacheConfiguration {
  enabled: boolean;
  strategy: CacheStorageStrategy;
  invalidationStrategy: CacheInvalidationStrategy;
  maxSize: number;
  maxMemoryUsage: number; // in bytes
  defaultTTL: number; // in milliseconds
  cleanupInterval: number; // in milliseconds
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  persistToDisk: boolean;
  diskCachePath?: string;
  performanceMonitoring: PerformanceMonitoringLevel;
}

// Performance metrics
export interface PerformanceMetrics {
  totalExecutions: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  averageExecutionTime: number;
  averageCachedExecutionTime: number;
  totalMemoryUsage: number;
  totalDiskUsage: number;
  slowestCommands: Array<{
    commandId: string;
    averageTime: number;
    executionCount: number;
  }>;
  mostCachedCommands: Array<{
    commandId: string;
    cacheHits: number;
    hitRate: number;
  }>;
  errorRate: number;
  lastCleanupAt: number;
}

// Cache operation result
export interface CacheOperationResult<T = any> {
  hit: boolean;
  value?: T;
  metadata?: CacheEntryMetadata;
  executionTime: number;
  source: 'cache' | 'execution';
  error?: Error;
}

// Plugin command cache manager
export class PluginCommandCacheManager extends EventEmitter {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = []; // For LRU tracking
  private accessFrequency: Map<string, number> = new Map(); // For LFU tracking
  private config: CacheConfiguration;
  private metrics: PerformanceMetrics;
  private cleanupTimer?: NodeJS.Timeout;
  private encryptionKey?: Buffer;

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

  // Initialize cache system
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

  // Execute command with caching
  async executeWithCache<T = any>(
    commandId: string,
    args: Record<string, any>,
    options: Record<string, any>,
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

  // Generate cache key
  private generateCacheKey(
    commandId: string,
    args: Record<string, any>,
    options: Record<string, any>,
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

  // Get cache entry
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

  // Set cache entry
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

  // Check if cache entry is expired
  private isExpired(entry: CacheEntry): boolean {
    if (!entry.expiresAt) return false;
    return Date.now() > entry.expiresAt;
  }

  // Update access tracking for LRU/LFU
  private updateAccessTracking(key: string): void {
    const entry = this.memoryCache.get(key);
    if (entry) {
      entry.lastAccessedAt = Date.now();
      entry.accessCount++;
      
      this.updateAccessOrder(key);
      this.accessFrequency.set(key, (this.accessFrequency.get(key) || 0) + 1);
    }
  }

  // Update access order for LRU
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  // Ensure cache capacity
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

  // Evict cache entries
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

  // Evict entries by size
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

  // Invalidate specific cache entry
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

  // Invalidate by tags
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

  // Invalidate by command
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

  // Clear all cache
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

  // Perform cleanup
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

  // Load cache from disk
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

  // Load cache entry from disk
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

  // Save cache entry to disk
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

  // Delete cache entry from disk
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

  // Update disk cache index
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

  // Clear disk cache
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

  // Encrypt data
  private encrypt(data: Buffer): Buffer {
    if (!this.encryptionKey) return data;

    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.encryptionKey);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
  }

  // Decrypt data
  private decrypt(data: Uint8Array): Buffer {
    if (!this.encryptionKey) return Buffer.from(data);

    const algorithm = 'aes-256-gcm';
    const iv = data.slice(0, 16);
    const encrypted = data.slice(16);
    const decipher = crypto.createDecipher(algorithm, this.encryptionKey);

    return Buffer.concat([decipher.update(Buffer.from(encrypted)), decipher.final()]);
  }

  // Calculate object size
  private calculateSize(obj: any): number {
    return Buffer.byteLength(JSON.stringify(obj), 'utf8');
  }

  // Calculate total memory usage
  private calculateTotalMemoryUsage(): number {
    let total = 0;
    for (const entry of this.memoryCache.values()) {
      total += entry.size;
    }
    return total;
  }

  // Generate cache tags
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

  // Extract dependencies from arguments/options
  private extractDependencies(args: Record<string, any>, options: Record<string, any>): string[] {
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

  // Extract invalidators
  private extractInvalidators(
    commandId: string, 
    args: Record<string, any>, 
    options: Record<string, any>
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

  // Hash object for comparison
  private hashObject(obj: any): string {
    return crypto.createHash('md5').update(JSON.stringify(this.normalizeForHashing(obj))).digest('hex');
  }

  // Hash context
  private hashContext(context: PluginCommandContext): string {
    const contextData = {
      rootPath: context.cli.rootPath,
      configPath: context.cli.configPath,
      version: context.cli.version
    };
    return crypto.createHash('md5').update(JSON.stringify(contextData)).digest('hex');
  }

  // Normalize object for hashing
  private normalizeForHashing(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.normalizeForHashing(item)).sort();
    }
    
    if (typeof obj === 'object') {
      const normalized: any = {};
      const keys = Object.keys(obj).sort();
      for (const key of keys) {
        normalized[key] = this.normalizeForHashing(obj[key]);
      }
      return normalized;
    }
    
    return obj;
  }

  // Update metrics
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

  // Reset metrics
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

  // Get performance metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Get cache configuration
  getConfiguration(): CacheConfiguration {
    return { ...this.config };
  }

  // Update configuration
  updateConfiguration(updates: Partial<CacheConfiguration>): void {
    this.config = { ...this.config, ...updates };
    this.emit('configuration-updated', this.config);
  }

  // Get cache statistics
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

  // Find oldest entry
  private findOldestEntry(): CacheEntry | undefined {
    let oldest: CacheEntry | undefined;
    for (const entry of this.memoryCache.values()) {
      if (!oldest || entry.createdAt < oldest.createdAt) {
        oldest = entry;
      }
    }
    return oldest;
  }

  // Find newest entry
  private findNewestEntry(): CacheEntry | undefined {
    let newest: CacheEntry | undefined;
    for (const entry of this.memoryCache.values()) {
      if (!newest || entry.createdAt > newest.createdAt) {
        newest = entry;
      }
    }
    return newest;
  }

  // Find most accessed entry
  private findMostAccessedEntry(): CacheEntry | undefined {
    let mostAccessed: CacheEntry | undefined;
    for (const entry of this.memoryCache.values()) {
      if (!mostAccessed || entry.accessCount > mostAccessed.accessCount) {
        mostAccessed = entry;
      }
    }
    return mostAccessed;
  }

  // Find largest entry
  private findLargestEntry(): CacheEntry | undefined {
    let largest: CacheEntry | undefined;
    for (const entry of this.memoryCache.values()) {
      if (!largest || entry.size > largest.size) {
        largest = entry;
      }
    }
    return largest;
  }

  // Destroy cache manager
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
export function createCommandCacheManager(
  config?: Partial<CacheConfiguration>
): PluginCommandCacheManager {
  return new PluginCommandCacheManager(config);
}

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

export function formatCacheHitRate(hitRate: number): string {
  return `${(hitRate * 100).toFixed(1)}%`;
}

export function formatExecutionTime(time: number): string {
  if (time < 1000) {
    return `${time.toFixed(1)}ms`;
  }
  return `${(time / 1000).toFixed(2)}s`;
}