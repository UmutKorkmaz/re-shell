import { BackendTemplate } from '../types';

/**
 * Linkerd Service Mesh Template
 * Complete Linkerd configuration for lightweight service mesh with automatic mTLS
 */
export const linkerdServiceMeshTemplate: BackendTemplate = {
  id: 'linkerd-service-mesh',
  name: 'Linkerd Service Mesh',
  displayName: 'Linkerd Service Mesh',
  description: 'Complete Linkerd service mesh configuration for lightweight service communication with automatic mTLS, observability, and zero-config mutual TLS',
  version: '2.14.0',
  language: 'typescript',
  framework: 'linkerd',
  tags: ['kubernetes', 'linkerd', 'service-mesh', 'microservices', 'observability', 'security'],
  port: 4143,
  dependencies: {},
  features: ['microservices', 'docker', 'rest-api', 'monitoring', 'security', 'documentation'],

  files: {
    'linkerd/install/linkerd-install.yaml': `# Linkerd Control Plane Installation
# Namespace
apiVersion: v1
kind: Namespace
metadata:
  name: linkerd
  annotations:
    linkerd.io/inject: enabled
---
# Linkerd Identity
apiVersion: v1
kind: Secret
metadata:
  name: linkerd-identity-issuer
  namespace: linkerd
type:Opaque
stringData:
  crt.pem: |
    # PEM-encoded issuer certificate
  key.pem: |
    # PEM-encoded issuer private key
---
# Linkerd CRDs
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: serviceprofiles.linkerd.io
spec:
  group: linkerd.io
  names:
    kind: ServiceProfile
    listKind: ServiceProfileList
    plural: serviceprofiles
    singular: serviceprofile
  scope: Namespaced
  versions:
  - name: v1alpha1
    schema:
      openAPIV3Schema:
        type: object
    served: true
    storage: true
---
# Linkerd Control Plane
apiVersion: v1
kind: ConfigMap
metadata:
  name: linkerd-config
  namespace: linkerd
data:
  config.yaml: |-
    proxy:
      image:
        version: stable-2.14.0
      resources:
        cpu:
          request: 100m
          limit: null
        memory:
          request: 20Mi
          limit: null
    destination:
      resources:
        cpu:
          request: 100m
          limit: null
        memory:
          request: 20Mi
          limit: null
    identity:
      resources:
        cpu:
          request: 100m
          limit: null
        memory:
          request: 20Mi
          limit: null
`,

    'linkerd/install/namespace-inject.yaml': `# Enable Linkerd Injection for Namespaces
apiVersion: v1
kind: Namespace
metadata:
  name: apps
  labels:
    linkerd.io/inject: enabled
    config.linkerd.io/proxy-auto-inject: "true"
  annotations:
    linkerd.io/inject: enabled
---
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    linkerd.io/inject: enabled
    config.linkerd.io/proxy-auto-inject: "true"
  annotations:
    linkerd.io/inject: enabled
`,

    'linkerd/traffic-management/split.yaml': `# Traffic Splitting with Linkerd
apiVersion: split.smi-spec.io/v1alpha1
kind: TrafficSplit
metadata:
  name: api-service-split
  namespace: apps
spec:
  service: api-service
  backends:
  - service: api-service-v1
    weight: 80
  - service: api-service-v2
    weight: 20
---
# HTTPRoute Group for TrafficSplit
apiVersion: specs.smi-spec.io/v1alpha1
kind: HTTPRouteGroup
metadata:
  name: api-routes
  namespace: apps
spec:
  matches:
  - name: api-traffic
    pathRegex: /api/.*
    methods:
    - GET
    - POST
    - PUT
    - DELETE
`,

    'linkerd/traffic-management/header-matches.yaml': `# Traffic Splitting by Headers
apiVersion: split.smi-spec.io/v1alpha1
kind: TrafficSplit
metadata:
  name: header-based-split
  namespace: apps
spec:
  service: web-frontend
  backends:
  - service: web-frontend-stable
    weight: 90
  - service: web-frontend-canary
    weight: 10
  match:
  - kind: HTTPHeader
    name: x-canary
    value: "true"
    weight: 100%
`,

    'linkerd/traffic-management/mirroring.yaml': `# Traffic Mirroring
apiVersion: split.smi-spec.io/v1alpha1
kind: TrafficSplit
metadata:
  name: mirror-traffic
  namespace: apps
spec:
  service: payment-service
  backends:
  - service: payment-service-v1
    weight: 100
  - service: payment-service-v2
    weight: 0  # Mirror only
  apiversion: split.smi-spec.io/v1alpha1
  service: payment-service
`,

    'linkerd/security/mtls-policy.yaml': `# Enable mTLS per Namespace
apiVersion: policy.linkerd.io/v1beta1
kind: NetworkAuthentication
metadata:
  name: default
  namespace: apps
spec:
  proxies:
  - identity:
      name: apps
  authenticatedMeshes:
  - apps
  - production
---
# Server-side mTLS Policy
apiVersion: policy.linkerd.io/v1beta1
kind: Server
metadata:
  name: api-service-server
  namespace: apps
spec:
  port:
    name: http
    protocol: HTTP
  proxy:
    identity:
      name: api-service
  podSelector:
    matchLabels:
      app: api-service
---
# Client-side Authorization Policy
apiVersion: policy.linkerd.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: api-service-policy
  namespace: apps
spec:
  targetRef:
    group: core
    kind: Namespace
    name: apps
  requiredAuthenticationRefs:
  - group: policy.linkerd.io
    kind: NetworkAuthentication
    name: default
`,

    'linkerd/security/server-policy.yaml': `# Server Authorization
apiVersion: policy.linkerd.io/v1beta1
kind: Server
metadata:
  name: external-api-server
  namespace: apps
spec:
  port:
    name: https
    protocol: HTTPS
    port: 8443
  podSelector:
    matchLabels:
      app: external-api
  proxy:
    identity:
      name: external-api
`,

    'linkerd/observability/service-profile.yaml': `# Service Profile for API Dashboard
apiVersion: linkerd.io/v1alpha1
kind: ServiceProfile
metadata:
  name: api-service-profile
  namespace: apps
spec:
  service: api-service
  routes:
  - name: GET /api/users
    condition:
      method: GET
      pathRegex: /api/users/.*
  - name: POST /api/users
    condition:
      method: POST
      path: /api/users
    retries:
      budget:
        percent: 90
      limit: 5
    timeout: 10s
  - name: GET /api/products
    condition:
      method: GET
      pathRegex: /api/products
    retries:
      budget:
        percent: 95
      limit: 3
    timeout: 5s
`,

    'linkerd/observability/dashboard.yaml': `# Prometheus Service Monitors for Linkerd
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: linkerd-controller
  namespace: linkerd
  labels:
    app: linkerd-controller
spec:
  selector:
    matchLabels:
      app: linkerd-controller
  endpoints:
  - port: admin-http
    interval: 10s
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: linkerd-proxy
  namespace: linkerd
  labels:
    app: linkerd-proxy
spec:
  selector:
    matchExpressions:
    - key: linkerd.io/control-plane-ns
      values:
      - linkerd
  endpoints:
  - port: linkerd-admin
    interval: 10s
    relabelings:
    - sourceLabels:
      - __meta_kubernetes_pod_name
      targetLabel: pod
      regex: (.*)
      replacement: \\x241
    - sourceLabels:
      - __meta_kubernetes_pod_label_linkerd_io_control_plane_ns
      targetLabel: namespace
      regex: (.*)
      replacement: \\x241
`,

    'linkerd/observability/grafana-dashboard.yaml': `# Grafana Dashboard ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: linkerd-grafana-dashboard
  namespace: linkerd
  labels:
    grafana_dashboard: "1"
data:
  linkerd-dashboard.json: |
    {
      "dashboard": {
        "title": "Linkerd Service Mesh",
        "tags": ["linkerd", "service-mesh"],
        "timezone": "browser",
        "panels": [
          {
            "title": "Request Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "sum(rate(linkerd_proxy_requests_total[1m])) by (deployment)"
              }
            ]
          },
          {
            "title": "Success Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "sum(rate(linkerd_proxy_responses_total{classification="success"}[1m])) by (deployment) / sum(rate(linkerd_proxy_responses_total[1m])) by (deployment)"
              }
            ]
          },
          {
            "title": "Latency P99",
            "type": "graph",
            "targets": [
              {
                "expr": "histogram_quantile(0.99, sum(rate(linkerd_proxy_latency_bucket[1m])) by (le, deployment))"
              }
            ]
          }
        ]
      }
    }
`,

    'linkerd/samples/nodejs-deployment.yaml': `# Node.js Service with Linkerd Sidecar
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
    matchLabels:
      app: nodejs-api
  template:
    metadata:
      labels:
        app: nodejs-api
        version: v1
      annotations:
        linkerd.io/inject: enabled
    spec:
      containers:
      - name: nodejs
        image: node:18-alpine
        command: ["node", "/app/index.js"]
        ports:
        - containerPort: 8080
          name: http
        env:
        - name: SERVICE_NAME
          value: "nodejs-api"
        - name: PORT
          value: "8080"
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 15
          periodSeconds: 20
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
    targetPort: 8080
  selector:
    app: nodejs-api
---
# Service Profile for Node.js API
apiVersion: linkerd.io/v1alpha1
kind: ServiceProfile
metadata:
  name: nodejs-api-profile
  namespace: apps
spec:
  service: nodejs-api
  routes:
  - name: GET /health
    condition:
      method: GET
      path: /health
  - name: GET /api/
    condition:
      method: GET
      pathRegex: /api/.*
`,

    'linkerd/samples/python-deployment.yaml': `# Python/FastAPI Service with Linkerd Sidecar
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
    matchLabels:
      app: python-api
  template:
    metadata:
      labels:
        app: python-api
        version: v1
      annotations:
        linkerd.io/inject: enabled
    spec:
      containers:
      - name: python
        image: python:3.11-slim
        command: ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
        ports:
        - containerPort: 8000
          name: http
        env:
        - name: SERVICE_NAME
          value: "python-api"
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
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
    targetPort: 8000
  selector:
    app: python-api
---
# Service Profile for Python API
apiVersion: linkerd.io/v1alpha1
kind: ServiceProfile
metadata:
  name: python-api-profile
  namespace: apps
spec:
  service: python-api
  routes:
  - name: GET /api/
    condition:
      method: GET
      pathRegex: /api/.*
    retries:
      budget:
        percent: 90
      limit: 3
    timeout: 10s
`,

    'linkerd/samples/go-deployment.yaml': `# Go/Gin Service with Linkerd Sidecar
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
    matchLabels:
      app: go-api
  template:
    metadata:
      labels:
        app: go-api
        version: v1
      annotations:
        linkerd.io/inject: enabled
    spec:
      containers:
      - name: go
        image: golang:1.21-alpine
        command: ["/app/server"]
        ports:
        - containerPort: 8080
          name: http
        env:
        - name: SERVICE_NAME
          value: "go-api"
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
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
    targetPort: 8080
  selector:
    app: go-api
`,

    'linkerd/samples/traffic-split-example.yaml': `# Traffic Splitting Example for Node.js API
apiVersion: v1
kind: Service
metadata:
  name: nodejs-api
  namespace: apps
spec:
  ports:
  - port: 8080
    name: http
    targetPort: 8080
  selector:
    app: nodejs-api
---
apiVersion: split.smi-spec.io/v1alpha1
kind: TrafficSplit
metadata:
  name: nodejs-api-split
  namespace: apps
spec:
  service: nodejs-api
  backends:
  - service: nodejs-api-v1
    weight: 90
  - service: nodejs-api-v2
    weight: 10
---
# V1 Service
apiVersion: v1
kind: Service
metadata:
  name: nodejs-api-v1
  namespace: apps
spec:
  ports:
  - port: 8080
    name: http
  selector:
    app: nodejs-api
    version: v1
---
# V2 Service
apiVersion: v1
kind: Service
metadata:
  name: nodejs-api-v2
  namespace: apps
spec:
  ports:
  - port: 8080
    name: http
  selector:
    app: nodejs-api
    version: v2
`,

    'README.md': `# Linkerd Service Mesh Configuration

Complete Linkerd service mesh configuration for lightweight service communication with automatic mTLS, observability, and zero-config mutual TLS.

## What is Linkerd?

Linkerd is a lightweight service mesh for Kubernetes. It provides:
- **Zero-config mutual TLS** - Automatic encryption between all services
- **Observability** - Golden metrics (latency, traffic, success rate) out of the box
- **Reliability** - Retries, timeouts, and circuit breaking without code changes
- **Security** - mTLS with automatic certificate rotation

## Quick Start

\`\`\`bash
# 1. Install Linkerd CLI
curl -sL https://run.linkerd.io/install | sh

# 2. Validate Kubernetes cluster
linkerd check --pre

# 3. Install Linkerd control plane
linkerd install | kubectl apply -f -

# 4. Verify installation
linkerd check

# 5. Install the control plane
kubectl apply -f linkerd/install/

# 6. Inject Linkerd into namespace
kubectl label namespace apps linkerd.io/inject=enabled

# 7. Deploy sample applications
kubectl apply -f linkerd/samples/

# 8. Verify proxy injection
linkerd check --proxy
\`\`\`

## Traffic Management

### Traffic Splitting

\`\`\`bash
# Apply traffic split (90% to v1, 10% to v2)
kubectl apply -f linkerd/traffic-management/split.yaml

# Check traffic split status
kubectl get trafficsplit -n apps
\`\`\`

### Header-Based Routing

\`\`\`bash
# Apply header-based routing
kubectl apply -f linkerd/traffic-management/header-matches.yaml

# Test with header
curl -H "x-canary: true" http://service
\`\`\`

## Security

### Enable mTLS

\`\`\`bash
# Apply mTLS policy
kubectl apply -f linkerd/security/mtls-policy.yaml

# Verify mTLS is enabled
linkerd viz -n apps edges deploy
\`\`\`

## Observability

### Service Profiles

Service profiles define retry policy, timeouts, and route metrics for services:

\`\`\`bash
# Apply service profile
kubectl apply -f linkerd/observability/service-profile.yaml

# View dashboard
linkerd viz dashboard
\`\`\`

### Metrics

Linkerd provides golden metrics out of the box:

- **Request Rate**: Requests per second
- **Success Rate**: Percentage of successful responses
- **Latency**: Response times (P50, P95, P99)
- **Traffic**: Bytes in/out

\`\`\`bash
# View metrics
linkerd viz stat deploy

# View top-line metrics
linkerd viz top deploy
\`\`\`

## Polyglot Support

The templates include:
- Node.js/Express API
- Python/FastAPI service
- Go/Gin microservice

Each service is configured with:
- Automatic Linkerd proxy injection
- mTLS enabled by default
- Health checks
- Service profiles for observability

## Commands

\`\`\`bash
# View service mesh dashboard
linkerd viz dashboard

# Check mesh status
linkerd check

# View service topology
linkerd viz edges

# Tap live requests
linkerd viz tap deploy/nodejs-api

# View profile stats
linkerd viz stat svc -n apps
\`\`\`

## License

MIT
`,

    'Makefile': `.PHONY: help install validate inject deploy clean test logs dashboard

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \\033[36m%-15s\\033[0m %s\\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install Linkerd CLI
	curl -sL https://run.linkerd.io/install | sh
	linkerd check --pre

deploy: ## Install Linkerd control plane
	linkerd install | kubectl apply -f -
	kubectl apply -f linkerd/install/
	kubectl wait --for=condition=available -n linkerd deployment/linkerd-controller --timeout=120s
	kubectl wait --for=condition=available -n linkerd deployment/linkerd-web --timeout=120s

validate: ## Validate Linkerd installation
	linkerd check
	linkerd check --proxy

inject: ## Inject Linkerd into namespace
	kubectl label namespace apps linkerd.io/inject=enabled --overwrite
	kubectl label namespace production linkerd.io/inject=enabled --overwrite

deploy-samples: ## Deploy sample applications
	kubectl apply -f linkerd/samples/

deploy-traffic: ## Deploy traffic management
	kubectl apply -f linkerd/traffic-management/

deploy-security: ## Deploy security policies
	kubectl apply -f linkerd/security/

deploy-observability: ## Deploy observability configs
	kubectl apply -f linkerd/observability/

clean: ## Remove Linkerd
	linkerd install --ignore-cluster | kubectl delete -f -
	kubectl delete namespace linkerd
	kubectl delete namespace apps

logs: ## Show Linkerd logs
	kubectl logs -n linkerd -l linkerd.io/control-plane-component=controller --tail=100 -f

dashboard: ## Open Linkerd dashboard
	linkerd viz dashboard &

tap: ## Tap live requests from a service
	@read -p "Enter deployment name: " DEPLOY; \\
	linkerd viz tap -n apps deploy/\\$$DEPLOY

stat: ## Show service statistics
	linkerd viz stat -n apps deploy

edges: ## Show service topology
	linkerd viz edges -n apps

top: ## Show top-line metrics
	linkerd viz top -n apps deploy

test: ## Run mesh diagnostics
	linkerd check
	linkerd check --proxy
	linkerd viz edges -n apps
`
  },

  postInstall: [
    `echo "Setting up Linkerd service mesh..."
echo ""
echo "1. Install Linkerd CLI:"
echo "   curl -sL https://run.linkerd.io/install | sh"
echo ""
echo "2. Validate your Kubernetes cluster:"
echo "   linkerd check --pre"
echo ""
echo "3. Install Linkerd control plane:"
echo "   linkerd install | kubectl apply -f -"
echo ""
echo "4. Verify installation:"
echo "   linkerd check"
echo ""
echo "5. Enable auto-injection for namespaces:"
echo "   kubectl label namespace apps linkerd.io/inject=enabled"
echo ""
echo "6. Deploy sample applications:"
echo "   kubectl apply -f linkerd/samples/"
echo ""
echo "7. View dashboard:"
echo "   linkerd viz dashboard"
`
  ]
};
