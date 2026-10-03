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
  dependencies: {
    'FSharp.Data.GraphQL': '0.0.16',
  },
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'validation', 'graphql'],

  files: {
    // Project file
    '{{projectNamePascal}}.fsproj': `<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <DockerDefaultTargetOS>Linux</DockerDefaultTargetOS>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <NoWarn>$(NoWarn);1591;FS3370</NoWarn>
  </PropertyGroup>

  <!-- F# compiles files in the order listed here -->
  <ItemGroup>
    <Compile Include="Models/Models.fs" />
    <Compile Include="Services/Services.fs" />
    <Compile Include="GraphQL/Schema.fs" />
    <Compile Include="GraphQL/Resolver.fs" />
    <Compile Include="Controllers/HomeController.fs" />
    <Compile Include="Controllers/AuthController.fs" />
    <Compile Include="Controllers/UserController.fs" />
    <Compile Include="Controllers/ProductController.fs" />
    <Compile Include="Controllers/GraphQLController.fs" />
    <Compile Include="Views/Views.fs" />
    <Compile Include="Program.fs" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="Saturn" Version="0.16.1" />
    <PackageReference Include="Giraffe" Version="6.0.0" />
    <PackageReference Include="FSharp.SystemTextJson" Version="1.3.13" />
    <PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="6.35.0" />
    <PackageReference Include="BCrypt.Net-Next" Version="4.0.3" />
  </ItemGroup>

</Project>
`,

    // Program entry point
    'Program.fs': `module {{projectNamePascal}}.Program

open System
open System.Text.Json
open System.Text.Json.Serialization
open Saturn
open Giraffe
open Microsoft.Extensions.DependencyInjection
open Controllers
open Services

let private jsonOptions =
    let options = JsonSerializerOptions(PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true)
    options.Converters.Add(JsonFSharpConverter(JsonFSharpOptions.Default().WithSkippableOptionFields()))
    options

let authRouter =
    router {
        post "/register" authController.Register
        post "/login" authController.Login
        get "/me" authController.Me
        post "/me" authController.Me
    }

let userRouter =
    router {
        get "" userController.ListAll
        getf "/%s" userController.Get
        deletef "/%s" userController.Delete
    }

let productRouter =
    router {
        get "" productController.ListAll
        getf "/%s" productController.Get
        post "" productController.Create
        putf "/%s" productController.Update
        deletef "/%s" productController.Delete
    }

let apiRouter =
    router {
        get "/health" healthController.Health
        forward "/auth" authRouter
        forward "/users" userRouter
        forward "/products" productRouter
    }

let webApp =
    router {
        not_found_handler (setStatusCode 404 >=> json {| error = "Not Found" |})
        get "/health" healthController.Health
        // GraphQL endpoint
        post "/graphql" graphqlController.GraphQL
        forward "/api/v1" apiRouter
    }

let configureServices (services: IServiceCollection) =
    services
        .AddSingleton<Json.ISerializer>(SystemTextJson.Serializer(jsonOptions))
        .AddSingleton<IAuthService, AuthService>()
        .AddSingleton<IDatabase, Database>()

let app =
    application {
        use_router webApp
        url (
            match Environment.GetEnvironmentVariable "ASPNETCORE_URLS" with
            | null | "" -> "http://0.0.0.0:5000/"
            | urls -> urls
        )
        use_cors "AllowAll" (fun policy -> policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod() |> ignore)
        use_jwt_authentication JwtSettings.secret JwtSettings.issuer
        service_config configureServices
        memory_cache
        use_gzip
    }

[<EntryPoint>]
let main _ =
    run app
    0
`,

    // Controllers - Home
    'Controllers/HomeController.fs': `namespace Controllers

open Giraffe

module healthController =
    let Health: HttpHandler =
        fun next ctx ->
            json ({| status = "healthy"; timestamp = System.DateTime.UtcNow.ToString("o"); version = "1.0.0" |}) next ctx

/// Helpers shared by the controllers.
module Guards =
    open System.Security.Claims
    open Microsoft.AspNetCore.Authentication.JwtBearer
    open Microsoft.AspNetCore.Http

    /// Requires a valid bearer token.
    let requireUser: HttpHandler =
        requiresAuthentication (challenge JwtBearerDefaults.AuthenticationScheme)

    /// Requires a valid bearer token whose role claim is "admin".
    let requireAdmin: HttpHandler =
        requireUser
        >=> fun next (ctx: HttpContext) ->
                if ctx.User.IsInRole "admin" || ctx.User.HasClaim("role", "admin") then
                    next ctx
                else
                    (setStatusCode 403 >=> json {| error = "Admin role required" |}) next ctx

    let claimValue (ctx: HttpContext) (types: string list) =
        types
        |> List.tryPick (fun t -> ctx.User.FindFirst t |> Option.ofObj |> Option.map (fun c -> c.Value))
        |> Option.defaultValue ""
`,

    // Controllers - GraphQL (FSharp.Data.GraphQL)
    'Controllers/GraphQLController.fs': `namespace Controllers

open System.Text.Json
open Giraffe
open GraphQL.Resolver

module graphqlController =
    /// Minimal GraphQL endpoint: Query { hello: String!, health: String! }.
    /// Resolves the top-level fields named in the query text.
    let GraphQL: HttpHandler =
        fun next ctx ->
            task {
                let! body = ctx.ReadBodyFromRequestAsync()

                let query =
                    try
                        use doc = JsonDocument.Parse(body)
                        match doc.RootElement.TryGetProperty "query" with
                        | true, q -> q.GetString()
                        | _ -> ""
                    with :? JsonException -> ""

                let data = System.Collections.Generic.Dictionary<string, string>()
                if query.Contains "hello" then data["hello"] <- helloResolver ()
                if query.Contains "health" then data["health"] <- healthResolver ()

                if data.Count = 0 then
                    return!
                        (setStatusCode 400
                         >=> json {| errors = [ {| message = "Query must select hello and/or health" |} ] |})
                            next ctx
                else
                    return! json {| data = data |} next ctx
            }
`,

    // GraphQL schema (FSharp.Data.GraphQL)
    'GraphQL/Schema.fs': `module GraphQL.Schema

// GraphQL schema served by POST /graphql: Query { hello: String!, health: String! }
let schema = """
type Query {
  hello: String!
  health: String!
}
"""
`,

    // GraphQL resolvers (FSharp.Data.GraphQL)
    'GraphQL/Resolver.fs': `module GraphQL.Resolver

// Resolver for the hello field
let helloResolver () : string =
    "Hello from {{projectName}} GraphQL!"

// Resolver for the health field
let healthResolver () : string =
    "healthy"
`,


    // Controllers - Auth
    'Controllers/AuthController.fs': `namespace Controllers

open Giraffe
open System
open Services

module authController =
    let Register: HttpHandler =
        fun next ctx ->
            task {
                let db = ctx.GetService<IDatabase>()
                let authService = ctx.GetService<IAuthService>()

                let! userData = ctx.BindJsonAsync<Models.RegisterInput>()

                // Check if user exists
                match db.FindUserByEmail(userData.Email) with
                | Some _ ->
                    return! (setStatusCode 409 >=> json {| error = "Email already registered" |}) next ctx
                | None ->
                    let hashedPassword = BCrypt.Net.BCrypt.HashPassword(userData.Password)
                    let now = DateTime.UtcNow

                    let user: Models.User = {
                        Id = Guid.NewGuid().ToString()
                        Email = userData.Email
                        Password = hashedPassword
                        Name = userData.Name
                        Role = "user"
                        CreatedAt = now
                        UpdatedAt = now
                    }

                    db.CreateUser(user)

                    let token = authService.GenerateToken(user)

                    return!
                        (setStatusCode 201
                         >=> json {| token = token; user = {| id = user.Id; email = user.Email; name = user.Name; role = user.Role |} |})
                            next ctx
            }

    let Login: HttpHandler =
        fun next ctx ->
            task {
                let db = ctx.GetService<IDatabase>()
                let authService = ctx.GetService<IAuthService>()

                let! loginData = ctx.BindJsonAsync<Models.LoginInput>()

                match db.FindUserByEmail(loginData.Email) with
                | None ->
                    return! (setStatusCode 401 >=> json {| error = "Invalid credentials" |}) next ctx
                | Some user ->
                    if not (BCrypt.Net.BCrypt.Verify(loginData.Password, user.Password)) then
                        return! (setStatusCode 401 >=> json {| error = "Invalid credentials" |}) next ctx
                    else
                        let token = authService.GenerateToken(user)
                        return! json {| token = token; user = {| id = user.Id; email = user.Email; name = user.Name; role = user.Role |} |} next ctx
            }

    /// Returns the identity carried by the bearer token.
    let Me: HttpHandler =
        Guards.requireUser
        >=> fun next ctx ->
                let userId = Guards.claimValue ctx [ "sub"; System.Security.Claims.ClaimTypes.NameIdentifier ]
                let email = Guards.claimValue ctx [ "email"; System.Security.Claims.ClaimTypes.Email ]
                let role = Guards.claimValue ctx [ "role"; System.Security.Claims.ClaimTypes.Role ]
                json {| userId = userId; email = email; role = role |} next ctx
`,

    // Controllers - User
    'Controllers/UserController.fs': `namespace Controllers

open Giraffe
open Services

module userController =
    let private toResponse (u: Models.User) =
        {| id = u.Id; email = u.Email; name = u.Name; role = u.Role |}

    let ListAll: HttpHandler =
        Guards.requireAdmin
        >=> fun next ctx ->
                let db = ctx.GetService<IDatabase>()
                let users = db.GetUsers() |> List.map toResponse
                json {| users = users; count = List.length users |} next ctx

    let Get (id: string) : HttpHandler =
        Guards.requireAdmin
        >=> fun next ctx ->
                let db = ctx.GetService<IDatabase>()

                match db.FindUserById(id) with
                | Some user -> json {| user = toResponse user |} next ctx
                | None -> (setStatusCode 404 >=> json {| error = "User not found" |}) next ctx

    let Delete (id: string) : HttpHandler =
        Guards.requireAdmin
        >=> fun next ctx ->
                let db = ctx.GetService<IDatabase>()

                if db.DeleteUser(id) then
                    setStatusCode 204 next ctx
                else
                    (setStatusCode 404 >=> json {| error = "User not found" |}) next ctx
`,

    // Controllers - Product
    'Controllers/ProductController.fs': `namespace Controllers

open Giraffe
open System
open Services

module productController =
    let ListAll: HttpHandler =
        fun next ctx ->
            let db = ctx.GetService<IDatabase>()
            let products = db.GetProducts()
            json {| products = products; count = List.length products |} next ctx

    let Get (id: string) : HttpHandler =
        fun next ctx ->
            let db = ctx.GetService<IDatabase>()

            match db.FindProductById(id) with
            | Some product -> json {| product = product |} next ctx
            | None -> (setStatusCode 404 >=> json {| error = "Product not found" |}) next ctx

    let Create: HttpHandler =
        Guards.requireAdmin
        >=> fun next ctx ->
                task {
                    let db = ctx.GetService<IDatabase>()
                    let! productData = ctx.BindJsonAsync<Models.CreateProductInput>()
                    let now = DateTime.UtcNow

                    let product: Models.Product = {
                        Id = Guid.NewGuid().ToString()
                        Name = productData.Name
                        Description = productData.Description
                        Price = productData.Price
                        Stock = productData.Stock
                        CreatedAt = now
                        UpdatedAt = now
                    }

                    db.CreateProduct(product)

                    return! (setStatusCode 201 >=> json {| product = product |}) next ctx
                }

    let Update (id: string) : HttpHandler =
        Guards.requireAdmin
        >=> fun next ctx ->
                task {
                    let db = ctx.GetService<IDatabase>()
                    let! updateData = ctx.BindJsonAsync<Models.UpdateProductInput>()

                    match db.UpdateProduct(id, updateData) with
                    | Some product -> return! json {| product = product |} next ctx
                    | None -> return! (setStatusCode 404 >=> json {| error = "Product not found" |}) next ctx
                }

    let Delete (id: string) : HttpHandler =
        Guards.requireAdmin
        >=> fun next ctx ->
                let db = ctx.GetService<IDatabase>()

                if db.DeleteProduct(id) then
                    setStatusCode 204 next ctx
                else
                    (setStatusCode 404 >=> json {| error = "Product not found" |}) next ctx
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
open System.IdentityModel.Tokens.Jwt
open System.Security.Claims
open Microsoft.IdentityModel.Tokens
open Models

module JwtSettings =
    let private fromEnv (name: string) (fallback: string) =
        match Environment.GetEnvironmentVariable name with
        | null | "" -> fallback
        | value -> value

    /// Signing key, override with the JWT_SECRET environment variable (at least 16 characters).
    let secret = fromEnv "JWT_SECRET" "change-this-secret-in-production"
    let issuer = "{{projectName}}"
    let audience = "{{projectName}}"

type IAuthService =
    abstract member GenerateToken: User -> string

type AuthService() =
    interface IAuthService with
        member this.GenerateToken(user: User) =
            let key = SymmetricSecurityKey(Text.Encoding.UTF8.GetBytes(JwtSettings.secret))
            let credentials = SigningCredentials(key, SecurityAlgorithms.HmacSha256)

            let claims =
                [ Claim(JwtRegisteredClaimNames.Sub, user.Id)
                  Claim("email", user.Email)
                  Claim("role", user.Role) ]

            let token =
                JwtSecurityToken(
                    issuer = JwtSettings.issuer,
                    audience = JwtSettings.audience,
                    claims = claims,
                    expires = Nullable(DateTime.UtcNow.AddDays(7.0)),
                    signingCredentials = credentials
                )

            JwtSecurityTokenHandler().WriteToken(token)

type IDatabase =
    abstract member FindUserByEmail: string -> User option
    abstract member FindUserById: string -> User option
    abstract member GetUsers: unit -> User list
    abstract member CreateUser: User -> unit
    abstract member DeleteUser: string -> bool
    abstract member FindProductById: string -> Product option
    abstract member GetProducts: unit -> Product list
    abstract member CreateProduct: Product -> unit
    abstract member UpdateProduct: string * UpdateProductInput -> Product option
    abstract member DeleteProduct: string -> bool

/// In-memory store. Replace with a real database for production use.
type Database() =
    let sync = obj ()
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

        printfn "Database initialized"
        printfn "Default admin user: admin@example.com / admin123"
        printfn "Sample products created"

    interface IDatabase with
        member this.FindUserByEmail(email) =
            lock sync (fun () -> users.Values |> Seq.tryFind (fun u -> u.Email = email))

        member this.FindUserById(id) =
            lock sync (fun () -> users.TryFind(id) |> Option.map (fun u -> { u with Password = "" }))

        member this.GetUsers() =
            lock sync (fun () -> users.Values |> Seq.map (fun u -> { u with Password = "" }) |> List.ofSeq)

        member this.CreateUser(user) =
            lock sync (fun () -> users <- users.Add(user.Id, user))

        member this.DeleteUser(id) =
            lock sync (fun () ->
                if users.ContainsKey(id) then
                    users <- users.Remove(id)
                    true
                else
                    false)

        member this.FindProductById(id) =
            lock sync (fun () -> products.TryFind(id))

        member this.GetProducts() =
            lock sync (fun () -> products.Values |> List.ofSeq)

        member this.CreateProduct(product) =
            lock sync (fun () -> products <- products.Add(product.Id, product))

        member this.UpdateProduct(id, updateData) =
            lock sync (fun () ->
                match products.TryFind(id) with
                | Some existing ->
                    let updated = {
                        existing with
                            Name = defaultArg updateData.Name existing.Name
                            Description = (match updateData.Description with Some _ as d -> d | None -> existing.Description)
                            Price = defaultArg updateData.Price existing.Price
                            Stock = defaultArg updateData.Stock existing.Stock
                            UpdatedAt = DateTime.UtcNow
                    }
                    products <- products.Add(id, updated)
                    Some updated
                | None -> None)

        member this.DeleteProduct(id) =
            lock sync (fun () ->
                if products.ContainsKey(id) then
                    products <- products.Remove(id)
                    true
                else
                    false)
`,

    // Views
    'Views/Views.fs': `namespace Views

module Views =
    // View helpers can be added here if needed
    // For now, we're using JSON API responses only
    let apiOnly = true
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
- \`GET /api/v1/auth/me\` - Get current user (bearer token required; \`POST\` also accepted)

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
