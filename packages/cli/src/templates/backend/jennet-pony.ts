import { BackendTemplate } from '../types';

export const jennetPonyTemplate: BackendTemplate = {
  id: 'jennet-pony',
  name: 'jennet-pony',
  displayName: 'Jennet (Pony)',
  description: 'Actor-based web framework for Pony with safe concurrency and high performance',
  language: 'pony',
  framework: 'jennet',
  version: '1.1.0',
  tags: ['pony', 'jennet', 'actors', 'concurrency', 'safe', 'performance'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing', 'graphql'],

  files: {
    '.gitignore': `# Build output
build/

# corral dependencies
_corral/
_repos/

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

    'Dockerfile': `# The official ponyc image (Alpine) carries ponyc, corral, clang and git. It is pinned to
# ponyc 0.61.0: Jennet and http_server are built on the pre-0.72 \`net\` package, and from
# 0.61.1 on the standard library's own \`json\` package shadows the json dependency
# (see README.md). The ponylang/ponyc image on Docker Hub is no longer updated.
FROM ghcr.io/ponylang/ponyc:0.61.0

# the ssl package links against OpenSSL (libssl, libcrypto)
RUN apk add --no-cache openssl-dev

WORKDIR /app

COPY corral.json ./
RUN corral fetch

COPY main.pony ./
COPY app ./app

RUN mkdir -p build \\
    && corral run -- ponyc -V1 -Dopenssl_3.0.x -o build --bin-name={{projectName}} .

ENV PORT=8080
EXPOSE 8080

CMD ["./build/{{projectName}}"]
`,

    'Makefile': `# {{projectName}} Makefile (needs ponyc, corral and OpenSSL development headers, see README.md)

# OpenSSL flavour the ssl package is compiled against: 3.0.x (default), 1.1.x or libressl
ssl ?= 3.0.x
config ?= release

PONYC_FLAGS := -V1 -Dopenssl_$(ssl) -o build
ifeq ($(config),debug)
  PONYC_FLAGS += --debug
endif

SOURCES := $(shell find app main.pony -name '*.pony')

# The compiler release this project builds with (see README.md)
PONYC_VERSION := 0.61.0

.PHONY: all check-ponyc deps build run test clean docker-build docker-run

all: build

check-ponyc:
	@ponyc --version | head -n 1 | grep -q '^$(PONYC_VERSION)' || { \\
	  echo "This project needs ponyc $(PONYC_VERSION): ponyup update ponyc release $(PONYC_VERSION)" >&2; exit 1; }

# Fetch the dependencies into _corral/ (once)
deps: _corral

_corral: corral.json
	corral fetch

build: build/{{projectName}}

build/{{projectName}}: _corral $(SOURCES) | check-ponyc
	mkdir -p build
	corral run -- ponyc $(PONYC_FLAGS) --bin-name={{projectName}} .

run: build
	./build/{{projectName}}

test: check-ponyc _corral $(SOURCES) $(shell find test -name '*.pony')
	mkdir -p build
	corral run -- ponyc $(PONYC_FLAGS) --bin-name={{projectName}}-test test
	./build/{{projectName}}-test

clean:
	rm -rf build

docker-build:
	docker build -t {{projectName}} .

docker-run:
	docker run --rm -p 8080:8080 -e JWT_SECRET=change-me-in-production {{projectName}}
`,

    'README.md': `# {{projectName}}

HTTP API written in [Pony](https://www.ponylang.io) with the [Jennet](https://github.com/Theodus/jennet) web framework.

## Features

- Jennet routing (radix tree, route parameters) on top of ponylang's \`http_server\`
- All state lives in one \`Api\` actor: handlers pass the request's session to it and it answers through the session, so there are no locks and no data races
- JWT authentication (HS256) and PBKDF2-HMAC-SHA256 password hashing, using OpenSSL
- Products CRUD (writes need a token), CORS headers and preflight responses, and a minimal GraphQL endpoint
- Unit tests, including a scripted walk through the whole API (\`pony_test\`)

## Requirements

- ponyc **0.61.0** and corral, installed with [ponyup](https://github.com/ponylang/ponyup):

  \`\`\`bash
  ponyup update ponyc release 0.61.0
  ponyup update corral release
  \`\`\`

  Newer compilers do not build this project. Jennet (its latest commit) and its \`http_server\` dependency use the \`net\` package that ponyc 0.72.0 replaced, and from ponyc 0.61.1 on the standard library ships its own \`json\` package, which takes precedence over the \`ponylang/json\` dependency used here. ponyc 0.61.0 is the newest release with neither change. (\`http_server\` itself is deprecated in favour of [stallion](https://github.com/ponylang/stallion); Jennet has not moved yet.)
- OpenSSL development headers (\`libssl-dev\` on Debian and Ubuntu), \`OpenSSL 3.0.x\` is assumed, use \`make ssl=1.1.x\` for OpenSSL 1.1
- git and network access, for \`corral fetch\`

## Getting started

\`\`\`bash
make deps    # corral fetch
make test    # builds and runs the tests
make run     # builds and starts the server on port 8080
\`\`\`

Or by hand:

\`\`\`bash
corral fetch
mkdir -p build
corral run -- ponyc -Dopenssl_3.0.x -o build --bin-name={{projectName}} .
./build/{{projectName}}
\`\`\`

Configuration comes from the environment: \`PORT\` (default 8080) and \`JWT_SECRET\`. A warning is printed when \`JWT_SECRET\` is not set; never use the default in production.

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
main.pony          Main actor: configuration and routes
app/api.pony       the Api actor (state and request handling)
app/handlers.pony  Jennet request handlers
app/crypto.pony    HMAC, JWT and password hashing
app/models.pony    User and Product
test/main.pony     tests
corral.json        dependencies (pinned versions)
\`\`\`

## Notes

- Jennet's router does not match a route with a \`:param\` when it is the only route of its HTTP method, so \`PUT\` and \`DELETE\` first register a static \`/api/v1/products\` route that answers 405; keep that when you add routes.
- Handlers are immutable (\`val\`) objects and must return the context they receive, so they cannot compute a response themselves. Sending the work to an actor and replying through \`ctx.session\` is the pattern used here.

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run --rm -p 8080:8080 -e JWT_SECRET=change-me {{projectName}}
\`\`\`

## License

MIT
`,

    'app/api.pony': `use "http_server"
use "jennet"
use "json"
use "valbytes"

actor Api
  """
  Owns all application state (users and products) and answers requests.

  A jennet handler passes the request's session and id to a behaviour of this
  actor, which sends the response through the session. Because the state is
  only touched by this actor there are no locks and no data races.
  """
  let _secret: String
  let _users: Array[User] = Array[User]
  let _products: Array[Product] = Array[Product]
  var _next_user: USize = 1
  var _next_product: USize = 1

  new create(secret: String) =>
    _secret = secret
    _add_product("Sample Product 1", "This is a sample product", 29.99, 100)
    _add_product("Sample Product 2", "Another sample product", 49.99, 50)

  // Responses

  fun _send(
    session: Session,
    id: RequestID,
    status: Status,
    body: String val,
    content_type: String = "application/json")
  =>
    session.send(
      StatusResponse(
        status,
        [ ("Content-Type", content_type)
          ("Content-Length", body.size().string())
          ("Access-Control-Allow-Origin", "*")
          ("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
          ("Access-Control-Allow-Headers", "Content-Type, Authorization")
        ]),
      ByteArrays(body.array()),
      id)

  fun _json(session: Session, id: RequestID, status: Status, obj: JsonObject) =>
    _send(session, id, status, obj.string())

  fun _error(session: Session, id: RequestID, status: Status, message: String) =>
    let obj = JsonObject
    obj.data("error") = message
    _json(session, id, status, obj)

  // Request helpers

  fun _parse(body: ByteArrays): (JsonObject | None) =>
    let doc = JsonDoc
    try
      doc.parse(body.string())?
      match doc.data
      | let obj: JsonObject => return obj
      end
    end
    None

  fun _str(obj: JsonObject box, key: String): String =>
    try
      match obj.data(key)?
      | let s: String => s
      else
        ""
      end
    else
      ""
    end

  fun _num(obj: JsonObject box, key: String): F64 =>
    try
      match obj.data(key)?
      | let f: F64 => f
      | let i: I64 => i.f64()
      else
        0
      end
    else
      0
    end

  fun _user_for(authorization: (String | None)): (User | None) =>
    """
    The user a \`Bearer\` token belongs to.
    """
    match authorization
    | let header: String =>
      if header.at("Bearer ") then
        match Jwt.verify(_secret, header.substring(7), Clock.now())
        | let user_id: USize =>
          for user in _users.values() do
            if user.id == user_id then return user end
          end
        end
      end
    end
    None

  fun ref _add_product(name: String, description: String, price: F64, stock: I64): Product =>
    let product = Product(_next_product, name, description, price, stock)
    _next_product = _next_product + 1
    _products.push(product)
    product

  // Public pages

  be home(session: Session, id: RequestID) =>
    _send(
      session,
      id,
      StatusOK,
      "".join(
        [ "<!DOCTYPE html>\\n<html>\\n  <head>\\n    <title>{{projectName}}</title>\\n"
          "    <style>\\n"
          "      body { font-family: Arial, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }\\n"
          "      h1 { color: #333; }\\n"
          "    </style>\\n  </head>\\n  <body>\\n"
          "    <h1>Welcome to {{projectName}}</h1>\\n"
          "    <p>Actor-based web application built with Pony and Jennet</p>\\n"
          "    <p>API available at: <a href=\\"/api/v1/health\\">/api/v1/health</a></p>\\n"
          "  </body>\\n</html>\\n"
        ].values()),
      "text/html")

  be health(session: Session, id: RequestID) =>
    let obj = JsonObject
    obj.data("status") = "healthy"
    obj.data("timestamp") = Clock.iso8601()
    obj.data("version") = "1.0.0"
    _json(session, id, StatusOK, obj)

  be preflight(session: Session, id: RequestID) =>
    _send(session, id, StatusNoContent, "")

  be method_not_allowed(session: Session, id: RequestID) =>
    _error(session, id, StatusMethodNotAllowed, "Method not allowed")

  // A minimal GraphQL endpoint: answers the fields of graphql/schema.graphql.
  be graphql(session: Session, id: RequestID, body: ByteArrays) =>
    let query =
      match _parse(body)
      | let obj: JsonObject => _str(obj, "query")
      else
        _error(session, id, StatusBadRequest, "Expected a JSON body like {\\"query\\": \\"{ hello }\\"}")
        return
      end
    let data = JsonObject
    if query.contains("hello") then data.data("hello") = "Hello from {{projectName}} GraphQL!" end
    if query.contains("health") then data.data("health") = "healthy" end
    if data.data.size() == 0 then
      _error(session, id, StatusBadRequest, "Query { hello, health } is supported")
      return
    end
    let out = JsonObject
    out.data("data") = data
    _json(session, id, StatusOK, out)

  // Authentication

  be register(session: Session, id: RequestID, body: ByteArrays) =>
    let obj =
      match _parse(body)
      | let obj': JsonObject => obj'
      else
        _error(session, id, StatusBadRequest, "Invalid JSON body")
        return
      end
    let email = _str(obj, "email")
    let name = _str(obj, "name")
    let password = _str(obj, "password")
    if (email == "") or (name == "") or (password == "") then
      _error(session, id, StatusBadRequest, "Email, name and password are required")
      return
    end
    for existing in _users.values() do
      if existing.email == email then
        _error(session, id, StatusConflict, "Email already registered")
        return
      end
    end
    let salt = Password.salt()
    let user =
      User(
        _next_user,
        email,
        name,
        "user",
        Clock.iso8601(),
        salt,
        Password.hash(password, salt))
    _next_user = _next_user + 1
    _users.push(user)
    (let token, let expires_at) = Jwt.issue(_secret, user.id, Clock.now())
    let out = JsonObject
    out.data("token") = token
    out.data("expires_at") = expires_at
    out.data("user") = user.json()
    _json(session, id, StatusCreated, out)

  be login(session: Session, id: RequestID, body: ByteArrays) =>
    let obj =
      match _parse(body)
      | let obj': JsonObject => obj'
      else
        _error(session, id, StatusBadRequest, "Invalid JSON body")
        return
      end
    let email = _str(obj, "email")
    let password = _str(obj, "password")
    for user in _users.values() do
      if (user.email == email) and Password.verify(password, user.salt, user.password_hash) then
        (let token, let expires_at) = Jwt.issue(_secret, user.id, Clock.now())
        let out = JsonObject
        out.data("token") = token
        out.data("expires_at") = expires_at
        out.data("user") = user.json()
        _json(session, id, StatusOK, out)
        return
      end
    end
    _error(session, id, StatusUnauthorized, "Invalid credentials")

  be me(session: Session, id: RequestID, authorization: (String | None)) =>
    match _user_for(authorization)
    | let user: User => _json(session, id, StatusOK, user.json())
    else
      _error(session, id, StatusUnauthorized, "Authentication required")
    end

  // Products

  be list_products(session: Session, id: RequestID) =>
    let list = JsonArray(_products.size())
    for product in _products.values() do
      list.data.push(product.json())
    end
    let out = JsonObject
    out.data("products") = list
    out.data("count") = _products.size().i64()
    _json(session, id, StatusOK, out)

  be get_product(session: Session, id: RequestID, product_id: USize) =>
    for product in _products.values() do
      if product.id == product_id then
        _json(session, id, StatusOK, product.json())
        return
      end
    end
    _error(session, id, StatusNotFound, "Product not found")

  be create_product(
    session: Session,
    id: RequestID,
    authorization: (String | None),
    body: ByteArrays)
  =>
    if (_user_for(authorization) is None) then
      _error(session, id, StatusUnauthorized, "Authentication required")
      return
    end
    match _parse(body)
    | let obj: JsonObject =>
      let name = _str(obj, "name")
      if name == "" then
        _error(session, id, StatusBadRequest, "A JSON body with a name is required")
        return
      end
      let product = _add_product(name, _str(obj, "description"), _num(obj, "price"), _num(obj, "stock").i64())
      _json(session, id, StatusCreated, product.json())
    else
      _error(session, id, StatusBadRequest, "A JSON body with a name is required")
    end

  be update_product(
    session: Session,
    id: RequestID,
    authorization: (String | None),
    product_id: USize,
    body: ByteArrays)
  =>
    if (_user_for(authorization) is None) then
      _error(session, id, StatusUnauthorized, "Authentication required")
      return
    end
    let obj =
      match _parse(body)
      | let obj': JsonObject => obj'
      else
        _error(session, id, StatusBadRequest, "A JSON body with a name is required")
        return
      end
    let name = _str(obj, "name")
    if name == "" then
      _error(session, id, StatusBadRequest, "A JSON body with a name is required")
      return
    end
    var index: USize = 0
    while index < _products.size() do
      try
        if _products(index)?.id == product_id then
          let product =
            Product(
              product_id,
              name,
              _str(obj, "description"),
              _num(obj, "price"),
              _num(obj, "stock").i64())
          _products(index)? = product
          _json(session, id, StatusOK, product.json())
          return
        end
      end
      index = index + 1
    end
    _error(session, id, StatusNotFound, "Product not found")

  be delete_product(
    session: Session,
    id: RequestID,
    authorization: (String | None),
    product_id: USize)
  =>
    if (_user_for(authorization) is None) then
      _error(session, id, StatusUnauthorized, "Authentication required")
      return
    end
    var index: USize = 0
    while index < _products.size() do
      try
        if _products(index)?.id == product_id then
          _products.delete(index)?
          _send(session, id, StatusNoContent, "")
          return
        end
      end
      index = index + 1
    end
    _error(session, id, StatusNotFound, "Product not found")
`,

    'app/crypto.pony': `use "encode/base64"
use "json"
use "ssl/crypto"
use "time"
use "lib:crypto"

// OpenSSL entry points that the ssl package does not wrap (libcrypto is linked by "lib:crypto").
use @HMAC[Pointer[U8]](
  evp_md: Pointer[None] tag,
  key: Pointer[U8] tag,
  key_len: I32,
  data: Pointer[U8] tag,
  data_len: USize,
  md: Pointer[U8] tag,
  md_len: Pointer[U32] tag)
use @EVP_sha256[Pointer[None]]()
use @PKCS5_PBKDF2_HMAC[I32](
  pass: Pointer[U8] tag,
  pass_len: I32,
  salt: Pointer[U8] tag,
  salt_len: I32,
  iterations: I32,
  digest: Pointer[None] tag,
  key_len: I32,
  out: Pointer[U8] tag)
use @RAND_bytes[I32](buf: Pointer[U8] tag, num: I32)

primitive Hmac
  fun sha256(key: String, data: String): Array[U8] val =>
    """
    HMAC-SHA256 of \`data\` under \`key\`.
    """
    recover val
      let out = Array[U8].>undefined(32)
      @HMAC(
        @EVP_sha256(),
        key.cpointer(),
        key.size().i32(),
        data.cpointer(),
        data.size(),
        out.cpointer(),
        Pointer[U32])
      out
    end

primitive Password
  """
  Salted PBKDF2-HMAC-SHA256 password hashing (OpenSSL).
  """
  fun iterations(): I32 => 100_000

  fun salt(): Array[U8] val =>
    recover val
      let buf = Array[U8].>undefined(16)
      @RAND_bytes(buf.cpointer(), I32(16))
      buf
    end

  fun hash(password: String, salt': Array[U8] val): Array[U8] val =>
    recover val
      let out = Array[U8].>undefined(32)
      @PKCS5_PBKDF2_HMAC(
        password.cpointer(),
        password.size().i32(),
        salt'.cpointer(),
        salt'.size().i32(),
        iterations(),
        @EVP_sha256(),
        I32(32),
        out.cpointer())
      out
    end

  fun verify(password: String, salt': Array[U8] val, expected: Array[U8] val): Bool =>
    ConstantTimeCompare[Array[U8] box](hash(password, salt'), expected)

primitive Jwt
  """
  HS256 JSON Web Tokens carrying the user id in \`sub\`.
  """
  fun ttl_seconds(): I64 => 24 * 60 * 60

  fun _b64(data: ByteSeq box): String val =>
    """
    Unpadded base64url, as JWT requires. The padding is stripped here instead of asking
    \`Base64.encode_url\` for none, because some ponyc releases append a NUL byte then.
    """
    let encoded: String val = Base64.encode[String iso](data, '-', '_', '=')
    var size = encoded.size()
    while (size > 0) and (try encoded(size - 1)? == '=' else false end) do
      size = size - 1
    end
    encoded.substring(0, size.isize())

  fun issue(secret: String, user_id: USize, now: I64): (String val, I64) =>
    let expires_at = now + ttl_seconds()
    let header = _b64("{\\"alg\\":\\"HS256\\",\\"typ\\":\\"JWT\\"}")
    let payload =
      _b64(
        "".join(
          [ "{\\"sub\\":"; user_id.string(); ",\\"iat\\":"; now.string()
            ",\\"exp\\":"; expires_at.string(); "}"
          ].values()))
    let signing_input: String val = header + "." + payload
    (signing_input + "." + _b64(Hmac.sha256(secret, signing_input)), expires_at)

  fun verify(secret: String, token: String, now: I64): (USize | None) =>
    """
    The user id of a token with a valid signature that has not expired.
    """
    let parts = token.split(".")
    try
      if parts.size() != 3 then error end
      let signing_input: String val = parts(0)? + "." + parts(1)?
      let given = Base64.decode_url[Array[U8] iso](parts(2)?)?
      if not ConstantTimeCompare[Array[U8] box](consume given, Hmac.sha256(secret, signing_input)) then
        error
      end
      let claims = Base64.decode_url[String iso](parts(1)?)?
      let doc = JsonDoc
      doc.parse(consume claims)?
      let obj = doc.data as JsonObject
      let exp = _int(obj.data("exp")?)?
      if exp < now then error end
      USize.from[I64](_int(obj.data("sub")?)?)
    end

  fun _int(value: JsonType): I64 ? =>
    match value
    | let i: I64 => i
    | let f: F64 => f.i64()
    else
      error
    end

primitive Clock
  fun now(): I64 => Time.seconds()

  fun iso8601(): String =>
    try PosixDate(Time.seconds()).format("%Y-%m-%dT%H:%M:%SZ")? else "" end
`,

    'app/handlers.pony': `use "http_server"
use "jennet"

// Jennet handlers are immutable (\`val\`) objects that must return the context they were
// given. They hand the work to the Api actor, which answers through the request's
// session, so none of them calls ctx.respond.

class val HomeHandler is RequestHandler
  let _api: Api

  new val create(api: Api) => _api = api

  fun val apply(ctx: Context): Context iso^ =>
    _api.home(ctx.session, ctx.request_id)
    consume ctx

class val HealthHandler is RequestHandler
  let _api: Api

  new val create(api: Api) => _api = api

  fun val apply(ctx: Context): Context iso^ =>
    _api.health(ctx.session, ctx.request_id)
    consume ctx

class val PreflightHandler is RequestHandler
  let _api: Api

  new val create(api: Api) => _api = api

  fun val apply(ctx: Context): Context iso^ =>
    _api.preflight(ctx.session, ctx.request_id)
    consume ctx

class val MethodNotAllowedHandler is RequestHandler
  let _api: Api

  new val create(api: Api) => _api = api

  fun val apply(ctx: Context): Context iso^ =>
    _api.method_not_allowed(ctx.session, ctx.request_id)
    consume ctx

class val GraphQLHandler is RequestHandler
  let _api: Api

  new val create(api: Api) => _api = api

  fun val apply(ctx: Context): Context iso^ =>
    _api.graphql(ctx.session, ctx.request_id, ctx.body)
    consume ctx

class val RegisterHandler is RequestHandler
  let _api: Api

  new val create(api: Api) => _api = api

  fun val apply(ctx: Context): Context iso^ =>
    _api.register(ctx.session, ctx.request_id, ctx.body)
    consume ctx

class val LoginHandler is RequestHandler
  let _api: Api

  new val create(api: Api) => _api = api

  fun val apply(ctx: Context): Context iso^ =>
    _api.login(ctx.session, ctx.request_id, ctx.body)
    consume ctx

class val MeHandler is RequestHandler
  let _api: Api

  new val create(api: Api) => _api = api

  fun val apply(ctx: Context): Context iso^ =>
    _api.me(ctx.session, ctx.request_id, ctx.request.header("Authorization"))
    consume ctx

class val ListProductsHandler is RequestHandler
  let _api: Api

  new val create(api: Api) => _api = api

  fun val apply(ctx: Context): Context iso^ =>
    _api.list_products(ctx.session, ctx.request_id)
    consume ctx

class val GetProductHandler is RequestHandler
  let _api: Api

  new val create(api: Api) => _api = api

  fun val apply(ctx: Context): Context iso^ =>
    _api.get_product(ctx.session, ctx.request_id, _ProductId.from(ctx.param("id")))
    consume ctx

class val CreateProductHandler is RequestHandler
  let _api: Api

  new val create(api: Api) => _api = api

  fun val apply(ctx: Context): Context iso^ =>
    _api.create_product(
      ctx.session,
      ctx.request_id,
      ctx.request.header("Authorization"),
      ctx.body)
    consume ctx

class val UpdateProductHandler is RequestHandler
  let _api: Api

  new val create(api: Api) => _api = api

  fun val apply(ctx: Context): Context iso^ =>
    _api.update_product(
      ctx.session,
      ctx.request_id,
      ctx.request.header("Authorization"),
      _ProductId.from(ctx.param("id")),
      ctx.body)
    consume ctx

class val DeleteProductHandler is RequestHandler
  let _api: Api

  new val create(api: Api) => _api = api

  fun val apply(ctx: Context): Context iso^ =>
    _api.delete_product(
      ctx.session,
      ctx.request_id,
      ctx.request.header("Authorization"),
      _ProductId.from(ctx.param("id")))
    consume ctx

primitive _ProductId
  fun from(raw: String): USize =>
    """
    The numeric id in a \`/products/:id\` path; 0 (which matches no product) when it is not a number.
    """
    try raw.usize()? else 0 end
`,

    'app/models.pony': `use "json"

class val User
  let id: USize
  let email: String
  let name: String
  let role: String
  let created_at: String
  let salt: Array[U8] val
  let password_hash: Array[U8] val

  new val create(
    id': USize,
    email': String,
    name': String,
    role': String,
    created_at': String,
    salt': Array[U8] val,
    password_hash': Array[U8] val)
  =>
    id = id'
    email = email'
    name = name'
    role = role'
    created_at = created_at'
    salt = salt'
    password_hash = password_hash'

  fun json(): JsonObject =>
    """
    The public representation of a user (never the credentials).
    """
    let obj = JsonObject
    obj.data("id") = id.i64()
    obj.data("email") = email
    obj.data("name") = name
    obj.data("role") = role
    obj.data("created_at") = created_at
    obj

class val Product
  let id: USize
  let name: String
  let description: String
  let price: F64
  let stock: I64

  new val create(id': USize, name': String, description': String, price': F64, stock': I64) =>
    id = id'
    name = name'
    description = description'
    price = price'
    stock = stock'

  fun json(): JsonObject =>
    let obj = JsonObject
    obj.data("id") = id.i64()
    obj.data("name") = name
    obj.data("description") = description
    obj.data("price") = price
    obj.data("stock") = stock
    obj
`,

    'corral.json': `{
  "packages": ["app"],
  "deps": [
    {
      "locator": "github.com/theodus/jennet.git",
      "version": "eb0e8be61b824b2eeda802990021141de37b1024"
    },
    {
      "locator": "github.com/ponylang/http-server.git",
      "version": "0.6.3"
    },
    {
      "locator": "github.com/ponylang/ssl.git",
      "version": "1.0.0"
    },
    {
      "locator": "github.com/ponylang/json.git",
      "version": "0.1.0"
    },
    {
      "locator": "github.com/ponylang/valbytes.git",
      "version": "0.6.2"
    }
  ],
  "info": {
    "name": "{{projectName}}",
    "description": "A web service built with Pony and Jennet",
    "version": "1.0.0",
    "license": "MIT"
  }
}
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

    'main.pony': `use "net"
use "http_server"
use "jennet"
use "app"

actor Main
  new create(env: Env) =>
    let port = _Env.get(env, "PORT", "8080")
    let configured_secret = _Env.get(env, "JWT_SECRET", "")
    let secret =
      if configured_secret == "" then
        env.err.print("warning: JWT_SECRET is not set, using an insecure development secret")
        "change-me-in-production"
      else
        configured_secret
      end

    let api = Api(secret)

    // Jennet matches a request against exactly one route, there is no precedence between routes.
    let server =
      Jennet(TCPListenAuth(env.root), env.out)
        .> get("/", HomeHandler(api))
        .> get("/api/v1/health", HealthHandler(api))
        .> post("/graphql", GraphQLHandler(api))
        .> post("/api/v1/auth/register", RegisterHandler(api))
        .> post("/api/v1/auth/login", LoginHandler(api))
        .> get("/api/v1/auth/me", MeHandler(api))
        .> get("/api/v1/products", ListProductsHandler(api))
        .> post("/api/v1/products", CreateProductHandler(api))
        .> get("/api/v1/products/:id", GetProductHandler(api))
        // Jennet's router does not match a parameter route when it is the only route of
        // its method, so PUT and DELETE first get a static route (answering 405) to
        // build the tree around.
        .> put("/api/v1/products", MethodNotAllowedHandler(api))
        .> put("/api/v1/products/:id", UpdateProductHandler(api))
        .> delete("/api/v1/products", MethodNotAllowedHandler(api))
        .> delete("/api/v1/products/:id", DeleteProductHandler(api))
        // CORS preflight requests
        .> options("/graphql", PreflightHandler(api))
        .> options("/api/v1/auth/register", PreflightHandler(api))
        .> options("/api/v1/auth/login", PreflightHandler(api))
        .> options("/api/v1/auth/me", PreflightHandler(api))
        .> options("/api/v1/products", PreflightHandler(api))
        .> options("/api/v1/products/:id", PreflightHandler(api))
        .serve(ServerConfig(where host' = "0.0.0.0", port' = port))

    if server is None then
      env.err.print("bad routes!")
    else
      env.out.print("{{projectName}} listening on http://localhost:" + port)
    end

primitive _Env
  fun get(env: Env, name: String, default: String): String =>
    """
    The value of an environment variable, or \`default\` when it is not set.
    """
    let prefix: String val = name + "="
    for entry in env.vars.values() do
      if entry.at(prefix) then
        return entry.substring(prefix.size().isize())
      end
    end
    default
`,

    'test/main.pony': `use "http_server"
use "json"
use "pony_test"
use "ssl/crypto"
use "valbytes"
use "../app"

actor Main is TestList
  new create(env: Env) => PonyTest(env, this)

  fun tag tests(test: PonyTest) =>
    test(_TestHmac)
    test(_TestJwt)
    test(_TestPassword)
    test(_TestApi)

class iso _TestHmac is UnitTest
  fun name(): String => "hmac-sha256"

  fun apply(h: TestHelper) =>
    // RFC 4231, test case 2
    h.assert_eq[String](
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
      ToHexString(Hmac.sha256("Jefe", "what do ya want for nothing?")))

class iso _TestJwt is UnitTest
  fun name(): String => "jwt"

  fun apply(h: TestHelper) =>
    (let token, let expires_at) = Jwt.issue("secret", 42, 1_000)
    h.assert_eq[I64](1_000 + Jwt.ttl_seconds(), expires_at)

    match Jwt.verify("secret", token, 2_000)
    | let user_id: USize => h.assert_eq[USize](42, user_id)
    else
      h.fail("a fresh token must verify")
    end

    h.assert_true(Jwt.verify("another secret", token, 2_000) is None, "wrong secret")
    h.assert_true(
      Jwt.verify("secret", token, 1_000 + Jwt.ttl_seconds() + 1) is None, "expired token")
    h.assert_true(Jwt.verify("secret", "not.a.token", 2_000) is None, "garbage")
    h.assert_true(Jwt.verify("secret", "garbage", 2_000) is None, "garbage without dots")

class iso _TestPassword is UnitTest
  fun name(): String => "password-hashing"

  fun apply(h: TestHelper) =>
    let salt = Password.salt()
    let hash = Password.hash("correct horse", salt)
    h.assert_eq[USize](32, hash.size())
    h.assert_true(Password.verify("correct horse", salt, hash))
    h.assert_false(Password.verify("battery staple", salt, hash))
    h.assert_false(Password.verify("correct horse", Password.salt(), hash), "another salt")

class iso _TestApi is UnitTest
  """
  Drives the Api actor through a fake session: register, log in, call protected
  endpoints and use the products API, checking every response.
  """
  fun name(): String => "api"

  fun apply(h: TestHelper) =>
    h.long_test(20_000_000_000)
    let api = Api("test-secret")
    let session = _Scripted(h, api)
    session.start()

actor _Scripted is Session
  let _h: TestHelper
  let _api: Api
  var _step: USize = 0
  var _token: String = ""

  new create(h: TestHelper, api: Api) =>
    _h = h
    _api = api

  be start() =>
    _api.register(this, 0, _body("{\\"email\\":\\"a@example.com\\",\\"name\\":\\"A\\",\\"password\\":\\"pw\\"}"))

  fun _body(json: String): ByteArrays => ByteArrays(json.array())

  fun _bearer(): (String | None) => "Bearer " + _token

  fun _check(status: U16, expected: U16, body: String): Bool =>
    if status != expected then
      _h.fail("step " + _step.string() + ": expected status " + expected.string() + " but got " + status.string() + ": " + body)
      _h.complete(false)
      return false
    end
    true

  be send(response: Response val, body: ByteArrays, request_id: RequestID) =>
    let status = response.status()()
    let text = body.string()
    let step = _step
    _step = _step + 1
    match step
    | 0 =>
      if _check(status, 201, text) then
        _h.assert_true(text.contains("\\"email\\":\\"a@example.com\\""))
        _h.assert_false(text.contains("password"))
        _api.register(this, 1, _body("{\\"email\\":\\"a@example.com\\",\\"name\\":\\"Again\\",\\"password\\":\\"pw\\"}"))
      end
    | 1 =>
      if _check(status, 409, text) then
        _api.login(this, 2, _body("{\\"email\\":\\"a@example.com\\",\\"password\\":\\"wrong\\"}"))
      end
    | 2 =>
      if _check(status, 401, text) then
        _api.login(this, 3, _body("{\\"email\\":\\"a@example.com\\",\\"password\\":\\"pw\\"}"))
      end
    | 3 =>
      if _check(status, 200, text) then
        let doc = JsonDoc
        try
          doc.parse(text)?
          _token = ((doc.data as JsonObject).data("token")? as String)
        else
          _h.fail("the login response has no token: " + text)
          _h.complete(false)
          return
        end
        _api.me(this, 4, _bearer())
      end
    | 4 =>
      if _check(status, 200, text) then
        _h.assert_true(text.contains("\\"name\\":\\"A\\""))
        _api.me(this, 5, None)
      end
    | 5 =>
      if _check(status, 401, text) then
        _api.list_products(this, 6)
      end
    | 6 =>
      if _check(status, 200, text) then
        _h.assert_true(text.contains("\\"count\\":2"))
        _api.create_product(this, 7, None, _body("{\\"name\\":\\"Widget\\"}"))
      end
    | 7 =>
      if _check(status, 401, text) then
        _api.create_product(
          this, 8, _bearer(), _body("{\\"name\\":\\"Widget\\",\\"description\\":\\"A widget\\",\\"price\\":9.5,\\"stock\\":3}"))
      end
    | 8 =>
      if _check(status, 201, text) then
        _h.assert_true(text.contains("\\"id\\":3"))
        _api.update_product(this, 9, _bearer(), 3, _body("{\\"name\\":\\"Gadget\\",\\"price\\":12}"))
      end
    | 9 =>
      if _check(status, 200, text) then
        _api.get_product(this, 10, 3)
      end
    | 10 =>
      if _check(status, 200, text) then
        _h.assert_true(text.contains("\\"name\\":\\"Gadget\\""))
        _api.delete_product(this, 11, _bearer(), 3)
      end
    | 11 =>
      if _check(status, 204, text) then
        _api.get_product(this, 12, 3)
      end
    | 12 =>
      if _check(status, 404, text) then
        _api.graphql(this, 13, _body("{\\"query\\":\\"{ hello health }\\"}"))
      end
    | 13 =>
      if _check(status, 200, text) then
        _h.assert_true(text.contains("\\"health\\":\\"healthy\\""))
        _h.complete(true)
      end
    else
      _h.fail("unexpected response")
      _h.complete(false)
    end
`
  }
};
