import { BackendTemplate } from '../types';

export const rescriptExpressTemplate: BackendTemplate = {
  id: 'rescript-express',
  name: 'rescript-express',
  displayName: 'ReScript + Express',
  description: 'Type-safe ReScript bindings for Express.js with compile-time guarantees and excellent performance',
  language: 'rescript',
  framework: 'express',
  version: '1.0.0',
  tags: ['rescript', 'express', 'nodejs', 'type-safe', 'functional', 'ocaml'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing', 'graphql'],

  files: {
    // Package.json
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "ReScript + Express API server with type safety",
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
    "@rescript/core": "^1.3.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "graphql": "^16.8.1",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "morgan": "^1.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.0",
    "rescript": "^11.1.0"
  },
  "keywords": [
    "rescript",
    "express",
    "api",
    "rest"
  ],
  "author": "re-shell",
  "license": "MIT"
}
`,

    // ReScript configuration
    // ReScript resolves bs-dependencies through plain node_modules paths, which pnpm's isolated layout hides
    '.npmrc': `node-linker=hoisted\n`,

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
    'src/Server.res': `let jsonError = (res: Express.res, status: int, message: string) =>
  res->Express.status(status)->Express.sendJson({"error": message})

let publicUser = (u: Types.user) => {"id": u.id, "email": u.email, "name": u.name, "role": u.role}

let bearerToken = (req: Express.req): option<string> =>
  req
  ->Express.header("authorization")
  ->Nullable.toOption
  ->Option.flatMap(header =>
    header->String.startsWith("Bearer ") ? Some(header->String.sliceToEnd(~start=7)) : None
  )

// Middleware
let requireUser: Express.middleware = (req, res, next) =>
  switch bearerToken(req)->Option.flatMap(Auth.verifyToken) {
  | Some(claims) => {
      req->Express.setUser(claims)
      next()
    }
  | None => jsonError(res, 401, "Unauthorized")
  }

let requireAdmin: Express.middleware = (req, res, next) =>
  requireUser(req, res, () => {
    let claims: option<Types.claims> = req->Express.user->Nullable.toOption
    switch claims {
    | Some({role: "admin"}) => next()
    | _ => jsonError(res, 403, "Admin role required")
    }
  })

@module external graphqlHandler: Express.handler = "./graphqlHandler.js"

// Routes
module Routes = {
  let health: Express.handler = (_req, res) =>
    res->Express.sendJson({
      "status": "healthy",
      "timestamp": Date.now(),
      "version": "1.0.0",
    })

  let home: Express.handler = (_req, res) => {
    res->Express.setHeader("Content-Type", "text/html")
    res->Express.sendText(\`<!DOCTYPE html>
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
    <p>Type-safe API built with ReScript and Express</p>
    <p>API available at: <a href="/api/v1/health">/api/v1/health</a></p>
  </body>
</html>\`)
  }

  let register: Express.handler = (req, res) => {
    let body = Express.body(req)
    switch (Json.string(body, "email"), Json.string(body, "name"), Json.string(body, "password")) {
    | (Some(email), Some(name), Some(password)) if String.length(password) >= 6 =>
      switch Store.findUserByEmail(email) {
      | Some(_) => jsonError(res, 409, "Email already registered")
      | None => {
          let user = Store.addUser(~email, ~name, ~password, ~role="user")
          res
          ->Express.status(201)
          ->Express.sendJson({"token": Auth.generateToken(user), "user": publicUser(user)})
        }
      }
    | _ => jsonError(res, 400, "email, name and a password of at least 6 characters are required")
    }
  }

  let login: Express.handler = (req, res) => {
    let body = Express.body(req)
    switch (Json.string(body, "email"), Json.string(body, "password")) {
    | (Some(email), Some(password)) =>
      switch Store.findUserByEmail(email) {
      | Some(user) if Auth.verifyPassword(password, user.passwordHash) =>
        res->Express.sendJson({"token": Auth.generateToken(user), "user": publicUser(user)})
      | _ => jsonError(res, 401, "Invalid credentials")
      }
    | _ => jsonError(res, 400, "email and password are required")
    }
  }

  let me: Express.handler = (req, res) => {
    let claims: option<Types.claims> = req->Express.user->Nullable.toOption
    switch claims {
    | Some(c) => res->Express.sendJson({"userId": c.sub, "email": c.email, "role": c.role})
    | None => jsonError(res, 401, "Unauthorized")
    }
  }

  let listProducts: Express.handler = (_req, res) =>
    res->Express.sendJson({"products": Store.products, "count": Array.length(Store.products)})

  let withProductId = (req: Express.req, res: Express.res, found: Types.product => unit) =>
    switch req->Express.params->Dict.get("id")->Option.flatMap(id => Int.fromString(id)) {
    | None => jsonError(res, 400, "Invalid product id")
    | Some(id) =>
      switch Store.findProduct(id) {
      | Some(product) => found(product)
      | None => jsonError(res, 404, "Product not found")
      }
    }

  let getProduct: Express.handler = (req, res) =>
    withProductId(req, res, product => res->Express.sendJson({"product": product}))

  let createProduct: Express.handler = (req, res) => {
    let body = Express.body(req)
    switch (Json.string(body, "name"), Json.float(body, "price")) {
    | (Some(name), Some(price)) => {
        let product = Store.addProduct(
          ~name,
          ~description=Json.string(body, "description")->Option.getOr(""),
          ~price,
          ~stock=Json.float(body, "stock")->Option.map(Float.toInt)->Option.getOr(0),
        )
        res->Express.status(201)->Express.sendJson({"product": product})
      }
    | _ => jsonError(res, 400, "name and price are required")
    }
  }

  let updateProduct: Express.handler = (req, res) =>
    withProductId(req, res, existing => {
      let body = Express.body(req)
      let updated = Store.updateProduct(existing.id, p => {
        ...p,
        name: Json.string(body, "name")->Option.getOr(p.name),
        description: Json.string(body, "description")->Option.getOr(p.description),
        price: Json.float(body, "price")->Option.getOr(p.price),
        stock: Json.float(body, "stock")->Option.map(Float.toInt)->Option.getOr(p.stock),
      })
      res->Express.sendJson({"product": updated})
    })

  let deleteProduct: Express.handler = (req, res) =>
    withProductId(req, res, product => {
      let _ = Store.removeProduct(product.id)
      res->Express.sendStatus(204)
    })
}

/** Builds the Express application (does not listen). */
let make = (): Express.app => {
  let app = Express.make()

  app->Express.use(Express.helmet())
  app->Express.use(Express.cors())
  app->Express.use(Express.jsonBody())
  if Env.get("NODE_ENV") != Some("test") {
    app->Express.use(Express.morgan("combined"))
  }

  app->Express.get("/", Routes.home)

  // API routes
  app->Express.get("/api/v1/health", Routes.health)
  app->Express.post("/api/v1/auth/register", Routes.register)
  app->Express.post("/api/v1/auth/login", Routes.login)
  app->Express.getWith("/api/v1/auth/me", requireUser, Routes.me)
  app->Express.get("/api/v1/products", Routes.listProducts)
  app->Express.get("/api/v1/products/:id", Routes.getProduct)
  app->Express.postWith("/api/v1/products", requireAdmin, Routes.createProduct)
  app->Express.putWith("/api/v1/products/:id", requireAdmin, Routes.updateProduct)
  app->Express.deleteWith("/api/v1/products/:id", requireAdmin, Routes.deleteProduct)

  // GraphQL endpoint
  app->Express.post("/graphql", graphqlHandler)
  app->Express.get("/graphql", graphqlHandler)

  app->Express.get("*", (_req, res) => jsonError(res, 404, "Not found"))

  // Error handling
  app->Express.useErrorHandler((err, _req, res, _next) => {
    Console.error2("Error:", err)
    jsonError(res, 500, "Internal server error")
  })

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
    'src/Auth.res': `@module("jsonwebtoken") external sign: (Types.claims, string, {"expiresIn": string}) => string = "sign"
@module("jsonwebtoken") external verify: (string, string) => Types.claims = "verify"
@module("bcryptjs") external hashSync: (string, int) => string = "hashSync"
@module("bcryptjs") external compareSync: (string, string) => bool = "compareSync"

let secret = (): string => Env.get("JWT_SECRET")->Option.getOr("change-this-secret-in-production")

let hashPassword = (password: string): string => hashSync(password, 10)

let verifyPassword = (password: string, hash: string): bool => compareSync(password, hash)

let generateToken = (user: Types.user): string =>
  sign({sub: user.id, email: user.email, role: user.role}, secret(), {"expiresIn": "7d"})

/** The claims inside a valid token, or None for a missing, expired or forged one. */
let verifyToken = (token: string): option<Types.claims> =>
  switch verify(token, secret()) {
  | claims => Some(claims)
  | exception _ => None
  }
`,

    // Apollo Server handler (JS interop layer)
    'src/graphqlHandler.js': `const { graphql, buildSchema } = require('graphql');
const { typeDefs, rootValue } = require('./graphqlSchema');

const schema = buildSchema(typeDefs);

// Express handler: POST /graphql with {query, variables, operationName}, or GET /graphql?query=...
module.exports = async (req, res) => {
  const input = req.method === 'GET' ? req.query : req.body;
  if (!input || typeof input.query !== 'string') {
    res.status(400).json({ errors: [{ message: 'A GraphQL query is required' }] });
    return;
  }

  const result = await graphql({
    schema,
    source: input.query,
    rootValue,
    variableValues: input.variables,
    operationName: input.operationName,
  });
  res.status(200).json(result);
};
`,

    // GraphQL schema and resolvers (JS)
    'src/graphqlSchema.js': `const typeDefs = \`
  type Query {
    hello: String!
    health: String!
  }
\`;

const rootValue = {
  hello: () => 'Hello from ReScript Express GraphQL!',
  health: () => 'healthy',
};

module.exports = { typeDefs, rootValue };
`,

    // Environment file
    '.env.example': `# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Secret (change in production!)
JWT_SECRET=change-this-secret-in-production
JWT_EXPIRATION=604800

# Database (for future use)
# DATABASE_URL=postgresql://user:password@localhost:5432/{{projectName}}

# Redis (for future use)
# REDIS_URL=redis://localhost:6379`,

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
    restart: unless-stopped`,

    // README
    'README.md': `# {{projectName}}

Type-safe API server built with ReScript and Express.js.

## Features

- **ReScript**: Type-safe JavaScript with compile-time guarantees
- **Express**: Fast, minimalist web framework for Node.js
- **Type Safety**: Compile-time type checking eliminates runtime errors
- **Functional**: Immutable data structures and pure functions
- **Fast**: Optimized JavaScript output with excellent performance
- **Simple**: Clean syntax with powerful pattern matching

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
- \`POST /graphql\` - \`{ hello health }\` (graphql-js)

## Default Credentials

- Email: \`admin@example.com\`
- Password: \`admin123\`

## Project Structure

\`\`\`
src/
  Main.res           # Entry point (npm start runs src/Main.bs.js)
  Server.res         # Express app and routes
  Express.res        # Express bindings
  Auth.res           # JWT and password hashing (jsonwebtoken, bcryptjs)
  Store.res          # In-memory data store
  Types.res          # Type definitions
  graphqlHandler.js  # GraphQL endpoint (graphql-js)
  __tests__/         # ReScript tests
rescript.json        # ReScript configuration
package.json         # Dependencies and scripts
\`\`\`

## ReScript Features

- **Type Inference**: Most types inferred automatically
- **Pattern Matching**: Powerful destructuring and matching
- **Variants**: Type-safe enums and data structures
- **Interop**: Seamless JavaScript interop
- **Belt**: Standard library with functional utilities
- **Pipe Operator**: Clean data transformations

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

Tests are written in ReScript (\`src/__tests__/ApiTest.res\`) and run with Node's built-in test runner against a server on a random port:

\`\`\`bash
npm test
\`\`\`

## ## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 3000:3000 {{projectName}}
\`\`\`

Or with Docker Compose:

\`\`\`bash
docker-compose up
\`\`\`

## Why ReScript?

- **Type Safety**: Catch errors at compile time, not runtime
- **Great Performance**: Optimized JavaScript output
- **JavaScript Interop**: Use any JavaScript library
- **Fast Compile**: Sub-second compilation times
- **Simple Syntax**: Easy to learn, powerful to use
- **Immutable**: Default immutable data structures
- **Pattern Matching**: Expressive code with less bugs

## License

MIT
`,

    'src/Env.res': `// Environment variables
@val external env: Dict.t<string> = "process.env"

let get = (key: string): option<string> => env->Dict.get(key)
`,

    'src/Express.res': `// Minimal Express bindings
type app
type server
type req
type res
type next = unit => unit
type handler = (req, res) => unit
type middleware = (req, res, next) => unit

@module external make: unit => app = "express"
@module("express") external jsonBody: unit => middleware = "json"

@send external use: (app, middleware) => unit = "use"
@send external useAt: (app, string, middleware) => unit = "use"
@send external get: (app, string, handler) => unit = "get"
@send external getWith: (app, string, middleware, handler) => unit = "get"
@send external post: (app, string, handler) => unit = "post"
@send external postWith: (app, string, middleware, handler) => unit = "post"
@send external put: (app, string, handler) => unit = "put"
@send external putWith: (app, string, middleware, handler) => unit = "put"
@send external delete: (app, string, handler) => unit = "delete"
@send external deleteWith: (app, string, middleware, handler) => unit = "delete"
@send external useErrorHandler: (app, (Exn.t, req, res, next) => unit) => unit = "use"

@send external listen: (app, int, unit => unit) => server = "listen"
@send external listenOn: (app, int) => server = "listen"
@send external once: (server, string, unit => unit) => unit = "once"
@send external close: (server, unit => unit) => unit = "close"
@send external address: server => {"port": int} = "address"

@send external status: (res, int) => res = "status"
@send external sendJson: (res, 'a) => unit = "json"
@send external sendText: (res, string) => unit = "send"
@send external setHeader: (res, string, string) => unit = "setHeader"
@send external sendStatus: (res, int) => unit = "sendStatus"

@get external body: req => JSON.t = "body"
@get external params: req => Dict.t<string> = "params"
@get external query: req => Dict.t<string> = "query"
@get external httpMethod: req => string = "method"
@get external path: req => string = "path"
@send external header: (req, string) => Nullable.t<string> = "get"

// Per-request data set by middleware
@set external setUser: (req, 'a) => unit = "user"
@get external user: req => Nullable.t<'a> = "user"

/** Starts listening and resolves once the server accepts connections (port 0 picks a free port). */
let listenAsync = (app: app, port: int): promise<server> =>
  Promise.make((resolve, _reject) => {
    let server = app->listenOn(port)
    server->once("listening", () => resolve(server))
  })

// Middleware packages
@module external cors: unit => middleware = "cors"
@module external helmet: unit => middleware = "helmet"
@module external morgan: string => middleware = "morgan"
`,

    'src/Json.res': `// Helpers for reading values out of a parsed JSON request body
let field = (json: JSON.t, key: string): option<JSON.t> =>
  json->JSON.Decode.object->Option.flatMap(fields => fields->Dict.get(key))

let string = (json: JSON.t, key: string): option<string> =>
  field(json, key)->Option.flatMap(JSON.Decode.string)

let float = (json: JSON.t, key: string): option<float> =>
  field(json, key)->Option.flatMap(JSON.Decode.float)
`,

    'src/Main.res': `@module("dotenv") external loadEnv: unit => unit = "config"

loadEnv()

let port = Env.get("PORT")->Option.flatMap(value => Int.fromString(value))->Option.getOr(3000)

let _ = Server.make()->Express.listen(port, () => {
  Console.log(\`Server running at http://localhost:\${Int.toString(port)}\`)
  Console.log(\`API: http://localhost:\${Int.toString(port)}/api/v1/health\`)
})
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

type response
@val external fetch: (string, 'options) => promise<response> = "fetch"
@get external status: response => int = "status"
@send external json: response => promise<JSON.t> = "json"

let request = async (
  base: string,
  path: string,
  ~method="GET",
  ~body: option<JSON.t>=?,
  ~token: option<string>=?,
): (int, JSON.t) => {
  let headers = Dict.fromArray([("content-type", "application/json")])
  switch token {
  | Some(t) => headers->Dict.set("authorization", "Bearer " ++ t)
  | None => ()
  }
  let response = await fetch(
    base ++ path,
    {
      "method": method,
      "headers": headers,
      "body": body->Option.map(b => JSON.stringify(b)),
    },
  )
  (response->status, await response->json)
}

let string = (json: JSON.t, key: string) => Json.string(json, key)->Option.getOr("")

test("API", async () => {
  Dict.set(Env.env, "NODE_ENV", "test")
  let server = await Server.make()->Express.listenAsync(0)
  let address = Express.address(server)
  let base = \`http://127.0.0.1:\${Int.toString(address["port"])}\`

  // health
  let (code, health) = await request(base, "/api/v1/health")
  equal(code, 200)
  equal(string(health, "status"), "healthy")

  // login with the seeded admin
  let (code, login) = await request(
    base,
    "/api/v1/auth/login",
    ~method="POST",
    ~body=JSON.Encode.object(
      Dict.fromArray([
        ("email", JSON.Encode.string("admin@example.com")),
        ("password", JSON.Encode.string("admin123")),
      ]),
    ),
  )
  equal(code, 200)
  let adminToken = string(login, "token")
  ok(String.length(adminToken) > 20)

  // wrong password
  let (code, _) = await request(
    base,
    "/api/v1/auth/login",
    ~method="POST",
    ~body=JSON.Encode.object(
      Dict.fromArray([
        ("email", JSON.Encode.string("admin@example.com")),
        ("password", JSON.Encode.string("wrong")),
      ]),
    ),
  )
  equal(code, 401)

  // register a regular user
  let (code, registered) = await request(
    base,
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
  let (code, _) = await request(base, "/api/v1/auth/me")
  equal(code, 401)
  let (code, me) = await request(base, "/api/v1/auth/me", ~token=userToken)
  equal(code, 200)
  equal(string(me, "role"), "user")

  // products: anyone reads, admins write
  let (code, _) = await request(base, "/api/v1/products/1")
  equal(code, 200)
  let newProduct = JSON.Encode.object(
    Dict.fromArray([("name", JSON.Encode.string("Widget")), ("price", JSON.Encode.float(9.5))]),
  )
  let (code, _) = await request(
    base,
    "/api/v1/products",
    ~method="POST",
    ~body=newProduct,
    ~token=userToken,
  )
  equal(code, 403)
  let (code, _) = await request(
    base,
    "/api/v1/products",
    ~method="POST",
    ~body=newProduct,
    ~token=adminToken,
  )
  equal(code, 201)
  let (code, _) = await request(base, "/api/v1/products/999")
  equal(code, 404)

  // graphql
  let (code, gql) = await request(
    base,
    "/graphql",
    ~method="POST",
    ~body=JSON.Encode.object(
      Dict.fromArray([("query", JSON.Encode.string("{ hello health }"))]),
    ),
  )
  equal(code, 200)
  equal(gql->Json.field("data")->Option.flatMap(data => Json.string(data, "health")), Some("healthy"))

  await Promise.make((resolve, _) => server->Express.close(() => resolve()))
})
`}
};
