import { BackendTemplate } from '../types';

export const rescriptReactServerTemplate: BackendTemplate = {
  id: 'rescript-react-server',
  name: 'rescript-react-server',
  displayName: 'ReScript + React Server Components',
  description: 'Type-safe React Server Components with ReScript, combining server-side rendering with type safety',
  language: 'rescript',
  framework: 'react-server',
  version: '1.0.0',
  tags: ['rescript', 'react', 'server-components', 'nodejs', 'type-safe', 'rest-api'],
  port: 3000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing', 'rest-api'],

  files: {
    // Package.json
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "ReScript + React Server Components with type safety",
  "scripts": {
    "dev": "rescript clean && rescript dev -w & nodemon -x 'node dist/js/src/Server.bs.js'",
    "build": "rescript build",
    "start": "node dist/js/src/Server.bs.js",
    "server": "nodemon -x 'rescript build && node dist/js/src/Server.bs.js'",
    "test": "jest",
    "test:watch": "jest --watch",
    "clean": "rescript clean",
    "format": "rescript format",
    "typecheck": "rescript"
  },
  "dependencies": {
    "@rescript/core": "^1.3.0",
    "@rescript/react": "^0.12.0",
    "rescript-express": "^0.3.0",
    "rescript-nodejs": "^16.1.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-server-dom-webpack": "^18.3.0",
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
    "jest": "^29.7.0",
    "nodemon": "^3.1.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  },
  "keywords": ["rescript", "react", "server-components"],
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
    "@rescript/react",
    "rescript-express",
    "rescript-nodejs"
  ],
  "warnings": {
    "error": true
  },
  "bsc-flags": [
    "-bs-gentype",
    "-open RescriptCore"
  ]
}`,

    // Main server file
    'src/Server.res': `open RescriptCore
open RescriptExpress
open Node
open ReactServer

// Types
type user = {
  id: int,
  name: string,
  email: string,
  role: string}

type product = {
  id: int,
  name: string,
  price: float,
  description: string}

// Mock data (replace with real database)
let mockUsers: array<user> = [
  {id: 1, name: "Admin User", email: "admin@example.com", role: "admin"},
  {id: 2, name: "Test User", email: "user@example.com", role: "user"}]

let mockProducts: array<product> = [
  {id: 1, name: "Product 1", price: 99.99, description: "Description 1"},
  {id: 2, name: "Product 2", price: 149.99, description: "Description 2"}]

// Auth middleware
let authMiddleware = (req, res, next) => {
  let authHeader = req->Express.getOptionHeader("authorization")

  switch authHeader {
  | None => res->Status.statusCode(401)->Response.json({"error": "Unauthorized"})
  | Some(token) =>
    if (String.startsWith(token, "Bearer ")) {
      let token = String.substring(token, 7)->Js.String2.length
      if (token > 10) {
        next()
      } else {
        res->Status.statusCode(401)->Response.json({"error": "Invalid token"})
      }
    } else {
      res->Status.statusCode(401)->Response.json({"error": "Invalid token format"})
    }
  }
}

// Routes
module AppRoutes = {
  @send
  let healthGet = (_req, res) => {
    let response = {
      "status": "healthy",
      "timestamp": Js.Date.now(),
      "framework": "ReScript + React Server Components"}
    res->Response.json(response)->Js.Promise.resolve
  }

  @send
  let homeGet = (_req, res) => {
    let component = HomePage.component
    let payload = {"title": "ReScript React Server Components"}

    component
    ->ReactServer.renderToPipeableStream(payload)
    ->Js.Promise.then_=stream => {
      res->Header.setContentType("text/html")->ignore
      res->Response.sendStream(stream)->ignore
      Js.Promise.resolve()
    }
  }

  @send
  let usersGet = (_req, res) => {
    let users = {
      "data": mockUsers->Belt.Array.map(u => {
        "id": Js.Int.toString(u.id),
        "name": u.name,
        "email": u.email,
        "role": u.role}),
      "count": Js.Array.length(mockUsers)}
    res->Response.json(users)->Js.Promise.resolve
  }

  @send
  let userGet = (req, res) => {
    let id = req->Express.getParam("id")->Belt.Option.getWithDefault("")
    let user = mockUsers->Belt.Array.getBy(u => Js.Int.toString(u.id) == id)

    switch user {
    | None => res->Status.statusCode(404)->Response.json({"error": "User not found"})
    | Some(user) =>
      let userData = {
        "id": Js.Int.toString(user.id),
        "name": user.name,
        "email": user.email,
        "role": user.role}
      res->Response.json(userData)
    }
  }

  @send
  let productsGet = (_req, res) => {
    let products = {
      "data": mockProducts->Belt.Array.map(p => {
        "id": Js.Int.toString(p.id),
        "name": p.name,
        "price": Js.Float.toString(p.price),
        "description": p.description}),
      "count": Js.Array.length(mockProducts)}
    res->Response.json(products)->Js.Promise.resolve
  }

  @send
  let loginPost = (req, res) => {
    // Mock authentication - replace with real implementation
    req->Express.getJsonBody->Js.Promise.then_=body => {
      let email = body->Js.Dict.get("email")->Belt.Option.getWithDefault("")
      let password = body->Js.Dict.get("password")->Belt.Option.getWithDefault("")

      if (email != "" && password != "") {
        let token = "mock-jwt-token-" ++ Js.String2.make(length=32)
        let response = {
          "token": token,
          "user": {
            "id": "1",
            "name": "Admin User",
            "email": email,
            "role": "admin"}}
        res->Response.json(response)
      } else {
        res->Status.statusCode(401)->Response.json({"error": "Invalid credentials"})
      }
    }
  }
}

// Server Component: HomePage
module HomePage = {
  @react.component
  let make = (~title) => {
    let timestamp = React.useState(() => Js.Date.now())

    React.useEffect0(() => {
      let timer = Js.Global.setInterval(() => timestamp->React.setState(_ => Js.Date.now()), 1000)
      Some(() => Js.Global.clearInterval(timer))
    })

    <html>
      <head>
        <title> {React.string(title)} </title>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <div className="container">
          <h1> {React.string(title)} </h1>
          <p> {React.string("Welcome to ReScript + React Server Components!")} </p>
          <div className="features">
            <div className="feature-card">
              <h3> {React.string("⚡ Type Safety")} </h3>
              <p> {React.string("Compile-time type checking with ReScript's powerful type system")} </p>
            </div>
            <div className="feature-card">
              <h3> {React.string("🚀 Server Components")} </h3>
              <p> {React.string("React Server Components for reduced bundle size and improved performance")} </p>
            </div>
            <div className="feature-card">
              <h3> {React.string("🔒 Full Stack")} </h3>
              <p> {React.string("Share types between frontend and backend for end-to-end type safety")} </p>
            </div>
          </div>
          <div className="timestamp">
            <p> {React.string("Server time: " ++ Js.Date.toString(timestamp()))} </p>
          </div>
        </div>
      </body>
    </html>
  }
}

// App
let app = Express.app()

// Middleware
app->Express.use(Cors.middleware)
app->Express.use(Helmet.middleware)
app->Express.use(Morgan.middleware("dev"))
app->Express.use(Express.json)
app->Express.use(Express.urlencodedWithConfig({~extended=true->Some, ()->}))

// Routes
app->Express.get("/health", AppRoutes.healthGet)
app->Express.get("/", AppRoutes.homeGet)

// API routes
app->Express.get("/api/v1/users", AppRoutes.usersGet)
app->Express.get("/api/v1/users/:id", AppRoutes.userGet)
app->Express.get("/api/v1/products", AppRoutes.productsGet)

// Auth routes
app->Express.post("/api/v1/auth/login", AppRoutes.loginPost)

// Protected routes
let protectedRouter = Express.router()
protectedRouter->Express.use(authMiddleware)
// protectedRouter->Express.get("/profile", ProfileRoutes.profileGet)
app->Express.use("/api/v1", protectedRouter)

// 404 handler
app->Express.use((req, res) => {
  res->Status.statusCode(404)->Response.json({
    "error": "Not found",
    "path": req->Express.getUrl})->ignore
})

// Error handler
app->Express.use((err, req, res, _next) => {
  Console.error(err->Js.Exn.message)
  res->Status.statusCode(500)->Response.json({
    "error": "Internal server error",
    "message": err->Js.Exn.message})->ignore
})

// Start server
let port = Node.Process.env->Js.Dict.get("PORT")->Belt.Option.mapOr(3000, s-> {
  switch Js.Int.parse(s) {
  | Some(n) => n
  | None => 3000
  }
})

let server = app->Express.listenWithConfig(port, {
  let onListen = () => {
    Console.log("🚀 ReScript + React Server Components server running on port " ++ Js.Int.toString(port))
    Console.log("📖 API Documentation: http://localhost:" ++ Js.Int.toString(port) ++ "/api/v1")
    Console.log("🏥 Health Check: http://localhost:" ++ Js.Int.toString(port) ++ "/health")
  }
  let onError = err => {
    Console.error("Failed to start server:")
    Console.error(err->Js.Exn.message)
  }
  ("onListen", onListen, "onError", onError)
})

// Graceful shutdown
Process.onSigInt->ignore
Process.onSigTerm->ignore`,

    // React Server runtime bindings
    'src/ReactServer.res': `open RescriptCore
open React

// React Server Components runtime bindings
module Render = {
  @module("react-server-dom-webpack/node")
  external renderToPipeableStream: (React.element, Js.Dict.t<string>) => nodeStream => unit =
    "renderToPipeableStream"
}

module renderToPipeableStream = {
  @send
  let run = (element: React.element, ~payload={}: Js.Dict.t<string>=()) => {
    Render.renderToPipeableStream(element, payload)
  }
}

// Server component utilities
module Utils = {
  let createPayload = (data: Js.Dict.t<string>) => data

  let mergePayload = (payload1, payload2) => {
    Js.Dict.merge(payload1, payload2)
  }
}`,

    // Styles
    'src/styles.css': `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: #333;
}

