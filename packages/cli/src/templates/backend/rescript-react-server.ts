import { BackendTemplate } from '../types';

export const rescriptReactServerTemplate: BackendTemplate = {
  id: 'rescript-react-server',
  name: 'rescript-react-server',
  displayName: 'ReScript + React Server Components',
  description: 'Type-safe React Server Components with ReScript, combining server-side rendering with type safety',
  language: 'rescript',
  framework: 'react-server',
  version: '1.0.0',
  tags: ['rescript', 'react', 'server-components', 'nodejs', 'type-safe', 'rest-api'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing', 'rest-api', 'graphql'],

  files: {
    // Package.json
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "ReScript + React server-side rendering with type safety",
  "scripts": {
    "dev": "rescript build -w",
    "build": "rescript build",
    "start": "node src/Main.bs.js",
    "server": "nodemon --watch src -e js --exec \\"node src/Main.bs.js\\"",
    "test": "rescript build && node --test src/__tests__/ApiTest.bs.js",
    "clean": "rescript clean",
    "format": "rescript format",
    "typecheck": "rescript build"
  },
  "dependencies": {
    "@rescript/core": "^1.3.0",
    "@rescript/react": "^0.12.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "graphql": "^16.8.1",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "morgan": "^1.10.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.0",
    "rescript": "^11.1.0"
  },
  "keywords": [
    "rescript",
    "react",
    "ssr",
    "express"
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
  "jsx": {
    "version": 4
  },
  "bs-dependencies": [
    "@rescript/core",
    "@rescript/react"
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
      "framework": "ReScript + React",
    })

  /** Renders a React component tree to an HTML page. */
  let home: Express.handler = (_req, res) => {
    let html = ReactDOMServer.renderToString(
      <Components.HomePage
        title="{{projectName}}"
        products=Store.products
        userCount={Array.length(Store.users)}
      />,
    )
    res->Express.setHeader("Content-Type", "text/html")
    res->Express.sendText("<!DOCTYPE html>" ++ html)
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

  let profile: Express.handler = (req, res) => {
    let claims: option<Types.claims> = req->Express.user->Nullable.toOption
    switch claims {
    | Some(c) => res->Express.sendJson({"userId": c.sub, "email": c.email, "role": c.role})
    | None => jsonError(res, 401, "Unauthorized")
    }
  }

  let listUsers: Express.handler = (_req, res) => {
    let users = Store.users->Array.map(publicUser)
    res->Express.sendJson({"data": users, "count": Array.length(users)})
  }

  let getUser: Express.handler = (req, res) =>
    switch req->Express.params->Dict.get("id") {
    | Some(id) =>
      switch Store.users->Array.find(u => u.id == id) {
      | Some(user) => res->Express.sendJson(publicUser(user))
      | None => jsonError(res, 404, "User not found")
      }
    | None => jsonError(res, 400, "Invalid user id")
    }

  let listProducts: Express.handler = (_req, res) =>
    res->Express.sendJson({"data": Store.products, "count": Array.length(Store.products)})
}

/** Builds the Express application (does not listen). */
let make = (): Express.app => {
  let app = Express.make()

  app->Express.use(Express.helmet())
  app->Express.use(Express.cors())
  app->Express.use(Express.jsonBody())
  app->Express.use(Express.staticFiles("public"))
  if Env.get("NODE_ENV") != Some("test") {
    app->Express.use(Express.morgan("combined"))
  }

  app->Express.get("/", Routes.home)
  app->Express.get("/health", Routes.health)

  // GraphQL endpoint
  app->Express.post("/graphql", graphqlHandler)
  app->Express.get("/graphql", graphqlHandler)

  // API routes
  app->Express.post("/api/v1/auth/login", Routes.login)
  app->Express.getWith("/api/v1/profile", requireUser, Routes.profile)
  app->Express.getWith("/api/v1/users", requireAdmin, Routes.listUsers)
  app->Express.getWith("/api/v1/users/:id", requireAdmin, Routes.getUser)
  app->Express.get("/api/v1/products", Routes.listProducts)

  app->Express.get("*", (req, res) =>
    res->Express.status(404)->Express.sendJson({"error": "Not found", "path": req->Express.path})
  )

  // Error handling
  app->Express.useErrorHandler((err, _req, res, _next) => {
    Console.error2("Error:", err)
    jsonError(res, 500, "Internal server error")
  })

  app
}
`,

    // GraphQL schema and resolvers (graphql-yoga)
    'src/graphqlSchema.js': `const typeDefs = \`
  type Query {
    hello: String!
    health: String!
  }
\`;

const rootValue = {
  hello: () => 'Hello from ReScript React Server GraphQL!',
  health: () => 'healthy',
};

module.exports = { typeDefs, rootValue };
`,

    // GraphQL Yoga handler (JS interop) for Express
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

    // Environment configuration
    '.env.example': `PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-here
DATABASE_URL=your-database-url-here`,

    // Git ignore
    '.gitignore': `# Compiled output
node_modules/
dist/
lib/
*.bs.js
*.bs.js.map

# Environment
.env
.env.local
.env.*.local

# Logs
logs
*.log
npm-debug.log*

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/`,

    // README
    'README.md': `# {{projectName}}

ReScript + React with server-side rendering, on Express. Pages are React components written in
ReScript (JSX v4) and rendered to HTML on the server; the API is plain Express with JWT auth.

## Features

- **ReScript**: compile-time type safety, in-place CommonJS output (\`src/*.bs.js\`)
- **React SSR**: \`ReactDOMServer.renderToString\` with \`@rescript/react\` components
- **Authentication**: JWT (\`jsonwebtoken\`) and password hashing (\`bcryptjs\`)
- **Security and logging**: Helmet, CORS, Morgan
- **GraphQL**: \`POST /graphql\` with \`{ hello health }\` (graphql-js)
- **Tests**: ReScript tests on Node's built-in test runner

React Server Components in the Next.js sense (a Flight stream plus a client bundle) need a bundler;
this template renders components to HTML on the server only, so they carry no hooks or effects.

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Build (compiles in place to src/*.bs.js)
npm run build

# Start the server
npm start

# Run tests
npm test
\`\`\`

Watch mode: \`npm run dev\` (recompiles) and \`npm run server\` (restarts on change).

## API Endpoints

| Endpoint | Description |
| --- | --- |
| \`GET /\` | server-rendered home page |
| \`GET /health\` | health check |
| \`POST /api/v1/auth/login\` | \`{ "email", "password" }\`, returns a JWT |
| \`GET /api/v1/profile\` | current user (bearer token required) |
| \`GET /api/v1/users\`, \`GET /api/v1/users/:id\` | users (admin only) |
| \`GET /api/v1/products\` | products |
| \`POST /graphql\` | GraphQL (\`{ hello health }\`) |

\`\`\`bash
curl -X POST http://localhost:3000/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@example.com","password":"admin123"}'
\`\`\`

## Project Structure

\`\`\`
src/
  Main.res           # Entry point (npm start runs src/Main.bs.js)
  Server.res         # Express app and routes
  Components.res     # React components (rendered on the server)
  Express.res        # Express bindings
  Auth.res           # JWT and password hashing
  Store.res          # In-memory data store
  Types.res          # Type definitions
  graphqlHandler.js  # GraphQL endpoint (graphql-js)
  __tests__/         # ReScript tests
public/styles.css    # static assets
rescript.json        # ReScript configuration (JSX v4)
\`\`\`

## Configuration

Copy \`.env.example\` to \`.env\`: \`PORT\`, \`JWT_SECRET\` (change it in production).

## License

MIT
`,

    'public/styles.css': `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: #333;
}

p {
  font-size: 1.1rem;
  line-height: 1.6;
  color: #666;
  margin-bottom: 1rem;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}

.feature-card {
  padding: 1.5rem;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
}

.feature-card h3 {
  margin-bottom: 0.5rem;
  color: #333;
}
`,

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

    'src/Components.res': `// React components, rendered to HTML on the server (no hooks or effects: they never run in the browser)
module Layout = {
  @react.component
  let make = (~title: string, ~children: React.element) =>
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title> {React.string(title)} </title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <div className="container"> children </div>
      </body>
    </html>
}

module ProductCard = {
  @react.component
  let make = (~product: Types.product) =>
    <div className="feature-card">
      <h3> {React.string(product.name)} </h3>
      <p> {React.string(product.description)} </p>
      <p> {React.string("$" ++ Float.toFixed(product.price, ~digits=2))} </p>
    </div>
}

module HomePage = {
  @react.component
  let make = (~title: string, ~products: array<Types.product>, ~userCount: int) =>
    <Layout title>
      <h1> {React.string(title)} </h1>
      <p> {React.string("React components written in ReScript, rendered on the server.")} </p>
      <p> {React.string(\`\${Int.toString(userCount)} registered users\`)} </p>
      <div className="features">
        {products
        ->Array.map(product => <ProductCard key={Int.toString(product.id)} product />)
        ->React.array}
      </div>
    </Layout>
}
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

@module("express") external staticFiles: string => middleware = "static"

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
  Console.log(\`Health check: http://localhost:\${Int.toString(port)}/health\`)
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

    'src/__tests__/ApiTest.res': `// Run with: npm test (node's built-in test runner)
@module("node:test") external test: (string, unit => promise<unit>) => unit = "test"
@module("node:assert/strict") external equal: ('a, 'a) => unit = "equal"
@module("node:assert/strict") external ok: bool => unit = "ok"

type response
@val external fetch: (string, 'options) => promise<response> = "fetch"
@get external status: response => int = "status"
@send external json: response => promise<JSON.t> = "json"
@send external text: response => promise<string> = "text"

let get = async (base: string, path: string, ~token: option<string>=?): response => {
  let headers = Dict.make()
  switch token {
  | Some(t) => headers->Dict.set("authorization", "Bearer " ++ t)
  | None => ()
  }
  await fetch(base ++ path, {"headers": headers})
}

let string = (json: JSON.t, key: string) => Json.string(json, key)->Option.getOr("")

test("API and server-rendered pages", async () => {
  Dict.set(Env.env, "NODE_ENV", "test")
  let server = await Server.make()->Express.listenAsync(0)
  let address = Express.address(server)
  let base = \`http://127.0.0.1:\${Int.toString(address["port"])}\`

  // health
  let response = await get(base, "/health")
  equal(response->status, 200)
  equal(string(await response->json, "status"), "healthy")

  // the home page is rendered by React on the server
  let response = await get(base, "/")
  equal(response->status, 200)
  let html = await response->text
  ok(String.startsWith(html, "<!DOCTYPE html>"))
  ok(String.includes(html, "Sample Product 1"))

  // static assets
  let response = await get(base, "/styles.css")
  equal(response->status, 200)

  // login as the seeded admin
  let response = await fetch(
    base ++ "/api/v1/auth/login",
    {
      "method": "POST",
      "headers": Dict.fromArray([("content-type", "application/json")]),
      "body": JSON.stringify(
        JSON.Encode.object(
          Dict.fromArray([
            ("email", JSON.Encode.string("admin@example.com")),
            ("password", JSON.Encode.string("admin123")),
          ]),
        ),
      ),
    },
  )
  equal(response->status, 200)
  let token = string(await response->json, "token")
  ok(String.length(token) > 20)

  // protected routes
  let response = await get(base, "/api/v1/users")
  equal(response->status, 401)
  let response = await get(base, "/api/v1/users", ~token)
  equal(response->status, 200)
  let response = await get(base, "/api/v1/profile", ~token)
  equal(response->status, 200)
  equal(string(await response->json, "role"), "admin")

  // products are public
  let response = await get(base, "/api/v1/products")
  equal(response->status, 200)

  // graphql
  let response = await fetch(
    base ++ "/graphql",
    {
      "method": "POST",
      "headers": Dict.fromArray([("content-type", "application/json")]),
      "body": JSON.stringify(
        JSON.Encode.object(Dict.fromArray([("query", JSON.Encode.string("{ hello health }"))])),
      ),
    },
  )
  equal(response->status, 200)
  let gql = await response->json
  equal(gql->Json.field("data")->Option.flatMap(data => Json.string(data, "health")), Some("healthy"))

  // unknown routes
  let response = await get(base, "/nope")
  equal(response->status, 404)

  await Promise.make((resolve, _) => server->Express.close(() => resolve()))
})
`}};
