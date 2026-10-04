import { BackendTemplate } from '../types';

export const kemalTemplate: BackendTemplate = {
  id: 'kemal',
  name: 'Kemal',
  description: 'Crystal web framework with Sinatra-like simplicity and performance',
  version: '1.0.0',
  framework: 'kemal',
  displayName: 'Kemal (Crystal)',
  language: 'crystal',
  port: 3000,
  tags: ['crystal', 'kemal', 'web', 'api', 'rest', 'fast'],
  features: ['routing', 'middleware', 'rest-api', 'logging', 'cors', 'validation', 'authentication', 'testing', 'docker'],
  dependencies: {},
  devDependencies: {},
  files: {
    '.env.example': `# Copy to .env and export before running (the app reads the process environment)
PORT=3000
HOST=0.0.0.0
KEMAL_ENV=development
# Required when KEMAL_ENV=production, for example the output of: openssl rand -hex 32
JWT_SECRET=
`,

    '.gitignore': `/lib/
/bin/
/.shards/
*.dwarf

.env
.env.local

.idea/
.vscode/
.DS_Store
*.log
`,

    'docker-compose.yml': `services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      PORT: "3000"
      # Required: the image runs with KEMAL_ENV=production, which refuses the development secret.
      JWT_SECRET: \${JWT_SECRET:?set JWT_SECRET to a long random string}
    restart: unless-stopped
`,

    'Dockerfile': `# Build stage
FROM crystallang/crystal:1.21.1-alpine AS builder

WORKDIR /app

# shard.lock is written by the first \`shards install\`; commit it to pin the versions.
# Without one, the newest versions shard.yml allows are installed.
COPY shard.yml shard.lock* ./
RUN if [ -f shard.lock ]; then shards install --production; else shards install --without-development; fi

COPY src ./src
RUN shards build --production --release --static --no-debug

# Runtime stage: the binary is statically linked
FROM alpine:3.21

RUN adduser -D -g '' appuser
USER appuser

WORKDIR /app
COPY --from=builder /app/bin/{{projectName}} ./{{projectName}}

ENV KEMAL_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \\
  CMD wget -q -O /dev/null http://localhost:3000/health || exit 1

CMD ["./{{projectName}}"]
`,

    'Makefile': `# {{projectName}} Makefile

.PHONY: all deps build release run test lint clean

all: build

deps:
	shards install

build: deps
	shards build

release: deps
	shards build --release

run: deps
	crystal run src/server.cr

test: deps
	crystal spec

lint: deps
	crystal run lib/ameba/bin/ameba.cr -- src spec

clean:
	rm -rf bin/ lib/
`,

    'README.md': `# {{projectName}}

{{description}}

A Crystal JSON API built with [Kemal](https://kemalcr.com): JWT authentication, a small
items resource, and specs written with spec-kemal.

## Requirements

- Crystal >= 1.19 and \`shards\` (the ameba development dependency needs 1.19)

## Getting started

\`\`\`bash
shards install
crystal run src/server.cr      # http://localhost:3000
\`\`\`

Configuration comes from environment variables (see \`.env.example\`): \`PORT\`, \`HOST\`,
\`KEMAL_ENV\` and \`JWT_SECRET\`. With \`KEMAL_ENV=production\` the server refuses to start
until \`JWT_SECRET\` is set (other environments fall back to a development secret).

## Development

\`\`\`bash
make build      # shards build -> bin/{{projectName}}
make test       # crystal spec
make lint       # ameba
\`\`\`

## Layout

- \`src/server.cr\` starts the server
- \`src/app.cr\` routes and filters
- \`src/models.cr\` request/response types
- \`src/store.cr\` in-memory storage (swap in a database for real use)
- \`src/token.cr\` JWT issue/verify
- \`spec/\` specs

## API

Public:

- \`GET /\` and \`GET /health\`
- \`POST /api/auth/register\` with \`{"email", "name", "password"}\`
- \`POST /api/auth/login\` with \`{"email", "password"}\`, returns \`{"token", "expires_at"}\`

Send \`Authorization: Bearer <token>\` to:

- \`GET /api/users/me\`, \`GET /api/users\`, \`GET /api/users/:id\`
- \`GET /api/items\`, \`POST /api/items\`, \`GET /api/items/:id\`, \`DELETE /api/items/:id\`

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 3000:3000 -e JWT_SECRET="$(openssl rand -hex 32)" {{projectName}}
\`\`\`

The image runs with \`KEMAL_ENV=production\`. For \`docker compose up\`, put
\`JWT_SECRET=<output of openssl rand -hex 32>\` in \`.env\` next to \`docker-compose.yml\`
(Compose reads it automatically; \`.gitignore\` already excludes it).

## License

MIT
`,

    'shard.yml': `name: {{projectName}}
version: 0.1.0

description: |
  {{description}}

targets:
  {{projectName}}:
    main: src/server.cr

crystal: ">= 1.19.0"

license: MIT

dependencies:
  kemal:
    github: kemalcr/kemal
    version: ~> 1.14.0

  jwt:
    github: crystal-community/jwt
    version: ~> 1.7.0

development_dependencies:
  spec-kemal:
    github: kemalcr/spec-kemal
    version: ~> 1.3.0

  ameba:
    github: crystal-ameba/ameba
    version: ~> 1.7.0
`,

    'spec/app_spec.cr': `require "./spec_helper"

describe "{{projectName}}" do
  it "describes the API at /" do
    get "/"
    response.status_code.should eq 200
    JSON.parse(response.body)["framework"].should eq "Kemal"
  end

  it "reports health" do
    get "/health"
    response.status_code.should eq 200
    JSON.parse(response.body)["status"].should eq "healthy"
  end

  it "answers unknown paths with a JSON 404" do
    get "/nope"
    response.status_code.should eq 404
    JSON.parse(response.body)["error"].should eq "not_found"
  end

  it "answers an unsupported method with a JSON 405" do
    put "/api/items/1"
    response.status_code.should eq 405
    JSON.parse(response.body)["error"].should eq "method_not_allowed"
  end

  it "answers CORS preflight requests" do
    options "/api/items", headers: HTTP::Headers{"Origin" => "http://localhost:5173", "Access-Control-Request-Method" => "POST"}
    response.status_code.should eq 204
    response.headers["Access-Control-Allow-Origin"].should eq "*"
  end

  describe "Token.configuration_error" do
    it "refuses the development secret only in production" do
      previous = ENV["JWT_SECRET"]?
      begin
        ENV.delete("JWT_SECRET")
        Token.configuration_error.should be_nil

        Kemal.config.env = "production"
        Token.configuration_error.should_not be_nil

        ENV["JWT_SECRET"] = "a-long-random-production-secret"
        Token.configuration_error.should be_nil
      ensure
        Kemal.config.env = "test"
        previous ? (ENV["JWT_SECRET"] = previous) : ENV.delete("JWT_SECRET")
      end
    end
  end

  describe "POST /api/auth/register" do
    it "creates a user without exposing the password" do
      post "/api/auth/register",
        headers: JSON_HEADERS,
        body: {email: "a@example.com", name: "A", password: "secret"}.to_json
      response.status_code.should eq 201
      json = JSON.parse(response.body)
      json["email"].should eq "a@example.com"
      json["password"]?.should be_nil
    end

    it "rejects a duplicate email" do
      body = {email: "a@example.com", name: "A", password: "secret"}.to_json
      post "/api/auth/register", headers: JSON_HEADERS, body: body
      post "/api/auth/register", headers: JSON_HEADERS, body: body
      response.status_code.should eq 409
    end

    it "rejects a malformed body" do
      post "/api/auth/register", headers: JSON_HEADERS, body: "not json"
      response.status_code.should eq 400
    end
  end

  describe "POST /api/auth/login" do
    it "returns a token for valid credentials" do
      token = register_and_login
      token.should_not be_empty
    end

    it "rejects a wrong password" do
      register_and_login
      post "/api/auth/login",
        headers: JSON_HEADERS,
        body: {email: "user@example.com", password: "wrong"}.to_json
      response.status_code.should eq 401
    end
  end

  describe "protected routes" do
    it "require a token" do
      get "/api/users/me"
      response.status_code.should eq 401
    end

    it "reject an invalid token" do
      get "/api/users/me", headers: auth_headers("garbage")
      response.status_code.should eq 401
    end

    it "return the current user" do
      token = register_and_login
      get "/api/users/me", headers: auth_headers(token)
      response.status_code.should eq 200
      JSON.parse(response.body)["email"].should eq "user@example.com"
    end
  end

  describe "items" do
    it "creates, lists, shows and deletes an item" do
      token = register_and_login

      post "/api/items", headers: auth_headers(token), body: {name: "Widget", description: "A widget"}.to_json
      response.status_code.should eq 201
      id = JSON.parse(response.body)["id"].as_i

      get "/api/items", headers: auth_headers(token)
      JSON.parse(response.body).as_a.size.should eq 1

      get "/api/items/#{id}", headers: auth_headers(token)
      response.status_code.should eq 200

      delete "/api/items/#{id}", headers: auth_headers(token)
      response.status_code.should eq 204

      get "/api/items/#{id}", headers: auth_headers(token)
      response.status_code.should eq 404
    end

    it "keeps items private to their owner" do
      owner = register_and_login("owner@example.com")
      other = register_and_login("other@example.com")

      post "/api/items", headers: auth_headers(owner), body: {name: "Mine"}.to_json
      id = JSON.parse(response.body)["id"].as_i

      get "/api/items/#{id}", headers: auth_headers(other)
      response.status_code.should eq 404
    end
  end
end
`,

    'spec/spec_helper.cr': `require "spec"
require "spec-kemal"
require "../src/app"

Spec.before_each do
  Kemal.config.env = "test"
  Kemal.config.setup
  Store.reset
end

JSON_HEADERS = HTTP::Headers{"Content-Type" => "application/json"}

def auth_headers(token : String) : HTTP::Headers
  HTTP::Headers{"Content-Type" => "application/json", "Authorization" => "Bearer #{token}"}
end

# Registers a user, logs in and returns the bearer token.
def register_and_login(email = "user@example.com", password = "password123") : String
  post "/api/auth/register",
    headers: JSON_HEADERS,
    body: {email: email, name: "Test User", password: password}.to_json
  post "/api/auth/login",
    headers: JSON_HEADERS,
    body: {email: email, password: password}.to_json
  JSON.parse(response.body)["token"].as_s
end
`,

    'src/app.cr': `require "kemal"
require "json"
require "./models"
require "./store"
require "./token"

# Every response is JSON and every origin may call the API (tighten this for production).
before_all do |env|
  env.response.content_type = "application/json"
  env.response.headers["Access-Control-Allow-Origin"] = "*"
  env.response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
  env.response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"

  # Answer CORS preflight requests without needing a route per path.
  halt env, status_code: 204 if env.request.method == "OPTIONS"
end

error 404 do
  ErrorResponse.new("not_found", "Resource not found").to_json
end

error 405 do
  ErrorResponse.new("method_not_allowed", "Method not allowed").to_json
end

error 500 do
  ErrorResponse.new("internal_error", "An internal error occurred").to_json
end

# Writes a JSON error and ends the response; routes then leave with \`next\`.
def respond_error(env : HTTP::Server::Context, status : Int32, error : String, message : String) : Nil
  env.response.status_code = status
  env.response.print ErrorResponse.new(error, message).to_json
  env.response.close
end

# The user behind the bearer token, or nil after answering 401. Use as:
#   user = authenticate(env) || next
def authenticate(env : HTTP::Server::Context) : User?
  header = env.request.headers["Authorization"]?
  unless header && header.starts_with?("Bearer ")
    respond_error(env, 401, "unauthorized", "Missing bearer token")
    return
  end

  user_id = Token.verify(header.lchop("Bearer "))
  user = Store.find_user(user_id) if user_id
  respond_error(env, 401, "unauthorized", "Invalid or expired token") unless user
  user
end

get "/" do
  {
    name:      "{{projectName}}",
    framework: "Kemal",
    language:  "Crystal",
    version:   "0.1.0",
  }.to_json
end

get "/health" do
  {status: "healthy", timestamp: Time.utc.to_rfc3339}.to_json
end

post "/api/auth/register" do |env|
  begin
    body = CreateUserRequest.from_json(env.request.body.try(&.gets_to_end) || "")
  rescue JSON::Error
    respond_error(env, 400, "bad_request", "Body must be JSON with email, name and password")
    next
  end

  if body.email.empty? || body.name.empty? || body.password.empty?
    respond_error(env, 422, "validation_error", "Email, name and password are required")
    next
  end

  if Store.find_user_by_email(body.email)
    respond_error(env, 409, "conflict", "A user with this email already exists")
    next
  end

  user = Store.create_user(body.email, body.name, body.password)
  env.response.status_code = 201
  user.to_json
end

post "/api/auth/login" do |env|
  begin
    body = LoginRequest.from_json(env.request.body.try(&.gets_to_end) || "")
  rescue JSON::Error
    respond_error(env, 400, "bad_request", "Body must be JSON with email and password")
    next
  end

  user = Store.find_user_by_email(body.email)
  unless user && Store.verify_password(user.id, body.password)
    respond_error(env, 401, "unauthorized", "Invalid email or password")
    next
  end

  Token.issue(user.id).to_json
end

get "/api/users/me" do |env|
  current_user = authenticate(env) || next
  current_user.to_json
end

get "/api/users" do |env|
  authenticate(env) || next
  Store.users.to_json
end

get "/api/users/:id" do |env|
  authenticate(env) || next
  id = env.params.url["id"].to_i32?
  unless id
    respond_error(env, 400, "bad_request", "id must be an integer")
    next
  end

  if user = Store.find_user(id)
    user.to_json
  else
    respond_error(env, 404, "not_found", "User not found")
    next
  end
end

get "/api/items" do |env|
  current_user = authenticate(env) || next
  Store.items_for(current_user.id).to_json
end

post "/api/items" do |env|
  current_user = authenticate(env) || next
  begin
    body = CreateItemRequest.from_json(env.request.body.try(&.gets_to_end) || "")
  rescue JSON::Error
    respond_error(env, 400, "bad_request", "Body must be JSON with a name and an optional description")
    next
  end

  if body.name.empty?
    respond_error(env, 422, "validation_error", "Name is required")
    next
  end

  item = Store.create_item(body.name, body.description, current_user.id)
  env.response.status_code = 201
  item.to_json
end

get "/api/items/:id" do |env|
  current_user = authenticate(env) || next
  id = env.params.url["id"].to_i32?
  unless id
    respond_error(env, 400, "bad_request", "id must be an integer")
    next
  end

  if item = Store.find_item(id, current_user.id)
    item.to_json
  else
    respond_error(env, 404, "not_found", "Item not found")
    next
  end
end

delete "/api/items/:id" do |env|
  current_user = authenticate(env) || next
  id = env.params.url["id"].to_i32?
  unless id
    respond_error(env, 400, "bad_request", "id must be an integer")
    next
  end

  if Store.delete_item(id, current_user.id)
    env.response.status_code = 204
    ""
  else
    respond_error(env, 404, "not_found", "Item not found")
    next
  end
end
`,

    'src/models.cr': `require "json"

struct User
  include JSON::Serializable

  property id : Int32
  property email : String
  property name : String
  property created_at : Time

  def initialize(@id, @email, @name, @created_at = Time.utc)
  end
end

struct Item
  include JSON::Serializable

  property id : Int32
  property name : String
  property description : String
  property user_id : Int32
  property created_at : Time

  def initialize(@id, @name, @description, @user_id, @created_at = Time.utc)
  end
end

struct CreateUserRequest
  include JSON::Serializable

  property email : String
  property name : String
  property password : String
end

struct LoginRequest
  include JSON::Serializable

  property email : String
  property password : String
end

struct CreateItemRequest
  include JSON::Serializable

  property name : String
  property description : String = ""
end

struct TokenResponse
  include JSON::Serializable

  property token : String
  property expires_at : Int64

  def initialize(@token, @expires_at)
  end
end

struct ErrorResponse
  include JSON::Serializable

  property error : String
  property message : String

  def initialize(@error, @message)
  end
end
`,

    'src/server.cr': `require "./app"

if error = Token.configuration_error
  abort error
end

port = ENV.fetch("PORT", "3000").to_i
Kemal.config.host_binding = ENV.fetch("HOST", "0.0.0.0")

puts "{{projectName}} listening on http://localhost:#{port}"
Kemal.run(port)
`,

    'src/store.cr': `require "crypto/bcrypt/password"
require "./models"

# In-memory storage. Replace it with a real database (for example the
# crystal-pg or crystal-sqlite3 shards) before storing anything you care about.
module Store
  @@users = [] of User
  @@password_hashes = {} of Int32 => String
  @@items = [] of Item
  @@user_seq = 0
  @@item_seq = 0

  def self.reset : Nil
    @@users.clear
    @@password_hashes.clear
    @@items.clear
    @@user_seq = 0
    @@item_seq = 0
  end

  def self.users : Array(User)
    @@users
  end

  def self.create_user(email : String, name : String, password : String) : User
    @@user_seq += 1
    user = User.new(@@user_seq, email, name)
    @@users << user
    @@password_hashes[user.id] = Crypto::Bcrypt::Password.create(password, cost: 10).to_s
    user
  end

  def self.find_user_by_email(email : String) : User?
    @@users.find { |user| user.email == email }
  end

  def self.find_user(id : Int32) : User?
    @@users.find { |user| user.id == id }
  end

  def self.verify_password(user_id : Int32, password : String) : Bool
    return false unless hash = @@password_hashes[user_id]?
    Crypto::Bcrypt::Password.new(hash).verify(password)
  end

  def self.items_for(user_id : Int32) : Array(Item)
    @@items.select { |item| item.user_id == user_id }
  end

  def self.find_item(id : Int32, user_id : Int32) : Item?
    @@items.find { |item| item.id == id && item.user_id == user_id }
  end

  def self.create_item(name : String, description : String, user_id : Int32) : Item
    @@item_seq += 1
    item = Item.new(@@item_seq, name, description, user_id)
    @@items << item
    item
  end

  def self.delete_item(id : Int32, user_id : Int32) : Bool
    index = @@items.index { |item| item.id == id && item.user_id == user_id }
    return false unless index
    @@items.delete_at(index)
    true
  end
end
`,

    'src/token.cr': `require "kemal"
require "jwt"
require "./models"

# Issues and verifies HS256 JSON Web Tokens.
module Token
  ALGORITHM = JWT::Algorithm::HS256
  TTL       = 24.hours

  # Used when JWT_SECRET is unset; refused when KEMAL_ENV=production.
  DEVELOPMENT_SECRET = "development-secret-do-not-use-in-production"

  def self.secret : String
    ENV["JWT_SECRET"]?.presence || DEVELOPMENT_SECRET
  end

  # Why the server must not start, or nil when the configuration is usable.
  def self.configuration_error : String?
    if Kemal.config.env == "production" && secret == DEVELOPMENT_SECRET
      "JWT_SECRET must be set when KEMAL_ENV=production (for example: openssl rand -hex 32)"
    end
  end

  def self.issue(user_id : Int32) : TokenResponse
    now = Time.utc
    expires_at = now + TTL
    payload = {
      "user_id" => user_id.to_i64,
      "iat"     => now.to_unix,
      "exp"     => expires_at.to_unix,
    }
    TokenResponse.new(JWT.encode(payload, secret, ALGORITHM), expires_at.to_unix)
  end

  # Returns the user id carried by a valid, unexpired token, or nil.
  def self.verify(token : String) : Int32?
    payload, _header = JWT.decode(token, secret, ALGORITHM)
    payload["user_id"]?.try(&.as_i64?).try(&.to_i32)
  rescue JWT::Error
    nil
  end
end
`,
  },
  prompts: [
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: 'my-kemal-app'},
    {
      type: 'input',
      name: 'description',
      message: 'Project description:',
      default: 'A Crystal web application built with Kemal'},
    {
      type: 'input',
      name: 'author',
      message: 'Author:',
      default: 'Developer'}],
  postInstall: [
    'shards install',
    'echo "{{projectName}} is ready!"',
    'echo "Run: crystal run src/server.cr"']};
