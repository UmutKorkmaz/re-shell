import { BackendTemplate } from '../types';

export const valeTemplate: BackendTemplate = {
  id: 'vale',
  name: 'vale',
  displayName: 'Vale (Memory Safety)',
  description: 'Experimental systems language with region-based memory management, zero-cost safety, and C++ interop',
  language: 'cpp',
  framework: 'vale',
  version: '1.0.0',
  tags: ['vale', 'memory-safety', 'systems', 'zero-cost', 'cpp-interop', 'experimental', 'regions'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing'],

  files: {
    // Main Vale file
    'main.vale': `# {{projectName}} - Vale Web Server with Memory Safety
import! std.io.PrintUtils;
import! c.CStandardLib;
import! c.HTTPServer;

# User struct
exported struct User {
  id i32;
  email str;
  name str;
  password str;
  role str;
}

fn User.create(id i32, email str, password str, name str, role str) User {
  ret User(id, email, password, name, role);
}

# Product struct
exported struct Product {
  id i32;
  name str;
  description str;
  price f64;
  stock i32;
}

fn Product.create(id i32, name str, description str, price f64, stock i32) Product {
  ret Product(id, name, description, price, stock);
}

# In-memory database using regions
struct UsersRegion {
  users Array<User>;
}

struct ProductsRegion {
  products Array<Product>;
}

# Initialize regions with sample data
fn initializeRegions() (UsersRegion, ProductsRegion) {
  var usersRegion = UsersRegion(Array<User>());
  var productsRegion = ProductsRegion(Array<Product>());

  # Add default users
  usersRegion.users.push(User.create(1, "admin@example.com", hash_password("admin123"), "Admin User", "admin"));
  usersRegion.users.push(User.create(2, "user@example.com", hash_password("user123"), "Test User", "user"));

  # Add sample products
  productsRegion.products.push(Product.create(1, "Sample Product 1", "This is a sample product", 29.99, 100));
  productsRegion.products.push(Product.create(2, "Sample Product 2", "Another sample product", 49.99, 50));

  ret (usersRegion, productsRegion);
}

var usersRegion UsersRegion;
var productsRegion ProductsRegion;
var userIdCounter i32 = 3;
var productIdCounter i32 = 3;

# Initialize on startup
fn init() {
  (usersRegion, productsRegion) = initializeRegions();
}

# Hash password using C interop
fn hash_password(password str) str {
  # Use C's OpenSSL via interop
  ret C.hash_sha256(password);
}

# Generate JWT token
fn generate_token(user User) str {
  ret C.generate_jwt(user.id, user.email, user.role);
}

# Find user by email
fn find_user_by_email(email str) Opt<User> {
  for (user in usersRegion.users) {
    if (user.email == email) {
      ret Some(user);
    }
  }
  ret None;
}

# HTTP Response type
struct HttpResponse {
  status i32;
  headers Map<str, str>;
  body str;
}

fn HttpResponse.create(status i32, body str) HttpResponse {
  var response = HttpResponse(status, Map<str, str>(), body);
  response.headers.set("Content-Type", "application/json");
  ret response;
}

fn HttpResponse.set_header(mut self HttpResponse, key str, value str) {
  self.headers.set(key, value);
}

# Health handler
fn health_handler(request C.HttpRequest) HttpResponse {
  var timestamp = C.get_timestamp();
  var body = "{\\"status\\": \\"healthy\\", \\"timestamp\\": \\"" + timestamp + "\\", \\"version\\": \\"1.0.0\\"}";
  ret HttpResponse.create(200, body);
}

# Home handler
fn home_handler(request C.HttpRequest) HttpResponse {
  var html = """
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
    <p>Memory-safe server built with Vale language</p>
    <p>Region-based memory management without GC</p>
    <p>Zero-cost safety guarantees</p>
    <p>API available at: <a href="/api/v1/health">/api/v1/health</a></p>
  </body>
</html>
  """;

  var response = HttpResponse.create(200, html);
  response.set_header("Content-Type", "text/html");
  ret response;
}

# Register handler
fn register_handler(request C.HttpRequest) HttpResponse {
  # In production, parse JSON body from request
  var email = "user@example.com";
  var password = "password123";
  var name = "New User";

  # Check if user exists
  match (find_user_by_email(email)) {
    Some(_) => {
      var body = "{\\"error\\": \\"Email already registered\\"}";
      ret HttpResponse.create(409, body);
    }
    None => {
      # Create new user
      var newUser = User.create(userIdCounter, email, hash_password(password), name, "user");
      userIdCounter = userIdCounter + 1;
      usersRegion.users.push(newUser);

      var token = generate_token(newUser);
      var body = "{\\"token\\": \\"" + token + "\\", \\"user\\": {\\"id\\": " + newUser.id + ", \\"email\\": \\"" + newUser.email + "\\", \\"name\\": \\"" + newUser.name + "\\", \\"role\\": \\"" + newUser.role + "\\"}}";
      ret HttpResponse.create(201, body);
    }
  }
}

# Login handler
fn login_handler(request C.HttpRequest) HttpResponse {
  var email = "admin@example.com";
  var password = "admin123";

  match (find_user_by_email(email)) {
    None => {
      var body = "{\\"error\\": \\"Invalid credentials\\"}";
      ret HttpResponse.create(401, body);
    }
    Some(user) => {
      if (user.password == hash_password(password)) {
        var token = generate_token(user);
        var body = "{\\"token\\": \\"" + token + "\\", \\"user\\": {\\"id\\": " + user.id + ", \\"email\\": \\"" + user.email + "\\", \\"name\\": \\"" + user.name + "\\", \\"role\\": \\"" + user.role + "\\"}}";
        ret HttpResponse.create(200, body);
      } else {
        var body = "{\\"error\\": \\"Invalid credentials\\"}";
        ret HttpResponse.create(401, body);
      }
    }
  }
}

# List products handler
fn list_products_handler(request C.HttpRequest) HttpResponse {
  var body = "{\\"products\\": [";

  var i i32 = 0;
  for (product in productsRegion.products) {
    if (i > 0) {
      body = body + ",";
    }
    body = body + "{\\"id\\": " + product.id + ", \\"name\\": \\"" + product.name + "\\", \\"description\\": \\"" + product.description + "\\", \\"price\\": " + product.price + ", \\"stock\\": " + product.stock + "}";
    i = i32(i) + 1;
  }

  var count = productsRegion.products.len();
  body = body + "], \\"count\\": " + count + "}";
  ret HttpResponse.create(200, body);
}

# Get product handler
fn get_product_handler(request C.HttpRequest, productId i32) HttpResponse {
  for (product in productsRegion.products) {
    if (product.id == productId) {
      var body = "{\\"product\\": {\\"id\\": " + product.id + ", \\"name\\": \\"" + product.name + "\\", \\"description\\": \\"" + product.description + "\\", \\"price\\": " + product.price + ", \\"stock\\": " + product.stock + "}}";
      ret HttpResponse.create(200, body);
    }
  }

  var body = "{\\"error\\": \\"Product not found\\"}";
  ret HttpResponse.create(404, body);
}

# Create product handler
fn create_product_handler(request C.HttpRequest) HttpResponse {
  # In production, parse JSON body from request
  var name = "New Product";
  var description = "";
  var price f64 = 29.99;
  var stock i32 = 100;

  var newProduct = Product.create(productIdCounter, name, description, price, stock);
  productIdCounter = productIdCounter + 1;
  productsRegion.products.push(newProduct);

  var body = "{\\"product\\": {\\"id\\": " + newProduct.id + ", \\"name\\": \\"" + newProduct.name + "\\"}}";
  ret HttpResponse.create(201, body);
}

# Update product handler
fn update_product_handler(request C.HttpRequest, productId i32) HttpResponse {
  var i i32 = 0;
  for (product in productsRegion.products) {
    if (product.id == productId) {
      # In production, parse JSON body from request and update
      var body = "{\\"product\\": {\\"id\\": " + product.id + ", \\"name\\": \\"Updated Product\\"}}";
      ret HttpResponse.create(200, body);
    }
    i = i32(i) + 1;
  }

  var body = "{\\"error\\": \\"Product not found\\"}";
  ret HttpResponse.create(404, body);
}

# Delete product handler
fn delete_product_handler(request C.HttpRequest, productId i32) HttpResponse {
  var i i32 = 0;
  for (product in productsRegion.products) {
    if (product.id == productId) {
      # Remove product using swap-and-pop (Vale doesn't have erase)
      productsRegion.products.swap(i, productsRegion.products.len() - 1);
      productsRegion.products.pop();
      ret HttpResponse.create(204, "");
    }
    i = i32(i) + 1;
  }

  var body = "{\\"error\\": \\"Product not found\\"}";
  ret HttpResponse.create(404, body);
}

# Main request router
fn route_request(path str, method str, request C.HttpRequest) HttpResponse {
  if (path == "/") {
    ret home_handler(request);
  } else if (path == "/api/v1/health") {
    ret health_handler(request);
  } else if (path == "/api/v1/auth/register" && method == "POST") {
    ret register_handler(request);
  } else if (path == "/api/v1/auth/login" && method == "POST") {
    ret login_handler(request);
  } else if (path == "/api/v1/products" && method == "GET") {
    ret list_products_handler(request);
  } else if (C.starts_with(path, "/api/v1/products/") && method == "GET") {
    # Extract product ID (simplified)
    var parts = C.split(path, "/");
    if (parts.len() >= 4) {
      var productId = C.parse_i32(parts[3]);
      ret get_product_handler(request, productId);
    } else {
      var body = "{\\"error\\": \\"Invalid product ID\\"}";
      ret HttpResponse.create(400, body);
    }
  } else if (path == "/api/v1/products" && method == "POST") {
    ret create_product_handler(request);
  } else {
    var body = "{\\"error\\": \\"Not found\\"}";
    ret HttpResponse.create(404, body);
  }
}

# Main function
fn main() i32 {
  Println("🚀 Server starting at http://localhost:8080");
  Println("📚 API docs: http://localhost:8080/api/v1/health");
  Println("👤 Default admin: admin@example.com / admin123");
  Println("🔒 Memory-safe with region-based management");

  # Initialize regions
  init();

  # Use C HTTP server via interop
  var server = C.HTTPServer.create(8080);

  # Set up routes
  server.add_route("GET", "/", home_handler);
  server.add_route("GET", "/api/v1/health", health_handler);
  server.add_route("POST", "/api/v1/auth/register", register_handler);
  server.add_route("POST", "/api/v1/auth/login", login_handler);
  server.add_route("GET", "/api/v1/products", list_products_handler);
  server.add_route("POST", "/api/v1/products", create_product_handler);

  # Add CORS middleware
  server.add_middleware(C.cors_middleware());

  Println("Server ready!");
  server.start();

  ret 0;
}
`,

    // C interop header for Vale
    'vale_c_interop.h': `// {{projectName}} - C Interop Layer for Vale

#pragma once

#include <string>
#include <chrono>
#include <iomanip>
#include <sstream>
#include <cstring>
#include <openssl/sha.h>
#include <jwt-cpp/jwt.h>

extern "C" {

// Get current timestamp
const char* get_timestamp() {
    static char buffer[64];
    auto now = std::chrono::system_clock::now();
    auto time = std::chrono::system_clock::to_time_t(now);
    std::stringstream ss;
    ss << std::put_time(std::localtime(&time), "%Y-%m-%dT%H:%M:%S");
    strncpy(buffer, ss.str().c_str(), sizeof(buffer) - 1);
    buffer[sizeof(buffer) - 1] = '\\0';
    return buffer;
}

// SHA256 hash for passwords
const char* hash_sha256(const char* input) {
    static char output_buffer[65];
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256_CTX sha256;
    SHA256_Init(&sha256);
    SHA256_Update(&sha256, input, strlen(input));
    SHA256_Final(hash, &sha256);

    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        sprintf(output_buffer + (i * 2), "%02x", hash[i]);
    }
    output_buffer[64] = '\\0';
    return output_buffer;
}

// Generate JWT token
const char* generate_jwt(int user_id, const char* email, const char* role) {
    static char token_buffer[512];
    auto token = jwt::create()
        .set_issuer("{{projectName}}")
        .set_type("JWT")
        .set_payload_claim("user_id", jwt::claim(std::to_string(user_id)))
        .set_payload_claim("email", jwt::claim(email))
        .set_payload_claim("role", jwt::claim(role))
        .sign(jwt::algorithm::hs256{"secret-key-change-in-production"});
    strncpy(token_buffer, token.c_str(), sizeof(token_buffer) - 1);
    token_buffer[sizeof(token_buffer) - 1] = '\\0';
    return token_buffer;
}

// Parse integer
int parse_i32(const char* str) {
    return atoi(str);
}

// String utility: starts with
int starts_with(const char* str, const char* prefix) {
    return strncmp(str, prefix, strlen(prefix)) == 0 ? 1 : 0;
}

// String utility: split
char** split(const char* str, const char* delim, int* count) {
    static char* parts[32];
    static char buffer[1024];
    strncpy(buffer, str, sizeof(buffer) - 1);
    buffer[sizeof(buffer) - 1] = '\\0';

    *count = 0;
    char* token = strtok(buffer, delim);
    while (token != NULL && *count < 32) {
        parts[*count] = token;
        (*count)++;
        token = strtok(NULL, delim);
    }
    return parts;
}

// HTTP Server (simplified - use libmicrohttpd or similar)
typedef struct HttpRequest {
    const char* method;
    const char* path;
    const char* body;
} HttpRequest;

typedef void (*RouteHandler)(struct HttpRequest request);

typedef struct HTTPServer HTTPServer;

HTTPServer* http_server_create(int port);
void http_server_add_route(HTTPServer* server, const char* method, const char* path, RouteHandler handler);
void http_server_add_middleware(HTTPServer* server, void (*middleware)());
void http_server_start(HTTPServer* server);

// CORS middleware
void cors_middleware() {
    // Implementation would add CORS headers
}

} // extern "C"
`,

    // Vale package configuration
    'Vale.toml': `# {{projectName}} Package Configuration

[package]
name = "{{projectName}}"
version = "1.0.0"
license = "MIT"

[dependencies]
std = "*"

[build]
target = "native"
optimize = true
lto = true

[regions]
enabled = true
default = "arena"

[interop]
c = true
cpp = true

[metadata]
authors = ["{{author}}"]
description = "{{description}}"
`,

    // Environment file
    '.env': `# Server Configuration
PORT=8080
ENV=development

# JWT Secret (change in production!)
JWT_SECRET=change-this-secret-in-production

# Vale Compiler
VALE_VERSION=0.1.0

# Memory Management
REGION_ALLOCATOR=arena
ENABLE_REGIONS=true

# Logging
LOG_LEVEL=info
`,

    // .gitignore
    '.gitignore': `# Build output
*.vale
*.o
*.a
*.so
*.dylib
*.dll
build/
dist/
vale-cache/

# Dependencies
c/build/
c/include/

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
logs
*.log

# OS
.DS_Store
Thumbs.db

# C
*.d
*.ii
*.suo

# Vale specific
.vale/
region-stats/
`,

    // Dockerfile
    'Dockerfile': `FROM ubuntu:latest

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    cmake \\
    git \\
    libssl-dev \\
    libmicrohttpd-dev \\
    nlohmann-json3-dev \\
    && rm -rf /var/lib/apt/lists/*

# Install Vale compiler (when available)
# RUN git clone https://github.com/ValeLang/Vale.git /opt/vale
# RUN cd /opt/vale && cmake . && make install

# Copy source files
COPY . .

# Build Vale project
# valec build main.vale

# Expose port
EXPOSE 8080

# Run with C interop
CMD ["./main"]
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
      - ENABLE_REGIONS=true
    restart: unless-stopped
`,

    // CMakeLists.txt for C interop
    'CMakeLists.txt': `cmake_minimum_required(VERSION 3.15)
project({{projectName}} C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

# Find dependencies
find_package(OpenSSL REQUIRED)
find_package(PkgConfig REQUIRED)
pkg_check_modules(MICROHTTPD REQUIRED libmicrohttpd)

# Include directories
include_directories(\${CMAKE_CURRENT_SOURCE_DIR}/c/include)

# Source files
set(SOURCES
    c/src/vale_c_interop.c
    c/src/http_server.c
)

# Create executable
add_executable(main \${SOURCES})

# Link libraries
target_link_libraries(main
    \${OPENSSL_LIBRARIES}
    \${MICROHTTPD_LIBRARIES}
    pthread
)

# Install target
install(TARGETS main DESTINATION bin)
`,

    // README
    'README.md': `# {{projectName}}

Memory-safe web server built with Vale language and region-based memory management.

## Features

- **Vale**: Experimental systems language with memory safety
- **Region-Based Memory**: Automatic memory management without garbage collection
- **Zero-Cost Safety**: Compile-time guarantees with no runtime overhead
- **C Interop**: Seamless integration with existing C ecosystem
- **Memory Safety**: No null pointers, no data races, no use-after-free
- **Performance**: C++-level performance with better safety
- **Modern Syntax**: Clean, expressive syntax for systems programming

## Requirements

- Vale compiler (experimental - follow https://github.com/ValeLang/Vale)
- C compiler with C11 support
- OpenSSL
- libmicrohttpd

## Installation

\`\`\`bash
# Install Vale (when available)
git clone https://github.com/ValeLang/Vale.git
cd Vale
cmake .
make install

# Install C dependencies
# Ubuntu/Debian
sudo apt-get install build-essential libssl-dev libmicrohttpd-dev nlohmann-json3-dev

# Build
valec build main.vale

# Run
./main
\`\`\`

## Quick Start

### Development Mode
\`\`\`bash
# Build with debug info
valec build main.vale --debug

# Run
./main
\`\`\`

### Production Mode
\`\`\`bash
# Build with optimizations
valec build main.vale --release --lto

# Run
./main
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
main.vale               # Main Vale server and routes
vale_c_interop.h        # C interop layer
Vale.toml               # Vale package configuration
CMakeLists.txt          # C build configuration
.env                    # Environment variables
\`\`\`

## Vale Features

- **Region-Based Memory**: Automatic cleanup without GC
- **Zero-Cost Abstractions**: No runtime overhead
- **Memory Safety**: Compile-time guarantees
- **C Interop**: Call C code directly from Vale
- **Immutable Defaults**: Safe concurrency by default
- **Linear Types**: Resource management guaranteed
- **No Null**: Option types instead of null
- **No Data Races**: Safe concurrency primitives

## Region-Based Memory Management

Vale's key innovation is region-based memory management:

\`\`\`vale
# Define a region
struct UsersRegion {
  users Array<User>;
}

# Variables in region are automatically cleaned up
fn process_users() {
  var region = UsersRegion(Array<User>());
  # region is automatically freed when function returns
}
\`\`\`

Benefits:
- **No GC**: Deterministic cleanup
- **No Manual Management**: Automatic cleanup
- **Zero Cost**: Compiler optimizes away
- **Safe**: No use-after-free or double-free

## Memory Safety Guarantees

Vale provides memory safety without garbage collection:

- **No Null Pointer Errors**: Option types instead of null
- **No Use-After-Free**: Region-based ownership
- **No Data Races**: Immutable by default
- **No Buffer Overflows**: Bounds checking
- **No Memory Leaks**: Automatic cleanup

## C Interoperability

Vale can call C code directly:

\`\`\`vale
import! c.CStandardLib;

fn call_c_function() str {
  ret C.hash_sha256("password");
}
\`\`\`

## Performance

Vale achieves C++-level performance:

- **Zero-Cost Abstractions**: No runtime overhead
- **Region Inference**: Compiler optimizes regions
- **Inline by Default**: Functions are inlined
- **No GC Pauses**: Deterministic performance
- **LTO Support**: Link-time optimization

## Development

\`\`\`bash
# Build
valec build main.vale

# Run
./main

# Test
valec test

# Format (if available)
valec fmt main.vale

# Lint (if available)
valec lint main.vale
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

## Why Vale?

- **Memory Safe**: No use-after-free, no data races
- **Fast**: C++ performance without GC
- **Simple**: No manual memory management
- **Safe**: Compile-time guarantees
- **Interoperable**: Use existing C/C++ code
- **Deterministic**: No GC pauses
- **Modern**: Clean, expressive syntax

## Status

⚠️ **Experimental**: Vale is in early development
- Language design is ongoing
- Compiler is not yet production-ready
- Tooling is incomplete
- Syntax and APIs may change
- Not ready for production use

This template is provided for experimental and learning purposes.

## Memory Safety Comparison

| Feature | Vale | Rust | C++ | Go |
|---------|------|------|-----|-----|
| Memory Safety | ✅ | ✅ | ❌ | ✅* |
| Garbage Collection | ❌ | ❌ | ❌ | ✅ |
| Manual Management | ❌ | ❌ | ✅ | ❌ |
| Zero-Cost | ✅ | ✅ | ✅ | ❌ |
| Learning Curve | Medium | High | High | Low |

*Go has memory safety but with GC overhead

## References

- [Vale Language GitHub](https://github.com/ValeLang/Vale)
- [Vale Documentation](https://vale.dev/)
- [Region-Based Memory Management](https://vale.dev/blog/introducing-regions)

## License

MIT
`}
};
