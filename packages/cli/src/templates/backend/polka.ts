import { BackendTemplate } from '../types';

export const polkaTemplate: BackendTemplate = {
  id: 'polka',
  name: 'polka',
  displayName: 'Polka',
  description: 'Micro web server with minimal overhead (5x faster than Express) for high-performance APIs',
  language: 'typescript',
  framework: 'polka',
  version: '1.0.0-next.23',
  tags: ['nodejs', 'polka', 'micro', 'api', 'high-performance', 'minimal', 'typescript'],
  port: 3000,
  dependencies: {},
  features: ['rest-api', 'routing', 'middleware', 'file-upload', 'websockets', 'session-management', 'cors', 'middleware'],
  
  files: {
    // TypeScript project configuration
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "High-performance micro web server built with Polka and TypeScript",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts",
    "test": "uvu tests",
    "test:coverage": "c8 npm test",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "docker:build": "docker build -t {{projectName}} .",
    "docker:run": "docker run -p 3000:3000 {{projectName}}"
  },
  "dependencies": {
    "polka": "^1.0.0-next.23",
    "@polka/send-type": "^1.0.0-next.12",
    "@polka/redirect": "^1.0.0-next.12",
    "@polka/compression": "^1.0.0-next.12",
    "@polka/url": "^1.0.0-next.23",
    "sirv": "^2.0.4",
    "trouter": "^3.2.1",
    "mrmime": "^2.0.0",
    "regexparam": "^3.0.0",
    "body-parser": "^1.20.2",
    "cookie-parser": "^1.4.6",
    "express-session": "^1.18.0",
    "connect-redis": "^7.1.1",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.4.5",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "ioredis": "^5.3.2",
    "ws": "^8.17.0",
    "uWebSockets.js": "github:uNetworking/uWebSockets.js#v20.43.0",
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0",
    "@prisma/client": "^5.13.0",
    "database": "^5.13.0",
    "zod": "^3.23.5",
    "nanoid": "^5.0.7"
  },
  "devDependencies": {
    "@types/node": "^20.12.7",
    "@types/body-parser": "^1.19.5",
    "@types/cookie-parser": "^1.4.7",
    "@types/cors": "^2.8.17",
    "@types/express-session": "^1.17.10",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/ws": "^8.5.10",
    "@typescript-eslint/eslint-plugin": "^7.7.1",
    "@typescript-eslint/parser": "^7.7.1",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.2.5",
    "typescript": "^5.4.5",
    "tsx": "^4.7.2",
    "uvu": "^0.5.6",
    "c8": "^9.1.0",
    "httpie": "^1.1.2",
    "superstruct": "^1.0.4"
  }
}`,

    // TypeScript configuration
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
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
      "@handlers/*": ["src/handlers/*"],
      "@middlewares/*": ["src/middlewares/*"],
      "@routes/*": ["src/routes/*"],
      "@services/*": ["src/services/*"],
      "@utils/*": ["src/utils/*"],
      "@types/*": ["src/types/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "coverage", "tests"]
}`,

    // Main application entry point
    'src/index.ts': `import polka from 'polka';
import sirv from 'sirv';
import { json, urlencoded } from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import compression from '@polka/compression';
import { config } from 'dotenv';
import { logger, httpLogger } from './utils/logger';
import { errorHandler } from './middlewares/error.middleware';
import { notFound } from './middlewares/notFound.middleware';
import { rateLimiter } from './middlewares/rateLimit.middleware';
import { connectDatabase } from './config/database';
import { redis } from './config/redis';
import { initWebSocketServer } from './config/websocket';
import routes from './routes';

// Load environment variables
config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const isDev = process.env.NODE_ENV !== 'production';

// Create Polka instance
const app = polka({
  onError: errorHandler,
  onNoMatch: notFound
});

// Initialize WebSocket server
const wss = initWebSocketServer();

// Global middlewares
app
  .use(compression())
  .use(helmet())
  .use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true
  }))
  .use(json({ limit: '10mb' }))
  .use(urlencoded({ extended: true, limit: '10mb' }))
  .use(cookieParser())
  .use(httpLogger)
  .use('/api', rateLimiter);

// Serve static files (if any)
if (!isDev) {
  app.use(sirv('public', { 
    maxAge: 31536000, // 1 year
    immutable: true,
    gzip: true,
    brotli: true
  }));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    memory: process.memoryUsage(),
    version: process.version
  }));
});

// API info endpoint
app.get('/api', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    name: '{{projectName}}',
    version: '1.0.0',
    framework: 'Polka',
    performance: '5x faster than Express',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      todos: '/api/v1/todos',
      websocket: 'ws://localhost:3000',
      health: '/health'
    }
  }));
});

// Mount API routes
app.use('/api/v1', routes);

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(\`\${signal} received: closing server gracefully\`);
  
  // Close WebSocket server
  wss.close(() => {
    logger.info('WebSocket server closed');
  });
  
  // Close database connection
  await redis.quit();
  
  // Exit process
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
const start = async () => {
  try {
    // Connect to database
    await connectDatabase();
    
    // Connect to Redis
    await redis.connect();
    
    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(\`⚡ Polka server running on port \${PORT}\`);
      logger.info(\`📊 Performance: 5x faster than Express.js\`);
      logger.info(\`🔧 Environment: \${process.env.NODE_ENV || 'development'}\`);
      logger.info(\`💾 Memory: \${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();

export { app, wss };`,

    // Routes index
    'src/routes/index.ts': `import polka from 'polka';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import todoRoutes from './todo.routes';

const router = polka();

// Mount routes
router
  .use('/auth', authRoutes)
  .use('/users', userRoutes)
  .use('/todos', todoRoutes);

export default router;`,

    // Authentication routes
    'src/routes/auth.routes.ts': `import polka from 'polka';
import { z } from 'zod';
import { validate } from '../middlewares/validate.middleware';
import { AuthHandler } from '../handlers/auth.handler';
import { authenticate } from '../middlewares/auth.middleware';

const router = polka();
const authHandler = new AuthHandler();

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
router
  .post('/register', validate(registerSchema), authHandler.register)
  .post('/login', validate(loginSchema), authHandler.login)
  .post('/refresh', authHandler.refreshToken)
  .post('/logout', authenticate, authHandler.logout)
  .get('/verify/:token', authHandler.verifyEmail)
  .post('/forgot-password', validate(forgotPasswordSchema), authHandler.forgotPassword)
  .post('/reset-password/:token', validate(resetPasswordSchema), authHandler.resetPassword);

export default router;`,

    // User routes
    'src/routes/user.routes.ts': `import polka from 'polka';
import { z } from 'zod';
import { validate } from '../middlewares/validate.middleware';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { UserHandler } from '../handlers/user.handler';

const router = polka();
const userHandler = new UserHandler();

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

// All routes require authentication
router.use(authenticate);

// Routes
router
  .get('/', authorize('admin'), userHandler.getAllUsers)
  .get('/me', userHandler.getCurrentUser)
  .get('/:id', userHandler.getUserById)
  .put('/:id', validate(updateUserSchema), userHandler.updateUser)
  .delete('/:id', authorize('admin'), userHandler.deleteUser)
  .post('/change-password', validate(changePasswordSchema), userHandler.changePassword)
  .post('/avatar', userHandler.uploadAvatar);

export default router;`,

    // Todo routes
    'src/routes/todo.routes.ts': `import polka from 'polka';
import { z } from 'zod';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { TodoHandler } from '../handlers/todo.handler';

const router = polka();
const todoHandler = new TodoHandler();

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
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
    status: z.enum(['pending', 'in_progress', 'completed']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional()
  })
});

// All routes require authentication
router.use(authenticate);

// Routes
router
  .get('/', validate(querySchema), todoHandler.getAllTodos)
  .get('/:id', todoHandler.getTodoById)
  .post('/', validate(createTodoSchema), todoHandler.createTodo)
  .put('/:id', validate(updateTodoSchema), todoHandler.updateTodo)
  .delete('/:id', todoHandler.deleteTodo)
  .post('/bulk/delete', todoHandler.bulkDelete)
  .post('/bulk/update', todoHandler.bulkUpdate);

export default router;`,

    // Authentication handler
    'src/handlers/auth.handler.ts': `import type { Request, Response } from 'polka';
import { sendJSON } from '@polka/send-type';
import { AuthService } from '../services/auth.service';
import { EmailService } from '../services/email.service';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';

export class AuthHandler {
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

    sendJSON(res, 201, {
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
    res.setHeader('Set-Cookie', \`refreshToken=\${result.refreshToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800000; Path=/\`);

    sendJSON(res, 200, {
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        accessToken: result.accessToken
      }
    });
  });

  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const cookies = this.parseCookies(req.headers.cookie || '');
    const refreshToken = cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      sendJSON(res, 401, {
        success: false,
        error: 'Refresh token not provided'
      });
      return;
    }

    const result = await this.authService.refreshToken(refreshToken);

    sendJSON(res, 200, {
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

    // Clear refresh token cookie
    res.setHeader('Set-Cookie', 'refreshToken=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/');

    sendJSON(res, 200, {
      success: true,
      message: 'Logout successful'
    });
  });

  verifyEmail = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    await this.authService.verifyEmail(token);

    sendJSON(res, 200, {
      success: true,
      message: 'Email verified successfully'
    });
  });

  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    const resetToken = await this.authService.forgotPassword(email);

    // Send reset email
    await this.emailService.sendPasswordResetEmail(email, resetToken);

    sendJSON(res, 200, {
      success: true,
      message: 'Password reset email sent'
    });
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const { password } = req.body;

    await this.authService.resetPassword(token, password);

    sendJSON(res, 200, {
      success: true,
      message: 'Password reset successful'
    });
  });

  private parseCookies(cookieHeader: string): Record<string, string> {
    return cookieHeader
      .split(';')
      .map(v => v.split('='))
      .reduce((acc, v) => {
        acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
        return acc;
      }, {} as Record<string, string>);
  }
}`,

    // User handler
    'src/handlers/user.handler.ts': `import type { Request, Response } from 'polka';
import { sendJSON } from '@polka/send-type';
import { UserService } from '../services/user.service';
import { asyncHandler } from '../utils/asyncHandler';

export class UserHandler {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  getAllUsers = asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 10, search } = req.query as any;

    const result = await this.userService.getAllUsers({
      page: Number(page),
      limit: Number(limit),
      search: search as string
    });

    sendJSON(res, 200, {
      success: true,
      data: result
    });
  });

  getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const user = await this.userService.getUserById(userId);

    sendJSON(res, 200, {
      success: true,
      data: user
    });
  });

  getUserById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await this.userService.getUserById(id);

    sendJSON(res, 200, {
      success: true,
      data: user
    });
  });

  updateUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    // Ensure users can only update their own profile unless admin
    if (req.user!.id !== id && req.user!.role !== 'admin') {
      sendJSON(res, 403, {
        success: false,
        error: 'Forbidden'
      });
      return;
    }

    const user = await this.userService.updateUser(id, updates);

    sendJSON(res, 200, {
      success: true,
      message: 'User updated successfully',
      data: user
    });
  });

  deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await this.userService.deleteUser(id);

    sendJSON(res, 200, {
      success: true,
      message: 'User deleted successfully'
    });
  });

  changePassword = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;

    await this.userService.changePassword(userId, currentPassword, newPassword);

    sendJSON(res, 200, {
      success: true,
      message: 'Password changed successfully'
    });
  });

  uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    // TODO: Implement file upload with multer or similar
    sendJSON(res, 200, {
      success: true,
      message: 'Avatar upload endpoint - implement with file upload middleware'
    });
  });
}`,

    // Todo handler
    'src/handlers/todo.handler.ts': `import type { Request, Response } from 'polka';
import { sendJSON } from '@polka/send-type';
import { TodoService } from '../services/todo.service';
import { asyncHandler } from '../utils/asyncHandler';

export class TodoHandler {
  private todoService: TodoService;

  constructor() {
    this.todoService = new TodoService();
  }

  getAllTodos = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { page, limit, status, priority } = req.query as any;

    const result = await this.todoService.getAllTodos({
      userId,
      page,
      limit,
      status,
      priority
    });

    sendJSON(res, 200, {
      success: true,
      data: result
    });
  });

  getTodoById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    const todo = await this.todoService.getTodoById(id, userId);

    sendJSON(res, 200, {
      success: true,
      data: todo
    });
  });

  createTodo = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const todoData = { ...req.body, userId };

    const todo = await this.todoService.createTodo(todoData);

    sendJSON(res, 201, {
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

    sendJSON(res, 200, {
      success: true,
      message: 'Todo updated successfully',
      data: todo
    });
  });

  deleteTodo = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.id;

    await this.todoService.deleteTodo(id, userId);

    sendJSON(res, 200, {
      success: true,
      message: 'Todo deleted successfully'
    });
  });

  bulkDelete = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      sendJSON(res, 400, {
        success: false,
        error: 'Invalid todo IDs'
      });
      return;
    }

    const count = await this.todoService.bulkDelete(ids, userId);

    sendJSON(res, 200, {
      success: true,
      message: \`\${count} todos deleted successfully\`
    });
  });

  bulkUpdate = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { ids, updates } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      sendJSON(res, 400, {
        success: false,
        error: 'Invalid todo IDs'
      });
      return;
    }

    const count = await this.todoService.bulkUpdate(ids, userId, updates);

    sendJSON(res, 200, {
      success: true,
      message: \`\${count} todos updated successfully\`
    });
  });
}`,

    // Authentication middleware
    'src/middlewares/auth.middleware.ts': `import type { Request, Response, NextFunction } from 'polka';
import jwt from 'jsonwebtoken';
import { sendJSON } from '@polka/send-type';
import { UserService } from '../services/user.service';

interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

declare module 'polka' {
  interface Request {
    user?: JwtPayload;
  }
}

const userService = new UserService();

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      sendJSON(res, 401, {
        success: false,
        error: 'Not authorized, no token'
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    // Check if user still exists
    const user = await userService.getUserById(decoded.id);
    if (!user) {
      sendJSON(res, 401, {
        success: false,
        error: 'User no longer exists'
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    sendJSON(res, 401, {
      success: false,
      error: 'Not authorized, token failed'
    });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      sendJSON(res, 401, {
        success: false,
        error: 'Not authenticated'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      sendJSON(res, 403, {
        success: false,
        error: 'Not authorized for this resource'
      });
      return;
    }

    next();
  };
};`,

    // Error handling middleware
    'src/middlewares/error.middleware.ts': `import type { Request, Response } from 'polka';
import { sendJSON } from '@polka/send-type';
import { logger } from '../utils/logger';

interface ErrorWithStatus extends Error {
  status?: number;
  code?: string;
}

export const errorHandler = (err: ErrorWithStatus, req: Request, res: Response, next?: Function) => {
  let status = err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Prisma validation error
  if (err.code === 'P2002') {
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
    message = 'Validation failed';
  }

  // Log error
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    status
  });

  sendJSON(res, status, {
    success: false,
    error: {
      message,
      status,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};`,

    // Not found middleware
    'src/middlewares/notFound.middleware.ts': `import type { Request, Response } from 'polka';
import { sendJSON } from '@polka/send-type';

export const notFound = (req: Request, res: Response) => {
  sendJSON(res, 404, {
    success: false,
    error: {
      message: 'Resource not found',
      status: 404,
      path: req.url
    }
  });
};`,

    // Validation middleware
    'src/middlewares/validate.middleware.ts': `import type { Request, Response, NextFunction } from 'polka';
import { sendJSON } from '@polka/send-type';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });

      // Replace request properties with validated data
      req.body = validated.body || req.body;
      req.query = validated.query || req.query;
      req.params = validated.params || req.params;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        sendJSON(res, 400, {
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

    // Rate limiting middleware
    'src/middlewares/rateLimit.middleware.ts': `import type { Request, Response, NextFunction } from 'polka';
