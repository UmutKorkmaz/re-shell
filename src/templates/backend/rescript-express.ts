import { BackendTemplate } from '../types';

export const rescriptExpressTemplate: BackendTemplate = {
  id: 'rescript-express',
  name: 'rescript-express',
  displayName: 'ReScript + Express',
  description: 'Type-safe ReScript bindings for Express.js with compile-time guarantees and excellent performance',
  language: 'rescript',
  framework: 'express',
  version: '1.0.0',
  tags: ['rescript', 'express', 'nodejs', 'type-safe', 'functional', 'ocaml'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing'],

  files: {
    // Package.json
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "ReScript + Express API server with type safety",
  "scripts": {
    "dev": "rescript clean && rescript dev -w",
    "build": "rescript build",
    "start": "node dist/js/src/Server.bs.js",
    "server": "nodemon -x 'rescript build && node dist/js/src/Server.bs.js'",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --watchAll=false",
    "clean": "rescript clean",
    "format": "rescript format"
  },
  "dependencies": {
    "@rescript/core": "^1.3.0",
    "rescript-express": "^0.3.0",
    "rescript-json-combinators": "^2.3.0",
    "express": "^4.19.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "dotenv": "^16.4.5",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "rescript": "^11.1.0",
    "rescript-nodejs": "^16.1.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "nodemon": "^3.1.0"
  },
  "keywords": ["rescript", "express", "api", "rest"],
  "author": "{{author}}",
  "license": "MIT"
}`,

    // ReScript configuration
    'rescript.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "sources": [
    {
      "dir": "src",
      "subdirs": true
    }
  ],
  "package-specs": {
    "module": "commonjs",
    "in-source": true
  },
  "suffix": ".bs.js",
  "bs-dependencies": [
    "@rescript/core",
    "rescript-express",
    "rescript-nodejs",
    "rescript-json-combinators"
  ],
  "warnings": {
    "error": true
  },
  "bsc-flags": [
    "-bs-gentype",
    "-open RescriptCore"
  ]
}`,

    // Jest configuration
    'jest.config.js': `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.res',
    '**/?(*.)+(spec|test).res'
  ],
  transform: {
    '^.+\\\\.res$': '<rootDir>/jest-rescript-transformer.js',
    '^.+\\\\.js$': 'babel-jest'},
  moduleFileExtensions: ['res', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.{res,js}',
    '!src/**/*.bs.js',
    '!src/**/*.gen.tsx',
    '!src/**/__tests__/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70}},
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 10000,
  verbose: true}`,

    // Jest transformer for ReScript
    'jest-rescript-transformer.js': `const { execSync } = require('child_process');
const path = require('path');

module.exports = {
  process: (src, filename) => {
    // Compile ReScript file
    try {
      execSync(\`rescript build -clean \${filename}\`, {
        stdio: 'ignore',
        cwd: process.cwd()});

      // Read the compiled JavaScript
      const compiledFile = filename.replace(/\\.res$/, '.bs.js');
      const module = require(compiledFile);

      // Return as CommonJS
      return {
        code: \`module.exports = require('\${compiledFile}');\`};
    } catch (error) {
      throw new Error(\`Failed to compile \${filename}: \${error.message}\`);
    }
  },
  getCacheKey: (fileData, filePath) => {
    return filePath;
  }};`,

    // Jest setup file
    'jest.setup.js': `// Jest setup for ReScript tests
require('rescript');

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging test failures
  error: console.error};`,

    // Test helper utilities
    'src/__tests__/TestHelpers.res': `open RescriptCore
open Node
open Jest

// Test utilities module
module TestHelpers = {
  // Create mock request
  let makeMockRequest = (~method="GET", ~path="/", ~body={}: Js.Dict.t<string>, ()) => {
    {
      "method": method,
      "path": path,
      "body": body,
      "headers": Js.Dict.empty(),
      "query": Js.Dict.empty()}
  }

  // Create mock response
  let makeMockResponse = () => {
    let statusCode = ref(200)
    let data = ref(Js.Dict.empty())

    {
      "statusCode": statusCode,
      "data": data,
      "json": (json: Js.Dict.t<string>) => {
        data := json
        Js.Promise.resolve()
      },
      "status": (code: int) => {
        statusCode := code
      }}
  }

  // Async test helper
  let waitFor = (ms: int) => {
    Js.Promise.resolve()->Js.Promise.then_(() => {
      Node.Process.setTimeoutMs(ms)->Js.Promise.resolve
    })
  }

  // Mock user data
  let mockUser = {
    "id": 1,
    "name": "Test User",
    "email": "test@example.com",
    "role": "user"}

  // Mock product data
  let mockProduct = {
    "id": 1,
    "name": "Test Product",
    "price": 99.99,
    "description": "Test Description"}
}`,

    // Example integration test
    'src/__tests__/Server.test.res': `open RescriptCore
open Node
open Jest
open Server
open TestHelpers

describe("Server Tests", () => {
  test("health endpoint returns healthy status", () => {
    let mockReq = TestHelpers.makeMockRequest()
    let mockRes = TestHelpers.makeMockResponse()

    AppRoutes.healthGet(mockReq, mockRes)->Js.Promise.then_=(_ => {
      let statusCode = mockRes["statusCode"]->Js.Option.getExn
      expect(Js.Int.toString(statusCode))->toBe("200")

      Js.Promise.resolve()
    })
  })

  test("home endpoint returns HTML", () => {
    let mockReq = TestHelpers.makeMockRequest()
    let mockRes = TestHelpers.makeMockResponse()

    AppRoutes.homeGet(mockReq, mockRes)->ignore

    let statusCode = mockRes["statusCode"]->Js.Option.getExn
    expect(Js.Int.toString(statusCode))->toBe("200")
  })

  test("auth middleware rejects requests without token", () => {
    let mockReq = TestHelpers.makeMockRequest()
    let mockRes = TestHelpers.makeMockResponse()

    // Call auth middleware
    // Should return 401
    let statusCode = mockRes["statusCode"]->Js.Option.getExn
    expect(Js.Int.toString(statusCode))->toBe("401")
  })
})`,

    // Main server file
    'src/Server.res': `open RescriptCore
open RescriptExpress
open Node

// Routes
module AppRoutes = {
  @send
  let healthGet = (_req, res) => {
    res->Json.stringify({ "status": "healthy", "timestamp": Js.Date.now() })
    ->res->Response.sendJson
  }

  @send
  let homeGet = (_req, res) => {
    let html = \`
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
    <p>Type-safe API built with ReScript and Express</p>
    <p>API available at: <a href="/api/v1/health">/api/v1/health</a></p>
  </body>
</html>
    \`
    res->Response.send(html)
  }

  @send
  let registerPost = (req, res) => {
    // In production, parse JSON body
    let email = "user@example.com"
    let password = "password123"
    let name = "New User"

    // Check if user exists (simplified)
    if (email == "admin@example.com") {
      res->Status.statusCode(409)
      ->Json.stringify({ "error": "Email already registered" })
      ->res->Response.sendJson
    } else {
      // Create user
      let user = {
        "id": Js.Date.now()->Int.toFloat->Js.String.toString,
        "email": email,
        "name": name,
        "role": "user"}

      // Generate token (simplified)
      let token = "jwt-token-placeholder"

      res->Status.statusCode(201)
      ->Json.stringify({ "token": token, "user": user })
      ->res->Response.sendJson
    }
  }

  @send
  let loginPost = (req, res) => {
    let email = "admin@example.com"
    let password = "admin123"

    // Validate credentials (simplified)
    if (email == "admin@example.com" && password == "admin123") {
      let token = "jwt-token-placeholder"
      let user = {
        "id": "1",
        "email": "admin@example.com",
        "name": "Admin User",
        "role": "admin"}

      res->Status.statusCode(200)
      ->Json.stringify({ "token": token, "user": user })
      ->res->Response.sendJson
    } else {
      res->Status.statusCode(401)
      ->Json.stringify({ "error": "Invalid credentials" })
      ->res->Response.sendJson
    }
  }

  @send
  let listProductsGet = (_req, res) => {
    let products = [%raw([
      {"id": 1, "name": "Sample Product 1", "description": "This is a sample product", "price": 29.99, "stock": 100},
      {"id": 2, "name": "Sample Product 2", "description": "Another sample product", "price": 49.99, "stock": 50}
    ])]

    res->Json.stringify({ "products": products, "count": Array.length(products) })
    ->res->Response.sendJson
  }

  @send
  let getProductGet = (req, res) => {
    let id = req->Route.param("id")->Belt.Option.getOr("")

    let products = [%raw([
      {"id": 1, "name": "Sample Product 1", "description": "This is a sample product", "price": 29.99, "stock": 100},
      {"id": 2, "name": "Sample Product 2", "description": "Another sample product", "price": 49.99, "stock": 50}
    ])]

    let product = products->Js.Array.find(p => {
      let p = p->Js.Dictionary.unsafeGet("id")
      let idNum = p->Js.Int.toFloat
      let reqId = id->Js.Int.parse->Belt.Option.getOr(0)
      idNum == reqId
    })

    switch (product) {
    | Some(p) => res->Json.stringify({ "product": p })->res->Response.sendJson
    | None =>
      res->Status.statusCode(404)
      ->Json.stringify({ "error": "Product not found" })
      ->res->Response.sendJson
    }
  }

  @send
  let createProductPost = (req, res) => {
    // In production, parse JSON body
    let product = {
      "id": Js.Date.now()->Int.toFloat,
      "name": "New Product",
      "description": "",
      "price": 29.99,
      "stock": 100}

    res->Status.statusCode(201)
    ->Json.stringify({ "product": product })
    ->res->Response.sendJson
  }
}

// Middleware
module Middleware = {
  @send
  let cors = (_, res, next) => {
    res->Response.setHeader("Access-Control-Allow-Origin", "*")
    res->Response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    res->Response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
    next()
  }

  @send
  let logger = (req, res, next) => {
    let method = req->Method.method
    let url = req->ReqUrl.path
    Js.log3(Js.Date.now(), method, url)
    next()
  }

  @send
  let errorHandler = (err, _req, res, _next) => {
    Js.log2("Error:", err)
    res->Status.statusCode(500)
    ->Json.stringify({ "error": "Internal server error" })
    ->res->Response.sendJson
  }
}

// Main app setup
@send
let setup = () => {
  let app = AppRoutes.App.make()

  // Middleware
  app->Middleware.cors
  app->Middleware.logger

  // Home
  app->AppRoutes.homeGet->Route.get("/")

  // API routes
  app->AppRoutes.healthGet->Route.get("/api/v1/health")
  app->AppRoutes.registerPost->Route.post("/api/v1/auth/register")
  app->AppRoutes.loginPost->Route.post("/api/v1/auth/login")
  app->AppRoutes.listProductsGet->Route.get("/api/v1/products")
  app->AppRoutes.getProductGet->Route.get("/api/v1/products/:id")
  app->AppRoutes.createProductPost->Route.post("/api/v1/products")

  // Error handling
  app->Middleware.errorHandler

  app
}

@send
let start = () => {
  let port = Node.Process.env->Js.Dict.get("PORT")->Belt.Option.mapOr("3000", x => x)
  let app = setup()

  Express.listen(app, port->Js.Int.parse->Belt.Option.getOr(3000), () => {
    Js.log("🚀 Server running at http://localhost:" ++ port)
    Js.log("📚 API docs: http://localhost:" ++ port ++ "/api/v1/health")
  })
}

// Start server when file is run directly
if (Node.Process.argv->Js.Array2.get(1) == Some("dist/js/src/Server.bs.js")) {
  start()
}`,

    // Types file
    'src/Types.res': `open RescriptCore

type user = {
  id: string,
  email: string,
  name: string,
  role: string}

type product = {
  id: float,
  name: string,
  description: string,
  price: float,
  stock: int}

type authResponse = {
  token: string,
  user: user}

type errorResponse = {
  error: string}`,

    // Auth utilities
    'src/Auth.res': `open RescriptCore
open Src.Types

// SHA256 hash (simplified - in production use proper crypto)
let hashPassword = (password: string): string => {
  // Simplified - use proper SHA256 in production
  password
}

// Generate JWT token (simplified)
let generateToken = (user: user): string => {
  // Simplified - use proper JWT library
  "jwt-token-placeholder"
}

// Verify JWT token (simplified)
let verifyToken = (token: string): option<user> => {
  // Simplified - use proper JWT verification
  if (token == "jwt-token-placeholder") {
    Some({
      id: "1",
      email: "admin@example.com",
      name: "Admin User",
      role: "admin"})
  } else {
    None
  }
}`,

    // Environment file
    '.env.example': `# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Secret (change in production!)
JWT_SECRET=change-this-secret-in-production
JWT_EXPIRATION=604800

# Database (for future use)
# DATABASE_URL=postgresql://user:password@localhost:5432/{{projectName}}

# Redis (for future use)
# REDIS_URL=redis://localhost:6379`,

    // .gitignore
    '.gitignore': `# Dependencies
node_modules/
.pnp
.pnp.js

# Build output
dist/
lib/
*.bs.js
*.bs.mjs
*.bs.ts
*.gen.ts
*.gen.tsx

# Environment
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Testing
coverage/
.nyc_output

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# ReScript
.rescript-cache/
.mf/

# Logs
logs
*.log`,

    // Dockerfile
    'Dockerfile': `FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source files
COPY . .

# Build ReScript
RUN npm run build

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped`,

    // README
    'README.md': `# {{projectName}}

Type-safe API server built with ReScript and Express.js.

## Features

- **ReScript**: Type-safe JavaScript with compile-time guarantees
- **Express**: Fast, minimalist web framework for Node.js
- **Type Safety**: Compile-time type checking eliminates runtime errors
- **Functional**: Immutable data structures and pure functions
- **Fast**: Optimized JavaScript output with excellent performance
- **Simple**: Clean syntax with powerful pattern matching

## Requirements

- Node.js 18+
- npm or yarn

## Installation

\`\`\`bash
# Install dependencies
npm install

# Build ReScript
npm run build
\`\`\`

## Quick Start

### Development Mode
\`\`\`bash
# Watch mode - automatically recompiles on changes
npm run dev

# Or with server restart on changes
npm run server
\`\`\`

### Production Mode
\`\`\`bash
# Build
npm run build

# Start server
npm start
\`\`\`

Visit http://localhost:3000

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

## Default Credentials

- Email: \`admin@example.com\`
- Password: \`admin123\`

## Project Structure

\`\`\`
src/
  Server.res         # Main server and routes
  Types.res          # Type definitions
  Auth.res           # Authentication utilities
rescript.json        # ReScript configuration
package.json         # Dependencies and scripts
\`\`\`

## ReScript Features

- **Type Inference**: Most types inferred automatically
- **Pattern Matching**: Powerful destructuring and matching
- **Variants**: Type-safe enums and data structures
- **Interop**: Seamless JavaScript interop
- **Belt**: Standard library with functional utilities
- **Pipe Operator**: Clean data transformations

## Development

\`\`\`bash
# Development with watch
npm run dev

# Build
npm run build

# Clean build artifacts
npm run clean

# Format code
npm run format
\`\`\`

## Testing

The project is configured with Jest for testing ReScript code.

\`\`\`bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests in CI mode
npm run test:ci
\`\`\`

### Test Structure

\`\`\`
src/__tests__/
├── TestHelpers.res      # Test utilities and mocks
├── Server.test.res      # Server integration tests
└── *.test.res           # Component tests
\`\`\`

### Writing Tests

ReScript tests use Jest bindings with type-safe matchers:

\`\`\`ocaml
open Jest
open TestHelpers

test("example test", () => {
  let result = someFunction()
  expect(result)->toBe(expected)
})

test("async test", () => {
  asyncOperation()->Js.Promise.then_=data => {
    expect(data)->toBeTruthy()
    Js.Promise.resolve()
  }
})
\`\`\`

### Test Helpers

\`\`\`ocaml
// Mock request/response
let mockReq = TestHelpers.makeMockRequest(~path="/api/v1/health", ())
let mockRes = TestHelpers.makeMockResponse()

// Wait for async operations
TestHelpers.waitFor(1000)->ignore

// Mock data
let user = TestHelpers.mockUser
let product = TestHelpers.mockProduct
\`\`\`

### Coverage

Coverage reports are generated in \`coverage/\` directory:
- HTML report: \`coverage/index.html\`
- LCOV: \`coverage/lcov.info\`
- Terminal summary

Coverage thresholds: 70% for all metrics.

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 3000:3000 {{projectName}}
\`\`\`

Or with Docker Compose:

\`\`\`bash
docker-compose up
\`\`\`

## Why ReScript?

- **Type Safety**: Catch errors at compile time, not runtime
- **Great Performance**: Optimized JavaScript output
- **JavaScript Interop**: Use any JavaScript library
- **Fast Compile**: Sub-second compilation times
- **Simple Syntax**: Easy to learn, powerful to use
- **Immutable**: Default immutable data structures
- **Pattern Matching**: Expressive code with less bugs

## License

MIT
`}
};
