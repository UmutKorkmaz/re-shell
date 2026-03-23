import { BackendTemplate } from '../types.js';

/**
 * GraphQL Code Generation Template
 *
 * Generates type-safe resolvers and client SDKs from GraphQL schemas.
 * Supports multiple languages and frameworks.
 */
export const graphqlCodegenTemplate: BackendTemplate = {
  id: 'graphql-codegen',
  name: 'graphql-codegen',
  displayName: 'GraphQL Codegen - Type-Safe Resolvers & Clients',
  description: 'GraphQL code generator for type-safe resolvers and client SDKs from schemas with multi-language support',
  language: 'typescript',
  framework: 'graphql',
  version: '1.0.0',
  tags: ['graphql', 'codegen', 'typescript', 'resolvers', 'client-sdk'],
  port: 4000,
  dependencies: {
    'graphql': '^16.9.0',
    '@apollo-server/express': '^3.12.1',
    '@graphql-tools/schema': '^10.0.6',
    'graphql-tag': '^2.12.6',
    'express': '^4.19.2',
    'dotenv': '^16.4.5',
    'graphql-subscriptions': '^2.0.0',
    'graphql-request': '^6.1.0',
    '@apollo/client': '^3.11.8',
  },
  devDependencies: {
    '@types/graphql': '^14.5.0',
    '@types/express': '^4.17.21',
    'typescript': '^5.5.4',
    'tsx': '^4.16.2',
    'nodemon': '^3.1.4',
  },
  features: ['graphql', 'rest-api', 'documentation'],
  files: {
    'src/schema.graphql': `# GraphQL Schema for {{name}}

scalar Date
scalar JSON

type User {
  id: ID!
  email: String!
  username: String!
  firstName: String!
  lastName: String!
  avatar: String
  bio: String
  createdAt: Date!
  updatedAt: Date!
  posts: [Post!]!
  postCount: Int!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  createdAt: Date!
  updatedAt: Date!
  likes: [Like!]!
  likeCount: Int!
  comments: [Comment!]!
  commentCount: Int!
}

type Comment {
  id: ID!
  content: String!
  author: User!
  post: Post!
  createdAt: Date!
  updatedAt: Date!
}

type Like {
  id: ID!
  user: User!
  post: Post!
  createdAt: Date!
}

type AuthPayload {
  token: String!
  user: User!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
  totalCount: Int!
}

type PaginatedPosts {
  edges: [PostEdge!]!
  pageInfo: PageInfo!
}

type PostEdge {
  node: Post!
  cursor: String!
}

type Query {
  me: User
  user(id: ID!): User
  users(limit: Int = 10, offset: Int = 0): [User!]!
  post(id: ID!): Post
  posts(limit: Int = 10, offset: Int = 0): [Post!]!
  postsPaginated(first: Int = 10, after: String): PaginatedPosts!
  search(query: String!): [SearchResult!]!
  stats: Stats!
}

type Mutation {
  register(input: RegisterInput!): AuthPayload!
  login(input: LoginInput!): AuthPayload!
  logout: Boolean!
  updateProfile(input: UpdateProfileInput!): User!
  createPost(input: CreatePostInput!): Post!
  updatePost(id: ID!, input: UpdatePostInput!): Post!
  deletePost(id: ID!): Boolean!
  likePost(postId: ID!): Like!
  unlikePost(postId: ID!): Boolean!
}

type Subscription {
  postCreated: Post!
  postUpdated: Post!
}

input RegisterInput {
  email: String!
  username: String!
  password: String!
  firstName: String!
  lastName: String!
}

input LoginInput {
  email: String!
  password: String!
}

input UpdateProfileInput {
  firstName: String
  lastName: String
  bio: String
  avatar: String
}

input CreatePostInput {
  title: String!
  content: String!
}

input UpdatePostInput {
  title: String
  content: String
}

type Stats {
  userCount: Int!
  postCount: Int!
  commentCount: Int!
  likeCount: Int!
}

union SearchResult = User | Post
`,
    'src/resolvers.ts': `import { GraphQLScalarType, Kind } from 'graphql';
import { PubSub } from 'graphql-subscriptions';

export const pubsub = new PubSub();

export const dateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'Date custom scalar type',
  serialize(value) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    throw new Error('Date scalar can only serialize Date objects');
  },
  parseValue(value) {
    if (typeof value === 'string') {
      return new Date(value);
    }
    throw new Error('Date scalar can only parse string values');
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    throw new Error('Date scalar can only parse string literals');
  },
});

export const jsonScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON custom scalar type',
  serialize(value) {
    return value;
  },
  parseValue(value) {
    return value;
  },
  parseLiteral(ast) {
    switch (ast.kind) {
      case Kind.STRING:
      case Kind.BOOLEAN:
        return ast.value;
      case Kind.INT:
      case Kind.FLOAT:
        return Number(ast.value);
      default:
        return null;
    }
  },
});

const users = new Map();
const posts = new Map();
const likes = new Map();

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

function createSampleUser(data) {
  const id = generateId();
  const user = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
  users.set(id, user);
  return user;
}

function createSamplePost(data) {
  const id = generateId();
  const post = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
  posts.set(id, post);
  return post;
}

const sampleUser = createSampleUser({
  email: 'demo@example.com',
  username: 'demouser',
  firstName: 'Demo',
  lastName: 'User',
  bio: 'Sample user for testing',
});

createSamplePost({
  title: 'Welcome to {{name}}',
  content: 'This is a sample post to demonstrate the GraphQL API.',
  authorId: sampleUser.id,
});

export const resolvers = {
  Date: dateScalar,
  JSON: jsonScalar,

  Query: {
    me: (_parent, _args, context) => context.user || sampleUser,
    user: (_parent, args) => users.get(args.id),
    users: (_parent, args) => Array.from(users.values()).slice(args.offset, args.offset + args.limit),
    post: (_parent, args) => posts.get(args.id),
    posts: (_parent, args) => Array.from(posts.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(args.offset, args.offset + args.limit),
    postsPaginated: (_parent, args) => {
      const allPosts = Array.from(posts.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const afterIndex = args.after ? allPosts.findIndex(p => p.id === args.after) : -1;
      const slicedPosts = allPosts.slice(afterIndex + 1, afterIndex + 1 + args.first);
      return {
        edges: slicedPosts.map(post => ({ node: post, cursor: post.id })),
        pageInfo: {
          hasNextPage: afterIndex + 1 + args.first < allPosts.length,
          hasPreviousPage: afterIndex > 0,
          startCursor: slicedPosts[0]?.id || null,
          endCursor: slicedPosts[slicedPosts.length - 1]?.id || null,
          totalCount: allPosts.length,
        },
      };
    },
    search: (_parent, args) => {
      const query = args.query.toLowerCase();
      const results = [];
      for (const user of users.values()) {
        if (user.username.toLowerCase().includes(query) || user.firstName.toLowerCase().includes(query)) {
          results.push({ __typename: 'User', ...user });
        }
      }
      for (const post of posts.values()) {
        if (post.title.toLowerCase().includes(query) || post.content.toLowerCase().includes(query)) {
          results.push({ __typename: 'Post', ...post });
        }
      }
      return results;
    },
    stats: () => ({
      userCount: users.size,
      postCount: posts.size,
      commentCount: 0,
      likeCount: likes.size,
    }),
  },

  Mutation: {
    register: async (_parent, args) => {
      const existingUser = Array.from(users.values()).find(
        u => u.email === args.input.email || u.username === args.input.username
      );
      if (existingUser) throw new Error('User already exists');
      const user = createSampleUser(args.input);
      const token = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64');
      return { token, user };
    },
    login: async (_parent, args) => {
      const user = Array.from(users.values()).find(u => u.email === args.input.email);
      if (!user) throw new Error('Invalid credentials');
      const token = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64');
      return { token, user };
    },
    logout: () => true,
    updateProfile: (_parent, args, context) => {
      if (!context.user) throw new Error('Not authenticated');
      const user = users.get(context.user.id);
      if (!user) throw new Error('User not found');
      Object.assign(user, args.input, { updatedAt: new Date() });
      return user;
    },
    createPost: (_parent, args, context) => {
      if (!context.user) throw new Error('Not authenticated');
      const post = createSamplePost({ ...args.input, authorId: context.user.id });
      pubsub.publish('POST_CREATED', { postCreated: post });
      return post;
    },
    updatePost: (_parent, args, context) => {
      if (!context.user) throw new Error('Not authenticated');
      const post = posts.get(args.id);
      if (!post) throw new Error('Post not found');
      if (post.authorId !== context.user.id) throw new Error('Not authorized');
      Object.assign(post, args.input, { updatedAt: new Date() });
      return post;
    },
    deletePost: (_parent, args, context) => {
      if (!context.user) throw new Error('Not authenticated');
      const post = posts.get(args.id);
      if (!post) throw new Error('Post not found');
      if (post.authorId !== context.user.id) throw new Error('Not authorized');
      return posts.delete(args.id);
    },
    likePost: (_parent, args, context) => {
      if (!context.user) throw new Error('Not authenticated');
      const post = posts.get(args.postId);
      if (!post) throw new Error('Post not found');
      const id = generateId();
      const like = { id, userId: context.user.id, postId: args.postId, createdAt: new Date() };
      likes.set(id, like);
      return like;
    },
    unlikePost: (_parent, args, context) => {
      if (!context.user) throw new Error('Not authenticated');
      for (const [id, like] of likes.entries()) {
        if (like.userId === context.user.id && like.postId === args.postId) {
          likes.delete(id);
          return true;
        }
      }
      return false;
    },
  },

  Subscription: {
    postCreated: {
      subscribe: () => pubsub.asyncIterator(['POST_CREATED']),
    },
    postUpdated: {
      subscribe: () => pubsub.asyncIterator(['POST_UPDATED']),
    },
  },

  User: {
    posts: (parent) => Array.from(posts.values()).filter(p => p.authorId === parent.id),
    postCount: (parent) => Array.from(posts.values()).filter(p => p.authorId === parent.id).length,
  },

  Post: {
    author: (parent) => users.get(parent.authorId),
    likes: (parent) => Array.from(likes.values()).filter(l => l.postId === parent.id),
    likeCount: (parent) => Array.from(likes.values()).filter(l => l.postId === parent.id).length,
    comments: () => [],
    commentCount: () => 0,
  },

  Like: {
    user: (parent) => users.get(parent.userId),
    post: (parent) => posts.get(parent.postId),
  },

  SearchResult: {
    __resolveType: (obj) => obj.email ? 'User' : 'Post',
  },
};
`,
    'src/server.ts': `import { ApolloServer } from 'apollo-server-express';
import express from 'express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolvers, pubsub } from './resolvers.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 4000;

const typeDefs = readFileSync(join(__dirname, 'schema.graphql'), 'utf-8');

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const apolloServer = new ApolloServer({
  schema,
  context: ({ req }) => {
    const token = req.headers.authorization || '';
    let user = null;
    if (token) {
      try {
        const payload = JSON.parse(Buffer.from(token, 'base64').toString());
        user = { id: payload.userId };
      } catch (e) {}
    }
    return { user, pubsub };
  },
  introspection: true,
  csrfPrevention: true,
});

const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

async function startServer() {
  await apolloServer.start();
  apolloServer.applyMiddleware({ app, path: '/graphql' });
  app.listen(PORT, () => {
    console.log('🚀 GraphQL server ready at http://localhost:' + PORT + '/graphql');
    console.log('📊 GraphQL Playground at http://localhost:' + PORT + '/graphql');
  });
}

startServer().catch((error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});
`,
    'codegen.yml': `# GraphQL Code Generator Configuration

schema:
  - ./src/schema.graphql

documents:
  - "./src/**/*.graphql"

generates:
  src/generated/types.ts:
    plugins:
      - "typescript"
    config:
      strict: true

  src/generated/resolvers.ts:
    plugins:
      - "typescript"
      - "typescript-resolvers"
    config:
      useIndexSignature: true
      contextType: "../resolvers#Context"

  src/generated/hooks.tsx:
    plugins:
      - "typescript"
      - "typescript-operations"
      - "typescript-react-apollo"
    config:
      withHooks: true

config:
  scalars:
    Date: Date
    JSON: Record<string, unknown>
`,
    'src/client.ts': `import { GraphQLClient, gql } from 'graphql-request';

const defaultUrl = typeof window !== 'undefined' ? '/graphql' : 'http://localhost:4000/graphql';

class GraphQLClientSDK {
  private client: GraphQLClient;

  constructor(url = defaultUrl) {
    this.client = new GraphQLClient(url);
  }

  setToken(token: string) {
    this.client.setHeader('authorization', 'Bearer ' + token);
  }

  clearToken() {
    this.client.setHeader('authorization', '');
  }

  async getMe() {
    return this.client.request(
      'query GetMe { me { id email username firstName lastName } }'
    );
  }

  async getUser(id: string) {
    return this.client.request(
      \`query GetUser($id: ID!) { user(id: $id) { id email username } }\`,
      { id }
    );
  }

  async getPosts(limit = 10, offset = 0) {
    return this.client.request(
      \`query GetPosts($limit: Int, $offset: Int) { posts(limit: $limit, offset: $offset) { id title content } }\`,
      { limit, offset }
    );
  }

  async register(input) {
    return this.client.request(
      \`mutation Register($input: RegisterInput!) { register(input: $input) { token user { id } } }\`,
      { input }
    );
  }

  async login(email: string, password: string) {
    return this.client.request(
      \`mutation Login($input: LoginInput!) { login(input: $input) { token user { id } } }\`,
      { input: { email, password } }
    );
  }

  async createPost(title: string, content: string) {
    return this.client.request(
      \`mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { id } }\`,
      { input: { title, content } }
    );
  }
}

export const graphqlClient = new GraphQLClientSDK();
export { GraphQLClientSDK };
`,
    'package.json': `{
  "name": "{{name}}",
  "version": "1.0.0",
  "description": "{{description}}",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "node --loader tsx src/server.ts",
    "codegen": "graphql-codegen --config codegen.yml"
  },
  "dependencies": {
    "graphql": "^16.9.0",
    "@apollo-server/express": "^3.12.1",
    "@graphql-tools/schema": "^10.0.6",
    "express": "^4.19.2",
    "dotenv": "^16.4.5",
    "graphql-subscriptions": "^2.0.0",
    "graphql-request": "^6.1.0",
    "@apollo/client": "^3.11.8"
  },
  "devDependencies": {
    "@types/graphql": "^14.5.0",
    "@types/express": "^4.17.21",
    "typescript": "^5.5.4",
    "tsx": "^4.16.2",
    "nodemon": "^3.1.4"
  }
}
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
`,
    '.env.example': `PORT=4000
NODE_ENV=development
JWT_SECRET=your-secret-key-here
`,
    'Dockerfile': `FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production
COPY . .
RUN npm ci
EXPOSE 4000
ENV NODE_ENV=production
CMD ["npm", "start"]
`,
    'docker-compose.yml': `version: '3.8'
services:
  graphql-server:
    build: .
    container_name: {{name}}-graphql
    ports:
      - "4000:4000"
    environment:
      - PORT=4000
      - NODE_ENV=production
`,
    'README.md': `# {{name}} - GraphQL Codegen

Type-safe GraphQL API with automatic code generation.

## Features

- Type-Safe Schema with TypeScript
- Auto-Generated Resolver Types
- Client SDK Generation
- React Hooks Support
- GraphQL Subscriptions

## Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

Server runs at http://localhost:4000/graphql

## Code Generation

\`\`\`bash
npm run codegen
\`\`\`

## Usage

\`\`\`typescript
import { graphqlClient } from './client';

const { me } = await graphqlClient.getMe();
const { login } = await graphqlClient.login('user@example.com', 'password');
graphqlClient.setToken(login.token);
\`\`\`
`,
  },
};
