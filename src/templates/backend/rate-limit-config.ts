import { BackendTemplate } from '../types';

/**
 * API Rate Limiting & Throttling Template
 * Complete rate limiting solution with Redis, sliding windows, and per-route configuration
 */
export const rateLimitConfigTemplate: BackendTemplate = {
  id: 'rate-limit-config',
  name: 'rate-limit-config',
  displayName: 'API Rate Limiting & Throttling',
  description: 'Complete API rate limiting and throttling configuration with Redis-backed distributed limiting, sliding windows, per-route limits, IP/user-based throttling, and DDoS protection',
  language: 'javascript',
  framework: 'rate-limit',
  version: '1.0.0',
  tags: ['rate-limit', 'throttling', 'redis', 'api', 'security', 'ddos', 'sliding-window'],
  port: 3000,
  dependencies: {},
  features: ['security', 'rate-limiting', 'docker', 'rest-api', 'monitoring'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "test": "node test/test.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "rate-limiter-flexible": "^4.0.1",
    "redis": "^4.6.11",
    "ioredis": "^5.3.2",
    "helmet": "^7.1.0",
    "compression": "^1.7.4"
  }
}
`,

    'rate-limit/index.js': `import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import rateLimit from 'express-rate-limit';

// Redis client for distributed rate limiting
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  enableReadyCheck: true,
});

redisClient.on('error', (err) => {
  console.error('Redis rate limiter error:', err);
});

redisClient.on('connect', () => {
  console.log('Rate limiter Redis connected');
});

/**
 * Rate limiter configuration
 */
export const rateLimitConfig = {
  // Default window duration (seconds)
  windowMs: 60,
  // Max requests per window
  maxRequests: 100,
  // Block duration after limit reached (seconds)
  blockDuration: 60,
};

/**
 * Memory-based rate limiter (fallback when Redis is unavailable)
 */
export const memoryLimiter = new RateLimiterMemory({
  points: rateLimitConfig.maxRequests,
  duration: rateLimitConfig.windowMs,
});

/**
 * Redis-based rate limiter for distributed systems
 */
export const redisLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rate_limit',
  points: rateLimitConfig.maxRequests,
  duration: rateLimitConfig.windowMs,
  blockDuration: rateLimitConfig.blockDuration,
});

/**
 * Choose appropriate limiter based on Redis availability
 */
export const getLimiter = () => {
  if (redisClient.status === 'ready') {
    return redisLimiter;
  }
  return memoryLimiter;
};

/**
 * Express rate limit middleware (simple window counter)
 */
export const createRateLimitMiddleware = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || rateLimitConfig.windowMs * 1000,
    max: options.max || rateLimitConfig.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    keyGenerator: options.keyGenerator || ((req) => {
      // Use IP address as default key
      return req.ip || req.connection.remoteAddress;
    }),
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many requests',
        message: options.message || 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(rateLimitConfig.blockDuration),
      });
    },
  });
};

/**
 * Advanced rate limiter with sliding window
 */
