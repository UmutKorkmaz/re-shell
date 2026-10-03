import { BackendTemplate } from '../types';

export const adonisjsTemplate: BackendTemplate = {
  id: 'adonisjs',
  name: 'adonisjs',
  displayName: 'AdonisJS',
  description: 'Full-featured MVC framework for Node.js with TypeScript first-class support',
  language: 'typescript',
  framework: 'adonisjs',
  version: '6.15.0',
  tags: ['nodejs', 'adonisjs', 'api', 'mvc', 'typescript', 'lucid-orm', 'edge-template', 'websockets', 'graphql'],
  port: 3333,
  dependencies: {},
  features: ['routing', 'database', 'authentication', 'authorization', 'validation', 'websockets', 'queue', 'email', 'rate-limiting', 'testing', 'docker', 'graphql'],
  
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
    "seed": "node ace db:seed"
  },
  "imports": {
    "#controllers/*": "./app/controllers/*.js",
    "#exceptions/*": "./app/exceptions/*.js",
    "#models/*": "./app/models/*.js",
    "#services/*": "./app/services/*.js",
    "#validators/*": "./app/validators/*.js",
    "#middleware/*": "./app/middleware/*.js",
    "#policies/*": "./app/policies/*.js",
    "#abilities/*": "./app/abilities/*.js",
    "#providers/*": "./providers/*.js",
    "#database/*": "./database/*.js",
    "#tests/*": "./tests/*.js",
    "#start/*": "./start/*.js",
    "#config/*": "./config/*.js"
  },
  "dependencies": {
    "@adonisjs/auth": "^9.2.4",
    "@adonisjs/bouncer": "^3.1.3",
    "@adonisjs/core": "^6.15.0",
    "@adonisjs/cors": "^2.2.1",
    "@adonisjs/limiter": "^2.3.2",
    "@adonisjs/lucid": "^21.4.1",
    "@vinejs/vine": "^2.1.0",
    "luxon": "^3.5.0",
    "pg": "^8.13.1",
    "reflect-metadata": "^0.2.2"
  },
  "devDependencies": {
    "@adonisjs/assembler": "^7.8.2",
    "@adonisjs/eslint-config": "^2.0.0-beta.8",
    "@adonisjs/prettier-config": "^1.4.0",
    "@adonisjs/tsconfig": "^1.4.0",
    "@japa/api-client": "^2.0.3",
    "@japa/assert": "^3.0.0",
    "@japa/plugin-adonisjs": "^3.0.2",
    "@japa/runner": "^3.1.4",
    "@swc/core": "^1.9.3",
    "@types/luxon": "^3.4.2",
    "@types/node": "^22.10.2",
    "eslint": "^8.57.1",
    "hot-hook": "^0.4.0",
    "pino-pretty": "^11.3.0",
    "prettier": "^3.4.2",
    "ts-node-maintained": "^10.9.4",
    "typescript": "~5.7.2"
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
    "rootDir": "./",
    "outDir": "./build"
  }
}
`,

    // AdonisJS configuration
    'adonisrc.ts': `import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  commands: [
    () => import('@adonisjs/core/commands'),
    () => import('@adonisjs/lucid/commands'),
    () => import('@adonisjs/bouncer/commands')],

  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl', 'test']},
    () => import('@adonisjs/core/providers/vinejs_provider'),
    () => import('@adonisjs/cors/cors_provider'),
    () => import('@adonisjs/lucid/database_provider'),
    () => import('@adonisjs/auth/auth_provider'),
    () => import('@adonisjs/bouncer/bouncer_provider'),
    () => import('@adonisjs/limiter/limiter_provider')],

  preloads: [
    () => import('#start/routes'),
    () => import('#start/kernel')],

  tests: {
    suites: [
      {
        files: ['tests/unit/**/*.spec(.ts|.js)'],
        name: 'unit',
        timeout: 2000},
      {
        files: ['tests/functional/**/*.spec(.ts|.js)'],
        name: 'functional',
        timeout: 30000}],
    forceExit: false},

  metaFiles: [
    {
      pattern: 'public/**',
      reloadServer: false}]})
