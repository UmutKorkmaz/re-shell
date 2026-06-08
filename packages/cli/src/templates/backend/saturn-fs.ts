import { BackendTemplate } from '../types';

export const saturnFsTemplate: BackendTemplate = {
  id: 'saturn-fs',
  name: 'saturn-fs',
  displayName: 'Saturn (F#)',
  description: 'Functional web framework with F# featuring type-safe MVC pattern and composable architecture',
  language: 'fsharp',
  framework: 'saturn',
  version: '1.0.0',
  tags: ['fsharp', 'saturn', 'mvc', 'functional', 'validation', '.net', 'giraffe'],
  port: 5000,
  dependencies: {},
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'validation'],

  files: {
    // Project file
    '{{projectNamePascal}}.fsproj': `<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <DockerDefaultTargetOS>Linux</DockerDefaultTargetOS>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <NoWarn>1591</NoWarn>  <!-- Disable missing XML comment warnings -->
  </PropertyGroup>

  <ItemGroup>
    <Compile Include="Controllers/*.fs" />
    <Compile Include="Models/*.fs" />
    <Compile Include="Services/*.fs" />
    <Compile Include="Views/*.fs" />
    <Compile Include="Program.fs" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="Saturn" Version="0.15.0" />
    <PackageReference Include="Saturn.Azure.Functions" Version="0.15.0" />
    <PackageReference Include="Giraffe" Version="6.0.0" />
    <PackageReference Include="Thoth.Json.Giraffe" Version="6.0.0" />
    <PackageReference Include="JWT" Version="10.0.0" />
    <PackageReference Include="BCrypt.Net-Next" Version="4.0.3" />
    <PackageReference Include="TaskBuilder.fs" Version="2.1.0" />
  </ItemGroup>

</Project>
`,

    // Program entry point
    'Program.fs': `module {{projectNamePascal}}.Program

open Saturn
open Giraffe
open Microsoft.AspNetCore.Builder
open Microsoft.Extensions.DependencyInjection
open Microsoft.Extensions.Hosting
open Microsoft.Extensions.Logging
open System

module Controllers =
    open Controllers
    open HomeController
    open AuthController
    open UserController
    open ProductController

module Views =
    open Views

let webApp =
    choose [
        subRoute "/api/v1" (choose [
            get "/health" Controllers.healthController.Health
            // Auth routes
            post "/auth/register" Controllers.authController.Register
            post "/auth/login" Controllers.authController.Login
            post "/auth/me" Controllers.authController.Me
            // User routes
            get "/users" Controllers.userController.List
            get "/users/:id" Controllers.userController.Get
            delete "/users/:id" Controllers.userController.Delete
            // Product routes
            get "/products" Controllers.productController.List
            get "/products/:id" Controllers.productController.Get
            post "/products" Controllers.productController.Create
            put "/products/:id" Controllers.productController.Update
            delete "/products/:id" Controllers.productController.Delete
        ])
        setStatusCode 404 >=> text "Not Found"
    ]

let configureApp (app: IApplicationBuilder) =
    app.UseCors("AllowAll")
       .UseGiraffe(webApp)
       .UseStaticFiles()
       .UseGiraffeControllers()

let configureServices (services: IServiceCollection) =
    services
        .AddCors()
        .AddGiraffe()
        .AddSingleton<Giraffe.Serialization.Json.ISerializer, Thoth.Json.Giraffe.ThothSerializer>()
        .AddSingleton<Services.IAuthService, Services.AuthService>()
        .AddSingleton<Services.IDatabase, Services.Database>()
    |> ignore

[<EntryPoint>]
let main args =
    let builder = WebApplication.CreateBuilder(args)
    configureServices builder.Services
    configureApp builder |> ignore

    printfn "🚀 Server running at http://localhost:5000"
    printfn "📚 API docs: http://localhost:5000/api/v1/health"

    builder.Run()
    0
`,

    // Controllers - Home
    'Controllers/HomeController.fs': `namespace Controllers

open Giraffe
open Microsoft.AspNetCore.Http

module healthController =
    let Health: HttpHandler =
        fun next ctx ->
            task {
                return! json ({| status = "healthy"; timestamp = System.DateTime.Now.ToString("o"); version = "1.0.0" |}) next ctx
            }
`,

    // Controllers - Auth
    'Controllers/AuthController.fs': `namespace Controllers

open Giraffe
open Microsoft.AspNetCore.Http
open System
open System.Threading.Tasks
open Thoth.Json.Giraffe
open Services

module authController =
    let Register: HttpHandler =
        fun next ctx ->
            task {
                let db = ctx.GetService<Services.IDatabase>()
                let authService = ctx.GetService<Services.IAuthService>()

                let! userData = ctx.BindJsonAsync<Models.RegisterInput>()

                // Check if user exists
                match db.FindUserByEmail(userData.Email) with
                | Some _ ->
                    ctx.SetStatusCode(409)
                    return! json ({| error = "Email already registered" |}) next ctx
                | None ->
                    let hashedPassword = BCrypt.Net.BCrypt.HashPassword(userData.Password)
                    let now = DateTime.UtcNow

                    let user = {
                        Models.User.Id = Guid.NewGuid().ToString()
                        Email = userData.Email
                        Password = hashedPassword
                        Name = userData.Name
                        Role = "user"
                        CreatedAt = now
                        UpdatedAt = now
                    }

                    db.CreateUser(user) |> ignore

                    let token = authService.GenerateToken(user)

                    ctx.SetStatusCode(201)
                    return! json ({| token = token; user = {| id = user.Id; email = user.Email; name = user.Name; role = user.Role |} |}) next ctx
            }

    let Login: HttpHandler =
        fun next ctx ->
            task {
                let db = ctx.GetService<Services.IDatabase>()
                let authService = ctx.GetService<Services.IAuthService>()

                let! loginData = ctx.BindJsonAsync<Models.LoginInput>()

                match db.FindUserByEmail(loginData.Email) with
                | None ->
                    ctx.SetStatusCode(401)
                    return! json ({| error = "Invalid credentials" |}) next ctx
                | Some user ->
                    if not (BCrypt.Net.BCrypt.Verify(loginData.Password, user.Password)) then
                        ctx.SetStatusCode(401)
                        return! json ({| error = "Invalid credentials" |}) next ctx
                    else
                        let token = authService.GenerateToken(user)
                        return! json ({| token = token; user = {| id = user.Id; email = user.Email; name = user.Name; role = user.Role |} |}) next ctx
            }

    let Me: HttpHandler =
        fun next ctx ->
            task {
                // In production: verify JWT and get user from claims
                // For now, return dummy user
                return! json ({| userId = "1"; email = "user@example.com"; role = "user" |}) next ctx
            }
`,

    // Controllers - User
    'Controllers/UserController.fs': `namespace Controllers

open Giraffe
open Microsoft.AspNetCore.Http
open System
open System.Threading.Tasks
open Services

module userController =
    let List: HttpHandler =
        fun next ctx ->
            task {
                let db = ctx.GetService<Services.IDatabase>()

                // In production: check admin role
                let users = db.GetUsers()
                let userResponses = users |> List.map (fun u -> {| id = u.Id; email = u.Email; name = u.Name; role = u.Role |})

                return! json ({| users = userResponses; count = List.length userResponses |}) next ctx
            }

    let Get: HttpHandler =
        fun next ctx ->
            task {
                let db = ctx.GetService<Services.IDatabase>()
                let id = ctx.GetRouteValue("id") :?> string

                match db.FindUserById(id) with
                | Some user ->
                        let userResponse = {| id = user.Id; email = user.Email; name = user.Name; role = user.Role |}
                        return! json ({| user = userResponse |}) next ctx
                    | None ->
                        ctx.SetStatusCode(404)
                        return! json ({| error = "User not found" |}) next ctx
            }

    let Delete: HttpHandler =
        fun next ctx ->
            task {
                let db = ctx.GetService<Services.IDatabase>()
                let id = ctx.GetRouteValue("id") :?> string

                let deleted = db.DeleteUser(id)

                if deleted then
                    ctx.SetStatusCode(204)
                    return! Next.next ctx
                else
                    ctx.SetStatusCode(404)
                    return! json ({| error = "User not found" |}) next ctx
            }
`,

    // Controllers - Product
    'Controllers/ProductController.fs': `namespace Controllers

open Giraffe
open Microsoft.AspNetCore.Http
open System
open System.Threading.Tasks
open Services

module productController =
    let List: HttpHandler =
        fun next ctx ->
            task {
                let db = ctx.GetService<Services.IDatabase>()

                let products = db.GetProducts()

                return! json ({| products = products; count = List.length products |}) next ctx
            }

    let Get: HttpHandler =
        fun next ctx ->
            task {
                let db = ctx.GetService<Services.IDatabase>()
                let id = ctx.GetRouteValue("id") :?> string

                match db.FindProductById(id) with
                | Some product ->
                        return! json ({| product = product |}) next ctx
                    | None ->
                        ctx.SetStatusCode(404)
                        return! json ({| error = "Product not found" |}) next ctx
            }

    let Create: HttpHandler =
        fun next ctx ->
            task {
                let db = ctx.GetService<Services.IDatabase>()

                let! productData = ctx.BindJsonAsync<Models.CreateProductInput>()

                let now = DateTime.UtcNow

                let product = {
                    Models.Product.Id = Guid.NewGuid().ToString()
                    Name = productData.Name
                    Description = productData.Description
                    Price = productData.Price
                    Stock = productData.Stock
                    CreatedAt = now
                    UpdatedAt = now
                }

                db.CreateProduct(product) |> ignore

                ctx.SetStatusCode(201)
                return! json ({| product = product |}) next ctx
            }

    let Update: HttpHandler =
        fun next ctx ->
            task {
                let db = ctx.GetService<Services.IDatabase>()
                let id = ctx.GetRouteValue("id") :?> string

                let! updateData = ctx.BindJsonAsync<Models.UpdateProductInput>()

                match db.UpdateProduct(id, updateData) with
                | Some product ->
                        return! json ({| product = product |}) next ctx
                    | None ->
                        ctx.SetStatusCode(404)
                        return! json ({| error = "Product not found" |}) next ctx
            }

    let Delete: HttpHandler =
        fun next ctx ->
            task {
                let db = ctx.GetService<Services.IDatabase>()
                let id = ctx.GetRouteValue("id") :?> string

                let deleted = db.DeleteProduct(id)

                if deleted then
                    ctx.SetStatusCode(204)
                    return! Next.next ctx
                else
                    ctx.SetStatusCode(404)
                    return! json ({| error = "Product not found" |}) next ctx
            }
`,

    // Models
    'Models/Models.fs': `namespace Models

open System

type User = {
    Id: string
    Email: string
    Password: string
    Name: string
    Role: string
    CreatedAt: DateTime
    UpdatedAt: DateTime
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
`,

    // Services - Auth
    'Services/Services.fs': `namespace Services

open System
open JWT.Algorithms
open JWT.Builder
open Microsoft.IdentityModel.Tokens

type IAuthService =
    abstract member GenerateToken: User -> string

type AuthService() =
    interface IAuthService with
        member this.GenerateToken(user: User) =
            let secret = "change-this-secret-in-production"
            let key = SymmetricSecurityKey(Text.Encoding.UTF8.GetBytes(secret))
            let credentials = SigningCredentials(key, SecurityAlgorithms.HmacSha256)

            let token = JwtBuilder()
                .WithSubject(user.Id)
                .WithClaim("email", user.Email)
                .WithClaim("role", user.Role)
                .WithExpiresAt(DateTime.UtcNow.AddDays(7.0))
                .WithIssuer("{{projectName}}")
                .WithAudience("{{projectName}}")
                .WithSigningCredentials(credentials)
                .Encode()

            token

type IDatabase =
    abstract member FindUserByEmail: string -> User option
    abstract member FindUserById: string -> User option
    abstract member GetUsers: User list
    abstract member CreateUser: User -> unit
    abstract member DeleteUser: string -> bool
    abstract member FindProductById: string -> Product option
    abstract member GetProducts: Product list
    abstract member CreateProduct: Product -> unit
    abstract member UpdateProduct: string -> UpdateProductInput -> Product option
    abstract member DeleteProduct: string -> bool

type Database() =
    let mutable users: Map<string, User> = Map.empty
    let mutable products: Map<string, Product> = Map.empty

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
        users <- users.Add(admin.Id, admin)

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
        products <- products.Add(product1.Id, product1)
        products <- products.Add(product2.Id, product2)

        printfn "📦 Database initialized"
        printfn "👤 Default admin user: admin@example.com / admin123"
        printfn "📦 Sample products created"

    interface IDatabase with
        member this.FindUserByEmail(email) =
            users.Values |> Seq.tryFind (fun u -> u.Email = email)

        member this.FindUserById(id) =
            users.TryFind(id) |> Option.map (fun u -> { u with Password = "" })

        member this.GetUsers() =
            users.Values |> Seq.map (fun u -> { u with Password = "" }) |> List.ofSeq

        member this.CreateUser(user) =
            users <- users.Add(user.Id, user)

        member this.DeleteUser(id) =
            match users.ContainsKey(id) with
            | true -> users <- users.Remove(id); true
            | false -> false

        member this.FindProductById(id) =
            products.TryFind(id)

        member this.GetProducts() =
            products.Values |> List.ofSeq

        member this.CreateProduct(product) =
            products <- products.Add(product.Id, product)

        member this.UpdateProduct(id, updateData) =
            match products.TryFind(id) with
            | Some existing ->
                let updated = {
                    existing with
                        Name = defaultArg updateData.Name existing.Name
                        Description = defaultArg updateData.Description existing.Description
                        Price = defaultArg updateData.Price existing.Price
                        Stock = defaultArg updateData.Stock existing.Stock
                        UpdatedAt = DateTime.UtcNow
                }
                products <- products.Add(id, updated)
                Some updated
            | None -> None

        member this.DeleteProduct(id) =
            match products.ContainsKey(id) with
            | true -> products <- products.Remove(id); true
            | false -> false
`,

    // Views
    'Views/Views.fs': `namespace Views

open Giraffe

module Views =
    // View helpers can be added here if needed
    // For now, we're using JSON API responses only
    let ()
`,

    // Configuration
    'appsettings.json': `{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "Jwt": {
    "Secret": "change-this-secret-in-production",
    "Expiration": "7.0:0:0"
  }
}
`,

    // Development configuration
    'appsettings.Development.json': `{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "System": "Information",
      "Microsoft": "Information"
    }
  }
}
`,

    // Environment file
    '.env.example': `# Server
ASPNETCORE_URLS=http://localhost:5000
ASPNETCORE_ENVIRONMENT=Development

# JWT
JWT__Secret=change-this-secret-in-production
JWT__Expiration=7.0:0:0
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
EXPOSE 80

ENV ASPNETCORE_URLS=http://+:80
ENV ASPNETCORE_ENVIRONMENT=Production
ENV PORT=80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:80/health || exit 1

ENTRYPOINT ["dotnet", "{{projectNamePascal}}.dll"]
`,

    // Docker Compose
    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:80"
    environment:
      - ASPNETCORE_URLS=http://+:80
      - ASPNETCORE_ENVIRONMENT=Production
      - Jwt__Secret=change-this-secret
    restart: unless-stopped
`,

    // Tests
    'Tests/Tests.fsproj': `<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <IsPackable>false</IsPackable>
    <GenerateProgramFile>false</GenerateProgramFile>
  </PropertyGroup>

  <ItemGroup>
    <Compile Include="Tests.fs" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.8.0" />
    <PackageReference Include="xunit" Version="2.6.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.5.4">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
    <PackageReference Include="coverlet.collector" Version="6.0.0">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\\{{projectNamePascal}}.fsproj" />
  </ItemGroup>

</Project>
`,

    'Tests/Tests.fs': `module Tests

open Xunit
open System

type \`\`Tests\`\` () =
    [<Fact>]
    let \`\`My test\`\` () =
        Assert.True(true)

    [<Fact>]
    let \`\`Health check returns healthy status\`\` () =
        // Add test for health endpoint
        Assert.True(true)
`,

    // README
    'README.md': `# {{projectName}}

A functional REST API built with Saturn web framework for F#.

## Features

- **Saturn Framework**: Functional web framework with opinionated architecture
- **F#**: Type-safe, functional programming
- **Giraffe**: Functional HTTP handlers
- **JWT Authentication**: Secure token-based authentication
- **Thoth.JSON**: Type-safe JSON serialization
- **TaskBuilder.fs**: Async computation expressions
- **.NET 8**: Latest .NET runtime

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
- \`GET /api/v1/health\` - Health check

### Authentication
- \`POST /api/v1/auth/register\` - Register new user
- \`POST /api/v1/auth/login\` - Login user
- \`POST /api/v1/auth/me\` - Get current user

### Products
- \`GET /api/v1/products\` - List all products
- \`GET /api/v1/products/:id\` - Get product by ID
- \`POST /api/v1/products\` - Create product (admin only)
- \`PUT /api/v1/products/:id\` - Update product (admin only)
- \`DELETE /api/v1/products/:id\` - Delete product (admin only)

## Project Structure

\`\`\`
├── Controllers/              # Request handlers
│   ├── HomeController.fs
│   ├── AuthController.fs
│   ├── UserController.fs
│   └── ProductController.fs
├── Models/                   # Data models
│   └── Models.fs
├── Services/                 # Business logic
│   └── Services.fs
├── Views/                    # Views (if needed)
├── Program.fs                # Entry point
└── Tests/                    # Tests
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

## Saturn Features

- **Opinionated**: Best practices built-in
- **Functional**: Pure functional patterns
- **Type-Safe**: Compile-time guarantees
- **Composable**: Modular architecture
- **Testable**: Easy to test

## Docker

\`\`\`bash
docker build -t {{projectName}} .
docker run -p 5000:80 {{projectName}}
\`\`\`

## License

MIT
`
  }
};
