import { BackendTemplate } from '../types';

/**
 * Istio Service Mesh Template
 * Complete Istio configuration for polyglot microservices with traffic management
 */
export const istioServiceMeshTemplate: BackendTemplate = {
  id: 'istio-service-mesh',
  name: 'Istio Service Mesh',
  displayName: 'Istio Service Mesh',
  description: 'Complete Istio service mesh configuration for polyglot microservices with traffic management, mTLS, observability, and canary deployments',
  version: '1.19.0',
  language: 'typescript',
  framework: 'istio',
  tags: ['kubernetes', 'istio', 'service-mesh', 'microservices', 'observability', 'security'],
  port: 15001,
  dependencies: {},
  features: ['microservices', 'docker', 'rest-api', 'graphql', 'monitoring', 'security', 'documentation'],

  files: {
    'istio/base/istio-install.yaml': `apiVersion: v1
kind: Namespace
metadata:
  name: istio-system
  labels:
    istio-injection: enabled
---
apiVersion: v1
kind: Namespace
metadata:
  name: apps
  labels:
    istio-injection: enabled
---
# Istio Minimal Installation
apiVersion: v1
kind: ConfigMap
metadata:
  name: istio-custom-config
  namespace: istio-system
data:
  mesh: |-
    accessLogFile: /dev/stdout
    accessLogEncoding: TEXT
    enableAutoMtls: true
    rootNamespace: istio-system
    trustDomain: cluster.local
    extensionProviders:
      - name: envoy.metrics.v3
        envoyOtelExt:
          port: 4317
          service: opentelemetry-collector.istio-system.svc.cluster.local
---
# Istio Operator
apiVersion: operator.istio.io/v1alpha1
kind: IstioOperator
metadata:
  name: istio-control-plane
  namespace: istio-system
spec:
  profile: default
  tag: 1.19.0
  values:
    global:
      mtls:
        enabled: true
    proxy:
      autoInject: enabled
`,

    'istio/gateway/ingress-gateway.yaml': `apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: public-gateway
  namespace: istio-system
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - "*"
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: SIMPLE
      credentialName: tls-secret
    hosts:
    - "*"
---
# VirtualService for routing to services
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: ingress-routes
  namespace: istio-system
spec:
  hosts:
  - "*"
  gateways:
  - public-gateway
  http:
  - match:
    - uri:
        prefix: /api/
    route:
    - destination:
        host: api-service.apps.svc.cluster.local
        port:
          number: 8080
      weight: 100
    timeout: 10s
    retries:
      attempts: 3
      perTryTimeout: 3s
      retryOn: 5xx,connect-failure,refused-stream
  - match:
    - uri:
        prefix: /graphql
    route:
    - destination:
        host: graphql-gateway.apps.svc.cluster.local
        port:
          number: 4000
      weight: 100
  - match:
    - uri:
        prefix: /
    route:
    - destination:
        host: web-frontend.apps.svc.cluster.local
        port:
          number: 3000
      weight: 100
`,

    'istio/traffic-management/canary-deployment.yaml': `# Canary Deployment Example
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews-canary
  namespace: apps
spec:
  hosts:
  - reviews
  http:
  - match:
    - headers:
        x-canary:
          exact: "true"
    route:
    - destination:
        host: reviews
        subset: v2
      weight: 100
  - route:
    - destination:
        host: reviews
        subset: v1
    weight: 90
  - destination:
      host: reviews
      subset: v2
    weight: 10
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: reviews
  namespace: apps
spec:
  host: reviews
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
  trafficPolicy:
    loadBalancer:
      simple: LEAST_CONN
  - name: v2
    trafficPolicy:
      loadBalancer:
      simple: RANDOM
`,

    'istio/traffic-management/traffic-splitting.yaml': `# Traffic Splitting by Header
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api-service
  namespace: apps
spec:
  hosts:
  - api-service
  http:
  - match:
    - headers:
        x-user-type:
          exact: "premium"
    route:
    - destination:
        host: api-service
        subset: premium
      weight: 100
  - match:
    - headers:
        x-api-version:
          exact: "v2"
    route:
    - destination:
        host: api-service
        subset: v2
      weight: 100
  - route:
    - destination:
        host: api-service
        subset: v1
      weight: 80
    - destination:
        host: api-service
        subset: v2
      weight: 20
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: api-service
  namespace: apps
spec:
  host: api-service
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
  - name: premium
    labels:
      tier: premium
`,

    'istio/traffic-management/fault-injection.yaml': `# Fault Injection for Chaos Testing
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: fault-injection
  namespace: apps
spec:
  hosts:
  - api-service
  http:
  - match:
    - headers:
        x-chaos-test:
          exact: "true"
    fault:
      delay:
        percentage:
          value: 50
        fixedDelay: 5s
      abort:
        percentage:
          value: 10
        httpStatus: 503
    route:
    - destination:
        host: api-service
        subset: v1
  - route:
    - destination:
        host: api-service
        subset: v1
`,

    'istio/traffic-management/circuit-breaker.yaml': `# Circuit Breaker Configuration
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: httpbin
  namespace: apps
spec:
  host: httpbin
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
        http2MaxRequests: 1000
        maxRequestsPerConnection: 2
        maxRetries: 3
        idleTimeout: 15s
        h2UpgradePolicy: UPGRADE
    outlierDetection:
      consecutiveGatewayFailure: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
      minHealthPercent: 40
    loadBalancer:
      simple: ROUND_ROBIN
      localityLbSetting:
        - from: us-west
          to:
          - us-east
          weight: 100
        - from: us-east
          to:
          - us-west
          weight: 100
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
`,

    'istio/security/mtls-policy.yaml': `# Mutual TLS Configuration
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: apps
spec:
  mtls:
    mode: STRICT
---
# Per-service mTLS override
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: legacy-service
  namespace: apps
spec:
  mtls:
    mode: PERMISSIVE
---
# Authorization Policy
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: api-service-policy
  namespace: apps
spec:
  action: ALLOW
  rules:
  - from:
    - source:
        principals:
        - cluster.local/ns/istio-system/sa/istio-ingressgateway
    to:
    - operation:
        methods: ["GET", "POST"]
        paths: ["/api/*"]
  - from:
    - source:
        namespaces: ["apps"]
    to:
    - operation:
        methods: ["GET"]
`,

    'istio/security/rate-limiting.yaml': `# Rate Limiting Service
apiVersion: v1
kind: Service
metadata:
  name: ratelimit
  namespace: istio-system
spec:
  ports:
  - port: 8080
    name: http-ratelimit
    protocol: HTTP
---
apiVersion: networking.istio.io/v1beta1
kind: EnvoyFilter
metadata:
  name: ratelimit
  namespace: apps
spec:
  workloadSelector:
    labels:
      app: api-service
  configPatches:
  - applyTo: HTTP_FILTER
    match:
      context: GATEWAY
      listener:
        filterChain:
          filter:
            name: envoy.filters.http.router
    patch:
      operation: INSERT_BEFORE
      value:
        name: envoy.filters.http.local_ratelimit
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.http.local_ratelimit.v3.LocalRateLimit
          stat_prefix: http_local_rate_limit
  - applyTo: CLUSTER
    match:
      cluster:
        service: ratelimit.istio-system.svc.cluster.local
        context: SIDECAR_OUT
    patch:
      operation: MERGE
      value:
        typed_per_filter_config:
          "@type": type.googleapis.com/udpa.type.v3.TypedStruct
          rate_limit_descriptors:
          - token_bucket:
              max_tokens: 1000
              tokens_per_fill: 100
              fill_interval: "1s"
              filter_enabled:
                runtime_key: local_rate_limit
---
# Rate Limit Policy
apiVersion: config.istio.io/v1alpha2
kind: ConfigMap
metadata:
  name: ratelimit-config
  namespace: istio-system
data:
  config.yaml: |
    domain: api-service
    descriptors:
      - key: generic_key
        value: api-service
        descriptors:
          - key: remote_address
            value: "*"
            descriptors:
              - rate_limit:
                  unit: minute
                  requests_per_unit: 100
          - key: remote_address
            value: "10.0.0.0"
            descriptors:
              - rate_limit:
                  unit: minute
                  requests_per_unit: 1000
`,

    'istio/observability/metrics.yaml': `# Prometheus Configuration
apiVersion: v1
kind: Service
metadata:
  name: prometheus
  namespace: istio-system
spec:
  ports:
  - name: http-prometheus
    port: 9090
    protocol: TCP
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: prometheus
  namespace: istio-system
---
# Prometheus Pod
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: istio-system
spec:
  replicas: 1
  selector:
    app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      serviceAccountName: prometheus
      containers:
      - name: prometheus
        image: prom/prometheus:v2.48.0
        args:
        - '--storage.tsdb.path=/prometheus'
        - '--config.file=/etc/prometheus/prometheus.yml'
        ports:
        - containerPort: 9090
        volumeMounts:
        - name: data
          mountPath: /prometheus
        - name: config
          mountPath: /etc/prometheus
        - name: tls
          mountPath: /etc/prometheus/tls
      volumes:
      - name: data
        emptyDir: {}
      - name: config
        configMap:
          name: prometheus-config
      - name: tls
        secret:
          secretName: prometheus-tls
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: istio-system
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
    scrape_configs:
    - job_name: 'istio-mesh'
      kubernetes_sd_configs:
      - role: pod
        label: "__meta_kubernetes_pod_container_port"
      relabel_configs:
      - action: keep
        source_labels:
        - __meta_kubernetes_pod_annotation_prometheus_io_scrape
        - __meta_kubernetes_pod_annotation_prometheus_io_scheme
      regex: __meta_kubernetes_pod_annotation_prometheus_io_scrape;(__meta_kubernetes_pod_annotation_prometheus_io_scheme)=(https?)
      - action: keep
        source_labels:
        - __meta_kubernetes_pod_annotation_prometheus_io_scrape
      - action: drop
        source_labels:
        - __meta_kubernetes_pod_annotation_prometheus_io_scrape
      - action: labelmap
        regex: __meta_kubernetes_pod_label_(.+)
        replacement: \\1
      - source_labels: [__meta_kubernetes_pod_name]
        action: replace
        target_label: pod
      - source_labels: [__meta_kubernetes_pod_namespace]
        action: replace
        target_label: namespace
    - job_name: 'envoy-stats'
      kubernetes_sd_configs:
      - role: pod
      relabel_configs:
      - action: keep
        source_labels:
        - __meta_kubernetes_pod_annotation_prometheus_io_scrape
      - action: keep
        source_labels:
        - __meta_kubernetes_pod_container_port_name
        regex: (.*)
        replacement: \\1
        action: labelmap
        regex: __meta_kubernetes_pod_label_(.+)
        replacement: \\1
`,

    'istio/observability/tracing.yaml': `# Jaeger Distributed Tracing
apiVersion: v1
kind: Service
metadata:
  name: jaeger-collector
  namespace: istio-system
spec:
  ports:
  - port: 9411
    name: jaeger-collector-http
  - port: 14250
    name: jaeger-collector-grpc
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: jaeger
  namespace: istio-system
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jaeger
  namespace: istio-system
spec:
  replicas: 1
  selector:
    app: jaeger
  template:
    metadata:
      labels:
        app: jaeger
    spec:
      serviceAccountName: jaeger
      containers:
      - name: jaeger
        image: jaegertracing/all-in-one:1.50
        env:
        - name: COLLECTOR_ZIPKIN_HOST_PORT
          value: ":9411"
        ports:
        - containerPort: 5775
        - containerPort: 6831
        - containerPort: 6832
        - containerPort: 5778
        - containerPort: 16686
        - containerPort: 14268
        - containerPort: 14250
        - containerPort: 9411
---
# Jaeger Service
apiVersion: v1
kind: Service
metadata:
  name: jaeger
  namespace: istio-system
spec:
  type: LoadBalancer
  ports:
  - name: query
    port: 16686
    targetPort: 16686
  - name: collector
    port: 9411
    targetPort: 9411
  selector:
    app: jaeger
---
# Jaeger Query Service Gateway
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: jaeger-gateway
  namespace: istio-system
spec:
  selector:
    app: jaeger
  servers:
  - port:
      number: 16686
      name: http
      protocol: HTTP
    hosts:
    - jaeger.istio-system.local
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: jaeger-vs
  namespace: istio-system
spec:
  hosts:
  - jaeger.istio-system.local
  gateways:
  - jaeger-gateway
  http:
  - route:
    - destination:
        host: jaeger
        port:
          number: 16686
`,

    'istio/observability/kiali.yaml': `# Kiali Service Mesh Dashboard
apiVersion: v1
kind: Namespace
metadata:
  name: kiali
  labels:
    istio-injection: enabled
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kiali
  namespace: istio-system
---
apiVersion: v1
kind: Service
metadata:
  name: kiali
  namespace: istio-system
spec:
  type: LoadBalancer
  ports:
  - port: 20001
    name: http
    targetPort: 20001
  selector:
    app: kiali
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kiali
  namespace: istio-system
spec:
  replicas: 1
  selector:
    app: kiali
  template:
    metadata:
      labels:
        app: kiali
    spec:
      serviceAccountName: kiali
      containers:
      - name: kiali
        image: ghcr.io/kiali/kiali:v1.73
        env:
        - name: SERVER_MODE
          value: "true"
        - name: CATTLE_DASHBOARD_URL
          value: "http://kiali.istio-system.local:20001"
        - name: ISTIO_NAMESPACE
          value: istio-system
        ports:
        - containerPort: 20001
          name: http-kiali
        volumeMounts:
        - name: kiali-config
          mountPath: /kiali-configuration
      volumes:
      - name: kiali-config
        configMap:
          name: kiali-config
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: kiali-config
  namespace: istio-system
data:
  config.yaml: |
    server:
      port: 20001
      web_root: /opt/kiali/console
    auth:
      strategy: openid
      openid:
        issuer: https://oauth-openshift.apps.istio.example.com/auth/realms/istio
      client_id: kiali-client
    external_services:
      prometheus:
        url: http://prometheus.istio-system:9090
      grafana:
        url: http://-grafana.istio-system:3000
      jaeger:
        url: http://jaeger.istio-system:16686
    istio:
      url: http://istio-ingressgateway.istio-system:15014
    deployment:
      namespace: istio-system
      include_namespaces:
      - apps
      - default
    authentication:
      strategy: openid
`,

    'istio/samples/nodejs-deployment.yaml': `# Node.js Service with Istio Sidecar
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nodejs-api
  namespace: apps
  labels:
    app: nodejs-api
    version: v1
spec:
  replicas: 2
  selector:
    app: nodejs-api
    version: v1
  template:
    metadata:
      labels:
        app: nodejs-api
        version: v1
    spec:
      serviceAccountName: nodejs-api
      containers:
      - name: nodejs
        image: node:18-alpine
        command: ["node", "/app/index.js"]
        ports:
        - containerPort: 8080
        env:
        - name: SERVICE_NAME
          value: "nodejs-api"
        - name: SERVICE_VERSION
          value: "v1"
---
apiVersion: v1
kind: Service
metadata:
  name: nodejs-api
  namespace: apps
spec:
  ports:
  - port: 8080
    name: http
  selector:
    app: nodejs-api
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: nodejs-api
  namespace: apps
---
# VirtualService for Node.js API
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: nodejs-api
  namespace: apps
spec:
  hosts:
  - nodejs-api
  http:
  - match:
    - uri:
        prefix: /api/
    route:
    - destination:
        host: nodejs-api
        subset: v1
      weight: 100
---
# DestinationRule for subsets
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: nodejs-api
  namespace: apps
spec:
  host: nodejs-api
  subsets:
  - name: v1
    labels:
      version: v1
`,

    'istio/samples/python-deployment.yaml': `# Python/FastAPI Service with Istio Sidecar
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-api
  namespace: apps
  labels:
    app: python-api
    version: v1
spec:
  replicas: 2
  selector:
    app: python-api
  template:
    metadata:
      labels:
        app: python-api
        version: v1
    spec:
      serviceAccountName: python-api
      containers:
      - name: python
        image: python:3.11-slim
        command: ["uvicorn", "main:app", "--host", "0.0.0.0"]
        ports:
        - containerPort: 8000
---
apiVersion: v1
kind: Service
metadata:
  name: python-api
  namespace: apps
spec:
  ports:
  - port: 8000
    name: http
  selector:
    app: python-api
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: python-api
  namespace: apps
`,

    'istio/samples/go-deployment.yaml': `# Go/Gin Service with Istio Sidecar
apiVersion: apps/v1
kind: Deployment
metadata:
  name: go-api
  namespace: apps
  labels:
    app: go-api
    version: v1
spec:
  replicas: 2
  selector:
    app: go-api
  template:
    metadata:
      labels:
        app: go-api
        version: v1
    spec:
      serviceAccountName: go-api
      containers:
      - name: go
        image: golang:1.21-alpine
        command: ["/app/server"]
        ports:
        - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: go-api
  namespace: apps
spec:
  ports:
  - port: 8080
    name: http
  selector:
    app: go-api
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: go-api
  namespace: apps
`,

    'README.md': `# Istio Service Mesh Configuration

Complete Istio service mesh configuration for polyglot microservices with traffic management, mTLS, observability, and canary deployments.

## Components

### Installation
- Istio Operator for lifecycle management
- Istio Control Plane (pilot, citadel, galley, sidecar-injector)
- Ingress Gateway with HTTPS support

### Traffic Management
- VirtualServices for routing rules
- DestinationRules for subset routing
- Traffic splitting (header-based, weighted)
- Canary deployments
- Fault injection for chaos testing
- Circuit breaker patterns

### Security
- mTLS (mutual TLS) configuration
- Permissive mode for legacy services
- Authorization policies
- Rate limiting with Envoy filters

### Observability
- Prometheus metrics collection
- Jaeger distributed tracing
- Kiali service mesh dashboard
- Grafana integration

## Quick Start

\`\`\`bash
# Install Istio
kubectl apply -f istio/base/

# Verify installation
kubectl get pods -n istio-system

# Label namespace for auto-injection
kubectl label namespace apps istio-injection=enabled

# Deploy sample applications
kubectl apply -f istio/samples/

# Configure traffic management
kubectl apply -f istio/traffic-management/

# Enable observability
kubectl apply -f istio/observability/
\`\`\`

## Service Mesh Features

### mTLS
\`\`\`bash
# Enable strict mTLS
kubectl apply -f istio/security/mtls-policy.yaml

# Verify mTLS status
kubectl get peerauthentication -A apps
\`\`\`

### Traffic Splitting
\`\`\`bash
# 90% to v1, 10% to v2
kubectl apply -f istio/traffic-management/traffic-splitting.yaml

# Test canary deployment
curl -H "x-api-version: v2" http://ingress-gateway.istio-system/api/ping
\`\`\`

### Circuit Breaking
\`\`\`bash
# Configure circuit breaker
kubectl apply -f istio/traffic-management/circuit-breaker.yaml

# Check outlier detection
istio proxy-config bootstrap $(kubectl get pods -l app=httpbin -o jsonpath='{.items[0].metadata.name}')
\`\`\`

### Fault Injection
\`\`\`bash
# Enable chaos testing
kubectl apply -f istio/traffic-management/fault-injection.yaml

# Test fault injection
curl -H "x-chaos-test: true" http://ingress-gateway.istio-system/api/test
\`\`\`

## Observability

- **Kiali Dashboard**: http://kiali.istio-system.local
- **Prometheus**: http://prometheus.istio-system:9090
- **Jaeger Tracing**: http://jaeger.istio-system.local:16686
- **Grafana**: http://grafana.istio-system:3000

## Polyglot Support

The templates include:
- Node.js/Express API
- Python/FastAPI service
- Go/Gin microservice

Each service is configured with:
- Istio sidecar auto-injection
- mTLS enabled
- Health checks
- Service discovery

## License

MIT
`,

    'Makefile': `.PHONY: help install deploy clean test logs

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \\033[36m%-15s\\033[0m %s\\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install Istio
	kubectl apply -f istio/base/

deploy: ## Deploy all configurations
	kubectl apply -f istio/gateway/
	kubectl apply -f istio/traffic-management/
	kubectl apply -f istio/security/
	kubectl apply -f istio/observability/

deploy-samples: ## Deploy sample applications
	kubectl apply -f istio/samples/

clean: ## Remove Istio
	kubectl delete namespace istio-system
	kubectl delete namespace apps

logs: ## Show logs from Istio components
	kubectl logs -n istio-system -l app=prometheus --tail=100 -f

metrics: ## Port-forward to Prometheus
	kubectl port-forward -n istio-system svc/prometheus 9090:9090

kiali: ## Port-forward to Kiali
	kubectl port-forward -n istio-system svc/kiali 20001:20001

jaeger: ## Port-forward to Jaeger
	kubectl port-forward -n istio-system svc/jaeger 16686:16686

test: ## Run mesh diagnostics
	istioctl proxy-status
	istioctl analyze-metrics --all
	istioctl analyze-proxyconfig <pod>

status: ## Check Istio status
	istioctl version
	istioctl proxy-status
	istioctl dashboard
`
  },

  postInstall: [
    `echo "Setting up Istio service mesh..."
echo ""
echo "1. Install Istio:"
echo "   kubectl apply -f istio/base/"
echo ""
echo "2. Verify installation:"
echo "   kubectl get pods -n istio-system"
echo ""
echo "3. Enable auto-injection:"
echo "   kubectl label namespace apps istio-injection=enabled"
echo ""
echo "4. Deploy sample applications:"
echo "   kubectl apply -f istio/samples/"
echo ""
echo "5. Configure traffic management:"
echo "   kubectl apply -f istio/traffic-management/"
`
  ]
};