`,

    // Environment variables
    '.env.example': `TZ=UTC
PORT=3333
HOST=localhost
LOG_LEVEL=info
APP_KEY=your-app-key-generate-with-node-ace-generate-key
APP_NAME={{projectName}}
NODE_ENV=development

# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_DATABASE={{projectName}}

# Rate limiter
LIMITER_STORE=memory
`,

    // Server entry point
    'bin/server.ts': `/*
|--------------------------------------------------------------------------
| HTTP server entrypoint
|--------------------------------------------------------------------------
|
| The "server.ts" file is the entrypoint for starting the AdonisJS HTTP
| server. Either you can run this file directly or use the "serve"
| command to run this file and monitor file changes
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
    app.listen('SIGTERM', () => app.terminate())
    app.listenIf(app.managedByPm2, 'SIGINT', () => app.terminate())
  })
  .httpServer()
  .start()
  .catch((error) => {
    process.exitCode = 1
    prettyPrintError(error)
  })
`,

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
import { authThrottle, throttle } from '#start/limiter'

const AuthController = () => import('#controllers/auth_controller')
const UsersController = () => import('#controllers/users_controller')
const TodosController = () => import('#controllers/todos_controller')
const HealthController = () => import('#controllers/health_controller')

// Health check
router.get('/health', [HealthController, 'check'])

// API routes
router
  .group(() => {
    // Authentication routes
    router
      .group(() => {
        router.post('/register', [AuthController, 'register'])
        router.post('/login', [AuthController, 'login'])
        router.post('/logout', [AuthController, 'logout']).use(middleware.auth())
        router.get('/me', [AuthController, 'me']).use(middleware.auth())
        router.post('/forgot-password', [AuthController, 'forgotPassword'])
        router.post('/reset-password/:token', [AuthController, 'resetPassword'])
        router.get('/verify-email/:token', [AuthController, 'verifyEmail'])
      })
      .prefix('/auth')
      .use(authThrottle)

    // User routes
    router
      .group(() => {
        router.get('/me', [UsersController, 'me'])
        router.put('/me', [UsersController, 'updateProfile'])
        router.put('/me/password', [UsersController, 'changePassword'])
      })
      .prefix('/users')
      .use(middleware.auth())

    // Todo routes
    router
      .group(() => {
        router.get('/', [TodosController, 'index'])
        router.post('/', [TodosController, 'store'])
        router.get('/:id', [TodosController, 'show'])
        router.put('/:id', [TodosController, 'update'])
        router.delete('/:id', [TodosController, 'destroy'])
        router.post('/:id/archive', [TodosController, 'archive'])
        router.post('/:id/unarchive', [TodosController, 'unarchive'])
      })
      .prefix('/todos')
      .use(middleware.auth())
  })
  .prefix('/api/v1')
  .use(throttle)
`,

    // Kernel configuration
    'start/kernel.ts': `/*
|--------------------------------------------------------------------------
| HTTP kernel file
|--------------------------------------------------------------------------
|
| The HTTP kernel file is used to register the middleware with the server
| or the router.
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
 * The server middleware stack runs middleware on all the HTTP
 * requests, even if there is no route registered for
 * the request URL.
 */
server.use([
  () => import('#middleware/container_bindings_middleware'),
  () => import('#middleware/force_json_response_middleware'),
  () => import('@adonisjs/cors/cors_middleware')])

/**
 * The router middleware stack runs middleware on all the HTTP
 * requests with a registered route.
 */
router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/auth/initialize_auth_middleware'),
  () => import('#middleware/initialize_bouncer_middleware')])

/**
 * Named middleware collection must be explicitly assigned to
 * the routes or the routes group.
 */
export const middleware = router.named({
  auth: () => import('#middleware/auth_middleware'),
  admin: () => import('#middleware/admin_middleware')})
`,

    // Auth controller
    'app/controllers/auth_controller.ts': `import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { randomBytes } from 'node:crypto'
import User from '#models/user'
import {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} from '#validators/auth'

