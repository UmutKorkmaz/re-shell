import { BackendTemplate } from '../types';

/**
 * Envoy Proxy Template
 * Complete Envoy proxy configuration for advanced load balancing and observability
 */
export const envoyProxyTemplate: BackendTemplate = {
  id: 'envoy-proxy',
  name: 'Envoy Proxy',
  displayName: 'Envoy Proxy Configuration',
  description: 'Complete Envoy proxy configuration for advanced load balancing, observability, retries, circuit breaking, and distributed tracing',
  version: '1.28.0',
  language: 'typescript',
  framework: 'envoy',
  tags: ['kubernetes', 'envoy', 'proxy', 'load-balancing', 'observability', 'cicd'],
  port: 9901,
  dependencies: {},
  features: ['microservices', 'docker', 'rest-api', 'monitoring', 'security', 'documentation'],

  files: {
    'envoy/base/envoy.yaml': `# Envoy Proxy Configuration
# Basic configuration with listeners, clusters, and admin

admin:
  access_log_path: /tmp/admin_access.log
  address:
    socket_address:
      address: 0.0.0.0
      port_value: 9901

static_resources:
  listeners:
  - name: listener_0
    address:
      socket_address:
        address: 0.0.0.0
        port_value: 10000
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
          stat_prefix: ingress_http
          codec_type: AUTO
          route_config:
            name: local_route
            virtual_hosts:
            - name: local_service
              domains: ["*"]
              routes:
              - match:
                  prefix: "/"
                route:
                  cluster: service_a
                  timeout: 5s
                  retry_policy:
                    retry_on: 5xx,connect-failure,refused-stream
                    num_retries: 3
                    per_try_timeout: 3s
          http_filters:
          - name: envoy.filters.http.router
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router

  clusters:
  - name: service_a
    connect_timeout: 5s
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    http2_protocol_options: {}
    load_assignment:
      cluster_name: service_a
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: service-a
                port_value: 8080
    health_checks:
    - timeout: 1s
      interval: 5s
      unhealthy_threshold: 2
      healthy_threshold: 2
      http_health_check:
        path: /health
        expected_statuses:
          start: 200
          end: 299
    outlier_detection:
      consecutive_5xx: 5
      interval: 30s
      base_ejection_time: 30s
      max_ejection_percent: 50
      success_minimum: 5
`,

    'envoy/load-balancing/round-robin.yaml': `# Round Robin Load Balancing
static_resources:
  clusters:
  - name: round_robin_cluster
    connect_timeout: 5s
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: round_robin_cluster
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: backend-1
                port_value: 8080
        - endpoint:
            address:
              socket_address:
                address: backend-2
                port_value: 8080
        - endpoint:
            address:
              socket_address:
                address: backend-3
                port_value: 8080
`,

    'envoy/load-balancing/least-request.yaml': `# Least Request Load Balancing
static_resources:
  clusters:
  - name: least_request_cluster
    connect_timeout: 5s
    type: STRICT_DNS
    lb_policy: LEAST_REQUEST
    load_assignment:
      cluster_name: least_request_cluster
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: backend-1
                port_value: 8080
        - endpoint:
            address:
              socket_symbolic_address:
                address: backend-2
                port_value: 8080
`,

    'envoy/load-balancing/random.yaml': `# Random Load Balancing
static_resources:
  clusters:
  - name: random_cluster
    connect_timeout: 5s
    type: STRICT_DNS
    lb_policy: RANDOM
    load_assignment:
      cluster_name: random_cluster
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: backend-1
                port_value: 8080
        - endpoint:
            address:
              socket_socket:
                address: backend-2
                port_value: 8080
`,

    'envoy/load-balancing/ring-hash.yaml': `# Ring Hash Load Balancing (Consistent Hashing)
static_resources:
  clusters:
  - name: ring_hash_cluster
    connect_timeout: 5s
    type: STRICT_DNS
    lb_policy: RING_HASH
    ring_hash_config:
      hash_function: XX_HASH
      min_ring_size: 1024
      max_ring_size: 8192
    load_assignment:
      cluster_name: ring_hash_cluster
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: backend-1
                port_value: 8080
        - endpoint:
            address:
              socket_address:
                address: backend-2
                port_value: 8080
        - endpoint:
            address:
              socket_address:
                address: backend-3
                port_value: 8080
`,

    'envoy/load-balancing/maglev.yaml': `# Maglev Load Balancing
static_resources:
  clusters:
  - name: maglev_cluster
    connect_timeout: 5s
    type: STRICT_DNS
    lb_policy: MAGLEV
    common_lb_config:
      healthy_panic_threshold:
        value: 50.0
    load_assignment:
      cluster_name: maglev_cluster
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: backend-1
                port_value: 8080
        - endpoint:
            address:
              socket_address:
                address: backend-2
                port_value: 8080
`,

    'envoy/load-balancing/priority.yaml': `# Priority Load Balancing (P2C + Locality)
static_resources:
  clusters:
  - name: priority_cluster
    connect_timeout: 5s
    type: STRICT_DNS
    lb_policy: LEAST_REQUEST
    lb_subset_config:
      fallback_policy: ANY_ENDPOINT
      default_subset: region_us_east
      subset_selectors:
      - keys:
        - region
        - zone
    load_assignment:
      cluster_name: priority_cluster
      endpoints:
      - locality:
          region: us-east
          zone: us-east-1a
        lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: backend-us-east-1
                port_value: 8080
        priority: 0
      - locality:
          region: us-east
          zone: us-east-1b
        lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: backend-us-east-2
                port_value: 8080
        priority: 0
      - locality:
          region: us-west
          zone: us-west-1a
        lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: backend-us-west-1
                port_value: 8080
        priority: 1
`,

    'envoy/retries/circuit-breaker.yaml': `# Circuit Breaker Configuration
static_resources:
  clusters:
  - name: circuit_breaker_cluster
    connect_timeout: 5s
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    circuit_breakers:
      thresholds:
      - priority: DEFAULT
        max_connections: 100
        max_pending_requests: 50
        max_requests: 1000
        max_retries: 3
      - priority: HIGH
        max_connections: 200
        max_pending_requests: 100
        max_requests: 2000
        max_retries: 5
    outlier_detection:
      consecutive_5xx: 5
      interval: 30s
      base_ejection_time: 30s
      max_ejection_percent: 50
      enforcing_consecutive_5xx: 100
      enforcing_success_rate: 100
      success_rate_minimum_hosts: 3
      success_rate_request_volume: 100
      success_rate_stdev_factor: 1900
    load_assignment:
      cluster_name: circuit_breaker_cluster
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: backend-1
                port_value: 8080
        - endpoint:
            address:
              socket_address:
                address: backend-2
                port_value: 8080
`,

    'envoy/retries/retry-policy.yaml': `# Retry Policy Configuration
static_resources:
  listeners:
  - name: retry_listener
    address:
      socket_address:
        address: 0.0.0.0
        port_value: 10000
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
          stat_prefix: ingress_http
          codec_type: AUTO
          route_config:
            name: retry_route
            virtual_hosts:
            - name: retry_service
              domains: ["*"]
              routes:
              - match:
                  prefix: "/api/v1"
                route:
                  cluster: backend_cluster
                  retry_policy:
                    retry_on: 5xx,connect-failure,refused-stream,reset, retriable-status-codes
                    num_retries: 5
                    per_try_timeout: 3s
                    retriable_status_codes:
                    - 503
                    - 504
                    - 502
                  timeout: 15s
              - match:
                  prefix: "/api/v2"
                route:
                  cluster: backend_cluster
                  retry_policy:
                    retry_on: connect-failure,refused-stream
                    num_retries: 2
                    per_try_timeout: 2s
                  timeout: 5s
          http_filters:
          - name: envoy.filters.http.router
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
`,

    'envoy/retries/rate-limit.yaml': `# Rate Limiting Configuration
static_resources:
  clusters:
  - name: rate_limit_service
    connect_timeout: 0.25s
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: rate_limit_service
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: ratelimit
                port_value: 8080
  listeners:
  - name: rate_limit_listener
    address:
      socket_address:
        address: 0.0.0.0
        port_value: 10000
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
          stat_prefix: ingress_http
          codec_type: AUTO
          route_config:
            name: rate_limit_route
            virtual_hosts:
            - name: rate_limit_service
              domains: ["*"]
              routes:
              - match:
                  prefix: "/"
                route:
                  cluster: backend_cluster
          http_filters:
          - name: envoy.filters.http.local_ratelimit
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.local_ratelimit.v3.LocalRateLimit
              stat_prefix: http_local_rate_limit
              token_bucket:
                max_tokens: 1000
                tokens_per_fill: 100
                fill_interval: 1s
              filter_enabled:
                runtime_key: local_rate_limit_enabled
                default_value:
                  numerator: 100
                  denominator: HUNDRED
              filter_enforced:
                runtime_key: local_rate_limit_enforced
                default_value:
                  numerator: 100
                  denominator: HUNDRED
              response_headers_to_add:
              - header:
                  key: x-local-rate-limit
                  value: "true"
          - name: envoy.filters.http.router
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
`,

    'envoy/security/tls.yaml': `# TLS/Termination Configuration
static_resources:
  listeners:
  - name: tls_listener
    address:
      socket_address:
        address: 0.0.0.0
        port_value: 8443
    filter_chains:
    - filter_chain_match:
        server_names: ["example.com"]
      transport_socket:
        name: envoy.transport_sockets.tls
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.DownstreamTlsContext
          common_tls_context:
            tls_certificates:
            - certificate_chain:
                filename: /etc/certs/cert.pem
              private_key:
                filename: /etc/certs/key.pem
            alpn_protocols: ["h2", "http/1.1"]
      filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
          stat_prefix: ingress_https
          codec_type: AUTO
          route_config:
            name: tls_route
            virtual_hosts:
            - name: tls_service
              domains: ["example.com"]
              routes:
              - match:
                  prefix: "/"
                route:
                  cluster: backend_cluster
          http_filters:
          - name: envoy.filters.http.router
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router

  clusters:
  - name: backend_cluster
    connect_timeout: 5s
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    transport_socket:
      name: envoy.transport_sockets.tls
      typed_config:
        "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.UpstreamTlsContext
        sni: backend.example.com
        common_tls_context:
          validation_context:
            match_typed_subject_alt_names:
            - san_type: DNS
              matcher:
                exact: backend.example.com
    load_assignment:
      cluster_name: backend_cluster
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_socket:
                address: backend
                port_value: 8443
`,

    'envoy/security/mtls.yaml': `# Mutual TLS Configuration
static_resources:
  listeners:
  - name: mtls_listener
    address:
      socket_address:
        address: 0.0.0.0
        port_value: 8443
    filter_chains:
    - transport_socket:
        name: envoy.transport_sockets.tls
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.DownstreamTlsContext
          require_client_certificate: true
          common_tls_context:
            tls_certificates:
            - certificate_chain:
                filename: /etc/certs/server-cert.pem
              private_key:
                filename: /etc/certs/server-key.pem
            validation_context:
              trusted_ca:
                filename: /etc/certs/ca-cert.pem
              verify_certificate_spki:
                - "abc125"
                - "def456"
              verify_certificate_hash:
                - "XYZ123"
      filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
          stat_prefix: mtls_ingress
          route_config:
            name: mtls_route
            virtual_hosts:
            - name: mtls_service
              domains: ["*"]
              routes:
              - match:
                  prefix: "/"
                route:
                  cluster: backend_cluster
          http_filters:
          - name: envoy.filters.http.router
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
`,

    'envoy/observability/tracing.yaml': `# Distributed Tracing Configuration
tracing:
  http:
    name: envoy.tracers.zipkin
    typed_config:
      "@type": type.googleapis.com/envoy.config.trace.v3.ZipkinConfig
      collector_cluster: zipkin
      collector_endpoint: /api/v2/spans
      shared_context_id: 1
      trace_id_128bit: true

static_resources:
  clusters:
  - name: zipkin
    connect_timeout: 1s
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: zipkin
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: zipkin
                port_value: 9411

  listeners:
  - name: tracing_listener
    address:
      socket_address:
        address: 0.0.0.0
        port_value: 10000
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
          stat_prefix: ingress_tracing
          codec_type: AUTO
          route_config:
            name: tracing_route
            virtual_hosts:
            - name: tracing_service
              domains: ["*"]
              routes:
              - match:
                  prefix: "/"
                route:
                  cluster: backend_cluster
          http_filters:
          - name: envoy.filters.http.router
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
              suppress_envoy_headers: false
`,

    'envoy/observability/metrics.yaml': `# Prometheus Metrics Configuration
stats_config:
  stats_tags:
  - tag_name: cluster_name
    fixed_value: backend_cluster
  use_all_default_tags:
    {}
  stats_sink:
  - name: envoy.stat_sinks.statsd
    typed_config:
      "@type": type.googleapis.com/envoy.config.metrics.v3.StatsdConfig
      address:
        socket_address:
          address: 127.0.0.1
          port_value: 8125
      prefix: envoy

static_resources:
  clusters:
  - name: prometheus_stats
    connect_timeout: 1s
    type: STRICT_DNS
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: prometheus_stats
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address:
                address: prometheus
                port_value: 9090
`,

    'envoy/observability/access-logging.yaml': `# Access Logging Configuration
static_resources:
  listeners:
  - name: logging_listener
    address:
      socket_address:
        address: 0.0.0.0
        port_value: 10000
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
          stat_prefix: ingress_logging
          codec_type: AUTO
          access_log:
          - name: envoy.file_access_log
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.access_loggers.file.v3.FileAccessLog
              path: /dev/stdout
              format: |
                [%START_TIME%] "%REQ(:METHOD)% %REQ(X-ENVOY-ORIGINAL-PATH?:PATH)% %PROTOCOL%" %RESPONSE_CODE% %RESPONSE_FLAGS% %BYTES_RECEIVED% %BYTES_SENT% %DURATION% %RESP(X-ENVOY-UPSTREAM-SERVICE-TIME)% "%REQ(X-FORWARDED-FOR)%" "%REQ(USER-AGENT)%" "%REQ(X-REQUEST-ID)%" "%REQ(:AUTHORITY)%" "%UPSTREAM_HOST%"
          - name: envoy.file_access_log
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.access_loggers.file.v3.FileAccessLog
              path: /tmp/access.log
              json_format:
                start_time: "%START_TIME%"
                method: "%REQ(:METHOD)%"
                path: "%REQ(X-ENVOY-ORIGINAL-PATH?:PATH)%"
                protocol: "%PROTOCOL%"
                status_code: "%RESPONSE_CODE%"
                response_flags: "%RESPONSE_FLAGS%"
                bytes_received: "%BYTES_RECEIVED%"
                bytes_sent: "%BYTES_SENT%"
                duration: "%DURATION%"
                upstream_service_time: "%RESP(X-ENVOY-UPSTREAM-SERVICE-TIME)%"
                x_forwarded_for: "%REQ(X-FORWARDED-FOR)%"
                user_agent: "%REQ(USER-AGENT)%"
                request_id: "%REQ(X-REQUEST-ID)%"
                authority: "%REQ(:AUTHORITY)%"
                upstream_host: "%UPSTREAM_HOST%"
          route_config:
            name: logging_route
            virtual_hosts:
            - name: logging_service
              domains: ["*"]
              routes:
              - match:
                  prefix: "/"
                route:
                  cluster: backend_cluster
          http_filters:
          - name: envoy.filters.http.router
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
`,

    'docker-compose.yaml': `version: '3.8'

services:
  envoy:
    image: envoyproxy/envoy:v1.28.0
    ports:
      - "10000:10000"
      - "9901:9901"
    volumes:
      - ./envoy/base/envoy.yaml:/etc/envoy/envoy.yaml:ro
      - ./envoy/tls:/etc/certs:ro
    networks:
      - envoy-net
    depends_on:
      - backend-1
      - backend-2
      - backend-3
    restart: unless-stopped

  backend-1:
    image: nginx:alpine
    ports:
      - "8081:80"
    networks:
      - envoy-net

  backend-2:
    image: nginx:alpine
    ports:
      - "8082:80"
    networks:
      - envoy-net

  backend-3:
    image: nginx:alpine
    ports:
      - "8083:80"
    networks:
      - envoy-net

  prometheus:
    image: prom/prometheus:v2.48.0
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
    networks:
      - envoy-net

  zipkin:
    image: openzipkin/zipkin:2.24
    ports:
      - "9411:9411"
    networks:
      - envoy-net

networks:
  envoy-net:
    driver: bridge
`,

    'prometheus.yml': `global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'envoy'
    static_configs:
      - targets: ['envoy:9901']
    metrics_path: /stats/prometheus
`,

    'README.md': `# Envoy Proxy Configuration

Complete Envoy proxy configuration for advanced load balancing, observability, retries, circuit breaking, and distributed tracing.

## Features

### Load Balancing
- **Round Robin**: Distributes requests evenly across backends
- **Least Request**: Routes to backend with fewest active requests
- **Random**: Random backend selection
- **Ring Hash**: Consistent hashing for session affinity
- **Maglev**: Consistent hashing with faster lookups
- **Priority (P2C)**: Locality-aware load balancing

### Resilience
- **Circuit Breaker**: Prevents cascading failures
- **Retries**: Automatic retry with configurable backoff
- **Timeouts**: Per-route timeout configuration
- **Health Checks**: Active and passive health checking

### Observability
- **Metrics**: Prometheus-compatible metrics endpoint
- **Distributed Tracing**: Zipkin/Jaeger integration
- **Access Logging**: JSON and text format logging
- **Stats**: Comprehensive proxy statistics

### Security
- **TLS**: Server-side TLS termination
- **mTLS**: Mutual TLS authentication
- **Rate Limiting**: Local and distributed rate limiting

## Quick Start

\`\`\`bash
# Start Envoy with Docker Compose
docker-compose up -d

# View Envoy dashboard
open http://localhost:9901

# Send test requests
curl http://localhost:10000/api/test

# View metrics
open http://localhost:9090

# View traces
open http://localhost:9411
\`\`\`

## Configuration Examples

### Load Balancing

\`\`\`bash
# Use different load balancing strategies
cp envoy/load-balancing/round-robin.yaml envoy/base/envoy.yaml
docker-compose restart envoy
\`\`\`

### Circuit Breaking

\`\`\`bash
# Apply circuit breaker configuration
cp envoy/retries/circuit-breaker.yaml envoy/base/envoy.yaml
docker-compose restart envoy

# Test circuit breaking
for i in {1..200}; do curl http://localhost:10000/api/test; done
\`\`\`

### TLS Termination

\`\`\`bash
# Enable TLS
cp envoy/security/tls.yaml envoy/base/envoy.yaml
docker-compose restart envoy

# Test with HTTPS
curl -k https://localhost:8443/api/test
\`\`\`

## Metrics

Key metrics available at \`http://localhost:9901/stats/prometheus\`:

- \`envoy_cluster_upstream_rq\`: Total requests
- \`envoy_cluster_upstream_rq_2xx\`: Successful requests
- \`envoy_cluster_upstream_rq_5xx\`: Server errors
- \`envoy_cluster_upstream_rq_time\`: Request latency
- \`envoy_cluster_membership_healthy\`: Healthy endpoints
- \`envoy_cluster_outlier_detection_ejections\`: Ejected endpoints

## Stats Commands

\`\`\`bash
# View all stats
curl http://localhost:9901/stats

# View prometheus metrics
curl http://localhost:9901/stats/prometheus

# View clusters
curl http://localhost:9901/clusters

# View listeners
curl http://localhost:9901/listeners
\`\`\`

## License

MIT
`,

    'Makefile': `.PHONY: help start stop restart logs stats test

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \\033[36m%-15s\\033[0m %s\\n", $$1, $$2}' $(MAKEFILE_LIST)

start: ## Start Envoy and backends
	docker-compose up -d

stop: ## Stop all services
	docker-compose down

restart: ## Restart Envoy
	docker-compose restart envoy

logs: ## View Envoy logs
	docker-compose logs -f envoy

stats: ## View Envoy stats
	curl -s http://localhost:9901/stats | jq

clusters: ## View cluster status
	curl -s http://localhost:9901/clusters | jq

listeners: ## View listener status
	curl -s http://localhost:9901/listeners | jq

test: ## Test Envoy proxy
	@echo "Testing round-robin load balancing..."
	@for i in 1 2 3 4 5 6; do \\
		curl -s http://localhost:10000/api/test | jq -r '.backend'; \\
	done

test-circuit-breaker: ## Test circuit breaker
	@echo "Testing circuit breaker with 200 requests..."
	@for i in $$(seq 1 200); do \\
		curl -s http://localhost:10000/api/test > /dev/null || true; \\
	done
	@echo "Check stats: make stats | grep cb"

test-retry: ## Test retry policy
	@echo "Testing retry policy..."
	curl -v http://localhost:10000/api/test

validate: ## Validate Envoy configuration
	docker run --rm -v \\$$(pwd)/envoy:/etc/envoy envoyproxy/envoy:v1.28.0 envoy config validate /etc/envoy/base/envoy.yaml

clean: ## Remove all containers and volumes
	docker-compose down -v
	docker system prune -f
`
  },

  postInstall: [
    `echo "Setting up Envoy proxy configuration..."
echo ""
echo "1. Start Envoy with Docker Compose:"
echo "   docker-compose up -d"
echo ""
echo "2. View Envoy admin dashboard:"
echo "   open http://localhost:9901"
echo ""
echo "3. Send test requests:"
echo "   curl http://localhost:10000/api/test"
echo ""
echo "4. View metrics:"
echo "   curl http://localhost:9901/stats/prometheus"
echo ""
echo "5. View distributed traces:"
echo "   open http://localhost:9411"
echo ""
echo "6. View Prometheus metrics:"
echo "   open http://localhost:9090"
`
  ]
};
