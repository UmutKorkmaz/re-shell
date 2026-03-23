import { BackendTemplate } from '../types';

/**
 * Nginx Ingress Template
 * Complete Nginx ingress configuration with SSL/TLS termination and rate limiting
 */
export const nginxIngressTemplate: BackendTemplate = {
  id: 'nginx-ingress',
  name: 'Nginx Ingress',
  displayName: 'Nginx Ingress Controller',
  description: 'Complete Nginx ingress controller configuration with SSL/TLS termination, rate limiting, canary deployments, and advanced routing',
  version: '1.9.0',
  language: 'typescript',
  framework: 'nginx',
  tags: ['kubernetes', 'nginx', 'ingress', 'ssl', 'load-balancing', 'cicd'],
  port: 8080,
  dependencies: {},
  features: ['microservices', 'docker', 'rest-api', 'security', 'monitoring', 'documentation'],

  files: {
    'nginx/base/ingress-controller.yaml': `# Nginx Ingress Controller Installation
apiVersion: v1
kind: Namespace
metadata:
  name: ingress-nginx
  labels:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx

---
# Service Account
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ingress-nginx
  namespace: ingress-nginx

---
# RBAC
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ingress-nginx
  namespace: ingress-nginx
rules:
- apiGroups:
  - ""
  resources:
  - configmaps
  - endpoints
  - persistentvolumeclaims
  - pods
  - replicationcontrollers
  - secrets
  - services
  verbs:
  - get
  - list
  - watch

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ingress-nginx
  namespace: ingress-nginx
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: ingress-nginx
subjects:
- kind: ServiceAccount
  name: ingress-nginx
  namespace: ingress-nginx

---
# ConfigMap for Nginx Configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-configuration
  namespace: ingress-nginx
data:
  allow-snippet-annotations: "true"
  use-forwarded-headers: "true"
  compute-full-forwarded-for: "true"
  use-proxy-protocol: "false"
  hide-headers: "Server,X-Powered-By"
  server-tokens: "false"
  client-header-timeout: "60"
  client-body-timeout: "60"
  keep-alive: "75"
  keep-alive-requests: "100"
  upstream-keepalive-connections: "100"
  upstream-keepalive-timeout: "60"
  upstream-keepalive-requests: "1000"
  proxy-body-size: "100m"
  proxy-connect-timeout: "15"
  proxy-send-timeout: "60"
  proxy-read-timeout: "60"
  proxy-buffering: "on"
  ssl-protocols: "TLSv1.2 TLSv1.3"
  ssl-ciphers: "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384"
  ssl-prefer-server-ciphers: "false"
  ssl-session-cache: "true"
  ssl-session-cache-size: "10m"
  ssl-session-timeout: "10m"
  ssl-session-tickets: "true"
  http2-max-field-size: "4k"
  http2-max-header-size: "16k"
  log-format-upstream: '\\$remote_addr - \\$remote_user [\\$time_local] "\\$request" \\$status \\$body_bytes_sent "\\$http_referer" "\\$http_user_agent" \\$request_length \\$request_time [\\$proxy_upstream_name] [\\$proxy_alternative_upstream_name] upstream_addr \\$upstream_addr upstream_response_length \\$upstream_response_length upstream_response_time \\$upstream_response_time upstream_status \\$upstream_status req_id \\$req_id'
  enable-ocsp: "true"
  enable-modsecurity: "false"
  enable-opentracing: "false"

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: tcp-services
  namespace: ingress-nginx
data:
  # TCP services configuration
  # 3306: "default/mysql-service:3306"

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: udp-services
  namespace: ingress-nginx
data:
  # UDP services configuration

---
# Ingress Controller Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ingress-nginx-controller
  namespace: ingress-nginx
  labels:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: ingress-nginx
      app.kubernetes.io/instance: ingress-nginx
  template:
    metadata:
      labels:
        app.kubernetes.io/name: ingress-nginx
        app.kubernetes.io/instance: ingress-nginx
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "10254"
    spec:
      serviceAccountName: ingress-nginx
      terminationGracePeriodSeconds: 300
      containers:
      - name: controller
        image: registry.k8s.io/ingress-nginx/controller:v1.9.0
        args:
        - /nginx-ingress-controller
        - --configmap=\\$(POD_NAMESPACE)/nginx-configuration
        - --tcp-services-configmap=\\$(POD_NAMESPACE)/tcp-services
        - --udp-services-configmap=\\$(POD_NAMESPACE)/udp-services
        - --publish-status-address=localhost
        - --annotations-prefix=nginx.ingress.kubernetes.io
        - --enable-ssl-passthrough
        env:
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: POD_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        ports:
        - name: http
          containerPort: 80
        - name: https
          containerPort: 443
        - name: webhook
          containerPort: 8443
        - name: metrics
          containerPort: 10254
        livenessProbe:
          httpGet:
            path: /healthz
            port: 10254
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /healthz
            port: 10254
          initialDelaySeconds: 10
          periodSeconds: 10
        resources:
          requests:
            cpu: 100m
            memory: 90Mi
          limits:
            cpu: 1000m
            memory: 512Mi

---
# Service
apiVersion: v1
kind: Service
metadata:
  name: ingress-nginx-controller
  namespace: ingress-nginx
spec:
  type: LoadBalancer
  externalTrafficPolicy: Local
  ports:
  - name: http
    port: 80
    targetPort: http
  - name: https
    port: 443
    targetPort: https
  selector:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx

---
# Metrics Service
apiVersion: v1
kind: Service
metadata:
  name: ingress-nginx-controller-metrics
  namespace: ingress-nginx
  labels:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
spec:
  type: ClusterIP
  ports:
  - name: metrics
    port: 10254
    targetPort: metrics
  selector:
    app.kubernetes.io/name: ingress-nginx
    app.kubernetes.io/instance: ingress-nginx
`,

    'nginx/rate-limit/rate-limit-ingress.yaml': `# Rate Limiting Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: rate-limited-ingress
  namespace: apps
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/limit-rps: "10"
    nginx.ingress.kubernetes.io/limit-rpm: "600"
    nginx.ingress.kubernetes.io/limit-connections: "10"
    nginx.ingress.kubernetes.io/limit-rps-interval: "1s"
    nginx.ingress.kubernetes.io/limit-burst-multiplier: "2"
    nginx.ingress.kubernetes.io/limit-rate-after: "100"
    nginx.ingress.kubernetes.io/limit-rate: "1000"
    nginx.ingress.kubernetes.io/limit-status-code: "429"
    nginx.ingress.kubernetes.io/limit-whitelist: "10.0.0.0/8"
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 8080

---
# Advanced Rate Limiting per IP
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ip-rate-limited-ingress
  namespace: apps
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/limit-rps: "5"
    nginx.ingress.kubernetes.io/limit-burst-multiplier: "1"
    nginx.ingress.kubernetes.io/limit-req-status-code: "429"
    nginx.ingress.kubernetes.io/limit-reject-code: "503"
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-service
            port:
              number: 3000
`,

    'nginx/ssl-termination/ssl-ingress.yaml': `# SSL/TLS Termination Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ssl-termination-ingress
  namespace: apps
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/ssl-prefer-server-ciphers: "true"
    nginx.ingress.kubernetes.io/ssl-protocols: "TLSv1.2 TLSv1.3"
    nginx.ingress.kubernetes.io/ssl-ciphers: "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256"
    nginx.ingress.kubernetes.io/hsts: "true"
    nginx.ingress.kubernetes.io/hsts-max-age: "31536000"
    nginx.ingress.kubernetes.io/hsts-include-subdomains: "true"
    nginx.ingress.kubernetes.io/hsts-preload: "true"
spec:
  tls:
  - hosts:
    - secure.example.com
    secretName: tls-secret
  rules:
  - host: secure.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: secure-service
            port:
              number: 8443

---
# Multiple TLS Certificate Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: multi-tls-ingress
  namespace: apps
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  tls:
  - hosts:
    - app1.example.com
    secretName: app1-tls-secret
  - hosts:
    - app2.example.com
    secretName: app2-tls-secret
  rules:
  - host: app1.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app1-service
            port:
              number: 8080
  - host: app2.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app2-service
            port:
              number: 8080
`,

    'nginx/canary/canary-ingress.yaml': `# Canary Deployment with Blue-Green Strategy
# Main (Stable) Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: main-ingress
  namespace: apps
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-service-v1
            port:
              number: 8080

---
# Canary Ingress (10% traffic)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: canary-ingress
  namespace: apps
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-service-v2
            port:
              number: 8080

---
# Canary by Header
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: header-canary-ingress
  namespace: apps
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-by-header: "X-Canary"
    nginx.ingress.kubernetes.io/canary-by-header-value: "true"
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-service-v2
            port:
              number: 8080

---
# Canary by Cookie
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: cookie-canary-ingress
  namespace: apps
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-by-cookie: "canary_user"
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-service-v2
            port:
              number: 8080
`,

    'nginx/rewrite/rewrite-ingress.yaml': `# URL Rewriting Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: rewrite-ingress
  namespace: apps
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/rewrite-target: /\\$2
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /v1/api(/|$)(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: api-service
            port:
              number: 8080

---
# App Root Redirect
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-root-ingress
  namespace: apps
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/app-root: /app
spec:
  rules:
  - host: example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-service
            port:
              number: 3000
`,

    'nginx/auth/basic-auth-ingress.yaml': `# Basic Authentication Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: basic-auth-ingress
  namespace: apps
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/auth-type: basic
    nginx.ingress.kubernetes.io/auth-secret: basic-auth-secret
    nginx.ingress.kubernetes.io/auth-realm: "Authentication Required"
spec:
  rules:
  - host: protected.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: protected-service
            port:
              number: 8080

---
# Secret for Basic Auth
apiVersion: v1
kind: Secret
metadata:
  name: basic-auth-secret
  namespace: apps
type: Opaque
data:
  # echo -n "admin:password" | base64
  auth: YWRtaW46JGFwcjEkNWJMcE44c2kkTHNwYlJ5QzBWTXRBTXFDSWtvMTMuLwow
`,

    'nginx/cors/cors-ingress.yaml': `# CORS Enabled Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: cors-ingress
  namespace: apps
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-origin: "https://example.com,https://app.example.com"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-headers: "Authorization, Content-Type, X-Requested-With"
    nginx.ingress.kubernetes.io/cors-allow-credentials: "true"
    nginx.ingress.kubernetes.io/cors-max-age: "3600"
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 8080
`,

    'nginx/custom-headers/custom-headers-ingress.yaml': `# Custom Headers Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: custom-headers-ingress
  namespace: apps
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/configuration-snippet: |
      more_set_headers "X-Frame-Options: DENY";
      more_set_headers "X-Content-Type-Options: nosniff";
      more_set_headers "X-XSS-Protection: 1; mode=block";
      more_set_headers "Referrer-Policy: strict-origin-when-cross-origin";
      more_set_headers "Permissions-Policy: geolocation=(), microphone=(), camera=()";
spec:
  rules:
  - host: secure.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: secure-service
            port:
              number: 8080
`,

    'nginx/monitoring/prometheus-service-monitor.yaml': `# Prometheus Service Monitor for Nginx Ingress
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: nginx-ingress-controller
  namespace: ingress-nginx
  labels:
    app: nginx-ingress-controller
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: ingress-nginx
  endpoints:
  - port: metrics
    interval: 30s
    scheme: http
    path: /metrics

---
# Prometheus Rules for Alerting
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: nginx-ingress-alerts
  namespace: ingress-nginx
spec:
  groups:
  - name: nginx-ingress
    interval: 30s
    rules:
    - alert: NginxIngressHighErrorRate
      expr: |
        sum(rate(nginx_ingress_controller_requests{status!~"4.."}[5m])) /
        sum(rate(nginx_ingress_controller_requests[5m])) > 0.05
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Nginx Ingress high error rate"
        description: "Nginx Ingress error rate is > 5% for 5 minutes"
`,

    'docker-compose.yaml': `version: '3.8'

services:
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx
    networks:
      - nginx-net
    restart: unless-stopped

  # Backend services
  api-v1:
    image: nginx:alpine
    ports:
      - "8081:80"
    networks:
      - nginx-net

  api-v2:
    image: nginx:alpine
    ports:
      - "8082:80"
    networks:
      - nginx-net

  prometheus:
    image: prom/prometheus:v2.48.0
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
    networks:
      - nginx-net

  grafana:
    image: grafana/grafana:10.2.0
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    networks:
      - nginx-net

networks:
  nginx-net:
    driver: bridge
`,

    'nginx/nginx.conf': `# Main Nginx Configuration
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '\\$remote_addr - \\$remote_user [\\$time_local] "\\$request" '
                    '\\$status \\$body_bytes_sent "\\$http_referer" '
                    '"\\$http_user_agent" "\\$http_x_forwarded_for" '
                    'rt=\\$request_time uct="\\$upstream_connect_time" '
                    'uht="\\$upstream_header_time" urt="\\$upstream_response_time"';

    log_format json_combined '{'
        '"time_local":"\\$time_local",'
        '"remote_addr":"\\$remote_addr",'
        '"remote_user":"\\$remote_user",'
        '"request":"\\$request",'
        '"status": "\\$status",'
        '"body_bytes_sent":"\\$body_bytes_sent",'
        '"request_time":"\\$request_time",'
        '"http_referrer":"\\$http_referer",'
        '"http_user_agent":"\\$http_user_agent"'
    '}';

    access_log /var/log/nginx/access.log json_combined;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 75s;
    keepalive_requests 100;
    types_hash_max_size 2048;
    server_tokens off;

    # Buffer settings
    client_body_buffer_size 128k;
    client_max_body_size 100m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 16k;

    # Rate limiting zones
    limit_req_zone \\$binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone \\$binary_remote_addr zone=general_limit:10m rate=5r/s;
    limit_conn_zone \\$binary_remote_addr zone=conn_limit:10m;

    # Upstream settings
    upstream api_v1 {
        least_conn;
        server api-v1:80;
        keepalive 32;
        keepalive_timeout 60s;
    }

    upstream api_v2 {
        least_conn;
        server api-v2:80;
        keepalive 32;
        keepalive_timeout 60s;
    }

    # Include additional configurations
    include /etc/nginx/conf.d/*.conf;
}
`,

    'nginx/conf.d/default.conf': `upstream backend {
    least_conn;
    server api-v1:80 max_fails=3 fail_timeout=30s;
    server api-v2:80 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80;
    server_name localhost;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    location / {
        limit_req zone=general_limit burst=10 nodelay;
        limit_conn conn_limit 10;

        proxy_pass http://backend;
        proxy_http_version 1.1;

        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_set_header Connection "";

        proxy_connect_timeout 15s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
    }

    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }

    location /nginx_status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        deny all;
    }
}
`,

    'prometheus.yml': `global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:80']
    metrics_path: /nginx_status
    params:
      format: ['prometheus']
`,

    'README.md': `# Nginx Ingress Controller Configuration

Complete Nginx ingress controller configuration with SSL/TLS termination, rate limiting, canary deployments, and advanced routing.

## Features

### Traffic Management
- **Load Balancing**: Round-robin, least connections, IP hash
- **Rate Limiting**: Per-IP and per-endpoint rate limiting
- **Canary Deployments**: Weight-based, header-based, cookie-based
- **URL Rewriting**: Path-based routing and rewrites

### Security
- **SSL/TLS Termination**: Full TLS support with redirect
- **HSTS**: HTTP Strict Transport Security
- **Security Headers**: X-Frame-Options, CSP, etc.
- **Basic Auth**: Built-in authentication support
- **CORS**: Configurable cross-origin policies

### Observability
- **Prometheus Metrics**: Built-in metrics endpoint
- **Access Logging**: JSON and text format logging
- **Health Checks**: Passive and active health checks
- **Grafana Dashboards**: Pre-built visualizations

## Quick Start

### Kubernetes

\`\`\`bash
# Install Nginx Ingress Controller
kubectl apply -f nginx/base/

# Verify installation
kubectl get pods -n ingress-nginx

# Create a simple ingress
kubectl apply -f nginx/rate-limit/rate-limit-ingress.yaml

# Test
curl -H "Host: api.example.com" http://\\$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
\`\`\`

### Docker Compose

\`\`\`bash
# Start with Docker Compose
docker-compose up -d

# Test
curl http://localhost/api/test

# View logs
docker-compose logs -f nginx

# View metrics
curl http://localhost/nginx_status
\`\`\`

## Rate Limiting

### Per-IP Rate Limit

\`\`\`bash
# 10 requests per second per IP
kubectl apply -f nginx/rate-limit/rate-limit-ingress.yaml

# Test rate limit
for i in {1..20}; do curl http://api.example.com/; done
\`\`\`

### Connection Limit

\`\`\`yaml
annotations:
  nginx.ingress.kubernetes.io/limit-connections: "10"
\`\`\`

## SSL/TLS Termination

\`\`\`bash
# Create TLS secret
kubectl create secret tls tls-secret \\
  --cert=path/to/cert.crt \\
  --key=path/to/cert.key

# Apply SSL ingress
kubectl apply -f nginx/ssl-termination/ssl-ingress.yaml

# Test with HTTPS
curl -k https://secure.example.com
\`\`\`

## Canary Deployments

### Weight-Based (10% to v2)

\`\`\`bash
kubectl apply -f nginx/canary/canary-ingress.yaml
\`\`\`

### Header-Based

\`\`\`bash
# Route requests with X-Canary: true header to v2
curl -H "X-Canary: true" http://app.example.com
\`\`\`

## Monitoring

### Prometheus Metrics

\`\`\`bash
# Scrape metrics
curl http://nginx:80/nginx_status

# Available metrics
- nginx_ingress_controller_requests
- nginx_ingress_controller_response_duration_seconds
- nginx_ingress_controller_success
\`\`\`

### Grafana Dashboard

\`\`\`bash
# Access Grafana
open http://localhost:3000
# Username: admin
# Password: admin
\`\`\`

## Examples

### Basic Ingress

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: basic-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-service
            port:
              number: 8080
\`\`\`

### With Rate Limiting

\`\`\`yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/limit-rps: "10"
    nginx.ingress.kubernetes.io/limit-burst-multiplier: "2"
\`\`\`

### With SSL

\`\`\`yaml
spec:
  tls:
  - hosts:
    - secure.example.com
    secretName: tls-secret
\`\`\`

## Makefile Commands

\`\`\`bash
make start      # Start services
make stop       # Stop services
make logs       # View logs
make test       # Test ingress
make validate   # Validate config
\`\`\`

## License

MIT
`,

    'Makefile': `.PHONY: help start stop restart logs test validate

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \\033[36m%-15s\\033[0m %s\\n", $$1, $$2}' $(MAKEFILE_LIST)

start: ## Start Nginx and backends
	docker-compose up -d

stop: ## Stop all services
	docker-compose down

restart: ## Restart Nginx
	docker-compose restart nginx

logs: ## View Nginx logs
	docker-compose logs -f nginx

test: ## Test Nginx ingress
	@echo "Testing basic routing..."
	curl -s http://localhost/api/test | jq
	@echo ""
	@echo "Testing rate limiting (should see 429 after ~15 requests)..."
	for i in $$(seq 1 20); do \\
		curl -s -o /dev/null -w "%{http_code}\\n" http://localhost/api/; \\
	done

validate: ## Validate Nginx configuration
	docker exec nginx nginx -t

reload: ## Reload Nginx configuration
	docker exec nginx nginx -s reload

metrics: ## View Nginx metrics
	curl -s http://localhost/nginx_status

clean: ## Remove all containers and volumes
	docker-compose down -v
	docker system prune -f
`
  },

  postInstall: [
    `echo "Setting up Nginx ingress controller..."
echo ""
echo "Kubernetes Deployment:"
echo "1. Install Nginx Ingress Controller:"
echo "   kubectl apply -f nginx/base/"
echo ""
echo "2. Verify installation:"
echo "   kubectl get pods -n ingress-nginx"
echo ""
echo "3. Create TLS secret:"
echo "   kubectl create secret tls tls-secret --cert=path/to/cert.crt --key=path/to/cert.key"
echo ""
echo "Docker Compose Deployment:"
echo "1. Start services:"
echo "   docker-compose up -d"
echo ""
echo "2. Test routing:"
echo "   curl http://localhost/api/test"
echo ""
echo "3. View metrics:"
echo "   curl http://localhost/nginx_status"
`
  ]
};