export default class AuthController {
  async register({ request, response }: HttpContext) {
    const data = await request.validateUsing(registerValidator)

    const user = await User.create({
      ...data,
      verificationToken: randomBytes(32).toString('hex'),
      isEmailVerified: false,
      isActive: true,
      role: 'user'})

    const token = await User.accessTokens.create(user)

    return response.created({
      user: user.serialize(),
      token: token.toJSON()})
  }

  async login({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    // Throws E_INVALID_CREDENTIALS (rendered as a 400) for unknown users or bad passwords
    const user = await User.verifyCredentials(email, password)

    if (!user.isActive) {
      return response.forbidden({ message: 'Account is inactive' })
    }

    const token = await User.accessTokens.create(user)

    return response.ok({
      user: user.serialize(),
      token: token.toJSON()})
  }

  async logout({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const token = user.currentAccessToken
    await User.accessTokens.delete(user, token.identifier)

    return response.ok({ message: 'Logged out successfully' })
  }

  async me({ auth, response }: HttpContext) {
    return response.ok(auth.getUserOrFail().serialize())
  }

  async forgotPassword({ request, response }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator)

    const user = await User.findBy('email', email)
    if (user) {
      user.resetToken = randomBytes(32).toString('hex')
      user.resetTokenExpiry = DateTime.now().plus({ hours: 1 })
      await user.save()
      // Deliver user.resetToken by email here (e.g. with @adonisjs/mail)
    }

    // Same answer either way, to prevent email enumeration
    return response.ok({ message: 'If the email exists, a reset link has been sent' })
  }

  async resetPassword({ request, response, params }: HttpContext) {
    const { password } = await request.validateUsing(resetPasswordValidator)

    const user = await User.findBy('resetToken', params.token)
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
    const user = await User.findBy('verificationToken', params.token)
    if (!user) {
      return response.badRequest({ message: 'Invalid verification token' })
    }

    user.isEmailVerified = true
    user.verificationToken = null
    await user.save()

    return response.ok({ message: 'Email verified successfully' })
  }
}
`,

    // User model
    'app/models/user.ts': `import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
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
  declare metadata: Record<string, unknown> | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => Todo)
  declare todos: HasMany<typeof Todo>

  /**
   * Opaque access tokens (see config/auth.ts). Passwords are hashed
   * by the AuthFinder mixin before every save.
   */
  static accessTokens = DbAccessTokensProvider.forModel(User)

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
  async index({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const page = request.input('page', 1)
    const limit = request.input('limit', 10)
    const status = request.input('status')
    const isArchived = request.input('is_archived', false)

    const query = Todo.query().where('user_id', user.id).where('is_archived', isArchived)

    if (status) {
      query.where('status', status)
    }

    const todos = await query.orderBy('created_at', 'desc').paginate(page, limit)

    return response.ok(todos)
  }

  async store({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()
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
}
`,

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

    // Config files
    'config/app.ts': `import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { Secret } from '@adonisjs/core/helpers'
import { defineConfig } from '@adonisjs/core/http'

/**
 * The app key is used for signing and encrypting values. It is loaded
 * from the environment variables.
 */
export const appKey = new Secret(env.get('APP_KEY'))

/**
 * The configuration settings used by the HTTP server
 */
export const http = defineConfig({
  generateRequestId: true,
  allowMethodSpoofing: false,

  /**
   * Enabling async local storage will let you access HTTP context
   * from anywhere inside your application.
   */
  useAsyncLocalStorage: false,

  /**
   * Manage cookies configuration. The settings for the session id cookie are
   * defined inside the "config/session.ts" file.
   */
  cookie: {
    domain: '',
    path: '/',
    maxAge: '2h',
    httpOnly: true,
    secure: app.inProduction,
    sameSite: 'lax'}})
`,

    'config/auth.ts': `import { defineConfig } from '@adonisjs/auth'
import { tokensGuard, tokensUserProvider } from '@adonisjs/auth/access_tokens'
import type { InferAuthenticators, Authenticators } from '@adonisjs/auth/types'

const authConfig = defineConfig({
  default: 'api',
  guards: {
    api: tokensGuard({
      provider: tokensUserProvider({
        tokens: 'accessTokens',
        model: () => import('#models/user')})})}})

export default authConfig

/**
 * Inferring types from the configured auth guards.
 */
declare module '@adonisjs/auth/types' {
  export interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
declare module '@adonisjs/core/types' {
  interface EventsList {
    'auth:authentication_attempted': Authenticators
  }
}
`,

    'config/database.ts': `import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  connection: 'postgres',
  connections: {
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD', ''),
        database: env.get('DB_DATABASE')},
      migrations: {
        naturalSort: true,
        paths: ['database/migrations']}}}})