p {
  font-size: 1.1rem;
  line-height: 1.6;
  color: #666;
  margin-bottom: 1rem;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin: 2rem 0;
}

.feature-card {
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.feature-card:hover {
  transform: translateY(-4px);
}

.feature-card h3 {
  color: white;
  margin-bottom: 1rem;
  font-size: 1.5rem;
}

.feature-card p {
  color: rgba(255, 255, 255, 0.9);
}

.timestamp {
  margin-top: 2rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 4px;
  text-align: center;
}

.timestamp p {
  margin: 0;
  color: #333;
  font-weight: 500;
}`,

    // Environment configuration
    '.env.example': `PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-here
DATABASE_URL=your-database-url-here`,

    // Git ignore
    '.gitignore': `# Compiled output
node_modules/
dist/
lib/
*.bs.js
*.bs.js.map

# Environment
.env
.env.local
.env.*.local

# Logs
logs
*.log
npm-debug.log*

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/`,

    // README
    'README.md': `# {{projectName}}

ReScript + React Server Components API with type safety and SSR.

## Features

- ⚡ **ReScript** - Compile-time type safety and excellent performance
- 🚀 **React Server Components** - Reduced bundle size and improved performance
- 🎯 **Type Safety** - End-to-end type safety from frontend to backend
- 🔒 **Authentication** - JWT-based auth with bcrypt password hashing
- 📝 **Logging** - Morgan request logging
- 🌐 **CORS** - Cross-origin resource sharing enabled
- 🧪 **Testing** - Jest testing framework
- 📦 **Build** - Optimized production builds

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test
\`\`\`

## Project Structure

\`\`\`
{{projectName}}/
├── src/
│   ├── Server.res              # Main server and routes
│   ├── ReactServer.res         # React Server Components runtime
│   └── styles.css              # Server-rendered styles
├── rescript.json              # ReScript configuration
├── package.json               # Dependencies
├── .env.example              # Environment variables
└── README.md                 # This file
\`\`\`

## API Endpoints

### Health Check
\`\`\`bash
curl http://localhost:3000/health
\`\`\`

### Server Component (SSR)
\`\`\`bash
curl http://localhost:3000/
\`\`\`

### Users API
\`\`\`bash
# Get all users
curl http://localhost:3000/api/v1/users

# Get user by ID
curl http://localhost:3000/api/v1/users/1
\`\`\`

### Products API
\`\`\`bash
# Get all products
curl http://localhost:3000/api/v1/products
\`\`\`

### Authentication
\`\`\`bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@example.com","password":"admin123"}'
\`\`\`

## ReScript Features

### Type Safety
All types are checked at compile time, catching errors before runtime.

### Pattern Matching
\`\`\`ocaml
switch result {
| Ok(data) => handleSuccess(data)
| Error(err) => handleError(err)
}
\`\`\`

### Server Components
React Server Components render on the server and stream to the client.

## Development

### Watch Mode
\`\`\`bash
npm run dev
\`\`\`

### Type Checking
\`\`\`bash
npm run typecheck
\`\`\`

### Formatting
\`\`\`bash
npm run format
\`\`\`

## Deployment

\`\`\`bash
# Build
npm run build

# Start production server
NODE_ENV=production npm start
\`\`\`

## License

MIT
`}};
