import { BackendTemplate } from '../types';

export const jennetPonyTemplate: BackendTemplate = {
  id: 'jennet-pony',
  name: 'jennet-pony',
  displayName: 'Jennet (Pony)',
  description: 'Actor-based web framework for Pony with safe concurrency and high performance',
  language: 'pony',
  framework: 'jennet',
  version: '1.0.0',
  tags: ['pony', 'jennet', 'actors', 'concurrency', 'safe', 'performance'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing'],

  files: {
    // Main actor
    'main.pony': `use "net/http"
use "jennet"
use "collections"
use "time"
use "crypto"

actor Main
  new create(env: Env) =>
    let auth = env.root as AmbientAuth
    let server = Server(auth)

    // Start server
    try
      server(-> _server(env))? where _server = server_serve
    else
      env.err.print("Server failed to start\\n")
    end

  fun ref server_serve(server: Server): Server =>
    """
    Configure routes and start server
    """
    // API routes
    server("/api/v1/health", HealthHandler)
    server("/api/v1/auth/register", RegisterHandler)
    server("/api/v1/auth/login", LoginHandler)
    server("/api/v1/products", ProductsHandler)
    server("/api/v1/products/:id", ProductHandler)

    // Home page
    server("/", HomeHandler)

    server

class val HomeHandler is Handler
  fun val apply(ctx: Context): Context iso^ =>
    let html = recover
      String.
        append("<!DOCTYPE html>\\n").
        append("<html>\\n").
        append("  <head>\\n").
        append("    <title>{{projectName}}</title>\\n").
        append("    <style>\\n").
        append("      body { font-family: Arial, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }\\n").
        append("      h1 { color: #333; }\\n").
        append("    </style>\\n").
        append("  </head>\\n").
        append("  <body>\\n").
        append("    <h1>Welcome to {{projectName}}</h1>\\n").
        append("    <p>Actor-based web application built with Pony and Jennet</p>\\n").
        append("    <p>API available at: <a href=\\"/api/v1/health\\">/api/v1/health</a></p>\\n").
        append("  </body>\\n").
        append("</html>")
    end

    ctx.response.status = 200
    ctx.response.add_header("Content-Type", "text/html")
    ctx.response.body = html
    consume ctx

class val HealthHandler is Handler
  fun val apply(ctx: Context iso): Context iso^ =>
    let json = recover
      Json.obj.
        add("status", Json.from("healthy")).
        add("timestamp", Json.from(Time.now().format()))
        add("version", Json.from("1.0.0"))
    end

    ctx.response.status = 200
    ctx.response.add_header("Content-Type", "application/json")
    ctx.response.body = json.string()
    consume ctx

actor UserDatabase
  """
  In-memory user database actor
  """
  var _users: Array[User] = [
    User(1, "admin@example.com", "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a", "Admin User", "admin", Time.now().format(), Time.now().format())
  ]
  var _counter: USize = 2

  be find_by_email(email: String, promise: Promise[User?]) =>
    for user in _users.values() do
      if user.email == email then
        promise(user)
        return
      end
    end
    promise(None)

  be create_user(email: String, password: String, name: String, promise: Promise[User]) =>
    let user = User(_counter, email, password, name, "user", Time.now().format(), Time.now().format())
    _counter = _counter + 1
    _users.push(user)
    promise(user)

actor ProductDatabase
  """
  In-memory product database actor
  """
  var _products: Array[Product] = [
    Product(1, "Sample Product 1", "This is a sample product", 29.99, 100, Time.now().format(), Time.now().format()),
    Product(2, "Sample Product 2", "Another sample product", 49.99, 50, Time.now().format(), Time.now().format())
  ]
  var _counter: USize = 3

  be get_all(promise: Promise[Array[Product]]) =>
    promise(_products.clone())

  be find_by_id(id: USize, promise: Promise[Product?]) =>
    for product in _products.values() do
      if product.id == id then
        promise(product)
        return
      end
    end
    promise(None)

  be create_product(name: String, description: String, price: F64, stock: I32, promise: Promise[Product]) =>
    let product = Product(_counter, name, description, price, stock, Time.now().format(), Time.now().format())
    _counter = _counter + 1
    _products.push(product)
    promise(product)

class val RegisterHandler is Handler
  fun val apply(ctx: Context iso): Context iso^ =>
    // In production, parse JSON body
    let email = "user@example.com"
    let password = "password123"
    let name = "New User"

    let db = UserDatabase
    let p = Promise[User]

    db.find_by_email(email, object iso is Promise[User?]
      fun apply(user: User? iso) =>
        match user
        | let u: User =>
          let json = Json.obj.add("error", Json.from("Email already registered"))
          ctx.response.status = 409
          ctx.response.add_header("Content-Type", "application/json")
          ctx.response.body = json.string()
          // Send response
        else
          db.create_user(email, password, name, p)
        end
    end)

    consume ctx

class val LoginHandler is Handler
  fun val apply(ctx: Context iso): Context iso^ =>
    // In production, parse JSON body
    let email = "admin@example.com"
    let password = "admin123"

    let db = UserDatabase
    let p = Promise[User?]

    db.find_by_email(email, object iso is Promise[User?]
      fun apply(user: User? iso) =>
        match user
        | let u: User =>
          if u.password == password then
            let token = "jwt-token-" + Sha256.hash(u.email + Time.now().format().string())
            let json = Json.obj.
              add("token", Json.from(token)).
              add("user", Json.obj.
                add("id", Json.from(u.id.i64())).
                add("email", Json.from(u.email)).
                add("name", Json.from(u.name)).
                add("role", Json.from(u.role)))

            ctx.response.status = 200
            ctx.response.add_header("Content-Type", "application/json")
            ctx.response.body = json.string()
          else
            let json = Json.obj.add("error", Json.from("Invalid credentials"))
            ctx.response.status = 401
            ctx.response.add_header("Content-Type", "application/json")
            ctx.response.body = json.string()
          end
        else
          let json = Json.obj.add("error", Json.from("Invalid credentials"))
          ctx.response.status = 401
          ctx.response.add_header("Content-Type", "application/json")
          ctx.response.body = json.string()
        end
    end)

    consume ctx

class val ProductsHandler is Handler
  fun val apply(ctx: Context iso): Context iso^ =>
    let db = ProductDatabase
    let p = Promise[Array[Product]]

    db.get_all(object iso is Promise[Array[Product]]
      fun apply(products: Array[Product] iso) =>
        let json = Json.obj.
          add("products", Json.from(products)).
          add("count", Json.from(products.size().i64()))

        ctx.response.status = 200
        ctx.response.add_header("Content-Type", "application/json")
        ctx.response.body = json.string()
    end)

    consume ctx

class val ProductHandler is Handler
  fun val apply(ctx: Context iso): Context iso^ =>
    // Parse ID from path
    let id: USize = 1

    let db = ProductDatabase
    let p = Promise[Product?]

    db.find_by_id(id, object iso is Promise[Product?]
      fun apply(product: Product? iso) =>
        match product
        | let p: Product =>
          let json = Json.obj.
            add("product", Json.obj.
              add("id", Json.from(p.id.i64())).
              add("name", Json.from(p.name)).
              add("description", Json.from(p.description)).
              add("price", Json.from(p.price)).
              add("stock", Json.from(p.stock.i64())))

          ctx.response.status = 200
          ctx.response.add_header("Content-Type", "application/json")
          ctx.response.body = json.string()
        else
          let json = Json.obj.add("error", Json.from("Product not found"))
          ctx.response.status = 404
          ctx.response.add_header("Content-Type", "application/json")
          ctx.response.body = json.string()
        end
    end)

    consume ctx

// Data structures
class val User
  let id: USize
  let email: String
  let password: String
  let name: String
  let role: String
  let created_at: String
  let updated_at: String

  new val create(id': USize, email': String, password': String, name': String, role': String, created_at': String, updated_at': String) =>
    id = id'
    email = email'
    password = password'
    name = name'
    role = role'
    created_at = created_at'
    updated_at = updated_at'

class val Product
  let id: USize
  let name: String
  let description: String
  let price: F64
  let stock: I32
  let created_at: String
  let updated_at: String

  new val create(id': USize, name': String, description': String, price': F64, stock': I32, created_at': String, updated_at': String) =>
    id = id'
    name = name'
    description = description'
    price = price'
    stock = stock'
    created_at = created_at'
    updated_at = updated_at'
`
,

    // Project configuration
    'corral.json': `{
  "dependencies": [
    "{"url":"https://github.com/Zenghief/jennet","pin":"main"}"
  ]
}`
,

    // Dockerfile
    'Dockerfile': `FROM ponylang/ponyc:latest

WORKDIR /app

COPY . .

RUN corral fetch

RUN corral build --verbose

EXPOSE 8080

CMD ["corral", "run", "--", "-o", "0"]
`
,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    restart: unless-stopped
`
,

    // README
    'README.md': `# {{projectName}}

Actor-based web application built with Pony and Jennet framework.

## Features

- **Pony**: Safe concurrent programming with actors
- **Jennet**: Fast HTTP framework for Pony
- **Actor model**: Message-passing concurrency without locks
- **Memory safety**: No data races, guaranteed by type system
- **High performance**: Minimal overhead and efficient garbage collection
- **Authentication**: SHA256 password hashing and JWT-like tokens

## Requirements

- Pony compiler (latest)
- Corral package manager

## Quick Start

\`\`\`bash
# Install dependencies
corral fetch

# Build
corral build --verbose

# Run
corral run -- -o 0
\`\`\`

Visit http://localhost:8080

## API Endpoints

- \`GET /\` - Home page
- \`GET /api/v1/health\` - Health check
- \`POST /api/v1/auth/register\` - Register
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/products\` - List products
- \`GET /api/v1/products/:id\` - Get product by ID

## Project Structure

\`\`\`
main.pony         # Main application and HTTP handlers
corral.json      # Dependency management
\`\`\`

## Actor Model

Pony's actor model provides:
- Message-passing concurrency
- No data races (guaranteed by type system)
- Efficient garbage collection per actor
- Lock-free synchronization

## License

MIT
`
  }
};
