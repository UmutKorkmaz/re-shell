import { BackendTemplate } from '../types';

export const rocTemplate: BackendTemplate = {
  id: 'roc',
  name: 'roc',
  displayName: 'Roc (Functional Platform)',
  description: 'Functional language for web services with platform support, immutable data, and ergonomic syntax',
  language: 'roc',
  framework: 'roc',
  version: '1.0.0',
  tags: ['roc', 'functional', 'platform', 'immutable', 'type-safe', 'modern', 'experimental'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing'],

  files: {
    // Main Roc file
    'main.roc': `# {{projectName}} - Roc Functional Web Server
app [main] {
    # Import platform modules
    import pf.Http.Server
    import pf.Http.Request
    import pf.Http.Response
    import pf.Crypto.Hash
    import pf.Json

    # User record
    User : {
        id : U64,
        email : Str,
        name : Str,
        password : Str,
        role : Str}

    # Product record
    Product : {
        id : U64,
        name : Str,
        description : Str,
        price : F64,
        stock : U64}

    # Auth response
    AuthResponse : {
        token : Str,
        user : User}

    # In-memory database (using list for immutability)
    users : List User = [
        { id: 1, email: "admin@example.com", password: hash_password("admin123"), name: "Admin User", role: "admin" },
        { id: 2, email: "user@example.com", password: hash_password("user123"), name: "Test User", role: "user" }]

    products : List Product = [
        { id: 1, name: "Sample Product 1", description: "This is a sample product", price: 29.99, stock: 100 },
        { id: 2, name: "Sample Product 2", description: "Another sample product", price: 49.99, stock: 50 }]

    # Counters for IDs
    userIdCounter : U64 = 3
    productIdCounter : U64 = 3

    # Hash password (simplified - use proper crypto in production)
    hash_password = |password|
        password |> Hash.sha256 |> Str.from_utf8

    # Generate JWT token (simplified)
    generate_token = |user|
        # In production, use proper JWT library
        "jwt-token-placeholder"

    # Find user by email
    find_user_by_email = |email, usersList|
        usersList
        |> List.find_first(|user| user.email == email)

    # Health handler
    health_handler = |_request|
        {
            status: "healthy",
            timestamp: "now",
            version: "1.0.0"}
        |> Json.to_str
        |> Response.ok
        |> Response.with_header("Content-Type", "application/json")

    # Home handler
    home_handler = |_request|
        """
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
    <p>Functional web server built with Roc language</p>
    <p>Platform support for web services and CLI tools</p>
    <p>Immutable data with ergonomic syntax</p>
    <p>API available at: <a href="/api/v1/health">/api/v1/health</a></p>
  </body>
</html>
        """
        |> Response.ok
        |> Response.with_header("Content-Type", "text/html")

    # Register handler
    register_handler = |_request, currentUsers|
        # In production, parse JSON body from request
        email = "user@example.com"
        password = "password123"
        name = "New User"

        # Check if user exists
        result = find_user_by_email(email, currentUsers)
        |> Result.map_err(|_| {
            error: "Email already registered"})
        |> Result.map(|_|
            # Create new user
            newUser = {
                id: userIdCounter,
                email: email,
                password: hash_password(password),
                name: name,
                role: "user"}

            token = generate_token(newUser)

            # Update users list (immutable)
            updatedUsers = List.append(currentUsers, [newUser])

            # Update counter
            userIdCounter = userIdCounter + 1

            # Return response
            {
                token: token,
                user: newUser}
            |> Json.to_str
            |> Response.created
            |> Response.with_header("Content-Type", "application/json")
            |> Ok
        )

        # Handle result
        when result is
            Ok(response) -> response
            Err(errorResponse) ->
                ErrorResponse
                |> Json.to_str
                |> Response.conflict
                |> Response.with_header("Content-Type", "application/json")

    # Login handler
    login_handler = |_request, currentUsers|
        email = "admin@example.com"
        password = "admin123"

        result = find_user_by_email(email, currentUsers)
        |> Result.map_err(|_|
            { error: "Invalid credentials" }
        )
        |> Result.and_then(|user|
            if user.password == hash_password(password) then
                token = generate_token(user)
                {
                    token: token,
                    user: user}
                |> Json.to_str
                |> Response.ok
                |> Response.with_header("Content-Type", "application/json")
                |> Ok
            else
                { error: "Invalid credentials" }
                |> Json.to_str
                |> Response.unauthorized
                |> Response.with_header("Content-Type", "application/json")
                |> Ok
        )

        when result is
            Ok(response) -> response
            Err(errorResponse) ->
                errorResponse
                |> Json.to_str
                |> Response.unauthorized
                |> Response.with_header("Content-Type", "application/json")

    # List products handler
    list_products_handler = |_request|
        {
            products: products,
            count: products |> List.len}
        |> Json.to_str
        |> Response.ok
        |> Response.with_header("Content-Type", "application/json")

    # Get product handler
    get_product_handler = |_request, idStr|
        # Parse ID
        result = idStr
        |> Str.to_u64

        when result is
            Ok(id) ->
                products
                |> List.find_first(|product| product.id == id)
                |> Result.map_err(|_|
                    { error: "Product not found" }
                )
                |> Result.map(|product|
                    { product: product }
                    |> Json.to_str
                    |> Response.ok
                    |> Response.with_header("Content-Type", "application/json")
                )
                |> (
                    |result|
                    when result is
                        Ok(response) -> response
                        Err(errorResponse) ->
                            errorResponse
                            |> Json.to_str
                            |> Response.not_found
                            |> Response.with_header("Content-Type", "application/json")
                )
            Err(_) ->
                { error: "Invalid product ID" }
                |> Json.to_str
                |> Response.bad_request
                |> Response.with_header("Content-Type", "application/json")

    # Create product handler
    create_product_handler = |_request|
        # In production, parse JSON body from request
        newProduct = {
            id: productIdCounter,
            name: "New Product",
            description: "",
            price: 29.99,
            stock: 100}

        # Update products list
        updatedProducts = List.append(products, [newProduct])

        # Update counter
        productIdCounter = productIdCounter + 1

        { product: newProduct }
        |> Json.to_str
        |> Response.created
        |> Response.with_header("Content-Type", "application/json")

    # Main request router
    route_request = |request|
        path = request.path
        method = request.method

        if path == "/" then
            home_handler(request)
        else if path == "/api/v1/health" then
            health_handler(request)
        else if path == "/api/v1/auth/register" and method == "POST" then
            register_handler(request, users)
        else if path == "/api/v1/auth/login" and method == "POST" then
            login_handler(request, users)
        else if path == "/api/v1/products" and method == "GET" then
            list_products_handler(request)
        else if path |> Str.starts_with("/api/v1/products/") and method == "GET" then
            # Extract product ID (simplified)
            parts = path |> Str.split("/")
            if parts |> List.len >= 4 then
                idStr = parts |> List.get_default(2, "")
                get_product_handler(request, idStr)
            else
                { error: "Invalid product ID" }
                |> Json.to_str
                |> Response.bad_request
                |> Response.with_header("Content-Type", "application/json")
        else if path == "/api/v1/products" and method == "POST" then
            create_product_handler(request)
        else
            { error: "Not found" }
            |> Json.to_str
            |> Response.not_found
            |> Response.with_header("Content-Type", "application/json")

    # CORS middleware
    cors_middleware = |request, next|
        response = next(request)
        response
        |> Response.with_header("Access-Control-Allow-Origin", "*")
        |> Response.with_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        |> Response.with_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    # Main function
    main = |_args|
        # Start HTTP server
        Server.serve(
            port = 8080,
            handler = cors_middleware(route_request),
        )
        |> Task.await

        # Print startup message
        """
🚀 Server starting at http://localhost:8080
📚 API docs: http://localhost:8080/api/v1/health
👤 Default admin: admin@example.com / admin123
        """
        |> Str.print
}
`,

    // Roc package configuration
    'roc.toml': `# {{projectName}} Package Configuration

[package]
name = "{{projectName}}"
version = "1.0.0"
license = "MIT"

[dependencies]
# Platform modules
pf_http = "https://github.com/roc-lang/platform.git#main"
pf_crypto = "https://github.com/roc-lang/platform.git#main"
pf_json = "https://github.com/roc-lang/platform.git#main"

[build]
target = "native"
optimize = true

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

# Roc Compiler
ROC_VERSION=0.1.0

# Logging
LOG_LEVEL=info
`,

    // .gitignore
    '.gitignore': `# Build output
*.roc
*.o
*.a
*.so
*.dylib
*.dll
build/
dist/
roc-cache/

# Dependencies
platform/

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

# Roc specific
.roc/
repl-history
`,

    // Dockerfile
    'Dockerfile': `FROM ubuntu:latest

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    git \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Install Roc compiler
RUN curl -L https://github.com/roc-lang/roc/releases/latest/download/roc-linux-x64.tar.gz | tar xz
RUN mv roc /usr/local/bin/
RUN roc --version

# Copy source files
COPY . .

# Build Roc project
RUN roc build main.roc

# Expose port
EXPOSE 8080

# Run
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

    // README
    'README.md': `# {{projectName}}

Functional web server built with Roc language for platform development.

## Features

- **Roc**: Functional language for web services and CLI tools
- **Platform Support**: Built-in platform modules for common tasks
- **Immutable Data**: Default immutable data structures
- **Type-Safe**: Strong static typing with type inference
- **Ergonomic Syntax**: Clean, expressive syntax
- **Pattern Matching**: Powerful destructuring and matching
- **Performance**: Compiled to native code
- **Package Management**: Built-in package ecosystem

## Requirements

- Roc compiler (latest)
- Platform modules

## Installation

\`\`\`bash
# Install Roc (follow https://github.com/roc-lang/roc)
curl -L https://github.com/roc-lang/roc/releases/latest/download/roc-linux-x64.tar.gz | tar xz
sudo mv roc /usr/local/bin/

# Clone platform modules
git clone https://github.com/roc-lang/platform.git

# Build
roc build main.roc

# Run
./main
\`\`\`

## Quick Start

### Development Mode
\`\`\`bash
# Build
roc build main.roc

# Run
./main

# Test
roc test
\`\`\`

### Production Mode
\`\`\`bash
# Build with optimizations
roc build --optimize main.roc

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
main.roc           # Main server and routes
roc.toml           # Roc package configuration
.env               # Environment variables
\`\`\`

## Roc Features

- **Functional**: Pure functions and immutable data
- **Type Inference**: Types inferred automatically
- **Pattern Matching**: Powerful destructuring
- **Platform Modules**: Built-in modules for common tasks
- **Package Manager**: Easy dependency management
- **REPL**: Interactive development environment
- **Tooling**: Formatters, linters, test runners

## Functional Programming

Roc embraces functional programming:

\`\`\`roc
# Immutable data structures
users = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]

# Pipe operator for composition
result = users
|> List.map(|user| user.name)
|> List.join(", ")

# Pattern matching
when result is
    Ok(value) -> Str.print("Success: \${value}")
    Err(error) -> Str.print("Error: \${error}")
\`\`\`

## Pattern Matching

Roc has powerful pattern matching:

\`\`\`roc
when user is
    { role: "admin", name: adminName } ->
        "Admin: \${adminName}"
    { role: "user", name: userName } ->
        "User: \${userName}"
    _ ->
        "Unknown"
\`\`\`

## Type System

Roc has a strong static type system with inference:

\`\`\`roc
# Type annotations are optional
add = |x, y| x + y

# Records
User : {
    id : U64,
    name : Str,
    email : Str}

# Tags (sum types)
Result : [Ok Str, Err Str]
\`\`\`

## Platform Modules

Roc includes platform modules for common tasks:

\`\`\`roc
import pf.Http.Server
import pf.Crypto.Hash
import pf.Json

# Use platform modules
Server.serve(port = 8080, handler = handle_request)
hash = Hash.sha256("password")
json_str = Json.to_str({ data: "value" })
\`\`\`

## Development

\`\`\`bash
# Build
roc build main.roc

# Run
./main

# Test
roc test

# Format (if available)
roc fmt main.roc

# REPL
roc repl
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

## Why Roc?

- **Simple**: Clean syntax and semantics
- **Safe**: Type system prevents bugs
- **Fast**: Compiled to native code
- **Functional**: Embraces functional programming
- **Ergonomic**: Designed for developer happiness
- **Platform**: Built-in modules for common tasks
- **Package Manager**: Easy dependency management

## Status

⚠️ **Beta**: Roc is in beta development
- Language is stabilizing
- Tooling is improving
- Documentation is growing
- Not yet production-ready for most use cases

This template is provided for experimental and learning purposes.

## Functional Programming Benefits

- **Immutability**: No unexpected mutations
- **Pure Functions**: Predictable behavior
- **Type Safety**: Compile-time error detection
- **Pattern Matching**: Elegant conditional logic
- **Composability**: Small functions compose well

## References

- [Roc Language GitHub](https://github.com/roc-lang/roc)
- [Roc Documentation](https://github.com/roc-lang/roc#readme)
- [Platform Modules](https://github.com/roc-lang/platform)

## License

MIT
`}
};
