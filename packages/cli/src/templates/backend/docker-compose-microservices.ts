import { BackendTemplate } from '../types';

/**
 * Comprehensive Docker Compose template for microservices architecture
 * Includes backend APIs, frontend apps, databases, caches, message queues, and infrastructure services
 */
export const dockerComposeTemplate: BackendTemplate = {
  id: 'docker-compose-microservices',
  name: 'Docker Compose Microservices',
  displayName: 'Microservices Stack',
  description: 'Complete microservices architecture with Docker Compose - backend APIs, frontend apps, databases, Redis, RabbitMQ, and monitoring',
  version: '1.0.0',
  language: 'typescript',
  framework: 'docker-compose',
  tags: ['docker', 'microservices', 'orchestration', 'devops', 'monitoring'],
  port: 8080,
  dependencies: {},
  features: ['docker', 'microservices', 'rest-api', 'websockets', 'graphql', 'database', 'caching', 'queue'],

  files: {
    'docker-compose.yml': `version: '3.8'

services:
  # ============ BACKEND SERVICES ============
  
  # Node.js/Express Backend API
  backend-api:
    build:
      context: ./services/backend-api
      dockerfile: Dockerfile
    container_name: backend-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/appdb
      - REDIS_URL=redis://redis:6379
      - RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    networks:
      - app-network
    volumes:
      - ./services/backend-api:/app
      - /app/node_modules
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Python/FastAPI Backend Service
  backend-python:
    build:
      context: ./services/backend-python
      dockerfile: Dockerfile
    container_name: backend-python
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/appdb
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    networks:
      - app-network
    volumes:
      - ./services/backend-python:/app
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Go/Gin Backend Service
  backend-go:
    build:
      context: ./services/backend-go
      dockerfile: Dockerfile
    container_name: backend-go
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - DB_HOST=postgres
      - DB_PORT=5432
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - postgres
      - redis
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # GraphQL Gateway (Apollo Federation)
  graphql-gateway:
    build:
      context: ./services/graphql-gateway
      dockerfile: Dockerfile
    container_name: graphql-gateway
    restart: unless-stopped
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - SERVICES_URLS=http://backend-api:3000/graphql,http://backend-python:8000/graphql
    depends_on:
      - backend-api
      - backend-python
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/.well-known/apollo/server-health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ============ FRONTEND SERVICES ============
  
  # React Frontend (Vite)
  frontend-react:
    build:
      context: ./frontend/react
      dockerfile: Dockerfile
    container_name: frontend-react
    restart: unless-stopped
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:3000/api
      - VITE_GRAPHQL_URL=http://localhost:4000/graphql
    networks:
      - app-network
    volumes:
      - ./frontend/react:/app
      - /app/node_modules
    command: npm run dev -- --host

  # Vue.js Frontend (Vite)
  frontend-vue:
    build:
      context: ./frontend/vue
      dockerfile: Dockerfile
    container_name: frontend-vue
    restart: unless-stopped
    ports:
      - "5174:5173"
    environment:
      - VITE_API_URL=http://localhost:3000/api
    networks:
      - app-network
    volumes:
      - ./frontend/vue:/app
      - /app/node_modules
    command: npm run dev -- --host

  # Next.js SSR Application
  frontend-nextjs:
    build:
      context: ./frontend/nextjs
      dockerfile: Dockerfile
    container_name: frontend-nextjs
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3000/api
      - NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
    networks:
      - app-network
    volumes:
      - ./frontend/nextjs:/app
      - /app/node_modules
      - /app/.next

  # ============ DATABASES ============
  
  # PostgreSQL
  postgres:
    image: postgres:16-alpine
    container_name: postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=appdb
      - POSTGRES_MULTIPLE_DATABASES=authdb,userdb
    networks:
      - app-network
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # MySQL
  mysql:
    image: mysql:8.0
    container_name: mysql
    restart: unless-stopped
    ports:
      - "3306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=password
      - MYSQL_DATABASE=appdb
    networks:
      - app-network
    volumes:
      - mysql_data:/var/lib/mysql
      - ./docker/mysql/conf.d:/etc/mysql/conf.d
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  # MongoDB
  mongodb:
    image: mongo:7
    container_name: mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=mongoadmin
      - MONGO_INITDB_ROOT_PASSWORD=password
    networks:
      - app-network
    volumes:
      - mongodb_data:/data/db
      - mongodb_config:/data/configdb
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ============ CACHING ============
  
  # Redis
  redis:
    image: redis:7-alpine
    container_name: redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    networks:
      - app-network
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --requirepass password
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Memcached
  memcached:
    image: memcached:1.6-alpine
    container_name: memcached
    restart: unless-stopped
    ports:
      - "11211:11211"
    networks:
      - app-network
    command: memcached -m 256
    healthcheck:
      test: ["CMD", "nc", "-z", "localhost", "11211"]
      interval: 10s
      timeout: 5s
      retries: 3

  # ============ MESSAGE QUEUES ============
  
  # RabbitMQ
  rabbitmq:
    image: rabbitmq:3.12-management-alpine
    container_name: rabbitmq
    restart: unless-stopped
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      - RABBITMQ_DEFAULT_USER=guest
      - RABBITMQ_DEFAULT_PASS=guest
    networks:
      - app-network
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 30s
      timeout: 10s
      retries: 5

  # Apache Kafka
  kafka:
    image: bitnami/kafka:3.6
    container_name: kafka
    restart: unless-stopped
    ports:
      - "9092:9092"
      - "9093:9093"
    environment:
      - KAFKA_CFG_NODE_ID=0
      - KAFKA_CFG_PROCESS_ROLES=broker,controller
      - KAFKA_CFG_CONTROLLER_QUORUM_VOTERS=0@kafka:9093
      - KAFKA_CFG_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093
      - KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092
      - KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      - KAFKA_CFG_CONTROLLER_LISTENER_NAMES=CONTROLLER
      - KAFKA_CFG_INTER_BROKER_LISTENER_NAME=PLAINTEXT
      - KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE=true
    networks:
      - app-network
    volumes:
      - kafka_data:/bitnami/kafka
    healthcheck:
      test: ["CMD-SHELL", "kafka-topics.sh --bootstrap-server localhost:9092 --list"]
      interval: 30s
      timeout: 10s
      retries: 5

  # ============ SEARCH & ANALYTICS ============
  
  # Elasticsearch
  elasticsearch:
    image: elasticsearch:8.11.0
    container_name: elasticsearch
    restart: unless-stopped
    ports:
      - "9200:9200"
      - "9300:9300"
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    networks:
      - app-network
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5

  # ============ MONITORING & LOGGING ============
  
  # Prometheus
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    networks:
      - app-network
    volumes:
      - ./docker/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  # Grafana
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: unless-stopped
    ports:
      - "3002:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
    networks:
      - app-network
    volumes:
      - grafana_data:/var/lib/grafana
      - ./docker/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./docker/grafana/datasources:/etc/grafana/provisioning/datasources

  # Jaeger Tracing
  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: jaeger
    restart: unless-stopped
    ports:
      - "5775:5775/udp"
      - "6831:6831/udp"
      - "5778:5778"
      - "16686:16686"
      - "14268:14268"
      - "14250:14250"
      - "9411:9411"
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    networks:
      - app-network

  # Loki Log Aggregation
  loki:
    image: grafana/loki:latest
    container_name: loki
    restart: unless-stopped
    ports:
      - "3100:3100"
    networks:
      - app-network
    volumes:
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml

  # Promtail (Log Collector)
  promtail:
    image: grafana/promtail:latest
    container_name: promtail
    restart: unless-stopped
    networks:
      - app-network
    volumes:
      - ./docker/promtail/promtail.yml:/etc/promtail/config.yml
      - /var/log:/var/log:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    command: -config.file=/etc/promtail/config.yml

  # ============ INFRASTRUCTURE ============
  
  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    networks:
      - app-network
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/conf.d:/etc/nginx/conf.d:ro
      - ./docker/nginx/ssl:/etc/nginx/ssl:ro
      - nginx_cache:/var/cache/nginx
    depends_on:
      - backend-api
      - frontend-react
      - frontend-vue
      - frontend-nextjs
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Certbot (SSL Certificates)
  certbot:
    image: certbot/certbot:latest
    container_name: certbot
    networks:
      - app-network
    volumes:
      - ./docker/nginx/ssl:/etc/letsencrypt
      - ./docker/certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait \\$\\!; done;'"

  # ============ DEVELOPMENT TOOLS ============
  
  # Mailhog (Email Testing)
  mailhog:
    image: mailhog/mailhog:latest
    container_name: mailhog
    restart: unless-stopped
    ports:
      - "1025:1025"
      - "8025:8025"
    networks:
      - app-network

  # PgAdmin (PostgreSQL Management)
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: pgadmin
    restart: unless-stopped
    ports:
      - "5050:80"
    environment:
      - PGADMIN_DEFAULT_EMAIL=admin@example.com
      - PGADMIN_DEFAULT_PASSWORD=admin
    networks:
      - app-network
    volumes:
      - pgadmin_data:/var/lib/pgadmin

  # Mongo Express (MongoDB Management)
  mongo-express:
    image: mongo-express:latest
    container_name: mongo-express
    restart: unless-stopped
    ports:
      - "8081:8081"
    environment:
      - ME_CONFIG_MONGODB_URL=mongodb://mongoadmin:password@mongodb:27017/
    networks:
      - app-network
    depends_on:
      - mongodb

  # Redis Commander (Redis Management)
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: redis-commander
    restart: unless-stopped
    ports:
      - "8082:8081"
    environment:
      - REDIS_HOSTS=local:redis:6379:0:password
    networks:
      - app-network
    depends_on:
      - redis

networks:
  app-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

volumes:
  # Databases
  postgres_data:
  mysql_data:
  mongodb_data:
  mongodb_config:
  
  # Caching
  redis_data:
  
  # Message Queues
  rabbitmq_data:
  kafka_data:
  
  # Search & Analytics
  elasticsearch_data:
  
  # Monitoring
  prometheus_data:
  grafana_data:
  loki_data:
  
  # Infrastructure
  nginx_cache:
  pgadmin_data:
`,

    'docker-compose.dev.yml': `# Development override for Docker Compose
# Usage: docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

version: '3.8'

services:
  # Backend API with hot reload
  backend-api:
    build:
      target: development
    environment:
      - NODE_ENV=development
    volumes:
      - ./services/backend-api/src:/app/src:ro
    command: npm run dev

  # Frontend with hot reload
  frontend-react:
    environment:
      - VITE_DEV_MODE=true
    command: npm run dev

  # PostgreSQL with extended logging
  postgres:
    command:
      - postgres
      - -c
      - log_statement=all
      - -c
      - log_duration=on
`,

    'docker-compose.prod.yml': `# Production override for Docker Compose
# Usage: docker-compose -f docker-compose.yml -f docker-compose.prod.yml up

version: '3.8'

services:
  # Production backend with resource limits
  backend-api:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    environment:
      - NODE_ENV=production

  # Production frontend
  frontend-react:
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  # Production database with backups
  postgres:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
`,

    'Makefile': `.PHONY: help up down restart logs clean build install test

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \\033[36m%-15s\\033[0m %s\\n", $$1, $$2}' $(MAKEFILE_LIST)

up: ## Start all services
	docker-compose up -d

up-dev: ## Start all services in development mode
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

up-prod: ## Start all services in production mode
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

down: ## Stop all services
	docker-compose down

down-volumes: ## Stop all services and remove volumes
	docker-compose down -v

restart: ## Restart all services
	docker-compose restart

logs: ## Show logs from all services
	docker-compose logs -f

logs-backend: ## Show logs from backend services
	docker-compose logs -f backend-api backend-python backend-go graphql-gateway

logs-frontend: ## Show logs from frontend services
	docker-compose logs -f frontend-react frontend-vue frontend-nextjs

logs-db: ## Show logs from databases
	docker-compose logs -f postgres mysql mongodb redis

ps: ## List all running services
	docker-compose ps

build: ## Build all services
	docker-compose build

rebuild: ## Rebuild all services without cache
	docker-compose build --no-cache

clean: ## Remove all containers, networks, and volumes
	docker-compose down -v
	docker system prune -af

install: ## Install dependencies
	@echo "Installing dependencies..."
	cd services/backend-api && npm install
	cd ../backend-python && pip install -r requirements.txt
	cd ../backend-go && go mod download
	cd ../../frontend/react && npm install
	cd ../vue && npm install
	cd ../nextjs && npm install

test: ## Run all tests
	docker-compose exec backend-api npm test
	docker-compose exec backend-python pytest
	docker-compose exec backend-go go test ./...

test-unit: ## Run unit tests
	docker-compose exec backend-api npm run test:unit

test-integration: ## Run integration tests
	docker-compose exec backend-api npm run test:integration

test-e2e: ## Run end-to-end tests
	docker-compose exec frontend-react npm run test:e2e

lint: ## Run linting
	docker-compose exec backend-api npm run lint
	docker-compose exec frontend-react npm run lint

format: ## Format code
	docker-compose exec backend-api npm run format

db-migrate: ## Run database migrations
	docker-compose exec backend-api npm run db:migrate

db-seed: ## Seed database
	docker-compose exec backend-api npm run db:seed

db-reset: ## Reset database
	docker-compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS appdb; CREATE DATABASE appdb;"
	docker-compose exec backend-api npm run db:migrate
	docker-compose exec backend-api npm run db:seed

shell-backend: ## Open shell in backend container
	docker-compose exec backend-api sh

shell-frontend: ## Open shell in frontend container
	docker-compose exec frontend-react sh

shell-db: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U postgres appdb

monitoring: ## Open monitoring dashboards
	@echo "Grafana: http://localhost:3002 (admin/admin)"
	@echo "Prometheus: http://localhost:9090"
	@echo "Jaeger: http://localhost:16686"
	@echo "RabbitMQ: http://localhost:15672 (guest/guest)"

dev-tools: ## Open development tools
	@echo "PgAdmin: http://localhost:5050"
	@echo "Mongo Express: http://localhost:8081"
	@echo "Redis Commander: http://localhost:8082"
	@echo "Mailhog: http://localhost:8025"
`,

    'README.md': `# Microservices Docker Compose Stack

Complete microservices architecture with Docker Compose including backend APIs, frontend applications, databases, caching, message queues, and monitoring.

## Architecture

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                         Nginx Reverse Proxy                     │
│                   (Load Balancer & SSL Termination)             │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌───────▼────────┐   ┌──────▼─────┐
│  React SPA     │   │  Vue.js SPA    │   │  Next.js   │
│  (Port 5173)   │   │  (Port 5174)   │   │  (Port 3001)│
└───────┬────────┘   └───────┬────────┘   └──────┬──────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌───────▼────────┐   ┌──────▼──────┐
│ GraphQL Gateway│   │  Node.js API   │   │  Python API  │
│  (Port 4000)   │   │  (Port 3000)   │   │  (Port 8000) │
└───────┬────────┘   └───────┬────────┘   └──────┬──────┘
        │                     │                     │
        └─────────────────────┴─────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────┐    ┌──────────▼─────┐    ┌────────▼────────┐
│ PostgreSQL │    │  Redis Cache   │    │    RabbitMQ     │
│  (Port 5432)│    │  (Port 6379)   │    │   (Port 5672)   │
└─────────────┘    └────────────────┘    └─────────────────┘
\`\`\`

## Services

### Backend Services
- **backend-api** - Node.js/Express REST API (Port 3000)
- **backend-python** - Python/FastAPI service (Port 8000)
- **backend-go** - Go/Gin microservice (Port 8080)
- **graphql-gateway** - Apollo Federation gateway (Port 4000)

### Frontend Services
- **frontend-react** - React SPA with Vite (Port 5173)
- **frontend-vue** - Vue.js SPA with Vite (Port 5174)
- **frontend-nextjs** - Next.js SSR application (Port 3001)

### Databases
- **postgres** - PostgreSQL 16 (Port 5432)
- **mysql** - MySQL 8.0 (Port 3306)
- **mongodb** - MongoDB 7 (Port 27017)

### Caching
- **redis** - Redis 7 with persistence (Port 6379)
- **memcached** - Memcached 1.6 (Port 11211)

### Message Queues
- **rabbitmq** - RabbitMQ 3.12 with management UI (Port 5672, 15672)
- **kafka** - Apache Kafka 3.6 (Port 9092)

### Search & Analytics
- **elasticsearch** - Elasticsearch 8.11 (Port 9200)

### Monitoring
- **prometheus** - Metrics collection (Port 9090)
- **grafana** - Visualization dashboards (Port 3002)
- **jaeger** - Distributed tracing (Port 16686)
- **loki** - Log aggregation (Port 3100)
- **promtail** - Log collector

### Infrastructure
- **nginx** - Reverse proxy & load balancer (Port 80, 443)
- **certbot** - Let's Encrypt SSL certificates

### Development Tools
- **mailhog** - Email testing (Port 1025, 8025)
- **pgadmin** - PostgreSQL management (Port 5050)
- **mongo-express** - MongoDB management (Port 8081)
- **redis-commander** - Redis management (Port 8082)

## Quick Start

\`\`\`bash
# Clone and setup
git clone <repo>
cd <project>

# Start all services
make up

# Or start in development mode
make up-dev

# View logs
make logs

# Stop services
make down
\`\`\`

## URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| React App | http://localhost:5173 | - |
| Vue App | http://localhost:5174 | - |
| Next.js App | http://localhost:3001 | - |
| API Gateway | http://localhost:4000 | - |
| Node.js API | http://localhost:3000 | - |
| Python API | http://localhost:8000 | - |
| Go API | http://localhost:8080 | - |
| Grafana | http://localhost:3002 | admin/admin |
| Prometheus | http://localhost:9090 | - |
| Jaeger | http://localhost:16686 | - |
| RabbitMQ Management | http://localhost:15672 | guest/guest |
| PgAdmin | http://localhost:5050 | admin@example.com/admin |
| Mongo Express | http://localhost:8081 | - |
| Redis Commander | http://localhost:8082 | - |
| Mailhog | http://localhost:8025 | - |

## Development

\`\`\`bash
# Install dependencies
make install

# Run tests
make test

# Run linting
make lint

# Database operations
make db-migrate
make db-seed
make db-reset

# Open shells
make shell-backend
make shell-frontend
make shell-db
\`\`\`

## Production

\`\`\`bash
# Start in production mode
make up-prod

# Build optimized images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# View monitoring
make monitoring
\`\`\`

## Maintenance

\`\`\`bash
# View resource usage
docker stats

# Clean up unused resources
make clean

# Rebuild services
make rebuild

# Backup databases
docker-compose exec postgres pg_dump -U postgres appdb > backup.sql
\`\`\`

## License

MIT
`,

    '.env.example': `# Application Configuration
NODE_ENV=development
APP_NAME=microservices-app
APP_URL=http://localhost:3000

# Database Configuration
DATABASE_URL=postgresql://postgres:password@postgres:5432/appdb
MYSQL_URL=mysql://root:password@mysql:3306/appdb
MONGODB_URL=mongodb://mongoadmin:password@mongodb:27017/appdb?authSource=admin

# Redis Configuration
REDIS_URL=redis://:password@redis:6379
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=password

# RabbitMQ Configuration
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASS=guest

# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=1d

# Email Configuration (Mailhog)
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@example.com

# Monitoring
ENABLE_PROMETHEUS=true
ENABLE_JAEGER=true
JAEGER_ENDPOINT=http://jaeger:14268/api/traces

# Frontend URLs
VITE_API_URL=http://localhost:3000/api
VITE_GRAPHQL_URL=http://localhost:4000/graphql
`
  },

  postInstall: [
    `echo "Setting up microservices docker-compose environment..."
echo ""
echo "1. Copy .env.example to .env and configure:"
echo "   cp .env.example .env"
echo ""
echo "2. Start all services:"
echo "   make up"
echo ""
echo "3. Or start in development mode:"
echo "   make up-dev"
echo ""
echo "4. View logs:"
echo "   make logs"
echo ""
echo "5. Access monitoring:"
echo "   make monitoring"
echo "   make dev-tools"`
  ]
};
