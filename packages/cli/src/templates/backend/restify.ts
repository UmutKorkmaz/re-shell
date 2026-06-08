import { BackendTemplate } from '../types';

export const restifyTemplate: BackendTemplate = {
  id: 'restify',
  name: 'restify',
  displayName: 'Restify',
  description: 'Optimized for building REST APIs with built-in throttling, DTrace support, and API versioning',
  language: 'typescript',
  framework: 'restify',
  version: '11.1.0',
  tags: ['nodejs', 'restify', 'api', 'rest', 'microservices', 'throttling', 'typescript'],
  port: 3000,
  dependencies: {},
  features: ['rest-api', 'rate-limiting', 'validation', 'logging', 'monitoring', 'middleware', 'authentication', 'swagger'],
  
  files: {
    // TypeScript project configuration
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "Restify REST API server with TypeScript",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts | bunyan",
    "build": "tsc",
    "start": "node dist/index.js | bunyan",
    "start:prod": "cross-env NODE_ENV=production node dist/index.js | bunyan",
    "lint": "eslint src --ext .ts",
    "test": "mocha --require ts-node/register --require source-map-support/register --recursive 'test/**/*.spec.ts'",
    "test:watch": "mocha --watch --require ts-node/register --recursive 'test/**/*.spec.ts'",
    "test:coverage": "nyc npm test",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "migrate": "node dist/scripts/migrate.js",
    "docker:build": "docker build -t {{projectName}} .",
    "docker:run": "docker run -p 3000:3000 {{projectName}}"
  },
  "dependencies": {
    "restify": "^11.1.0",
    "restify-errors": "^8.0.2",
    "restify-cors-middleware2": "^2.2.1",
    "restify-router": "^0.6.2",
    "restify-jwt-community": "^2.0.2",
    "restify-swagger-jsdoc": "^3.5.0",
    "bunyan": "^1.8.15",
    "joi": "^17.12.3",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.4.5",
    "pg": "^8.11.5",
    "pg-pool": "^3.6.2",
    "caching": "^4.6.13",
    "ioredis": "^5.3.2",
    "uuid": "^9.0.1",
    "lodash": "^4.17.21",
    "dayjs": "^1.11.10",
    "axios": "^1.6.8",
    "nodemailer": "^6.9.13",
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0",
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "multer": "^1.4.5-lts.1",
    "sharp": "^0.33.3",
    "bull": "^4.12.2",
    "node-cron": "^3.0.3",
    "socket.io": "^4.7.5",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "passport-local": "^1.0.0"
  },
  "devDependencies": {
    "@types/restify": "^8.5.12",
    "@types/restify-errors": "^4.3.9",
    "@types/restify-cors-middleware": "^1.0.5",
    "@types/bunyan": "^1.8.11",
    "@types/joi": "^17.2.3",
    "@types/node": "^20.12.7",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/pg": "^8.11.5",
    "@types/lodash": "^4.17.0",
    "@types/nodemailer": "^6.4.14",
    "@types/multer": "^1.4.11",
    "@types/passport": "^1.0.16",
    "@types/passport-jwt": "^4.0.1",
    "@types/passport-local": "^1.0.38",
    "@types/bull": "^4.10.0",
    "@types/node-cron": "^3.0.11",
    "@types/mocha": "^10.0.6",
    "@types/chai": "^4.3.14",
    "@types/supertest": "^6.0.2",
    "@typescript-eslint/eslint-plugin": "^7.7.1",
    "@typescript-eslint/parser": "^7.7.1",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.2.5",
    "typescript": "^5.4.5",
    "tsx": "^4.7.2",
    "cross-env": "^7.0.3",
    "mocha": "^10.4.0",
    "chai": "^4.4.1",
    "chai-http": "^4.4.0",
    "supertest": "^7.0.0",
    "sinon": "^17.0.1",
    "@types/sinon": "^17.0.3",
    "nyc": "^15.1.0",
    "ts-node": "^10.9.2",
    "source-map-support": "^0.5.21",
    "nodemon": "^3.1.0"
  },
  "nyc": {
    "extension": [
      ".ts"
    ],
    "exclude": [
      "**/*.d.ts",
      "coverage",
      "dist",
      "test"
    ],
    "reporter": [
      "html",
      "text",
      "lcov"
    ],
    "all": true
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
  "exclude": ["node_modules", "dist", "coverage", "test"]
}`,

    // Main application entry point
    'src/index.ts': `import * as restify from 'restify';
import corsMiddleware from 'restify-cors-middleware2';
import { config } from './config/config';
import { logger } from './utils/logger';
import { setupRoutes } from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { requestLogger } from './middlewares/logger.middleware';
import { setupSwagger } from './config/swagger';
import { connectDatabase } from './config/database';
import { redisClient } from './config/redis';
import { initializeWebSocket } from './config/websocket';
import { gracefulShutdown } from './utils/gracefulShutdown';

// Create server
const server = restify.createServer({
  name: config.appName,
  version: config.version,
  log: logger,
  handleUncaughtExceptions: true
});

// Initialize WebSocket
const io = initializeWebSocket(server.server);

// Pre-routing middleware
server.pre(restify.pre.sanitizePath());
server.pre(restify.pre.userAgentConnection());

// CORS configuration
const cors = corsMiddleware({
  origins: config.corsOrigins,
  credentials: true,
  allowHeaders: ['Authorization', 'Content-Type'],
  exposeHeaders: ['X-Request-ID']
});

server.pre(cors.preflight);
server.use(cors.actual);

// Body parsing
server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser({ mapParams: true }));
server.use(restify.plugins.bodyParser({ mapParams: true }));
server.use(restify.plugins.gzipResponse());

