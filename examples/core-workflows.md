# Core Workflows

These examples cover the standalone commands that most users hit first.

## Bootstrap A Monorepo

```bash
re-shell init acme-platform --template saas --package-manager pnpm --yes
cd acme-platform
re-shell workspace init
```

```bash
re-shell init analytics-hub --template dashboard --skip-install --yes
```

## Start From Architecture Templates

```bash
re-shell create customer-portal --template mern
re-shell create api-federation --template graphql
re-shell create event-stream-ui --template websocket-realtime
re-shell create service-mesh-lab --template microservices
```

## Scaffold Frontend, Backend, And Full-Stack Apps

```bash
re-shell create storefront --frontend react-ts --microfrontend --route /store --port 4201
re-shell create inventory-api --backend fastify --db prisma --type app
re-shell create admin-center --frontend vue-ts --backend nestjs --db typeorm --fullstack
```

```bash
re-shell create checkout --frontend react-ts --backend fastify --db prisma --fullstack --dry-run --verbose
```

## Manage Microfrontends

```bash
re-shell add billing --template react-ts --route /billing --port 4204
re-shell add support --template react-ts --route /support --port 4205
re-shell list
re-shell remove support --force
```

## Development Loop

```bash
re-shell build
re-shell build billing --production --analyze
re-shell serve storefront --port 4201 --open
```

```bash
re-shell tui --mode dashboard
re-shell tui --mode manage --project .
```

## Good First Exploration Commands

```bash
re-shell --help
re-shell create demo-app --frontend react-ts --dry-run --verbose
re-shell list --json
```
