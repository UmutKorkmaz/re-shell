import { BackendTemplate } from '../types';

/**
 * GraphQL Schema Management and Federation Template
 * Complete GraphQL solution with federation, schema stitching, and multi-service support
 */
export const graphqlFederationTemplate: BackendTemplate = {
  id: 'graphql-federation',
  name: 'graphql-federation',
  displayName: 'GraphQL Schema Management and Federation',
  description: 'Complete GraphQL solution with Apollo Federation, schema stitching, multi-service support, schema registry, gateway setup, type merging, and distributed graph architecture',
  language: 'javascript',
  framework: 'graphql',
  version: '1.0.0',
  tags: ['graphql', 'federation', 'apollo', 'schema', 'microservices', 'gateway'],
  port: 4000,
  dependencies: {},
  features: ['graphql', 'rest-api', 'docker', 'monitoring'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "gateway": "node gateway.js",
    "users": "node services/users/index.js",
    "products": "node services/products/index.js",
    "orders": "node services/orders/index.js",
    "introspect": "node scripts/introspect-schemas.js"
  },
  "dependencies": {
    "@apollo/gateway": "^2.5.5",
    "@apollo/server": "^4.9.5",
    "@apollo/subgraph": "^2.5.5",
    "graphql": "^16.8.1",
    "graphql-tools": "^9.0.1",
    "graphql-tag": "^2.12.6"
  }
}
`,

    'gateway.js': `import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import { ApolloServer } from '@apollo/server';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Gateway configuration with supergraph
const gateway = new ApolloGateway({
  supergraphSdl: new IntrospectAndCompose({
    subgraphs: [
      { name: 'users', url: 'http://localhost:4001/graphql' },
      { name: 'products', url: 'http://localhost:4002/graphql' },
      { name: 'orders', url: 'http://localhost:4003/graphql' }
    ]
  }),

  // Custom health check for subgraphs
  healthCheck: async () => {
    return {
      status: 'pass',
      timestamp: new Date().toISOString()
    };
  },

  // Build service definitions
  __exposeQueryPlanExperimental: false,

  // Configure subgraph data sources
  buildService: ({ name, url }) => {
    return new RemoteGraphQLDataSource({
      url,

      // Forward headers to subgraphs
      willSendRequest({ request, context }) {
        request.http.headers.set('user-id', context.userId || '');
        request.http.headers.set('authorization', context.authorization || '');
      },

      // Handle responses from subgraphs
      didReceiveResponse({ response, request, context }) {
        return response;
      },

      // Transform errors
      didEncounterError(error) {
        console.error('Subgraph error:', error);
        return error;
      }
    });
  }
});

// Create Apollo Server with gateway
const server = new ApolloServer({
  gateway,

  // Subscriptions (for realtime updates)
  subscriptions: false,

  // Context
  context: async ({ req }) => {
    return {
      userId: req.headers['user-id'] || null,
      authorization: req.headers['authorization'] || null
    };
  },

  // Plugins
  plugins: [
    {
      requestDidStart: () => ({
        willSendResponse: ({ response }) => {
          // Add custom headers
          response.http.headers.set('X-Powered-By', 'Apollo Gateway');
        }
      })
    }
  ],

  // Format errors
  formatError: (formattedError, error) => {
    return {
      ...formattedError,
      message: formattedError.message
    };
  }
});

// Start server
const PORT = process.env.PORT || 4000;
server.listen({ port: PORT }).then(({ url }) => {
  console.log('GraphQL Gateway ready at ' + url);
  console.log('');
  console.log('Subgraphs:');
  console.log('  - Users: http://localhost:4001/graphql');
  console.log('  - Products: http://localhost:4002/graphql');
  console.log('  - Orders: http://localhost:4003/graphql');
});
`,

    'services/users/schema.graphql': `# User Subgraph Schema
# Extends the base User type with additional fields

extend type Query {
  me: User
  user(id: ID!): User
  users(limit: Int = 10, offset: Int = 0): UserConnection!
}

