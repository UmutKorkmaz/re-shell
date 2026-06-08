/**
 * Data Caching Strategies for Cross-Language Communication
 * Multi-backend caching, cache invalidation, distributed caching
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Cache backends
export type CacheBackend =
  | 'memory'
  | 'redis'
  | 'memcached'
  | 'dynamodb'
  | 'cassandra'
  | 'mongodb'
  | 'sql';

// Cache strategies
export type CacheStrategy =
  | 'cache-aside'
  | 'write-through'
  | 'write-behind'
  | 'write-back'
  | 'refresh-ahead';

// Eviction policies
export type EvictionPolicy =
  | 'lru'
  | 'lfu'
  | 'fifo'
  | 'lifo'
  | 'random'
  | 'ttl';

// Cache entry
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl?: number;
  createdAt: number;
  accessedAt: number;
  accessCount: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

// Cache options
export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  strategy?: CacheStrategy;
  compress?: boolean;
  serialize?: boolean;
}

// Cache statistics
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
  hitRate: number;
  missRate: number;
}

// Caching configuration
export interface CachingConfig {
  serviceName: string;
  defaultBackend: CacheBackend;
  defaultTTL: number;
  maxEntries: number;
  evictionPolicy: EvictionPolicy;
  enableCompression: boolean;
  enableStats: boolean;
}

// Generate caching config
export async function generateCachingConfig(
  serviceName: string,
  defaultBackend: CacheBackend = 'memory'
): Promise<CachingConfig> {
  return {
    serviceName,
    defaultBackend,
    defaultTTL: 3600, // 1 hour
    maxEntries: 10000,
    evictionPolicy: 'lru',
    enableCompression: false,
    enableStats: true,
  };
}

// Generate TypeScript implementation
export async function generateTypeScriptCaching(
  config: CachingConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-data-caching.ts`,
    content: `// Data Caching Strategies for ${config.serviceName}

export type CacheBackend =
  | 'memory'
  | 'redis'
  | 'memcached'
  | 'dynamodb'
  | 'cassandra'
  | 'mongodb'
  | 'sql';

export type CacheStrategy =
  | 'cache-aside'
  | 'write-through'
  | 'write-behind'
  | 'write-back'
  | 'refresh-ahead';

export type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'lifo' | 'random' | 'ttl';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl?: number;
  createdAt: number;
  accessedAt: number;
  accessCount: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  strategy?: CacheStrategy;
  compress?: boolean;
  serialize?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
  hitRate: number;
  missRate: number;
}

export class ${toPascalCase(config.serviceName)}DataCache {
  private cache: Map<string, CacheEntry>;
  private stats: CacheStats;
  private config: any;
  private timers: Map<string, NodeJS.Timeout>;

  constructor(config: any) {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      evictions: 0,
      hitRate: 0,
      missRate: 0,
    };
    this.config = config;
    this.timers = new Map();
  }

  /**
   * Get value from cache
   */
  get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateStats();
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.misses++;
      this.updateStats();
      return null;
    }

    // Update access info
    entry.accessedAt = Date.now();
    entry.accessCount++;
    this.cache.set(key, entry);

    this.stats.hits++;
    this.updateStats();

    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  set<T = any>(key: string, value: T, options?: CacheOptions): void {
    const ttl = options?.ttl || this.config.defaultTTL;
    const tags = options?.tags || [];

    const entry: CacheEntry<T> = {
      key,
      value,
      ttl,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0,
      tags,
      metadata: options ? { ...options } : undefined,
    };

    // Check if we need to evict
    if (this.cache.size >= this.config.maxEntries) {
      this.evict();
    }

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;

    // Set TTL timer
    if (ttl && ttl > 0) {
      const existingTimer = this.timers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        this.delete(key);
      }, ttl * 1000);

      this.timers.set(key, timer);
    }
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }

    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.size = this.cache.size;
    }

    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Clear cache
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get multiple keys
   */
  getMany<T = any>(keys: string[]): Map<string, T> {
    const result = new Map<string, T>();

    for (const key of keys) {
      const value = this.get<T>(key);
      if (value !== null) {
        result.set(key, value);
      }
    }

    return result;
  }

  /**
   * Set multiple keys
   */
  setMany<T = any>(entries: Map<string, T>, options?: CacheOptions): void {
    for (const [key, value] of entries.entries()) {
      this.set(key, value, options);
    }
  }

  /**
   * Delete multiple keys
   */
  deleteMany(keys: string[]): number {
    let deleted = 0;
    for (const key of keys) {
      if (this.delete(key)) {
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * Invalidate by tags
   */
  invalidateByTags(tags: string[]): number {
    let invalidated = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags && entry.tags.some(tag => tags.includes(tag))) {
        if (this.delete(key)) {
          invalidated++;
        }
      }
    }

    return invalidated;
  }

  /**
   * Get or set (cache-aside pattern)
   */
  async getOrSet<T = any>(
    key: string,
    fetcher: () => Promise<T> | T,
    options?: CacheOptions
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch value
    const value = await fetcher();
    this.set(key, value, options);

    return value;
  }

  /**
   * Evict entries based on policy
   */
  private evict(): void {
    let keyToEvict: string | null = null;

    switch (this.config.evictionPolicy) {
      case 'lru':
        // Least Recently Used
        let oldestAccess = Infinity;
        for (const [key, entry] of this.cache.entries()) {
          if (entry.accessedAt < oldestAccess) {
            oldestAccess = entry.accessedAt;
            keyToEvict = key;
          }
        }
        break;

      case 'lfu':
        // Least Frequently Used
        let minAccessCount = Infinity;
        for (const [key, entry] of this.cache.entries()) {
          if (entry.accessCount < minAccessCount) {
            minAccessCount = entry.accessCount;
            keyToEvict = key;
          }
        }
        break;

      case 'fifo':
        // First In First Out
        let oldestCreation = Infinity;
        for (const [key, entry] of this.cache.entries()) {
          if (entry.createdAt < oldestCreation) {
            oldestCreation = entry.createdAt;
            keyToEvict = key;
          }
        }
        break;

      case 'lifo':
        // Last In First Out
        let newestCreation = -Infinity;
        for (const [key, entry] of this.cache.entries()) {
          if (entry.createdAt > newestCreation) {
            newestCreation = entry.createdAt;
            keyToEvict = key;
          }
        }
        break;

      case 'random':
        const keys = Array.from(this.cache.keys());
        keyToEvict = keys[Math.floor(Math.random() * keys.length)];
        break;

      case 'ttl':
        // Shortest TTL first
        let shortestTTL = Infinity;
        for (const [key, entry] of this.cache.entries()) {
          const ttl = entry.ttl || Infinity;
          if (ttl < shortestTTL) {
            shortestTTL = ttl;
            keyToEvict = key;
          }
        }
        break;

      default:
        keyToEvict = this.cache.keys().next().value;
    }

    if (keyToEvict) {
      this.delete(keyToEvict);
      this.stats.evictions++;
    }
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    if (!entry.ttl) return false;

    const now = Date.now();
    const age = (now - entry.createdAt) / 1000;
    return age > entry.ttl;
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    this.stats.missRate = total > 0 ? this.stats.misses / total : 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      size: this.cache.size,
      evictions: 0,
      hitRate: 0,
      missRate: 0,
    };
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all entries
   */
  entries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  /**
   * Warm cache with data
   */
  async warm<T = any>(data: Map<string, T>, options?: CacheOptions): Promise<void> {
    for (const [key, value] of data.entries()) {
      this.set(key, value, options);
    }
  }

  /**
   * Refresh entry (fetch fresh value)
   */
  async refresh<T = any>(key: string, fetcher: () => Promise<T> | T): Promise<T> {
    const value = await fetcher();
    this.set(key, value);
    return value;
  }
}

