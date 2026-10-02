import { BackendTemplate } from '../types';

export const nestjsTemplate: BackendTemplate = {
  id: 'nestjs',
  name: 'nestjs',
  displayName: 'NestJS',
  description: 'Progressive Node.js framework for building efficient, scalable server-side applications',
  language: 'typescript',
  framework: 'nestjs',
  version: '10.3.8',
  tags: ['nodejs', 'nestjs', 'api', 'rest', 'graphql', 'microservices', 'typescript', 'typeorm', 'postgresql', 'jwt', 'websockets'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'authorization', 'database', 'docker', 'file-upload', 'graphql', 'microservices', 'middleware', 'rate-limiting', 'rest-api', 'security', 'swagger', 'testing', 'validation', 'websockets'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "0.0.1",
  "description": "NestJS API server with modular architecture",
  "author": "",
  "private": true,
  "license": "MIT",
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \\"src/**/*.ts\\" \\"test/**/*.ts\\"",
    "dev": "nest start --watch",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \\"{src,test}/**/*.ts\\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "typecheck": "tsc --noEmit",
    "migration:generate": "npm run typeorm -- migration:generate",
    "migration:run": "npm run typeorm -- migration:run",
    "migration:revert": "npm run typeorm -- migration:revert",
    "typeorm": "typeorm-ts-node-commonjs -d src/config/data-source.ts"
  },
  "dependencies": {
    "@apollo/server": "^4.10.4",
    "@nestjs/apollo": "^12.1.0",
    "@nestjs/common": "^10.3.8",
    "@nestjs/config": "^3.2.2",
    "@nestjs/core": "^10.3.8",
    "@nestjs/graphql": "^12.1.1",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/microservices": "^10.3.8",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.3.8",
    "@nestjs/platform-socket.io": "^10.3.8",
    "@nestjs/swagger": "^7.3.1",
    "@nestjs/terminus": "^10.2.3",
    "@nestjs/throttler": "^5.1.2",
    "@nestjs/typeorm": "^10.0.2",
    "@nestjs/websockets": "^10.3.8",
    "amqplib": "^0.10.4",
    "bcryptjs": "^2.4.3",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "compression": "^1.7.4",
    "graphql": "^16.8.1",
    "helmet": "^7.1.0",
    "joi": "^17.12.3",
    "kafkajs": "^2.2.4",
    "multer": "^1.4.5-lts.1",
    "nodemailer": "^6.9.13",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "passport-local": "^1.0.0",
    "pg": "^8.11.5",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "socket.io": "^4.7.5",
    "typeorm": "^0.3.20"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.2",
    "@nestjs/schematics": "^10.1.1",
    "@nestjs/testing": "^10.3.8",
    "@types/bcryptjs": "^2.4.6",
    "@types/compression": "^1.7.5",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.12.7",
    "@types/nodemailer": "^6.4.14",
    "@types/passport-jwt": "^4.0.1",
    "@types/passport-local": "^1.0.38",
    "@types/supertest": "^6.0.2",
    "@typescript-eslint/eslint-plugin": "^7.7.1",
    "@typescript-eslint/parser": "^7.7.1",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-prettier": "^5.1.3",
    "jest": "^29.7.0",
    "prettier": "^3.2.5",
    "source-map-support": "^0.5.21",
    "supertest": "^7.0.0",
    "ts-jest": "^29.1.2",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.4.5"
  },
  "jest": {
    "moduleFileExtensions": [
      "js",
      "json",
      "ts"
    ],
    "rootDir": "src",
    "testRegex": ".*\\\\.spec\\\\.ts$",
    "transform": {
      "^.+\\\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": [
      "**/*.(t|j)s"
    ],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
`,

    'tsconfig.json': `{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true
  },
  "exclude": ["node_modules", "dist"]
}
`,

    'tsconfig.build.json': `{
  "extends": "./tsconfig.json",
  "include": ["src/**/*"],
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
`,

    'nest-cli.json': `{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "tsConfigPath": "tsconfig.build.json"
  },
  "generateOptions": {
    "spec": true
  }
}
`,

    '.eslintrc.js': `module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js', 'dist', 'node_modules'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
`,

    '.gitignore': `node_modules/
dist/
coverage/
uploads/
.env
*.log
.DS_Store
`,

    '.prettierrc': `{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
`,

    'src/main.ts': `import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getMicroserviceOptions } from './config/microservice.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const config = app.get(ConfigService);
  const port = config.get<number>('port', 3000);
  const environment = config.get<string>('environment', 'development');
  const isProduction = environment === 'production';

  // Security. The Apollo landing page needs a relaxed CSP, so it is only
  // loosened outside production (where the landing page is disabled anyway).
  app.use(helmet({ contentSecurityPolicy: isProduction ? undefined : false }));
  app.use(compression());
  app.enableCors({
    origin: config.get<string[]>('cors.origins'),
    credentials: true,
  });

  // REST API lives under /api/v1. The health endpoints stay at the root so load
  // balancers and container health checks have a stable path.
  app.setGlobalPrefix('api', { exclude: ['health', 'health/ready'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger documentation (development and test only)
  if (!isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('{{projectName}} API')
        .setDescription('NestJS API with auth, todos, file uploads and GraphQL')
        .setVersion('1.0')
        .addBearerAuth()
        .addTag('auth', 'Authentication endpoints')
        .addTag('users', 'User management endpoints')
        .addTag('todos', 'Todo management endpoints')
        .addTag('files', 'File upload endpoints')
        .addTag('health', 'Health check endpoints')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // Optional microservice transport (MICROSERVICE_TRANSPORT=tcp|kafka|rmq)
  const microservice = getMicroserviceOptions(config);
  if (microservice) {
    app.connectMicroservice(microservice);
    await app.startAllMicroservices();
    logger.log('Microservice transport started: ' + config.get<string>('microservice.transport'));
  }

  await app.listen(port);
  logger.log('Application is running on: http://localhost:' + port);
  logger.log('GraphQL endpoint: http://localhost:' + port + '/graphql');
  if (!isProduction) {
    logger.log('API documentation: http://localhost:' + port + '/api/docs');
  }
  logger.log('Environment: ' + environment);

  // Graceful shutdown. Nest's enableShutdownHooks() re-raises the signal after
  // the hooks run, which ends the process with a signal status instead of 0, so
  // close the app explicitly and exit cleanly.
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.log(signal + ' received: shutting down');
    const forceExit = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 10000);
    forceExit.unref();
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error instanceof Error ? error.stack : String(error));
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  new Logger('Bootstrap').error('Failed to start application', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
`,

    'src/app.module.ts': `import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TodosModule } from './modules/todos/todos.module';
import { EmailModule } from './modules/email/email.module';
import { FileModule } from './modules/files/file.module';
import { EventsModule } from './modules/events/events.module';
import { AppResolver } from './app.resolver';
import { PingController } from './microservice/ping.controller';

@Module({
  imports: [
    // Configuration (validated at startup; defaults let a fresh scaffold boot)
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      cache: true,
    }),

    // Database (connects in the background, never blocks startup)
    DatabaseModule,

    // Rate limiting
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttle.ttl', 60) * 1000,
          limit: config.get<number>('throttle.limit', 100),
        },
      ],
    }),

    // GraphQL (code-first schema generated in memory, served at /graphql)
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      path: '/graphql',
      context: ({ req, res }: { req: unknown; res: unknown }) => ({ req, res }),
    }),

    // Feature modules
    CommonModule,
    HealthModule,
    EmailModule,
    UsersModule,
    AuthModule,
    TodosModule,
    FileModule,
    EventsModule,
  ],
  controllers: [PingController],
  providers: [AppResolver],
})
export class AppModule {}
`,

    'src/app.resolver.ts': `import { Query, Resolver } from '@nestjs/graphql';
