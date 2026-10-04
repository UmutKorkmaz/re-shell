import { BackendTemplate } from '../types';

export const alephDenoTemplate: BackendTemplate = {
  id: 'aleph-deno',
  name: 'aleph-deno',
  displayName: 'React SSR on Deno (Hono)',
  description:
    'React SSR and static pre-rendering on Deno 2 with Hono, a JSON API, JWT auth and GraphQL (maintained replacement for the retired Aleph.js template)',
  language: 'typescript',
  framework: 'hono',
  version: '1.0.0',
  tags: ['deno', 'react', 'hono', 'ssr', 'ssg', 'typescript', 'fullstack'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'testing', 'graphql'],

  files: {
    'deno.json': `{
  "tasks": {
    "dev": "deno run --watch --allow-net --allow-env --allow-read src/main.ts",
    "start": "deno run --allow-net --allow-env --allow-read src/main.ts",
    "build": "deno run --allow-env --allow-read --allow-write scripts/build.tsx",
    "test": "deno test --allow-net --allow-env --allow-read",
    "fmt": "deno fmt",
    "lint": "deno lint"
  },
  "imports": {
    "@std/assert": "jsr:@std/assert@^1.0.0",
    "@types/react": "npm:@types/react@^19.0.0",
    "bcryptjs": "npm:bcryptjs@^3.0.2",
    "graphql": "npm:graphql@^16.9.0",
    "hono": "jsr:@hono/hono@^4.6.0",
    "hono/cors": "jsr:@hono/hono@^4.6.0/cors",
    "hono/deno": "jsr:@hono/hono@^4.6.0/deno",
    "hono/jwt": "jsr:@hono/hono@^4.6.0/jwt",
    "hono/logger": "jsr:@hono/hono@^4.6.0/logger",
    "react": "npm:react@^19.0.0",
    "react-dom/server": "npm:react-dom@^19.0.0/server",
    "zod": "npm:zod@^3.23.8"
  },
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "jsxImportSourceTypes": "@types/react",
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
  },
  "exclude": ["dist/"]
}
`,

    'src/main.ts': `import { app } from './app.tsx';
import { config } from './config.ts';
import { seed } from './store.ts';

if (import.meta.main) {
  if (config.jwtSecret === 'dev-secret-change-me') {
    console.warn('JWT_SECRET is not set: using the insecure development secret');
  }
  await seed();
  console.log('Seed admin: admin@example.com / admin123');
  Deno.serve({
    port: config.port,
    onListen: ({ port }) => console.log(\`{{projectName}} listening on http://localhost:\${port}\`),
  }, app.fetch);
}
`,

    'src/app.tsx': `import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/deno';
import { logger } from 'hono/logger';
import { authRoutes } from './api/auth.ts';
import { graphqlRoutes } from './api/graphql.ts';
import { productRoutes } from './api/products.ts';
import { config } from './config.ts';
import { AboutPage, HomePage, NotFoundPage, ProductPage, ProductsPage } from './pages/pages.tsx';
import { renderPage } from './pages/render.ts';
import { store } from './store.ts';

export const app = new Hono();

if (config.logRequests) app.use('*', logger());
app.use('/api/*', cors());
app.use('/graphql', cors());

// Static assets from ./public
app.use(
  '/static/*',
  serveStatic({ root: './public', rewriteRequestPath: (path) => path.replace(/^\\/static/, '') }),
);

// JSON API
app.get(
  '/api/health',
  (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString(), version: '1.0.0' }),
);
app.route('/api/auth', authRoutes);
app.route('/api/products', productRoutes);
app.route('/graphql', graphqlRoutes);

// Server-rendered pages
app.get('/', (c) => c.html(renderPage(<HomePage />)));
app.get('/about', (c) => c.html(renderPage(<AboutPage />)));
app.get('/products', (c) => c.html(renderPage(<ProductsPage products={store.products} />)));
app.get('/products/:id{[0-9]+}', (c) => {
  const product = store.getProduct(Number(c.req.param('id')));
  return product
    ? c.html(renderPage(<ProductPage product={product} />))
    : c.html(renderPage(<NotFoundPage />), 404);
});

app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) return c.json({ error: 'Not found' }, 404);
  return c.html(renderPage(<NotFoundPage />), 404);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});
`,

    'src/config.ts': `/** Runtime configuration, read from the environment (see .env.example). */
export const config = {
  port: Number(Deno.env.get('PORT') ?? '3000'),
  jwtSecret: Deno.env.get('JWT_SECRET') ?? 'dev-secret-change-me',
  /** Log every request (the Hono logger); set LOG_REQUESTS=false to turn it off. */
  logRequests: Deno.env.get('LOG_REQUESTS') !== 'false',
};
`,

    'src/store.ts': `import bcrypt from 'bcryptjs';

export interface User {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
  role: 'admin' | 'user';
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
}

export type ProductInput = Omit<Product, 'id'>;

/** In-memory data store. Swap it for a database client when you need persistence. */
class Store {
  users: User[] = [];
  products: Product[] = [];
  #nextUserId = 1;
  #nextProductId = 1;

  async createUser(
    email: string,
    name: string,
    password: string,
    role: User['role'] = 'user',
  ): Promise<User> {
    const user: User = {
      id: this.#nextUserId++,
      email: email.toLowerCase(),
      name,
      passwordHash: await bcrypt.hash(password, 10),
      role,
    };
    this.users.push(user);
    return user;
  }

  findUserByEmail(email: string): User | undefined {
    return this.users.find((user) => user.email === email.toLowerCase());
  }

  createProduct(input: ProductInput): Product {
    const product: Product = { id: this.#nextProductId++, ...input };
    this.products.push(product);
    return product;
  }

  getProduct(id: number): Product | undefined {
    return this.products.find((product) => product.id === id);
  }

  updateProduct(id: number, changes: Partial<ProductInput>): Product | undefined {
    const product = this.getProduct(id);
    if (product) Object.assign(product, changes);
    return product;
  }

  deleteProduct(id: number): boolean {
    const index = this.products.findIndex((product) => product.id === id);
    if (index === -1) return false;
    this.products.splice(index, 1);
    return true;
  }
}

export const store = new Store();

/** Adds the development admin and sample products once. */
export async function seed(): Promise<void> {
  if (store.users.length > 0) return;
  await store.createUser('admin@example.com', 'Admin User', 'admin123', 'admin');
  store.createProduct({
    name: 'Sample Product 1',
    description: 'This is a sample product',
    price: 29.99,
    stock: 100,
  });
  store.createProduct({
    name: 'Sample Product 2',
    description: 'Another sample product',
    price: 49.99,
    stock: 50,
  });
}
`,

    'src/api/auth.ts': `import bcrypt from 'bcryptjs';
import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { sign, verify } from 'hono/jwt';
import { z } from 'zod';
import { config } from '../config.ts';
import { store } from '../store.ts';
import type { User } from '../store.ts';

export interface AuthPayload {
  sub: number;
  role: User['role'];
  [key: string]: unknown;
}

export type AuthEnv = { Variables: { auth: AuthPayload } };

const TOKEN_TTL_SECONDS = 60 * 60 * 24;

function issueToken(user: User): Promise<string> {
  const payload: AuthPayload = {
    sub: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  return sign(payload, config.jwtSecret, 'HS256');
}

function publicUser(user: User) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).default('New User'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** Requires \`Authorization: Bearer <token>\`; optionally restricts to a role. */
export function requireAuth(role?: User['role']): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const header = c.req.header('Authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    if (!token) return c.json({ error: 'Authentication required' }, 401);
    try {
      const payload = await verify(token, config.jwtSecret, 'HS256');
      c.set('auth', payload as unknown as AuthPayload);
    } catch {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }
    if (role && c.get('auth').role !== role) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  };
}

export const authRoutes = new Hono();

authRoutes.post('/register', async (c) => {
  const input = registerSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) {
    return c.json({ error: 'Validation failed', details: input.error.flatten() }, 400);
  }
  if (store.findUserByEmail(input.data.email)) {
    return c.json({ error: 'Email already registered' }, 409);
  }
  const user = await store.createUser(input.data.email, input.data.name, input.data.password);
  return c.json({ token: await issueToken(user), user: publicUser(user) }, 201);
});

authRoutes.post('/login', async (c) => {
  const input = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Email and password are required' }, 400);

  const user = store.findUserByEmail(input.data.email);
  if (!user || !(await bcrypt.compare(input.data.password, user.passwordHash))) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  return c.json({ token: await issueToken(user), user: publicUser(user) });
});
`,

    'src/api/products.ts': `import { Hono } from 'hono';
import { z } from 'zod';
import { store } from '../store.ts';
import { requireAuth } from './auth.ts';
import type { AuthEnv } from './auth.ts';

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative().default(0),
});

const patchSchema = productSchema.partial();

export const productRoutes = new Hono<AuthEnv>();

productRoutes.get('/', (c) => c.json({ products: store.products, count: store.products.length }));

productRoutes.get('/:id{[0-9]+}', (c) => {
  const product = store.getProduct(Number(c.req.param('id')));
  return product ? c.json({ product }) : c.json({ error: 'Product not found' }, 404);
});

productRoutes.post('/', requireAuth(), async (c) => {
  const input = productSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) {
    return c.json({ error: 'Validation failed', details: input.error.flatten() }, 400);
  }
  return c.json({ product: store.createProduct(input.data) }, 201);
});

productRoutes.put('/:id{[0-9]+}', requireAuth(), async (c) => {
  const changes = patchSchema.safeParse(await c.req.json().catch(() => null));
  if (!changes.success) {
    return c.json({ error: 'Validation failed', details: changes.error.flatten() }, 400);
  }
  const product = store.updateProduct(Number(c.req.param('id')), changes.data);
  return product ? c.json({ product }) : c.json({ error: 'Product not found' }, 404);
});

productRoutes.delete('/:id{[0-9]+}', requireAuth('admin'), (c) => {
  return store.deleteProduct(Number(c.req.param('id')))
    ? c.body(null, 204)
    : c.json({ error: 'Product not found' }, 404);
});
`,

    'src/api/graphql.ts': `import { buildSchema, graphql } from 'graphql';
import { Hono } from 'hono';
import { store } from '../store.ts';

const schema = buildSchema(\`
  type Product {
    id: Int!
    name: String!
    description: String!
    price: Float!
    stock: Int!
  }

  type Query {
    hello: String!
    health: String!
    products: [Product!]!
    product(id: Int!): Product
  }
\`);

const rootValue = {
  hello: () => 'Hello from GraphQL on Deno!',
  health: () => 'healthy',
  products: () => store.products,
  product: ({ id }: { id: number }) => store.getProduct(id) ?? null,
};

export const graphqlRoutes = new Hono();

graphqlRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null) as
    | { query?: unknown; variables?: Record<string, unknown> }
    | null;
  if (!body || typeof body.query !== 'string') {
    return c.json({ errors: [{ message: 'Request body must be JSON with a query string' }] }, 400);
  }
  const result = await graphql({
    schema,
    source: body.query,
    rootValue,
    variableValues: body.variables,
  });
  return c.json(result);
});
`,

    'src/pages/layout.tsx': `import type { ReactNode } from 'react';

export function Layout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <html lang='en'>
      <head>
        <meta charSet='utf-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <title>{title}</title>
        <link rel='stylesheet' href='/static/styles.css' />
      </head>
      <body>
        <header>
          <strong>{{projectName}}</strong>
          <nav>
            <a href='/'>Home</a>
            <a href='/products'>Products</a>
            <a href='/about'>About</a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
`,

    'src/pages/pages.tsx': `import type { Product } from '../store.ts';
import { Layout } from './layout.tsx';

/** Static page: pre-rendered by \`deno task build\` and also served by the server. */
export function HomePage() {
  return (
    <Layout title='Home'>
      <h1>Welcome to {{projectName}}</h1>
      <p>React pages rendered on the server with Hono and Deno.</p>
      <ul>
        <li>
          <a href='/products'>Products</a> (server-rendered from the in-memory store)
        </li>
        <li>
          <a href='/api/health'>/api/health</a> (JSON API)
        </li>
        <li>
          <a href='/about'>About</a> (static page)
        </li>
      </ul>
    </Layout>
  );
}

/** Static page: pre-rendered by \`deno task build\` and also served by the server. */
export function AboutPage() {
  return (
    <Layout title='About'>
      <h1>About</h1>
      <p>
        Static pages are rendered to <code>dist/</code> by{' '}
        <code>deno task build</code>. Pages that need data, like{' '}
        <a href='/products'>products</a>, are rendered per request.
      </p>
    </Layout>
  );
}

export function ProductsPage({ products }: { products: Product[] }) {
  return (
    <Layout title='Products'>
      <h1>Products</h1>
      {products.length === 0 ? <p>No products yet.</p> : (
        <ul>
          {products.map((product) => (
            <li key={product.id}>
              <a href={\`/products/\${product.id}\`}>{product.name}</a> - \${product.price.toFixed(2)}
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}

export function ProductPage({ product }: { product: Product }) {
  return (
    <Layout title={product.name}>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <p>
        \${product.price.toFixed(2)} - {product.stock} in stock
      </p>
      <p>
        <a href='/products'>Back to products</a>
      </p>
    </Layout>
  );
}

export function NotFoundPage() {
  return (
    <Layout title='Not found'>
      <h1>Page not found</h1>
      <p>
        <a href='/'>Go home</a>
      </p>
    </Layout>
  );
}
`,

    'src/pages/render.ts': `import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';

/** Renders a React page to a complete HTML document. */
export function renderPage(element: ReactElement): string {
  return \`<!DOCTYPE html>\${renderToString(element)}\`;
}
`,

    'scripts/build.tsx': `// Static site generation: renders the pages that need no data into dist/.
import { AboutPage, HomePage } from '../src/pages/pages.tsx';
import { renderPage } from '../src/pages/render.ts';

const pages: Array<[path: string, html: string]> = [
  ['dist/index.html', renderPage(<HomePage />)],
  ['dist/about/index.html', renderPage(<AboutPage />)],
];

await Deno.mkdir('dist/static', { recursive: true });
for (const [path, html] of pages) {
  await Deno.mkdir(path.substring(0, path.lastIndexOf('/')), { recursive: true });
  await Deno.writeTextFile(path, html);
  console.log(\`rendered \${path}\`);
}
for await (const entry of Deno.readDir('public')) {
  if (entry.isFile) {
    await Deno.copyFile(\`public/\${entry.name}\`, \`dist/static/\${entry.name}\`);
    console.log(\`copied public/\${entry.name}\`);
  }
}
`,

    'public/styles.css': `body {
  font-family: system-ui, sans-serif;
  margin: 0;
  color: #1f2933;
}

header {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  padding: 1rem 1.5rem;
  background: #1f2933;
  color: #fff;
}

header a {
  color: #9fb3c8;
  margin-right: 1rem;
  text-decoration: none;
}

main {
  max-width: 48rem;
  margin: 2rem auto;
  padding: 0 1rem;
}
`,

    'tests/app_test.ts': `import { assert, assertEquals, assertStringIncludes } from '@std/assert';
import { app } from '../src/app.tsx';
import { seed } from '../src/store.ts';

await seed();

const json = (body: unknown, token?: string): RequestInit => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
  },
  body: JSON.stringify(body),
});

async function login(email: string, password: string): Promise<string> {
  const response = await app.request('/api/auth/login', json({ email, password }));
  assertEquals(response.status, 200);
  return (await response.json()).token;
}

Deno.test('health check', async () => {
  const response = await app.request('/api/health');
  assertEquals(response.status, 200);
  assertEquals((await response.json()).status, 'healthy');
});

Deno.test('pages are rendered on the server', async () => {
  const home = await app.request('/');
  assertEquals(home.status, 200);
  assertStringIncludes(await home.text(), '<!DOCTYPE html>');

  const products = await app.request('/products');
  assertStringIncludes(await products.text(), 'Sample Product 1');

  assertEquals((await app.request('/products/9999')).status, 404);
  assertEquals((await app.request('/nope')).status, 404);
});

Deno.test('static assets are served', async () => {
  const response = await app.request('/static/styles.css');
  assertEquals(response.status, 200);
  assertStringIncludes(await response.text(), 'font-family');
});

Deno.test('login rejects bad credentials', async () => {
  const response = await app.request(
    '/api/auth/login',
    json({ email: 'admin@example.com', password: 'wrong-password' }),
  );
  assertEquals(response.status, 401);
});

Deno.test('product writes need a token and deletes need the admin role', async () => {
  const anonymous = await app.request('/api/products', json({ name: 'Widget', price: 5 }));
  assertEquals(anonymous.status, 401);

  const admin = await login('admin@example.com', 'admin123');
  const created = await app.request('/api/products', json({ name: 'Widget', price: 5 }, admin));
  assertEquals(created.status, 201);
  const { product } = await created.json();
  assert(product.id > 0);

  const invalid = await app.request('/api/products', json({ name: '', price: -1 }, admin));
  assertEquals(invalid.status, 400);

  const registered = await app.request(
    '/api/auth/register',
    json({ email: 'user@example.com', password: 'password123', name: 'User' }),
  );
  assertEquals(registered.status, 201);
  const userToken = (await registered.json()).token;
  const forbidden = await app.request(\`/api/products/\${product.id}\`, {
    method: 'DELETE',
    headers: { Authorization: \`Bearer \${userToken}\` },
  });
  assertEquals(forbidden.status, 403);

  const removed = await app.request(\`/api/products/\${product.id}\`, {
    method: 'DELETE',
    headers: { Authorization: \`Bearer \${admin}\` },
  });
  assertEquals(removed.status, 204);
});

Deno.test('graphql answers hello and products', async () => {
  const response = await app.request('/graphql', json({ query: '{ hello products { name } }' }));
  assertEquals(response.status, 200);
  const { data } = await response.json();
  assertEquals(data.hello, 'Hello from GraphQL on Deno!');
  assert(data.products.length >= 2);
});
`,

    '.env.example': `# Environment variables read by src/config.ts (export them, or run with deno --env-file)
PORT=3000
JWT_SECRET=change-me
LOG_REQUESTS=true
`,

    '.gitignore': `dist/
.env
`,

    '.dockerignore': `.env
dist/
`,

    'Dockerfile': `ARG DENO_VERSION=2.9.6
FROM denoland/deno:\${DENO_VERSION}

WORKDIR /app
RUN chown deno:deno /app
USER deno

COPY --chown=deno:deno . .

# Cache dependencies and pre-render the static pages
RUN deno cache src/main.ts scripts/build.tsx \\
    && deno task build

ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
    CMD deno eval "const r = await fetch('http://localhost:3000/api/health'); Deno.exit(r.ok ? 0 : 1)"

CMD ["task", "start"]
`,

    'docker-compose.yml': `services:
  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      PORT: '3000'
      JWT_SECRET: \${JWT_SECRET:?set JWT_SECRET}
      LOG_REQUESTS: 'true'
    restart: unless-stopped
`,

    'README.md': `# {{projectName}}

React application on Deno 2: server-side rendered pages, static pre-rendering, a JSON API and
GraphQL, built with [Hono](https://hono.dev) and React.

> This template replaces the former Aleph.js template. Aleph.js targets Deno 1.x and is no longer
> actively developed, so the same idea (React SSR/SSG, API routes, Deno) is built on maintained
> packages instead. For a file-system-routed framework on Deno see the Fresh template.

## Features

- **React 19** pages rendered to HTML on the server (\`react-dom/server\`)
- **Static pre-rendering**: \`deno task build\` writes the data-free pages to \`dist/\`
- **Hono** routing, CORS, request logging and static files
- **JWT authentication** (HS256) with bcrypt password hashes
- **Validation** with zod, **GraphQL** with graphql-js
- In-memory store (swap in a database client when you need persistence)

## Requirements

- Deno 2.x

## Quick start

\`\`\`bash
deno task dev      # watch mode on http://localhost:3000
deno task start    # no watcher
deno task build    # pre-render / and /about into dist/
deno task test     # unit tests
\`\`\`

Set \`JWT_SECRET\` before running anywhere but your laptop (see \`.env.example\`). A development admin
is seeded at start-up (\`admin@example.com\` / \`admin123\`); remove it in \`src/store.ts\`.

## Routes

Pages: \`/\`, \`/about\`, \`/products\`, \`/products/:id\`

API:

- \`GET /api/health\`
- \`POST /api/auth/register\` - body \`{"email","password","name"}\`
- \`POST /api/auth/login\` - body \`{"email","password"}\`
- \`GET /api/products\`, \`GET /api/products/:id\`
- \`POST /api/products\`, \`PUT /api/products/:id\` - \`Authorization: Bearer <token>\`
- \`DELETE /api/products/:id\` - admin token required
- \`POST /graphql\` - body \`{"query":"{ hello products { name } }"}\`

## Structure

\`\`\`
src/main.ts            # Deno.serve entry point
src/app.tsx            # Hono app: middleware, API and page routes
src/pages/             # React layout and pages, renderPage()
src/api/               # auth, products and GraphQL routes
src/store.ts           # in-memory users and products
scripts/build.tsx      # static pre-rendering into dist/
public/                # served at /static
tests/                 # deno test
\`\`\`

## License

MIT
`
  }
};
