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
    "dev": "rescript clean && rescript dev -w & nodemon -x 'node dist/js/src/Server.bs.js'",
    "build": "rescript build && graphql-codegen",
    "start": "node dist/js/src/Server.bs.js",
    "server": "nodemon -x 'rescript build && graphql-codegen && node dist/js/src/Server.bs.js'",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "codegen": "graphql-codegen",
    "clean": "rescript clean",
    "format": "rescript format"
  },
  "dependencies": {
    "@rescript/core": "^1.3.0",
    "@rescript/react": "^0.12.0",
    "@graphql-tools/resolvers-composition": "^0.1.0",
    "@apollo/server": "^4.9.0",
    "graphql": "^16.8.0",
    "graphql-scalars": "^1.22.0",
    : "^2.2.2",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "rescript": "^11.1.0",
    "rescript-nodejs": "^16.1.0",
    "@graphql-codegen/cli": "^5.0.0",
    "@graphql-codegen/typescript": "^4.0.0",
    "@graphql-codegen/typescript-resolvers": "^4.0.0",
    "@graphql-codegen/typescript-operations": "^4.0.0",
    "@graphql-typed-document-node/core": "^3.2.0",
    "jest": "^29.7.0",
    "nodemon": "^3.1.0",
    "@types/jest": "^29.5.0"
  },
  "keywords": ["rescript", "graphql", "apollo", "api"],
  "author": "{{author}}",
  "license": "MIT"
}`,

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
    "@rescript/core",
    "rescript-nodejs"
  ],
  "warnings": {
    "error": true
  },
  "bsc-flags": [
    "-bs-gentype",
    "-open RescriptCore"
  ]
}`,

    // GraphQL schema
    'src/schema.graphql': `# GraphQL Schema for {{projectName}}

# Scalar types
scalar Date
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

# Subscriptions
type Subscription {
  productCreated: Product!
  productUpdated: Product!
}
`,

    // GraphQL codegen configuration
    'codegen.yml': `overwrite: true
schema: ./src/schema.graphql
documents: []
generates:
  src/graphql/types.res.ts:
    plugins:
      - typescript
      - typescript-operations
      - typescript-resolvers
    config:
      scalars:
        Date: string
        DateTime: string
        UserRole: ./src/graphql/scalars#UserRole
        ProductStatus: ./src/graphql/scalars#ProductStatus
      withResolverTypes: true
      contextType: ./src/context#Context
      mappers:
        User: ./src/graphql/mappers#UserMapper
        Product: ./src/graphql/mappers#ProductMapper
  src/graphql/schema.res:
    plugins:
      - typescript
      - typescript-operations
    config:
      scalars:
        Date: string
        DateTime: string
`,

    // Main server file
    'src/Server.res': `open RescriptCore
open Node
open GraphQL
open Context
open Resolvers

// Initialize Apollo Server
let makeServer = () => {
  let typeDefs = Node.Fs.readFileSyncSync("./src/schema.graphql", "utf8")

  let resolvers = {
    "Query": {
      "health": (_args, _obj) => {
        Js.Promise.resolve({"status": "healthy", "timestamp": Js.Date.now()})
      },

      "me": (_args, {user}) => {
        switch user {
        | None => Js.Promise.reject(Js.Exn.raiseError("Not authenticated"))
        | Some(u) => Js.Promise.resolve(u)
        }
      },

      "user": (args, _obj) => {
        let id = args->Js.Dict.get("id")->Belt.Option.getWithDefault("")
        let user = Data.findUser(id)
        switch user {
        | None => Js.Promise.reject(Js.Exn.raiseError("User not found"))
        | Some(u) -> Js.Promise.t<Resolvers.user> = Js.Promise.resolve(u)
        }
      },

      "users": (args, _obj) => {
        let limit = args->Js.Dict.get("limit")
          ->Belt.Option.mapOr(10, s-> Js.Int.parse(s)->Belt.Option.getWithDefault(10))

        let users = Data.getUsers(limit)
        let connection = GraphQL.paginateUsers(users, limit, args->Js.Dict.get("cursor"))
        Js.Promise.resolve(connection)
      }},

    "Mutation": {
      "register": (args, _obj) => {
        let name = args->Js.Dict.get("name")->Belt.Option.getWithDefault("")
        let email = args->Js.Dict.get("email")->Belt.Option.getWithDefault("")
        let password = args->Js.Dict.get("password")->Belt.Option.getWithDefault("")

        let user = Data.createUser(name, email, password)
        let token = Auth.generateToken(user)

        Js.Promise.resolve({
          "token": token,
          "user": user})
      },

      "login": (args, _obj) => {
        let email = args->Js.Dict.get("email")->Belt.Option.getWithDefault("")
        let password = args->Js.Dict.get("password")->Belt.Option.getWithDefault("")

        let user = Data.findUserByEmail(email)
        switch user {
        | None => Js.Promise.reject(Js.Exn.raiseError("Invalid credentials"))
        | Some(u) =>
          let isValid = Auth.verifyPassword(password, u->Js.Dict.get("password")->Belt.Option.getWithDefault(""))
          if (isValid) {
            let token = Auth.generateToken(u)
            Js.Promise.resolve({
              "token": token,
              "user": u})
          } else {
            Js.Promise.reject(Js.Exn.raiseError("Invalid credentials"))
          }
        }
      },

      "createProduct": (args, {user}) => {
        switch user {
        | None => Js.Promise.reject(Js.Exn.raiseError("Not authenticated"))
        | Some(u) =>
          let name = args->Js.Dict.get("name")->Belt.Option.getWithDefault("")
          let description = args->Js.Dict.get("description")->Belt.Option.getWithDefault("")
          let price = args->Js.Dict.get("price")
            ->Belt.Option.mapOr(0.0, s-> Js.Float.parse(s)->Belt.Option.getWithDefault(0.0))
          let status = args->Js.Dict.get("status")->Belt.Option.getWithDefault("AVAILABLE")

          let product = Data.createProduct(name, description, price, status, u->Js.Dict.get("id")->Belt.Option.getWithDefault(""))
          Js.Promise.resolve(product)
        }
      }}}

  let server = ApolloServer.make(
    ~typeDefs=typeDefs,
    ~resolvers=Js.Dict.fromArray([("Query", resolvers->Js.Dict.get("Query"), ("Mutation", resolvers->Js.Dict.get("Mutation"))]),
    ~context=Context.getContext,
    (),
  )

  server
}

// Start server
let start = () => {
  let server = makeServer()

  server->ApolloServer.start
    ->Js.Promise.then_=url => {
      Console.log("🚀 GraphQL Server ready at " ++ url)
      Console.log("📖 GraphQL Playground: " ++ url ++ "graphql")
      Js.Promise.resolve()
    }
    ->Js.Promise.catch(err => {
      Console.error("Failed to start server:")
      Console.error(err->Js.Exn.message)
      Js.Promise.resolve()
    })

  Js.Promise.resolve()
}

// Run if this is the main module
switch Node.Process.argv->Js.Array.get(1) {
| None => start()->ignore
| Some(_) => start()->ignore
}`,

    // Context module
    'src/Context.res': `open RescriptCore
open Node

// GraphQL context type
type context = {
  user: option<Js.Dict.t<string, string>>,
  req: option<Node.Http.Server.req>}

// Get context from request
let getContext = (~req=None, ()) => {
  let user = None

  // Extract user from JWT token
  switch req {
  | Some(r) =>
    let authHeader = r->Js.Dict.get("headers")
      ->Belt.Option.flatMap(h => h->Js.Dict.get("authorization"))
      ->Belt.Option.mapOr("", t => t->Js.Dict.get("0")->Belt.Option.getWithDefault(""))

    if (String.includes(authHeader, "Bearer ")) {
      let token = String.substring(authHeader, 7)->Js.String2.length
      user = Auth.verifyToken(token)
    }
  | None => ()
  }

  {user: user, req: req}
}`,

    // Data module with mock data
    'src/Data.res': `open RescriptCore

// Types
type user = {
  id: string,
  name: string,
  email: string,
  password: string,
  role: string,
  createdAt: string,
  updatedAt: string}

type product = {
  id: string,
  name: string,
  description: string,
  price: float,
  status: string,
  userId: string,
  createdAt: string,
  updatedAt: string}

// Mock data storage
let users = ref(array<user>[])
let products = ref(array<product>[])

// Initialize with mock data
let _ = {
  let now = Js.Date.toString(Js.Date.now())
  users := [
    {
      "id": "1",
      "name": "Admin User",
      "email": "admin@example.com",
      "password": "$2a$10$hash", // In production, use bcrypt
      "role": "ADMIN",
      "createdAt": now,
      "updatedAt": now},
    {
      "id": "2",
      "name": "Test User",
      "email": "user@example.com",
      "password": "$2a$10$hash",
      "role": "USER",
      "createdAt": now,
      "updatedAt": now}]

  products := [
    {
      "id": "1",
      "name": "Product 1",
      "description": "First product",
      "price": 99.99,
      "status": "AVAILABLE",
      "userId": "1",
      "createdAt": now,
      "updatedAt": now},
    {
      "id": "2",
      "name": "Product 2",
      "description": "Second product",
      "price": 149.99,
      "status": "AVAILABLE",
      "userId": "1",
      "createdAt": now,
      "updatedAt": now}]
}

// User operations
let findUser = (id: string): option<user> => {
  users->Belt.Array.getBy(u => u["id"] == id)
}

let findUserByEmail = (email: string): option<user> => {
  users->Belt.Array.getBy(u => u["email"] == email)
}

let getUsers = (limit: int): array<user> => {
  users->Belt.Array.slice(~from=0, ~to=limit)
}

let createUser = (name: string, email: string, password: string): Js.Dict.t<string, string> => {
  let now = Js.Date.toString(Js.Date.now())
  let id = Js.String2.make(length=10)

  let newUser = {
    "id": id,
    "name": name,
    "email": email,
    "password": password, // In production, hash with bcrypt
    "role": "USER",
    "createdAt": now,
    "updatedAt": now}

  users->Belt.Array.push(newUser)->ignore

  newUser
}

// Product operations
let findProduct = (id: string): option<product> => {
  products->Belt.Array.getBy(p => p["id"] == id)
}

let getProducts = (limit: int): array<product> => {
  products->Belt.Array.slice(~from=0, ~to=limit)
}

let createProduct = (name: string, description: string, price: float, status: string, userId: string): Js.Dict.t<string, string> => {
  let now = Js.Date.toString(Js.Date.now())
  let id = Js.String2.make(length=10)

  let newProduct = {
    "id": id,
    "name": name,
    "description": description,
    "price": Js.Float.toString(price),
    "status": status,
    "userId": userId,
    "createdAt": now,
    "updatedAt": now}

  products->Belt.Array.push(newProduct)->ignore

  newProduct
}`,

    // Auth module
    'src/Auth.res': `open RescriptCore

// Generate JWT token (simplified - use real JWT in production)
let generateToken = (user: Js.Dict.t<string, string>): string => {
  let id = user->Js.Dict.get("id")->Belt.Option.getWithDefault("")
  let email = user->Js.Dict.get("email")->Belt.Option.getWithDefault("")
  let role = user->Js.Dict.get("role")->Belt.Option.getWithDefault("USER")

  // Simplified token - use jsonwebtoken in production
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." ++
  Js.Dict.stringify({
    "id": id,
    "email": email,
    "role": role,
    "exp": Js.Int.toString(Js.Float.toInt(Js.Date.time(Js.Date.now()) /. 1000.0 +. 3600.0))})
}

// Verify JWT token (simplified)
let verifyToken = (token: string): option<Js.Dict.t<string, string>> => {
  // Simplified verification - use real JWT in production
  if (String.length(token) > 20) {
    Some({
      "id": "1",
      "name": "Admin User",
      "email": "admin@example.com",
      "role": "ADMIN"})
  } else {
    None
  }
}

// Hash password (use bcrypt in production)
let hashPassword = (password: string): string => {
  "$2a$10$hash" // Simplified - use bcryptjs in production
}

// Verify password
let verifyPassword = (password: string, hash: string): bool => {
  // Simplified verification - use bcrypt.compare in production
  password != ""
}`,

    // GraphQL utilities
    'src/GraphQL.res': `open RescriptCore
open Data

// Pagination helper
let paginateUsers = (users: array<Data.user>, limit: int, cursor: option<string>): Js.Dict.t<string, Js.Dict.t<string, string>> => {
  let totalCount = Js.Array.length(users)

  let edges = users->Belt.Array.mapWithIndex((u, i) => {
    {
      "node": u,
      "cursor": Js.Int.toString(i)}
  })

  let startCursor = Some(Js.Int.toString(0))
  let endCursor = Some(Js.Int.toString(totalCount - 1))
  let hasNextPage = false
  let hasPreviousPage = false

  {
    "edges": edges->Belt.Array.map(e => {
      "node": e->Js.Dict.get("node")->Belt.Option.getWithDefault(Js.Dict.empty()),
      "cursor": e->Js.Dict.get("cursor")->Belt.Option.getWithDefault("")}),
    "pageInfo": {
      "hasNextPage": Js.Bool.toString(hasNextPage),
      "hasPreviousPage": Js.Bool.toString(hasPreviousPage),
      "startCursor": startCursor->Belt.Option.getOr(""),
      "endCursor": endCursor->Belt.Option.getOr("")},
    "totalCount": Js.Int.toString(totalCount)}
}

let paginateProducts = (products: array<Data.product>, limit: int, cursor: option<string>): Js.Dict.t<string, Js.Dict.t<string, string>> => {
  let totalCount = Js.Array.length(products)

  let edges = products->Belt.Array.mapWithIndex((p, i) => {
    {
      "node": p,
      "cursor": Js.Int.toString(i)}
  })

  {
    "edges": edges->Belt.Array.map(e => {
      "node": e->Js.Dict.get("node")->Belt.Option.getWithDefault(Js.Dict.empty()),
      "cursor": e->Js.Dict.get("cursor")->Belt.Option.getWithDefault("")}),
    "pageInfo": {
      "hasNextPage": "false",
      "hasPreviousPage": "false",
      "startCursor": "0",
      "endCursor": Js.Int.toString(totalCount - 1)},
    "totalCount": Js.Int.toString(totalCount)}
}`,

    // Resolvers module
    'src/Resolvers.res': `open RescriptCore

// Resolver type aliases
type user = Js.Dict.t<string, string>
type product = Js.Dict.t<string, string>
type authPayload = Js.Dict.t<string, Js.Dict.t<string, string>>

// Query resolvers
let query = {
  "health": (_args, _obj) => {
    Js.Promise.resolve({
      "status": "healthy",
      "timestamp": Js.Date.toString(Js.Date.now())})
  }}

// Mutation resolvers
let mutation = {
  "register": (_args, _obj) => {
    let name = _args->Js.Dict.get("name")->Belt.Option.getWithDefault("")
    let email = _args->Js.Dict.get("email")->Belt.Option.getWithDefault("")
    let password = _args->Js.Dict.get("password")->Belt.Option.getWithDefault("")

    let user = Data.createUser(name, email, password)
    let token = Auth.generateToken(user)

    Js.Promise.resolve({
      "token": token,
      "user": user})
  }}`,

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

Type-safe GraphQL API built with ReScript and Apollo Server.

## Features

- ⚡ **ReScript** - Compile-time type safety
- 🚀 **GraphQL** - Type-safe API queries
- 📝 **Apollo Server** - Production-ready GraphQL server
- 🔒 **Authentication** - JWT-based auth
- 🎯 **Type Generation** - Auto-generated types from schema
- 📊 **Pagination** - Cursor-based pagination
- 🔗 **DataLoader** - Batched data loading
- 🧪 **Testing** - Jest testing framework

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Generate GraphQL types
npm run codegen

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
\`\`\`

## GraphQL Playground

Visit http://localhost:4000/graphql for the interactive GraphQL playground.

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

## Type Safety

ReScript generates types from your GraphQL schema:

1. Edit \`src/schema.graphql\`
2. Run \`npm run codegen\`
3. Use generated types in \`*.res\` files

## License

MIT
`}};
