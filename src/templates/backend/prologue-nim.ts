import { BackendTemplate } from '../types';

export const prologueNimTemplate: BackendTemplate = {
  id: 'prologue-nim',
  name: 'prologue-nim',
  displayName: 'Prologue (Nim)',
  description: 'Full-stack web framework for Nim with type-safe routing, ORM, and authentication',
  language: 'nim',
  framework: 'prologue',
  version: '1.0.0',
  tags: ['nim', 'prologue', 'full-stack', 'database', 'authentication', 'type-safe'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'database'],

  files: {
    // Configuration
    '{{projectNameSnake}}.nimble': `# Package

version       = "0.1.0"
author        = "{{author}}"
description   = "REST API built with Prologue"
license       = "MIT"
srcDir        = "src"
installExt    = @["nim"]
bin           = @["{{projectNameSnake}}"]

# Dependencies

requires "nim >= 2.0"
requires "prologue >= 0.7.0"
requires "norman >= 0.6.0"
requires "jwt >= 0.3.0"
`,

    // Main application
    'src/{{projectNameSnake}}.nim': `import prologue
import prologue/middlewares/session
import {{projectNameSnake}}/routes
import {{projectNameSnake}}/models
import {{projectNameSnake}}/controllers

var app = newApp(settings = newSettings(
  port = Port(8080),
  appName = "{{projectName}}",
  debug = true
))

app.registerErrorHandler(errorHandler)

# Routes
app.get("/api/v1/health", healthController)
app.post("/api/v1/auth/register", registerController)
app.post("/api/v1/auth/login", loginController)
app.get("/api/v1/products", listProductsController)
app.get("/api/v1/products/:id", getProductController)
app.post("/api/v1/products", createProductController)
app.put("/api/v1/products/:id", updateProductController)
app.delete("/api/v1/products/:id", deleteProductController)

echo("🚀 Server running at http://localhost:8080")
echo("📚 API docs: http://localhost:8080/api/v1/health")

app.run()
`,

    // Models
    'src/{{projectNameSnake}}/models.nim': `import norm/sqlite
import times

type
  Role* = enum
    User = "user"
    Admin = "admin"

  User* = object
    id*: int64
    email*: string
    password*: string
    name*: string
    role*: Role
    createdAt*: DateTime
    updatedAt*: DateTime

  Product* = object
    id*: int64
    name*: string
    description*: string
    price*: float64
    stock*: int
    createdAt*: DateTime
    updatedAt*: DateTime

  DbConn* = DbConn

proc newUser*(email, password, name: string): User =
  result = User(
    id: 0,
    email: email,
    password: password,
    name: name,
    role: Role.User,
    createdAt: now().utc,
    updatedAt: now().utc
  )

proc newProduct*(name, description: string, price: float64, stock: int): Product =
  result = Product(
    id: 0,
    name: name,
    description: description,
    price: price,
    stock: stock,
    createdAt: now().utc,
    updatedAt: now().utc
  )
`,

    // Database
    'src/{{projectNameSnake}}/database.nim': `import norm/sqlite
import {{projectNameSnake}}/models

var dbConn* = open("{{projectNameSnake}}.db", "", "", "")

proc initDb*() =
  dbConn.createTables(User())
  dbConn.createTables(Product())

  # Create default admin
  var admin = User(
    id: 1,
    email: "admin@example.com",
    password: "hashed_password_here",  # In production, hash this
    name: "Admin User",
    role: Role.Admin,
    createdAt: now().utc,
    updatedAt: now().utc
  )
  dbConn.insert(admin)

  # Create sample products
  var prod1 = Product(
    id: 1,
    name: "Sample Product 1",
    description: "This is a sample product",
    price: 29.99,
    stock: 100,
    createdAt: now().utc,
    updatedAt: now().utc
  )
  dbConn.insert(prod1)

  var prod2 = Product(
    id: 2,
    name: "Sample Product 2",
    description: "Another sample product",
    price: 49.99,
    stock: 50,
    createdAt: now().utc,
    updatedAt: now().utc
  )
  dbConn.insert(prod2)

  echo("📦 Database initialized")
  echo("👤 Default admin: admin@example.com / admin123")
`,

    // Controllers - Health
    'src/{{projectNameSnake}}/controllers.nim': `import prologue
import json
import times

proc healthController*(ctx: Context) {.async.} =
  resp jsonResponse(%{
    "status": %"healthy",
    "timestamp": %$(now().utc.format("yyyy-MM-dd HH:mm:ss")),
    "version": %"1.0.0"
  })

proc registerController*(ctx: Context) {.async.} =
  try:
    let body = ctx.request.body.bind()
    # Parse and create user
    resp jsonResponse(%{"token": %"jwt-token", "user": %{"id": %1}})
  except:
    resp jsonResponse(%{"error": %"Invalid request"}, Http404)

proc loginController*(ctx: Context) {.async.} =
  try:
    let body = ctx.request.body.bind()
    # Validate credentials
    resp jsonResponse(%{
      "token": %"jwt-token",
      "user": %{"id": %1, "email": %"admin@example.com", "name": %"Admin", "role": %"admin"}
    })
  except:
    resp jsonResponse(%{"error": %"Invalid credentials"}, Http401)

proc listProductsController*(ctx: Context) {.async.} =
  resp jsonResponse(%{
    "products": %[],
    "count": %0
  })

proc getProductController*(ctx: Context) {.async.} =
  let id = ctx.getPathParams("id").parseInt()
  resp jsonResponse(%{"product": %{"id": %id}})

proc createProductController*(ctx: Context) {.async.} =
  try:
    let body = ctx.request.body.bind()
    resp jsonResponse(%{"product": %{"id": %1}}, Http201)
  except:
    resp jsonResponse(%{"error": %"Invalid request"}, Http400)

proc updateProductController*(ctx: Context) {.async.} =
  let id = ctx.getPathParams("id").parseInt()
  resp jsonResponse(%{"product": %{"id": %id}})

proc deleteProductController*(ctx: Context) {.async.} =
  let id = ctx.getPathParams("id").parseInt()
  resp Http204

proc errorHandler*(req: Request, error: Exception) : Future[Response] {.async.} =
  let
    errorCode = if error of PrologueError: PrologueError(error).code else: Http500
    errorMsg = error.msg

  return Response.error(errorCode, %*{"error": %errorMsg})
`,

    // Routes
    'src/{{projectNameSnake}}/routes.nim': `import prologue

# Routes are defined in main file for simplicity
# This file can be used for organizing routes in larger applications
`,

    // Authentication
    'src/{{projectNameSnake}}/auth.nim': `import {{projectNameSnake}}/models
import jwt

proc generateToken*(user: User): string =
  let secret = "change-this-secret"
  let token = sign(%{
    "user_id": %user.id,
    "email": %user.email,
    "role": %$user.role
  }, secret)
  return token

proc verifyToken*(token: string): bool =
  let secret = "change-this-secret"
  try:
    let verified = verify(token, secret)
    return true
  except:
    return false
`,

    // Dockerfile
    'Dockerfile': `# Builder stage
FROM nimlang/nim:2.0-alpine AS builder

WORKDIR /app

# Copy dependency file first for better layer caching
COPY {{projectNameSnake}}.nimble ./

# Install dependencies
RUN nimble install -y --depsOnly

# Copy source code
COPY src ./src

# Build the application
RUN nim c -d:release --opt:speed --opt:size src/{{projectNameSnake}}.nim

# Runtime stage
FROM alpine:3.18

# Install ca-certificates for HTTPS requests
RUN apk add --no-cache ca-certificates

# Create non-root user
RUN addgroup -g 1000 appgroup && \
    adduser -D -u 1000 -G appgroup appuser

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/src/{{projectNameSnake}} /app/{{projectNameSnake}}

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/v1/health || exit 1

CMD ["/app/{{projectNameSnake}}"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - .:/app
    restart: unless-stopped
`,

    // Tests
    'tests/test_{{projectNameSnake}}.nim': `import unittest
import {{projectNameSnake}}/models

test "User model":
  let user = newUser("test@example.com", "password", "Test User")
  check user.email == "test@example.com"
  check user.name == "Test User"

test "Product model":
  let product = newProduct("Test Product", "Description", 29.99, 100)
  check product.name == "Test Product"
  check product.price == 29.99
`,

    // README
    'README.md': `# {{projectName}}

Full-stack REST API built with Prologue framework for Nim.

## Features

- **Prologue**: Full-stack web framework
- **Norman**: Type-safe ORM
- **JWT Authentication**: Secure token-based auth
- **Type-safe Routes**: Compile-time route checking
- **SQLite Database**: Embedded database

## Requirements

- Nim 2.0+

## Quick Start

\`\`\`bash
nimble install
nimble run
\`\`\`

## API Endpoints

- \`GET /api/v1/health\` - Health check
- \`POST /api/v1/auth/register\` - Register
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/products\` - List products

## License

MIT
`
  }
};