export default dbConfig
`,

    'config/limiter.ts': `import env from '#start/env'
import { defineConfig, stores } from '@adonisjs/limiter'

const limiterConfig = defineConfig({
  default: env.get('LIMITER_STORE'),

  stores: {
    /**
     * Memory store is great for a single process. Use the database or
     * redis store when running more than one instance.
     */
    memory: stores.memory({})}})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
`,

    // Health controller
    'app/controllers/health_controller.ts': `import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class HealthController {
  async check({ response }: HttpContext) {
    let database = 'up'
    try {
      await db.rawQuery('select 1')
    } catch {
      database = 'down'
    }

    const healthy = database === 'up'
    return response.status(healthy ? 200 : 503).send({
      status: healthy ? 'healthy' : 'unhealthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: { database }})
  }
}
`,

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
    'tests/bootstrap.ts': `import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import type { Config } from '@japa/runner/types'

/**
 * This file is imported by the "bin/test.ts" entrypoint file
 */

/**
 * Configure Japa plugins in the plugins array.
 * Learn more - https://japa.dev/docs/runner-config#plugins-optional
 */
export const plugins: Config['plugins'] = [assert(), apiClient(), pluginAdonisJS(app)]

/**
 * Configure lifecycle function to run before and after all the
 * tests.
 *
 * The setup functions are executed before all the tests
 * The teardown functions are executed after all the tests
 */
export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [() => testUtils.db().migrate()],
  teardown: [],
}

/**
 * Configure suites by tapping into the test suite instance.
 * Learn more - https://japa.dev/docs/test-suites#lifecycle-hooks
 */
export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    return suite.setup(() => testUtils.httpServer().start())
  }
}
`,

    // Docker configuration
    'Dockerfile': `# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

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
RUN npm install --omit=dev && npm cache clean --force

# Copy built application
COPY --from=builder /app/build ./

# Create directories
RUN mkdir -p tmp && chown -R nodejs:nodejs tmp

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "fetch('http://127.0.0.1:3333/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

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
      - PORT=3333
      - HOST=0.0.0.0
      - LOG_LEVEL=info
      - APP_NAME={{projectName}}
      - APP_KEY=\${APP_KEY}
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USER=\${PG_USER:-postgres}
      - DB_PASSWORD=\${PG_PASSWORD:-postgres}
      - DB_DATABASE=\${PG_DB_NAME:-{{projectName}}}
      - LIMITER_STORE=memory
    depends_on:
      postgres:
        condition: service_healthy
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



volumes:
  postgres-data:

networks:
  app-network:
    driver: bridge`,

    // README
    'README.md': `# {{projectName}}

Full-featured MVC application built with AdonisJS 6.

## Features

