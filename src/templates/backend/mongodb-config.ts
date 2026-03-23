import { BackendTemplate } from '../types';

export const mongodbConfigTemplate: BackendTemplate = {
  id: 'mongodb-config',
  name: 'mongodb-config',
  displayName: 'MongoDB Advanced Configuration',
  description: 'MongoDB database setup with advanced features: replica sets, sharding, aggregation pipeline, change streams, and indexing',
  language: 'javascript',
  framework: 'mongodb',
  version: '1.0.0',
  tags: ['mongodb', 'mongo', 'database', 'replica', 'sharding', 'nosql', 'document'],
  port: 3000,
  dependencies: {},
  features: ['database', 'connection-pooling', 'monitoring'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "seed": "node scripts/seed.js"
  },
  "dependencies": {
    "mongodb": "^6.3.0",
    "express": "^4.18.2"
  }
}
`,

    'db/index.js': `import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || '{{projectName}}';

let client = null;
let db = null;

export async function connect() {
  if (client) return { client, db };

  client = new MongoClient(uri, {
    maxPoolSize: 20,
    minPoolSize: 5,
    maxIdleTimeMS: 60000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  await client.connect();
  db = client.db(dbName);

  console.log('Connected to MongoDB');

  return { client, db };
}

export function getDb() {
  if (!db) throw new Error('Database not connected. Call connect() first.');
  return db;
}

export function getClient() {
  if (!client) throw new Error('Database not connected. Call connect() first.');
  return client;
}

export async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await close();
  process.exit(0);
});
`,

    'db/collections/users.js': `export const userSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'name'],
      properties: {
        _id: { bsonType: 'objectId' },
        email: {
          bsonType: 'string',
          description: 'must be a string and is required'
        },
        name: {
          bsonType: 'string',
          description: 'must be a string and is required'
        },
        profile: {
          bsonType: 'object',
          properties: {
            role: { bsonType: 'string' },
            permissions: { bsonType: 'array', items: { bsonType: 'string' } },
            settings: { bsonType: 'object' }
          }
        },
        metadata: { bsonType: 'object' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  },
  validationLevel: 'moderate',
  validationAction: 'warn'
};

export const userIndexes = [
  { key: { email: 1 }, unique: true },
  { key: { name: 1 } },
  { key: { createdAt: -1 } },
  { key: { 'profile.role': 1 } }
];
`,

    'db/collections/products.js': `export const productSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'price'],
      properties: {
        _id: { bsonType: 'objectId' },
        name: { bsonType: 'string' },
        description: { bsonType: 'string' },
        price: { bsonType: 'number' },
        category: { bsonType: 'string' },
        tags: { bsonType: 'array', items: { bsonType: 'string' } },
        attributes: { bsonType: 'object' },
        stock: { bsonType: 'int' },
        variants: { bsonType: 'array' },
        reviews: { bsonType: 'array' },
        rating: { bsonType: 'number' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
};

export const productIndexes = [
  { key: { name: 'text', description: 'text' }, name: 'text_search' },
  { key: { category: 1 } },
  { key: { price: 1 } },
  { key: { stock: 1 } },
  { key: { rating: -1 } },
  { key: { tags: 1 } },
  { key: { 'attributes.brand': 1 } },
  { key: { createdAt: -1 } }
];
`,

    'db/collections/orders.js': `export const orderSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'items'],
      properties: {
        _id: { bsonType: 'objectId' },
        userId: { bsonType: 'objectId' },
        items: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['productId', 'quantity'],
            properties: {
              productId: { bsonType: 'objectId' },
              quantity: { bsonType: 'int' },
              price: { bsonType: 'number' }
            }
          }
        },
        total: { bsonType: 'number' },
        status: {
          bsonType: 'string',
          enum: ['pending', 'processing', 'completed', 'cancelled']
        },
        metadata: { bsonType: 'object' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
};

export const orderIndexes = [
  { key: { userId: 1 } },
  { key: { status: 1 } },
  { key: { createdAt: -1 } },
  { key: { userId: 1, createdAt: -1 } }
];
`,

    'db/queries/users.js': `import { ObjectId } from 'mongodb';
