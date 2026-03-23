import { BackendTemplate } from '../types';

export const loopbackTemplate: BackendTemplate = {
  id: 'loopback',
  name: 'loopback',
  displayName: 'LoopBack 4',
  description: 'Highly extensible Node.js and TypeScript framework for building APIs and microservices',
  language: 'typescript',
  framework: 'loopback',
  version: '4.0.0',
  tags: ['nodejs', 'loopback', 'api', 'rest', 'microservices', 'swagger', 'typescript'],
  port: 3000,
  dependencies: {},
  features: ['middleware', 'rest-api', 'swagger', 'database', 'database', 'authentication', 'authorization'],
  
  files: {
    // Package configuration
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "LoopBack 4 API server with TypeScript",
  "keywords": ["loopback-application", "loopback"],
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "engines": {
    "node": "18 || 20"
  },
  "scripts": {
    "build": "lb-tsc",
    "build:watch": "lb-tsc --watch",
    "clean": "lb-clean dist *.tsbuildinfo .eslintcache",
    "lint": "npm run eslint && npm run prettier:check",
    "lint:fix": "npm run eslint:fix && npm run prettier:fix",
    "prettier:cli": "lb-prettier \\"**/*.ts\\" \\"**/*.js\\"",
    "prettier:check": "npm run prettier:cli -- -l",
    "prettier:fix": "npm run prettier:cli -- --write",
    "eslint": "lb-eslint --report-unused-disable-directives .",
    "eslint:fix": "npm run eslint -- --fix",
    "pretest": "npm run rebuild",
    "test": "lb-mocha --allow-console-logs \\"dist/__tests__\\"",
    "test:dev": "lb-mocha --allow-console-logs dist/__tests__/**/*.js",
    "docker:build": "docker build -t {{projectName}} .",
    "docker:run": "docker run -p 3000:3000 -d {{projectName}}",
    "premigrate": "npm run build",
    "migrate": "node ./dist/migrate",
    "preopenapi-spec": "npm run build",
    "openapi-spec": "node ./dist/openapi-spec",
    "prestart": "npm run rebuild",
    "start": "node -r source-map-support/register .",
    "dev": "nodemon -e ts --exec \\"npm run start\\"",
    "clean:full": "npm run clean && rimraf node_modules package-lock.json",
    "rebuild": "npm run clean && npm run build"
  },
  "repository": {
    "type": "git",
    "url": ""
  },
  "author": "{{projectName}}",
  "license": "MIT",
  "files": [
    "README.md",
    "dist",
    "src",
    "!*/__tests__"
  ],
  "dependencies": {
    "@loopback/authentication": "^11.0.2",
    "@loopback/authentication-jwt": "^0.15.2",
    "@loopback/authorization": "^0.14.2",
    "@loopback/boot": "^7.0.2",
    "@loopback/core": "^6.0.2",
    "@loopback/repository": "^7.0.2",
    "@loopback/rest": "^14.0.2",
    "@loopback/rest-crud": "^0.18.2",
    "@loopback/rest-explorer": "^7.0.2",
    "@loopback/service-proxy": "^7.0.2",
    "@loopback/logging": "^0.12.2",
    "@loopback/metrics": "^0.11.2",
    "@loopback/health": "^0.11.2",
    "@loopback/cron": "^0.11.2",
    "@loopback/apiconnect": "^0.10.2",
    "@loopback/context": "^7.0.2",
    "@loopback/filter": "^4.0.2",
    "@loopback/metadata": "^6.0.2",
    "@loopback/openapi-spec-builder": "^7.0.2",
    "@loopback/openapi-v3": "^10.0.2",
    "@loopback/repository-json-schema": "^8.0.2",
    "@loopback/express": "^7.0.2",
    "@loopback/socketio": "^0.8.2",
    "loopback-connector-postgresql": "^7.0.1",
    "loopback-connector-mysql": "^7.0.1",
    "loopback-connector-mongodb": "^6.2.0",
    "loopback-connector-redis": "^0.0.1",
    "loopback-connector-rest": "^4.0.1",
    "tslib": "^2.0.0",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.4.5",
    "jsonwebtoken": "^9.0.2",
    "lodash": "^4.17.21",
    "uuid": "^9.0.1",
    "winston": "^3.13.0",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "compression": "^1.7.4",
    "express-rate-limit": "^7.2.0",
    "multer": "^1.4.5-lts.1",
    "nodemailer": "^6.9.13",
    "socket.io": "^4.7.5",
    "bull": "^4.12.2"
  },
  "devDependencies": {
    "@loopback/build": "^11.0.2",
    "@loopback/testlab": "^7.0.2",
    "@loopback/eslint-config": "^15.0.2",
    "@types/node": "^20.12.7",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/lodash": "^4.17.0",
    "@types/multer": "^1.4.11",
    "@types/nodemailer": "^6.4.14",
    "@types/compression": "^1.7.5",
    "@types/cors": "^2.8.17",
    "@typescript-eslint/eslint-plugin": "^7.7.1",
    "@typescript-eslint/parser": "^7.7.1",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-prettier": "^5.1.3",
    "prettier": "^3.2.5",
    "typescript": "~5.4.5",
    "nodemon": "^3.1.0",
    "rimraf": "^5.0.5",
    "source-map-support": "^0.5.21"
  }
}`,

    // TypeScript configuration
    'tsconfig.json': `{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@loopback/build/config/tsconfig.common.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src"]
}`,

    // Application configuration
    'src/application.ts': `import {BootMixin} from '@loopback/boot';
import {ApplicationConfig} from '@loopback/core';
import {
  RestExplorerBindings,
  RestExplorerComponent} from '@loopback/rest-explorer';
import {RepositoryMixin} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {ServiceMixin} from '@loopback/service-proxy';
import {AuthenticationComponent} from '@loopback/authentication';
import {
  JWTAuthenticationComponent,
  UserServiceBindings} from '@loopback/authentication-jwt';
import {AuthorizationComponent} from '@loopback/authorization';
import {HealthComponent, HealthBindings} from '@loopback/health';
import {MetricsComponent} from '@loopback/metrics';
import {LoggingComponent, LoggingBindings} from '@loopback/logging';
import {CronComponent} from '@loopback/cron';
import path from 'path';
import {MySequence} from './sequence';
import {SECURITY_SCHEME_SPEC} from './utils/security-spec';
import {UserRepository} from './repositories';
import {MyUserService} from './services';

export {ApplicationConfig};

export class {{projectName}}Application extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    // Set up default home page
    this.static('/', path.join(__dirname, '../public'));

    // Set up the custom sequence
    this.sequence(MySequence);

    // Add security scheme spec
    this.addSecurityScheme();

    // Customize @loopback/rest-explorer configuration here
    this.configure(RestExplorerBindings.COMPONENT).to({
      path: '/explorer'});
    this.component(RestExplorerComponent);

    // Configure authentication
    this.component(AuthenticationComponent);
    this.component(JWTAuthenticationComponent);
    this.dataSource(UserRepository.dataSource);
    this.bind(UserServiceBindings.USER_SERVICE).toClass(MyUserService);

    // Configure authorization
    this.component(AuthorizationComponent);

    // Configure health check
    this.configure(HealthBindings.COMPONENT).to({
      healthPath: '/health',
      readyPath: '/ready',
      livePath: '/live'});
    this.component(HealthComponent);

    // Configure metrics
    this.component(MetricsComponent);

    // Configure logging
    this.configure(LoggingBindings.COMPONENT).to({
      enableFluent: false,
      enableHttpAccessLog: true});
    this.component(LoggingComponent);

    // Configure cron jobs
    this.component(CronComponent);

    this.projectRoot = __dirname;
    // Customize @loopback/boot Booter Conventions here
    this.bootOptions = {
      controllers: {
        // Customize ControllerBooter Conventions here
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true},
      repositories: {
        dirs: ['database'],
        extensions: ['.repository.js'],
        nested: true},
      datasources: {
        dirs: ['database'],
        extensions: ['.datasource.js'],
        nested: true},
      services: {
        dirs: ['services'],
        extensions: ['.service.js'],
        nested: true},
      interceptors: {
        dirs: ['interceptors'],
        extensions: ['.interceptor.js'],
        nested: true},
      observers: {
        dirs: ['observers'],
        extensions: ['.observer.js'],
        nested: true}};
  }

  private addSecurityScheme(): void {
    this.api({
      openapi: '3.0.0',
      info: {
        title: '{{projectName}} API',
        version: '1.0.0',
        description: 'LoopBack 4 API with comprehensive features'},
      paths: {},
      components: {
        securitySchemes: SECURITY_SCHEME_SPEC},
      servers: [{url: '/'}]});
  }
}`,

    // Main entry point
    'src/index.ts': `import {ApplicationConfig, {{projectName}}Application} from './application';