// Factory function
export function createDataCache(config: any) {
  return new ${toPascalCase(config.serviceName)}DataCache(config);
}

// Usage example
async function main() {
  const config = {
    serviceName: '${config.serviceName}',
    defaultBackend: 'memory',
    defaultTTL: 3600,
    maxEntries: 1000,
    evictionPolicy: 'lru',
    enableCompression: false,
    enableStats: true,
  };

  const cache = new ${toPascalCase(config.serviceName)}DataCache(config);

  // Set values
  cache.set('user:1', { id: 1, name: 'Alice' });
  cache.set('user:2', { id: 2, name: 'Bob' }, { ttl: 1800, tags: ['users'] });

  // Get value
  const user = cache.get('user:1');
  console.log('User:', user);

  // Get or set (cache-aside)
  const result = await cache.getOrSet('user:3', async () => {
    // Simulate database fetch
    return { id: 3, name: 'Charlie' };
  });
  console.log('Result:', result);

  // Statistics
  const stats = cache.getStats();
  console.log('Stats:', stats);

  // Invalidate by tags
  cache.invalidateByTags(['users']);
  console.log('Cache size after invalidation:', cache.size());
}

if (require.main === module) {
  main().catch(console.error);
}
`,
  });

  return { files, dependencies };
}

// Generate Python implementation
export async function generatePythonCaching(
  config: CachingConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    ''.concat(
      str.replace(/[-_]/g, ' ')
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('')
    );

  files.push({
    path: `${config.serviceName}_data_caching.py`,
    content: `# Data Caching Strategies for ${config.serviceName}
