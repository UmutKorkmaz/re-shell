import { BackendTemplate } from '../types';

/**
 * Service-to-Service Communication Optimization Template
 * Complete intelligent service-to-service communication with adaptive caching
 */
export const serviceCommunicationOptimizationTemplate: BackendTemplate = {
  id: 'service-communication-optimization',
  name: 'Service Communication Optimization',
  displayName: 'Intelligent Service-to-Service Communication Optimization',
  description: 'Complete service-to-service communication system with adaptive caching, request optimization, connection pooling, circuit breakers, and intelligent retry logic',
  version: '1.0.0',
  language: 'typescript',
  framework: 'express',
  tags: ['microservices', 'caching', 'optimization', 'circuit-breaker', 'performance'],
  port: 3000,
  dependencies: {
    'express': '^4.18.2',
    'cors': '^2.8.5',
    'helmet': '^7.0.0',
    'compression': '^1.7.4',
    'ioredis': '^5.3.2',
    'axios': '^1.5.0',
    'node-cache': '^5.1.2',
    'lru-cache': '^10.0.0',
    'axios-retry': '^3.9.0',
    'opossum': '^8.1.0',
    'p-limit': '^5.0.0',
    'quick-lru': '^6.1.0',
  },
  devDependencies: {
    '@types/express': '^4.17.17',
    '@types/cors': '^2.8.13',
    '@types/compression': '^1.7.2',
    '@types/node': '^20.5.0',
    '@types/node-cache': '^5.1.0',
    '@types/lru-cache': '^7.10.0',
    'typescript': '^5.1.6',
    'ts-node': '^10.9.1',
  },
  features: ['rest-api', 'monitoring', 'performance'],

  files: {
    'package.json': `{
  "name": "{{name}}-service-communication",
  "version": "1.0.0",
  "description": "{{name}} - Service-to-Service Communication Optimization",
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
    "axios": "^1.5.0",
    "node-cache": "^5.1.2",
    "lru-cache": "^10.0.0",
    "axios-retry": "^3.9.0",
    "opossum": "^8.1.0",
    "p-limit": "^5.0.0",
    "quick-lru": "^6.1.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/compression": "^1.7.2",
    "@types/node": "^20.5.0",
    "@types/node-cache": "^5.1.0",
    "@types/lru-cache": "^7.10.0",
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

    'src/index.ts': `// Service Communication Optimization Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { ServiceCommunicationManager } from './communication/service-communication-manager';
import { AdaptiveCacheManager } from './communication/adaptive-cache-manager';
import { ConnectionPoolManager } from './communication/connection-pool-manager';
import { apiRoutes } from './routes/api.routes';
import { serviceRoutes } from './routes/service.routes';
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

// Initialize managers
const cacheManager = new AdaptiveCacheManager();
const poolManager = new ConnectionPoolManager();
const commManager = new ServiceCommunicationManager(cacheManager, poolManager);

await cacheManager.initialize();
await poolManager.initialize();
await commManager.initialize();

// Make managers available globally
app.set('cacheManager', cacheManager);
app.set('poolManager', poolManager);
app.set('commManager', commManager);

// Routes
app.use('/api', apiRoutes);
app.use('/services', serviceRoutes(commManager));
app.use('/cache', cacheRoutes(cacheManager));
app.use('/metrics', metricsRoutes(commManager));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    managers: {
      cache: cacheManager.getStats(),
      pool: poolManager.getStats(),
      communication: commManager.getStats(),
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
  console.log(\`🚀 Service Communication Server running on port \${PORT}\`);
  console.log(\`📊 Adaptive caching enabled\`);
  console.log(\`🔗 Connection pooling active\`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await commManager.shutdown();
  await poolManager.shutdown();
  await cacheManager.shutdown();
  process.exit(0);
});
`,

    'src/communication/adaptive-cache-manager.ts': `// Adaptive Cache Manager
// Multi-tier caching with adaptive strategies

import { EventEmitter } from 'event-emitter';
import NodeCache from 'node-cache';
import LRU from 'lru-cache';
import Redis from 'ioredis';
import { QuickLRU } from 'quick-lru';

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
  ttl: number;
  size: number;
}

export interface CacheStats {
  l1: { hits: number; misses: number; size: number };
  l2: { hits: number; misses: number; size: number };
  l3: { hits: number; misses: number };
  total: { hits: number; misses: number; hitRate: number };
}

export class AdaptiveCacheManager extends EventEmitter {
  // L1: In-memory LRU cache (fastest, smallest)
  private l1Cache: QuickLRU<string, CacheEntry<any>>;
  private l1MaxSize = 100;

  // L2: In-memory NodeCache (medium)
  private l2Cache: NodeCache;
  private l2StdTTL = 60; // 60 seconds

  // L3: Redis (persistent, shared across instances)
  private l3Cache?: Redis;
  private useRedis: boolean;

  private stats: CacheStats = {
    l1: { hits: 0, misses: 0, size: 0 },
    l2: { hits: 0, misses: 0, size: 0 },
    l3: { hits: 0, misses: 0 },
    total: { hits: 0, misses: 0, hitRate: 0 },
  };

  private initialized = false;

  constructor() {
    super();
    this.useRedis = !!process.env.REDIS_URL;

    // Initialize L1 cache
    this.l1Cache = new QuickLRU({ maxSize: this.l1MaxSize });

    // Initialize L2 cache
    this.l2Cache = new NodeCache({
      stdTTL: this.l2StdTTL,
      checkperiod: 120,
      useClones: false,
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.useRedis) {
      this.l3Cache = new Redis(process.env.REDIS_URL!);
      this.l3Cache.on('error', (err) => {
        console.error('Redis error:', err);
      });
      this.l3Cache.on('connect', () => {
        console.log('✅ Redis connected for L3 cache');
      });
    }

    this.initialized = true;
    console.log('✅ Adaptive Cache Manager initialized');
  }

  async get<T>(key: string): Promise<T | null> {
    // Try L1 cache first
    let entry = this.l1Cache.get(key);

    if (entry) {
      this.stats.l1.hits++;
      this.stats.total.hits++;
      entry.hits++;
      this.emit('l1:hit', { key, entry });
      return entry.value as T;
    }

    this.stats.l1.misses++;
    this.stats.total.misses++;

    // Try L2 cache
    const l2Value = this.l2Cache.get<CacheEntry<T>>(key);
    if (l2Value) {
      this.stats.l2.hits++;
      this.stats.total.hits++;
      l2Value.hits++;

      // Promote to L1
      this.l1Cache.set(key, l2Value);
      this.emit('l2:hit', { key, entry: l2Value });
      return l2Value.value;
    }

    this.stats.l2.misses++;

    // Try L3 cache (Redis)
    if (this.useRedis && this.l3Cache) {
      const l3Value = await this.l3Cache.get(\`cache:\${key}\`);

      if (l3Value) {
        this.stats.l3.hits++;
        this.stats.total.hits++;
        const parsed: CacheEntry<T> = JSON.parse(l3Value);
        parsed.hits++;

        // Promote to L2 and L1
        this.l2Cache.set(key, parsed);
        this.l1Cache.set(key, parsed);
        this.emit('l3:hit', { key, entry: parsed });
        return parsed.value;
      }

      this.stats.l3.misses++;
    }

    this.emit('miss', { key });
    return null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      hits: 0,
      ttl: ttl || this.l2StdTTL,
      size: this.estimateSize(value),
    };

    // Store in all tiers
    this.l1Cache.set(key, entry);

    this.l2Cache.set(key, entry, ttl || this.l2StdTTL);

    if (this.useRedis && this.l3Cache) {
      await this.l3Cache.setex(
        \`cache:\${key}\`,
        ttl || this.l2StdTTL,
        JSON.stringify(entry)
      );
    }

    this.emit('set', { key, entry });
  }

  async invalidate(key: string): Promise<void> {
    this.l1Cache.delete(key);
    this.l2Cache.del(key);

    if (this.useRedis && this.l3Cache) {
      await this.l3Cache.del(\`cache:\${key}\`);
    }

    this.emit('invalidate', { key });
  }

  async invalidatePattern(pattern: string): Promise<void> {
    // Invalidate L1 (check keys)
    for (const key of this.l1Cache.keys()) {
      if (this.matchesPattern(key, pattern)) {
        this.l1Cache.delete(key);
      }
    }

    // Invalidate L2
    const l2Keys = this.l2Cache.keys();
    for (const key of l2Keys) {
      if (this.matchesPattern(key, pattern)) {
        this.l2Cache.del(key);
      }
    }

    // Invalidate L3
    if (this.useRedis && this.l3Cache) {
      const keys = await this.l3Cache.keys(\`cache:\${pattern}\`);
      if (keys.length > 0) {
        await this.l3Cache.del(...keys);
      }
    }

    this.emit('invalidate:pattern', { pattern });
  }

  private matchesPattern(key: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return regex.test(key);
  }

  async warmUp(entries: Array<{ key: string; value: any }>): Promise<void> {
    for (const { key, value } of entries) {
      await this.set(key, value);
    }
    console.log(\`✅ Warmed up \${entries.length} cache entries\`);
  }

  getStats(): CacheStats {
    // Update sizes
    this.stats.l1.size = this.l1Cache.size;
    this.stats.l2.size = this.l2Cache.getStats().keys;

    // Calculate hit rate
    const total = this.stats.total.hits + this.stats.total.misses;
    this.stats.total.hitRate = total > 0 ? this.stats.total.hits / total : 0;

    return this.stats;
  }

  clearStats(): void {
    this.stats = {
      l1: { hits: 0, misses: 0, size: this.l1Cache.size },
      l2: { hits: 0, misses: 0, size: 0 },
      l3: { hits: 0, misses: 0 },
      total: { hits: 0, misses: 0, hitRate: 0 },
    };
  }

  private estimateSize(value: any): number {
    return JSON.stringify(value).length * 2; // Rough estimate in bytes
  }

  async shutdown(): Promise<void> {
    this.l1Cache.clear();
    this.l2Cache.flushAll();
    this.l2Cache.close();

    if (this.l3Cache) {
      await this.l3Cache.quit();
    }

    this.initialized = false;
    console.log('✅ Adaptive Cache Manager shut down');
  }
}
`,

    'src/communication/connection-pool-manager.ts': `// Connection Pool Manager
// Manages HTTP connection pools for service-to-service communication

import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';

export interface PoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
  maxRetries: number;
  retryDelay: number;
}

export interface PooledConnection {
  id: string;
  service: string;
  instance: AxiosInstance;
  inUse: boolean;
  lastUsed: number;
  createdAt: number;
}

export class ConnectionPoolManager extends EventEmitter {
  private pools: Map<string, PooledConnection[]> = new Map();
  private configs: Map<string, PoolConfig> = new Map();
  private initialized = false;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize with default configuration
    this.setPoolConfig('default', {
      maxConnections: 10,
      minConnections: 2,
      acquireTimeout: 10000,
      idleTimeout: 60000,
      maxRetries: 3,
      retryDelay: 1000,
    });

    this.initialized = true;
    console.log('✅ Connection Pool Manager initialized');
  }

  setPoolConfig(service: string, config: PoolConfig): void {
    this.configs.set(service, config);

    // Initialize pool for service
    if (!this.pools.has(service)) {
      this.pools.set(service, []);

      // Create minimum connections
      for (let i = 0; i < config.minConnections; i++) {
        this.createConnection(service);
      }
    }

    this.emit('config:updated', { service, config });
  }

  private createConnection(service: string): PooledConnection {
    const config = this.configs.get(service) || this.configs.get('default')!;

    const instance = axios.create({
      timeout: 30000,
      // Retry configuration
      'axios-retry': {
        retries: config.maxRetries,
        retryDelay: config.retryDelay,
        retryCondition: (error: any) => {
          // Retry on network errors or 5xx errors
          return !error.response || error.response.status >= 500;
        },
      },
    });

    const connection: PooledConnection = {
      id: this.generateId(),
      service,
      instance,
      inUse: false,
      lastUsed: Date.now(),
      createdAt: Date.now(),
    };

    const pool = this.pools.get(service)!;
    pool.push(connection);

    this.emit('connection:created', { service, connection });

    return connection;
  }

  async acquire(service: string, baseURL: string): Promise<AxiosInstance> {
    const config = this.configs.get(service) || this.configs.get('default')!;
    const pool = this.pools.get(service);

    if (!pool) {
      this.pools.set(service, []);
      return this.acquire(service, baseURL);
    }

    // Try to find an idle connection
    const startTime = Date.now();

    while (Date.now() - startTime < config.acquireTimeout) {
      const connection = pool.find((conn) => !conn.inUse);

      if (connection) {
        connection.inUse = true;
        connection.lastUsed = Date.now();

        // Set baseURL if not set
        if (!connection.instance.defaults.baseURL) {
          connection.instance.defaults.baseURL = baseURL;
        }

        this.emit('connection:acquired', { service, connection });
        return connection.instance;
      }

      // Wait a bit and retry
      await this.sleep(50);
    }

    // No idle connection, create a new one if under max
    if (pool.length < config.maxConnections) {
      const connection = this.createConnection(service);
      connection.inUse = true;
      connection.lastUsed = Date.now();

      if (!connection.instance.defaults.baseURL) {
        connection.instance.defaults.baseURL = baseURL;
      }

      return connection.instance;
    }

    // Wait for a connection to become available
    throw new Error(\`Connection pool exhausted for service \${service}\`);
  }

  release(service: string, instance: AxiosInstance): void {
    const pool = this.pools.get(service);

    if (!pool) return;

    const connection = pool.find((conn) => conn.instance === instance);

    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();

      this.emit('connection:released', { service, connection });
    }
  }

  getStats(): Map<string, any> {
    const stats = new Map();

    for (const [service, pool] of this.pools.entries()) {
      const inUse = pool.filter((c) => c.inUse).length;
      const idle = pool.filter((c) => !c.inUse).length;

      stats.set(service, {
        total: pool.length,
        inUse,
        idle,
        utilization: inUse / pool.length,
      });
    }

    return stats;
  }

  async cleanup(service: string): Promise<void> {
    const config = this.configs.get(service) || this.configs.get('default')!;
    const pool = this.pools.get(service);

    if (!pool) return;

    const now = Date.now();

    // Remove idle connections beyond minimum
    for (let i = pool.length - 1; i >= 0; i--) {
      const conn = pool[i];

      if (
        !conn.inUse &&
        pool.length > config.minConnections &&
        now - conn.lastUsed > config.idleTimeout
      ) {
        pool.splice(i, 1);
        this.emit('connection:closed', { service, connection: conn });
      }
    }
  }

  private generateId(): string {
    return \`conn-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async shutdown(): Promise<void> {
    for (const [service, pool] of this.pools.entries()) {
      for (const connection of pool) {
        this.emit('connection:closed', { service, connection });
      }
    }

    this.pools.clear();
    this.configs.clear();
    this.initialized = false;
    console.log('✅ Connection Pool Manager shut down');
  }
}
`,

    'src/communication/service-communication-manager.ts': `// Service Communication Manager
// High-level service-to-service communication with optimization

import { EventEmitter } from 'events';
import CircuitBreaker from 'opossum';
import pLimit from 'p-limit';
import { AdaptiveCacheManager } from './adaptive-cache-manager';
import { ConnectionPoolManager } from './connection-pool-manager';

export interface ServiceCallOptions {
  service: string;
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  cache?: boolean;
  cacheTTL?: number;
  timeout?: number;
}

export interface CallResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  cached: boolean;
  duration: number;
}

export class ServiceCommunicationManager extends EventEmitter {
  private cacheManager: AdaptiveCacheManager;
  private poolManager: ConnectionPoolManager;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private requestQueue: Map<string, pLimit.Limit> = new Map();
  private stats: Map<string, { calls: number; errors: number; avgDuration: number }> = new Map();
  private initialized = false;

  constructor(cacheManager: AdaptiveCacheManager, poolManager: ConnectionPoolManager) {
    super();
    this.cacheManager = cacheManager;
    this.poolManager = poolManager;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize service circuit breakers
    await this.setupCircuitBreakers();

    this.initialized = true;
    console.log('✅ Service Communication Manager initialized');
  }

  private async setupCircuitBreakers(): Promise<void> {
    // Define services with circuit breaker config
    const services = [
      { name: 'user-service', url: 'http://localhost:3001' },
      { name: 'order-service', url: 'http://localhost:3002' },
      { name: 'product-service', url: 'http://localhost:3003' },
    ];

    for (const service of services) {
      const breaker = new CircuitBreaker({
        timeout: 10000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
      });

      breaker.on('open', () => {
        console.warn(\`⚠️  Circuit breaker OPEN for \${service.name}\`);
        this.emit('circuit-breaker:open', { service: service.name });
      });

      breaker.on('halfOpen', () => {
        console.log(\`🔄 Circuit breaker HALF-OPEN for \${service.name}\`);
        this.emit('circuit-breaker:halfOpen', { service: service.name });
      });

      breaker.on('close', () => {
        console.log(\`✅ Circuit breaker CLOSED for \${service.name}\`);
        this.emit('circuit-breaker:close', { service: service.name });
      });

      this.circuitBreakers.set(service.name, breaker);

      // Initialize request queue (max concurrent requests)
      this.requestQueue.set(service.name, pLimit(10));

      // Initialize stats
      this.stats.set(service.name, { calls: 0, errors: 0, avgDuration: 0 });
    }
  }

  async call<T>(options: ServiceCallOptions): Promise<CallResult<T>> {
    const startTime = Date.now();
    const serviceStats = this.stats.get(options.service);

    try {
      // Check cache if enabled
      if (options.cache !== false && options.method === 'GET') {
        const cacheKey = this.getCacheKey(options);
        const cached = await this.cacheManager.get<T>(cacheKey);

        if (cached) {
          return {
            success: true,
            data: cached,
            cached: true,
            duration: Date.now() - startTime,
          };
        }
      }

      // Get circuit breaker
      const breaker = this.circuitBreakers.get(options.service);

      if (!breaker) {
        throw new Error(\`No circuit breaker for service: \${options.service}\`);
      }

      // Execute call through circuit breaker
      const result = await breaker.fire(async () => {
        // Acquire connection from pool
        const instance = await this.poolManager.acquire(
          options.service,
          \`http://\${options.service.replace('-', '')}:3000\`
        );

        try {
          const response = await instance.request({
            method: options.method || 'GET',
            url: options.endpoint,
            data: options.body,
            headers: options.headers,
          });

          // Release connection
          this.poolManager.release(options.service, instance);

          return response.data;
        } catch (error) {
          // Release connection on error
          this.poolManager.release(options.service, instance);
          throw error;
        }
      });

      // Cache successful GET requests
      if (options.cache !== false && options.method === 'GET') {
        const cacheKey = this.getCacheKey(options);
        await this.cacheManager.set(cacheKey, result, options.cacheTTL);
      }

      // Update stats
      if (serviceStats) {
        serviceStats.calls++;
        const duration = Date.now() - startTime;
        serviceStats.avgDuration =
          (serviceStats.avgDuration * (serviceStats.calls - 1) + duration) / serviceStats.calls;
      }

      return {
        success: true,
        data: result,
        cached: false,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      // Update error stats
      if (serviceStats) {
        serviceStats.errors++;
      }

      this.emit('call:failed', { options, error });

      return {
        success: false,
        error: error.message,
        cached: false,
        duration: Date.now() - startTime,
      };
    }
  }

  async batchCall<T>(calls: ServiceCallOptions[]): Promise<CallResult<T>[]> {
    const startTime = Date.now();

    // Group calls by service
    const grouped = new Map<string, ServiceCallOptions[]>();
    for (const call of calls) {
      if (!grouped.has(call.service)) {
        grouped.set(call.service, []);
      }
      grouped.get(call.service)!.push(call);
    }

    // Execute calls in parallel per service
    const results: CallResult<T>[] = [];

    for (const [service, serviceCalls] of grouped.entries()) {
      const queue = this.requestQueue.get(service);

      if (!queue) {
        throw new Error(\`No request queue for service: \${service}\`);
      }

      const serviceResults = await Promise.all(
        serviceCalls.map((call) => queue(() => this.call<T>(call)))
      );

      results.push(...serviceResults);
    }

    return results;
  }

  private getCacheKey(options: ServiceCallOptions): string {
    return \`\${options.service}:\${options.method || 'GET'}:\${options.endpoint}\`;
  }

  invalidateCache(service: string, pattern?: string): void {
    if (pattern) {
      this.cacheManager.invalidatePattern(\`\${service}:*:\${pattern}\`);
    } else {
      this.cacheManager.invalidatePattern(\`\${service}:\`);
    }
  }

  getStats(): Map<string, any> {
    return new Map(Array.from(this.stats.entries()).map(([service, stats]) => [
      service,
      {
        ...stats,
        errorRate: stats.calls > 0 ? stats.errors / stats.calls : 0,
        circuitBreaker: this.circuitBreakers.get(service)?.stats || {},
      },
    ]));
  }

  async shutdown(): Promise<void> {
    for (const breaker of this.circuitBreakers.values()) {
      breaker.shutdown();
    }

    this.circuitBreakers.clear();
    this.requestQueue.clear();
    this.stats.clear();
    this.initialized = false;
    console.log('✅ Service Communication Manager shut down');
  }
}
`,

    'src/routes/api.routes.ts': `// API Routes
import { Router } from 'express';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

router.get('/data', async (req, res) => {
  const commManager = req.app.get('commManager');

  // Example service-to-service call
  const result = await commManager.call({
    service: 'user-service',
    endpoint: '/users',
    method: 'GET',
    cache: true,
  });

  if (result.success) {
    res.json(result.data);
  } else {
    res.status(500).json({ error: result.error });
  }
});

export { router as apiRoutes };
`,

    'src/routes/service.routes.ts': `// Service Routes
import { Router } from 'express';
import { ServiceCommunicationManager } from '../communication/service-communication-manager';

export function serviceRoutes(commManager: ServiceCommunicationManager): Router {
  const router = Router();

  // Call another service
  router.post('/call', async (req, res) => {
    const { service, endpoint, method, body, cache } = req.body;

    try {
      const result = await commManager.call({
        service,
        endpoint,
        method,
        body,
        cache,
      });

      if (result.success) {
        res.json({
          data: result.data,
          cached: result.cached,
          duration: result.duration,
        });
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Batch service calls
  router.post('/batch', async (req, res) => {
    const { calls } = req.body;

    try {
      const results = await commManager.batchCall(calls);
      res.json({ results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Invalidate cache for service
  router.post('/:service/cache/invalidate', (req, res) => {
    const { service } = req.params;
    const { pattern } = req.body;

    commManager.invalidateCache(service, pattern);

    res.json({ message: \`Cache invalidated for \${service}\` });
  });

  return router;
}
`,

    'src/routes/cache.routes.ts': `// Cache Routes
import { Router } from 'express';
import { AdaptiveCacheManager } from '../communication/adaptive-cache-manager';

export function cacheRoutes(cacheManager: AdaptiveCacheManager): Router {
  const router = Router();

  // Get cache stats
  router.get('/stats', (req, res) => {
    const stats = cacheManager.getStats();
    res.json(stats);
  });

  // Clear cache
  router.post('/clear', async (req, res) => {
    await cacheManager.invalidatePattern('*');
    res.json({ message: 'Cache cleared' });
  });

  // Get cache entry
  router.get('/:key', async (req, res) => {
    const { key } = req.params;
    const value = await cacheManager.get(key);

    if (value) {
      res.json({ key, value });
    } else {
      res.status(404).json({ error: 'Key not found' });
    }
  });

  // Set cache entry
  router.put('/:key', async (req, res) => {
    const { key } = req.params;
    const { value, ttl } = req.body;

    await cacheManager.set(key, value, ttl);

    res.json({ message: 'Cache entry set' });
  });

  // Invalidate cache entry
  router.delete('/:key', async (req, res) => {
    const { key } = req.params;

    await cacheManager.invalidate(key);

    res.json({ message: 'Cache entry invalidated' });
  });

  // Warm up cache
  router.post('/warmup', async (req, res) => {
    const { entries } = req.body;

    await cacheManager.warmUp(entries);

    res.json({ message: \`Warmed up \${entries.length} entries\` });
  });

  return router;
}
`,

    'src/routes/metrics.routes.ts': `// Metrics Routes
import { Router } from 'express';
import { ServiceCommunicationManager } from '../communication/service-communication-manager';
import { ConnectionPoolManager } from '../connection-pool-manager';

export function metricsRoutes(
  commManager: ServiceCommunicationManager
): Router {
  const router = Router();

  // Get communication stats
  router.get('/communication', (req, res) => {
    const stats = commManager.getStats();
    res.json(Object.fromEntries(stats));
  });

  // Get pool stats
  router.get('/pools', (req, res) => {
    const poolManager = req.app.get('poolManager');
    const stats = poolManager.getStats();
    res.json(Object.fromEntries(stats));
  });

  // Get all metrics
  router.get('/all', (req, res) => {
    const poolManager = req.app.get('poolManager');
    const cacheManager = req.app.get('cacheManager');

    res.json({
      communication: Object.fromEntries(commManager.getStats()),
      pools: Object.fromEntries(poolManager.getStats()),
      cache: cacheManager.getStats(),
    });
  });

  return router;
}
`,

    // Documentation
    'README.md': `# Service Communication Optimization

Complete service-to-service communication system with adaptive caching, connection pooling, and circuit breakers.

## Features

- **Adaptive Multi-Tier Caching**: L1 (LRU), L2 (NodeCache), L3 (Redis)
- **Connection Pooling**: Reusable HTTP connections with min/max limits
- **Circuit Breakers**: Automatic fault detection and recovery
- **Request Batching**: Parallel execution with concurrency limits
- **Intelligent Retry**: Exponential backoff for failed requests
- **Cache Warming**: Pre-populate cache with frequently accessed data

## Installation

\`\`\`bash
npm install
\`\`\`

## Configuration

Set environment variables:

\`\`\`bash
REDIS_URL=redis://localhost:6379
\`\`\`

## Usage

### Service Call with Caching

\`\`\`typescript
import { ServiceCommunicationManager } from './service-communication-manager';

const result = await commManager.call({
  service: 'user-service',
  endpoint: '/users',
  method: 'GET',
  cache: true,
  cacheTTL: 60, // seconds
});
\`\`\`

### Batch Service Calls

\`\`\`typescript
const results = await commManager.batchCall([
  { service: 'user-service', endpoint: '/users', method: 'GET' },
  { service: 'order-service', endpoint: '/orders', method: 'GET' },
]);
\`\`\`

### Cache Management

\`\`\`typescript
// Invalidate all cache for a service
commManager.invalidateCache('user-service');

// Invalidate specific pattern
commManager.invalidateCache('user-service', '/users/*');
\`\`\`

## Architecture

\`\`\`
┌─────────────────────────────────────────────────────────┐
│           Service Communication Manager                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────┐ │
│  │ L1 Cache     │  │ Connection    │  │ Circuit    │ │
│  │ (QuickLRU)   │  │ Pool          │  │ Breakers   │ │
│  │ - 100 items  │  │ - Min/Max     │  │ - Opossum   │ │
│  │ - Fastest    │  │ - Timeout    │  │ - Recovery  │ │
│  └──────────────┘  └───────────────┘  └────────────┘ │
│         │                  │                  │          │
│         ▼                  ▼                  ▼          │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────┐ │
│  │ L2 Cache     │  │ L3 Cache      │  │ Request    │ │
│  │ (NodeCache)  │  │ (Redis)       │  │ Queue      │ │
│  │ - 60s TTL    │  │ - Persistent  │  │ - Concurr. │ │
│  │ - Medium     │  │ - Shared     │  │ - Limits   │ │
│  └──────────────┘  └───────────────┘  └────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
\`\`\`

## API Endpoints

### Service Calls

- \`POST /services/call\` - Call a service
- \`POST /services/batch\` - Batch service calls
- \`POST /services/:service/cache/invalidate\` - Invalidate cache

### Cache

- \`GET /cache/stats\` - Get cache statistics
- \`GET /cache/:key\` - Get cache entry
- \`PUT /cache/:key\` - Set cache entry
- \`DELETE /cache/:key\` - Invalidate entry
- \`POST /cache/warmup\` - Warm up cache

### Metrics

- \`GET /metrics/communication\` - Communication stats
- \`GET /metrics/pools\` - Pool stats
- \`GET /metrics/all\` - All metrics
`,
  },
};
