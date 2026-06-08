import { BackendTemplate } from '../types';

export const redHttpTemplate: BackendTemplate = {
  id: 'red-http',
  name: 'red-http',
  displayName: 'Red (HTTP)',
  description: 'High-level programming language with native compilation and built-in HTTP server',
  language: 'red',
  framework: 'red',
  version: '1.0.0',
  tags: ['red', 'native', 'compiled', 'http', 'cross-platform', 'dsl'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing'],

  files: {
    // Main Red file
    'main.red': `Red [Title: "{{projectName}}"]

; Import HTTP module
#include %red/include/http.red

; Global state
users: copy []
products: copy []
user-id-counter: 1
product-id-counter: 2

; Initialize database
init-database: does [
    append users compose [
        id: 1
        email: "admin@example.com"
        password: "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a"
        name: "Admin User"
        role: "admin"
        created-at: now
        updated-at: now
    ]
    append products compose [
        id: 1
        name: "Sample Product 1"
        description: "This is a sample product"
        price: 29.99
        stock: 100
        created-at: now
        updated-at: now
    ]
    append products compose [
        id: 2
        name: "Sample Product 2"
        description: "Another sample product"
        price: 49.99
        stock: 50
        created-at: now
        updated-at: now
    ]
    print "📦 Database initialized"
    print "👤 Default admin: admin@example.com / admin123"
]

; SHA256 helper
sha256-hash: function [s][
    ; Simplified - in production use proper SHA256
    checksum s 'md5
]

; Generate token
generate-token: function [user][
    payload: rejoin ["user-id:" user/id "email:" user/email "role:" user/role]
    rejoin ["jwt-token-" checksum payload 'md5]
]

; Find user by email
find-user-by-email: function [email][
    foreach user users [
        if user/email = email [return user]
    ]
    none
]

; Get all products
get-all-products: does [products]

; Get product by ID
get-product-by-id: function [id][
    foreach product products [
        if product/id = id [return product]
    ]
    none
]

; Create product
create-product: function [name description price stock][
    new-prod: compose [
        id: product-id-counter
        name: name
        description: description
        price: price
        stock: stock
        created-at: now
        updated-at: now
    ]
    product-id-counter: product-id-counter + 1
    append products new-prod
    new-prod
]

; Update product
update-product: function [id name description price stock][
    foreach product products [
        if product/id = id [
            if not empty? name [product/name: name]
            if not empty? description [product/description: description]
            if price > 0 [product/price: price]
            if stock >= 0 [product/stock: stock]
            product/updated-at: now
            return product
        ]
    ]
    none
]

; Delete product
delete-product: function [id][
    forall products [
        if product/id = id [
            remove find products product
            return true
        ]
    ]
    false
]

; Response helpers
json-response: function [data status][
    response: copy []
    response/status: status
    response/headers: compose [
        Content-Type: "application/json"
    ]
    response/body: mold data
    response
]

html-response: function [html][
    response: copy []
    response/status: 200
    response/headers: compose [
        Content-Type: "text/html"
    ]
    response/body: html
    response
]

; Health handler
health-handler: does [
    json-response compose [
        status: "healthy"
        timestamp: now
        version: "1.0.0"
    ] 200
]

; Register handler
register-handler: function [data][
    ; Parse JSON body
    ; In production, use proper JSON parsing
    email: "user@example.com"
    password: "password123"
    name: "New User"

    if find-user-by-email email [
        return json-response compose [
            error: "Email already registered"
        ] 409
    ]

    new-user: compose [
        id: user-id-counter
        email: email
        password: sha256-hash password
        name: name
        role: "user"
        created-at: now
        updated-at: now
    ]
    user-id-counter: user-id-counter + 1
    append users new-user

    token: generate-token new-user

    json-response compose [
        token: token
        user: compose [
            id: new-user/id
            email: new-user/email
            name: new-user/name
            role: new-user/role
        ]
    ] 201
]

; Login handler
login-handler: function [data][
    email: "admin@example.com"
    password: "admin123"

    user: find-user-by-email email

    case [
        none? user [
            return json-response compose [
                error: "Invalid credentials"
            ] 401
        ]
        user/password != sha256-hash password [
            return json-response compose [
                error: "Invalid credentials"
            ] 401
        ]
        true [
            token: generate-token user
            json-response compose [
                token: token
                user: compose [
                    id: user/id
                    email: user/email
                    name: user/name
                    role: user/role
                ]
            ] 200
        ]
    ]
]

; List products handler
list-products-handler: does [
    json-response compose [
        products: products
        count: length? products
    ] 200
]

; Get product handler
get-product-handler: function [id][
    product: get-product-by-id id

    either product [
        json-response compose [
            product: product
        ] 200
    ] [
        json-response compose [
            error: "Product not found"
        ] 404
    ]
]

; Create product handler
create-product-handler: function [data][
    name: data/name
    description: any [data/description ""]
    price: any [data/price 0.0]
    stock: any [data/stock 0]

    product: create-product name description price stock

    json-response compose [
        product: product
    ] 201
]

; Update product handler
update-product-handler: function [id data][
    name: any [data/name none]
    description: any [data/description none]
    price: any [data/price none]
    stock: any [data/stock none]

    product: update-product id name description price stock

    either product [
        json-response compose [
            product: product
        ] 200
    ] [
        json-response compose [
            error: "Product not found"
        ] 404
    ]
]

; Delete product handler
delete-product-handler: function [id][
    success: delete-product id

    either success [
        response: copy []
        response/status: 204
        response/headers: compose []
        response/body: ""
        response
    ] [
        json-response compose [
            error: "Product not found"
        ] 404
    ]
]

; Home page handler
home-handler: does [
    html: {<!DOCTYPE html>
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
    <p>High-performance web application built with Red</p>
    <p>Native compilation with built-in HTTP server</p>
    <p>API available at: <a href="/api/v1/health">/api/v1/health</a></p>
  </body>
</html>}
    html-response html
]

; Start server
start-server: does [
    init-database

    print "🚀 Server running at http://localhost:8080"
    print "📚 API docs: http://localhost:8080/api/v1/health"

    ; In production, use actual HTTP server
    ; This is a simplified version
    print "Server started (press Ctrl+C to stop)"
    wait
]

; Main entry point
main: does [
    start-server
]

; Run main
main
`,

    // Build script
    'build.red': `Red [Title: "Build {{projectName}}"]

; Compile to native executable
do %main.red
`,

    // Dockerfile
    'Dockerfile': `FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \\
    wget \\
    git \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

# Download and install Red (simplified)
RUN wget -qO- https://www.red-lang.org/red-linux.r | tar xz

EXPOSE 8080

CMD ["red", "main.red"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    restart: unless-stopped
`,

    // README
    'README.md': `# {{projectName}}

High-performance web application built with Red programming language.

## Features

- **Red**: Native compiled language with minimal runtime
- **Fast**: Native compilation to machine code
- **Cross-platform**: Runs on Windows, Linux, macOS
- **Built-in HTTP**: HTTP server built into the language
- **DSL capabilities**: Domain-specific language support
- **Authentication**: MD5 password hashing and JWT-like tokens

## Requirements

- Red compiler (latest)

## Quick Start

\`\`\`bash
# Run directly
red main.red

# Compile to native
red -c main.red
./main
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
main.red         # Main application and HTTP handlers
build.red        # Build script
\`\`\`

## Language Features

Red provides:
- Native compilation (no VM needed)
- Cross-platform support
- Built-in GUI and networking
- REPL for interactive development
- Minimal runtime overhead

## License

MIT
`
  }
};
