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
  features: ['routing', 'middleware', 'rest-api', 'logging', 'cors', 'validation'],
  dependencies: {},
  devDependencies: {},
  files: {
    'shard.yml': `name: {{projectName}}
version: 0.1.0

authors:
  - {{author}}

description: {{description}}

targets:
  {{projectName}}:
    main: src/{{projectName}}.cr

crystal: ">= 1.10.0"

license: MIT

dependencies:
  kemal:
    github: kemalcr/kemal
    version: ~> 1.3.0

  jennifer:
    github: imdrasil/jennifer.cr
    version: ~> 0.13.0

  sam:
    github: imdrasil/sam.cr
    version: ~> 0.4.2

  jwt:
    github: crystal-community/jwt
    version: ~> 1.6.0

  dotenv:
    github: drum445/dotenv
    version: ~> 1.0.0

development_dependencies:
  spec-kemal:
    github: kemalcr/spec-kemal
    version: ~> 1.0.0

  ameba:
    github: crystal-ameba/ameba
    version: ~> 1.5.0
`,

    'src/{{projectName}}.cr': `require "kemal"
require "json"
require "authentication"
require "dotenv"

# Load environment variables
Dotenv.load

# Configuration
JWT_SECRET = ENV.fetch("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = JWT::Algorithm::HS256

# Models
struct User
  include JSON::Serializable

  property id : Int32
  property email : String
  property name : String
  property created_at : Time

  def initialize(@id, @email, @name, @created_at = Time.utc)
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

# In-memory storage (replace with database in production)
class Database
  class_property users = [] of User
  class_property passwords = {} of Int32 => String
  class_property user_id_counter = 0

  def self.create_user(email : String, name : String, password : String) : User
    @@user_id_counter += 1
    user = User.new(@@user_id_counter, email, name)
    @@users << user
    @@passwords[user.id] = password
    user
  end

  def self.find_user_by_email(email : String) : User?
    @@users.find { |u| u.email == email }
  end

  def self.find_user_by_id(id : Int32) : User?
    @@users.find { |u| u.id == id }
  end

  def self.verify_password(user_id : Int32, password : String) : Bool
    @@passwords[user_id]? == password
  end
end

# JWT Helper
module JWTHelper
  extend self

  def generate_token(user_id : Int32) : TokenResponse
    expires_at = Time.utc + 24.hours
    payload = {
      "user_id" => user_id,
      "exp"     => expires_at.to_unix,
      "iat"     => Time.utc.to_unix}
    token = JWT.encode(payload, JWT_SECRET, JWT_ALGORITHM)
    TokenResponse.new(token, expires_at.to_unix)
  end

  def decode_token(token : String) : Hash(String, Int64)?
    payload, _ = JWT.decode(token, JWT_SECRET, JWT_ALGORITHM)
    payload.as_h.transform_values(&.as_i64)
  rescue
    nil
  end

  def get_user_id(token : String) : Int32?
    if payload = decode_token(token)
      payload["user_id"]?.try(&.to_i32)
    end
  end
end

# Middleware for JSON responses
before_all do |env|
  env.response.content_type = "application/json"
end

# CORS middleware
before_all do |env|
  env.response.headers["Access-Control-Allow-Origin"] = "*"
  env.response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
  env.response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
end

options "/*" do |env|
  env.response.status_code = 204
end

# Authentication middleware
macro auth_required
  token = env.request.headers["Authorization"]?.try(&.gsub("Bearer ", ""))
  unless token
    halt env, status_code: 401, response: ErrorResponse.new("unauthorized", "Missing authorization token").to_json
  end

  user_id = JWTHelper.get_user_id(token)
  unless user_id
    halt env, status_code: 401, response: ErrorResponse.new("unauthorized", "Invalid or expired token").to_json
  end

  current_user = Database.find_user_by_id(user_id)
  unless current_user
    halt env, status_code: 401, response: ErrorResponse.new("unauthorized", "User not found").to_json
  end
end

# Error handling
error 404 do |env|
  env.response.content_type = "application/json"
  ErrorResponse.new("not_found", "Resource not found").to_json
end

error 500 do |env|
  env.response.content_type = "application/json"
  ErrorResponse.new("internal_error", "An internal error occurred").to_json
end

# Routes

# Health check
get "/health" do
  { status: "healthy", timestamp: Time.utc.to_s }.to_json
end

# API info
get "/" do
  {
    name:        "{{projectName}}",
    version:     "1.0.0",
    framework:   "Kemal",
    language:    "Crystal",
    description: "{{description}}"}.to_json
end

# Authentication endpoints
post "/api/auth/register" do |env|
  begin
    body = CreateUserRequest.from_json(env.request.body.not_nil!)

    # Validate
    if body.email.empty? || body.name.empty? || body.password.empty?
      halt env, status_code: 400, response: ErrorResponse.new("validation_error", "Email, name and password are required").to_json
    end

    if Database.find_user_by_email(body.email)
      halt env, status_code: 409, response: ErrorResponse.new("conflict", "User with this email already exists").to_json
    end

    user = Database.create_user(body.email, body.name, body.password)
    env.response.status_code = 201
    user.to_json
  rescue ex : JSON::ParseException
    halt env, status_code: 400, response: ErrorResponse.new("parse_error", "Invalid JSON body").to_json
  end
end

post "/api/auth/login" do |env|
  begin
    body = LoginRequest.from_json(env.request.body.not_nil!)

    user = Database.find_user_by_email(body.email)
    unless user && Database.verify_password(user.id, body.password)
      halt env, status_code: 401, response: ErrorResponse.new("unauthorized", "Invalid email or password").to_json
    end

    token_response = JWTHelper.generate_token(user.id)
    token_response.to_json
  rescue ex : JSON::ParseException
    halt env, status_code: 400, response: ErrorResponse.new("parse_error", "Invalid JSON body").to_json
  end
end

# Protected user endpoints
get "/api/users/me" do |env|
  auth_required
  current_user.to_json
end

get "/api/users" do |env|
  auth_required
  Database.users.to_json
end

get "/api/users/:id" do |env|
  auth_required
  user_id = env.params.url["id"].to_i32
  user = Database.find_user_by_id(user_id)

  if user
    user.to_json
  else
    halt env, status_code: 404, response: ErrorResponse.new("not_found", "User not found").to_json
  end
end

# Items CRUD (example resource)
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

struct CreateItemRequest
  include JSON::Serializable

  property name : String
  property description : String
end

class_property items = [] of Item
class_property item_id_counter = 0

get "/api/items" do |env|
  auth_required
  items.select { |i| i.user_id == current_user.id }.to_json
end

post "/api/items" do |env|
  auth_required
  begin
    body = CreateItemRequest.from_json(env.request.body.not_nil!)

    if body.name.empty?
      halt env, status_code: 400, response: ErrorResponse.new("validation_error", "Name is required").to_json
    end

    @@item_id_counter += 1
    item = Item.new(@@item_id_counter, body.name, body.description, current_user.id)
    items << item

    env.response.status_code = 201
    item.to_json
  rescue ex : JSON::ParseException
    halt env, status_code: 400, response: ErrorResponse.new("parse_error", "Invalid JSON body").to_json
  end
end

get "/api/items/:id" do |env|
  auth_required
  item_id = env.params.url["id"].to_i32
  item = items.find { |i| i.id == item_id && i.user_id == current_user.id }

  if item
    item.to_json
  else
    halt env, status_code: 404, response: ErrorResponse.new("not_found", "Item not found").to_json
  end
end

delete "/api/items/:id" do |env|
  auth_required
  item_id = env.params.url["id"].to_i32
  item_index = items.index { |i| i.id == item_id && i.user_id == current_user.id }

  if item_index
    items.delete_at(item_index)
    env.response.status_code = 204
    ""
  else
    halt env, status_code: 404, response: ErrorResponse.new("not_found", "Item not found").to_json
  end
end

# Start server
port = ENV.fetch("PORT", "3000").to_i
Kemal.config.port = port
Kemal.config.host_binding = "0.0.0.0"

puts "🚀 {{projectName}} server starting on http://localhost:#{port}"
Kemal.run
`,

    'spec/spec_helper.cr': `require "spec"
require "spec-kemal"
require "../src/{{projectName}}"

# Test helper methods
def json_headers
  HTTP::Headers{"Content-Type" => "application/json"}
end

def auth_headers(token : String)
  HTTP::Headers{
    "Content-Type"  => "application/json",
    "Authorization" => "Bearer #{token}"}
end

def parse_json(body : String)
  JSON.parse(body)
end
`,

    'spec/{{projectName}}_spec.cr': `require "./spec_helper"

describe "{{projectName}}" do
  describe "GET /" do
    it "returns API info" do
      get "/"
      response.status_code.should eq 200

      json = parse_json(response.body)
      json["name"].should eq "{{projectName}}"
      json["framework"].should eq "Kemal"
    end
  end

  describe "GET /health" do
    it "returns health status" do
      get "/health"
      response.status_code.should eq 200

      json = parse_json(response.body)
      json["status"].should eq "healthy"
    end
  end

  describe "Authentication" do
    describe "POST /api/auth/register" do
      it "creates a new user" do
        post "/api/auth/register",
          headers: json_headers,
          body: {
            email:    "test@example.com",
            name:     "Test User",
            password: "password123"
          }.to_json

        response.status_code.should eq 201

        json = parse_json(response.body)
        json["email"].should eq "test@example.com"
        json["name"].should eq "Test User"
      end

      it "returns error for invalid body" do
        post "/api/auth/register",
          headers: json_headers,
          body: "invalid json"

        response.status_code.should eq 400
      end
    end

    describe "POST /api/auth/login" do
      it "returns token for valid credentials" do
        # First register
        post "/api/auth/register",
          headers: json_headers,
          body: {
            email:    "login@example.com",
            name:     "Login User",
            password: "password123"
          }.to_json

        # Then login
        post "/api/auth/login",
          headers: json_headers,
          body: {
            email:    "login@example.com",
            password: "password123"
          }.to_json

        response.status_code.should eq 200

        json = parse_json(response.body)
        json["token"].should_not be_nil
      end

      it "returns error for invalid credentials" do
        post "/api/auth/login",
          headers: json_headers,
          body: {
            email:    "wrong@example.com",
            password: "wrongpassword"
          }.to_json

        response.status_code.should eq 401
      end
    end
  end

  describe "Protected endpoints" do
    it "returns 401 without token" do
      get "/api/users/me"
      response.status_code.should eq 401
    end
  end
end
`,

    '.env': `# Environment Configuration
PORT=3000
JWT_SECRET=your-super-secret-key-change-in-production
DATABASE_URL=postgres://localhost/{{projectName}}_dev
`,

    '.env.example': `# Environment Configuration
PORT=3000
JWT_SECRET=your-super-secret-key-change-in-production
DATABASE_URL=postgres://localhost/{{projectName}}_dev
`,

    '.gitignore': `# Dependencies
/lib/
/.shards/

# Build artifacts
/bin/
*.dwarf

# Environment
.env
.env.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Coverage
coverage/
`,

    'Makefile': `# {{projectName}} Makefile

.PHONY: all build run test clean deps lint

all: build

# Install dependencies
deps:
	shards install

# Build the project
build: deps
	crystal build src/{{projectName}}.cr -o bin/{{projectName}}

# Build release version
release: deps
	crystal build src/{{projectName}}.cr -o bin/{{projectName}} --release

# Run the server
run: deps
	crystal run src/{{projectName}}.cr

# Run in watch mode (requires watchexec)
watch:
	watchexec -r -e cr -- crystal run src/{{projectName}}.cr

# Run tests
test: deps
	crystal spec

# Run linter
lint: deps
	./bin/ameba

# Clean build artifacts
clean:
	rm -rf bin/
	rm -rf lib/
	rm -rf .shards/

# Docker commands
docker-build:
	docker build -t {{projectName}} .

docker-run:
	docker run -p 3000:3000 --env-file .env {{projectName}}

# Database commands (if using PostgreSQL)
db-create:
	createdb {{projectName}}_dev

db-drop:
	dropdb {{projectName}}_dev

db-migrate:
	crystal sam.cr -- db:migrate

db-rollback:
	crystal sam.cr -- db:rollback
`,

    'Dockerfile': `# Build stage
FROM crystallang/crystal:1.10.1-alpine AS builder

WORKDIR /app

# Install dependencies
COPY shard.yml shard.lock* ./
RUN shards install --production

# Copy source and build
COPY . .
RUN crystal build src/{{projectName}}.cr -o bin/{{projectName}} --release --static

# Runtime stage
FROM alpine:3.18

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache libgcc libstdc++

# Copy binary
COPY --from=builder /app/bin/{{projectName}} ./{{projectName}}

# Create non-root user
RUN adduser -D -g '' appuser
USER appuser

EXPOSE 3000

ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD wget -q -O /dev/null http://localhost:3000/health || exit 1

CMD ["./{{projectName}}"]
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - JWT_SECRET=\${JWT_SECRET:-development-secret}
      - DATABASE_URL=postgres://postgres:postgres@db:5432/{{projectName}}
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB={{projectName}}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
`,

    'README.md': `# {{projectName}}

{{description}}

A Crystal web application built with the Kemal framework.

## Features

- 🚀 Fast and lightweight Crystal web server
- 🔐 JWT authentication
- 📝 Full REST API with CRUD operations
- 🧪 Comprehensive test suite
- 🐳 Docker support
- 📊 Database ready (PostgreSQL)

## Requirements

- Crystal >= 1.10.0
- PostgreSQL (optional, for production)

## Installation

\`\`\`bash
# Install dependencies
shards install

# Run the server
crystal run src/{{projectName}}.cr
\`\`\`

## Development

\`\`\`bash
# Run in development mode
make run

# Run with auto-reload (requires watchexec)
make watch

# Run tests
make test

# Run linter
make lint
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
docker run -p 3000:3000 {{projectName}}

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
    'echo "✨ {{projectName}} is ready!"',
    'echo "Run: crystal run src/{{projectName}}.cr"']};
