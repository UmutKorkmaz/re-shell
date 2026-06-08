import { BackendTemplate } from '../types';

export const couchdbConfigTemplate: BackendTemplate = {
  id: 'couchdb-config',
  name: 'couchdb-config',
  displayName: 'CouchDB/CouchBase Advanced Configuration',
  description: 'CouchDB/CouchBase database setup with advanced features: MapReduce views, document replication, conflict resolution, and multi-master clustering',
  language: 'javascript',
  framework: 'couchdb',
  version: '1.0.0',
  tags: ['couchdb', 'couchbase', 'database', 'nosql', 'document', 'replication', 'clustering'],
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
    "nano": "^10.0.0",
    "express": "^4.18.2",
    "couchbase": "^4.2.0"
  }
}
`,

    'db/couchdb.js': `import nano from 'nano';

const couchUrl = process.env.COUCHDB_URL || 'http://localhost:5984';
const dbName = process.env.COUCHDB_DB || '{{projectName}}';

export const couch = nano(couchUrl);

export let db = null;

export async function connect() {
  try {
    // Check if database exists
    const databases = await couch.db.list();
    if (!databases.includes(dbName)) {
      await couch.db.create(dbName);
      console.log(\`Created database: \${dbName}\`);
    }
    db = couch.use(dbName);
    
    // Create design documents
    await createDesignDocuments();
    
    console.log('Connected to CouchDB');
    return db;
  } catch (error) {
    console.error('Failed to connect to CouchDB:', error);
    throw error;
  }
}

export function getDb() {
  if (!db) throw new Error('Database not connected. Call connect() first.');
  return db;
}

export async function createDesignDocuments() {
  const designDoc = {
    views: {
      by_email: {
        map: function (doc) {
          if (doc.email) emit(doc.email, doc);
        }.toString()
      },
      by_name: {
        map: function (doc) {
          if (doc.name) emit(doc.name, doc);
        }.toString()
      },
      by_role: {
        map: function (doc) {
          if (doc.profile && doc.profile.role) emit(doc.profile.role, doc);
        }.toString()
      },
      by_created: {
        map: function (doc) {
          if (doc.createdAt) emit(doc.createdAt, doc);
        }.toString()
      }
    },
    lists: {
      json: function (head, req) {
        provides('json', function () {
          const results = [];
          while (row = getRow()) {
            results.push(row.value);
          }
          send(JSON.stringify(results));
        });
      }.toString()
    }
  };

  try {
    await db.insert(designDoc, '_design/users');
  } catch (error) {
    if (error.statusCode !== 409) throw error;
    // Design document already exists
  }
}

export async function getDocument(id) {
  const database = getDb();
  try {
    return await database.get(id);
  } catch (error) {
    if (error.statusCode === 404) return null;
    throw error;
  }
}

export async function insertDocument(doc) {
  const database = getDb();
  const result = await database.insert(doc);
  return await getDocument(result.id);
}

export async function updateDocument(id, updates) {
  const database = getDb();
  const doc = await getDocument(id);
  if (!doc) throw new Error('Document not found');
  
  const updatedDoc = { ...doc, ...updates };
  const result = await database.insert(updatedDoc);
  return await getDocument(result.id);
}

export async function deleteDocument(id) {
  const database = getDb();
  const doc = await getDocument(id);
  if (!doc) throw new Error('Document not found');
  
  await database.destroy(id, doc._rev);
  return { id, deleted: true };
}

// View queries
export async function queryView(designDoc, viewName, options = {}) {
  const database = getDb();
  return await database.view(designDoc, viewName, options);
}

// Mango queries (NQL)
export async function findDocuments(selector, options = {}) {
  const database = getDb();
  return await database.find({ selector, ...options });
}
`,

    'db/couchbase.js': `import { Cluster } from 'couchbase';

const couchbaseUrl = process.env.COUCHBASE_URL || 'couchbase://localhost';
const username = process.env.COUCHBASE_USERNAME || 'Administrator';
const password = process.env.COUCHBASE_PASSWORD || 'password';
const bucketName = process.env.COUCHBASE_BUCKET || '{{projectName}}';

export let cluster = null;
export let bucket = null;
export let collection = null;

export async function connectCouchbase() {
  try {
    cluster = await Cluster.connect(couchbaseUrl, {
      username: username,
      password: password,
    });

    bucket = cluster.bucket(bucketName);
    collection = bucket.defaultCollection();

    // Create primary index if not exists
    try {
      await cluster.query(\`CREATE PRIMARY INDEX ON \\\`\${bucketName}\\\`\`);
    } catch (error) {
      // Index might already exist
    }

    console.log('Connected to Couchbase');
    return { cluster, bucket, collection };
  } catch (error) {
    console.error('Failed to connect to Couchbase:', error);
    throw error;
  }
}

export function getCollection() {
  if (!collection) throw new Error('Couchbase not connected. Call connectCouchbase() first.');
  return collection;
}

export async function getDocumentCouchbase(id) {
  const coll = getCollection();
  try {
    const result = await coll.get(id);
    return result.content;
  } catch (error) {
    if (error.cause === 13) return null; // Document not found
    throw error;
  }
}

export async function insertDocumentCouchbase(id, doc) {
  const coll = getCollection();
  await coll.insert(id, {
    ...doc,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return await getDocumentCouchbase(id);
}

export async function updateDocumentCouchbase(id, updates) {
  const coll = getCollection();
  const doc = await getDocumentCouchbase(id);
  if (!doc) throw new Error('Document not found');
  
  await coll.replace(id, {
    ...doc,
    ...updates,
    updatedAt: new Date().toISOString()
  });
  return await getDocumentCouchbase(id);
}

export async function deleteDocumentCouchbase(id) {
  const coll = getCollection();
  await coll.remove(id);
  return { id, deleted: true };
}

// N1QL queries
export async function executeQuery(query, params = {}) {
  const cluster = getCluster();
  const result = await cluster.query(query, { parameters: params });
  return await result.rows;
}

function getCluster() {
  if (!cluster) throw new Error('Couchbase not connected. Call connectCouchbase() first.');
  return cluster;
}
`,

    'db/queries/users.js': `import { getDb, findDocuments } from '../couchdb.js';

export async function createUser({ email, name, profile = {}, metadata = {} }) {
  const db = getDb();
  const doc = {
    _id: \`user_\${email}\`,
    type: 'user',
    email,
    name,
    profile,
    metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const result = await db.insert(doc);
  return await db.get(result.id);
}

export async function getUserById(id) {
  const db = getDb();
  try {
    return await db.get(id);
  } catch (error) {
    if (error.statusCode === 404) return null;
    throw error;
  }
}

export async function getUserByEmail(email) {
  return await getUserById(\`user_\${email}\`);
}

export async function updateUser(id, updates) {
  const db = getDb();
  const doc = await getUserById(id);
  if (!doc) throw new Error('User not found');
  
  const updatedDoc = {
    ...doc,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  const result = await db.insert(updatedDoc);
  return await db.get(result.id);
}

// Mango query - find by role
export async function getUsersByRole(role) {
  return await findDocuments({
    type: 'user',
    'profile.role': role
  });
}

// View query - get users by creation date
export async function getUsersByCreatedDate(limit = 20) {
  const db = getDb();
  return await db.view('users', 'by_created', {
    descending: true,
    limit,
    include_docs: true
  });
}
`,

    'db/queries/products.js': `import { getDb, findDocuments } from '../couchdb.js';

export async function createProduct({ name, description, price, category, tags = [], attributes = {} }) {
  const db = getDb();
  const id = \`product_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
  const doc = {
    _id: id,
    type: 'product',
    name,
    description,
    price,
    category,
    tags,
    attributes,
    stock: 0,
    reviews: [],
    rating: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const result = await db.insert(doc);
  return await db.get(result.id);
}

export async function getProductById(id) {
  const db = getDb();
  try {
    return await db.get(id);
  } catch (error) {
    if (error.statusCode === 404) return null;
    throw error;
  }
}

export async function getProductsByCategory(category) {
  return await findDocuments({
    type: 'product',
    category: category
  });
}

// Full-text search using Cloudant query syntax
export async function searchProducts(searchTerm) {
  return await findDocuments({
    type: 'product',
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } }
    ]
  });
}

// Get products by tags
export async function getProductsByTags(tags) {
  return await findDocuments({
    type: 'product',
    tags: { $in: tags }
  });
}
`,

    'index.js': `import express from 'express';
import { connect } from './db/couchdb.js';
import * as usersDb from './db/queries/users.js';
import * as productsDb from './db/queries/products.js';

const app = express();
app.use(express.json());

// Initialize CouchDB connection
await connect();

// Health check
app.get('/health', async (req, res) => {
  try {
    const db = req.db;
    await db.info();
    res.json({ status: 'healthy', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected', error: err.message });
  }
});

// Database info
app.get('/api/db/info', async (req, res) => {
  const db = req.db;
  const info = await db.info();
  res.json(info);
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

app.put('/api/users/:id', async (req, res) => {
  const user = await usersDb.updateUser(req.params.id, req.body);
  res.json(user);
});

app.get('/api/users/role/:role', async (req, res) => {
  const users = await usersDb.getUsersByRole(req.params.role);
  res.json(users);
});

// Products
app.post('/api/products', async (req, res) => {
  const product = await productsDb.createProduct(req.body);
  res.json(product);
});

app.get('/api/products/:id', async (req, res) => {
  const product = await productsDb.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
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
      - COUCHDB_URL=http://admin:password@couchdb-primary:5984
      - COUCHDB_DB={{projectName}}
    depends_on:
      - couchdb-primary
      - couchdb-secondary-1
      - couchdb-secondary-2
    restart: unless-stopped

  # CouchDB primary node
  couchdb-primary:
    image: couchdb:3.3
    ports:
      - "5984:5984"
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=password
      - NODENAME=couchdb@localhost
    volumes:
      - couchdb_primary_data:/opt/couchdb/data
    restart: unless-stopped

  # CouchDB secondary node 1
  couchdb-secondary-1:
    image: couchdb:3.3
    ports:
      - "5985:5984"
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=password
      - NODENAME=couchdb@localhost
    volumes:
      - couchdb_secondary1_data:/opt/couchdb/data
    restart: unless-stopped

  # CouchDB secondary node 2
  couchdb-secondary-2:
    image: couchdb:3.3
    ports:
      - "5986:5984"
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=password
      - NODENAME=couchdb@localhost
    volumes:
      - couchdb_secondary2_data:/opt/couchdb/data
    restart: unless-stopped

  # Couchbase service
  couchbase:
    image: couchbase:enterprise-7.2.0
    ports:
      - "8091-8096:8091-8096"
      - "11210-11211:11210-11211"
    environment:
      - COUCHBASE_ADMINISTRATOR_USERNAME=Administrator
      - COUCHBASE_ADMINISTRATOR_PASSWORD=password
    volumes:
      - couchbase_data:/opt/couchbase/var
    restart: unless-stopped

volumes:
  couchdb_primary_data:
  couchdb_secondary1_data:
  couchdb_secondary2_data:
  couchbase_data:
`,

    'scripts/setup-cluster.sh': `#!/bin/bash
# Setup CouchDB cluster

echo "Setting up CouchDB cluster..."

# Enable cluster
curl -X POST -H "Content-Type: application/json" \\
  http://admin:password@localhost:5984/_cluster_setup \\
  -d '{
    "action": "enable_cluster",
    "username": "admin",
    "password": "password",
    "bind_address": "0.0.0.0",
    "node_count": 3,
    "port": 5984,
    "remote_node": "couchdb-secondary-1",
    "remote_current_user": "admin",
    "remote_current_password": "password"
  }'

# Add nodes to cluster
curl -X POST -H "Content-Type: application/json" \\
  http://admin:password@localhost:5984/_cluster_setup \\
  -d '{
    "action": "add_node",
    "host": "couchdb-secondary-1",
    "port": 5984,
    "username": "admin",
    "password": "password"
  }'

curl -X POST -H "Content-Type: application/json" \\
  http://admin:password@localhost:5984/_cluster_setup \\
  -d '{
    "action": "add_node",
    "host": "couchdb-secondary-2",
    "port": 5984,
    "username": "admin",
    "password": "password"
  }'

echo "Cluster setup complete!"
`,

    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
`,

    '.env.example': `# CouchDB Configuration
COUCHDB_URL=http://admin:password@localhost:5984
COUCHDB_DB={{projectName}}

# Couchbase Configuration
COUCHBASE_URL=couchbase://localhost
COUCHBASE_USERNAME=Administrator
COUCHBASE_PASSWORD=password
COUCHBASE_BUCKET={{projectName}}

# Server
PORT=3000
NODE_ENV=development
`,

    'README.md': `# {{projectName}}

CouchDB/CouchBase advanced configuration template with MapReduce views, document replication, and multi-master clustering.

## Features

- **CouchDB**: NoSQL document database with HTTP API
- **MapReduce Views**: Flexible data indexing and querying
- **Mango Queries**: NQL (MongoDB-like query language)
- **Multi-Master Replication**: Automatic conflict resolution
- **Offline-First Sync**: Perfect for mobile/edge applications
- **Couchbase Support**: Enterprise-grade document database
- **Document Validation**: JSON Schema support

## Quick Start

### Local Development

\\\`\\\`\\\`bash
# Start CouchDB
docker-compose up -d couchdb-primary

# Seed database
npm run seed

# Start server
npm start
\\\`\\\`\\\`

### With Cluster

\\\`\\\`\\\`bash
# Start all nodes
docker-compose up -d

# Setup cluster
chmod +x scripts/setup-cluster.sh
./scripts/setup-cluster.sh
\\\`\\\`\\\`

Access:
- Application: http://localhost:3000
- CouchDB Primary: http://localhost:5984/_utils
- CouchDB Secondary 1: http://localhost:5985/_utils
- CouchDB Secondary 2: http://localhost:5986/_utils
- Couchbase Console: http://localhost:8091

## MapReduce Views

### Define View

\\\`\\\`\\\`javascript
{
  "views": {
    "by_email": {
      "map": "function(doc) { if(doc.email) emit(doc.email, doc); }"
    }
  }
}
\\\`\\\`\\\`

### Query View

\\\`\\\`\\\`bash
curl http://localhost:5984/{{projectName}}/_design/users/_view/by_email
\\\`\\\`\\\`

## Mango Queries

### Find by field

\\\`\\\`\\\`javascript
db.find({
  selector: {
    type: 'user',
    'profile.role': 'admin'
  }
})
\\\`\\\`\\\`

### Full-text search

\\\`\\\`\\\`javascript
db.find({
  selector: {
    name: { '$regex': 'test', '$options': 'i' }
  }
})
\\\`\\\`\\\`

## Replication

### Setup continuous replication

\\\`\\\`\\\`bash
curl -X POST http://localhost:5984/_replicator \\
  -H "Content-Type: application/json" \\
  -d '{
    "_id": "my_replication",
    "source": "http://admin:password@localhost:5984/source_db",
    "target": "http://admin:password@remote:5984/target_db",
    "continuous": true
  }'
\\\`\\\`\\\`

## License

MIT
`
  }
};
