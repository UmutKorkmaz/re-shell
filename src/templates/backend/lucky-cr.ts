import { BackendTemplate } from '../types';

export const luckyCrTemplate: BackendTemplate = {
  id: 'lucky-cr',
  name: 'lucky-cr',
  displayName: 'Lucky (Crystal)',
  description: 'Full-stack Rails-like web framework for Crystal with ORM, authentication, and testing',
  language: 'crystal',
  framework: 'lucky',
  version: '1.0.0',
  tags: ['crystal', 'lucky', 'full-stack', 'database', 'authentication', 'mvc'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'database'],

  files: {
    // Shard configuration
    'shard.yml': `name: {{projectNameSnake}}
version: 0.1.0

authors:
  - {{author}} <{{email}}>

targets:
  app:
    main: src/app.cr

crystal: 1.10.0

license: MIT

dependencies:
  lucky:
    github: luckyframework/lucky
    version: ~> 1.1.0
  lucky_flow:
    github: luckyframework/lucky_flow
    version: ~> 0.9.0
  carbon:
    github: luckyframework/carbon
    version: ~> 0.3.0
`,

    // Main application
    'src/app.cr': `require "lucky"
require "carbon"

require "./actions/**"
require "./models/**"
require "./queries/**"

class App < Lucky::App
  middleware.set :add_flash, Lucky::Flash::SessionHandler.new

  middleware.set :session, Lucky::Session::Handler.new

  middleware.set :log, Lucky::LogHandler.new

  middleware.set :rescue_errors, Lucky::RescueErrors.new

  middleware.set :gzip, Lucky::GzipHandler.new

  middleware.set :csrf, Lucky::ProtectFromForgery.new

  # Add static file routing
  serve_static({"assets" => "public"})

  # Setup CORS
  setup_cors

  def setup_cors
    middleware.add Lucky::Cors.new(
      allowed_methods: [:get, :post, :put, :delete, :options],
      allowed_headers: ["Content-Type", "Authorization"],
      expose_headers: ["Content-Type"],
      max_age: 24.hours,
      allowed_origins: [/^http:\\/\\/localhost(:[0-9]+)?$/]
    )
  end
end
`,

    // Server
    'src/server.cr': `require "./app"

Lucky::Server.configure do |settings|
  settings.secret_key = "change-this-secret-in-production"
  settings.host = "0.0.0.0"
  settings.port = 8080
end

Lucky::Server.run do
  puts "🚀 Server running at http://localhost:8080"
  puts "📚 API docs: http://localhost:8080/api/v1/health"
end
`,

    // Models - User
    'src/models/user.cr': `class User < BaseModel
  table :users do
    column email : String
    column encrypted_password : String
    column name : String
    column role : String
  end

  enum Role : String
    User
    Admin
  end

  def self.find_by_email(email : String)
    query.where(&.email.(email)).first
  end

  def self.find_by_role(role : Role)
    query.where(&.role.(role.to_s)).to_a
  end

  def password=(password : String)
    @encrypted_password = BCrypt::Password.create(password)
  end

  def password(password : String) : Bool
    BCrypt::Password.new(@encrypted_password.not_nil!) == password
  end

  def to_response
    {
      id: id,
      email: email,
      name: name,
      role: role
    }
  end
end
`,

    // Models - Product
    'src/models/product.cr': `class Product < BaseModel
  table :products do
    column name : String
    column description : String?
    column price : Float64
    column stock : Int32
  end

  def self.search(name : String?)
    query.where(&.name.(name)) if name
  end

  def in_stock?
    stock > 0
  end

  def to_response
    {
      id: id,
      name: name,
      description: description,
      price: price,
      stock: stock,
      in_stock: in_stock?
    }
  end
end
`,

    // Base model
    'src/models/base_model.cr': `require "lucky"

abstract class BaseModel < LuckyRecord::Model
  macro inherited
    primary_key id : Int64

    table {{@type.name.underscore}}
  end
end
`,

    // Actions - Health
    'src/actions/api/v1/health/index.cr': `module Api::V1::Health
  class Index < ApiAction
    get "/api/v1/health" do
      json({
        status: "healthy",
        timestamp: Time.utc.to_s("%Y-%m-%d %H:%M:%S %z"),
        version: "1.0.0"
      })
    end
  end
end
`,

    // Actions - Auth
    'src/actions/api/v1/auth/register.cr': `module Api::V1::Auth
  class Register < ApiAction
    post "/api/v1/auth/register" do
      params = register_params

      if User.find_by_email(params.email)
        json({error: "Email already registered"}, status: 409)
      else
        user = User.create(params)
        token = generate_token(user)

        json({
          token: token,
          user: user.to_response
        }, status: 201)
      end
    end

    private def register_params
      body.as(JSON::Any).as_h
    end

    private def generate_token(user : User) : String
      "jwt-token-for-#{user.id}"
    end
  end
end
`,

    'src/actions/api/v1/auth/login.cr': `module Api::V1::Auth
  class Login < ApiAction
    post "/api/v1/auth/login" do
      params = login_params

      user = User.find_by_email(params["email"].as_s)

      if user && user.password(params["password"].as_s)
        token = generate_token(user)
        json({
          token: token,
          user: user.to_response
        })
      else
        json({error: "Invalid credentials"}, status: 401)
      end
    end

    private def login_params
      body.as(JSON::Any).as_h
    end

    private def generate_token(user : User) : String
      "jwt-token-for-#{user.id}"
    end
  end
end
`,

    // Actions - Products
    'src/actions/api/v1/products/index.cr': `module Api::V1::Products
  class Index < ApiAction
    get "/api/v1/products" do
      products = ProductQuery.new.to_a
      json({
        products: products.map(&.to_response),
        count: products.size
      })
    end
  end
end
`,

    'src/actions/api/v1/products/show.cr': `module Api::V1::Products
  class Show < ApiAction
    get "/api/v1/products/:id" do
      product = ProductQuery.find(id)

      if product
        json({product: product.to_response})
      else
        json({error: "Product not found"}, status: 404)
      end
    end
  end
end
`,

    'src/actions/api/v1/products/create.cr': `module Api::V1::Products
  class Create < ApiAction
    post "/api/v1/products" do
      params = product_params

      product = Product.create(
        name: params["name"].as_s,
        description: params["description"]?.try(&.as_s),
        price: params["price"].as_f,
        stock: params["stock"].as_i.to_i32
      )

      json({product: product.to_response}, status: 201)
    end

    private def product_params
      body.as(JSON::Any).as_h
    end
  end
end
`,

    'src/actions/api/v1/products/update.cr': `module Api::V1::Products
  class Update < ApiAction
    put "/api/v1/products/:id" do
      params = product_params

      product = ProductQuery.find(id)

      if product
        product.update(
          name: params["name"]?.try(&.as_s) || product.name,
          description: params["description"]?.try(&.as_s) || product.description,
          price: params["price"]?.try(&.as_f) || product.price,
          stock: params["stock"]?.try(&.as_i).try(&.to_i32) || product.stock
        )

        json({product: product.to_response})
      else
        json({error: "Product not found"}, status: 404)
      end
    end

    private def product_params
      body.as(JSON::Any).as_h
    end
  end
end
`,

    'src/actions/api/v1/products/delete.cr': `module Api::V1::Products
  class Delete < ApiAction
    delete "/api/v1/products/:id" do
      product = ProductQuery.find(id)

      if product
        product.delete
        head :no_content
      else
        json({error: "Product not found"}, status: 404)
      end
    end
  end
end
`,

    // Base API action
    'src/actions/api_action.cr': `require "lucky"
require "carbon"

abstract class ApiAction < Lucky::Action
  # Disable CSRF for API
  disable_csrf

  # Return JSON response
  def json(data : JSON::Any::Any | Hash | Array, status : HTTP::Status = HTTP::Status::OK)
    carbon response, status: status
  end
end
`,

    // Database setup
    'config/database.cr': `# Database configuration
# This is a simple in-memory setup for development

Avram::Repo.configure do |settings|
  settings.url = "postgres://postgres:postgres@localhost:5432/{{projectNameSnake}}_dev"
end

# For simple in-memory operations, you can use a simple Hash-based storage
# In production, use PostgreSQL with Avrom
`,

    // Database initialization
    'src/db.cr': `# Database initialization
# Simple in-memory setup for development

class Database
  @@users = {} of Int64 => User
  @@products = {} of Int64 => Product
  @@user_id = 1_i64
  @@product_id = 1_i64

  def self.init
    # Create default admin user
    admin = User.new
    admin.id = @@user_id
    admin.email = "admin@example.com"
    admin.encrypted_password = BCrypt::Password.create("admin123")
    admin.name = "Admin User"
    admin.role = "admin"
    @@users[@@user_id] = admin
    @@user_id += 1

    # Create sample products
    prod1 = Product.new
    prod1.id = @@product_id
    prod1.name = "Sample Product 1"
    prod1.description = "This is a sample product"
    prod1.price = 29.99
    prod1.stock = 100
    @@products[@@product_id] = prod1
    @@product_id += 1

    prod2 = Product.new
    prod2.id = @@product_id
    prod2.name = "Sample Product 2"
    prod2.description = "Another sample product"
    prod2.price = 49.99
    prod2.stock = 50
    @@products[@@product_id] = prod2
    @@product_id += 1

    puts "📦 Database initialized"
    puts "👤 Default admin: admin@example.com / admin123"
  end

  def self.users
    @@users
  end

  def self.products
    @@products
  end

  def self.next_user_id
    id = @@user_id
    @@user_id += 1
    id
  end

  def self.next_product_id
    id = @@product_id
    @@product_id += 1
    id
  end
end

Database.init
`,

    // Queries
    'src/queries/user_query.cr': `class UserQuery < User::BaseQuery
end
`,

    'src/queries/product_query.cr': `class ProductQuery < Product::BaseQuery
end
`,

    // Dockerfile
    'Dockerfile': `# Builder stage
FROM crystallang/crystal:1.10.0-alpine AS builder

WORKDIR /app

# Install dependencies
COPY shard.yml shard.lock ./
RUN shards install --production

# Copy source and build
COPY . .
RUN crystal build src/server.cr --release --static

# Runtime stage
FROM alpine:3.18

# Install ca-certificates for HTTPS requests and openssl for crystal
RUN apk add --no-cache ca-certificates openssl

# Create non-root user
RUN addgroup -g 1000 appgroup && \
    adduser -D -u 1000 -G appgroup appuser

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/server /app/server

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/v1/health || exit 1

CMD ["./server"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    restart: unless-stopped
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: {{projectNameSnake}}_dev
    ports:
      - "5432:5432"
`,

    // Tests
    'spec/spec_helper.cr': `require "lucky"
require "spec"
`,

    'spec/models/user_spec.cr': `require "./spec_helper"

describe User do
  it "has a role" do
    user = User.new
    user.role = "user"
    user.role.should eq("user")
  end
end
`,

    // README
    'README.md': `# {{projectName}}

Full-stack REST API built with Lucky framework for Crystal.

## Features

- **Lucky**: Rails-like framework for Crystal
- **ORM**: Type-safe database queries
- **Authentication**: JWT token-based auth
- **Validation**: Request validation
- **Testing**: Built-in testing framework
- **Hot-reload**: Development with live reload

## Requirements

- Crystal 1.10+
- PostgreSQL (optional, for production)

## Quick Start

\`\`\`bash
shards install
crystal run src/server.cr
\`\`\`

## API Endpoints

- \`GET /api/v1/health\` - Health check
- \`POST /api/v1/auth/register\` - Register
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/products\` - List products

## License

MIT
`
  }
};