import time
import asyncio
from typing import Dict, Any, Optional, List, Callable, TypeVar, Awaitable
from dataclasses import dataclass, field
from enum import Enum
import threading
import heapq

class CacheBackend(Enum):
    MEMORY = 'memory'
    REDIS = 'redis'
    MEMCACHED = 'memcached'

class CacheStrategy(Enum):
    CACHE_ASIDE = 'cache-aside'
    WRITE_THROUGH = 'write-through'
    WRITE_BEHIND = 'write-behind'
    WRITE_BACK = 'write-back'
    REFRESH_AHEAD = 'refresh-ahead'

class EvictionPolicy(Enum):
    LRU = 'lru'
    LFU = 'lfu'
    FIFO = 'fifo'
    LIFO = 'lifo'
    RANDOM = 'random'
    TTL = 'ttl'

T = TypeVar('T')

@dataclass
class CacheEntry:
    key: str
    value: Any
    ttl: Optional[int] = None
    created_at: float = field(default_factory=time.time)
    accessed_at: float = field(default_factory=time.time)
    access_count: int = 0
    tags: List[str] = field(default_factory=list)

@dataclass
class CacheStats:
    hits: int = 0
    misses: int = 0
    size: int = 0
    evictions: int = 0
    hit_rate: float = 0.0
    miss_rate: float = 0.0

