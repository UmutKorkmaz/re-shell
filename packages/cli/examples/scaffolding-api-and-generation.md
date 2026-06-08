# Scaffolding, API, And Generation

These examples cover code generation, API-first workflows, OpenAPI tooling, docs generation, and client SDK output.

## Generate Components, Hooks, Services, Tests, And Docs

```bash
re-shell generate component UserCard --framework react --workspace apps/storefront --export
re-shell generate hook useInventory --workspace apps/storefront --export
re-shell generate service BillingClient --workspace packages/sdk
re-shell generate test apps/storefront
re-shell generate docs
```

## Generate Backends And Full-Stack Features

```bash
re-shell generate backend auth-service --framework fastapi --language python --features code-quality redis hot-reload --workspace services/auth
re-shell generate backend payments --framework express --language typescript --features redis --port 4100
re-shell generate feature orders --type crud --backend nestjs --frontend react --language typescript --database prisma --openapi
re-shell generate feature notifications --type websocket --backend fastify --frontend react --websockets
```

## OpenAPI Discovery And Spec Generation

```bash
re-shell api openapi list-frameworks
re-shell api openapi generate services/catalog --framework fastify --output openapi.yaml --format yaml --dry-run
re-shell api openapi discover services/catalog
re-shell api openapi annotate fastify
```

## Swagger, Versioning, And Validation

```bash
re-shell api swagger generate services/catalog
re-shell api swagger multi-service services
re-shell api versioning init services/catalog
re-shell api versioning compare openapi-v1.yaml openapi-v2.yaml
re-shell api validation generate services/catalog --framework fastify
re-shell api validation schema fastify
```

## API Testing, Docs, Gateway, And Analytics

```bash
re-shell api test list-frameworks
re-shell api test generate services/catalog --framework fastify
re-shell api test contract fastify
re-shell api docs generate openapi.yaml docs/api
re-shell api docs serve openapi.yaml
re-shell api gateway list
re-shell api gateway generate kong gateway
re-shell api analytics list-providers
re-shell api analytics list-frameworks
```

## Generate Clients And Types From OpenAPI

```bash
re-shell api client validate openapi.yaml
re-shell api client list openapi.yaml
re-shell api client generate openapi.yaml packages/catalog-sdk
re-shell api client types openapi.yaml packages/catalog-sdk/src/types
re-shell api client sdk openapi.yaml packages/catalog-sdk
```

## Good API-First Loop

```bash
re-shell api openapi generate services/catalog --framework fastify --output openapi.yaml
re-shell api docs preview openapi.yaml
re-shell api client generate openapi.yaml packages/catalog-sdk
re-shell generate feature catalog-admin --type crud --backend fastify --frontend react --database prisma --openapi
```
