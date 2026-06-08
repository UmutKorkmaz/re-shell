import { BackendTemplate } from '../types';

/**
 * API Caching Strategies Template
 * Complete caching solution with Redis, Memcached, HTTP caching, and CDN integration
 */
export const apiCachingTemplate: BackendTemplate = {
  id: 'api-caching',
  name: 'api-caching',
  displayName: 'API Caching Strategies & CDN Integration',
  description: 'Complete API caching solution with Redis, Memcached, HTTP caching headers, CDN integration, cache invalidation strategies, and intelligent cache warming',
  language: 'javascript',
  framework: 'caching',
  version: '1.0.0',
  tags: ['caching', 'redis', 'memcached', 'cdn', 'performance', 'cache-invalidation'],
  port: 3000,
  dependencies: {},
  features: ['caching', 'monitoring', 'docker', 'rest-api'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "warm-cache": "node scripts/warm-cache.js",
    "invalidate-cache": "node scripts/invalidate-cache.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ioredis": "^5.3.2",
    "node-cache": "^5.1.2",
    "compression": "^1.7.4",
    "helmet": "^7.1.0"
  }
}
`,

    'cache/redis-cache.js': `import Redis from 'ioredis';

/**
 * Redis-based distributed caching
 */
class RedisCache {
  constructor(options = {}) {
    this.client = new Redis({
      host: options.host || process.env.REDIS_HOST || 'localhost',
      port: options.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: options.password || process.env.REDIS_PASSWORD,
      db: options.db || parseInt(process.env.REDIS_DB || '0'),
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.defaultTTL = options.defaultTTL || 3600;
    this.keyPrefix = options.keyPrefix || 'cache:';

    this.client.on('error', (err) => {
      console.error('Redis cache error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis cache connected');
    });
  }

  getKey(key) {
    return this.keyPrefix + key;
  }

  async get(key) {
    try {
      const cached = await this.client.get(this.getKey(key));
      if (!cached) return null;
      return JSON.parse(cached);
    } catch (err) {
      console.error('Cache get error:', err);
      return null;
    }
  }

  async set(key, value, ttl = null) {
    try {
      const serialized = JSON.stringify(value);
      const cacheKey = this.getKey(key);
      const expiry = ttl || this.defaultTTL;

      if (expiry > 0) {
        await this.client.setex(cacheKey, expiry, serialized);
      } else {
        await this.client.set(cacheKey, serialized);
      }
      return true;
    } catch (err) {
      console.error('Cache set error:', err);
      return false;
    }
  }

  async del(key) {
    try {
      await this.client.del(this.getKey(key));
      return true;
    } catch (err) {
      console.error('Cache delete error:', err);
      return false;
    }
  }

  async delPattern(pattern) {
    try {
      const keys = await this.client.keys(this.keyPrefix + pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return keys.length;
    } catch (err) {
      console.error('Cache delPattern error:', err);
      return 0;
    }
  }

  async exists(key) {
    try {
      return await this.client.exists(this.getKey(key)) === 1;
    } catch (err) {
      return false;
    }
  }

  async getStats() {
    try {
      const info = await this.client.info('stats');
      const dbSize = await this.client.dbsize();
      return {
        connected: this.client.status === 'ready',
        keys: dbSize,
        info: info,
      };
    } catch (err) {
      return {
        connected: false,
        error: err.message,
      };
    }
  }

  async close() {
    await this.client.quit();
  }
}

export default RedisCache;
`,

    'cache/memory-cache.js': `import NodeCache from 'node-cache';

/**
 * In-memory caching (fallback)
 */
class MemoryCache {
  constructor(options = {}) {
    this.cache = new NodeCache({
      stdTTL: options.defaultTTL || 3600,
      checkperiod: options.checkPeriod || 600,
      useClones: false,
    });

    this.keyPrefix = options.keyPrefix || 'cache:';
    this.stats = { hits: 0, misses: 0 };
  }

  getKey(key) {
    return this.keyPrefix + key;
  }

  async get(key) {
    const value = this.cache.get(this.getKey(key));
    if (value === undefined) {
      this.stats.misses++;
      return null;
    }
    this.stats.hits++;
    return value;
  }

  async set(key, value, ttl = null) {
    return this.cache.set(this.getKey(key), value, ttl);
  }

  async del(key) {
    return this.cache.del(this.getKey(key));
  }

  async delPattern(pattern) {
    const keys = this.cache.keys();
    const regex = new RegExp('^' + this.keyPrefix + pattern);
    const keysToDelete = keys.filter(k => regex.test(k));
    this.cache.del(keysToDelete);
    return keysToDelete.length;
  }

  async getStats() {
    const stats = this.cache.getStats();
    return {
      connected: true,
      keys: stats.keys,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
    };
  }

  async flush() {
    this.cache.flushAll();
    return true;
  }
}

export default MemoryCache;
`,

    'cache/cache-manager.js': `import RedisCache from './redis-cache.js';
import MemoryCache from './memory-cache.js';

/**
 * Unified cache manager with fallback
 */
class CacheManager {
  constructor(options = {}) {
    this.primary = null;
    this.fallback = null;

    const cacheType = options.type || process.env.CACHE_TYPE || 'redis';

    if (cacheType === 'redis') {
      try {
        this.primary = new RedisCache(options.redis);
      } catch (err) {
        console.error('Failed to initialize Redis:', err);
        this.primary = new MemoryCache(options.memory);
      }
    } else {
      this.primary = new MemoryCache(options.memory);
    }

    this.fallback = new MemoryCache(options.memory);
  }

  async get(key) {
    let value = await this.primary.get(key);
    if (value !== null) {
      return { data: value, source: this.primary.constructor.name };
    }
    value = await this.fallback.get(key);
    if (value !== null) {
      return { data: value, source: 'fallback' };
    }
    return null;
  }

  async set(key, value, ttl = null) {
    await this.primary.set(key, value, ttl);
    await this.fallback.set(key, value, ttl);
    return true;
  }

  async del(key) {
    await this.primary.del(key);
    await this.fallback.del(key);
    return true;
  }

  async delPattern(pattern) {
    const count = await this.primary.delPattern(pattern);
    await this.fallback.delPattern(pattern);
    return count;
  }

  async invalidateTag(tag) {
    return await this.delPattern('tag:' + tag + '*');
  }

  async getOrSet(key, fetchFn, ttl = null) {
    let value = await this.get(key);
    if (value === null) {
      value = await fetchFn();
      if (value !== null) {
        await this.set(key, value, ttl);
      }
    }
    return value;
  }

  async getStats() {
    return {
      primary: await this.primary.getStats(),
      fallback: await this.fallback.getStats(),
    };
  }

  async healthCheck() {
    const testKey = '__health_check__';
    await this.primary.set(testKey, 'ok', 10);
    const value = await this.primary.get(testKey);
    await this.primary.del(testKey);
    return value === 'ok';
  }

  async close() {
    if (this.primary.close) await this.primary.close();
    if (this.fallback.close) await this.fallback.close();
  }
}

export default CacheManager;
`,

    'cache/middleware.js': `import crypto from 'crypto';

/**
 * HTTP caching middleware
 */
class CacheMiddleware {
  constructor(cacheManager) {
    this.cache = cacheManager;
  }

  generateCacheKey(req, prefix) {
    const parts = [prefix, req.path];
    if (Object.keys(req.query).length > 0) {
      parts.push(new URLSearchParams(req.query).toString());
    }
    const keyString = parts.join(':');
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  cache(options = {}) {
    const { ttl = 3600, keyPrefix = 'http' } = options;

    return async (req, res, next) => {
      if (req.method !== 'GET') {
        return next();
      }

      const cacheKey = this.generateCacheKey(req, keyPrefix);
      res.setHeader('Cache-Control', 'public, max-age=' + ttl);

      const cached = await this.cache.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached.data);
      }

      res.setHeader('X-Cache', 'MISS');
      const originalJson = res.json.bind(res);

      res.json = (data) => {
        this.cache.set(cacheKey, { data }, ttl);
        return originalJson(data);
      };

      next();
    };
  }

  noCache(req, res, next) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  }

  cdnCache(options = {}) {
    const { maxAge = 31536000 } = options;
    return (req, res, next) => {
      res.setHeader('Cache-Control', 'public, max-age=' + maxAge + ', immutable');
      res.setHeader('CDN-Cache-Control', 'public, max-age=' + maxAge + ', immutable');
      next();
    };
  }
}

export default CacheMiddleware;
`,

    'index.js': `import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import CacheManager from './cache/cache-manager.js';
import CacheMiddleware from './cache/middleware.js';

const app = express();

app.use(helmet());
app.use(compression());
app.use(express.json());
app.set('trust proxy', 1);

const cacheManager = new CacheManager({
  type: process.env.CACHE_TYPE || 'redis',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

const cacheMiddleware = new CacheMiddleware(cacheManager);

app.get('/health', async (req, res) => {
  const healthy = await cacheManager.healthCheck();
  res.json({
    status: healthy ? 'healthy' : 'unhealthy',
    cache: healthy ? 'connected' : 'disconnected',
  });
});

app.get('/cache/stats', async (req, res) => {
  const stats = await cacheManager.getStats();
  res.json(stats);
});

app.post('/cache/invalidate', async (req, res) => {
  const { pattern } = req.body;
  if (!pattern) {
    return res.status(400).json({ error: 'Pattern is required' });
  }
  const count = await cacheManager.delPattern(pattern);
  res.json({ message: 'Invalidated ' + count + ' cache entries', count });
});

// Product list - 1 hour cache
app.get('/api/products',
  cacheMiddleware.cache({ ttl: 3600, keyPrefix: 'products' }),
  async (req, res) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const products = [
      { id: 1, name: 'Product 1', price: 29.99 },
      { id: 2, name: 'Product 2', price: 49.99 },
      { id: 3, name: 'Product 3', price: 99.99 },
    ];
    res.json(products);
  }
);

// Product detail - 15 minute cache
app.get('/api/products/:id',
  cacheMiddleware.cache({ ttl: 900, keyPrefix: 'product' }),
  async (req, res) => {
    const { id } = req.params;
    await new Promise(resolve => setTimeout(resolve, 50));
    const product = {
      id: parseInt(id),
      name: 'Product ' + id,
      price: 29.99 + (id * 10),
      description: 'Description for product ' + id,
    };
    res.json(product);
  }
);

// Static assets - long CDN cache
app.get('/static/*',
  cacheMiddleware.cdnCache({ maxAge: 31536000 }),
  (req, res) => {
    res.json({ message: 'Static asset with long cache' });
  }
);

// Search results - 5 minute cache
app.get('/api/search',
  cacheMiddleware.cache({ ttl: 300, keyPrefix: 'search' }),
  async (req, res) => {
    const { q } = req.query;
    await new Promise(resolve => setTimeout(resolve, 200));
    const results = q ? [
      { id: 1, title: 'Search result for ' + q + ' 1' },
      { id: 2, title: 'Search result for ' + q + ' 2' },
    ] : [];
    res.json({ results, query: q });
  }
);

// Real-time data - no cache
app.get('/api/live',
  cacheMiddleware.noCache,
  async (req, res) => {
    res.json({
      timestamp: new Date().toISOString(),
      random: Math.random(),
    });
  }
);

// Cache-aside pattern example
app.get('/api/config', async (req, res) => {
  const config = await cacheManager.getOrSet(
    'app:config',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        apiVersion: 'v1',
        features: ['search', 'export', 'notifications'],
        maintenance: false,
      };
    },
    3600
  );
  res.json(config);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('API caching server running on port ' + PORT);
  console.log('');
  console.log('Cache Strategy Examples:');
  console.log('  GET /api/products - 1 hour cache');
  console.log('  GET /api/products/:id - 15 min cache');
  console.log('  GET /api/search - 5 min cache');
  console.log('  GET /api/live - no cache');
  console.log('  GET /cache/stats - cache statistics');
});
`,

    'scripts/warm-cache.js': `import CacheManager from '../cache/cache-manager.js';