import { Public } from './common/decorators/public.decorator';

@Resolver()
export class AppResolver {
  @Public()
  @Query(() => String, { description: 'Simple hello world query' })
  hello(): string {
    return 'Hello from GraphQL!';
  }

  @Public()
  @Query(() => String, { description: 'Service health check' })
  health(): string {
    return 'healthy';
  }
}
`,

    'src/config/configuration.ts': `const parseList = (value: string | undefined, fallback: string[]): string[] =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : fallback;

export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  environment: process.env.NODE_ENV ?? 'development',

  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_DATABASE ?? '{{projectName}}',
    ssl: process.env.DB_SSL === 'true',
    retryIntervalMs: parseInt(process.env.DB_RETRY_INTERVAL_MS ?? '15000', 10),
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  email: {
    host: process.env.SMTP_HOST || undefined,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
    from: process.env.EMAIL_FROM ?? 'noreply@example.com',
    appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  },

  cors: {
    origins: parseList(process.env.CORS_ORIGINS, [
      'http://localhost:3000',
      'http://localhost:5173',
    ]),
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE ?? String(10 * 1024 * 1024), 10),
    uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  },

  microservice: {
    transport: process.env.MICROSERVICE_TRANSPORT ?? 'none',
    host: process.env.MICROSERVICE_HOST ?? '0.0.0.0',
    port: parseInt(process.env.MICROSERVICE_PORT ?? '4000', 10),
    kafkaBrokers: parseList(process.env.KAFKA_BROKERS, ['localhost:9092']),
    kafkaGroupId: process.env.KAFKA_GROUP_ID ?? '{{projectName}}-consumer',
    rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://localhost:5672',
    rabbitmqQueue: process.env.RABBITMQ_QUEUE ?? '{{projectName}}',
  },
});
`,

    'src/config/validation.ts': `import * as Joi from 'joi';

// Development-only fallbacks so a fresh scaffold boots with nothing configured.
// In production both secrets are required and must be at least 16 characters.
const DEV_JWT_SECRET = 'dev-only-jwt-secret-change-me';
const DEV_JWT_REFRESH_SECRET = 'dev-only-jwt-refresh-secret-change-me';

const secret = (devDefault: string) =>
  Joi.string()
    .min(16)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default(devDefault),
    });

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),
  CORS_ORIGINS: Joi.string().allow('').default(''),

  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().default('postgres'),
  DB_PASSWORD: Joi.string().allow('').default('postgres'),
  DB_DATABASE: Joi.string().default('{{projectName}}'),
  DB_SSL: Joi.boolean().default(false),
  DB_RETRY_INTERVAL_MS: Joi.number().min(1000).default(15000),

  JWT_SECRET: secret(DEV_JWT_SECRET),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: secret(DEV_JWT_REFRESH_SECRET),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  SMTP_HOST: Joi.string().allow('').optional(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASS: Joi.string().allow('').optional(),
  EMAIL_FROM: Joi.string().default('noreply@example.com'),
  APP_URL: Joi.string().uri().default('http://localhost:3000'),

  THROTTLE_TTL: Joi.number().min(1).default(60),
  THROTTLE_LIMIT: Joi.number().min(1).default(100),

  MAX_FILE_SIZE: Joi.number().min(1).default(10 * 1024 * 1024),
  UPLOAD_DIR: Joi.string().default('./uploads'),

  MICROSERVICE_TRANSPORT: Joi.string().valid('none', 'tcp', 'kafka', 'rmq').default('none'),
  MICROSERVICE_HOST: Joi.string().default('0.0.0.0'),
  MICROSERVICE_PORT: Joi.number().port().default(4000),
  KAFKA_BROKERS: Joi.string().allow('').default(''),
  KAFKA_GROUP_ID: Joi.string().allow('').default(''),
  RABBITMQ_URL: Joi.string().allow('').default(''),
  RABBITMQ_QUEUE: Joi.string().allow('').default(''),
});
`,

    'src/config/microservice.config.ts': `import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

/**
 * Optional microservice transport, selected with MICROSERVICE_TRANSPORT.
 * "none" (the default) runs the HTTP API only. "tcp" needs no external broker;
 * "kafka" and "rmq" need a reachable Kafka / RabbitMQ and fail startup if not.
 */
export function getMicroserviceOptions(config: ConfigService): MicroserviceOptions | null {
  const transport = config.get<string>('microservice.transport', 'none');

  switch (transport) {
    case 'tcp':
      return {
        transport: Transport.TCP,
        options: {
          host: config.get<string>('microservice.host', '0.0.0.0'),
          port: config.get<number>('microservice.port', 4000),
        },
      };
    case 'kafka':
      return {
        transport: Transport.KAFKA,
        options: {
          client: { brokers: config.get<string[]>('microservice.kafkaBrokers', ['localhost:9092']) },
          consumer: { groupId: config.get<string>('microservice.kafkaGroupId', '{{projectName}}-consumer') },
        },
      };
    case 'rmq':
      return {
        transport: Transport.RMQ,
        options: {
          urls: [config.get<string>('microservice.rabbitmqUrl', 'amqp://localhost:5672')],
          queue: config.get<string>('microservice.rabbitmqQueue', '{{projectName}}'),
        },
      };
    default:
      return null;
  }
}
`,

    'src/config/data-source.ts': `import 'reflect-metadata';
