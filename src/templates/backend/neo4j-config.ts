import { BackendTemplate } from '../types';

export const neo4jConfigTemplate: BackendTemplate = {
  id: 'neo4j-config',
  name: 'neo4j-config',
  displayName: 'Neo4j Graph Database',
  description: 'Neo4j graph database setup with advanced features: Cypher queries, relationship mapping, graph algorithms, and visualization',
  language: 'javascript',
  framework: 'neo4j',
  version: '1.0.0',
  tags: ['neo4j', 'graph', 'database', 'cypher', 'nosql', 'relationships', 'algorithms'],
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
    "neo4j-driver": "^5.15.0",
    "express": "^4.18.2"
  }
}
`,

    'db/index.js': `import neo4j from 'neo4j-driver';

const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const user = process.env.NEO4J_USER || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'password';

export const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
  maxConnectionPoolSize: 20,
  connectionTimeout: 30000,
  maxTransactionRetryTime: 30000
});

export async function getSession() {
  return driver.session();
}

export async function executeQuery(cypher, params = {}) {
  const session = await getSession();
  try {
    const result = await session.run(cypher, params);
    return result.records.map(record => record.toObject());
  } finally {
    await session.close();
  }
}

export async function executeWrite(cypher, params = {}) {
  const session = await getSession();
  try {
    const result = await session.executeWrite(tx => tx.run(cypher, params));
    return result.records.map(record => record.toObject());
  } finally {
    await session.close();
  }
}

