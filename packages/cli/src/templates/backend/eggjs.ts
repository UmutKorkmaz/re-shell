import { BackendTemplate } from '../types';

export const eggjsTemplate: BackendTemplate = {
  id: 'eggjs',
  name: 'eggjs',
  displayName: 'Egg.js',
  description: 'Enterprise-grade Node.js framework built on Koa with convention-over-configuration and multi-process model',
  language: 'typescript',
  framework: 'eggjs',
  version: '3.2.0',
  tags: ['nodejs', 'eggjs', 'koa', 'api', 'rest', 'enterprise', 'microservices', 'typescript'],
  port: 7001,
  dependencies: {},
  features: ['security', 'database', 'queue', 'websockets', 'testing'],
  
  files: {
    // Package configuration
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "Enterprise-grade Egg.js application with TypeScript",
  "private": true,
  "egg": {
    "typescript": true,
    "declarations": true
  },
  "scripts": {
    "start": "egg-scripts start --daemon --title=egg-server-{{projectName}}",
    "stop": "egg-scripts stop --title=egg-server-{{projectName}}",
    "dev": "egg-bin dev",
    "debug": "egg-bin debug",
    "test": "npm run lint -- --fix && npm run test-local",
    "test-local": "egg-bin test",
    "cov": "egg-bin cov",
    "tsc": "ets && tsc -p tsconfig.json",
    "ci": "npm run lint && npm run cov && npm run tsc",
    "autod": "autod",
    "lint": "eslint . --ext .ts,.js",
    "clean": "ets clean",
    "build": "npm run tsc",
    "docker:build": "docker build -t {{projectName}} .",
    "docker:run": "docker run -p 7001:7001 {{projectName}}",
    "migrate:new": "npx sequelize migration:generate --name",
    "migrate:up": "npx sequelize db:migrate",
    "migrate:down": "npx sequelize db:migrate:undo",
    "seed:create": "npx sequelize seed:generate --name",
    "seed:run": "npx sequelize db:seed:all"
  },
  "dependencies": {
    "egg": "^3.17.5",
    "egg-scripts": "^2.19.0",
    "egg-sequelize": "^6.0.0",
    "egg-redis": "^2.4.0",
    "egg-session-redis": "^2.1.0",
    "egg-validate": "^2.0.2",
    "egg-cors": "^2.2.3",
    "egg-jwt": "^3.1.7",
    "egg-bcrypt": "^1.1.0",
    "egg-socket.io": "^4.1.6",
    "egg-view-nunjucks": "^2.3.0",
    "egg-multipart": "^3.3.0",
    "egg-oss": "^3.2.0",
    "egg-static": "^2.3.1",
    "egg-logrotator": "^3.2.0",
    "egg-schedule": "^3.7.0",
    "egg-i18n": "^2.1.0",
    "egg-security": "^2.10.0",
    "egg-jsonp": "^2.0.0",
    "egg-swagger-doc": "^2.3.2",
    "egg-bull": "^1.3.0",
    "egg-grpc": "^1.0.6",
    "egg-kafka": "^2.0.3",
    "egg-amqp": "^0.2.0",
    "egg-mongoose": "^3.3.1",
    "egg-elasticsearch": "^1.0.0",
    "mysql2": "^3.9.7",
    "pg": "^8.11.5",
    "ioredis": "^5.3.2",
    "jsonwebtoken": "^9.0.2",
    "uuid": "^9.0.1",
    "dayjs": "^1.11.10",
    "lodash": "^4.17.21",
    "class-validator": "^0.14.1",
    "class-transformer": "^0.5.1",
    "nodemailer": "^6.9.13",
    "qrcode": "^1.5.3",
    "sharp": "^0.33.3",
    "xlsx": "^0.18.5",
    "csv-parser": "^3.0.0",
    "sanitize-html": "^2.13.0"
  },
  "devDependencies": {
    "@types/mocha": "^10.0.6",
    "@types/node": "^20.12.7",
    "@types/supertest": "^6.0.2",
    "@types/lodash": "^4.17.0",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/nodemailer": "^6.4.14",
    "@types/qrcode": "^1.5.5",
    "egg-bin": "^6.5.2",
    "typescript": "^5.4.5",
    "eslint": "^8.57.0",
    "eslint-config-egg": "^13.0.0",
    "@typescript-eslint/eslint-plugin": "^7.7.1",
    "@typescript-eslint/parser": "^7.7.1",
    "autod": "^3.1.2",
    "autod-egg": "^1.1.0",
    "egg-mock": "^5.12.2",
    "factory-girl": "^5.0.4",
    "supertest": "^7.0.0"
  },
  "engines": {
    "node": ">=16.0.0"
  },
  "ci": {
    "version": "16, 18, 20"
  }
}`,

    // TypeScript configuration
    'tsconfig.json': `{
  "compileOnSave": true,
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "noImplicitAny": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "charset": "utf8",
    "allowJs": false,
    "pretty": true,
    "lib": ["ES2020"],
    "noEmitOnError": false,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "skipLibCheck": true,
    "skipDefaultLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "strictPropertyInitialization": false,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["app/*"],
      "@config/*": ["config/*"],
      "@lib/*": ["lib/*"],
      "@test/*": ["test/*"]
    }
  },
  "include": [
    "app/**/*.ts",
    "config/**/*.ts",
    "lib/**/*.ts",
    "test/**/*.ts",
    "typings/**/*.ts",
    "**/*.d.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "logs",
    "run",
    "coverage"
  ]
}`,

    // Egg configuration
    'config/config.default.ts': `import { EggAppConfig, EggAppInfo, PowerPartial } from 'egg';

