import { BackendTemplate } from '../types';

export const sailsjsTemplate: BackendTemplate = {
  id: 'sailsjs',
  name: 'sailsjs',
  displayName: 'Sails.js',
  description: 'Full-featured MVC framework with auto-generated REST APIs, Waterline ORM, WebSocket support, and convention-over-configuration',
  language: 'javascript',
  framework: 'sailsjs',
  version: '1.5.8',
  tags: ['nodejs', 'sailsjs', 'microservices', 'rest', 'waterline', 'websockets', 'routing', 'realtime'],
  port: 1337,
  dependencies: {},
  features: ['microservices', 'database', 'routing', 'websockets', 'authorization', 'authentication', 'file-upload', 'email', 'testing'],
  
  files: {
    // Package configuration
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "Sails.js MVC application with auto-generated REST APIs",
  "keywords": ["sails", "microservices", "rest", "api", "waterline"],
  "dependencies": {
    "sails": "^1.5.8",
    "sails-hook-grunt": "^5.0.0",
    "sails-hook-orm": "^4.0.0",
    "sails-hook-sockets": "^2.0.0",
    "sails-postgresql": "^5.0.0",
    "sails-mysql": "^3.0.0",
    "sails-mongo": "^2.1.1",
    "sails-redis": "^1.0.0",
    "sails-disk": "^2.1.0",
    "@sailshq/connect-redis": "^6.1.3",
    "@sailshq/socket.io-redis": "^6.1.2",
    "@sailshq/lodash": "^3.10.6",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "passport-local": "^1.0.0",
    "nodemailer": "^6.9.13",
    "skipper": "^0.9.0",
    "skipper-disk": "^0.5.14",
    "skipper-s3": "^0.6.0",
    "moment": "^2.30.1",
    "validator": "^13.12.0",
    : "^3.2.5",
    "machinepack-passwords": "^2.3.0",
    "machinepack-jwt": "^1.0.0",
    "machinepack-mailgun": "^0.6.1",
    "sails-hook-apianalytics": "^2.0.5",
    "sails-hook-cron": "^3.1.1",
    "sails-hook-winston": "^1.0.1",
    "winston": "^3.13.0",
    "winston-daily-rotate-file": "^4.7.1",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "compression": "^1.7.4",
    "express-rate-limit": "^7.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.7",
    "@types/express": "^4.17.21",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/passport": "^1.0.16",
    "@types/passport-jwt": "^4.0.1",
    "@types/passport-local": "^1.0.38",
    "@types/validator": "^13.11.9",
    "@types/async": "^3.2.24",
    "@types/lodash": "^4.17.0",
    "mocha": "^10.4.0",
    "chai": "^5.1.0",
    "supertest": "^7.0.0",
    "eslint": "^8.57.0",
    "nodemon": "^3.1.0",
    "grunt": "^1.6.1"
  },
  "scripts": {
    "start": "NODE_ENV=production node app.js",
    "dev": "nodemon app.js",
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "mocha test/unit/**/*.test.js --timeout 10000",
    "test:integration": "mocha test/integration/**/*.test.js --timeout 10000",
    "test:watch": "mocha test/**/*.test.js --watch --timeout 10000",
    "lint": "eslint . --ext .js --ignore-path .gitignore",
    "debug": "node --inspect app.js",
    "docker:build": "docker build -t {{projectName}} .",
    "docker:run": "docker run -p 1337:1337 {{projectName}}"
  },
  "main": "app.js",
  "repository": {
    "type": "git",
    "url": "git://github.com/{{username}}/{{projectName}}.git"
  }
}`,

    // Main application file
    'app.js': `/**
 * app.js
 *
 * Use this file to run your app with 'node app.js'.
 * To start in production mode: NODE_ENV=production node app.js
 */

// Ensure we're in the project directory
process.chdir(__dirname);

// Attempt to import Sails
var sails;
try {
  sails = require('sails');
} catch (e) {
  console.error('To run an app using node app.js, you need to have Sails installed');
  console.error('locally (npm install sails). To do that, run npm install sails');
  console.error('');
  console.error('Alternatively, if you have sails installed globally (i.e. you did');
  console.error('npm install -g sails), you can use sails lift.');
  console.error('');
  console.error('When you run sails lift, your app will still use a local ./node_modules/sails');
  console.error('dependency if it exists, but if it doesn\\'t, the app will run with');
  console.error('the global sails instead!');
  return;
}

// Load environment variables from .env file
require('dotenv').config();

// Start server
sails.lift();`,

    // Sails configuration - Main config
    'config/env/production.js': `/**
 * Production environment settings
 */

module.exports = {
  
  datastores: {
    default: {
      adapter: 'sails-postgresql',
      url: process.env.DATABASE_URL,
      ssl: true
    }
  },

  models: {
    migrate: 'safe',
    cascadeOnDestroy: false
  },

  blueprints: {
    shortcuts: false
  },

  security: {
    cors: {
      allRoutes: true,
      allowOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
      allowCredentials: true,
      allowRequestHeaders: 'content-type,authorization'
    }
  },

  session: {
    adapter: '@sailshq/connect-redis',
    url: process.env.REDIS_URL,
    cookie: {
      secure: true,
      maxAge: 24 * 60 * 60 * 1000  // 24 hours
    }
  },

  sockets: {
    adapter: '@sailshq/socket.io-redis',
    url: process.env.REDIS_URL,
    onlyAllowOrigins: process.env.SOCKET_ORIGINS ? process.env.SOCKET_ORIGINS.split(',') : []
  },

  log: {
    level: 'info'
  },

  http: {
    cache: 365.25 * 24 * 60 * 60 * 1000, // One year
    trustProxy: true
  },

  port: process.env.PORT || 1337,

  custom: {
    baseUrl: process.env.BASE_URL || 'https://example.com',
    internalEmailAddress: 'support@example.com'
  }

};`,

    // Development environment config
    'config/env/development.js': `/**
 * Development environment settings
 */

module.exports = {

  datastores: {
    default: {
      adapter: 'sails-disk'
    }
  },

  models: {
    migrate: 'alter'
  },

  blueprints: {
    shortcuts: true
  },

  security: {
    cors: {
      allRoutes: true,
      allowOrigins: '*',
      allowCredentials: true
    }
  },

  session: {
    secret: 'your-development-session-secret',
    adapter: undefined,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000  // 24 hours
    }
  },

  sockets: {
    onlyAllowOrigins: []
  },

  log: {
    level: 'debug'
  },

  custom: {
    baseUrl: 'http://localhost:1337',
    internalEmailAddress: 'dev@example.com'
  }

};`,

    // Models configuration
    'config/models.js': `/**
 * Default model settings
 */

module.exports.models = {

  // Schema setting
  schema: true,

  // Default primary key attribute
  primaryKey: 'id',
  
  // Default attributes for all models
  attributes: {
    id: { type: 'string', columnName: '_id', autoIncrement: false },
    createdAt: { type: 'number', autoCreatedAt: true },
    updatedAt: { type: 'number', autoUpdatedAt: true }
  },

  // Lifecycle callbacks
  beforeCreate: function(valuesToSet, proceed) {
    // Generate UUID for ID if not provided
    if (!valuesToSet.id) {
      valuesToSet.id = require('crypto').randomUUID();
    }
    return proceed();
  },

  // Custom validation rules
  customToJSON: function() {
    // Remove sensitive fields from JSON output
    if (this.password) {
      delete this.password;
    }
    return this;
  },

  // Datastore configuration
  datastore: 'default',

  // CASCADE delete
  cascadeOnDestroy: true

};`,

    // Blueprints configuration
    'config/blueprints.js': `/**
 * Blueprint API Configuration
 */

module.exports.blueprints = {

  // RESTful routes (GET /model, GET /model/:id, POST /model, etc.)
  rest: true,

  // Shortcut routes (/model/find/:id?, /model/create, etc.)
  shortcuts: false,

  // Action routes (/model/:action)
  actions: true,

  // Prefix for all blueprint routes
  prefix: '/api/v1',

  // Default limit for queries
  defaultLimit: 30,

  // Whether to populate associations by default
  populate: false,

  // Auto-watch for changes in development
  autoWatch: true,

  // Parse blueprint parameters from request
  parseBlueprintOptions: function(req) {
    var options = req._sails.hooks.blueprints.parseBlueprintOptions(req);
    
    // Custom query modifications
    if (req.user && req.user.tenantId) {
      options.criteria.where = options.criteria.where || {};
      options.criteria.where.tenantId = req.user.tenantId;
    }
    
    return options;
  }

};`,

    // Routes configuration
    'config/routes.js': `/**
 * Route Mappings
 */

module.exports.routes = {

  // Homepage
  'GET /': { view: 'pages/homepage' },

  // Authentication endpoints
  'POST /api/v1/auth/register': 'AuthController.register',
  'POST /api/v1/auth/login': 'AuthController.login',
  'POST /api/v1/auth/logout': 'AuthController.logout',
  'POST /api/v1/auth/refresh': 'AuthController.refreshToken',
  'GET /api/v1/auth/verify/:token': 'AuthController.verifyEmail',
  'POST /api/v1/auth/forgot-password': 'AuthController.forgotPassword',
  'POST /api/v1/auth/reset-password': 'AuthController.resetPassword',

  // User management
  'GET /api/v1/users/me': 'UserController.me',
  'PUT /api/v1/users/me': 'UserController.updateMe',
  'POST /api/v1/users/me/avatar': 'UserController.uploadAvatar',
  'PUT /api/v1/users/me/password': 'UserController.changePassword',

  // File uploads
  'POST /api/v1/upload': 'FileController.upload',
  'GET /api/v1/files/:id': 'FileController.download',
  'DELETE /api/v1/files/:id': 'FileController.delete',

  // WebSocket events
  'GET /api/v1/subscribe/:model/:id?': 'SubscriptionController.subscribe',
  'GET /api/v1/unsubscribe/:model/:id?': 'SubscriptionController.unsubscribe',

  // Health check
  'GET /health': 'HealthController.check',

  // API documentation
  'GET /api-docs': { view: 'pages/api-docs' }

};`,

    // Policies configuration
    'config/policies.js': `/**
 * Policy Mappings
 */

module.exports.policies = {

  // Default policy for all controllers/actions
  '*': ['isAuthenticated'],

  // Auth controller policies
  AuthController: {
    '*': true,  // Allow all auth actions without authentication
    logout: ['isAuthenticated'],
    refreshToken: ['isAuthenticated']
  },

  // User controller policies
  UserController: {
    find: ['isAuthenticated', 'isAdmin'],
    findOne: ['isAuthenticated', 'canAccessUser'],
    create: ['isAuthenticated', 'isAdmin'],
    update: ['isAuthenticated', 'canAccessUser'],
    destroy: ['isAuthenticated', 'isAdmin'],
    me: ['isAuthenticated'],
    updateMe: ['isAuthenticated'],
    uploadAvatar: ['isAuthenticated'],
    changePassword: ['isAuthenticated']
  },

  // Public endpoints
  HealthController: {
    '*': true
  },

  // File controller policies
  FileController: {
    upload: ['isAuthenticated', 'canUpload'],
    download: ['isAuthenticated', 'canDownloadFile'],
    delete: ['isAuthenticated', 'canDeleteFile']
  }

};`,

    // Security configuration
    'config/security.js': `/**
 * Security Settings
 */

module.exports.security = {

  // CORS settings
  cors: {
    allRoutes: true,
    allowOrigins: '*',
    allowCredentials: true,
    allowRequestMethods: 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH',
    allowRequestHeaders: 'content-type, authorization',
    allowResponseHeaders: 'content-range, x-content-range'
  },

  // CSRF protection
  csrf: false,

  // Content Security Policy
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }

};`,

    // User model
    'api/models/User.js': `/**
 * User.js
 *
 * User account model with authentication
 */