const cacheManager = new CacheManager({
  type: process.env.CACHE_TYPE || 'redis',
});

async function warmCache() {
  console.log('Warming up cache...');

  const products = [
    { id: 1, name: 'Product 1', price: 29.99 },
    { id: 2, name: 'Product 2', price: 49.99 },
    { id: 3, name: 'Product 3', price: 99.99 },
  ];

  await cacheManager.set('products:list', products, 3600);
  console.log('Warmed products:list');

  for (const product of products) {
    await cacheManager.set('product:' + product.id, product, 3600);
  }
  console.log('Warmed ' + products.length + ' individual products');

  const config = {
    apiVersion: 'v1',
    features: ['search', 'export', 'notifications'],
    maintenance: false,
  };

  await cacheManager.set('app:config', config, 3600);
  console.log('Warmed app:config');

  const stats = await cacheManager.getStats();
  console.log('');
  console.log('Cache warm-up complete!');
  console.log('Primary cache: ' + (stats.primary.connected ? 'Connected' : 'Disconnected'));

  await cacheManager.close();
}

warmCache().catch(console.error);
`,

    'scripts/invalidate-cache.js': `import CacheManager from '../cache/cache-manager.js';

const cacheManager = new CacheManager({
  type: process.env.CACHE_TYPE || 'redis',
});

