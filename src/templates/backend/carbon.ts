import { BackendTemplate } from '../types';

export const carbonTemplate: BackendTemplate = {
  id: 'carbon',
  name: 'carbon',
  displayName: 'Carbon (C++ Interop)',
  description: 'Experimental successor to C++ with modern syntax, memory safety, and seamless C++ interoperability',
  language: 'cpp',
  framework: 'carbon',
  version: '1.0.0',
  tags: ['carbon', 'cpp', 'cpp-interop', 'memory-safety', 'modern', 'experimental', 'systems'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing'],

  files: {
    // Main Carbon file
    'main.carbon': `# {{projectName}} - Carbon Web Server with C++ Interop
package {{projectName}};

import Cpp library "carbon_cpp_interop.h";
import Cpp library "carbon_http.h";

# User struct
class User {
  var id: i32;
  var email: String;
  var name: String;
  var password: String;
  var role: String;

  fn Create[id: i32, email: String, password: String, name: String, role: String]() -> User {
    return .id = id,
           .email = email,
           .password = password,
           .name = name,
           .role = role;
  }
}

# Product struct
class Product {
  var id: i32;
  var name: String;
  var description: String;
  var price: f64;
  var stock: i32;

  fn Create[id: i32, name: String, description: String, price: f64, stock: i32]() -> Product {
    return .id = id,
           .name = name,
           .description = description,
           .price = price,
           .stock = stock;
  }
}

# In-memory database
var users: Array(User) = [
  User.Create(1, "admin@example.com", hash_password("admin123"), "Admin User", "admin"),
  User.Create(2, "user@example.com", hash_password("user123"), "Test User", "user")];

var products: Array(Product) = [
  Product.Create(1, "Sample Product 1", "This is a sample product", 29.99, 100),
  Product.Create(2, "Sample Product 2", "Another sample product", 49.99, 50)];

var user_id_counter: i32 = 3;
var product_id_counter: i32 = 3;

# Hash password using C++ crypto library
fn hash_password(password: String) -> String {
  # Use C++ interop for SHA256 hashing
  return Cpp.sha256(password);
}

# Generate JWT token using C++ library
fn generate_token(user: User) -> String {
  # Use C++ JWT library via interop
  return Cpp.generate_jwt(user.id, user.email, user.role);
}

# Find user by email
fn find_user_by_email(email: String) -> Optional(User) {
  for (user: User in users) {
    if (user.email == email) {
      return Some(user);
    }
  }
  return None;
}

# HTTP Response type
class HttpResponse {
  var status: i32;
  var headers: Map(String, String);
  var body: String;

  fn Create[status: i32, body: String]() -> HttpResponse {
    var response: HttpResponse;
    response.status = status;
    response.body = body;
    response.headers = Map(String, String);
    response.headers.insert("Content-Type", "application/json");
    return response;
  }

  fn WithHeader[self: Self, key: String, value: String]() -> Self {
    self.headers.insert(key, value);
    return self;
  }
}

# Health handler
fn health_handler(request: Cpp.HttpRequest) -> HttpResponse {
  var body = "{"status": "healthy", "timestamp": "" + Cpp.get_timestamp() + "", "version": "1.0.0"}";
  return HttpResponse.Create(200, body);
}

# Home handler
fn home_handler(request: Cpp.HttpRequest) -> HttpResponse {
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
    <p>High-performance server built with Carbon language</p>
    <p>Modern C++ successor with memory safety guarantees</p>
    <p>Seamless C++ interoperability for ecosystem access</p>
    <p>API available at: <a href="/api/v1/health">/api/v1/health</a></p>
  </body>
</html>
  """;

  var response = HttpResponse.Create(200, html);
  response.headers.insert("Content-Type", "text/html");
  return response;
}

# Register handler
fn register_handler(request: Cpp.HttpRequest) -> HttpResponse {
  # In production, parse JSON body from request
  var email = "user@example.com";
  var password = "password123";
  var name = "New User";

  # Check if user exists
  if (var existing_user: Optional(User) = find_user_by_email(email); existing_user.has_value()) {
    var body = "{"error": "Email already registered"}";
    return HttpResponse.Create(409, body);
  }

  # Create new user
  var new_user = User.Create(user_id_counter, email, hash_password(password), name, "user");
  user_id_counter = user_id_counter + 1;
  users.push(new_user);

  var token = generate_token(new_user);
  var body = "{"token": \\"" + token + "\\", "user": {"id": " + new_user.id + ", "email": \\"" + new_user.email + "\\", "name": \\"" + new_user.name + "\\", "role": \\"" + new_user.role + "\\"}}";
  return HttpResponse.Create(201, body);
}

# Login handler
fn login_handler(request: Cpp.HttpRequest) -> HttpResponse {
  var email = "admin@example.com";
  var password = "admin123";

  # Find user
  if (var user_opt: Optional(User) = find_user_by_email(email); user_opt.has_value()) {
    var user = user_opt.value();
    if (user.password == hash_password(password)) {
      var token = generate_token(user);
      var body = "{"token": \\"" + token + "\\", "user": {"id": " + user.id + ", "email": \\"" + user.email + "\\", "name": \\"" + user.name + "\\", "role": \\"" + user.role + "\\"}}";
      return HttpResponse.Create(200, body);
    } else {
      var body = "{"error": "Invalid credentials"}";
      return HttpResponse.Create(401, body);
    }
  } else {
    var body = "{"error": "Invalid credentials"}";
    return HttpResponse.Create(401, body);
  }
}

# List products handler
fn list_products_handler(request: Cpp.HttpRequest) -> HttpResponse {
  var body = "{"products": [";

  var i: i32 = 0;
  for (product: Product in products) {
    if (i > 0) {
      body += ",";
    }
    body += "{"id": " + product.id + ", "name": \\"" + product.name + "\\", "description": \\"" + product.description + "\\", "price": " + product.price + ", "stock": " + product.stock + "}";
    i = i + 1;
  }

  body += "], "count": " + products.size() + "}";
  return HttpResponse.Create(200, body);
}

# Get product handler
fn get_product_handler(request: Cpp.HttpRequest, product_id: i32) -> HttpResponse {
  for (product: Product in products) {
    if (product.id == product_id) {
      var body = "{"product": {"id": " + product.id + ", "name": \\"" + product.name + "\\", "description": \\"" + product.description + "\\", "price": " + product.price + ", "stock": " + product.stock + "}}";
      return HttpResponse.Create(200, body);
    }
  }

  var body = "{"error": "Product not found"}";
  return HttpResponse.Create(404, body);
}

# Create product handler
fn create_product_handler(request: Cpp.HttpRequest) -> HttpResponse {
  # In production, parse JSON body from request
  var name = "New Product";
  var description = "";
  var price: f64 = 29.99;
  var stock: i32 = 100;

  var new_product = Product.Create(product_id_counter, name, description, price, stock);
  product_id_counter = product_id_counter + 1;
  products.push(new_product);

  var body = "{"product": {"id": " + new_product.id + ", "name": \\"" + new_product.name + "\\"}}";
  return HttpResponse.Create(201, body);
}

# Update product handler
fn update_product_handler(request: Cpp.HttpRequest, product_id: i32) -> HttpResponse {
  for (i: i32 in products.indices()) {
    if (products[i].id == product_id) {
      # In production, parse JSON body from request and update
      var body = "{"product": {"id": " + products[i].id + ", "name": "Updated Product"}}";
      return HttpResponse.Create(200, body);
    }
  }

  var body = "{"error": "Product not found"}";
  return HttpResponse.Create(404, body);
}

# Delete product handler
fn delete_product_handler(request: Cpp.HttpRequest, product_id: i32) -> HttpResponse {
  for (i: i32 in products.indices()) {
    if (products[i].id == product_id) {
      # Remove product (simplified)
      products.erase(i);
      return HttpResponse.Create(204, "");
    }
  }

  var body = "{"error": "Product not found"}";
  return HttpResponse.Create(404, body);
}

# Main request router using C++ HTTP server
fn route_request(path: String, method: String, request: Cpp.HttpRequest) -> HttpResponse {
  if (path == "/") {
    return home_handler(request);
  } else if (path == "/api/v1/health") {
    return health_handler(request);
  } else if (path == "/api/v1/auth/register" && method == "POST") {
    return register_handler(request);
  } else if (path == "/api/v1/auth/login" && method == "POST") {
    return login_handler(request);
  } else if (path == "/api/v1/products" && method == "GET") {
    return list_products_handler(request);
  } else if (path.starts_with("/api/v1/products/") && method == "GET") {
    # Extract product ID (simplified)
    var parts = path.split("/");
    if (parts.size() >= 4) {
      var product_id = Cpp.parse_i32(parts[3]);
      return get_product_handler(request, product_id);
    }
  } else if (path == "/api/v1/products" && method == "POST") {
    return create_product_handler(request);
  } else {
    var body = "{"error": "Not found"}";
    return HttpResponse.Create(404, body);
  }
}

# Main function
fn Main() -> i32 {
  Cpp.println("🚀 Server starting at http://localhost:8080");
  Cpp.println("📚 API docs: http://localhost:8080/api/v1/health");
  Cpp.println("👤 Default admin: admin@example.com / admin123");

  # Use C++ HTTP server via interop
  var server = Cpp.HttpServer.Create(8080);

  # Set up routes
  server.AddRoute("GET", "/", home_handler);
  server.AddRoute("GET", "/api/v1/health", health_handler);
  server.AddRoute("POST", "/api/v1/auth/register", register_handler);
  server.AddRoute("POST", "/api/v1/auth/login", login_handler);
  server.AddRoute("GET", "/api/v1/products", list_products_handler);
  server.AddRoute("POST", "/api/v1/products", create_product_handler);

  # Add CORS middleware
  server.AddMiddleware(Cpp.CorsMiddleware.Create());

  Cpp.println("Server ready!");
  server.Start();

  return 0;
}
`,

    // C++ interop header
    'carbon_cpp_interop.h': `// {{projectName}} - C++ Interop Layer for Carbon

#pragma once

#include <string>
#include <chrono>
#include <iomanip>
#include <sstream>
#include <openssl/sha.h>
#include <jwt-cpp/jwt.h>

namespace Carbon {

// Get current timestamp
inline std::string get_timestamp() {
    auto now = std::chrono::system_clock::now();
    auto time = std::chrono::system_clock::to_time_t(now);
    std::stringstream ss;
    ss << std::put_time(std::localtime(&time), "%Y-%m-%dT%H:%M:%S");
    return ss.str();
}

// SHA256 hash for passwords
inline std::string sha256(const std::string& input) {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256_CTX sha256;
    SHA256_Init(&sha256);
    SHA256_Update(&sha256, input.c_str(), input.size());
    SHA256_Final(hash, &sha256);

    std::stringstream ss;
    for(int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        ss << std::hex << std::setw(2) << std::setfill('0') << (int)hash[i];
    }
    return ss.str();
}

// Generate JWT token
inline std::string generate_jwt(int user_id, const std::string& email, const std::string& role) {
    auto token = jwt::create()
        .set_issuer("{{projectName}}")
        .set_type("JWT")
        .set_payload_claim("user_id", jwt::claim(std::to_string(user_id)))
        .set_payload_claim("email", jwt::claim(email))
        .set_payload_claim("role", jwt::claim(role))
        .sign(jwt::algorithm::hs256{"secret-key-change-in-production"});
    return token;
}

// Parse integer
inline int parse_i32(const std::string& str) {
    return std::stoi(str);
}

// Print to console
inline void println(const std::string& message) {
    std::cout << message << std::endl;
}

} // namespace Carbon
`,

    // C++ HTTP server header
    'carbon_http.h': `// {{projectName}} - C++ HTTP Server for Carbon Interop

#pragma once

#include <string>
#include <functional>
#include <map>
#include <memory>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/version.hpp>
#include <boost/asio/strand.hpp>
#include <boost/config.hpp>

namespace beast = boost::beast;
namespace http = beast::http;
namespace net = boost::asio;
using tcp = net::ip::tcp;

namespace Carbon {

// HTTP Request
class HttpRequest {
public:
    std::string method;
    std::string path;
    std::string body;
    std::map<std::string, std::string> headers;

    std::string GetHeader(const std::string& key) const {
        auto it = headers.find(key);
        return it != headers.end() ? it->second : "";
    }
};

// HTTP Response
class HttpResponse {
public:
    int status;
    std::string body;
    std::map<std::string, std::string> headers;

    void SetHeader(const std::string& key, const std::string& value) {
        headers[key] = value;
    }
};

// Handler function type
using Handler = std::function<HttpResponse(HttpRequest)>;

// Middleware function type
using Middleware = std::function<HttpResponse(HttpRequest, Handler)>;

// CORS Middleware
class CorsMiddleware {
public:
    static Middleware Create() {
        return [](HttpRequest req, Handler next) -> HttpResponse {
            auto response = next(req);
            response.SetHeader("Access-Control-Allow-Origin", "*");
            response.SetHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            response.SetHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
            return response;
        };
    }
};

// HTTP Server
class HttpServer {
private:
    net::io_context& ioc_;
    tcp::acceptor acceptor_;
    std::map<std::string, Handler> get_routes_;
    std::map<std::string, Handler> post_routes_;
    std::vector<Middleware> middlewares_;

public:
    HttpServer(net::io_context& ioc, unsigned short port)
        : ioc_(ioc)
        , acceptor_(net::make_strand(ioc)) {
        beast::error_code ec;

        tcp::endpoint endpoint{tcp::v4(), port};
        acceptor_.open(endpoint.protocol(), ec);
        acceptor_.set_option(net::socket_base::reuse_address(true), ec);
        acceptor_.bind(endpoint, ec);
        acceptor_.listen(net::socket_base::max_listen_connections, ec);
    }

    static std::unique_ptr<HttpServer> Create(int port) {
        auto ioc = std::make_unique<net::io_context>(1);
        return std::make_unique<HttpServer>(*ioc, port);
    }

    void AddRoute(const std::string& method, const std::string& path, Handler handler) {
        if (method == "GET") {
            get_routes_[path] = handler;
        } else if (method == "POST") {
            post_routes_[path] = handler;
        }
    }

    void AddMiddleware(Middleware middleware) {
        middlewares_.push_back(middleware);
    }

    void Start() {
        // Simplified - actual implementation would have proper async handling
        std::cout << "Server started on port 8080" << std::endl;
        ioc_.run();
    }
};

} // namespace Carbon
`,

    // Carbon package configuration
    'Carbon.package': `package {{projectName}};

data {
  # Package metadata
  name: "{{projectName}}";
  version: "1.0.0";
  license: "MIT";

  # Dependencies
  cpp_import: "carbon_cpp_interop.h";
  cpp_import: "carbon_http.h";

  # Library dependencies (C++)
  cpp_library: "boost";
  cpp_library: "openssl";
  cpp_library: "jwt-cpp";

  # Build settings
  api: "carbon_2024";
  warnings: "all";
}
`,

    // Environment file
    '.env': `# Server Configuration
PORT=8080
ENV=development

# JWT Secret (change in production!)
JWT_SECRET=change-this-secret-in-production

# C++ Interop
CPP_STANDARD=20
BOOST_VERSION=1.85

# Logging
LOG_LEVEL=info
`,

    // .gitignore
    '.gitignore': `# Build output
*.carbon
*.o
*.a
build/
dist/
carbon-cache/

# Dependencies
cpp/build/
cpp/include/

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

# C++
*.d
*.ii
*.suo
`,

    // Dockerfile
    'Dockerfile': `FROM ubuntu:latest

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    cmake \\
    git \\
    libboost-all-dev \\
    libssl-dev \\
    nlohmann-json3-dev \\
    && rm -rf /var/lib/apt/lists/*

# Install Carbon (when available)
# RUN git clone https://github.com/carbon-language/carbon-lang.git /opt/carbon
# RUN cd /opt/carbon && cmake . && make install

# Copy source files
COPY . .

# Build Carbon project
# carbon build main.carbon

# Expose port
EXPOSE 8080

# Run with C++ interop
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
    restart: unless-stopped
`,

    // CMakeLists.txt for C++ interop
    'CMakeLists.txt': `cmake_minimum_required(VERSION 3.15)
project({{projectName}} CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find dependencies
find_package(Boost 1.85 REQUIRED COMPONENTS system)
find_package(OpenSSL REQUIRED)
find_package(nlohmann_json 3.10.0 REQUIRED)

# Include directories
include_directories(\${CMAKE_CURRENT_SOURCE_DIR}/cpp/include)

# Source files
set(SOURCES
    cpp/src/carbon_cpp_interop.cpp
    cpp/src/carbon_http.cpp
)

# Create executable
add_executable(main \${SOURCES})

# Link libraries
target_link_libraries(main
    Boost::system
    OpenSSL::SSL
    OpenSSL::Crypto
    nlohmann_json::nlohmann_json
)

# Install target
install(TARGETS main DESTINATION bin)
`,

    // README
    'README.md': `# {{projectName}}

High-performance web server built with Carbon language and C++ interoperability.

## Features

- **Carbon**: Experimental successor to C++ with modern syntax
- **C++ Interop**: Seamless integration with existing C++ ecosystem
- **Memory Safety**: Modern safety guarantees while maintaining C++ compatibility
- **Performance**: Zero-cost abstractions and efficient compilation
- **Type-Safe**: Strong typing with compile-time guarantees
- **Modern Syntax**: Clean, expressive syntax improving on C++
- **Backward Compatible**: Interoperate with existing C++ code

## Requirements

- Carbon compiler (experimental - follow https://github.com/carbon-language/carbon-lang)
- C++ compiler with C++20 support
- Boost libraries
- OpenSSL
- nlohmann/json

## Installation

\`\`\`bash
# Install Carbon (when available)
git clone https://github.com/carbon-language/carbon-lang.git
cd carbon-lang
cmake .
make install

# Install C++ dependencies
# Ubuntu/Debian
sudo apt-get install build-essential libboost-all-dev libssl-dev nlohmann-json3-dev

# Build
carbon build main.carbon

# Run
./main
\`\`\`

## Quick Start

### Development Mode
\`\`\`bash
# Build with debug info
carbon build main.carbon --debug

# Run
./main
\`\`\`

### Production Mode
\`\`\`bash
# Build with optimizations
carbon build main.carbon --release

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
main.carbon                # Main Carbon server and routes
carbon_cpp_interop.h       # C++ interop layer
carbon_http.h              # C++ HTTP server
Carbon.package             # Carbon package configuration
CMakeLists.txt             # C++ build configuration
.env                       # Environment variables
\`\`\`

## Carbon Features

- **Modern Syntax**: Clean improvements over C++ syntax
- **Memory Safety**: Generational references and checked accesses
- **C++ Interop**: Call C++ code directly from Carbon
- **Performance**: Zero-cost abstractions
- **Gradual Migration**: Migrate C++ codebases incrementally
- **Type System**: Improved type inference and checking
- **Package Management**: Built-in package system
- **Tooling**: Modern tooling with IDE support

## C++ Interoperability

Carbon is designed to interoperate seamlessly with C++:

\`\`\`carbon
# Import C++ library
import Cpp library "carbon_cpp_interop.h";

# Call C++ function
var hash = Cpp.sha256("password");

# Use C++ types
var server = Cpp.HttpServer.Create(8080);
\`\`\`

### Writing C++ Interop Layers

\`\`\`cpp
// carbon_cpp_interop.h
namespace Carbon {

inline std::string sha256(const std::string& input) {
    // C++ implementation
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256_CTX sha256;
    SHA256_Init(&sha256);
    SHA256_Update(&sha256, input.c_str(), input.size());
    SHA256_Final(hash, &sha256);
    // ... return hash
}

} // namespace Carbon
\`\`\`

## Memory Safety

Carbon introduces memory safety features:

- **Generational References**: Track object lifetimes
- **Checked Access**: Array bounds checking
- **No Null Pointers**: Optional types instead of null
- **Ownership**: Clear ownership semantics
- **No Data Races**: Safe concurrency primitives

## Performance

Carbon maintains C++ performance:

- **Zero-Cost Abstractions**: No runtime overhead for abstractions
- **Inline Functions**: Functions are inlined by default
- **Optimized Assembly**: Generates efficient machine code
- **Minimal Runtime**: No garbage collector or runtime overhead

## Development

\`\`\`bash
# Build
carbon build main.carbon

# Run
./main

# Test
carbon test

# Format (if available)
carbon fmt main.carbon

# Lint (if available)
carbon lint main.carbon
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

## Why Carbon?

- **Modern**: Fixes C++ pain points while keeping compatibility
- **Safe**: Memory safety without sacrificing performance
- **Fast**: C++-level performance with better syntax
- **Interoperable**: Use existing C++ code and libraries
- **Readable**: Clear, expressive syntax
- **Tooling**: Modern tooling and IDE support
- **Migration Path**: Gradual migration from C++

## Status

⚠️ **Experimental**: Carbon is in early development
- Language design is ongoing
- Compiler is not yet production-ready
- Tooling is incomplete
- Syntax and APIs may change
- Not ready for production use

This template is provided for experimental and learning purposes.

## Migration from C++

Carbon allows gradual migration:

\`\`\`carbon
# Mix Carbon and C++ code
import Cpp library "existing_cpp_header.h";

# Call existing C++ functions
var result = Cpp.existing_function();
\`\`\`

## References

- [Carbon Language GitHub](https://github.com/carbon-language/carbon-lang)
- [Carbon Tutorial](https://carbon-language.github.io/)
- [C++ Interop Guide](https://github.com/carbon-language/carbon-lang/tree/trunk/docs)

## License

MIT
`}
};