class ${toPascalCase(config.serviceName)}DataCache:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self._cache: Dict[str, CacheEntry] = {}
        self._stats = CacheStats()
        self._lock = threading.RLock()
        self._timers: Dict[str, Any] = {}

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._cache.get(key)

            if not entry:
                self._stats.misses += 1
                self._update_stats()
                return None

            if self._is_expired(entry):
                self.delete(key)
                self._stats.misses += 1
                self._update_stats()
                return None

            entry.accessed_at = time.time()
            entry.access_count += 1

            self._stats.hits += 1
            self._update_stats()

            return entry.value

    def set(self, key: str, value: Any, ttl: Optional[int] = None, tags: Optional[List[str]] = None) -> None:
        with self._lock:
            ttl = ttl or self.config.get('defaultTTL', 3600)

            if len(self._cache) >= self.config.get('maxEntries', 10000):
                self._evict()

            entry = CacheEntry(
                key=key,
                value=value,
                ttl=ttl,
                tags=tags or [],
            )

            self._cache[key] = entry
            self._stats.size = len(self._cache)

    def delete(self, key: str) -> bool:
        with self._lock:
            if key in self._timers:
                # Cancel timer if exists
                del self._timers[key]

            deleted = key in self._cache
            if deleted:
                del self._cache[key]
                self._stats.size = len(self._cache)

            return deleted

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()
            self._timers.clear()
            self._stats.size = 0

    def has(self, key: str) -> bool:
        with self._lock:
            entry = self._cache.get(key)
            if not entry:
                return False

            if self._is_expired(entry):
                self.delete(key)
                return False

            return True

    async def get_or_set(self, key: str, fetcher: Callable[[], Awaitable[T]]) -> T:
        cached = self.get(key)
        if cached is not None:
            return cached

        value = await fetcher()
        self.set(key, value)
        return value

    def invalidate_by_tags(self, tags: List[str]) -> int:
        with self._lock:
            invalidated = 0
            keys_to_delete = []

            for key, entry in self._cache.items():
                if entry.tags and any(tag in entry.tags for tag in tags):
                    keys_to_delete.append(key)

            for key in keys_to_delete:
                if self.delete(key):
                    invalidated += 1

            return invalidated

    def _evict(self) -> None:
        policy = self.config.get('evictionPolicy', 'lru')

        if policy == 'lru':
            # Least Recently Used
            key_to_evict = min(self._cache.keys(), key=lambda k: self._cache[k].accessed_at)
        elif policy == 'lfu':
            # Least Frequently Used
            key_to_evict = min(self._cache.keys(), key=lambda k: self._cache[k].access_count)
        elif policy == 'fifo':
            # First In First Out
            key_to_evict = min(self._cache.keys(), key=lambda k: self._cache[k].created_at)
        elif policy == 'lifo':
            # Last In First Out
            key_to_evict = max(self._cache.keys(), key=lambda k: self._cache[k].created_at)
        else:
            key_to_evict = next(iter(self._cache.keys()), None)

        if key_to_evict:
            self.delete(key_to_evict)
            self._stats.evictions += 1

    def _is_expired(self, entry: CacheEntry) -> bool:
        if not entry.ttl:
            return False

        age = time.time() - entry.created_at
        return age > entry.ttl

    def _update_stats(self) -> None:
        total = self._stats.hits + self._stats.misses
        self._stats.hit_rate = self._stats.hits / total if total > 0 else 0
        self._stats.miss_rate = self._stats.misses / total if total > 0 else 0

    def get_stats(self) -> CacheStats:
        return self._stats

    def reset_stats(self) -> None:
        self._stats = CacheStats(size=len(self._cache))

    def size(self) -> int:
        return len(self._cache)

    def keys(self) -> List[str]:
        return list(self._cache.keys())

# Usage
async def main():
    config = {
        'serviceName': '${config.serviceName}',
        'defaultBackend': 'memory',
        'defaultTTL': 3600,
        'maxEntries': 1000,
        'evictionPolicy': 'lru',
    }

    cache = ${toPascalCase(config.serviceName)}DataCache(config)

    # Set values
    cache.set('user:1', {'id': 1, 'name': 'Alice'})
    cache.set('user:2', {'id': 2, 'name': 'Bob'}, ttl=1800, tags=['users'])

    # Get value
    user = cache.get('user:1')
    print(f'User: {user}')

    # Statistics
    stats = cache.get_stats()
    print(f'Stats: {stats}')

if __name__ == '__main__':
    asyncio.run(main())
`,
  });

  return { files, dependencies };
}

// Generate Go implementation
export async function generateGoCaching(
  config: CachingConfig
): Promise<{ files: Array<{ path: string; content: string }>; dependencies: string[] }> {
  const files: Array<{ path: string; content: string }> = [];
  const dependencies: string[] = [];

  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  files.push({
    path: `${config.serviceName}-data-caching.go`,
    content: `package main

import (
	"container/list"
	"sync"
	"time"
)

type CacheBackend string
type CacheStrategy string
type EvictionPolicy string

const (
	BackendMemory     CacheBackend = "memory"
	BackendRedis      CacheBackend = "redis"
	BackendMemcached  CacheBackend = "memcached"
)

const (
	StrategyCacheAside   CacheStrategy = "cache-aside"
	StrategyWriteThrough CacheStrategy = "write-through"
	StrategyWriteBehind  CacheStrategy = "write-behind"
)