import { DataSource } from 'typeorm';

// Standalone DataSource used by the TypeORM CLI (npm run migration:*).
// The running application builds its own connection in DatabaseModule.
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_DATABASE ?? '{{projectName}}',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  migrationsTableName: 'migrations',
});
`,

    'src/microservice/ping.controller.ts': `import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

// Only reachable when a microservice transport is enabled
// (MICROSERVICE_TRANSPORT). Plain HTTP requests never hit this controller.
@Controller()
export class PingController {
  @MessagePattern({ cmd: 'ping' })
  ping(): string {
    return 'pong';
  }
}
`,

    'src/database/database.module.ts': `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.database'),
        ssl: config.get<boolean>('database.ssl') ? { rejectUnauthorized: false } : false,
        autoLoadEntities: true,
        // The connection is opened by DatabaseService in the background, so a
        // missing database never blocks or crashes application startup.
        manualInitialization: true,
        retryAttempts: 0,
        connectTimeoutMS: 3000,
        synchronize: config.get<string>('environment') === 'development',
        logging: config.get<string>('environment') === 'development' ? ['error', 'warn'] : ['error'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsTableName: 'migrations',
      }),
    }),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
`,

    'src/database/database.service.ts': `import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

/**
 * Opens the database connection in the background after the application has
 * started. An unreachable database is logged and retried on an interval; it
 * never delays startup. Requests that need the database fail with a 503 until
 * the connection is up, and GET /health/ready reports the state.
 */
@Injectable()
export class DatabaseService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private retryTimer?: NodeJS.Timeout;
  private stopped = false;
  private warned = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  get isConnected(): boolean {
    return this.dataSource.isInitialized;
  }

  onApplicationBootstrap(): void {
    // Intentionally not awaited.
    void this.connect();
  }

  private async connect(): Promise<void> {
    if (this.stopped || this.dataSource.isInitialized) return;
    try {
      await this.dataSource.initialize();
      this.warned = false;
      this.logger.log('Database connected');
    } catch (error) {
      if (!this.warned) {
        this.warned = true;
        this.logger.warn(
          'Database unavailable (' +
            (error instanceof Error ? error.message : String(error)) +
            '). The API is running without it and will keep retrying in the background.',
        );
      }
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    if (this.stopped) return;
    const delay = this.config.get<number>('database.retryIntervalMs', 15000);
    this.retryTimer = setTimeout(() => void this.connect(), delay);
    // Never keep the process alive just to retry a connection.
    this.retryTimer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }
}
`,

    'src/common/common.module.ts': `import { ClassSerializerInterceptor, Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppThrottlerGuard } from './guards/app-throttler.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    // Guards run in order: rate limit, then authentication, then roles.
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    // Strips @Exclude()d fields (password hashes, tokens) from every response.
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
  ],
})
export class CommonModule {}
`,

    'src/common/decorators/public.decorator.ts': `import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route (or controller) as reachable without a JWT. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
`,

    'src/common/decorators/roles.decorator.ts': `import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../modules/users/entities/user.entity';

export const ROLES_KEY = 'roles';

/** Restricts a route to users with one of the given roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
`,

    'src/common/decorators/current-user.decorator.ts': `import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { User } from '../../modules/users/entities/user.entity';

/** Injects the authenticated user (set by JwtStrategy) into a handler. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): User => {
  const request =
    context.getType<string>() === 'graphql'
      ? GqlExecutionContext.create(context).getContext().req
      : context.switchToHttp().getRequest();
  return request.user;
});
`,

    'src/common/guards/app-throttler.guard.ts': `import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

/** ThrottlerGuard that also understands GraphQL contexts and skips non-HTTP transports. */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const type = context.getType<string>();
    if (type !== 'http' && type !== 'graphql') return true;
    return super.canActivate(context);
  }

  getRequestResponse(context: ExecutionContext) {
    if (context.getType<string>() === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context).getContext();
      return { req: gqlContext.req, res: gqlContext.res };
    }
    const http = context.switchToHttp();
    return { req: http.getRequest(), res: http.getResponse() };
  }
}
`,

    'src/common/guards/roles.guard.ts': `import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../modules/users/entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const type = context.getType<string>();
    if (type !== 'http' && type !== 'graphql') return true;

    const request =
      type === 'graphql'
        ? GqlExecutionContext.create(context).getContext().req
        : context.switchToHttp().getRequest();
    return Boolean(request.user && required.includes(request.user.role));
  }
}
`,

    'src/common/filters/all-exceptions.filter.ts': `import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { throwError } from 'rxjs';
import { DataSource, TypeORMError } from 'typeorm';

/**
 * Turns every error into a consistent JSON body. Database errors raised while
 * the connection is down become a 503 so clients (and the boot check) can tell
 * "dependency unavailable" apart from a bug.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly dataSource: DataSource) {}

  catch(exception: unknown, host: ArgumentsHost): any {
    const type = host.getType<string>();
    if (type !== 'http') {
      // GraphQL (Apollo) and RPC transports format their own errors.
      return type === 'rpc' ? throwError(() => exception) : exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    // Extra fields from the exception's own body (validation details, the
    // Terminus health report, ...) are passed through to the client.
    let body: Record<string, unknown> = { message: 'Internal server error' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionBody = exception.getResponse();
      body = typeof exceptionBody === 'string' ? { message: exceptionBody } : { ...(exceptionBody as Record<string, unknown>) };
    } else if (exception instanceof TypeORMError && !this.dataSource.isInitialized) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      body = { message: 'Database unavailable', code: 'DATABASE_UNAVAILABLE' };
    } else {
      this.logger.error(
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      success: false,
      ...body,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
`,

    'src/common/interceptors/logging.interceptor.ts': `import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<string>() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest();
    const started = Date.now();

    return next.handle().pipe(
      tap(() => {
        const status = http.getResponse().statusCode;
        this.logger.log(request.method + ' ' + request.url + ' ' + status + ' ' + (Date.now() - started) + 'ms');
      }),
    );
  }
}
`,

    'src/health/health.module.ts': `import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DatabaseModule } from '../database/database.module';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, DatabaseModule],
  controllers: [HealthController],
})
export class HealthModule {}
`,

    'src/health/health.controller.ts': `import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '../common/decorators/public.decorator';
import { DatabaseService } from '../database/database.service';

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly database: DatabaseService,
  ) {}

  /** Liveness: 200 whenever the process is up, with dependency state for humans. */
  @Get()
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV ?? 'development',
      database: this.database.isConnected ? 'up' : 'down',
    };
  }

  /** Readiness: 503 until the database answers a ping. */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.db.pingCheck('database', { timeout: 1500 })]);
  }
}
`,

    'src/health/health.controller.spec.ts': `import { Test } from '@nestjs/testing';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseService } from '../database/database.service';

