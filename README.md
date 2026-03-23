# Re-Shell CLI v0.28.0

**Full-Stack Development Platform - Microservices & Microfrontends United**

The most comprehensive and powerful command-line interface for building complete full-stack applications with distributed microservices and microfrontend architectures. Re-Shell unites backend and frontend development under a single CLI, providing enterprise-grade reliability, seamless integration, and exceptional developer experience.

[![Version](https://img.shields.io/npm/v/@umutkorkmaz/re-shell-cli.svg)](https://www.npmjs.com/package/@umutkorkmaz/re-shell-cli)
[![License](https://img.shields.io/npm/l/@umutkorkmaz/re-shell-cli.svg)](https://github.com/umutkorkmaz/re-shell-cli/blob/main/LICENSE)
[![Build Status](https://img.shields.io/github/workflow/status/umutkorkmaz/re-shell-cli/CI)](https://github.com/umutkorkmaz/re-shell-cli/actions)
[![Coverage](https://img.shields.io/codecov/c/github/umutkorkmaz/re-shell-cli)](https://codecov.io/gh/umutkorkmaz/re-shell-cli)
[![Downloads](https://img.shields.io/npm/dm/@umutkorkmaz/re-shell-cli.svg)](https://www.npmjs.com/package/@umutkorkmaz/re-shell-cli)

## 🚀 Platform Overview

Re-Shell CLI is a comprehensive full-stack development platform that revolutionizes how teams build modern distributed applications. By uniting microservices and microfrontends under a single powerful CLI, it enables developers to create, integrate, and deploy complete applications with unprecedented ease.

### Key Capabilities

- **🎯 Full-Stack Unity**: Seamless integration between frontend microfrontends and backend microservices
- **🏗️ Microservices Excellence**: Production-ready templates for .NET (ASP.NET Core Web API, Minimal API), Java (Spring Boot, Quarkus, Micronaut, Vert.x), Rust (Actix-Web, Warp, Rocket, Axum), Python (FastAPI, Django, Flask), PHP (Symfony, Laravel, Slim, CodeIgniter), Go (Gin, Echo, Fiber, Chi, gRPC), Ruby (Rails API, Sinatra, Grape) and Node.js (Express, NestJS)
- **🎨 Microfrontend Architecture**: Module Federation with React, Vue, Svelte, and Angular support
- **🔄 Smart Code Generation**: API-first development with automatic type generation and SDK creation
- **📊 Complete Observability**: Built-in monitoring, tracing, and logging across the entire stack
- **🛡️ Enterprise Security**: JWT authentication, OAuth2, API gateways, and compliance features
- **☁️ Production Ready**: Docker orchestration, Kubernetes manifests, and cloud provider configs

### 🆕 What's New in v0.28.0

- **📦 New npm Package Scope**: the CLI now publishes as `@umutkorkmaz/re-shell-cli`
- **🔄 Updated Upgrade Flow**: self-update prompts and generated monorepos now point at the new package name
- **🔗 Personal GitHub Metadata**: badges, links, and package metadata now resolve to the personal `umutkorkmaz/re-shell-cli` repository

### Previous Releases

#### v0.27.5
- **📚 Structured Example Library**: the CLI now ships with focused guides in `examples/` for every major command area instead of a single monolithic reference only
- **🗂️ Easier Feature Discovery**: the new examples index maps standalone commands and grouped features to the right guide quickly
- **📦 Published Example Guides**: the `examples/` directory is now included with the package so local installs keep the workflow guides close to the CLI

#### v0.27.4
- **🧾 JSON Stays Machine-Readable**: the CLI now respects `NO_COLOR` and no longer leaks color-env warnings into JSON output
- **🔧 Terminal Rendering Cleanup**: workspace diagnostics and quality framework listings now render clean dividers and real newlines
- **📘 API Toolchain Consistency**: generated YAML OpenAPI specs validate correctly across `api client` and docs subcommands
- **🏷️ Nested `--version` Flags Fixed**: subcommands like `api openapi generate --version 0.25.1` now work instead of triggering the CLI version banner
- **🌐 React Dev Server Verified**: generated React/Vite apps honor configured ports and return valid HTML on both `/` and route paths

#### v0.27.3
- **🧪 Executable CLI Validation**: `npm run test:plan` now performs exhaustive command coverage and behavior checks
- **🛠️ Safer Project Creation**: `create --dry-run` now previews output without writing files
- **📦 Stronger Init Flow**: `init --skip-install` handles missing package managers correctly and exits non-zero on real failures
- **🧾 Clean JSON Output**: `list --json`, `workspace health --json`, and `workspace optimize --json` now emit valid JSON without spinner/banner noise
- **🔍 Better Diagnostics**: workspace health scores render correctly and workspace conflict commands fail with actionable guidance
- **🏷️ Versioning Normalized**: release metadata now follows the current `0.27.x` line

#### v0.27.0
- **🧭 Command Surface Expansion**: regrouped the CLI into 15 command groups covering workspace, api, service, data, k8s, cloud, observe, security, quality, tools, and more
- **🏗️ Workspace Templates**: added new workspace architecture types and 10 domain starter templates
- **🔄 Compatibility Layer**: added hidden deprecated aliases for renamed commands with migration guidance
- **🩺 Project Health**: introduced the project health check command and expanded workspace tooling

#### v0.24.0
- **⚙️ Complete C++ Ecosystem**: added Crow, Drogon, cpp-httplib, Pistache, and Beast backend templates
- **🧪 Native Tooling**: added sanitizer support, Valgrind workflows, clang-format, clang-tidy, and Google Test integration
- **📚 API And Build Tooling**: added OpenAPI/Swagger support, modern CMake setups, JWT auth, logging, and Dockerized workflows

#### v0.23.0
- **💎 Complete Ruby Ecosystem**: added Rails API, Sinatra, and Grape templates with production-ready auth, docs, and testing

#### v0.22.0
- **🚀 Complete Go Ecosystem**: added Gin, Echo, Fiber, Chi, gRPC, and sqlx-based Go templates with production tooling

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Microservices Templates](#-microservices-templates)
- [Microfrontend Templates](#-microfrontend-templates)
- [Core Features](#-core-features)
- [Advanced Features](#-advanced-features)
- [DevOps & Deployment](#-devops--deployment)
- [Enterprise Features](#-enterprise-features)
- [CLI Commands Reference](#-cli-commands-reference)
- [Configuration](#-configuration)
- [Examples](#-examples)
- [Best Practices](#-best-practices)
- [Contributing](#-contributing)
- [Support](#-support)

## 🚀 Quick Start

### Installation

```bash
# Install globally using npm
npm install -g @umutkorkmaz/re-shell-cli

# Using yarn
yarn global add @umutkorkmaz/re-shell-cli

# Using pnpm
pnpm add -g @umutkorkmaz/re-shell-cli

# Verify installation
re-shell --version
```

### Validation

```bash
# Exhaustive command coverage + behavior checks
npm run test:plan

# Preview a create operation without writing files
re-shell create demo-app --framework react-ts --route /demo --dry-run --verbose

# Machine-readable health output
re-shell workspace health --json

# Generate tests for an app workspace path
re-shell generate test apps/my-react
```

### Create Your First Full-Stack Application

```bash
# Initialize a new full-stack project
re-shell create my-app --type full-stack
cd my-app

# Frontend: Add microfrontends
re-shell add dashboard --framework react-ts --port 5173
re-shell add admin-panel --framework vue-ts --port 5174

# Backend: Add microservices
re-shell generate backend api-service --language python --framework fastapi --port 8001
re-shell generate backend auth-service --framework express --port 8002

# Start everything with Docker orchestration
docker-compose up

# Or start individually for development
re-shell dev --all
```

### How Re-Shell Works

#### 1. **Project Structure**
Re-Shell creates a monorepo structure optimized for full-stack development:

```
my-app/
├── apps/                  # Microfrontend applications
│   ├── dashboard/         # React dashboard
│   └── admin-panel/       # Vue.js admin panel
├── services/              # Backend microservices
│   ├── api-service/       # Python FastAPI service
│   └── auth-service/      # Node.js Express service
├── packages/              # Shared libraries
│   ├── ui/                # Shared UI components
│   ├── types/             # Shared TypeScript types
│   └── sdk/               # Auto-generated API SDKs
├── docker-compose.yml     # Local development orchestration
└── re-shell.config.yaml   # Project configuration
```

#### 2. **Microfrontend Generation**
When you run `re-shell add dashboard --framework react-ts`, the CLI:

- Creates a complete React application with TypeScript
- Configures Module Federation for runtime integration
- Sets up a development server with hot reload
- Implements microfrontend patterns (mount/unmount, event bus)
- Generates production-ready build configurations
- Includes Docker support for containerization

#### 3. **Microservice Generation**
When you run `re-shell generate backend api-service --language python --framework fastapi`, the CLI:

- Creates a complete FastAPI project structure
- Includes database models and migrations
- Sets up API documentation (OpenAPI/Swagger)
- Configures testing with pytest
- Implements authentication and middleware
- Generates Docker configuration
- Includes hot-reload for development

### Launch Development Environment

```bash
# Start all services in development mode
re-shell dev --all

# Start specific services
re-shell dev user-service payment-service

# View service health dashboard
re-shell doctor --interactive
```

## 🏗️ Architecture

Re-Shell CLI implements a modern distributed architecture pattern that combines microservices backends with microfrontend presentation layers, providing maximum flexibility and scalability.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Re-Shell Platform                           │
├─────────────────────────────────────────────────────────────────┤
│  🎯 Microfrontend Layer                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │   React     │ │    Vue.js   │ │   Svelte    │                │
│  │ Dashboard   │ │  Catalog    │ │  Analytics  │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
│         │               │               │                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Shell Application                          │    │
│  │           (Module Federation)                           │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  🔗 API Gateway & Service Mesh                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Load Balancer │ Auth │ Rate Limit │ Circuit Breaker    │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  🏗️ Microservices Layer                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │  Node.js    │ │   Python    │ │    Rust     │                │
│  │ User Service│ │Payment API  │ │Notification │                │
│  │ (Express)   │ │ (FastAPI)   │ │  (Actix)    │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
├─────────────────────────────────────────────────────────────────┤
│  💾 Data Layer                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │ PostgreSQL  │ │   MongoDB   │ │    Redis    │                │
│  │   Users     │ │  Analytics  │ │   Cache     │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

### Architecture Principles

- **🔌 Polyglot Persistence**: Choose the right database for each service
- **🌐 Language Agnostic**: Use the best language for each domain
- **📦 Container First**: Docker and Kubernetes native
- **🔄 Event Driven**: Asynchronous communication patterns
- **🛡️ Security by Design**: Zero-trust architecture implementation
- **📊 Observability**: Comprehensive monitoring and tracing

## 🔧 Microservices Templates

### Node.js Ecosystem

#### Express.js Template
```bash
re-shell create api-service --template express-ts
```
**Features**: Middleware composition, JWT auth, health checks, Docker ready
**Use Cases**: REST APIs, traditional web services, rapid prototyping

#### Fastify Template
```bash
re-shell create high-perf-api --template fastify-ts
```
**Features**: Schema validation, plugin architecture, high performance
**Use Cases**: High-throughput APIs, real-time services, performance-critical applications

#### NestJS Template
```bash
re-shell create enterprise-api --template nestjs-ts
```
**Features**: Dependency injection, decorators, enterprise architecture
**Use Cases**: Large-scale applications, complex business logic, team collaboration

#### Koa.js Template
```bash
re-shell create modern-api --template koa-ts
```
**Features**: Modern async/await, middleware composition, lightweight
**Use Cases**: Modern APIs, middleware-heavy applications, clean architecture

### Python Ecosystem ✅ **Complete**

#### FastAPI Template
```bash
re-shell create python-api --template fastapi
```
**Features**: Automatic OpenAPI, type hints, async support, dependency injection, WebSocket support, comprehensive testing
**Use Cases**: ML APIs, data processing, high-performance APIs, real-time services
**Testing**: pytest-asyncio, TestClient, AsyncClient, dependency overrides, WebSocket testing

#### Django Template
```bash
re-shell create web-service --template django
```
**Features**: Django REST Framework, admin interface, ORM, custom management commands, comprehensive testing
**Use Cases**: Enterprise web applications, content management, admin dashboards
**Testing**: Django test framework, DRF testing, model testing, management command testing

#### Flask Template
```bash
re-shell create lightweight-api --template flask
```
**Features**: Blueprint architecture, SQLAlchemy integration, CLI commands, comprehensive testing
**Use Cases**: Lightweight APIs, microservices, rapid prototyping
**Testing**: Flask testing client, app contexts, blueprint testing, CLI testing

#### Tornado Template
```bash
re-shell create async-service --template tornado
```
**Features**: High-performance async, WebSocket support, non-blocking I/O, comprehensive testing
**Use Cases**: Real-time applications, WebSocket services, high-concurrency systems
**Testing**: AsyncHTTPTestCase, WebSocket testing, performance testing

#### Sanic Template
```bash
re-shell create ultra-fast-api --template sanic
```
**Features**: Ultra-fast async framework, blueprint architecture, middleware system, comprehensive testing
**Use Cases**: High-performance APIs, async microservices, speed-critical applications
**Testing**: Sanic TestClient, async testing, middleware testing, rate limiting tests

### 🧪 Python Testing Excellence

All Python templates include enterprise-grade testing infrastructure:

#### Comprehensive pytest Configuration
- **pytest-asyncio**: Full async testing support with event loop management
- **pytest-cov**: 85% coverage threshold with HTML, XML, JSON reports
- **pytest-xdist**: Parallel test execution with worksteal distribution
- **pytest-benchmark**: Performance regression testing and monitoring

#### Framework-Specific Testing
- **FastAPI**: TestClient, AsyncClient, dependency injection testing, WebSocket testing
- **Django**: Model testing, DRF testing, admin testing, management command testing
- **Flask**: Blueprint testing, app context testing, CLI testing, template testing
- **Tornado**: AsyncHTTPTestCase, WebSocket testing, IOLoop testing, performance testing
- **Sanic**: Async testing, middleware testing, rate limiting testing, security testing

#### Test Utilities & Fixtures
- **Authentication**: JWT token generation, user fixtures, permission testing
- **Database**: Transaction rollback, data seeding, cleanup utilities
- **HTTP**: Status assertion, JSON validation, header checking, content validation
- **Files**: Upload testing, download testing, temporary file management
- **Performance**: Memory monitoring, execution time tracking, benchmark utilities

#### Advanced Testing Features
- **Test Markers**: unit, integration, e2e, performance, security categorization
- **Mock Services**: Redis, database, external API mocking with realistic behavior
- **Data Generation**: Factory patterns, fake data generation, random test data
- **Error Scenarios**: Exception testing, validation error testing, edge case coverage
- **Async Testing**: Wait conditions, eventual assertions, retry mechanisms

### 🎯 Modern Python Type System

All templates include comprehensive type hints with Python 3.11+ features:

#### Advanced Typing Features
- **Self**: Self-referential type annotations for method chaining
- **Literal**: Exact value type specifications for enhanced safety
- **Protocol**: Duck typing with structural subtyping
- **TypeGuard**: Runtime type checking with static analysis support
- **Generic**: Type variable support for reusable components

#### Framework-Specific Types
- **FastAPI**: Pydantic models, dependency injection types, route handler types
- **Django**: Model types, QuerySet types, admin types, form types
- **Flask**: Blueprint types, request/response types, view function types
- **Tornado**: Handler types, WebSocket types, async types
- **Sanic**: Request/response types, middleware types, blueprint types

#### Tool Configuration
- **MyPy**: Strict type checking with framework-specific overrides
- **Pyright**: Advanced type analysis with error reporting
- **Ruff**: Fast linting with type-aware rules and automatic fixes

### 🔷 .NET Ecosystem ✅ **Complete**

#### ASP.NET Core Web API Template
```bash
re-shell create enterprise-api --template aspnet-core-webapi
```
**Features**: Full MVC architecture, Identity framework, JWT authentication, Entity Framework Core, comprehensive middleware
**Use Cases**: Enterprise applications, complex business logic, team collaboration, comprehensive API development

#### ASP.NET Core Minimal API Template
```bash
re-shell create lightweight-api --template aspnet-core-minimal
```
**Features**: Functional endpoints, AOT compilation, output caching, rate limiting, high performance
**Use Cases**: High-throughput APIs, cloud-native services, performance-critical applications

#### Blazor Server Template
```bash
re-shell create full-stack-app --template blazor-server
```
**Features**: Full-stack .NET development, real-time UI updates, SignalR integration, server-side rendering
**Use Cases**: Interactive web applications, real-time dashboards, enterprise portals

#### gRPC Service Template
```bash
re-shell create grpc-service --template grpc-service
```
**Features**: Protocol Buffers, streaming support, performance optimization, cross-platform communication
**Use Cases**: Microservice communication, high-performance APIs, real-time data streaming

#### Entity Framework Core Template
```bash
re-shell create data-service --template aspnet-efcore
```
**Features**: Code-first migrations, entity configurations, audit logging, soft delete, advanced relationships
**Use Cases**: Data-intensive applications, complex domain models, enterprise data management

#### Dapper Template
```bash
re-shell create high-perf-data --template aspnet-dapper
```
**Features**: High-performance data access, repository pattern, transaction management, SQL optimization
**Use Cases**: Performance-critical data operations, complex queries, high-throughput systems

#### AutoMapper Template
```bash
re-shell create mapping-service --template aspnet-automapper
```
**Features**: Object-to-object mapping, custom profiles, validation integration, performance optimization
**Use Cases**: Complex data transformations, API integration, clean architecture implementations

#### xUnit Testing Template
```bash
re-shell create tested-api --template aspnet-xunit
```
**Features**: Unit tests, integration tests, test fixtures, FluentAssertions, Moq, test containers
**Use Cases**: Test-driven development, quality assurance, continuous integration

#### Hot Reload Template
```bash
re-shell create dev-optimized --template aspnet-hotreload
```
**Features**: dotnet watch integration, development utilities, file monitoring, instant feedback
**Use Cases**: Rapid development, prototyping, developer productivity optimization

#### Serilog Template
```bash
re-shell create monitored-api --template aspnet-serilog
```
**Features**: Structured logging, multiple sinks, performance monitoring, audit trails, correlation tracking
**Use Cases**: Production monitoring, debugging, compliance, performance analysis

#### Swagger/OpenAPI Template
```bash
re-shell create documented-api --template aspnet-swagger
```
**Features**: Interactive documentation, code generation, XML comments, versioning, authentication schemas
**Use Cases**: API documentation, client generation, developer portals, integration testing

#### JWT Authentication Template
```bash
re-shell create secure-api --template aspnet-jwt
```
**Features**: Complete auth system, 2FA, external OAuth, rate limiting, authorization policies
**Use Cases**: Secure applications, user management, enterprise authentication, compliance

### 🔷 .NET Universal Features

All .NET templates include enterprise-grade capabilities:
- **🔐 Advanced Authentication**: JWT with 2FA, external OAuth (Google, Facebook, Microsoft), Identity framework
- **📊 Comprehensive Monitoring**: Serilog with multiple sinks (Console, File, Database, Elasticsearch, Seq)
- **🗄️ Database Integration**: Entity Framework Core with migrations, Dapper for performance, repository patterns
- **📚 Documentation**: Swagger/OpenAPI with code generation, XML documentation, interactive examples
- **🧪 Testing Excellence**: xUnit with FluentAssertions, Moq, integration tests, test containers
- **⚡ Development Experience**: Hot reload with dotnet watch, file monitoring, development utilities
- **🏗️ Architecture Patterns**: Clean architecture, CQRS, repository pattern, dependency injection
- **🛡️ Security**: Authorization policies, rate limiting, security headers, CORS configuration
- **📈 Performance**: Output caching, Redis integration, AOT compilation, performance monitoring
- **🐳 Infrastructure**: Docker support, health checks, configuration management, logging

### 🐹 Go Ecosystem ✅ **Complete**

#### Gin Template
```bash
re-shell create api-service --template go-gin
```
**Features**: Middleware chain, JWT auth with custom claims, graceful shutdown, structured logging with Zap
**Use Cases**: REST APIs, microservices, high-performance web services

#### Echo Template
```bash
re-shell create modern-api --template go-echo
```
**Features**: Minimalist design, powerful routing, built-in middleware, OpenAPI integration
**Use Cases**: Modern APIs, lightweight services, rapid development

#### Fiber Template
```bash
re-shell create fast-api --template go-fiber
```
**Features**: Express-inspired API, extreme performance, WebSocket support, built-in monitoring
**Use Cases**: High-throughput APIs, real-time services, Express developers transitioning to Go

#### Chi Template
```bash
re-shell create composable-api --template go-chi
```
**Features**: Composable routing, stdlib compatible, lightweight middleware, RESTful design
**Use Cases**: Clean architecture, composable APIs, standard library focused projects

#### gRPC Template
```bash
re-shell create grpc-service --template go-grpc
```
**Features**: Protocol Buffers, streaming support, interceptors, service discovery ready
**Use Cases**: Microservice communication, high-performance RPC, polyglot services

#### Go with sqlx Template
```bash
re-shell create data-service --template go-sqlx
```
**Features**: Type-safe SQL, prepared statements, transaction support, migration system
**Use Cases**: Database-centric services, complex queries, performance-critical data operations

### 🐹 Go Universal Features

All Go templates include enterprise-grade capabilities:
- **🗄️ Database Integration**: GORM ORM with migrations, sqlx for raw SQL, connection pooling
- **🔐 Security**: JWT authentication, bcrypt password hashing, rate limiting, CORS
- **📊 Monitoring**: Structured logging (Zap/Zerolog), Prometheus metrics, health endpoints
- **🧪 Testing**: Testify framework, mocking support, coverage reports, benchmarks
- **⚡ Performance**: Connection pooling, graceful shutdown, context propagation
- **🛠️ Development**: Hot reload with Air, environment config, Docker support
- **🏗️ Architecture**: Clean architecture, dependency injection, middleware patterns
- **📚 Documentation**: OpenAPI/Swagger integration, inline documentation
- **🐳 DevOps**: Multi-stage Docker builds, Alpine Linux, minimal images

### 💎 Ruby Ecosystem ✅ **Complete**

#### Ruby on Rails API Template
```bash
re-shell create rest-api --template ruby-rails-api
```
**Features**: Active Record ORM, JWT authentication, background jobs with Sidekiq, comprehensive testing with RSpec
**Use Cases**: Full-featured REST APIs, enterprise applications, rapid API development

#### Sinatra Template
```bash
re-shell create lightweight-api --template ruby-sinatra
```
**Features**: Minimal overhead, modular architecture, ActiveRecord integration, Swagger documentation
**Use Cases**: Microservices, lightweight APIs, simple web services, prototyping

#### Grape Template
```bash
re-shell create grape-api --template ruby-grape
```
**Features**: RESTful API framework, parameter validation, entity serialization, automatic documentation
**Use Cases**: API-only applications, microservices, versioned APIs, high-performance services

### 💎 Ruby Universal Features

All Ruby templates include production-ready capabilities:
- **🗄️ Database Integration**: ActiveRecord ORM with migrations, PostgreSQL support, connection pooling
- **🔐 Security**: JWT authentication, bcrypt password hashing, Rack::Attack rate limiting
- **📊 Monitoring**: Structured logging, health check endpoints, performance monitoring
- **🧪 Testing**: RSpec framework, FactoryBot fixtures, database cleaner, coverage reports
- **⚡ Performance**: Redis caching, Sidekiq background jobs, connection pooling
- **🛠️ Development**: Hot reload with Rerun/Guard, environment management with Dotenv
- **🏗️ Architecture**: MVC/REST patterns, modular design, middleware composition
- **📚 Documentation**: Swagger/OpenAPI integration, YARD documentation
- **🐳 DevOps**: Docker support, multi-stage builds, production configurations

### 🐘 PHP Ecosystem ✅ **Complete**

#### Symfony Template
```bash
re-shell create enterprise-api --template php-symfony
```
**Features**: Full MVC framework, Doctrine ORM, dependency injection, event system, comprehensive testing
**Use Cases**: Enterprise applications, complex business logic, large teams

#### Laravel Template
```bash
re-shell create rapid-api --template php-laravel
```
**Features**: Eloquent ORM, artisan CLI, queue system, broadcasting, comprehensive ecosystem
**Use Cases**: Rapid development, full-featured applications, SaaS platforms

#### Slim Template
```bash
re-shell create micro-api --template php-slim
```
**Features**: PSR-7/PSR-15 compliant, middleware pipeline, dependency container, minimal footprint
**Use Cases**: Microservices, APIs, lightweight applications

#### CodeIgniter 4 Template
```bash
re-shell create simple-api --template php-codeigniter
```
**Features**: MVC pattern, built-in security, database abstraction, RESTful routing
**Use Cases**: Small to medium projects, learning PHP, rapid prototyping

### 🐘 PHP Universal Features

All PHP templates include modern PHP development features:
- **🏗️ Modern PHP**: PHP 8.2+ with typed properties, attributes, enums
- **📦 Composer**: Dependency management with autoloading
- **🗄️ Database**: Migrations, query builders, ORM integration
- **🧪 Testing**: PHPUnit integration, fixtures, code coverage
- **🔐 Security**: CSRF protection, XSS filtering, SQL injection prevention
- **⚡ Performance**: OPcache, connection pooling, Redis caching
- **🐳 Docker**: PHP-FPM, Nginx/Apache, multi-stage builds
- **📊 Monitoring**: Error logging, health checks, metrics endpoints

### Additional Languages *(Roadmap)*

- **💎 Ruby**: Rails API, Sinatra, Hanami
- **🔷 Java**: Spring Boot (already mentioned above), Quarkus, Micronaut, Vert.x
- **⚡ Elixir**: Phoenix, Plug
- **🦀 More Rust frameworks**: Tide, Poem

## 🎯 Microfrontend Templates

Re-Shell CLI provides enterprise-grade microfrontend architecture using **Webpack Module Federation**, enabling true microfrontend patterns with dynamic loading, independent deployment, and runtime integration.

### 🏗️ **Module Federation Architecture**

```bash
# Create complete microfrontend platform
re-shell create my-platform --type microfrontend --architecture module-federation

# Generate shell application (host)
re-shell create shell-app --template federation-shell --port 3100

# Generate microfrontend applications (remotes)
re-shell create react-dashboard --template react-mf --port 3000
re-shell create vue-catalog --template vue-mf --port 3001
re-shell create svelte-analytics --template svelte-mf --port 3002
```

### ⚛️ **React Microfrontend**

```bash
re-shell create user-dashboard --template react-mf --port 3000
```
**Features**:
- React 18 with Hooks and Suspense
- Module Federation with dynamic imports
- Error boundaries for isolated failures
- Hot module replacement
- TypeScript support
- Real-time backend integration

**Architecture**:
- Exposes: `./App` component for shell consumption
- Shared: React runtime with singleton pattern
- Independent: Can run standalone or federated

### 🟢 **Vue.js Microfrontend**

```bash
re-shell create product-catalog --template vue-mf --port 3001
```
**Features**:
- Vue 3 Composition API
- Reactive state management
- Module Federation integration
- Component-based architecture
- TypeScript support
- Live data binding

**Architecture**:
- Exposes: `./App` Vue component
- Shared: Vue runtime optimization
- Independent: Standalone development capability

### 🔥 **Svelte Microfrontend**

```bash
re-shell create analytics-widget --template svelte-mf --port 3002
```
**Features**:
- Compile-time optimization
- Minimal runtime overhead
- Reactive programming model
- Module Federation support
- Performance-critical rendering

**Architecture**:
- Exposes: Compiled Svelte components
- Shared: Minimal shared dependencies
- Independent: Ultra-fast standalone execution

### 🅰️ **Angular Microfrontend** *(Enterprise Ready)*

```bash
re-shell create enterprise-app --template angular-mf --port 3003
```
**Features**:
- Angular 17+ with standalone components
- Dependency injection at microfrontend level
- Module Federation with Angular Elements
- Enterprise-grade architecture
- Comprehensive testing framework

**Architecture**:
- Exposes: Angular Elements for federation
- Shared: Angular runtime with zone isolation
- Independent: Full Angular CLI compatibility

### 🏠 **Shell Application (Host)**

The shell application orchestrates all microfrontends:

```bash
re-shell create platform-shell --template federation-shell
```

**Features**:
- **Dynamic Loading**: Load microfrontends on-demand
- **Error Boundaries**: Isolated failure handling per microfrontend
- **Unified Routing**: Seamless navigation between microfrontends
- **Service Health**: Real-time monitoring of all services
- **Loading States**: Smooth UX during microfrontend loading
- **Fallback UI**: Graceful degradation when microfrontends fail

### 🔧 **Development Experience**

```bash
# Start complete microfrontend platform
re-shell dev --microfrontends --all

# Development with hot reload
re-shell dev --mf-mode development --watch

# Production build with optimization
re-shell build --microfrontends --federation --optimize
```

**Development Features**:
- **Independent Development**: Teams work on separate microfrontends
- **Hot Module Replacement**: Live updates without page refresh
- **Cross-Framework**: Mix React, Vue, Svelte, Angular seamlessly
- **Shared Dependencies**: Optimized bundle sizes
- **Runtime Integration**: No build-time coupling

### 📊 **Best Practices Implementation**

- **🔒 Isolation**: Each microfrontend is completely independent
- **📦 Shared Dependencies**: Optimized bundle management
- **🔄 Communication**: Event-driven inter-app communication
- **🛡️ Error Handling**: Graceful degradation and fallbacks
- **🎯 Performance**: Lazy loading and code splitting
- **🧪 Testing**: Independent testing strategies per microfrontend

## 🎛️ Core Features

### 🏗️ **Project Generation**

```bash
# Create workspace
re-shell init my-platform --type hybrid

# Generate microservice
re-shell create user-service --template nestjs-ts --database postgresql

# Generate microfrontend
re-shell create user-ui --template react-ts --route /users --port 4001

# Generate full-stack feature
re-shell generate feature user-management --include backend,frontend,database
```

### 📊 **Health Diagnostics & Monitoring**

```bash
# Comprehensive health check
re-shell doctor

# Interactive dashboard
re-shell doctor --interactive

# Service-specific diagnostics
re-shell doctor user-service --detailed

# Performance analysis
re-shell analyze --performance --services all
```

### 🔄 **Development Workflow**

```bash
# Start development environment
re-shell dev --all --watch

# Hot reload with dependency tracking
re-shell dev --hot-reload --cascade-restart

# Debug mode with detailed logging
re-shell dev --debug --log-level verbose

# Test all services
re-shell test --all --coverage
```

### 🚀 **Build & Deployment**

```bash
# Build all services
re-shell build --all --optimize

# Docker containerization
re-shell build --docker --multi-stage

# Kubernetes deployment
re-shell deploy --target k8s --namespace production

# CI/CD pipeline generation
re-shell cicd generate --provider github-actions
```

## 🎨 Advanced Features

### 🔌 **Plugin Ecosystem**

```bash
# Install plugins
re-shell plugin install @re-shell/monitoring
re-shell plugin install @re-shell/security-scanner

# List available plugins
re-shell plugin marketplace

# Create custom plugin
re-shell plugin create my-custom-plugin
```

### 📈 **Bundle Analysis & Optimization**

```bash
# Analyze bundle sizes
re-shell analyze bundle --interactive

# Performance insights
re-shell analyze performance --report

# Dependency analysis
re-shell analyze deps --security-scan
```

### 🔄 **Workspace Management**

```bash
# Workspace health check
re-shell workspace doctor

# Dependency graph visualization
re-shell workspace graph --interactive

# Workspace migration
re-shell workspace migrate --from 0.8.0 --to 0.9.0
```

### 🛠️ **Code Generation**

```bash
# Generate API endpoints
re-shell generate api users --crud --auth

# Generate database migrations
re-shell generate migration add-user-roles

# Generate test suites
re-shell generate tests --coverage 90
```

## ☁️ DevOps & Deployment

### 🐳 **Container Orchestration**

```bash
# Docker Compose generation
re-shell docker compose --services all --networks custom

# Kubernetes manifests
re-shell k8s generate --helm-charts --monitoring

# Service mesh configuration
re-shell service-mesh setup --provider istio
```

### 🔄 **CI/CD Pipeline Generation**

```bash
# GitHub Actions
re-shell cicd generate --provider github-actions --deploy-to k8s

# GitLab CI
re-shell cicd generate --provider gitlab-ci --include-security-scan

# Jenkins Pipeline
re-shell cicd generate --provider jenkins --multi-stage
```

### 📊 **Monitoring & Observability**

```bash
# Prometheus & Grafana setup
re-shell monitoring setup --provider prometheus --dashboards included

# Distributed tracing
re-shell tracing setup --provider jaeger

# Log aggregation
re-shell logging setup --provider elk-stack
```

## 🏢 Enterprise Features

### 🛡️ **Security & Compliance**

- **Authentication**: OAuth2, SAML, JWT, multi-factor authentication
- **Authorization**: RBAC, ABAC, fine-grained permissions
- **Security Scanning**: Dependency vulnerabilities, code analysis
- **Compliance**: SOC2, GDPR, HIPAA ready templates

### 📊 **Analytics & Reporting**

- **Performance Metrics**: Real-time service performance monitoring
- **Business Intelligence**: Custom dashboards and reporting
- **Usage Analytics**: User behavior and system usage tracking
- **Cost Analysis**: Resource utilization and cost optimization

### 🔧 **Enterprise Integration**

- **Service Discovery**: Consul, Eureka, Kubernetes native
- **API Gateway**: Kong, Ambassador, Istio integration
- **Message Queues**: RabbitMQ, Apache Kafka, Redis Streams
- **Databases**: PostgreSQL, MongoDB, Cassandra, Redis clusters

## 📋 CLI Commands Reference

### Core Commands

| Command | Description | Example |
|---------|-------------|---------|
| `init` | Initialize workspace | `re-shell init my-platform` |
| `create` | Create service/frontend | `re-shell create api --template express-ts` |
| `dev` | Start development | `re-shell dev --all` |
| `build` | Build services | `re-shell build --optimize` |
| `test` | Run tests | `re-shell test --coverage` |
| `deploy` | Deploy to environment | `re-shell deploy --target production` |

### Advanced Commands

| Command | Description | Example |
|---------|-------------|---------|
| `doctor` | Health diagnostics | `re-shell doctor --interactive` |
| `analyze` | Bundle/performance analysis | `re-shell analyze --performance` |
| `generate` | Code generation | `re-shell generate api users` |
| `migrate` | Migration tools | `re-shell migrate --from 0.8.0` |
| `plugin` | Plugin management | `re-shell plugin install monitoring` |
| `workspace` | Workspace operations | `re-shell workspace graph` |

### DevOps Commands

| Command | Description | Example |
|---------|-------------|---------|
| `cicd` | CI/CD generation | `re-shell cicd generate --provider github` |
| `docker` | Container operations | `re-shell docker compose` |
| `k8s` | Kubernetes operations | `re-shell k8s generate --helm` |
| `monitoring` | Setup monitoring | `re-shell monitoring setup` |
| `backup` | Backup operations | `re-shell backup create --full` |

## ⚙️ Configuration

### Global Configuration

```yaml
# ~/.re-shell/config.yaml
version: "1.0"
defaults:
  packageManager: "pnpm"
  framework: "typescript"
  containerRuntime: "docker"
  kubernetesProvider: "local"
templates:
  backend:
    default: "express-ts"
    security: "strict"
  frontend:
    default: "react-ts"
    bundler: "vite"
plugins:
  autoUpdate: true
  marketplace: "https://marketplace.re-shell.dev"
```

### Project Configuration

```yaml
# .re-shell/config.yaml
name: "my-platform"
version: "0.9.0"
type: "hybrid" # microservices | microfrontend | hybrid
architecture:
  gateway: "nginx"
  serviceMesh: "istio"
  monitoring: "prometheus"
services:
  - name: "user-service"
    type: "backend"
    template: "express-ts"
    port: 3001
  - name: "user-dashboard"
    type: "frontend"
    template: "react-ts"
    port: 4001
    route: "/dashboard"
```

## 🎯 Examples

For task-focused, file-by-file workflow examples, start with `examples/README.md`. Keep `EXAMPLES.md` for the long-form reference and release walkthroughs.

### E-Commerce Platform

```bash
# Initialize e-commerce platform
re-shell init ecommerce-platform --template ecommerce

# Backend services
re-shell create user-service --template nestjs-ts --database postgresql
re-shell create product-service --template fastapi --database mongodb
re-shell create order-service --template express-ts --database postgresql
re-shell create payment-service --template spring-boot --database postgresql

# Frontend applications
re-shell create admin-dashboard --template react-ts --route /admin
re-shell create customer-portal --template vue-ts --route /shop
re-shell create mobile-app --template react-native

# Infrastructure
re-shell cicd generate --provider github-actions
re-shell k8s generate --include monitoring,logging
```

### Financial Services Platform

```bash
# Initialize fintech platform
re-shell init fintech-platform --template financial-services

# Core services
re-shell create account-service --template spring-boot --security high
re-shell create transaction-service --template rust-actix --performance optimized
re-shell create reporting-service --template django --analytics enabled
re-shell create notification-service --template go-gin --realtime

# Compliance and security
re-shell security scan --all-services
re-shell compliance check --standard pci-dss
re-shell audit generate --quarterly-report
```

## 📊 Best Practices

### 🏗️ **Architecture Guidelines**

1. **Service Boundaries**: Define clear service boundaries based on business domains
2. **Data Consistency**: Use event sourcing for distributed data consistency
3. **API Design**: Follow REST and GraphQL best practices
4. **Security**: Implement zero-trust security model
5. **Monitoring**: Set up comprehensive observability from day one

### 🔄 **Development Workflow**

1. **Feature Development**: Use feature branches with automated testing
2. **Code Review**: Implement mandatory code reviews with automated checks
3. **Testing Strategy**: Follow testing pyramid (unit → integration → e2e)
4. **Deployment**: Use blue-green or canary deployment strategies
5. **Rollback**: Always have automated rollback capabilities

### 📊 **Performance Optimization**

1. **Caching Strategy**: Implement multi-level caching (CDN → Redis → Application)
2. **Database Design**: Use appropriate database patterns for each service
3. **Load Balancing**: Implement intelligent load balancing with health checks
4. **Resource Management**: Monitor and optimize resource utilization
5. **Scaling**: Design for horizontal scaling from the beginning

## 🤝 Contributing

We welcome contributions from the community! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/umutkorkmaz/re-shell-cli.git
cd cli

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test

# Start development
pnpm dev
```

### Contribution Areas

- 🔧 **Template Development**: Create new microservice/microfrontend templates
- 🐛 **Bug Fixes**: Help identify and fix issues
- 📚 **Documentation**: Improve documentation and examples
- 🎨 **Features**: Implement new CLI features and capabilities
- 🧪 **Testing**: Improve test coverage and quality
- 🌐 **Internationalization**: Add support for multiple languages

## 💬 Support

### Community Support

- **GitHub Discussions**: [https://github.com/umutkorkmaz/re-shell-cli/discussions](https://github.com/umutkorkmaz/re-shell-cli/discussions)
- **Discord Community**: [https://discord.gg/re-shell](https://discord.gg/re-shell)
- **Stack Overflow**: Tag questions with `re-shell-cli`

### Documentation

- **Official Documentation**: [https://docs.re-shell.dev](https://docs.re-shell.dev)
- **API Reference**: [https://api.re-shell.dev](https://api.re-shell.dev)
- **Video Tutorials**: [https://learn.re-shell.dev](https://learn.re-shell.dev)

### Enterprise Support

For enterprise support, consulting, and custom development:
- **Email**: enterprise@re-shell.dev
- **Website**: [https://enterprise.re-shell.dev](https://enterprise.re-shell.dev)

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Open Source Community**: For the amazing tools and libraries that make this possible
- **Contributors**: All the developers who have contributed to this project
- **Users**: The community of developers using Re-Shell CLI in production

## 📄 License

Re-Shell CLI is open source software released under the **MIT License**. This means you can:

- ✅ Use it commercially
- ✅ Modify it for your needs
- ✅ Distribute it freely
- ✅ Use it in private projects
- ✅ Sublicense it

See the [LICENSE](./LICENSE) file for the full license text.

---

<div align="center">

**[Website](https://re-shell.dev)** •
**[Documentation](https://docs.re-shell.dev)** •
**[Examples](https://examples.re-shell.dev)** •
**[Community](https://community.re-shell.dev)**

Made with ❤️ by the Re-Shell Team | Open Source MIT License

</div>
