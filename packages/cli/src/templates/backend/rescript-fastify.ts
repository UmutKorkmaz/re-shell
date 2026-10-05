import { BackendTemplate } from '../types';

export const rescriptFastifyTemplate: BackendTemplate = {
  id: 'rescript-fastify',
  name: 'rescript-fastify',
  displayName: 'ReScript + Fastify',
  description: 'Type-safe ReScript bindings for Fastify with high performance and schema validation',
  language: 'rescript',
  framework: 'fastify',
  version: '1.0.0',
  tags: ['rescript', 'fastify', 'nodejs', 'type-safe', 'performance', 'validation'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing', 'graphql'],

  files: {
    // Package.json
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "ReScript + Fastify API server with type safety and high performance",
  "scripts": {
    "dev": "rescript build -w",
    "build": "rescript build",
    "start": "node src/Main.bs.js",
    "server": "nodemon --watch src -e js --exec \\"node src/Main.bs.js\\"",
    "test": "rescript build && node --test src/__tests__/ApiTest.bs.js",
    "clean": "rescript clean",
    "format": "rescript format"
  },
  "dependencies": {
    "@fastify/cors": "^8.5.0",
    "@fastify/helmet": "^11.1.1",
    "@fastify/jwt": "^7.2.4",
    "@rescript/core": "^1.3.0",
    "bcryptjs": "^2.4.3",
    "fastify": "^4.26.2",
    "graphql": "^16.8.1",
    "mercurius": "^13.4.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.0",
    "rescript": "^11.1.0"
  },
  "keywords": [
    "rescript",
    "fastify",
    "api",
    "rest",
    "type-safe"
  ],
  "author": "re-shell",
  "license": "MIT"
}
`,

    // ReScript configuration
    'rescript.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "sources": [
    {
      "dir": "src",
      "subdirs": true
    }
  ],
  "package-specs": {
    "module": "commonjs",
    "in-source": true
  },
  "suffix": ".bs.js",
  "bs-dependencies": [
    "@rescript/core"
  ],
  "bsc-flags": [
    "-open RescriptCore"
  ]
}
`,

    // Main server file
    'src/Server.res': `let publicUser = (u: Types.user) => {"id": u.id, "email": u.email, "name": u.name, "role": u.role}

let jsonError = (reply: Fastify.reply, status: int, message: string): Fastify.reply =>
  reply->Fastify.code(status)->Fastify.send({"error": message})

// Authentication hooks (preHandler): the reply is only sent when the token is rejected.
let requireUser: Fastify.hook = (request, reply, done) =>
  request
  ->Fastify.jwtVerify
  ->Promise.thenResolve(_claims => done())
  ->Promise.catch(_ => {
    let _ = jsonError(reply, 401, "Unauthorized")
    Promise.resolve()
  })
  ->ignore

let requireAdmin: Fastify.hook = (request, reply, done) =>
  request
  ->Fastify.jwtVerify
  ->Promise.thenResolve((claims: Types.claims) =>
    if claims.role == "admin" {
      done()
    } else {
      let _ = jsonError(reply, 403, "Admin role required")
    }
  )
  ->Promise.catch(_ => {
    let _ = jsonError(reply, 401, "Unauthorized")
    Promise.resolve()
  })
  ->ignore

// Routes
module Routes = {
  let health: Fastify.handler = async (_request, reply) =>
    reply->Fastify.send({
      "status": "healthy",
      "timestamp": Date.now(),
      "version": "1.0.0",
    })

  let home: Fastify.handler = async (_request, reply) => {
    let _ = reply->Fastify.header("Content-Type", "text/html")
    reply->Fastify.send(\`<!DOCTYPE html>
<html>
  <head>
    <title>{{projectName}}</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
      h1 { color: #333; }
    </style>
  </head>
  <body>
    <h1>Welcome to {{projectName}}</h1>
    <p>Type-safe API built with ReScript and Fastify</p>
    <p>API available at: <a href="/api/v1/health">/api/v1/health</a></p>
  </body>
</html>\`)
  }

  let session = async (reply: Fastify.reply, status: int, user: Types.user) => {
    let token = await reply->Fastify.jwtSign(Auth.claimsOf(user), {"expiresIn": "7d"})
    reply->Fastify.code(status)->Fastify.send({"token": token, "user": publicUser(user)})
  }

  let register: Fastify.handler = async (request, reply) => {
    let body = Fastify.body(request)
    switch (Json.string(body, "email"), Json.string(body, "name"), Json.string(body, "password")) {
    | (Some(email), Some(name), Some(password)) if String.length(password) >= 6 =>
      switch Store.findUserByEmail(email) {
      | Some(_) => jsonError(reply, 409, "Email already registered")
      | None => await session(reply, 201, Store.addUser(~email, ~name, ~password, ~role="user"))
      }
    | _ => jsonError(reply, 400, "email, name and a password of at least 6 characters are required")
    }
  }

  let login: Fastify.handler = async (request, reply) => {
    let body = Fastify.body(request)
    switch (Json.string(body, "email"), Json.string(body, "password")) {
    | (Some(email), Some(password)) =>
      switch Store.findUserByEmail(email) {
      | Some(user) if Auth.verifyPassword(password, user.passwordHash) =>
        await session(reply, 200, user)
      | _ => jsonError(reply, 401, "Invalid credentials")
      }
    | _ => jsonError(reply, 400, "email and password are required")
    }
  }

  let me: Fastify.handler = async (request, reply) =>
    switch await request->Fastify.jwtVerify {
    | claims => reply->Fastify.send({"userId": claims.sub, "email": claims.email, "role": claims.role})
    | exception _ => jsonError(reply, 401, "Unauthorized")
    }

  let listProducts: Fastify.handler = async (_request, reply) =>
    reply->Fastify.send({"products": Store.products, "count": Array.length(Store.products)})

  let withProductId = (request: Fastify.request, reply: Fastify.reply, found: Types.product => Fastify.reply) =>
    switch request->Fastify.params->Dict.get("id")->Option.flatMap(id => Int.fromString(id)) {
    | None => jsonError(reply, 400, "Invalid product id")
    | Some(id) =>
      switch Store.findProduct(id) {
      | Some(product) => found(product)
      | None => jsonError(reply, 404, "Product not found")
      }
    }

  let getProduct: Fastify.handler = async (request, reply) =>
    withProductId(request, reply, product => reply->Fastify.send({"product": product}))

  let createProduct: Fastify.handler = async (request, reply) => {
    let body = Fastify.body(request)
    switch (Json.string(body, "name"), Json.float(body, "price")) {
    | (Some(name), Some(price)) => {
        let product = Store.addProduct(
          ~name,
          ~description=Json.string(body, "description")->Option.getOr(""),
          ~price,
          ~stock=Json.float(body, "stock")->Option.map(Float.toInt)->Option.getOr(0),
        )
        reply->Fastify.code(201)->Fastify.send({"product": product})
      }
    | _ => jsonError(reply, 400, "name and price are required")
    }
  }

  let updateProduct: Fastify.handler = async (request, reply) =>
    withProductId(request, reply, existing => {
      let body = Fastify.body(request)
      let updated = Store.updateProduct(existing.id, p => {
        ...p,
        name: Json.string(body, "name")->Option.getOr(p.name),
        description: Json.string(body, "description")->Option.getOr(p.description),
        price: Json.float(body, "price")->Option.getOr(p.price),
        stock: Json.float(body, "stock")->Option.map(Float.toInt)->Option.getOr(p.stock),
      })
      reply->Fastify.send({"product": updated})
    })

  let deleteProduct: Fastify.handler = async (request, reply) =>
    withProductId(request, reply, product => {
      let _ = Store.removeProduct(product.id)
      reply->Fastify.code(204)->Fastify.send()
    })
}

@module external graphqlPlugin: 'plugin = "./graphqlPlugin.js"

/** Builds the Fastify application (does not listen). */
let make = async (): Fastify.app => {
  let app = Fastify.make({"logger": Env.get("NODE_ENV") != Some("test")})

  await app->Fastify.register(Fastify.cors)
  await app->Fastify.registerWith(Fastify.helmet, {"contentSecurityPolicy": false})
  await app->Fastify.registerWith(Fastify.jwt, {"secret": Auth.secret()})

  app->Fastify.get("/", Routes.home)

  // API routes
  app->Fastify.get("/api/v1/health", Routes.health)
  app->Fastify.post("/api/v1/auth/register", Routes.register)
  app->Fastify.post("/api/v1/auth/login", Routes.login)
  app->Fastify.get("/api/v1/auth/me", Routes.me)
  app->Fastify.get("/api/v1/products", Routes.listProducts)
  app->Fastify.get("/api/v1/products/:id", Routes.getProduct)
  app->Fastify.postWith("/api/v1/products", {"preHandler": requireAdmin}, Routes.createProduct)
  app->Fastify.putWith("/api/v1/products/:id", {"preHandler": requireAdmin}, Routes.updateProduct)
  app->Fastify.deleteWith("/api/v1/products/:id", {"preHandler": requireAdmin}, Routes.deleteProduct)

  // GraphQL endpoint (Mercurius)
  await app->Fastify.register(graphqlPlugin)

  app->Fastify.setNotFoundHandler(async (_request, reply) => jsonError(reply, 404, "Not found"))

  await app->Fastify.ready
  app
}
`,

    // Types file
    'src/Types.res': `type user = {
  id: string,
  email: string,
  name: string,
  role: string,
  passwordHash: string,
}

type product = {
  id: int,
  name: string,
  description: string,
  price: float,
  stock: int,
}

/** What is stored in (and read back from) the JWT. */
type claims = {
  sub: string,
  email: string,
  role: string,
}
`,

    // Auth utilities
    'src/Auth.res': `@module("bcryptjs") external hashSync: (string, int) => string = "hashSync"
@module("bcryptjs") external compareSync: (string, string) => bool = "compareSync"

let secret = (): string => Env.get("JWT_SECRET")->Option.getOr("change-this-secret-in-production")

let hashPassword = (password: string): string => hashSync(password, 10)

let verifyPassword = (password: string, hash: string): bool => compareSync(password, hash)

let claimsOf = (user: Types.user): Types.claims => {sub: user.id, email: user.email, role: user.role}
`,

    // GraphQL schema and resolvers (Mercurius)
    'src/graphqlSchema.js': `const schema = \`
  type Query {
    hello: String!
    health: String!
  }
\`;

const resolvers = {
  Query: {
    hello: async () => 'Hello from ReScript Fastify GraphQL!',
    health: async () => 'healthy'
  }
};

module.exports = { schema, resolvers };
`,

    // Mercurius GraphQL Fastify plugin registration (JS interop)
    'src/graphqlPlugin.js': `const mercurius = require('mercurius');
const { schema, resolvers } = require('./graphqlSchema');

const plugin = async (fastify) => {
  fastify.register(mercurius, {
    schema,
    resolvers,
    graphiql: true,
    path: '/graphql'
  });
};

module.exports = plugin;
`,

    // Environment file
    '.env.example': `# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Secret (change in production!)
JWT_SECRET=change-this-secret-in-production

# CORS
CORS_ORIGIN=*

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000

# Logging
LOG_LEVEL=info`,

    // .gitignore
    '.gitignore': `# Dependencies
node_modules/
.pnp
.pnp.js

# Build output
dist/
lib/
*.bs.js
*.bs.mjs
*.bs.ts
*.gen.ts
*.gen.tsx

# Environment
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Testing
coverage/
.nyc_output

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# ReScript
.rescript-cache/
.mf/

# Logs
logs
*.log`,

    // Dockerfile
    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source files
COPY . .

# Build ReScript
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start server
CMD ["npm", "start"]`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - JWT_SECRET=change-this-secret
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/v1/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s`,

    // README
    'README.md': `# {{projectName}}

Type-safe, high-performance API server built with ReScript and Fastify.

## Features

- **ReScript**: Type-safe JavaScript with compile-time guarantees
- **Fastify**: High-performance web framework with low overhead
- **Schema Validation**: Built-in JSON schema validation
- **Fast**: 20% faster than Express with efficient routing
- **Type Safety**: Compile-time type checking eliminates runtime errors
- **Functional**: Immutable data structures and pure functions
- **Plugins**: CORS, Helmet and JWT (\`@fastify/*\`), GraphQL via Mercurius
- **Logging**: Structured logging with Pino logger

## Requirements

- Node.js 18+
- npm or yarn

## Installation

\`\`\`bash
# Install dependencies
npm install

# Build ReScript (compiles in place to src/*.bs.js)
npm run build
\`\`\`

## Quick Start

### Development Mode
\`\`\`bash
# Watch mode - automatically recompiles on changes
npm run dev

# Or with server restart on changes
npm run server
\`\`\`

### Production Mode
\`\`\`bash
# Build
npm run build

# Start server
npm start
\`\`\`

Visit http://localhost:3000

## API Endpoints

### Health
- \`GET /api/v1/health\` - Health check

### Authentication
- \`POST /api/v1/auth/register\` - Register new user (\`email\`, \`name\`, \`password\`)
- \`POST /api/v1/auth/login\` - Login user, returns a JWT
- \`GET /api/v1/auth/me\` - Current user (bearer token required)

### Products
- \`GET /api/v1/products\` - List all products
- \`GET /api/v1/products/:id\` - Get product by ID
- \`POST /api/v1/products\` - Create product (admin only)
- \`PUT /api/v1/products/:id\` - Update product (admin only)
- \`DELETE /api/v1/products/:id\` - Delete product (admin only)

### GraphQL
- \`POST /graphql\` - \`{ hello health }\` (Mercurius; GraphiQL at \`/graphiql\`)

## Default Credentials

- Email: \`admin@example.com\`
- Password: \`admin123\`

## Project Structure

\`\`\`
src/
  Main.res           # Entry point (npm start runs src/Main.bs.js)
  Server.res         # Fastify app and routes
  Fastify.res        # Fastify bindings
  Auth.res           # Password hashing (bcryptjs)
  Store.res          # In-memory data store
  Types.res          # Type definitions
  graphqlPlugin.js   # GraphQL endpoint (Mercurius)
  __tests__/         # ReScript tests
rescript.json        # ReScript configuration
package.json         # Dependencies and scripts
\`\`\`

## ReScript + Fastify Features

- **Performance**: 20% faster throughput than Express
- **Validation**: JSON schema validation out of the box
- **Type Safety**: Compile-time guarantees with ReScript
- **Async/Await**: Native async support with RescriptCore
- **Plugins**: Modular plugin architecture
- **Logging**: Structured JSON logging
- **Schema**: JSON schema definition and validation

## Development

\`\`\`bash
# Development with watch
npm run dev

# Build
npm run build

# Clean build artifacts
npm run clean

# Format code
npm run format
\`\`\`

## Testing

Tests are written in ReScript (\`src/__tests__/ApiTest.res\`), use Fastify's \`inject\` and run with Node's built-in test runner:

\`\`\`bash
npm test
\`\`\`

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 3000:3000 {{projectName}}
\`\`\`

Or with Docker Compose:

\`\`\`bash
docker-compose up
\`\`\`

## Why ReScript + Fastify?

- **Type Safety**: Catch errors at compile time, not runtime
- **Performance**: 20% faster than Express with lower overhead
- **Schema Validation**: Built-in JSON schema validation
- **JavaScript Interop**: Use any JavaScript library
- **Fast Compile**: Sub-second compilation times
- **Simple Syntax**: Easy to learn, powerful to use
- **Immutable**: Default immutable data structures
- **Async Native**: First-class async/await support
- **Plugin Ecosystem**: Rich set of plugins and integrations

## Performance

Fastify provides:
- 20% faster throughput than Express
- Lower memory footprint
- Efficient routing algorithm
- Schema validation with negligible overhead
- Built-in logging and serialization

## License

MIT
`,

    'src/Env.res': `// Environment variables
@val external env: Dict.t<string> = "process.env"

let get = (key: string): option<string> => env->Dict.get(key)
`,

    'src/Fastify.res': `// Minimal Fastify bindings
type app
type request
type reply
type handler = (request, reply) => promise<reply>
type hook = (request, reply, unit => unit) => unit

@module external make: {"logger": bool} => app = "fastify"

// Plugins
@module external cors: 'plugin = "@fastify/cors"
@module external helmet: 'plugin = "@fastify/helmet"
@module external jwt: 'plugin = "@fastify/jwt"

@send external register: (app, 'plugin) => promise<unit> = "register"
@send external registerWith: (app, 'plugin, 'options) => promise<unit> = "register"

// Routes
@send external get: (app, string, handler) => unit = "get"
@send external getWith: (app, string, {"preHandler": hook}, handler) => unit = "get"
@send external post: (app, string, handler) => unit = "post"
@send external postWith: (app, string, {"preHandler": hook}, handler) => unit = "post"
@send external put: (app, string, handler) => unit = "put"
@send external putWith: (app, string, {"preHandler": hook}, handler) => unit = "put"
@send external delete: (app, string, handler) => unit = "delete"
@send external deleteWith: (app, string, {"preHandler": hook}, handler) => unit = "delete"
@send external setNotFoundHandler: (app, handler) => unit = "setNotFoundHandler"

@send external ready: app => promise<unit> = "ready"
@send external close: app => promise<unit> = "close"
@send external listen: (app, {"port": int, "host": string}) => promise<string> = "listen"

// Requests
@get external body: request => JSON.t = "body"
@get external params: request => Dict.t<string> = "params"
@send external jwtVerify: request => promise<Types.claims> = "jwtVerify"

// Replies
@send external code: (reply, int) => reply = "code"
@send external send: (reply, 'a) => reply = "send"
@send external header: (reply, string, string) => reply = "header"
@send external jwtSign: (reply, Types.claims, {"expiresIn": string}) => promise<string> = "jwtSign"

// Testing without a socket (light-my-request)
type injected
@send
external inject: (
  app,
  {"method": string, "url": string, "headers": Dict.t<string>, "payload": option<JSON.t>},
) => promise<injected> = "inject"
@get external statusCode: injected => int = "statusCode"
@get external payload: injected => string = "payload"
`,

    'src/Json.res': `// Helpers for reading values out of a parsed JSON request body
let field = (json: JSON.t, key: string): option<JSON.t> =>
  json->JSON.Decode.object->Option.flatMap(fields => fields->Dict.get(key))

let string = (json: JSON.t, key: string): option<string> =>
  field(json, key)->Option.flatMap(JSON.Decode.string)

let float = (json: JSON.t, key: string): option<float> =>
  field(json, key)->Option.flatMap(JSON.Decode.float)
`,

    'src/Main.res': `let port = Env.get("PORT")->Option.flatMap(value => Int.fromString(value))->Option.getOr(3000)
let host = Env.get("HOST")->Option.getOr("0.0.0.0")

let start = async () => {
  let app = await Server.make()
  let _ = await app->Fastify.listen({"port": port, "host": host})
}

start()
->Promise.catch(error => {
  Console.error2("Failed to start server:", error)
  Promise.resolve()
})
->ignore
`,

    'src/Store.res': `// In-memory data store: replace with a real database for production use.
open Types

let users: array<user> = [
  {
    id: "1",
    email: "admin@example.com",
    name: "Admin User",
    role: "admin",
    passwordHash: Auth.hashPassword("admin123"),
  },
]

let products: array<product> = [
  {id: 1, name: "Sample Product 1", description: "This is a sample product", price: 29.99, stock: 100},
  {id: 2, name: "Sample Product 2", description: "Another sample product", price: 49.99, stock: 50},
]

let nextUserId = ref(2)
let nextProductId = ref(3)

let findUserByEmail = (email: string): option<user> => users->Array.find(u => u.email == email)

let addUser = (~email: string, ~name: string, ~password: string, ~role: string): user => {
  let user = {
    id: Int.toString(nextUserId.contents),
    email,
    name,
    role,
    passwordHash: Auth.hashPassword(password),
  }
  nextUserId := nextUserId.contents + 1
  users->Array.push(user)
  user
}

let findProduct = (id: int): option<product> => products->Array.find(p => p.id == id)

let addProduct = (~name: string, ~description: string, ~price: float, ~stock: int): product => {
  let product = {id: nextProductId.contents, name, description, price, stock}
  nextProductId := nextProductId.contents + 1
  products->Array.push(product)
  product
}

let updateProduct = (id: int, update: product => product): option<product> =>
  switch products->Array.findIndex(p => p.id == id) {
  | -1 => None
  | index => {
      let updated = update(products->Array.getUnsafe(index))
      products->Array.setUnsafe(index, updated)
      Some(updated)
    }
  }

let removeProduct = (id: int): bool =>
  switch products->Array.findIndex(p => p.id == id) {
  | -1 => false
  | index => {
      products->Array.splice(~start=index, ~remove=1, ~insert=[])
      true
    }
  }
`,

    'src/__tests__/ApiTest.res': `// Run with: npm test (node's built-in test runner)
@module("node:test") external test: (string, unit => promise<unit>) => unit = "test"
@module("node:assert/strict") external equal: ('a, 'a) => unit = "equal"
@module("node:assert/strict") external ok: bool => unit = "ok"

let request = async (
  app: Fastify.app,
  url: string,
  ~method="GET",
  ~body: option<JSON.t>=?,
  ~token: option<string>=?,
): (int, JSON.t) => {
  let headers = Dict.make()
  switch token {
  | Some(t) => headers->Dict.set("authorization", "Bearer " ++ t)
  | None => ()
  }
  let response = await app->Fastify.inject({
    "method": method,
    "url": url,
    "headers": headers,
    "payload": body,
  })
  let text = response->Fastify.payload
  (response->Fastify.statusCode, text == "" ? JSON.Encode.null : JSON.parseExn(text))
}

let string = (json: JSON.t, key: string) => Json.string(json, key)->Option.getOr("")

let credentials = (email: string, password: string) =>
  JSON.Encode.object(
    Dict.fromArray([("email", JSON.Encode.string(email)), ("password", JSON.Encode.string(password))]),
  )

test("API", async () => {
  Dict.set(Env.env, "NODE_ENV", "test")
  let app = await Server.make()

  // health
  let (code, health) = await request(app, "/api/v1/health")
  equal(code, 200)
  equal(string(health, "status"), "healthy")

  // login with the seeded admin
  let (code, login) = await request(
    app,
    "/api/v1/auth/login",
    ~method="POST",
    ~body=credentials("admin@example.com", "admin123"),
  )
  equal(code, 200)
  let adminToken = string(login, "token")
  ok(String.length(adminToken) > 20)

  // wrong password
  let (code, _) = await request(
    app,
    "/api/v1/auth/login",
    ~method="POST",
    ~body=credentials("admin@example.com", "wrong"),
  )
  equal(code, 401)

  // register a regular user
  let (code, registered) = await request(
    app,
    "/api/v1/auth/register",
    ~method="POST",
    ~body=JSON.Encode.object(
      Dict.fromArray([
        ("email", JSON.Encode.string("user@example.com")),
        ("name", JSON.Encode.string("User")),
        ("password", JSON.Encode.string("secret123")),
      ]),
    ),
  )
  equal(code, 201)
  let userToken = string(registered, "token")

  // protected routes
  let (code, _) = await request(app, "/api/v1/auth/me")
  equal(code, 401)
  let (code, me) = await request(app, "/api/v1/auth/me", ~token=userToken)
  equal(code, 200)
  equal(string(me, "role"), "user")

  // products: anyone reads, admins write
  let (code, _) = await request(app, "/api/v1/products/1")
  equal(code, 200)
  let newProduct = JSON.Encode.object(
    Dict.fromArray([("name", JSON.Encode.string("Widget")), ("price", JSON.Encode.float(9.5))]),
  )
  let (code, _) = await request(
    app,
    "/api/v1/products",
    ~method="POST",
    ~body=newProduct,
    ~token=userToken,
  )
  equal(code, 403)
  let (code, _) = await request(
    app,
    "/api/v1/products",
    ~method="POST",
    ~body=newProduct,
    ~token=adminToken,
  )
  equal(code, 201)
  let (code, _) = await request(app, "/api/v1/products/999")
  equal(code, 404)
  let (code, _) = await request(app, "/api/v1/products/3", ~method="DELETE", ~token=adminToken)
  equal(code, 204)

  // graphql
  let (code, gql) = await request(
    app,
    "/graphql",
    ~method="POST",
    ~body=JSON.Encode.object(Dict.fromArray([("query", JSON.Encode.string("{ hello health }"))])),
  )
  equal(code, 200)
  equal(gql->Json.field("data")->Option.flatMap(data => Json.string(data, "health")), Some("healthy"))

  await app->Fastify.close
})
`}
};