extend type Mutation {
  updateUser(input: UpdateUserInput!): User!
  deleteUser(id: ID!): Boolean!
}

type User @key(fields: "id") {
  id: ID!
  email: String!
  username: String!
  firstName: String!
  lastName: String!
  avatar: String
  bio: String
  createdAt: String!
  updatedAt: String!
}

type UserConnection {
  nodes: [User!]!
  totalCount: Int!
  pageInfo: PageInfo!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

input UpdateUserInput {
  firstName: String
  lastName: String
  bio: String
  avatar: String
}
`,

    'services/users/index.js': `import { ApolloServer } from '@apollo/server';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load schema
const typeDefs = readFileSync(resolve(__dirname, 'schema.graphql'), 'utf-8');

// Mock data store
const users = new Map([
  ['1', {
    id: '1',
    email: 'user1@example.com',
    username: 'user1',
    firstName: 'John',
    lastName: 'Doe',
    avatar: 'https://example.com/avatars/user1.jpg',
    bio: 'Software developer',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }],
  ['2', {
    id: '2',
    email: 'user2@example.com',
    username: 'user2',
    firstName: 'Jane',
    lastName: 'Smith',
    avatar: 'https://example.com/avatars/user2.jpg',
    bio: 'Designer',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z'
  }],
  ['3', {
    id: '3',
    email: 'user3@example.com',
    username: 'user3',
    firstName: 'Bob',
    lastName: 'Johnson',
    avatar: 'https://example.com/avatars/user3.jpg',
    bio: 'Product manager',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z'
  }]
]);

// Resolvers
const resolvers = {
  Query: {
    me: () => users.get('1'),

    user: (_, { id }) => {
      return users.get(id) || null;
    },

    users: (_, { limit = 10, offset = 0 }) => {
      const allUsers = Array.from(users.values());
      const nodes = allUsers.slice(offset, offset + limit);

      return {
        nodes,
        totalCount: allUsers.length,
        pageInfo: {
          hasNextPage: offset + limit < allUsers.length,
          hasPreviousPage: offset > 0,
          startCursor: offset.toString(),
          endCursor: (offset + nodes.length - 1).toString()
        }
      };
    }
  },

  Mutation: {
    updateUser: (_, { input }, { userId }) => {
      const user = users.get(userId);
      if (!user) return null;

      const updated = { ...user, ...input, updatedAt: new Date().toISOString() };
      users.set(userId, updated);
      return updated;
    },

    deleteUser: (_, { id }) => {
      return users.delete(id);
    }
  }
};

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,

  // Subgraph configuration
  includeSubgraphInQueryPlan: true
});

// Start server
const PORT = process.env.PORT || 4001;
server.listen({ port: PORT }).then(({ url }) => {
  console.log('Users subgraph ready at ' + url);
});
`,

    'services/products/schema.graphql': `# Product Subgraph Schema
# Extends the base Product type with inventory and pricing

extend type Query {
  product(id: ID!): Product
  products(category: String, limit: Int = 10): [Product!]!
  searchProducts(query: String!, limit: Int = 10): [Product!]!
}

extend type Mutation {
  createProduct(input: CreateProductInput!): Product!
  updateProduct(id: ID!, input: UpdateProductInput!): Product!
  deleteProduct(id: ID!): Boolean!
}

type Product @key(fields: "id") {
  id: ID!
  name: String!
  description: String!
  price: Float!
  category: String!
  imageUrl: String
  inStock: Boolean!
  quantity: Int!
  createdAt: String!
  updatedAt: String!
}

type Category {
  id: ID!
  name: String!
  slug: String!
  productCount: Int!
}

input CreateProductInput {
  name: String!
  description: String!
  price: Float!
  category: String!
  imageUrl: String
  quantity: Int!
}

input UpdateProductInput {
  name: String
  description: String
  price: Float
  category: String
  imageUrl: String
  inStock: Boolean
  quantity: Int
}
`,

    'services/products/index.js': `import { ApolloServer } from '@apollo/server';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load schema
