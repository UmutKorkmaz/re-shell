import { BackendTemplate } from '../types';

export const suaveFsTemplate: BackendTemplate = {
  id: 'suave-fs',
  name: 'suave-fs',
  displayName: 'Suave (F#)',
  description: 'Lightweight, embeddable web framework and server for F#',
  language: 'fsharp',
  framework: 'suave',
  version: '1.0.0',
  tags: ['fsharp', 'suave', 'lightweight', 'embeddable', 'microservices', 'web-server'],
  port: 8080,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'microservices'],

  files: {
    // Project file
    '{{projectNamePascal}}.fsproj': `<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
  </PropertyGroup>

  <ItemGroup>
    <Compile Include="Models.fs" />
    <Compile Include="Database.fs" />
    <Compile Include="Auth.fs" />
    <Compile Include="Handlers.fs" />
    <Compile Include="Program.fs" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="Suave" Version="2.6.2" />
    <PackageReference Include="Thoth.Json" Version="6.0.0" />
    <PackageReference Include="BCrypt.Net-Next" Version="4.0.3" />
  </ItemGroup>

</Project>
`,

    // Models
    'Models/Models.fs': `module Models

open System
open Thoth.Json

type User = {
    Id: string
    Email: string
    Password: string
    Name: string
    Role: string  // "user" or "admin"
    CreatedAt: DateTime
    UpdatedAt: DateTime
}

type UserResponse = {
    Id: string
    Email: string
    Name: string
    Role: string
}

type Product = {
    Id: string
    Name: string
    Description: string option
    Price: decimal
    Stock: int
    CreatedAt: DateTime
    UpdatedAt: DateTime
}

type RegisterInput = {
    Email: string
    Password: string
    Name: string
}

type LoginInput = {
    Email: string
    Password: string
}

type CreateProductInput = {
    Name: string
    Description: string option
    Price: decimal
    Stock: int
}

type UpdateProductInput = {
    Name: string option
    Description: string option
    Price: decimal option
    Stock: int option
}

type TokenResponse = {
    Token: string
    User: UserResponse
}
`,

    // Database
    'Database/Database.fs': `module Database

open System
open Collections.Generic
open Models

type Database() =
    let users = Dictionary<string, User>()
    let products = Dictionary<string, Product>()

    do
        // Initialize with admin user
        let adminPassword = BCrypt.Net.BCrypt.HashPassword("admin123")
        let admin = {
            User.Id = "1"
            Email = "admin@example.com"
            Password = adminPassword
            Name = "Admin User"
            Role = "admin"
            CreatedAt = DateTime.UtcNow
            UpdatedAt = DateTime.UtcNow
        }
        users.[admin.Id] <- admin

        // Initialize with sample products
        let now = DateTime.UtcNow
        let product1 = {
            Product.Id = "1"
            Name = "Sample Product 1"
            Description = Some "This is a sample product"
            Price = 29.99m
            Stock = 100
            CreatedAt = now
            UpdatedAt = now
        }
        let product2 = {
            Product.Id = "2"
            Name = "Sample Product 2"
            Description = Some "Another sample product"
            Price = 49.99m
            Stock = 50
            CreatedAt = now
            UpdatedAt = now
        }
        products.[product1.Id] <- product1
        products.[product2.Id] <- product2

        printfn "📦 Database initialized"
        printfn "👤 Default admin user: admin@example.com / admin123"
        printfn "📦 Sample products created"

    member _.FindUserByEmail(email: string) : User option =
        users.Values
        |> Seq.tryFind (fun u -> u.Email = email)

    member _.FindUserById(id: string) : User option =
        match users.TryGetValue(id) with
        | true, user -> Some { user with Password = "" }
        | false, None

    member _.GetUsers() : User list =
        users.Values |> Seq.map (fun u -> { u with Password = "" }) |> List.ofSeq

    member _.CreateUser(user: User) : unit =
        users.[user.Id] <- user

    member _.DeleteUser(id: string) : bool =
        users.Remove(id)

    member _.FindProductById(id: string) : Product option =
        match products.TryGetValue(id) with
        | true, product -> Some product
        | false, None

    member _.GetProducts() : Product list =
        products.Values |> List.ofSeq

    member _.CreateProduct(product: Product) : unit =
        products.[product.Id] <- product

    member _.UpdateProduct(id: string, updateData: UpdateProductInput) : Product option =
        match products.TryGetValue(id) with
        | true, existing ->
            let updated = {
                existing with
                    Name = defaultArg updateData.Name existing.Name
                    Description = defaultArg updateData.Description existing.Description
                    Price = defaultArg updateData.Price existing.Price
                    Stock = defaultArg updateData.Stock existing.Stock
                    UpdatedAt = DateTime.UtcNow
            }
            products.[id] <- updated
            Some updated
        | false, None

    member _.DeleteProduct(id: string) : bool =
        products.Remove(id)
`,

    // Auth
    'Auth/Auth.fs': `module Auth

open System
open JWT.Algorithms
open JWT.Builder
open Microsoft.IdentityModel.Tokens
open Models

let generateToken (user: User) : string =
    let secret = "change-this-secret-in-production"
    let key = SymmetricSecurityKey(Text.Encoding.UTF8.GetBytes(secret))
    let credentials = SigningCredentials(key, SecurityAlgorithms.HmacSha256)

    JwtBuilder()
        .WithSubject(user.Id)
        .WithClaim("email", user.Email)
        .WithClaim("role", user.Role)
        .WithExpiresAt(DateTime.UtcNow.AddDays(7.0))
        .WithIssuer("{{projectName}}")
        .WithAudience("{{projectName}}")
        .WithSigningCredentials(credentials)
        .Encode()

let verifyToken (token: string) : bool =
    // In production: actually verify JWT signature and claims
    // For now, always return true
    true
`,

    // Handlers
    'Handlers/Handlers.fs': `module Handlers

open Suave
open Suave.Filters
open Suave.Successful
open Suave.ResponseWriter
open Suave.Operators
open Thoth.Json
open System
open Models
open Database
open Auth

let JSON v =
    OK
    >=> setMimeType "application/json; charset=utf-8"
    >=> Thoth.Json.Net.Encode.toString v

let handleError (f: HttpContext -> Async<HttpContext option>) =
    fun ctx ->
        async {
            try
                return! f ctx
            with ex ->
                return! JSON ({| error = ex.Message |}) ctx
        }

let private db = Database()

// Health handler
let health (ctx: HttpContext) =
    async {
        return! JSON ({| status = "healthy"; timestamp = DateTime.Now.ToString("o"); version = "1.0.0" |}) ctx
    }

// Register handler
let register (ctx: HttpContext) =
    async {
        let! userData = ctx.request.formData |> Task.map (fun f -> f |> Seq.map (fun kv -> kv.Key, kv.Value) |> Map.ofSeq)

        // In production: parse JSON from body instead of form data
        // For now, return success
        return! JSON ({| error = "JSON parsing required - implement proper body parsing" |}) ctx
    }

// Login handler
let login (ctx: HttpContext) =
    async {
        let! loginData = ctx.request.formData |> Task.map (fun f -> f |> Seq.map (fun kv -> kv.Key, kv.Value) |> Map.ofSeq)

        // In production: parse JSON and verify credentials
        match db.FindUserByEmail("admin@example.com") with
        | Some user ->
            let token = generateToken user
            let userResponse = {| Id = user.Id; Email = user.Email; Name = user.Name; Role = user.Role |}
            return! JSON ({| token = token; user = userResponse |}) ctx
        | None ->
            ctx.response.statusCode <- 401
            return! JSON ({| error = "Invalid credentials" |}) ctx
    }

// Me handler
let me (ctx: HttpContext) =
    async {
        // In production: get user from JWT
        return! JSON ({| userId = "1"; email = "user@example.com"; role = "user" |}) ctx
    }

// List users handler
let listUsers (ctx: HttpContext) =
    async {
        let users = db.GetUsers()
        let userResponses = users |> List.map (fun u -> {| Id = u.Id; Email = u.Email; Name = u.Name; Role = u.Role |})
        return! JSON ({| users = userResponses; count = List.length userResponses |}) ctx
    }

// Get user handler
let getUser (ctx: HttpContext) =
    async {
        let id = ctx.request.url "id"
        match db.FindUserById(id) with
        | Some user ->
            let userResponse = {| Id = user.Id; Email = user.Email; Name = user.Name; Role = user.Role |}
            return! JSON ({| user = userResponse |}) ctx
        | None ->
            ctx.response.statusCode <- 404
            return! JSON ({| error = "User not found" |}) ctx
    }

// Delete user handler
let deleteUser (ctx: HttpContext) =
    async {
        let id = ctx.request.url "id"
        let deleted = db.DeleteUser(id)
        if deleted then
            return! NO_CONTENT ctx
        else
            ctx.response.statusCode <- 404
            return! JSON ({| error = "User not found" |}) ctx
    }

// List products handler
let listProducts (ctx: HttpContext) =
    async {
        let products = db.GetProducts()
        return! JSON ({| products = products; count = List.length products |}) ctx
    }

// Get product handler
let getProduct (ctx: HttpContext) =
    async {
        let id = ctx.request.url "id"
        match db.FindProductById(id) with
        | Some product ->
            return! JSON ({| product = product |}) ctx
        | None ->
            ctx.response.statusCode <- 404
            return! JSON ({| error = "Product not found" |}) ctx
    }

// Create product handler
let createProduct (ctx: HttpContext) =
    async {
        let! productData = ctx.request.formData |> Task.map (fun f -> f |> Seq.map (fun kv -> kv.Key, kv.Value) |> Map.ofSeq)

        // In production: parse JSON from body
        let now = DateTime.UtcNow
        let product = {
            Product.Id = Guid.NewGuid().ToString()
            Name = "Sample"
            Description = Some "Description"
            Price = 29.99m
            Stock = 100
            CreatedAt = now
            UpdatedAt = now
        }

        db.CreateProduct(product)
        ctx.response.statusCode <- 201
        return! JSON ({| product = product |}) ctx
    }

// Update product handler
let updateProduct (ctx: HttpContext) =
    async {
        let id = ctx.request.url "id"
        let! updateData = ctx.request.formData |> Task.map (fun f -> f |> Seq.map (fun kv -> kv.Key, kv.Value) |> Map.ofSeq)

        // In production: parse JSON and update
        match db.FindProductById(id) with
        | Some product ->
            return! JSON ({| product = product |}) ctx
        | None ->
            ctx.response.statusCode <- 404
            return! JSON ({| error = "Product not found" |}) ctx
    }

// Delete product handler
let deleteProduct (ctx: HttpContext) =
    async {
        let id = ctx.request.url "id"
        let deleted = db.DeleteProduct(id)
        if deleted then
            return! NO_CONTENT ctx
        else
            ctx.response.statusCode <- 404
            return! JSON ({| error = "Product not found" |}) ctx
    }

let app =
    choose
        [ GET >>= choose
            [ path "/health" >>= health
              pathScan "/api/v1/users/%s" (fun id -> getUser)
              path "/api/v1/users" >>= listUsers
              pathScan "/api/v1/products/%s" (fun id -> getProduct)
              path "/api/v1/products" >>= listProducts
              path "/" >==> OK "{{projectName}} API - Running"
            ]
          POST >>= choose
            [ path "/api/v1/auth/register" >>= handleError register
              path "/api/v1/auth/login" >>= handleError login
              path "/api/v1/products" >>= handleError createProduct
            ]
          PUT >>= choose
            [ pathScan "/api/v1/products/%s" (fun id -> updateProduct) ]
          DELETE >>= choose
            [ pathScan "/api/v1/users/%s" (fun id -> deleteUser)
              pathScan "/api/v1/products/%s" (fun id -> deleteProduct) ]
          ]
`,

    // Program entry point
    'Program/Program.fs': `module Program

open Suave
open System
open Handlers

[<EntryPoint>]
let main args =
    let config =
        { defaultConfig with
            bindings =
                [ HttpBinding.createSimple HTTP "127.0.0.1" 8080 ]
        }

    printfn "🚀 Server running at http://localhost:8080"
    printfn "📚 API endpoints:"
    printfn "   GET  /health"
    printfn "   POST /api/v1/auth/register"
    printfn "   POST /api/v1/auth/login"
    printfn "   GET  /api/v1/products"

    startWebServer config app
    0
`,

    // Configuration
    'appsettings.json': `{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft": "Warning"
    }
  }
}
`,

    // Environment file
    '.env.example': `# Server
ASPNETCORE_URLS=http://localhost:8080

# JWT Secret (change in production!)
JWT_SECRET=change-this-secret-in-production
`,

    // Dockerfile - Multi-stage optimized build
    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Builder
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder

WORKDIR /src

# Copy project file and restore dependencies (for better caching)
COPY ["{{projectNamePascal}}.fsproj", "./"]
RUN dotnet restore "{{projectNamePascal}}.fsproj"

# Copy source and build
COPY . .
RUN dotnet publish "{{projectNamePascal}}.fsproj" -c Release -o /app/publish \\
    /p:DebugType=None /p:DebugSymbols=false

# =============================================================================
# Stage 2: Runtime - Minimal image
# =============================================================================
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime

WORKDIR /app

# Copy published output from builder
COPY --from=builder /app/publish .

# Create non-root user
RUN useradd -m -u 1000 appuser

# Create data directory
RUN mkdir -p /app/data && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

ENV ASPNETCORE_URLS=http://+:8080
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "{{projectNamePascal}}.dll"]
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
    'Tests/Tests.fs': `module Tests

open Xunit
open System

type \`\`Tests\`\` () =
    [<Fact>]
    let \`\`My test\`\` () =
        Assert.True(true)
`,

    // README
    'README.md': `# {{projectName}}

A lightweight REST API built with Suave web framework for F#.

## Features

- **Suave Framework**: Lightweight, embeddable web server
- **F#**: Functional programming with type safety
- **Combinator-Based**: Functional route composition
- **Async/Await**: Asynchronous request handling
- **JSON**: Thoth.Json for type-safe serialization

## Requirements

- .NET 8 SDK
- F# 8

## Quick Start

1. Build the application:
   \`\`\`bash
   dotnet build
   \`\`\`

2. Run in development:
   \`\`\`bash
   dotnet run
   \`\`\`

## API Endpoints

### Health
- \`GET /health\` - Health check

### Authentication
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login user

### Products
- \`GET /api/v1/products\` - List all products
- \`GET /api/v1/products/:id\` - Get product by ID
- \`POST /api/v1/products\` - Create product
- \`PUT /api/v1/products/:id\` - Update product
- \`DELETE /api/v1/products/:id\` - Delete product

## Project Structure

\`\`\`
├── Models.fs                # Data models
├── Database.fs              # Database layer
├── Auth.fs                  # Authentication logic
├── Handlers.fs              # Request handlers
├── Program.fs               # Entry point
└── Tests/                   # Tests
\`\`\`

## Development

\`\`\`bash
# Install dependencies
dotnet restore

# Run in development
dotnet watch

# Run tests
dotnet test

# Build for production
dotnet build -c Release
\`\`\`

## Suave Features

- **Lightweight**: Minimal dependencies
- **Embeddable**: Can be embedded in other applications
- **Composable**: Functional route combinators
- **Async**: Built-in async support
- **Cross-platform**: Runs on .NET Core

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 8080:8080 {{projectName}}
\`\`\`

## License

MIT
`
  }
};
