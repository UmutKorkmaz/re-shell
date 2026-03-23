import { BackendTemplate } from '../types';

export const honoTemplate: BackendTemplate = {
  id: 'hono',
  name: 'hono',
  displayName: 'Hono (Bun)',
  description: 'Ultra-fast, lightweight web framework for Bun with edge computing capabilities',
  language: 'typescript',
  framework: 'hono',
  version: '1.0.0',
  tags: ['bun', 'hono', 'typescript', 'api', 'rest', 'fast', 'edge', 'lightweight'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'rate-limiting'],

  files: {
    // Package.json
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "start": "bun run src/index.ts",
    "test": "bun test",
    "lint": "eslint src",
    "format": "prettier --write src"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/zod-validator": "^0.2.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.3.0",
    "eslint": "^8.56.0",
    "prettier": "^3.1.0",
    "bun-types": "latest"
  }
}
`,

    // TypeScript config
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noEmit": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
`,

    // ESLint config
    '.eslintrc.json': `{
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "rules": {
    "no-unused-vars": "warn",
    "no-console": "off"
  },
  "env": {
    "browser": true,
    "bun": true
  }
}
`,

    // Prettier config
    '.prettierrc': `{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
`,

    // Main entry point
    'src/index.ts': `import { serve } from 'bun';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { config } from './config';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { rateLimiter } from './middleware/rate-limiter';
import { db } from './db';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { productRoutes } from './routes/products';

// Initialize database
await db.initialize();

const app = new Hono<{ Variables: { userId: string } }>();

// Global middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: config.corsOrigin,
  credentials: true}));

// Error handler
app.use('*', errorHandler);

// Rate limiting
app.use('*', rateLimiter);

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'});
});

// API routes
app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/users', userRoutes);
app.route('/api/v1/products', productRoutes);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: '{{projectName}}',
    version: '1.0.0',
    description: 'REST API built with Hono on Bun',
    endpoints: {
      health: '/health',
      api: '/api/v1',
      docs: '/api/v1/docs'}});
});

// Start server
const port = config.port;
console.log(\`🚀 Server running at http://localhost:\${port}\`);
console.log(\`📚 API docs at http://localhost:\${port}/api/v1/docs\`);

export default {
  port,
  fetch: app.fetch};
`,

    // Configuration
    'src/config.ts': `const config = {
  port: Number(process.env.PORT) || 3000,
  environment: process.env.NODE_ENV || 'development',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'change-this-secret-in-production',
  jwtExpiration: process.env.JWT_EXPIRATION || '7d',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Rate limiting
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 100,
  rateLimitWindow: Number(process.env.RATE_LIMIT_WINDOW) || 60000, // 1 minute

  // Database
  dbPath: process.env.DB_PATH || './data/db.json'} as const;

export { config };
`,

    // Database (in-memory for simplicity)
    'src/db.ts': `import { config } from './config';
import { promises as fs } from 'fs';
import { join } from 'path';

interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  createdAt: string;
  updatedAt: string;
}

interface Database {
  users: User[];
  products: Product[];
}

class InMemoryDatabase {
  private data: Database = {
    users: [],
    products: []};

  async initialize() {
    console.log('📦 Using in-memory database');
    console.log('✅ Database initialized');

    // Create admin user if no users exist
    if (this.data.users.length === 0) {
      const adminPassword = await Bun.password.hash('admin123');
      this.data.users.push({
        id: '1',
        email: 'admin@example.com',
        password: adminPassword,
        name: 'Admin User',
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()});
      console.log('👤 Default admin user created (admin@example.com / admin123)');
    }

    // Add sample products
    if (this.data.products.length === 0) {
      this.data.products.push(
        {
          id: '1',
          name: 'Sample Product 1',
          description: 'This is a sample product',
          price: 29.99,
          stock: 100,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()},
        {
          id: '2',
          name: 'Sample Product 2',
          description: 'Another sample product',
          price: 49.99,
          stock: 50,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()}
      );
      console.log('📦 Sample products created');
    }
  }

  // Users
  getUsers(): User[] {
    return this.data.users.map(u => ({ ...u, password: '' }));
  }

  getUserById(id: string): User | undefined {
    const user = this.data.users.find(u => u.id === id);
    return user ? { ...user, password: '' } : undefined;
  }

  getUserByEmail(email: string): User | undefined {
    return this.data.users.find(u => u.email === email);
  }

  createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): User {
    const newUser: User = {
      ...user,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()};
    this.data.users.push(newUser);
    return newUser;
  }

  updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): User | undefined {
    const index = this.data.users.findIndex(u => u.id === id);
    if (index === -1) return undefined;

    this.data.users[index] = {
      ...this.data.users[index],
      ...updates,
      updatedAt: new Date().toISOString()};
    return { ...this.data.users[index], password: '' };
  }

  deleteUser(id: string): boolean {
    const index = this.data.users.findIndex(u => u.id === id);
    if (index === -1) return false;
    this.data.users.splice(index, 1);
    return true;
  }

  // Products
  getProducts(): Product[] {
    return this.data.products;
  }

  getProductById(id: string): Product | undefined {
    return this.data.products.find(p => p.id === id);
  }

  createProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Product {
    const newProduct: Product = {
      ...product,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()};
    this.data.products.push(newProduct);
    return newProduct;
  }

  updateProduct(id: string, updates: Partial<Omit<Product, 'id' | 'createdAt'>>): Product | undefined {
    const index = this.data.products.findIndex(p => p.id === id);
    if (index === -1) return undefined;

    this.data.products[index] = {
      ...this.data.products[index],
      ...updates,
      updatedAt: new Date().toISOString()};
    return this.data.products[index];
  }

  deleteProduct(id: string): boolean {
    const index = this.data.products.findIndex(p => p.id === id);
    if (index === -1) return false;
    this.data.products.splice(index, 1);
    return true;
  }
}

export const db = new InMemoryDatabase();
`,

    // Middleware - Auth
    'src/middleware/auth.ts': `import { MiddlewareHandler } from 'hono';
import { verify } from 'hono/jwt';
import { config } from '../config';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const payload = await verify(token, config.jwtSecret);
    c.set('userId', payload.sub as string);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
};

export const adminMiddleware: MiddlewareHandler = async (c, next) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { db } = await import('../db');
  const user = db.getUserById(userId);

  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden - Admin only' }, 403);
  }

  await next();
};
`,

    // Middleware - Error Handler
    'src/middleware/error-handler.ts': `import { MiddlewareHandler } from 'hono';

export const errorHandler: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (err) {
    console.error('Error:', err);
    return c.json(
      {
        error: err instanceof Error ? err.message : 'Internal server error'},
      500
    );
  }
};
`,

    // Middleware - Rate Limiter
    'src/middleware/rate-limiter.ts': `import { MiddlewareHandler } from 'hono';
import { config } from '../config';

const requests = new Map<string, { count: number; resetTime: number }>();

export const rateLimiter: MiddlewareHandler = async (c, next) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  const now = Date.now();

  let record = requests.get(ip);

  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      resetTime: now + config.rateLimitWindow};
    requests.set(ip, record);
  }

  record.count++;

  c.header('X-RateLimit-Limit', String(config.rateLimitMax));
  c.header('X-RateLimit-Remaining', String(Math.max(0, config.rateLimitMax - record.count)));
  c.header('X-RateLimit-Reset', String(record.resetTime));

  if (record.count > config.rateLimitMax) {
    return c.json({ error: 'Too many requests' }, 429);
  }

  await next();
};
`,

    // Middleware - Validation
    'src/middleware/validation.ts': `import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters')});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')});

export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be non-negative'),
  stock: z.number().min(0, 'Stock must be non-negative').default(0)});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  stock: z.number().min(0).optional()});

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional()});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
`,

    // Routes - Auth
    'src/routes/auth.ts': `import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { sign } from 'hono/jwt';
import { db } from '../db';
import { config } from '../config';
import { registerSchema, loginSchema } from '../middleware/validation';

const authRoutes = new Hono();

// Register
authRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const body = c.req.valid('json');

  // Check if user exists
  const existingUser = db.getUserByEmail(body.email);
  if (existingUser) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  // Hash password
  const hashedPassword = await Bun.password.hash(body.password);

  // Create user
  const user = db.createUser({
    email: body.email,
    password: hashedPassword,
    name: body.name,
    role: 'user'});

  // Generate token
  const token = await sign(
    { sub: user.id, email: user.email, role: user.role },
    config.jwtSecret
  );

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role}}, 201);
});

// Login
authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const body = c.req.valid('json');

  // Find user
  const user = db.getUserByEmail(body.email);
  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  // Verify password
  const validPassword = await Bun.password.verify(body.password, user.password);
  if (!validPassword) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  // Generate token
  const token = await sign(
    { sub: user.id, email: user.email, role: user.role },
    config.jwtSecret
  );

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role}});
});

export { authRoutes };
`,

    // Routes - Users
    'src/routes/users.ts': `import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { updateProfileSchema } from '../middleware/validation';
import { db } from '../db';

const userRoutes = new Hono();

// Get current user
userRoutes.get('/me', authMiddleware, (c) => {
  const userId = c.get('userId');
  const user = db.getUserById(userId);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});

// Update current user
userRoutes.put('/me', authMiddleware, zValidator('json', updateProfileSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const user = db.updateUser(userId, body);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});

// List all users (admin only)
userRoutes.get('/', adminMiddleware, (c) => {
  const users = db.getUsers();
  return c.json({ users, count: users.length });
});

// Get user by ID
userRoutes.get('/:id', authMiddleware, (c) => {
  const { id } = c.req.param();
  const user = db.getUserById(id);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});

// Delete user (admin only)
userRoutes.delete('/:id', adminMiddleware, (c) => {
  const { id } = c.req.param();
  const deleted = db.deleteUser(id);

  if (!deleted) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.newResponse(null, 204);
});

export { userRoutes };
`,

    // Routes - Products
    'src/routes/products.ts': `import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { createProductSchema, updateProductSchema } from '../middleware/validation';
import { db } from '../db';

const productRoutes = new Hono();

// List products (public)
productRoutes.get('/', (c) => {
  const products = db.getProducts();
  return c.json({
    products,
    count: products.length});
});

// Get product by ID (public)
productRoutes.get('/:id', (c) => {
  const { id } = c.req.param();
  const product = db.getProductById(id);

  if (!product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  return c.json({ product });
});

// Create product (admin only)
productRoutes.post('/', adminMiddleware, zValidator('json', createProductSchema), async (c) => {
  const body = c.req.valid('json');
  const product = db.createProduct(body);

  return c.json({ product }, 201);
});

// Update product (admin only)
productRoutes.put('/:id', adminMiddleware, zValidator('json', updateProductSchema), async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const product = db.updateProduct(id, body);

  if (!product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  return c.json({ product });
});

// Delete product (admin only)
productRoutes.delete('/:id', adminMiddleware, (c) => {
  const { id } = c.req.param();
  const deleted = db.deleteProduct(id);

  if (!deleted) {
    return c.json({ error: 'Product not found' }, 404);
  }

  return c.newResponse(null, 204);
});

export { productRoutes };
`,

    // Environment file
    '.env.example': `# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=change-this-secret-in-production
JWT_EXPIRATION=7d

# CORS
CORS_ORIGIN=*

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000

# Database
DB_PATH=./data/db.json
`,

    // Dockerfile
    'Dockerfile': `FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser
USER appuser

EXPOSE 3000

CMD ["bun", "run", "start"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - NODE_ENV=production
      - JWT_SECRET=change-this-secret-in-production
    restart: unless-stopped
`,

    // Tests
    'src/index.test.ts': `import { describe, expect, it, beforeAll } from 'bun:test';

describe('{{projectName}} API', () => {
  const baseUrl = 'http://localhost:3000';
  let authToken: string;

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await fetch(\`\${baseUrl}/health\`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('healthy');
    });
  });

  describe('Authentication', () => {
    it('should register a new user', async () => {
      const response = await fetch(\`\${baseUrl}/api/v1/auth/register\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: \`test-\${Date.now()}@example.com\`,
          password: 'password123',
          name: 'Test User'})});

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.token).toBeDefined();
      expect(body.user.email).toBeDefined();
      authToken = body.token;
    });

    it('should login existing user', async () => {
      const response = await fetch(\`\${baseUrl}/api/v1/auth/login\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'admin123'})});

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.token).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const response = await fetch(\`\${baseUrl}/api/v1/auth/login\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'wrongpassword'})});

      expect(response.status).toBe(401);
    });
  });

  describe('Products', () => {
    it('should list all products', async () => {
      const response = await fetch(\`\${baseUrl}/api/v1/products\`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.products).toBeInstanceOf(Array);
      expect(body.count).toBeGreaterThan(0);
    });

    it('should get product by ID', async () => {
      const response = await fetch(\`\${baseUrl}/api/v1/products/1\`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.product).toBeDefined();
      expect(body.product.id).toBe('1');
    });
  });
});
`,

    // README
    'README.md': `# {{projectName}}

A blazing fast REST API built with Hono on Bun runtime.

## Features

- **Hono Framework**: Ultra-fast, lightweight web framework (15x smaller than Express)
- **Bun Runtime**: Fastest JavaScript runtime with native TypeScript support
- **JWT Authentication**: Secure token-based authentication
- **Zod Validation**: Type-safe request/response validation
- **Rate Limiting**: Built-in request throttling
- **CORS Support**: Cross-origin resource sharing
- **Docker Ready**: Containerized deployment
- **Hot Reload**: Development with instant refresh

## Performance

Hono is one of the fastest web frameworks:
- ~3x faster than Express
- ~2x faster than Fastify
- Only 15x smaller bundle size
- Edge runtime compatible (Cloudflare Workers, Vercel Edge, etc.)

## Requirements

- Bun 1.0+

## Quick Start

1. Install dependencies:
   \`\`\`bash
   bun install
   \`\`\`

2. Copy environment file:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

3. Run in development mode:
   \`\`\`bash
   bun run dev
   \`\`\`

4. Or run in production:
   \`\`\`bash
   bun run start
   \`\`\`

## Available Scripts

\`\`\`bash
bun run dev      # Run with hot reload
bun run start    # Run in production
bun run test     # Run tests
bun run lint     # Lint code
bun run format   # Format code
\`\`\`

## API Endpoints

### Health
- \`GET /health\` - Health check

### Authentication
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login user

### Users
- \`GET /api/v1/users/me\` - Get current user (auth required)
- \`PUT /api/v1/users/me\` - Update current user (auth required)
- \`GET /api/v1/users\` - List all users (admin only)
- \`GET /api/v1/users/:id\` - Get user by ID (auth required)
- \`DELETE /api/v1/users/:id\` - Delete user (admin only)

### Products
- \`GET /api/v1/products\` - List all products (public)
- \`GET /api/v1/products/:id\` - Get product by ID (public)
- \`POST /api/v1/products\` - Create product (admin only)
- \`PUT /api/v1/products/:id\` - Update product (admin only)
- \`DELETE /api/v1/products/:id\` - Delete product (admin only)

## Default Credentials

A default admin user is created automatically:
- Email: \`admin@example.com\`
- Password: \`admin123\`

## Project Structure

\`\`\`
src/
├── config.ts              # Configuration
├── db.ts                  # Database layer
├── index.ts               # Entry point
├── index.test.ts          # Tests
├── middleware/
│   ├── auth.ts           # Authentication
│   ├── error-handler.ts  # Error handling
│   ├── rate-limiter.ts   # Rate limiting
│   └── validation.ts     # Zod schemas
└── routes/
    ├── auth.ts           # Auth endpoints
    ├── users.ts          # User endpoints
    └── products.ts       # Product endpoints
\`\`\`

## Docker

Build and run with Docker:

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 3000:3000 {{projectName}}
\`\`\`

Or use Docker Compose:

\`\`\`bash
docker-compose up
\`\`\`

## License

MIT
`
  }
};
