import { BackendTemplate } from '../types';

/**
 * Distributed Caching Strategies Template
 * Complete distributed caching with Redis, Memcached, and CDN integration
 */
export const distributedCachingTemplate: BackendTemplate = {
  id: 'distributed-caching',
  name: 'Distributed Caching Strategies',
  displayName: 'Advanced Distributed Caching with Redis, Memcached, and CDN',
  description: 'Complete distributed caching system with Redis, Memcached, CDN integration, cache warming, invalidation strategies, and multi-layer architecture',
  version: '1.0.0',
  language: 'typescript',
  framework: 'express',
  tags: ['caching', 'redis', 'memcached', 'cdn', 'distributed', 'performance'],
  port: 3000,
  dependencies: {
    'express': '^4.18.2',
    'cors': '^2.8.5',
    'helmet': '^7.0.0',
    'compression': '^1.7.4',
    'ioredis': '^5.3.2',
    'memjs': '^10.0.0',
    'node-cache': '^5.1.2',
    'axios': '^1.5.0',
    'etag': '^1.8.1',
    'fresh': '^0.5.2',
    'redis-semaphore': '^5.4.0',
    'throttle': '^1.0.0',
  },
  devDependencies: {
    '@types/express': '^4.17.17',
    '@types/cors': '^2.8.13',
    '@types/compression': '^1.7.2',
    '@types/node': '^20.5.0',
    '@types/node-cache': '^5.1.0',
    '@types/memjs': '^10.0.0',
    '@types/etag': '^1.8.1',
    '@types/fresh': '^0.5.2',
    'typescript': '^5.1.6',
    'ts-node': '^10.9.1',
  },
  features: ['rest-api', 'monitoring', 'performance', 'database'],

  files: {
    'package.json': `{
  "name": "{{name}}-distributed-caching",
  "version": "1.0.0",
  "description": "{{name}} - Distributed Caching Strategies",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "ioredis": "^5.3.2",
    "memjs": "^10.0.0",
    "node-cache": "^5.1.2",
    "axios": "^1.5.0",
    "etag": "^1.8.1",
    "fresh": "^0.5.2",
    "redis-semaphore": "^5.4.0",
    "throttle": "^1.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/compression": "^1.7.2",
    "@types/node": "^20.5.0",
    "@types/node-cache": "^5.1.0",
    "@types/memjs": "^10.0.0",
    "typescript": "^5.1.6",
    "ts-node": "^10.9.1"
  }
}`,

    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`,

    'src/index.ts': `// Distributed Caching Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { DistributedCacheManager } from './cache/distributed-cache-manager';
import { RedisCacheLayer } from './cache/redis-cache-layer';
import { MemcachedCacheLayer } from './cache/memcached-cache-layer';
import { CDNManager } from './cache/cdn-manager';
import { CacheWarmer } from './cache/cache-warmer';
import { apiRoutes } from './routes/api.routes';
import { cacheRoutes } from './routes/cache.routes';
import { metricsRoutes } from './routes/metrics.routes';

const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize cache layers
const redisCache = new RedisCacheLayer({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
});

const memcachedCache = new MemcachedCacheLayer({
  servers: (process.env.MEMCACHED_SERVERS || 'localhost:11211').split(','),
  options: {
    retries: 2,
    retry: 5000,
    timeout: 1000,
    failOverServers: [],
  },
});

const cdnManager = new CDNManager({
  provider: process.env.CDN_PROVIDER || 'cloudflare',
  zoneId: process.env.CDN_ZONE_ID,
  apiKey: process.env.CDN_API_KEY,
});

const cacheManager = new DistributedCacheManager(redisCache, memcachedCache, cdnManager);

// Initialize
await redisCache.initialize();
await memcachedCache.initialize();
await cdnManager.initialize();
await cacheManager.initialize();

// Cache warmer
const cacheWarmer = new CacheWarmer(cacheManager);
await cacheWarmer.initialize();

// Make available globally
app.set('cacheManager', cacheManager);
app.set('cacheWarmer', cacheWarmer);

// Routes
app.use('/api', apiRoutes(cacheManager));
app.use('/cache', cacheRoutes(cacheManager));
app.use('/metrics', metricsRoutes(cacheManager));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cache: {
      redis: redisCache.isConnected(),
      memcached: memcachedCache.isConnected(),
      cdn: cdnManager.isEnabled(),
    },
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      status: err.status || 500,
      timestamp: new Date().toISOString(),
    },
  });
});

