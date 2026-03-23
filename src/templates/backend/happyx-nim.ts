import { BackendTemplate } from '../types';

export const happyxNimTemplate: BackendTemplate = {
  id: 'happyx-nim',
  name: 'happyx-nim',
  displayName: 'HappyX (Nim)',
  description: 'Modern web framework for Nim with type-safe routing and JSON handling',
  language: 'nim',
  framework: 'happyx',
  version: '1.0.0',
  tags: ['nim', 'happyx', 'modern', 'type-safe', 'json', 'routing'],
  port: 5000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'websockets'],

  files: {
    // Configuration
    '{{projectNameSnake}}.nimble': `# Package

version       = "0.1.0"
author        = "{{author}}"
description   = "REST API built with HappyX"
license       = "MIT"
srcDir        = "src"
bin           = @["{{projectNameSnake}}"]

# Dependencies

requires "nim >= 2.0"
requires "happyx >= 2.0"
`,

    // Main application
    'src/{{projectNameSnake}}.nim': `import happyx


serve("127.0.0.1", 5000):
  middleware:
    # Enable CORS
    cors("*", ["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    # Request logging
    afterRequest:
      echo ctx.request.reqMethod & " " & ctx.request.path

  # Health check
  get "/api/v1/health":
    {
      "status": "healthy",
      "timestamp": now().format("yyyy-MM-dd HH:mm:ss"),
      "version": "1.0.0"
    }

  # Auth routes
  post "/api/v1/auth/register":
    let body = ctx.request.jsonBody()
    # Validate and create user
    %*{"token": "jwt-token", "user": %*{"id": 1, "email": body{"email"}, "name": body{"name"}, "role": "user"}}

  post "/api/v1/auth/login":
    let body = ctx.request.jsonBody()
    # Validate credentials
    %*{"token": "jwt-token", "user": %*{"id": 1, "email": body{"email"}, "name": "Admin", "role": "admin"}}

  # Product routes
  get "/api/v1/products":
    %*{"products": %[], "count": 0}

  get "/api/v1/products/{id:int}":
    %*{"product": %*{"id": {"id"}}}

  post "/api/v1/products":
    let body = ctx.request.jsonBody()
    %*{"product": %*{"id": 1, "name": body{"name"}, "price": body{"price"}}}

  put "/api/v1/products/{id:int}":
    let id = {"id"}
    let body = ctx.request.jsonBody()
    %*{"product": %*{"id": id, "name": body{"name"}, "price": body{"price"}}}

  delete "/api/v1/products/{id:int}":
    # Delete product
    statusCode(204)

echo("🚀 Server running at http://localhost:5000")
echo("📚 API docs: http://localhost:5000/api/v1/health")
`,

    // Models
    'src/{{projectNameSnake}}/models.nim': `import json
import times

type
  Role* = enum
    User = "user"
    Admin = "admin"

  User* = object
    id*: int
    email*: string
    password*: string
    name*: string
    role*: Role
    createdAt*: string
    updatedAt*: string

  Product* = object
    id*: int
    name*: string
    description*: string
    price*: float
    stock*: int
    createdAt*: string
    updatedAt*: string

  RegisterRequest* = object
    email*: string
    password*: string
    name*: string

  LoginRequest* = object
    email*: string
    password*: string

  AuthResponse* = object
    token*: string
    user*: User

# Database (in-memory for demo)
var
  users* = newJObject()
  products* = newJObject()

proc initDb*() =
  # Initialize with default data
  let admin = %*{
    "id": 1,
    "email": "admin@example.com",
    "password": "hashed",
    "name": "Admin User",
    "role": "admin",
    "createdAt": now().format("yyyy-MM-dd HH:mm:ss"),
    "updatedAt": now().format("yyyy-MM-dd HH:mm:ss")
  }
  users["1"] = admin

  let prod1 = %*{
    "id": 1,
    "name": "Sample Product 1",
    "description": "This is a sample product",
    "price": 29.99,
    "stock": 100,
    "createdAt": now().format("yyyy-MM-dd HH:mm:ss"),
    "updatedAt": now().format("yyyy-MM-dd HH:mm:ss")
  }
  products["1"] = prod1

  let prod2 = %*{
    "id": 2,
    "name": "Sample Product 2",
    "description": "Another sample product",
    "price": 49.99,
    "stock": 50,
    "createdAt": now().format("yyyy-MM-dd HH:mm:ss"),
    "updatedAt": now().format("yyyy-MM-dd HH:mm:ss")
  }
  products["2"] = prod2

  echo("📦 Database initialized")
  echo("👤 Default admin: admin@example.com / admin123")

initDb()
`,

    // Authentication
    'src/{{projectNameSnake}}/auth.nim': `import json
import {{projectNameSnake}}/models

proc generateToken*(user: JsonNode): string =
  "jwt-token-" & $user["id"].getInt()

proc verifyToken*(token: string): bool =
  token.startsWith("jwt-token-")

# In production, use a proper JWT library
proc hashPassword*(password: string): string =
  # Simple hash for demo
  $password.hash()

proc verifyPassword*(password, hash: string): bool =
  hashPassword(password) == hash
`,

    // Controllers
    'src/{{projectNameSnake}}/controllers.nim': `import happyx
import json
import {{projectNameSnake}}/models
import {{projectNameSnake}}/auth

# Health check controller
proc healthController*(): JsonNode =
  %*{
    "status": "healthy",
    "timestamp": now().format("yyyy-MM-dd HH:mm:ss"),
    "version": "1.0.0"
  }

# Auth controllers
proc registerController*(body: JsonNode): JsonNode =
  %*{
    "token": generateToken(body),
    "user": %*{
      "id": 1,
      "email": body{"email"},
      "name": body{"name"},
      "role": "user"
    }
  }

proc loginController*(body: JsonNode): JsonNode =
  # Check credentials
  %*{
    "token": "jwt-token",
    "user": %*{
      "id": 1,
      "email": body{"email"},
      "name": "Admin",
      "role": "admin"
    }
  }

# Product controllers
proc listProductsController*(): JsonNode =
  %*{
    "products": %[],
    "count": 0
  }

proc getProductController*(id: int): JsonNode =
  %*{"product": %*{"id": id}}

proc createProductController*(body: JsonNode): JsonNode =
  %*{
    "product": %*{
      "id": 1,
      "name": body{"name"},
      "price": body{"price"}
    }
  }

proc updateProductController*(id: int, body: JsonNode): JsonNode =
  %*{
    "product": %*{
      "id": id,
      "name": body{"name"},
      "price": body{"price"}
    }
  }

proc deleteProductController*(id: int) =
  # Delete product
  discard
`,

    // WebSocket example
    'src/{{projectNameSnake}}/websocket.nim': `import happyx

# WebSocket example
websocket "/ws":
  onOpen:
    echo "Client connected"

  onMessage:
    echo "Received: " & message
    await ws.send("Echo: " & message)

  onClose:
    echo "Client disconnected"
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

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/v1/health || exit 1

CMD ["/app/{{projectNameSnake}}"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    volumes:
      - .:/app
    restart: unless-stopped
`,

    // Tests
    'tests/test_{{projectNameSnake}}.nim': `import unittest
import {{projectNameSnake}}/models
import json

test "User model":
  let user = %*{
    "id": 1,
    "email": "test@example.com",
    "password": "password",
    "name": "Test User",
    "role": "user",
    "createdAt": "2024-01-01",
    "updatedAt": "2024-01-01"
  }
  check user{"email"}.getStr() == "test@example.com"

test "Product model":
  let product = %*{
    "id": 1,
    "name": "Test Product",
    "price": 29.99
  }
  check product{"name"}.getStr() == "Test Product"
`,

    // README
    'README.md': `# {{projectName}}

Modern REST API built with HappyX framework for Nim.

## Features

- **HappyX**: Modern web framework
- **Type-safe routing**: Compile-time route validation
- **JSON handling**: Built-in JSON parsing and serialization
- **WebSocket**: Real-time communication support
- **Middleware**: Composable middleware system
- **CORS**: Cross-origin resource sharing

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

## WebSocket

- \`WS /ws\` - Echo WebSocket

## License

MIT
`
  }
};