export * from './application';

export async function main(options: ApplicationConfig = {}) {
  const app = new {{projectName}}Application(options);
  await app.boot();
  await app.start();

  const url = app.restServer.url;
  console.log(\`🚀 Server is running at \${url}\`);
  console.log(\`📚 API Explorer: \${url}/explorer\`);

  return app;
}

if (require.main === module) {
  // Run the application
  const config = {
    rest: {
      port: +(process.env.PORT ?? 3000),
      host: process.env.HOST,
      // The \`gracePeriodForClose\` provides a graceful close for http/https
      // servers with keep-alive clients. The default value is \`Infinity\`
      // (don't force-close). If you want to immediately destroy all sockets
      // upon stop, set its value to \`0\`.
      // See https://www.npmjs.com/package/stoppable
      gracePeriodForClose: 5000, // 5 seconds
      openApiSpec: {
        // useful when used with OpenAPI-to-GraphQL to locate your application
        setServersFromRequest: true},
      // Configure CORS
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || '*',
        credentials: true}}};
  main(config).catch(err => {
    console.error('Cannot start the application.', err);
    process.exit(1);
  });
}`,

    // Custom sequence
    'src/sequence.ts': `import {inject} from '@loopback/core';
import {
  FindRoute,
  InvokeMethod,
  InvokeMiddleware,
  ParseParams,
  Reject,
  RequestContext,
  RestBindings,
  Send,
  SequenceHandler} from '@loopback/rest';
import {AuthenticationBindings, AuthenticateFn} from '@loopback/authentication';
import {AuthorizationBindings, AuthorizeFn} from '@loopback/authorization';

const SequenceActions = RestBindings.SequenceActions;

export class MySequence implements SequenceHandler {
  /**
   * Optional invoker for registered middleware in a chain.
   * To be injected via SequenceActions.INVOKE_MIDDLEWARE.
   */
  @inject(SequenceActions.INVOKE_MIDDLEWARE, {optional: true})
  protected invokeMiddleware: InvokeMiddleware = () => false;

  constructor(
    @inject(SequenceActions.FIND_ROUTE) protected findRoute: FindRoute,
    @inject(SequenceActions.PARSE_PARAMS) protected parseParams: ParseParams,
    @inject(SequenceActions.INVOKE_METHOD) protected invoke: InvokeMethod,
    @inject(SequenceActions.SEND) public send: Send,
    @inject(SequenceActions.REJECT) public reject: Reject,
    @inject(AuthenticationBindings.AUTH_ACTION)
    protected authenticateRequest: AuthenticateFn,
    @inject(AuthorizationBindings.AUTHORIZE_ACTION)
    protected authorize: AuthorizeFn,
  ) {}

  async handle(context: RequestContext) {
    try {
      const {request, response} = context;
      
      // Log request
      console.log(\`\${request.method} \${request.url}\`);
      
      // Invoke middleware chain
      const finished = await this.invokeMiddleware(context);
      if (finished) return;
      
      const route = this.findRoute(request);

      // Authentication
      await this.authenticateRequest(request);

      // Authorization
      const authorizationMetadata = await this.authorize(
        context.get(AuthenticationBindings.CURRENT_USER),
        route.invokeMethod.bind(route),
        route.methodName,
      );

      const args = await this.parseParams(request, route);
      const result = await this.invoke(route, args);
      this.send(response, result);
    } catch (err) {
      // Log error
      console.error(err);
      this.reject(context, err);
    }
  }
}`,

    // User controller
    'src/controllers/user.controller.ts': `import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
  RestBindings,
  Request} from '@loopback/rest';
import {User} from '../models';
import {UserRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';
import {authorize} from '@loopback/authorization';
import {inject} from '@loopback/core';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';

export class UserController {
  constructor(
    @repository(UserRepository)
    public userRepository: UserRepository,
  ) {}

  @post('/users')
  @response(200, {
    description: 'User model instance',
    content: {'application/json': {schema: getModelSchemaRef(User)}}})
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(User, {
            title: 'NewUser',
            exclude: ['id']})}}})
    user: Omit<User, 'id'>,
  ): Promise<User> {
    return this.userRepository.create(user);
  }

  @get('/users/count')
  @response(200, {
    description: 'User model count',
    content: {'application/json': {schema: CountSchema}}})
  @authenticate('jwt')
  @authorize({allowedRoles: ['admin']})
  async count(
    @param.where(User) where?: Where<User>,
  ): Promise<Count> {
    return this.userRepository.count(where);
  }

  @get('/users')
  @response(200, {
    description: 'Array of User model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(User, {includeRelations: true})}}}})
  @authenticate('jwt')
  @authorize({allowedRoles: ['admin']})
  async find(
    @param.filter(User) filter?: Filter<User>,
  ): Promise<User[]> {
    return this.userRepository.find(filter);
  }

  @patch('/users')
  @response(200, {
    description: 'User PATCH success count',
    content: {'application/json': {schema: CountSchema}}})
  @authenticate('jwt')
  @authorize({allowedRoles: ['admin']})
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(User, {partial: true})}}})
    user: User,
    @param.where(User) where?: Where<User>,
  ): Promise<Count> {
    return this.userRepository.updateAll(user, where);
  }

  @get('/users/{id}')
  @response(200, {
    description: 'User model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User, {includeRelations: true})}}})
  @authenticate('jwt')
  async findById(
    @param.path.string('id') id: string,
    @param.filter(User, {exclude: 'where'}) filter?: FilterExcludingWhere<User>
  ): Promise<User> {
    return this.userRepository.findById(id, filter);
  }

  @get('/users/me')
  @response(200, {
    description: 'Current user profile',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User, {includeRelations: true})}}})
  @authenticate('jwt')
  async getCurrentUser(
    @inject(SecurityBindings.USER) currentUserProfile: UserProfile,
  ): Promise<User> {
    const userId = currentUserProfile[securityId];
    return this.userRepository.findById(userId);
  }

  @patch('/users/{id}')
  @response(204, {
    description: 'User PATCH success'})
  @authenticate('jwt')
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(User, {partial: true})}}})
    user: User,
    @inject(SecurityBindings.USER) currentUserProfile: UserProfile,
  ): Promise<void> {
    const currentUserId = currentUserProfile[securityId];
    // Users can only update their own profile unless admin
    if (currentUserId !== id && !currentUserProfile.roles?.includes('admin')) {
      throw new Error('Forbidden');
    }
    await this.userRepository.updateById(id, user);
  }

  @put('/users/{id}')
  @response(204, {
    description: 'User PUT success'})
  @authenticate('jwt')
  @authorize({allowedRoles: ['admin']})
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() user: User,
  ): Promise<void> {
    await this.userRepository.replaceById(id, user);
  }

  @del('/users/{id}')
  @response(204, {
    description: 'User DELETE success'})
  @authenticate('jwt')
  @authorize({allowedRoles: ['admin']})
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.userRepository.deleteById(id);
  }
}`,

    // Todo controller
    'src/controllers/todo.controller.ts': `import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response} from '@loopback/rest';
import {Todo} from '../models';
import {TodoRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';

@authenticate('jwt')
export class TodoController {
  constructor(
    @repository(TodoRepository)
    public todoRepository: TodoRepository,
  ) {}

  @post('/todos')
  @response(200, {
    description: 'Todo model instance',
    content: {'application/json': {schema: getModelSchemaRef(Todo)}}})
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Todo, {
            title: 'NewTodo',
            exclude: ['id', 'userId']})}}})
    todo: Omit<Todo, 'id' | 'userId'>,
    @inject(SecurityBindings.USER) currentUserProfile: UserProfile,
  ): Promise<Todo> {
    const userId = currentUserProfile[securityId];
    return this.todoRepository.create({...todo, userId});
  }

  @get('/todos/count')
  @response(200, {
    description: 'Todo model count',
    content: {'application/json': {schema: CountSchema}}})
  async count(
    @inject(SecurityBindings.USER) currentUserProfile: UserProfile,
    @param.where(Todo) where?: Where<Todo>,
  ): Promise<Count> {
    const userId = currentUserProfile[securityId];
    return this.todoRepository.count({...where, userId});
  }

  @get('/todos')
  @response(200, {
    description: 'Array of Todo model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Todo, {includeRelations: true})}}}})
  async find(
    @inject(SecurityBindings.USER) currentUserProfile: UserProfile,
    @param.filter(Todo) filter?: Filter<Todo>,
  ): Promise<Todo[]> {
    const userId = currentUserProfile[securityId];
    const userFilter = {...filter, where: {...filter?.where, userId}};
    return this.todoRepository.find(userFilter);
  }

  @patch('/todos')
  @response(200, {
    description: 'Todo PATCH success count',
    content: {'application/json': {schema: CountSchema}}})
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Todo, {partial: true})}}})
    todo: Todo,
    @inject(SecurityBindings.USER) currentUserProfile: UserProfile,
    @param.where(Todo) where?: Where<Todo>,
  ): Promise<Count> {
    const userId = currentUserProfile[securityId];
    return this.todoRepository.updateAll(todo, {...where, userId});
  }

  @get('/todos/{id}')
  @response(200, {
    description: 'Todo model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Todo, {includeRelations: true})}}})
  async findById(
    @param.path.string('id') id: string,
    @inject(SecurityBindings.USER) currentUserProfile: UserProfile,
    @param.filter(Todo, {exclude: 'where'}) filter?: FilterExcludingWhere<Todo>
  ): Promise<Todo> {
    const userId = currentUserProfile[securityId];
    const todo = await this.todoRepository.findById(id, filter);
    if (todo.userId !== userId) {
      throw new Error('Unauthorized');
    }
    return todo;
  }

  @patch('/todos/{id}')
  @response(204, {
    description: 'Todo PATCH success'})
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Todo, {partial: true})}}})
    todo: Todo,
    @inject(SecurityBindings.USER) currentUserProfile: UserProfile,
  ): Promise<void> {
    const userId = currentUserProfile[securityId];
    const existing = await this.todoRepository.findById(id);
    if (existing.userId !== userId) {
      throw new Error('Unauthorized');
    }
    await this.todoRepository.updateById(id, todo);
  }

  @put('/todos/{id}')
  @response(204, {
    description: 'Todo PUT success'})
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() todo: Todo,
    @inject(SecurityBindings.USER) currentUserProfile: UserProfile,
  ): Promise<void> {
    const userId = currentUserProfile[securityId];
    const existing = await this.todoRepository.findById(id);
    if (existing.userId !== userId) {
      throw new Error('Unauthorized');
    }
    await this.todoRepository.replaceById(id, {...todo, userId});
  }

  @del('/todos/{id}')
  @response(204, {
    description: 'Todo DELETE success'})
  async deleteById(
    @param.path.string('id') id: string,
    @inject(SecurityBindings.USER) currentUserProfile: UserProfile,
  ): Promise<void> {
    const userId = currentUserProfile[securityId];
    const existing = await this.todoRepository.findById(id);
    if (existing.userId !== userId) {
      throw new Error('Unauthorized');
    }
    await this.todoRepository.deleteById(id);
  }
}`,

    // User model
    'src/models/user.model.ts': `import {Entity, model, property, hasMany} from '@loopback/repository';
import {Todo} from './todo.model';

@model({
  settings: {
    indexes: {
      uniqueEmail: {
        keys: {email: 1},
        options: {unique: true}}}}})
export class User extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true})
  id?: string;

  @property({
    type: 'string',
    required: true,
    index: {unique: true}})
  email: string;

  @property({
    type: 'string',
    required: true})
  password: string;

  @property({
    type: 'string',
    required: true})
  name: string;

  @property({
    type: 'string',
    default: 'user'})
  role?: string;

  @property({
    type: 'boolean',
    default: true})
  isActive?: boolean;

  @property({
    type: 'boolean',
    default: false})
  isVerified?: boolean;

  @property({
    type: 'string'})
  verificationToken?: string;

  @property({
    type: 'string'})
  resetToken?: string;

  @property({
    type: 'date'})
  resetTokenExpiry?: string;

  @property({
    type: 'string'})
  avatarUrl?: string;

  @property({
    type: 'date'})
  lastLogin?: string;

  @property({
    type: 'date',
    defaultFn: 'now'})
  createdAt?: string;

  @property({
    type: 'date',
    defaultFn: 'now',
    updateOnly: true})
  updatedAt?: string;

  @hasMany(() => Todo)
  todos: Todo[];

  constructor(data?: Partial<User>) {
    super(data);
  }
}

export interface UserRelations {
  todos?: Todo[];
}

export type UserWithRelations = User & UserRelations;`,

    // Todo model
    'src/models/todo.model.ts': `import {Entity, model, property, belongsTo} from '@loopback/repository';
import {User} from './user.model';

@model({
  settings: {
    indexes: {
      userIdIndex: {keys: {userId: 1}},
      statusIndex: {keys: {status: 1}},
      priorityIndex: {keys: {priority: 1}}}}})
export class Todo extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true})
  id?: string;

  @property({
    type: 'string',
    required: true})
  title: string;

  @property({
    type: 'string'})
  description?: string;

  @property({
    type: 'boolean',
    default: false})
  completed?: boolean;

  @property({
    type: 'string',
    default: 'pending',
    jsonSchema: {
      enum: ['pending', 'in_progress', 'completed']}})
  status?: string;

  @property({
    type: 'string',
    default: 'medium',
    jsonSchema: {
      enum: ['low', 'medium', 'high']}})
  priority?: string;

  @property({
    type: 'date'})
  dueDate?: string;

  @property({
    type: 'array',
    itemType: 'string',
    default: []})
  tags?: string[];

  @property({
    type: 'date',
    defaultFn: 'now'})
  createdAt?: string;

  @property({
    type: 'date',
    defaultFn: 'now',
    updateOnly: true})
  updatedAt?: string;

  @belongsTo(() => User)
  userId: string;

  constructor(data?: Partial<Todo>) {
    super(data);
  }
}

export interface TodoRelations {
  user?: User;
}

export type TodoWithRelations = Todo & TodoRelations;`,

    // User repository
    'src/repositories/user.repository.ts': `import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, HasManyRepositoryFactory} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {User, UserRelations, Todo} from '../models';
import {TodoRepository} from './todo.repository';

export class UserRepository extends DefaultCrudRepository<
  User,
  typeof User.prototype.id,
  UserRelations
> {
  public readonly todos: HasManyRepositoryFactory<Todo, typeof User.prototype.id>;

  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
    @repository.getter('TodoRepository') protected todoRepositoryGetter: Getter<TodoRepository>,
  ) {
    super(User, dataSource);
    this.todos = this.createHasManyRepositoryFactoryFor('todos', todoRepositoryGetter);
    this.registerInclusionResolver('todos', this.todos.inclusionResolver);
  }

  async findByEmail(email: string): Promise<User | null> {
    const users = await this.find({where: {email}});
    return users.length > 0 ? users[0] : null;
  }
}`,

    // Database datasource
    'src/datasources/db.datasource.ts': `import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

const config = {
  name: 'db',
  connector: 'postgresql',
  url: '',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || '{{projectName}}'};

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The \`stop()\` method is inherited from \`juggler.DataSource\`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class DbDataSource extends juggler.DataSource
  implements LifeCycleObserver {
  static dataSourceName = 'db';
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.db', {optional: true})
    dsConfig: object = config,
  ) {
    super(dsConfig);
  }
}`,

    // Environment variables
    '.env.example': `# Application
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME={{projectName}}

# JWT
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=604800

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@example.com

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads`,

    // Docker configuration
    'Dockerfile': `# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci

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
COPY --from=builder /app/public ./public

# Create necessary directories
RUN mkdir -p uploads logs && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "."]`,

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
      - DB_USER=\${DB_USER:-postgres}
      - DB_PASSWORD=\${DB_PASSWORD:-postgres}
      - DB_NAME=\${DB_NAME:-{{projectName}}}
      - REDIS_HOST=redis
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

    // README
    'README.md': `# {{projectName}}

LoopBack 4 API server with TypeScript, featuring dependency injection, decorators, and OpenAPI integration.

## Features

- 🏗️ **LoopBack 4** framework with TypeScript
- 💉 **Dependency Injection** with decorators
- 🔐 **JWT Authentication** with role-based authorization
- 🗄️ **Multiple databases** support (PostgreSQL, MySQL, MongoDB)
- 📚 **OpenAPI 3.0** documentation
- 🔄 **WebSocket** support with Socket.IO
- 🧪 **Testing** with Mocha
- 🐳 **Docker** support
- 📊 **Logging** and metrics
- 🛡️ **Security** features
- 📤 **File uploads** with validation
- ✉️ **Email** support
- 🔄 **Background jobs** with Bull
- 🏥 **Health checks** with readiness/liveness probes

## Getting Started

### Prerequisites

- Node.js 18+ or 20
- PostgreSQL (or MySQL/MongoDB)
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

5. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

### Running with Docker

\`\`\`bash
docker-compose up
\`\`\`

## API Documentation

Once running, visit:
- OpenAPI Explorer: http://localhost:3000/explorer
- Health check: http://localhost:3000/health

## CLI Commands

LoopBack 4 provides powerful CLI commands:

\`\`\`bash
# Generate a new controller
lb4 controller

# Generate a new model
lb4 model

# Generate a new repository
lb4 repository

# Generate a new datasource
lb4 datasource

# Generate a new service
lb4 service

# Generate a new relation
lb4 relation
\`\`\`

## Testing

\`\`\`bash
# Run all tests
npm test

# Run tests in development mode
npm run test:dev

# Run tests with coverage
npm run test:coverage
\`\`\`

## Project Structure

\`\`\`
src/
├── application.ts      # Application configuration
├── index.ts           # Application entry point
├── sequence.ts        # Custom sequence
├── controllers/       # REST API controllers
├── datasources/       # Data source configurations
├── models/           # Data models
├── repositories/     # Data access layer
├── services/         # Business logic services
├── interceptors/     # Method interceptors
├── observers/        # Model observers
├── __tests__/        # Test files
└── utils/           # Utility functions
\`\`\`

## License

MIT
`}};