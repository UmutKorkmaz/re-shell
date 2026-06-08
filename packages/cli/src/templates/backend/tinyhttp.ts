import { BackendTemplate } from '../types';

export const tinyhttpTemplate: BackendTemplate = {
  id: 'tinyhttp',
  name: 'tinyhttp',
  displayName: 'Tinyhttp',
  description: 'Modern Express-like web framework with ES modules, TypeScript-first design, and 35% less overhead',
  language: 'typescript',
  framework: 'tinyhttp',
  version: '2.2.2',
  tags: ['nodejs', 'tinyhttp', 'api', 'rest', 'modern', 'fast'],
  port: 3000,
  dependencies: {},
  features: ['rest-api', 'middleware', 'routing', 'cors', 'authentication', 'validation', 'websockets', 'database', 'rate-limiting', 'testing'],
  
  files: {
    // TypeScript project configuration with ES modules
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "Modern Tinyhttp API server with TypeScript and ES modules",
  "type": "module",
  "main": "dist/index.js",
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "docker:build": "docker build -t {{projectName}} .",
    "docker:run": "docker run -p 3000:3000 {{projectName}}"
  },
  "dependencies": {
    "@tinyhttp/app": "^2.2.2",
    "@tinyhttp/cors": "^2.0.0",
    "@tinyhttp/logger": "^2.0.0",
    "@tinyhttp/cookie-parser": "^2.1.0",
    "@tinyhttp/session": "^2.1.0",
    "@tinyhttp/jwt": "^2.1.0",
    "@tinyhttp/etag": "^2.1.0",
    "@tinyhttp/compression": "^2.0.0",
    "@tinyhttp/rate-limit": "^2.0.2",
    "@tinyhttp/helmet": "^2.0.0",
    "@tinyhttp/unless": "^2.1.1",
    "milliparsec": "^2.3.0",
    "sirv": "^2.0.4",
    "eta": "^3.4.0",
    "database": "^6.5.0",
    "mongoose": "^8.3.1",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.22.4",
    "dotenv": "^16.4.5",
    "pino": "^8.19.0",
    "pino-pretty": "^11.0.0",
    "ioredis": "^5.3.2",
    "ws": "^8.16.0",
    "@tinyhttp/ws": "^0.2.30",
    "nanoid": "^5.0.7",
    "dayjs": "^1.11.10",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "@types/node": "^20.12.7",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/ws": "^8.5.10",
    "@typescript-eslint/eslint-plugin": "^7.7.1",
    "@typescript-eslint/parser": "^7.7.1",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.2.5",
    "rest-api": "^5.4.5",
    "tsx": "^4.7.2",
    "vitest": "^1.5.0",
    "@vitest/coverage-v8": "^1.5.0",
    "@vitest/ui": "^1.5.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2"
  }
}`,

    // TypeScript configuration for ES modules
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
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
      "@types/*": ["src/types/*"]
    },
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "coverage"]
}`,

    // Main application entry point
    'src/index.ts': `import { App } from '@tinyhttp/app';
import { cors } from '@tinyhttp/cors';
import { logger } from '@tinyhttp/logger';
import { cookieParser } from '@tinyhttp/cookie-parser';
import { compression } from '@tinyhttp/compression';
import { helmet } from '@tinyhttp/helmet';
import { rateLimit } from '@tinyhttp/rate-limit';
import { json } from 'milliparsec';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { config } from 'dotenv';
import { connectDatabase } from './config/database.js';
import { connectRedis } from './config/redis.js';
import { setupWebSocket } from './config/websocket.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { notFoundHandler } from './middlewares/notFound.middleware.js';
import { requestLogger } from './middlewares/logger.middleware.js';
import { logger as log } from './utils/logger.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import todoRoutes from './routes/todo.routes.js';

// Load environment variables
config();

const app = new App();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = createServer();

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Setup WebSocket
setupWebSocket(wss);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true
}));

// Body parsing middleware
app.use(json());
app.use(cookieParser());

// Compression middleware
app.use(compression());

// Request logging
app.use(logger({
  timestamp: { format: 'HH:mm:ss' },
  colorize: true,
  emoji: true
}));
app.use(requestLogger);

// Rate limiting
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP'
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API info endpoint
app.get('/api/v1', (req, res) => {
  res.json({
    message: '{{projectName}} API',
    version: '1.0.0',
    framework: 'Tinyhttp',
    performance: '35% faster than Express',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      todos: '/api/v1/todos',
      websocket: 'ws://localhost:3000',
      health: '/health'
    }
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/todos', todoRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Attach app to server
server.on('request', app.handler.bind(app));

// Graceful shutdown
process.on('SIGTERM', async () => {
  log.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    log.info('HTTP server closed');
  });
  
  // Close WebSocket connections
  wss.clients.forEach((client) => {
    client.close();
  });
  
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();
    
    // Connect to Redis
    await connectRedis();
    
    server.listen(PORT, () => {
      log.info(\`🚀 Server is running on port \${PORT}\`);
      log.info(\`⚡ Using Tinyhttp - 35% faster than Express\`);
      log.info(\`📦 ES Modules enabled\`);
      log.info(\`🔧 Environment: \${process.env.NODE_ENV || 'development'}\`);
    });
  } catch (error) {
    log.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { app, wss };`,

    // Authentication routes
    'src/routes/auth.routes.ts': `import { App } from '@tinyhttp/app';
import { z } from 'zod';
import { validate } from '../middlewares/validate.middleware.js';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = new App();
const authController = new AuthController();

// Validation schemas
const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1)
  })
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string()
  })
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email()
  })
});

const resetPasswordSchema = z.object({
  params: z.object({
    token: z.string()
  }),
  body: z.object({
    password: z.string().min(8)
  })
});

// Routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authenticate, authController.logout);
router.get('/verify/:token', authController.verifyEmail);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password/:token', validate(resetPasswordSchema), authController.resetPassword);

export default router;`,

    // User routes
    'src/routes/user.routes.ts': `import { App } from '@tinyhttp/app';
import { z } from 'zod';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { UserController } from '../controllers/user.controller.js';

const router = new App();
const userController = new UserController();

// Validation schemas
const updateUserSchema = z.object({
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    email: z.string().email().optional(),
    name: z.string().min(1).optional()
  })
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8)
  })
});

// Routes
router.get('/', authenticate, authorize('admin'), userController.getAllUsers);
router.get('/me', authenticate, userController.getCurrentUser);
router.get('/:id', authenticate, userController.getUserById);
router.put('/:id', authenticate, validate(updateUserSchema), userController.updateUser);
router.delete('/:id', authenticate, authorize('admin'), userController.deleteUser);
router.post('/change-password', authenticate, validate(changePasswordSchema), userController.changePassword);
router.post('/avatar', authenticate, userController.uploadAvatar);

export default router;`,

    // Todo routes
    'src/routes/todo.routes.ts': `import { App } from '@tinyhttp/app';
import { z } from 'zod';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { TodoController } from '../controllers/todo.controller.js';

const router = new App();
const todoController = new TodoController();

// Apply authentication to all routes
router.use(authenticate);

// Validation schemas
const createTodoSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    dueDate: z.string().datetime().optional()
  })
});

const updateTodoSchema = z.object({
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    status: z.enum(['pending', 'in_progress', 'completed']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    dueDate: z.string().datetime().optional()
  })
});

const querySchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
    status: z.enum(['pending', 'in_progress', 'completed']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional()
  })
});

// Routes
router.get('/', validate(querySchema), todoController.getAllTodos);
router.get('/:id', todoController.getTodoById);
router.post('/', validate(createTodoSchema), todoController.createTodo);
router.put('/:id', validate(updateTodoSchema), todoController.updateTodo);
router.delete('/:id', todoController.deleteTodo);
router.post('/bulk/delete', todoController.bulkDelete);
router.post('/bulk/update', todoController.bulkUpdate);

export default router;`,

    // Authentication controller
    'src/controllers/auth.controller.ts': `import { Request, Response } from '@tinyhttp/app';
import { AuthService } from '../services/auth.service.js';
import { EmailService } from '../services/email.service.js';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export class AuthController {
  private authService: AuthService;
  private emailService: EmailService;

  constructor() {
    this.authService = new AuthService();
    this.emailService = new EmailService();
  }

  register = asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name } = req.body;

    const result = await this.authService.register({ email, password, name });

    // Send verification email
    await this.emailService.sendVerificationEmail(email, result.verificationToken);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      }
    });
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const result = await this.authService.login(email, password);

    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        accessToken: result.accessToken
      }
    });
  });

  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      res.status(401);
      throw new Error('Refresh token not provided');
    }

    const result = await this.authService.refreshToken(refreshToken);

    res.json({
      success: true,
      data: {
        accessToken: result.accessToken
      }
    });
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (userId) {
      await this.authService.logout(userId);
    }

    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Logout successful'
    });
  });

  verifyEmail = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    await this.authService.verifyEmail(token);

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  });

  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    const resetToken = await this.authService.forgotPassword(email);

    // Send reset email
    await this.emailService.sendPasswordResetEmail(email, resetToken);

    res.json({
      success: true,
      message: 'Password reset email sent'
    });
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const { password } = req.body;

    await this.authService.resetPassword(token, password);

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  });
}`,

    // User controller
    'src/controllers/user.controller.ts': `import { Request, Response } from '@tinyhttp/app';
import { UserService } from '../services/user.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadSingle } from '../utils/upload.js';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  getAllUsers = asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 10, search } = req.query;

    const result = await this.userService.getAllUsers({
      page: Number(page),
      limit: Number(limit),
      search: search as string
    });

    res.json({
      success: true,
      data: result
    });
  });

  getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const user = await this.userService.getUserById(userId);

    res.json({
      success: true,
      data: user
    });
  });

  getUserById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await this.userService.getUserById(id);

    res.json({
      success: true,
      data: user
    });
  });

  updateUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    // Ensure users can only update their own profile unless admin
    if (req.user!.id !== id && req.user!.role !== 'admin') {
      res.status(403);
      throw new Error('Forbidden');
    }

    const user = await this.userService.updateUser(id, updates);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  });

  deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await this.userService.deleteUser(id);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  });

  changePassword = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;

    await this.userService.changePassword(userId, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  });

  uploadAvatar = [
    uploadSingle('avatar'),
    asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user!.id;

      if (!req.file) {
        res.status(400);
        throw new Error('No file uploaded');
      }

      const avatarUrl = await this.userService.updateAvatar(userId, req.file);

      res.json({
        success: true,
        message: 'Avatar uploaded successfully',
        data: { avatarUrl }
      });
    })
  ];
}`,

    // Todo controller
    'src/controllers/todo.controller.ts': `import { Request, Response } from '@tinyhttp/app';
import { TodoService } from '../services/todo.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { broadcastToUser } from '../config/websocket.js';

export class TodoController {
  private todoService: TodoService;

  constructor() {
    this.todoService = new TodoService();
  }

  getAllTodos = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { page = 1, limit = 10, status, priority } = req.query;

    const result = await this.todoService.getAllTodos({
      userId,
      page: Number(page),
      limit: Number(limit),
      status: status as string,
      priority: priority as string
    });

    res.json({
      success: true,
      data: result
    });
  });

  getTodoById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    const todo = await this.todoService.getTodoById(id, userId);

    res.json({
      success: true,
      data: todo
    });
  });

  createTodo = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const todoData = { ...req.body, userId };

    const todo = await this.todoService.createTodo(todoData);

    // Broadcast to WebSocket clients
    broadcastToUser(userId, 'todo:created', todo);

    res.status(201).json({
      success: true,
      message: 'Todo created successfully',
      data: todo
    });
  });

  updateTodo = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;
    const updates = req.body;

    const todo = await this.todoService.updateTodo(id, userId, updates);

    // Broadcast to WebSocket clients
    broadcastToUser(userId, 'todo:updated', todo);

    res.json({
      success: true,
      message: 'Todo updated successfully',
      data: todo
    });
  });

  deleteTodo = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    await this.todoService.deleteTodo(id, userId);

    // Broadcast to WebSocket clients
    broadcastToUser(userId, 'todo:deleted', { id });

    res.json({
      success: true,
      message: 'Todo deleted successfully'
    });
  });

  bulkDelete = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400);
      throw new Error('Invalid todo IDs');
    }

    const count = await this.todoService.bulkDelete(ids, userId);

    // Broadcast to WebSocket clients
    broadcastToUser(userId, 'todos:bulk-deleted', { ids, count });

    res.json({
      success: true,
      message: \`\${count} todos deleted successfully\`
    });
  });

  bulkUpdate = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { ids, updates } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400);
      throw new Error('Invalid todo IDs');
    }

    const count = await this.todoService.bulkUpdate(ids, userId, updates);

    // Broadcast to WebSocket clients
    broadcastToUser(userId, 'todos:bulk-updated', { ids, updates, count });

    res.json({
      success: true,
      message: \`\${count} todos updated successfully\`
    });
  });
}`,

    // Authentication middleware
    'src/middlewares/auth.middleware.ts': `import { Request, Response, NextHandler } from '@tinyhttp/app';
import jwt from 'jsonwebtoken';
import { UserService } from '../services/user.service.js';

interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

declare module '@tinyhttp/app' {
  interface Request {
    user?: JwtPayload;
  }
}

const userService = new UserService();

export const authenticate = async (req: Request, res: Response, next: NextHandler) => {
  try {
    let token: string | undefined;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401);
      throw new Error('Not authorized, no token');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    // Check if user still exists
    const user = await userService.getUserById(decoded.id);
    if (!user) {
      res.status(401);
      throw new Error('User no longer exists');
    }

    // Attach user to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        message: 'Not authorized',
        status: 401
      }
    });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextHandler) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Not authenticated',
          status: 401
        }
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Not authorized for this resource',
          status: 403
        }
      });
    }

    next();
  };
};`,

    // Error handling middleware
    'src/middlewares/error.middleware.ts': `import { Request, Response, NextHandler } from '@tinyhttp/app';
import { logger } from '../utils/logger.js';

interface ErrorWithStatus extends Error {
  status?: number;
  code?: string;
}

export const errorHandler = (
  err: ErrorWithStatus,
  req: Request,
  res: Response,
  next: NextHandler
) => {
  let status = err.status || res.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // MongoDB duplicate key error
  if (err.code === '11000') {
    status = 400;
    message = 'Duplicate field value';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired';
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    status = 400;
    message = 'Validation error';
  }

  // Log error
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    status
  });

  res.status(status).json({
    success: false,
    error: {
      message,
      status,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};`,

    // Not found middleware
    'src/middlewares/notFound.middleware.ts': `import { Request, Response } from '@tinyhttp/app';

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Resource not found',
      status: 404,
      path: req.originalUrl
    }
  });
};`,

    // Validation middleware
    'src/middlewares/validate.middleware.ts': `import { Request, Response, NextHandler } from '@tinyhttp/app';
import { z, ZodError, ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextHandler) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Validation failed',
            status: 400,
            details: error.errors
          }
        });
      } else {
        next(error);
      }
    }
  };
};`,

    // Logger middleware
    'src/middlewares/logger.middleware.ts': `import { Request, Response, NextHandler } from '@tinyhttp/app';
import { logger } from '../utils/logger.js';
import { nanoid } from 'nanoid';

export const requestLogger = (req: Request, res: Response, next: NextHandler) => {
  const requestId = nanoid(10);
  const start = Date.now();

  // Attach request ID
  req.id = requestId;

  // Log request
  logger.info({
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  // Log response
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - start;
    
    logger.info({
      requestId,
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: \`\${duration}ms\`
    });

    return originalSend.call(this, data);
  };

  next();
};`,

    // MongoDB configuration
    'src/config/database.ts': `import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

export const connectDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/{{projectName}}';
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10
    });

    logger.info('MongoDB connected successfully');

    // Handle connection events
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    throw error;
  }
};

// Graceful shutdown
export const disconnectDatabase = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error('Error disconnecting MongoDB:', error);
  }
};`,

    // User model
    'src/models/user.model.ts': `import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  role: 'user' | 'admin';
  avatar?: string;
  isEmailVerified: boolean;
  verificationToken?: string;
  resetToken?: string;
  resetTokenExpiry?: Date;
  refreshTokens: string[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  avatar: String,
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  resetToken: String,
  resetTokenExpiry: Date,
  refreshTokens: [{
    type: String
  }]
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ email: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive fields from JSON
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokens;
  delete obj.verificationToken;
  delete obj.resetToken;
  delete obj.resetTokenExpiry;
  return obj;
};

export const User = mongoose.model<IUser>('User', userSchema);`,

    // Todo model
    'src/models/todo.model.ts': `import mongoose, { Schema, Document } from 'mongoose';

export interface ITodo extends Document {
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const todoSchema = new Schema<ITodo>({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  dueDate: Date,
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
todoSchema.index({ userId: 1, status: 1 });
todoSchema.index({ userId: 1, priority: 1 });
todoSchema.index({ userId: 1, dueDate: 1 });

export const Todo = mongoose.model<ITodo>('Todo', todoSchema);`,

    // Redis configuration
    'src/config/redis.ts': `import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  }
});

redis.on('connect', () => {
  logger.info('Redis client connected');
});

redis.on('error', (err) => {
  logger.error('Redis client error:', err);
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

export const connectRedis = async () => {
  try {
    await redis.ping();
    logger.info('Redis connection verified');
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

// Cache utilities
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  },

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await redis.setex(key, ttl, serialized);
    } else {
      await redis.set(key, serialized);
    }
  },

  async del(key: string): Promise<void> {
    await redis.del(key);
  },

  async delPattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
};`,

    // WebSocket configuration
    'src/config/websocket.ts': `import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { parse } from 'url';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

const clients = new Map<string, Set<AuthenticatedWebSocket>>();

export const setupWebSocket = (wss: WebSocketServer) => {
  // Heartbeat interval
  const interval = setInterval(() => {
    wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
    try {
      // Parse token from query string
      const { query } = parse(req.url || '', true);
      const token = query.token as string;

      if (!token) {
        ws.close(1008, 'Missing authentication token');
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      ws.userId = decoded.id;

      // Add to clients map
      if (!clients.has(ws.userId)) {
        clients.set(ws.userId, new Set());
      }
      clients.get(ws.userId)!.add(ws);

      // Setup heartbeat
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      logger.info(\`WebSocket client connected: \${ws.userId}\`);

      // Handle messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          handleWebSocketMessage(ws, message);
        } catch (error) {
          logger.error('Invalid WebSocket message:', error);
        }
      });

      // Handle close
      ws.on('close', () => {
        if (ws.userId && clients.has(ws.userId)) {
          clients.get(ws.userId)!.delete(ws);
          if (clients.get(ws.userId)!.size === 0) {
            clients.delete(ws.userId);
          }
        }
        logger.info(\`WebSocket client disconnected: \${ws.userId}\`);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        userId: ws.userId,
        timestamp: new Date().toISOString()
      }));

    } catch (error) {
      logger.error('WebSocket authentication failed:', error);
      ws.close(1008, 'Invalid authentication token');
    }
  });

  wss.on('close', () => {
    clearInterval(interval);
  });
};

// Handle incoming WebSocket messages
const handleWebSocketMessage = (ws: AuthenticatedWebSocket, message: any) => {
  const { type, data } = message;

  switch (type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;
    
    case 'subscribe':
      // Handle subscription to specific events
      logger.info(\`User \${ws.userId} subscribed to: \${data.event}\`);
      break;
    
    default:
      logger.warn(\`Unknown WebSocket message type: \${type}\`);
  }
};

// Broadcast to specific user
export const broadcastToUser = (userId: string, event: string, data: any) => {
  const userClients = clients.get(userId);
  
  if (userClients) {
    const message = JSON.stringify({ type: event, data, timestamp: Date.now() });
    
    userClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
};

// Broadcast to all connected clients
export const broadcast = (event: string, data: any) => {
  const message = JSON.stringify({ type: event, data, timestamp: Date.now() });
  
  clients.forEach((userClients) => {
    userClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
};`,

    // Authentication service
    'src/services/auth.service.ts': `import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { User, IUser } from '../models/user.model.js';
import { redis } from '../config/redis.js';
import { logger } from '../utils/logger.js';

export class AuthService {
  async register(data: { email: string; password: string; name: string }) {
    // Check if user exists
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Create verification token
    const verificationToken = nanoid(32);

    // Create user
    const user = await User.create({
      ...data,
      verificationToken
    });

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Save refresh token
    user.refreshTokens.push(refreshToken);
    await user.save();

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken,
      verificationToken
    };
  }

  async login(email: string, password: string) {
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new Error('Please verify your email first');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Save refresh token
    user.refreshTokens.push(refreshToken);
    await user.save();

    // Cache user data
    await redis.setex(\`user:\${user.id}\`, 3600, JSON.stringify(user.toJSON()));

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;

      // Find user and check if refresh token exists
      const user = await User.findById(decoded.id);
      if (!user || !user.refreshTokens.includes(refreshToken)) {
        throw new Error('Invalid refresh token');
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(user);

      return { accessToken };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    // Remove all refresh tokens
    await User.findByIdAndUpdate(userId, {
      $set: { refreshTokens: [] }
    });

    // Clear cache
    await redis.del(\`user:\${userId}\`);
  }

  async verifyEmail(token: string) {
    const user = await User.findOne({ verificationToken: token });
    
    if (!user) {
      throw new Error('Invalid verification token');
    }

    user.isEmailVerified = true;
    user.verificationToken = undefined;
    await user.save();

    return user.toJSON();
  }

  async forgotPassword(email: string) {
    const user = await User.findOne({ email });
    
    if (!user) {
      // Don't reveal if user exists
      return nanoid(32);
    }

    // Generate reset token
    const resetToken = nanoid(32);
    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    return resetToken;
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    user.password = newPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    user.refreshTokens = []; // Invalidate all refresh tokens
    await user.save();

    return user.toJSON();
  }

  protected generateAccessToken(user: IUser): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );
  }

  protected generateRefreshToken(user: IUser): string {
    return jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );
  }
}`,

    // User service
    'src/services/user.service.ts': `import { User } from '../models/user.model.js';
import { cache } from '../config/redis.js';

export class UserService {
  async getAllUsers(options: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = options;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query).skip(skip).limit(limit).sort('-createdAt'),
      User.countDocuments(query)
    ]);

    return {
      users: users.map(u => u.toJSON()),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getUserById(id: string) {
    // Check cache first
    const cached = await cache.get<any>(\`user:\${id}\`);
    if (cached) return cached;

    const user = await User.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    const userData = user.toJSON();
    
    // Cache for 1 hour
    await cache.set(\`user:\${id}\`, userData, 3600);

    return userData;
  }

  async updateUser(id: string, updates: any) {
    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new Error('User not found');
    }

    // Invalidate cache
    await cache.del(\`user:\${id}\`);

    return user.toJSON();
  }

  async deleteUser(id: string) {
    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Invalidate cache
    await cache.del(\`user:\${id}\`);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    user.password = newPassword;
    user.refreshTokens = []; // Invalidate all refresh tokens
    await user.save();

    // Invalidate cache
    await cache.del(\`user:\${userId}\`);
  }

  async updateAvatar(userId: string, file: any) {
    // In production, upload to cloud storage (S3, Cloudinary, etc.)
    const avatarUrl = \`/uploads/avatars/\${file.filename}\`;

    await this.updateUser(userId, { avatar: avatarUrl });

    return avatarUrl;
  }
}`,

    // Todo service
    'src/services/todo.service.ts': `import { Todo } from '../models/todo.model.js';
import { cache } from '../config/redis.js';

export class TodoService {
  async getAllTodos(options: {
    userId: string;
    page: number;
    limit: number;
    status?: string;
    priority?: string;
  }) {
    const { userId, page, limit, status, priority } = options;
    const skip = (page - 1) * limit;

    const query: any = { userId };
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const [todos, total] = await Promise.all([
      Todo.find(query).skip(skip).limit(limit).sort('-createdAt'),
      Todo.countDocuments(query)
    ]);

    return {
      todos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getTodoById(id: string, userId: string) {
    const todo = await Todo.findOne({ _id: id, userId });
    
    if (!todo) {
      throw new Error('Todo not found');
    }

    return todo;
  }

  async createTodo(data: any) {
    const todo = await Todo.create(data);
    
    // Invalidate user's todo list cache
    await cache.delPattern(\`todos:\${data.userId}:*\`);

    return todo;
  }

  async updateTodo(id: string, userId: string, updates: any) {
    const todo = await Todo.findOneAndUpdate(
      { _id: id, userId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!todo) {
      throw new Error('Todo not found');
    }

    // Invalidate cache
    await cache.delPattern(\`todos:\${userId}:*\`);

    return todo;
  }

  async deleteTodo(id: string, userId: string) {
    const todo = await Todo.findOneAndDelete({ _id: id, userId });
    
    if (!todo) {
      throw new Error('Todo not found');
    }

    // Invalidate cache
    await cache.delPattern(\`todos:\${userId}:*\`);
  }

  async bulkDelete(ids: string[], userId: string) {
    const result = await Todo.deleteMany({
      _id: { $in: ids },
      userId
    });

    // Invalidate cache
    await cache.delPattern(\`todos:\${userId}:*\`);

    return result.deletedCount;
  }

  async bulkUpdate(ids: string[], userId: string, updates: any) {
    const result = await Todo.updateMany(
      {
        _id: { $in: ids },
        userId
      },
      { $set: updates }
    );

    // Invalidate cache
    await cache.delPattern(\`todos:\${userId}:*\`);

    return result.modifiedCount;
  }
}`,

    // Email service (stub)
    'src/services/email.service.ts': `import { logger } from '../utils/logger.js';

export class EmailService {
  async sendVerificationEmail(email: string, token: string) {
    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    logger.info(\`Sending verification email to \${email} with token: \${token}\`);
    
    // Example with nodemailer:
    // const verificationUrl = \`\${process.env.APP_URL}/verify-email?token=\${token}\`;
    // await this.sendEmail({
    //   to: email,
    //   subject: 'Verify your email',
    //   html: \`Click <a href="\${verificationUrl}">here</a> to verify your email.\`
    // });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    logger.info(\`Sending password reset email to \${email} with token: \${token}\`);
    
    // const resetUrl = \`\${process.env.APP_URL}/reset-password?token=\${token}\`;
    // await this.sendEmail({
    //   to: email,
    //   subject: 'Reset your password',
    //   html: \`Click <a href="\${resetUrl}">here</a> to reset your password.\`
    // });
  }

  private async sendEmail(options: { to: string; subject: string; html: string }) {
    // Implement email sending logic
    logger.info(\`Email would be sent to: \${options.to}\`);
  }
}`,

    // Logger utility
    'src/utils/logger.ts': `import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined,
  serializers: {
    error: pino.stdSerializers.err
  }
});`,

    // Async handler utility
    'src/utils/asyncHandler.ts': `import { Request, Response, NextHandler } from '@tinyhttp/app';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextHandler
) => Promise<any>;

export const asyncHandler = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextHandler) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};`,

    // Upload utility
    'src/utils/upload.ts': `import multer from 'multer';
import { nanoid } from 'nanoid';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = nanoid();
    cb(null, \`\${uniqueSuffix}-\${file.originalname}\`);
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

export const uploadSingle = (fieldName: string) => upload.single(fieldName);
export const uploadMultiple = (fieldName: string, maxCount: number) => 
  upload.array(fieldName, maxCount);`,

    // Environment variables
    '.env.example': `# Application
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/{{projectName}}

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# Logging
LOG_LEVEL=debug

# File Upload
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880`,

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

