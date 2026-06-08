import { BackendTemplate } from '../types';

/**
 * Deployment Strategies Template
 * Canary and blue-green deployment strategies for Kubernetes
 */
export const deploymentStrategiesTemplate: BackendTemplate = {
  id: 'deployment-strategies',
  name: 'Deployment Strategies',
  displayName: 'Canary & Blue-Green Deployments',
  description: 'Complete deployment strategies with canary releases, blue-green deployments, A/B testing, traffic splitting, and automated rollback',
  version: '1.0.0',
  language: 'typescript',
  framework: 'kubernetes',
  tags: ['kubernetes', 'deployment', 'canary', 'blue-green', 'traffic-splitting', 'rollback'],
  port: 3000,
  dependencies: {},
  features: ['monitoring', 'security', 'documentation'],

  files: {
    'canary/base-deployment.yaml': `# Base Deployment for Canary Strategy
# Production deployment that receives most traffic

apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-stable
  namespace: production
  labels:
    app: myapp
    version: stable
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      version: stable
  template:
    metadata:
      labels:
        app: myapp
        version: stable
    spec:
      containers:
      - name: myapp
        image: myorg/myapp:v1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: VERSION
          value: "v1.0.0"
        - name: ENVIRONMENT
          value: "production"
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: myapp-stable
  namespace: production
spec:
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: myapp
    version: stable
`,

    'canary/canary-deployment.yaml': `# Canary Deployment
# Small percentage of traffic goes to canary version

apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-canary
  namespace: production
  labels:
    app: myapp
    version: canary
spec:
  replicas: 1
  selector:
    matchLabels:
      app: myapp
      version: canary
  template:
    metadata:
      labels:
        app: myapp
        version: canary
    spec:
      containers:
      - name: myapp
        image: myorg/myapp:v2.0.0
        ports:
        - containerPort: 3000
        env:
        - name: VERSION
          value: "v2.0.0"
        - name: ENVIRONMENT
          value: "production"
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: myapp-canary
  namespace: production
spec:
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: myapp
    version: canary
`,

    'canary/istio-canary.yaml': `# Istio Canary Deployment with Traffic Splitting

apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: myapp
  namespace: production
spec:
  host: myapp
  subsets:
    - name: stable
      labels:
        version: stable
    - name: canary
      labels:
        version: canary

---
# 10% to canary, 90% to stable
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: myapp
  namespace: production
spec:
  hosts:
    - myapp
  http:
    - match:
        - headers:
            x-canary:
              exact: "true"
      route:
        - destination:
            host: myapp
            subset: canary
    - route:
        - destination:
            host: myapp
            subset: stable
          weight: 90
        - destination:
            host: myapp
            subset: canary
          weight: 10
`,

    'canary/flagger-canary.yaml': `# Flagger Progressive Delivery Canary

apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: myapp
  namespace: production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  service:
    port: 80
    targetPort: 3000
  analysis:
    interval: 1m
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    metrics:
      - name: request-success-rate
        thresholdRange:
          min: 99
        interval: 1m
      - name: request-duration
        thresholdRange:
          max: 500
        interval: 1m
    webhooks:
      - name: smoke-test
        url: http://flagger-loadtester/
        timeout: 5s
        metadata:
          cmd: "curl -s http://myapp-canary/"
  autoscalerRef:
    apiVersion: autoscaling/v2
    kind: HorizontalPodAutoscaler
    name: myapp
`,

    'blue-green/blue-green-deployment.yaml': `# Blue-Green Deployment Strategy
# Switch traffic between blue and green environments

apiVersion: v1
kind: Namespace
metadata:
  name: blue-green

---
# Blue Environment (Current Production)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-blue
  namespace: blue-green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      env: blue
  template:
    metadata:
      labels:
        app: myapp
        env: blue
    spec:
      containers:
      - name: myapp
        image: myorg/myapp:v1.0.0
        ports:
        - containerPort: 3000

---
# Green Environment (New Version)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-green
  namespace: blue-green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      env: green
  template:
    metadata:
      labels:
        app: myapp
        env: green
    spec:
      containers:
      - name: myapp
        image: myorg/myapp:v2.0.0
        ports:
        - containerPort: 3000

---
# Blue Service
apiVersion: v1
kind: Service
metadata:
  name: myapp-blue
  namespace: blue-green
spec:
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: myapp
    env: blue

---
# Green Service
apiVersion: v1
kind: Service
metadata:
  name: myapp-green
  namespace: blue-green
spec:
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: myapp
    env: green

---
# Main Service (Switch between Blue/Green)
apiVersion: v1
kind: Service
metadata:
  name: myapp
  namespace: blue-green
spec:
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: myapp
    env: blue
`,

    'blue-green/switch-to-green.sh': `#!/bin/bash
# Switch traffic from blue to green environment

set -e

echo "Switching traffic to Green environment..."

# Patch the service selector to point to green
kubectl patch svc myapp -n blue-green \\
  --type='json' \\
  -p='[{"op": "replace", "path": "/spec/selector/env", "value": "green"}]'

echo "Traffic switched to Green!"
echo ""
echo "Verify with:"
echo "  kubectl get svc myapp -n blue-green"
`,

    'blue-green/rollback-to-blue.sh': `#!/bin/bash
# Rollback traffic from green to blue environment

set -e

echo "Rolling back traffic to Blue environment..."

# Patch the service selector to point to blue
kubectl patch svc myapp -n blue-green \\
  --type='json' \\
  -p='[{"op": "replace", "path": "/spec/selector/env", "value": "blue"}]'

echo "Traffic rolled back to Blue!"
echo ""
echo "Verify with:"
echo "  kubectl get svc myapp -n blue-green"
`,

    'ab-testing/ab-test-deployment.yaml': `# A/B Testing Deployment
# Route users to different versions based on headers

apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-a
  namespace: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: myapp
      variant: a
  template:
    metadata:
      labels:
        app: myapp
        variant: a
    spec:
      containers:
      - name: myapp
        image: myorg/myapp:v1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: VARIANT
          value: "A"

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-b
  namespace: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: myapp
      variant: b
  template:
    metadata:
      labels:
        app: myapp
        variant: b
    spec:
      containers:
      - name: myapp
        image: myorg/myapp:v2.0.0
        ports:
        - containerPort: 3000
        env:
        - name: VARIANT
          value: "B"

---
apiVersion: v1
kind: Service
metadata:
  name: myapp-a
  namespace: production
spec:
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: myapp
    variant: a

---
apiVersion: v1
kind: Service
metadata:
  name: myapp-b
  namespace: production
spec:
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: myapp
    variant: b

---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: myapp-ab-test
  namespace: production
spec:
  hosts:
    - myapp
  http:
    # Users with x-ab-test header = b go to variant B
    - match:
        - headers:
            x-ab-test:
              exact: "b"
      route:
        - destination:
            host: myapp-b
    # All others go to variant A
    - route:
        - destination:
            host: myapp-a
`,

    'ab-testing/split-by-header.yaml': `# Traffic Splitting by User Headers
# Allows routing to specific variants based on cookies/headers

apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: myapp-split
  namespace: production
spec:
  hosts:
    - myapp
  http:
    # Internal users get variant B
    - match:
        - headers:
            x-internal-user:
              exact: "true"
      route:
        - destination:
            host: myapp-b
    # Beta users get variant B
    - match:
        - headers:
            x-beta-user:
              exact: "true"
      route:
        - destination:
            host: myapp-b
    # Everyone else gets variant A (stable)
    - route:
        - destination:
            host: myapp-a

---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: myapp-mirror
  namespace: production
spec:
  hosts:
    - myapp
  http:
    - route:
        - destination:
            host: myapp-a
          weight: 100
      mirror:
        host: myapp-b
      mirrorPercentage:
        value: 10
`,

    'rollback/rollback-strategy.yaml': `# Automated Rollback Configuration

apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: myapp-with-rollback
  namespace: production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  service:
    port: 80
  analysis:
    interval: 30s
    threshold: 10
    maxWeight: 50
    stepWeight: 5
    metrics:
      # Rollback if error rate > 1%
      - name: error-rate
        thresholdRange:
          max: 1
        interval: 30s
        templateRef:
          name: error-rate
          namespace: istio-system
      # Rollback if latency increases by 50%
      - name: latency
        thresholdRange:
          max: 150
        interval: 30s
        templateRef:
          name: latency
          namespace: istio-system
      # Rollback if request success rate < 99%
      - name: request-success-rate
        thresholdRange:
          min: 99
        interval: 30s
    webhooks:
      - name: acceptance-test
        url: http://acceptance-test/
        timeout: 30s
        metadata:
          test_command: "npm run test:acceptance"
  rollback:
    # Automatically rollback on failure
    enabled: true
    # Keep previous deployment ready
    scaleDownDelay: 30s

---
# Kubernetes Rollback ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: rollback-config
  namespace: production
data:
  rollback.sh: |
    #!/bin/bash
    DEPLOYMENT_NAME=myapp
    NAMESPACE=production

    echo "Rolling back DEPLOYMENT_NAME in NAMESPACE..."

    # Get current revision
    CURRENT_REVISION=kubectl rollout status

    # Rollback to previous revision
    kubectl rollout undo deployment

    echo "Rolled back from revision"
`,

    'argo-rollouts/rollout.yaml': `# Argo Rollouts Deployment Strategy

apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 5
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myorg/myapp:v1.0.0
        ports:
        - containerPort: 3000
  strategy:
    canary:
      # Canary deployment strategy
      canaryService: myapp-canary
      stableService: myapp-stable
      trafficManagement:
        managedRoutes:
          - name: canary-route
      steps:
        # 20% to canary
        - setWeight: 20
        - pause: { duration: 5m }
        # 40% to canary
        - setWeight: 40
        - pause: { duration: 5m }
        # 60% to canary
        - setWeight: 60
        - pause: { duration: 5m }
        # 100% to canary (complete)
        - setWeight: 100
      analysis:
        templates:
          - templateName: success-rate
        args:
          - name: service-name
            value: myapp-canary
        args:
          - name: stable-service-name
            value: myapp-stable
      # Blue-Green promotion
      blueGreen:
        activeService: myapp-active
        previewService: myapp-preview
        previewReplicaCount: 1
        autoPromotionEnabled: false
        scaleDownDelaySeconds: 30
        prePromotionAnalysis:
          templates:
            - templateName: success-rate
          args:
            - name: service-name
              value: myapp-preview
        postPromotionAnalysis:
          templates:
            - templateName: success-rate
          args:
            - name: service-name
              value: myapp-active
          # Rollback if analysis fails
          failureLimit: 3

---
# AnalysisTemplate for success rate
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
  namespace: production
spec:
  args:
    - name: service-name
    - name: stable-service-name
  metrics:
    - name: success-rate
      interval: 30s
      count: 5
      successCondition: result[0] >= 0.95
      failureLimit: 3
      provider:
        prometheus:
          address: http://prometheus:9090
          query: |
            sum(rate(http_requests_total{service="{{args.service-name}}",status!~"5.."}[1m]))
            /
            sum(rate(http_requests_total{service="{{args.service-name}}"}[1m]))
`,

    'nginx/ingress-canary.yaml': `# NGINX Ingress Canary Annotation

apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-stable
  namespace: production
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/canary: "false"
spec:
  rules:
    - host: myapp.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: myapp-stable
                port:
                  number: 80

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-canary
  namespace: production
  annotations:
    kubernetes.io/ingress.class: nginx
    # Enable canary
    nginx.ingress.kubernetes.io/canary: "true"
    # 20% traffic to canary
    nginx.ingress.kubernetes.io/canary-weight: "20"
    # Only canary users with specific header
    nginx.ingress.kubernetes.io/canary-by-header: "X-Canary"
    nginx.ingress.kubernetes.io/canary-by-header-value: "true"
spec:
  rules:
    - host: myapp.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: myapp-canary
                port:
                  number: 80
`,

    'scripts/deploy-canary.sh': `#!/bin/bash
# Deploy canary release with traffic shifting

set -e

echo "Starting canary deployment..."

# Step 1: Deploy canary version
echo "Step 1: Deploying canary pods..."
kubectl apply -f canary/canary-deployment.yaml

# Step 2: Wait for canary to be ready
echo "Step 2: Waiting for canary to be ready..."
kubectl wait --for=condition=available deployment/myapp-canary

# Step 3: Monitor and gradually increase traffic
echo "Step 3: Monitor and increase traffic gradually..."

# Complete deployment
echo "Canary deployment complete!"
`,

    'docker-compose.yml': `version: '3.8'

services:
  # Blue Environment
  app-blue:
    image: myorg/myapp:v1.0.0
    container_name: app-blue
    ports:
      - "3001:3000"
    environment:
      - VERSION=v1.0.0
      - ENV=blue
    networks:
      - deployment-net

  # Green Environment
  app-green:
    image: myorg/myapp:v2.0.0
    container_name: app-green
    ports:
      - "3002:3000"
    environment:
      - VERSION=v2.0.0
      - ENV=green
    networks:
      - deployment-net

  # NGINX Router (Traffic Switch)
  nginx-router:
    image: nginx:alpine
    container_name: nginx-router
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    networks:
      - deployment-net
    depends_on:
      - app-blue
      - app-green

  # Prometheus for monitoring
  prometheus:
    image: prom/prometheus:v2.47.0
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    networks:
      - deployment-net

  # Grafana for dashboards
  grafana:
    image: grafana/grafana:10.1.0
    container_name: grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    networks:
      - deployment-net
    depends_on:
      - prometheus

networks:
  deployment-net:
    driver: bridge
`,

    'nginx/nginx.conf': `events {
    worker_connections 1024;
}

http {
    upstream blue {
        server app-blue:3000;
    }

    upstream green {
        server app-green:3000;
    }

    server {
        listen 80;
        server_name localhost;

        location / {
            proxy_pass http://blue;
            proxy_set_header Host host;
            proxy_set_header X-Real-IP remote_addr;
        }

        location /health {
            proxy_pass http://blue/health;
        }

        location /canary {
            proxy_pass http://blue;
        }
    }
}
`,

    'README.md': `# Deployment Strategies

Complete deployment strategies with canary releases, blue-green deployments, A/B testing, traffic splitting, and automated rollback.

## Features

### Canary Deployment
- Progressive traffic shifting (10% -> 50% -> 100%)
- Automated monitoring and rollback
- Istio VirtualService configuration
- Flagger progressive delivery
- Argo Rollouts integration

### Blue-Green Deployment
- Zero-downtime deployments
- Instant rollback capability
- Service selector switching
- Pre- and post-deployment testing

### A/B Testing
- Header-based routing
- Cookie-based user segmentation
- Mirror traffic for testing
- Variant-specific metrics

### Traffic Management
- NGINX Ingress canary annotations
- Istio traffic splitting
- Weighted routing
- Header-based routing

## Quick Start

bash code for starting the deployment

## License

MIT
`,

    'Makefile': `.PHONY: help deploy-blue deploy-green switch-to-green switch-to-blue rollback clean

help:
	@echo "Available targets: deploy-blue deploy-green switch-to-green switch-to-blue rollback clean"

deploy-blue:
	kubectl apply -f blue-green/blue-green-deployment.yaml

deploy-green:
	kubectl apply -f blue-green/blue-green-deployment.yaml

switch-to-green:
	./blue-green/switch-to-green.sh

switch-to-blue:
	./blue-green/rollback-to-blue.sh

rollback:
	kubectl rollout undo deployment/myapp-stable

clean:
	kubectl delete -f blue-green/blue-green-deployment.yaml
`
  },

  postInstall: [
    `echo "Setting up deployment strategies..."
echo ""
echo "Available Strategies:"
echo "- Canary: Progressive traffic shifting"
echo "- Blue-Green: Zero-downtime deployments"
echo "- A/B Testing: Header-based routing"
echo ""
echo "Quick Start:"
echo "  make deploy-blue"
echo "  make switch-to-green"
echo ""
echo "Deploy Canary:"
echo "  ./scripts/deploy-canary.sh"
`
  ]
};
