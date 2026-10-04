import { BackendTemplate } from '../types';

export const vexVTemplate: BackendTemplate = {
  id: 'vex-v',
  name: 'vex-v',
  displayName: 'Vex (V)',
  description: 'Express-like router for V (vex) with middleware, JWT auth and a threaded HTTP server',
  language: 'v',
  framework: 'vex',
  version: '1.1.0',
  tags: ['v', 'vex', 'express-like', 'routing', 'middleware', 'json'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'middleware', 'graphql', 'testing'],

  files: {
    '.env.example': `# The server reads these from the process environment (V does not load .env files)
PORT=8080
JWT_SECRET=change-me-in-production
`,

    '.gitignore': `# V build artifacts
*.o
*.exe
{{projectName}}
app

# vex is fetched by scripts/setup-vex.sh
src/modules/

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
COPY scripts ./scripts
COPY src ./src

# fetch the (patched) vex framework into src/modules, then build
RUN sh scripts/setup-vex.sh && /opt/v/v -cc gcc -prod -o app src

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

    'Makefile': `# {{projectName}} Makefile (needs V and git, see README.md)

.PHONY: all deps build run test fmt release clean docker-build docker-run

all: build

# Install the vex framework into src/modules (once)
deps:
	sh scripts/setup-vex.sh

build: deps
	v -o {{projectName}} src

release: deps
	v -prod -o {{projectName}} src

run: deps
	v run src

# The tests start their own server on port 18081
test: deps
	v test src/app_test.v

fmt:
	v fmt -w src/*.v

clean:
	rm -f {{projectName}}

docker-build:
	docker build -t {{projectName}} .

docker-run:
	docker run --rm -p 8080:8080 -e JWT_SECRET=change-me-in-production {{projectName}}
`,

    'README.md': `# {{projectName}}

REST API written in [V](https://vlang.io) on the [vex](https://github.com/nedpals/vex) router and request/response types.

## About vex

vex is an Express-like router for V. It is not published as a release and its last commit (December 2023) predates V 0.5, so on current V two statements in \`ctx/ctx.v\` do not compile and one call is deprecated. \`scripts/setup-vex.sh\` fetches the pinned commit into \`src/modules/nedpals/vex\` and applies those three one-line fixes; run it once (\`make deps\` does that). The app uses vex's router, middleware and \`Req\`/\`Resp\` types. vex's own server is single-threaded and IPv6-only, so \`src/serve.v\` runs a small threaded HTTP/1.1 server around the router instead.

If you want a framework that ships with V and is maintained, see the \`vweb\` template (veb).

## Features

- Routing with parameters, application-wide middleware (CORS, request logging)
- JWT authentication (HS256) with bcrypt password hashing
- Products CRUD (writes need a token) with in-memory storage
- A minimal GraphQL endpoint
- Integration tests that start the server themselves

## Requirements

- V 0.5.2 (see https://github.com/vlang/v#installing-v-from-source) and a C compiler
- git and network access for \`make deps\`

## Getting started

\`\`\`bash
make deps   # fetch and patch vex into src/modules (once)
make run    # v run src
make test   # starts a test server on port 18081
make build  # builds ./{{projectName}}
\`\`\`

Configuration comes from the environment: \`PORT\` (default 8080) and \`JWT_SECRET\`. A warning is printed when \`JWT_SECRET\` is not set; never use the default in production.

## API endpoints

- \`GET /api/v1/health\` - health check
- \`POST /graphql\` - GraphQL (\`{ hello health }\`, schema in \`graphql/schema.graphql\`)
- \`POST /api/v1/auth/register\` - register \`{"email", "name", "password"}\`, returns a token
- \`POST /api/v1/auth/login\` - login, returns a token
- \`GET /api/v1/auth/me\` - current user (Bearer token)
- \`GET /api/v1/products\` - list products
- \`GET /api/v1/products/:id\` - get a product
- \`POST /api/v1/products\` - create a product (Bearer token)
- \`PUT /api/v1/products/:id\` - update a product (Bearer token)
- \`DELETE /api/v1/products/:id\` - delete a product (Bearer token)

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run --rm -p 8080:8080 -e JWT_SECRET=change-me {{projectName}}
\`\`\`

The image builds V from the pinned release, so the first build takes a few minutes.

## License

MIT (vex is MIT licensed, copyright Ned Palacios)
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

    'scripts/setup-vex.sh': `#!/bin/sh
# Installs the vex web framework into src/modules/nedpals/vex, where V finds it as \`nedpals.vex\`.
#
# vex (https://github.com/nedpals/vex) has no releases and its last commit predates V 0.5,
# so two statements no longer compile with current V and one call is deprecated. This script
# fetches the pinned commit and applies those three one-line fixes. It needs git and network
# access once.
set -eu

VEX_REPO="https://github.com/nedpals/vex"
VEX_COMMIT="2e1ba86ea1d6f7a273871890715ebeed7fb7ad80"

root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/src/modules/nedpals/vex"

if [ -f "$dest/.setup-done" ] && [ "$(cat "$dest/.setup-done")" = "$VEX_COMMIT" ]; then
  echo "vex $VEX_COMMIT is already installed in src/modules/nedpals/vex"
  exit 0
fi

rm -rf "$dest"
mkdir -p "$dest"
git init -q "$dest"
git -C "$dest" fetch -q --depth 1 "$VEX_REPO" "$VEX_COMMIT"
git -C "$dest" checkout -q FETCH_HEAD
rm -rf "$dest/.git"

# patch <file> <sed expression> <text that must be present afterwards>
patch_file() {
  sed "$2" "$dest/$1" >"$dest/$1.tmp"
  mv "$dest/$1.tmp" "$dest/$1"
  if ! grep -qF -- "$3" "$dest/$1"; then
    echo "setup-vex: could not patch $1 (expected: $3)" >&2
    exit 1
  fi
}

# a struct field default may no longer copy a map
patch_file ctx/ctx.v 's/= ctx\\.default_headers$/= ctx.default_headers.clone()/' 'ctx.default_headers.clone()'
# a smart-cast \`int\` is a value, not a pointer
patch_file ctx/ctx.v 's/return \\*code/return code/' 'return code'
# time.Time.utc_string is deprecated
patch_file ctx/cookie.v 's/\\.utc_string()/.http_header_string()/' '.http_header_string()'

echo "$VEX_COMMIT" >"$dest/.setup-done"
echo "vex $VEX_COMMIT installed in src/modules/nedpals/vex"
`,

    'src/app_test.v': `module main

import json
import net.http
import time

const test_port = 18081
const base_url = 'http://127.0.0.1:\${test_port}'

fn testsuite_begin() {
	mut app := new_app('test-secret')
	spawn serve(build_router(mut app), test_port)
	// wait until the server answers
	for _ in 0 .. 50 {
		http.get('\${base_url}/api/v1/health') or {
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

fn register(email string) !AuthResponse {
	body := '{"email":"\${email}","name":"Test User","password":"password123"}'
	resp := http.post_json('\${base_url}/api/v1/auth/register', body)!
	assert resp.status_code == 201
	return json.decode(AuthResponse, resp.body)!
}

fn test_health() {
	resp := http.get('\${base_url}/api/v1/health')!
	assert resp.status_code == 200
	assert resp.body.contains('"status":"healthy"')
}

fn test_unknown_route_is_404_and_does_not_echo_headers() {
	resp := http.fetch(
		url:    '\${base_url}/nope'
		header: http.new_header_from_map({
			.authorization: 'Bearer secret-value'
		})
	)!
	assert resp.status_code == 404
	assert !resp.header.contains(.authorization)
}

fn test_graphql() {
	resp := http.post_json('\${base_url}/graphql', '{"query":"{ hello health }"}')!
	assert resp.status_code == 200
	assert resp.body.contains('"health":"healthy"')
}

fn test_register_login_and_me() {
	registered := register('me@example.com')!
	assert registered.user.email == 'me@example.com'
	again := http.post_json('\${base_url}/api/v1/auth/register',
		'{"email":"me@example.com","name":"Again","password":"password123"}')!
	assert again.status_code == 409
	wrong := http.post_json('\${base_url}/api/v1/auth/login',
		'{"email":"me@example.com","password":"nope"}')!
	assert wrong.status_code == 401
	login := http.post_json('\${base_url}/api/v1/auth/login',
		'{"email":"me@example.com","password":"password123"}')!
	assert login.status_code == 200
	token := json.decode(AuthResponse, login.body)!.token
	me := authed(.get, '/api/v1/auth/me', token, '')!
	assert me.status_code == 200
	assert me.body.contains('"email":"me@example.com"')
	assert authed(.get, '/api/v1/auth/me', 'garbage', '')!.status_code == 401
}

fn test_products_crud() {
	list := http.get('\${base_url}/api/v1/products')!
	assert list.status_code == 200
	assert list.body.contains('Sample Product 1')
	assert http.post_json('\${base_url}/api/v1/products', '{"name":"No auth"}')!.status_code == 401

	token := register('products@example.com')!.token
	created := authed(.post, '/api/v1/products', token,
		'{"name":"Widget","description":"A widget","price":9.5,"stock":3}')!
	assert created.status_code == 201
	product := json.decode(Product, created.body)!
	assert product.name == 'Widget'

	one := http.get('\${base_url}/api/v1/products/\${product.id}')!
	assert one.status_code == 200
	updated :=
		authed(.put, '/api/v1/products/\${product.id}', token, '{"name":"Gadget","stock":-1}')!
	assert updated.status_code == 200
	assert updated.body.contains('"name":"Gadget"')
	assert updated.body.contains('"stock":3')
	gone := authed(.delete, '/api/v1/products/\${product.id}', token, '')!
	assert gone.status_code == 204
	assert http.get('\${base_url}/api/v1/products/\${product.id}')!.status_code == 404
}

fn test_cors_preflight() {
	resp := http.fetch(
		method: .options
		url:    '\${base_url}/api/v1/products'
		header: http.new_header_from_map({
			.origin: 'https://example.com'
		})
	)!
	assert resp.status_code == 204
	assert resp.header.get(.access_control_allow_origin) or { '' } == '*'
}
`,

    'src/auth.v': `module main

import json
import time
import crypto.bcrypt
import crypto.hmac
import crypto.sha256
import encoding.base64
import nedpals.vex.ctx

const token_ttl_seconds = 24 * 60 * 60

struct RegisterRequest {
	email    string
	name     string
	password string
}

struct LoginRequest {
	email    string
	password string
}

struct AuthResponse {
	token      string
	expires_at i64
	user       User
}

struct JwtClaims {
	sub int
	iat i64
	exp i64
}

fn sign(secret string, input string) string {
	mac := hmac.new(secret.bytes(), input.bytes(), sha256.sum, sha256.block_size)
	return base64.url_encode(mac)
}

fn generate_jwt(secret string, user_id int) (string, i64) {
	now := time.now().unix()
	claims := JwtClaims{
		sub: user_id
		iat: now
		exp: now + token_ttl_seconds
	}
	header_b64 := base64.url_encode_str('{"alg":"HS256","typ":"JWT"}')
	payload_b64 := base64.url_encode_str(json.encode(claims))
	signing_input := '\${header_b64}.\${payload_b64}'
	return '\${signing_input}.\${sign(secret, signing_input)}', claims.exp
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

// header returns a request header; names are matched case-insensitively.
fn header(req &ctx.Req, name string) string {
	wanted := name.to_lower()
	for key, values in req.headers {
		if key.to_lower() == wanted && values.len > 0 {
			return values[0]
		}
	}
	return ''
}

fn fail(mut res ctx.Resp, status int, message string) {
	res.send_json(ErrorResponse{ error: message }, status)
}

// current_user resolves the Bearer token of the request to a stored user.
fn (mut app App) current_user(req &ctx.Req) ?User {
	authorization := header(req, 'Authorization')
	if !authorization.starts_with('Bearer ') {
		return none
	}
	user_id := verify_jwt(app.jwt_secret, authorization[7..]) or { return none }
	app.mu.lock()
	defer {
		app.mu.unlock()
	}
	for user in app.users {
		if user.id == user_id {
			return user
		}
	}
	return none
}

fn (mut app App) register(req &ctx.Req, mut res ctx.Resp) {
	body := json.decode(RegisterRequest, req.body.bytestr()) or {
		fail(mut res, 400, 'Invalid JSON body')
		return
	}
	if body.email == '' || body.name == '' || body.password == '' {
		fail(mut res, 400, 'Email, name and password are required')
		return
	}
	hash := bcrypt.generate_from_password(body.password.bytes(), 10) or {
		fail(mut res, 500, 'Could not hash the password')
		return
	}
	app.mu.lock()
	for user in app.users {
		if user.email == body.email {
			app.mu.unlock()
			fail(mut res, 409, 'Email already registered')
			return
		}
	}
	user := User{
		id:         app.next_user_id
		email:      body.email
		name:       body.name
		role:       'user'
		created_at: now_rfc3339()
	}
	app.next_user_id++
	app.users << user
	app.password_hashes[user.id] = hash
	app.mu.unlock()
	token, expires_at := generate_jwt(app.jwt_secret, user.id)
	res.send_json(AuthResponse{
		token:      token
		expires_at: expires_at
		user:       user
	}, 201)
}

fn (mut app App) login(req &ctx.Req, mut res ctx.Resp) {
	body := json.decode(LoginRequest, req.body.bytestr()) or {
		fail(mut res, 400, 'Invalid JSON body')
		return
	}
	mut found := User{}
	mut hash := ''
	app.mu.lock()
	for user in app.users {
		if user.email == body.email {
			found = user
			hash = app.password_hashes[user.id] or { '' }
		}
	}
	app.mu.unlock()
	if found.id == 0 || hash == '' {
		fail(mut res, 401, 'Invalid credentials')
		return
	}
	bcrypt.compare_hash_and_password(body.password.bytes(), hash.bytes()) or {
		fail(mut res, 401, 'Invalid credentials')
		return
	}
	token, expires_at := generate_jwt(app.jwt_secret, found.id)
	res.send_json(AuthResponse{
		token:      token
		expires_at: expires_at
		user:       found
	}, 200)
}

fn (mut app App) me(req &ctx.Req, mut res ctx.Resp) {
	user := app.current_user(req) or {
		fail(mut res, 401, 'Authentication required')
		return
	}
	res.send_json(user, 200)
}
`,

    'src/main.v': `module main

import os
import nedpals.vex.ctx
import nedpals.vex.router

const default_jwt_secret = 'change-me-in-production'

const cors_headers = {
	'Access-Control-Allow-Origin':  '*'
	'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
	'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

// Application-wide middleware: CORS headers and request logging.
fn cors(mut _req ctx.Req, mut res ctx.Resp) {
	for name, value in cors_headers {
		res.headers[name] = [value]
	}
}

fn log_request(mut req ctx.Req, mut _res ctx.Resp) {
	println('\${req.method} \${req.path}')
}

// build_router registers the routes. Handlers are closures over the shared App.
fn build_router(mut app App) router.Router {
	mut r := router.new()
	r.use(cors, log_request)

	r.route(.get, '/api/v1/health', fn [mut app] (req &ctx.Req, mut res ctx.Resp) {
		app.health(req, mut res)
	})
	r.route(.post, '/graphql', fn [mut app] (req &ctx.Req, mut res ctx.Resp) {
		app.graphql(req, mut res)
	})

	r.route(.post, '/api/v1/auth/register', fn [mut app] (req &ctx.Req, mut res ctx.Resp) {
		app.register(req, mut res)
	})
	r.route(.post, '/api/v1/auth/login', fn [mut app] (req &ctx.Req, mut res ctx.Resp) {
		app.login(req, mut res)
	})
	r.route(.get, '/api/v1/auth/me', fn [mut app] (req &ctx.Req, mut res ctx.Resp) {
		app.me(req, mut res)
	})

	r.route(.get, '/api/v1/products', fn [mut app] (req &ctx.Req, mut res ctx.Resp) {
		app.list_products(req, mut res)
	})
	r.route(.post, '/api/v1/products', fn [mut app] (req &ctx.Req, mut res ctx.Resp) {
		app.create_product(req, mut res)
	})
	r.route(.get, '/api/v1/products/:id', fn [mut app] (req &ctx.Req, mut res ctx.Resp) {
		app.get_product(req, mut res)
	})
	r.route(.put, '/api/v1/products/:id', fn [mut app] (req &ctx.Req, mut res ctx.Resp) {
		app.update_product(req, mut res)
	})
	r.route(.delete, '/api/v1/products/:id', fn [mut app] (req &ctx.Req, mut res ctx.Resp) {
		app.delete_product(req, mut res)
	})
	return r
}

fn main() {
	port := os.getenv_opt('PORT') or { '8080' }.int()
	jwt_secret := os.getenv_opt('JWT_SECRET') or { default_jwt_secret }
	if jwt_secret == default_jwt_secret {
		eprintln('warning: JWT_SECRET is not set, using an insecure development secret')
	}
	mut app := new_app(jwt_secret)
	serve(build_router(mut app), port) or { panic(err) }
}
`,

    'src/products.v': `module main

import json
import nedpals.vex.ctx

struct ProductList {
	products []Product
	count    int
}

fn (mut app App) health(_ &ctx.Req, mut res ctx.Resp) {
	res.send_json(HealthResponse{
		status:    'healthy'
		timestamp: now_rfc3339()
		version:   '1.0.0'
	}, 200)
}

fn (mut app App) list_products(_ &ctx.Req, mut res ctx.Resp) {
	app.mu.lock()
	products := app.products.clone()
	app.mu.unlock()
	res.send_json(ProductList{
		products: products
		count:    products.len
	}, 200)
}

fn (mut app App) get_product(req &ctx.Req, mut res ctx.Resp) {
	id := req.params['id'].int()
	app.mu.lock()
	defer {
		app.mu.unlock()
	}
	for product in app.products {
		if product.id == id {
			res.send_json(product, 200)
			return
		}
	}
	fail(mut res, 404, 'Product not found')
}

fn (mut app App) create_product(req &ctx.Req, mut res ctx.Resp) {
	app.current_user(req) or {
		fail(mut res, 401, 'Authentication required')
		return
	}
	input := json.decode(ProductInput, req.body.bytestr()) or {
		fail(mut res, 400, 'Invalid JSON body')
		return
	}
	if input.name == '' {
		fail(mut res, 400, 'Name is required')
		return
	}
	app.mu.lock()
	defer {
		app.mu.unlock()
	}
	product := Product{
		id:          app.next_product_id
		name:        input.name
		description: input.description
		price:       input.price
		stock:       input.stock
	}
	app.next_product_id++
	app.products << product
	res.send_json(product, 201)
}

fn (mut app App) update_product(req &ctx.Req, mut res ctx.Resp) {
	app.current_user(req) or {
		fail(mut res, 401, 'Authentication required')
		return
	}
	id := req.params['id'].int()
	input := json.decode(ProductInput, req.body.bytestr()) or {
		fail(mut res, 400, 'Invalid JSON body')
		return
	}
	app.mu.lock()
	defer {
		app.mu.unlock()
	}
	for i, product in app.products {
		if product.id == id {
			app.products[i] = Product{
				id:          id
				name:        if input.name != '' { input.name } else { product.name }
				description: if input.description != '' {
					input.description
				} else {
					product.description
				}
				price:       if input.price > 0 { input.price } else { product.price }
				stock:       if input.stock >= 0 { input.stock } else { product.stock }
			}
			res.send_json(app.products[i], 200)
			return
		}
	}
	fail(mut res, 404, 'Product not found')
}

fn (mut app App) delete_product(req &ctx.Req, mut res ctx.Resp) {
	app.current_user(req) or {
		fail(mut res, 401, 'Authentication required')
		return
	}
	id := req.params['id'].int()
	app.mu.lock()
	defer {
		app.mu.unlock()
	}
	for i, product in app.products {
		if product.id == id {
			app.products.delete(i)
			res.send('', 204)
			return
		}
	}
	fail(mut res, 404, 'Product not found')
}

// A minimal GraphQL endpoint: answers the fields of graphql/schema.graphql.
fn (mut app App) graphql(req &ctx.Req, mut res ctx.Resp) {
	body := json.decode(map[string]string, req.body.bytestr()) or {
		fail(mut res, 400, 'Expected a JSON body like {"query": "{ hello }"}')
		return
	}
	query := body['query'] or { '' }
	mut data := map[string]string{}
	if query.contains('hello') {
		data['hello'] = 'Hello from {{projectName}} GraphQL!'
	}
	if query.contains('health') {
		data['health'] = 'healthy'
	}
	if data.len == 0 {
		fail(mut res, 400, 'Query { hello, health } is supported')
		return
	}
	res.send_json({
		'data': data
	}, 200)
}
`,

    'src/serve.v': `module main

import io
import net
import strings
import time
import nedpals.vex.router

const crlf = '\\r\\n'
const max_body_bytes = 1 << 20
const fallback_headers = '\${crlf}Content-Type: text/plain; charset=UTF-8'.bytes()

// serve runs a small threaded HTTP/1.1 server around a vex router. vex ships its own
// server, but it is single-threaded, only binds to IPv6 and waits for the connection to
// close before it hands a request body to the router.
fn serve(r router.Router, port int) ! {
	mut listener := net.listen_tcp(.ip, ':\${port}')!
	println('{{projectName}} listening on http://localhost:\${port}')
	rp := &r
	for {
		conn := listener.accept() or {
			eprintln('accept failed: \${err}')
			continue
		}
		spawn handle_connection(rp, conn)
	}
}

fn handle_connection(r &router.Router, conn &net.TcpConn) {
	mut c := unsafe { conn }
	c.set_read_timeout(5 * time.second)
	defer {
		c.close() or {}
	}
	mut reader := io.new_buffered_reader(reader: c)
	request_line := reader.read_line() or { return }
	parts := request_line.split(' ')
	if parts.len < 2 {
		write_response(mut c, 400, fallback_headers, 'Bad Request'.bytes())
		return
	}
	mut raw_headers := []string{}
	mut content_length := 0
	for {
		line := reader.read_line() or { return }
		if line == '' {
			break
		}
		if line.to_lower().starts_with('content-length:') {
			content_length = line.all_after(':').trim_space().int()
		}
		raw_headers << line
	}
	if content_length > max_body_bytes {
		write_response(mut c, 413, fallback_headers, 'Payload Too Large'.bytes())
		return
	}
	mut body := []u8{len: content_length}
	mut filled := 0
	for filled < content_length {
		n := reader.read(mut body[filled..]) or { return }
		if n <= 0 {
			return
		}
		filled += n
	}
	method := parts[0]
	if method == 'OPTIONS' {
		// CORS preflight: answered for every path, no route needed
		mut headers := ''
		for name, value in cors_headers {
			headers += '\${crlf}\${name}: \${value}'
		}
		write_response(mut c, 204, headers.bytes(), []u8{})
		return
	}
	status, headers, response_body := r.receive(method, parts[1], raw_headers, body)
	if !headers.bytestr().contains('X-Powered-By') {
		// the router answers unknown routes with the raw request headers; never echo them back
		write_response(mut c, status, fallback_headers, response_body)
		return
	}
	write_response(mut c, status, headers, response_body)
}

fn write_response(mut c net.TcpConn, status int, headers []u8, body []u8) {
	mut out := strings.new_builder(body.len + headers.len + 128)
	out.write_string('HTTP/1.1 \${status} ')
	out.write_string(status_text(status))
	unsafe { out.write_ptr(headers.data, headers.len) }
	out.write_string('\${crlf}Content-Length: \${body.len}')
	out.write_string('\${crlf}Connection: close\${crlf}\${crlf}')
	unsafe { out.write_ptr(body.data, body.len) }
	c.write(out) or {}
}

fn status_text(status int) string {
	return match status {
		200 { 'OK' }
		201 { 'Created' }
		204 { 'No Content' }
		400 { 'Bad Request' }
		401 { 'Unauthorized' }
		404 { 'Not Found' }
		409 { 'Conflict' }
		413 { 'Payload Too Large' }
		else { 'Internal Server Error' }
	}
}
`,

    'src/store.v': `module main

import sync
import time

struct User {
	id         int
	email      string
	name       string
	role       string
	created_at string
}

struct Product {
mut:
	id          int
	name        string
	description string
	price       f64
	stock       int
}

struct ProductInput {
	name        string
	description string
	price       f64
	stock       int
}

struct HealthResponse {
	status    string
	timestamp string
	version   string
}

struct ErrorResponse {
	error string
}

// App owns the in-memory data. It is shared by every request thread, so all access goes
// through the mutex (see lock/unlock in the handlers).
@[heap]
struct App {
mut:
	mu              sync.Mutex
	users           []User
	password_hashes map[int]string
	products        []Product
	next_user_id    int = 1
	next_product_id int = 1
	jwt_secret      string
}

fn new_app(jwt_secret string) &App {
	mut app := &App{
		jwt_secret: jwt_secret
	}
	app.products << Product{
		id:          1
		name:        'Sample Product 1'
		description: 'This is a sample product'
		price:       29.99
		stock:       100
	}
	app.products << Product{
		id:          2
		name:        'Sample Product 2'
		description: 'Another sample product'
		price:       49.99
		stock:       50
	}
	app.next_product_id = 3
	return app
}

fn now_rfc3339() string {
	return time.now().format_rfc3339()
}
`,

    'v.mod': `Module {
	name: '{{projectName}}'
	description: 'A web service built with V and the vex router'
	version: '1.0.0'
	license: 'MIT'
	dependencies: []
}
`
  }
};
