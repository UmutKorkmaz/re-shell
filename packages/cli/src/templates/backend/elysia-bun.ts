import { BackendTemplate } from '../types';

export const elysiaBunTemplate: BackendTemplate = {
  id: 'elysia-bun',
  name: 'elysia-bun',
  displayName: 'Elysia (Bun)',
  description: 'Type-safe, high-performance web framework for Bun runtime',
  language: 'typescript',
  framework: 'elysia',
  version: '1.0.3',
  tags: ['bun', 'elysia', 'typescript', 'api', 'rest', 'fast', 'type-safe'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'swagger'],

  files: {
    // Package.json
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "test": "bun test",
    "lint": "bunx @biomejs/biome check src",
    "format": "bunx @biomejs/biome format --write src",
    "build": "bun build src/index.ts --compile --outfile={{projectName}}"
  },
  "dependencies": {
    "elysia": "^1.0.3",
    "@elysiajs/cors": "^1.0.2",
    "@elysiajs/jwt": "^1.0.2",
    "@elysiajs/swagger": "^1.0.3",
    "@elysiajs/bearer": "^1.0.2",
    "@sinclair/typebox": "^0.32.5"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.4.1",
    "@types/bun": "latest",
    "typescript": "^5.3.3"
  }
}
`,

    // TypeScript config
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
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

    // Biome config
    'biome.json': `{
  "$schema": "https://biomejs.dev/schemas/1.4.1/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  }
}
`,

    // Main entry point
    'src/index.ts': `import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { config } from './config/env';
import { authPlugin } from './plugins/auth';
import { loggerPlugin } from './plugins/logger';
import { rateLimitPlugin } from './plugins/rate-limit';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { productRoutes } from './routes/products';
import { db } from './config/database';

// Initialize database
await db.initialize();