module.exports = {

  attributes: {
    
    // Basic info
    email: {
      type: 'string',
      required: true,
      unique: true,
      isEmail: true,
      maxLength: 200,
      example: 'user@example.com'
    },

    password: {
      type: 'string',
      required: true,
      protect: true,
      example: 'password123'
    },

    name: {
      type: 'string',
      required: true,
      maxLength: 120,
      example: 'John Doe'
    },

    role: {
      type: 'string',
      isIn: ['user', 'admin', 'moderator'],
      defaultsTo: 'user',
      example: 'user'
    },

    // Profile
    avatar: {
      type: 'string',
      allowNull: true,
      example: 'https://example.com/avatar.jpg'
    },

    bio: {
      type: 'string',
      allowNull: true,
      maxLength: 500,
      example: 'Software developer passionate about Sails.js'
    },

    // Account status
    isActive: {
      type: 'boolean',
      defaultsTo: true
    },

    isEmailVerified: {
      type: 'boolean',
      defaultsTo: false
    },

    emailVerificationToken: {
      type: 'string',
      allowNull: true,
      protect: true
    },

    passwordResetToken: {
      type: 'string',
      allowNull: true,
      protect: true
    },

    passwordResetExpires: {
      type: 'number',
      allowNull: true
    },

    // Security
    lastLogin: {
      type: 'number',
      allowNull: true
    },

    loginAttempts: {
      type: 'number',
      defaultsTo: 0
    },

    lockUntil: {
      type: 'number',
      allowNull: true
    },

    refreshTokens: {
      type: 'json',
      defaultsTo: [],
      protect: true
    },

    // Associations
    todos: {
      collection: 'todo',
      via: 'owner'
    },

    files: {
      collection: 'file',
      via: 'uploadedBy'
    }

  },

  // Lifecycle callbacks
  beforeCreate: async function(valuesToSet, proceed) {
    // Hash password
    const bcrypt = require('bcryptjs');
    valuesToSet.password = await bcrypt.hash(valuesToSet.password, 10);
    
    // Generate email verification token
    valuesToSet.emailVerificationToken = require('crypto').randomBytes(32).toString('hex');
    
    return proceed();
  },

  beforeUpdate: async function(valuesToUpdate, proceed) {
    // Hash password if changed
    if (valuesToUpdate.password) {
      const bcrypt = require('bcryptjs');
      valuesToUpdate.password = await bcrypt.hash(valuesToUpdate.password, 10);
    }
    
    return proceed();
  },

  // Custom methods
  customToJSON: function() {
    var obj = this.toObject();
    delete obj.password;
    delete obj.refreshTokens;
    delete obj.emailVerificationToken;
    delete obj.passwordResetToken;
    delete obj.passwordResetExpires;
    return obj;
  }

};`,

    // Todo model
    'api/models/Todo.js': `/**
 * Todo.js
 *
 * Todo item model with real-time updates
 */

