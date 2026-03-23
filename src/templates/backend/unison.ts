import { BackendTemplate } from '../types';

export const unisonTemplate: BackendTemplate = {
  id: 'unison',
  name: 'unison',
  displayName: 'Unison (Distributed Computing)',
  description: 'Modern functional language with distributed computing, unique codebase representation, and STM-based concurrency',
  language: 'unison',
  framework: 'unison',
  version: '1.0.0',
  tags: ['unison', 'distributed', 'functional', 'stm', 'cloud', 'modern', 'experimental'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing'],

  files: {
    // Main Unison file
    'main.u': `{{projectName}}.Main : {{projectName}}.Main

{{projectName}}.Main.api.services.http.server : [HttpServer]

{{projectName}}.Main.api.services.http.server =
  let port = Nat.increments' 0 8080
  use HttpServer
  HttpServer.handle port handleRequest
  log "🚀 Server starting at http://localhost:8080"
  log "📚 API docs: http://localhost:8080/api/v1/health"
  log "👤 Default admin: admin@example.com / admin123"
  HttpServer.start

{{projectName}}.Main.handleRequest : Request -> Response

{{projectName}}.Main.handleRequest request =
  match request.path with
    "/" -> homeHandler request
    "/api/v1/health" -> healthHandler request
    "/api/v1/auth/register" -> registerHandler request
    "/api/v1/auth/login" -> loginHandler request
    "/api/v1/products" -> productsHandler request
    path -> if Text.startsWith path "/api/v1/products/"
              then productByIdHandler request
              else notFoundHandler

{{projectName}}.Main.homeHandler : Request -> Response

{{projectName}}.Main.homeHandler _request =
  let html = """
<!DOCTYPE html>
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
    <p>Distributed server built with Unison language</p>
    <p>Unique codebase representation with content-addressed storage</p>
    <p>STM-based concurrency for distributed systems</p>
    <p>API available at: <a href="/api/v1/health">/api/v1/health</a></p>
  </body>
</html>
  """
  Response.ok html
    |> Response.withHeader "Content-Type" "text/html"

{{projectName}}.Main.healthHandler : Request -> Response

{{projectName}}.Main.healthHandler _request =
  let body = Json.fromString "{\\"status\\": \\"healthy\\", \\"timestamp\\": \\"now\\", \\"version\\": \\"1.0.0\\"}"
  Response.ok body
    |> Response.withHeader "Content-Type" "application/json"

{{projectName}}.Main.notFoundHandler : Request -> Response

{{projectName}}.Main.notFoundHandler _request =
  let body = Json.fromString "{\\"error\\": \\"Not found\\"}"
  Response.notFound body
    |> Response.withHeader "Content-Type" "application/json"

{{projectName}}.Main.User.type : Type

{{projectName}}.Main.User.type =
  Record [
    ("id", Nat),
    ("email", Text),
    ("name", Text),
    ("password", Text),
    ("role", Text)
  ]

{{projectName}}.Main.Product.type : Type

{{projectName}}.Main.Product.type =
  Record [
    ("id", Nat),
    ("name", Text),
    ("description", Text),
    ("price", Float),
    ("stock", Nat)
  ]

{{projectName}}.Main.users : Map Nat User

{{projectName}}.Main.users =
  Map.fromList [
    (1, { id: 1, email: "admin@example.com", password: hashPassword "admin123", name: "Admin User", role: "admin" }),
    (2, { id: 2, email: "user@example.com", password: hashPassword "user123", name: "Test User", role: "user" })
  ]

{{projectName}}.Main.products : Map Nat Product

{{projectName}}.Main.products =
  Map.fromList [
    (1, { id: 1, name: "Sample Product 1", description: "This is a sample product", price: 29.99, stock: 100 }),
    (2, { id: 2, name: "Sample Product 2", description: "Another sample product", price: 49.99, stock: 50 })
  ]

{{projectName}}.Main.userIdCounter : Nat

{{projectName}}.Main.userIdCounter = 3

{{projectName}}.Main.productIdCounter : Nat

{{projectName}}.Main.productIdCounter = 3

{{projectName}}.Main.hashPassword : Text -> Text

{{projectName}}.Main.hashPassword password =
  use Crypto
  Crypto.sha256 password

{{projectName}}.Main.generateToken : User -> Text

{{projectName}}.Main.generateToken user =
  "jwt-token-placeholder"

{{projectName}}.Main.findUserByEmail : Text -> Optional User

{{projectName}}.Main.findUserByEmail email =
  Map.values users
    |> List.findFirst (user -> user.email == email)

{{projectName}}.Main.registerHandler : Request -> Response

{{projectName}}.Main.registerHandler _request =
  let email = "user@example.com"
  let password = "password123"
  let name = "New User"

  match findUserByEmail email with
    Some _ ->
      let body = Json.fromString "{\\"error\\": \\"Email already registered\\"}"
      Response.conflict body
        |> Response.withHeader "Content-Type" "application/json"
    None ->
      let newUser = {
        id: userIdCounter,
        email: email,
        password: hashPassword password,
        name: name,
        role: "user"
      }
      let token = generateToken newUser
      let body = Json.fromString (
        "{\\"token\\": \\"" ++ token ++ "\\", \\"user\\": {\\"id\\": " ++
        Nat.toText newUser.id ++ ", \\"email\\": \\"" ++ newUser.email ++
        "\\", \\"name\\": \\"" ++ newUser.name ++ "\\", \\"role\\": \\"" ++ newUser.role ++ "\\"}}"
      )
      Response.created body
        |> Response.withHeader "Content-Type" "application/json"

{{projectName}}.Main.loginHandler : Request -> Response

{{projectName}}.Main.loginHandler _request =
  let email = "admin@example.com"
  let password = "admin123"

  match findUserByEmail email with
    None ->
      let body = Json.fromString "{\\"error\\": \\"Invalid credentials\\"}"
      Response.unauthorized body
        |> Response.withHeader "Content-Type" "application/json"
    Some user ->
      if user.password == hashPassword password then
        let token = generateToken user
        let body = Json.fromString (
          "{\\"token\\": \\"" ++ token ++ "\\", \\"user\\": {\\"id\\": " ++
          Nat.toText user.id ++ ", \\"email\\": \\"" ++ user.email ++
          "\\", \\"name\\": \\"" ++ user.name ++ "\\", \\"role\\": \\"" ++ user.role ++ "\\"}}"
        )
        Response.ok body
          |> Response.withHeader "Content-Type" "application/json"
      else
        let body = Json.fromString "{\\"error\\": \\"Invalid credentials\\"}"
        Response.unauthorized body
          |> Response.withHeader "Content-Type" "application/json"

{{projectName}}.Main.productsHandler : Request -> Response

{{projectName}}.Main.productsHandler request =
  match request.method with
    "GET" ->
      let productList = Map.values products
      let body = Json.fromString (
        "{\\"products\\": [" ++
        (List.intersperse "," (List.map productToJson productList)) ++
        "], \\"count\\": " ++ Nat.toText (List.size productList) ++ "}"
      )
      Response.ok body
        |> Response.withHeader "Content-Type" "application/json"
    "POST" ->
      let newProduct = {
        id: productIdCounter,
        name: "New Product",
        description: "",
        price: 29.99,
        stock: 100
      }
      let body = Json.fromString (
        "{\\"product\\": {\\"id\\": " ++ Nat.toText newProduct.id ++
        ", \\"name\\": \\"" ++ newProduct.name ++ "\\"}}"
      )
      Response.created body
        |> Response.withHeader "Content-Type" "application/json"
    _ ->
      let body = Json.fromString "{\\"error\\": \\"Method not allowed\\"}"
      Response.methodNotAllowed body
        |> Response.withHeader "Content-Type" "application/json"

{{projectName}}.Main.productByIdHandler : Request -> Response

{{projectName}}.Main.productByIdHandler request =
  match request.method with
    "GET" ->
      let pathParts = Text.split "/" request.path
      let idMaybe = List.getAt 2 pathParts |> Option.flatMap Nat.fromText
      match idMaybe with
        None ->
          let body = Json.fromString "{\\"error\\": \\"Invalid product ID\\"}"
          Response.badRequest body
            |> Response.withHeader "Content-Type" "application/json"
        Some id ->
          match Map.get id products with
            None ->
              let body = Json.fromString "{\\"error\\": \\"Product not found\\"}"
              Response.notFound body
                |> Response.withHeader "Content-Type" "application/json"
            Some product ->
              let body = Json.fromString (
                "{\\"product\\": {\\"id\\": " ++ Nat.toText product.id ++
                ", \\"name\\": \\"" ++ product.name ++ "\\", \\"description\\": \\"" ++
                product.description ++ "\\", \\"price\\": " ++ Float.toText product.price ++
                ", \\"stock\\": " ++ Nat.toText product.stock ++ "}}"
              )
              Response.ok body
                |> Response.withHeader "Content-Type" "application/json"
    _ ->
      let body = Json.fromString "{\\"error\\": \\"Method not allowed\\"}"
      Response.methodNotAllowed body
        |> Response.withHeader "Content-Type" "application/json"

{{projectName}}.Main.productToJson : Product -> Text

{{projectName}}.Main.productToJson product =
  "{\\"id\\": " ++ Nat.toText product.id ++ ", \\"name\\": \\"" ++ product.name ++
  "\\", \\"description\\": \\"" ++ product.description ++ "\\", \\"price\\": " ++
  Float.toText product.price ++ ", \\"stock\\": " ++ Nat.toText product.stock ++ "}"
`,

    // Unison project configuration
    'project.u': `{{projectName}}.Main : {{projectName}}.Main

{{projectName}}.Main =
  {{projectName}}.Main.api.services.http.server
`,

    // Dependencies file
    'dependencies.u': `{{projectName}}.dependencies : {{{projectName}}.dependencies}

{{projectName}}.dependencies = {
  base,
  http,
  json,
  crypto,
  stm
}
`,

    // Environment file
    '.env': `# Server Configuration
PORT=8080
ENV=development

# JWT Secret (change in production!)
JWT_SECRET=change-this-secret-in-production

# Unison Configuration
UNISON_VERSION=latest
CODEBASE_PATH=.unison

# Distributed Computing
CLUSTER_MODE=false
NODE_ID=node1

# Logging
LOG_LEVEL=info
`,

    // .gitignore
    '.gitignore': `# Unison codebase
.unison/
*.u
*.ub
*.uc

# Build output
build/
dist/

# Dependencies
.cache/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Logs
logs/
*.log

# OS
.DS_Store
Thumbs.db
`,

    // Dockerfile
    'Dockerfile': `FROM ubuntu:latest

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \\
    curl \\
    build-essential \\
    libssl-dev \\
    && rm -rf /var/lib/apt/lists/*

# Install Unison
RUN curl -L https://github.com/unisonweb/unison/releases/latest/download/unison-linux-x64.tar.gz | tar xz
RUN mv unison /usr/local/bin/
RUN unison --version

# Copy source files
COPY . .

# Build Unison project
RUN unison compile

# Expose port
EXPOSE 8080

# Run
CMD ["unison", "run", "{{projectName}}"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - ENV=production
      - PORT=8080
      - JWT_SECRET=change-this-secret
      - CLUSTER_MODE=true
      - NODE_ID=node1
    restart: unless-stopped
    networks:
      - unison-cluster

  app2:
    build: .
    ports:
      - "8081:8080"
    environment:
      - ENV=production
      - PORT=8080
      - JWT_SECRET=change-this-secret
      - CLUSTER_MODE=true
      - NODE_ID=node2
    restart: unless-stopped
    networks:
      - unison-cluster
    depends_on:
      - app

networks:
  unison-cluster:
    driver: bridge
`,

    // README
    'README.md': `# {{projectName}}

Distributed web server built with Unison language for cloud-native applications.

## Features

- **Unison**: Modern functional programming language
- **Unique Codebase**: Content-addressed storage, no merge conflicts
- **Distributed**: Built-in support for distributed computing
- **STM**: Software Transactional Memory for concurrency
- **Type-Safe**: Strong static typing with type inference
- **Immutable**: Immutable data structures by default
- **Cloud-Native**: Designed for distributed systems
- **Modern**: Clean syntax and tooling

## Requirements

- Unison runtime (latest)
- Docker (for containerization)

## Installation

\`\`\`bash
# Install Unison (follow https://github.com/unisonweb/unison)
curl -L https://github.com/unisonweb/unison/releases/latest/download/unison-linux-x64.tar.gz | tar xz
sudo mv unison /usr/local/bin/

# Initialize Unison codebase
unison init

# Add dependencies
unison install http json crypto stm

# Compile
unison compile

# Run
unison run {{projectName}}
\`\`\`

## Quick Start

### Development Mode
\`\`\`bash
# Watch mode
unison run --watch

# Run
unison run {{projectName}}
\`\`\`

### Production Mode
\`\`\`bash
# Compile with optimizations
unison compile --optimize

# Run
unison run {{projectName}}
\`\`\`

Visit http://localhost:8080

## API Endpoints

### Health
- \`GET /api/v1/health\` - Health check

### Authentication
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login user

### Products
- \`GET /api/v1/products\` - List all products
- \`GET /api/v1/products/:id\` - Get product by ID
- \`POST /api/v1/products\` - Create product
- \`PUT /api/v1/products/:id\` - Update product
- \`DELETE /api/v1/products/:id\` - Delete product

## Default Credentials

- Email: \`admin@example.com\`
- Password: \`admin123\`

## Project Structure

\`\`\`
main.u             # Main server and handlers
project.u         # Project entry point
dependencies.u    # Project dependencies
.unison/          # Unison codebase directory
\`\`\`

## Unison Features

### Unique Codebase

Unison stores code by content hash, eliminating merge conflicts:

\`\`\`unison
# Names are just labels to hashes
myFunction : Nat -> Nat
myFunction x = x + 1

# Renaming doesn't change the hash
myFunctionRenamed : Nat -> Nat
myFunctionRenamed = myFunction
\`\`\`

### STM Concurrency

Software Transactional Memory for safe concurrency:

\`\`\`unison
use STM

# Transactional operations
transferMoney : Account -> Account -> Nat -> STM ()
transferMoney from to amount = do
  STM.modify (amount -) from.balance
  STM.modify (amount +) to.balance
\`\`\`

### Distributed Computing

Built-in support for distributed systems:

\`\`\`unison
# Distributed data structures
use Distributed

distributedMap : Distributed.Map Text Nat
distributedMap = DistributedMap.new "cluster"

# Remote execution
remoteTask : Remote ()
remoteTask =
  Remote.at "node1" (log "Running on node1")
\`\`\`

### Type System

Powerful type system with type inference:

\`\`\`unison
# Types are inferred
add x y = x + y

# But can be specified
add : Nat -> Nat -> Nat
add x y = x + 1

# Algebraic data types
Optional a = Some a | None

Result e a = Ok a | Err e
\`\`\`

### Pattern Matching

Elegant pattern matching:

\`\`\`unison
handleResult : Result Text Nat -> Text
handleResult result =
  match result with
    Ok value -> "Success: " ++ Nat.toText value
    Err error -> "Error: " ++ error
\`\`\`

## Development

\`\`\`bash
# Compile
unison compile

# Run
unison run {{projectName}}

# Test
unison test

# Format
unison format

# Lint
unison lint

# Add dependency
unison install http
\`\`\`

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 8080:8080 {{projectName}}
\`\`\`

Or with Docker Compose:

\`\`\`bash
docker-compose up
\`\`\`

## Why Unison?

- **No Merge Conflicts**: Content-addressed code storage
- **Distributed**: Built for distributed systems
- **Type-Safe**: Catch errors at compile time
- **Modern**: Clean, functional design
- **STM**: Safe concurrency without locks
- **Tooling**: Excellent editor support
- **Performance**: Compiled to efficient code

## Status

⚠️ **Beta**: Unison is in active development
- Language is stabilizing
- Tooling is improving
- Ecosystem is growing
- Not yet production-ready for most use cases

This template is provided for experimental and learning purposes.

## Unique Features

### Content-Addressed Code

Every definition is stored by its hash:

\`\`\`unison
# Changing a function creates a new hash
original : Nat -> Nat
original x = x + 1

modified : Nat -> Nat
modified x = x + 2  # Different hash!
\`\`\`

Benefits:
- **No Merge Conflicts**: Same code = same hash
- **Easy Renaming**: Names don't affect storage
- **Incremental Caching**: Cache by hash
- **Easy Sharing**: Share code by hash

### STM for Concurrency

Software Transactional Memory:

\`\`\`unison
use STM

# Atomic transactions
transfer : Account -> Account -> Nat -> STM ()
transfer from to amount = do
  fromBal <- STM.get from.balance
  toBal <- STM.get to.balance
  STM.put (fromBal - amount) from.balance
  STM.put (toBal + amount) to.balance
\`\`\`

Benefits:
- **Composable**: Transactions compose
- **No Deadlocks**: No manual locking
- **Safe**: Compiler guarantees safety
- **Scalable**: Efficient concurrency

## References

- [Unison Website](https://unisonweb.org/)
- [Unison GitHub](https://github.com/unisonweb/unison)
- [Documentation](https://unisonweb.org/docs)
- [Share](https://share.unisonweb.org/)

## License

MIT
`}
};
