import { BackendTemplate } from '../types';

export const vwebTemplate: BackendTemplate = {
  id: 'vweb',
  name: 'Vweb',
  description: 'V language REST API on veb, the web framework of the V standard library (the successor of vweb)',
  version: '1.1.0',
  framework: 'veb',
  displayName: 'Vweb (V, veb)',
  language: 'v',
  port: 8080,
  tags: ['v', 'vlang', 'vweb', 'veb', 'web', 'api', 'rest', 'fast'],
  features: ['routing', 'middleware', 'rest-api', 'logging', 'cors', 'graphql', 'authentication', 'testing'],
  dependencies: {},
  devDependencies: {},

  files: {
    '.env.example': `# The server reads these from the process environment (V does not load .env files):
#   export $(grep -v '^#' .env.example | xargs) && ./{{projectName}}
PORT=8080
JWT_SECRET=change-me-in-production
`,

    '.gitignore': `# V build artifacts
*.o
*.exe
{{projectName}}
app

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

    'Dockerfile': `# Build stage: V is built from a pinned release plus the matching bootstrap C file
FROM debian:bookworm-slim AS builder

ARG V_VERSION=0.5.2
ARG VC_COMMIT=7eb8c54a3843e5107d5af06d7a8c3e928f322475
# prebuilt TCC bundle (it also carries the Boehm GC library V links against); use thirdparty-linux-arm64 on ARM
ARG TCC_BRANCH=thirdparty-linux-amd64

RUN apt-get update && apt-get install -y --no-install-recommends \\
    build-essential git ca-certificates \\
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch \${V_VERSION} https://github.com/vlang/v /opt/v \\
    && git clone --filter=blob:none https://github.com/vlang/vc /opt/v/vc \\
    && git -C /opt/v/vc checkout \${VC_COMMIT} \\
    && git clone --depth 1 --branch \${TCC_BRANCH} https://github.com/vlang/tccbin /opt/v/thirdparty/tcc \\
    && cd /opt/v \\
    && cc -std=c99 -w -DCUSTOM_DEFINE_v1_fallback -o v1 vc/v.c -lm -lpthread \\
    && ./v1 -no-parallel -o v2 -gc none cmd/v \\
    && ./v2 -nocache -o v -gc none cmd/v \\
    && rm -f v1 v2

WORKDIR /app
COPY v.mod ./
COPY src ./src

RUN /opt/v/v -cc gcc -prod -o app src

# Runtime stage
FROM debian:bookworm-slim

RUN useradd --system --uid 1000 appuser
WORKDIR /app
COPY --from=builder /app/app ./app
USER appuser

ENV PORT=8080
EXPOSE 8080

CMD ["./app"]
`,

    'Makefile': `# {{projectName}} Makefile (needs V, see README.md)

.PHONY: all build run test clean release fmt docker-build docker-run

all: build

# Build the project
build:
	v -o {{projectName}} src

# Build an optimised binary
release:
	v -prod -o {{projectName}} src

# Run the server
run:
	v run src

# Run the tests (they start their own server on port 18080)
test:
	v test src

# Format the code
fmt:
	v fmt -w src

# Clean build artifacts
clean:
	rm -f {{projectName}} *.o

docker-build:
	docker build -t {{projectName}} .

docker-run:
	docker run --rm -p 8080:8080 -e JWT_SECRET=change-me-in-production {{projectName}}
`,

    'README.md': `# {{projectName}}

{{description}}

A REST API written in [V](https://vlang.io) with veb, the web framework in V's standard library. (veb replaced the older vweb module, which has been removed from V.)

## Features

- JWT authentication (HS256) and bcrypt password hashing
- CRUD API for per-user items with in-memory storage
- CORS middleware (including preflight requests) and a minimal GraphQL endpoint
- Integration tests that start the server themselves
- No third-party dependencies

## Requirements

- V 0.5.2 (the code is written against that release, see https://github.com/vlang/v#installing-v-from-source)
- A C compiler (gcc or clang)

## Getting started

\`\`\`bash
# Run the server (default port 8080)
v run src

# Build a binary and start it
v -o {{projectName}} src
JWT_SECRET=change-me ./{{projectName}}
\`\`\`

Configuration comes from the environment: \`PORT\` (default 8080) and \`JWT_SECRET\`. A warning is printed when \`JWT_SECRET\` is not set; never use the default secret in production. The server listens on IPv4 only.

## Development

\`\`\`bash
make run      # run the server
make test     # starts a test server on port 18080 and exercises the API
make fmt      # v fmt -w src
make release  # optimised build
\`\`\`

## API endpoints

Public:

- \`GET /\` - API info
- \`GET /health\` - health check
- \`POST /graphql\` - GraphQL (\`{ hello health }\`, schema in \`graphql/schema.graphql\`)
- \`POST /api/auth/register\` - register \`{"email", "name", "password"}\`
- \`POST /api/auth/login\` - returns \`{"token", "expires_at"}\`

Protected (header \`Authorization: Bearer <token>\`):

- \`GET /api/users/me\` - current user
- \`GET /api/users\` - list users
- \`GET /api/users/:id\` - get a user
- \`GET /api/items\` - list your items
- \`POST /api/items\` - create an item \`{"name", "description"}\`
- \`GET /api/items/:id\` - get one of your items
- \`DELETE /api/items/:id\` - delete one of your items

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run --rm -p 8080:8080 -e JWT_SECRET=change-me {{projectName}}
\`\`\`

The image builds V from the pinned release, so the first build takes a few minutes.

## License

MIT
`,

    'docker-compose.yml': `services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - JWT_SECRET=\${JWT_SECRET:-change-me-in-production}
    restart: unless-stopped
`,

    'graphql/schema.graphql': `# {{projectName}} - GraphQL Schema (served by POST /graphql)
type Query {
  hello: String!
  health: String!
}
`,

    'src/main.v': `module main

import veb
import json
import net.http
import os
import time
import crypto.bcrypt
import crypto.hmac
import crypto.sha256
import encoding.base64

const app_name = '{{projectName}}'
const app_version = '1.0.0'
const token_ttl_seconds = 24 * 60 * 60
const default_jwt_secret = 'change-me-in-production'

// Models

struct User {
	id         int
	email      string
	name       string
	created_at string
}

struct Item {
	id          int
	name        string
	description string
	user_id     int
	created_at  string
}

struct RegisterRequest {
	email    string
	name     string
	password string
}

struct LoginRequest {
	email    string
	password string
}

struct CreateItemRequest {
	name        string
	description string
}

struct TokenResponse {
	token      string
	expires_at i64
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

struct JwtClaims {
	sub int
	iat i64
	exp i64
}

// In-memory storage, guarded by the \`shared\` lock of the App
struct Store {
mut:
	users           []User
	password_hashes map[int]string
	items           []Item
	next_user_id    int = 1
	next_item_id    int = 1
}

// Context is created for every request. Embed veb.Context and add per-request data here.
pub struct Context {
	veb.Context
}

// App holds the state shared by all requests. veb.Middleware[Context] adds \`app.use(...)\`.
pub struct App {
	veb.Middleware[Context]
pub:
	jwt_secret string
mut:
	store shared Store
}

// Helpers

fn now_rfc3339() string {
	return time.now().format_rfc3339()
}

fn (mut ctx Context) fail(status http.Status, code string, message string) veb.Result {
	ctx.res.set_status(status)
	return ctx.json(ErrorResponse{
		error:   code
		message: message
	})
}

fn sign(secret string, input string) string {
	mac := hmac.new(secret.bytes(), input.bytes(), sha256.sum, sha256.block_size)
	return base64.url_encode(mac)
}

fn generate_jwt(secret string, user_id int) TokenResponse {
	now := time.now().unix()
	claims := JwtClaims{
		sub: user_id
		iat: now
		exp: now + token_ttl_seconds
	}
	header_b64 := base64.url_encode_str('{"alg":"HS256","typ":"JWT"}')
	payload_b64 := base64.url_encode_str(json.encode(claims))
	signing_input := '\${header_b64}.\${payload_b64}'
	return TokenResponse{
		token:      '\${signing_input}.\${sign(secret, signing_input)}'
		expires_at: claims.exp
	}
}

// verify_jwt returns the user id stored in a valid, unexpired token.
fn verify_jwt(secret string, token string) ?int {
	parts := token.split('.')
	if parts.len != 3 {
		return none
	}
	signing_input := '\${parts[0]}.\${parts[1]}'
	expected := hmac.new(secret.bytes(), signing_input.bytes(), sha256.sum, sha256.block_size)
	if !hmac.equal(base64.url_decode(parts[2]), expected) {
		return none
	}
	claims := json.decode(JwtClaims, base64.url_decode_str(parts[1])) or { return none }
	if claims.exp < time.now().unix() {
		return none
	}
	return claims.sub
}

fn (mut app App) current_user(ctx &Context) ?User {
	header := ctx.get_custom_header('Authorization') or { return none }
	if !header.starts_with('Bearer ') {
		return none
	}
	user_id := verify_jwt(app.jwt_secret, header[7..]) or { return none }
	rlock app.store {
		for user in app.store.users {
			if user.id == user_id {
				return user
			}
		}
	}
	return none
}

// Routes

pub fn (mut app App) index(mut ctx Context) veb.Result {
	return ctx.json(ApiInfo{
		name:        app_name
		version:     app_version
		framework:   'veb'
		language:    'V'
		description: 'REST API built with V and veb'
	})
}

@['/health']
pub fn (mut app App) health(mut ctx Context) veb.Result {
	return ctx.json(HealthResponse{
		status:    'healthy'
		timestamp: now_rfc3339()
	})
}

// A minimal GraphQL endpoint: answers the fields of graphql/schema.graphql.
@['/graphql'; post]
pub fn (mut app App) graphql(mut ctx Context) veb.Result {
	query := json.decode(map[string]string, ctx.req.data) or {
		return ctx.fail(.bad_request, 'parse_error',
			'Expected a JSON body like {"query": "{ hello }"}')
	}
	text := query['query'] or { '' }
	mut data := map[string]string{}
	if text.contains('hello') {
		data['hello'] = 'Hello from \${app_name} GraphQL!'
	}
	if text.contains('health') {
		data['health'] = 'healthy'
	}
	if data.len == 0 {
		return ctx.fail(.bad_request, 'unknown_field', 'Query { hello, health } is supported')
	}
	return ctx.json({
		'data': data
	})
}

@['/api/auth/register'; post]
pub fn (mut app App) register(mut ctx Context) veb.Result {
	req := json.decode(RegisterRequest, ctx.req.data) or {
		return ctx.fail(.bad_request, 'parse_error', 'Invalid JSON body')
	}
	if req.email == '' || req.name == '' || req.password == '' {
		return ctx.fail(.bad_request, 'validation_error', 'Email, name and password are required')
	}
	hash := bcrypt.generate_from_password(req.password.bytes(), 10) or {
		return ctx.fail(.internal_server_error, 'hash_error', 'Could not hash the password')
	}
	mut created := User{}
	mut exists := false
	lock app.store {
		for user in app.store.users {
			if user.email == req.email {
				exists = true
			}
		}
		if !exists {
			created = User{
				id:         app.store.next_user_id
				email:      req.email
				name:       req.name
				created_at: now_rfc3339()
			}
			app.store.next_user_id++
			app.store.users << created
			app.store.password_hashes[created.id] = hash
		}
	}
	if exists {
		return ctx.fail(.conflict, 'conflict', 'User with this email already exists')
	}
	ctx.res.set_status(.created)
	return ctx.json(created)
}

@['/api/auth/login'; post]
pub fn (mut app App) login(mut ctx Context) veb.Result {
	req := json.decode(LoginRequest, ctx.req.data) or {
		return ctx.fail(.bad_request, 'parse_error', 'Invalid JSON body')
	}
	mut user_id := 0
	mut hash := ''
	rlock app.store {
		for user in app.store.users {
			if user.email == req.email {
				user_id = user.id
				hash = app.store.password_hashes[user.id] or { '' }
			}
		}
	}
	if user_id == 0 || hash == '' {
		return ctx.fail(.unauthorized, 'unauthorized', 'Invalid email or password')
	}
	bcrypt.compare_hash_and_password(req.password.bytes(), hash.bytes()) or {
		return ctx.fail(.unauthorized, 'unauthorized', 'Invalid email or password')
	}
	return ctx.json(generate_jwt(app.jwt_secret, user_id))
}

@['/api/users/me'; get]
pub fn (mut app App) get_me(mut ctx Context) veb.Result {
	user := app.current_user(ctx) or {
		return ctx.fail(.unauthorized, 'unauthorized', 'Authentication required')
	}
	return ctx.json(user)
}

@['/api/users'; get]
pub fn (mut app App) list_users(mut ctx Context) veb.Result {
	app.current_user(ctx) or {
		return ctx.fail(.unauthorized, 'unauthorized', 'Authentication required')
	}
	mut users := []User{}
	rlock app.store {
		users = app.store.users.clone()
	}
	return ctx.json(users)
}

@['/api/users/:id'; get]
pub fn (mut app App) get_user(mut ctx Context, id string) veb.Result {
	app.current_user(ctx) or {
		return ctx.fail(.unauthorized, 'unauthorized', 'Authentication required')
	}
	wanted := id.int()
	rlock app.store {
		for user in app.store.users {
			if user.id == wanted {
				return ctx.json(user)
			}
		}
	}
	return ctx.fail(.not_found, 'not_found', 'User not found')
}

@['/api/items'; get]
pub fn (mut app App) list_items(mut ctx Context) veb.Result {
	user := app.current_user(ctx) or {
		return ctx.fail(.unauthorized, 'unauthorized', 'Authentication required')
	}
	mut mine := []Item{}
	rlock app.store {
		mine = app.store.items.filter(it.user_id == user.id)
	}
	return ctx.json(mine)
}

@['/api/items'; post]
pub fn (mut app App) create_item(mut ctx Context) veb.Result {
	user := app.current_user(ctx) or {
		return ctx.fail(.unauthorized, 'unauthorized', 'Authentication required')
	}
	req := json.decode(CreateItemRequest, ctx.req.data) or {
		return ctx.fail(.bad_request, 'parse_error', 'Invalid JSON body')
	}
	if req.name == '' {
		return ctx.fail(.bad_request, 'validation_error', 'Name is required')
	}
	mut item := Item{}
	lock app.store {
		item = Item{
			id:          app.store.next_item_id
			name:        req.name
			description: req.description
			user_id:     user.id
			created_at:  now_rfc3339()
		}
		app.store.next_item_id++
		app.store.items << item
	}
	ctx.res.set_status(.created)
	return ctx.json(item)
}

@['/api/items/:id'; get]
pub fn (mut app App) get_item(mut ctx Context, id string) veb.Result {
	user := app.current_user(ctx) or {
		return ctx.fail(.unauthorized, 'unauthorized', 'Authentication required')
	}
	wanted := id.int()
	rlock app.store {
		for item in app.store.items {
			if item.id == wanted && item.user_id == user.id {
				return ctx.json(item)
			}
		}
	}
	return ctx.fail(.not_found, 'not_found', 'Item not found')
}

@['/api/items/:id'; delete]
pub fn (mut app App) delete_item(mut ctx Context, id string) veb.Result {
	user := app.current_user(ctx) or {
		return ctx.fail(.unauthorized, 'unauthorized', 'Authentication required')
	}
	wanted := id.int()
	mut removed := false
	lock app.store {
		for i, item in app.store.items {
			if item.id == wanted && item.user_id == user.id {
				app.store.items.delete(i)
				removed = true
				break
			}
		}
	}
	if !removed {
		return ctx.fail(.not_found, 'not_found', 'Item not found')
	}
	return ctx.no_content()
}

// new_app builds the application with CORS enabled for every route (including preflight requests).
fn new_app(jwt_secret string) &App {
	mut app := &App{
		jwt_secret: jwt_secret
	}
	app.use(veb.cors[Context](veb.CorsOptions{
		origins:         ['*']
		allowed_methods: [.get, .post, .put, .delete, .options]
		allowed_headers: ['Content-Type', 'Authorization']
	}))
	return app
}

fn main() {
	port := os.getenv_opt('PORT') or { '8080' }.int()
	jwt_secret := os.getenv_opt('JWT_SECRET') or { default_jwt_secret }
	if jwt_secret == default_jwt_secret {
		eprintln('warning: JWT_SECRET is not set, using an insecure development secret')
	}
	mut app := new_app(jwt_secret)
	println('\${app_name} listening on http://localhost:\${port}')
	// family: .ip listens on IPv4 only (0.0.0.0), which also works where IPv6 is unavailable (many containers)
	veb.run_at[App, Context](mut app, family: .ip, port: port) or { panic(err) }
}
`,

    'src/main_test.v': `module main

import json
import net.http
import time
import veb

const test_port = 18080
const base_url = 'http://127.0.0.1:\${test_port}'

fn testsuite_begin() {
	mut app := new_app('test-secret')
	spawn veb.run_at[App, Context](mut app,
		host:                 '127.0.0.1'
		family:               .ip
		port:                 test_port
		show_startup_message: false
	)
	// wait until the server answers
	for _ in 0 .. 50 {
		http.get('\${base_url}/health') or {
			time.sleep(100 * time.millisecond)
			continue
		}
		return
	}
	panic('the test server did not start')
}

fn authed(method http.Method, path string, token string, data string) !http.Response {
	return http.fetch(
		method: method
		url:    '\${base_url}\${path}'
		data:   data
		header: http.new_header_from_map({
			.authorization: 'Bearer \${token}'
			.content_type:  'application/json'
		})
	)
}

fn register_and_login(email string) !string {
	body := '{"email":"\${email}","name":"Test User","password":"password123"}'
	created := http.post_json('\${base_url}/api/auth/register', body)!
	assert created.status_code == 201
	login := http.post_json('\${base_url}/api/auth/login',
		'{"email":"\${email}","password":"password123"}')!
	assert login.status_code == 200
	token := json.decode(TokenResponse, login.body)!
	return token.token
}

fn test_health() {
	resp := http.get('\${base_url}/health')!
	assert resp.status_code == 200
	assert resp.body.contains('"status":"healthy"')
}

fn test_index() {
	resp := http.get('\${base_url}/')!
	assert resp.status_code == 200
	assert resp.body.contains('"framework":"veb"')
}

fn test_graphql() {
	resp := http.post_json('\${base_url}/graphql', '{"query":"{ hello health }"}')!
	assert resp.status_code == 200
	assert resp.body.contains('"hello"')
	assert resp.body.contains('"health":"healthy"')
}

fn test_protected_route_requires_a_token() {
	resp := http.get('\${base_url}/api/users/me')!
	assert resp.status_code == 401
}

fn test_register_rejects_duplicates_and_bad_logins() {
	token := register_and_login('dup@example.com')!
	assert token != ''
	again := http.post_json('\${base_url}/api/auth/register',
		'{"email":"dup@example.com","name":"Again","password":"password123"}')!
	assert again.status_code == 409
	wrong := http.post_json('\${base_url}/api/auth/login',
		'{"email":"dup@example.com","password":"nope"}')!
	assert wrong.status_code == 401
}

fn test_current_user() {
	token := register_and_login('me@example.com')!
	resp := authed(.get, '/api/users/me', token, '')!
	assert resp.status_code == 200
	assert resp.body.contains('"email":"me@example.com"')
	assert !resp.body.contains('password')
}

fn test_items_crud() {
	token := register_and_login('items@example.com')!
	created := authed(.post, '/api/items', token, '{"name":"First","description":"an item"}')!
	assert created.status_code == 201
	assert created.body.contains('"name":"First"')
	list := authed(.get, '/api/items', token, '')!
	assert list.status_code == 200
	assert list.body.contains('"name":"First"')
	item := json.decode(Item, created.body)!
	gone := authed(.delete, '/api/items/\${item.id}', token, '')!
	assert gone.status_code == 204
	missing := authed(.get, '/api/items/\${item.id}', token, '')!
	assert missing.status_code == 404
}

fn test_cors_preflight() {
	resp := http.fetch(
		method: .options
		url:    '\${base_url}/api/items'
		header: http.new_header_from_map({
			.origin:                        'https://example.com'
			.access_control_request_method: 'POST'
		})
	)!
	assert resp.status_code == 200
	assert (resp.header.get(.access_control_allow_origin) or { '' }) in ['*', 'https://example.com']
}
`,

    'v.mod': `Module {
	name: '{{projectName}}'
	description: 'A web service built with V and veb'
	version: '1.0.0'
	license: 'MIT'
	dependencies: []
}
`
  },
  prompts: [
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: 'my-vweb-app'
    },
    {
      type: 'input',
      name: 'description',
      message: 'Project description:',
      default: 'A V language web application built with veb'
    }
  ],
  postInstall: [
    'echo "{{projectName}} is ready!"',
    'echo "Run: v run src"'
  ]
};