describe('HealthController', () => {
  const build = async (connected: boolean) => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: { check: jest.fn() } },
        { provide: TypeOrmHealthIndicator, useValue: { pingCheck: jest.fn() } },
        { provide: DatabaseService, useValue: { isConnected: connected } },
      ],
    }).compile();
    return moduleRef.get(HealthController);
  };

  it('reports liveness and database state', async () => {
    const controller = await build(false);
    const result = controller.live();
    expect(result.status).toBe('ok');
    expect(result.database).toBe('down');
    expect(typeof result.uptime).toBe('number');
  });

  it('reports a connected database as up', async () => {
    const controller = await build(true);
    expect(controller.live().database).toBe('up');
  });
});
`,

    'src/auth/auth.module.ts': `import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { UsersModule } from '../modules/users/users.module';
import { EmailModule } from '../modules/email/email.module';

@Module({
  imports: [
    UsersModule,
    EmailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.expiresIn', '15m') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, RefreshTokenStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
`,

    'src/auth/auth.controller.ts': `import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { User } from '../modules/users/entities/user.entity';

// Credential endpoints get a much tighter rate limit than the global default.
const STRICT_LIMIT = { default: { limit: 10, ttl: 60000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle(STRICT_LIMIT)
  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Throttle(STRICT_LIMIT)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Request() req: { user: User }, @Body() _loginDto: LoginDto) {
    return this.authService.login(req.user);
  }

  @Public()
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(
    @Request() req: { user: { sub: string; refreshToken: string } },
    @Body() _refreshTokenDto: RefreshTokenDto,
  ) {
    return this.authService.refreshTokens(req.user.sub, req.user.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'User logout' })
  async logout(@CurrentUser() user: User) {
    return this.authService.logout(user.id);
  }

  @Public()
  @Throttle(STRICT_LIMIT)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({ status: 200, description: 'Always succeeds, to avoid revealing which emails exist' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Public()
  @Throttle(STRICT_LIMIT)
  @Post('reset-password/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Param('token') token: string, @Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(token, resetPasswordDto.password);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 400, description: 'Invalid current password' })
  async changePassword(@CurrentUser() user: User, @Body() changePasswordDto: ChangePasswordDto) {
    return this.authService.changePassword(
      user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
  }

  @Public()
  @Get('verify/:token')
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({ status: 400, description: 'Invalid verification token' })
  async verifyEmail(@Param('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user' })
  async getCurrentUser(@CurrentUser() user: User) {
    return user;
  }
}
`,

    'src/auth/auth.service.ts': `import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { User } from '../modules/users/entities/user.entity';
import { UsersService } from '../modules/users/users.service';
import { EmailService } from '../modules/email/email.service';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Tokens are stored as SHA-256 digests. bcrypt is the wrong tool for them: it
 * only reads the first 72 bytes, and every JWT issued to one user shares its
 * first 72 bytes (header and the start of the payload), so a bcrypt hash would
 * accept any token of that user, including revoked ones.
 */
const digest = (value: string): string => createHash('sha256').update(value).digest('hex');

const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (user && user.isActive && (await bcrypt.compare(password, user.password))) {
      return user;
    }
    return null;
  }

  async login(user: User): Promise<{ user: PublicUser } & AuthTokens> {
    const tokens = await this.issueTokens(user);
    return { user: this.toPublicUser(user), ...tokens };
  }

  async register(registerDto: RegisterDto): Promise<{ user: PublicUser } & AuthTokens> {
    const existing = await this.usersService.findByEmail(registerDto.email);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const verificationToken = randomBytes(32).toString('hex');
    const user = await this.usersService.create({
      email: registerDto.email,
      name: registerDto.name,
      password: await bcrypt.hash(registerDto.password, BCRYPT_ROUNDS),
      verificationTokenHash: digest(verificationToken),
      isEmailVerified: false,
    });

    await this.emailService.sendVerificationEmail(user.email, verificationToken);

    const tokens = await this.issueTokens(user);
    return { user: this.toPublicUser(user), ...tokens };
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.usersService.update(userId, { refreshTokenHash: null });
    return { message: 'Logout successful' };
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<AuthTokens> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive || !user.refreshTokenHash || !safeEqual(user.refreshTokenHash, digest(refreshToken))) {
      throw new UnauthorizedException('Access denied');
    }
    // Rotation: the presented refresh token is replaced and can't be used again.
    return this.issueTokens(user);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const message = 'If that email is registered, a password reset link has been sent';
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Same response either way so the endpoint can't be used to enumerate users.
      return { message };
    }

    const resetToken = randomBytes(32).toString('hex');
    await this.usersService.update(user.id, {
      resetTokenHash: digest(resetToken),
      resetTokenExpiry: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });
    await this.emailService.sendPasswordResetEmail(user.email, resetToken);
    return { message };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.usersService.findByResetTokenHash(digest(token));
    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    await this.usersService.update(user.id, {
      password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
      resetTokenHash: null,
      resetTokenExpiry: null,
      // Sign the user out everywhere.
      refreshTokenHash: null,
    });
    return { message: 'Password reset successful' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new BadRequestException('Current password is incorrect');
    }

    await this.usersService.update(userId, {
      password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
      refreshTokenHash: null,
    });
    return { message: 'Password changed successfully' };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.usersService.findByVerificationTokenHash(digest(token));
    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    await this.usersService.update(user.id, { isEmailVerified: true, verificationTokenHash: null });
    return { message: 'Email verified successfully' };
  }

  private toPublicUser(user: User): PublicUser {
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const payload = { sub: user.id, email: user.email };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('jwt.secret'),
        expiresIn: this.configService.get<string>('jwt.expiresIn', '15m'),
      }),
      this.jwtService.signAsync(
        // jwtid makes every refresh token unique, even when issued in the same second.
        { ...payload },
        {
          secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
          expiresIn: this.configService.get<string>('jwt.refreshExpiresIn', '7d'),
          jwtid: randomUUID(),
        },
      ),
    ]);

    await this.usersService.update(user.id, { refreshTokenHash: digest(refreshToken) });
    return { accessToken, refreshToken };
  }
}
`,

    'src/auth/auth.service.spec.ts': `import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { User, UserRole } from '../modules/users/entities/user.entity';