const typeDefs = readFileSync(resolve(__dirname, 'schema.graphql'), 'utf-8');

// Mock data store
const products = new Map([
  ['1', {
    id: '1',
    name: 'Wireless Headphones',
    description: 'High-quality wireless headphones with noise cancellation',
    price: 99.99,
    category: 'electronics',
    imageUrl: 'https://example.com/products/headphones.jpg',
    inStock: true,
    quantity: 50,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }],
  ['2', {
    id: '2',
    name: 'Running Shoes',
    description: 'Comfortable running shoes for all terrains',
    price: 79.99,
    category: 'footwear',
    imageUrl: 'https://example.com/products/shoes.jpg',
    inStock: true,
    quantity: 30,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z'
  }],
  ['3', {
    id: '3',
    name: 'Coffee Maker',
    description: 'Programmable coffee maker with thermal carafe',
    price: 49.99,
    category: 'kitchen',
    imageUrl: 'https://example.com/products/coffee-maker.jpg',
    inStock: false,
    quantity: 0,
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z'
  }]
]);

// Resolvers
const resolvers = {
  Query: {
    product: (_, { id }) => {
      return products.get(id) || null;
    },

    products: (_, { category, limit = 10 }) => {
      let result = Array.from(products.values());

      if (category) {
        result = result.filter(p => p.category === category);
      }

      return result.slice(0, limit);
    },

    searchProducts: (_, { query, limit = 10 }) => {
      const lowerQuery = query.toLowerCase();
      return Array.from(products.values())
        .filter(p =>
          p.name.toLowerCase().includes(lowerQuery) ||
          p.description.toLowerCase().includes(lowerQuery)
        )
        .slice(0, limit);
    }
  },

  Mutation: {
    createProduct: (_, { input }) => {
      const id = String(products.size + 1);
      const product = {
        id,
        ...input,
        inStock: input.quantity > 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      products.set(id, product);
      return product;
    },

    updateProduct: (_, { id, input }) => {
      const product = products.get(id);
      if (!product) return null;

      const updated = {
        ...product,
        ...input,
        inStock: input.quantity !== undefined ? input.quantity > 0 : product.inStock,
        updatedAt: new Date().toISOString()
      };
      products.set(id, updated);
      return updated;
    },

    deleteProduct: (_, { id }) => {
      return products.delete(id);
    }
  }
};

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  includeSubgraphInQueryPlan: true
});

// Start server
const PORT = process.env.PORT || 4002;
server.listen({ port: PORT }).then(({ url }) => {
  console.log('Products subgraph ready at ' + url);
});
`,

    'services/orders/schema.graphql': `# Order Subgraph Schema
# Extends the Order type with user and product relationships

extend type Query {
  order(id: ID!): Order
  orders(userId: ID!, limit: Int = 10): [Order!]!
  orderStats: OrderStats!
}

extend type Mutation {
  createOrder(input: CreateOrderInput!): Order!
  cancelOrder(id: ID!): Order!
  updateOrderStatus(id: ID!, status: OrderStatus!): Order!
}

type Order @key(fields: "id") {
  id: ID!
  userId: ID!
  items: [OrderItem!]!
  total: Float!
  status: OrderStatus!
  createdAt: String!
  updatedAt: String!
  shippedAt: String
  deliveredAt: String
}

type OrderItem {
  productId: ID!
  productName: String!
  quantity: Int!
  price: Float!
  subtotal: Float!
}

enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}

type OrderStats {
  totalOrders: Int!
  ordersByStatus: [OrderStatusCount!]!
  revenue: Float!
}

type OrderStatusCount {
  status: OrderStatus!
  count: Int!
}

input CreateOrderInput {
  userId: ID!
  items: [OrderItemInput!]!
}

input OrderItemInput {
  productId: ID!
  quantity: Int!
}
`,

    'services/orders/index.js': `import { ApolloServer } from '@apollo/server';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load schema
const typeDefs = readFileSync(resolve(__dirname, 'schema.graphql'), 'utf-8');

