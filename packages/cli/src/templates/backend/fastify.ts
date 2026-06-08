import { BackendTemplate } from '../types';

export const fastifyTemplate: BackendTemplate = {
  id: 'fastify',
  name: 'fastify',
  displayName: 'Fastify',
  description: 'Fast and low overhead web framework for Node.js with schema-based validation',
  language: 'typescript',
  framework: 'fastify',
  version: '4.27.0',
  tags: ['nodejs', 'fastify', 'api', 'rest', 'performance', 'schema', 'typescript'],
  port: 3000,
  dependencies: {},
  features: ['validation', 'microservices', 'authentication', 'swagger', 'websockets'],
  
  files: {
    // Package configuration
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "Fastify API server with TypeScript and high performance",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "start:prod": "cross-env NODE_ENV=production node dist/index.js",
    "lint": "eslint src --ext .ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "migrate": "prisma migrate dev",
    "migrate:deploy": "prisma migrate deploy",
    "generate": "prisma generate",
    "studio": "prisma studio",
    "docker:build": "docker build -t {{projectName}} .",
    "docker:run": "docker run -p 3000:3000 {{projectName}}"
  },
  "dependencies": {
    "fastify": "^4.27.0",
    "@fastify/autoload": "^5.8.2",
    "@fastify/cookie": "^9.3.1",
    "@fastify/cors": "^9.0.1",
    "@fastify/env": "^4.3.0",
    "@fastify/helmet": "^11.1.1",
    "@fastify/jwt": "^8.0.1",
    "@fastify/multipart": "^8.2.0",
    "@fastify/rate-limit": "^9.1.0",
    "@fastify/redis": "^6.1.1",
    "@fastify/sensible": "^5.6.0",
    "@fastify/static": "^7.0.3",
    "@fastify/swagger": "^8.14.0",
    "@fastify/swagger-ui": "^3.0.0",
    "@fastify/type-provider-typebox": "^4.0.0",
    "@fastify/websocket": "^9.0.0",
    "@fastify/compress": "^7.0.1",
    "@fastify/etag": "^5.2.0",
    "@fastify/formbody": "^7.4.0",
    "@fastify/session": "^10.8.0",
    "@sinclair/typebox": "^0.32.22",
    "fastify-plugin": "^4.5.1",
    "fastify-bcrypt": "^1.0.1",
    "fastify-graceful-shutdown": "^3.5.3",
    "fastify-print-routes": "^3.1.0",
    "@prisma/client": "^5.13.0",
    "database": "^5.13.0",
    "dotenv": "^16.4.5",
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0",
    "uuid": "^9.0.1",
    "dayjs": "^1.11.10",
    "lodash": "^4.17.21",
    "nodemailer": "^6.9.13",
    "bull": "^4.12.2",
    "node-cron": "^3.0.3",
    "axios": "^1.6.8",
    "sharp": "^0.33.3",
    "zod": "^3.22.4",
    "close-with-grace": "^1.3.0"
  },
  "devDependencies": {
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
    "tsx": "^4.7.2",
    "cross-env": "^7.0.3",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "@types/jest": "^29.5.12",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2",
    "tap": "^18.7.2",
    "@types/tap": "^15.0.11"
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
    "strictPropertyInitialization": false,
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@config/*": ["src/config/*"],
      "@plugins/*": ["src/plugins/*"],
      "@routes/*": ["src/routes/*"],
      "@schemas/*": ["src/schemas/*"],
      "@services/*": ["src/services/*"],
      "@utils/*": ["src/utils/*"],
      "@hooks/*": ["src/hooks/*"],
      "@types/*": ["src/types/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "coverage", "test"]
}`,

    // Main application entry
    'src/index.ts': `import { join } from 'path';
import AutoLoad from '@fastify/autoload';
import closeWithGrace from 'close-with-grace';
import { app } from './app';
import { config } from './config/config';

const start = async () => {
  try {
    // Register plugins
    await app.register(AutoLoad, {
      dir: join(__dirname, 'microservices'),
      options: { ...config }
    });

    // Register routes
    await app.register(AutoLoad, {
      dir: join(__dirname, 'routes'),
      options: { prefix: '/api/v1' }
    });

    // Start server
    await app.listen({ 
      port: config.port, 
      host: config.host 
    });

    const address = app.server.address();
    const port = typeof address === 'string' ? address : address?.port;

    console.log(\`🚀 Server running on http://\${config.host}:\${port}\`);
    console.log(\`📚 Documentation: http://\${config.host}:\${port}/documentation\`);
    console.log(\`🔧 Environment: \${config.env}\`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
closeWithGrace({ delay: 500 }, async ({ signal, err, manual }) => {
  if (err) {
    app.log.error(err);
  }
  
  app.log.info(\`Shutting down gracefully, signal: \${signal}\`);
  await app.close();
});

start();`,

    // App instance
    'src/app.ts': `import fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { config } from './config/config';

export const app = fastify({
  logger: {
    level: config.logLevel,
    ...(config.env === 'development' && {
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          colorize: true
        }
      }
    })
  },
  ajv: {
    customOptions: {
      removeAdditional: 'all',
      coerceTypes: true,
      useDefaults: true
    }
  },
  trustProxy: true
}).withTypeProvider<TypeBoxTypeProvider>();

// Custom error handler
app.setErrorHandler((error, request, reply) => {
  const { validation, statusCode = 500 } = error;
  
  if (validation) {
    return reply.status(400).send({
      success: false,
      message: 'Validation error',
      errors: validation
    });
  }

  // Log server errors
  if (statusCode >= 500) {
    request.log.error(error);
  }

  reply.status(statusCode).send({
    success: false,
    message: error.message || 'Internal server error',
    ...(config.env === 'development' && {
      stack: error.stack
    })
  });
});

// Not found handler
app.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    success: false,
    message: 'Route not found',
    path: request.url
  });
});`,

    // Configuration
    'src/config/config.ts': `import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

dotenvConfig();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  HOST: z.string().default('0.0.0.0'),
  
  // Database
  DATABASE_URL: z.string(),
  
  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform(Number),
  REDIS_PASSWORD: z.string().optional(),
  
  // JWT
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_SECRET: z.string(),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  
  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@example.com'),
  
  // Logging
  LOG_LEVEL: z.string().default('info'),
  
  // Rate limiting
  RATE_LIMIT_MAX: z.string().default('100').transform(Number),
  RATE_LIMIT_WINDOW: z.string().default('15m'),
  
  // File upload
  MAX_FILE_SIZE: z.string().default('10485760').transform(Number),
  UPLOAD_DIR: z.string().default('uploads')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

const env = parsed.data;

export const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  host: env.HOST,
  logLevel: env.LOG_LEVEL,
  
  database: {
    url: env.DATABASE_URL
  },
  
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD
  },
  
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN
  },
  
  cors: {
    origins: env.CORS_ORIGINS.split(',')
  },
  
  email: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.EMAIL_FROM
  },
  
  rateLimit: {
    max: env.RATE_LIMIT_MAX,
    window: env.RATE_LIMIT_WINDOW
  },
  
  upload: {
    maxFileSize: env.MAX_FILE_SIZE,
    dir: env.UPLOAD_DIR
  }
} as const;`,

    // Plugins
    'src/plugins/cors.ts': `import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';
import { config } from '../config/config';

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cors, {
    origin: config.cors.origins,
    credentials: true
  });
};

export default fp(corsPlugin, {
  name: 'cors'
});`,

    'src/plugins/rate-limit.ts': `import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { FastifyPluginAsync } from 'fastify';
import { config } from '../config/config';

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.window,
    cache: 10000,
    redis: fastify.redis,
    skipOnError: true,
    keyGenerator: (request) => {
      return request.ip;
    },
    errorResponseBuilder: (request, context) => {
      return {
        success: false,
        message: \`Too many requests, please try again in \${context.after}\`,
        statusCode: 429,
        error: 'Too Many Requests',
        rateLimit: {
          limit: context.max,
          remaining: context.remaining,
          reset: new Date(context.reset).toISOString()
        }
      };
    }
  });
};

export default fp(rateLimitPlugin, {
  name: 'rate-limit',
  dependencies: ['redis']
});`,

    'src/plugins/swagger.ts': `import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { FastifyPluginAsync } from 'fastify';

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(swagger, {
    swagger: {
      info: {
        title: '{{projectName}} API',
        description: 'Fastify API with TypeScript',
        version: '1.0.0'
      },
      host: 'localhost:3000',
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'users', description: 'User management endpoints' },
        { name: 'todos', description: 'Todo management endpoints' },
        { name: 'health', description: 'Health check endpoints' }
      ],
      securityDefinitions: {
        Bearer: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description: 'Enter JWT token with Bearer prefix'
        }
      }
    }
  });

  await fastify.register(swaggerUI, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject, request, reply) => {
      return swaggerObject;
    },
    transformSpecificationClone: true
  });
};

export default fp(swaggerPlugin, {
  name: 'swagger'
});`,

    'src/plugins/jwt.ts': `import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config/config';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (...roles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: {
      id: string;
      email: string;
      role: string;
    };
  }
}

const jwtPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(jwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.expiresIn
    }
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  fastify.decorate('authorize', (...roles: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
        
        if (!roles.includes(request.user.role)) {
          reply.status(403).send({
            success: false,
            message: 'Insufficient permissions'
          });
        }
      } catch (err) {
        reply.send(err);
      }
    };
  });
};

export default fp(jwtPlugin, {
  name: 'jwt'
});`,

    'src/plugins/prisma.ts': `import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  const prisma = new PrismaClient({
    log: fastify.config.env === 'development' ? ['query', 'error', 'warn'] : ['error']
  });

  await prisma.$connect();

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (fastify) => {
    await fastify.prisma.$disconnect();
  });
};

export default fp(prismaPlugin, {
  name: 'prisma'
});`,

    'src/plugins/redis.ts': `import fp from 'fastify-plugin';
import redis from '@fastify/redis';
import { FastifyPluginAsync } from 'fastify';
import { config } from '../config/config';

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(redis, {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    family: 4
  });
};

export default fp(redisPlugin, {
  name: 'redis'
});`,

    // Schemas
    'src/schemas/auth.schema.ts': `import { Type } from '@sinclair/typebox';

export const RegisterSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 8 }),
  name: Type.String({ minLength: 1, maxLength: 100 })
});

export const LoginSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String()
});

export const TokenResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
  data: Type.Object({
    user: Type.Object({
      id: Type.String(),
      email: Type.String(),
      name: Type.String(),
      role: Type.String()
    }),
    accessToken: Type.String(),
    refreshToken: Type.String()
  })
});

export const RefreshTokenSchema = Type.Object({
  refreshToken: Type.String()
});

export const ForgotPasswordSchema = Type.Object({
  email: Type.String({ format: 'email' })
});

export const ResetPasswordSchema = Type.Object({
  password: Type.String({ minLength: 8 })
});

export type RegisterInput = typeof RegisterSchema;
export type LoginInput = typeof LoginSchema;
export type TokenResponse = typeof TokenResponseSchema;
export type RefreshTokenInput = typeof RefreshTokenSchema;
export type ForgotPasswordInput = typeof ForgotPasswordSchema;
export type ResetPasswordInput = typeof ResetPasswordSchema;`,

    'src/schemas/user.schema.ts': `import { Type } from '@sinclair/typebox';

export const UserSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  name: Type.String(),
  role: Type.String(),
  avatarUrl: Type.Optional(Type.String()),
  isActive: Type.Boolean(),
  isVerified: Type.Boolean(),
  createdAt: Type.String(),
  updatedAt: Type.String()
});

export const UpdateUserSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  avatarUrl: Type.Optional(Type.String())
});

export const ChangePasswordSchema = Type.Object({
  currentPassword: Type.String(),
  newPassword: Type.String({ minLength: 8 })
});

export const UserListSchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  search: Type.Optional(Type.String())
});

export type User = typeof UserSchema;
export type UpdateUserInput = typeof UpdateUserSchema;
export type ChangePasswordInput = typeof ChangePasswordSchema;
export type UserListQuery = typeof UserListSchema;`,

    'src/schemas/todo.schema.ts': `import { Type } from '@sinclair/typebox';

export const TodoSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  description: Type.Optional(Type.String()),
  completed: Type.Boolean(),
  priority: Type.Union([
    Type.Literal('low'),
    Type.Literal('medium'),
    Type.Literal('high')
  ]),
  dueDate: Type.Optional(Type.String()),
  tags: Type.Array(Type.String()),
  userId: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String()
});

export const CreateTodoSchema = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 200 }),
  description: Type.Optional(Type.String({ maxLength: 1000 })),
  priority: Type.Optional(Type.Union([
    Type.Literal('low'),
    Type.Literal('medium'),
    Type.Literal('high')
  ])),
  dueDate: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String()))
});

export const UpdateTodoSchema = Type.Object({
  title: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  description: Type.Optional(Type.String({ maxLength: 1000 })),
  completed: Type.Optional(Type.Boolean()),
  priority: Type.Optional(Type.Union([
    Type.Literal('low'),
    Type.Literal('medium'),
    Type.Literal('high')
  ])),
  dueDate: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String()))
});

export const TodoQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
  status: Type.Optional(Type.Union([
    Type.Literal('pending'),
    Type.Literal('completed')
  ])),
  priority: Type.Optional(Type.Union([
    Type.Literal('low'),
    Type.Literal('medium'),
    Type.Literal('high')
  ])),
  sortBy: Type.Optional(Type.String()),
  order: Type.Optional(Type.Union([
    Type.Literal('asc'),
    Type.Literal('desc')
  ]))
});

export type Todo = typeof TodoSchema;
export type CreateTodoInput = typeof CreateTodoSchema;
export type UpdateTodoInput = typeof UpdateTodoSchema;
export type TodoQuery = typeof TodoQuerySchema;`,

    // Routes
    'src/routes/health/index.ts': `import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      tags: ['health'],
      summary: 'Health check',
      response: {
        200: Type.Object({
          status: Type.String(),
          timestamp: Type.String(),
          uptime: Type.Number(),
          environment: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: fastify.config.env
    };
  });

  fastify.get('/ready', {
    schema: {
      tags: ['health'],
      summary: 'Readiness check',
      response: {
        200: Type.Object({
          status: Type.String(),
          services: Type.Object({
            database: Type.String(),
            redis: Type.String()
          })
        })
      }
    }
  }, async (request, reply) => {
    const services = {
      database: 'healthy',
      redis: 'healthy'
    };

    try {
      await fastify.prisma.$queryRaw\`SELECT 1\`;
    } catch (error) {
      services.database = 'unhealthy';
    }

    try {
      await fastify.redis.ping();
    } catch (error) {
      services.redis = 'unhealthy';
    }

    const status = Object.values(services).every(s => s === 'healthy') ? 'ready' : 'not ready';

    return {
      status,
      services
    };
  });
};

export default healthRoutes;`,

    'src/routes/auth/index.ts': `import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import {
  RegisterSchema,
  LoginSchema,
  TokenResponseSchema,
  RefreshTokenSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema
} from '../../schemas/auth.schema';
import { generateTokens } from '../../utils/jwt';
import { sendVerificationEmail, sendPasswordResetEmail } from '../../services/email.service';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register
  fastify.post('/register', {
    schema: {
      tags: ['auth'],
      summary: 'Register new user',
      body: RegisterSchema,
      response: {
        201: TokenResponseSchema
      }
    }
  }, async (request, reply) => {
    const { email, password, name } = request.body;

    // Check if user exists
    const existingUser = await fastify.prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return reply.status(400).send({
        success: false,
        message: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await fastify.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        verificationToken: generateVerificationToken()
      }
    });

    // Send verification email
    await sendVerificationEmail(user.email, user.verificationToken!);

    // Generate tokens
    const tokens = generateTokens(fastify, {
      id: user.id,
      email: user.email,
      role: user.role
    });

    return reply.status(201).send({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        ...tokens
      }
    });
  });

  // Login
  fastify.post('/login', {
    schema: {
      tags: ['auth'],
      summary: 'User login',
      body: LoginSchema,
      response: {
        200: TokenResponseSchema
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body;

    // Find user
    const user = await fastify.prisma.user.findUnique({
      where: { email }
    });

    if (!user || !await bcrypt.compare(password, user.password)) {
      return reply.status(401).send({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.isActive) {
      return reply.status(403).send({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Update last login
    await fastify.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Generate tokens
    const tokens = generateTokens(fastify, {
      id: user.id,
      email: user.email,
      role: user.role
    });

    // Set refresh token as HTTP-only cookie
    reply.setCookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: fastify.config.env === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return {
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    };
  });

  // Refresh token
  fastify.post('/refresh', {
    schema: {
      tags: ['auth'],
      summary: 'Refresh access token',
      body: RefreshTokenSchema,
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            accessToken: Type.String()
          })
        })
      }
    }
  }, async (request, reply) => {
    const { refreshToken } = request.body;

    try {
      const decoded = fastify.jwt.verify(refreshToken) as any;
      
      // Generate new access token
      const accessToken = fastify.jwt.sign({
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      });

      return {
        success: true,
        data: { accessToken }
      };
    } catch (error) {
      return reply.status(401).send({
        success: false,
        message: 'Invalid refresh token'
      });
    }
  });

  // Logout
  fastify.post('/logout', {
    schema: {
      tags: ['auth'],
      summary: 'User logout',
      security: [{ Bearer: [] }],
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String()
        })
      }
    },
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    // Clear refresh token cookie
    reply.clearCookie('refreshToken');

    return {
      success: true,
      message: 'Logout successful'
    };
  });

  // Forgot password
  fastify.post('/forgot-password', {
    schema: {
      tags: ['auth'],
      summary: 'Request password reset',
      body: ForgotPasswordSchema,
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { email } = request.body;

    const user = await fastify.prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        message: 'User not found'
      });
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await fastify.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry
      }
    });

    // Send reset email
    await sendPasswordResetEmail(user.email, resetToken);

    return {
      success: true,
      message: 'Password reset email sent'
    };
  });

  // Reset password
  fastify.post('/reset-password/:token', {
    schema: {
      tags: ['auth'],
      summary: 'Reset password with token',
      params: Type.Object({
        token: Type.String()
      }),
      body: ResetPasswordSchema,
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { token } = request.params;
    const { password } = request.body;

    const user = await fastify.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user
    await fastify.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    return {
      success: true,
      message: 'Password reset successful'
    };
  });
};

function generateVerificationToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generateResetToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export default authRoutes;`,

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
  avatarUrl         String?
  isActive          Boolean   @default(true)
  isVerified        Boolean   @default(false)
  verificationToken String?
  resetToken        String?
  resetTokenExpiry  DateTime?
  lastLogin         DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  todos             Todo[]
  
  @@index([email])
}

model Todo {
  id          String       @id @default(cuid())
  title       String
  description String?
  completed   Boolean      @default(false)
  priority    TodoPriority @default(MEDIUM)
  dueDate     DateTime?
  tags        String[]
  userId      String
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  
  @@index([userId])
  @@index([completed])
  @@index([priority])
}

enum Role {
  USER
  ADMIN
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
HOST=0.0.0.0
LOG_LEVEL=info

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/{{projectName}}"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@example.com

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=15m

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads`,

    // Docker configuration
    'Dockerfile': `# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

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
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Create necessary directories
RUN mkdir -p uploads logs && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Run migrations and start
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    container_name: {{projectName}}-api
    ports:
      - "\${PORT:-3000}:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://\${DB_USER:-postgres}:\${DB_PASSWORD:-postgres}@postgres:5432/\${DB_NAME:-{{projectName}}}
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

High-performance Fastify API server with TypeScript, featuring schema-based validation and modern architecture.

## Features

- ⚡ **Fastify** framework for high performance
- 📝 **Schema-based validation** with TypeBox
- 🔐 **JWT Authentication** with refresh tokens
- 🗄️ **Prisma ORM** with PostgreSQL
- 🚦 **Redis** for caching and rate limiting
- 📚 **Swagger Documentation** auto-generated
- 🔄 **WebSocket** support
- 🧪 **Testing** with Jest and Tap
- 🐳 **Docker** support
- 📊 **Structured logging** with Pino
- 🛡️ **Security** features (Helmet, CORS, rate limiting)
- 📤 **File uploads** with validation
- ✉️ **Email** support
- 🔄 **Background jobs** with Bull
- 🎯 **Type-safe** throughout

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

4. Generate Prisma client:
   \`\`\`bash
   npm run generate
   \`\`\`

5. Run database migrations:
   \`\`\`bash
   npm run migrate
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
- Swagger UI: http://localhost:3000/documentation
- Health check: http://localhost:3000/api/v1/health

## Testing

\`\`\`bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run e2e tests
npm run test:e2e
\`\`\`

## Project Structure

\`\`\`
src/
├── config/         # Configuration files
├── hooks/          # Fastify hooks
├── plugins/        # Fastify plugins
├── routes/         # API routes
├── schemas/        # TypeBox schemas
├── services/       # Business logic
├── utils/          # Utility functions
├── types/          # TypeScript types
├── app.ts          # Fastify instance
└── index.ts        # Application entry
\`\`\`

## Database

\`\`\`bash
# Generate Prisma client
npm run generate

# Create migration
npm run migrate

# Deploy migrations
npm run migrate:deploy

# Open Prisma Studio
npm run studio
\`\`\`

## Performance

Fastify is one of the fastest web frameworks for Node.js, capable of handling:
- 30,000+ requests/second
- Sub-millisecond response times
- Efficient schema-based validation

## License

MIT`
  }
};