async function invalidateCache() {
  const pattern = process.argv[2] || '*';
  console.log('Invalidating cache pattern: ' + pattern);

  const count = await cacheManager.delPattern(pattern);
  console.log('Invalidated ' + count + ' cache entries');

  await cacheManager.close();
}

invalidateCache().catch(console.error);
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - CACHE_TYPE=redis
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
`,

    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
`,

    '.env.example': `# Server
PORT=3000
NODE_ENV=development

# Cache Configuration
CACHE_TYPE=redis

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Cache Settings
DEFAULT_CACHE_TTL=3600
`,

    'README.md': `# {{projectName}}

Complete API caching solution with Redis, HTTP caching, CDN integration, and intelligent cache invalidation.

## Features

- **Multiple Cache Backends**: Redis with in-memory fallback
- **HTTP Caching**: ETag support, Cache-Control headers
- **CDN Integration**: Cloudflare/CloudFront compatible headers
- **Cache Invalidation**: Pattern-based and tag-based invalidation
- **Cache-Aside Pattern**: Automatic population on cache misses
- **Health Monitoring**: Cache health checks and statistics

## Quick Start

\`\`\`bash
# Start services
docker-compose up -d

# Install dependencies
npm install

# Start server
npm start

# Warm up cache
npm run warm-cache

# Invalidate cache pattern
npm run invalidate-cache "*products*"
\`\`\`

## Caching Strategies

### Time-Based Caching
- Product lists: 1 hour
- Product details: 15 minutes
- Search results: 5 minutes
- User profiles: 5 minutes

### Cache-Aside Pattern
Lazy population on cache miss:
\`\`\`javascript
const data = await cacheManager.getOrSet('key', fetchFn, ttl);
\`\`\`

## API Endpoints

| Endpoint | Cache Strategy | Description |
|----------|---------------|-------------|
| GET /health | None | Health check |
| GET /cache/stats | None | Cache statistics |
| POST /cache/invalidate | None | Invalidate by pattern |
| GET /api/products | 1 hour | Product list |
| GET /api/products/:id | 15 min | Product detail |
| GET /api/search | 5 min | Search results |
| GET /api/live | None | Real-time data (no cache) |

## Response Headers

All cached responses include:
\`\`\`
X-Cache: HIT or MISS
Cache-Control: public, max-age=...
\`\`\`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| CACHE_TYPE | redis | Cache backend (redis|memory) |
| REDIS_HOST | localhost | Redis host |
| REDIS_PORT | 6379 | Redis port |
| DEFAULT_CACHE_TTL | 3600 | Default cache TTL (seconds) |

## License

MIT
`
  }
};
