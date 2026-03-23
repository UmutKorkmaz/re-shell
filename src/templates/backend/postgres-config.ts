import { BackendTemplate } from '../types';

export const postgresConfigTemplate: BackendTemplate = {
  id: 'postgres-config',
  name: 'postgres-config',
  displayName: 'PostgreSQL Advanced Configuration',
  description: 'PostgreSQL database setup with advanced features: JSONB, full-text search, extensions, connection pooling, and monitoring',
  language: 'javascript',
  framework: 'postgres',
  version: '1.0.0',
  tags: ['postgresql', 'postgres', 'database', 'jsonb', 'fulltext', 'extensions'],
  port: 3000,
  dependencies: {},
  features: ['database', 'jsonb', 'fulltext', 'extensions', 'monitoring'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "migrate": "node scripts/migrate.js",
    "seed": "node scripts/seed.js"
  },
  "dependencies": {
    "pg": "^8.11.3",
    "pg-pool": "^3.6.1",
    "express": "^4.18.2"
  }
}
`,

    'db/index.js': `import { Pool } from 'pg';
import { parse } from 'pg-connection-string';

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const pool = new Pool(poolConfig);

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error', { text, error });
    throw error;
  }
}

export async function getClient() {
  const client = await pool.connect();
  return client;
}
`,

    'db/schema.sql': `-- Enable PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- Full-text search
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";  -- Query statistics
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "btree_gin";     -- GIN indexes improvements
CREATE EXTENSION IF NOT EXISTS "btree_gist";    -- GiST indexes

-- Users table with JSONB support
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  profile JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  tags TEXT[],
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table with full-text search
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(100),
  tags TEXT[],
  attributes JSONB DEFAULT '{}',
  search_vector tsvector,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create GIN index for JSONB queries
CREATE INDEX idx_users_profile ON users USING GIN (profile);
CREATE INDEX idx_users_preferences ON users USING GIN (preferences);
CREATE INDEX idx_users_tags ON users USING GIN (tags);
CREATE INDEX idx_users_metadata ON users USING GIN (metadata);

-- Create GIN index for full-text search
CREATE INDEX idx_products_search ON products USING GIN (search_vector);
CREATE INDEX idx_products_attributes ON products USING GIN (attributes);
CREATE INDEX idx_products_tags ON products USING GIN (tags);

-- Create expression index for case-insensitive email search
CREATE INDEX idx_users_email_lower ON users (LOWER(email));

-- Function to update search vector
CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic search vector update
DROP TRIGGER IF EXISTS products_search_vector_trigger ON products;
CREATE TRIGGER products_search_vector_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION products_search_vector_update();

-- Materialized view for aggregated data
CREATE MATERIALIZED VIEW IF NOT EXISTS product_summary AS
SELECT 
  category,
  COUNT(*) as product_count,
  AVG(price) as avg_price,
  MIN(price) as min_price,
  MAX(price) as max_price,
  array_agg(DISTINCT tags) as all_tags
FROM products
GROUP BY category;

-- Refresh materialized view
CREATE OR REPLACE FUNCTION refresh_product_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY product_summary;
END;
$$ LANGUAGE plpgsql;

-- Performance monitoring view
CREATE OR REPLACE VIEW query_stats AS
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 100;
`,

    'db/migrations/001_initial.sql': `-- Migration: Initial schema
-- Run: npm run migrate

BEGIN;

-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  profile JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
`,

    'db/seed.sql': `-- Seed data for development

INSERT INTO users (email, name, profile) VALUES
  ('admin@example.com', 'Admin User', '{"role": "admin", "permissions": ["read", "write", "delete"]}'),
  ('user@example.com', 'Test User', '{"role": "user", "permissions": ["read"]}');

INSERT INTO products (name, description, price, category, tags) VALUES
  ('Product A', 'A great product', 29.99, 'Electronics', ARRAY['wireless', 'compact']),
  ('Product B', 'Another great product', 49.99, 'Books', ARRAY['fiction', 'bestseller']),
  ('Product C', 'Amazing product', 19.99, 'Home', ARRAY['kitchen', 'essential']);
