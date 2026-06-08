import { BackendTemplate } from '../types';

export const alephDenoTemplate: BackendTemplate = {
  id: 'aleph-deno',
  name: 'aleph-deno',
  displayName: 'Aleph.js (Deno)',
  description: 'React framework for Deno with SSR, SSG, and file-based routing',
  language: 'typescript',
  framework: 'aleph',
  version: '1.0.0',
  tags: ['deno', 'aleph', 'react', 'ssr', 'ssg', 'typescript', 'fullstack'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing'],

  files: {
    // Deno configuration
    'deno.json': `{
  "tasks": {
    "dev": "aleph dev",
    "build": "aleph build",
    "start": "aleph start",
    "test": "deno test --allow-all",
    "fmt": "deno fmt",
    "lint": "deno lint"
  },
  "imports": {
    "aleph/": "https://deno.land/x/aleph@1.0.0/",
    "react": "https://esm.sh/react@18.2.0",
    "react-dom": "https://esm.sh/react-dom@18.2.0",
    "nanostores": "https://esm.sh/nanostores@0.9.3",
    "dotenv": "https://deno.land/std@0.208.0/dotenv/mod.ts"
  },
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
`,

    // Main app configuration
    'app.tsx': `import ReactDOM from 'react-dom';
import App from './pages/index.tsx';

export default function Root() {
  return (
    <html>
      <head>
        <title>{{projectName}}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <App />
      </body>
    </html>
  );
}

// Enable HMR for development
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    ReactDOM.render(newModule.default, document.body);
  });
}
`,

    // Home page with API integration
    'pages/index.tsx': `import { useSignal } from 'nanostores';
import { useEffect } from 'react';
import Head from 'aleph/react/components/head.tsx';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
}

interface ProductsResponse {
  products: Product[];
  count: number;
}

export default function App() {
  const products = useSignal<Product[]>([]);
  const loading = useSignal<boolean>(true);
  const error = useSignal<string | null>(null);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then((data: ProductsResponse) => {
        products.value = data.products;
        loading.value = false;
      })
      .catch(err => {
        error.value = err.message;
        loading.value = false;
      });
  }, []);

  return (
    <>
      <Head>
        <title>Welcome to {{projectName}}</title>
        <meta name="description" content="Built with Aleph.js and Deno" />
      </Head>

      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1>Welcome to {{projectName}}</h1>
          <p>Full-stack React application powered by Aleph.js and Deno</p>
        </header>

        <section>
          <h2>Products</h2>

          {loading.value ? (
            <p>Loading products...</p>
          ) : error.value ? (
            <p style={{ color: 'red' }}>Error: {error.value}</p>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1rem'
            }}>
              {products.value.map(product => (
                <div
                  key={product.id}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '1rem',
                    backgroundColor: '#fff'
                  }}
                >
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <p><strong>Price:</strong> \${product.price}</p>
                  <p><strong>In Stock:</strong> {product.stock}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
`,

    // API route - Products
    'routes/api/products.tsx': `import { Handler } from 'aleph';

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  created_at: string;
  updated_at: string;
};

// In-memory database
let products: Product[] = [
  {
    id: 1,
    name: 'Sample Product 1',
    description: 'This is a sample product',
    price: 29.99,
    stock: 100,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()},
  {
    id: 2,
    name: 'Sample Product 2',
    description: 'Another sample product',
    price: 49.99,
    stock: 50,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()}
];

export const get: Handler = async ({ response }) => {
  response.status = 200;
  response.json({
    products: products,
    count: products.length
  });
};

export const post: Handler = async ({ request, response }) => {
  const body = await request.json();

  if (!body.name || !body.price) {
    response.status = 400;
    response.json({ error: 'Name and price are required' });
    return;
  }

  const newProduct: Product = {
    id: products.length + 1,
    name: body.name,
    description: body.description || '',
    price: parseFloat(body.price),
    stock: parseInt(body.stock) || 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()};

  products.push(newProduct);

  response.status = 201;
  response.json({ product: newProduct });
};
`,

    // API route - Product by ID
    'routes/api/product/[id].tsx': `import { Handler } from 'aleph';

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  created_at: string;
  updated_at: string;
};

let products: Product[] = [
  {
    id: 1,
    name: 'Sample Product 1',
    description: 'This is a sample product',
    price: 29.99,
    stock: 100,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()},
  {
    id: 2,
    name: 'Sample Product 2',
    description: 'Another sample product',
    price: 49.99,
    stock: 50,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()}
];

export const get: Handler = async ({ params, response }) => {
  const id = parseInt(params.id);
  const product = products.find(p => p.id === id);

  if (!product) {
    response.status = 404;
    response.json({ error: 'Product not found' });
    return;
  }

  response.json({ product });
};

export const put: Handler = async ({ request, response, params }) => {
  const id = parseInt(params.id);
  const productIndex = products.findIndex(p => p.id === id);

  if (productIndex === -1) {
    response.status = 404;
    response.json({ error: 'Product not found' });
    return;
  }

  const body = await request.json();
  const product = products[productIndex];

  product.name = body.name || product.name;
  product.description = body.description || product.description;
  product.price = body.price ? parseFloat(body.price) : product.price;
  product.stock = body.stock ? parseInt(body.stock) : product.stock;
  product.updated_at = new Date().toISOString();

  response.json({ product });
};

export const del: Handler = async ({ response, params }) => {
  const id = parseInt(params.id);
  const productIndex = products.findIndex(p => p.id === id);

  if (productIndex === -1) {
    response.status = 404;
    response.json({ error: 'Product not found' });
    return;
  }

  products.splice(productIndex, 1);

  response.status = 204;
};
`,

    // API route - Health check
    'routes/api/health.tsx': `import { Handler } from 'aleph';

export const get: Handler = ({ response }) => {
  response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
};
`,

    // API route - Authentication
    'routes/api/auth/login.tsx': `import { Handler } from 'aleph';

type User = {
  id: number;
  email: string;
  password: string;
  name: string;
  role: string;
  created_at: string;
  updated_at: string;
};

const users: User[] = [
  {
    id: 1,
    email: 'admin@example.com',
    password: 'admin123', // In production, hash this
    name: 'Admin User',
    role: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()}
];

export const post: Handler = async ({ request, response }) => {
  const body = await request.json();

  const user = users.find(u => u.email === body.email && u.password === body.password);

  if (!user) {
    response.status = 401;
    response.json({ error: 'Invalid credentials' });
    return;
  }

  // In production, use real JWT
  const token = Buffer.from(JSON.stringify({
    user_id: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  })).toString('base64');

  response.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
};
`,

    // API route - Register
    'routes/api/auth/register.tsx': `import { Handler } from 'aleph';

type User = {
  id: number;
  email: string;
  password: string;
  name: string;
  role: string;
  created_at: string;
  updated_at: string;
};

let users: User[] = [
  {
    id: 1,
    email: 'admin@example.com',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()}
];

export const post: Handler = async ({ request, response }) => {
  const body = await request.json();

  const existingUser = users.find(u => u.email === body.email);

  if (existingUser) {
    response.status = 409;
    response.json({ error: 'Email already registered' });
    return;
  }

  const newUser: User = {
    id: users.length + 1,
    email: body.email,
    password: body.password, // In production, hash this
    name: body.name,
    role: 'user',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()};

  users.push(newUser);

  const token = Buffer.from(JSON.stringify({
    user_id: newUser.id,
    email: newUser.email,
    role: newUser.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000
  })).toString('base64');

  response.status = 201;
  response.json({
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role
    }
  });
};
`,

    // Environment configuration
    '.env': `PORT=3000
ENVIRONMENT=development
DATABASE_URL=file:./data.db
JWT_SECRET=change-this-secret-in-production
JWT_EXPIRATION=604800
`,

    // Dockerfile - Multi-stage optimized build
    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Builder
FROM denoland/deno:1.38.0 AS builder

WORKDIR /app

# Copy dependency files first for better caching
COPY deno.json ./

# Download and cache dependencies
RUN deno cache --reload $(find . -name "*.tsx" -o -name "*.ts" 2>/dev/null || true)

# Copy source code
COPY . .

# Cache all dependencies
RUN deno cache --reload $(find . -name "*.tsx" -o -name "*.ts")

# =============================================================================
# Stage 2: Runtime - Minimal image
# =============================================================================
FROM denoland/deno:1.38.0-alpine AS runtime

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy cached dependencies and source from builder
COPY --from=builder /app /app

# Create non-root user
RUN addgroup -S -g 1000 appgroup && \\
    adduser -S -u 1000 -G appgroup appuser

# Set ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", "aleph.dev.ts"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - ENVIRONMENT=production
      - PORT=3000
    restart: unless-stopped
`,

    // Tests
    'tests/main.test.tsx': `import { assertEquals } from 'https://deno.land/std@0.208.0/testing/asserts.ts';
import { handler } from '../routes/api/health.tsx';

Deno.test('API health check', async () => {
  const response = await handler({
    params: {},
    headers: new Headers(),
    request: new Request('http://localhost/api/health'),
    response: new Response()});

  const data = await response.json();

  assertEquals(data.status, 'healthy');
  assertEquals(response.status, 200);
});
`,

    // README
    'README.md': `# {{projectName}}

Full-stack React application built with Aleph.js and Deno.

## Features

- **Aleph.js**: React framework with SSR/SSG
- **File-based routing**: Automatic route generation
- **TypeScript**: Full type safety
- **Hot reload**: Instant development feedback
- **API routes**: Serverless functions built-in
- **In-memory database**: Easy development (switchable to PostgreSQL)

## Requirements

- Deno 1.38+

## Quick Start

\`\`\`bash
# Install dependencies (automatic with Deno)
deno task dev

# Or start Aleph directly
aleph dev
\`\`\`

Visit http://localhost:3000

## API Endpoints

- \`GET /api/health\` - Health check
- \`POST /api/auth/register\` - Register new user
- \`POST /api/auth/login\` - Login
- \`GET /api/products\` - List products
- \`GET /api/product/:id\` - Get product by ID
- \`POST /api/products\` - Create product
- \`PUT /api/product/:id\` - Update product
- \`DELETE /api/product/:id\` - Delete product

## File Structure

\`\`\`
app.tsx                 # Root component
pages/index.tsx         # Home page
routes/api/             # API routes
  products.ts           # Products CRUD
  product/[id].ts       # Single product operations
  auth/                 # Authentication routes
\`\`\`

## Build for Production

\`\`\`bash
deno task build
deno task start
\`\`\`

## Testing

\`\`\`bash
deno test --allow-all
\`\`\`

## License

MIT
`
  }
};