const SECRET = 'unit-test-secret-0123456789';
const REFRESH_SECRET = 'unit-test-refresh-secret-0123456789';

const makeUser = async (overrides: Partial<User> = {}): Promise<User> =>
  Object.assign(new User(), {
    id: 'user-1',
    email: 'ada@example.com',
    name: 'Ada',
    password: await bcrypt.hash('correct horse', 4),
    role: UserRole.USER,
    isActive: true,
    isEmailVerified: false,
    refreshTokenHash: null,
    ...overrides,
  });

describe('AuthService', () => {
  let service: AuthService;
  let store: Map<string, User>;
  let emails: { to: string; token: string }[];

  beforeEach(() => {
    store = new Map();
    emails = [];

    const usersService = {
      findByEmail: async (email: string) => [...store.values()].find((u) => u.email === email.toLowerCase()) ?? null,
      findById: async (id: string) => store.get(id) ?? null,
      findByResetTokenHash: async (hash: string) => [...store.values()].find((u) => u.resetTokenHash === hash) ?? null,
      findByVerificationTokenHash: async (hash: string) =>
        [...store.values()].find((u) => u.verificationTokenHash === hash) ?? null,
      // Mirrors UsersService.create(), which normalises the email address.
      create: async (data: Partial<User> & { email: string }) => {
        const user = Object.assign(
          new User(),
          { id: 'user-' + (store.size + 1), role: UserRole.USER, isActive: true },
          data,
          { email: data.email.toLowerCase() },
        );
        store.set(user.id, user);
        return user;
      },
      update: async (id: string, data: Partial<User>) => {
        const user = store.get(id);
        if (user) Object.assign(user, data);
        return user ?? null;
      },
    };
    const emailService = {
      sendVerificationEmail: async (to: string, token: string) => void emails.push({ to, token }),
      sendPasswordResetEmail: async (to: string, token: string) => void emails.push({ to, token }),
    };
    const config = new ConfigService({
      jwt: { secret: SECRET, refreshSecret: REFRESH_SECRET, expiresIn: '15m', refreshExpiresIn: '7d' },
    });

    service = new AuthService(usersService as never, new JwtService({ secret: SECRET }), config, emailService as never);
  });

  it('registers a user, hashes the password and emails a verification token', async () => {
    const result = await service.register({ email: 'Ada@Example.com', password: 'correct horse', name: 'Ada' });

    expect(result.user.email).toBe('ada@example.com');
    expect(result.accessToken).toBeTruthy();
    const stored = [...store.values()][0];
    expect(stored.password).not.toBe('correct horse');
    expect(await bcrypt.compare('correct horse', stored.password)).toBe(true);
    expect(emails).toHaveLength(1);
    expect(stored.verificationTokenHash).not.toBe(emails[0].token);
  });

  it('rejects a duplicate registration', async () => {
    await service.register({ email: 'ada@example.com', password: 'correct horse', name: 'Ada' });
    await expect(
      service.register({ email: 'ada@example.com', password: 'another one', name: 'Ada 2' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('validates credentials', async () => {
    store.set('user-1', await makeUser());
    expect(await service.validateUser('ada@example.com', 'correct horse')).not.toBeNull();
    expect(await service.validateUser('ada@example.com', 'wrong')).toBeNull();
    expect(await service.validateUser('nobody@example.com', 'correct horse')).toBeNull();
  });

  it('rotates refresh tokens and rejects a reused one', async () => {
    const user = await makeUser();
    store.set(user.id, user);

    const first = await service.login(user);
    const second = await service.refreshTokens(user.id, first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);

    await expect(service.refreshTokens(user.id, first.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.refreshTokens(user.id, second.refreshToken)).resolves.toBeDefined();
  });

  it('answers forgot-password identically for unknown emails', async () => {
    const unknown = await service.forgotPassword('nobody@example.com');
    store.set('user-1', await makeUser());
    const known = await service.forgotPassword('ada@example.com');

    expect(unknown).toEqual(known);
    expect(emails).toHaveLength(1);
  });

  it('resets a password with a valid token only once', async () => {
    store.set('user-1', await makeUser());
    await service.forgotPassword('ada@example.com');
    const { token } = emails[0];

    await service.resetPassword(token, 'brand new password');
    expect(await bcrypt.compare('brand new password', store.get('user-1')!.password)).toBe(true);
    await expect(service.resetPassword(token, 'again')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to change the password when the current one is wrong', async () => {
    store.set('user-1', await makeUser());
    await expect(service.changePassword('user-1', 'nope', 'new password')).rejects.toBeInstanceOf(BadRequestException);
  });
});
`,

    'src/auth/dto/register.dto.ts': `import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  // bcrypt only uses the first 72 bytes of a password.
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}
`,

    'src/auth/dto/login.dto.ts': `import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}
`,

    'src/auth/dto/refresh-token.dto.ts': `import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
`,

    'src/auth/dto/forgot-password.dto.ts': `import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;
}
`,

    'src/auth/dto/reset-password.dto.ts': `import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
`,

    'src/auth/dto/change-password.dto.ts': `import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
`,

    'src/auth/guards/local-auth.guard.ts': `import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
`,

    'src/auth/guards/refresh-token.guard.ts': `import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {}
`,

    'src/auth/guards/jwt-auth.guard.ts': `import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

/**
 * Global guard: every HTTP and GraphQL operation requires a valid access token
 * unless it is marked @Public(). WebSocket and RPC transports authenticate
 * themselves (see EventsGateway), so they are not checked here.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const type = context.getType<string>();
    if (type !== 'http' && type !== 'graphql') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    return super.canActivate(context);
  }

  getRequest(context: ExecutionContext) {
    if (context.getType<string>() === 'graphql') {
      return GqlExecutionContext.create(context).getContext().req;
    }
    return context.switchToHttp().getRequest();
  }
}
`,

    'src/auth/strategies/jwt.strategy.ts': `import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../../modules/users/entities/user.entity';
import { UsersService } from '../../modules/users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.secret'),
    });
  }

  async validate(payload: { sub: string }): Promise<User> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
`,

    'src/auth/strategies/local.strategy.ts': `import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { User } from '../../modules/users/entities/user.entity';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<User> {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }
}
`,

    'src/auth/strategies/refresh-token.strategy.ts': `import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      secretOrKey: config.getOrThrow<string>('jwt.refreshSecret'),
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: { sub: string; email: string }) {
    return { ...payload, refreshToken: (req.body as { refreshToken: string }).refreshToken };
  }
}
`,

    'src/modules/users/entities/user.entity.ts': `import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { ApiHideProperty } from '@nestjs/swagger';
import { Todo } from '../../todos/entities/todo.entity';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  name!: string;

  @Column()
  @Exclude()
  @ApiHideProperty()
  password!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isEmailVerified!: boolean;

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  @ApiHideProperty()
  refreshTokenHash!: string | null;

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  @ApiHideProperty()
  verificationTokenHash!: string | null;

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  @ApiHideProperty()
  resetTokenHash!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  @Exclude()
  @ApiHideProperty()
  resetTokenExpiry!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Todo, (todo) => todo.user)
  todos!: Todo[];
}
`,

    'src/modules/users/users.module.ts': `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
`,

    'src/modules/users/users.service.ts': `import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.toLowerCase() } });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  findByResetTokenHash(resetTokenHash: string): Promise<User | null> {
    return this.users.findOne({ where: { resetTokenHash } });
  }

  findByVerificationTokenHash(verificationTokenHash: string): Promise<User | null> {
    return this.users.findOne({ where: { verificationTokenHash } });
  }

  findAll(): Promise<User[]> {
    return this.users.find({ order: { createdAt: 'DESC' } });
  }

  create(data: Partial<User> & Pick<User, 'email' | 'name' | 'password'>): Promise<User> {
    // repository.create() builds a real entity instance (a plain object would
    // skip TypeORM entity listeners); the email is normalised here.
    return this.users.save(this.users.create({ ...data, email: data.email.toLowerCase() }));
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    await this.users.update(id, data as never);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.users.delete(id);
    if (!result.affected) {
      throw new NotFoundException('User not found');
    }
  }
}
`,

    'src/modules/users/users.controller.ts': `import { Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { User, UserRole } from './entities/user.entity';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() current: User): Promise<User> {
    if (current.id !== id && current.role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.usersService.remove(id);
  }
}
`,

    'src/modules/todos/entities/todo.entity.ts': `import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum TodoStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export enum TodoPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

@Entity('todos')
export class Todo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: TodoStatus, default: TodoStatus.PENDING })
  status!: TodoStatus;

  @Column({ type: 'enum', enum: TodoPriority, default: TodoPriority.MEDIUM })
  priority!: TodoPriority;

  @Column({ type: 'timestamp', nullable: true })
  dueDate!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  tags!: string[] | null;

  @Column({ default: false })
  isArchived!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column()
  userId!: string;

  @ManyToOne(() => User, (user) => user.todos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
`,

    'src/modules/todos/dto/create-todo.dto.ts': `import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TodoPriority, TodoStatus } from '../entities/todo.entity';

export class CreateTodoDto {
  @ApiProperty({ example: 'Write the docs' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: TodoStatus })
  @IsOptional()
  @IsEnum(TodoStatus)
  status?: TodoStatus;

  @ApiPropertyOptional({ enum: TodoPriority })
  @IsOptional()
  @IsEnum(TodoPriority)
  priority?: TodoPriority;

  @ApiPropertyOptional({ example: '2030-01-31T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
`,

    'src/modules/todos/dto/update-todo.dto.ts': `import { PartialType } from '@nestjs/swagger';
import { CreateTodoDto } from './create-todo.dto';

export class UpdateTodoDto extends PartialType(CreateTodoDto) {}
`,

    'src/modules/todos/todos.module.ts': `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Todo } from './entities/todo.entity';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Todo])],
  controllers: [TodosController],
  providers: [TodosService],
})
export class TodosModule {}
`,

    'src/modules/todos/todos.service.ts': `import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Todo } from './entities/todo.entity';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';

/** Every query is scoped to the owning user, so one user can't touch another's todos. */
@Injectable()
export class TodosService {
  constructor(
    @InjectRepository(Todo)
    private readonly todos: Repository<Todo>,
  ) {}

  findAll(userId: string): Promise<Todo[]> {
    return this.todos.find({ where: { userId, isArchived: false }, order: { createdAt: 'DESC' } });
  }

  async findOne(userId: string, id: string): Promise<Todo> {
    const todo = await this.todos.findOne({ where: { id, userId } });
    if (!todo) {
      throw new NotFoundException('Todo not found');
    }
    return todo;
  }

  create(userId: string, dto: CreateTodoDto): Promise<Todo> {
    return this.todos.save(
      this.todos.create({
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        userId,
      }),
    );
  }

  async update(userId: string, id: string, dto: UpdateTodoDto): Promise<Todo> {
    const todo = await this.findOne(userId, id);
    const { dueDate, ...rest } = dto;
    Object.assign(todo, rest);
    if (dueDate !== undefined) {
      todo.dueDate = dueDate ? new Date(dueDate) : null;
    }
    return this.todos.save(todo);
  }

  async remove(userId: string, id: string): Promise<void> {
    const todo = await this.findOne(userId, id);
    await this.todos.remove(todo);
  }
}
`,

    'src/modules/todos/todos.controller.ts': `import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TodosService } from './todos.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { Todo } from './entities/todo.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('todos')
@ApiBearerAuth()
@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get()
  findAll(@CurrentUser() user: User): Promise<Todo[]> {
    return this.todosService.findAll(user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateTodoDto): Promise<Todo> {
    return this.todosService.create(user.id, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<Todo> {
    return this.todosService.findOne(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTodoDto,
  ): Promise<Todo> {
    return this.todosService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.todosService.remove(user.id, id);
  }
}
`,

    'src/modules/email/email.module.ts': `import { Module } from '@nestjs/common';
import { EmailService } from './email.service';

@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
`,

    'src/modules/email/email.service.ts': `import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Sends transactional email over SMTP when SMTP_HOST is configured. Without it
 * messages are not delivered; the service logs that fact (and, outside
 * production, the message body so verification and reset links can be copied
 * during development). A mail failure never fails the request that triggered it.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private readonly appUrl: string;
  private readonly isProduction: boolean;

  constructor(config: ConfigService) {
    const host = config.get<string>('email.host');
    this.from = config.get<string>('email.from', 'noreply@example.com');
    this.appUrl = config.get<string>('email.appUrl', 'http://localhost:3000');
    this.isProduction = config.get<string>('environment') === 'production';
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: config.get<number>('email.port', 587),
          secure: config.get<boolean>('email.secure', false),
          auth: config.get<string>('email.user')
            ? { user: config.get<string>('email.user'), pass: config.get<string>('email.pass') }
            : undefined,
        })
      : null;
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const link = this.appUrl + '/api/v1/auth/verify/' + token;
    await this.send(to, 'Verify your email address', 'Verify your email address: ' + link);
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const link = this.appUrl + '/reset-password?token=' + token;
    await this.send(to, 'Reset your password', 'Reset your password (valid for one hour): ' + link);
  }

  private async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('SMTP_HOST is not set: email "' + subject + '" to ' + to + ' was not sent');
      if (!this.isProduction) this.logger.debug(text);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
    } catch (error) {
      this.logger.error(
        'Failed to send email "' + subject + '" to ' + to + ': ' + (error instanceof Error ? error.message : String(error)),
      );
    }
  }
}
`,

    'src/modules/files/file.module.ts': `import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { ALLOWED_MIME_TYPES } from './file.constants';

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: diskStorage({
          // multer creates the directory when given a string path.
          destination: config.get<string>('upload.uploadDir', './uploads'),
          // Never trust the client's file name: random name, sanitised extension.
          filename: (_req, file, callback) => {
            const extension = extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 9);
            callback(null, randomUUID() + extension);
          },
        }),
        limits: { fileSize: config.get<number>('upload.maxFileSize', 10 * 1024 * 1024), files: 1 },
        fileFilter: (_req, file, callback) => {
          callback(null, ALLOWED_MIME_TYPES.includes(file.mimetype));
        },
      }),
    }),
  ],
  controllers: [FileController],
  providers: [FileService],
})
export class FileModule {}
`,

    'src/modules/files/file.constants.ts': `export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
];