// Request tracking
server.use(restify.plugins.requestLogger());

// Throttling
server.use(restify.plugins.throttle({
  burst: 100,
  rate: 50,
  ip: true,
  overrides: {
    '127.0.0.1': {
      rate: 0,
      burst: 0
    }
  }
}));

// Custom middleware
server.use(requestLogger);

// Health check endpoint
server.get('/health', (req, res, next) => {
  res.send({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
    version: config.version
  });
  next();
});

// API routes
setupRoutes(server);

// API documentation
setupSwagger(server);

// Error handling
server.on('restifyError', errorHandler);
server.on('uncaughtException', (req, res, route, err) => {
  logger.error({ err, req, route }, 'Uncaught exception');
  res.send(500, { error: 'Internal server error' });
});

// Graceful shutdown handlers
process.on('SIGTERM', () => gracefulShutdown(server, redisClient));
process.on('SIGINT', () => gracefulShutdown(server, redisClient));

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    
    // Connect to Redis
    await redisClient.connect();
    
    server.listen(config.port, config.host, () => {
      logger.info(\`🚀 Server is running on http://\${config.host}:\${config.port}\`);
      logger.info(\`📚 API Documentation: http://\${config.host}:\${config.port}/api-docs\`);
      logger.info(\`🔧 Environment: \${config.env}\`);
      logger.info(\`📊 Metrics: http://\${config.host}:\${config.port}/metrics\`);
    });
  } catch (error) {
    logger.fatal('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { server, io };`,

    // Configuration
    'src/config/config.ts': `import * as dotenv from 'dotenv';
import * as joi from 'joi';

dotenv.config();

// Define validation schema
const envSchema = joi.object({
  NODE_ENV: joi.string().valid('development', 'production', 'test').default('development'),
  PORT: joi.number().default(3000),
  HOST: joi.string().default('0.0.0.0'),
  APP_NAME: joi.string().default('{{projectName}}'),
  VERSION: joi.string().default('1.0.0'),
  
  // Database
  DATABASE_URL: joi.string().required(),
  DB_POOL_MIN: joi.number().default(2),
  DB_POOL_MAX: joi.number().default(10),
  
  // Redis
  REDIS_URL: joi.string().default('redis://localhost:6379'),
  
  // JWT
  JWT_SECRET: joi.string().required(),
  JWT_EXPIRE: joi.string().default('7d'),
  JWT_REFRESH_EXPIRE: joi.string().default('30d'),
  
  // CORS
  CORS_ORIGINS: joi.string().default('*'),
  
  // Email
  SMTP_HOST: joi.string().required(),
  SMTP_PORT: joi.number().default(587),
  SMTP_USER: joi.string().required(),
  SMTP_PASS: joi.string().required(),
  EMAIL_FROM: joi.string().required(),
  
  // File upload
  UPLOAD_DIR: joi.string().default('uploads'),
  MAX_FILE_SIZE: joi.number().default(10485760), // 10MB
  
  // Logging
  LOG_LEVEL: joi.string().valid('trace', 'debug', 'info', 'warn', 'error', 'fatal').default('info'),
  
  // Rate limiting
  RATE_LIMIT_WINDOW: joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX: joi.number().default(100)
}).unknown();

// Validate environment variables
const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(\`Config validation error: \${error.message}\`);
}

export const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  host: envVars.HOST,
  appName: envVars.APP_NAME,
  version: envVars.VERSION,
  
  database: {
    url: envVars.DATABASE_URL,
    pool: {
      min: envVars.DB_POOL_MIN,
      max: envVars.DB_POOL_MAX
    }
  },
  
  redis: {
    url: envVars.REDIS_URL
  },
  
  jwt: {
    secret: envVars.JWT_SECRET,
    expire: envVars.JWT_EXPIRE,
    refreshExpire: envVars.JWT_REFRESH_EXPIRE
  },
  
  corsOrigins: envVars.CORS_ORIGINS.split(',').map(origin => origin.trim()),
  
  email: {
    host: envVars.SMTP_HOST,
    port: envVars.SMTP_PORT,
    user: envVars.SMTP_USER,
    pass: envVars.SMTP_PASS,
    from: envVars.EMAIL_FROM
  },
  
  upload: {
    dir: envVars.UPLOAD_DIR,
    maxFileSize: envVars.MAX_FILE_SIZE
  },
  
  logging: {
    level: envVars.LOG_LEVEL
  },
  
  rateLimit: {
    window: envVars.RATE_LIMIT_WINDOW,
    max: envVars.RATE_LIMIT_MAX
  }
};`,

    // Routes setup
    'src/routes/index.ts': `import * as restify from 'restify';
import { Router } from 'restify-router';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import todoRoutes from './todo.routes';
import { authenticate } from '../middlewares/auth.middleware';

export function setupRoutes(server: restify.Server): void {
  const router = new Router();
  
  // API info endpoint
  router.get('/api/v1', (req, res, next) => {
    res.send({
      message: '{{projectName}} API',
      version: '1.0.0',
      endpoints: {
        auth: '/api/v1/auth',
        users: '/api/v1/users',
        todos: '/api/v1/todos',
        docs: '/api-docs',
        health: '/health',
        metrics: '/metrics'
      }
    });
    next();
  });
  
  // Mount routes
  router.add('/api/v1/auth', authRoutes);
  router.add('/api/v1/users', userRoutes);
  router.add('/api/v1/todos', todoRoutes);
  
  // Apply to server
  router.applyRoutes(server);
  
  // Metrics endpoint
  server.get('/metrics', authenticate, (req, res, next) => {
    const metrics = server.getMetrics();
    res.send(metrics);
    next();
  });
}`,

    // Authentication routes
    'src/routes/auth.routes.ts': `import { Router } from 'restify-router';
import { AuthController } from '../controllers/auth.controller';
import { validateBody } from '../middlewares/validation.middleware';
import { authValidators } from '../validators/auth.validators';
import { authenticate } from '../middlewares/auth.middleware';
import { rateLimiter } from '../middlewares/rateLimit.middleware';

const router = new Router();
const authController = new AuthController();

// Register
router.post(
  '/register',
  rateLimiter('auth'),
  validateBody(authValidators.register),
  authController.register
);

// Login
router.post(
  '/login',
  rateLimiter('auth'),
  validateBody(authValidators.login),
  authController.login
);

// Refresh token
router.post(
  '/refresh',
  validateBody(authValidators.refreshToken),
  authController.refreshToken
);

// Logout
router.post(
  '/logout',
  authenticate,
  authController.logout
);

// Verify email
router.get(
  '/verify/:token',
  authController.verifyEmail
);

// Forgot password
router.post(
  '/forgot-password',
  rateLimiter('auth'),
  validateBody(authValidators.forgotPassword),
  authController.forgotPassword
);

// Reset password
router.post(
  '/reset-password/:token',
  validateBody(authValidators.resetPassword),
  authController.resetPassword
);

export default router;`,

    // User routes
    'src/routes/user.routes.ts': `import { Router } from 'restify-router';
import { UserController } from '../controllers/user.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../middlewares/validation.middleware';
import { userValidators } from '../validators/user.validators';
import { upload } from '../middlewares/upload.middleware';

const router = new Router();
const userController = new UserController();

// All routes require authentication
router.use(authenticate);

// Get all users (admin only)
router.get(
  '/',
  authorize('admin'),
  validateQuery(userValidators.getAllUsers),
  userController.getAllUsers
);

// Get current user
router.get(
  '/me',
  userController.getCurrentUser
);

// Get user by ID
router.get(
  '/:id',
  validateParams(userValidators.getUserById),
  userController.getUserById
);

// Update user
router.put(
  '/:id',
  validateParams(userValidators.getUserById),
  validateBody(userValidators.updateUser),
  userController.updateUser
);

// Delete user
router.del(
  '/:id',
  authorize('admin'),
  validateParams(userValidators.getUserById),
  userController.deleteUser
);

// Change password
router.post(
  '/change-password',
  validateBody(userValidators.changePassword),
  userController.changePassword
);

// Upload avatar
router.post(
  '/avatar',
  upload.single('avatar'),
  userController.uploadAvatar
);

export default router;`,

    // Todo routes
    'src/routes/todo.routes.ts': `import { Router } from 'restify-router';
import { TodoController } from '../controllers/todo.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../middlewares/validation.middleware';
import { todoValidators } from '../validators/todo.validators';

const router = new Router();
const todoController = new TodoController();

// All routes require authentication
router.use(authenticate);

// Get all todos with pagination and filtering
router.get(
  '/',
  validateQuery(todoValidators.getAllTodos),
  todoController.getAllTodos
);

// Get todo by ID
router.get(
  '/:id',
  validateParams(todoValidators.getTodoById),
  todoController.getTodoById
);

// Create todo
router.post(
  '/',
  validateBody(todoValidators.createTodo),
  todoController.createTodo
);

// Update todo
router.put(
  '/:id',
  validateParams(todoValidators.getTodoById),
  validateBody(todoValidators.updateTodo),
  todoController.updateTodo
);

// Delete todo
router.del(
  '/:id',
  validateParams(todoValidators.getTodoById),
  todoController.deleteTodo
);

// Bulk operations
router.post(
  '/bulk/delete',
  validateBody(todoValidators.bulkDelete),
  todoController.bulkDelete
);

router.post(
  '/bulk/update',
  validateBody(todoValidators.bulkUpdate),
  todoController.bulkUpdate
);

export default router;`,

    // Authentication controller
    'src/controllers/auth.controller.ts': `import * as restify from 'restify';
import { AuthService } from '../services/auth.service';
import { EmailService } from '../services/email.service';
import { logger } from '../utils/logger';
import { BadRequestError, UnauthorizedError } from 'restify-errors';

export class AuthController {
  private authService: AuthService;
  private emailService: EmailService;

  constructor() {
    this.authService = new AuthService();
    this.emailService = new EmailService();
  }

  register = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const { email, password, name } = req.body;

      const result = await this.authService.register({ email, password, name });

      // Send verification email
      await this.emailService.sendVerificationEmail(email, result.verificationToken);

      res.send(201, {
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        }
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Registration error');
      return next(error);
    }
  };

  login = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const { email, password } = req.body;

      const result = await this.authService.login(email, password);

      // Set refresh token as HTTP-only cookie
      res.setCookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.send({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.accessToken
        }
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Login error');
      return next(error);
    }
  };

  refreshToken = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        throw new UnauthorizedError('Refresh token not provided');
      }

      const result = await this.authService.refreshToken(refreshToken);

      res.send({
        success: true,
        data: {
          accessToken: result.accessToken
        }
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Refresh token error');
      return next(error);
    }
  };

  logout = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const userId = req.user?.id;

      if (userId) {
        await this.authService.logout(userId);
      }

      res.clearCookie('refreshToken');

      res.send({
        success: true,
        message: 'Logout successful'
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Logout error');
      return next(error);
    }
  };

  verifyEmail = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const { token } = req.params;

      await this.authService.verifyEmail(token);

      res.send({
        success: true,
        message: 'Email verified successfully'
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Email verification error');
      return next(error);
    }
  };

  forgotPassword = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const { email } = req.body;

      const resetToken = await this.authService.forgotPassword(email);

      // Send reset email
      await this.emailService.sendPasswordResetEmail(email, resetToken);

      res.send({
        success: true,
        message: 'Password reset email sent'
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Forgot password error');
      return next(error);
    }
  };

  resetPassword = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const { token } = req.params;
      const { password } = req.body;

      await this.authService.resetPassword(token, password);

      res.send({
        success: true,
        message: 'Password reset successful'
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Reset password error');
      return next(error);
    }
  };
}`,

    // User controller
    'src/controllers/user.controller.ts': `import * as restify from 'restify';
import { UserService } from '../services/user.service';
import { ForbiddenError, BadRequestError } from 'restify-errors';
import { logger } from '../utils/logger';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  getAllUsers = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const { page = 1, limit = 10, search } = req.query;

      const result = await this.userService.getAllUsers({
        page: Number(page),
        limit: Number(limit),
        search: search as string
      });

      res.send({
        success: true,
        data: result
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Get all users error');
      return next(error);
    }
  };

  getCurrentUser = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const userId = req.user!.id;

      const user = await this.userService.getUserById(userId);

      res.send({
        success: true,
        data: user
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Get current user error');
      return next(error);
    }
  };

  getUserById = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const { id } = req.params;

      const user = await this.userService.getUserById(id);

      res.send({
        success: true,
        data: user
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Get user by ID error');
      return next(error);
    }
  };

  updateUser = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Ensure users can only update their own profile unless admin
      if (req.user!.id !== id && req.user!.role !== 'admin') {
        throw new ForbiddenError('Forbidden');
      }

      const user = await this.userService.updateUser(id, updates);

      res.send({
        success: true,
        message: 'User updated successfully',
        data: user
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Update user error');
      return next(error);
    }
  };

  deleteUser = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const { id } = req.params;

      await this.userService.deleteUser(id);

      res.send({
        success: true,
        message: 'User deleted successfully'
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Delete user error');
      return next(error);
    }
  };

  changePassword = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const userId = req.user!.id;
      const { currentPassword, newPassword } = req.body;

      await this.userService.changePassword(userId, currentPassword, newPassword);

      res.send({
        success: true,
        message: 'Password changed successfully'
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Change password error');
      return next(error);
    }
  };

  uploadAvatar = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const userId = req.user!.id;

      if (!req.file) {
        throw new BadRequestError('No file uploaded');
      }

      const avatarUrl = await this.userService.updateAvatar(userId, req.file);

      res.send({
        success: true,
        message: 'Avatar uploaded successfully',
        data: { avatarUrl }
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Upload avatar error');
      return next(error);
    }
  };
}`,

    // Todo controller
    'src/controllers/todo.controller.ts': `import * as restify from 'restify';
import { TodoService } from '../services/todo.service';
import { BadRequestError } from 'restify-errors';
import { logger } from '../utils/logger';

export class TodoController {
  private todoService: TodoService;

  constructor() {
    this.todoService = new TodoService();
  }

  getAllTodos = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const userId = req.user!.id;
      const { page = 1, limit = 10, status, priority } = req.query;

      const result = await this.todoService.getAllTodos({
        userId,
        page: Number(page),
        limit: Number(limit),
        status: status as string,
        priority: priority as string
      });

      res.send({
        success: true,
        data: result
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Get all todos error');
      return next(error);
    }
  };

  getTodoById = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const todo = await this.todoService.getTodoById(id, userId);

      res.send({
        success: true,
        data: todo
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Get todo by ID error');
      return next(error);
    }
  };

  createTodo = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const userId = req.user!.id;
      const todoData = { ...req.body, userId };

      const todo = await this.todoService.createTodo(todoData);

      res.send(201, {
        success: true,
        message: 'Todo created successfully',
        data: todo
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Create todo error');
      return next(error);
    }
  };

  updateTodo = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const updates = req.body;

      const todo = await this.todoService.updateTodo(id, userId, updates);

      res.send({
        success: true,
        message: 'Todo updated successfully',
        data: todo
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Update todo error');
      return next(error);
    }
  };

  deleteTodo = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      await this.todoService.deleteTodo(id, userId);

      res.send({
        success: true,
        message: 'Todo deleted successfully'
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Delete todo error');
      return next(error);
    }
  };

  bulkDelete = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const userId = req.user!.id;
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        throw new BadRequestError('Invalid todo IDs');
      }

      const count = await this.todoService.bulkDelete(ids, userId);

      res.send({
        success: true,
        message: \`\${count} todos deleted successfully\`
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Bulk delete error');
      return next(error);
    }
  };

  bulkUpdate = async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    try {
      const userId = req.user!.id;
      const { ids, updates } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        throw new BadRequestError('Invalid todo IDs');
      }

      const count = await this.todoService.bulkUpdate(ids, userId, updates);

      res.send({
        success: true,
        message: \`\${count} todos updated successfully\`
      });
      
      return next();
    } catch (error) {
      logger.error({ err: error }, 'Bulk update error');
      return next(error);
    }
  };
}`,

    // Authentication middleware
    'src/middlewares/auth.middleware.ts': `import * as restify from 'restify';
import * as jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from 'restify-errors';
import { config } from '../config/config';
import { UserService } from '../services/user.service';

interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

declare module 'restify' {
  interface Request {
    user?: JwtPayload;
  }
}

const userService = new UserService();

export const authenticate = async (
  req: restify.Request,
  res: restify.Response,
  next: restify.Next
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

      // Check if user still exists
      const user = await userService.getUserById(decoded.id);
      if (!user) {
        throw new UnauthorizedError('User no longer exists');
      }

      // Attach user to request
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      };

      return next();
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
  } catch (error) {
    return next(error);
  }
};

export const authorize = (...roles: string[]) => {
  return (req: restify.Request, res: restify.Response, next: restify.Next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Not authorized for this resource'));
    }

    return next();
  };
};`,

    // Error handling middleware
    'src/middlewares/error.middleware.ts': `import * as restify from 'restify';
import { logger } from '../utils/logger';

export const errorHandler = (
  req: restify.Request,
  res: restify.Response,
  err: any,
  callback: Function
) => {
  // Log the error
  logger.error({
    err,
    req: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      params: req.params,
      query: req.query,
      body: req.body
    }
  }, 'Request error');

  // Handle known Restify errors
  if (err.name === 'ValidationError') {
    res.send(400, {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.body
      }
    });
    return callback();
  }

  if (err.name === 'ResourceNotFoundError') {
    res.send(404, {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: err.message || 'Resource not found'
      }
    });
    return callback();
  }

  if (err.name === 'InvalidCredentialsError' || err.name === 'UnauthorizedError') {
    res.send(401, {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: err.message || 'Unauthorized'
      }
    });
    return callback();
  }

  if (err.name === 'ForbiddenError') {
    res.send(403, {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: err.message || 'Forbidden'
      }
    });
    return callback();
  }

  // Database errors
  if (err.code === '23505') {
    res.send(409, {
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'Duplicate entry'
      }
    });
    return callback();
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  res.send(statusCode, {
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });

  return callback();
};`,

    // Validation middleware
    'src/middlewares/validation.middleware.ts': `import * as restify from 'restify';
import * as joi from 'joi';
import { BadRequestError } from 'restify-errors';

export const validateBody = (schema: joi.Schema) => {
  return (req: restify.Request, res: restify.Response, next: restify.Next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return next(new BadRequestError({
        message: 'Validation failed',
        body: details
      }));
    }

    req.body = value;
    return next();
  };
};

export const validateParams = (schema: joi.Schema) => {
  return (req: restify.Request, res: restify.Response, next: restify.Next) => {
    const { error, value } = schema.validate(req.params, { abortEarly: false });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return next(new BadRequestError({
        message: 'Validation failed',
        body: details
      }));
    }

    req.params = value;
    return next();
  };
};

export const validateQuery = (schema: joi.Schema) => {
  return (req: restify.Request, res: restify.Response, next: restify.Next) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return next(new BadRequestError({
        message: 'Validation failed',
        body: details
      }));
    }

    req.query = value;
    return next();
  };
};`,

    // Rate limiting middleware
    'src/middlewares/rateLimit.middleware.ts': `import * as restify from 'restify';
import { redisClient } from '../config/redis';
import { TooManyRequestsError } from 'restify-errors';
import { config } from '../config/config';

interface RateLimitOptions {
  window?: number;
  max?: number;
  keyPrefix?: string;
}

export const rateLimiter = (namespace: string, options: RateLimitOptions = {}) => {
  const {
    window = config.rateLimit.window,
    max = config.rateLimit.max,
    keyPrefix = 'rate_limit'
  } = options;

  return async (req: restify.Request, res: restify.Response, next: restify.Next) => {
    const ip = req.connection.remoteAddress || 'unknown';
    const key = \`\${keyPrefix}:\${namespace}:\${ip}\`;

    try {
      const current = await redisClient.incr(key);

      if (current === 1) {
        await redisClient.expire(key, Math.ceil(window / 1000));
      }

      const ttl = await redisClient.ttl(key);

      res.header('X-RateLimit-Limit', max.toString());
      res.header('X-RateLimit-Remaining', Math.max(0, max - current).toString());
      res.header('X-RateLimit-Reset', new Date(Date.now() + ttl * 1000).toISOString());

      if (current > max) {
        return next(new TooManyRequestsError('Rate limit exceeded'));
      }

      return next();
    } catch (error) {
      // If Redis is down, allow the request
      return next();
    }
  };
};`,

    // Logger middleware
    'src/middlewares/logger.middleware.ts': `import * as restify from 'restify';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export const requestLogger = (req: restify.Request, res: restify.Response, next: restify.Next) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  // Attach request ID
  req.id = () => requestId;
  res.header('X-Request-ID', requestId);

  // Log request
  logger.info({
    requestId,
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query,
    ip: req.connection.remoteAddress
  }, 'Incoming request');

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info({
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      contentLength: res.getHeader('Content-Length')
    }, 'Request completed');
  });

  return next();
};`,

    // Upload middleware
    'src/middlewares/upload.middleware.ts': `import * as multer from 'multer';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/config';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.upload.dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = \`\${uuidv4()}\${path.extname(file.originalname)}\`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize
  }
});`,

    // Auth validators
    'src/validators/auth.validators.ts': `import * as joi from 'joi';

export const authValidators = {
  register: joi.object({
    email: joi.string().email().required(),
    password: joi.string().min(8).required(),
    name: joi.string().min(2).max(50).required()
  }),

  login: joi.object({
    email: joi.string().email().required(),
    password: joi.string().required()
  }),

  refreshToken: joi.object({
    refreshToken: joi.string().optional()
  }),

  forgotPassword: joi.object({
    email: joi.string().email().required()
  }),

  resetPassword: joi.object({
    password: joi.string().min(8).required()
  })
};`,

    // User validators
    'src/validators/user.validators.ts': `import * as joi from 'joi';

export const userValidators = {
  getAllUsers: joi.object({
    page: joi.number().integer().min(1).optional(),
    limit: joi.number().integer().min(1).max(100).optional(),
    search: joi.string().optional()
  }),

  getUserById: joi.object({
    id: joi.string().uuid().required()
  }),

  updateUser: joi.object({
    email: joi.string().email().optional(),
    name: joi.string().min(2).max(50).optional()
  }),

  changePassword: joi.object({
    currentPassword: joi.string().required(),
    newPassword: joi.string().min(8).required()
  })
};`,

    // Todo validators
    'src/validators/todo.validators.ts': `import * as joi from 'joi';

export const todoValidators = {
  getAllTodos: joi.object({
    page: joi.number().integer().min(1).optional(),
    limit: joi.number().integer().min(1).max(100).optional(),
    status: joi.string().valid('pending', 'in_progress', 'completed').optional(),
    priority: joi.string().valid('low', 'medium', 'high').optional()
  }),

  getTodoById: joi.object({
    id: joi.string().uuid().required()
  }),

  createTodo: joi.object({
    title: joi.string().min(1).max(255).required(),
    description: joi.string().max(1000).optional(),
    priority: joi.string().valid('low', 'medium', 'high').optional(),
    dueDate: joi.date().iso().optional()
  }),

  updateTodo: joi.object({
    title: joi.string().min(1).max(255).optional(),
    description: joi.string().max(1000).optional(),
    status: joi.string().valid('pending', 'in_progress', 'completed').optional(),
    priority: joi.string().valid('low', 'medium', 'high').optional(),
    dueDate: joi.date().iso().optional()
  }),

  bulkDelete: joi.object({
    ids: joi.array().items(joi.string().uuid()).min(1).required()
  }),

  bulkUpdate: joi.object({
    ids: joi.array().items(joi.string().uuid()).min(1).required(),
    updates: joi.object({
      status: joi.string().valid('pending', 'in_progress', 'completed').optional(),
      priority: joi.string().valid('low', 'medium', 'high').optional()
    }).required()
  })
};`,

    // Database configuration
    'src/config/database.ts': `import { Pool } from 'pg';
import { config } from './config';
import { logger } from '../utils/logger';

export const pool = new Pool({
  connectionString: config.database.url,
  min: config.database.pool.min,
  max: config.database.pool.max,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000});

pool.on('error', (err) => {
  logger.error('Unexpected database error on idle client', err);
});

export const connectDatabase = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
};

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug({ text, duration, rows: res.rowCount }, 'Database query executed');
    return res;
  } catch (error) {
    logger.error({ text, error }, 'Database query error');
    throw error;
  }
};

export const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = () => {
    client.release();
  };

  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    logger.error('A client has been checked out for more than 5 seconds!');
  }, 5000);

  const releaseWithTimeout = () => {
    clearTimeout(timeout);
    client.release();
  };

  return {
    query,
    release: releaseWithTimeout,
    client
  };
};`,

    // Redis configuration
    'src/config/redis.ts': `import { createClient } from 'redis';
import { config } from './config';
import { logger } from '../utils/logger';

export const redisClient = createClient({
  url: config.redis.url,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis: Maximum reconnection attempts reached');
        return new Error('Maximum reconnection attempts reached');
      }
      const delay = Math.min(retries * 100, 3000);
      logger.info(\`Redis: Reconnecting in \${delay}ms...\`);
      return delay;
    }
  }
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis Client Connected');
});

redisClient.on('ready', () => {
  logger.info('Redis Client Ready');
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis Client Reconnecting');
});`,

    // WebSocket configuration
    'src/config/websocket.ts': `import { Server } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { config } from './config';
import { logger } from '../utils/logger';

interface SocketWithAuth extends Socket {
  userId?: string;
}

export const initializeWebSocket = (server: any) => {
  const io = new Server(server, {
    cors: {
      origin: config.corsOrigins,
      credentials: true
    }
  });

  // Authentication middleware
  io.use(async (socket: any, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, config.jwt.secret) as any;
      socket.userId = decoded.id;
      
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: any) => {
    logger.info(\`User \${socket.userId} connected via WebSocket\`);

    // Join user's personal room
    if (socket.userId) {
      socket.join(\`user:\${socket.userId}\`);
    }

    // Handle real-time events
    socket.on('join-room', (roomId: string) => {
      socket.join(roomId);
      logger.info(\`User \${socket.userId} joined room \${roomId}\`);
    });

    socket.on('leave-room', (roomId: string) => {
      socket.leave(roomId);
      logger.info(\`User \${socket.userId} left room \${roomId}\`);
    });

    socket.on('todo-update', (data: any) => {
      // Broadcast to all users in the room
      socket.to(\`user:\${socket.userId}\`).emit('todo-updated', data);
    });

    socket.on('disconnect', () => {
      logger.info(\`User \${socket.userId} disconnected\`);
    });
  });

  return io;
};

export const emitToUser = (io: Server, userId: string, event: string, data: any) => {
  io.to(\`user:\${userId}\`).emit(event, data);
};`,

    // Swagger configuration
    'src/config/swagger.ts': `import * as restify from 'restify';
import * as swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '{{projectName}} API',
      version: config.version,
      description: 'Restify REST API with TypeScript',
      license: {
        name: 'MIT',
        url: 'https://spdx.org/licenses/MIT.html'},
      contact: {
        name: 'API Support',
        email: 'support@example.com'}},
    servers: [
      {
        url: \`http://localhost:\${config.port}/api/v1\`,
        description: 'Development server'},
      {
        url: process.env.API_URL || 'https://api.example.com/v1',
        description: 'Production server'}],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'}}},
    security: [
      {
        bearerAuth: []}]},
  apis: ['./src/routes/*.ts', './src/models/*.ts']};

export function setupSwagger(server: restify.Server): void {
  const specs = swaggerJsdoc(options);
  
  server.get('/api-docs', (req, res, next) => {
    res.setHeader('Content-Type', 'text/html');
    res.writeHead(200);
    res.end(\`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>{{projectName}} API Documentation</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui.css" />
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-bundle.js"></script>
        <script src="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-standalone-preset.js"></script>
        <script>
          window.onload = function() {
            window.ui = SwaggerUIBundle({
              url: '/api-docs.json',
              dom_id: '#swagger-ui',
              deepLinking: true,
              presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
              ],
              plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
              ],
              layout: "StandaloneLayout"
            });
          };
        </script>
      </body>
      </html>
    \`);
    next();
  });

  server.get('/api-docs.json', (req, res, next) => {
    res.json(specs);
    next();
  });
}`,

    // Logger utility
    'src/utils/logger.ts': `import * as bunyan from 'bunyan';
import * as path from 'path';
import { config } from '../config/config';

const logDir = process.env.LOG_DIR || 'logs';

export const logger = bunyan.createLogger({
  name: config.appName,
  level: config.logging.level as any,
  serializers: bunyan.stdSerializers,
  streams: [
    {
      level: 'info',
      stream: process.stdout
    },
    {
      level: 'error',
      path: path.join(logDir, 'error.log')
    },
    {
      level: 'info',
      path: path.join(logDir, 'combined.log')
    }
  ]
});`,

    // Graceful shutdown utility
    'src/utils/gracefulShutdown.ts': `import * as restify from 'restify';
import { logger } from './logger';
import { pool } from '../config/database';

export const gracefulShutdown = async (server: restify.Server, redisClient: any) => {
  logger.info('Received shutdown signal, starting graceful shutdown...');
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Close database connections
  try {
    await pool.end();
    logger.info('Database connections closed');
  } catch (error) {
    logger.error('Error closing database connections:', error);
  }

  // Close Redis connection
  try {
    await redisClient.quit();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
  }

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);

  process.exit(0);
};`,

    // Auth service
    'src/services/auth.service.ts': `import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestError, UnauthorizedError } from 'restify-errors';
import { query } from '../config/database';
import { config } from '../config/config';
import { redisClient } from '../config/redis';

export class AuthService {
  async register(userData: { email: string; password: string; name: string }) {
    const { email, password, name } = userData;

    // Check if user exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new BadRequestError('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = uuidv4();

    // Create user
    const result = await query(
      'INSERT INTO users (id, email, password, name, verification_token) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role',
      [uuidv4(), email, hashedPassword, name, verificationToken]
    );

    const user = result.rows[0];

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Store refresh token
    await this.storeRefreshToken(user.id, refreshToken);

    return {
      user,
      accessToken,
      refreshToken,
      verificationToken
    };
  }

  async login(email: string, password: string) {
    // Find user
    const result = await query(
      'SELECT id, email, password, name, role, is_email_verified FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check if email is verified
    if (!user.is_email_verified) {
      throw new UnauthorizedError('Please verify your email first');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Store refresh token
    await this.storeRefreshToken(user.id, refreshToken);

    delete user.password;
    return {
      user,
      accessToken,
      refreshToken
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.secret) as any;

      // Check if refresh token exists in Redis
      const storedTokens = await redisClient.sMembers(\`refresh_tokens:\${decoded.id}\`);
      if (!storedTokens.includes(refreshToken)) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Get user
      const result = await query(
        'SELECT id, email, role FROM users WHERE id = $1',
        [decoded.id]
      );

      if (result.rows.length === 0) {
        throw new UnauthorizedError('User not found');
      }

      const user = result.rows[0];

      // Generate new access token
      const accessToken = this.generateAccessToken(user);

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    // Remove all refresh tokens
    await redisClient.del(\`refresh_tokens:\${userId}\`);
  }

  async verifyEmail(token: string) {
    const result = await query(
      'UPDATE users SET is_email_verified = true, verification_token = NULL WHERE verification_token = $1 RETURNING id',
      [token]
    );

    if (result.rows.length === 0) {
      throw new BadRequestError('Invalid verification token');
    }
  }

  async forgotPassword(email: string) {
    const result = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new BadRequestError('User not found');
    }

    const resetToken = uuidv4();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await query(
      'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3',
      [resetToken, resetTokenExpiry, email]
    );

    return resetToken;
  }

  async resetPassword(token: string, newPassword: string) {
    const result = await query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expiry > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE reset_token = $2',
      [hashedPassword, token]
    );
  }

  protected generateAccessToken(user: any) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expire }
    );
  }

  protected generateRefreshToken(user: any) {
    return jwt.sign(
      { id: user.id, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshExpire }
    );
  }

  private async storeRefreshToken(userId: string, token: string) {
    await redisClient.sAdd(\`refresh_tokens:\${userId}\`, token);
    await redisClient.expire(\`refresh_tokens:\${userId}\`, 30 * 24 * 60 * 60); // 30 days
  }
}`,

    // Database schema
    'src/scripts/schema.sql': `-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  avatar VARCHAR(500),
  is_email_verified BOOLEAN DEFAULT false,
  verification_token VARCHAR(255),
  reset_token VARCHAR(255),
  reset_token_expiry TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Todos table
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  priority VARCHAR(50) DEFAULT 'medium',
  due_date TIMESTAMP,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_status ON todos(status);
CREATE INDEX idx_todos_priority ON todos(priority);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_todos_updated_at BEFORE UPDATE ON todos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`,

    // Environment variables
    '.env.example': `# Application
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
APP_NAME={{projectName}}
VERSION=1.0.0

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

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
LOG_LEVEL=info
LOG_DIR=logs

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100`,

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

# Copy database scripts
COPY src/scripts ./scripts

# Create upload directory
RUN mkdir -p uploads logs

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    container_name: {{projectName}}-api
    ports:
      - "\${PORT:-3000}:3000"
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
      - ./logs:/app/logs

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
      - ./src/scripts/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
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

    // Mocha test configuration
    '.mocharc.json': `{
  "extension": ["ts"],
  "spec": "test/**/*.spec.ts",
  "require": ["ts-node/register", "source-map-support/register"],
  "timeout": 5000,
  "exit": true,
  "recursive": true,
  "reporter": "spec"
}`,

    // Test setup
    'test/setup.ts': `import * as chai from 'chai';
import chaiHttp from 'chai-http';
import { config } from '../src/config/config';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Use chai-http
chai.use(chaiHttp);

// Export chai
export { chai };`,

    // Example test
    'test/auth.spec.ts': `import { chai } from './setup';
import { server } from '../src/index';
import { pool } from '../src/config/database';

const { expect } = chai;

describe('Auth API', () => {
  beforeEach(async () => {
    // Clean database
    await pool.query('DELETE FROM users');
  });

  after(async () => {
    // Close connections
    server.close();
    await pool.end();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const res = await chai
        .request(server)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test123!',
          name: 'Test User'
        });

      expect(res).to.have.status(201);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data).to.have.property('user');
      expect(res.body.data).to.have.property('accessToken');
      expect(res.body.data).to.have.property('refreshToken');
    });

    it('should return error for duplicate email', async () => {
      // First registration
      await chai
        .request(server)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test123!',
          name: 'Test User'
        });

      // Second registration with same email
      const res = await chai
        .request(server)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test123!',
          name: 'Another User'
        });

      expect(res).to.have.status(400);
      expect(res.body).to.have.property('success', false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Create verified user
      await pool.query(
        'INSERT INTO users (id, email, password, name, is_email_verified) VALUES ($1, $2, $3, $4, $5)',
        ['123e4567-e89b-12d3-a456-426614174000', 'test@example.com', '$2a$10$YourHashedPasswordHere', 'Test User', true]
      );
    });

    it('should login with valid credentials', async () => {
      const res = await chai
        .request(server)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!'
        });

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data).to.have.property('accessToken');
    });

    it('should return error for invalid credentials', async () => {
      const res = await chai
        .request(server)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword'
        });

      expect(res).to.have.status(401);
      expect(res.body).to.have.property('success', false);
    });
  });
});`,

    // README
    'README.md': `# {{projectName}}

Restify REST API server built with TypeScript, optimized for building REST APIs with built-in throttling, DTrace support, and API versioning.

## Features

- 🚀 **Restify** framework optimized for REST APIs
- 🔐 **JWT Authentication** with refresh tokens
- 🗄️ **PostgreSQL** database with raw SQL queries
- 🚦 **Redis** for caching and session management
- 🔄 **Real-time updates** with Socket.IO
- 📚 **API Documentation** with Swagger/OpenAPI
- 🧪 **Testing** with Mocha and Chai
- 🐳 **Docker** support with multi-stage builds
- 📊 **Logging** with Bunyan
- 🛡️ **Security** with CORS, helmet, and rate limiting
- 📤 **File uploads** with Multer
- ✉️ **Email** support
- 🔄 **Hot reload** in development
- 📈 **Built-in metrics** and monitoring
- ⚡ **DTrace** support for performance analysis
- 🔀 **API versioning** support

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
   psql -U your_user -d your_database -f src/scripts/schema.sql
   \`\`\`

5. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

### Running with Docker

\`\`\`bash
docker-compose up
\`\`\`

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:3000/api-docs
- OpenAPI JSON: http://localhost:3000/api-docs.json

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
- \`npm run lint\` - Run ESLint
- \`npm test\` - Run tests
- \`npm run typecheck\` - Type check without building

## API Endpoints

### Authentication
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login user
- \`POST /api/v1/auth/refresh\` - Refresh access token
- \`POST /api/v1/auth/logout\` - Logout user
- \`GET /api/v1/auth/verify/:token\` - Verify email
- \`POST /api/v1/auth/forgot-password\` - Request password reset
- \`POST /api/v1/auth/reset-password/:token\` - Reset password

### Users
- \`GET /api/v1/users\` - Get all users (admin only)
- \`GET /api/v1/users/me\` - Get current user
- \`GET /api/v1/users/:id\` - Get user by ID
- \`PUT /api/v1/users/:id\` - Update user
- \`DELETE /api/v1/users/:id\` - Delete user (admin only)
- \`POST /api/v1/users/change-password\` - Change password
- \`POST /api/v1/users/avatar\` - Upload avatar

### Todos
- \`GET /api/v1/todos\` - Get all todos
- \`GET /api/v1/todos/:id\` - Get todo by ID
- \`POST /api/v1/todos\` - Create todo
- \`PUT /api/v1/todos/:id\` - Update todo
- \`DELETE /api/v1/todos/:id\` - Delete todo
- \`POST /api/v1/todos/bulk/delete\` - Bulk delete todos
- \`POST /api/v1/todos/bulk/update\` - Bulk update todos

### Health & Monitoring
- \`GET /health\` - Health check
- \`GET /metrics\` - Server metrics (authenticated)

## Project Structure

\`\`\`
src/
├── config/         # Configuration files
├── controllers/    # Request handlers
├── middlewares/    # Custom middlewares
├── models/         # Data models
├── routes/         # API routes
├── scripts/        # Database scripts
├── services/       # Business logic
├── types/          # TypeScript types
├── utils/          # Utility functions
├── validators/     # Request validators
└── index.ts        # Application entry point
\`\`\`

## License

MIT
`
  }
};