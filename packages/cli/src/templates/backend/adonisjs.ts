import { BackendTemplate } from '../types';

export const adonisjsTemplate: BackendTemplate = {
  id: 'adonisjs',
  name: 'adonisjs',
  displayName: 'AdonisJS',
  description: 'Full-featured MVC framework for Node.js with TypeScript first-class support',
  language: 'typescript',
  framework: 'adonisjs',
  version: '6.15.0',
  tags: ['nodejs', 'adonisjs', 'api', 'mvc', 'typescript', 'lucid-orm', 'edge-template', 'websockets'],
  port: 3333,
  dependencies: {},
  features: ['routing', 'database', 'authentication', 'authorization', 'validation', 'websockets', 'queue', 'email', 'rate-limiting', 'testing', 'docker'],
  
  files: {
    // Package configuration
    'package.json': `{
  "name": "{{projectName}}",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "license": "MIT",
  "scripts": {
    "build": "node ace build",
    "start": "node bin/server.js",
    "dev": "node ace serve --hmr",
    "test": "node ace test",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "migrate": "node ace migration:run",
    "migrate:rollback": "node ace migration:rollback",
    "migrate:fresh": "node ace migration:fresh",
    "seed": "node ace db:seed",
    "queue:listen": "node ace queue:listen",
    "scheduler:run": "node ace scheduler:run"
  },
  "imports": {
    "#controllers/*": "./app/controllers/*.js",
    "#models/*": "./app/models/*.js",
    "#services/*": "./app/services/*.js",
    "#listeners/*": "./app/listeners/*.js",
    "#events/*": "./app/events/*.js",
    "#validators/*": "./app/validators/*.js",
    "#middleware/*": "./app/middleware/*.js",
    "#mailers/*": "./app/mailers/*.js",
    "#exceptions/*": "./app/exceptions/*.js",
    "#policies/*": "./app/policies/*.js",
    "#abilities/*": "./app/abilities/*.js",
    "#start/*": "./start/*.js",
    "#config/*": "./config/*.js",
    "#database/*": "./database/*.js",
    "#providers/*": "./providers/*.js",
    "#types/*": "./types/*.js"
  },
  "dependencies": {
    "@adonisjs/auth": "^9.2.4",
    "@adonisjs/bouncer": "^3.1.3",
    "@adonisjs/core": "^6.15.0",
    "@adonisjs/cors": "^2.2.1",
    "@adonisjs/drive": "^3.0.0",
    "@adonisjs/health": "^2.0.1",
    "@adonisjs/limiter": "^2.3.2",
    "@adonisjs/lucid": "^21.4.1",
    "@adonisjs/mail": "^9.2.2",
    "@adonisjs/redis": "^9.1.0",
    "@adonisjs/session": "^7.5.0",
    "@adonisjs/shield": "^8.1.1",
    "@adonisjs/static": "^1.1.2",
    "@adonisjs/transmit": "^1.0.2",
    "@adonisjs/transmit-client": "^1.0.1",
    "@adonisjs/vite": "^3.0.0",
    "@vinejs/vine": "^2.1.0",
    "bullmq": "^5.31.1",
    "edge.js": "^6.2.0",
    "luxon": "^3.5.0",
    "pg": "^8.13.1",
    "reflect-metadata": "^0.2.2",
    "@aws-sdk/client-s3": "^3.700.0",
    "socket.io": "^4.8.1",
    "socket.io-client": "^4.8.1"
  },
  "devDependencies": {
    "@adonisjs/assembler": "^7.10.0",
    "@adonisjs/eslint-config": "^2.0.0-beta.8",
    "@adonisjs/prettier-config": "^1.4.0",
    "@adonisjs/tsconfig": "^1.4.0",
    "@japa/api-client": "^2.0.3",
    "@japa/assert": "^3.0.0",
    "@japa/plugin-adonisjs": "^3.1.0",
    "@japa/runner": "^3.2.0",
    "@swc/core": "^1.9.3",
    "@types/luxon": "^3.4.2",
    "@types/node": "^22.10.2",
    "eslint": "^8.57.1",
    "hot-hook": "^0.4.0",
    "pino-pretty": "^11.3.0",
    "prettier": "^3.4.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vite": "^6.0.3"
  },
  "eslintConfig": {
    "extends": "@adonisjs/eslint-config/app"
  },
  "prettier": "@adonisjs/prettier-config"
}`,

    // TypeScript configuration
    'tsconfig.json': `{
  "extends": "@adonisjs/tsconfig/tsconfig.app.json",
  "compilerOptions": {
    "paths": {
      "#controllers/*": ["./app/controllers/*.js"],
      "#models/*": ["./app/models/*.js"],
      "#services/*": ["./app/services/*.js"],
      "#listeners/*": ["./app/listeners/*.js"],
      "#events/*": ["./app/events/*.js"],
      "#validators/*": ["./app/validators/*.js"],
      "#middleware/*": ["./app/middleware/*.js"],
      "#mailers/*": ["./app/mailers/*.js"],
      "#exceptions/*": ["./app/exceptions/*.js"],
      "#policies/*": ["./app/policies/*.js"],
      "#abilities/*": ["./app/abilities/*.js"],
      "#start/*": ["./start/*.js"],
      "#config/*": ["./config/*.js"],
      "#database/*": ["./database/*.js"],
      "#providers/*": ["./providers/*.js"],
      "#types/*": ["./types/*.js"]
    }
  }
}`,

    // AdonisJS configuration
    'adonisrc.ts': `import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  commands: [
    () => import('@adonisjs/core/commands'),
    () => import('@adonisjs/lucid/commands'),
    () => import('@adonisjs/mail/commands'),
    () => import('@adonisjs/bouncer/commands')],
  
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    () => import('@adonisjs/core/providers/edge_provider'),
    () => import('@adonisjs/core/providers/vinejs_provider'),
    () => import('@adonisjs/core/providers/repl_provider'),
    () => import('@adonisjs/cors/cors_provider'),
    () => import('@adonisjs/lucid/database_provider'),
    () => import('@adonisjs/auth/auth_provider'),
    () => import('@adonisjs/session/session_provider'),
    () => import('@adonisjs/shield/shield_provider'),
    () => import('@adonisjs/static/static_provider'),
    () => import('@adonisjs/mail/mail_provider'),
    () => import('@adonisjs/drive/drive_provider'),
    () => import('@adonisjs/redis/redis_provider'),
    () => import('@adonisjs/bouncer/bouncer_provider'),
    () => import('@adonisjs/limiter/limiter_provider'),
    () => import('@adonisjs/health/health_provider'),
    () => import('@adonisjs/transmit/transmit_provider'),
    () => import('@adonisjs/vite/vite_provider'),
    () => import('#providers/queue_provider'),
    () => import('#providers/socket_provider')],
  
  preloads: [
    () => import('#start/routes'),
    () => import('#start/kernel'),
    () => import('#start/events'),
    () => import('#start/bouncer'),
    () => import('#start/limiter'),
    () => import('#start/validator'),
    () => import('#start/socket')],
  
  metaFiles: [
    {
      pattern: 'resources/views/**/*.edge',
      reloadServer: false},
    {
      pattern: 'public/**',
      reloadServer: false}],
  
  assetsBundler: false,
  
  hooks: {
    onBuildCompleted: [],
    onBuildStarting: [],
    onDevServerStarted: [],
    onSourceFileChanged: []}})`,

    // Environment variables
    '.env.example': `TZ=UTC
PORT=3333
HOST=localhost
LOG_LEVEL=info
APP_KEY=your-app-key-generate-with-node-ace-generate-key

# Database
DB_CONNECTION=pg
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=postgres
PG_DB_NAME={{projectName}}

# Redis
REDIS_CONNECTION=main
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# Session
SESSION_DRIVER=redis

# Mail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@example.com
SMTP_FROM_NAME={{projectName}}

# Drive
DRIVE_DISK=local

# S3 Configuration (optional)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_ENDPOINT=

# Auth
ACCESS_TOKEN_MAX_AGE=30m
REFRESH_TOKEN_MAX_AGE=30days`,

    // Server entry point
    'bin/server.ts': `#!/usr/bin/env node

/*
|--------------------------------------------------------------------------
| HTTP Server
|--------------------------------------------------------------------------
|
| The "server.ts" file is the entry point for starting the AdonisJS HTTP
| server. Either you can run this file directly or use the "serve"
| command to run this file and monitor file changes.
|
*/

import 'reflect-metadata'
import { Ignitor, prettyPrintError } from '@adonisjs/core'

/**
 * URL to the application root. AdonisJS need it to resolve
 * paths to file and directories for scaffolding commands
 */
const APP_ROOT = new URL('../', import.meta.url)

/**
 * The importer is used to import files in context of the
 * application.
 */
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

new Ignitor(APP_ROOT, { importer: IMPORTER })
  .tap((app) => {
    app.booting(async () => {
      await import('#start/env')
    })
    app.ready(async () => {
      await import('#start/scheduler')
    })
    app.terminating(async () => {
      const queue = await app.container.make('queue')
      await queue.close()
    })
  })
  .httpServer()
  .start()
  .catch((error) => {
    process.exitCode = 1
    prettyPrintError(error)
  })`,

    // Routes configuration
    'start/routes.ts': `/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

// Health check
router.get('/health', '#controllers/health_controller.check')

// API Routes
router.group(() => {
  // Authentication routes
  router.group(() => {
    router.post('/register', '#controllers/auth_controller.register')
    router.post('/login', '#controllers/auth_controller.login')
    router.post('/logout', '#controllers/auth_controller.logout').use(middleware.auth())
    router.post('/refresh', '#controllers/auth_controller.refresh')
    router.post('/forgot-password', '#controllers/auth_controller.forgotPassword')
    router.post('/reset-password/:token', '#controllers/auth_controller.resetPassword')
    router.get('/verify-email/:token', '#controllers/auth_controller.verifyEmail')
  }).prefix('/auth')

  // User routes
  router.group(() => {
    router.get('/me', '#controllers/users_controller.me')
    router.put('/me', '#controllers/users_controller.updateProfile')
    router.post('/me/avatar', '#controllers/users_controller.uploadAvatar')
    router.put('/me/password', '#controllers/users_controller.changePassword')
  })
    .prefix('/users')
    .use(middleware.auth())

  // Todo routes
  router.group(() => {
    router.get('/', '#controllers/todos_controller.index')
    router.post('/', '#controllers/todos_controller.store')
    router.get('/:id', '#controllers/todos_controller.show')
    router.put('/:id', '#controllers/todos_controller.update')
    router.delete('/:id', '#controllers/todos_controller.destroy')
    router.post('/:id/archive', '#controllers/todos_controller.archive')
    router.post('/:id/unarchive', '#controllers/todos_controller.unarchive')
  })
    .prefix('/todos')
    .use(middleware.auth())

  // Admin routes
  router.group(() => {
    router.get('/users', '#controllers/admin/users_controller.index')
    router.get('/users/:id', '#controllers/admin/users_controller.show')
    router.put('/users/:id', '#controllers/admin/users_controller.update')
    router.delete('/users/:id', '#controllers/admin/users_controller.destroy')
    router.get('/stats', '#controllers/admin/stats_controller.index')
  })
    .prefix('/admin')
    .use([middleware.auth(), middleware.can('admin')])
})
  .prefix('/api/v1')
  .use(middleware.throttle())

// WebSocket routes are handled in start/socket.ts

// Web routes
router.get('/', async ({ view }) => {
  return view.render('pages/home')
})`,

    // Kernel configuration
    'start/kernel.ts': `/*
|--------------------------------------------------------------------------
| HTTP kernel file
|--------------------------------------------------------------------------
|
| The HTTP kernel file is used to define the middleware stack executed
| by the HTTP server for each request.
|
*/

import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

/**
 * The error handler is used to convert an exception
 * to a HTTP response.
 */
server.errorHandler(() => import('#exceptions/handler'))

/**
 * The server middleware stack is executed for all HTTP requests
 */
server.use([
  () => import('@adonisjs/cors/cors_middleware'),
  () => import('@adonisjs/shield/shield_middleware'),
  () => import('@adonisjs/static/static_middleware'),
  () => import('#middleware/container_bindings_middleware'),
  () => import('#middleware/force_json_response_middleware')])

/**
 * The router middleware stack runs on specific routes or
 * group of routes based upon request
 */
router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/session/session_middleware'),
  () => import('@adonisjs/auth/initialize_auth_middleware')])

/**
 * Named middleware collection must be explicitly assigned to
 * the routes or the routes group.
 */
export const middleware = router.named({
  auth: () => import('#middleware/auth_middleware'),
  guest: () => import('#middleware/guest_middleware'),
  throttle: () => import('#middleware/throttle_middleware'),
  can: () => import('#middleware/can_middleware')})`,

    // Auth controller
    'app/controllers/auth_controller.ts': `import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { registerValidator, loginValidator, forgotPasswordValidator, resetPasswordValidator } from '#validators/auth'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import { randomBytes } from 'node:crypto'
import hash from '@adonisjs/core/services/hash'

export default class AuthController {
  async register({ request, response, auth }: HttpContext) {
    const data = await request.validateUsing(registerValidator)
    
    // Create verification token
    const verificationToken = randomBytes(32).toString('hex')
    
    // Create user
    const user = await User.create({
      ...data,
      verificationToken,
      isEmailVerified: false})

    // Send verification email
    await mail.send((message) => {
      message
        .to(user.email)
        .from('noreply@example.com')
        .subject('Verify your email')
        .htmlView('emails/verify', { user, token: verificationToken })
    })

    // Generate tokens
    const token = await auth.use('api').generate(user)

    return response.created({
      user: user.serialize(),
      token: token.toJSON()})
  }

  async login({ request, response, auth }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)
    
    try {
      const user = await User.verifyCredentials(email, password)
      
      if (!user.isActive) {
        return response.forbidden({ message: 'Account is inactive' })
      }

      const token = await auth.use('api').generate(user)

      return response.ok({
        user: user.serialize(),
        token: token.toJSON()})
    } catch {
      return response.unauthorized({ message: 'Invalid credentials' })
    }
  }

  async logout({ auth, response }: HttpContext) {
    await auth.use('api').revoke()
    return response.ok({ message: 'Logged out successfully' })
  }

  async refresh({ auth, response }: HttpContext) {
    await auth.use('api').check()
    const user = auth.user!
    const token = await auth.use('api').generate(user)

    return response.ok({
      user: user.serialize(),
      token: token.toJSON()})
  }

  async forgotPassword({ request, response }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator)
    
    const user = await User.findBy('email', email)
    if (!user) {
      // Return success to prevent email enumeration
      return response.ok({ message: 'If the email exists, a reset link has been sent' })
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString('hex')
    user.resetToken = resetToken
    user.resetTokenExpiry = DateTime.now().plus({ hours: 1 })
    await user.save()

    // Send reset email
    await mail.send((message) => {
      message
        .to(user.email)
        .from('noreply@example.com')
        .subject('Reset your password')
        .htmlView('emails/reset-password', { user, token: resetToken })
    })

    return response.ok({ message: 'If the email exists, a reset link has been sent' })
  }

  async resetPassword({ request, response, params }: HttpContext) {
    const { password } = await request.validateUsing(resetPasswordValidator)
    const { token } = params

    const user = await User.findBy('resetToken', token)
    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < DateTime.now()) {
      return response.badRequest({ message: 'Invalid or expired reset token' })
    }

    user.password = password
    user.resetToken = null
    user.resetTokenExpiry = null
    await user.save()

    return response.ok({ message: 'Password reset successfully' })
  }

  async verifyEmail({ response, params }: HttpContext) {
    const { token } = params

    const user = await User.findBy('verificationToken', token)
    if (!user) {
      return response.badRequest({ message: 'Invalid verification token' })
    }

    user.isEmailVerified = true
    user.verificationToken = null
    await user.save()

    return response.ok({ message: 'Email verified successfully' })
  }
}`,

    // User model
    'app/models/user.ts': `import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, hasMany, beforeSave } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Todo from '#models/todo'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password'})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare avatar: string | null

  @column()
  declare phone: string | null

  @column()
  declare role: 'user' | 'admin'

  @column()
  declare isActive: boolean

  @column()
  declare isEmailVerified: boolean

  @column({ serializeAs: null })
  declare verificationToken: string | null

  @column({ serializeAs: null })
  declare resetToken: string | null

  @column.dateTime({ serializeAs: null })
  declare resetTokenExpiry: DateTime | null

  @column()
  declare metadata: Record<string, any> | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => Todo)
  declare todos: HasMany<typeof Todo>

  @beforeSave()
  static async hashPassword(user: User) {
    if (user.$dirty.password) {
      user.password = await hash.make(user.password)
    }
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      avatar: this.avatar,
      phone: this.phone,
      role: this.role,
      isActive: this.isActive,
      isEmailVerified: this.isEmailVerified,
      metadata: this.metadata,
      createdAt: this.createdAt.toISO(),
      updatedAt: this.updatedAt.toISO()}
  }
}`,

    // Todo model
    'app/models/todo.ts': `import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class Todo extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column()
  declare status: 'pending' | 'in_progress' | 'completed'

  @column()
  declare priority: 'low' | 'medium' | 'high'

  @column.dateTime()
  declare dueDate: DateTime | null

  @column()
  declare tags: string[] | null

  @column()
  declare isArchived: boolean

  @column()
  declare userId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}`,

    // Database migration - Users
    'database/migrations/1734567890123_create_users_table.ts': `import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.string('email').notNullable().unique()
      table.string('password').notNullable()
      table.string('avatar').nullable()
      table.string('phone').nullable()
      table.enum('role', ['user', 'admin']).defaultTo('user').notNullable()
      table.boolean('is_active').defaultTo(true).notNullable()
      table.boolean('is_email_verified').defaultTo(false).notNullable()
      table.string('verification_token').nullable()
      table.string('reset_token').nullable()
      table.timestamp('reset_token_expiry').nullable()
      table.json('metadata').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}`,

    // Database migration - Todos
    'database/migrations/1734567890124_create_todos_table.ts': `import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'todos'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('title').notNullable()
      table.text('description').nullable()
      table.enum('status', ['pending', 'in_progress', 'completed']).defaultTo('pending').notNullable()
      table.enum('priority', ['low', 'medium', 'high']).defaultTo('medium').notNullable()
      table.timestamp('due_date').nullable()
      table.json('tags').nullable()
      table.boolean('is_archived').defaultTo(false).notNullable()
      table.integer('user_id').unsigned().references('users.id').onDelete('CASCADE')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['user_id', 'status'])
      table.index(['user_id', 'is_archived'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}`,

    // Auth validator
    'app/validators/auth.ts': `import vine from '@vinejs/vine'

export const registerValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(100),
    email: vine.string().trim().email().normalizeEmail(),
    password: vine.string().minLength(8).maxLength(100)})
)

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().normalizeEmail(),
    password: vine.string()})
)

export const forgotPasswordValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().normalizeEmail()})
)

export const resetPasswordValidator = vine.compile(
  vine.object({
    password: vine.string().minLength(8).maxLength(100)})
)

export const changePasswordValidator = vine.compile(
  vine.object({
    currentPassword: vine.string(),
    newPassword: vine.string().minLength(8).maxLength(100)})
)`,

    // Todo controller
    'app/controllers/todos_controller.ts': `import type { HttpContext } from '@adonisjs/core/http'
import Todo from '#models/todo'
import { createTodoValidator, updateTodoValidator } from '#validators/todo'

export default class TodosController {
  async index({ request, response, auth, bouncer }: HttpContext) {
    const user = auth.user!
    const page = request.input('page', 1)
    const limit = request.input('limit', 10)
    const status = request.input('status')
    const isArchived = request.input('is_archived', false)

    const query = Todo.query()
      .where('user_id', user.id)
      .where('is_archived', isArchived)

    if (status) {
      query.where('status', status)
    }

    const todos = await query
      .orderBy('created_at', 'desc')
      .paginate(page, limit)

    return response.ok(todos)
  }

  async store({ request, response, auth }: HttpContext) {
    const user = auth.user!
    const data = await request.validateUsing(createTodoValidator)

    const todo = await Todo.create({
      ...data,
      userId: user.id})

    return response.created(todo)
  }

  async show({ params, response, bouncer }: HttpContext) {
    const todo = await Todo.findOrFail(params.id)
    await bouncer.with('TodoPolicy').authorize('view', todo)

    return response.ok(todo)
  }

  async update({ request, params, response, bouncer }: HttpContext) {
    const todo = await Todo.findOrFail(params.id)
    await bouncer.with('TodoPolicy').authorize('update', todo)

    const data = await request.validateUsing(updateTodoValidator)
    todo.merge(data)
    await todo.save()

    return response.ok(todo)
  }

  async destroy({ params, response, bouncer }: HttpContext) {
    const todo = await Todo.findOrFail(params.id)
    await bouncer.with('TodoPolicy').authorize('delete', todo)

    await todo.delete()
    return response.noContent()
  }

  async archive({ params, response, bouncer }: HttpContext) {
    const todo = await Todo.findOrFail(params.id)
    await bouncer.with('TodoPolicy').authorize('update', todo)

    todo.isArchived = true
    await todo.save()

    return response.ok(todo)
  }

  async unarchive({ params, response, bouncer }: HttpContext) {
    const todo = await Todo.findOrFail(params.id)
    await bouncer.with('TodoPolicy').authorize('update', todo)

    todo.isArchived = false
    await todo.save()

    return response.ok(todo)
  }
}`,

    // Todo policy
    'app/policies/todo_policy.ts': `import User from '#models/user'
import Todo from '#models/todo'
import { BasePolicy } from '@adonisjs/bouncer'
import { AuthorizerResponse } from '@adonisjs/bouncer/types'

export default class TodoPolicy extends BasePolicy {
  view(user: User, todo: Todo): AuthorizerResponse {
    return user.id === todo.userId
  }

  update(user: User, todo: Todo): AuthorizerResponse {
    return user.id === todo.userId
  }

  delete(user: User, todo: Todo): AuthorizerResponse {
    return user.id === todo.userId
  }
}`,

    // Events configuration
    'start/events.ts': `/*
|--------------------------------------------------------------------------
| Events
|--------------------------------------------------------------------------
|
| This file is used to register events and their listeners
|
*/

import emitter from '@adonisjs/core/services/emitter'
import mail from '@adonisjs/mail/services/main'

// User events
emitter.on('user:registered', async (user) => {
  // Send welcome email
  await mail.send((message) => {
    message
      .to(user.email)
      .from('noreply@example.com')
      .subject('Welcome to {{projectName}}!')
      .htmlView('emails/welcome', { user })
  })
})

emitter.on('user:password-changed', async (user) => {
  // Send password change notification
  await mail.send((message) => {
    message
      .to(user.email)
      .from('noreply@example.com')
      .subject('Password Changed')
      .htmlView('emails/password-changed', { user })
  })
})

// Todo events
emitter.on('todo:created', async (todo) => {
  // Log or process new todo
  console.log('New todo created:', todo.id)
})

emitter.on('todo:completed', async (todo) => {
  // Send notification or update stats
  console.log('Todo completed:', todo.id)
})`,

    // Queue provider
    'providers/queue_provider.ts': `import { ApplicationService } from '@adonisjs/core/types'
import { Queue, Worker } from 'bullmq'
import redis from '@adonisjs/redis/services/main'

export default class QueueProvider {
  constructor(protected app: ApplicationService) {}

  async ready() {
    const connection = redis.connection('main').ioConnection

    // Create queues
    const emailQueue = new Queue('emails', { connection })
    const notificationQueue = new Queue('notifications', { connection })
    const reportQueue = new Queue('reports', { connection })

    // Create workers
    const emailWorker = new Worker('emails', async (job) => {
      const { to, subject, template, data } = job.data
      const mail = await this.app.container.make('mail')
      
      await mail.send((message) => {
        message
          .to(to)
          .from('noreply@example.com')
          .subject(subject)
          .htmlView(template, data)
      })
    }, { connection })

    const notificationWorker = new Worker('notifications', async (job) => {
      // Process notifications
      console.log('Processing notification:', job.data)
    }, { connection })

    const reportWorker = new Worker('reports', async (job) => {
      // Generate reports
      console.log('Generating report:', job.data)
    }, { connection })

    // Register with container
    this.app.container.singleton('queue', () => ({
      email: emailQueue,
      notification: notificationQueue,
      report: reportQueue,
      close: async () => {
        await emailWorker.close()
        await notificationWorker.close()
        await reportWorker.close()
      }
    }))
  }
}`,

    // Socket provider
    'providers/socket_provider.ts': `import { ApplicationService } from '@adonisjs/core/types'
import { Server } from 'socket.io'
import server from '@adonisjs/core/services/server'

export default class SocketProvider {
  constructor(protected app: ApplicationService) {}

  async ready() {
    const io = new Server(server.getNodeServer(), {
      cors: {
        origin: '*',
        credentials: true}})

    // Authentication middleware
    io.use(async (socket, next) => {
      const token = socket.handshake.auth.token
      if (!token) {
        return next(new Error('Authentication required'))
      }

      try {
        // Verify token
        const auth = await this.app.container.make('auth')
        const user = await auth.use('api').authenticate()
        socket.data.user = user
        next()
      } catch {
        next(new Error('Invalid token'))
      }
    })

    // Register with container
    this.app.container.singleton('io', () => io)
  }
}`,

    // Socket configuration
    'start/socket.ts': `/*
|--------------------------------------------------------------------------
| WebSocket Routes
|--------------------------------------------------------------------------
|
| This file is used to register WebSocket events and handlers
|
*/

import { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'

app.ready(async () => {
  const io = await app.container.make('io')

  io.on('connection', (socket) => {
    const user = socket.data.user
    console.log(\`User \${user.id} connected\`)

    // Join user room
    socket.join(\`user:\${user.id}\`)

    // Handle events
    socket.on('todo:create', async (data) => {
      // Create todo and emit to user
      io.to(\`user:\${user.id}\`).emit('todo:created', data)
    })

    socket.on('todo:update', async (data) => {
      // Update todo and emit to user
      io.to(\`user:\${user.id}\`).emit('todo:updated', data)
    })

    socket.on('disconnect', () => {
      console.log(\`User \${user.id} disconnected\`)
    })
  })
})`,

    // Scheduler configuration
    'start/scheduler.ts': `/*
|--------------------------------------------------------------------------
| Task Scheduler
|--------------------------------------------------------------------------
|
| This file is used to register scheduled tasks
|
*/

import scheduler from '@adonisjs/core/services/scheduler'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'

// Clean up expired tokens every hour
scheduler.run(async () => {
  await db.from('users')
    .whereNotNull('reset_token_expiry')
    .where('reset_token_expiry', '<', new Date())
    .update({
      reset_token: null,
      reset_token_expiry: null})
  
  logger.info('Cleaned up expired reset tokens')
}).everyHour()

// Generate daily reports
scheduler.run(async () => {
  const queue = await app.container.make('queue')
  await queue.report.add('daily-report', {
    type: 'daily',
    date: new Date()})
  
  logger.info('Scheduled daily report generation')
}).dailyAt('00:00')

// Clean up old archived todos every week
scheduler.run(async () => {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  await db.from('todos')
    .where('is_archived', true)
    .where('updated_at', '<', thirtyDaysAgo)
    .delete()
  
  logger.info('Cleaned up old archived todos')
}).weekly()`,

    // Config files
    'config/app.ts': `import proxyAddr from 'proxy-addr'
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  appKey: process.env.APP_KEY || '',
  http: {
    generateRequestId: true,
    trustProxy: proxyAddr.compile('loopback')}})`,

    'config/auth.ts': `import { defineConfig } from '@adonisjs/auth'
import { tokensGuard, tokensUserProvider } from '@adonisjs/auth/access_tokens'
import type { InferAuthEvents, Authenticators } from '@adonisjs/auth/types'

const authConfig = defineConfig({
  default: 'api',
  guards: {
    api: tokensGuard({
      provider: tokensUserProvider({
        tokens: 'accessTokens',
        model: () => import('#models/user')})})}})

export default authConfig

declare module '@adonisjs/auth/types' {
  interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
declare module '@adonisjs/core/types' {
  interface EventsList extends InferAuthEvents<Authenticators> {}
}`,

    'config/database.ts': `import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  connection: process.env.DB_CONNECTION || 'pg',
  connections: {
    pg: {
      client: 'pg',
      connection: {
        host: process.env.PG_HOST,
        port: Number(process.env.PG_PORT),
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DB_NAME},
      migrations: {
        naturalSort: true,
        paths: ['database/migrations']},
      healthCheck: true,
      debug: false}}})

export default dbConfig`,

    'config/mail.ts': `import { defineConfig, transports } from '@adonisjs/mail'

const mailConfig = defineConfig({
  default: 'smtp',
  from: {
    address: process.env.SMTP_FROM_EMAIL || 'noreply@example.com',
    name: process.env.SMTP_FROM_NAME || '{{projectName}}'},
  
  mailers: {
    smtp: transports.smtp({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD}})}})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}`,

    'config/drive.ts': `import { defineConfig, services } from '@adonisjs/drive'

const driveConfig = defineConfig({
  default: process.env.DRIVE_DISK || 'local',
  services: {
    local: services.fs({
      location: new URL('../uploads', import.meta.url),
      serveFiles: true,
      routeBasePath: '/uploads'}),
    
    s3: services.s3({
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!},
      region: process.env.AWS_DEFAULT_REGION!,
      bucket: process.env.AWS_BUCKET!,
      endpoint: process.env.AWS_ENDPOINT})}})

export default driveConfig

declare module '@adonisjs/drive/types' {
  export interface DriveDisks extends InferDisks<typeof driveConfig> {}
}`,

    'config/limiter.ts': `import { defineConfig, stores } from '@adonisjs/limiter'

const limiterConfig = defineConfig({
  default: 'redis',
  
  stores: {
    redis: stores.redis({}),
    memory: stores.memory({})}})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}`,

    // Health controller
    'app/controllers/health_controller.ts': `import type { HttpContext } from '@adonisjs/core/http'
import { HealthCheck } from '@adonisjs/health'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'

export default class HealthController {
  async check({ response }: HttpContext) {
    const healthCheck = new HealthCheck()

    // Database check
    healthCheck.addChecker('database', async () => {
      await db.rawQuery('SELECT 1')
      return {
        displayName: 'Database',
        health: {
          healthy: true}}
    })

    // Redis check
    healthCheck.addChecker('redis', async () => {
      await redis.ping()
      return {
        displayName: 'Redis',
        health: {
          healthy: true}}
    })

    // Memory check
    healthCheck.addChecker('memory', async () => {
      const used = process.memoryUsage()
      const limit = 500 * 1024 * 1024 // 500MB
      const healthy = used.heapUsed < limit

      return {
        displayName: 'Memory',
        health: {
          healthy,
          message: healthy ? 'Memory usage is normal' : 'High memory usage'},
        meta: {
          heap_used: \`\${Math.round(used.heapUsed / 1024 / 1024)}MB\`,
          heap_total: \`\${Math.round(used.heapTotal / 1024 / 1024)}MB\`}}
    })

    const report = await healthCheck.getReport()
    const status = report.isHealthy() ? 200 : 503

    return response.status(status).json(report)
  }
}`,

    // Exception handler
    'app/exceptions/handler.ts': `import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { errors as vineErrors } from '@vinejs/vine'

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction

  async handle(error: unknown, ctx: HttpContext) {
    // Handle validation errors
    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      return ctx.response.status(422).json({
        errors: error.messages})
    }

    return super.handle(error, ctx)
  }

  async report(error: unknown, ctx: HttpContext) {
    // Report to external service
    if (app.inProduction) {
      // Send to Sentry, LogRocket, etc.
    }

    return super.report(error, ctx)
  }
}`,

    // Test configuration
    'tests/bootstrap.ts': `import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import type { Config } from '@japa/runner/types'
import testUtils from '@adonisjs/core/services/test_utils'

export const plugins: Config['microservices'] = [
  assert(),
  apiClient(),
  pluginAdonisJS(testUtils)]

export const runnerHooks: Config['runnerHooks'] = {
  setup: [
    () => testUtils.db().migrate(),
    () => testUtils.db().seed()],
  teardown: []}

export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    return suite.setup(() => testUtils.httpServer().start())
  }
}`,

    // Docker configuration
    'Dockerfile': `# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application
COPY --from=builder /app/build ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/resources ./resources

# Create directories
RUN mkdir -p uploads tmp && chown -R nodejs:nodejs uploads tmp

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node ace health:check || exit 1

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "bin/server.js"]`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    container_name: {{projectName}}-app
    ports:
      - "\${PORT:-3333}:3333"
    environment:
      - NODE_ENV=production
      - APP_KEY=\${APP_KEY}
      - DB_CONNECTION=pg
      - PG_HOST=postgres
      - PG_PORT=5432
      - PG_USER=\${PG_USER:-postgres}
      - PG_PASSWORD=\${PG_PASSWORD:-postgres}
      - PG_DB_NAME=\${PG_DB_NAME:-{{projectName}}}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - SESSION_DRIVER=redis
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./uploads:/app/uploads
      - ./tmp:/app/tmp
    restart: unless-stopped
    networks:
      - app-network

  postgres:
    image: postgres:16-alpine
    container_name: {{projectName}}-db
    environment:
      - POSTGRES_USER=\${PG_USER:-postgres}
      - POSTGRES_PASSWORD=\${PG_PASSWORD:-postgres}
      - POSTGRES_DB=\${PG_DB_NAME:-{{projectName}}}
    ports:
      - "\${PG_PORT:-5432}:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${PG_USER:-postgres}"]
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

    // Edge template example
    'resources/views/layouts/main.edge': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title || '{{projectName}}' }}</title>
  @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body>
  <header>
    <nav>
      <a href="/">{{projectName}}</a>
    </nav>
  </header>

  <main>
    @!section('content')
  </main>

  <footer>
    <p>&copy; {{ new Date().getFullYear() }} {{projectName}}. All rights reserved.</p>
  </footer>