/** Stored names are generated server-side: a UUID plus a short extension. */
export const STORED_FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\\.[a-z0-9]{1,8})?$/;
`,

    'src/modules/files/file.service.ts': `import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { STORED_FILE_NAME } from './file.constants';

@Injectable()
export class FileService {
  private readonly uploadDir: string;

  constructor(config: ConfigService) {
    this.uploadDir = resolve(config.get<string>('upload.uploadDir', './uploads'));
  }

  /** Resolves a stored file name to a path inside the upload directory. */
  resolveStoredFile(name: string): { root: string; name: string } {
    if (!STORED_FILE_NAME.test(name)) {
      throw new BadRequestException('Invalid file name');
    }
    if (!existsSync(join(this.uploadDir, name))) {
      throw new NotFoundException('File not found');
    }
    return { root: this.uploadDir, name };
  }
}
`,

    'src/modules/files/file.controller.ts': `import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { FileService } from './file.service';
import { ALLOWED_MIME_TYPES } from './file.constants';

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('A file is required (allowed types: ' + ALLOWED_MIME_TYPES.join(', ') + ')');
    }
    return { filename: file.filename, size: file.size, mimetype: file.mimetype, url: '/api/v1/files/' + file.filename };
  }

  @Get(':filename')
  download(@Param('filename') filename: string, @Res() res: Response): void {
    const { root, name } = this.fileService.resolveStoredFile(filename);
    res.sendFile(name, { root });
  }
}
`,

    'src/modules/events/events.module.ts': `import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { EventsGateway } from './events.gateway';