export async function close() {
  await driver.close();
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

    'db/models/user.js': `import { executeWrite, executeQuery } from '../index.js';

export async function createUser({ name, email, born = null }) {
  const cypher = \`
    CREATE (u:User {
      id: randomUUID(),
      name: $name,
      email: $email,
      born: $born,
      createdAt: datetime()
    })
    RETURN u
  \`;
  
  const results = await executeWrite(cypher, { name, email, born });
  return results[0]?.u;
}

export async function getUserById(id) {
  const cypher = \`
    MATCH (u:User {id: $id})
    RETURN u
  \`;
  const results = await executeQuery(cypher, { id });
  return results[0]?.u;
}

export async function getUserByEmail(email) {
  const cypher = \`
    MATCH (u:User {email: $email})
    RETURN u
  \`;
  const results = await executeQuery(cypher, { email });
  return results[0]?.u;
}

export async function updateUser(id, updates) {
  const cypher = \`
    MATCH (u:User {id: $id})
    SET u += $updates
    RETURN u
  \`;
  const results = await executeWrite(cypher, { id, updates });
  return results[0]?.u;
}

export async function deleteUser(id) {
  const cypher = \`
    MATCH (u:User {id: $id})
    DETACH DELETE u
  \`;
  await executeWrite(cypher, { id });
  return { deleted: true };
}

// Add friendship relationship
export async function addFriendship(user1Id, user2Id, since = null) {
  const cypher = \`
    MATCH (u1:User {id: $user1Id})
    MATCH (u2:User {id: $user2Id})
    CREATE (u1)-[f:FRIENDS_WITH]->(u2)
    SET f.since = $since,
        f.createdAt = datetime()
    RETURN f
  \`;
  
  const results = await executeWrite(cypher, { 
    user1Id, 
    user2Id, 
    since: since || new Date().toISOString() 
  });
  return results[0]?.f;
}

// Get friends of user
export async function getFriends(userId, depth = 1) {
  const cypher = \`
    MATCH (u:User {id: $id})-[:FRIENDS_WITH*1..\${depth}]-(friend:User)
    RETURN DISTINCT friend
    ORDER BY friend.name
  \`;
  const results = await executeQuery(cypher, { id: userId });
  return results.map(r => r.friend);
}

// Get friends of friends (foaf)
export async function getFriendsOfFriends(userId) {
  const cypher = \`
    MATCH (u:User {id: $id})-[:FRIENDS_WITH]->(friend)-[:FRIENDS_WITH]->(foaf:User)
    WHERE NOT (u)-[:FRIENDS_WITH]-(foaf) AND u <> foaf
    RETURN foaf, COUNT(DISTINCT friend) as mutualFriends
    ORDER BY mutualFriends DESC
    LIMIT 10
  \`;
  const results = await executeQuery(cypher, { id: userId });
  return results.map(r => ({ ...r.foaf, mutualFriends: r.mutualFriends.toNumber() }));
}
`,

    'db/models/product.js': `import { executeWrite, executeQuery } from '../index.js';

export async function createProduct({ name, price, category }) {
  const cypher = \`
    CREATE (p:Product {
      id: randomUUID(),
      name: $name,
      price: $price,
      category: $category,
      createdAt: datetime()
    })
    RETURN p
  \`;
  
  const results = await executeWrite(cypher, { name, price: parseFloat(price), category });
  return results[0]?.p;
}

export async function getProductById(id) {
  const cypher = \`
    MATCH (p:Product {id: $id})
    RETURN p
  \`;
  const results = await executeQuery(cypher, { id });
  return results[0]?.p;
}

export async function getProductsByCategory(category) {
  const cypher = \`
    MATCH (p:Product {category: $category})
    RETURN p
    ORDER BY p.name
  \`;
  const results = await executeQuery(cypher, { category });
  return results.map(r => r.p);
}

// Get product recommendations based on what similar users bought
export async function getProductRecommendations(userId, limit = 10) {
  const cypher = \`
    // Find users who bought similar products
    MATCH (u:User {id: $id})-[:BOUGHT]->(:Product)<-[:BOUGHT]-(other:User)
    
    // Find products those users bought that this user hasn't
    MATCH (other)-[:BOUGHT]->(rec:Product)
    WHERE NOT (u)-[:BOUGHT]->(rec)
    
    RETURN rec, COUNT(DISTINCT other) as score
    ORDER BY score DESC
    LIMIT $limit
  \`;
  
  const results = await executeQuery(cypher, { id: userId, limit });
  return results.map(r => ({ ...r.rec, score: r.score.toNumber() }));
}

// Get products frequently bought together
export async function getFrequentlyBoughtTogether(productId, limit = 5) {
  const cypher = \`
    // Find users who bought this product
    MATCH (p:Product {id: $id})<-[:BOUGHT]-(u:User)
    
    // Find other products those users bought
    MATCH (u)-[:BOUGHT]->(other:Product)
    WHERE other.id <> $id
    
    RETURN other, COUNT(DISTINCT u) as frequency
    ORDER BY frequency DESC
    LIMIT $limit
  \`;
  
  const results = await executeQuery(cypher, { id: productId, limit });
  return results.map(r => ({ ...r.other, frequency: r.frequency.toNumber() }));
}
`,

    'db/queries/social.js': `import { executeQuery } from '../index.js';

// Find shortest path between two users
export async function findShortestPath(user1Id, user2Id) {
  const cypher = \`
    MATCH path = shortestPath(
      (u1:User {id: $user1Id})-[:FRIENDS_WITH*]-(u2:User {id: $user2Id})
    )
    RETURN [node IN nodes(path) | node.name] as names,
           length(path) as degrees
  \`;
  
  const results = await executeQuery(cypher, { user1Id, user2Id });
  return results[0];
}

// Find common friends between two users
export async function findCommonFriends(user1Id, user2Id) {
  const cypher = \`
    MATCH (u1:User {id: $user1Id})-[:FRIENDS_WITH]-(common:User)-[:FRIENDS_WITH]-(u2:User {id: $user2Id})
    RETURN common
    ORDER BY common.name
  \`;
  
  const results = await executeQuery(cypher, { user1Id, user2Id });
  return results.map(r => r.common);
}

// Get user influence (number of friends within N degrees)
export async function getUserInfluence(userId, maxDegrees = 3) {
  const cypher = \`
    MATCH (u:User {id: $id})-[:FRIENDS_WITH*1..\${maxDegrees}]-(reachable:User)
    RETURN u.name as userName,
           COUNT(DISTINCT reachable) as reachableCount
  \`;
  
  const results = await executeQuery(cypher, { id: userId });
  return results[0];
}

// Find clusters of connected friends
export async function findFriendClusters(userId) {
  const cypher = \`
    MATCH (u:User {id: $id})-[:FRIENDS_WITH*1..2]-(friend:User)
    WITH u, collect(DISTINCT friend) as friends
    
    UNWIND friends as f1
    UNWIND friends as f2
    WITH f1, f2
    MATCH (f1)-[:FRIENDS_WITH]-(f2)
    WHERE id(f1) < id(f2)
    WITH f1.cluster as c1, f2.cluster as c2, count(*) as connections
    WHERE connections > 1
    RETURN c1, c2, connections
    ORDER BY connections DESC
  \`;
  
  const results = await executeQuery(cypher, { id: userId });
  return results;
}

// Social recommendation - suggest people you may know
export async function suggestPeopleYouMayKnow(userId, limit = 10) {
  const cypher = \`
    // Find friends of friends who aren't already friends
    MATCH (u:User {id: $id})-[:FRIENDS_WITH]->(friend)-[:FRIENDS_WITH]->(suggestion:User)
    WHERE NOT (u)-[:FRIENDS_WITH]-(suggestion) AND u <> suggestion
    
    // Count mutual friends
    WITH suggestion, COUNT(DISTINCT friend) as mutualFriends
    WHERE mutualFriends >= 2
    
    RETURN suggestion, mutualFriends
    ORDER BY mutualFriends DESC
    LIMIT $limit
  \`;
  
  const results = await executeQuery(cypher, { id: userId, limit });
  return results.map(r => ({ ...r.suggestion, mutualFriends: r.mutualFriends.toNumber() }));
}
`,

    'db/queries/recommendations.js': `import { executeQuery } from '../index.js';

// Content-based filtering - find similar products
export async function findSimilarProducts(productId, limit = 5) {
  const cypher = \`
    // Get the product category
    MATCH (p:Product {id: $id})
    
    // Find products in the same category
    MATCH (similar:Product {category: p.category})
    WHERE similar.id <> $id
    
    // Count co-purchases
    OPTIONAL MATCH (u:User)-[:BOUGHT]->(p)
    OPTIONAL MATCH (u)-[:BOUGHT]->(similar)
    
    WITH similar, COUNT(DISTINCT u) as coPurchases
    RETURN similar, coPurchases
    ORDER BY coPurchases DESC
    LIMIT $limit
  \`;
  
  const results = await executeQuery(cypher, { id: productId, limit });
  return results.map(r => ({ ...r.similar, coPurchases: r.coPurchases.toNumber() }));
}

// Collaborative filtering - recommend based on similar users
export async function collaborativeFilteringRecommendations(userId, limit = 10) {
  const cypher = \`
    // Find users who bought the same products as our user
    MATCH (target:User {id: $id})-[:BOUGHT]->(:Product)<-[:BOUGHT]-(similar:User)
    
    // Find products those similar users bought that our user hasn't
    MATCH (similar)-[:BOUGHT]->(rec:Product)
    WHERE NOT (target)-[:BOUGHT]->(rec)
    
    WITH rec, COUNT(DISTINCT similar) as score
    RETURN rec, score
    ORDER BY score DESC
    LIMIT $limit
  \`;
  
  const results = await executeQuery(cypher, { id: userId, limit });
  return results.map(r => ({ ...r.rec, score: r.score.toNumber() }));
}

// Graph-based recommendation using PageRank-like algorithm
export async function getPopularProducts(limit = 10) {
  const cypher = \`
    // Calculate popularity based on purchases and connections
    MATCH (p:Product)<-[b:BOUGHT]-(u:User)
    
    // Give more weight to users who are well-connected
    WITH p, count(b) as purchases, size((u)-[:FRIENDS_WITH]-()) as userConnections
    WITH p, (purchases * (1 + userConnections * 0.1)) as weightedScore
    
    RETURN p, weightedScore
    ORDER BY weightedScore DESC
    LIMIT $limit
  \`;
  
  const results = await executeQuery(cypher, { limit });
  return results.map(r => ({ ...r.p, score: r.weightedScore }));
}
`,

    'db/algorithms/index.js': `// Community detection using label propagation
export async function detectCommunities() {
  const cypher = \`
    CALL algo.labelPropagation.stream('User', 'FRIENDS_WITH', {
      iterations: 10
    })
    YIELD nodeId, community
    MATCH (u:User)
    WHERE id(u) = nodeId
    RETURN u.name as name, u.email as email, community
    ORDER BY community
  \`;
  
  // For Neo4j 5.x using Graph Data Science library
  const cypherGDS = \`
    CALL gds.labelPropagation.stream('myGraph')
    YIELD nodeId, communityId
    MATCH (u:User)
    WHERE id(u) = nodeId
    RETURN u.name as name, communityId
    ORDER BY communityId
  \`;
  
  return cypherGDS;
}

// Find influencers using centrality algorithms
export async function findInfluencers() {
  const cypher = \`
    // Calculate degree centrality (number of connections)
    MATCH (u:User)
    WITH u, size((u)-[:FRIENDS_WITH]-()) as degree
    RETURN u.name as name, u.email as email, degree
    ORDER BY degree DESC
    LIMIT 10
  \`;
  
  return cypher;
}

// Betweenness centrality - find bridge nodes
export async function findBridgeNodes() {
  const cypher = \`
    // Find users who connect different friend groups
    MATCH (u:User)
    WITH u, size((u)-[:FRIENDS_WITH]-()) as degree
    WHERE degree > 5
    MATCH (u)-[:FRIENDS_WITH]-(friend1)-[:FRIENDS_WITH]-(friend2)
    WHERE NOT (u)-[:FRIENDS_WITH]-(friend2) AND u <> friend2
    WITH u, count(DISTINCT friend2) as bridgingScore
    RETURN u.name as name, bridgingScore
    ORDER BY bridgingScore DESC
    LIMIT 10
  \`;
  
  return cypher;
}
`,

    'index.js': `import express from 'express';
import { executeQuery, getSession, close } from './db/index.js';
import * as userDb from './db/models/user.js';
import * as productDb from './db/models/product.js';
import * as socialDb from './db/queries/social.js';
import * as recDb from './db/queries/recommendations.js';

const app = express();
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    const session = await getSession();
    await session.run('RETURN 1');
    await session.close();
    res.json({ status: 'healthy', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected', error: err.message });
  }
});

// User endpoints
app.post('/api/users', async (req, res) => {
  const user = await userDb.createUser(req.body);
  res.json(user);
});

app.get('/api/users/:id', async (req, res) => {
  const user = await userDb.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.post('/api/users/:id/friends/:friendId', async (req, res) => {
  const friendship = await userDb.addFriendship(req.params.id, req.params.friendId);
  res.json(friendship);
});

app.get('/api/users/:id/friends', async (req, res) => {
  const friends = await userDb.getFriends(req.params.id);
  res.json(friends);
});

app.get('/api/users/:id/friends-of-friends', async (req, res) => {
  const foaf = await userDb.getFriendsOfFriends(req.params.id);
  res.json(foaf);
});

// Social graph endpoints
app.get('/api/social/path/:user1Id/:user2Id', async (req, res) => {
  const path = await socialDb.findShortestPath(req.params.user1Id, req.params.user2Id);
  res.json(path);
});

app.get('/api/users/:id/suggestions', async (req, res) => {
  const suggestions = await socialDb.suggestPeopleYouMayKnow(req.params.id);
  res.json(suggestions);
});

// Product endpoints
app.post('/api/products', async (req, res) => {
  const product = await productDb.createProduct(req.body);
  res.json(product);
});

app.get('/api/products/:id/recommendations', async (req, res) => {
  const recs = await productDb.getProductRecommendations(req.params.id);
  res.json(recs);
});

app.get('/api/products/:id/frequently-bought-together', async (req, res) => {
  const related = await productDb.getFrequentlyBoughtTogether(req.params.id);
  res.json(related);
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
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=password
    depends_on:
      - neo4j
    restart: unless-stopped

  # Neo4j database
  neo4j:
    image: neo4j:5.15
    ports:
      - "7474:7474"  # HTTP
      - "7687:7687"  # Bolt
    environment:
      - NEO4J_AUTH=neo4j/password
      - NEO4J_PLUGINS=["apoc"]
      - NEO4J_dbms_memory_heap_max__size=512M
      - NEO4J_dbms_memory_pagecache_size=512M
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
      - neo4j_import:/var/lib/neo4j/import
      - neo4j_plugins:/plugins
    restart: unless-stopped

  # Neo4j Browser
  neo4j-browser:
    image: neo4j:5.15
    ports:
      - "7475:7474"
    environment:
      - NEO4J_AUTH=none
    command: ./bin/neo4j console
    depends_on:
      - neo4j
    restart: unless-stopped

volumes:
  neo4j_data:
  neo4j_logs:
  neo4j_import:
  neo4j_plugins:
`,

    'scripts/seed.js': `import { driver } from '../db/index.js';
import { createUser } from '../db/models/user.js';
import { createProduct } from '../db/models/product.js';

async function seed() {
  const session = driver.session();
  
  try {
    // Clear existing data
    await session.run('MATCH (n) DETACH DELETE n');
    console.log('Cleared existing data');
    
    // Create users
    const users = await Promise.all([
      createUser({ name: 'Alice', email: 'alice@example.com' }),
      createUser({ name: 'Bob', email: 'bob@example.com' }),
      createUser({ name: 'Charlie', email: 'charlie@example.com' }),
      createUser({ name: 'Diana', email: 'diana@example.com' }),
      createUser({ name: 'Eve', email: 'eve@example.com' })
    ]);
    console.log(\`Created \${users.length} users\`);
    
    // Create friendships
    await session.run(\`
      MATCH (a:User {name: 'Alice'}), (b:User {name: 'Bob'})
      CREATE (a)-[:FRIENDS_WITH {since: '2023-01-01'}]->(b)
    \`);
    
    await session.run(\`
      MATCH (a:User {name: 'Bob'}), (b:User {name: 'Charlie'})
      CREATE (a)-[:FRIENDS_WITH {since: '2023-01-02'}]->(b)
    \`);
    
    await session.run(\`
      MATCH (a:User {name: 'Charlie'}), (b:User {name: 'Diana'})
      CREATE (a)-[:FRIENDS_WITH {since: '2023-01-03'}]->(b)
    \`);
    
    await session.run(\`
      MATCH (a:User {name: 'Alice'}), (b:User {name: 'Diana'})
      CREATE (a)-[:FRIENDS_WITH {since: '2023-01-04'}]->(b)
    \`);
    console.log('Created friendships');
    
    // Create products
    const products = await Promise.all([
      createProduct({ name: 'Laptop', price: 999.99, category: 'Electronics' }),
      createProduct({ name: 'Mouse', price: 29.99, category: 'Electronics' }),
      createProduct({ name: 'Desk', price: 299.99, category: 'Furniture' }),
      createProduct({ name: 'Chair', price: 199.99, category: 'Furniture' })
    ]);
    console.log(\`Created \${products.length} products\`);
    
    // Create purchase relationships
    await session.run(\`
      MATCH (u:User {name: 'Alice'}), (p:Product {name: 'Laptop'})
      CREATE (u)-[:BOUGHT {date: '2023-06-01'}]->(p)
    \`);
    
    await session.run(\`
      MATCH (u:User {name: 'Bob'}), (p:Product {name: 'Laptop'})
      CREATE (u)-[:BOUGHT {date: '2023-06-02'}]->(p)
    \`);
    
    await session.run(\`
      MATCH (u:User {name: 'Charlie'}), (p:Product {name: 'Mouse'})
      CREATE (u)-[:BOUGHT {date: '2023-06-03'}]->(p)
    \`);
    console.log('Created purchase relationships');
    
    console.log('Seed complete!');
  } finally {
    await session.close();
    await driver.close();
  }
}

seed().catch(console.error);
`,

    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
`,

    '.env.example': `# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Server
PORT=3000
NODE_ENV=development
`,

    'README.md': `# {{projectName}}

Neo4j graph database template with Cypher queries, relationship mapping, and graph algorithms.

## Features

- **Graph Database**: Native graph storage and processing
- **Cypher Query Language**: Declarative graph query language
- **Relationship Modeling**: First-class relationships
- **Graph Algorithms**: Path finding, centrality, community detection
- **Social Network Analysis**: Friends, recommendations, influence
- **Recommendation Engine**: Collaborative filtering, content-based

## Quick Start

### Local Development

\\\`\\\`\\\`bash
# Start Neo4j
docker-compose up -d neo4j

# Seed database
npm run seed

# Start server
npm start
\\\`\\\`\\\`

### Full Stack

\\\`\\\`\\\`bash
docker-compose up
\\\`\\\`\\\`

Access:
- Application: http://localhost:3000
- Neo4j Browser: http://localhost:7474
- Bolt Protocol: bolt://localhost:7687

## Cypher Examples

### Create Node
\\\`\\\`\\\`cypher
CREATE (u:User {name: 'Alice', email: 'alice@example.com'})
RETURN u
\\\`\\\`\\\`

### Create Relationship
\\\`\\\`\\\`cypher
MATCH (a:User {name: 'Alice'}), (b:User {name: 'Bob'})
CREATE (a)-[:FRIENDS_WITH {since: '2023-01-01'}]->(b)
\\\`\\\`\\\`

### Find Friends
\\\`\\\`\\\`cypher
MATCH (u:User {name: 'Alice'})-[:FRIENDS_WITH]-(friend:User)
RETURN friend
\\\`\\\`\\\`

### Shortest Path
\\\`\\\`\\\`cypher
MATCH path = shortestPath(
  (u1:User {name: 'Alice'})-[:FRIENDS_WITH*]-(u2:User {name: 'Eve'})
)
RETURN path
\\\`\\\`\\\`

## Graph Algorithms

### PageRank-like Influence Score
\\\`\\\`\\\`cypher
MATCH (p:Product)<-[b:BOUGHT]-(u:User)
WITH p, count(b) as purchases, size((u)-[:FRIENDS_WRONG]-()) as userConnections
WITH p, (purchases * (1 + userConnections * 0.1)) as score
RETURN p.name, score
ORDER BY score DESC
\\\`\\\`\\\`

### People You May Know
\\\`\\\`\\\`cypher
MATCH (u:User {id: 'user-id'})-[:FRIENDS_WITH]->(friend)-[:FRIENDS_WITH]->(suggestion)
WHERE NOT (u)-[:FRIENDS_WITH]-(suggestion)
RETURN suggestion, COUNT(DISTINCT friend) as mutualFriends
ORDER BY mutualFriends DESC
\\\`\\\`\\\`

## License

MIT
`
  }
};