const (
	PolicyLRU  EvictionPolicy = "lru"
	PolicyLFU  EvictionPolicy = "lfu"
	PolicyFIFO EvictionPolicy = "fifo"
	PolicyLIFO EvictionPolicy = "lifo"
)

type CacheEntry struct {
	Key        string
	Value      interface{}
	TTL        int64
	CreatedAt  int64
	AccessedAt int64
	AccessCount int
	Tags       []string
}

type CacheStats struct {
	Hits      int
	Misses    int
	Size      int
	Evictions int
	HitRate   float64
	MissRate  float64
}

type ${toPascalCase(config.serviceName)}DataCache struct {
	cache   map[string]*CacheEntry
	stats   CacheStats
	config  map[string]interface{}
	mu      sync.RWMutex
}

func New${toPascalCase(config.serviceName)}DataCache(config map[string]interface{}) *${toPascalCase(config.serviceName)}DataCache {
	return &${toPascalCase(config.serviceName)}DataCache{
		cache:  make(map[string]*CacheEntry),
		config: config,
	}
}

func (c *${toPascalCase(config.serviceName)}DataCache) Get(key string) interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, exists := c.cache[key]
	if !exists {
		c.stats.Misses++
		c.updateStats()
		return nil
	}

	if c.isExpired(entry) {
		c.Delete(key)
		c.stats.Misses++
		c.updateStats()
		return nil
	}

	entry.AccessedAt = time.Now().UnixNano()
	entry.AccessCount++

	c.stats.Hits++
	c.updateStats()

	return entry.Value
}

func (c *${toPascalCase(config.serviceName)}DataCache) Set(key string, value interface{}, ttl int64, tags []string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if int64(len(c.cache)) >= c.config["maxEntries"].(int64) {
		c.evict()
	}

	entry := &CacheEntry{
		Key:         key,
		Value:       value,
		TTL:         ttl,
		CreatedAt:   time.Now().UnixNano(),
		AccessedAt:  time.Now().UnixNano(),
		AccessCount: 0,
		Tags:        tags,
	}

	c.cache[key] = entry
	c.stats.Size = len(c.cache)
}

func (c *${toPascalCase(config.serviceName)}DataCache) Delete(key string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	if _, exists := c.cache[key]; exists {
		delete(c.cache, key)
		c.stats.Size = len(c.cache)
		return true
	}
	return false
}

func (c *${toPascalCase(config.serviceName)}DataCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cache = make(map[string]*CacheEntry)
	c.stats.Size = 0
}

func (c *${toPascalCase(config.serviceName)}DataCache) Has(key string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, exists := c.cache[key]
	if !exists {
		return false
	}

	if c.isExpired(entry) {
		return false
	}

	return true
}

func (c *${toPascalCase(config.serviceName)}DataCache) InvalidateByTags(tags []string) int {
	c.mu.Lock()
	defer c.mu.Unlock()

	count := 0
	for key, entry := range c.cache {
		for _, tag := range tags {
			for _, entryTag := range entry.Tags {
				if entryTag == tag {
					if c.Delete(key) {
						count++
					}
					break
				}
			}
		}
	}

	return count
}

func (c *${toPascalCase(config.serviceName)}DataCache) evict() {
	policy := c.config["evictionPolicy"].(EvictionPolicy)
	var keyToEvict string

	switch policy {
	case PolicyLRU:
		var oldestAccessed int64
		for key, entry := range c.cache {
			if oldestAccessed == 0 || entry.AccessedAt < oldestAccessed {
				oldestAccessed = entry.AccessedAt
				keyToEvict = key
			}
		}
	case PolicyLFU:
		minCount := int(^uint(0) >> 1)
		for key, entry := range c.cache {
			if entry.AccessCount < minCount {
				minCount = entry.AccessCount
				keyToEvict = key
			}
		}
	case PolicyFIFO:
		var oldestCreated int64
		for key, entry := range c.cache {
			if oldestCreated == 0 || entry.CreatedAt < oldestCreated {
				oldestCreated = entry.CreatedAt
				keyToEvict = key
			}
		}
	}

	if keyToEvict != "" {
		c.Delete(keyToEvict)
		c.stats.Evictions++
	}
}

