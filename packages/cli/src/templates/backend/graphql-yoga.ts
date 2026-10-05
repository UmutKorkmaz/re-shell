import { BackendTemplate } from '../types';

export const graphqlYogaTemplate: BackendTemplate = {
  id: 'graphql-yoga',
  name: 'graphql-yoga',
  displayName: 'GraphQL Yoga',
  description: 'Fully-featured GraphQL server with focus on easy setup, performance, and extensibility',
  language: 'typescript',
  framework: 'graphql-yoga',
  version: '5.3.1',
  tags: ['nodejs', 'graphql', 'yoga', 'api', 'websockets', 'typescript', 'schema-first'],
  port: 4000,
  dependencies: {},
  features: [
    'graphql', 'websockets', 'file-upload', 'middleware', 
    'authentication', 'authorization', 'caching', 'caching', 
    'rate-limiting', 'caching', 'monitoring'
  ],
  
  files: {
    // TypeScript project configuration
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "GraphQL Yoga server with TypeScript",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc && node scripts/copy-schema.mjs",
    "start": "node dist/index.js",
    "codegen": "graphql-codegen --config codegen.yml",
    "codegen:watch": "graphql-codegen --config codegen.yml --watch",
    "lint": "eslint src --ext .ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "docker:build": "docker build -t {{projectName}} .",
    "docker:run": "docker run -p 4000:4000 {{projectName}}",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "dataloader": "^2.2.2",
    "dotenv": "^16.4.5",
    "graphql": "^16.8.1",
    "graphql-middleware": "^6.1.35",
    "graphql-shield": "^7.6.5",
    "graphql-ws": "^5.16.0",
    "graphql-yoga": "^5.3.1",
    "jsonwebtoken": "^9.0.2",
    "pino": "^9.0.0",
    "redis": "^4.6.13",
    "ws": "^8.17.0",
    "@envelop/depth-limit": "^4.0.0",
    "@envelop/disable-introspection": "^6.0.0",
    "@envelop/rate-limiter": "^6.0.1",
    "@graphql-tools/load-files": "^7.0.0",
    "@graphql-tools/merge": "^9.0.3",
    "@graphql-tools/schema": "^10.0.3",
    "@graphql-tools/utils": "^10.1.2",
    "@graphql-yoga/plugin-csrf-prevention": "^3.3.1",
    "@graphql-yoga/plugin-prometheus": "^2.0.0",
    "@graphql-yoga/plugin-response-cache": "^3.5.0",
    "@prisma/client": "^5.13.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.7",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.6",
    "@graphql-codegen/cli": "^5.0.2",
    "@graphql-codegen/typescript": "^4.0.6",
    "@graphql-codegen/typescript-resolvers": "^4.0.6",
    "@graphql-codegen/typescript-operations": "^4.2.0",
    "@graphql-codegen/typed-document-node": "^5.0.6",
    "@typescript-eslint/eslint-plugin": "^7.7.1",
    "@typescript-eslint/parser": "^7.7.1",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.2.5",
    "typescript": "^5.4.5",
    "tsx": "^4.7.2",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "@types/jest": "^29.5.12",
    "graphql-request": "^6.1.0",
    "nodemon": "^3.1.0",
    "@types/ws": "^8.5.10",
    "prisma": "^5.13.0",
    "pino-pretty": "^11.0.0"
  }
}`,

    // TypeScript configuration
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,
    "noEmitOnError": true,
    "allowSyntheticDefaultImports": true,
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@schema/*": ["src/schema/*"],
      "@resolvers/*": ["src/resolvers/*"],
      "@services/*": ["src/services/*"],
      "@utils/*": ["src/utils/*"],
      "@types/*": ["src/types/*"],
      "@plugins/*": ["src/plugins/*"],
      "@models/*": ["src/models/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "coverage"]
}`,

    // GraphQL Code Generator configuration
    'codegen.yml': `overwrite: true
schema: "./src/schema/**/*.graphql"
documents: null
generates:
  src/generated/graphql.ts:
    plugins:
      - typescript
      - typescript-resolvers
    config:
      useIndexSignature: true
      contextType: ../context#Context
      mappers:
        User: '@prisma/client#User as UserModel'
        Post: '@prisma/client#Post as PostModel'
        Comment: '@prisma/client#Comment as CommentModel'
      enumsAsTypes: true
      scalars:
        DateTime: Date
        Upload: File
`,

    // Main application entry point
    'src/index.ts': `import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import dotenv from 'dotenv';
import { createContext } from './context';
import { schema } from './schema';
import { plugins } from './plugins';
import { logger } from './utils/logger';
import { connectDatabase } from './services/database';
import { redisClient } from './services/redis';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Create Yoga instance with all plugins and configuration
const yoga = createYoga({
  schema,
  context: createContext,
  plugins,
  logging: {
    debug: (...args: unknown[]) => logger.debug(args),
    info: (...args: unknown[]) => logger.info(args),
    warn: (...args: unknown[]) => logger.warn(args),
    error: (...args: unknown[]) => logger.error(args)},
  maskedErrors: process.env.NODE_ENV === 'production',
  graphiql: {
    title: '{{projectName}} GraphQL API',
    defaultQuery: \`# Welcome to {{projectName}} GraphQL API

query GetUsers {
  users {
    edges {
      node {
        id
        name
        email
      }
    }
  }
}

mutation CreateUser {
  createUser(input: {
    name: "John Doe"
    email: "john@example.com"
    password: "securepassword"
  }) {
    id
    name
    email
  }
}

subscription OnPostCreated {
  postCreated {
    id
    title
  }
}\`},
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true},
  batching: true,
  healthCheckEndpoint: '/health',
  landingPage: process.env.NODE_ENV !== 'production'});

// Create HTTP server
const httpServer = createServer(yoga);

// Create WebSocket server for subscriptions
const wsServer = new WebSocketServer({
  server: httpServer,
  path: yoga.graphqlEndpoint});

// Serve GraphQL subscriptions over graphql-ws with Yoga's envelop pipeline
useServer(
  {
    execute: (args: any) => args.rootValue.execute(args),
    subscribe: (args: any) => args.rootValue.subscribe(args),
    onSubscribe: async (ctx, message) => {
      const params = message.payload;
      const { schema, execute, subscribe, contextFactory, parse, validate } = yoga.getEnveloped({
        ...ctx,
        req: ctx.extra.request,
        socket: ctx.extra.socket,
        params});

      const args = {
        schema,
        operationName: params.operationName,
        document: parse(params.query),
        variableValues: params.variables,
        contextValue: await contextFactory(),
        rootValue: {
          execute,
          subscribe}};

      const errors = validate(args.schema, args.document);
      if (errors.length) return errors;
      return args;
    },
    onConnect: async () => {
      logger.info('Client connected to WebSocket');
    },
    onDisconnect: async () => {
      logger.info('Client disconnected from WebSocket');
    }},
  wsServer
);

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down server...');

  wsServer.close(() => {
    logger.info('WebSocket server closed');
  });

  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  await redisClient.quit();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Connect to Redis
    await redisClient.connect();

    httpServer.listen(PORT, HOST, () => {
      logger.info(\`GraphQL Server is running on http://\${HOST}:\${PORT}\${yoga.graphqlEndpoint}\`);
      logger.info(\`GraphQL IDE: http://\${HOST}:\${PORT}\${yoga.graphqlEndpoint}\`);
      logger.info(\`Health check: http://\${HOST}:\${PORT}/health\`);
      logger.info(\`WebSocket subscriptions: ws://\${HOST}:\${PORT}\${yoga.graphqlEndpoint}\`);
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();
`,

    // Context creation
    'src/context.ts': `import { YogaInitialContext } from 'graphql-yoga';
import { PrismaClient } from '@prisma/client';
import { authenticateUser } from './utils/auth';
import { createDataLoaders } from './dataloaders';
import { pubsub } from './utils/pubsub';
import { logger } from './utils/logger';

const prisma = new PrismaClient();

export interface Context {
  prisma: PrismaClient;
  user: { id: string; email: string; role: string } | null;
  dataloaders: ReturnType<typeof createDataLoaders>;
  pubsub: typeof pubsub;
  logger: typeof logger;
  request: Request;
}

export async function createContext(initialContext: YogaInitialContext): Promise<Context> {
  const token = initialContext.request.headers.get('authorization')?.replace('Bearer ', '');
  const user = token ? await authenticateUser(token) : null;

  return {
    prisma,
    user,
    dataloaders: createDataLoaders(prisma),
    pubsub,
    logger,
    request: initialContext.request};
}`,

    // Schema index
    'src/schema/index.ts': `import { makeExecutableSchema } from '@graphql-tools/schema';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';
import { loadFilesSync } from '@graphql-tools/load-files';
import { applyMiddleware } from 'graphql-middleware';
import path from 'path';
import { permissions } from '../permissions';
import { userResolvers } from '../resolvers/user.resolver';
import { postResolvers } from '../resolvers/post.resolver';
import { commentResolvers } from '../resolvers/comment.resolver';

// Type definitions live next to this file (src/schema in development, dist/schema after \`npm run build\`)
const typeDefs = mergeTypeDefs(loadFilesSync(path.join(__dirname, './**/*.graphql')));
const resolvers = mergeResolvers([userResolvers, postResolvers, commentResolvers]);

const executableSchema = makeExecutableSchema({
  typeDefs,
  resolvers});

// graphql-shield permissions are applied as middleware around every resolver
export const schema = applyMiddleware(executableSchema, permissions);
`,

    // Base schema
    'src/schema/schema.graphql': `scalar DateTime
scalar Upload

type Query {
  _empty: String
}

type Mutation {
  _empty: String
}

type Subscription {
  _empty: String
}

directive @auth(requires: Role = USER) on FIELD_DEFINITION
directive @rateLimit(max: Int!, window: String!) on FIELD_DEFINITION

enum Role {
  USER
  ADMIN
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}`,

    // User schema
    'src/schema/user.graphql': `extend type Query {
  users(first: Int, after: String, filter: UserFilter): UserConnection! @auth
  user(id: ID!): User @auth
  me: User @auth
}

extend type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User! @auth
  deleteUser(id: ID!): Boolean! @auth(requires: ADMIN)
  login(email: String!, password: String!): AuthPayload! @rateLimit(max: 5, window: "15m")
  logout: Boolean! @auth
  refreshToken(token: String!): AuthPayload!
  forgotPassword(email: String!): Boolean! @rateLimit(max: 3, window: "1h")
  resetPassword(token: String!, newPassword: String!): Boolean!
  changePassword(currentPassword: String!, newPassword: String!): Boolean! @auth
  uploadAvatar(file: Upload!): User! @auth
}

extend type Subscription {
  userCreated: User! @auth(requires: ADMIN)
  userUpdated(id: ID!): User! @auth
}

type User {
  id: ID!
  email: String!
  name: String!
  role: Role!
  avatar: String
  isEmailVerified: Boolean!
  posts: [Post!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  cursor: String!
  node: User!
}

type AuthPayload {
  user: User!
  accessToken: String!
  refreshToken: String!
}

input CreateUserInput {
  email: String!
  password: String!
  name: String!
  role: Role
}

input UpdateUserInput {
  email: String
  name: String
  role: Role
}

input UserFilter {
  role: Role
  isEmailVerified: Boolean
  search: String
}`,

    // Post schema
    'src/schema/post.graphql': `extend type Query {
  posts(first: Int, after: String, filter: PostFilter): PostConnection! 
  post(id: ID!): Post
  searchPosts(query: String!): [Post!]!
}

extend type Mutation {
  createPost(input: CreatePostInput!): Post! @auth
  updatePost(id: ID!, input: UpdatePostInput!): Post! @auth
  deletePost(id: ID!): Boolean! @auth
  publishPost(id: ID!): Post! @auth
  unpublishPost(id: ID!): Post! @auth
  likePost(id: ID!): Post! @auth
  unlikePost(id: ID!): Post! @auth
}

extend type Subscription {
  postCreated: Post!
  postUpdated(id: ID!): Post!
  postLiked(id: ID!): Post!
}

type Post {
  id: ID!
  title: String!
  content: String!
  excerpt: String
  published: Boolean!
  author: User!
  comments: [Comment!]!
  likes: [User!]!
  likesCount: Int!
  tags: [String!]!
  createdAt: DateTime!
  updatedAt: DateTime!
  publishedAt: DateTime
}

type PostConnection {
  edges: [PostEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type PostEdge {
  cursor: String!
  node: Post!
}

input CreatePostInput {
  title: String!
  content: String!
  excerpt: String
  tags: [String!]
  published: Boolean
}

input UpdatePostInput {
  title: String
  content: String
  excerpt: String
  tags: [String!]
}

input PostFilter {
  published: Boolean
  authorId: ID
  tags: [String!]
  search: String
}`,

    // Comment schema
    'src/schema/comment.graphql': `extend type Query {
  comments(postId: ID!, first: Int, after: String): CommentConnection!
  comment(id: ID!): Comment
}

extend type Mutation {
  createComment(postId: ID!, content: String!): Comment! @auth
  updateComment(id: ID!, content: String!): Comment! @auth
  deleteComment(id: ID!): Boolean! @auth
}

extend type Subscription {
  commentCreated(postId: ID!): Comment!
}

type Comment {
  id: ID!
  content: String!
  author: User!
  post: Post!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type CommentConnection {
  edges: [CommentEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type CommentEdge {
  cursor: String!
  node: Comment!
}`,

    // User resolver
    'src/resolvers/user.resolver.ts': `import { Resolvers } from '../generated/graphql';
import { GraphQLError } from 'graphql';
import bcrypt from 'bcryptjs';
import { generateTokens, verifyRefreshToken } from '../utils/auth';
import { sendPasswordResetEmail } from '../services/email';
import { handleFileUpload } from '../utils/upload';

export const userResolvers: Resolvers = {
  Query: {
    users: async (_, args, { prisma, user }) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const where = args.filter ? {
        AND: [
          args.filter.role ? { role: args.filter.role } : {},
          args.filter.isEmailVerified != null ? { isEmailVerified: args.filter.isEmailVerified } : {},
          args.filter.search ? {
            OR: [
              { name: { contains: args.filter.search, mode: 'insensitive' as const } },
              { email: { contains: args.filter.search, mode: 'insensitive' as const } }]} : {}]} : {};

      const totalCount = await prisma.user.count({ where });
      
      const users = await prisma.user.findMany({
        where,
        take: args.first || 10,
        skip: args.after ? 1 : 0,
        cursor: args.after ? { id: args.after } : undefined,
        orderBy: { createdAt: 'desc' }});

      const edges = users.map(user => ({
        cursor: user.id,
        node: user}));

      return {
        edges,
        pageInfo: {
          hasNextPage: users.length === (args.first || 10),
          hasPreviousPage: !!args.after,
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor},
        totalCount};
    },

    user: async (_, { id }, { prisma, user }) => {
      if (!user) throw new GraphQLError('Not authenticated');
      
      const foundUser = await prisma.user.findUnique({ where: { id } });
      if (!foundUser) throw new GraphQLError('User not found');
      
      return foundUser;
    },

    me: async (_, __, { prisma, user }) => {
      if (!user) throw new GraphQLError('Not authenticated');
      
      const me = await prisma.user.findUnique({ where: { id: user.id } });
      if (!me) throw new GraphQLError('User not found');
      
      return me;
    }},

  Mutation: {
    createUser: async (_, { input }, { prisma, pubsub }) => {
      const existingUser = await prisma.user.findUnique({
        where: { email: input.email }});

      if (existingUser) {
        throw new GraphQLError('User with this email already exists');
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);

      const user = await prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          role: input.role ?? undefined,
          password: hashedPassword}});

      await pubsub.publish('USER_CREATED', { userCreated: user });

      return user;
    },

    updateUser: async (_, { id, input }, { prisma, user, pubsub }) => {
      if (!user) throw new GraphQLError('Not authenticated');
      
      if (user.id !== id && user.role !== 'ADMIN') {
        throw new GraphQLError('Not authorized');
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          email: input.email ?? undefined,
          name: input.name ?? undefined,
          role: input.role ?? undefined}});

      await pubsub.publish(\`USER_UPDATED_\${id}\`, { userUpdated: updatedUser });

      return updatedUser;
    },

    deleteUser: async (_, { id }, { prisma, user }) => {
      if (!user || user.role !== 'ADMIN') {
        throw new GraphQLError('Not authorized');
      }

      await prisma.user.delete({ where: { id } });
      return true;
    },

    login: async (_, { email, password }, { prisma, logger }) => {
      const user = await prisma.user.findUnique({ where: { email } });
      
      if (!user || !(await bcrypt.compare(password, user.password))) {
        logger.warn(\`Failed login attempt for email: \${email}\`);
        throw new GraphQLError('Invalid credentials');
      }

      const tokens = generateTokens(user);

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshTokens: { push: tokens.refreshToken } }});

      return {
        user,
        ...tokens};
    },

    logout: async (_, __, { user, prisma }) => {
      if (!user) throw new GraphQLError('Not authenticated');

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshTokens: [] }});

      return true;
    },

    refreshToken: async (_, { token }, { prisma }) => {
      const payload = verifyRefreshToken(token);
      if (!payload) throw new GraphQLError('Invalid refresh token');

      const user = await prisma.user.findUnique({
        where: { id: payload.userId }});

      if (!user || !user.refreshTokens.includes(token)) {
        throw new GraphQLError('Invalid refresh token');
      }

      const tokens = generateTokens(user);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          refreshTokens: {
            set: user.refreshTokens.filter(t => t !== token).concat(tokens.refreshToken)}}});

      return {
        user,
        ...tokens};
    },

    forgotPassword: async (_, { email }, { prisma }) => {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return true; // Don't reveal if user exists

      const resetToken = await sendPasswordResetEmail(user);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry: new Date(Date.now() + 3600000), // 1 hour
        }});

      return true;
    },

    resetPassword: async (_, { token, newPassword }, { prisma }) => {
      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: { gt: new Date() }}});

      if (!user) throw new GraphQLError('Invalid or expired reset token');

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null}});

      return true;
    },

    changePassword: async (_, { currentPassword, newPassword }, { prisma, user }) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const currentUser = await prisma.user.findUnique({
        where: { id: user.id }});

      if (!currentUser || !(await bcrypt.compare(currentPassword, currentUser.password))) {
        throw new GraphQLError('Current password is incorrect');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }});

      return true;
    },

    uploadAvatar: async (_, { file }, { prisma, user }) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const avatarUrl = await handleFileUpload(file, {
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
        maxSize: 5 * 1024 * 1024, // 5MB
      });

      return prisma.user.update({
        where: { id: user.id },
        data: { avatar: avatarUrl }});
    }},

  Subscription: {
    userCreated: {
      subscribe: (_, __, { pubsub, user }) => {
        if (!user || user.role !== 'ADMIN') {
          throw new GraphQLError('Not authorized');
        }
        return pubsub.subscribe('USER_CREATED');
      }},

    userUpdated: {
      subscribe: (_, { id }, { pubsub, user }) => {
        if (!user) throw new GraphQLError('Not authenticated');
        
        if (user.id !== id && user.role !== 'ADMIN') {
          throw new GraphQLError('Not authorized');
        }
        
        return pubsub.subscribe(\`USER_UPDATED_\${id}\`);
      }}},

  User: {
    posts: async (parent, _, { dataloaders }) => {
      return dataloaders.postsByUserIdLoader.load(parent.id);
    }}};`,

    // Post resolver
    'src/resolvers/post.resolver.ts': `import { Resolvers } from '../generated/graphql';
import { GraphQLError } from 'graphql';

export const postResolvers: Resolvers = {
  Query: {
    posts: async (_, args, { prisma }) => {
      const where = args.filter ? {
        AND: [
          args.filter.published != null ? { published: args.filter.published } : {},
          args.filter.authorId ? { authorId: args.filter.authorId } : {},
          args.filter.tags?.length ? { tags: { hasSome: args.filter.tags } } : {},
          args.filter.search ? {
            OR: [
              { title: { contains: args.filter.search, mode: 'insensitive' as const } },
              { content: { contains: args.filter.search, mode: 'insensitive' as const } }]} : {}]} : {};

      const totalCount = await prisma.post.count({ where });
      
      const posts = await prisma.post.findMany({
        where,
        take: args.first || 10,
        skip: args.after ? 1 : 0,
        cursor: args.after ? { id: args.after } : undefined,
        orderBy: { createdAt: 'desc' },
        include: { author: true }});

      const edges = posts.map(post => ({
        cursor: post.id,
        node: post}));

      return {
        edges,
        pageInfo: {
          hasNextPage: posts.length === (args.first || 10),
          hasPreviousPage: !!args.after,
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor},
        totalCount};
    },

    post: async (_, { id }, { prisma }) => {
      return prisma.post.findUnique({
        where: { id },
        include: { author: true }});
    },

    searchPosts: async (_, { query }, { prisma }) => {
      return prisma.post.findMany({
        where: {
          published: true,
          OR: [
            { title: { contains: query, mode: 'insensitive' as const } },
            { content: { contains: query, mode: 'insensitive' as const } },
            { tags: { has: query.toLowerCase() } }]},
        include: { author: true },
        orderBy: { createdAt: 'desc' }});
    }},

  Mutation: {
    createPost: async (_, { input }, { prisma, user, pubsub }) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const post = await prisma.post.create({
        data: {
          title: input.title,
          content: input.content,
          excerpt: input.excerpt ?? undefined,
          tags: input.tags ?? [],
          published: input.published ?? false,
          authorId: user.id,
          publishedAt: input.published ? new Date() : null},
        include: { author: true }});

      await pubsub.publish('POST_CREATED', { postCreated: post });

      return post;
    },

    updatePost: async (_, { id, input }, { prisma, user, pubsub }) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const existingPost = await prisma.post.findUnique({
        where: { id }});

      if (!existingPost) throw new GraphQLError('Post not found');
      
      if (existingPost.authorId !== user.id && user.role !== 'ADMIN') {
        throw new GraphQLError('Not authorized');
      }

      const post = await prisma.post.update({
        where: { id },
        data: {
          title: input.title ?? undefined,
          content: input.content ?? undefined,
          excerpt: input.excerpt ?? undefined,
          tags: input.tags ?? undefined},
        include: { author: true }});

      await pubsub.publish(\`POST_UPDATED_\${id}\`, { postUpdated: post });

      return post;
    },

    deletePost: async (_, { id }, { prisma, user }) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const post = await prisma.post.findUnique({ where: { id } });
      
      if (!post) throw new GraphQLError('Post not found');
      
      if (post.authorId !== user.id && user.role !== 'ADMIN') {
        throw new GraphQLError('Not authorized');
      }

      await prisma.post.delete({ where: { id } });
      return true;
    },

    publishPost: async (_, { id }, { prisma, user }) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const post = await prisma.post.findUnique({ where: { id } });
      
      if (!post) throw new GraphQLError('Post not found');
      
      if (post.authorId !== user.id && user.role !== 'ADMIN') {
        throw new GraphQLError('Not authorized');
      }

      return prisma.post.update({
        where: { id },
        data: { 
          published: true,
          publishedAt: new Date()},
        include: { author: true }});
    },

    unpublishPost: async (_, { id }, { prisma, user }) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const post = await prisma.post.findUnique({ where: { id } });
      
      if (!post) throw new GraphQLError('Post not found');
      
      if (post.authorId !== user.id && user.role !== 'ADMIN') {
        throw new GraphQLError('Not authorized');
      }

      return prisma.post.update({
        where: { id },
        data: { 
          published: false,
          publishedAt: null},
        include: { author: true }});
    },

    likePost: async (_, { id }, { prisma, user, pubsub }) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const post = await prisma.post.update({
        where: { id },
        data: {
          likes: { connect: { id: user.id } }},
        include: { author: true, likes: true }});

      await pubsub.publish(\`POST_LIKED_\${id}\`, { postLiked: post });

      return post;
    },

    unlikePost: async (_, { id }, { prisma, user }) => {
      if (!user) throw new GraphQLError('Not authenticated');

      return prisma.post.update({
        where: { id },
        data: {
          likes: { disconnect: { id: user.id } }},
        include: { author: true, likes: true }});
    }},

  Subscription: {
    postCreated: {
      subscribe: (_, __, { pubsub }) => {
        return pubsub.subscribe('POST_CREATED');
      }},

    postUpdated: {
      subscribe: (_, { id }, { pubsub }) => {
        return pubsub.subscribe(\`POST_UPDATED_\${id}\`);
      }},

    postLiked: {
      subscribe: (_, { id }, { pubsub }) => {
        return pubsub.subscribe(\`POST_LIKED_\${id}\`);
      }}},

  Post: {
    author: async (parent, _, { dataloaders }) => {
      const author = await dataloaders.userLoader.load(parent.authorId);
      if (!author) throw new GraphQLError('Author not found');
      return author;
    },

    comments: async (parent, _, { dataloaders }) => {
      return dataloaders.commentsByPostIdLoader.load(parent.id);
    },

    likes: async (parent, _, { prisma }) => {
      const post = await prisma.post.findUnique({
        where: { id: parent.id },
        include: { likes: true }});
      return post?.likes || [];
    },

    likesCount: async (parent, _, { prisma }) => {
      return prisma.user.count({
        where: { likedPosts: { some: { id: parent.id } } }});
    }}};`,

    // Comment resolver
    'src/resolvers/comment.resolver.ts': `import { Resolvers } from '../generated/graphql';
import { GraphQLError } from 'graphql';

export const commentResolvers: Resolvers = {
  Query: {
    comments: async (_, { postId, first, after }, { prisma }) => {
      const totalCount = await prisma.comment.count({
        where: { postId }});
      
      const comments = await prisma.comment.findMany({
        where: { postId },
        take: first || 10,
        skip: after ? 1 : 0,
        cursor: after ? { id: after } : undefined,
        orderBy: { createdAt: 'desc' },
        include: { author: true }});

      const edges = comments.map(comment => ({
        cursor: comment.id,
        node: comment}));

      return {
        edges,
        pageInfo: {
          hasNextPage: comments.length === (first || 10),
          hasPreviousPage: !!after,
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor},
        totalCount};
    },

    comment: async (_, { id }, { prisma }) => {
      return prisma.comment.findUnique({
        where: { id },
        include: { author: true, post: true }});
    }},

  Mutation: {
    createComment: async (_, { postId, content }, { prisma, user, pubsub }) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const post = await prisma.post.findUnique({ where: { id: postId } });
      if (!post) throw new GraphQLError('Post not found');

      const comment = await prisma.comment.create({
        data: {
          content,
          authorId: user.id,
          postId},
        include: { author: true, post: true }});

      await pubsub.publish(\`COMMENT_CREATED_\${postId}\`, { commentCreated: comment });

      return comment;
    },

    updateComment: async (_, { id, content }, { prisma, user }) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const existingComment = await prisma.comment.findUnique({
        where: { id }});

      if (!existingComment) throw new GraphQLError('Comment not found');
      
      if (existingComment.authorId !== user.id && user.role !== 'ADMIN') {
        throw new GraphQLError('Not authorized');
      }

      return prisma.comment.update({
        where: { id },
        data: { content },
        include: { author: true, post: true }});
    },

    deleteComment: async (_, { id }, { prisma, user }) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const comment = await prisma.comment.findUnique({ where: { id } });
      
      if (!comment) throw new GraphQLError('Comment not found');
      
      if (comment.authorId !== user.id && user.role !== 'ADMIN') {
        throw new GraphQLError('Not authorized');
      }

      await prisma.comment.delete({ where: { id } });
      return true;
    }},

  Subscription: {
    commentCreated: {
      subscribe: (_, { postId }, { pubsub }) => {
        return pubsub.subscribe(\`COMMENT_CREATED_\${postId}\`);
      }}},

  Comment: {
    author: async (parent, _, { dataloaders }) => {
      const author = await dataloaders.userLoader.load(parent.authorId);
      if (!author) throw new GraphQLError('Author not found');
      return author;
    },

    post: async (parent, _, { dataloaders }) => {
      const post = await dataloaders.postLoader.load(parent.postId);
      if (!post) throw new GraphQLError('Post not found');
      return post;
    }}};`,

    // DataLoader setup
    'src/dataloaders/index.ts': `import DataLoader from 'dataloader';
import { PrismaClient } from '@prisma/client';

export function createDataLoaders(prisma: PrismaClient) {
  return {
    userLoader: new DataLoader(async (userIds: readonly string[]) => {
      const users = await prisma.user.findMany({
        where: { id: { in: [...userIds] } }});
      
      const userMap = new Map(users.map(user => [user.id, user]));
      return userIds.map(id => userMap.get(id) || null);
    }),

    postLoader: new DataLoader(async (postIds: readonly string[]) => {
      const posts = await prisma.post.findMany({
        where: { id: { in: [...postIds] } },
        include: { author: true }});
      
      const postMap = new Map(posts.map(post => [post.id, post]));
      return postIds.map(id => postMap.get(id) || null);
    }),

    postsByUserIdLoader: new DataLoader(async (userIds: readonly string[]) => {
      const posts = await prisma.post.findMany({
        where: { authorId: { in: [...userIds] } },
        include: { author: true }});
      
      const postsByUserId = new Map<string, any[]>();
      posts.forEach(post => {
        const userPosts = postsByUserId.get(post.authorId) || [];
        userPosts.push(post);
        postsByUserId.set(post.authorId, userPosts);
      });
      
      return userIds.map(id => postsByUserId.get(id) || []);
    }),

    commentsByPostIdLoader: new DataLoader(async (postIds: readonly string[]) => {
      const comments = await prisma.comment.findMany({
        where: { postId: { in: [...postIds] } },
        include: { author: true }});
      
      const commentsByPostId = new Map<string, any[]>();
      comments.forEach(comment => {
        const postComments = commentsByPostId.get(comment.postId) || [];
        postComments.push(comment);
        commentsByPostId.set(comment.postId, postComments);
      });
      
      return postIds.map(id => commentsByPostId.get(id) || []);
    })};
}`,

    // Plugins index
    'src/plugins/index.ts': `import { Plugin } from 'graphql-yoga';
import { useDepthLimit } from '@envelop/depth-limit';
import { useDisableIntrospection } from '@envelop/disable-introspection';
import { useRateLimiter } from '@envelop/rate-limiter';
import { useResponseCache } from '@graphql-yoga/plugin-response-cache';
import { usePrometheus } from '@graphql-yoga/plugin-prometheus';
import { useCSRFPrevention } from '@graphql-yoga/plugin-csrf-prevention';
import { authPlugin } from './auth.plugin';
import { errorPlugin } from './error.plugin';
import { loggerPlugin } from './logger.plugin';

const isProduction = process.env.NODE_ENV === 'production';

// Plugins come from several packages with slightly different context generics
export const plugins: Array<Plugin<any>> = [
  // Custom plugins
  authPlugin,
  errorPlugin,
  loggerPlugin,

  // Security plugins
  useDepthLimit({
    maxDepth: 10}),

  ...(isProduction ? [
    useDisableIntrospection(),
    useCSRFPrevention({
      requestHeaders: ['x-graphql-yoga-csrf']})] : []),

  // Performance plugins (in-memory response cache keyed by the caller's token)
  useResponseCache({
    session: (request) => request.headers.get('authorization'),
    ttl: 1000 * 60 * 5, // 5 minutes
    includeExtensionMetadata: !isProduction}),

  // Rate limiting (the @rateLimit directive in the schema)
  useRateLimiter({
    identifyFn: (context: any) => context.request?.headers.get('x-forwarded-for') || 'anonymous'}),

  // Monitoring: Prometheus metrics at /metrics
  usePrometheus({
    endpoint: '/metrics',
    requestCount: true,
    requestSummary: true,
    parse: true,
    validate: true,
    contextBuilding: true,
    execute: true,
    errors: true,
    deprecatedFields: true})];
`,

    // Auth plugin
    'src/plugins/auth.plugin.ts': `import { Plugin } from 'graphql-yoga';
import { GraphQLError } from 'graphql';
import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils';

/** Enforces the \`@auth(requires: ROLE)\` schema directive on field definitions. */
export const authPlugin: Plugin = {
  onSchemaChange({ schema, replaceSchema }) {
    const newSchema = mapSchema(schema, {
      [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
        const directive = getDirective(schema, fieldConfig, 'auth')?.[0];
        if (!directive) return fieldConfig;

        const { requires } = directive;
        const originalResolve = fieldConfig.resolve;

        fieldConfig.resolve = async function (source, args, context, info) {
          if (!context.user) {
            throw new GraphQLError('Not authenticated', {
              extensions: { code: 'UNAUTHENTICATED' }});
          }

          if (requires && context.user.role !== requires && context.user.role !== 'ADMIN') {
            throw new GraphQLError('Not authorized', {
              extensions: { code: 'FORBIDDEN' }});
          }

          return originalResolve ? originalResolve(source, args, context, info) : source[info.fieldName];
        };

        return fieldConfig;
      }});

    replaceSchema(newSchema);
  }};
`,

    // Error plugin
    'src/plugins/error.plugin.ts': `import { Plugin } from 'graphql-yoga';
import { GraphQLError } from 'graphql';
import { logger } from '../utils/logger';

/** Logs every error returned by an operation. Masking is done by Yoga's \`maskedErrors\` option. */
export const errorPlugin: Plugin = {
  onExecute() {
    return {
      onExecuteDone({ result, args }) {
        if ('errors' in result && result.errors) {
          result.errors.forEach((error: GraphQLError) => {
            logger.error({
              message: error.message,
              path: error.path,
              extensions: error.extensions,
              stack: error.stack,
              operation: args.operationName});
          });
        }
      }};
  }};
`,

    // Logger plugin
    'src/plugins/logger.plugin.ts': `import { Plugin } from 'graphql-yoga';
import { logger } from '../utils/logger';

export const loggerPlugin: Plugin = {
  onRequest({ request }) {
    logger.info({
      type: 'request',
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries())});
  },

  onExecute({ args }) {
    logger.debug({
      type: 'execute',
      operation: args.operationName,
      variables: args.variableValues});
  },

  onSubscribe({ args }) {
    logger.debug({
      type: 'subscribe',
      operation: args.operationName,
      variables: args.variableValues});
  }};`,

    // Authentication utilities
    'src/utils/auth.ts': `import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../services/database';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export function generateTokens(user: any) {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role};

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn']});

  const refreshToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN as SignOptions['expiresIn']});

  return { accessToken, refreshToken };
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export async function authenticateUser(token: string) {
  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId }});

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role};
}`,

    // PubSub utility
    'src/utils/pubsub.ts': `import { createPubSub } from 'graphql-yoga';

// In-memory PubSub: fine for a single instance. To fan events out across several
// instances, pass an \`eventTarget\` (for example @graphql-yoga/redis-event-target).
export const pubsub = createPubSub();
`,

    // Logger utility
    'src/utils/logger.ts': `import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:standard'}}
    : undefined,
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: req.headers}),
    res: (res) => ({
      statusCode: res.statusCode}),
    err: pino.stdSerializers.err},
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    censor: '[REDACTED]'}});

type LogMethod = (message: unknown, ...args: unknown[]) => void;

/**
 * Accepts both \`logger.error('message', err)\` and pino's native
 * \`logger.error({ err }, 'message')\`; extra arguments are logged as structured data.
 */
const method = (level: 'debug' | 'info' | 'warn' | 'error'): LogMethod =>
  (message, ...args) => {
    const log = baseLogger[level].bind(baseLogger) as (...parts: unknown[]) => void;
    if (typeof message === 'string' && args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
      const [extra, ...rest] = args;
      log({ [extra instanceof Error ? 'err' : 'data']: extra }, message, ...rest);
    } else {
      log(message, ...args);
    }
  };

export const logger = {
  debug: method('debug'),
  info: method('info'),
  warn: method('warn'),
  error: method('error')};
`,

    // File upload utility
    'src/utils/upload.ts': `import { GraphQLError } from 'graphql';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

interface UploadOptions {
  allowedTypes?: string[];
  maxSize?: number;
}

export async function handleFileUpload(
  file: any,
  options: UploadOptions = {}
): Promise<string> {
  const { allowedTypes = [], maxSize = 10 * 1024 * 1024 } = options; // 10MB default

  const upload = await file;
  const { createReadStream, filename, mimetype, encoding } = upload;

  // Validate file type
  if (allowedTypes.length > 0 && !allowedTypes.includes(mimetype)) {
    throw new GraphQLError(\`File type \${mimetype} is not allowed\`);
  }

  // Generate unique filename
  const uniqueFilename = \`\${crypto.randomBytes(16).toString('hex')}-\${filename}\`;
  const uploadPath = path.join(process.cwd(), 'uploads', uniqueFilename);

  // Ensure upload directory exists
  await fs.mkdir(path.dirname(uploadPath), { recursive: true });

  // Stream file to disk with size validation
  const stream = createReadStream();
  const chunks: Buffer[] = [];
  let totalSize = 0;

  for await (const chunk of stream) {
    totalSize += chunk.length;
    
    if (totalSize > maxSize) {
      throw new GraphQLError(\`File size exceeds maximum allowed size of \${maxSize} bytes\`);
    }
    
    chunks.push(chunk);
  }

  // Write file
  await fs.writeFile(uploadPath, Buffer.concat(chunks));

  // Return file URL
  return \`/uploads/\${uniqueFilename}\`;
}`,

    // Database service
    'src/services/database.ts': `import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' }]});

// Log database queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug({
      query: e.query,
      params: e.params,
      duration: e.duration});
  });
}

prisma.$on('error', (e) => {
  logger.error('Database error:', e);
});

export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}`,

    // Redis service
    'src/services/redis.ts': `import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient: RedisClientType = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis: Maximum reconnection attempts reached');
        return new Error('Maximum reconnection attempts reached');
      }
      const delay = Math.min(retries * 100, 3000);
      logger.info(\`Redis: Reconnecting in \${delay}ms...\`);
      return delay;
    }}}) as RedisClientType;

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis Client Connected');
});

redisClient.on('ready', () => {
  logger.info('Redis Client Ready');
});
`,

    // Email service
    'src/services/email.ts': `import crypto from 'crypto';
import { logger } from '../utils/logger';

// This is a placeholder email service
// In production, integrate with services like SendGrid, AWS SES, etc.
export async function sendPasswordResetEmail(user: any): Promise<string> {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // In a real implementation, send an email with the reset link
  logger.info(\`Password reset email sent to \${user.email} with token: \${resetToken}\`);
  
  // Return the token to be stored in the database
  return resetToken;
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  // In a real implementation, send an email with the verification link
  logger.info(\`Verification email sent to \${email} with token: \${token}\`);
}

export async function sendWelcomeEmail(user: any): Promise<void> {
  // In a real implementation, send a welcome email
  logger.info(\`Welcome email sent to \${user.email}\`);
}`,

    // Prisma schema
    'prisma/schema.prisma': `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                String    @id @default(cuid())
  email             String    @unique
  password          String
  name              String
  role              Role      @default(USER)
  avatar            String?
  isEmailVerified   Boolean   @default(false)
  verificationToken String?
  resetToken        String?
  resetTokenExpiry  DateTime?
  refreshTokens     String[]
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  posts             Post[]
  comments          Comment[]
  likedPosts        Post[]    @relation("PostLikes")
  
  @@index([email])
}

model Post {
  id          String    @id @default(cuid())
  title       String
  content     String
  excerpt     String?
  published   Boolean   @default(false)
  publishedAt DateTime?
  tags        String[]
  authorId    String
  author      User      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  comments    Comment[]
  likes       User[]    @relation("PostLikes")
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  @@index([authorId])
  @@index([published])
  @@index([tags])
}

model Comment {
  id        String   @id @default(cuid())
  content   String
  authorId  String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  postId    String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([postId])
  @@index([authorId])
}

enum Role {
  USER
  ADMIN
}`,

    // Environment variables
    '.env.example': `# Application
NODE_ENV=development
PORT=4000
HOST=0.0.0.0

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@example.com

# File Upload
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760

# Logging
LOG_LEVEL=debug

# Client
CLIENT_URL=http://localhost:3000`,

    // Docker configuration
    'Dockerfile': `# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY codegen.yml ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Generate GraphQL types
RUN npm run codegen

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy Prisma schema and GraphQL files
COPY prisma ./prisma
COPY src/schema ./src/schema

# Create uploads directory
RUN mkdir -p uploads && chown -R nodejs:nodejs uploads

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:4000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    container_name: {{projectName}}-graphql
    ports:
      - "\${PORT:-4000}:4000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://\${DB_USER}:\${DB_PASSWORD}@postgres:5432/\${DB_NAME}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - app-network
    volumes:
      - ./uploads:/app/uploads

  postgres:
    image: postgres:16-alpine
    container_name: {{projectName}}-db
    environment:
      - POSTGRES_USER=\${DB_USER:-user}
      - POSTGRES_PASSWORD=\${DB_PASSWORD:-password}
      - POSTGRES_DB=\${DB_NAME:-{{projectName}}}
    ports:
      - "\${DB_PORT:-5432}:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    container_name: {{projectName}}-redis
    command: redis-server --appendonly yes
    ports:
      - "\${REDIS_PORT:-6379}:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    container_name: {{projectName}}-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - ./uploads:/usr/share/nginx/html/uploads:ro
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - app-network

volumes:
  postgres-data:
  redis-data:

networks:
  app-network:
    driver: bridge`,

    // Jest configuration
    'jest.config.js': `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'},
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/__tests__/**',
    '!src/index.ts',
    '!src/generated/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@schema/(.*)$': '<rootDir>/src/schema/$1',
    '^@resolvers/(.*)$': '<rootDir>/src/resolvers/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@plugins/(.*)$': '<rootDir>/src/plugins/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1'},
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000};`,

    // Test setup
    'src/__tests__/setup.ts': `import { prisma } from '../services/database';

beforeAll(async () => {
  // Setup test database
});

afterAll(async () => {
  // Cleanup and disconnect
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clear test data
});`,

    // Example test
    'src/__tests__/user.test.ts': `import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { GraphQLClient } from 'graphql-request';
import { createYoga } from 'graphql-yoga';
import { schema } from '../schema';
import { createContext } from '../context';

describe('User API', () => {
  let client: GraphQLClient;
  let server: Server;

  beforeAll(async () => {
    const yoga = createYoga({
      schema,
      context: createContext});

    server = createServer(yoga);
    await new Promise<void>((resolve) => server.listen(0, resolve));

    const port = (server.address() as AddressInfo).port;
    client = new GraphQLClient(\`http://localhost:\${port}/graphql\`);
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('should create a new user', async () => {
    const mutation = \`
      mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) {
          id
          email
          name
        }
      }
    \`;

    const variables = {
      input: {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'}};

    const response = await client.request<{ createUser: { id: string; email: string; name: string } }>(mutation, variables);

    expect(response.createUser).toHaveProperty('id');
    expect(response.createUser.email).toBe('test@example.com');
    expect(response.createUser.name).toBe('Test User');
  });

  it('should login with valid credentials', async () => {
    const mutation = \`
      mutation Login($email: String!, $password: String!) {
        login(email: $email, password: $password) {
          user {
            id
            email
          }
          accessToken
          refreshToken
        }
      }
    \`;

    const variables = {
      email: 'test@example.com',
      password: 'password123'};

    const response = await client.request<{
      login: { accessToken: string; refreshToken: string; user: { email: string } };
    }>(mutation, variables);

    expect(response.login).toHaveProperty('accessToken');
    expect(response.login).toHaveProperty('refreshToken');
    expect(response.login.user.email).toBe('test@example.com');
  });
});
`,

    // README
    'README.md': `# {{projectName}}

A fully-featured GraphQL server built with GraphQL Yoga, focusing on easy setup, performance, and extensibility.

## Features

- 🚀 **GraphQL Yoga 5** - Fast and extensible GraphQL server
- 📝 **TypeScript** - Type-safe development with code generation
- 🔄 **Subscriptions** - Real-time updates with WebSockets and SSE
- 📤 **File Uploads** - Built-in file upload support
- 🛡️ **Authentication & Authorization** - JWT-based auth with GraphQL Shield
- 🚦 **Rate Limiting** - Protect your API from abuse
- 📊 **DataLoader** - Efficient data fetching with automatic batching
- 🔌 **Envelop Plugins** - Extensible plugin system
- 💾 **Persisted Queries** - Improved performance and security
- 🏗️ **Pothos Schema Builder** - Code-first schema development
- 🗄️ **Prisma ORM** - Type-safe database access
- 🚦 **Redis** - Caching and PubSub for subscriptions
- 🧪 **Testing** - Comprehensive test setup with Jest
- 🐳 **Docker** - Production-ready containerization
- 📊 **Monitoring** - Prometheus metrics and Apollo tracing

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- Redis
- Docker (optional)

### Installation

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Set up environment variables:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

4. Set up the database:
   \`\`\`bash
   npx prisma migrate dev
   \`\`\`

5. Generate GraphQL types:
   \`\`\`bash
   npm run codegen
   \`\`\`

6. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

### Running with Docker

\`\`\`bash
docker-compose up
\`\`\`

## GraphQL Playground

Once the server is running, visit:
- GraphQL IDE: http://localhost:4000/graphql
- Health Check: http://localhost:4000/health
- Metrics: http://localhost:4000/metrics

## Testing

\`\`\`bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
\`\`\`

## Scripts

- \`npm run dev\` - Start development server with hot reload
- \`npm run build\` - Build for production
- \`npm start\` - Start production server
- \`npm run codegen\` - Generate TypeScript types from GraphQL schema
- \`npm run codegen:watch\` - Watch mode for code generation
- \`npm run lint\` - Run ESLint
- \`npm test\` - Run tests
- \`npm run typecheck\` - Type check without building

## Project Structure

\`\`\`
src/
├── schema/         # GraphQL schema definitions
├── resolvers/      # GraphQL resolvers
├── plugins/        # Yoga/Envelop plugins
├── services/       # External services (DB, Redis, Email)
├── dataloaders/    # DataLoader instances
├── utils/          # Utility functions
├── types/          # TypeScript types
├── models/         # Data models
├── generated/      # Generated types
└── index.ts        # Application entry point
\`\`\`

## Schema Design

The GraphQL schema follows these principles:

- **Schema-first** - Define schema in GraphQL SDL
- **Modular** - Split schema into logical modules
- **Type-safe** - Generate TypeScript types from schema
- **Secure** - Use directives for auth and rate limiting

## Authentication

The server uses JWT-based authentication with:
- Access tokens (short-lived)
- Refresh tokens (long-lived)
- Role-based authorization
- GraphQL Shield for declarative permissions

## Performance

Performance optimizations include:
- DataLoader for N+1 query prevention
- Response caching with Redis
- Persisted queries
- Query depth limiting
- Subscription debouncing

## Deployment

The application is containerized and ready for deployment:

1. Build the Docker image:
   \`\`\`bash
   docker build -t {{projectName}} .
   \`\`\`

2. Run with Docker Compose:
   \`\`\`bash
   docker-compose up -d
   \`\`\`

## License

MIT
`,

    'scripts/copy-schema.mjs': `// tsc does not copy the .graphql schema files; the server loads them from dist/schema at runtime.
import { cpSync } from 'node:fs';

cpSync('src/schema', 'dist/schema', {
  recursive: true,
  filter: (source) => !source.endsWith('.ts')
});
`,

    'src/generated/graphql.ts': `import { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import { User as UserModel, Post as PostModel, Comment as CommentModel } from '@prisma/client';
import { Context } from '../context';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  DateTime: { input: Date; output: Date; }
  Upload: { input: File; output: File; }
};

export type AuthPayload = {
  __typename?: 'AuthPayload';
  accessToken: Scalars['String']['output'];
  refreshToken: Scalars['String']['output'];
  user: User;
};

export type Comment = {
  __typename?: 'Comment';
  author: User;
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  post: Post;
  updatedAt: Scalars['DateTime']['output'];
};

export type CommentConnection = {
  __typename?: 'CommentConnection';
  edges: Array<CommentEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type CommentEdge = {
  __typename?: 'CommentEdge';
  cursor: Scalars['String']['output'];
  node: Comment;
};

export type CreatePostInput = {
  content: Scalars['String']['input'];
  excerpt?: InputMaybe<Scalars['String']['input']>;
  published?: InputMaybe<Scalars['Boolean']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  title: Scalars['String']['input'];
};

export type CreateUserInput = {
  email: Scalars['String']['input'];
  name: Scalars['String']['input'];
  password: Scalars['String']['input'];
  role?: InputMaybe<Role>;
};

export type Mutation = {
  __typename?: 'Mutation';
  _empty?: Maybe<Scalars['String']['output']>;
  changePassword: Scalars['Boolean']['output'];
  createComment: Comment;
  createPost: Post;
  createUser: User;
  deleteComment: Scalars['Boolean']['output'];
  deletePost: Scalars['Boolean']['output'];
  deleteUser: Scalars['Boolean']['output'];
  forgotPassword: Scalars['Boolean']['output'];
  likePost: Post;
  login: AuthPayload;
  logout: Scalars['Boolean']['output'];
  publishPost: Post;
  refreshToken: AuthPayload;
  resetPassword: Scalars['Boolean']['output'];
  unlikePost: Post;
  unpublishPost: Post;
  updateComment: Comment;
  updatePost: Post;
  updateUser: User;
  uploadAvatar: User;
};


export type MutationChangePasswordArgs = {
  currentPassword: Scalars['String']['input'];
  newPassword: Scalars['String']['input'];
};


export type MutationCreateCommentArgs = {
  content: Scalars['String']['input'];
  postId: Scalars['ID']['input'];
};


export type MutationCreatePostArgs = {
  input: CreatePostInput;
};


export type MutationCreateUserArgs = {
  input: CreateUserInput;
};


export type MutationDeleteCommentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeletePostArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteUserArgs = {
  id: Scalars['ID']['input'];
};


export type MutationForgotPasswordArgs = {
  email: Scalars['String']['input'];
};


export type MutationLikePostArgs = {
  id: Scalars['ID']['input'];
};


export type MutationLoginArgs = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
};


export type MutationPublishPostArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRefreshTokenArgs = {
  token: Scalars['String']['input'];
};


export type MutationResetPasswordArgs = {
  newPassword: Scalars['String']['input'];
  token: Scalars['String']['input'];
};


export type MutationUnlikePostArgs = {
  id: Scalars['ID']['input'];
};


export type MutationUnpublishPostArgs = {
  id: Scalars['ID']['input'];
};


export type MutationUpdateCommentArgs = {
  content: Scalars['String']['input'];
  id: Scalars['ID']['input'];
};


export type MutationUpdatePostArgs = {
  id: Scalars['ID']['input'];
  input: UpdatePostInput;
};


export type MutationUpdateUserArgs = {
  id: Scalars['ID']['input'];
  input: UpdateUserInput;
};


export type MutationUploadAvatarArgs = {
  file: Scalars['Upload']['input'];
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['String']['output']>;
};

export type Post = {
  __typename?: 'Post';
  author: User;
  comments: Array<Comment>;
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  excerpt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  likes: Array<User>;
  likesCount: Scalars['Int']['output'];
  published: Scalars['Boolean']['output'];
  publishedAt?: Maybe<Scalars['DateTime']['output']>;
  tags: Array<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type PostConnection = {
  __typename?: 'PostConnection';
  edges: Array<PostEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type PostEdge = {
  __typename?: 'PostEdge';
  cursor: Scalars['String']['output'];
  node: Post;
};

export type PostFilter = {
  authorId?: InputMaybe<Scalars['ID']['input']>;
  published?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type Query = {
  __typename?: 'Query';
  _empty?: Maybe<Scalars['String']['output']>;
  comment?: Maybe<Comment>;
  comments: CommentConnection;
  me?: Maybe<User>;
  post?: Maybe<Post>;
  posts: PostConnection;
  searchPosts: Array<Post>;
  user?: Maybe<User>;
  users: UserConnection;
};


export type QueryCommentArgs = {
  id: Scalars['ID']['input'];
};


export type QueryCommentsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  postId: Scalars['ID']['input'];
};


export type QueryPostArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPostsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<PostFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerySearchPostsArgs = {
  query: Scalars['String']['input'];
};


export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};


export type QueryUsersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<UserFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
};

export type Role =
  | 'ADMIN'
  | 'USER';

export type Subscription = {
  __typename?: 'Subscription';
  _empty?: Maybe<Scalars['String']['output']>;
  commentCreated: Comment;
  postCreated: Post;
  postLiked: Post;
  postUpdated: Post;
  userCreated: User;
  userUpdated: User;
};


export type SubscriptionCommentCreatedArgs = {
  postId: Scalars['ID']['input'];
};


export type SubscriptionPostLikedArgs = {
  id: Scalars['ID']['input'];
};


export type SubscriptionPostUpdatedArgs = {
  id: Scalars['ID']['input'];
};


export type SubscriptionUserUpdatedArgs = {
  id: Scalars['ID']['input'];
};

export type UpdatePostInput = {
  content?: InputMaybe<Scalars['String']['input']>;
  excerpt?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateUserInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  role?: InputMaybe<Role>;
};

export type User = {
  __typename?: 'User';
  avatar?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isEmailVerified: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  posts: Array<Post>;
  role: Role;
  updatedAt: Scalars['DateTime']['output'];
};

export type UserConnection = {
  __typename?: 'UserConnection';
  edges: Array<UserEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type UserEdge = {
  __typename?: 'UserEdge';
  cursor: Scalars['String']['output'];
  node: User;
};

export type UserFilter = {
  isEmailVerified?: InputMaybe<Scalars['Boolean']['input']>;
  role?: InputMaybe<Role>;
  search?: InputMaybe<Scalars['String']['input']>;
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  AuthPayload: ResolverTypeWrapper<Omit<AuthPayload, 'user'> & { user: ResolversTypes['User'] }>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Comment: ResolverTypeWrapper<CommentModel>;
  CommentConnection: ResolverTypeWrapper<Omit<CommentConnection, 'edges'> & { edges: Array<ResolversTypes['CommentEdge']> }>;
  CommentEdge: ResolverTypeWrapper<Omit<CommentEdge, 'node'> & { node: ResolversTypes['Comment'] }>;
  CreatePostInput: CreatePostInput;
  CreateUserInput: CreateUserInput;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Mutation: ResolverTypeWrapper<{}>;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  Post: ResolverTypeWrapper<PostModel>;
  PostConnection: ResolverTypeWrapper<Omit<PostConnection, 'edges'> & { edges: Array<ResolversTypes['PostEdge']> }>;
  PostEdge: ResolverTypeWrapper<Omit<PostEdge, 'node'> & { node: ResolversTypes['Post'] }>;
  PostFilter: PostFilter;
  Query: ResolverTypeWrapper<{}>;
  Role: Role;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Subscription: ResolverTypeWrapper<{}>;
  UpdatePostInput: UpdatePostInput;
  UpdateUserInput: UpdateUserInput;
  Upload: ResolverTypeWrapper<Scalars['Upload']['output']>;
  User: ResolverTypeWrapper<UserModel>;
  UserConnection: ResolverTypeWrapper<Omit<UserConnection, 'edges'> & { edges: Array<ResolversTypes['UserEdge']> }>;
  UserEdge: ResolverTypeWrapper<Omit<UserEdge, 'node'> & { node: ResolversTypes['User'] }>;
  UserFilter: UserFilter;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  AuthPayload: Omit<AuthPayload, 'user'> & { user: ResolversParentTypes['User'] };
  Boolean: Scalars['Boolean']['output'];
  Comment: CommentModel;
  CommentConnection: Omit<CommentConnection, 'edges'> & { edges: Array<ResolversParentTypes['CommentEdge']> };
  CommentEdge: Omit<CommentEdge, 'node'> & { node: ResolversParentTypes['Comment'] };
  CreatePostInput: CreatePostInput;
  CreateUserInput: CreateUserInput;
  DateTime: Scalars['DateTime']['output'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  Mutation: {};
  PageInfo: PageInfo;
  Post: PostModel;
  PostConnection: Omit<PostConnection, 'edges'> & { edges: Array<ResolversParentTypes['PostEdge']> };
  PostEdge: Omit<PostEdge, 'node'> & { node: ResolversParentTypes['Post'] };
  PostFilter: PostFilter;
  Query: {};
  String: Scalars['String']['output'];
  Subscription: {};
  UpdatePostInput: UpdatePostInput;
  UpdateUserInput: UpdateUserInput;
  Upload: Scalars['Upload']['output'];
  User: UserModel;
  UserConnection: Omit<UserConnection, 'edges'> & { edges: Array<ResolversParentTypes['UserEdge']> };
  UserEdge: Omit<UserEdge, 'node'> & { node: ResolversParentTypes['User'] };
  UserFilter: UserFilter;
}>;

export type AuthDirectiveArgs = {
  requires?: Maybe<Role>;
};

export type AuthDirectiveResolver<Result, Parent, ContextType = Context, Args = AuthDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type RateLimitDirectiveArgs = {
  max: Scalars['Int']['input'];
  window: Scalars['String']['input'];
};

export type RateLimitDirectiveResolver<Result, Parent, ContextType = Context, Args = RateLimitDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type AuthPayloadResolvers<ContextType = Context, ParentType extends ResolversParentTypes['AuthPayload'] = ResolversParentTypes['AuthPayload']> = ResolversObject<{
  accessToken?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  refreshToken?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  user?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CommentResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Comment'] = ResolversParentTypes['Comment']> = ResolversObject<{
  author?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  post?: Resolver<ResolversTypes['Post'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CommentConnectionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['CommentConnection'] = ResolversParentTypes['CommentConnection']> = ResolversObject<{
  edges?: Resolver<Array<ResolversTypes['CommentEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CommentEdgeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['CommentEdge'] = ResolversParentTypes['CommentEdge']> = ResolversObject<{
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Comment'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type MutationResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  _empty?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  changePassword?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationChangePasswordArgs, 'currentPassword' | 'newPassword'>>;
  createComment?: Resolver<ResolversTypes['Comment'], ParentType, ContextType, RequireFields<MutationCreateCommentArgs, 'content' | 'postId'>>;
  createPost?: Resolver<ResolversTypes['Post'], ParentType, ContextType, RequireFields<MutationCreatePostArgs, 'input'>>;
  createUser?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationCreateUserArgs, 'input'>>;
  deleteComment?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteCommentArgs, 'id'>>;
  deletePost?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeletePostArgs, 'id'>>;
  deleteUser?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteUserArgs, 'id'>>;
  forgotPassword?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationForgotPasswordArgs, 'email'>>;
  likePost?: Resolver<ResolversTypes['Post'], ParentType, ContextType, RequireFields<MutationLikePostArgs, 'id'>>;
  login?: Resolver<ResolversTypes['AuthPayload'], ParentType, ContextType, RequireFields<MutationLoginArgs, 'email' | 'password'>>;
  logout?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  publishPost?: Resolver<ResolversTypes['Post'], ParentType, ContextType, RequireFields<MutationPublishPostArgs, 'id'>>;
  refreshToken?: Resolver<ResolversTypes['AuthPayload'], ParentType, ContextType, RequireFields<MutationRefreshTokenArgs, 'token'>>;
  resetPassword?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationResetPasswordArgs, 'newPassword' | 'token'>>;
  unlikePost?: Resolver<ResolversTypes['Post'], ParentType, ContextType, RequireFields<MutationUnlikePostArgs, 'id'>>;
  unpublishPost?: Resolver<ResolversTypes['Post'], ParentType, ContextType, RequireFields<MutationUnpublishPostArgs, 'id'>>;
  updateComment?: Resolver<ResolversTypes['Comment'], ParentType, ContextType, RequireFields<MutationUpdateCommentArgs, 'content' | 'id'>>;
  updatePost?: Resolver<ResolversTypes['Post'], ParentType, ContextType, RequireFields<MutationUpdatePostArgs, 'id' | 'input'>>;
  updateUser?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationUpdateUserArgs, 'id' | 'input'>>;
  uploadAvatar?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationUploadAvatarArgs, 'file'>>;
}>;

export type PageInfoResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PageInfo'] = ResolversParentTypes['PageInfo']> = ResolversObject<{
  endCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasNextPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  hasPreviousPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  startCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type PostResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Post'] = ResolversParentTypes['Post']> = ResolversObject<{
  author?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
  comments?: Resolver<Array<ResolversTypes['Comment']>, ParentType, ContextType>;
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  excerpt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  likes?: Resolver<Array<ResolversTypes['User']>, ParentType, ContextType>;
  likesCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  published?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  publishedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  tags?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type PostConnectionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PostConnection'] = ResolversParentTypes['PostConnection']> = ResolversObject<{
  edges?: Resolver<Array<ResolversTypes['PostEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type PostEdgeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PostEdge'] = ResolversParentTypes['PostEdge']> = ResolversObject<{
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Post'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  _empty?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  comment?: Resolver<Maybe<ResolversTypes['Comment']>, ParentType, ContextType, RequireFields<QueryCommentArgs, 'id'>>;
  comments?: Resolver<ResolversTypes['CommentConnection'], ParentType, ContextType, RequireFields<QueryCommentsArgs, 'postId'>>;
  me?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  post?: Resolver<Maybe<ResolversTypes['Post']>, ParentType, ContextType, RequireFields<QueryPostArgs, 'id'>>;
  posts?: Resolver<ResolversTypes['PostConnection'], ParentType, ContextType, Partial<QueryPostsArgs>>;
  searchPosts?: Resolver<Array<ResolversTypes['Post']>, ParentType, ContextType, RequireFields<QuerySearchPostsArgs, 'query'>>;
  user?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType, RequireFields<QueryUserArgs, 'id'>>;
  users?: Resolver<ResolversTypes['UserConnection'], ParentType, ContextType, Partial<QueryUsersArgs>>;
}>;

export type SubscriptionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription']> = ResolversObject<{
  _empty?: SubscriptionResolver<Maybe<ResolversTypes['String']>, "_empty", ParentType, ContextType>;
  commentCreated?: SubscriptionResolver<ResolversTypes['Comment'], "commentCreated", ParentType, ContextType, RequireFields<SubscriptionCommentCreatedArgs, 'postId'>>;
  postCreated?: SubscriptionResolver<ResolversTypes['Post'], "postCreated", ParentType, ContextType>;
  postLiked?: SubscriptionResolver<ResolversTypes['Post'], "postLiked", ParentType, ContextType, RequireFields<SubscriptionPostLikedArgs, 'id'>>;
  postUpdated?: SubscriptionResolver<ResolversTypes['Post'], "postUpdated", ParentType, ContextType, RequireFields<SubscriptionPostUpdatedArgs, 'id'>>;
  userCreated?: SubscriptionResolver<ResolversTypes['User'], "userCreated", ParentType, ContextType>;
  userUpdated?: SubscriptionResolver<ResolversTypes['User'], "userUpdated", ParentType, ContextType, RequireFields<SubscriptionUserUpdatedArgs, 'id'>>;
}>;

export interface UploadScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Upload'], any> {
  name: 'Upload';
}

export type UserResolvers<ContextType = Context, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = ResolversObject<{
  avatar?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isEmailVerified?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  posts?: Resolver<Array<ResolversTypes['Post']>, ParentType, ContextType>;
  role?: Resolver<ResolversTypes['Role'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type UserConnectionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['UserConnection'] = ResolversParentTypes['UserConnection']> = ResolversObject<{
  edges?: Resolver<Array<ResolversTypes['UserEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type UserEdgeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['UserEdge'] = ResolversParentTypes['UserEdge']> = ResolversObject<{
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type Resolvers<ContextType = Context> = ResolversObject<{
  AuthPayload?: AuthPayloadResolvers<ContextType>;
  Comment?: CommentResolvers<ContextType>;
  CommentConnection?: CommentConnectionResolvers<ContextType>;
  CommentEdge?: CommentEdgeResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  Mutation?: MutationResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Post?: PostResolvers<ContextType>;
  PostConnection?: PostConnectionResolvers<ContextType>;
  PostEdge?: PostEdgeResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  Upload?: GraphQLScalarType;
  User?: UserResolvers<ContextType>;
  UserConnection?: UserConnectionResolvers<ContextType>;
  UserEdge?: UserEdgeResolvers<ContextType>;
}>;

export type DirectiveResolvers<ContextType = Context> = ResolversObject<{
  auth?: AuthDirectiveResolver<any, any, ContextType>;
  rateLimit?: RateLimitDirectiveResolver<any, any, ContextType>;
}>;
`,

    'src/permissions.ts': `import { shield, rule, allow, deny } from 'graphql-shield';
import { GraphQLError } from 'graphql';
import type { Context } from './context';

// Define rules
const isAuthenticated = rule({ cache: 'contextual' })(
  async (_parent, _args, ctx: Context) => {
    return ctx.user !== null;
  }
);

const isAdmin = rule({ cache: 'contextual' })(
  async (_parent, _args, ctx: Context) => {
    return ctx.user?.role === 'ADMIN';
  }
);

// Define permissions
export const permissions = shield({
  Query: {
    '*': allow,
    users: isAuthenticated,
    user: isAuthenticated,
    me: isAuthenticated},
  Mutation: {
    '*': deny,
    createUser: allow,
    login: allow,
    refreshToken: allow,
    forgotPassword: allow,
    resetPassword: allow,
    updateUser: isAuthenticated,
    deleteUser: isAdmin,
    logout: isAuthenticated,
    changePassword: isAuthenticated,
    uploadAvatar: isAuthenticated,
    createPost: isAuthenticated,
    updatePost: isAuthenticated,
    deletePost: isAuthenticated,
    publishPost: isAuthenticated,
    unpublishPost: isAuthenticated,
    likePost: isAuthenticated,
    unlikePost: isAuthenticated,
    createComment: isAuthenticated,
    updateComment: isAuthenticated,
    deleteComment: isAuthenticated},
  Subscription: {
    userCreated: isAdmin,
    userUpdated: isAuthenticated,
    postCreated: allow,
    postUpdated: allow,
    postLiked: allow,
    commentCreated: allow}}, {
  fallbackError: new GraphQLError('Not authorized', {
    extensions: { code: 'FORBIDDEN' }}),
  allowExternalErrors: true});
`
  }};