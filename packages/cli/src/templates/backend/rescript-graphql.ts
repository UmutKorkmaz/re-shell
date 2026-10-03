import { BackendTemplate } from '../types';

export const rescriptGraphqlTemplate: BackendTemplate = {
  id: 'rescript-graphql',
  name: 'rescript-graphql',
  displayName: 'ReScript + GraphQL + Apollo Server',
  description: 'Type-safe GraphQL API with ReScript, Apollo Server, and automatic type generation from schema',
  language: 'rescript',
  framework: 'graphql',
  version: '1.0.0',
  tags: ['rescript', 'graphql', 'apollo', 'type-safe', 'api', 'nodejs'],
  port: 4000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing', 'graphql'],

  files: {
    // Package.json
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "Type-safe GraphQL API with ReScript and Apollo Server",
  "scripts": {
    "dev": "rescript build -w",
    "build": "rescript build",
    "start": "node src/Main.bs.js",
    "server": "nodemon --watch src -e js,graphql --exec \\"node src/Main.bs.js\\"",
    "test": "rescript build && node --test src/__tests__/ApiTest.bs.js",
    "clean": "rescript clean",
    "format": "rescript format"
  },
  "dependencies": {
    "@apollo/server": "^4.9.0",
    "@rescript/core": "^1.3.0",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.4.5",
    "graphql": "^16.8.0",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "nodemon": "^3.1.0",
    "rescript": "^11.1.0"
  },
  "keywords": [
    "rescript",
    "graphql",
    "apollo",
    "api"
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

    // GraphQL schema
    'src/schema.graphql': `# GraphQL Schema for {{projectName}}

# Scalar types
scalar DateTime

# Enums
enum UserRole {
  ADMIN
  USER
  GUEST
}

enum ProductStatus {
  AVAILABLE
  OUT_OF_STOCK
  DISCONTINUED
}

# Types
type User {
  id: ID!
  name: String!
  email: String!
  role: UserRole!
  createdAt: DateTime!
  updatedAt: DateTime!
  products(cursor: String, limit: Int = 10): ProductConnection!
}

type Product {
  id: ID!
  name: String!
  description: String!
  price: Float!
  status: ProductStatus!
  user: User!
  createdAt: DateTime!
  updatedAt: DateTime!
}

# Connection types for pagination
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type ProductConnection {
  edges: [ProductEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ProductEdge {
  node: Product!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# Auth payload
type AuthPayload {
  token: String
  user: User
}

# Queries
type Query {
  # Health check
  health: String!

  # User queries
  me: User
  user(id: ID!): User
  users(limit: Int = 10, cursor: String): UserConnection!

  # Product queries
  product(id: ID!): Product
  products(limit: Int = 10, cursor: String): ProductConnection!
}

# Mutations
type Mutation {
  # Auth mutations
  register(name: String!, email: String!, password: String!): AuthPayload!
  login(email: String!, password: String!): AuthPayload!

  # Product mutations
  createProduct(name: String!, description: String!, price: Float!, status: ProductStatus!): Product!
  updateProduct(id: ID!, name: String, description: String, price: Float, status: ProductStatus): Product!
  deleteProduct(id: ID!): Boolean!
}
`,

    // Main server file
    'src/Server.res': `@module("node:fs") external readFileSync: (string, string) => string = "readFileSync"
@module("node:path") external join: (string, string) => string = "join"
@val external dirname: string = "__dirname"

/** The Apollo Server: schema from src/schema.graphql, resolvers in Resolvers.res. */
let make = (): Apollo.server =>
  Apollo.make({
    "typeDefs": readFileSync(join(dirname, "schema.graphql"), "utf8"),
    "resolvers": Resolvers.resolvers,
  })

let start = async (~port: int): string => {
  let server = make()
  let started = await Apollo.startStandaloneServer(
    server,
    {
      "listen": {"port": port},
      "context": async args =>
        Context.fromAuthorization(args["req"]["headers"]->Dict.get("authorization")),
    },
  )
  started["url"]
}
`,

    // Context module
    'src/Context.res': `/** Per-request GraphQL context. */
type t = {user: option<Types.claims>}

let fromAuthorization = (header: option<string>): t => {
  let token =
    header->Option.flatMap(h =>
      h->String.startsWith("Bearer ") ? Some(h->String.sliceToEnd(~start=7)) : None
    )
  {user: token->Option.flatMap(Auth.verifyToken)}
}

/** The authenticated user, or a GraphQL error. */
let requireUser = (ctx: t): Types.claims =>
  switch ctx.user {
  | Some(claims) => claims
  | None => Exn.raiseError("Not authenticated")
  }
`,

    // Data module with mock data
    'src/Data.res': `// In-memory data store: replace with a real database for production use.
open Types

let now = (): string => Date.make()->Date.toISOString

let users: array<user> = {
  let timestamp = now()
  [
    {
      id: "1",
      name: "Admin User",
      email: "admin@example.com",
      passwordHash: Auth.hashPassword("admin123"),
      role: "ADMIN",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
}

let products: array<product> = {
  let timestamp = now()
  [
    {
      id: "1",
      name: "Product 1",
      description: "First product",
      price: 99.99,
      status: "AVAILABLE",
      userId: "1",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "2",
      name: "Product 2",
      description: "Second product",
      price: 149.99,
      status: "AVAILABLE",
      userId: "1",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
}

let nextUserId = ref(2)
let nextProductId = ref(3)

let findUser = (id: string): option<user> => users->Array.find(u => u.id == id)

let findUserByEmail = (email: string): option<user> => users->Array.find(u => u.email == email)

let addUser = (~name: string, ~email: string, ~password: string): user => {
  let timestamp = now()
  let user: user = {
    id: Int.toString(nextUserId.contents),
    name,
    email,
    passwordHash: Auth.hashPassword(password),
    role: "USER",
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  nextUserId := nextUserId.contents + 1
  users->Array.push(user)
  user
}

let findProduct = (id: string): option<product> => products->Array.find(p => p.id == id)

let productsOf = (userId: string): array<product> => products->Array.filter(p => p.userId == userId)

let addProduct = (
  ~name: string,
  ~description: string,
  ~price: float,
  ~status: string,
  ~userId: string,
): product => {
  let timestamp = now()
  let product: product = {
    id: Int.toString(nextProductId.contents),
    name,
    description,
    price,
    status,
    userId,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  nextProductId := nextProductId.contents + 1
  products->Array.push(product)
  product
}

let updateProduct = (id: string, update: product => product): option<product> =>
  switch products->Array.findIndex(p => p.id == id) {
  | -1 => None
  | index => {
      let updated = {...update(products->Array.getUnsafe(index)), updatedAt: now()}
      products->Array.setUnsafe(index, updated)
      Some(updated)
    }
  }

let removeProduct = (id: string): bool =>
  switch products->Array.findIndex(p => p.id == id) {
  | -1 => false
  | index => {
      products->Array.splice(~start=index, ~remove=1, ~insert=[])
      true
    }
  }

// Cursor-based pagination: the cursor is the index of the last item of the previous page.
let paginate = (items: array<'a>, ~limit: int, ~cursor: option<string>) => {
  let total = Array.length(items)
  let start = cursor->Option.flatMap(c => Int.fromString(c))->Option.map(i => i + 1)->Option.getOr(0)
  let page = items->Array.slice(~start, ~end=start + limit)
  let edges = page->Array.mapWithIndex((node, i) => {"node": node, "cursor": Int.toString(start + i)})
  let lastIndex = start + Array.length(page) - 1
  {
    "edges": edges,
    "pageInfo": {
      "hasNextPage": lastIndex + 1 < total,
      "hasPreviousPage": start > 0,
      "startCursor": Array.length(page) > 0 ? Nullable.make(Int.toString(start)) : Nullable.null,
      "endCursor": Array.length(page) > 0 ? Nullable.make(Int.toString(lastIndex)) : Nullable.null,
    },
    "totalCount": total,
  }
}
`,

    // Auth module
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

    // Resolvers module
    'src/Resolvers.res': `open Types

let authPayload = (user: user) => {"token": Auth.generateToken(user), "user": user}

let canModify = (claims: claims, product: product) => product.userId == claims.sub || claims.role == "ADMIN"

let requireProduct = (id: string): product =>
  switch Data.findProduct(id) {
  | Some(product) => product
  | None => Exn.raiseError("Product not found")
  }

let resolvers = {
  "Query": {
    "health": (_parent: unit, _args: unit, _ctx: Context.t) => "healthy",
    "me": (_parent: unit, _args: unit, ctx: Context.t) =>
      ctx.user->Option.flatMap(claims => Data.findUser(claims.sub)),
    "user": (_parent: unit, args: {"id": string}, _ctx: Context.t) => Data.findUser(args["id"]),
    "users": (_parent: unit, args: {"limit": int, "cursor": Nullable.t<string>}, _ctx: Context.t) =>
      Data.paginate(Data.users, ~limit=args["limit"], ~cursor=args["cursor"]->Nullable.toOption),
    "product": (_parent: unit, args: {"id": string}, _ctx: Context.t) => Data.findProduct(args["id"]),
    "products": (_parent: unit, args: {"limit": int, "cursor": Nullable.t<string>}, _ctx: Context.t) =>
      Data.paginate(Data.products, ~limit=args["limit"], ~cursor=args["cursor"]->Nullable.toOption),
  },
  "Mutation": {
    "register": (
      _parent: unit,
      args: {"name": string, "email": string, "password": string},
      _ctx: Context.t,
    ) =>
      switch Data.findUserByEmail(args["email"]) {
      | Some(_) => Exn.raiseError("Email already registered")
      | None =>
        authPayload(Data.addUser(~name=args["name"], ~email=args["email"], ~password=args["password"]))
      },
    "login": (_parent: unit, args: {"email": string, "password": string}, _ctx: Context.t) =>
      switch Data.findUserByEmail(args["email"]) {
      | Some(user) if Auth.verifyPassword(args["password"], user.passwordHash) => authPayload(user)
      | _ => Exn.raiseError("Invalid credentials")
      },
    "createProduct": (
      _parent: unit,
      args: {"name": string, "description": string, "price": float, "status": string},
      ctx: Context.t,
    ) => {
      let claims = Context.requireUser(ctx)
      Data.addProduct(
        ~name=args["name"],
        ~description=args["description"],
        ~price=args["price"],
        ~status=args["status"],
        ~userId=claims.sub,
      )
    },
    "updateProduct": (
      _parent: unit,
      args: {
        "id": string,
        "name": Nullable.t<string>,
        "description": Nullable.t<string>,
        "price": Nullable.t<float>,
        "status": Nullable.t<string>,
      },
      ctx: Context.t,
    ) => {
      let claims = Context.requireUser(ctx)
      let existing = requireProduct(args["id"])
      if !canModify(claims, existing) {
        Exn.raiseError("Forbidden")
      } else {
        switch Data.updateProduct(args["id"], p => {
          ...p,
          name: args["name"]->Nullable.toOption->Option.getOr(p.name),
          description: args["description"]->Nullable.toOption->Option.getOr(p.description),
          price: args["price"]->Nullable.toOption->Option.getOr(p.price),
          status: args["status"]->Nullable.toOption->Option.getOr(p.status),
        }) {
        | Some(product) => product
        | None => Exn.raiseError("Product not found")
        }
      }
    },
    "deleteProduct": (_parent: unit, args: {"id": string}, ctx: Context.t) => {
      let claims = Context.requireUser(ctx)
      let existing = requireProduct(args["id"])
      if !canModify(claims, existing) {
        Exn.raiseError("Forbidden")
      } else {
        Data.removeProduct(args["id"])
      }
    },
  },
  "User": {
    "products": (user: user, args: {"limit": int, "cursor": Nullable.t<string>}, _ctx: Context.t) =>
      Data.paginate(
        Data.productsOf(user.id),
        ~limit=args["limit"],
        ~cursor=args["cursor"]->Nullable.toOption,
      ),
  },
  "Product": {
    "user": (product: product, _args: unit, _ctx: Context.t) => Data.findUser(product.userId),
  },
}
`,

    // Environment configuration
    '.env.example': `PORT=4000
NODE_ENV=development
JWT_SECRET=your-secret-key-here
GRAPHQL_PLAYGROUND=true`,

    // Git ignore
    '.gitignore': `# Compiled output
node_modules/
dist/
lib/
*.bs.js
*.bs.js.map

# Generated GraphQL types
src/graphql/types.res.ts
src/graphql/schema.res

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
coverage/
.nyc_output/`,

    // README
    'README.md': `# {{projectName}}

GraphQL API built with ReScript and Apollo Server 4.

## Features

- **ReScript**: compile-time type safety, in-place CommonJS output (\`src/*.bs.js\`)
- **Apollo Server 4**: standalone server with the Apollo landing page
- **Authentication**: JWT (\`jsonwebtoken\`) and password hashing (\`bcryptjs\`)
- **Pagination**: cursor-based connections for users and products
- **Tests**: ReScript tests on Node's built-in test runner (\`server.executeOperation\`, no network)

The in-memory store in \`src/Data.res\` stands in for a database. The standalone server has no
WebSocket transport, so the schema has queries and mutations only (no subscriptions).

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

## GraphQL Endpoint

The server listens on http://localhost:4000/ (\`PORT\` to change it). Open it in a browser for
Apollo's explorer. Authenticated operations send \`Authorization: Bearer <token>\`; the seeded admin
is \`admin@example.com\` / \`admin123\`.

## Example Queries

### Health Check
\`\`\`graphql
query {
  health
}
\`\`\`

### Get User
\`\`\`graphql
query {
  user(id: "1") {
    id
    name
    email
    role
  }
}
\`\`\`

### List Users with Pagination
\`\`\`graphql
query {
  users(limit: 10) {
    edges {
      node {
        id
        name
        email
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
\`\`\`

### Register
\`\`\`graphql
mutation {
  register(name: "John Doe", email: "john@example.com", password: "pass123") {
    token
    user {
      id
      name
      email
    }
  }
}
\`\`\`

## Project Structure

\`\`\`
src/
  schema.graphql     # the schema
  Resolvers.res      # resolvers
  Data.res           # in-memory data and pagination
  Context.res        # per-request context (the user behind the token)
  Auth.res           # JWT and password hashing
  Apollo.res         # Apollo Server bindings
  Server.res         # server construction and startup
  Main.res           # entry point (npm start runs src/Main.bs.js)
  __tests__/         # ReScript tests
rescript.json        # ReScript configuration
\`\`\`

## Changing the Schema

Edit \`src/schema.graphql\`, then add or adjust the matching resolver in \`src/Resolvers.res\`.

## License

MIT
`,

    'src/Apollo.res': `// Minimal Apollo Server 4 bindings
type server

@module("@apollo/server") @new
external make: {"typeDefs": string, "resolvers": 'resolvers} => server = "ApolloServer"

@module("@apollo/server/standalone")
external startStandaloneServer: (
  server,
  {
    "listen": {"port": int},
    "context": {"req": {"headers": Dict.t<string>}} => promise<Context.t>,
  },
) => promise<{"url": string}> = "startStandaloneServer"

@send external stop: server => promise<unit> = "stop"

/** Runs an operation without HTTP (used by the tests). */
@send
external executeOperation: (
  server,
  {"query": string, "variables": option<JSON.t>},
  {"contextValue": Context.t},
) => promise<{"body": {"singleResult": JSON.t}}> = "executeOperation"
`,

    'src/Env.res': `// Environment variables
@val external env: Dict.t<string> = "process.env"

let get = (key: string): option<string> => env->Dict.get(key)
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

let port = Env.get("PORT")->Option.flatMap(value => Int.fromString(value))->Option.getOr(4000)

Server.start(~port)
->Promise.then(url => {
  Console.log(\`GraphQL server ready at \${url}\`)
  Promise.resolve()
})
->Promise.catch(error => {
  Console.error2("Failed to start server:", error)
  Promise.resolve()
})
->ignore
`,

    'src/Types.res': `type user = {
  id: string,
  name: string,
  email: string,
  passwordHash: string,
  role: string,
  createdAt: string,
  updatedAt: string,
}

type product = {
  id: string,
  name: string,
  description: string,
  price: float,
  status: string,
  userId: string,
  createdAt: string,
  updatedAt: string,
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

let execute = async (
  server: Apollo.server,
  query: string,
  ~variables: option<JSON.t>=?,
  ~token: option<string>=?,
): JSON.t => {
  let header = token->Option.map(t => "Bearer " ++ t)
  let result = await server->Apollo.executeOperation(
    {"query": query, "variables": variables},
    {"contextValue": Context.fromAuthorization(header)},
  )
  result["body"]["singleResult"]
}

let data = (result: JSON.t, path: array<string>): option<JSON.t> =>
  path->Array.reduce(Json.field(result, "data"), (current, key) =>
    current->Option.flatMap(json => Json.field(json, key))
  )

let text = (result: JSON.t, path: array<string>): string =>
  data(result, path)->Option.flatMap(JSON.Decode.string)->Option.getOr("")

let hasErrors = (result: JSON.t): bool => Json.field(result, "errors")->Option.isSome

test("GraphQL API", async () => {
  let server = Server.make()

  // health
  let result = await execute(server, "{ health }")
  equal(text(result, ["health"]), "healthy")

  // login as the seeded admin
  let result = await execute(
    server,
    \`mutation { login(email: "admin@example.com", password: "admin123") { token user { name role } } }\`,
  )
  let adminToken = text(result, ["login", "token"])
  ok(String.length(adminToken) > 20)
  equal(text(result, ["login", "user", "role"]), "ADMIN")

  // wrong password is an error
  let result = await execute(
    server,
    \`mutation { login(email: "admin@example.com", password: "nope") { token } }\`,
  )
  ok(hasErrors(result))

  // register
  let result = await execute(
    server,
    \`mutation { register(name: "Jane", email: "jane@example.com", password: "secret123") { token user { id email } } }\`,
  )
  let userToken = text(result, ["register", "token"])
  ok(String.length(userToken) > 20)

  // me needs a token
  let result = await execute(server, "{ me { email } }")
  equal(data(result, ["me"]), Some(JSON.Encode.null))
  let result = await execute(server, "{ me { email } }", ~token=userToken)
  equal(text(result, ["me", "email"]), "jane@example.com")

  // products need an authenticated user to be created
  let create = \`mutation { createProduct(name: "Widget", description: "A widget", price: 9.5, status: AVAILABLE) { id name user { email } } }\`
  ok(hasErrors(await execute(server, create)))
  let result = await execute(server, create, ~token=userToken)
  equal(text(result, ["createProduct", "name"]), "Widget")
  equal(text(result, ["createProduct", "user", "email"]), "jane@example.com")
  let widgetId = text(result, ["createProduct", "id"])

  // only the owner (or an admin) may delete it
  let otherToken = text(
    await execute(
      server,
      \`mutation { register(name: "Joe", email: "joe@example.com", password: "secret123") { token } }\`,
    ),
    ["register", "token"],
  )
  let deleteQuery = \`mutation { deleteProduct(id: "\${widgetId}") }\`
  ok(hasErrors(await execute(server, deleteQuery, ~token=otherToken)))
  let result = await execute(server, deleteQuery, ~token=userToken)
  equal(data(result, ["deleteProduct"]), Some(JSON.Encode.bool(true)))

  // pagination
  let result = await execute(
    server,
    "{ products(limit: 1) { totalCount edges { cursor node { name } } pageInfo { hasNextPage endCursor } } }",
  )
  equal(data(result, ["products", "totalCount"]), Some(JSON.Encode.int(2)))
  equal(data(result, ["products", "pageInfo", "hasNextPage"]), Some(JSON.Encode.bool(true)))

  let result = await execute(
    server,
    \`{ products(limit: 5, cursor: "0") { edges { node { name user { name } } } } }\`,
  )
  ok(!hasErrors(result))

  await server->Apollo.stop
})
`}};