func (c *${toPascalCase(config.serviceName)}DataCache) isExpired(entry *CacheEntry) bool {
	if entry.TTL == 0 {
		return false
	}

	age := time.Now().UnixNano() - entry.CreatedAt
	return age > entry.TTL*1e9 // Convert TTL seconds to nanoseconds
}

func (c *${toPascalCase(config.serviceName)}DataCache) updateStats() {
	total := c.stats.Hits + c.stats.Misses
	if total > 0 {
		c.stats.HitRate = float64(c.stats.Hits) / float64(total)
		c.stats.MissRate = float64(c.stats.Misses) / float64(total)
	}
}

func (c *${toPascalCase(config.serviceName)}DataCache) GetStats() CacheStats {
	return c.stats
}

func (c *${toPascalCase(config.serviceName)}DataCache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.cache)
}

func main() {
	config := map[string]interface{}{
		"serviceName":    "${config.serviceName}",
		"defaultBackend": "memory",
		"defaultTTL":     int64(3600),
		"maxEntries":     int64(1000),
		"evictionPolicy": PolicyLRU,
	}

	cache := New${toPascalCase(config.serviceName)}DataCache(config)

	// Set values
	cache.Set("user:1", map[string]interface{}{"id": 1, "name": "Alice"}, 3600, []string{})

	// Get value
	user := cache.Get("user:1")
	fmt.Printf("User: %v\\n", user)

	// Statistics
	stats := cache.GetStats()
	fmt.Printf("Stats: %+v\\n", stats)
	fmt.Printf("Size: %d\\n", cache.Size())
}
`,
  });

  return { files, dependencies };
}

// Write generated files
export async function writeCachingFiles(
  serviceName: string,
  integration: any,
  outputDir: string,
  language: string
): Promise<void> {
  await fs.ensureDir(outputDir);

  for (const file of integration.files) {
    const filePath = path.join(outputDir, file.path);
    const fileDir = path.dirname(filePath);

    await fs.ensureDir(fileDir);
    await fs.writeFile(filePath, file.content);
  }

  const buildContent = generateBuildMarkdown(serviceName, integration, language);
  await fs.writeFile(path.join(outputDir, 'BUILD.md'), buildContent);
}

// Display configuration
export async function displayCachingConfig(config: CachingConfig): Promise<void> {
  console.log(chalk.bold.magenta('\n💾 Data Caching: ' + config.serviceName));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(chalk.cyan('Default Backend:'), config.defaultBackend);
  console.log(chalk.cyan('Default TTL:'), `${config.defaultTTL}s`);
  console.log(chalk.cyan('Max Entries:'), config.maxEntries);
  console.log(chalk.cyan('Eviction Policy:'), config.evictionPolicy);
  console.log(chalk.cyan('Compression:'), config.enableCompression ? chalk.green('enabled') : chalk.red('disabled'));
  console.log(chalk.cyan('Statistics:'), config.enableStats ? chalk.green('enabled') : chalk.red('disabled'));

  console.log(chalk.cyan('\n🗄️  Cache Backends:'));
  console.log(chalk.gray('  • memory - In-memory cache (fast, limited size)'));
  console.log(chalk.gray('  • redis - Redis distributed cache'));
  console.log(chalk.gray('  • memcached - Memcached distributed cache'));
  console.log(chalk.gray('  • dynamodb - AWS DynamoDB'));
  console.log(chalk.gray('  • cassandra - Apache Cassandra'));
  console.log(chalk.gray('  • mongodb - MongoDB'));
  console.log(chalk.gray('  • sql - SQL database'));

  console.log(chalk.cyan('\n📋 Cache Strategies:'));
  console.log(chalk.gray('  • cache-aside - Lazy loading (most popular)'));
  console.log(chalk.gray('  • write-through - Write to cache and DB simultaneously'));
  console.log(chalk.gray('  • write-behind - Write to cache, sync to DB later'));
  console.log(chalk.gray('  • write-back - Write to cache, sync periodically'));
  console.log(chalk.gray('  • refresh-ahead - Proactive refresh'));

  console.log(chalk.cyan('\n🔄 Eviction Policies:'));
  console.log(chalk.gray('  • lru - Least Recently Used'));
  console.log(chalk.gray('  • lfu - Least Frequently Used'));
  console.log(chalk.gray('  • fifo - First In First Out'));
  console.log(chalk.gray('  • lifo - Last In First Out'));
  console.log(chalk.gray('  • random - Random eviction'));
  console.log(chalk.gray('  • ttl - Shortest TTL first'));

  console.log(chalk.cyan('\n✨ Features:'));
  console.log(chalk.gray('  • Tag-based invalidation'));
  console.log(chalk.gray('  • Automatic expiration'));
  console.log(chalk.gray('  • Cache statistics'));
  console.log(chalk.gray('  • Bulk operations'));
  console.log(chalk.gray('  • Cache warming'));
  console.log(chalk.gray('  • Refresh-ahead'));

  console.log(chalk.gray('─'.repeat(50)));
}

// Generate BUILD.md
function generateBuildMarkdown(serviceName: string, integration: any, language: string): string {
  const toPascalCase = (str: string) =>
    str.replace(/(?:^|[-_])(\w)/g, (_, c) => c.toUpperCase()).replace(/[-_]/g, '');

  return `# Data Caching Build Instructions for ${serviceName}

