import { BackendTemplate } from '../types';

export const jesterTemplate: BackendTemplate = {
  id: 'jester',
  name: 'Jester',
  description: 'Nim web framework inspired by Sinatra with async support',
  version: '1.0.0',
  framework: 'jester',
  displayName: 'Jester (Nim)',
  language: 'nim',
  port: 5000,
  tags: ['nim', 'jester', 'web', 'api', 'rest'],
  features: ['routing', 'middleware', 'rest-api', 'logging', 'cors', 'validation'],
  dependencies: {},
  devDependencies: {},
  files: {
    '{{projectName}}.nimble': `# Package

version       = "0.1.0"
author        = "{{author}}"
description   = "{{description}}"
license       = "MIT"
srcDir        = "src"
bin           = @["{{projectName}}"]

# Dependencies

requires "nim >= 2.0.0"
requires "jester >= 0.6.0"
requires "jwt >= 0.2.0"
requires "norm >= 2.6.0"
requires "dotenv >= 1.0.0"
requires "chronicles >= 0.10.0"
requires "argon2_nim >= 0.5.0"
`,

    'src/{{projectName}}.nim': `import std/[json, strutils, times, options, tables, sequtils]
import jester
import jwt
import chronicles

# Configuration
const
  APP_NAME = "{{projectName}}"
  APP_VERSION = "1.0.0"
  JWT_SECRET = "your-secret-key-change-in-production"

type
  User = object
    id: int
    email: string
    name: string
    createdAt: DateTime

  CreateUserRequest = object
    email: string
    name: string
    password: string

  LoginRequest = object
    email: string
    password: string

  Item = object
    id: int
    name: string
    description: string
    userId: int
    createdAt: DateTime

  CreateItemRequest = object
    name: string
    description: string

  TokenResponse = object
    token: string
    expiresAt: int64

  ErrorResponse = object
    error: string
    message: string

# In-memory storage
var
  users: seq[User] = @[]
  passwords: Table[int, string] = initTable[int, string]()
  items: seq[Item] = @[]
  userIdCounter = 0
  itemIdCounter = 0

# JSON serialization helpers
proc toJson(user: User): JsonNode =
  %*{
    "id": user.id,
    "email": user.email,
    "name": user.name,
    "created_at": user.createdAt.format("yyyy-MM-dd'T'HH:mm:ss'Z'")
  }

proc toJson(item: Item): JsonNode =
  %*{
    "id": item.id,
    "name": item.name,
    "description": item.description,
    "user_id": item.userId,
    "created_at": item.createdAt.format("yyyy-MM-dd'T'HH:mm:ss'Z'")
  }

proc toJson(token: TokenResponse): JsonNode =
  %*{
    "token": token.token,
    "expires_at": token.expiresAt
  }

proc toJson(err: ErrorResponse): JsonNode =
  %*{
    "error": err.error,
    "message": err.message
  }

# Database helpers
proc findUserByEmail(email: string): Option[User] =
  for user in users:
    if user.email == email:
      return some(user)
  return none(User)

proc findUserById(id: int): Option[User] =
  for user in users:
    if user.id == id:
      return some(user)
  return none(User)

proc createUser(email, name, password: string): User =
  inc userIdCounter
  result = User(
    id: userIdCounter,
    email: email,
    name: name,
    createdAt: now().utc
  )
  users.add(result)
  passwords[result.id] = password

proc verifyPassword(userId: int, password: string): bool =
  if passwords.hasKey(userId):
    return passwords[userId] == password
  return false

# JWT helpers
proc generateToken(userId: int): TokenResponse =
  let
    expiresAt = now().utc + 24.hours
    payload = %*{
      "user_id": userId,
      "exp": expiresAt.toTime.toUnix,
      "iat": now().utc.toTime.toUnix
    }

  var token = toJWT(payload)
  token.sign(JWT_SECRET)

  result = TokenResponse(
    token: $token,
    expiresAt: expiresAt.toTime.toUnix
  )

proc verifyToken(token: string): Option[int] =
  try:
    var jwtToken = token.toJWT()
    if jwtToken.verify(JWT_SECRET):
      let payload = jwtToken.claims
      if payload.hasKey("user_id"):
        return some(payload["user_id"].getInt)
  except:
    discard
  return none(int)

proc getAuthUser(request: Request): Option[User] =
  let authHeader = request.headers.getOrDefault("Authorization")
  if authHeader.len > 0 and authHeader.startsWith("Bearer "):
    let token = authHeader[7..^1]
    let userId = verifyToken(token)
    if userId.isSome:
      return findUserById(userId.get)
  return none(User)

# Error responses
proc errorResponse(error, message: string): string =
  $ErrorResponse(error: error, message: message).toJson

# Routes
router myrouter:
  # Health check
  get "/health":
    resp Http200, %*{"status": "healthy", "timestamp": $now().utc}, "application/json"

  # API info
  get "/":
    resp Http200, %*{
      "name": APP_NAME,
      "version": APP_VERSION,
      "framework": "Jester",
      "language": "Nim",
      "description": "{{description}}"
    }, "application/json"

  # Register
  post "/api/auth/register":
    try:
      let body = parseJson(request.body)
      let email = body["email"].getStr
      let name = body["name"].getStr
      let password = body["password"].getStr

      if email.len == 0 or name.len == 0 or password.len == 0:
        resp Http400, errorResponse("validation_error", "Email, name and password are required"), "application/json"

      if findUserByEmail(email).isSome:
        resp Http409, errorResponse("conflict", "User with this email already exists"), "application/json"

      let user = createUser(email, name, password)
      resp Http201, user.toJson, "application/json"
    except JsonParsingError:
      resp Http400, errorResponse("parse_error", "Invalid JSON body"), "application/json"

  # Login
  post "/api/auth/login":
    try:
      let body = parseJson(request.body)
      let email = body["email"].getStr
      let password = body["password"].getStr

      let userOpt = findUserByEmail(email)
      if userOpt.isNone:
        resp Http401, errorResponse("unauthorized", "Invalid email or password"), "application/json"

      let user = userOpt.get
      if not verifyPassword(user.id, password):
        resp Http401, errorResponse("unauthorized", "Invalid email or password"), "application/json"

      let tokenResponse = generateToken(user.id)
      resp Http200, tokenResponse.toJson, "application/json"
    except JsonParsingError:
      resp Http400, errorResponse("parse_error", "Invalid JSON body"), "application/json"

  # Get current user
  get "/api/users/me":
    let userOpt = getAuthUser(request)
    if userOpt.isNone:
      resp Http401, errorResponse("unauthorized", "Authentication required"), "application/json"
    resp Http200, userOpt.get.toJson, "application/json"

  # List users
  get "/api/users":
    let userOpt = getAuthUser(request)
    if userOpt.isNone:
      resp Http401, errorResponse("unauthorized", "Authentication required"), "application/json"

    let usersJson = users.map(proc(u: User): JsonNode = u.toJson)
    resp Http200, %usersJson, "application/json"

  # Get user by ID
  get "/api/users/@id":
    let userOpt = getAuthUser(request)
    if userOpt.isNone:
      resp Http401, errorResponse("unauthorized", "Authentication required"), "application/json"

    try:
      let id = parseInt(@"id")
      let targetUser = findUserById(id)
      if targetUser.isNone:
        resp Http404, errorResponse("not_found", "User not found"), "application/json"
      resp Http200, targetUser.get.toJson, "application/json"
    except ValueError:
      resp Http400, errorResponse("bad_request", "Invalid user ID"), "application/json"

  # List items
  get "/api/items":
    let userOpt = getAuthUser(request)
    if userOpt.isNone:
      resp Http401, errorResponse("unauthorized", "Authentication required"), "application/json"

    let user = userOpt.get
    let userItems = items.filter(proc(i: Item): bool = i.userId == user.id)
    let itemsJson = userItems.map(proc(i: Item): JsonNode = i.toJson)
    resp Http200, %itemsJson, "application/json"

  # Create item
  post "/api/items":
    let userOpt = getAuthUser(request)
    if userOpt.isNone:
      resp Http401, errorResponse("unauthorized", "Authentication required"), "application/json"

    try:
      let user = userOpt.get
      let body = parseJson(request.body)
      let name = body["name"].getStr
      let description = body.getOrDefault("description").getStr("")

      if name.len == 0:
        resp Http400, errorResponse("validation_error", "Name is required"), "application/json"

      inc itemIdCounter
      let item = Item(
        id: itemIdCounter,
        name: name,
        description: description,
        userId: user.id,
        createdAt: now().utc
      )
      items.add(item)

      resp Http201, item.toJson, "application/json"
    except JsonParsingError:
      resp Http400, errorResponse("parse_error", "Invalid JSON body"), "application/json"

  # Get item by ID
  get "/api/items/@id":
    let userOpt = getAuthUser(request)
    if userOpt.isNone:
      resp Http401, errorResponse("unauthorized", "Authentication required"), "application/json"

    try:
      let user = userOpt.get
      let id = parseInt(@"id")

      var found = false
      for item in items:
        if item.id == id and item.userId == user.id:
          resp Http200, item.toJson, "application/json"
          found = true
          break

      if not found:
        resp Http404, errorResponse("not_found", "Item not found"), "application/json"
    except ValueError:
      resp Http400, errorResponse("bad_request", "Invalid item ID"), "application/json"

  # Delete item
  delete "/api/items/@id":
    let userOpt = getAuthUser(request)
    if userOpt.isNone:
      resp Http401, errorResponse("unauthorized", "Authentication required"), "application/json"

    try:
      let user = userOpt.get
      let id = parseInt(@"id")

      var deleted = false
      for i in 0..<items.len:
        if items[i].id == id and items[i].userId == user.id:
          items.delete(i)
          deleted = true
          break

      if deleted:
        resp Http204, "", "application/json"
      else:
        resp Http404, errorResponse("not_found", "Item not found"), "application/json"
    except ValueError:
      resp Http400, errorResponse("bad_request", "Invalid item ID"), "application/json"

# CORS middleware
proc corsMiddleware(): proc(request: Request, response: ResponseData): void =
  return proc(request: Request, response: ResponseData): void =
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"

# Main
proc main() =
  let port = Port(parseInt(getEnv("PORT", "5000")))

  info "Starting server", app = APP_NAME, version = APP_VERSION
  echo "🚀 " & APP_NAME & " server starting on http://localhost:" & $port.int

  let settings = newSettings(port = port, bindAddr = "0.0.0.0")
  var jester = initJester(myrouter, settings = settings)
  jester.serve()

when isMainModule:
  main()
`,

    'tests/test_app.nim': `import std/[unittest, json, httpclient, strutils]

suite "{{projectName}} API Tests":
  const BASE_URL = "http://localhost:5000"

  test "Health check returns OK":
    let client = newHttpClient()
    defer: client.close()

    let response = client.get(BASE_URL & "/health")
    check response.code == Http200

    let body = parseJson(response.body)
    check body["status"].getStr == "healthy"

  test "Root endpoint returns API info":
    let client = newHttpClient()
    defer: client.close()

    let response = client.get(BASE_URL & "/")
    check response.code == Http200

    let body = parseJson(response.body)
    check body["framework"].getStr == "Jester"
    check body["language"].getStr == "Nim"

  test "Register user":
    let client = newHttpClient()
    defer: client.close()
    client.headers = newHttpHeaders({"Content-Type": "application/json"})

    let response = client.post(BASE_URL & "/api/auth/register", body = $(%*{
      "email": "test@example.com",
      "name": "Test User",
      "password": "password123"
    }))

    check response.code == Http201

    let body = parseJson(response.body)
    check body["email"].getStr == "test@example.com"
    check body["name"].getStr == "Test User"

  test "Login returns token":
    let client = newHttpClient()
    defer: client.close()
    client.headers = newHttpHeaders({"Content-Type": "application/json"})

    # First register
    discard client.post(BASE_URL & "/api/auth/register", body = $(%*{
      "email": "login@example.com",
      "name": "Login User",
      "password": "password123"
    }))

    # Then login
    let response = client.post(BASE_URL & "/api/auth/login", body = $(%*{
      "email": "login@example.com",
      "password": "password123"
    }))

    check response.code == Http200

    let body = parseJson(response.body)
    check body.hasKey("token")
    check body.hasKey("expires_at")

  test "Protected endpoint requires auth":
    let client = newHttpClient()
    defer: client.close()

    let response = client.get(BASE_URL & "/api/users/me")
    check response.code == Http401
`,

    '.env': `# Environment Configuration
PORT=5000
JWT_SECRET=your-super-secret-key-change-in-production
DATABASE_URL=sqlite:///{{projectName}}.db
`,

    '.env.example': `# Environment Configuration
PORT=5000
JWT_SECRET=your-super-secret-key-change-in-production
DATABASE_URL=sqlite:///{{projectName}}.db
`,

    '.gitignore': `# Nim artifacts
nimcache/
*.exe
*.dll
*.so
*.dylib
{{projectName}}

# Dependencies
nimble/

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local

# Logs
*.log
logs/

# Database
*.db
*.db-journal
`,

    'Makefile': `# {{projectName}} Makefile

.PHONY: all build run test clean deps release

all: build

# Install dependencies
deps:
	nimble install -y

# Build the project
build: deps
	nimble build

# Build release version
release: deps
	nimble build -d:release

# Run the server
run:
	nimble run

# Run tests
test:
	nimble test

# Clean build artifacts
clean:
	rm -rf nimcache/
	rm -f {{projectName}}

# Docker commands
docker-build:
	docker build -t {{projectName}} .

docker-run:
	docker run -p 5000:5000 --env-file .env {{projectName}}
`,

    'Dockerfile': `# Build stage
FROM nimlang/nim:2.0.0-alpine AS builder

WORKDIR /app

# Install dependencies
COPY {{projectName}}.nimble ./
RUN nimble install -y -d

# Copy source and build
COPY . .
RUN nimble build -d:release

# Runtime stage
FROM alpine:3.18

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache libgcc

# Copy binary
COPY --from=builder /app/{{projectName}} ./{{projectName}}

# Create non-root user
RUN adduser -D -g '' appuser
USER appuser

EXPOSE 5000

ENV PORT=5000

CMD ["./{{projectName}}"]
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - PORT=5000
      - JWT_SECRET=\${JWT_SECRET:-development-secret}
    restart: unless-stopped

volumes:
  app_data:
`,

    'README.md': `# {{projectName}}

{{description}}

A Nim web application built with the Jester framework.

## Features

- 🚀 Fast and efficient Nim web server
- 🔐 JWT authentication
- 📝 Full REST API with CRUD operations
- 🧪 Test suite included
- 🐳 Docker support
- 📊 Async support

## Requirements

- Nim >= 2.0.0
- Nimble (Nim package manager)

## Installation

\`\`\`bash
# Install dependencies
nimble install -y

# Build the project
nimble build

# Run the server
nimble run
\`\`\`

## Development

\`\`\`bash
# Run in development mode
make run

# Run tests
make test

# Build release version
make release
\`\`\`

## API Endpoints

### Public

- \`GET /\` - API info
- \`GET /health\` - Health check
- \`POST /api/auth/register\` - Register new user
- \`POST /api/auth/login\` - Login and get JWT token

### Protected (requires JWT)

- \`GET /api/users/me\` - Get current user
- \`GET /api/users\` - List all users
- \`GET /api/users/:id\` - Get user by ID
- \`GET /api/items\` - List user's items
- \`POST /api/items\` - Create new item
- \`GET /api/items/:id\` - Get item by ID
- \`DELETE /api/items/:id\` - Delete item

## Docker

\`\`\`bash
# Build image
docker build -t {{projectName}} .

# Run container
docker run -p 5000:5000 {{projectName}}

# Or use docker-compose
docker-compose up -d
\`\`\`

## License

MIT
`},
  prompts: [
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: 'my-jester-app'},
    {
      type: 'input',
      name: 'description',
      message: 'Project description:',
      default: 'A Nim web application built with Jester'},
    {
      type: 'input',
      name: 'author',
      message: 'Author:',
      default: 'Developer'}],
  postInstall: [
    'nimble install -y',
    'echo "✨ {{projectName}} is ready!"',
    'echo "Run: nimble run"']};
