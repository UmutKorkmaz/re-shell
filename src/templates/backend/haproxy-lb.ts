import { BackendTemplate } from '../types';

/**
 * HAProxy Load Balancer Template
 * Complete HAProxy configuration for high-availability load balancing with health checks
 */
export const haproxyTemplate: BackendTemplate = {
  id: 'haproxy-lb',
  name: 'HAProxy Load Balancer',
  displayName: 'HAProxy Load Balancer',
  description: 'Complete HAProxy configuration for high-availability load balancing with health checks, SSL termination, and observability',
  version: '2.8.0',
  language: 'typescript',
  framework: 'haproxy',
  tags: ['kubernetes', 'haproxy', 'load-balancing', 'ssl', 'high-availability', 'cicd'],
  port: 8080,
  dependencies: {},
  features: ['microservices', 'docker', 'rest-api', 'security', 'monitoring', 'documentation'],

  files: {
    'haproxy/haproxy.cfg': `# HAProxy Configuration File
# High-Availability Load Balancer with Health Checks

global
    # Maximum number of concurrent connections
    maxconn 4096

    # Running mode
    daemon

    # Stats socket for management
    stats socket /var/run/haproxy.sock mode 600 level admin

    # SSL configuration
    tune.ssl.default-dh-param 2048

    # Performance tuning
    nbthread 4
    cpu-map auto:1/1-4 0-3

    # Logging
    log /dev/log local0 info
    log /dev/log local1 notice

    # Runtime API
    stats socket ipv4@127.0.0.1:9999 level admin

defaults
    # Default log format
    log global
    option tcplog
    option dontlognull

    # Timeouts
    timeout connect 10s
    timeout client 30s
    timeout server 30s
    timeout tunnel 1h
    timeout http-keep-alive 10s
    timeout http-request 10s
    timeout queue 1m
    timeout tarpit 60s

    # Default mode
    mode http

    # Options
    option http-server-close
    option forwardfor except 127.0.0.0/8
    option redispatch

    # Error files
    errorfile 400 /etc/haproxy/errors/400.http
    errorfile 403 /etc/haproxy/errors/403.http
    errorfile 408 /etc/haproxy/errors/408.http
    errorfile 500 /etc/haproxy/errors/500.http
    errorfile 502 /etc/haproxy/errors/502.http
    errorfile 503 /etc/haproxy/errors/503.http
    errorfile 504 /etc/haproxy/errors/504.http

    # HTTP settings
    option http-ignore-probe
    option http-buffer-request

    # Maximum connections
    maxconn 2000

    # Default server options
    default-server inter 3s rise 2 fall 3 on-marked-down shutdown-sessions

# Statistics Dashboard
listen stats
    bind *:8404
    mode http
    stats enable
    stats uri /stats
    stats refresh 30s
    stats realm HAProxy Stats
    stats auth admin:admin
    stats show-legends
    stats show-desc "HAProxy Load Balancer Stats"

# Frontend for HTTP traffic
frontend http_front
    bind *:80
    mode http
    option httplog
    maxconn 5000

    # ACLs
    acl is_api path_beg /api
    acl is_health path /health

    # Actions
    use_backend api_back if is_api
    use_backend health_back if is_health
    default_backend web_back

# Frontend for HTTPS traffic
frontend https_front
    bind *:443 ssl crt /etc/haproxy/certs/server.pem no-sslv3
    mode http
    option httplog
    maxconn 5000

    # HSTS
    http-request set-header Strict-Transport-Security "max-age=31536000; includeSubDomains"

    # ACLs
    acl is_api path_beg /api
    acl is_websocket hdr(Upgrade) -i websocket

    # Actions
    use_backend api_back if is_api
    use_backend websocket_back if is_websocket
    default_backend web_back

# API Backend with Round Robin
backend api_back
    mode http
    balance roundrobin
    option httpchk GET /health
    http-check expect status 200

    # Health check configuration
    option httplog
    option http-keep-alive

    # Server configuration
    server api1 10.0.1.10:8080 check inter 5s rise 2 fall 3 maxconn 1000
    server api2 10.0.1.11:8080 check inter 5s rise 2 fall 3 maxconn 1000
    server api3 10.0.1.12:8080 check inter 5s rise 2 fall 3 maxconn 1000 backup

# Web Backend with Least Connections
backend web_back
    mode http
    balance leastconn
    option httpchk GET /health
    http-check expect status 200

    server web1 10.0.2.10:3000 check inter 5s rise 2 fall 3 maxconn 500
    server web2 10.0.2.11:3000 check inter 5s rise 2 fall 3 maxconn 500

# Health Check Backend
backend health_back
    mode http
    balance roundrobin

    http-check expect status 200
    server localhost 127.0.0.1:8080 check inter 2s rise 1 fall 1

    # Health check response
    http-response return status 200 content-type "text/plain" string "OK\\n"

# WebSocket Backend
backend websocket_back
    mode http
    balance roundrobin
    option http-use-htx

    # WebSocket upgrade
    http-request set-header X-Forwarded-Proto https if { ssl_fc }
    http-request set-header X-Forwarded-Port 443 if { ssl_fc }

    server ws1 10.0.3.10:8080 check inter 5s rise 2 fall 3
    server ws2 10.0.3.11:8080 check inter 5s rise 2 fall 3

# Prometheus Metrics Export
frontend prometheus_export
    bind *:8405
    mode http
    http-request use-service prometheus-exporter if { path /metrics }
`,

    'haproxy/haproxy-advanced.cfg': `# Advanced HAProxy Configuration
# With stickiness, ACLs, and advanced routing

global
    maxconn 10000
    daemon
    stats socket /var/run/haproxy.sock mode 600 level admin

defaults
    log global
    mode http
    option httplog
    option dontlognull
    timeout connect 10s
    timeout client 30s
    timeout server 30s
    retries 3
    default-server inter 3s rise 2 fall 3

# Rate Limiting
frontend rate_limited_front
    bind *:80
    mode http
    maxconn 5000

    # Rate limiting tables
    tablestick_session_counter type ip size 1m expire 10s store gpc0

    # Rate limit ACLs
    acl is_abuse sc2_get_gpc0_rate(gt, 100)

    # Actions
    http-request deny if is_abuse
    http-request track-sc0 src table stick_session_counter

    default_backend app_back

# Sticky Sessions with Cookie
backend sticky_back
    mode http
    balance roundrobin
    cookie SRV insert indirect nocache

    server app1 10.0.1.10:8080 check cookie app1
    server app2 10.0.1.11:8080 check cookie app2
    server app3 10.0.1.12:8080 check cookie app3

# Weighted Load Balancing
backend weighted_back
    mode http
    balance roundrobin

    server app1 10.0.1.10:8080 check weight 3
    server app2 10.0.1.11:8080 check weight 2
    server app3 10.0.1.12:8080 check weight 1

# IP Hash Load Balancing
backend iphash_back
    mode http
    balance source

    hash-type consistent

    server app1 10.0.1.10:8080 check
    server app2 10.0.1.11:8080 check
    server app3 10.0.1.12:8080 check

# URI Hash Load Balancing
backend urihash_back
    mode http
    balance uri

    hash-type consistent

    server app1 10.0.1.10:8080 check
    server app2 10.0.1.11:8080 check
    server app3 10.0.1.12:8080 check

# Header-based Routing
backend header_routing_back
    mode http
    balance roundrobin

    # ACLs for header-based routing
    acl is_v2 hdr(X-API-Version) -i v2
    acl is_beta hdr(X-Beta-User) -i true

    use_backend v2_back if is_v2
    use_backend beta_back if is_beta
    default-backend v1_back

# Backend with Active Health Checks
backend health_check_back
    mode http
    balance roundrobin

    option httpchk GET /health HTTP/1.1
    http-check expect status 200
    http-check expect string OK

    # Advanced health check options
    option log-health-checks
    error-limit 50

    server app1 10.0.1.10:8080 check inter 2s rise 3 fall 2 on-marked-down shutdown-sessions
    server app2 10.0.1.11:8080 check inter 2s rise 3 fall 2 on-marked-down shutdown-sessions

# TCP Backend for Database
backend db_tcp_back
    mode tcp
    balance roundrobin
    option tcp-check

    tcp-check connect
    tcp-check send PING\\r\\n
    tcp-check expect string +PONG

    server db1 10.0.4.10:5432 check inter 5s rise 2 fall 3
    server db2 10.0.4.11:5432 check inter 5s rise 2 fall 3
`,

    'haproxy/ssl/ssl-termination.cfg': `# SSL Termination Configuration
global
    ssl-default-bind-ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384
    ssl-default-bind-options ssl-min-ver TLSv1.2 no-tls-tickets

defaults
    mode http
    timeout connect 10s
    timeout client 30s
    timeout server 30s

# HTTPS Frontend with SSL Termination
frontend ssl_termination_front
    bind *:443 ssl crt /etc/haproxy/certs/combined.pem verify none alpn h2,http/1.1
    mode http

    # HSTS
    http-response set-header Strict-Transport-Security "max-age=31536000"

    # Security headers
    http-response set-header X-Frame-Options "SAMEORIGIN"
    http-response set-header X-Content-Type-Options "nosniff"
    http-response set-header X-XSS-Protection "1; mode=block"

    default_backend app_back

# Multiple Certificates
frontend multi_cert_front
    bind *:443 ssl crt /etc/haproxy/certs/ crt /etc/haproxy/certs/wildcard.pem
    mode http
    default-backend app_back

# SSL Offloading
backend ssl_offload_back
    mode http
    balance roundrobin

    # Connect to backend over HTTP
    server app1 10.0.1.10:8080 check ssl verify none
    server app2 10.0.1.11:8080 check ssl verify none

# Client Certificate Authentication
frontend client_cert_front
    bind *:443 ssl crt /etc/haproxy/certs/server.pem ca-file /etc/haproxy/certs/ca.pem verify required
    mode http

    # ACL based on client certificate
    acl client_cert_valid ssl_c_verify 0

    http-request deny if !client_cert_valid

    default-backend app_back
`,

    'haproxy/errors/503.http': `HTTP/1.1 503 Service Unavailable
Cache-Control: no-cache
Connection: close
Content-Type: text/html

<html>
<body>
<h1>Service Unavailable</h1>
<p>The server is temporarily unable to service your request due to maintenance downtime or capacity problems.</p>
</body>
</html>
`,

    'haproxy/k8s/configmap.yaml': `# HAProxy Kubernetes ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: haproxy-config
  namespace: ingress
data:
  haproxy.cfg: |
    global
        maxconn 4096
        daemon
        stats socket /var/run/haproxy.sock mode 600 level admin

    defaults
        log global
        mode http
        option httplog
        timeout connect 10s
        timeout client 30s
        timeout server 30s

    frontend stats
        bind *:8404
        mode http
        stats enable
        stats uri /stats
        stats auth admin:admin

    frontend http_front
        bind *:80
        mode http
        default-backend default_back

    backend default_back
        mode http
        balance roundrobin
        server-template srv 1-10 _default-back._http.svc.cluster.local:8080 check
`,

    'haproxy/k8s/deployment.yaml': `# HAProxy Kubernetes Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: haproxy
  namespace: ingress
  labels:
    app: haproxy
spec:
  replicas: 2
  selector:
    matchLabels:
      app: haproxy
  template:
    metadata:
      labels:
        app: haproxy
    spec:
      containers:
      - name: haproxy
        image: haproxytech/haproxy-alpine:2.8.0
        ports:
        - containerPort: 80
          name: http
        - containerPort: 443
          name: https
        - containerPort: 8404
          name: stats
        volumeMounts:
        - name: config
          mountPath: /etc/haproxy
        - name: certs
          mountPath: /etc/haproxy/certs
          readOnly: true
        livenessProbe:
          httpGet:
            path: /health
            port: 8404
          initialDelaySeconds: 5
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8404
          initialDelaySeconds: 5
          periodSeconds: 10
      volumes:
      - name: config
        configMap:
          name: haproxy-config
      - name: certs
        secret:
          secretName: haproxy-certs

---
apiVersion: v1
kind: Service
metadata:
  name: haproxy
  namespace: ingress
  labels:
    app: haproxy
spec:
  type: LoadBalancer
  externalTrafficPolicy: Local
  ports:
  - port: 80
    targetPort: http
    name: http
  - port: 443
    targetPort: https
    name: https
  - port: 8404
    targetPort: stats
    name: stats
  selector:
    app: haproxy

---
apiVersion: v1
kind: Service
metadata:
  name: haproxy-metrics
  namespace: ingress
  labels:
    app: haproxy
spec:
  type: ClusterIP
  ports:
  - port: 9101
    targetPort: 9101
    name: metrics
  selector:
    app: haproxy
`,

    'haproxy/k8s/service-monitor.yaml': `# Prometheus ServiceMonitor for HAProxy
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: haproxy
  namespace: ingress
  labels:
    app: haproxy
spec:
  selector:
    matchLabels:
      app: haproxy
  endpoints:
  - port: metrics
    interval: 30s
    scheme: http
`,

    'docker-compose.yaml': `version: '3.8'

services:
  haproxy:
    image: haproxytech/haproxy-alpine:2.8.0
    ports:
      - "80:80"
      - "443:443"
      - "8404:8404"
      - "9999:9999"
    volumes:
      - ./haproxy/haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro
      - ./haproxy/certs:/etc/haproxy/certs:ro
      - ./haproxy/errors:/etc/haproxy/errors:ro
    networks:
      - haproxy-net
    restart: unless-stopped

  # Backend services
  api1:
    image: nginx:alpine
    networks:
      - haproxy-net

  api2:
    image: nginx:alpine
    networks:
      - haproxy-net

  api3:
    image: nginx:alpine
    networks:
      - haproxy-net

  web1:
    image: nginx:alpine
    networks:
      - haproxy-net

  web2:
    image: nginx:alpine
    networks:
      - haproxy-net

  prometheus:
    image: prom/prometheus:v2.48.0
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
    networks:
      - haproxy-net

  grafana:
    image: grafana/grafana:10.2.0
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    networks:
      - haproxy-net

networks:
  haproxy-net:
    driver: bridge
`,

    'prometheus.yml': `global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'haproxy'
    static_configs:
      - targets: ['haproxy:8404']
    metrics_path: /metrics
`,

    'README.md': `# HAProxy Load Balancer Configuration

Complete HAProxy configuration for high-availability load balancing with health checks, SSL termination, and observability.

## Features

### Load Balancing Algorithms
- **Round Robin**: Distributes requests evenly
- **Least Connections**: Routes to server with fewest connections
- **Source IP Hash**: Consistent routing based on client IP
- **URI Hash**: Consistent routing based on request URI
- **Weighted**: Custom weights for each server

### Health Checks
- **Active HTTP Checks**: HTTP health check with expected status
- **TCP Checks**: Layer 4 connectivity checks
- **String Matching**: Verify response content
- **Configurable Intervals**: Custom check intervals and thresholds

### SSL/TLS
- **SSL Termination**: Offload SSL at the load balancer
- **Multiple Certificates**: SNI support for multiple domains
- **Client Certificate Auth**: mTLS authentication
- **HSTS**: HTTP Strict Transport Security

### Advanced Features
- **Sticky Sessions**: Cookie-based session persistence
- **ACLs**: Flexible routing based on headers, paths, etc.
- **Rate Limiting**: Per-IP request rate limiting
- **Connection Limits**: Max connections per server
- **Timeouts**: Configurable timeouts at each layer

### Observability
- **Stats Dashboard**: Built-in web UI at port 8404
- **Prometheus Metrics**: Native Prometheus export
- **Access Logging**: Detailed HTTP access logs
- **Health Check Logging**: Log health check status

## Quick Start

### Docker Compose

\`\`\`bash
# Start HAProxy and backends
docker-compose up -d

# View stats dashboard
open http://localhost:8404/stats

# Test load balancing
for i in {1..10}; do
  curl http://localhost/api/test
  sleep 1
done
\`\`\`

### Kubernetes

\`\`\`bash
# Deploy HAProxy
kubectl apply -f haproxy/k8s/

# Verify
kubectl get pods -n ingress

# Port forward to stats
kubectl port-forward -n ingress svc/haproxy 8404:8404
\`\`\`

## Configuration Examples

### Basic Round Robin

\`\`\`
backend api_back
    mode http
    balance roundrobin
    server api1 10.0.1.10:8080 check
    server api2 10.0.1.11:8080 check
\`\`\`

### Sticky Sessions

\`\`\`
backend sticky_back
    mode http
    balance roundrobin
    cookie SRV insert indirect nocache
    server app1 10.0.1.10:8080 check cookie app1
    server app2 10.0.1.11:8080 check cookie app2
\`\`\`

### Health Checks

\`\`\`
backend health_check_back
    mode http
    balance roundrobin
    option httpchk GET /health
    http-check expect status 200
    server app1 10.0.1.10:8080 check inter 5s rise 2 fall 3
\`\`\`

## Stats Dashboard

Access at: \`http://localhost:8404/stats\`

Default credentials:
- Username: \`admin\`
- Password: \`admin\`

## Runtime API

\`\`\`bash
# Connect to runtime API
socat /var/run/haproxy.sock stdio

# Show server status
echo "show stat" | socat /var/run/haproxy.sock stdio

# Enable server
echo "enable server api_back/api1" | socat /var/run/haproxy.sock stdio

# Disable server
echo "disable server api_back/api1" | socat /var/run/haproxy.sock stdio
\`\`\`

## License

MIT
`,

    'Makefile': `.PHONY: help start stop restart logs stats test validate clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \\033[36m%-15s\\033[0m %s\\n", $$1, $$2}' $(MAKEFILE_LIST)

start: ## Start HAProxy and backends
	docker-compose up -d

stop: ## Stop all services
	docker-compose down

restart: ## Restart HAProxy
	docker-compose restart haproxy

logs: ## View HAProxy logs
	docker-compose logs -f haproxy

stats: ## Open stats dashboard
	open http://localhost:8404/stats

test: ## Test load balancing
	@echo "Testing round-robin load balancing..."
	@for i in 1 2 3 4 5 6 7 8 9 10; do \\
		echo "Request \\$$i:"; \\
		curl -s http://localhost/api/test | jq -r '.server' 2>/dev/null || echo "N/A"; \\
	done

test-health: ## Test health checks
	@echo "Testing health endpoint..."
	curl -s http://localhost/health

validate: ## Validate HAProxy configuration
	docker exec haproxy haproxy -c -f /usr/local/etc/haproxy/haproxy.cfg

reload: ## Reload HAProxy configuration
	docker-compose restart haproxy

clean: ## Remove all containers and volumes
	docker-compose down -v
	docker system prune -f
`
  },

  postInstall: [
    `echo "Setting up HAProxy load balancer..."
echo ""
echo "Docker Compose:"
echo "1. Start services:"
echo "   docker-compose up -d"
echo ""
echo "2. View stats dashboard:"
echo "   open http://localhost:8404/stats"
echo ""
echo "3. Test load balancing:"
echo "   for i in {1..10}; do curl http://localhost/api/test; done"
echo ""
echo "Kubernetes:"
echo "1. Deploy HAProxy:"
echo "   kubectl apply -f haproxy/k8s/"
echo ""
echo "2. Verify deployment:"
echo "   kubectl get pods -n ingress"
echo ""
echo "3. Port forward to stats:"
echo "   kubectl port-forward -n ingress svc/haproxy 8404:8404"
`
  ]
};