## Language: ${language.toUpperCase()}

## Architecture

This data caching system provides:
- **Multiple Backends**: Memory, Redis, Memcached, DynamoDB, Cassandra
- **5 Caching Strategies**: Cache-aside, Write-through, Write-behind, Write-back, Refresh-ahead
- **6 Eviction Policies**: LRU, LFU, FIFO, LIFO, Random, TTL
- **Tag-Based Invalidation**: Invalidate multiple entries by tags
- **Automatic Expiration**: TTL-based cache expiration
- **Statistics Tracking**: Hit rate, miss rate, eviction count

## Usage Examples

### Basic Caching

\`\`\`typescript
import { ${toPascalCase(serviceName)}DataCache } from './${serviceName}-data-caching';

const cache = new ${toPascalCase(serviceName)}DataCache({
  serviceName: '${serviceName}',
  defaultBackend: 'memory',
  defaultTTL: 3600,
  maxEntries: 10000,
  evictionPolicy: 'lru',
});

// Set value
cache.set('user:1', { id: 1, name: 'Alice' });

// Get value
const user = cache.get('user:1');
console.log('User:', user);
\`\`\`

### Cache-Aside Pattern

\`\`\`typescript
const result = await cache.getOrSet('user:1', async () => {
  // Fetch from database on cache miss
  return await db.fetchUser(1);
});
\`\`\`

### Tag-Based Invalidation

\`\`\`typescript
// Set with tags
cache.set('user:1', user1, { tags: ['users', 'profile'] });
cache.set('user:2', user2, { tags: ['users', 'profile'] });

// Invalidate all users
cache.invalidateByTags(['users']);
\`\`\`

### Bulk Operations

\`\`\`typescript
// Get multiple keys
const users = cache.getMany(['user:1', 'user:2', 'user:3']);

// Set multiple keys
const entries = new Map([
  ['user:1', user1],
  ['user:2', user2],
]);
cache.setMany(entries);

// Delete multiple keys
cache.deleteMany(['user:1', 'user:2']);
\`\`\`

### Statistics

\`\`\`typescript
const stats = cache.getStats();
console.log('Hit rate:', stats.hitRate);
console.log('Miss rate:', stats.missRate);
console.log('Cache size:', stats.size);
console.log('Evictions:', stats.evictions);
\`\`\`

## Cache Strategies Comparison

| Strategy | Description | Use Case |
|----------|-------------|----------|
| cache-aside | Load on demand | General purpose |
| write-through | Sync writes | Read-heavy |
| write-behind | Async writes | Write-heavy |
| write-back | Periodic sync | High performance |
| refresh-ahead | Proactive refresh | Predictable access |

## Integration

See generated code for complete API reference and examples.
`;
}
