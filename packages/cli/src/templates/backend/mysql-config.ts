import { BackendTemplate } from '../types';

export const mysqlConfigTemplate: BackendTemplate = {
  id: 'mysql-config',
  name: 'mysql-config',
  displayName: 'MySQL/MariaDB Advanced Configuration',
  description: 'MySQL/MariaDB database setup with advanced features: JSON support, full-text search, connection pooling, optimizations, and replication setup',
  language: 'javascript',
  framework: 'mysql',
  version: '1.0.0',
  tags: ['mysql', 'mariadb', 'database', 'json', 'fulltext', 'replication', 'clustering'],
  port: 3000,
  dependencies: {},
  features: ['database', 'json', 'fulltext', 'connection-pooling', 'monitoring'],

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
    "mysql2": "^3.6.5",
    "express": "^4.18.2"
  }
}
`,

    'db/index.js': `import mysql from 'mysql2/promise';

const poolConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'password',
  database: process.env.MYSQL_DATABASE || 'dbname',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

export const pool = mysql.createPool(poolConfig);

export async function query(sql, params) {
  const start = Date.now();
  try {
    const [rows] = await pool.execute(sql, params);
    const duration = Date.now() - start;
    console.log('Executed query', { sql, duration, rows: rows.length });
    return rows;
  } catch (error) {
    console.error('Database query error', { sql, error });
    throw error;
  }
}

export async function getConnection() {
  const conn = await pool.getConnection();
  return conn;
}

export async function beginTransaction() {
  const conn = await getConnection();
  await conn.beginTransaction();
  return conn;
}

export async function commitTransaction(conn) {
  await conn.commit();
  conn.release();
}

export async function rollbackTransaction(conn) {
  await conn.rollback();
  conn.release();
}
`,

    'db/schema.sql': `-- Create database with optimized settings
CREATE DATABASE IF NOT EXISTS {{projectName}} 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE {{projectName}};

-- Users table with JSON support
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  profile JSON DEFAULT NULL,
  preferences JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Products table with full-text search
CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(100),
  attributes JSON DEFAULT NULL,
  stock INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FULLTEXT INDEX ft_name_description (name, description),
  INDEX idx_category (category),
  INDEX idx_price (price),
  INDEX idx_stock (stock)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Orders table with foreign keys
CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  status ENUM('pending', 'processing', 'completed', 'cancelled') DEFAULT 'pending',
  metadata JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_order_id (order_id),
  INDEX idx_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id INT UNSIGNED NOT NULL,
  action ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
  old_values JSON DEFAULT NULL,
  new_values JSON DEFAULT NULL,
  changed_by VARCHAR(255),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_table_record (table_name, record_id),
  INDEX idx_action (action),
  INDEX idx_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`,

    'db/migrations/001_initial.sql': `-- Migration: Initial schema
-- Run: npm run migrate

USE {{projectName}};

-- Create users table
CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`,

    'db/seed.sql': `-- Seed data for development

USE {{projectName}};

INSERT INTO users (email, name, profile) VALUES
  ('admin@example.com', 'Admin User', '{"role": "admin", "permissions": ["read", "write", "delete"]}'),
  ('user@example.com', 'Test User', '{"role": "user", "permissions": ["read"]}');

INSERT INTO products (name, description, price, category, attributes, stock) VALUES
  ('Product A', 'A great product', 29.99, 'Electronics', '{"brand": "TechCo", "warranty": "1 year"}', 100),
  ('Product B', 'Another great product', 49.99, 'Books', '{"author": "John Doe", "pages": 300}', 50),
  ('Product C', 'Amazing product', 19.99, 'Home', '{"material": "wood", "dimensions": "10x10x5"}', 75);
`,

    'db/queries/users.js': `import { query } from '../index.js';

export async function createUser({ email, name, profile = null }) {
  const sql = 'INSERT INTO users (email, name, profile) VALUES (?, ?, ?)';
  const params = [email, name, profile ? JSON.stringify(profile) : null];
  const result = await query(sql, params);
  return getUserById(result.insertId);
}

