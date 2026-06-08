import { BackendTemplate } from '../types';

export const giraffeTemplate: BackendTemplate = {
  id: 'giraffe',
  name: 'Giraffe',
  description: 'F# functional web framework for ASP.NET Core',
  version: '1.0.0',
  framework: 'giraffe',
  displayName: 'Giraffe (F#)',
  language: 'fsharp',
  port: 5000,
  tags: ['fsharp', 'giraffe', 'web', 'api', 'rest', 'functional', 'dotnet'],
  features: ['routing', 'middleware', 'rest-api', 'logging', 'cors', 'validation'],
  dependencies: {},
  devDependencies: {},
  files: {
    '{{projectName}}.fsproj': `<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <RootNamespace>{{projectName}}</RootNamespace>
    <AssemblyName>{{projectName}}</AssemblyName>
  </PropertyGroup>

  <ItemGroup>
    <Compile Include="Models.fs" />
    <Compile Include="Database.fs" />
    <Compile Include="Auth.fs" />
    <Compile Include="Handlers.fs" />
    <Compile Include="Program.fs" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="Giraffe" Version="6.2.0" />
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.0.0" />
    <PackageReference Include="Thoth.Json.Giraffe" Version="6.0.0" />
  </ItemGroup>

</Project>
`,

    'Program.fs': `module {{projectName}}.Program

open System
open Microsoft.AspNetCore.Builder
open Microsoft.AspNetCore.Cors.Infrastructure
open Microsoft.AspNetCore.Hosting
open Microsoft.Extensions.Hosting
open Microsoft.Extensions.Logging
open Microsoft.Extensions.DependencyInjection
open Giraffe

open {{projectName}}.Handlers

// ---------------------------------
// Web app
// ---------------------------------

let webApp =
    choose [
        GET >=>
            choose [
                route "/" >=> rootHandler
                route "/health" >=> healthHandler
                route "/api/users/me" >=> authorize >=> getMeHandler
                route "/api/users" >=> authorize >=> listUsersHandler
                routef "/api/users/%i" (fun id -> authorize >=> getUserHandler id)
                route "/api/items" >=> authorize >=> listItemsHandler
                routef "/api/items/%i" (fun id -> authorize >=> getItemHandler id)
            ]
        POST >=>
            choose [
                route "/api/auth/register" >=> registerHandler
                route "/api/auth/login" >=> loginHandler
                route "/api/items" >=> authorize >=> createItemHandler
            ]
        DELETE >=>
            choose [
                routef "/api/items/%i" (fun id -> authorize >=> deleteItemHandler id)
            ]
        setStatusCode 404 >=> text "Not Found"
    ]

// ---------------------------------
// Error handler
// ---------------------------------

let errorHandler (ex : Exception) (logger : ILogger) =
    logger.LogError(ex, "An unhandled exception occurred.")
    clearResponse >=> setStatusCode 500 >=> text ex.Message

// ---------------------------------
// Config and Main
// ---------------------------------

let configureCors (builder : CorsPolicyBuilder) =
    builder
        .WithOrigins("*")
        .AllowAnyMethod()
        .AllowAnyHeader()
    |> ignore

let configureApp (app : IApplicationBuilder) =
    let env = app.ApplicationServices.GetService<IWebHostEnvironment>()
    (match env.IsDevelopment() with
    | true  ->
        app.UseDeveloperExceptionPage()
    | false ->
        app.UseGiraffeErrorHandler(errorHandler))
        .UseCors(configureCors)
        .UseGiraffe(webApp)

let configureServices (services : IServiceCollection) =
    services.AddCors()    |> ignore
    services.AddGiraffe() |> ignore

let configureLogging (builder : ILoggingBuilder) =
    builder.AddConsole()
           .AddDebug() |> ignore

[<EntryPoint>]
let main args =
    let port =
        Environment.GetEnvironmentVariable("PORT")
        |> Option.ofObj
        |> Option.map int
        |> Option.defaultValue 5000

    printfn "🚀 {{projectName}} server starting on http://localhost:%d" port

    Host.CreateDefaultBuilder(args)
        .ConfigureWebHostDefaults(
            fun webHostBuilder ->
                webHostBuilder
                    .UseUrls(sprintf "http://0.0.0.0:%d" port)
                    .Configure(Action<IApplicationBuilder> configureApp)
                    .ConfigureServices(configureServices)
                    .ConfigureLogging(configureLogging)
                    |> ignore)
        .Build()
        .Run()
    0
`,

    'Models.fs': `module {{projectName}}.Models

open System

[<CLIMutable>]
type User = {
    Id: int
    Email: string
    Name: string
    CreatedAt: DateTime
}

[<CLIMutable>]
type CreateUserRequest = {
    Email: string
    Name: string
    Password: string
}

[<CLIMutable>]
type LoginRequest = {
    Email: string
    Password: string
}

[<CLIMutable>]
type TokenResponse = {
    Token: string
    ExpiresAt: int64
}

[<CLIMutable>]
type Item = {
    Id: int
    Name: string
    Description: string
    UserId: int
    CreatedAt: DateTime
}

[<CLIMutable>]
type CreateItemRequest = {
    Name: string
    Description: string option
}

[<CLIMutable>]
type HealthResponse = {
    Status: string
    Timestamp: string
}

[<CLIMutable>]
type ApiInfo = {
    Name: string
    Version: string
    Framework: string
    Language: string
    Description: string
}

[<CLIMutable>]
type ErrorResponse = {
    Error: string
    Message: string
}
`,

    'Database.fs': `module {{projectName}}.Database

open System
open System.Collections.Generic
open {{projectName}}.Models

// In-memory storage (use proper database in production)
let mutable private users: User list = []
let mutable private passwords: Map<int, string> = Map.empty
let mutable private items: Item list = []
let mutable private userIdCounter = 0
let mutable private itemIdCounter = 0

// User operations
let findUserByEmail (email: string) : User option =
    users |> List.tryFind (fun u -> u.Email = email)

let findUserById (id: int) : User option =
    users |> List.tryFind (fun u -> u.Id = id)

let createUser (email: string) (name: string) (password: string) : User =
    userIdCounter <- userIdCounter + 1
    let user = {
        Id = userIdCounter
        Email = email
        Name = name
        CreatedAt = DateTime.UtcNow
    }
    users <- users @ [user]
    passwords <- passwords.Add(user.Id, password)
    user

let verifyPassword (userId: int) (password: string) : bool =
    match passwords.TryFind userId with
    | Some p -> p = password
    | None -> false

let getAllUsers () : User list = users

// Item operations
let getItemsByUser (userId: int) : Item list =
    items |> List.filter (fun i -> i.UserId = userId)

let createItem (name: string) (description: string) (userId: int) : Item =
    itemIdCounter <- itemIdCounter + 1
    let item = {
        Id = itemIdCounter
        Name = name
        Description = description
        UserId = userId
        CreatedAt = DateTime.UtcNow
    }
    items <- items @ [item]
    item

let findItemById (itemId: int) (userId: int) : Item option =
    items |> List.tryFind (fun i -> i.Id = itemId && i.UserId = userId)

let deleteItem (itemId: int) (userId: int) : bool =
    let original = items
    items <- items |> List.filter (fun i -> not (i.Id = itemId && i.UserId = userId))
    List.length original <> List.length items
`,

    'Auth.fs': `module {{projectName}}.Auth

open System
open {{projectName}}.Models

let private jwtSecret =
    Environment.GetEnvironmentVariable("JWT_SECRET")
    |> Option.ofObj
    |> Option.defaultValue "your-secret-key-change-in-production"

// Simple JWT generation (use proper library in production)
let generateToken (userId: int) : TokenResponse =
    let expiresAt = DateTimeOffset.UtcNow.AddHours(24.0).ToUnixTimeSeconds()
    {
        Token = sprintf "mock-jwt-token-%d" userId
        ExpiresAt = expiresAt
    }

// Simple token verification (use proper JWT library in production)
let verifyToken (token: string) : int option =
    if token.StartsWith("mock-jwt-token-") then
        let userIdStr = token.Replace("mock-jwt-token-", "")
        match Int32.TryParse(userIdStr) with
        | true, userId -> Some userId
        | false, _ -> None
    else
        None
`,

    'Handlers.fs': `module {{projectName}}.Handlers

open System
open Microsoft.AspNetCore.Http
open Giraffe

open {{projectName}}.Models
open {{projectName}}.Database
open {{projectName}}.Auth

// ---------------------------------
// JSON helpers
// ---------------------------------

let json<'T> (data: 'T) : HttpHandler =
    fun (next: HttpFunc) (ctx: HttpContext) ->
        json data next ctx

// ---------------------------------
// Auth middleware
// ---------------------------------

let authorize : HttpHandler =
    fun (next: HttpFunc) (ctx: HttpContext) ->
        let authHeader = ctx.Request.Headers.["Authorization"].ToString()
        if String.IsNullOrEmpty(authHeader) || not (authHeader.StartsWith("Bearer ")) then
            RequestErrors.UNAUTHORIZED "Bearer" "{{projectName}}" "Authentication required" next ctx
        else
            let token = authHeader.Substring(7)
            match verifyToken token with
            | Some userId ->
                ctx.Items.["UserId"] <- userId
                next ctx
            | None ->
                RequestErrors.UNAUTHORIZED "Bearer" "{{projectName}}" "Invalid token" next ctx

let getCurrentUserId (ctx: HttpContext) : int =
    ctx.Items.["UserId"] :?> int

// ---------------------------------
// Handlers
// ---------------------------------

let rootHandler : HttpHandler =
    json {
        Name = "{{projectName}}"
        Version = "1.0.0"
        Framework = "Giraffe"
        Language = "F#"
        Description = "{{description}}"
    }

let healthHandler : HttpHandler =
    json {
        Status = "healthy"
        Timestamp = DateTime.UtcNow.ToString("o")
    }

let registerHandler : HttpHandler =
    fun (next: HttpFunc) (ctx: HttpContext) ->
        task {
            let! req = ctx.BindJsonAsync<CreateUserRequest>()

            if String.IsNullOrEmpty(req.Email) || String.IsNullOrEmpty(req.Name) || String.IsNullOrEmpty(req.Password) then
                return! RequestErrors.BAD_REQUEST { Error = "validation_error"; Message = "Email, name and password are required" } next ctx
            else
                match findUserByEmail req.Email with
                | Some _ ->
                    return! RequestErrors.CONFLICT { Error = "conflict"; Message = "User with this email already exists" } next ctx
                | None ->
                    let user = createUser req.Email req.Name req.Password
                    ctx.SetStatusCode 201
                    return! json user next ctx
        }

let loginHandler : HttpHandler =
    fun (next: HttpFunc) (ctx: HttpContext) ->
        task {
            let! req = ctx.BindJsonAsync<LoginRequest>()

            match findUserByEmail req.Email with
            | None ->
                return! RequestErrors.UNAUTHORIZED "Bearer" "{{projectName}}" "Invalid email or password" next ctx
            | Some user ->
                if verifyPassword user.Id req.Password then
                    let tokenResponse = generateToken user.Id
                    return! json tokenResponse next ctx
                else
                    return! RequestErrors.UNAUTHORIZED "Bearer" "{{projectName}}" "Invalid email or password" next ctx
        }

let getMeHandler : HttpHandler =
    fun (next: HttpFunc) (ctx: HttpContext) ->
        let userId = getCurrentUserId ctx
        match findUserById userId with
        | Some user -> json user next ctx
        | None -> RequestErrors.NOT_FOUND { Error = "not_found"; Message = "User not found" } next ctx

let listUsersHandler : HttpHandler =
    fun (next: HttpFunc) (ctx: HttpContext) ->
        let users = getAllUsers ()
        json users next ctx

let getUserHandler (id: int) : HttpHandler =
    fun (next: HttpFunc) (ctx: HttpContext) ->
        match findUserById id with
        | Some user -> json user next ctx
        | None -> RequestErrors.NOT_FOUND { Error = "not_found"; Message = "User not found" } next ctx

let listItemsHandler : HttpHandler =
    fun (next: HttpFunc) (ctx: HttpContext) ->
        let userId = getCurrentUserId ctx
        let items = getItemsByUser userId
        json items next ctx

let createItemHandler : HttpHandler =
    fun (next: HttpFunc) (ctx: HttpContext) ->
        task {
            let userId = getCurrentUserId ctx
            let! req = ctx.BindJsonAsync<CreateItemRequest>()

            if String.IsNullOrEmpty(req.Name) then
                return! RequestErrors.BAD_REQUEST { Error = "validation_error"; Message = "Name is required" } next ctx
            else
                let desc = req.Description |> Option.defaultValue ""
                let item = createItem req.Name desc userId
                ctx.SetStatusCode 201
                return! json item next ctx
        }

let getItemHandler (id: int) : HttpHandler =
    fun (next: HttpFunc) (ctx: HttpContext) ->
        let userId = getCurrentUserId ctx
        match findItemById id userId with
        | Some item -> json item next ctx
        | None -> RequestErrors.NOT_FOUND { Error = "not_found"; Message = "Item not found" } next ctx

let deleteItemHandler (id: int) : HttpHandler =
    fun (next: HttpFunc) (ctx: HttpContext) ->
        let userId = getCurrentUserId ctx
        if deleteItem id userId then
            ctx.SetStatusCode 204
            ctx.WriteStringAsync ""
        else
            RequestErrors.NOT_FOUND { Error = "not_found"; Message = "Item not found" } next ctx
`,

    'appsettings.json': `{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "JwtSettings": {
    "Secret": "your-super-secret-key-change-in-production",
    "Issuer": "{{projectName}}",
    "Audience": "{{projectName}}-api"
  }
}
`,

    'appsettings.Development.json': `{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "Microsoft.AspNetCore": "Debug"
    }
  }
}
`,

    '.env': `# Environment Configuration
PORT=5000
JWT_SECRET=your-super-secret-key-change-in-production
`,

    '.env.example': `# Environment Configuration
PORT=5000
JWT_SECRET=your-super-secret-key-change-in-production
`,

    '.gitignore': `# Build artifacts
bin/
obj/

# IDE
.idea/
.vscode/
*.swp

# User-specific files
*.user
*.userosscache
*.suo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local

# Logs
*.log
logs/

# NuGet
*.nupkg
packages/
`,

    'Makefile': `# {{projectName}} Makefile

.PHONY: all build run test clean restore publish

all: build

# Restore dependencies
restore:
	dotnet restore

# Build the project
build: restore
	dotnet build

# Build release version
release: restore
	dotnet build -c Release

# Run the server
run:
	dotnet run

# Run in watch mode
watch:
	dotnet watch run

# Run tests
test:
	dotnet test

# Clean build artifacts
clean:
	dotnet clean
	rm -rf bin/ obj/

# Publish for deployment
publish:
	dotnet publish -c Release -o publish

# Docker commands
docker-build:
	docker build -t {{projectName}} .

docker-run:
	docker run -p 5000:5000 --env-file .env {{projectName}}
`,

    'Dockerfile': `# =============================================================================
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Builder
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder

WORKDIR /app

# Copy project file and restore dependencies (for better caching)
COPY *.fsproj ./
RUN dotnet restore

# Copy source and build
COPY . .
RUN dotnet publish -c Release -o out /p:DebugType=None /p:DebugSymbols=false

# =============================================================================
# Stage 2: Runtime - Minimal image
# =============================================================================
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime

WORKDIR /app

# Copy published output from builder
COPY --from=builder /app/out ./

# Create non-root user
RUN useradd -m -u 1000 appuser

# Create data directory
RUN mkdir -p /app/data && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5000

ENV ASPNETCORE_URLS=http://+:5000
ENV PORT=5000
ENV ASPNETCORE_ENVIRONMENT=Production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["dotnet", "{{projectName}}.dll"]
`,

    'docker-compose.yml': `version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - PORT=5000
      - JWT_SECRET=\${JWT_SECRET:-development-secret}
      - ASPNETCORE_ENVIRONMENT=Development
    restart: unless-stopped
`,

    'README.md': `# {{projectName}}

{{description}}

An F# web application built with the Giraffe framework on ASP.NET Core.

## Features

- 🚀 Functional-first web framework on .NET
- 🔐 JWT authentication
- 📝 Full REST API with CRUD operations
- 🧪 Test-friendly design
- 🐳 Docker support
- ⚡ High-performance Kestrel server

## Requirements

- .NET 8.0 SDK

## Installation

\`\`\`bash
# Restore dependencies
dotnet restore

# Build the project
dotnet build

# Run the server
dotnet run
\`\`\`

## Development

\`\`\`bash
# Run in development mode
dotnet run

# Run with watch mode
dotnet watch run

# Run tests
dotnet test

# Build release version
dotnet build -c Release
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
docker run -p 5000:5000 {{projectName}}

# Or use docker-compose
docker-compose up -d
\`\`\`

## F# Functional Features

This project demonstrates idiomatic F#:
- Railway-oriented programming patterns
- Immutable data structures
- Pattern matching for control flow
- Composition over inheritance

## License

MIT
`},
  prompts: [
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: 'my-giraffe-app'},
    {
      type: 'input',
      name: 'description',
      message: 'Project description:',
      default: 'An F# web application built with Giraffe'}],
  postInstall: [
    'dotnet restore',
    'echo "✨ {{projectName}} is ready!"',
    'echo "Run: dotnet run"']};