const app = new Elysia()
  // Swagger documentation
  .use(swagger({
    documentation: {
      info: {
        title: '{{projectName}} API',
        version: '1.0.0',
        description: 'REST API built with Elysia on Bun'},
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'users', description: 'User management' },
        { name: 'products', description: 'Product management' }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'}}}}}))
  // CORS
  .use(cors({
    origin: config.allowedOrigins.includes('*') ? true : config.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']}))
  // Plugins
  .use(loggerPlugin)
  .use(rateLimitPlugin)
  .use(authPlugin)
  // Health check
  .get('/health', () => ({
    status: 'healthy',
    timestamp: new Date().toISOString()}), {
    detail: {
      tags: ['health'],
      summary: 'Health check'}})
  // API routes
  .group('/api/v1', (app) =>
    app
      .use(authRoutes)
      .use(userRoutes)
      .use(productRoutes)
  )
  .listen(config.port);

console.log(\`🦊 Server running at http://localhost:\${app.server?.port}\`);
console.log(\`📚 Swagger docs at http://localhost:\${app.server?.port}/swagger\`);

export type App = typeof app;
`,

    // Configuration
    'src/config/env.ts': `export const config = {
  port: Number(process.env.PORT) || 3000,
  environment: process.env.ENVIRONMENT || 'development',

  // Database
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: Number(process.env.DB_PORT) || 5432,
  dbName: process.env.DB_NAME || '{{projectName}}',
  dbUser: process.env.DB_USER || 'postgres',
  dbPassword: process.env.DB_PASSWORD || 'password',
  useMemoryDb: process.env.USE_MEMORY_DB === 'true',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpirationHours: Number(process.env.JWT_EXPIRATION_HOURS) || 24,

  // CORS
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '*').split(','),

  // Rate limiting
  rateLimitRequests: Number(process.env.RATE_LIMIT_REQUESTS) || 100,
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000} as const;
`,

    // Database
    'src/config/database.ts': `import { config } from './env';

interface DbRecord {
  id: string;
  [key: string]: unknown;
}

class InMemoryDb {
  private tables = new Map<string, Map<string, DbRecord>>();

  getTable(name: string): Map<string, DbRecord> {
    if (!this.tables.has(name)) {
      this.tables.set(name, new Map());
    }
    return this.tables.get(name)!;
  }

  insert<T extends DbRecord>(table: string, record: T): T {
    this.getTable(table).set(record.id, record);
    return record;
  }

  findById<T extends DbRecord>(table: string, id: string): T | undefined {
    return this.getTable(table).get(id) as T | undefined;
  }

  findAll<T extends DbRecord>(table: string): T[] {
    return Array.from(this.getTable(table).values()) as T[];
  }

  findOne<T extends DbRecord>(table: string, predicate: (r: T) => boolean): T | undefined {
    return this.findAll<T>(table).find(predicate);
  }

  find<T extends DbRecord>(table: string, predicate: (r: T) => boolean): T[] {
    return this.findAll<T>(table).filter(predicate);
  }

  update<T extends DbRecord>(table: string, id: string, updates: Partial<T>): T | undefined {
    const record = this.findById<T>(table, id);
    if (record) {
      const updated = { ...record, ...updates, id } as T;
      this.getTable(table).set(id, updated);
      return updated;
    }
    return undefined;
  }

  delete(table: string, id: string): boolean {
    return this.getTable(table).delete(id);
  }

  count<T extends DbRecord>(table: string, predicate?: (r: T) => boolean): number {
    if (predicate) {
      return this.find(table, predicate).length;
    }
    return this.getTable(table).size;
  }
}

const memoryDb = new InMemoryDb();

export const db = {
  async initialize() {
    if (config.useMemoryDb) {
      console.log('📦 Using in-memory database');
    } else {
      console.log(\`📦 Would connect to PostgreSQL at \${config.dbHost}:\${config.dbPort}\`);
    }
    console.log('✅ Database initialized');
  },

  users: {
    insert: <T extends DbRecord>(record: T) => memoryDb.insert('users', record),
    findById: <T extends DbRecord>(id: string) => memoryDb.findById<T>('users', id),
    findByEmail: <T extends DbRecord>(email: string) =>
      memoryDb.findOne<T>('users', (r) => r.email === email),
    findAll: <T extends DbRecord>() => memoryDb.findAll<T>('users'),
    update: <T extends DbRecord>(id: string, updates: Partial<T>) =>
      memoryDb.update<T>('users', id, updates),
    delete: (id: string) => memoryDb.delete('users', id)},

  products: {
    insert: <T extends DbRecord>(record: T) => memoryDb.insert('products', record),
    findById: <T extends DbRecord>(id: string) => memoryDb.findById<T>('products', id),
    findAll: <T extends DbRecord>() => memoryDb.findAll<T>('products'),
    find: <T extends DbRecord>(predicate: (r: T) => boolean) =>
      memoryDb.find<T>('products', predicate),
    count: <T extends DbRecord>(predicate?: (r: T) => boolean) =>
      memoryDb.count<T>('products', predicate),
    update: <T extends DbRecord>(id: string, updates: Partial<T>) =>
      memoryDb.update<T>('products', id, updates),
    delete: (id: string) => memoryDb.delete('products', id)}};
`,

    // Types
    'src/types/index.ts': `import { t, Static } from 'elysia';

export const UserSchema = t.Object({
  id: t.String(),
  email: t.String({ format: 'email' }),
  password: t.String(),
  name: t.String(),
  role: t.String(),
  active: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String()});

export const UserResponseSchema = t.Object({
  id: t.String(),
  email: t.String({ format: 'email' }),
  name: t.String(),
  role: t.String(),
  active: t.Boolean(),
  createdAt: t.String()});

export const ProductSchema = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.Optional(t.String()),
  price: t.Number(),
  stock: t.Number(),
  active: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String()});

export const RegisterSchema = t.Object({
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 6 }),
  name: t.String({ minLength: 2 })});

export const LoginSchema = t.Object({
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 1 })});

export const CreateProductSchema = t.Object({
  name: t.String({ minLength: 1 }),
  description: t.Optional(t.String()),
  price: t.Number({ minimum: 0 }),
  stock: t.Number({ minimum: 0, default: 0 })});

export const UpdateProductSchema = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  description: t.Optional(t.String()),
  price: t.Optional(t.Number({ minimum: 0 })),
  stock: t.Optional(t.Number({ minimum: 0 })),
  active: t.Optional(t.Boolean())});

export const PaginatedResponseSchema = <T extends object>(itemSchema: T) =>
  t.Object({
    data: t.Array(itemSchema),
    total: t.Number(),
    page: t.Number(),
    limit: t.Number()});

export type User = Static<typeof UserSchema>;
export type UserResponse = Static<typeof UserResponseSchema>;
export type Product = Static<typeof ProductSchema>;
export type RegisterInput = Static<typeof RegisterSchema>;
export type LoginInput = Static<typeof LoginSchema>;
export type CreateProductInput = Static<typeof CreateProductSchema>;
export type UpdateProductInput = Static<typeof UpdateProductSchema>;
`,

    // Auth Plugin
    'src/plugins/auth.ts': `import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { bearer } from '@elysiajs/bearer';
import { config } from '../config/env';
import { db } from '../config/database';
import type { User } from '../types';

export const authPlugin = new Elysia({ name: 'auth' })
  .use(jwt({
    name: 'jwt',
    secret: config.jwtSecret,
    exp: \`\${config.jwtExpirationHours}h\`}))
  .use(bearer())
  .derive(async ({ jwt, bearer }) => {
    if (!bearer) {
      return { user: null };
    }

    const payload = await jwt.verify(bearer);
    if (!payload) {
      return { user: null };
    }

    const user = db.users.findById<User>(payload.userId as string);
    if (!user || !user.active) {
      return { user: null };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role}};
  })
  .macro(({ onBeforeHandle }) => ({
    isAuth(enabled: boolean) {
      if (!enabled) return;

      onBeforeHandle(({ user, error }) => {
        if (!user) {
          return error(401, { error: 'Unauthorized' });
        }
      });
    },
    hasRole(roles: string[]) {
      onBeforeHandle(({ user, error }) => {
        if (!user) {
          return error(401, { error: 'Unauthorized' });
        }
        if (!roles.includes(user.role)) {
          return error(403, { error: 'Forbidden' });
        }
      });
    }}));
`,

    // Logger Plugin
    'src/plugins/logger.ts': `import { Elysia } from 'elysia';

export const loggerPlugin = new Elysia({ name: 'logger' })
  .derive(() => {
    return {
      requestId: crypto.randomUUID().slice(0, 8)};
  })
  .onRequest(({ request, requestId }) => {
    console.log(\`[\${requestId}] -> \${request.method} \${new URL(request.url).pathname}\`);
  })
  .onAfterResponse(({ request, requestId, response }) => {
    const status = response instanceof Response ? response.status : 200;
    console.log(\`[\${requestId}] <- \${request.method} \${new URL(request.url).pathname} \${status}\`);
  })
  .onError(({ requestId, error }) => {
    console.error(\`[\${requestId}] Error: \${error.message}\`);
  });
`,

    // Rate Limit Plugin
    'src/plugins/rate-limit.ts': `import { Elysia } from 'elysia';
import { config } from '../config/env';

const requests = new Map<string, { count: number; resetTime: number }>();

export const rateLimitPlugin = new Elysia({ name: 'rate-limit' })
  .onBeforeHandle(({ request, error, set }) => {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();

    let record = requests.get(ip);

    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + config.rateLimitWindowMs};
    }

    record.count++;
    requests.set(ip, record);

    set.headers['X-RateLimit-Limit'] = String(config.rateLimitRequests);
    set.headers['X-RateLimit-Remaining'] = String(
      Math.max(0, config.rateLimitRequests - record.count)
    );
    set.headers['X-RateLimit-Reset'] = String(record.resetTime);

    if (record.count > config.rateLimitRequests) {
      return error(429, { error: 'Too many requests' });
    }
  });
`,

    // Routes - Auth
    'src/routes/auth.ts': `import { Elysia } from 'elysia';
import { RegisterSchema, LoginSchema, UserResponseSchema } from '../types';
import type { User, UserResponse } from '../types';
import { db } from '../config/database';
import { authPlugin } from '../plugins/auth';

function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt};
}

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(authPlugin)
  .post(
    '/register',
    async ({ body, error }) => {
      const existingUser = db.users.findByEmail<User>(body.email);
      if (existingUser) {
        return error(409, { error: 'Email already registered' });
      }

      const hashedPassword = await Bun.password.hash(body.password);
      const now = new Date().toISOString();

      const user: User = {
        id: crypto.randomUUID(),
        email: body.email,
        password: hashedPassword,
        name: body.name,
        role: 'user',
        active: true,
        createdAt: now,
        updatedAt: now};

      db.users.insert(user);

      return toUserResponse(user);
    },
    {
      body: RegisterSchema,
      response: UserResponseSchema,
      detail: {
        tags: ['auth'],
        summary: 'Register new user'}}
  )
  .post(
    '/login',
    async ({ body, jwt, error }) => {
      const user = db.users.findByEmail<User>(body.email);
      if (!user) {
        return error(401, { error: 'Invalid credentials' });
      }

      const validPassword = await Bun.password.verify(body.password, user.password);
      if (!validPassword) {
        return error(401, { error: 'Invalid credentials' });
      }

      if (!user.active) {
        return error(401, { error: 'Account is disabled' });
      }

      const token = await jwt.sign({
        userId: user.id,
        email: user.email,
        role: user.role});

      return {
        token,
        user: toUserResponse(user)};
    },
    {
      body: LoginSchema,
      detail: {
        tags: ['auth'],
        summary: 'Login user'}}
  );
`,

    // Routes - Users
    'src/routes/users.ts': `import { Elysia, t } from 'elysia';
import { UserResponseSchema } from '../types';
import type { User, UserResponse } from '../types';
import { db } from '../config/database';
import { authPlugin } from '../plugins/auth';

function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt};
}

export const userRoutes = new Elysia({ prefix: '/users' })
  .use(authPlugin)
  .get(
    '/me',
    ({ user, error }) => {
      const fullUser = db.users.findById<User>(user!.id);
      if (!fullUser) {
        return error(404, { error: 'User not found' });
      }
      return toUserResponse(fullUser);
    },
    {
      isAuth: true,
      response: UserResponseSchema,
      detail: {
        tags: ['users'],
        summary: 'Get current user',
        security: [{ bearerAuth: [] }]}}
  )
  .put(
    '/me',
    ({ user, body, error }) => {
      const updated = db.users.update<User>(user!.id, {
        name: body.name,
        updatedAt: new Date().toISOString()});

      if (!updated) {
        return error(404, { error: 'User not found' });
      }

      return toUserResponse(updated);
    },
    {
      isAuth: true,
      body: t.Object({
        name: t.Optional(t.String())}),
      response: UserResponseSchema,
      detail: {
        tags: ['users'],
        summary: 'Update current user',
        security: [{ bearerAuth: [] }]}}
  )
  .get(
    '/',
    () => {
      const users = db.users.findAll<User>();
      return users.map(toUserResponse);
    },
    {
      hasRole: ['admin'],
      response: t.Array(UserResponseSchema),
      detail: {
        tags: ['users'],
        summary: 'List all users (admin only)',
        security: [{ bearerAuth: [] }]}}
  )
  .get(
    '/:id',
    ({ params, error }) => {
      const user = db.users.findById<User>(params.id);
      if (!user) {
        return error(404, { error: 'User not found' });
      }
      return toUserResponse(user);
    },
    {
      isAuth: true,
      params: t.Object({
        id: t.String()}),
      response: UserResponseSchema,
      detail: {
        tags: ['users'],
        summary: 'Get user by ID',
        security: [{ bearerAuth: [] }]}}
  )
  .delete(
    '/:id',
    ({ params, error }) => {
      const deleted = db.users.delete(params.id);
      if (!deleted) {
        return error(404, { error: 'User not found' });
      }
      return null;
    },
    {
      hasRole: ['admin'],
      params: t.Object({
        id: t.String()}),
      detail: {
        tags: ['users'],
        summary: 'Delete user (admin only)',
        security: [{ bearerAuth: [] }]}}
  );
`,

    // Routes - Products
    'src/routes/products.ts': `import { Elysia, t } from 'elysia';
import {
  ProductSchema,
  CreateProductSchema,
  UpdateProductSchema,
  PaginatedResponseSchema} from '../types';
import type { Product, CreateProductInput, UpdateProductInput } from '../types';
import { db } from '../config/database';
import { authPlugin } from '../plugins/auth';

export const productRoutes = new Elysia({ prefix: '/products' })
  .use(authPlugin)
  .get(
    '/',
    ({ query }) => {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const offset = (page - 1) * limit;

      const allProducts = db.products.find<Product>((p) => p.active);
      const total = allProducts.length;
      const data = allProducts.slice(offset, offset + limit);

      return { data, total, page, limit };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String())}),
      response: PaginatedResponseSchema(ProductSchema),
      detail: {
        tags: ['products'],
        summary: 'List products'}}
  )
  .get(
    '/:id',
    ({ params, error }) => {
      const product = db.products.findById<Product>(params.id);
      if (!product) {
        return error(404, { error: 'Product not found' });
      }
      return product;
    },
    {
      params: t.Object({
        id: t.String()}),
      response: ProductSchema,
      detail: {
        tags: ['products'],
        summary: 'Get product by ID'}}
  )
  .post(
    '/',
    ({ body }) => {
      const now = new Date().toISOString();

      const product: Product = {
        id: crypto.randomUUID(),
        name: body.name,
        description: body.description,
        price: body.price,
        stock: body.stock || 0,
        active: true,
        createdAt: now,
        updatedAt: now};

      db.products.insert(product);

      return product;
    },
    {
      hasRole: ['admin'],
      body: CreateProductSchema,
      response: ProductSchema,
      detail: {
        tags: ['products'],
        summary: 'Create product (admin only)',
        security: [{ bearerAuth: [] }]}}
  )
  .put(
    '/:id',
    ({ params, body, error }) => {
      const product = db.products.update<Product>(params.id, {
        ...body,
        updatedAt: new Date().toISOString()});

      if (!product) {
        return error(404, { error: 'Product not found' });
      }

      return product;
    },
    {
      hasRole: ['admin'],
      params: t.Object({
        id: t.String()}),
      body: UpdateProductSchema,
      response: ProductSchema,
      detail: {
        tags: ['products'],
        summary: 'Update product (admin only)',
        security: [{ bearerAuth: [] }]}}
  )
  .delete(
    '/:id',
    ({ params, error }) => {
      const deleted = db.products.delete(params.id);
      if (!deleted) {
        return error(404, { error: 'Product not found' });
      }
      return null;
    },
    {
      hasRole: ['admin'],
      params: t.Object({
        id: t.String()}),
      detail: {
        tags: ['products'],
        summary: 'Delete product (admin only)',
        security: [{ bearerAuth: [] }]}}
  );
`,

    // Tests
    'src/index.test.ts': `import { describe, expect, it } from 'bun:test';

describe('Health check', () => {
  it('returns healthy status', async () => {
    const response = await fetch('http://localhost:3000/health');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('healthy');
  });
});

describe('Auth', () => {
  it('registers a new user', async () => {
    const response = await fetch('http://localhost:3000/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: \`test-\${Date.now()}@example.com\`,
        password: 'password123',
        name: 'Test User'})});

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.email).toBeDefined();
    expect(body.name).toBe('Test User');
  });
});
`,

    // Environment file
    '.env.example': `# Server
PORT=3000
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

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["bun", "run", "src/index.ts"]
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

A blazing fast REST API built with Elysia on Bun runtime.

## Features

- **Bun Runtime**: Fastest JavaScript runtime
- **Elysia Framework**: Type-safe, high-performance web framework
- **TypeBox Validation**: Compile-time type checking
- **JWT Authentication**: Secure token-based auth
- **Swagger UI**: Interactive API documentation
- **CORS Support**: Configurable cross-origin requests
- **Rate Limiting**: Request throttling
- **Docker Support**: Containerized deployment

## Requirements

- Bun 1.0+
- PostgreSQL (optional, uses in-memory DB by default)
- Docker (optional)

## Quick Start

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   bun install
   \`\`\`

3. Copy \`.env.example\` to \`.env\` and configure

4. Run in development mode:
   \`\`\`bash
   bun run dev
   \`\`\`

5. Or run with Docker:
   \`\`\`bash
   docker-compose up
   \`\`\`

## Available Scripts

\`\`\`bash
bun run dev      # Run with hot reload
bun run start    # Run in production
bun run test     # Run tests
bun run lint     # Lint code
bun run format   # Format code
bun run build    # Compile to binary
\`\`\`

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:3000/swagger

## Project Structure

\`\`\`
src/
├── config/        # Configuration
├── plugins/       # Elysia plugins
├── routes/        # API routes
├── types/         # TypeBox schemas
└── index.ts       # Entry point
\`\`\`

## Performance

Elysia on Bun is one of the fastest web frameworks:
- ~3x faster than Express
- ~2x faster than Fastify
- Native TypeScript support
- Zero-config bundling
\`\`\`
`
  }
};