@Module({
  imports: [AuthModule],
  providers: [EventsGateway],
})
export class EventsModule {}
`,

    'src/modules/events/events.gateway.ts': `import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Socket.IO gateway on the /events namespace. Clients authenticate during the
 * handshake with their access token: io('/events', { auth: { token } }).
 */
@WebSocketGateway({ namespace: '/events', cors: { origin: true, credentials: true } })
export class EventsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = (client.handshake.auth as { token?: string } | undefined)?.token;
    try {
      if (!token) throw new Error('missing token');
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token, {
        secret: this.config.getOrThrow<string>('jwt.secret'),
      });
      client.data.userId = payload.sub;
    } catch {
      this.logger.warn('Rejected unauthenticated socket ' + client.id);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('ping')
  onPing(@MessageBody() data: unknown) {
    return { event: 'pong', data };
  }
}
`,

    'test/jest-e2e.json': `{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\\\.(t|j)s$": "ts-jest"
  },
  "testTimeout": 30000
}
`,

    'test/app.e2e-spec.ts': `import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

// These tests run with no database available, which is the state a fresh
// checkout is in: the app must still boot, and database-backed routes must
// fail with an explicit 503 rather than hanging or crashing.
describe('App (e2e, no database)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health', 'health/ready'] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health is a liveness probe', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /health/ready reports the missing database', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready').expect(503);
    expect(res.body.status).toBe('error');
  });

  it('POST /graphql answers introspection-free queries', async () => {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ __typename hello health }' })
      .expect(200);
    expect(res.body.data).toEqual({ __typename: 'Query', hello: 'Hello from GraphQL!', health: 'healthy' });
  });

  it('rejects protected routes without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/todos').expect(401);
  });

  it('validates request bodies before touching the database', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'x' })
      .expect(400);
  });

  it('answers 503 (not 500) when a route needs the unavailable database', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'ada@example.com', password: 'correct horse' })
      .expect(503);
    expect(res.body.code).toBe('DATABASE_UNAVAILABLE');
  });
});
`,

    '.env.example': `# Application
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Database (PostgreSQL). The API starts without it and keeps retrying.
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE={{projectName}}
DB_SSL=false
DB_RETRY_INTERVAL_MS=15000

# JWT (required in production, at least 16 characters each)
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change-me-to-another-long-random-string
JWT_REFRESH_EXPIRES_IN=7d