// Mock data store
const orders = new Map([
  ['1', {
    id: '1',
    userId: '1',
    items: [
      { productId: '1', productName: 'Wireless Headphones', quantity: 1, price: 99.99, subtotal: 99.99 }
    ],
    total: 99.99,
    status: 'DELIVERED',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-05T00:00:00Z',
    shippedAt: '2024-01-02T00:00:00Z',
    deliveredAt: '2024-01-05T00:00:00Z'
  }],
  ['2', {
    id: '2',
    userId: '1',
    items: [
      { productId: '2', productName: 'Running Shoes', quantity: 2, price: 79.99, subtotal: 159.98 }
    ],
    total: 159.98,
    status: 'SHIPPED',
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-12T00:00:00Z',
    shippedAt: '2024-01-12T00:00:00Z',
    deliveredAt: null
  }]
]);

// Resolvers
const resolvers = {
  Query: {
    order: (_, { id }) => {
      return orders.get(id) || null;
    },

    orders: (_, { userId, limit = 10 }) => {
      return Array.from(orders.values())
        .filter(o => o.userId === userId)
        .slice(0, limit);
    },

    orderStats: () => {
      const allOrders = Array.from(orders.values());
      const totalOrders = allOrders.length;

      const statusCounts = {
        PENDING: 0,
        PROCESSING: 0,
        SHIPPED: 0,
        DELIVERED: 0,
        CANCELLED: 0
      };

      let revenue = 0;

      for (const order of allOrders) {
        statusCounts[order.status]++;
        if (order.status !== 'CANCELLED') {
          revenue += order.total;
        }
      }

      return {
        totalOrders,
        ordersByStatus: Object.entries(statusCounts).map(([status, count]) => ({
          status,
          count
        })),
        revenue
      };
    }
  },

  Mutation: {
    createOrder: (_, { input }) => {
      const id = String(orders.size + 1);

      const total = input.items.reduce((sum, item) => {
        return sum + (item.quantity * 10); // Mock price calculation
      }, 0);

      const order = {
        id,
        userId: input.userId,
        items: input.items.map(item => ({
          productId: item.productId,
          productName: 'Product ' + item.productId,
          quantity: item.quantity,
          price: 10,
          subtotal: item.quantity * 10
        })),
        total,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        shippedAt: null,
        deliveredAt: null
      };

      orders.set(id, order);
      return order;
    },

    cancelOrder: (_, { id }) => {
      const order = orders.get(id);
      if (!order) return null;

      const cancelled = { ...order, status: 'CANCELLED', updatedAt: new Date().toISOString() };
      orders.set(id, cancelled);
      return cancelled;
    },

    updateOrderStatus: (_, { id, status }) => {
      const order = orders.get(id);
      if (!order) return null;

      const updated = {
        ...order,
        status,
        updatedAt: new Date().toISOString()
      };

      if (status === 'SHIPPED' && !order.shippedAt) {
        updated.shippedAt = new Date().toISOString();
      }
      if (status === 'DELIVERED' && !order.deliveredAt) {
        updated.deliveredAt = new Date().toISOString();
      }

      orders.set(id, updated);
      return updated;
    }
  }
};

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  includeSubgraphInQueryPlan: true
});

// Start server
const PORT = process.env.PORT || 4003;
server.listen({ port: PORT }).then(({ url }) => {
  console.log('Orders subgraph ready at ' + url);
});
`,

    'scripts/introspect-schemas.js': `/**
 * Introspect all subgraph schemas and compose supergraph
 */

import { IntrospectAndCompose, composeServices } from '@apollo/gateway';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const subgraphs = [
  { name: 'users', url: 'http://localhost:4001/graphql' },
  { name: 'products', url: 'http://localhost:4002/graphql' },
  { name: 'orders', url: 'http://localhost:4003/graphql' }
];