module.exports = {

  attributes: {
    
    title: {
      type: 'string',
      required: true,
      maxLength: 200,
      example: 'Complete Sails.js tutorial'
    },

    description: {
      type: 'string',
      allowNull: true,
      maxLength: 1000,
      example: 'Learn about blueprints, policies, and WebSockets'
    },

    status: {
      type: 'string',
      isIn: ['pending', 'in_progress', 'completed', 'cancelled'],
      defaultsTo: 'pending',
      example: 'pending'
    },

    priority: {
      type: 'string',
      isIn: ['low', 'medium', 'high', 'urgent'],
      defaultsTo: 'medium',
      example: 'medium'
    },

    dueDate: {
      type: 'number',
      allowNull: true,
      example: 1640995200000
    },

    completedAt: {
      type: 'number',
      allowNull: true
    },

    tags: {
      type: 'json',
      defaultsTo: [],
      example: ['work', 'important']
    },

    // Associations
    owner: {
      model: 'user',
      required: true
    },

    assignedTo: {
      model: 'user',
      allowNull: true
    },

    attachments: {
      collection: 'file',
      via: 'todo'
    }

  },

  // Lifecycle callbacks
  afterCreate: async function(newlyCreatedRecord, proceed) {
    // Broadcast creation to subscribers
    sails.sockets.broadcast('todo', 'todo-created', {
      verb: 'created',
      data: newlyCreatedRecord
    });
    
    return proceed();
  },

  afterUpdate: async function(updatedRecord, proceed) {
    // Broadcast update to subscribers
    sails.sockets.broadcast('todo', 'todo-updated', {
      verb: 'updated',
      data: updatedRecord,
      id: updatedRecord.id
    });
    
    return proceed();
  },

  afterDestroy: async function(destroyedRecord, proceed) {
    // Broadcast deletion to subscribers
    sails.sockets.broadcast('todo', 'todo-deleted', {
      verb: 'destroyed',
      id: destroyedRecord.id
    });
    
    return proceed();
  }

};`,

    // File model
    'api/models/File.js': `/**
 * File.js
 *
 * File upload model
 */

