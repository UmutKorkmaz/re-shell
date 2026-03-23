import { BackendTemplate } from '../types';

export const vexVTemplate: BackendTemplate = {
  id: 'vex-v',
  name: 'vex-v',
  displayName: 'Vex (V)',
  description: 'Express-like web framework for V language with routing and middleware',
  language: 'v',
  framework: 'vex',
  version: '1.0.0',
  tags: ['v', 'vex', 'express-like', 'routing', 'middleware', 'json'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'middleware'],

  files: {
    // Main application
    'src/main.v': `import vex
import json
import time

struct User {
    id    int    [json: 'id']
    email string [json: 'email']
    name  string [json: 'name']
    role  string [json: 'role']
}

struct Product {
    id          int    [json: 'id']
    name        string [json: 'name']
    description string [json: 'description']
    price       f64   [json: 'price']
    stock       int    [json: 'stock']
}

struct HealthResponse {
    status    string [json: 'status']
    timestamp string [json: 'timestamp']
    version   string [json: 'version']
}

struct AuthResponse {
    token string [json: 'token']
    user  User   [json: 'user']
}

// In-memory database
mut:
    users    = []User{}
    products = []Product{}

fn init_db() {
    // Initialize with default admin
    users << User{
        id: 1
        email: 'admin@example.com'
        name: 'Admin User'
        role: 'admin'
    }

    // Initialize with sample products
    products << Product{
        id: 1
        name: 'Sample Product 1'
        description: 'This is a sample product'
        price: 29.99
        stock: 100
    }

    products << Product{
        id: 2
        name: 'Sample Product 2'
        description: 'Another sample product'
        price: 49.99
        stock: 50
    }

    println('📦 Database initialized')
    println('👤 Default admin: admin@example.com / admin123')
}

fn health_handler(ctx vex.Context) vex.Response {
    response := HealthResponse{
        status: 'healthy'
        timestamp: time.now().format_ss()
        version: '1.0.0'
    }
    return ctx.json(response)
}

fn register_handler(ctx vex.Context) vex.Response {
    // Parse request body
    body := json.raw_decode(ctx.body) or {
        return ctx.json(map{'error': 'Invalid request'}).set_status(400)
    }

    // Check if user exists
    email := body.as_map()['email'].str()
    for user in users {
        if user.email == email {
            return ctx.json(map{'error': 'Email already registered'}).set_status(409)
        }
    }

    // Create new user
    mut new_user := User{
        id: users.len + 1
        email: email
        name: body.as_map()['name'].str()
        role: 'user'
    }
    users << new_user

    // Generate token
    token := 'jwt-token-for-\${new_user.id}'

    response := AuthResponse{
        token: token
        user: new_user
    }

    return ctx.json(response).set_status(201)
}

fn login_handler(ctx vex.Context) vex.Response {
    // Parse request body
    body := json.raw_decode(ctx.body) or {
        return ctx.json(map{'error': 'Invalid request'}).set_status(400)
    }

    email := body.as_map()['email'].str()
    password := body.as_map()['password'].str()

    // Find user
    for user in users {
        if user.email == email {
            // In production, verify password hash
            token := 'jwt-token-for-\${user.id}'
            response := AuthResponse{
                token: token
                user: user
            }
            return ctx.json(response)
        }
    }

    return ctx.json(map{'error': 'Invalid credentials'}).set_status(401)
}

fn list_products_handler(ctx vex.Context) vex.Response {
    return ctx.json(map{
        'products': products
        'count': products.len
    })
}

fn get_product_handler(ctx vex.Context) vex.Response {
    id := ctx.param('id').int()

    for product in products {
        if product.id == id {
            return ctx.json(map{'product': product})
        }
    }

    return ctx.json(map{'error': 'Product not found'}).set_status(404)
}

fn create_product_handler(ctx vex.Context) vex.Response {
    // Parse request body
    body := json.raw_decode(ctx.body) or {
        return ctx.json(map{'error': 'Invalid request'}).set_status(400)
    }

    mut new_product := Product{
        id: products.len + 1
        name: body.as_map()['name'].str()
        description: body.as_map()['description'].str()
        price: body.as_map()['price'].f64()
        stock: body.as_map()['stock'].int()
    }

    products << new_product

    return ctx.json(map{'product': new_product}).set_status(201)
}

fn update_product_handler(ctx vex.Context) vex.Response {
    id := ctx.param('id').int()

    mut found := false
    mut product := Product{}

    for i in 0 .. products.len {
        if products[i].id == id {
            found = true
            product = products[i]

            // Parse request body
            body := json.raw_decode(ctx.body) or {
                return ctx.json(map{'error': 'Invalid request'}).set_status(400)
            }

            // Update fields
            if 'name' in body.as_map() {
                product.name = body.as_map()['name'].str()
            }
            if 'description' in body.as_map() {
                product.description = body.as_map()['description'].str()
            }
            if 'price' in body.as_map() {
                product.price = body.as_map()['price'].f64()
            }
            if 'stock' in body.as_map() {
                product.stock = body.as_map()['stock'].int()
            }

            products[i] = product
            break
        }
    }

    if found {
        return ctx.json(map{'product': product})
    }

    return ctx.json(map{'error': 'Product not found'}).set_status(404)
}

fn delete_product_handler(ctx vex.Context) vex.Response {
    id := ctx.param('id').int()

    for i in 0 .. products.len {
        if products[i].id == id {
            products.delete(i)
            return ctx.response('').set_status(204)
        }
    }

    return ctx.json(map{'error': 'Product not found'}).set_status(404)
}

fn main() {
    // Initialize database
    init_db()

    // Create Vex app
    mut app := vex.new()

    // Middleware
    app.use(fn (ctx vex.Context) vex.Response {
        println('\${ctx.method} \${ctx.path}')
        return ctx.next()
    })

    // Routes
    app.get('/api/v1/health', health_handler)

    // Auth routes
    app.post('/api/v1/auth/register', register_handler)
    app.post('/api/v1/auth/login', login_handler)

    // Product routes
    app.get('/api/v1/products', list_products_handler)
    app.get('/api/v1/products/:id', get_product_handler)
    app.post('/api/v1/products', create_product_handler)
    app.put('/api/v1/products/:id', update_product_handler)
    app.delete('/api/v1/products/:id', delete_product_handler)

    // Start server
    println('🚀 Server running at http://localhost:8080')
    println('📚 API docs: http://localhost:8080/api/v1/health')

    app.run(8080)
}
`,

    // Dockerfile
    'Dockerfile': `FROM vlang/v:latest
WORKDIR /app
COPY src ./src
RUN v -prod src/main.v
EXPOSE 8080
CMD ["./main"]
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
    'tests/test.v': `importtesting

fn test_user_struct() {
    user := User{
        id: 1
        email: 'test@example.com'
        name: 'Test User'
        role: 'user'
    }
    assert user.email == 'test@example.com'
    assert user.name == 'Test User'
}

fn test_product_struct() {
    product := Product{
        id: 1
        name: 'Test Product'
        description: 'Description'
        price: 29.99
        stock: 100
    }
    assert product.name == 'Test Product'
    assert product.price == 29.99
}
`,

    // README
    'README.md': `# {{projectName}}

REST API built with Vex framework for V language.

## Features

- **Vex**: Express-like web framework
- **Routing**: Simple and intuitive routing
- **JSON**: Built-in JSON serialization
- **Middleware**: Composable middleware system
- **Type-safe**: Compile-time type checking
- **Fast**: Native compilation

## Requirements

- V 0.4+

## Quick Start

\`\`\`bash
v run src/main.v
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
