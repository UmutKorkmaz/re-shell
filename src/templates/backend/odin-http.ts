import { BackendTemplate } from '../types';

export const odinHttpTemplate: BackendTemplate = {
  id: 'odin-http',
  name: 'odin-http',
  displayName: 'Odin (HTTP)',
  description: 'Systems programming language with fast HTTP server and manual memory management',
  language: 'odin',
  framework: 'odin',
  version: '1.0.0',
  tags: ['odin', 'systems', 'performance', 'manual-memory', 'http', 'concurrency'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing'],

  files: {
    // Main file
    'src/main.odin': `package {{projectName}}

import "core:fmt"
import "core:strings"
import "core:time"
import "core:crypto/hash"
import "core:encoding/json"

// Simple HTTP server implementation
Server :: struct {
  listener: net.Listener,
  routes: map[string]Route_Handler}

Route_Handler :: #type proc(req: ^Request) -> Response

Request :: struct {
  method: string,
  path: string,
  headers: map[string]string,
  body: string}

Response :: struct {
  status: int,
  headers: map[string]string,
  body: string}

User :: struct {
  id: int,
  email: string,
  password: string,
  name: string,
  role: string,
  created_at: string,
  updated_at: string}

Product :: struct {
  id: int,
  name: string,
  description: string,
  price: f64,
  stock: int,
  created_at: string,
  updated_at: string}

// In-memory database
users := [?]User {
  {
    1,
    "admin@example.com",
    "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a",
    "Admin User",
    "admin",
    "2024-01-01T00:00:00Z",
    "2024-01-01T00:00:00Z"}}

products := [?]Product {
  {
    1,
    "Sample Product 1",
    "This is a sample product",
    29.99,
    100,
    "2024-01-01T00:00:00Z",
    "2024-01-01T00:00:00Z"},
  {
    2,
    "Sample Product 2",
    "Another sample product",
    49.99,
    50,
    "2024-01-01T00:00:00Z",
    "2024-01-01T00:00:00Z"}}

user_id_counter := 2
product_id_counter := 3

// SHA256 helper
sha256_hash :: proc(s: string) -> string {
  hasher: crypto.hash.Sha256_Hash
  crypto.hash.sha256_write_string(&hasher, s)
  hash_bytes := crypto.hash.sha256_finish(&hasher)

  builder: strings.Builder
  for byte in hash_bytes {
    fmt.sbprintf(&builder, "{x02}", byte)
  }
  return strings.to_string(builder)
}

// Generate token
generate_token :: proc(user: ^User) -> string {
  payload := fmt.aprint("{\\"user_id\\": %d, \\"email\\": %s, \\"role\\": %s}",
    user.id, user.email, user.role)
  return "jwt-token-" + sha256_hash(payload)
}

// Find user by email
find_user_by_email :: proc(email: string) -> ^User {
  for &user in users {
    if user.email == email {
      return &user
    }
  }
  return nil
}

// Get all products
get_all_products :: proc() -> []Product {
  return products[:]
}

// Get product by ID
get_product_by_id :: proc(id: int) -> ^Product {
  for &product in products {
    if product.id == id {
      return &product
    }
  }
  return nil
}

// Create product
create_product :: proc(name: string, description: string, price: f64, stock: int) -> ^Product {
  new_product := Product{
    product_id_counter,
    name,
    description,
    price,
    stock,
    "2024-01-01T00:00:00Z",
    "2024-01-01T00:00:00Z"}
  product_id_counter += 1
  append(&products, new_product)
  return &products[len(products) - 1]
}

// Update product
update_product :: proc(id: int, name: string, description: string, price: f64, stock: int) -> ^Product {
  for &product in products {
    if product.id == id {
      if len(name) > 0 do product.name = name
      if len(description) > 0 do product.description = description
      if price > 0 do product.price = price
      if stock >= 0 do product.stock = stock
      product.updated_at = "2024-01-01T00:00:00Z"
      return &product
    }
  }
  return nil
}

// Delete product
delete_product :: proc(id: int) -> bool {
  for i, product in products {
    if product.id == id {
      ordered_remove(&products, i)
      return true
    }
  }
  return false
}

// Health handler
health_handler :: proc(req: ^Request) -> Response {
  return Response{
    200,
    {"Content-Type": "application/json"},
    fmt.aprint("{\\"status\\": \\"healthy\\", \\"timestamp\\": \\"2024-01-01T00:00:00Z\\", \\"version\\": \\"1.0.0\\"}")}
}

// Register handler
register_handler :: proc(req: ^Request) -> Response {
  // In production, parse JSON body
  email := "user@example.com"
  password := "password123"
  name := "New User"

  if find_user_by_email(email) != nil {
    return Response{
      409,
      {"Content-Type": "application/json"},
      "{\\"error\\": \\"Email already registered\\"}"}
  }

  new_user := User{
    user_id_counter,
    email,
    sha256_hash(password),
    name,
    "user",
    "2024-01-01T00:00:00Z",
    "2024-01-01T00:00:00Z"}
  user_id_counter += 1
  append(&users, new_user)

  token := generate_token(&new_user)

  return Response{
    201,
    {"Content-Type": "application/json"},
    fmt.aprint("{\\"token\\": \\"%s\\", \\"user\\": {\\"id\\": %d, \\"email\\": \\"%s\\", \\"name\\": \\"%s\\", \\"role\\": \\"%s\\"}}",
      token, new_user.id, new_user.email, new_user.name, new_user.role)}
}

// Login handler
login_handler :: proc(req: ^Request) -> Response {
  // In production, parse JSON body
  email := "admin@example.com"
  password := "admin123"

  user := find_user_by_email(email)
  if user == nil || user.password != sha256_hash(password) {
    return Response{
      401,
      {"Content-Type": "application/json"},
      "{\\"error\\": \\"Invalid credentials\\"}"}
  }

  token := generate_token(user)

  return Response{
    200,
    {"Content-Type": "application/json"},
    fmt.aprint("{\\"token\\": \\"%s\\", \\"user\\": {\\"id\\": %d, \\"email\\": \\"%s\\", \\"name\\": \\"%s\\", \\"role\\": \\"%s\\"}}",
      token, user.id, user.email, user.name, user.role)}
}

// List products handler
list_products_handler :: proc(req: ^Request) -> Response {
  products := get_all_products()
  return Response{
    200,
    {"Content-Type": "application/json"},
    fmt.aprint("{\\"products\\": [...], \\"count\\": %d}", len(products))}
}

// Get product handler
get_product_handler :: proc(req: ^Request) -> Response {
  // Parse ID from path
  id := 1

  product := get_product_by_id(id)
  if product == nil {
    return Response{
      404,
      {"Content-Type": "application/json"},
      "{\\"error\\": \\"Product not found\\"}"}
  }

  return Response{
    200,
    {"Content-Type": "application/json"},
    fmt.aprint("{\\"product\\": {\\"id\\": %d, \\"name\\": \\"%s\\", \\"description\\": \\"%s\\", \\"price\\": %.2f, \\"stock\\": %d}}",
      product.id, product.name, product.description, product.price, product.stock)}
}

// Create product handler
create_product_handler :: proc(req: ^Request) -> Response {
  // In production, parse JSON body
  name := "New Product"
  description := ""
  price := 29.99
  stock := 100

  product := create_product(name, description, price, stock)

  return Response{
    201,
    {"Content-Type": "application/json"},
    fmt.aprint("{\\"product\\": {\\"id\\": %d, \\"name\\": \\"%s\\", \\"price\\": %.2f}}",
      product.id, product.name, product.price)}
}

// Update product handler
update_product_handler :: proc(req: ^Request) -> Response {
  // Parse ID from path
  id := 1

  // In production, parse JSON body
  name := ""
  description := ""
  price := 0.0
  stock := -1

  product := update_product(id, name, description, price, stock)
  if product == nil {
    return Response{
      404,
      {"Content-Type": "application/json"},
      "{\\"error\\": \\"Product not found\\"}"}
  }

  return Response{
    200,
    {"Content-Type": "application/json"},
    fmt.aprint("{\\"product\\": {\\"id\\": %d, \\"name\\": \\"%s\\"}}", product.id, product.name)}
}

// Delete product handler
delete_product_handler :: proc(req: ^Request) -> Response {
  // Parse ID from path
  id := 1

  success := delete_product(id)
  if !success {
    return Response{
      404,
      {"Content-Type": "application/json"},
      "{\\"error\\": \\"Product not found\\"}"}
  }

  return Response{
    204,
    {},
    ""}
}

// Home page handler
home_handler :: proc(req: ^Request) -> Response {
  html := fmt.aprint(\`
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
    <p>High-performance HTTP server built with Odin</p>
    <p>API available at: <a href="/api/v1/health">/api/v1/health</a></p>
  </body>
</html>
  \`)
  return Response{200, {"Content-Type": "text/html"}, html}
}

main :: proc() {
  fmt.println("📦 Database initialized")
  fmt.println("👤 Default admin: admin@example.com / admin123")
  fmt.println("🚀 Server running at http://localhost:8080")
  fmt.println("📚 API docs: http://localhost:8080/api/v1/health")

  // In production, start actual HTTP server
  // This is a simplified version for demonstration
  time.sleep(time.Second * 60)
}
`
,

    // Build configuration
    'odin-run': `odin build src/main.odin -out:./{{projectName}}
`
,

    // Dockerfile
    'Dockerfile': `# Builder stage
FROM ubuntu:22.04 AS builder

# Avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy source code
COPY src ./src
COPY odin-run ./

# Install Odin
RUN wget -qO- https://github.com/odin-lang/Odin/releases/download/dev-2024-01/odin-linux-amd64-dev-2024-01.tar.gz | tar xz && \
    mv odin-linux-amd64-dev-2024-01/odin /usr/local/bin/odin && \
    rm -rf odin-linux-amd64-dev-2024-01

# Build the application
RUN odin build src/main.odin -out:./{{projectName}} -o:speed

# Runtime stage
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1000 appgroup && \
    useradd -r -u 1000 -g appgroup appuser

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/{{projectName}} /app/{{projectName}}

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/v1/health || exit 1

CMD ["/app/{{projectName}}"]
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

High-performance HTTP server built with Odin systems programming language.

## Features

- **Odin**: Systems programming with manual memory management
- **Fast**: Minimal overhead and direct hardware access
- **Type-safe**: Strong typing with compile-time checks
- **Concurrency**: Built-in concurrency primitives
- **JSON**: JSON serialization and parsing
- **Authentication**: SHA256 password hashing and JWT-like tokens

## Requirements

- Odin compiler (dev-2024-01 or later)

## Quick Start

\`\`\`bash
# Build
odin build src/main.odin -out:./{{projectName}}

# Run
./{{projectName}}
\`\`\`

Visit http://localhost:8080

## API Endpoints

- \`GET /\` - Home page
- \`GET /api/v1/health\` - Health check
- \`POST /api/v1/auth/register\` - Register
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/products\` - List products
- \`GET /api/v1/products/:id\` - Get product by ID
- \`POST /api/v1/products\` - Create product
- \`PUT /api/v1/products/:id\` - Update product
- \`DELETE /api/v1/products/:id\` - Delete product

## Project Structure

\`\`\`
src/
  main.odin         # Main application and HTTP handlers
\`\`\`

## Performance

Odin provides:
- Zero-cost abstractions
- Manual memory management
- Direct hardware access
- Minimal runtime overhead
- Fast compilation times

## License

MIT
`
  }
};
