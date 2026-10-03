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
  dependencies: {
    'FSharp.Data.GraphQL': '0.0.16',
  },
  features: ['authentication', 'validation', 'logging', 'cors', 'documentation', 'microservices', 'graphql'],

  files: {
    // Project file
    '{{projectNamePascal}}.fsproj': `<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <NoWarn>$(NoWarn);FS3370</NoWarn>
  </PropertyGroup>

  <!-- F# compiles files in the order listed here -->
  <ItemGroup>
    <Compile Include="Models/Models.fs" />
    <Compile Include="Database/Database.fs" />
    <Compile Include="Auth/Auth.fs" />
    <Compile Include="GraphQL/Schema.fs" />
    <Compile Include="GraphQL/Resolver.fs" />
    <Compile Include="Handlers/Handlers.fs" />
    <Compile Include="Program/Program.fs" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="Suave" Version="2.6.2" />
    <PackageReference Include="FSharp.SystemTextJson" Version="1.3.13" />
    <PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="7.0.3" />
    <PackageReference Include="BCrypt.Net-Next" Version="4.0.3" />
  </ItemGroup>

</Project>
`,

    // Models
    'Models/Models.fs': `module Models

open System

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
open System.Collections.Generic
open Models

type Database() =
    let users = Dictionary<string, User>()
    let products = Dictionary<string, Product>()
    let sync = obj ()

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

        printfn "Database initialized"
        printfn "Default admin user: admin@example.com / admin123"
        printfn "Sample products created"

    member _.FindUserByEmail(email: string) : User option =
        lock sync (fun () ->
            users.Values
            |> Seq.tryFind (fun u -> u.Email = email))

    member _.FindUserById(id: string) : User option =
        lock sync (fun () ->
            match users.TryGetValue(id) with
            | true, user -> Some { user with Password = "" }
            | false, _ -> None)

    member _.GetUsers() : User list =
        lock sync (fun () ->
            users.Values |> Seq.map (fun u -> { u with Password = "" }) |> List.ofSeq)

    member _.CreateUser(user: User) : unit =
        lock sync (fun () ->
            users.[user.Id] <- user)

    member _.DeleteUser(id: string) : bool =
        lock sync (fun () ->
            users.Remove(id))

    member _.FindProductById(id: string) : Product option =
        lock sync (fun () ->
            match products.TryGetValue(id) with
            | true, product -> Some product
            | false, _ -> None)

    member _.GetProducts() : Product list =
        lock sync (fun () ->
            products.Values |> List.ofSeq)

    member _.CreateProduct(product: Product) : unit =
        lock sync (fun () ->
            products.[product.Id] <- product)

    member _.UpdateProduct(id: string, updateData: UpdateProductInput) : Product option =
        lock sync (fun () ->
            match products.TryGetValue(id) with
            | true, existing ->
                let updated = {
                    existing with
                        Name = defaultArg updateData.Name existing.Name
                        Description = (match updateData.Description with Some _ as desc -> desc | None -> existing.Description)
                        Price = defaultArg updateData.Price existing.Price
                        Stock = defaultArg updateData.Stock existing.Stock
                        UpdatedAt = DateTime.UtcNow
                }
                products.[id] <- updated
                Some updated
            | false, _ -> None)

    member _.DeleteProduct(id: string) : bool =
        lock sync (fun () ->
            products.Remove(id))
`,

    // Auth
    'Auth/Auth.fs': `module Auth

open System
open System.IdentityModel.Tokens.Jwt
open System.Security.Claims
open Microsoft.IdentityModel.Tokens
open Models

let private secret =
    match Environment.GetEnvironmentVariable "JWT_SECRET" with
    | null | "" -> "change-this-secret-in-production"
    | value -> value

let private issuer = "{{projectName}}"
let private audience = "{{projectName}}"

let private signingKey () = SymmetricSecurityKey(Text.Encoding.UTF8.GetBytes(secret))

let generateToken (user: User) : string =
    let credentials = SigningCredentials(signingKey (), SecurityAlgorithms.HmacSha256)

    let claims =
        [ Claim(JwtRegisteredClaimNames.Sub, user.Id)
          Claim("email", user.Email)
          Claim("role", user.Role) ]

    let token =
        JwtSecurityToken(
            issuer = issuer,
            audience = audience,
            claims = claims,
            expires = Nullable(DateTime.UtcNow.AddDays(7.0)),
            signingCredentials = credentials
        )

    JwtSecurityTokenHandler().WriteToken(token)

/// Validates signature, issuer, audience and expiry; returns the caller's identity.
let verifyToken (token: string) : ClaimsPrincipal option =
    let parameters =
        TokenValidationParameters(
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = signingKey (),
            ValidateIssuer = true,
            ValidIssuer = issuer,
            ValidateAudience = true,
            ValidAudience = audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1.0)
        )

    try
        let mutable validated: SecurityToken = null
        Some(JwtSecurityTokenHandler().ValidateToken(token, parameters, &validated))
    with _ ->
        None
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


    // Handlers
    'Handlers/Handlers.fs': `module Handlers

open System
open System.Security.Claims
open System.Text.Json
open System.Text.Json.Serialization
open Suave
open Suave.Filters
open Suave.Operators
open Suave.Successful
open Models
open Database
open Auth

let private jsonOptions =
    let options = JsonSerializerOptions(PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true)
    options.Converters.Add(JsonFSharpConverter(JsonFSharpOptions.Default().WithSkippableOptionFields()))
    options

/// Writes \`value\` as JSON with the given status code.
let jsonStatus (status: HttpCode) (value: 'T) : WebPart =
    let bytes = JsonSerializer.SerializeToUtf8Bytes(value, jsonOptions)
    Writers.setMimeType "application/json; charset=utf-8" >=> Response.response status bytes

let JSON (value: 'T) : WebPart = jsonStatus HTTP_200 value

let private errorJson (status: HttpCode) (message: string) : WebPart =
    jsonStatus status {| error = message |}

/// Parses the request body as JSON.
let private parseBody<'T> (ctx: HttpContext) : Result<'T, string> =
    try
        let value = JsonSerializer.Deserialize<'T>(ctx.request.rawForm, jsonOptions)
        if isNull (box value) then Error "Request body is required" else Ok value
    with ex ->
        Error $"Invalid JSON body: {ex.Message}"

let handleError (f: WebPart) : WebPart =
    fun ctx ->
        async {
            try
                return! f ctx
            with ex ->
                return! errorJson HTTP_500 ex.Message ctx
        }

let private db = Database()

let private toUserResponse (u: User) : UserResponse =
    { Id = u.Id; Email = u.Email; Name = u.Name; Role = u.Role }

// Authentication guards ----------------------------------------------------------

let private bearerToken (ctx: HttpContext) =
    match ctx.request.header "authorization" with
    | Choice1Of2 value when value.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) -> Some(value.Substring 7)
    | _ -> None

/// Runs \`next\` with the caller's identity when the bearer token is valid.
let authenticate (next: ClaimsPrincipal -> WebPart) : WebPart =
    fun ctx ->
        match bearerToken ctx |> Option.bind verifyToken with
        | Some principal -> next principal ctx
        | None -> errorJson HTTP_401 "Unauthorized" ctx

let private isAdmin (principal: ClaimsPrincipal) =
    principal.IsInRole "admin" || principal.HasClaim("role", "admin")

/// Runs \`next\` only for callers whose role claim is "admin".
let requireAdmin (next: WebPart) : WebPart =
    authenticate (fun principal ->
        if isAdmin principal then next else errorJson HTTP_403 "Admin role required")

// Handlers ----------------------------------------------------------------------

let health: WebPart =
    fun ctx ->
        JSON {| status = "healthy"; timestamp = DateTime.UtcNow.ToString("o"); version = "1.0.0" |} ctx

/// Minimal GraphQL endpoint: Query { hello: String!, health: String! }.
/// Resolves the top-level fields named in the query text.
let graphql: WebPart =
    fun ctx ->
        let query =
            try
                use doc = JsonDocument.Parse(ctx.request.rawForm)
                match doc.RootElement.TryGetProperty "query" with
                | true, q -> q.GetString()
                | _ -> ""
            with :? JsonException -> ""

        let data = System.Collections.Generic.Dictionary<string, string>()
        if query.Contains "hello" then data["hello"] <- GraphQL.Resolver.helloResolver ()
        if query.Contains "health" then data["health"] <- GraphQL.Resolver.healthResolver ()

        if data.Count = 0 then
            jsonStatus HTTP_400 {| errors = [ {| message = "Query must select hello and/or health" |} ] |} ctx
        else
            JSON {| data = data |} ctx

let register: WebPart =
    fun ctx ->
        match parseBody<RegisterInput> ctx with
        | Error message -> errorJson HTTP_400 message ctx
        | Ok input ->
            match db.FindUserByEmail(input.Email) with
            | Some _ -> errorJson HTTP_409 "Email already registered" ctx
            | None ->
                let now = DateTime.UtcNow

                let user: User =
                    { Id = Guid.NewGuid().ToString()
                      Email = input.Email
                      Password = BCrypt.Net.BCrypt.HashPassword(input.Password)
                      Name = input.Name
                      Role = "user"
                      CreatedAt = now
                      UpdatedAt = now }

                db.CreateUser(user)
                let response: TokenResponse = { Token = generateToken user; User = toUserResponse user }
                jsonStatus HTTP_201 response ctx

let login: WebPart =
    fun ctx ->
        match parseBody<LoginInput> ctx with
        | Error message -> errorJson HTTP_400 message ctx
        | Ok input ->
            match db.FindUserByEmail(input.Email) with
            | Some user when BCrypt.Net.BCrypt.Verify(input.Password, user.Password) ->
                let response: TokenResponse = { Token = generateToken user; User = toUserResponse user }
                JSON response ctx
            | _ -> errorJson HTTP_401 "Invalid credentials" ctx

/// Returns the identity carried by the bearer token.
let me: WebPart =
    authenticate (fun principal ->
        let value (types: string list) =
            types
            |> List.tryPick (fun t -> principal.FindFirst t |> Option.ofObj |> Option.map (fun c -> c.Value))
            |> Option.defaultValue ""

        JSON
            {| userId = value [ "sub"; ClaimTypes.NameIdentifier ]
               email = value [ "email"; ClaimTypes.Email ]
               role = value [ "role"; ClaimTypes.Role ] |})

let listUsers: WebPart =
    requireAdmin (fun ctx ->
        let users = db.GetUsers() |> List.map toUserResponse
        JSON {| users = users; count = List.length users |} ctx)

let getUser (id: string) : WebPart =
    requireAdmin (fun ctx ->
        match db.FindUserById(id) with
        | Some user -> JSON {| user = toUserResponse user |} ctx
        | None -> errorJson HTTP_404 "User not found" ctx)

let deleteUser (id: string) : WebPart =
    requireAdmin (fun ctx ->
        if db.DeleteUser(id) then NO_CONTENT ctx else errorJson HTTP_404 "User not found" ctx)

let listProducts: WebPart =
    fun ctx ->
        let products = db.GetProducts()
        JSON {| products = products; count = List.length products |} ctx

let getProduct (id: string) : WebPart =
    fun ctx ->
        match db.FindProductById(id) with
        | Some product -> JSON {| product = product |} ctx
        | None -> errorJson HTTP_404 "Product not found" ctx

let createProduct: WebPart =
    requireAdmin (fun ctx ->
        match parseBody<CreateProductInput> ctx with
        | Error message -> errorJson HTTP_400 message ctx
        | Ok input ->
            let now = DateTime.UtcNow

            let product: Product =
                { Id = Guid.NewGuid().ToString()
                  Name = input.Name
                  Description = input.Description
                  Price = input.Price
                  Stock = input.Stock
                  CreatedAt = now
                  UpdatedAt = now }

            db.CreateProduct(product)
            jsonStatus HTTP_201 {| product = product |} ctx)

let updateProduct (id: string) : WebPart =
    requireAdmin (fun ctx ->
        match parseBody<UpdateProductInput> ctx with
        | Error message -> errorJson HTTP_400 message ctx
        | Ok input ->
            match db.UpdateProduct(id, input) with
            | Some product -> JSON {| product = product |} ctx
            | None -> errorJson HTTP_404 "Product not found" ctx)

let deleteProduct (id: string) : WebPart =
    requireAdmin (fun ctx ->
        if db.DeleteProduct(id) then NO_CONTENT ctx else errorJson HTTP_404 "Product not found" ctx)

let app: WebPart =
    choose
        [ GET
          >=> choose
                  [ path "/" >=> OK "{{projectName}} API - Running"
                    path "/health" >=> health
                    path "/api/v1/health" >=> health
                    path "/api/v1/auth/me" >=> me
                    path "/api/v1/users" >=> listUsers
                    pathScan "/api/v1/users/%s" getUser
                    path "/api/v1/products" >=> listProducts
                    pathScan "/api/v1/products/%s" getProduct ]
          POST
          >=> choose
                  [ path "/api/v1/auth/register" >=> handleError register
                    path "/api/v1/auth/login" >=> handleError login
                    path "/api/v1/auth/me" >=> me
                    path "/api/v1/products" >=> handleError createProduct
                    path "/graphql" >=> graphql ]
          PUT >=> choose [ pathScan "/api/v1/products/%s" (fun id -> handleError (updateProduct id)) ]
          DELETE
          >=> choose
                  [ pathScan "/api/v1/users/%s" deleteUser
                    pathScan "/api/v1/products/%s" deleteProduct ]
          RequestErrors.NOT_FOUND "Not Found" ]
`,

    // Program entry point
    'Program/Program.fs': `module Program

open System
open System.Net
open Suave
open Handlers

[<EntryPoint>]
let main _ =
    let host =
        match Environment.GetEnvironmentVariable "HOST" with
        | null | "" -> "127.0.0.1"
        | value -> value

    let port =
        match Int32.TryParse(Environment.GetEnvironmentVariable "PORT") with
        | true, value -> value
        | _ -> 8080

    let config =
        { defaultConfig with
            bindings = [ HttpBinding.createSimple HTTP host port ] }

    printfn "Server running at http://%s:%d" host port
    printfn "API endpoints:"
    printfn "   GET  /health"
    printfn "   POST /api/v1/auth/register"
    printfn "   POST /api/v1/auth/login"
    printfn "   GET  /api/v1/auth/me"
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
ENV HOST=0.0.0.0

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
- \`GET /api/v1/auth/me\` - Get current user (bearer token required)

### Products
- \`GET /api/v1/products\` - List all products
- \`GET /api/v1/products/:id\` - Get product by ID
- \`POST /api/v1/products\` - Create product (admin only)
- \`PUT /api/v1/products/:id\` - Update product (admin only)
- \`DELETE /api/v1/products/:id\` - Delete product (admin only)

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
