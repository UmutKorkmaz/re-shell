import { BackendTemplate } from '../types';

/**
 * Traefik Proxy Template
 * Complete Traefik reverse proxy configuration with automatic service discovery and Let's Encrypt
 */
export const traefikProxyTemplate: BackendTemplate = {
  id: 'traefik-proxy',
  name: 'Traefik Proxy',
  displayName: 'Traefik Reverse Proxy',
  description: "Complete Traefik reverse proxy configuration with automatic service discovery, Let's Encrypt SSL, middleware, and dynamic routing",
  version: '3.0.0',
  language: 'typescript',
  framework: 'traefik',
  tags: ['kubernetes', 'traefik', 'proxy', 'ssl', 'load-balancing', 'cicd'],
  port: 8080,
  dependencies: {},
  features: ['microservices', 'docker', 'rest-api', 'security', 'monitoring', 'documentation'],

  files: {
    'traefik/traefik.yml': `# Traefik Static Configuration
global:
  checkNewVersion: true
  sendAnonymousUsage: false

api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ":80"
    transport:
      lifeCycle:
        requestAcceptGraceTimeout: 10
        graceTimeOut: 10

  websecure:
    address: ":443"
    transport:
      lifeCycle:
        requestAcceptGraceTimeout: 10
        graceTimeOut: 10
    http:
      tls:
        certResolver: letsencrypt

  traefik:
    address: ":8080"

  metrics:
    address: ":9090"

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: traefik-net

  kubernetesCRD:
    namespaces:
      - apps
      - default

  kubernetesIngress:
    namespaces:
      - apps
      - default

  file:
    filename: /etc/traefik/dynamic.yml
    watch: true

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@example.com
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web

metrics:
  prometheus:
    entryPoint: metrics
    addEntryPointsLabels: true
    addServicesLabels: true

accessLog:
  filePath: "/var/log/traefik/access.log"
  format: json

ping:
  entryPoint: traefik
`,

    'traefik/dynamic.yml': `# Traefik Dynamic Configuration
http:
  routers:
    api-router:
      rule: "Host:(traefik.example.com)"
      service: api@internal
      middlewares:
        - auth
        - secure-headers
      entryPoints:
        - websecure
      tls: {}

  services:
    api@internal: {}

  middlewares:
    auth:
      basicAuth:
        users:
          - "admin:$apr1$6XtVjD2p$F8z2YkV8kD8kD8kD8kD8kD."

    secure-headers:
      headers:
        sslRedirect: true
        stsSeconds: 31536000
        stsIncludeSubdomains: true
        stsPreload: true
        forceSTSHeader: true
        frameDeny: true
        contentTypeNosniff: true
        browserXssFilter: true

    rate-limit:
      rateLimit:
        average: 100
        period: 1m
        burst: 50

    compress:
      compress: true
`,

    'traefik/kubernetes/ingress-route.yaml': `# Traefik IngressRoute
apiVersion: traefik.containo.us/v1alpha1
kind: IngressRoute
metadata:
  name: api-ingress
  namespace: apps
spec:
  entryPoints:
    - websecure
  routes:
  - match: Host(api.example.com)
    kind: Rule
    priority: 10
    services:
    - name: api-service
      port: 8080
    middlewares:
    - name: rate-limit
      namespace: apps
    - name: secure-headers
      namespace: apps
  tls:
    certResolver: letsencrypt

---
# Middleware
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: rate-limit
  namespace: apps
spec:
  rateLimit:
    average: 100
    burst: 50
    period: 1m

---
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: secure-headers
  namespace: apps
spec:
  headers:
    customResponseHeaders:
      X-Frame-Options: "SAMEORIGIN"
      X-Content-Type-Options: "nosniff"

---
apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: apps
spec:
  ports:
  - port: 8080
    name: http
  selector:
    app: api
`,

    'traefik/docker/docker-compose.yml': `version: '3.8'

services:
  traefik:
    image: traefik:v3.0.0
    container_name: traefik
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
      - "9090:9090"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/traefik.yml:/etc/traefik/traefik.yml:ro
      - ./traefik/dynamic.yml:/etc/traefik/dynamic.yml:ro
      - ./letsencrypt:/letsencrypt
    networks:
      - traefik-net
    restart: unless-stopped

  # Example services with auto-discovery
  api-v1:
    image: nginx:alpine
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api-v1.rule=Host:(api-v1.local)"
      - "traefik.http.services.api-v1.loadbalancer.server.port=80"
      - "traefik.http.routers.api-v1.middlewares=compress,rate-limit"
    networks:
      - traefik-net

  api-v2:
    image: nginx:alpine
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api-v2.rule=Host:(api-v2.local)"
      - "traefik.http.services.api-v2.loadbalancer.server.port=80"
    networks:
      - traefik-net

  whoami:
    image: traefik/whoami
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.whoami.rule=Host:(whoami.local)"
      - "traefik.http.services.whoami.loadbalancer.server.port=80"
    networks:
      - traefik-net

  prometheus:
    image: prom/prometheus:v2.48.0
    ports:
      - "9091:9090"
    networks:
      - traefik-net

  grafana:
    image: grafana/grafana:10.2.0
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    networks:
      - traefik-net

networks:
  traefik-net:
    external: true
`,

    'traefik/docker/prometheus.yml': `global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'traefik'
    static_configs:
      - targets: ['traefik:9090']
    metrics_path: /metrics
`,

    'traefik/middleware/circuit-breaker.yaml': `# Circuit Breaker Middleware
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: circuit-breaker
  namespace: apps
spec:
  circuitBreaker:
    expression: "NetworkErrorRatio() > 0.5"
    checkPeriod: 5s
`,

    'traefik/middleware/retry.yaml': `# Retry Middleware
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: retry
  namespace: apps
spec:
  retry:
    attempts: 4
    initialInterval: 100ms
`,

    'traefik/middleware/cors.yaml': `# CORS Middleware
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: cors
  namespace: apps
spec:
  headers:
    accessControlAllowMethods:
      - GET
      - POST
      - PUT
      - DELETE
      - OPTIONS
    accessControlAllowOriginList:
      - https://example.com
    accessControlMaxAge: 100
    accessControlAllowHeaders:
      - Authorization
      - Content-Type
    accessControlAllowCredentials: true
`,

    'traefik/middleware/stripprefix.yaml': `# Strip Prefix Middleware
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: stripprefix
  namespace: apps
spec:
  stripPrefix:
    prefixes:
      - /api
      - /v1
    forceSlash: false
`,

    'traefik/middleware/chain.yaml': `# Middleware Chain
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: api-chain
  namespace: apps
spec:
  chain:
    middlewares:
    - name: cors
      namespace: apps
    - name: rate-limit
      namespace: apps
    - name: compress
      namespace: apps
`,

    'traefik/middleware/ipwhitelist.yaml': `# IP Whitelist Middleware
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: ipwhitelist
  namespace: apps
spec:
  ipWhiteList:
    sourceRange:
      - 10.0.0.0/8
      - 172.16.0.0/12
      - 192.168.0.0/16
`,

    'traefik/middleware/redirect.yaml': `# Redirect Scheme Middleware
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: https-redirect
  namespace: apps
spec:
  redirectScheme:
    scheme: https
    permanent: true
`,

    'traefik/service/weighted.yaml': `# Weighted Service (Mirroring/Traffic Splitting)
apiVersion: traefik.containo.us/v1alpha1
kind: TraefikService
metadata:
  name: api-service
  namespace: apps
spec:
  weighted:
    services:
      - name: api-v1
        port: 8080
        weight: 90
      - name: api-v2
        port: 8080
        weight: 10
`,

    'README.md': `# Traefik Reverse Proxy Configuration

Complete Traefik reverse proxy configuration with automatic service discovery, Let's Encrypt SSL, middleware, and dynamic routing.

## Features

### Service Discovery
- **Docker**: Automatic service discovery via labels
- **Kubernetes**: CRD and Ingress support
- **File**: Dynamic file-based configuration

### SSL/TLS
- **Let's Encrypt**: Automatic certificate generation
- **HTTP Challenge**: Standalone HTTP validation

### Middleware
- **Rate Limiting**: Per-IP rate limiting
- **Circuit Breaker**: Automatic failover
- **Retry**: Automatic request retries
- **CORS**: Configurable CORS policies
- **Compression**: Gzip compression
- **Security Headers**: HSTS, CSP, X-Frame-Options

### Load Balancing
- **Weighted Round Robin**: Traffic splitting
- **Mirroring**: Traffic mirroring for testing
- **Health Checks**: Active and passive health checks

### Observability
- **Prometheus Metrics**: Built-in metrics endpoint
- **Access Logging**: JSON format access logs
- **Dashboard**: Built-in web dashboard

## Quick Start

### Docker Compose

\`\`\`bash
# Create network
docker network create traefik-net

# Start Traefik
docker-compose -f traefik/docker/docker-compose.yml up -d

# Access dashboard
open http://localhost:8080

# Test with whoami service
curl http://whoami.local
\`\`\`

### Kubernetes

\`\`\`bash
# Install Traefik
kubectl apply -f traefik/kubernetes/ingress-route.yaml

# Verify
kubectl get pods -n apps
\`\`\`

## Service Discovery

### Docker Labels

\`\`\`yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.myapp.rule=Host:(app.local)"
  - "traefik.http.services.myapp.loadbalancer.server.port=8080"
\`\`\`

### Kubernetes IngressRoute

\`\`\`yaml
apiVersion: traefik.containo.us/v1alpha1
kind: IngressRoute
metadata:
  name: myapp
spec:
  entryPoints:
    - websecure
  routes:
  - match: Host(app.example.com)
    kind: Rule
    services:
    - name: myapp
      port: 8080
  tls:
    certResolver: letsencrypt
\`\`\`

## Middleware Examples

### Rate Limiting

\`\`\`yaml
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: rate-limit
spec:
  rateLimit:
    average: 100
    burst: 50
\`\`\`

### Circuit Breaker

\`\`\`yaml
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: circuit-breaker
spec:
  circuitBreaker:
    expression: "NetworkErrorRatio() > 0.5"
\`\`\`

## License

MIT
`,

    'Makefile': `.PHONY: help start stop restart logs dashboard test clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \\033[36m%-15s\\033[0m %s\\n", $$1, $$2}' $(MAKEFILE_LIST)

start: ## Start Traefik and services
	docker network create traefik-net 2>/dev/null || true
	docker-compose -f traefik/docker/docker-compose.yml up -d

stop: ## Stop all services
	docker-compose -f traefik/docker/docker-compose.yml down

restart: ## Restart Traefik
	docker-compose -f traefik/docker/docker-compose.yml restart traefik

logs: ## View Traefik logs
	docker-compose -f traefik/docker/docker-compose.yml logs -f traefik

dashboard: ## Open Traefik dashboard
	open http://localhost:8080

metrics: ## View Prometheus metrics
	curl -s http://localhost:9090/metrics | head -50

test: ## Test Traefik proxy
	@echo "Testing whoami service..."
	curl -s whoami.local
	@echo ""
	@echo "Testing rate limiting..."
	for i in $$(seq 1 20); do \\
		curl -s -o /dev/null -w "%{http_code}\\n" http://whoami.local; \\
	done

validate: ## Validate Traefik configuration
	docker exec traefik traefik version

clean: ## Remove all containers and volumes
	docker-compose -f traefik/docker/docker-compose.yml down -v
	docker network rm traefik-net 2>/dev/null || true
`
  },

  postInstall: [
    `echo "Setting up Traefik reverse proxy..."
echo ""
echo "Docker Compose:"
echo "1. Create network:"
echo "   docker network create traefik-net"
echo ""
echo "2. Start Traefik:"
echo "   docker-compose -f traefik/docker/docker-compose.yml up -d"
echo ""
echo "3. Access dashboard:"
echo "   open http://localhost:8080"
echo ""
echo "4. Test service discovery:"
echo "   curl http://whoami.local"
`
  ]
};