module.exports = {

  attributes: {
    
    filename: {
      type: 'string',
      required: true,
      example: 'document.pdf'
    },

    originalName: {
      type: 'string',
      required: true,
      example: 'My Document.pdf'
    },

    mimeType: {
      type: 'string',
      required: true,
      example: 'application/pdf'
    },

    size: {
      type: 'number',
      required: true,
      example: 1024000
    },

    path: {
      type: 'string',
      required: true,
      protect: true
    },

    url: {
      type: 'string',
      allowNull: true,
      example: 'https://example.com/uploads/document.pdf'
    },

    storageAdapter: {
      type: 'string',
      isIn: ['disk', 's3', 'azure'],
      defaultsTo: 'disk'
    },

    metadata: {
      type: 'json',
      defaultsTo: {}
    },

    // Associations
    uploadedBy: {
      model: 'user',
      required: true
    },

    todo: {
      model: 'todo',
      allowNull: true
    }

  }

};`,

    // Auth controller
    'api/controllers/AuthController.js': `/**
 * AuthController
 *
 * Authentication and authorization endpoints
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = {

  /**
   * Register a new user
   */
  register: async function(req, res) {
    try {
      const { email, password, name } = req.body;

      // Validate input
      if (!email || !password || !name) {
        return res.badRequest({ error: 'Missing required fields' });
      }

      // Check if user exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.badRequest({ error: 'Email already registered' });
      }

      // Create user
      const user = await User.create({
        email: email.toLowerCase(),
        password,
        name
      }).fetch();

      // Generate tokens
      const accessToken = sails.helpers.generateJwt(user.id);
      const refreshToken = sails.helpers.generateRefreshToken();

      // Save refresh token
      await User.updateOne({ id: user.id })
        .set({ 
          refreshTokens: [refreshToken],
          lastLogin: Date.now()
        });

      // Send verification email
      await sails.helpers.sendEmail.with({
        to: user.email,
        subject: 'Verify your email',
        template: 'email-verify',
        templateData: {
          name: user.name,
          token: user.emailVerificationToken
        }
      });

      return res.status(201).json({
        success: true,
        message: 'Registration successful',
        user: user,
        accessToken,
        refreshToken
      });

    } catch (error) {
      return res.serverError(error);
    }
  },

  /**
   * Login user
   */
  login: async function(req, res) {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.badRequest({ error: 'Invalid credentials' });
      }

      // Check if account is locked
      if (user.lockUntil && user.lockUntil > Date.now()) {
        return res.forbidden({ error: 'Account locked. Try again later.' });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        // Increment login attempts
        await User.updateOne({ id: user.id })
          .set({ loginAttempts: user.loginAttempts + 1 });

        // Lock account after 5 attempts
        if (user.loginAttempts >= 4) {
          await User.updateOne({ id: user.id })
            .set({ lockUntil: Date.now() + (2 * 60 * 60 * 1000) }); // 2 hours
        }

        return res.badRequest({ error: 'Invalid credentials' });
      }

      // Generate tokens
      const accessToken = sails.helpers.generateJwt(user.id);
      const refreshToken = sails.helpers.generateRefreshToken();

      // Update user
      const refreshTokens = user.refreshTokens || [];
      refreshTokens.push(refreshToken);

      await User.updateOne({ id: user.id })
        .set({ 
          refreshTokens: refreshTokens.slice(-5), // Keep last 5 tokens
          lastLogin: Date.now(),
          loginAttempts: 0,
          lockUntil: null
        });

      return res.json({
        success: true,
        message: 'Login successful',
        user: user,
        accessToken,
        refreshToken
      });

    } catch (error) {
      return res.serverError(error);
    }
  },

  /**
   * Logout user
   */
  logout: async function(req, res) {
    try {
      const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];
      
      if (refreshToken && req.user) {
        // Remove refresh token
        const user = await User.findOne({ id: req.user.id });
        const refreshTokens = (user.refreshTokens || []).filter(token => token !== refreshToken);
        
        await User.updateOne({ id: req.user.id })
          .set({ refreshTokens });
      }

      return res.json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      return res.serverError(error);
    }
  },

  /**
   * Refresh access token
   */
  refreshToken: async function(req, res) {
    try {
      const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];

      if (!refreshToken) {
        return res.badRequest({ error: 'Refresh token required' });
      }

      // Find user with this refresh token
      const user = await User.findOne({ refreshTokens: { contains: refreshToken } });
      if (!user) {
        return res.forbidden({ error: 'Invalid refresh token' });
      }

      // Generate new access token
      const accessToken = sails.helpers.generateJwt(user.id);

      return res.json({
        success: true,
        accessToken
      });

    } catch (error) {
      return res.serverError(error);
    }
  },

  /**
   * Verify email
   */
  verifyEmail: async function(req, res) {
    try {
      const { token } = req.params;

      const user = await User.findOne({ emailVerificationToken: token });
      if (!user) {
        return res.badRequest({ error: 'Invalid verification token' });
      }

      await User.updateOne({ id: user.id })
        .set({ 
          isEmailVerified: true,
          emailVerificationToken: null
        });

      return res.json({
        success: true,
        message: 'Email verified successfully'
      });

    } catch (error) {
      return res.serverError(error);
    }
  },

  /**
   * Request password reset
   */
  forgotPassword: async function(req, res) {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        // Don't reveal if user exists
        return res.json({
          success: true,
          message: 'If the email exists, a reset link has been sent'
        });
      }

      // Generate reset token
      const resetToken = require('crypto').randomBytes(32).toString('hex');
      const resetExpires = Date.now() + (60 * 60 * 1000); // 1 hour

      await User.updateOne({ id: user.id })
        .set({ 
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires
        });

      // Send reset email
      await sails.helpers.sendEmail.with({
        to: user.email,
        subject: 'Reset your password',
        template: 'password-reset',
        templateData: {
          name: user.name,
          resetUrl: \`\${sails.config.custom.baseUrl}/reset-password?token=\${resetToken}\`
        }
      });

      return res.json({
        success: true,
        message: 'If the email exists, a reset link has been sent'
      });

    } catch (error) {
      return res.serverError(error);
    }
  },

  /**
   * Reset password
   */
  resetPassword: async function(req, res) {
    try {
      const { token, password } = req.body;

      const user = await User.findOne({ 
        passwordResetToken: token,
        passwordResetExpires: { '>': Date.now() }
      });

      if (!user) {
        return res.badRequest({ error: 'Invalid or expired reset token' });
      }

      await User.updateOne({ id: user.id })
        .set({ 
          password,
          passwordResetToken: null,
          passwordResetExpires: null,
          refreshTokens: [] // Invalidate all sessions
        });

      return res.json({
        success: true,
        message: 'Password reset successful'
      });

    } catch (error) {
      return res.serverError(error);
    }
  }

};`,

    // User controller
    'api/controllers/UserController.js': `/**
 * UserController
 *
 * User management endpoints
 */

module.exports = {

  /**
   * Get current user
   */
  me: async function(req, res) {
    try {
      const user = await User.findOne({ id: req.user.id })
        .populate('todos', { limit: 5, sort: 'createdAt DESC' });

      if (!user) {
        return res.notFound({ error: 'User not found' });
      }

      return res.json({
        success: true,
        user
      });

    } catch (error) {
      return res.serverError(error);
    }
  },

  /**
   * Update current user
   */
  updateMe: async function(req, res) {
    try {
      const allowedUpdates = ['name', 'bio', 'avatar'];
      const updates = _.pick(req.body, allowedUpdates);

      const user = await User.updateOne({ id: req.user.id })
        .set(updates);

      return res.json({
        success: true,
        message: 'Profile updated successfully',
        user
      });

    } catch (error) {
      return res.serverError(error);
    }
  },

  /**
   * Upload avatar
   */
  uploadAvatar: async function(req, res) {
    try {
      req.file('avatar').upload({
        dirname: require('path').resolve(sails.config.appPath, 'assets/images/avatars'),
        maxBytes: 5000000, // 5MB
        saveAs: function(file, cb) {
          const filename = \`\${req.user.id}-\${Date.now()}\${path.extname(file.filename)}\`;
          cb(null, filename);
        }
      }, async function(err, uploadedFiles) {
        if (err) return res.serverError(err);

        if (!uploadedFiles || uploadedFiles.length === 0) {
          return res.badRequest({ error: 'No file uploaded' });
        }

        const file = uploadedFiles[0];
        const avatarUrl = \`/images/avatars/\${path.basename(file.fd)}\`;

        // Update user avatar
        const user = await User.updateOne({ id: req.user.id })
          .set({ avatar: avatarUrl });

        return res.json({
          success: true,
          message: 'Avatar uploaded successfully',
          user
        });
      });

    } catch (error) {
      return res.serverError(error);
    }
  },

  /**
   * Change password
   */
  changePassword: async function(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      // Get user with password
      const user = await User.findOne({ id: req.user.id });
      
      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.badRequest({ error: 'Current password is incorrect' });
      }

      // Update password
      await User.updateOne({ id: req.user.id })
        .set({ 
          password: newPassword,
          refreshTokens: [] // Invalidate all sessions
        });

      return res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      return res.serverError(error);
    }
  },

  /**
   * Check if user can access another user's data
   */
  canAccessUser: async function(req, res) {
    const targetUserId = req.params.id || req.body.userId;
    
    // Admins can access any user
    if (req.user.role === 'admin') {
      return res.ok();
    }
    
    // Users can only access their own data
    if (req.user.id === targetUserId) {
      return res.ok();
    }
    
    return res.forbidden({ error: 'Access denied' });
  }

};`,

    // File controller
    'api/controllers/FileController.js': `/**
 * FileController
 *
 * File upload and management
 */

const path = require('path');
const fs = require('fs').promises;

module.exports = {

  /**
   * Upload file
   */
  upload: async function(req, res) {
    try {
      req.file('file').upload({
        dirname: require('path').resolve(sails.config.appPath, '.tmp/uploads'),
        maxBytes: 10000000, // 10MB
        saveAs: function(file, cb) {
          const filename = \`\${require('crypto').randomUUID()}\${path.extname(file.filename)}\`;
          cb(null, filename);
        }
      }, async function(err, uploadedFiles) {
        if (err) {
          if (err.code === 'E_EXCEEDS_UPLOAD_LIMIT') {
            return res.badRequest({ error: 'File too large. Maximum size is 10MB.' });
          }
          return res.serverError(err);
        }

        if (!uploadedFiles || uploadedFiles.length === 0) {
          return res.badRequest({ error: 'No file uploaded' });
        }

        const uploadedFile = uploadedFiles[0];
        
        // Create file record
        const file = await File.create({
          filename: path.basename(uploadedFile.fd),
          originalName: uploadedFile.filename,
          mimeType: uploadedFile.type,
          size: uploadedFile.size,
          path: uploadedFile.fd,
          uploadedBy: req.user.id
        }).fetch();

        return res.status(201).json({
          success: true,
          message: 'File uploaded successfully',
          file
        });
      });

    } catch (error) {
      return res.serverError(error);
    }
  },

  /**
   * Download file
   */
  download: async function(req, res) {
    try {
      const file = await File.findOne({ id: req.params.id });
      
      if (!file) {
        return res.notFound({ error: 'File not found' });
      }

      // Check permissions
      if (file.uploadedBy !== req.user.id && req.user.role !== 'admin') {
        return res.forbidden({ error: 'Access denied' });
      }

      // Set headers
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', \`attachment; filename="\${file.originalName}"\`);

      // Stream file
      const fileStream = require('fs').createReadStream(file.path);
      fileStream.pipe(res);

    } catch (error) {
      return res.serverError(error);
    }
  },

  /**
   * Delete file
   */
  delete: async function(req, res) {
    try {
      const file = await File.findOne({ id: req.params.id });
      
      if (!file) {
        return res.notFound({ error: 'File not found' });
      }

      // Check permissions
      if (file.uploadedBy !== req.user.id && req.user.role !== 'admin') {
        return res.forbidden({ error: 'Access denied' });
      }

      // Delete physical file
      try {
        await fs.unlink(file.path);
      } catch (err) {
        sails.log.error('Error deleting physical file:', err);
      }

      // Delete database record
      await File.destroyOne({ id: file.id });

      return res.json({
        success: true,
        message: 'File deleted successfully'
      });

    } catch (error) {
      return res.serverError(error);
    }
  }

};`,

    // Health controller
    'api/controllers/HealthController.js': `/**
 * HealthController
 *
 * Health check endpoint
 */

module.exports = {

  /**
   * Health check
   */
  check: async function(req, res) {
    try {
      // Check database connection
      let dbStatus = 'healthy';
      try {
        await User.count();
      } catch (err) {
        dbStatus = 'unhealthy';
      }

      // Check Redis connection (if configured)
      let redisStatus = 'not configured';
      if (sails.config.session.adapter === '@sailshq/connect-redis') {
        redisStatus = 'healthy'; // Assume healthy if configured
      }

      const health = {
        status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: sails.config.environment,
        version: require('../../package.json').version,
        services: {
          database: dbStatus,
          redis: redisStatus
        }
      };

      const statusCode = health.status === 'healthy' ? 200 : 503;
      return res.status(statusCode).json(health);

    } catch (error) {
      return res.status(503).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  }

};`,

    // isAuthenticated policy
    'api/policies/isAuthenticated.js': `/**
 * isAuthenticated
 *
 * Policy to check if user is authenticated
 */

const jwt = require('jsonwebtoken');

module.exports = async function(req, res, proceed) {
  
  let token;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Check for token in query params (for WebSocket)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, sails.config.custom.jwtSecret || 'your-jwt-secret');
    
    // Get user
    const user = await User.findOne({ id: decoded.id });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    };

    return proceed();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Token verification failed' });
  }

};`,

    // isAdmin policy
    'api/policies/isAdmin.js': `/**
 * isAdmin
 *
 * Policy to check if user is an admin
 */

module.exports = async function(req, res, proceed) {
  
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  return proceed();

};`,

    // Generate JWT helper
    'api/helpers/generate-jwt.js': `/**
 * generate-jwt.js
 *
 * Helper to generate JWT tokens
 */

const jwt = require('jsonwebtoken');

module.exports = {

  friendlyName: 'Generate JWT',

  description: 'Generate a JWT token for a user.',

  inputs: {
    userId: {
      type: 'string',
      required: true,
      description: 'The ID of the user'
    }
  },

  exits: {
    success: {
      outputType: 'string',
      description: 'The generated JWT token'
    }
  },

  fn: async function(inputs, exits) {
    const payload = {
      id: inputs.userId,
      iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(
      payload,
      sails.config.custom.jwtSecret || 'your-jwt-secret',
      { expiresIn: '24h' }
    );

    return exits.success(token);
  }

};`,

    // Generate refresh token helper
    'api/helpers/generate-refresh-token.js': `/**
 * generate-refresh-token.js
 *
 * Helper to generate refresh tokens
 */

module.exports = {

  friendlyName: 'Generate refresh token',

  description: 'Generate a secure refresh token.',

  inputs: {},

  exits: {
    success: {
      outputType: 'string',
      description: 'The generated refresh token'
    }
  },

  fn: async function(inputs, exits) {
    const crypto = require('crypto');
    const token = crypto.randomBytes(40).toString('hex');
    return exits.success(token);
  }

};`,

    // Send email helper
    'api/helpers/send-email.js': `/**
 * send-email.js
 *
 * Helper to send emails
 */

const nodemailer = require('nodemailer');

module.exports = {

  friendlyName: 'Send email',

  description: 'Send an email using configured email service.',

  inputs: {
    to: {
      type: 'string',
      required: true,
      isEmail: true
    },
    subject: {
      type: 'string',
      required: true
    },
    template: {
      type: 'string',
      required: true
    },
    templateData: {
      type: 'ref',
      defaultsTo: {}
    }
  },

  exits: {
    success: {
      description: 'Email sent successfully.'
    },
    error: {
      description: 'Failed to send email.'
    }
  },

  fn: async function(inputs, exits) {
    try {
      // Create transporter
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      // Load email template
      const ejs = require('ejs');
      const path = require('path');
      const templatePath = path.join(sails.config.appPath, 'views', 'emails', \`\${inputs.template}.ejs\`);
      const html = await ejs.renderFile(templatePath, inputs.templateData);

      // Send email
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"{{projectName}}" <noreply@example.com>',
        to: inputs.to,
        subject: inputs.subject,
        html: html
      });

      sails.log.info('Email sent:', info.messageId);
      return exits.success();

    } catch (error) {
      sails.log.error('Email error:', error);
      return exits.error(error);
    }
  }

};`,

    // Email verification template
    'views/emails/email-verify.ejs': `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify Your Email</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
    .content { background-color: #f8f9fa; padding: 30px; }
    .button { display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to {{projectName}}!</h1>
    </div>
    <div class="content">
      <h2>Hi <%= name %>,</h2>
      <p>Thanks for signing up! Please verify your email address by clicking the button below:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="<%= sails.config.custom.baseUrl %>/api/v1/auth/verify/<%= token %>" class="button">Verify Email</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all;"><%= sails.config.custom.baseUrl %>/api/v1/auth/verify/<%= token %></p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>`,

    // Password reset template
    'views/emails/password-reset.ejs': `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset Your Password</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
    .content { background-color: #f8f9fa; padding: 30px; }
    .button { display: inline-block; padding: 12px 30px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset Request</h1>
    </div>
    <div class="content">
      <h2>Hi <%= name %>,</h2>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="<%= resetUrl %>" class="button">Reset Password</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all;"><%= resetUrl %></p>
      <p><strong>This link will expire in 1 hour.</strong></p>
      <p>If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>`,

    // Test configuration
    'test/lifecycle.test.js': `/**
 * Lifecycle.test.js
 *
 * Test lifecycle hooks
 */

var sails = require('sails');

// Before running any tests...
before(function(done) {
  this.timeout(10000);

  sails.lift({
    models: { migrate: 'drop' },
    log: { level: 'warn' },
    port: 1338,
    hooks: { grunt: false }
  }, function(err) {
    if (err) { return done(err); }
    return done();
  });
});

// After all tests have finished...
after(function(done) {
  sails.lower(done);
});`,

    // Auth controller tests
    'test/integration/AuthController.test.js': `/**
 * AuthController.test.js
 *
 * Test authentication endpoints
 */

const supertest = require('supertest');
const { expect } = require('chai');

describe('AuthController', function() {

  describe('POST /api/v1/auth/register', function() {
    it('should register a new user', function(done) {
      supertest(sails.hooks.http.app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User'
        })
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).to.be.true;
          expect(res.body.user).to.have.property('email', 'test@example.com');
          expect(res.body).to.have.property('accessToken');
          expect(res.body).to.have.property('refreshToken');
          done();
        });
    });

    it('should not register duplicate email', function(done) {
      supertest(sails.hooks.http.app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User'
        })
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.error).to.include('already registered');
          done();
        });
    });
  });

  describe('POST /api/v1/auth/login', function() {
    it('should login with valid credentials', function(done) {
      supertest(sails.hooks.http.app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).to.be.true;
          expect(res.body).to.have.property('accessToken');
          expect(res.body).to.have.property('refreshToken');
          done();
        });
    });

    it('should reject invalid credentials', function(done) {
      supertest(sails.hooks.http.app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(400)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.error).to.include('Invalid credentials');
          done();
        });
    });
  });

});`,

    // Todo model tests
    'test/unit/models/Todo.test.js': `/**
 * Todo.test.js
 *
 * Test Todo model
 */

const { expect } = require('chai');

describe('Todo Model', function() {

  let testUser;

  before(async function() {
    // Create test user
    testUser = await User.create({
      email: 'todotest@example.com',
      password: 'password123',
      name: 'Todo Test User'
    }).fetch();
  });

  after(async function() {
    // Clean up
    await Todo.destroy({ owner: testUser.id });
    await User.destroyOne({ id: testUser.id });
  });

  describe('Creation', function() {
    it('should create a todo with required fields', async function() {
      const todo = await Todo.create({
        title: 'Test Todo',
        owner: testUser.id
      }).fetch();

      expect(todo).to.have.property('id');
      expect(todo.title).to.equal('Test Todo');
      expect(todo.status).to.equal('pending');
      expect(todo.priority).to.equal('medium');
    });

    it('should fail without required fields', async function() {
      try {
        await Todo.create({}).fetch();
        throw new Error('Should have failed');
      } catch (err) {
        expect(err.name).to.equal('UsageError');
      }
    });
  });

  describe('Associations', function() {
    it('should populate owner association', async function() {
      const todo = await Todo.create({
        title: 'Association Test',
        owner: testUser.id
      }).fetch();

      const populatedTodo = await Todo.findOne({ id: todo.id })
        .populate('owner');

      expect(populatedTodo.owner).to.have.property('email', 'todotest@example.com');
    });
  });

});`,

    // Docker configuration
    'Dockerfile': `# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application files
COPY . .

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --production && npm cache clean --force

# Copy application files
COPY --from=builder /app .

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 1337

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:1337/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "app.js"]`,

    // Docker Compose configuration
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    container_name: {{projectName}}-app
    ports:
      - "\${PORT:-1337}:1337"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://\${DB_USER:-sails}:\${DB_PASSWORD:-sails}@postgres:5432/\${DB_NAME:-sailsdb}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=\${JWT_SECRET}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - sails-network
    volumes:
      - ./uploads:/app/.tmp/uploads
      - ./logs:/app/logs

  postgres:
    image: postgres:16-alpine
    container_name: {{projectName}}-postgres
    environment:
      - POSTGRES_USER=\${DB_USER:-sails}
      - POSTGRES_PASSWORD=\${DB_PASSWORD:-sails}
      - POSTGRES_DB=\${DB_NAME:-sailsdb}
    ports:
      - "\${DB_PORT:-5432}:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - sails-network

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
      - sails-network

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
      - sails-network

volumes:
  postgres-data:
  redis-data:

networks:
  sails-network:
    driver: bridge`,

    // Environment variables
    '.env.example': `# Application
NODE_ENV=development
PORT=1337

# Database
DATABASE_URL=postgresql://sails:sails@localhost:5432/sailsdb

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@example.com

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:8080

# WebSocket
SOCKET_ORIGINS=http://localhost:3000,http://localhost:8080

# Base URL
BASE_URL=http://localhost:1337`,

    // README
    'README.md': `# {{projectName}}

A full-featured Sails.js MVC application with auto-generated REST APIs, real-time WebSocket support, and comprehensive authentication.

## Features

- 🚀 **Sails.js MVC Framework** - Convention over configuration
- 🔄 **Auto-generated REST APIs** - Blueprint routes for rapid development
- 🗄️ **Waterline ORM** - Database agnostic with adapter-based architecture
- 🔌 **WebSocket Support** - Real-time updates with Socket.io
- 🔐 **JWT Authentication** - Secure API access with refresh tokens
- 🛡️ **Policy-based Security** - Flexible authorization system
- 📤 **File Uploads** - Built-in file handling with Skipper
- ✉️ **Email Service** - Transactional emails with templates
- 🧪 **Testing Setup** - Unit and integration tests with Mocha/Chai
- 🐳 **Docker Support** - Production-ready containerization
- 🔧 **Machine Packs** - Reusable helper functions
- 🪝 **Hooks System** - Extensible architecture

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL (or any Waterline-supported database)
- Redis (for sessions and WebSocket scaling)

### Installation

1. Clone the repository:
   \`\`\`bash
   git clone <repository-url>
   cd {{projectName}}
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Set up environment variables:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your configuration
   \`\`\`

4. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

   The server will start at http://localhost:1337

### Running with Docker

\`\`\`bash
docker-compose up
\`\`\`

## API Documentation

### Authentication Endpoints

- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login user
- \`POST /api/v1/auth/logout\` - Logout user
- \`POST /api/v1/auth/refresh\` - Refresh access token
- \`GET /api/v1/auth/verify/:token\` - Verify email
- \`POST /api/v1/auth/forgot-password\` - Request password reset
- \`POST /api/v1/auth/reset-password\` - Reset password

### Blueprint Routes (Auto-generated)

For each model, Sails generates RESTful routes:

- \`GET /api/v1/:model\` - Find records
- \`GET /api/v1/:model/:id\` - Find one record
- \`POST /api/v1/:model\` - Create record
- \`PUT /api/v1/:model/:id\` - Update record
- \`DELETE /api/v1/:model/:id\` - Delete record

### WebSocket Support

Connect to WebSocket:
\`\`\`javascript
const socket = io('http://localhost:1337', {
  auth: { token: 'your-jwt-token' }
});

// Subscribe to model changes
socket.get('/api/v1/subscribe/todo');

// Listen for updates
socket.on('todo-created', (data) => {
  console.log('New todo:', data);
});
\`\`\`

## Project Structure

\`\`\`
{{projectName}}/
├── api/
│   ├── controllers/    # Route controllers
│   ├── models/         # Waterline models
│   ├── policies/       # Authorization policies
│   ├── helpers/        # Reusable helper functions
│   └── hooks/          # Custom hooks
├── config/             # Configuration files
│   ├── blueprints.js   # Blueprint API settings
│   ├── models.js       # Model defaults
│   ├── policies.js     # Policy mappings
│   ├── routes.js       # Custom routes
│   ├── security.js     # Security settings
│   └── env/            # Environment configs
├── views/              # Server-side views
├── assets/             # Static assets
├── test/               # Test files
│   ├── unit/           # Unit tests
│   └── integration/    # Integration tests
└── app.js              # Application entry point
\`\`\`

## Testing

\`\`\`bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Watch mode
npm run test:watch
\`\`\`

## Deployment

### Production Configuration

1. Set \`NODE_ENV=production\`
2. Configure production database
3. Set up Redis for sessions
4. Generate strong JWT secret
5. Configure email service

### Using PM2

\`\`\`bash
pm2 start app.js --name {{projectName}}
pm2 save
pm2 startup
\`\`\`

### Using Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 1337:1337 --env-file .env {{projectName}}
\`\`\`

## License

MIT
`
  }
};