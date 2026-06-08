import { BackendTemplate } from '../types';

export const amberCrTemplate: BackendTemplate = {
  id: 'amber-cr',
  name: 'amber-cr',
  displayName: 'Amber (Crystal)',
  description: 'MVC web framework for Crystal with ORM, WebSocket support, and JSON handling',
  language: 'crystal',
  framework: 'amber',
  version: '1.0.0',
  tags: ['crystal', 'amber', 'mvc', 'websockets', 'database', 'json'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'websockets'],

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
  amber:
    github: amberframework/amber
    version: ~> 1.3.0
  granite:
    github: amberframework/granite
    version: ~> 0.23.0
  crediential:
    github: amberframework/crediential
    version: ~> 0.4.0
  citrine-i18n:
    github: amberframework/citrine-i18n
    version: ~> 0.5.0
`,

    // Main application
    'src/app.cr': `require "amber"
require "./controllers/**"
require "./models/**"
require "./views/**"

module {{projectNamePascal}}
  VERSION = "0.1.0"

  Amber::Server.configure do |settings|
    settings.name = "{{projectName}}"
    settings.port = 8080
    settings.host = "0.0.0.0"
    settings.log = ::Logger.new(STDOUT)
    settings.log.level = ::Logger::INFO

    # CORS settings
    settings.cors.enabled = true
    settings.cors.origins = ["*"]
    settings.cors.methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    settings.cors.headers = ["Content-Type", "Authorization"]

    # Session
    settings.session = {
      "key" => "amber.session",
      "store" => "signed_cookie",
      "expires" => 0,
      "secret" => "change-this-secret-in-production"}

    # Database
    settings.database_url = "postgres://postgres:postgres@localhost:5432/{{projectNameSnake}}"

    # Routes
    routes :web, {{projectNamePascal}}::Routes
    routes :api, {{projectNamePascal}}::ApiRoutes
  end
end
`,

    // Server
    'src/server.cr': `require "./app"

puts "🚀 Server running at http://localhost:8080"
puts "📚 API docs: http://localhost:8080/api/v1/health"

{{projectNamePascal}}::Server.start
`,

    // Routes
    'src/routes.cr': `module {{projectNamePascal}}
  class Routes < Amber::Router::Symphony
    def setup
      get "/api/v1/health", HealthController, :index
      post "/api/v1/auth/register", AuthController, :register
      post "/api/v1/auth/login", AuthController, :login
      get "/api/v1/products", ProductController, :index
      get "/api/v1/products/:id", ProductController, :show
      post "/api/v1/products", ProductController, :create
      put "/api/v1/products/:id", ProductController, :update
      delete "/api/v1/products/:id", ProductController, :delete
    end
  end

  class ApiRoutes < Amber::Router::Symphony
    def setup
      # API v1 routes
      get "/api/v1/health", HealthController, :index
      post "/api/v1/auth/register", AuthController, :register
      post "/api/v1/auth/login", AuthController, :login
      get "/api/v1/products", ProductController, :index
      get "/api/v1/products/:id", ProductController, :show
      post "/api/v1/products", ProductController, :create
      put "/api/v1/products/:id", ProductController, :update
      delete "/api/v1/products/:id", ProductController, :delete
    end
  end
end
`,

    // Models - User
    'src/models/user.cr': `class User < Granite::Base
  adapter pg
  table_name users

  field email : String
  field encrypted_password : String
  field name : String
  field role : String
  field created_at : Time
  field updated_at : Time

  validates :email, presence: true, uniqueness: true
  validates :encrypted_password, presence: true
  validates :name, presence: true

  enum Role : String
    User
    Admin
  end

  def self.find_by_email(email : String)
    find_by(:email, email)
  end

  def password=(password : String)
    @encrypted_password = BCrypt::Password.create(password).to_s
  end

  def password(password : String) : Bool
    bcrypt = BCrypt::Password.new(@encrypted_password)
    bcrypt == password
  end

  def as_response
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
    'src/models/product.cr': `class Product < Granite::Base
  adapter pg
  table_name products

  field name : String
  field description : String?
  field price : Float64
  field stock : Int32
  field created_at : Time
  field updated_at : Time

  validates :name, presence: true
  validates :price, presence: true
  validates :stock, presence: true

  def in_stock?
    stock > 0
  end

  def as_response
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

    // Controllers - Health
    'src/controllers/health_controller.cr': `class HealthController < Amber::Controller::Base
  def index
    json({
      status: "healthy",
      timestamp: Time.utc.to_s("%Y-%m-%d %H:%M:%S %z"),
      version: "1.0.0"
    }.to_json)
  end
end
`,

    // Controllers - Auth
    'src/controllers/auth_controller.cr': `require "authentication"

class AuthController < Amber::Controller::Base
  def register
    user_params = validate_user_params

    if User.find_by_email(user_params["email"].as_s)
      json({error: "Email already registered"}.to_json, 409)
    else
      user = User.new
      user.email = user_params["email"].as_s
      user.encrypted_password = BCrypt::Password.create(user_params["password"].as_s).to_s
      user.name = user_params["name"].as_s
      user.role = "user"
      user.created_at = Time.utc
      user.updated_at = Time.utc

      if user.save
        token = generate_token(user)
        json({
          token: token,
          user: user.as_response
        }.to_json, 201)
      else
        json({error: "Failed to create user"}.to_json, 422)
      end
    end
  end

  def login
    user_params = validate_login_params

    user = User.find_by_email(user_params["email"].as_s)

    if user && user.password(user_params["password"].as_s)
      token = generate_token(user)
      json({
        token: token,
        user: user.as_response
      }.to_json)
    else
      json({error: "Invalid credentials"}.to_json, 401)
    end
  end

  private def validate_user_params
    body = request.body.as(IO)
    JSON.parse(body.gets_to_end)
  end

  private def validate_login_params
    validate_user_params
  end

  private def generate_token(user : User) : String
    payload = {
      "user_id" => user.id.to_s,
      "email" => user.email,
      "role" => user.role,
      "exp" => (Time.utc + 7.days).to_unix.to_s
    }

    JWT.encode(payload, "change-this-secret", JWT::Algorithm::HS256)
  end
end
`,

    // Controllers - Products
    'src/controllers/product_controller.cr': `class ProductController < Amber::Controller::Base
  def index
    products = Product.all
    json({
      products: products.map(&.as_response),
      count: products.size
    }.to_json)
  end

  def show
    if product = Product.find(params["id"])
      json({product: product.as_response}.to_json)
    else
      json({error: "Product not found"}.to_json, 404)
    end
  end

  def create
    product_params = validate_product_params

    product = Product.new
    product.name = product_params["name"].as_s
    product.description = product_params["description"]?.as_s? || ""
    product.price = product_params["price"].as_f.to_f64
    product.stock = product_params["stock"].as_i.to_i32
    product.created_at = Time.utc
    product.updated_at = Time.utc

    if product.save
      json({product: product.as_response}.to_json, 201)
    else
      json({error: "Failed to create product"}.to_json, 422)
    end
  end

  def update
    unless product = Product.find(params["id"])
      return json({error: "Product not found"}.to_json, 404)
    end

    product_params = validate_product_params
    product.name = product_params["name"]?.as_s? || product.name
    product.description = product_params["description"]?.as_s? || product.description
    product.price = product_params["price"]?.as_f? || product.price
    product.stock = product_params["stock"]?.as_i? || product.stock
    product.updated_at = Time.utc

    if product.save
      json({product: product.as_response}.to_json)
    else
      json({error: "Failed to update product"}.to_json, 422)
    end
  end

  def delete
    if product = Product.find(params["id"])
      product.delete
      head :no_content
    else
      json({error: "Product not found"}.to_json, 404)
    end
  end

  private def validate_product_params
    body = request.body.as(IO)
    JSON.parse(body.gets_to_end)
  end
end
`,

    // Database configuration
    'config/database.yml': `# Database configuration
# In production, use PostgreSQL
postgres:
  url: postgres://postgres:postgres@localhost:5432/{{projectNameSnake}}

# For development without PostgreSQL, you can use an in-memory setup
`,

    // Database initialization
    'src/db/init.cr': `# Database initialization
# Simple setup for development

class Database
  @@users = {} of Int32 => User
  @@products = {} of Int32 => Product
  @@user_id = 1
  @@product_id = 1

  def self.init
    # Create default admin user
    admin = User.new
    admin.id = @@user_id
    admin.email = "admin@example.com"
    admin.encrypted_password = BCrypt::Password.create("admin123").to_s
    admin.name = "Admin User"
    admin.role = "admin"
    admin.created_at = Time.utc
    admin.updated_at = Time.utc
    @@users[@@user_id] = admin
    @@user_id += 1

    # Create sample products
    prod1 = Product.new
    prod1.id = @@product_id
    prod1.name = "Sample Product 1"
    prod1.description = "This is a sample product"
    prod1.price = 29.99
    prod1.stock = 100
    prod1.created_at = Time.utc
    prod1.updated_at = Time.utc
    @@products[@@product_id] = prod1
    @@product_id += 1

    prod2 = Product.new
    prod2.id = @@product_id
    prod2.name = "Sample Product 2"
    prod2.description = "Another sample product"
    prod2.price = 49.99
    prod2.stock = 50
    prod2.created_at = Time.utc
    prod2.updated_at = Time.utc
    @@products[@@product_id] = prod2
    @@product_id += 1

    puts "📦 Database initialized"
    puts "👤 Default admin: admin@example.com / admin123"
  end
end

Database.init
`,

    // Views
    'src/views/base_view.cr': `class BaseView
  ecr "{{projectNameSnake}}"
end
`,

    // Dockerfile - Multi-stage optimized build
    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Builder
FROM crystallang/crystal:1.10.0-alpine AS builder

WORKDIR /app

# Copy shard files first for better caching
COPY shard.yml shard.lock ./

# Install dependencies
RUN shards install --production

# Copy source code
COPY . .

# Build application
RUN crystal build src/server.cr --release

# =============================================================================
# Stage 2: Runtime - Minimal image
# =============================================================================
FROM alpine:3.18

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache libgcc libstdc++ ca-certificates

# Copy binary from builder
COPY --from=builder /app/server ./server

# Create non-root user
RUN addgroup -S -g 1000 appgroup && \\
    adduser -S -u 1000 -G appgroup appuser

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD wget -q -O /dev/null http://localhost:8080/health || exit 1

CMD ["./server"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgres://postgres:postgres@db:5432/{{projectNameSnake}}
    depends_on:
      - db
    restart: unless-stopped
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: {{projectNameSnake}}
    ports:
      - "5432:5432"
`,

    // Tests
    'spec/spec_helper.cr': `require "spec"
require "amber"
`,

    'spec/models/user_spec.cr': `require "./spec_helper"

describe User do
  it "creates a user" do
    user = User.new
    user.email = "test@example.com"
    user.encrypted_password = BCrypt::Password.create("password").to_s
    user.name = "Test User"
    user.role = "user"

    user.email.should eq("test@example.com")
  end
end
`,

    // README
    'README.md': `# {{projectName}}

MVC REST API built with Amber framework for Crystal.

## Features

- **Amber**: Full-stack MVC framework
- **Granite ORM**: Type-safe database operations
- **JWT Authentication**: Secure token-based auth
- **WebSocket**: Real-time communication support
- **Hot-reload**: Development with live reload
- **Validation**: Request and model validation

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
