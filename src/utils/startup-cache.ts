/**
 * Startup cache system for faster CLI initialization
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import * as crypto from 'crypto';

interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl: number;
  hash?: string;
}

interface CacheMetadata {
  version: string;
  nodeVersion: string;
  platform: string;
  entries: Record<string, CacheEntry>;
}

export class StartupCache {
  private static instance: StartupCache;
  private cachePath: string;
  private metadata: CacheMetadata;
  private memoryCache: Map<string, any> = new Map();
  private dirty = false;

  private constructor() {
    const cacheDir = join(homedir(), '.re-shell', 'cache');
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
    
    this.cachePath = join(cacheDir, 'startup.json');
    this.metadata = this.loadMetadata();
    
    // Schedule periodic saves
    if (process.env.NODE_ENV !== 'test') {
      process.on('exit', () => this.save());
    }
  }

  static getInstance(): StartupCache {
    if (!StartupCache.instance) {
      StartupCache.instance = new StartupCache();
    }
    return StartupCache.instance;
  }

  /**
   * Get a cached value
   */
  get<T>(key: string): T | null {
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }
    
    const entry = this.metadata.entries[key];
    if (!entry) {
      return null;
    }
    
    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      delete this.metadata.entries[key];
      this.dirty = true;
      return null;
    }
    
    // Store in memory cache
    this.memoryCache.set(key, entry.value);
    return entry.value;
  }

  /**
   * Set a cached value
   */
  set(key: string, value: any, ttl = 3600000): void { // Default 1 hour
    const entry: CacheEntry = {
      key,
      value,
      timestamp: Date.now(),
      ttl
    };
    
    // Generate hash for large values
    if (typeof value === 'object' && value !== null) {
      const json = JSON.stringify(value);
      if (json.length > 1024) {
        entry.hash = this.hash(json);
      }
    }
    
    this.metadata.entries[key] = entry;
    this.memoryCache.set(key, value);
    this.dirty = true;
  }

  /**
   * Check if cache has valid entry
   */
  has(key: string): boolean {
    const entry = this.metadata.entries[key];
    if (!entry) return false;
    
    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      delete this.metadata.entries[key];
      this.dirty = true;
      return false;
    }
    
    return true;
  }

  /**
   * Delete a cached value
   */
  delete(key: string): void {
    delete this.metadata.entries[key];
    this.memoryCache.delete(key);
    this.dirty = true;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.metadata.entries = {};
    this.memoryCache.clear();
    this.dirty = true;
    this.save();
  }

  /**
   * Get or compute a cached value
   */
  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    const value = await compute();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Cache command metadata for faster lookup
   */
  cacheCommandMetadata(commands: Record<string, any>): void {
    this.set('command-metadata', commands, 7 * 24 * 3600000); // 7 days
  }

  /**
   * Get cached command metadata
   */
  getCachedCommandMetadata(): Record<string, any> | null {
    return this.get('command-metadata');
  }

  /**
   * Cache framework detection results
   */
  cacheFrameworkDetection(path: string, framework: string): void {
    const key = `framework:${this.hash(path)}`;
    this.set(key, framework, 24 * 3600000); // 24 hours
  }

  /**
   * Get cached framework detection
   */
  getCachedFrameworkDetection(path: string): string | null {
    const key = `framework:${this.hash(path)}`;
    return this.get(key);
  }

  /**
   * Cache plugin metadata
   */
  cachePluginMetadata(pluginId: string, metadata: any): void {
    const key = `plugin:${pluginId}`;
    this.set(key, metadata, 12 * 3600000); // 12 hours
  }

  /**
   * Get cached plugin metadata
   */
  getCachedPluginMetadata(pluginId: string): any | null {
    const key = `plugin:${pluginId}`;
    return this.get(key);
  }

  /**
   * Load cache metadata from disk
   */
  private loadMetadata(): CacheMetadata {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const currentVersion = require('../../package.json').version;
    
    if (!existsSync(this.cachePath)) {
      return {
        version: currentVersion,
        nodeVersion: process.version,
        platform: process.platform,
        entries: {}
      };
    }
    
    try {
      const data = JSON.parse(readFileSync(this.cachePath, 'utf-8'));
      
      // Invalidate cache if version or environment changed
      if (
        data.version !== currentVersion ||
        data.nodeVersion !== process.version ||
        data.platform !== process.platform
      ) {
        return {
          version: currentVersion,
          nodeVersion: process.version,
          platform: process.platform,
          entries: {}
        };
      }
      
      return data;
    } catch {
      return {
        version: currentVersion,
        nodeVersion: process.version,
        platform: process.platform,
        entries: {}
      };
    }
  }

  /**
   * Save cache metadata to disk
   */
  private save(): void {
    if (!this.dirty) return;
    
    try {
      // Clean expired entries before saving
      const now = Date.now();
      Object.entries(this.metadata.entries).forEach(([key, entry]) => {
        if (now - entry.timestamp > entry.ttl) {
          delete this.metadata.entries[key];
        }
      });
      
      writeFileSync(this.cachePath, JSON.stringify(this.metadata, null, 2));
      this.dirty = false;
    } catch (error) {
      // Ignore save errors
      if (process.env.DEBUG === 'true') {
        console.error('Failed to save startup cache:', error);
      }
    }
  }

  /**
   * Generate hash for cache keys
   */
  private hash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
  }
}

// Export singleton instance
export const startupCache = StartupCache.getInstance();