# Install dumb-init for proper signal handling
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

# Create uploads directory
RUN mkdir -p uploads && chown -R nodejs:nodejs uploads

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1))"

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
      - MONGODB_URI=mongodb://mongodb:27017/{{projectName}}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongodb
      - redis
    restart: unless-stopped
    networks:
      - app-network
    volumes:
      - ./uploads:/app/uploads

  mongodb:
    image: mongo:7-jammy
    container_name: {{projectName}}-mongodb
    ports:
      - "\${MONGO_PORT:-27017}:27017"
    environment:
      - MONGO_INITDB_DATABASE={{projectName}}
    volumes:
      - mongodb-data:/data/db
      - mongodb-config:/data/configdb
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
  mongodb-data:
  mongodb-config:
  redis-data:

networks:
  app-network:
    driver: bridge`,

    // Nginx configuration
    'nginx.conf': `events {
  worker_connections 1024;
}

http {
  upstream app {
    server app:3000;
  }

  server {
    listen 80;
    server_name localhost;

    # Redirect HTTP to HTTPS in production
    # return 301 https://$server_name$request_uri;

    location / {
      proxy_pass http://app;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection 'upgrade';
      proxy_set_header Host $host;
      proxy_cache_bypass $http_upgrade;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws {
      proxy_pass http://app;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }

  # HTTPS configuration (uncomment in production)
  # server {
  #   listen 443 ssl http2;
  #   server_name localhost;
  #
  #   ssl_certificate /etc/nginx/ssl/cert.pem;
  #   ssl_certificate_key /etc/nginx/ssl/key.pem;
  #
  #   # Same location blocks as above
  # }
}`,

    // Vitest configuration
    'vitest.config.ts': `import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts'
      ]
    },
    setupFiles: ['./src/__tests__/setup.ts']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@config': path.resolve(__dirname, './src/config'),
      '@controllers': path.resolve(__dirname, './src/controllers'),
      '@middlewares': path.resolve(__dirname, './src/middlewares'),
      '@models': path.resolve(__dirname, './src/models'),
      '@routes': path.resolve(__dirname, './src/routes'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types')
    }
  }
});`,

    // Test setup
    'src/__tests__/setup.ts': `import { beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});`,

    // Example test
    'src/__tests__/auth.test.ts': `import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { User } from '../models/user.model.js';