</body>
</html>`,

    'resources/views/pages/home.edge': `@layout('layouts/main')

@section('content')
  <div class="container">
    <h1>Welcome to {{projectName}}</h1>
    <p>Your AdonisJS application is ready!</p>
    
    <div class="links">
      <a href="/api/v1/health">Health Check</a>
      <a href="https://docs.adonisjs.com" target="_blank">Documentation</a>
    </div>
  </div>
@end`,

    // README
    'README.md': `# {{projectName}}

Full-featured MVC application built with AdonisJS 6.

## Features

- 🏗️ **MVC Architecture** with clear separation of concerns
- 🔒 **Authentication System** with JWT tokens and session support
- 📊 **Lucid ORM** with migrations and models
- 🎨 **Edge Template Engine** for server-side rendering
- 🛡️ **Authorization** with Bouncer policies
- ✅ **Validation** with VineJS
- 📬 **Event System** with listeners
- 🔄 **Queue System** with Bull
- 📧 **Mail System** with multiple drivers
- 💾 **File Storage** with S3/local support
- 🔌 **WebSocket Support** with Socket.IO
- 🚦 **Rate Limiting** and throttling
- 🧪 **Testing** with Japa
- 🐳 **Docker** configuration
- 🏥 **Health Checks** and monitoring

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- Redis

