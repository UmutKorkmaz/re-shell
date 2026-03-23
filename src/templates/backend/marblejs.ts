import { BackendTemplate } from '../types';

export const marblejsTemplate: BackendTemplate = {
  id: 'marblejs',
  name: 'marblejs',
  displayName: 'Marble.js',
  description: 'Functional reactive Node.js framework built on TypeScript and RxJS for building server applications',
  language: 'typescript',
  framework: 'marblejs',
  version: '4.1.0',
  tags: ['nodejs', 'marblejs', 'rxjs', 'functional', 'reactive', 'api', 'websockets', 'microservices', 'microservices', 'typescript'],
  port: 3000,
  dependencies: {},
  features: ['streaming', 'streaming', 'middleware', 'middleware', 'websockets', 'microservices', 'queue', 'database', 'testing'],
  
  files: {
    // Package configuration
    'package.json': `{
  "name": "{{projectName}}",
  "version": "0.0.1",
  "description": "Marble.js functional reactive backend with RxJS",
  "author": "",
  "private": true,
  "license": "MIT",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "start:dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "start:prod": "node dist/index.js",
    "test": "jest --runInBand",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "lint": "eslint 'src/**/*.ts'",
    "format": "prettier --write 'src/**/*.ts'",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@marblejs/core": "^4.1.0",
    "@marblejs/http": "^4.1.0",
    "@marblejs/middleware-body": "^4.1.0",
    "@marblejs/middleware-cors": "^4.1.0",
    "@marblejs/middleware-io": "^4.1.0",
    "@marblejs/middleware-jwt": "^4.1.0",
    "@marblejs/middleware-logger": "^4.1.0",
    "@marblejs/middleware-multipart": "^4.1.0",
    "@marblejs/messaging": "^4.1.0",
    "@marblejs/websockets": "^4.1.0",
    "@marblejs/testing": "^4.1.0",
    "rxjs": "^7.8.1",
    "fp-ts": "^2.16.5",
    "io-ts": "^2.2.21",
    "io-ts-types": "^0.5.19",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.4.5",
    "jsonwebtoken": "^9.0.2",
    "uuid": "^9.0.1",
    "pg": "^8.11.5",
    "typeorm": "^0.3.20",
    "caching": "^4.6.13",
    "amqplib": "^0.10.4",
    "nodemailer": "^6.9.13",
    "winston": "^3.13.0",
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "express-rate-limit": "^7.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.7",
    "@types/jest": "^29.5.12",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/compression": "^1.7.5",
    "@types/amqplib": "^0.10.5",
    "@types/nodemailer": "^6.4.14",
    "@typescript-eslint/eslint-plugin": "^7.7.1",
    "@typescript-eslint/parser": "^7.7.1",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-prettier": "^5.1.3",
    "jest": "^29.7.0",
    "prettier": "^3.2.5",
    "ts-jest": "^29.1.2",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.4.5",
    "supertest": "^7.0.0"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
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
}`,

    // TypeScript configuration
    'tsconfig.json': `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2021",
    "lib": ["ES2021"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "paths": {
      "@/*": ["src/*"],
      "@effects/*": ["src/effects/*"],
      "@middlewares/*": ["src/middlewares/*"],
      "@models/*": ["src/models/*"],
      "@services/*": ["src/services/*"],
      "@utils/*": ["src/utils/*"]
    },
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}`,

    // Main application entry
    'src/index.ts': `import { createServer } from '@marblejs/http';
import { IO } from 'fp-ts/lib/IO';
import { listener } from './http.listener';
import { logger } from './utils/logger.util';
import { config } from './config';

const server = createServer({
  port: config.port,
  hostname: config.hostname,
  listener,
  options: {
    httpsOptions: config.httpsOptions}});

const main: IO<void> = async () => {
  await server();
  logger.info(\`🚀 Server is running on http://\${config.hostname}:\${config.port}\`);
};

main();`,

    // HTTP Listener
    'src/http.listener.ts': `import { httpListener } from '@marblejs/http';
import { logger$ } from '@marblejs/middleware-logger';
import { bodyParser$ } from '@marblejs/middleware-body';
import { cors$ } from '@marblejs/middleware-cors';
import { helmet$ } from './middlewares/helmet.middleware';
import { compression$ } from './middlewares/compression.middleware';
import { requestValidator$ } from './middlewares/validator.middleware';
import { error$ } from './middlewares/error.middleware';
import { api$ } from './effects/api.effects';

export const listener = httpListener({
  middlewares: [
    logger$({
      silent: process.env.NODE_ENV === 'test'}),
    bodyParser$(),
    cors$({
      origin: process.env.CORS_ORIGINS?.split(',') || '*',
      credentials: true}),
    helmet$,
    compression$,
    requestValidator$],
  effects: [api$],
  error$});`,

    // API Effects
    'src/effects/api.effects.ts': `import { r } from '@marblejs/http';
import { combineRoutes } from '@marblejs/http';
import { authEffects$ } from './auth.effects';
import { userEffects$ } from './user.effects';
import { todoEffects$ } from './todo.effects';
import { healthEffect$ } from './health.effects';
import { websocketEffect$ } from './websocket.effects';

export const api$ = combineRoutes('/api/v1', [
  authEffects$,
  userEffects$,
  todoEffects$,
  healthEffect$,
  websocketEffect$]);`,

    // Auth Effects
    'src/effects/auth.effects.ts': `import { r, HttpError, HttpStatus } from '@marblejs/http';
import { map, mergeMap, catchError } from 'rxjs/operators';
import { of, throwError } from 'rxjs';
import * as t from 'io-ts';
import { authService } from '../services/auth.service';
import { generateToken } from '../utils/jwt.util';
import { hashPassword, comparePassword } from '../utils/crypto.util';
import { requestValidator$ } from '../middlewares/validator.middleware';

// Validation schemas
const LoginDto = t.type({
  email: t.string,
  password: t.string});

const RegisterDto = t.type({
  email: t.string,
  password: t.string,
  name: t.string});

const RefreshTokenDto = t.type({
  refreshToken: t.string});

// Login effect
const login$ = r.pipe(
  r.matchPath('/login'),
  r.matchType('POST'),
  r.useEffect((req$) =>
    req$.pipe(
      requestValidator$({ body: LoginDto }),
      mergeMap((req) =>
        authService.validateUser(req.body.email, req.body.password).pipe(
          map((user) => ({
            body: {
              user: {
                id: user.id,
                email: user.email,
                name: user.name},
              accessToken: generateToken({ sub: user.id, email: user.email }),
              refreshToken: generateToken({ sub: user.id, email: user.email }, '7d')}})),
          catchError(() =>
            throwError(() => new HttpError('Invalid credentials', HttpStatus.UNAUTHORIZED))
          ),
        )
      ),
    )
  ),
);

// Register effect
const register$ = r.pipe(
  r.matchPath('/register'),
  r.matchType('POST'),
  r.useEffect((req$) =>
    req$.pipe(
      requestValidator$({ body: RegisterDto }),
      mergeMap((req) =>
        authService.createUser(req.body).pipe(
          map((user) => ({
            body: {
              user: {
                id: user.id,
                email: user.email,
                name: user.name},
              accessToken: generateToken({ sub: user.id, email: user.email }),
              refreshToken: generateToken({ sub: user.id, email: user.email }, '7d')}})),
          catchError((error) =>
            throwError(() => new HttpError(error.message, HttpStatus.BAD_REQUEST))
          ),
        )
      ),
    )
  ),
);

// Refresh token effect
const refreshToken$ = r.pipe(
  r.matchPath('/refresh'),
  r.matchType('POST'),
  r.useEffect((req$) =>
    req$.pipe(
      requestValidator$({ body: RefreshTokenDto }),
      mergeMap((req) =>
        authService.refreshToken(req.body.refreshToken).pipe(
          map((tokens) => ({
            body: tokens})),
          catchError(() =>
            throwError(() => new HttpError('Invalid refresh token', HttpStatus.UNAUTHORIZED))
          ),
        )
      ),
    )
  ),
);

// Logout effect
const logout$ = r.pipe(
  r.matchPath('/logout'),
  r.matchType('POST'),
  r.useEffect((req$) =>
    req$.pipe(
      map(() => ({
        body: { message: 'Logout successful' }})),
    )
  ),
);

export const authEffects$ = combineRoutes('/auth', [
  login$,
  register$,
  refreshToken$,
  logout$]);`,

    // User Effects
    'src/effects/user.effects.ts': `import { r, HttpError, HttpStatus } from '@marblejs/http';
import { map, mergeMap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import * as t from 'io-ts';
import { authorize$ } from '../middlewares/auth.middleware';
import { requestValidator$ } from '../middlewares/validator.middleware';
import { userService } from '../services/user.service';

// Validation schemas
const UpdateUserDto = t.partial({
  name: t.string,
  email: t.string});

// Get current user effect
const getMe$ = r.pipe(
  r.matchPath('/me'),
  r.matchType('GET'),
  r.useEffect((req$) =>
    req$.pipe(
      authorize$,
      map((req) => ({
        body: req.user})),
    )
  ),
);

// Get all users effect (admin only)
const getUsers$ = r.pipe(
  r.matchPath('/'),
  r.matchType('GET'),
  r.useEffect((req$) =>
    req$.pipe(
      authorize$,
      mergeMap(() =>
        userService.findAll().pipe(
          map((users) => ({
            body: { users }})),
        )
      ),
    )
  ),
);

// Get user by ID effect
const getUserById$ = r.pipe(
  r.matchPath('/:id'),
  r.matchType('GET'),
  r.useEffect((req$) =>
    req$.pipe(
      authorize$,
      mergeMap((req) =>
        userService.findById(req.params.id).pipe(
          map((user) => ({
            body: user})),
          catchError(() =>
            throwError(() => new HttpError('User not found', HttpStatus.NOT_FOUND))
          ),
        )
      ),
    )
  ),
);

// Update user effect
const updateUser$ = r.pipe(
  r.matchPath('/:id'),
  r.matchType('PUT'),
  r.useEffect((req$) =>
    req$.pipe(
      authorize$,
      requestValidator$({ body: UpdateUserDto }),
      mergeMap((req) =>
        userService.update(req.params.id, req.body).pipe(
          map((user) => ({
            body: user})),
          catchError((error) =>
            throwError(() => new HttpError(error.message, HttpStatus.BAD_REQUEST))
          ),
        )
      ),
    )
  ),
);

// Delete user effect
const deleteUser$ = r.pipe(
  r.matchPath('/:id'),
  r.matchType('DELETE'),
  r.useEffect((req$) =>
    req$.pipe(
      authorize$,
      mergeMap((req) =>
        userService.delete(req.params.id).pipe(
          map(() => ({
            status: HttpStatus.NO_CONTENT,
            body: {}})),
          catchError(() =>
            throwError(() => new HttpError('User not found', HttpStatus.NOT_FOUND))
          ),
        )
      ),
    )
  ),
);

export const userEffects$ = combineRoutes('/users', [
  getMe$,
  getUsers$,
  getUserById$,
  updateUser$,
  deleteUser$]);`,

    // Todo Effects
    'src/effects/todo.effects.ts': `import { r, HttpError, HttpStatus } from '@marblejs/http';
import { map, mergeMap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import * as t from 'io-ts';
import { authorize$ } from '../middlewares/auth.middleware';
import { requestValidator$ } from '../middlewares/validator.middleware';
import { todoService } from '../services/todo.service';

// Validation schemas
const CreateTodoDto = t.type({
  title: t.string,
  description: t.union([t.string, t.undefined]),
  dueDate: t.union([t.string, t.undefined]),
  priority: t.union([t.literal('low'), t.literal('medium'), t.literal('high')])});

const UpdateTodoDto = t.partial({
  title: t.string,
  description: t.string,
  status: t.union([t.literal('pending'), t.literal('in_progress'), t.literal('completed')]),
  priority: t.union([t.literal('low'), t.literal('medium'), t.literal('high')]),
  dueDate: t.string});

// Get all todos effect
const getTodos$ = r.pipe(
  r.matchPath('/'),
  r.matchType('GET'),
  r.useEffect((req$) =>
    req$.pipe(
      authorize$,
      mergeMap((req) =>
        todoService.findAllByUser(req.user.id).pipe(
          map((todos) => ({
            body: { todos }})),
        )
      ),
    )
  ),
);

// Get todo by ID effect
const getTodoById$ = r.pipe(
  r.matchPath('/:id'),
  r.matchType('GET'),
  r.useEffect((req$) =>
    req$.pipe(
      authorize$,
      mergeMap((req) =>
        todoService.findById(req.params.id, req.user.id).pipe(
          map((todo) => ({
            body: todo})),
          catchError(() =>
            throwError(() => new HttpError('Todo not found', HttpStatus.NOT_FOUND))
          ),
        )
      ),
    )
  ),
);

// Create todo effect
const createTodo$ = r.pipe(
  r.matchPath('/'),
  r.matchType('POST'),
  r.useEffect((req$) =>
    req$.pipe(
      authorize$,
      requestValidator$({ body: CreateTodoDto }),
      mergeMap((req) =>
        todoService.create({ ...req.body, userId: req.user.id }).pipe(
          map((todo) => ({
            status: HttpStatus.CREATED,
            body: todo})),
          catchError((error) =>
            throwError(() => new HttpError(error.message, HttpStatus.BAD_REQUEST))
          ),
        )
      ),
    )
  ),
);

// Update todo effect
const updateTodo$ = r.pipe(
  r.matchPath('/:id'),
  r.matchType('PUT'),
  r.useEffect((req$) =>
    req$.pipe(
      authorize$,
      requestValidator$({ body: UpdateTodoDto }),
      mergeMap((req) =>
        todoService.update(req.params.id, req.user.id, req.body).pipe(
          map((todo) => ({
            body: todo})),
          catchError((error) =>
            throwError(() => new HttpError(error.message, HttpStatus.BAD_REQUEST))
          ),
        )
      ),
    )
  ),
);

// Delete todo effect
const deleteTodo$ = r.pipe(
  r.matchPath('/:id'),
  r.matchType('DELETE'),
  r.useEffect((req$) =>
    req$.pipe(
      authorize$,
      mergeMap((req) =>
        todoService.delete(req.params.id, req.user.id).pipe(
          map(() => ({
            status: HttpStatus.NO_CONTENT,
            body: {}})),
          catchError(() =>
            throwError(() => new HttpError('Todo not found', HttpStatus.NOT_FOUND))
          ),
        )
      ),
    )
  ),
);

export const todoEffects$ = combineRoutes('/todos', [
  getTodos$,
  getTodoById$,
  createTodo$,
  updateTodo$,
  deleteTodo$]);`,

    // Health Effect
    'src/effects/health.effects.ts': `import { r } from '@marblejs/http';
import { map, mergeMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { dbService } from '../services/db.service';
import { redisService } from '../services/redis.service';

export const healthEffect$ = r.pipe(
  r.matchPath('/health'),
  r.matchType('GET'),
  r.useEffect((req$) =>
    req$.pipe(
      mergeMap(() =>
        Promise.all([
          dbService.checkConnection().toPromise(),
          redisService.checkConnection().toPromise()]).then(([dbStatus, redisStatus]) =>
          of({
            body: {
              status: 'ok',
              timestamp: new Date().toISOString(),
              uptime: process.uptime(),
              services: {
                database: dbStatus ? 'healthy' : 'unhealthy',
                redis: redisStatus ? 'healthy' : 'unhealthy'}}})
        )
      ),
    )
  ),
);`,

    // WebSocket Effects
    'src/effects/websocket.effects.ts': `import { webSocketListener } from '@marblejs/websockets';
import { map } from 'rxjs/operators';
import { matchEvent } from '@marblejs/core';

const echo$ = matchEvent('echo')
  .pipe(
    map((event) => ({
      type: 'echo_response',
      payload: event.payload}))
  );

const broadcast$ = matchEvent('broadcast')
  .pipe(
    map((event) => ({
      type: 'broadcast_message',
      payload: {
        message: event.payload.message,
        timestamp: new Date().toISOString()}}))
  );

export const websocketEffect$ = webSocketListener({
  effects: [echo$, broadcast$]});`,

    // Auth Middleware
    'src/middlewares/auth.middleware.ts': `import { HttpMiddlewareEffect, HttpError, HttpStatus } from '@marblejs/http';
import { map, mergeMap, catchError } from 'rxjs/operators';
import { of, throwError } from 'rxjs';
import { verifyToken } from '../utils/jwt.util';
import { userService } from '../services/user.service';

export const authorize$: HttpMiddlewareEffect = (req$) =>
  req$.pipe(
    mergeMap((req) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return throwError(() => new HttpError('No token provided', HttpStatus.UNAUTHORIZED));
      }

      try {
        const decoded = verifyToken(token);
        return userService.findById(decoded.sub).pipe(
          map((user) => ({
            ...req,
            user})),
          catchError(() =>
            throwError(() => new HttpError('User not found', HttpStatus.UNAUTHORIZED))
          ),
        );
      } catch (error) {
        return throwError(() => new HttpError('Invalid token', HttpStatus.UNAUTHORIZED));
      }
    }),
  );

export const authorizeRoles$ = (roles: string[]): HttpMiddlewareEffect => (req$) =>
  req$.pipe(
    authorize$,
    mergeMap((req) => {
      if (!roles.includes(req.user.role)) {
        return throwError(() => new HttpError('Forbidden', HttpStatus.FORBIDDEN));
      }
      return of(req);
    }),
  );`,

    // Validator Middleware
    'src/middlewares/validator.middleware.ts': `import { HttpMiddlewareEffect, HttpError, HttpStatus } from '@marblejs/http';
import { map, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import * as t from 'io-ts';
import { PathReporter } from 'io-ts/lib/PathReporter';
import { fold } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';

interface ValidatorOptions {
  body?: t.Type<any>;
  params?: t.Type<any>;
  query?: t.Type<any>;
}

export const requestValidator$ = (options: ValidatorOptions): HttpMiddlewareEffect => (req$) =>
  req$.pipe(
    map((req) => {
      const errors: string[] = [];

      if (options.body) {
        pipe(
          options.body.decode(req.body),
          fold(
            (e) => errors.push(...PathReporter.report({ _tag: 'Left', left: e })),
            () => {},
          ),
        );
      }

      if (options.params) {
        pipe(
          options.params.decode(req.params),
          fold(
            (e) => errors.push(...PathReporter.report({ _tag: 'Left', left: e })),
            () => {},
          ),
        );
      }

      if (options.query) {
        pipe(
          options.query.decode(req.query),
          fold(
            (e) => errors.push(...PathReporter.report({ _tag: 'Left', left: e })),
            () => {},
          ),
        );
      }

      if (errors.length > 0) {
        throw new HttpError(errors.join(', '), HttpStatus.BAD_REQUEST);
      }

      return req;
    }),
    catchError((error) => throwError(() => error)),
  );`,

    // Error Middleware
    'src/middlewares/error.middleware.ts': `import { HttpError, HttpErrorEffect, HttpStatus } from '@marblejs/http';
import { map } from 'rxjs/operators';
import { logger } from '../utils/logger.util';

export const error$: HttpErrorEffect = (req$, res) =>
  req$.pipe(
    map((error) => {
      const status = error instanceof HttpError ? error.status : HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error instanceof HttpError ? error.message : 'Internal server error';
      
      logger.error(\`[\${status}] \${message}\`, {
        error: error.stack,
        url: res.url,
        method: res.method});

      return {
        status,
        body: {
          error: {
            status,
            message,
            timestamp: new Date().toISOString()}}};
    }),
  );`,

    // Helmet Middleware
    'src/middlewares/helmet.middleware.ts': `import { HttpMiddlewareEffect } from '@marblejs/http';
import { map } from 'rxjs/operators';
import helmet from 'helmet';

export const helmet$: HttpMiddlewareEffect = (req$) =>
  req$.pipe(
    map((req) => {
      helmet()(req, req.res, () => {});
      return req;
    }),
  );`,

    // Compression Middleware
    'src/middlewares/compression.middleware.ts': `import { HttpMiddlewareEffect } from '@marblejs/http';
import { map } from 'rxjs/operators';
import compression from 'compression';

export const compression$: HttpMiddlewareEffect = (req$) =>
  req$.pipe(
    map((req) => {
      compression()(req, req.res, () => {});
      return req;
    }),
  );`,

    // User Service
    'src/services/user.service.ts': `import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { getRepository } from 'typeorm';
import { User } from '../models/user.model';
import { hashPassword } from '../utils/crypto.util';

class UserService {
  private userRepository = getRepository(User);

  findAll(): Observable<User[]> {
    return new Observable((observer) => {
      this.userRepository
        .find()
        .then((users) => {
          observer.next(users);
          observer.complete();
        })
        .catch((error) => observer.error(error));
    });
  }

  findById(id: string): Observable<User> {
    return new Observable((observer) => {
      this.userRepository
        .findOne({ where: { id } })
        .then((user) => {
          if (!user) {
            observer.error(new Error('User not found'));
          } else {
            observer.next(user);
            observer.complete();
          }
        })
        .catch((error) => observer.error(error));
    });
  }

  findByEmail(email: string): Observable<User | null> {
    return new Observable((observer) => {
      this.userRepository
        .findOne({ where: { email } })
        .then((user) => {
          observer.next(user);
          observer.complete();
        })
        .catch((error) => observer.error(error));
    });
  }

  create(userData: Partial<User>): Observable<User> {
    return new Observable((observer) => {
      hashPassword(userData.password!)
        .then((hashedPassword) => {
          const user = this.userRepository.create({
            ...userData,
            password: hashedPassword});
          return this.userRepository.save(user);
        })
        .then((user) => {
          observer.next(user);
          observer.complete();
        })
        .catch((error) => observer.error(error));
    });
  }

  update(id: string, userData: Partial<User>): Observable<User> {
    return new Observable((observer) => {
      this.userRepository
        .update(id, userData)
        .then(() => this.userRepository.findOne({ where: { id } }))
        .then((user) => {
          if (!user) {
            observer.error(new Error('User not found'));
          } else {
            observer.next(user);
            observer.complete();
          }
        })
        .catch((error) => observer.error(error));
    });
  }

  delete(id: string): Observable<void> {
    return new Observable((observer) => {
      this.userRepository
        .delete(id)
        .then((result) => {
          if (result.affected === 0) {
            observer.error(new Error('User not found'));
          } else {
            observer.next();
            observer.complete();
          }
        })
        .catch((error) => observer.error(error));
    });
  }
}

export const userService = new UserService();`,

    // Auth Service
    'src/services/auth.service.ts': `import { Observable, of, throwError } from 'rxjs';
import { map, mergeMap, catchError } from 'rxjs/operators';
import { userService } from './user.service';
import { comparePassword } from '../utils/crypto.util';
import { generateToken, verifyToken } from '../utils/jwt.util';
import { User } from '../models/user.model';

class AuthService {
  validateUser(email: string, password: string): Observable<User> {
    return userService.findByEmail(email).pipe(
      mergeMap((user) => {
        if (!user) {
          return throwError(() => new Error('User not found'));
        }
        return comparePassword(password, user.password).then((isValid) => {
          if (!isValid) {
            throw new Error('Invalid password');
          }
          return user;
        });
      }),
    );
  }

  createUser(userData: { email: string; password: string; name: string }): Observable<User> {
    return userService.findByEmail(userData.email).pipe(
      mergeMap((existingUser) => {
        if (existingUser) {
          return throwError(() => new Error('User already exists'));
        }
        return userService.create(userData);
      }),
    );
  }

  refreshToken(refreshToken: string): Observable<{ accessToken: string; refreshToken: string }> {
    try {
      const decoded = verifyToken(refreshToken);
      const newAccessToken = generateToken({ sub: decoded.sub, email: decoded.email });
      const newRefreshToken = generateToken({ sub: decoded.sub, email: decoded.email }, '7d');
      
      return of({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken});
    } catch (error) {
      return throwError(() => new Error('Invalid refresh token'));
    }
  }
}

export const authService = new AuthService();`,

    // Todo Service
    'src/services/todo.service.ts': `import { Observable } from 'rxjs';
import { getRepository } from 'typeorm';
import { Todo } from '../models/todo.model';

class TodoService {
  private todoRepository = getRepository(Todo);

  findAllByUser(userId: string): Observable<Todo[]> {
    return new Observable((observer) => {
      this.todoRepository
        .find({ where: { userId } })
        .then((todos) => {
          observer.next(todos);
          observer.complete();
        })
        .catch((error) => observer.error(error));
    });
  }

  findById(id: string, userId: string): Observable<Todo> {
    return new Observable((observer) => {
      this.todoRepository
        .findOne({ where: { id, userId } })
        .then((todo) => {
          if (!todo) {
            observer.error(new Error('Todo not found'));
          } else {
            observer.next(todo);
            observer.complete();
          }
        })
        .catch((error) => observer.error(error));
    });
  }

  create(todoData: Partial<Todo>): Observable<Todo> {
    return new Observable((observer) => {
      const todo = this.todoRepository.create(todoData);
      this.todoRepository
        .save(todo)
        .then((savedTodo) => {
          observer.next(savedTodo);
          observer.complete();
        })
        .catch((error) => observer.error(error));
    });
  }

  update(id: string, userId: string, todoData: Partial<Todo>): Observable<Todo> {
    return new Observable((observer) => {
      this.todoRepository
        .update({ id, userId }, todoData)
        .then(() => this.todoRepository.findOne({ where: { id, userId } }))
        .then((todo) => {
          if (!todo) {
            observer.error(new Error('Todo not found'));
          } else {
            observer.next(todo);
            observer.complete();
          }
        })
        .catch((error) => observer.error(error));
    });
  }

  delete(id: string, userId: string): Observable<void> {
    return new Observable((observer) => {
      this.todoRepository
        .delete({ id, userId })
        .then((result) => {
          if (result.affected === 0) {
            observer.error(new Error('Todo not found'));
          } else {
            observer.next();
            observer.complete();
          }
        })
        .catch((error) => observer.error(error));
    });
  }
}

export const todoService = new TodoService();`,

    // Database Service
    'src/services/db.service.ts': `import { createConnection, Connection } from 'typeorm';
import { Observable, of } from 'rxjs';
import { config } from '../config';
import { User } from '../models/user.model';
import { Todo } from '../models/todo.model';

class DatabaseService {
  private connection: Connection | null = null;

  async connect(): Promise<void> {
    this.connection = await createConnection({
      type: 'postgres',
      host: config.database.host,
      port: config.database.port,
      username: config.database.username,
      password: config.database.password,
      database: config.database.name,
      entities: [User, Todo],
      synchronize: config.database.synchronize,
      logging: config.database.logging});
  }

  checkConnection(): Observable<boolean> {
    return of(this.connection?.isConnected || false);
  }
}

export const dbService = new DatabaseService();`,

    // Redis Service
    'src/services/redis.service.ts': `import { createClient, RedisClientType } from 'redis';
import { Observable, of } from 'rxjs';
import { config } from '../config';

class RedisService {
  private client: RedisClientType | null = null;

  async connect(): Promise<void> {
    this.client = createClient({
      url: \`redis://\${config.redis.host}:\${config.redis.port}\`,
      password: config.redis.password});

    await this.client.connect();
  }

  checkConnection(): Observable<boolean> {
    return of(this.client?.isOpen || false);
  }

  async get(key: string): Promise<string | null> {
    return this.client?.get(key) || null;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client?.setEx(key, ttl, value);
    } else {
      await this.client?.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client?.del(key);
  }
}

export const redisService = new RedisService();`,

    // User Model
    'src/models/user.model.ts': `import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany} from 'typeorm';
import { Todo } from './todo.model';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin'}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  name!: string;

  @Column()
  password!: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER})
  role!: UserRole;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Todo, (todo) => todo.user)
  todos!: Todo[];
}`,

    // Todo Model
    'src/models/todo.model.ts': `import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn} from 'typeorm';
import { User } from './user.model';

export enum TodoStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed'}

export enum TodoPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'}

@Entity('todos')
export class Todo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: TodoStatus,
    default: TodoStatus.PENDING})
  status!: TodoStatus;

  @Column({
    type: 'enum',
    enum: TodoPriority,
    default: TodoPriority.MEDIUM})
  priority!: TodoPriority;

  @Column({ nullable: true })
  dueDate?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column()
  userId!: string;

  @ManyToOne(() => User, (user) => user.todos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}`,

    // JWT Utility
    'src/utils/jwt.util.ts': `import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface JwtPayload {
  sub: string;
  email: string;
}

export const generateToken = (payload: JwtPayload, expiresIn = '1h'): string => {
  return jwt.sign(payload, config.jwt.secret, { expiresIn });
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
};`,

    // Crypto Utility
    'src/utils/crypto.util.ts': `import bcrypt from 'bcryptjs';

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};`,

    // Logger Utility
    'src/utils/logger.util.ts': `import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      )}),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'}),
    new winston.transports.File({
      filename: 'logs/combined.log'})]});`,

    // Configuration
    'src/config/index.ts': `import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  hostname: process.env.HOSTNAME || 'localhost',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    name: process.env.DB_NAME || '{{projectName}}',
    synchronize: process.env.NODE_ENV === 'development',
    logging: process.env.NODE_ENV === 'development'},
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD},
  
  jwt: {
    secret: process.env.JWT_SECRET || 'supersecret',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'},
  
  httpsOptions: process.env.NODE_ENV === 'production' ? {
    cert: process.env.SSL_CERT,
    key: process.env.SSL_KEY} : undefined};`,

    // Environment variables
    '.env.example': `# Application
NODE_ENV=development
PORT=3000
HOSTNAME=localhost

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME={{projectName}}

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=1h

# SSL (for production)
SSL_CERT=
SSL_KEY=

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173`,

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

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Create logs directory
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]`,

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
      - DB_USERNAME=\${DB_USERNAME:-postgres}
      - DB_PASSWORD=\${DB_PASSWORD:-postgres}
      - DB_NAME=\${DB_NAME:-{{projectName}}}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_SECRET=\${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - app-network

  postgres:
    image: postgres:16-alpine
    container_name: {{projectName}}-db
    environment:
      - POSTGRES_USER=\${DB_USERNAME:-postgres}
      - POSTGRES_PASSWORD=\${DB_PASSWORD:-postgres}
      - POSTGRES_DB=\${DB_NAME:-{{projectName}}}
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
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'},
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@effects/(.*)$': '<rootDir>/src/effects/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1'}};`,

    // Test file
    'test/auth.spec.ts': `import { createHttpTestBed, createTestBedSetup } from '@marblejs/testing';
import { of } from 'rxjs';
import { listener } from '../src/http.listener';
import { authService } from '../src/services/auth.service';

const testBed = createHttpTestBed({ listener });
const testBedSetup = createTestBedSetup({ testBed });

describe('Auth API', () => {
  beforeEach(testBedSetup);

  test('POST /api/v1/auth/login should return tokens', async () => {
    // Mock auth service
    jest.spyOn(authService, 'validateUser').mockReturnValue(
      of({
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed',
        role: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        todos: []})
    );

    const response = await testBed.request('POST', '/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'});

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('refreshToken');
    expect(response.body.user).toMatchObject({
      email: 'test@example.com',
      name: 'Test User'});
  });

  test('POST /api/v1/auth/register should create new user', async () => {
    jest.spyOn(authService, 'createUser').mockReturnValue(
      of({
        id: '456',
        email: 'newuser@example.com',
        name: 'New User',
        password: 'hashed',
        role: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        todos: []})
    );

    const response = await testBed.request('POST', '/api/v1/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User'});

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body.user).toMatchObject({
      email: 'newuser@example.com',
      name: 'New User'});
  });
});`,

    // README
    'README.md': `# {{projectName}}

Marble.js functional reactive backend built with TypeScript and RxJS.

## Features

- 🎯 **Functional Reactive Programming** with RxJS
- 🔄 **Effect-based Architecture** for clean separation of concerns
- 💉 **Dependency Injection** built-in
- 🚀 **High Performance** with reactive streams
- 🛡️ **Type Safety** with TypeScript and io-ts
- 🔐 **JWT Authentication** with refresh tokens
- 🌐 **WebSocket Support** for real-time features
- 🔧 **gRPC Support** for microservices
- 📊 **Event Sourcing** capabilities
- 🏗️ **CQRS Pattern** support
- 🧪 **Testing** with Marble.js testing utilities
- 🐳 **Docker** support

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

4. Start the development server:
   \`\`\`bash
   npm run start:dev
   \`\`\`

### Running with Docker

\`\`\`bash
docker-compose up
\`\`\`

## Architecture

Marble.js uses a functional reactive approach:

- **Effects**: Pure functions that handle HTTP requests
- **Middlewares**: RxJS operators that transform requests
- **Services**: Reactive services using Observables
- **Models**: TypeORM entities for data persistence

## API Endpoints

### Authentication
- \`POST /api/v1/auth/login\` - User login
- \`POST /api/v1/auth/register\` - User registration
- \`POST /api/v1/auth/refresh\` - Refresh tokens
- \`POST /api/v1/auth/logout\` - User logout

### Users
- \`GET /api/v1/users/me\` - Get current user
- \`GET /api/v1/users\` - Get all users
- \`GET /api/v1/users/:id\` - Get user by ID
- \`PUT /api/v1/users/:id\` - Update user
- \`DELETE /api/v1/users/:id\` - Delete user

### Todos
- \`GET /api/v1/todos\` - Get all todos
- \`GET /api/v1/todos/:id\` - Get todo by ID
- \`POST /api/v1/todos\` - Create todo
- \`PUT /api/v1/todos/:id\` - Update todo
- \`DELETE /api/v1/todos/:id\` - Delete todo

### Health
- \`GET /api/v1/health\` - Health check

## Testing

\`\`\`bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E tests
npm run test:e2e
\`\`\`

## Project Structure

\`\`\`
src/
├── effects/          # HTTP effect handlers
├── middlewares/      # Custom middleware operators
├── models/           # TypeORM entities
├── services/         # Business logic services
├── utils/            # Utility functions
├── config/           # Configuration
├── http.listener.ts  # HTTP server configuration
└── index.ts          # Application entry point
\`\`\`

## Functional Reactive Concepts

1. **Effects**: Pure functions that handle side effects
2. **Operators**: Transform and compose request handling
3. **Observables**: Async data streams
4. **Type Safety**: Runtime validation with io-ts

## License

MIT
`}};