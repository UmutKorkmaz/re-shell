import { BackendTemplate } from '../types';

export const genieJlTemplate: BackendTemplate = {
  id: 'genie-jl',
  name: 'genie-jl',
  displayName: 'Genie (Julia)',
  description: 'MVC web framework for Julia with routing, templating, and database support',
  language: 'julia',
  framework: 'genie',
  version: '1.0.0',
  tags: ['julia', 'genie', 'mvc', 'routing', 'templating', 'database'],
  port: 8000,
  dependencies: {
    Genie: '5',
    HTTP: '1',
    JSON3: '1',
  },
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'testing', 'graphql'],

  files: {
    'app.jl': `using Genie
using Genie.Router
using Genie.Requests
using HTTP
using {{projectNamePascal}}

# Request handling lives in the {{projectNamePascal}} package (src/); this file maps it onto routes.
const Api = {{projectNamePascal}}.Api

const HOME_HTML = """
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
    <p>Julia web application built with the Genie framework</p>
    <p>API available at: <a href="/api/v1/health">/api/v1/health</a></p>
  </body>
</html>
"""

# CORS: allow browser clients on any origin (Genie answers preflight requests itself).
Genie.config.cors_headers["Access-Control-Allow-Origin"] = "*"
Genie.config.cors_headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
Genie.config.cors_headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
Genie.config.cors_allowed_origins = ["*"]

# Home page
route("/") do
    HTTP.Response(200, ["Content-Type" => "text/html; charset=utf-8"], HOME_HTML)
end

# Health check
route("/api/v1/health") do
    Api.handle_health()
end

# GraphQL endpoint
route("/graphql", method = POST) do
    Api.handle_graphql(Genie.Requests.rawpayload())
end

# Auth routes
route("/api/v1/auth/register", method = POST) do
    Api.handle_register(Genie.Requests.rawpayload())
end

route("/api/v1/auth/login", method = POST) do
    Api.handle_login(Genie.Requests.rawpayload())
end

route("/api/v1/auth/me") do
    Api.handle_me(HTTP.header(Genie.Router.params(:REQUEST), "Authorization", ""))
end

# Product routes
route("/api/v1/products") do
    Api.handle_list_products()
end

route("/api/v1/products/:id::Int") do
    Api.handle_get_product(Genie.Router.params(:id))
end

route("/api/v1/products", method = POST) do
    Api.handle_create_product(Genie.Requests.rawpayload())
end

route("/api/v1/products/:id::Int", method = PUT) do
    Api.handle_update_product(Genie.Router.params(:id), Genie.Requests.rawpayload())
end

route("/api/v1/products/:id::Int", method = DELETE) do
    Api.handle_delete_product(Genie.Router.params(:id))
end

function main()
    port = parse(Int, get(ENV, "PORT", "8000"))
    println("Server running at http://localhost:", port)
    println("Health check: http://localhost:", port, "/api/v1/health")
    println("GraphQL:      http://localhost:", port, "/graphql")
    up(port, "0.0.0.0"; async = false)
end

if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
`,

    'src/{{projectNamePascal}}.jl': `module {{projectNamePascal}}

# Framework-independent application logic (users, products, auth, request handlers).
# The web layer lives in app.jl.
include("auth.jl")
include("models.jl")
include("api.jl")

end # module
`,

    'src/auth.jl': `"""
Password hashing and signed bearer tokens (HS256 JWT) built on the SHA, Base64
and JSON3 packages. Set JWT_SECRET in the environment for anything beyond a demo.
"""
module Auth

using Base64
using JSON3
using SHA

const DEFAULT_SECRET = "change-me-in-production"

secret() = get(ENV, "JWT_SECRET", DEFAULT_SECRET)

bytes(text::AbstractString) = Vector{UInt8}(codeunits(text))

function b64url_encode(data::AbstractVector{UInt8})
    text = base64encode(data)
    text = replace(text, '+' => '-')
    text = replace(text, '/' => '_')
    return replace(text, '=' => "")
end

function b64url_decode(text::AbstractString)
    padded = replace(replace(text, '-' => '+'), '_' => '/')
    padded *= repeat("=", mod(4 - length(padded) % 4, 4))
    return base64decode(padded)
end

"""Return \`salt:sha256(salt * password)\`; a fresh random salt is used unless one is given."""
function hash_password(password::AbstractString; salt::AbstractString = bytes2hex(rand(UInt8, 8)))
    return string(salt, ":", bytes2hex(sha256(bytes(string(salt, password)))))
end

function verify_password(password::AbstractString, stored::AbstractString)
    parts = split(stored, ":")
    length(parts) == 2 || return false
    return hash_password(password; salt = parts[1]) == stored
end

function signature(signing_input::AbstractString)
    return b64url_encode(hmac_sha256(bytes(secret()), bytes(signing_input)))
end

"""Issue an HS256 token for the given user fields; it expires after \`ttl\` seconds."""
function issue_token(user_id::Integer, email::AbstractString, role::AbstractString; ttl::Integer = 604800)
    header = b64url_encode(bytes(JSON3.write(Dict("alg" => "HS256", "typ" => "JWT"))))
    claims = Dict("sub" => user_id, "email" => email, "role" => role, "exp" => floor(Int, time()) + ttl)
    payload = b64url_encode(bytes(JSON3.write(claims)))
    signing_input = string(header, ".", payload)
    return string(signing_input, ".", signature(signing_input))
end

"""Return the token's claims as a Dict, or \`nothing\` when it is malformed, forged or expired."""
function verify_token(token::AbstractString)
    parts = split(token, ".")
    length(parts) == 3 || return nothing
    signature(string(parts[1], ".", parts[2])) == parts[3] || return nothing
    try
        claims = JSON3.read(String(b64url_decode(parts[2])), Dict{String,Any})
        exp = get(claims, "exp", 0)
        exp isa Real && exp > time() || return nothing
        return claims
    catch
        return nothing
    end
end

"""Extract the token from an \`Authorization: Bearer <token>\` header value."""
function bearer_token(header::AbstractString)
    startswith(header, "Bearer ") || return nothing
    token = strip(header[8:end])
    return isempty(token) ? nothing : String(token)
end

end # module
`,

    'src/models.jl': `"""In-memory users and products. Swap the vectors for a database layer when you need persistence."""
module Models

using Dates
using ..Auth

struct User
    id::Int
    email::String
    password_hash::String
    name::String
    role::String
    created_at::String
end

struct Product
    id::Int
    name::String
    description::String
    price::Float64
    stock::Int
    created_at::String
    updated_at::String
end

const LOCK = ReentrantLock()
const USERS = User[]
const PRODUCTS = Product[]
const COUNTERS = Dict(:user => 1, :product => 1)

timestamp() = string(Dates.now())

function next_id!(kind::Symbol)
    id = COUNTERS[kind]
    COUNTERS[kind] = id + 1
    return id
end

"""Reset the stores to the demo data: one admin user and two products."""
function seed!()
    lock(LOCK) do
        empty!(USERS)
        empty!(PRODUCTS)
        COUNTERS[:user] = 1
        COUNTERS[:product] = 1
        push!(USERS, User(next_id!(:user), "admin@example.com", Auth.hash_password("admin123"),
                          "Admin User", "admin", timestamp()))
        push!(PRODUCTS, Product(next_id!(:product), "Sample Product 1", "This is a sample product",
                                29.99, 100, timestamp(), timestamp()))
        push!(PRODUCTS, Product(next_id!(:product), "Sample Product 2", "Another sample product",
                                49.99, 50, timestamp(), timestamp()))
    end
    return nothing
end

# Runs every time the package is loaded, so timestamps and password salts are fresh.
__init__() = seed!()

function find_user_by_email(email::AbstractString)
    lock(LOCK) do
        index = findfirst(u -> u.email == email, USERS)
        return index === nothing ? nothing : USERS[index]
    end
end

function find_user_by_id(id::Integer)
    lock(LOCK) do
        index = findfirst(u -> u.id == id, USERS)
        return index === nothing ? nothing : USERS[index]
    end
end

function create_user(email::AbstractString, password::AbstractString, name::AbstractString)
    lock(LOCK) do
        user = User(next_id!(:user), email, Auth.hash_password(password), name, "user", timestamp())
        push!(USERS, user)
        return user
    end
end

all_users() = lock(() -> copy(USERS), LOCK)

all_products() = lock(() -> copy(PRODUCTS), LOCK)

function find_product(id::Integer)
    lock(LOCK) do
        index = findfirst(p -> p.id == id, PRODUCTS)
        return index === nothing ? nothing : PRODUCTS[index]
    end
end

function create_product(name::AbstractString, description::AbstractString, price::Real, stock::Integer)
    lock(LOCK) do
        product = Product(next_id!(:product), name, description, Float64(price), Int(stock),
                          timestamp(), timestamp())
        push!(PRODUCTS, product)
        return product
    end
end

"""Update the given fields (\`nothing\` keeps the current value); returns the product or \`nothing\`."""
function update_product(id::Integer; name = nothing, description = nothing, price = nothing, stock = nothing)
    lock(LOCK) do
        index = findfirst(p -> p.id == id, PRODUCTS)
        index === nothing && return nothing
        current = PRODUCTS[index]
        updated = Product(current.id,
                          something(name, current.name),
                          something(description, current.description),
                          price === nothing ? current.price : Float64(price),
                          stock === nothing ? current.stock : Int(stock),
                          current.created_at,
                          timestamp())
        PRODUCTS[index] = updated
        return updated
    end
end

function delete_product(id::Integer)
    lock(LOCK) do
        index = findfirst(p -> p.id == id, PRODUCTS)
        index === nothing && return false
        deleteat!(PRODUCTS, index)
        return true
    end
end

end # module
`,

    'src/api.jl': `"""
Framework-independent request handling. Every handler takes plain values (the raw
request body, a path id, the Authorization header) and returns an HTTP.Response,
so the same logic is wired into the web framework's routes and unit-tested directly.
"""
module Api

using Dates
using HTTP
using JSON3
using ..Auth
using ..Models

const APP_VERSION = "1.0.0"

json_response(data, status::Integer = 200) =
    HTTP.Response(status, ["Content-Type" => "application/json; charset=utf-8"], JSON3.write(data))

error_response(status::Integer, message::AbstractString) = json_response(Dict("error" => message), status)

user_json(user::Models.User) =
    Dict("id" => user.id, "email" => user.email, "name" => user.name, "role" => user.role)

product_json(product::Models.Product) = Dict(
    "id" => product.id,
    "name" => product.name,
    "description" => product.description,
    "price" => product.price,
    "stock" => product.stock,
    "created_at" => product.created_at,
    "updated_at" => product.updated_at,
)

# ---------------------------------------------------------------------------
# Request parsing and validation
# ---------------------------------------------------------------------------

function parse_body(raw)
    text = raw isa AbstractString ? String(raw) : String(copy(raw))
    isempty(strip(text)) && throw(ArgumentError("request body must be a JSON object"))
    return JSON3.read(text, Dict{String,Any})
end

function required_string(data::AbstractDict, key::AbstractString)
    value = get(data, key, nothing)
    (value isa AbstractString && !isempty(strip(value))) || throw(ArgumentError(string(key, " is required")))
    return String(strip(value))
end

function number_field(data::AbstractDict, key::AbstractString, default = nothing)
    haskey(data, key) || return default
    value = data[key]
    value isa Real && !(value isa Bool) && return value
    if value isa AbstractString
        parsed = tryparse(Float64, value)
        parsed !== nothing && return parsed
    end
    throw(ArgumentError(string(key, " must be a number")))
end

function integer_field(data::AbstractDict, key::AbstractString, default = nothing)
    value = number_field(data, key, default)
    value === nothing && return nothing
    (isfinite(value) && value == round(value)) || throw(ArgumentError(string(key, " must be a whole number")))
    return Int(value)
end

"""Run \`f(data)\` on the parsed JSON body, turning bad input into 400 / 422 responses."""
function with_body(f, raw)
    data = try
        parse_body(raw)
    catch
        return error_response(400, "Request body must be a JSON object")
    end
    try
        return f(data)
    catch err
        err isa ArgumentError && return error_response(422, err.msg)
        rethrow()
    end
end

# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------

handle_health() = json_response(Dict("status" => "healthy", "timestamp" => string(Dates.now()), "version" => APP_VERSION))

function handle_register(raw)
    return with_body(raw) do data
        email = required_string(data, "email")
        occursin("@", email) || throw(ArgumentError("email must be a valid address"))
        password = required_string(data, "password")
        length(password) >= 8 || throw(ArgumentError("password must be at least 8 characters"))
        name = required_string(data, "name")
        Models.find_user_by_email(email) === nothing || return error_response(409, "Email already registered")
        user = Models.create_user(email, password, name)
        token = Auth.issue_token(user.id, user.email, user.role)
        return json_response(Dict("token" => token, "user" => user_json(user)), 201)
    end
end

function handle_login(raw)
    return with_body(raw) do data
        email = required_string(data, "email")
        password = required_string(data, "password")
        user = Models.find_user_by_email(email)
        if user === nothing || !Auth.verify_password(password, user.password_hash)
            return error_response(401, "Invalid credentials")
        end
        token = Auth.issue_token(user.id, user.email, user.role)
        return json_response(Dict("token" => token, "user" => user_json(user)))
    end
end

"""Return the user behind an \`Authorization: Bearer <token>\` header."""
function handle_me(authorization::AbstractString)
    token = Auth.bearer_token(authorization)
    claims = token === nothing ? nothing : Auth.verify_token(token)
    claims === nothing && return error_response(401, "Missing or invalid bearer token")
    user = Models.find_user_by_id(claims["sub"])
    user === nothing && return error_response(401, "Unknown user")
    return json_response(Dict("user" => user_json(user)))
end

function handle_list_products()
    products = [product_json(p) for p in Models.all_products()]
    return json_response(Dict("products" => products, "count" => length(products)))
end

function handle_get_product(id::Integer)
    product = Models.find_product(id)
    product === nothing && return error_response(404, "Product not found")
    return json_response(Dict("product" => product_json(product)))
end

function handle_create_product(raw)
    return with_body(raw) do data
        name = required_string(data, "name")
        price = number_field(data, "price")
        price === nothing && throw(ArgumentError("price is required"))
        price >= 0 || throw(ArgumentError("price must not be negative"))
        description = string(get(data, "description", ""))
        stock = integer_field(data, "stock", 0)
        stock >= 0 || throw(ArgumentError("stock must not be negative"))
        product = Models.create_product(name, description, price, stock)
        return json_response(Dict("product" => product_json(product)), 201)
    end
end

function handle_update_product(id::Integer, raw)
    return with_body(raw) do data
        name = haskey(data, "name") ? required_string(data, "name") : nothing
        description = haskey(data, "description") ? string(data["description"]) : nothing
        price = number_field(data, "price")
        price === nothing || price >= 0 || throw(ArgumentError("price must not be negative"))
        stock = integer_field(data, "stock")
        stock === nothing || stock >= 0 || throw(ArgumentError("stock must not be negative"))
        product = Models.update_product(id; name, description, price, stock)
        product === nothing && return error_response(404, "Product not found")
        return json_response(Dict("product" => product_json(product)))
    end
end

function handle_delete_product(id::Integer)
    Models.delete_product(id) || return error_response(404, "Product not found")
    return HTTP.Response(204)
end

# ---------------------------------------------------------------------------
# GraphQL: a deliberately small executor for the schema
#   type Query { hello: String!  health: String! }
# ---------------------------------------------------------------------------

const GRAPHQL_SCHEMA = "type Query { hello: String! health: String! }"

const GRAPHQL_RESOLVERS = Dict{String,Function}(
    "hello" => () -> "Hello from {{projectName}} GraphQL!",
    "health" => () -> "healthy",
    "__typename" => () -> "Query",
)

"""Names of the fields selected at the top level of a query, e.g. \`{ hello health }\`."""
function selected_fields(query::AbstractString)
    start = findfirst('{', query)
    start === nothing && return String[]
    fields = String[]
    word = IOBuffer()
    depth = 0
    function flush_word!()
        name = String(take!(word))
        (isempty(name) || depth != 1) || push!(fields, name)
        return nothing
    end
    for c in query[start:end]
        if c == '{'
            flush_word!()
            depth += 1
        elseif c == '}'
            flush_word!()
            depth -= 1
        elseif isletter(c) || isdigit(c) || c == '_'
            write(word, c)
        else
            flush_word!()
        end
    end
    flush_word!()
    return fields
end

function execute_graphql(query::AbstractString)
    data = Dict{String,Any}()
    errors = Dict{String,Any}[]
    for field in selected_fields(query)
        resolver = get(GRAPHQL_RESOLVERS, field, nothing)
        if resolver === nothing
            push!(errors, Dict("message" => string("Cannot query field '", field, "' on type 'Query'.")))
        else
            data[field] = resolver()
        end
    end
    result = Dict{String,Any}("data" => data)
    isempty(errors) || (result["errors"] = errors)
    return result
end

function handle_graphql(raw)
    return with_body(raw) do data
        query = get(data, "query", nothing)
        query isa AbstractString || throw(ArgumentError("query is required"))
        return json_response(execute_graphql(query))
    end
end

end # module
`,

    'test/api_tests.jl': `# Unit tests for the framework-independent request handlers; no server is started.
using HTTP
using JSON3
using Test
using {{projectNamePascal}}

const Auth = {{projectNamePascal}}.Auth
const Models = {{projectNamePascal}}.Models
const Api = {{projectNamePascal}}.Api

response_json(response) = JSON3.read(String(copy(response.body)), Dict{String,Any})
to_json(data) = JSON3.write(data)

@testset "Auth" begin
    stored = Auth.hash_password("test-password")
    @test Auth.verify_password("test-password", stored)
    @test !Auth.verify_password("wrong", stored)
    @test stored != Auth.hash_password("test-password")  # salted

    token = Auth.issue_token(7, "someone@example.com", "user")
    claims = Auth.verify_token(token)
    @test claims !== nothing
    @test claims["sub"] == 7
    @test claims["role"] == "user"
    @test Auth.verify_token(token * "x") === nothing
    @test Auth.verify_token("not-a-token") === nothing
    @test Auth.verify_token(Auth.issue_token(7, "someone@example.com", "user"; ttl = -10)) === nothing
    @test Auth.bearer_token("Bearer abc") == "abc"
    @test Auth.bearer_token("Basic abc") === nothing
end

@testset "Models" begin
    Models.seed!()
    @test length(Models.all_users()) == 1
    admin = Models.find_user_by_email("admin@example.com")
    @test admin !== nothing
    @test Auth.verify_password("admin123", admin.password_hash)

    @test length(Models.all_products()) == 2
    @test Models.find_product(1).name == "Sample Product 1"
    created = Models.create_product("Widget", "A widget", 9.5, 3)
    @test created.id == 3
    @test Models.update_product(3; price = 12).price == 12.0
    @test Models.update_product(99; price = 1) === nothing
    @test Models.delete_product(3)
    @test !Models.delete_product(3)
end

@testset "Handlers" begin
    Models.seed!()

    health = Api.handle_health()
    @test health.status == 200
    @test response_json(health)["status"] == "healthy"

    listing = Api.handle_list_products()
    @test response_json(listing)["count"] == 2
    @test Api.handle_get_product(1).status == 200
    @test Api.handle_get_product(404).status == 404

    created = Api.handle_create_product(to_json(Dict("name" => "Gadget", "price" => 19.99, "stock" => 5)))
    @test created.status == 201
    @test response_json(created)["product"]["name"] == "Gadget"
    @test Api.handle_create_product(to_json(Dict("name" => "No price"))).status == 422
    @test Api.handle_create_product("not json").status == 400

    updated = Api.handle_update_product(1, to_json(Dict("price" => 5)))
    @test updated.status == 200
    @test response_json(updated)["product"]["price"] == 5.0
    @test Api.handle_update_product(404, to_json(Dict("price" => 5))).status == 404
    @test Api.handle_delete_product(1).status == 204
    @test Api.handle_delete_product(1).status == 404

    registered = Api.handle_register(to_json(Dict("email" => "new@example.com", "password" => "s3cret-pass", "name" => "New User")))
    @test registered.status == 201
    token = response_json(registered)["token"]
    @test Api.handle_register(to_json(Dict("email" => "new@example.com", "password" => "s3cret-pass", "name" => "New User"))).status == 409
    @test Api.handle_register(to_json(Dict("email" => "bad", "password" => "s3cret-pass", "name" => "X"))).status == 422
    @test Api.handle_login(to_json(Dict("email" => "new@example.com", "password" => "s3cret-pass"))).status == 200
    @test Api.handle_login(to_json(Dict("email" => "new@example.com", "password" => "wrong"))).status == 401
    @test response_json(Api.handle_me("Bearer " * token))["user"]["email"] == "new@example.com"
    @test Api.handle_me("").status == 401
end

@testset "GraphQL" begin
    result = response_json(Api.handle_graphql(to_json(Dict("query" => "{ hello health }"))))
    @test result["data"]["hello"] == "Hello from {{projectName}} GraphQL!"
    @test result["data"]["health"] == "healthy"
    @test Api.selected_fields("query Greeting { hello }") == ["hello"]
    @test response_json(Api.handle_graphql(to_json(Dict("query" => "{ missing }"))))["errors"][1]["message"] == "Cannot query field 'missing' on type 'Query'."
    @test Api.handle_graphql(to_json(Dict("nope" => 1))).status == 422
end
`,

    'test/runtests.jl': `using Genie
using HTTP
using JSON3
using Test
using {{projectNamePascal}}

include("api_tests.jl")

# Registers every route, exactly as \`julia app.jl\` does.
include(joinpath(@__DIR__, "..", "app.jl"))

# Every request is bounded, so a stuck server fails the test run instead of hanging it.
const REQUEST_OPTIONS = (status_exception = false, retry = false, connect_timeout = 10, readtimeout = 60)

@testset "Genie server" begin
    {{projectNamePascal}}.Models.seed!()
    port = 8099
    base = string("http://127.0.0.1:", port)
    json_headers = ["Content-Type" => "application/json"]
    up(port, "127.0.0.1"; async = true)
    try
        ready = false
        # The first request compiles the whole request path, so allow it several seconds.
        for _ in 1:120
            try
                HTTP.get(string(base, "/api/v1/health"); retry = false, connect_timeout = 5, readtimeout = 5)
                ready = true
                break
            catch
                sleep(0.5)
            end
        end
        @test ready

        health = HTTP.get(string(base, "/api/v1/health"); REQUEST_OPTIONS...)
        @test health.status == 200
        @test JSON3.read(String(health.body), Dict{String,Any})["status"] == "healthy"

        product = HTTP.get(string(base, "/api/v1/products/1"); REQUEST_OPTIONS...)
        @test product.status == 200
        @test JSON3.read(String(product.body), Dict{String,Any})["product"]["id"] == 1
        @test HTTP.get(string(base, "/api/v1/products/999"); REQUEST_OPTIONS...).status == 404

        created = HTTP.post(string(base, "/api/v1/products"), json_headers,
                            JSON3.write(Dict("name" => "Gadget", "price" => 19.99)); REQUEST_OPTIONS...)
        @test created.status == 201

        login = HTTP.post(string(base, "/api/v1/auth/login"), json_headers,
                          JSON3.write(Dict("email" => "admin@example.com", "password" => "admin123")); REQUEST_OPTIONS...)
        @test login.status == 200
        token = JSON3.read(String(login.body), Dict{String,Any})["token"]
        me = HTTP.get(string(base, "/api/v1/auth/me"), ["Authorization" => string("Bearer ", token)]; REQUEST_OPTIONS...)
        @test me.status == 200

        graphql = HTTP.post(string(base, "/graphql"), json_headers,
                            JSON3.write(Dict("query" => "{ hello }")); REQUEST_OPTIONS...)
        @test graphql.status == 200
        @test JSON3.read(String(graphql.body), Dict{String,Any})["data"]["hello"] == "Hello from {{projectName}} GraphQL!"
    finally
        down()
    end
end
`,

    'Project.toml': `name = "{{projectNamePascal}}"
uuid = "7aff8253-b25e-4fe5-a582-86125ce6d5de"
authors = ["{{author}}"]
version = "0.1.0"

[deps]
Base64 = "2a0f44e3-6c83-55bd-87e4-b1978d98bd5f"
Dates = "ade2ca70-3891-5945-98fb-dc099432e06a"
Genie = "c43c736e-a2d1-11e8-161f-af95117fbd1e"
HTTP = "cd3eb016-35fb-5094-929b-558a96fad6f3"
JSON3 = "0f8b85d8-7281-11e9-16c2-39a750bddbf1"
SHA = "ea8e919c-243c-51af-8825-aaa63cd721ce"

[compat]
Genie = "5"
HTTP = "1"
JSON3 = "1"
julia = "1.10"

[extras]
Test = "8dfed614-e22c-5e08-85e1-65c5234f0b40"

[targets]
test = ["Test"]
`,

    'Dockerfile': `FROM julia:1.11

WORKDIR /app

# Resolve and precompile dependencies first so this layer is cached between code changes.
COPY Project.toml ./
RUN mkdir src && echo 'module {{projectNamePascal}}; end' > src/{{projectNamePascal}}.jl \\
    && julia --project=. -e 'using Pkg; Pkg.instantiate()'

COPY . .
RUN julia --project=. -e 'using Pkg; Pkg.instantiate(); Pkg.precompile()'

ENV PORT=8000
EXPOSE 8000

CMD ["julia", "--project=.", "app.jl"]
`,

    'docker-compose.yml': `services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - JWT_SECRET=change-me-in-production
    restart: unless-stopped
`,

    'README.md': `# {{projectName}}

Web API built with [Genie.jl](https://genieframework.com), the Julia web framework.

## Features

- **Genie**: routing with typed path parameters (\`/products/:id::Int\`)
- **Authentication**: salted password hashes and HS256-signed bearer tokens (set \`JWT_SECRET\`)
- **Validation**: malformed bodies return 400, invalid fields return 422
- **CORS**: configured through \`Genie.config.cors_headers\`
- **GraphQL**: a minimal executor for \`type Query { hello: String! health: String! }\`
- **Storage**: in-memory (replace \`src/models.jl\` with a database layer, for example SearchLight, for persistence)

## Requirements

- Julia 1.10 or newer

## Quick start

\`\`\`bash
# Install dependencies
julia --project=. -e 'using Pkg; Pkg.instantiate()'

# Run the application (PORT defaults to 8000)
julia --project=. app.jl
\`\`\`

Visit http://localhost:8000. A demo admin exists: \`admin@example.com\` / \`admin123\`.

## API endpoints

- \`GET /api/v1/health\` - Health check
- \`POST /api/v1/auth/register\` - Register (\`email\`, \`password\` of 8+ characters, \`name\`)
- \`POST /api/v1/auth/login\` - Login
- \`GET /api/v1/auth/me\` - Current user (\`Authorization: Bearer <token>\`)
- \`GET /api/v1/products\` - List products
- \`GET /api/v1/products/:id\` - Get product by ID
- \`POST /api/v1/products\` - Create product (\`name\`, \`price\`, optional \`description\`, \`stock\`)
- \`PUT /api/v1/products/:id\` - Update product
- \`DELETE /api/v1/products/:id\` - Delete product
- \`POST /graphql\` - GraphQL, e.g. \`{"query": "{ hello health }"}\`

## Testing

\`\`\`bash
julia --project=. -e 'using Pkg; Pkg.test()'
\`\`\`

## Project structure

\`\`\`
app.jl             # Genie routes and server start
src/
  {{projectNamePascal}}.jl  # Package module
  auth.jl          # Password hashing and tokens
  models.jl        # Users and products
  api.jl           # Request handlers and GraphQL executor
test/              # Handler unit tests and a live server test
\`\`\`

## License

MIT
`,
  },
};