# Email (optional). Without SMTP_HOST messages are logged, not sent.
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@example.com

# Rate limiting (TTL in seconds)
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# File uploads
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Microservice transport: none | tcp | kafka | rmq
MICROSERVICE_TRANSPORT=none
MICROSERVICE_HOST=0.0.0.0
MICROSERVICE_PORT=4000
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID={{projectName}}-consumer
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_QUEUE={{projectName}}
`,

    'Dockerfile': `# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build && npm prune --omit=dev

# Production stage
FROM node:20-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json

RUN mkdir -p uploads && chown node:node uploads
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
`,

    'docker-compose.yml': `services:
  app:
    build: .
    container_name: {{projectName}}-api
    ports:
      - "\${PORT:-3000}:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USERNAME=\${DB_USERNAME:-postgres}
      - DB_PASSWORD=\${DB_PASSWORD:-postgres}
      - DB_DATABASE=\${DB_DATABASE:-{{projectName}}}
      - JWT_SECRET=\${JWT_SECRET:?set JWT_SECRET (at least 16 characters)}
      - JWT_REFRESH_SECRET=\${JWT_REFRESH_SECRET:?set JWT_REFRESH_SECRET (at least 16 characters)}
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - uploads:/app/uploads
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    container_name: {{projectName}}-db
    environment:
      - POSTGRES_USER=\${DB_USERNAME:-postgres}
      - POSTGRES_PASSWORD=\${DB_PASSWORD:-postgres}
      - POSTGRES_DB=\${DB_DATABASE:-{{projectName}}}
    ports:
      - "\${DB_PORT:-5432}:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USERNAME:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres-data:
  uploads:
`,

    '.dockerignore': `node_modules/
npm-debug.log*
coverage/
dist/
*.tsbuildinfo
.env
.env.*
!.env.example
.vscode/
.idea/
.DS_Store
logs/
*.log
.git/
uploads/
Dockerfile
docker-compose.yml
.dockerignore
`,

    'README.md': `# {{projectName}}

NestJS API server with a modular architecture: JWT authentication, TypeORM on PostgreSQL, GraphQL, WebSockets, file uploads, health checks and Swagger docs.

## Features

- Modular architecture with dependency injection
- JWT authentication with rotating refresh tokens, password reset and email verification
- TypeORM with PostgreSQL. The connection opens in the background, so the API boots without a database
- GraphQL (Apollo, code-first) at \`/graphql\`
- REST API versioned under \`/api/v1\`, documented with Swagger at \`/api/docs\`
- Socket.IO gateway on the \`/events\` namespace (authenticated during the handshake)
- Optional microservice transport (TCP, Kafka or RabbitMQ) selected with \`MICROSERVICE_TRANSPORT\`
- File uploads (type and size limits, server-generated file names)
- Rate limiting, Helmet, CORS and request validation (class-validator)
- Health checks: \`GET /health\` (liveness) and \`GET /health/ready\` (readiness, 503 until the database answers)
- Jest unit and end-to-end tests that run without any external service

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL (optional to boot, required for anything that stores data)
- Docker (optional)

### Installation

1. Install dependencies:
   \`\`\`bash
   pnpm install
   \`\`\`

2. Set up environment variables (optional in development, every value has a development default):
   \`\`\`bash
   cp .env.example .env
   \`\`\`

3. Start PostgreSQL (for example \`docker compose up -d postgres\`), then start the dev server. In development the schema is created automatically (\`synchronize\`):
   \`\`\`bash
   pnpm run dev
   \`\`\`

For production, set \`NODE_ENV=production\`, provide \`JWT_SECRET\` and \`JWT_REFRESH_SECRET\`, and use migrations instead of \`synchronize\`:

\`\`\`bash
pnpm run build
pnpm run migration:run
pnpm run start:prod
\`\`\`

### Running with Docker

\`\`\`bash
JWT_SECRET=<16+ chars> JWT_REFRESH_SECRET=<16+ chars> docker compose up --build
\`\`\`

## Endpoints

| Endpoint | Description |
| --- | --- |
| \`GET /health\` | Liveness probe |
| \`GET /health/ready\` | Readiness probe (database ping) |
| \`POST /graphql\` | GraphQL API (\`hello\`, \`health\` queries) |
| \`POST /api/v1/auth/register\` | Register |
| \`POST /api/v1/auth/login\` | Log in |
| \`POST /api/v1/auth/refresh\` | Rotate tokens |
| \`GET /api/v1/auth/me\` | Current user |
| \`GET/POST /api/v1/todos\`, \`GET/PATCH/DELETE /api/v1/todos/:id\` | Todos of the current user |
| \`GET /api/v1/users\` | List users (admin only) |
| \`POST /api/v1/files/upload\`, \`GET /api/v1/files/:filename\` | File upload and download |
| \`GET /api/docs\` | Swagger UI (not served in production) |

A route that needs the database answers \`503\` with \`{"code":"DATABASE_UNAVAILABLE"}\` until the connection is up.

## Testing

\`\`\`bash
pnpm run test       # unit tests
pnpm run test:e2e   # end-to-end tests (run without a database)
pnpm run typecheck
\`\`\`

## Project Structure

\`\`\`
src/
├── auth/           # Authentication (controller, service, strategies, guards, DTOs)
├── common/         # Global guards, filters, interceptors and decorators
├── config/         # Configuration, validation and TypeORM CLI data source
├── database/       # Database module and background connection service
├── health/         # Liveness and readiness endpoints
├── microservice/   # Sample message handler for the optional transport
├── modules/
│   ├── users/      # Users
│   ├── todos/      # Todos
│   ├── email/      # Email delivery (SMTP, or logged when not configured)
│   ├── files/      # File uploads
│   └── events/     # Socket.IO gateway
├── app.module.ts   # Root module
└── main.ts         # Application entry
\`\`\`

## Scripts

- \`pnpm run dev\` - start in watch mode
- \`pnpm run build\` - compile to \`dist/\`
- \`pnpm run start:prod\` - run the compiled build
- \`pnpm run test\`, \`pnpm run test:e2e\`, \`pnpm run test:cov\`
- \`pnpm run lint\`, \`pnpm run format\`, \`pnpm run typecheck\`
- \`pnpm run migration:generate\`, \`pnpm run migration:run\`, \`pnpm run migration:revert\`

## License

MIT
`
  }
};
