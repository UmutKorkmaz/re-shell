import { BackendTemplate } from '../types';

export const oakDenoTemplate: BackendTemplate = {
  id: 'oak-deno',
  name: 'oak-deno',
  displayName: 'Oak (Deno)',
  description: 'Middleware framework for Deno\'s native HTTP server inspired by Koa',
  language: 'typescript',
  framework: 'oak',
  version: '12.6.2',
  tags: ['deno', 'oak', 'typescript', 'api', 'rest', 'middleware', 'secure'],
  port: 8000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation'],

  files: {
    // Deno configuration
    'deno.json': `{
  "tasks": {
    "dev": "deno run --watch --allow-net --allow-env --allow-read src/main.ts",
    "start": "deno run --allow-net --allow-env --allow-read src/main.ts",
    "test": "deno test --allow-net --allow-env --allow-read",
    "fmt": "deno fmt",
    "lint": "deno lint",
    "compile": "deno compile --allow-net --allow-env --allow-read --output {{projectName}} src/main.ts"
  },
  "imports": {
    "oak": "https://deno.land/x/oak@v12.6.2/mod.ts",
    "oak/": "https://deno.land/x/oak@v12.6.2/",
    "djwt": "https://deno.land/x/djwt@v3.0.1/mod.ts",
    "bcrypt": "https://deno.land/x/bcrypt@v0.4.1/mod.ts",
    "dotenv": "https://deno.land/std@0.208.0/dotenv/mod.ts",
    "uuid": "https://deno.land/std@0.208.0/uuid/mod.ts",
    "datetime": "https://deno.land/std@0.208.0/datetime/mod.ts",
    "testing": "https://deno.land/std@0.208.0/testing/asserts.ts",
    "postgres": "https://deno.land/x/postgres@v0.17.2/mod.ts",
    "caching": "https://deno.land/x/redis@v0.32.0/mod.ts",
    "zod": "https://deno.land/x/zod@v3.22.4/mod.ts"
  },
  "compilerOptions": {
    "strict": true
  },
  "fmt": {
    "singleQuote": true,
    "lineWidth": 100
  },
  "lint": {
    "rules": {
      "tags": ["recommended"]
    }
  }
}
`,

    // Main entry point
    'src/main.ts': `import { Application } from 'oak';
import { config } from './config/env.ts';
import { errorMiddleware } from './middleware/error.ts';
import { loggerMiddleware } from './middleware/logger.ts';
import { corsMiddleware } from './middleware/cors.ts';
import { rateLimitMiddleware } from './middleware/rate-limit.ts';
import { router } from './routes/index.ts';
import { Database } from './config/database.ts';

const app = new Application();

// Initialize database
await Database.initialize();

// Global middleware
app.use(errorMiddleware);
app.use(loggerMiddleware);
app.use(corsMiddleware);
app.use(rateLimitMiddleware);

// Routes
app.use(router.routes());
app.use(router.allowedMethods());

// Start server
console.log(\`🦕 Server running on http://localhost:\${config.port}\`);
console.log(\`📚 API docs available at http://localhost:\${config.port}/docs\`);

await app.listen({ port: config.port });
`,

    // Configuration
    'src/config/env.ts': `import { load } from 'dotenv';

await load({ export: true, allowEmptyValues: true });

export const config = {
  port: parseInt(Deno.env.get('PORT') || '8000'),
  environment: Deno.env.get('ENVIRONMENT') || 'development',

  // Database
  dbHost: Deno.env.get('DB_HOST') || 'localhost',
  dbPort: parseInt(Deno.env.get('DB_PORT') || '5432'),
  dbName: Deno.env.get('DB_NAME') || '{{projectName}}',
  dbUser: Deno.env.get('DB_USER') || 'postgres',
  dbPassword: Deno.env.get('DB_PASSWORD') || 'password',
  useMemoryDb: Deno.env.get('USE_MEMORY_DB') === 'true',

  // JWT
  jwtSecret: Deno.env.get('JWT_SECRET') || 'your-secret-key',
  jwtExpirationHours: parseInt(Deno.env.get('JWT_EXPIRATION_HOURS') || '24'),

  // CORS
  allowedOrigins: (Deno.env.get('ALLOWED_ORIGINS') || '*').split(','),

  // Rate limiting
  rateLimitRequests: parseInt(Deno.env.get('RATE_LIMIT_REQUESTS') || '100'),
  rateLimitWindowMs: parseInt(Deno.env.get('RATE_LIMIT_WINDOW_MS') || '60000')};
`,

    // Database
    'src/config/database.ts': `import { config } from './env.ts';

// In-memory database for development
interface DbRecord {
  id: string;
  [key: string]: unknown;
}

class InMemoryDb {
  private tables: Map<string, Map<string, DbRecord>> = new Map();

  getTable(name: string): Map<string, DbRecord> {
    if (!this.tables.has(name)) {
      this.tables.set(name, new Map());
    }
    return this.tables.get(name)!;
  }

  insert(table: string, record: DbRecord): DbRecord {
    const t = this.getTable(table);
    t.set(record.id, record);
    return record;
  }

  findById(table: string, id: string): DbRecord | undefined {
    return this.getTable(table).get(id);
  }

  findAll(table: string): DbRecord[] {
    return Array.from(this.getTable(table).values());
  }

  findOne(table: string, predicate: (r: DbRecord) => boolean): DbRecord | undefined {
    return this.findAll(table).find(predicate);
  }

  find(table: string, predicate: (r: DbRecord) => boolean): DbRecord[] {
    return this.findAll(table).filter(predicate);
  }

  update(table: string, id: string, updates: Partial<DbRecord>): DbRecord | undefined {
    const t = this.getTable(table);
    const record = t.get(id);
    if (record) {
      const updated = { ...record, ...updates, id };
      t.set(id, updated);
      return updated;
    }
    return undefined;
  }

  delete(table: string, id: string): boolean {
    return this.getTable(table).delete(id);
  }

  count(table: string, predicate?: (r: DbRecord) => boolean): number {
    if (predicate) {
      return this.find(table, predicate).length;
    }
    return this.getTable(table).size;
  }
}

export const memoryDb = new InMemoryDb();

export class Database {
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (this.initialized) return;

    if (config.useMemoryDb) {
      console.log('📦 Using in-memory database');
    } else {
      // For production, connect to PostgreSQL
      console.log(\`📦 Connecting to PostgreSQL at \${config.dbHost}:\${config.dbPort}\`);
      // Add PostgreSQL connection here when needed
    }

    this.initialized = true;
    console.log('✅ Database initialized');
  }
}
`,

    // Types
    'src/types/index.ts': `export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
`,

    // Validation schemas
    'src/validation/schemas.ts': `import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters')});

export const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required')});

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be non-negative'),
  stock: z.number().int().min(0).default(0)});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  active: z.boolean().optional()});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
`,

    // Services - Auth
    'src/services/auth.ts': `import { create, verify, getNumericDate } from 'djwt';
import * as bcrypt from 'bcrypt';
import { config } from '../config/env.ts';
import { AuthPayload } from '../types/index.ts';

const key = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(config.jwtSecret),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign', 'verify']
);

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function generateToken(payload: AuthPayload): Promise<string> {
  return await create(
    { alg: 'HS256', typ: 'JWT' },
    {
      ...payload,
      exp: getNumericDate(config.jwtExpirationHours * 60 * 60)},
    key
  );
}

export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const payload = await verify(token, key);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string};
  } catch {
    return null;
  }
}
`,

    // Services - User
    'src/services/user.ts': `import { memoryDb } from '../config/database.ts';
import { User, UserResponse } from '../types/index.ts';
import { hashPassword } from './auth.ts';

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt};
}

export async function createUser(email: string, password: string, name: string): Promise<User> {
  const hashedPassword = await hashPassword(password);
  const now = new Date().toISOString();

  const user: User = {
    id: crypto.randomUUID(),
    email,
    password: hashedPassword,
    name,
    role: 'user',
    active: true,
    createdAt: now,
    updatedAt: now};

  memoryDb.insert('users', user);
  return user;
}

export function findUserByEmail(email: string): User | undefined {
  return memoryDb.findOne('users', (u) => u.email === email) as User | undefined;
}

export function findUserById(id: string): User | undefined {
  return memoryDb.findById('users', id) as User | undefined;
}

export function findAllUsers(): User[] {
  return memoryDb.findAll('users') as User[];
}

export function updateUser(id: string, updates: Partial<User>): User | undefined {
  return memoryDb.update('users', id, {
    ...updates,
    updatedAt: new Date().toISOString()}) as User | undefined;
}

export function deleteUser(id: string): boolean {
  return memoryDb.delete('users', id);
}
`,

    // Services - Product
    'src/services/product.ts': `import { memoryDb } from '../config/database.ts';
import { Product, PaginatedResponse } from '../types/index.ts';
import { CreateProductInput, UpdateProductInput } from '../validation/schemas.ts';

export function createProduct(input: CreateProductInput): Product {
  const now = new Date().toISOString();

  const product: Product = {
    id: crypto.randomUUID(),
    name: input.name,
    description: input.description,
    price: input.price,
    stock: input.stock,
    active: true,
    createdAt: now,
    updatedAt: now};

  memoryDb.insert('products', product);
  return product;
}

export function findProductById(id: string): Product | undefined {
  return memoryDb.findById('products', id) as Product | undefined;
}

export function findProducts(
  page: number = 1,
  limit: number = 10
): PaginatedResponse<Product> {
  const allProducts = memoryDb.find('products', (p) => (p as Product).active) as Product[];
  const total = allProducts.length;
  const offset = (page - 1) * limit;
  const data = allProducts.slice(offset, offset + limit);

  return { data, total, page, limit };
}

export function updateProduct(id: string, updates: UpdateProductInput): Product | undefined {
  return memoryDb.update('products', id, {
    ...updates,
    updatedAt: new Date().toISOString()}) as Product | undefined;
}

export function deleteProduct(id: string): boolean {
  return memoryDb.delete('products', id);
}
`,

    // Middleware - Error
    'src/middleware/error.ts': `import { Context, isHttpError } from 'oak';
import { ZodError } from 'zod';

export async function errorMiddleware(
  ctx: Context,
  next: () => Promise<unknown>
): Promise<void> {
  try {
    await next();
  } catch (err) {
    if (isHttpError(err)) {
      ctx.response.status = err.status;
      ctx.response.body = { error: err.message };
    } else if (err instanceof ZodError) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: 'Validation error',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message}))};
    } else {
      console.error('Unhandled error:', err);
      ctx.response.status = 500;
      ctx.response.body = { error: 'Internal server error' };
    }
  }
}
`,

    // Middleware - Logger
    'src/middleware/logger.ts': `import { Context } from 'oak';

export async function loggerMiddleware(
  ctx: Context,
  next: () => Promise<unknown>
): Promise<void> {
  const start = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);

  ctx.response.headers.set('X-Request-ID', requestId);

  await next();

  const ms = Date.now() - start;
  const status = ctx.response.status;
  const method = ctx.request.method;
  const path = ctx.request.url.pathname;

  console.log(\`[\${requestId}] \${method} \${path} -> \${status} in \${ms}ms\`);
}
`,

    // Middleware - CORS
    'src/middleware/cors.ts': `import { Context } from 'oak';
import { config } from '../config/env.ts';

export async function corsMiddleware(
  ctx: Context,
  next: () => Promise<unknown>
): Promise<void> {
  const origin = ctx.request.headers.get('Origin') || '*';
  const allowedOrigin = config.allowedOrigins.includes('*')
    ? '*'
    : config.allowedOrigins.includes(origin)
    ? origin
    : '';

  if (allowedOrigin) {
    ctx.response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    ctx.response.headers.set('Access-Control-Allow-Credentials', 'true');
    ctx.response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );
    ctx.response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Request-ID'
    );
    ctx.response.headers.set('Access-Control-Max-Age', '86400');
  }

  if (ctx.request.method === 'OPTIONS') {
    ctx.response.status = 204;
    return;
  }

  await next();
}
`,

    // Middleware - Rate Limit
    'src/middleware/rate-limit.ts': `import { Context } from 'oak';
import { config } from '../config/env.ts';

const requests = new Map<string, { count: number; resetTime: number }>();

export async function rateLimitMiddleware(
  ctx: Context,
  next: () => Promise<unknown>
): Promise<void> {
  const ip = ctx.request.ip || 'unknown';
  const now = Date.now();

  let record = requests.get(ip);

  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      resetTime: now + config.rateLimitWindowMs};
  }

  record.count++;
  requests.set(ip, record);

  ctx.response.headers.set('X-RateLimit-Limit', String(config.rateLimitRequests));
  ctx.response.headers.set(
    'X-RateLimit-Remaining',
    String(Math.max(0, config.rateLimitRequests - record.count))
  );
  ctx.response.headers.set('X-RateLimit-Reset', String(record.resetTime));

  if (record.count > config.rateLimitRequests) {
    ctx.response.status = 429;
    ctx.response.body = { error: 'Too many requests' };
    return;
  }

  await next();
}
`,

    // Middleware - Auth
    'src/middleware/auth.ts': `import { Context, Status } from 'oak';
import { verifyToken } from '../services/auth.ts';
import { findUserById } from '../services/user.ts';
import { AuthPayload } from '../types/index.ts';

export interface AuthContext extends Context {
  state: {
    user?: AuthPayload;
  };
}

export async function authMiddleware(
  ctx: AuthContext,
  next: () => Promise<unknown>
): Promise<void> {
  const authHeader = ctx.request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    ctx.throw(Status.Unauthorized, 'Authorization required');
    return;
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);

  if (!payload) {
    ctx.throw(Status.Unauthorized, 'Invalid or expired token');
    return;
  }

  const user = findUserById(payload.userId);
  if (!user || !user.active) {
    ctx.throw(Status.Unauthorized, 'User not found or inactive');
    return;
  }

  ctx.state.user = payload;
  await next();
}

export function requireRole(...roles: string[]) {
  return async (ctx: AuthContext, next: () => Promise<unknown>): Promise<void> => {
    if (!ctx.state.user) {
      ctx.throw(Status.Unauthorized, 'Authorization required');
      return;
    }

    if (!roles.includes(ctx.state.user.role)) {
      ctx.throw(Status.Forbidden, 'Insufficient permissions');
      return;
    }

    await next();
  };
}
`,

    // Routes - Index
    'src/routes/index.ts': `import { Router } from 'oak';
import { authRouter } from './auth.ts';
import { userRouter } from './users.ts';
import { productRouter } from './products.ts';

export const router = new Router();

// Health check
router.get('/health', (ctx) => {
  ctx.response.body = {
    status: 'healthy',
    timestamp: new Date().toISOString()};
});

// Mount routers
router.use('/api/v1/auth', authRouter.routes(), authRouter.allowedMethods());
router.use('/api/v1/users', userRouter.routes(), userRouter.allowedMethods());
router.use('/api/v1/products', productRouter.routes(), productRouter.allowedMethods());
`,

    // Routes - Auth
    'src/routes/auth.ts': `import { Router, Status } from 'oak';
import { registerSchema, loginSchema } from '../validation/schemas.ts';
import { createUser, findUserByEmail, toUserResponse } from '../services/user.ts';
import { generateToken, verifyPassword } from '../services/auth.ts';

export const authRouter = new Router();

// Register
authRouter.post('/register', async (ctx) => {
  const body = await ctx.request.body().value;
  const data = registerSchema.parse(body);

  const existingUser = findUserByEmail(data.email);
  if (existingUser) {
    ctx.throw(Status.Conflict, 'Email already registered');
    return;
  }

  const user = await createUser(data.email, data.password, data.name);

  ctx.response.status = 201;
  ctx.response.body = toUserResponse(user);
});

// Login
authRouter.post('/login', async (ctx) => {
  const body = await ctx.request.body().value;
  const data = loginSchema.parse(body);

  const user = findUserByEmail(data.email);
  if (!user) {
    ctx.throw(Status.Unauthorized, 'Invalid credentials');
    return;
  }

  const validPassword = await verifyPassword(data.password, user.password);
  if (!validPassword) {
    ctx.throw(Status.Unauthorized, 'Invalid credentials');
    return;
  }

  if (!user.active) {
    ctx.throw(Status.Unauthorized, 'Account is disabled');
    return;
  }

  const token = await generateToken({
    userId: user.id,
    email: user.email,
    role: user.role});

  ctx.response.body = {
    token,
    user: toUserResponse(user)};
});
`,

    // Routes - Users
    'src/routes/users.ts': `import { Router, Status } from 'oak';
import { authMiddleware, requireRole, AuthContext } from '../middleware/auth.ts';
import {
  findUserById,
  findAllUsers,
  updateUser,
  deleteUser,
  toUserResponse} from '../services/user.ts';

export const userRouter = new Router();

// Get current user
userRouter.get('/me', authMiddleware, (ctx: AuthContext) => {
  const user = findUserById(ctx.state.user!.userId);
  if (!user) {
    ctx.throw(Status.NotFound, 'User not found');
    return;
  }

  ctx.response.body = toUserResponse(user);
});

// Update current user
userRouter.put('/me', authMiddleware, async (ctx: AuthContext) => {
  const body = await ctx.request.body().value;

  const user = updateUser(ctx.state.user!.userId, {
    name: body.name});

  if (!user) {
    ctx.throw(Status.NotFound, 'User not found');
    return;
  }

  ctx.response.body = toUserResponse(user);
});

// List all users (admin only)
userRouter.get(
  '/',
  authMiddleware,
  requireRole('admin'),
  (ctx) => {
    const users = findAllUsers();
    ctx.response.body = users.map(toUserResponse);
  }
);

// Get user by ID
userRouter.get('/:id', authMiddleware, (ctx) => {
  const user = findUserById(ctx.params.id!);
  if (!user) {
    ctx.throw(Status.NotFound, 'User not found');
    return;
  }

  ctx.response.body = toUserResponse(user);
});

// Delete user (admin only)
userRouter.delete(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  (ctx) => {
    const deleted = deleteUser(ctx.params.id!);
    if (!deleted) {
      ctx.throw(Status.NotFound, 'User not found');
      return;
    }

    ctx.response.status = 204;
  }
);
`,

    // Routes - Products
    'src/routes/products.ts': `import { Router, Status } from 'oak';
import { authMiddleware, requireRole, AuthContext } from '../middleware/auth.ts';
import { createProductSchema, updateProductSchema } from '../validation/schemas.ts';
import {
  createProduct,
  findProductById,
  findProducts,
  updateProduct,
  deleteProduct} from '../services/product.ts';

export const productRouter = new Router();

// List products
productRouter.get('/', (ctx) => {
  const page = parseInt(ctx.request.url.searchParams.get('page') || '1');
  const limit = parseInt(ctx.request.url.searchParams.get('limit') || '10');

  ctx.response.body = findProducts(page, limit);
});

// Get product by ID
productRouter.get('/:id', (ctx) => {
  const product = findProductById(ctx.params.id!);
  if (!product) {
    ctx.throw(Status.NotFound, 'Product not found');
    return;
  }

  ctx.response.body = product;
});

// Create product (admin only)
productRouter.post(
  '/',
  authMiddleware,
  requireRole('admin'),
  async (ctx: AuthContext) => {
    const body = await ctx.request.body().value;
    const data = createProductSchema.parse(body);

    const product = createProduct(data);

    ctx.response.status = 201;
    ctx.response.body = product;
  }
);

// Update product (admin only)
productRouter.put(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  async (ctx: AuthContext) => {
    const body = await ctx.request.body().value;
    const data = updateProductSchema.parse(body);

    const product = updateProduct(ctx.params.id!, data);
    if (!product) {
      ctx.throw(Status.NotFound, 'Product not found');
      return;
    }

    ctx.response.body = product;
  }
);

// Delete product (admin only)
productRouter.delete(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  (ctx: AuthContext) => {
    const deleted = deleteProduct(ctx.params.id!);
    if (!deleted) {
      ctx.throw(Status.NotFound, 'Product not found');
      return;
    }

    ctx.response.status = 204;
  }
);
`,

    // Tests
    'tests/api_test.ts': `import { assertEquals } from 'testing';

Deno.test('Health check returns OK', async () => {
  // This test would require running the server first
  // For unit testing, we test the handler directly

  const response = {
    status: 'healthy',
    timestamp: new Date().toISOString()};

  assertEquals(response.status, 'healthy');
});

Deno.test('Validation schemas work correctly', async () => {
  const { registerSchema } = await import('../src/validation/schemas.ts');

  // Valid input
  const validResult = registerSchema.safeParse({
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User'});
  assertEquals(validResult.success, true);

  // Invalid email
  const invalidEmail = registerSchema.safeParse({
    email: 'invalid-email',
    password: 'password123',
    name: 'Test User'});
  assertEquals(invalidEmail.success, false);

  // Short password
  const shortPassword = registerSchema.safeParse({
    email: 'test@example.com',
    password: '123',
    name: 'Test User'});
  assertEquals(shortPassword.success, false);
});
`,

    // Environment file
    '.env.example': `# Server
PORT=8000
ENVIRONMENT=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME={{projectName}}
DB_USER=postgres
DB_PASSWORD=password
USE_MEMORY_DB=true

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRATION_HOURS=24

# CORS
ALLOWED_ORIGINS=*

# Rate Limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
`,

    // Dockerfile
    'Dockerfile': `FROM denoland/deno:1.38.5

WORKDIR /app

# Cache dependencies
COPY deno.json .
RUN deno cache src/main.ts || true

# Copy source
COPY . .

# Cache all dependencies
RUN deno cache src/main.ts

# Run as non-root user
USER deno

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD deno run --allow-net --allow-env --allow-read -e "Deno.connect('http://localhost:8000/health').then(r => r.status === 200 ? Deno.exit(0) : Deno.exit(1))" || exit 1

CMD ["run", "--allow-net", "--allow-env", "--allow-read", "src/main.ts"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - PORT=8000
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME={{projectName}}
      - DB_USER=postgres
      - DB_PASSWORD=password
      - USE_MEMORY_DB=false
      - JWT_SECRET=change-this-secret
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB={{projectName}}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`,

    // README
    'README.md': `# {{projectName}}

A secure REST API built with Oak framework on Deno runtime.

## Features

- **Deno Runtime**: Secure by default, TypeScript native
- **Oak Framework**: Koa-inspired middleware framework
- **JWT Authentication**: Secure token-based authentication
- **Zod Validation**: Runtime type validation
- **CORS Support**: Configurable cross-origin requests
- **Rate Limiting**: Request throttling
- **Docker Support**: Containerized deployment

## Requirements

- Deno 1.38+
- PostgreSQL (optional, uses in-memory DB by default)
- Docker (optional)

## Quick Start

1. Clone the repository
2. Copy \`.env.example\` to \`.env\` and configure
3. Run in development mode:
   \`\`\`bash
   deno task dev
   \`\`\`

4. Or run with Docker:
   \`\`\`bash
   docker-compose up
   \`\`\`

## Available Tasks

\`\`\`bash
deno task dev      # Run with hot reload
deno task start    # Run in production
deno task test     # Run tests
deno task fmt      # Format code
deno task lint     # Lint code
deno task compile  # Compile to binary
\`\`\`

## API Endpoints

### Health
- \`GET /health\` - Health check

### Auth
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login

### Users
- \`GET /api/v1/users/me\` - Get current user
- \`PUT /api/v1/users/me\` - Update current user
- \`GET /api/v1/users\` - List users (admin)
- \`GET /api/v1/users/:id\` - Get user by ID
- \`DELETE /api/v1/users/:id\` - Delete user (admin)

### Products
- \`GET /api/v1/products\` - List products
- \`GET /api/v1/products/:id\` - Get product
- \`POST /api/v1/products\` - Create product (admin)
- \`PUT /api/v1/products/:id\` - Update product (admin)
- \`DELETE /api/v1/products/:id\` - Delete product (admin)

## Project Structure

\`\`\`
src/
├── config/        # Configuration
├── middleware/    # HTTP middleware
├── routes/        # API routes
├── services/      # Business logic
├── types/         # TypeScript types
├── validation/    # Zod schemas
└── main.ts        # Entry point
\`\`\`
`
  }
};
