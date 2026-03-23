// Multi-Level Caching System
// Content hashing, invalidation, and multi-tier caching

import { createHash } from 'crypto';

export interface CacheLevel {
  name: string;
  type: 'memory' | 'redis' | 'cdn';
  maxSize?: number;
  ttl: number;
}

export interface CacheEntry {
  key: string;
  value: any;
  hash: string;
  ttl: number;
  created: number;
  accessed: number;
  hits: number;
  tags: string[];
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  compress?: boolean;
}

export class MultiLevelCache {
  private levels: Map<string, Map<string, CacheEntry>> = new Map();
  private config: CacheLevel[];

  constructor(config: CacheLevel[]) {
    this.config = config;
    this.initialize();
  }

  private initialize(): void {
    for (const level of this.config) {
      this.levels.set(level.name, new Map());
    }
  }

  /**
   * Generate cache key from content hash
   */
  generateKey(content: any, tags: string[] = []): string {
    const contentStr = JSON.stringify(content);
    const hash = createHash('sha256').update(contentStr).digest('hex');
    return `cache:${hash}`;
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, options: CacheOptions = {}, level = 'L1'): Promise<void> {
    const hash = this.generateHash(value);
    const entry: CacheEntry = {
      key,
      value,
      hash,
      ttl: options.ttl || this.config[0].ttl,
      created: Date.now(),
      accessed: Date.now(),
      hits: 0,
      tags: options.tags || [],
    };

    // Store in specified level
    const levelMap = this.levels.get(level);
    if (levelMap) {
      levelMap.set(key, entry);
    }
  }

  /**
   * Get value from cache (check all levels)
   */
  async get(key: string): Promise<any | null> {
    // Check L1 (memory) first
    for (const levelName of ['L1', 'L2', 'L3']) {
      const levelMap = this.levels.get(levelName);
      if (!levelMap) continue;

      const entry = levelMap.get(key);
      if (entry) {
        // Check TTL
        if (Date.now() - entry.created > entry.ttl * 1000) {
          levelMap.delete(key);
          continue;
        }

        entry.accessed = Date.now();
        entry.hits++;
        return entry.value;
      }
    }

    return null;
  }

  /**
   * Invalidate cache by key
   */
  async invalidate(key: string): Promise<void> {
    for (const levelMap of this.levels.values()) {
      levelMap.delete(key);
    }
  }

  /**
   * Invalidate by tags
   */
  async invalidateByTag(tag: string): Promise<void> {
    for (const levelMap of this.levels.values()) {
      for (const [key, entry] of levelMap.entries()) {
        if (entry.tags.includes(tag)) {
          levelMap.delete(key);
        }
      }
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    for (const levelMap of this.levels.values()) {
      levelMap.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): any {
    let totalEntries = 0;
    let totalHits = 0;

    for (const [name, levelMap] of this.levels) {
      const entries = levelMap.size;
      const hits = Array.from(levelMap.values()).reduce((sum, e) => sum + e.hits, 0);
      totalEntries += entries;
      totalHits += hits;
    }

    return { totalEntries, totalHits, levels: this.levels.size };
  }

  private generateHash(content: any): string {
    const str = typeof content === 'string' ? content : JSON.stringify(content);
    return createHash('sha256').update(str).digest('hex');
  }
}

export const multiLevelCache = new MultiLevelCache([
  { name: 'L1', type: 'memory', maxSize: 1000, ttl: 300 },
  { name: 'L2', type: 'redis', ttl: 3600 },
  { name: 'L3', type: 'cdn', ttl: 86400 },
]);