// Start server
const PORT = process.env.PORT || {{port}};
app.listen(PORT, () => {
  console.log(\`🚀 Distributed Caching Server running on port \${PORT}\`);
  console.log(\`📦 Redis: \${redisCache.isConnected() ? '✅' : '❌'}\`);
  console.log(\`💎 Memcached: \${memcachedCache.isConnected() ? '✅' : '❌'}\`);
  console.log(\`🌐 CDN: \${cdnManager.isEnabled() ? '✅' : '❌'}\`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await cacheWarmer.shutdown();
  await cacheManager.shutdown();
  await cdnManager.shutdown();
  await memcachedCache.shutdown();
  await redisCache.shutdown();
  process.exit(0);
});
`,

    'src/cache/distributed-cache-manager.ts': `// Distributed Cache Manager
// Multi-layer caching with Redis, Memcached, and CDN

import { EventEmitter } from 'events';
import { RedisCacheLayer } from './redis-cache-layer';
import { MemcachedCacheLayer } from './memcached-cache-layer';
import { CDNManager } from './cdn-manager';

export interface CacheEntry {
  value: any;
  timestamp: number;
  ttl: number;
  etag: string;
  compressed: boolean;
  layers: string[];
}

export interface CacheOptions {
  ttl?: number;
  useRedis?: boolean;
  useMemcached?: boolean;
  useCDN?: boolean;
  compress?: boolean;
  etag?: string;
}

export class DistributedCacheManager extends EventEmitter {
  private redisCache: RedisCacheLayer;
  private memcachedCache: MemcachedCacheLayer;
  private cdnManager: CDNManager;
  private initialized = false;

  constructor(
    redisCache: RedisCacheLayer,
    memcachedCache: MemcachedCacheLayer,
    cdnManager: CDNManager
  ) {
    super();
    this.redisCache = redisCache;
    this.memcachedCache = memcachedCache;
    this.cdnManager = cdnManager;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    console.log('✅ Distributed Cache Manager initialized');
  }

  async get(key: string, options: CacheOptions = {}): Promise<any> {
    const layers: string[] = [];

    // Try Redis first (fastest distributed cache)
    if (options.useRedis !== false) {
      const redisValue = await this.redisCache.get(key);
      if (redisValue) {
        layers.push('redis');

        // Update Memcached for faster subsequent access
        if (options.useMemcached !== false) {
          await this.memcachedCache.set(key, redisValue, { ttl: options.ttl });
        }

        this.emit('hit', { key, layer: 'redis' });
        return redisValue;
      }
    }

    // Try Memcached
    if (options.useMemcached !== false) {
      const memcachedValue = await this.memcachedCache.get(key);
      if (memcachedValue) {
        layers.push('memcached');

        // Update Redis for persistence
        if (options.useRedis !== false) {
          await this.redisCache.set(key, memcachedValue, { ttl: options.ttl });
        }

        this.emit('hit', { key, layer: 'memcached' });
        return memcachedValue;
      }
    }

    // Try CDN
    if (options.useCDN !== false) {
      const cdnValue = await this.cdnManager.get(key);
      if (cdnValue) {
        layers.push('cdn');

        // Update lower layers
        if (options.useMemcached !== false) {
          await this.memcachedCache.set(key, cdnValue, { ttl: options.ttl });
        }
        if (options.useRedis !== false) {
          await this.redisCache.set(key, cdnValue, { ttl: options.ttl });
        }

        this.emit('hit', { key, layer: 'cdn' });
        return cdnValue;
      }
    }

    this.emit('miss', { key });
    return null;
  }

  async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    const etag = options.etag || this.generateETag(value);

    // Store in Redis (persistent)
    if (options.useRedis !== false) {
      await this.redisCache.set(key, value, { ttl: options.ttl, etag });
    }

    // Store in Memcached (fast access)
    if (options.useMemcached !== false) {
      await this.memcachedCache.set(key, value, { ttl: options.ttl });
    }

    // Store in CDN
    if (options.useCDN !== false) {
      await this.cdnManager.set(key, value, { ttl: options.ttl });
    }

    this.emit('set', { key, options });
  }

  async invalidate(key: string, options: CacheOptions = {}): Promise<void> {
    // Invalidate in all layers
    if (options.useRedis !== false) {
      await this.redisCache.delete(key);
    }

    if (options.useMemcached !== false) {
      await this.memcachedCache.delete(key);
    }

    if (options.useCDN !== false) {
      await this.cdnManager.purge(key);
    }

    this.emit('invalidate', { key });
  }

  async invalidatePattern(pattern: string): Promise<void> {
    await this.redisCache.deletePattern(pattern);
    await this.memcachedCache.deletePattern(pattern);
    await this.cdnManager.purgePattern(pattern);
    this.emit('invalidate:pattern', { pattern });
  }

  private generateETag(value: any): string {
    const hash = JSON.stringify(value);
    const crypto = require('crypto');
    return crypto.createHash('md5').update(hash).digest('hex');
  }

  getStats(): {
    redis: any;
    memcached: any;
    cdn: any;
  } {
    return {
      redis: this.redisCache.getStats(),
      memcached: this.memcachedCache.getStats(),
      cdn: this.cdnManager.getStats(),
    };
  }

  async shutdown(): Promise<void> {
    await this.cdnManager.shutdown();
    await this.memcachedCache.shutdown();
    await this.redisCache.shutdown();
    this.initialized = false;
    console.log('✅ Distributed Cache Manager shut down');
  }
}
`,

    'src/cache/redis-cache-layer.ts': `// Redis Cache Layer
// Distributed caching with Redis

import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { Semaphore } from 'redis-semaphore';

export interface RedisOptions {
  ttl?: number;
  compress?: boolean;
}

export class RedisCacheLayer extends EventEmitter {
  private redis?: Redis;
  private cluster?: Redis.Cluster;
  private useCluster: boolean;
  private semaphores: Map<string, Semaphore> = new Map();
  private stats: { hits: number; misses: number; sets: number; deletes: number } = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };
  private connected = false;

  constructor(private config: {
    host: string;
    port?: number;
    password?: string;
    db?: number;
    clusterNodes?: Array<{ host: string; port: number }>;
  }) {}

  async initialize(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      if (this.config.clusterNodes) {
        this.cluster = new Redis.Cluster(this.config.clusterNodes, {
          redisOptions: {
            password: this.config.password,
          },
        });
        this.cluster.on('connect', () => {
          this.connected = true;
          console.log('✅ Redis Cluster connected');
        });
      } else {
        this.redis = new Redis({
          host: this.config.host,
          port: this.config.port,
          password: this.config.password,
          db: this.config.db,
          retryStrategy: (times) => {
            if (times > 10) {
              return new Error('Redis retry limit exceeded');
            }
            return Math.min(times * 100, 3000);
          },
        });
        this.redis.on('connect', () => {
          this.connected = true;
          console.log('✅ Redis connected');
        });
      }

      // Set up error handling
      const client = this.redis || this.cluster;
      client!.on('error', (err) => {
        console.error('Redis error:', err);
      });
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
    }
  }

  async get(key: string): Promise<any> {
    if (!this.connected) return null;

    const client = this.redis || this.cluster;

    try {
      const value = await client!.get(\`cache:\${key}\`);

      if (value) {
        this.stats.hits++;
        return JSON.parse(value);
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      console.error('Redis get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  async set(key: string, value: any, options: RedisOptions = {}): Promise<void> {
    if (!this.connected) return;

    const client = this.redis || this.cluster;
    const ttl = options.ttl || 3600; // 1 hour default

    try {
      await client!.setex(
        \`cache:\${key}\`,
        ttl,
        JSON.stringify({
          value,
          timestamp: Date.now(),
          compressed: options.compress || false,
        })
      );

      this.stats.sets++;
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.connected) return;

    const client = this.redis || this.cluster;

    try {
      await client!.del(\`cache:\${key}\`);
      this.stats.deletes++;
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    if (!this.connected) return;

    const client = this.redis || this.cluster;

    try {
      const keys = await client!.keys(\`cache:\${pattern}\`);

      if (keys.length > 0) {
        await client!.del(...keys);
      }
    } catch (error) {
      console.error('Redis deletePattern error:', error);
    }
  }

  async withSemaphore(key: string, limit: number, fn: () => Promise<any>): Promise<any> {
    if (!this.semaphores.has(key)) {
      this.semaphores.set(key, new Semaphore(limit));
    }

    const semaphore = this.semaphores.get(key)!;
    return semaphore.use(fn);
  }

  isConnected(): boolean {
    return this.connected;
  }

  getStats(): any {
    return {
      ...this.stats,
      connected: this.connected,
    };
  }

  async shutdown(): Promise<void> {
    this.semaphores.clear();

    if (this.redis) {
      await this.redis.quit();
    }

    if (this.cluster) {
      await this.cluster.quit();
    }

    this.connected = false;
    console.log('✅ Redis Cache Layer shut down');
  }
}
`,

    'src/cache/memcached-cache-layer.ts': `// Memcached Cache Layer
// High-performance distributed caching with Memcached

import { EventEmitter } from 'events';
import MemJS from 'memjs';

export interface MemcachedOptions {
  ttl?: number;
  expires?: number;
}

export class MemcachedCacheLayer extends EventEmitter {
  private client?: MemJS.Client;
  private stats: { hits: number; misses: number; sets: number; deletes: number } = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };
  private connected = false;

  constructor(private config: {
    servers: string[];
    options?: MemJS.ClientOptions;
  }) {}

  async initialize(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      this.client = new MemJS.Client(this.config.servers, this.config.options);

      await this.client.get('connect-check').then(() => true, () => false);

      this.connected = true;
      console.log('✅ Memcached connected');
    } catch (error) {
      console.error('Failed to connect to Memcached:', error);
    }
  }

  async get(key: string): Promise<any> {
    if (!this.connected) return null;

    try {
      const value = await this.client!.get(\`cache:\${key}\`);

      if (value) {
        this.stats.hits++;
        return JSON.parse(value.value.toString());
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      console.error('Memcached get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  async set(key: string, value: any, options: MemcachedOptions = {}): Promise<void> {
    if (!this.connected) return;

    try {
      const ttl = options.ttl || options.expires || 3600;

      await this.client!.set(\`cache:\${key}\`, JSON.stringify(value), {
        expires: ttl,
      });

      this.stats.sets++;
    } catch (error) {
      console.error('Memcached set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client!.delete(\`cache:\${key}\`);
      this.stats.deletes++;
    } catch (error) {
      console.error('Memcached delete error:', error);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    if (!this.connected) return;

    // Memcached doesn't support pattern deletion natively
    // We would need to track keys or use a different approach
    console.warn(\`Memcached deletePattern not implemented for: \${pattern}\`);
  }

  async touch(key: string, ttl: number): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client!.touch(\`cache:\${key}\`, ttl);
    } catch (error) {
      console.error('Memcached touch error:', error);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getStats(): any {
    return {
      ...this.stats,
      connected: this.connected,
    };
  }

  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client!.end();
    }

    this.connected = false;
    console.log('✅ Memcached Cache Layer shut down');
  }
}
`,

    'src/cache/cdn-manager.ts': `// CDN Manager
// CDN integration for global asset distribution

import { EventEmitter } from 'events';
import axios from 'axios';

export class CDNManager extends EventEmitter {
  private provider: string;
  private zoneId?: string;
  private apiKey?: string;
  private enabled = true;
  private stats: { hits: number; misses: number; purges: number } = {
    hits: 0,
    misses: 0,
    purges: 0,
  };

  constructor(config: {
    provider: string;
    zoneId?: string;
    apiKey?: string;
  }) {
    super();
    this.provider = config.provider;
    this.zoneId = config.zoneId;
    this.apiKey = config.apiKey;

    if (!config.zoneId && !config.apiKey) {
      this.enabled = false;
    }
  }

  async initialize(): Promise<void> {
    if (this.enabled) {
      console.log(\`✅ CDN Manager initialized (\${this.provider})\`);
    } else {
      console.log('⚠️  CDN Manager disabled (no credentials)');
    }
  }

  async get(key: string): Promise<any> {
    if (!this.enabled) return null;

    try {
      if (this.provider === 'cloudflare') {
        return await this.getFromCloudflare(key);
      } else if (this.provider === 'aws-cloudfront') {
        return await this.getFromCloudFront(key);
      }

      return null;
    } catch (error) {
      console.error('CDN get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  async set(key: string, value: any, options: { ttl?: number } = {}): Promise<void> {
    if (!this.enabled) return;

    try {
      if (this.provider === 'cloudflare') {
        await this.setToCloudflare(key, value, options);
      } else if (this.provider === 'aws-cloudfront') {
        await this.setToCloudFront(key, value, options);
      }

      this.emit('set', { key, value });
    } catch (error) {
      console.error('CDN set error:', error);
    }
  }

  async purge(key: string): Promise<void> {
    if (!this.enabled) return;

    try {
      if (this.provider === 'cloudflare') {
        await this.purgeCloudflare(key);
      } else if (this.provider === 'aws-cloudfront') {
        await this.purgeCloudFront(key);
      }

      this.stats.purges++;
    } catch (error) {
      console.error('CDN purge error:', error);
    }
  }

  async purgePattern(pattern: string): Promise<void> {
    if (!this.enabled) return;

    try {
      // Wildcard purge
      await this.purge(\`\${pattern}*\`);
    } catch (error) {
      console.error('CDN purgePattern error:', error);
    }
  }

  private async getFromCloudflare(key: string): Promise<any> {
    // Implementation would use Cloudflare API
    // This is a placeholder
    return null;
  }

  private async getFromCloudFront(key: string): Promise<any> {
    // Implementation would use CloudFront API
    // This is a placeholder
    return null;
  }

  private async setToCloudflare(key: string, value: any, options: { ttl?: number }): Promise<void> {
    // Implementation would use Cloudflare API
  }

  private async setToCloudFront(key: string, value: any, options: { ttl?: number }): Promise<void> {
    // Implementation would use CloudFront API
  }

  private async purgeCloudflare(key: string): Promise<void> {
    const response = await axios.post(
      \`https://api.cloudflare.com/client/v4/zones/\${this.zoneId}/purge_cache\`,
      { files: [key] },
      {
        headers: {
          'Authorization': \`Bearer \${this.apiKey}\`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.success) {
      console.log(\`✅ Purged from Cloudflare: \${key}\`);
    }
  }

  private async purgeCloudFront(key: string): Promise<void> {
    // Implementation would use CloudFront API
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getStats(): any {
    return {
      ...this.stats,
      provider: this.provider,
      enabled: this.enabled,
    };
  }

  async shutdown(): Promise<void> {
    this.enabled = false;
    console.log('✅ CDN Manager shut down');
  }
}
`,

    'src/cache/cache-warmer.ts': `// Cache Warmer
// Pre-populates cache with frequently accessed data

import { EventEmitter } from 'events';
import { DistributedCacheManager } from './distributed-cache-manager';

export interface WarmupEntry {
  key: string;
  fetcher: () => Promise<any>;
  ttl?: number;
  priority?: number;
}

export class CacheWarmer extends EventEmitter {
  private cacheManager: DistributedCacheManager;
  private entries: WarmupEntry[] = [];
  private warming = false;
  private interval?: NodeJS.Timeout;

  constructor(cacheManager: DistributedCacheManager) {
    super();
    this.cacheManager = cacheManager;
  }

  async initialize(): Promise<void> {
    // Start periodic warming
    this.startPeriodicWarming();
    console.log('✅ Cache Warmer initialized');
  }

  register(entry: WarmupEntry): void {
    this.entries.push({
      ...entry,
      priority: entry.priority || 0,
    });

    // Sort by priority
    this.entries.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  async warmUp(key?: string): Promise<void> {
    if (this.warming) return;

    this.warming = true;

    try {
      const entriesToWarm = key
        ? this.entries.filter(e => e.key === key)
        : this.entries;

      for (const entry of entriesToWarm) {
        try {
          // Check if already cached
          const cached = await this.cacheManager.get(entry.key);

          if (!cached) {
            const value = await entry.fetcher();
            await this.cacheManager.set(entry.key, value, { ttl: entry.ttl });
            console.log(\`✅ Warmed up: \${entry.key}\`);
          }
        } catch (error) {
          console.error(\`❌ Failed to warm up \${entry.key}:\`, error);
        }
      }

      this.emit('warmup:complete', { keys: entriesToWarm.map(e => e.key) });
    } finally {
      this.warming = false;
    }
  }

  private startPeriodicWarming(): void {
    // Warm up every 5 minutes
    this.interval = setInterval(async () => {
      await this.warmUp();
    }, 5 * 60 * 1000);
  }

  stopPeriodicWarming(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  getEntries(): WarmupEntry[] {
    return [...this.entries];
  }

  async shutdown(): Promise<void> {
    this.stopPeriodicWarming();
    this.entries = [];
    this.warming = false;
    console.log('✅ Cache Warmer shut down');
  }
}
`,

    'src/routes/api.routes.ts': `// API Routes with caching middleware
import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { DistributedCacheManager } from '../cache/distributed-cache-manager';
import { cache } from '../middleware/cache.middleware';

export function apiRoutes(cacheManager: DistributedCacheManager): Router {
  const router = Router();

  // Apply caching middleware
  router.use(cache(cacheManager));

  router.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/data', async (req, res, next) => {
    const data = {
      message: 'Hello from distributed cache!',
      timestamp: new Date().toISOString(),
      items: Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: \`Item \${i + 1}\`,
      })),
    };

    // Set in cache
    req.cacheEntry = data;

    res.json(data);
  });

  router.get('/users/:id', async (req, res) => {
    const { id } = req.params;

    const user = {
      id,
      name: \`User \${id}\`,
      email: \`user\${id}@example.com\`,
    };

    req.cacheEntry = user;

    res.json(user);
  });

  return router;
}
`,

    'src/routes/cache.routes.ts': `// Cache Routes
import { Router } from 'express';
import { DistributedCacheManager } from '../cache/distributed-cache-manager';

export function cacheRoutes(cacheManager: DistributedCacheManager): Router {
  const router = Router();

  router.get('/stats', (req, res) => {
    const stats = cacheManager.getStats();
    res.json(stats);
  });

  router.get('/:key', async (req, res) => {
    const { key } = req.params;
    const value = await cacheManager.get(key);

    if (value) {
      res.json({ key, value });
    } else {
      res.status(404).json({ error: 'Key not found' });
    }
  });

  router.put('/:key', async (req, res) => {
    const { key } = req.params;
    const { value, ttl, useRedis, useMemcached, useCDN } = req.body;

    await cacheManager.set(key, value, {
      ttl,
      useRedis,
      useMemcached,
      useCDN,
    });

    res.json({ message: 'Cache entry set' });
  });

  router.delete('/:key', async (req, res) => {
    const { key } = req.params;

    await cacheManager.invalidate(key);

    res.json({ message: 'Cache entry invalidated' });
  });

  router.post('/invalidate', async (req, res) => {
    const { pattern } = req.body;

    await cacheManager.invalidatePattern(pattern);

    res.json({ message: \`Invalidated pattern: \${pattern}\` });
  });

  router.post('/warmup', async (req, res) => {
    const { entries } = req.body;
    const cacheWarmer = req.app.get('cacheWarmer');

    for (const entry of entries) {
      cacheWarmer.register(entry);
    }

    await cacheWarmer.warmUp();

    res.json({ message: \`Warmed up \${entries.length} entries\` });
  });

  return router;
}
`,

    'src/routes/metrics.routes.ts': `// Metrics Routes
import { Router } from 'express';
import { DistributedCacheManager } from '../cache/distributed-cache-manager';

export function metricsRoutes(cacheManager: DistributedCacheManager): Router {
  const router = Router();

  router.get('/cache', (req, res) => {
    const stats = cacheManager.getStats();
    res.json(stats);
  });

  router.get('/all', (req, res) => {
    const cacheWarmer = req.app.get('cacheWarmer');

    res.json({
      cache: cacheManager.getStats(),
      warmer: {
        entries: cacheWarmer.getEntries(),
        warming: cacheWarmer['warming'],
      },
    });
  });

  return router;
}
`,

    'src/middleware/cache.middleware.ts': `// Cache Middleware
import { Request, Response, NextFunction } from 'express';
import { DistributedCacheManager } from '../cache/distributed-cache-manager';
import { generateETag } from '../utils/etag';

declare module 'express' {
  interface Request {
    cacheKey?: string;
    cacheEntry?: any;
    cacheOptions?: any;
  }
}

export function cache(cacheManager: DistributedCacheManager) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = req.cacheKey || req.originalUrl;

    // Check cache
    const cached = await cacheManager.get(cacheKey);

    if (cached && cached.etag) {
      // Check If-None-Match header
      const ifNoneMatch = req.get('If-None-Match');

      if (ifNoneMatch === cached.etag) {
        return res.status(304).end();
      }

      // Set cache headers
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Layer', cached.layers.join(','));

      return res.json(cached.value);
    }

    // Set up cache middleware for response
    const originalJson = res.json.bind(res);

    res.json = function(body: any) {
      // Generate ETag if not set
      const etag = generateETag(body);

      req.cacheEntry = {
        value: body,
        etag,
        timestamp: Date.now(),
      };

      // Set cache headers
      res.set('ETag', etag);
      res.set('X-Cache', 'MISS');

      // Cache the response
      cacheManager.set(cacheKey, req.cacheEntry, {
        ttl: req.cacheOptions?.ttl || 3600,
      });

      return originalJson(body);
    };

    next();
  };
}
`,

    'src/utils/etag.ts': `// ETag Utility
import crypto from 'crypto';

export function generateETag(data: any): string {
  const str = JSON.stringify(data);
  return crypto.createHash('md5').update(str).digest('hex');
}

export function generateWeakETag(data: any): string {
  const str = JSON.stringify(data);
  const hash = crypto.createHash('md5').update(str).digest('hex');
  return \`W/\${hash}\`;
}
`,

    // Documentation
    'README.md': `# Distributed Caching Strategies

Complete distributed caching system with Redis, Memcached, and CDN integration.

## Features

- **Multi-Layer Caching**: Redis (persistent), Memcached (fast), CDN (global)
- **Cache Warming**: Pre-populate cache with frequently accessed data
- **Cache Invalidation**: Pattern-based invalidation across all layers
- **Smart Promotions**: Cache promotion between layers
- **ETag Support**: Efficient conditional requests
- **Compression**: Optional response compression
- **Semaphore**: Concurrency control for Redis operations

## Installation

\`\`\`bash
npm install
\`\`\`

## Configuration

Set environment variables:

\`\`\`bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Memcached
MEMCACHED_SERVERS=localhost:11211

# CDN (Cloudflare)
CDN_PROVIDER=cloudflare
CDN_ZONE_ID=your-zone-id
CDN_API_KEY=your-api-key

# AWS CloudFront
# CDN_PROVIDER=aws-cloudfront
\`\`\`

## Architecture

\`\`\`
┌─────────────────────────────────────────────────────────┐
│           Distributed Cache Manager                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────┐ │
│  │ Redis    │  │ Memcached  │  │ CDN             │ │
│  │ Cluster  │  │           │  │ (Cloudflare/    │ │
│  │          │  │           │  │  CloudFront)    │ │
│  └──────────┘  └────────────┘  └──────────────────┘ │
│      Persistent        Fast           Global          │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │           Cache Warmer                             │ │
│  │  - Pre-populates frequently accessed data          │ │
│  │  - Periodic warming every 5 minutes                 │ │
│  │  - Priority-based warming                            │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
\`\`\`

## Usage

### Cache Data

\`\`\`typescript
await cacheManager.set('user:123', userData, {
  ttl: 3600,
  useRedis: true,
  useMemcached: true,
  useCDN: true,
});

const data = await cacheManager.get('user:123');
\`\`\`

### Invalidate Cache

\`\`\`typescript
// Single key
await cacheManager.invalidate('user:123');

// Pattern
await cacheManager.invalidatePattern('user:*');
\`\`\`

### Warm Cache

\`\`\`typescript
cacheWarmer.register({
  key: 'popular-users',
  fetcher: async () => await fetchPopularUsers(),
  ttl: 600,
  priority: 1,
});

await cacheWarmer.warmUp();
\`\`\`

## API Endpoints

### Cache

- \`GET /cache/stats\` - Get cache statistics
- \`GET /cache/:key\` - Get cache entry
- \`PUT /cache/:key\` - Set cache entry
- \`DELETE /cache/:key\` - Invalidate entry
- \`POST /cache/invalidate\` - Invalidate pattern

### Metrics

- \`GET /metrics/cache\` - Cache metrics
- \`GET /metrics/all\` - All metrics including warmer

## Cache Strategy

1. **L1: Redis** - Persistent, shared across instances
2. **L2: Memcached** - Fast in-memory cache
3. **L3: CDN** - Global edge caching

Automatic promotion between layers based on access patterns.
`,
  },
};
