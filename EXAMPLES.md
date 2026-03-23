# Re-Shell CLI Examples

Need a smaller, feature-by-feature entry point? Start with `examples/README.md` in this package for grouped workflow guides.

This document provides comprehensive real-world scenarios and examples for using the Re-Shell CLI to build full-stack applications with microfrontends and microservices.

## Table of Contents

1. [Latest Features](#latest-features)
   - [CLI Stability Fixes (v0.27.4)](#cli-stability-fixes-v0274)
   - [Extended Init Templates & Workspace Types (v0.27.0)](#extended-init-templates--workspace-types-v0270)
   - [Complete C++ Ecosystem (v0.24.0)](#complete-c-ecosystem-v0240)
   - [Complete Go Ecosystem (v0.22.1)](#complete-go-ecosystem-v0221)
   - [Complete Ruby Ecosystem (v0.23.0)](#complete-ruby-ecosystem-v0230)
   - [Complete PHP Ecosystem (v0.21.0)](#complete-php-ecosystem-v0210)
   - [Complete .NET Ecosystem (v0.20.0)](#complete-net-ecosystem-v0200)
   - [Complete Rust Ecosystem (v0.17.0)](#complete-rust-ecosystem-v0170)
   - [Full-Stack Platform (v0.16.3)](#full-stack-platform-v0163)
   - [Microfrontend Architecture (v0.16.0)](#microfrontend-architecture-v0160)
   - [Python Ecosystem Complete (v0.15.0)](#python-ecosystem-complete-v0150)
   - [Phase 0 Complete (v0.8.0)](#phase-0-complete-v080)
   - [Performance & Resource Management (v0.7.2)](#performance--resource-management-v072)
   - [Plugin Ecosystem (v0.7.1)](#plugin-ecosystem-v071)
   - [Real-Time Development (v0.4.0)](#real-time-development-v040)
   - [Enterprise Features (v0.3.1)](#enterprise-features-v031)
2. [Getting Started](#getting-started)
3. [Workspace Architecture Types](#workspace-architecture-types)
   - [backend — Pure API Monorepo](#backend--pure-api-monorepo)
   - [platform — Developer Platform / OSS Toolkit](#platform--developer-platform--oss-toolkit)
   - [desktop — Cross-Platform Desktop App](#desktop--cross-platform-desktop-app)
   - [mobile — React Native / Expo](#mobile--react-native--expo)
   - [edge — Edge-First Serverless](#edge--edge-first-serverless)
   - [data-platform — Data Engineering](#data-platform--data-engineering)
4. [Domain Starter Templates](#domain-starter-templates)
   - [ai-app — AI-Native Application](#ai-app--ai-native-application)
   - [devtools — Developer Tooling / OSS](#devtools--developer-tooling--oss)
   - [marketplace — Two-Sided Marketplace](#marketplace--two-sided-marketplace)
   - [social — Social / Community Platform](#social--social--community-platform)
   - [blog — Content Publishing Platform](#blog--content-publishing-platform)
   - [fintech — Financial Services App](#fintech--financial-services-app)
   - [healthcare — Patient / Provider Portal](#healthcare--patient--provider-portal)
   - [gaming — Gaming Platform](#gaming--gaming-platform)
   - [iot — IoT Device Management](#iot--iot-device-management)
   - [cms — Content Management System](#cms--content-management-system)
5. [Full-Stack Applications](#full-stack-applications)
   - [E-commerce Platform](#e-commerce-platform)
   - [Banking Dashboard](#banking-dashboard)
   - [SaaS Admin Panel](#saas-admin-panel)
   - [Healthcare Portal](#healthcare-portal)
   - [Educational Platform](#educational-platform)
6. [Advanced Scenarios](#advanced-scenarios)

## Latest Features

### Structured Example Library (v0.27.5)

```bash
# Browse the new guide index
cat examples/README.md

# Open the core command examples
cat examples/core-workflows.md

# Jump straight to grouped feature references
cat examples/workspace-and-config.md
cat examples/scaffolding-api-and-generation.md
cat examples/services-tools-and-quality.md
cat examples/plugins-and-data.md
cat examples/cloud-k8s-and-observability.md
cat examples/security-collaboration-and-learning.md
```

### CLI Stability Fixes (v0.27.4)

These examples cover the command paths hardened in the `0.27.4` patch release.

```bash
# Machine-readable JSON stays clean even when NO_COLOR is exported
NO_COLOR=1 re-shell list --json
NO_COLOR=1 re-shell workspace health --json

# Nested --version belongs to the API spec, not the CLI banner
re-shell api openapi generate --output ./openapi.yaml --format yaml --title "Manual Test API" --version 0.25.1
re-shell api client validate ./openapi.yaml

# Diagnostics and framework lists render cleanly in interactive terminals
re-shell workspace diagnostics quick
re-shell quality test frameworks
```

### Extended Init Templates & Workspace Types (v0.27.0)

10 new architecture types and 14 domain starter templates added to `re-shell init`, covering
every major modern application pattern — from pure API backends and edge-first serverless to
AI-native apps, gaming platforms, and IoT management systems.

---

## Workspace Architecture Types

Use `--type` to select the structural pattern for your monorepo. Each type scaffolds a
different set of apps, packages, Docker topology, and CI pipeline.

### `backend` — Pure API Monorepo

No frontend shell. Multiple backend services, shared types, API gateway. Perfect for teams
building APIs consumed by mobile apps, third-party integrations, or separate frontend repos.

```bash
# Initialize a pure backend monorepo
re-shell init my-api-platform --type backend --package-manager pnpm

# Scaffolds:
#   services/api-gateway/     Express + OpenAPI aggregation
#   services/auth-service/    JWT + refresh tokens + RBAC
#   services/data-service/    CRUD + Prisma + migrations
#   packages/types/           Shared TypeScript contracts (zod schemas)
#   packages/db/              Shared Prisma client + seed scripts
#   docker-compose.yml        Postgres + Redis + all services
#   .github/workflows/        API contract tests + deploy pipeline

# Add more backend services
re-shell generate backend payments-service --framework fastify --language typescript
re-shell generate backend notification-service --framework fastapi --language python
re-shell generate backend file-service --framework gin --language go

# Generate shared API client for frontend consumers
re-shell api client generate ./openapi.yaml . --framework typescript
re-shell api client generate ./openapi.yaml . --framework react --react-query

# API contract validation and spec generation
re-shell api validate generate
re-shell api openapi generate --output ./docs/openapi.json
```

---

### `platform` — Developer Platform / OSS Toolkit

Internal developer platform or open-source toolkit. Ships a docs site, interactive playground,
publishable CLI, and a core library — all in one monorepo with a changesets publish workflow.

```bash
# Initialize an OSS platform monorepo
re-shell init my-platform --type platform --package-manager pnpm

# Scaffolds:
#   apps/docs/             Starlight docs site with versioned content
#   apps/playground/       Sandboxed interactive code runner
#   packages/cli/          Commander.js CLI tool skeleton with tests
#   packages/core/         Tree-shakeable publishable library
#   packages/tokens/       Design tokens (CSS vars + JS exports)
#   .changeset/            Changesets versioning config
#   .github/workflows/     Docs deploy + npm publish on release

# Add documentation pages
re-shell learn technical-docs my-platform --framework starlight

# Generate API reference docs from OpenAPI spec
re-shell api docs generate ./openapi.yaml ./docs

# Publish all packages
cd packages/core && npm publish
cd packages/cli && npm publish
```

---

### `desktop` — Cross-Platform Desktop App

Electron or Tauri shell hosting microfrontend renderer windows. Native OS API bridge,
auto-updater, code-signing CI, type-safe IPC layer.

```bash
# Initialize a desktop app monorepo (Electron)
re-shell init my-desktop-app --type desktop --runtime electron

# Initialize with Tauri (Rust-based, smaller binary)
re-shell init my-desktop-app --type desktop --runtime tauri

# Scaffolds:
#   apps/main/             Main Electron/Tauri process
#   apps/renderer-shell/   Main renderer window (React microfrontend host)
#   apps/renderer-tray/    System tray popover window
#   packages/native/       Type-safe IPC bridge (main ↔ renderer)
#   packages/ui/           Shared desktop UI components
#   build/                 electron-builder / tauri.conf.json
#   .github/workflows/     Code-signing + multi-platform release

# Add a new renderer window (each is an independent microfrontend)
re-shell add settings-window --template react-ts --port 5175
re-shell add onboarding-window --template react-ts --port 5176

# Build for all platforms
re-shell build --desktop --platform all
```

---

### `mobile` — React Native / Expo

Mobile-first monorepo with shared UI components and API clients across native and web targets.

```bash
# Initialize a React Native / Expo monorepo
re-shell init my-mobile-app --type mobile --package-manager pnpm

# Scaffolds:
#   apps/mobile/           Expo Router app (iOS + Android)
#   apps/web/              React web companion app (React Native Web)
#   packages/ui/           Cross-platform components (RN + Web)
#   packages/api-client/   Type-safe API client (React Query + zod)
#   packages/hooks/        Shared business logic hooks
#   eas.json               EAS Build + EAS Update config
#   .github/workflows/     Expo publish + store submission pipeline

# Add a new screen module (isolated feature microfrontend pattern)
re-shell add onboarding --template react-native --type screen
re-shell add settings --template react-native --type screen

# Generate typed API client from backend OpenAPI spec
re-shell api client generate ./openapi.yaml . --framework react

# Build and submit to stores
npx eas build --platform all
npx eas submit --platform ios
```

---

### `edge` — Edge-First Serverless

Cloudflare Workers / Deno Deploy / Vercel Edge monorepo. Per-route worker isolation,
KV/D1/R2 bindings, global deployment pipeline.

```bash
# Initialize an edge-first monorepo (Cloudflare Workers)
re-shell init my-edge-app --type edge --provider cloudflare

# Initialize for Deno Deploy
re-shell init my-edge-app --type edge --provider deno

# Scaffolds (Cloudflare):
#   workers/api/           Hono-based API worker with D1 SQL bindings
#   workers/auth/          Auth worker (JWT validation at edge)
#   workers/assets/        Static asset worker with R2 storage
#   packages/types/        Shared TypeScript types + env bindings
#   wrangler.toml          Workers config with KV/D1/R2 namespaces
#   .github/workflows/     wrangler deploy pipeline

# Add a new edge worker
re-shell generate backend image-resize --framework hono --language typescript --target edge

# Deploy all workers
npx wrangler deploy --env production

# Preview locally
npx wrangler dev
```

---

### `data-platform` — Data Engineering

Data engineering monorepo: ingestion pipelines, ML model serving, dashboards, notebooks.

```bash
# Initialize a data engineering monorepo
re-shell init my-data-platform --type data-platform --package-manager pip+pnpm

# Scaffolds:
#   services/ingestion/    FastAPI ingest service (webhook + batch)
#   services/pipelines/    Prefect flow definitions + task library
#   services/ml-api/       FastAPI model serving (scikit-learn / PyTorch)
#   services/transform/    dbt project (models, tests, snapshots)
#   apps/dashboard/        Streamlit analytics dashboard
#   apps/notebooks/        JupyterHub config + starter notebooks
#   infra/                 MinIO (S3-compatible) + TimescaleDB compose
#   .github/workflows/     dbt test + Prefect deploy pipeline

# Run the full data pipeline locally
docker-compose up minio timescale prefect-server

# Add a new ML model service
re-shell generate backend recommendation-api --framework fastapi --language python \
  --features "model-serving,batch-predict,monitoring"

# Monitor pipeline runs
re-shell observe metrics my-data-platform --source prefect
```

---

## Domain Starter Templates

Use `--template` to scaffold a pre-wired vertical app with the right packages, deps, and
folder structure for your product category.

### `ai-app` — AI-Native Application

Streaming chat UI, LLM proxy with tool use, RAG pipeline, knowledge-base embedding, admin panel.
Pre-wired with the Anthropic SDK (Claude claude-sonnet-4-6 default).

```bash
# Initialize an AI application
re-shell init my-ai-app --template ai-app --package-manager pnpm

# Scaffolds:
#   apps/shell/            Streaming chat UI with message history + file upload
#   apps/admin/            Model config, cost dashboard, prompt management
#   services/api/          LLM proxy: Anthropic SDK, streaming SSE, tool-use, retries
#   services/knowledge-base/ File ingest → chunk → embed → pgvector upsert pipeline
#   packages/types/        Shared message/tool/embedding TypeScript types
#   docker-compose.yml     Postgres (pgvector) + Redis + all services

# Add more AI capabilities
re-shell generate backend voice-api --framework fastapi --language python \
  --features "whisper-transcription,tts,streaming"

re-shell generate backend image-api --framework fastify --language typescript \
  --features "vision,dalle,image-store"

# Observe LLM usage and costs
re-shell observe metrics my-ai-app --source openai
re-shell observe metrics my-ai-app --source anthropic

# Add RAG for additional document types
re-shell generate feature pdf-ingestion --type file-upload
re-shell generate feature web-scraper --type crawler
```

---

### `devtools` — Developer Tooling / OSS

Starlight docs, interactive playground, publishable CLI and core lib, changesets versioning.

```bash
# Initialize a developer tooling OSS project
re-shell init my-framework --template devtools --package-manager pnpm

# Scaffolds:
#   apps/docs/             Starlight docs site (versioned, search, API ref)
#   apps/playground/       Monaco-based interactive code runner
#   packages/cli/          Commander.js CLI with tests + help generation
#   packages/core/         Framework core (tree-shakeable, dual ESM/CJS)
#   packages/tokens/       CSS variables + JS design token exports
#   .changeset/            Changesets for semver automation
#   .github/workflows/     Docs → GitHub Pages + npm publish on tag

# Generate full API reference from OpenAPI spec
re-shell api docs generate ./openapi.yaml ./docs

# Add a new plugin package
re-shell generate module my-plugin --type package --publishable

# Release a new version
npx changeset
npx changeset version
npx changeset publish
```

---

### `marketplace` — Two-Sided Marketplace

Shell, listings, seller portal, buyer portal, admin. Stripe Connect, search, geolocation.

```bash
# Initialize a two-sided marketplace
re-shell init my-marketplace --template marketplace --package-manager pnpm

# Scaffolds:
#   apps/shell/            Host app + routing + auth
#   apps/listings/         Browse/search MFE (Meilisearch, filters, map)
#   apps/seller-portal/    Inventory, orders, payouts, analytics
#   apps/buyer-portal/     Cart, checkout, order history, reviews
#   apps/admin/            User moderation, dispute resolution, platform analytics
#   services/payments/     Stripe Connect: onboarding, payouts, escrow
#   services/search/       Meilisearch + indexing pipeline
#   packages/types/        Shared listing/order/user TypeScript types
#   docker-compose.yml     Postgres + Redis + Meilisearch + all services

# Add geolocation search
re-shell generate feature location-search --type geolocation --provider mapbox

# Add review and rating system
re-shell generate feature reviews --type crud --schema "rating,comment,author,listing"

# Set up Stripe Connect payouts
re-shell generate feature stripe-payouts --type payments --provider stripe-connect
```

---

### `social` — Social / Community Platform

Feed, profiles, messaging, notifications. Socket.io real-time, S3 media, Redis pub/sub.

```bash
# Initialize a social platform
re-shell init my-social-app --template social --package-manager pnpm

# Scaffolds:
#   apps/shell/            Host app with auth flow
#   apps/feed/             Activity feed (infinite scroll, like/comment/share)
#   apps/profile/          User profile page + follower/following graph
#   apps/messaging/        DMs + group chat (Socket.io rooms)
#   apps/notifications/    Real-time notification bell + push notification settings
#   services/media/        S3 upload + image resize + CDN serve
#   services/realtime/     Socket.io server (presence, pub/sub, typing indicators)
#   packages/types/        Shared post/user/notification TypeScript types
#   docker-compose.yml     Postgres + Redis + MinIO + all services

# Add story / ephemeral content feature
re-shell generate feature stories --type media --ttl 24h

# Add content moderation
re-shell security content-moderation my-social-app --provider aws-rekognition

# Scale real-time to multiple nodes
re-shell generate service realtime-cluster --type socket-io --adapter redis
```

---

### `blog` — Content Publishing Platform

Rich-text editor, public blog, admin, RSS. MDX, ContentLayer, SEO, image optimization.

```bash
# Initialize a content publishing platform
re-shell init my-blog --template blog --package-manager pnpm

# Scaffolds:
#   apps/shell/            Public-facing site (SSG/ISR, SEO optimized)
#   apps/blog/             Article reader (reading time, TOC, code highlighting)
#   apps/editor/           TipTap rich-text CMS (draft/publish/schedule)
#   apps/admin/            Post management, analytics, author management
#   services/rss/          RSS/Atom feed generator + sitemap
#   packages/content/      ContentLayer content schema + MDX transforms
#   packages/types/        Shared post/author/tag TypeScript types

# Add newsletter integration
re-shell generate feature newsletter --type email --provider resend

# Add comments
re-shell generate feature comments --type crud --auth required

# Add full-text search
re-shell generate feature search --type full-text --provider meilisearch

# Generate API docs from OpenAPI spec
re-shell api docs generate ./openapi.yaml ./docs
```

---

### `fintech` — Financial Services App

Accounts, payments, reporting, compliance audit trail. Plaid, Stripe, D3, PCI-DSS scaffolding.

```bash
# Initialize a fintech application
re-shell init my-fintech-app --template fintech --package-manager pnpm

# Scaffolds:
#   apps/shell/            Auth flow + dashboard entry
#   apps/accounts/         Balance display, transaction history, account linking (Plaid)
#   apps/payments/         Send/receive/recurring transfers + payment confirmation
#   apps/reporting/        D3 charts: spending trends, category breakdown, CSV export
#   apps/compliance/       Immutable audit log viewer, consent records, data export
#   services/ledger/       Double-entry accounting engine (Prisma, append-only table)
#   services/fraud/        Transaction risk scoring + alert webhook
#   packages/types/        Shared transaction/account/user TypeScript types
#   docker-compose.yml     Postgres (ledger) + Redis (rate limit) + all services

# Add bank account linking
re-shell generate feature bank-linking --type oauth --provider plaid

# Add compliance reporting
re-shell security compliance-reporting my-fintech-app --standard pci-dss

# Add fraud detection hooks
re-shell security threat-detection my-fintech-app --mode transaction-scoring
```

---

### `healthcare` — Patient / Provider Portal

FHIR R4 data models, HIPAA audit trail, encrypted fields, telemedicine WebRTC stub.

```bash
# Initialize a HIPAA-ready healthcare platform
re-shell init my-health-app --template healthcare --package-manager pnpm

# Scaffolds:
#   apps/patient-portal/   Appointments, records, test results, secure messaging
#   apps/provider-portal/  Patient list, charting, prescription management
#   apps/records/          FHIR R4 resource viewer (Patient, Observation, Condition)
#   apps/telemedicine/     WebRTC video consult (waiting room + session)
#   services/fhir-api/     FHIR R4 compliant REST API (fhir.js + Postgres)
#   services/audit/        HIPAA audit trail (pino-audit, immutable log store)
#   packages/types/        Shared FHIR R4 TypeScript types (Patient, Observation)
#   docs/baa-template.md   Business Associate Agreement template
#   docker-compose.yml     Postgres (encrypted at rest) + Redis + all services

# Add HL7 message ingestion
re-shell generate service hl7-ingest --type message-queue --format hl7v2

# Add consent management
re-shell generate feature consent --type crud --schema "patient,provider,scope,expiry"

# Validate HIPAA audit coverage
re-shell security audit my-health-app --standard hipaa
re-shell security compliance-reporting my-health-app --standard hipaa
```

---

### `gaming` — Gaming Platform

Lobby, game client (WebGL host), leaderboard, item store. Socket.io rooms, Redis sorted sets.

```bash
# Initialize a gaming platform
re-shell init my-game-platform --template gaming --package-manager pnpm

# Scaffolds:
#   apps/shell/            Auth + lobby entry + matchmaking UI
#   apps/lobby/            Room browser, party formation, chat (Socket.io)
#   apps/game-client/      Phaser/WebGL canvas host MFE + server-sync loop
#   apps/leaderboard/      Global + seasonal rankings (Redis sorted sets)
#   apps/store/            In-app purchase catalog + transaction history
#   services/matchmaking/  ELO-based matchmaking + room allocation
#   services/game-server/  Server-authoritative game state (Socket.io + Redis)
#   services/iap/          In-app purchase validation (Stripe / Apple / Google)
#   packages/types/        Shared game event / room / player TypeScript types
#   docker-compose.yml     Postgres + Redis + all services

# Add anti-cheat validation
re-shell security threat-detection my-game-platform --mode server-authoritative

# Add replay recording
re-shell generate feature replay --type event-sourcing --storage s3

# Add clan / guild system
re-shell generate feature clans --type crud --schema "name,members,rank,emblem"
```

---

### `iot` — IoT Device Management

Device fleet management, MQTT telemetry, TimescaleDB, OTA firmware updates, alert rules.

```bash
# Initialize an IoT management platform
re-shell init my-iot-platform --template iot --package-manager pnpm

# Scaffolds:
#   apps/dashboard/        Device map (Mapbox), status grid, real-time metrics
#   apps/device-manager/   Fleet CRUD, device groups, config push, OTA trigger
#   services/telemetry/    MQTT broker bridge → TimescaleDB hypertable ingestion
#   services/alerts/       Threshold rule engine + notification dispatch (email/SMS/webhook)
#   services/ota/          Firmware version registry + incremental update job queue
#   packages/types/        Shared device/telemetry/alert TypeScript types
#   docker-compose.yml     Mosquitto (MQTT) + TimescaleDB + Redis + all services

# Add device shadow pattern (desired vs reported state)
re-shell generate feature device-shadow --type state-sync --protocol mqtt

# Add anomaly detection on telemetry
re-shell observe anomaly my-iot-platform --source timescale --metric temperature

# Set up Grafana dashboards
re-shell observe metrics my-iot-platform --provider grafana --datasource timescale
```

---

### `cms` — Content Management System

Public site, TipTap editor, media library, preview, GraphQL/REST content API, admin.

```bash
# Initialize a CMS
re-shell init my-cms --template cms --package-manager pnpm

# Scaffolds:
#   apps/public-site/      Server-rendered public frontend (SEO, sitemap, OG tags)
#   apps/editor/           TipTap rich-text editor + drag-and-drop block builder
#   apps/media-library/    Image/video/file upload + CDN delivery + tag management
#   apps/preview/          Draft preview with secret token (bypass CDN cache)
#   apps/admin/            Role-based team access, webhook management, audit log
#   services/content-api/  GraphQL + REST content delivery API (graphql-yoga)
#   services/webhooks/     Outbound webhook dispatcher (publish events → Zapier etc)
#   packages/types/        Shared content/media/user TypeScript types
#   docker-compose.yml     Postgres + Redis (draft cache) + MinIO (media) + all services

# Add multi-tenancy (separate content spaces per team)
re-shell generate feature multi-tenant --type isolation --strategy schema-per-tenant

# Add full-text search across content
re-shell generate feature content-search --type full-text --provider meilisearch

# Integrate with CDN for asset invalidation
re-shell cloud cdn my-cms --provider cloudflare --invalidate-on-publish

# Set up scheduled publishing
re-shell generate feature scheduled-publish --type cron --schema "content,publish_at,status"
```

---

## Latest Features

### Complete C++ Ecosystem (v0.24.0)

High-performance C++ development platform with 5 specialized templates covering web frameworks, from lightweight to enterprise-grade. Build blazing-fast, type-safe microservices with modern C++ features, comprehensive testing, and production-ready tooling.

#### High-Performance C++ Microservices

```bash
# Create C++-powered platform
re-shell create cpp-platform --type full-stack

# Backend: Crow for fast, header-only microframework
re-shell generate backend api-gateway --language cpp --template cpp-crow --port 8081 \
  --features "jwt,websocket,async,cors"

# Backend: Drogon for full-featured web applications  
re-shell generate backend core-service --language cpp --template cpp-drogon --port 8082 \
  --features "orm,websocket,http2,redis"

# Backend: cpp-httplib for lightweight services
re-shell generate backend micro-service --language cpp --template cpp-httplib --port 8083 \
  --features "https,compression,file-upload"

# Backend: Pistache for elegant REST APIs
re-shell generate backend rest-service --language cpp --template cpp-pistache --port 8084 \
  --features "validation,rate-limit,caching"

# Backend: Beast for WebSocket and real-time communication
re-shell generate backend ws-service --language cpp --template cpp-beast --port 8085 \
  --features "websockets,authentication,logging"

# Start all services with hot reload
re-shell dev --cpp --all --hot-reload
```

#### C++ Framework Specializations

```bash
# Crow: Fast header-only C++ microframework inspired by Flask
re-shell create fast-api --template cpp-crow
# Features: JWT auth, WebSocket, async handlers, minimal dependencies

# Drogon: Modern C++17/20 HTTP application framework
re-shell create enterprise-app --template cpp-drogon
# Features: Built-in ORM, WebSocket, HTTP/2, view templating, PostgreSQL

# cpp-httplib: Single-header C++ HTTP/HTTPS server library
re-shell create lightweight-api --template cpp-httplib  
# Features: Minimal footprint, SSL/TLS, gzip compression, file serving

# Pistache: Elegant C++ REST framework with async support
re-shell create rest-api --template cpp-pistache
# Features: Middleware system, rate limiting, validation, type-safe routing

# Beast: Boost.Beast for WebSocket and HTTP/HTTPS servers
re-shell create realtime-api --template cpp-beast
# Features: WebSocket, HTTP/2, SSL/TLS, async I/O, Boost ecosystem
```

#### C++ Universal Features

All C++ templates include production-ready capabilities:
- **CMake Build System**: Modern CMake with FetchContent for dependencies
- **Google Test**: Comprehensive unit and integration testing framework
- **Authentication**: JWT tokens with OpenSSL, custom claims support
- **Logging**: spdlog for high-performance structured logging
- **JSON Support**: nlohmann/json for modern JSON handling
- **Docker**: Multi-stage builds with minimal runtime images
- **Development**: Hot reload support, debug/release configurations
- **Security**: HTTPS/TLS support, security headers, input validation
- **Performance**: Compiler optimizations, minimal overhead, async I/O

#### C++ Advanced Development Tools

**OpenAPI/Swagger Integration**:
```bash
# Generate server stubs and client SDK from OpenAPI spec
./scripts/generate-api.sh

# Automatic request/response validation
# Swagger UI at http://localhost:8080/docs
```

**Memory Safety & Sanitizers**:
```bash
# Build with AddressSanitizer
cmake -DENABLE_ASAN=ON ..

# Run all sanitizers
./scripts/run-sanitizers.sh

# Valgrind memory analysis
valgrind --leak-check=full ./your_app
```

**Code Quality Tools**:
```bash
# Format code with clang-format
make format-all

# Static analysis with clang-tidy
make tidy-all

# Comprehensive quality check
./scripts/check-quality.sh
```

### Complete Lua Ecosystem (v0.23.0)

High-performance Lua development platform with 4 specialized templates for web services, API gateways, and plugin development. Leverage the power of LuaJIT and NGINX for blazing-fast applications.

#### Lua-Powered Microservices

```bash
# Create Lua-powered platform
re-shell create lua-platform --type full-stack

# Backend: OpenResty for NGINX + LuaJIT performance
re-shell generate backend gateway --language lua --template lua-openresty --port 8090 \
  --features "jwt,redis,postgres,websocket"

# Backend: Lapis for full-featured web development
re-shell generate backend web-service --language lua --template lua-lapis --port 8091 \
  --features "moonscript,migrations,testing"

# Backend: lua-http for pure Lua HTTP services  
re-shell generate backend api-service --language lua --template lua-http --port 8092 \
  --features "http2,websocket,async"

# Backend: Kong plugin for API gateway extensions
re-shell generate backend gateway-plugin --language lua --template lua-kong-plugin \
  --features "rate-limit,auth,transform"

# Start all services with hot reload
re-shell dev --lua --all --hot-reload
```

#### Lua Framework Specializations

```bash
# OpenResty: NGINX with embedded LuaJIT for ultimate performance
re-shell create high-perf-api --template lua-openresty
# Features: JWT auth, PostgreSQL via pgmoon, Redis, WebSocket, Module Federation

# Lapis: Full-featured web framework with MoonScript support
re-shell create web-app --template lua-lapis
# Features: ORM with migrations, MoonScript, Busted testing, hot reload

# lua-http: Pure Lua HTTP/1.1 and HTTP/2 server
re-shell create pure-lua-api --template lua-http
# Features: Coroutine-based async, WebSocket, HTTP/2, minimal dependencies

# Kong Plugin: Extend Kong API Gateway functionality
re-shell create kong-extension --template lua-kong-plugin
# Features: Request/response handlers, Admin API, migrations, comprehensive testing
```

#### Lua Universal Features

All Lua templates include production-ready capabilities:
- **LuaRocks**: Package management with dependency resolution
- **Testing**: Busted framework with mocking and coverage
- **Performance**: LuaJIT optimization, NGINX integration
- **Database**: PostgreSQL and Redis client libraries
- **Hot Reload**: Development server with auto-reload
- **Docker**: NGINX-based containers with Lua modules
- **Module Federation**: Microfrontend support in OpenResty
- **API Gateway**: Kong plugin development framework
- **Caching**: Built-in Redis integration for performance

### Complete Go Ecosystem (v0.22.1)

Enterprise-grade Go development platform with 6 specialized templates covering web frameworks, gRPC services, and database patterns. Build high-performance, concurrent applications with Go's simplicity and efficiency.

#### High-Performance Go Microservices

```bash
# Create Go-powered platform
re-shell create go-platform --type full-stack

# Backend: Gin framework for RESTful APIs
re-shell generate backend api-gateway --language go --template go-gin --port 8001 \
  --features "jwt,rate-limit,swagger,metrics"

# Backend: Echo for modern, minimalist APIs
re-shell generate backend user-service --language go --template go-echo --port 8002 \
  --features "middleware,validation,graceful-shutdown"

# Backend: Fiber for Express-like development
re-shell generate backend product-service --language go --template go-fiber --port 8003 \
  --features "websocket,sse,monitoring"

# Backend: Chi for composable, stdlib-compatible routing
re-shell generate backend order-service --language go --template go-chi --port 8004 \
  --features "middleware-chain,subrouters,restful"

# Backend: gRPC for high-performance RPC
re-shell generate backend grpc-service --language go --template go-grpc --port 8005 \
  --features "streaming,interceptors,reflection"

# Backend: sqlx for type-safe SQL operations
re-shell generate backend data-service --language go --template go-sqlx --port 8006 \
  --features "migrations,transactions,prepared-statements"

# Start all services with hot reload
re-shell dev --go --all --hot-reload
```

#### Go Framework Specializations

```bash
# Gin: High-performance web framework with middleware ecosystem
re-shell create rest-api --template go-gin
# Features: JWT auth, rate limiting, Swagger docs, Prometheus metrics

# Echo: Minimalist web framework with powerful routing
re-shell create modern-api --template go-echo
# Features: Built-in middleware, data binding, OpenAPI integration

# Fiber: Express-inspired web framework built on Fasthttp
re-shell create fast-api --template go-fiber
# Features: WebSocket support, server-sent events, built-in monitoring

# Chi: Lightweight, composable router compatible with net/http
re-shell create composable-api --template go-chi
# Features: Middleware chains, subrouters, RESTful routing

# gRPC: High-performance RPC framework
re-shell create rpc-service --template go-grpc
# Features: Protocol Buffers, streaming, service discovery

# sqlx: Extensions to database/sql for type safety
re-shell create data-api --template go-sqlx
# Features: Named queries, struct scanning, transaction helpers
```

#### Go Universal Features

All Go templates include production-ready capabilities:
- **Database Integration**: GORM ORM with automigration, sqlx for raw SQL
- **Authentication**: JWT with custom claims, API key auth, OAuth2 support
- **Logging**: Structured logging with Zap or Zerolog, correlation IDs
- **Monitoring**: Prometheus metrics, health checks, pprof profiling
- **Testing**: Testify framework, mocking, table-driven tests, benchmarks
- **Development**: Hot reload with Air, environment configuration
- **Security**: bcrypt hashing, rate limiting, CORS, security headers
- **Docker**: Multi-stage builds, minimal Alpine images, non-root user
- **Architecture**: Clean architecture, dependency injection, context propagation

### Complete Ruby Ecosystem (v0.23.0)

```bash
# Create a complete Ruby API application ecosystem

# Backend: Ruby on Rails API for full-featured REST services
re-shell generate backend main-api --language ruby --template ruby-rails-api --port 3000 \
  --features "active-record,jwt,sidekiq,rspec"

# Backend: Sinatra for lightweight microservices
re-shell generate backend auth-service --language ruby --template ruby-sinatra --port 4567 \
  --features "jwt,redis,swagger,modular"

# Backend: Grape for RESTful API services
re-shell generate backend products-api --language ruby --template ruby-grape --port 9292 \
  --features "entities,validation,swagger,pagination"

# Start all services with hot reload
re-shell dev --ruby --all --guard
```

#### Ruby Framework Specializations

```bash
# Rails API: Full-featured API framework with conventions
re-shell create rest-api --template ruby-rails-api
# Features: Active Record ORM, Action Cable, Active Job, JWT auth

# Sinatra: Lightweight and flexible web framework
re-shell create micro-api --template ruby-sinatra
# Features: Modular apps, minimal overhead, Rack middleware

# Grape: RESTful API micro-framework
re-shell create api-service --template ruby-grape
# Features: Parameter validation, entity presentation, versioning
```

#### Ruby Universal Features

All Ruby templates include production-ready capabilities:
- **Active Record**: Full ORM with migrations and associations
- **Authentication**: JWT tokens with refresh support
- **Background Jobs**: Sidekiq for async processing
- **Testing**: RSpec with FactoryBot and fixtures
- **API Documentation**: Swagger/OpenAPI generation
- **Performance**: Redis caching, connection pooling
- **Development**: Guard for auto-testing, Rerun for hot reload
- **Code Quality**: RuboCop linting with framework rules
- **Docker**: Multi-stage builds with Ruby Alpine images

### Complete PHP Ecosystem (v0.21.0)

Comprehensive PHP backend support with 4 major frameworks - Symfony, Laravel, Slim, and CodeIgniter 4. Build modern, secure, and scalable PHP applications with enterprise-grade features.

#### Modern PHP Microservices

```bash
# Create PHP-powered platform
re-shell create php-platform --type full-stack

# Backend: Symfony for enterprise applications
re-shell generate backend core-api --language php --template php-symfony --port 8001 \
  --features "doctrine,messenger,security,api-platform"

# Backend: Laravel for rapid development
re-shell generate backend admin-api --language php --template php-laravel --port 8002 \
  --features "eloquent,queues,broadcasting,sanctum"

# Backend: Slim for microservices
re-shell generate backend micro-api --language php --template php-slim --port 8003 \
  --features "psr15,di-container,validation"

# Backend: CodeIgniter for simplicity
re-shell generate backend simple-api --language php --template php-codeigniter --port 8004 \
  --features "restful,filters,validation"

# Start all services with PHP-FPM
re-shell dev --php --all --xdebug
```

#### PHP Framework Specializations

```bash
# Symfony: Enterprise PHP framework with extensive features
re-shell create enterprise-app --template php-symfony
# Features: Dependency injection, event system, Doctrine ORM, forms

# Laravel: The PHP framework for web artisans
re-shell create artisan-app --template php-laravel
# Features: Eloquent ORM, Blade templates, Artisan CLI, queues

# Slim: Micro framework for APIs and microservices
re-shell create micro-service --template php-slim
# Features: PSR-7/15, middleware, DI container, minimal footprint

# CodeIgniter 4: Simple and elegant toolkit
re-shell create simple-app --template php-codeigniter
# Features: MVC pattern, RESTful routing, built-in security
```

#### PHP Universal Features

All PHP templates include modern PHP capabilities:
- **PHP 8.2+**: Typed properties, attributes, enums, readonly properties
- **Database**: Migrations, query builders, ORM integration
- **Testing**: PHPUnit with fixtures, mocking, code coverage
- **Security**: CSRF protection, XSS filtering, SQL injection prevention
- **Performance**: OPcache with JIT, connection pooling, Redis caching
- **Development**: Xdebug support, hot reload, environment config
- **Docker**: PHP-FPM, Nginx/Apache, multi-stage builds
- **Standards**: PSR compliance, coding standards, static analysis

### Complete .NET Ecosystem (v0.20.0)

Complete enterprise-grade .NET development platform with 12 specialized templates covering authentication, monitoring, testing, documentation, and more. Build production-ready applications with ASP.NET Core, Blazor Server, and gRPC services.

#### Enterprise .NET Application Platform

```bash
# Create enterprise .NET platform
re-shell create dotnet-enterprise --type full-stack

# Backend: Complete authentication microservice
re-shell generate backend auth-service --language csharp --template aspnet-jwt --port 8001 \
  --features "identity,2fa,oauth,rate-limiting"

# Backend: High-performance data service with Dapper
re-shell generate backend data-service --language csharp --template aspnet-dapper --port 8002 \
  --features "repository,transactions,performance"

# Backend: Monitored API with comprehensive logging
re-shell generate backend api-service --language csharp --template aspnet-serilog --port 8003 \
  --features "structured-logging,monitoring,audit"

# Backend: gRPC service for inter-service communication
re-shell generate backend grpc-service --language csharp --template grpc-service --port 8004 \
  --features "protobuf,streaming,performance"

# Frontend: Blazor Server for full-stack .NET development
re-shell add admin-portal --template blazor-server --port 5000 \
  --features "signalr,realtime,ssr"

# Start complete platform
docker-compose up
```

#### Advanced .NET Features

```bash
# Entity Framework Core with migrations
re-shell generate backend ef-service --template aspnet-efcore \
  --features "migrations,audit,soft-delete,relationships"

# Comprehensive testing setup
re-shell generate backend tested-api --template aspnet-xunit \
  --features "unit-tests,integration-tests,test-containers"

# Hot reload development environment
re-shell generate backend dev-api --template aspnet-hotreload \
  --features "watch,file-monitoring,utilities"

# Interactive API documentation
re-shell generate backend docs-api --template aspnet-swagger \
  --features "openapi,code-gen,examples,versioning"

# AutoMapper for object mapping
re-shell generate backend mapping-service --template aspnet-automapper \
  --features "profiles,validation,performance"
```

### Complete Rust Ecosystem (v0.17.0)

Complete enterprise-grade Rust backend support with four production-ready frameworks - Actix-Web, Warp, Rocket, and Axum. Build high-performance, type-safe microservices with zero-cost abstractions and memory safety guarantees.

#### High-Performance Rust Microservices

```bash
# Create Rust-powered e-commerce platform
re-shell create rust-ecommerce --type full-stack

# Backend: Add high-performance Rust microservices
# Actix-Web for enterprise-grade async product API
re-shell generate backend product-service --language rust --framework actix-web --port 8001 \
  --features "sqlx,redis,jwt,websocket"

# Warp for functional order processing service
re-shell generate backend order-service --language rust --framework warp --port 8002 \
  --features "functional,compose,async"

# Rocket for type-safe payment service
re-shell generate backend payment-service --language rust --framework rocket --port 8003 \
  --features "guards,fairings,type-safe"

# Axum for modern notification service with tower middleware
re-shell generate backend notification-service --language rust --framework axum --port 8004 \
  --features "tower,extractors,tracing"

# Start all Rust services with cargo-watch hot reload
re-shell dev --rust --all --hot-reload
```

#### Rust Framework Specializations

```bash
# Actix-Web: Enterprise async handlers with comprehensive middleware
re-shell create enterprise-api --template actix-web
# Features: Actor-based architecture, async handlers, JWT auth, PostgreSQL + Redis

# Warp: Functional programming with composable filters  
re-shell create functional-api --template warp
# Features: Filter composition, functional patterns, immutable data flow

# Rocket: Type-safe routing with compile-time verification
re-shell create type-safe-api --template rocket  
# Features: Request guards, fairings, compile-time route verification

# Axum: Modern async with tower middleware stack
re-shell create modern-async-api --template axum
# Features: Custom extractors, tower middleware, structured logging
```

#### Rust Universal Features

All Rust templates include enterprise-grade capabilities:
- **SQLx Integration**: Compile-time verified SQL with async PostgreSQL
- **Tokio Runtime**: High-performance async runtime configuration  
- **Serde Support**: Zero-copy JSON serialization/deserialization
- **Error Handling**: Comprehensive error handling with thiserror/anyhow
- **Development Tools**: cargo-watch for hot reload development
- **Security**: JWT auth, CORS, security headers, rate limiting
- **Docker Support**: Multi-stage builds with minimal runtime images
- **Database Migrations**: Complete migration system with rollback support
- **Observability**: Structured logging and distributed tracing

#### Cross-Language Integration

```bash
# Full-stack with mixed languages for optimal performance
# Frontend: React microfrontends
re-shell add admin-dashboard --framework react-ts --port 5173

# Backend: Rust for performance-critical services
re-shell generate backend analytics-engine --language rust --framework actix-web --port 8001

# Backend: Python for ML and data processing  
re-shell generate backend ml-service --language python --framework fastapi --port 8002

# Backend: Node.js for rapid development
re-shell generate backend user-service --framework express --port 8003

# Inter-service communication with type-safe contracts
re-shell generate contracts --rust-to-typescript --openapi-spec
```

### Full-Stack Platform (v0.16.3)

Complete full-stack development platform uniting microservices and microfrontends under a single CLI.

#### Complete Full-Stack Application Example

```bash
# Create a full-stack e-commerce platform
re-shell create my-marketplace --type full-stack
cd my-marketplace

# Frontend: Add microfrontends for different parts of the application
# Customer-facing React storefront
re-shell add storefront --framework react-ts --port 5173

# Admin dashboard with Vue.js
re-shell add admin-panel --framework vue-ts --port 5174

# Seller portal with Svelte
re-shell add seller-portal --framework svelte-ts --port 5175

# Backend: Add microservices for business logic
# Python FastAPI for high-performance product API
re-shell generate backend product-service --language python --framework fastapi --port 8001 \
  --features "redis,celery,websocket"

# Django for complex order management with ORM
re-shell generate backend order-service --language python --framework django --port 8002 \
  --features "celery,admin,rest"

# Node.js Express for payment processing
re-shell generate backend payment-service --framework express --port 8003 \
  --features "stripe,webhooks,queue"

# Flask for lightweight notification service
re-shell generate backend notification-service --language python --framework flask --port 8004 \
  --features "email,sms,push"

# Start all services with Docker orchestration
docker-compose up

# Or start individually for development
re-shell dev --all
```

#### Microservice Communication Patterns

```bash
# REST API communication
# Product service exposes REST endpoints
cd services/product-service
re-shell generate endpoint products --method GET,POST,PUT,DELETE
re-shell generate endpoint products/:id --method GET,PUT,DELETE

# GraphQL gateway (optional)
re-shell generate backend api-gateway --framework express --features graphql --port 4000

# WebSocket for real-time features
# In the notification service
cd services/notification-service
re-shell generate websocket notifications --events "order.created,order.updated"

# Message queue integration
# Configure Redis for inter-service communication
re-shell configure redis --services all --pubsub enabled

# Event-driven architecture
re-shell generate events order-events --publisher order-service \
  --subscribers "notification-service,inventory-service"
```

#### Full-Stack Development Workflow

```bash
# 1. Start with API design
re-shell generate openapi product-api --output api-spec.yaml
re-shell generate openapi order-api --output order-spec.yaml

# 2. Generate backend services from OpenAPI
re-shell generate backend-from-spec product-service --spec api-spec.yaml \
  --framework fastapi

# 3. Generate TypeScript types for frontend
re-shell generate types-from-spec --spec api-spec.yaml \
  --output packages/shared/types

# 4. Create shared UI components
re-shell generate component Button --workspace packages/ui --export
re-shell generate component Card --workspace packages/ui --export
re-shell generate component DataTable --workspace packages/ui --export

# 5. Implement frontend features using shared types
cd apps/storefront
re-shell generate hook useProducts --typescript
re-shell generate service ProductService --typescript

# 6. Add authentication across stack
re-shell generate auth jwt --services all --frontend all

# 7. Setup monitoring and observability
re-shell generate monitoring prometheus --services all
re-shell generate tracing opentelemetry --services all
```

### Microfrontend Architecture (v0.16.0) 

Complete microfrontend platform with Webpack Module Federation, enabling true microfrontend patterns with dynamic loading, independent deployment, and runtime integration.

#### Complete Microfrontend Platform Example

```bash
# Create enterprise microfrontend platform
re-shell create enterprise-platform --type microfrontend --architecture module-federation

# Generate shell application (orchestrator)
re-shell create shell-app --template federation-shell --port 3100

# Generate React microfrontend for user management
re-shell create user-dashboard --template react-mf --port 3000 --features "auth,profile,settings"

# Generate Vue.js microfrontend for product catalog  
re-shell create product-catalog --template vue-mf --port 3001 --features "search,filter,cart"

# Generate Svelte microfrontend for analytics
re-shell create analytics-widget --template svelte-mf --port 3002 --features "charts,metrics,reports"

# Start complete platform in development mode
re-shell dev --microfrontends --all --watch

# Access the platform
open http://localhost:3100  # Shell application with unified navigation
open http://localhost:3000  # React app (independent access)
open http://localhost:3001  # Vue app (independent access) 
open http://localhost:3002  # Svelte app (independent access)
```

**Features Demonstrated:**
- **Module Federation**: Runtime integration without build coupling
- **Independent Deployment**: Each microfrontend deployed separately
- **Cross-Framework**: React, Vue, Svelte working together seamlessly
- **Error Boundaries**: Isolated failures don't crash the platform
- **Shared Dependencies**: Optimized bundle sizes
- **Hot Module Replacement**: Live updates during development
- **Unified Navigation**: Single application experience

#### Real-World Microfrontend Scenarios

**E-commerce Microfrontend Platform:**
```bash
# Shell application for main navigation
re-shell create ecommerce-shell --template federation-shell --port 3100

# Product catalog (Vue.js for reactive search/filtering)
re-shell create product-catalog --template vue-mf --port 3000 \
  --features "search,filter,categories,recommendations"

# Shopping cart (React for complex state management)
re-shell create shopping-cart --template react-mf --port 3001 \
  --features "cart,checkout,payment,shipping"

# User account (Angular for enterprise forms)
re-shell create user-account --template angular-mf --port 3002 \
  --features "profile,orders,wishlist,support"

# Analytics dashboard (Svelte for performance)
re-shell create admin-analytics --template svelte-mf --port 3003 \
  --features "sales,metrics,reports,insights"
```

### Python Ecosystem Complete (v0.15.0)

Complete Python backend ecosystem with comprehensive testing, type hints, and enterprise-grade templates for all major Python frameworks.

#### Python Framework Examples

```bash
# Create FastAPI microservice with async support
re-shell create user-api --template fastapi --port 8001
cd user-api

# Features included:
# - Automatic OpenAPI documentation
# - Type hints with Python 3.11+ features
# - Dependency injection system
# - WebSocket support
# - Comprehensive pytest configuration
# - Coverage reporting with 85% threshold
# - Authentication with JWT tokens

# Start development server with hot-reload
re-shell dev --hot-reload

# Run comprehensive test suite
re-shell test --coverage --async --benchmark

# Create Django REST service
re-shell create content-api --template django --port 8002
cd content-api

# Features included:
# - Django REST Framework
# - Admin interface
# - ORM with custom migrations
# - Management commands
# - Model testing with fixtures
# - DRF testing utilities

# Create Flask microservice
re-shell create auth-api --template flask --port 8003
cd auth-api

# Features included:
# - Blueprint architecture
# - SQLAlchemy integration
# - CLI commands
# - App context testing
# - Blueprint testing

# Create Tornado async service
re-shell create websocket-api --template tornado --port 8004
cd websocket-api

# Features included:
# - High-performance async
# - WebSocket support
# - Non-blocking I/O
# - AsyncHTTPTestCase testing

# Create Sanic ultra-fast API
re-shell create fast-api --template sanic --port 8005
cd fast-api

# Features included:
# - Ultra-fast async framework
# - Blueprint architecture
# - Middleware system
# - Rate limiting
# - Security testing
```

#### Python Testing Excellence

```bash
# All Python templates include comprehensive testing

# Run pytest with async support
pytest --asyncio-mode=auto

# Run with coverage reporting
pytest --cov=app --cov-report=html --cov-report=xml

# Run parallel tests for performance
pytest -n auto --dist worksteal

# Run performance benchmarks
pytest --benchmark-only --benchmark-sort=mean

# Run specific test categories
pytest -m "unit and not slow"          # Fast unit tests
pytest -m "integration or e2e"         # Integration tests
pytest -m "performance"                # Performance tests
pytest -m "security"                   # Security tests

# Framework-specific testing examples

# FastAPI testing
pytest tests/test_fastapi.py::test_async_endpoint
pytest tests/test_fastapi.py::test_websocket_connection
pytest tests/test_fastapi.py::test_dependency_injection

# Django testing
pytest tests/test_django.py::test_model_creation
pytest tests/test_django.py::test_drf_serializer
pytest tests/test_django.py::test_management_command

# Flask testing
pytest tests/test_flask.py::test_blueprint_route
pytest tests/test_flask.py::test_app_context
pytest tests/test_flask.py::test_cli_command

# Tornado testing
pytest tests/test_tornado.py::test_async_handler
pytest tests/test_tornado.py::test_websocket_handler

# Sanic testing
pytest tests/test_sanic.py::test_middleware
pytest tests/test_sanic.py::test_rate_limiting
```

#### Advanced Python Features

```bash
# Type checking with MyPy
mypy app/ --strict --show-error-codes

# Fast linting with Ruff
ruff check app/ --fix
ruff format app/

# Advanced type analysis with Pyright
pyright app/

# Hot-reload development for all frameworks
re-shell dev --hot-reload --framework fastapi
re-shell dev --hot-reload --framework django
re-shell dev --hot-reload --framework flask
re-shell dev --hot-reload --framework tornado
re-shell dev --hot-reload --framework sanic

# Generate comprehensive documentation
re-shell docs generate --python --include-types --include-tests
```

### Phase 0 Complete (v0.8.0)

Complete core infrastructure with documentation system, testing framework, and interactive learning platform.

#### Documentation System

```bash
# Generate interactive API documentation
re-shell docs generate --format interactive

# Create troubleshooting guides with auto-diagnostics
re-shell troubleshoot generate --auto-diagnose

# Generate video tutorials
re-shell tutorials create getting-started --duration 10m

# Create interactive guide
re-shell guide create --interactive --achievements
```

#### Testing Infrastructure

```bash
# Run comprehensive test suite with >95% coverage
re-shell test --coverage --threshold 95

# Cross-platform testing
re-shell test cross-platform --os windows,macos,linux

# Performance benchmarking
re-shell test benchmark --baseline previous

# Load testing for large workspaces
re-shell test load --apps 1000 --concurrent

# Error scenario testing
re-shell test errors --auto-recovery
```

#### Quality Assurance

```bash
# Code quality analysis
re-shell analyze quality --sonarqube

# Security scanning
re-shell analyze security --fix

# Performance profiling
re-shell analyze performance --optimize

# UX metrics collection
re-shell metrics collect --anonymous
```

### Performance & Resource Management (v0.7.2)

Breakthrough performance optimization achieving 85% startup improvement with enterprise-grade resource management.

#### Performance Optimization

```bash
# Fast startup - now under 35ms
re-shell --version

# Profile startup performance with detailed timing
DEBUG=true re-shell --version

# Enable performance profiling for all operations
re-shell --profile init my-project

# Benchmark CLI performance
re-shell benchmark startup --iterations 10

# Test concurrent operations performance
re-shell benchmark concurrency --workers 10

# Run memory stress test
re-shell benchmark memory --allocations 1000

# CPU stress test
re-shell benchmark cpu --duration 5000
```

#### Resource Monitoring

```bash
# Start resource monitoring
re-shell monitor start --interval 5000

# Get current resource usage
re-shell monitor status

# View resource analytics
re-shell monitor analytics --period 24h

# Generate performance report
re-shell monitor report --format json --output report.json

# Export resource data
re-shell monitor export --format csv --output resources.csv

# Clear old monitoring data
re-shell monitor cleanup --retention 168h
```

#### Memory Management

```bash
# Get memory usage statistics
re-shell memory stats

# Monitor memory trends
re-shell memory trends --samples 20

# Get optimization suggestions
re-shell memory optimize

# Force garbage collection (if available)
re-shell memory gc

# Set memory alerts
re-shell memory alerts --warning 100 --critical 200

# View memory leak detection
re-shell memory leaks --check
```

#### Load Testing

```bash
# Run CLI load test
re-shell load-test --concurrent 5 --duration 30 --ramp-up 10

# Custom operation load test
re-shell load-test custom \
  --operation "init test-project --yes" \
  --concurrent 3 \
  --duration 60

# Benchmark against baseline
re-shell benchmark compare --baseline 0.7.1 --current 0.7.2

# Generate benchmark report
re-shell benchmark report --format html --output benchmark.html
```

### Plugin Ecosystem (v0.7.1)

The most powerful addition to Re-Shell CLI - a complete plugin ecosystem with 35+ new commands for extensibility.

#### Plugin Management

```bash
# Discover available plugins
re-shell plugin discover

# Search for specific plugins
re-shell plugin search react-tools

# Install a plugin
re-shell plugin install @re-shell/react-plugin

# List installed plugins with details
re-shell plugin list --verbose

# Show plugin information
re-shell plugin info @re-shell/react-plugin

# Enable/disable plugins
re-shell plugin enable @re-shell/react-plugin
re-shell plugin disable @re-shell/react-plugin

# Update all plugins
re-shell plugin update

# Check plugin lifecycle statistics
re-shell plugin stats
```

#### Plugin Marketplace

```bash
# Search marketplace for plugins
re-shell plugin search testing --category development

# Show plugin details from marketplace
re-shell plugin show @re-shell/testing-tools

# Install from marketplace with specific version
re-shell plugin install-marketplace @re-shell/testing-tools@1.2.0

# Show plugin reviews
re-shell plugin reviews @re-shell/testing-tools

# Browse featured plugins
re-shell plugin featured

# Browse popular plugins by category
re-shell plugin popular development

# Show marketplace statistics
re-shell plugin marketplace-stats
```

#### Command Extension System

```bash
# List all registered plugin commands
re-shell plugin commands

# Show command conflicts
re-shell plugin command-conflicts

# Resolve command conflicts with priority strategy
re-shell plugin resolve-conflict my-command priority

# Show command registry statistics
re-shell plugin command-stats

# Register a test command (for plugin development)
re-shell plugin register-command my-plugin '{"name":"test","description":"Test command"}'

# Show middleware chain for command
re-shell plugin middleware-chain my-command

# Test middleware execution
re-shell plugin test-middleware validation '{"field":"value"}'
```

#### Documentation & Help

```bash
# Generate documentation for all plugin commands
re-shell plugin generate-docs --format markdown --output ./docs

# Generate HTML documentation with examples
re-shell plugin generate-docs --format html --include-examples

# Show detailed help for a command
re-shell plugin help my-command --verbose

# List all documented commands
re-shell plugin list-docs --plugin my-plugin

# Search documentation
re-shell plugin search-docs "validation rules"

# Configure help system
re-shell plugin configure-help displayMode detailed
re-shell plugin configure-help maxWidth 120
```

#### Validation & Transformation

```bash
# List available validation rules
re-shell plugin validation-rules --verbose

# List parameter transformations
re-shell plugin transformations --verbose

# Test command validation
re-shell plugin test-validation my-command '{"args":{"name":"test"},"options":{"verbose":true}}'

# Create validation schema
re-shell plugin create-schema my-command '{
  "strict": true,
  "arguments": {
    "name": {
      "rules": [
        {"type": "required", "message": "Name is required"},
        {"type": "minLength", "options": {"min": 3}}
      ]
    }
  }
}'

# Generate validation template
re-shell plugin generate-template my-command --verbose
```

#### Caching & Performance

```bash
# Show cache statistics
re-shell plugin cache-stats --verbose

# Configure cache settings
re-shell plugin configure-cache enabled true
re-shell plugin configure-cache defaultTTL 600000
re-shell plugin configure-cache strategy hybrid

# Test cache performance
re-shell plugin test-cache 100 --verbose

# Optimize cache configuration
re-shell plugin optimize-cache --force

# Clear cache selectively
re-shell plugin clear-cache --command build --force
re-shell plugin clear-cache --tags development,testing --force

# List cached commands
re-shell plugin list-cached --verbose
```

#### Plugin Security

```bash
# Scan all plugins for security issues
re-shell plugin security-scan --all

# Scan specific plugin
re-shell plugin security-scan @re-shell/my-plugin --detailed

# Check security policy compliance
re-shell plugin security-policy

# Generate comprehensive security report
re-shell plugin security-report --format json --output security-report.json

# Fix security issues automatically
re-shell plugin security-fix @re-shell/my-plugin --auto-fix
```

#### Plugin Development

```bash
# Validate plugin structure
re-shell plugin validate ./my-plugin

# Show available plugin hooks
re-shell plugin hooks @re-shell/my-plugin

# List all hook types
re-shell plugin hook-types

# Execute hook manually for testing
re-shell plugin execute-hook init '{"projectName":"test"}'

# Show example middleware code
re-shell plugin middleware-example validation
re-shell plugin middleware-example authorization

# Test middleware with sample data
re-shell plugin test-middleware cache '{"key":"test","value":"data"}'
```

#### Conflict Resolution

```bash
# Show all conflict resolution strategies
re-shell plugin conflict-strategies --verbose

# Automatically resolve conflicts
re-shell plugin auto-resolve

# Manually resolve specific conflict
re-shell plugin resolve-conflict cmd-123 namespace

# Set command priority override
re-shell plugin set-priority my-command 100

# View resolution history
re-shell plugin resolution-history --json
```

### Real-Time Development (v0.4.0)

Advanced file watching and change detection for optimal development experience.

#### Real-Time File Watching

```bash
# Start real-time file watching for development
re-shell file-watcher start --workspace frontend-app

# Watch multiple workspaces
re-shell file-watcher start --workspace frontend-app,backend-api

# Monitor with custom patterns
re-shell file-watcher start --pattern "**/*.{ts,tsx}" --ignore "**/*.test.ts"

# View file watching statistics
re-shell file-watcher stats --verbose

# Test platform-specific watching
re-shell platform-test --verbose
```

#### Intelligent Change Detection

```bash
# Scan for changes with content hashing
re-shell change-detector scan src/

# Monitor specific files
re-shell change-detector check src/components/Button.tsx

# Analyze change impact
re-shell change-impact analyze --workspace frontend-app

# View dependency impact graph
re-shell change-impact graph --format svg --output impact.svg

# Incremental build based on changes
re-shell incremental-build --workspace frontend-app --cache
```

#### Workspace State Management

```bash
# Save current workspace state
re-shell workspace-state save --name "stable-release"

# Load previous state
re-shell workspace-state load --name "stable-release"

# Compare states
re-shell workspace-state compare "stable-release" "current"

# List all saved states
re-shell workspace-state list --verbose
```

### Enterprise Features (v0.3.1)

Production-ready features for enterprise applications.

#### Advanced Configuration Management

```bash
# Global configuration with user preferences
cat ~/.re-shell/config.yaml

# Project-specific configuration inheritance
cat .re-shell/config.yaml

# Workspace definitions with dependency graphs
cat re-shell.workspaces.yaml

# Configuration migration
re-shell config-migrate upgrade --from 0.2.0 --to 0.3.0

# Configuration diffing
re-shell config-diff compare prod.yaml staging.yaml
```

#### Health Diagnostics & Analysis

```bash
# Comprehensive project health check
re-shell doctor --verbose

# Bundle size analysis
re-shell analyze bundle --workspace frontend-app

# Dependency security audit
re-shell analyze dependencies --security

# Performance profiling
re-shell analyze performance --workspace frontend-app --profile
```

#### CI/CD Integration

```bash
# Generate GitHub Actions workflow
re-shell cicd github --monorepo --docker

# Generate GitLab CI pipeline
re-shell cicd gitlab --stages "test,build,deploy"

# Generate Jenkins pipeline
re-shell cicd jenkins --parallel-builds

# Generate deployment scripts
re-shell cicd deploy --platform aws --environment production
```

## Getting Started

### CLI Validation And Safe Preview

```bash
# Run the executable CLI test plan
npm run test:plan

# Preview a workspace app creation without writing files
re-shell create inventory --framework react-ts --route /inventory --dry-run --verbose

# JSON-producing commands
re-shell list --json
re-shell workspace health --json
re-shell workspace optimize --json

# Test generation expects a workspace path
re-shell generate test apps/my-react
```

### Installation

```bash
# Install Re-Shell CLI globally
npm install -g @umutkorkmaz/re-shell-cli

# Verify installation
re-shell --version

# Check for updates
re-shell update
```

### Quick Start

```bash
# Create a new monorepo workspace
re-shell init my-platform --monorepo

# Add microfrontends
re-shell add header --framework react --typescript
re-shell add dashboard --framework vue --typescript
re-shell add footer --framework svelte --typescript

# Install plugins for enhanced development
re-shell plugin install @re-shell/dev-tools
re-shell plugin install @re-shell/testing-suite

# Start development with hot-reload
re-shell serve --all --hot-reload
```

### Template-Based Initialization

```bash
# E-commerce platform with pre-configured structure
re-shell init my-store --template ecommerce

# Analytics dashboard with chart components
re-shell init analytics-app --template dashboard

# SaaS platform with auth, billing, and admin
re-shell init my-saas --template saas

# Clean slate for custom setups
re-shell init custom-project --template blank
```

#### Configuration Presets

```bash
# Save your configuration for reuse
re-shell init first-project --template saas --package-manager pnpm
# During setup, save as "company-standard" preset

# Reuse saved configuration
re-shell init second-project --preset company-standard
```

#### Enhanced Features

```bash
# Auto-detect package manager (pnpm, yarn, npm, bun)
re-shell init auto-project

# CI/CD friendly non-interactive mode
re-shell init ci-project --template saas --yes --skip-install

# Debug mode for troubleshooting
re-shell init debug-project --debug

# Skip dependency installation
re-shell init fast-project --skip-install

# Real-time development with file watching
re-shell file-watcher start --interactive

# Advanced change detection with caching
re-shell change-detector scan --verbose

# Configuration management with presets
re-shell init my-project --preset company-standard
```

#### Generated Tooling Suite

Every project now includes:

- **Code Quality**: ESLint, Prettier, CommitLint
- **Git Hooks**: Husky pre-commit hooks
- **Testing**: Jest with coverage thresholds
- **CI/CD**: GitHub Actions workflows
- **Docker**: Multi-stage builds with optimization
- **Documentation**: Contributing guidelines, security policies
- **Monorepo**: Turborepo configuration
- **Dependencies**: Renovate auto-updates

## Full-Stack Applications

### E-commerce Platform

Complete full-stack e-commerce platform with microfrontends, microservices, and plugins.

```bash
# Initialize full-stack e-commerce platform
re-shell create ecommerce-platform --type full-stack
cd ecommerce-platform

# Frontend: Core microfrontends
re-shell add product-catalog --framework react-ts --port 5173
re-shell add shopping-cart --framework vue-ts --port 5174
re-shell add checkout --framework react-ts --port 5175
re-shell add user-account --framework vue-ts --port 5176

# Backend: Microservices architecture
# Product catalog with search and filtering
re-shell generate backend catalog-service --language python --framework fastapi --port 8001 \
  --features "elasticsearch,redis,s3"

# Shopping cart with session management
re-shell generate backend cart-service --framework express --port 8002 \
  --features "redis,session"

# Order processing with workflow
re-shell generate backend order-service --language python --framework django --port 8003 \
  --features "celery,workflow,admin"

# Payment processing with Stripe
re-shell generate backend payment-service --framework express --port 8004 \
  --features "stripe,webhooks,pci"

# Inventory management
re-shell generate backend inventory-service --language python --framework flask --port 8005 \
  --features "warehouse,tracking"

# Install e-commerce plugins
re-shell plugin install @re-shell/payment-gateway
re-shell plugin install @re-shell/inventory-sync
re-shell plugin install @re-shell/analytics-tracker

# Configure plugin settings
re-shell plugin configure-cache enabled true
re-shell plugin configure-cache strategy hybrid

# Setup validation for checkout
re-shell plugin create-schema checkout-form '{
  "arguments": {
    "email": {
      "rules": [
        {"type": "required"},
        {"type": "email"}
      ]
    },
    "cardNumber": {
      "rules": [
        {"type": "required"},
        {"type": "pattern", "options": {"pattern": "^[0-9]{16}$"}}
      ]
    }
  }
}'

# Generate documentation
re-shell plugin generate-docs --format markdown --output ./docs/api
```

### Banking Dashboard

Secure full-stack banking application with advanced security features.

```bash
# Initialize with security template
re-shell create secure-banking --type full-stack --template banking
cd secure-banking

# Frontend: Secure modules with authentication
re-shell add account-overview --framework react-ts --auth required --port 5173
re-shell add transaction-history --framework react-ts --auth required --port 5174
re-shell add payment-transfer --framework vue-ts --auth required --port 5175
re-shell add admin-dashboard --framework angular --auth admin --port 5176

# Backend: Secure microservices
# Core banking API with strong typing
re-shell generate backend banking-api --language python --framework fastapi --port 8001 \
  --features "auth,encryption,audit,compliance"

# Transaction processing with ACID guarantees
re-shell generate backend transaction-service --language python --framework django --port 8002 \
  --features "postgres,transactions,audit-log"

# Authentication and authorization service
re-shell generate backend auth-service --framework express --port 8003 \
  --features "jwt,oauth2,2fa,biometric"

# Fraud detection service
re-shell generate backend fraud-service --language python --framework fastapi --port 8004 \
  --features "ml,rules-engine,alerts"

# Compliance and reporting
re-shell generate backend compliance-service --language python --framework django --port 8005 \
  --features "reporting,kyc,aml"

# Security plugins
re-shell plugin install @re-shell/auth-provider
re-shell plugin install @re-shell/encryption-suite
re-shell plugin install @re-shell/audit-logger

# Configure security
re-shell plugin security-policy --strict
re-shell plugin configure-cache encryptionEnabled true

# Setup middleware
re-shell plugin test-middleware authorization '{
  "user": {"role": "admin"},
  "resource": "transactions"
}'

# Regular security scans
re-shell plugin security-scan --all --schedule daily
```

### SaaS Admin Panel

Multi-tenant full-stack SaaS platform.

```bash
# Initialize SaaS platform
re-shell create saas-platform --type full-stack --multi-tenant
cd saas-platform

# Frontend: Admin modules
re-shell add tenant-manager --framework react-ts --port 5173
re-shell add billing-dashboard --framework vue-ts --port 5174
re-shell add analytics-viewer --framework react-ts --port 5175
re-shell add user-management --framework svelte-ts --port 5176
re-shell add api-explorer --framework vue-ts --port 5177

# Backend: Multi-tenant microservices
# Core API with tenant isolation
re-shell generate backend core-api --language python --framework fastapi --port 8001 \
  --features "multi-tenant,rate-limit,api-key"

# Billing and subscription management
re-shell generate backend billing-service --framework express --port 8002 \
  --features "stripe,subscriptions,invoicing,webhooks"

# Analytics and metrics collection
re-shell generate backend analytics-service --language python --framework fastapi --port 8003 \
  --features "timeseries,aggregation,export"

# User and access management
re-shell generate backend identity-service --language python --framework django --port 8004 \
  --features "sso,rbac,teams,audit"

# Background job processing
re-shell generate backend worker-service --language python --framework celery --port 8005 \
  --features "scheduled-tasks,reports,exports"

# SaaS plugins
re-shell plugin install @re-shell/multi-tenant
re-shell plugin install @re-shell/billing-integration
re-shell plugin install @re-shell/usage-metrics

# Configure caching for performance
re-shell plugin cache-stats
re-shell plugin optimize-cache --force

# Setup real-time monitoring
re-shell file-watcher start --workspace all
re-shell change-impact analyze --real-time
```

### Healthcare Portal

HIPAA-compliant full-stack healthcare application.

```bash
# Initialize with compliance template
re-shell create healthcare-portal --type full-stack --template healthcare-hipaa
cd healthcare-portal

# Frontend: Healthcare modules with encryption
re-shell add patient-records --framework react-ts --encrypted --port 5173
re-shell add appointment-scheduler --framework vue-ts --encrypted --port 5174
re-shell add lab-results --framework react-ts --encrypted --port 5175
re-shell add telemedicine --framework vue-ts --webrtc --port 5176
re-shell add provider-portal --framework angular --encrypted --port 5177

# Backend: HIPAA-compliant microservices
# Electronic Health Records (EHR) API
re-shell generate backend ehr-service --language python --framework django --port 8001 \
  --features "encryption,audit,hl7,fhir"

# Appointment and scheduling system
re-shell generate backend scheduling-service --language python --framework fastapi --port 8002 \
  --features "calendar,notifications,reminders"

# Lab integration service
re-shell generate backend lab-service --framework express --port 8003 \
  --features "hl7,results,integration"

# Telemedicine platform
re-shell generate backend telehealth-service --framework express --port 8004 \
  --features "webrtc,recording,transcription"

# Compliance and audit service
re-shell generate backend compliance-service --language python --framework django --port 8005 \
  --features "hipaa,audit-trail,reporting,encryption"

# Healthcare plugins
re-shell plugin install @re-shell/hipaa-compliance
re-shell plugin install @re-shell/medical-records
re-shell plugin install @re-shell/hl7-integration

# Compliance validation
re-shell plugin validation-rules --category healthcare
re-shell plugin security-report --compliance hipaa
```

### Educational Platform

Interactive full-stack learning management system.

```bash
# Initialize educational platform
re-shell create edu-platform --type full-stack
cd edu-platform

# Frontend: Learning modules
re-shell add course-catalog --framework react-ts --port 5173
re-shell add video-player --framework vue-ts --streaming --port 5174
re-shell add quiz-engine --framework svelte-ts --interactive --port 5175
re-shell add discussion-forum --framework react-ts --realtime --port 5176
re-shell add instructor-studio --framework vue-ts --port 5177

# Backend: Educational microservices
# Course management system
re-shell generate backend course-service --language python --framework django --port 8001 \
  --features "cms,versioning,publishing"

# Video streaming and processing
re-shell generate backend media-service --framework express --port 8002 \
  --features "streaming,transcoding,cdn"

# Assessment and grading engine
re-shell generate backend assessment-service --language python --framework fastapi --port 8003 \
  --features "quiz,grading,analytics,ai"

# Real-time collaboration
re-shell generate backend collab-service --framework express --port 8004 \
  --features "websocket,presence,chat,webrtc"

# Learning analytics and recommendations
re-shell generate backend analytics-service --language python --framework fastapi --port 8005 \
  --features "ml,recommendations,progress,insights"

# Educational plugins
re-shell plugin install @re-shell/video-streaming
re-shell plugin install @re-shell/quiz-builder
re-shell plugin install @re-shell/progress-tracker

# Configure for scalability
re-shell plugin configure-cache maxSize 5000
re-shell plugin configure-cache strategy hybrid
```

## Advanced Scenarios

### Full-Stack Integration Patterns

```bash
# API-First Development
# 1. Design API specification
re-shell generate openapi api-spec --version 3.0 --output specs/

# 2. Generate backend from spec
re-shell generate backend-from-spec user-service --spec specs/user-api.yaml \
  --framework fastapi --port 8001

# 3. Generate frontend SDK
re-shell generate sdk-from-spec user-sdk --spec specs/user-api.yaml \
  --language typescript --output packages/sdk

# 4. Use SDK in microfrontends
cd apps/user-dashboard
re-shell generate service UserService --use-sdk @myapp/user-sdk

# Shared Authentication
# Generate auth configuration for all services
re-shell generate auth jwt-config --output packages/auth

# Apply to all backends
re-shell configure auth --backend all --config packages/auth/jwt.config.js

# Apply to all frontends
re-shell configure auth --frontend all --provider jwt --endpoint http://localhost:8003/auth

# Database Migrations
# Coordinate database changes across services
re-shell generate migration create-users --service user-service
re-shell generate migration create-orders --service order-service

# Run migrations in order
re-shell migrate run --service user-service --env development
re-shell migrate run --service order-service --env development

# API Gateway Setup
re-shell generate backend api-gateway --framework express --port 4000 \
  --features "rate-limit,auth,cors,proxy"

# Configure routes
re-shell configure gateway --route "/api/users/*" --target "http://localhost:8001"
re-shell configure gateway --route "/api/orders/*" --target "http://localhost:8002"
re-shell configure gateway --route "/api/products/*" --target "http://localhost:8003"
```

### Microservice Testing Strategies

```bash
# Unit Testing
# Test individual services
cd services/user-service
pytest tests/unit/ --cov=app --cov-report=html

# Integration Testing
# Test service interactions
re-shell test integration --services "user-service,order-service" \
  --scenario "user-creates-order"

# Contract Testing
# Ensure API contracts are maintained
re-shell test contracts --provider user-service --consumer order-service

# End-to-End Testing
# Test complete user flows
re-shell test e2e --flow "user-registration-to-first-order" \
  --frontend storefront --backends "user-service,order-service,payment-service"

# Performance Testing
# Load test individual services
re-shell test performance --service product-service \
  --concurrent 100 --duration 300 --ramp-up 60

# Chaos Testing
# Test resilience
re-shell test chaos --scenario "service-failure" \
  --target order-service --duration 60
```

### Production Deployment

```bash
# Container Orchestration
# Generate Kubernetes manifests
re-shell generate k8s --all --namespace production \
  --ingress nginx --tls letsencrypt

# Generate Helm charts
re-shell generate helm --name my-app --version 1.0.0

# CI/CD Pipeline
# Generate complete pipeline
re-shell cicd generate github-actions --stages "test,build,deploy" \
  --environments "dev,staging,prod"

# Service Mesh
# Add Istio configuration
re-shell generate service-mesh istio --services all \
  --features "mtls,tracing,metrics"

# Monitoring Stack
# Setup complete observability
re-shell generate monitoring grafana --datasource prometheus
re-shell generate monitoring prometheus --targets all-services
re-shell generate logging elk --services all
re-shell generate tracing jaeger --services all

# Secrets Management
# Configure secrets for production
re-shell secrets generate --env production --provider vault
re-shell secrets rotate --all --env production
```

### Plugin Development Workflow

```bash
# Create new plugin project
mkdir my-re-shell-plugin
cd my-re-shell-plugin

# Initialize plugin structure
re-shell plugin validate . --init

# Development cycle
re-shell plugin hooks --available
re-shell plugin middleware-example custom

# Test plugin locally
re-shell plugin validate .
re-shell plugin test-middleware my-middleware '{"test":"data"}'

# Register commands
re-shell plugin register-command my-plugin '{
  "name": "my-command",
  "description": "Custom command",
  "arguments": [
    {"name": "input", "required": true}
  ]
}'

# Generate documentation
re-shell plugin generate-template my-command
re-shell plugin generate-docs my-command --format markdown
```

### Performance Optimization

```bash
# Analyze current performance
re-shell plugin cache-stats --verbose
re-shell analyze performance --all

# Optimize caching
re-shell plugin optimize-cache --force
re-shell plugin test-cache 1000 --verbose

# Configure incremental builds
re-shell incremental-build --enable
re-shell change-impact analyze --optimize

# Monitor improvements
re-shell plugin cache-stats --compare-before
```

### Enterprise Deployment

```bash
# Prepare for production
re-shell doctor --production
re-shell analyze bundle --all --optimize

# Generate CI/CD pipelines
re-shell cicd github --monorepo --docker --k8s
re-shell cicd generate-secrets --environment production

# Security hardening
re-shell plugin security-scan --all --fix
re-shell plugin security-policy --enforce strict

# Generate deployment documentation
re-shell plugin generate-docs --all --format html --output ./deploy-docs
```

### Troubleshooting

```bash
# Debug plugin issues
re-shell plugin list --debug
re-shell plugin info @re-shell/my-plugin --verbose

# Check for conflicts
re-shell plugin command-conflicts --verbose
re-shell plugin resolution-history

# Clear caches if needed
re-shell plugin clear-cache --all --force
re-shell plugin clear-middleware-cache

# Validate configurations
re-shell validate --all --verbose
re-shell doctor --fix
```

## Best Practices

### Plugin Selection

1. **Check compatibility**: `re-shell plugin info <plugin> --compatibility`
2. **Review security**: `re-shell plugin security-scan <plugin>`
3. **Test in isolation**: `re-shell plugin validate <plugin> --sandbox`
4. **Monitor performance**: `re-shell plugin test-cache 100 --with <plugin>`

### Performance Tips

1. **Enable caching**: `re-shell plugin configure-cache enabled true`
2. **Use hybrid strategy**: `re-shell plugin configure-cache strategy hybrid`
3. **Optimize TTL**: `re-shell plugin optimize-cache --analyze`
4. **Monitor metrics**: `re-shell plugin cache-stats --watch`

### Security Guidelines

1. **Regular scans**: `re-shell plugin security-scan --all --schedule weekly`
2. **Policy enforcement**: `re-shell plugin security-policy --strict`
3. **Audit logging**: `re-shell plugin install @re-shell/audit-logger`
4. **Update regularly**: `re-shell plugin update --security-only`

## Conclusion

Re-Shell CLI with its plugin ecosystem provides unlimited extensibility for building modern microfrontend applications. The combination of core features and plugin capabilities enables teams to create sophisticated, scalable, and maintainable applications with ease.

For more information:
- Documentation: https://re-shell.dev/docs
- Plugin Registry: https://re-shell.dev/plugins
- GitHub: https://github.com/umutkorkmaz/re-shell-cli
- Support: support@re-shell.dev
