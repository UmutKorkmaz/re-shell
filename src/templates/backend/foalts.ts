import { BackendTemplate } from '../types';

export const foaltsTemplate: BackendTemplate = {
  id: 'foalts',
  name: 'foalts',
  displayName: 'FoalTS',
  description: 'TypeScript-first Node.js framework with decorators, CLI tools, built-in auth, and comprehensive features',
  language: 'typescript',
  framework: 'foalts',
  version: '4.2.0',
  tags: ['nodejs', 'foalts', 'api', 'rest', 'graphql', 'typescript', 'decorators', 'cli', 'auth', 'database'],
  port: 3001,
  dependencies: {},
  features: [
    'authentication',
    'authorization',
    'swagger',
    'validation',
    'database',
    'graphql',
    'websockets',
    'file-upload',
    'queue',
    'testing'
  ],
  
  files: {
    // Package configuration
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "FoalTS application with TypeScript-first approach",
  "main": "build/index.js",
  "engines": {
    "node": ">=16.0.0"
  },
  "scripts": {
    "build": "foal rmdir build && tsc",
    "start": "node ./build/index.js",
    "dev": "npm run build && concurrently -r "tsc -w" "supervisor -w ./build,./config -e js,yml,json --no-restart-on error ./build/index.js"",
    "build:test": "foal rmdir build && tsc -p tsconfig.test.json",
    "start:test": "mocha --file "./build/test.js" "./build/**/*.spec.js"",
    "test": "npm run build:test && npm run start:test",
    "migrations": "foal run-script build/scripts/migrate",
    "makemigrations": "foal run-script build/scripts/create-migration",
    "revertmigration": "foal run-script build/scripts/revert-migration",
    "lint": "eslint --ext .ts src",
    "lint:fix": "eslint --ext .ts --fix src",
    "format": "prettier --write "src/**/*.ts"",
    "generate:openapi": "foal generate openapi",
    "generate:graphql-schema": "foal run-script build/scripts/generate-graphql-schema",
    "docker:build": "docker build -t {{projectName}} .",
    "docker:run": "docker run -p 3001:3001 {{projectName}}"
  },
  "dependencies": {
    "@foal/core": "^4.2.0",
    "@foal/jwt": "^4.2.0",
    "@foal/password": "^4.2.0",
    "@foal/social": "^4.2.0",
    "@foal/storage": "^4.2.0",
    "@foal/typeorm": "^4.2.0",
    "@foal/graphql": "^4.2.0",
    "@foal/socket.io": "^4.2.0",
    "@foal/cli": "^4.2.0",
    "@foal/swagger": "^4.2.0",
    "@foal/ajv": "^4.2.0",
    "@foal/redis": "^4.2.0",
    "@foal/aws-s3": "^4.2.0",
    "typeorm": "~0.3.17",
    "sqlite3": "^5.1.6",
    "pg": "^8.11.3",
    "mysql2": "^3.6.5",
    "caching": "^4.6.10",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "graphql": "^16.8.1",
    "apollo-server-express": "^3.13.0",
    "socket.io": "^4.6.2",
    "node-cron": "^3.0.3",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "compression": "^1.7.4",
    "express-rate-limit": "^7.1.5",
    "winston": "^3.11.0",
    "dotenv": "^16.3.1",
    "ajv": "^8.12.0",
    "ajv-formats": "^2.1.1",
    "multer": "^1.4.5-lts.1",
    "nodemailer": "^6.9.7",
    "bull": "^4.12.0",
    "@types/bull": "^4.10.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.4",
    "@types/mocha": "^10.0.6",
    "@types/supertest": "^2.0.16",
    "@types/bcrypt": "^5.0.2",
    "@types/cors": "^2.8.17",
    "@types/compression": "^1.7.5",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/multer": "^1.4.11",
    "@types/nodemailer": "^6.4.14",
    "@types/node-cron": "^3.0.11",
    "@typescript-eslint/eslint-plugin": "^6.13.2",
    "@typescript-eslint/parser": "^6.13.2",
    "eslint": "^8.55.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.1.0",
    "typescript": "~5.3.2",
    "concurrently": "^8.2.2",
    "supervisor": "^0.12.0",
    "mocha": "^10.2.0",
    "supertest": "^6.3.3",
    "chai": "^4.3.10",
    "@types/chai": "^4.3.11"
  }
}`,

    // TypeScript configuration
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build"]
}`,

    // Test TypeScript configuration
    'tsconfig.test.json': `{
  "extends": "./tsconfig.json",
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}`,

    // Main application entry
    'src/index.ts': `// FoalTS
import { createApp } from '@foal/core';
import { createConnection } from 'typeorm';

// App
import { AppController } from './app/app.controller';
import { dataSource } from './db';

async function main() {
  // Initialize the database connection
  await dataSource.initialize();
  
  const app = await createApp(AppController);

  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(\`Listening on port \${port}...\`);
    console.log(\`API documentation available at http://localhost:\${port}/swagger\`);
    console.log(\`GraphQL playground available at http://localhost:\${port}/graphql\`);
  });
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });`,

    // Test setup
    'src/test.ts': `// Test setup file
import { createConnection, getConnection } from 'typeorm';

export const testDataSource = {
  type: 'sqlite',
  database: ':memory:',
  dropSchema: true,
  entities: ['build/app/**/*.entity.js'],
  migrations: ['build/migrations/*.js'],
  synchronize: true};

before(async () => {
  await createConnection(testDataSource as any);
});

after(async () => {
  await getConnection().close();
});`,

    // Database configuration
    'src/db.ts': `import { DataSource } from 'typeorm';
import { config } from '@foal/core';

export const dataSource = new DataSource({
  type: config.get('database.type') as any,
  
  // Common options
  database: config.get('database.database'),
  synchronize: config.get('database.synchronize'),
  logging: config.get('database.logging'),
  
  // Additional options based on database type
  ...(config.get('database.type') === 'postgres' && {
    host: config.get('database.host'),
    port: config.get('database.port'),
    username: config.get('database.username'),
    password: config.get('database.password')}),
  
  entities: ['build/app/**/*.entity.js'],
  migrations: ['build/migrations/*.js'],
  cli: {
    migrationsDir: 'src/migrations'
  }
});`,

    // Main App Controller
    'src/app/app.controller.ts': `import {
  controller,
  IAppController,
  Get,
  render,
  dependency,
  Config,
  ApiInfo,
  ApiServer,
  HttpResponseOK
} from '@foal/core';
import { createConnection } from 'typeorm';
import { join } from 'path';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { UserController } from './controllers/user.controller';
import { TodoController } from './controllers/todo.controller';
import { ApiController } from './controllers/api.controller';
import { GraphQLController } from './controllers/graphql.controller';
import { WebSocketController } from './controllers/websocket.controller';

// Hooks
import { JWTRequired } from '@foal/jwt';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// Services
import { SchedulerService } from './services/scheduler.service';

@ApiInfo({
  title: '{{projectName}} API',
  version: '1.0.0',
  description: 'FoalTS application with comprehensive features',
  contact: {
    name: 'API Support',
    email: 'support@example.com'
  }
})
@ApiServer({
  url: '/api',
  description: 'API server'
})
export class AppController implements IAppController {
  subControllers = [
    controller('/auth', AuthController),
    controller('/api', ApiController),
    controller('/graphql', GraphQLController),
    controller('/ws', WebSocketController),
    controller('/swagger', SwaggerController)];

  @dependency
  scheduler: SchedulerService;

  async init() {
    // Start scheduled jobs
    this.scheduler.start();
  }

  // Apply global middlewares
  @Get('*')
  applyMiddlewares(ctx: any) {
    // Security headers
    ctx.request.use(helmet({
      contentSecurityPolicy: false, // Disable for GraphQL playground
    }));
    
    // CORS
    ctx.request.use(cors({
      origin: Config.get('cors.origin', '*'),
      credentials: true
    }));
    
    // Compression
    ctx.request.use(compression());
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP'
    });
    ctx.request.use(limiter);
  }

  @Get('/')
  index() {
    return new HttpResponseOK({
      name: '{{projectName}}',
      version: '1.0.0',
      endpoints: {
        api: '/api',
        auth: '/auth',
        graphql: '/graphql',
        websocket: '/ws',
        swagger: '/swagger',
        health: '/health'
      }
    });
  }

  @Get('/health')
  health() {
    return new HttpResponseOK({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: Config.get('env', 'development')
    });
  }
}

// Swagger Controller
import { SwaggerController as FoalSwaggerController } from '@foal/swagger';

class SwaggerController extends FoalSwaggerController {
  options = {
    controllerClass: AppController
  };
}`,

    // API Controller
    'src/app/controllers/api.controller.ts': `import { controller, ApiInfo, ApiServer } from '@foal/core';

import { UserController } from './user.controller';
import { TodoController } from './todo.controller';

@ApiInfo({
  title: 'API v1',
  version: '1.0.0'
})
@ApiServer({
  url: '/api/v1'
})
export class ApiController {
  subControllers = [
    controller('/users', UserController),
    controller('/todos', TodoController)];
}`,

    // Authentication Controller
    'src/app/controllers/auth.controller.ts': `import {
  Context,
  HttpResponseOK,
  HttpResponseUnauthorized,
  HttpResponseBadRequest,
  Post,
  ValidateBody,
  ApiOperation,
  ApiResponse,
  dependency,
  Config
} from '@foal/core';
import { getSecretOrPublicKey } from '@foal/jwt';
import { sign } from 'jsonwebtoken';

import { AuthService } from '../services/auth.service';
import { EmailService } from '../services/email.service';

const credentialsSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 8 }
  },
  required: ['email', 'password'],
  additionalProperties: false
};

const registerSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 8 },
    name: { type: 'string', minLength: 1 }
  },
  required: ['email', 'password', 'name'],
  additionalProperties: false
};

export class AuthController {
  @dependency
  authService: AuthService;

  @dependency
  emailService: EmailService;

  @Post('/register')
  @ValidateBody(registerSchema)
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Create a new user account with email verification'
  })
  @ApiResponse(201, { description: 'User registered successfully' })
  @ApiResponse(400, { description: 'Validation error or user already exists' })
  async register(ctx: Context) {
    const { email, password, name } = ctx.request.body;

    try {
      const { user, verificationToken } = await this.authService.register({
        email,
        password,
        name
      });

      // Send verification email
      await this.emailService.sendVerificationEmail(email, verificationToken);

      // Generate JWT token
      const token = sign(
        { id: user.id, email: user.email },
        getSecretOrPublicKey(),
        { expiresIn: '7d' }
      );

      return new HttpResponseOK({
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token
      });
    } catch (error: any) {
      return new HttpResponseBadRequest({
        message: error.message
      });
    }
  }

  @Post('/login')
  @ValidateBody(credentialsSchema)
  @ApiOperation({
    summary: 'Login user',
    description: 'Authenticate user and return JWT token'
  })
  @ApiResponse(200, { description: 'Login successful' })
  @ApiResponse(401, { description: 'Invalid credentials' })
  async login(ctx: Context) {
    const { email, password } = ctx.request.body;

    const user = await this.authService.login(email, password);

    if (!user) {
      return new HttpResponseUnauthorized({
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = sign(
      { id: user.id, email: user.email, role: user.role },
      getSecretOrPublicKey(),
      { expiresIn: '7d' }
    );

    return new HttpResponseOK({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
  }

  @Post('/verify-email/:token')
  @ApiOperation({
    summary: 'Verify email address',
    description: 'Verify user email using verification token'
  })
  async verifyEmail(ctx: Context) {
    const { token } = ctx.request.params;

    try {
      await this.authService.verifyEmail(token);
      return new HttpResponseOK({
        message: 'Email verified successfully'
      });
    } catch (error: any) {
      return new HttpResponseBadRequest({
        message: error.message
      });
    }
  }

  @Post('/forgot-password')
  @ValidateBody({
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' }
    },
    required: ['email']
  })
  @ApiOperation({
    summary: 'Request password reset',
    description: 'Send password reset email to user'
  })
  async forgotPassword(ctx: Context) {
    const { email } = ctx.request.body;

    try {
      const resetToken = await this.authService.forgotPassword(email);
      await this.emailService.sendPasswordResetEmail(email, resetToken);

      return new HttpResponseOK({
        message: 'Password reset email sent'
      });
    } catch (error: any) {
      return new HttpResponseBadRequest({
        message: error.message
      });
    }
  }

  @Post('/reset-password/:token')
  @ValidateBody({
    type: 'object',
    properties: {
      password: { type: 'string', minLength: 8 }
    },
    required: ['password']
  })
  @ApiOperation({
    summary: 'Reset password',
    description: 'Reset user password using reset token'
  })
  async resetPassword(ctx: Context) {
    const { token } = ctx.request.params;
    const { password } = ctx.request.body;

    try {
      await this.authService.resetPassword(token, password);
      return new HttpResponseOK({
        message: 'Password reset successfully'
      });
    } catch (error: any) {
      return new HttpResponseBadRequest({
        message: error.message
      });
    }
  }
}`,

    // User Controller
    'src/app/controllers/user.controller.ts': `import {
  Context,
  Delete,
  Get,
  HttpResponseOK,
  HttpResponseNotFound,
  HttpResponseForbidden,
  Patch,
  UserRequired,
  ValidateBody,
  ValidatePathParam,
  ValidateQueryParam,
  ApiOperation,
  ApiResponse,
  dependency,
  Hook
} from '@foal/core';
import { JWTRequired } from '@foal/jwt';
import { fetchUser } from '@foal/typeorm';

import { User } from '../entities/user.entity';
import { UserService } from '../services/user.service';

const userUpdateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', format: 'email' }
  },
  additionalProperties: false
};

@Hook(JWTRequired())
@Hook(fetchUser(User))
export class UserController {
  @dependency
  userService: UserService;

  @Get('/me')
  @ApiOperation({
    summary: 'Get current user',
    description: 'Get the authenticated user profile'
  })
  @ApiResponse(200, {
    description: 'Current user profile',
    content: {
      'application/json': {
        schema: {
          $ref: '#/components/schemas/User'
        }
      }
    }
  })
  @UserRequired()
  async getMe(ctx: Context<User>) {
    return new HttpResponseOK({
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
      role: ctx.user.role,
      isEmailVerified: ctx.user.isEmailVerified,
      createdAt: ctx.user.createdAt,
      updatedAt: ctx.user.updatedAt
    });
  }

  @Get('/')
  @ValidateQueryParam('page', { type: 'integer', minimum: 1 }, { required: false })
  @ValidateQueryParam('limit', { type: 'integer', minimum: 1, maximum: 100 }, { required: false })
  @ValidateQueryParam('search', { type: 'string' }, { required: false })
  @ApiOperation({
    summary: 'Get all users',
    description: 'Get paginated list of users (admin only)'
  })
  @UserRequired()
  async getAllUsers(ctx: Context<User>) {
    // Check if user is admin
    if (ctx.user.role !== 'admin') {
      return new HttpResponseForbidden({
        message: 'Admin access required'
      });
    }

    const page = ctx.request.query.page || 1;
    const limit = ctx.request.query.limit || 10;
    const search = ctx.request.query.search;

    const result = await this.userService.getAllUsers({
      page: Number(page),
      limit: Number(limit),
      search: search as string
    });

    return new HttpResponseOK(result);
  }

  @Get('/:id')
  @ValidatePathParam('id', { type: 'string' })
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Get a specific user by their ID'
  })
  @UserRequired()
  async getUserById(ctx: Context<User>) {
    const { id } = ctx.request.params;

    const user = await this.userService.getUserById(id);

    if (!user) {
      return new HttpResponseNotFound({
        message: 'User not found'
      });
    }

    return new HttpResponseOK({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt
    });
  }

  @Patch('/:id')
  @ValidatePathParam('id', { type: 'string' })
  @ValidateBody(userUpdateSchema)
  @ApiOperation({
    summary: 'Update user',
    description: 'Update user profile'
  })
  @UserRequired()
  async updateUser(ctx: Context<User>) {
    const { id } = ctx.request.params;

    // Users can only update their own profile unless admin
    if (ctx.user.id !== id && ctx.user.role !== 'admin') {
      return new HttpResponseForbidden({
        message: 'Cannot update other users'
      });
    }

    const user = await this.userService.updateUser(id, ctx.request.body);

    if (!user) {
      return new HttpResponseNotFound({
        message: 'User not found'
      });
    }

    return new HttpResponseOK({
      message: 'User updated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  }

  @Delete('/:id')
  @ValidatePathParam('id', { type: 'string' })
  @ApiOperation({
    summary: 'Delete user',
    description: 'Delete a user (admin only)'
  })
  @UserRequired()
  async deleteUser(ctx: Context<User>) {
    const { id } = ctx.request.params;

    // Only admins can delete users
    if (ctx.user.role !== 'admin') {
      return new HttpResponseForbidden({
        message: 'Admin access required'
      });
    }

    await this.userService.deleteUser(id);

    return new HttpResponseOK({
      message: 'User deleted successfully'
    });
  }

  @Patch('/change-password')
  @ValidateBody({
    type: 'object',
    properties: {
      currentPassword: { type: 'string' },
      newPassword: { type: 'string', minLength: 8 }
    },
    required: ['currentPassword', 'newPassword']
  })
  @ApiOperation({
    summary: 'Change password',
    description: 'Change the current user password'
  })
  @UserRequired()
  async changePassword(ctx: Context<User>) {
    const { currentPassword, newPassword } = ctx.request.body;

    try {
      await this.userService.changePassword(
        ctx.user.id,
        currentPassword,
        newPassword
      );

      return new HttpResponseOK({
        message: 'Password changed successfully'
      });
    } catch (error: any) {
      return new HttpResponseBadRequest({
        message: error.message
      });
    }
  }
}`,

    // Todo Controller
    'src/app/controllers/todo.controller.ts': `import {
  Context,
  Delete,
  Get,
  HttpResponseCreated,
  HttpResponseOK,
  HttpResponseNotFound,
  Patch,
  Post,
  UserRequired,
  ValidateBody,
  ValidatePathParam,
  ValidateQueryParam,
  ApiOperation,
  ApiResponse,
  dependency,
  Hook
} from '@foal/core';
import { JWTRequired } from '@foal/jwt';
import { fetchUser } from '@foal/typeorm';

import { User } from '../entities/user.entity';
import { TodoService } from '../services/todo.service';

const todoSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    priority: { enum: ['low', 'medium', 'high'] },
    dueDate: { type: 'string', format: 'date-time' }
  },
  required: ['title'],
  additionalProperties: false
};

const todoUpdateSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    status: { enum: ['pending', 'in_progress', 'completed'] },
    priority: { enum: ['low', 'medium', 'high'] },
    dueDate: { type: 'string', format: 'date-time' }
  },
  additionalProperties: false
};

@Hook(JWTRequired())
@Hook(fetchUser(User))
@UserRequired()
export class TodoController {
  @dependency
  todoService: TodoService;

  @Get('/')
  @ValidateQueryParam('page', { type: 'integer', minimum: 1 }, { required: false })
  @ValidateQueryParam('limit', { type: 'integer', minimum: 1, maximum: 100 }, { required: false })
  @ValidateQueryParam('status', { enum: ['pending', 'in_progress', 'completed'] }, { required: false })
  @ValidateQueryParam('priority', { enum: ['low', 'medium', 'high'] }, { required: false })
  @ApiOperation({
    summary: 'Get all todos',
    description: 'Get paginated list of user todos with optional filtering'
  })
  async getAllTodos(ctx: Context<User>) {
    const { page = 1, limit = 10, status, priority } = ctx.request.query;

    const result = await this.todoService.getAllTodos({
      userId: ctx.user.id,
      page: Number(page),
      limit: Number(limit),
      status: status as string,
      priority: priority as string
    });

    return new HttpResponseOK(result);
  }

  @Get('/:id')
  @ValidatePathParam('id', { type: 'string' })
  @ApiOperation({
    summary: 'Get todo by ID',
    description: 'Get a specific todo by its ID'
  })
  async getTodoById(ctx: Context<User>) {
    const { id } = ctx.request.params;

    const todo = await this.todoService.getTodoById(id, ctx.user.id);

    if (!todo) {
      return new HttpResponseNotFound({
        message: 'Todo not found'
      });
    }

    return new HttpResponseOK(todo);
  }

  @Post('/')
  @ValidateBody(todoSchema)
  @ApiOperation({
    summary: 'Create todo',
    description: 'Create a new todo item'
  })
  @ApiResponse(201, { description: 'Todo created successfully' })
  async createTodo(ctx: Context<User>) {
    const todoData = {
      ...ctx.request.body,
      userId: ctx.user.id
    };

    const todo = await this.todoService.createTodo(todoData);

    return new HttpResponseCreated(todo);
  }

  @Patch('/:id')
  @ValidatePathParam('id', { type: 'string' })
  @ValidateBody(todoUpdateSchema)
  @ApiOperation({
    summary: 'Update todo',
    description: 'Update an existing todo'
  })
  async updateTodo(ctx: Context<User>) {
    const { id } = ctx.request.params;

    const todo = await this.todoService.updateTodo(
      id,
      ctx.user.id,
      ctx.request.body
    );

    if (!todo) {
      return new HttpResponseNotFound({
        message: 'Todo not found'
      });
    }

    return new HttpResponseOK({
      message: 'Todo updated successfully',
      todo
    });
  }

  @Delete('/:id')
  @ValidatePathParam('id', { type: 'string' })
  @ApiOperation({
    summary: 'Delete todo',
    description: 'Delete a todo item'
  })
  async deleteTodo(ctx: Context<User>) {
    const { id } = ctx.request.params;

    const deleted = await this.todoService.deleteTodo(id, ctx.user.id);

    if (!deleted) {
      return new HttpResponseNotFound({
        message: 'Todo not found'
      });
    }

    return new HttpResponseOK({
      message: 'Todo deleted successfully'
    });
  }

  @Post('/bulk/delete')
  @ValidateBody({
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1
      }
    },
    required: ['ids']
  })
  @ApiOperation({
    summary: 'Bulk delete todos',
    description: 'Delete multiple todos at once'
  })
  async bulkDelete(ctx: Context<User>) {
    const { ids } = ctx.request.body;

    const count = await this.todoService.bulkDelete(ids, ctx.user.id);

    return new HttpResponseOK({
      message: \`\${count} todos deleted successfully\`
    });
  }

  @Post('/bulk/update')
  @ValidateBody({
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1
      },
      updates: todoUpdateSchema
    },
    required: ['ids', 'updates']
  })
  @ApiOperation({
    summary: 'Bulk update todos',
    description: 'Update multiple todos at once'
  })
  async bulkUpdate(ctx: Context<User>) {
    const { ids, updates } = ctx.request.body;

    const count = await this.todoService.bulkUpdate(ids, ctx.user.id, updates);

    return new HttpResponseOK({
      message: \`\${count} todos updated successfully\`
    });
  }
}`,

    // GraphQL Controller
    'src/app/controllers/graphql.controller.ts': `import { GraphQLController as BaseGraphQLController } from '@foal/graphql';
import { buildSchema } from 'graphql';
import { readFileSync } from 'fs';
import { join } from 'path';
import { dependency } from '@foal/core';

import { GraphQLResolvers } from '../services/graphql-resolvers.service';

export class GraphQLController extends BaseGraphQLController {
  @dependency
  resolvers: GraphQLResolvers;

  schema = buildSchema(
    readFileSync(join(__dirname, '../graphql/schema.graphql'), 'utf-8')
  );

  async getResolvers() {
    return this.resolvers.getResolvers();
  }

  getPlaygroundOptions() {
    return {
      endpoint: '/graphql'
    };
  }
}`,

    // WebSocket Controller
    'src/app/controllers/websocket.controller.ts': `import { EventName, SocketIOController, WebsocketContext, WebsocketResponse } from '@foal/socket.io';
import { JWTRequired } from '@foal/jwt';
import { dependency } from '@foal/core';

import { WebSocketService } from '../services/websocket.service';

export class WebSocketController extends SocketIOController {
  @dependency
  wsService: WebSocketService;

  @EventName('connection')
  async onConnection(ctx: WebsocketContext) {
    console.log('Client connected:', ctx.socket.id);
    
    // Join user's personal room
    const userId = ctx.session?.userId;
    if (userId) {
      ctx.socket.join(\`user:\${userId}\`);
    }
  }

  @EventName('disconnect')
  async onDisconnect(ctx: WebsocketContext) {
    console.log('Client disconnected:', ctx.socket.id);
  }

  @EventName('join-room')
  async joinRoom(ctx: WebsocketContext, payload: { roomId: string }) {
    ctx.socket.join(payload.roomId);
    return new WebsocketResponse('room-joined', { roomId: payload.roomId });
  }

  @EventName('leave-room')
  async leaveRoom(ctx: WebsocketContext, payload: { roomId: string }) {
    ctx.socket.leave(payload.roomId);
    return new WebsocketResponse('room-left', { roomId: payload.roomId });
  }

  @EventName('todo-update')
  async todoUpdate(ctx: WebsocketContext, payload: any) {
    const userId = ctx.session?.userId;
    if (userId) {
      // Broadcast to user's room
      ctx.socket.to(\`user:\${userId}\`).emit('todo-updated', payload);
    }
  }

  @EventName('send-message')
  async sendMessage(ctx: WebsocketContext, payload: { roomId: string; message: string }) {
    // Broadcast message to room
    ctx.socket.to(payload.roomId).emit('new-message', {
      userId: ctx.session?.userId,
      message: payload.message,
      timestamp: new Date().toISOString()
    });
  }
}`,

    // User Entity
    'src/app/entities/user.entity.ts': `import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index
} from 'typeorm';
import { Todo } from './todo.entity';

export type UserRole = 'user' | 'admin';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  email: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({
    type: 'simple-enum',
    enum: ['user', 'admin'],
    default: 'user'
  })
  role: UserRole;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ nullable: true })
  verificationToken?: string;

  @Column({ nullable: true })
  resetToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  resetTokenExpiry?: Date;

  @Column('simple-array', { default: '' })
  refreshTokens: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Todo, todo => todo.user)
  todos: Todo[];
}`,

    // Todo Entity
    'src/app/entities/todo.entity.ts': `import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index
} from 'typeorm';
import { User } from './user.entity';

export type TodoStatus = 'pending' | 'in_progress' | 'completed';
export type TodoPriority = 'low' | 'medium' | 'high';

@Entity()
export class Todo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description?: string;

  @Column({
    type: 'simple-enum',
    enum: ['pending', 'in_progress', 'completed'],
    default: 'pending'
  })
  @Index()
  status: TodoStatus;

  @Column({
    type: 'simple-enum',
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  })
  @Index()
  priority: TodoPriority;

  @Column({ type: 'timestamp', nullable: true })
  dueDate?: Date;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, user => user.todos, { onDelete: 'CASCADE' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}`,

    // Auth Service
    'src/app/services/auth.service.ts': `import { hashPassword, verifyPassword } from '@foal/password';
import { generateToken } from '@foal/core';
import { User } from '../entities/user.entity';
import { dataSource } from '../../db';

export class AuthService {
  private userRepository = dataSource.getRepository(User);

  async register(data: {
    email: string;
    password: string;
    name: string;
  }) {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Generate verification token
    const verificationToken = generateToken();

    // Create user
    const user = this.userRepository.create({
      email: data.email,
      password: hashedPassword,
      name: data.name,
      verificationToken
    });

    await this.userRepository.save(user);

    return { user, verificationToken };
  }

  async login(email: string, password: string) {
    const user = await this.userRepository.findOne({
      where: { email }
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await verifyPassword(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async verifyEmail(token: string) {
    const user = await this.userRepository.findOne({
      where: { verificationToken: token }
    });

    if (!user) {
      throw new Error('Invalid verification token');
    }

    user.isEmailVerified = true;
    user.verificationToken = undefined;

    await this.userRepository.save(user);
  }

  async forgotPassword(email: string) {
    const user = await this.userRepository.findOne({
      where: { email }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate reset token
    const resetToken = generateToken();
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // 1 hour expiry

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;

    await this.userRepository.save(user);

    return resetToken;
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.userRepository.findOne({
      where: { resetToken: token }
    });

    if (!user) {
      throw new Error('Invalid reset token');
    }

    if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
      throw new Error('Reset token expired');
    }

    // Hash new password
    user.password = await hashPassword(newPassword);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;

    await this.userRepository.save(user);
  }
}`,

    // User Service
    'src/app/services/user.service.ts': `import { dataSource } from '../../db';
import { User } from '../entities/user.entity';
import { hashPassword, verifyPassword } from '@foal/password';

export class UserService {
  private userRepository = dataSource.getRepository(User);

  async getAllUsers(options: {
    page: number;
    limit: number;
    search?: string;
  }) {
    const query = this.userRepository.createQueryBuilder('user');

    if (options.search) {
      query.where(
        'user.name LIKE :search OR user.email LIKE :search',
        { search: \`%\${options.search}%\` }
      );
    }

    const [users, total] = await query
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();

    return {
      data: users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt
      })),
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit)
      }
    };
  }

  async getUserById(id: string) {
    return this.userRepository.findOne({ where: { id } });
  }

  async updateUser(id: string, data: Partial<User>) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      return null;
    }

    Object.assign(user, data);
    return this.userRepository.save(user);
  }

  async deleteUser(id: string) {
    await this.userRepository.delete(id);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await verifyPassword(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    user.password = await hashPassword(newPassword);
    await this.userRepository.save(user);
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new Error('User not found');
    }

    user.avatar = avatarUrl;
    await this.userRepository.save(user);

    return avatarUrl;
  }
}`,

    // Todo Service
    'src/app/services/todo.service.ts': `import { dataSource } from '../../db';
import { Todo } from '../entities/todo.entity';
import { In } from 'typeorm';

export class TodoService {
  private todoRepository = dataSource.getRepository(Todo);

  async getAllTodos(options: {
    userId: string;
    page: number;
    limit: number;
    status?: string;
    priority?: string;
  }) {
    const query = this.todoRepository
      .createQueryBuilder('todo')
      .where('todo.userId = :userId', { userId: options.userId });

    if (options.status) {
      query.andWhere('todo.status = :status', { status: options.status });
    }

    if (options.priority) {
      query.andWhere('todo.priority = :priority', { priority: options.priority });
    }

    const [todos, total] = await query
      .orderBy('todo.createdAt', 'DESC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();

    return {
      data: todos,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit)
      }
    };
  }

  async getTodoById(id: string, userId: string) {
    return this.todoRepository.findOne({
      where: { id, userId }
    });
  }

  async createTodo(data: Partial<Todo>) {
    const todo = this.todoRepository.create(data);
    return this.todoRepository.save(todo);
  }

  async updateTodo(id: string, userId: string, data: Partial<Todo>) {
    const todo = await this.todoRepository.findOne({
      where: { id, userId }
    });

    if (!todo) {
      return null;
    }

    Object.assign(todo, data);
    return this.todoRepository.save(todo);
  }

  async deleteTodo(id: string, userId: string) {
    const result = await this.todoRepository.delete({ id, userId });
    return result.affected > 0;
  }

  async bulkDelete(ids: string[], userId: string) {
    const result = await this.todoRepository.delete({
      id: In(ids),
      userId
    });
    return result.affected || 0;
  }

  async bulkUpdate(ids: string[], userId: string, updates: Partial<Todo>) {
    const result = await this.todoRepository.update(
      { id: In(ids), userId },
      updates
    );
    return result.affected || 0;
  }
}`,

    // Email Service
    'src/app/services/email.service.ts': `import { Config } from '@foal/core';
import * as nodemailer from 'nodemailer';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: Config.get('email.host'),
      port: Config.get('email.port'),
      secure: Config.get('email.secure', false),
      auth: {
        user: Config.get('email.user'),
        pass: Config.get('email.pass')
      }
    });
  }

  async sendVerificationEmail(email: string, token: string) {
    const verificationUrl = \`\${Config.get('app.url')}/verify-email/\${token}\`;

    await this.transporter.sendMail({
      from: Config.get('email.from'),
      to: email,
      subject: 'Verify your email address',
      html: \`
        <h1>Email Verification</h1>
        <p>Please click the link below to verify your email address:</p>
        <a href="\${verificationUrl}">Verify Email</a>
        <p>If you didn't request this, please ignore this email.</p>
      \`
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = \`\${Config.get('app.url')}/reset-password/\${token}\`;

    await this.transporter.sendMail({
      from: Config.get('email.from'),
      to: email,
      subject: 'Password Reset Request',
      html: \`
        <h1>Password Reset</h1>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="\${resetUrl}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      \`
    });
  }

  async sendWelcomeEmail(email: string, name: string) {
    await this.transporter.sendMail({
      from: Config.get('email.from'),
      to: email,
      subject: 'Welcome to {{projectName}}!',
      html: \`
        <h1>Welcome, \${name}!</h1>
        <p>Thank you for joining {{projectName}}. We're excited to have you on board!</p>
        <p>If you have any questions, feel free to reach out to our support team.</p>
      \`
    });
  }
}`,

    // Scheduler Service
    'src/app/services/scheduler.service.ts': `import * as cron from 'node-cron';
import { Config } from '@foal/core';
import { dataSource } from '../../db';
import { Todo } from '../entities/todo.entity';

export class SchedulerService {
  private tasks: cron.ScheduledTask[] = [];

  start() {
    // Clean up old completed todos every day at midnight
    const cleanupTask = cron.schedule('0 0 * * *', async () => {
      console.log('Running todo cleanup job...');
      await this.cleanupOldTodos();
    });
    this.tasks.push(cleanupTask);

    // Send reminder emails for due todos every hour
    const reminderTask = cron.schedule('0 * * * *', async () => {
      console.log('Running todo reminder job...');
      await this.sendTodoReminders();
    });
    this.tasks.push(reminderTask);

    // Database backup every day at 3 AM
    const backupTask = cron.schedule('0 3 * * *', async () => {
      console.log('Running database backup job...');
      await this.backupDatabase();
    });
    this.tasks.push(backupTask);

    console.log('Scheduler started with', this.tasks.length, 'jobs');
  }

  stop() {
    this.tasks.forEach(task => task.stop());
    this.tasks = [];
    console.log('Scheduler stopped');
  }

  private async cleanupOldTodos() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const todoRepository = dataSource.getRepository(Todo);
    const result = await todoRepository
      .createQueryBuilder()
      .delete()
      .where('status = :status', { status: 'completed' })
      .andWhere('updatedAt < :date', { date: thirtyDaysAgo })
      .execute();

    console.log(\`Cleaned up \${result.affected} old completed todos\`);
  }

  private async sendTodoReminders() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todoRepository = dataSource.getRepository(Todo);
    const dueTodos = await todoRepository
      .createQueryBuilder('todo')
      .leftJoinAndSelect('todo.user', 'user')
      .where('todo.dueDate <= :tomorrow', { tomorrow })
      .andWhere('todo.dueDate >= :now', { now: new Date() })
      .andWhere('todo.status != :status', { status: 'completed' })
      .getMany();

    console.log(\`Found \${dueTodos.length} todos due soon\`);

    // Here you would send reminder emails
    // This is just a placeholder
    for (const todo of dueTodos) {
      console.log(\`Reminder: Todo "\${todo.title}" is due soon for user \${todo.user.email}\`);
    }
  }

  private async backupDatabase() {
    // Placeholder for database backup logic
    // In a real application, you would implement actual backup logic here
    console.log('Database backup completed');
  }
}`,

    // GraphQL Resolvers Service
    'src/app/services/graphql-resolvers.service.ts': `import { dependency } from '@foal/core';
import { UserService } from './user.service';
import { TodoService } from './todo.service';
import { AuthService } from './auth.service';

export class GraphQLResolvers {
  @dependency
  userService: UserService;

  @dependency
  todoService: TodoService;

  @dependency
  authService: AuthService;

  getResolvers() {
    return {
      // Queries
      me: async (_: any, __: any, context: any) => {
        if (!context.user) {
          throw new Error('Not authenticated');
        }
        return this.userService.getUserById(context.user.id);
      },

      user: async (_: any, args: { id: string }, context: any) => {
        if (!context.user) {
          throw new Error('Not authenticated');
        }
        return this.userService.getUserById(args.id);
      },

      users: async (_: any, args: { page?: number; limit?: number; search?: string }, context: any) => {
        if (!context.user || context.user.role !== 'admin') {
          throw new Error('Admin access required');
        }
        return this.userService.getAllUsers({
          page: args.page || 1,
          limit: args.limit || 10,
          search: args.search
        });
      },

      todos: async (_: any, args: { page?: number; limit?: number; status?: string; priority?: string }, context: any) => {
        if (!context.user) {
          throw new Error('Not authenticated');
        }
        return this.todoService.getAllTodos({
          userId: context.user.id,
          page: args.page || 1,
          limit: args.limit || 10,
          status: args.status,
          priority: args.priority
        });
      },

      todo: async (_: any, args: { id: string }, context: any) => {
        if (!context.user) {
          throw new Error('Not authenticated');
        }
        return this.todoService.getTodoById(args.id, context.user.id);
      },

      // Mutations
      register: async (_: any, args: { email: string; password: string; name: string }) => {
        const { user } = await this.authService.register(args);
        return user;
      },

      login: async (_: any, args: { email: string; password: string }) => {
        const user = await this.authService.login(args.email, args.password);
        if (!user) {
          throw new Error('Invalid credentials');
        }
        return user;
      },

      createTodo: async (_: any, args: any, context: any) => {
        if (!context.user) {
          throw new Error('Not authenticated');
        }
        return this.todoService.createTodo({
          ...args.input,
          userId: context.user.id
        });
      },

      updateTodo: async (_: any, args: { id: string; input: any }, context: any) => {
        if (!context.user) {
          throw new Error('Not authenticated');
        }
        return this.todoService.updateTodo(args.id, context.user.id, args.input);
      },

      deleteTodo: async (_: any, args: { id: string }, context: any) => {
        if (!context.user) {
          throw new Error('Not authenticated');
        }
        const deleted = await this.todoService.deleteTodo(args.id, context.user.id);
        return deleted;
      }
    };
  }
}`,

    // WebSocket Service
    'src/app/services/websocket.service.ts': `import { Server } from 'socket.io';

export class WebSocketService {
  private io: Server;

  setServer(io: Server) {
    this.io = io;
  }

  emitToUser(userId: string, event: string, data: any) {
    this.io.to(\`user:\${userId}\`).emit(event, data);
  }

  emitToRoom(roomId: string, event: string, data: any) {
    this.io.to(roomId).emit(event, data);
  }

  broadcastToAll(event: string, data: any) {
    this.io.emit(event, data);
  }
}`,

    // GraphQL Schema
    'src/app/graphql/schema.graphql': `type User {
  id: ID!
  email: String!
  name: String!
  role: String!
  avatar: String
  isEmailVerified: Boolean!
  createdAt: String!
  updatedAt: String!
  todos: [Todo!]!
}

type Todo {
  id: ID!
  title: String!
  description: String
  status: TodoStatus!
  priority: TodoPriority!
  dueDate: String
  user: User!
  createdAt: String!
  updatedAt: String!
}

enum TodoStatus {
  pending
  in_progress
  completed
}

enum TodoPriority {
  low
  medium
  high
}

type PaginationInfo {
  page: Int!
  limit: Int!
  total: Int!
  pages: Int!
}

type UsersResponse {
  data: [User!]!
  pagination: PaginationInfo!
}

type TodosResponse {
  data: [Todo!]!
  pagination: PaginationInfo!
}

type Query {
  me: User!
  user(id: ID!): User
  users(page: Int, limit: Int, search: String): UsersResponse!
  todos(page: Int, limit: Int, status: TodoStatus, priority: TodoPriority): TodosResponse!
  todo(id: ID!): Todo
}

input TodoInput {
  title: String!
  description: String
  priority: TodoPriority
  dueDate: String
}

input TodoUpdateInput {
  title: String
  description: String
  status: TodoStatus
  priority: TodoPriority
  dueDate: String
}

type Mutation {
  register(email: String!, password: String!, name: String!): User!
  login(email: String!, password: String!): User!
  createTodo(input: TodoInput!): Todo!
  updateTodo(id: ID!, input: TodoUpdateInput!): Todo!
  deleteTodo(id: ID!): Boolean!
}`,

    // Database migration script
    'src/scripts/create-migration.ts': `// Import the Config object to read configuration files
import { Config, createService } from '@foal/core';
import { execSync } from 'child_process';

export async function main() {
  const migrationName = process.argv[2];
  
  if (!migrationName) {
    console.error('Please provide a migration name');
    process.exit(1);
  }

  const command = \`npx typeorm migration:create src/migrations/\${migrationName}\`;
  
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(\`Migration \${migrationName} created successfully\`);
  } catch (error) {
    console.error('Failed to create migration:', error);
    process.exit(1);
  }
}`,

    // Migration runner script
    'src/scripts/migrate.ts': `// Import the dataSource to run migrations
import { dataSource } from '../db';

export async function main() {
  try {
    await dataSource.initialize();
    await dataSource.runMigrations();
    console.log('Migrations completed successfully');
    await dataSource.destroy();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}`,

    // Revert migration script
    'src/scripts/revert-migration.ts': `// Import the dataSource to revert migrations
import { dataSource } from '../db';

export async function main() {
  try {
    await dataSource.initialize();
    await dataSource.undoLastMigration();
    console.log('Last migration reverted successfully');
    await dataSource.destroy();
  } catch (error) {
    console.error('Failed to revert migration:', error);
    process.exit(1);
  }
}`
,

    // GraphQL schema generator script
    'src/scripts/generate-graphql-schema.ts': `import { printSchema } from 'graphql';
import { buildSchema } from 'graphql';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export async function main() {
  const schemaPath = join(__dirname, '../app/graphql/schema.graphql');
  const schemaString = readFileSync(schemaPath, 'utf-8');
  const schema = buildSchema(schemaString);

  // You can add additional processing here
  console.log('GraphQL schema is valid');

  // Optionally generate TypeScript types
  // This would require additional tooling like graphql-code-generator
}`
,

    // Custom shell script
    'src/scripts/seed-database.ts': `// Seed script for development data
import { dataSource } from '../db';
import { User } from '../app/entities/user.entity';
import { Todo } from '../app/entities/todo.entity';
import { hashPassword } from '@foal/password';

export async function main() {
  await dataSource.initialize();

  const userRepository = dataSource.getRepository(User);
  const todoRepository = dataSource.getRepository(Todo);

  // Create admin user
  const adminPassword = await hashPassword('admin123');
  const admin = userRepository.create({
    email: 'admin@example.com',
    password: adminPassword,
    name: 'Admin User',
    role: 'admin',
    isEmailVerified: true
  });
  await userRepository.save(admin);

  // Create test user
  const userPassword = await hashPassword('user123');
  const user = userRepository.create({
    email: 'user@example.com',
    password: userPassword,
    name: 'Test User',
    role: 'user',
    isEmailVerified: true
  });
  await userRepository.save(user);

  // Create sample todos
  const todos = [
    {
      title: 'Complete project documentation',
      description: 'Write comprehensive documentation for the project',
      status: 'in_progress' as const,
      priority: 'high' as const,
      userId: user.id
    },
    {
      title: 'Review pull requests',
      description: 'Review and merge pending pull requests',
      status: 'pending' as const,
      priority: 'medium' as const,
      userId: user.id
    },
    {
      title: 'Update dependencies',
      description: 'Update all npm dependencies to latest versions',
      status: 'completed' as const,
      priority: 'low' as const,
      userId: user.id
    }
  ];

  for (const todoData of todos) {
    const todo = todoRepository.create(todoData);
    await todoRepository.save(todo);
  }

  console.log('Database seeded successfully');
  await dataSource.destroy();
}`
,

    // Configuration files
    'config/default.yml': `# Default configuration
app:
  name: {{projectName}}
  version: 1.0.0
  url: http://localhost:3001

settings:
  session:
    secret: change-this-secret-in-production
    cookie:
      httpOnly: true
      secure: false # Set to true in production with HTTPS
      sameSite: lax
      maxAge: 604800000 # 7 days

  jwt:
    secret: your-256-bit-secret
    publicKey: null
    expiresIn: 7d

  cors:
    origin: '*'
    credentials: true

  logging:
    level: info
    format: dev

database:
  type: sqlite
  database: ./db.sqlite3
  synchronize: true
  logging: false

email:
  host: smtp.gmail.com
  port: 587
  secure: false
  user: your-email@gmail.com
  pass: your-app-password
  from: noreply@example.com

redis:
  host: localhost
  port: 6379
  password: null
  db: 0

upload:
  maxFileSize: 10485760 # 10MB
  allowedTypes:
    - image/jpeg
    - image/png
    - image/gif
    - application/pdf`,

    'config/production.yml': `# Production configuration
settings:
  session:
    cookie:
      secure: true

  jwt:
    secret: \${JWT_SECRET}

  cors:
    origin: \${CORS_ORIGIN}

  logging:
    level: warn
    format: json

database:
  type: postgres
  host: \${DB_HOST}
  port: \${DB_PORT}
  username: \${DB_USER}
  password: \${DB_PASSWORD}
  database: \${DB_NAME}
  synchronize: false
  logging: false

email:
  host: \${EMAIL_HOST}
  port: \${EMAIL_PORT}
  secure: \${EMAIL_SECURE}
  user: \${EMAIL_USER}
  pass: \${EMAIL_PASS}
  from: \${EMAIL_FROM}

redis:
  host: \${REDIS_HOST}
  port: \${REDIS_PORT}
  password: \${REDIS_PASSWORD}`
,

    'config/test.yml': `# Test configuration
database:
  type: sqlite
  database: ':memory:'
  synchronize: true
  dropSchema: true

settings:
  jwt:
    secret: test-secret`
,

    // Environment variables
    '.env.example': `# Application
NODE_ENV=development
PORT=3001

# Database (for production)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME={{projectName}}

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-jwt-key

# CORS
CORS_ORIGIN=http://localhost:3000

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@example.com`
,

    // Docker configuration
    'Dockerfile': `# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY config ./config

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine

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
COPY --from=builder /app/build ./build
COPY config ./config

# Create necessary directories
RUN mkdir -p logs uploads

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "./build/index.js"]`
,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    container_name: {{projectName}}-api
    ports:
      - "\${PORT:-3001}:3001"
    environment:
      - NODE_ENV=production
      - DB_TYPE=postgres
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=\${DB_USER:-postgres}
      - DB_PASSWORD=\${DB_PASSWORD:-password}
      - DB_NAME=\${DB_NAME:-{{projectName}}}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
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
      - POSTGRES_USER=\${DB_USER:-postgres}
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
    driver: bridge`
,

    // Test files
    'src/app/controllers/auth.controller.spec.ts': `import { strictEqual } from 'assert';
import { createApp } from '@foal/core';
import { createConnection, getConnection } from 'typeorm';
import * as request from 'supertest';

import { AppController } from '../app.controller';
import { User } from '../entities/user.entity';

describe('AuthController', () => {
  let app: any;

  before(async () => {
    await createConnection({
      type: 'sqlite',
      database: ':memory:',
      entities: [User],
      synchronize: true,
      dropSchema: true
    });
    app = await createApp(AppController);
  });

  after(async () => {
    await getConnection().close();
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#',
          name: 'Test User'
        })
        .expect(200);

      strictEqual(response.body.user.email, 'test@example.com');
      strictEqual(response.body.user.name, 'Test User');
      strictEqual(typeof response.body.token, 'string');
    });

    it('should reject duplicate email', async () => {
      await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#',
          name: 'Another User'
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!@#'
        })
        .expect(200);

      strictEqual(response.body.user.email, 'test@example.com');
      strictEqual(typeof response.body.token, 'string');
    });

    it('should reject invalid credentials', async () => {
      await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(401);
    });
  });
});`
,

    // README
    'README.md': `# {{projectName}}