`,

    'db/queries/users.js': `import { query } from '../index.js';

export async function createUser({ email, name, profile = {} }) {
  const result = await query(
    'INSERT INTO users (email, name, profile) VALUES ($1, $2, $3) RETURNING *',
    [email, name, JSON.stringify(profile)]
  );
  return result.rows[0];
}

export async function getUserById(id) {
  const result = await query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
}

export async function getUserByEmail(email) {
  const result = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
  return result.rows[0];
}

export async function updateUserProfile(id, profile) {
  const result = await query(
    'UPDATE users SET profile = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [JSON.stringify(profile), id]
  );
  return result.rows[0];
}

// JSONB queries
export async function getUsersByProfileKey(key, value) {
  const result = await query(
    "SELECT * FROM users WHERE profile->$1 = $2",
    [key, JSON.stringify(value)]
  );
  return result.rows;
}

// Full-text search
export async function searchProducts(searchTerm) {
  const result = await query(
    'SELECT * FROM products WHERE search_vector @@ plainto_tsquery($1) ORDER BY ts_rank(search_vector, plainto_tsquery($1)) DESC',
    [searchTerm]
  );
  return result.rows;
}

// Aggregation with JSONB
export async function getUserStats() {
  const result = await query(\`
    SELECT 
      COUNT(*) as total_users,
      COUNT(DISTINCT profile->>'role') as unique_roles,
      jsonb_object_keys(profile) as common_keys
    FROM users
  \`);
  return result.rows[0];
}
`,

    'db/queries/products.js': `import { query } from '../index.js';

export async function createProduct({ name, description, price, category, tags = [], attributes = {} }) {
  const result = await query(
    'INSERT INTO products (name, description, price, category, tags, attributes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [name, description, price, category, tags, JSON.stringify(attributes)]
  );
  return result.rows[0];
}

export async function getProductsByCategory(category) {
  const result = await query(
    'SELECT * FROM products WHERE category = $1 ORDER BY name',
    [category]
  );
  return result.rows;
}

// Query products by JSONB attributes
export async function getProductsByAttribute(key, value) {
  const result = await query(
    "SELECT * FROM products WHERE attributes->$1 = $2",
    [key, JSON.stringify(value)]
  );
  return result.rows;
}

// Full-text search with ranking
export async function searchProducts(searchTerm, limit = 10) {
  const result = await query(
    \`SELECT 
      *,
      ts_rank(search_vector, plainto_tsquery($1)) as rank
    FROM products
    WHERE search_vector @@ plainto_tsquery($1)
    ORDER BY rank DESC
    LIMIT $2\`,
    [searchTerm, limit]
  );
  return result.rows;
}

// Get product summary from materialized view
export async function getProductSummary() {
  const result = await query('SELECT * FROM product_summary');
  return result.rows;
}

// Refresh materialized view
export async function refreshProductSummary() {
  await query('REFRESH MATERIALIZED VIEW CONCURRENTLY product_summary');
}
`,

    'index.js': `import express from 'express';
import * as usersDb from './db/queries/users.js';
import * as productsDb from './db/queries/products.js';

const app = express();
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    const result = await req.db.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected', error: err.message });
  }
});

// User CRUD with JSONB
app.post('/api/users', async (req, res) => {
  const user = await usersDb.createUser(req.body);
  res.json(user);
});

app.get('/api/users/:id', async (req, res) => {
  const user = await usersDb.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.patch('/api/users/:id/profile', async (req, res) => {
  const user = await usersDb.updateUserProfile(req.params.id, req.body.profile);
  res.json(user);
});

// JSONB query example
app.get('/api/users/by-profile/:key/:value', async (req, res) => {
  const users = await usersDb.getUsersByProfileKey(req.params.key, req.params.value);
  res.json(users);
});

// Products with full-text search
app.post('/api/products', async (req, res) => {
  const product = await productsDb.createProduct(req.body);
  res.json(product);
});

app.get('/api/products/search', async (req, res) => {
  const products = await productsDb.searchProducts(req.query.q);
  res.json(products);
});

app.get('/api/products/category/:category', async (req, res) => {
  const products = await productsDb.getProductsByCategory(req.params.category);
  res.json(products);
});

// Product summary (from materialized view)
app.get('/api/products/summary', async (req, res) => {
  await productsDb.refreshProductSummary();
  const summary = await productsDb.getProductSummary();
  res.json(summary);
});

// Query stats
app.get('/api/stats/queries', async (req, res) => {
  const result = await req.db.query('SELECT * FROM query_stats LIMIT 10');
  res.json(result.rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Server on port \${PORT}\`));
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:password@postgres:5432/dbname
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=dbname
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./db:/docker-entrypoint-initdb.d
    restart: unless-stopped

  # PgAdmin for database management
  pgadmin:
    image: dpage/pgadmin4:latest
    environment:
      - PGADMIN_DEFAULT_EMAIL=admin@admin.com
      - PGADMIN_DEFAULT_PASSWORD=admin
    ports:
      - "5050:80"
    depends_on:
      - postgres

volumes:
  postgres_data:
`,

    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
`,

    '.env.example': `# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
PGHOST=localhost
PGPORT=5432
PGUSER=user
PGPASSWORD=password
PGDATABASE=dbname

# Server
PORT=3000
NODE_ENV=development
`,

    'README.md': `# {{projectName}}

PostgreSQL advanced configuration template with JSONB, full-text search, extensions, and monitoring.

## Features

- **JSONB Support**: JSON document storage with GIN indexing
- **Full-Text Search**: PostgreSQL tsvector with trigram matching
- **Extensions**: uuid-ossp, pg_trgm, pg_stat_statements, pgcrypto
- **Materialized Views**: Pre-computed aggregations
- **Connection Pooling**: pg-pool for efficient connections
- **Monitoring**: Query performance statistics

## Schema

### Users Table
- JSONB profile and preferences
- Full-text search on name/email
- GIN indexes for fast JSON queries

### Products Table
- JSONB attributes for flexible metadata
- Auto-updating search vector
- Materialized view for category summaries

## Quick Start

### Local Development

\`\`\`bash
# Start PostgreSQL
docker-compose up -d postgres

# Run migrations
npm run migrate

# Seed database
npm run seed

# Start server
npm start
\`\`\`

### Full Stack

\`\`\`bash
docker-compose up
\`\`\`

Access:
- Application: http://localhost:3000
- PgAdmin: http://localhost:5050
- PostgreSQL: localhost:5432

## JSONB Queries

### Get by JSON key
\`\`\`sql
SELECT * FROM users WHERE profile->>'role' = 'admin';
\`\`\`

### Check if key exists
\`\`\`sql
SELECT * FROM users WHERE profile ? 'permissions';
\`\`\`

### Array operations
\`\`\`sql
SELECT * FROM users WHERE 'read' = ANY(profile->>'permissions');
\`\`\`

## Full-Text Search

### Simple search
\`\`\`sql
SELECT * FROM products WHERE search_vector @@ plainto_tsquery('wireless');
\`\`\`

### Phrase search
\`\`\`sql
SELECT * FROM products WHERE search_vector @@ phraseto_tsquery('bestseller book');
\`\`\`

### Ranking
\`\`\`sql
SELECT *, ts_rank(search_vector, query) as rank
FROM products
WHERE search_vector @@ query
ORDER BY rank DESC;
\`\`\`

## Extensions

### uuid-ossp - UUID generation
\`\`\`sql
SELECT uuid_generate_v4();
\`\`\`

### pg_trgm - Trigram matching
\`\`\`sql
CREATE INDEX idx_name_trgm ON products USING GIN (name gin_trgm_ops);
SELECT * FROM products WHERE name LIKE '%word%';
\`\`\`

### pgcrypto - Cryptographic functions
\`\`\`sql
SELECT gen_salt('bf');
SELECT crypt('password', gen_salt('bf'));
\`\`\`

## Performance

### Connection Pooling
- Max connections: 20
- Idle timeout: 30s
- Connection timeout: 2s

### Monitoring
- Query statistics via pg_stat_statements
- Slow query log
- Index usage reports

## License

MIT
`
  }
};
