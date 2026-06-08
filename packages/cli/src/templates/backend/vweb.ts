import { BackendTemplate } from '../types';

export const vwebTemplate: BackendTemplate = {
  id: 'vweb',
  name: 'Vweb',
  description: 'V language built-in web framework with simplicity and performance',
  version: '1.0.0',
  framework: 'vweb',
  displayName: 'Vweb (V)',
  language: 'v',
  port: 8080,
  tags: ['v', 'vlang', 'vweb', 'web', 'api', 'rest', 'fast'],
  features: ['routing', 'middleware', 'rest-api', 'logging', 'cors'],
  dependencies: {},
  devDependencies: {},
  files: {
    'v.mod': `Module {
	name: '{{projectName}}'
	description: '{{description}}'
	version: '0.1.0'
	license: 'MIT'
	dependencies: []
}
`,

    'src/main.v': `module main

import vweb
import json
import time
import os
import crypto.hmac
import crypto.sha256
import encoding.base64

// Configuration
const (
	app_name    = '{{projectName}}'
	app_version = '1.0.0'
	jwt_secret  = os.getenv_opt('JWT_SECRET') or { 'your-secret-key-change-in-production' }
)

// Models
struct User {
	id         int
	email      string
	name       string
	created_at time.Time
}

struct CreateUserRequest {
	email    string
	name     string
	password string
}

struct LoginRequest {
	email    string
	password string
}

struct TokenResponse {
	token      string
	expires_at i64
}

struct Item {
	id          int
	name        string
	description string
	user_id     int
	created_at  time.Time
}

struct CreateItemRequest {
	name        string
	description string
}

struct ErrorResponse {
	error   string
	message string
}

struct ApiInfo {
	name        string
	version     string
	framework   string
	language    string
	description string
}

struct HealthResponse {
	status    string
	timestamp string
}

// In-memory storage
__global users = []User{}
__global passwords = map[int]string{}
__global items = []Item{}
__global user_id_counter = 0
__global item_id_counter = 0

// Web App
struct App {
	vweb.Context
}

// Middleware - CORS headers
fn (mut app App) before_request() {
	app.add_header('Access-Control-Allow-Origin', '*')
	app.add_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
	app.add_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
	app.add_header('Content-Type', 'application/json')
}

// JWT Helper functions
fn generate_jwt(user_id int) TokenResponse {
	expires_at := time.now().add(time.hour * 24)

	header := '{"alg":"HS256","typ":"JWT"}'
	payload := '{"user_id":$user_id,"exp":\${expires_at.unix()},"iat":\${time.now().unix()}}'

	header_b64 := base64.url_encode(header.bytes())
	payload_b64 := base64.url_encode(payload.bytes())

	signature_input := '$header_b64.$payload_b64'
	signature := hmac.new(jwt_secret.bytes(), signature_input.bytes(), sha256.new)
	signature_b64 := base64.url_encode(signature)

	token := '$signature_input.$signature_b64'

	return TokenResponse{
		token: token
		expires_at: expires_at.unix()
	}
}

fn verify_jwt(token string) ?int {
	parts := token.split('.')
	if parts.len != 3 {
		return none
	}

	header_b64 := parts[0]
	payload_b64 := parts[1]
	signature_b64 := parts[2]

	// Verify signature
	signature_input := '$header_b64.$payload_b64'
	expected_sig := hmac.new(jwt_secret.bytes(), signature_input.bytes(), sha256.new)
	expected_sig_b64 := base64.url_encode(expected_sig)

	if signature_b64 != expected_sig_b64 {
		return none
	}

	// Decode payload
	payload_bytes := base64.url_decode(payload_b64) or { return none }
	payload_str := payload_bytes.bytestr()

	// Simple JSON parsing for user_id
	if idx := payload_str.index('"user_id":') {
		start := idx + 10
		end := payload_str.index_after(',', start)
		if end == -1 {
			end_brace := payload_str.index_after('}', start)
			if end_brace != -1 {
				user_id := payload_str[start..end_brace].int()
				return user_id
			}
		} else {
			user_id := payload_str[start..end].int()
			return user_id
		}
	}

	return none
}

fn (app App) get_auth_user() ?User {
	auth_header := app.req.header.get_custom('Authorization') or { return none }
	if !auth_header.starts_with('Bearer ') {
		return none
	}

	token := auth_header[7..]
	user_id := verify_jwt(token) or { return none }

	for user in users {
		if user.id == user_id {
			return user
		}
	}

	return none
}

// Database helpers
fn find_user_by_email(email string) ?User {
	for user in users {
		if user.email == email {
			return user
		}
	}
	return none
}

fn find_user_by_id(id int) ?User {
	for user in users {
		if user.id == id {
			return user
		}
	}
	return none
}

fn create_user(email string, name string, password string) User {
	user_id_counter++
	user := User{
		id: user_id_counter
		email: email
		name: name
		created_at: time.now()
	}
	users << user
	passwords[user.id] = password
	return user
}

fn verify_password(user_id int, password string) bool {
	if stored := passwords[user_id] {
		return stored == password
	}
	return false
}

// Routes

// Health check
['/health'; get]
pub fn (mut app App) health() vweb.Result {
	response := HealthResponse{
		status: 'healthy'
		timestamp: time.now().format_rfc3339()
	}
	return app.json(response)
}

// API info
['/'; get]
pub fn (mut app App) index() vweb.Result {
	info := ApiInfo{
		name: app_name
		version: app_version
		framework: 'Vweb'
		language: 'V'
		description: '{{description}}'
	}
	return app.json(info)
}

// Register
['/api/auth/register'; post]
pub fn (mut app App) register() vweb.Result {
	body := app.req.data

	// Parse JSON manually
	req := json.decode(CreateUserRequest, body) or {
		return app.json(ErrorResponse{
			error: 'parse_error'
			message: 'Invalid JSON body'
		})
	}

	if req.email.len == 0 || req.name.len == 0 || req.password.len == 0 {
		app.set_status(400, 'Bad Request')
		return app.json(ErrorResponse{
			error: 'validation_error'
			message: 'Email, name and password are required'
		})
	}

	if _ := find_user_by_email(req.email) {
		app.set_status(409, 'Conflict')
		return app.json(ErrorResponse{
			error: 'conflict'
			message: 'User with this email already exists'
		})
	}

	user := create_user(req.email, req.name, req.password)
	app.set_status(201, 'Created')
	return app.json(user)
}

// Login
['/api/auth/login'; post]
pub fn (mut app App) login() vweb.Result {
	body := app.req.data

	req := json.decode(LoginRequest, body) or {
		app.set_status(400, 'Bad Request')
		return app.json(ErrorResponse{
			error: 'parse_error'
			message: 'Invalid JSON body'
		})
	}

	user := find_user_by_email(req.email) or {
		app.set_status(401, 'Unauthorized')
		return app.json(ErrorResponse{
			error: 'unauthorized'
			message: 'Invalid email or password'
		})
	}

	if !verify_password(user.id, req.password) {
		app.set_status(401, 'Unauthorized')
		return app.json(ErrorResponse{
			error: 'unauthorized'
			message: 'Invalid email or password'
		})
	}

	token_response := generate_jwt(user.id)
	return app.json(token_response)
}

// Get current user
['/api/users/me'; get]
pub fn (mut app App) get_me() vweb.Result {
	user := app.get_auth_user() or {
		app.set_status(401, 'Unauthorized')
		return app.json(ErrorResponse{
			error: 'unauthorized'
			message: 'Authentication required'
		})
	}
	return app.json(user)
}

// List users
['/api/users'; get]
pub fn (mut app App) list_users() vweb.Result {
	_ := app.get_auth_user() or {
		app.set_status(401, 'Unauthorized')
		return app.json(ErrorResponse{
			error: 'unauthorized'
			message: 'Authentication required'
		})
	}
	return app.json(users)
}

// Get user by ID
['/api/users/:id'; get]
pub fn (mut app App) get_user(id string) vweb.Result {
	_ := app.get_auth_user() or {
		app.set_status(401, 'Unauthorized')
		return app.json(ErrorResponse{
			error: 'unauthorized'
			message: 'Authentication required'
		})
	}

	user_id := id.int()
	user := find_user_by_id(user_id) or {
		app.set_status(404, 'Not Found')
		return app.json(ErrorResponse{
			error: 'not_found'
			message: 'User not found'
		})
	}

	return app.json(user)
}

// List items
['/api/items'; get]
pub fn (mut app App) list_items() vweb.Result {
	user := app.get_auth_user() or {
		app.set_status(401, 'Unauthorized')
		return app.json(ErrorResponse{
			error: 'unauthorized'
			message: 'Authentication required'
		})
	}

	user_items := items.filter(it.user_id == user.id)
	return app.json(user_items)
}

// Create item
['/api/items'; post]
pub fn (mut app App) create_item() vweb.Result {
	user := app.get_auth_user() or {
		app.set_status(401, 'Unauthorized')
		return app.json(ErrorResponse{
			error: 'unauthorized'
			message: 'Authentication required'
		})
	}

	body := app.req.data
	req := json.decode(CreateItemRequest, body) or {
		app.set_status(400, 'Bad Request')
		return app.json(ErrorResponse{
			error: 'parse_error'
			message: 'Invalid JSON body'
		})
	}

	if req.name.len == 0 {
		app.set_status(400, 'Bad Request')
		return app.json(ErrorResponse{
			error: 'validation_error'
			message: 'Name is required'
		})
	}

	item_id_counter++
	item := Item{
		id: item_id_counter
		name: req.name
		description: req.description
		user_id: user.id
		created_at: time.now()
	}
	items << item

	app.set_status(201, 'Created')
	return app.json(item)
}

// Get item by ID
['/api/items/:id'; get]
pub fn (mut app App) get_item(id string) vweb.Result {
	user := app.get_auth_user() or {
		app.set_status(401, 'Unauthorized')
		return app.json(ErrorResponse{
			error: 'unauthorized'
			message: 'Authentication required'
		})
	}

	item_id := id.int()
	for item in items {
		if item.id == item_id && item.user_id == user.id {
			return app.json(item)
		}
	}

	app.set_status(404, 'Not Found')
	return app.json(ErrorResponse{
		error: 'not_found'
		message: 'Item not found'
	})
}

// Delete item
['/api/items/:id'; delete]
pub fn (mut app App) delete_item(id string) vweb.Result {
	user := app.get_auth_user() or {
		app.set_status(401, 'Unauthorized')
		return app.json(ErrorResponse{
			error: 'unauthorized'
			message: 'Authentication required'
		})
	}

	item_id := id.int()
	for i, item in items {
		if item.id == item_id && item.user_id == user.id {
			items.delete(i)
			app.set_status(204, 'No Content')
			return app.text('')
		}
	}

	app.set_status(404, 'Not Found')
	return app.json(ErrorResponse{
		error: 'not_found'
		message: 'Item not found'
	})
}

// OPTIONS handler for CORS preflight
['/api/:path...'; options]
pub fn (mut app App) options_handler(path string) vweb.Result {
	app.set_status(204, 'No Content')
	return app.text('')
}

fn main() {
	port := os.getenv_opt('PORT') or { '8080' }.int()
	println('🚀 $app_name server starting on http://localhost:$port')
	vweb.run(&App{}, port)
}
`,

    'src/main_test.v': `module main

import net.http

const base_url = 'http://localhost:8080'

fn test_health_endpoint() {
	resp := http.get('$base_url/health') or {
		assert false, 'Failed to connect to server'
		return
	}
	assert resp.status_code == 200
	assert resp.body.contains('"status":"healthy"')
}

fn test_root_endpoint() {
	resp := http.get('$base_url/') or {
		assert false, 'Failed to connect to server'
		return
	}
	assert resp.status_code == 200
	assert resp.body.contains('"framework":"Vweb"')
	assert resp.body.contains('"language":"V"')
}

fn test_register_user() {
	resp := http.post_json('$base_url/api/auth/register', '{"email":"test@example.com","name":"Test User","password":"password123"}') or {
		assert false, 'Failed to register user'
		return
	}
	assert resp.status_code == 201
	assert resp.body.contains('"email":"test@example.com"')
}

fn test_login_user() {
	// First register
	http.post_json('$base_url/api/auth/register', '{"email":"login@example.com","name":"Login User","password":"password123"}') or {
		return
	}

	// Then login
	resp := http.post_json('$base_url/api/auth/login', '{"email":"login@example.com","password":"password123"}') or {
		assert false, 'Failed to login'
		return
	}
	assert resp.status_code == 200
	assert resp.body.contains('"token"')
}

fn test_protected_endpoint_without_auth() {
	resp := http.get('$base_url/api/users/me') or {
		assert false, 'Failed to connect'
		return
	}
	assert resp.status_code == 401
}
`,

    '.env': `# Environment Configuration
PORT=8080
JWT_SECRET=your-super-secret-key-change-in-production
`,

    '.env.example': `# Environment Configuration
PORT=8080
JWT_SECRET=your-super-secret-key-change-in-production
`,

    '.gitignore': `# V build artifacts
*.o
*.exe
main
{{projectName}}

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
`,

    'Makefile': `# {{projectName}} Makefile

.PHONY: all build run test clean release

all: build

# Build the project
build:
	v -o {{projectName}} src/main.v

# Build release version
release:
	v -prod -o {{projectName}} src/main.v

# Run the server
run:
	v run src/main.v

# Run tests (requires server running)
test:
	v test src/

# Clean build artifacts
clean:
	rm -f {{projectName}}
	rm -f *.o

# Docker commands
docker-build:
	docker build -t {{projectName}} .

docker-run:
	docker run -p 8080:8080 --env-file .env {{projectName}}

# Format code
fmt:
	v fmt -w src/
`,

    'Dockerfile': `# Build stage
FROM thevlang/vlang:alpine AS builder

WORKDIR /app

# Copy source
COPY . .

# Build release
RUN v -prod -o {{projectName}} src/main.v

# Runtime stage
FROM alpine:3.18

WORKDIR /app

# Copy binary
COPY --from=builder /app/{{projectName}} ./{{projectName}}

# Create non-root user
RUN adduser -D -g '' appuser
USER appuser

EXPOSE 8080

ENV PORT=8080

CMD ["./{{projectName}}"]
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - JWT_SECRET=\${JWT_SECRET:-development-secret}
    restart: unless-stopped
`,

    'README.md': `# {{projectName}}

{{description}}

A V language web application built with the Vweb framework.

## Features

- 🚀 Fast and simple V web server
- 🔐 JWT authentication
- 📝 Full REST API with CRUD operations
- 🧪 Test suite included
- 🐳 Docker support
- ⚡ Zero dependencies

## Requirements

- V language >= 0.4.0

## Installation

\`\`\`bash
# Build the project
v -o {{projectName}} src/main.v

# Run the server
./{{projectName}}

# Or run directly
v run src/main.v
\`\`\`

## Development

\`\`\`bash
# Run in development mode
make run

# Build release version
make release

# Run tests (server must be running)
make test

# Format code
make fmt
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
docker run -p 8080:8080 {{projectName}}

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
      default: 'my-vweb-app'},
    {
      type: 'input',
      name: 'description',
      message: 'Project description:',
      default: 'A V language web application built with Vweb'}],
  postInstall: [
    'echo "✨ {{projectName}} is ready!"',
    'echo "Run: v run src/main.v"']};