import { getDb } from '../index.js';

const COLLECTION = 'users';

export async function createUser({ email, name, profile = {}, metadata = {} }) {
  const db = getDb();
  const doc = {
    email,
    name,
    profile,
    metadata,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const result = await db.collection(COLLECTION).insertOne(doc);
  return getUserById(result.insertedId);
}

export async function getUserById(id) {
  const db = getDb();
  return await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
}

export async function getUserByEmail(email) {
  const db = getDb();
  return await db.collection(COLLECTION).findOne({ email });
}

export async function updateUserProfile(id, updates) {
  const db = getDb();
  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(id) },
    { 
      $set: { 
        ...updates, 
        updatedAt: new Date() 
      } 
    },
    { returnDocument: 'after' }
  );
  return result;
}

// Nested field queries
export async function getUsersByRole(role) {
  const db = getDb();
  return await db.collection(COLLECTION).find({ 
    'profile.role': role 
  }).toArray();
}

export async function getUsersWithPermission(permission) {
  const db = getDb();
  return await db.collection(COLLECTION).find({ 
    'profile.permissions': permission 
  }).toArray();
}

export async function getUserStats() {
  const db = getDb();
  return await db.collection(COLLECTION).aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        uniqueRoles: { $addToSet: '$profile.role' }
      }
    },
    {
      $project: {
        _id: 0,
        totalUsers: 1,
        uniqueRoles: { $size: '$uniqueRoles' }
      }
    }
  ]).next();
}

// Change stream for real-time updates
export function watchUsers() {
  const db = getDb();
  return db.collection(COLLECTION).watch();
}
`,

    'db/queries/products.js': `import { ObjectId } from 'mongodb';
import { getDb } from '../index.js';

const COLLECTION = 'products';