A TypeScript-first Node.js application built with FoalTS, featuring decorators, CLI tools, authentication, and comprehensive features.

## Features

- 🚀 **TypeScript-first** with decorators support
- 🛠️ **CLI generator** for rapid development
- 🔐 **Built-in authentication** (JWT, sessions)
- 🔑 **Authorization** with permissions and groups
- 📚 **OpenAPI 3** specification generation
- 🗄️ **TypeORM** integration with migrations
- ✅ **Validation** with class-validator and AJV
- 🚀 **GraphQL** support with Apollo Server
- 🔌 **WebSocket** support with Socket.IO
- 📤 **File uploads** with storage abstraction
- ⏰ **Scheduled jobs** with cron
- 🐚 **Shell scripts** support
- 🧪 **Testing utilities** with Mocha
- 🔧 **Environment-based configuration**
- 🐳 **Docker** support

## Getting Started

### Prerequisites

- Node.js 16+
- PostgreSQL (optional, SQLite by default)
- Redis (optional)

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
   npm run migrations
   \`\`\`

5. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

### Using the CLI

FoalTS provides a powerful CLI for code generation:

\`\`\`bash
# Generate a new controller
foal generate controller todo

# Generate a new entity
foal generate entity product

# Generate a new service
foal generate service email

# Generate a new hook
foal generate hook admin-required

# Generate REST endpoints
foal generate rest-api product

# Generate a script
foal generate script cleanup-data
\`\`\`

## API Documentation

- Swagger UI: http://localhost:3001/swagger
- GraphQL Playground: http://localhost:3001/graphql

## Project Structure

\`\`\`
src/
├── app/
│   ├── controllers/     # HTTP controllers
│   ├── entities/        # TypeORM entities
│   ├── services/        # Business logic
│   ├── hooks/          # Custom hooks
│   ├── graphql/        # GraphQL schema
│   └── app.controller.ts
├── scripts/            # Shell scripts
├── migrations/         # Database migrations
├── config/            # Configuration files
├── db.ts              # Database configuration
├── index.ts           # Application entry
└── test.ts            # Test setup
\`\`\`

## Testing

\`\`\`bash
# Run tests
npm test

# Run specific test file
npm test -- --grep "AuthController"

# Run tests with coverage
npm run test:coverage
\`\`\`

## Database

### Migrations

\`\`\`bash
# Create a new migration
npm run makemigrations -- CreateProductTable

# Run migrations
npm run migrations

# Revert last migration
npm run revertmigration
\`\`\`

### Seeding

\`\`\`bash
# Seed the database
foal run-script build/scripts/seed-database
\`\`\`

## Deployment

### Docker

\`\`\`bash
# Build and run with Docker Compose
docker-compose up

# Build production image
npm run docker:build

# Run production container
npm run docker:run
\`\`\`

### Environment Variables

See \`.env.example\` for all available environment variables.

## Scripts

- \`npm run dev\` - Start development server with hot reload
- \`npm run build\` - Build for production
- \`npm start\` - Start production server
- \`npm test\` - Run tests
- \`npm run lint\` - Run ESLint
- \`npm run format\` - Format code with Prettier
- \`npm run generate:openapi\` - Generate OpenAPI spec
- \`npm run generate:graphql-schema\` - Generate GraphQL schema

## License

MIT`
  }
};