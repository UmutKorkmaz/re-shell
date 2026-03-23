import { BackendTemplate } from '../types';

export const apolloServerTemplate: BackendTemplate = {
  id: 'apollo-server',
  name: 'Apollo Server',
  description: 'Community-driven, open-source GraphQL server with TypeScript, subscriptions, and caching',
  displayName: 'Apollo Server',
  framework: 'apollo',
  version: '4.10.0',
  tags: ['graphql', 'apollo', 'typescript', 'subscriptions'],
  port: 4000,
  language: 'typescript',
  features: [
    'graphql',
    'websockets',
    'file-upload',
    'caching',
    'testing'
  ],
  dependencies: {},
  files: {
    'src/index.ts': `import 'dotenv/config';
import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { createContext } from './context';
import { plugins } from './plugins';
import { dataSources } from './datasources';
import { logger } from './utils/logger';
import { setupRedis } from './utils/redis';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.js';

async function startApolloServer() {
  const app = express();
  const httpServer = createServer(app);

  // Initialize Redis
  const redis = await setupRedis();

  // Create GraphQL schema
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // Create WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql'});

  // Set up WebSocket server
  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx, msg, args) => {
        return createContext({ req: ctx.extra.request, redis });
      }},
    wsServer
  );

  // Create Apollo Server
  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            }};
        }},
      ...plugins],
    formatError: (err) => {
      logger.error('GraphQL Error:', err);
      
      // Remove stack trace in production
      if (process.env.NODE_ENV === 'production') {
        delete err.extensions?.exception?.stacktrace;
      }
      
      return err;
    }});

  await server.start();

  // Apply middleware
  app.use(
    '/graphql',
    cors<cors.CorsRequest>(),
    bodyParser.json({ limit: '50mb' }),
    graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
    expressMiddleware(server, {
      context: async ({ req }) => createContext({ req, redis, dataSources })})
  );

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const PORT = process.env.PORT || 4000;

  httpServer.listen(PORT, () => {
    logger.info(\`🚀 Server ready at http://localhost:\${PORT}/graphql\`);
    logger.info(\`🚀 Subscriptions ready at ws://localhost:\${PORT}/graphql\`);
  });
}

startApolloServer().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});`,

    'src/schema/index.ts': `import { gql } from 'graphql-tag';
import { userTypeDefs } from './user';
import { postTypeDefs } from './post';
import { fileTypeDefs } from './file';

const baseTypeDefs = gql\`
  type Query {
    _empty: String
  }

  type Mutation {
    _empty: String
  }

  type Subscription {
    _empty: String
  }

  enum CacheControlScope {
    PUBLIC
    PRIVATE
  }

  directive @cacheControl(
    maxAge: Int
    scope: CacheControlScope
    inheritMaxAge: Boolean
  ) on FIELD_DEFINITION | OBJECT | INTERFACE | UNION

  directive @rateLimit(
    window: String!
    max: Int!
  ) on FIELD_DEFINITION

  directive @auth(
    requires: Role = USER
  ) on FIELD_DEFINITION

  enum Role {
    ADMIN
    USER
    GUEST
  }
\`;

export const typeDefs = [
  baseTypeDefs,
  userTypeDefs,
  postTypeDefs,
  fileTypeDefs];`,

    'src/schema/user.ts': `import { gql } from 'graphql-tag';

export const userTypeDefs = gql\`
  extend type Query {
    me: User @auth
    user(id: ID!): User @cacheControl(maxAge: 60)
    users(limit: Int = 10, offset: Int = 0): UserConnection!
  }

  extend type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    updateProfile(input: UpdateProfileInput!): User! @auth
    changePassword(input: ChangePasswordInput!): User! @auth
  }

  extend type Subscription {
    userStatusChanged(userId: ID!): UserStatus!
  }

  type User {
    id: ID!
    username: String!
    email: String!
    profile: UserProfile
    posts: [Post!]!
    createdAt: String!
    updatedAt: String!
  }

  type UserProfile {
    bio: String
    avatar: String
    location: String
    website: String
  }

  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type UserEdge {
    node: User!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type UserStatus {
    userId: ID!
    status: String!
    lastSeen: String!
  }

  input RegisterInput {
    username: String!
    email: String!
    password: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input UpdateProfileInput {
    bio: String
    avatar: String
    location: String
    website: String
  }

  input ChangePasswordInput {
    currentPassword: String!
    newPassword: String!
  }
\`;`,

    'src/schema/post.ts': `import { gql } from 'graphql-tag';

export const postTypeDefs = gql\`
  extend type Query {
    post(id: ID!): Post @cacheControl(maxAge: 300)
    posts(
      limit: Int = 20
      offset: Int = 0
      orderBy: PostOrderBy = CREATED_AT_DESC
    ): PostConnection! @rateLimit(window: "1m", max: 100)
    searchPosts(query: String!): [Post!]!
  }

  extend type Mutation {
    createPost(input: CreatePostInput!): Post! @auth
    updatePost(id: ID!, input: UpdatePostInput!): Post! @auth
    deletePost(id: ID!): Boolean! @auth
    likePost(id: ID!): Post! @auth @rateLimit(window: "1m", max: 30)
  }

  extend type Subscription {
    postAdded: Post!
    postUpdated(id: ID!): Post!
    postLiked(id: ID!): PostLikeEvent!
  }

  type Post {
    id: ID!
    title: String!
    content: String!
    excerpt: String!
    author: User!
    tags: [String!]!
    likes: Int!
    likedBy: [User!]!
    comments: [Comment!]!
    createdAt: String!
    updatedAt: String!
  }

  type Comment {
    id: ID!
    content: String!
    author: User!
    post: Post!
    createdAt: String!
  }

  type PostConnection {
    edges: [PostEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type PostEdge {
    node: Post!
    cursor: String!
  }

  type PostLikeEvent {
    post: Post!
    user: User!
    totalLikes: Int!
  }

  enum PostOrderBy {
    CREATED_AT_ASC
    CREATED_AT_DESC
    LIKES_ASC
    LIKES_DESC
  }

  input CreatePostInput {
    title: String!
    content: String!
    tags: [String!]
  }

  input UpdatePostInput {
    title: String
    content: String
    tags: [String!]
  }
\`;`,

    'src/schema/file.ts': `import { gql } from 'graphql-tag';

export const fileTypeDefs = gql\`
  scalar Upload

  extend type Mutation {
    uploadFile(file: Upload!): File! @auth
    uploadFiles(files: [Upload!]!): [File!]! @auth
    deleteFile(id: ID!): Boolean! @auth
  }

  type File {
    id: ID!
    filename: String!
    mimetype: String!
    encoding: String!
    url: String!
    size: Int!
    uploadedBy: User!
    createdAt: String!
  }
\`;`,

    'src/resolvers/index.ts': `import { userResolvers } from './user';
import { postResolvers } from './post';
import { fileResolvers } from './file';
import { GraphQLUpload } from 'graphql-upload/GraphQLUpload.js';

export const resolvers = {
  Upload: GraphQLUpload,
  Query: {
    ...userResolvers.Query,
    ...postResolvers.Query},
  Mutation: {
    ...userResolvers.Mutation,
    ...postResolvers.Mutation,
    ...fileResolvers.Mutation},
  Subscription: {
    ...userResolvers.Subscription,
    ...postResolvers.Subscription},
  User: userResolvers.User,
  Post: postResolvers.Post};`,

    'src/resolvers/user.ts': `import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { GraphQLError } from 'graphql';
import { withFilter } from 'graphql-subscriptions';
import { pubsub } from '../utils/pubsub';

const USER_STATUS_CHANGED = 'USER_STATUS_CHANGED';

export const userResolvers = {
  Query: {
    me: async (_: any, __: any, { user, dataSources }: any) => {
      if (!user) throw new GraphQLError('Not authenticated');
      return dataSources.userAPI.findById(user.id);
    },

    user: async (_: any, { id }: any, { dataSources }: any) => {
      return dataSources.userAPI.findById(id);
    },

    users: async (_: any, { limit, offset }: any, { dataSources }: any) => {
      return dataSources.userAPI.findAll({ limit, offset });
    }},

  Mutation: {
    register: async (_: any, { input }: any, { dataSources }: any) => {
      const existingUser = await dataSources.userAPI.findByEmail(input.email);
      if (existingUser) {
        throw new GraphQLError('User already exists');
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);
      const user = await dataSources.userAPI.create({
        ...input,
        password: hashedPassword});

      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      return { token, user };
    },

    login: async (_: any, { input }: any, { dataSources }: any) => {
      const user = await dataSources.userAPI.findByEmail(input.email);
      if (!user) {
        throw new GraphQLError('Invalid credentials');
      }

      const valid = await bcrypt.compare(input.password, user.password);
      if (!valid) {
        throw new GraphQLError('Invalid credentials');
      }

      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      // Publish status change
      pubsub.publish(USER_STATUS_CHANGED, {
        userStatusChanged: {
          userId: user.id,
          status: 'online',
          lastSeen: new Date().toISOString()}});

      return { token, user };
    },

    updateProfile: async (_: any, { input }: any, { user, dataSources }: any) => {
      if (!user) throw new GraphQLError('Not authenticated');
      
      return dataSources.userAPI.updateProfile(user.id, input);
    },

    changePassword: async (_: any, { input }: any, { user, dataSources }: any) => {
      if (!user) throw new GraphQLError('Not authenticated');
      
      const currentUser = await dataSources.userAPI.findById(user.id);
      const valid = await bcrypt.compare(input.currentPassword, currentUser.password);
      
      if (!valid) {
        throw new GraphQLError('Current password is incorrect');
      }

      const hashedPassword = await bcrypt.hash(input.newPassword, 10);
      return dataSources.userAPI.update(user.id, { password: hashedPassword });
    }},

  Subscription: {
    userStatusChanged: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([USER_STATUS_CHANGED]),
        (payload, variables) => {
          return payload.userStatusChanged.userId === variables.userId;
        }
      )}},

  User: {
    posts: async (parent: any, _: any, { loaders }: any) => {
      return loaders.postsByUserLoader.load(parent.id);
    }}};`,

    'src/resolvers/post.ts': `import { GraphQLError } from 'graphql';
import { withFilter } from 'graphql-subscriptions';
import { pubsub } from '../utils/pubsub';

const POST_ADDED = 'POST_ADDED';
const POST_UPDATED = 'POST_UPDATED';
const POST_LIKED = 'POST_LIKED';

export const postResolvers = {
  Query: {
    post: async (_: any, { id }: any, { dataSources }: any) => {
      return dataSources.postAPI.findById(id);
    },

    posts: async (_: any, { limit, offset, orderBy }: any, { dataSources }: any) => {
      return dataSources.postAPI.findAll({ limit, offset, orderBy });
    },

    searchPosts: async (_: any, { query }: any, { dataSources }: any) => {
      return dataSources.postAPI.search(query);
    }},

  Mutation: {
    createPost: async (_: any, { input }: any, { user, dataSources }: any) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const post = await dataSources.postAPI.create({
        ...input,
        authorId: user.id});

      // Publish to subscribers
      pubsub.publish(POST_ADDED, { postAdded: post });

      return post;
    },

    updatePost: async (_: any, { id, input }: any, { user, dataSources }: any) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const post = await dataSources.postAPI.findById(id);
      if (!post) throw new GraphQLError('Post not found');
      
      if (post.authorId !== user.id) {
        throw new GraphQLError('Not authorized to update this post');
      }

      const updatedPost = await dataSources.postAPI.update(id, input);
      
      // Publish to subscribers
      pubsub.publish(POST_UPDATED, { postUpdated: updatedPost });

      return updatedPost;
    },

    deletePost: async (_: any, { id }: any, { user, dataSources }: any) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const post = await dataSources.postAPI.findById(id);
      if (!post) throw new GraphQLError('Post not found');
      
      if (post.authorId !== user.id) {
        throw new GraphQLError('Not authorized to delete this post');
      }

      return dataSources.postAPI.delete(id);
    },

    likePost: async (_: any, { id }: any, { user, dataSources }: any) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const post = await dataSources.postAPI.like(id, user.id);
      
      // Publish to subscribers
      pubsub.publish(POST_LIKED, {
        postLiked: {
          post,
          user,
          totalLikes: post.likes}});

      return post;
    }},

  Subscription: {
    postAdded: {
      subscribe: () => pubsub.asyncIterator([POST_ADDED])},

    postUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([POST_UPDATED]),
        (payload, variables) => {
          return payload.postUpdated.id === variables.id;
        }
      )},

    postLiked: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([POST_LIKED]),
        (payload, variables) => {
          return payload.postLiked.post.id === variables.id;
        }
      )}},

  Post: {
    author: async (parent: any, _: any, { loaders }: any) => {
      return loaders.userLoader.load(parent.authorId);
    },

    likedBy: async (parent: any, _: any, { loaders }: any) => {
      return loaders.likedByLoader.load(parent.id);
    },

    comments: async (parent: any, _: any, { loaders }: any) => {
      return loaders.commentsByPostLoader.load(parent.id);
    },

    excerpt: (parent: any) => {
      return parent.content.substring(0, 150) + '...';
    }}};`,

    'src/resolvers/file.ts': `import { GraphQLError } from 'graphql';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(console.error);

export const fileResolvers = {
  Mutation: {
    uploadFile: async (_: any, { file }: any, { user, dataSources }: any) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const { createReadStream, filename, mimetype, encoding } = await file;

      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
      if (!allowedMimeTypes.includes(mimetype)) {
        throw new GraphQLError('File type not allowed');
      }

      // Generate unique filename
      const fileId = uuidv4();
      const ext = path.extname(filename);
      const newFilename = \`\${fileId}\${ext}\`;
      const filePath = path.join(UPLOAD_DIR, newFilename);

      // Save file
      const stream = createReadStream();
      const writeStream = await fs.open(filePath, 'w');
      
      let size = 0;
      for await (const chunk of stream) {
        size += chunk.length;
        
        // Limit file size to 10MB
        if (size > 10 * 1024 * 1024) {
          await writeStream.close();
          await fs.unlink(filePath);
          throw new GraphQLError('File too large');
        }
        
        await writeStream.write(chunk);
      }
      
      await writeStream.close();

      // Save file metadata to database
      const fileRecord = await dataSources.fileAPI.create({
        id: fileId,
        filename,
        mimetype,
        encoding,
        size,
        url: \`/uploads/\${newFilename}\`,
        uploadedById: user.id});

      return fileRecord;
    },

    uploadFiles: async (_: any, { files }: any, { user, dataSources }: any) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const uploadPromises = files.map(async (file: any) => {
        return fileResolvers.Mutation.uploadFile(_, { file }, { user, dataSources });
      });

      return Promise.all(uploadPromises);
    },

    deleteFile: async (_: any, { id }: any, { user, dataSources }: any) => {
      if (!user) throw new GraphQLError('Not authenticated');

      const file = await dataSources.fileAPI.findById(id);
      if (!file) throw new GraphQLError('File not found');

      if (file.uploadedById !== user.id) {
        throw new GraphQLError('Not authorized to delete this file');
      }

      // Delete physical file
      const filePath = path.join(process.cwd(), file.url);
      await fs.unlink(filePath).catch(() => {}); // Ignore if file doesn't exist

      // Delete from database
      return dataSources.fileAPI.delete(id);
    }}};`,

    'src/context.ts': `import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { createLoaders } from './loaders';

interface Context {
  user?: any;
  loaders: any;
  redis: any;
  dataSources?: any;
}

export async function createContext({
  req,
  redis,
  dataSources}: {
  req: Request;
  redis: any;
  dataSources?: any;
}): Promise<Context> {
  // Get the user token from headers
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  let user = null;
  if (token) {
    try {
      user = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (err) {
      // Invalid token
    }
  }

  // Create DataLoader instances for this request
  const loaders = createLoaders();

  return {
    user,
    loaders,
    redis,
    dataSources};
}`,

    'src/loaders/index.ts': `import DataLoader from 'dataloader';
import { UserAPI } from '../datasources/UserAPI';
import { PostAPI } from '../datasources/PostAPI';

export function createLoaders() {
  const userAPI = new UserAPI();
  const postAPI = new PostAPI();

  return {
    userLoader: new DataLoader<string, any>(async (userIds) => {
      const users = await userAPI.findByIds(userIds as string[]);
      const userMap = new Map(users.map((user: any) => [user.id, user]));
      return userIds.map((id) => userMap.get(id));
    }),

    postsByUserLoader: new DataLoader<string, any>(async (userIds) => {
      const posts = await postAPI.findByUserIds(userIds as string[]);
      const postsMap = new Map<string, any[]>();
      
      posts.forEach((post: any) => {
        if (!postsMap.has(post.authorId)) {
          postsMap.set(post.authorId, []);
        }
        postsMap.get(post.authorId)!.push(post);
      });

      return userIds.map((id) => postsMap.get(id) || []);
    }),

    commentsByPostLoader: new DataLoader<string, any>(async (postIds) => {
      // Simulate fetching comments
      return postIds.map(() => []);
    }),

    likedByLoader: new DataLoader<string, any>(async (postIds) => {
      // Simulate fetching users who liked posts
      return postIds.map(() => []);
    })};
}`,

    'src/datasources/index.ts': `import { UserAPI } from './UserAPI';
import { PostAPI } from './PostAPI';
import { FileAPI } from './FileAPI';

export const dataSources = () => ({
  userAPI: new UserAPI(),
  postAPI: new PostAPI(),
  fileAPI: new FileAPI()});`,

    'src/datasources/UserAPI.ts': `import { RESTDataSource } from '@apollo/datasource-rest';

// This is a mock implementation. Replace with actual database queries.
export class UserAPI extends RESTDataSource {
  private users = new Map();

  async findById(id: string) {
    return this.users.get(id);
  }

  async findByIds(ids: string[]) {
    return ids.map(id => this.users.get(id)).filter(Boolean);
  }

  async findByEmail(email: string) {
    return Array.from(this.users.values()).find((user: any) => user.email === email);
  }

  async findAll({ limit = 10, offset = 0 }) {
    const allUsers = Array.from(this.users.values());
    const edges = allUsers.slice(offset, offset + limit).map((user: any) => ({
      node: user,
      cursor: Buffer.from(user.id).toString('base64')}));

    return {
      edges,
      pageInfo: {
        hasNextPage: offset + limit < allUsers.length,
        hasPreviousPage: offset > 0,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor},
      totalCount: allUsers.length};
  }

  async create(input: any) {
    const user = {
      id: Date.now().toString(),
      ...input,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()};
    this.users.set(user.id, user);
    return user;
  }

  async update(id: string, input: any) {
    const user = this.users.get(id);
    if (!user) throw new Error('User not found');
    
    const updated = {
      ...user,
      ...input,
      updatedAt: new Date().toISOString()};
    this.users.set(id, updated);
    return updated;
  }

  async updateProfile(id: string, input: any) {
    const user = this.users.get(id);
    if (!user) throw new Error('User not found');
    
    user.profile = { ...user.profile, ...input };
    user.updatedAt = new Date().toISOString();
    return user;
  }
}`,

    'src/datasources/PostAPI.ts': `import { RESTDataSource } from '@apollo/datasource-rest';

export class PostAPI extends RESTDataSource {
  private posts = new Map();
  private likes = new Map(); // postId -> Set of userIds

  async findById(id: string) {
    return this.posts.get(id);
  }

  async findByUserIds(userIds: string[]) {
    return Array.from(this.posts.values()).filter((post: any) => 
      userIds.includes(post.authorId)
    );
  }

  async findAll({ limit = 20, offset = 0, orderBy = 'CREATED_AT_DESC' }) {
    let allPosts = Array.from(this.posts.values());
    
    // Sort posts
    allPosts.sort((a: any, b: any) => {
      switch (orderBy) {
        case 'CREATED_AT_ASC':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'CREATED_AT_DESC':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'LIKES_ASC':
          return a.likes - b.likes;
        case 'LIKES_DESC':
          return b.likes - a.likes;
        default:
          return 0;
      }
    });

    const edges = allPosts.slice(offset, offset + limit).map((post: any) => ({
      node: post,
      cursor: Buffer.from(post.id).toString('base64')}));

    return {
      edges,
      pageInfo: {
        hasNextPage: offset + limit < allPosts.length,
        hasPreviousPage: offset > 0,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor},
      totalCount: allPosts.length};
  }

  async search(query: string) {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.posts.values()).filter((post: any) =>
      post.title.toLowerCase().includes(lowercaseQuery) ||
      post.content.toLowerCase().includes(lowercaseQuery)
    );
  }

  async create(input: any) {
    const post = {
      id: Date.now().toString(),
      ...input,
      likes: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()};
    this.posts.set(post.id, post);
    return post;
  }

  async update(id: string, input: any) {
    const post = this.posts.get(id);
    if (!post) throw new Error('Post not found');
    
    const updated = {
      ...post,
      ...input,
      updatedAt: new Date().toISOString()};
    this.posts.set(id, updated);
    return updated;
  }

  async delete(id: string) {
    return this.posts.delete(id);
  }

  async like(postId: string, userId: string) {
    const post = this.posts.get(postId);
    if (!post) throw new Error('Post not found');

    if (!this.likes.has(postId)) {
      this.likes.set(postId, new Set());
    }

    const postLikes = this.likes.get(postId)!;
    if (postLikes.has(userId)) {
      postLikes.delete(userId);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      postLikes.add(userId);
      post.likes += 1;
    }

    return post;
  }
}`,

    'src/datasources/FileAPI.ts': `import { RESTDataSource } from '@apollo/datasource-rest';

export class FileAPI extends RESTDataSource {
  private files = new Map();

  async findById(id: string) {
    return this.files.get(id);
  }

  async create(input: any) {
    const file = {
      ...input,
      createdAt: new Date().toISOString()};
    this.files.set(file.id, file);
    return file;
  }

  async delete(id: string) {
    return this.files.delete(id);
  }
}`,

    'src/plugins/index.ts': `import responseCachePlugin from '@apollo/server-plugin-response-cache';
import { ApolloServerPluginLandingPageGraphQLPlayground } from '@apollo/server-plugin-landing-page-graphql-playground';
import { rateLimitPlugin } from './rateLimit';
import { depthLimitPlugin } from './depthLimit';
import { costAnalysisPlugin } from './costAnalysis';
import { loggingPlugin } from './logging';

export const plugins = [
  responseCachePlugin({
    sessionId: ({ request }) => 
      request.http?.headers.get('authorization') || 'anonymous'}),
  process.env.NODE_ENV !== 'production' && 
    ApolloServerPluginLandingPageGraphQLPlayground(),
  rateLimitPlugin(),
  depthLimitPlugin(5),
  costAnalysisPlugin({ maximumCost: 1000 }),
  loggingPlugin()].filter(Boolean);`,

    'src/plugins/rateLimit.ts': `import { GraphQLError } from 'graphql';
import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';

export function rateLimitPlugin() {
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  return {
    async requestDidStart() {
      return {
        async willSendResponse() {
          // Clean up old entries periodically
          const now = Date.now();
          for (const [key, value] of rateLimitMap.entries()) {
            if (value.resetTime < now) {
              rateLimitMap.delete(key);
            }
          }
        }};
    }};
}

export function rateLimitDirectiveTransformer(schema: any) {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const rateLimitDirective = getDirective(schema, fieldConfig, 'rateLimit')?.[0];

      if (rateLimitDirective) {
        const { window, max } = rateLimitDirective;
        const originalResolve = fieldConfig.resolve || defaultFieldResolver;

        fieldConfig.resolve = async function (source, args, context, info) {
          const key = \`\${context.user?.id || context.ip}:\${info.fieldName}\`;
          
          // Parse window (e.g., "1m" -> 60000ms)
          const windowMs = parseWindow(window);
          
          const now = Date.now();
          const limit = rateLimitMap.get(key);

          if (!limit || limit.resetTime < now) {
            rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
          } else if (limit.count >= max) {
            throw new GraphQLError(\`Rate limit exceeded. Try again in \${Math.ceil((limit.resetTime - now) / 1000)} seconds.\`);
          } else {
            limit.count++;
          }

          return originalResolve(source, args, context, info);
        };
      }

      return fieldConfig;
    }});
}

function parseWindow(window: string): number {
  const unit = window.slice(-1);
  const value = parseInt(window.slice(0, -1));

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    default: throw new Error(\`Invalid window format: \${window}\`);
  }
}`,

    'src/plugins/depthLimit.ts': `import depthLimit from 'graphql-depth-limit';

export function depthLimitPlugin(maxDepth: number) {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation(requestContext: any) {
          const errors = depthLimit(maxDepth)(requestContext.document);
          if (errors) {
            throw errors;
          }
        }};
    }};
}`,

    'src/plugins/costAnalysis.ts': `import costAnalysis from 'graphql-cost-analysis';

export function costAnalysisPlugin(options: any) {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation(requestContext: any) {
          const cost = costAnalysis({
            ...options,
            query: requestContext.request.query,
            variables: requestContext.request.variables});

          if (cost > options.maximumCost) {
            throw new Error(\`Query cost \${cost} exceeds maximum cost \${options.maximumCost}\`);
          }
        }};
    }};
}`,

    'src/plugins/logging.ts': `import { logger } from '../utils/logger';

export function loggingPlugin() {
  return {
    async requestDidStart() {
      const start = Date.now();

      return {
        async willSendResponse(requestContext: any) {
          const duration = Date.now() - start;
          const { request, response } = requestContext;

          logger.info('GraphQL Request', {
            query: request.query,
            variables: request.variables,
            duration: \`\${duration}ms\`,
            errors: response.body.singleResult.errors});
        },

        async didEncounterErrors(requestContext: any) {
          logger.error('GraphQL Errors', {
            errors: requestContext.errors});
        }};
    }};
}`,

    'src/utils/logger.ts': `import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )}),
    new winston.transports.File({ 
      filename: 'error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'combined.log' 
    })]});`,

    'src/utils/pubsub.ts': `import { PubSub } from 'graphql-subscriptions';

// In production, use Redis PubSub for scalability
export const pubsub = new PubSub();`,

    'src/utils/redis.ts': `import Redis from 'ioredis';
import { logger } from './logger';

export async function setupRedis() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }});

  redis.on('connect', () => {
    logger.info('Connected to Redis');
  });

  redis.on('error', (err) => {
    logger.error('Redis error:', err);
  });

  return redis;
}`,

    'src/directives/auth.ts': `import { GraphQLError } from 'graphql';
import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';

export function authDirectiveTransformer(schema: any) {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const authDirective = getDirective(schema, fieldConfig, 'auth')?.[0];

      if (authDirective) {
        const { requires } = authDirective;
        const originalResolve = fieldConfig.resolve || defaultFieldResolver;

        fieldConfig.resolve = async function (source, args, context, info) {
          if (!context.user) {
            throw new GraphQLError('Not authenticated', {
              extensions: { code: 'UNAUTHENTICATED' }});
          }

          if (requires && context.user.role !== requires && requires !== 'USER') {
            throw new GraphQLError('Not authorized', {
              extensions: { code: 'FORBIDDEN' }});
          }

          return originalResolve(source, args, context, info);
        };
      }

      return fieldConfig;
    }});
}`,

    'src/tests/server.test.ts': `import request from 'supertest';
import { ApolloServer } from '@apollo/server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from '../schema';
import { resolvers } from '../resolvers';

describe('Apollo Server', () => {
  let server: ApolloServer;

  beforeAll(async () => {
    const schema = makeExecutableSchema({ typeDefs, resolvers });
    server = new ApolloServer({ schema });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('Queries', () => {
    it('should execute a simple query', async () => {
      const query = \`
        query {
          __typename
        }
      \`;

      const result = await server.executeOperation({ query });
      expect(result.body.kind).toBe('single');
      expect(result.body.singleResult.errors).toBeUndefined();
    });
  });

  describe('Mutations', () => {
    it('should register a new user', async () => {
      const mutation = \`
        mutation RegisterUser($input: RegisterInput!) {
          register(input: $input) {
            token
            user {
              id
              username
              email
            }
          }
        }
      \`;

      const variables = {
        input: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123'}};

      const result = await server.executeOperation({ 
        query: mutation, 
        variables 
      });

      expect(result.body.kind).toBe('single');
      expect(result.body.singleResult.data?.register).toBeDefined();
      expect(result.body.singleResult.data?.register.token).toBeDefined();
      expect(result.body.singleResult.data?.register.user.email).toBe('test@example.com');
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      const query = \`
        query {
          me {
            id
            username
          }
        }
      \`;

      const result = await server.executeOperation({ query });
      expect(result.body.kind).toBe('single');
      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors?.[0].message).toBe('Not authenticated');
    });
  });
});`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=development
      - JWT_SECRET=your-secret-key
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - redis
      - postgres
    volumes:
      - ./uploads:/app/uploads
      - ./src:/app/src
      - ./package.json:/app/package.json

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=apollo
      - POSTGRES_PASSWORD=apollo
      - POSTGRES_DB=apollo_db
    volumes:
      - postgres-data:/var/lib/postgresql/data

  apollo-studio:
    image: apollographql/apollo-studio:latest
    ports:
      - "4001:4001"
    environment:
      - APOLLO_KEY=\${APOLLO_KEY}
      - APOLLO_GRAPH_REF=\${APOLLO_GRAPH_REF}

volumes:
  redis-data:
  postgres-data:`,

    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 4000

CMD ["node", "dist/index.js"]`,

    '.env.example': `NODE_ENV=development
PORT=4000

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Database Configuration
DATABASE_URL=postgresql://apollo:apollo@localhost:5432/apollo_db

# Apollo Studio (optional)
APOLLO_KEY=
APOLLO_GRAPH_REF=

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads`,

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
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "coverage"]
}`,

    'package.json': `{
  "name": "apollo-server-app",
  "version": "1.0.0",
  "description": "Apollo Server GraphQL API with TypeScript",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts",
    "generate": "graphql-codegen",
    "studio": "rover dev"
  },
  "keywords": ["apollo", "graphql", "typescript", "api"],
  "author": "",
  "license": "MIT"
}`,

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
    '!src/**/index.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']};`,

    'README.md': `# Apollo Server GraphQL API

A production-ready GraphQL API built with Apollo Server 4, TypeScript, and modern best practices.

## Features

- **Apollo Server 4** with Express integration
- **TypeScript** for type safety
- **GraphQL Subscriptions** with WebSockets
- **DataLoader** for N+1 query optimization
- **File Uploads** with graphql-upload
- **Redis Caching** for performance
- **Rate Limiting** per field
- **Authentication** with JWT
- **Error Handling** and logging
- **Testing** with Jest
- **Docker** support
- **Apollo Studio** integration

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Copy environment variables:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

3. Start Redis and PostgreSQL:
   \`\`\`bash
   docker-compose up -d redis postgres
   \`\`\`

4. Run in development mode:
   \`\`\`bash
   npm run dev
   \`\`\`

5. Open GraphQL Playground:
   http://localhost:4000/graphql

## GraphQL Schema

### Queries
- \`me\`: Get current user
- \`user(id: ID!)\`: Get user by ID
- \`users(limit: Int, offset: Int)\`: Get paginated users
- \`post(id: ID!)\`: Get post by ID
- \`posts(limit: Int, offset: Int, orderBy: PostOrderBy)\`: Get paginated posts
- \`searchPosts(query: String!)\`: Search posts

### Mutations
- \`register(input: RegisterInput!)\`: Register new user
- \`login(input: LoginInput!)\`: Login user
- \`createPost(input: CreatePostInput!)\`: Create new post
- \`updatePost(id: ID!, input: UpdatePostInput!)\`: Update post
- \`deletePost(id: ID!)\`: Delete post
- \`likePost(id: ID!)\`: Like/unlike post
- \`uploadFile(file: Upload!)\`: Upload single file
- \`uploadFiles(files: [Upload!]!)\`: Upload multiple files

### Subscriptions
- \`userStatusChanged(userId: ID!)\`: User status updates
- \`postAdded\`: New posts
- \`postUpdated(id: ID!)\`: Post updates
- \`postLiked(id: ID!)\`: Post likes

## Authentication

Include JWT token in Authorization header:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Rate Limiting

Fields can be rate limited using the \`@rateLimit\` directive:
\`\`\`graphql
posts(...): [Post!]! @rateLimit(window: "1m", max: 100)
\`\`\`

## Caching

Use the \`@cacheControl\` directive for caching:
\`\`\`graphql
user(id: ID!): User @cacheControl(maxAge: 60)
\`\`\`

## File Uploads

Upload files using the \`Upload\` scalar:
\`\`\`graphql
mutation UploadFile($file: Upload!) {
  uploadFile(file: $file) {
    id
    filename
    url
  }
}
\`\`\`

## Testing

Run tests:
\`\`\`bash
npm test
npm run test:coverage
\`\`\`

## Docker

Build and run with Docker:
\`\`\`bash
docker-compose up
\`\`\`

## Production

1. Build for production:
   \`\`\`bash
   npm run build
   \`\`\`

2. Set environment variables
3. Run with PM2 or similar process manager

## Apollo Studio

Connect to Apollo Studio for monitoring:
1. Set \`APOLLO_KEY\` and \`APOLLO_GRAPH_REF\` in environment
2. Access Studio at https://studio.apollographql.com
`
  }};