export async function createProduct({ name, description, price, category, tags = [], attributes = {}, stock = 0 }) {
  const db = getDb();
  const doc = {
    name,
    description,
    price,
    category,
    tags,
    attributes,
    stock,
    rating: 0,
    reviews: [],
    variants: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const result = await db.collection(COLLECTION).insertOne(doc);
  return getProductById(result.insertedId);
}

export async function getProductById(id) {
  const db = getDb();
  return await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
}

export async function getProductsByCategory(category) {
  const db = getDb();
  return await db.collection(COLLECTION).find({ category })
    .sort({ name: 1 })
    .toArray();
}

// Text search
export async function searchProducts(searchTerm, limit = 10) {
  const db = getDb();
  return await db.collection(COLLECTION).find(
    { $text: { $search: searchTerm } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .toArray();
}

// Get products by attribute
export async function getProductsByAttribute(key, value) {
  const db = getDb();
  return await db.collection(COLLECTION).find({ 
    [\`attributes.\${key}\`]: value 
  }).toArray();
}

// Get products by tags
export async function getProductsByTags(tags) {
  const db = getDb();
  return await db.collection(COLLECTION).find({ 
    tags: { $in: tags } 
  }).toArray();
}

// Aggregation pipeline - product stats by category
export async function getProductStatsByCategory() {
  const db = getDb();
  return await db.collection(COLLECTION).aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
        totalStock: { $sum: '$stock' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]).toArray();
}

// Get low stock products
export async function getLowStockProducts(threshold = 10) {
  const db = getDb();
  return await db.collection(COLLECTION).find({ 
    stock: { $lt: threshold } 
  })
    .sort({ stock: 1 })
    .toArray();
}

// Update product stock
export async function updateProductStock(id, quantity) {
  const db = getDb();
  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(id) },
    { 
      $inc: { stock: quantity },
      $set: { updatedAt: new Date() }
    },
    { returnDocument: 'after' }
  );
  return result;
}

// Faceted search
export async function facetSearch({ category, minPrice, maxPrice, tags, limit = 20 }) {
  const db = getDb();
  const filter = {};
  if (category) filter.category = category;
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = minPrice;
    if (maxPrice) filter.price.$lte = maxPrice;
  }
  if (tags && tags.length > 0) {
    filter.tags = { $in: tags };
  }

  const pipeline = [
    { $match: filter },
    {
      $facet: {
        products: [
          { $sort: { createdAt: -1 } },
          { $limit }
        ],
        categories: [
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ],
        priceRange: [
          {
            $group: {
              _id: null,
              min: { $min: '$price' },
              max: { $max: '$price' },
              avg: { $avg: '$price' }
            }
          }
        ],
        tags: [
          { $unwind: '$tags' },
          { $group: { _id: '$tags', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]
      }
    }
  ];

  const results = await db.collection(COLLECTION).aggregate(pipeline).next();
  return {
    products: results.products || [],
    facets: {
      categories: results.categories || [],
      priceRange: results.priceRange?.[0] || { min: 0, max: 0, avg: 0 },
      tags: results.tags || []
    }
  };
}
`,

    'db/queries/orders.js': `import { ObjectId } from 'mongodb';
import { getDb, getClient } from '../index.js';

const COLLECTION = 'orders';

export async function createOrder({ userId, items = [], metadata = {} }) {
  const db = getDb();
  const client = getClient();
  const session = client.startSession();

  try {
    await session.withTransaction(async () => {
      // Calculate total
      const products = await db.collection('products').find({
        _id: { $in: items.map(i => new ObjectId(i.productId)) }
      }).toArray();

      const productMap = new Map(products.map(p => [p._id.toString(), p]));

      let total = 0;
      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) throw new Error(\`Product \${item.productId} not found\`);
        total += product.price * (item.quantity || 1);
      }

      // Create order
      const orderResult = await db.collection(COLLECTION).insertOne({
        userId: new ObjectId(userId),
        items: items.map(item => ({
          productId: new ObjectId(item.productId),
          quantity: item.quantity || 1,
          price: productMap.get(item.productId).price
        })),
        total,
        status: 'pending',
        metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      }, { session });

      // Update product stock
      for (const item of items) {
        await db.collection('products').updateOne(
          { _id: new ObjectId(item.productId) },
          { $inc: { stock: -(item.quantity || 1) } },
          { session }
        );
      }

      return orderResult.insertedId;
    });

    return getOrderById(orderResult.insertedId);
  } finally {
    await session.endSession();
  }
}

export async function getOrderById(id) {
  const db = getDb();
  return await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
}

export async function getOrdersByUserId(userId) {
  const db = getDb();
  return await db.collection(COLLECTION).find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function updateOrderStatus(orderId, status) {
  const db = getDb();
  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(orderId) },
    { 
      $set: { 
        status, 
        updatedAt: new Date() 
      } 
    },
    { returnDocument: 'after' }
  );
  return result;
}

// Sales aggregation pipeline
export async function getSalesStats(days = 30) {
  const db = getDb();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return await db.collection(COLLECTION).aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          status: '$status'
        },
        totalRevenue: { $sum: '$total' },
        orderCount: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.date': 1 }
    }
  ]).toArray();
}
`,

    'index.js': `import express from 'express';
import { connect } from './db/index.js';
import * as usersDb from './db/queries/users.js';
import * as productsDb from './db/queries/products.js';
import * as ordersDb from './db/queries/orders.js';

const app = express();
app.use(express.json());

// Initialize MongoDB connection
await connect();

// Health check
app.get('/health', async (req, res) => {
  try {
    const db = req.db;
    await db.admin().ping();
    res.json({ status: 'healthy', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected', error: err.message });
  }
});

// User CRUD
app.post('/api/users', async (req, res) => {
  const user = await usersDb.createUser(req.body);
  res.json(user);
});

app.get('/api/users/:id', async (req, res) => {
  const user = await usersDb.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.patch('/api/users/:id', async (req, res) => {
  const user = await usersDb.updateUserProfile(req.params.id, req.body);
  res.json(user);
});

app.get('/api/users/role/:role', async (req, res) => {
  const users = await usersDb.getUsersByRole(req.params.role);
  res.json(users);
});

// Products with text search
app.post('/api/products', async (req, res) => {
  const product = await productsDb.createProduct(req.body);
  res.json(product);
});

app.get('/api/products/search', async (req, res) => {
  const products = await productsDb.searchProducts(req.query.q);
  res.json(products);
});

app.get('/api/products/facet', async (req, res) => {
  const filters = {
    category: req.query.category,
    minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
    tags: req.query.tags ? req.query.tags.split(',') : undefined
  };
  const results = await productsDb.facetSearch(filters);
  res.json(results);
});

app.get('/api/products/stats', async (req, res) => {
  const stats = await productsDb.getProductStatsByCategory();
  res.json(stats);
});

// Orders
app.post('/api/orders', async (req, res) => {
  const order = await ordersDb.createOrder(req.body);
  res.json(order);
});

app.get('/api/orders/:id', async (req, res) => {
  const order = await ordersDb.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
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
      - MONGODB_URI=mongodb://root:password@mongodb-primary:27017,mongodb-secondary-1:27018,mongodb-secondary-2:27019/{{projectName}}?replicaSet=rs0&authSource=admin
      - MONGODB_DB={{projectName}}
    depends_on:
      - mongodb-config
      - mongodb-primary
      - mongodb-secondary-1
      - mongodb-secondary-2
    restart: unless-stopped

  # MongoDB config server (for sharding)
  mongodb-config:
    image: mongo:7.0
    command: mongod --configsvr --replSet cfg-rs0 --port 27017 --bind_ip_all
    volumes:
      - mongo_config_data:/data/db
    restart: unless-stopped

  # MongoDB shard 1 primary
  mongodb-primary:
    image: mongo:7.0
    command: mongod --shardsvr --replSet rs0 --port 27017 --bind_ip_all
    environment:
      - MONGO_INITDB_ROOT_USERNAME=root
      - MONGO_INITDB_ROOT_PASSWORD=password
    volumes:
      - mongo_primary_data:/data/db
    ports:
      - "27017:27017"
    restart: unless-stopped

  # MongoDB shard 1 secondary 1
  mongodb-secondary-1:
    image: mongo:7.0
    command: mongod --shardsvr --replSet rs0 --port 27018 --bind_ip_all
    environment:
      - MONGO_INITDB_ROOT_USERNAME=root
      - MONGO_INITDB_ROOT_PASSWORD=password
    volumes:
      - mongo_secondary1_data:/data/db
    ports:
      - "27018:27018"
    restart: unless-stopped

  # MongoDB shard 1 secondary 2
  mongodb-secondary-2:
    image: mongo:7.0
    command: mongod --shardsvr --replSet rs0 --port 27019 --bind_ip_all
    environment:
      - MONGO_INITDB_ROOT_USERNAME=root
      - MONGO_INITDB_ROOT_PASSWORD=password
    volumes:
      - mongo_secondary2_data:/data/db
    ports:
      - "27019:27019"
    restart: unless-stopped

  # MongoDB router (mongos)
  mongos:
    image: mongo:7.0
    command: mongos --configdb cfg-rs0/mongodb-config:27017 --port 27020 --bind_ip_all
    ports:
      - "27020:27020"
    restart: unless-stopped

  # MongoDB Express for database management
  mongo-express:
    image: mongo-express:latest
    environment:
      - ME_CONFIG_MONGODB_URL=mongodb://root:password@mongodb-primary:27017/?authSource=admin
      - ME_CONFIG_BASICAUTH_USERNAME=admin
      - ME_CONFIG_BASICAUTH_PASSWORD=admin
    ports:
      - "8081:8081"
    depends_on:
      - mongodb-primary
    restart: unless-stopped

volumes:
  mongo_config_data:
  mongo_primary_data:
  mongo_secondary1_data:
  mongo_secondary2_data:
`,

    'scripts/setup-replica-set.sh': `#!/bin/bash
# Setup MongoDB replica set

echo "Setting up MongoDB replica set..."

# Connect to primary and initiate replica set
docker exec -it mongodb-primary mongosh --eval \`
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongodb-primary:27017" },
    { _id: 1, host: "mongodb-secondary-1:27018" },
    { _id: 2, host: "mongodb-secondary-2:27019" }
  ]
})
\`

echo "Waiting for replica set to initialize..."
sleep 10

# Check replica set status
docker exec -it mongodb-primary mongosh --eval "rs.status()"

echo "Replica set setup complete!"
`,

    'scripts/setup-sharding.sh': `#!/bin/bash
# Setup MongoDB sharding

echo "Setting up MongoDB sharding..."

# Setup config server replica set
docker exec -it mongodb-config mongosh --eval \`
rs.initiate({
  _id: "cfg-rs0",
  configsvr: true,
  members: [
    { _id: 0, host: "mongodb-config:27017" }
  ]
})
\`

# Wait for config replica set
sleep 10

# Add shard to router
docker exec -it mongos mongosh --eval \`
sh.addShard("rs0/mongodb-primary:27017,mongodb-secondary-1:27018,mongodb-secondary-2:27019")
\`

# Enable sharding for database
docker exec -it mongos mongosh --eval \`
sh.enableSharding("{{projectName}}")
\`

echo "Sharding setup complete!"
`,

    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
`,

    '.env.example': `# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB={{projectName}}

# For replica set:
# MONGODB_URI=mongodb://root:password@host1:27017,host2:27018,host3:27019/dbname?replicaSet=rs0&authSource=admin

# Server
PORT=3000
NODE_ENV=development
`,

    'README.md': `# {{projectName}}

MongoDB advanced configuration template with replica sets, sharding, aggregation pipeline, and change streams.

## Features

- **Replica Sets**: High availability with automatic failover
- **Sharding**: Horizontal scaling for large datasets
- **Aggregation Pipeline**: Powerful data transformation and analytics
- **Change Streams**: Real-time data updates
- **Document Validation**: Schema validation with JSON Schema
- **Text Search**: Full-text search with text indexes
- **Connection Pooling**: Optimized connection management

## Schema

### Users Collection
- Document validation with JSON Schema
- Email uniqueness index
- Nested profile and metadata fields
- Auto-update timestamps

### Products Collection
- Text search index on name/description
- Flexible attributes object
- Variants and reviews arrays
- Category, price, stock indexes

### Orders Collection
- Transactional updates with sessions
- Foreign key references to users/products
- Status workflow (pending, processing, completed, cancelled)
- Sales analytics with aggregation

## Quick Start

### Local Development (Single Node)

\\\`\\\`\\\`bash
# Install dependencies
npm install

# Start MongoDB
docker-compose up -d mongodb-primary

# Seed database
npm run seed

# Start server
npm start
\\\`\\\`\\\`

### With Replica Set

\\\`\\\`\\\`bash
# Start all MongoDB nodes
docker-compose up -d mongodb-primary mongodb-secondary-1 mongodb-secondary-2

# Setup replica set
chmod +x scripts/setup-replica-set.sh
./scripts/setup-replica-set.sh
\\\`\\\`\\\`

### With Sharding

\\\`\\\`\\\`bash
# Start all services
docker-compose up -d

# Setup sharding
chmod +x scripts/setup-sharding.sh
./scripts/setup-sharding.sh
\\\`\\\`\\\`

Access:
- Application: http://localhost:3000
- Mongo Express: http://localhost:8081
- MongoDB Primary: localhost:27017
- Mongos Router: localhost:27020

## Aggregation Examples

### Sales by Date

\\\`\\\`\\\`javascript
db.orders.aggregate([
  {
    $group: {
      _id: {
        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
      },
      totalRevenue: { $sum: '$total' },
      orderCount: { $sum: 1 }
    }
  }
])
\\\`\\\`\\\`

### Product Stats by Category

\\\`\\\`\\\`javascript
db.products.aggregate([
  {
    $group: {
      _id: '$category',
      count: { $sum: 1 },
      avgPrice: { $avg: '$price' }
    }
  }
])
\\\`\\\`\\\`

## Change Streams

Watch for real-time updates:

\\\`\\\`\\\`javascript
const changeStream = db.collection('users').watch();

changeStream.on('change', (change) => {
  console.log('Document changed:', change);
});
\\\`\\\`\\\`

## Performance

### Connection Pooling
- Max pool size: 20
- Min pool size: 5
- Max idle time: 60s

### Indexes
- Email (unique) on users
- Text search on products
- Compound indexes for common queries
- Nested field indexes

### Monitoring
- Slow query logs
- Index usage statistics
- Replication lag monitoring

## License

MIT
`
  }
};