export default (appInfo: EggAppInfo) => {
  const config = {} as PowerPartial<EggAppConfig>;

  // override config from framework / plugin
  config.keys = appInfo.name + '_{{projectName}}_1234567890';

  // add your egg config in here
  config.middleware = ['errorHandler', 'notfoundHandler', 'gzip', 'requestLog'];

  // cluster
  config.cluster = {
    listen: {
      port: 7001,
      hostname: '0.0.0.0'}};

  // security
  config.security = {
    csrf: {
      enable: false, // Disable for API, enable for web
    },
    domainWhiteList: ['http://localhost:3000', 'http://localhost:5173']};

  // cors
  config.cors = {
    credentials: true,
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS'};

  // view
  config.view = {
    defaultViewEngine: 'nunjucks',
    mapping: {
      '.nj': 'nunjucks'}};

  // static
  config.static = {
    prefix: '/public/',
    dir: appInfo.baseDir + '/app/public',
    dynamic: true,
    preload: false,
    buffer: true,
    maxFiles: 1000};

  // multipart
  config.multipart = {
    mode: 'file',
    fileSize: '50mb',
    whitelist: [
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
      '.mp4', '.webm', '.avi', '.mov',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.rar', '.7z', '.tar', '.gz'],
    tmpdir: appInfo.baseDir + '/app/public/temp',
    cleanSchedule: {
      cron: '0 30 4 * * *', // Clean temp files at 4:30 AM daily
    }};

  // i18n
  config.i18n = {
    defaultLocale: 'en-US',
    dirs: [appInfo.baseDir + '/config/locale']};

  // logger
  config.logger = {
    level: 'INFO',
    consoleLevel: 'INFO',
    dir: appInfo.baseDir + '/logs',
    encoding: 'utf8',
    appLogName: \`\${appInfo.name}-web.log\`,
    coreLogName: 'egg-web.log',
    agentLogName: 'egg-agent.log',
    errorLogName: 'common-error.log'};

  // logrotator
  config.logrotator = {
    filesRotateByHour: [],
    hourDelimiter: '-',
    filesRotateBySize: [],
    maxFileSize: 50 * 1024 * 1024,
    maxFiles: 10,
    rotateDuration: 60000,
    maxDays: 31};

  // custom config
  config.api = {
    prefix: '/api/v1',
    pagination: {
      pageSize: 20,
      maxPageSize: 100}};

  // jwt
  config.jwt = {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: '1h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    refreshExpiresIn: '7d'};

  // add your special config in here
  const bizConfig = {
    sourceUrl: \`https://github.com/eggjs/examples/tree/master/\${appInfo.name}\`};

  // the return config will combines to EggAppConfig
  return {
    ...config,
    ...bizConfig};
};`,

    // Local development config
    'config/config.local.ts': `import { EggAppConfig, PowerPartial } from 'egg';

export default () => {
  const config: PowerPartial<EggAppConfig> = {};

  // Database
  config.sequelize = {
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || '{{projectName}}_dev',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    define: {
      underscored: true,
      freezeTableName: true,
      timestamps: true},
    timezone: '+08:00',
    logging: console.log};

  // Redis
  config.redis = {
    client: {
      port: parseInt(process.env.REDIS_PORT || '6379'),
      host: process.env.REDIS_HOST || 'localhost',
      password: process.env.REDIS_PASSWORD || '',
      db: 0}};

  // Session
  config.sessionRedis = {
    key: 'EGG_SESSION',
    maxAge: 24 * 3600 * 1000, // 1 day
    httpOnly: true,
    encrypt: true};

  return config;
};`,

    // Production config
    'config/config.prod.ts': `import { EggAppConfig, PowerPartial } from 'egg';

export default () => {
  const config: PowerPartial<EggAppConfig> = {};

  // Database
  config.sequelize = {
    dialect: 'postgres',
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT!),
    database: process.env.DB_NAME!,
    username: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    pool: {
      max: 20,
      min: 5,
      idle: 10000},
    define: {
      underscored: true,
      freezeTableName: true,
      timestamps: true},
    timezone: '+08:00',
    logging: false};

  // Redis
  config.redis = {
    client: {
      port: parseInt(process.env.REDIS_PORT!),
      host: process.env.REDIS_HOST!,
      password: process.env.REDIS_PASSWORD!,
      db: 0}};

  // Logger
  config.logger = {
    level: 'ERROR',
    consoleLevel: 'ERROR'};

  // Static
  config.static = {
    maxAge: 31536000,
    buffer: true,
    gzip: true};

  return config;
};`,

    // Plugin configuration
    'config/plugin.ts': `import { EggPlugin } from 'egg';

const plugin: EggPlugin = {
  // built-in plugins
  static: true,
  jsonp: true,
  view: true,
  nunjucks: {
    enable: true,
    package: 'egg-view-nunjucks'},

  // database
  sequelize: {
    enable: true,
    package: 'egg-sequelize'},

  // redis
  redis: {
    enable: true,
    package: 'egg-redis'},

  sessionRedis: {
    enable: true,
    package: 'egg-session-redis'},

  // validation
  validate: {
    enable: true,
    package: 'egg-validate'},

  // security
  cors: {
    enable: true,
    package: 'egg-cors'},

  // jwt
  jwt: {
    enable: true,
    package: 'egg-jwt'},

  // bcrypt
  bcrypt: {
    enable: true,
    package: 'egg-bcrypt'},

  // socket.io
  io: {
    enable: true,
    package: 'egg-socket.io'},

  // file upload
  multipart: {
    enable: true,
    package: 'egg-multipart'},

  // object storage
  oss: {
    enable: false,
    package: 'egg-oss'},

  // scheduler
  schedule: {
    enable: true,
    package: 'egg-schedule'},

  // i18n
  i18n: {
    enable: true,
    package: 'egg-i18n'},

  // swagger
  swaggerdoc: {
    enable: true,
    package: 'egg-swagger-doc'},

  // queue
  bull: {
    enable: true,
    package: 'egg-bull'}};

export default plugin;`,

    // Application entry
    'app.ts': `import { Application, IBoot } from 'egg';

export default class AppBootHook implements IBoot {
  private readonly app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  configWillLoad() {
    // Ready to call configDidLoad,
    // Config, plugin files are referred,
    // this is the last chance to modify the config.
  }

  configDidLoad() {
    // Config, plugin files have loaded.
  }

  async didLoad() {
    // All files have loaded, start plugin here.
  }

  async willReady() {
    // All plugins have started, can do some thing before app ready.
    
    // Initialize database
    await this.app.model.sync({ alter: false });
    
    // Initialize scheduled tasks
    this.app.logger.info('Scheduled tasks initialized');
  }

  async didReady() {
    // Worker is ready, can do some things
    // don't need to block the app boot.
    
    const ctx = await this.app.createAnonymousContext();
    
    // Cache warming
    await ctx.service.cache.warmUp();
    
    this.app.logger.info('Application is ready');
  }

  async serverDidReady() {
    // Server is listening.
    this.app.logger.info(\`Server running at http://localhost:\${this.app.config.cluster.listen.port}\`);
  }

  async beforeClose() {
    // Do some thing before app close.
    this.app.logger.info('Application is closing');
  }
}`,

    // Router
    'app/router.ts': `import { Application } from 'egg';

export default (app: Application) => {
  const { controller, router, middleware, io } = app;
  const { api } = app.config;
  
  // Middleware
  const auth = middleware.auth();
  const admin = middleware.admin();
  const validate = middleware.validate();
  const rateLimit = middleware.rateLimit();

  // Health check
  router.get('/health', controller.health.check);
  router.get('/health/readiness', controller.health.readiness);
  router.get('/health/liveness', controller.health.liveness);

  // API routes
  const apiRouter = router.namespace(api.prefix);

  // Public routes
  apiRouter.post('/auth/register', validate, controller.auth.register);
  apiRouter.post('/auth/login', validate, controller.auth.login);
  apiRouter.post('/auth/refresh', controller.auth.refresh);
  apiRouter.get('/auth/verify/:token', controller.auth.verify);
  apiRouter.post('/auth/forgot-password', validate, controller.auth.forgotPassword);
  apiRouter.post('/auth/reset-password', validate, controller.auth.resetPassword);

  // Protected routes
  apiRouter.use(auth);
  
  // User routes
  apiRouter.get('/users/me', controller.user.getCurrentUser);
  apiRouter.put('/users/me', validate, controller.user.updateProfile);
  apiRouter.post('/users/change-password', validate, controller.user.changePassword);
  apiRouter.post('/users/avatar', controller.user.uploadAvatar);
  
  // Admin routes
  apiRouter.get('/users', admin, controller.user.list);
  apiRouter.get('/users/:id', admin, controller.user.get);
  apiRouter.put('/users/:id', admin, validate, controller.user.update);
  apiRouter.delete('/users/:id', admin, controller.user.delete);

  // Todo routes
  apiRouter.get('/todos', controller.todo.list);
  apiRouter.get('/todos/:id', controller.todo.get);
  apiRouter.post('/todos', validate, controller.todo.create);
  apiRouter.put('/todos/:id', validate, controller.todo.update);
  apiRouter.delete('/todos/:id', controller.todo.delete);
  apiRouter.post('/todos/bulk', controller.todo.bulkOperation);

  // File routes
  apiRouter.post('/files/upload', controller.file.upload);
  apiRouter.get('/files/:id', controller.file.download);
  apiRouter.delete('/files/:id', controller.file.delete);

  // WebSocket routes
  io.of('/').route('join', io.controller.chat.join);
  io.of('/').route('leave', io.controller.chat.leave);
  io.of('/').route('message', io.controller.chat.message);
  io.of('/').route('typing', io.controller.chat.typing);

  // Admin namespace
  io.of('/admin').use(async (ctx, next) => {
    // Admin authentication for WebSocket
    const token = ctx.socket.handshake.auth.token;
    if (!token) {
      ctx.socket.disconnect();
      return;
    }
    await next();
  });
  io.of('/admin').route('stats', io.controller.admin.stats);
  io.of('/admin').route('logs', io.controller.admin.logs);
};`,

    // Auth Controller
    'app/controller/auth.ts': `import { Controller } from 'egg';

export default class AuthController extends Controller {
  async register() {
    const { ctx, service } = this;
    const { email, password, name } = ctx.request.body;

    // Check if user exists
    const existingUser = await service.user.findByEmail(email);
    if (existingUser) {
      ctx.throw(409, 'User already exists');
    }

    // Create user
    const user = await service.user.create({
      email,
      password,
      name});

    // Send verification email
    await service.email.sendVerificationEmail(user);

    // Generate tokens
    const { accessToken, refreshToken } = service.auth.generateTokens(user);

    ctx.body = {
      success: true,
      message: ctx.__('auth.register.success'),
      data: {
        user: user.toJSON(),
        accessToken,
        refreshToken}};
  }

  async login() {
    const { ctx, service } = this;
    const { email, password } = ctx.request.body;

    // Validate credentials
    const user = await service.auth.validateUser(email, password);
    if (!user) {
      ctx.throw(401, ctx.__('auth.login.invalid'));
    }

    // Check if user is active
    if (!user.isActive) {
      ctx.throw(403, ctx.__('auth.login.inactive'));
    }

    // Update last login
    await service.user.updateLastLogin(user.id);

    // Generate tokens
    const { accessToken, refreshToken } = service.auth.generateTokens(user);

    // Set refresh token cookie
    ctx.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: ctx.app.config.env === 'prod',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    ctx.body = {
      success: true,
      message: ctx.__('auth.login.success'),
      data: {
        user: user.toJSON(),
        accessToken}};
  }

  async refresh() {
    const { ctx, service } = this;
    const refreshToken = ctx.cookies.get('refreshToken') || ctx.request.body.refreshToken;

    if (!refreshToken) {
      ctx.throw(401, 'Refresh token not provided');
    }

    const tokens = await service.auth.refreshTokens(refreshToken);

    ctx.body = {
      success: true,
      data: tokens};
  }

  async verify() {
    const { ctx, service } = this;
    const { token } = ctx.params;

    await service.auth.verifyEmail(token);

    ctx.body = {
      success: true,
      message: ctx.__('auth.verify.success')};
  }

  async forgotPassword() {
    const { ctx, service } = this;
    const { email } = ctx.request.body;

    const user = await service.user.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      ctx.body = {
        success: true,
        message: ctx.__('auth.forgot.sent')};
      return;
    }

    const resetToken = await service.auth.generateResetToken(user);
    await service.email.sendPasswordResetEmail(user, resetToken);

    ctx.body = {
      success: true,
      message: ctx.__('auth.forgot.sent')};
  }

  async resetPassword() {
    const { ctx, service } = this;
    const { token, password } = ctx.request.body;

    await service.auth.resetPassword(token, password);

    ctx.body = {
      success: true,
      message: ctx.__('auth.reset.success')};
  }
}`,

    // User Controller
    'app/controller/user.ts': `import { Controller } from 'egg';

export default class UserController extends Controller {
  async list() {
    const { ctx, service } = this;
    const { page = 1, limit = 20, search, role, status } = ctx.query;

    const result = await service.user.paginate({
      page: Number(page),
      limit: Number(limit),
      search,
      role,
      status});

    ctx.body = {
      success: true,
      data: result};
  }

  async get() {
    const { ctx, service } = this;
    const { id } = ctx.params;

    const user = await service.user.findById(id);
    if (!user) {
      ctx.throw(404, 'User not found');
    }

    ctx.body = {
      success: true,
      data: user.toJSON()};
  }

  async getCurrentUser() {
    const { ctx } = this;
    
    ctx.body = {
      success: true,
      data: ctx.state.user.toJSON()};
  }

  async updateProfile() {
    const { ctx, service } = this;
    const updates = ctx.request.body;

    // Remove protected fields
    delete updates.email;
    delete updates.password;
    delete updates.role;
    delete updates.isActive;

    const user = await service.user.update(ctx.state.user.id, updates);

    ctx.body = {
      success: true,
      message: ctx.__('user.update.success'),
      data: user.toJSON()};
  }

  async update() {
    const { ctx, service } = this;
    const { id } = ctx.params;
    const updates = ctx.request.body;

    const user = await service.user.update(id, updates);

    ctx.body = {
      success: true,
      message: ctx.__('user.update.success'),
      data: user.toJSON()};
  }

  async delete() {
    const { ctx, service } = this;
    const { id } = ctx.params;

    await service.user.delete(id);

    ctx.body = {
      success: true,
      message: ctx.__('user.delete.success')};
  }

  async changePassword() {
    const { ctx, service } = this;
    const { currentPassword, newPassword } = ctx.request.body;

    await service.user.changePassword(
      ctx.state.user.id,
      currentPassword,
      newPassword
    );

    ctx.body = {
      success: true,
      message: ctx.__('user.password.changed')};
  }

  async uploadAvatar() {
    const { ctx, service } = this;
    const stream = await ctx.getFileStream();

    const avatarUrl = await service.file.uploadImage(stream, {
      folder: 'avatars',
      resize: { width: 200, height: 200 }});

    await service.user.update(ctx.state.user.id, { avatarUrl });

    ctx.body = {
      success: true,
      message: ctx.__('user.avatar.uploaded'),
      data: { avatarUrl }};
  }
}`,

    // Todo Controller
    'app/controller/todo.ts': `import { Controller } from 'egg';

export default class TodoController extends Controller {
  async list() {
    const { ctx, service } = this;
    const { page = 1, limit = 20, status, priority, sortBy = 'createdAt', order = 'DESC' } = ctx.query;

    const result = await service.todo.paginate({
      userId: ctx.state.user.id,
      page: Number(page),
      limit: Number(limit),
      status,
      priority,
      sortBy,
      order: order.toUpperCase() as 'ASC' | 'DESC'});

    ctx.body = {
      success: true,
      data: result};
  }

  async get() {
    const { ctx, service } = this;
    const { id } = ctx.params;

    const todo = await service.todo.findById(id, ctx.state.user.id);
    if (!todo) {
      ctx.throw(404, 'Todo not found');
    }

    ctx.body = {
      success: true,
      data: todo.toJSON()};
  }

  async create() {
    const { ctx, service } = this;
    const data = {
      ...ctx.request.body,
      userId: ctx.state.user.id};

    const todo = await service.todo.create(data);

    ctx.body = {
      success: true,
      message: ctx.__('todo.create.success'),
      data: todo.toJSON()};
  }

  async update() {
    const { ctx, service } = this;
    const { id } = ctx.params;
    const updates = ctx.request.body;

    const todo = await service.todo.update(id, ctx.state.user.id, updates);

    ctx.body = {
      success: true,
      message: ctx.__('todo.update.success'),
      data: todo.toJSON()};
  }

  async delete() {
    const { ctx, service } = this;
    const { id } = ctx.params;

    await service.todo.delete(id, ctx.state.user.id);

    ctx.body = {
      success: true,
      message: ctx.__('todo.delete.success')};
  }

  async bulkOperation() {
    const { ctx, service } = this;
    const { operation, ids, updates } = ctx.request.body;

    let result;
    switch (operation) {
      case 'delete':
        result = await service.todo.bulkDelete(ids, ctx.state.user.id);
        break;
      case 'update':
        result = await service.todo.bulkUpdate(ids, ctx.state.user.id, updates);
        break;
      case 'complete':
        result = await service.todo.bulkUpdate(ids, ctx.state.user.id, { status: 'completed' });
        break;
      default:
        ctx.throw(400, 'Invalid operation');
    }

    ctx.body = {
      success: true,
      message: ctx.__('todo.bulk.success', { count: result }),
      data: { affected: result }};
  }
}`,

    // Health Controller
    'app/controller/health.ts': `import { Controller } from 'egg';

export default class HealthController extends Controller {
  async check() {
    const { ctx, app } = this;
    
    ctx.body = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: app.config.env,
      version: app.config.pkg.version};
  }

  async readiness() {
    const { ctx, service } = this;
    
    const checks = await service.health.checkReadiness();
    
    if (!checks.ready) {
      ctx.status = 503;
    }
    
    ctx.body = checks;
  }

  async liveness() {
    const { ctx, service } = this;
    
    const checks = await service.health.checkLiveness();
    
    if (!checks.alive) {
      ctx.status = 503;
    }
    
    ctx.body = checks;
  }
}`,

    // Auth Service
    'app/service/auth.ts': `import { Service } from 'egg';
import { v4 as uuidv4 } from 'uuid';

export default class AuthService extends Service {
  generateTokens(user: any) {
    const { jwt } = this.app.config;
    
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role};

    const accessToken = this.app.jwt.sign(payload, jwt.secret, {
      expiresIn: jwt.expiresIn});

    const refreshToken = this.app.jwt.sign(
      { id: user.id },
      jwt.refreshSecret,
      { expiresIn: jwt.refreshExpiresIn }
    );

    return { accessToken, refreshToken };
  }

  async validateUser(email: string, password: string) {
    const user = await this.service.user.findByEmail(email);
    if (!user) {
      return null;
    }

    const isValid = await this.ctx.compare(password, user.password);
    if (!isValid) {
      return null;
    }

    return user;
  }

  async refreshTokens(refreshToken: string) {
    try {
      const decoded = this.app.jwt.verify(refreshToken, this.app.config.jwt.refreshSecret) as any;
      const user = await this.service.user.findById(decoded.id);
      
      if (!user || !user.isActive) {
        this.ctx.throw(401, 'Invalid refresh token');
      }

      return this.generateTokens(user);
    } catch (error) {
      this.ctx.throw(401, 'Invalid refresh token');
    }
  }

  async verifyEmail(token: string) {
    const user = await this.ctx.model.User.findOne({
      where: { verificationToken: token }});

    if (!user) {
      this.ctx.throw(400, 'Invalid verification token');
    }

    await user.update({
      isVerified: true,
      verificationToken: null});

    return user;
  }

  async generateResetToken(user: any) {
    const resetToken = uuidv4();
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1);

    await user.update({
      resetToken,
      resetTokenExpiry});

    return resetToken;
  }

  async resetPassword(token: string, password: string) {
    const user = await this.ctx.model.User.findOne({
      where: { resetToken: token }});

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      this.ctx.throw(400, 'Invalid or expired reset token');
    }

    const hashedPassword = await this.ctx.genHash(password);

    await user.update({
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null});

    return user;
  }
}`,

    // User Service
    'app/service/user.ts': `import { Service } from 'egg';
import { v4 as uuidv4 } from 'uuid';

export default class UserService extends Service {
  async findById(id: string) {
    return await this.ctx.model.User.findByPk(id, {
      attributes: { exclude: ['password'] }});
  }

  async findByEmail(email: string) {
    return await this.ctx.model.User.findOne({
      where: { email: email.toLowerCase() }});
  }

  async create(data: any) {
    const hashedPassword = await this.ctx.genHash(data.password);
    const verificationToken = uuidv4();

    const user = await this.ctx.model.User.create({
      ...data,
      email: data.email.toLowerCase(),
      password: hashedPassword,
      verificationToken});

    return user;
  }

  async update(id: string, updates: any) {
    const user = await this.findById(id);
    if (!user) {
      this.ctx.throw(404, 'User not found');
    }

    await user.update(updates);
    return user;
  }

  async delete(id: string) {
    const user = await this.findById(id);
    if (!user) {
      this.ctx.throw(404, 'User not found');
    }

    // Soft delete
    await user.update({ isActive: false });
    return true;
  }

  async paginate(options: any) {
    const { page = 1, limit = 20, search, role, status } = options;
    const offset = (page - 1) * limit;

    const where: any = {};
    
    if (search) {
      where[this.app.Sequelize.Op.or] = [
        { name: { [this.app.Sequelize.Op.iLike]: \`%\${search}%\` } },
        { email: { [this.app.Sequelize.Op.iLike]: \`%\${search}%\` } }];
    }

    if (role) {
      where.role = role;
    }

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    const { count, rows } = await this.ctx.model.User.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['password'] }});

    return {
      data: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)};
  }

  async updateLastLogin(id: string) {
    await this.ctx.model.User.update(
      { lastLogin: new Date() },
      { where: { id } }
    );
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.ctx.model.User.findByPk(id);
    if (!user) {
      this.ctx.throw(404, 'User not found');
    }

    const isValid = await this.ctx.compare(currentPassword, user.password);
    if (!isValid) {
      this.ctx.throw(400, 'Current password is incorrect');
    }

    const hashedPassword = await this.ctx.genHash(newPassword);
    await user.update({ password: hashedPassword });

    return true;
  }
}`,

    // Todo Service
    'app/service/todo.ts': `import { Service } from 'egg';

export default class TodoService extends Service {
  async findById(id: string, userId: string) {
    return await this.ctx.model.Todo.findOne({
      where: { id, userId },
      include: [{ model: this.ctx.model.User, as: 'user' }]});
  }

  async create(data: any) {
    const todo = await this.ctx.model.Todo.create(data);
    return todo;
  }

  async update(id: string, userId: string, updates: any) {
    const todo = await this.findById(id, userId);
    if (!todo) {
      this.ctx.throw(404, 'Todo not found');
    }

    await todo.update(updates);
    return todo;
  }

  async delete(id: string, userId: string) {
    const todo = await this.findById(id, userId);
    if (!todo) {
      this.ctx.throw(404, 'Todo not found');
    }

    await todo.destroy();
    return true;
  }

  async paginate(options: any) {
    const { userId, page = 1, limit = 20, status, priority, sortBy = 'createdAt', order = 'DESC' } = options;
    const offset = (page - 1) * limit;

    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    const { count, rows } = await this.ctx.model.Todo.findAndCountAll({
      where,
      limit,
      offset,
      order: [[sortBy, order]]});

    return {
      data: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)};
  }

  async bulkDelete(ids: string[], userId: string) {
    const result = await this.ctx.model.Todo.destroy({
      where: {
        id: { [this.app.Sequelize.Op.in]: ids },
        userId}});

    return result;
  }

  async bulkUpdate(ids: string[], userId: string, updates: any) {
    const [affected] = await this.ctx.model.Todo.update(updates, {
      where: {
        id: { [this.app.Sequelize.Op.in]: ids },
        userId}});

    return affected;
  }
}`,

    // Cache Service
    'app/service/cache.ts': `import { Service } from 'egg';

export default class CacheService extends Service {
  async get(key: string) {
    const value = await this.app.redis.get(key);
    if (value) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return null;
  }

  async set(key: string, value: any, ttl = 3600) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    await this.app.redis.setex(key, ttl, stringValue);
  }

  async del(key: string | string[]) {
    if (Array.isArray(key)) {
      await this.app.redis.del(...key);
    } else {
      await this.app.redis.del(key);
    }
  }

  async exists(key: string) {
    const result = await this.app.redis.exists(key);
    return result === 1;
  }

  async incr(key: string) {
    return await this.app.redis.incr(key);
  }

  async expire(key: string, ttl: number) {
    await this.app.redis.expire(key, ttl);
  }

  async ttl(key: string) {
    return await this.app.redis.ttl(key);
  }

  async warmUp() {
    // Preload frequently accessed data
    this.logger.info('Cache warming up...');
    
    // Example: Load configuration
    const config = await this.ctx.model.Config.findAll();
    for (const item of config) {
      await this.set(\`config:\${item.key}\`, item.value);
    }
    
    this.logger.info('Cache warmed up successfully');
  }
}`,

    // Email Service
    'app/service/email.ts': `import { Service } from 'egg';
import * as nodemailer from 'nodemailer';

export default class EmailService extends Service {
  private transporter: nodemailer.Transporter;

  constructor(ctx) {
    super(ctx);
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS}});
  }

  async sendMail(options: nodemailer.SendMailOptions) {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      ...options};

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.info('Email sent:', info.messageId);
      return info;
    } catch (error) {
      this.logger.error('Email send error:', error);
      throw error;
    }
  }

  async sendVerificationEmail(user: any) {
    const verificationUrl = \`\${process.env.APP_URL}/api/v1/auth/verify/\${user.verificationToken}\`;
    
    const html = await this.ctx.renderView('email/verification.nj', {
      user,
      verificationUrl});

    await this.sendMail({
      to: user.email,
      subject: this.ctx.__('email.verification.subject'),
      html});
  }

  async sendPasswordResetEmail(user: any, resetToken: string) {
    const resetUrl = \`\${process.env.FRONTEND_URL}/reset-password?token=\${resetToken}\`;
    
    const html = await this.ctx.renderView('email/password-reset.nj', {
      user,
      resetUrl});

    await this.sendMail({
      to: user.email,
      subject: this.ctx.__('email.passwordReset.subject'),
      html});
  }

  async sendWelcomeEmail(user: any) {
    const html = await this.ctx.renderView('email/welcome.nj', {
      user});

    await this.sendMail({
      to: user.email,
      subject: this.ctx.__('email.welcome.subject'),
      html});
  }
}`,

    // User Model
    'app/model/user.ts': `import { Application } from 'egg';

export default (app: Application) => {
  const { STRING, INTEGER, DATE, BOOLEAN, ENUM, UUID, UUIDV4, JSON } = app.Sequelize;

  const User = app.model.define('user', {
    id: {
      type: UUID,
      defaultValue: UUIDV4,
      primaryKey: true},
    email: {
      type: STRING(255),
      unique: true,
      allowNull: false,
      validate: {
        isEmail: true}},
    password: {
      type: STRING(255),
      allowNull: false},
    name: {
      type: STRING(100),
      allowNull: false},
    role: {
      type: ENUM('user', 'admin'),
      defaultValue: 'user'},
    isActive: {
      type: BOOLEAN,
      defaultValue: true},
    isVerified: {
      type: BOOLEAN,
      defaultValue: false},
    verificationToken: {
      type: STRING(255),
      allowNull: true},
    resetToken: {
      type: STRING(255),
      allowNull: true},
    resetTokenExpiry: {
      type: DATE,
      allowNull: true},
    avatarUrl: {
      type: STRING(500),
      allowNull: true},
    phone: {
      type: STRING(20),
      allowNull: true},
    lastLogin: {
      type: DATE,
      allowNull: true},
    metadata: {
      type: JSON,
      allowNull: true}}, {
    timestamps: true,
    underscored: true,
    tableName: 'users'});

  User.associate = () => {
    app.model.User.hasMany(app.model.Todo, { as: 'todos', foreignKey: 'userId' });
  };

  // Instance methods
  User.prototype.toJSON = function() {
    const values = this.get() as any;
    delete values.password;
    delete values.verificationToken;
    delete values.resetToken;
    delete values.resetTokenExpiry;
    return values;
  };

  return User;
};`,

    // Todo Model
    'app/model/todo.ts': `import { Application } from 'egg';

export default (app: Application) => {
  const { STRING, INTEGER, DATE, BOOLEAN, ENUM, UUID, UUIDV4, TEXT, ARRAY } = app.Sequelize;

  const Todo = app.model.define('todo', {
    id: {
      type: UUID,
      defaultValue: UUIDV4,
      primaryKey: true},
    title: {
      type: STRING(200),
      allowNull: false},
    description: {
      type: TEXT,
      allowNull: true},
    status: {
      type: ENUM('pending', 'in_progress', 'completed', 'archived'),
      defaultValue: 'pending'},
    priority: {
      type: ENUM('low', 'medium', 'high'),
      defaultValue: 'medium'},
    dueDate: {
      type: DATE,
      allowNull: true},
    tags: {
      type: ARRAY(STRING),
      defaultValue: []},
    userId: {
      type: UUID,
      allowNull: false}}, {
    timestamps: true,
    underscored: true,
    tableName: 'todos',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['status'] },
      { fields: ['priority'] },
      { fields: ['due_date'] }]});

  Todo.associate = () => {
    app.model.Todo.belongsTo(app.model.User, { as: 'user', foreignKey: 'userId' });
  };

  return Todo;
};`,

    // Auth Middleware
    'app/middleware/auth.ts': `import { Context, Application } from 'egg';

export default (options?: any, app?: Application) => {
  return async (ctx: Context, next: () => Promise<any>) => {
    const token = ctx.headers.authorization?.replace('Bearer ', '') || ctx.query.token;

    if (!token) {
      ctx.throw(401, 'No token provided');
    }

    try {
      const decoded = ctx.app.jwt.verify(token, ctx.app.config.jwt.secret) as any;
      const user = await ctx.service.user.findById(decoded.id);

      if (!user || !user.isActive) {
        ctx.throw(401, 'Invalid token');
      }

      ctx.state.user = user;
      await next();
    } catch (error) {
      ctx.throw(401, 'Invalid token');
    }
  };
};`,

    // Rate Limit Middleware
    'app/middleware/rateLimit.ts': `import { Context } from 'egg';

export default () => {
  return async (ctx: Context, next: () => Promise<any>) => {
    const { redis } = ctx.app;
    const key = \`rate_limit:\${ctx.ip}:\${ctx.path}\`;
    const limit = 100; // requests per minute
    const ttl = 60; // seconds

    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, ttl);
    }

    if (current > limit) {
      ctx.status = 429;
      ctx.body = {
        success: false,
        message: 'Too many requests'};
      return;
    }

    ctx.set('X-RateLimit-Limit', String(limit));
    ctx.set('X-RateLimit-Remaining', String(limit - current));
    ctx.set('X-RateLimit-Reset', String(Date.now() + ttl * 1000));

    await next();
  };
};`,

    // Error Handler Middleware
    'app/middleware/errorHandler.ts': `import { Context } from 'egg';

export default () => {
  return async (ctx: Context, next: () => Promise<any>) => {
    try {
      await next();
    } catch (err: any) {
      // Emit error event
      ctx.app.emit('error', err, ctx);

      // Normalize error
      const status = err.status || 500;
      const message = err.message || 'Internal Server Error';

      // Error response
      ctx.status = status;
      ctx.body = {
        success: false,
        message,
        code: err.code || 'INTERNAL_ERROR',
        ...(ctx.app.config.env === 'local' && {
          stack: err.stack,
          details: err})};

      // Log error
      if (status >= 500) {
        ctx.logger.error({
          message: err.message,
          stack: err.stack,
          url: ctx.url,
          method: ctx.method,
          ip: ctx.ip,
          status});
      }
    }
  };
};`,

    // Schedule Tasks
    'app/schedule/cleanup.ts': `import { Subscription } from 'egg';

export default class CleanupTask extends Subscription {
  static get schedule() {
    return {
      cron: '0 0 3 * * *', // Run at 3 AM daily
      type: 'worker', // Run on one worker only
      immediate: false};
  }

  async subscribe() {
    const { ctx } = this;
    
    ctx.logger.info('Starting cleanup task...');
    
    try {
      // Clean expired sessions
      await this.cleanExpiredSessions();
      
      // Clean old logs
      await this.cleanOldLogs();
      
      // Clean temporary files
      await this.cleanTempFiles();
      
      // Clean expired tokens
      await this.cleanExpiredTokens();
      
      ctx.logger.info('Cleanup task completed successfully');
    } catch (error) {
      ctx.logger.error('Cleanup task failed:', error);
    }
  }

  private async cleanExpiredSessions() {
    const { app } = this;
    const pattern = 'sess:*';
    const keys = await app.redis.keys(pattern);
    
    let cleaned = 0;
    for (const key of keys) {
      const ttl = await app.redis.ttl(key);
      if (ttl === -1) {
        // No expiry set, check if expired
        const session = await app.redis.get(key);
        if (session) {
          try {
            const data = JSON.parse(session);
            if (data.expire && Date.now() > data.expire) {
              await app.redis.del(key);
              cleaned++;
            }
          } catch {
            // Invalid session data
            await app.redis.del(key);
            cleaned++;
          }
        }
      }
    }
    
    this.logger.info(\`Cleaned \${cleaned} expired sessions\`);
  }

  private async cleanOldLogs() {
    // Implementation depends on your logging setup
    this.logger.info('Cleaning old logs...');
  }

  private async cleanTempFiles() {
    // Clean temporary upload files older than 24 hours
    const fs = require('fs').promises;
    const path = require('path');
    const tempDir = path.join(this.app.baseDir, 'app/public/temp');
    
    try {
      const files = await fs.readdir(tempDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      this.logger.error('Error cleaning temp files:', error);
    }
  }

  private async cleanExpiredTokens() {
    const { ctx } = this;
    
    // Clean expired reset tokens
    await ctx.model.User.update(
      {
        resetToken: null,
        resetTokenExpiry: null},
      {
        where: {
          resetTokenExpiry: {
            [ctx.app.Sequelize.Op.lt]: new Date()}}}
    );
  }
}`,

    // WebSocket Controller
    'app/io/controller/chat.ts': `import { Controller } from 'egg';

export default class ChatController extends Controller {
  async join() {
    const { ctx, app } = this;
    const { room } = ctx.args[0];
    const { socket } = ctx;

    socket.join(room);
    
    // Notify others in room
    socket.to(room).emit('user_joined', {
      userId: ctx.state.user.id,
      username: ctx.state.user.name,
      timestamp: new Date()});

    await ctx.socket.emit('joined', {
      room,
      message: 'Successfully joined room'});
  }

  async leave() {
    const { ctx } = this;
    const { room } = ctx.args[0];
    const { socket } = ctx;

    socket.leave(room);
    
    // Notify others in room
    socket.to(room).emit('user_left', {
      userId: ctx.state.user.id,
      username: ctx.state.user.name,
      timestamp: new Date()});

    await ctx.socket.emit('left', {
      room,
      message: 'Successfully left room'});
  }

  async message() {
    const { ctx } = this;
    const { room, message } = ctx.args[0];
    const { socket } = ctx;

    // Save message to database
    const savedMessage = await ctx.service.chat.saveMessage({
      userId: ctx.state.user.id,
      room,
      message});

    // Broadcast to room
    socket.to(room).emit('message', {
      id: savedMessage.id,
      userId: ctx.state.user.id,
      username: ctx.state.user.name,
      message,
      timestamp: savedMessage.createdAt});

    await ctx.socket.emit('message_sent', {
      id: savedMessage.id,
      timestamp: savedMessage.createdAt});
  }

  async typing() {
    const { ctx } = this;
    const { room, isTyping } = ctx.args[0];
    const { socket } = ctx;

    socket.to(room).emit('typing', {
      userId: ctx.state.user.id,
      username: ctx.state.user.name,
      isTyping});
  }
}`,

    // Environment variables
    '.env.example': `# Application
NODE_ENV=development
EGG_SERVER_ENV=local

# Server
PORT=7001
WORKERS=1

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME={{projectName}}_dev
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@example.com

# URLs
APP_URL=http://localhost:7001
FRONTEND_URL=http://localhost:3000

# File Upload
MAX_FILE_SIZE=52428800
UPLOAD_DIR=app/public/uploads

# Object Storage (Optional)
OSS_REGION=
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OSS_BUCKET=

# Third Party APIs
WECHAT_APP_ID=
WECHAT_APP_SECRET=
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=`,

    // Docker configuration
    'Dockerfile': `# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run tsc

# Production stage
FROM node:18-alpine

# Install dumb-init
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/app ./app
COPY --from=builder /app/config ./config
COPY --from=builder /app/typings ./typings

# Copy other necessary files
COPY app.ts ./
COPY .env.example ./.env

# Create necessary directories
RUN mkdir -p logs run app/public/uploads app/public/temp

# Expose port
EXPOSE 7001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:7001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    container_name: {{projectName}}-api
    ports:
      - "\${PORT:-7001}:7001"
    environment:
      - NODE_ENV=production
      - EGG_SERVER_ENV=prod
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=\${DB_NAME:-{{projectName}}}
      - DB_USER=\${DB_USER:-postgres}
      - DB_PASSWORD=\${DB_PASSWORD:-postgres}
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
      - ./logs:/app/logs
      - ./run:/app/run
      - ./app/public/uploads:/app/app/public/uploads
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
    command: redis-server --appendonly yes --requirepass \${REDIS_PASSWORD:-}
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

    // Nginx configuration
    'nginx.conf': `events {
    worker_connections 1024;
}

http {
    upstream egg_server {
        server app:7001;
    }

    server {
        listen 80;
        server_name localhost;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # Gzip
        gzip on;
        gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
        gzip_proxied any;
        gzip_vary on;

        # API
        location / {
            proxy_pass http://egg_server;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 120s;
        }

        # WebSocket
        location /socket.io/ {
            proxy_pass http://egg_server;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static files
        location /public/ {
            proxy_pass http://egg_server;
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }
}`,

    // README
    'README.md': `# {{projectName}}

Enterprise-grade Egg.js application with TypeScript, featuring convention-over-configuration and multi-process architecture.

## Features

- 🏗️ **Convention over Configuration** - Less boilerplate, more productivity
- 🔄 **Multi-process Model** - Built-in clustering for high performance
- 🔌 **Plugin System** - Extensive ecosystem with easy integration
- 🛡️ **Built-in Security** - CSRF, XSS, and other protections out of the box
- 📅 **Schedule Tasks** - Cron jobs with cluster support
- 🌍 **Internationalization** - Multi-language support
- 🔄 **WebSocket** - Real-time communication with Socket.IO
- 📊 **ORM Support** - Sequelize integration with migrations
- 🧪 **Testing** - Comprehensive testing with egg-mock
- 🐳 **Docker Ready** - Production-ready containerization

## Getting Started

### Prerequisites

- Node.js 16+
- PostgreSQL
- Redis

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
   npm run migrate:up
   \`\`\`

5. Start development server:
   \`\`\`bash
   npm run dev
   \`\`\`

### Running with Docker

\`\`\`bash
docker-compose up
\`\`\`

## Project Structure

\`\`\`
app/
├── controller/     # Request handlers
├── service/        # Business logic
├── middleware/     # Custom middleware
├── model/          # Database models
├── router.ts       # Route definitions
├── schedule/       # Scheduled tasks
├── io/            # WebSocket controllers
├── public/        # Static assets
└── view/          # View templates

config/
├── config.default.ts  # Default configuration
├── config.local.ts    # Local development
├── config.prod.ts     # Production
├── plugin.ts          # Plugin configuration
└── locale/           # i18n resources
\`\`\`

## Commands

- \`npm run dev\` - Start development server
- \`npm run start\` - Start production server
- \`npm run stop\` - Stop production server
- \`npm run test\` - Run tests
- \`npm run cov\` - Run tests with coverage
- \`npm run lint\` - Run linter
- \`npm run tsc\` - Compile TypeScript
- \`npm run migrate:up\` - Run migrations
- \`npm run migrate:down\` - Rollback migrations

## API Documentation

- Swagger UI: http://localhost:7001/swagger-ui.html
- Health Check: http://localhost:7001/health

## Testing

\`\`\`bash
# Run all tests
npm test

# Run specific test file
npm test test/controller/user.test.ts

# Run with coverage
npm run cov
\`\`\`

## Deployment

1. Build the application:
   \`\`\`bash
   npm run tsc
   \`\`\`

2. Start in production:
   \`\`\`bash
   npm start
   \`\`\`

3. Or use PM2:
   \`\`\`bash
   pm2 start npm --name "{{projectName}}" -- start
   \`\`\`

## License

MIT
`
  }
};