- **MVC architecture** with controllers, models, validators and policies
- **Access token authentication** (\`@adonisjs/auth\`, opaque tokens stored in \`auth_access_tokens\`)
- **Lucid ORM** with PostgreSQL migrations and models
- **Authorization** with Bouncer policies (\`app/policies\`) and an \`admin\` middleware
- **Validation** with VineJS
- **Rate limiting** with \`@adonisjs/limiter\` (memory store)
- **Testing** with Japa (\`node ace test\`)
- **Docker** configuration
- **Health check** at \`/health\`

Mail, queues, WebSockets, file storage and GraphQL are not part of this template; add the
matching \`@adonisjs/*\` packages (\`node ace add @adonisjs/mail\`, ...) when you need them.

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL

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
├── policies/      # Authorization policies
└── exceptions/    # Custom exceptions

config/            # Configuration files
database/          # Migrations and seeds
start/            # Application bootstrapping
tests/            # Test files
\`\`\`

## Commands

- \`node ace serve --hmr\` - Start dev server with HMR
- \`node ace build\` - Build for production
- \`node ace migration:run\` - Run migrations
- \`node ace db:seed\` - Seed database
- \`node ace list\` - List all commands

## License

MIT
`,

    'ace.js': `/*
|--------------------------------------------------------------------------
| JavaScript entrypoint for running ace commands
|--------------------------------------------------------------------------
|
| DO NOT MODIFY THIS FILE AS IT WILL BE OVERRIDDEN DURING THE BUILD
| PROCESS.
|
| See docs.adonisjs.com/guides/typescript-build-process#creating-production-build
|
| Since, we cannot run TypeScript source code using "node" binary, we need
| a JavaScript entrypoint to run ace commands.
|
| This file registers the "ts-node-maintained/register/esm" hook with the Node.js module system
| and then imports the "bin/console.ts" file.
|
*/

/**
 * Register hook to process TypeScript files using ts-node-maintained
 */
import 'ts-node-maintained/register/esm'

/**
 * Import ace console entrypoint
 */
await import('./bin/console.js')
`,

    'app/controllers/users_controller.ts': `import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import { changePasswordValidator, updateProfileValidator } from '#validators/user'

export default class UsersController {
  async me({ auth, response }: HttpContext) {
    return response.ok(auth.getUserOrFail().serialize())
  }

  async updateProfile({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(updateProfileValidator)

    user.merge(data)
    await user.save()

    return response.ok(user.serialize())
  }

  async changePassword({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { currentPassword, newPassword } = await request.validateUsing(changePasswordValidator)

    if (!(await hash.verify(user.password, currentPassword))) {
      return response.badRequest({ message: 'Current password is incorrect' })
    }

    user.password = newPassword
    await user.save()

    return response.ok({ message: 'Password changed successfully' })
  }
}
`,

    'app/middleware/admin_middleware.ts': `import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Only lets authenticated users with the "admin" role through.
 * Register it after the "auth" middleware.
 */
export default class AdminMiddleware {
  async handle({ auth, response }: HttpContext, next: NextFn) {
    if (auth.user?.role !== 'admin') {
      return response.forbidden({ message: 'Administrator access required' })
    }
    return next()
  }
}
`,

    'app/middleware/auth_middleware.ts': `import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users.
 */
export default class AuthMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
    } = {}
  ) {
    await ctx.auth.authenticateUsing(options.guards)
    return next()
  }
}
`,

    'app/middleware/container_bindings_middleware.ts': `import { Logger } from '@adonisjs/core/logger'
import { HttpContext } from '@adonisjs/core/http'
import { NextFn } from '@adonisjs/core/types/http'

/**
 * The "ContainerBindingsMiddleware" binds "classes" to their "values"
 * inside the container for a given HTTP request. The bindings are
 * scoped to the request and removed when it ends.
 */
export default class ContainerBindingsMiddleware {
  handle(ctx: HttpContext, next: NextFn) {
    ctx.containerResolver.bindValue(HttpContext, ctx)
    ctx.containerResolver.bindValue(Logger, ctx.logger)

    return next()
  }
}
`,

    'app/middleware/force_json_response_middleware.ts': `import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Updates the "Accept" header to always accept "application/json" so that
 * errors and validation failures are rendered as JSON.
 */
export default class ForceJsonResponseMiddleware {
  async handle({ request }: HttpContext, next: NextFn) {
    const headers = request.headers()
    headers.accept = 'application/json'

    return next()
  }
}
`,

    'app/middleware/initialize_bouncer_middleware.ts': `import { Bouncer } from '@adonisjs/bouncer'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { abilities, policies } from '#start/bouncer'

/**
 * Init bouncer middleware is used to create a bouncer instance
 * during an HTTP request
 */
export default class InitializeBouncerMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    /**
     * Create bouncer instance for the ongoing HTTP request.
     * We will pull the user from the HTTP context.
     */
    ctx.bouncer = new Bouncer(
      () => ctx.auth.user || null,
      abilities,
      policies
    ).setContainerResolver(ctx.containerResolver)

    return next()
  }
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    bouncer: Bouncer<
      Exclude<HttpContext['auth']['user'], undefined>,
      typeof abilities,
      typeof policies
    >
  }
}
`,

    'app/validators/todo.ts': `import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

export const createTodoValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().optional(),
    status: vine.enum(['pending', 'in_progress', 'completed'] as const).optional(),
    priority: vine.enum(['low', 'medium', 'high'] as const).optional(),
    dueDate: vine.date().transform((value) => DateTime.fromJSDate(value)).optional(),
    tags: vine.array(vine.string().trim()).optional()})
)

export const updateTodoValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255).optional(),
    description: vine.string().trim().optional(),
    status: vine.enum(['pending', 'in_progress', 'completed'] as const).optional(),
    priority: vine.enum(['low', 'medium', 'high'] as const).optional(),
    dueDate: vine.date().transform((value) => DateTime.fromJSDate(value)).optional(),
    tags: vine.array(vine.string().trim()).optional()})
)
`,

    'app/validators/user.ts': `import vine from '@vinejs/vine'

export const updateProfileValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(100).optional(),
    phone: vine.string().trim().maxLength(30).nullable().optional(),
    avatar: vine.string().trim().url().nullable().optional()})
)

export const changePasswordValidator = vine.compile(
  vine.object({
    currentPassword: vine.string(),
    newPassword: vine.string().minLength(8).maxLength(100)})
)
`,

    'bin/console.ts': `/*
|--------------------------------------------------------------------------
| Ace entry point
|--------------------------------------------------------------------------
|
| The "console.ts" file is the entrypoint for booting the AdonisJS
| command-line application.
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
    app.listen('SIGTERM', () => app.terminate())
    app.listenIf(app.managedByPm2, 'SIGINT', () => app.terminate())
  })
  .ace()
  .handle(process.argv.splice(2))
  .catch((error) => {
    process.exitCode = 1
    prettyPrintError(error)
  })
`,

    'bin/test.ts': `/*
|--------------------------------------------------------------------------
| Test runner entrypoint
|--------------------------------------------------------------------------
|
| The "test.ts" file is the entrypoint for running tests using Japa.
|
| Either you can run this file directly or use the "test"
| command to run this file and monitor file changes.
|
*/

process.env.NODE_ENV = 'test'

import 'reflect-metadata'
import { Ignitor, prettyPrintError } from '@adonisjs/core'
import { configure, processCLIArgs, run } from '@japa/runner'

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
    app.listen('SIGTERM', () => app.terminate())
    app.listenIf(app.managedByPm2, 'SIGINT', () => app.terminate())
  })
  .testRunner()
  .configure(async (app) => {
    const { runnerHooks, ...config } = await import('../tests/bootstrap.js')

    processCLIArgs(process.argv.splice(2))
    configure({
      ...app.rcFile.tests,
      ...config,
      ...{
        setup: runnerHooks.setup,
        teardown: runnerHooks.teardown.concat([() => app.terminate()])},
    })
  })
  .run(() => run())
  .catch((error) => {
    process.exitCode = 1
    prettyPrintError(error)
  })
`,

    'config/bodyparser.ts': `import { defineConfig } from '@adonisjs/core/bodyparser'

const bodyParserConfig = defineConfig({
  /**
   * The bodyparser middleware will parse the request body
   * for the following HTTP methods.
   */
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],

  /**
   * Config for the "application/x-www-form-urlencoded"
   * content-type parser
   */
  form: {
    convertEmptyStringsToNull: true,
    types: ['application/x-www-form-urlencoded']},

  /**
   * Config for the JSON parser
   */
  json: {
    convertEmptyStringsToNull: true,
    types: [
      'application/json',
      'application/json-patch+json',
      'application/vnd.api+json',
      'application/csp-report']},

  /**
   * Config for the "multipart/form-data" content-type parser.
   * File uploads are handled by the multipart parser.
   */
  multipart: {
    autoProcess: true,
    convertEmptyStringsToNull: true,
    processManually: [],
    limit: '20mb',
    types: ['multipart/form-data']}})

export default bodyParserConfig
`,

    'config/cors.ts': `import { defineConfig } from '@adonisjs/cors'

/**
 * Configuration options to tweak the CORS policy. The following
 * options are documented on the official documentation website.
 *
 * https://docs.adonisjs.com/guides/security/cors
 */
const corsConfig = defineConfig({
  enabled: true,
  origin: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90})

export default corsConfig
`,

    'config/hash.ts': `import { defineConfig, drivers } from '@adonisjs/core/hash'

const hashConfig = defineConfig({
  default: 'scrypt',

  list: {
    scrypt: drivers.scrypt({
      cost: 16384,
      blockSize: 8,
      parallelization: 1,
      maxMemory: 33554432})}})

export default hashConfig

/**
 * Inferring types for the list of hashers you have configured
 * in your application.
 */
declare module '@adonisjs/core/types' {
  export interface HashersList extends InferHashers<typeof hashConfig> {}
}
`,

    'config/logger.ts': `import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, targets } from '@adonisjs/core/logger'

const loggerConfig = defineConfig({
  default: 'app',

  /**
   * The loggers object can be used to define multiple loggers.
   * By default, we configure only one logger (named "app").
   */
  loggers: {
    app: {
      enabled: true,
      name: env.get('APP_NAME'),
      level: env.get('LOG_LEVEL'),
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .pushIf(app.inProduction, targets.file({ destination: 1 }))
          .toArray()}}}})

export default loggerConfig

/**
 * Inferring types for the list of loggers you have configured
 * in your application.
 */
declare module '@adonisjs/core/types' {
  export interface LoggersList extends InferLoggers<typeof loggerConfig> {}
}
`,

    'database/migrations/1734567890122_create_access_tokens_table.ts': `import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'auth_access_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('tokenable_id')
        .notNullable()
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('type').notNullable()
      table.string('name').nullable()
      table.string('hash').notNullable()
      table.text('abilities').notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
      table.timestamp('last_used_at').nullable()
      table.timestamp('expires_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
`,

    'start/bouncer.ts': `/*
|--------------------------------------------------------------------------
| Bouncer abilities and policies
|--------------------------------------------------------------------------
|
| Policies are registered here so that "bouncer.with('TodoPolicy')" can
| lazily import them.
|
*/

/**
 * Delete the following ability to start from
 * scratch
 */
export const abilities = {}

export const policies = {
  TodoPolicy: () => import('#policies/todo_policy')}
`,

    'start/env.ts': `/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The \`Env.create\` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  APP_NAME: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the limiter package
  |----------------------------------------------------------
  */
  LIMITER_STORE: Env.schema.enum(['memory'] as const),
})
`,

    'start/limiter.ts': `/*
|--------------------------------------------------------------------------
| Define HTTP limiters
|--------------------------------------------------------------------------
|
| The "limiter.define" method creates an HTTP middleware to apply rate
| limits on a route or a group of routes.
|
*/

import limiter from '@adonisjs/limiter/services/main'

export const throttle = limiter.define('global', () => {
  return limiter.allowRequests(100).every('1 minute')
})

export const authThrottle = limiter.define('auth', () => {
  return limiter.allowRequests(10).every('1 minute')
})
`,

    'tests/functional/auth.spec.ts': `import { test } from '@japa/runner'

test.group('Auth', () => {
  test('rejects a todo listing without a token', async ({ client }) => {
    const response = await client.get('/api/v1/todos')

    response.assertStatus(401)
  })

  test('validates the registration payload', async ({ client }) => {
    const response = await client.post('/api/v1/auth/register').json({ email: 'not-an-email' })

    response.assertStatus(422)
  })
})
`
  }
};