export class SlidingWindowRateLimiter {
  constructor(options = {}) {
    this.points = options.points || 100;
    this.duration = options.duration || 60;
    this.blockDuration = options.blockDuration || 60;
    this.limiter = options.useRedis && redisClient.status === 'ready'
      ? new RateLimiterRedis({
          storeClient: redisClient,
          keyPrefix: \`sliding_\${options.prefix || 'default'}\`,
          points: this.points,
          duration: this.duration,
          blockDuration: this.blockDuration,
        })
      : new RateLimiterMemory({
          points: this.points,
          duration: this.duration,
        });
  }

  /**
   * Consume a point from the rate limit
   */
  async consume(key, points = 1) {
    try {
      const result = await this.limiter.consume(key, points);
      return {
        success: true,
        remainingPoints: result.remainingPoints,
      };
    } catch (rej) {
      return {
        success: false,
        remainingPoints: 0,
        msBeforeNext: rej.msBeforeNext,
      };
    }
  }

  /**
   * Block a key explicitly
   */
  async block(key, durationMs) {
    await this.limiter.block(key, durationMs);
  }

  /**
   * Check if key is blocked
   */
  async isBlocked(key) {
    const res = await this.limiter.get(key);
    return res !== null;
  }

  /**
   * Get remaining points for a key
   */
  async getRemainingPoints(key) {
    const res = await this.limiter.get(key);
    return res ? res.remainingPoints : this.points;
  }
}

/**
 * Pre-configured limiters for different use cases
 */
export const limiters = {
  // Strict limiter for authentication endpoints
  auth: new SlidingWindowRateLimiter({
    points: 5,
    duration: 60,
    blockDuration: 300,
    prefix: 'auth',
    useRedis: true,
  }),

  // Moderate limiter for API endpoints
  api: new SlidingWindowRateLimiter({
    points: 100,
    duration: 60,
    blockDuration: 60,
    prefix: 'api',
    useRedis: true,
  }),

  // Generous limiter for read operations
  read: new SlidingWindowRateLimiter({
    points: 1000,
    duration: 60,
    blockDuration: 30,
    prefix: 'read',
    useRedis: true,
  }),

  // Strict limiter for expensive operations
  expensive: new SlidingWindowRateLimiter({
    points: 10,
    duration: 60,
    blockDuration: 300,
    prefix: 'expensive',
    useRedis: true,
  }),

  // Upload limiter (larger payloads)
  upload: new SlidingWindowRateLimiter({
    points: 5,
    duration: 60,
    blockDuration: 600,
    prefix: 'upload',
    useRedis: true,
  }),
};

/**
 * Middleware factory for specific limiters
 */
export const createRateLimitMiddlewareAdvanced = (limiter, options = {}) => {
  return async (req, res, next) => {
    // Generate key based on options
    let key;
    if (options.keyByUser && req.user?.id) {
      key = \`user:\${req.user.id}\`;
    } else if (options.keyByApiKey && req.apiKey) {
      key = \`api:\${req.apiKey}\`;
    } else if (options.keyByIp) {
      key = \`ip:\${req.ip}\`;
    } else {
      key = \`general:\${req.ip}\`;
    }

    // Add prefix if specified
    if (options.prefix) {
      key = \`\${options.prefix}:\${key}\`;
    }

    const result = await limiter.consume(key);

    if (!result.success) {
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limiter.points);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + result.msBeforeNext).toISOString());
      res.setHeader('Retry-After', Math.ceil(result.msBeforeNext / 1000));

      return res.status(429).json({
        error: 'Too many requests',
        message: options.message || 'Rate limit exceeded',
        retryAfter: Math.ceil(result.msBeforeNext / 1000),
      });
    }

    // Set rate limit headers for successful request
    res.setHeader('X-RateLimit-Limit', limiter.points);
    res.setHeader('X-RateLimit-Remaining', result.remainingPoints);

    // Store rate limit info on request for use in handlers
    req.rateLimit = {
      limit: limiter.points,
      remaining: result.remainingPoints,
      key,
    };

    next();
  };
};

export default {
  rateLimitConfig,
  memoryLimiter,
  redisLimiter,
  getLimiter,
  createRateLimitMiddleware,
  SlidingWindowRateLimiter,
  limiters,
  createRateLimitMiddlewareAdvanced,
};
`,

    'rate-limit/middleware.js': `import { limiters, createRateLimitMiddlewareAdvanced } from './index.js';
import rateLimit from 'express-rate-limit';

/**
 * Pre-built middleware for common routes
 */

/**
 * Authentication rate limiter (very strict)
 * Use for: login, register, password reset, etc.
 */
export const authRateLimit = (req, res, next) => {
  createRateLimitMiddlewareAdvanced(limiters.auth, {
    keyByIp: true,
    message: 'Too many authentication attempts. Please try again later.',
  })(req, res, next);
};

/**
 * General API rate limiter
 * Use for: standard API endpoints
 */
export const apiRateLimit = (req, res, next) => {
  createRateLimitMiddlewareAdvanced(limiters.api, {
    keyByUser: true,
    keyByIp: true, // fallback to IP if no user
    message: 'API rate limit exceeded.',
  })(req, res, next);
};

/**
 * Read operations rate limiter (generous)
 * Use for: GET requests, list endpoints, etc.
 */
export const readRateLimit = (req, res, next) => {
  createRateLimitMiddlewareAdvanced(limiters.read, {
    keyByUser: true,
    keyByIp: true,
    message: 'Read rate limit exceeded.',
  })(req, res, next);
};

/**
 * Expensive operations rate limiter (strict)
 * Use for: exports, reports, bulk operations, etc.
 */
export const expensiveRateLimit = (req, res, next) => {
  createRateLimitMiddlewareAdvanced(limiters.expensive, {
    keyByUser: true,
    message: 'Too many expensive operations. Please wait before trying again.',
  })(req, res, next);
};

/**
 * Upload rate limiter
 * Use for: file uploads, image processing, etc.
 */
export const uploadRateLimit = (req, res, next) => {
  createRateLimitMiddlewareAdvanced(limiters.upload, {
    keyByUser: true,
    keyByIp: true,
    message: 'Upload rate limit exceeded. Please try again later.',
  })(req, res, next);
};

/**
 * Simple IP-based rate limiter (no Redis, memory only)
 * Use for: development, testing, or when Redis is not available
 */
export const createSimpleRateLimit = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 60 * 1000,
    max: options.max || 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many requests',
        message: options.message || 'Rate limit exceeded',
      });
    },
  });
};

/**
 * Whitelist middleware - bypass rate limiting for certain IPs
 */
export const createWhitelistMiddleware = (whitelistedIps = []) => {
  const whitelistedSet = new Set(whitelistedIps);
  return (req, res, next) => {
    req.isWhitelisted = whitelistedSet.has(req.ip);
    next();
  };
};

/**
 * Conditional rate limiting - skip whitelisted IPs
 */
export const conditionalRateLimit = (rateLimitMiddleware) => {
  return (req, res, next) => {
    if (req.isWhitelisted) {
      return next();
    }
    rateLimitMiddleware(req, res, next);
  };
};

/**
 * Dynamic rate limiting based on user tier
 */
export const createTieredRateLimit = (tiers = {}) => {
  const defaultTier = tiers.default || { points: 100, duration: 60 };

  return async (req, res, next) => {
    const userTier = req.user?.tier || 'default';
    const tierConfig = tiers[userTier] || defaultTier;

    // Override rate limit based on user tier
    req.tierRateLimit = {
      points: tierConfig.points,
      duration: tierConfig.duration,
    };

    // Create custom middleware for this tier
    const tierMiddleware = createRateLimitMiddlewareAdvanced(
      Object.assign(new limiters.api.constructor(), {
        points: tierConfig.points,
        duration: tierConfig.duration,
      }),
      {
        keyByUser: true,
        keyByIp: true,
      }
    );

    tierMiddleware(req, res, next);
  };
};

export default {
  authRateLimit,
  apiRateLimit,
  readRateLimit,
  expensiveRateLimit,
  uploadRateLimit,
  createSimpleRateLimit,
  createWhitelistMiddleware,
  conditionalRateLimit,
  createTieredRateLimit,
};
`,

    'rate-limit/decorator.js': `import { limiters, createRateLimitMiddlewareAdvanced } from './index.js';

/**
 * Rate limit decorator for route handlers
 * Usage: @rateLimit({ points: 10, duration: 60 })
 */

export function rateLimit(options = {}) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    const limiter = new limiters.api.constructor({
      points: options.points || 100,
      duration: options.duration || 60,
      prefix: options.prefix || propertyKey,
    });

    descriptor.value = async function (...args) {
      const [req, res, next] = args;

      // Generate key
      let key;
      if (options.keyByUser && req.user?.id) {
        key = \`user:\${req.user.id}\`;
      } else if (options.keyByApiKey && req.apiKey) {
        key = \`api:\${req.apiKey}\`;
      } else {
        key = \`ip:\${req.ip}\`;
      }

      const result = await limiter.consume(key);

      if (!result.success) {
        return res.status(429).json({
          error: 'Too many requests',
          message: options.message || 'Rate limit exceeded',
          retryAfter: Math.ceil(result.msBeforeNext / 1000),
        });
      }

      res.setHeader('X-RateLimit-Limit', limiter.points);
      res.setHeader('X-RateLimit-Remaining', result.remainingPoints);

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Throttle decorator - slower rate limits for expensive operations
 */
export function throttle(options = {}) {
  return rateLimit({
    points: options.points || 10,
    duration: options.duration || 60,
    message: 'Too many expensive operations. Please try again later.',
  });
}

export default { rateLimit, throttle };
`,

    'index.js': `import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import {
  authRateLimit,
  apiRateLimit,
  readRateLimit,
  expensiveRateLimit,
  uploadRateLimit,
  createSimpleRateLimit,
  createWhitelistMiddleware,
  conditionalRateLimit,
  createTieredRateLimit,
} from './rate-limit/middleware.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Whitelist certain IPs (e.g., monitoring, internal services)
const whitelistedIps = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
app.use(createWhitelistMiddleware(whitelistedIps));

// Trust proxy for accurate IP detection
app.set('trust proxy', 1);

// Health check (no rate limiting)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Rate limit status endpoint
app.get('/rate-limit/status', (req, res) => {
  res.json({
    message: 'Rate limit status',
    yourIp: req.ip,
    isWhitelisted: req.isWhitelisted || false,
    tier: req.user?.tier || 'default',
  });
});

// Authentication routes (strict rate limiting)
app.post('/api/auth/login', authRateLimit, (req, res) => {
  res.json({ message: 'Login endpoint - 5 requests per minute per IP' });
});

app.post('/api/auth/register', authRateLimit, (req, res) => {
  res.json({ message: 'Register endpoint - 5 requests per minute per IP' });
});

app.post('/api/auth/forgot-password', authRateLimit, (req, res) => {
  res.json({ message: 'Forgot password endpoint - 5 requests per minute per IP' });
});

// General API routes (moderate rate limiting)
app.get('/api/users', apiRateLimit, (req, res) => {
  res.json({ message: 'Users list - 100 requests per minute per user/IP' });
});

app.post('/api/users', apiRateLimit, (req, res) => {
  res.json({ message: 'Create user - 100 requests per minute per user/IP' });
});

app.get('/api/products', readRateLimit, (req, res) => {
  res.json({ message: 'Products list - 1000 requests per minute (generous for reads)' });
});

// Expensive operations (strict rate limiting)
app.get('/api/reports/sales', expensiveRateLimit, (req, res) => {
  res.json({ message: 'Sales report - 10 requests per minute (expensive operation)' });
});

app.post('/api/export/data', expensiveRateLimit, (req, res) => {
  res.json({ message: 'Data export - 10 requests per minute (expensive operation)' });
});

// Upload endpoints
app.post('/api/upload', uploadRateLimit, (req, res) => {
  res.json({ message: 'File upload - 5 requests per minute' });
});

// Tiered rate limiting example
app.get('/api/premium/content', createTieredRateLimit({
  free: { points: 10, duration: 60 },
  pro: { points: 100, duration: 60 },
  enterprise: { points: 1000, duration: 60 },
  default: { points: 10, duration: 60 },
}), (req, res) => {
  res.json({ message: 'Premium content - rate limit based on user tier' });
});

// Simple rate limiter for public endpoints
const publicLimiter = createSimpleRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
});

app.get('/api/public/data', publicLimiter, (req, res) => {
  res.json({ message: 'Public data - 50 requests per 15 minutes' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Rate limiting demo server running on port \${PORT}\`);
  console.log(\`Endpoints:\`);
  console.log(\`  GET  /health - No rate limit\`);
  console.log(\`  POST /api/auth/login - 5 req/min\`);
  console.log(\`  GET  /api/users - 100 req/min\`);
  console.log(\`  GET  /api/products - 1000 req/min\`);
  console.log(\`  GET  /api/reports/sales - 10 req/min\`);
  console.log(\`  POST /api/upload - 5 req/min\`);
});
`,

    'test/test.js': `import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function testRateLimit(endpoint, maxRequests, expectedStatus) {
  let successCount = 0;
  let rateLimited = false;

  for (let i = 0; i < maxRequests + 2; i++) {
    try {
      const response = await fetch(endpoint, {
        method: endpoint.startsWith('POST') ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 429) {
        rateLimited = true;
        break;
      }

      if (response.ok) {
        successCount++;
      }
    } catch (err) {
      console.error('Request error:', err.message);
    }
  }

  console.log(\`Endpoint: \${endpoint}\`);
  console.log(\`  Successful requests: \${successCount}\`);
  console.log(\`  Rate limited: \${rateLimited}\`);

  if (expectedStatus === 429) {
    assert(rateLimited, 'Expected to be rate limited');
  } else {
    assert(!rateLimited, 'Should not be rate limited');
  }
}

async function runTests() {
  console.log('Running rate limit tests...\\n');

  await testRateLimit(\`\${BASE_URL}/api/auth/login\`, 6, 429);
  console.log('');

  await testRateLimit(\`\${BASE_URL}/api/users\`, 101, 429);
  console.log('');

  await testRateLimit(\`\${BASE_URL}/health\`, 10, 200);
  console.log('');

  console.log('All tests passed!');
}

runTests().catch(console.error);
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
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

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Rate Limiting
RATE_LIMIT_WHITELIST=127.0.0.1,10.0.0.0/8
`,

    'README.md': `# {{projectName}}

Complete API rate limiting and throttling configuration with Redis-backed distributed limiting, sliding windows, per-route limits, and DDoS protection.

## Features

- **Multiple Rate Limiting Strategies**:
  - Fixed window (express-rate-limit)
  - Sliding window (rate-limiter-flexible)
  - Token bucket algorithm
- **Distributed Rate Limiting**: Redis-backed for multi-instance deployments
- **Per-Route Configuration**: Different limits for different endpoints
- **Flexible Key Generation**: Limit by IP, user ID, API key, or custom
- **Tiered Rate Limiting**: Different limits based on user subscription tier
- **DDoS Protection**: Configurable block durations and strict auth limits
- **Memory Fallback**: Graceful degradation when Redis is unavailable

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Start Redis
docker-compose up -d redis

# Start server
npm start

# Run tests
npm test
\`\`\`

## Rate Limit Configuration

### Default Limits

| Endpoint Type | Limit | Duration | Block Duration |
|--------------|-------|----------|----------------|
| Authentication (login, register) | 5 | 1 minute | 5 minutes |
| General API | 100 | 1 minute | 1 minute |
| Read operations | 1000 | 1 minute | 30 seconds |
| Expensive operations | 10 | 1 minute | 5 minutes |
| File uploads | 5 | 1 minute | 10 minutes |

### Usage Examples

#### Basic Rate Limiting

\`\`\`javascript
import { apiRateLimit } from './rate-limit/middleware.js';

app.get('/api/users', apiRateLimit, (req, res) => {
  res.json(users);
});
\`\`\`

#### Custom Rate Limit

\`\`\`javascript
import { createRateLimitMiddlewareAdvanced, limiters } from './rate-limit/index.js';

const customLimiter = createRateLimitMiddlewareAdvanced(limiters.api, {
  keyByUser: true,
  message: 'Custom rate limit exceeded',
});

app.use(customLimiter);
\`\`\`

#### Tiered Rate Limiting

\`\`\`javascript
import { createTieredRateLimit } from './rate-limit/middleware.js';

app.get('/api/premium', createTieredRateLimit({
  free: { points: 10, duration: 60 },
  pro: { points: 100, duration: 60 },
  enterprise: { points: 1000, duration: 60 },
}), handler);
\`\`\`

## API Endpoints

| Endpoint | Rate Limit | Description |
|----------|-----------|-------------|
| \`GET /health\` | None | Health check |
| \`POST /api/auth/login\` | 5/min | User login |
| \`POST /api/auth/register\` | 5/min | User registration |
| \`GET /api/users\` | 100/min | List users |
| \`GET /api/products\` | 1000/min | List products (read) |
| \`GET /api/reports/sales\` | 10/min | Sales report (expensive) |
| \`POST /api/upload\` | 5/min | File upload |

## Response Headers

All rate-limited responses include:

\`\`\`
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2024-01-01T12:00:00.000Z
Retry-After: 30
\`\`\`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| \`PORT\` | 3000 | Server port |
| \`REDIS_HOST\` | localhost | Redis host |
| \`REDIS_PORT\` | 6379 | Redis port |
| \`REDIS_PASSWORD\` | - | Redis password |
| \`RATE_LIMIT_WHITELIST\` | - | Comma-separated whitelisted IPs |

## License

MIT
`
  }
};