export async function getUserById(id) {
  const sql = 'SELECT * FROM users WHERE id = ?';
  const rows = await query(sql, [id]);
  return rows[0] || null;
}

export async function getUserByEmail(email) {
  const sql = 'SELECT * FROM users WHERE email = ?';
  const rows = await query(sql, [email]);
  return rows[0] || null;
}

export async function updateUserProfile(id, profile) {
  const sql = 'UPDATE users SET profile = ? WHERE id = ?';
  await query(sql, [JSON.stringify(profile), id]);
  return getUserById(id);
}

// JSON queries
export async function getUsersByProfileKey(key, value) {
  const sql = "SELECT * FROM users WHERE JSON_EXTRACT(profile, '$." + key + "') = ?";
  const rows = await query(sql, [value]);
  return rows;
}

export async function getUserStats() {
  const sql = \`
    SELECT 
      COUNT(*) as total_users,
      COUNT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(profile, '$.role'))) as unique_roles
    FROM users
  \`;
  const rows = await query(sql);
  return rows[0];
}
`,

    'db/queries/products.js': `import { query } from '../index.js';

export async function createProduct({ name, description, price, category, attributes = null, stock = 0 }) {
  const sql = 'INSERT INTO products (name, description, price, category, attributes, stock) VALUES (?, ?, ?, ?, ?, ?)';
  const params = [name, description, price, category, attributes ? JSON.stringify(attributes) : null, stock];
  const result = await query(sql, params);
  return getProductById(result.insertId);
}

export async function getProductById(id) {
  const sql = 'SELECT * FROM products WHERE id = ?';
  const rows = await query(sql, [id]);
  return rows[0] || null;
}

export async function getProductsByCategory(category) {
  const sql = 'SELECT * FROM products WHERE category = ? ORDER BY name';
  const rows = await query(sql, [category]);
  return rows;
}

// Query products by JSON attributes
export async function getProductsByAttribute(key, value) {
  const sql = "SELECT * FROM products WHERE JSON_EXTRACT(attributes, '$." + key + "') = ?";
  const rows = await query(sql, [value]);
  return rows;
}

// Full-text search with relevance scoring
export async function searchProducts(searchTerm, limit = 10) {
  const sql = \`
    SELECT *,
      MATCH(name, description) AGAINST (? IN NATURAL LANGUAGE MODE) as score
    FROM products
    WHERE MATCH(name, description) AGAINST (? IN NATURAL LANGUAGE MODE)
    ORDER BY score DESC
    LIMIT ?
  \`;
  const rows = await query(sql, [searchTerm, searchTerm, limit]);
  return rows;
}

// Boolean full-text search
export async function searchProductsBoolean(searchTerm, limit = 10) {
  const sql = \`
    SELECT *,
      MATCH(name, description) AGAINST (? IN BOOLEAN MODE) as score
    FROM products
    WHERE MATCH(name, description) AGAINST (? IN BOOLEAN MODE)
    ORDER BY score DESC
    LIMIT ?
  \`;
  const rows = await query(sql, [searchTerm, searchTerm, limit]);
  return rows;
}

// Get low stock products
export async function getLowStockProducts(threshold = 10) {
  const sql = 'SELECT * FROM products WHERE stock < ? ORDER BY stock ASC';
  const rows = await query(sql, [threshold]);
  return rows;
}

// Update product stock
export async function updateProductStock(id, quantity) {
  const sql = 'UPDATE products SET stock = stock + ? WHERE id = ?';
  await query(sql, [quantity, id]);
  return getProductById(id);
}
`,

    'db/queries/orders.js': `import { query, beginTransaction, commitTransaction, rollbackTransaction } from '../index.js';

export async function createOrder({ userId, items = [], metadata = null }) {
  const conn = await beginTransaction();
  try {
    // Calculate total
    let total = 0;
    for (const item of items) {
      const product = await query('SELECT price FROM products WHERE id = ?', [item.productId]);
      if (!product.length) throw new Error(\`Product \${item.productId} not found\`);
      total += product[0].price * item.quantity;
    }

    // Create order
    const [orderResult] = await query(
      'INSERT INTO orders (user_id, total, metadata) VALUES (?, ?, ?)',
      [userId, total, metadata ? JSON.stringify(metadata) : null]
    );

    // Create order items
    for (const item of items) {
      const product = await query('SELECT price FROM products WHERE id = ?', [item.productId]);
      await query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderResult.insertId, item.productId, item.quantity, product[0].price]
      );

      // Update stock
      await query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.productId]
      );
    }

    await commitTransaction(conn);
    return getOrderById(orderResult.insertId);
  } catch (error) {
    await rollbackTransaction(conn);
    throw error;
  }
}

export async function getOrderById(id) {
  const sql = 'SELECT * FROM orders WHERE id = ?';
  const rows = await query(sql, [id]);
  return rows[0] || null;
}

export async function getOrdersByUserId(userId) {
  const sql = 'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC';
  const rows = await query(sql, [userId]);
  return rows;
}

export async function getOrderItems(orderId) {
  const sql = \`
    SELECT oi.*, p.name as product_name
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  \`;
  const rows = await query(sql, [orderId]);
  return rows;
}

export async function updateOrderStatus(orderId, status) {
  const sql = 'UPDATE orders SET status = ? WHERE id = ?';
  await query(sql, [status, orderId]);
  return getOrderById(orderId);
}
`,

    'index.js': `import express from 'express';
import * as usersDb from './db/queries/users.js';
import * as productsDb from './db/queries/products.js';
import * as ordersDb from './db/queries/orders.js';

const app = express();
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    await req.db.pool.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected', error: err.message });
  }
});

// User CRUD with JSON
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

// JSON query example
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

app.get('/api/products/low-stock', async (req, res) => {
  const threshold = parseInt(req.query.threshold) || 10;
  const products = await productsDb.getLowStockProducts(threshold);
  res.json(products);
});

// Orders
app.post('/api/orders', async (req, res) => {
  const order = await ordersDb.createOrder(req.body);
  res.json(order);
});

app.get('/api/orders/:id', async (req, res) => {
  const order = await ordersDb.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const items = await ordersDb.getOrderItems(req.params.id);
  res.json({ ...order, items });
});

app.patch('/api/orders/:id/status', async (req, res) => {
  const order = await ordersDb.updateOrderStatus(req.params.id, req.body.status);
  res.json(order);
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
      - MYSQL_HOST=mysql-primary
      - MYSQL_PORT=3306
      - MYSQL_USER=user
      - MYSQL_PASSWORD=password
      - MYSQL_DATABASE=dbname
    depends_on:
      - mysql-primary
    restart: unless-stopped

  # Primary MySQL server
  mysql-primary:
    image: mysql:8.0
    ports:
      - "3306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=rootpassword
      - MYSQL_DATABASE=dbname
      - MYSQL_USER=user
      - MYSQL_PASSWORD=password
    volumes:
      - mysql_primary_data:/var/lib/mysql
      - ./db/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
      - ./db/seed.sql:/docker-entrypoint-initdb.d/02-seed.sql
      - ./config/mysql-primary.cnf:/etc/mysql/conf.d/custom.cnf
    command: --default-authentication-plugin=mysql_native_password
    restart: unless-stopped

  # Replica MySQL server
  mysql-replica:
    image: mysql:8.0
    ports:
      - "3307:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=rootpassword
      - MYSQL_DATABASE=dbname
      - MYSQL_USER=user
      - MYSQL_PASSWORD=password
    volumes:
      - mysql_replica_data:/var/lib/mysql
      - ./config/mysql-replica.cnf:/etc/mysql/conf.d/custom.cnf
    command: --default-authentication-plugin=mysql_native_password
    restart: unless-stopped

  # PhpMyAdmin for database management
  phpmyadmin:
    image: phpmyadmin:latest
    environment:
      - PMA_HOST=mysql-primary
      - PMA_PORT=3306
      - PMA_USER=user
      - PMA_PASSWORD=password
    ports:
      - "8080:80"
    depends_on:
      - mysql-primary

volumes:
  mysql_primary_data:
  mysql_replica_data:
`,

    'config/mysql-primary.cnf': `[mysqld]
# Server ID for replication
server-id=1

# Binary logging for replication
log-bin=mysql-bin
binlog-format=ROW
binlog-row-image=FULL

# GTID for global transaction identification
gtid-mode=ON
enforce-gtid-consistency=ON

# InnoDB configuration
innodb_buffer_pool_size=1G
innodb_log_file_size=256M
innodb_flush_log_at_trx_commit=2
innodb_flush_method=O_DIRECT

# Connection settings
max_connections=200
max_allowed_packet=64M

# Slow query log
slow_query_log=1
slow_query_log_file=/var/log/mysql/slow.log
long_query_time=2

# Character set
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci

[client]
default-character-set=utf8mb4
`,

    'config/mysql-replica.cnf': `[mysqld]
# Server ID for replication (must be different from primary)
server-id=2

# Binary logging (replica can also be a primary to other replicas)
log-bin=mysql-bin
binlog-format=ROW
binlog-row-image=FULL

# GTID for global transaction identification
gtid-mode=ON
enforce-gtid-consistency=ON

# Replica settings
relay-log=relay-bin
read-only=1

# InnoDB configuration
innodb_buffer_pool_size=1G
innodb_log_file_size=256M
innodb_flush_log_at_trx_commit=2
innodb_flush_method=O_DIRECT

# Connection settings
max_connections=200
max_allowed_packet=64M

# Slow query log
slow_query_log=1
slow_query_log_file=/var/log/mysql/slow.log
long_query_time=2

# Character set
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci

[client]
default-character-set=utf8mb4
`,

    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
`,

    '.env.example': `# MySQL Configuration
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=user
MYSQL_PASSWORD=password
MYSQL_DATABASE=dbname

# Server
PORT=3000
NODE_ENV=development
`,

    'README.md': `# {{projectName}}

MySQL/MariaDB advanced configuration template with JSON support, full-text search, replication, and optimizations.

## Features

- **JSON Support**: JSON document storage with JSON_EXTRACT queries
- **Full-Text Search**: MySQL FULLTEXT indexes with relevance scoring
- **Connection Pooling**: mysql2 pool with configurable limits
- **Replication Setup**: Primary-replica configuration with GTID
- **Optimization**: InnoDB tuning, slow query logging, binary logging
- **Foreign Keys**: Referential integrity with CASCADE operations
- **Transactions**: ACID-compliant transaction support

## Schema

### Users Table
- JSON profile and preferences
- Email uniqueness with index
- Auto-update timestamps

### Products Table
- JSON attributes for flexible metadata
- FULLTEXT index on name/description
- Stock tracking
- Price and category indexing

### Orders/Order Items Tables
- Foreign key relationships
- Order status workflow
- Automatic stock updates

## Quick Start

### Local Development

\\\`\\\`\\\`bash
# Start MySQL
docker-compose up -d mysql-primary

# Run migrations
npm run migrate

# Seed database
npm run seed

# Start server
npm start
\\\`\\\`\\\`

### With Replication

\\\`\\\`\\\`bash
docker-compose up
\\\`\\\`\\\`

Access:
- Application: http://localhost:3000
- PhpMyAdmin: http://localhost:8080
- MySQL Primary: localhost:3306
- MySQL Replica: localhost:3307

## JSON Queries

### Get by JSON key
\\\`\\\`\\\`sql
SELECT * FROM users WHERE JSON_EXTRACT(profile, '$.role') = 'admin';
\\\`\\\`\\\`

## Full-Text Search

### Natural language search
\\\`\\\`\\\`sql
SELECT *, MATCH(name, description) AGAINST ('wireless' IN NATURAL LANGUAGE MODE) as score
FROM products
WHERE MATCH(name, description) AGAINST ('wireless' IN NATURAL LANGUAGE MODE)
ORDER BY score DESC;
\\\`\\\`\\\`

## License

MIT
`
  }
};
