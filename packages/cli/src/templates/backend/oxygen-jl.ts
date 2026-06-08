import { BackendTemplate } from '../types';

export const oxygenJlTemplate: BackendTemplate = {
  id: 'oxygen-jl',
  name: 'oxygen-jl',
  displayName: 'Oxygen (Julia)',
  description: 'Minimal, fast HTTP framework for Julia with simple routing and middleware',
  language: 'julia',
  framework: 'oxygen',
  version: '1.0.0',
  tags: ['julia', 'oxygen', 'minimal', 'fast', 'http', 'restful'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing'],

  files: {
    // Main application file
    'src/{{projectName}}.jl': `using Oxygen
using {{projectNamePascal}}.Models
using {{projectNamePascal}}.Handlers

# Initialize database
Models.init()

# Enable CORS
@staticfiles "/" => "public"

# Health check
@get "/api/v1/health"
function health()
  json(Dict(
    "status" => "healthy",
    "timestamp" => string(now()),
    "version" => "1.0.0"
  ))
end

# Auth routes
@post "/api/v1/auth/register"
function register(req::HTTP.Request)
  data = jsonpayload(req)
  Handlers.handle_register(data)
end

@post "/api/v1/auth/login"
function login(req::HTTP.Request)
  data = jsonpayload(req)
  Handlers.handle_login(data)
end

# Product routes
@get "/api/v1/products"
function list_products()
  products = Models.get_all_products()
  json(Dict(
    "products" => products,
    "count" => length(products)
  ))
end

@get "/api/v1/products/:id::Int"
function get_product(req::HTTP.Request, id::Int)
  product = Models.get_product_by_id(id)

  if isnothing(product)
    return json(Dict("error" => "Product not found"), 404)
  end

  json(Dict("product" => product))
end

@post "/api/v1/products"
function create_product(req::HTTP.Request)
  data = jsonpayload(req)
  Handlers.handle_create_product(data)
end

@put "/api/v1/products/:id::Int"
function update_product(req::HTTP.Request, id::Int)
  data = jsonpayload(req)
  Handlers.handle_update_product(id, data)
end

@delete "/api/v1/products/:id::Int"
function delete_product(req::HTTP.Request, id::Int)
  success = Models.delete_product(id)

  if !success
    return json(Dict("error" => "Product not found"), 404)
  end

  return json(Dict(), 204)
end

# Home route
@get "/"
function home()
  html("""
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
        <p>Minimal Julia HTTP application built with Oxygen framework</p>
        <p>API available at: <a href="/api/v1/health">/api/v1/health</a></p>
      </body>
    </html>
  """)
end

# Start server
function main()
  println("🚀 Server running at http://localhost:8080")
  println("📚 API docs: http://localhost:8080/api/v1/health")

  serve(port=8080)
end

if abspath(PROGRAM_FILE) == @__FILE__
  main()
end
`,

    // User Model
    'src/models/user.jl': `module Models

using SHA

struct User
  id::Int
  email::String
  password::String
  name::String
  role::String
  created_at::String
  updated_at::String
end

# In-memory storage
const users = User[
  User(
    1,
    "admin@example.com",
    "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a", # sha256("admin123")
    "Admin User",
    "admin",
    string(now()),
    string(now())
  )
]

const user_counter = Ref(2)

function init()
  println("📦 Database initialized")
  println("👤 Default admin: admin@example.com / admin123")
end

function find_user_by_email(email::String)
  for user in users
    if user.email == email
      return user
    end
  end
  return nothing
end

function find_user_by_id(id::Int)
  for user in users
    if user.id == id
      return user
    end
  end
  return nothing
end

function create_user(data::Dict)
  new_user = User(
    user_counter[],
    data["email"],
    bytes2hex(sha256(convert(Vector{UInt8}, codeunits(data["password"])))),
    data["name"],
    "user",
    string(now()),
    string(now())
  )

  user_counter[] += 1
  push!(users, new_user)

  return new_user
end

function get_all_users()
  return users
end

function hash_password(password::String)
  return bytes2hex(sha256(convert(Vector{UInt8}, codeunits(password))))
end

function verify_password(password::String, hash::String)
  return hash_password(password) == hash
end

end # module
`,

    // Product Model
    'src/models/product.jl': `module Models

struct Product
  id::Int
  name::String
  description::String
  price::Float64
  stock::Int
  created_at::String
  updated_at::String
end

# In-memory storage
const products = Product[
  Product(
    1,
    "Sample Product 1",
    "This is a sample product",
    29.99,
    100,
    string(now()),
    string(now())
  ),
  Product(
    2,
    "Sample Product 2",
    "Another sample product",
    49.99,
    50,
    string(now()),
    string(now())
  )
]

const product_counter = Ref(3)

function get_all_products()
  return products
end

function get_product_by_id(id::Int)
  for product in products
    if product.id == id
      return product
    end
  end
  return nothing
end

function create_product(data::Dict)
  new_product = Product(
    product_counter[],
    data["name"],
    get(data, "description", ""),
    parse(Float64, data["price"]),
    parse(Int, get(data, "stock", "0")),
    string(now()),
    string(now())
  )

  product_counter[] += 1
  push!(products, new_product)

  return new_product
end

function update_product(id::Int, data::Dict)
  for (i, product) in enumerate(products)
    if product.id == id
      updated = Product(
        product.id,
        get(data, "name", product.name),
        get(data, "description", product.description),
        haskey(data, "price") ? parse(Float64, data["price"]) : product.price,
        haskey(data, "stock") ? parse(Int, data["stock"]) : product.stock,
        product.created_at,
        string(now())
      )
      products[i] = updated
      return updated
    end
  end
  return nothing
end

function delete_product(id::Int)
  for (i, product) in enumerate(products)
    if product.id == id
      deleteat!(products, i)
      return true
    end
  end
  return false
end

end # module
`,

    // Main models entry
    'src/models.jl': `module Models

include("models/user.jl")
include("models/product.jl")

using .UserModel
using .ProductModel

export User, Product

end # module
`,

    // Handlers
    'src/handlers.jl': `module Handlers

using {{projectNamePascal}}.Models
using SHA

function generate_token(user)
  # In production, use real JWT
  payload = Dict(
    "user_id" => user.id,
    "email" => user.email,
    "role" => user.role,
    "exp" => time() + 604800 # 7 days
  )

  return "jwt-token-" * bytes2hex(sha256(JSON.json(payload)))
end

function handle_register(data::Dict)
  # Check if user exists
  existing_user = Models.find_user_by_email(data["email"])
  if !isnothing(existing_user)
    return json(Dict("error" => "Email already registered"), 409)
  end

  # Create new user
  user = Models.create_user(data)

  # Generate token
  token = generate_token(user)

  return json(Dict(
    "token" => token,
    "user" => Dict(
      "id" => user.id,
      "email" => user.email,
      "name" => user.name,
      "role" => user.role
    )
  ), 201)
end

function handle_login(data::Dict)
  # Find user
  user = Models.find_user_by_email(data["email"])

  # Verify password
  if isnothing(user) || !Models.verify_password(data["password"], user.password)
    return json(Dict("error" => "Invalid credentials"), 401)
  end

  # Generate token
  token = generate_token(user)

  return json(Dict(
    "token" => token,
    "user" => Dict(
      "id" => user.id,
      "email" => user.email,
      "name" => user.name,
      "role" => user.role
    )
  ))
end

function handle_create_product(data::Dict)
  product = Models.create_product(data)
  return json(Dict("product" => product), 201)
end

function handle_update_product(id::Int, data::Dict)
  product = Models.update_product(id, data)

  if isnothing(product)
    return json(Dict("error" => "Product not found"), 404)
  end

  return json(Dict("product" => product))
end

end # module
`,

    // Project.toml
    'Project.toml': `name = "{{projectName}}"
uuid = "$(uuid4())"
authors = ["Your Name"]
version = "0.1.0"

[deps]
Oxygen = "df9a0c86-9f39-4cb2-a8a3-cc122c727817"
SHA = "ea8e919c-243c-51af-8825-aaa63cd721ce"
`,

    // Dockerfile
    'Dockerfile': `FROM julia:1.9

WORKDIR /app

COPY . .

RUN julia --project=@. -e 'using Pkg; Pkg.instantiate()'

EXPOSE 8080

CMD ["julia", "--project=@.", "src/{{projectName}}.jl"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    restart: unless-stopped
`,

    // Tests
    'test/runtests.jl': `using {{projectNamePascal}}
using Test
using Oxygen

@testset "{{projectName}} Tests" begin
  @testset "Models" begin
    using {{projectNamePascal}}.Models

    @testset "User Model" begin
      users = Models.UserModel.get_all_users()
      @test length(users) > 0

      user = Models.UserModel.find_user_by_email("admin@example.com")
      @test !isnothing(user)
      @test user.email == "admin@example.com"
    end

    @testset "Product Model" begin
      products = Models.ProductModel.get_all_products()
      @test length(products) > 0

      product = Models.ProductModel.get_product_by_id(1)
      @test !isnothing(product)
      @test product.id == 1
    end
  end

  @testset "Password Hashing" begin
    using {{projectNamePascal}}.Models

    password = "test123"
    hash = Models.UserModel.hash_password(password)
    @test Models.UserModel.verify_password(password, hash)
    @test !Models.UserModel.verify_password("wrong", hash)
  end
end
`,

    // README
    'README.md': `# {{projectName}}

Minimal HTTP application built with Oxygen framework for Julia.

## Features

- **Oxygen**: Fast, minimal HTTP framework
- **Routing**: Simple decorator-based routing
- **Models**: In-memory database (switchable to PostgreSQL)
- **Handlers**: Clean request handling
- **JSON**: Automatic JSON serialization
- **Authentication**: JWT-like token generation

## Requirements

- Julia 1.9+

## Quick Start

\`\`\`bash
# Install dependencies
julia --project=@.

# Run the application
julia --project=@. src/{{projectName}}.jl
\`\`\`

Visit http://localhost:8080

## API Endpoints

- \`GET /api/v1/health\` - Health check
- \`POST /api/v1/auth/register\` - Register
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/products\` - List products
- \`GET /api/v1/products/:id\` - Get product by ID
- \`POST /api/v1/products\` - Create product
- \`PUT /api/v1/products/:id\` - Update product
- \`DELETE /api/v1/products/:id\` - Delete product

## Testing

\`\`\`bash
julia --project=@. test/runtests.jl
\`\`\`

## Project Structure

\`\`\`
src/
  models/          # Data models
  handlers.jl      # Request handlers
  {{projectName}}.jl  # Main application
\`\`\`

## License

MIT
`
  }
};
