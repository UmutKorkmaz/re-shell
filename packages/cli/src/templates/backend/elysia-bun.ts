import { BackendTemplate } from '../types';

export const elysiaBunTemplate: BackendTemplate = {
  id: 'elysia-bun',
  name: 'elysia-bun',
  displayName: 'Elysia (Bun)',
  description: 'Type-safe, high-performance web framework for Bun runtime',
  language: 'typescript',
  framework: 'elysia',
  version: '1.4.0',
  tags: ['bun', 'elysia', 'typescript', 'api', 'rest', 'fast', 'type-safe', 'jwt', 'graphql'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'authorization', 'cors', 'docker', 'documentation', 'graphql', 'rest-api', 'swagger', 'testing', 'validation'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "Type-safe REST and GraphQL API with Elysia on Bun",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "compile": "bun build src/index.ts --compile --outfile={{projectName}}",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@elysiajs/cors": "^1.4.0",
    "@elysiajs/jwt": "^1.4.0",
    "@elysiajs/swagger": "^1.3.0",
    "@sinclair/typebox": "^0.34.0",
    "elysia": "^1.4.0",
    "graphql": "^16.8.1",
    "graphql-yoga": "^5.3.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.4.5"
  }
}
`,

    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "types": ["bun"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
`,

    '.gitignore': `node_modules/
dist/
.env
*.log
`,

    '.env.example': `# Server
PORT=3000
NODE_ENV=development

# Auth (required in production, at least 16 characters)
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=1h

# CORS: comma separated origins, or * for any
ALLOWED_ORIGINS=*
`,

    'src/config.ts': `const environment = process.env.NODE_ENV ?? 'development';
const isProduction = environment === 'production';

const DEV_JWT_SECRET = 'dev-only-jwt-secret-change-me';

const jwtSecret = process.env.JWT_SECRET ?? (isProduction ? '' : DEV_JWT_SECRET);
if (isProduction && jwtSecret.length < 16) {
  throw new Error('JWT_SECRET must be set (at least 16 characters) when NODE_ENV=production');
}

export const config = {
  environment,
  isProduction,
  port: Number(process.env.PORT ?? 3000),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '*').split(',').map((origin) => origin.trim()),
} as const;
`,

    'src/store.ts': `// In-memory data store. Swap it for a database in a real service; the routes only
// use the functions exported here.

export interface User {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
  role: 'user' | 'admin';
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
}

const users: User[] = [];
const products: Product[] = [
  { id: 1, name: 'Sample Product 1', description: 'This is a sample product', price: 29.99, stock: 100 },
  { id: 2, name: 'Sample Product 2', description: 'Another sample product', price: 49.99, stock: 50 },
];
let nextUserId = 1;
let nextProductId = products.length + 1;

export const publicUser = ({ passwordHash: _passwordHash, ...user }: User) => user;

export const store = {
  findUserByEmail: (email: string) => users.find((user) => user.email === email.toLowerCase()),
  findUserById: (id: number) => users.find((user) => user.id === id),
  listUsers: () => users.map(publicUser),

  async createUser(input: { email: string; name: string; password: string }): Promise<User> {
    const user: User = {
      id: nextUserId++,
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: await Bun.password.hash(input.password),
      // The first account becomes the administrator.
      role: users.length === 0 ? 'admin' : 'user',
    };
    users.push(user);
    return user;
  },

  listProducts: () => products,
  findProduct: (id: number) => products.find((product) => product.id === id),
  createProduct(input: Omit<Product, 'id'>): Product {
    const product = { id: nextProductId++, ...input };
    products.push(product);
    return product;
  },
  updateProduct(id: number, patch: Partial<Omit<Product, 'id'>>): Product | undefined {
    const product = products.find((candidate) => candidate.id === id);
    return product ? Object.assign(product, patch) : undefined;
  },
  deleteProduct(id: number): boolean {
    const index = products.findIndex((product) => product.id === id);
    if (index === -1) return false;
    products.splice(index, 1);
    return true;
  },
};
`,

    'src/plugins/auth.ts': `import { jwt } from '@elysiajs/jwt';
import { Elysia } from 'elysia';
import { config } from '../config';
import { store } from '../store';

/**
 * Verifies the Bearer token on every request and exposes the signed-in user as
 * \`user\` (null when anonymous). Routes decide whether they need one.
 */
export const authPlugin = new Elysia({ name: 'auth' })
  .use(jwt({ name: 'jwt', secret: config.jwtSecret, exp: config.jwtExpiresIn }))
  .derive({ as: 'global' }, async ({ jwt, headers }) => {
    const header = headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const payload = token ? await jwt.verify(token) : false;
    const user = payload && payload.sub ? store.findUserById(Number(payload.sub)) : undefined;
    return { user: user ?? null };
  });
`,

    'src/routes/auth.ts': `import { Elysia, t } from 'elysia';
import { authPlugin } from '../plugins/auth';
import { publicUser, store } from '../store';

export const authRoutes = new Elysia({ prefix: '/auth', detail: { tags: ['auth'] } })
  .use(authPlugin)
  .post(
    '/register',
    async ({ body, jwt, status }) => {
      if (store.findUserByEmail(body.email)) {
        return status(409, { error: 'Email already registered' });
      }
      const user = await store.createUser(body);
      return status(201, { user: publicUser(user), token: await jwt.sign({ sub: String(user.id) }) });
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        name: t.String({ minLength: 1, maxLength: 100 }),
        password: t.String({ minLength: 8, maxLength: 200 }),
      }),
      detail: { summary: 'Register a user (the first user becomes admin)' },
    },
  )
  .post(
    '/login',
    async ({ body, jwt, status }) => {
      const user = store.findUserByEmail(body.email);
      if (!user || !(await Bun.password.verify(body.password, user.passwordHash))) {
        return status(401, { error: 'Invalid credentials' });
      }
      return { user: publicUser(user), token: await jwt.sign({ sub: String(user.id) }) };
    },
    {
      body: t.Object({ email: t.String({ format: 'email' }), password: t.String({ minLength: 1 }) }),
      detail: { summary: 'Log in' },
    },
  );
`,

    'src/routes/users.ts': `import { Elysia, t } from 'elysia';
import { authPlugin } from '../plugins/auth';
import { publicUser, store } from '../store';

export const userRoutes = new Elysia({ prefix: '/users', detail: { tags: ['users'] } })
  .use(authPlugin)
  .get(
    '/me',
    ({ user, status }) => (user ? publicUser(user) : status(401, { error: 'Unauthorized' })),
    { detail: { summary: 'The signed-in user', security: [{ bearerAuth: [] }] } },
  )
  .get(
    '/',
    ({ user, status }) => {
      if (!user) return status(401, { error: 'Unauthorized' });
      if (user.role !== 'admin') return status(403, { error: 'Admin only' });
      return store.listUsers();
    },
    { detail: { summary: 'List users (admin)', security: [{ bearerAuth: [] }] } },
  )
  .get(
    '/:id',
    ({ params, user, status }) => {
      if (!user) return status(401, { error: 'Unauthorized' });
      if (user.role !== 'admin' && user.id !== Number(params.id)) return status(403, { error: 'Forbidden' });
      const found = store.findUserById(Number(params.id));
      return found ? publicUser(found) : status(404, { error: 'User not found' });
    },
    {
      params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
      detail: { summary: 'Get a user (yourself, or anyone as admin)', security: [{ bearerAuth: [] }] },
    },
  );
`,

    'src/routes/products.ts': `import { Elysia, t } from 'elysia';
import { authPlugin } from '../plugins/auth';
import { store } from '../store';

const productBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 200 }),
  description: t.String({ maxLength: 2000, default: '' }),
  price: t.Number({ minimum: 0 }),
  stock: t.Integer({ minimum: 0, default: 0 }),
});

export const productRoutes = new Elysia({ prefix: '/products', detail: { tags: ['products'] } })
  .use(authPlugin)
  .get('/', () => ({ products: store.listProducts() }), { detail: { summary: 'List products' } })
  .get(
    '/:id',
    ({ params, status }) => {
      const product = store.findProduct(Number(params.id));
      return product ? { product } : status(404, { error: 'Product not found' });
    },
    { params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }), detail: { summary: 'Get a product' } },
  )
  .post(
    '/',
    ({ body, user, status }) => {
      if (!user) return status(401, { error: 'Unauthorized' });
      if (user.role !== 'admin') return status(403, { error: 'Admin only' });
      return status(201, { product: store.createProduct(body) });
    },
    { body: productBody, detail: { summary: 'Create a product (admin)', security: [{ bearerAuth: [] }] } },
  )
  .patch(
    '/:id',
    ({ params, body, user, status }) => {
      if (!user) return status(401, { error: 'Unauthorized' });
      if (user.role !== 'admin') return status(403, { error: 'Admin only' });
      const product = store.updateProduct(Number(params.id), body);
      return product ? { product } : status(404, { error: 'Product not found' });
    },
    {
      params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
      body: t.Partial(productBody),
      detail: { summary: 'Update a product (admin)', security: [{ bearerAuth: [] }] },
    },
  )
  .delete(
    '/:id',
    ({ params, user, status }) => {
      if (!user) return status(401, { error: 'Unauthorized' });
      if (user.role !== 'admin') return status(403, { error: 'Admin only' });
      return store.deleteProduct(Number(params.id)) ? status(204, undefined) : status(404, { error: 'Product not found' });
    },
    { params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }), detail: { summary: 'Delete a product (admin)', security: [{ bearerAuth: [] }] } },
  );
`,

    'src/graphql.ts': `import { createSchema, createYoga } from 'graphql-yoga';

const typeDefs = /* GraphQL */ \`
  type Query {
    "Simple hello world query"
    hello: String!
    "Service health check"
    health: String!
  }
\`;

const resolvers = {
  Query: {
    hello: () => 'Hello from GraphQL!',
    health: () => 'healthy',
  },
};

export const yoga = createYoga({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: '/graphql',
  landingPage: false,
});
`,

    'src/app.ts': `import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { config } from './config';
import { yoga } from './graphql';
import { authRoutes } from './routes/auth';
import { productRoutes } from './routes/products';
import { userRoutes } from './routes/users';

/**
 * The application, without a listening socket: index.ts starts it and the tests
 * call app.handle() directly.
 */
export const app = new Elysia()
  .use(
    swagger({
      documentation: {
        info: { title: '{{projectName}} API', version: '1.0.0', description: 'REST and GraphQL API built with Elysia on Bun' },
        tags: [
          { name: 'auth', description: 'Authentication' },
          { name: 'users', description: 'User management' },
          { name: 'products', description: 'Product management' },
        ],
        components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
      },
    }),
  )
  .use(
    cors({
      origin: config.allowedOrigins.includes('*') ? true : config.allowedOrigins,
      credentials: !config.allowedOrigins.includes('*'),
    }),
  )
  .get('/health', () => ({ status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime() }), {
    detail: { tags: ['health'], summary: 'Health check' },
  })
  // GraphQL (graphql-yoga): forward the raw request.
  .all('/graphql', ({ request }) => yoga.fetch(request))
  .group('/api/v1', (api) => api.use(authRoutes).use(userRoutes).use(productRoutes))
  .onError(({ code, error, status }) => {
    if (code === 'NOT_FOUND') return status(404, { error: 'Not found' });
    if (code === 'VALIDATION') return status(422, { error: 'Validation failed', details: error.message });
  });

export type App = typeof app;
`,

    'src/index.ts': `import { app } from './app';
import { config } from './config';

app.listen(config.port);

console.log('Server running at http://localhost:' + app.server?.port);
console.log('Swagger docs at http://localhost:' + app.server?.port + '/swagger');

// Graceful shutdown: stop accepting connections, let in-flight requests finish,
// then exit 0 so process managers see a clean stop.
let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(signal + ' received: shutting down');
  await app.stop();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
`,

    'src/app.test.ts': `import { describe, expect, it } from 'bun:test';
import { app } from './app';

// Response.json() is typed unknown; the tests assert on the shape themselves.
const body = (res: Response): Promise<any> => res.json();

const call = (path: string, init: RequestInit & { token?: string } = {}) => {
  const { token, ...rest } = init;
  return app.handle(
    new Request('http://localhost' + path, {
      ...rest,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: 'Bearer ' + token } : {}),
        ...rest.headers,
      },
    }),
  );
};

describe('{{projectName}}', () => {
  let adminToken = '';
  let userToken = '';

  it('answers /health', async () => {
    const res = await call('/health');
    expect(res.status).toBe(200);
    expect((await body(res)).status).toBe('healthy');
  });

  it('serves GraphQL', async () => {
    const res = await call('/graphql', { method: 'POST', body: JSON.stringify({ query: '{ __typename hello }' }) });
    expect(res.status).toBe(200);
    expect((await body(res)).data).toEqual({ __typename: 'Query', hello: 'Hello from GraphQL!' });
  });

  it('registers the first user as admin and the second as a normal user', async () => {
    const first = await call('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'Ada@Example.com', name: 'Ada', password: 'correct horse' }),
    });
    expect(first.status).toBe(201);
    const firstBody = await body(first);
    expect(firstBody.user.role).toBe('admin');
    expect(firstBody.user.passwordHash).toBeUndefined();
    adminToken = firstBody.token;

    const second = await call('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'bob@example.com', name: 'Bob', password: 'another horse' }),
    });
    const secondBody = await body(second);
    expect(secondBody.user.role).toBe('user');
    userToken = secondBody.token;
  });

  it('rejects duplicates, bad credentials and invalid bodies', async () => {
    const duplicate = await call('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'ada@example.com', name: 'Ada', password: 'correct horse' }),
    });
    expect(duplicate.status).toBe(409);

    const wrong = await call('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'ada@example.com', password: 'wrong password' }),
    });
    expect(wrong.status).toBe(401);

    const invalid = await call('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email', name: 'X', password: 'short' }),
    });
    expect(invalid.status).toBe(422);
  });

  it('logs in and returns the current user', async () => {
    const login = await call('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'ada@example.com', password: 'correct horse' }),
    });
    expect(login.status).toBe(200);
    const me = await call('/api/v1/users/me', { token: (await body(login)).token });
    expect((await body(me)).email).toBe('ada@example.com');
    expect((await call('/api/v1/users/me')).status).toBe(401);
  });

  it('lists products publicly and restricts writes to admins', async () => {
    const list = await call('/api/v1/products');
    expect((await body(list)).products.length).toBeGreaterThan(0);

    const anonymous = await call('/api/v1/products', { method: 'POST', body: JSON.stringify({ name: 'Widget', price: 5 }) });
    expect(anonymous.status).toBe(401);

    const forbidden = await call('/api/v1/products', { method: 'POST', token: userToken, body: JSON.stringify({ name: 'Widget', price: 5 }) });
    expect(forbidden.status).toBe(403);

    const created = await call('/api/v1/products', { method: 'POST', token: adminToken, body: JSON.stringify({ name: 'Widget', price: 5 }) });
    expect(created.status).toBe(201);
    const { product } = await body(created);
    expect(product.name).toBe('Widget');

    const updated = await call('/api/v1/products/' + product.id, { method: 'PATCH', token: adminToken, body: JSON.stringify({ price: 7 }) });
    expect((await body(updated)).product.price).toBe(7);

    const removed = await call('/api/v1/products/' + product.id, { method: 'DELETE', token: adminToken });
    expect(removed.status).toBe(204);
    expect((await call('/api/v1/products/' + product.id)).status).toBe(404);
  });

  it('answers unknown routes with a JSON 404', async () => {
    const res = await call('/nope');
    expect(res.status).toBe(404);
  });
});
`,

    'Dockerfile': `FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock* bun.lockb* ./
RUN bun install --production

COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000

USER bun
CMD ["bun", "run", "start"]
`,

    'README.md': `# {{projectName}}

A type-safe REST and GraphQL API built with [Elysia](https://elysiajs.com) on [Bun](https://bun.sh): schema validation with TypeBox, JWT authentication, role checks, Swagger docs at \`/swagger\`, and GraphQL through graphql-yoga.

## Requirements

- Bun 1.1 or newer

## Quick start

\`\`\`bash
bun install
bun run dev        # restarts on change
bun run start      # run once
bun run typecheck  # tsc --noEmit
bun test
bun run build      # bundle to dist/
bun run compile    # single-file executable
\`\`\`

Every setting has a development default; copy \`.env.example\` to \`.env\` to change them. In production (\`NODE_ENV=production\`) \`JWT_SECRET\` is required.

## Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | \`/health\` | no | Liveness probe |
| GET | \`/swagger\` | no | Swagger UI |
| POST | \`/graphql\` | no | GraphQL (\`hello\`, \`health\` queries) |
| POST | \`/api/v1/auth/register\` | no | \`{ email, name, password }\`; the first account becomes admin |
| POST | \`/api/v1/auth/login\` | no | \`{ email, password }\` returns a token |
| GET | \`/api/v1/users/me\` | bearer | The signed-in user |
| GET | \`/api/v1/users\` | admin | List users |
| GET | \`/api/v1/users/:id\` | bearer | Yourself, or anyone as admin |
| GET | \`/api/v1/products\`, \`/api/v1/products/:id\` | no | Read products |
| POST / PATCH / DELETE | \`/api/v1/products[/:id]\` | admin | Manage products |

Data lives in memory (\`src/store.ts\`); replace it with a database for real use.

## Project structure

\`\`\`
src/
├── index.ts        # starts the server, graceful shutdown
├── app.ts          # the Elysia app (plugins, routes, error handling)
├── config.ts       # environment
├── store.ts        # in-memory users and products
├── graphql.ts      # graphql-yoga schema
├── plugins/auth.ts # JWT verification, exposes \`user\`
├── routes/         # auth, users, products
└── app.test.ts     # tests (bun test, no port needed)
\`\`\`

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 3000:3000 -e JWT_SECRET=<16+ chars> {{projectName}}
\`\`\`

## License

MIT
`
  }
};