import { sendJSON } from '@polka/send-type';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
}

const createRateLimiter = (options: RateLimitOptions) => {
  const {
    windowMs,
    max,
    message = 'Too many requests from this IP, please try again later.',
    keyPrefix = 'rate_limit:'
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const key = \`\${keyPrefix}\${ip}\`;

    try {
      const current = await redis.incr(key);
      
      if (current === 1) {
        await redis.expire(key, Math.ceil(windowMs / 1000));
      }

      const ttl = await redis.ttl(key);
      
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current).toString());
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + ttl * 1000).toISOString());

      if (current > max) {
        res.setHeader('Retry-After', ttl.toString());
        sendJSON(res, 429, {
          success: false,
          error: {
            message,
            status: 429
          }
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Rate limiter error:', error);
      next(); // Continue on error
    }
  };
};

// General API rate limit
export const rateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});

// Strict rate limit for auth endpoints
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many authentication attempts, please try again later.',
  keyPrefix: 'auth_limit:'
});

// File upload rate limit
export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Upload limit exceeded, please try again later.',
  keyPrefix: 'upload_limit:'
});`,

    // Database configuration (Prisma)
    'src/config/database.ts': `import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['error']});

// Log database events in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as any, (e: any) => {
    logger.debug(\`Query: \${e.query}\`);
    logger.debug(\`Duration: \${e.duration}ms\`);
  });
}

export const connectDatabase = async () => {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
};

export { prisma };`,

    // Redis configuration
    'src/config/redis.ts': `import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) {
      logger.error('Redis: Maximum reconnection attempts reached');
      return null;
    }
    const delay = Math.min(times * 100, 3000);
    logger.info(\`Redis: Reconnecting in \${delay}ms...\`);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'];
    if (targetErrors.some(e => err.message.includes(e))) {
      return true;
    }
    return false;
  }
});

redis.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redis.on('connect', () => {
  logger.info('🔌 Redis Client Connected');
});

redis.on('ready', () => {
  logger.info('✅ Redis Client Ready');
});

redis.on('reconnecting', () => {
  logger.warn('🔄 Redis Client Reconnecting');
});`,

    // WebSocket configuration (using uWebSockets.js)
    'src/config/websocket.ts': `import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

interface ExtendedWebSocket {
  userId?: string;
  isAlive?: boolean;
}

export const initWebSocketServer = () => {
  const wss = new WebSocketServer({ 
    port: parseInt(process.env.WS_PORT || '3001', 10),
    perMessageDeflate: {
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
      serverMaxWindowBits: 10,
      concurrencyLimit: 10,
      threshold: 1024
    }
  });

  // Heartbeat to detect broken connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('listening', () => {
    logger.info(\`🔌 WebSocket server listening on port \${process.env.WS_PORT || '3001'}\`);
  });

  wss.on('connection', (ws: ExtendedWebSocket, req) => {
    ws.isAlive = true;
    
    // Parse token from query string
    const url = new URL(req.url!, \`http://\${req.headers.host}\`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'No token provided');
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      ws.userId = decoded.id;
      logger.info(\`User \${ws.userId} connected via WebSocket\`);

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          handleMessage(ws, message, wss);
        } catch (error) {
          logger.error('Invalid WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        logger.info(\`User \${ws.userId} disconnected from WebSocket\`);
      });

      ws.on('error', (error) => {
        logger.error(\`WebSocket error for user \${ws.userId}:\`, error);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connection',
        data: { message: 'Connected to WebSocket server' }
      }));

    } catch (error) {
      ws.close(1008, 'Invalid token');
    }
  });

  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
};

const handleMessage = (ws: ExtendedWebSocket, message: any, wss: WebSocketServer) => {
  const { type, data } = message;

  switch (type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', data: { timestamp: Date.now() } }));
      break;

    case 'broadcast':
      // Broadcast to all connected clients
      wss.clients.forEach((client: any) => {
        if (client.readyState === 1 && client.userId !== ws.userId) {
          client.send(JSON.stringify({
            type: 'broadcast',
            data: {
              ...data,
              from: ws.userId,
              timestamp: Date.now()
            }
          }));
        }
      });
      break;

    case 'todo:update':
      // Broadcast todo updates to all authenticated users
      wss.clients.forEach((client: any) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            type: 'todo:updated',
            data: {
              ...data,
              timestamp: Date.now()
            }
          }));
        }
      });
      break;

    default:
      logger.warn(\`Unknown message type: \${type}\`);
  }
};

export const broadcastToUser = (wss: WebSocketServer, userId: string, type: string, data: any) => {
  wss.clients.forEach((client: any) => {
    if (client.readyState === 1 && client.userId === userId) {
      client.send(JSON.stringify({ type, data, timestamp: Date.now() }));
    }
  });
};`,

    // Logger utility using Pino (faster than Winston)
    'src/utils/logger.ts': `import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname'
    }
  } : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err
  }
});

// HTTP request logger middleware
export const httpLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: \`\${duration}ms\`,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });
  });
  
  next();
};`,

    // Async handler utility
    'src/utils/asyncHandler.ts': `import type { Request, Response, NextFunction } from 'polka';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next?: NextFunction
) => Promise<void>;

export const asyncHandler = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};`,

    // Auth service
    'src/services/auth.service.ts': `import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export class AuthService {
  async register(data: RegisterData) {
    const { email, password, name } = data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create verification token
    const verificationToken = nanoid();

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        verificationToken
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user.id);

    // Store refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokens: {
          push: refreshToken
        }
      }
    });

    return { user, accessToken, refreshToken, verificationToken };
  }

  async login(email: string, password: string) {
    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new Error('Please verify your email first');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user.id);

    // Store refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokens: {
          push: refreshToken
        }
      }
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      accessToken,
      refreshToken
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
      
      // Check if token exists in database
      const user = await prisma.user.findFirst({
        where: {
          id: decoded.userId,
          refreshTokens: {
            has: refreshToken
          }
        }
      });

      if (!user) {
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
    // Clear all refresh tokens
    await prisma.user.update({
      where: { id: userId },
      data: { refreshTokens: [] }
    });

    // Clear any cached sessions
    await redis.del(\`session:\${userId}\`);
  }

  async verifyEmail(token: string) {
    const user = await prisma.user.findFirst({
      where: { verificationToken: token }
    });

    if (!user) {
      throw new Error('Invalid verification token');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        verificationToken: null
      }
    });
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('User not found');
    }

    const resetToken = nanoid();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry
      }
    });

    return resetToken;
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });
  }

  protected generateAccessToken(user: any) {
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

  protected generateRefreshToken(userId: string) {
    return jwt.sign(
      { userId },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );
  }
}`,

    // User service
    'src/services/user.service.ts': `import { prisma } from '../config/database';
import { redis } from '../config/redis';
import bcrypt from 'bcryptjs';

interface GetUsersParams {
  page: number;
  limit: number;
  search?: string;
}

export class UserService {
  async getAllUsers(params: GetUsersParams) {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } }
      ]
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getUserById(id: string) {
    // Try cache first
    const cached = await redis.get(\`user:\${id}\`);
    if (cached) {
      return JSON.parse(cached);
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Cache for 5 minutes
    await redis.setex(\`user:\${id}\`, 300, JSON.stringify(user));

    return user;
  }

  async updateUser(id: string, updates: any) {
    const user = await prisma.user.update({
      where: { id },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true
      }
    });

    // Invalidate cache
    await redis.del(\`user:\${id}\`);

    return user;
  }

  async deleteUser(id: string) {
    await prisma.user.delete({ where: { id } });
    
    // Invalidate cache
    await redis.del(\`user:\${id}\`);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });
  }

  async updateAvatar(userId: string, file: any) {
    // TODO: Implement file upload to S3 or similar
    const avatarUrl = \`/uploads/avatars/\${userId}-\${Date.now()}.png\`;

    await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl }
    });

    // Invalidate cache
    await redis.del(\`user:\${userId}\`);

    return avatarUrl;
  }
}`,

    // Todo service
    'src/services/todo.service.ts': `import { prisma } from '../config/database';
import { redis } from '../config/redis';

interface GetTodosParams {
  userId: string;
  page: number;
  limit: number;
  status?: string;
  priority?: string;
}

export class TodoService {
  async getAllTodos(params: GetTodosParams) {
    const { userId, page, limit, status, priority } = params;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const [todos, total] = await Promise.all([
      prisma.todo.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.todo.count({ where })
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
    const todo = await prisma.todo.findFirst({
      where: { id, userId }
    });

    if (!todo) {
      throw new Error('Todo not found');
    }

    return todo;
  }

  async createTodo(data: any) {
    const todo = await prisma.todo.create({ data });

    // Invalidate user's todo list cache
    await redis.del(\`todos:\${data.userId}\`);

    return todo;
  }

  async updateTodo(id: string, userId: string, updates: any) {
    const todo = await prisma.todo.updateMany({
      where: { id, userId },
      data: updates
    });

    if (todo.count === 0) {
      throw new Error('Todo not found');
    }

    // Invalidate cache
    await redis.del(\`todos:\${userId}\`);

    return prisma.todo.findFirst({ where: { id, userId } });
  }

  async deleteTodo(id: string, userId: string) {
    const result = await prisma.todo.deleteMany({
      where: { id, userId }
    });

    if (result.count === 0) {
      throw new Error('Todo not found');
    }

    // Invalidate cache
    await redis.del(\`todos:\${userId}\`);
  }

  async bulkDelete(ids: string[], userId: string) {
    const result = await prisma.todo.deleteMany({
      where: {
        id: { in: ids },
        userId
      }
    });

    // Invalidate cache
    await redis.del(\`todos:\${userId}\`);

    return result.count;
  }

  async bulkUpdate(ids: string[], userId: string, updates: any) {
    const result = await prisma.todo.updateMany({
      where: {
        id: { in: ids },
        userId
      },
      data: updates
    });

    // Invalidate cache
    await redis.del(\`todos:\${userId}\`);

    return result.count;
  }
}`,

    // Email service stub
    'src/services/email.service.ts': `import { logger } from '../utils/logger';

export class EmailService {
  async sendVerificationEmail(email: string, token: string) {
    // TODO: Implement actual email sending
    logger.info(\`Sending verification email to \${email} with token: \${token}\`);
    
    const verificationUrl = \`\${process.env.CLIENT_URL}/verify-email?token=\${token}\`;
    
    // In production, use a service like SendGrid, SES, or Postmark
    return Promise.resolve();
  }

  async sendPasswordResetEmail(email: string, token: string) {
    // TODO: Implement actual email sending
    logger.info(\`Sending password reset email to \${email} with token: \${token}\`);
    
    const resetUrl = \`\${process.env.CLIENT_URL}/reset-password?token=\${token}\`;
    
    // In production, use a service like SendGrid, SES, or Postmark
    return Promise.resolve();
  }

  async sendWelcomeEmail(email: string, name: string) {
    // TODO: Implement actual email sending
    logger.info(\`Sending welcome email to \${name} at \${email}\`);
    
    // In production, use a service like SendGrid, SES, or Postmark
    return Promise.resolve();
  }
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
  
  todos             Todo[]
  
  @@index([email])
}

model Todo {
  id          String       @id @default(cuid())
  title       String
  description String?
  status      TodoStatus   @default(PENDING)
  priority    TodoPriority @default(MEDIUM)
  dueDate     DateTime?
  userId      String
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  
  @@index([userId])
  @@index([status])
  @@index([priority])
}

enum Role {
  USER
  ADMIN
}

enum TodoStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
}

enum TodoPriority {
  LOW
  MEDIUM
  HIGH
}`,

    // Environment variables
    '.env.example': `# Application
NODE_ENV=development
PORT=3000
WS_PORT=3001

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# Client
CLIENT_URL=http://localhost:3000

# Logging
LOG_LEVEL=debug`,

    // Test file
    'tests/example.test.ts': `import { test } from 'uvu';
import * as assert from 'uvu/assert';

test('math works', () => {
  assert.is(2 + 2, 4);
});

test('async operations', async () => {
  const result = await Promise.resolve(42);
  assert.is(result, 42);
});

test.run();`,

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
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

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
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy Prisma schema
COPY prisma ./prisma

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose ports
EXPOSE 3000 3001

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
      - "\${WS_PORT:-3001}:3001"
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
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

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
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER:-user}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: {{projectName}}-redis
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "\${REDIS_PORT:-6379}:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    container_name: {{projectName}}-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
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

    // Nginx configuration
    'nginx.conf': `events {
  worker_connections 1024;
}

http {
  upstream app {
    server app:3000;
  }

  upstream websocket {
    server app:3001;
  }

  server {
    listen 80;
    server_name localhost;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # API routes
    location /api {
      proxy_pass http://app;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection 'upgrade';
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
      proxy_pass http://websocket;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
      proxy_pass http://app;
      proxy_set_header Host $host;
    }
  }
}`,

    // README
    'README.md': `# {{projectName}}

High-performance micro web server built with Polka - 5x faster than Express.js with minimal overhead.

## Features

- ⚡ **Polka** - Micro web server with minimal overhead
- 🚀 **5x faster** than Express.js
- 🔐 **JWT Authentication** with refresh tokens
- 🗄️ **PostgreSQL** database with Prisma ORM
- 🚦 **Redis** for caching and sessions
- 🔌 **WebSockets** for real-time communication
- 📊 **Pino** - Super fast JSON logger
- 🧪 **uvu** - Extremely fast test runner
- 🐳 **Docker** support with multi-stage builds
- 💾 **Minimal memory footprint**
- 🔥 **Hot reload** in development

## Performance

Polka achieves its performance through:
- Minimal dependencies
- Efficient routing with Trouter
- No unnecessary middleware by default
- Optimized request/response handling
- Native Node.js performance

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

5. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

### Running with Docker

\`\`\`bash
docker-compose up
\`\`\`

## API Endpoints

- **Health Check**: GET /health
- **API Info**: GET /api
- **Authentication**: /api/v1/auth/*
- **Users**: /api/v1/users/*
- **Todos**: /api/v1/todos/*
- **WebSocket**: ws://localhost:3001

## Testing

\`\`\`bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
\`\`\`

## Scripts

- \`npm run dev\` - Start development server with hot reload
- \`npm run build\` - Build for production
- \`npm start\` - Start production server
- \`npm run lint\` - Run ESLint
- \`npm test\` - Run tests with uvu
- \`npm run typecheck\` - Type check without building

## Benchmarks

Polka vs Express.js (requests/sec):

\`\`\`
Polka:    ~65,000 req/sec
Express:  ~13,000 req/sec
\`\`\`

## Memory Usage

- Polka: ~35MB idle
- Express: ~60MB idle

## Project Structure

\`\`\`
src/
├── config/         # Configuration files
├── handlers/       # Request handlers
├── middlewares/    # Custom middlewares
├── routes/         # API routes
├── services/       # Business logic
├── utils/          # Utility functions
└── index.ts        # Application entry point
\`\`\`

## License

MIT
`  }
};