describe('Auth API', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app.handler)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('should not register user with existing email', async () => {
      await User.create({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      const res = await request(app.handler)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Another User'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      const user = new User({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        isEmailVerified: true
      });
      await user.save();
    });

    it('should login with valid credentials', async () => {
      const res = await request(app.handler)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('should not login with invalid password', async () => {
      const res = await request(app.handler)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});`,

    // README
    'README.md': `# {{projectName}}

Modern Tinyhttp API server built with TypeScript, featuring ES modules, MongoDB integration, and real-time WebSocket support.

## Features

- 🚀 **Tinyhttp** - Modern Express alternative with 35% less overhead
- 📦 **ES Modules** - Native JavaScript modules support
- 🔷 **TypeScript** - Type-safe development with better IDE support
- 🔐 **JWT Authentication** - Secure authentication with refresh tokens
- 🗄️ **MongoDB** - Document database with Mongoose ODM
- 🚦 **Redis** - High-performance caching and session storage
- 🔄 **WebSocket** - Real-time bidirectional communication
- 🧪 **Vitest** - Blazing fast unit testing
- 🐳 **Docker** - Containerized deployment ready
- 📊 **Logging** - Structured logging with Pino
- 🛡️ **Security** - Helmet, CORS, and rate limiting
- ✉️ **Email** - Email service integration ready

## Performance

Tinyhttp provides significant performance improvements over Express:
- 35% less overhead
- Faster routing
- Better TypeScript support
- Smaller bundle size
- Modern codebase

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB
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

4. Start MongoDB and Redis locally or via Docker

5. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

### Running with Docker

\`\`\`bash
docker-compose up
\`\`\`

## API Endpoints

- **Auth**: \`/api/v1/auth\`
  - POST \`/register\` - Register new user
  - POST \`/login\` - Login user
  - POST \`/refresh\` - Refresh access token
  - POST \`/logout\` - Logout user
  - GET \`/verify/:token\` - Verify email
  - POST \`/forgot-password\` - Request password reset
  - POST \`/reset-password/:token\` - Reset password

- **Users**: \`/api/v1/users\`
  - GET \`/\` - Get all users (admin only)
  - GET \`/me\` - Get current user
  - GET \`/:id\` - Get user by ID
  - PUT \`/:id\` - Update user
  - DELETE \`/:id\` - Delete user (admin only)
  - POST \`/change-password\` - Change password
  - POST \`/avatar\` - Upload avatar

- **Todos**: \`/api/v1/todos\`
  - GET \`/\` - Get all todos
  - GET \`/:id\` - Get todo by ID
  - POST \`/\` - Create todo
  - PUT \`/:id\` - Update todo
  - DELETE \`/:id\` - Delete todo
  - POST \`/bulk/delete\` - Bulk delete todos
  - POST \`/bulk/update\` - Bulk update todos

## WebSocket Events

Connect to WebSocket: \`ws://localhost:3000?token=YOUR_JWT_TOKEN\`

Events:
- \`todo:created\` - New todo created
- \`todo:updated\` - Todo updated
- \`todo:deleted\` - Todo deleted
- \`todos:bulk-deleted\` - Multiple todos deleted
- \`todos:bulk-updated\` - Multiple todos updated

## Testing

\`\`\`bash
# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
\`\`\`

## Scripts

- \`npm run dev\` - Start development server with hot reload
- \`npm run build\` - Build for production
- \`npm start\` - Start production server
- \`npm run lint\` - Run ESLint
- \`npm test\` - Run tests
- \`npm run typecheck\` - Type check without building

## Project Structure

\`\`\`
src/
├── config/         # Configuration files
├── controllers/    # Route controllers
├── middlewares/    # Tinyhttp middlewares
├── models/         # MongoDB models
├── routes/         # API routes
├── services/       # Business logic
├── utils/          # Utility functions
├── __tests__/      # Test files
└── index.ts        # Application entry point
\`\`\`

## Why Tinyhttp?

- **Modern**: Built with ES modules and modern JavaScript
- **Fast**: 35% less overhead than Express
- **TypeScript First**: Better type inference and IDE support
- **Lightweight**: Smaller bundle size
- **Compatible**: Works with Express middleware
- **Active**: Actively maintained and improved

## License

MIT
`
  }
};