### Installation

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Copy environment file:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

4. Generate app key:
   \`\`\`bash
   node ace generate:key
   \`\`\`

5. Run migrations:
   \`\`\`bash
   node ace migration:run
   \`\`\`

6. Start development server:
   \`\`\`bash
   npm run dev
   \`\`\`

### Running with Docker

\`\`\`bash
docker-compose up
\`\`\`

## API Documentation

- Health Check: http://localhost:3333/health
- API Base URL: http://localhost:3333/api/v1

## Testing

\`\`\`bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- tests/functional/auth.spec.ts
\`\`\`

## Project Structure

\`\`\`
app/
├── controllers/     # HTTP controllers
├── models/         # Lucid models
├── services/       # Business logic
├── validators/     # Request validators
├── middleware/     # HTTP middleware
├── listeners/      # Event listeners
├── mailers/       # Email templates
├── policies/      # Authorization policies
└── exceptions/    # Custom exceptions

config/            # Configuration files
database/          # Migrations and seeds
resources/         # Views and assets
start/            # Application bootstrapping
tests/            # Test files
\`\`\`

## Commands

- \`node ace serve --hmr\` - Start dev server with HMR
- \`node ace build\` - Build for production
- \`node ace migration:run\` - Run migrations
- \`node ace db:seed\` - Seed database
- \`node ace queue:listen\` - Start queue worker
- \`node ace scheduler:run\` - Run scheduled tasks
- \`node ace list\` - List all commands

## License

MIT
`
  }
};