import { BackendTemplate } from '../types';

export const koaTemplate: BackendTemplate = {
  id: 'koa',
  name: 'koa',
  displayName: 'Koa.js',
  description: 'Next generation web framework for Node.js with async/await support and elegant middleware',
  language: 'typescript',
  framework: 'koa',
  version: '2.15.2',
  tags: ['nodejs', 'koa', 'api', 'rest', 'middleware', 'typescript'],
  port: 3000,
  dependencies: {},
  features: ['middleware', 'rest-api', 'routing', 'middleware', 'validation', 'authentication'],
  
  files: {
    // Package configuration
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "Koa.js API server with TypeScript and modern features",
  "main": "dist/index.js",
  "scripts": {
    "dev": "nodemon",
    "build": "tsc",
    "start": "node dist/index.js",
    "start:prod": "cross-env NODE_ENV=production node dist/index.js",
    "lint": "eslint src --ext .ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "migrate": "knex migrate:latest",
    "migrate:make": "knex migrate:make",
    "seed": "knex seed:run",
    "docker:build": "docker build -t {{projectName}} .",
    "docker:run": "docker run -p 3000:3000 {{projectName}}"
  },
  "dependencies": {
    "koa": "^2.15.2",
    "koa-router": "^12.0.1",
    "koa-bodyparser": "^4.4.1",
    "koa-cors": "^0.0.16",
    "koa-helmet": "^7.0.2",
    "koa-compress": "^5.1.1",
    "koa-static": "^5.0.0",
    "koa-mount": "^4.0.0",
    "koa-ratelimit": "^5.1.0",
    "koa-jwt": "^4.0.4",
    "koa-session": "^6.4.0",
    "koa-redis": "^4.0.1",
    "koa-logger": "^3.2.1",
    "koa-json": "^2.0.2",
    "koa-multer": "^1.0.2",
    "koa-passport": "^6.0.0",
    "koa-swagger-decorator": "^2.2.3",
    "koa-websocket": "^7.0.0",
    "@koa/cors": "^5.0.0",
    "@koa/router": "^12.0.1",
    "@koa/multer": "^3.0.2",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "class-validator": "^0.14.1",
    "class-transformer": "^0.5.1",
    "dotenv": "^16.4.5",
    "knex": "^3.1.0",
    "pg": "^8.11.5",
    "mysql2": "^3.9.7",
    "sqlite3": "^5.1.7",
    "objection": "^3.1.4",
    "caching": "^4.6.13",
    "ioredis": "^5.3.2",
    "winston": "^3.13.0",
    "winston-daily-rotate-file": "^5.0.0",
    "joi": "^17.12.3",
    "uuid": "^9.0.1",
    "dayjs": "^1.11.10",
    "lodash": "^4.17.21",
    "axios": "^1.6.8",
    "nodemailer": "^6.9.13",
    "socket.io": "^4.7.5",
    "bull": "^4.12.2",
    "node-cron": "^3.0.3",
    "reflect-metadata": "^0.2.2"
  },
  "devDependencies": {
    "@types/koa": "^2.15.0",
    "@types/koa-router": "^7.4.8",
    "@types/koa-bodyparser": "^4.3.12",
    "@types/koa-cors": "^0.0.6",
    "@types/koa-helmet": "^6.0.8",
    "@types/koa-compress": "^4.0.6",
    "@types/koa-static": "^4.0.4",
    "@types/koa-mount": "^4.0.5",
    "@types/koa-ratelimit": "^5.0.3",
    "@types/koa-jwt": "^3.3.2",
    "@types/koa-session": "^6.4.5",
    "@types/koa-redis": "^4.0.5",
    "@types/koa-logger": "^3.1.5",
    "@types/koa-json": "^2.0.23",
    "@types/koa-multer": "^1.0.4",
    "@types/koa-passport": "^6.0.3",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20.12.7",
    "@types/lodash": "^4.17.0",
    "@types/nodemailer": "^6.4.14",
    "@types/bull": "^4.10.0",
    "@types/node-cron": "^3.0.11",
    "@typescript-eslint/eslint-plugin": "^7.7.1",
    "@typescript-eslint/parser": "^7.7.1",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.2.5",
    "typescript": "^5.4.5",
    "nodemon": "^3.1.0",
    "ts-node": "^10.9.2",
    "cross-env": "^7.0.3",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "@types/jest": "^29.5.12",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2"
  },
  "nodemonConfig": {
    "watch": ["src"],
    "ext": "ts",
    "exec": "ts-node src/index.ts",
    "env": {
      "NODE_ENV": "development"
    }
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
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@config/*": ["src/config/*"],
      "@controllers/*": ["src/controllers/*"],
      "@middlewares/*": ["src/middlewares/*"],
      "@models/*": ["src/models/*"],
      "@routes/*": ["src/routes/*"],
      "@services/*": ["src/services/*"],
      "@utils/*": ["src/utils/*"],
      "@validators/*": ["src/validators/*"],
      "@types/*": ["src/types/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "coverage"]
}`,

    // Main application entry
    'src/index.ts': `import 'reflect-metadata';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import helmet from 'koa-helmet';
import compress from 'koa-compress';
import logger from 'koa-logger';
import json from 'koa-json';
import serve from 'koa-static';
import mount from 'koa-mount';
import ratelimit from 'koa-ratelimit';
import session from 'koa-session';
import redisStore from 'koa-redis';
import { Server } from 'socket.io';
import { createServer } from 'http';
import path from 'path';

import { config } from '@config/config';
import { connectDatabase } from '@config/database';
import { redis } from '@config/redis';
import { errorHandler } from '@middlewares/error.middleware';
import { requestLogger } from '@middlewares/logger.middleware';
import { responseTime } from '@middlewares/responseTime.middleware';
import { router } from '@routes/index';
import { initializeWebSocket } from '@config/websocket';
import { Logger } from '@utils/logger';
import { setupSwagger } from '@config/swagger';

const app = new Koa();
const server = createServer(app.callback());
const io = new Server(server, {
  cors: {
    origin: config.corsOrigins,
    credentials: true
  }
});

// Session configuration
app.keys = [config.sessionSecret];
const sessionConfig = {
  key: 'koa:sess',
  maxAge: 86400000, // 24 hours
  autoCommit: true,
  overwrite: true,
  httpOnly: true,
  signed: true,
  rolling: false,
  renew: false,
  secure: config.isProduction,
  sameSite: 'lax' as const,
  store: redisStore({
    client: redis,
    prefix: 'sess:'
  })
};

// Apply middlewares
app.use(errorHandler);
app.use(requestLogger);
app.use(responseTime);
app.use(logger());
app.use(json({ pretty: !config.isProduction }));
app.use(compress());
app.use(helmet());
app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}));
app.use(bodyParser({
  jsonLimit: '10mb',
  formLimit: '10mb',
  enableTypes: ['json', 'form'],
  onerror: (err, ctx) => {
    ctx.throw(422, 'Body parse error');
  }
}));

// Rate limiting
app.use(ratelimit({
  driver: 'redis',
  db: redis,
  duration: 60000, // 1 minute
  errorMessage: 'Too many requests, please try again later.',
  id: (ctx) => ctx.ip,
  headers: {
    remaining: 'Rate-Limit-Remaining',
    reset: 'Rate-Limit-Reset',
    total: 'Rate-Limit-Total'
  },
  max: 100,
  disableHeader: false
}));

// Session
app.use(session(sessionConfig, app));

// Static files
app.use(mount('/static', serve(path.join(__dirname, '../public'))));
app.use(mount('/uploads', serve(path.join(__dirname, '../uploads'))));

// API routes
app.use(router.routes());
app.use(router.allowedMethods());

// Swagger documentation
if (!config.isProduction) {
  setupSwagger(app);
}

// Health check
app.use(async (ctx, next) => {
  if (ctx.path === '/health') {
    ctx.body = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.env
    };
    return;
  }
  await next();
});

// 404 handler
app.use(async (ctx) => {
  ctx.status = 404;
  ctx.body = {
    success: false,
    message: 'Not Found',
    path: ctx.path
  };
});

// Initialize WebSocket
initializeWebSocket(io);

// Graceful shutdown
const gracefulShutdown = async () => {
  Logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    Logger.info('HTTP server closed');
  });
  
  // Close database connections
  await redis.quit();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    
    // Start server
    server.listen(config.port, () => {
      Logger.info(\`🚀 Server is running on port \${config.port}\`);
      Logger.info(\`🔧 Environment: \${config.env}\`);
      if (!config.isProduction) {
        Logger.info(\`📚 API Documentation: http://localhost:\${config.port}/swagger\`);
      }
    });
  } catch (error) {
    Logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { app, io };`,

    // Configuration
    'src/config/config.ts': `import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
  
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  
  // Database
  database: {
    client: process.env.DB_CLIENT || 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || '{{projectName}}'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: path.join(__dirname, '../database/migrations'),
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: path.join(__dirname, '../database/seeds')
    }
  },
  
  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10)
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  
  // Session
  sessionSecret: process.env.SESSION_SECRET || 'your-session-secret',
  
  // CORS
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  
  // Email
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    from: process.env.EMAIL_FROM || 'noreply@example.com'
  },
  
  // File upload
  upload: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    allowedExtensions: process.env.ALLOWED_EXTENSIONS?.split(',') || 
      ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx']
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || 'logs'
  },
  
  // API
  api: {
    prefix: process.env.API_PREFIX || '/api/v1',
    pagination: {
      defaultLimit: 20,
      maxLimit: 100
    }
  }
};`,

    // Database configuration
    'src/config/database.ts': `import { Model } from 'objection';
import Knex from 'knex';
import { config } from './config';
import { Logger } from '@utils/logger';

let knex: Knex;

export const connectDatabase = async () => {
  try {
    knex = Knex({
      client: config.database.client,
      connection: config.database.connection,
      pool: config.database.pool,
      migrations: config.database.migrations,
      seeds: config.database.seeds,
      debug: config.isDevelopment
    });

    // Test connection
    await knex.raw('SELECT 1');
    
    // Bind Objection.js models to Knex instance
    Model.knex(knex);
    
    Logger.info('Database connected successfully');
  } catch (error) {
    Logger.error('Database connection failed:', error);
    throw error;
  }
};

export const getKnex = () => {
  if (!knex) {
    throw new Error('Database not initialized');
  }
  return knex;
};

export const closeDatabase = async () => {
  if (knex) {
    await knex.destroy();
    Logger.info('Database connection closed');
  }
};`,

    // Knexfile
    'knexfile.ts': `import { config } from './src/config/config';

module.exports = {
  development: config.database,
  test: {
    ...config.database,
    connection: {
      ...config.database.connection,
      database: \`\${config.database.connection.database}_test\`
    }
  },
  production: config.database
};`,

    // Routes
    'src/routes/index.ts': `import Router from '@koa/router';
import { config } from '@config/config';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import todoRoutes from './todo.routes';

const router = new Router({
  prefix: config.api.prefix
});

// Root endpoint
router.get('/', async (ctx) => {
  ctx.body = {
    message: '{{projectName}} API',
    version: '1.0.0',
    endpoints: {
      auth: \`\${config.api.prefix}/auth\`,
      users: \`\${config.api.prefix}/users\`,
      todos: \`\${config.api.prefix}/todos\`,
      health: '/health'
    }
  };
});

// Mount routes
router.use('/auth', authRoutes.routes(), authRoutes.allowedMethods());
router.use('/users', userRoutes.routes(), userRoutes.allowedMethods());
router.use('/todos', todoRoutes.routes(), todoRoutes.allowedMethods());

export { router };`,

    // Auth routes
    'src/routes/auth.routes.ts': `import Router from '@koa/router';
import { AuthController } from '@controllers/auth.controller';
import { validate } from '@middlewares/validate.middleware';
import { authenticate } from '@middlewares/auth.middleware';
import { LoginDto, RegisterDto, RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto } from '@validators/auth.validators';

const router = new Router();
const authController = new AuthController();

// Register
router.post('/register', validate(RegisterDto), authController.register);

// Login
router.post('/login', validate(LoginDto), authController.login);

// Refresh token
router.post('/refresh', validate(RefreshTokenDto), authController.refreshToken);

// Logout
router.post('/logout', authenticate, authController.logout);

// Verify email
router.get('/verify/:token', authController.verifyEmail);

// Forgot password
router.post('/forgot-password', validate(ForgotPasswordDto), authController.forgotPassword);

// Reset password
router.post('/reset-password/:token', validate(ResetPasswordDto), authController.resetPassword);

export default router;`,

    // User routes
    'src/routes/user.routes.ts': `import Router from '@koa/router';
import { UserController } from '@controllers/user.controller';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validate.middleware';
import { UpdateUserDto, ChangePasswordDto } from '@validators/user.validators';
import { upload } from '@middlewares/upload.middleware';

const router = new Router();
const userController = new UserController();

// Apply authentication to all routes
router.use(authenticate);

// Get all users (admin only)
router.get('/', authorize('admin'), userController.getAllUsers);

// Get current user
router.get('/me', userController.getCurrentUser);

// Get user by ID
router.get('/:id', userController.getUserById);

// Update user
router.put('/:id', validate(UpdateUserDto), userController.updateUser);

// Delete user (admin only)
router.delete('/:id', authorize('admin'), userController.deleteUser);

// Change password
router.post('/change-password', validate(ChangePasswordDto), userController.changePassword);

// Upload avatar
router.post('/avatar', upload.single('avatar'), userController.uploadAvatar);

export default router;`,

    // Todo routes
    'src/routes/todo.routes.ts': `import Router from '@koa/router';
import { TodoController } from '@controllers/todo.controller';
import { authenticate } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validate.middleware';
import { CreateTodoDto, UpdateTodoDto, TodoQueryDto } from '@validators/todo.validators';

const router = new Router();
const todoController = new TodoController();

// Apply authentication to all routes
router.use(authenticate);

// Get all todos with pagination and filtering
router.get('/', validate(TodoQueryDto, 'query'), todoController.getAllTodos);

// Get todo by ID
router.get('/:id', todoController.getTodoById);

// Create todo
router.post('/', validate(CreateTodoDto), todoController.createTodo);

// Update todo
router.put('/:id', validate(UpdateTodoDto), todoController.updateTodo);

// Delete todo
router.delete('/:id', todoController.deleteTodo);

// Bulk operations
router.post('/bulk/delete', todoController.bulkDelete);
router.post('/bulk/update', todoController.bulkUpdate);

export default router;`,

    // Auth controller
    'src/controllers/auth.controller.ts': `import { Context } from 'koa';
import { AuthService } from '@services/auth.service';
import { EmailService } from '@services/email.service';
import { Logger } from '@utils/logger';
import { generateTokens } from '@utils/jwt';

export class AuthController {
  private authService: AuthService;
  private emailService: EmailService;

  constructor() {
    this.authService = new AuthService();
    this.emailService = new EmailService();
  }

  register = async (ctx: Context) => {
    const { email, password, name } = ctx.request.body;

    const user = await this.authService.register({ email, password, name });

    // Send verification email
    await this.emailService.sendVerificationEmail(email, user.verificationToken);

    const tokens = generateTokens(user.id);

    ctx.status = 201;
    ctx.body = {
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        user: user.toJSON(),
        ...tokens
      }
    };
  };

  login = async (ctx: Context) => {
    const { email, password } = ctx.request.body;

    const user = await this.authService.login(email, password);
    const tokens = generateTokens(user.id);

    // Set refresh token as HTTP-only cookie
    ctx.cookies.set('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: ctx.app.env === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    ctx.body = {
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        accessToken: tokens.accessToken
      }
    };
  };

  refreshToken = async (ctx: Context) => {
    const refreshToken = ctx.cookies.get('refreshToken') || ctx.request.body.refreshToken;

    if (!refreshToken) {
      ctx.throw(401, 'Refresh token not provided');
    }

    const { userId, accessToken } = await this.authService.refreshToken(refreshToken);

    ctx.body = {
      success: true,
      data: {
        accessToken
      }
    };
  };

  logout = async (ctx: Context) => {
    const userId = ctx.state.user.id;

    await this.authService.logout(userId);

    // Clear refresh token cookie
    ctx.cookies.set('refreshToken', null);

    ctx.body = {
      success: true,
      message: 'Logout successful'
    };
  };

  verifyEmail = async (ctx: Context) => {
    const { token } = ctx.params;

    await this.authService.verifyEmail(token);

    ctx.body = {
      success: true,
      message: 'Email verified successfully'
    };
  };

  forgotPassword = async (ctx: Context) => {
    const { email } = ctx.request.body;

    const resetToken = await this.authService.forgotPassword(email);

    // Send reset email
    await this.emailService.sendPasswordResetEmail(email, resetToken);

    ctx.body = {
      success: true,
      message: 'Password reset email sent'
    };
  };

  resetPassword = async (ctx: Context) => {
    const { token } = ctx.params;
    const { password } = ctx.request.body;

    await this.authService.resetPassword(token, password);

    ctx.body = {
      success: true,
      message: 'Password reset successful'
    };
  };
}`,

    // User controller
    'src/controllers/user.controller.ts': `import { Context } from 'koa';
import { UserService } from '@services/user.service';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  getAllUsers = async (ctx: Context) => {
    const { page = 1, limit = 20, search } = ctx.query;

    const result = await this.userService.getAllUsers({
      page: Number(page),
      limit: Number(limit),
      search: search as string
    });

    ctx.body = {
      success: true,
      data: result
    };
  };

  getCurrentUser = async (ctx: Context) => {
    const userId = ctx.state.user.id;

    const user = await this.userService.getUserById(userId);

    ctx.body = {
      success: true,
      data: user.toJSON()
    };
  };

  getUserById = async (ctx: Context) => {
    const { id } = ctx.params;

    const user = await this.userService.getUserById(id);

    ctx.body = {
      success: true,
      data: user.toJSON()
    };
  };

  updateUser = async (ctx: Context) => {
    const { id } = ctx.params;
    const updates = ctx.request.body;
    const currentUserId = ctx.state.user.id;

    // Ensure users can only update their own profile unless admin
    if (currentUserId !== id && ctx.state.user.role !== 'admin') {
      ctx.throw(403, 'Forbidden');
    }

    const user = await this.userService.updateUser(id, updates);

    ctx.body = {
      success: true,
      message: 'User updated successfully',
      data: user.toJSON()
    };
  };

  deleteUser = async (ctx: Context) => {
    const { id } = ctx.params;

    await this.userService.deleteUser(id);

    ctx.body = {
      success: true,
      message: 'User deleted successfully'
    };
  };

  changePassword = async (ctx: Context) => {
    const userId = ctx.state.user.id;
    const { currentPassword, newPassword } = ctx.request.body;

    await this.userService.changePassword(userId, currentPassword, newPassword);

    ctx.body = {
      success: true,
      message: 'Password changed successfully'
    };
  };

  uploadAvatar = async (ctx: Context) => {
    const userId = ctx.state.user.id;
    const file = ctx.file;

    if (!file) {
      ctx.throw(400, 'No file uploaded');
    }

    const avatarUrl = await this.userService.updateAvatar(userId, file);

    ctx.body = {
      success: true,
      message: 'Avatar uploaded successfully',
      data: { avatarUrl }
    };
  };
}`,

    // Todo controller
    'src/controllers/todo.controller.ts': `import { Context } from 'koa';
import { TodoService } from '@services/todo.service';

export class TodoController {
  private todoService: TodoService;

  constructor() {
    this.todoService = new TodoService();
  }

  getAllTodos = async (ctx: Context) => {
    const userId = ctx.state.user.id;
    const { page = 1, limit = 20, status, priority, sortBy = 'createdAt', order = 'desc' } = ctx.query;

    const result = await this.todoService.getAllTodos({
      userId,
      page: Number(page),
      limit: Number(limit),
      status: status as string,
      priority: priority as string,
      sortBy: sortBy as string,
      order: order as 'asc' | 'desc'
    });

    ctx.body = {
      success: true,
      data: result
    };
  };

  getTodoById = async (ctx: Context) => {
    const { id } = ctx.params;
    const userId = ctx.state.user.id;

    const todo = await this.todoService.getTodoById(id, userId);

    ctx.body = {
      success: true,
      data: todo.toJSON()
    };
  };

  createTodo = async (ctx: Context) => {
    const userId = ctx.state.user.id;
    const todoData = { ...ctx.request.body, userId };

    const todo = await this.todoService.createTodo(todoData);

    ctx.status = 201;
    ctx.body = {
      success: true,
      message: 'Todo created successfully',
      data: todo.toJSON()
    };
  };

  updateTodo = async (ctx: Context) => {
    const { id } = ctx.params;
    const userId = ctx.state.user.id;
    const updates = ctx.request.body;

    const todo = await this.todoService.updateTodo(id, userId, updates);

    ctx.body = {
      success: true,
      message: 'Todo updated successfully',
      data: todo.toJSON()
    };
  };

  deleteTodo = async (ctx: Context) => {
    const { id } = ctx.params;
    const userId = ctx.state.user.id;

    await this.todoService.deleteTodo(id, userId);

    ctx.body = {
      success: true,
      message: 'Todo deleted successfully'
    };
  };

  bulkDelete = async (ctx: Context) => {
    const userId = ctx.state.user.id;
    const { ids } = ctx.request.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      ctx.throw(400, 'Invalid todo IDs');
    }

    const count = await this.todoService.bulkDelete(ids, userId);

    ctx.body = {
      success: true,
      message: \`\${count} todos deleted successfully\`
    };
  };

  bulkUpdate = async (ctx: Context) => {
    const userId = ctx.state.user.id;
    const { ids, updates } = ctx.request.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      ctx.throw(400, 'Invalid todo IDs');
    }

    const count = await this.todoService.bulkUpdate(ids, userId, updates);

    ctx.body = {
      success: true,
      message: \`\${count} todos updated successfully\`
    };
  };
}`,

    // Models
    'src/models/User.ts': `import { Model } from 'objection';
import bcrypt from 'bcryptjs';
import { Todo } from './Todo';

export class User extends Model {
  id!: string;
  email!: string;
  password!: string;
  name!: string;
  role!: string;
  isActive!: boolean;
  isVerified!: boolean;
  verificationToken?: string;
  resetToken?: string;
  resetTokenExpiry?: Date;
  avatarUrl?: string;
  lastLogin?: Date;
  createdAt!: Date;
  updatedAt!: Date;

  // Relations
  todos?: Todo[];

  static tableName = 'users';

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['email', 'password', 'name'],
      properties: {
        id: { type: 'string' },
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 },
        name: { type: 'string', minLength: 1, maxLength: 100 },
        role: { type: 'string', enum: ['user', 'admin'], default: 'user' },
        isActive: { type: 'boolean', default: true },
        isVerified: { type: 'boolean', default: false },
        verificationToken: { type: ['string', 'null'] },
        resetToken: { type: ['string', 'null'] },
        resetTokenExpiry: { type: ['string', 'null'], format: 'date-time' },
        avatarUrl: { type: ['string', 'null'] },
        lastLogin: { type: ['string', 'null'], format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    };
  }

  static get relationMappings() {
    return {
      todos: {
        relation: Model.HasManyRelation,
        modelClass: Todo,
        join: {
          from: 'users.id',
          to: 'todos.userId'
        }
      }
    };
  }

  async $beforeInsert() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
    
    if (this.password) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }

  async $beforeUpdate() {
    this.updatedAt = new Date();
    
    if (this.password && this.password.indexOf('$2') !== 0) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }

  async verifyPassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  toJSON() {
    const json = super.toJSON();
    delete json.password;
    delete json.verificationToken;
    delete json.resetToken;
    delete json.resetTokenExpiry;
    return json;
  }
}`,

    'src/models/Todo.ts': `import { Model } from 'objection';
import { User } from './User';

export class Todo extends Model {
  id!: string;
  title!: string;
  description?: string;
  completed!: boolean;
  priority!: 'low' | 'medium' | 'high';
  dueDate?: Date;
  tags?: string[];
  userId!: string;
  createdAt!: Date;
  updatedAt!: Date;

  // Relations
  user?: User;

  static tableName = 'todos';

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['title', 'userId'],
      properties: {
        id: { type: 'string' },
        title: { type: 'string', minLength: 1, maxLength: 200 },
        description: { type: ['string', 'null'], maxLength: 1000 },
        completed: { type: 'boolean', default: false },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' },
        dueDate: { type: ['string', 'null'], format: 'date-time' },
        tags: { type: ['array', 'null'], items: { type: 'string' } },
        userId: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    };
  }

  static get relationMappings() {
    return {
      user: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'todos.userId',
          to: 'users.id'
        }
      }
    };
  }

  async $beforeInsert() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  async $beforeUpdate() {
    this.updatedAt = new Date();
  }
}`,

    // Middlewares
    'src/middlewares/error.middleware.ts': `import { Context, Next } from 'koa';
import { Logger } from '@utils/logger';

export const errorHandler = async (ctx: Context, next: Next) => {
  try {
    await next();
  } catch (err: any) {
    ctx.status = err.status || 500;
    
    const error = {
      success: false,
      message: err.message || 'Internal Server Error',
      ...(ctx.app.env === 'development' && {
        stack: err.stack,
        details: err
      })
    };

    // Log error
    Logger.error({
      message: err.message,
      stack: err.stack,
      url: ctx.url,
      method: ctx.method,
      ip: ctx.ip,
      status: ctx.status
    });

    ctx.body = error;
  }
};`,

    'src/middlewares/auth.middleware.ts': `import { Context, Next } from 'koa';
import jwt from 'jsonwebtoken';
import { config } from '@config/config';
import { UserService } from '@services/user.service';

const userService = new UserService();

export const authenticate = async (ctx: Context, next: Next) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    ctx.throw(401, 'No token provided');
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    const user = await userService.getUserById(decoded.id);

    if (!user || !user.isActive) {
      ctx.throw(401, 'Invalid token');
    }

    ctx.state.user = user;
    await next();
  } catch (error) {
    ctx.throw(401, 'Invalid token');
  }
};

export const authorize = (...roles: string[]) => {
  return async (ctx: Context, next: Next) => {
    if (!ctx.state.user) {
      ctx.throw(401, 'Not authenticated');
    }

    if (!roles.includes(ctx.state.user.role)) {
      ctx.throw(403, 'Not authorized');
    }

    await next();
  };
};`,

    'src/middlewares/validate.middleware.ts': `import { Context, Next } from 'koa';
import { validate as classValidate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';

export const validate = (dtoClass: any, source: 'body' | 'query' = 'body') => {
  return async (ctx: Context, next: Next) => {
    const data = source === 'body' ? ctx.request.body : ctx.query;
    const dto = plainToClass(dtoClass, data);
    
    const errors = await classValidate(dto);
    
    if (errors.length > 0) {
      const errorMessages = errors.reduce((acc: any, error: ValidationError) => {
        acc[error.property] = Object.values(error.constraints || {});
        return acc;
      }, {});
      
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: 'Validation failed',
        errors: errorMessages
      };
      return;
    }
    
    ctx.request.body = dto;
    await next();
  };
};`,

    // Validators (DTOs)
    'src/validators/auth.validators.ts': `import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string;
}`,

    // Environment variables
    '.env.example': `# Application
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Database
DB_CLIENT=pg
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME={{projectName}}

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d

# Session
SESSION_SECRET=your-session-secret

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@example.com

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads
ALLOWED_EXTENSIONS=jpg,jpeg,png,gif,pdf,doc,docx

# Logging
LOG_LEVEL=info
LOG_DIR=logs

# API
API_PREFIX=/api/v1`,

    // Docker configuration
    'Dockerfile': `# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine

# Install dumb-init
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --chown=nodejs:nodejs knexfile.ts ./
COPY --chown=nodejs:nodejs src/database ./src/database

# Create necessary directories
RUN mkdir -p uploads logs && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Run migrations and start
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npm run migrate && node dist/index.js"]`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    container_name: {{projectName}}-api
    ports:
      - "\${PORT:-3000}:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=\${DB_USER:-postgres}
      - DB_PASSWORD=\${DB_PASSWORD:-postgres}
      - DB_NAME=\${DB_NAME:-{{projectName}}}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    restart: unless-stopped
    networks:
      - app-network

  postgres:
    image: postgres:16-alpine
    container_name: {{projectName}}-db
    environment:
      - POSTGRES_USER=\${DB_USER:-postgres}
      - POSTGRES_PASSWORD=\${DB_PASSWORD:-postgres}
      - POSTGRES_DB=\${DB_NAME:-{{projectName}}}
    ports:
      - "\${DB_PORT:-5432}:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
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
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
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
      - ./public:/usr/share/nginx/html/static:ro
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

    '.dockerignore': `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Testing
coverage/
.nyc_output/

# Build outputs
dist/
build/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Git
.git/
.gitignore

# Docker
docker-compose.yml
Dockerfile
.dockerignore`,

    // README
    'README.md': `# {{projectName}}

Koa.js API server with TypeScript, featuring modern middleware architecture and comprehensive features.

## Features

- 🚀 **Koa.js** with async/await support
- 🔐 **JWT Authentication** with refresh tokens
- 🗄️ **Objection.js ORM** with Knex query builder
- 🚦 **Redis** for sessions and caching
- 📚 **Swagger Documentation** with decorators
- 🔄 **WebSocket** support with Socket.IO
- 🧪 **Testing** with Jest
- 🐳 **Docker** support
- 📊 **Logging** with Winston
- 🛡️ **Security** with Helmet, CORS, rate limiting
- 📤 **File uploads** with multer
- ✉️ **Email** support
- 🔄 **Background jobs** with Bull
- 📅 **Task scheduling** with node-cron

## Getting Started

### Prerequisites

- Node.js 18+
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

4. Run database migrations:
   \`\`\`bash
   npm run migrate
   \`\`\`

5. Seed the database (optional):
   \`\`\`bash
   npm run seed
   \`\`\`

6. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

### Running with Docker

\`\`\`bash
docker-compose up
\`\`\`

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:3000/swagger (development only)
- Health check: http://localhost:3000/health

## Testing

\`\`\`bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
\`\`\`

## Project Structure

\`\`\`
src/
├── config/         # Configuration files
├── controllers/    # Route controllers
├── middlewares/    # Koa middlewares
├── models/         # Database models
├── routes/         # API routes
├── services/       # Business logic
├── utils/          # Utility functions
├── validators/     # Request validators
├── types/          # TypeScript types
└── index.ts        # Application entry
\`\`\`

## Database

\`\`\`bash
# Create a new migration
npm run migrate:make migration_name

# Run migrations
npm run migrate

# Rollback migrations
knex migrate:rollback

# Create a new seed file
knex seed:make seed_name

# Run seeds
npm run seed
\`\`\`

## License

MIT
`
  }
};