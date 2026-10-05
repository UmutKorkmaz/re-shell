import { BackendTemplate } from '../types';

export const odinHttpTemplate: BackendTemplate = {
  id: 'odin-http',
  name: 'odin-http',
  displayName: 'Odin (HTTP)',
  description: 'Odin HTTP API on the odin-http library: non-blocking multi-threaded server, JWT auth and unit tests',
  language: 'odin',
  framework: 'odin',
  version: '1.1.0',
  tags: ['odin', 'systems', 'performance', 'manual-memory', 'http', 'concurrency'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing', 'graphql'],

  files: {
    '.gitignore': `# Build output
app
{{projectName}}
{{projectName}}-test
*.o
*.bin

# odin-http is fetched by scripts/setup-deps.sh
deps/

# IDE
.idea/
.vscode/

# OS
.DS_Store
Thumbs.db

# Environment
.env
*.log
`,

    'Dockerfile': `# Build stage: Odin is built from the pinned release tag (it needs LLVM 17-22 and a C++ compiler)
FROM ubuntu:24.04 AS builder

ARG ODIN_VERSION=dev-2026-09

RUN apt-get update && apt-get install -y --no-install-recommends \\
    git ca-certificates make clang llvm-18-dev \\
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch \${ODIN_VERSION} https://github.com/odin-lang/Odin /opt/odin \\
    && cd /opt/odin \\
    && LLVM_CONFIG=llvm-config-18 sh build_odin.sh release

ENV PATH="/opt/odin:\${PATH}" ODIN_ROOT="/opt/odin"

WORKDIR /app
COPY scripts ./scripts
COPY src ./src
COPY Makefile ./

# fetch odin-http into deps/, then build an optimised binary
RUN sh scripts/setup-deps.sh && odin build src -collection:deps=./deps -o:speed -out:app

# Runtime stage
FROM ubuntu:24.04

RUN useradd --system --uid 1001 appuser
WORKDIR /app
COPY --from=builder /app/app ./app
USER appuser

ENV PORT=8080
EXPOSE 8080

CMD ["./app"]
`,

    'Makefile': `# {{projectName}} Makefile (needs the Odin compiler and git, see README.md)

ODIN_FLAGS := -collection:deps=./deps

.PHONY: all deps build run release test check clean docker-build docker-run

all: build

# Fetch odin-http into deps/ (once)
deps:
	sh scripts/setup-deps.sh

build: deps
	odin build src $(ODIN_FLAGS) -out:{{projectName}}

run: deps
	odin run src $(ODIN_FLAGS) -out:{{projectName}}

release: deps
	odin build src $(ODIN_FLAGS) -o:speed -out:{{projectName}}

test: deps
	odin test src $(ODIN_FLAGS) -out:{{projectName}}-test

check: deps
	odin check src $(ODIN_FLAGS)

clean:
	rm -f {{projectName}} {{projectName}}-test

docker-build:
	docker build -t {{projectName}} .

docker-run:
	docker run --rm -p 8080:8080 -e JWT_SECRET=change-me-in-production {{projectName}}
`,

    'README.md': `# {{projectName}}

HTTP API written in [Odin](https://odin-lang.org) with [odin-http](https://github.com/laytan/odin-http).

## Features

- odin-http server: multi-threaded, non-blocking I/O, Lua-pattern router, middleware
- JWT authentication (HS256) and PBKDF2-HMAC-SHA256 password hashing, both from Odin's \`core:crypto\`
- Products CRUD (writes need a token) with an in-memory, mutex-guarded store
- CORS middleware that answers preflight requests, and a minimal GraphQL endpoint
- Unit tests for the token, password and store code (\`odin test\`)

## Requirements

- Odin \`dev-2026-09\` (https://odin-lang.org/docs/install/). It needs clang and LLVM 17 or newer on Linux.
- git and network access once, for \`make deps\`

odin-http tracks recent Odin releases and does not promise compatibility with older ones. \`scripts/setup-deps.sh\` pins an odin-http commit that builds with \`dev-2026-09\`; when you upgrade Odin, upgrade that commit too.

## Getting started

\`\`\`bash
make deps     # fetch odin-http into deps/ (once)
make run      # odin run src -collection:deps=./deps
make test     # odin test
make build    # builds ./{{projectName}}
\`\`\`

Odin has no package manager: \`-collection:deps=./deps\` makes \`import http "deps:odin-http"\` resolve to \`deps/odin-http\`.

Configuration comes from the environment: \`PORT\` (default 8080) and \`JWT_SECRET\`. A warning is logged when \`JWT_SECRET\` is not set; never use the default in production.

## API endpoints

- \`GET /\` - home page
- \`GET /api/v1/health\` - health check
- \`POST /graphql\` - GraphQL (\`{ hello health }\`, schema in \`graphql/schema.graphql\`)
- \`POST /api/v1/auth/register\` - register \`{"email", "name", "password"}\`, returns a token
- \`POST /api/v1/auth/login\` - login, returns a token
- \`GET /api/v1/auth/me\` - current user (Bearer token)
- \`GET /api/v1/products\` - list products
- \`GET /api/v1/products/:id\` - get a product
- \`POST /api/v1/products\` - create a product (Bearer token)
- \`PUT /api/v1/products/:id\` - replace a product (Bearer token)
- \`DELETE /api/v1/products/:id\` - delete a product (Bearer token)

## Project structure

\`\`\`
src/main.odin       server setup and routes
src/handlers.odin   request handlers and middleware
src/auth.odin       password hashing and JWT tokens
src/store.odin      in-memory store
src/app_test.odin   tests
scripts/setup-deps.sh
\`\`\`

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run --rm -p 8080:8080 --security-opt seccomp=unconfined -e JWT_SECRET=change-me {{projectName}}
\`\`\`

odin-http uses io_uring on Linux, which Docker's default seccomp profile may block (hence \`seccomp=unconfined\`, also set in \`docker-compose.yml\`). The image builds Odin from the pinned tag, so the first build takes a few minutes.

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
    # odin-http uses io_uring on Linux; Docker's default seccomp profile may block it
    security_opt:
      - seccomp=unconfined
    restart: unless-stopped
`,

    'graphql/schema.graphql': `# {{projectName}} - GraphQL Schema (served by POST /graphql)
type Query {
  hello: String!
  health: String!
}
`,

    'ols.json': `{
  "$schema": "https://raw.githubusercontent.com/DanielGavin/ols/master/misc/ols.schema.json",
  "collections": [
    { "name": "deps", "path": "deps" }
  ],
  "enable_document_symbols": true,
  "enable_hover": true,
  "enable_snippets": true
}
`,

    'scripts/setup-deps.sh': `#!/bin/sh
# Fetches the odin-http library into deps/odin-http at a pinned commit.
#
# Odin has no package manager: libraries are plain source directories that the build
# picks up through a collection (-collection:deps=./deps, see the Makefile), so
# \`import http "deps:odin-http"\` resolves to deps/odin-http. odin-http tracks recent Odin
# releases (this commit builds with Odin dev-2026-09), so bump both together.
set -eu

ODIN_HTTP_REPO="https://github.com/laytan/odin-http"
ODIN_HTTP_COMMIT="fac113fbd828aad3d71479a534b5de4358b6a07b"

root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/deps/odin-http"

if [ -f "$dest/.setup-done" ] && [ "$(cat "$dest/.setup-done")" = "$ODIN_HTTP_COMMIT" ]; then
  echo "odin-http $ODIN_HTTP_COMMIT is already in deps/odin-http"
  exit 0
fi

rm -rf "$dest"
mkdir -p "$dest"
git init -q "$dest"
git -C "$dest" fetch -q --depth 1 "$ODIN_HTTP_REPO" "$ODIN_HTTP_COMMIT"
git -C "$dest" checkout -q FETCH_HEAD
rm -rf "$dest/.git"

echo "$ODIN_HTTP_COMMIT" >"$dest/.setup-done"
echo "odin-http $ODIN_HTTP_COMMIT installed in deps/odin-http"
`,

    'src/app_test.odin': `package main

import "core:testing"

@(test)
test_password_hashing :: proc(t: ^testing.T) {
	salt := new_salt()
	cred := Credential {
		user_id = 1,
		salt    = salt,
		hash    = hash_password("correct horse", salt),
	}
	testing.expect(t, verify_password("correct horse", cred))
	testing.expect(t, !verify_password("battery staple", cred))
}

@(test)
test_token_round_trip :: proc(t: ^testing.T) {
	token, expires_at := generate_token_at("secret", 42, 1_000)
	testing.expect_value(t, expires_at, i64(1_000 + TOKEN_TTL_SECONDS))

	id, ok := verify_token_at("secret", token, 2_000)
	testing.expect(t, ok)
	testing.expect_value(t, id, 42)
}

@(test)
test_token_rejections :: proc(t: ^testing.T) {
	token, _ := generate_token_at("secret", 42, 1_000)

	_, ok := verify_token_at("another secret", token, 2_000)
	testing.expect(t, !ok, "a token signed with another secret must be rejected")

	_, ok = verify_token_at("secret", token, 1_000 + TOKEN_TTL_SECONDS + 1)
	testing.expect(t, !ok, "an expired token must be rejected")

	_, ok = verify_token_at("secret", "not.a.token", 2_000)
	testing.expect(t, !ok)

	_, ok = verify_token_at("secret", "garbage", 2_000)
	testing.expect(t, !ok)
}

@(test)
test_content_length_validation :: proc(t: ^testing.T) {
	testing.expect(t, content_length_ok("0"))
	testing.expect(t, content_length_ok("1048576"))
	testing.expect(t, !content_length_ok(""))
	testing.expect(t, !content_length_ok("-1"), "a negative length must be rejected")
	testing.expect(t, !content_length_ok("+5"))
	testing.expect(t, !content_length_ok("12abc"))
	testing.expect(t, !content_length_ok(" 5"))
}

// The store is a global, so its tests live in one procedure (tests run on several threads).
@(test)
test_store :: proc(t: ^testing.T) {
	store_init()
	defer store_destroy()

	salt := new_salt()
	hash := hash_password("pw", salt)
	user, ok := store_add_user("a@example.com", "A", salt, hash)
	testing.expect(t, ok)
	testing.expect_value(t, user.id, 1)

	_, duplicate := store_add_user("a@example.com", "Again", salt, hash)
	testing.expect(t, !duplicate, "emails are unique")

	found, cred, exists := store_find_user_by_email("a@example.com")
	testing.expect(t, exists)
	testing.expect_value(t, found.name, "A")
	testing.expect(t, verify_password("pw", cred))

	_, missing := store_find_user_by_id(99)
	testing.expect(t, !missing)

	testing.expect_value(t, len(store_list_products()), 2)

	created := store_add_product("Widget", "A widget", 9.5, 3)
	testing.expect_value(t, created.id, 3)

	updated, updated_ok := store_update_product(created.id, "Gadget", "A gadget", 12, 1)
	testing.expect(t, updated_ok)
	testing.expect_value(t, updated.name, "Gadget")

	fetched, fetched_ok := store_get_product(created.id)
	testing.expect(t, fetched_ok)
	testing.expect_value(t, fetched.stock, 1)

	testing.expect(t, store_delete_product(created.id))
	_, still_there := store_get_product(created.id)
	testing.expect(t, !still_there)
	testing.expect(t, !store_delete_product(created.id))
}
`,

    'src/auth.odin': `package main

import "core:crypto"
import "core:crypto/hmac"
import "core:crypto/pbkdf2"
import "core:encoding/base64"
import "core:encoding/json"
import "core:strings"
import "core:time"

PBKDF2_ITERATIONS :: 100_000
TOKEN_TTL_SECONDS :: 24 * 60 * 60

// jwt_secret is set once in main before the server starts.
jwt_secret: string

Claims :: struct {
	sub: int,
	iat: i64,
	exp: i64,
}

new_salt :: proc() -> (salt: [16]byte) {
	crypto.rand_bytes(salt[:])
	return
}

// hash_password derives a 32 byte key with PBKDF2-HMAC-SHA256.
hash_password :: proc(password: string, salt: [16]byte) -> (hash: [32]byte) {
	salt := salt
	pbkdf2.derive(.SHA256, transmute([]byte)password, salt[:], PBKDF2_ITERATIONS, hash[:])
	return
}

verify_password :: proc(password: string, cred: Credential) -> bool {
	expected := cred.hash
	actual := hash_password(password, cred.salt)
	return crypto.compare_constant_time(expected[:], actual[:]) == 1
}

// base64url without padding, as JWT requires.
b64url_encode :: proc(data: []byte) -> string {
	encoded, _ := base64.encode(data, base64.ENC_URL_TABLE, context.temp_allocator)
	return strings.trim_right(encoded, "=")
}

b64url_decode :: proc(s: string) -> (data: []byte, ok: bool) {
	padded := s
	if rem := len(s) % 4; rem != 0 {
		padded = strings.concatenate({s, strings.repeat("=", 4 - rem, context.temp_allocator)}, context.temp_allocator)
	}
	decoded, err := base64.decode(padded, base64.DEC_URL_TABLE, allocator = context.temp_allocator)
	return decoded, err == nil
}

sign :: proc(secret, input: string) -> []byte {
	tag := make([]byte, 32, context.temp_allocator)
	hmac.sum(.SHA256, tag, transmute([]byte)input, transmute([]byte)secret)
	return tag
}

generate_token_at :: proc(secret: string, user_id: int, now: i64) -> (token: string, expires_at: i64) {
	claims := Claims {
		sub = user_id,
		iat = now,
		exp = now + TOKEN_TTL_SECONDS,
	}
	payload, _ := json.marshal(claims, allocator = context.temp_allocator)
	header := b64url_encode(transmute([]byte)string(\`{"alg":"HS256","typ":"JWT"}\`))
	signing_input := strings.concatenate({header, ".", b64url_encode(payload)}, context.temp_allocator)
	token = strings.concatenate({signing_input, ".", b64url_encode(sign(secret, signing_input))}, context.temp_allocator)
	return token, claims.exp
}

generate_token :: proc(secret: string, user_id: int) -> (token: string, expires_at: i64) {
	return generate_token_at(secret, user_id, time.to_unix_seconds(time.now()))
}

// verify_token_at returns the user id of a token with a valid signature that has not expired.
verify_token_at :: proc(secret, token: string, now: i64) -> (user_id: int, ok: bool) {
	parts := strings.split(token, ".", context.temp_allocator)
	if len(parts) != 3 {
		return 0, false
	}

	signing_input := strings.concatenate({parts[0], ".", parts[1]}, context.temp_allocator)
	given := b64url_decode(parts[2]) or_return
	expected := sign(secret, signing_input)
	if crypto.compare_constant_time(given, expected) != 1 {
		return 0, false
	}

	payload := b64url_decode(parts[1]) or_return
	claims: Claims
	if err := json.unmarshal(payload, &claims, allocator = context.temp_allocator); err != nil {
		return 0, false
	}
	if claims.exp < now {
		return 0, false
	}
	return claims.sub, true
}

verify_token :: proc(secret, token: string) -> (user_id: int, ok: bool) {
	return verify_token_at(secret, token, time.to_unix_seconds(time.now()))
}
`,

    'src/handlers.odin': `package main

import "core:encoding/json"
import "core:log"
import "core:strconv"
import "core:strings"
import "core:time"

import http "deps:odin-http"

MAX_BODY_BYTES :: 1 << 20

Error_Response :: struct {
	error: string,
}

Health_Response :: struct {
	status:    string,
	timestamp: string,
	version:   string,
}

Auth_Response :: struct {
	token:      string,
	expires_at: i64,
	user:       User,
}

Product_List :: struct {
	products: []Product,
	count:    int,
}

Register_Input :: struct {
	email:    string,
	name:     string,
	password: string,
}

Login_Input :: struct {
	email:    string,
	password: string,
}

Product_Input :: struct {
	name:        string,
	description: string,
	price:       f64,
	stock:       int,
}

GraphQL_Input :: struct {
	query: string,
}

// What a body callback needs to know once the request body has arrived.
Body_Context :: struct {
	res:        ^http.Response,
	product_id: int,
}

fail :: proc(res: ^http.Response, status: http.Status, message: string) {
	if err := http.respond_json(res, Error_Response{message}, status); err != nil {
		log.errorf("could not write the error response: %v", err)
	}
}

reply :: proc(res: ^http.Response, value: any, status: http.Status = .OK) {
	if err := http.respond_json(res, value, status); err != nil {
		log.errorf("could not write the response: %v", err)
	}
}

// read_body starts reading the request body; \`callback\` runs when it is complete.
read_body :: proc(req: ^http.Request, res: ^http.Response, product_id: int, callback: http.Body_Callback) {
	bc := new(Body_Context, context.temp_allocator)
	bc^ = {res, product_id}
	http.body(req, MAX_BODY_BYTES, bc, callback)
}

// authenticate resolves the Bearer token of the request to a user. It answers 401 itself
// and returns false when there is none.
authenticate :: proc(req: ^http.Request, res: ^http.Response) -> (user: User, ok: bool) {
	header := http.headers_get(req.headers, "authorization")
	if strings.has_prefix(header, "Bearer ") {
		if id, valid := verify_token(jwt_secret, header[len("Bearer "):]); valid {
			if found, exists := store_find_user_by_id(id); exists {
				return found, true
			}
		}
	}
	fail(res, .Unauthorized, "Authentication required")
	return {}, false
}

product_id_from_url :: proc(req: ^http.Request) -> (id: int, ok: bool) {
	return strconv.parse_int(req.url_params[0], 10)
}

// content_length_ok reports whether a Content-Length header value is a plain, non-negative
// decimal number. odin-http asserts on a negative length when it reads (or, after the
// response, drains) a body, which stops the whole server, so such requests are answered
// before any handler runs and the connection is closed without touching the body.
content_length_ok :: proc(value: string) -> bool {
	if len(value) == 0 {
		return false
	}
	for c in value {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// Application-wide middleware: CORS headers, answers preflight requests and rejects
// malformed Content-Length headers.
cors_middleware :: proc(handler: ^http.Handler, req: ^http.Request, res: ^http.Response) {
	http.headers_set(&res.headers, "access-control-allow-origin", "*")
	http.headers_set(&res.headers, "access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS")
	http.headers_set(&res.headers, "access-control-allow-headers", "Content-Type, Authorization")

	if line, ok := req.line.(http.Requestline); ok && line.method == .Options {
		http.respond(res, http.Status.No_Content)
		return
	}

	if length, has_length := http.headers_get(req.headers, "content-length"); has_length && !content_length_ok(length) {
		http.headers_set_close(&res.headers)
		fail(res, .Bad_Request, "Invalid Content-Length header")
		return
	}

	next := handler.next.(^http.Handler)
	next.handle(next, req, res)
}

home_handler :: proc(req: ^http.Request, res: ^http.Response) {
	http.respond_html(res, #load("home.html", string))
}

health_handler :: proc(req: ^http.Request, res: ^http.Response) {
	now, _ := time.time_to_rfc3339(time.now(), include_nanos = false, allocator = context.temp_allocator)
	reply(res, Health_Response{"healthy", now, "1.0.0"})
}

// A minimal GraphQL endpoint: answers the fields of graphql/schema.graphql.
graphql_handler :: proc(req: ^http.Request, res: ^http.Response) {
	read_body(req, res, 0, on_graphql_body)
}

on_graphql_body :: proc(user_data: rawptr, body: http.Body, err: http.Body_Error) {
	bc := cast(^Body_Context)user_data
	res := bc.res
	if err != nil {
		http.respond(res, http.body_error_status(err))
		return
	}

	input: GraphQL_Input
	if json.unmarshal_string(string(body), &input, allocator = context.temp_allocator) != nil {
		fail(res, .Bad_Request, \`Expected a JSON body like {"query": "{ hello }"}\`)
		return
	}

	data := make(map[string]string, allocator = context.temp_allocator)
	if strings.contains(input.query, "hello") {
		data["hello"] = "Hello from {{projectName}} GraphQL!"
	}
	if strings.contains(input.query, "health") {
		data["health"] = "healthy"
	}
	if len(data) == 0 {
		fail(res, .Bad_Request, "Query { hello, health } is supported")
		return
	}

	response := make(map[string]map[string]string, allocator = context.temp_allocator)
	response["data"] = data
	reply(res, response)
}

register_handler :: proc(req: ^http.Request, res: ^http.Response) {
	read_body(req, res, 0, on_register_body)
}

on_register_body :: proc(user_data: rawptr, body: http.Body, err: http.Body_Error) {
	bc := cast(^Body_Context)user_data
	res := bc.res
	if err != nil {
		http.respond(res, http.body_error_status(err))
		return
	}

	input: Register_Input
	if json.unmarshal_string(string(body), &input, allocator = context.temp_allocator) != nil {
		fail(res, .Bad_Request, "Invalid JSON body")
		return
	}
	if input.email == "" || input.name == "" || input.password == "" {
		fail(res, .Bad_Request, "Email, name and password are required")
		return
	}

	salt := new_salt()
	user, ok := store_add_user(input.email, input.name, salt, hash_password(input.password, salt))
	if !ok {
		fail(res, .Conflict, "Email already registered")
		return
	}

	token, expires_at := generate_token(jwt_secret, user.id)
	reply(res, Auth_Response{token, expires_at, user}, .Created)
}

login_handler :: proc(req: ^http.Request, res: ^http.Response) {
	read_body(req, res, 0, on_login_body)
}

on_login_body :: proc(user_data: rawptr, body: http.Body, err: http.Body_Error) {
	bc := cast(^Body_Context)user_data
	res := bc.res
	if err != nil {
		http.respond(res, http.body_error_status(err))
		return
	}

	input: Login_Input
	if json.unmarshal_string(string(body), &input, allocator = context.temp_allocator) != nil {
		fail(res, .Bad_Request, "Invalid JSON body")
		return
	}

	user, cred, found := store_find_user_by_email(input.email)
	if !found || !verify_password(input.password, cred) {
		fail(res, .Unauthorized, "Invalid credentials")
		return
	}

	token, expires_at := generate_token(jwt_secret, user.id)
	reply(res, Auth_Response{token, expires_at, user})
}

me_handler :: proc(req: ^http.Request, res: ^http.Response) {
	user, ok := authenticate(req, res)
	if !ok {
		return
	}
	reply(res, user)
}

list_products_handler :: proc(req: ^http.Request, res: ^http.Response) {
	products := store_list_products()
	reply(res, Product_List{products, len(products)})
}

get_product_handler :: proc(req: ^http.Request, res: ^http.Response) {
	id, id_ok := product_id_from_url(req)
	product, found := store_get_product(id)
	if !id_ok || !found {
		fail(res, .Not_Found, "Product not found")
		return
	}
	reply(res, product)
}

create_product_handler :: proc(req: ^http.Request, res: ^http.Response) {
	if _, authenticated := authenticate(req, res); !authenticated {
		return
	}
	read_body(req, res, 0, on_create_product_body)
}

on_create_product_body :: proc(user_data: rawptr, body: http.Body, err: http.Body_Error) {
	bc := cast(^Body_Context)user_data
	res := bc.res
	if err != nil {
		http.respond(res, http.body_error_status(err))
		return
	}

	input: Product_Input
	if json.unmarshal_string(string(body), &input, allocator = context.temp_allocator) != nil || input.name == "" {
		fail(res, .Bad_Request, "A JSON body with a name is required")
		return
	}

	reply(res, store_add_product(input.name, input.description, input.price, input.stock), .Created)
}

update_product_handler :: proc(req: ^http.Request, res: ^http.Response) {
	if _, authenticated := authenticate(req, res); !authenticated {
		return
	}
	id, ok := product_id_from_url(req)
	if !ok {
		fail(res, .Not_Found, "Product not found")
		return
	}
	read_body(req, res, id, on_update_product_body)
}

on_update_product_body :: proc(user_data: rawptr, body: http.Body, err: http.Body_Error) {
	bc := cast(^Body_Context)user_data
	res := bc.res
	if err != nil {
		http.respond(res, http.body_error_status(err))
		return
	}

	input: Product_Input
	if json.unmarshal_string(string(body), &input, allocator = context.temp_allocator) != nil || input.name == "" {
		fail(res, .Bad_Request, "A JSON body with a name is required")
		return
	}

	product, found := store_update_product(bc.product_id, input.name, input.description, input.price, input.stock)
	if !found {
		fail(res, .Not_Found, "Product not found")
		return
	}
	reply(res, product)
}

delete_product_handler :: proc(req: ^http.Request, res: ^http.Response) {
	if _, authenticated := authenticate(req, res); !authenticated {
		return
	}
	id, ok := product_id_from_url(req)
	if !ok || !store_delete_product(id) {
		fail(res, .Not_Found, "Product not found")
		return
	}
	http.respond(res, http.Status.No_Content)
}
`,

    'src/home.html': `<!DOCTYPE html>
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
    <p>HTTP server built with Odin and odin-http</p>
    <p>API available at: <a href="/api/v1/health">/api/v1/health</a></p>
  </body>
</html>
`,

    'src/main.odin': `package main

import "core:fmt"
import "core:log"
import "core:net"
import "core:os"
import "core:strconv"

import http "deps:odin-http"

DEFAULT_PORT :: 8080
DEFAULT_JWT_SECRET :: "change-me-in-production"

main :: proc() {
	context.logger = log.create_console_logger(.Info)

	port := DEFAULT_PORT
	if value := os.get_env("PORT", context.allocator); value != "" {
		if parsed, ok := strconv.parse_int(value, 10); ok {
			port = parsed
		}
	}
	jwt_secret = os.get_env("JWT_SECRET", context.allocator)
	if jwt_secret == "" {
		jwt_secret = DEFAULT_JWT_SECRET
		log.warn("JWT_SECRET is not set, using an insecure development secret")
	}

	store_init()
	defer store_destroy()

	s: http.Server
	// Shut down gracefully when the program receives SIGINT.
	http.server_shutdown_on_interrupt(&s)

	router: http.Router
	http.router_init(&router)
	defer http.router_destroy(&router)

	// Routes are tried in order. Patterns are Lua patterns, see
	// https://www.lua.org/pil/20.2.html ; captures are available as req.url_params.
	http.route_get(&router, "/", http.handler(home_handler))
	http.route_get(&router, "/api/v1/health", http.handler(health_handler))
	http.route_post(&router, "/graphql", http.handler(graphql_handler))

	http.route_post(&router, "/api/v1/auth/register", http.handler(register_handler))
	http.route_post(&router, "/api/v1/auth/login", http.handler(login_handler))
	http.route_get(&router, "/api/v1/auth/me", http.handler(me_handler))

	http.route_get(&router, "/api/v1/products", http.handler(list_products_handler))
	http.route_post(&router, "/api/v1/products", http.handler(create_product_handler))
	http.route_get(&router, "/api/v1/products/(%d+)", http.handler(get_product_handler))
	http.route_put(&router, "/api/v1/products/(%d+)", http.handler(update_product_handler))
	http.route_delete(&router, "/api/v1/products/(%d+)", http.handler(delete_product_handler))

	routes := http.router_handler(&router)
	handler := http.middleware_proc(&routes, cors_middleware)

	log.infof("listening on http://localhost:%d", port)
	err := http.listen_and_serve(&s, handler, net.Endpoint{address = net.IP4_Any, port = port})
	fmt.assertf(err == nil, "server stopped with error: %v", err)
}
`,

    'src/store.odin': `package main

import "base:runtime"

import "core:strings"
import "core:sync"
import "core:time"

User :: struct {
	id:         int,
	email:      string,
	name:       string,
	role:       string,
	created_at: string,
}

Credential :: struct {
	user_id: int,
	salt:    [16]byte,
	hash:    [32]byte,
}

Product :: struct {
	id:          int,
	name:        string,
	description: string,
	price:       f64,
	stock:       int,
}

// The in-memory database. Handlers run on several server threads, so every access
// must hold \`mu\`. Everything stored here is allocated with the default (heap)
// allocator, never with the per-connection temp allocator.
Store :: struct {
	mu:              sync.Mutex,
	users:           [dynamic]User,
	credentials:     [dynamic]Credential,
	products:        [dynamic]Product,
	next_user_id:    int,
	next_product_id: int,
}

store: Store

store_init :: proc() {
	heap := runtime.default_allocator()
	store.users = make([dynamic]User, heap)
	store.credentials = make([dynamic]Credential, heap)
	store.products = make([dynamic]Product, heap)
	store.next_user_id = 1
	store.next_product_id = 1

	store_add_product("Sample Product 1", "This is a sample product", 29.99, 100)
	store_add_product("Sample Product 2", "Another sample product", 49.99, 50)
}

store_destroy :: proc() {
	for u in store.users {
		heap_free(u.email)
		heap_free(u.name)
		heap_free(u.role)
		heap_free(u.created_at)
	}
	for p in store.products {
		heap_free(p.name)
		heap_free(p.description)
	}
	delete(store.users)
	delete(store.credentials)
	delete(store.products)
}

heap_clone :: proc(s: string) -> string {
	return strings.clone(s, runtime.default_allocator())
}

heap_free :: proc(s: string) {
	delete(s, runtime.default_allocator())
}

// store_add_user returns ok = false when the email is already registered.
store_add_user :: proc(email, name: string, salt: [16]byte, hash: [32]byte) -> (user: User, ok: bool) {
	sync.mutex_lock(&store.mu)
	defer sync.mutex_unlock(&store.mu)

	for u in store.users {
		if u.email == email {
			return {}, false
		}
	}

	created_at, _ := time.time_to_rfc3339(time.now(), include_nanos = false, allocator = context.temp_allocator)
	user = User {
		id         = store.next_user_id,
		email      = heap_clone(email),
		name       = heap_clone(name),
		role       = heap_clone("user"),
		created_at = heap_clone(created_at),
	}
	store.next_user_id += 1
	append(&store.users, user)
	append(&store.credentials, Credential{user_id = user.id, salt = salt, hash = hash})
	return user, true
}

// store_find_user_by_email copies the user into the temp allocator, so the result stays
// valid after the lock is released.
store_find_user_by_email :: proc(email: string) -> (user: User, cred: Credential, ok: bool) {
	sync.mutex_lock(&store.mu)
	defer sync.mutex_unlock(&store.mu)

	for u in store.users {
		if u.email == email {
			return user_clone(u), credential_for(u.id), true
		}
	}
	return {}, {}, false
}

store_find_user_by_id :: proc(id: int) -> (user: User, ok: bool) {
	sync.mutex_lock(&store.mu)
	defer sync.mutex_unlock(&store.mu)

	for u in store.users {
		if u.id == id {
			return user_clone(u), true
		}
	}
	return {}, false
}

@(private = "file")
credential_for :: proc(user_id: int) -> Credential {
	for c in store.credentials {
		if c.user_id == user_id {
			return c
		}
	}
	return {}
}

@(private = "file")
user_clone :: proc(u: User) -> User {
	return User {
		id = u.id,
		email = strings.clone(u.email, context.temp_allocator),
		name = strings.clone(u.name, context.temp_allocator),
		role = strings.clone(u.role, context.temp_allocator),
		created_at = strings.clone(u.created_at, context.temp_allocator),
	}
}

@(private = "file")
product_clone :: proc(p: Product) -> Product {
	return Product {
		id = p.id,
		name = strings.clone(p.name, context.temp_allocator),
		description = strings.clone(p.description, context.temp_allocator),
		price = p.price,
		stock = p.stock,
	}
}

store_add_product :: proc(name, description: string, price: f64, stock: int) -> Product {
	sync.mutex_lock(&store.mu)
	defer sync.mutex_unlock(&store.mu)

	product := Product {
		id          = store.next_product_id,
		name        = heap_clone(name),
		description = heap_clone(description),
		price       = price,
		stock       = stock,
	}
	store.next_product_id += 1
	append(&store.products, product)
	return product_clone(product)
}

store_list_products :: proc() -> []Product {
	sync.mutex_lock(&store.mu)
	defer sync.mutex_unlock(&store.mu)

	list := make([]Product, len(store.products), context.temp_allocator)
	for p, i in store.products {
		list[i] = product_clone(p)
	}
	return list
}

store_get_product :: proc(id: int) -> (product: Product, ok: bool) {
	sync.mutex_lock(&store.mu)
	defer sync.mutex_unlock(&store.mu)

	for p in store.products {
		if p.id == id {
			return product_clone(p), true
		}
	}
	return {}, false
}

store_update_product :: proc(id: int, name, description: string, price: f64, stock: int) -> (product: Product, ok: bool) {
	sync.mutex_lock(&store.mu)
	defer sync.mutex_unlock(&store.mu)

	for &p in store.products {
		if p.id == id {
			heap_free(p.name)
			heap_free(p.description)
			p.name = heap_clone(name)
			p.description = heap_clone(description)
			p.price = price
			p.stock = stock
			return product_clone(p), true
		}
	}
	return {}, false
}

store_delete_product :: proc(id: int) -> bool {
	sync.mutex_lock(&store.mu)
	defer sync.mutex_unlock(&store.mu)

	for p, i in store.products {
		if p.id == id {
			heap_free(p.name)
			heap_free(p.description)
			ordered_remove(&store.products, i)
			return true
		}
	}
	return false
}
`
  }
};