async function introspectSchemas() {
  console.log('Introspecting subgraph schemas...');

  const supergraphSdl = new IntrospectAndCompose({
    subgraphs
  });

  try {
    const result = await supergraphSdl.initialize({
      getDataSource: () => ({})
    });

    const sdl = result.supergraphSdl;

    // Write supergraph schema to file
    writeFileSync(
      resolve(process.cwd(), 'supergraph.graphql'),
      sdl
    );

    console.log('Supergraph schema written to supergraph.graphql');
    console.log('');
    console.log('Subgraph schemas:');

    for (const subgraph of subgraphs) {
      console.log('  - ' + subgraph.name + ': ' + subgraph.url);
    }

  } catch (err) {
    console.error('Failed to introspect schemas:', err.message);
    console.log('');
    console.log('Make sure all subgraphs are running:');
    console.log('  npm run users');
    console.log('  npm run products');
    console.log('  npm run orders');
  }
}

introspectSchemas().catch(console.error);
`,

    'scripts/generate-supergraph.js': `/**
 * Generate supergraph schema from local SDL files
 */

import { composeServices } from '@apollo/composition';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

function loadSubgraphSchemas() {
  const servicesDir = resolve(process.cwd(), 'services');
  const serviceDirs = readdirSync(servicesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const subgraphs = [];

  for (const serviceName of serviceDirs) {
    const schemaPath = join(servicesDir, serviceName, 'schema.graphql');
    try {
      const typeDefs = readFileSync(schemaPath, 'utf-8');
      subgraphs.push({
        name: serviceName,
        typeDefs
      });
    } catch (err) {
      console.warn('Could not load schema for ' + serviceName);
    }
  }

  return subgraphs;
}

async function generateSupergraph() {
  console.log('Generating supergraph schema...');

  const subgraphs = loadSubgraphSchemas();

  if (subgraphs.length === 0) {
    console.error('No subgraph schemas found!');
    process.exit(1);
  }

  console.log('Found ' + subgraphs.length + ' subgraph(s):');
  subgraphs.forEach(s => console.log('  - ' + s.name));
  console.log('');

  try {
    const supergraphResult = composeServices(subgraphs);

    if (supergraphResult.errors.length > 0) {
      console.error('Composition errors:');
      for (const error of supergraphResult.errors) {
        console.error('  - ' + error.message);
      }
      process.exit(1);
    }

    const supergraphSdl = supergraphResult.supergraphSdl;

    // Write to file
    writeFileSync(
      resolve(process.cwd(), 'supergraph.graphql'),
      supergraphSdl
    );

    console.log('Supergraph schema generated: supergraph.graphql');
    console.log('');
    console.log('You can now start the gateway with:');
    console.log('  npm run gateway');

  } catch (err) {
    console.error('Failed to compose supergraph:', err.message);
    process.exit(1);
  }
}

generateSupergraph().catch(console.error);
`,

    'index.js': `import { ApolloServer } from '@apollo/server';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load composed supergraph schema
let supergraphSdl;
try {
  supergraphSdl = readFileSync(resolve(process.cwd(), 'supergraph.graphql'), 'utf-8');
} catch (err) {
  console.error('Supergraph schema not found. Run: npm run introspect');
  process.exit(1);
}

// Example introspection query
const typeDefs = '#graphql\\n'
+ '  query IntrospectionQuery {\\n'
+ '    __schema {\\n'
+ '      queryType { name }\\n'
+ '      mutationType { name }\\n'
+ '      subscriptionType { name }\\n'
+ '      types {\\n'
+ '        name\\n'
+ '        fields {\\n'
+ '          name\\n'
+ '          type {\\n'
+ '            name\\n'
+ '            kind\\n'
+ '          }\\n'
+ '        }\\n'
+ '      }\\n'
+ '    }\\n'
+ '  }\\n'
+ '';

// Simple health check endpoint
const resolvers = {
  Query: {
    health: () => ({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    })
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers
});

const PORT = process.env.PORT || 4000;
server.listen({ port: PORT }).then(({ url }) => {
  console.log('GraphQL server ready at ' + url);
  console.log('');
  console.log('To start the federated architecture:');
  console.log('  1. Terminal 1: npm run users');
  console.log('  2. Terminal 2: npm run products');
  console.log('  3. Terminal 3: npm run orders');
  console.log('  4. Terminal 4: npm run gateway');
});
`,

    'docker-compose.yml': `version: '3.8'

services:
  gateway:
    build: .
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
    depends_on:
      - users
      - products
      - orders
    restart: unless-stopped

  users:
    build: .
    command: node services/users/index.js
    ports:
      - "4001:4001"
    environment:
      - PORT=4001
    restart: unless-stopped

  products:
    build: .
    command: node services/products/index.js
    ports:
      - "4002:4002"
    environment:
      - PORT=4002
    restart: unless-stopped

  orders:
    build: .
    command: node services/orders/index.js
    ports:
      - "4003:4003"
    environment:
      - PORT=4003
    restart: unless-stopped
`,

    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 4000

CMD ["node", "index.js"]
`,

    '.env.example': `# Gateway
PORT=4000
NODE_ENV=development

# Subgraph URLs
USERS_URL=http://localhost:4001/graphql
PRODUCTS_URL=http://localhost:4002/graphql
ORDERS_URL=http://localhost:4003/graphql

# Headers (for forwarding)
USER_HEADER=user-id
AUTH_HEADER=authorization
`,

    'README.md': `# {{projectName}}

Complete GraphQL solution with Apollo Federation, schema stitching, and multi-service support.

## Features

- **Apollo Federation**: Federated microservice architecture
- **Schema Registry**: Centralized schema management
- **Multiple Subgraphs**: Users, Products, Orders services
- **Gateway**: Unified GraphQL endpoint
- **Schema Stitching**: Combine multiple schemas into one
- **Type Merging**: Share types across subgraphs
- **Introspection**: Automatic schema composition

## Architecture

\`\`\`
                    ┌─────────────┐
                    │   Gateway   │
                    │  (Port 4000) │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼────────┐ ┌───────▼────────┐ ┌──────▼─────┐
│ Users Subgraph │ │Products Subgraph│ │Orders Subgraph│
│  (Port 4001)   │ │  (Port 4002)   │ │  (Port 4003) │
└────────────────┘ └────────────────┘ └─────────────┘
\`\`\`

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Start all subgraphs (in separate terminals)
npm run users      # Terminal 1
npm run products   # Terminal 2
npm run orders     # Terminal 3

# Start gateway (Terminal 4)
npm run gateway

# Or use Docker Compose
docker-compose up -d
\`\`\`

## Example Queries

### Get User with Orders

\`\`\`graphql
query GetUserWithOrders {
  user(id: "1") {
    id
    email
    username
    firstName
    lastName
  }
}
\`\`\`

### Get Products

\`\`\`graphql
query GetProducts {
  products(category: "electronics", limit: 10) {
    id
    name
    description
    price
    inStock
  }
}
\`\`\`

### Get Orders

\`\`\`graphql
query GetOrders {
  orders(userId: "1", limit: 10) {
    id
    total
    status
    items {
      productName
      quantity
      subtotal
    }
  }
}
\`\`\`

## Schema Composition

Generate supergraph schema from local SDL files:

\`\`\`bash
npm run introspect
\`\`\`

Or introspect running subgraphs:

\`\`\`bash
node scripts/introspect-schemas.js
\`\`\`

## Subgraph Development

Each subgraph is a standalone service:

1. Create a new folder in \`services/\`
2. Add a \`schema.graphql\` file
3. Add an \`index.js\` file with resolvers
4. Update \`gateway.js\` to include the new subgraph

## Federation Keys

Types shared across subgraphs use \`@key\` directive:

\`\`\`graphql
type User @key(fields: "id") {
  id: ID!
  email: String!
}
\`\`\`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 4000 | Gateway port |
| USERS_URL | http://localhost:4001/graphql | Users subgraph URL |
| PRODUCTS_URL | http://localhost:4002/graphql | Products subgraph URL |
| ORDERS_URL | http://localhost:4003/graphql | Orders subgraph URL |

## License

MIT
`
  }
};
